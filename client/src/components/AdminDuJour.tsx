import { useEffect, useState } from 'react'
import { api, motifDe, type AdminDuJour as Etat, type ProfilMasquable } from '../api'
import { confirmDialog } from './Dialog'
import { Flamme, Icon } from './Icon'
import { AujourdhuiDuJour, ClassementDuMoisAuQg, JoueursParJour, QuestionsDuJour, RappelDuSoirAuQg, SeriesDuJourAuQg } from './QgDuJour'
import { copierTexte } from '../copier'
import { quand } from '../format'
import { showToast } from '../state'
import { jourEnToutesLettres } from '../../../shared/jour'
import type { QuizQuestionDef } from '../../../shared/library'
import type { SuiviDuJour } from '../../../shared/qgDuJour'
// Le même seuil que « À traiter », à la vue d'ensemble du QG : écrit deux fois, il pouvait s'allumer ici et pas là.
import { ALERTE_JOURS_D_AVANCE as ALERTE_JOURS, type VueDEnsemble } from '../../../shared/qg'

const SOURCES: Record<string, string> = { livre: 'Quiz livrés', liste: 'Liste collée', ia: 'Écrite par l’IA' }

/**
 * Le quiz du jour, côté administrateur : les chiffres d'aujourd'hui, la
 * réserve et ses jours d'avance, de quoi la remplir (« Coller une liste », le
 * format de l'éditeur), le tirage question par question, les signalements
 * des joueurs — annuler une question pour tous, la retirer, la garder —, les
 * joueurs des trente derniers jours, le classement du mois, les séries, le
 * rappel du soir, et les profils à masquer du classement (`QgDuJour.tsx`).
 * La vue d'ensemble du QG lui prête ses trente jours : déjà lus, ils ne se
 * relisent pas ici.
 */
export function AdminDuJour({ vue }: { vue: VueDEnsemble | null }) {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [erreur, setErreur] = useState('')
  const [suivi, setSuivi] = useState<SuiviDuJour | null>(null)
  const [suiviEnPanne, setSuiviEnPanne] = useState(false)
  const [liste, setListe] = useState<string | null>(null)
  const [prochaines, setProchaines] = useState<{ id: string; question: QuizQuestionDef; source: string }[] | null>(null)
  const [cherche, setCherche] = useState('')
  const [trouves, setTrouves] = useState<ProfilMasquable[]>([])
  const [occupe, setOccupe] = useState(false)
  /** La consigne que le presse-papiers a refusée : dépliée, prête à sélectionner à la main. */
  const [consigne, setConsigne] = useState<string | null>(null)

  const charger = () =>
    api.admin
      .jour()
      .then(setEtat)
      .catch(e => setErreur(motifDe(e)))
  // Le suivi à part : la réserve se montre sans attendre les séries, et une panne de l'un n'ôte pas l'autre.
  const chargerLeSuivi = () =>
    api.admin.suiviDuJour().then(
      s => {
        setSuivi(s)
        setSuiviEnPanne(false)
      },
      () => setSuiviEnPanne(true),
    )
  useEffect(() => {
    void charger()
    void chargerLeSuivi()
  }, [])

  const faire = async (appel: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await Promise.all([charger(), chargerLeSuivi()])
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  /** Annuler une question d'aujourd'hui pour tous, signalée ou non : ses points repartent, rien ne la rend. */
  const annuler = async (jour: string, index: number) => {
    const ok = await confirmDialog({
      title: `Annuler la question ${index + 1} pour tous ?`,
      message:
        'Ses points s’effacent pour tous ceux qui l’ont jouée aujourd’hui, du classement du jour comme de celui du mois, et l’expérience de chacun suit. Elle reste dans le tirage, annulée : on ne peut pas revenir en arrière.',
      confirmLabel: 'Annuler ses points',
      danger: true,
    })
    if (ok) await faire(() => api.admin.annulerDuJour(jour, index), 'Points annulés pour tous')
  }

  const coller = async () => {
    if (!liste?.trim()) return
    setOccupe(true)
    try {
      const r = await api.admin.listeDuJour(liste)
      const raisons = r.ecartees.length > 0 ? ` · ${r.ecartees.length} écartée${r.ecartees.length > 1 ? 's' : ''}` : ''
      showToast({ kind: r.ajoutees > 0 ? 'info' : 'error', message: `${r.ajoutees} question${r.ajoutees > 1 ? 's' : ''} ajoutée${r.ajoutees > 1 ? 's' : ''}${raisons}` })
      if (r.ajoutees > 0) setListe(null)
      await charger()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  /**
   * « Copier la consigne pour une IA » : la même que celle de la routine, à
   * coller dans le chatbot de son choix — sa réponse se recolle ensuite
   * dans « Coller une liste ». Le secours quand la routine s'arrête.
   */
  const copierLaConsigne = async () => {
    setOccupe(true)
    try {
      const { consigne } = await api.admin.consigneDuJour()
      if (await copierTexte(consigne)) {
        setConsigne(null)
        showToast({ kind: 'info', message: 'Consigne copiée : colle-la dans ton IA, puis sa réponse dans « Coller une liste »' })
      } else {
        setConsigne(consigne)
      }
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  useEffect(() => {
    if (cherche.trim().length < 2) return setTrouves([])
    // Une recherche courte, plus lente, qui revenait après une longue
    // remplaçait sa liste : sous « camille », les profils de « ca ».
    let perimee = false
    const t = setTimeout(() => {
      api.admin
        .profilsDuJour(cherche)
        .then(trouves => !perimee && setTrouves(trouves))
        .catch(() => {})
    }, 250)
    return () => {
      perimee = true
      clearTimeout(t)
    }
  }, [cherche])

  // Les phrases parlent du profil, jamais de la personne : un prénom ne dit pas qui l'on est.
  const masquer = async (p: Pick<ProfilMasquable, 'id' | 'nom'>, masque: boolean) => {
    if (
      masque &&
      !(await confirmDialog({
        title: `Masquer ${p.nom} du classement ?`,
        message:
          'Le profil ne paraîtra plus aux classements du quiz du jour et des duels, ni sur les podiums et les lauriers, et on ne pourra plus le défier. Personne ne l’en avertit : sur son téléphone, sa ligne reste.',
        confirmLabel: 'Masquer',
      }))
    )
      return
    await faire(() => api.admin.masquerDuJour(p.id, masque), masque ? `Profil masqué du classement : ${p.nom}` : `Profil remis au classement : ${p.nom}`)
    setTrouves(ts => ts.map(t => (t.id === p.id ? { ...t, masque } : t)))
  }

  if (erreur) return <p className="error">{erreur}</p>
  if (!etat) return null
  const { reserve } = etat
  const dernierDepot = reserve.apports.find(a => a.source === 'ia')
  return (
    <>
      <AujourdhuiDuJour suivi={suivi} vue={vue} />
      {/* La réserve d'abord, dans le cadre du tableau de bord : c'est ce
          qu'on vient vérifier, et ce qui s'allume quand elle baisse. */}
      <section className={'admin-hud' + (reserve.joursDAvance < ALERTE_JOURS ? ' admin-hud-alerte' : '')} aria-labelledby="reserve-titre">
        <span className="salon-hud-label" id="reserve-titre">
          <Flamme /> La réserve
        </span>
        <div className="reserve-tete">
          <span className="reserve-jours num">{reserve.joursDAvance}</span>
          <div>
            <b>jour{reserve.joursDAvance > 1 ? 's' : ''} d’avance</b>
            <span className="muted small">
              {reserve.pretes} question{reserve.pretes > 1 ? 's' : ''} prête{reserve.pretes > 1 ? 's' : ''} · {reserve.posees} déjà posée
              {reserve.posees > 1 ? 's' : ''} · alerte sous {ALERTE_JOURS} jours
            </span>
          </div>
        </div>
        <div className="jauge reserve-jauge" aria-hidden="true">
          <span className="jauge-plein" style={{ width: `${Math.min(100, (reserve.joursDAvance / 30) * 100)}%` }} />
        </div>
        {reserve.joursDAvance < ALERTE_JOURS && (
          <p className="error">
            Moins d’une semaine d’avance. Colle une liste, ou copie la consigne dans ton IA : sans question neuve, la
            réserve rejouera les plus anciennes.
          </p>
        )}
        <p className="reserve-remplissage small">
          <Icon name={etat.remplissage.automatique ? 'check-circle' : 'lock'} />
          {etat.remplissage.automatique ? (
            <span>
              <b>Remplissage automatique ouvert</b> : une routine Claude Code y dépose les questions.
              {dernierDepot ? ` Dernier dépôt : ${quand(dernierDepot.quand)}.` : ' Aucun dépôt pour l’instant.'}
            </span>
          ) : (
            <span>
              <b>Pas de remplissage automatique</b> : pose <code>RESERVE_TOKEN</code> sur le serveur (MISE-EN-LIGNE.md),
              ou copie la consigne dans ton IA.
            </span>
          )}
        </p>
        <p className="muted small">
          Dix questions par jour, catégories mêlées, pas deux fois la même. Le quiz du jour joue les questions à choix, sans
          photo : les estimations, les variantes et les photos sont écartées, et le disent.
        </p>
        {reserve.apports.length > 0 && (
          <ul className="journal-reserve">
            {reserve.apports.map(a => (
              <li key={a.quand}>
                <Icon name="check-circle" />
                <span>
                  <b>{quand(a.quand)}</b> · {SOURCES[a.source] ?? a.source} · {a.ajoutees} ajoutée{a.ajoutees > 1 ? 's' : ''}
                  {a.ecartees.length > 0 &&
                    `, ${a.ecartees.length} écartée${a.ecartees.length > 1 ? 's' : ''} (${[...new Set(a.ecartees.map(e => e.raison))].join(', ')})`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {liste !== null ? (
          <div className="liste-a-coller">
            <textarea
              className="input"
              rows={10}
              value={liste}
              onChange={e => setListe(e.target.value)}
              placeholder={'Quelle est la capitale de l’Australie ?\n*Canberra\nSydney\nMelbourne\n\n# Histoire\nEn quelle année…'}
              aria-label="La liste de questions"
            />
            <div className="row">
              <button className="btn btn-primary" disabled={occupe || !liste.trim()} onClick={() => void coller()}>
                Ajouter à la réserve
              </button>
              <button className="btn btn-ghost" onClick={() => setListe(null)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="admin-gestes">
            <button type="button" className="salon-geste admin-geste-oui" onClick={() => setListe('')}>
              <Icon name="clipboard" />
              Coller une liste
            </button>
            <button type="button" className="salon-geste" disabled={occupe} onClick={() => void copierLaConsigne()}>
              <Icon name="copy" />
              Copier la consigne pour une IA
            </button>
            <button
              type="button"
              className="salon-geste"
              onClick={() =>
                prochaines
                  ? setProchaines(null)
                  : api.admin
                      .prochainesDuJour()
                      .then(setProchaines)
                      .catch(e => showToast({ kind: 'error', message: motifDe(e) }))
              }
            >
              <Icon name="eye" />
              {prochaines ? 'Masquer les prochains jours' : 'Voir les prochains jours'}
            </button>
          </div>
        )}
        {consigne && (
          <div className="consigne-a-copier">
            <p className="muted small">Le navigateur a refusé la copie : sélectionne la consigne à la main.</p>
            <pre className="import-example import-format-complet">{consigne}</pre>
          </div>
        )}
        {prochaines && (
          <ol className="prochaines-du-jour small">
            {prochaines.map(p => (
              <li key={p.id}>
                {p.question.text}{' '}
                <span className="muted">
                  · {p.question.answers[p.question.correct]}
                  {p.question.category && ` · ${p.question.category}`}
                </span>{' '}
                <button
                  className="link-inline"
                  disabled={occupe}
                  onClick={() => void faire(() => api.admin.retirerDuJour(p.id), 'Retirée de la réserve').then(() => setProchaines(ps => ps && ps.filter(x => x.id !== p.id)))}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <QuestionsDuJour
        suivi={suivi}
        enPanne={suiviEnPanne}
        occupe={occupe}
        annuler={q => suivi && void annuler(suivi.jour, q.index)}
        retirer={q => suivi && void faire(() => api.admin.retirerDuJour(q.reserveId, suivi.jour, q.index), 'Retirée de la réserve')}
      />

      <section className="admin-groupe" aria-labelledby="signalements-titre">
        <h2 className="compte-groupe" id="signalements-titre">
          Signalements {etat.signalements.length > 0 && <span className="compte-rond">{etat.signalements.length}</span>}
        </h2>
        {etat.signalements.length === 0 && <p className="muted small">Aucun signalement à relire.</p>}
        {etat.signalements.map(s => (
          <div key={`${s.jour}#${s.index}`} className="signalement">
            <p>
              <b>« {s.texte} »</b>{' '}
              <span className="muted">
                · {jourEnToutesLettres(s.jour, true)} · réponse : {s.bonne}
                {s.annulee && ' · annulée'}
              </span>
            </p>
            <p className="muted small">
              {s.joueurs} joueur{s.joueurs > 1 ? 's' : ''} : {s.textes.map(t => `« ${t} »`).join(' · ')}
            </p>
            <div className="row">
              {s.annulable && !s.annulee && (
                <button className="btn btn-small btn-danger" disabled={occupe} onClick={() => void annuler(s.jour, s.index)}>
                  Annuler ses points pour tous
                </button>
              )}
              <button
                className="btn btn-small"
                disabled={occupe}
                onClick={() => void faire(() => api.admin.retirerDuJour(s.reserveId, s.jour, s.index), 'Retirée de la réserve')}
              >
                Retirer de la réserve
              </button>
              <button className="btn btn-small btn-ghost" disabled={occupe} onClick={() => void faire(() => api.admin.garderDuJour(s.jour, s.index), 'Gardée')}>
                Garder
              </button>
            </div>
          </div>
        ))}
      </section>

      <JoueursParJour vue={vue} />
      <div className="qg-deux">
        <ClassementDuMoisAuQg suivi={suivi} occupe={occupe} masquer={l => void masquer({ id: l.profileId, nom: l.nom }, true)} />
        <SeriesDuJourAuQg suivi={suivi} />
      </div>
      <RappelDuSoirAuQg suivi={suivi} />

      <section className="admin-groupe" id="masques" aria-labelledby="classement-titre">
        <h2 className="compte-groupe" id="classement-titre">
          Masquer un profil
        </h2>
        <p className="muted small">
          Tous les profils du serveur qui jouent. Un prénom qui ne va pas se masque ici : le profil ne paraît plus aux
          classements, ni sur les podiums, et il n’en est pas averti. Les profils masqués se remettent d’ici.
        </p>
        <input className="input" placeholder="Chercher un profil" value={cherche} onChange={e => setCherche(e.target.value)} aria-label="Chercher un profil" />
        {[...trouves, ...etat.masques.filter(m => !trouves.some(t => t.id === m.id))].map(p => (
          <div key={p.id} className="row signalement">
            <span>
              {p.avatar} {p.nom} <span className="muted small">@{p.login}</span>
              {p.masque && <span className="muted small"> · masqué</span>}
            </span>
            <button className="btn btn-small" disabled={occupe} onClick={() => void masquer(p, !p.masque)}>
              {p.masque ? 'Remettre au classement' : 'Masquer du classement'}
            </button>
          </div>
        ))}
      </section>
    </>
  )
}

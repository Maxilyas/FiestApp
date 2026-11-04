import { useEffect, useState } from 'react'
import { api, motifDe, type AdminDuJour as Etat, type ProfilMasquable } from '../api'
import { confirmDialog } from './Dialog'
import { AujourdhuiDuJour, ClassementDuMoisAuQg, JoueursParJour, QuestionsDuJour, RappelDuSoirAuQg, SeriesDuJourAuQg } from './QgDuJour'
import { confirmerLeMasque } from './QgModes'
import { VersLesSignalements } from './QgSignalements'
import { VersUnePageDuContenu } from './QgReserves'
import { QuestionsDuPublicAuQg } from './QgQuestionsDuPublic'
import { showToast } from '../state'
import type { SuiviDuJour } from '../../../shared/qgDuJour'
// Le même seuil que « À traiter », à la vue d'ensemble du QG : écrit deux fois, il pouvait s'allumer ici et pas là.
import { ALERTE_JOURS_D_AVANCE as ALERTE_JOURS, type VueDEnsemble } from '../../../shared/qg'

/**
 * Le quiz du jour, côté administrateur : les chiffres d'aujourd'hui, la ligne
 * qui mène à sa réserve — ses jours d'avance, de quoi la remplir : elle vit
 * sur la page « Réserves et base » depuis le QG 2, lot 7 (`QgReserves.tsx`) —,
 * le tirage question par question, la ligne qui mène aux signalements des
 * joueurs — ils se relisent sur leur page, avec ceux de la campagne
 * (`AdminSignalements.tsx`) —, les joueurs des trente derniers jours, le
 * classement du mois, les séries, le rappel du soir, et les profils à masquer
 * du classement (`QgDuJour.tsx`). La vue d'ensemble du QG lui prête ses trente
 * jours : déjà lus, ils ne se relisent pas ici.
 */
export function AdminDuJour({ vue, versLesSignalements, versLesReserves }: { vue: VueDEnsemble | null; versLesSignalements: () => void; versLesReserves: () => void }) {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [erreur, setErreur] = useState('')
  const [suivi, setSuivi] = useState<SuiviDuJour | null>(null)
  const [suiviEnPanne, setSuiviEnPanne] = useState(false)
  const [cherche, setCherche] = useState('')
  const [trouves, setTrouves] = useState<ProfilMasquable[]>([])
  const [occupe, setOccupe] = useState(false)

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
    if (masque && !(await confirmerLeMasque(p.nom))) return
    await faire(() => api.admin.masquerDuJour(p.id, masque), masque ? `Profil masqué du classement : ${p.nom}` : `Profil remis au classement : ${p.nom}`)
    setTrouves(ts => ts.map(t => (t.id === p.id ? { ...t, masque } : t)))
  }

  if (erreur) return <p className="error">{erreur}</p>
  if (!etat) return null
  const { reserve } = etat
  // Le seuil réglé sur la page des alertes, que « À traiter » lit aussi ; avant la vue d'ensemble, celui d'office.
  const seuil = vue?.aTraiter.seuilDeLaReserve ?? ALERTE_JOURS
  return (
    <>
      <AujourdhuiDuJour suivi={suivi} vue={vue} />
      {/* La réserve vit sur « Réserves et base » (le QG 2, lot 7) : ici, ce qu'on vient vérifier — ses jours d'avance,
          en rouge quand elle baisse —, et la ligne qui mène à de quoi la remplir. */}
      <section className="admin-groupe" aria-label="La réserve">
        <VersUnePageDuContenu
          icone="book"
          href="/admin#reserves"
          alerte={reserve.joursDAvance < seuil}
          titre={`La réserve : ${reserve.joursDAvance} jour${reserve.joursDAvance > 1 ? 's' : ''} d’avance`}
          detail={`${reserve.pretes} question${reserve.pretes > 1 ? 's' : ''} prête${reserve.pretes > 1 ? 's' : ''} · alerte sous ${seuil} jour${seuil > 1 ? 's' : ''} · ses catégories, ce que la routine du matin y dépose, de quoi la remplir : Réserves et base`}
          ouvrir={versLesReserves}
        />
      </section>

      {/* Les questions que les joueurs proposent : elles rejoignent la réserve, une par jour au quiz. */}
      <QuestionsDuPublicAuQg />

      <QuestionsDuJour
        suivi={suivi}
        enPanne={suiviEnPanne}
        occupe={occupe}
        annuler={q => suivi && void annuler(suivi.jour, q.index)}
        retirer={q => suivi && void faire(() => api.admin.retirerDuJour(q.reserveId, suivi.jour, q.index), 'Retirée de la réserve')}
      />

      {/* Les signalements se relisent sur leur page, avec ceux de la campagne (le choix du 14 octobre 2026). */}
      <VersLesSignalements questions={etat.signalements.length} ouvrir={versLesSignalements} />

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

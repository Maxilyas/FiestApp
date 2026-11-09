import { useEffect, useId, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'
import { espacesFines, quand } from '../format'
import { showToast } from '../state'
import { CATEGORIES } from '../../../shared/categories'
import { MAX_ANECDOTE } from '../../../shared/library'
import {
  MOTIFS_DE_REFUS,
  MOTIF_DE_REFUS_MAX,
  QUESTION_DU_PUBLIC_MAX,
  REPONSE_DU_PUBLIC_MAX,
  dosageDe,
  type PropositionAuQg,
  type PropositionsAuQg,
  type QuestionEnFile,
  type QuestionProposee,
  type SalleDuBonus,
  type StatutDUneProposition,
} from '../../../shared/propositions'

/** Ce que le QG a fait d'une question relue, en un mot. */
const ISSUE: Record<StatutDUneProposition, string> = {
  'en-relecture': 'À relire',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  retiree: 'Retirée',
  posee: 'Jouée',
}

/**
 * Les questions que les joueurs proposent au quiz du jour
 * (`shared/propositions.ts`), sur la page du quiz du jour au QG : chacune en
 * carte, telle que le joueur l'a écrite et signée — puis l'accepter, retouchée
 * s'il le faut, sa catégorie et une anecdote données : elle rejoint la
 * réserve, signée, et passera au quiz du jour à son tour, une par jour ; ou la
 * refuser, d'un motif touché ou écrit, que le joueur lira sur son accueil.
 * Seule la première de chaque joueur attend ici (le choix du propriétaire du
 * 9 novembre 2026) : acceptée, les suivantes passent d'office. Dessous, la
 * file des acceptées — celles passées d'office closes, à lire s'il veut, à
 * retirer avant leur jour — et ce qui a été relu ce mois-ci.
 */
export function QuestionsDuPublicAuQg() {
  const [page, setPage] = useState<PropositionsAuQg | null>(null)
  const [enPanne, setEnPanne] = useState(false)
  const charger = () =>
    api.admin.propositionsDuJour().then(
      p => {
        setPage(p)
        setEnPanne(false)
      },
      () => setEnPanne(true),
    )
  useEffect(() => {
    void charger()
  }, [])

  if (enPanne) return <p className="error">Les questions du public ne se lisent pas : réessaie dans un instant.</p>
  if (!page) return null
  const { aRelire, enFile, relues } = page
  return (
    <section className="admin-groupe" aria-labelledby="questions-du-public-titre">
      <h2 className="compte-groupe" id="questions-du-public-titre">
        Les questions du public
      </h2>
      <p className="muted small">
        {espacesFines(
          [
            aRelire.length > 0 ? `${aRelire.length} à relire` : 'Rien à relire',
            enFile.length > 0 && `${enFile.length} dans la file, une par jour`,
          ]
            .filter(Boolean)
            .join(' · ') +
            '. Les joueurs les écrivent depuis la plume, au quiz du jour et au bout du défi. Tu ne relis que la première de chacun : acceptée, les suivantes passent d’office.',
        )}
      </p>
      {aRelire.map(p => (
        <CarteDUneProposition key={p.id} p={p} relue={charger} />
      ))}
      {enFile.length > 0 && <LaFile file={enFile} relue={charger} />}
      {relues.length > 0 && (
        <details className="signalement-relus">
          <summary className="muted small">{`${relues.length} relue${relues.length > 1 ? 's' : ''} ce mois-ci`}</summary>
          <ul className="qg-liste">
            {relues.map(p => (
              <li key={p.id} className="signalement-relu">
                <span className="qg-ligne-texte">
                  <span>
                    <span className="etiquette">{ISSUE[p.statut]}</span> {p.annulee && <span className="etiquette">annulée pour tous</span>}{' '}
                    {p.dOffice && <span className="etiquette">d’office</span>} {espacesFines(p.texte)}
                  </span>
                  <span className="muted small">
                    {espacesFines(
                      [p.auteur ? `${p.auteur.nom} @${p.auteur.login}` : 'Profil supprimé', p.relueLe !== undefined && `relue ${quand(p.relueLe)}`, p.motif && `« ${p.motif} »`]
                        .filter(Boolean)
                        .join(' · '),
                    )}
                  </span>
                  {/* Jouée en question bonus : ce que la salle en a fait — de quoi repérer qui écrit bien. */}
                  {p.salle && <SalleDUneQuestionDuPublic salle={p.salle} />}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/**
 * La file des acceptées, dans l'ordre où elles passeront — une par jour, en
 * question bonus. Celles passées d'office restent closes : leur auteur, leur
 * catégorie, quand ; « La lire » les ouvre, et la lire, c'est ne pas la jouer
 * le jour où elle passe (le serveur en fait son relecteur) — sans quoi chaque
 * question bonus à venir se lirait d'avance en passant sur la page. Chacune
 * se retire avant son jour, d'un motif que son auteur lira.
 */
function LaFile({ file, relue }: { file: QuestionEnFile[]; relue: () => Promise<void> }) {
  return (
    <div className="qg-file">
      <h3 className="label">La file, la prochaine en tête</h3>
      <ol className="qg-liste">
        {file.map(q => (
          <QuestionDeLaFile key={q.id} q={q} relue={relue} />
        ))}
      </ol>
    </div>
  )
}

/** Une question de la file : close ou lue, puis ses deux gestes — la lire, la retirer. */
function QuestionDeLaFile({ q, relue }: { q: QuestionEnFile; relue: () => Promise<void> }) {
  // Lue d'un « La lire », elle reste ouverte ici — même quand la console, sans profil, n'a rien pu en retenir.
  const [question, setQuestion] = useState<QuestionProposee | undefined>(q.question)
  const [retrait, setRetrait] = useState(false)
  const [motif, setMotif] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const lire = async () => {
    const ok = await confirmDialog({
      title: 'La lire maintenant ?',
      message: 'Tu en connaîtras la réponse : le jour où elle passera, la question bonus ne se jouera pas pour toi.',
      confirmLabel: 'La lire',
    })
    if (!ok) return
    setOccupe(true)
    setErreur('')
    try {
      setQuestion((await api.admin.lireLaQuestionEnFile(q.id)).question)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setOccupe(false)
    }
  }

  const retirer = async () => {
    setOccupe(true)
    setErreur('')
    try {
      await api.admin.retirerDeLaFile(q.id, motif)
      showToast({ kind: 'info', message: 'Retirée de la file : son auteur saura pourquoi' })
      await relue()
    } catch (e) {
      // Le refus du serveur — passée entre-temps au quiz du jour — se lit sous elle, le motif gardé.
      setErreur(motifDe(e))
      setOccupe(false)
    }
  }

  return (
    <li className="qg-file-question">
      <span className="qg-ligne-texte">
        <span>
          {q.categorie && <span className="etiquette">{q.categorie}</span>} {q.dOffice && <span className="etiquette">d’office</span>}{' '}
          {question ? espacesFines(question.texte) : <span className="muted">Pas encore lue</span>}
        </span>
        <span className="muted small">
          {espacesFines([q.auteur ? `${q.auteur.nom} @${q.auteur.login}` : 'Profil supprimé', `${q.dOffice ? 'passée d’office' : 'acceptée'} ${quand(q.accepteeLe)}`].join(' · '))}
        </span>
      </span>
      {question && <ReponsesDeLaQuestion question={question} />}
      {question?.anecdote && <p className="muted small">{espacesFines(`Le saviez-vous ? ${question.anecdote}`)}</p>}
      {retrait ? (
        <div className="qg-proposition-forme">
          <MotifAuJoueur motif={motif} onMotif={setMotif} />
          <div className="row">
            <button type="button" className="btn btn-danger" disabled={occupe || !motif.trim()} onClick={() => void retirer()}>
              Retirer de la file
            </button>
            <button type="button" className="btn btn-ghost" disabled={occupe} onClick={() => setRetrait(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-gestes">
          {!question && (
            <button type="button" className="salon-geste" disabled={occupe} onClick={() => void lire()}>
              <Icon name="eye" />
              La lire
            </button>
          )}
          <button type="button" className="salon-geste" disabled={occupe} onClick={() => setRetrait(true)}>
            <Icon name="x-circle" />
            Retirer…
          </button>
        </div>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </li>
  )
}

/** Ses quatre réponses, la bonne cochée — et dite au lecteur d'écran. */
function ReponsesDeLaQuestion({ question }: { question: Pick<QuestionProposee, 'reponses' | 'bonne'> }) {
  return (
    <ul className="signalement-reponses" aria-label="Les réponses">
      {question.reponses.map((r, i) => (
        <li key={i} className={i === question.bonne ? 'signalement-juste' : undefined}>
          {i === question.bonne && <Icon name="check" />}
          <span>{r}</span>
          {i === question.bonne && <span className="sr-only"> (la bonne réponse)</span>}
        </li>
      ))}
    </ul>
  )
}

/** Le motif d'un refus ou d'un retrait, que le joueur lira sur son accueil : ceux qui reviennent d'un toucher, un autre à la main. */
function MotifAuJoueur({ motif, onMotif }: { motif: string; onMotif: (m: string) => void }) {
  return (
    <>
      <span className="label">Pourquoi — le joueur le lira sur son accueil</span>
      <span className="qg-motifs" role="group" aria-label="Les motifs qui reviennent">
        {MOTIFS_DE_REFUS.map(m => (
          <button key={m} type="button" className={'pill-btn' + (motif === m ? ' active' : '')} aria-pressed={motif === m} onClick={() => onMotif(m)}>
            {m}
          </button>
        ))}
      </span>
      <input className="input" value={motif} maxLength={MOTIF_DE_REFUS_MAX} placeholder="Ou dis-le en une phrase" aria-label="Le motif" onChange={e => onMotif(e.target.value)} />
    </>
  )
}

/** Le dosage, en mots : ce que la nuit en a jugé, ou en jugera. */
const DOSAGE: Record<NonNullable<ReturnType<typeof dosageDe>>, string> = { bien: 'bien dosée', facile: 'trop facile', dure: 'trop dure' }

/**
 * Ce que la salle a fait d'une question du public jouée en question bonus :
 * combien l'ont jouée, la part qui l'a trouvée, son dosage et ses pouces —
 * des chiffres, sans un prénom.
 */
export function SalleDUneQuestionDuPublic({ salle }: { salle: SalleDuBonus }) {
  if (salle.joueurs === 0) return <span className="muted small">Personne ne l’a jouée</span>
  const dosage = dosageDe(salle.joueurs, salle.trouvees)
  return (
    <span className="small">
      {espacesFines(
        [
          `jouée par ${salle.joueurs}`,
          `trouvée par ${Math.round((100 * salle.trouvees) / salle.joueurs)} %`,
          dosage && DOSAGE[dosage],
          salle.pour + salle.contre > 0 && `👍 ${salle.pour} · 👎 ${salle.contre}`,
        ]
          .filter(Boolean)
          .join(' · '),
      )}
    </span>
  )
}

/**
 * Une question proposée : qui l'a écrite, et quand ; l'intitulé, ses réponses,
 * la bonne cochée ; puis ses deux gestes, dépliés sur place.
 */
function CarteDUneProposition({ p, relue }: { p: PropositionAuQg; relue: () => Promise<void> }) {
  const id = useId()
  const [geste, setGeste] = useState<'accepter' | 'refuser' | null>(null)
  const [texte, setTexte] = useState(p.texte)
  const [reponses, setReponses] = useState(p.reponses)
  const [bonne, setBonne] = useState(p.bonne)
  // Celle que le joueur a choisie, s'il en a choisi une (depuis le 9 novembre 2026) : l'accepter la garde, ou la change.
  const [categorie, setCategorie] = useState(p.categorie ?? '')
  // Celle du joueur d'abord, s'il en a écrit une : l'accepter la garde, la retouche ou l'efface.
  const [anecdote, setAnecdote] = useState(p.anecdote ?? '')
  const [motif, setMotif] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const faire = async (appel: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    setErreur('')
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await relue()
    } catch (e) {
      // Le refus du serveur — une réserve qui l'a déjà, une catégorie oubliée — se lit sur sa carte, qui reste ouverte.
      setErreur(motifDe(e))
      setOccupe(false)
    }
  }

  return (
    <article className="qg-carte signalement-carte" aria-label={`Question du public : « ${p.texte} »`}>
      <div className="signalement-tete">
        <span className="etiquette signalement-mode">
          <Icon name="edit" />
          Question du public
        </span>
        {/* La catégorie que le joueur a choisie, s'il en a choisi une : « Accepter » la reprend. */}
        {p.categorie && <span className="etiquette">{p.categorie}</span>}
        <span className="signalement-qui small">
          {p.auteur ? (
            <>
              <b>{p.auteur.nom}</b> <span className="muted">@{p.auteur.login}</span>
            </>
          ) : (
            'Profil supprimé'
          )}
          {` · ${quand(p.proposeeLe)}`}
        </span>
      </div>
      <p className="signalement-question">{espacesFines(p.texte)}</p>
      <ReponsesDeLaQuestion question={p} />
      {/* Son anecdote, sous ses réponses ; « Accepter » déplié, son champ la reprend. */}
      {p.anecdote && geste !== 'accepter' && <p className="muted small">{espacesFines(`Le saviez-vous ? ${p.anecdote}`)}</p>}
      {geste === 'accepter' ? (
        <div className="qg-proposition-forme">
          <label className="label" htmlFor={`${id}-texte`}>
            L’intitulé
          </label>
          <textarea id={`${id}-texte`} className="input" rows={3} maxLength={QUESTION_DU_PUBLIC_MAX} value={texte} onChange={e => setTexte(e.target.value)} />
          <span className="label">Les réponses — la bonne cochée</span>
          {reponses.map((r, i) => (
            <span key={i} className="qg-proposition-reponse">
              <input type="radio" name={`${id}-bonne`} checked={bonne === i} onChange={() => setBonne(i)} aria-label={`La réponse ${i + 1} est la bonne`} />
              <input
                className="input"
                value={r}
                maxLength={REPONSE_DU_PUBLIC_MAX}
                aria-label={`Réponse ${i + 1}`}
                onChange={e => setReponses(rs => rs.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </span>
          ))}
          <label className="label" htmlFor={`${id}-categorie`}>
            Sa catégorie
          </label>
          <select id={`${id}-categorie`} className="input" value={categorie} onChange={e => setCategorie(e.target.value)}>
            <option value="">Choisis…</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="label" htmlFor={`${id}-anecdote`}>
            Le saviez-vous ? <span className="muted">(facultatif)</span>
          </label>
          <textarea id={`${id}-anecdote`} className="input" rows={2} maxLength={MAX_ANECDOTE} value={anecdote} onChange={e => setAnecdote(e.target.value)} />
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={occupe || !categorie}
              onClick={() => void faire(() => api.admin.accepterLaProposition(p.id, { texte, reponses, bonne, categorie, anecdote }), 'Acceptée : elle passera au quiz du jour, signée')}
            >
              Ajouter au quiz du jour
            </button>
            <button type="button" className="btn btn-ghost" disabled={occupe} onClick={() => setGeste(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : geste === 'refuser' ? (
        <div className="qg-proposition-forme">
          <MotifAuJoueur motif={motif} onMotif={setMotif} />
          <div className="row">
            <button type="button" className="btn btn-danger" disabled={occupe || !motif.trim()} onClick={() => void faire(() => api.admin.refuserLaProposition(p.id, motif), 'Refusée : le joueur saura pourquoi')}>
              Refuser
            </button>
            <button type="button" className="btn btn-ghost" disabled={occupe} onClick={() => setGeste(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-gestes">
          <button type="button" className="salon-geste admin-geste-oui" onClick={() => setGeste('accepter')}>
            <Icon name="check-circle" />
            Accepter
          </button>
          <button type="button" className="salon-geste" onClick={() => setGeste('refuser')}>
            <Icon name="x-circle" />
            Refuser
          </button>
        </div>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </article>
  )
}

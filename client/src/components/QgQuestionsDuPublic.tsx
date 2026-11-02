import { useEffect, useId, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { espacesFines, quand } from '../format'
import { showToast } from '../state'
import { CATEGORIES } from '../../../shared/categories'
import { MAX_ANECDOTE } from '../../../shared/library'
import {
  MOTIFS_DE_REFUS,
  MOTIF_DE_REFUS_MAX,
  QUESTION_DU_PUBLIC_MAX,
  REPONSE_DU_PUBLIC_MAX,
  type PropositionAuQg,
  type PropositionsAuQg,
  type StatutDUneProposition,
} from '../../../shared/propositions'

/** Ce que le QG a fait d'une question relue, en un mot. */
const ISSUE: Record<StatutDUneProposition, string> = {
  'en-relecture': 'À relire',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  posee: 'Jouée',
}

/**
 * Les questions que les joueurs proposent au quiz du jour
 * (`shared/propositions.ts`), sur la page du quiz du jour au QG : chacune en
 * carte, telle que le joueur l'a écrite et signée — puis l'accepter, retouchée
 * s'il le faut, sa catégorie et une anecdote données : elle rejoint la
 * réserve, signée, et passera au quiz du jour à son tour, une par jour ; ou la
 * refuser, d'un motif touché ou écrit, que le joueur lira sur son accueil.
 * Dessous, la file des acceptées et ce qui a été relu ce mois-ci.
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
  const { aRelire, relues, enAttente } = page
  return (
    <section className="admin-groupe" aria-labelledby="questions-du-public-titre">
      <h2 className="compte-groupe" id="questions-du-public-titre">
        Les questions du public
      </h2>
      <p className="muted small">
        {espacesFines(
          [
            aRelire.length > 0 ? `${aRelire.length} à relire` : 'Rien à relire',
            enAttente > 0 && `${enAttente} acceptée${enAttente > 1 ? 's' : ''} en attente de leur jour, une par jour`,
          ]
            .filter(Boolean)
            .join(' · ') + '. Les joueurs les écrivent depuis la plume, au quiz du jour et au bout du défi.',
        )}
      </p>
      {aRelire.map(p => (
        <CarteDUneProposition key={p.id} p={p} relue={charger} />
      ))}
      {relues.length > 0 && (
        <details className="signalement-relus">
          <summary className="muted small">{`${relues.length} relue${relues.length > 1 ? 's' : ''} ce mois-ci`}</summary>
          <ul className="qg-liste">
            {relues.map(p => (
              <li key={p.id} className="signalement-relu">
                <span className="qg-ligne-texte">
                  <span>
                    <span className="etiquette">{ISSUE[p.statut]}</span> {espacesFines(p.texte)}
                  </span>
                  <span className="muted small">
                    {espacesFines(
                      [p.auteur ? `${p.auteur.nom} @${p.auteur.login}` : 'Profil supprimé', p.relueLe !== undefined && `relue ${quand(p.relueLe)}`, p.motif && `« ${p.motif} »`]
                        .filter(Boolean)
                        .join(' · '),
                    )}
                  </span>
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
 * Une question proposée : qui l'a écrite, et quand ; l'intitulé, ses réponses,
 * la bonne cochée ; puis ses deux gestes, dépliés sur place.
 */
function CarteDUneProposition({ p, relue }: { p: PropositionAuQg; relue: () => Promise<void> }) {
  const id = useId()
  const [geste, setGeste] = useState<'accepter' | 'refuser' | null>(null)
  const [texte, setTexte] = useState(p.texte)
  const [reponses, setReponses] = useState(p.reponses)
  const [bonne, setBonne] = useState(p.bonne)
  const [categorie, setCategorie] = useState('')
  const [anecdote, setAnecdote] = useState('')
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
      <ul className="signalement-reponses" aria-label="Les réponses">
        {p.reponses.map((r, i) => (
          <li key={i} className={i === p.bonne ? 'signalement-juste' : undefined}>
            {i === p.bonne && <Icon name="check" />}
            <span>{r}</span>
            {i === p.bonne && <span className="sr-only"> (la bonne réponse)</span>}
          </li>
        ))}
      </ul>
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
          <span className="label">Pourquoi — le joueur le lira sur son accueil</span>
          <span className="qg-motifs" role="group" aria-label="Les motifs qui reviennent">
            {MOTIFS_DE_REFUS.map(m => (
              <button key={m} type="button" className={'pill-btn' + (motif === m ? ' active' : '')} aria-pressed={motif === m} onClick={() => setMotif(m)}>
                {m}
              </button>
            ))}
          </span>
          <input className="input" value={motif} maxLength={MOTIF_DE_REFUS_MAX} placeholder="Ou dis-le en une phrase" aria-label="Le motif" onChange={e => setMotif(e.target.value)} />
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

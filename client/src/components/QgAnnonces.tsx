import { useEffect, useState } from 'react'
import { ApiError, api, motifDe } from '../api'
import { ChampNombre } from './ChampNombre'
import { CarteDeLAdministrateur } from './CarteDeLAdministrateur'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { quandEcrit } from '../../../shared/qg'
import { ANNONCE_MS, CONFETTIS_PAR_DON_MAX } from '../../../shared/profil'
import {
  ANNONCE_MAX,
  CHOIX_LONGUEUR_MAX,
  CHOIX_MAX,
  CHOIX_MIN,
  messageNet,
  type AnnonceAuQg,
  type PageDesAnnonces,
  type QuestionAuQg,
  type QuestionDAnnonce,
  type SorteDeQuestion,
} from '../../../shared/annonces'

/**
 * L'identifiant d'un envoi, tiré par la page : le même tant que l'annonce
 * n'est pas partie — un second toucher, la réponse perdue en route, est
 * reconnu par le serveur au lieu d'offrir deux fois à tous. Sans
 * `crypto.randomUUID`, absent d'une page servie en http (`remise.ts`).
 */
const tirerUnEnvoi = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

/** « 128 profils », « 1 profil », « aucun profil ». */
const deProfils = (n: number) => (n === 0 ? 'aucun profil' : `${formatNumber(n)} profil${n > 1 ? 's' : ''}`)
const nConfettis = (n: number) => `${formatNumber(n)} confetti${n > 1 ? 's' : ''}`

const NOMS_DES_SORTES: Record<SorteDeQuestion | 'aucune', string> = { aucune: 'Aucune', vote: 'Un vote', note: 'Une note', mot: 'Un mot libre' }

/** « 12 réponses », « 1 réponse », « aucune réponse ». */
const deReponses = (n: number) => (n === 0 ? 'aucune réponse' : `${formatNumber(n)} réponse${n > 1 ? 's' : ''}`)

/** Ce qu'une question a récolté : un compte par choix en barres, la moyenne d'une note, les mots libres avec leur auteur. */
function ResultatsDeLaQuestion({ question: q }: { question: QuestionAuQg }) {
  const r = q.resultats
  const plus = Math.max(1, ...r.comptes)
  const libelles = q.sorte === 'vote' ? q.choix : r.comptes.map((_, i) => `${i + 1}`)
  return (
    <div className="annonce-resultats">
      <span className="muted small">
        {[deReponses(r.reponses), q.fermeeLe !== null ? 'close' : 'ouverte', q.recompense > 0 ? `${nConfettis(q.recompense)} par réponse` : null].filter(Boolean).join(' · ')}
      </span>
      {q.sorte !== 'mot' && (
        <ul className="annonce-barres">
          {r.comptes.map((n, i) => (
            <li key={i}>
              <span className="annonce-barre-nom">{espacesFines(libelles[i])}</span>
              <span className="annonce-barre" aria-hidden="true">
                <span style={{ width: `${(n / plus) * 100}%` }} />
              </span>
              <span className="num annonce-barre-n">{formatNumber(n)}</span>
            </li>
          ))}
        </ul>
      )}
      {r.moyenne !== null && <b>{espacesFines(`Moyenne : ${r.moyenne.toFixed(1).replace('.', ',')} sur 5`)}</b>}
      {q.sorte === 'mot' && r.mots.length > 0 && (
        <ul className="annonce-mots">
          {r.mots.map((m, i) => (
            <li key={i}>
              <span>{espacesFines(`« ${m.texte} »`)}</span>
              <span className="muted small">{`${m.prenom} · ${quandEcrit(m.le, Date.now())}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Les annonces à tous au QG (`/admin#annonces`, sous « Animer ») — le souhait
 * du propriétaire du 19 octobre 2026, le soir où le quiz du jour et les défis
 * s'étaient rouverts : « une annonce pour dire que l'incident est résolu, et
 * envoyer des confettis à tous pour le dédommagement ». Un message que chaque
 * profil lit une fois, en haut de son accueil, montré ici tel qu'il le lira,
 * et des confettis pour chacun si on veut ; puis les annonces faites, et
 * « Retirer » tant qu'elles se montrent. Chaque geste va au journal.
 */
export function QgAnnonces() {
  const [page, setPage] = useState<PageDesAnnonces | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confettis, setConfettis] = useState(0)
  const [envoi, setEnvoi] = useState(tirerUnEnvoi)
  const [sorte, setSorte] = useState<SorteDeQuestion | 'aucune'>('aucune')
  const [choix, setChoix] = useState<string[]>(['', ''])
  const [recompense, setRecompense] = useState(0)
  const [occupe, setOccupe] = useState<string | null>(null)

  const relire = () =>
    api.admin.annonces().then(
      p => {
        setPage(p)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  useEffect(() => {
    void relire()
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>

  const ecrit = messageNet(message)
  const longueur = Array.from(ecrit).length
  const pour = deProfils(page.profils)
  /** Le formulaire repart à zéro, l'annonce partie : le prochain envoi est un autre. */
  const repartir = () => {
    setMessage('')
    setConfettis(0)
    setSorte('aucune')
    setChoix(['', ''])
    setRecompense(0)
    setEnvoi(tirerUnEnvoi())
  }

  /** La question telle qu'elle partira : un vote sans ses choix vides — le serveur refuse ce qui reste trop court. */
  const question: QuestionDAnnonce | undefined =
    sorte === 'aucune' ? undefined : { sorte, choix: sorte === 'vote' ? choix.map(messageNet).filter(Boolean) : [], recompense }

  const annoncer = async () => {
    if (!ecrit || occupe) return
    const ok = await confirmDialog({
      title: `Annoncer à ${pour} ?`,
      message: espacesFines(
        confettis > 0
          ? `Chacun la lira une fois, en haut de son accueil, avec ${nConfettis(confettis)} — ${nConfettis(confettis * page.profils)} en tout. Un don ne se reprend pas : retirer l’annonce les laissera à chacun.`
          : 'Chacun la lira une fois, en haut de son accueil.',
      ),
      confirmLabel: confettis > 0 ? `Annoncer et offrir ${nConfettis(confettis)}` : 'Annoncer',
    })
    if (!ok) return
    setOccupe('annoncer')
    try {
      setPage(await api.admin.annoncer(envoi, ecrit, confettis, question))
      repartir()
      showToast({ kind: 'info', message: `Annonce envoyée à ${pour}` })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      // Déjà partie : la réponse d'avant s'était perdue en route. La liste la montre.
      if (e instanceof ApiError && e.statut === 409) {
        repartir()
        void relire()
      }
    } finally {
      setOccupe(null)
    }
  }

  const clore = async (a: AnnonceAuQg) => {
    if (occupe) return
    const ok = await confirmDialog({
      title: 'Clore cette question ?',
      message: espacesFines('Les joueurs ne la verront plus. Les réponses reçues et les confettis donnés restent.'),
      confirmLabel: 'Clore la question',
    })
    if (!ok) return
    setOccupe(a.id)
    try {
      setPage(await api.admin.cloreLaQuestion(a.id))
      showToast({ kind: 'info', message: 'Question close' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }

  const retirer = async (a: AnnonceAuQg) => {
    if (occupe) return
    const ok = await confirmDialog({
      title: 'Retirer cette annonce ?',
      message: espacesFines(
        `Ceux qui ne l’ont pas encore lue ne la verront pas.${a.confettis > 0 ? ' Ses confettis restent à chacun : un don ne se reprend pas.' : ''}`,
      ),
      confirmLabel: 'Retirer',
    })
    if (!ok) return
    setOccupe(a.id)
    try {
      setPage(await api.admin.retirerLAnnonce(a.id))
      showToast({ kind: 'info', message: 'Annonce retirée' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Un message pour tous les profils — une panne réglée, une nouveauté, un cadeau —, que chacun lit une fois, en haut de son accueil. Le bandeau rouge, lui, prévient pendant la panne et se retire avec elle.',
        )}
      </p>

      <section className="qg-carte" aria-labelledby="annonces-nouvelle">
        <div className="qg-carte-tete">
          <h2 id="annonces-nouvelle">Une annonce</h2>
        </div>
        {/* Telle que les joueurs la liront, à mesure qu'on l'écrit. */}
        <ul className={'annonces-admin annonce-apercu' + (ecrit ? '' : ' annonce-apercu-vide')} aria-hidden="true">
          <CarteDeLAdministrateur annonce={{ id: 'apercu', sorte: 'annonce', message: ecrit || 'Ce que tu écris ici', confettis, le: 0, ...(question && { question }) }} prenom="" />
        </ul>
        <label className="label" htmlFor="annonce-message">
          Ce qu’elle dit
        </label>
        <textarea
          id="annonce-message"
          className="input"
          rows={3}
          maxLength={ANNONCE_MAX}
          value={message}
          placeholder="Le quiz du jour et le défi remarchent. Merci de votre patience !"
          onChange={e => setMessage(e.target.value)}
        />
        <p className="muted small maintenance-compte">
          {longueur} / {ANNONCE_MAX}
        </p>
        <label className="label" htmlFor="annonce-confettis">
          Des confettis pour chacun ? De 0 à {CONFETTIS_PAR_DON_MAX}
        </label>
        <ChampNombre id="annonce-confettis" valeur={confettis} min={0} max={CONFETTIS_PAR_DON_MAX} onValeur={setConfettis} inputMode="numeric" />
        <p className="muted small">
          {espacesFines(
            `Pour les ${pour} d’aujourd’hui${confettis > 0 ? `, soit ${nConfettis(confettis * page.profils)} en tout` : ''}. Ni les invités sans profil, ni ceux qui en créeront un ensuite ne la liront.`,
          )}
        </p>
        <fieldset className="annonce-question-form">
          <legend className="label">Une question aux joueurs ?</legend>
          <div className="annonce-sortes" role="radiogroup" aria-label="Sorte de question">
            {(Object.keys(NOMS_DES_SORTES) as (SorteDeQuestion | 'aucune')[]).map(k => (
              <button key={k} type="button" role="radio" aria-checked={sorte === k} className={'annonce-sorte' + (sorte === k ? ' actif' : '')} onClick={() => setSorte(k)}>
                {NOMS_DES_SORTES[k]}
              </button>
            ))}
          </div>
          {sorte === 'vote' && (
            <div className="annonce-choix-form">
              {choix.map((c, i) => (
                <div key={i} className="annonce-choix-ligne">
                  <input
                    className="input"
                    value={c}
                    maxLength={CHOIX_LONGUEUR_MAX}
                    aria-label={`Choix ${i + 1}`}
                    placeholder={`Choix ${i + 1}`}
                    onChange={e => setChoix(l => l.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {choix.length > CHOIX_MIN && (
                    <button type="button" className="salon-geste" aria-label={`Retirer le choix ${i + 1}`} onClick={() => setChoix(l => l.filter((_, j) => j !== i))}>
                      <Icon name="x" />
                    </button>
                  )}
                </div>
              ))}
              {choix.length < CHOIX_MAX && (
                <button type="button" className="salon-geste" onClick={() => setChoix(l => [...l, ''])}>
                  Ajouter un choix
                </button>
              )}
            </div>
          )}
          {sorte === 'note' && <p className="muted small">Chacun donne une note de 1 à 5 ; tu lis la moyenne et le détail.</p>}
          {sorte === 'mot' && <p className="muted small">Chacun écrit quelques mots (200 caractères) ; tu les lis avec le prénom de qui les a écrits.</p>}
          {sorte !== 'aucune' && (
            <>
              <label className="label" htmlFor="annonce-recompense">
                Des confettis pour avoir répondu ? De 0 à {CONFETTIS_PAR_DON_MAX}
              </label>
              <ChampNombre id="annonce-recompense" valeur={recompense} min={0} max={CONFETTIS_PAR_DON_MAX} onValeur={setRecompense} inputMode="numeric" />
              <p className="muted small">
                {espacesFines(
                  recompense > 0
                    ? `Donnés à chaque profil qui répond, une fois — au plus ${nConfettis(recompense * page.profils)} si les ${pour} répondent. Un don ne se reprend pas.`
                    : 'Répondre ne rapporte rien.',
                )}
              </p>
            </>
          )}
        </fieldset>
        <div className="admin-gestes maintenance-gestes">
          <button type="button" className="salon-geste admin-geste-oui" aria-disabled={!ecrit || occupe !== null || undefined} onClick={() => void annoncer()}>
            <Icon name="megaphone" />
            {occupe === 'annoncer' ? '…' : confettis > 0 ? `Annoncer et offrir ${nConfettis(confettis)}` : 'Annoncer à tous'}
          </button>
        </div>
      </section>

      {page.annonces.length > 0 && (
        <section className="qg-carte" aria-labelledby="annonces-faites">
          <div className="qg-carte-tete">
            <h2 id="annonces-faites">Les annonces faites</h2>
            <span className="etiquette num">{page.annonces.length}</span>
          </div>
          <ul className="qg-liste maintenance-gestes">
            {page.annonces.map(a => {
              // Un mois passé, l'accueil ne la dit plus (`ANNONCE_MS`) : rien à retirer.
              const visible = a.retireeLe === null && page.maintenant - a.le < ANNONCE_MS
              return (
                <li key={a.id} className={'annonce-faite' + (visible ? '' : ' annonce-faite-tue')}>
                  <span className="annonce-faite-texte">
                    <b>{espacesFines(a.message)}</b>
                    <span className="muted small">
                      {[a.confettis > 0 ? `${nConfettis(a.confettis)} à ${deProfils(a.destinataires)}` : `Pour ${deProfils(a.destinataires)}`, quandEcrit(a.le, page.maintenant)].join(' · ')}
                    </span>
                    {a.question && <ResultatsDeLaQuestion question={a.question} />}
                    {a.retireeLe !== null && <span className="annonce-faite-etat">{`Retirée ${quandEcrit(a.retireeLe, page.maintenant)}`}</span>}
                    {a.retireeLe === null && !visible && <span className="muted small">Ne se montre plus : un mois a passé</span>}
                  </span>
                  {visible && (
                    <span className="annonce-faite-gestes">
                      {a.question && a.question.fermeeLe === null && (
                        <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void clore(a)}>
                          <Icon name="check" />
                          {occupe === a.id ? '…' : 'Clore la question'}
                        </button>
                      )}
                      <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void retirer(a)}>
                        <Icon name="x" />
                        {occupe === a.id ? '…' : 'Retirer'}
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

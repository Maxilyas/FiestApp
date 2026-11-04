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
import { SEGMENTS, type ComptesDesSegments } from '../../../shared/qgJoueurs'
import {
  SEGMENTS_DES_ANIMATEURS,
  auxProfilsDe,
  estUnSegmentDesAnimateurs,
  nomDuSegmentDesAnnonces,
  regleDuSegmentDesAnnonces,
  type ComptesDesAnimateurs,
  type SegmentDesAnnonces,
} from '../../../shared/qgAnimateurs'
import { JOURS_DE_L_EFFET_D_UNE_ANNONCE, partEcrite, type EffetDUneAnnonce, type EffetsDesAnnonces } from '../../../shared/qgEffets'
import { oublierLesReperes } from '../qgReperes'
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
 * Ce qu'une annonce a changé (la revue du 4 novembre 2026, P2.1) : ses destinataires qui ont rejoué dans les sept jours
 * qui suivent son jour, face à l'habitude de la même audience une semaine plus tôt ; et, si elle pose une question, qui y
 * a répondu. Des comptes, jamais un pourcentage, jamais un nom ; la lecture d'une annonce ne se sait pas — le téléphone
 * la retient seul —, le retour au jeu en tient lieu.
 */
function EffetDeLAnnonce({ annonce: a, effet }: { annonce: AnnonceAuQg; effet: EffetDUneAnnonce | undefined }) {
  const lignes: string[] = []
  if (effet) {
    const habitude = effet.habitude && effet.habitude.sur > 0 ? effet.habitude : null
    const jours = (n: number) => `${formatNumber(n)} jour${n > 1 ? 's' : ''}`
    if (effet.jours === 0) {
      lignes.push(
        `Ce qu’elle change se lira jour après jour, sur les ${JOURS_DE_L_EFFET_D_UNE_ANNONCE} qui suivent son jour${habitude ? ` — d’habitude, ${partEcrite(habitude)} rejouent en une semaine` : ''}.`,
      )
    } else if (effet.apres === null) {
      lignes.push('La mémoire du QG ne remonte pas jusqu’à elle : ce qu’elle a changé ne se lit pas.')
    } else {
      const en = effet.jours < JOURS_DE_L_EFFET_D_UNE_ANNONCE
      lignes.push(
        `${en ? `En cours, ${jours(effet.jours)} sur ${JOURS_DE_L_EFFET_D_UNE_ANNONCE} : ${partEcrite(effet.apres)} ont rejoué` : `Ont rejoué dans les ${JOURS_DE_L_EFFET_D_UNE_ANNONCE} jours : ${partEcrite(effet.apres)}`}${
          habitude ? ` — d’habitude, ${partEcrite(habitude)}${en ? ` en ${jours(effet.joursDeLHabitude)}` : ''}` : ''
        }`,
      )
    }
  }
  if (a.question) lignes.push(`Ont répondu à sa question : ${partEcrite({ n: a.question.resultats.reponses, sur: a.destinataires })}`)
  if (lignes.length === 0) return null
  return (
    <span className="qg-effet">
      {lignes.map(l => (
        <span key={l} className="qg-effet-ligne">
          <Icon name="bar-chart" />
          {espacesFines(l)}
        </span>
      ))}
    </span>
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
 *
 * Depuis le 4 novembre 2026 (le lot 6 du QG 2), à tous d'office ou aux seuls
 * profils d'un segment de la page des joueurs — les nouveaux, les endormis… —,
 * chacun compté avant d'écrire ; « Leur écrire », sur la page des joueurs,
 * l'ouvre sur le sien (`segment`). Le même jour, aux animateurs aussi — les
 * titulaires des salons ouverts, tous ou ceux d'un état du carnet —, que
 * « Leur écrire », sur la page des animateurs, ouvre de même.
 */
export function QgAnnonces({ segment: depart = null }: { segment?: SegmentDesAnnonces | null } = {}) {
  const [page, setPage] = useState<PageDesAnnonces | null>(null)
  /** À qui elle part : null, tous les profils ; sinon un segment des joueurs ou des animateurs, ses membres comptés à l'envoi. */
  const [pourQui, setPourQui] = useState<SegmentDesAnnonces | null>(depart)
  /** Combien chaque segment compte de profils ; null tant qu'ils ne sont pas lus, ou s'ils ne se lisent pas. */
  const [comptes, setComptes] = useState<ComptesDesSegments | null>(null)
  /** Combien chaque segment des animateurs toucherait de titulaires, lu à part : le carnet a ses propres lectures. */
  const [animateurs, setAnimateurs] = useState<ComptesDesAnimateurs | null>(null)
  /** Ce que chaque annonce a changé, lu au serveur une fois par jour ; null tant qu'il n'est pas lu — les lignes se taisent. */
  const [effets, setEffets] = useState<EffetsDesAnnonces | null>(null)
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
  const relireLesComptes = () => {
    void api.admin.segmentsDesJoueurs().then(setComptes, () => setComptes(null))
    void api.admin.segmentsDesAnimateurs().then(setAnimateurs, () => setAnimateurs(null))
  }
  const relireLesEffets = () => api.admin.effetsDesAnnonces().then(setEffets, () => setEffets(null))
  useEffect(() => {
    void relire()
    // À côté, sans faire attendre la page : la mémoire du QG peut avoir un jour à rattraper.
    relireLesComptes()
    void relireLesEffets()
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>

  const ecrit = messageNet(message)
  const longueur = Array.from(ecrit).length
  /** Ce qu'un segment compte : ses profils, ou les titulaires de ses salons — inconnus tant que les comptes ne sont pas lus. */
  const compteDe = (s: SegmentDesAnnonces): number | undefined => (estUnSegmentDesAnimateurs(s) ? animateurs?.comptes[s] : comptes?.comptes[s])
  /** Les profils qu'elle toucherait : tous ceux d'aujourd'hui, ou ceux du segment. */
  const touches = pourQui === null ? page.profils : (compteDe(pourQui) ?? null)
  const pour = touches === null ? 'les profils de ce segment' : deProfils(touches)
  /** « Annoncer à 128 profils », « Annoncer aux endormis », « aux animateurs en retard » : à qui, dans le bouton et la confirmation. */
  const aQui = pourQui === null ? `à ${pour}` : auxProfilsDe(pourQui)
  /** Le formulaire repart à zéro, l'annonce partie : le prochain envoi est un autre. */
  const repartir = () => {
    setMessage('')
    setConfettis(0)
    setSorte('aucune')
    setChoix(['', ''])
    setRecompense(0)
    setPourQui(null)
    setEnvoi(tirerUnEnvoi())
  }

  /** La question telle qu'elle partira : un vote sans ses choix vides — le serveur refuse ce qui reste trop court. */
  const question: QuestionDAnnonce | undefined =
    sorte === 'aucune' ? undefined : { sorte, choix: sorte === 'vote' ? choix.map(messageNet).filter(Boolean) : [], recompense }

  const annoncer = async () => {
    if (!ecrit || occupe || touches === 0) return
    const ok = await confirmDialog({
      title: pourQui === null ? `Annoncer à ${pour} ?` : `Annoncer ${aQui}${touches === null ? '' : ` (${pour})`} ?`,
      message: espacesFines(
        [
          pourQui !== null &&
            `Ses destinataires se comptent à l’envoi : ceux qui suivent la règle à cet instant — ${regleDuSegmentDesAnnonces(pourQui).toLowerCase()}. Elle ne leur dit pas pourquoi eux.`,
          confettis > 0
            ? `Chacun la lira une fois, en haut de son accueil, avec ${nConfettis(confettis)}${touches === null ? '' : ` — ${nConfettis(confettis * touches)} en tout`}. Un don ne se reprend pas : retirer l’annonce les laissera à chacun.`
            : 'Chacun la lira une fois, en haut de son accueil.',
        ]
          .filter(Boolean)
          .join(' '),
      ),
      confirmLabel: confettis > 0 ? `Annoncer et offrir ${nConfettis(confettis)}` : 'Annoncer',
    })
    if (!ok) return
    setOccupe('annoncer')
    try {
      setPage(await api.admin.annoncer(envoi, ecrit, confettis, question, pourQui))
      repartir()
      showToast({ kind: 'info', message: `Annonce envoyée ${aQui}` })
      relireLesComptes()
      void relireLesEffets()
      // Elle se pose sur les courbes du QG : la suivante relit leurs repères.
      oublierLesReperes()
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
          'Un message pour tous les profils, ou pour un segment de la page des joueurs — une panne réglée, une nouveauté, un cadeau, un « tu nous manques » —, que chacun lit une fois, en haut de son accueil. Le bandeau rouge, lui, prévient pendant la panne et se retire avec elle.',
        )}
      </p>

      <section className="qg-carte" aria-labelledby="annonces-nouvelle">
        <div className="qg-carte-tete">
          <h2 id="annonces-nouvelle">Une annonce</h2>
        </div>
        {/* Telle que les joueurs la liront, à mesure qu'on l'écrit. */}
        <ul className={'annonces-admin annonce-apercu' + (ecrit ? '' : ' annonce-apercu-vide')} aria-hidden="true">
          <CarteDeLAdministrateur
            annonce={{ id: 'apercu', sorte: 'annonce', message: ecrit || 'Ce que tu écris ici', confettis, le: 0, ...(question && { question }), ...(pourQui !== null && { aQuelquesUns: true as const }) }}
            prenom=""
          />
        </ul>
        {/* À qui : tous d'office, ou un segment de la page des joueurs — chacun son compte, sa règle dessous. */}
        <fieldset className="annonce-question-form">
          <legend className="label">À qui ?</legend>
          {/* Tous et les segments des joueurs, puis les animateurs — les titulaires des salons —, tous ou d'un état du carnet. */}
          <div className="annonce-sortes" role="radiogroup" aria-label="À qui l’annonce part">
            {([null, ...SEGMENTS, ...SEGMENTS_DES_ANIMATEURS] as (SegmentDesAnnonces | null)[]).map(s => {
              const n = s === null ? page.profils : compteDe(s)
              return (
                <button key={s ?? 'tous'} type="button" role="radio" aria-checked={pourQui === s} className={'annonce-sorte' + (pourQui === s ? ' actif' : '')} onClick={() => setPourQui(s)}>
                  {s === null ? 'Tous' : nomDuSegmentDesAnnonces(s)}
                  {n !== undefined && <span className="rayon-compte">{formatNumber(n)}</span>}
                </button>
              )
            })}
          </div>
          <p className="muted small">
            {espacesFines(
              pourQui === null
                ? 'Tous les profils d’aujourd’hui, sans les suspendus.'
                : `${regleDuSegmentDesAnnonces(pourQui)} — ${
                    estUnSegmentDesAnimateurs(pourQui) ? 'la règle du carnet des animateurs : leurs titulaires, sans les salons détachés ni les profils suspendus' : 'la règle de la page des joueurs, sans les suspendus'
                  }. L’annonce ne dit pas le segment à qui la lit : « Pour toi », sur son accueil.`,
            )}
          </p>
        </fieldset>
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
            `Pour ${touches === null ? pour : `les ${pour}`} d’aujourd’hui${confettis > 0 && touches !== null ? `, soit ${nConfettis(confettis * touches)} en tout` : ''}. Ni les invités sans profil, ni ceux qui en créeront un ensuite ne la liront.`,
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
                    ? `Donnés à chaque profil qui répond, une fois — au plus ${nConfettis(recompense * (touches ?? page.profils))} si ${touches === null ? 'tous' : `les ${pour}`} répondent. Un don ne se reprend pas.`
                    : 'Répondre ne rapporte rien.',
                )}
              </p>
            </>
          )}
        </fieldset>
        <div className="admin-gestes maintenance-gestes">
          <button type="button" className="salon-geste admin-geste-oui" aria-disabled={!ecrit || occupe !== null || touches === 0 || undefined} onClick={() => void annoncer()}>
            <Icon name="megaphone" />
            {occupe === 'annoncer' ? '…' : confettis > 0 ? `Annoncer et offrir ${nConfettis(confettis)}` : pourQui === null ? 'Annoncer à tous' : `Annoncer ${aQui}`}
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
                      {[
                        a.confettis > 0 ? `${nConfettis(a.confettis)} à ${deProfils(a.destinataires)}` : `Pour ${deProfils(a.destinataires)}`,
                        a.segment && nomDuSegmentDesAnnonces(a.segment),
                        quandEcrit(a.le, page.maintenant),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <EffetDeLAnnonce annonce={a} effet={effets?.effets[a.id]} />
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

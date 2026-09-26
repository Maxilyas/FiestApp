import { useCallback, useEffect, useRef, useState } from 'react'
import { api, motifDe, UnauthorizedError, type CorrectionDuJour } from '../api'
import { serverNow } from '../clock'
import { espacesFines, formatNumber, place, pourcent, pts } from '../format'
import { showToast, useAppState } from '../state'
import { QuizPlayer, type Envoi } from '../games/quiz/PlayerView'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Niveau } from '../components/Niveau'
import { Rank, Score } from '../components/Rank'
import { Shape } from '../components/Shape'
import { promptDialog } from '../components/Dialog'
import { Flamme, Medaille, Serie, ontGagneHier } from '../components/Jour'
import type { PublicProfileDetail } from '../../../shared/profil'
import type { QuizAction, QuizPlayerView } from '../../../shared/games/quiz'
import {
  NOM_MEDAILLE,
  XP_PODIUM_DU_JOUR,
  jourAvant,
  jourEnToutesLettres,
  moisDe,
  moisEnToutesLettres,
  seuilsDesMedailles,
  type ClassementDuJour,
  type LigneDuJour,
  type PartieDuJour,
  type QuestionDuJour,
  type RevelationDuJour,
} from '../../../shared/jour'

/** La marge du serveur après l'échéance (`GRACE_MS`, `games/quiz.ts`), et un souffle : la question se révèle d'elle-même. */
const APRES_ECHEANCE_MS = 1500 + 600

type Ecran = 'partie' | 'classement' | 'correction'

const ecranDe = (hash: string): Ecran => (hash === '#classement' ? 'classement' : hash === '#correction' ? 'correction' : 'partie')

/**
 * Le quiz du jour (`/jour`) : dix questions, les mêmes pour tous les profils,
 * tirées à minuit. On y joue seul, une fois, et l'on apprend : la bonne
 * réponse et son anecdote arrivent après chaque réponse. Le chrono est celui
 * du serveur, la bonne réponse n'arrive jamais avant la sienne (invariant 1).
 *
 * Réservé aux profils. Sans profil, la page le dit et mène à l'accueil, où
 * l'on se connecte — rien de plus : la porte des soirées reste ouverte à tous.
 */
export function JourApp() {
  const { toast } = useAppState()
  const [profil, setProfil] = useState<PublicProfileDetail | null | undefined>(undefined)
  const [partie, setPartie] = useState<PartieDuJour | null>(null)
  const [revelation, setRevelation] = useState<RevelationDuJour | null>(null)
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  const [ecran, setEcran] = useState<Ecran>(() => ecranDe(window.location.hash))
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    const suivre = () => setEcran(ecranDe(window.location.hash))
    window.addEventListener('hashchange', suivre)
    return () => window.removeEventListener('hashchange', suivre)
  }, [])

  const recevoir = useCallback((p: PartieDuJour) => {
    setPartie(p)
    setRevelation(p.revelation ?? null)
    setEnvoi(null)
  }, [])

  useEffect(() => {
    api.joueur
      .moi()
      .then(async ({ profile }) => {
        setProfil(profile)
        if (profile) recevoir(await api.jour.etat())
      })
      .catch(e => {
        if (e instanceof UnauthorizedError) setProfil(null)
        else setErreur(motifDe(e))
      })
  }, [recevoir])

  const aller = (vers: Ecran) => {
    window.location.hash = vers === 'partie' ? '' : vers
    setEcran(vers)
  }

  /** Un geste qui rend la partie : commencer, la suivante, relire. */
  const geste = async (appel: () => Promise<PartieDuJour>) => {
    setOccupe(true)
    try {
      recevoir(await appel())
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  /** Sa réponse : envoyée une fois, révélée aussitôt. */
  const repondre = (action: QuizAction) => {
    const q = partie?.question
    if (!q || action.type !== 'answer' || envoi) return
    setEnvoi({ qIndex: q.index, choice: action.choice, etat: 'envoi' })
    api.jour
      .repondre(q.jour, q.index, action.choice)
      .then(r => {
        setRevelation(r)
        setEnvoi(null)
        setPartie(p => p && { ...p, points: r.cumul, question: undefined })
      })
      .catch(e => {
        setEnvoi({ qIndex: q.index, choice: action.choice, etat: 'perdue' })
        showToast({ kind: 'error', message: motifDe(e) })
      })
  }

  // L'échéance passée sans réponse : le serveur la compte « sans réponse »,
  // et la page va chercher ce qu'elle révèle.
  const question = partie?.question
  useEffect(() => {
    if (!question || envoi) return
    const t = setTimeout(
      () => {
        api.jour.etat().then(recevoir).catch(() => {})
      },
      Math.max(0, question.echeance - serverNow()) + APRES_ECHEANCE_MS,
    )
    return () => clearTimeout(t)
  }, [question, envoi, recevoir])

  // La fin rafraîchit le profil : sa barre d'expérience a bougé.
  const finie = partie?.etat === 'finie'
  useEffect(() => {
    if (finie) api.joueur.moi().then(({ profile }) => profile && setProfil(profile)).catch(() => {})
  }, [finie])

  const signaler = async (r: RevelationDuJour) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut annuler la question pour tous.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: 280 },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.jour.signaler(r.jour, r.index, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  const toastVu = toast && (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      {espacesFines(toast.message)}
    </div>
  )

  if (erreur) {
    return (
      <div className="center-page">
        <p className="error">{erreur}</p>
        <a className="btn" href="/">
          Retour à l’accueil
        </a>
      </div>
    )
  }
  if (profil === null) {
    return (
      <div className="player-shell">
        <section className="card jour-carte">
          <span className="label">Le quiz du jour</span>
          <h1 className="jour-date">Dix questions, chaque jour</h1>
          <p className="muted">
            Les mêmes pour tous les profils, tirées à minuit. On y joue seul, une fois, et l’on apprend : la bonne
            réponse et son anecdote arrivent après chaque question.
          </p>
          <a className="btn btn-primary btn-big btn-block" href="/">
            Me connecter à mon profil
          </a>
        </section>
      </div>
    )
  }
  if (profil === undefined || !partie) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  if (ecran === 'classement') {
    return (
      <>
        <Classement partie={partie} onRetour={() => aller('partie')} />
        {toastVu}
      </>
    )
  }
  if (ecran === 'correction') {
    // La sienne une fois finie ; celle d'hier sinon — le lendemain la propose.
    const jour = partie.etat === 'finie' ? partie.jour : jourAvant(partie.jour)
    return (
      <>
        <Correction jour={jour} onRetour={() => aller('partie')} />
        {toastVu}
      </>
    )
  }

  const bandeau = (points: number) => (
    <p className="jour-bandeau">
      <span className="label">Le quiz du jour · {jourEnToutesLettres(partie.jour, true)}</span>
      <span className="muted small num">{pts(points)}</span>
    </p>
  )

  if (revelation) {
    return (
      <div className="player-shell">
        {bandeau(revelation.cumul)}
        <Revelation r={revelation} />
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={occupe}
          onClick={() => void geste(revelation.derniere ? api.jour.etat : api.jour.suivante)}
        >
          {revelation.derniere ? 'Voir mon résultat' : 'Question suivante'}
        </button>
        <button className="lien-signaler link-inline small" onClick={() => void signaler(revelation)}>
          Signaler une erreur dans cette question
        </button>
        {toastVu}
      </div>
    )
  }

  if (partie.etat === 'en-cours' && partie.question) {
    return (
      <div className="player-shell">
        {bandeau(partie.points)}
        <QuizPlayer
          view={vueDeQuestion(partie.question, envoi)}
          send={repondre}
          teams={[]}
          myTeamId={null}
          players={[]}
          moi={undefined}
          participants={0}
          envoi={envoi}
        />
        {toastVu}
      </div>
    )
  }

  if (partie.etat === 'finie') {
    return (
      <>
        <Fin partie={partie} profil={profil} onClassement={() => aller('classement')} onCorrection={() => aller('correction')} />
        {toastVu}
      </>
    )
  }

  // À jouer — ou en cours entre deux questions, sans rien à révéler : la suivante attend un geste.
  const enCours = partie.etat === 'en-cours'
  return (
    <div className="player-shell">
      {partie.sonHier && <Lendemain partie={partie} onCorrection={() => aller('correction')} />}
      <section className="card jour-carte">
        <div className="jour-tete">
          <span className="label">Le quiz du jour</span>
          <Serie jours={partie.serie} />
        </div>
        <h1 className="jour-date">{capitale(jourEnToutesLettres(partie.jour))}</h1>
        {partie.etat === 'aucun' ? (
          <p className="muted">Pas de quiz aujourd’hui : la réserve de questions est vide. Il revient demain.</p>
        ) : (
          <>
            <p className="jour-meta">
              {partie.total} questions
              {partie.categories.length > 0 && ` · ${partie.categories.slice(0, 4).join(', ')}${partie.categories.length > 4 ? '…' : ''}`}
            </p>
            <p className="muted small">
              Un seul essai, qu’on reprend si le téléphone sonne. Le chrono tourne dès que la question paraît ; la bonne
              réponse et son anecdote arrivent juste après.
            </p>
            <button
              className="btn btn-primary btn-big btn-block"
              disabled={occupe}
              onClick={() => void geste(enCours ? api.jour.suivante : api.jour.commencer)}
            >
              <Icon name="play" />
              {enCours ? `Reprendre · ${pts(partie.points)}` : 'Jouer'}
            </button>
          </>
        )}
        {/* Le vainqueur d'hier est déjà dans « Hier, au quiz du jour » quand il s'affiche. */}
        {(partie.joueurs > 0 || (partie.vainqueursDHier.length > 0 && !partie.sonHier)) && (
          <p className="jour-pied muted small">
            {partie.joueurs > 0 && (
              <button type="button" className="link-inline" onClick={() => aller('classement')}>
                Déjà {partie.joueurs} joueur{partie.joueurs > 1 ? 's' : ''} aujourd’hui
              </button>
            )}
            {partie.vainqueursDHier.length > 0 && !partie.sonHier && <span>{ontGagneHier(partie)}</span>}
          </p>
        )}
      </section>
      <a className="btn btn-ghost btn-block" href="/">
        Retour à l’accueil
      </a>
      {toastVu}
    </div>
  )
}

/** La question du jour, sous la forme que l'écran des soirées sait montrer. */
function vueDeQuestion(q: QuestionDuJour, envoi: Envoi | null): QuizPlayerView {
  return {
    phase: 'question',
    qIndex: q.index,
    qCount: q.total,
    kind: 'choice',
    yourChoice: envoi?.etat === 'recu' ? (envoi.choice ?? null) : null,
    text: q.texte,
    answers: q.reponses,
    ...(q.categorie && { category: q.categorie }),
    deadline: q.echeance,
    duration: q.duree,
  }
}

/** Ce que la réponse apprend : les points, la bonne réponse, la part de la salle, l'anecdote. */
function Revelation({ r }: { r: RevelationDuJour }) {
  const ton = r.annulee || r.choix === null ? '' : r.juste ? 'result-ok' : 'result-ko'
  return (
    <div className="quiz-player">
      <div className="quiz-topbar">
        <span className="label">
          Question {r.index + 1} / {r.total}
        </span>
      </div>
      {/* La question, rappelée : « La bonne réponse : Faux » ne dit rien sans elle. */}
      <p className="jour-rappel">{espacesFines(r.texte)}</p>
      <div className={'card result-banner ' + ton}>
        {r.annulee ? (
          <p>Question annulée : elle ne compte pour personne.</p>
        ) : r.tropTard ? (
          <>
            <span className="result-icon">
              <Icon name="clock" />
            </span>
            <p>Trop tard ! Ta réponse est arrivée après la fin.</p>
          </>
        ) : r.choix === null ? (
          <>
            <span className="result-icon">
              <Icon name="clock" />
            </span>
            <p>Temps écoulé.</p>
          </>
        ) : r.juste ? (
          <>
            <span className="big">+{pts(r.points)}</span>
            <p>Bien joué !</p>
          </>
        ) : (
          <>
            <span className="result-icon">
              <Icon name="x-circle" />
            </span>
            <p>
              Raté… tu avais dit <Shape index={r.choix} inline />
              <strong>{espacesFines(r.reponses[r.choix])}</strong>
            </p>
          </>
        )}
        <p className="muted">
          La bonne réponse : <Shape index={r.bonne} inline />
          <strong>{espacesFines(r.reponses[r.bonne])}</strong>
        </p>
        {r.trouveePar !== null && (
          <div className="jour-trouvee">
            <span className="jauge" aria-hidden="true">
              <span className="jauge-plein" style={{ width: `${Math.round(r.trouveePar * 100)}%` }} />
            </span>
            <span className="muted small">Trouvée par {pourcent(r.trouveePar)} des joueurs du jour</span>
          </div>
        )}
      </div>
      {r.anecdote && (
        <p className="card anecdote">
          <Icon name="message" />
          <span>
            <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
          </span>
        </p>
      )}
    </div>
  )
}

/** La fin de la partie : le score, l'expérience, la médaille, la série, la place pour l'instant. */
function Fin({
  partie,
  profil,
  onClassement,
  onCorrection,
}: {
  partie: PartieDuJour
  profil: PublicProfileDetail
  onClassement: () => void
  onCorrection: () => void
}) {
  const comptees = partie.comptees
  const seuils = seuilsDesMedailles(comptees)
  const part = profil.requis > 0 ? Math.min(100, (profil.acquis / profil.requis) * 100) : 100
  return (
    <div className="player-shell fin-soiree">
      <header className="fin-tete">
        <span className="label">Le quiz du jour</span>
        <h1>{capitale(jourEnToutesLettres(partie.jour))}</h1>
      </header>
      <section className="card result-banner result-ok">
        <span className="big">{pts(partie.points)}</span>
        <p>
          {partie.justes} bonne{partie.justes > 1 ? 's' : ''} réponse{partie.justes > 1 ? 's' : ''} sur {comptees}
        </p>
        {partie.rang > 0 && (
          <p className="muted">
            Pour l’instant : {place(partie.rang)} sur {partie.joueurs}
            {partie.devant && ` · à ${pts(partie.devant.ecart)} de ${partie.devant.nom}`}
          </p>
        )}
      </section>
      <section className="card fin-gain">
        <p className="fin-xp">+{formatNumber(partie.xp)} points d’expérience</p>
        <p className="muted small">
          {pourcent(partie.pointsPossibles > 0 ? partie.points / partie.pointsPossibles : 0)} des points possibles :{' '}
          {formatNumber(partie.points)} sur {formatNumber(partie.pointsPossibles)}
        </p>
        <div className="xp-bar" role="progressbar" aria-label={`Niveau ${profil.niveau}`} aria-valuemin={0} aria-valuemax={profil.requis || 1} aria-valuenow={profil.requis > 0 ? profil.acquis : 1}>
          <div className="xp-fill" style={{ width: `${part}%` }} />
        </div>
        <p className="muted small">
          {profil.requis > 0
            ? `Niveau ${profil.niveau} · ${formatNumber(profil.acquis)} / ${formatNumber(profil.requis)} XP vers le niveau ${profil.niveau + 1}`
            : `Niveau ${profil.niveau} · au sommet`}
        </p>
      </section>
      <section className="card jour-recompenses">
        <div className="jour-ligne">
          {partie.medaille ? (
            <Medaille medaille={partie.medaille} className="medaille-grande" />
          ) : (
            <span className="jour-pastille">
              <Icon name="target" />
            </span>
          )}
          <div>
            <b>{partie.medaille ? NOM_MEDAILLE[partie.medaille] : 'Pas de médaille aujourd’hui'}</b>
            <span className="muted small">
              Le bronze à {seuils.bronze} bonnes réponses, l’argent à {seuils.argent}, l’or à {seuils.or}.
            </span>
          </div>
        </div>
        {partie.serie > 0 && (
          <div className="jour-ligne">
            <span className="jour-pastille">
              <Flamme />
            </span>
            <div>
              <b>
                Série : {partie.serie} jour{partie.serie > 1 ? 's' : ''}
              </b>
              <span className="muted small">Un soir de soirée compte aussi : la fête ne casse jamais une série.</span>
            </div>
          </div>
        )}
      </section>
      <p className="muted small jour-note">
        Le classement se fige à minuit. Le podium gagne {XP_PODIUM_DU_JOUR.join(', ').replace(/, (\d+)$/, ' et $1')} XP.
      </p>
      <div className="fin-actions">
        <button className="btn btn-primary" onClick={onClassement}>
          <Icon name="list" />
          Voir le classement
        </button>
        <button className="btn" onClick={onCorrection}>
          <Icon name="book" />
          Revoir mes réponses
        </button>
        <a className="btn btn-ghost" href="/">
          Retour à l’accueil
        </a>
      </div>
    </div>
  )
}

/** Hier, au quiz du jour : sa place, ce que le podium lui a payé, le vainqueur. */
function Lendemain({ partie, onCorrection }: { partie: PartieDuJour; onCorrection: () => void }) {
  const h = partie.sonHier!
  return (
    <section className="card jour-annonce">
      <span className="label">Hier, au quiz du jour</span>
      <div className="jour-ligne">
        {h.medaille && <Medaille medaille={h.medaille} className="medaille-geante" />}
        <div>
          <h2>{h.rang > 0 ? `${place(h.rang)} sur ${h.joueurs}` : pts(h.points)}</h2>
          <span className="muted">
            {[h.rang > 0 && pts(h.points), h.xpPodium > 0 && `+${h.xpPodium} XP de podium`, h.medaille && NOM_MEDAILLE[h.medaille].toLowerCase()]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </div>
      {partie.vainqueursDHier.length > 0 && (
        <p className="muted small">
          {partie.vainqueursDHier.map(v => v.avatar).join(' ')} {ontGagneHier(partie)}.
        </p>
      )}
      <button className="btn btn-block" onClick={onCorrection}>
        <Icon name="book" />
        La correction d’hier
      </button>
    </section>
  )
}

type Periode = 'jour' | 'hier' | 'mois'

/** Le classement : aujourd'hui, hier, le mois — tous les profils du serveur. */
function Classement({ partie, onRetour }: { partie: PartieDuJour; onRetour: () => void }) {
  const [periode, setPeriode] = useState<Periode>('jour')
  const [classement, setClassement] = useState<ClassementDuJour | null>(null)
  const [erreur, setErreur] = useState('')
  const demande = useRef(0)
  useEffect(() => {
    const n = ++demande.current
    setClassement(null)
    const q = periode === 'jour' ? { jour: partie.jour } : periode === 'hier' ? { jour: jourAvant(partie.jour) } : { mois: moisDe(partie.jour) }
    api.jour
      .classement(q)
      .then(c => n === demande.current && setClassement(c))
      .catch(e => n === demande.current && setErreur(motifDe(e)))
  }, [periode, partie.jour])
  const onglets: [Periode, string][] = [
    ['jour', 'Aujourd’hui'],
    ['hier', 'Hier'],
    ['mois', capitale(moisEnToutesLettres(moisDe(partie.jour)).split(' ')[0])],
  ]
  return (
    <div className="player-shell">
      <header className="jour-titre">
        <span className="label">Le quiz du jour · {jourEnToutesLettres(partie.jour, true)}</span>
        <h2>Le classement</h2>
      </header>
      <div className="onglets onglets-petits" role="tablist" aria-label="Période">
        {onglets.map(([id, nom]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={periode === id}
            className={'onglet' + (periode === id ? ' actif' : '')}
            onClick={() => setPeriode(id)}
          >
            {nom}
          </button>
        ))}
      </div>
      {erreur && <p className="error">{erreur}</p>}
      {!classement && !erreur && <p className="muted">Chargement…</p>}
      {classement && (
        <>
          <p className="muted small">
            {classement.joueurs === 0
              ? 'Personne n’a encore joué.'
              : `${classement.joueurs} joueur${classement.joueurs > 1 ? 's' : ''} · ${
                  classement.fige ? 'figé' : periode === 'mois' ? 'le total du mois' : 'se fige à minuit'
                }`}
          </p>
          <div className="leaderboard">
            {classement.lignes.map(l => (
              <LigneDuClassement key={l.profileId} ligne={l} moi={l.profileId === classement.sienne} />
            ))}
            {classement.moi && (
              <>
                <p className="muted center small">…</p>
                <LigneDuClassement ligne={classement.moi} moi />
              </>
            )}
          </div>
        </>
      )}
      <button className="btn btn-ghost btn-block" onClick={onRetour}>
        Retour
      </button>
    </div>
  )
}

function LigneDuClassement({ ligne: l, moi }: { ligne: LigneDuJour; moi: boolean }) {
  return (
    <div className={'lb-row' + (moi ? ' me' : '')}>
      <Rank n={l.rang} />
      <Avatar className="lb-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} />
      <span className="lb-name">
        {l.nom}
        {l.enCours && <span className="muted small"> · en cours</span>}
      </span>
      <Niveau niveau={l.niveau} />
      <Score n={l.points} texte={formatNumber(l.points)} />
    </div>
  )
}

/** La correction d'un jour : chaque question, sa bonne réponse, la part de la salle, et ce qu'on avait dit. */
function Correction({ jour, onRetour }: { jour: string; onRetour: () => void }) {
  const [correction, setCorrection] = useState<CorrectionDuJour | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    api.jour
      .correction(jour)
      .then(setCorrection)
      .catch(e => setErreur(motifDe(e)))
  }, [jour])
  return (
    <div className="player-shell">
      <header className="jour-titre">
        <span className="label">Le quiz du jour · {jourEnToutesLettres(jour, true)}</span>
        <h2>La correction</h2>
      </header>
      {erreur && <p className="muted">{erreur}</p>}
      {!correction && !erreur && <p className="muted">Chargement…</p>}
      {correction && (
        <ol className="correction">
          {correction.questions.map((q, i) => (
            <li key={i} className={q.annulee ? '' : q.juste ? 'ok' : 'ko'}>
              <span className="correction-marque">
                <Icon name={q.juste ? 'check' : 'x'} />
              </span>
              <span className="correction-corps">
                <span>{espacesFines(q.texte)}</span>
                <span className="muted small">
                  <b>{espacesFines(q.reponses[q.bonne])}</b>
                  {q.trouveePar !== null && ` · trouvée par ${pourcent(q.trouveePar)}`}
                  {q.annulee && ' · annulée'}
                </span>
                {q.repondue && !q.juste && q.choix !== null && (
                  <span className="muted small">Tu avais dit : {espacesFines(q.reponses[q.choix])}</span>
                )}
                {q.anecdote && <span className="small">{espacesFines(q.anecdote)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <button className="btn btn-ghost btn-block" onClick={onRetour}>
        Retour
      </button>
    </div>
  )
}

const capitale = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)

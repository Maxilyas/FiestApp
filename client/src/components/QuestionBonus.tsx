import { Icon } from './Icon'
import { Shape } from './Shape'
import { TimerBar } from './TimerBar'
import { Avatar } from './Avatar'
import { GerbeDeJuste } from './Gerbe'
import { NicheALaRevelation } from './NicheReagit'
import { IconePlume, SignatureDuPublic } from './LaPlume'
import { deNom, espacesFines, pourcent, pts } from '../format'
import { toucher } from '../toucher'
import { nicheRetientSonSouffle } from '../niche'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { rareAuQuizDuJour, reactionDuSolo } from '../../../shared/niche'
import type { BonusDuJour, QuestionDuBonus, RevelationDuBonus } from '../../../shared/jour'
import type { SalleDuBonus, VoteDuBonus } from '../../../shared/propositions'
import type { PublicProfile } from '../../../shared/profil'

// La question bonus du quiz du jour (le choix du propriétaire du 8 novembre
// 2026, `shared/propositions.ts`) : la question d'un joueur, après les dix.
// Mêlée aux autres, on la jouait à la course sans voir qu'un joueur l'avait
// écrite — « on ne se rend même pas compte que c'est une question d'un
// joueur ». Elle a donc son écran à elle, de bout en bout : une carte de
// parchemin, sa plume et la signature de son auteur dès qu'elle paraît, un
// chrono plus long, et ni points ni classement — trouvée, des confettis et
// de l'expérience. Puis la salle la note d'un pouce, que son auteur lira.

/**
 * Qui l'a écrite, en une ligne : « La question de Léa », son visage devant —
 * « Ta question » à son auteur, ou « d'un joueur », son profil parti.
 */
function LaQuestionDe({ auteur, tienne = false }: { auteur?: BonusDuJour['auteur']; tienne?: boolean }) {
  return (
    <span className="bonus-de">
      {auteur && !tienne && <Avatar avatar={auteur.avatar} finition={auteur.finition} eclat={auteur.eclat} legendaire={auteur.legendaire} />}
      {espacesFines(tienne ? 'Ta question' : auteur ? `La question ${deNom(auteur.nom)}` : 'La question d’un joueur')}
    </span>
  )
}

/** « +10 confettis · +20 XP » : ce qu'elle rapporte, trouvée — chaque nombre collé à son mot, qu'une fin de ligne ne sépare pas. */
const sesGains = (b: { confettis: number; xp: number }) => `+${b.confettis} confettis · +${b.xp} XP`

/** La tête de la carte : sa pastille, la plume, et qui l'a écrite. */
function TeteDuBonus({ auteur, tienne = false }: { auteur?: BonusDuJour['auteur']; tienne?: boolean }) {
  return (
    <div className="bonus-tete">
      <span className="pill bonus-pastille">
        <IconePlume />
        Question bonus
      </span>
      <LaQuestionDe auteur={auteur} tienne={tienne} />
    </div>
  )
}

/**
 * Ce que la page du jour en dit avant les dix — et à son auteur, à qui l'a
 * relue : une ligne au pied de la carte du jour, sous « Jouer ». Elle dit
 * qu'elle vient d'un joueur avant même la première question.
 */
export function AnnonceDuBonus({ bonus }: { bonus: BonusDuJour }) {
  const texte =
    bonus.etat === 'tienne'
      ? 'Ta question est la question bonus du jour : les autres la jouent après leurs dix.'
      : bonus.etat === 'relue'
        ? 'Aujourd’hui, la question bonus est une question que tu as relue : tu ne la joues pas.'
        : `Après tes dix questions, la question bonus ${bonus.auteur ? deNom(bonus.auteur.nom) : 'd’un joueur'} : ${sesGains(bonus)} si tu la trouves.`
  return (
    <p className="bonus-annonce">
      <IconePlume />
      <span>{espacesFines(texte)}</span>
    </p>
  )
}

/**
 * Ce que la salle en fait, pour son auteur et qui l'a relue : combien l'ont
 * jouée, la part qui l'a trouvée, les pouces — les chiffres seuls, sans un
 * prénom.
 */
export function SalleDuBonusEnLigne({ salle }: { salle: SalleDuBonus }) {
  if (salle.joueurs === 0) return <p className="muted small">Personne ne l’a encore jouée : ça vient.</p>
  return (
    <p className="bonus-salle small">
      {espacesFines(
        `Jouée par ${salle.joueurs} · trouvée par ${pourcent(salle.trouvees / salle.joueurs)}${salle.pour + salle.contre > 0 ? ` · 👍 ${salle.pour} · 👎 ${salle.contre}` : ''}`,
      )}
    </p>
  )
}

/**
 * Le pouce, une fois jouée : levé, baissé — il se change jusqu'à minuit. Son
 * auteur le lira au lendemain, et le QG y repère qui écrit bien.
 */
export function PouceDuBonus({ vote, auteur, occupe, onVoter }: { vote: VoteDuBonus | null; auteur?: BonusDuJour['auteur']; occupe: boolean; onVoter: (v: VoteDuBonus) => void }) {
  return (
    <div className="bonus-pouce" role="group" aria-label="Une bonne question ?">
      <span className="bonus-pouce-question">{espacesFines(vote ? (auteur ? `Merci : ${auteur.nom} le lira demain` : 'Merci : son auteur le lira demain') : 'Une bonne question ?')}</span>
      <span className="bonus-pouce-boutons">
        <button type="button" className="bonus-pouce-btn" aria-pressed={vote === 1} aria-label="Bonne question" disabled={occupe} onClick={() => onVoter(1)}>
          <span aria-hidden="true">👍</span>
        </button>
        <button type="button" className="bonus-pouce-btn" aria-pressed={vote === -1} aria-label="Pas terrible" disabled={occupe} onClick={() => onVoter(-1)}>
          <span aria-hidden="true">👎</span>
        </button>
      </span>
    </div>
  )
}

/**
 * La carte de la question bonus, sous le résultat du jour : l'invitation à
 * la jouer, ce qu'elle a donné une fois jouée — et à son auteur, à qui l'a
 * relue, ce que la salle en fait. Un parchemin : elle ne ressemble à rien
 * d'autre de la page.
 */
export function CarteDuBonus({
  bonus,
  occupe,
  onJouer,
  onVoter,
}: {
  bonus: BonusDuJour
  occupe: boolean
  onJouer: () => void
  onVoter: (v: VoteDuBonus) => void
}) {
  const r = bonus.revelation
  if (bonus.etat === 'a-venir') return null
  return (
    // Pas `.card` : chaque thème repeint la carte d'un verre à lui, et la question d'un joueur ne ressemblerait plus à rien d'autre.
    <section className="bonus-carte" aria-label="La question bonus">
      <TeteDuBonus auteur={bonus.auteur} tienne={bonus.etat === 'tienne'} />
      {bonus.etat === 'a-jouer' || bonus.etat === 'en-cours' ? (
        <>
          <h2 className="bonus-titre">Une dernière, pour le plaisir</h2>
          <p className="muted small">
            {espacesFines(`Ni points ni classement : trouvée, ${sesGains(bonus)}. ${bonus.duree} secondes pour la lire et répondre.`)}
          </p>
          <button type="button" className="btn btn-primary btn-block" disabled={occupe} onClick={onJouer}>
            <IconePlume />
            {bonus.etat === 'en-cours' ? 'Reprendre la question bonus' : 'Jouer la question bonus'}
          </button>
        </>
      ) : bonus.etat === 'tienne' ? (
        <>
          <h2 className="bonus-titre">Ta question est la question bonus du jour</h2>
          {r && <p className="bonus-rappel">{espacesFines(r.texte)}</p>}
          {r?.salle && <SalleDuBonusEnLigne salle={r.salle} />}
          <p className="muted small">Tu ne la joues pas : demain, ton accueil te dira si elle était bien dosée.</p>
        </>
      ) : bonus.etat === 'relue' ? (
        <>
          <h2 className="bonus-titre">Tu l’as relue : elle ne se joue pas pour toi</h2>
          {r && <p className="bonus-rappel">{espacesFines(r.texte)}</p>}
          {r?.salle && <SalleDuBonusEnLigne salle={r.salle} />}
        </>
      ) : (
        r && (
          <>
            <p className="bonus-verdict">
              {r.juste ? (
                <>
                  <Icon name="check-circle" /> {espacesFines(`Trouvée : ${sesGains(r)}`)}
                </>
              ) : r.choix === null ? (
                <>
                  <Icon name="clock" /> Temps écoulé
                </>
              ) : (
                <>
                  <Icon name="x-circle" /> Ratée
                </>
              )}
            </p>
            <p className="bonus-rappel">{espacesFines(r.texte)}</p>
            <p className="muted small">
              La bonne réponse : <Shape index={r.bonne} inline />
              <strong>{espacesFines(r.reponses[r.bonne])}</strong>
              {r.trouveePar !== null && espacesFines(` · trouvée par ${pourcent(r.trouveePar)}`)}
            </p>
            <PouceDuBonus vote={r.vote} auteur={bonus.auteur} occupe={occupe} onVoter={onVoter} />
          </>
        )
      )}
    </section>
  )
}

/**
 * L'écran qui sépare les dix de la question bonus : la course est finie —
 * son score est fixé, le classement aussi —, et une dernière vient, pour le
 * plaisir, d'un joueur. Elle se joue maintenant, ou plus tard jusqu'à minuit.
 */
export function EcranDuBonus({
  bonus,
  points,
  justes,
  comptees,
  occupe,
  onJouer,
  onPlusTard,
}: {
  bonus: BonusDuJour
  points: number
  justes: number
  comptees: number
  occupe: boolean
  onJouer: () => void
  onPlusTard: () => void
}) {
  const s = justes > 1 ? 's' : ''
  return (
    <>
      <section className="card result-banner bonus-score">
        <span className="label">Tes dix questions</span>
        <span className="big num">{pts(points)}</span>
        <p className="muted small">{`${justes} bonne${s} réponse${s} sur ${comptees} · ton score est fixé`}</p>
      </section>
      <section className="bonus-carte bonus-invitation">
        <TeteDuBonus auteur={bonus.auteur} />
        <h1 className="bonus-titre">Une dernière, pour le plaisir</h1>
        <p>{espacesFines(`${bonus.auteur ? `${bonus.auteur.nom} l’a écrite` : 'Un joueur l’a écrite'} pour le quiz du jour. Elle ne compte ni aux points ni au classement : trouvée, ${sesGains(bonus)}.`)}</p>
        <p className="muted small">{espacesFines(`${bonus.duree} secondes : prends le temps de la lire.`)}</p>
        <button type="button" className="btn btn-primary btn-big btn-block" disabled={occupe} onClick={onJouer}>
          <IconePlume />
          Jouer la question bonus
        </button>
        <button type="button" className="btn btn-ghost btn-block" disabled={occupe} onClick={onPlusTard}>
          Plus tard : voir mon résultat
        </button>
      </section>
    </>
  )
}

/**
 * La question bonus, montrée : sa carte de parchemin, la signature de son
 * auteur en tête, son chrono — le serveur tient l'échéance (invariant 6) —
 * et ses quatre réponses aux formes du quiz. Un toucher répond : la
 * première réponse est la bonne, comme au quiz du jour.
 */
export function QuestionDuBonusEnJeu({
  question,
  auteur,
  envoi,
  onRepondre,
}: {
  question: QuestionDuBonus
  auteur?: BonusDuJour['auteur']
  /** La réponse touchée, en route vers le serveur. */
  envoi: number | null
  onRepondre: (choix: number) => void
}) {
  return (
    <div className="quiz-player bonus-question">
      <div className="bonus-carte bonus-carte-question">
        <TeteDuBonus auteur={auteur} />
        <TimerBar deadline={question.echeance} duration={question.duree} />
        {question.categorie && <span className="label quiz-categorie">{question.categorie}</span>}
        <h2 className={'quiz-question' + questionSizeClass(question.texte)}>{espacesFines(question.texte)}</h2>
      </div>
      <div className={'ans-grid' + answersSizeClass(question.reponses)}>
        {question.reponses.map((a, i) => (
          <button
            key={i}
            type="button"
            disabled={envoi !== null}
            aria-pressed={envoi === i}
            className={'ans-btn' + (envoi === i ? ' pending' : '')}
            {...toucher(() => {
              navigator.vibrate?.(35)
              // Sa niche retient son souffle : le téléphone ne sait pas encore si c'est juste.
              nicheRetientSonSouffle()
              onRepondre(i)
            })}
          >
            <Shape index={i} />
            <span className="ans-text">{espacesFines(a)}</span>
          </button>
        ))}
      </div>
      {envoi !== null && <p className="hint">Envoi…</p>}
    </div>
  )
}

/**
 * Ce que la question bonus apprend : le verdict — et ce qu'elle rapporte —,
 * la bonne réponse, la part de ceux qui l'ont jouée, le défi de son auteur
 * (« Tu as déjoué Léa »), son anecdote et sa signature, puis le pouce.
 */
export function RevelationDuBonusVue({
  bonus,
  revelation: r,
  profil,
  occupe,
  onVoter,
}: {
  bonus: BonusDuJour
  revelation: RevelationDuBonus
  profil: PublicProfile
  occupe: boolean
  onVoter: (v: VoteDuBonus) => void
}) {
  const ton = r.choix === null || r.tropTard ? '' : r.juste ? 'result-ok' : 'result-ko'
  // Sa niche : sans réponse ou trop tard, calme ; peu l'ont trouvée, des cœurs.
  const reaction = reactionDuSolo(r.tropTard || r.choix === null ? null : r.juste, rareAuQuizDuJour(r.trouveePar))
  const nom = bonus.auteur?.nom
  return (
    <div className="quiz-player bonus-question">
      <div className="bonus-carte bonus-carte-question">
        <TeteDuBonus auteur={bonus.auteur} />
        <p className="jour-rappel">{espacesFines(r.texte)}</p>
      </div>
      <div className={'card result-banner ' + ton}>
        <NicheALaRevelation cle={`jour:bonus:${r.jour}`} reaction={reaction} />
        {r.tropTard ? (
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
            <span className="big">{espacesFines(`+${r.confettis} confettis`)}</span>
            <p>{espacesFines(`+${r.xp} XP · ${nom ? `tu as déjoué ${nom} !` : 'bien joué !'}`)}</p>
            <GerbeDeJuste />
          </>
        ) : (
          <>
            <span className="result-icon">
              <Icon name="x-circle" />
            </span>
            <p>
              {espacesFines(nom ? `${nom} t’a eu… tu avais dit ` : 'Raté… tu avais dit ')}
              <Shape index={r.choix} inline />
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
            <span className="muted small">Trouvée par {pourcent(r.trouveePar)} de ceux qui l’ont jouée</span>
          </div>
        )}
      </div>
      <div className="card anecdote-du-public bonus-pied">
        {r.anecdote && (
          <p className="anecdote">
            <Icon name="message" />
            <span>
              <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
            </span>
          </p>
        )}
        {bonus.auteur && <SignatureDuPublic auteur={bonus.auteur} profil={profil} />}
        <PouceDuBonus vote={r.vote} auteur={bonus.auteur} occupe={occupe} onVoter={onVoter} />
      </div>
    </div>
  )
}

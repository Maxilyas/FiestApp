import type { IssueDeRencontre, SonApparence } from '../../../shared/campagne'
import type { CleDeLigue, EnjeuDuDuel, OuEnEstLeDuel } from '../../../shared/duels'
import type { IconName } from '../components/Icon'

// Ce qu'une rencontre — un duel classé (`shared/duels.ts`) — écrit d'elle-même,
// sur l'écran de la partie (`CampagneApp`) comme dans la page des duels
// (`Duels.tsx`) : quelques lignes, et ce qu'elle met en jeu, que la campagne,
// la préparation d'un défi et la carte d'un joueur gardent sans faire venir le
// code des duels — rien d'autre que React.

/** Le score d'une rencontre, toi d'abord : « Toi 7 – Tom 6 ». */
export const scoreDeRencontre = (toi: number, a: { nom: string }, lui: number) => `Toi ${toi} – ${a.nom} ${lui}`

/** Ce que dit une rencontre finie, en un mot. */
export const MOT_DE_L_ISSUE: Record<IssueDeRencontre, string> = { gagnee: 'Gagné', egalite: 'Égalité', perdue: 'Perdu' }

/** Un écart de cote, signé : « +14 », « −9 » — le vrai signe moins —, « ±0 ». */
export const ecartSigne = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')

/**
 * Ce qu'une défaite ferait à sa cote, dans une phrase. Sous l'Or, la montée
 * la rend souvent payante (`shared/duels.ts`) : « +2 même si tu perds »,
 * « rien à perdre » — « +2 si tu perds » en rouge se lisait comme une
 * menace, et c'est elle qui faisait dire « je fais que reculer ».
 */
export const siTuPerds = (perdu: number) => (perdu === 0 ? 'rien à perdre' : `${ecartSigne(perdu)}${apresLaPerte(perdu)}`)

/** Ce qui suit l'écart d'une défaite qui n'est pas nulle : « même si tu perds » quand elle rapporte. */
export const apresLaPerte = (perdu: number) => (perdu > 0 ? ' même si tu perds' : ' si tu perds')

/** Ce qu'un duel met en jeu, en une phrase — le nom d'un bouton « Défier » : « +21 si tu gagnes, −3 si tu perds ». */
export const phraseDeLEnjeu = (enjeu: Pick<EnjeuDuDuel, 'gagne' | 'perdu'>) => `${ecartSigne(enjeu.gagne)} si tu gagnes, ${siTuPerds(enjeu.perdu)}`

/**
 * Ce qu'un duel met en jeu sur sa cote, sur une ligne : « En jeu : +19 si tu
 * gagnes, +2 même si tu perds » — au-dessus de chaque question d'une partie,
 * et sous « Défier » sur la carte d'un joueur. Sous l'Or, une défaite rapporte
 * souvent quelque chose (la montée) : elle se dit à la couleur d'un gain,
 * « même si tu perds », jamais en menace.
 */
export function EnJeu({ enjeu, className }: { enjeu: Pick<EnjeuDuDuel, 'gagne' | 'perdu'>; className: string }) {
  return (
    <p className={className}>
      En jeu : <b className="duels-plus">{ecartSigne(enjeu.gagne)}</b> si tu gagnes,{' '}
      {enjeu.perdu === 0 ? (
        siTuPerds(enjeu.perdu)
      ) : (
        <>
          <b className={enjeu.perdu > 0 ? 'duels-plus' : 'duels-moins'}>{ecartSigne(enjeu.perdu)}</b>
          {apresLaPerte(enjeu.perdu)}
        </>
      )}
    </p>
  )
}

/**
 * Ce qu'un duel met en jeu sur sa cote, en deux jetons : ce que la victoire
 * rapporte, ce que la défaite coûte — ou rapporte encore, sous l'Or (la
 * montée) : le jeton ne prend alors pas la couleur d'une perte. En grand sur
 * un duel reçu et au dé ; petits, côte à côte, sous l'adversaire choisi d'une
 * préparation, où « Jouer le duel » doit rester près.
 */
export function JetonsDeLEnjeu({ enjeu, petits }: { enjeu: Pick<EnjeuDuDuel, 'gagne' | 'perdu'>; petits?: boolean }) {
  return (
    <div className={'duels-jetons' + (petits ? ' petits' : '')} role="group" aria-label="Ce qui se joue sur ta cote">
      <span className="duels-jeton">
        <b className="num">{ecartSigne(enjeu.gagne)}</b>
        <span>victoire</span>
      </span>
      <span className={'duels-jeton' + (enjeu.perdu < 0 ? ' perdu' : '')}>
        <b className="num">{ecartSigne(enjeu.perdu)}</b>
        <span>défaite</span>
      </span>
    </div>
  )
}

/**
 * Ce qui se dit d'un duel déjà ouvert entre eux, là où l'on choisit qui
 * défier — sa carte, à la place de « Défier » ; la préparation, sous celui
 * qu'il a choisi : où il en est, en une phrase, et de quoi le rouvrir s'il est
 * à lui. On y défiait qui l'on défiait déjà, et le refus ne tombait qu'au bout
 * de la préparation (le retour du propriétaire du 15 octobre 2026). Pas
 * encore parti, ou retenu, il n'est pas à lui : la phrase seule dit quoi
 * faire. Ce que le refus d'un second duel dirait (`duelOuvertEntre`), dit
 * avant qu'on le prépare — au présent : « te défie » ne devine pas qui lit,
 * quand « t'a défié » l'accordait.
 */
export const DIT_DU_DUEL_OUVERT: Record<OuEnEstLeDuel, { phrase: (nom: string) => string; bouton?: { texte: string; icone: IconName; aToi?: true } }> = {
  'a-finir': { phrase: nom => `Un duel est en cours entre vous : il partira à ${nom} à ta dernière réponse.`, bouton: { texte: 'Reprendre ton duel', icone: 'play', aToi: true } },
  'chez-l-autre': { phrase: nom => `Un duel est en cours entre vous : il attend que ${nom} le joue.`, bouton: { texte: 'Voir ton duel', icone: 'eye' } },
  'a-relever': { phrase: nom => `${nom} te défie : à toi de jouer.`, bouton: { texte: 'Relever son duel', icone: 'swords', aToi: true } },
  'a-venir': { phrase: nom => `${nom} te défie : son duel t’arrivera à sa dernière réponse.` },
  retenu: { phrase: nom => `${nom} te défie : remets ce profil dans tes amis pour recevoir son duel.` },
}

/**
 * Ce qu'un joueur porte, sur l'avatar d'un écran de duel : sa finition, son
 * légendaire ou son portrait, son Éclat (`SonApparence`). L'emoji seul
 * montrait l'écureuil d'en dessous à qui porte un légendaire — au classement
 * de la page des duels, sur la carte du verdict (le retour du propriétaire
 * du 13 octobre 2026). Sa bordure non : l'anneau de sa ligue la dit déjà, et
 * elle débordait de l'anneau. Rien s'il ne porte rien — un emoji mat.
 */
export function ceQuIlPorte(x: SonApparence | null | undefined): SonApparence | undefined {
  if (!x) return undefined
  const porte: SonApparence = {
    ...(x.finition && x.finition !== 'mat' && { finition: x.finition }),
    ...(x.legendaire && { legendaire: x.legendaire }),
    ...(x.eclat && { eclat: true as const }),
  }
  return Object.keys(porte).length > 0 ? porte : undefined
}

/**
 * Celui qu'on affronte dans un duel contre quelqu'un, tel que la partie le
 * dit à chaque question : son prénom, son avatar et ce qu'il porte, sa ligue
 * — et la sienne, pour les anneaux de la fin —, s'il a déjà joué, et ce que
 * le duel met en jeu sur sa cote. Jamais son score : il se dévoile à sa
 * dernière réponse (le souhait du propriétaire du 12 octobre 2026 : « à
 * battre : 8 » se lisait avant même la première question).
 */
export interface ContreEnJeu {
  nom: string
  avatar: string
  apparence?: SonApparence
  ligue?: CleDeLigue
  maLigue?: CleDeLigue
  /** Il l'a lancé et joué : son score attend la dernière réponse. Sinon, il jouera après. */
  aDejaJoue?: true
  enjeu?: EnjeuDuDuel
}

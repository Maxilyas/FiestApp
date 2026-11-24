// Le Sphinx de l'accueil (le plan du 24 novembre 2026,
// `retours/2026-11-24/le-sphinx/plan.md`) : parfois, sur l'accueil d'un
// habitué, il propose une énigme de 1858 ; résolue, elle dévoile un mot de la
// phrase du Divin du moment — le même pour tout le serveur.
//
// Ce module part dans le paquet du navigateur : il ne porte que des formes et
// des comptes. Ni une réponse d'énigme — elles vivent dans la réserve du
// serveur, et ne partent qu'une fois la visite close —, ni
// une légende de Divin, ni une règle (invariant 21). Le serveur décide tout
// (`server/src/core/sphinx.ts`) ; la page montre ce qu'il envoie.

/** Combien de jours joués, sur les derniers, font un habitué : le Sphinx ne parle qu'à eux. */
export const JOURS_DE_L_HABITUE = 4
/** Sur combien de jours, aujourd'hui compris, à l'heure de Paris. */
export const FENETRE_DE_L_HABITUE = 7
/** Les essais d'une énigme : une réponse qui brûle n'en coûte pas. */
export const ESSAIS_DU_SPHINX = 3

/**
 * Ce que devient une visite : proposée, remise à plus tard (le Sphinx
 * épinglé au bas de l'accueil jusqu'à minuit), puis close — résolue, perdue
 * au troisième essai, ou abandonnée (« Je donne ma langue au chat »).
 */
export type EtatDeLaVisite = 'proposee' | 'plus-tard' | 'resolue' | 'perdue' | 'abandonnee'
export const VISITE_CLOSE: readonly EtatDeLaVisite[] = ['resolue', 'perdue', 'abandonnee']

/** Ce qu'un joueur fait d'une visite (`POST /api/joueur/sphinx`). */
export const GESTES_DU_SPHINX = ['ecouter', 'plus-tard', 'repondre', 'chat'] as const
export type GesteDuSphinx = (typeof GESTES_DU_SPHINX)[number]

/** Ce que l'accueil lit dans ses missions (`MissionsDuJour.sphinx`) : une visite attend, ou il l'a remise à plus tard. */
export type SphinxDesMissions = 'attend' | 'epingle'

/**
 * Un mot de la phrase d'un Divin, tel qu'un profil le voit. `forme` : un
 * trait par lettre, l'apostrophe et le trait d'union montrés (« _’___ ») ;
 * `texte`, seulement s'il est offert — un petit mot, jamais un nombre —, s'il
 * l'a gagné, ou si la phrase est reconstituée.
 */
export interface MotDeLaPhrase {
  forme: string
  texte?: string
  /** Un petit mot, que tout le monde voit. */
  offert?: true
  /** Un mot que le Sphinx lui a soufflé. */
  sien?: true
}

/** La phrase d'un Divin, telle que ce profil la voit. */
export interface PhraseDuSphinx {
  divin: { key: string; nom: string }
  mots: MotDeLaPhrase[]
  /** Ses mots cachés, en tout. */
  aTrouver: number
  /** Combien il en a trouvé. */
  siens: number
  /** Combien tous les profils en ont trouvé ensemble — un nombre, jamais lesquels. */
  parTous: number
  /**
   * Tous ses mots trouvés, par tous — retrouvée. Elle ne s'impose plus (la
   * décision du propriétaire du 24 novembre 2026 : chacun avance à son
   * rythme) : elle ne se montre entière qu'à qui choisit de la lire.
   */
  reconstituee: boolean
  /**
   * Retrouvée par tous, et pas encore lue par lui : elle se dévoile à sa
   * demande (`POST /api/joueur/sphinx/phrase`). Jusque-là, rien de plus que
   * ses mots, les petits mots offerts, la forme du reste et le compte.
   */
  aDevoiler?: true
  /**
   * La phrase entière, ponctuation comprise, à qui la voit entière : il porte
   * ce Divin, il l'a choisie une fois retrouvée, ou il en a trouvé lui-même
   * chaque mot caché. Absente sinon.
   */
  legende?: string
  /** Il porte ce Divin : il en connaît la légende, elle se montre entière à lui. */
  porteur?: true
}

/** Une énigme, telle que la page la reçoit : sa réponse seulement une fois la visite close. */
export interface EnigmeDuSphinx {
  numero: string
  sorte: 'enigme' | 'charade'
  vers: string[]
  source: { recueil: string; page: string; facSimile: string }
  /** La solution du livre, une fois la visite close. */
  solution?: string
  /** Une charade : comment la clé du livre la découpe (« Cher-cher »), une fois la visite close. */
  cle?: string
}

/** La visite du jour. */
export interface VisiteDuSphinx {
  jour: string
  etat: EtatDeLaVisite
  divin: { key: string; nom: string }
  enigme: EnigmeDuSphinx
  essaisRestants: number
  /** Le mot gagné, une fois l'énigme résolue : sa place dans la phrase de son Divin, et son texte. */
  mot?: { index: number; texte: string }
  /** La phrase du Divin de cette visite, telle qu'il la voit. */
  phrase: PhraseDuSphinx
}

/** Ce que `GET /api/joueur/sphinx` rend à un profil : sa page fermée pour lui, rien d'autre ne part. */
export type LeSphinx = SphinxFerme | SphinxOuvert

/** La page du Sphinx fermée pour lui : en maintenance, ou bientôt disponible et lui pas testeur. */
export interface SphinxFerme {
  fermee: 'maintenance' | 'bientot'
}

export interface SphinxOuvert {
  fermee?: undefined
  habitue: boolean
  /** Ses jours joués, sur les `FENETRE_DE_L_HABITUE` derniers. */
  joursJoues: number
  visite: VisiteDuSphinx | null
  /** La phrase du Divin du moment ; null quand tous les Divins ont leur phrase reconstituée. */
  phrase: PhraseDuSphinx | null
  /**
   * Les phrases que tous ont reconstituées, telles qu'il les voit — entières
   * seulement s'il les a choisies, s'il porte leur Divin ou s'il en a trouvé
   * chaque mot : le texte d'une phrase qu'il n'a pas choisie n'arrive pas
   * jusqu'à son navigateur.
   */
  reconstituees: PhraseDuSphinx[]
}

/** « La phrase est retrouvée : la lire » (`POST /api/joueur/sphinx/phrase`, `{ divin }`) : la phrase entière, à lui pour de bon. */
export interface PhraseLueDuSphinx {
  accuse: true
  phrase: PhraseDuSphinx
}

/** Ce qu'un geste rend : son accusé, son verdict, et la visite d'après. */
export interface VerdictDuSphinx {
  accuse: true
  geste: GesteDuSphinx
  /** Une réponse : juste, brûlante — sans coûter d'essai —, fausse, ou la dernière fausse. Le chat : abandon. */
  verdict?: 'juste' | 'brulant' | 'faux' | 'perdu' | 'abandon'
  /** Une réponse déjà donnée : elle ne coûte pas un second essai. */
  dejaDite?: true
  /** Le mot gagné n'était encore à personne. */
  motNeuf?: boolean
  visite: VisiteDuSphinx
  phrase: PhraseDuSphinx | null
}

// Les jokers de l'Expédition (`retours/2026-10-17/expedition.md`, le brief
// validé le 17 octobre 2026) : ce qu'on a gagné sert enfin — chaque
// légendaire devient un joker, qui ne sort jamais de l'expédition (ni
// soirée, ni quiz du jour, ni défi, ni duel : l'invariant 8, « aucun avantage
// de jeu face aux autres »).
//
// Le catalogue et ses règles fixes : quels légendaires gardent un acte — un
// gardien vaincu suit en joker jusqu'au bout, il lui en faut un —, ce que
// fait chaque joker, le paquet de départ, la main, ce qu'une offre propose.
// Ce qu'ils font à une expédition se replie avec elle
// (`pliDeLExpedition`, `shared/expedition.ts`).
//
// Ce fichier n'importe rien : `shared/legendaires.ts` le lit pour poser la
// voie de l'expédition sur les légendaires qui ont leur joker.

/**
 * L'expédition s'ouvre en production avec ses jokers (l'étape 2 du brief) :
 * sans eux, le joueur moyen n'arrivait au bout que quatre fois sur cent, et
 * l'expédition n'était qu'une série en carte ; avec une équipée de deux, une
 * fois sur quatre à une fois sur trois et demie selon qu'il garde ses jokers
 * pour le gardien (`calibrage-expedition.ts`, le 17 octobre 2026). Repassé à
 * `false`, ses routes répondent 404 en production (`server/src/expedition.ts`),
 * l'accueil perd son bouton et sa voie ne se montre plus sur les légendaires
 * (`voiesMontrees`, `shared/legendaires.ts`) ; la préproduction, `npm run dev`
 * et les tests la jouent toujours. Ici, dans le fichier qui n'importe rien :
 * l'album et l'accueil le lisent sans tirer toute l'expédition.
 */
export const EXPEDITION_EN_PRODUCTION = true

/** À jouer sur une question, puis défaussé ; à poser, il agit jusqu'au bout de l'acte ; sur la carte, entre deux escales. */
export type SorteDeJoker = 'jouer' | 'poser' | 'carte'

export interface Joker {
  cle: string
  nom: string
  sorte: SorteDeJoker
  effet: string
  /** Les communs, les rares et les maudits se gagnent aux élites et aux coffres ; celui d'un légendaire vient avec lui. */
  rarete: 'commun' | 'rare' | 'maudit' | 'legendaire'
  /** Le légendaire qui le donne (`lg:phenix`). */
  legendaire?: string
  /** Plus fort, mais il coûte — une vie, un coffre, ta chance sur la carte. */
  maudit?: boolean
  /**
   * La version du départ (`DepartDExpedition.v`) d'où les offres le
   * proposent ; absent : depuis les jokers (2). Une offre se rejoue de la
   * graine à chaque lecture : un joker de plus au catalogue changerait les
   * offres d'une expédition déjà partie, et le joker qu'elle y a pris.
   */
  depuis?: number
}

/**
 * Les jokers des légendaires : vingt et un à la V1, puis la lanterne de la
 * Citrouille et la boule du Sapin avec l'inconnu et les écus (l'étape 4).
 * Les trois autres — la mémoire de l'Éléphant, le public de la Licorne, la
 * vue de l'Aigle — attendent ce qu'ils lisent (une question déjà vue, une
 * foule, une carte qui cache ses escales) : tant qu'un légendaire n'a pas
 * son joker, il n'entre ni dans l'équipée ni parmi les gardiens. Ceux de
 * saison agissent toute l'année : leur saison ne borne que leur conquête.
 * Les Divins n'en ont aucun — un pouvoir en dirait trop sur ce qui les fait
 * descendre (invariant 21).
 */
export const JOKERS_DES_LEGENDAIRES: readonly Joker[] = [
  { cle: 'renaissance', nom: 'Renaissance', legendaire: 'lg:phenix', sorte: 'poser', rarete: 'legendaire', effet: 'Si tu perds ta dernière vie, tu renais avec une.' },
  { cle: 'peau-de-feu', nom: 'Peau de feu', legendaire: 'lg:salamandre', sorte: 'poser', rarete: 'legendaire', effet: 'Sur ta dernière vie, ta première erreur ne te coûte rien.' },
  { cle: 'aube', nom: 'L’aube', legendaire: 'lg:scarabee', sorte: 'poser', rarete: 'legendaire', effet: 'L’acte fini sans erreur depuis qu’il est posé te rend une vie.' },
  { cle: 'reveil', nom: 'Le réveil', legendaire: 'lg:coq', sorte: 'jouer', rarete: 'legendaire', effet: 'Tu reprends une vie, tout de suite.' },
  { cle: 'boucle', nom: 'La boucle', legendaire: 'lg:ouroboros', sorte: 'poser', rarete: 'legendaire', effet: 'Ta prochaine erreur revient à la prochaine escale à question ; retrouvée, elle te rend ta vie.' },
  { cle: 'sagesse', nom: 'Sagesse', legendaire: 'lg:chouette', sorte: 'jouer', rarete: 'legendaire', effet: 'Deux mauvaises réponses s’effacent.' },
  { cle: 'enigme', nom: 'Énigme', legendaire: 'lg:sphinx', sorte: 'jouer', rarete: 'legendaire', effet: 'Le siècle et le domaine de la question.' },
  { cle: 'prediction', nom: 'Prédiction', legendaire: 'lg:oracle', sorte: 'jouer', rarete: 'legendaire', effet: 'Sur une année ou un nombre : tu montres une réponse, il dit « plus haut » ou « plus bas ».' },
  { cle: 'deux-visages', nom: 'Deux visages', legendaire: 'lg:janus', sorte: 'jouer', rarete: 'legendaire', effet: 'Deux questions s’affichent : tu choisis la tienne.' },
  { cle: 'mue', nom: 'La mue', legendaire: 'lg:serpent', sorte: 'jouer', rarete: 'legendaire', effet: 'Une autre question, qui ne te coûte pas de vie si tu la rates.' },
  { cle: 'commandement', nom: 'Commandement', legendaire: 'lg:lion', sorte: 'carte', rarete: 'legendaire', effet: 'Tu choisis la catégorie de l’escale suivante.' },
  { cle: 'elan', nom: 'L’élan', legendaire: 'lg:tigre', sorte: 'poser', rarete: 'legendaire', effet: 'Trois bonnes réponses d’affilée te font tirer un joker de plus.' },
  { cle: 'trois-tetes', nom: 'Trois têtes', legendaire: 'lg:chimere', sorte: 'poser', rarete: 'legendaire', effet: 'Tu tires deux jokers par question, et ta main en tient quatre.' },
  { cle: 'raccourci', nom: 'Le raccourci', legendaire: 'lg:comete', sorte: 'carte', rarete: 'legendaire', effet: 'Tu sautes une escale.' },
  { cle: 'maison', nom: 'Il connaît la maison', legendaire: 'lg:renard', sorte: 'carte', rarete: 'legendaire', effet: 'Une source ou un coffre s’ouvre à l’étage du dessus, relié à toi.' },
  { cle: 'tresor', nom: 'Le trésor', legendaire: 'lg:dragon', sorte: 'poser', rarete: 'legendaire', effet: 'Les coffres t’offrent deux jokers au lieu d’un.' },
  { cle: 'feu-d-artifice', nom: 'Le feu d’artifice', legendaire: 'lg:bouquet', sorte: 'jouer', rarete: 'legendaire', effet: 'Toute ta défausse revient dans ton paquet.' },
  { cle: 'lanterne', nom: 'La lanterne', legendaire: 'lg:citrouille', sorte: 'carte', rarete: 'legendaire', effet: 'Les pièges de l’inconnu se montrent sur la carte, jusqu’au bout de l’acte.' },
  { cle: 'boule', nom: 'Une boule pour chacun', legendaire: 'lg:sapin', sorte: 'carte', rarete: 'legendaire', effet: 'Un coffre de plus s’ouvre à l’étage du dessus, relié à toi.' },
  { cle: 'abysses', nom: 'Remonter des abysses', legendaire: 'lg:kraken', sorte: 'poser', rarete: 'legendaire', maudit: true, effet: 'Sur ta dernière vie, trois bonnes réponses d’affilée en rendent une — mais le poser coûte une vie.' },
  { cle: 'passe-muraille', nom: 'Passe-muraille', legendaire: 'lg:fantome', sorte: 'jouer', rarete: 'legendaire', maudit: true, effet: 'Tu traverses une question sans y répondre — elle part au carnet comme ratée.' },
  { cle: 'horizon', nom: 'L’horizon', legendaire: 'lg:trou-noir', sorte: 'jouer', rarete: 'legendaire', maudit: true, effet: 'Joué après une erreur, il te rend sa vie — et le coffre suivant est vide.' },
  { cle: 'echolocation', nom: 'L’écholocation', legendaire: 'lg:chauve-souris', sorte: 'poser', rarete: 'legendaire', maudit: true, effet: 'Une mauvaise réponse s’efface à chaque question — mais la carte ne dit plus ta chance.' },
]

/**
 * Les jokers sans légendaire : le paquet de départ (Coup d'œil trois fois,
 * Échange) et ce que les élites et les coffres offrent, un au choix parmi
 * trois (étape 2). Arrêt sur image est venu avec le dévoilement (étape 3),
 * Quitte ou double avec les écus (étape 4) : seules les expéditions parties
 * depuis les offrent (`depuis`).
 */
export const JOKERS_SANS_LEGENDAIRE: readonly Joker[] = [
  { cle: 'coup-d-oeil', nom: 'Coup d’œil', sorte: 'jouer', rarete: 'commun', effet: 'Une mauvaise réponse s’efface.' },
  { cle: 'echange', nom: 'Échange', sorte: 'jouer', rarete: 'commun', effet: 'Une autre question, de la même escale.' },
  { cle: 'pioche', nom: 'La pioche', sorte: 'jouer', rarete: 'commun', effet: 'Tu tires deux jokers, pour les questions suivantes : elle prend la place du joker de celle-ci.' },
  { cle: 'detour', nom: 'Le détour', sorte: 'carte', rarete: 'commun', effet: 'Ton pas suivant peut aller à n’importe quelle escale de l’étage du dessus.' },
  { cle: 'arret-sur-image', nom: 'Arrêt sur image', sorte: 'jouer', rarete: 'commun', depuis: 3, effet: 'Sur un dévoilement : le texte s’arrête cinq secondes, et ton gain avec lui.' },
  { cle: 'double-chance', nom: 'Double chance', sorte: 'jouer', rarete: 'rare', effet: 'Deux réponses : il suffit que l’une soit juste.' },
  { cle: 'sursis', nom: 'Sursis', sorte: 'jouer', rarete: 'rare', effet: 'Si tu te trompes, tu ne perds pas de vie.' },
  { cle: 'tout-ou-rien', nom: 'Tout ou rien', sorte: 'jouer', rarete: 'maudit', maudit: true, effet: 'Deux mauvaises réponses s’effacent ; si tu te trompes quand même, deux vies.' },
  { cle: 'quitte-ou-double', nom: 'Quitte ou double', sorte: 'jouer', rarete: 'maudit', maudit: true, depuis: 4, effet: 'Juste, les écus de l’escale triplent ; faux, deux vies.' },
]

/**
 * Les talismans (l'étape 4, la maquette 6) : rares, passifs, jusqu'au bout de
 * l'expédition. Ils changent la route plus que la question : une élite ou un
 * coffre en propose un de temps en temps, l'échoppe en vend un.
 */
export interface Talisman {
  cle: string
  nom: string
  effet: string
}

export const TALISMANS: readonly Talisman[] = [
  { cle: 'loupe', nom: 'La loupe', effet: 'Chaque question d’Histoire dit son siècle.' },
  { cle: 'maillot-jaune', nom: 'Le maillot jaune', effet: 'Le sport paie double écus.' },
  { cle: 'boussole', nom: 'La boussole', effet: 'L’inconnu se dévoile sur la carte : un marchand, un piège, un légendaire de passage.' },
]

const TALISMAN_PAR_CLE = new Map(TALISMANS.map(t => [t.cle, t]))

/** Un talisman par sa clé (`loupe`). */
export function talisman(cle: unknown): Talisman | undefined {
  return typeof cle === 'string' ? TALISMAN_PAR_CLE.get(cle) : undefined
}

const PAR_LEGENDAIRE = new Map(JOKERS_DES_LEGENDAIRES.map(j => [j.legendaire!, j]))
const PAR_CLE = new Map([...JOKERS_DES_LEGENDAIRES, ...JOKERS_SANS_LEGENDAIRE].map(j => [j.cle, j]))

/** Le joker d'un légendaire (`lg:phenix`), s'il en a un. */
export function jokerDuLegendaire(cle: unknown): Joker | undefined {
  return typeof cle === 'string' ? PAR_LEGENDAIRE.get(cle) : undefined
}

/** Un joker par sa clé (`coup-d-oeil`, `renaissance`). */
export function joker(cle: unknown): Joker | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle) : undefined
}

/** Les légendaires qui ont leur joker : eux seuls gardent un acte, et s'emmènent. */
export const LEGENDAIRES_A_JOKER: readonly string[] = JOKERS_DES_LEGENDAIRES.map(j => j.legendaire!)

// ── Les règles du paquet : des choix de produit (`docs/reference/baremes.md`) ──

/** Le paquet de départ, avant l'équipée : Coup d'œil trois fois, Échange (le brief). */
export const PAQUET_DE_DEPART: readonly string[] = ['coup-d-oeil', 'coup-d-oeil', 'coup-d-oeil', 'echange']

/**
 * La main : on tire un joker à chaque question tant qu'elle en tient moins
 * de trois — quatre, et deux tirés par question, sous Trois têtes. Ce qu'on ne
 * joue pas se garde : les maquettes jetaient la main, jouer ne coûtait rien,
 * et l'on jouait tout sans choisir.
 */
export const MAIN_MAX = 3
export const MAIN_MAX_DES_TROIS_TETES = 4

/** L'équipée : deux légendaires qu'on a — ou l'invité du jour —, chacun son joker dans le paquet. */
export const PLACES_DE_L_EQUIPEE = 2

/**
 * Une offre — un coffre, une élite trouvée — propose trois jokers sans
 * légendaire, chacun d'une rareté tirée à ces poids : un maudit sur dix, plus
 * fort mais qui coûte.
 */
export const JOKERS_PAR_OFFRE = 3
export const POIDS_DES_RARETES: Readonly<Record<'commun' | 'rare' | 'maudit', number>> = { commun: 0.6, rare: 0.3, maudit: 0.1 }

/** Combien de mauvaises réponses chaque joker efface. Pas sur un vrai ou faux : il répondrait à la place du joueur. */
export const EFFACE: Readonly<Record<string, number>> = { 'coup-d-oeil': 1, sagesse: 2, 'tout-ou-rien': 2, echolocation: 1 }

/**
 * Les jokers qui aident à trouver : la réponse qu'ils ont touchée ne dit plus
 * le savoir — ni la mesure des difficultés, ni le modèle du savoir, ni les
 * écussons, ni L'Érudit ne la comptent, et, juste, elle ne retrouve rien au
 * carnet (`campagne_reponses.joker`). Une autre question (Échange, la mue)
 * se pose nue ; deux à choisir (Deux visages) ne l'est plus : on prend celle
 * qu'on sait.
 */
export const JOKERS_QUI_AIDENT: ReadonlySet<string> = new Set([
  'coup-d-oeil',
  'sagesse',
  'tout-ou-rien',
  'echolocation',
  'double-chance',
  'enigme',
  'prediction',
  'deux-visages',
  'passe-muraille',
])

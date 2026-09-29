// Les thèmes : ce qui habille le téléphone d'un profil — la soirée, sa page,
// le quiz du jour —, jamais l'écran commun ni les pages de l'animateur. Le
// thème suit la page, pas la personne : l'animateur qui en a gagné un anime
// toujours en Velours ou en Ivoire, et l'invité sans profil joue en Velours.
//
// Deux sont offerts à tous ; les autres s'achètent en confettis, rangés à
// l'échelle de rareté de l'étagère (`shared/badges.ts`), du Commun au
// Légendaire. Ici, la rareté ne se mesure pas : elle se décrète, avec le prix.
// Un cosmétique : aucun ne change un point de quiz (invariant 8). Acheté, un
// thème se garde : une soirée effacée peut faire passer le solde sous zéro,
// elle ne reprend jamais ce qu'il a payé.
//
// L'habillage vit côté client (`client/src/themes/<clé>.css`, chargée à la
// demande) ; ici, le catalogue, les prix, les saisons et la règle des
// confettis, purs et partagés.

import { NOM_RARETE, type Rarete } from './badges'
import { SAISONS, type CleDeSaison } from './saisons'
import { soireeQuiCompte, type GainSoiree, type ReleveSoiree } from './profil'
import { formatNumber } from './typographie'

export type RareteDeTheme = 'offert' | Rarete

/**
 * Le prix de chaque rareté, en confettis. Un habitué — une soirée par mois,
 * le quiz du jour presque chaque jour — en gagne quelque 200 par mois : le
 * premier thème en trois semaines, un Légendaire en cinq mois. Des prix à
 * mesurer sur les vraies données, comme les seuils des légendaires.
 */
export const PRIX_DES_THEMES: Record<RareteDeTheme, number> = {
  offert: 0,
  commune: 150,
  peucommune: 250,
  rare: 400,
  epique: 650,
  legendaire: 1000,
}

export const NOM_DE_RARETE: Record<RareteDeTheme, string> = { offert: 'Offert', ...NOM_RARETE }

/** Les raretés, de l'offert au Légendaire : l'ordre de la boutique. */
export const RARETES_DE_THEME: readonly RareteDeTheme[] = ['offert', 'commune', 'peucommune', 'rare', 'epique', 'legendaire']

/** La période où un thème de saison est en boutique, bornes comprises, en mois et jour de Paris. */
export interface PeriodeDeBoutique {
  debut: [number, number]
  fin: [number, number]
  /** En toutes lettres : « du 25 octobre au 1er novembre ». */
  periode: string
}

export interface Theme {
  key: string
  nom: string
  rarete: RareteDeTheme
  /** Une phrase : ce qu'on voit. */
  humeur: string
  /** Un fond clair : le téléphone l'annonce à son navigateur (`color-scheme`). */
  clair: boolean
  /** En boutique pendant sa saison seulement. Acheté, il se garde toute l'année. */
  saison?: PeriodeDeBoutique
}

/** Les trois saisons des légendaires gardent leurs dates : un Noël, pas deux. */
function saisonDe(cle: CleDeSaison): PeriodeDeBoutique {
  const s = SAISONS.find(x => x.key === cle)!
  return { debut: s.debut, fin: s.fin, periode: s.periode }
}

export const THEMES: readonly Theme[] = [
  { key: 'velours', nom: 'Velours', rarete: 'offert', clair: false, humeur: 'Le noir chaud, le champagne, la serif : l’habillage de toutes les soirées.' },
  { key: 'ivoire', nom: 'Ivoire', rarete: 'offert', clair: true, humeur: 'Le même, sur papier crème, pour qui joue en plein jour.' },
  // ── Commune ──
  { key: 'cahier', nom: 'Cahier d’écolier', rarete: 'commune', clair: true, humeur: 'Le Seyès, la marge rouge, le stylo quatre couleurs : la question s’écrit à la main.' },
  { key: 'carnet', nom: 'Carnet de voyage', rarete: 'commune', clair: true, humeur: 'Papier kraft, tampons, timbre et machine à écrire.' },
  { key: 'guinguette', nom: 'Guinguette', rarete: 'commune', clair: false, humeur: 'Bal du 14 Juillet : la guirlande d’ampoules et le bleu d’une nuit d’été.' },
  { key: 'pyjama', nom: 'Pyjama', rarete: 'commune', clair: false, humeur: 'Nuit douce : la lune, les étoiles, un mouton qui saute la barrière.' },
  { key: 'stade', nom: 'Stade', rarete: 'commune', clair: false, humeur: 'Match en nocturne : la pelouse rayée, les projecteurs, le tableau d’affichage.' },
  // ── Peu commune ──
  { key: 'jungle', nom: 'Jungle', rarete: 'peucommune', clair: false, humeur: 'Le feuillage aux quatre coins, des traces de pattes, la mangue et le toucan.' },
  { key: 'ocean', nom: 'Océan', rarete: 'peucommune', clair: false, humeur: 'Les abysses : les rayons de la surface, les bulles qui montent, le turquoise qui luit.' },
  { key: 'patisserie', nom: 'Pâtisserie', rarete: 'peucommune', clair: true, humeur: 'Salon de thé : crème, framboise, pistache, et des macarons en semis.' },
  { key: 'gameboy', nom: 'Game Boy', rarete: 'peucommune', clair: true, humeur: 'La console de poche : quatre verts, des pixels, rien d’autre.' },
  { key: 'foret', nom: 'Forêt rousse', rarete: 'peucommune', clair: true, humeur: 'Un après-midi d’automne : les feuilles tombent en tournoyant.' },
  {
    key: 'carnaval',
    nom: 'Carnaval',
    rarete: 'peucommune',
    clair: true,
    humeur: 'Fanions, serpentins, et une pluie de confettis.',
    saison: { debut: [2, 1], fin: [2, 29], periode: 'en février' },
  },
  {
    key: 'plage',
    nom: 'Plage',
    rarete: 'peucommune',
    clair: true,
    humeur: 'Le soleil, les vagues qui roulent, le parasol rayé.',
    saison: { debut: [7, 1], fin: [8, 31], periode: 'en juillet et en août' },
  },
  // ── Rare ──
  { key: 'licorne', nom: 'Licorne', rarete: 'rare', clair: true, humeur: 'Pastels irisés, bords holographiques, paillettes qui scintillent.' },
  { key: 'heros', nom: 'Héros', rarete: 'rare', clair: true, humeur: 'Une planche de BD : rayons, trame, cases cernées de noir, la question en bulle.' },
  { key: 'grimoire', nom: 'Grimoire', rarete: 'rare', clair: true, humeur: 'Parchemin, lettrine rouge, volutes et sceau de cire.' },
  { key: 'filmnoir', nom: 'Film noir', rarete: 'rare', clair: false, humeur: 'Noir et blanc, stores vénitiens, la pluie, et une seule couleur : le rouge.' },
  { key: 'disco', nom: 'Disco', rarete: 'rare', clair: false, humeur: 'La boule à facettes, les faisceaux qui tournent, l’or et le rose.' },
  {
    key: 'halloween',
    nom: 'Halloween',
    rarete: 'rare',
    clair: false,
    humeur: 'Un manoir hanté : la citrouille, la lune, la toile d’araignée, les chauves-souris.',
    saison: saisonDe('halloween'),
  },
  {
    key: 'neige',
    nom: 'Neige',
    rarete: 'rare',
    clair: false,
    humeur: 'Nuit d’hiver bleu nuit, la neige qui tombe, des cartes givrées.',
    saison: saisonDe('noel'),
  },
  {
    key: 'cerisiers',
    nom: 'Cerisiers',
    rarete: 'rare',
    clair: true,
    humeur: 'Hanami : la branche en fleurs, les pétales qui tombent.',
    saison: { debut: [4, 1], fin: [4, 30], periode: 'en avril' },
  },
  // ── Épique ──
  { key: 'neon', nom: 'Néon', rarete: 'epique', clair: false, humeur: 'Une borne d’arcade : magenta et cyan, le sol quadrillé, le score en pixels.' },
  { key: 'olympe', nom: 'Olympe', rarete: 'epique', clair: true, humeur: 'Marbre veiné, frise grecque, et le laurier d’or pour la bonne réponse.' },
  { key: 'braises', nom: 'Braises', rarete: 'epique', clair: false, humeur: 'Le Phénix : les étincelles montent, le feu couve au bas de l’écran.' },
  { key: 'cosmos', nom: 'Cosmos', rarete: 'epique', clair: false, humeur: 'Nébuleuses, une planète à anneaux, une étoile filante.' },
  {
    key: 'feudartifice',
    nom: 'Feu d’artifice',
    rarete: 'epique',
    clair: false,
    humeur: 'Minuit : les bouquets éclatent au-dessus de la ville.',
    saison: saisonDe('nouvel-an'),
  },
  // ── Légendaire ──
  { key: 'aurore', nom: 'Aurore boréale', rarete: 'legendaire', clair: false, humeur: 'Les voiles verts et violets ondulent au-dessus des sapins.' },
  { key: 'kintsugi', nom: 'Kintsugi', rarete: 'legendaire', clair: false, humeur: 'Céramique noire, fêlures réparées à l’or.' },
  { key: 'theatre', nom: 'Grand théâtre', rarete: 'legendaire', clair: false, humeur: 'Rideaux de velours, dorures, et le projecteur sur la question.' },
]

const PAR_CLE = new Map(THEMES.map(t => [t.key, t]))

export function theme(key: unknown): Theme | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

/** Ceux que tout profil a, sans rien payer. */
export const THEMES_OFFERTS: readonly string[] = THEMES.filter(t => t.rarete === 'offert').map(t => t.key)

export function prixDe(t: Theme): number {
  return PRIX_DES_THEMES[t.rarete]
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/**
 * Quand un thème de saison revient en boutique : « dès le 25 octobre », « dès
 * le 1er février ». La période entière ne tenait pas dans une case.
 */
export function retourEnBoutique(t: Theme): string | null {
  if (!t.saison) return null
  const [mois, jour] = t.saison.debut
  return `dès le ${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]}`
}

/**
 * Est-il en boutique ce jour-là (`AAAA-MM-JJ`, à Paris) ? Toute l'année, ou
 * pendant sa saison — le Nouvel An enjambe l'année : du 30 décembre au 2
 * janvier.
 */
export function enBoutique(t: Theme, jour: string): boolean {
  if (!t.saison) return true
  const quand = Number(jour.slice(5, 7)) * 100 + Number(jour.slice(8, 10))
  const debut = t.saison.debut[0] * 100 + t.saison.debut[1]
  const fin = t.saison.fin[0] * 100 + t.saison.fin[1]
  return debut <= fin ? quand >= debut && quand <= fin : quand >= debut || quand <= fin
}

// ── Les confettis ─────────────────────────────────────────────────────────

/**
 * Les confettis d'une soirée : une bonne réponse, un confetti. Les questions
 * à choix justes — « plusieurs » et « ordre » compris, jugées en tout ou
 * rien —, et les estimations parmi les plus proches de la salle, puisqu'une
 * estimation n'est jamais « juste ». « Qui dans la salle ? » n'entre pas au
 * journal : il ne rapporte rien.
 *
 * Seulement une soirée qui compte (`soireeQuiCompte`) : seul devant son
 * propre quiz, on connaît les réponses, et deux cents questions lancées pour
 * soi auraient rempli la tirelire. La campagne en solo aura sa règle.
 *
 * Ni la rapidité ni le multiplicateur de l'animateur n'y changent rien : une
 * finale « ×3 » payait trois fois plus de points à ceux qui étaient là ce
 * soir-là, et un téléphone lent perdait son bonus de rapidité.
 */
export function confettisDeSoiree(gain: GainSoiree, releve: ReleveSoiree): number {
  return soireeQuiCompte(gain) ? releve.justes + releve.estimationsProches : 0
}

/** Ce qu'un profil a gagné, dépensé, et ce qu'il lui reste — qui peut être négatif. */
export interface SoldeDeConfettis {
  gagnes: number
  depenses: number
  solde: number
}

/** Ce que sa boutique lui montre : son solde, ce qu'il a, ce qu'il porte. */
export interface BoutiqueDuProfil {
  confettis: SoldeDeConfettis
  /** Les thèmes qu'il a — les offerts compris —, dans l'ordre du catalogue. */
  possedes: string[]
  /** Le thème qu'il porte ; null : Velours. */
  porte: string | null
  /** Le jour de la boutique (Paris) : les thèmes de saison se lisent dessus. */
  jour: string
}

/**
 * Ce que ses confettis lui ouvrent ce jour-là : combien de thèmes qui lui
 * manquent sont déjà à sa portée, et le prochain qu'il vise — le moins cher
 * de ceux que son solde ne paie pas encore. Le chiffre seul ne disait pas à
 * quoi il sert.
 */
export function ceQueDonnentLesConfettis(
  possedes: readonly string[],
  solde: number,
  jour: string,
): { abordables: number; vise: { theme: string; manque: number } | null } {
  const manquants = THEMES.filter(t => t.rarete !== 'offert' && !possedes.includes(t.key) && enBoutique(t, jour))
  const audela = manquants.filter(t => prixDe(t) > solde)
  // Le moins cher d'abord ; à prix égal, l'ordre du catalogue.
  const vise = audela.reduce<Theme | null>((m, t) => (!m || prixDe(t) < prixDe(m) ? t : m), null)
  return {
    abordables: manquants.length - audela.length,
    vise: vise && { theme: vise.key, manque: prixDe(vise) - solde },
  }
}

/** « 1 confetti », « 12 confettis » — et « 0 confetti », comme on le dit. */
export const nConfettis = (n: number) => `${formatNumber(n)} confetti${Math.abs(n) >= 2 ? 's' : ''}`

/**
 * La phrase qui dit à quoi servent ses confettis, sous ceux de ce soir : son
 * solde, ce qui est déjà à sa portée, le prochain thème qu'il vise.
 */
export function phraseDesConfettis(c: Pick<ConfettisDeLaFin, 'solde' | 'abordables' | 'vise'>): string {
  const vise = c.vise && theme(c.vise.theme)
  const suite = vise ? `plus que ${formatNumber(c.vise!.manque)} pour le thème ${vise.nom}` : null
  if (c.abordables > 0) {
    const portee = `${c.abordables} thème${c.abordables > 1 ? 's' : ''} à ta portée`
    return suite ? `Tu en as ${formatNumber(c.solde)} : ${portee}, et ${suite}.` : `Tu en as ${formatNumber(c.solde)} : toute la boutique est à ta portée.`
  }
  return suite
    ? `Une bonne réponse, un confetti. Tu en as ${formatNumber(c.solde)} : ${suite}.`
    : `Une bonne réponse, un confetti. Tu en as ${formatNumber(c.solde)}.`
}

/** Ce que la fin d'une soirée dit de ses confettis. */
export interface ConfettisDeLaFin {
  /** Ceux de ce soir. */
  gagnes: number
  /** Son solde, ceux de ce soir compris. */
  solde: number
  /** Les thèmes qui lui manquent et que son solde paie déjà. */
  abordables: number
  /** Le prochain qu'il vise, et ce qu'il lui manque. */
  vise: { theme: string; manque: number } | null
}

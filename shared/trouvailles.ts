// Les trouvailles de son compagnon, et son jardin (la maquette validée par le
// propriétaire le 20 octobre 2026, `retours/2026-10-20/mon-compagnon/`).
//
// Ses trois envies du jour comblées, il rapporte un cadeau : une trouvaille,
// tirée à sa rareté (`tirerUneTrouvaille`) — tous les sept jours de
// complicité, un grand cadeau, rare ou épique (`shared/soins.ts`). Trente en
// tout, cinq raretés ; les deux légendaires ne se tirent jamais, un exploit
// chacune les donne. Les doubles existent (« Est-ce qu'on accepte les
// doubles ? — Oui », le propriétaire) : deux lanternes, ce sont deux
// lanternes à poser. Elles sont au profil, pour tous ses compagnons ; chaque
// compagnon a son jardin, autour de sa niche, où il en pose autant qu'il en a.
// Le jardin grandit avec la complicité : le petit coin, la cour, le jardin,
// le domaine — de trois à dix places.
//
// Rien ici ne donne d'avantage de jeu (invariant 8) : ni confettis, ni
// expérience, et elles ne se voient que chez lui. Pur : le client, le
// serveur et les tests le lisent ; leurs dessins vivent côté client
// (`components/Trouvaille.tsx`).

import type { Rarete } from './badges'

/** Où une trouvaille se pose : un grand objet sur une grande place, un petit partout au sol, ce qui vole dans son ciel. */
export type SorteDeTrouvaille = 'haut' | 'bas' | 'ciel'

/** Les deux exploits du jardin : chacun donne sa légendaire, jamais le hasard. */
export type ExploitDuJardin = 'cent-jours' | 'trois-etoiles'

export interface Trouvaille {
  cle: string
  nom: string
  rarete: Rarete
  sorte: SorteDeTrouvaille
  /** Une légendaire : l'exploit qui la donne. */
  exploit?: ExploitDuJardin
}

export const TROUVAILLES: readonly Trouvaille[] = [
  { cle: 'gamelle', nom: 'La gamelle étoilée', rarete: 'commune', sorte: 'bas' },
  { cle: 'boite', nom: 'La boîte aux lettres', rarete: 'commune', sorte: 'haut' },
  { cle: 'coussin', nom: 'Le coussin moelleux', rarete: 'commune', sorte: 'bas' },
  { cle: 'pelote', nom: 'La pelote de laine', rarete: 'commune', sorte: 'bas' },
  { cle: 'fanions', nom: 'Les fanions de fête', rarete: 'commune', sorte: 'ciel' },
  { cle: 'ballons', nom: 'Les ballons', rarete: 'commune', sorte: 'ciel' },
  { cle: 'seau', nom: 'Le seau de fleurs', rarete: 'commune', sorte: 'bas' },
  { cle: 'buches', nom: 'Le tas de bûches', rarete: 'commune', sorte: 'bas' },
  { cle: 'balle', nom: 'La balle rebondissante', rarete: 'commune', sorte: 'bas' },
  { cle: 'paillasson', nom: 'Le paillasson', rarete: 'commune', sorte: 'bas' },
  { cle: 'bouleau', nom: 'Le petit bouleau', rarete: 'peucommune', sorte: 'haut' },
  { cle: 'cerfvolant', nom: 'Le cerf-volant', rarete: 'peucommune', sorte: 'ciel' },
  { cle: 'carillon', nom: 'Le carillon à vent', rarete: 'peucommune', sorte: 'ciel' },
  { cle: 'brouette', nom: 'La brouette fleurie', rarete: 'peucommune', sorte: 'bas' },
  { cle: 'panneau', nom: 'Le panneau à son nom', rarete: 'peucommune', sorte: 'haut' },
  { cle: 'nichoir', nom: 'La cabane à oiseaux', rarete: 'peucommune', sorte: 'haut' },
  { cle: 'tapis', nom: 'Le tapis tressé', rarete: 'peucommune', sorte: 'bas' },
  { cle: 'tournesols', nom: 'Les tournesols', rarete: 'peucommune', sorte: 'haut' },
  { cle: 'lanterne', nom: 'La lanterne de papier', rarete: 'rare', sorte: 'haut' },
  { cle: 'champignons', nom: 'Les champignons lumineux', rarete: 'rare', sorte: 'bas' },
  { cle: 'feu', nom: 'Le feu de camp', rarete: 'rare', sorte: 'bas' },
  { cle: 'lampadaire', nom: 'Le lampadaire à lucioles', rarete: 'rare', sorte: 'haut' },
  { cle: 'lune', nom: 'La lune en papier', rarete: 'rare', sorte: 'ciel' },
  { cle: 'hamac', nom: 'Le hamac', rarete: 'rare', sorte: 'haut' },
  { cle: 'cerisier', nom: 'Le cerisier en fleurs', rarete: 'epique', sorte: 'haut' },
  { cle: 'bassin', nom: 'Le bassin aux nénuphars', rarete: 'epique', sorte: 'bas' },
  { cle: 'arcenciel', nom: 'L’arc-en-ciel', rarete: 'epique', sorte: 'ciel' },
  { cle: 'cabane', nom: 'La cabane perchée', rarete: 'epique', sorte: 'haut' },
  { cle: 'fontaine', nom: 'La fontaine aux étoiles', rarete: 'legendaire', sorte: 'haut', exploit: 'cent-jours' },
  { cle: 'etoile', nom: 'L’étoile filante apprivoisée', rarete: 'legendaire', sorte: 'ciel', exploit: 'trois-etoiles' },
]

const PAR_CLE: ReadonlyMap<string, Trouvaille> = new Map(TROUVAILLES.map(t => [t.cle, t]))

export function trouvailleDe(cle: string): Trouvaille | null {
  return PAR_CLE.get(cle) ?? null
}

/** Les raretés du jardin, de la plus courante à la plus rare : l'ordre de son éditeur. */
export const RARETES_DES_TROUVAILLES: readonly Rarete[] = ['commune', 'peucommune', 'rare', 'epique', 'legendaire']

/**
 * Ce qu'il faut à chaque exploit : un choix de produit
 * (`docs/reference/baremes.md`). Cent jours de complicité avec un même
 * compagnon — la fontaine ; dix cueillettes à trois étoiles, avec
 * n'importe lequel — l'étoile filante.
 */
export const EXPLOITS_DU_JARDIN: Readonly<Record<ExploitDuJardin, { seuil: number; texte: string }>> = {
  'cent-jours': { seuil: 100, texte: 'cent jours de complicité' },
  'trois-etoiles': { seuil: 10, texte: 'trois étoiles à la cueillette, dix fois' },
}

/** Les exploits atteints : la complicité de chacun de ses compagnons, ses cueillettes à trois étoiles. */
export function exploitsAtteints(complicites: readonly number[], troisEtoiles: number): Set<ExploitDuJardin> {
  const faits = new Set<ExploitDuJardin>()
  if (complicites.some(n => n >= EXPLOITS_DU_JARDIN['cent-jours'].seuil)) faits.add('cent-jours')
  if (troisEtoiles >= EXPLOITS_DU_JARDIN['trois-etoiles'].seuil) faits.add('trois-etoiles')
  return faits
}

/**
 * Ses trouvailles, comptées : chaque cadeau ouvert en donne une, chaque
 * exploit atteint sa légendaire. Relu des journaux à chaque lecture — rien
 * ne se compte à côté, et rien ne se perd : les cadeaux et les cueillettes
 * ne font que s'ajouter.
 */
export function inventaire(objetsDesCadeaux: readonly string[], exploits: ReadonlySet<ExploitDuJardin>): Record<string, number> {
  const siennes: Record<string, number> = {}
  for (const cle of objetsDesCadeaux) if (PAR_CLE.has(cle)) siennes[cle] = (siennes[cle] ?? 0) + 1
  for (const t of TROUVAILLES) if (t.exploit && exploits.has(t.exploit)) siennes[t.cle] = (siennes[t.cle] ?? 0) + 1
  return siennes
}

// ── Le tirage du cadeau ─────────────────────────────────────────────────────

/**
 * Les chances de chaque rareté, en pour cent : un choix de produit
 * (`docs/reference/baremes.md`). Le cadeau du jour : surtout des communes,
 * parfois une peu commune, rarement une rare ; le grand cadeau, tous les
 * sept jours de complicité : une rare ou une épique. Jamais de légendaire.
 */
export const CHANCES_DU_CADEAU: Readonly<Record<'jour' | 'grand', Readonly<Partial<Record<Rarete, number>>>>> = {
  jour: { commune: 70, peucommune: 25, rare: 5 },
  grand: { rare: 70, epique: 30 },
}

/**
 * Une trouvaille qu'il n'a pas encore pèse trois fois une qu'il a déjà, dans
 * sa rareté : la collection avance, et les doubles viennent quand même — un
 * choix de produit.
 */
export const POIDS_D_UNE_NEUVE = 3

/** Tire la trouvaille d'un cadeau : une rareté à ses chances, puis l'une de ses trouvailles, les neuves d'abord. */
export function tirerUneTrouvaille(grand: boolean, siennes: Readonly<Record<string, number>>, aleatoire: () => number): string {
  const chances = Object.entries(CHANCES_DU_CADEAU[grand ? 'grand' : 'jour']) as [Rarete, number][]
  let x = aleatoire() * chances.reduce((somme, [, c]) => somme + c, 0)
  let rarete = chances[chances.length - 1][0]
  for (const [r, c] of chances) {
    if (x < c) {
      rarete = r
      break
    }
    x -= c
  }
  const candidates = TROUVAILLES.filter(t => t.rarete === rarete && !t.exploit)
  const poids = candidates.map(t => ((siennes[t.cle] ?? 0) > 0 ? 1 : POIDS_D_UNE_NEUVE))
  let y = aleatoire() * poids.reduce((a, b) => a + b, 0)
  for (let i = 0; i < candidates.length; i++) {
    if (y < poids[i]) return candidates[i].cle
    y -= poids[i]
  }
  return candidates[candidates.length - 1].cle
}

// ── Son jardin : le terrain et ses places ───────────────────────────────────

export interface Terrain {
  nom: string
  /** Ses places, toutes sortes comprises. */
  places: number
  /** Les jours de complicité qui l'ouvrent. */
  jours: number
}

/**
 * Le terrain grandit avec la complicité, et ne rapetisse jamais : la
 * complicité ne fait que monter. Un choix de produit
 * (`docs/reference/baremes.md`).
 */
export const TERRAINS: readonly Terrain[] = [
  { nom: 'Le petit coin', places: 3, jours: 0 },
  { nom: 'La cour', places: 5, jours: 7 },
  { nom: 'Le jardin', places: 7, jours: 25 },
  { nom: 'Le domaine', places: 10, jours: 60 },
]

/** Le terrain ouvert à cette complicité, en rang dans `TERRAINS`. */
export function niveauDuTerrain(complicite: number): number {
  let niveau = 0
  TERRAINS.forEach((t, i) => {
    if (complicite >= t.jours) niveau = i
  })
  return niveau
}

/**
 * Les dix places du jardin, chacune sa sorte et le terrain qui l'ouvre. Où
 * elles sont dans la scène se lit côté client (`components/jardin.ts`) : la
 * cour autour de la niche, le jardin qui s'étend à droite, le domaine à
 * gauche.
 */
export const PLACES_DU_JARDIN: Readonly<Record<string, { sorte: SorteDeTrouvaille; terrain: number }>> = {
  s1: { sorte: 'haut', terrain: 1 },
  s2: { sorte: 'bas', terrain: 0 },
  s3: { sorte: 'bas', terrain: 0 },
  s4: { sorte: 'haut', terrain: 1 },
  s5: { sorte: 'ciel', terrain: 0 },
  s6: { sorte: 'haut', terrain: 2 },
  s7: { sorte: 'bas', terrain: 2 },
  s8: { sorte: 'haut', terrain: 3 },
  s9: { sorte: 'bas', terrain: 3 },
  s10: { sorte: 'ciel', terrain: 3 },
}

/** Les places ouvertes à ce terrain. */
export function placesOuvertes(niveau: number): string[] {
  return Object.keys(PLACES_DU_JARDIN).filter(p => PLACES_DU_JARDIN[p].terrain <= niveau)
}

/** Ce qui vole va dans son ciel, un grand objet sur une grande place, un petit partout au sol. */
export function vaDans(t: Trouvaille, place: string): boolean {
  const p = PLACES_DU_JARDIN[place]
  if (!p) return false
  if (t.sorte === 'ciel') return p.sorte === 'ciel'
  if (t.sorte === 'haut') return p.sorte === 'haut'
  return p.sorte !== 'ciel'
}

/**
 * Son jardin tel que le téléphone l'envoie, vérifié : chaque place ouverte à
 * son terrain, chaque trouvaille à sa place et à lui — autant de fois posée
 * qu'il en a. Lève une erreur lisible (une 400) au premier refus.
 */
export function verifierLeJardin(brut: unknown, niveau: number, siennes: Readonly<Record<string, number>>): Record<string, string> {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) throw new Error('Ce jardin ne se lit pas : recharge la page.')
  const ouvertes = new Set(placesOuvertes(niveau))
  const jardin: Record<string, string> = {}
  const posees: Record<string, number> = {}
  for (const [place, cle] of Object.entries(brut as Record<string, unknown>)) {
    if (cle === null || cle === undefined) continue
    if (!PLACES_DU_JARDIN[place]) throw new Error('Cette place n’existe pas : recharge la page.')
    if (!ouvertes.has(place)) throw new Error('Cette place n’est pas encore à lui : son jardin grandit avec votre complicité.')
    const t = typeof cle === 'string' ? trouvailleDe(cle) : null
    if (!t) throw new Error('Cette trouvaille n’existe pas : recharge la page.')
    if (!vaDans(t, place)) throw new Error(t.sorte === 'ciel' ? 'Ce qui vole va dans son ciel : choisis une place du ciel.' : t.sorte === 'haut' ? 'Un grand objet demande une grande place.' : 'Ce qui se pose au sol ne va pas dans son ciel.')
    if (!siennes[t.cle]) throw new Error(`Pas encore dans tes trouvailles : ${t.nom.charAt(0).toLowerCase()}${t.nom.slice(1)}.`)
    posees[t.cle] = (posees[t.cle] ?? 0) + 1
    if (posees[t.cle] > siennes[t.cle]) throw new Error(`${t.nom} : tu n’en as pas d’autre à poser.`)
    jardin[place] = t.cle
  }
  return jardin
}

/**
 * Son jardin relu à sa complicité d'aujourd'hui : ce qu'une place fermée ou
 * une trouvaille qu'il n'a plus porterait ne se montre pas. Rien de tel
 * n'arrive aujourd'hui — la complicité et les trouvailles ne font que
 * monter —, mais un jardin écrit se relit des mois plus tard.
 */
export function jardinMontre(jardin: Readonly<Record<string, string>>, niveau: number, siennes: Readonly<Record<string, number>>): Record<string, string> {
  const ouvertes = new Set(placesOuvertes(niveau))
  const posees: Record<string, number> = {}
  const montre: Record<string, string> = {}
  for (const [place, cle] of Object.entries(jardin)) {
    const t = trouvailleDe(cle)
    if (!t || !ouvertes.has(place) || !vaDans(t, place)) continue
    posees[cle] = (posees[cle] ?? 0) + 1
    if (posees[cle] > (siennes[cle] ?? 0)) continue
    montre[place] = cle
  }
  return montre
}

/**
 * La première place libre où poser une trouvaille neuve, dans l'ordre de ses
 * places — celles de la cour d'abord, près de la niche : « La poser dans son
 * jardin », au cadeau ouvert. Null quand il n'y a plus de place pour elle.
 */
export function placeLibre(jardin: Readonly<Record<string, string>>, niveau: number, cle: string): string | null {
  const t = trouvailleDe(cle)
  if (!t) return null
  return placesOuvertes(niveau).find(p => !jardin[p] && vaDans(t, p)) ?? null
}

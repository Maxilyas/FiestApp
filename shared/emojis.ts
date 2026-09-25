// Les emojis que l'écran commun ne sait pas dessiner.
//
// L'écran commun tourne sous Windows 10, qui affiche les emojis d'Unicode 13
// et au-delà en carré vide — devant toute la salle. Le dépôt s'en garde
// (`server/test/emojis.test.ts`) ; les animateurs, eux, écrivent leurs quiz
// avec le clavier de leur téléphone, où ces emojis sont partout : un 🫠 tapé
// dans un intitulé passait sans un mot. L'éditeur et la liste collée les
// signalent maintenant, avec la règle même de la garde.
//
// Les séquences récentes s'écrivent ici en points de code échappés : en
// clair, elles seraient elles-mêmes des emojis récents dans `shared/`, que la
// garde du dépôt relit.

// Les points de code d'Emoji 13.0 et au-delà (emoji-data.txt d'Unicode). Le
// moteur d'expressions de Node connaît tous les emojis, mais pas l'année de
// chacun. Le bloc « Symbols and Pictographs Extended-A » (1FA70–1FAFF) ne
// porte que du récent, sauf les quinze points d'Emoji 12 : on le prend
// entier, moins ceux-là — une table point par point oubliait U+1FA8E (Emoji 17).
const EMOJI_12_DU_BLOC: [number, number][] = [
  [0x1fa70, 0x1fa73], [0x1fa78, 0x1fa7a], [0x1fa80, 0x1fa82], [0x1fa90, 0x1fa95],
]
const RECENTS_HORS_BLOC: [number, number][] = [
  // Emoji 13.0
  [0x1f6d6, 0x1f6d7], [0x1f6fb, 0x1f6fc], [0x1f90c, 0x1f90c], [0x1f972, 0x1f972], [0x1f977, 0x1f978],
  [0x1f9a3, 0x1f9a4], [0x1f9ab, 0x1f9ad], [0x1f9cb, 0x1f9cb], [0x26a7, 0x26a7],
  // Emoji 14.0 et suivants (U+1F6D8, l'éboulement, est d'Emoji 17)
  [0x1f6d8, 0x1f6d8], [0x1f6dc, 0x1f6df], [0x1f7f0, 0x1f7f0], [0x1f979, 0x1f979], [0x1f9cc, 0x1f9cc],
]

function pointRecent(p: number): boolean {
  if (p >= 0x1fa70 && p <= 0x1faff) return !EMOJI_12_DU_BLOC.some(([a, b]) => p >= a && p <= b)
  return RECENTS_HORS_BLOC.some(([a, b]) => p >= a && p <= b)
}

// Des séquences d'Emoji 13.0 à 15.1 faites de points de code anciens : un
// ours et un flocon, séparés par un liant, font un carré vide sous Windows 10.
// Écrites sans variante (FE0F) ni couleur de peau, retirées aussi de l'emoji
// avant de comparer : une mariée à la peau mate est une mariée comme une autre.
const SEQUENCES_RECENTES = [
  // 13.0 : ours polaire, chat noir, père Noël, biberons, drapeau, mariées et mariés
  '\u{1F43B}\u{200D}\u{2744}',
  '\u{1F408}\u{200D}\u{2B1B}',
  '\u{1F9D1}\u{200D}\u{1F384}',
  '\u{1F469}\u{200D}\u{1F37C}',
  '\u{1F468}\u{200D}\u{1F37C}',
  '\u{1F9D1}\u{200D}\u{1F37C}',
  '\u{1F3F3}\u{200D}\u{26A7}',
  '\u{1F470}\u{200D}\u{2640}',
  '\u{1F470}\u{200D}\u{2642}',
  '\u{1F935}\u{200D}\u{2640}',
  '\u{1F935}\u{200D}\u{2642}',
  // 13.1 : cœur en feu, cœur pansé, soupir, vertige, visage dans les nuages, barbus
  '\u{2764}\u{200D}\u{1F525}',
  '\u{2764}\u{200D}\u{1FA79}',
  '\u{1F62E}\u{200D}\u{1F4A8}',
  '\u{1F635}\u{200D}\u{1F4AB}',
  '\u{1F636}\u{200D}\u{1F32B}',
  '\u{1F9D4}\u{200D}\u{2640}',
  '\u{1F9D4}\u{200D}\u{2642}',
  // 15.0 et 15.1 : oiseau noir, phénix, citron vert, champignon, chaîne brisée, têtes, familles
  '\u{1F426}\u{200D}\u{2B1B}',
  '\u{1F426}\u{200D}\u{1F525}',
  '\u{1F34B}\u{200D}\u{1F7E9}',
  '\u{1F344}\u{200D}\u{1F7EB}',
  '\u{26D3}\u{200D}\u{1F4A5}',
  '\u{1F642}\u{200D}\u{2194}',
  '\u{1F642}\u{200D}\u{2195}',
  '\u{1F9D1}\u{200D}\u{1F9D1}\u{200D}\u{1F9D2}',
  '\u{1F9D1}\u{200D}\u{1F9D2}',
  // 15.1 : toute personne tournée vers la droite
  '\u{200D}\u{27A1}',
]
const VARIANTE = /\u{FE0F}/gu
const PEAU = /[\u{1F3FB}-\u{1F3FF}]/u
const PEAUX = /[\u{1F3FB}-\u{1F3FF}]/gu
/** Les couples, qui ne prennent une couleur de peau que depuis Emoji 13.1. */
const COUPLE = /[\u{1F48F}\u{1F491}\u{2764}]/u

/** Un emoji, liants et variantes compris : l'unité que l'écran dessine d'un coup. */
export const EMOJI =
  /\p{Extended_Pictographic}(?:\u{FE0F}|\p{Emoji_Modifier})*(?:\u{200D}(?:\p{Extended_Pictographic}|\u{27A1})(?:\u{FE0F}|\p{Emoji_Modifier})*)*/gu

/** Un emoji qui s'afficherait en carré vide sous Windows 10. */
export function estRecent(e: string): boolean {
  if ([...e].some(c => pointRecent(c.codePointAt(0)!))) return true
  // Les couples à couleurs de peau sont d'Emoji 13.1 ; sans couleur, ils sont
  // bien plus anciens.
  if (PEAU.test(e) && COUPLE.test(e)) return true
  const nu = e.replace(VARIANTE, '').replace(PEAUX, '')
  return SEQUENCES_RECENTES.some(s => nu.includes(s))
}

/** Les emojis récents d'un texte, chacun une fois, dans l'ordre où ils paraissent. */
export function emojisRecents(...textes: (string | null | undefined)[]): string[] {
  const vus: string[] = []
  for (const texte of textes) {
    if (!texte) continue
    for (const m of texte.matchAll(EMOJI)) if (estRecent(m[0]) && !vus.includes(m[0])) vus.push(m[0])
  }
  return vus
}

/** Ce que l'éditeur dit d'emojis récents, ou null. */
export function avisEmojis(recents: readonly string[]): string | null {
  if (recents.length === 0) return null
  return recents.length === 1
    ? `${recents[0]} s’affichera en carré vide sur l’écran commun (Windows 10) : choisis un emoji plus courant`
    : `${recents.join(' ')} s’afficheront en carrés vides sur l’écran commun (Windows 10) : choisis des emojis plus courants`
}

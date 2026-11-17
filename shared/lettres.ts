// La forme à composer (l'étape 3 de « La question au centre », le 19 octobre
// 2026, née avec l'Expédition) : la réponse se compose lettre à lettre, sans
// ses choix. « Soit un indice, soit ça te donne des lettres présentes dans la
// réponse […] comme un pendu » (un testeur, le même jour). Le brief :
// `retours/2026-10-19/les-coups-de-pouce.md`.
//
// Ici, ce qui ne dépend que du texte d'une réponse : si elle se compose, ses
// cases, ses lettres, ce qu'on en a composé. Le Mot mystère du Cabinet le
// lit. Le 16 novembre 2026, les tuiles et la lecture d'une composition
// envoyée (`tuilesDe`, `lireUneComposition`), que seule l'Expédition appelait,
// sont parties avec elle : plus aucun lecteur que leurs épreuves.

/**
 * Une réponse de deux mots au plus, de quatre à douze lettres (le choix du
 * propriétaire du 19 octobre 2026 : « Victor Hugo », « Mont Blanc ») : six
 * questions sur dix de la base s'y prêtent, quand un seul mot de dix lettres
 * au plus — la recommandation d'alors — n'en laissait qu'une sur quatre. Des
 * choix de produit.
 */
export const MOTS_A_COMPOSER = 2
export const LETTRES_A_COMPOSER_MIN = 4
export const LETTRES_A_COMPOSER_MAX = 12

/** Une case de la réponse : une lettre à poser (null), ou un signe posé d'office — le trait d'union, l'apostrophe. */
export type CaseAComposer = string | null

/** Ce qu'une réponse est, à composer. */
export interface GabaritAComposer {
  /** L'article qu'elle écrit en tête, posé d'office devant les cases — « La », « L’ » : on compose le mot, pas l'article. */
  article?: string
  /** Ses mots, case par case. */
  mots: CaseAComposer[][]
  /** Ses lettres, dans l'ordre des cases : en capitales, sans accents — « Œ » en fait deux. Ce qu'il faut composer. */
  lettres: string
}

/** Un article en tête de réponse : « La cochenille », « L’Odyssée ». Il ne se compose pas — il se pose d'office, s'il reste un mot derrière lui. */
const ARTICLE = /^(?:(?:les|le|la|une|un|des)\s+(?=\S)|l['’](?=\p{L}))/iu

/** Les signes qui restent dans un mot, posés d'office : le trait d'union, l'apostrophe. */
const SIGNES = new Set(['-', '\'', '’'])

/**
 * Un texte en capitales sans accents — « é » est un E, « œ » deux lettres —,
 * le reste tel quel. Une seule règle pour la réponse à composer et pour ce
 * qu'on cherche dans un intitulé (le Mot mystère du Cabinet : l'intitulé dit-il
 * le mot ?) : deux copies, et un intitulé qui souffle le mot passerait.
 */
export function capitalesSansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/Œ/g, 'OE').replace(/Æ/g, 'AE')
}

/** Une lettre, en capitale et sans accent ; null : ce n'est pas une lettre de l'alphabet. */
function enCapitales(signe: string): string | null {
  const x = capitalesSansAccents(signe)
  return /^[A-Z]+$/.test(x) ? x : null
}

/** L'article d'une réponse et ce qui le suit ; sans article, la réponse entière. */
export function sonArticle(reponse: string): { article?: string; reste: string } {
  const texte = reponse.normalize('NFC').trim().replace(/\s+/g, ' ')
  const a = ARTICLE.exec(texte)
  if (!a) return { reste: texte }
  // L'apostrophe de l'écran, comme partout dans l'application.
  return { article: a[0].trim().replace('\'', '’'), reste: texte.slice(a[0].length) }
}

/**
 * Ce qu'une réponse est, à composer — null : elle ne se compose pas. Deux mots
 * au plus après son article, de `LETTRES_A_COMPOSER_MIN` à
 * `LETTRES_A_COMPOSER_MAX` lettres, rien que des lettres, et le trait d'union
 * ou l'apostrophe entre deux d'entre elles (« Saint-Exupéry », « Aujourd’hui ») :
 * ni chiffre, ni ponctuation.
 */
export function gabaritDe(reponse: string): GabaritAComposer | null {
  const { article, reste } = sonArticle(reponse)
  const mots = reste.split(' ').filter(Boolean)
  if (mots.length === 0 || mots.length > MOTS_A_COMPOSER) return null
  let lettres = ''
  const cases: CaseAComposer[][] = []
  for (const mot of mots) {
    const siennes: CaseAComposer[] = []
    for (const signe of mot) {
      if (SIGNES.has(signe)) {
        // En tête, au bout, ou deux de suite : ce n'est plus un mot qui se compose.
        if (siennes.length === 0 || siennes[siennes.length - 1] !== null) return null
        siennes.push(signe === '-' ? '-' : '’')
        continue
      }
      const capitales = enCapitales(signe)
      if (!capitales) return null
      for (const l of capitales) {
        siennes.push(null)
        lettres += l
      }
    }
    if (siennes[siennes.length - 1] !== null) return null
    cases.push(siennes)
  }
  if (lettres.length < LETTRES_A_COMPOSER_MIN || lettres.length > LETTRES_A_COMPOSER_MAX) return null
  return { ...(article && { article }), mots: cases, lettres }
}

/**
 * Un intitulé qui parle de ses choix — « Laquelle de ces villes », « Parmi les
 * suivants », « l'intrus » — ne se pose pas sans eux : on ne compose pas ce
 * qu'on aurait dû choisir. Une centaine dans la base, quelques-unes de trop
 * (« ces Romains ! ») : mieux vaut écarter une question qu'en poser une
 * impossible.
 */
const PARLE_DE_SES_CHOIX = /(?<!\p{L})(?:ces|parmi|suivante?s?|intrus|ci-dessous|celles?-ci|ceux-ci|propos[ée]es?|propositions?)(?!\p{L})/iu

/** Une question de la base se pose-t-elle à composer ? Des choix — un vrai ou faux n'a rien à composer —, une bonne réponse qui se compose, un intitulé qui ne parle pas de ses choix. */
export function seCompose(q: { texte: string; reponses: readonly string[]; bonne: number }): boolean {
  return q.reponses.length > 2 && gabaritDe(q.reponses[q.bonne] ?? '') !== null && !PARLE_DE_SES_CHOIX.test(q.texte)
}

/** Ce qu'il a composé, dans ses cases — ses mots séparés, ses signes à leur place : « VICTOR HUGO », « SAINT-EXUPERY ». */
export function compositionDite(mots: readonly (readonly CaseAComposer[])[], lettres: string): string {
  let k = 0
  return mots.map(mot => mot.map(c => (c === null ? (lettres[k++] ?? '') : c)).join('')).join(' ')
}

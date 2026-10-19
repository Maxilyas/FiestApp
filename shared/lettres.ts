// La forme à composer (l'étape 3 de « La question au centre », le 19 octobre
// 2026) : la question sans ses choix, et la réponse à composer en touchant
// des tuiles — ses lettres, mélangées, et trois de trop. « Soit un indice,
// soit ça te donne des lettres présentes dans la réponse […] comme un pendu.
// Je pense ça donnerait plus de variété dans la manière de répondre » (un
// testeur, le même jour). Pas de clavier : il pousserait les boutons hors de
// l'écran.
//
// Ici, ce qui ne dépend que du texte d'une réponse : si elle se compose, ses
// cases, ses lettres, ses tuiles. Le serveur seul tire les tuiles et juge
// (invariant 1) : la page ne reçoit que les cases et les tuiles, jamais leur
// ordre. Le brief : `retours/2026-10-19/les-coups-de-pouce.md`.

/** Les lettres de trop parmi les tuiles : de quoi hésiter sans noyer la réponse. Un choix de produit. */
export const LETTRES_EN_TROP = 3

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

/** Une lettre, en capitale et sans accent — « é » est un E, « œ » deux lettres —, null : ce n'est pas une lettre de l'alphabet. */
function enCapitales(signe: string): string | null {
  const x = signe.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/Œ/g, 'OE').replace(/Æ/g, 'AE')
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

/**
 * Les lettres qu'on pioche pour les tuiles de trop : les plus courantes du
 * français. Une lettre rare — un W, un K — se devinerait de trop.
 */
const LETTRES_COURANTES = 'EASITNRULODCMPVGBFHQ'

/**
 * Les tuiles d'une réponse à composer : ses lettres et `LETTRES_EN_TROP` de
 * trop — des lettres courantes qu'elle n'a pas : une qu'elle a ne tromperait
 * personne —, mélangées, et le rang de celles de trop, que le serveur seul
 * garde (invariant 1). Jamais ses lettres dans l'ordre : quatre lettres
 * distinctes s'y rangeaient une fois sur vingt-quatre, et la réponse se lisait
 * entre les tuiles. `hasard` : celui du tirage (`Math.random`, au serveur), ou
 * celui d'une graine — les tests, le calibrage.
 */
export function tuilesDe(lettres: string, hasard: () => number): { tuiles: string[]; enTrop: number[] } {
  const libres = [...LETTRES_COURANTES].filter(l => !lettres.includes(l))
  const deTrop: string[] = []
  while (deTrop.length < LETTRES_EN_TROP && libres.length > 0) deTrop.push(libres.splice(Math.floor(hasard() * libres.length), 1)[0])
  const toutes = [...lettres, ...deTrop]
  let ordre = toutes.map((_, i) => i)
  for (let essai = 0; essai < 8; essai++) {
    ordre = toutes.map((_, i) => i)
    for (let i = ordre.length - 1; i > 0; i--) {
      const j = Math.floor(hasard() * (i + 1))
      ;[ordre[i], ordre[j]] = [ordre[j], ordre[i]]
    }
    if (ordre.filter(i => i < lettres.length).map(i => toutes[i]).join('') !== lettres) break
  }
  return { tuiles: ordre.map(i => toutes[i]), enTrop: ordre.flatMap((i, k) => (i >= lettres.length ? [k] : [])) }
}

/** Ce qu'il a composé, dans ses cases — ses mots séparés, ses signes à leur place : « VICTOR HUGO », « SAINT-EXUPERY ». */
export function compositionDite(mots: readonly (readonly CaseAComposer[])[], lettres: string): string {
  let k = 0
  return mots.map(mot => mot.map(c => (c === null ? (lettres[k++] ?? '') : c)).join('')).join(' ')
}

/** Ce qu'un téléphone envoie pour une réponse composée : ses lettres, dans l'ordre des cases. Null : ce n'en est pas une. */
export function lireUneComposition(brut: unknown, longueur: number): string | null {
  return typeof brut === 'string' && brut.length === longueur && /^[A-Z]+$/.test(brut) ? brut : null
}

/**
 * Les signes d'une réponse, mot par mot, sans son article — ses lettres en
 * capitales sans accents, et ses chiffres : ce que L'initiale et La lettre en
 * disent sur une question à choix (« Elle commence par S »). Les signes posés
 * d'office ne comptent pas.
 */
export function signesDe(reponse: string): string[] {
  return sonArticle(reponse)
    .reste.split(' ')
    .map(mot => [...mot].map(s => (/\d/.test(s) ? s : (enCapitales(s) ?? ''))).join(''))
    .filter(Boolean)
}

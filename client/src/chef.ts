// Ce que le chef d'un salon a choisi en l'ouvrant, retenu sur son téléphone :
// joue-t-il, à quel rythme passe-t-on à la question suivante, en équipes ou
// non. Le salon lui-même vit au serveur ; ces choix-là ne regardent que le
// téléphone qui tient la main — et c'est à lui seul que la page de la soirée
// montre la barre du chef. Un invité ne le lit jamais : rien ne s'y écrit
// sans être passé par « Ouvrir le salon ». Ce qu'il prépare avant vit à côté,
// dans son brouillon (`BrouillonDuSalon`).

import { PALIERS_ENCHAINEMENT } from '../../shared/console'
import { lireEquipesPreparees, type EquipePreparee } from '../../shared/teams'

export interface ReglagesDuChef {
  /** L'adresse de l'espace : la barre ne paraît que chez lui. */
  slug: string
  /** Il joue avec ses invités, ou anime seulement. */
  joue: boolean
  /** Secondes avant la question suivante, après une révélation ; null : au clic. */
  rythme: number | null
  equipes: boolean
  /** Les équipes qu'il a préparées en créant le salon : il les retrouve la fois suivante. */
  equipesPreparees?: EquipePreparee[]
}

const CLE = 'quizz.chef'

export function retenirChef(r: ReglagesDuChef) {
  // Sous try/catch : des cookies bloqués donnaient une page noire.
  try {
    localStorage.setItem(CLE, JSON.stringify(r))
  } catch {
    // Stockage refusé : la barre du chef ne paraîtra pas, la console reste là.
  }
}

/** Les réglages du chef de cet espace, si ce téléphone l'est. */
export function chefIci(slug: string): ReglagesDuChef | null {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<ReglagesDuChef> | null
    if (!brut || brut.slug !== slug) return null
    const rythme = typeof brut.rythme === 'number' && PALIERS_ENCHAINEMENT.includes(brut.rythme) ? brut.rythme : null
    // Lues comme le serveur les lit : une liste abîmée ne fait pas tomber la page, elle ne vaut rien.
    const equipesPreparees = lireEquipesPreparees(brut.equipesPreparees)
    return { slug, joue: brut.joue !== false, rythme, equipes: brut.equipes === true, ...(equipesPreparees && { equipesPreparees }) }
  } catch {
    return null
  }
}

/**
 * Ce qu'on prépare sur « Nouveau salon », avant de l'ouvrir : ses quiz, où
 * l'on voit les questions, si l'on joue, les équipes, le nom de la soirée.
 * Rien n'en restait qu'à « Ouvrir le salon » — le programme au serveur, les
 * réglages ici. Une animatrice partie régler le temps de ses questions dans
 * « Mes quiz » a retrouvé la page vide, et refait cinq minutes de préparation
 * sur dix (la tablée du 9 novembre 2026).
 *
 * À part de `quizz.chef` : préparer un salon ne fait pas de ce téléphone
 * celui du chef, et la barre attend toujours « Ouvrir le salon ».
 */
export interface BrouillonDuSalon {
  slug: string
  /** Le nom de la soirée tel qu'il est tapé ; vide, celui d'office. */
  nom: string
  quiz: { id: string; multiplicateur: 1 | 2 | 3 }[]
  ecran: 'telephones' | 'tele'
  joue: boolean
  rythme: number | null
  equipes: boolean
  equipesPreparees?: EquipePreparee[]
}

const BROUILLON = 'quizz.salon'

export function retenirBrouillon(b: BrouillonDuSalon) {
  try {
    localStorage.setItem(BROUILLON, JSON.stringify(b))
  } catch {
    // Stockage refusé : la préparation ne survit pas à la page, comme avant.
  }
}

/** Le brouillon de ce salon, s'il y en a un — lu comme `chefIci` : ce qui est abîmé revient à l'office. */
export function brouillonDuSalon(slug: string): BrouillonDuSalon | null {
  try {
    const brut = JSON.parse(localStorage.getItem(BROUILLON) ?? 'null') as Partial<BrouillonDuSalon> | null
    if (!brut || brut.slug !== slug) return null
    const quiz = (Array.isArray(brut.quiz) ? brut.quiz : [])
      .filter((q): q is { id: string; multiplicateur: 1 | 2 | 3 } => !!q && typeof q === 'object' && typeof (q as { id?: unknown }).id === 'string')
      .map(q => ({ id: q.id, multiplicateur: q.multiplicateur === 2 || q.multiplicateur === 3 ? q.multiplicateur : (1 as const) }))
    const rythme = typeof brut.rythme === 'number' && PALIERS_ENCHAINEMENT.includes(brut.rythme) ? brut.rythme : null
    const equipesPreparees = lireEquipesPreparees(brut.equipesPreparees)
    return {
      slug,
      nom: typeof brut.nom === 'string' ? brut.nom : '',
      quiz,
      ecran: brut.ecran === 'tele' ? 'tele' : 'telephones',
      joue: brut.joue !== false,
      rythme,
      equipes: brut.equipes === true,
      ...(equipesPreparees && { equipesPreparees }),
    }
  } catch {
    return null
  }
}

/** « Ouvrir le salon » : le programme et les réglages du chef tiennent désormais ce qu'il avait préparé. */
export function oublierBrouillon() {
  try {
    localStorage.removeItem(BROUILLON)
  } catch {
    // Stockage refusé : il n'y avait rien.
  }
}

const ENTREE = 'quizz.chef.entrer'

/**
 * « Ouvrir le salon » mène le chef à sa soirée : il y entre sans repasser par
 * « Entrer dans la soirée » — il vient de dire qui il est et s'il joue (la
 * remarque du propriétaire du 3 octobre 2026). La marque ne vaut qu'une fois :
 * le chef qui revient le lendemain sur la page de son salon n'entre pas, sans
 * l'avoir voulu, dans la soirée suivante — et elle ne quitte pas l'onglet.
 */
export function demanderEntree(slug: string) {
  try {
    sessionStorage.setItem(ENTREE, slug)
  } catch {
    // Stockage refusé : l'entrée s'affiche, un toucher de plus.
  }
}

/** La marque posée par « Ouvrir le salon », pour cet espace. Elle se lit sans s'effacer : un rendu se rejoue. */
export function entreeDemandee(slug: string): boolean {
  try {
    return sessionStorage.getItem(ENTREE) === slug
  } catch {
    return false
  }
}

/** La marque a servi — le chef est entré, ou l'entrée s'est montrée. */
export function oublierEntree() {
  try {
    sessionStorage.removeItem(ENTREE)
  } catch {
    // Stockage refusé : il n'y avait rien.
  }
}

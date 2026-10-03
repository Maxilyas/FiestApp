// Ce que le chef d'un salon a choisi en l'ouvrant, retenu sur son téléphone :
// joue-t-il, à quel rythme passe-t-on à la question suivante, en équipes ou
// non. Le salon lui-même vit au serveur ; ces choix-là ne regardent que le
// téléphone qui tient la main — et c'est à lui seul que la page de la soirée
// montre la barre du chef. Un invité ne le lit jamais : rien ne s'y écrit
// sans être passé par « Ouvrir le salon ».

import { PALIERS_ENCHAINEMENT } from '../../shared/console'

export interface ReglagesDuChef {
  /** L'adresse de l'espace : la barre ne paraît que chez lui. */
  slug: string
  /** Il joue avec ses invités, ou anime seulement. */
  joue: boolean
  /** Secondes avant la question suivante, après une révélation ; null : au clic. */
  rythme: number | null
  equipes: boolean
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
    return { slug, joue: brut.joue !== false, rythme, equipes: brut.equipes === true }
  } catch {
    return null
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

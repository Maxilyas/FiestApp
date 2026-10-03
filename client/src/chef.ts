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

// Ce que donne le coffre de la semaine (`shared/coffre.ts`) : le tirage et ses
// réserves, rareté par rareté. À part du coffre, qui reste léger : ce
// fichier parcourt les catalogues des fonds, des gerbes, des thèmes et des
// compagnons, que l'accueil n'a pas à télécharger pour dire qu'un coffre
// attend.
//
// Les objets du trésor — six fonds de carte peints, six gerbes — ne se
// trouvent nulle part ailleurs : ils pèsent double dans leur rareté, pour
// que le coffre donne d'abord ce que la boutique ne vend pas. Un thème et un
// compagnon de la boutique y entrent aussi, offerts — pas un thème qui se
// gagne (il dirait faux sur son exploit), ni la luciole, qui se gagne au bout
// d'une expédition, ni un thème de saison hors de sa saison (il ne serait
// plus rare). Jamais ce qu'il a déjà : une rareté où il a tout descend d'un
// cran, et tout en dernier, ce sont des confettis.

import { NOM_RARETE, type Rarete } from './badges'
import { CHANCES_DU_COFFRE, CONFETTIS_DU_COFFRE, type ObjetDuTresor, type RangDuCoffre } from './coffre'
import { COMPAGNONS, COMPAGNONS_DE_LA_BOUTIQUE } from './compagnons'
import { FONDS } from './fonds'
import { GERBES } from './gerbes'
import { formatNumber } from './typographie'
import { enBoutique, THEMES } from './themes'

/** Les raretés, de la plus haute à la plus humble : l'ordre où l'on descend quand une rareté est épuisée. */
const DESCENTE: readonly Rarete[] = ['legendaire', 'epique', 'rare', 'peucommune', 'commune']

/** Ce que pèse un objet du trésor face à un objet de la boutique, dans sa rareté. */
const POIDS_DU_TRESOR = 2

interface Candidat {
  objet: ObjetDuTresor
  poids: number
}

/** Ce que chaque rareté peut donner, avant d'écarter ce qu'il a. */
function reserveDe(rarete: Rarete, jour: string): Candidat[] {
  const tresor = (o: ObjetDuTresor): Candidat => ({ objet: o, poids: POIDS_DU_TRESOR })
  const boutique = (o: ObjetDuTresor): Candidat => ({ objet: o, poids: 1 })
  return [
    ...FONDS.filter(f => f.tresor === rarete).map(f => tresor({ sorte: 'fond', cle: f.key })),
    ...GERBES.flatMap(g => ('tresor' in g.par && g.par.tresor === rarete ? [tresor({ sorte: 'gerbe', cle: g.key })] : [])),
    // Un thème de saison ne sort qu'à sa saison, comme en boutique : hors d'elle, il cesserait d'être rare.
    ...THEMES.filter(t => t.rarete === rarete && !t.gagne && (!t.saison || enBoutique(t, jour))).map(t => boutique({ sorte: 'theme', cle: t.key })),
    // Un compagnon vaut le prix d'un thème légendaire : il est légendaire au coffre.
    ...(rarete === 'legendaire' ? COMPAGNONS_DE_LA_BOUTIQUE.map(c => tresor({ sorte: 'compagnon', cle: c.key })) : []),
  ]
}

/** Une rareté tirée aux chances du coffre, `x` dans [0, 1[. */
function rareteTiree(rang: RangDuCoffre, x: number): Rarete {
  const chances = CHANCES_DU_COFFRE[rang]
  let cumul = 0
  const total = DESCENTE.reduce((n, r) => n + chances[r], 0)
  // De la plus humble à la plus haute : un x de zéro tombe sur la première qui a sa chance.
  for (const r of [...DESCENTE].reverse()) {
    cumul += chances[r] / total
    if (x < cumul) return r
  }
  return DESCENTE.find(r => chances[r] > 0)!
}

/** Un candidat tiré à son poids, `x` dans [0, 1[. */
function auPoids(candidats: readonly Candidat[], x: number): ObjetDuTresor {
  const total = candidats.reduce((n, c) => n + c.poids, 0)
  let cumul = 0
  for (const c of candidats) {
    cumul += c.poids / total
    if (x < cumul) return c.objet
  }
  return candidats[candidats.length - 1].objet
}

/**
 * Le tirage d'un coffre : une rareté à ses chances, puis un objet de cette
 * rareté qu'il n'a pas — ou de la rareté du dessous, jusqu'aux confettis.
 * La rareté commune donne des confettis autant qu'un thème : elle n'est pas
 * qu'un lot de consolation. `hasard` rend un nombre dans [0, 1[ ; `possede`
 * dit ce qu'il a déjà. `jour` : le jour de l'ouverture, pour les saisons.
 */
export function tirerLeCoffre(
  rang: RangDuCoffre,
  { possede, hasard, jour }: { possede: (o: ObjetDuTresor) => boolean; hasard: () => number; jour: string },
): { objet: ObjetDuTresor; rarete: Rarete } {
  const tiree = rareteTiree(rang, hasard())
  const confettis: ObjetDuTresor = { sorte: 'confettis', confettis: CONFETTIS_DU_COFFRE[rang] }
  for (const rarete of DESCENTE.slice(DESCENTE.indexOf(tiree))) {
    const candidats = reserveDe(rarete, jour).filter(c => !possede(c.objet))
    if (rarete === 'commune') {
      // Autant de chances pour les confettis que pour tous les thèmes ensemble.
      const poids = Math.max(1, candidats.reduce((n, c) => n + c.poids, 0))
      return { objet: auPoids([...candidats, { objet: confettis, poids }], hasard()), rarete }
    }
    if (candidats.length > 0) return { objet: auPoids(candidats, hasard()), rarete }
  }
  return { objet: confettis, rarete: 'commune' }
}

/** Les objets que le coffre peut encore donner, rareté par rareté : la page du coffre les dit avant l'ouverture. */
export function reserveDuCoffre(possede: (o: ObjetDuTresor) => boolean, jour: string): Record<Rarete, number> {
  return Object.fromEntries(DESCENTE.map(r => [r, reserveDe(r, jour).filter(c => !possede(c.objet)).length])) as Record<Rarete, number>
}

/** Le nom d'un objet du coffre : « La Voie lactée », « Le Loup », « 120 confettis ». */
export function nomDeLObjet(o: ObjetDuTresor): string {
  switch (o.sorte) {
    case 'confettis':
      return `${formatNumber(o.confettis)} confettis`
    case 'fond':
      return FONDS.find(f => f.key === o.cle)?.nom ?? o.cle
    case 'gerbe':
      return GERBES.find(g => g.key === o.cle)?.nom ?? o.cle
    case 'theme':
      return THEMES.find(t => t.key === o.cle)?.nom ?? o.cle
    case 'compagnon':
      return COMPAGNONS.find(c => c.key === o.cle)?.nom ?? o.cle
  }
}

/** Ce qu'il fait, en une phrase, sous son nom : la scène de l'ouverture la dit. */
export function phraseDeLObjet(o: ObjetDuTresor): string {
  switch (o.sorte) {
    case 'confettis':
      return 'De quoi t’approcher de la boutique : ils rejoignent ton solde.'
    case 'fond':
      return 'Un fond du trésor, introuvable en boutique : derrière ta carte, quand on touche ton nom.'
    case 'gerbe':
      return 'Une gerbe du trésor, introuvable en boutique : elle éclate à tes bonnes réponses.'
    case 'theme':
      return 'Un thème de la boutique, offert : il habille toutes tes pages.'
    case 'compagnon': {
      const c = COMPAGNONS.find(x => x.key === o.cle)
      return c ? `${c.phrase} Porte-le : il grandit avec tes bonnes réponses.` : 'Un compagnon : il grandit avec tes bonnes réponses.'
    }
  }
}

/** La rareté d'un objet, en toutes lettres : « Légendaire ». */
export const nomDeLaRarete = (r: Rarete) => NOM_RARETE[r]

// Deux questions jumelles ne se suivent pas dans un même tirage quand il en
// a d'autres aussi fraîches : une épreuve des sentiers, une série, un défi,
// un duel, un quiz tout prêt. La base a des familles écrites en série — deux
// cent vingt-quatre « Qui a réalisé le film… » au cinéma, cent quatre « Qui a
// reçu le prix… » aux lettres —, et un tirage qui ne regardait que la
// catégorie et le sous-thème en posait quatre à la suite : au premier palier
// de la forêt, « le petit du cerf », « de la vache », « de la chèvre », mêmes
// leurres (l'experte du jeu solo, le 11 octobre 2026) ; dans une série du
// petit écran, cinq « Qui a créé la série… » sur vingt questions.
import { sansAccent } from '../../../shared/homonymes'

/** Les mots qui ne disent rien de la forme d'un intitulé. */
const MOTS_VIDES = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'un', 'une', 'a', 'au', 'aux', 'en', 'et', 's', 'est', 'ce', 'cet', 'cette', 'qu', 'que'])

/**
 * La forme d'un intitulé : ses trois premiers mots pleins, sans accents —
 * « Qui a réalisé le film… ? » donne « qui realise film ». Les familles
 * écrites en série en partagent une.
 */
export function gabaritDe(texte: string): string {
  return sansAccent(texte)
    .split(/[^a-z0-9]+/)
    .filter(m => m && !MOTS_VIDES.has(m))
    .slice(0, 3)
    .join(' ')
}

/** Une réponse comparable : sans casse, sans accents, sans son article — « Le chevreau » et « chevreau » sont la même. */
const reponseNette = (r: string) => sansAccent(r).replace(/^(le|la|les|l'|l’|un|une)\s*/, '')

export type Intitule = { texte: string; reponses: readonly string[] }
type Signe = { forme: string; reponses: string[] } | null

/**
 * Gardés tant que la question vit : un tirage en relit des centaines, et les
 * recalculer à chaque fois rendait une épreuve dix fois plus lente (6 ms au
 * lieu de 0,6 sur la vraie base).
 */
const signesGardes = new WeakMap<Intitule, Signe>()

/** Ce qui fait la jumelle d'une question : sa forme, ses réponses nettes — rien pour un vrai ou faux, un genre et pas une redite. */
function signeDe(q: Intitule): Signe {
  if (signesGardes.has(q)) return signesGardes.get(q)!
  const signe = q.reponses.length < 3 ? null : { forme: gabaritDe(q.texte), reponses: [...new Set(q.reponses.map(reponseNette))] }
  signesGardes.set(q, signe)
  return signe
}

/**
 * Deux questions jumelles : la même forme (`gabaritDe`), ou deux réponses
 * proposées en commun — « le petit de la chèvre », « de la vache »,
 * « du cerf », « du sanglier » ne partagent pas leurs premiers mots pleins,
 * mais leurs agneau, veau, poulain et chevreau.
 */
export function jumelles(a: Intitule, b: Intitule): boolean {
  const x = signeDe(a)
  const y = signeDe(b)
  if (!x || !y) return false
  if (x.forme === y.forme) return true
  const deB = new Set(y.reponses)
  return x.reponses.filter(r => deB.has(r)).length >= 2
}

/**
 * Les questions déjà prises d'un tirage, pour reconnaître d'un coup d'œil la
 * jumelle de l'une d'elles (`jumelles`) : un tirage en regarde des centaines
 * pour chacune de ses places, et comparer chaque candidate à chaque prise,
 * intitulés relus, coûtait des secondes. Les formes et les réponses de
 * chaque question se lisent une fois (`signesGardes`).
 */
export class DejaPrises {
  private formes = new Set<string>()
  /** Chaque réponse nette, et les prises qui la proposent. */
  private parReponse = new Map<string, number[]>()
  private prises = 0

  prendre(q: Intitule) {
    const s = signeDe(q)
    const i = this.prises++
    if (!s) return
    this.formes.add(s.forme)
    for (const r of s.reponses) (this.parReponse.get(r) ?? this.parReponse.set(r, []).get(r)!).push(i)
  }

  jumelle(q: Intitule): boolean {
    // Rien de pris encore : personne n'a de jumelle — la première place se lit sans rien calculer.
    if (this.prises === 0) return false
    const s = signeDe(q)
    if (!s) return false
    if (this.formes.has(s.forme)) return true
    const communes = new Map<number, number>()
    for (const r of s.reponses) {
      for (const i of this.parReponse.get(r) ?? []) {
        const n = (communes.get(i) ?? 0) + 1
        if (n >= 2) return true
        communes.set(i, n)
      }
    }
    return false
  }
}

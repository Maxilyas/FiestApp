// L'Expédition (le brief : `retours/2026-10-17/expedition.md`, validé par le
// propriétaire le 17 octobre 2026 — « on fait que rajouter des choses mais on
// ne sait plus quoi choisir ») : trois actes, chacun une carte tirée au sort,
// un gardien au bout de chacun, et un légendaire à garder au bout du
// troisième. Tout ce qui se calcule est ici, pur : le serveur tire et juge
// (invariant 1), la page dessine et conseille.
//
// L'état d'une expédition n'est écrit nulle part : il se replie de son départ
// (ses trois cartes, ses gardiens), de son journal de gestes et de ses
// réponses (`pliDeLExpedition`) — le même pli pour l'expédition qu'on joue et
// pour une finie (invariant 14). Le hasard se rejoue de la graine
// (`hasardDe`) : recharger ne retire rien.

import { hasardDe } from './missions'
import { CATEGORIES } from './categories'
import { VIES, type Niveau, type QuestionDeCampagne } from './campagne'
import { TAUX_DU_CALIBRAGE } from './sentiers'
import { LEGENDAIRES, legendaire } from './legendaires'
import { LEGENDAIRES_A_JOKER } from './jokers'
import type { PalierTombe } from './jour'

export { EXPEDITION_EN_PRODUCTION } from './jokers'

export const ACTES = 3
export const ETAGES = 6
export const COLONNES = 4
/** Les chemins qui montent du bas : leurs pas font les escales et les liens. */
export const CHEMINS = 5

/** Une escale de la carte. Le gardien est la dernière de chaque acte, après les campements. */
export type SorteDEscale = 'question' | 'elite' | 'source' | 'coffre' | 'inconnu' | 'echoppe' | 'campement' | 'gardien'

/**
 * Ce que l'étape 1 sait jouer. Le générateur tire toutes les sortes du brief
 * — la carte garde ses proportions d'une étape à l'autre —, puis pose une
 * question à la place d'une élite, d'une échoppe ou de l'inconnu, et une
 * source à la place d'un coffre : sans jokers ni écus, ils n'auraient rien à
 * donner.
 */
const SORTES_OUVERTES: ReadonlySet<SorteDEscale> = new Set(['question', 'source', 'campement', 'gardien'])

export type FormeDEscale = 'quatre' | 'vrai-faux' | 'six' | 'devoilement'

/** Les formes de l'étape 1 : la question telle que la base l'a écrite. Les trois autres viennent à l'étape 3. */
const FORMES_OUVERTES: ReadonlySet<FormeDEscale> = new Set(['quatre'])

/** Le thème d'une escale : une catégorie, un mélange de deux ou trois, ou un sujet de `shared/sujets.ts` — un thème pointu. */
export type ThemeDEscale = { categories: string[] } | { sujet: string }

export interface EscaleDeLaCarte {
  /** `e23` (étage 2, colonne 3), `cg` et `cd` pour les campements, `g` pour le gardien. */
  id: string
  /** De 0 (le bas) à 5 ; les campements sont à `ETAGES`, le gardien au-dessus. */
  etage: number
  /** De 0 à 3 ; un campement, 0 (gauche) ou 1 (droite). */
  colonne: number
  sorte: SorteDEscale
  theme?: ThemeDEscale
  forme?: FormeDEscale
  /** Les escales où l'on peut aller ensuite. */
  suite: string[]
  /** La chance qu'il la trouve, de 0 à 1, calculée au départ de l'expédition et gardée avec elle. */
  chance?: number
}

export interface CarteDUnActe {
  escales: EscaleDeLaCarte[]
  /** Les escales du bas : celles qu'on peut prendre en entrant dans l'acte. */
  depart: string[]
  /** Sa chance sur chaque question du gardien. */
  chanceDuGardien?: number
}

/**
 * La marche de chaque acte (le calibrage du brief : le joueur moyen au bout
 * une fois sur trois, le fort huit fois sur dix). Jamais d'experte : le
 * joueur moyen en trouve une sur dix, moins que le hasard. Le gardien
 * tombe à sa `aTrouver`-ième bonne réponse ; chaque erreur coûte une vie.
 * Des choix de produit (`docs/reference/baremes.md`).
 */
export const MARCHES_DES_ACTES: readonly { bas: Niveau; haut: Niveau; elite: Niveau; gardien: Niveau; aTrouver: number }[] = [
  { bas: 'facile', haut: 'facile', elite: 'moyen', gardien: 'facile', aTrouver: 4 },
  { bas: 'facile', haut: 'moyen', elite: 'moyen', gardien: 'moyen', aTrouver: 3 },
  { bas: 'moyen', haut: 'moyen', elite: 'difficile', gardien: 'difficile', aTrouver: 3 },
]

/** Les étages du bas d'un acte (0 à 2) prennent sa marche basse, ceux du haut (3 à 5) sa marche haute. */
const ETAGES_DU_BAS = 3

/**
 * Le poids de chaque sorte aux étages 2 à 6 — le premier étage n'a que des
 * questions —, et ce qu'un acte en tient au plus. Ce qu'un plafond refuse, et
 * le reste, devient une question. Des choix de produit.
 */
export const POIDS_DES_ESCALES: readonly { sorte: SorteDEscale; part: number; auPlus?: number; desLEtage?: number }[] = [
  { sorte: 'question', part: 0.46 },
  { sorte: 'elite', part: 0.12, auPlus: 2, desLEtage: 2 },
  { sorte: 'source', part: 0.1 },
  { sorte: 'coffre', part: 0.12 },
  { sorte: 'inconnu', part: 0.08, auPlus: 2 },
  { sorte: 'echoppe', part: 0.05, auPlus: 1 },
]

/** La part des mélanges de deux ou trois catégories, puis des thèmes pointus, parmi les questions des étages 2 à 6. */
export const PART_DES_MELANGES = 0.18
export const PART_DES_THEMES_POINTUS = 0.14

/** Les formes des étages 2 à 6 ; le premier étage pose quatre choix sept fois sur dix, sinon un vrai ou faux. */
export const POIDS_DES_FORMES: readonly { forme: FormeDEscale; part: number }[] = [
  { forme: 'quatre', part: 0.4 },
  { forme: 'vrai-faux', part: 0.2 },
  { forme: 'six', part: 0.2 },
  { forme: 'devoilement', part: 0.2 },
]

/** L'identifiant du gardien, sur chaque carte. */
export const GARDIEN = 'g'

const idDe = (etage: number, colonne: number) => `e${etage}${colonne}`

/**
 * La carte d'un acte, tirée de la graine de l'expédition : la même graine
 * redonne la même carte. Cinq chemins montent d'une colonne voisine à
 * l'autre sans jamais en croiser un autre ; leurs pas font les escales et les
 * liens. Puis chaque escale prend sa sorte, son thème et sa forme ; une source
 * et un coffre au moins (une question des étages 3 à 5 en devient un : sans
 * eux, aucune route ne laisserait le choix de se soigner ou de s'équiper) ;
 * deux campements au bout — celui de gauche pour les colonnes 1 et 2, celui de
 * droite pour 3 et 4 —, puis le gardien. `sujets` : les thèmes pointus qu'on
 * peut tirer, ceux qui ont assez de questions.
 */
export function carteDUnActe(graine: string, acte: number, sujets: readonly string[]): CarteDUnActe {
  const r = hasardDe(`${graine}:carte:${acte}`)
  const entier = (n: number) => Math.floor(r() * n)
  const liens = new Map<string, number[]>()
  const present = new Set<string>()
  const existe = (f: number, c: number, x: number) => (liens.get(`${f}:${c}`) ?? []).includes(x)
  // Deux pas qui se croisent — l'un de c vers c+1, l'autre de c+1 vers c — font un X illisible.
  const croise = (f: number, c: number, x: number) => (x === c + 1 && existe(f, c + 1, c)) || (x === c - 1 && existe(f, c - 1, c))
  for (let p = 0; p < CHEMINS; p++) {
    let c = p < COLONNES ? p : entier(COLONNES)
    present.add(`0:${c}`)
    for (let f = 0; f < ETAGES - 1; f++) {
      const options = [c - 1, c, c + 1].filter(x => x >= 0 && x < COLONNES)
      for (let i = options.length - 1; i > 0; i--) {
        const j = entier(i + 1)
        ;[options[i], options[j]] = [options[j], options[i]]
      }
      const suivant = options.find(o => !croise(f, c, o)) ?? c
      const cle = `${f}:${c}`
      const deja = liens.get(cle) ?? []
      if (!deja.includes(suivant)) liens.set(cle, [...deja, suivant])
      present.add(`${f + 1}:${suivant}`)
      c = suivant
    }
  }

  const escales: EscaleDeLaCarte[] = []
  const comptes = new Map<SorteDEscale, number>()
  for (let f = 0; f < ETAGES; f++) {
    for (let c = 0; c < COLONNES; c++) {
      if (!present.has(`${f}:${c}`)) continue
      let sorte: SorteDEscale = 'question'
      if (f > 0) {
        const t = r()
        let cumul = 0
        for (const p of POIDS_DES_ESCALES) {
          cumul += p.part
          if (t < cumul) {
            const refusee = (p.auPlus !== undefined && (comptes.get(p.sorte) ?? 0) >= p.auPlus) || (p.desLEtage !== undefined && f < p.desLEtage)
            sorte = refusee ? 'question' : p.sorte
            break
          }
        }
      }
      comptes.set(sorte, (comptes.get(sorte) ?? 0) + 1)
      const e: EscaleDeLaCarte = { id: idDe(f, c), etage: f, colonne: c, sorte, suite: [] }
      if (sorte === 'question' || sorte === 'elite') {
        const s = r()
        if (f > 0 && s < PART_DES_MELANGES) {
          const combien = r() < 0.5 ? 2 : 3
          const choisies: string[] = []
          while (choisies.length < combien) {
            const cat = CATEGORIES[entier(CATEGORIES.length)]
            if (!choisies.includes(cat)) choisies.push(cat)
          }
          e.theme = { categories: choisies }
        } else if (f > 0 && s < PART_DES_MELANGES + PART_DES_THEMES_POINTUS && sujets.length > 0) {
          e.theme = { sujet: sujets[entier(sujets.length)] }
        } else {
          e.theme = { categories: [CATEGORIES[entier(CATEGORIES.length)]] }
        }
        let forme: FormeDEscale = 'quatre'
        if (f === 0) forme = r() < 0.7 ? 'quatre' : 'vrai-faux'
        else {
          const t = r()
          let cumul = 0
          for (const p of POIDS_DES_FORMES) {
            cumul += p.part
            if (t < cumul) {
              forme = p.forme
              break
            }
          }
        }
        e.forme = FORMES_OUVERTES.has(forme) ? forme : 'quatre'
      }
      escales.push(e)
    }
  }

  for (const manque of ['source', 'coffre'] as const) {
    if (escales.some(e => e.sorte === manque)) continue
    const cible = escales.find(e => e.sorte === 'question' && e.etage >= 2 && e.etage <= 4)
    if (cible) {
      cible.sorte = manque
      delete cible.theme
      delete cible.forme
    }
  }

  // Ce que l'étape ne sait pas encore jouer prend la place la plus proche
  // (`SORTES_OUVERTES`) ; l'inconnu et l'échoppe devenus questions prennent
  // une catégorie, comme toute question.
  for (const e of escales) {
    if (SORTES_OUVERTES.has(e.sorte)) continue
    if (e.sorte === 'coffre') {
      e.sorte = 'source'
      delete e.theme
      delete e.forme
      continue
    }
    e.sorte = 'question'
    e.theme ??= { categories: [CATEGORIES[entier(CATEGORIES.length)]] }
    e.forme ??= 'quatre'
  }

  const parId = new Map(escales.map(e => [e.id, e]))
  for (const e of escales) {
    if (e.etage < ETAGES - 1) e.suite = (liens.get(`${e.etage}:${e.colonne}`) ?? []).map(x => idDe(e.etage + 1, x)).filter(id => parId.has(id))
  }
  const enHaut = escales.filter(e => e.etage === ETAGES - 1)
  const campements: EscaleDeLaCarte[] = []
  if (enHaut.some(e => e.colonne <= 1)) campements.push({ id: 'cg', etage: ETAGES, colonne: 0, sorte: 'campement', suite: [GARDIEN] })
  if (enHaut.some(e => e.colonne >= 2)) campements.push({ id: 'cd', etage: ETAGES, colonne: 1, sorte: 'campement', suite: [GARDIEN] })
  for (const e of enHaut) e.suite = [e.colonne <= 1 ? 'cg' : 'cd']
  const gardien: EscaleDeLaCarte = { id: GARDIEN, etage: ETAGES + 1, colonne: 0, sorte: 'gardien', suite: [] }
  return {
    escales: [...escales, ...campements, gardien],
    depart: escales.filter(e => e.etage === 0).map(e => e.id),
  }
}

/** La marche d'une escale à question : celle de son acte, selon l'étage — l'élite celle du dessus, le gardien la sienne. */
export function marcheDe(acte: number, e: Pick<EscaleDeLaCarte, 'sorte' | 'etage'>): Niveau {
  const m = MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)]
  if (e.sorte === 'gardien') return m.gardien
  if (e.sorte === 'elite') return m.elite
  return e.etage < ETAGES_DU_BAS ? m.bas : m.haut
}

/** Une escale où l'on répond : question, élite, source, gardien. */
export const aUneQuestion = (s: SorteDEscale) => s === 'question' || s === 'elite' || s === 'source' || s === 'gardien'

/** Le numéro d'une carte, ce que la page en dit — « Carte n° 48 213 » — : la graine reste au serveur. */
export function numeroDeLaCarte(graine: string): number {
  return 10_000 + Math.floor(hasardDe(`${graine}:numero`)() * 90_000)
}

/** La graine de la n-ième expédition d'un profil : la page annonce ses gardiens avant le départ, le départ les retrouve. */
export const graineDe = (profileId: string, n: number) => `${profileId}:${n}`

/**
 * Les trois gardiens d'une expédition, un par acte : des légendaires qu'il
 * n'a pas, qui ont leur joker (`LEGENDAIRES_A_JOKER` : vaincu, un gardien
 * suit en joker) et la voie de l'expédition (`estUneVoieDExpedition`) — pas
 * ceux de saison, qui ne se gagnent qu'à leur saison, par elle seule. Il n'en
 * reste pas assez ? Les places se prennent parmi les siens : les garder au
 * bout ne rapporte que l'expérience de ses réponses (le choix du 17 octobre
 * 2026).
 */
export function gardiensDe(graine: string, possedes: ReadonlySet<string>): string[] {
  const r = hasardDe(`${graine}:gardiens`)
  const candidats = LEGENDAIRES.filter(l => LEGENDAIRES_A_JOKER.includes(l.key) && !l.saison).map(l => l.key)
  const melanges = (liste: string[]) => {
    const l = [...liste]
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[l[i], l[j]] = [l[j], l[i]]
    }
    return l
  }
  const neufs = melanges(candidats.filter(k => !possedes.has(k)))
  const siens = melanges(candidats.filter(k => possedes.has(k)))
  return [...neufs, ...siens].slice(0, ACTES)
}

// ── Les chances ────────────────────────────────────────────────────────────

/**
 * Le hasard de chaque forme : un sur quatre à quatre choix et au
 * dévoilement, un sur six à six choix, un sur deux en vrai ou faux.
 */
const HASARD: Record<FormeDEscale, number> = { quatre: 1 / 4, devoilement: 1 / 4, six: 1 / 6, 'vrai-faux': 1 / 2 }

/**
 * Une chance à quatre choix ramenée à une autre forme : le savoir se lit sous
 * le hasard d'un sur quatre, puis le hasard de la forme s'y ajoute.
 */
export function chanceSelonLaForme(p4: number, forme: FormeDEscale): number {
  const savoir = Math.max(0, (p4 - 1 / 4) / (3 / 4))
  const h = HASARD[forme]
  return h + (1 - h) * savoir
}

/** La chance d'un joueur moyen à une marche (`TAUX_DU_CALIBRAGE`) : ce que la carte dit avant de le connaître. */
export const chanceDuJoueurMoyen = (marche: Niveau) => TAUX_DU_CALIBRAGE[marche]

/**
 * Sa chance de vaincre un gardien qui demande `aTrouver` bonnes réponses,
 * avec `vies` vies : trouver `aTrouver` fois avant d'avoir raté `vies` fois.
 */
export function chanceDeVaincre(p: number, aTrouver: number, vies: number): number {
  let somme = 0
  let combinaisons = 1
  for (let k = 0; k < vies; k++) {
    if (k > 0) combinaisons = (combinaisons * (aTrouver - 1 + k)) / k
    somme += combinaisons * p ** aTrouver * (1 - p) ** k
  }
  return Math.min(1, Math.max(0, somme))
}

/**
 * Ses vies au bout d'un tracé, en loi : la case `v` dit la chance d'arriver
 * avec `v` vies (la case 0, d'être tombé en route). Une erreur coûte une
 * vie, une source retrouvée et un campement en rendent une, jusqu'à trois.
 */
export function viesAuBout(carte: CarteDUnActe, trace: readonly string[], vies: number): number[] {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  let d = new Array<number>(VIES + 1).fill(0)
  d[Math.min(VIES, Math.max(0, vies))] = 1
  for (const id of trace) {
    const e = parId.get(id)
    if (!e) continue
    const apres = new Array<number>(VIES + 1).fill(0)
    apres[0] = d[0]
    for (let v = 1; v <= VIES; v++) {
      if (e.sorte === 'campement') apres[Math.min(VIES, v + 1)] += d[v]
      else if (e.sorte === 'source') {
        const c = e.chance ?? 0.5
        apres[Math.min(VIES, v + 1)] += d[v] * c
        apres[v] += d[v] * (1 - c)
      } else if (e.sorte === 'question' || e.sorte === 'elite') {
        const c = e.chance ?? 0.5
        apres[v] += d[v] * c
        apres[v - 1] += d[v] * (1 - c)
      } else apres[v] += d[v]
    }
    d = apres
  }
  return d
}

/** Ce que la page dit d'un tracé : la chance d'arriver au gardien vivant, puis de le vaincre. */
export function chancesDuTrace(carte: CarteDUnActe, trace: readonly string[], vies: number, acte: number): { arriver: number; vaincre: number } {
  const d = viesAuBout(carte, trace, vies)
  const p = carte.chanceDuGardien ?? chanceDuJoueurMoyen(MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)].gardien)
  const aTrouver = MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)].aTrouver
  let vaincre = 0
  for (let v = 1; v <= VIES; v++) vaincre += d[v] * chanceDeVaincre(p, aTrouver, v)
  return { arriver: 1 - d[0], vaincre }
}

/**
 * Le tracé le plus sûr d'ici au campement : celui qui donne la meilleure
 * chance de vaincre le gardien — arriver, et avec le plus de vies. Six
 * étages de trois liens au plus : sept cents tracés à peine, tous comptés.
 * La page le redessine à chaque escale touchée : il garde le début qu'on a
 * choisi (`debut`, depuis l'escale où l'on est) et passe par celle qu'on
 * vient de toucher (`par`). Aucun tracé ne le peut : [].
 */
export function traceLePlusSur(
  carte: CarteDUnActe,
  ici: string | null,
  vies: number,
  acte: number,
  { debut = [], par }: { debut?: readonly string[]; par?: string } = {},
): string[] {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  let meilleur: { trace: string[]; vaincre: number } | null = null
  const explorer = (trace: string[]) => {
    const dernier = trace.length > 0 ? trace[trace.length - 1] : ici
    const suite = dernier === null ? carte.depart : (parId.get(dernier)?.suite ?? [])
    if (dernier !== null && parId.get(dernier)?.sorte === 'campement') {
      if (par !== undefined && !trace.includes(par)) return
      const { vaincre } = chancesDuTrace(carte, trace, vies, acte)
      if (!meilleur || vaincre > meilleur.vaincre + 1e-9) meilleur = { trace: [...trace], vaincre }
      return
    }
    for (const id of suite) if (id !== GARDIEN) explorer([...trace, id])
  }
  explorer([...debut])
  return (meilleur as { trace: string[] } | null)?.trace ?? []
}

/** Les escales qu'il peut encore atteindre d'ici, campements et gardien compris. */
export function escalesAtteignables(carte: CarteDUnActe, ici: string | null): Set<string> {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const vues = new Set<string>()
  const pile = [...(ici === null ? carte.depart : (parId.get(ici)?.suite ?? []))]
  while (pile.length > 0) {
    const id = pile.pop()!
    if (vues.has(id)) continue
    vues.add(id)
    pile.push(...(parId.get(id)?.suite ?? []))
  }
  return vues
}

// ── Le pli du journal ──────────────────────────────────────────────────────

/** Ce que l'expédition garde de son départ (`campagne_series.expedition`), versionné. */
export interface DepartDExpedition {
  v: 1
  graine: string
  numero: number
  /** Les trois gardiens, un par acte, dans l'ordre des actes. */
  gardiens: string[]
  /** Les trois cartes, tirées au départ et gardées telles quelles : une retouche du générateur ne déplace pas une escale sous les pieds de qui joue. */
  cartes: CarteDUnActe[]
  /** Les chances sont celles d'un joueur moyen : le modèle ne le connaît pas encore (moins de vingt premières réponses). */
  moyen: boolean
}

/** Un geste du journal (`expedition_gestes`). */
export type GesteDExpedition = { quoi: 'avancer'; vers: string } | { quoi: 'garder'; legendaire: string } | { quoi: 'abandonner' }

/** Une question posée, telle que la partie la range : l'escale et l'acte où elle a été tirée. */
export interface QuestionPosee {
  escale: string
  acte: number
}

export type IssueDExpedition = 'en-route' | 'au-bout' | 'legendaire' | 'perdue' | 'abandonnee'

export interface EtatDeLExpedition {
  /** L'acte en cours, de 0 à 2 ; 3 une fois le dernier gardien vaincu. */
  acte: number
  /** L'escale où il est ; null à l'entrée d'un acte. */
  ici: string | null
  /** Les escales passées dans l'acte en cours, dans l'ordre. */
  trace: string[]
  vies: number
  justes: number
  /** La question qui attend sa réponse (son rang dans les questions de la partie) ; null : rien n'attend. */
  enAttente: number | null
  /** Les questions déjà passées — répondues, ou laissées par un gardien tombé : la prochaine tirée vient après. */
  passees: number
  /** Le combat en cours contre le gardien de l'acte. */
  gardien: { trouvees: number; ratees: number } | null
  vaincus: number
  issue: IssueDExpedition
  garde: string | null
}

/**
 * L'état d'une expédition, replié de son départ, de ses gestes et de ses
 * réponses — rien d'autre. Une escale à question consomme la question tirée
 * pour elle ; le gardien, celles tirées pour lui, jusqu'à sa `aTrouver`-ième
 * bonne réponse ou la dernière vie : vaincu, l'acte suivant s'ouvre, et ses
 * questions de reste ne se posent pas.
 */
export function pliDeLExpedition(
  depart: Pick<DepartDExpedition, 'cartes' | 'gardiens'>,
  gestes: readonly GesteDExpedition[],
  questions: readonly QuestionPosee[],
  reponses: ReadonlyMap<number, boolean>,
): EtatDeLExpedition {
  const e: EtatDeLExpedition = { acte: 0, ici: null, trace: [], vies: VIES, justes: 0, enAttente: null, passees: 0, gardien: null, vaincus: 0, issue: 'en-route', garde: null }
  const fini = () => e.issue !== 'en-route' && e.issue !== 'au-bout'
  for (const g of gestes) {
    if (fini() || e.enAttente !== null) {
      // Une question attend : seul l'abandon passe — un geste de plus ne se joue pas par-dessus.
      if (g.quoi === 'abandonner' && !fini()) e.issue = 'abandonnee'
      continue
    }
    if (g.quoi === 'abandonner') {
      e.issue = 'abandonnee'
      continue
    }
    if (g.quoi === 'garder') {
      if (e.issue === 'au-bout' && depart.gardiens.includes(g.legendaire)) {
        e.issue = 'legendaire'
        e.garde = g.legendaire
      }
      continue
    }
    if (e.issue !== 'en-route') continue
    const carte = depart.cartes[e.acte]
    const escale = carte?.escales.find(x => x.id === g.vers)
    if (!escale) continue
    e.ici = escale.id
    e.trace.push(escale.id)
    if (escale.sorte === 'campement') e.vies = Math.min(VIES, e.vies + 1)
    else if (escale.sorte === 'gardien') {
      e.gardien = { trouvees: 0, ratees: 0 }
      combattre(e, depart, questions, reponses)
    } else if (aUneQuestion(escale.sorte)) {
      const i = e.passees
      if (i >= questions.length) {
        // Tirée après le geste, sous le même verrou : une lecture d'entre-deux la trouve en route.
        e.enAttente = i
        continue
      }
      const juste = reponses.get(i)
      if (juste === undefined) {
        e.enAttente = i
        continue
      }
      e.passees++
      if (juste) {
        e.justes++
        if (escale.sorte === 'source') e.vies = Math.min(VIES, e.vies + 1)
      } else if (escale.sorte !== 'source') e.vies--
      if (e.vies <= 0) e.issue = 'perdue'
    }
  }
  return e
}

/** Le combat contre le gardien de l'acte : les questions tirées pour lui, dans l'ordre, tant qu'elles ont leur réponse. */
function combattre(e: EtatDeLExpedition, depart: Pick<DepartDExpedition, 'cartes' | 'gardiens'>, questions: readonly QuestionPosee[], reponses: ReadonlyMap<number, boolean>) {
  const { aTrouver } = MARCHES_DES_ACTES[e.acte]
  const acte = e.acte
  while (e.gardien) {
    const i = e.passees
    const q = questions[i]
    if (!q || q.escale !== GARDIEN || q.acte !== acte) {
      e.enAttente = i
      return
    }
    const juste = reponses.get(i)
    if (juste === undefined) {
      e.enAttente = i
      return
    }
    e.passees++
    if (juste) {
      e.justes++
      e.gardien.trouvees++
    } else {
      e.gardien.ratees++
      e.vies--
    }
    if (e.gardien.trouvees >= aTrouver) {
      e.vaincus++
      e.gardien = null
      e.acte++
      e.ici = null
      e.trace = []
      if (e.acte >= Math.min(ACTES, depart.cartes.length)) e.issue = 'au-bout'
    } else if (e.vies <= 0) {
      e.gardien = null
      e.issue = 'perdue'
    }
  }
  // Ses questions de reste, tirées d'avance pour lui, ne se posent pas.
  while (questions[e.passees]?.escale === GARDIEN && questions[e.passees]?.acte === acte) e.passees++
}

/** Où il peut aller : les escales du bas à l'entrée d'un acte, la suite de l'escale où il est, le gardien depuis un campement. */
export function escalesPermises(depart: Pick<DepartDExpedition, 'cartes'>, e: EtatDeLExpedition): string[] {
  if (e.issue !== 'en-route' || e.enAttente !== null || e.gardien) return []
  const carte = depart.cartes[e.acte]
  if (!carte) return []
  if (e.ici === null) return carte.depart
  return carte.escales.find(x => x.id === e.ici)?.suite ?? []
}

/** Combien de questions tirer pour le gardien : de quoi aller au bout de ses vies. */
export const questionsDuGardien = (acte: number, vies: number) => MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)].aTrouver + Math.max(1, vies) - 1

// ── Ce que la page reçoit ──────────────────────────────────────────────────

/** Une question de l'expédition, telle que la page la reçoit : jamais la bonne réponse avant la sienne (invariant 1). */
export interface QuestionDExpedition extends QuestionDeCampagne {
  escale: string
}

export interface VueDeLExpedition {
  id: string
  numero: number
  /** L'acte en cours, de 0 à 2 ; 3 au bout. */
  acte: number
  /** Ses trois gardiens ; `aLui` : déjà à lui — gagné ailleurs en route, ou tiré faute d'autres (`gardiensDe`). */
  gardiens: { cle: string; vaincu: boolean; aLui?: true }[]
  /** La carte de l'acte en cours ; aucune au bout. */
  carte: CarteDUnActe | null
  ici: string | null
  trace: string[]
  /** Les escales où il peut aller. */
  permises: string[]
  vies: number
  justes: number
  question?: QuestionDExpedition
  gardien?: { trouvees: number; aTrouver: number }
  issue: IssueDExpedition
  garde?: string
  /** Les chances de la carte sont celles d'un joueur moyen : la page le dit. */
  moyen: boolean
  /** Les gestes déjà faits : le suivant porte ce rang plus un. */
  rang: number
}

/** Ce que la page de l'expédition lit en arrivant. */
export interface PageDeLExpedition {
  expedition: VueDeLExpedition | null
  /**
   * La prochaine expédition : son numéro et ses gardiens, annoncés avant le
   * départ — et ceux qu'il a déjà (`aLui`) : les garder au bout ne
   * rapporterait que l'expérience de leurs réponses, la page le dit avant.
   */
  prochaine: { numero: number; gardiens: string[]; aLui: string[] }
}

/** Ce qu'une réponse rend : son verdict, et ce qui est tombé si l'expédition finit là. */
export interface ReponseDExpedition {
  juste: boolean
  bonne: number
  anecdote: string | null
  xp: number
  expedition: VueDeLExpedition
  /** Le gardien vient de tomber : sa clé. */
  vaincu?: string
  recompenses?: PalierTombe[]
  legendaires?: string[]
}

/** Ce que rend un geste : l'expédition d'après, et, à sa fin, ce qui est tombé — le légendaire gardé. */
export interface ApresUnGeste {
  expedition: VueDeLExpedition
  recompenses?: PalierTombe[]
  legendaires?: string[]
}

/** Le nom d'un gardien, tel que la page le dit : « Le Kraken », « La Chouette d'Argent ». */
export function nomDuGardien(cle: string): string {
  return legendaire(cle)?.nom ?? cle
}

/** Dans une phrase : « le Kraken », « la Chouette d’Argent », « l’Oracle », « Janus ». */
export function leGardien(cle: string): string {
  const nom = nomDuGardien(cle)
  return /^(Le|La|Les) |^L’/.test(nom) ? nom.charAt(0).toLowerCase() + nom.slice(1) : nom
}

/** Après « à » : « au Kraken », « à la Chouette d’Argent », « à l’Oracle », « à Janus ». */
export function auGardien(cle: string): string {
  const nom = nomDuGardien(cle)
  if (nom.startsWith('Le ')) return `au ${nom.slice(3)}`
  if (nom.startsWith('Les ')) return `aux ${nom.slice(4)}`
  return `à ${leGardien(cle)}`
}

/** « La Comète est vaincue », « le Kraken est vaincu » : les noms en « La » sont les seuls au féminin. */
export const gardienAuFeminin = (cle: string) => nomDuGardien(cle).startsWith('La ')

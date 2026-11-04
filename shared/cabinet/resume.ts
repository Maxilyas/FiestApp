// Le résumé d'une traversée (la page du Cabinet au QG, le 4 novembre 2026) :
// ce que son pli dit d'elle — l'acte atteint, ses trois gardiens et ceux
// qu'il a vaincus, ses cartes, son or, ses cœurs, et chaque épreuve conclue,
// son jeu, ses étoiles, ce qui y a servi —, rangé dans
// `cabinet_traversees.resume` par le lot qui la finit. Un reflet, comme
// `cabinet_profils` : le pli reste la vérité, et un résumé se refait de lui —
// une traversée d'avant la colonne, un résumé d'une version d'avant
// (`VERSION_DU_RESUME`). La page du QG lit une ligne par traversée, jamais
// ses gestes : trente jours de traversées, c'étaient des milliers de gestes à
// rejouer à chaque ouverture.
//
// Depuis la version 2 (le 4 novembre 2026, les trophées du Cabinet), il porte
// aussi ce que ses pistes comptent d'elle (`compte`) : le lot des paliers de
// la campagne n'en lit que ce morceau (`json_extract`), une ligne par
// traversée finie, jamais ses gestes ni ses épreuves une à une.
//
// Pur (invariant 14) : une traversée finie et une traversée en route passent
// par le même chemin.

import { MANCHES_PAR_PARTIE } from './bareme'
import { defisDeLaTraversee } from './defis'
import { rangDeLaCle } from './sceaux'
import { CLES_DES_JEUX, type CleDeJeu } from './jeux/regle'
import {
  NIVEAU_MAX,
  acteDe,
  carteDeLaTraversee,
  coeursMax,
  consequencesDe,
  etapeDe,
  etatDuDepart,
  gardienDeLaTraversee,
  jeuDeLAssaut,
  jouerUnGesteDeLaTraversee,
  partieEnCours,
  themeDeLEtape,
  type Acte,
  type AidesDUneEpreuve,
  type CarteEnMain,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraverseeEcrit,
  type NiveauDeCarte,
  type OuEnEst,
} from './traversee'

/**
 * La forme du résumé, telle qu'écrite : un résumé d'une autre version se refait de son pli. La 2 (le 4 novembre 2026) a
 * quitté les épreuves de maître et pris ce que les pistes du Cabinet comptent (`compte`), les cœurs de chaque épreuve
 * et ceux qui restaient au coup final ; la relecture du démarrage refait les résumés d'avant (`CabinetStore.relireLesDefis`).
 */
export const VERSION_DU_RESUME = 2

/** Une épreuve conclue — ou un assaut contre un gardien —, telle que le pli l'a payée. */
export interface EpreuveResumee {
  /** Sa partie (`campagne_series.id`) : ce que ses manches ont posé de contenu s'y lit. */
  partie: string
  jeu: CleDeJeu
  acte: Acte
  /** Un assaut contre le gardien de l'acte. */
  gardien?: true
  /** Le thème qui s'est joué : celui de l'étape, ou celui qu'il a choisi au Quiz. */
  theme?: string
  /** Les étoiles naturelles de chaque manche ; null : jamais ouverte. */
  etoiles: (number | null)[]
  /** Les manches misées (Quitte ou double). */
  misees?: number
  /** Ce qui y a servi, quand la conclusion le dit (depuis le 1er novembre 2026). */
  aides?: AidesDUneEpreuve
  /** Le temps de jeu de chaque manche, quand la conclusion le dit (depuis le 4 novembre 2026). */
  durees?: (number | null)[]
  /** « Quitter ? » : il l'a quittée quand rien ne l'arrêtait encore. */
  quittee?: true
  /** Le gardien y est tombé. */
  vaincu?: true
  /** Le dernier cœur y est tombé. */
  perdue?: true
  /** Les cœurs qu'elle a coûtés, quand elle en a coûté (la Parade comprise : une manche parée ne coûte rien). */
  coeurs?: number
  /** Le gardien tombé : ses cœurs au coup final, avant qu'il ne les rende tous (`BilanDEpreuve.restants`). */
  restants?: number
}

/**
 * Ce que les pistes du Cabinet comptent d'une traversée (le 4 novembre 2026) : un reflet compact du pli, que le lot des
 * paliers de la campagne lit seul (`lectureDesComptesDuCabinet`, `server/src/core/cabinet/tables.ts`) — une ligne par
 * traversée finie, jamais ses gestes.
 */
export interface CompteDeLaTraversee {
  /** Ses épreuves menées au bout — ni quittées, ni jamais ouvertes —, assauts compris, jeu par jeu. */
  jeux: Partial<Record<CleDeJeu, number>>
  /** Celles à trois étoiles naturelles à chacune de leurs trois manches. */
  parfaites: number
  /** L'or qu'elle a rapporté : ses gains, jamais ce qu'il a dépensé. */
  or: number
}

/** Une épreuve menée au bout : il ne l'a pas quittée, et une manche au moins s'est jouée — une partie introuvable se conclut sans rien. */
export const meneeAuBout = (ep: Pick<EpreuveResumee, 'quittee' | 'etoiles'>): boolean => !ep.quittee && ep.etoiles.some(s => s !== null)

/** Une épreuve parfaite : trois étoiles naturelles à chacune de ses trois manches — un gardien tombé avant la troisième ne l'est pas. */
export const parfaite = (ep: Pick<EpreuveResumee, 'etoiles'>): boolean => ep.etoiles.length === MANCHES_PAR_PARTIE && ep.etoiles.every(s => s === 3)

export interface ResumeDeLaTraversee {
  v: typeof VERSION_DU_RESUME
  /** L'acte où il en est, ou celui où elle a fini — l'acte III pour une traversée gagnée. */
  acte: Acte
  /** Ce qu'il faisait en dernier : au choix de ses cartes, devant la carte, dans une épreuve… */
  ou: OuEnEst['sorte']
  /** Ses trois gardiens, acte par acte. */
  gardiens: string[]
  vaincus: string[]
  /** Ses assauts contre le gardien de chaque acte. */
  assauts: number[]
  /** Ses cartes, au niveau où il les a laissées ; aucune s'il ne les a pas choisies. */
  cartes: CarteEnMain[]
  or: number
  coeurs: number
  /** Ses cœurs au plus, la Panacée comprise. */
  coeursMax: number
  /** Le jeu de l'épreuve qui se joue — en route, devant elle ou en plein assaut. */
  enJeu?: CleDeJeu
  epreuves: EpreuveResumee[]
  /** Ce que les pistes du Cabinet comptent d'elle. */
  compte: CompteDeLaTraversee
  /** Les rangs des défis de ses cartes tombés pendant elle. */
  defis: number
  /** L'heure de son dernier geste — le sien ou celui de ses épreuves, jamais « rendre », de l'administrateur ; null : aucun. */
  dernier: number | null
}

/**
 * Le résumé d'une traversée, de son départ et de ses gestes, dans l'ordre :
 * le pli de `traversee.ts`, geste par geste — un geste que la relecture
 * refuse compte à son rang, comme dans `etatDeLaTraversee` —, et chaque
 * épreuve relevée au geste qui la conclut.
 */
export function resumeDeLaTraversee(d: DepartDeLaTraversee, gestes: readonly GesteDeLaTraverseeEcrit[]): ResumeDeLaTraversee {
  let e: EtatDeLaTraversee = etatDuDepart(d)
  const assauts = d.actes.map(() => 0)
  const enCours = new Map<string, Omit<EpreuveResumee, 'partie' | 'etoiles'>>()
  const epreuves: EpreuveResumee[] = []
  // L'or qu'elle rapporte : ce que chaque geste ajoute à la bourse — une épreuve, un coffre, un gardien —, jamais ce que
  // le marchand en prend.
  let orGagne = 0
  for (const { geste: g, faitLe } of gestes) {
    const apres = jouerUnGesteDeLaTraversee(d, e, g, faitLe)
    if (typeof apres === 'string') {
      e = { ...e, rang: e.rang + 1, ignores: e.ignores + 1 }
      continue
    }
    if (apres.or > e.or) orGagne += apres.or - e.or
    if (g.quoi === 'epreuve') {
      const etape = etapeDe(d, g.etape)
      const acte = acteDe(g.etape)
      const gardien = etape?.sorte === 'gardien'
      // L'assaut que ce geste engage : le pli vient de le compter (`assauts`, remis à zéro à chaque acte).
      const jeu = gardien ? jeuDeLAssaut(d.actes[acte], apres.assauts) : etape?.jeu
      if (gardien) assauts[acte]++
      const theme = etape && !gardien ? themeDeLEtape(etape, g.theme)?.theme : undefined
      if (jeu) enCours.set(g.partie, { jeu, acte, ...(gardien && { gardien: true as const }), ...(theme && { theme }) })
    }
    if (g.quoi === 'conclure' && apres.derniere) {
      const ep = enCours.get(g.partie)
      enCours.delete(g.partie)
      const b = apres.derniere
      if (ep) {
        const etoiles = Array.from({ length: MANCHES_PAR_PARTIE }, (_, k) => g.manches[k]?.etoiles ?? null)
        const misees = g.manches.filter(m => m.misee).length
        epreuves.push({
          partie: g.partie,
          ...ep,
          etoiles,
          ...(misees > 0 && { misees }),
          ...(g.aides && { aides: g.aides }),
          ...(g.durees && { durees: [...g.durees] }),
          ...(quittee(d, e, g, etoiles) && { quittee: true as const }),
          ...(b.vaincu && { vaincu: true as const }),
          ...(b.perdue && { perdue: true as const }),
          ...(b.coeurs > 0 && { coeurs: b.coeurs }),
          ...(b.vaincu && b.restants !== undefined && { restants: b.restants }),
        })
      }
    }
    e = apres
  }
  const cles = defisDeLaTraversee(d, gestes).cles
  const enJeu = e.fin ? undefined : enCours.get(partieEnCours(e) ?? '')?.jeu
  // Son dernier passage : un geste de lui ou de ses épreuves — « rendre » est celui de l'administrateur, pas le sien.
  const siens = gestes.filter(g => g.geste.quoi !== 'rendre')
  const jeux: Partial<Record<CleDeJeu, number>> = {}
  for (const ep of epreuves) if (meneeAuBout(ep)) jeux[ep.jeu] = (jeux[ep.jeu] ?? 0) + 1
  return {
    v: VERSION_DU_RESUME,
    acte: e.acte,
    ou: e.ou.sorte,
    gardiens: d.actes.map(a => a.gardien),
    vaincus: [...e.vaincus],
    assauts,
    cartes: e.cartes.map(c => ({ cle: c.cle, niveau: c.niveau })),
    or: e.or,
    coeurs: e.coeurs,
    coeursMax: coeursMax(d, e.cartes),
    ...(enJeu && { enJeu }),
    epreuves,
    compte: { jeux, parfaites: epreuves.filter(parfaite).length, or: orGagne },
    defis: cles.filter(c => rangDeLaCle(c) !== null).length,
    dernier: siens.length > 0 ? siens[siens.length - 1].faitLe : null,
  }
}

/**
 * Le « Quitter ? » du joueur : la conclusion le dit depuis le 4 novembre 2026 (`quittee`, de la partie). Avant, une
 * manche jamais ouverte alors que rien n'arrêtait l'épreuve — ni le gardien à terre, ni le dernier cœur, que la page
 * et le serveur quittent d'eux-mêmes : comptées ce qu'elles ont joué, sans les manches pas jouées. Ce qu'on ne sait pas
 * d'avant : une épreuve quittée en pleine dernière manche, qui se lit ratée.
 */
function quittee(d: DepartDeLaTraversee, avant: EtatDeLaTraversee, g: Extract<GesteDeLaTraverseeEcrit['geste'], { quoi: 'conclure' }>, etoiles: readonly (number | null)[]): boolean {
  if (g.durees) return g.quittee === true
  if (!etoiles.some(s => s === null) || etoiles.every(s => s === null)) return false
  const ou = avant.ou
  if ((ou.sorte !== 'epreuve' && ou.sorte !== 'gardien') || ou.partie !== g.partie) return false
  const jouees = consequencesDe(d, avant, { etape: ou.etape, partie: g.partie, manches: g.manches, enCours: true })
  return !jouees.bilan.vaincu && !jouees.bilan.perdue
}

// ── La relecture ──────────────────────────────────────────────────────────

type Brut = Readonly<Record<string, unknown>>
const objet = (x: unknown): x is Brut => typeof x === 'object' && x !== null && !Array.isArray(x)
const entier = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max
const unActe = (x: unknown): x is Acte => entier(x, 0, 2)
const unJeu = (x: unknown): x is CleDeJeu => typeof x === 'string' && (CLES_DES_JEUX as readonly string[]).includes(x)
const desGardiens = (x: unknown): x is string[] => Array.isArray(x) && x.every(g => gardienDeLaTraversee(g) !== null)
const troisOuNull = (x: unknown, max: number): x is (number | null)[] =>
  Array.isArray(x) && x.length === MANCHES_PAR_PARTIE && x.every(v => v === null || entier(v, 0, max))
const SORTES_D_UN_OU: readonly OuEnEst['sorte'][] = ['cartes', 'carte', 'epreuve', 'coffre', 'marchand', 'gardien', 'legendaire']

function lEpreuve(x: unknown): EpreuveResumee | null {
  if (!objet(x) || typeof x.partie !== 'string' || x.partie.length === 0 || x.partie.length > 64 || !unJeu(x.jeu) || !unActe(x.acte)) return null
  if (!troisOuNull(x.etoiles, 3) || !(x.durees === undefined || troisOuNull(x.durees, Number.MAX_SAFE_INTEGER))) return null
  if (!(x.theme === undefined || (typeof x.theme === 'string' && x.theme.length <= 120)) || !(x.misees === undefined || entier(x.misees, 1, MANCHES_PAR_PARTIE))) return null
  const aides = x.aides
  if (!(aides === undefined || (objet(aides) && entier(aides.eclairer, 0, 99) && entier(aides.changer, 0, 99) && entier(aides.temps, 0, MANCHES_PAR_PARTIE)))) return null
  const drapeau = (v: unknown) => v === undefined || v === true
  if (![x.gardien, x.quittee, x.vaincu, x.perdue].every(drapeau)) return null
  if (!(x.coeurs === undefined || entier(x.coeurs, 1, 99)) || !(x.restants === undefined || entier(x.restants, 0, 99))) return null
  return {
    partie: x.partie,
    jeu: x.jeu,
    acte: x.acte,
    ...(x.gardien === true && { gardien: true as const }),
    ...(typeof x.theme === 'string' && { theme: x.theme }),
    etoiles: [...x.etoiles],
    ...(typeof x.misees === 'number' && { misees: x.misees }),
    ...(aides !== undefined && { aides: { eclairer: aides.eclairer as number, changer: aides.changer as number, temps: aides.temps as number } }),
    ...(x.durees !== undefined && { durees: [...(x.durees as (number | null)[])] }),
    ...(x.quittee === true && { quittee: true as const }),
    ...(x.vaincu === true && { vaincu: true as const }),
    ...(x.perdue === true && { perdue: true as const }),
    ...(typeof x.coeurs === 'number' && { coeurs: x.coeurs }),
    ...(typeof x.restants === 'number' && { restants: x.restants }),
  }
}

/**
 * Ce que les pistes comptent d'une traversée, relu de son résumé — ou du seul morceau que le lot des paliers en extrait
 * (`json_extract(resume, '$.compte')`) ; null : absent ou abîmé. Un jeu inconnu de ce code se tait, comme une
 * traversée qu'il ne relit pas.
 */
export function lireLeCompte(brut: unknown): CompteDeLaTraversee | null {
  let x: unknown = brut
  if (typeof brut === 'string') {
    try {
      x = JSON.parse(brut)
    } catch {
      return null
    }
  }
  if (!objet(x) || !objet(x.jeux) || !entier(x.parfaites, 0, 999) || !entier(x.or, 0, 1_000_000)) return null
  const jeux: Partial<Record<CleDeJeu, number>> = {}
  for (const [jeu, n] of Object.entries(x.jeux)) {
    if (!entier(n, 0, 999)) return null
    if (unJeu(jeu)) jeux[jeu] = n
  }
  return { jeux, parfaites: x.parfaites, or: x.or }
}

/**
 * Un résumé relu de sa colonne, champ par champ ; null : absent, illisible,
 * ou d'une autre version — la page le refait de son pli. Sa forme seulement,
 * jamais les règles du jour : un résumé d'hier se relit tel qu'il s'est écrit.
 */
export function lireLeResume(brut: unknown): ResumeDeLaTraversee | null {
  let r: unknown = brut
  if (typeof brut === 'string') {
    try {
      r = JSON.parse(brut)
    } catch {
      return null
    }
  }
  if (!objet(r) || r.v !== VERSION_DU_RESUME || !unActe(r.acte) || !(SORTES_D_UN_OU as readonly unknown[]).includes(r.ou)) return null
  if (!desGardiens(r.gardiens) || !desGardiens(r.vaincus) || !Array.isArray(r.assauts) || !r.assauts.every(a => entier(a, 0, 999))) return null
  if (!entier(r.or, 0, 1_000_000) || !entier(r.coeurs, 0, 99) || !entier(r.coeursMax, 0, 99) || !entier(r.defis, 0, 999)) return null
  if (!(r.dernier === null || entier(r.dernier, 0, Number.MAX_SAFE_INTEGER)) || !(r.enJeu === undefined || unJeu(r.enJeu))) return null
  if (!Array.isArray(r.cartes) || !Array.isArray(r.epreuves)) return null
  const cartes = r.cartes.map(c => (objet(c) && carteDeLaTraversee(c.cle) && entier(c.niveau, 1, NIVEAU_MAX) ? { cle: carteDeLaTraversee(c.cle)!.cle, niveau: c.niveau as NiveauDeCarte } : null))
  const epreuves = r.epreuves.map(lEpreuve)
  const compte = lireLeCompte(r.compte)
  if (cartes.some(c => c === null) || epreuves.some(x => x === null) || !compte) return null
  return {
    v: VERSION_DU_RESUME,
    acte: r.acte,
    ou: r.ou as OuEnEst['sorte'],
    gardiens: [...r.gardiens],
    vaincus: [...r.vaincus],
    assauts: [...(r.assauts as number[])],
    cartes: cartes as CarteEnMain[],
    or: r.or,
    coeurs: r.coeurs,
    coeursMax: r.coeursMax,
    ...(r.enJeu !== undefined && { enJeu: r.enJeu as CleDeJeu }),
    epreuves: epreuves as EpreuveResumee[],
    compte,
    defis: r.defis,
    dernier: r.dernier as number | null,
  }
}

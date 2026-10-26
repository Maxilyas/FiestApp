// Le musée d'un profil, et ce qui s'en dérive : ce qu'il possède et ce qui est
// doré, son solde de poussière, ses salles complètes et les gardiens qu'elles
// lui doivent, la visite du jour, la série, et pourquoi un départ, un achat,
// une dorure ou un échange se refusent. Pur : le serveur le tient en mémoire
// (`MuseeGarde`, `core/cabinet/magasin.ts`), la page le lit pour griser, le
// calibrage pour simuler — aucun ne recopie une règle.
//
// Ce qu'il lit sont des faits et des reflets écrits (`cabinet_oeuvres`, une
// ligne par œuvre entrée ; `cabinet_profils`, une ligne par profil ; les
// parties du jour, sans leur plan) : aucune lecture ne grandit avec l'histoire
// (D7). Une œuvre entrée ne sort jamais, et les quatre œuvres de départ sont
// à tout le monde par règle, sans ligne (invariant 22).

import { hasardDe } from '../missions'
import { jourAvant } from '../jour'
import type { CleDeSaison } from '../saisons'
import { formatNumber } from '../typographie'
import {
  CASES_DE_LA_VISITE,
  CHASSES_PAR_JOUR,
  JOURS_DU_SCARABEE,
  JOURS_QUI_PASSENT_APRES,
  LIBRES_QUI_PAIENT,
  POIDS_DES_CIBLES,
  PRIX_D_UNE_DORURE,
  PRIX_D_UNE_OEUVRE,
  SEUILS_DES_RARETES,
} from './bareme'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, estUneOeuvre, oeuvre, oeuvresDeLaSalle, type CleDOeuvre, type Oeuvre, type Rarete } from './oeuvres'
import { JEUX_PRETS } from './ouverture'
import { forceDe, pouvoirDe } from './pouvoirs'
import { AUTRES_GARDIENS, GARDIENS_DES_SALLES, SALLES, pouvoirDuGardien, voieDuGardien, type CleDeSalle } from './salles'
import type { CarteDuDepart, IssueDUnePartie, Manche, OrigineDUnePartie } from './partie'
import type { RetenteVue } from './vues'
import { battre } from './jeux/outils'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from './jeux/regle'

// ── Ce que le musée lit ───────────────────────────────────────────────────

/**
 * Comment une œuvre est entrée : gagnée en jouant, achetée, ou l'une des quatre
 * offertes à l'arrivée. Rien ne se rapporte de l'Expédition : chacun commence
 * son musée à zéro (la décision du propriétaire du 25 octobre 2026).
 */
export type OrigineDUneOeuvre = 'partie' | 'achat' | 'depart'

/** Une ligne de `cabinet_oeuvres` : une œuvre entrée, et ce qu'elle a coûté, au prix du jour. */
export interface LigneDOeuvre {
  oeuvre: string
  origine: OrigineDUneOeuvre
  gagneeLe: number
  /** La fête du jour où elle est entrée en jouant ; jamais pour un achat ni une dorure. */
  saison: CleDeSaison | null
  /** La partie dont son cartel garde une manche. */
  serieId: string | null
  prix: number | null
  doreeLe: number | null
  dorure: 'partie' | 'poussiere' | null
  prixDorure: number | null
  serieDoree: string | null
}

/** Une case de la visite figée : son jeu, l'œuvre qu'elle met en jeu, et si elle était à gagner ou à dorer. */
export interface CaseFigee {
  jeu: CleDeJeu
  cible: CleDOeuvre | null
  but: 'gagner' | 'dorer' | null
}

/**
 * La visite d'un jour, figée au premier lot du jour qui écrit — un départ, un
 * échange, une dépense, la fin d'une partie d'un jour d'avant — :
 * `cabinet_profils.visites`, les trois derniers jours.
 */
export interface VisiteFigee {
  jour: string
  cases: readonly CaseFigee[]
  /** La case dont le jeu a été changé, une fois par jour. */
  echange?: Manche
}

/** Une ligne de `cabinet_profils` : des reflets, tenus dans les lots qui les changent. */
export interface LigneDuProfil {
  /** La poussière gagnée, toutes parties : la somme des bilans. */
  poussiere: number
  serie: number
  serieJour: string | null
  serieRecord: number
  visites: readonly VisiteFigee[]
  partie: string | null
}

/** Une partie du jour de Paris, sans son plan : ce que la visite, les chasses et les libres comptent. */
export interface PartieDuJour {
  id: string
  commenceeLe: number
  finieLe: number | null
  issue: IssueDUnePartie | null
  origine: OrigineDUnePartie
  visite: Manche | null
  jeu: CleDeJeu
  cible: string | null
  payee: boolean
  total: number | null
}

export interface Musee {
  /** Null : il n'a jamais joué au Cabinet. */
  profil: LigneDuProfil | null
  oeuvres: ReadonlyMap<string, LigneDOeuvre>
  duJour: { jour: string; parties: readonly PartieDuJour[] }
  /** Les légendaires qu'il a, par quelque voie que ce soit : un gardien réveillé, qu'il emporte en carte-bonus. */
  legendaires: ReadonlySet<string>
  /** La partie en cours, et son jeu : une à la fois. */
  enCours: { id: string; jeu: CleDeJeu } | null
}

/** Un musée, de ce que le lot froid a lu. */
export function museeDe(o: {
  jour: string
  profil?: LigneDuProfil | null
  oeuvres?: readonly LigneDOeuvre[]
  parties?: readonly PartieDuJour[]
  legendaires?: Iterable<string>
  enCours?: { id: string; jeu: CleDeJeu } | null
}): Musee {
  return {
    profil: o.profil ?? null,
    oeuvres: new Map((o.oeuvres ?? []).map(l => [l.oeuvre, l])),
    duJour: { jour: o.jour, parties: [...(o.parties ?? [])] },
    legendaires: new Set(o.legendaires ?? []),
    enCours: o.enCours ?? null,
  }
}

// ── Ce qu'il possède ──────────────────────────────────────────────────────

/** Ses œuvres : celles qui ont une ligne, et les quatre de départ, par règle. */
export function possedees(m: Musee): Set<CleDOeuvre> {
  const a = new Set<CleDOeuvre>(OEUVRES_DE_DEPART)
  for (const cle of m.oeuvres.keys()) if (estUneOeuvre(cle)) a.add(cle)
  return a
}

/** Ses œuvres au cadre doré : une œuvre de départ ne l'est que si sa ligne le dit. */
export function dorees(m: Musee): Set<CleDOeuvre> {
  const d = new Set<CleDOeuvre>()
  for (const [cle, l] of m.oeuvres) if (estUneOeuvre(cle) && l.doreeLe !== null) d.add(cle)
  return d
}

/** Ce qu'il a dépensé : ses œuvres achetées et ses cadres dorés à la poussière, chacun au prix payé — 84 lignes au plus. */
export function depensesDe(m: Musee): number {
  let n = 0
  for (const l of m.oeuvres.values()) n += (l.prix ?? 0) + (l.prixDorure ?? 0)
  return n
}

/** Son solde de poussière d'or : gagnée, moins dépensée. La base ne le laisse jamais passer sous zéro (`INSERT … WHERE solde >= prix`). */
export const soldeDe = (m: Musee): number => Math.max(0, (m.profil?.poussiere ?? 0) - depensesDe(m))

/** Les salles dont il a toutes les œuvres. */
export function sallesCompletes(m: Musee): CleDeSalle[] {
  const a = possedees(m)
  return SALLES.filter(s => oeuvresDeLaSalle(s.cle).every(o => a.has(o.cle))).map(s => s.cle)
}

/** Les salles dont tous les cadres sont dorés. */
export function sallesDorees(m: Musee): CleDeSalle[] {
  const d = dorees(m)
  return SALLES.filter(s => oeuvresDeLaSalle(s.cle).every(o => d.has(o.cle))).map(s => s.cle)
}

// ── Les gardiens ──────────────────────────────────────────────────────────

/** Un gardien que le musée doit, et ce qui le range sur l'étagère (`cabinet:phenix`, `saison:halloween`). */
export interface GardienDu {
  legendaire: string
  voie: string
}

/**
 * Les gardiens que le musée doit : chaque salle complète son premier, chaque
 * salle toute dorée son second, les 84 œuvres le Trou noir, trente jours
 * d'affilée le Scarabée, et chaque fête où une œuvre est entrée en jouant son
 * gardien. La réconciliation (`core/cabinet/gardiens.ts`) compare à ce qui est
 * rangé et range ce qui manque, sans rien reprendre : une œuvre peinte de plus
 * rouvre une salle sans endormir son gardien.
 */
export function gardiensDus(m: Musee): GardienDu[] {
  const dus = new Set<string>()
  const completes = new Set(sallesCompletes(m))
  const doreesToutes = new Set(sallesDorees(m))
  for (const s of SALLES) {
    const [premier, second] = GARDIENS_DES_SALLES[s.cle]
    if (completes.has(s.cle)) dus.add(premier)
    if (doreesToutes.has(s.cle)) dus.add(second)
  }
  const a = possedees(m)
  const record = Math.max(m.profil?.serie ?? 0, m.profil?.serieRecord ?? 0)
  const fetes = new Set<CleDeSaison>()
  for (const l of m.oeuvres.values()) if (l.origine === 'partie' && l.saison !== null) fetes.add(l.saison)
  for (const g of AUTRES_GARDIENS) {
    const r = g.reveil
    if (('tout' in r && OEUVRES.every(o => a.has(o.cle))) || ('serie' in r && record >= JOURS_DU_SCARABEE) || ('saison' in r && fetes.has(r.saison))) dus.add(g.legendaire)
  }
  // Dans l'ordre des gardiens : salle par salle, puis les cinq autres.
  return [...Object.values(GARDIENS_DES_SALLES).flat(), ...AUTRES_GARDIENS.map(g => g.legendaire)]
    .filter(g => dus.has(g))
    .map(legendaire => ({ legendaire, voie: voieDuGardien(legendaire)! }))
}

/**
 * Le prochain gardien : la salle la plus près d'être complète dont le premier
 * gardien dort — par aucune voie il n'est à lui —, la première à égalité.
 * « La Chouette d'Argent : encore 2 œuvres dans la salle de l'Érudit. »
 */
export function prochainGardien(m: Musee): { legendaire: string; salle: CleDeSalle; manquent: number } | null {
  const a = possedees(m)
  return lePlusPres(cle => a.has(cle), premier => !m.legendaires.has(premier))
}

/** La salle la plus près d'être complète, à ce qu'il a, dont le premier gardien dort ; la première à égalité. */
function lePlusPres(aLui: (cle: CleDOeuvre) => boolean, dort: (premier: string, salle: CleDeSalle) => boolean): { legendaire: string; salle: CleDeSalle; manquent: number } | null {
  let mieux: { legendaire: string; salle: CleDeSalle; manquent: number } | null = null
  for (const s of SALLES) {
    const [premier] = GARDIENS_DES_SALLES[s.cle]
    const manquent = oeuvresDeLaSalle(s.cle).filter(o => !aLui(o.cle)).length
    if (manquent === 0 || !dort(premier, s.cle)) continue
    if (!mieux || manquent < mieux.manquent) mieux = { legendaire: premier, salle: s.cle, manquent }
  }
  return mieux
}

/**
 * La salle du prochain gardien tel qu'il était à minuit — celle qu'une case de
 * la visite vise chaque jour : ce qu'il avait à cette heure (`aMinuit`), et
 * pour endormi un premier gardien que la salle complétée depuis a réveillé.
 * Ce que la règle ne peut pas savoir : d'un gardien qui veille sur une salle
 * complétée depuis minuit, s'il dormait à minuit ou veillait déjà, venu
 * d'ailleurs — l'achat de la dernière œuvre du Rempart sous le Phénix d'une
 * expédition faisait passer la dernière case vers elle (la relecture du
 * 26 octobre 2026). C'est le serveur qui tient la visite : tout lot qui fait
 * entrer une œuvre après minuit la fige d'abord — un départ, la première
 * dépense du jour, la fin d'une partie d'un jour d'avant —, et une œuvre du
 * jour ne passe jamais par ici. Reste qu'un gardien venu d'ailleurs le même
 * jour, avant tout lot — un palier —, la change encore : il rendait déjà
 * inutile la case qui visait sa salle.
 */
function salleDuProchainGardienAMinuit(m: Musee, aMinuit: (cle: CleDOeuvre) => boolean): CleDeSalle | null {
  const a = possedees(m)
  const completeDepuis = (salle: CleDeSalle) => oeuvresDeLaSalle(salle).every(o => a.has(o.cle))
  return lePlusPres(aMinuit, (premier, salle) => !m.legendaires.has(premier) || completeDepuis(salle))?.salle ?? null
}

// ── La série ──────────────────────────────────────────────────────────────

/**
 * La série après un jour joué — une visite ou une chasse où il a répondu à au
 * moins une manche (`laPartieARepondu`, `shared/cabinet/partie.ts`), comptée
 * au jour de son départ : la règle même de l'instruction qui l'écrit
 * (`lotDuGeste`), pour la mémoire du serveur. Un jour déjà compté ne compte
 * pas deux fois, la veille la prolonge, tout autre la recommence ; un jour
 * d'avant le dernier compté — la partie d'hier close aujourd'hui — ne la fait
 * pas reculer. Comptée au départ jusqu'au 26 octobre 2026 : une visite quittée
 * d'emblée tenait la série, et trente jours sans une réponse réveillaient le
 * Scarabée.
 */
export function serieApresUnJour(profil: Pick<LigneDuProfil, 'serie' | 'serieJour' | 'serieRecord'> | null, jour: string): Pick<LigneDuProfil, 'serie' | 'serieJour' | 'serieRecord'> {
  const dernier = profil?.serieJour ?? null
  const avant = profil?.serie ?? 0
  const serie = dernier !== null && dernier >= jour ? avant : dernier === jourAvant(jour) ? avant + 1 : 1
  return { serie, serieJour: dernier !== null && dernier > jour ? dernier : jour, serieRecord: Math.max(profil?.serieRecord ?? 0, serie) }
}

/**
 * La série montrée : ses jours d'affilée à répondre à une manche de visite ou
 * de chasse, lus jusqu'à la veille tant qu'il n'a pas répondu aujourd'hui —
 * « 12 jours de visite d'affilée. Réponds à une manche aujourd'hui pour garder
 * ta série. » Rompue, zéro ; son record reste (le Scarabée le lit).
 */
export function serieMontree(profil: LigneDuProfil | null, jour: string): { jours: number; aJouer: boolean; record: number } {
  const dernier = profil?.serieJour ?? null
  const veille = jourAvant(jour)
  const vivante = dernier === jour || dernier === veille
  return { jours: vivante ? (profil?.serie ?? 0) : 0, aJouer: dernier === veille, record: profil?.serieRecord ?? 0 }
}

// ── La visite du jour ─────────────────────────────────────────────────────

/** La visite d'un jour, telle que la page et le départ la lisent : figée, ou dérivée — rien ne coûte avant de jouer. */
export interface VisiteDuJour {
  jour: string
  cases: readonly CaseFigee[]
  echange: Manche | null
  /** Déjà écrite dans `cabinet_profils.visites` : elle ne change plus de la journée. */
  figee: boolean
}

/**
 * Ce que la visite tire de son hasard : la graine du profil, que le serveur
 * tient — faite seulement de ce que la page connaît (son profil, le jour), la
 * page referait le tirage et lirait l'œuvre visée de chaque case, qu'elle ne
 * doit pas savoir avant de l'avoir gagnée.
 */
export interface GraineDeLaVisite {
  /**
   * `HMAC-SHA256(secret du Cabinet, profileId)`, en hexadécimal : le secret se
   * tire une fois et se garde en base (`campagne_meta`, lu dans le premier lot
   * d'`init`, le gabarit de `jour_rappels_cles`), jamais dans une variable
   * d'environnement ni en mémoire seule. La visite d'un profil qui n'a pas
   * encore joué n'est écrite nulle part : tirée d'un secret neuf à chaque
   * réveil — la production dort chaque nuit —, elle aurait changé entre deux
   * pages, et deux serveurs pendant une mise en ligne en auraient montré deux.
   * Le serveur la calcule (`core/cabinet/`) ; ce module ne connaît que son
   * résultat.
   */
  graine: string
  jour: string
  /** Minuit de Paris, ce jour-là : les œuvres en jeu se tirent parmi ce qui lui manquait à cette heure. */
  minuit: number
  /** Les jeux livrés (`JEUX_PRETS`) ; un essai en passe d'autres. */
  jeux?: readonly CleDeJeu[]
}

/** L'ordre des jeux d'un jour : les jeux livrés battus sur la graine du profil et du jour. Il ne dépend que d'elle — pas de récurrence d'un jour à l'autre. */
const ordreDuJour = (graine: string, jour: string, jeux: readonly CleDeJeu[]) => battre(jeux, hasardDe(`${graine}:visite:${jour}`))

/** Les jeux qu'une visite a eus : figés, ou les premiers de l'ordre de son jour. */
function jeuxDUnJour(graine: string, jour: string, figees: readonly VisiteFigee[], jeux: readonly CleDeJeu[]): CleDeJeu[] {
  const figee = figees.find(v => v.jour === jour)
  return figee ? figee.cases.map(c => c.jeu) : ordreDuJour(graine, jour, jeux).slice(0, CASES_DE_LA_VISITE)
}

/** Les jeux des visites des jours d'avant (`JOURS_QUI_PASSENT_APRES`), échange compris : ils passent après les autres. */
function jeuxRecents(graine: string, jour: string, figees: readonly VisiteFigee[], jeux: readonly CleDeJeu[]): Set<CleDeJeu> {
  const recents = new Set<CleDeJeu>()
  for (let k = 1; k <= JOURS_QUI_PASSENT_APRES; k++) for (const j of jeuxDUnJour(graine, jourAvant(jour, k), figees, jeux)) recents.add(j)
  return recents
}

/** Un tirage au poids de la rareté (`POIDS_DES_CIBLES`) : surtout des communes, une maudite ou une épique de temps en temps. */
function tirerPese(candidates: readonly Oeuvre[], hasard: () => number): Oeuvre {
  const total = candidates.reduce((n, o) => n + POIDS_DES_CIBLES[o.rarete], 0)
  let x = hasard() * total
  for (const o of candidates) {
    x -= POIDS_DES_CIBLES[o.rarete]
    if (x < 0) return o
  }
  return candidates[candidates.length - 1]
}

/**
 * La visite du jour : trois jeux différents, ceux des visites des deux jours
 * d'avant passés au bout ; trois œuvres distinctes en jeu, parmi celles qui
 * lui manquaient à minuit — la visite ne change pas pendant le jour —, au
 * poids de leur rareté, l'une de la salle du prochain gardien tant qu'il en
 * reste un (`salleDuProchainGardienAMinuit`) ; rien ne manque, une à dorer ;
 * rien du tout, la poussière d'or. Figée, elle se relit telle quelle : un jeu livré dans la
 * journée ne change pas la visite d'un joueur qui l'a commencée. Moins de
 * trois jeux livrés, moins de cases : trois jeux différents, toujours.
 */
export function visiteDuJour(m: Musee, o: GraineDeLaVisite): VisiteDuJour {
  const figees = m.profil?.visites ?? []
  const figee = figees.find(v => v.jour === o.jour)
  if (figee) return { jour: o.jour, cases: figee.cases.map(c => ({ ...c })), echange: figee.echange ?? null, figee: true }
  const jeux = o.jeux ?? JEUX_PRETS
  const recents = jeuxRecents(o.graine, o.jour, figees, jeux)
  const ordre = ordreDuJour(o.graine, o.jour, jeux)
  const duJour = [...ordre.filter(j => !recents.has(j)), ...ordre.filter(j => recents.has(j))].slice(0, CASES_DE_LA_VISITE)
  // Ce qu'il avait à minuit : une œuvre gagnée depuis le matin compte encore pour à gagner.
  const aMinuit = (cle: CleDOeuvre) => OEUVRES_DE_DEPART.includes(cle) || (m.oeuvres.get(cle)?.gagneeLe ?? Number.POSITIVE_INFINITY) < o.minuit
  const doreeAMinuit = (cle: CleDOeuvre) => (m.oeuvres.get(cle)?.doreeLe ?? Number.POSITIVE_INFINITY) < o.minuit
  let manquantes = OEUVRES.filter(x => !aMinuit(x.cle))
  let aDorer = OEUVRES.filter(x => aMinuit(x.cle) && !doreeAMinuit(x.cle))
  const hasard = hasardDe(`${o.graine}:cibles:${o.jour}`)
  const salleDuGardien = salleDuProchainGardienAMinuit(m, aMinuit)
  let gardienVise = false
  const cases = duJour.map((jeu, k): CaseFigee => {
    if (manquantes.length > 0) {
      // La dernière case vise la salle du prochain gardien, si aucune autre ne l'a fait : au seul poids des raretés, la
      // visite remplissait les neuf salles à la fois, et l'occasionnel attendait son premier gardien au 38ᵉ jour (la
      // synthèse de la tablée du 25 octobre 2026, § 10). Le même tirage, sur moins d'œuvres : les cases d'avant ne changent pas.
      const deSaSalle = k === duJour.length - 1 && !gardienVise && salleDuGardien !== null ? manquantes.filter(x => x.salle === salleDuGardien) : []
      const cible = tirerPese(deSaSalle.length > 0 ? deSaSalle : manquantes, hasard)
      if (cible.salle === salleDuGardien) gardienVise = true
      manquantes = manquantes.filter(x => x !== cible)
      return { jeu, cible: cible.cle, but: 'gagner' }
    }
    if (aDorer.length > 0) {
      const cible = tirerPese(aDorer, hasard)
      aDorer = aDorer.filter(x => x !== cible)
      return { jeu, cible: cible.cle, but: 'dorer' }
    }
    return { jeu, cible: null, but: null }
  })
  return { jour: o.jour, cases, echange: null, figee: false }
}

/** La visite telle qu'elle s'écrit au premier lot du jour qui écrit. */
export const visiteFigee = (v: VisiteDuJour): VisiteFigee => ({ jour: v.jour, cases: v.cases.map(c => ({ ...c })), ...(v.echange !== null && { echange: v.echange }) })

/** Les visites que `cabinet_profils.visites` garde : celle du jour d'abord, puis les jours d'avant que la rotation relit. */
export function visitesAGarder(v: VisiteDuJour, figees: readonly VisiteFigee[]): VisiteFigee[] {
  return [visiteFigee(v), ...figees.filter(f => f.jour !== v.jour && f.jour < v.jour)].sort((a, b) => (a.jour < b.jour ? 1 : -1)).slice(0, JOURS_QUI_PASSENT_APRES + 1)
}

/** Une case de la visite déjà commencée aujourd'hui : elle se consomme au départ, quitter ne la rend pas. */
export const caseCommencee = (m: Musee, k: number): boolean => m.duJour.parties.some(p => p.origine === 'visite' && p.visite === k)

/** Ce que la case met en jeu, sans nommer l'œuvre visée tant qu'elle n'est pas à lui : une rareté et une salle, ou l'œuvre à dorer, ou la poussière. */
export type EnjeuDUneCase = { rarete: Rarete; salle: CleDeSalle } | { pourDorer: CleDOeuvre } | { poussiere: true }

/** L'enjeu d'une case, à présent : une œuvre gagnée en chasse pendant le jour fait passer sa case « pour dorer ». */
export function enjeuDe(m: Musee, c: CaseFigee): EnjeuDUneCase {
  const o = oeuvre(c.cible)
  if (!o) return { poussiere: true }
  return possedees(m).has(o.cle) ? { pourDorer: o.cle } : { rarete: o.rarete, salle: o.salle }
}

/**
 * Le jeu qu'un échange donne : le premier de l'ordre du jour qui n'est ni de
 * la visite ni des deux jours d'avant ; s'il n'en reste pas, le premier qui
 * n'est pas de la visite.
 */
export function jeuDeLEchange(m: Musee, v: VisiteDuJour, o: Pick<GraineDeLaVisite, 'graine' | 'jeux'>): CleDeJeu | null {
  const jeux = o.jeux ?? JEUX_PRETS
  const dansLaVisite = new Set(v.cases.map(c => c.jeu))
  const recents = jeuxRecents(o.graine, v.jour, m.profil?.visites ?? [], jeux)
  const ordre = ordreDuJour(o.graine, v.jour, jeux)
  return ordre.find(j => !dansLaVisite.has(j) && !recents.has(j)) ?? ordre.find(j => !dansLaVisite.has(j)) ?? null
}

/** Pas plus de jeux livrés que de cases : la visite les prend tous, et aucun ne reste pour en remplacer un. */
export const AUCUN_AUTRE_JEU = 'Aucun autre jeu à proposer aujourd’hui'

/** Une case qui n'est pas de la visite du jour : la jouer, l'échanger, la retenter le disent dans les mêmes mots. */
export const CHOISIS_UNE_CASE = 'Choisis une partie de la visite'

/**
 * Une case déjà commencée aujourd'hui : son départ et son échange se refusent
 * dans les mêmes mots. Il y en avait deux, « déjà faite » et « déjà jouée »,
 * et la page disait l'un sous un bouton, l'autre sous son voisin.
 */
export const CASE_DEJA_FAITE = 'Cette partie de la visite est déjà faite'

const estUneCase = (v: Pick<VisiteDuJour, 'cases'>, k: unknown): k is number => Number.isInteger(k) && (k as number) >= 0 && (k as number) < v.cases.length

/** Pourquoi la case `k` ne s'échange pas ; null : elle s'échange, une fois par jour, tant qu'elle n'est pas jouée. */
export function refusDeLEchange(m: Musee, v: VisiteDuJour, k: unknown, jeu: CleDeJeu | null): string | null {
  if (!estUneCase(v, k)) return CHOISIS_UNE_CASE
  if (v.echange !== null) return 'Tu as déjà changé un jeu aujourd’hui'
  if (caseCommencee(m, k)) return CASE_DEJA_FAITE
  return jeu === null ? AUCUN_AUTRE_JEU : null
}

/** La visite après l'échange de sa case `k` : le jeu change, l'œuvre en jeu reste. */
export function visiteEchangee(v: VisiteDuJour, k: Manche, jeu: CleDeJeu): VisiteDuJour {
  return { ...v, cases: v.cases.map((c, i) => (i === k ? { ...c, jeu } : { ...c })), echange: k }
}

// ── Le départ ─────────────────────────────────────────────────────────────

/** Ce que la page demande à « Commencer ». */
export type DemandeDeDepart =
  | { origine: 'visite'; case: number; carte: string | null }
  | { origine: 'chasse'; oeuvre: string; carte: string | null; jeu?: CleDeJeu }
  | { origine: 'libre'; jeu: string; carte: string | null }

/**
 * « Retenter cette œuvre au même jeu, pour une chasse », après une partie de
 * la visite manquée : la demande vise sa case, jamais l'œuvre. La page ne la
 * reçoit pas (invariant 1), et une demande qui la nommait faisait de l'ordre
 * des refus un oracle — de trois œuvres essayées, seule la visée partait, ou
 * se refusait pour sa carte-bonus plutôt que pour la retente : le serveur ne
 * lit plus que celle-ci (`lireLaDemande`). Elle reste hors de
 * `DemandeDeDepart`, dont la chasse nomme son œuvre : la page envoie l'une ou
 * l'autre par la demande que le serveur lit (`DemandeLue`, par
 * `api.cabinet.commencer` ; sans sa carte-bonus, `PartieDemandee`), et annonce
 * la retente à l'enjeu de sa case (`annonceDe`).
 */
export type DemandeDeRetente = { origine: 'chasse'; case: number; retente: true; carte: string | null }

/** Ce que le serveur lit à « Commencer » (`lireLaDemande`) : ce que la page demande, et « Retenter » par sa case. */
export type DemandeLue = DemandeDeDepart | DemandeDeRetente

/** Ce qu'un départ accepté fige, avant le tirage : le serveur y ajoute le plan, la graine et le thème. */
export interface CadreDuDepart {
  jeu: CleDeJeu
  origine: OrigineDUnePartie
  visite?: Manche
  cible: CleDOeuvre | null
  but: 'gagner' | 'dorer' | null
  retente?: true
  seuil: number | null
  /** Provisoire en partie libre : la base recompte les libres du jour dans l'insertion même, deux onglets ou deux serveurs. */
  payee: boolean
  carte: CarteDuDepart | null
}

const chassesDuJour = (m: Musee) => m.duJour.parties.filter(p => p.origine === 'chasse').length
const libresDuJour = (m: Musee) => m.duJour.parties.filter(p => p.origine === 'libre').length
const seuilDe = (cle: CleDOeuvre | null): number | null => (cle === null ? null : SEUILS_DES_RARETES[oeuvre(cle)!.rarete])

/**
 * Le seuil qu'une case de la visite figera à son départ : les étoiles qu'il
 * faut pour gagner son œuvre — ou, l'œuvre déjà à lui, pour son double, son
 * cadre doré demandant toutes les manches parfaites. Null : une case pour la
 * poussière d'or. La page le lit de la vue (`CaseVue.seuil`,
 * `CaseVue.seuilDuDouble`) : elle le redérivait du barème.
 */
export const seuilDeLaCase = (c: Pick<CaseFigee, 'cible'>): number | null => seuilDe(c.cible)

/** Les chasses qui restent aujourd'hui ; les libres qui paient encore. */
export const chassesRestantes = (m: Musee): number => Math.max(0, CHASSES_PAR_JOUR - chassesDuJour(m))
export const libresQuiPaientEncore = (m: Musee): number => Math.max(0, LIBRES_QUI_PAIENT - libresDuJour(m))

/**
 * Les refus d'un départ que la page dit d'avance, sous un bouton en sourdine :
 * les mêmes mots que le serveur, importés — recopiés, une phrase retouchée ici
 * aurait laissé la page en contredire le toast.
 */
export const JEU_PAS_LIVRE = 'Ce jeu arrive bientôt'
export const PLUS_DE_CHASSE = 'Plus de chasse pour aujourd’hui : elles reviennent à minuit'
/** Une clé qui n'est pas une des œuvres : une chasse, un achat, un cartel la refusent dans les mêmes mots. */
export const PAS_AU_CABINET = 'Cette œuvre n’est pas au Cabinet'
/** Une œuvre qui lui manque encore : ni dorure, ni cartel. */
export const PAS_ENCORE_A_TOI = 'Elle n’est pas encore à toi : gagne-la ou achète-la d’abord'

/** Une partie à la fois, et rien ne se dépense pendant qu'elle attend : un départ, un achat, une dorure le disent dans les mêmes mots. */
export const laPartieAttend = (jeu: CleDeJeu): string => `Ta partie ${JEUX[jeu].a} t’attend : reprends-la ou quitte-la d’abord`

/**
 * Une demande qui ne se lit pas : une origine inconnue, un départ relu de
 * travers — et une retente qui nomme son œuvre (`lireLaDemande`). La règle des
 * départs et le serveur la disent d'une seule copie.
 */
export const DEMANDE_ILLISIBLE = 'Choisis une partie de la visite, une chasse ou un jeu libre'
/** « Retenter » d'une case qui n'a pas été manquée aujourd'hui : pas jouée, gagnée, ou d'un jour d'avant. */
export const RETENTER_SANS_VISITE_MANQUEE = 'Retenter ne sert qu’après une partie de la visite manquée'
/** « Retenter » d'une case dont l'œuvre est à lui depuis — gagnée en chasse, achetée : plus rien à retenter. */
export const SON_OEUVRE_EST_A_TOI = 'Son œuvre est déjà à toi'

/** La partie de la visite manquée aujourd'hui à la case `k`, qui visait une œuvre : celle qu'une retente rejoue, à son jeu. */
function laPartieManquee(m: Musee, k: number): (PartieDuJour & { cible: CleDOeuvre }) | undefined {
  return m.duJour.parties.find((p): p is PartieDuJour & { cible: CleDOeuvre } => p.origine === 'visite' && p.visite === k && p.issue === 'manquee' && estUneOeuvre(p.cible))
}

/**
 * Une retente de la case `k` dont l'œuvre est à lui depuis sa partie manquée —
 * une chasse, un achat : elle ne partira jamais, ni la partie qui attend finie,
 * ni à minuit. La page le sait déjà : sa case se joue désormais pour la dorer.
 */
const sonOeuvreEstALui = (m: Musee, visite: VisiteDuJour, k: unknown): boolean => {
  const manquee = estUneCase(visite, k) ? laPartieManquee(m, k) : undefined
  return manquee !== undefined && possedees(m).has(manquee.cible)
}

/**
 * Ce qu'une retente de la case `k` rejoue, ou pourquoi elle ne part pas : sa
 * partie manquée, son jeu, l'œuvre qu'elle visait. Chaque refus ne dit que la
 * case — commencée ou non, manquée ou non —, que la page sait déjà ; son œuvre
 * déjà à lui s'est dite avant (`sonOeuvreEstALui`, `cadreDuDepart`).
 */
function laRetente(m: Musee, visite: VisiteDuJour, k: unknown, jeux: readonly CleDeJeu[]): { jeu: CleDeJeu; cible: CleDOeuvre } | string {
  if (!estUneCase(visite, k)) return CHOISIS_UNE_CASE
  const manquee = laPartieManquee(m, k)
  if (!manquee) return RETENTER_SANS_VISITE_MANQUEE
  return jeux.includes(manquee.jeu) ? { jeu: manquee.jeu, cible: manquee.cible } : JEU_PAS_LIVRE
}

/** La carte-bonus qu'il emporte : une œuvre qu'il a, les quatre de départ comprises, ou un gardien réveillé — jamais un Divin. */
function laCarte(m: Musee, cle: string | null): CarteDuDepart | null | string {
  if (cle === null) return null
  const aLui = estUneOeuvre(cle) ? possedees(m).has(cle) : pouvoirDuGardien(cle) !== undefined && m.legendaires.has(cle)
  const pouvoir = pouvoirDe(cle)
  const force = forceDe(cle)
  return aLui && pouvoir && force ? { cle, pouvoir, force } : 'Tu n’as pas cette carte-bonus'
}

/**
 * Le cadre d'un départ, ou son refus en mots — une seule règle, que la page
 * lit aussi pour griser. Une partie à la fois ; une case de la visite une fois
 * par jour ; deux chasses, à son jeu — « Retenter », par sa case, au jeu de la
 * visite manquée ; un jeu livré ; une carte-bonus qu'il a.
 */
export function cadreDuDepart(m: Musee, demande: DemandeLue, visite: VisiteDuJour, jeux: readonly CleDeJeu[] = JEUX_PRETS): CadreDuDepart | string {
  // Ce qui ne se fera jamais se dit avant ce qui attend, comme pour un achat (`refusDeLAchat`) : sous une case dont
  // l'œuvre est à lui, « Plus de chasse » ou « Ta partie t'attend » promettaient une retente pour plus tard — et le
  // bilan relu les gardait tels quels (`retenteDeLaCase`).
  if (demande.origine === 'chasse' && 'retente' in demande && sonOeuvreEstALui(m, visite, demande.case)) return SON_OEUVRE_EST_A_TOI
  if (m.enCours) return laPartieAttend(m.enCours.jeu)
  const a = possedees(m)
  let cadre: Omit<CadreDuDepart, 'carte'>
  switch (demande.origine) {
    case 'visite': {
      const k = demande.case
      if (!estUneCase(visite, k)) return CHOISIS_UNE_CASE
      if (caseCommencee(m, k)) return CASE_DEJA_FAITE
      const c = visite.cases[k]
      if (!jeux.includes(c.jeu)) return JEU_PAS_LIVRE
      cadre = { jeu: c.jeu, origine: 'visite', visite: k as Manche, cible: c.cible, but: c.cible === null ? null : a.has(c.cible) ? 'dorer' : 'gagner', seuil: seuilDe(c.cible), payee: true }
      break
    }
    case 'chasse': {
      if (chassesRestantes(m) === 0) return PLUS_DE_CHASSE
      if ('retente' in demande) {
        // Par sa case seulement, le calibrage comme la page : nommer l'œuvre, c'était la savoir (invariant 1).
        const r = laRetente(m, visite, demande.case, jeux)
        if (typeof r === 'string') return r
        cadre = { jeu: r.jeu, origine: 'chasse', cible: r.cible, but: 'gagner', retente: true, seuil: seuilDe(r.cible), payee: true }
        break
      }
      const cle = demande.oeuvre
      if (!estUneOeuvre(cle)) return PAS_AU_CABINET
      if (dorees(m).has(cle)) return 'Cette œuvre est déjà dorée'
      const jeu = JEU_DE_L_OEUVRE[cle]
      if (demande.jeu !== undefined && demande.jeu !== jeu) return `Cette œuvre se trouve ${JEUX[jeu].a}`
      if (!jeux.includes(jeu)) return JEU_PAS_LIVRE
      cadre = { jeu, origine: 'chasse', cible: cle, but: a.has(cle) ? 'dorer' : 'gagner', seuil: seuilDe(cle), payee: true }
      break
    }
    case 'libre': {
      const jeu = demande.jeu
      if (!(CLES_DES_JEUX as readonly string[]).includes(jeu)) return 'Choisis un des neuf jeux'
      if (!jeux.includes(jeu as CleDeJeu)) return JEU_PAS_LIVRE
      cadre = { jeu: jeu as CleDeJeu, origine: 'libre', cible: null, but: null, seuil: null, payee: libresQuiPaientEncore(m) > 0 }
      break
    }
    default:
      return DEMANDE_ILLISIBLE
  }
  const carte = laCarte(m, demande.carte)
  return typeof carte === 'string' ? carte : { ...cadre, carte }
}

/** Le refus d'un départ, en mots ; null : il part. */
export function refusDuDepart(m: Musee, demande: DemandeLue, visite: VisiteDuJour, jeux: readonly CleDeJeu[] = JEUX_PRETS): string | null {
  const c = cadreDuDepart(m, demande, visite, jeux)
  return typeof c === 'string' ? c : null
}

/**
 * « Retenter » sur la case `k` de la visite du jour, tel que la page le montre
 * — sous la case, et au bilan de sa partie : la règle des départs même, sans
 * carte-bonus (elle se choisit à l'annonce, et n'y change rien). Absent tant
 * que la case n'est pas manquée, et pour une case dont l'œuvre était à lui
 * avant sa partie (pour la dorer : rien à retenter) ; une œuvre gagnée
 * depuis — une chasse, un achat — se dit (`SON_OEUVRE_EST_A_TOI`), avant plus
 * de chasse ou une partie qui attend, qui ne sont que pour plus tard. Jamais
 * l'œuvre (invariant 1).
 */
export function retenteDeLaCase(m: Musee, visite: VisiteDuJour, k: number, jeux: readonly CleDeJeu[] = JEUX_PRETS): RetenteVue | null {
  const manquee = laPartieManquee(m, k)
  if (!manquee) return null
  const ligne = m.oeuvres.get(manquee.cible)
  if (OEUVRES_DE_DEPART.includes(manquee.cible) || (ligne && ligne.gagneeLe < manquee.commenceeLe)) return null
  const refus = refusDuDepart(m, { origine: 'chasse', case: k, retente: true, carte: null }, visite, jeux)
  return refus === null ? { possible: true } : { possible: false, refus }
}

// ── Acheter, dorer ────────────────────────────────────────────────────────

/** « 1 poussière d'or », « 120 poussières d'or ». */
export const poussieresDites = (n: number): string => `${formatNumber(n)} poussière${n > 1 ? 's' : ''} d’or`

/** Ce qui manque au solde pour une dépense : « Il te manque 120 poussières d'or ». */
export const ilTeManque = (n: number): string => `Il te manque ${poussieresDites(n)}`

/** Le prix d'une œuvre manquante, ou de la dorure d'une œuvre qu'il a : celui du jour, que la ligne gardera. */
export function prixDe(cle: unknown, sorte: 'achat' | 'dorure'): number | null {
  const o = oeuvre(cle)
  return o ? (sorte === 'achat' ? PRIX_D_UNE_OEUVRE : PRIX_D_UNE_DORURE)[o.rarete] : null
}

/**
 * Pourquoi cet achat ou cette dorure se refuse ; null : il passe — la base
 * revérifie le solde dans son instruction même. La page envoie le prix qu'elle
 * a montré : un prix changé depuis se refuse, plutôt que de payer ce qu'il n'a
 * pas vu. Ce qui ne se ferait jamais se dit d'abord ; puis ce qui attend — une
 * partie en cours ; puis le prix et le solde.
 */
export function refusDeLAchat(m: Musee, cle: unknown, prixMontre: unknown, sorte: 'achat' | 'dorure'): string | null {
  if (pouvoirDuGardien(cle) !== undefined || (typeof cle === 'string' && cle.startsWith('lg:'))) return 'Un gardien ne s’achète pas : il se réveille'
  const prix = prixDe(cle, sorte)
  if (prix === null || !estUneOeuvre(cle)) return PAS_AU_CABINET
  const aLui = possedees(m).has(cle)
  if (sorte === 'achat' && aLui) return 'Elle est déjà à toi'
  if (sorte === 'dorure' && !aLui) return PAS_ENCORE_A_TOI
  if (sorte === 'dorure' && dorees(m).has(cle)) return 'Son cadre est déjà doré'
  // Ce qu'une partie fait à son œuvre se décide à sa fin, sur le musée de ce moment : achetée en pleine chasse,
  // l'œuvre visée entrait sans elle, et la chasse arrivée au seuil finissait « Pas assez d'étoiles cette fois… L'œuvre
  // reste à gagner. ». Refusée pour cette œuvre seule, la dépense aurait nommé celle qu'une case de la visite met en jeu
  // sans la dire (invariant 1) : toute dépense attend la fin de la partie, comme un départ.
  if (m.enCours) return laPartieAttend(m.enCours.jeu)
  if (prixMontre !== prix) return `Le prix a changé : ${poussieresDites(prix)}. Réessaie.`
  const solde = soldeDe(m)
  return solde < prix ? ilTeManque(prix - solde) : null
}

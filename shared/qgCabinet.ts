// Le Cabinet de curiosités au QG (`/admin#cabinet`, le 4 novembre 2026 — « J'ai
// pas aussi de page dédié au cabinet », le propriétaire, la veille) : ce que
// la page montre, dérivé à l'écart du magasin, des résumés des traversées
// (`ResumeDeLaTraversee`, `cabinet_traversees.resume`) et de ce que les
// manches de leurs épreuves ont posé. Rien d'un joueur n'en sort hors de ses
// deux listes — les traversées en route, les joueurs —, qui ne disent que son
// prénom et son identifiant, et ouvrent sa fiche ; aucun Divin : les gardiens
// de la traversée n'en sont pas (invariant 21).
//
// Pur (invariant 14), et mené en tranches par le serveur (`pageDuCabinetEnTranches`) :
// trente jours de traversées, des milliers d'épreuves, au dixième de cœur.

import type { CalculEnTranches } from './tranches'
import { JOURS_DU_QG, jourDeLInstant } from './qg'
import { jourDe } from './jour'
import { formatNumber } from './typographie'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from './cabinet/jeux/regle'
import type { ResumeDeLaTraversee } from './cabinet/resume'
import { ACTES, type Acte, type CleDeCarte, type OuEnEst } from './cabinet/traversee'

/** Les jours que la page montre : ceux de la vue d'ensemble. */
export const JOURS_DU_CABINET = JOURS_DU_QG
/** Les traversées en route qu'elle nomme, au plus : les dernières qui ont bougé, les illisibles d'abord. */
export const TRAVERSEES_EN_ROUTE_MONTREES = 40
/** Les joueurs qu'elle nomme, au plus : ceux qui traversent le plus. */
export const JOUEURS_DU_CABINET = 30
/** Ce qu'un contenu doit avoir été joué pour être jugé : en dessous, un échec dit le joueur, pas le contenu. */
export const JOUES_POUR_JUGER = 3
/** Les contenus qu'elle montre par jeu, les plus ratés d'abord. */
export const CONTENUS_MONTRES = 8

/** Comment une traversée a fini, ou qu'elle n'a pas fini : rendue, l'administrateur l'a refermée au QG. */
export type IssueAuQg = 'gagnee' | 'perdue' | 'abandonnee' | 'rendue' | 'en-route'

/**
 * Une traversée telle que le serveur la donne à la page : sa ligne et son résumé — null : son pli ne se relit pas sur
 * ce code (un départ d'une version à venir, un geste troué) ; elle compte alors à sa ligne seule.
 */
export interface TraverseeAuQg {
  id: string
  profileId: string
  commenceeLe: number
  finieLe: number | null
  /** Null : en route. Rendue : finie par l'administrateur, l'issue de sa ligne vide. */
  issue: 'gagnee' | 'perdue' | 'abandonnee' | 'rendue' | null
  legendaire: string | null
  resume: ResumeDeLaTraversee | null
}

/** Une pièce d'une épreuve, telle que le journal des réponses la garde : son contenu, juste ou non, et ce qu'elle a fait. */
export interface PieceAuQg {
  partie: string
  id: string
  juste: boolean
  composee: string | null
}

/** Un profil tel que la page le nomme : son prénom et son identifiant — sans avatar, la ligne ne fait que le nommer. */
export interface ProfilNomme {
  id: string
  nom: string
  login: string
  suspendu: boolean
}

export interface TotauxDuCabinet {
  /** Des personnes : chaque profil une fois. */
  joueurs: number
  commencees: number
  gagnees: number
  perdues: number
  abandonnees: number
  rendues: number
  enRoute: number
  /** Les épreuves conclues, assauts des gardiens compris. */
  epreuves: number
  /** La médiane d'une traversée finie par le joueur — gagnée, perdue ou abandonnée —, de son départ à sa fin ; null : aucune. */
  dureeMediane: number | null
}

/** Un jour : ses traversées, par la date de leur départ, et ce qu'elles sont devenues. */
export type IssuesDUnJour = { jour: string } & Record<IssueAuQg, number>

/** Les marches de la traversée, du départ au légendaire. */
export const MARCHES_DE_L_ENTONNOIR = ['commencee', 'cartes', 'acte1', 'acte2', 'acte3', 'legendaire'] as const
export type MarcheDeLEntonnoir = (typeof MARCHES_DE_L_ENTONNOIR)[number]

export interface TraverseeEnRouteAuQg {
  id: string
  profil: ProfilNomme
  commenceeLe: number
  /** Son dernier geste ; null : aucun, ou illisible. */
  dernier: number | null
  /** Ce que son pli dit d'elle ; null : il ne se relit pas — elle bloque sûrement, la base refusant d'en commencer une autre. */
  ou: { acte: Acte; sorte: OuEnEst['sorte']; enJeu: CleDeJeu | null; gardien: string; coeurs: number; coeursMax: number; or: number; epreuves: number } | null
}

/** Un jeu, sur ses épreuves des trente jours : de quoi voir qu'il est trop dur, trop long, qu'on le quitte. */
export interface StatsDUnJeu {
  jeu: CleDeJeu
  epreuves: number
  /** Dont des assauts contre un gardien. */
  assauts: number
  /** Les manches jugées (ouvertes). */
  manches: number
  /** Celles réussies : une étoile au moins — la règle de la traversée, une ratée coûte un cœur. */
  reussies: number
  /** Leurs étoiles naturelles, en tout. */
  etoiles: number
  /** La médiane du temps de jeu d'une manche, quand les conclusions le disent ; null : aucune. */
  duree: number | null
  /** Les épreuves que le joueur a quittées (« Quitter ? ») quand rien ne l'arrêtait. */
  quittees: number
  /** Les épreuves dont la conclusion dit ce qui a servi, et celles où un Coup d'œil (Éclairer) a servi. */
  avecAides: number
  eclairees: number
  /** Les signalements de ses questions de la base, ces trente jours ; null : ses pièces ne se signalent pas. */
  signalements: number | null
}

export interface StatsDUneCarte {
  cle: CleDeCarte
  /** Les traversées qui l'ont emportée. */
  choisie: number
  /** Parmi elles, celles finies par le joueur, et celles gagnées. */
  finies: number
  gagnees: number
}

export interface StatsDUnGardien {
  cle: string
  acte: Acte
  /** Les traversées où il gardait cet acte. */
  tire: number
  /** Celles qui l'ont affronté — un assaut au moins. */
  affronte: number
  vaincu: number
  /** Vaincu en maître (l'épreuve de maître de sa carte). */
  maitrise: number
}

/** Un contenu d'un jeu : joué combien de fois, trouvé combien ; `km` (l'Épingle) la médiane de la distance ; `indices` (les Indices) ceux lus en moyenne. */
export interface LigneDeContenu {
  id: string
  nom: string
  joues: number
  trouves: number
  km?: number
  indices?: number
}

export interface ContenuDuCabinetAuQg {
  epingle: LigneDeContenu[]
  indices: LigneDeContenu[]
  repliques: LigneDeContenu[]
  /** Les thèmes que le Quiz a joués, les plus joués d'abord : combien d'épreuves, combien de manches réussies sur combien. */
  quiz: { theme: string; epreuves: number; manches: number; reussies: number }[]
}

export interface JoueurDuCabinet {
  profil: ProfilNomme
  traversees: number
  gagnees: number
  epreuves: number
  /** Les rangs des défis de ses cartes qu'il tient, tous jours confondus, et ses épreuves de maître. */
  rangs: number
  maitrises: number
  /** Son dernier passage au Cabinet. */
  dernier: number
}

/** La page du Cabinet au QG (`GET /api/admin/cabinet`). */
export interface PageDuCabinetAuQg {
  maintenant: number
  /** Les trente jours de Paris, le plus ancien d'abord. */
  jours: string[]
  totaux: TotauxDuCabinet
  parJour: IssuesDUnJour[]
  entonnoir: { marche: MarcheDeLEntonnoir; n: number }[]
  /** Où l'on tombe : chaque traversée perdue ou abandonnée, acte par acte. */
  chutes: { acte: Acte; perdues: number; abandonnees: number }[]
  enRoute: TraverseeEnRouteAuQg[]
  /** Toutes celles en route, montrées ou non. */
  enRouteEnTout: number
  jeux: StatsDUnJeu[]
  cartes: StatsDUneCarte[]
  /** Le légendaire choisi au bout, le plus choisi d'abord. */
  legendaires: { cle: string; n: number }[]
  gardiens: StatsDUnGardien[]
  contenu: ContenuDuCabinetAuQg
  joueurs: JoueurDuCabinet[]
  /** Tous les profils qui ont traversé ces trente jours, nommés ou non. */
  joueursEnTout: number
}

/** Ce que le serveur sait d'un contenu pour le nommer : un lieu, une fiche, une réplique. */
export interface NomsDuContenu {
  lieux: ReadonlyMap<string, string>
  fiches: ReadonlyMap<string, string>
  repliques: ReadonlyMap<string, string>
}

/** Ce que la page dérive : les traversées, les pièces de leurs épreuves, et ce que le serveur en sait de plus. */
export interface EntreesDeLaPage {
  /** Les traversées commencées ces trente jours, et celles en route de tout âge — chacune une fois. */
  traversees: readonly TraverseeAuQg[]
  pieces: readonly PieceAuQg[]
  /** Les signalements de chaque jeu, ces trente jours. */
  signalements: ReadonlyMap<CleDeJeu, number>
  noms: NomsDuContenu
  /** Les minuits de Paris des trente jours (`minuitsDeParis`), le dernier celui d'aujourd'hui. */
  minuits: readonly number[]
  maintenant: number
}

/** Une page dont les profils ne sont pas encore nommés : leur identifiant seul (`nommerLaPage`). */
export type PageANommer = Omit<PageDuCabinetAuQg, 'enRoute' | 'joueurs'> & {
  enRoute: (Omit<TraverseeEnRouteAuQg, 'profil'> & { profileId: string })[]
  joueurs: (Omit<JoueurDuCabinet, 'profil' | 'rangs' | 'maitrises'> & { profileId: string })[]
}

/** Les jeux dont une pièce est une question de la base, que le joueur peut signaler (`shared/cabinet/pieces.ts`) : les autres sont `cab:`. */
export const JEUX_QUI_SE_SIGNALENT: readonly CleDeJeu[] = ['pari', 'mot', 'filet']

/** Une traversée en route telle que la page et la fiche d'un joueur la disent : où elle en est, de son résumé. */
export function traverseeEnRoute(t: TraverseeAuQg): Omit<TraverseeEnRouteAuQg, 'profil'> {
  const r = t.resume
  return {
    id: t.id,
    commenceeLe: t.commenceeLe,
    dernier: r?.dernier ?? null,
    ou: r
      ? { acte: r.acte, sorte: r.ou, enJeu: r.enJeu ?? null, gardien: r.gardiens[r.acte] ?? '', coeurs: r.coeurs, coeursMax: r.coeursMax, or: r.or, epreuves: r.epreuves.length }
      : null,
  }
}

/**
 * Où une traversée en est, en mots — « Acte II, en pleine épreuve (Le Pari) » : la page, la fiche d'un joueur et le
 * journal des gestes la disent pareil.
 */
export function ouElleEnEst(o: { acte: Acte; sorte: OuEnEst['sorte']; enJeu: CleDeJeu | null }): string {
  if (o.sorte === 'cartes') return 'au choix de ses cartes'
  if (o.sorte === 'legendaire') return 'ses trois gardiens vaincus, au choix de son légendaire'
  const acte = ACTES[o.acte].court
  const jeu = o.enJeu ? ` (${JEUX[o.enJeu].nom})` : ''
  if (o.sorte === 'epreuve') return `${acte}, en pleine épreuve${jeu}`
  if (o.sorte === 'gardien') return o.enJeu ? `${acte}, face à son gardien${jeu}` : `${acte}, devant son gardien`
  if (o.sorte === 'coffre') return `${acte}, au coffre`
  if (o.sorte === 'marchand') return `${acte}, chez le marchand`
  return `${acte}, sur la carte`
}

/** Une traversée en route, en une ligne — « Acte II, en pleine épreuve (Le Pari) · 3 cœurs sur 5 · 42 pièces d’or » ; la page et la fiche la disent pareil. */
export function etatDeLaTraverseeEnRoute(t: Pick<TraverseeEnRouteAuQg, 'ou'>): string {
  if (!t.ou) return 'illisible sur ce serveur — elle bloque sûrement'
  const { ou } = t
  return [ouElleEnEst(ou), `${formatNumber(ou.coeurs)} cœur${ou.coeurs > 1 ? 's' : ''} sur ${formatNumber(ou.coeursMax)}`, `${formatNumber(ou.or)} pièce${ou.or > 1 ? 's' : ''} d’or`].join(' · ')
}

/** Une traversée qu'on peut rendre : tout sauf celle dont le légendaire attend son choix — rien n'y bloque, la rendre le lui prendrait. */
export const peutSeRendre = (t: Pick<TraverseeEnRouteAuQg, 'ou'>): boolean => t.ou?.sorte !== 'legendaire'

/** L'issue d'une traversée, pour la page : la sienne, ou « en route ». */
export const issueAuQg = (t: Pick<TraverseeAuQg, 'issue' | 'finieLe'>): IssueAuQg => (t.finieLe === null || t.issue === null ? 'en-route' : t.issue)

const mediane = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const tries = [...xs].sort((a, b) => a - b)
  const m = Math.floor(tries.length / 2)
  return tries.length % 2 ? tries[m] : Math.round((tries[m - 1] + tries[m]) / 2)
}

/** Le préfixe d'un identifiant `cab:` de contenu, lu sur l'identifiant d'un exemple : jamais recopié (`PREFIXES_HORS_DE_LA_BASE`). */
const leContenuDe = (prefixe: string, id: string): string | null => (id.startsWith(prefixe) && id.length > prefixe.length ? id.slice(prefixe.length) : null)

/** La distance d'une épingle, telle que sa pièce l'a gardée (`lat,lon|km`, `epingle.ts`) ; null : pas d'épingle. */
export function kmDeLEpingle(composee: string | null): number | null {
  const km = composee?.split('|')[1]
  const n = km === undefined || km === '' ? Number.NaN : Number(km)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Les indices qu'il a lus d'une fiche, tels que sa pièce les a gardés (`vus|erreurs`, `indices.ts`) ; null : illisible. */
export function indicesLus(composee: string | null): number | null {
  const vus = composee?.split('|')[0]
  const n = vus === undefined || vus === '' ? Number.NaN : Number(vus)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** Les identifiants des contenus, par leur préfixe : ceux du code (`idDuLieu`, `idDeLaFiche`, `idDeLaReplique`). */
export interface PrefixesDuContenu {
  lieu: string
  fiche: string
  replique: string
}

/**
 * La page, une tranche par section — le tableau de bord, les jeux, les cartes et les gardiens, le contenu, les joueurs —,
 * ses profils encore à nommer. `prefixes` : ceux des identifiants du contenu, tirés par le serveur des fonctions du code.
 */
export function* pageDuCabinetEnTranches(e: EntreesDeLaPage, prefixes: PrefixesDuContenu): CalculEnTranches<PageANommer> {
  const depuis = e.minuits[0]
  const jours = e.minuits.map(m => jourDe(m))
  const duMois = e.traversees.filter(t => t.commenceeLe >= depuis)
  const enRoute = e.traversees.filter(t => issueAuQg(t) === 'en-route')

  // ── Le tableau de bord ──
  const compte = (issue: IssueAuQg) => duMois.filter(t => issueAuQg(t) === issue).length
  const finiesParLui = duMois.filter(t => t.finieLe !== null && (t.issue === 'gagnee' || t.issue === 'perdue' || t.issue === 'abandonnee'))
  const totaux: TotauxDuCabinet = {
    joueurs: new Set(duMois.map(t => t.profileId)).size,
    commencees: duMois.length,
    gagnees: compte('gagnee'),
    perdues: compte('perdue'),
    abandonnees: compte('abandonnee'),
    rendues: compte('rendue'),
    enRoute: compte('en-route'),
    epreuves: duMois.reduce((n, t) => n + (t.resume?.epreuves.length ?? 0), 0),
    dureeMediane: mediane(finiesParLui.map(t => (t.finieLe ?? t.commenceeLe) - t.commenceeLe)),
  }
  const parJour: IssuesDUnJour[] = jours.map(jour => ({ jour, gagnee: 0, perdue: 0, abandonnee: 0, rendue: 0, 'en-route': 0 }))
  for (const t of duMois) {
    // Le jour de son départ, celui de Paris : un jour de vingt-cinq heures compte comme les autres.
    const k = jourDeLInstant(e.minuits, t.commenceeLe)
    if (k >= 0) parJour[k][issueAuQg(t)]++
  }
  yield
  const atteint = (t: TraverseeAuQg, marche: MarcheDeLEntonnoir): boolean => {
    const r = t.resume
    if (marche === 'commencee') return true
    if (!r) return marche === 'legendaire' && t.issue === 'gagnee'
    if (marche === 'cartes') return r.cartes.length > 0
    if (marche === 'legendaire') return t.issue === 'gagnee'
    return r.vaincus.length >= (marche === 'acte1' ? 1 : marche === 'acte2' ? 2 : 3)
  }
  const entonnoir = MARCHES_DE_L_ENTONNOIR.map(marche => ({ marche, n: duMois.filter(t => atteint(t, marche)).length }))
  const chutes = ([0, 1, 2] as const).map(acte => ({
    acte,
    perdues: duMois.filter(t => t.issue === 'perdue' && t.resume?.acte === acte).length,
    abandonnees: duMois.filter(t => t.issue === 'abandonnee' && t.resume?.acte === acte).length,
  }))
  // Les traversées en route : celles qui ne se relisent pas d'abord — elles bloquent sûrement —, puis celles qui ont bougé en dernier.
  const enRouteTriees = [...enRoute].sort((a, b) => Number(a.resume !== null) - Number(b.resume !== null) || (b.resume?.dernier ?? b.commenceeLe) - (a.resume?.dernier ?? a.commenceeLe))
  const enRouteMontrees = enRouteTriees.slice(0, TRAVERSEES_EN_ROUTE_MONTREES).map(t => ({ ...traverseeEnRoute(t), profileId: t.profileId }))
  yield

  // ── Les jeux ──
  type CompteDUnJeu = Omit<StatsDUnJeu, 'duree' | 'signalements'> & { durees: number[] }
  const parJeu = new Map<CleDeJeu, CompteDUnJeu>(
    CLES_DES_JEUX.map(jeu => [jeu, { jeu, epreuves: 0, assauts: 0, manches: 0, reussies: 0, etoiles: 0, durees: [], quittees: 0, avecAides: 0, eclairees: 0 }]),
  )
  for (const t of duMois) {
    for (const ep of t.resume?.epreuves ?? []) {
      const s = parJeu.get(ep.jeu)
      if (!s) continue
      s.epreuves++
      if (ep.gardien) s.assauts++
      ep.etoiles.forEach((etoiles, k) => {
        if (etoiles === null) return
        s.manches++
        s.etoiles += etoiles
        if (etoiles >= 1) s.reussies++
        const d = ep.durees?.[k]
        if (d !== undefined && d !== null) s.durees.push(d)
      })
      if (ep.quittee) s.quittees++
      if (ep.aides) {
        s.avecAides++
        if (ep.aides.eclairer > 0) s.eclairees++
      }
    }
  }
  const jeux: StatsDUnJeu[] = [...parJeu.values()].map(({ durees, ...s }) => ({
    ...s,
    duree: mediane(durees),
    signalements: JEUX_QUI_SE_SIGNALENT.includes(s.jeu) ? (e.signalements.get(s.jeu) ?? 0) : null,
  }))
  yield

  // ── Cartes et gardiens ──
  const parCarte = new Map<CleDeCarte, StatsDUneCarte>()
  for (const t of duMois) {
    for (const c of t.resume?.cartes ?? []) {
      const s = parCarte.get(c.cle) ?? { cle: c.cle, choisie: 0, finies: 0, gagnees: 0 }
      s.choisie++
      if (t.issue === 'gagnee' || t.issue === 'perdue' || t.issue === 'abandonnee') s.finies++
      if (t.issue === 'gagnee') s.gagnees++
      parCarte.set(c.cle, s)
    }
  }
  const cartes = [...parCarte.values()].sort((a, b) => b.choisie - a.choisie || a.cle.localeCompare(b.cle))
  const parLegendaire = new Map<string, number>()
  for (const t of duMois) if (t.issue === 'gagnee' && t.legendaire) parLegendaire.set(t.legendaire, (parLegendaire.get(t.legendaire) ?? 0) + 1)
  const legendaires = [...parLegendaire].map(([cle, n]) => ({ cle, n })).sort((a, b) => b.n - a.n || a.cle.localeCompare(b.cle))
  const parGardien = new Map<string, StatsDUnGardien>()
  for (const t of duMois) {
    const r = t.resume
    if (!r) continue
    r.gardiens.forEach((cle, k) => {
      const acte = k as Acte
      const s = parGardien.get(`${acte}|${cle}`) ?? { cle, acte, tire: 0, affronte: 0, vaincu: 0, maitrise: 0 }
      s.tire++
      if ((r.assauts[acte] ?? 0) > 0) s.affronte++
      if (r.vaincus.includes(cle)) s.vaincu++
      if (r.maitrises.includes(cle)) s.maitrise++
      parGardien.set(`${acte}|${cle}`, s)
    })
  }
  const gardiens = [...parGardien.values()].sort((a, b) => a.acte - b.acte || b.affronte - a.affronte || a.cle.localeCompare(b.cle))
  yield

  // ── Le contenu ──
  // Ce que les pièces des épreuves des trente jours ont posé : l'Épingle, les Indices, la Réplique — chacun par son préfixe.
  const parties = new Set(duMois.flatMap(t => t.resume?.epreuves.map(ep => ep.partie) ?? []))
  const lignes = (prefixe: string, noms: ReadonlyMap<string, string>, mesure?: (p: PieceAuQg) => number | null) => {
    const par = new Map<string, { joues: number; trouves: number; mesures: number[] }>()
    for (const p of e.pieces) {
      const id = parties.has(p.partie) ? leContenuDe(prefixe, p.id) : null
      if (id === null) continue
      const s = par.get(id) ?? { joues: 0, trouves: 0, mesures: [] }
      s.joues++
      if (p.juste) s.trouves++
      const m = mesure?.(p)
      if (m !== undefined && m !== null) s.mesures.push(m)
      par.set(id, s)
    }
    return [...par]
      .filter(([, s]) => s.joues >= JOUES_POUR_JUGER)
      .map(([id, s]) => ({ id, nom: noms.get(id) ?? id, joues: s.joues, trouves: s.trouves, mesures: s.mesures }))
      .sort((a, b) => a.trouves / a.joues - b.trouves / b.joues || b.joues - a.joues || a.id.localeCompare(b.id))
      .slice(0, CONTENUS_MONTRES)
  }
  const epingle = lignes(prefixes.lieu, e.noms.lieux, p => kmDeLEpingle(p.composee)).map(({ mesures, ...l }) => ({ ...l, ...(mesures.length > 0 && { km: mediane(mesures)! }) }))
  const indices = lignes(prefixes.fiche, e.noms.fiches, p => indicesLus(p.composee)).map(({ mesures, ...l }) => ({
    ...l,
    ...(mesures.length > 0 && { indices: Math.round((mesures.reduce((a, b) => a + b, 0) / mesures.length) * 10) / 10 }),
  }))
  const repliques = lignes(prefixes.replique, e.noms.repliques).map(({ mesures: _, ...l }) => l)
  const parTheme = new Map<string, { theme: string; epreuves: number; manches: number; reussies: number }>()
  for (const t of duMois) {
    for (const ep of t.resume?.epreuves ?? []) {
      if (ep.jeu !== 'quiz' || !ep.theme) continue
      const s = parTheme.get(ep.theme) ?? { theme: ep.theme, epreuves: 0, manches: 0, reussies: 0 }
      s.epreuves++
      for (const etoiles of ep.etoiles) {
        if (etoiles === null) continue
        s.manches++
        if (etoiles >= 1) s.reussies++
      }
      parTheme.set(ep.theme, s)
    }
  }
  const quiz = [...parTheme.values()].sort((a, b) => b.epreuves - a.epreuves || a.theme.localeCompare(b.theme))
  yield

  // ── Les joueurs ──
  const parJoueur = new Map<string, { profileId: string; traversees: number; gagnees: number; epreuves: number; dernier: number }>()
  for (const t of duMois) {
    const s = parJoueur.get(t.profileId) ?? { profileId: t.profileId, traversees: 0, gagnees: 0, epreuves: 0, dernier: 0 }
    s.traversees++
    if (t.issue === 'gagnee') s.gagnees++
    s.epreuves += t.resume?.epreuves.length ?? 0
    s.dernier = Math.max(s.dernier, t.resume?.dernier ?? t.finieLe ?? t.commenceeLe)
    parJoueur.set(t.profileId, s)
  }
  const joueurs = [...parJoueur.values()].sort((a, b) => b.traversees - a.traversees || b.gagnees - a.gagnees || b.dernier - a.dernier)

  return {
    maintenant: e.maintenant,
    jours,
    totaux,
    parJour,
    entonnoir,
    chutes,
    enRoute: enRouteMontrees,
    enRouteEnTout: enRoute.length,
    jeux,
    cartes,
    legendaires,
    gardiens,
    contenu: { epingle, indices, repliques, quiz },
    joueurs: joueurs.slice(0, JOUEURS_DU_CABINET),
    joueursEnTout: joueurs.length,
  }
}

/** Les profils qu'une page nomme : ceux de ses traversées en route et de ses joueurs, chacun une fois. */
export const profilsANommer = (p: PageANommer): string[] => [...new Set([...p.enRoute.map(t => t.profileId), ...p.joueurs.map(j => j.profileId)])]

/**
 * La page nommée : chaque profil par son prénom et son identifiant, ses défis tenus à côté de ce qu'il a traversé. Un
 * profil supprimé depuis — ses traversées s'effacent avec lui, mais une page gardée a pu les lire — ne se nomme pas, et
 * sa ligne part.
 */
export function nommerLaPage(p: PageANommer, profils: ReadonlyMap<string, ProfilNomme>, defis: ReadonlyMap<string, { rangs: number; maitrises: number }>): PageDuCabinetAuQg {
  return {
    ...p,
    enRoute: p.enRoute.flatMap(({ profileId, ...t }) => {
      const profil = profils.get(profileId)
      return profil ? [{ ...t, profil }] : []
    }),
    joueurs: p.joueurs.flatMap(({ profileId, ...j }) => {
      const profil = profils.get(profileId)
      return profil ? [{ ...j, profil, rangs: defis.get(profileId)?.rangs ?? 0, maitrises: defis.get(profileId)?.maitrises ?? 0 }] : []
    }),
  }
}

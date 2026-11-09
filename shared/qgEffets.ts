// L'effet de ce que le QG envoie, et les repères posés sur ses courbes (le QG 2, le 4 novembre 2026 — la revue
// « Le QG permet-il d'analyser et de piloter toute l'application ? », P2.1 et P2.2,
// `retours/2026-11-04/experts/analyse-et-management.md`). Le QG disait combien avaient reçu une annonce, combien
// étaient allés sur la page d'une affiche, combien de rappels étaient partis — jamais ce que ça avait changé ; et ses
// courbes montaient ou descendaient sans dire ce qui s'était passé ce jour-là.
//
// Des comptes, jamais un nom : une annonce, une affiche, un repère se lisent par leurs chiffres et leur sorte. Pas de
// groupe témoin : à quelques dizaines de profils, il ne dirait rien (la revue) — on compare à l'habitude, avant et
// après. Ce fichier tient les dérivations pures ; `server/src/effetsDuQg.ts` les applique à ce qu'il lit une fois par
// jour, et la page et les tests les relisent.

import { jourAvant, jourDe, jourEnToutesLettres } from './jour'
import { formatNumber } from './typographie'
import { ECART_FAIBLE_EN_POURCENTS, HABITUDE_EN_POURCENTS, NOM_DU_MODE, type EcartALHabitude, type ModeDuQg } from './qg'
import { AUX_PROFILS_DU_SEGMENT, BIT_DU_MODE, minuitDuJour, segmentsDesProfils, tracesDesTrenteJours, type ChiffresDUnJour, type Presence, type ProfilDeLAudience, type SegmentDuQg } from './qgJoueurs'
import { estUnePageALAffiche, type PageALAffiche } from './affiches'
import { PAGES_EN_MAINTENANCE, type PageEnMaintenance } from './maintenance'
import { REGLE, type CleDeRegle } from './qgAlertes'
import { arreteNet, sorteDuDemarrage, type DemarrageDuServeur } from './santeDuServeur'
import type { CalculEnTranches } from './tranches'

// ── Ce qu'on lit d'une part de profils ──────────────────────────────────────

/** Des profils comptés : combien, sur combien. */
export interface PartDeProfils {
  n: number
  sur: number
}

/**
 * « 9 sur 34 » : toujours le compte, jamais un pourcentage — à quelques dizaines de profils, trois sur huit ne font pas
 * « 38 % », et la revue veut des comptes qu'on vérifie d'un coup d'œil.
 */
export const partEcrite = (p: PartDeProfils) => `${formatNumber(p.n)} sur ${formatNumber(p.sur)}`

/** Les `n` jours qui suivent `jour` et sont déjà finis — `hier` au plus —, le plus ancien d'abord. */
function joursFinisApres(jour: string, n: number, hier: string): string[] {
  const jours: string[] = []
  for (let k = 1; k <= n; k++) {
    const j = jourAvant(jour, -k)
    if (j > hier) break
    jours.push(j)
  }
  return jours
}

/** Les `n` jours qui précèdent `jour`, le plus ancien d'abord. */
const joursAvant = (jour: string, n: number) => Array.from({ length: n }, (_, k) => jourAvant(jour, n - k))

/** Les profils de `qui` qui ont joué un de ces jours — à un mode donné, ou à n'importe lequel. */
function ontJoue(presences: ReadonlyMap<string, readonly Pick<Presence, 'qui' | 'modes'>[]>, jours: readonly string[], qui: ReadonlySet<string> | null, mode: ModeDuQg | null = null): Set<string> {
  const vus = new Set<string>()
  for (const j of jours) {
    for (const p of presences.get(j) ?? []) {
      if (qui && !qui.has(p.qui)) continue
      if (mode && (p.modes & BIT_DU_MODE[mode]) === 0) continue
      vus.add(p.qui)
    }
  }
  return vus
}

// ── L'effet d'une annonce ───────────────────────────────────────────────────

/**
 * Une annonce se juge sur les sept jours qui suivent son jour (la revue : « ont rejoué dans les 7 jours »). Son jour
 * lui-même ne compte ni avant ni après : la feuille de présence dit qu'on a joué ce jour-là, pas si c'était avant ou
 * après l'heure de l'annonce.
 */
export const JOURS_DE_L_EFFET_D_UNE_ANNONCE = 7

/** Ce que le calcul lit d'une annonce. */
export interface AnnoncePourSonEffet {
  le: number
  segment: SegmentDuQg | null
  /** Ses destinataires écrits avec elle (`qg_annonce_destinataires`) ; null pour une annonce à tous, dont les destinataires sont les profils d'alors. */
  destinataires: readonly string[] | null
}

/** Ce que la mémoire du QG prête aux effets : les feuilles de présence des jours finis, les profils, et jusqu'où elle remonte. */
export interface MemoireDesEffets {
  presences: ReadonlyMap<string, readonly Presence[]>
  /** Le premier jour que la mémoire sait ; null tant qu'elle ne sait rien. */
  depuis: string | null
  profils: readonly ProfilDeLAudience[]
  aujourdhui: string
}

export interface EffetDUneAnnonce {
  /** Les jours finis de ses sept, de 0 à 7 : sous sept, son effet se lit encore. */
  jours: number
  /** Ses destinataires qui ont joué ces jours-là, sur ceux qui existent encore ; null tant qu'aucun n'est fini, ou que la mémoire ne remonte pas jusqu'à elle. */
  apres: PartDeProfils | null
  /**
   * L'habitude : la même audience une semaine plus tôt — tous les profils d'alors, ou le même segment selon sa règle —
   * et ceux qui ont joué sur autant de jours (`joursDeLHabitude`) ; null quand la mémoire ne remonte pas jusque-là.
   */
  habitude: PartDeProfils | null
  /** Les jours sur lesquels l'habitude se compte : autant que les siens, sept tant qu'aucun n'est fini. */
  joursDeLHabitude: number
}

/**
 * Ce qu'une annonce a changé : ses destinataires qui ont rejoué dans les sept jours qui suivent son jour, face à
 * l'habitude de la même audience.
 *
 * L'habitude n'est pas ce que ses destinataires faisaient la semaine d'avant : écrite aux endormis, elle partait à des
 * profils qui, par la règle même du segment, n'avaient pas joué depuis deux semaines — « d'habitude, 0 sur 34 » aurait
 * fait passer n'importe quel retour pour un effet. C'est donc le même segment, une semaine plus tôt — ses membres au soir
 * du huitième jour d'avant, selon la même règle (`segmentsDesProfils`) —, et la part d'entre eux qui a joué les jours
 * suivants, jusqu'à la veille de l'annonce. Pour une annonce à tous, les profils qui existaient alors.
 */
export function effetDUneAnnonce(a: AnnoncePourSonEffet, m: MemoireDesEffets): EffetDUneAnnonce {
  const jour = jourDe(a.le)
  const hier = jourAvant(m.aujourdhui)
  const sait = (j: string) => m.depuis !== null && j >= m.depuis
  const apres = joursFinisApres(jour, JOURS_DE_L_EFFET_D_UNE_ANNONCE, hier)
  const k = apres.length
  // Ses destinataires : ceux qu'elle a retenus, ou les profils d'alors — sans les suspendus, qu'elle ne touchait pas.
  const destinataires = new Set(a.destinataires ?? m.profils.filter(p => p.cree <= a.le && !p.suspendu).map(p => p.id))
  const part = k > 0 && sait(apres[0]) ? { n: ontJoue(m.presences, apres, destinataires).size, sur: destinataires.size } : null

  const joursDeLHabitude = k > 0 ? k : JOURS_DE_L_EFFET_D_UNE_ANNONCE
  // La même audience au soir du huitième jour d'avant : sa semaine suivante finit la veille de l'annonce.
  const soir = jourAvant(jour, JOURS_DE_L_EFFET_D_UNE_ANNONCE + 1)
  const fenetre = joursFinisApres(soir, joursDeLHabitude, hier)
  const nesAvant = m.profils.filter(p => p.cree < minuitDuJour(jourAvant(soir, -1)))
  let membres: string[] | null = null
  if (a.segment === null) {
    if (fenetre.length > 0 && sait(fenetre[0])) membres = nesAvant.filter(p => !p.suspendu).map(p => p.id)
  } else if (sait(jourAvant(soir, 29))) {
    // La règle d'un segment lit trente jours de présence : la mémoire doit les avoir, sinon un habitué passerait pour perdu de vue.
    membres = segmentsDesProfils(nesAvant, tracesDesTrenteJours(m.presences, soir), soir)[a.segment].map(p => p.id)
  }
  const habitude = membres === null ? null : { n: ontJoue(m.presences, fenetre, new Set(membres)).size, sur: membres.length }
  return { jours: k, apres: part, habitude, joursDeLHabitude }
}

/** Les effets de toutes les annonces, une par tranche : chacune relit trente jours de présence pour son habitude. */
export function* effetsDesAnnonces(annonces: readonly (AnnoncePourSonEffet & { id: string })[], m: MemoireDesEffets): CalculEnTranches<Record<string, EffetDUneAnnonce>> {
  const effets: Record<string, EffetDUneAnnonce> = {}
  for (const a of annonces) {
    effets[a.id] = effetDUneAnnonce(a, m)
    yield
  }
  return effets
}

/** Ce que la page des annonces lit de leur effet, une fois par jour (`GET /api/admin/annonces/effets`). */
export interface EffetsDesAnnonces {
  maintenant: number
  aujourdhui: string
  /** Par annonce ; une annonce de plus d'un an, que la mémoire ne sait plus, n'y est pas. */
  effets: Record<string, EffetDUneAnnonce>
}

// ── L'effet d'une affiche ───────────────────────────────────────────────────

/** Une affiche se juge sur les quatorze jours qui suivent son jour, face aux quatorze d'avant (la revue). */
export const JOURS_DE_L_EFFET_D_UNE_AFFICHE = 14

/** Le mode qu'une page à l'affiche fait jouer — la feuille de présence le sait ; la boutique et les collectionneurs n'en sont pas. */
export const MODE_DE_LA_PAGE: Record<PageALAffiche, ModeDuQg | null> = { cabinet: 'cabinet', campagne: 'campagne', jour: 'jour', duels: 'duel', boutique: null, collectionneurs: null }

/** Ce que le calcul lit d'une affiche : sa pose, sa page, et les visites que `noterUneVisite` a notées (`profile_affiches.ouverte_le`). */
export interface AffichePourSonEffet {
  le: number
  page: PageALAffiche
  visites: readonly { qui: string; le: number }[]
}

export interface EffetDUneAffiche {
  /** Les jours finis de ses quatorze. */
  jours: number
  /** Les jours d'avant elle, à comparer : autant que les siens, quatorze tant qu'aucun n'est fini. */
  joursAvant: number
  /** Les joueurs distincts de son mode, ses jours finis et autant juste avant elle ; null pour la boutique, ou sans mémoire. */
  joueurs: { apres: number; avant: number | null } | null
  /** La boutique, qui n'est pas un mode : ses achats sur ces jours, et autant juste avant (`ChiffresDUnJour.achats`). */
  achats: { apres: number; avant: number | null } | null
  /**
   * Ses visiteurs de ces jours — son jour compris : la page servie à un profil pendant qu'elle se montrait — et ceux
   * d'entre eux qui ont rejoué à son mode un autre jour, après leur visite ; null pour la boutique, qui ne se joue pas.
   */
  revenus: { visiteurs: number; revenus: number } | null
  /**
   * Une page qui ne se joue ni ne vend — les collectionneurs : ses visiteurs depuis son jour, seuls. Ni ses
   * joueurs, ni les achats de la boutique, qu'on lui aurait prêtés. Absent pour les autres pages.
   */
  visiteurs?: number
}

/**
 * Ce qu'une affiche a changé : les joueurs de son mode les quatorze jours qui suivent son jour, face à autant juste
 * avant — sa page ne note que la première visite de chacun, la feuille de présence dit qui y a joué —, et ses visiteurs
 * qui y sont revenus un autre jour. La boutique ne se joue pas : ses achats en tiennent lieu.
 */
export function effetDUneAffiche(a: AffichePourSonEffet, m: MemoireDesEffets & { jours: ReadonlyMap<string, Pick<ChiffresDUnJour, 'achats'>> }): EffetDUneAffiche {
  const jour = jourDe(a.le)
  const hier = jourAvant(m.aujourdhui)
  const sait = (j: string) => m.depuis !== null && j >= m.depuis
  const apres = joursFinisApres(jour, JOURS_DE_L_EFFET_D_UNE_AFFICHE, hier)
  const k = apres.length
  const nAvant = k > 0 ? k : JOURS_DE_L_EFFET_D_UNE_AFFICHE
  const avant = joursAvant(jour, nAvant)
  const mode = MODE_DE_LA_PAGE[a.page]
  const avantConnu = sait(avant[0])
  // Une page sans mode ni achats : ses visites seules, notées par le serveur — la mémoire n'en sait rien.
  if (mode === null && a.page !== 'boutique') {
    return { jours: k, joursAvant: nAvant, joueurs: null, achats: null, revenus: null, visiteurs: a.visites.filter(v => jourDe(v.le) >= jour).length }
  }
  if (mode === null) {
    const somme = (jours: readonly string[]) => jours.reduce((t, j) => t + (m.jours.get(j)?.achats ?? 0), 0)
    return {
      jours: k,
      joursAvant: nAvant,
      joueurs: null,
      achats: k > 0 && !sait(apres[0]) ? null : { apres: somme(apres), avant: avantConnu ? somme(avant) : null },
      revenus: null,
    }
  }
  const joueurs = k > 0 && !sait(apres[0]) ? null : { apres: ontJoue(m.presences, apres, null, mode).size, avant: avantConnu ? ontJoue(m.presences, avant, null, mode).size : null }
  // Ses visiteurs, jusqu'au dernier jour fini qu'on lit : leur visite, puis un autre jour joué à son mode, après elle.
  const dernier = k > 0 ? apres[k - 1] : jour
  const visiteurs = a.visites.filter(v => {
    const j = jourDe(v.le)
    return j >= jour && j <= dernier
  })
  let revenus = 0
  for (const v of visiteurs) {
    const lendemains = apres.filter(j => j > jourDe(v.le))
    if (ontJoue(m.presences, lendemains, new Set([v.qui]), mode).size > 0) revenus++
  }
  return { jours: k, joursAvant: nAvant, joueurs, achats: null, revenus: { visiteurs: visiteurs.length, revenus } }
}

/** Les effets de toutes les affiches, une par tranche. */
export function* effetsDesAffiches(
  affiches: readonly (AffichePourSonEffet & { id: string })[],
  m: MemoireDesEffets & { jours: ReadonlyMap<string, Pick<ChiffresDUnJour, 'achats'>> },
): CalculEnTranches<Record<string, EffetDUneAffiche>> {
  const effets: Record<string, EffetDUneAffiche> = {}
  for (const a of affiches) {
    effets[a.id] = effetDUneAffiche(a, m)
    yield
  }
  return effets
}

/** Ce que la page des nouveautés lit de leur effet (`GET /api/admin/affiches/effets`). */
export interface EffetsDesAffiches {
  maintenant: number
  aujourdhui: string
  effets: Record<string, EffetDUneAffiche>
}

/** « du Cabinet », « de la campagne » : le mode d'une page, dans une phrase. */
export const DU_MODE: Record<ModeDuQg, string> = { soiree: 'des soirées', campagne: 'de la campagne', cabinet: 'du Cabinet', jour: 'du quiz du jour', duel: 'des duels' }

// ── Les repères sur les courbes ─────────────────────────────────────────────

/**
 * Ce qui se pose sur une courbe (le principe 6 de la proposition du 3 novembre 2026, accepté) : une mise en ligne, un
 * arrêt net, une page fermée ou rouverte, une affiche, une annonce, un réglage — un mélange des sentiers, un seuil
 * d'alerte. La forme dit la sorte, la couleur ne suffit jamais.
 */
export type SorteDeRepere = 'mise-en-ligne' | 'arret-net' | 'maintenance' | 'ouverture' | 'affiche' | 'annonce' | 'reglage'

export interface RepereDuQg {
  /** Le geste du journal qui l'a posé (son identifiant), ou le démarrage (`demarrage:…`, `arret:…`). */
  cle: string
  quand: number
  sorte: SorteDeRepere
  /** Ce que la courbe en dit, la sorte seule — « annonce aux endormis », « affiche : le Cabinet », « mise en ligne e4f5a6b » : jamais le profil qu'un geste nomme. */
  nom: string
  /** Le mode qu'il touche — une page fermée, une affiche, un mélange des sentiers — ; null, tous. */
  mode: ModeDuQg | null
}

/** Ce que lisent les courbes (`GET /api/admin/reperes`). */
export interface ReperesDuQg {
  maintenant: number
  /** Du plus ancien au plus récent. */
  reperes: RepereDuQg[]
  /** Les mises en ligne et les arrêts nets ne remontent pas plus loin : le relevé des démarrages garde huit jours. */
  demarragesDepuis: number
}

/** Les jours de repères que lisent les courbes : quatre-vingt-dix, la plus longue, celle des joueurs. Le journal en lit un an. */
export const JOURS_DES_REPERES = 90
/** Un an de repères : ce que la mémoire sait, au-delà, l'avant / après n'a plus rien à comparer. */
export const JOURS_DES_REPERES_DU_JOURNAL = 366

/** Les routes du journal des gestes qui posent un repère : une annonce, une affiche, une page fermée ou rouverte, un mélange, un réglage d'alerte. */
export const ROUTES_DES_REPERES = [
  'POST /api/admin/annonces',
  'POST /api/admin/affiches',
  'PUT /api/admin/maintenance/pages/:page',
  'POST /api/admin/campagne/paliers/:n/melange',
  'PUT /api/admin/regles/:cle',
] as const

/** Un geste du journal tel que les repères le lisent — et, lus à côté par leur clé, le segment d'une annonce et la page d'une affiche. */
export interface GesteDeRepere {
  id: string
  quand: number
  route: string
  resume: string
  cible: string | null
  segment?: SegmentDuQg | null
  page?: string | null
}

/** Une page dans un repère, en peu de mots : sur une courbe, « affiche : le Cabinet ». */
const COURT_D_UNE_PAGE: Record<PageALAffiche | PageEnMaintenance, string> = {
  cabinet: 'le Cabinet',
  campagne: 'la campagne',
  jour: 'le quiz du jour',
  duels: 'les duels',
  boutique: 'la boutique',
  collectionneurs: 'le classement des collections',
  defi: 'le défi',
}
const MODE_D_UNE_PAGE_FERMABLE: Record<PageEnMaintenance, ModeDuQg | null> = { jour: 'jour', campagne: 'campagne', defi: 'campagne', duels: 'duel', cabinet: 'cabinet', boutique: null }
const estUnePageFermable = (x: unknown): x is PageEnMaintenance => (PAGES_EN_MAINTENANCE as readonly unknown[]).includes(x)

/**
 * Le repère qu'un geste pose, ou null — de sa route, de sa cible, et des quatre phrases que la maintenance écrit au
 * journal (`phraseDuChangement`, `server/src/maintenance.ts` : « Page mise en maintenance », « Page bientôt disponible »,
 * « Page rouverte aux joueurs », « Page ouverte à tous » ; `qg-effets.test.ts` les rejoue par la vraie route). Un réglage
 * d'alerte n'en pose un que s'il change un seuil : faire sonner un téléphone ne change rien pour les joueurs.
 */
export function repereDuGeste(g: GesteDeRepere): RepereDuQg | null {
  const base = { cle: g.id, quand: g.quand }
  switch (g.route) {
    case 'POST /api/admin/annonces':
      return { ...base, sorte: 'annonce', nom: g.segment ? `annonce ${AUX_PROFILS_DU_SEGMENT[g.segment]}` : 'annonce à tous', mode: null }
    case 'POST /api/admin/affiches': {
      const page = g.page ?? null
      return estUnePageALAffiche(page)
        ? { ...base, sorte: 'affiche', nom: `affiche : ${COURT_D_UNE_PAGE[page]}`, mode: MODE_DE_LA_PAGE[page] }
        : { ...base, sorte: 'affiche', nom: 'affiche', mode: null }
    }
    case 'PUT /api/admin/maintenance/pages/:page': {
      const page = g.cible
      if (!estUnePageFermable(page)) return null
      const sur = COURT_D_UNE_PAGE[page]
      const mode = MODE_D_UNE_PAGE_FERMABLE[page]
      if (g.resume.startsWith('Page mise en maintenance')) return { ...base, sorte: 'maintenance', nom: `maintenance : ${sur}`, mode }
      if (g.resume.startsWith('Page bientôt disponible')) return { ...base, sorte: 'maintenance', nom: `bientôt disponible : ${sur}`, mode }
      if (g.resume.startsWith('Page rouverte')) return { ...base, sorte: 'ouverture', nom: `rouverte : ${sur}`, mode }
      if (g.resume.startsWith('Page ouverte')) return { ...base, sorte: 'ouverture', nom: `ouverte à tous : ${sur}`, mode }
      return null
    }
    case 'POST /api/admin/campagne/paliers/:n/melange': {
      const palier = /^palier:(\d+)$/.exec(g.cible ?? '')?.[1]
      return { ...base, sorte: 'reglage', nom: palier ? `mélange : palier ${palier}` : 'mélange des sentiers', mode: 'campagne' }
    }
    case 'PUT /api/admin/regles/:cle': {
      if (!g.resume.includes(' — seuil ')) return null
      const regle = g.cible && g.cible in REGLE ? REGLE[g.cible as CleDeRegle] : null
      return { ...base, sorte: 'reglage', nom: regle ? `seuil : ${regle.nom}` : 'seuil d’alerte', mode: null }
    }
    default:
      return null
  }
}

/**
 * Les mises en ligne et les arrêts nets des démarrages gardés, comme la page du serveur les lit : une version neuve
 * est une mise en ligne (`sorteDuDemarrage`) — la phrase de son commit, le serveur ne la connaît pas : sa version
 * suffit —, un démarrage qui s'est tu sans s'éteindre, un arrêt net à son dernier signe (`arreteNet`).
 */
export function reperesDesDemarrages(demarrages: readonly DemarrageDuServeur[], maintenant: number, courant: string): RepereDuQg[] {
  const tous = [...demarrages].sort((a, b) => a.demarreLe - b.demarreLe)
  const reperes: RepereDuQg[] = []
  tous.forEach((d, i) => {
    if (i > 0 && sorteDuDemarrage(d, tous[i - 1], maintenant, courant) === 'mise-en-ligne') {
      reperes.push({ cle: `demarrage:${d.id}`, quand: d.demarreLe, sorte: 'mise-en-ligne', nom: d.version ? `mise en ligne ${d.version.slice(0, 7)}` : 'mise en ligne', mode: null })
    }
    if (arreteNet(d, maintenant, courant)) reperes.push({ cle: `arret:${d.id}`, quand: d.vuLe, sorte: 'arret-net', nom: 'arrêt net du serveur', mode: null })
  })
  return reperes.sort((a, b) => a.quand - b.quand)
}

/**
 * Les repères de chaque seau d'une courbe, dans l'ordre de leur heure : `bornes`, le début et la fin — exclue — de
 * chaque seau. Un repère hors de tous les seaux ne se pose nulle part : une courbe ne s'étire pas pour lui.
 */
export function reperesDesSeaux(reperes: readonly RepereDuQg[], bornes: readonly (readonly [number, number])[]): RepereDuQg[][] {
  const parSeau = bornes.map(() => [] as RepereDuQg[])
  for (const r of [...reperes].sort((a, b) => a.quand - b.quand)) {
    const i = bornes.findIndex(([debut, fin]) => r.quand >= debut && r.quand < fin)
    if (i >= 0) parSeau[i].push(r)
  }
  return parSeau
}

/** Au-delà de deux repères dans un seau, la lecture les compte au lieu de les nommer (« 3 événements ») : un graphique encombré se lit encore. */
export const REPERES_NOMMES = 2

/** Ce qu'une lecture dit des repères d'un seau : « annonce à tous », « annonce à tous, mise en ligne e4f5a6b », « 3 événements ». */
export function reperesEcrits(reperes: readonly RepereDuQg[]): string {
  if (reperes.length === 0) return ''
  if (reperes.length <= REPERES_NOMMES) return reperes.map(r => r.nom).join(', ')
  return `${formatNumber(reperes.length)} événements`
}

// ── Avant / après ───────────────────────────────────────────────────────────

/** Un repère se lit sur les quatorze jours d'avant son jour et les quatorze d'après — son jour à part, comme une annonce. */
export const JOURS_DE_L_AVANT_APRES = 14

/** Ce que l'avant / après lit d'un jour de la mémoire (`qg_jours`, `ChiffresDUnJour`). */
export type ChiffresDuRepere = Pick<ChiffresDUnJour, 'joueurs' | 'profils' | 'modes' | 'parties' | 'nouveauxProfils'>

export interface LigneDeLAvantApres {
  cle: string
  nom: string
  /** Un jour moyen des jours que la mémoire sait, de chaque côté ; null sans un jour connu. */
  avant: number | null
  apres: number | null
}

export interface AvantApres {
  jour: string
  /** Les jours d'avant que la mémoire sait, sur quatorze. */
  avant: { connus: number; sur: number }
  /** Les jours d'après déjà finis — sous quatorze, il se lit encore —, et ceux que la mémoire sait parmi eux. */
  apres: { finis: number; connus: number; sur: number }
  lignes: LigneDeLAvantApres[]
}

/**
 * Avant / après un repère (la revue, P2.2 : « le Cabinet du 31 octobre a-t-il pris des joueurs à la campagne, ou en
 * a-t-il amené ? ») : les quatorze jours d'avant son jour et les quatorze d'après, en jours de Paris — le 25 octobre a
 * vingt-cinq heures, il reste un jour —, chaque chiffre en un jour moyen des jours que la mémoire sait : un jour qui
 * manque ne fait pas une baisse, il ne compte pas, et la page dit combien en manquent. Une semaine creuse, elle, est
 * faite de jours connus à zéro : elle compte. Le mode touché en plus, quand le repère en touche un.
 */
export function avantApres(jours: ReadonlyMap<string, ChiffresDuRepere>, jour: string, mode: ModeDuQg | null, aujourdhui: string): AvantApres {
  const n = JOURS_DE_L_AVANT_APRES
  const avant = joursAvant(jour, n).filter(j => jours.has(j))
  const finis = joursFinisApres(jour, n, jourAvant(aujourdhui))
  const apres = finis.filter(j => jours.has(j))
  const moyenne = (liste: readonly string[], lire: (c: ChiffresDuRepere) => number) =>
    liste.length === 0 ? null : liste.reduce((t, j) => t + lire(jours.get(j)!), 0) / liste.length
  const total = (p: Record<ModeDuQg, number>) => Object.values(p).reduce((t, v) => t + v, 0)
  const ligne = (cle: string, nom: string, lire: (c: ChiffresDuRepere) => number): LigneDeLAvantApres => ({ cle, nom, avant: moyenne(avant, lire), apres: moyenne(apres, lire) })
  const lignes = [
    ligne('joueurs', 'Joueurs, invités compris', c => c.joueurs),
    ligne('profils', 'Profils qui ont joué', c => c.profils),
    ligne('nouveaux', 'Nouveaux profils', c => c.nouveauxProfils),
    ligne('participations', 'Participations', c => total(c.parties)),
    ...(mode ? [ligne(`joueurs-${mode}`, `${NOM_DU_MODE[mode]} : joueurs`, c => c.modes[mode] ?? 0), ligne(`parties-${mode}`, `${NOM_DU_MODE[mode]} : participations`, c => c.parties[mode] ?? 0)] : []),
  ]
  return { jour, avant: { connus: avant.length, sur: n }, apres: { finis: finis.length, connus: apres.length, sur: n }, lignes }
}

/** Les jours de la mémoire autour d'un repère, tels que la page de l'avant / après les reçoit (`GET /api/admin/reperes/avant-apres`). */
export interface JoursDeLAvantApres {
  maintenant: number
  aujourdhui: string
  /** Le premier jour que la mémoire sait ; null tant qu'elle ne sait rien. */
  depuis: string | null
  jours: [string, ChiffresDuRepere][]
}

/** Un jour moyen, écrit : un chiffre après la virgule sous dix — « 0,9 nouveau profil par jour » —, entier au-delà. */
export const moyenneEcrite = (x: number) => formatNumber(x < 10 ? Math.round(x * 10) / 10 : Math.round(x))

/**
 * L'écart d'un jour moyen à l'autre : en pour cent d'un chiffre d'avant de vingt ou plus ; en dessous, la différence
 * elle-même — « +1,4 par jour » : de 1,5 à 3, ce n'est pas « 100 % de plus » (`HABITUDE_EN_POURCENTS`, la règle des
 * tuiles). Pareil quand les deux s'écrivent pareil. Insécables là où une ligne ne doit pas se couper — « 6 % », « par
 * jour » — : au téléphone, la colonne étroite de la carte passe à la ligne après le nombre, jamais avant « % ».
 */
export function ecartDeLAvantApres(avant: number | null, apres: number | null): EcartALHabitude | null {
  if (avant === null || apres === null) return null
  if (moyenneEcrite(avant) === moyenneEcrite(apres)) return { sens: null, texte: 'pareil', suite: '' }
  const sens = apres > avant ? 'plus' : 'moins'
  if (avant < HABITUDE_EN_POURCENTS) {
    const ecart = Math.abs(apres - avant)
    return { sens, texte: `${sens === 'plus' ? '+' : '−'}${moyenneEcrite(ecart)} par jour`, suite: '' }
  }
  const pourcents = Math.round((Math.abs(apres - avant) / avant) * 100)
  return { sens, texte: `${formatNumber(pourcents)} %`, suite: sens === 'plus' ? ' de plus' : ' de moins', ...(pourcents < ECART_FAIBLE_EN_POURCENTS && { faible: true as const }) }
}

// ── Le fil du journal ───────────────────────────────────────────────────────

/**
 * Des événements datés rangés par jour de Paris, dans l'ordre où ils arrivent — le plus récent d'abord : « Aujourd’hui »,
 * « Hier », puis la date, et l'année quand ce n'est pas celle d'aujourd'hui. La règle du journal des gestes
 * (`gestesParJour`, `shared/qg.ts`), pour un fil qui mêle les gestes, les mises en ligne et les incidents.
 */
export function filParJour<T extends { quand: number }>(items: readonly T[], maintenant: number): { jour: string; titre: string; items: T[] }[] {
  const aujourdhui = jourDe(maintenant)
  const groupes: { jour: string; titre: string; items: T[] }[] = []
  for (const item of items) {
    const jour = jourDe(item.quand)
    let groupe = groupes.at(-1)
    if (groupe?.jour !== jour) {
      const titre =
        jour === aujourdhui
          ? 'Aujourd’hui'
          : jour === jourAvant(aujourdhui)
            ? 'Hier'
            : `${jourEnToutesLettres(jour)}${jour.slice(0, 4) === aujourdhui.slice(0, 4) ? '' : ` ${jour.slice(0, 4)}`}`
      groupe = { jour, titre, items: [] }
      groupes.push(groupe)
    }
    groupe.items.push(item)
  }
  return groupes
}

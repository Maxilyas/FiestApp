// Les missions du jour (le plan d'action validé avec le propriétaire le 14
// octobre 2026, après son constat : « le manque d'objectif à court terme » —
// on faisait le quiz du jour, quelques duels, et la campagne, très
// difficile, en décourageait plus d'un).
//
// Trois missions par jour, tirées pour chacun à sa première visite du jour,
// puis figées : une habitude (le quiz du jour), un savoir (des bonnes
// réponses), une découverte (un mode qu'il joue moins). Chacune paie quinze
// confettis et vingt-cinq points d'expérience, les trois ensemble autant de
// plus et un tampon : au plus 60 confettis et 100 points par jour (« Moyen :
// ~60 par jour », le choix du propriétaire ; le joueur médian en gagnait 9
// par jour joué, mesuré sur la production le même jour). Sept tampons
// remplissent la carte de la semaine, et le lundi son coffre s'ouvre
// (`shared/coffre.ts`).
//
// Rien ne se compte à côté : l'avancement de chaque mission se relit des
// journaux de chaque mode, jour par jour (`activiteDesJours`). Seul s'écrit
// ce qui est fait — une mission faite le reste (`profile_missions`) — et le
// solde et l'expérience se relisent de ces lignes.

import { CATEGORIES } from './categories'
import type { CoffreEnAttente } from './coffre'
import { ETOILES_DE_LA_MEDAILLE, jourAvant, jourDe, medailleDe } from './jour'

/** Trois par jour : une habitude, un savoir, une découverte. */
export const MISSIONS_PAR_JOUR = 3

/** Ce que paie une mission faite : un choix de produit (`docs/reference/baremes.md`). */
export const CONFETTIS_D_UNE_MISSION = 15
export const XP_D_UNE_MISSION = 25

/** Ce que paient les trois faites le même jour, en plus d'elles, avec le tampon de la semaine. */
export const CONFETTIS_DES_TROIS = 15
export const XP_DES_TROIS = 25

/** Le rang de la ligne des trois, dans `profile_missions` : celle qui fait le tampon du jour. */
export const RANG_DES_TROIS = MISSIONS_PAR_JOUR

export type SorteDeMission = 'jour' | 'jour-etoiles' | 'justes' | 'categorie' | 'serie' | 'duel' | 'sentier' | 'parcours' | 'defi' | 'revision'

export type FamilleDeMission = 'habitude' | 'savoir' | 'decouverte'

/** Une mission tirée, telle que `profile_missions.mission` la garde. */
export interface Mission {
  sorte: SorteDeMission
  /** Ce qu'il faut atteindre : une partie, cinq bonnes réponses, deux étoiles. */
  cible: number
  /** La catégorie d'une mission de savoir (« Histoire »). */
  categorie?: string
}

const FAMILLE: Readonly<Record<SorteDeMission, FamilleDeMission>> = {
  jour: 'habitude',
  'jour-etoiles': 'habitude',
  justes: 'savoir',
  categorie: 'savoir',
  serie: 'decouverte',
  duel: 'decouverte',
  sentier: 'decouverte',
  parcours: 'decouverte',
  defi: 'decouverte',
  revision: 'decouverte',
}

export const NOM_DE_LA_FAMILLE: Readonly<Record<FamilleDeMission, string>> = { habitude: 'Habitude', savoir: 'Savoir', decouverte: 'Découverte' }

export const familleDe = (m: Mission): FamilleDeMission => FAMILLE[m.sorte]

/** Les découvertes : un mode chacune, qu'on tire d'abord parmi ceux qu'il ne joue pas. */
export const DECOUVERTES: readonly SorteDeMission[] = ['serie', 'duel', 'sentier', 'parcours', 'defi', 'revision']

/** Une mission relue de la base : refusée si elle ne se lit plus (une sorte retirée, une cible absurde). */
export function lireLaMission(brut: unknown): Mission | null {
  if (!brut || typeof brut !== 'object') return null
  const { sorte, cible, categorie } = brut as Record<string, unknown>
  if (typeof sorte !== 'string' || !(sorte in FAMILLE)) return null
  if (typeof cible !== 'number' || !Number.isInteger(cible) || cible < 1 || cible > 100) return null
  if (sorte === 'categorie' && (typeof categorie !== 'string' || !(CATEGORIES as readonly string[]).includes(categorie))) return null
  return { sorte: sorte as SorteDeMission, cible, ...(sorte === 'categorie' && { categorie: categorie as string }) }
}

// ── Ce que les journaux disent d'un jour ─────────────────────────────────

/** Ce qu'il a fait un jour de Paris, de quoi juger chaque mission. */
export interface ActiviteDuJour {
  /** Sa partie du quiz du jour : finie, ses bonnes réponses, les questions qui comptent. */
  quizDuJour: { finie: boolean; justes: number; questions: number } | null
  /** Ses bonnes réponses qui paient un confetti, de tous les modes : soirées, quiz du jour, campagne. */
  justes: number
  /** Ses bonnes réponses par catégorie, au quiz du jour et en campagne. */
  parCategorie: Readonly<Record<string, number>>
  /** Le plus de bonnes réponses d'une même série de la campagne (`mode = 'serie'`) ce jour-là. */
  meilleureSerie: number
  /** Ses duels finis — contre quelqu'un, entre amis ou au dé. */
  duels: number
  /** Ses épreuves de sentier jouées jusqu'au bout, validées ou ratées. */
  epreuves: number
  /** Ses étapes de parcours de thème réussies. */
  etapes: number
  /** Ses défis de la semaine finis. */
  defis: number
  /** Les questions de son carnet revues — juste ou non. */
  revues: number
}

export const AUCUNE_ACTIVITE: ActiviteDuJour = {
  quizDuJour: null,
  justes: 0,
  parCategorie: {},
  meilleureSerie: 0,
  duels: 0,
  epreuves: 0,
  etapes: 0,
  defis: 0,
  revues: 0,
}

/** Ce que les magasins lisent de ses journaux, depuis un jour : de quoi refaire chaque jour (`activiteDesJours`). */
export interface JournauxDesJours {
  /** Ses parties du quiz du jour (`jour_parties`), les questions annulées déjà retirées. */
  jour: readonly { jour: string; finie: boolean; justes: number; questions: number }[]
  /** Ses bonnes réponses du quiz du jour, par jour et par catégorie. */
  jourParCategorie: readonly { jour: string; categorie: string | null; n: number }[]
  /** Ses parties de campagne finies, ou en cours (`finieLe` nul) : leur mode et leur issue. */
  series: readonly { id: string; mode: string; issue: string | null; finieLe: number | null }[]
  /** Ses réponses de campagne, une par question posée. */
  reponses: readonly { serie: string; mode: string; juste: boolean; le: number; categorie: string | null }[]
  /** Ses soirées qui comptent, à leur première ligne de crédit, et leurs confettis (`confettisDeSoiree`). */
  soirees: readonly { le: number; confettis: number }[]
}

/**
 * Chaque jour de Paris de ce que disent ses journaux. Une dérivation pure :
 * une règle de mission changée vaut pour tout ce qui a déjà été joué — sauf
 * ce qui est déjà fait, que rien ne reprend.
 */
export function activiteDesJours(j: JournauxDesJours): Map<string, ActiviteDuJour> {
  const jours = new Map<string, ActiviteDuJour & { parCategorie: Record<string, number> }>()
  const du = (jour: string) => {
    let a = jours.get(jour)
    if (!a) jours.set(jour, (a = { ...AUCUNE_ACTIVITE, parCategorie: {} }))
    return a
  }
  for (const p of j.jour) {
    const a = du(p.jour)
    a.quizDuJour = { finie: p.finie, justes: p.justes, questions: p.questions }
    a.justes += p.justes
  }
  for (const c of j.jourParCategorie) {
    if (!c.categorie) continue
    const a = du(c.jour)
    a.parCategorie[c.categorie] = (a.parCategorie[c.categorie] ?? 0) + c.n
  }
  for (const s of j.soirees) du(jourDe(s.le)).justes += s.confettis
  // Une série jouée sur deux jours compte ses bonnes réponses au jour de chacune.
  const parSerie = new Map<string, number>()
  for (const r of j.reponses) {
    const jour = jourDe(r.le)
    const a = du(jour)
    if (r.mode === 'revision') a.revues++
    if (!r.juste) continue
    a.justes++
    // Le carnet repose ce qu'il a raté : ses bonnes réponses paient, mais ne disent rien de son savoir.
    if (r.categorie && r.mode !== 'revision') a.parCategorie[r.categorie] = (a.parCategorie[r.categorie] ?? 0) + 1
    if (r.mode === 'serie') {
      const cle = `${r.serie}|${jour}`
      const n = (parSerie.get(cle) ?? 0) + 1
      parSerie.set(cle, n)
      a.meilleureSerie = Math.max(a.meilleureSerie, n)
    }
  }
  for (const s of j.series) {
    if (s.finieLe === null) continue
    const a = du(jourDe(s.finieLe))
    if (s.mode === 'duel' || s.mode === 'rencontre') a.duels++
    // Un rejeu abandonné, une épreuve libérée par l'administrateur n'ont pas d'issue : ils n'ont pas été joués.
    else if (s.mode === 'sentier' && s.issue !== null) a.epreuves++
    else if (s.mode === 'sujet' && s.issue === 'validee') a.etapes++
    else if (s.mode === 'defi') a.defis++
  }
  return jours
}

/** Où il en est d'une mission, ce jour-là : de zéro à sa cible. */
export function avancement(m: Mission, a: ActiviteDuJour): number {
  const n = (() => {
    switch (m.sorte) {
      case 'jour':
        return a.quizDuJour?.finie ? 1 : 0
      case 'jour-etoiles': {
        const q = a.quizDuJour
        const medaille = q ? medailleDe(q.justes, q.questions) : null
        return medaille ? ETOILES_DE_LA_MEDAILLE[medaille] : 0
      }
      case 'justes':
        return a.justes
      case 'categorie':
        return a.parCategorie[m.categorie ?? ''] ?? 0
      case 'serie':
        return a.meilleureSerie
      case 'duel':
        return a.duels
      case 'sentier':
        return a.epreuves
      case 'parcours':
        return a.etapes
      case 'defi':
        return a.defis
      case 'revision':
        return a.revues
    }
  })()
  return Math.min(m.cible, n)
}

// ── Le tirage ────────────────────────────────────────────────────────────

/** Ce que le tirage sait de lui, le jour où il tire ses missions. */
export interface ContexteDuTirage {
  /** Il a déjà sa partie du quiz du jour aujourd'hui : l'habitude ne vise plus ses étoiles, qu'il a peut-être manquées. */
  quizDuJourJoue: boolean
  /** Ses jours de quiz du jour sur les sept derniers : un habitué vise ses étoiles. */
  joursDuJour: number
  /** Les découvertes qu'il a jouées ces sept derniers jours : la découverte vise d'abord les autres. */
  decouvertesJouees: ReadonlySet<SorteDeMission>
  /** Le défi de la semaine, fini : il ne se relève pas deux fois. */
  defiFini: boolean
  /** Les questions de son carnet à revoir aujourd'hui. */
  aRevoir: number
  /** Ses missions d'hier : on ne repose pas la même découverte deux jours de suite. */
  hier: readonly Mission[]
}

/**
 * Un nombre dans [0, 1[ à chaque appel, toujours le même pour la même
 * graine (mulberry32 sur une empreinte FNV-1a) : deux lectures qui tirent
 * ensemble ses missions du jour tirent les mêmes.
 */
export function hasardDe(graine: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Un élément tiré à son poids. */
function auPoids<T>(choix: readonly (readonly [T, number])[], x: number): T {
  const total = choix.reduce((n, [, p]) => n + p, 0)
  let cumul = 0
  for (const [v, p] of choix) {
    cumul += p / total
    if (x < cumul) return v
  }
  return choix[choix.length - 1][0]
}

/**
 * Ses trois missions du jour : une habitude, un savoir, une découverte, dans
 * cet ordre. La graine (son profil et le jour) les fixe : la même lecture
 * deux fois tire les mêmes.
 */
export function tirerLesMissions(graine: string, c: ContexteDuTirage): Mission[] {
  const x = hasardDe(graine)
  // L'habitude : le quiz du jour, ou ses étoiles pour qui le joue presque chaque jour — pas s'il l'a déjà joué.
  const habitude: Mission =
    !c.quizDuJourJoue && c.joursDuJour >= 3 && x() < 0.4 ? { sorte: 'jour-etoiles', cible: c.joursDuJour >= 5 ? 2 : 1 } : { sorte: 'jour', cible: 1 }
  // Le savoir : des bonnes réponses où il veut, ou dans une catégorie.
  const savoir: Mission =
    x() < 0.55
      ? {
          sorte: 'justes',
          cible: auPoids(
            [
              [10, 2],
              [15, 2],
              [20, 1],
            ],
            x(),
          ),
        }
      : { sorte: 'categorie', cible: 5, categorie: CATEGORIES[Math.floor(x() * CATEGORIES.length)] }
  // La découverte : un mode, trois fois plus souvent un qu'il n'a pas joué ces sept jours ; jamais celle d'hier.
  const hier = new Set(c.hier.map(m => m.sorte))
  const possibles = DECOUVERTES.filter(s => !hier.has(s) && (s !== 'defi' || !c.defiFini) && (s !== 'revision' || c.aRevoir >= 3))
  const sorte = auPoids(
    (possibles.length > 0 ? possibles : (['serie'] as const)).map(s => [s, c.decouvertesJouees.has(s) ? 1 : 3] as const),
    x(),
  )
  const cible = sorte === 'serie' ? (x() < 0.6 ? 5 : 7) : sorte === 'revision' ? Math.min(5, c.aRevoir) : 1
  return [habitude, savoir, { sorte, cible }]
}

// ── Ce que la page en dit ───────────────────────────────────────────────

/** Le titre d'une mission : ce qu'il faut faire. */
export function titreDeLaMission(m: Mission): string {
  switch (m.sorte) {
    case 'jour':
      return 'Joue le quiz du jour'
    case 'jour-etoiles':
      return m.cible > 1 ? `Décroche ${m.cible === 2 ? 'deux' : m.cible} étoiles au quiz du jour` : 'Décroche une étoile au quiz du jour'
    case 'justes':
      return `Trouve ${m.cible} bonnes réponses`
    case 'categorie':
      return `Trouve ${m.cible} bonnes réponses en ${m.categorie}`
    case 'serie':
      return `Enchaîne ${m.cible} bonnes réponses dans une série`
    case 'duel':
      return 'Joue un duel'
    case 'sentier':
      return 'Tente une épreuve d’un sentier'
    case 'parcours':
      return 'Réussis une étape d’un parcours'
    case 'defi':
      return 'Relève le défi de la semaine'
    case 'revision':
      return m.cible > 1 ? `Revois ${m.cible} questions de ton carnet` : 'Revois une question de ton carnet'
  }
}

/** Ce qui l'éclaire, sous son titre : où, et comment. */
export function aideDeLaMission(m: Mission): string {
  switch (m.sorte) {
    case 'jour':
      return 'Ses dix questions, jusqu’au bout.'
    case 'jour-etoiles':
      return m.cible > 1 ? 'Deux étoiles : huit bonnes réponses sur dix.' : 'Une étoile : six bonnes réponses sur dix.'
    case 'justes':
      return 'Où tu veux : en soirée, au quiz du jour, en campagne, en duel.'
    case 'categorie':
      return 'Au quiz du jour ou en campagne : une série, un sentier, un duel.'
    case 'serie':
      return 'La campagne, trois vies : jusqu’où iras-tu ?'
    case 'duel':
      return 'Contre Automate au dé, ou contre qui tu veux.'
    case 'sentier':
      return 'Validée ou non, seul compte de l’avoir jouée jusqu’au bout.'
    case 'parcours':
      return 'Sans vies : rate, rejoue, rien ne se perd.'
    case 'defi':
      return 'La même série pour tous, une seule tentative.'
    case 'revision':
      return 'Ce que tu as raté revient : retrouve-le.'
  }
}

/** Où la faire, d'un toucher : son adresse et le mot du bouton. Une catégorie se retient avant d'y aller (`categorie`). */
export function lienDeLaMission(m: Mission): { href: string; libelle: string; categorie?: string } {
  switch (m.sorte) {
    case 'jour':
    case 'jour-etoiles':
      return { href: '/jour', libelle: 'Y aller' }
    case 'justes':
    case 'serie':
      return { href: '/campagne', libelle: 'Jouer une série' }
    case 'categorie':
      return { href: '/campagne', libelle: 'Jouer', categorie: m.categorie }
    case 'duel':
      return { href: '/duels', libelle: 'Défier' }
    case 'sentier':
      return { href: '/campagne#sentiers', libelle: 'Les sentiers' }
    case 'parcours':
    case 'revision':
      return { href: '/campagne#carnet', libelle: m.sorte === 'revision' ? 'Mon carnet' : 'Les parcours' }
    case 'defi':
      return { href: '/campagne#defi', libelle: 'Le défi' }
  }
}

/** Une mission telle que la page la montre. */
export interface MissionVue {
  /** Sa place : 0, 1, 2. */
  rang: number
  sorte: SorteDeMission
  famille: FamilleDeMission
  titre: string
  aide: string
  cible: number
  /** Où il en est, de zéro à la cible. */
  avance: number
  faite: boolean
  lien: { href: string; libelle: string; categorie?: string }
}

/** La vue d'une mission, au vu de sa journée. */
export function vueDeLaMission(rang: number, m: Mission, a: ActiviteDuJour, faite: boolean): MissionVue {
  return {
    rang,
    sorte: m.sorte,
    famille: familleDe(m),
    titre: titreDeLaMission(m),
    aide: aideDeLaMission(m),
    cible: m.cible,
    avance: faite ? m.cible : avancement(m, a),
    faite,
    lien: lienDeLaMission(m),
  }
}

/** Ses missions du jour, telles que l'accueil, leur feuille et la fin d'une partie les lisent (`GET /api/joueur/missions`). */
export interface MissionsDuJour {
  jour: string
  missions: MissionVue[]
  /** Les trois faites : le bonus et le tampon du jour. */
  trois: boolean
  /** Ce qui vient d'être fait, à cette lecture même — les rangs, `RANG_DES_TROIS` pour les trois : la fin d'une partie l'annonce. */
  nouvelles: number[]
  /** La carte de la semaine : son lundi, et un tampon par jour fait, du lundi au dimanche. */
  semaine: { lundi: string; tampons: boolean[] }
  /** Les coffres des semaines passées qui attendent d'être ouverts, le plus ancien d'abord. */
  coffres: CoffreEnAttente[]
  /** Les minutes avant minuit, à Paris : « trois nouvelles à minuit, plus que 7 h ». */
  minutesAvantMinuit: number
}

/** Ce qui reste à gagner aujourd'hui : une mission pas faite paie la sienne, et les trois le bonus. */
export function resteAGagner(m: Pick<MissionsDuJour, 'missions' | 'trois'>): { confettis: number; xp: number } {
  const restantes = m.missions.filter(x => !x.faite).length
  return {
    confettis: restantes * CONFETTIS_D_UNE_MISSION + (m.trois ? 0 : CONFETTIS_DES_TROIS),
    xp: restantes * XP_D_UNE_MISSION + (m.trois ? 0 : XP_DES_TROIS),
  }
}

/** Ce que des lignes faites ont payé : chaque mission la sienne, chaque jour aux trois faites son bonus. */
export function gainsDesMissions(faites: number, joursAuxTrois: number): { confettis: number; xp: number } {
  return {
    confettis: faites * CONFETTIS_D_UNE_MISSION + joursAuxTrois * CONFETTIS_DES_TROIS,
    xp: faites * XP_D_UNE_MISSION + joursAuxTrois * XP_DES_TROIS,
  }
}

/** Le lundi de la semaine d'un jour (« 2026-10-12 »), au calendrier : le jour est déjà celui de Paris. */
export function lundiDe(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number)
  return jourAvant(jour, (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7)
}

/** Les sept jours d'une semaine, du lundi au dimanche. */
export const joursDeLaSemaine = (lundi: string): string[] => Array.from({ length: 7 }, (_, i) => jourAvant(lundi, -i))

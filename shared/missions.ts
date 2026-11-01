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
//
// Le 1er novembre 2026, le propriétaire : « chaque mode de jeu doit être
// représenté et permet d'explorer l'application via les missions du jour ».
// L'épreuve d'un sentier vise une catégorie — « ça incitera peut-être les
// gens à faire la campagne », validée ou non, à n'importe quel palier —, le
// Cabinet de curiosités a sa mission, « plus rare », et l'on défie quelqu'un
// sur un thème précis. Les soirées n'en ont pas : elles ne se jouent pas
// seul, et une mission doit pouvoir se faire le jour même, quoi qu'il arrive.

import { BRANCHES, branche as laBranche } from './branches'
import { CATEGORIES } from './categories'
import type { CoffreEnAttente } from './coffre'
import { jourAvant, jourDe } from './jour'
import type { FamilleDeSujet } from './sujets'

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

export type SorteDeMission =
  | 'jour'
  | 'jour-etoiles'
  | 'justes'
  | 'categorie'
  | 'serie'
  | 'duel'
  | 'sentier'
  | 'parcours'
  | 'defi'
  | 'revision'
  | 'cabinet'
  | 'defier'

export type FamilleDeMission = 'habitude' | 'savoir' | 'decouverte'

/** Une mission tirée, telle que `profile_missions.mission` la garde. */
export interface Mission {
  sorte: SorteDeMission
  /** Ce qu'il faut atteindre : une partie, cinq bonnes réponses, deux étoiles. */
  cible: number
  /** La catégorie d'une mission de savoir (« Histoire »), ou celle du sentier d'une épreuve — absente d'une épreuve tirée avant le 1er novembre 2026 : n'importe quel sentier. */
  categorie?: string
  /** Le sujet d'un duel à lancer (« harry-potter », `shared/sujets.ts`)… */
  sujet?: string
  /** … et son nom, tel qu'il a été tiré : la page le dit sans lire le catalogue des sujets, que le Cabinet et l'accueil ne téléchargent pas. */
  nomDuSujet?: string
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
  cabinet: 'decouverte',
  defier: 'decouverte',
}

export const NOM_DE_LA_FAMILLE: Readonly<Record<FamilleDeMission, string>> = { habitude: 'Habitude', savoir: 'Savoir', decouverte: 'Découverte' }

export const familleDe = (m: Mission): FamilleDeMission => FAMILLE[m.sorte]

/** Les découvertes : un mode chacune, qu'on tire d'abord parmi ceux qu'il ne joue pas. */
export const DECOUVERTES: readonly SorteDeMission[] = ['serie', 'duel', 'sentier', 'parcours', 'defi', 'revision', 'cabinet', 'defier']

/**
 * Ce que pèse la mission du Cabinet de curiosités au tirage de la découverte,
 * face à une autre — une, d'office — : moitié moins (le souhait du
 * propriétaire du 1er novembre 2026 : « je veux que ce soit plus rare ») ; une
 * fois tous les quinze jours environ à qui ne le joue pas. Un choix de produit
 * (`docs/reference/baremes.md`), qui ne vaut que pour les tirages à venir.
 */
export const POIDS_DU_CABINET = 0.5

/**
 * Les familles de sujets dont un duel à lancer tire son thème : les thèmes
 * et les univers (« Les animaux », « Harry Potter ») — ni une époque, ni un
 * pays, ni un fil rouge, ni une fête, qui ne revient qu'à sa saison. Le
 * serveur en lit le catalogue (`ContexteDuTirage.themes`).
 */
export const FAMILLES_DES_DEFIS: readonly FamilleDeSujet[] = ['theme', 'univers']

/** Une clé de sujet telle que le catalogue les écrit (« harry-potter », « sport/football ») : ce qu'une ligne relue peut porter. */
const CLE_DE_SUJET = /^[a-z0-9][a-z0-9/-]{0,63}$/

/**
 * Une mission relue de la base : refusée si elle ne se lit plus (une sorte
 * retirée, une cible absurde). Une épreuve sans catégorie — ou d'une catégorie
 * qui n'existe plus — se fait sur n'importe quel sentier ; un duel sans sujet,
 * sur n'importe quel thème : chacune reste faisable le jour même.
 */
export function lireLaMission(brut: unknown): Mission | null {
  if (!brut || typeof brut !== 'object') return null
  const { sorte, cible, categorie, sujet, nomDuSujet } = brut as Record<string, unknown>
  if (typeof sorte !== 'string' || !(sorte in FAMILLE)) return null
  if (typeof cible !== 'number' || !Number.isInteger(cible) || cible < 1 || cible > 100) return null
  const uneCategorie = typeof categorie === 'string' && (CATEGORIES as readonly string[]).includes(categorie)
  if (sorte === 'categorie' && !uneCategorie) return null
  const unSujet = sorte === 'defier' && typeof sujet === 'string' && CLE_DE_SUJET.test(sujet)
  return {
    sorte: sorte as SorteDeMission,
    cible,
    ...((sorte === 'categorie' || sorte === 'sentier') && uneCategorie && { categorie: categorie as string }),
    ...(unSujet && { sujet: sujet as string }),
    ...(unSujet && typeof nomDuSujet === 'string' && nomDuSujet.trim() !== '' && nomDuSujet.length <= 80 && { nomDuSujet }),
  }
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
  /** Ses duels classés lancés — contre quelqu'un, sa tentative jouée jusqu'au bout : il part alors à l'autre —, tous sujets confondus… */
  duelsLances: number
  /** … et par sujet (« harry-potter ») : ceux d'un thème précis. */
  duelsLancesParSujet: Readonly<Record<string, number>>
  /** Ses épreuves de sentier jouées jusqu'au bout, validées ou ratées. */
  epreuves: number
  /** Les mêmes, par la catégorie de leur sentier (« Histoire » : les mythologies). */
  epreuvesParCategorie: Readonly<Record<string, number>>
  /** Ses étapes de parcours de thème réussies. */
  etapes: number
  /** Ses défis de la semaine finis. */
  defis: number
  /** Les questions de son carnet revues — juste ou non. */
  revues: number
  /** Ses épreuves du Cabinet de curiosités où il a répondu à une manche au moins, gagnées ou non. */
  cabinet: number
}

export const AUCUNE_ACTIVITE: ActiviteDuJour = {
  quizDuJour: null,
  justes: 0,
  parCategorie: {},
  meilleureSerie: 0,
  duels: 0,
  duelsLances: 0,
  duelsLancesParSujet: {},
  epreuves: 0,
  epreuvesParCategorie: {},
  etapes: 0,
  defis: 0,
  revues: 0,
  cabinet: 0,
}

/** Une partie de campagne, telle que les missions la lisent (`CampagneStore.activiteDepuis`). */
export interface PartieQueLesMissionsLisent {
  id: string
  mode: string
  issue: string | null
  /** Nul : en cours. */
  finieLe: number | null
  /** Une épreuve : la branche de son sentier (« mythes »), qui dit sa catégorie. */
  branche?: string | null
  /** Une partie sur un sujet : sa clé (« harry-potter »). */
  sujet?: string | null
  /** Un duel classé qu'il a lancé lui-même, contre quelqu'un (`campagne_duels.auteur`, `adversaire`) — pas celui qu'il relève. */
  lance?: boolean
}

/** Ce que les magasins lisent de ses journaux, depuis un jour : de quoi refaire chaque jour (`activiteDesJours`). */
export interface JournauxDesJours {
  /** Ses parties du quiz du jour (`jour_parties`), les questions annulées déjà retirées. */
  jour: readonly { jour: string; finie: boolean; justes: number; questions: number }[]
  /** Ses bonnes réponses du quiz du jour, par jour et par catégorie. */
  jourParCategorie: readonly { jour: string; categorie: string | null; n: number }[]
  /** Ses parties de campagne finies, ou en cours (`finieLe` nul) : leur mode et leur issue. */
  series: readonly PartieQueLesMissionsLisent[]
  /** Ses réponses de campagne, une par question posée. */
  reponses: readonly { serie: string; mode: string; juste: boolean; le: number; categorie: string | null }[]
  /** Ses soirées qui comptent, à leur première ligne de crédit, et leurs confettis (`confettisDeSoiree`). */
  soirees: readonly { le: number; confettis: number }[]
}

/**
 * Les modes de campagne dont les missions comptent les parties finies — les
 * duels et les rencontres, les épreuves, les étapes, le défi
 * (`activiteDesJours`) : la lecture de la campagne ne lit qu'elles
 * (`CampagneStore.activiteDepuis`). Elle relisait toutes les parties de deux à
 * trois semaines, celles du Cabinet comprises, dix par jour, pour les jeter
 * (la revue de sobriété du 25 octobre 2026). Un mode qui compte de plus
 * rejoint la liste : `campagne-index.test.ts` la compare à ce que la règle
 * compte. Le Cabinet de curiosités, qui a sa mission depuis le 1er novembre
 * 2026, n'y entre pas : ses épreuves se comptent dans ses réponses, que la
 * lecture apporte déjà.
 */
export const MODES_QUE_LES_MISSIONS_COMPTENT = ['duel', 'rencontre', 'sentier', 'sujet', 'defi'] as const

/**
 * Chaque jour de Paris de ce que disent ses journaux. Une dérivation pure :
 * une règle de mission changée vaut pour tout ce qui a déjà été joué — sauf
 * ce qui est déjà fait, que rien ne reprend.
 */
export function activiteDesJours(j: JournauxDesJours): Map<string, ActiviteDuJour> {
  const jours = new Map<
    string,
    ActiviteDuJour & { parCategorie: Record<string, number>; epreuvesParCategorie: Record<string, number>; duelsLancesParSujet: Record<string, number> }
  >()
  const du = (jour: string) => {
    let a = jours.get(jour)
    if (!a) jours.set(jour, (a = { ...AUCUNE_ACTIVITE, parCategorie: {}, epreuvesParCategorie: {}, duelsLancesParSujet: {} }))
    return a
  }
  const plusUn = (compte: Record<string, number>, cle: string) => {
    compte[cle] = (compte[cle] ?? 0) + 1
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
  // Une épreuve du Cabinet se lit dans ses réponses, une fois par jour où il y a répondu : ses parties, dix par jour et
  // par joueur, ne se relisent pas pour les missions (`MODES_QUE_LES_MISSIONS_COMPTENT`, la revue de sobriété du
  // 25 octobre 2026), et ses réponses arrivent déjà, du journal en mémoire. Quittée avant sa première réponse, elle n'a
  // pas été jouée ; gagnée ou perdue ensuite, si.
  const auCabinet = new Set<string>()
  for (const r of j.reponses) {
    const jour = jourDe(r.le)
    const a = du(jour)
    if (r.mode === 'revision') a.revues++
    if (r.mode === 'cabinet' && !auCabinet.has(`${r.serie}|${jour}`)) {
      auCabinet.add(`${r.serie}|${jour}`)
      a.cabinet++
    }
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
    if (s.mode === 'duel' || s.mode === 'rencontre') {
      a.duels++
      // Lancé par lui contre quelqu'un, sa tentative finie : le duel part à l'autre. Celui qu'il relève ne compte pas — c'est
      // l'autre qui l'a défié —, ni le dé, contre Automate.
      if (s.mode === 'duel' && s.lance) {
        a.duelsLances++
        if (s.sujet) plusUn(a.duelsLancesParSujet, s.sujet)
      }
    } else if (s.mode === 'sentier' && s.issue !== null) {
      // Un rejeu abandonné, une épreuve libérée par l'administrateur n'ont pas d'issue : ils n'ont pas été joués.
      a.epreuves++
      const categorie = laBranche(s.branche)?.categorie
      if (categorie) plusUn(a.epreuvesParCategorie, categorie)
    } else if (s.mode === 'sujet' && s.issue === 'validee') a.etapes++
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
      // Ses étoiles ne se demandent plus (le 31 octobre 2026, le propriétaire :
      // « huit bonnes réponses au quiz du jour, ce qui est parfois pas
      // possible ») : une seule partie par jour, et une question difficile
      // fermait le tampon pour de bon. Tirée avant, elle se juge comme
      // l'habitude — jouée jusqu'au bout, elle est faite.
      case 'jour-etoiles':
        return a.quizDuJour?.finie ? m.cible : 0
      case 'justes':
        return a.justes
      case 'categorie':
        return a.parCategorie[m.categorie ?? ''] ?? 0
      case 'serie':
        return a.meilleureSerie
      case 'duel':
        return a.duels
      // Le sentier de sa catégorie, à n'importe quel palier, validée ou ratée ; tirée sans catégorie, n'importe lequel.
      case 'sentier':
        return m.categorie ? (a.epreuvesParCategorie[m.categorie] ?? 0) : a.epreuves
      case 'parcours':
        return a.etapes
      case 'defi':
        return a.defis
      case 'revision':
        return a.revues
      case 'cabinet':
        return a.cabinet
      // Sur son thème ; relu sans sujet, n'importe quel duel lancé contre quelqu'un.
      case 'defier':
        return m.sujet ? (a.duelsLancesParSujet[m.sujet] ?? 0) : a.duelsLances
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
  /** Le Cabinet de curiosités se joue ici, ni en maintenance ni bientôt disponible : sa mission se propose. */
  cabinet: boolean
  /** Un autre profil existe, qu'il peut défier : sans lui, un duel à lancer ne se ferait jamais. */
  adversaires: boolean
  /** Les thèmes qu'un duel à lancer peut viser (`FAMILLES_DES_DEFIS`), leur clé et leur nom : le serveur les lit du catalogue des sujets. */
  themes: readonly { cle: string; nom: string }[]
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
  // L'habitude : le quiz du jour, jusqu'au bout. Ses étoiles ne se tirent
  // plus : chaque mission doit pouvoir se faire en jouant, et le quiz du jour
  // ne se joue qu'une fois — une partie ratée fermait le tampon du jour (le
  // 31 octobre 2026). Le tirage d'avant passait ici un nombre :
  // il le passe encore, et le savoir et la découverte d'un même jour restent
  // ceux qu'ils auraient été.
  if (!c.quizDuJourJoue && c.joursDuJour >= 3) x()
  const habitude: Mission = { sorte: 'jour', cible: 1 }
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
  // La découverte : un mode, trois fois plus souvent un qu'il n'a pas joué ces sept jours ; jamais celle d'hier. Le
  // Cabinet, moitié moins (`POIDS_DU_CABINET`).
  const hier = new Set(c.hier.map(m => m.sorte))
  const possibles = DECOUVERTES.filter(s => !hier.has(s) && seProposeAujourdhui(s, c))
  const sorte = auPoids(
    (possibles.length > 0 ? possibles : (['serie'] as const)).map(s => [s, (s === 'cabinet' ? POIDS_DU_CABINET : 1) * (c.decouvertesJouees.has(s) ? 1 : 3)] as const),
    x(),
  )
  return [habitude, savoir, laDecouverte(sorte, c, x)]
}

/**
 * Une découverte qui peut se faire aujourd'hui, quoi qu'il arrive : le défi
 * pas encore relevé, trois questions au carnet, le Cabinet ouvert, quelqu'un
 * à défier et un thème pour le faire.
 */
function seProposeAujourdhui(s: SorteDeMission, c: ContexteDuTirage): boolean {
  switch (s) {
    case 'defi':
      return !c.defiFini
    case 'revision':
      return c.aRevoir >= 3
    case 'cabinet':
      return c.cabinet
    case 'defier':
      return c.adversaires && c.themes.length > 0
    default:
      return true
  }
}

/** La découverte tirée, sa cible et ce qu'elle vise. */
function laDecouverte(sorte: SorteDeMission, c: ContexteDuTirage, x: () => number): Mission {
  switch (sorte) {
    case 'serie':
      return { sorte, cible: x() < 0.6 ? 5 : 7 }
    case 'revision':
      return { sorte, cible: Math.min(5, c.aRevoir) }
    // Un sentier, et pas n'importe lequel (le 1er novembre 2026) : la campagne se découvre catégorie par catégorie.
    case 'sentier':
      return { sorte, cible: 1, categorie: CATEGORIES[Math.floor(x() * CATEGORIES.length)] }
    case 'defier': {
      const theme = c.themes[Math.floor(x() * c.themes.length)]
      return { sorte, cible: 1, sujet: theme.cle, nomDuSujet: theme.nom }
    }
    default:
      return { sorte, cible: 1 }
  }
}

// ── Ce que la page en dit ───────────────────────────────────────────────

/** Le titre d'une mission : ce qu'il faut faire. */
export function titreDeLaMission(m: Mission): string {
  switch (m.sorte) {
    case 'jour':
      return 'Joue le quiz du jour'
    // Une mission d'étoiles tirée avant le 31 octobre 2026 se lit comme l'habitude : c'est ainsi qu'elle se juge.
    case 'jour-etoiles':
      return 'Joue le quiz du jour'
    case 'justes':
      return `Trouve ${m.cible} bonnes réponses`
    case 'categorie':
      return `Trouve ${m.cible} bonnes réponses en ${m.categorie}`
    case 'serie':
      return `Enchaîne ${m.cible} bonnes réponses dans une série`
    case 'duel':
      return 'Joue un duel'
    case 'sentier':
      return m.categorie ? `Tente une épreuve en ${m.categorie}` : 'Tente une épreuve d’un sentier'
    case 'parcours':
      return 'Réussis une étape d’un parcours'
    case 'defi':
      return 'Relève le défi de la semaine'
    case 'revision':
      return m.cible > 1 ? `Revois ${m.cible} questions de ton carnet` : 'Revois une question de ton carnet'
    case 'cabinet':
      return 'Joue une épreuve au Cabinet de curiosités'
    case 'defier':
      return m.nomDuSujet ? `Défie quelqu’un sur « ${m.nomDuSujet} »` : 'Défie quelqu’un en duel'
  }
}

/** Le sentier d'une catégorie (« Histoire » : les mythologies) : un par catégorie. */
const sentierDe = (categorie: string | undefined) => (categorie ? BRANCHES.find(b => b.categorie === categorie) : undefined)

/** Ce qui l'éclaire, sous son titre : où, et comment. */
export function aideDeLaMission(m: Mission): string {
  switch (m.sorte) {
    case 'jour':
    case 'jour-etoiles':
      return 'Ses dix questions, jusqu’au bout.'
    case 'justes':
      return 'Où tu veux : en soirée, au quiz du jour, en campagne, en duel.'
    case 'categorie':
      return 'Au quiz du jour ou en campagne : une série, un sentier, un duel.'
    case 'serie':
      return 'La campagne, trois vies : jusqu’où iras-tu ?'
    case 'duel':
      return 'Contre Automate au dé, ou contre qui tu veux.'
    case 'sentier': {
      const sentier = sentierDe(m.categorie)
      return sentier
        ? `Sur « ${sentier.nom} », à n’importe quel palier : validée ou non, il suffit de la jouer jusqu’au bout.`
        : 'Validée ou non, seul compte de l’avoir jouée jusqu’au bout.'
    }
    case 'parcours':
      return 'Sans vies : rate, rejoue, rien ne se perd.'
    case 'defi':
      return 'La même série pour tous, une seule tentative.'
    case 'revision':
      return 'Ce que tu as raté revient : retrouve-le.'
    case 'cabinet':
      return 'Une étape de ta traversée, n’importe quel jeu : gagnée ou non, elle compte dès ta première réponse.'
    case 'defier':
      return m.sujet
        ? 'Un duel classé sur ce thème, contre qui tu veux : il lui part à ta dernière réponse.'
        : 'Un duel classé, contre qui tu veux : il lui part à ta dernière réponse.'
  }
}

/** Où la faire, d'un toucher : son adresse et le mot du bouton. Une catégorie ou un sujet se retient avant d'y aller (`categorie`, `sujet`). */
export function lienDeLaMission(m: Mission): LienDUneMission {
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
    // Son sentier, ouvert sur son palier à jouer (`/campagne#sentier-mythes`).
    case 'sentier': {
      const sentier = sentierDe(m.categorie)
      return sentier ? { href: `/campagne#sentier-${sentier.key}`, libelle: 'Le sentier' } : { href: '/campagne#sentiers', libelle: 'Les sentiers' }
    }
    case 'parcours':
    case 'revision':
      return { href: '/campagne#carnet', libelle: m.sorte === 'revision' ? 'Mon carnet' : 'Les parcours' }
    case 'defi':
      return { href: '/campagne#defi', libelle: 'Le défi' }
    case 'cabinet':
      return { href: '/cabinet', libelle: 'Le Cabinet' }
    // La préparation d'un duel, son thème déjà choisi : il ne reste qu'à choisir contre qui.
    case 'defier':
      return { href: '/duels#defier', libelle: 'Défier', ...(m.sujet ? { sujet: m.sujet } : {}) }
  }
}

/** Le lien d'une mission : son adresse, le mot du bouton, et ce que la page retient avant d'y aller — sa catégorie, ou le sujet d'un duel. */
export interface LienDUneMission {
  href: string
  libelle: string
  categorie?: string
  sujet?: string
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
  lien: LienDUneMission
}

/** La vue d'une mission, au vu de sa journée. */
export function vueDeLaMission(rang: number, m: Mission, a: ActiviteDuJour, faite: boolean): MissionVue {
  // Des étoiles tirées avant le 31 octobre 2026 : une partie à jouer, « 0/2 » ne dirait plus rien.
  if (m.sorte === 'jour-etoiles') m = { sorte: 'jour', cible: 1 }
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

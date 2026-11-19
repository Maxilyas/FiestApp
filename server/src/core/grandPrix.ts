// Le Grand Prix (`shared/grandPrix.ts`) : un parcours de dix obstacles, le
// temps d'un jour, contre le fantôme d'un joueur. Ce magasin tient les
// Grands Prix que le QG programme, le vivier de chaque fantôme — ses vraies
// réponses, figées à la programmation —, les courses et leurs sauts, et range
// ce qu'une victoire fait tomber (le flot, l'avatar en plus) sur le profil.
//
// Le chrono est celui du quiz du jour (`core/jour.ts`) : un obstacle se sert
// quand le coureur le demande (`servie_le`), sa réponse se mesure à l'horloge
// du serveur (invariant 6), avec la marge du réseau (`GRACE_MS`) ; un obstacle
// laissé passer se compte « refus » à la lecture suivante, sans chronomètre à
// réarmer (invariant 5 : rien à réarmer). La bonne réponse, l'anecdote et ce
// qu'a répondu le fantôme n'arrivent au téléphone qu'avec la révélation
// (invariant 1) ; seul le temps du fantôme part avec l'obstacle — il saute
// sous les yeux du coureur, sans dire s'il fait tomber sa barre.
//
// Ni expérience, ni confettis, ni mission, ni compagnon qui grandit : les
// essais sont illimités, et le prix, c'est le flot (la décision du
// propriétaire, le 19 novembre 2026).

import { randomUUID } from 'node:crypto'
import type { Row } from '@libsql/client'
import { clientDistant, type Client } from './distante'
import { GRACE_MS } from '../games/quiz'
import type { ProfileRec, ProfileStore } from '../auth/profiles'
import { jourDe, jourValide } from '../../../shared/jour'
import { apparenceDeLAvatar, type ApparenceDeLAvatar } from '../../../shared/profil'
import { tronquer } from '../../../shared/avatars'
import { sqlDansLaBase } from '../../../shared/horsDeLaBase'
import { PRIX_DES_GRANDS_PRIX, legendaire } from '../../../shared/legendaires'
import { sujetParCle } from '../../../shared/sujets'
import {
  THEMES_DU_TERRAIN,
  DUREE_D_UN_OBSTACLE_S,
  QUESTIONS_POUR_COURIR,
  MOT_DU_GRAND_PRIX_MAX,
  OBSTACLES_DU_GRAND_PRIX,
  RUBAN_PAR_DEFAUT,
  TITRE_DU_GRAND_PRIX_MAX,
  bat,
  cleDuFlot,
  cleDuPrix,
  estUnRuban,
  penaliteDuSaut,
  rangementDuGrandPrix,
  scoreDe,
  tempsDuSaut,
  tirerLeParcours,
  tirerUnRythme,
  type BilanDuFantome,
  type ThemeDuTerrain,
  type CleDeRuban,
  type CourseVue,
  type EtatDuGrandPrix,
  type FantomeVu,
  type FinDeCourse,
  type FlotDuCarnet,
  type GrandPrixAuQg,
  type ApercuDuFantome,
  type GrandPrixDAccueil,
  type GrandPrixVu,
  type ObstacleVu,
  type RevelationDObstacle,
  type Saut,
  type SautVu,
  type ScoreDeCourse,
  type VainqueurVu,
} from '../../../shared/grandPrix'

/**
 * Ce qu'un vivier garde au plus : six cents questions de campagne, partagées
 * à parts égales entre les thèmes du terrain (deux cents chacun sur trois). Soixante parcours neufs pour un même coureur — les essais sont
 * illimités, pas l'envie de recourir —, et une lecture de six cents lignes au
 * réveil. Le quiz du jour n'en est plus (le 19 novembre 2026) : tout le monde
 * a joué les mêmes questions le même jour, et les habitués en avaient vu la
 * correction.
 */
export const QUESTIONS_DU_VIVIER = 600

/** Les tenus en échec que le bilan de la fêtée nomme : les plus obstinés. */
const TENUS_MONTRES = 3

/** Le bilan de la journée — vainqueurs, coureurs — se relit au plus toutes les vingt secondes pour l'accueil de chacun. */
const BILAN_GARDE_MS = 20_000

export interface GrandPrixDeps {
  profiles: ProfileStore
  maintenant?: () => number
  /** Le hasard des tirages : `Math.random` en ligne, une suite fixée dans les tests. */
  aleatoire?: () => number
}

/** Un Grand Prix tel que la base le garde. */
export interface GrandPrixRec {
  id: string
  fantome: string
  jour: string
  titre: string
  ruban: CleDeRuban
  mot: string | null
  prix: string | null
  prixFete: string | null
  /** L'avatar du fantôme le jour de sa course, figé au premier passage du jour : le flot le garde pour toujours. */
  apparence: (ApparenceDeLAvatar & { nom: string; avatar: string }) | null
  /** Son terrain, figé à la programmation — ses comptes du jour où le QG l'a choisi. */
  terrain: ThemeDuTerrain[]
  creeLe: number
  modifieLe: number
  retireLe: number | null
}

/** Une question du vivier : telle que le fantôme l'a lue, et ce qu'il y a répondu. */
export interface QuestionDuVivier {
  rang: number
  source: 'jour' | 'campagne'
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  /** Le thème du terrain d'où elle vient : la partie où le fantôme l'a jouée l'avait choisi. */
  theme: string | null
  /** Son identifiant dans la base de la campagne : ce qu'un coureur y a déjà vu passe après. */
  reserveId: string | null
  anecdote: string | null
  duree: number
  fantome: Saut & { mesure: 'reelle' | 'rythme' }
}

interface CourseRec {
  id: string
  grandPrix: string
  profil: string
  obstacles: number[]
  position: number
  servieLe: number | null
  commenceeLe: number
  finieLe: number | null
  points: number
  tempsMs: number
  battu: boolean | null
  essai: boolean
  abandonnee: boolean
}

interface SautRec extends Saut {
  position: number
  rang: number
}

/** Ce que le bilan d'un Grand Prix garde de ses courses finies, hors essais. */
interface LigneDuBilan {
  profil: string
  finieLe: number
  points: number
  tempsMs: number
  battu: boolean
}

/** Le QG, à la programmation : ce qu'il demande. */
export interface DemandeDeGrandPrix {
  id?: unknown
  fantome?: unknown
  jour?: unknown
  titre?: unknown
  ruban?: unknown
  mot?: unknown
  prix?: unknown
  prixFete?: unknown
  /** Les clés des thèmes de son terrain ; absent, ses trois plus joués. */
  terrain?: unknown
}

export { QUESTIONS_POUR_COURIR }

const n = (v: unknown) => Number(v ?? 0)
const nOuNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const texteOuNull = (v: unknown) => (v === null || v === undefined ? null : String(v))

function lireJson<T>(v: unknown, defaut: T): T {
  if (typeof v !== 'string') return defaut
  try {
    return JSON.parse(v) as T
  } catch {
    return defaut
  }
}

function grandPrixDe(r: Row): GrandPrixRec {
  const ruban = String(r.ruban)
  return {
    id: String(r.id),
    fantome: String(r.fantome),
    jour: String(r.jour),
    titre: String(r.titre),
    ruban: estUnRuban(ruban) ? ruban : RUBAN_PAR_DEFAUT,
    mot: texteOuNull(r.mot),
    prix: texteOuNull(r.prix),
    prixFete: texteOuNull(r.prix_fete),
    apparence: lireJson(r.apparence, null),
    terrain: terrainLu(r.terrain),
    creeLe: n(r.cree_le),
    modifieLe: n(r.modifie_le),
    retireLe: nOuNull(r.retire_le),
  }
}

/** Un terrain relu de la base : des thèmes, chacun une fois ; illisible, aucun. */
function terrainLu(v: unknown): ThemeDuTerrain[] {
  const lu = lireJson<unknown>(v, [])
  if (!Array.isArray(lu)) return []
  const vus = new Set<string>()
  return lu.flatMap(x => {
    const t = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
    if (!t || typeof t.cle !== 'string' || vus.has(t.cle)) return []
    vus.add(t.cle)
    return [{ cle: t.cle, nom: typeof t.nom === 'string' ? t.nom : (sujetParCle(t.cle)?.nom ?? t.cle), reponses: n(t.reponses), pourcent: n(t.pourcent) }]
  })
}

function courseDe(r: Row): CourseRec {
  return {
    id: String(r.id),
    grandPrix: String(r.grand_prix_id),
    profil: String(r.profile_id),
    obstacles: lireJson<number[]>(r.obstacles, []),
    position: n(r.position),
    servieLe: nOuNull(r.servie_le),
    commenceeLe: n(r.commencee_le),
    finieLe: nOuNull(r.finie_le),
    points: n(r.points),
    tempsMs: n(r.temps_ms),
    battu: r.battu === null || r.battu === undefined ? null : n(r.battu) === 1,
    essai: n(r.essai) === 1,
    abandonnee: n(r.abandonnee) === 1,
  }
}

function sautDe(r: Row): SautRec {
  return { position: n(r.position), rang: n(r.rang), choix: nOuNull(r.choix), juste: n(r.juste) === 1, ms: nOuNull(r.ms) }
}

/** Une question figée lisible : un QCM de deux à quatre réponses, sa bonne réponse parmi elles. */
function questionLisible(v: unknown): { texte: string; reponses: string[]; bonne: number; categorie: string | null; theme: string | null; reserveId: string | null; anecdote: string | null; duree: number } | null {
  const q = typeof v === 'string' ? lireJson<Record<string, unknown> | null>(v, null) : null
  if (!q || typeof q.texte !== 'string' || !Array.isArray(q.reponses)) return null
  const reponses = q.reponses.filter((x): x is string => typeof x === 'string')
  if (reponses.length !== q.reponses.length || reponses.length < 2 || reponses.length > 4) return null
  const bonne = Number(q.bonne)
  if (!Number.isInteger(bonne) || bonne < 0 || bonne >= reponses.length) return null
  // Les formes d'un jeu (tuiles, frise, détail, rébus) ne sont pas des QCM nus.
  if (q.tuiles || q.frise || q.detail || q.rebus || q.proposee || q.carnet) return null
  const duree = Number(q.duree)
  return {
    texte: q.texte,
    reponses,
    bonne,
    categorie: typeof q.categorie === 'string' ? q.categorie : null,
    theme: typeof q.theme === 'string' ? q.theme : null,
    reserveId: typeof q.reserveId === 'string' ? q.reserveId : null,
    anecdote: typeof q.anecdote === 'string' && q.anecdote.trim() ? q.anecdote : null,
    duree: Number.isFinite(duree) && duree >= 5 && duree <= 120 ? Math.round(duree) : DUREE_D_UN_OBSTACLE_S,
  }
}

export class GrandPrixStore {
  private client: Client
  private readonly maintenant: () => number
  private readonly aleatoire: () => number
  /** Tous les Grands Prix, en mémoire : quelques lignes par an. */
  private grandsPrix = new Map<string, GrandPrixRec>()
  /** Le vivier de chaque Grand Prix, lu une fois : six cents lignes au plus. */
  private viviers = new Map<string, Promise<QuestionDuVivier[]>>()
  /** Ce que chaque coureur a déjà vu du vivier en campagne, par Grand Prix : lu à son premier départ. */
  private vues = new Map<string, Promise<Set<number>>>()
  /** Le bilan de chaque Grand Prix, gardé un instant : l'accueil de chacun le lit. */
  private bilans = new Map<string, { le: number; lignes: Promise<LigneDuBilan[]> }>()
  /** Les fêtées déjà honorées dans ce processus : `ranger` est idempotent, mais chaque accueil ne réécrit pas. */
  private honorees = new Set<string>()
  private verrous = new Map<string, Promise<unknown>>()

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: GrandPrixDeps,
  ) {
    this.client = clientDistant(url, authToken)
    this.maintenant = deps.maintenant ?? Date.now
    this.aleatoire = deps.aleatoire ?? Math.random
  }

  async init(): Promise<void> {
    await this.client.batch(
      [
        // Un Grand Prix : un fantôme, un jour, et ce que le QG en a dit.
        `CREATE TABLE IF NOT EXISTS grand_prix (
           id         TEXT PRIMARY KEY,
           fantome    TEXT NOT NULL,
           jour       TEXT NOT NULL,
           titre      TEXT NOT NULL,
           ruban      TEXT NOT NULL,
           mot        TEXT,
           prix       TEXT,
           prix_fete  TEXT,
           apparence  TEXT,
           terrain    TEXT,
           cree_le    INTEGER NOT NULL,
           modifie_le INTEGER NOT NULL,
           retire_le  INTEGER
         )`,
        'CREATE INDEX IF NOT EXISTS idx_grand_prix_jour ON grand_prix(jour)',
        // Le vivier du fantôme, figé à la programmation : chaque question telle qu'il l'a lue, et sa réponse.
        `CREATE TABLE IF NOT EXISTS grand_prix_questions (
           grand_prix_id TEXT NOT NULL,
           rang          INTEGER NOT NULL,
           source        TEXT NOT NULL,
           question      TEXT NOT NULL,
           choix         INTEGER,
           juste         INTEGER NOT NULL,
           ms            INTEGER,
           mesure        TEXT NOT NULL,
           PRIMARY KEY (grand_prix_id, rang)
         )`,
        // Une course : ses dix obstacles (des rangs du vivier), où elle en est, et ce qu'elle a valu.
        `CREATE TABLE IF NOT EXISTS grand_prix_courses (
           id            TEXT PRIMARY KEY,
           grand_prix_id TEXT NOT NULL,
           profile_id    TEXT NOT NULL,
           obstacles     TEXT NOT NULL,
           position      INTEGER NOT NULL DEFAULT 0,
           servie_le     INTEGER,
           commencee_le  INTEGER NOT NULL,
           finie_le      INTEGER,
           points        INTEGER NOT NULL DEFAULT 0,
           temps_ms      INTEGER NOT NULL DEFAULT 0,
           battu         INTEGER,
           essai         INTEGER NOT NULL DEFAULT 0,
           abandonnee    INTEGER NOT NULL DEFAULT 0
         )`,
        'CREATE INDEX IF NOT EXISTS idx_grand_prix_courses ON grand_prix_courses(grand_prix_id, profile_id)',
        'CREATE INDEX IF NOT EXISTS idx_grand_prix_courses_profil ON grand_prix_courses(profile_id, battu)',
        // Ses sauts, un par obstacle : le journal d'où la course se relit.
        `CREATE TABLE IF NOT EXISTS grand_prix_reponses (
           course_id   TEXT NOT NULL,
           position    INTEGER NOT NULL,
           rang        INTEGER NOT NULL,
           choix       INTEGER,
           juste       INTEGER NOT NULL,
           ms          INTEGER,
           repondue_le INTEGER NOT NULL,
           PRIMARY KEY (course_id, position)
         )`,
      ],
      'write',
    )
    const res = await this.client.execute('SELECT * FROM grand_prix')
    this.grandsPrix = new Map(res.rows.map(r => [String(r.id), grandPrixDe(r)]))
  }

  close(): void {
    this.client.close()
  }

  /** Un profil supprimé : ses courses et ses sauts s'en vont ; un Grand Prix dont il était le fantôme reste, sans lui. */
  async oublierProfil(profileId: string): Promise<void> {
    await this.client.batch(
      [
        { sql: 'DELETE FROM grand_prix_reponses WHERE course_id IN (SELECT id FROM grand_prix_courses WHERE profile_id = ?)', args: [profileId] },
        { sql: 'DELETE FROM grand_prix_courses WHERE profile_id = ?', args: [profileId] },
      ],
      'write',
    )
    this.bilans.clear()
  }

  // ── Le jour ────────────────────────────────────────────────────────────

  private aujourdhui(): string {
    return jourDe(this.maintenant())
  }

  /** Le jour de Paris à l'horloge du serveur — celle du quiz du jour : le QG en juge ce qui a couru, ce qui court, ce qui viendra. */
  jourDuServeur(): string {
    return this.aujourdhui()
  }

  /** Le Grand Prix d'un jour, s'il y en a un qui court. */
  private duJour(jour: string): GrandPrixRec | null {
    for (const g of this.grandsPrix.values()) if (g.jour === jour && g.retireLe === null) return g
    return null
  }

  private async fantomeVu(g: GrandPrixRec): Promise<FantomeVu> {
    if (g.apparence) return { id: g.fantome, nom: g.apparence.nom, avatar: g.apparence.avatar, ...apparenceDeLAvatar(g.apparence) }
    const p = await this.deps.profiles.byId(g.fantome)
    return p ? this.fantomeDe(p) : { id: g.fantome, nom: '?', avatar: '❔' }
  }

  private fantomeDe(p: ProfileRec): FantomeVu {
    return { id: p.id, nom: p.name, avatar: this.deps.profiles.avatarPorte(p), ...apparenceDeLAvatar(this.deps.profiles.apparenceDe(p)) }
  }

  /**
   * Le jour venu, au premier passage : l'avatar du fantôme se fige — le flot
   * le gardera pour toujours, même s'il change d'avatar demain —, et la
   * personne fêtée reçoit son flot d'honneur et sa version de l'avatar en
   * plus. Rangés, idempotents (la clé primaire) ; ce processus ne les réécrit
   * pas à chaque accueil.
   */
  private async ouvrirLeJour(g: GrandPrixRec): Promise<void> {
    if (g.jour > this.aujourdhui()) return
    if (!g.apparence) {
      const p = await this.deps.profiles.byId(g.fantome)
      if (p) {
        const f = this.fantomeDe(p)
        const { id: _, ...apparence } = f
        g.apparence = apparence
        await this.client.execute({ sql: 'UPDATE grand_prix SET apparence = ? WHERE id = ? AND apparence IS NULL', args: [JSON.stringify(apparence), g.id] })
      }
    }
    if (!this.honorees.has(g.id)) {
      this.honorees.add(g.id)
      const cles = [cleDuFlot(g.id, true), ...(g.prixFete ? [cleDuPrix(g.prixFete)] : [])]
      try {
        await this.deps.profiles.ranger(g.fantome, rangementDuGrandPrix(g.id), cles, this.maintenant())
      } catch (e) {
        this.honorees.delete(g.id)
        throw e
      }
    }
  }

  private async grandPrixVu(g: GrandPrixRec): Promise<GrandPrixVu> {
    return { id: g.id, titre: g.titre, jour: g.jour, ruban: g.ruban, fantome: await this.fantomeVu(g), prix: g.prix, terrain: g.terrain }
  }

  // ── Le vivier ──────────────────────────────────────────────────────────

  private vivierDe(id: string): Promise<QuestionDuVivier[]> {
    let v = this.viviers.get(id)
    if (!v) {
      v = this.client
        .execute({ sql: 'SELECT rang, source, question, choix, juste, ms, mesure FROM grand_prix_questions WHERE grand_prix_id = ? ORDER BY rang', args: [id] })
        .then(res =>
          res.rows.flatMap(r => {
            const q = questionLisible(r.question)
            if (!q) return []
            const mesure = String(r.mesure) === 'reelle' ? ('reelle' as const) : ('rythme' as const)
            return [{ rang: n(r.rang), source: String(r.source) === 'jour' ? ('jour' as const) : ('campagne' as const), ...q, fantome: { choix: nOuNull(r.choix), juste: n(r.juste) === 1, ms: nOuNull(r.ms), mesure } }]
          }),
        )
      v.catch(() => this.viviers.delete(id))
      this.viviers.set(id, v)
    }
    return v
  }

  /**
   * Les parties de campagne d'un fantôme qui comptent pour son terrain : celles
   * qu'il a jouées sur un thème choisi, de tous les modes qui en posent — la
   * série, l'épreuve, le parcours, la rencontre, le duel, le défi —, leurs
   * QCM nus : ni joker, ni forme d'un jeu, ni question revue au carnet ; ni le
   * défi de la semaine ni un duel encore ouvert, dont les réponses courent
   * encore ; ni une question retirée.
   */
  private static readonly PARTIES_DU_TERRAIN = `campagne_series s JOIN campagne_reponses r ON r.serie_id = s.id
    WHERE s.profile_id = ? AND s.sujet IS NOT NULL AND s.mode IN ('serie', 'sentier', 'sujet', 'rencontre', 'duel', 'defi')
      AND r.joker IS NULL AND r.forme IS NULL AND r.composee IS NULL
      AND r.choix IS NOT NULL AND r.choix >= 0
      AND ${sqlDansLaBase('r.reserve_id')}
      AND NOT EXISTS (SELECT 1 FROM campagne_retraits x WHERE x.question_id = r.reserve_id)
      AND (s.mode <> 'defi' OR EXISTS (SELECT 1 FROM campagne_defis d WHERE d.semaine = s.semaine AND d.clos_le IS NOT NULL))
      AND (s.mode <> 'duel' OR EXISTS (SELECT 1 FROM campagne_duels d WHERE d.code = s.duel AND d.clos_le IS NOT NULL))`

  /**
   * Ses thèmes, du plus joué au moins joué : les réponses qu'il a données en
   * les choisissant — le temps qu'il y a passé —, et sa part de bonnes. Un
   * thème que le catalogue ne connaît plus ne se propose pas.
   */
  async themesDuFantome(profileId: string): Promise<ThemeDuTerrain[]> {
    const res = await this.client.execute({
      sql: `SELECT s.sujet AS cle, COUNT(*) AS reponses, SUM(r.juste) AS justes FROM ${GrandPrixStore.PARTIES_DU_TERRAIN} GROUP BY s.sujet`,
      args: [profileId],
    })
    return res.rows
      .flatMap(r => {
        const sujet = sujetParCle(r.cle)
        const reponses = n(r.reponses)
        return sujet && reponses > 0 ? [{ cle: sujet.cle, nom: sujet.nom, reponses, pourcent: Math.round((100 * n(r.justes)) / reponses) }] : []
      })
      .sort((a, b) => b.reponses - a.reponses || a.nom.localeCompare(b.nom))
  }

  /**
   * Le vivier d'un fantôme sur son terrain : ses vraies réponses de campagne,
   * dans les parties qu'il a jouées sur ces thèmes — la version jouée, gardée
   * dans sa série —, à parts égales entre eux. Son temps se tire de ses vrais
   * temps du quiz du jour, juste ou faux à part (`tirerUnRythme`) : la
   * campagne n'a pas de chrono. Plus une question du quiz du jour (le
   * 19 novembre 2026) : tout le monde y joue les mêmes, le même jour, et les
   * habitués en avaient vu la correction. Une lecture lourde, faite une fois,
   * à la programmation.
   */
  async lireLeFantome(profileId: string, themes: readonly string[]): Promise<QuestionDuVivier[]> {
    if (themes.length === 0) return []
    const marques = themes.map(() => '?').join(', ')
    const [sesTemps, deCampagne] = await this.client.batch(
      [
        {
          sql: `SELECT ms, juste FROM jour_reponses WHERE profile_id = ? AND choix IS NOT NULL AND choix >= 0 AND ms IS NOT NULL ORDER BY jour DESC LIMIT 1000`,
          args: [profileId],
        },
        {
          sql: `SELECT s.sujet AS theme, r.reserve_id, r.choix, r.juste, json_extract(s.questions, '$[' || r.position || ']') AS vue
                FROM ${GrandPrixStore.PARTIES_DU_TERRAIN} AND s.sujet IN (${marques})
                ORDER BY random()
                LIMIT 3000`,
          args: [profileId, ...themes],
        },
      ],
      'read',
    )
    // Ses vrais temps du jour, juste et faux à part : son rythme s'y tire. Au-delà d'un obstacle, un « trop tard » d'alors.
    const temps = { justes: [] as number[], faux: [] as number[] }
    for (const r of sesTemps.rows) {
      const ms = n(r.ms)
      if (ms > 0 && ms <= DUREE_D_UN_OBSTACLE_S * 1000 + GRACE_MS) (n(r.juste) === 1 ? temps.justes : temps.faux).push(ms)
    }
    const parTheme = Math.ceil(QUESTIONS_DU_VIVIER / themes.length)
    const comptes = new Map<string, number>()
    const vus = new Set<string>()
    const vivier: QuestionDuVivier[] = []
    for (const r of deCampagne.rows) {
      const theme = String(r.theme)
      if ((comptes.get(theme) ?? 0) >= parTheme) continue
      const q = questionLisible(r.vue)
      if (!q) continue
      const cle = q.texte.trim().toLowerCase()
      if (vus.has(cle)) continue
      const choix = n(r.choix)
      if (choix < 0 || choix >= q.reponses.length) continue
      vus.add(cle)
      comptes.set(theme, (comptes.get(theme) ?? 0) + 1)
      const juste = choix === q.bonne
      const ms = Math.min(tirerUnRythme(temps, juste, this.aleatoire), DUREE_D_UN_OBSTACLE_S * 1000)
      vivier.push({
        rang: 0,
        source: 'campagne',
        ...q,
        theme,
        reserveId: texteOuNull(r.reserve_id),
        duree: DUREE_D_UN_OBSTACLE_S,
        fantome: { choix, juste, ms, mesure: 'rythme' },
      })
    }
    return vivier
  }

  // ── Le QG ──────────────────────────────────────────────────────────────

  async apercuDuFantome(profileId: string): Promise<ApercuDuFantome | null> {
    const p = await this.deps.profiles.byId(profileId)
    if (!p) return null
    const themes = await this.themesDuFantome(profileId)
    return { id: p.id, nom: p.name, themes, parDefaut: themes.slice(0, THEMES_DU_TERRAIN).map(t => t.cle) }
  }

  async auQg(): Promise<GrandPrixAuQg[]> {
    const tous = [...this.grandsPrix.values()].filter(g => g.retireLe === null).sort((a, b) => b.jour.localeCompare(a.jour))
    if (tous.length === 0) return []
    const ids = tous.map(g => g.id)
    const marques = ids.map(() => '?').join(', ')
    const [viviers, courses] = await this.client.batch(
      [
        { sql: `SELECT grand_prix_id, source, COUNT(*) AS n FROM grand_prix_questions WHERE grand_prix_id IN (${marques}) GROUP BY grand_prix_id, source`, args: ids },
        {
          sql: `SELECT grand_prix_id, COUNT(DISTINCT profile_id) AS coureurs, COUNT(*) AS departs,
                       COUNT(DISTINCT CASE WHEN battu = 1 THEN profile_id END) AS vainqueurs
                FROM grand_prix_courses c
                WHERE grand_prix_id IN (${marques}) AND essai = 0 AND finie_le IS NOT NULL
                  AND profile_id <> (SELECT fantome FROM grand_prix g WHERE g.id = c.grand_prix_id)
                GROUP BY grand_prix_id`,
          args: ids,
        },
      ],
      'read',
    )
    const profils = await this.deps.profiles.byIds(tous.map(g => g.fantome))
    // Le fantôme tel que les joueurs le verront sur le flot — figé s'il a couru —, l'aperçu du QG le montre.
    const fantomes = await Promise.all(tous.map((g, i) => (profils[i] || g.apparence ? this.fantomeVu(g) : null)))
    return tous.map((g, i) => {
      const v = (source: string) => n(viviers.rows.find(r => String(r.grand_prix_id) === g.id && String(r.source) === source)?.n)
      const c = courses.rows.find(r => String(r.grand_prix_id) === g.id)
      return {
        id: g.id,
        fantome: fantomes[i],
        jour: g.jour,
        titre: g.titre,
        ruban: g.ruban,
        mot: g.mot,
        prix: g.prix,
        prixFete: g.prixFete,
        terrain: g.terrain,
        vivier: { jour: v('jour'), campagne: v('campagne') },
        coureurs: n(c?.coureurs),
        departs: n(c?.departs),
        vainqueurs: n(c?.vainqueurs),
      }
    })
  }

  /**
   * Programme un Grand Prix, ou le reprogramme : le vivier de son fantôme se
   * relit et se fige, d'un lot avec lui. Un jour déjà couru ne se change plus
   * — ses flots sont rangés —, et un jour n'a qu'un Grand Prix.
   */
  async programmer(demande: DemandeDeGrandPrix): Promise<GrandPrixRec> {
    const now = this.maintenant()
    const aujourdhui = jourDe(now)
    const id = typeof demande.id === 'string' && demande.id ? demande.id : null
    const avant = id ? this.grandsPrix.get(id) : undefined
    if (id && (!avant || avant.retireLe !== null)) throw new Error('Ce Grand Prix n’existe plus.')
    if (avant && avant.jour <= aujourdhui) throw new Error('Ce Grand Prix a déjà couru : il ne se change plus.')
    const fantome = typeof demande.fantome === 'string' ? demande.fantome : ''
    const p = fantome ? await this.deps.profiles.byId(fantome) : null
    if (!p) throw new Error('Choisis le joueur dont le fantôme court.')
    if (!jourValide(demande.jour)) throw new Error('Choisis le jour du Grand Prix.')
    const jour = demande.jour
    if (jour < aujourdhui) throw new Error('Ce jour est passé : choisis aujourd’hui ou plus tard.')
    const autre = this.duJour(jour)
    if (autre && autre.id !== id) throw new Error('Un Grand Prix court déjà ce jour-là.')
    const titre = tronquer(typeof demande.titre === 'string' ? demande.titre.replace(/\s+/g, ' ').trim() : '', TITRE_DU_GRAND_PRIX_MAX) || `Le Grand Prix de ${p.name}`
    const ruban = estUnRuban(demande.ruban) ? demande.ruban : RUBAN_PAR_DEFAUT
    const mot = tronquer(typeof demande.mot === 'string' ? demande.mot.replace(/\s+/g, ' ').trim() : '', MOT_DU_GRAND_PRIX_MAX) || null
    const prix = typeof demande.prix === 'string' && demande.prix ? demande.prix : null
    const prixFete = typeof demande.prixFete === 'string' && demande.prixFete ? demande.prixFete : null
    for (const x of [prix, prixFete]) if (x !== null && !PRIX_DES_GRANDS_PRIX.includes(x)) throw new Error('Cet avatar ne se met pas en jeu.')
    // Son terrain : les thèmes que le QG a cochés parmi les siens, sinon ses trois plus joués.
    const sesThemes = await this.themesDuFantome(p.id)
    const demandes = Array.isArray(demande.terrain) ? [...new Set(demande.terrain.filter((x): x is string => typeof x === 'string'))] : null
    if (demandes && demandes.length === 0) throw new Error('Choisis au moins un thème de son terrain.')
    if (demandes && demandes.length > THEMES_DU_TERRAIN) throw new Error(`Son terrain tient en ${THEMES_DU_TERRAIN} thèmes au plus.`)
    const terrain = demandes ? sesThemes.filter(t => demandes.includes(t.cle)) : sesThemes.slice(0, THEMES_DU_TERRAIN)
    if (demandes && terrain.length < demandes.length) throw new Error(`${p.name} n’a pas joué l’un de ces thèmes : choisis parmi les siens.`)
    if (terrain.length === 0) throw new Error(`${p.name} n’a encore joué aucun thème en campagne : il lui faut un terrain pour courir.`)
    const vivier = await this.lireLeFantome(
      p.id,
      terrain.map(t => t.cle),
    )
    if (vivier.length < QUESTIONS_POUR_COURIR) {
      throw new Error(`${p.name} n’a pas assez joué sur ce terrain pour courir : ${vivier.length} questions sur les ${QUESTIONS_POUR_COURIR} qu’il faut. Ajoute un thème.`)
    }
    const g: GrandPrixRec = {
      id: id ?? randomUUID(),
      fantome: p.id,
      jour,
      titre,
      ruban,
      mot,
      prix,
      prixFete,
      apparence: null,
      terrain,
      creeLe: avant?.creeLe ?? now,
      modifieLe: now,
      retireLe: null,
    }
    await this.client.batch(
      [
        {
          sql: `INSERT INTO grand_prix (id, fantome, jour, titre, ruban, mot, prix, prix_fete, apparence, terrain, cree_le, modifie_le, retire_le)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)
                ON CONFLICT(id) DO UPDATE SET fantome = excluded.fantome, jour = excluded.jour, titre = excluded.titre,
                  ruban = excluded.ruban, mot = excluded.mot, prix = excluded.prix, prix_fete = excluded.prix_fete,
                  apparence = NULL, terrain = excluded.terrain, modifie_le = excluded.modifie_le`,
          args: [g.id, g.fantome, g.jour, g.titre, g.ruban, g.mot, g.prix, g.prixFete, JSON.stringify(g.terrain), g.creeLe, g.modifieLe],
        },
        { sql: 'DELETE FROM grand_prix_questions WHERE grand_prix_id = ?', args: [g.id] },
        ...vivier.map((q, rang) => ({
          sql: `INSERT INTO grand_prix_questions (grand_prix_id, rang, source, question, choix, juste, ms, mesure) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            g.id,
            rang,
            q.source,
            JSON.stringify({ texte: q.texte, reponses: q.reponses, bonne: q.bonne, categorie: q.categorie, theme: q.theme, reserveId: q.reserveId, anecdote: q.anecdote, duree: q.duree }),
            q.fantome.choix,
            q.fantome.juste ? 1 : 0,
            q.fantome.ms,
            q.fantome.mesure,
          ],
        })),
      ],
      'write',
    )
    this.grandsPrix.set(g.id, g)
    this.viviers.delete(g.id)
    this.honorees.delete(g.id)
    return g
  }

  /** Retire un Grand Prix pas encore couru : il ne s'ouvrira pas. Un jour couru reste, ses flots avec. */
  async retirer(id: string): Promise<boolean> {
    const g = this.grandsPrix.get(id)
    if (!g || g.retireLe !== null) return false
    if (g.jour <= this.aujourdhui()) throw new Error('Ce Grand Prix a déjà couru : il reste, avec ses flots.')
    const now = this.maintenant()
    await this.client.execute({ sql: 'UPDATE grand_prix SET retire_le = ? WHERE id = ? AND retire_le IS NULL', args: [now, id] })
    g.retireLe = now
    return true
  }

  get(id: string): GrandPrixRec | undefined {
    return this.grandsPrix.get(id)
  }

  // ── Le bilan d'un Grand Prix ───────────────────────────────────────────

  private bilanDe(g: GrandPrixRec): Promise<LigneDuBilan[]> {
    const now = this.maintenant()
    const garde = this.bilans.get(g.id)
    if (garde && now - garde.le < BILAN_GARDE_MS) return garde.lignes
    const lignes = this.client
      .execute({
        sql: `SELECT profile_id, finie_le, points, temps_ms, battu FROM grand_prix_courses
              WHERE grand_prix_id = ? AND essai = 0 AND finie_le IS NOT NULL AND abandonnee = 0 AND profile_id <> ?
              ORDER BY finie_le, id`,
        args: [g.id, g.fantome],
      })
      .then(res => res.rows.map(r => ({ profil: String(r.profile_id), finieLe: n(r.finie_le), points: n(r.points), tempsMs: n(r.temps_ms), battu: n(r.battu) === 1 })))
    lignes.catch(() => this.bilans.delete(g.id))
    this.bilans.set(g.id, { le: now, lignes })
    return lignes
  }

  /** Les vainqueurs, dans l'ordre d'arrivée : le premier à avoir battu le fantôme d'abord. */
  private vainqueursDe(lignes: readonly LigneDuBilan[]): { profil: string; premiere: number; meilleure: LigneDuBilan; departs: number }[] {
    const parProfil = new Map<string, { profil: string; premiere: number; meilleure: LigneDuBilan; departs: number }>()
    const departs = new Map<string, number>()
    for (const l of lignes) departs.set(l.profil, (departs.get(l.profil) ?? 0) + 1)
    for (const l of lignes) {
      if (!l.battu) continue
      const v = parProfil.get(l.profil)
      if (!v) parProfil.set(l.profil, { profil: l.profil, premiere: l.finieLe, meilleure: l, departs: 0 })
      else if (bat(l, v.meilleure)) v.meilleure = l
    }
    return [...parProfil.values()]
      .map(v => ({ ...v, departs: departs.get(v.profil) ?? 0 }))
      .sort((a, b) => a.premiere - b.premiere || a.profil.localeCompare(b.profil))
  }

  // ── L'accueil ──────────────────────────────────────────────────────────

  /** Le Grand Prix du jour sur l'accueil d'un profil, ou null : la plupart des jours. */
  async accueilDe(profileId: string): Promise<GrandPrixDAccueil | null> {
    const g = this.duJour(this.aujourdhui())
    if (!g) return null
    await this.ouvrirLeJour(g)
    const lignes = await this.bilanDe(g)
    const vainqueurs = this.vainqueursDe(lignes)
    const fete = g.fantome === profileId
    return {
      id: g.id,
      titre: g.titre,
      ruban: g.ruban,
      fantome: await this.fantomeVu(g),
      battu: vainqueurs.some(v => v.profil === profileId),
      vainqueurs: vainqueurs.length,
      fete,
      mot: fete ? g.mot : null,
      prixFete: fete ? g.prixFete : null,
      // Son nom, pour la feuille de la fêtée : l'accueil ne télécharge pas le catalogue des légendaires.
      nomDuPrixFete: fete && g.prixFete ? (legendaire(g.prixFete)?.nom ?? null) : null,
      prix: g.prix,
      terrain: g.terrain,
    }
  }

  // ── La course ──────────────────────────────────────────────────────────

  private async courseDuProfil(g: GrandPrixRec, profileId: string, essai: boolean): Promise<{ courses: CourseRec[]; sauts: SautRec[] }> {
    const res = await this.client.execute({
      sql: `SELECT * FROM grand_prix_courses WHERE grand_prix_id = ? AND profile_id = ? AND essai = ? ORDER BY commencee_le, id`,
      args: [g.id, profileId, essai ? 1 : 0],
    })
    const courses = res.rows.map(courseDe)
    const enRoute = courses.find(c => c.finieLe === null)
    const sauts = enRoute
      ? (await this.client.execute({ sql: 'SELECT position, rang, choix, juste, ms FROM grand_prix_reponses WHERE course_id = ? ORDER BY position', args: [enRoute.id] })).rows.map(sautDe)
      : []
    return { courses, sauts }
  }

  /** Le Grand Prix que voit ce profil : celui du jour, ou celui qu'il essaie (l'administrateur, au QG). */
  private grandPrixPour(essai: string | null): GrandPrixRec | null {
    if (essai) {
      const g = this.grandsPrix.get(essai)
      return g && g.retireLe === null ? g : null
    }
    return this.duJour(this.aujourdhui())
  }

  private obstacleVu(c: CourseRec, q: QuestionDuVivier): ObstacleVu {
    return {
      position: c.position,
      texte: q.texte,
      reponses: q.reponses,
      categorie: this.nomAuDessus(q),
      duree: q.duree,
      echeance: (c.servieLe ?? this.maintenant()) + q.duree * 1000,
      fantomeMs: q.fantome.choix === null || q.fantome.ms === null ? null : Math.min(q.fantome.ms, q.duree * 1000),
    }
  }

  /** Ce que l'obstacle dit au-dessus de sa question : son thème — « Disney » —, sinon sa catégorie. */
  private nomAuDessus(q: QuestionDuVivier): string | null {
    return (q.theme && sujetParCle(q.theme)?.nom) || q.categorie
  }

  private sautVu(s: Saut, q: QuestionDuVivier): SautVu {
    return { choix: s.choix, juste: s.juste, ms: s.ms, tempsMs: tempsDuSaut(s, q.duree * 1000), penalite: penaliteDuSaut(s) }
  }

  private revelation(position: number, q: QuestionDuVivier, toi: Saut): RevelationDObstacle {
    return {
      position,
      texte: q.texte,
      reponses: q.reponses,
      bonne: q.bonne,
      anecdote: q.anecdote,
      categorie: this.nomAuDessus(q),
      toi: this.sautVu(toi, q),
      fantome: this.sautVu(q.fantome, q),
    }
  }

  private scores(c: CourseRec, sauts: readonly SautRec[], vivier: ReadonlyMap<number, QuestionDuVivier>): { toi: ScoreDeCourse; fantome: ScoreDeCourse } {
    const faits = sauts.filter(s => s.position < c.position).sort((a, b) => a.position - b.position)
    const avec = (s: Saut, rang: number) => ({ saut: s, dureeMs: (vivier.get(rang)?.duree ?? DUREE_D_UN_OBSTACLE_S) * 1000 })
    return {
      toi: scoreDe(faits.map(s => avec(s, s.rang))),
      fantome: scoreDe(faits.flatMap(s => {
        const q = vivier.get(s.rang)
        return q ? [avec(q.fantome, s.rang)] : []
      })),
    }
  }

  private courseVue(c: CourseRec, sauts: readonly SautRec[], vivier: ReadonlyMap<number, QuestionDuVivier>, fin: FinDeCourse | null): CourseVue {
    const { toi, fantome } = this.scores(c, sauts, vivier)
    const revelations = sauts
      .filter(s => s.position < c.position)
      .sort((a, b) => a.position - b.position)
      .flatMap(s => {
        const q = vivier.get(s.rang)
        return q ? [this.revelation(s.position, q, s)] : []
      })
    const q = c.finieLe === null && c.servieLe !== null ? vivier.get(c.obstacles[c.position]) : undefined
    return {
      id: c.id,
      position: c.position,
      total: c.obstacles.length,
      obstacle: q ? this.obstacleVu(c, q) : null,
      revelations,
      toi,
      fantome,
      finie: c.finieLe !== null,
      fin,
      essai: c.essai,
    }
  }

  /**
   * Un obstacle laissé passer, marge du réseau comprise, se compte refus à la
   * lecture suivante — comme une question du jour (`expirer`) : rien n'a
   * besoin d'un chronomètre, et rien ne se perd au redémarrage.
   */
  private async expirer(g: GrandPrixRec, c: CourseRec, sauts: SautRec[], vivier: ReadonlyMap<number, QuestionDuVivier>): Promise<FinDeCourse | null> {
    if (c.finieLe !== null || c.servieLe === null) return null
    const q = vivier.get(c.obstacles[c.position])
    if (!q) return null
    if (this.maintenant() <= c.servieLe + q.duree * 1000 + GRACE_MS) return null
    return this.enregistrer(g, c, sauts, vivier, { choix: null, juste: false, ms: null })
  }

  /** Écrit un saut, d'un lot avec la course qui avance — ou qui finit, et ce que sa fin fait tomber. */
  private async enregistrer(g: GrandPrixRec, c: CourseRec, sauts: SautRec[], vivier: ReadonlyMap<number, QuestionDuVivier>, saut: Saut): Promise<FinDeCourse | null> {
    const now = this.maintenant()
    const rang = c.obstacles[c.position]
    const nouveau: SautRec = { ...saut, position: c.position, rang }
    const apres: CourseRec = { ...c, position: c.position + 1, servieLe: null }
    const finie = apres.position >= c.obstacles.length
    let fin: FinDeCourse | null = null
    if (finie) {
      const { toi, fantome } = this.scores(apres, [...sauts, nouveau], vivier)
      apres.finieLe = now
      apres.points = toi.points
      apres.tempsMs = toi.tempsMs
      apres.battu = bat(toi, fantome)
    }
    const res = await this.client.batch(
      [
        {
          sql: `INSERT OR IGNORE INTO grand_prix_reponses (course_id, position, rang, choix, juste, ms, repondue_le) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [c.id, nouveau.position, rang, saut.choix, saut.juste ? 1 : 0, saut.ms, now],
        },
        {
          sql: `UPDATE grand_prix_courses SET position = ?, servie_le = NULL, finie_le = ?, points = ?, temps_ms = ?, battu = ?
                WHERE id = ? AND position = ?`,
          args: [apres.position, apres.finieLe, apres.points, apres.tempsMs, apres.battu === null ? null : apres.battu ? 1 : 0, c.id, c.position],
        },
      ],
      'write',
    )
    // Un autre geste est passé avant : rien ne s'est écrit, la lecture suivante dira où elle en est.
    if (res[1].rowsAffected === 0) return null
    Object.assign(c, apres)
    sauts.push(nouveau)
    if (finie) {
      this.bilans.delete(g.id)
      fin = await this.finir(g, c)
    }
    return fin
  }

  /** Ce que la fin d'une course fait tomber : à la première victoire, le flot et l'avatar en plus, rangés sous le Grand Prix. */
  private async finir(g: GrandPrixRec, c: CourseRec): Promise<FinDeCourse> {
    const battu = c.battu === true
    if (!battu || c.essai || c.profil === g.fantome) return { battu, rang: null, flot: false, prix: null }
    const cles = [cleDuFlot(g.id), ...(g.prix ? [cleDuPrix(g.prix)] : [])]
    const neuves = await this.deps.profiles.ranger(c.profil, rangementDuGrandPrix(g.id), cles, this.maintenant())
    const vainqueurs = this.vainqueursDe(await this.bilanDe(g))
    const rang = vainqueurs.findIndex(v => v.profil === c.profil) + 1
    return {
      battu,
      rang: rang > 0 ? rang : null,
      flot: neuves.includes(cleDuFlot(g.id)),
      prix: g.prix && neuves.includes(cleDuPrix(g.prix)) ? g.prix : null,
    }
  }

  /** La page du Grand Prix pour ce profil : le jour, sa course en route, les vainqueurs, et son bilan s'il est le fantôme. */
  etat(profileId: string, essai: string | null = null): Promise<EtatDuGrandPrix> {
    return this.avecVerrou(profileId, async () => {
      const g = this.grandPrixPour(essai)
      const vide: EtatDuGrandPrix = { maintenant: this.maintenant(), grandPrix: null, course: null, departs: 0, meilleure: null, rang: null, vainqueurs: [], coureurs: 0, bilan: null, fete: null }
      if (!g) return vide
      if (!essai) await this.ouvrirLeJour(g)
      const [vivierListe, { courses, sauts }] = await Promise.all([this.vivierDe(g.id), this.courseDuProfil(g, profileId, !!essai)])
      const vivier = new Map(vivierListe.map(q => [q.rang, q]))
      const enRoute = courses.find(c => c.finieLe === null) ?? null
      let fin: FinDeCourse | null = null
      if (enRoute) fin = await this.expirer(g, enRoute, sauts, vivier)
      return this.etatDe(g, profileId, courses, enRoute, sauts, vivier, fin, !!essai)
    })
  }

  private async etatDe(
    g: GrandPrixRec,
    profileId: string,
    courses: readonly CourseRec[],
    enRoute: CourseRec | null,
    sauts: readonly SautRec[],
    vivier: ReadonlyMap<number, QuestionDuVivier>,
    fin: FinDeCourse | null,
    essai: boolean,
  ): Promise<EtatDuGrandPrix> {
    const finies = courses.filter(c => c.finieLe !== null && !c.abandonnee)
    const meilleure = finies.reduce<CourseRec | null>((m, c) => (m === null || bat(c, m) ? c : m), null)
    const lignes = essai ? [] : await this.bilanDe(g)
    const vainqueurs = this.vainqueursDe(lignes)
    const profils = await this.deps.profiles.byIds(vainqueurs.map(v => v.profil))
    const vus: VainqueurVu[] = vainqueurs.flatMap((v, i) => {
      const p = profils[i]
      return p ? [{ id: p.id, nom: p.name, avatar: this.deps.profiles.avatarPorte(p), ...apparenceDeLAvatar(this.deps.profiles.apparenceDe(p)), rang: i + 1, points: v.meilleure.points, tempsMs: v.meilleure.tempsMs, departs: v.departs }] : []
    })
    const estLaFete = !essai && g.fantome === profileId
    const rang = vainqueurs.findIndex(v => v.profil === profileId)
    return {
      maintenant: this.maintenant(),
      grandPrix: await this.grandPrixVu(g),
      course: enRoute ? this.courseVue(enRoute, sauts, vivier, fin) : null,
      departs: finies.length,
      meilleure: meilleure ? { points: meilleure.points, tempsMs: meilleure.tempsMs } : null,
      rang: rang >= 0 ? rang + 1 : null,
      vainqueurs: vus,
      coureurs: new Set(lignes.map(l => l.profil)).size,
      bilan: estLaFete ? await this.bilanDuFantome(g, lignes, vainqueurs.length) : null,
      fete: estLaFete ? { prix: g.prixFete, mot: g.mot } : null,
    }
  }

  private async bilanDuFantome(g: GrandPrixRec, lignes: readonly LigneDuBilan[], vainqueurs: number): Promise<BilanDuFantome> {
    const departs = new Map<string, number>()
    const vainqueursIds = new Set(lignes.filter(l => l.battu).map(l => l.profil))
    for (const l of lignes) departs.set(l.profil, (departs.get(l.profil) ?? 0) + 1)
    const tenusIds = [...departs.entries()]
      .filter(([p]) => !vainqueursIds.has(p))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TENUS_MONTRES)
    const profils = await this.deps.profiles.byIds(tenusIds.map(([p]) => p))
    const tenus = tenusIds.flatMap(([, d], i) => {
      const p = profils[i]
      return p ? [{ id: p.id, nom: p.name, avatar: this.deps.profiles.avatarPorte(p), ...apparenceDeLAvatar(this.deps.profiles.apparenceDe(p)), departs: d }] : []
    })
    // Sa question la plus redoutable : celle où le plus de coureurs ont fait tomber la barre, deux sauts au moins.
    const res = await this.client.execute({
      sql: `SELECT r.rang, COUNT(*) AS sur, SUM(CASE WHEN r.juste = 1 THEN 0 ELSE 1 END) AS tombees
            FROM grand_prix_reponses r JOIN grand_prix_courses c ON c.id = r.course_id
            WHERE c.grand_prix_id = ? AND c.essai = 0 AND c.profile_id <> ?
            GROUP BY r.rang HAVING COUNT(*) >= 2
            ORDER BY tombees DESC, sur DESC, r.rang LIMIT 1`,
      args: [g.id, g.fantome],
    })
    const r = res.rows[0]
    const q = r ? (await this.vivierDe(g.id)).find(x => x.rang === n(r.rang)) : undefined
    return {
      coureurs: departs.size,
      departs: lignes.length,
      vainqueurs,
      tenus,
      redoutable: q && r && n(r.tombees) > 0 ? { texte: q.texte, tombees: n(r.tombees), sur: n(r.sur) } : null,
    }
  }

  /**
   * Prendre le départ : dix obstacles neufs pour ce coureur, et le premier
   * servi tout de suite. Une course en route se reprend, elle ne se double pas.
   */
  depart(profileId: string, essai: string | null = null): Promise<EtatDuGrandPrix> {
    return this.avecVerrou(profileId, async () => {
      const g = this.grandPrixPour(essai)
      if (!g) throw new Error('Pas de Grand Prix aujourd’hui.')
      if (!essai) await this.ouvrirLeJour(g)
      const [vivierListe, { courses, sauts }] = await Promise.all([this.vivierDe(g.id), this.courseDuProfil(g, profileId, !!essai)])
      const vivier = new Map(vivierListe.map(q => [q.rang, q]))
      let enRoute = courses.find(c => c.finieLe === null) ?? null
      if (enRoute) {
        const fin = await this.expirer(g, enRoute, sauts, vivier)
        if (enRoute.finieLe === null) return this.etatDe(g, profileId, courses, enRoute, sauts, vivier, fin, !!essai)
      }
      if (vivierListe.length < OBSTACLES_DU_GRAND_PRIX) throw new Error('Ce Grand Prix n’a pas assez d’obstacles.')
      // Ce qu'il a déjà couru, et dans quel ordre : le parcours neuf les évite, puis les reprend les plus anciennes d'abord.
      const dejaCourues = new Map<number, number>()
      courses.forEach((c, i) => c.obstacles.forEach(r => dejaCourues.set(r, i)))
      // Ce qu'il a déjà vu en campagne passe après : une base qui se tait ne l'empêche pas de courir.
      const dejaVues = await this.dejaVuesPar(g, profileId, vivierListe).catch(() => new Set<number>())
      const obstacles = tirerLeParcours(vivierListe, dejaCourues, this.aleatoire, OBSTACLES_DU_GRAND_PRIX, dejaVues)
      const now = this.maintenant()
      const c: CourseRec = {
        id: randomUUID(),
        grandPrix: g.id,
        profil: profileId,
        obstacles,
        position: 0,
        servieLe: now,
        commenceeLe: now,
        finieLe: null,
        points: 0,
        tempsMs: 0,
        battu: null,
        essai: !!essai,
        abandonnee: false,
      }
      await this.client.execute({
        sql: `INSERT INTO grand_prix_courses (id, grand_prix_id, profile_id, obstacles, position, servie_le, commencee_le, essai)
              VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        args: [c.id, g.id, profileId, JSON.stringify(obstacles), now, now, c.essai ? 1 : 0],
      })
      return this.etatDe(g, profileId, [...courses, c], c, [], vivier, null, !!essai)
    })
  }

  /**
   * Ce que ce coureur a déjà vu du vivier en campagne — une série, un duel sur
   * le même thème contre le fantôme lui-même — : son parcours le prend en
   * dernier. Lu une fois par coureur et par Grand Prix, à son premier départ.
   */
  private dejaVuesPar(g: GrandPrixRec, profileId: string, vivier: readonly QuestionDuVivier[]): Promise<Set<number>> {
    const cle = `${g.id}|${profileId}`
    let v = this.vues.get(cle)
    if (!v) {
      const rangs = new Map<string, number[]>()
      for (const q of vivier) if (q.reserveId) rangs.set(q.reserveId, [...(rangs.get(q.reserveId) ?? []), q.rang])
      v = this.client
        .execute({
          sql: `SELECT DISTINCT r.reserve_id FROM campagne_series s JOIN campagne_reponses r ON r.serie_id = s.id
                WHERE s.profile_id = ? AND r.reserve_id IN (SELECT json_extract(question, '$.reserveId') FROM grand_prix_questions WHERE grand_prix_id = ?)`,
          args: [profileId, g.id],
        })
        .then(res => new Set(res.rows.flatMap(r => rangs.get(String(r.reserve_id)) ?? [])))
      v.catch(() => this.vues.delete(cle))
      this.vues.set(cle, v)
    }
    return v
  }

  private async course(profileId: string, courseId: string): Promise<{ g: GrandPrixRec; c: CourseRec; sauts: SautRec[]; vivier: Map<number, QuestionDuVivier>; courses: CourseRec[] }> {
    const res = await this.client.execute({ sql: 'SELECT * FROM grand_prix_courses WHERE id = ? AND profile_id = ?', args: [courseId, profileId] })
    const ligne = res.rows[0]
    if (!ligne) throw new Error('Cette course est introuvable.')
    const c = courseDe(ligne)
    const g = this.grandsPrix.get(c.grandPrix)
    if (!g) throw new Error('Ce Grand Prix est introuvable.')
    const [vivierListe, toutes] = await Promise.all([this.vivierDe(g.id), this.courseDuProfil(g, profileId, c.essai)])
    const courses = toutes.courses.map(x => (x.id === c.id ? c : x))
    const sauts = c.finieLe === null ? toutes.sauts : []
    return { g, c, sauts, vivier: new Map(vivierListe.map(q => [q.rang, q])), courses }
  }

  /** L'obstacle suivant : servi quand le coureur le demande — son chrono part là, pas pendant qu'il lit la révélation. */
  suivante(profileId: string, courseId: string): Promise<EtatDuGrandPrix> {
    return this.avecVerrou(profileId, async () => {
      const { g, c, sauts, vivier, courses } = await this.course(profileId, courseId)
      let fin = await this.expirer(g, c, sauts, vivier)
      if (c.finieLe === null && c.servieLe === null) {
        const now = this.maintenant()
        const res = await this.client.execute({
          sql: 'UPDATE grand_prix_courses SET servie_le = ? WHERE id = ? AND position = ? AND servie_le IS NULL AND finie_le IS NULL',
          args: [now, c.id, c.position],
        })
        if (res.rowsAffected > 0) c.servieLe = now
        fin = null
      }
      return this.etatDe(g, profileId, courses, c, sauts, vivier, fin, c.essai)
    })
  }

  /**
   * Un saut : la réponse à l'obstacle en cours, mesurée à l'horloge du
   * serveur depuis qu'il s'est montré. Toujours un accusé (invariant 7) :
   * une réponse renvoyée — l'accusé perdu en route — rend la révélation
   * déjà écrite, sans rien réécrire ; une réponse arrivée après la marge est
   * un refus.
   */
  repondre(profileId: string, courseId: string, position: unknown, choix: unknown): Promise<EtatDuGrandPrix & { revelation: RevelationDObstacle; tropTard: boolean }> {
    return this.avecVerrou(profileId, async () => {
      const { g, c, sauts, vivier, courses } = await this.course(profileId, courseId)
      const p = Number(position)
      if (!Number.isInteger(p) || p < 0 || p >= c.obstacles.length) throw new Error('Cet obstacle n’existe pas.')
      // Déjà sauté : la révélation telle qu'elle s'est écrite.
      if (p < c.position) {
        const deja = (await this.client.execute({ sql: 'SELECT position, rang, choix, juste, ms FROM grand_prix_reponses WHERE course_id = ? ORDER BY position', args: [c.id] })).rows.map(sautDe)
        const s = deja.find(x => x.position === p)
        const q = s ? vivier.get(s.rang) : undefined
        if (!s || !q) throw new Error('Cet obstacle est passé.')
        const fin = c.finieLe !== null && p === c.obstacles.length - 1 ? await this.finDejaEcrite(g, c) : null
        const etat = await this.etatDe(g, profileId, courses, c, deja, vivier, fin, c.essai)
        return { ...etat, revelation: this.revelation(p, q, s), tropTard: false }
      }
      if (c.finieLe !== null || p > c.position || c.servieLe === null) throw new Error('Cet obstacle n’est pas encore là.')
      const q = vivier.get(c.obstacles[p])
      if (!q) throw new Error('Cet obstacle est introuvable.')
      const ms = this.maintenant() - c.servieLe
      const k = Number(choix)
      const aTemps = ms <= q.duree * 1000 + GRACE_MS
      const valide = Number.isInteger(k) && k >= 0 && k < q.reponses.length
      if (!valide && aTemps) throw new Error('Choisis une des réponses.')
      const saut: Saut = aTemps ? { choix: k, juste: k === q.bonne, ms } : { choix: null, juste: false, ms: null }
      const fin = await this.enregistrer(g, c, sauts, vivier, saut)
      const ecrit = sauts.find(s => s.position === p) ?? { ...saut, position: p, rang: c.obstacles[p] }
      const etat = await this.etatDe(g, profileId, courses, c, sauts, vivier, fin, c.essai)
      return { ...etat, revelation: this.revelation(p, q, ecrit), tropTard: !aTemps }
    })
  }

  /** La fin d'une course déjà finie, relue pour une réponse renvoyée : ce qu'elle avait fait tomber, sans rien réécrire. */
  private async finDejaEcrite(g: GrandPrixRec, c: CourseRec): Promise<FinDeCourse> {
    const battu = c.battu === true
    if (!battu || c.essai || c.profil === g.fantome) return { battu, rang: null, flot: false, prix: null }
    const vainqueurs = this.vainqueursDe(await this.bilanDe(g))
    const rang = vainqueurs.findIndex(v => v.profil === c.profil) + 1
    return { battu, rang: rang > 0 ? rang : null, flot: false, prix: null }
  }

  /** Quitter une course en route : elle ne compte pas, et un départ neuf l'attend. */
  abandon(profileId: string, courseId: string): Promise<EtatDuGrandPrix> {
    return this.avecVerrou(profileId, async () => {
      const { g, c, sauts, vivier, courses } = await this.course(profileId, courseId)
      if (c.finieLe === null) {
        const now = this.maintenant()
        await this.client.execute({ sql: 'UPDATE grand_prix_courses SET finie_le = ?, abandonnee = 1, servie_le = NULL WHERE id = ? AND finie_le IS NULL', args: [now, c.id] })
        c.finieLe = now
        c.abandonnee = true
      }
      return this.etatDe(g, profileId, courses, null, sauts, vivier, null, c.essai)
    })
  }

  // ── Le carnet ──────────────────────────────────────────────────────────

  /**
   * Ses flots, pour le carnet des fêtes de « Ma collection » (« Tes Grands Prix ») : chaque
   * Grand Prix qu'il a gagné — sa meilleure course, son rang d'arrivée — et
   * celui dont il était le fantôme, le flot d'honneur. Le flot garde l'avatar
   * du fantôme tel qu'il le portait ce jour-là.
   */
  async carnetDe(profileId: string): Promise<FlotDuCarnet[]> {
    const res = await this.client.execute({
      sql: `SELECT c.grand_prix_id, MIN(c.finie_le) AS premiere, MIN(c.points * 10000000 + c.temps_ms) AS meilleure,
                   (SELECT COUNT(DISTINCT x.profile_id) FROM grand_prix_courses x
                     WHERE x.grand_prix_id = c.grand_prix_id AND x.battu = 1 AND x.essai = 0
                       AND x.finie_le <= (SELECT MIN(y.finie_le) FROM grand_prix_courses y
                                          WHERE y.grand_prix_id = c.grand_prix_id AND y.profile_id = c.profile_id AND y.battu = 1 AND y.essai = 0)) AS rang,
                   (SELECT COUNT(DISTINCT z.profile_id) FROM grand_prix_courses z
                     WHERE z.grand_prix_id = c.grand_prix_id AND z.essai = 0 AND z.finie_le IS NOT NULL AND z.abandonnee = 0) AS sur
            FROM grand_prix_courses c
            WHERE c.profile_id = ? AND c.battu = 1 AND c.essai = 0
            GROUP BY c.grand_prix_id`,
      args: [profileId],
    })
    const gagnes = res.rows.flatMap(r => {
      const g = this.grandsPrix.get(String(r.grand_prix_id))
      if (!g || g.fantome === profileId) return []
      const m = n(r.meilleure)
      return [{ g, honneur: false, points: Math.floor(m / 10_000_000), tempsMs: m % 10_000_000, rang: nOuNull(r.rang), sur: n(r.sur) }]
    })
    const fetes = [...this.grandsPrix.values()]
      .filter(g => g.fantome === profileId && g.retireLe === null && g.jour <= this.aujourdhui())
      .map(g => ({ g, honneur: true, points: null, tempsMs: null, rang: null, sur: 0 }))
    const tous = [...fetes, ...gagnes].sort((a, b) => b.g.jour.localeCompare(a.g.jour))
    return Promise.all(tous.map(async ({ g, ...reste }) => ({ grandPrix: await this.grandPrixVu(g), ...reste })))
  }

  private avecVerrou<T>(cle: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.verrous.get(cle) ?? Promise.resolve()
    const suite = avant.then(travail, travail)
    const fin = suite.catch(() => {})
    this.verrous.set(cle, fin)
    void fin.then(() => {
      if (this.verrous.get(cle) === fin) this.verrous.delete(cle)
    })
    return suite
  }
}

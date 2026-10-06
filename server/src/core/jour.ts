// Le quiz du jour, côté serveur : la réserve de questions, le tirage de
// minuit, la partie de chaque profil — chronométrée ici, jamais sur le
// téléphone —, et la nuit qui clôt la journée : son podium, son expérience.
//
// Tout vit dans la base permanente. Un profil commence sur un téléphone et
// reprend sur un autre ; l'hébergeur qui s'endort ou redémarre ne doit rien
// lui faire perdre, et la base locale, jetable (invariant 2), n'en sait rien.
//
// Rien ne tourne la nuit : l'hébergeur gratuit dort. La journée d'hier se
// clôt à la première demande d'aujourd'hui (`clorePasses`), une fois : son
// podium est payé, sa correction s'ouvre à tous.
//
// Les règles pures — le jour de Paris, l'expérience, la médaille, la série —
// sont dans `shared/jour.ts`.

import { randomUUID } from 'node:crypto'
import type { InStatement, ResultSet } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from './distante'
import { lireEtiquetage } from '../../../shared/etiquettes'
import { niveauMesure, type Niveau } from '../../../shared/campagne'
import { HORS_LIGNES_A_PART, cleDuJour, cleDuMois, type ProfileRec, type ProfileStore } from '../auth/profiles'
import { JOURS_DE_CHRONOS, chronosDescend, raconter } from './divins'
import { JOURS_POUR_UNE_PAGE, cleDeLaPage, moisDeLaPage } from '../../../shared/calendrier'
import { GRACE_MS, POINTS_MAX_PAR_QUESTION, pointsDuChoix, tempsDeLecture } from '../games/quiz'
import { lireModeles } from './seed'
import { aEcrirePour, categoriesAPrivilegier, consigneDuJour } from './consigne'
import { normalizeQuestions, toPlayable, type PlayableQuestion, type QuizQuestionDef } from '../../../shared/library'
import { preparerPartie, suiteFixe } from '../../../shared/hasard'
import { classer, rangDansLesTries } from '../../../shared/classement'
import { nomsAffiches, sansAccent } from '../../../shared/homonymes'
import { tronquer } from '../../../shared/avatars'
import {
  AVANT_LE_LEVE_TOT,
  DEPUIS_LE_DERNIER_METRO,
  QUESTIONS_PAR_JOUR,
  cleDuChampion,
  jourAvant,
  jourDe,
  jourValide,
  medailleDe,
  minutesDeParis,
  moisDe,
  serieAvecSabliers,
  seriesParJour,
  xpDeSerie,
  xpDuJour,
  xpDuPodium,
  type CarriereDuJour,
  type ClassementDuJour,
  type JourJoue,
  type LigneDuJour,
  type Medaille as TypeDeMedaille,
  type PartieDuJour,
  type QuestionDuJour,
  type RevelationDuJour,
  type SerieDuJour,
} from '../../../shared/jour'
import { CHANCE_ECLAT_DU_JOUR, niveauDuProfil, type StatsDuJour } from '../../../shared/profil'
import { periodeDu } from '../../../shared/saisons'
import { savoirDesLignes, type Savoir } from '../../../shared/ecussons'
import { SALLE_DU_JOUR, hautFait, palierDe, xpDe } from '../../../shared/hautsfaits'

/** Une question telle que le jour l'a tirée, figée : réponses mélangées, temps de lecture compté. */
interface QuestionTiree {
  reserveId: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  duree: number
  lectureMs: number
  anecdote: string | null
}

interface Tirage {
  jour: string
  questions: QuestionTiree[]
  /** Les questions dont l'administrateur a annulé les points, pour tous. */
  annulees: number[]
}

interface Partie {
  profileId: string
  jour: string
  commenceeLe: number
  /** La question en cours : montrée si `servieLe`, à montrer sinon. */
  question: number
  servieLe: number | null
  points: number
  justes: number
  finieLe: number | null
  xp: number
  /** Son bonus de série (`xpDeSerie`), écrit quand elle commence. */
  xpSerie: number
}

/** Une partie d'un profil, relue pour sa page. */
interface JourLu {
  jour: string
  points: number
  justes: number
  xp: number
  comptees: number
  annulees: number[]
}

/** Une ligne de classement avec ce qu'il faut pour la trier et la nommer. */
/** Ce que la vue d'une partie lit sans dépendre d'elle (`contexteDeVue`). */
interface ContexteDeVue {
  serie: number
  serieTenue: boolean
  sabliers: number
  vainqueursDHier: PartieDuJour['vainqueursDHier']
  sonHier: PartieDuJour['sonHier']
  /** Le classement du jour, quand il y a un tirage. */
  joueurs: Joueur[] | null
}

interface Joueur {
  profil: ProfileRec
  points: number
  enCours: boolean
  commenceeLe: number
}

/**
 * La version des règles du quiz du jour que la relecture a appliquées aux
 * jours passés (`relireLesJours`) : 1 depuis les hauts faits du jour, le
 * calendrier, le champion du mois et Chronos (le 5 octobre 2026). Une
 * règle de plus — un haut fait du jour, un seuil — la fait monter, et tous
 * les jours se relisent au démarrage suivant.
 */
const VERSION_DES_JOURS = 1

/**
 * Un mois ne compte pour le Mois complet que s'il a eu au moins autant de
 * quiz : une réserve à sec un jour ne le ferme pas à tous, mais septembre
 * 2026, ouvert le 26, ne se gagnait pas en cinq jours.
 */
const JOURS_D_UN_MOIS_COMPLET = 28

/** Ce que la nuit décerne (`decernerLaNuit`) : le reste tombe avec la partie, et sa fin l'annonce. */
const CLES_DE_LA_NUIT = new Set(['hf:laurier', 'hf:triomphe', 'hf:phenix-du-jour', 'hf:seul-au-monde', 'hf:lanterne-du-jour', 'hf:eclair-du-jour', 'hf:courant-d-air'])

function estDeLaNuit(cle: string): boolean {
  return CLES_DE_LA_NUIT.has(cle) || /^hf:(champion-du-jour|elite):[123]$/.test(cle)
}

/** Le mois d'avant se raconte les sept premiers jours du mois suivant. */
const JOURS_DU_MOIS_DERNIER = 7

/** Le mois d'avant : « 2026-10 » → « 2026-09 ». */
function moisAvant(mois: string): string {
  const [annee, m] = mois.split('-').map(Number)
  return m === 1 ? `${annee - 1}-12` : `${annee}-${String(m - 1).padStart(2, '0')}`
}

/** « Trouvée par » ne se dit qu'à partir de trois joueurs : à un seul, 100 % ne veut rien dire. */
const TROUVEE_PAR_DES = 3
/** Ce qu'un classement montre ; au-delà, sa propre ligne à part. */
const LIGNES_MONTREES = 50
/** Une question reposée ne revient qu'après ce délai, quand la réserve est à sec. */
const JOURS_AVANT_DE_REPOSER = 30
/** « Voir les prochains jours » : de quoi relire une semaine d'avance. */
const PROCHAINES_MONTREES = 70
/** Un signalement tient en une phrase. */
const SIGNALEMENT_MAX = 280
/**
 * Combien de profils se recomptent en même temps, chacun sous son verrou
 * (`annuler`). Les classements, eux, chargent leurs joueurs d'un coup
 * (`ProfileStore.byIds`).
 */
const PROFILS_EN_VOL = 8
/**
 * Combien d'intitulés la consigne rappelle à l'IA : de quoi éviter les
 * redites de ces dernières semaines sans noyer la consigne. Plus anciennes,
 * l'empreinte écarte encore les copies exactes.
 */
const DEJA_RAPPELEES = 300
/** Les jours qu'une page de profil relit : un mois, de quoi tracer ses courbes. */
const JOURS_RELUS = 30
/**
 * Combien de jours gardent leurs points en mémoire (`pointsGardes`) : les
 * trente derniers de chacun, et de la marge pour ceux qui ont joué plus tôt.
 */
const JOURS_GARDES = 120
/** Combien de tirages restent en mémoire : aujourd'hui, et de quoi revoir la semaine. */
const TIRAGES_GARDES = 8

/** Combien de profils gardent leur jour d'hier en mémoire (`sonsHier`) : ceux du jour, et de la marge. */
const SONS_HIER_GARDES = 2000
const HEURE_MS = 3600_000

/** Pas deux fois la même : l'intitulé, sans casse, sans accents, sans ponctuation. */
export function empreinteDe(texte: string): string {
  return sansAccent(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Ce que le quiz du jour sait jouer, seul, sur un téléphone : une question à
 * choix ordinaire, sans photo ni extrait. Les variantes, les estimations —
 * qui demanderont une tolérance écrite, faute de salle pour juger l'écart —
 * et les photos viendront ; d'ici là, la réserve les écarte en le disant.
 */
export function raisonDEcarter(q: QuizQuestionDef): string | null {
  if (q.image || q.photoAttendue) return 'une photo'
  if (q.son) return 'un extrait'
  if (q.kind === 'number') return 'une estimation'
  if (q.variante) return 'une variante'
  return toPlayable(q) ? null : 'incomplète'
}

/** La graine du jour : le mélange des réponses est le même pour tous, et se rejoue à l'identique. */
function graineDe(jour: string): number {
  let h = 2166136261
  for (const c of jour) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h
}

/**
 * Les questions du jour parmi les neuves, dans l'ordre d'arrivée — deux au
 * plus par catégorie d'abord, pour mêler les catégories, puis le reste.
 */
function choisir<T extends { categorie: string | null }>(neuves: readonly T[], n: number): T[] {
  const parCategorie = new Map<string, number>()
  const choisies: T[] = []
  for (const q of neuves) {
    if (choisies.length >= n) break
    const cle = q.categorie ?? ''
    if ((parCategorie.get(cle) ?? 0) >= 2) continue
    parCategorie.set(cle, (parCategorie.get(cle) ?? 0) + 1)
    choisies.push(q)
  }
  for (const q of neuves) {
    if (choisies.length >= n) break
    if (!choisies.includes(q)) choisies.push(q)
  }
  return choisies
}

export interface JourDeps {
  profiles: ProfileStore
  /** L'heure du serveur : les tests la font passer minuit. */
  maintenant?: () => number
}

/** Personne n'a de laurier : la liste d'avant-hier, avant que la nuit soit close. */
const AUCUN_LAURIER: ReadonlySet<string> = new Set()

/** La difficulté mesurée se relit au plus toutes les dix minutes : elle bouge avec les jours, pas avec les clics. */
const MESURES_GARDEES_MS = 10 * 60_000

/** Les dernières questions posées dont la consigne dit la difficulté mesurée. */
const MESUREES_POUR_LA_CONSIGNE = 60

export class JourStore {
  private client: Client
  private maintenant: () => number
  /**
   * Un profil à la fois : deux touches sur la même réponse ne la paient pas
   * deux fois. Tout ce qui écrit ses points ou son expérience passe sous son
   * verrou — sa partie, le recompte d'une annulation, le podium de la nuit —,
   * et le tirage s'y relit : une annulation arrivée entre-temps y est.
   */
  private verrous = new Map<string, Promise<unknown>>()
  /** Les profils masqués du classement, en mémoire : chaque classement les écarte. */
  private masques = new Set<string>()
  /** Monte à chaque masquage : ce qui a été lu sans un masqué ne vaut plus (`sonsHier`). */
  private versionDesMasques = 0
  /**
   * Son jour d'hier, par profil : clos, il ne bouge plus qu'à une annulation
   * (la révision du jour) ou un masquage. Relu à chaque « Question
   * suivante », il coûtait trois allers-retours en série sous les doigts du
   * joueur, pour la même ligne dix fois.
   */
  private sonsHier = new Map<string, { cle: string; valeur: Promise<PartieDuJour['sonHier']> }>()
  /** Le dernier jour dont on sait qu'il n'y a plus rien à clore avant lui. */
  private closJusqua = ''
  /**
   * Les classements, gardés tant que leur jour n'a pas bougé : chaque
   * téléphone qui finit sa partie le demande. Une révision par jour : une
   * seule pour tous faisait relire hier — clos, immobile — à chaque réponse
   * d'aujourd'hui, deux fois par « Question suivante » (les vainqueurs
   * d'hier, et son hier) : 60 % des lignes lues à l'heure de pointe.
   */
  private revisions = new Map<string, number>()
  private classementsGardes = new Map<string, { revision: number; joueurs: Joueur[] }>()
  /** La lecture d'un classement en route : deux demandes de la même vue n'en lancent qu'une. */
  private classementsEnRoute = new Map<string, { revision: number; promesse: Promise<Joueur[]> }>()
  /**
   * Les points de chaque joueur d'un jour, pour y lire des places — gardés
   * sous la révision du jour lue avant la lecture, comme les classements.
   * L'accueil de chaque profil relisait sinon les points de tous les joueurs
   * de ses trente derniers jours : 6 000 lignes par visite à deux cents
   * joueurs par jour.
   */
  private pointsGardes = new Map<string, { revision: number; points: { id: string; points: number }[] }>()
  /**
   * Les tirages lus : figés à la première demande, ils ne changent plus que
   * par une annulation, qui remet le sien à jour sous son verrou
   * (`annuler`). Relu à chaque geste, le tirage du jour — cinq kilo-octets —
   * repartait de Turso à chaque réponse, à chaque question suivante, et une
   * fois par joueur pour une annulation.
   */
  private tiragesGardes = new Map<string, Tirage>()
  /** Le jour de Paris de l'heure en cours (`joursDeLHeure`). */
  private joursGardes: { heure: number; aujourdhui: string; hier: string } | null = null
  /**
   * Les vainqueurs d'un jour clos, et ce jour : le laurier de ceux d'hier
   * (`laureats`). Relus à la nuit, une fois — ils servent à chaque
   * diffusion à toute la salle.
   */
  private lauriers: { jour: string; ids: ReadonlySet<string> } = { jour: '', ids: AUCUN_LAURIER }
  /** Une relecture des lauriers en route : une rafale de diffusions n'en lance qu'une. */
  private lauriersEnRoute: Promise<void> | null = null
  /**
   * Les champions du mois dernier, et ce mois : sa carte le dit tout le mois
   * suivant, et l'écran commun les salue à leur entrée (`champions`). Relus
   * quand un mois se clôt, une fois — ils servent à chaque diffusion.
   */
  private championsDuMois: { mois: string; ids: ReadonlySet<string> } = { mois: '', ids: AUCUN_LAURIER }
  /** Le mois en cours au dernier passage de la nuit : les mois d'avant sont clos jusque-là (`cloreLesMois`). */
  private moisClosAvant = ''
  private ferme = false
  /**
   * Un laurier est tombé ou s'est posé sur ce profil : la salle des soirées
   * où il joue se rediffuse. Branché par le serveur, qui connaît les salles.
   */
  laurierChange?: (profileId: string) => void
  /**
   * Cette question est-elle dans la base de la campagne (`baseCampagne.ts`) ?
   * Le quiz du jour ne pose pas ce que la campagne a déjà donné, ni l'inverse
   * (`empreintes`) : l'un gâcherait l'autre. Branché après le démarrage —
   * l'amorce des quiz livrés n'en a pas besoin, la base les écarte déjà, et
   * un démarrage ne lit pas la base pour rien.
   */
  dansLaCampagne?: (empreinte: string) => Promise<boolean>
  /** Les intitulés de la réserve, pour la campagne qui les évite : relus au plus toutes les dix minutes, et après chaque apport. */
  private empreintesGardees: { a: number; empreintes: ReadonlySet<string> } | null = null

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: JourDeps,
  ) {
    this.client = clientDistant(url, authToken)
    this.maintenant = deps.maintenant ?? Date.now
  }

  async init() {
    await this.client.batch(
      [
        // La réserve : chaque question une fois, reconnue à son intitulé.
        `CREATE TABLE IF NOT EXISTS jour_reserve (
           id         TEXT PRIMARY KEY,
           question   TEXT NOT NULL,
           empreinte  TEXT NOT NULL UNIQUE,
           categorie  TEXT,
           source     TEXT NOT NULL,
           ajoutee_le INTEGER NOT NULL,
           posee_le   TEXT,
           retiree_le INTEGER
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_reserve_posee ON jour_reserve(posee_le, ajoutee_le)`,
        // Ce que chaque apport a ajouté et écarté : le journal de l'administration.
        `CREATE TABLE IF NOT EXISTS jour_apports (
           id       TEXT PRIMARY KEY,
           quand    INTEGER NOT NULL,
           source   TEXT NOT NULL,
           ajoutees INTEGER NOT NULL,
           ecartees TEXT NOT NULL
         )`,
        // Le tirage d'un jour, figé : la copie jouée, telle quelle, pour tous.
        `CREATE TABLE IF NOT EXISTS jour_tirages (
           jour      TEXT PRIMARY KEY,
           questions TEXT NOT NULL,
           annulees  TEXT NOT NULL DEFAULT '[]',
           tire_le   INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS jour_parties (
           profile_id   TEXT NOT NULL,
           jour         TEXT NOT NULL,
           commencee_le INTEGER NOT NULL,
           question     INTEGER NOT NULL,
           servie_le    INTEGER,
           points       INTEGER NOT NULL DEFAULT 0,
           justes       INTEGER NOT NULL DEFAULT 0,
           finie_le     INTEGER,
           xp           INTEGER NOT NULL DEFAULT 0,
           PRIMARY KEY (profile_id, jour)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_parties_jour ON jour_parties(jour)`,
        `CREATE TABLE IF NOT EXISTS jour_reponses (
           profile_id  TEXT NOT NULL,
           jour        TEXT NOT NULL,
           question    INTEGER NOT NULL,
           choix       INTEGER,
           ms          INTEGER,
           juste       INTEGER NOT NULL,
           points      INTEGER NOT NULL,
           repondue_le INTEGER NOT NULL,
           PRIMARY KEY (profile_id, jour, question)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_reponses_question ON jour_reponses(jour, question)`,
        // La nuit a clos ce jour : son podium est payé, une fois.
        `CREATE TABLE IF NOT EXISTS jour_clotures (
           jour     TEXT PRIMARY KEY,
           joueurs  INTEGER NOT NULL,
           close_le INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS jour_podiums (
           jour       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           rang       INTEGER NOT NULL,
           points     INTEGER NOT NULL,
           xp         INTEGER NOT NULL,
           PRIMARY KEY (jour, profile_id)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_podiums_profil ON jour_podiums(profile_id)`,
        `CREATE TABLE IF NOT EXISTS jour_signalements (
           jour       TEXT NOT NULL,
           question   INTEGER NOT NULL,
           profile_id TEXT NOT NULL,
           texte      TEXT NOT NULL,
           cree_le    INTEGER NOT NULL,
           traite_le  INTEGER,
           PRIMARY KEY (jour, question, profile_id)
         )`,
        `CREATE TABLE IF NOT EXISTS jour_masques (
           profile_id TEXT PRIMARY KEY,
           masque_le  INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS jour_meta (
           cle    TEXT PRIMARY KEY,
           valeur TEXT NOT NULL
         )`,
      ],
      'write',
    )
    // Les métadonnées d'une question — sous-thème, étiquettes, difficulté
    // estimée, public… (`shared/etiquettes.ts`) — sont venues après la
    // réserve : une base d'avant ne les a pas.
    await ajouterColonne(this.client, 'jour_reserve', 'metadonnees', 'TEXT')
    await ajouterColonne(this.client, 'jour_reserve', 'etiquetee_le', 'INTEGER')
    // Le bonus de série d'une partie (`xpDeSerie`), venu le 6 octobre 2026 :
    // écrit quand elle commence, à côté de l'expérience de ses points.
    await ajouterColonne(this.client, 'jour_parties', 'xp_serie', 'INTEGER NOT NULL DEFAULT 0')
    for (const r of (await this.client.execute('SELECT profile_id FROM jour_masques')).rows) this.masques.add(String(r.profile_id))
    await this.amorcer()
  }

  // ── Les métadonnées et la difficulté mesurée ────────────────────────────

  /**
   * Les questions de la réserve qui n'ont pas encore leurs métadonnées, pour
   * la routine qui les décrit (`/api/jour/reserve/etiquetage`) : celles qui
   * sortiront bientôt d'abord, puis les déjà posées.
   */
  async aEtiqueter(n: number): Promise<{ id: string; texte: string; reponses: string[]; bonne: number; anecdote: string | null; categorie: string | null }[]> {
    const res = await this.client.execute({
      sql: `SELECT id, question, categorie FROM jour_reserve WHERE retiree_le IS NULL AND etiquetee_le IS NULL
            ORDER BY posee_le IS NOT NULL, ajoutee_le, id LIMIT ?`,
      args: [n],
    })
    return res.rows.flatMap(r => {
      const q = JSON.parse(String(r.question)) as QuizQuestionDef
      const p = toPlayable({ ...q, id: String(r.id) })
      if (!p || p.kind !== 'choice') return []
      return [{ id: String(r.id), texte: p.text, reponses: p.answers, bonne: p.correct, anecdote: p.anecdote ?? null, categorie: r.categorie == null ? null : String(r.categorie) }]
    })
  }

  /**
   * Range ce que la routine rend : chaque entrée relue par le catalogue
   * (`lireEtiquetage`), refusée en entier sur une clé inconnue, et la
   * question marquée étiquetée — hors de la base comprise (une photo à
   * regarder, des prénoms à remplacer) : on ne la redemande pas.
   */
  async etiqueter(entrees: readonly unknown[]): Promise<{ etiquetees: number; horsBase: number; refusees: { id: string; motif: string }[] }> {
    const ids = entrees.map(e => (e && typeof e === 'object' ? String((e as { id?: unknown }).id ?? '') : ''))
    const connues = new Set(
      ids.length === 0
        ? []
        : (
            await this.client.execute({
              sql: `SELECT id FROM jour_reserve WHERE id IN (${ids.map(() => '?').join(', ')})`,
              args: ids,
            })
          ).rows.map(r => String(r.id)),
    )
    const maintenant = this.maintenant()
    const ecritures: InStatement[] = []
    const refusees: { id: string; motif: string }[] = []
    let etiquetees = 0
    let horsBase = 0
    entrees.forEach((e, i) => {
      const id = ids[i]
      if (!connues.has(id)) return refusees.push({ id, motif: 'question inconnue' })
      const lu = lireEtiquetage(e)
      if ('refus' in lu) return refusees.push({ id, motif: lu.refus })
      const meta = 'horsBase' in lu ? { horsBase: lu.horsBase } : lu.meta
      if ('horsBase' in lu) horsBase++
      else etiquetees++
      ecritures.push({ sql: 'UPDATE jour_reserve SET metadonnees = ?, etiquetee_le = ? WHERE id = ?', args: [JSON.stringify(meta), maintenant, id] })
    })
    if (ecritures.length > 0) await this.client.batch(ecritures, 'write')
    return { etiquetees, horsBase, refusees }
  }

  private mesuresGardees: { a: number; parQuestion: Map<string, { justes: number; total: number }> } | null = null

  /**
   * La part de joueurs qui ont trouvé chaque question posée, par identifiant
   * de la réserve : la difficulté que la consigne ne sait pas deviner. Les
   * réponses se rapportent à leur question par le tirage de leur jour ; une
   * question annulée ne dit rien. Relue au plus toutes les dix minutes.
   */
  async mesures(): Promise<Map<string, { justes: number; total: number }>> {
    if (this.mesuresGardees && this.maintenant() - this.mesuresGardees.a < MESURES_GARDEES_MS) return this.mesuresGardees.parQuestion
    const [tirages, reponses] = await Promise.all([
      this.client.execute('SELECT jour, questions, annulees FROM jour_tirages'),
      this.client.execute('SELECT jour, question, SUM(juste) AS justes, COUNT(*) AS total FROM jour_reponses GROUP BY jour, question'),
    ])
    const idDe = new Map<string, string>()
    for (const t of tirages.rows) {
      let questions: { reserveId?: string }[] = []
      let annulees: number[] = []
      try {
        questions = JSON.parse(String(t.questions))
        annulees = JSON.parse(String(t.annulees ?? '[]'))
      } catch {
        continue
      }
      questions.forEach((q, i) => q.reserveId && !annulees.includes(i) && idDe.set(`${t.jour}#${i}`, q.reserveId))
    }
    const parQuestion = new Map<string, { justes: number; total: number }>()
    for (const r of reponses.rows) {
      const id = idDe.get(`${r.jour}#${r.question}`)
      if (!id) continue
      const avant = parQuestion.get(id) ?? { justes: 0, total: 0 }
      parQuestion.set(id, { justes: avant.justes + Number(r.justes), total: avant.total + Number(r.total) })
    }
    this.mesuresGardees = { a: this.maintenant(), parQuestion }
    return parQuestion
  }

  /** La difficulté mesurée des dernières questions posées, assez jouées pour se mesurer. */
  async difficultesRecentes(): Promise<Record<Niveau, number>> {
    const [mesures, posees] = await Promise.all([
      this.mesures(),
      this.client.execute({
        sql: 'SELECT id FROM jour_reserve WHERE posee_le IS NOT NULL ORDER BY posee_le DESC LIMIT ?',
        args: [MESUREES_POUR_LA_CONSIGNE],
      }),
    ])
    const compte: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
    for (const r of posees.rows) {
      const m = mesures.get(String(r.id))
      const n = m && niveauMesure(m.justes, m.total)
      if (n) compte[n]++
    }
    return compte
  }

  close() {
    this.ferme = true
    this.client.close()
  }

  // ── La réserve ──────────────────────────────────────────────────────────

  /**
   * Au tout premier démarrage, la réserve prend les questions des quiz livrés
   * qui se jouent seuls — culture générale, vrai ou faux… —, jamais ceux à
   * personnaliser (« L'anniversaire de [Prénom] »), ni ceux des animateurs.
   * Tout animateur peut pourtant partir des livrés : leurs questions ne
   * sortent qu'en dernier recours (`tirer`) — les premiers jours d'une
   * réserve neuve, ou quand elle n'a plus rien d'autre à poser. Une fois :
   * une question retirée ne revient pas au démarrage suivant.
   */
  private async amorcer() {
    const deja = await this.client.execute({ sql: 'SELECT valeur FROM jour_meta WHERE cle = ?', args: ['amorcee'] })
    if (deja.rows.length > 0) return
    // Seulement ce qui se joue seul : le journal de l'administration dirait
    // sinon « 32 écartées » de questions que personne n'a proposées.
    const questions = lireModeles()
      .filter(m => !m.personnaliser)
      .flatMap(m => normalizeQuestions(m.questions))
      .filter(q => !raisonDEcarter(q))
    // Le drapeau part dans le lot de l'apport : écrit à part, une panne entre
    // les deux refaisait l'amorce au démarrage suivant, qui consignait un
    // second apport — « 0 ajoutée, 38 écartées » au journal de `/admin`.
    const { ajoutees } = await this.ajouter(questions, 'livre', n => ({
      sql: 'INSERT OR IGNORE INTO jour_meta (cle, valeur) VALUES (?, ?)',
      args: ['amorcee', String(n)],
    }))
    if (ajoutees > 0) console.log(`[jour] réserve amorcée : ${ajoutees} questions des quiz livrés`)
  }

  /**
   * Ajoute des questions à la réserve. Celles que le quiz du jour ne sait pas
   * jouer, et celles qu'elle a déjà, sont écartées — et dites.
   */
  async ajouter(
    questions: readonly QuizQuestionDef[],
    source: 'livre' | 'liste' | 'ia',
    /** Ce qui s'écrit avec l'apport, dans le même lot : le drapeau de l'amorce. */
    avecLui?: (ajoutees: number) => InStatement,
  ): Promise<{ ajoutees: number; ecartees: { texte: string; raison: string }[] }> {
    const ecartees: { texte: string; raison: string }[] = []
    const vues = new Set<string>()
    const candidates: { id: string; question: QuizQuestionDef; empreinte: string }[] = []
    for (const q of questions) {
      const texte = tronquer((q.text ?? '').trim(), 120)
      const raison = raisonDEcarter(q)
      if (raison) {
        ecartees.push({ texte, raison })
        continue
      }
      const empreinte = empreinteDe(q.text)
      if (vues.has(empreinte)) {
        ecartees.push({ texte, raison: 'en double' })
        continue
      }
      vues.add(empreinte)
      if (await this.dansLaCampagne?.(empreinte)) {
        ecartees.push({ texte, raison: 'déjà dans la campagne' })
        continue
      }
      const id = randomUUID()
      candidates.push({ id, question: { ...q, id }, empreinte })
    }
    const connues = new Set<string>()
    for (let i = 0; i < candidates.length; i += 200) {
      const lot = candidates.slice(i, i + 200)
      const res = await this.client.execute({
        sql: `SELECT empreinte FROM jour_reserve WHERE empreinte IN (${lot.map(() => '?').join(', ')})`,
        args: lot.map(c => c.empreinte),
      })
      for (const r of res.rows) connues.add(String(r.empreinte))
    }
    const neuves = candidates.filter(c => {
      if (!connues.has(c.empreinte)) return true
      ecartees.push({ texte: tronquer(c.question.text.trim(), 120), raison: 'déjà dans la réserve' })
      return false
    })
    const quand = this.maintenant()
    await this.client.batch(
      [
        ...neuves.map((c, i) => ({
          sql: `INSERT OR IGNORE INTO jour_reserve (id, question, empreinte, categorie, source, ajoutee_le) VALUES (?, ?, ?, ?, ?, ?)`,
          // Une milliseconde d'écart par question : la réserve garde l'ordre de la liste.
          args: [c.id, JSON.stringify(c.question), c.empreinte, c.question.category ?? null, source, quand + i],
        })),
        {
          sql: 'INSERT INTO jour_apports (id, quand, source, ajoutees, ecartees) VALUES (?, ?, ?, ?, ?)',
          args: [randomUUID(), quand, source, neuves.length, JSON.stringify(ecartees.slice(0, 50))],
        },
        ...(avecLui ? [avecLui(neuves.length)] : []),
      ],
      'write',
    )
    if (neuves.length > 0) this.empreintesGardees = null
    return { ajoutees: neuves.length, ecartees }
  }

  /**
   * Les intitulés de toute la réserve — posés, à venir ou retirés : la
   * campagne n'en pose aucun (`core/campagne.ts`). Une question à venir
   * gâcherait le quiz du jour de demain, une question passée a été vue et
   * corrigée par ceux qui jouent chaque matin.
   */
  async empreintes(): Promise<ReadonlySet<string>> {
    const garde = this.empreintesGardees
    if (garde && this.maintenant() - garde.a < MESURES_GARDEES_MS) return garde.empreintes
    const res = await this.client.execute('SELECT empreinte FROM jour_reserve')
    const empreintes = new Set(res.rows.map(r => String(r.empreinte)))
    this.empreintesGardees = { a: this.maintenant(), empreintes }
    return empreintes
  }

  /** Ce que l'administration montre de la réserve : les jours d'avance, et ce que les derniers apports ont fait. */
  async etatDeLaReserve(): Promise<{
    pretes: number
    joursDAvance: number
    posees: number
    retirees: number
    apports: { quand: number; source: string; ajoutees: number; ecartees: { texte: string; raison: string }[] }[]
  }> {
    const [compte, apports] = await this.client.batch(
      [
        `SELECT
           SUM(CASE WHEN retiree_le IS NULL AND posee_le IS NULL THEN 1 ELSE 0 END) AS pretes,
           SUM(CASE WHEN retiree_le IS NULL AND posee_le IS NOT NULL THEN 1 ELSE 0 END) AS posees,
           SUM(CASE WHEN retiree_le IS NOT NULL THEN 1 ELSE 0 END) AS retirees
         FROM jour_reserve`,
        'SELECT quand, source, ajoutees, ecartees FROM jour_apports ORDER BY quand DESC LIMIT 8',
      ],
      'read',
    )
    const pretes = Number(compte.rows[0]?.pretes ?? 0)
    return {
      pretes,
      joursDAvance: Math.floor(pretes / QUESTIONS_PAR_JOUR),
      posees: Number(compte.rows[0]?.posees ?? 0),
      retirees: Number(compte.rows[0]?.retirees ?? 0),
      apports: apports.rows.map(r => ({
        quand: Number(r.quand),
        source: String(r.source),
        ajoutees: Number(r.ajoutees),
        ecartees: lireListe(r.ecartees),
      })),
    }
  }

  /**
   * La consigne à donner à une IA (`core/consigne.ts`), et combien il reste à
   * écrire pour tenir trois semaines d'avance. Elle rappelle les intitulés
   * déjà là — les prêts d'abord, puis les derniers posés — et les catégories
   * les moins fournies. `n` : combien en demander, sinon ce qu'il manque.
   */
  async consigne(n?: number): Promise<{ joursDAvance: number; aEcrire: number; consigne: string }> {
    const [compte, textes] = await this.client.batch(
      [
        'SELECT categorie, COUNT(*) AS n FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL GROUP BY categorie',
        {
          sql: `SELECT json_extract(question, '$.text') AS texte FROM jour_reserve WHERE retiree_le IS NULL
                ORDER BY posee_le IS NOT NULL, posee_le DESC, ajoutee_le DESC LIMIT ?`,
          args: [DEJA_RAPPELEES],
        },
      ],
      'read',
    )
    const parCategorie: Record<string, number> = {}
    let pretes = 0
    for (const r of compte.rows) {
      parCategorie[r.categorie == null ? '' : String(r.categorie)] = Number(r.n)
      pretes += Number(r.n)
    }
    const joursDAvance = Math.floor(pretes / QUESTIONS_PAR_JOUR)
    const aEcrire = aEcrirePour(joursDAvance)
    // Ce que disent les joueurs : la difficulté qu'une IA ne sait pas juger
    // seule. Une base muette ne prive pas la routine de sa consigne.
    const mesure = await this.difficultesRecentes().catch(() => undefined)
    return {
      joursDAvance,
      aEcrire,
      consigne: consigneDuJour({
        n: n ?? aEcrire,
        aPrivilegier: categoriesAPrivilegier(parCategorie),
        deja: textes.rows.map(r => String(r.texte ?? '')).filter(Boolean),
        mesure,
      }),
    }
  }

  /** Les prochaines questions, dans l'ordre où la réserve les tirera — pour l'administrateur seul. */
  async prochaines(): Promise<{ id: string; question: QuizQuestionDef; source: string }[]> {
    const res = await this.client.execute({
      sql: `SELECT id, question, source FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL
            ORDER BY source = 'livre', ajoutee_le, id LIMIT ?`,
      args: [PROCHAINES_MONTREES],
    })
    return res.rows.map(r => ({ id: String(r.id), question: JSON.parse(String(r.question)), source: String(r.source) }))
  }

  /** Retire une question de la réserve : elle ne sera plus jamais tirée. Le jour qui l'a posée la garde. */
  async retirer(reserveId: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: 'UPDATE jour_reserve SET retiree_le = ? WHERE id = ? AND retiree_le IS NULL',
      args: [this.maintenant(), reserveId],
    })
    return res.rowsAffected > 0
  }

  // ── Le tirage ───────────────────────────────────────────────────────────

  /**
   * Le tirage d'un jour. Celui d'aujourd'hui se tire à la première demande —
   * rien ne tourne à minuit — puis se fige : la même copie pour tous, les
   * réponses dans le même ordre, et une question corrigée ensuite dans la
   * réserve ne change rien à ce jour-là. Un jour passé sans tirage n'en aura
   * jamais : null.
   */
  async tirage(jour: string, tirerSiBesoin = false): Promise<Tirage | null> {
    const lu = await this.tirageLu(jour)
    if (lu || !tirerSiBesoin) return lu
    return this.avecVerrou(`#tirage`, async () => (await this.tirageLu(jour)) ?? this.tirer(jour))
  }

  private async tirageLu(jour: string): Promise<Tirage | null> {
    const garde = this.tiragesGardes.get(jour)
    if (garde) return garde
    const res = await this.client.execute({ sql: 'SELECT questions, annulees FROM jour_tirages WHERE jour = ?', args: [jour] })
    const r = res.rows[0]
    if (!r) return null
    // Une annulation rangée pendant la lecture a le dernier mot : cette
    // lecture-ci est partie avant elle.
    const deja = this.tiragesGardes.get(jour)
    if (deja) return deja
    const tirage = { jour, questions: JSON.parse(String(r.questions)), annulees: lireNombres(r.annulees) }
    this.garderTirage(tirage)
    return tirage
  }

  private garderTirage(tirage: Tirage) {
    this.tiragesGardes.delete(tirage.jour)
    this.tiragesGardes.set(tirage.jour, tirage)
    if (this.tiragesGardes.size > TIRAGES_GARDES) this.tiragesGardes.delete(this.tiragesGardes.keys().next().value!)
  }

  private async tirer(jour: string): Promise<Tirage | null> {
    const lire = (r: Record<string, unknown>) => ({
      id: String(r.id),
      question: String(r.question),
      categorie: r.categorie == null ? null : String(r.categorie),
      livree: r.source === 'livre',
    })
    const neuves = await this.client.execute({
      sql: `SELECT id, question, categorie, source FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL
            ORDER BY source = 'livre', ajoutee_le, id LIMIT 300`,
      args: [],
    })
    const lignes = neuves.rows.map(lire)
    // Les questions des quiz livrés en dernier recours : ces quiz, une soirée
    // peut les jouer, et le profil qui en aurait lu la correction ici y
    // connaîtrait les réponses, pas l'invité anonyme (invariant 8) —
    // l'arbitrage du 27 septembre 2026. Elles ne servent qu'un jour où la
    // réserve n'a plus rien d'autre à poser, pas même ses anciennes.
    let choisies = choisir(lignes.filter(l => !l.livree), QUESTIONS_PAR_JOUR)
    if (choisies.length < QUESTIONS_PAR_JOUR) {
      // À sec : les plus anciennes reviennent, jamais un jour vide — mais pas
      // celles du mois.
      const anciennes = (
        await this.client.execute({
          sql: `SELECT id, question, categorie, source FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NOT NULL AND posee_le < ?
                ORDER BY source = 'livre', posee_le, ajoutee_le, id LIMIT ?`,
          args: [jourAvant(jour, JOURS_AVANT_DE_REPOSER), QUESTIONS_PAR_JOUR - choisies.length],
        })
      ).rows.map(lire)
      choisies = [...choisies, ...anciennes.filter(l => !l.livree)]
      choisies = [...choisies, ...choisir(lignes.filter(l => l.livree), QUESTIONS_PAR_JOUR - choisies.length)]
      choisies = [...choisies, ...anciennes.filter(l => l.livree)].slice(0, QUESTIONS_PAR_JOUR)
      // Personne ne regarde la réserve : le journal le dit. Sans la routine
      // qui la remplit (MISE-EN-LIGNE.md, étape 8), l'amorce tient quatre
      // jours, puis plus rien avant que ses questions redeviennent tirables.
      if (choisies.length < QUESTIONS_PAR_JOUR) {
        console.warn(
          `[jour] réserve à sec : ${choisies.length} question${choisies.length > 1 ? 's' : ''} pour le ${jour} — la routine qui la remplit tourne-t-elle ? (MISE-EN-LIGNE.md, étape 8)`,
        )
      }
    }
    const jouables = choisies
      .map(c => toPlayable({ ...(JSON.parse(c.question) as QuizQuestionDef), id: c.id }))
      .filter((p): p is PlayableQuestion & { kind: 'choice' } => p !== null && p.kind === 'choice')
    if (jouables.length === 0) return null
    const copie = preparerPartie(jouables, { melangerQuestions: true, melangerReponses: true }, suiteFixe(graineDe(jour)))
    const questions: QuestionTiree[] = copie.flatMap(p =>
      p.kind === 'choice'
        ? [
            {
              reserveId: p.id ?? '',
              texte: p.text,
              reponses: p.answers,
              bonne: p.correct,
              categorie: p.category ?? null,
              duree: p.duration,
              lectureMs: tempsDeLecture(p),
              anecdote: p.anecdote ?? null,
            },
          ]
        : [],
    )
    await this.client.batch(
      [
        {
          sql: 'INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, ?, ?)',
          args: [jour, JSON.stringify(questions), '[]', this.maintenant()],
        },
        {
          sql: `UPDATE jour_reserve SET posee_le = ? WHERE id IN (${questions.map(() => '?').join(', ')})`,
          args: [jour, ...questions.map(q => q.reserveId)],
        },
      ],
      'write',
    )
    return this.tirageLu(jour)
  }

  // ── La partie ───────────────────────────────────────────────────────────

  /** La partie du jour de ce profil, telle que son téléphone la montre. */
  async etat(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      // Sa partie et le reste de sa vue, ensemble : la page attendait l'une
      // pour demander l'autre. Une question expirée entre-temps ne change pas
      // les points du classement.
      const [[partie, revelation], contexte] = await Promise.all([
        tirage ? this.aJour(profil.id, tirage) : ([null, undefined] as const),
        this.contexteDeVue(profil, jour, tirage),
      ])
      return this.vueDe(profil, jour, tirage, partie, revelation, contexte)
    })
  }

  /**
   * Sa partie, l'échéance de la question montrée vérifiée d'abord : passée
   * sans réponse, elle compte « sans réponse » et se révèle.
   */
  private async aJour(profileId: string, tirage: Tirage): Promise<[Partie | null, RevelationDuJour | undefined]> {
    const partie = await this.partieDe(profileId, tirage.jour)
    if (!partie) return [null, undefined]
    return (await this.expirer(partie, tirage)) ?? [partie, undefined]
  }

  /** Commence la partie du jour, et montre sa première question. Recommencer rend la partie en cours. */
  async commencer(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      if (!tirage) throw new Error('Pas de quiz aujourd’hui : la réserve de questions est vide')
      // Commencée, relue, et ses jours comptés pour ses paliers, dans le même
      // lot. Sa première question ne se sert qu'après eux (plus bas) : servie
      // ici, son chronomètre courait pendant les paliers et la vue.
      const [res, lue, ...stats] = await this.client.batch(
        [
          {
            sql: `INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le) VALUES (?, ?, ?, 0, NULL)`,
            args: [profil.id, jour, this.maintenant()],
          },
          { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
          ...lecturesDesStats(profil.id),
        ],
        'write',
      )
      if (res.rowsAffected > 0) {
        this.reviser(jour)
        // Son bonus de série d'abord : versé avant ses paliers, il compte
        // déjà dans le niveau que La Légende lit.
        await this.payerLaSerie(profil.id, jour, serieLue(stats.slice(4), jour).serie)
        // Une partie commencée compte — pour la jauge de L'Assidu comme pour
        // celle de la saison : ce qu'elle fait atteindre tombe maintenant.
        // Décerné seulement à la fin de la partie, le troisième jour
        // d'Halloween commencé puis laissé (le téléphone qui sonne, minuit
        // qui passe) affichait « 3 jours sur 3 » sans jamais ouvrir la
        // Citrouille : le lendemain, la saison était finie, pour un an. La
        // fin de la partie les fête toujours : elle lit ce que ce jour a fait
        // tomber (`recompensesDuJour`).
        await this.deps.profiles.accorderPaliersDuJour(profil.id, jour, statsDe(stats, jour))
        await this.accorderSaison(profil.id, jour)
        await this.decernerAuDebut(profil.id, jour, this.maintenant())
      }
      const commencee = lirePartie(profil.id, jour, lue.rows[0])
      // Sa première question, jamais servie — la partie qui commence, ou
      // celle qu'une panne a laissée là — part en dernier : le reste de la
      // vue d'abord, puis servie et relue dans le même lot, comme « Question
      // suivante ».
      if (commencee && commencee.question === 0 && commencee.servieLe === null && commencee.finieLe === null) {
        const contexte = await this.contexteDeVue(profil, jour, tirage)
        const [, servie] = await this.client.batch(
          [
            {
              sql: `UPDATE jour_parties SET servie_le = ? WHERE profile_id = ? AND jour = ? AND servie_le IS NULL AND finie_le IS NULL AND question = 0`,
              args: [this.maintenant(), profil.id, jour],
            },
            { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
          ],
          'write',
        )
        return this.vueDe(profil, jour, tirage, lirePartie(profil.id, jour, servie.rows[0]), undefined, contexte)
      }
      // Déjà commencée — l'autre téléphone, un double toucher : la partie
      // reprend où elle en était, sans rien rejouer.
      const [partie, revelation] = (commencee && (await this.expirer(commencee, tirage))) ?? [commencee, undefined]
      return this.vueDe(profil, jour, tirage, partie, revelation)
    })
  }

  /**
   * Le bonus de série d'une partie qui commence (`xpDeSerie`) : la série du
   * jour — aujourd'hui compris, sabliers comptés —, écrit avec la partie et
   * versé dans sa ligne tout de suite. Une partie commencée compte pour la
   * série, laissée en route aussi : son bonus de même.
   */
  private async payerLaSerie(profileId: string, jour: string, serie: number): Promise<void> {
    const xp = xpDeSerie(serie)
    if (xp <= 0) return
    await this.client.execute({ sql: 'UPDATE jour_parties SET xp_serie = ? WHERE profile_id = ? AND jour = ?', args: [xp, profileId, jour] })
    await this.ecrireXp(profileId, jour, false)
  }

  /**
   * La question suivante. Déjà montrée — un double toucher, un téléphone qui
   * revient —, elle garde son échéance : rien ne se rejoue en rechargeant.
   */
  async suivante(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    // Minuit a pu passer entre deux questions : le jour neuf se tire, et la
    // veille se clôt d'abord, comme au chargement de la page. Sans ça, la
    // partie commencée à 23 h 58 recevait « Pas de quiz aujourd'hui : la
    // réserve est vide », et son « hier » se lisait avant son podium.
    await this.clorePasses(jour)
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour, true)
      if (!tirage) return this.vueDe(profil, jour, null, null)
      const [avant, revelation] = await this.aJour(profil.id, tirage)
      // Une question vient d'expirer : on la révèle d'abord, la suivante attend son geste.
      if (revelation || !avant) return this.vueDe(profil, jour, tirage, avant, revelation)
      // Le reste de la vue d'abord, puis la question servie et relue dans le
      // même lot : son chronomètre part au dernier aller-retour. Il partait
      // avant cinq lectures en série, que le joueur voyait manger son compte
      // à rebours.
      const contexte = await this.contexteDeVue(profil, jour, tirage)
      const [, lue] = await this.client.batch(
        [
          {
            sql: `UPDATE jour_parties SET servie_le = ? WHERE profile_id = ? AND jour = ? AND servie_le IS NULL AND finie_le IS NULL AND question < ?`,
            args: [this.maintenant(), profil.id, jour, tirage.questions.length],
          },
          { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
        ],
        'write',
      )
      return this.vueDe(profil, jour, tirage, lirePartie(profil.id, jour, lue.rows[0]), undefined, contexte)
    })
  }

  /**
   * Sa réponse à la question montrée. Arrivée après l'échéance et la marge du
   * réseau (`GRACE_MS`), elle ne compte pas. Rejouée — le réseau a hoqueté,
   * il a touché deux fois —, elle rend ce qu'elle avait rendu, sans rien
   * payer de plus.
   */
  async repondre(profil: ProfileRec, jour: string, index: number, choix: unknown): Promise<RevelationDuJour> {
    return this.avecVerrou(profil.id, async () => {
      const tirage = jourValide(jour) ? await this.tirage(jour) : null
      if (!tirage) throw new Error('Ce quiz du jour n’existe plus : recharge la page')
      const partie = await this.partieDe(profil.id, jour)
      if (!partie) throw new Error('Commence d’abord le quiz du jour')
      if (!Number.isInteger(index) || index < 0 || index >= tirage.questions.length) throw new Error('Question introuvable')
      if (index < partie.question) return this.revelationDe(profil.id, tirage, index)
      if (index > partie.question || partie.servieLe === null) throw new Error('Cette question n’est pas encore posée')
      const maintenant = this.maintenant()
      // Minuit clôt la journée : une réponse d'hier arriverait après son
      // classement, et après son podium.
      if (jour !== jourDe(maintenant)) throw new Error('Minuit est passé : le quiz d’hier est clos')
      const q = tirage.questions[index]
      const ms = maintenant - partie.servieLe
      const aTemps = ms <= q.duree * 1000 + GRACE_MS
      const retenu = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const { revelation } = await this.enregistrer(partie, tirage, aTemps ? retenu : null, ms)
      return !aTemps && retenu !== null ? { ...revelation, tropTard: true } : revelation
    })
  }

  /**
   * Une question montrée dont l'échéance est passée sans réponse — le
   * téléphone a sonné, l'écran s'est éteint : elle compte « sans réponse »,
   * et la partie avance. Rend la partie et ce qu'elle révèle, ou null.
   */
  private async expirer(partie: Partie, tirage: Tirage): Promise<[Partie, RevelationDuJour] | null> {
    if (partie.servieLe === null || partie.finieLe !== null || partie.question >= tirage.questions.length) return null
    const q = tirage.questions[partie.question]
    const ms = this.maintenant() - partie.servieLe
    if (ms <= q.duree * 1000 + GRACE_MS) return null
    const { revelation, suite } = await this.enregistrer(partie, tirage, null, null)
    return suite ? [suite, revelation] : null
  }

  /**
   * Écrit une réponse — ou son absence — et fait avancer la partie, points et
   * expérience compris. Rend ce que la réponse révèle et la partie d'après,
   * lues dans le même lot que l'écriture : chaque lecture attendait la
   * précédente, six allers-retours en série sous les doigts du joueur.
   */
  private async enregistrer(
    partie: Partie,
    tirage: Tirage,
    choix: number | null,
    ms: number | null,
  ): Promise<{ revelation: RevelationDuJour; suite: Partie | null }> {
    const index = partie.question
    const q = tirage.questions[index]
    const annulee = tirage.annulees.includes(index)
    const juste = choix !== null && choix === q.bonne
    const points = juste && !annulee && ms !== null ? pointsDuChoix(ms, q.duree * 1000, q.lectureMs) : 0
    const total = partie.points + points
    const derniere = index + 1 >= tirage.questions.length
    const maintenant = this.maintenant()
    const res = await this.client.batch(
      [
        {
          sql: `INSERT OR IGNORE INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [partie.profileId, partie.jour, index, choix, ms, juste ? 1 : 0, points, maintenant],
        },
        {
          sql: `UPDATE jour_parties SET question = ?, servie_le = NULL, points = ?, justes = ?, finie_le = ?, xp = ?
                WHERE profile_id = ? AND jour = ? AND question = ?`,
          args: [
            index + 1,
            total,
            partie.justes + (juste && !annulee ? 1 : 0),
            derniere ? maintenant : null,
            xpDuJour(total, possiblesDe(tirage)),
            partie.profileId,
            partie.jour,
            index,
          ],
        },
        ...this.lecturesDeLExperience(partie.profileId),
        ...this.lecturesDeRevelation(partie.profileId, partie.jour, index),
      ],
      'write',
    )
    const [, avance, parties, podiums, ...revelation] = res
    const lu = { revelation: this.revelation(tirage, index, revelation), suite: lirePartie(partie.profileId, partie.jour, revelation[2].rows[0]) }
    if (avance.rowsAffected === 0) return lu
    this.reviser(partie.jour)
    // Ses paliers ne bougent qu'au début de la partie (un jour joué, voir
    // `commencer`) et à sa fin (un sans-faute) : les chercher à chaque
    // réponse coûtait un aller-retour de plus sous les doigts du joueur.
    await this.ecrireXp(partie.profileId, partie.jour, derniere, [parties, podiums])
    if (derniere) {
      await this.decernerALaFin(partie.profileId, partie.jour, maintenant)
      await this.tirerLEclat(partie.profileId, partie.jour)
    }
    return lu
  }

  /**
   * L'Éclat du quiz du jour : une chance sur `CHANCE_ECLAT_DU_JOUR`, tirée
   * ici, quand la partie finit — une seule fois, l'écriture qui la finit ne
   * passe qu'une fois —, donc une fois par jour. Jamais dans
   * `decernerALaFin`, que la relecture des jours rejoue : chaque relecture
   * aurait retiré au sort. Il se range sous le jour, avec ses paliers, et la
   * fin de la partie le relit (`vueDe`).
   */
  private async tirerLEclat(profileId: string, jour: string): Promise<void> {
    try {
      await this.deps.profiles.tirerUnEclat(profileId, cleDuJour(jour), CHANCE_ECLAT_DU_JOUR)
    } catch (e) {
      // La partie est rangée : un Éclat que la base refuse tombe à côté, comme un tirage manqué.
      console.error('[jour] Éclat non rangé :', e)
    }
  }

  /** Ce que la réponse à une question lui apprend. */
  private async revelationDe(profileId: string, tirage: Tirage, index: number): Promise<RevelationDuJour> {
    return this.revelation(tirage, index, await this.client.batch(this.lecturesDeRevelation(profileId, tirage.jour, index), 'read'))
  }

  /** Les lectures d'une révélation : seules, ou au bout du lot qui écrit la réponse. */
  private lecturesDeRevelation(profileId: string, jour: string, index: number): InStatement[] {
    return [
      { sql: 'SELECT choix, juste, points FROM jour_reponses WHERE profile_id = ? AND jour = ? AND question = ?', args: [profileId, jour, index] },
      { sql: 'SELECT COUNT(*) AS n, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses WHERE jour = ? AND question = ?', args: [jour, index] },
      { sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] },
    ]
  }

  private revelation(tirage: Tirage, index: number, [sienne, salle, partie]: ResultSet[]): RevelationDuJour {
    const q = tirage.questions[index]
    const r = sienne.rows[0]
    const n = Number(salle.rows[0]?.n ?? 0)
    const annulee = tirage.annulees.includes(index)
    return {
      jour: tirage.jour,
      index,
      total: tirage.questions.length,
      texte: q.texte,
      reponses: q.reponses,
      bonne: q.bonne,
      choix: r?.choix == null ? null : Number(r.choix),
      juste: Number(r?.juste ?? 0) === 1,
      points: annulee ? 0 : Number(r?.points ?? 0),
      cumul: Number(partie.rows[0]?.points ?? 0),
      anecdote: q.anecdote,
      trouveePar: n >= TROUVEE_PAR_DES ? Number(salle.rows[0]?.justes ?? 0) / n : null,
      ...(annulee && { annulee: true }),
      derniere: index + 1 >= tirage.questions.length,
    }
  }

  private async partieDe(profileId: string, jour: string): Promise<Partie | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] })
    return lirePartie(profileId, jour, res.rows[0])
  }

  /**
   * Ce que la vue lit sans dépendre de la partie — sa série, hier, le
   * classement du jour —, en un seul aller-retour : « Question suivante » le
   * lit avant de servir sa question.
   */
  private async contexteDeVue(profil: ProfileRec, jour: string, tirage: Tirage | null): Promise<ContexteDeVue> {
    const [{ serie, tenue: serieTenue, sabliers }, vainqueursDHier, sonHier, joueurs] = await Promise.all([
      this.serieDe(profil.id, jour),
      this.vainqueursDe(jourAvant(jour)),
      this.sonJourGarde(profil, jourAvant(jour)),
      tirage ? this.joueursDu(jour, profil.id) : null,
    ])
    return { serie, serieTenue, sabliers, vainqueursDHier, sonHier, joueurs }
  }

  /** La partie telle que le téléphone la reçoit : jamais une bonne réponse avant qu'il ait répondu. */
  private async vueDe(
    profil: ProfileRec,
    jour: string,
    tirage: Tirage | null,
    partie: Partie | null,
    revelation?: RevelationDuJour,
    contexte?: ContexteDeVue,
  ): Promise<PartieDuJour> {
    const { serie, serieTenue, sabliers, vainqueursDHier, sonHier, joueurs: lus } = contexte ?? (await this.contexteDeVue(profil, jour, tirage))
    if (!tirage) {
      const moisDernier = await this.moisDernierDe(profil, jour)
      return {
        jour,
        maintenant: this.maintenant(),
        revientDemain: await this.reserveTientDemain(jour),
        total: 0,
        categories: [],
        etat: 'aucun',
        points: 0,
        justes: 0,
        xp: 0,
        medaille: null,
        rang: 0,
        joueurs: 0,
        pointsPossibles: 0,
        comptees: 0,
        serie,
        serieTenue,
        ...(sabliers > 0 && { sabliers }),
        vainqueursDHier,
        sonHier,
        ...(moisDernier && { moisDernier }),
      }
    }
    const total = tirage.questions.length
    const comptees = total - tirage.annulees.length
    const categories = [...new Set(tirage.questions.map(q => q.categorie).filter((c): c is string => !!c))]
    const joueurs = lus ?? (await this.joueursDu(jour, profil.id))
    const nom = nommer(joueurs, p => this.deps.profiles.avatarPorte(p))
    const classes = classer(joueurs, j => j.points, nom, j => j.profil.id)
    const moi = classes.find(c => c.item.profil.id === profil.id)
    const devant = moi && classes.filter(c => c.item.points > moi.item.points).at(-1)
    const etat = !partie ? 'a-jouer' : partie.finieLe !== null ? 'finie' : 'en-cours'
    let vue: PartieDuJour = {
      jour,
      maintenant: this.maintenant(),
      total,
      categories,
      etat,
      points: partie?.points ?? 0,
      justes: partie?.justes ?? 0,
      xp: partie?.xp ?? 0,
      ...(partie && partie.xpSerie > 0 && { xpSerie: partie.xpSerie }),
      medaille: partie?.finieLe ? medailleDe(partie.justes, comptees) : null,
      rang: moi && partie ? moi.rang : 0,
      joueurs: joueurs.length,
      ...(devant && moi && { devant: { nom: nom(devant.item), ecart: devant.item.points - moi.item.points } }),
      pointsPossibles: possiblesDe(tirage),
      comptees,
      serie,
      serieTenue,
      ...(sabliers > 0 && { sabliers }),
      vainqueursDHier,
      sonHier,
    }
    if (partie && etat === 'en-cours') {
      if (partie.servieLe !== null) vue = { ...vue, question: questionVue(tirage, partie.question, partie.servieLe) }
      else if (revelation) vue = { ...vue, revelation }
      else if (partie.question > 0) vue = { ...vue, revelation: await this.revelationDe(profil.id, tirage, partie.question - 1) }
    }
    if (partie && etat === 'finie' && revelation) vue = { ...vue, revelation }
    if (etat === 'finie') {
      // Ce que sa partie a fait tomber : sous ce jour, sauf ce que la nuit
      // décernera (`estDeLaNuit`) ; sous le mois, la page du calendrier que
      // ce jour-ci a ouverte.
      const [duJour, duMois, eclat] = await Promise.all([
        this.deps.profiles.recompensesDuJour(profil.id, jour),
        partie ? this.deps.profiles.rangesSous(profil.id, cleDuMois(moisDe(jour))) : [],
        // L'Éclat que sa partie a fait tomber, relu sous le jour : la page
        // rechargée le redit, comme ses paliers.
        this.deps.profiles.eclatSous(profil.id, cleDuJour(jour)),
      ])
      if (eclat) vue = { ...vue, eclat }
      const tombees = duJour.filter(t => !estDeLaNuit(t.key))
      const paliers = tombees.filter(t => palierDe(t.key))
      if (paliers.length > 0) vue = { ...vue, paliers }
      const hautsFaits = tombees.filter(t => hautFait(t.key)?.famille === 'soiree')
      if (hautsFaits.length > 0) vue = { ...vue, hautsFaits }
      const divins = raconter(tombees.filter(t => t.key.startsWith('dv:')).map(t => t.key))
      if (divins.length > 0) vue = { ...vue, divins }
      const page = duMois.find(t => moisDeLaPage(t.key) && partie && t.at >= partie.commenceeLe)
      if (page) vue = { ...vue, page: moisDeLaPage(page.key)! }
      // Le Sphinx, par ses paliers ; un légendaire de saison, par sa saison ;
      // le Coq au vingtième Lève-tôt ; et ce qu'ouvre la page du calendrier.
      const legendaires = this.deps.profiles.legendairesOuverts(profil.id, [...tombees.map(t => t.key), ...(page ? [page.key] : [])])
      if (legendaires.length > 0) vue = { ...vue, legendaires }
      // La montée de niveau qu'elle a faite, dite comme en fin de soirée : le
      // quiz du jour rapporte l'essentiel de l'expérience d'un assidu, et
      // ouvrait niveaux, finitions et emojis de collection sans un mot.
      if (partie) {
        const frais = await this.deps.profiles.byId(profil.id).catch(() => null)
        if (frais) {
          const gardes = this.deps.profiles.gardesOf(profil.id)
          // Tout ce que la partie a rapporté : ses points, sa série, et ce
          // qu'elle a fait tomber — ses paliers et ses hauts faits paient
          // aussi. Sans eux, le niveau qu'un palier faisait passer se lisait
          // « déjà là » avant la partie, et rien ne l'annonçait.
          const gagne = partie.xp + partie.xpSerie + tombees.reduce((n, t) => n + xpDe(t.key), 0)
          vue = { ...vue, niveauAvant: niveauDuProfil(frais.xp - gagne, gardes), niveauApres: niveauDuProfil(frais.xp, gardes) }
        }
      }
    }
    // Les premiers jours d'un mois, le mois d'avant — pas pendant une
    // question : « Question suivante » ne lit rien de plus.
    if (etat !== 'en-cours') {
      const moisDernier = await this.moisDernierDe(profil, jour)
      if (moisDernier) vue = { ...vue, moisDernier }
    }
    // Pendant une saison, ce qui manque encore à son légendaire.
    const periode = periodeDu(jour)
    if (periode && !this.deps.profiles.legendairesOf(profil.id).includes(periode.saison.legendaire)) {
      vue = {
        ...vue,
        saison: {
          nom: periode.saison.nom,
          legendaire: periode.saison.legendaire,
          joues: await this.joursDeSaison(profil.id, periode),
          requis: periode.saison.jours,
          periode: periode.saison.periode,
        },
      }
    }
    return vue
  }

  /**
   * Pas de quiz aujourd'hui : la réserve en aura-t-elle un demain ? « Il
   * revient demain » ne se promet que si c'est vrai — à sec, le téléphone
   * le répétait chaque jour pendant un mois.
   */
  private async reserveTientDemain(jour: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM jour_reserve WHERE retiree_le IS NULL AND (posee_le IS NULL OR posee_le < ?)',
      args: [jourAvant(jourAvant(jour, -1), JOURS_AVANT_DE_REPOSER)],
    })
    return Number(res.rows[0]?.n ?? 0) > 0
  }

  // ── Le classement ───────────────────────────────────────────────────────

  /**
   * Ceux qui ont joué ce jour-là, profils fermés et masqués écartés — sauf
   * `pour`, qui se voit toujours : un profil masqué n'en est pas averti.
   */
  private async joueursDu(jour: string, pour: string | null, frais = false): Promise<Joueur[]> {
    const tous = await this.classementDe(jour, frais)
    return tous.filter(j => !this.masques.has(j.profil.id) || j.profil.id === pour)
  }

  /**
   * Tous ceux qui ont joué ce jour-là, gardés sous la révision du jour lue
   * AVANT la lecture. Lue après, une réponse écrite pendant qu'on allait
   * chercher un profil chez Turso passait pour vue : la lecture d'avant se
   * rangeait comme fraîche, et la nuit payait le podium — le laurier, le
   * Champion du jour — sur ces points-là, pour de bon. `frais` relit la base
   * quoi qu'il y ait en mémoire : la nuit ne se fie qu'à elle.
   */
  private classementDe(jour: string, frais: boolean): Promise<Joueur[]> {
    const revision = this.revisionDu(jour)
    if (!frais) {
      const garde = this.classementsGardes.get(jour)
      if (garde && garde.revision === revision) return Promise.resolve(garde.joueurs)
      const enRoute = this.classementsEnRoute.get(jour)
      if (enRoute && enRoute.revision === revision) return enRoute.promesse
    }
    const promesse = this.lireClassement(jour).then(joueurs => {
      const garde = this.classementsGardes.get(jour)
      // Une lecture plus récente déjà rangée reste : celle-ci, partie avant
      // elle, a pu croiser une réponse.
      if (!garde || garde.revision <= revision) {
        this.classementsGardes.delete(jour)
        this.classementsGardes.set(jour, { revision, joueurs })
        if (this.classementsGardes.size > 8) this.classementsGardes.delete(this.classementsGardes.keys().next().value!)
      }
      return joueurs
    })
    const enRoute = { revision, promesse }
    this.classementsEnRoute.set(jour, enRoute)
    // Un échec ne reste pas en route : la demande suivante relit la base.
    void promesse
      .finally(() => {
        if (this.classementsEnRoute.get(jour) === enRoute) this.classementsEnRoute.delete(jour)
      })
      .catch(() => {})
    return promesse
  }

  private async lireClassement(jour: string): Promise<Joueur[]> {
    const res = await this.client.execute({ sql: 'SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = ?', args: [jour] })
    const profils = await this.deps.profiles.byIds(res.rows.map(r => String(r.profile_id)))
    const lus: Joueur[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (profil) lus.push({ profil, points: Number(r.points), enCours: r.finie_le == null, commenceeLe: Number(r.commencee_le) })
    })
    return lus
  }

  /** Ce jour a bougé : une partie commencée, une réponse, une annulation — son classement gardé ne vaut plus. */
  private reviser(jour: string) {
    this.revisions.set(jour, this.revisionDu(jour) + 1)
  }

  private revisionDu(jour: string): number {
    return this.revisions.get(jour) ?? 0
  }

  /** Le classement d'un jour : tout le serveur, les règles des soirées — rang partagé, « Camille (2) ». */
  async classementDuJour(jour: string, pour: string | null): Promise<ClassementDuJour> {
    await this.clorePasses(jourDe(this.maintenant()))
    const joueurs = await this.joueursDu(jour, pour)
    const fige = await this.estClos(jour)
    // Un jour clos n'a plus de partie dont les points peuvent monter : celle
    // qu'on a laissée à minuit s'arrête là, comme son podium.
    return { ...this.lignes(fige ? joueurs.map(j => ({ ...j, enCours: false })) : joueurs, jour, pour), fige }
  }

  /** Le classement d'un mois : les points de tous ses jours, additionnés. */
  async classementDuMois(mois: string, pour: string | null): Promise<ClassementDuJour> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, SUM(points) AS points, MIN(commencee_le) AS commencee_le FROM jour_parties
            WHERE jour >= ? AND jour <= ? GROUP BY profile_id`,
      args: [`${mois}-01`, `${mois}-31`],
    })
    const profils = await this.deps.profiles.byIds(res.rows.map(r => String(r.profile_id)))
    const joueurs: Joueur[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (!profil || (this.masques.has(profil.id) && profil.id !== pour)) return
      joueurs.push({ profil, points: Number(r.points), enCours: false, commenceeLe: Number(r.commencee_le) })
    })
    return { ...this.lignes(joueurs, mois, pour), fige: moisDe(jourDe(this.maintenant())) > mois }
  }

  private lignes(joueurs: readonly Joueur[], periode: string, pour: string | null): Omit<ClassementDuJour, 'fige'> {
    const nom = nommer(joueurs, p => this.deps.profiles.avatarPorte(p))
    const classes = classer(joueurs, j => j.points, nom, j => j.profil.id)
    const ligne = ({ item: j, rang }: { item: Joueur; rang: number }): LigneDuJour => {
      const { niveau, finition, eclat, legendaire, laurier } = this.deps.profiles.apparenceDe(j.profil)
      return {
        profileId: j.profil.id,
        nom: nom(j),
        avatar: this.deps.profiles.avatarPorte(j.profil),
        niveau,
        finition,
        ...(legendaire && { legendaire }),
        ...(eclat && { eclat: true as const }),
        ...(laurier && { laurier }),
        points: j.points,
        rang,
        ...(j.enCours && { enCours: true as const }),
      }
    }
    const montrees = classes.slice(0, LIGNES_MONTREES)
    const sienne = pour ? classes.find(c => c.item.profil.id === pour) : undefined
    return {
      periode,
      joueurs: joueurs.length,
      lignes: montrees.map(ligne),
      ...(sienne && !montrees.includes(sienne) && { moi: ligne(sienne) }),
      ...(sienne && { sienne: sienne.item.profil.id }),
    }
  }

  /**
   * Les premiers d'un jour clos : tous les ex æquo en tête gagnent, dans
   * l'ordre d'affichage. Lus parmi les joueurs de ce jour-là : un profil
   * masqué depuis la nuit — le prénom qui n'allait pas — ne s'annonce plus
   * sur tous les accueils, et un homonyme y garde sa marque.
   */
  private async vainqueursDe(jour: string): Promise<{ nom: string; avatar: string }[]> {
    // Les lauriers d'hier sont ses vainqueurs, lus à la nuit : les relire en
    // base coûtait un aller-retour à chaque vue. Les masqués s'écartent au
    // classement, d'un côté comme de l'autre.
    const premiers =
      this.lauriers.jour === jour
        ? this.lauriers.ids
        : new Set(
            (await this.client.execute({ sql: 'SELECT profile_id FROM jour_podiums WHERE jour = ? AND rang = 1', args: [jour] })).rows.map(r =>
              String(r.profile_id),
            ),
          )
    if (premiers.size === 0) return []
    const joueurs = await this.joueursDu(jour, null)
    const nom = nommer(joueurs, p => this.deps.profiles.avatarPorte(p))
    return joueurs
      .filter(j => premiers.has(j.profil.id))
      .map(j => ({ nom: nom(j), avatar: this.deps.profiles.avatarPorte(j.profil) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }

  /** Son jour d'hier, gardé tant que ce jour et les masqués n'ont pas bougé (`sonsHier`). */
  private sonJourGarde(profil: ProfileRec, jour: string): Promise<PartieDuJour['sonHier']> {
    const cle = `${jour}#${this.revisionDu(jour)}#${this.versionDesMasques}`
    const garde = this.sonsHier.get(profil.id)
    if (garde && garde.cle === cle) return garde.valeur
    const valeur = this.sonJour(profil, jour)
    const entree = { cle, valeur }
    this.sonsHier.delete(profil.id)
    this.sonsHier.set(profil.id, entree)
    if (this.sonsHier.size > SONS_HIER_GARDES) this.sonsHier.delete(this.sonsHier.keys().next().value!)
    // Un échec ne reste pas gardé : la vue suivante relit la base.
    valeur.catch(() => {
      if (this.sonsHier.get(profil.id) === entree) this.sonsHier.delete(profil.id)
    })
    return valeur
  }

  /** Son jour d'hier, pour le lendemain : sa place, ses points, ce que le podium lui a payé. */
  private async sonJour(profil: ProfileRec, jour: string): Promise<PartieDuJour['sonHier']> {
    // Ensemble, et pas l'une après l'autre : trois allers-retours en série.
    const [partie, podium, tombes] = await Promise.all([
      this.partieDe(profil.id, jour),
      this.client.execute({ sql: 'SELECT xp FROM jour_podiums WHERE jour = ? AND profile_id = ?', args: [jour, profil.id] }),
      this.deps.profiles.recompensesDuJour(profil.id, jour),
    ])
    if (!partie) return null
    const [tirage, joueurs] = await Promise.all([this.tirageLu(jour), this.joueursDu(jour, profil.id)])
    const classes = classer(joueurs, j => j.points, j => j.profil.name, j => j.profil.id)
    const rang = classes.find(c => c.item.profil.id === profil.id)?.rang ?? 0
    const comptees = tirage ? tirage.questions.length - tirage.annulees.length : 0
    // Ce que la nuit a décerné seulement : le reste tombait avec la partie,
    // et sa fin l'a déjà annoncé.
    const nuit = tombes.filter(p => estDeLaNuit(p.key))
    const paliers = nuit.filter(p => palierDe(p.key))
    const hautsFaits = nuit.filter(p => !palierDe(p.key))
    const legendaires = this.deps.profiles.legendairesOuverts(profil.id, nuit.map(p => p.key))
    return {
      rang,
      joueurs: joueurs.length,
      points: partie.points,
      xpPodium: Number(podium.rows[0]?.xp ?? 0),
      medaille: medailleDe(partie.justes, comptees),
      ...(paliers.length > 0 && { paliers }),
      ...(hautsFaits.length > 0 && { hautsFaits }),
      ...(legendaires.length > 0 && { legendaires }),
    }
  }

  /** Les classements des mois clos, qui ne bougent plus : chaque visite des premiers jours du mois relisait le précédent. */
  private moisGardes = new Map<string, { joueurs: number; places: Map<string, { rang: number; points: number }> }>()

  /**
   * Les sept premiers jours d'un mois, le mois d'avant : sa place au
   * classement du mois, et ce que la clôture du mois lui a décerné. Rien s'il
   * n'y a pas joué, ni au-delà du septième jour.
   */
  private async moisDernierDe(profil: ProfileRec, jour: string): Promise<PartieDuJour['moisDernier']> {
    if (Number(jour.slice(8, 10)) > JOURS_DU_MOIS_DERNIER) return undefined
    const mois = moisAvant(moisDe(jour))
    let garde = this.moisGardes.get(mois)
    if (!garde) {
      const c = await this.classementDuMois(mois, null)
      garde = { joueurs: c.joueurs, places: new Map(c.lignes.map(l => [l.profileId, { rang: l.rang, points: l.points }])) }
      // Un mois se garde une fois clos : avant, il bouge encore.
      if (c.fige) {
        this.moisGardes.set(mois, garde)
        if (this.moisGardes.size > 3) this.moisGardes.delete(this.moisGardes.keys().next().value!)
      }
    }
    let place = garde.places.get(profil.id)
    if (!place) {
      // Hors des lignes montrées, ou masqué : il se voit toujours.
      const c = await this.classementDuMois(mois, profil.id)
      const sienne = c.moi ?? c.lignes.find(l => l.profileId === profil.id)
      if (!sienne) return undefined
      place = { rang: sienne.rang, points: sienne.points }
    }
    const recompenses = (await this.deps.profiles.rangesSous(profil.id, cleDuMois(mois)))
      .filter(r => !moisDeLaPage(r.key))
      .map(({ key, emoji, title }) => ({ key, emoji, title }))
    const legendaires = this.deps.profiles.legendairesOuverts(profil.id, recompenses.map(r => r.key))
    return { mois, rang: place.rang, joueurs: garde.joueurs, points: place.points, recompenses, ...(legendaires.length > 0 && { legendaires }) }
  }

  // ── Sa carrière au quiz du jour ─────────────────────────────────────────

  /**
   * Ce que ses paliers du quiz du jour comptent : ses jours joués — une
   * partie commencée compte, comme pour la série —, ses victoires, et ses
   * jours sans une faute (la médaille d'or, sur les questions qui comptent
   * encore).
   */
  async statsDuJour(profileId: string): Promise<StatsDuJour> {
    return statsDe(await this.client.batch(lecturesDesStats(profileId), 'read'), jourDe(this.maintenant()))
  }

  /**
   * Ce que le quiz du jour sait de lui (`Savoir`) : ses questions et ses
   * bonnes réponses, catégorie par catégorie — ses écussons de savoir, avec
   * les soirées et la campagne —, et la base de sa précision, ses QCM
   * répondus. Une question annulée pour tous ne compte pas — ni pour lui,
   * ni contre lui.
   */
  async savoirDe(profileId: string): Promise<Savoir> {
    // La catégorie se lit dans la sous-requête, que `LIMIT -1` garde à part :
    // aplatie dans le regroupement, SQLite recopiait dans son tri le JSON du
    // tirage pour chacune de ses réponses (`CampagneStore.savoirDe`).
    const res = await this.client.execute({
      sql: `SELECT categorie, COUNT(*) AS questions, COUNT(choix) AS repondues, SUM(juste) AS justes
            FROM (SELECT json_extract(t.questions, '$[' || r.question || '].categorie') AS categorie, r.choix AS choix, r.juste AS juste
                  FROM jour_reponses r JOIN jour_tirages t ON t.jour = r.jour
                  WHERE r.profile_id = ?
                    AND NOT EXISTS (SELECT 1 FROM json_each(t.annulees) a WHERE a.value = r.question)
                  LIMIT -1)
            GROUP BY categorie`,
      args: [profileId],
    })
    return savoirDesLignes(res.rows)
  }

  /**
   * Toutes ses bonnes réponses au quiz du jour, parties en cours comprises :
   * ses confettis du quiz du jour (`shared/themes.ts`). Une question annulée
   * pour tous est déjà retirée de chaque partie (`recompter`).
   */
  async justesDe(profileId: string): Promise<number> {
    const res = await this.client.execute({
      sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM jour_parties WHERE profile_id = ?',
      args: [profileId],
    })
    return Number(res.rows[0]?.n ?? 0)
  }

  /** Le jour qu'il est à Paris, à l'horloge du quiz du jour — que les tests font passer minuit. */
  aujourdhui(): string {
    return jourDe(this.maintenant())
  }

  /** Masqué du classement par l'administrateur : les autres ne le voient plus, ni sa carte. */
  estMasque(profileId: string): boolean {
    return this.masques.has(profileId)
  }

  /** Ce que la carte d'un joueur dit de son quiz du jour : les jours joués, les victoires. */
  async resumeDe(profileId: string): Promise<{ joues: number; victoires: number }> {
    const [joues, victoires] = await this.client.batch(
      [
        { sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT COUNT(*) AS n FROM jour_podiums WHERE profile_id = ? AND rang = 1', args: [profileId] },
      ],
      'read',
    )
    return { joues: Number(joues.rows[0]?.n ?? 0), victoires: Number(victoires.rows[0]?.n ?? 0) }
  }

  /**
   * Ce que la fin d'une soirée lui dit du quiz du jour : sa série — que la
   * soirée vient d'allonger — et s'il a déjà joué celui d'aujourd'hui. La
   * soirée n'y renvoyait jamais : un profil créé ce soir-là ne découvrait le
   * quiz qu'en touchant « Mon profil ».
   */
  async pontDuJour(profileId: string): Promise<{ serie: number; aJoue: boolean }> {
    const jour = jourDe(this.maintenant())
    const [{ serie }, partie] = await Promise.all([
      this.serieDe(profileId, jour),
      this.client.execute({ sql: 'SELECT 1 FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] }),
    ])
    return { serie, aJoue: partie.rows.length > 0 }
  }

  /**
   * Ce que le rappel du soir doit savoir d'un profil (`core/rappels.ts`) :
   * combien de questions lui restent aujourd'hui — toutes s'il n'a pas
   * commencé, aucune s'il a fini, aucune non plus s'il n'y a pas de quiz —,
   * et sa série, que la soirée d'aujourd'hui a peut-être déjà tenue. Une
   * question montrée dont l'heure est passée est perdue : la partie laissée
   * sur sa dernière question est finie, même si personne n'est revenu le
   * constater (`expirer`).
   */
  async pourLeRappel(profileId: string): Promise<{ total: number; reste: number; serie: number; serieTenue: boolean }> {
    const jour = jourDe(this.maintenant())
    const tirage = await this.tirage(jour, true)
    if (!tirage) return { total: 0, reste: 0, serie: 0, serieTenue: false }
    const [partie, { serie, tenue }] = await Promise.all([this.partieDe(profileId, jour), this.serieDe(profileId, jour)])
    const total = tirage.questions.length
    let reste = total
    if (partie?.finieLe != null) reste = 0
    else if (partie) {
      reste -= partie.question
      const montree = tirage.questions[partie.question]
      if (partie.servieLe !== null && montree && this.maintenant() - partie.servieLe > montree.duree * 1000 + GRACE_MS) reste--
    }
    return { total, reste: Math.max(0, reste), serie, serieTenue: tenue }
  }

  /**
   * Le quiz du jour d'un profil, pour sa page (`CarriereDuJour`) : ses
   * médailles, sa série et son record, ses podiums, et ses trente derniers
   * jours. La nuit d'avant se clôt d'abord : son podium se compte.
   */
  async carriereDe(profileId: string): Promise<CarriereDuJour> {
    const aujourdhui = jourDe(this.maintenant())
    await this.clorePasses(aujourdhui)
    const [parties, podiums, soirees, sabliers] = await this.client.batch(
      [
        {
          sql: `SELECT p.jour, p.points, p.justes, p.xp + p.xp_serie AS xp, t.annulees,
                       json_array_length(t.questions) - json_array_length(t.annulees) AS comptees
                FROM jour_parties p LEFT JOIN jour_tirages t ON t.jour = p.jour
                WHERE p.profile_id = ? ORDER BY p.jour DESC`,
          args: [profileId],
        },
        { sql: 'SELECT jour, rang, xp FROM jour_podiums WHERE profile_id = ?', args: [profileId] },
        { sql: `SELECT created_at FROM profile_xp WHERE profile_id = ? AND ${HORS_LIGNES_A_PART}`, args: [profileId] },
        { sql: 'SELECT created_at FROM profile_sabliers WHERE profile_id = ?', args: [profileId] },
      ],
      'read',
    )
    const lues: JourLu[] = parties.rows.map(r => ({
      jour: String(r.jour),
      points: Number(r.points),
      justes: Number(r.justes),
      xp: Number(r.xp),
      comptees: Number(r.comptees ?? 0),
      annulees: lireNombres(r.annulees),
    }))
    const medailles: Record<TypeDeMedaille, number> = { or: 0, argent: 0, bronze: 0 }
    for (const p of lues) {
      const m = medailleDe(p.justes, p.comptees)
      if (m) medailles[m]++
    }
    const joues = new Set([...lues.map(p => p.jour), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
    const serie = serieAvecSabliers(
      joues,
      sabliers.rows.map(r => jourDe(Number(r.created_at))),
      aujourdhui,
    )
    const podiumDe = new Map(podiums.rows.map(r => [String(r.jour), Number(r.xp)]))
    return {
      joues: lues.length,
      serie: serie.serie,
      record: serie.record,
      sabliers: serie.sabliers,
      medailles,
      meilleurScore: lues.reduce((m, p) => Math.max(m, p.points), 0),
      podiums: podiums.rows.length,
      victoires: podiums.rows.filter(r => Number(r.rang) === 1).length,
      jours: await this.joursJoues(profileId, lues.slice(0, JOURS_RELUS), podiumDe),
    }
  }

  /**
   * Ses derniers jours, chacun avec sa place telle que le classement de ce
   * jour-là la donnait : rang partagé (`rangDansLesTries`), sans les profils
   * fermés ni les masqués — sauf lui, qui se voit toujours.
   */
  private async joursJoues(profileId: string, recents: readonly JourLu[], podiumDe: ReadonlyMap<string, number>): Promise<JourJoue[]> {
    if (recents.length === 0) return []
    const jours = recents.map(p => p.jour)
    const marques = jours.map(() => '?').join(', ')
    // La révision de chaque jour, lue avant la lecture : une réponse écrite
    // pendant l'aller-retour ne passe pas pour vue.
    const revisions = new Map(jours.map(j => [j, this.revisionDu(j)]))
    const manquants = jours.filter(j => this.pointsGardes.get(j)?.revision !== revisions.get(j))
    const lectures = await this.client.batch(
      [
        {
          sql: `SELECT jour, question, ms FROM jour_reponses WHERE profile_id = ? AND juste = 1 AND jour IN (${marques})`,
          args: [profileId, ...jours],
        },
        ...(manquants.length > 0
          ? [
              {
                sql: `SELECT jour, profile_id, points FROM jour_parties WHERE jour IN (${manquants.map(() => '?').join(', ')})
                      AND profile_id IN (SELECT id FROM profiles WHERE disabled_at IS NULL)`,
                args: manquants,
              },
            ]
          : []),
      ],
      'read',
    )
    const [reponses, salle] = lectures
    if (salle) {
      const lus = new Map<string, { id: string; points: number }[]>(manquants.map(j => [j, []]))
      for (const r of salle.rows) lus.get(String(r.jour))?.push({ id: String(r.profile_id), points: Number(r.points) })
      for (const [jour, points] of lus) {
        const garde = this.pointsGardes.get(jour)
        if (garde && garde.revision > revisions.get(jour)!) continue
        this.pointsGardes.delete(jour)
        this.pointsGardes.set(jour, { revision: revisions.get(jour)!, points })
      }
      while (this.pointsGardes.size > JOURS_GARDES) this.pointsGardes.delete(this.pointsGardes.keys().next().value!)
    }
    // Les masqués s'écartent à la lecture — sauf lui, qui se voit toujours :
    // un masque posé ou levé vaut tout de suite, sans relire la base.
    const pointsDu = new Map<string, number[]>()
    for (const jour of jours) {
      const garde = this.pointsGardes.get(jour)
      if (garde) pointsDu.set(jour, garde.points.filter(e => e.id === profileId || !this.masques.has(e.id)).map(e => e.points))
    }
    const annuleesDu = new Map(recents.map(p => [p.jour, p.annulees]))
    const tempsDu = new Map<string, number>()
    for (const r of reponses.rows) {
      const jour = String(r.jour)
      // Une question annulée ne compte plus : ni sa bonne réponse, ni son temps.
      if (annuleesDu.get(jour)?.includes(Number(r.question))) continue
      tempsDu.set(jour, (tempsDu.get(jour) ?? 0) + Number(r.ms ?? 0))
    }
    return recents.map(p => {
      const tries = (pointsDu.get(p.jour) ?? [p.points]).sort((a, b) => b - a)
      return {
        jour: p.jour,
        points: p.points,
        rang: rangDansLesTries(p.points, tries),
        joueurs: tries.length,
        xp: p.xp + (podiumDe.get(p.jour) ?? 0),
        medaille: medailleDe(p.justes, p.comptees),
        comptees: p.comptees,
        justes: p.justes,
        tempsJustesMs: tempsDu.get(p.jour) ?? 0,
      }
    })
  }

  // ── La série ────────────────────────────────────────────────────────────

  /**
   * Ses jours d'affilée joués — au quiz du jour ou en soirée —, si aujourd'hui
   * y compte déjà, et les sabliers qui l'attendent. Relue sur 400 jours : la
   * série d'avant n'a pas besoin de plus — l'Ouroboros en demande cent —, et
   * la plus longue de sa vie se lit dans ses paliers (`statsDuJour`).
   */
  private async serieDe(profileId: string, aujourdhui: string): Promise<SerieDuJour> {
    return serieLue(await this.client.batch(lecturesDeLaSerie(profileId, jourAvant(aujourdhui, 400)), 'read'), aujourdhui)
  }

  /** Ses jours joués ce mois-ci (une partie commencée compte) : ce qui manque à sa page du calendrier. */
  async joursDuMois(profileId: string): Promise<number> {
    const mois = moisDe(jourDe(this.maintenant()))
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour >= ? AND jour <= ?',
      args: [profileId, `${mois}-01`, `${mois}-31`],
    })
    return Number(res.rows[0]?.n ?? 0)
  }

  /** Les sabliers qui l'attendent : ceux qu'il a achetés, moins ceux qu'un jour manqué a pris. */
  async sabliersDe(profileId: string): Promise<number> {
    return (await this.serieDe(profileId, jourDe(this.maintenant()))).sabliers
  }

  // ── La nuit ─────────────────────────────────────────────────────────────

  private async estClos(jour: string): Promise<boolean> {
    const res = await this.client.execute({ sql: 'SELECT 1 FROM jour_clotures WHERE jour = ?', args: [jour] })
    return res.rows.length > 0
  }

  /**
   * Clôt les jours passés qui ne l'ont pas été : le premier à revenir
   * aujourd'hui fait pour tous ce que minuit n'a pas pu faire.
   */
  async clorePasses(aujourdhui: string): Promise<void> {
    const hier = jourAvant(aujourdhui)
    const mois = moisDe(aujourdhui)
    if (this.closJusqua >= hier && this.lauriers.jour === hier && this.moisClosAvant === mois) return
    await this.avecVerrou('#nuit', async () => {
      if (this.closJusqua < hier) {
        const res = await this.client.execute({
          sql: `SELECT DISTINCT jour FROM jour_parties WHERE jour < ? AND jour NOT IN (SELECT jour FROM jour_clotures) ORDER BY jour`,
          args: [aujourdhui],
        })
        for (const r of res.rows) await this.clore(String(r.jour))
        this.closJusqua = hier
      }
      // Les jours d'un mois fini sont clos : le mois se clôt à son tour —
      // son champion, ses mois complets —, une fois.
      if (this.moisClosAvant !== mois) {
        await this.cloreLesMois(mois)
        this.moisClosAvant = mois
      }
      // La nuit close, le laurier passe à ceux d'hier.
      if (this.lauriers.jour !== hier) await this.lireLauriers(hier)
    })
  }

  /**
   * Fige un jour : son classement devient définitif, son podium est payé —
   * 25, 15 et 10, une marche de moins que la salle —, une seule fois. Un
   * profil masqué n'y monte pas ; celui qui n'a rien marqué non plus.
   */
  private async clore(jour: string) {
    if (await this.estClos(jour)) return
    // La base, pas le classement gardé : le podium se paie une fois, pour de bon.
    const joueurs = await this.joueursDu(jour, null, true)
    const classes = classer(joueurs, j => j.points, j => j.profil.name, j => j.profil.id)
    const podium = classes
      .filter(c => c.item.points > 0)
      .map(c => ({ profileId: c.item.profil.id, rang: c.rang, points: c.item.points, xp: xpDuPodium(c.rang, joueurs.length) }))
      .filter(p => p.xp > 0)
    const maintenant = this.maintenant()
    await this.client.batch(
      [
        { sql: 'INSERT OR IGNORE INTO jour_clotures (jour, joueurs, close_le) VALUES (?, ?, ?)', args: [jour, joueurs.length, maintenant] },
        ...podium.map(p => ({
          sql: 'INSERT OR IGNORE INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, ?, ?, ?)',
          args: [jour, p.profileId, p.rang, p.points, p.xp],
        })),
      ],
      'write',
    )
    for (const p of podium) await this.avecVerrou(p.profileId, () => this.ecrireXp(p.profileId, jour))
    await this.decernerLaNuit(jour)
    console.log(`[jour] ${jour} clos : ${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}, ${podium.length} sur le podium`)
  }

  /**
   * Toute son expérience du quiz du jour, parties et podiums, recopiée dans
   * sa ligne (`LIGNE_JOUR`) — toujours sous le verrou du profil : lue puis
   * écrite, elle laisserait sinon une somme périmée par-dessus la bonne. Puis
   * les paliers du quiz du jour qu'elle lui fait atteindre, rangés sous ce
   * jour : celui de sa partie, ou celui que la nuit vient de clore.
   */
  private async ecrireXp(profileId: string, jour: string, paliers = true, lues?: ResultSet[]) {
    const [parties, podiums] = lues ?? (await this.client.batch(this.lecturesDeLExperience(profileId), 'read'))
    const xp = Number(parties.rows[0]?.xp ?? 0) + Number(podiums.rows[0]?.xp ?? 0)
    await this.deps.profiles.ecrireXpDuJour(profileId, xp, Number(parties.rows[0]?.n ?? 0))
    if (paliers) {
      await this.deps.profiles.accorderPaliersDuJour(profileId, jour, await this.statsDuJour(profileId))
      await this.accorderSaison(profileId, jour)
    }
  }

  /** Ce que son expérience du jour additionne : ses parties, ses podiums. */
  private lecturesDeLExperience(profileId: string): InStatement[] {
    return [
      { sql: 'SELECT COALESCE(SUM(xp + xp_serie), 0) AS xp, COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
      { sql: 'SELECT COALESCE(SUM(xp), 0) AS xp FROM jour_podiums WHERE profile_id = ?', args: [profileId] },
    ]
  }

  /** Ses jours joués dans la période d'une saison — une partie commencée compte, comme pour la série. */
  private async joursDeSaison(profileId: string, periode: { debut: string; fin: string }): Promise<number> {
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour >= ? AND jour <= ?',
      args: [profileId, periode.debut, periode.fin],
    })
    return Number(res.rows[0]?.n ?? 0)
  }

  /**
   * Halloween, Noël, le Nouvel An (`shared/saisons.ts`) : assez de jours joués
   * dans la période ouvrent le légendaire de la saison, rangé sous ce jour.
   */
  private async accorderSaison(profileId: string, jour: string) {
    const periode = periodeDu(jour)
    if (!periode || (await this.joursDeSaison(profileId, periode)) < periode.saison.jours) return
    await this.deps.profiles.accorderSaison(profileId, periode.saison, jour)
  }

  // ── Ce que la partie, la nuit et le mois décernent ─────────────────────

  /**
   * Ce qu'une partie fait tomber en commençant : le Dernier Métro, passé
   * 23 h 30 à Paris ; la page du calendrier, au vingtième jour joué du mois
   * (`JOURS_POUR_UNE_PAGE` — une partie commencée compte, comme pour la
   * série). La page se range sous le mois : une seule par mois et par an.
   */
  private async decernerAuDebut(profileId: string, jour: string, quand: number): Promise<void> {
    if (minutesDeParis(quand) >= DEPUIS_LE_DERNIER_METRO) await this.deps.profiles.ranger(profileId, cleDuJour(jour), ['hf:dernier-metro'], quand)
    const mois = moisDe(jour)
    const res = await this.client.execute({
      sql: `SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour >= ? AND jour <= ?`,
      args: [profileId, `${mois}-01`, `${mois}-31`],
    })
    if (Number(res.rows[0]?.n ?? 0) >= JOURS_POUR_UNE_PAGE) {
      await this.deps.profiles.ranger(profileId, cleDuMois(mois), [cleDeLaPage(mois.slice(5, 7))], quand)
    }
  }

  /**
   * Ce qu'une partie fait tomber en finissant : le Lève-tôt, avant huit
   * heures à Paris ; et Chronos, le Divin du quiz du jour, au dernier jour
   * d'une série sans une faute assez longue (`chronosDescend` — la règle vit
   * dans `core/divins.ts`, avec celle des autres Divins).
   */
  private async decernerALaFin(profileId: string, jour: string, quand: number): Promise<void> {
    const cles: string[] = []
    if (minutesDeParis(quand) < AVANT_LE_LEVE_TOT) cles.push('hf:leve-tot')
    const res = await this.client.execute({
      sql: `SELECT p.jour FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour
            WHERE p.profile_id = ? AND p.jour > ? AND p.jour <= ? AND p.finie_le IS NOT NULL
              AND json_array_length(t.questions) > json_array_length(t.annulees)
              AND p.justes >= json_array_length(t.questions) - json_array_length(t.annulees)`,
      args: [profileId, jourAvant(jour, JOURS_DE_CHRONOS), jour],
    })
    if (chronosDescend(new Set(res.rows.map(r => String(r.jour))), jour)) cles.push('dv:chronos')
    if (cles.length > 0) await this.deps.profiles.ranger(profileId, cleDuJour(jour), cles, quand)
  }

  /**
   * Ce que la nuit décerne en clôturant un jour : ce qui se mesure aux
   * autres, quand tout le monde a joué. Le Laurier à chaque vainqueur ; le
   * Triomphe à trois victoires d'affilée ; et, dans une salle de huit au
   * moins (`SALLE_DU_JOUR`) : le Phénix du jour (vainqueur au lendemain d'un
   * jour fini dans la moitié basse), Seul au monde, la Lanterne du jour,
   * l'Éclair du jour, et le palier de L'Élite au premier quart. Le Courant
   * d'air, enfin, à qui a laissé sa partie en route. Les masqués n'y
   * comptent ni n'y gagnent rien, comme au podium.
   *
   * Rejouée — la relecture des jours passés, une nuit reprise après une
   * panne —, elle ne double rien : chaque ligne est unique sous son jour.
   */
  private async decernerLaNuit(jour: string): Promise<void> {
    const veille = jourAvant(jour)
    const avantVeille = jourAvant(jour, 2)
    const [parties, reponses, victoires, laVeille] = await this.client.batch(
      [
        {
          sql: `SELECT p.profile_id, p.points, p.question, p.servie_le, p.finie_le FROM jour_parties p
                JOIN profiles pr ON pr.id = p.profile_id AND pr.disabled_at IS NULL WHERE p.jour = ?`,
          args: [jour],
        },
        { sql: 'SELECT profile_id, question, choix, ms, juste FROM jour_reponses WHERE jour = ?', args: [jour] },
        { sql: 'SELECT jour, profile_id FROM jour_podiums WHERE rang = 1 AND jour IN (?, ?, ?)', args: [jour, veille, avantVeille] },
        {
          sql: `SELECT p.profile_id, p.points FROM jour_parties p
                JOIN profiles pr ON pr.id = p.profile_id AND pr.disabled_at IS NULL WHERE p.jour = ?`,
          args: [veille],
        },
      ],
      'read',
    )
    const tirage = await this.tirageLu(jour)
    if (!tirage) return
    const total = tirage.questions.length
    const salle = parties.rows
      .map(r => ({
        id: String(r.profile_id),
        points: Number(r.points),
        question: Number(r.question),
        servie: r.servie_le != null,
        finie: r.finie_le != null,
      }))
      .filter(j => !this.masques.has(j.id))
    const dansLaSalle = new Set(salle.map(j => j.id))
    const recompenses = new Map<string, Set<string>>()
    const donner = (id: string, cle: string) => {
      let siennes = recompenses.get(id)
      if (!siennes) recompenses.set(id, (siennes = new Set()))
      siennes.add(cle)
    }
    const vainqueurs = (j: string) => new Set(victoires.rows.filter(r => String(r.jour) === j).map(r => String(r.profile_id)))
    const [duJour, deLaVeille, deLAvantVeille] = [vainqueurs(jour), vainqueurs(veille), vainqueurs(avantVeille)]
    for (const id of duJour) {
      if (!dansLaSalle.has(id)) continue
      donner(id, 'hf:laurier')
      if (deLaVeille.has(id) && deLAvantVeille.has(id)) donner(id, 'hf:triomphe')
    }
    const grande = salle.length >= SALLE_DU_JOUR
    if (grande) {
      // Le Phénix du jour : la veille, dans la moitié basse d'une salle de huit.
      const hier = laVeille.rows.map(r => ({ id: String(r.profile_id), points: Number(r.points) })).filter(j => !this.masques.has(j.id))
      if (hier.length >= SALLE_DU_JOUR) {
        const points = hier.map(j => j.points).sort((a, b) => b - a)
        for (const j of hier) {
          if (duJour.has(j.id) && dansLaSalle.has(j.id) && rangDansLesTries(j.points, points) * 2 > hier.length) donner(j.id, 'hf:phenix-du-jour')
        }
      }
      // Seul au monde, et l'Éclair du jour : question par question.
      const parQuestion = new Map<number, { id: string; choix: number | null; ms: number | null; juste: boolean }[]>()
      for (const r of reponses.rows) {
        const id = String(r.profile_id)
        if (!dansLaSalle.has(id)) continue
        const q = Number(r.question)
        if (tirage.annulees.includes(q)) continue
        const liste = parQuestion.get(q) ?? []
        liste.push({ id, choix: r.choix == null ? null : Number(r.choix), ms: r.ms == null ? null : Number(r.ms), juste: Number(r.juste) === 1 })
        parQuestion.set(q, liste)
      }
      const eclairs = new Map<string, number>()
      for (const liste of parQuestion.values()) {
        const repondues = liste.filter(l => l.choix !== null)
        const justes = repondues.filter(l => l.juste)
        if (repondues.length >= SALLE_DU_JOUR && justes.length === 1) donner(justes[0].id, 'hf:seul-au-monde')
        const chronometrees = justes.filter(l => l.ms !== null)
        if (chronometrees.length >= 3) {
          const plusVite = Math.min(...chronometrees.map(l => l.ms!))
          for (const l of chronometrees) if (l.ms === plusVite) eclairs.set(l.id, (eclairs.get(l.id) ?? 0) + 1)
        }
      }
      for (const [id, n] of eclairs) if (n >= 3) donner(id, 'hf:eclair-du-jour')
      // La Lanterne du jour : dernier, en ayant répondu à tout — tous les ex æquo du bas.
      const plusBas = Math.min(...salle.map(j => j.points))
      const plusHaut = Math.max(...salle.map(j => j.points))
      if (plusBas < plusHaut) {
        const repondues = new Map<string, number>()
        for (const r of reponses.rows) if (r.choix != null) repondues.set(String(r.profile_id), (repondues.get(String(r.profile_id)) ?? 0) + 1)
        for (const j of salle) if (j.points === plusBas && j.finie && (repondues.get(j.id) ?? 0) >= total) donner(j.id, 'hf:lanterne-du-jour')
      }
    }
    // Le Courant d'air : commencée, et laissée avant sa dernière question.
    for (const j of salle) if (!j.finie && j.question + (j.servie ? 1 : 0) < total) donner(j.id, 'hf:courant-d-air')
    for (const [id, cles] of recompenses) await this.deps.profiles.ranger(id, cleDuJour(jour), [...cles], this.maintenant())
    // L'Élite : le premier quart d'une salle de huit fait monter son compte,
    // et peut-être son palier — sous son verrou, comme toute expérience.
    if (grande) {
      const points = salle.map(j => j.points).sort((a, b) => b - a)
      for (const j of salle) {
        if (j.points > 0 && rangDansLesTries(j.points, points) * 4 <= salle.length) {
          await this.avecVerrou(j.id, async () => this.deps.profiles.accorderPaliersDuJour(j.id, jour, await this.statsDuJour(j.id)))
        }
      }
    }
  }

  /**
   * Clôt les mois finis qui ne l'ont pas été : leur champion — le premier du
   * classement du mois, rang partagé, devant un autre au moins —, et leurs
   * mois complets — chaque jour qui avait un quiz, joué. Un mois ne compte
   * pour le Mois complet que s'il a eu presque tous ses quiz
   * (`JOURS_D_UN_MOIS_COMPLET`) : septembre 2026, ouvert le 26, n'en avait
   * que cinq. Une fois par mois, sous son drapeau — puis les champions du
   * mois dernier se relisent.
   */
  private async cloreLesMois(moisEnCours: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT DISTINCT substr(jour, 1, 7) AS mois FROM jour_parties WHERE jour < ?
            AND substr(jour, 1, 7) NOT IN (SELECT substr(cle, 11) FROM jour_meta WHERE cle LIKE 'mois_clos:%') ORDER BY mois`,
      args: [`${moisEnCours}-01`],
    })
    for (const r of res.rows) await this.cloreLeMois(String(r.mois))
    await this.lireChampions(moisAvant(moisEnCours))
  }

  private async cloreLeMois(mois: string): Promise<void> {
    const classement = await this.classementDuMois(mois, null)
    for (const l of classement.lignes) {
      if (l.rang === 1 && l.points > 0 && classement.joueurs >= 2) {
        await this.deps.profiles.ranger(l.profileId, cleDuMois(mois), [cleDuChampion(mois)], this.maintenant())
      }
    }
    const [tirages, parties] = await this.client.batch(
      [
        { sql: 'SELECT jour FROM jour_tirages WHERE jour >= ? AND jour <= ?', args: [`${mois}-01`, `${mois}-31`] },
        { sql: 'SELECT profile_id, jour FROM jour_parties WHERE jour >= ? AND jour <= ?', args: [`${mois}-01`, `${mois}-31`] },
      ],
      'read',
    )
    const jours = new Set(tirages.rows.map(t => String(t.jour)))
    if (jours.size >= JOURS_D_UN_MOIS_COMPLET) {
      const parProfil = new Map<string, Set<string>>()
      for (const p of parties.rows) {
        const id = String(p.profile_id)
        const siens = parProfil.get(id) ?? new Set<string>()
        siens.add(String(p.jour))
        parProfil.set(id, siens)
      }
      for (const [id, siens] of parProfil) {
        if ([...jours].every(j => siens.has(j))) await this.deps.profiles.ranger(id, cleDuMois(mois), ['hf:mois-complet'], this.maintenant())
      }
    }
    await this.client.execute({
      sql: 'INSERT INTO jour_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO NOTHING',
      args: [`mois_clos:${mois}`, String(this.maintenant())],
    })
    console.log(`[jour] ${mois} clos`)
  }

  /** Relit les champions d'un mois clos : ceux que l'écran commun salue tout le mois suivant. */
  private async lireChampions(mois: string): Promise<void> {
    if (this.championsDuMois.mois === mois) return
    const res = await this.client.execute({
      sql: 'SELECT DISTINCT profile_id FROM profile_badges WHERE badge = ? AND soiree_id = ?',
      args: [cleDuChampion(mois), cleDuMois(mois)],
    })
    this.championsDuMois = { mois, ids: new Set(res.rows.map(r => String(r.profile_id))) }
  }

  /**
   * Le mois dont ce profil est le champion, s'il l'est du mois dernier : lu
   * en mémoire, pour l'instantané de la salle. Masqué, il ne s'annonce pas.
   */
  champions(profileId: string): string | null {
    const { mois, ids } = this.championsDuMois
    return mois && ids.has(profileId) && !this.masques.has(profileId) && mois === moisAvant(moisDe(jourDe(this.maintenant()))) ? mois : null
  }

  /**
   * Relit tous les jours passés avec les règles du jour, une fois par
   * version (`VERSION_DES_JOURS`) : ce qu'une nuit, une partie ou un mois
   * auraient décerné s'ils avaient connu ces règles. Les récompenses sont
   * des dérivations des journaux (invariant 20) : une nouvelle règle profite
   * aux jours d'avant — et rien ne double, chaque ligne étant unique sous son
   * jour ou son mois. Une base qui hoquette arrête le démarrage plutôt que
   * de poser le drapeau sur une relecture à moitié faite.
   */
  async relireLesJours(): Promise<{ jours: number; profils: number } | null> {
    const fait = await this.client.execute({ sql: 'SELECT valeur FROM jour_meta WHERE cle = ?', args: ['relecture_des_jours'] })
    if (Number(fait.rows[0]?.valeur ?? 0) >= VERSION_DES_JOURS) return null
    const aujourdhui = jourDe(this.maintenant())
    const [clos, parties] = await this.client.batch(
      [
        { sql: 'SELECT jour FROM jour_clotures ORDER BY jour', args: [] },
        { sql: 'SELECT profile_id, jour, commencee_le, finie_le FROM jour_parties ORDER BY jour', args: [] },
      ],
      'read',
    )
    await this.avecVerrou('#nuit', async () => {
      for (const r of clos.rows) await this.decernerLaNuit(String(r.jour))
      this.moisClosAvant = ''
      await this.cloreLesMois(moisDe(aujourdhui))
      this.moisClosAvant = moisDe(aujourdhui)
    })
    const profils = new Set<string>()
    for (const r of parties.rows) {
      const id = String(r.profile_id)
      const jour = String(r.jour)
      profils.add(id)
      await this.avecVerrou(id, async () => {
        await this.decernerAuDebut(id, jour, Number(r.commencee_le))
        if (r.finie_le != null) await this.decernerALaFin(id, jour, Number(r.finie_le))
      })
    }
    for (const id of profils) await this.avecVerrou(id, async () => this.deps.profiles.accorderPaliersDuJour(id, aujourdhui, await this.statsDuJour(id)))
    await this.client.execute({
      sql: 'INSERT INTO jour_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur',
      args: ['relecture_des_jours', String(VERSION_DES_JOURS)],
    })
    return { jours: clos.rows.length, profils: profils.size }
  }

  /**
   * Le barème du solo du 6 octobre 2026, appliqué à ce qui est déjà joué —
   * une fois, au démarrage qui l'apporte (`core/baremeDuSolo.ts`) : chaque
   * partie se recompte sur ses points (`xpDuJour`), chaque podium à son rang
   * (`xpDuPodium`), chaque partie reçoit le bonus de la série qu'elle tenait
   * ce jour-là (`seriesParJour`), et la ligne de chaque joueur se réécrit.
   * Tout se relit des journaux : rejouée, elle écrit la même chose. Rend les
   * profils dont la ligne a été réécrite.
   */
  async revaloriser(): Promise<string[]> {
    const [parties, podiums] = await this.client.batch(
      [
        {
          sql: `SELECT p.profile_id, p.jour, p.points,
                       json_array_length(t.questions) - json_array_length(t.annulees) AS comptees
                FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour`,
          args: [],
        },
        { sql: 'SELECT d.jour, d.profile_id, d.rang, c.joueurs FROM jour_podiums d JOIN jour_clotures c ON c.jour = d.jour', args: [] },
      ],
      'read',
    )
    const parProfil = new Map<string, { jour: string; points: number; comptees: number }[]>()
    for (const r of parties.rows) {
      const id = String(r.profile_id)
      if (!parProfil.has(id)) parProfil.set(id, [])
      parProfil.get(id)!.push({ jour: String(r.jour), points: Number(r.points), comptees: Number(r.comptees ?? 0) })
    }
    if (podiums.rows.length > 0) {
      await this.client.batch(
        podiums.rows.map(r => ({
          sql: 'UPDATE jour_podiums SET xp = ? WHERE jour = ? AND profile_id = ?',
          args: [xpDuPodium(Number(r.rang), Number(r.joueurs)), String(r.jour), String(r.profile_id)],
        })),
        'write',
      )
    }
    const profils = new Set([...parProfil.keys(), ...podiums.rows.map(r => String(r.profile_id))])
    const aujourdhui = jourDe(this.maintenant())
    for (const id of profils) {
      await this.avecVerrou(id, async () => {
        const series = seriesLues(await this.client.batch(lecturesDeLaSerie(id), 'read'))
        const siennes = parProfil.get(id) ?? []
        if (siennes.length > 0) {
          await this.client.batch(
            siennes.map(p => ({
              sql: 'UPDATE jour_parties SET xp = ?, xp_serie = ? WHERE profile_id = ? AND jour = ?',
              args: [xpDuJour(p.points, POINTS_MAX_PAR_QUESTION * p.comptees), xpDeSerie(series.get(p.jour) ?? 1), id, p.jour],
            })),
            'write',
          )
        }
        await this.ecrireXp(id, aujourdhui, false)
      })
    }
    return [...profils]
  }

  // ── La correction ───────────────────────────────────────────────────────

  /**
   * Les questions d'un jour, leurs réponses et leurs anecdotes : pour tous
   * une fois le jour clos, et pour celui qui a fini sa partie — « Revoir mes
   * réponses ». Avant, elles donneraient le quiz à qui ne l'a pas joué.
   */
  async correction(profil: ProfileRec, jour: string) {
    if (!jourValide(jour)) return null
    await this.clorePasses(jourDe(this.maintenant()))
    const tirage = await this.tirageLu(jour)
    if (!tirage) return null
    const partie = await this.partieDe(profil.id, jour)
    if (!(await this.estClos(jour)) && !partie?.finieLe) return null
    const [siennes, salle] = await this.client.batch(
      [
        { sql: 'SELECT question, choix, juste, points FROM jour_reponses WHERE profile_id = ? AND jour = ?', args: [profil.id, jour] },
        { sql: 'SELECT question, COUNT(*) AS n, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses WHERE jour = ? GROUP BY question', args: [jour] },
      ],
      'read',
    )
    const sienne = new Map(siennes.rows.map(r => [Number(r.question), r]))
    const trouvee = new Map(salle.rows.map(r => [Number(r.question), Number(r.n) >= TROUVEE_PAR_DES ? Number(r.justes) / Number(r.n) : null]))
    return {
      jour,
      questions: tirage.questions.map((q, i) => {
        const r = sienne.get(i)
        const annulee = tirage.annulees.includes(i)
        return {
          texte: q.texte,
          reponses: q.reponses,
          bonne: q.bonne,
          categorie: q.categorie,
          anecdote: q.anecdote,
          trouveePar: trouvee.get(i) ?? null,
          choix: r?.choix == null ? null : Number(r.choix),
          juste: Number(r?.juste ?? 0) === 1,
          points: annulee ? 0 : Number(r?.points ?? 0),
          repondue: !!r,
          ...(annulee && { annulee: true }),
        }
      }),
    }
  }

  // ── La modération ───────────────────────────────────────────────────────

  /** Un joueur signale une erreur dans une question qu'il a jouée. */
  async signaler(profil: ProfileRec, jour: string, index: number, texte: unknown): Promise<void> {
    const propre = tronquer(String(texte ?? '').trim(), SIGNALEMENT_MAX)
    if (!propre) throw new Error('Dis en une phrase ce qui ne va pas')
    const res = await this.client.execute({
      sql: 'SELECT 1 FROM jour_reponses WHERE profile_id = ? AND jour = ? AND question = ?',
      args: [profil.id, jour, index],
    })
    if (res.rows.length === 0) throw new Error('Réponds d’abord à cette question')
    await this.client.execute({
      sql: `INSERT INTO jour_signalements (jour, question, profile_id, texte, cree_le) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(jour, question, profile_id) DO UPDATE SET texte = excluded.texte, cree_le = excluded.cree_le, traite_le = NULL`,
      args: [jour, index, profil.id, propre, this.maintenant()],
    })
  }

  /** Les signalements à traiter, question par question : combien, et ce qu'ils disent. */
  async signalements() {
    const res = await this.client.execute(
      `SELECT jour, question, COUNT(*) AS n, MAX(cree_le) AS dernier,
              json_group_array(texte) AS textes
       FROM jour_signalements WHERE traite_le IS NULL GROUP BY jour, question ORDER BY dernier DESC LIMIT 30`,
    )
    const aujourdhui = jourDe(this.maintenant())
    const sortie = []
    for (const r of res.rows) {
      const jour = String(r.jour)
      const index = Number(r.question)
      const tirage = await this.tirageLu(jour)
      const q = tirage?.questions[index]
      if (!tirage || !q) continue
      sortie.push({
        jour,
        index,
        reserveId: q.reserveId,
        texte: q.texte,
        bonne: q.reponses[q.bonne],
        joueurs: Number(r.n),
        textes: lireTextes(r.textes).slice(-3),
        annulee: tirage.annulees.includes(index),
        // On annule tant que le jour court : après minuit, son podium est payé.
        annulable: jour === aujourdhui && !(await this.estClos(jour)),
      })
    }
    return sortie
  }

  /** « Garder » : la question est juste, les signalements se referment. */
  async garder(jour: string, index: number) {
    await this.client.execute({
      sql: 'UPDATE jour_signalements SET traite_le = ? WHERE jour = ? AND question = ? AND traite_le IS NULL',
      args: [this.maintenant(), jour, index],
    })
  }

  /**
   * Annule les points d'une question d'aujourd'hui, pour tous : ce qu'elle
   * avait rapporté repart, les médailles se comptent sur les questions qui
   * restent, et l'expérience de chacun suit. Après minuit, le jour est clos
   * — son podium est payé — : il ne se réécrit plus.
   */
  async annuler(jour: string, index: number): Promise<void> {
    if (jour !== jourDe(this.maintenant()) || (await this.estClos(jour))) {
      throw new Error('Ce jour est clos : on ne peut plus annuler ses points. Retire la question de la réserve.')
    }
    await this.avecVerrou('#tirage', async () => {
      const tirage = await this.tirageLu(jour)
      if (!tirage || !Number.isInteger(index) || index < 0 || index >= tirage.questions.length) throw new Error('Question introuvable')
      if (tirage.annulees.includes(index)) return
      const annulees = [...tirage.annulees, index].sort((a, b) => a - b)
      await this.client.batch(
        [
          { sql: 'UPDATE jour_tirages SET annulees = ? WHERE jour = ?', args: [JSON.stringify(annulees), jour] },
          { sql: 'UPDATE jour_signalements SET traite_le = ? WHERE jour = ? AND question = ? AND traite_le IS NULL', args: [this.maintenant(), jour, index] },
        ],
        'write',
      )
      // Toujours sous le verrou du tirage : chaque recompte, sous celui de
      // son profil, lit l'annulation la plus récente — comme il la lisait
      // en base. Lui passer le tirage de cette annulation-ci laissait payée
      // la question d'une autre, annulée juste après.
      this.garderTirage({ ...tirage, annulees })
    })
    // Chacun se recompte sous son propre verrou. Recompté d'un seul coup pour
    // tout le jour, une réponse partie avant l'annulation et écrite après
    // réécrivait ses points par-dessus : la question annulée restait payée.
    // Sous le verrou, elle passe d'abord, et le recompte la corrige. Déjà
    // annulée — un double clic, un essai après une panne à mi-chemin —, le
    // recompte se rejoue quand même : il ne change rien à qui l'a eu.
    const parties = await this.client.execute({ sql: 'SELECT profile_id FROM jour_parties WHERE jour = ?', args: [jour] })
    await parLots(parties.rows, PROFILS_EN_VOL, r => {
      const profileId = String(r.profile_id)
      return this.avecVerrou(profileId, () => this.recompter(profileId, jour))
    })
    this.reviser(jour)
  }

  /** Ses points et ses bonnes réponses d'un jour, recomptés sans les questions annulées — son expérience suit. */
  private async recompter(profileId: string, jour: string) {
    const tirage = await this.tirageLu(jour)
    if (!tirage) return
    const annulees = JSON.stringify(tirage.annulees)
    const [, partie] = await this.client.batch(
      [
        {
          sql: `UPDATE jour_parties SET
                  points = (SELECT COALESCE(SUM(points), 0) FROM jour_reponses r
                            WHERE r.profile_id = jour_parties.profile_id AND r.jour = jour_parties.jour
                            AND r.question NOT IN (SELECT value FROM json_each(?))),
                  justes = (SELECT COALESCE(SUM(juste), 0) FROM jour_reponses r
                            WHERE r.profile_id = jour_parties.profile_id AND r.jour = jour_parties.jour
                            AND r.question NOT IN (SELECT value FROM json_each(?)))
                WHERE profile_id = ? AND jour = ?`,
          args: [annulees, annulees, profileId, jour],
        },
        { sql: 'SELECT points FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, jour] },
      ],
      'write',
    )
    const points = Number(partie.rows[0]?.points ?? 0)
    await this.client.execute({
      sql: 'UPDATE jour_parties SET xp = ? WHERE profile_id = ? AND jour = ?',
      args: [xpDuJour(points, possiblesDe(tirage)), profileId, jour],
    })
    await this.ecrireXp(profileId, jour)
  }

  /** Masque un profil du classement — ou l'y remet. Il n'en est pas averti. */
  async masquer(profileId: string, masque: boolean): Promise<void> {
    await this.client.execute(
      masque
        ? { sql: 'INSERT OR IGNORE INTO jour_masques (profile_id, masque_le) VALUES (?, ?)', args: [profileId, this.maintenant()] }
        : { sql: 'DELETE FROM jour_masques WHERE profile_id = ?', args: [profileId] },
    )
    // Les classements gardés n'ont pas à se relire : les masqués s'écartent
    // à chaque lecture (`joueursDu`), après la mémoire.
    if (masque) this.masques.add(profileId)
    else this.masques.delete(profileId)
    this.versionDesMasques++
    // Masqué, il ne s'annonce plus : son laurier tombe avec, et revient s'il
    // est rendu au classement le jour même.
    const hier = jourAvant(jourDe(this.maintenant()))
    if (this.lauriers.jour === hier) await this.lireLauriers(hier)
  }

  // ── Le laurier ──────────────────────────────────────────────────────────

  /**
   * Les vainqueurs d'hier — tous les ex æquo en tête, les masqués écartés :
   * un laurier suit leur prénom toute la journée, jusque dans les soirées où
   * ils jouent. Lus en mémoire, sans attendre : chaque diffusion à toute la
   * salle les demande.
   *
   * Rien ne tourne à minuit. Passé minuit, la liste d'avant-hier se tait
   * aussitôt, et la nuit se clôt en arrière-plan si personne n'est encore
   * revenu au quiz du jour : les lauriers se posent alors sur ceux d'hier,
   * et les salles où ils jouent se rediffusent (`laurierChange`).
   */
  laureats(): ReadonlySet<string> {
    const { aujourdhui, hier } = this.joursDeLHeure()
    if (this.lauriers.jour === hier) return this.lauriers.ids
    if (!this.lauriersEnRoute && !this.ferme) {
      this.lauriersEnRoute = this.clorePasses(aujourdhui)
        .catch(e => {
          if (!this.ferme) console.error('[jour] les lauriers d’hier n’ont pas pu se lire :', e)
        })
        .finally(() => {
          this.lauriersEnRoute = null
        })
    }
    return AUCUN_LAURIER
  }

  /**
   * Aujourd'hui et hier à Paris, gardés pour l'heure en cours : minuit à
   * Paris tombe toujours sur une heure pleine du temps universel (UTC+1 ou
   * UTC+2, changements d'heure compris), alors le jour ne change jamais au
   * milieu d'une heure. `laureats` le demande pour chaque profil de chaque
   * instantané, et `Intl` le recalculait à chaque fois — deux
   * millisecondes par instantané de cinq cents profils.
   */
  private joursDeLHeure(): { aujourdhui: string; hier: string } {
    const heure = Math.floor(this.maintenant() / HEURE_MS)
    if (this.joursGardes?.heure !== heure) {
      const aujourdhui = jourDe(heure * HEURE_MS)
      this.joursGardes = { heure, aujourdhui, hier: jourAvant(aujourdhui) }
    }
    return this.joursGardes
  }

  /**
   * Relit les vainqueurs d'un jour clos, et rediffuse la salle de ceux dont
   * le laurier change : ceux qui le gagnent, ceux qui le perdent — et ceux
   * qui l'avaient déjà, que la salle a pu voir sans lui depuis minuit.
   */
  private async lireLauriers(jour: string) {
    const res = await this.client.execute({ sql: 'SELECT profile_id FROM jour_podiums WHERE jour = ? AND rang = 1', args: [jour] })
    const ids = new Set(res.rows.map(r => String(r.profile_id)).filter(id => !this.masques.has(id)))
    const avant = this.lauriers
    this.lauriers = { jour, ids }
    const touches = new Set([...ids, ...avant.ids])
    for (const id of touches) if (avant.jour !== jour || avant.ids.has(id) !== ids.has(id)) this.laurierChange?.(id)
  }

  /** Les profils masqués, et ceux qu'une recherche trouve — pour l'administration. */
  async profilsPourLAdministration(cherche: string): Promise<{ id: string; login: string; nom: string; avatar: string; masque: boolean }[]> {
    const motif = `%${cherche.trim().toLowerCase().replace(/[%_]/g, '')}%`
    const res = await this.client.execute({
      sql: cherche.trim()
        ? `SELECT id, login, name, avatar FROM profiles WHERE disabled_at IS NULL AND (lower(name) LIKE ? OR login LIKE ?) ORDER BY name LIMIT 12`
        : `SELECT id, login, name, avatar FROM profiles WHERE id IN (SELECT profile_id FROM jour_masques) ORDER BY name LIMIT 50`,
      args: cherche.trim() ? [motif, motif] : [],
    })
    return res.rows.map(r => ({
      id: String(r.id),
      login: String(r.login),
      nom: String(r.name),
      // L'avatar enregistré, tel quel : l'administrateur cherche un profil,
      // il ne regarde pas la salle — un emoji de collection redescendu y
      // reste lisible, là où `avatarPorte` montrerait l'avatar par défaut.
      avatar: String(r.avatar),
      masque: this.masques.has(String(r.id)),
    }))
  }

  /**
   * Un profil supprimé (`/admin`, « Les profils ») : ses parties, ses
   * réponses, ses podiums, ses signalements et son masque partent avec lui,
   * sous son verrou — une réponse en route n'écrit pas derrière. Les
   * classements gardés de ses jours se relisent : son prénom y restait.
   * Ce que les autres ont gagné ces jours-là ne bouge pas — son podium ne
   * remonte personne.
   */
  async oublierProfil(profileId: string): Promise<void> {
    await this.avecVerrou(profileId, async () => {
      const jours = await this.client.execute({ sql: 'SELECT DISTINCT jour FROM jour_parties WHERE profile_id = ?', args: [profileId] })
      await this.client.batch(
        ['jour_reponses', 'jour_parties', 'jour_podiums', 'jour_signalements', 'jour_masques'].map(table => ({
          sql: `DELETE FROM ${table} WHERE profile_id = ?`,
          args: [profileId],
        })),
        'write',
      )
      for (const r of jours.rows) this.reviser(String(r.jour))
      this.masques.delete(profileId)
      this.versionDesMasques++
    })
  }

  // ── Interne ─────────────────────────────────────────────────────────────

  /** Une chose à la fois pour cette clé : un profil, le tirage, la nuit. */
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

/** Les points possibles d'un jour : deux cents par question qui compte encore. */
function possiblesDe(tirage: Tirage): number {
  return POINTS_MAX_PAR_QUESTION * (tirage.questions.length - tirage.annulees.length)
}

/**
 * Le prénom de chaque joueur, marque d'homonymie comprise (« Camille (2) ») :
 * posée dans l'ordre d'arrivée, comme en soirée, elle reste au second quel
 * que soit son rang. Tout prénom du quiz du jour passe par ici — le
 * classement, « à 70 pts de », le vainqueur d'hier (invariant 17).
 */
function nommer(joueurs: readonly Joueur[], avatarDe: (p: ProfileRec) => string): (j: Joueur) => string {
  const arrivee = [...joueurs].sort((a, b) => a.commenceeLe - b.commenceeLe || a.profil.id.localeCompare(b.profil.id))
  // L'avatar qu'on voit, pas celui qu'il a en base : deux Camille qu'un
  // emoji de collection redevenu trop haut laisse sous le même 🎉 se
  // distinguent comme les autres.
  const marques = nomsAffiches(arrivee.map(j => ({ id: j.profil.id, name: j.profil.name, avatar: avatarDe(j.profil) })))
  return j => marques.get(j.profil.id) ?? j.profil.name
}

/** Une ligne de `jour_parties`, telle que la partie se lit — null s'il n'y en a pas. */
/**
 * Ce que ses paliers du quiz du jour comptent (`statsDuJour`) : seules, ou
 * dans le lot qui commence sa partie. Le premier quart se lit sur les jours
 * clos — la nuit fige le classement —, les masqués écartés, à huit joueurs
 * au moins (`SALLE_DU_JOUR`) : le rang de chacun est celui du classement,
 * rang partagé (invariant 15). La série lit ses jours joués, ses soirées et
 * ses sabliers (`serieAvecSabliers`).
 */
function lecturesDesStats(profileId: string): InStatement[] {
  return [
    { sql: 'SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
    { sql: 'SELECT COUNT(*) AS n FROM jour_podiums WHERE profile_id = ? AND rang = 1', args: [profileId] },
    {
      sql: `SELECT COUNT(*) AS n FROM jour_parties p JOIN jour_tirages t ON t.jour = p.jour
            WHERE p.profile_id = ? AND p.finie_le IS NOT NULL
              AND json_array_length(t.questions) > json_array_length(t.annulees)
              AND p.justes >= json_array_length(t.questions) - json_array_length(t.annulees)`,
      args: [profileId],
    },
    {
      sql: `SELECT COUNT(*) AS n FROM (
              SELECT p.profile_id AS id, p.points,
                     RANK() OVER (PARTITION BY p.jour ORDER BY p.points DESC) AS rang,
                     COUNT(*) OVER (PARTITION BY p.jour) AS joueurs
              FROM jour_parties p
              JOIN jour_clotures c ON c.jour = p.jour
              JOIN profiles pr ON pr.id = p.profile_id AND pr.disabled_at IS NULL
              WHERE p.jour IN (SELECT jour FROM jour_parties WHERE profile_id = ?)
                AND p.profile_id NOT IN (SELECT profile_id FROM jour_masques)
            ) WHERE id = ? AND joueurs >= ? AND points > 0 AND rang * 4 <= joueurs`,
      args: [profileId, profileId, SALLE_DU_JOUR],
    },
    ...lecturesDeLaSerie(profileId),
  ]
}

/** Ce que sa série lit : ses jours de quiz du jour, ses soirées, ses sabliers. */
function lecturesDeLaSerie(profileId: string, depuis?: string): InStatement[] {
  const apres = depuis ? Date.UTC(Number(depuis.slice(0, 4)), Number(depuis.slice(5, 7)) - 1, Number(depuis.slice(8, 10))) : 0
  return [
    { sql: 'SELECT jour FROM jour_parties WHERE profile_id = ? AND jour >= ?', args: [profileId, depuis ?? ''] },
    { sql: `SELECT created_at FROM profile_xp WHERE profile_id = ? AND ${HORS_LIGNES_A_PART} AND created_at >= ?`, args: [profileId, apres] },
    { sql: 'SELECT created_at FROM profile_sabliers WHERE profile_id = ? AND created_at >= ?', args: [profileId, apres] },
  ]
}

/** Sa série, ses sabliers comptés, de ce que `lecturesDeLaSerie` a lu. */
function serieLue([jours, soirees, sabliers]: readonly ResultSet[], aujourdhui: string): SerieDuJour {
  const joues = new Set<string>([...jours.rows.map(r => String(r.jour)), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
  return serieAvecSabliers(
    joues,
    sabliers.rows.map(r => jourDe(Number(r.created_at))),
    aujourdhui,
  )
}

/** La série que chaque jour joué tenait, de ce que `lecturesDeLaSerie` a lu : le bonus de série de chaque partie. */
function seriesLues([jours, soirees, sabliers]: readonly ResultSet[]): Map<string, number> {
  const joues = new Set<string>([...jours.rows.map(r => String(r.jour)), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
  return seriesParJour(
    joues,
    sabliers.rows.map(r => jourDe(Number(r.created_at))),
  )
}

function statsDe([joues, victoires, sansFautes, elite, ...serie]: readonly ResultSet[], aujourdhui: string): StatsDuJour {
  return {
    joues: Number(joues.rows[0]?.n ?? 0),
    victoires: Number(victoires.rows[0]?.n ?? 0),
    sansFautes: Number(sansFautes.rows[0]?.n ?? 0),
    elite: Number(elite.rows[0]?.n ?? 0),
    serieRecord: serieLue(serie, aujourdhui).record,
  }
}

function lirePartie(profileId: string, jour: string, r: Record<string, unknown> | undefined): Partie | null {
  if (!r) return null
  return {
    profileId,
    jour,
    commenceeLe: Number(r.commencee_le),
    question: Number(r.question),
    servieLe: r.servie_le == null ? null : Number(r.servie_le),
    points: Number(r.points),
    justes: Number(r.justes),
    finieLe: r.finie_le == null ? null : Number(r.finie_le),
    xp: Number(r.xp),
    xpSerie: Number(r.xp_serie ?? 0),
  }
}

/** `travail` sur chaque élément, `n` à la fois ; les résultats dans l'ordre des éléments. */
async function parLots<T, R>(elements: readonly T[], n: number, travail: (e: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = []
  for (let i = 0; i < elements.length; i += n) resultats.push(...(await Promise.all(elements.slice(i, i + n).map(travail))))
  return resultats
}

/** La question telle que le téléphone la reçoit : ni sa bonne réponse, ni son anecdote. */
function questionVue(tirage: Tirage, index: number, servieLe: number): QuestionDuJour {
  const q = tirage.questions[index]
  return {
    jour: tirage.jour,
    index,
    total: tirage.questions.length,
    texte: q.texte,
    reponses: q.reponses,
    categorie: q.categorie,
    duree: q.duree,
    echeance: servieLe + q.duree * 1000,
  }
}

function lireNombres(brut: unknown): number[] {
  try {
    const x = JSON.parse(String(brut))
    return Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : []
  } catch {
    return []
  }
}

function lireTextes(brut: unknown): string[] {
  try {
    const x = JSON.parse(String(brut))
    return Array.isArray(x) ? x.map(String) : []
  } catch {
    return []
  }
}

function lireListe(brut: unknown): { texte: string; raison: string }[] {
  try {
    const x = JSON.parse(String(brut))
    return Array.isArray(x) ? x.filter(e => e && typeof e.texte === 'string' && typeof e.raison === 'string') : []
  } catch {
    return []
  }
}

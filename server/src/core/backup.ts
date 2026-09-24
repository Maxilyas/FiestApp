import type { InStatement, ResultSet } from '@libsql/client'
import { ajouterColonne, clientDistant, DELAI_DISTANT_MS, type Client } from './distante'
import { lireSoireeLocale, type DB } from './db'
import type { PlayerRec } from './party'
import type { TeamRec } from './teams'
import type { Soiree } from './archive'
import { toRow, type AnswerRow } from './answers'
import type { TeamBonus } from '../../../shared/types'

/** Une partie telle qu'elle est écrite dans la table `sessions` locale. */
export interface SessionRow {
  id: string
  spaceId: string
  status: 'running' | 'ended'
  participantIds: string
  state: string
  timers: string
  createdAt: number
  updatedAt: number
}

/** Un gain tel qu'il part au miroir, sous l'identifiant tiré à l'écriture locale. */
export interface GainMiroir {
  uid: string
  playerId: string
  sessionId: string | null
  points: number
  reason: string
  createdAt: number
}

/** Une ligne du journal des réponses, sous son identifiant stable. */
export type ReponseMiroir = AnswerRow & { uid: string }

/** Le miroir vu depuis un espace : chaque écriture porte son identifiant. */
export interface PartyMirror {
  savePlayer(rec: PlayerRec, createdAt: number): void
  saveTeam(rec: TeamRec): void
  saveBonus(rec: TeamBonus): void
  dropAnswers(sessionId: string, qIndex: number): void
  deleteBonus(bonusId: string): void
  saveAnswers(rows: ReponseMiroir[]): void
  /**
   * La partie telle que le moteur la persiste — terminée comprise : c'est la
   * copie exacte du quiz joué, et l'archive d'un réveil sur disque effacé
   * n'en a pas d'autre. Dans un lot ouvert, elle part avec lui ; seule, elle
   * remplace l'état de la même partie qui attendait encore dans la file.
   */
  saveSession(row: SessionRow): void
  saveScore(entry: GainMiroir): void
  /**
   * La fiche d'un invité exclu. Ses gains et ses réponses ne partent pas
   * avec : chaque registre efface ses propres lignes, ici comme en local.
   */
  deletePlayer(playerId: string): void
  /** Les gains d'un invité exclu — le registre des gains le demande. */
  deletePlayerScores(playerId: string): void
  /** Les réponses d'un invité exclu — le journal des réponses le demande. */
  deletePlayerAnswers(playerId: string): void
  deleteTeam(teamId: string): void
  /**
   * Ouvre un lot : jusqu'à `fermerLot()`, les gains, les réponses, leurs
   * effacements, ceux d'un invité exclu et l'état de la partie s'y
   * accumulent, puis partent ensemble en UNE transaction. Les lots
   * s'emboîtent ; seul le dernier fermé envoie.
   */
  ouvrirLot(): void
  /** Vrai si le lot ouvert porte déjà des gains, des réponses ou des effacements. */
  lotCharge(): boolean
  fermerLot(): void
  /**
   * Le nom de la soirée en cours. Seule écriture que l'appelant attend : rien
   * ne doit s'écrire sous ce nom dans la base permanente tant qu'un réveil sur
   * disque effacé ne saurait pas le retrouver.
   */
  saveSoiree(soiree: Soiree): Promise<void>
  /**
   * Repart d'une soirée vierge — pour cet espace seulement. `effacerLocal`
   * n'est appelée que si le miroir a bien été effacé ; sinon l'erreur
   * remonte, et rien n'a bougé nulle part.
   */
  reset(effacerLocal?: () => void): Promise<void>
  /** La sauvegarde échoue depuis assez longtemps pour que l'écran commun le dise. */
  enRetard(): boolean
  /** Appelé quand `enRetard()` change — aux transitions seulement, jamais à chaque essai. */
  surRetard(ecouteur: () => void): void
}

/** Ce qu'on peut régler du miroir — les tests le pressent, la production garde les défauts. */
export interface ReglagesMiroir {
  /**
   * La base locale : c'est d'elle qu'une resynchronisation relit l'espace
   * entier. Sans elle, le miroir ne sait que rejouer sa file.
   */
  base?: DB
  /** Les délais entre deux essais d'une écriture refusée ; le dernier se répète. */
  reessaisMs?: number[]
  /** Au bout de combien de temps d'échecs ininterrompus l'écran commun le signale. */
  alerteMs?: number
  /** La taille de file, en octets à peu près, au-delà de laquelle on préfère tout resynchroniser. */
  seuilOctets?: number
  /** Ce que l'arrêt accorde à la file pour se vider avant d'abandonner le reste. */
  delaiExtinctionMs?: number
}

const REGLAGES: Required<Omit<ReglagesMiroir, 'base'>> = {
  // Vite au début — la plupart des pannes sont des hoquets —, puis toutes
  // les quinze secondes : au rétablissement, la file repart dans ce délai.
  reessaisMs: [250, 500, 1000, 2000, 4000, 8000, 15_000],
  alerteMs: 10_000,
  // Quatre mégaoctets par espace : une soirée entière de réponses, bien
  // au-delà de ce qu'une panne de quelques minutes accumule, et rien pour
  // les 512 Mo de l'instance.
  seuilOctets: 4 * 1024 * 1024,
  // `index.ts` coupe tout deux secondes après ce délai.
  delaiExtinctionMs: DELAI_DISTANT_MS,
}

/** Une resynchronisation part par lots de cette taille : une soirée entière d'un coup ferait une requête démesurée. */
const LIGNES_PAR_LOT = 200

/** Au-delà, deux écritures successives d'une même partie ne fusionnent plus : une transaction reste raisonnable. */
const FUSION_MAX_LIGNES = 500

/** Les six tables du miroir, celles qui portent l'espace. */
const MIRROR_TABLES = ['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions']

// ── Les requêtes ─────────────────────────────────────────────────────────
//
// Toutes rejouables : un envoi dont la réponse s'est perdue repart tel quel,
// et une resynchronisation repasse sur ce qui est déjà là. Les gains et les
// réponses gardent l'identifiant tiré à l'écriture locale : rejoués, ils ne
// s'ajoutent pas une seconde fois.

const SQL = {
  joueur: `INSERT INTO party_players (id, name, avatar, token, team_id, profile_id, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, token = excluded.token,
             team_id = excluded.team_id, profile_id = excluded.profile_id`,
  equipe: `INSERT INTO party_teams (id, name, emoji, position, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, emoji = excluded.emoji`,
  prix: `INSERT INTO party_bonus (id, team_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
  gain: `INSERT INTO party_scores (id, player_id, session_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
  reponse: `INSERT INTO party_answers (id, session_id, quiz_title, q_index, kind, player_id, answered,
              correct, choice, value, target, ms, changes, points, duration_ms, observed, created_at, category, space_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`,
  partie: `INSERT INTO party_sessions (id, status, participant_ids, state, timers, created_at, updated_at, space_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status,
             participant_ids = excluded.participant_ids, state = excluded.state,
             timers = excluded.timers, updated_at = excluded.updated_at`,
  soiree: `INSERT INTO party_soiree (space_id, id, held_at) VALUES (?, ?, ?)
           ON CONFLICT(space_id) DO UPDATE SET id = excluded.id, held_at = excluded.held_at`,
}

type Valeur = string | number | null

/** Une requête de la file, et ce qu'elle pèse en mémoire tant qu'elle attend. */
interface Ligne {
  stmt: InStatement
  /**
   * Elle retire des lignes. C'est la seule chose qu'une resynchronisation ne
   * sait pas refaire — elle ne fait qu'ajouter —, donc la seule qu'une file
   * qui déborde doit garder.
   */
  efface: boolean
  octets: number
}

function ligne(sql: string, args: Valeur[], efface = false): Ligne {
  // Le texte de la requête est partagé ; ce qui pèse, ce sont les valeurs —
  // l'état d'une partie surtout.
  let octets = 64
  for (const a of args) octets += typeof a === 'string' ? a.length : 8
  return { stmt: { sql, args }, efface, octets }
}

/** Un envoi : une transaction dans la base distante. */
interface Envoi {
  lignes: Ligne[]
  /**
   * L'état de la partie que ces lignes accompagnent. Il part dans la même
   * transaction qu'elles : un réveil qui trouverait les gains d'une
   * révélation sans la révélation elle-même la rejouerait, et paierait deux
   * fois la question.
   */
  etat: { sessionId: string; ligne: Ligne } | null
  /** L'espace entier, relu dans la base locale au moment de partir — pas à celui d'entrer dans la file. */
  resync?: true
  octets: number
}

function envoi(lignes: Ligne[], etat: Envoi['etat'] = null): Envoi {
  return { lignes, etat, octets: poids(lignes, etat) }
}

const RESYNC = (): Envoi => ({ lignes: [], etat: null, resync: true, octets: 0 })

function poids(lignes: Ligne[], etat: Envoi['etat']): number {
  let n = etat?.ligne.octets ?? 0
  for (const l of lignes) n += l.octets
  return n
}

const texte = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

const ligneJoueur = (spaceId: string, p: Omit<PlayerRec, 'createdAt'>, createdAt: number) =>
  ligne(SQL.joueur, [p.id, p.name, p.avatar, p.token, p.teamId, p.profileId, createdAt, spaceId])
const ligneEquipe = (spaceId: string, t: TeamRec) =>
  ligne(SQL.equipe, [t.id, t.name, t.emoji, t.position, t.createdAt, spaceId])
const lignePrix = (spaceId: string, b: TeamBonus) =>
  ligne(SQL.prix, [b.id, b.teamId, b.points, b.reason, b.createdAt, spaceId])
const ligneGain = (spaceId: string, g: GainMiroir) =>
  ligne(SQL.gain, [g.uid, g.playerId, g.sessionId, g.points, g.reason, g.createdAt, spaceId])
const ligneReponse = (spaceId: string, r: ReponseMiroir) =>
  ligne(SQL.reponse, [
    r.uid,
    r.sessionId,
    r.quizTitle,
    r.qIndex,
    r.kind,
    r.playerId,
    r.answered ? 1 : 0,
    r.correct === null ? null : r.correct ? 1 : 0,
    r.choice,
    r.value,
    r.target,
    r.ms,
    r.changes,
    r.points,
    r.durationMs,
    r.observed ? 1 : 0,
    r.createdAt,
    r.category ?? null,
    spaceId,
  ])
const lignePartie = (spaceId: string, s: SessionRow) =>
  ligne(SQL.partie, [s.id, s.status, s.participantIds, s.state, s.timers, s.createdAt, s.updatedAt, spaceId])

/** Une resynchronisation arrêtée entre deux lots par une remise à zéro ou par l'arrêt : ce n'est pas un échec. */
class Interrompue extends Error {}

/**
 * La file d'un espace. Une seule requête en vol à la fois, dans l'ordre où
 * les écritures ont eu lieu en local : un effacement ne double jamais
 * l'ajout qu'il devait suivre, et la base distante reçoit la soirée dans
 * l'ordre où elle s'est jouée.
 */
interface Voie {
  spaceId: string
  file: Envoi[]
  octets: number
  enVol: Promise<void> | null
  reessai: ReturnType<typeof setTimeout> | null
  /** Une « Nouvelle soirée » efface le miroir : plus rien ne part d'ici là. */
  suspendue: boolean
  lot: { profondeur: number; lignes: Ligne[]; etat: Envoi['etat'] } | null
  echecs: number
  enEchecDepuis: number | null
  derniereErreur: string
  dernierSucces: number | null
  enRetard: boolean
  alerte: ReturnType<typeof setTimeout> | null
  surRetard: (() => void) | null
  /** Les noms de soirée partis sans passer par la file, attendus par leur appelant. */
  directes: Set<Promise<void>>
  /** Ceux qu'une remise à zéro retient : relancés si elle échoue, abandonnés si elle passe. */
  retenues: { lancer: () => void; abandonner: (e: Error) => void }[]
  /** Qui attend que tout soit parti — l'arrêt. */
  quandVide: (() => void)[]
  /** La remise à zéro en cours, que la suivante attend. */
  remise: Promise<void>
}

/** Ce que `/healthz` dit du miroir : tous espaces confondus, sans en nommer aucun — la route est publique. */
export interface SanteMiroir {
  /** Requêtes écrites en local et pas encore dans la base distante. */
  enAttente: number
  /** La plus longue série d'échecs en cours. */
  echecsConsecutifs: number
  /** Le début de la plus ancienne panne en cours. */
  enEchecDepuis: string | null
  dernierSucces: string | null
  /** Combien d'écrans communs affichent « Sauvegarde en retard ». */
  espacesEnRetard: number
}

/**
 * Recopie des invités, des équipes, de leurs points et des parties dans la
 * base distante.
 *
 * Sur un hébergeur gratuit, le disque est effacé à chaque réveil : c'est de
 * ce miroir que repart TOUTE soirée d'hier — son bilan relu le lendemain, son
 * rangement dans l'historique. Le moteur de jeu, lui, reste synchrone et
 * rapide : les écritures distantes partent en arrière-plan et ne bloquent
 * jamais une réponse de joueur.
 *
 * On les abandonnait après un simple avertissement au journal : une panne de
 * Turso pendant l'arrivée de Bob et un quiz, et le réveil trouvait Alice à
 * zéro point, Bob inconnu, et plus une réponse. Chaque espace a désormais sa
 * file, ordonnée, qui insiste jusqu'au succès, et :
 *
 * · les gains et les réponses y portent l'identifiant tiré à l'écriture
 *   locale — rejoués, ils ne s'ajoutent pas deux fois ;
 * · les états successifs d'une même partie s'y remplacent — seul le dernier
 *   compte, et c'est ce qui borne la mémoire d'une longue panne ;
 * · au-delà d'un seuil, la file cède la place à une resynchronisation de
 *   l'espace entier, relu dans la base locale ;
 * · et au rétablissement, cette resynchronisation passe de toute façon : si
 *   une écriture a échappé à la file, le miroir la retrouve.
 *
 * Chaque ligne porte l'espace (le compte) dont elle est la soirée : les
 * soirées de plusieurs animateurs cohabitent dans les mêmes tables.
 */
export class PartyBackup {
  private client: Client
  private defaultSpace = ''
  private reglages: Required<Omit<ReglagesMiroir, 'base'>>
  private base: DB | null
  private voies = new Map<string, Voie>()
  /** L'arrêt a commencé : les essais se resserrent. */
  private arret = false
  /** L'arrêt est allé au bout : plus rien ne part. */
  private ferme = false
  private fermeture: Promise<void> | null = null

  constructor(url: string, authToken?: string, reglages: ReglagesMiroir = {}) {
    this.client = clientDistant(url, authToken)
    this.base = reglages.base ?? null
    this.reglages = {
      reessaisMs: reglages.reessaisMs?.length ? reglages.reessaisMs : REGLAGES.reessaisMs,
      alerteMs: reglages.alerteMs ?? REGLAGES.alerteMs,
      seuilOctets: reglages.seuilOctets ?? REGLAGES.seuilOctets,
      delaiExtinctionMs: reglages.delaiExtinctionMs ?? REGLAGES.delaiExtinctionMs,
    }
  }

  /**
   * Crée les tables, puis rattache à l'espace par défaut les lignes d'avant
   * les espaces. Idempotent : rien n'est copié ni effacé.
   */
  async init(defaultSpace: string) {
    this.defaultSpace = defaultSpace
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS party_players (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           avatar     TEXT NOT NULL,
           token      TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           team_id    TEXT,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_teams (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           emoji      TEXT NOT NULL,
           position   INTEGER NOT NULL,
           created_at INTEGER NOT NULL,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_bonus (
           id         TEXT PRIMARY KEY,
           team_id    TEXT NOT NULL,
           points     INTEGER NOT NULL,
           reason     TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_answers (
           id          TEXT PRIMARY KEY,
           session_id  TEXT NOT NULL,
           quiz_title  TEXT NOT NULL,
           q_index     INTEGER NOT NULL,
           kind        TEXT NOT NULL,
           player_id   TEXT NOT NULL,
           answered    INTEGER NOT NULL,
           correct     INTEGER,
           choice      INTEGER,
           value       REAL,
           target      REAL,
           ms          INTEGER,
           changes     INTEGER NOT NULL,
           points      INTEGER NOT NULL,
           duration_ms INTEGER NOT NULL,
           observed    INTEGER NOT NULL,
           created_at  INTEGER NOT NULL,
           space_id    TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_scores (
           id         TEXT PRIMARY KEY,
           player_id  TEXT NOT NULL,
           session_id TEXT,
           points     INTEGER NOT NULL,
           reason     TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           space_id   TEXT
         )`,
        // Les parties de la soirée, question et réponses comprises — la
        // partie en cours, que le réveil reprend là où elle en était, et les
        // parties terminées, dont l'état garde la copie exacte du quiz joué.
        `CREATE TABLE IF NOT EXISTS party_sessions (
           id              TEXT PRIMARY KEY,
           status          TEXT NOT NULL,
           participant_ids TEXT NOT NULL,
           state           TEXT NOT NULL,
           timers          TEXT NOT NULL,
           created_at      INTEGER NOT NULL,
           updated_at      INTEGER NOT NULL,
           space_id        TEXT
         )`,
        // Le nom de la soirée en cours, une ligne par espace. Sans lui, un
        // réveil sur disque effacé le recalculerait sur les invités présents
        // — et si le premier arrivé est parti entre-temps, la soirée
        // changerait de nom : archive et expérience en double.
        `CREATE TABLE IF NOT EXISTS party_soiree (
           space_id TEXT PRIMARY KEY,
           id       TEXT NOT NULL,
           held_at  INTEGER NOT NULL
         )`,
      ],
      'write',
    )
    // Les équipes, puis les espaces, sont arrivés après les premiers essais :
    // une base distante créée avant eux n'a pas ces colonnes.
    await ajouterColonne(this.client, 'party_players', 'team_id', 'TEXT')
    await ajouterColonne(this.client, 'party_players', 'profile_id', 'TEXT')
    for (const table of MIRROR_TABLES) await ajouterColonne(this.client, table, 'space_id', 'TEXT')
    // La catégorie des questions est arrivée après : un miroir d'avant ne l'a pas.
    await ajouterColonne(this.client, 'party_answers', 'category', 'TEXT')
    await this.client.batch(
      [
        ...MIRROR_TABLES.map(table => `CREATE INDEX IF NOT EXISTS idx_${table}_space ON ${table}(space_id)`),
        ...MIRROR_TABLES.map(table => ({ sql: `UPDATE ${table} SET space_id = ? WHERE space_id IS NULL`, args: [defaultSpace] })),
      ],
      'write',
    )
  }

  /** Le miroir d'un espace : les mêmes écritures, chacune signée de l'espace, dans sa file. */
  forSpace(spaceId: string): PartyMirror {
    const voie = this.voieDe(spaceId)
    /** Dans le lot ouvert s'il y en a un — il partira avec l'état de la partie —, seule sinon. */
    const ajouter = (lignes: Ligne[]) => {
      if (lignes.length === 0) return
      if (voie.lot) voie.lot.lignes.push(...lignes)
      else this.pousser(voie, envoi(lignes))
    }
    return {
      savePlayer: (rec, createdAt) => this.pousser(voie, envoi([ligneJoueur(spaceId, rec, createdAt)])),
      saveTeam: rec => this.pousser(voie, envoi([ligneEquipe(spaceId, rec)])),
      saveBonus: rec => this.pousser(voie, envoi([lignePrix(spaceId, rec)])),
      // Les identifiants de partie, de prix, d'invité et d'équipe sont des
      // UUID, uniques entre tous les espaces : les effacements visent la
      // ligne, pas l'espace.
      dropAnswers: (sessionId, qIndex) =>
        ajouter([ligne('DELETE FROM party_answers WHERE session_id = ? AND q_index = ?', [sessionId, qIndex], true)]),
      deleteBonus: bonusId => this.pousser(voie, envoi([ligne('DELETE FROM party_bonus WHERE id = ?', [bonusId], true)])),
      // Le journal d'une question part en un seul lot : cinquante requêtes
      // séparées par question saturaient la liaison pour rien, alors
      // qu'elles arrivent toutes au même instant.
      saveAnswers: rows => ajouter(rows.map(r => ligneReponse(spaceId, r))),
      saveScore: entry => ajouter([ligneGain(spaceId, entry)]),
      saveSession: row => {
        const etat = { sessionId: row.id, ligne: lignePartie(spaceId, row) }
        if (voie.lot) voie.lot.etat = etat
        else this.pousser(voie, envoi([], etat))
      },
      // Chaque registre efface ses lignes. Dans le lot ouvert, s'il y en a un
      // — l'exclusion en ouvre un —, les trois partent ensemble, en une seule
      // transaction : un réveil sur disque effacé ne recharge jamais des
      // gains ou des réponses sans leur invité.
      deletePlayer: playerId => ajouter([ligne('DELETE FROM party_players WHERE id = ?', [playerId], true)]),
      deletePlayerScores: playerId => ajouter([ligne('DELETE FROM party_scores WHERE player_id = ?', [playerId], true)]),
      deletePlayerAnswers: playerId =>
        ajouter([ligne('DELETE FROM party_answers WHERE player_id = ?', [playerId], true)]),
      /** L'équipe disparaît ; ses membres sont mis à jour séparément par `Party`. */
      deleteTeam: teamId => this.pousser(voie, envoi([ligne('DELETE FROM party_teams WHERE id = ?', [teamId], true)])),
      ouvrirLot: () => {
        if (voie.lot) voie.lot.profondeur++
        else voie.lot = { profondeur: 1, lignes: [], etat: null }
      },
      lotCharge: () => !!voie.lot && voie.lot.lignes.length > 0,
      fermerLot: () => {
        const lot = voie.lot
        if (!lot || --lot.profondeur > 0) return
        voie.lot = null
        if (lot.lignes.length > 0 || lot.etat) this.pousser(voie, envoi(lot.lignes, lot.etat))
      },
      saveSoiree: soiree => {
        const stmt: InStatement = { sql: SQL.soiree, args: [spaceId, soiree.id, soiree.heldAt] }
        if (!voie.suspendue) return this.direct(voie, stmt)
        // Une « Nouvelle soirée » efface le miroir en ce moment même : ce nom
        // est peut-être celui de la soirée qu'on efface. Écrit maintenant, il
        // la ferait renaître au prochain réveil. Il attend donc l'issue.
        return new Promise<void>((resolve, reject) =>
          voie.retenues.push({ lancer: () => this.direct(voie, stmt).then(resolve, reject), abandonner: reject }),
        )
      },
      // Deux « Nouvelle soirée » cliquées coup sur coup passent l'une après
      // l'autre : la première reprendrait les envois pendant que la seconde
      // efface encore.
      reset: effacerLocal => {
        const tour = voie.remise.then(() => this.remettreAZero(voie, effacerLocal))
        voie.remise = tour.catch(() => {})
        return tour
      },
      enRetard: () => voie.enRetard,
      // Un seul écouteur par espace : la soirée réveillée après la
      // suppression puis la recréation d'un compte remplace la précédente.
      surRetard: ecouteur => {
        voie.surRetard = ecouteur
      },
    }
  }

  private voieDe(spaceId: string): Voie {
    let voie = this.voies.get(spaceId)
    if (!voie) {
      voie = {
        spaceId,
        file: [],
        octets: 0,
        enVol: null,
        reessai: null,
        suspendue: false,
        lot: null,
        echecs: 0,
        enEchecDepuis: null,
        derniereErreur: '',
        dernierSucces: null,
        enRetard: false,
        alerte: null,
        surRetard: null,
        directes: new Set(),
        retenues: [],
        quandVide: [],
        remise: Promise.resolve(),
      }
      this.voies.set(spaceId, voie)
    }
    return voie
  }

  // ── La file ────────────────────────────────────────────────────────────

  /** La resynchronisation qui attend son tour dans cette file, s'il y en a une. */
  private resyncPrevue(voie: Voie): Envoi | undefined {
    return voie.file.find((e, i) => e.resync && !(i === 0 && voie.enVol))
  }

  private pousser(voie: Voie, nouveau: Envoi) {
    if (this.ferme) return
    const resync = this.resyncPrevue(voie)
    if (resync) {
      // Ce que la resynchronisation relira en local couvre déjà les ajouts :
      // seuls les effacements doivent passer, et AVANT elle — un « retire
      // les réponses de la question 3 » arrivé après qu'elle les a recopiées
      // emporterait aussi celles de la question reposée.
      const effacements = nouveau.lignes.filter(l => l.efface)
      if (effacements.length > 0) {
        const avant = envoi(effacements)
        voie.file.splice(voie.file.indexOf(resync), 0, avant)
        voie.octets += avant.octets
      }
      return this.pomper(voie)
    }
    const dernier = voie.file[voie.file.length - 1]
    if (dernier && this.fusionnable(voie, dernier, nouveau)) {
      // Deux passages de la même partie à la suite : un seul envoi, qui
      // garde toutes les lignes et le dernier état. Pendant une panne, un
      // quiz entier tient ainsi en quelques envois au lieu de centaines.
      voie.octets -= dernier.octets
      dernier.lignes.push(...nouveau.lignes)
      dernier.etat = nouveau.etat
      dernier.octets = poids(dernier.lignes, dernier.etat)
      voie.octets += dernier.octets
    } else {
      if (nouveau.etat && nouveau.lignes.length === 0) this.oublierEtats(voie, nouveau.etat.sessionId)
      voie.file.push(nouveau)
      voie.octets += nouveau.octets
    }
    // Sans base locale d'où tout relire (un script), la file n'a pas d'autre recours que de tout garder.
    if (this.base && voie.octets > this.reglages.seuilOctets) this.deborder(voie)
    this.pomper(voie)
  }

  /** Vrai si `nouveau` peut rejoindre `dernier` sans rien changer à ce que la base distante verra au bout. */
  private fusionnable(voie: Voie, dernier: Envoi, nouveau: Envoi): boolean {
    if (voie.enVol && dernier === voie.file[0]) return false
    if (dernier.resync || !dernier.etat || !nouveau.etat) return false
    if (dernier.etat.sessionId !== nouveau.etat.sessionId) return false
    return dernier.lignes.length + nouveau.lignes.length <= FUSION_MAX_LIGNES
  }

  /**
   * Un nouvel état de la partie rend caducs ceux qui attendaient encore,
   * seuls, dans la file : il les contient. Ceux qui accompagnent des gains
   * restent — ils forment avec eux une seule transaction.
   */
  private oublierEtats(voie: Voie, sessionId: string) {
    for (let i = voie.file.length - 1; i >= 0; i--) {
      const e = voie.file[i]
      if (i === 0 && voie.enVol) continue
      if (!e.resync && e.lignes.length === 0 && e.etat?.sessionId === sessionId) {
        voie.file.splice(i, 1)
        voie.octets -= e.octets
      }
    }
  }

  /**
   * La file dépasse le seuil : plutôt qu'une mémoire sans fond, une
   * resynchronisation de l'espace entier. Elle relira en local, au
   * rétablissement, tout ce que la file aurait envoyé ; seuls les
   * effacements restent en file, dans leur ordre, devant elle.
   */
  private deborder(voie: Voie) {
    const avant = voie.octets
    const enVol = voie.enVol ? voie.file[0] : null
    const effacements = voie.file.slice(enVol ? 1 : 0).flatMap(e => e.lignes.filter(l => l.efface))
    voie.file = enVol ? [enVol] : []
    for (let i = 0; i < effacements.length; i += LIGNES_PAR_LOT) {
      voie.file.push(envoi(effacements.slice(i, i + LIGNES_PAR_LOT)))
    }
    voie.file.push(RESYNC())
    voie.octets = voie.file.reduce((n, e) => n + e.octets, 0)
    console.warn(
      `[sauvegarde] file d’attente trop longue (${Math.round(avant / 1024)} Ko) : elle cède la place à une ` +
        'resynchronisation de l’espace entier, relu dans la base locale dès que la base distante répondra',
    )
  }

  private demanderResync(voie: Voie) {
    if (!this.base || this.ferme || this.resyncPrevue(voie)) return
    voie.file.push(RESYNC())
    this.pomper(voie)
  }

  /** Envoie la tête de file, si rien n'est en vol ni en attente d'un nouvel essai. */
  private pomper(voie: Voie) {
    if (voie.enVol || voie.reessai || voie.suspendue || this.ferme) return
    if (voie.file.length === 0) return this.signalerVide(voie)
    const tete = this.regrouper(voie)
    voie.enVol = this.envoyer(voie, tete).then(
      () => {
        voie.enVol = null
        // Rien ne touche à un envoi en vol : c'est toujours lui, en tête.
        const i = voie.file.indexOf(tete)
        if (i >= 0) {
          voie.file.splice(i, 1)
          voie.octets -= tete.octets
        }
        this.reussite(voie, tete)
        this.pomper(voie)
      },
      (e: unknown) => {
        voie.enVol = null
        // Interrompue par une remise à zéro ou par l'arrêt : c'est à eux de relancer.
        if (e instanceof Interrompue) return this.signalerVide(voie)
        this.echec(voie, e)
        if (voie.suspendue || this.ferme) return
        voie.reessai = setTimeout(() => {
          voie.reessai = null
          this.pomper(voie)
        }, this.delaiReessai(voie))
        voie.reessai.unref?.()
      },
    )
  }

  /**
   * Ce qui attend derrière la tête part avec elle, en un seul paquet, tant
   * qu'il reste raisonnable : cinquante invités qui arrivent d'un coup, ou
   * la file qui repart après une panne, ne font pas cinquante allers-retours
   * — chacun attendrait le précédent. Une seule transaction pour le paquet :
   * les lots qu'il contient restent entiers, et rejouée, elle ne double rien.
   */
  private regrouper(voie: Voie): Envoi {
    const tete = voie.file[0]
    const taille = (e: Envoi) => e.lignes.length + (e.etat ? 1 : 0)
    if (tete.resync) return tete
    let n = taille(tete)
    let k = 1
    while (k < voie.file.length && !voie.file[k].resync && n + taille(voie.file[k]) <= LIGNES_PAR_LOT) {
      n += taille(voie.file[k])
      k++
    }
    if (k === 1) return tete
    const lignes: Ligne[] = []
    for (const e of voie.file.slice(0, k)) {
      lignes.push(...e.lignes)
      if (e.etat) lignes.push(e.etat.ligne)
    }
    const paquet = envoi(lignes)
    voie.file.splice(0, k, paquet)
    return paquet
  }

  private async envoyer(voie: Voie, e: Envoi): Promise<void> {
    if (e.resync) return this.resynchroniser(voie)
    const stmts = e.lignes.map(l => l.stmt)
    if (e.etat) stmts.push(e.etat.ligne.stmt)
    if (stmts.length > 0) await this.client.batch(stmts, 'write')
  }

  private delaiReessai(voie: Voie): number {
    const r = this.reglages.reessaisMs
    const delai = r[Math.min(Math.max(voie.echecs - 1, 0), r.length - 1)]
    // À l'arrêt, chaque seconde compte : l'hébergeur coupe net.
    return this.arret ? Math.min(delai, 200) : delai
  }

  private reussite(voie: Voie, e: Envoi) {
    voie.dernierSucces = Date.now()
    if (voie.enEchecDepuis === null) return
    const duree = Math.round((Date.now() - voie.enEchecDepuis) / 1000)
    console.log(
      `[sauvegarde] base distante rétablie après ${voie.echecs} échec(s) en ${duree} s — ` +
        `${this.compterEnAttente(voie)} écriture(s) encore en file`,
    )
    this.retablie(voie)
    // Rejouer la file suffit d'ordinaire. Mais une écriture a pu lui
    // échapper — file débordée, nom de soirée refusé, arrêt trop court — :
    // l'espace entier repasse derrière elle, par identifiants, sans rien
    // doubler.
    if (!e.resync) this.demanderResync(voie)
  }

  private retablie(voie: Voie) {
    voie.echecs = 0
    voie.enEchecDepuis = null
    voie.derniereErreur = ''
    if (voie.alerte) clearTimeout(voie.alerte)
    voie.alerte = null
    if (voie.enRetard) {
      voie.enRetard = false
      voie.surRetard?.()
    }
  }

  private echec(voie: Voie, e: unknown) {
    voie.echecs++
    const message = e instanceof Error ? e.message : String(e)
    if (voie.enEchecDepuis === null) {
      voie.enEchecDepuis = Date.now()
      voie.alerte = setTimeout(() => this.alerter(voie), this.reglages.alerteMs)
      voie.alerte.unref?.()
      console.warn(`[sauvegarde] écriture distante refusée (${message}) : elle reste en file et repartira — la soirée continue`)
    } else if (message !== voie.derniereErreur) {
      console.warn(`[sauvegarde] toujours en échec, pour une autre raison : ${message}`)
    }
    voie.derniereErreur = message
  }

  /** Assez d'échecs d'affilée pour le dire à l'écran commun — une fois, pas à chaque essai. */
  private alerter(voie: Voie) {
    voie.alerte = null
    if (voie.enEchecDepuis === null || voie.enRetard) return
    voie.enRetard = true
    const duree = Math.round((Date.now() - voie.enEchecDepuis) / 1000)
    console.warn(
      `[sauvegarde] en retard depuis ${duree} s : ${this.compterEnAttente(voie)} écriture(s) en attente, ` +
        `${voie.echecs} échec(s) — l’écran commun le signale`,
    )
    voie.surRetard?.()
  }

  private compterEnAttente(voie: Voie): number {
    let n = voie.retenues.length
    for (const e of voie.file) n += e.lignes.length + (e.etat ? 1 : 0) + (e.resync ? 1 : 0)
    return n
  }

  private signalerVide(voie: Voie) {
    if (voie.file.length > 0 || voie.enVol || voie.directes.size > 0) return
    for (const f of voie.quandVide.splice(0)) f()
  }

  /**
   * Le nom de la soirée part tout de suite, sans attendre la file : son
   * appelant l'attend pour écrire l'expérience ou l'archive, et une file
   * encombrée par une panne tout juste levée le ferait patienter pour rien.
   */
  private direct(voie: Voie, stmt: InStatement): Promise<void> {
    if (this.ferme) return Promise.reject(new Error('le serveur s’éteint'))
    const ecriture = this.client.execute(stmt).then(() => {
      voie.dernierSucces = Date.now()
    })
    const suivie: Promise<void> = ecriture
      .catch(() => {
        // L'appelant apprend l'échec — rien ne doit s'écrire sous ce nom tant
        // qu'il n'est pas à l'abri —, et le nom repasse par la file, qui
        // insistera jusqu'au succès.
        this.pousser(voie, envoi([{ stmt, efface: false, octets: 128 }]))
      })
      .finally(() => {
        voie.directes.delete(suivie)
        this.signalerVide(voie)
      })
    voie.directes.add(suivie)
    return ecriture
  }

  /** Ce qui est parti : la requête de la file en vol, et les noms de soirée. */
  private async attendreEnVol(voie: Voie) {
    while (voie.enVol || voie.directes.size > 0) {
      await Promise.allSettled([voie.enVol, ...voie.directes])
    }
  }

  // ── La resynchronisation ───────────────────────────────────────────────

  /**
   * Recopie l'espace entier depuis la base locale — celle qui fait foi —,
   * sans rien effacer : invités, équipes, prix et nom de la soirée tels
   * quels, parties changées, et les gains et réponses qui manquent, par leur
   * identifiant. Relancée, elle ne double rien.
   *
   * Elle n'efface rien exprès. Les effacements, eux, ne quittent jamais la
   * file ; et une base locale qui ne serait pas la bonne — un PC de secours
   * lancé sur de vieux essais, pointé sur la base de production — ne doit
   * pas pouvoir vider le miroir de la vraie soirée.
   */
  private async resynchroniser(voie: Voie): Promise<void> {
    const base = this.base
    if (!base) return
    const spaceId = voie.spaceId
    // Lu d'un seul tenant, au moment de partir : tout ce qui s'est écrit ici
    // jusque-là y est — ce que la file a laissé tomber en débordant compris.
    const local = lireSoireeLocale(base, spaceId)
    // Ce que le miroir a déjà : rien de ce qui y est à l'identique ne repart.
    // Une resynchronisation qui ne trouve rien à faire n'écrit rien — celle
    // qui suit chaque panne, d'ordinaire.
    const [joueursLoin, equipesLoin, prixLoin, soireeLoin, gainsLoin, reponsesLoin, partiesLoin] = await this.client.batch(
      [
        { sql: 'SELECT id, name, avatar, token, team_id, profile_id FROM party_players WHERE space_id = ?', args: [spaceId] },
        { sql: 'SELECT id, name, emoji FROM party_teams WHERE space_id = ?', args: [spaceId] },
        { sql: 'SELECT id FROM party_bonus WHERE space_id = ?', args: [spaceId] },
        { sql: 'SELECT id, held_at FROM party_soiree WHERE space_id = ?', args: [spaceId] },
        { sql: 'SELECT id FROM party_scores WHERE space_id = ?', args: [spaceId] },
        { sql: 'SELECT id FROM party_answers WHERE space_id = ?', args: [spaceId] },
        { sql: 'SELECT id, status, updated_at FROM party_sessions WHERE space_id = ?', args: [spaceId] },
      ],
      'read',
    )
    /** Chaque ligne du miroir, résumée par les colonnes qu'une écriture peut changer. */
    const empreintes = (r: ResultSet, colonnes: string[]) =>
      new Map(r.rows.map(row => [String(row.id), colonnes.map(c => texte(row[c]) ?? '∅').join('|')]))
    const loin = {
      // Le jeton aussi : une place rendue le renouvelle (`renouvelerJeton`),
      // et l'ancien, resté au miroir, rouvrirait la fiche à l'ancien téléphone.
      joueurs: empreintes(joueursLoin, ['name', 'avatar', 'token', 'team_id', 'profile_id']),
      equipes: empreintes(equipesLoin, ['name', 'emoji']),
      prix: empreintes(prixLoin, []),
      soiree: empreintes(soireeLoin, ['held_at']),
      gains: empreintes(gainsLoin, []),
      reponses: empreintes(reponsesLoin, []),
      parties: empreintes(partiesLoin, ['status', 'updated_at']),
    }
    const pareil = (deja: Map<string, string>, id: unknown, ...valeurs: unknown[]) =>
      deja.get(String(id)) === valeurs.map(v => texte(v) ?? '∅').join('|')

    const lots: InStatement[][] = []
    const decouper = (stmts: InStatement[]) => {
      for (let i = 0; i < stmts.length; i += LIGNES_PAR_LOT) lots.push(stmts.slice(i, i + LIGNES_PAR_LOT))
    }
    decouper(
      [
        ...local.players
          .filter(p => !pareil(loin.joueurs, p.id, p.name, p.avatar, p.token, p.team_id, p.profile_id))
          .map(p =>
            ligneJoueur(
              spaceId,
              {
                id: String(p.id),
                name: String(p.name),
                avatar: String(p.avatar),
                token: String(p.token),
                teamId: texte(p.team_id),
                profileId: texte(p.profile_id),
              },
              Number(p.created_at),
            ),
          ),
        ...local.teams
          .filter(t => !pareil(loin.equipes, t.id, t.name, t.emoji))
          .map(t =>
            ligneEquipe(spaceId, {
              id: String(t.id),
              name: String(t.name),
              emoji: String(t.emoji),
              position: Number(t.position),
              createdAt: Number(t.created_at),
            }),
          ),
        ...local.bonuses
          .filter(b => !loin.prix.has(String(b.id)))
          .map(b =>
            lignePrix(spaceId, {
              id: String(b.id),
              teamId: String(b.team_id),
              points: Number(b.points),
              reason: String(b.reason),
              createdAt: Number(b.created_at),
            }),
          ),
        ...(local.soiree && !pareil(loin.soiree, local.soiree.id, local.soiree.held_at)
          ? [ligne(SQL.soiree, [spaceId, local.soiree.id, local.soiree.held_at])]
          : []),
      ].map(l => l.stmt),
    )

    // Les lignes qui manquent, rangées par partie.
    const manquantes = new Map<string, InStatement[]>()
    const ranger = (sessionId: unknown, l: Ligne) => {
      const cle = texte(sessionId) ?? ''
      const deLaPartie = manquantes.get(cle)
      if (deLaPartie) deLaPartie.push(l.stmt)
      else manquantes.set(cle, [l.stmt])
    }
    let nManquantes = 0
    for (const g of local.scores) {
      if (loin.gains.has(String(g.uid))) continue
      nManquantes++
      ranger(
        g.session_id,
        ligneGain(spaceId, {
          uid: String(g.uid),
          playerId: String(g.player_id),
          sessionId: texte(g.session_id),
          points: Number(g.points),
          reason: String(g.reason),
          createdAt: Number(g.created_at),
        }),
      )
    }
    for (const r of local.answers) {
      if (loin.reponses.has(String(r.uid))) continue
      nManquantes++
      ranger(r.session_id, ligneReponse(spaceId, { ...toRow(r), uid: String(r.uid) }))
    }

    // Chaque partie avec ses lignes, la partie en cours en dernier, et son
    // état EN TÊTE de ses lignes : quand elles tiennent en un lot — le cas
    // d'une panne ordinaire —, tout part d'un bloc. Sinon, mieux vaut un
    // réveil qui trouve la révélation sans tous ses gains qu'un réveil qui
    // trouve les gains sans la révélation, et paie la question deux fois.
    const enDernier = (s: Record<string, unknown>) => (s.status === 'running' ? 1 : 0)
    for (const s of [...local.sessions].sort((a, b) => enDernier(a) - enDernier(b))) {
      const id = String(s.id)
      const etat = pareil(loin.parties, id, s.status, s.updated_at)
        ? []
        : [
            lignePartie(spaceId, {
              id,
              spaceId,
              status: s.status === 'running' ? 'running' : 'ended',
              participantIds: String(s.participant_ids),
              state: String(s.state),
              timers: String(s.timers),
              createdAt: Number(s.created_at),
              updatedAt: Number(s.updated_at),
            }).stmt,
          ]
      decouper([...etat, ...(manquantes.get(id) ?? [])])
      manquantes.delete(id)
    }
    // Celles dont la partie n'est plus sur ce disque : d'avant les espaces, ou purgée.
    for (const reste of manquantes.values()) decouper(reste)

    for (const lot of lots) {
      if (voie.suspendue || this.ferme) throw new Interrompue()
      await this.client.batch(lot, 'write')
    }
    if (nManquantes > 0) {
      console.log(`[sauvegarde] espace resynchronisé : ${nManquantes} gain(s) ou réponse(s) manquaient au miroir`)
    }
  }

  // ── La remise à zéro ───────────────────────────────────────────────────

  /**
   * « Nouvelle soirée », du côté du miroir — dans l'ordre qui ne ment jamais.
   *
   * On vidait la base locale d'abord : quand l'effacement distant échouait,
   * l'animateur lisait « Rien n'a été effacé » devant une salle vide, et
   * l'ancienne soirée, restée au miroir, ressuscitait au premier réveil.
   *
   * 1. Plus rien ne part : ce qui s'écrit pendant ce temps appartient à la
   *    soirée qu'on efface.
   * 2. Ce qui est déjà en vol va jusqu'au bout — arrivé après l'effacement,
   *    il la ferait renaître.
   * 3. Le miroir s'efface. S'il refuse, l'erreur remonte : la file reprend
   *    comme si de rien n'était, et rien de local n'a bougé.
   * 4. Seulement alors, la file se vide — c'était la soirée effacée — et
   *    l'appelant efface la sienne, pendant que la file est encore
   *    suspendue : ce qu'il écrit en le faisant (la fin de la partie en
   *    cours) est jeté avec le reste.
   * 5. La file reprend.
   */
  private async remettreAZero(voie: Voie, effacerLocal?: () => void): Promise<void> {
    voie.suspendue = true
    if (voie.reessai) clearTimeout(voie.reessai)
    voie.reessai = null
    let efface = false
    try {
      await this.attendreEnVol(voie)
      try {
        await this.client.batch(
          [...MIRROR_TABLES, 'party_soiree'].map(table => ({
            sql: `DELETE FROM ${table} WHERE space_id = ?`,
            args: [voie.spaceId],
          })),
          'write',
        )
      } catch (e) {
        console.error(`[sauvegarde] la base distante refuse d’effacer la soirée : ${e instanceof Error ? e.message : e}`)
        // Un message pour l'écran commun : il suit « Rien n’a été effacé : ».
        throw new Error('la sauvegarde en ligne ne répond pas — réessaie dans un instant', { cause: e })
      }
      efface = true
      voie.dernierSucces = Date.now()
      this.viderFile(voie)
      // Elle a répondu : si elle était en panne, elle ne l'est plus, et il n'y a plus rien à rattraper.
      if (voie.enEchecDepuis !== null) this.retablie(voie)
      effacerLocal?.()
      this.viderFile(voie)
    } finally {
      voie.suspendue = false
      for (const r of voie.retenues.splice(0)) {
        if (efface) r.abandonner(new Error('la soirée a été remise à zéro entre-temps'))
        else r.lancer()
      }
      this.pomper(voie)
    }
  }

  private viderFile(voie: Voie) {
    voie.file = []
    voie.octets = 0
    this.signalerVide(voie)
  }

  // ── Le réveil ──────────────────────────────────────────────────────────

  /**
   * Recharge les soirées dans la base locale si celle-ci est vide — c'est-à-dire
   * après un redémarrage qui a effacé le disque. Une base locale déjà peuplée
   * fait autorité : on ne veut pas écraser une partie en cours. Tous les
   * espaces reviennent d'un coup, chaque ligne avec le sien.
   *
   * Les gains et les réponses gardent leur identifiant : c'est lui que la
   * file reprendra si le miroir doit être complété, sans rien doubler. Les
   * parties terminées reviennent aussi, avec la copie exacte de leur quiz ;
   * le moteur, lui, ne reprend que celle qui était en cours.
   */
  async restoreInto(
    db: DB,
  ): Promise<{ players: number; teams: number; scores: number; answers: number; sessions: number; spaces: number }> {
    const none = { players: 0, teams: 0, scores: 0, answers: 0, sessions: 0, spaces: 0 }
    const local = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }
    const localTeams = db.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }
    if (local.n > 0 || localTeams.n > 0) return none

    const teams = await this.client.execute('SELECT * FROM party_teams ORDER BY position')
    const players = await this.client.execute('SELECT * FROM party_players')
    const scores = await this.client.execute('SELECT * FROM party_scores ORDER BY created_at')
    const bonuses = await this.client.execute('SELECT * FROM party_bonus ORDER BY created_at')
    const answers = await this.client.execute('SELECT * FROM party_answers ORDER BY created_at, q_index')
    const sessions = await this.client.execute('SELECT * FROM party_sessions ORDER BY created_at')
    const soirees = await this.client.execute('SELECT space_id, id, held_at FROM party_soiree')
    // Une soirée dont tous les invités ont été exclus garde son nom : ceux
    // qui arriveront ensuite sont de la même soirée, pas d'une nouvelle.
    if (players.rows.length === 0 && teams.rows.length === 0 && soirees.rows.length === 0) return none

    const spaceOf = (r: Record<string, unknown>) =>
      r.space_id === null || r.space_id === undefined ? this.defaultSpace : String(r.space_id)
    const spaces = new Set<string>()

    const insertTeam = db.prepare(
      'INSERT OR IGNORE INTO teams (id, name, emoji, position, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertPlayer = db.prepare(
      'INSERT OR IGNORE INTO players (id, name, avatar, token, team_id, profile_id, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    const insertScore = db.prepare(
      'INSERT OR IGNORE INTO score_entries (uid, player_id, session_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    const insertBonus = db.prepare(
      'INSERT OR IGNORE INTO team_bonus (id, team_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertAnswer = db.prepare(
      `INSERT OR IGNORE INTO answer_log (uid, session_id, quiz_title, q_index, kind, player_id, answered, correct,
         choice, value, target, ms, changes, points, duration_ms, observed, created_at, category, space_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertSession = db.prepare(
      `INSERT OR IGNORE INTO sessions (id, status, participant_ids, state, timers, created_at, updated_at, space_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertSoiree = db.prepare('INSERT OR IGNORE INTO soiree (space_id, id, held_at) VALUES (?, ?, ?)')
    let running = 0
    db.transaction(() => {
      // Le nom de chaque soirée revient avec elle. Sans lui, on le
      // recalculerait sur les invités rechargés — et le premier arrivé a pu
      // être exclu entre-temps.
      for (const r of soirees.rows) insertSoiree.run(String(r.space_id), String(r.id), Number(r.held_at))
      for (const r of sessions.rows) {
        if (r.status === 'running') running++
        insertSession.run(
          String(r.id),
          r.status === 'running' ? 'running' : 'ended',
          String(r.participant_ids),
          String(r.state),
          String(r.timers),
          Number(r.created_at),
          Number(r.updated_at),
          spaceOf(r),
        )
      }
      for (const r of teams.rows) {
        spaces.add(spaceOf(r))
        insertTeam.run(String(r.id), String(r.name), String(r.emoji), Number(r.position), Number(r.created_at), spaceOf(r))
      }
      for (const r of players.rows) {
        spaces.add(spaceOf(r))
        insertPlayer.run(
          String(r.id),
          String(r.name),
          String(r.avatar),
          String(r.token),
          texte(r.team_id),
          texte(r.profile_id),
          Number(r.created_at),
          spaceOf(r),
        )
      }
      for (const r of scores.rows) {
        insertScore.run(
          String(r.id),
          String(r.player_id),
          texte(r.session_id),
          Number(r.points),
          String(r.reason),
          Number(r.created_at),
          spaceOf(r),
        )
      }
      for (const r of bonuses.rows) {
        insertBonus.run(String(r.id), String(r.team_id), Number(r.points), String(r.reason), Number(r.created_at), spaceOf(r))
      }
      for (const raw of answers.rows) {
        const r = toRow(raw)
        insertAnswer.run(
          String(raw.id),
          r.sessionId,
          r.quizTitle,
          r.qIndex,
          r.kind,
          r.playerId,
          r.answered ? 1 : 0,
          r.correct === null ? null : r.correct ? 1 : 0,
          r.choice,
          r.value,
          r.target,
          r.ms,
          r.changes,
          r.points,
          r.durationMs,
          r.observed ? 1 : 0,
          r.createdAt,
          r.category ?? null,
          spaceOf(raw),
        )
      }
    })()
    return {
      players: players.rows.length,
      teams: teams.rows.length,
      scores: scores.rows.length,
      answers: answers.rows.length,
      sessions: running,
      spaces: spaces.size,
    }
  }

  // ── La santé, l'arrêt ──────────────────────────────────────────────────

  /** Le résumé de `/healthz`. */
  sante(): SanteMiroir {
    let enAttente = 0
    let echecs = 0
    let depuis: number | null = null
    let dernier: number | null = null
    let enRetard = 0
    for (const voie of this.voies.values()) {
      enAttente += this.compterEnAttente(voie)
      echecs = Math.max(echecs, voie.echecs)
      if (voie.enEchecDepuis !== null) depuis = Math.min(depuis ?? voie.enEchecDepuis, voie.enEchecDepuis)
      if (voie.dernierSucces !== null) dernier = Math.max(dernier ?? 0, voie.dernierSucces)
      if (voie.enRetard) enRetard++
    }
    const date = (t: number | null) => (t === null ? null : new Date(t).toISOString())
    return {
      enAttente,
      echecsConsecutifs: echecs,
      enEchecDepuis: date(depuis),
      dernierSucces: date(dernier),
      espacesEnRetard: enRetard,
    }
  }

  /**
   * Attend les écritures déjà parties — avant d'effacer un espace, pour
   * qu'une recopie tardive ne le remplisse pas à nouveau. Pas la file : une
   * base en panne la retiendrait indéfiniment.
   */
  async settle(): Promise<void> {
    await Promise.allSettled([...this.voies.values()].flatMap(v => [v.enVol, ...v.directes]))
  }

  /**
   * L'arrêt : la file se vide dans le délai que l'hébergeur laisse, puis ce
   * qui reste est abandonné — et dit au journal, avec son nombre. Sur un
   * disque qu'on efface, c'est ce qu'on perd : on ne le tait pas.
   */
  close(): Promise<void> {
    this.fermeture ??= this.fermer()
    return this.fermeture
  }

  private async fermer() {
    this.arret = true
    const limite = Date.now() + this.reglages.delaiExtinctionMs
    // Ce qui attendait son prochain essai part tout de suite.
    for (const voie of this.voies.values()) {
      if (voie.reessai) clearTimeout(voie.reessai)
      voie.reessai = null
      this.pomper(voie)
    }
    let minuteur: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      Promise.all([...this.voies.values()].map(v => new Promise<void>(r => (v.quandVide.push(r), this.signalerVide(v))))),
      new Promise<void>(r => (minuteur = setTimeout(r, Math.max(0, limite - Date.now())))),
    ])
    clearTimeout(minuteur)
    this.ferme = true
    let restant = 0
    let espaces = 0
    for (const voie of this.voies.values()) {
      if (voie.reessai) clearTimeout(voie.reessai)
      if (voie.alerte) clearTimeout(voie.alerte)
      voie.reessai = voie.alerte = null
      const n = this.compterEnAttente(voie)
      if (n > 0) {
        restant += n
        espaces++
      }
      for (const r of voie.retenues.splice(0)) r.abandonner(new Error('le serveur s’éteint'))
    }
    if (restant > 0) {
      console.warn(
        `[sauvegarde] extinction : ${restant} écriture(s) abandonnée(s) dans ${espaces} espace(s) — ` +
          'la base distante n’a pas répondu à temps',
      )
    }
    this.client.close()
  }
}

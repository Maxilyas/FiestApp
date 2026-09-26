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
import { clientDistant, type Client } from './distante'
import type { ProfileRec, ProfileStore } from '../auth/profiles'
import { GRACE_MS, POINTS_MAX_PAR_QUESTION, pointsDuChoix, tempsDeLecture } from '../games/quiz'
import { lireModeles } from './seed'
import { normalizeQuestions, toPlayable, type PlayableQuestion, type QuizQuestionDef } from '../../../shared/library'
import { preparerPartie, suiteFixe } from '../../../shared/hasard'
import { classer } from '../../../shared/classement'
import { nomsAffiches, sansAccent } from '../../../shared/homonymes'
import { tronquer } from '../../../shared/avatars'
import {
  QUESTIONS_PAR_JOUR,
  jourAvant,
  jourDe,
  jourValide,
  medailleDe,
  moisDe,
  serieDe,
  xpDuJour,
  xpDuPodium,
  type ClassementDuJour,
  type LigneDuJour,
  type PartieDuJour,
  type QuestionDuJour,
  type RevelationDuJour,
} from '../../../shared/jour'

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
}

/** Une ligne de classement avec ce qu'il faut pour la trier et la nommer. */
interface Joueur {
  profil: ProfileRec
  points: number
  enCours: boolean
  commenceeLe: number
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
 * Combien de profils se lisent, ou se recomptent, en même temps. Au réveil
 * de l'hébergeur, chaque profil d'un classement coûte trois allers-retours
 * vers la base permanente : en série, cinquante joueurs faisaient attendre
 * plusieurs secondes le premier qui ouvrait la page.
 */
const PROFILS_EN_VOL = 8

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
  /** Le dernier jour dont on sait qu'il n'y a plus rien à clore avant lui. */
  private closJusqua = ''
  /** Les classements, gardés tant que rien n'a bougé : chaque téléphone qui finit sa partie le demande. */
  private revision = 0
  private classementsGardes = new Map<string, { revision: number; joueurs: Joueur[] }>()

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
    for (const r of (await this.client.execute('SELECT profile_id FROM jour_masques')).rows) this.masques.add(String(r.profile_id))
    await this.amorcer()
  }

  close() {
    this.client.close()
  }

  // ── La réserve ──────────────────────────────────────────────────────────

  /**
   * Au tout premier démarrage, la réserve prend les questions des quiz livrés
   * qui se jouent seuls — culture générale, vrai ou faux… —, jamais ceux à
   * personnaliser (« L'anniversaire de [Prénom] »), ni ceux des animateurs :
   * leurs invités y liraient la prochaine soirée. Une fois : une question
   * retirée ne revient pas au démarrage suivant.
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
    const { ajoutees } = await this.ajouter(questions, 'livre')
    await this.client.execute({ sql: 'INSERT OR IGNORE INTO jour_meta (cle, valeur) VALUES (?, ?)', args: ['amorcee', String(ajoutees)] })
    if (ajoutees > 0) console.log(`[jour] réserve amorcée : ${ajoutees} questions des quiz livrés`)
  }

  /**
   * Ajoute des questions à la réserve. Celles que le quiz du jour ne sait pas
   * jouer, et celles qu'elle a déjà, sont écartées — et dites.
   */
  async ajouter(
    questions: readonly QuizQuestionDef[],
    source: 'livre' | 'liste' | 'ia',
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
      ],
      'write',
    )
    return { ajoutees: neuves.length, ecartees }
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

  /** Les prochaines questions, dans l'ordre où la réserve les tirera — pour l'administrateur seul. */
  async prochaines(): Promise<{ id: string; question: QuizQuestionDef; source: string }[]> {
    const res = await this.client.execute({
      sql: `SELECT id, question, source FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL
            ORDER BY ajoutee_le, id LIMIT ?`,
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
    const res = await this.client.execute({ sql: 'SELECT questions, annulees FROM jour_tirages WHERE jour = ?', args: [jour] })
    const r = res.rows[0]
    if (!r) return null
    return { jour, questions: JSON.parse(String(r.questions)), annulees: lireNombres(r.annulees) }
  }

  private async tirer(jour: string): Promise<Tirage | null> {
    const neuves = await this.client.execute({
      sql: `SELECT id, question, categorie FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NULL
            ORDER BY ajoutee_le, id LIMIT 300`,
      args: [],
    })
    const lignes = neuves.rows.map(r => ({ id: String(r.id), question: String(r.question), categorie: r.categorie == null ? null : String(r.categorie) }))
    let choisies = choisir(lignes, QUESTIONS_PAR_JOUR)
    if (choisies.length < QUESTIONS_PAR_JOUR) {
      // À sec : les plus anciennes reviennent, jamais un jour vide — mais pas
      // celles du mois.
      const anciennes = await this.client.execute({
        sql: `SELECT id, question, categorie FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NOT NULL AND posee_le < ?
              ORDER BY posee_le, ajoutee_le, id LIMIT ?`,
        args: [jourAvant(jour, JOURS_AVANT_DE_REPOSER), QUESTIONS_PAR_JOUR - choisies.length],
      })
      choisies = [
        ...choisies,
        ...anciennes.rows.map(r => ({ id: String(r.id), question: String(r.question), categorie: r.categorie == null ? null : String(r.categorie) })),
      ]
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
      const [partie, revelation] = tirage ? await this.aJour(profil.id, tirage) : [null, undefined]
      return this.vueDe(profil, jour, tirage, partie, revelation)
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
      const maintenant = this.maintenant()
      const res = await this.client.execute({
        sql: `INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le) VALUES (?, ?, ?, 0, ?)`,
        args: [profil.id, jour, maintenant, maintenant],
      })
      if (res.rowsAffected > 0) this.revision++
      // Déjà commencée — l'autre téléphone, un double toucher : la partie
      // reprend où elle en était, sans rien rejouer.
      const [partie, revelation] = await this.aJour(profil.id, tirage)
      return this.vueDe(profil, jour, tirage, partie, revelation)
    })
  }

  /**
   * La question suivante. Déjà montrée — un double toucher, un téléphone qui
   * revient —, elle garde son échéance : rien ne se rejoue en rechargeant.
   */
  async suivante(profil: ProfileRec): Promise<PartieDuJour> {
    const jour = jourDe(this.maintenant())
    return this.avecVerrou(profil.id, async () => {
      const tirage = await this.tirage(jour)
      if (!tirage) return this.vueDe(profil, jour, null, null)
      const [avant, revelation] = await this.aJour(profil.id, tirage)
      // Une question vient d'expirer : on la révèle d'abord, la suivante attend son geste.
      if (revelation || !avant) return this.vueDe(profil, jour, tirage, avant, revelation)
      await this.client.execute({
        sql: `UPDATE jour_parties SET servie_le = ? WHERE profile_id = ? AND jour = ? AND servie_le IS NULL AND finie_le IS NULL AND question < ?`,
        args: [this.maintenant(), profil.id, jour, tirage.questions.length],
      })
      return this.vueDe(profil, jour, tirage, await this.partieDe(profil.id, jour))
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
      await this.enregistrer(partie, tirage, aTemps ? retenu : null, ms)
      const revelation = await this.revelationDe(profil.id, tirage, index)
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
    await this.enregistrer(partie, tirage, null, null)
    const suite = await this.partieDe(partie.profileId, partie.jour)
    return suite ? [suite, await this.revelationDe(partie.profileId, tirage, partie.question)] : null
  }

  /** Écrit une réponse — ou son absence — et fait avancer la partie, points et expérience compris. */
  private async enregistrer(partie: Partie, tirage: Tirage, choix: number | null, ms: number | null) {
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
      ],
      'write',
    )
    if (res[1].rowsAffected === 0) return
    this.revision++
    await this.ecrireXp(partie.profileId)
  }

  /** Ce que la réponse à une question lui apprend. */
  private async revelationDe(profileId: string, tirage: Tirage, index: number): Promise<RevelationDuJour> {
    const q = tirage.questions[index]
    const [sienne, salle, partie] = await this.client.batch(
      [
        { sql: 'SELECT choix, juste, points FROM jour_reponses WHERE profile_id = ? AND jour = ? AND question = ?', args: [profileId, tirage.jour, index] },
        { sql: 'SELECT COUNT(*) AS n, COALESCE(SUM(juste), 0) AS justes FROM jour_reponses WHERE jour = ? AND question = ?', args: [tirage.jour, index] },
        { sql: 'SELECT points FROM jour_parties WHERE profile_id = ? AND jour = ?', args: [profileId, tirage.jour] },
      ],
      'read',
    )
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
    const r = res.rows[0]
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
    }
  }

  /** La partie telle que le téléphone la reçoit : jamais une bonne réponse avant qu'il ait répondu. */
  private async vueDe(
    profil: ProfileRec,
    jour: string,
    tirage: Tirage | null,
    partie: Partie | null,
    revelation?: RevelationDuJour,
  ): Promise<PartieDuJour> {
    const [serie, vainqueursDHier, sonHier] = await Promise.all([
      this.serieDe(profil.id, jour),
      this.vainqueursDe(jourAvant(jour)),
      this.sonJour(profil, jourAvant(jour)),
    ])
    if (!tirage) {
      return {
        jour,
        maintenant: this.maintenant(),
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
        vainqueursDHier,
        sonHier,
      }
    }
    const total = tirage.questions.length
    const comptees = total - tirage.annulees.length
    const categories = [...new Set(tirage.questions.map(q => q.categorie).filter((c): c is string => !!c))]
    const joueurs = await this.joueursDu(jour, profil.id)
    const nom = nommer(joueurs)
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
      medaille: partie?.finieLe ? medailleDe(partie.justes, comptees) : null,
      rang: moi && partie ? moi.rang : 0,
      joueurs: joueurs.length,
      ...(devant && moi && { devant: { nom: nom(devant.item), ecart: devant.item.points - moi.item.points } }),
      pointsPossibles: possiblesDe(tirage),
      comptees,
      serie,
      vainqueursDHier,
      sonHier,
    }
    if (partie && etat === 'en-cours') {
      if (partie.servieLe !== null) vue = { ...vue, question: questionVue(tirage, partie.question, partie.servieLe) }
      else if (revelation) vue = { ...vue, revelation }
      else if (partie.question > 0) vue = { ...vue, revelation: await this.revelationDe(profil.id, tirage, partie.question - 1) }
    }
    if (partie && etat === 'finie' && revelation) vue = { ...vue, revelation }
    return vue
  }

  // ── Le classement ───────────────────────────────────────────────────────

  /**
   * Ceux qui ont joué ce jour-là, profils fermés et masqués écartés — sauf
   * `pour`, qui se voit toujours : un profil masqué n'en est pas averti.
   */
  private async joueursDu(jour: string, pour: string | null): Promise<Joueur[]> {
    const garde = this.classementsGardes.get(jour)
    let tous = garde && garde.revision === this.revision ? garde.joueurs : null
    if (!tous) {
      const res = await this.client.execute({ sql: 'SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = ?', args: [jour] })
      const profils = await parLots(res.rows, PROFILS_EN_VOL, r => this.deps.profiles.byId(String(r.profile_id)))
      const lus: Joueur[] = []
      res.rows.forEach((r, i) => {
        const profil = profils[i]
        if (profil) lus.push({ profil, points: Number(r.points), enCours: r.finie_le == null, commenceeLe: Number(r.commencee_le) })
      })
      tous = lus
      this.classementsGardes.set(jour, { revision: this.revision, joueurs: tous })
      if (this.classementsGardes.size > 8) this.classementsGardes.delete(this.classementsGardes.keys().next().value!)
    }
    return tous.filter(j => !this.masques.has(j.profil.id) || j.profil.id === pour)
  }

  /** Le classement d'un jour : tout le serveur, les règles des soirées — rang partagé, « Camille (2) ». */
  async classementDuJour(jour: string, pour: string | null): Promise<ClassementDuJour> {
    await this.clorePasses(jourDe(this.maintenant()))
    const joueurs = await this.joueursDu(jour, pour)
    return { ...this.lignes(joueurs, jour, pour), fige: await this.estClos(jour) }
  }

  /** Le classement d'un mois : les points de tous ses jours, additionnés. */
  async classementDuMois(mois: string, pour: string | null): Promise<ClassementDuJour> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, SUM(points) AS points, MIN(commencee_le) AS commencee_le FROM jour_parties
            WHERE jour >= ? AND jour <= ? GROUP BY profile_id`,
      args: [`${mois}-01`, `${mois}-31`],
    })
    const profils = await parLots(res.rows, PROFILS_EN_VOL, r => this.deps.profiles.byId(String(r.profile_id)))
    const joueurs: Joueur[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (!profil || (this.masques.has(profil.id) && profil.id !== pour)) return
      joueurs.push({ profil, points: Number(r.points), enCours: false, commenceeLe: Number(r.commencee_le) })
    })
    return { ...this.lignes(joueurs, mois, pour), fige: moisDe(jourDe(this.maintenant())) > mois }
  }

  private lignes(joueurs: readonly Joueur[], periode: string, pour: string | null): Omit<ClassementDuJour, 'fige'> {
    const nom = nommer(joueurs)
    const classes = classer(joueurs, j => j.points, nom, j => j.profil.id)
    const ligne = ({ item: j, rang }: { item: Joueur; rang: number }): LigneDuJour => {
      const { niveau, finition, eclat, legendaire } = this.deps.profiles.apparenceDe(j.profil)
      return {
        profileId: j.profil.id,
        nom: nom(j),
        avatar: j.profil.avatar,
        niveau,
        finition,
        ...(legendaire && { legendaire }),
        ...(eclat && { eclat: true as const }),
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
    const res = await this.client.execute({ sql: 'SELECT profile_id FROM jour_podiums WHERE jour = ? AND rang = 1', args: [jour] })
    if (res.rows.length === 0) return []
    const premiers = new Set(res.rows.map(r => String(r.profile_id)))
    const joueurs = await this.joueursDu(jour, null)
    const nom = nommer(joueurs)
    return joueurs
      .filter(j => premiers.has(j.profil.id))
      .map(j => ({ nom: nom(j), avatar: j.profil.avatar }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }

  /** Son jour d'hier, pour le lendemain : sa place, ses points, ce que le podium lui a payé. */
  private async sonJour(profil: ProfileRec, jour: string): Promise<PartieDuJour['sonHier']> {
    const partie = await this.partieDe(profil.id, jour)
    if (!partie) return null
    const [tirage, podium] = await Promise.all([
      this.tirageLu(jour),
      this.client.execute({ sql: 'SELECT xp FROM jour_podiums WHERE jour = ? AND profile_id = ?', args: [jour, profil.id] }),
    ])
    const joueurs = await this.joueursDu(jour, profil.id)
    const classes = classer(joueurs, j => j.points, j => j.profil.name, j => j.profil.id)
    const rang = classes.find(c => c.item.profil.id === profil.id)?.rang ?? 0
    const comptees = tirage ? tirage.questions.length - tirage.annulees.length : 0
    return {
      rang,
      joueurs: joueurs.length,
      points: partie.points,
      xpPodium: Number(podium.rows[0]?.xp ?? 0),
      medaille: medailleDe(partie.justes, comptees),
    }
  }

  // ── La série ────────────────────────────────────────────────────────────

  /** Les jours d'affilée où il a joué — au quiz du jour, ou en soirée. */
  private async serieDe(profileId: string, aujourdhui: string): Promise<number> {
    const depuis = jourAvant(aujourdhui, 400)
    const [jours, soirees] = await this.client.batch(
      [
        { sql: 'SELECT jour FROM jour_parties WHERE profile_id = ? AND jour >= ?', args: [profileId, depuis] },
        {
          sql: `SELECT created_at FROM profile_xp WHERE profile_id = ? AND soiree_id NOT IN ('#paliers', '#jour') AND created_at >= ?`,
          args: [profileId, Date.UTC(Number(depuis.slice(0, 4)), Number(depuis.slice(5, 7)) - 1, Number(depuis.slice(8, 10)))],
        },
      ],
      'read',
    )
    const joues = new Set<string>([...jours.rows.map(r => String(r.jour)), ...soirees.rows.map(r => jourDe(Number(r.created_at)))])
    return serieDe(joues, aujourdhui)
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
    if (this.closJusqua >= hier) return
    await this.avecVerrou('#nuit', async () => {
      if (this.closJusqua >= hier) return
      const res = await this.client.execute({
        sql: `SELECT DISTINCT jour FROM jour_parties WHERE jour < ? AND jour NOT IN (SELECT jour FROM jour_clotures) ORDER BY jour`,
        args: [aujourdhui],
      })
      for (const r of res.rows) await this.clore(String(r.jour))
      this.closJusqua = hier
    })
  }

  /**
   * Fige un jour : son classement devient définitif, son podium est payé —
   * 25, 15 et 10, une marche de moins que la salle —, une seule fois. Un
   * profil masqué n'y monte pas ; celui qui n'a rien marqué non plus.
   */
  private async clore(jour: string) {
    if (await this.estClos(jour)) return
    const joueurs = await this.joueursDu(jour, null)
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
    this.revision++
    for (const p of podium) await this.avecVerrou(p.profileId, () => this.ecrireXp(p.profileId))
    console.log(`[jour] ${jour} clos : ${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}, ${podium.length} sur le podium`)
  }

  /**
   * Toute son expérience du quiz du jour, parties et podiums, recopiée dans
   * sa ligne (`LIGNE_JOUR`) — toujours sous le verrou du profil : lue puis
   * écrite, elle laisserait sinon une somme périmée par-dessus la bonne.
   */
  private async ecrireXp(profileId: string) {
    const [parties, podiums] = await this.client.batch(
      [
        { sql: 'SELECT COALESCE(SUM(xp), 0) AS xp, COUNT(*) AS n FROM jour_parties WHERE profile_id = ?', args: [profileId] },
        { sql: 'SELECT COALESCE(SUM(xp), 0) AS xp FROM jour_podiums WHERE profile_id = ?', args: [profileId] },
      ],
      'read',
    )
    const xp = Number(parties.rows[0]?.xp ?? 0) + Number(podiums.rows[0]?.xp ?? 0)
    await this.deps.profiles.ecrireXpDuJour(profileId, xp, Number(parties.rows[0]?.n ?? 0))
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
    this.revision++
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
    await this.ecrireXp(profileId)
  }

  /** Masque un profil du classement — ou l'y remet. Il n'en est pas averti. */
  async masquer(profileId: string, masque: boolean): Promise<void> {
    await this.client.execute(
      masque
        ? { sql: 'INSERT OR IGNORE INTO jour_masques (profile_id, masque_le) VALUES (?, ?)', args: [profileId, this.maintenant()] }
        : { sql: 'DELETE FROM jour_masques WHERE profile_id = ?', args: [profileId] },
    )
    if (masque) this.masques.add(profileId)
    else this.masques.delete(profileId)
    this.revision++
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
      avatar: String(r.avatar),
      masque: this.masques.has(String(r.id)),
    }))
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
function nommer(joueurs: readonly Joueur[]): (j: Joueur) => string {
  const arrivee = [...joueurs].sort((a, b) => a.commenceeLe - b.commenceeLe || a.profil.id.localeCompare(b.profil.id))
  const marques = nomsAffiches(arrivee.map(j => ({ id: j.profil.id, name: j.profil.name, avatar: j.profil.avatar })))
  return j => marques.get(j.profil.id) ?? j.profil.name
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

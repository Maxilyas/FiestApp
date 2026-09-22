import type { DB } from './db'
import type { IoServer } from './types'
import { Party } from './party'
import { Teams } from './teams'
import { ScoreLedger } from './scores'
import { AnswerLog } from './answers'
import { GameEngine } from './engine'
import type { PartyBackup, PartyMirror } from './backup'
import type { ArchiveStore } from './archive'
import { buildArchive } from './archive'
import { buildRecap } from './recap'
import { buildReview, type PlayedPack } from './review'
import { buildProgress } from './progress'
import { computeStats } from './stats'
import { playedPackOf, quizLibrary, quizModule } from '../games/quiz'
import type { AuthStore } from '../auth/store'
import { ProfileStore } from '../auth/profiles'
import { niveauPour } from '../../../shared/profil'
import type { PartySnapshot, Recap } from '../../../shared/types'
import type { Review } from '../../../shared/review'
import type { ArchiveList, ArchiveSummary } from '../../../shared/archive'
import { defaultSettings, type PublicSpace } from '../../../shared/space'
import { teamScores } from '../../../shared/teams'

export interface SpaceDeps {
  db: DB
  io: IoServer
  backup: PartyBackup
  archives: ArchiveStore
  auth: AuthStore
  /** Les profils : de quoi donner son niveau et sa finition à un joueur rattaché. */
  profiles: ProfileStore
  /** Le wifi de la salle, envoyé à l'écran commun seulement. */
  wifi: { ssid: string; pass: string } | null
  /** L'adresse de l'application telle que les téléphones l'ouvrent, sans le nom de l'espace. */
  baseUrl: () => string | null
  /** Plafond d'invités que même le réglage d'un espace ne dépasse pas. */
  maxPlayersCeiling: number
}

/**
 * La soirée d'un espace : ses invités, ses équipes, ses points, son journal,
 * sa partie en cours — et ses diffusions, qui ne sortent jamais de ses
 * salons. Chaque animateur en a une ; elles ne se voient pas.
 */
export class SpaceRuntime {
  readonly party: Party
  readonly teams: Teams
  readonly ledger: ScoreLedger
  readonly answers: AnswerLog
  readonly engine: GameEngine
  private readonly mirror: PartyMirror

  // Diffusion du classement : deux garde-fous mesurés sur une soirée simulée.
  //
  // · Regroupement — à l'arrivée des invités, cinquante inscriptions en
  //   quelques secondes déclenchaient cinquante diffusions complètes à tout
  //   le monde. On n'en envoie qu'une par fenêtre courte.
  // · Dédoublonnage — un classement identique au précédent ne part pas. Sans
  //   ça, le filet de sécurité périodique renvoyait 4 Ko à chaque téléphone
  //   toutes les 30 secondes pendant toute la fête, pour rien.
  private lastSnapshot = ''
  private pending: ReturnType<typeof setTimeout> | null = null

  constructor(
    readonly spaceId: string,
    private deps: SpaceDeps,
  ) {
    this.mirror = deps.backup.forSpace(spaceId)
    // La décoration se lit en mémoire : elle sert à chaque diffusion à toute
    // la salle, et un profil est déjà chargé quand son joueur s'est inscrit.
    this.party = new Party(deps.db, spaceId, this.mirror, (profileId, avatar) => {
      const profile = deps.profiles.cached(profileId)
      if (!profile) return undefined
      const niveau = niveauPour(profile.xp)
      return { niveau, finition: profile.finition, eclat: deps.profiles.eclatsOf(profileId).includes(avatar) }
    })
    this.teams = new Teams(deps.db, spaceId, this.mirror)
    this.ledger = new ScoreLedger(deps.db, spaceId, this.mirror)
    this.answers = new AnswerLog(deps.db, spaceId, this.mirror)
    this.engine = new GameEngine(
      {
        db: deps.db,
        io: deps.io,
        spaceId,
        party: this.party,
        ledger: this.ledger,
        answers: this.answers,
        backup: this.mirror,
        onScoresChanged: () => this.broadcastSnapshot(),
        onSessionChanged: () => this.broadcastSnapshot(),
      },
      quizModule,
    )
    this.engine.restore()
    // Un profil doit être en mémoire pour que son niveau s'affiche. Après un
    // redémarrage, on réchauffe ceux des invités déjà là — sans bloquer : la
    // soirée doit reprendre tout de suite, et l'instantané repartira enrichi.
    void this.warmProfiles()
  }

  /** Charge les profils des invités déjà inscrits, puis rediffuse. */
  private async warmProfiles() {
    const ids = [...new Set(this.party.all().map(p => p.profileId))].filter((id): id is string => !!id)
    if (ids.length === 0) return
    await Promise.all(ids.map(id => this.deps.profiles.byId(id).catch(() => null)))
    this.broadcastSnapshot()
  }

  /**
   * Crédite les profils rattachés de ce qu'ils ont fait ce soir.
   *
   * Appelé depuis `archiveParty()`, donc toujours AVANT que « Nouvelle
   * soirée » n'efface les journaux : c'est la seule fenêtre où tout est
   * encore là. Tout y est idempotent — la ligne d'expérience est remplacée,
   * pas ajoutée —, si bien qu'une écriture distante ratée peut se rejouer
   * telle quelle. C'est pourquoi on laisse l'erreur remonter : l'animateur
   * verra « rien n'a été effacé », et son prochain essai repartira juste.
   */
  private async creditProfiles(soireeId: string) {
    const answers = this.answers.all()
    const gains = buildProgress({
      players: this.party.all(),
      scores: this.ledger.all(),
      answers,
    })
    if (gains.length === 0) return

    // Les prix de la soirée sont déjà calculés pour la page souvenir : ce sont
    // eux, tels quels, qui font les badges. Pas de second catalogue à tenir,
    // et ce que la salle a vu proclamer est exactement ce qui se range dans
    // les étagères.
    const prix = computeStats(answers, this.party.publicPlayers(this.ledger.allTotals())).awards
    const parJoueur = new Map<string, typeof prix>()
    for (const a of prix) {
      // Les prix d'équipe n'ont pas de lauréat : ils ne font pas de badge.
      if (!a.player) continue
      const liste = parJoueur.get(a.player.playerId) ?? []
      liste.push(a)
      parJoueur.set(a.player.playerId, liste)
    }

    for (const g of gains) {
      // L'Éclat ne se tire qu'à la première consolidation. Sans ce garde-fou,
      // ranger dix fois la même soirée donnerait dix chances — et l'Éclat ne
      // vaut que parce qu'on ne peut pas le provoquer.
      const premiere = !(await this.deps.profiles.alreadyCredited(g.profileId, soireeId))
      await this.deps.profiles.creditSoiree({
        profileId: g.profileId,
        soireeId,
        spaceId: this.spaceId,
        gain: g.gain,
        releve: g.releve,
        xp: g.xp,
      })
      if (premiere && ProfileStore.tirageEclat()) {
        await this.deps.profiles.grantEclat(g.profileId, g.avatar, soireeId)
      }
      for (const a of parJoueur.get(g.playerId) ?? []) {
        await this.deps.profiles.grantBadge({
          profileId: g.profileId,
          badge: a.key,
          emoji: a.emoji,
          title: a.title,
          soireeId,
          spaceId: this.spaceId,
        })
      }
      // Les badges de carrière viennent en dernier : ils se décident sur les
      // totaux, expérience et éclat de ce soir compris.
      await this.deps.profiles.grantCareerBadges(g.profileId, soireeId, this.spaceId)
    }
  }

  /** L'espace tel que les invités et les pages le voient. */
  publicSpace(): PublicSpace {
    const account = this.deps.auth.byId(this.spaceId)
    if (account) return this.deps.auth.publicSpace(account)
    return { slug: this.spaceId, name: '?', ...defaultSettings('?') }
  }

  /** Inscriptions au-delà desquelles la soirée est déclarée complète. */
  get maxPlayers(): number {
    const wanted = this.deps.auth.byId(this.spaceId)?.settings.maxPlayers ?? this.deps.maxPlayersCeiling
    return Math.min(wanted, this.deps.maxPlayersCeiling)
  }

  /**
   * L'état de la soirée. Le wifi n'est envoyé qu'à l'écran commun : c'est lui
   * qui l'affiche en QR, les téléphones n'ont pas à recevoir le mot de passe.
   */
  buildSnapshot(forHost: boolean): PartySnapshot {
    const space = this.publicSpace()
    const players = this.party.publicPlayers(this.ledger.allTotals())
    const bonuses = this.teams.allBonuses()
    const base = this.deps.baseUrl()
    return {
      players,
      teams: teamScores(this.teams.all(), players, bonuses),
      bonuses,
      session: this.engine.summary(),
      joinUrl: base ? `${base}/${space.slug}` : null,
      wifi: forHost ? this.deps.wifi : null,
      space,
    }
  }

  sendSnapshot(force = false) {
    const snapshot = this.buildSnapshot(false)
    const json = JSON.stringify(snapshot)
    if (!force && json === this.lastSnapshot) return
    this.lastSnapshot = json
    const io = this.deps.io
    io.to(`space:${this.spaceId}`).except(`hosts:${this.spaceId}`).emit('party:snapshot', snapshot)
    io.to(`hosts:${this.spaceId}`).emit('party:snapshot', this.deps.wifi ? { ...snapshot, wifi: this.deps.wifi } : snapshot)
  }

  broadcastSnapshot() {
    if (this.pending) return
    this.pending = setTimeout(() => {
      this.pending = null
      this.sendSnapshot()
    }, 120)
  }

  // ── Les pages publiques : souvenir, bilan, historique ──
  //
  // Tout se calcule à partir des journaux (gains, réponses) par des fonctions
  // pures : la soirée en cours et une soirée archivée passent par le même
  // chemin, et une amélioration profite aux soirées passées.

  /** Les copies exactes des quiz des parties terminées, tant que le disque les a. */
  livePacks(): Map<string, PlayedPack> {
    const packs = new Map<string, PlayedPack>()
    const played = this.deps.db
      .prepare('SELECT id, state FROM sessions WHERE space_id = ?')
      .all(this.spaceId) as { id: string; state: string }[]
    for (const row of played) {
      try {
        const pack = playedPackOf(JSON.parse(row.state))
        if (pack) packs.set(row.id, pack)
      } catch {
        // Un état illisible ne vaut pas mieux qu'absent : la bibliothèque prend le relais.
      }
    }
    return packs
  }

  liveRecap(): Recap {
    return {
      ...buildRecap({
        players: this.party.publicPlayers(this.ledger.allTotals()),
        teams: this.teams.all(),
        bonuses: this.teams.allBonuses(),
        scores: this.ledger.all(),
        answers: this.answers.all(),
      }),
      space: this.publicSpace(),
    }
  }

  // Le journal des réponses ne garde que des numéros : les intitulés viennent
  // de la copie du quiz conservée dans chaque partie terminée (tant que le
  // disque local tient), et sinon de la bibliothèque.
  liveReview(): Review {
    return {
      ...buildReview({
        rows: this.answers.all(),
        players: this.party.publicPlayers(this.ledger.allTotals()),
        teams: this.teams.all(),
        bonuses: this.teams.allBonuses(),
        packsBySession: this.livePacks(),
        library: quizLibrary(this.spaceId),
      }),
      space: this.publicSpace(),
    }
  }

  /** Ce que l'historique dit de la soirée en cours, s'il s'y est déjà passé quelque chose. */
  currentSummary(): ArchiveList['current'] {
    const rows = this.answers.all()
    if (rows.length === 0) return null
    return {
      players: new Set(rows.map(r => r.playerId)).size,
      quizzes: new Set(rows.map(r => r.sessionId)).size,
      questions: new Set(rows.map(r => `${r.sessionId}#${r.qIndex}`)).size,
      since: this.party.all()[0]?.createdAt ?? null,
    }
  }

  /**
   * Range la soirée en cours dans l'historique, sans rien effacer. Null s'il
   * n'y a rien à garder. Une même soirée archivée deux fois est mise à jour.
   */
  async archiveParty(title?: string): Promise<ArchiveSummary | null> {
    const built = buildArchive({
      players: this.party.all(),
      teams: this.teams.all(),
      bonuses: this.teams.allBonuses(),
      scores: this.ledger.all(),
      answers: this.answers.all(),
      packsBySession: this.livePacks(),
      library: quizLibrary(this.spaceId),
    })
    if (!built) return null
    const summary = await this.deps.archives.save(this.spaceId, built.id, built.heldAt, built.archive, title)
    // L'identifiant de la soirée se déduit de l'arrivée du premier invité :
    // il ne bouge pas d'un archivage à l'autre, et c'est lui qui rend la
    // consolidation idempotente.
    await this.creditProfiles(built.id)
    // Les niveaux ont pu monter : l'écran commun doit le montrer.
    this.broadcastSnapshot()
    return summary
  }

  /**
   * Repart d'une soirée vierge — après avoir rangé celle-ci dans l'historique.
   * Rien ne s'efface tant que l'archive n'est pas écrite : si la base distante
   * ne répond pas, la soirée reste là et l'animateur est prévenu.
   */
  async resetParty(): Promise<ArchiveSummary | null> {
    const archived = await this.archiveParty()
    const running = this.engine.activeSessionId
    if (running) this.engine.endSession(running)
    this.party.clearAll()
    this.teams.clearAll()
    this.ledger.clearAll()
    this.answers.clearAll()
    await this.mirror.reset()
    this.broadcastSnapshot()
    return archived
  }

  stop() {
    if (this.pending) clearTimeout(this.pending)
    this.pending = null
    this.engine.stop()
  }
}

/**
 * Les soirées en cours, une par espace, créées à la demande : la première
 * connexion d'un invité ou d'un écran commun réveille la sienne depuis les
 * lignes locales. Une partie en cours au démarrage réveille son espace tout
 * de suite, pour que ses chronomètres repartent.
 */
export class SpaceRegistry {
  private runtimes = new Map<string, SpaceRuntime>()

  constructor(private deps: SpaceDeps) {}

  get(spaceId: string): SpaceRuntime {
    let runtime = this.runtimes.get(spaceId)
    if (!runtime) {
      runtime = new SpaceRuntime(spaceId, this.deps)
      this.runtimes.set(spaceId, runtime)
    }
    return runtime
  }

  peek(spaceId: string): SpaceRuntime | undefined {
    return this.runtimes.get(spaceId)
  }

  all(): SpaceRuntime[] {
    return [...this.runtimes.values()]
  }

  /** Réveille les espaces dont une partie était en cours à l'extinction. */
  wakeRunning(): number {
    const rows = this.deps.db
      .prepare("SELECT DISTINCT space_id FROM sessions WHERE status = 'running' AND space_id IS NOT NULL")
      .all() as { space_id: string }[]
    for (const row of rows) this.get(row.space_id)
    return rows.length
  }

  /**
   * Oublie la soirée d'un espace dont le compte disparaît. Sa partie en cours
   * est soldée — ses chronomètres avec : un chrono qui sonnerait après coup
   * réécrirait la partie sur le disque —, plus rien ne part vers le miroir,
   * et un prochain `get` repartirait d'une soirée vide.
   */
  drop(spaceId: string): boolean {
    const runtime = this.runtimes.get(spaceId)
    if (!runtime) return false
    const running = runtime.engine.activeSessionId
    if (running) runtime.engine.endSession(running)
    runtime.stop()
    this.runtimes.delete(spaceId)
    return true
  }

  stopAll() {
    for (const runtime of this.runtimes.values()) runtime.stop()
  }
}

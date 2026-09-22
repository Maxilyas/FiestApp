import type { DB } from './db'
import type { IoServer } from './types'
import { Party } from './party'
import { Teams } from './teams'
import { ScoreLedger } from './scores'
import { AnswerLog, type AnswerRow } from './answers'
import { GameEngine } from './engine'
import type { PartyBackup, PartyMirror } from './backup'
import type { ArchiveStore } from './archive'
import { buildArchive, soireeDesInvites, type Soiree } from './archive'
import { buildRecap } from './recap'
import { buildReview, type PlayedPack } from './review'
import { buildProgress, type SoireeGain } from './progress'
import { computeStats } from './stats'
import { playedPackOf, quizLibrary, quizModule } from '../games/quiz'
import type { AuthStore } from '../auth/store'
import { ProfileStore, type PrixDeSoiree } from '../auth/profiles'
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

/** Ce qu'une soirée rapporte à ses profils, lu d'un seul tenant. */
interface CreditDeSoiree {
  gains: SoireeGain[]
  laureats: PrixDeSoiree[]
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
    this.soiree = this.soireeRangee()
    if (!this.soiree) {
      // Des invités, mais aucun nom rangé : la soirée a commencé avant qu'on
      // range son nom — elle était en cours au déploiement. On le tire tout
      // de suite, comme on l'a toujours calculé, et on le fige, miroir
      // compris : une archive et de l'expérience ont pu être écrites sous ce
      // nom-là, et si le premier arrivé s'en allait avant qu'il ne resserve,
      // plus rien ne permettrait de le retrouver.
      const tiree = this.tirerSoiree()
      if (tiree) {
        this.recopierSoiree(tiree).catch(e => console.warn(`[soirée] nom non recopié : ${(e as Error).message}`))
      }
    }
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
        // Un quiz qui se termine crédite l'expérience du soir. L'erreur
        // s'arrête ici : une base distante qui ne répond pas ne doit pas
        // emporter la soirée, et le prochain quiz — ou l'archivage —
        // réécrira exactement les mêmes lignes.
        onSessionEnded: () => {
          this.crediterQuiz().catch(e => console.error('[xp]', e))
        },
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
   * La soirée en cours : son nom et son heure de début.
   *
   * C'est sous ce nom qu'elle s'archive et que ses profils se créditent, et
   * c'est lui qui rend le crédit idempotent : on peut créditer plusieurs fois
   * dans la soirée sans jamais payer deux fois — pourvu qu'il ne bouge pas.
   * On le recalculait à chaque besoin sur le plus ancien invité présent :
   * exclure le premier arrivé le changeait entre deux quiz, et l'expérience
   * s'additionnait sous deux noms, l'Éclat se retirait, la soirée déjà
   * sauvegardée s'archivait en double.
   *
   * Il se tire donc une seule fois, sur le plus ancien invité présent : la
   * première fois que quelque chose s'écrit sous ce nom dans la base
   * permanente — ou dès le réveil, pour une soirée qui a des invités mais
   * pas encore de nom rangé (voir le constructeur). Il vit ensuite en
   * mémoire, dans la base locale et dans le miroir distant, et seule
   * « Nouvelle soirée » l'oublie.
   */
  private soiree: Soiree | null = null

  /** Le nom de la soirée, tiré à l'instant s'il ne l'était pas encore. Null sans invité. */
  private soireeEnCours(): Soiree | null {
    return this.soiree ?? this.tirerSoiree()
  }

  /** Le nom que le disque a gardé pour la soirée de cet espace, s'il y en a un. */
  private soireeRangee(): Soiree | null {
    const row = this.deps.db
      .prepare('SELECT id, held_at FROM soiree WHERE space_id = ?')
      .get(this.spaceId) as { id: string; held_at: number } | undefined
    return row ? { id: row.id, heldAt: row.held_at } : null
  }

  /** Tire le nom sur les invités présents, et le range sur le disque local. */
  private tirerSoiree(): Soiree | null {
    const soiree = soireeDesInvites(this.party.all())
    if (!soiree) return null
    this.deps.db
      .prepare('INSERT OR REPLACE INTO soiree (space_id, id, held_at) VALUES (?, ?, ?)')
      .run(this.spaceId, soiree.id, soiree.heldAt)
    this.soiree = soiree
    return soiree
  }

  /**
   * Recopie le nom dans le miroir distant, d'où un réveil sur disque effacé
   * le reprendra.
   *
   * À appeler avant d'écrire quoi que ce soit sous ce nom dans la base
   * permanente, et au moment même où on le lit : l'écriture part alors
   * pendant que la soirée est encore celle-ci. Une « Nouvelle soirée » qui
   * suivrait attend les écritures en vol avant d'effacer le miroir — elle ne
   * la verra donc jamais ressusciter le nom de la soirée finie.
   */
  private recopierSoiree(soiree: Soiree): Promise<void> {
    const ecriture = this.mirror.saveSoiree(soiree)
    // On ne l'attend que plus tard, derrière la file : un échec d'ici là ne
    // doit pas passer pour une promesse abandonnée, qui ferait tomber le
    // serveur. Celui qui l'attend reçoit bien l'erreur.
    ecriture.catch(() => {})
    return ecriture
  }

  /** La soirée suivante tirera son propre nom, sur ses propres invités. */
  private oublierSoiree() {
    this.soiree = null
    this.deps.db.prepare('DELETE FROM soiree WHERE space_id = ?').run(this.spaceId)
  }

  /**
   * Les crédits de la soirée — fin de quiz, archivage — passent un par un.
   *
   * Chacun lit les journaux à l'instant où on le demande, puis écrit au loin,
   * lentement. Deux passages qui se chevauchaient — « Sauvegarder » cliqué à
   * la fin d'un quiz — tiraient l'Éclat chacun de son côté, aucun ne voyant
   * encore la ligne de l'autre ; et un archivage parti plus tôt pouvait
   * ranger ses prix après un plus récent. À la file, le dernier demandé
   * écrit le dernier.
   */
  private file: Promise<unknown> = Promise.resolve()

  private enFile<T>(travail: () => Promise<T>): Promise<T> {
    const tour = this.file.then(travail)
    // Un passage raté ne bloque pas les suivants : son erreur va à qui l'a demandé.
    this.file = tour.catch(() => {})
    return tour
  }

  /**
   * Ce qu'on a déjà annoncé à chacun, pour ne pas le lui redire à l'identique.
   * La clé porte la soirée : « Nouvelle soirée » n'attend pas les écritures
   * distantes de la précédente, et un total d'hier ne doit pas faire taire
   * l'annonce d'aujourd'hui.
   */
  private xpAnnoncee = new Map<string, number>()

  /** Ce que la soirée rapporte aux profils, à l'instant où on le demande. */
  private gainsDuMoment(answers = this.answers.all()): SoireeGain[] {
    return buildProgress({
      players: this.party.all(),
      scores: this.ledger.all(),
      answers,
    })
  }

  /**
   * L'expérience du soir, écrite et annoncée.
   *
   * La ligne est REMPLACÉE, jamais ajoutée : on peut donc la recalculer à
   * chaque fin de quiz, puis une dernière fois à l'archivage, sans que
   * personne n'encaisse deux fois. C'est ce qui permet de ne plus faire
   * attendre l'archivage à celui qui vient de gagner.
   */
  private async crediterExperience(soireeId: string, gains: SoireeGain[]) {
    for (const g of gains) {
      // L'Éclat ne se tire qu'une fois par soirée. Sans ce garde-fou, chaque
      // quiz joué donnerait une chance de plus — et l'Éclat ne vaut que
      // parce qu'on ne peut pas le provoquer. Il tient au nom de la soirée :
      // rebaptisée, elle redevenait « première ».
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
      await this.annoncer(soireeId, g)
    }
  }

  /**
   * Dit à un téléphone ce qu'il vient de gagner.
   *
   * Le profil qu'il porte lui est arrivé à la poignée de main : sans ce
   * message, son niveau ne bougerait pas de la soirée, et l'expérience
   * n'existerait que dans la base. On ne redit rien quand le total du soir
   * n'a pas bougé — l'archivage recrédite les mêmes chiffres.
   */
  private async annoncer(soireeId: string, g: SoireeGain) {
    const cle = `${soireeId}:${g.profileId}`
    const deja = this.xpAnnoncee.get(cle)
    if (deja === g.xp) return
    this.xpAnnoncee.set(cle, g.xp)
    const profile = await this.deps.profiles.byId(g.profileId).catch(() => null)
    if (!profile) return
    const salon = this.deps.io.to(`player:${g.playerId}`)
    salon.emit('player:profil', this.deps.profiles.toPublic(profile))
    const gagne = g.xp - (deja ?? 0)
    if (gagne > 0) {
      salon.emit('toast', { kind: 'info', message: `+${gagne} points d’expérience` })
    }
  }

  /**
   * Un quiz vient de finir : on crédite tout de suite.
   *
   * Rien n'attend l'archivage, qui peut ne jamais venir — un animateur range
   * sa soirée quand il y pense, et un invité qui gagne veut voir son niveau
   * bouger le soir même. Les badges, eux, restent à l'archivage : ils se
   * décernent sur la soirée entière, et chaque archivage remplace les prix
   * du précédent — « Sauvegarder » à 21 h ne fige rien.
   */
  private async crediterQuiz() {
    // Les journaux se lisent AVANT le premier `await` : ce qui suit attend la
    // base distante, et un serveur qu'on ferme entre-temps n'aurait plus de
    // base locale à interroger. Le nom de la soirée aussi : une « Nouvelle
    // soirée » cliquée pendant qu'on écrit ne change rien à ce qu'on crédite.
    const gains = this.gainsDuMoment()
    if (gains.length === 0) return
    const soiree = this.soireeEnCours()
    if (!soiree) return
    const recopie = this.recopierSoiree(soiree)
    await this.enFile(async () => {
      await recopie
      await this.crediterExperience(soiree.id, gains)
      // Les niveaux ont pu monter : l'écran commun doit le montrer.
      this.broadcastSnapshot()
    })
  }

  /**
   * Ce que la soirée rapporte à ses profils à cet instant : l'expérience, et
   * les prix que la salle voit proclamer.
   */
  private creditDuMoment(answers: AnswerRow[]): CreditDeSoiree {
    const gains = this.gainsDuMoment(answers)
    // Les prix de la soirée sont déjà calculés pour la page souvenir : ce sont
    // eux, tels quels, qui font les badges. Pas de second catalogue à tenir,
    // et ce que la salle a vu proclamer est exactement ce qui se range dans
    // les étagères.
    const profilDuJoueur = new Map(gains.map(g => [g.playerId, g.profileId]))
    const prix = computeStats(answers, this.party.publicPlayers(this.ledger.allTotals())).awards
    const laureats = prix.flatMap(a => {
      // Un prix d'équipe n'a pas de lauréat, et un invité anonyme pas d'étagère.
      const profileId = a.player && profilDuJoueur.get(a.player.playerId)
      return profileId ? [{ profileId, badge: a.key, emoji: a.emoji, title: a.title }] : []
    })
    return { gains, laureats }
  }

  /**
   * Crédite les profils de tout ce qu'ils ont fait ce soir.
   *
   * Appelé depuis `archiveParty()`, donc toujours AVANT que « Nouvelle
   * soirée » n'efface les journaux. Tout y est idempotent — la ligne
   * d'expérience est remplacée, pas ajoutée —, si bien qu'une écriture
   * distante ratée peut se rejouer telle quelle. C'est pourquoi on laisse
   * l'erreur remonter : l'animateur verra « rien n'a été effacé », et son
   * prochain essai repartira juste.
   */
  private async creditProfiles(soireeId: string, { gains, laureats }: CreditDeSoiree) {
    await this.crediterExperience(soireeId, gains)
    // Les prix se remplacent, comme l'expérience — et même sans aucun profil
    // ce soir : ceux qu'un archivage précédent avait rangés doivent pouvoir
    // repartir.
    await this.deps.profiles.remplacerPrixDeSoiree(soireeId, this.spaceId, laureats)
    // Les badges de carrière viennent en dernier : ils se décident sur les
    // totaux, expérience et éclat de ce soir compris.
    for (const g of gains) await this.deps.profiles.grantCareerBadges(g.profileId, soireeId, this.spaceId)
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
    // Tout se lit ici, d'un seul tenant, avant la première attente : une
    // « Nouvelle soirée » cliquée pendant qu'on écrit au loin viderait les
    // journaux sous nos pieds, et l'archive et les crédits ne décriraient
    // plus la même soirée.
    const answers = this.answers.all()
    if (answers.length === 0) return null
    const soiree = this.soireeEnCours()
    if (!soiree) return null
    const built = buildArchive({
      soiree,
      players: this.party.all(),
      teams: this.teams.all(),
      bonuses: this.teams.allBonuses(),
      scores: this.ledger.all(),
      answers,
      packsBySession: this.livePacks(),
      library: quizLibrary(this.spaceId),
    })
    if (!built) return null
    const credit = this.creditDuMoment(answers)
    const recopie = this.recopierSoiree(soiree)
    return this.enFile(async () => {
      await recopie
      const summary = await this.deps.archives.save(this.spaceId, built.id, built.heldAt, built.archive, title)
      await this.creditProfiles(soiree.id, credit)
      // Les niveaux ont pu monter : l'écran commun doit le montrer.
      this.broadcastSnapshot()
      return summary
    })
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
    this.xpAnnoncee.clear()
    this.teams.clearAll()
    this.ledger.clearAll()
    this.answers.clearAll()
    // La seule porte qui ouvre une nouvelle soirée, et donc le seul endroit
    // où l'on oublie son nom. Le miroir l'oublie juste en dessous.
    this.oublierSoiree()
    await this.mirror.reset()
    this.broadcastSnapshot()
    // Les téléphones de la soirée effacée n'incarnent plus personne. Laissés
    // tels quels, ils restaient sur un en-tête vide, « 0 pts », « Personne
    // pour l'instant… », et le quiz suivant partait sans aucun participant
    // — l'animateur ne pouvait même plus le lancer. Leur connexion oublie son
    // invité, et la page repasse par l'entrée, pré-remplie. Un téléphone qui
    // a rejoint la nouvelle soirée pendant l'attente du miroir, lui, a déjà
    // un invité qui existe : on n'y touche pas. L'écran commun n'en a pas.
    //
    // La salle vide part d'abord, sans attendre le regroupement : l'entrée
    // qui s'ouvre sur le téléphone lit la liste des invités, et celle d'avant
    // lui faisait prendre sa propre identité effacée pour un homonyme — son
    // avatar « déjà pris » changeait sous ses yeux.
    this.sendSnapshot()
    const io = this.deps.io
    for (const id of [...(io.sockets.adapter.rooms.get(`space:${this.spaceId}`) ?? [])]) {
      const socket = io.sockets.sockets.get(id)
      const playerId = socket?.data.playerId
      if (!socket || !playerId || this.party.get(playerId)) continue
      socket.leave(`player:${playerId}`)
      socket.data.playerId = undefined
      socket.emit('party:reset')
    }
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

import { createHash } from 'node:crypto'
import type { DB } from './db'
import type { IoServer } from './types'
import { Party } from './party'
import { Teams } from './teams'
import { ScoreLedger } from './scores'
import { AnswerLog, type AnswerRow } from './answers'
import { GameEngine } from './engine'
import { PlacesRendues } from './places'
import type { PartyBackup, PartyMirror } from './backup'
import type { ArchiveStore } from './archive'
import { buildArchive, soireeDesInvites, type Soiree } from './archive'
import { buildRecap } from './recap'
import { buildReview, type PlayedPack } from './review'
import { buildProgress, relevesDeSoiree, type SoireeGain } from './progress'
import { hautsFaitsDeSoiree, xpDesHautsFaits } from './hautsfaits'
import { divinsDeSoiree, laureatsDivins, raconter } from './divins'
import { computeStats } from './stats'
import { playedPackOf, quizLibrary, quizModule } from '../games/quiz'
import type { AuthStore } from '../auth/store'
import { ProfileStore, cleDeSoiree, type PrixDeSoiree } from '../auth/profiles'
import {
  coupDOeilMoyen,
  distinctions,
  ficheDe,
  finitionPortee,
  finitionsOuvertes,
  niveauDuProfil,
  releveVide,
  soireeQuiCompte,
  type Finition,
} from '../../../shared/profil'
import { rangPartage } from '../../../shared/classement'
import type { CarteDeJoueur } from '../../../shared/carte'
import type { BadgePorte, Rarete } from '../../../shared/badges'
import { hautFaitDeSoiree, palierDe, titreDePalier, XP_PALIER } from '../../../shared/hautsfaits'
import { cibleEclat } from '../../../shared/legendaires'
import type { ClotureDeSoiree, Figure, FinDeSoiree, HautFaitAnnonce, PrixAnnonce, SoireeClose } from '../../../shared/fin'
import type { EcranDeScene, OngletDePodium, PartySnapshot, PublicPlayer, Recap, Scene } from '../../../shared/types'
import type { PlaceRendue } from '../../../shared/events'
import type { Review } from '../../../shared/review'
import type { LancementDeQuiz } from '../../../shared/games/quiz'
import type { ArchiveList, ArchiveSummary, DerniereSoiree } from '../../../shared/archive'
import { defaultSettings, type PublicSpace } from '../../../shared/space'
import { questionsDesEquipes, teamScores } from '../../../shared/teams'

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
  /**
   * Les espaces dont la soirée est en train de se clore, communs à tout le
   * serveur. Leur ligne de la table `soiree` ne part qu'à la fin de leur
   * clôture, après leurs crédits : sans eux, deux soirées closes au même
   * instant s'écartaient l'une l'autre des paliers (`soireesEnCoursAilleurs`),
   * et celui qu'elles atteignaient ensemble ne tombait nulle part.
   */
  cloturesEnCours: Set<string>
}

/**
 * Ce que la clôture crédite, lu d'un seul tenant avant la première attente :
 * l'expérience de la soirée entière, les récompenses à ranger (prix du
 * palmarès et hauts faits, pour les profils), et ce que chaque invité a fait.
 */
interface CreditDeCloture {
  gains: SoireeGain[]
  laureats: PrixDeSoiree[]
  /** Les hauts faits de chaque invité, profil ou non : les téléphones les annoncent à tous. */
  faits: Map<string, string[]>
  /** Rang, points et taille de la salle, pour chacun. */
  releves: ReturnType<typeof relevesDeSoiree>
  /** Les prix du palmarès, par joueur, profil ou non : sa fin de soirée les lui rappelle. */
  prix: Map<string, PrixAnnonce[]>
  /** Ceux qui ont répondu ce soir : la salle, telle que les relevés la comptent. */
  joueurs: number
}

/** Un haut fait de soirée tel qu'on l'annonce. */
function annonceDe(cle: string): HautFaitAnnonce | null {
  const h = hautFaitDeSoiree(cle)
  if (h) return { key: h.key, emoji: h.emoji, title: h.title, ton: h.ton }
  const p = palierDe(cle)
  if (p) return { key: cle, emoji: p.hautFait.emoji, title: titreDePalier(p.hautFait, p.palier), ton: 'eclat' }
  return null
}

/**
 * L'empreinte d'une archive : deux archives de même empreinte rangent
 * exactement la même chose. Le podium puis « Terminer » rangeaient deux fois
 * la même soirée — plusieurs Mo vers la base distante pour rien.
 */
function empreinteDArchive(archive: unknown): string {
  return createHash('sha1').update(JSON.stringify(archive)).digest('hex')
}

/**
 * Combien de profils se créditent en même temps. Chacun attend quatre ou
 * cinq allers-retours vers la base permanente : en série, cent profils à
 * 30 ms faisaient attendre quinze secondes la salle qui voulait lire « c'est
 * fini ». Au-delà de huit, on ne gagne plus grand-chose et on charge la base
 * d'un coup.
 */
const PROFILS_EN_VOL = 8

/**
 * `travail` sur chaque élément, `limite` à la fois ; les résultats dans
 * l'ordre des éléments. On attend que TOUS aient fini avant de rendre, même
 * après un échec — qui remonte ensuite, le premier : un crédit qui écrirait
 * encore après être « terminé » passerait derrière le travail suivant de la
 * file (`enFile`), et c'est l'ordre des écritures que la file protège.
 */
export async function enParallele<T, R>(elements: T[], limite: number, travail: (e: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = new Array(elements.length)
  const echecs: unknown[] = []
  let suivant = 0
  const ouvrier = async () => {
    while (suivant < elements.length) {
      const i = suivant++
      try {
        resultats[i] = await travail(elements[i])
      } catch (e) {
        echecs.push(e)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, elements.length) }, ouvrier))
  if (echecs.length === 0) return resultats
  // Le premier échec remonte à qui a demandé le travail, qui le journalise ;
  // les suivants ne seraient écrits nulle part — trois profils sans crédit
  // n'en laissaient voir qu'un.
  for (const e of echecs.slice(1)) console.error('[crédits] un autre échec du même lot :', e)
  throw echecs[0]
}

/**
 * Ce qu'un crédit d'expérience écrirait : le nom de la soirée, et chaque
 * gain tel quel — profil, invité, emoji, relevé. Deux crédits de même
 * empreinte écrivent exactement les mêmes lignes.
 */
function empreinteDuCredit(soireeId: string, gains: SoireeGain[]): string {
  return JSON.stringify([soireeId, gains])
}

/**
 * Chaque soirée chargée reçoit son numéro : un espace déchargé puis réveillé
 * repart de journaux relus, dont les compteurs d'écriture repartent de zéro
 * — sans ce numéro, une page gardée d'avant pourrait passer pour à jour.
 */
let incarnations = 0

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
  /** Les codes « Rendre sa place » en cours — voir `rendrePlace`. */
  readonly places = new PlacesRendues()
  /**
   * Les seconds « Rachid » gardés après une reprise (`laisserPlace`) : hors
   * ligne pour toujours, puisque leur porteur joue sous l'autre fiche. Ils
   * ne sont le « c'est peut-être toi » de personne — l'avis de l'entrée
   * renverrait sinon Rachid vers la place qu'il vient de quitter. En mémoire :
   * un redémarrage les oublie, l'avis reparaîtrait, rien de plus.
   */
  readonly laissees = new Set<string>()
  private readonly mirror: PartyMirror

  // Diffusion du classement : deux garde-fous mesurés sur une soirée simulée.
  //
  // · Regroupement — à l'arrivée des invités, cinquante inscriptions en
  //   quelques secondes déclenchaient cinquante diffusions complètes à tout
  //   le monde. On n'en envoie qu'une par fenêtre courte.
  // · Dédoublonnage — un classement identique au précédent ne part pas. Sans
  //   ça, le filet de sécurité périodique renvoyait 4 Ko à chaque téléphone
  //   toutes les 30 secondes pendant toute la fête, pour rien. Les téléphones
  //   et les écrans communs ont chacun le leur : qui dort et qui veille ne
  //   regarde que l'écran commun, et une veille ne doit plus repartir à
  //   toute la salle.
  private lastSnapshot = ''
  private lastEcrans = ''
  /** La diffusion regroupée des téléphones, et celle des écrans communs — voir `broadcastSnapshot`. */
  private pending: ReturnType<typeof setTimeout> | null = null
  private pendingEcrans: ReturnType<typeof setTimeout> | null = null
  private readonly incarnation = ++incarnations

  /**
   * La scène des écrans d'animateur : en mémoire seulement. Un redémarrage
   * la ramène à la salle d'attente — c'est un choix d'affichage, pas une
   * donnée de la soirée : la base locale est jetable, et la salle d'attente
   * (le QR, les invités) est l'écran qu'on ne regrette jamais d'afficher.
   */
  private scene: Scene | null = null
  /** L'annonce de la dernière clôture, pour un écran qui se présente pendant qu'on l'affiche. */
  private derniereCloture: ClotureDeSoiree | null = null

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
      const niveau = deps.profiles.niveauOf(profile)
      return {
        niveau,
        finition: finitionPortee(profile.finition, niveau),
        // Ce qui brille, c'est ce qu'il porte : le légendaire éclaté, ou l'emoji.
        eclat: deps.profiles.eclatsOf(profileId).includes(cibleEclat(deps.profiles.legendairePorte(profile), avatar)),
        legendaire: deps.profiles.legendairePorte(profile) ?? undefined,
      }
    })
    this.teams = new Teams(deps.db, spaceId, this.mirror)
    this.ledger = new ScoreLedger(deps.db, spaceId, this.mirror)
    this.answers = new AnswerLog(deps.db, spaceId, this.mirror)
    this.soiree = this.soireeRangee()
    // Sans réponse au journal, rien n'a été joué : il n'y a rien à nommer.
    // L'hébergeur s'endort justement entre deux soirées, et l'invité revenu
    // relire la veille aurait daté de son passage la soirée d'après.
    if (!this.soiree && this.answers.all().length > 0) {
      // Des invités, mais aucun nom rangé : la soirée a commencé avant qu'on
      // range son nom — elle était en cours au déploiement. On le tire tout
      // de suite, comme on l'a toujours calculé, et on le fige, miroir
      // compris : une archive et de l'expérience ont pu être écrites sous ce
      // nom-là, et si le premier arrivé s'en allait avant qu'il ne resserve,
      // plus rien ne permettrait de le retrouver.
      //
      // Des réponses au journal sans nom rangé : un quiz s'est joué sur un
      // serveur qui ne rangeait pas les noms, et il a pu écrire son archive et
      // son expérience sous le nom d'alors, sans l'empreinte de l'espace. Le
      // tirer au format du jour doublait l'archive et recomptait
      // l'expérience du premier quiz (invariant 11). Sans réponse, rien n'a
      // pu s'écrire : le nom du jour ne rebaptise rien.
      const tiree = this.tirerSoiree(this.answers.all().length > 0)
      if (tiree) {
        this.recopierSoiree(tiree).catch(e => console.warn(`[soirée] nom non recopié : ${(e as Error).message}`))
      }
    }
    // Entre deux soirées, la dernière close se lit dès le réveil, en tâche de
    // fond : le premier téléphone au jeton périmé n'aura pas à l'attendre.
    if (!this.aJoue()) void this.relireDerniere()
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
        // Un quiz qui se termine range la soirée dans l'historique et
        // crédite l'expérience du quiz. L'erreur s'arrête ici : une base
        // distante qui ne répond pas ne doit pas emporter la soirée, et le
        // prochain quiz — ou la clôture — réécrira exactement les mêmes lignes.
        onSessionEnded: () => {
          this.apresQuiz().catch(e => console.error('[soirée]', e))
        },
        // Le podium à l'écran vaut une fin de quiz : le dernier podium de la
        // soirée reste souvent affiché sans que personne ne referme la partie.
        onVerdict: () => {
          this.apresQuiz().catch(e => console.error('[soirée]', e))
        },
      },
      quizModule,
    )
    this.engine.restore()
    // Une sauvegarde qui échoue depuis un moment se dit sur l'écran commun,
    // et là seulement — à la transition, pas à chaque essai.
    this.mirror.surRetard(() => this.deps.io.to(`hosts:${spaceId}`).emit('party:snapshot', this.buildSnapshot(true)))
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
   * Il se tire donc une seule fois, à sa première question jouée : la
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

  /**
   * Tire le nom à sa première question jouée, et le range sur le disque local.
   * `commeAvant` le tire comme le faisait le serveur d'avant — sans
   * l'empreinte de l'espace, à l'arrivée du plus ancien invité — pour
   * retrouver le nom d'une soirée qu'il a commencée.
   */
  private tirerSoiree(commeAvant = false): Soiree | null {
    const soiree = soireeDesInvites(this.party.all(), this.answers.all(), commeAvant ? null : this.spaceId)
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

  /**
   * Les soirées qui se jouent en ce moment dans les autres espaces
   * (`cleDeSoiree`). La base locale range le nom de chacune dès qu'il est
   * tiré et l'oublie à sa fin — le miroir le lui rend après un réveil sur
   * disque effacé. Une soirée dont la clôture est en cours compte pour
   * close (`cloturesEnCours`).
   */
  private soireesEnCoursAilleurs(): Set<string> {
    const rows = this.deps.db
      .prepare('SELECT space_id, id FROM soiree WHERE space_id <> ?')
      .all(this.spaceId) as { space_id: string; id: string }[]
    return new Set(rows.filter(r => !this.deps.cloturesEnCours.has(r.space_id)).map(r => cleDeSoiree(r.space_id, r.id)))
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

  /**
   * L'empreinte du dernier crédit d'expérience arrivé en base : le nom de la
   * soirée et les gains écrits (voir `empreinteDuCredit`). Null quand on ne
   * sait plus ce qui y est — un crédit en cours ou raté, une ligne rendue
   * par un exclu, une nouvelle soirée.
   *
   * Chaque quiz se créditait deux fois, au podium puis à « Terminer » :
   * environ cinq allers-retours vers Turso par profil pour réécrire les
   * mêmes chiffres, dans la file où attendait peut-être un archivage. Même
   * empreinte, même résultat : le second passe son tour. Tout ce qui
   * changerait une ligne — des points annulés, un invité exclu, un profil
   * rattaché entre-temps — change aussi l'empreinte.
   */
  private dernierCredit: string | null = null

  /**
   * L'empreinte de la dernière archive écrite (voir `empreinteDArchive`) :
   * la soirée se range après chaque quiz, au podium puis à « Terminer », et
   * la seconde fois n'a rien de neuf à dire.
   */
  private derniereArchive: string | null = null

  /**
   * Une clôture — ou un essai qu'on efface — est en route. Le quiz qu'elle
   * termine ne se range pas de son côté : c'est elle qui range la soirée
   * entière, une seule fois, et ce qu'un rangement parti en même temps
   * écrirait arriverait après elle, sur une soirée qui n'existe plus.
   */
  private fermeture = false

  /**
   * La fin de soirée de chaque invité de la dernière soirée close, par jeton.
   * Un téléphone qui dormait pendant la clôture se re-présente avec un jeton
   * que la soirée ne connaît plus : il reçoit sa fin de soirée au lieu d'un
   * « on ne te retrouve plus ». En mémoire seulement — un redémarrage l'oublie,
   * et le téléphone repasse alors par l'entrée, comme avant.
   */
  private dernieresFins = new Map<string, FinDeSoiree>()

  /** La fin de soirée d'un jeton de la dernière soirée close, s'il en était. */
  finDe(token: string): FinDeSoiree | undefined {
    return this.dernieresFins.get(token)
  }

  /**
   * La dernière soirée close de l'espace, tant que la suivante n'a rien joué :
   * c'est elle que le souvenir et le bilan montrent entre deux soirées.
   */
  async derniereClose(): Promise<DerniereSoiree | null> {
    if (this.aJoue()) return null
    return this.deps.archives.derniere(this.spaceId, this.soireeId())
  }

  /**
   * La dernière soirée close, telle que la mémoire la connaît : posée à la
   * clôture, relue au loin en tâche de fond. `undefined` tant qu'on ne sait
   * pas encore — le réveil la lit.
   */
  private derniereConnue: DerniereSoiree | null | undefined = undefined
  /** La lecture en vol, pour qu'une rafale de téléphones n'en lance qu'une. */
  private lectureDerniere: Promise<void> | null = null
  /**
   * Compte les clôtures : une lecture partie avant l'une d'elles rapporterait
   * la soirée d'avant, et effacerait de la mémoire celle qu'on vient de clore.
   */
  private generationDerniere = 0

  /** Relit la dernière soirée close au loin, sans jamais faire attendre personne. */
  private relireDerniere(): Promise<void> {
    const generation = this.generationDerniere
    this.lectureDerniere ??= this.deps.archives
      .derniere(this.spaceId, this.soireeId())
      .then(
        d => {
          if (generation === this.generationDerniere) this.derniereConnue = d
        },
        (e: unknown) => console.warn(`[soirées] la dernière soirée ne se lit pas : ${(e as Error).message}`),
      )
      .finally(() => {
        this.lectureDerniere = null
      })
    return this.lectureDerniere
  }

  /**
   * La dernière soirée close, pour le téléphone dont le jeton ne désigne plus
   * personne. Elle attendait la base permanente, dont le délai (dix
   * secondes) dépasse celui de l'accusé du téléphone : une base muette
   * laissait l'habitué dans une salle d'attente fantôme. Elle se répond donc
   * de mémoire, et se relit derrière ; au réveil, quand la mémoire ne sait
   * pas encore, on attend la lecture deux secondes au plus.
   */
  async derniereCloseVite(): Promise<DerniereSoiree | null> {
    if (this.aJoue()) return null
    const lecture = this.relireDerniere()
    if (this.derniereConnue === undefined) {
      await Promise.race([lecture, new Promise(r => setTimeout(r, 2000).unref())])
    }
    return this.aJoue() ? null : (this.derniereConnue ?? null)
  }

  /**
   * Les jetons que la soirée a effacés sans les clore — l'exclu, l'essai
   * effacé : ils n'ont pas de soirée close à revoir, et la dernière de
   * l'espace n'est pas la leur. En mémoire : un redémarrage les oublie.
   */
  private jetonsEffaces = new Set<string>()

  private effacerJetons(tokens: string[]) {
    for (const t of tokens) this.jetonsEffaces.add(t)
    // Un Set ordonné : au-delà de dix mille, les plus anciens s'en vont.
    for (const t of this.jetonsEffaces) {
      if (this.jetonsEffaces.size <= 10_000) break
      this.jetonsEffaces.delete(t)
    }
  }

  /** Ce jeton a été effacé — exclu, ou d'un essai effacé — depuis le démarrage. */
  jetonEfface(token: string): boolean {
    return this.jetonsEffaces.has(token)
  }

  /** L'identifiant de la soirée en cours, s'il est déjà tiré — l'historique la montre à part. */
  soireeId(): string | null {
    return this.soiree?.id ?? null
  }

  /**
   * Ce dont se dérivent les pages publiques de la soirée en cours : le numéro
   * d'écriture de chaque journal et, tant que rien n'est joué, le nom de la
   * soirée et l'historique de l'espace, où se lit la dernière soirée close
   * (`derniere`). Une fois une question jouée, la page ne dépend plus
   * de l'historique : le rangement qui suit chaque podium, au moment même où
   * la salle scanne le QR, refaisait la page pour rien. Sans lire le
   * journal : les pages le demandent à chaque requête. Ce qui n'y est pas — le niveau d'un
   * profil, l'intitulé d'un quiz de la bibliothèque — paraît à la durée de
   * vie de la page (`core/pages.ts`).
   */
  empreinteDesPages(): string {
    return [
      this.incarnation,
      this.party.revision,
      this.teams.revision,
      this.ledger.revision,
      this.answers.revision,
      // `derniere` écarte la soirée en cours par son nom : l'un et l'autre
      // ne comptent que tant que rien n'est joué.
      this.aJoue() ? '' : `${this.soiree?.id ?? ''}.${this.deps.archives.revision(this.spaceId)}`,
    ].join('.')
  }

  /**
   * Vrai dès qu'une question a été jouée dans la soirée en cours : ses pages
   * parlent alors d'elle. Avant, elles montrent la dernière soirée close.
   */
  aJoue(): boolean {
    return !this.answers.estVide()
  }

  /**
   * La carte d'un invité de la soirée en cours : ce qu'on voit en touchant
   * son nom — sa soirée, et son profil s'il en a un. Null s'il n'en est pas :
   * un identifiant d'une autre soirée, ou d'un autre espace, vaut
   * « introuvable ».
   */
  async carteDe(playerId: string): Promise<CarteDeJoueur | null> {
    // Tout ce qui vient de la soirée se lit avant la première attente.
    const rec = this.party.get(playerId)
    if (!rec) return null
    const totals = this.ledger.allTotals()
    const points = totals.get(playerId) ?? 0
    const p = this.party.publicOne(playerId, points)
    if (!p) return null
    const positifs = [...totals.values()].filter(t => t > 0)
    const { releves, joueurs } = this.relevesDesCartes()
    // Sa soirée telle que sa fiche la rangera : la même lecture du journal,
    // les mêmes chiffres.
    const soir = releves.get(playerId)?.releve ?? releveVide()
    const carte: CarteDeJoueur = {
      nom: p.nomAffiche ?? p.name,
      avatar: p.avatar,
      ...distinctions(p),
      ceSoir: {
        points,
        rang: points > 0 ? rangPartage(points, positifs) : 0,
        // Toute la salle qui a joué, pas seulement ceux qui ont marqué : « 1ᵉʳ
        // sur 2 » quand cinq ont répondu laissait croire à une salle vide.
        joueurs,
        reponses: soir.reponses,
        // Les justes se comptent sur les QCM seuls : une estimation n'est
        // jamais juste, et la compter au dénominateur faisait lire « 1/64
        // justes » à qui avait joué soixante-deux estimations.
        qcm: soir.qcm,
        justes: soir.justes,
        estimations: soir.estimations,
        coupDOeil: coupDOeilMoyen(soir),
      },
    }
    if (!rec.profileId) return carte
    const profil = await this.deps.profiles.byId(rec.profileId)
    if (!profil) return carte
    const [vitrine, carriere] = await Promise.all([
      this.deps.profiles.badgesOf(profil.id),
      this.deps.profiles.careerOf(profil.id),
    ])
    const fiche = ficheDe(carriere)
    const recompenses = [...this.deps.profiles.recompensesOf(profil.id).keys()]
    carte.profil = {
      prenom: profil.name,
      niveau: this.deps.profiles.niveauOf(profil),
      legendaires: this.deps.profiles.legendairesOf(profil.id),
      divins: this.deps.profiles.divinsOf(profil.id),
      vitrine: plusRares(vitrine, 6),
      // Un palier de carrière compte pour son haut fait, pas pour trois.
      hautsFaits: new Set(recompenses.filter(k => k.startsWith('hf:')).map(k => k.replace(/:[123]$/, ''))).size,
      fiche: {
        soirees: fiche.soirees,
        precision: fiche.precision,
        qcm: fiche.qcm,
        justes: fiche.justes,
        coupDOeil: fiche.coupDOeil,
        estimationsComparees: fiche.estimationsComparees,
        reflexeMoyenMs: fiche.reflexeMoyenMs,
        quizGagnes: fiche.quizGagnes,
        meilleureSerie: fiche.meilleureSerie,
      },
    }
    return carte
  }

  private cartesGardees: { empreinte: string; releves: ReturnType<typeof relevesDeSoiree>; joueurs: number } | null =
    null

  /**
   * Les relevés de toute la salle, gardés tant que les journaux ne bougent
   * pas : chaque carte ouverte relisait le journal entier pour n'en garder
   * qu'une ligne, et toute la salle touche les noms au podium.
   */
  private relevesDesCartes() {
    const empreinte = this.empreinteDesPages()
    if (this.cartesGardees?.empreinte !== empreinte) {
      const journal = this.answers.all()
      this.cartesGardees = {
        empreinte,
        releves: relevesDeSoiree({ players: this.party.all(), scores: this.ledger.all(), answers: journal }),
        joueurs: new Set(journal.filter(r => r.answered).map(r => r.playerId)).size,
      }
    }
    return this.cartesGardees
  }

  /** Le nom qu'un invité porte sur les écrans, et ce qu'il porte. */
  private figure(playerId: string): Figure | null {
    const p = this.party.publicOne(playerId, this.ledger.total(playerId))
    if (!p) return null
    return { nom: p.nomAffiche ?? p.name, avatar: p.avatar, ...distinctions(p) }
  }

  /**
   * L'expérience du soir, écrite et annoncée. Rend les montées de niveau,
   * pour l'écran commun.
   *
   * La ligne est REMPLACÉE, jamais ajoutée : on peut donc la recalculer à
   * chaque fin de quiz, puis une dernière fois à la clôture, sans que
   * personne n'encaisse deux fois.
   */
  private async crediterExperience(
    soireeId: string,
    gains: SoireeGain[],
  ): Promise<(Figure & { avant: number; apres: number })[]> {
    // Tant qu'il n'est pas allé au bout, on ne sait plus ce qui est en base.
    this.dernierCredit = null
    // Chaque profil a ses lignes : les créditer en même temps ne mêle rien.
    // Les montées gardent l'ordre des gains, celui de l'écran commun.
    const parProfil = await enParallele(gains, PROFILS_EN_VOL, async g => {
      const avant = (await this.deps.profiles.byId(g.profileId).catch(() => null))?.xp ?? 0
      // L'Éclat ne se tire qu'une fois par soirée. Sans ce garde-fou, chaque
      // quiz joué donnerait une chance de plus — et l'Éclat ne vaut que
      // parce qu'on ne peut pas le provoquer. Il tient au nom de la soirée :
      // rebaptisée, elle redevenait « première ». Et il attend que la soirée
      // compte vraiment — une réponse à une question posée à deux joueurs
      // au moins : un téléphone seul qui enchaînait les soirées d'une
      // question tirait autant d'Éclats qu'il voulait.
      const precedent = await this.deps.profiles.creditPrecedent(g.profileId, soireeId)
      const tirage = soireeQuiCompte(g.gain) && !(precedent && soireeQuiCompte(precedent.gain))
      const apres = await this.deps.profiles.creditSoiree({
        profileId: g.profileId,
        soireeId,
        spaceId: this.spaceId,
        gain: g.gain,
        releve: g.releve,
        xp: g.xp,
        playerId: g.playerId,
      })
      if (tirage && ProfileStore.tirageEclat()) {
        // Sous un légendaire, c'est lui qui éclate : l'emoji caché dessous
        // brillait sans que personne le voie.
        await this.deps.profiles.grantEclat(g.profileId, this.deps.profiles.cibleEclatDe(g.profileId, g.avatar), soireeId)
      }
      await this.annoncer(soireeId, g, avant, apres)
      // Un niveau gardé d'une courbe d'avant ne se « gagne » pas une seconde
      // fois : on ne fête que ce qui dépasse le niveau qu'il avait déjà.
      const gardes = this.deps.profiles.gardesOf(g.profileId)
      const [niveauAvant, niveauApres] = [niveauDuProfil(avant, gardes), niveauDuProfil(apres, gardes)]
      if (niveauApres > niveauAvant) {
        const figure = this.figure(g.playerId)
        if (figure) return { ...figure, avant: niveauAvant, apres: niveauApres }
      }
      return null
    })
    const montees = parProfil.filter((m): m is NonNullable<typeof m> => m !== null)
    this.dernierCredit = empreinteDuCredit(soireeId, gains)
    return montees
  }

  /**
   * Dit à un téléphone ce qu'il vient de gagner.
   *
   * Le profil qu'il porte lui est arrivé à la poignée de main : sans ce
   * message, son niveau ne bougerait pas de la soirée, et l'expérience
   * n'existerait que dans la base. On ne redit rien quand le total du soir
   * n'a pas bougé — la clôture recrédite les mêmes chiffres.
   */
  private async annoncer(soireeId: string, g: SoireeGain, avant: number, apres: number) {
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
      // Le téléphone le fête — un niveau, une finition —, au lieu d'un toast
      // qu'on ne lisait pas pendant le podium.
      const gardes = this.deps.profiles.gardesOf(g.profileId)
      const niveauAvant = niveauDuProfil(avant, gardes)
      const niveauApres = niveauDuProfil(apres, gardes)
      salon.emit('player:gain', {
        xp: gagne,
        niveauAvant,
        niveauApres,
        finitions: finitionsOuvertes(niveauApres).filter(f => !finitionsOuvertes(niveauAvant).includes(f)),
      })
    }
  }

  /**
   * Un quiz vient de finir — son podium est à l'écran, ou on l'a refermé :
   * la soirée se range dans l'historique, et l'expérience du quiz se crédite.
   *
   * Rien n'attend plus un « Sauvegarder » qui venait quand l'animateur y
   * pensait, parfois jamais : l'historique est toujours à jour, et un invité
   * qui gagne voit son niveau bouger le soir même. Ce qui ne se décide
   * qu'une fois tout joué — le podium de la soirée, les prix, les hauts
   * faits — attend la clôture.
   */
  private async apresQuiz() {
    if (this.fermeture) return
    // Les journaux se lisent AVANT le premier `await` : ce qui suit attend la
    // base distante, et un serveur qu'on ferme entre-temps n'aurait plus de
    // base locale à interroger. Le nom de la soirée aussi : une clôture
    // cliquée pendant qu'on écrit ne change rien à ce qu'on range.
    const answers = this.answers.all()
    if (answers.length === 0) return
    const soiree = this.soireeEnCours()
    if (!soiree) return
    const players = this.party.all()
    const scores = this.ledger.all()
    const gains = buildProgress({ players, scores, answers })
    const built = buildArchive({
      soiree,
      players,
      teams: this.teams.all(),
      bonuses: this.teams.allBonuses(),
      scores,
      answers,
      packsBySession: this.livePacks(),
      library: quizLibrary(this.spaceId),
    })
    const archive = built ? empreinteDArchive(built.archive) : null
    const credit = empreinteDuCredit(soiree.id, gains)
    // Rien n'a changé depuis le dernier passage arrivé en base : le podium,
    // puis « Terminer » sans que personne ait bougé entre les deux.
    if (archive === this.derniereArchive && credit === this.dernierCredit) return
    const recopie = this.recopierSoiree(soiree)
    await this.enFile(async () => {
      // Le passage d'avant attendait peut-être encore dans la file quand on a
      // demandé celui-ci : il a pu écrire exactement ceci.
      await recopie
      if (built && archive !== this.derniereArchive) {
        await this.deps.archives.save(this.spaceId, built.id, built.heldAt, built.archive)
        this.derniereArchive = archive
      }
      if (credit !== this.dernierCredit) {
        const montees = await this.crediterExperience(soiree.id, gains)
        // Les niveaux gagnés se voient de toute la salle, au podium du quiz —
        // le bandeau, et la pastille du podium qui est à l'écran.
        if (montees.length > 0) {
          this.deps.io.to(`hosts:${this.spaceId}`).emit('soiree:progres', { montees })
          this.engine.rafraichirVues()
        }
      }
      // Les niveaux ont pu monter : l'écran commun doit le montrer.
      this.broadcastSnapshot()
    })
  }

  /** Ce que la clôture crédite, lu d'un seul tenant. */
  private creditDeCloture(live: {
    players: ReturnType<Party['all']>
    scores: ReturnType<ScoreLedger['all']>
    answers: AnswerRow[]
  }): CreditDeCloture {
    const faits = hautsFaitsDeSoiree(live)
    const xpDesFaits = new Map([...faits].map(([id, cles]) => [id, xpDesHautsFaits(cles)]))
    const gains = buildProgress(live, { cloture: true, hautsFaits: xpDesFaits })
    const profilDuJoueur = new Map(gains.map(g => [g.playerId, g.profileId]))
    // Les prix du palmarès sont déjà calculés pour la page souvenir : ce sont
    // eux, tels quels, qui vont sur les étagères. Pas de second catalogue à
    // tenir, et ce que la salle lit sur le souvenir est exactement ce qui se
    // range.
    const prix = computeStats(live.answers, this.party.publicPlayers(this.ledger.allTotals())).awards
    const laureats: PrixDeSoiree[] = prix.flatMap(a => {
      // Un prix d'équipe n'a pas de lauréat, et un invité anonyme pas d'étagère.
      const profileId = a.player && profilDuJoueur.get(a.player.playerId)
      return profileId ? [{ profileId, badge: a.key, emoji: a.emoji, title: a.title }] : []
    })
    for (const [playerId, cles] of faits) {
      const profileId = profilDuJoueur.get(playerId)
      if (!profileId) continue
      for (const cle of cles) {
        const h = hautFaitDeSoiree(cle)
        if (h) laureats.push({ profileId, badge: h.key, emoji: h.emoji, title: h.title })
      }
    }
    // Un Divin ne se range que pour un profil ; l'annonce, elle, suit le
    // bilan de chacun, qui voit aussi l'Arbre-Monde descendre avec son
    // douzième légendaire.
    laureats.push(...laureatsDivins(divinsDeSoiree(live), profilDuJoueur))
    const prixDe = new Map<string, PrixAnnonce[]>()
    for (const a of prix) {
      if (!a.player) continue
      const liste = prixDe.get(a.player.playerId) ?? []
      liste.push({ key: a.key, emoji: a.emoji, title: a.title, detail: a.detail })
      prixDe.set(a.player.playerId, liste)
    }
    const inscrits = new Set(live.players.map(p => p.id))
    const joueurs = new Set(live.answers.filter(r => r.answered && inscrits.has(r.playerId)).map(r => r.playerId)).size
    return { gains, laureats, faits, releves: relevesDeSoiree(live, { cloture: true }), prix: prixDe, joueurs }
  }

  /**
   * Exclut un invité : il quitte la soirée avec tout ce qu'il y avait laissé.
   * Rend faux s'il n'en était pas — un invité d'une autre soirée n'est pas
   * dans cette liste, et rien ne se passe.
   */
  exclure(playerId: string): boolean {
    const joueur = this.party.get(playerId)
    if (!joueur) return false
    // Lus avant que rien ne bouge : effacé, l'invité ne dirait plus à quel
    // profil il était rattaché ; et c'est sous le nom de la soirée d'à
    // présent que son crédit a été écrit — une « Nouvelle soirée » cliquée
    // pendant que la file attend n'y change rien.
    const { profileId } = joueur
    this.effacerJetons([joueur.token])
    const soiree = this.soiree
    // Chaque registre efface ses lignes, et le miroir reçoit le tout — la
    // partie sans lui comprise — en une seule transaction : un réveil sur
    // disque effacé ne recharge jamais les gains d'un invité disparu.
    this.mirror.ouvrirLot()
    try {
      this.party.remove(playerId)
      // Ses gains et ses réponses partent avec lui : il ne doit plus peser
      // sur les prix, ni sur la question en cours.
      this.ledger.removePlayer(playerId)
      this.answers.removePlayer(playerId)
      this.engine.dropParticipant(playerId)
    } finally {
      this.mirror.fermerLot()
    }
    this.places.oublier(playerId)
    this.laissees.delete(playerId)
    this.broadcastSnapshot()
    // Son téléphone repart sur l'écran d'inscription, et sa connexion
    // n'incarne plus personne.
    for (const socket of this.detacher(playerId)) socket.emit('player:removed')
    // Ce que la soirée avait crédité à son profil repart avec lui. Sauf si
    // ce profil y joue encore sous un autre invité — ce qu'un profil ne doit
    // pas faire, mais le crédit s'y prépare (`buildProgress`) : sa ligne est
    // alors celle de l'autre, que le prochain crédit réécrira.
    if (profileId && soiree && !this.party.findByProfile(profileId)) {
      this.rendreCredit(profileId, soiree).catch(e => console.error('[xp]', e))
    }
    return true
  }

  /**
   * Fait paraître, pour la console, le code qui rend sa place à un invité
   * dont le téléphone est mort. Seulement hors ligne : la place d'un
   * téléphone qui répond encore n'est pas à donner.
   */
  rendrePlace(playerId: string): PlaceRendue {
    const fiche = this.party.get(playerId)
    if (!fiche) return { ok: false, error: 'Cet invité n’est plus dans la soirée' }
    if (this.party.isConnected(playerId)) {
      return { ok: false, error: 'Son téléphone est encore connecté — rien à rendre' }
    }
    // Jamais de code pour une fiche à profil : le téléphone qui le taperait
    // recevrait ensuite ce profil (`player:profil`, au podium et à la
    // clôture) — son identifiant, son expérience, les récits de ses Divins
    // (invariant 21). Sa porte existe déjà : se connecter à son profil rend
    // la fiche (`findByProfile`), derrière le mot de passe et `loginBudgetOf`.
    if (fiche.profileId) return { ok: false, error: 'Il a un profil : qu’il s’y connecte sur son nouveau téléphone' }
    return { ok: true, ...this.places.emettre(playerId, Date.now()) }
  }

  /** Il a joué ce soir — une réponse donnée, une ligne de gain : `laisserPlace` le gardera. */
  aJoueCeSoir(playerId: string): boolean {
    return this.answers.aRepondu(playerId) || this.ledger.aGagne(playerId)
  }

  /**
   * L'identité qu'un téléphone quitte pour reprendre sa place : le second
   * « Rachid », inscrit sur le téléphone emprunté en attendant.
   *
   * Sans rien joué — ni réponse donnée, ni point au journal —, il s'efface :
   * c'était la même personne, et le laisser ferait un fantôme de plus dans
   * la salle. S'il a joué, il reste avec ses points — les réunir à ceux de
   * la place reprise est un autre chantier, qui réécrirait deux journaux —,
   * mais on ne l'attend plus : son porteur joue désormais sous l'autre fiche,
   * et l'attendre referait le fantôme qu'on vient de chasser.
   */
  laisserPlace(playerId: string): 'efface' | 'garde' | null {
    if (!this.party.get(playerId) || this.party.isConnected(playerId)) return null
    if (!this.aJoueCeSoir(playerId)) {
      this.exclure(playerId)
      return 'efface'
    }
    const sessionId = this.engine.activeSessionId
    if (sessionId) this.engine.handleHostCommand(sessionId, { type: 'nePlusAttendre', playerId })
    this.laissees.add(playerId)
    return 'garde'
  }

  /**
   * Un invité exclu rend ce que la soirée avait déjà crédité à son profil.
   *
   * L'expérience se crédite dès le podium : exclu ensuite, l'invité partait
   * avec. Ses gains quittaient les journaux, mais sa ligne (profil, soirée)
   * restait en base — le crédit suivant ne réécrit que les profils encore
   * là —, et l'Éclat tiré sous ce nom avec elle. Les prix de la soirée, eux,
   * se remplacent déjà à chaque archivage, sur toute la soirée ; les badges
   * de carrière ne se reprennent jamais.
   *
   * À la file, comme les crédits : celui qu'on avait demandé avant
   * l'exclusion, encore en route, réécrirait sinon la ligne qu'on retire.
   */
  private rendreCredit(profileId: string, soiree: Soiree): Promise<void> {
    return this.enFile(async () => {
      // Une ligne qui change hors d'un crédit : l'empreinte du dernier ne
      // dit plus ce qui est en base.
      this.dernierCredit = null
      await this.deps.profiles.retirerSoiree(profileId, soiree.id)
      // S'il revient ce soir, il repart de zéro : son annonce aussi.
      this.xpAnnoncee.delete(`${soiree.id}:${profileId}`)
    })
  }

  /**
   * Les connexions qui incarnaient cet invité n'incarnent plus personne :
   * elles quittent son salon et oublient son identité. Rend celles qu'on a
   * détachées, pour que l'appelant leur dise pourquoi — une exclusion, ou
   * une nouvelle soirée.
   *
   * Un téléphone laissé tel quel gardait, côté serveur, l'identité d'un
   * invité effacé : ses réponses étaient refusées d'un « tu joues à la
   * prochaine question » que rien ne tiendrait, et le salon de l'invité
   * continuait de lui parler. L'exclusion et « Nouvelle soirée » avaient
   * chacune leur copie de ce geste, et elles commençaient à diverger.
   */
  private detacher(playerId: string) {
    const io = this.deps.io
    const salon = `player:${playerId}`
    return [...(io.sockets.adapter.rooms.get(salon) ?? [])].flatMap(id => {
      const socket = io.sockets.sockets.get(id)
      if (!socket) return []
      socket.leave(salon)
      // Une connexion qui incarne déjà quelqu'un d'autre garde son identité.
      if (socket.data.playerId === playerId) socket.data.playerId = undefined
      return [socket]
    })
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
   * Le journal rangé par équipe, gardé tant que ni le journal ni la
   * composition ne bougent : relu à chaque instantané, il coûtait 3,5 ms à
   * 30 000 lignes, et une vague de 500 reconnexions tenait la boucle près de
   * deux secondes.
   */
  private questionsVues: { cle: string; questions: ReturnType<typeof questionsDesEquipes> } | null = null
  private questionsDesEquipes(players: PublicPlayer[]) {
    const cle = `${this.answers.version}:${this.party.composition}`
    if (this.questionsVues?.cle !== cle) {
      this.questionsVues = { cle, questions: questionsDesEquipes(players, this.answers.lignesDesEquipes()) }
    }
    return this.questionsVues.questions
  }

  /**
   * L'état de la soirée. Le wifi n'est envoyé qu'à l'écran commun : c'est lui
   * qui l'affiche en QR, les téléphones n'ont pas à recevoir le mot de passe.
   * La santé de la sauvegarde aussi : c'est l'affaire de l'animateur, pas
   * celle d'un invité.
   */
  buildSnapshot(forHost: boolean): PartySnapshot {
    const snapshot = this.snapshotComplet()
    return forHost ? this.pourLesEcrans(snapshot) : this.pourLesTelephones(snapshot)
  }

  private snapshotComplet(): PartySnapshot {
    const space = this.publicSpace()
    const players = this.party.publicPlayers(this.ledger.allTotals())
    const bonuses = this.teams.allBonuses()
    const base = this.deps.baseUrl()
    const snapshot: PartySnapshot = {
      players,
      teams: teamScores(this.teams.all(), players, bonuses, this.questionsDesEquipes(players)),
      bonuses,
      session: this.engine.summary(),
      joinUrl: base ? `${base}/${space.slug}` : null,
      wifi: null,
      space,
    }
    return snapshot
  }

  /**
   * Ce que les téléphones reçoivent : la salle, sans dire qui est connecté.
   * Chaque veille d'écran, chaque retour, basculait un `connected` et
   * renvoyait la salle entière à chacun — à 300 invités, un gigaoctet pour
   * une vague d'arrivées une par une. Aucun téléphone ne le lisait, sauf
   * l'entrée pour compter les présents : elle compte désormais les inscrits.
   */
  private pourLesTelephones(snapshot: PartySnapshot): PartySnapshot {
    return { ...snapshot, players: snapshot.players.map(({ connected: _connected, ...p }) => p) }
  }

  /** Ce que l'écran commun reçoit en plus de la salle. */
  private pourLesEcrans(snapshot: PartySnapshot): PartySnapshot {
    return { ...snapshot, ...this.enPlusPourLesEcrans() }
  }

  /**
   * Ces champs changent rarement — une transition du miroir, un écran de fin
   * ouvert, une télécommande branchée : l'invariant 4 tient.
   */
  private enPlusPourLesEcrans(): Partial<PartySnapshot> {
    return {
      wifi: this.deps.wifi,
      // Absent quand tout va bien : il ne change qu'aux transitions, et
      // l'instantané dédoublonné n'en porte pas le poids le reste du temps.
      ...(this.mirror.enRetard() && { sauvegardeEnRetard: true as const }),
      ...(this.scene && { scene: this.scene }),
      ...(this.telecommandeBranchee() && { telecommande: true as const }),
    }
  }

  sendSnapshot(force = false) {
    const complet = this.snapshotComplet()
    this.envoyerAuxTelephones(complet, force)
    this.envoyerAuxEcrans(complet, force)
  }

  // ── La scène des écrans d'animateur ──

  /**
   * Ouvre un écran de fin de soirée sur tous les écrans d'animateur, ou
   * revient à la salle d'attente. `depuis`, quand il est donné, est l'écran
   * que le geste visait : si l'autre console a changé la scène entre-temps,
   * le geste est périmé et ignoré (invariant 12). La clôture ne s'ouvre pas
   * d'ici, et ne se quitte que pour la salle d'attente : elle raconte une
   * soirée qui n'existe plus, ses prix et son podium avec.
   */
  poserScene(ecran: EcranDeScene | null, onglet?: OngletDePodium, depuis?: EcranDeScene | null): boolean {
    const actuel = this.scene?.ecran ?? null
    if (depuis !== undefined && depuis !== actuel) return false
    if (ecran === 'cloture') return false
    if (actuel === 'cloture' && ecran !== null) return false
    // Un écran de fin ne s'ouvre pas par-dessus une question : une autre
    // console qui ouvrait le podium pendant qu'on jouait le posait sur la
    // télé, et les téléphones répondaient à une question que la salle ne
    // voyait plus. « Remise des prix », au podium du quiz, clôt la partie
    // d'abord (`host:endSession`, par la même connexion) : elle passe.
    if (ecran !== null && this.engine.activeSessionId) return false
    const suivante: Scene | null = ecran ? { ecran, ...(ecran === 'podium' && onglet && { onglet }) } : null
    if (JSON.stringify(suivante) === JSON.stringify(this.scene)) return false
    this.scene = suivante
    if (!suivante) this.derniereCloture = null
    this.sendSnapshot()
    return true
  }

  /**
   * Une nouvelle soirée commence — un premier invité s'inscrit, ou un quiz se
   * lance : la clôture d'hier cesse d'être la scène. Restée à l'écran, la
   * télé montrait le QR du souvenir de la veille à ceux qui arrivaient, au
   * lieu de celui pour rejoindre.
   */
  soireeCommence() {
    if (this.scene?.ecran !== 'cloture') return
    // Sans rien envoyer : la diffusion regroupée de l'inscription porte la
    // scène. Un envoi immédiat partait avant le rattachement au profil, et
    // les écrans voyaient l'invité sans son légendaire.
    this.scene = null
    this.derniereCloture = null
  }

  /** L'annonce de clôture encore à l'écran, pour un écran d'animateur qui se présente. */
  clotureAffichee(): ClotureDeSoiree | null {
    return this.scene?.ecran === 'cloture' ? this.derniereCloture : null
  }

  /** Un écran d'animateur de l'espace se tient-il en télécommande ? */
  private telecommandeBranchee(): boolean {
    const io = this.deps.io
    for (const id of io.sockets.adapter.rooms.get(`hosts:${this.spaceId}`) ?? []) {
      if (io.sockets.sockets.get(id)?.data.telecommande) return true
    }
    return false
  }

  private envoyerAuxTelephones(complet: PartySnapshot, force = false) {
    if (this.pending) clearTimeout(this.pending)
    this.pending = null
    const telephones = this.pourLesTelephones(complet)
    const json = JSON.stringify(telephones)
    if (!force && json === this.lastSnapshot) return
    this.lastSnapshot = json
    this.deps.io.to(`space:${this.spaceId}`).except(`hosts:${this.spaceId}`).emit('party:snapshot', telephones)
  }

  private envoyerAuxEcrans(complet: PartySnapshot, force = false) {
    if (this.pendingEcrans) clearTimeout(this.pendingEcrans)
    this.pendingEcrans = null
    const ecrans = this.pourLesEcrans(complet)
    const json = JSON.stringify(ecrans)
    if (!force && json === this.lastEcrans) return
    this.lastEcrans = json
    this.deps.io.to(`hosts:${this.spaceId}`).emit('party:snapshot', ecrans)
  }

  /**
   * Deux fenêtres de regroupement. Celle des téléphones grandit avec la
   * salle : 120 ms pour une tablée, une demi-seconde passé cent
   * quatre-vingt-dix invités. Chaque envoi y coûte à proportion de la salle
   * — sa liste, à chacun de ses téléphones —, et une vague d'arrivées une
   * par une en faisait autant de diffusions. Celle des écrans communs reste
   * à 120 ms : une ou deux connexions, et c'est là que l'animateur attend de
   * voir son quiz s'ouvrir après « Lancer » — la console ne l'ouvre qu'avec
   * la partie de l'instantané. Celui qui a fait le geste, lui, n'attend
   * aucune des deux : il reçoit le sien sur-le-champ (`player:join`).
   */
  broadcastSnapshot() {
    if (!this.pendingEcrans) {
      this.pendingEcrans = setTimeout(() => {
        this.pendingEcrans = null
        this.envoyerAuxEcrans(this.snapshotComplet())
      }, 120)
    }
    if (!this.pending) {
      this.pending = setTimeout(
        () => {
          this.pending = null
          this.envoyerAuxTelephones(this.snapshotComplet())
        },
        120 + 2 * this.party.count(),
      )
    }
  }

  // ── Les pages publiques : souvenir, bilan, historique ──
  //
  // Tout se calcule à partir des journaux (gains, réponses) par des fonctions
  // pures : la soirée en cours et une soirée archivée passent par le même
  // chemin, et une amélioration profite aux soirées passées.

  /**
   * Les copies exactes des quiz joués ce soir, lues dans l'état de chaque
   * partie. Elles ne vivaient que sur le disque local : le miroir retirait
   * une partie terminée, et après une mise en veille l'archive reprenait la
   * bibliothèque du jour. Le miroir les garde désormais jusqu'à « Nouvelle
   * soirée », et le réveil les recharge avec le reste.
   */
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

  /**
   * Ce que le quiz qu'on lance reprend de la soirée : l'enchaînement du
   * dernier quiz — il repassait « au clic » à chaque quiz, et l'animateur
   * qui pilotait debout devait le régler de nouveau — et les quiz déjà
   * joués. Lu dans les parties de la soirée : la clôture les efface, et
   * l'oubli vient avec.
   */
  lancementDeQuiz(): LancementDeQuiz {
    const rows = this.deps.db
      .prepare('SELECT state FROM sessions WHERE space_id = ? ORDER BY created_at')
      .all(this.spaceId) as { state: string }[]
    const joues = new Set<string>()
    let autoNextSeconds: number | null = null
    for (const row of rows) {
      try {
        const st = JSON.parse(row.state) as { pack?: { id?: unknown } | null; autoNextSeconds?: unknown }
        if (typeof st.pack?.id === 'string') joues.add(st.pack.id)
        autoNextSeconds = typeof st.autoNextSeconds === 'number' ? st.autoNextSeconds : null
      } catch {
        // Un état illisible n'apprend rien : le quiz part au clic.
      }
    }
    return { autoNextSeconds, joues: [...joues] }
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
      ...(this.aJoue() && this.soireeId() && { soireeId: this.soireeId()! }),
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
      // L'heure figée avec le nom de la soirée, celle que son archive portera.
      // Lue sur le premier invité ENCORE là, elle glissait dès qu'on excluait
      // le téléphone d'essai de l'animateur. Tant que le nom n'est pas tiré,
      // c'est l'heure qu'il prendra — sans le tirer ici : une page publique
      // ne décide pas du nom de la soirée.
      since: (this.soiree ?? soireeDesInvites(this.party.all(), rows, this.spaceId))?.heldAt ?? null,
    }
  }

  /**
   * Range la soirée en cours dans l'historique sous ce titre, sans la clore.
   * Null s'il n'y a rien à garder. Une même soirée rangée deux fois est mise
   * à jour.
   *
   * C'était « Sauvegarder ». La soirée se range désormais toute seule après
   * chaque quiz ; ce geste-là ne sert plus qu'à un écran resté sur une page
   * d'avant, et à donner un titre avant la clôture.
   */
  async archiveParty(title?: string): Promise<ArchiveSummary | null> {
    // Tout se lit ici, d'un seul tenant, avant la première attente : une
    // clôture cliquée pendant qu'on écrit au loin viderait les journaux sous
    // nos pieds, et l'archive et les crédits ne décriraient plus la même
    // soirée.
    const answers = this.answers.all()
    if (answers.length === 0) return null
    const soiree = this.soireeEnCours()
    if (!soiree) return null
    const players = this.party.all()
    const scores = this.ledger.all()
    const built = buildArchive({
      soiree,
      players,
      teams: this.teams.all(),
      bonuses: this.teams.allBonuses(),
      scores,
      answers,
      packsBySession: this.livePacks(),
      library: quizLibrary(this.spaceId),
    })
    if (!built) return null
    const gains = buildProgress({ players, scores, answers })
    const recopie = this.recopierSoiree(soiree)
    return this.enFile(async () => {
      await recopie
      const summary = await this.deps.archives.save(this.spaceId, built.id, built.heldAt, built.archive, title)
      this.derniereArchive = empreinteDArchive(built.archive)
      await this.crediterExperience(soiree.id, gains)
      this.broadcastSnapshot()
      return summary
    })
  }

  /**
   * Clôt la soirée : le seul geste de fin.
   *
   * Elle se range une dernière fois dans l'historique, sous le titre donné ;
   * ce qui ne se décide qu'une fois tout joué est crédité — le podium de la
   * soirée, l'assiduité, les prix du palmarès, les hauts faits, les paliers
   * de carrière, et donc les avatars légendaires ; chaque téléphone reçoit sa
   * fin de soirée, l'écran commun la sienne ; puis la soirée suivante part de
   * zéro. Rend l'archive, ou null s'il n'y avait rien à garder.
   *
   * Rien ne s'efface tant que rien ne s'est écrit au loin : si la base
   * distante ne répond pas, la soirée reste là, entière, et l'animateur le
   * lit.
   */
  async closeParty(title?: string): Promise<ArchiveSummary | null> {
    this.fermeture = true
    try {
      // La partie en cours se termine d'abord : ses questions déjà révélées
      // comptent, celle qui était ouverte non.
      const running = this.engine.activeSessionId
      if (running) this.engine.endSession(running)
      const answers = this.answers.all()
      const players = this.party.all()
      const scores = this.ledger.all()
      const soiree = answers.length > 0 ? this.soireeEnCours() : null
      const built = soiree
        ? buildArchive({
            soiree,
            players,
            teams: this.teams.all(),
            bonuses: this.teams.allBonuses(),
            scores,
            answers,
            packsBySession: this.livePacks(),
            library: quizLibrary(this.spaceId),
          })
        : null
      let summary: ArchiveSummary | null = null
      let annonce: (() => void) | undefined
      if (soiree && built) {
        // Dès ici, pour les paliers des autres espaces, cette soirée est
        // close : elle ne rendra plus que ce qu'elle a déjà écrit.
        this.deps.cloturesEnCours.add(this.spaceId)
        const credit = this.creditDeCloture({ players, scores, answers })
        const recopie = this.recopierSoiree(soiree)
        const bilans = await this.enFile(async () => {
          await recopie
          const archive = await this.deps.archives.save(this.spaceId, built.id, built.heldAt, built.archive, title)
          return { archive, profils: await this.crediterCloture(soiree.id, credit) }
        })
        // Les figures se lisent APRÈS les crédits : le podium de la clôture
        // montre le niveau que la soirée vient de donner, pas celui d'avant.
        const figures = new Map(players.map(p => [p.id, this.figure(p.id)]))
        const close = bilans.archive
        summary = close
        annonce = () => this.annoncerFin(close, players, credit, bilans.profils, figures)
      }
      // La fin de soirée ne part qu'une fois la soirée effacée : un miroir
      // qui refuse d'effacer laisse la soirée là, entière, et ses téléphones
      // n'ont pas à lire « c'est fini » pour une soirée qui continue. Une
      // soirée où rien ne s'est joué n'a pas de fin à raconter : ses
      // téléphones repassent par l'entrée, comme après un essai effacé.
      await this.viderSoiree(summary ? 'close' : 'discard', annonce)
      // Une soirée sans rien de joué s'efface comme un essai : ses jetons non plus
      // n'ont pas de soirée close à revoir.
      if (!summary) this.effacerJetons(players.map(p => p.token))
      return summary
    } finally {
      // Close pour de bon, sa ligne est partie ; refusée par le miroir, elle
      // se joue encore et redevient une soirée en cours pour les autres.
      this.deps.cloturesEnCours.delete(this.spaceId)
      this.fermeture = false
    }
  }

  /**
   * Crédite ce que la clôture décide, profil par profil, et rend pour chacun
   * de quoi lui raconter sa soirée : l'expérience, le niveau avant et après,
   * les paliers tombés, les légendaires et les finitions débloqués.
   */
  private async crediterCloture(
    soireeId: string,
    credit: CreditDeCloture,
  ): Promise<Map<string, NonNullable<FinDeSoiree['profil']>>> {
    const avant = new Map<string, { legendaires: string[]; divins: string[] }>()
    await enParallele(credit.gains, PROFILS_EN_VOL, async g => {
      await this.deps.profiles.byId(g.profileId).catch(() => null)
      avant.set(g.profileId, {
        legendaires: this.deps.profiles.legendairesOf(g.profileId),
        divins: this.deps.profiles.divinsOf(g.profileId),
      })
    })
    await this.crediterExperience(soireeId, credit.gains)
    // Les récompenses se remplacent, comme l'expérience — et même sans aucun
    // profil ce soir : celles qu'un passage précédent avait rangées doivent
    // pouvoir repartir.
    await this.deps.profiles.remplacerRecompensesDeSoiree(soireeId, this.spaceId, credit.laureats)
    const bilans = new Map<string, NonNullable<FinDeSoiree['profil']>>()
    const ailleurs = this.soireesEnCoursAilleurs()
    await enParallele(credit.gains, PROFILS_EN_VOL, async g => {
      // Les paliers de carrière viennent en dernier : ils se décident sur les
      // totaux, expérience et hauts faits de ce soir compris — mais pas sur
      // les soirées qui se jouent encore dans d'autres espaces.
      const paliers = await this.deps.profiles.accorderPaliers(g.profileId, soireeId, this.spaceId, ailleurs)
      const profil = await this.deps.profiles.byId(g.profileId).catch(() => null)
      if (!profil) return
      const xpPaliers = paliers.reduce((n, cle) => n + (palierDe(cle) ? XP_PALIER[palierDe(cle)!.palier - 1] : 0), 0)
      const xpSoiree = g.xp + xpPaliers
      const gardes = this.deps.profiles.gardesOf(g.profileId)
      const niveauAvant = niveauDuProfil(profil.xp - xpSoiree, gardes)
      const niveauApres = niveauDuProfil(profil.xp, gardes)
      const deja = avant.get(g.profileId)?.legendaires ?? []
      const dejaDivins = avant.get(g.profileId)?.divins ?? []
      // L'Éclat a pu tomber à n'importe quel podium de la soirée : c'est ici
      // qu'on le dit, une fois tout joué.
      const eclat = await this.deps.profiles.eclatDeLaSoiree(g.profileId, soireeId).catch(() => null)
      bilans.set(g.playerId, {
        xp: xpSoiree,
        xpPaliers,
        niveauAvant,
        niveauApres,
        paliers: paliers.map(annonceDe).filter((a): a is HautFaitAnnonce => !!a),
        legendaires: this.deps.profiles.legendairesOf(g.profileId).filter(l => !deja.includes(l)),
        // Le douzième légendaire fait descendre l'Arbre-Monde : il se compare
        // comme les autres, avant et après.
        divins: raconter(this.deps.profiles.divinsOf(g.profileId).filter(d => !dejaDivins.includes(d))),
        finitions: finitionsOuvertes(niveauApres).filter(f => !finitionsOuvertes(niveauAvant).includes(f)) as Finition[],
        ...(eclat && { eclat }),
      })
      // Le profil à jour, pour les pages qui l'affichent encore.
      this.deps.io.to(`player:${g.playerId}`).emit('player:profil', this.deps.profiles.toPublic(profil))
    })
    return bilans
  }

  /**
   * Raconte la soirée close : à chaque téléphone la sienne, à l'écran commun
   * celle de la salle. Les jetons de la soirée gardent leur fin, pour un
   * téléphone qui dormait.
   */
  private annoncerFin(
    summary: ArchiveSummary,
    players: ReturnType<Party['all']>,
    credit: CreditDeCloture,
    profils: Map<string, NonNullable<FinDeSoiree['profil']>>,
    figures: Map<string, Figure | null>,
  ) {
    const space = this.publicSpace()
    const soiree: SoireeClose = { id: summary.id, titre: summary.title, slug: space.slug }
    const fins = new Map<string, FinDeSoiree>()
    for (const p of players) {
      const x = credit.releves.get(p.id)
      const figure = figures.get(p.id)
      const fin: FinDeSoiree = {
        soiree,
        // Seulement s'il figure au journal : l'arrivé après la dernière
        // question n'est pas dans l'archive, et « Mon bilan » lui demandait
        // « Qui es-tu ? ».
        ...(x && { joueurId: p.id }),
        nom: figure?.nom ?? p.name,
        avatar: p.avatar,
        // Ce qu'il porte ce soir — sa finition, son légendaire : sa fin de
        // soirée le montre comme la salle l'a vu.
        ...(figure && distinctions(figure)),
        rang: x?.releve.rang ?? 0,
        points: x?.releve.points ?? 0,
        // Arrivé après la dernière question, il n'a pas de relevé : la salle,
        // elle, a bien joué — il lisait « 0 joueurs ce soir ». Comptée comme
        // le relevé la compte, ceux qui ont répondu : la fiche compte aussi
        // ceux qui n'ont fait que passer, et lui lisait un autre chiffre que
        // la salle.
        joueurs: x?.releve.joueurs ?? credit.joueurs,
        aJoue: (x?.releve.reponses ?? 0) > 0,
        ...(credit.prix.has(p.id) && { prix: credit.prix.get(p.id) }),
        hautsFaits: (credit.faits.get(p.id) ?? []).map(annonceDe).filter((a): a is HautFaitAnnonce => !!a),
        ...(profils.has(p.id) && { profil: profils.get(p.id) }),
      }
      fins.set(p.token, fin)
      this.deps.io.to(`player:${p.id}`).emit('soiree:fin', fin)
    }
    this.dernieresFins = fins
    // La mémoire sait désormais la dernière soirée close, sans rien relire.
    this.derniereConnue = { id: summary.id, title: summary.title, heldAt: summary.heldAt }
    this.generationDerniere++

    const releveDe = (id: string) => credit.releves.get(id)?.releve
    const podium = players
      .filter(p => {
        const rang = releveDe(p.id)?.rang ?? 0
        return rang >= 1 && rang <= 3
      })
      .sort((a, b) => (releveDe(a.id)?.rang ?? 0) - (releveDe(b.id)?.rang ?? 0))
      .flatMap(p => {
        const figure = figures.get(p.id)
        return figure ? [{ ...figure, points: releveDe(p.id)!.points, rang: releveDe(p.id)!.rang }] : []
      })
    const cloture: ClotureDeSoiree = {
      soiree,
      podium,
      // Le verdict que l'historique gardera : l'écran de clôture ne disait
      // rien des équipes, qui décident pourtant de la soirée.
      equipes: summary.teamWinners.map(t => ({ nom: t.name, emoji: t.emoji, points: t.points })),
      hautsFaits: players.flatMap(p => {
        const faits = (credit.faits.get(p.id) ?? []).map(annonceDe).filter((a): a is HautFaitAnnonce => !!a)
        const figure = figures.get(p.id)
        return faits.length > 0 && figure ? [{ ...figure, faits }] : []
      }),
      legendaires: players.flatMap(p => {
        const figure = figures.get(p.id)
        return figure ? (profils.get(p.id)?.legendaires ?? []).map(gagne => ({ ...figure, gagne })) : []
      }),
      divins: players.flatMap(p => {
        const figure = figures.get(p.id)
        // La salle voit le Divin et son nom — son récit reste à son porteur.
        return figure ? (profils.get(p.id)?.divins ?? []).map(d => ({ ...figure, gagne: d.key })) : []
      }),
      montees: players.flatMap(p => {
        const b = profils.get(p.id)
        const figure = figures.get(p.id)
        return b && figure && b.niveauApres > b.niveauAvant ? [{ ...figure, avant: b.niveauAvant, apres: b.niveauApres }] : []
      }),
      eclats: players.flatMap(p => {
        const eclate = profils.get(p.id)?.eclat
        const figure = figures.get(p.id)
        return eclate && figure ? [{ ...figure, eclate }] : []
      }),
    }
    this.deps.io.to(`hosts:${this.spaceId}`).emit('soiree:cloture', cloture)
    // La clôture prend tous les écrans d'animateur, et y reste jusqu'à « La
    // soirée suivante » — cliquée n'importe où, elle les libère tous.
    this.scene = { ecran: 'cloture' }
    this.derniereCloture = cloture
    this.sendSnapshot()
  }

  /**
   * C'était un essai : la soirée s'efface sans rien laisser. Son archive —
   * elle s'en faisait une après chaque quiz — et tout ce qu'elle avait
   * crédité aux profils repartent avec elle : expérience, Éclats, prix,
   * hauts faits. Les téléphones repassent par l'entrée.
   */
  async discardParty(): Promise<void> {
    this.fermeture = true
    try {
      const running = this.engine.activeSessionId
      if (running) this.engine.endSession(running)
      // Le nom tel qu'il est, sans en tirer un : une soirée qui n'a rien
      // écrit au loin n'a rien à reprendre.
      const soiree = this.soiree
      await this.enFile(async () => {
        if (!soiree) return
        await this.deps.archives.remove(this.spaceId, soiree.id)
        await this.deps.profiles.retirerSoireeEntiere(soiree.id, this.spaceId)
      })
      this.dernieresFins = new Map()
      const jetons = this.party.all().map(p => p.token)
      await this.viderSoiree('discard')
      this.effacerJetons(jetons)
    } finally {
      this.fermeture = false
    }
  }

  /** Ancien « Nouvelle soirée » : c'est désormais la clôture. */
  resetParty(): Promise<ArchiveSummary | null> {
    return this.closeParty()
  }

  /**
   * Repart d'une soirée vierge.
   *
   * Rien ne s'efface ici tant que rien ne s'est effacé au loin : le miroir
   * d'abord, la base locale en dernier. On vidait la base locale avant le
   * miroir : quand celui-ci refusait, l'animateur lisait « Rien n'a été
   * effacé » devant une salle vide, et l'ancienne soirée, restée au miroir,
   * ressuscitait au premier réveil.
   */
  private async viderSoiree(raison: 'close' | 'discard', annoncer?: () => void) {
    // Le miroir suspend ses envois, laisse finir ce qui est en vol, s'efface,
    // puis vide sa file — c'était la soirée effacée. Ce qui suit ne tourne
    // que s'il y est arrivé, et pendant que ses envois sont encore suspendus.
    await this.mirror.reset(() => {
      this.party.clearAll()
      this.places.oublier()
      this.laissees.clear()
      this.xpAnnoncee.clear()
      this.dernierCredit = null
      this.derniereArchive = null
      this.teams.clearAll()
      this.ledger.clearAll()
      this.answers.clearAll()
      // Une partie encore là se termine APRÈS que les journaux sont vidés.
      const running = this.engine.activeSessionId
      if (running) this.engine.endSession(running)
      // Ses parties partent avec elle, copies des quiz comprises : l'archive
      // les garde désormais.
      this.deps.db.prepare('DELETE FROM sessions WHERE space_id = ?').run(this.spaceId)
      // La seule porte qui ouvre une nouvelle soirée, et donc le seul endroit
      // où l'on oublie son nom.
      this.oublierSoiree()
      // Les écrans de fin montraient la soirée effacée.
      this.scene = null
      this.derniereCloture = null
    })
    this.broadcastSnapshot()
    // Les téléphones de la soirée effacée n'incarnent plus personne. Laissés
    // tels quels, ils restaient sur un en-tête vide, « 0 pts », « Personne
    // pour l'instant… », et le quiz suivant partait sans aucun participant.
    // Une clôture leur a déjà envoyé leur fin de soirée ; un essai effacé les
    // renvoie à l'entrée, pré-remplie. Un téléphone qui a rejoint la nouvelle
    // soirée pendant l'attente du miroir, lui, a déjà un invité qui existe :
    // on n'y touche pas.
    //
    // La salle vide part d'abord, sans attendre le regroupement : l'entrée
    // qui s'ouvre sur le téléphone lit la liste des invités, et celle d'avant
    // lui faisait prendre sa propre identité effacée pour un homonyme.
    this.sendSnapshot()
    // La fin de soirée part derrière la salle vide, et avant qu'on ne
    // détache les téléphones : elle passe par le salon de chaque invité,
    // qu'ils vont quitter.
    annoncer?.()
    const io = this.deps.io
    const effaces = new Set<string>()
    for (const id of io.sockets.adapter.rooms.get(`space:${this.spaceId}`) ?? []) {
      const playerId = io.sockets.sockets.get(id)?.data.playerId
      if (playerId && !this.party.get(playerId)) effaces.add(playerId)
    }
    for (const playerId of effaces) {
      for (const socket of this.detacher(playerId)) if (raison === 'discard') socket.emit('party:reset')
    }
  }

  stop() {
    if (this.pending) clearTimeout(this.pending)
    if (this.pendingEcrans) clearTimeout(this.pendingEcrans)
    this.pending = null
    this.pendingEcrans = null
    this.engine.stop()
  }
}

const ORDRE_RARETE: Record<Rarete, number> = { legendaire: 5, epique: 4, rare: 3, peucommune: 2, commune: 1 }

/** Les récompenses les plus rares d'abord, puis les plus souvent regagnées, puis les plus récentes. */
function plusRares(vitrine: BadgePorte[], n: number): BadgePorte[] {
  const rang = (b: BadgePorte) => (b.rarete ? ORDRE_RARETE[b.rarete] : 0)
  return [...vitrine].sort((a, b) => rang(b) - rang(a) || b.fois - a.fois || b.dernier - a.dernier).slice(0, n)
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

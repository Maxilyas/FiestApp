import { createHash } from 'node:crypto'
import type { InStatement } from '@libsql/client'
import { deplier, estDuCabinet, idDuTableau } from '../../../shared/cabinet/pieces'
import { horsDeLaBase } from '../../../shared/horsDeLaBase'
import { jourDe } from '../../../shared/jour'
import { CARTES_DU_SECOND_ESSAI } from '../../../shared/rencontres'
import { apresUnPassage, type SuiviDeRevision } from '../../../shared/revision'
import { questionsDuTableau } from './details'

// Le journal des réponses de campagne, gardé en mémoire et lu par différence.
//
// Turso compte au quota chaque ligne qu'une requête parcourt, pas celles
// qu'elle rend : 500 millions par mois, 333 déjà lus le 22 octobre 2026, sur
// une base de vingt-deux mille réponses. Chaque lecture relisait toute une
// histoire — la mesure des difficultés, 172 000 lignes toutes les dix minutes
// d'activité (et 3,2 s chez Turso, sur le chemin du duel qui la trouvait
// périmée) ; le modèle du savoir, 87 000 à chaque ajustement ; l'expérience
// d'un fidèle, 12 000 à chaque bonne réponse ; ses écussons, ce qu'il a vu,
// ses premières réponses, ses missions, à chaque page ; son carnet, 14 000 à
// chaque accueil du plus assidu. Le coût de chaque page grandissait avec
// l'histoire, et celui de la journée avec son carré.
//
// Une réponse ne change jamais — `oublierProfil` seul en efface —, et son
// `rowid` ne fait que croître : le journal lit une fois ce qui est écrit,
// puis seulement ce qui est arrivé depuis le plus grand qu'il a lu
// (`lectureDuJournal`), dans le lot de la requête qui en a besoin. Ce qu'il
// garde sont les dérivations mêmes que relisaient les requêtes d'avant —
// chacune avec ses filtres, `journal-des-reponses.test.ts` les compare au
// SQL d'avant sur une base au hasard —, sauf ce qu'il a vu, qui y ajoute les
// questions de la base qu'une pièce du Cabinet a montrées (`vuesDe`) : le
// même test le compare au SQL d'avant, déplié. Rien de ce qu'il en tire ne s'écrit :
// il se relit en entier au démarrage — de ses tranches gardées, plus bas —,
// et une règle changée vaut toujours pour tout ce qui a été joué.

const HEURE_MS = 3600_000

/**
 * Ce que le journal garde des réponses récentes, une à une : de quoi juger
 * les missions (`activiteDepuis`), qui remontent au lundi d'il y a deux
 * semaines — treize jours et demi au plus. Au-delà, la requête d'avant.
 */
export const FENETRE_DES_RECENTES_MS = 16 * 24 * HEURE_MS

/**
 * Combien de réponses une lecture du journal rapporte au plus : la première
 * le relit par tranches, chacune décodée à son tour de boucle — deux mille
 * réponses font 300 Ko de texte, quelques millisecondes à décoder.
 */
export const REPONSES_PAR_LECTURE = 2000

/** Une réponse telle que le journal la lit : ce que chaque lecture d'avant prenait dans sa ligne et dans sa série. */
export interface ReponseDuJournal {
  /** Son `rowid` : la lecture suivante part du plus grand lu. */
  n: number
  /** Le profil de sa série ; null quand la série n'existe plus (une réponse écrite à la main, dans un test). */
  qui: string | null
  serie: string
  question: string
  juste: boolean
  le: number
  /** Un choix donné (`choix IS NOT NULL`) : sans, le temps a fini la question. */
  repondue: boolean
  /** Un joker de l'expédition l'a aidée, ou une autre forme l'a posée (`joker`, `forme`). */
  aidee: boolean
  /** Lesquels : le carnet tient pour ratée une réponse qu'une carte du second essai a aidée, et écarte un vrai ou faux trouvé. */
  joker: string | null
  forme: string | null
  mode: string | null
  commencee: number | null
  /** Le défi de sa série, et le duel avec sa fermeture : ouverts, ils tiennent sa réponse hors du carnet (`suivisDe`). */
  semaine: string | null
  duel: string | null
  fermeLe: number | null
  /** Ce que sa série a gardé de la question : reprise du carnet (`HORS_DU_CARNET`), catégorie, marche. */
  carnet: unknown
  categorie: string | null
  niveau: string | null
  /**
   * Ce que sa pièce du Cabinet a montré de plus qu'elle (`PieceDuCabinet.cabinet.montre`) : les leurres d'un Détail,
   * ce que « Changer » a remplacé. Vu à son heure, rien d'autre — ni réponse, ni carnet, ni mesure. Null sans rien.
   */
  montre: readonly string[] | null
  /** Le compagnon de sa niche quand il a répondu (`campagne_reponses.compagnon`) : une bonne réponse le fait grandir. */
  compagnon: string | null
  /** Son épreuve d'un sentier (`mode = 'sentier'`) : son palier, sa branche, et si c'est un rejeu ; null hors des sentiers. */
  epreuve: { palier: number; branche: string | null; rejeu: boolean } | null
  /**
   * La mauvaise réponse qu'il a choisie, en texte, telle que sa série l'a
   * posée — un index ne dit rien d'une série à l'autre, chacune bat ses
   * réponses ; null pour une juste, une question laissée, un composé du
   * Cabinet (`choix` −1). Les leurres de l'Éclair la lisent (`leurresChoisis`).
   */
  choisie: string | null
}

/**
 * Ce qui est arrivé depuis `depuis`, en un seul texte JSON — une ligne par
 * réponse se décodait à coups de `defineProperty` (règle `campagne.md`). Le
 * `rowid` mène la lecture (`LEFT JOIN` : la réponse d'abord, sa série par sa
 * clé, le duel de sa série par la sienne) : Turso ne parcourt que les
 * réponses neuves, leurs séries et leurs duels. Ce que la série a gardé de
 * chaque question, d'un seul `json_extract` à quatre chemins — la reprise du
 * carnet, la catégorie, la marche et, d'une pièce du Cabinet, ce qu'elle a
 * montré de plus qu'elle (`cabinet.montre`) —, sous `json_valid` : la lecture
 * part aussi dans le lot qui écrit une réponse, et un JSON illisible n'y doit
 * rien faire échouer. D'une épreuve des sentiers, son palier, sa branche et
 * son rejeu (`reponsesDesEpreuves`). D'une réponse
 * fausse, le texte qu'il a choisi (`choisie`), sous la même garde et sous
 * `choix >= 0` : un chemin `[-1]` est une erreur de SQLite, pas un NULL, et
 * ferait échouer toute la lecture.
 */
export function lectureDuJournal(depuis: number, limite = REPONSES_PAR_LECTURE): InStatement {
  return { sql: LECTURE_DU_JOURNAL, args: [depuis, limite] }
}

const LECTURE_DU_JOURNAL = `SELECT COUNT(*) AS lues, MAX(n) AS jusqua,
                 json_group_array(json_array(n, qui, serie, question, juste, le, repondue, joker, forme, mode, commencee, semaine, duel, ferme, json(detail), compagnon, json(epreuve), choisie)) AS lignes
          FROM (SELECT r.rowid AS n, s.profile_id AS qui, r.serie_id AS serie, r.reserve_id AS question, r.juste AS juste, r.repondue_le AS le,
                       r.choix IS NOT NULL AS repondue, r.joker AS joker, r.forme AS forme, r.compagnon AS compagnon, s.mode AS mode, s.commencee_le AS commencee,
                       s.semaine AS semaine, s.duel AS duel, d.ferme_le AS ferme,
                       CASE WHEN json_valid(s.questions)
                            THEN json_extract(s.questions, '$[' || r.position || '].carnet', '$[' || r.position || '].categorie', '$[' || r.position || '].niveau', '$[' || r.position || '].cabinet.montre')
                       END AS detail,
                       CASE WHEN s.mode = 'sentier' THEN json_array(s.palier, s.branche, s.rejeu) END AS epreuve,
                       CASE WHEN r.juste = 0 AND r.choix >= 0 AND json_valid(s.questions)
                            THEN json_extract(s.questions, '$[' || r.position || '].reponses[' || r.choix || ']')
                       END AS choisie
                FROM campagne_reponses r LEFT JOIN campagne_series s ON s.id = r.serie_id LEFT JOIN campagne_duels d ON d.code = s.duel
                WHERE r.rowid > ? ORDER BY r.rowid LIMIT ?)`

// ── Les tranches gardées ─────────────────────────────────────────────────
//
// Le journal se relisait en entier à chaque démarrage : 47 000 lignes au
// quota de Turso pour vingt-deux mille réponses, sept réveils par jour le 23
// octobre 2026 — 6 % du quota à lui seul, et deux fois plus à chaque
// doublement de l'histoire. Ses lectures se gardent donc dans la base telles
// qu'elles sont parties (`campagne_tranches`) : deux mille réponses par
// ligne, le texte même que `lectureDuJournal` rend, rangé sous le `rowid`
// d'où elle partait. Un réveil relit ses tranches — une ligne chacune —, puis
// seulement ce qui est arrivé après la dernière, moins de deux mille
// réponses ; ce que le journal relit ensuite se range à son tour en fond,
// deux mille réponses à la fois (`CampagneStore.garderLesTranches`).
//
// Ce qu'une tranche dit ne bouge pas, tant que rien ne s'efface : une
// réponse ne change jamais — et une réponse effacée ou modifiée, ou une
// série effacée, efface toutes les tranches (`DECLENCHEURS_DES_TRANCHES`,
// quoi qu'il l'efface : `oublierProfil`, un test, une main). Seule la
// fermeture d'un duel se lit dans sa ligne et peut avancer depuis
// (`annulerUnDuel`) : les duels que les tranches disent ouverts se relisent
// au réveil. Une lecture qui change de forme n'en relit pas une d'avant
// (`VERSION_DES_TRANCHES`). Et des tranches qu'on ne peut relire ne coûtent
// que la relecture d'avant elles : la base relit tout ce qui les suit.

/**
 * La version des tranches : l'empreinte du texte de la lecture qui les a
 * écrites. Une colonne de plus, un chemin de plus, et les tranches d'avant
 * ne se relisent plus — rien à penser à monter.
 */
export const VERSION_DES_TRANCHES = createHash('sha256').update(LECTURE_DU_JOURNAL).digest('hex').slice(0, 16)

/**
 * Combien de tranches un aller-retour rapporte au plus : quatre, moins de
 * deux mégaoctets — une réponse de Turso a sa limite, la sauvegarde lit par
 * pages de deux (`PAGE_OCTETS`, `scripts/sauvegarde.ts`).
 */
export const TRANCHES_PAR_LECTURE = 4

/**
 * Une réponse effacée, une réponse qui change ou une série effacée : les
 * tranches ne disent plus ce que dirait la base, elles s'effacent toutes, dans
 * la même transaction.
 */
export const DECLENCHEURS_DES_TRANCHES = [
  'CREATE TRIGGER IF NOT EXISTS campagne_tranches_reponse_effacee AFTER DELETE ON campagne_reponses BEGIN DELETE FROM campagne_tranches; END',
  'CREATE TRIGGER IF NOT EXISTS campagne_tranches_reponse_changee AFTER UPDATE ON campagne_reponses BEGIN DELETE FROM campagne_tranches; END',
  'CREATE TRIGGER IF NOT EXISTS campagne_tranches_serie_effacee AFTER DELETE ON campagne_series BEGIN DELETE FROM campagne_tranches; END',
]

/** Les tranches de la version du jour à partir de `debut`, dans l'ordre. */
export function lectureDesTranches(debut: number): InStatement {
  return {
    sql: 'SELECT debut, jusqua, lues, lignes FROM campagne_tranches WHERE version = ? AND debut >= ? ORDER BY debut LIMIT ?',
    args: [VERSION_DES_TRANCHES, debut, TRANCHES_PAR_LECTURE],
  }
}

/**
 * La tranche qui part de `debut`, écrite par la base elle-même : la lecture
 * du journal, rangée telle quelle sans faire le voyage — pleine seulement.
 * Rend son `jusqua`, ou rien.
 */
export function ecritureDUneTranche(debut: number, le: number): InStatement {
  return {
    sql: `INSERT OR REPLACE INTO campagne_tranches (version, debut, jusqua, lues, lignes, ecrite_le)
          SELECT ?, ?, jusqua, lues, lignes, ? FROM (${LECTURE_DU_JOURNAL}) WHERE lues = ?
          RETURNING jusqua`,
    args: [VERSION_DES_TRANCHES, debut, le, debut, REPONSES_PAR_LECTURE, REPONSES_PAR_LECTURE],
  }
}

/** Une lecture du journal, décodée : ses réponses, le plus grand `rowid` lu, et s'il en reste derrière. */
export interface LectureDuJournal {
  reponses: ReponseDuJournal[]
  jusqua: number
  /** La lecture a rendu sa limite : il en reste peut-être, la suivante les lira. */
  aSuivre: boolean
}

const texteOuNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
const nombreOuNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/** La ligne que rend `lectureDuJournal`, décodée. */
export function lireLeJournal(ligne: Record<string, unknown> | undefined, limite = REPONSES_PAR_LECTURE): LectureDuJournal {
  const lues = Number(ligne?.lues ?? 0)
  const texte = ligne?.lignes
  const brutes = typeof texte === 'string' ? (JSON.parse(texte) as unknown[][]) : []
  const reponses = brutes.map(([n, qui, serie, question, juste, le, repondue, joker, forme, mode, commencee, semaine, duel, ferme, detail, compagnon, epreuve, choisie]): ReponseDuJournal => {
    const [carnet, categorie, niveau, montre] = Array.isArray(detail) ? detail : [null, null, null, null]
    const montrees = Array.isArray(montre) ? montre.filter((id): id is string => typeof id === 'string') : []
    const sonJoker = texteOuNull(joker)
    const saForme = texteOuNull(forme)
    return {
      n: Number(n),
      qui: texteOuNull(qui),
      serie: String(serie),
      question: String(question),
      juste: Number(juste) === 1,
      le: Number(le),
      repondue: Number(repondue) === 1,
      aidee: sonJoker !== null || saForme !== null,
      joker: sonJoker,
      forme: saForme,
      mode: texteOuNull(mode),
      commencee: nombreOuNull(commencee),
      semaine: texteOuNull(semaine),
      duel: texteOuNull(duel),
      fermeLe: nombreOuNull(ferme),
      carnet: carnet ?? null,
      categorie: texteOuNull(categorie),
      niveau: texteOuNull(niveau),
      montre: montrees.length > 0 ? montrees : null,
      compagnon: texteOuNull(compagnon),
      epreuve: Array.isArray(epreuve) ? { palier: Number(epreuve[0]), branche: texteOuNull(epreuve[1]), rejeu: Number(epreuve[2]) === 1 } : null,
      // Un texte seulement : un chemin qui tombe sur un objet ou un nombre — une série d'une forme à elle — ne dit pas de leurre.
      choisie: typeof choisie === 'string' ? choisie : null,
    }
  })
  return { reponses, jusqua: ligne?.jusqua === null || ligne?.jusqua === undefined ? 0 : Number(ligne.jusqua), aSuivre: lues >= limite }
}

/**
 * Sa première réponse à une question, d'un nombre : `repondue_le * 4 + aidée
 * * 2 + juste`, le plus petit de ses réponses — l'instant d'abord, puis si un
 * joker ou une autre forme l'a aidée, puis si elle était juste. Une révision
 * ne pose que ce qu'il a déjà vu : sa première réponse n'y est jamais. Rend
 * sa justesse, ou null : pas nue — deux réponses effacées, deux questions au
 * choix, un vrai ou faux, un intitulé à mi-mot —, elle ne dit rien de son
 * savoir, et aucune d'après ne la remplace : il avait vu la correction.
 */
export function premiereReponse(code: number): 0 | 1 | null {
  if (!Number.isFinite(code)) return null
  return code % 4 >= 2 ? null : code % 2 === 1 ? 1 : 0
}

/** Reprise du carnet par une source de l'expédition, comme `json_extract(...) = 1` la lisait. */
const carnetUn = (carnet: unknown) => carnet === 1 || carnet === true

/**
 * Une réponse qui dit le savoir : nue — aucun joker de l'expédition ne l'a
 * aidée (`campagne_reponses.joker` : deux réponses effacées, un indice, deux
 * questions au choix), posée telle que la base l'a écrite
 * (`campagne_reponses.forme` : à six choix, en vrai ou faux tiré d'une autre,
 * dévoilée à mi-mot, une question n'a plus sa difficulté) — et qui ne reprend
 * pas le carnet (`HORS_DU_CARNET`). Les écussons, la précision et L'Érudit ne
 * lisent qu'elle ; la mesure et le modèle du savoir l'écrivent à leur façon
 * (`mesures`, `premiereReponse`).
 */
export const reponseNue = (r: Pick<ReponseDuJournal, 'aidee' | 'carnet'>): boolean => !r.aidee && r.carnet === null

const UN_TABLEAU = idDuTableau('')

/**
 * Les questions de la base qu'une pièce du Cabinet a montrées, et que sa
 * révélation a dites : les cinq d'une manche de l'Éclair et les nouveaux venus
 * d'une frise d'un sujet (`deplier`), les questions qui nomment un tableau du
 * Détail — la fiche des tableaux vit au serveur (`questionsDuTableau`),
 * `deplier` est pur. Rien d'une question de la base, ni d'un contenu neuf : un
 * lieu, une fiche, une réplique, une frise à thème.
 */
function questionsMontrees(id: string): readonly string[] {
  if (!estDuCabinet(id)) return []
  if (id.startsWith(UN_TABLEAU)) return questionsDuTableau(id.slice(UN_TABLEAU.length))
  const questions = deplier(id)
  return questions.length === 1 && questions[0] === id ? [] : questions
}

/** Ses justes et ses réponses, pour une question. */
export interface Compte {
  justes: number
  total: number
}

/** Ses écussons d'une catégorie : ses questions, celles qu'il a répondues, ses justes (`savoirDesLignes`). */
interface CompteDeSavoir {
  questions: number
  repondues: number
  justes: number
}

/** Une question qu'il a vue : quand la dernière fois, sa première réponse, et la première hors révision (la mesure). */
interface Paire {
  le: number
  premiere: number
  premiereHorsRevision: number
}

/** Une réponse récente, comme les missions la jugent (`JournauxDesJours.reponses`). */
export interface ReponseRecente {
  serie: string
  mode: string
  juste: boolean
  le: number
  categorie: string | null
  commencee: number
}

/**
 * Une réponse comptée au carnet (`suivisDe`) : son instant, son jour de Paris,
 * sa justesse — fausse quand une carte du second essai l'a aidée : sa
 * première était fausse —, et ce qui la tient à l'écart tant qu'il est
 * ouvert, son défi ou son duel : ouverts, ils souffleraient leurs réponses.
 */
interface PassageAuCarnet {
  le: number
  jour: string
  juste: boolean
  /** Un défi : à l'écart tant que sa semaine n'est pas passée — sans semaine, toujours. */
  semaine?: string | null
  /** Un duel : à l'écart tant qu'il n'est pas fermé. */
  duel?: string | null
}

/**
 * Une question de son carnet : ses passages depuis sa dernière erreur qui
 * compte d'office — une erreur la remet au premier rendez-vous, quoi qu'il en
 * soit (`apresUnPassage`), et ce qui la précède ne change plus rien —, et son
 * suivi replié, gardé tant qu'aucun de ses passages n'attend son défi ou son
 * duel.
 */
interface QuestionAuCarnet {
  passages: PassageAuCarnet[]
  /** Ses passages à l'écart d'un défi ou d'un duel, peut-être encore ouverts : son suivi se replie à chaque lecture. */
  enAttente: number
  /** Son suivi replié ; undefined : à replier. */
  suivi?: SuiviDeRevision | null
}

/** Les cartes du second essai : leur réponse juste compte pour ratée au carnet (`suivisDe`). */
const ESSAIS = new Set(CARTES_DU_SECOND_ESSAI)

const aLEcartDUnDefiOuDUnDuel = (p: PassageAuCarnet) => p.semaine !== undefined || p.duel !== undefined

/** Ce que le journal sait d'un joueur. */
class Dossier {
  readonly paires = new Map<string, Paire>()
  /** Ce que ses pièces du Cabinet ont montré de plus qu'elles (`ReponseDuJournal.montre`), et quand pour la dernière fois. */
  readonly montrees = new Map<string, number>()
  readonly justesParHeure = new Map<number, number>()
  readonly savoir = new Map<string | null, CompteDeSavoir>()
  expertes = 0
  /** Ses bonnes réponses, tous les modes, révisions comprises : ses confettis de campagne (`justesDe`). */
  justes = 0
  recentes: ReponseRecente[] = []
  /** Ses bonnes réponses données avec chaque compagnon dans sa niche, tous les modes de la campagne (`compagnonsDe`). */
  readonly compagnons = new Map<string, number>()
  /** Son carnet : les questions qu'il a ratées (`carnetDe`). */
  readonly carnet = new Map<string, QuestionAuCarnet>()
  /**
   * Une de ses réponses lue après une plus récente à la même question — une
   * réponse écrite à la main, une horloge qui recule — : les passages
   * qu'on a laissés en route ne se rattrapent pas, son carnet se relit de la
   * base (`carnetDe` rend null).
   */
  carnetIncertain = false
}

function compter(comptes: Map<string, Compte>, question: string, juste: boolean) {
  const c = comptes.get(question)
  if (c) {
    c.total++
    if (juste) c.justes++
  } else comptes.set(question, { justes: juste ? 1 : 0, total: 1 })
}

export class JournalDesReponses {
  /** Le plus grand `rowid` lu : la lecture suivante part de là. */
  jusqua = 0
  /** Lu en entier une fois : avant, rien de ce qu'il dit ne vaut. */
  charge = false
  /**
   * Le numéro de la dernière lecture complète qu'il a reçue (chaque lecture
   * en prend un en partant, `CampagneStore.lecturesDuJournal`) : tout ce qui
   * était écrit avant qu'elle parte, il le sait. Une requête qui commence
   * n'a donc rien à relire si une lecture est partie après elle.
   */
  fraisDepuis = 0
  /** Combien de réponses il a lues. */
  reponses = 0
  private readonly dossiers = new Map<string, Dossier>()
  /** Les premières réponses hors révision des réponses sans série, par série (la mesure les comptait par `COALESCE(profile_id, serie_id)`). */
  private readonly orphelines = new Map<string, Map<string, number>>()
  /** La mesure : chaque réponse nue hors révision, et chaque première réponse hors révision, question par question. */
  private readonly brutes = new Map<string, Compte>()
  private readonly premieres = new Map<string, Compte>()
  /** La fermeture de chaque duel que ses réponses ont nommé : ouvert, il tient ses réponses hors du carnet. */
  private readonly fermetures = new Map<string, number>()
  /** Les épreuves des sentiers jouées pour de bon — pas les rejeux — : leurs réponses, marche par marche (`reponsesDesEpreuves`). */
  private readonly epreuves = new Map<string, { palier: number; branche: string | null; commencee: number; niveaux: Map<string, Compte> }>()
  /** Les mauvaises réponses choisies, question par question, et combien de fois (`leurresChoisis`). */
  private readonly leurres = new Map<string, Map<string, number>>()

  constructor(private readonly maintenant: () => number = Date.now) {}

  /**
   * Les réponses d'une lecture : celles au-delà du plus grand `rowid` déjà
   * lu, une fois chacune. Deux lectures parties du même endroit — deux
   * requêtes de front — ne comptent pas deux fois : la seconde ne prend que
   * ce que la première n'avait pas.
   */
  appliquer(lecture: Pick<LectureDuJournal, 'reponses' | 'jusqua' | 'aSuivre'>, numero = 0): void {
    const depuis = this.jusqua
    for (const r of lecture.reponses) if (r.n > depuis) this.une(r)
    if (lecture.jusqua > this.jusqua) this.jusqua = lecture.jusqua
    // Partie de ce qu'il savait déjà, elle ne laisse pas de trou : complète, elle dit tout ce qui était écrit avant elle.
    if (!lecture.aSuivre && numero > this.fraisDepuis) this.fraisDepuis = numero
  }

  private dossier(qui: string): Dossier {
    let d = this.dossiers.get(qui)
    if (!d) this.dossiers.set(qui, (d = new Dossier()))
    return d
  }

  /** Une première réponse hors révision qui change : la mesure retire l'ancienne, compte la nouvelle. */
  private nouvellePremiere(question: string, avant: number, apres: number) {
    const a = premiereReponse(avant)
    if (a !== null) {
      const c = this.premieres.get(question)!
      c.total--
      c.justes -= a
      if (c.total === 0) this.premieres.delete(question)
    }
    const b = premiereReponse(apres)
    if (b !== null) compter(this.premieres, question, b === 1)
  }

  private une(r: ReponseDuJournal) {
    this.reponses++
    if (r.duel !== null && r.fermeLe !== null) this.fermerLeDuel(r.duel, r.fermeLe)
    // L'administration des sentiers : chaque épreuve jouée pour de bon, ses réponses à chaque marche.
    if (r.epreuve !== null && !r.epreuve.rejeu && r.niveau !== null && r.commencee !== null) {
      let e = this.epreuves.get(r.serie)
      if (!e) this.epreuves.set(r.serie, (e = { palier: r.epreuve.palier, branche: r.epreuve.branche, commencee: r.commencee, niveaux: new Map() }))
      compter(e.niveaux, r.niveau, r.juste)
    }
    const code = r.le * 4 + (r.aidee ? 2 : 0) + (r.juste ? 1 : 0)
    // Une série disparue lisait `COALESCE(s.mode, 'serie')` : elle n'est pas une révision.
    const revision = r.mode === 'revision'
    // La mesure : les réponses nues hors révision, sans ce qu'une source de l'expédition reprend du carnet (`mesuresBrutes`).
    if (!revision && !r.aidee && !(r.mode === 'expedition' && carnetUn(r.carnet))) {
      compter(this.brutes, r.question, r.juste)
      // Ses leurres, sur les mêmes réponses : une révision repose une correction lue, un joker a effacé des leurres, une autre forme en a montré d'autres.
      if (r.choisie !== null && !horsDeLaBase(r.question)) {
        let choisies = this.leurres.get(r.question)
        if (!choisies) this.leurres.set(r.question, (choisies = new Map()))
        choisies.set(r.choisie, (choisies.get(r.choisie) ?? 0) + 1)
      }
    }
    if (r.qui === null) {
      if (revision) return
      let siennes = this.orphelines.get(r.serie)
      if (!siennes) this.orphelines.set(r.serie, (siennes = new Map()))
      const avant = siennes.get(r.question) ?? Infinity
      if (code < avant) {
        siennes.set(r.question, code)
        this.nouvellePremiere(r.question, avant, code)
      }
      return
    }
    const d = this.dossier(r.qui)
    for (const id of r.montre ?? []) if (r.le > (d.montrees.get(id) ?? -Infinity)) d.montrees.set(id, r.le)
    let p = d.paires.get(r.question)
    // Son carnet, avant que la question ne retienne l'instant de cette réponse : il dit si elle arrive dans l'ordre.
    this.auCarnet(d, r, p?.le)
    if (!p) d.paires.set(r.question, (p = { le: r.le, premiere: code, premiereHorsRevision: Infinity }))
    else {
      if (r.le > p.le) p.le = r.le
      if (code < p.premiere) p.premiere = code
    }
    if (!revision && code < p.premiereHorsRevision) {
      this.nouvellePremiere(r.question, p.premiereHorsRevision, code)
      p.premiereHorsRevision = code
    }
    // Son expérience : ses bonnes réponses, heure par heure, révisions comprises.
    if (r.juste) {
      d.justes++
      const heure = Math.floor(r.le / HEURE_MS)
      d.justesParHeure.set(heure, (d.justesParHeure.get(heure) ?? 0) + 1)
      // Ses compagnons : chaque bonne réponse fait grandir celui de sa niche, dans tous les modes.
      if (r.compagnon !== null) d.compagnons.set(r.compagnon, (d.compagnons.get(r.compagnon) ?? 0) + 1)
    }
    // Ses écussons et L'Érudit : les réponses nues hors révision.
    if (!revision && reponseNue(r)) {
      const s = d.savoir.get(r.categorie)
      if (s) {
        s.questions++
        if (r.repondue) s.repondues++
        if (r.juste) s.justes++
      } else d.savoir.set(r.categorie, { questions: 1, repondues: r.repondue ? 1 : 0, justes: r.juste ? 1 : 0 })
      if (r.juste && r.niveau === 'expert') d.expertes++
    }
    // Ses missions : ses réponses données des derniers jours, une à une.
    if (r.repondue && r.commencee !== null && r.le >= this.maintenant() - FENETRE_DES_RECENTES_MS) {
      d.recentes.push({
        serie: r.serie,
        mode: r.mode ?? 'serie',
        juste: r.juste,
        le: r.le,
        categorie: r.carnet === null ? r.categorie : null,
        commencee: r.commencee,
      })
    }
  }

  /**
   * Une réponse de plus à son carnet, aux règles de la requête d'avant
   * (`suivisDeLaBase`) : rien qui ne soit une question de la base — un rébus,
   * une frise, un jeu du Cabinet, la même liste qu'en SQL (`horsDeLaBase`) ;
   * une bonne réponse aidée — un joker, un vrai ou faux tiré d'une autre — ne
   * prouve rien, et une carte du second essai la tient pour ratée. `avant` :
   * l'instant de sa dernière réponse lue à la même question.
   */
  private auCarnet(d: Dossier, r: ReponseDuJournal, avant: number | undefined) {
    if (horsDeLaBase(r.question)) return
    const essai = r.joker !== null && ESSAIS.has(r.joker)
    if (r.juste && !essai && (r.joker !== null || r.forme === 'vrai-faux')) return
    if (avant !== undefined && r.le < avant) d.carnetIncertain = true
    const juste = r.juste && !essai
    let q = d.carnet.get(r.question)
    if (!q) {
      // Une bonne réponse avant toute erreur ne change rien à son suivi.
      if (juste) return
      d.carnet.set(r.question, (q = { passages: [], enAttente: 0 }))
    }
    const passage: PassageAuCarnet = {
      le: r.le,
      jour: jourDe(r.le),
      juste,
      ...(r.mode === 'defi' ? { semaine: r.semaine } : r.mode === 'duel' ? { duel: r.duel } : {}),
    }
    const passages = q.passages
    let i = passages.length
    while (i > 0 && passages[i - 1].le > r.le) i--
    passages.splice(i, 0, passage)
    if (aLEcartDUnDefiOuDUnDuel(passage)) q.enAttente++
    else if (!juste) {
      // Une erreur qui compte d'office remet tout à zéro : ce qui la précède ne sert plus — deux réponses au même instant, au même jour, se replient dans n'importe quel ordre.
      for (const x of passages.splice(0, passages.findIndex(x => x.le >= r.le))) if (aLEcartDUnDefiOuDUnDuel(x)) q.enAttente--
    }
    q.suivi = undefined
  }

  /**
   * Son carnet (`suivisDe`) : le suivi de chaque question qu'il a ratée,
   * replié de ses passages dans l'ordre du temps, sans ceux d'un défi de la
   * semaine `semaine` — ou d'après —, ni d'un duel encore ouvert à
   * `maintenant`. Null : une de ses réponses est arrivée dans le désordre, la
   * base le dira (`carnetIncertain`).
   */
  carnetDe(qui: string, semaine: string, maintenant: number): Map<string, SuiviDeRevision> | null {
    const suivis = new Map<string, SuiviDeRevision>()
    const d = this.dossiers.get(qui)
    if (!d) return suivis
    if (d.carnetIncertain) return null
    for (const [question, q] of d.carnet) {
      let suivi = q.enAttente === 0 ? q.suivi : undefined
      if (suivi === undefined) {
        suivi = null
        for (const p of q.passages) if (!this.aLEcart(p, semaine, maintenant)) suivi = apresUnPassage(suivi, p.jour, p.juste)
        if (q.enAttente === 0) q.suivi = suivi
      }
      if (suivi) suivis.set(question, suivi)
    }
    return suivis
  }

  /** Un passage d'un défi pas encore passé, ou d'un duel encore ouvert — comme la requête d'avant, sans semaine ni duel, à l'écart. */
  private aLEcart(p: PassageAuCarnet, semaine: string, maintenant: number): boolean {
    if (p.semaine !== undefined) return p.semaine === null || p.semaine >= semaine
    if (p.duel === undefined) return false
    if (p.duel !== null) return (this.fermetures.get(p.duel) ?? -Infinity) > maintenant
    // `s.duel IN (…)` sans duel : nul, donc à l'écart, dès qu'un duel est ouvert.
    for (const f of this.fermetures.values()) if (f > maintenant) return true
    return false
  }

  /** La fermeture d'un duel, lue avec ses réponses ou avancée par l'administrateur (`annulerUnDuel`) : elle ne se repousse jamais. */
  fermerLeDuel(code: string, le: number): void {
    const avant = this.fermetures.get(code)
    if (avant === undefined || le < avant) this.fermetures.set(code, le)
  }

  /** Les duels que ses réponses disent encore ouverts à `maintenant` : lus dans des tranches gardées, ils ont pu fermer depuis. */
  duelsOuverts(maintenant: number): string[] {
    return [...this.fermetures].filter(([, le]) => le > maintenant).map(([code]) => code)
  }

  /**
   * Ce qu'il a vu, et quand pour la dernière fois — « jamais vues d'abord », la
   * fraîcheur de chaque tirage : la série, l'épreuve, le défi, le dé, le duel,
   * l'expédition, le Cabinet — ; sa première réponse à chacune, sauf aidée.
   *
   * Une pièce du Cabinet y compte aussi les questions de la base qu'elle a
   * montrées, à son heure (`questionsMontrees`). Rangées sous son seul composé,
   * elles revenaient jamais vues au reste de la campagne : une partie libre de
   * l'Éclair, illimitée, révélait quinze bonnes réponses que le duel classé
   * posait ensuite comme neuves (la tablée du 25 octobre 2026, axe 9 ;
   * l'invariant 8 : rien ne sort du Cabinet). Et ce que sa manche a montré de
   * plus qu'elle, déplié de même (`ReponseDuJournal.montre`) : les trois
   * leurres d'un Détail, montrés avec leur peintre, et ce que « Changer » a
   * remplacé — seul le tableau joué s'écrivait vu, et une partie libre du
   * Détail soufflait neuf « Qui a peint… ? » (la deuxième tablée, le 26 octobre
   * 2026). Les vues seulement : sa première réponse à une question ne vient
   * jamais d'un composé ni de ce qu'une manche a montré — une manche de
   * l'Éclair n'est la première réponse d'aucune de ses questions, et la mesure,
   * le modèle du savoir, les sentiers ne lisent que celles qu'il a données.
   */
  vuesDe(qui: string): { vues: Map<string, number>; premieres: Map<string, boolean> } {
    const vues = new Map<string, number>()
    const premieres = new Map<string, boolean>()
    const montrees: { questions: readonly string[]; le: number }[] = []
    const d = this.dossiers.get(qui)
    for (const [question, p] of d?.paires ?? []) {
      vues.set(question, p.le)
      const questions = questionsMontrees(question)
      if (questions.length > 0) montrees.push({ questions, le: p.le })
      const juste = premiereReponse(p.premiere)
      if (juste !== null) premieres.set(question, juste === 1)
    }
    // Ce que ses manches ont montré de plus : vu comme s'il l'avait joué, déplié comme ses pièces.
    for (const [id, le] of d?.montrees ?? []) montrees.push({ questions: [id, ...questionsMontrees(id)], le })
    // Après ses réponses : une question qu'il a aussi répondue, ou qu'une autre pièce a montrée, garde l'heure la plus récente.
    for (const { questions, le } of montrees) {
      for (const q of questions) {
        const avant = vues.get(q)
        if (avant === undefined || le > avant) vues.set(q, le)
      }
    }
    return { vues, premieres }
  }

  /**
   * Ses pièces jugées, chacune à l'heure de la dernière : ce que ses
   * révélations ont dit, rien de ce qu'une manche a montré sans le juger. Tes
   * murs du Cabinet les lisent — une manche de l'Épingle remplacée par
   * « Changer » aurait mis sur ses murs un lieu, sa commune et ses
   * coordonnées, que rien ne lui avait révélés.
   */
  jugeesDe(qui: string): Map<string, number> {
    return new Map([...(this.dossiers.get(qui)?.paires ?? [])].map(([question, p]) => [question, p.le]))
  }

  /**
   * Les mauvaises réponses que la campagne choisit, question par question, en
   * texte, et combien de fois — sur les réponses que la mesure compte : nues,
   * hors révision. L'Éclair du Cabinet y prend le leurre de ses affirmations
   * fausses (`affirmationDe`) : celui qu'on confond, pas celui qui se voit
   * faux. Le journal tient la carte telle quelle ; qui la lit ne la change pas.
   */
  leurresChoisis(): ReadonlyMap<string, ReadonlyMap<string, number>> {
    return this.leurres
  }

  /** Ses premières réponses, chacune avec son instant, sauf aidées : sa chance sur les sentiers (`forceSurLesSentiers`). */
  premieresDe(qui: string): Map<string, { le: number; juste: boolean }> {
    const premieres = new Map<string, { le: number; juste: boolean }>()
    for (const [question, p] of this.dossiers.get(qui)?.paires ?? []) {
      const juste = premiereReponse(p.premiere)
      if (juste !== null) premieres.set(question, { le: Math.floor(p.premiere / 4), juste: juste === 1 })
    }
    return premieres
  }

  /**
   * Ses bonnes réponses de campagne, tous les modes : ce que la somme des
   * `justes` de ses séries comptait (ses confettis, Le Marathonien). Chaque
   * mode écrit la réponse et sa série dans le même lot — le 24 octobre 2026,
   * en production, 15 985 des deux côtés, sans un écart pour aucun profil ni
   * aucun mode.
   */
  justesDe(qui: string): number {
    return this.dossiers.get(qui)?.justes ?? 0
  }

  /** Ses bonnes réponses de campagne données avec chaque compagnon (`loup` → 42) : elles le font grandir (`ProfileStore.compagnonsDe`). */
  compagnonsDe(qui: string): Record<string, number> {
    return Object.fromEntries(this.dossiers.get(qui)?.compagnons ?? [])
  }

  /** Ses bonnes réponses, heure par heure : son expérience de campagne (`justesParJourDesHeures`). */
  justesParHeureDe(qui: string): ReadonlyMap<number, number> {
    return this.dossiers.get(qui)?.justesParHeure ?? new Map()
  }

  /** Ses écussons, comme les lignes que `savoirDesLignes` lit. */
  savoirDe(qui: string): { categorie: string | null; questions: number; repondues: number; justes: number }[] {
    return [...(this.dossiers.get(qui)?.savoir ?? [])].map(([categorie, c]) => ({ categorie, ...c }))
  }

  /** Ses questions expertes trouvées, nues, hors révision (L'Érudit). */
  expertesDe(qui: string): number {
    return this.dossiers.get(qui)?.expertes ?? 0
  }

  /** Les plus anciennes de ses réponses récentes : on ne peut lui demander plus loin. */
  debutDesRecentes(): number {
    return this.maintenant() - FENETRE_DES_RECENTES_MS
  }

  /**
   * Ses réponses données depuis `depuis`, dans les parties commencées depuis
   * `commencees` (`activiteDepuis`). Les plus vieilles, sorties de la
   * fenêtre, s'oublient au passage.
   */
  recentesDe(qui: string, depuis: number, commencees: number): ReponseRecente[] {
    const d = this.dossiers.get(qui)
    if (!d) return []
    const debut = this.debutDesRecentes()
    if (d.recentes.length > 0 && d.recentes[0].le < debut) d.recentes = d.recentes.filter(r => r.le >= debut)
    return d.recentes.filter(r => r.le >= depuis && r.commencee >= commencees)
  }

  /** La mesure des difficultés, recopiée : celle qu'on garde dix minutes ne bouge pas sous ceux qui la lisent. */
  mesures(): { brutes: Map<string, Compte>; premieres: Map<string, Compte> } {
    const copie = (comptes: Map<string, Compte>) => new Map([...comptes].map(([q, c]) => [q, { justes: c.justes, total: c.total }]))
    return { brutes: copie(this.brutes), premieres: copie(this.premieres) }
  }

  /**
   * Les réponses des épreuves des sentiers commencées après `depuis`, d'une
   * branche ou de toutes, sans les rejeux : combien, et combien de justes,
   * palier par palier et marche par marche — ce que l'administration des
   * sentiers relisait de chaque épreuve de trois mois, son JSON déplié pour
   * ses seize réponses (`adminDesSentiers`) : 150 000 lignes au quota de
   * Turso pour une page du QG, le 24 octobre 2026.
   */
  reponsesDesEpreuves(depuis: number, branche: string | null): { palier: number; niveau: string; n: number; justes: number }[] {
    const lignes = new Map<string, { palier: number; niveau: string; n: number; justes: number }>()
    for (const e of this.epreuves.values()) {
      if (e.commencee <= depuis || (branche !== null && e.branche !== branche)) continue
      for (const [niveau, c] of e.niveaux) {
        const cle = `${e.palier}|${niveau}`
        const l = lignes.get(cle)
        if (l) {
          l.n += c.total
          l.justes += c.justes
        } else lignes.set(cle, { palier: e.palier, niveau, n: c.total, justes: c.justes })
      }
    }
    return [...lignes.values()]
  }

  /** Les joueurs, pour les premières réponses de chacun (`premieresJustesDe`, le modèle du savoir) : ceux qui en ont au moins une. */
  joueurs(): string[] {
    return [...this.dossiers.keys()]
  }

  /** Ses premières réponses non aidées, justes ou non : ce que le modèle du savoir lit de lui (`ajusterLeSavoir`). */
  premieresJustesDe(qui: string): Map<string, boolean> {
    const siennes = new Map<string, boolean>()
    for (const [question, p] of this.dossiers.get(qui)?.paires ?? []) {
      const juste = premiereReponse(p.premiere)
      if (juste !== null) siennes.set(question, juste === 1)
    }
    return siennes
  }
}

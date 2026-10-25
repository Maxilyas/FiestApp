// La porte de la campagne : le seul passage du Cabinet de curiosités vers
// `CampagneStore` (la conception du Cabinet, D12 — `docs/architecture/decisions.md`).
//
// Le magasin de la campagne fait près de onze mille lignes, et ses pièges se paient
// sans un bruit : une réponse écrite sans `vuAilleurs`, l'expédition en route
// reposait comme jamais vue la question qu'il venait de voir ; sans
// `reponseEcrite`, une lecture du journal partie avant elle passait pour
// fraîche ; sans `crediter`, la bonne réponse ne payait son expérience qu'à la
// suivante. Le Cabinet ne l'importe donc pas : il reçoit cette porte
// (`CampagneStore.porte()`), des fermetures sur ses privés, où le rituel d'une
// réponse tient en une fonction (`ecrireDesReponses`). Et la campagne ne
// connaît du Cabinet que deux crochets, déclarés ici : ce qu'il ajoute à son
// réveil et à ses paliers. La fin d'une expédition en avait un troisième, pour
// la migration des œuvres : le propriétaire l'a abandonnée le 25 octobre 2026
// (chacun commence son musée à zéro), et rien ne s'en rapporte. Ce fichier
// n'importe que des types : le Cabinet le lit sans tirer la campagne.
import type { InStatement, ResultSet } from '@libsql/client'
import type { Client } from './distante'
import type { QuestionDeLaBase } from './baseCampagne'
import type { JournalDesReponses } from './journalDesReponses'
import type { Recompenses } from './campagne'
import type { MesureDUneQuestion } from '../../../shared/campagne'
import type { Categorie } from '../../../shared/categories'
import type { EvenementDeLaFrise } from '../../../shared/frise'
import type { StatsDeCampagne } from '../../../shared/profil'

export interface PorteDeLaCampagne {
  /** La base permanente, le client de la campagne : un geste du Cabinet qui ne juge rien s'y écrit seul, d'un lot. */
  readonly client: Client
  /** L'heure de la campagne — `maintenantDuJour`, que le banc règle : jamais `Date.now()` au Cabinet (invariant 6). */
  maintenant(): number
  /**
   * Le verrou du profil, celui de toute la campagne : un geste du Cabinet et
   * une réponse de série ne se croisent jamais. Le Cabinet le prend pour tout
   * son geste ; rien d'autre de la porte ne le prend — sous lui, on
   * l'attendrait soi-même.
   */
  avecVerrou<T>(profileId: string, travail: () => Promise<T>): Promise<T>
  /** Les questions que la campagne peut poser, gardées par identité : les tas du Cabinet s'y accrochent (`WeakMap`). */
  jouables(): Promise<readonly QuestionDeLaBase[]>
  /** La mesure des difficultés qu'il y a, même périmée : seule la première du réveil s'attend (règle `campagne.md`). */
  mesures(): Promise<ReadonlyMap<string, MesureDUneQuestion>>
  /** Chaque jouable par son identifiant, rangée une fois par liste. */
  parIdDe(jouables: readonly QuestionDeLaBase[]): ReadonlyMap<string, QuestionDeLaBase>
  /** Les jouables d'une catégorie, rangées une fois par liste. */
  deLaCategorie(jouables: readonly QuestionDeLaBase[], categorie: Categorie): readonly QuestionDeLaBase[]
  /** Les événements des frises que ces jouables datent (`evenementsDeLaBase`), gardés avec elles. */
  evenementsDe(jouables: readonly QuestionDeLaBase[]): readonly EvenementDeLaFrise[]
  /**
   * Un lot de lectures, et le journal des réponses rattrapé au bout, dans le
   * même aller-retour. Sans lecture, le journal seul : rien à relire si une
   * lecture est partie après la dernière réponse que ce serveur a écrite — le
   * tirage d'un départ ne paie alors rien —, un aller-retour sinon.
   */
  lireAvecLeJournal(lot: InStatement[]): Promise<{ lus: ResultSet[]; journal: JournalDesReponses }>
  /**
   * Le rituel d'une réponse de campagne, dans l'ordre de `repondre` : prévenir
   * l'expédition en route (`vuAilleurs`), le lot — et au bout, à la fin d'une
   * partie qui a des justes, les lectures de son expérience —, la réponse
   * écrite numérotée (`reponseEcrite`) ; puis, à la fin seulement et si le lot
   * l'a écrite (`FinDUnePartie.ecrite`), son expérience créditée une fois pour
   * toute la partie, ce que le Cabinet y range avant les paliers (ses gardiens,
   * `avantLesPaliers`), ses paliers de la campagne (`recompenser` : Le
   * Marathonien…), le compagnon qui grandit. Sous le verrou du profil, que le
   * Cabinet tient. Un lot refusé remonte tel quel : écrit ou non, on ne le sait
   * pas — le Cabinet oublie sa partie gardée, la base fait foi, et le journal
   * se relira. Ce qui suit le lot ne fait jamais échouer la réponse, déjà
   * rangée : chaque pas qui tombe se dit au journal du serveur, et le suivant
   * passe quand même.
   */
  ecrireDesReponses(profileId: string, lot: readonly InStatement[], fin?: FinDUnePartie): Promise<ReponsesEcrites>
  /** Le compagnon de sa niche, que la ligne d'une réponse retient (`campagne_reponses.compagnon`) ; null sans compagnon. */
  compagnonDeLaNiche(profileId: string): string | null
  /** La base, ses mesures, ses tirages et le journal lus en fond, une fois par processus : la page du Cabinet la lance comme l'accueil. */
  prechauffer(): void
  /**
   * Le secret du Cabinet, tiré au premier réveil et relu à chacun dans le
   * premier lot de la campagne (`CeQueLeReveilAjoute.secret`) : la graine de la
   * visite du jour en dérive, au serveur seul. Une campagne ouverte sans lui le
   * refuse — une erreur de branchement, pas un refus à dire au joueur.
   */
  secretDuCabinet(): string
}

/** La fin d'une partie, pour le rituel (`ecrireDesReponses`) : ce qu'il faut créditer et ranger une fois les réponses écrites. */
export interface FinDUnePartie {
  /** La partie (`campagne_series.id`) : ses paliers se rangent sous elle (`cleDeSerie`). */
  serieId: string
  /** L'heure de sa fin, celle des paliers rangés. */
  quand: number
  /**
   * L'heure de chacune de ses pièces justes (`repondue_le`), dans l'ordre :
   * ce que chacune rapporte se lit au rang qu'elle a dans son jour de Paris
   * (double parmi les vingt premières). Vide, rien à créditer : la ligne
   * d'expérience ne change pas, et ne coûte pas un aller-retour.
   */
  justes: readonly number[]
  /**
   * Le lot a-t-il écrit la fin ? Lu sur ce qu'il a rendu (`lus`) — la ligne du
   * geste qui le garde (D9), son `rowsAffected` —, que la porte ne sait pas
   * lire : elle ne connaît pas le lot. Faux, le rang était déjà pris — l'autre
   * serveur d'une mise en ligne qui tenait encore la partie, un double
   * toucher — et rien ne s'est écrit : rien ne se crédite, ne se range ni ne
   * grandit, la fin écrite ailleurs l'a fait. Sans cette question, le serveur
   * qui perd réécrivait la ligne d'expérience, relisait `statsDe` et rangeait
   * des paliers qu'il annonçait dans une réponse que le Cabinet jette.
   */
  ecrite(lus: readonly ResultSet[]): boolean
  /**
   * Ce que le Cabinet range entre l'expérience et les paliers : la
   * réconciliation de ses gardiens, la saison, la luciole (sa conception,
   * § 2.6). Ici et pas après la porte : le compagnon grandit en dernier, et la
   * campagne ne connaît pas les gardiens. Ce qui y tombe se dit au journal
   * sans faire tomber la fin : la page suivante réconcilie.
   */
  avantLesPaliers?(): Promise<void>
}

export interface ReponsesEcrites {
  /** Ce que le lot a lu, une entrée par instruction, dans son ordre — sans les lectures de l'expérience. */
  lus: ResultSet[]
  /**
   * L'expérience de chaque pièce juste, dans l'ordre de `FinDUnePartie.justes` ;
   * vide hors de la fin et quand le lot ne l'a pas écrite, zéro si la base a
   * refusé la ligne — la bonne réponse suivante la réécrira.
   */
  xp: number[]
  /** Ce que la fin fait tomber — les paliers de la campagne — et les légendaires que ça ouvre ; vide hors de la fin, ou si elle ne s'est pas écrite. */
  recompenses: Recompenses
}

/**
 * Ce que le Cabinet ajoute au réveil de la campagne (`CampagneStore.init`),
 * dans son **premier** lot : un réveil de l'hébergeur ne paie pas un
 * aller-retour de plus pour lui (`porte-de-la-campagne.test.ts`,
 * `demarrage.test.ts`).
 */
export interface CeQueLeReveilAjoute {
  /** Ses tables (`CREATE TABLE IF NOT EXISTS`), créées avec celles de la campagne. */
  tablesEnPlus?: readonly string[]
  /**
   * Ses colonnes de `campagne_series`, ajoutées par `ajouterColonne` après
   * celles de la campagne, dont le schéma de la table est déjà lu (`schemaDe`,
   * gardé par client) : un réveil ordinaire n'en paie rien, le premier son
   * seul `ALTER`.
   */
  colonnesEnPlus?: readonly (readonly [colonne: string, type: string])[]
  /**
   * La clé, dans `campagne_meta`, d'un secret que le premier réveil tire et
   * que chacun relit (`INSERT … ON CONFLICT DO NOTHING`, puis sa lecture) :
   * deux serveurs pendant une mise en ligne, un redémarrage, le même secret.
   */
  secret?: string
}

/**
 * Les champs de `StatsDeCampagne` que le Cabinet compte, et que la campagne ne
 * compte pas : aucun encore. Les salles complètes de L'Explorateur (`salles`)
 * y entreront quand ses paliers se reliront aux salles, avec leur champ et son
 * défaut (`AUCUNE_CAMPAGNE`).
 */
export type ChampsDuCabinet = never

/**
 * Ce que le Cabinet tire de ses lectures pour les paliers : ses champs, jamais
 * un de ceux que la campagne compte. Rendus par erreur, un `justes` ou des
 * `tampons` changeraient en silence Le Marathonien ou le Globe-trotter de tout
 * le monde : le typage les refuse, et `statsDe` étale ses comptes par-dessus.
 */
export type StatsDuCabinet = Partial<Pick<StatsDeCampagne, ChampsDuCabinet>> & { readonly [K in Exclude<keyof StatsDeCampagne, ChampsDuCabinet>]?: never }

/**
 * Ce que le Cabinet ajoute aux paliers de la campagne (`statsDe`, lu à chaque
 * fin de partie et à chaque page du profil) : ses lectures dans le même lot,
 * jamais une requête à part, et ce qu'il en tire.
 */
export interface StatsEnPlus {
  lectures(profileId: string): InStatement[]
  /** Ce que disent ses lectures, dans leur ordre : ses champs, ajoutés à ce que la campagne a compté. */
  lire(lus: readonly ResultSet[]): StatsDuCabinet
}

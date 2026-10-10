import { randomBytes, randomUUID } from 'node:crypto'
import type { InStatement, ResultSet } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from './distante'
import { BaseDeLaCampagne, entreeDeLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from './baseCampagne'
import {
  DEPOT_MAX,
  PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR,
  QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR,
  commandeDeLaCategorie,
  consigneCommune,
  empreintesDesLivres,
  partDeLaCategorie,
} from './consigneCampagne'
import { IndexDesFaits, indexSansBloquer, motifDuMemeFait } from './memeFait'
import { jourAvant, jourDe, minutesAvantMinuit, type PalierTombe } from '../../../shared/jour'
import { hautFait, palierDe, titreDePalier } from '../../../shared/hautsfaits'
import { CHANCE_ECLAT_DU_DEFI, type StatsDeCampagne } from '../../../shared/profil'
import { cleDeSerie, cleDuDefi, type ProfileRec, type ProfileStore } from '../auth/profiles'
import { classer } from '../../../shared/classement'
import { nomsAffiches, sansAccent } from '../../../shared/homonymes'
import { tronquer } from '../../../shared/avatars'
import { CATEGORIES } from '../../../shared/categories'
import { savoirDesLignes, type Savoir } from '../../../shared/ecussons'
import { BRANCHES, branche as brancheParCle, deLaBranche, type CleDeBranche, type Paliers } from '../../../shared/branches'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import { chapitreDuPalier } from '../../../shared/chapitres'
import { SUJETS, sujetParCle, sujetsDe } from '../../../shared/sujets'
import {
  DUELS_OUVERTS_MAX,
  DUREE_D_UN_DUEL_MS,
  LETTRES_D_UN_CODE,
  LONGUEUR_D_UN_CODE,
  lireCodeDuDuel,
  type DuelEntreAmis,
  type ResumeDuDuel,
  NIVEAUX,
  QUESTIONS_PAR_MARCHE,
  QUESTIONS_PAR_SERIE,
  JOUEURS_POUR_LE_DEFI,
  QUESTIONS_POUR_JOUER,
  RECORD_DU_TOUR_DU_MONDE,
  SERIES_POUR_LE_NIVEAU,
  SIGNALEMENT_MAX,
  VIES,
  bonneReponseChange,
  issueDeRencontre,
  niveauPourUneRencontre,
  minutesAvantLundi,
  niveauDeQuestion,
  semaineAvant,
  semaineDe,
  ordreDeSerie,
  xpDeCampagne,
  xpDeLaBonneReponse,
  xpDuJourDeCampagne,
  type AdminDeLaCampagne,
  type Adversaire,
  type AjoutsDeLaRoutine,
  type CoupDeLaRencontre,
  type MesRencontres,
  type RencontreDeCampagne,
  type ResumeDeRencontre,
  type CommandeDeLaBase,
  type DepotDeLaBase,
  type CorrectionDeCampagne,
  type CorrectionDeQuestion,
  type DefiDeLaSemaine,
  type EtatDeCampagne,
  type FinDeSerie,
  type LigneDuDefi,
  type Niveau,
  type QuestionCorrigee,
  type QuestionDeCampagne,
  type RapportDeSignalement,
  type ReponseDeCampagne,
  type SerieDeCampagne,
  type SignalementDeCampagne,
} from '../../../shared/campagne'
import {
  PALIERS,
  PALIER_DU_MAITRE,
  PRIX_D_UNE_VIE,
  QUESTIONS_PAR_EPREUVE,
  VIES_PAR_JOUR,
  confettisDeLaNouvelleNote,
  confettisDesEtoiles,
  epreuveFinie,
  etoilesDe,
  issueDe,
  regleDuPalier,
  sentierQuOnAvance,
  titreDeMaitre,
  viesDe,
  xpDuPalier,
  type AdminDesSentiers,
  type EpreuveDeSentier,
  type EtatDesSentiers,
  type IssueDEpreuve,
  type JoueurBloque,
  type RegleDuPalier,
  type ReponseDEpreuve,
  type SentierDuJoueur,
  type SentiersDAccueil,
  type StatsDuPalier,
  type VieDesSentiers,
} from '../../../shared/sentiers'
import {
  QUESTIONS_PAR_REVISION,
  suiteDeLaRevision,
  suiviDeLaQuestion,
  type EtatDuCarnet,
  type FaitAppris,
  type SuiviDeRevision,
} from '../../../shared/revision'

/** Une question de la série, telle que le serveur la garde : la bonne réponse avec. */
interface QuestionDeSerie {
  /**
   * Son identifiant dans la base de la campagne (`baseCampagne.ts`). Une
   * série d'avant la base (le 3 octobre 2026) gardait celui de la réserve du
   * quiz du jour, sous le nom `reserveId` : `versSerie` le relit.
   */
  id: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  anecdote: string | null
  niveau: Niveau
  /** Son sous-thème : une série d'avant les sentiers ne le gardait pas. */
  sousTheme?: string
  /**
   * Une révision : ses rendez-vous réussis quand elle l'a tirée — de quoi dire
   * après chaque réponse où en est la question sans relire tout le journal.
   * Le carnet, lui, se relit toujours dans le journal (`suiviDeLaQuestion`).
   */
  etape?: number
}

/**
 * Une série de la campagne, ou une épreuve des sentiers (`mode`) : les mêmes
 * tables, le même journal de réponses — l'expérience, les confettis, la
 * mesure des difficultés et « jamais vues d'abord » les comptent ensemble,
 * sans rien savoir des sentiers.
 */
interface Serie {
  id: string
  profileId: string
  questions: QuestionDeSerie[]
  index: number
  vies: number
  justes: number
  finieLe: number | null
  /**
   * Une révision du carnet (`shared/revision.ts`) n'a pas de vies : ses
   * erreurs remettent la question au lendemain, rien de plus. Une rencontre
   * rejoue la série finie d'un autre joueur, contre son score.
   */
  mode: 'serie' | 'sentier' | 'defi' | 'duel' | 'revision' | 'rencontre'
  /** L'épreuve d'un sentier : sa branche, son palier, son seuil figé au départ — un seuil réglé ensuite ne change pas une épreuve en cours. */
  branche: CleDeBranche | null
  palier: number | null
  seuil: number | null
  rejeu: boolean
  issue: IssueDEpreuve | null
  /** Les catégories qu'elle a choisies ; null : toutes (`categoriesRetenues`). */
  categories?: string[] | null
  /** Le sujet qu'elle suit à travers les catégories (`shared/sujets.ts`) ; ses catégories sont alors null. */
  sujet?: string | null
  /** Un défi de la semaine : le lundi de sa semaine, qui le clôt. */
  semaine?: string | null
  /** Un défi entre amis : son code (`campagne_duels`). */
  duel?: string | null
  /** Une rencontre : qui elle affronte (`AdversaireGarde`). */
  adversaire?: AdversaireGarde | null
}

/**
 * L'adversaire d'une rencontre, tel qu'elle le garde : sa série, son profil,
 * et ses réponses dans l'ordre — recopiées au départ : un profil supprimé
 * emporte ses séries, la rencontre garde ce qu'il avait fait.
 */
interface AdversaireGarde {
  serie: string
  profil: string
  reponses: boolean[]
}

/** Un défi entre amis, tel que sa table le garde : son tirage figé, ce qu'il fait jouer, quand il ferme. */
interface Duel {
  code: string
  auteur: string
  questions: QuestionDeSerie[]
  categories: string[] | null
  sujet: string | null
  creeLe: number
  fermeLe: number
  /** Quand sa fermeture a figé les tentatives laissées en route ; null : pas encore. */
  closLe: number | null
}

/** La difficulté mesurée se relit au plus toutes les dix minutes : elle bouge lentement, et chaque série la lit. */
const MESURES_GARDEES_MS = 10 * 60_000
/** Combien de séries en cours restent en mémoire (`enCours`) : celles qu'on joue, et de la marge pour celles qu'on a laissées. */
const SERIES_GARDEES = 500
const HEURE_MS = 3600_000
/** Les séries de la campagne, sans les épreuves des sentiers : une ligne d'avant les sentiers n'a pas de mode. */
const SERIES = "COALESCE(mode, 'serie') = 'serie'"
/** Ce que l'administration relit des épreuves : trois mois suffisent à régler un palier. */
const STATS_DES_SENTIERS_MS = 90 * 24 * HEURE_MS
/** Les plus bloqués que l'administration nomme : de quoi voir qui décroche, pas un annuaire. */
const BLOQUES_MONTRES = 10
/** Ce qu'un classement du défi montre ; au-delà, sa propre ligne à part — comme au quiz du jour. */
const LIGNES_DU_DEFI = 50
/** Ses défis entre amis qu'on lui rappelle : les plus récents, de quoi retrouver un lien perdu. */
const DUELS_MONTRES = 10
/** Les questions signalées que l'administration relit d'un coup : les plus récentes. */
const SIGNALEMENTS_MONTRES = 50
/** Ce que le carnet redonne de ce qu'il a appris : les plus récents, de quoi relire sans tout charger. */
const FAITS_MONTRES = 100
/** Les séries finies où l'on cherche un adversaire : les plus récentes, des trois derniers mois. */
const CANDIDATS_A_UNE_RENCONTRE = 200
const RENCONTRE_SUR_MS = 90 * 24 * HEURE_MS
/** Les adversaires les plus proches de son niveau, dont on regarde ce qu'il a déjà vu de leurs questions. */
const ADVERSAIRES_REGARDES = 8
/** Ses rencontres qu'on lui rappelle : les plus récentes. */
const RENCONTRES_MONTREES = 10
const AUCUN_VAINQUEUR: ReadonlySet<string> = new Set()

/**
 * La campagne solo (`shared/campagne.ts`) : ses séries, dans la base
 * permanente comme le quiz du jour — une série reprise demain sur un autre
 * téléphone retrouve sa question. Toute la règle est ici : le téléphone ne
 * reçoit jamais la bonne réponse avant d'avoir répondu (invariant 1), et
 * c'est le serveur qui compte les vies.
 *
 * Ses questions viennent de sa base à elle (`baseCampagne.ts`), jamais de
 * la réserve du quiz du jour, dont elle écarte même les intitulés
 * (`empreintesDuJour`). Une question jamais vue d'un joueur passe devant
 * celles qu'il a déjà vues, et parmi elles la plus anciennement vue
 * (`parFraicheur`). Sa difficulté part de l'estimation de l'écriture
 * et se corrige par les réponses de campagne (`niveauDeQuestion`).
 * Une bonne réponse y rapporte l'expérience d'une bonne réponse en soirée,
 * sans plafond (`xpDeCampagne`), dans sa ligne à part (`LIGNE_CAMPAGNE`) ;
 * et un confetti, comme au quiz du jour (`ProfileStore.confettisDeCampagne`).
 */
/**
 * Ce que la campagne demande aux profils pour décerner ses récompenses —
 * ses hauts faits de série, ses paliers, et les légendaires qu'ils ouvrent :
 * le profil tient l'étagère (`ProfileStore`), la campagne sait ce qui s'est
 * joué. Sans lui (un test qui n'en a pas besoin), elle ne décerne rien.
 */
export interface RecompensesDeCampagne {
  ranger(profileId: string, sous: string, cles: readonly string[], quand?: number): Promise<string[]>
  /** Ce qu'il a déjà sur son étagère, et combien de fois (`ProfileStore.recompensesOf`). */
  recompensesOf(profileId: string): ReadonlyMap<string, number>
  accorderPaliersDeCampagne(profileId: string, sous: string, stats: StatsDeCampagne): Promise<string[]>
  legendairesOuverts(profileId: string, tombes: readonly string[]): string[]
  tirerUnEclat(profileId: string, sous: string, chance: number): Promise<{ avatar: string; paliers: string[] } | null>
}

/** Ce qu'une fin de série ou d'épreuve annonce : ce qui est tombé, et les légendaires que ça ouvre. */
interface Recompenses {
  recompenses?: PalierTombe[]
  legendaires?: string[]
}

/** Ce que la fin d'un défi annonce en plus : l'Éclat, s'il est tombé. */
interface RecompensesDuDefi extends Recompenses {
  eclat?: string
}

export class CampagneStore {
  private client: Client
  /** L'étagère des profils (`RecompensesDeCampagne`), branchée par le serveur. */
  private recompenses: RecompensesDeCampagne | null
  private maintenant: () => number
  private verrous = new Map<string, Promise<unknown>>()
  /** La base du dépôt, lue à la première demande sans figer le serveur (`BaseDeLaCampagne.depuisLeDossier`) ; les tests en donnent une petite. */
  private fichiers: () => Promise<BaseDeLaCampagne>
  /**
   * Ce que la routine du matin a déposé (`campagne_ajouts`) : lu au
   * démarrage, tenu à jour à chaque dépôt. La base qu'on joue, c'est le
   * dépôt et ceux-là ensemble (`base`) — sans déploiement : une question
   * déposée à 7 h se joue à 7 h.
   */
  private ajouts: { question: QuestionDeLaBase; ajouteeLe: number }[] = []
  /**
   * Les corrections de l'administrateur (`campagne_corrections`), sous
   * l'identifiant de la question corrigée : sa version corrigée — sous le
   * même identifiant, ou sous un neuf quand la bonne réponse a changé
   * (`bonneReponseChange`). Lues au démarrage, appliquées à la base qu'on
   * joue (`base`) ; peu nombreuses, gardées en mémoire.
   */
  private corrections = new Map<string, { question: QuestionDeLaBase; corrigeeLe: number }>()
  /** Monte à chaque correction : la base fusionnée se refait. */
  private versionDesCorrections = 0
  /** Le dépôt, les ajouts et les corrections ensemble, refaits quand l'un d'eux change. */
  private fusion: { fichiers: BaseDeLaCampagne; ajouts: number; corrections: number; base: BaseDeLaCampagne } | null = null
  /** Les intitulés des quiz livrés, lus au premier dépôt : la base ne les reprend pas. */
  private livres: Set<string> | null = null
  /**
   * Les faits de la base (`core/memeFait.ts`), pour écarter un dépôt qui en
   * pose un qu'elle a déjà sous un autre intitulé : bâtis au premier dépôt
   * sans figer le serveur, puis tenus à jour de ce qui entre. Une correction
   * ne les refait pas : la version d'avant y reste, et n'écarte qu'un fait
   * de plus.
   */
  private faits: Promise<IndexDesFaits<QuestionDeLaBase>> | null = null
  /** Les intitulés de la réserve du quiz du jour (`JourStore.empreintes`) : la campagne n'en pose aucun. */
  private empreintesDuJour: () => Promise<ReadonlySet<string>>
  /** Écrit sa ligne d'expérience (`ProfileStore.ecrireXpDeCampagne`). */
  private ecrireXp: (profileId: string, xp: number, jours: number) => Promise<unknown>
  /** Les questions retirées après un signalement : la campagne ne les tire plus. Peu nombreuses, gardées en mémoire. */
  private retirees = new Set<string>()
  /**
   * La série en cours de chaque profil : relue en base à chaque réponse,
   * elle coûtait un aller-retour sous les doigts du joueur. Tenue à jour
   * sous son verrou, après chaque écriture réussie ; oubliée au moindre
   * échec — écrite ou non, on ne le sait pas, et la base fait alors foi.
   */
  private enCours = new Map<string, Serie>()
  /** Les questions du défi de chaque semaine jouée depuis le démarrage : figées en base, relues une fois. */
  private tirages = new Map<string, QuestionDeSerie[]>()
  /** Les défis entre amis lus depuis le démarrage : leur tirage et leur fermeture sont figés, relus une fois. */
  private duels = new Map<string, Duel>()
  /** Les vainqueurs du défi de la semaine passée (`vainqueursDuDefi`), lus à sa clôture. */
  private argent: { semaine: string; ids: ReadonlySet<string> } = { semaine: '', ids: AUCUN_VAINQUEUR }
  private argentEnRoute: Promise<void> | null = null
  /** La semaine dont toutes les précédentes sont closes : `cloreLesDefis` ne relit rien d'autre jusqu'au lundi suivant. */
  private closAvant: string | null = null
  private semaineGardee: { heure: number; semaine: string; passee: string } | null = null
  private ferme = false
  /**
   * Les profils, pour nommer le classement du défi et ses vainqueurs
   * (`ProfileStore`) ; les masqués du quiz du jour, qu'il écarte aussi ; et
   * de quoi rediffuser la salle d'un laurier d'argent qui change de tête.
   * Branchés au démarrage, comme les vies achetées.
   */
  profils?: Pick<ProfileStore, 'byIds' | 'avatarPorte' | 'apparenceDe'>
  masque?: (profileId: string) => boolean
  laurierChange?: (profileId: string) => void
  private mesuresGardees: { a: number; parQuestion: Map<string, { justes: number; total: number }> } | null = null

  constructor(
    url: string,
    authToken?: string,
    opts: {
      maintenant?: () => number
      base?: BaseDeLaCampagne | (() => BaseDeLaCampagne)
      empreintesDuJour?: () => Promise<ReadonlySet<string>>
      ecrireXp?: (profileId: string, xp: number, jours: number) => Promise<unknown>
      recompenses?: RecompensesDeCampagne
    } = {},
  ) {
    this.client = clientDistant(url, authToken)
    this.recompenses = opts.recompenses ?? null
    this.maintenant = opts.maintenant ?? Date.now
    const donnee = opts.base
    let lue: Promise<BaseDeLaCampagne> | null = null
    this.fichiers =
      donnee instanceof BaseDeLaCampagne
        ? async () => donnee
        : () =>
            (lue ??= (donnee ? (async () => donnee())() : BaseDeLaCampagne.depuisLeDossier()).catch(e => {
              // Ratée, elle se relit à la demande suivante : gardée, la promesse la figerait.
              lue = null
              throw e
            }))
    this.empreintesDuJour = opts.empreintesDuJour ?? (async () => new Set())
    this.ecrireXp = opts.ecrireXp ?? (async () => {})
  }

  /**
   * La base qu'on joue : celle du dépôt, ce que la routine y a ajouté, et ce
   * que l'administrateur y a corrigé (`appliquerLesCorrections`). Refaite
   * seulement quand l'un d'eux change — une série la lit à chaque fois. Un
   * ajout que le dépôt aurait rangé depuis (même identifiant, même intitulé)
   * n'y entre pas deux fois.
   */
  private async base(): Promise<BaseDeLaCampagne> {
    const fichiers = await this.fichiers()
    if (this.ajouts.length === 0 && this.corrections.size === 0) return fichiers
    const f = this.fusion
    if (f && f.fichiers === fichiers && f.ajouts === this.ajouts.length && f.corrections === this.versionDesCorrections) return f.base
    const ids = new Set(fichiers.parId.keys())
    const enPlus = this.ajouts.map(a => a.question).filter(q => !ids.has(q.id) && !fichiers.empreintes.has(q.empreinte))
    const base = new BaseDeLaCampagne(appliquerLesCorrections([...fichiers.questions, ...enPlus], this.corrections))
    this.fusion = { fichiers, ajouts: this.ajouts.length, corrections: this.versionDesCorrections, base }
    return base
  }

  /**
   * Ses bonnes réponses de campagne, jour par jour (Paris) : de quoi relire
   * toute sa ligne d'expérience, et dire ce qu'aujourd'hui a rapporté. Relues
   * en entier à chaque fois : un total tenu à côté se serait perdu au premier
   * hoquet de la base, quand celui-ci se refait à la bonne réponse suivante.
   */
  private async justesParJour(profileId: string): Promise<Map<string, number>> {
    return justesParJourDe((await this.client.execute(lectureDesJustes(profileId))).rows)
  }

  async init() {
    const resultats = await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS campagne_series (
           id           TEXT PRIMARY KEY,
           profile_id   TEXT NOT NULL,
           questions    TEXT NOT NULL,
           position     INTEGER NOT NULL,
           vies         INTEGER NOT NULL,
           justes       INTEGER NOT NULL DEFAULT 0,
           commencee_le INTEGER NOT NULL,
           finie_le     INTEGER
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_profil ON campagne_series(profile_id, commencee_le)',
        // reserve_id : l'identifiant de la question dans la base de la
        // campagne — dans la réserve du quiz du jour, pour une réponse
        // d'avant la base. Le nom est resté.
        `CREATE TABLE IF NOT EXISTS campagne_reponses (
           serie_id    TEXT NOT NULL,
           position    INTEGER NOT NULL,
           reserve_id  TEXT NOT NULL,
           choix       INTEGER,
           juste       INTEGER NOT NULL,
           repondue_le INTEGER NOT NULL,
           PRIMARY KEY (serie_id, position)
         )`,
        // Un signalement par joueur et par question : le renvoyer remplace le précédent.
        `CREATE TABLE IF NOT EXISTS campagne_signalements (
           question_id TEXT NOT NULL,
           profile_id  TEXT NOT NULL,
           serie_id    TEXT NOT NULL,
           texte       TEXT NOT NULL,
           cree_le     INTEGER NOT NULL,
           traite_le   INTEGER,
           PRIMARY KEY (question_id, profile_id)
         )`,
        `CREATE TABLE IF NOT EXISTS campagne_retraits (
           question_id TEXT PRIMARY KEY,
           retiree_le  INTEGER NOT NULL
         )`,
        // Ce que la routine du matin dépose : une entrée de la base par ligne,
        // dans la forme des fichiers du dépôt (`entreeDeLaBase`).
        `CREATE TABLE IF NOT EXISTS campagne_ajouts (
           id          TEXT PRIMARY KEY,
           categorie   TEXT NOT NULL,
           entree      TEXT NOT NULL,
           ajoutee_le  INTEGER NOT NULL
         )`,
        // Ce que l'administrateur corrige d'une question signalée : sa version
        // corrigée, dans la forme des fichiers du dépôt — sous le même
        // identifiant, ou sous un neuf quand la bonne réponse a changé.
        `CREATE TABLE IF NOT EXISTS campagne_corrections (
           question_id TEXT PRIMARY KEY,
           entree      TEXT NOT NULL,
           corrigee_le INTEGER NOT NULL
         )`,
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT question_id FROM campagne_retraits',
        'SELECT entree, ajoutee_le FROM campagne_ajouts ORDER BY ajoutee_le',
        'SELECT question_id, entree, corrigee_le FROM campagne_corrections',
      ],
      'write',
    )
    const [retraits, ajouts, corrections] = resultats.slice(-3)
    for (const r of retraits.rows) this.retirees.add(String(r.question_id))
    // Relues par le juge du jour : une règle durcie depuis les écarte, comme une ligne du dépôt.
    let illisibles = 0
    for (const r of ajouts.rows) {
      const lu = relireUneEntree(r.entree)
      if ('refus' in lu) illisibles++
      else this.ajouts.push({ question: lu.question, ajouteeLe: Number(r.ajoutee_le) })
    }
    if (illisibles > 0) console.warn(`[campagne] ${illisibles} question(s) déposée(s) par la routine écartée(s) : le juge de la base ne les accepte plus`)
    illisibles = 0
    for (const r of corrections.rows) {
      const lu = relireUneEntree(r.entree)
      if ('refus' in lu) illisibles++
      else this.corrections.set(String(r.question_id), { question: lu.question, corrigeeLe: Number(r.corrigee_le) })
    }
    if (illisibles > 0) console.warn(`[campagne] ${illisibles} correction(s) de l’administration écartée(s) : le juge de la base ne les accepte plus`)
    // Les épreuves des sentiers vivent dans les mêmes tables que les séries :
    // de quoi les reconnaître, et ce qu'elles visaient. Le schéma se lit une
    // fois par table (`ajouterColonne`) ; une base muette arrête le démarrage.
    for (const [colonne, type] of [
      ['mode', "TEXT NOT NULL DEFAULT 'serie'"],
      ['branche', 'TEXT'],
      ['palier', 'INTEGER'],
      ['seuil', 'INTEGER'],
      ['rejeu', 'INTEGER NOT NULL DEFAULT 0'],
      ['issue', 'TEXT'],
      // Les catégories qu'une série a choisies, en JSON — NULL : toutes. Le
      // Tour du monde et les records par catégorie lisent les séries d'une
      // seule ; la Grande Série, celles de toutes.
      ['categories', 'TEXT'],
      // Le sujet d'une série qui traverse les catégories (`shared/sujets.ts`) :
      // ses catégories restent NULL, mais elle n'est pas une série de toutes.
      ['sujet', 'TEXT'],
      // Un défi de la semaine : le lundi de sa semaine.
      ['semaine', 'TEXT'],
      // Un défi entre amis : son code (`campagne_duels`).
      ['duel', 'TEXT'],
      // Une rencontre : son adversaire, en JSON (`AdversaireGarde`).
      ['adversaire', 'TEXT'],
    ] as const) {
      await ajouterColonne(this.client, 'campagne_series', colonne, type)
    }
    await this.client.batch(
      [
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_sentiers ON campagne_series(profile_id, mode, branche, palier)',
        // Les paliers que chacun tenait de ses portraits d'avant les sentiers
        // (`core/repriseDesPortraits.ts`) : écrits une fois, jamais repris.
        `CREATE TABLE IF NOT EXISTS sentier_acquis (
           profile_id TEXT NOT NULL,
           branche    TEXT NOT NULL,
           paliers    INTEGER NOT NULL,
           retenu_le  INTEGER NOT NULL,
           PRIMARY KEY (profile_id, branche)
         )`,
        `CREATE TABLE IF NOT EXISTS campagne_meta (
           cle    TEXT PRIMARY KEY,
           valeur TEXT NOT NULL
         )`,
        // Le défi de chaque semaine : ses questions, tirées au premier qui
        // l'ouvre et figées — la même série pour tous —, et sa clôture, qui
        // range ses vainqueurs.
        `CREATE TABLE IF NOT EXISTS campagne_defis (
           semaine    TEXT PRIMARY KEY,
           questions  TEXT NOT NULL,
           tire_le    INTEGER NOT NULL,
           clos_le    INTEGER,
           vainqueurs TEXT
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_defi ON campagne_series(mode, semaine)',
        // Les défis entre amis : un tirage figé sous un code, que son lien
        // donne à qui le reçoit ; une semaine pour le relever.
        `CREATE TABLE IF NOT EXISTS campagne_duels (
           code       TEXT PRIMARY KEY,
           auteur     TEXT NOT NULL,
           questions  TEXT NOT NULL,
           categories TEXT,
           sujet      TEXT,
           cree_le    INTEGER NOT NULL,
           ferme_le   INTEGER NOT NULL,
           clos_le    INTEGER
         )`,
        'CREATE INDEX IF NOT EXISTS idx_campagne_duels_auteur ON campagne_duels(auteur, ferme_le)',
        'CREATE INDEX IF NOT EXISTS idx_campagne_series_duel ON campagne_series(mode, duel)',
      ],
      'write',
    )
  }

  /** Un geste à la fois par profil : deux onglets qui répondent ensemble ne comptent pas deux fois. */
  private avecVerrou<T>(cle: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.verrous.get(cle) ?? Promise.resolve()
    const suite = avant.then(travail, travail)
    const garde = suite.catch(() => {})
    this.verrous.set(cle, garde)
    void garde.then(() => {
      if (this.verrous.get(cle) === garde) this.verrous.delete(cle)
    })
    return suite
  }

  /** Les questions que la campagne peut poser : la base, moins les retirées et celles de la réserve du quiz du jour. */
  private async jouables(categories?: readonly string[]): Promise<QuestionDeLaBase[]> {
    const [duJour, base] = await Promise.all([this.empreintesDuJour(), this.base()])
    const filtre = categories && categories.length > 0 ? new Set(categories) : null
    return base.questions.filter(q => !this.retirees.has(q.id) && !duJour.has(q.empreinte) && (!filtre || filtre.has(q.meta.categorie)))
  }

  /**
   * La part de joueurs qui ont trouvé chaque question de la base, en
   * campagne : ce qui corrige sa difficulté estimée (`niveauDeQuestion`).
   * Relue au plus toutes les dix minutes.
   */
  async mesures(): Promise<Map<string, { justes: number; total: number }>> {
    const garde = this.mesuresGardees
    if (garde && this.maintenant() - garde.a < MESURES_GARDEES_MS) return garde.parQuestion
    // Sans les révisions du carnet : elles ne reposent que ce qu'on a raté,
    // dont on a lu la bonne réponse la veille — comptées, elles feraient
    // passer pour faciles les questions que tout le monde rate une fois.
    const res = await this.client.execute(
      `SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM campagne_reponses
       WHERE serie_id NOT IN (SELECT id FROM campagne_series WHERE mode = 'revision') GROUP BY reserve_id`,
    )
    const parQuestion = new Map(res.rows.map(r => [String(r.reserve_id), { justes: Number(r.justes), total: Number(r.total) }]))
    this.mesuresGardees = { a: this.maintenant(), parQuestion }
    return parQuestion
  }

  /** Les questions de la base qu'un joueur a déjà vues en campagne : elles passent après les autres. */
  /** Les questions qu'il a vues — répondues, en série, en épreuve ou au défi —, et quand pour la dernière fois (`parFraicheur`). */
  private async vuesPar(profileId: string): Promise<Map<string, number>> {
    const res = await this.client.execute({
      sql: `SELECT r.reserve_id, MAX(r.repondue_le) AS le FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
            WHERE s.profile_id = ? GROUP BY r.reserve_id`,
      args: [profileId],
    })
    return new Map(res.rows.map(r => [String(r.reserve_id), Number(r.le)]))
  }

  /** Les sujets qui ont de quoi faire une série, comptés sur ce que la campagne peut poser. */
  private sujetsJouables(jouables: readonly QuestionDeLaBase[]): { sujet: string; questions: number }[] {
    const compte = new Map<string, number>()
    for (const q of jouables) for (const s of sujetsDeLaQuestion(q)) compte.set(s, (compte.get(s) ?? 0) + 1)
    return SUJETS.filter(s => (compte.get(s.cle) ?? 0) >= QUESTIONS_POUR_JOUER).map(s => ({ sujet: s.cle, questions: compte.get(s.cle)! }))
  }

  async etat(profileId: string): Promise<EtatDeCampagne> {
    const [series, jouables, parJour, enCours, records] = await Promise.all([
      this.client.execute({
        sql: `SELECT COUNT(*) AS n, COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`,
        args: [profileId],
      }),
      this.jouables(),
      this.justesParJour(profileId),
      this.serieEnCours(profileId),
      this.recordsParCategorie(profileId),
    ])
    const aujourdhui = parJour.get(jourDe(this.maintenant())) ?? 0
    return {
      record: Number(series.rows[0]?.record ?? 0),
      series: Number(series.rows[0]?.n ?? 0),
      xpAujourdhui: xpDuJourDeCampagne(aujourdhui),
      justesAujourdhui: aujourdhui,
      enCours: enCours ? vueDeSerie(enCours) : null,
      categories: parCategorie(jouables),
      sujets: this.sujetsJouables(jouables),
      questions: jouables.length,
      records: [...records].map(([categorie, record]) => ({ categorie, record })),
    }
  }

  // ── Les récompenses ─────────────────────────────────────────────────────

  /**
   * Ce que la campagne compte pour ses paliers : le record d'une série,
   * ses questions expertes trouvées et toutes ses bonnes réponses —
   * épreuves des sentiers comprises pour ces deux-là. Le niveau d'une
   * question est celui que la série lui donnait quand elle l'a posée.
   */
  async statsDe(profileId: string): Promise<StatsDeCampagne> {
    const [record, justes, expertes] = await this.client.batch(
      [
        {
          sql: `SELECT COALESCE(MAX(justes), 0) AS n FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`,
          args: [profileId],
        },
        { sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] },
        // Une experte retrouvée en révision ne compte pas pour L'Érudit : on
        // en aurait fait trois d'une seule, ratée exprès.
        {
          sql: `SELECT COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                WHERE s.profile_id = ? AND s.mode <> 'revision' AND r.juste = 1 AND json_extract(s.questions, '$[' || r.position || '].niveau') = 'expert'`,
          args: [profileId],
        },
      ],
      'read',
    )
    return { record: Number(record.rows[0]?.n ?? 0), justes: Number(justes.rows[0]?.n ?? 0), expertes: Number(expertes.rows[0]?.n ?? 0) }
  }

  /** Son record dans chaque catégorie jouée seule : la meilleure série d'une seule catégorie. */
  async recordsParCategorie(profileId: string): Promise<Map<string, number>> {
    const res = await this.client.execute({
      sql: `SELECT json_extract(categories, '$[0]') AS categorie, MAX(justes) AS record FROM campagne_series
            WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES} AND categories IS NOT NULL AND json_array_length(categories) = 1
            GROUP BY categorie`,
      args: [profileId],
    })
    return new Map(res.rows.filter(r => r.categorie != null).map(r => [String(r.categorie), Number(r.record)]))
  }

  /**
   * Ce qu'une série finie fait tomber : le Funambule (neuf bonnes réponses
   * d'affilée sur sa dernière vie), Sans une égratignure (les expertes
   * atteintes sans perdre une vie), la Grande Série (trente bonnes réponses
   * dans une série de toutes les catégories), le Tour du monde (dix dans une
   * série de chacune des douze) — puis les paliers que sa campagne atteint.
   */
  private async recompenserLaSerie(profileId: string, s: Serie): Promise<Recompenses> {
    if (!this.recompenses) return {}
    try {
      const res = await this.client.execute({ sql: 'SELECT position, juste FROM campagne_reponses WHERE serie_id = ? ORDER BY position', args: [s.id] })
      const cles = hautsFaitsDeLaSerie(
        s,
        res.rows.map(r => Number(r.juste) === 1),
      )
      // Une fois : sa condition tenue le reste, et il tombait à chaque série
      // d'après — « Nouveau haut fait » à chaque fin, et maintenant qu'il
      // paie, de l'expérience à chaque série perdue en trois questions.
      if (!this.recompenses.recompensesOf(profileId).has('hf:tour-du-monde') && (await this.tourDuMondeFait(profileId))) cles.push('hf:tour-du-monde')
      return await this.recompenser(profileId, s.id, cles, s.finieLe ?? this.maintenant())
    } catch (e) {
      // La série est rangée : une étagère muette n'y change rien, la relecture rattrapera.
      console.error('[campagne] récompenses de la série non rangées :', e)
      return {}
    }
  }

  /** Dix bonnes réponses dans une série de chacune des douze catégories, jouée seule. */
  private async tourDuMondeFait(profileId: string): Promise<boolean> {
    const records = await this.recordsParCategorie(profileId)
    return CATEGORIES.every(c => (records.get(c) ?? 0) >= RECORD_DU_TOUR_DU_MONDE)
  }

  /** Range ces hauts faits sous la série, puis les paliers qu'elle fait atteindre, et dit ce que tout cela ouvre. */
  private async recompenser(profileId: string, serieId: string, cles: readonly string[], quand: number): Promise<Recompenses> {
    if (!this.recompenses) return {}
    const sous = cleDeSerie(serieId)
    const neufs = await this.recompenses.ranger(profileId, sous, cles, quand)
    const paliers = await this.recompenses.accorderPaliersDeCampagne(profileId, sous, await this.statsDe(profileId))
    const tombees = [...neufs, ...paliers]
    if (tombees.length === 0) return {}
    const legendaires = this.recompenses.legendairesOuverts(profileId, tombees)
    return {
      recompenses: tombees.map(tombee),
      ...(legendaires.length > 0 && { legendaires }),
    }
  }

  /**
   * Relit toutes les séries finies avec les règles du jour, une fois par
   * version (`VERSION_DES_SERIES`) : ce que leur fin aurait décerné, et les
   * paliers que la campagne de chacun atteint. Les séries d'avant la colonne
   * des catégories y gagnent la leur, lue sur leurs questions : toutes de la
   * même catégorie, c'était une série d'une seule.
   */
  async relireLesSeries(): Promise<{ series: number; profils: number } | null> {
    if (!this.recompenses) return null
    const fait = await this.client.execute({ sql: 'SELECT valeur FROM campagne_meta WHERE cle = ?', args: ['relecture_des_series'] })
    if (Number(fait.rows[0]?.valeur ?? 0) >= VERSION_DES_SERIES) return null
    const res = await this.client.execute(`SELECT * FROM campagne_series WHERE finie_le IS NOT NULL AND ${SERIES} ORDER BY finie_le`)
    const profils = new Set<string>()
    for (const r of res.rows) {
      const s = versSerie(r)
      profils.add(s.profileId)
      // Une série à sujet a ses catégories NULL sans être d'avant la colonne : elle n'en gagne pas.
      if (r.categories == null && r.sujet == null) {
        const toutes = new Set(s.questions.map(q => q.categorie).filter(Boolean))
        if (toutes.size === 1) {
          s.categories = [...toutes] as string[]
          await this.client.execute({ sql: 'UPDATE campagne_series SET categories = ? WHERE id = ?', args: [JSON.stringify(s.categories), s.id] })
        }
      }
      await this.avecVerrou(s.profileId, () => this.recompenserLaSerie(s.profileId, s))
    }
    // Les épreuves comptent pour Le Marathonien et L'Érudit : un passage par profil.
    const joueurs = await this.client.execute(`SELECT DISTINCT profile_id FROM campagne_series WHERE finie_le IS NOT NULL`)
    for (const r of joueurs.rows) {
      const id = String(r.profile_id)
      profils.add(id)
      await this.avecVerrou(id, async () => this.recompenses!.accorderPaliersDeCampagne(id, cleDeSerie('relecture'), await this.statsDe(id)))
    }
    await this.client.execute({
      sql: 'INSERT INTO campagne_meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur',
      args: ['relecture_des_series', String(VERSION_DES_SERIES)],
    })
    return { series: res.rows.length, profils: profils.size }
  }

  /**
   * Une série neuve — la précédente, laissée en route, s'arrête là. Chaque
   * marche tire d'abord parmi les questions que ce joueur n'a jamais vues :
   * il ne revoit une question qu'une fois toutes les autres de sa marche
   * passées, la plus anciennement vue d'abord (`parFraicheur`), et la base
   * en compte des milliers. Sur un sujet (`shared/sujets.ts`), ses
   * catégories n'y sont pour rien : il les traverse toutes.
   */
  commencer(profileId: string, categories?: readonly string[], sujet?: string): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const suivi = sujet === undefined ? undefined : sujetParCle(sujet)
      if (sujet !== undefined && !suivi) throw new Error('Ce sujet n’existe plus : choisis-en un autre')
      const [toutes, mesure, vues, laissee] = await Promise.all([this.jouables(suivi ? undefined : categories), this.mesures(), this.vuesPar(profileId), this.serieEnCours(profileId)])
      const jouables = suivi ? toutes.filter(q => sujetsDeLaQuestion(q).includes(suivi.cle)) : toutes
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error(
          suivi
            ? 'Pas assez de questions sur ce sujet pour l’instant : choisis-en un autre'
            : categories && categories.length > 0
              ? 'Pas assez de questions dans ces catégories : ajoutes-en une autre'
              : 'La campagne n’a pas encore de questions à poser : reviens bientôt',
        )
      }
      const maintenant = this.maintenant()
      const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
      // Battues, puis rangées par ce qu'il en a vu : chaque marche garde cet ordre.
      for (const q of parFraicheur(melanger(jouables), vues, maintenant)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
      const questions = ordreDeSerie(parNiveau, QUESTIONS_PAR_SERIE).map(x => versQuestionDeSerie(x.question, x.niveau))
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'serie',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: suivi ? null : lireCategories(categoriesRetenues(categories)),
        sujet: suivi?.cle ?? null,
      }
      this.enCours.delete(profileId)
      await this.client.batch(
        [
          // La série laissée en route s'arrête : une seule à la fois. Une épreuve des sentiers, elle, attend.
          { sql: `UPDATE campagne_series SET finie_le = ? WHERE profile_id = ? AND finie_le IS NULL AND ${SERIES}`, args: [maintenant, profileId] },
          {
            sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, categories, sujet)
                  VALUES (?, ?, ?, 0, ?, 0, ?, NULL, ?, ?)`,
            args: [serie.id, profileId, JSON.stringify(questions), VIES, maintenant, serie.categories ? JSON.stringify(serie.categories) : null, serie.sujet ?? null],
          },
        ],
        'write',
      )
      this.garderEnCours(serie)
      // La série laissée finit comme une série abandonnée : ce qu'elle a
      // joué fait tomber ses hauts faits — trente bonnes réponses avant de
      // poser le téléphone font la Grande Série. Rien ne s'annonce : la
      // nouvelle commence, et la collection les garde.
      if (laissee) await this.recompenserLaSerie(profileId, { ...laissee, finieLe: maintenant })
      return vueDeSerie(serie)
    })
  }

  /**
   * Abandonner une série — « Recommencer » alors qu'il reste des vies (un
   * retour de joueur du 10 octobre 2026) : elle finit là, comme perdue. Ni
   * vie ni expérience en jeu — une série perdue n'en coûte pas non plus — ;
   * son record et ses hauts faits se lisent sur ce qu'elle a joué. Le défi
   * de la semaine n'a qu'une tentative : elle ne s'abandonne pas.
   */
  abandonnerSerie(profileId: string, id: string): Promise<FinDeSerie> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const s = gardee?.id === id ? gardee : await this.serie(profileId, id)
      if (s?.mode === 'defi' || s?.mode === 'duel') throw new Error('Le défi n’a qu’une tentative : elle ne s’abandonne pas')
      if (s?.mode === 'rencontre') throw new Error('Une rencontre se joue jusqu’au bout : elle ne s’abandonne pas')
      if (!s || s.mode !== 'serie') throw new Error('Cette série est introuvable')
      if (s.finieLe !== null) throw new Error('Cette série est finie : commence-en une autre')
      const maintenant = this.maintenant()
      const [avant] = await this.client.batch(
        [
          { sql: `SELECT COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`, args: [profileId] },
          { sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ? AND finie_le IS NULL', args: [maintenant, s.id] },
        ],
        'write',
      )
      this.enCours.delete(profileId)
      const recordAvant = Number(avant.rows[0]?.record ?? 0)
      const gagnees = await this.recompenserLaSerie(profileId, { ...s, finieLe: maintenant })
      return {
        justes: s.justes,
        recordAvant,
        ...(s.justes > recordAvant && { record: true }),
        ...(s.index > 0 && { niveauAtteint: plusHaute(s.questions.slice(0, s.index)) }),
        ...gagnees,
      }
    })
  }

  /** La série en cours d'un profil, gardée — la plus récente en dernier, pour oublier d'abord la plus ancienne. */
  private garderEnCours(serie: Serie) {
    this.enCours.delete(serie.profileId)
    this.enCours.set(serie.profileId, serie)
    if (this.enCours.size > SERIES_GARDEES) this.enCours.delete(this.enCours.keys().next().value!)
  }

  /** La série en cours de ce profil, s'il en a une. */
  async serieEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND finie_le IS NULL AND ${SERIES} ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  private async serie(profileId: string, id: string): Promise<Serie | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM campagne_series WHERE id = ? AND profile_id = ?', args: [id, profileId] })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Une réponse : juste ou non, une vie de moins sinon, et la question
   * suivante. Une réponse qui ne vise pas la question en cours — un double
   * toucher, un onglet resté derrière — ne compte pas : elle reçoit l'état.
   */
  repondre(profileId: string, id: string, index: number, choix: unknown): Promise<ReponseDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const s = gardee?.id === id ? gardee : await this.serie(profileId, id)
      // Le voisin n'en sait pas plus (invariant 3) : la série d'un autre est introuvable.
      if (!s || (s.mode !== 'serie' && s.mode !== 'defi' && s.mode !== 'duel' && s.mode !== 'revision' && s.mode !== 'rencontre')) throw new Error('Cette série est introuvable')
      // Lundi à minuit, le défi se clôt : son classement est figé, sa vainqueur rangé.
      if (s.mode === 'defi' && s.semaine !== this.semaineDeLHeure().semaine) throw new Error('Ce défi est clos : celui de cette semaine t’attend')
      // Un défi entre amis ferme au bout de sa semaine, tentatives en route comprises.
      if (s.mode === 'duel' && (await this.duelFerme(s.duel))) throw new Error('Ce défi est fermé : son classement est figé')
      if (s.finieLe !== null) {
        throw new Error(
          s.mode === 'defi'
            ? 'Tu as relevé le défi de cette semaine : le prochain ouvre lundi'
            : s.mode === 'duel'
              ? 'Tu as relevé ce défi : son classement t’attend'
              : s.mode === 'revision'
                ? 'Cette révision est finie : ton carnet t’attend'
                : s.mode === 'rencontre'
                  ? 'Cette rencontre est finie : cherche un autre adversaire'
                  : 'Cette série est finie : commence-en une autre',
        )
      }
      if (index !== s.index) throw new Error('Cette question est passée : la série a continué sans elle')
      const q = s.questions[s.index]
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      // Une révision n'a pas de vies : on y vient apprendre ce qu'on a raté,
      // et l'erreur remet seulement la question au lendemain.
      const vies = juste || s.mode === 'revision' ? s.vies : s.vies - 1
      const justes = s.justes + (juste ? 1 : 0)
      const position = s.index + 1
      const finie = vies <= 0 || position >= s.questions.length
      const maintenant = this.maintenant()
      // Tout dans un lot : le record se lit avant d'écrire la fin — battu, la
      // fin le dit, et l'ancien avec —, ses bonnes réponses après la sienne,
      // de quoi relire sa ligne d'expérience. Chacun coûtait un aller-retour.
      const lot: InStatement[] = [
        {
          sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)',
          args: [s.id, s.index, q.id, c, juste ? 1 : 0, maintenant],
        },
        {
          sql: 'UPDATE campagne_series SET position = ?, vies = ?, justes = ?, finie_le = ? WHERE id = ?',
          args: [position, vies, justes, finie ? maintenant : null, s.id],
        },
      ]
      // Le record est celui des séries : un défi a son classement à lui.
      const record = finie && s.mode === 'serie'
      if (record) lot.unshift({ sql: `SELECT COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`, args: [profileId] })
      if (juste) lot.push(...lecturesDeLExperience(profileId))
      let res: ResultSet[]
      try {
        res = await this.client.batch(lot, 'write')
      } catch (e) {
        this.enCours.delete(profileId)
        throw e
      }
      if (finie) this.enCours.delete(profileId)
      else this.garderEnCours({ ...s, index: position, vies, justes })
      const avant = record ? Number(res[0].rows[0]?.record ?? 0) : 0
      const xp = juste ? await this.crediter(profileId, res.slice(-2)) : 0
      const revision = s.mode === 'revision'
      const gagnees = !finie
        ? {}
        : revision
          ? await this.recompenserLaRevision(profileId, s.id, maintenant)
          : await this.recompenserLaSerie(profileId, { ...s, index: position, vies, justes, finieLe: maintenant })
      // L'Éclat du défi se tire ici, à sa tentative finie — jamais dans
      // `recompenserLaSerie`, que la relecture des séries rejoue.
      const eclat = finie && s.mode === 'defi' && s.semaine ? await this.tirerLEclat(profileId, s.semaine) : {}
      const defi =
        finie && s.mode === 'defi' && s.semaine
          ? await this.placeAuDefi(s.semaine, profileId)
          : finie && s.mode === 'duel' && s.duel
            ? await this.placeAuDuel(s.duel, profileId)
            : null
      // Finie, une révision redit son carnet : ce qu'elle a appris, ce qui reste à revoir.
      const carnet = finie && revision ? await this.carnetApres(profileId) : null
      return {
        juste,
        xp,
        bonne: q.bonne,
        anecdote: q.anecdote,
        vies,
        justes,
        finie,
        ...(finie && !revision && { niveauAtteint: plusHaute(s.questions.slice(0, position)) }),
        ...(record && { recordAvant: avant }),
        ...(record && justes > avant && { record: true }),
        ...(defi && { defi }),
        ...(revision && { revision: suiteDeLaRevision(q.etape ?? 0, juste) }),
        ...(carnet && { carnet }),
        // Une rencontre : ce que son adversaire avait fait de la même question, et les deux scores.
        ...(s.mode === 'rencontre' && s.adversaire && { rencontre: coupDeLaRencontre(s.adversaire, s.index, justes, finie) }),
        ...(!finie && { suivante: questionMontree(s.questions[position], position) }),
        ...ensemble(gagnees, eclat),
      }
    })
  }

  /**
   * L'Éclat du défi de la semaine : une chance sur `CHANCE_ECLAT_DU_DEFI`,
   * tirée quand sa tentative finit — une fois par semaine : il n'y en a
   * qu'une, et elle ne finit qu'une fois. Rangé sous la semaine
   * (`cleDuDefi`), avec les paliers de La Pluie d'Éclats qu'il fait tomber ;
   * rend ce que la fin du défi en annonce.
   */
  private async tirerLEclat(profileId: string, semaine: string): Promise<RecompensesDuDefi> {
    if (!this.recompenses) return {}
    try {
      const tire = await this.recompenses.tirerUnEclat(profileId, cleDuDefi(semaine), CHANCE_ECLAT_DU_DEFI)
      if (!tire) return {}
      const legendaires = this.recompenses.legendairesOuverts(profileId, tire.paliers)
      return {
        eclat: tire.avatar,
        ...(tire.paliers.length > 0 && { recompenses: tire.paliers.map(tombee) }),
        ...(legendaires.length > 0 && { legendaires }),
      }
    } catch (e) {
      // Le défi est rangé : un Éclat que la base refuse tombe à côté, comme un tirage manqué.
      console.error('[campagne] Éclat du défi non rangé :', e)
      return {}
    }
  }

  /**
   * Une bonne réponse vient d'entrer : sa ligne d'expérience se relit en
   * entier (`lecturesDeLExperience`, lues dans le lot qui l'écrit), sous le
   * verrou du profil où l'on est déjà. Rend ce que cette réponse rapporte —
   * double parmi les vingt premières du jour. Une base qui refuse d'écrire la
   * ligne ne fait pas échouer la réponse, déjà rangée : la bonne réponse
   * suivante réécrit la ligne entière.
   */
  private async crediter(profileId: string, lues: readonly ResultSet[]): Promise<number> {
    const { parJour, xp } = experienceLue(lues)
    try {
      await this.ecrireXp(profileId, xp, parJour.size)
      return xpDeLaBonneReponse(parJour.get(jourDe(this.maintenant())) ?? 1)
    } catch (e) {
      console.error('[campagne] expérience non écrite, la prochaine bonne réponse la réécrira :', e)
      return 0
    }
  }

  /**
   * Le barème du solo du 6 octobre 2026, appliqué à ce qui est déjà joué —
   * une fois, au démarrage qui l'apporte (`core/baremeDuSolo.ts`) : la ligne
   * de chaque joueur de la campagne se réécrit de ses réponses et de ses
   * paliers, au barème du jour. Rend les profils réécrits.
   */
  async revaloriser(): Promise<string[]> {
    const joueurs = await this.client.execute('SELECT DISTINCT profile_id FROM campagne_series')
    const ids = joueurs.rows.map(r => String(r.profile_id))
    for (const id of ids) {
      await this.avecVerrou(id, async () => {
        const { parJour, xp } = experienceLue(await this.client.batch(lecturesDeLExperience(id), 'read'))
        await this.ecrireXp(id, xp, parJour.size)
      })
    }
    return ids
  }

  /** « Mes réponses », une série finie : chaque question posée, sa bonne réponse, la sienne, et l'anecdote. */
  async correction(profileId: string, id: string): Promise<CorrectionDeCampagne[]> {
    const s = await this.serie(profileId, id)
    if (!s) throw new Error('Cette série est introuvable')
    // En cours, la correction donnerait les réponses de la question qu'on a sous les yeux.
    if (s.finieLe === null) throw new Error('La correction attend la fin de la série')
    // Le défi de la semaine se corrige à sa clôture : finie, la sienne
    // soufflerait ses réponses à ceux qui jouent encore.
    if (s.mode === 'defi' && s.semaine === this.semaineDeLHeure().semaine) throw new Error('La correction du défi s’ouvre à sa clôture, lundi')
    // Un défi entre amis de même : finie, la sienne soufflerait ses réponses à ceux qu'il a défiés.
    if (s.mode === 'duel' && !(await this.duelFerme(s.duel))) throw new Error('La correction du défi s’ouvre à sa fermeture : tes amis jouent encore')
    const res = await this.client.execute({ sql: 'SELECT position, choix, juste FROM campagne_reponses WHERE serie_id = ? ORDER BY position', args: [s.id] })
    return res.rows.map(r => {
      const q = s.questions[Number(r.position)]
      return {
        texte: q.texte,
        reponses: q.reponses,
        bonne: q.bonne,
        choix: r.choix === null ? null : Number(r.choix),
        juste: Number(r.juste) === 1,
        niveau: q.niveau,
        anecdote: q.anecdote,
      }
    })
  }

  /** Lit la base en fond, sans rien attendre : la première série la trouve prête (`PRECHAUFFAGE_CAMPAGNE_MS`, `server.ts`). */
  prechauffer(): void {
    this.base().catch(e => console.error('[campagne] base non lue en fond — la première série la relira :', e))
  }

  /** Cet intitulé est-il dans la base ? La réserve du quiz du jour le refuse alors (`JourStore.dansLaCampagne`). */
  async dansLaBase(empreinte: string): Promise<boolean> {
    return (await this.base()).empreintes.has(empreinte)
  }

  /**
   * Ses confettis de campagne : une bonne réponse, un confetti — séries,
   * épreuves et défis —, et ce que paient les étoiles de ses sentiers, la
   * meilleure note de chaque palier (`confettisDesEtoiles`). Relus à chaque
   * lecture, d'un seul aller-retour.
   */
  async confettisDe(profileId: string): Promise<number> {
    const [justes, acquis, validees] = await this.client.batch(
      [{ sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] }, ...this.lecturesDesSentiers(profileId)],
      'read',
    )
    return Number(justes.rows[0]?.n ?? 0) + confettisDesEtoiles(sentiersLus(acquis.rows, validees.rows))
  }

  /**
   * Ce que la campagne sait de lui (`Savoir`) — séries, épreuves des
   * sentiers et défis ensemble : ses questions et ses bonnes réponses,
   * catégorie par catégorie — ses écussons de savoir et « Ma carrière »,
   * avec les soirées et le quiz du jour —, et la base de sa précision. La
   * catégorie est celle que la série a gardée de sa question : une question
   * corrigée ou retirée depuis ne reprend pas ce qu'il a su ce jour-là, pas
   * plus que son expérience ou ses confettis.
   */
  async savoirDe(profileId: string): Promise<Savoir> {
    // La catégorie se lit dans la sous-requête, que `LIMIT -1` garde à part :
    // aplatie dans le regroupement, SQLite recopiait dans son tri le JSON
    // entier de la série — soixante questions — pour chacune de ses
    // réponses. Six fois plus lent pour un joueur de cinq cents séries, et
    // la carte la lit à chaque toucher sur son nom. Les révisions du carnet
    // n'y sont pas : elles reposent ce qu'il a raté, réponse lue la veille,
    // et sa précision y gagnait ce qu'il venait d'apprendre par cœur.
    const res = await this.client.execute({
      sql: `SELECT categorie, COUNT(*) AS questions, COUNT(choix) AS repondues, SUM(juste) AS justes
            FROM (SELECT json_extract(s.questions, '$[' || r.position || '].categorie') AS categorie, r.choix AS choix, r.juste AS juste
                  FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
                  WHERE s.profile_id = ? AND s.mode <> 'revision'
                  LIMIT -1)
            GROUP BY categorie`,
      args: [profileId],
    })
    return savoirDesLignes(res.rows)
  }

  // ── Le carnet de révision ───────────────────────────────────────────────
  //
  // Ce qu'il a raté revient le lendemain, puis trois jours après, puis une
  // semaine (`shared/revision.ts`) : retrouvé à chaque rendez-vous, c'est
  // appris. Rien ne se tient à côté : le carnet se relit dans le journal des
  // réponses, comme l'expérience. Une révision est une série d'un autre mode
  // (`mode = 'revision'`), sans vies : ses bonnes réponses paient comme en
  // série — un confetti, l'expérience d'une bonne réponse —, mais ni la
  // mesure des difficultés ni la précision ne la comptent, elle ne repose que
  // ce qu'il a raté.

  /**
   * Ce que ses réponses disent de chaque question qu'il a ratée
   * (`suiviDeLaQuestion`), lues dans l'ordre où elles sont venues. Le défi de
   * la semaine qui court et un défi entre amis ouvert n'y entrent qu'à leur
   * clôture : leur correction attend, le carnet aussi — il redonnerait leurs
   * réponses à ceux qui jouent encore.
   */
  private async suivisDe(profileId: string): Promise<Map<string, SuiviDeRevision>> {
    const res = await this.client.execute({
      sql: `WITH miennes AS (
              SELECT r.reserve_id AS id, r.juste AS juste, r.repondue_le AS le, r.serie_id AS serie, r.position AS position
              FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
              WHERE s.profile_id = ?
                AND NOT (s.mode = 'defi' AND s.semaine >= ?)
                AND NOT (s.mode = 'duel' AND s.duel IN (SELECT code FROM campagne_duels WHERE ferme_le > ?))
            )
            SELECT id, juste, le FROM miennes WHERE id IN (SELECT id FROM miennes WHERE juste = 0)
            ORDER BY le, serie, position`,
      args: [profileId, this.semaineDeLHeure().semaine, this.maintenant()],
    })
    const parQuestion = new Map<string, { le: number; juste: boolean }[]>()
    for (const r of res.rows) {
      const id = String(r.id)
      const passage = { le: Number(r.le), juste: Number(r.juste) === 1 }
      const passages = parQuestion.get(id)
      if (passages) passages.push(passage)
      else parQuestion.set(id, [passage])
    }
    const suivis = new Map<string, SuiviDeRevision>()
    for (const [id, passages] of parQuestion) {
      const suivi = suiviDeLaQuestion(passages)
      if (suivi) suivis.set(id, suivi)
    }
    return suivis
  }

  /** Sa révision laissée en route, s'il en a une : elle se reprend. */
  private async revisionEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'revision' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Son carnet : ce qui est à revoir aujourd'hui, ce qui revient demain et
   * plus tard, ce qu'il a appris — parmi les questions que la campagne pose
   * encore : retirée ou remplacée depuis, une question n'y est plus.
   */
  async carnet(profileId: string): Promise<EtatDuCarnet> {
    const [suivis, jouables, ouverte] = await Promise.all([this.suivisDe(profileId), this.jouables(), this.revisionEnCours(profileId)])
    const ids = new Set(jouables.map(q => q.id))
    const aujourdhui = jourDe(this.maintenant())
    const demain = jourAvant(aujourdhui, -1)
    const carnet: EtatDuCarnet = { aRevoir: 0, demain: 0, plusTard: 0, prochainJour: null, appris: 0, enCours: ouverte ? vueDeSerie(ouverte) : null }
    for (const [id, s] of suivis) {
      if (!ids.has(id)) continue
      if (s.apprise) carnet.appris++
      else if (s.revientLe <= aujourdhui) carnet.aRevoir++
      else {
        if (s.revientLe === demain) carnet.demain++
        else carnet.plusTard++
        if (!carnet.prochainJour || s.revientLe < carnet.prochainJour) carnet.prochainJour = s.revientLe
      }
    }
    return carnet
  }

  /** Le carnet relu à la fin d'une révision ; une base qui se tait l'ôte de la réponse, pas la réponse. */
  private async carnetApres(profileId: string): Promise<EtatDuCarnet | null> {
    try {
      return await this.carnet(profileId)
    } catch (e) {
      console.error('[campagne] carnet non relu après la révision :', e)
      return null
    }
  }

  /**
   * Ce qu'il a appris, le plus récent d'abord — les cent derniers : la
   * question, sa réponse, son anecdote. Jamais ce qui reste à revoir : la
   * bonne réponse attend son rendez-vous.
   */
  async faitsAppris(profileId: string): Promise<FaitAppris[]> {
    const [suivis, jouables] = await Promise.all([this.suivisDe(profileId), this.jouables()])
    const parId = new Map(jouables.map(q => [q.id, q]))
    const faits: FaitAppris[] = []
    for (const [id, s] of suivis) {
      const q = parId.get(id)
      if (s.apprise && q) faits.push({ texte: q.texte, reponse: q.reponses[q.bonne], anecdote: q.anecdote, categorie: q.meta.categorie, le: s.le })
    }
    return faits.sort((a, b) => b.le.localeCompare(a.le)).slice(0, FAITS_MONTRES)
  }

  /**
   * Une révision : les questions dont le rendez-vous est arrivé, les plus en
   * retard d'abord, dix au plus (`QUESTIONS_PAR_REVISION`). Celle qu'il a
   * laissée en route se reprend ; rien à revoir, rien ne commence. Une série
   * en cours, elle, attend : la révision ne la clôt pas.
   */
  commencerRevision(profileId: string): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const ouverte = await this.revisionEnCours(profileId)
      if (ouverte) {
        this.garderEnCours(ouverte)
        return vueDeSerie(ouverte)
      }
      const [suivis, jouables, mesure] = await Promise.all([this.suivisDe(profileId), this.jouables(), this.mesures()])
      const aujourdhui = jourDe(this.maintenant())
      const parId = new Map(jouables.map(q => [q.id, q]))
      const dues: { q: QuestionDeLaBase; etape: number; revientLe: string }[] = []
      for (const [id, s] of suivis) {
        const q = parId.get(id)
        if (q && !s.apprise && s.revientLe <= aujourdhui) dues.push({ q, etape: s.etape, revientLe: s.revientLe })
      }
      if (dues.length === 0) throw new Error(suivis.size === 0 ? 'Ton carnet est vide : une question ratée t’y attendra le lendemain' : 'Rien à revoir aujourd’hui : reviens demain')
      // Battues avant d'être rangées : à rendez-vous égal, ni l'ordre de la
      // base ni celui des séries ne décide ; puis dans le désordre, pour que
      // les catégories se mêlent.
      const tirees = melanger(dues)
        .sort((a, b) => a.revientLe.localeCompare(b.revientLe))
        .slice(0, QUESTIONS_PAR_REVISION)
      const questions = melanger(tirees).map(d => ({ ...versQuestionDeSerie(d.q, niveauDeQuestion(d.q.meta.difficulte, mesure.get(d.q.id))), etape: d.etape }))
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'revision',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: null,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode)
              VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'revision')`,
        args: [serie.id, profileId, JSON.stringify(questions), VIES, this.maintenant()],
      })
      this.garderEnCours(serie)
      return vueDeSerie(serie)
    })
  }

  /**
   * La fin d'une révision : aucun haut fait de série — elle n'en est pas
   * une —, seulement les paliers que ses bonnes réponses font atteindre (Le
   * Marathonien). Une étagère qui se tait n'y change rien : la révision est
   * rangée, et la suivante les relira.
   */
  private async recompenserLaRevision(profileId: string, serieId: string, quand: number): Promise<Recompenses> {
    try {
      return await this.recompenser(profileId, serieId, [], quand)
    } catch (e) {
      console.error('[campagne] récompenses de la révision non rangées :', e)
      return {}
    }
  }

  // ── Le défi de la semaine ───────────────────────────────────────────────
  //
  // La même série pour tous, du lundi au dimanche (`shared/campagne.ts`) :
  // une série d'un autre mode (`mode = 'defi'`, sous son lundi), dans les
  // mêmes tables — l'expérience, les confettis et les hauts faits de série
  // la comptent sans rien en savoir ; le record des séries, non. Rien ne
  // tourne le lundi à minuit : la première demande de la semaine clôt les
  // précédentes (`cloreLesDefis`), comme la nuit du quiz du jour.

  /**
   * La semaine de Paris et la précédente, gardées pour l'heure : le laurier
   * d'argent les demande pour chaque profil de chaque instantané, et minuit
   * à Paris tombe toujours sur une heure pleine du temps universel.
   */
  private semaineDeLHeure(): { semaine: string; passee: string } {
    const heure = Math.floor(this.maintenant() / HEURE_MS)
    if (this.semaineGardee?.heure !== heure) {
      const semaine = semaineDe(jourDe(heure * HEURE_MS))
      this.semaineGardee = { heure, semaine, passee: semaineAvant(semaine) }
    }
    return this.semaineGardee
  }

  /**
   * Les questions du défi d'une semaine : tirées au premier qui l'ouvre,
   * dans toute la base, marche par marche comme une série — sans « jamais
   * vues d'abord », qui ne vaut que pour un joueur —, puis figées en base :
   * une question retirée ou ajoutée en cours de semaine ne change pas la
   * série des autres. Deux serveurs qui tirent ensemble gardent le premier
   * tirage écrit. Sans assez de questions, rien ne se fige.
   */
  private tirageDuDefi(semaine: string): Promise<QuestionDeSerie[]> {
    const garde = this.tirages.get(semaine)
    if (garde) return Promise.resolve(garde)
    return this.avecVerrou('#defi', async () => {
      const deja = this.tirages.get(semaine)
      if (deja) return deja
      const lire = async () => {
        const res = await this.client.execute({ sql: 'SELECT questions FROM campagne_defis WHERE semaine = ?', args: [semaine] })
        return res.rows[0] ? (JSON.parse(String(res.rows[0].questions)) as QuestionDeSerie[]) : null
      }
      let questions = await lire()
      if (!questions) {
        const [jouables, mesure] = await Promise.all([this.jouables(), this.mesures()])
        if (jouables.length < QUESTIONS_POUR_JOUER) return []
        const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
        for (const q of melanger(jouables)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
        const tirees = ordreDeSerie(parNiveau, QUESTIONS_PAR_SERIE).map(x => versQuestionDeSerie(x.question, x.niveau))
        await this.client.execute({
          sql: 'INSERT INTO campagne_defis (semaine, questions, tire_le) VALUES (?, ?, ?) ON CONFLICT(semaine) DO NOTHING',
          args: [semaine, JSON.stringify(tirees), this.maintenant()],
        })
        questions = (await lire()) ?? tirees
      }
      this.tirages.set(semaine, questions)
      for (const k of [...this.tirages.keys()]) if (k < semaineAvant(semaine)) this.tirages.delete(k)
      return questions
    })
  }

  /** Sa tentative au défi d'une semaine, s'il l'a commencée. */
  private async tentativeDuDefi(profileId: string, semaine: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'defi' AND semaine = ? ORDER BY commencee_le LIMIT 1`,
      args: [profileId, semaine],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Relever le défi de la semaine : une seule tentative. Laissée en route,
   * elle se reprend — sans chronomètre, rien ne presse avant lundi ; finie,
   * le défi attend la semaine suivante. Une série en cours, elle, attend :
   * le défi ne la clôt pas.
   */
  commencerLeDefi(profileId: string): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const { semaine } = this.semaineDeLHeure()
      const deja = await this.tentativeDuDefi(profileId, semaine)
      if (deja?.finieLe != null) throw new Error('Tu as relevé le défi de cette semaine : le prochain ouvre lundi')
      if (deja) {
        this.garderEnCours(deja)
        return vueDeSerie(deja)
      }
      const questions = await this.tirageDuDefi(semaine)
      if (questions.length < QUESTIONS_POUR_JOUER) throw new Error('Le défi n’a pas encore de questions à poser : reviens bientôt')
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'defi',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: null,
        semaine,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, semaine)
              VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'defi', ?)`,
        args: [serie.id, profileId, JSON.stringify(questions), VIES, this.maintenant(), semaine],
      })
      this.garderEnCours(serie)
      return vueDeSerie(serie)
    })
  }

  /**
   * La page du défi : sa semaine et le temps qui reste, sa tentative, le
   * classement — et la semaine passée : ses vainqueurs, qui portent le
   * laurier d'argent, et sa place à lui. La première demande de la semaine
   * clôt les précédentes.
   */
  async defi(profileId: string): Promise<DefiDeLaSemaine> {
    await this.cloreLesDefis()
    const { semaine, passee } = this.semaineDeLHeure()
    const [tentative, classement, avant, vainqueurs] = await Promise.all([
      this.tentativeDuDefi(profileId, semaine),
      this.classementDuDefi(semaine, profileId),
      this.tentativeDuDefi(profileId, passee),
      this.vainqueursDe(passee),
    ])
    let saSemainePassee: DefiDeLaSemaine['saSemainePassee']
    if (avant && avant.index > 0) {
      const place = await this.placeAuDefi(passee, profileId)
      if (place) {
        saSemainePassee = {
          serie: avant.id,
          justes: avant.justes,
          ...place,
          recompenses: vainqueurs.ids.includes(profileId) ? [tombee('hf:defi')] : [],
        }
      }
    }
    return {
      semaine,
      minutesRestantes: minutesAvantLundi(this.maintenant()),
      tentative: tentative ? vueDeSerie(tentative) : null,
      ...classement,
      vainqueurs: vainqueurs.montres,
      ...(saSemainePassee && { saSemainePassee }),
    }
  }

  /** Le classement du défi d'une semaine (`classementDesTentatives`), ouvert tant que c'est la semaine. */
  private classementDuDefi(semaine: string, pour: string | null): Promise<Pick<DefiDeLaSemaine, 'joueurs' | 'lignes' | 'moi' | 'sienne'>> {
    return this.classementDesTentatives({ mode: 'defi', semaine }, semaine === this.semaineDeLHeure().semaine, pour)
  }

  /**
   * Le classement d'un défi — de la semaine, ou entre amis : ses bonnes
   * réponses, rang partagé (invariant 15), ceux qui ont répondu à une
   * question au moins — les masqués du quiz du jour écartés, sauf pour
   * eux-mêmes. Nommé comme au quiz du jour : un homonyme y garde sa marque.
   */
  private async classementDesTentatives(
    defi: { mode: 'defi'; semaine: string } | { mode: 'duel'; code: string },
    ouverte: boolean,
    pour: string | null,
  ): Promise<Pick<DefiDeLaSemaine, 'joueurs' | 'lignes' | 'moi' | 'sienne'>> {
    const res = await this.client.execute(
      defi.mode === 'defi'
        ? { sql: `SELECT profile_id, justes, finie_le, commencee_le FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0`, args: [defi.semaine] }
        : { sql: `SELECT profile_id, justes, finie_le, commencee_le FROM campagne_series WHERE mode = 'duel' AND duel = ? AND position > 0`, args: [defi.code] },
    )
    const profils = this.profils ? await this.profils.byIds(res.rows.map(r => String(r.profile_id))) : []
    const joueurs: { profil: ProfileRec; justes: number; enCours: boolean; commenceeLe: number }[] = []
    res.rows.forEach((r, i) => {
      const profil = profils[i]
      if (!profil || (this.masque?.(profil.id) && profil.id !== pour)) return
      joueurs.push({ profil, justes: Number(r.justes), enCours: ouverte && r.finie_le === null, commenceeLe: Number(r.commencee_le) })
    })
    const p = this.profils
    if (!p) return { joueurs: 0, lignes: [] }
    const arrivee = [...joueurs].sort((a, b) => a.commenceeLe - b.commenceeLe || a.profil.id.localeCompare(b.profil.id))
    const marques = nomsAffiches(arrivee.map(j => ({ id: j.profil.id, name: j.profil.name, avatar: p.avatarPorte(j.profil) })))
    const nom = (j: (typeof joueurs)[number]) => marques.get(j.profil.id) ?? j.profil.name
    const classes = classer(joueurs, j => j.justes, nom, j => j.profil.id)
    const ligne = ({ item: j, rang }: (typeof classes)[number]): LigneDuDefi => {
      const { niveau, finition, eclat, legendaire, laurier } = p.apparenceDe(j.profil)
      return {
        profileId: j.profil.id,
        nom: nom(j),
        avatar: p.avatarPorte(j.profil),
        niveau,
        finition,
        ...(legendaire && { legendaire }),
        ...(eclat && { eclat: true as const }),
        ...(laurier && { laurier }),
        justes: j.justes,
        rang,
        ...(j.enCours && { enCours: true as const }),
      }
    }
    const montrees = classes.slice(0, LIGNES_DU_DEFI)
    const sienne = pour ? classes.find(c => c.item.profil.id === pour) : undefined
    return {
      joueurs: joueurs.length,
      lignes: montrees.map(ligne),
      ...(sienne && !montrees.includes(sienne) && { moi: ligne(sienne) }),
      ...(sienne && { sienne: sienne.item.profil.id }),
    }
  }

  /** Sa place au défi d'une semaine, s'il y a répondu : ce que la fin de sa tentative lui dit. */
  private async placeAuDefi(semaine: string, profileId: string): Promise<{ rang: number; joueurs: number } | null> {
    const c = await this.classementDuDefi(semaine, profileId)
    const sienne = c.moi ?? c.lignes.find(l => l.profileId === profileId)
    return sienne ? { rang: sienne.rang, joueurs: c.joueurs } : null
  }

  /** Les vainqueurs d'une semaine close : leurs identifiants, et ce que la page en montre. */
  private async vainqueursDe(semaine: string): Promise<{ ids: string[]; montres: DefiDeLaSemaine['vainqueurs'] }> {
    const res = await this.client.execute({ sql: 'SELECT vainqueurs FROM campagne_defis WHERE semaine = ? AND clos_le IS NOT NULL', args: [semaine] })
    const ids = lireVainqueurs(res.rows[0]?.vainqueurs).filter(id => !this.masque?.(id))
    const profils = ids.length > 0 && this.profils ? await this.profils.byIds(ids) : []
    return {
      ids,
      montres: profils.flatMap(p => (p ? [{ nom: p.name, avatar: this.profils!.avatarPorte(p) }] : [])),
    }
  }

  /**
   * Clôt les défis des semaines passées qui ne le sont pas encore : leurs
   * premiers — tous les ex æquo, à deux joueurs au moins, une bonne réponse
   * au moins — reçoivent le Vainqueur du défi, rangé sous la semaine ; les
   * tentatives laissées en route s'arrêtent là. Puis relit les vainqueurs de
   * la semaine passée, qui portent le laurier d'argent. Une fois par semaine
   * et par serveur ; rejouée, elle ne range rien deux fois.
   */
  async cloreLesDefis(): Promise<void> {
    const { semaine, passee } = this.semaineDeLHeure()
    const faite = () => this.closAvant === semaine && this.argent.semaine === passee
    if (faite()) return
    await this.avecVerrou('#defi-cloture', async () => {
      if (faite()) return
      const ouvertes = await this.client.execute({ sql: 'SELECT semaine FROM campagne_defis WHERE clos_le IS NULL AND semaine < ? ORDER BY semaine', args: [semaine] })
      for (const r of ouvertes.rows) await this.cloreLeDefi(String(r.semaine))
      await this.lireLArgent(passee)
      this.closAvant = semaine
    })
  }

  private async cloreLeDefi(semaine: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT profile_id, justes FROM campagne_series WHERE mode = 'defi' AND semaine = ? AND position > 0`,
      args: [semaine],
    })
    const joueurs = res.rows.map(r => ({ id: String(r.profile_id), justes: Number(r.justes) })).filter(j => !this.masque?.(j.id))
    const classes = classer(joueurs, j => j.justes, j => j.id, j => j.id)
    const vainqueurs = joueurs.length >= JOUEURS_POUR_LE_DEFI ? classes.filter(c => c.rang === 1 && c.item.justes > 0).map(c => c.item.id) : []
    const maintenant = this.maintenant()
    for (const id of vainqueurs) await this.recompenses?.ranger(id, cleDuDefi(semaine), ['hf:defi'], maintenant)
    await this.client.batch(
      [
        { sql: `UPDATE campagne_series SET finie_le = ? WHERE mode = 'defi' AND semaine = ? AND finie_le IS NULL`, args: [maintenant, semaine] },
        { sql: 'UPDATE campagne_defis SET clos_le = ?, vainqueurs = ? WHERE semaine = ? AND clos_le IS NULL', args: [maintenant, JSON.stringify(vainqueurs), semaine] },
      ],
      'write',
    )
    for (const s of this.enCours.values()) if (s.mode === 'defi' && s.semaine === semaine) this.enCours.delete(s.profileId)
    console.log(`[campagne] défi du ${semaine} clos : ${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''}, ${vainqueurs.length} vainqueur${vainqueurs.length > 1 ? 's' : ''}`)
  }

  /** Relit les vainqueurs de la semaine passée, et rediffuse la salle de ceux dont le laurier d'argent change. */
  private async lireLArgent(semaine: string): Promise<void> {
    const { ids } = await this.vainqueursDe(semaine)
    const avant = this.argent
    const neufs = new Set(ids)
    this.argent = { semaine, ids: neufs }
    for (const id of new Set([...neufs, ...avant.ids])) if (avant.semaine !== semaine || avant.ids.has(id) !== neufs.has(id)) this.laurierChange?.(id)
  }

  // ── Le défi entre amis ──────────────────────────────────────────────────
  //
  // Le défi de la semaine, contre qui l'on veut (`shared/campagne.ts`) : un
  // tirage figé sous un code, que son lien donne ; chacun le joue une fois,
  // dans la semaine, comme une série d'un autre mode (`mode = 'duel'`) —
  // l'expérience, les confettis et les hauts faits de série la comptent, le
  // record des séries non. Ni laurier ni haut fait à lui : on gagnerait à se
  // défier soi-même d'un second profil. Rien ne tourne à sa fermeture : la
  // première lecture d'après fige ce qui restait en route (`fermerLeDuel`).

  /** Un défi entre amis par son code, lu une fois. */
  private async duelDe(code: string | null | undefined): Promise<Duel | null> {
    if (!code) return null
    const garde = this.duels.get(code)
    if (garde) return garde
    const res = await this.client.execute({ sql: 'SELECT * FROM campagne_duels WHERE code = ?', args: [code] })
    const r = res.rows[0]
    if (!r) return null
    const duel: Duel = {
      code,
      auteur: String(r.auteur),
      questions: JSON.parse(String(r.questions)) as QuestionDeSerie[],
      categories: lireCategories(r.categories),
      sujet: typeof r.sujet === 'string' ? r.sujet : null,
      creeLe: Number(r.cree_le),
      fermeLe: Number(r.ferme_le),
      closLe: r.clos_le === null || r.clos_le === undefined ? null : Number(r.clos_le),
    }
    this.duels.set(code, duel)
    if (this.duels.size > SERIES_GARDEES) this.duels.delete(this.duels.keys().next().value!)
    return duel
  }

  /** Ce défi a-t-il fermé ? Inconnu, il l'est : rien ne s'y joue plus. */
  private async duelFerme(code: string | null | undefined): Promise<boolean> {
    const d = await this.duelDe(code)
    return !d || this.maintenant() >= d.fermeLe
  }

  /** Sa tentative à un défi entre amis, s'il l'a commencée. */
  private async tentativeDuDuel(profileId: string, code: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'duel' AND duel = ? ORDER BY commencee_le LIMIT 1`,
      args: [profileId, code],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /** Sa tentative neuve à un défi entre amis : son tirage, ses catégories ou son sujet — les hauts faits de série les lisent. */
  private async releverLeDuel(profileId: string, duel: Duel, lot: InStatement[] = []): Promise<Serie> {
    const serie: Serie = {
      id: randomUUID(),
      profileId,
      questions: duel.questions,
      index: 0,
      vies: VIES,
      justes: 0,
      finieLe: null,
      mode: 'duel',
      branche: null,
      palier: null,
      seuil: null,
      rejeu: false,
      issue: null,
      categories: duel.categories,
      sujet: duel.sujet,
      duel: duel.code,
    }
    await this.client.batch(
      [
        ...lot,
        {
          sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories, sujet, duel)
                VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'duel', ?, ?, ?)`,
          args: [serie.id, profileId, JSON.stringify(duel.questions), VIES, this.maintenant(), duel.categories ? JSON.stringify(duel.categories) : null, duel.sujet, duel.code],
        },
      ],
      'write',
    )
    this.garderEnCours(serie)
    return serie
  }

  /**
   * Lancer un défi entre amis : un tirage sur ses catégories ou son sujet,
   * marche par marche comme une série — sans « jamais vues d'abord », qui ne
   * vaut que pour lui —, figé sous un code neuf ; et sa propre tentative,
   * qui commence là. Une série en cours, elle, attend. Pas plus de
   * `DUELS_OUVERTS_MAX` ouverts à la fois.
   */
  creerUnDuel(profileId: string, categories?: readonly string[], sujet?: string): Promise<{ code: string; serie: SerieDeCampagne }> {
    return this.avecVerrou(profileId, async () => {
      const maintenant = this.maintenant()
      const ouverts = await this.client.execute({ sql: 'SELECT COUNT(*) AS n FROM campagne_duels WHERE auteur = ? AND ferme_le > ?', args: [profileId, maintenant] })
      if (Number(ouverts.rows[0]?.n ?? 0) >= DUELS_OUVERTS_MAX) throw new Error(`Tu as déjà ${DUELS_OUVERTS_MAX} défis ouverts : attends que l’un d’eux ferme`)
      const suivi = sujet === undefined ? undefined : sujetParCle(sujet)
      if (sujet !== undefined && !suivi) throw new Error('Ce sujet n’existe plus : choisis-en un autre')
      const [toutes, mesure] = await Promise.all([this.jouables(suivi ? undefined : categories), this.mesures()])
      const jouables = suivi ? toutes.filter(q => sujetsDeLaQuestion(q).includes(suivi.cle)) : toutes
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error(suivi ? 'Pas assez de questions sur ce sujet pour l’instant : choisis-en un autre' : 'Pas assez de questions pour ce défi : choisis d’autres catégories')
      }
      const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
      for (const q of melanger(jouables)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
      const questions = ordreDeSerie(parNiveau, QUESTIONS_PAR_SERIE).map(x => versQuestionDeSerie(x.question, x.niveau))
      const retenues = suivi ? null : lireCategories(categoriesRetenues(categories))
      for (let essai = 0; ; essai++) {
        const duel: Duel = {
          code: nouveauCode(),
          auteur: profileId,
          questions,
          categories: retenues,
          sujet: suivi?.cle ?? null,
          creeLe: maintenant,
          fermeLe: maintenant + DUREE_D_UN_DUEL_MS,
          closLe: null,
        }
        try {
          // Le défi et sa première tentative dans le même lot : l'un ne va pas sans l'autre.
          const serie = await this.releverLeDuel(profileId, duel, [
            {
              sql: 'INSERT INTO campagne_duels (code, auteur, questions, categories, sujet, cree_le, ferme_le) VALUES (?, ?, ?, ?, ?, ?, ?)',
              args: [duel.code, profileId, JSON.stringify(questions), retenues ? JSON.stringify(retenues) : null, duel.sujet, maintenant, duel.fermeLe],
            },
          ])
          this.duels.set(duel.code, duel)
          return { code: duel.code, serie: vueDeSerie(serie) }
        } catch (e) {
          // Un code déjà pris — une chance sur des centaines de millions — : on en tire un autre, une fois.
          if (essai > 0 || !String((e as Error).message).includes('UNIQUE')) throw e
        }
      }
    })
  }

  /**
   * Relever un défi entre amis : une seule tentative. Laissée en route, elle
   * se reprend ; finie, le défi attend les autres. Fermé, il ne se joue plus.
   */
  releverUnDuel(profileId: string, brut: unknown): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const duel = await this.duelDe(lireCodeDuDuel(brut))
      if (!duel) throw new Error('Ce défi est introuvable : vérifie son lien')
      if (this.maintenant() >= duel.fermeLe) throw new Error('Ce défi est fermé : son classement est figé')
      const deja = await this.tentativeDuDuel(profileId, duel.code)
      if (deja?.finieLe != null) throw new Error('Tu as relevé ce défi : son classement t’attend')
      if (deja) {
        this.garderEnCours(deja)
        return vueDeSerie(deja)
      }
      return vueDeSerie(await this.releverLeDuel(profileId, duel))
    })
  }

  /**
   * Fermé, un défi fige une fois ce qui restait en route : la correction de
   * chacun s'ouvre, et la page ne dit plus « en cours ».
   */
  private async fermerLeDuel(duel: Duel): Promise<void> {
    if (duel.closLe !== null || this.maintenant() < duel.fermeLe) return
    await this.client.batch(
      [
        { sql: `UPDATE campagne_series SET finie_le = ? WHERE mode = 'duel' AND duel = ? AND finie_le IS NULL`, args: [duel.fermeLe, duel.code] },
        { sql: 'UPDATE campagne_duels SET clos_le = ? WHERE code = ? AND clos_le IS NULL', args: [this.maintenant(), duel.code] },
      ],
      'write',
    )
    duel.closLe = this.maintenant()
    for (const s of [...this.enCours.values()]) if (s.mode === 'duel' && s.duel === duel.code) this.enCours.delete(s.profileId)
  }

  /** La page d'un défi entre amis : qui l'a lancé, ce qu'il fait jouer, le temps qui reste, sa tentative et le classement. */
  async duel(profileId: string, brut: unknown): Promise<DuelEntreAmis> {
    const duel = await this.duelDe(lireCodeDuDuel(brut))
    if (!duel) throw new Error('Ce défi est introuvable : vérifie son lien')
    await this.fermerLeDuel(duel)
    const ouvert = this.maintenant() < duel.fermeLe
    const [tentative, classement, auteur] = await Promise.all([
      this.tentativeDuDuel(profileId, duel.code),
      this.classementDesTentatives({ mode: 'duel', code: duel.code }, ouvert, profileId),
      this.profils ? this.profils.byIds([duel.auteur]).then(p => p[0] ?? null) : Promise.resolve(null),
    ])
    // Masqué au quiz du jour, l'auteur ne se nomme pas plus ici, sauf à lui-même.
    const nomme = auteur && (!this.masque?.(auteur.id) || auteur.id === profileId)
    return {
      code: duel.code,
      auteur: {
        nom: nomme ? auteur.name : 'Un joueur',
        avatar: nomme && this.profils ? this.profils.avatarPorte(auteur) : '🎲',
        ...(duel.auteur === profileId && { toi: true as const }),
      },
      ...(duel.sujet && { sujet: duel.sujet }),
      ...(duel.categories && duel.categories.length > 0 && { categories: duel.categories }),
      minutesRestantes: ouvert ? Math.max(1, Math.ceil((duel.fermeLe - this.maintenant()) / 60_000)) : 0,
      tentative: tentative ? vueDeSerie(tentative) : null,
      ...classement,
    }
  }

  /** Sa place à un défi entre amis, s'il y a répondu : ce que la fin de sa tentative lui dit. */
  private async placeAuDuel(code: string, profileId: string): Promise<{ rang: number; joueurs: number } | null> {
    const c = await this.classementDesTentatives({ mode: 'duel', code }, true, profileId)
    const sienne = c.moi ?? c.lignes.find(l => l.profileId === profileId)
    return sienne ? { rang: sienne.rang, joueurs: c.joueurs } : null
  }

  /**
   * Ses défis entre amis — lancés ou relevés — des trente derniers jours, les
   * plus récents d'abord : un lien perdu ne perd pas le défi. Leurs scores
   * d'un seul aller-retour, classés comme leur page les classe.
   */
  async mesDuels(profileId: string): Promise<ResumeDuDuel[]> {
    const depuis = this.maintenant() - 30 * 24 * HEURE_MS
    const res = await this.client.execute({
      sql: `SELECT code FROM campagne_duels
            WHERE ferme_le > ? AND (auteur = ? OR code IN (SELECT duel FROM campagne_series WHERE profile_id = ? AND mode = 'duel'))
            ORDER BY cree_le DESC LIMIT ?`,
      args: [depuis, profileId, profileId, DUELS_MONTRES],
    })
    const duels = (await Promise.all(res.rows.map(r => this.duelDe(String(r.code))))).filter((d): d is Duel => d !== null)
    if (duels.length === 0) return []
    const tentatives = await this.client.execute({
      sql: `SELECT duel, profile_id, justes FROM campagne_series WHERE mode = 'duel' AND position > 0 AND duel IN (${duels.map(() => '?').join(', ')})`,
      args: duels.map(d => d.code),
    })
    const auteurs = this.profils ? await this.profils.byIds(duels.map(d => d.auteur)) : []
    return duels.map((d, i) => {
      const joueurs = tentatives.rows
        .filter(r => String(r.duel) === d.code)
        .map(r => ({ id: String(r.profile_id), justes: Number(r.justes) }))
        .filter(j => !this.masque?.(j.id) || j.id === profileId)
      const sienne = classer(joueurs, j => j.justes, j => j.id, j => j.id).find(c => c.item.id === profileId)
      const auteur = auteurs[i]
      return {
        code: d.code,
        auteur: d.auteur === profileId ? 'toi' : auteur && !this.masque?.(auteur.id) ? auteur.name : 'Un joueur',
        ...(d.sujet && { sujet: d.sujet }),
        ...(d.categories && d.categories.length > 0 && { categories: d.categories }),
        joueurs: joueurs.length,
        justes: sienne ? sienne.item.justes : null,
        rang: sienne ? sienne.rang : null,
        minutesRestantes: Math.max(0, Math.ceil((d.fermeLe - this.maintenant()) / 60_000)),
      }
    })
  }

  // ── Affronter un inconnu ────────────────────────────────────────────────
  //
  // Un adversaire tout de suite (`shared/campagne.ts`) : la série finie d'un
  // autre joueur, de son niveau, rejouée — ses questions, dans le même
  // ordre, contre son score. Une série d'un autre mode (`mode = 'rencontre'`)
  // qui garde son adversaire (`AdversaireGarde`) : l'expérience, les
  // confettis et les hauts faits de série la comptent, le record des séries
  // non. Ni classement, ni laurier, ni Éclat.

  /** Sa rencontre laissée en route, s'il en a une : elle se reprend. */
  private async rencontreEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    })
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /** Qui l'on affronte, tel que la page le montre : un profil masqué ou parti ne se nomme pas. */
  private async adversaireVu(a: AdversaireGarde): Promise<Adversaire> {
    const p = this.profils ? ((await this.profils.byIds([a.profil]))[0] ?? null) : null
    const nomme = p && !this.masque?.(p.id)
    return { nom: nomme ? p.name : 'Un joueur', avatar: nomme && this.profils ? this.profils.avatarPorte(p) : '🎲', justes: a.reponses.filter(Boolean).length }
  }

  /**
   * Affronter un inconnu : celle qu'il a laissée en route reprend ; sinon,
   * parmi les séries finies des trois derniers mois — d'autres joueurs, pas
   * masqués, jamais deux fois la même —, celle de son niveau dont il a vu le
   * moins de questions (`choisirUnAdversaire`). Seules les séries allées au
   * bout de leurs vies comptent : une série abandonnée sous-estime qui l'a
   * jouée. Une série en cours, elle, attend.
   */
  commencerUneRencontre(profileId: string): Promise<RencontreDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const ouverte = await this.rencontreEnCours(profileId)
      if (ouverte?.adversaire) {
        this.garderEnCours(ouverte)
        return { serie: vueDeSerie(ouverte), adversaire: await this.adversaireVu(ouverte.adversaire), sesJustes: sesJustesAvant(ouverte) }
      }
      const maintenant = this.maintenant()
      const [miennes, deja, candidats, vues] = await Promise.all([
        this.client.execute({
          sql: `SELECT justes FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND position > 0 AND ${SERIES} ORDER BY finie_le DESC LIMIT ?`,
          args: [profileId, SERIES_POUR_LE_NIVEAU],
        }),
        this.client.execute({ sql: `SELECT json_extract(adversaire, '$.serie') AS serie FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre'`, args: [profileId] }),
        this.client.execute({
          sql: `SELECT id, profile_id, justes, finie_le FROM campagne_series
                WHERE ${SERIES} AND finie_le IS NOT NULL AND vies = 0 AND position > 0 AND profile_id <> ? AND finie_le > ?
                ORDER BY finie_le DESC LIMIT ?`,
          args: [profileId, maintenant - RENCONTRE_SUR_MS, CANDIDATS_A_UNE_RENCONTRE],
        }),
        this.vuesPar(profileId),
      ])
      const niveau = niveauPourUneRencontre(miennes.rows.map(r => Number(r.justes)))
      const dejaAffrontees = new Set(deja.rows.map(r => String(r.serie)))
      // Les plus proches de son niveau, battus d'abord : à écart égal, ni l'ordre de la base ni l'heure ne décide.
      const proches = melanger(candidats.rows.filter(r => !dejaAffrontees.has(String(r.id)) && !this.masque?.(String(r.profile_id))))
        .sort((a, b) => Math.floor(Math.abs(Number(a.justes) - niveau) / 2) - Math.floor(Math.abs(Number(b.justes) - niveau) / 2))
        .slice(0, ADVERSAIRES_REGARDES)
      if (proches.length === 0) throw new Error('Personne à affronter pour l’instant : d’autres joueurs doivent d’abord finir des séries')
      // Ce qu'il a déjà vu de leurs questions jouées, et des trois d'après : lues dans la base, sans charger leurs séries entières.
      const ids = proches.map(r => String(r.id))
      const premieres = await this.client.execute({
        sql: `SELECT s.id AS serie, COALESCE(json_extract(j.value, '$.id'), json_extract(j.value, '$.reserveId')) AS question
              FROM campagne_series s, json_each(s.questions) j
              WHERE s.id IN (${ids.map(() => '?').join(', ')}) AND CAST(j.key AS INTEGER) < s.position + 3`,
        args: ids,
      })
      const vuesParSerie = new Map<string, number>()
      for (const r of premieres.rows) if (vues.has(String(r.question))) vuesParSerie.set(String(r.serie), (vuesParSerie.get(String(r.serie)) ?? 0) + 1)
      const choisi = choisirUnAdversaire(
        proches.map(r => ({ serie: String(r.id), profil: String(r.profile_id), justes: Number(r.justes), finieLe: Number(r.finie_le), dejaVues: vuesParSerie.get(String(r.id)) ?? 0 })),
        niveau,
      )!
      const [ligne, reponses] = await this.client.batch(
        [
          { sql: 'SELECT * FROM campagne_series WHERE id = ?', args: [choisi.serie] },
          { sql: 'SELECT juste FROM campagne_reponses WHERE serie_id = ? ORDER BY position', args: [choisi.serie] },
        ],
        'read',
      )
      if (!ligne.rows[0]) throw new Error('Cet adversaire vient de partir : cherches-en un autre')
      const sienne = versSerie(ligne.rows[0])
      const adversaire: AdversaireGarde = { serie: sienne.id, profil: sienne.profileId, reponses: reponses.rows.map(r => Number(r.juste) === 1) }
      const serie: Serie = {
        id: randomUUID(),
        profileId,
        questions: sienne.questions,
        index: 0,
        vies: VIES,
        justes: 0,
        finieLe: null,
        mode: 'rencontre',
        branche: null,
        palier: null,
        seuil: null,
        rejeu: false,
        issue: null,
        categories: sienne.categories ?? null,
        sujet: sienne.sujet ?? null,
        adversaire,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories, sujet, adversaire)
              VALUES (?, ?, ?, 0, ?, 0, ?, NULL, 'rencontre', ?, ?, ?)`,
        args: [serie.id, profileId, JSON.stringify(serie.questions), VIES, maintenant, serie.categories ? JSON.stringify(serie.categories) : null, serie.sujet ?? null, JSON.stringify(adversaire)],
      })
      this.garderEnCours(serie)
      return { serie: vueDeSerie(serie), adversaire: await this.adversaireVu(adversaire), sesJustes: 0 }
    })
  }

  /** Ses rencontres : celle laissée en route, et les dernières jouées, leur issue — leurs adversaires lus d'un coup. */
  async mesRencontres(profileId: string): Promise<MesRencontres> {
    const res = await this.client.execute({
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' ORDER BY commencee_le DESC LIMIT ?`,
      args: [profileId, RENCONTRES_MONTREES + 1],
    })
    const rencontres = res.rows.map(versSerie).filter(s => s.adversaire)
    const profils = this.profils ? await this.profils.byIds(rencontres.map(s => s.adversaire!.profil)) : []
    const vu = (s: Serie, i: number): Adversaire => {
      const p = profils[i]
      const nomme = p && !this.masque?.(p.id)
      return { nom: nomme ? p.name : 'Un joueur', avatar: nomme && this.profils ? this.profils.avatarPorte(p) : '🎲', justes: s.adversaire!.reponses.filter(Boolean).length }
    }
    const i = rencontres.findIndex(s => s.finieLe === null)
    return {
      enCours: i >= 0 ? { serie: vueDeSerie(rencontres[i]), adversaire: vu(rencontres[i], i), sesJustes: sesJustesAvant(rencontres[i]) } : null,
      passees: rencontres
        .map((s, j) => ({ s, j }))
        .filter(({ s }) => s.finieLe !== null)
        .slice(0, RENCONTRES_MONTREES)
        .map(({ s, j }): ResumeDeRencontre => {
          const adversaire = vu(s, j)
          return { serie: s.id, adversaire, justes: s.justes, issue: issueDeRencontre(s.justes, adversaire.justes), le: s.finieLe! }
        }),
    }
  }

  /**
   * Les vainqueurs du défi de la semaine passée : le laurier d'argent suit
   * leur prénom toute la semaine. Lus en mémoire, sans attendre — chaque
   * diffusion à toute la salle les demande. Le lundi, ceux d'avant se taisent
   * aussitôt, et la semaine se clôt en arrière-plan si personne n'a encore
   * ouvert le défi.
   */
  vainqueursDuDefi(): ReadonlySet<string> {
    const { passee } = this.semaineDeLHeure()
    if (this.argent.semaine === passee) return this.argent.ids
    if (!this.argentEnRoute && !this.ferme) {
      this.argentEnRoute = this.cloreLesDefis()
        .catch(e => {
          if (!this.ferme) console.error('[campagne] le défi de la semaine passée n’a pas pu se clore :', e)
        })
        .finally(() => {
          this.argentEnRoute = null
        })
    }
    return AUCUN_VAINQUEUR
  }

  // ── Les sentiers du savoir ──────────────────────────────────────────────
  //
  // Le second mode de la campagne (`shared/sentiers.ts`) : douze paliers par
  // branche, une épreuve de seize questions par palier, des vies du jour.
  // Une épreuve est une série d'un autre mode, dans les mêmes tables ; les
  // paliers validés, les étoiles et les vies se lisent dans ce journal à
  // chaque fois — rien ne se tient à côté qu'un hoquet de la base fausserait.

  /** Ses vies achetées (`ProfileStore.viesAcheteesDe`), branchées au démarrage : les confettis sont chez le profil, les vies ici. */
  viesAchetees?: (profileId: string) => Promise<number>
  /** Les vies achetées depuis un instant, tous profils : l'administration le dit. */
  viesAcheteesDepuis?: (depuis: number) => Promise<number>

  /** Ce qu'il tenait d'avant les sentiers, et ses épreuves validées : les deux lectures de ses sentiers. */
  private lecturesDesSentiers(profileId: string): InStatement[] {
    return [
      { sql: 'SELECT branche, paliers FROM sentier_acquis WHERE profile_id = ?', args: [profileId] },
      {
        sql: `SELECT branche, palier, justes, seuil FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND issue = 'validee'`,
        args: [profileId],
      },
    ]
  }

  /**
   * Les paliers validés de chaque sentier commencé : ceux d'avant les
   * sentiers, et ses épreuves validées — ce qui ouvre ses portraits. Un
   * sentier pas encore commencé n'y paraît pas.
   */
  async paliersDe(profileId: string): Promise<Paliers> {
    const [acquis, validees] = await this.client.batch(this.lecturesDesSentiers(profileId), 'read')
    return Object.fromEntries(sentiersLus(acquis.rows, validees.rows).filter(s => s.paliers > 0).map(s => [s.branche, s.paliers]))
  }

  /** Ses épreuves ratées, chacune au jour où elle l'a été : ce qui a coûté ses vies. */
  private lectureDesEchecs(profileId: string): InStatement {
    return {
      sql: `SELECT finie_le FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND rejeu = 0 AND issue = 'ratee' AND finie_le IS NOT NULL`,
      args: [profileId],
    }
  }

  /** L'épreuve qu'il a laissée en cours, s'il en a une : une seule à la fois. */
  private lectureDeLEpreuveOuverte(profileId: string): InStatement {
    return {
      sql: `SELECT * FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1`,
      args: [profileId],
    }
  }

  /** Ses vies : celles du jour, et sa réserve (`viesDe`), relues dans le journal de ses épreuves ratées. */
  private viesLues(echecs: readonly Record<string, unknown>[], achetees: number): VieDesSentiers {
    const maintenant = this.maintenant()
    const parJour = new Map<string, number>()
    for (const r of echecs) {
      const jour = jourDe(Number(r.finie_le))
      parJour.set(jour, (parJour.get(jour) ?? 0) + 1)
    }
    const { jour, reserve } = viesDe(parJour, achetees, jourDe(maintenant))
    return { jour, reserve, parJour: VIES_PAR_JOUR, prix: PRIX_D_UNE_VIE, renouveleesLe: maintenant + minutesAvantMinuit(maintenant) * 60_000 }
  }

  private async vies(profileId: string): Promise<VieDesSentiers> {
    const [echecs, achetees] = await Promise.all([this.client.execute(this.lectureDesEchecs(profileId)), this.viesAchetees?.(profileId) ?? 0])
    return this.viesLues(echecs.rows, achetees)
  }

  private async epreuveEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute(this.lectureDeLEpreuveOuverte(profileId))
    return res.rows[0] ? versSerie(res.rows[0]) : null
  }

  /**
   * Tout ce que ses sentiers disent de lui — ses paliers, ses vies, l'épreuve
   * laissée — en un lot, à côté de ses vies achetées, qui sont chez le
   * profil : deux allers-retours de front, l'accueil les attend.
   */
  private async lireLesSentiers(profileId: string): Promise<{ sentiers: SentierDuJoueur[]; vies: VieDesSentiers; ouverte: Serie | null }> {
    const [[acquis, validees, echecs, ouverte], achetees] = await Promise.all([
      this.client.batch([...this.lecturesDesSentiers(profileId), this.lectureDesEchecs(profileId), this.lectureDeLEpreuveOuverte(profileId)], 'read'),
      this.viesAchetees?.(profileId) ?? 0,
    ])
    return {
      sentiers: sentiersLus(acquis.rows, validees.rows),
      vies: this.viesLues(echecs.rows, achetees),
      ouverte: ouverte.rows[0] ? versSerie(ouverte.rows[0]) : null,
    }
  }

  /** La page des sentiers : ses vies, chaque sentier — ses paliers, ses étoiles —, et l'épreuve qu'il a laissée. */
  async etatDesSentiers(profileId: string): Promise<EtatDesSentiers> {
    const { sentiers, vies, ouverte } = await this.lireLesSentiers(profileId)
    return { vies, sentiers, epreuve: ouverte ? vueDEpreuve(ouverte) : null }
  }

  /**
   * Ce que le bouton de la campagne dit sur l'accueil : ses vies, et le
   * sentier qu'il avance (`sentierQuOnAvance`) — rien tant qu'il n'en a
   * commencé aucun, ni épreuve ni portrait d'avant.
   */
  async accueilDesSentiers(profileId: string): Promise<SentiersDAccueil> {
    const { sentiers, vies, ouverte } = await this.lireLesSentiers(profileId)
    const laissee = ouverte?.branche && ouverte.palier ? { branche: ouverte.branche, palier: ouverte.palier } : null
    return { vies: vies.jour + vies.reserve, avance: sentierQuOnAvance(sentiers, laissee) }
  }

  /**
   * Une épreuve : le palier qui suit le dernier validé, ou un palier déjà
   * validé, rejoué sans risque. Celle qu'il avait laissée sur ce palier
   * reprend telle quelle ; une autre laissée sans rien risquer — un rejeu,
   * ou déjà validée — se referme d'elle-même ; une autre encore en jeu
   * l'attend : il la finit, ou l'abandonne (`abandonnerEpreuve`). Il faut une
   * vie pour risquer un palier, aucune pour en rejouer un.
   */
  commencerEpreuve(profileId: string, cle: unknown, n: unknown): Promise<EpreuveDeSentier> {
    return this.avecVerrou(profileId, async () => {
      const b = brancheParCle(cle)
      if (!b) throw new Error('Ce sentier n’existe pas')
      const regle = regleDuPalier(n)
      if (!regle) throw new Error('Ce palier n’existe pas')
      const [paliers, ouverte] = await Promise.all([this.paliersDe(profileId), this.epreuveEnCours(profileId)])
      if (ouverte) {
        if (ouverte.branche === b.key && ouverte.palier === regle.n) {
          this.garderEnCours(ouverte)
          return vueDEpreuve(ouverte)
        }
        const autre = brancheParCle(ouverte.branche)
        if (!ouverte.rejeu && ouverte.issue !== 'validee') {
          throw new Error(`Une épreuve t’attend : le palier ${ouverte.palier}${autre ? ` du sentier ${deLaBranche(autre)}` : ''}. Finis-la, ou abandonne-la.`)
        }
        await this.client.execute({ sql: 'UPDATE campagne_series SET finie_le = ? WHERE id = ?', args: [this.maintenant(), ouverte.id] })
        this.enCours.delete(profileId)
      }
      const valides = paliers[b.key] ?? 0
      if (regle.n > valides + 1) throw new Error(`Valide d’abord le palier ${valides + 1}`)
      const rejeu = regle.n <= valides
      if (!rejeu) {
        const vies = await this.vies(profileId)
        if (vies.jour + vies.reserve <= 0) throw new Error('Plus de vies pour aujourd’hui : elles reviennent à minuit, ou rachètes-en en confettis')
      }
      const [jouables, mesure, vues] = await Promise.all([this.jouables([b.categorie]), this.mesures(), this.vuesPar(profileId)])
      // Les huit premiers paliers posent le thème de leur chapitre (`shared/chapitres.ts`).
      const chapitre = chapitreDuPalier(b.key, regle.n)?.sousThemes ?? []
      const questions = tirerUneEpreuve(jouables, regle, vues, mesure, this.maintenant(), chapitre).map(x => versQuestionDeSerie(x.question, x.niveau))
      const e: Serie = {
        id: randomUUID(),
        profileId,
        questions,
        index: 0,
        vies: 0,
        justes: 0,
        finieLe: null,
        mode: 'sentier',
        branche: b.key,
        palier: regle.n,
        seuil: regle.seuil,
        rejeu,
        issue: null,
      }
      await this.client.execute({
        sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, branche, palier, seuil, rejeu, issue)
              VALUES (?, ?, ?, 0, 0, 0, ?, NULL, 'sentier', ?, ?, ?, ?, NULL)`,
        args: [e.id, profileId, JSON.stringify(questions), this.maintenant(), b.key, regle.n, regle.seuil, rejeu ? 1 : 0],
      })
      this.garderEnCours(e)
      return vueDEpreuve(e)
    })
  }

  /**
   * Une réponse d'épreuve : juste ou non, la bonne et l'anecdote, comme dans
   * la série, et la suite. Validée dès le seuil atteint — c'est écrit tout
   * de suite : une épreuve laissée là compte quand même —, elle continue
   * jusqu'à la seizième question, pour les étoiles ; ratée dès que les
   * erreurs dépassent ce que le seuil permet, elle s'arrête, et le journal
   * compte la vie perdue. Une bonne réponse paie comme dans la série : un
   * confetti, l'expérience d'une bonne réponse.
   */
  repondreEpreuve(profileId: string, id: string, index: number, choix: unknown): Promise<ReponseDEpreuve> {
    return this.avecVerrou(profileId, async () => {
      const gardee = this.enCours.get(profileId)
      const e = gardee?.id === id ? gardee : await this.serie(profileId, id)
      // Le voisin n'en sait pas plus (invariant 3) : l'épreuve d'un autre est introuvable.
      if (!e || e.mode !== 'sentier' || !e.branche || !e.palier) throw new Error('Cette épreuve est introuvable')
      if (e.finieLe !== null) throw new Error('Cette épreuve est finie')
      if (index !== e.index) throw new Error('Cette question est passée : l’épreuve a continué sans elle')
      const q = e.questions[e.index]
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      const justes = e.justes + (juste ? 1 : 0)
      const position = e.index + 1
      const seuil = e.seuil ?? regleDuPalier(e.palier)?.seuil ?? QUESTIONS_PAR_EPREUVE
      // Validée, elle le reste : les erreurs d'après ne la défont pas.
      const issue = e.issue ?? issueDe(justes, position, seuil)
      const finie = position >= e.questions.length || epreuveFinie(justes, position, seuil)
      const maintenant = this.maintenant()
      const lot: InStatement[] = [
        {
          sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)',
          args: [e.id, e.index, q.id, c, juste ? 1 : 0, maintenant],
        },
        {
          sql: 'UPDATE campagne_series SET position = ?, justes = ?, issue = ?, finie_le = ? WHERE id = ?',
          args: [position, justes, issue, finie ? maintenant : null, e.id],
        },
      ]
      // Finie et validée : ses épreuves validées d'avant sur ce palier — sa
      // meilleure note, pour dire un record et ce que paient ses étoiles, et
      // combien de fois il l'avait déjà validé : à la première, le palier paie
      // (`xpDuPalier`).
      const valideeIci = e.issue === null && issue === 'validee'
      if ((finie && issue === 'validee') || valideeIci) {
        lot.unshift({
          sql: `SELECT justes, seuil FROM campagne_series
                WHERE profile_id = ? AND mode = 'sentier' AND branche = ? AND palier = ? AND issue = 'validee' AND id <> ?`,
          args: [profileId, e.branche, e.palier, e.id],
        })
      }
      if (juste) lot.push(...lecturesDeLExperience(profileId))
      let res: ResultSet[]
      try {
        res = await this.client.batch(lot, 'write')
      } catch (err) {
        this.enCours.delete(profileId)
        throw err
      }
      const apres: Serie = { ...e, index: position, justes, issue, finieLe: finie ? maintenant : null }
      if (finie) this.enCours.delete(profileId)
      else this.garderEnCours(apres)
      const xp = juste ? await this.crediter(profileId, res.slice(-2)) : 0
      const reponse: ReponseDEpreuve = { juste, bonne: q.bonne, anecdote: q.anecdote, xp, epreuve: vueDEpreuve(apres) }
      // Validé pour la première fois : sa ligne, que la bonne réponse vient
      // de réécrire, le compte déjà ; la réponse le dit.
      const dAvant = valideeIci || (finie && issue === 'validee') ? res[0].rows : []
      if (valideeIci && xp > 0 && dAvant.length === 0) reponse.xpPalier = xpDuPalier(e.palier)
      if (finie && issue === 'validee') {
        const avant = Math.max(0, ...dAvant.map(r => Number(r.justes)))
        const etoilesAvant = Math.max(0, ...dAvant.map(r => etoilesDe(Number(r.justes), Number(r.seuil ?? seuil))))
        reponse.etoiles = etoilesDe(justes, seuil)
        if (avant > 0 && justes > avant) reponse.record = true
        const confettis = confettisDeLaNouvelleNote(etoilesAvant, reponse.etoiles)
        if (confettis > 0) reponse.confettisDesEtoiles = confettis
        // Le palier vient d'être conquis (pas rejoué) : ce qu'il ouvre.
        if (!e.rejeu) {
          const regle = regleDuPalier(e.palier)
          const b = brancheParCle(e.branche)!
          if (regle?.avatar !== null && regle?.avatar !== undefined) reponse.avatar = b.portraits[regle.avatar].key
          if (regle?.maitre) reponse.maitre = titreDeMaitre(b)
        }
      }
      if (issue === 'ratee' && !e.rejeu) reponse.vies = await this.vies(profileId)
      // Ses bonnes réponses comptent pour Le Marathonien et L'Érudit, comme celles d'une série.
      if (finie) Object.assign(reponse, await this.recompenser(profileId, e.id, [], this.maintenant()))
      return reponse
    })
  }

  /**
   * Abandonner une épreuve : un palier en jeu compte comme raté — une vie de
   * moins, sinon on fermerait l'application à la dixième erreur pour ne rien
   * perdre ; un rejeu, ou une épreuve déjà validée, se referme sans rien
   * coûter. Rend les vies qui restent.
   */
  abandonnerEpreuve(profileId: string, id: string): Promise<VieDesSentiers> {
    return this.avecVerrou(profileId, async () => {
      const e = await this.serie(profileId, id)
      if (!e || e.mode !== 'sentier') throw new Error('Cette épreuve est introuvable')
      if (e.finieLe === null) {
        const issue = e.issue ?? (e.rejeu ? null : 'ratee')
        await this.client.execute({ sql: 'UPDATE campagne_series SET issue = ?, finie_le = ? WHERE id = ?', args: [issue, this.maintenant(), e.id] })
      }
      this.enCours.delete(profileId)
      return this.vies(profileId)
    })
  }

  /**
   * Les paliers que chacun tenait de ses portraits d'avant les sentiers
   * (`core/repriseDesPortraits.ts`) : écrits une fois, en lots ; un acquis
   * déjà là garde le plus haut des deux.
   */
  async retenirAcquis(lignes: readonly { profileId: string; branche: CleDeBranche; paliers: number }[]): Promise<void> {
    const maintenant = this.maintenant()
    for (let i = 0; i < lignes.length; i += 200) {
      await this.client.batch(
        lignes.slice(i, i + 200).map(l => ({
          sql: `INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)
                ON CONFLICT(profile_id, branche) DO UPDATE SET paliers = MAX(paliers, excluded.paliers)`,
          args: [l.profileId, l.branche, l.paliers, maintenant],
        })),
        'write',
      )
    }
  }

  /**
   * Les sentiers, côté administrateur, toutes branches ou une seule. Palier
   * par palier, ce que les vraies épreuves des trois derniers mois disent :
   * qui l'a tenté, qui l'a validé et en combien d'essais, qui y reste bloqué
   * et ce qu'il y a laissé, la chance d'un essai à chaque seuil, la part de
   * bonnes réponses. Les bonnes réponses par marche de question, que le
   * calibrage suppose. Et où chacun en est aujourd'hui : ceux qui attendent
   * un palier sans l'avoir tenté, les plus bloqués. De quoi régler un seuil
   * ou un mélange sur des faits. Les rejeux se comptent à part : ils ne
   * risquent rien, et ne disent rien d'un premier essai.
   */
  async adminDesSentiers(cle: unknown): Promise<AdminDesSentiers> {
    const b = brancheParCle(cle) ?? null
    const maintenant = this.maintenant()
    const semaine = maintenant - 7 * 24 * HEURE_MS
    const depuis = maintenant - STATS_DES_SENTIERS_MS
    const filtre = b ? ' AND branche = ?' : ''
    const avec = (...args: number[]) => (b ? [...args, b.key] : args)
    const [[lignes, recentes, parNiveau, resumes, acquis], achetees] = await Promise.all([
      this.client.batch(
        [
          {
            sql: `SELECT profile_id, branche, palier, issue, rejeu, seuil, position, justes FROM campagne_series
                  WHERE mode = 'sentier' AND issue IS NOT NULL AND commencee_le > ?${filtre}
                  ORDER BY commencee_le`,
            args: avec(depuis),
          },
          {
            sql: `SELECT COUNT(*) AS n, COUNT(DISTINCT profile_id) AS joueurs,
                         SUM(CASE WHEN rejeu = 0 AND issue = 'ratee' THEN 1 ELSE 0 END) AS perdues,
                         SUM(CASE WHEN rejeu = 0 AND issue = 'validee' THEN 1 ELSE 0 END) AS validees
                  FROM campagne_series WHERE mode = 'sentier' AND commencee_le > ?${filtre}`,
            args: avec(semaine),
          },
          // Chaque réponse retrouve la marche de sa question dans l'épreuve
          // qui la gardait : le JSON de l'épreuve se lit une fois pour ses
          // seize réponses (`CROSS JOIN` garde cet ordre-là).
          {
            sql: `SELECT json_extract(q.value, '$.niveau') AS niveau, COUNT(*) AS n, SUM(r.juste) AS justes
                  FROM campagne_series s CROSS JOIN json_each(s.questions) q
                  JOIN campagne_reponses r ON r.serie_id = s.id AND r.position = q.key
                  WHERE s.mode = 'sentier' AND s.rejeu = 0 AND s.commencee_le > ?${b ? ' AND s.branche = ?' : ''}
                  GROUP BY niveau`,
            args: avec(depuis),
          },
          // Où chacun en est, sur toutes ses épreuves : un résumé par joueur, sentier et palier.
          {
            sql: `SELECT profile_id, branche, palier, rejeu, issue, COUNT(*) AS n, MAX(commencee_le) AS dernier
                  FROM campagne_series WHERE mode = 'sentier'${filtre}
                  GROUP BY profile_id, branche, palier, rejeu, issue`,
            args: avec(),
          },
          { sql: `SELECT profile_id, branche, paliers FROM sentier_acquis${b ? ' WHERE branche = ?' : ''}`, args: avec() },
        ],
        'read',
      ),
      this.viesAcheteesDepuis?.(semaine) ?? 0,
    ])

    // Les essais de chacun sur chaque palier, dans l'ordre : le premier dit « du premier coup ».
    const essais = new Map<string, { issue: IssueDEpreuve; seuil: number; abandon: boolean; questions: number; justes: number }[]>()
    const rejeux = new Map<number, { joues: number; valides: number }>()
    for (const r of lignes.rows) {
      const palier = Number(r.palier)
      const issue: IssueDEpreuve = r.issue === 'validee' ? 'validee' : 'ratee'
      if (Number(r.rejeu ?? 0) === 1) {
        const c = rejeux.get(palier) ?? { joues: 0, valides: 0 }
        c.joues++
        if (issue === 'validee') c.valides++
        rejeux.set(palier, c)
        continue
      }
      const seuil = Number(r.seuil ?? regleDuPalier(palier)?.seuil ?? QUESTIONS_PAR_EPREUVE)
      const questions = Number(r.position ?? 0)
      const justes = Number(r.justes ?? 0)
      const k = `${palier}|${r.profile_id}|${r.branche}`
      const liste = essais.get(k) ?? []
      // Ratée sans la faute de trop : quittée en route (`abandonnerEpreuve`).
      liste.push({ issue, seuil, abandon: issue === 'ratee' && questions - justes <= QUESTIONS_PAR_EPREUVE - seuil, questions, justes })
      essais.set(k, liste)
    }

    // Où chacun en est aujourd'hui : le plus haut palier validé de chaque
    // sentier commencé — ses épreuves, et ce que la reprise lui a retenu
    // (`sentier_acquis`). Un sentier repris des portraits d'avant, jamais
    // joué, n'est pas en route : il ne compte pas.
    const enRoute = new Map<string, { haut: number; tentes: Set<number>; echecs: Map<number, { n: number; dernier: number }> }>()
    for (const r of resumes.rows) {
      const k = `${r.profile_id}|${r.branche}`
      const p = enRoute.get(k) ?? { haut: 0, tentes: new Set<number>(), echecs: new Map() }
      enRoute.set(k, p)
      const palier = Number(r.palier)
      if (r.issue === 'validee') p.haut = Math.max(p.haut, palier)
      if (Number(r.rejeu ?? 0) === 0) {
        p.tentes.add(palier)
        if (r.issue === 'ratee') p.echecs.set(palier, { n: Number(r.n), dernier: Number(r.dernier) })
      }
    }
    for (const r of acquis.rows) {
      const p = enRoute.get(`${r.profile_id}|${r.branche}`)
      if (p) p.haut = Math.max(p.haut, Number(r.paliers))
    }
    const enAttente = new Map<number, number>()
    const bloques: JoueurBloque[] = []
    for (const [k, p] of enRoute) {
      const suivant = p.haut + 1
      if (suivant > PALIER_DU_MAITRE) continue
      if (!p.tentes.has(suivant)) {
        enAttente.set(suivant, (enAttente.get(suivant) ?? 0) + 1)
        continue
      }
      const echecs = p.echecs.get(suivant)
      if (echecs && echecs.n >= 2 && suivant < PALIER_DU_MAITRE) {
        const [profileId, branche] = k.split('|')
        bloques.push({ profileId, branche: branche as CleDeBranche, palier: suivant, echecs: echecs.n, dernier: echecs.dernier })
      }
    }
    bloques.sort((x, y) => y.echecs - x.echecs || y.dernier - x.dernier)

    const paliers: StatsDuPalier[] = PALIERS.map(regle => {
      const groupes = [...essais].filter(([k]) => k.startsWith(`${regle.n}|`)).map(([, liste]) => liste)
      const tous = groupes.flat()
      const valide = (g: (typeof tous)[number][]) => g.some(e => e.issue === 'validee')
      const parSeuil = new Map<number, { essais: number; validees: number }>()
      for (const e of tous) {
        const c = parSeuil.get(e.seuil) ?? { essais: 0, validees: 0 }
        c.essais++
        if (e.issue === 'validee') c.validees++
        parSeuil.set(e.seuil, c)
      }
      return {
        palier: regle.n,
        joueurs: groupes.length,
        valides: groupes.filter(valide).length,
        premierCoup: groupes.filter(g => g[0].issue === 'validee').length,
        essais: tous.length,
        echecsDesBloques: groupes.filter(g => !valide(g)).reduce((n, g) => n + g.length, 0),
        abandons: tous.filter(e => e.abandon).length,
        questions: tous.reduce((n, e) => n + e.questions, 0),
        justes: tous.reduce((n, e) => n + e.justes, 0),
        seuils: [...parSeuil].sort(([x], [y]) => y - x).map(([seuil, c]) => ({ seuil, ...c })),
        enAttente: enAttente.get(regle.n) ?? 0,
        rejeux: rejeux.get(regle.n)?.joues ?? 0,
        rejeuxValides: rejeux.get(regle.n)?.valides ?? 0,
      }
    })
    const semaineLue = recentes.rows[0]
    return {
      semaine: {
        joueurs: Number(semaineLue?.joueurs ?? 0),
        epreuves: Number(semaineLue?.n ?? 0),
        viesAchetees: achetees,
        viesPerdues: Number(semaineLue?.perdues ?? 0),
        paliersValides: Number(semaineLue?.validees ?? 0),
      },
      branche: b?.key ?? null,
      paliers,
      niveaux: NIVEAUX.map(niveau => {
        const r = parNiveau.rows.find(x => x.niveau === niveau)
        return { niveau, questions: Number(r?.n ?? 0), justes: Number(r?.justes ?? 0) }
      }),
      bloques: bloques.slice(0, BLOQUES_MONTRES),
    }
  }

  // ── La routine du matin ─────────────────────────────────────────────────

  /**
   * Ce que la routine doit écrire aujourd'hui (Paris) : par catégorie,
   * combien encore — la commande moins ce qu'elle a déjà déposé, si elle
   * repasse —, les sous-thèmes et les difficultés qui manquent le plus
   * (`commandeDeLaCategorie`), et sa part de la consigne, avec les intitulés
   * déjà écrits dans ces sous-thèmes-là : la catégorie entière ferait des
   * consignes de plus en plus longues à mesure que la base grandit. La
   * consigne commune, une fois pour toutes (`consigneCommune`).
   */
  async commandeDuJour(): Promise<CommandeDeLaBase> {
    const base = await this.base()
    const aujourdhui = jourDe(this.maintenant())
    const categories = CATEGORIES.map(categorie => {
      const deposees = this.ajouts.filter(a => a.question.meta.categorie === categorie && jourDe(a.ajouteeLe) === aujourdhui).length
      const aEcrire = Math.max(0, QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR - deposees)
      if (aEcrire === 0) return { categorie, aEcrire, quotas: [], consigne: null }
      const existantes = base.questions.filter(q => q.meta.categorie === categorie && !this.retirees.has(q.id))
      const quotas = commandeDeLaCategorie(
        categorie,
        existantes.map(q => ({ sousTheme: q.meta.sousTheme, difficulte: q.meta.difficulte })),
        aEcrire,
      )
      const vises = new Set(quotas.map(q => q.cle))
      const deja = existantes.filter(q => vises.has(q.meta.sousTheme)).map(q => q.texte)
      return { categorie, aEcrire, quotas, consigne: partDeLaCategorie(categorie, quotas, deja) }
    })
    const aEcrire = categories.reduce((n, c) => n + c.aEcrire, 0)
    return { aEcrire, parEnvoi: DEPOT_MAX, consigneCommune: aEcrire > 0 ? consigneCommune({ sorte: 'routine' }) : null, categories }
  }

  /**
   * Le dépôt de la routine : chaque entrée relue par le juge de la base
   * (`lireQuestionDeLaBase`), comme une ligne du dépôt ; écartée, avec sa
   * raison, si elle est d'une autre catégorie, déjà dans la base, dans la
   * réserve du quiz du jour ou dans un quiz livré, si elle pose un fait que
   * la base ou ce dépôt pose déjà (`IndexDesFaits`), ou si la catégorie a
   * atteint son plafond du jour. Rangée sous un identifiant neuf, et jouable
   * tout de suite. Un dépôt à la fois : deux routines lancées ensemble ne
   * passeraient pas le plafond, ni ne rangeraient deux fois le même intitulé.
   */
  deposer(categorie: unknown, entrees: unknown): Promise<DepotDeLaBase> {
    return this.avecVerrou('#depot', async () => {
      const c = CATEGORIES.find(x => x === categorie)
      if (!c) throw new Error(`Catégorie inconnue : ${String(categorie)}`)
      if (!Array.isArray(entrees) || entrees.length === 0) throw new Error('Envoie les questions dans « entrees », un tableau au format de la consigne')
      if (entrees.length > DEPOT_MAX) throw new Error(`${DEPOT_MAX} questions au plus par envoi : coupe le lot en plusieurs`)
      const [base, duJour] = await Promise.all([this.base(), this.empreintesDuJour()])
      this.livres ??= empreintesDesLivres()
      const faits = await (this.faits ??= indexSansBloquer(base.questions).catch(e => {
        // Raté, il se rebâtit au dépôt suivant : gardée, la promesse le figerait.
        this.faits = null
        throw e
      }))
      // Ce dépôt à part : écrit seulement si le lot passe, il rejoint ensuite les faits de la base.
      const dansCeDepot = new IndexDesFaits<QuestionDeLaBase>()
      const ids = new Set(base.parId.keys())
      const vues = new Set<string>()
      const aujourdhui = jourDe(this.maintenant())
      let place = PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR - this.ajouts.filter(a => a.question.meta.categorie === c && jourDe(a.ajouteeLe) === aujourdhui).length
      const ecartees: DepotDeLaBase['ecartees'] = []
      const acceptees: QuestionDeLaBase[] = []
      for (const brut of entrees) {
        const texte = tronquer(String((brut as { texte?: unknown } | null)?.texte ?? ''), 120)
        const lu = lireQuestionDeLaBase(brut, { sansId: true })
        if ('refus' in lu) {
          ecartees.push({ texte, motif: lu.refus })
          continue
        }
        const q = lu.question
        const memeFait = faits.chercher(q) ?? dansCeDepot.chercher(q)
        const motif =
          q.meta.categorie !== c
            ? `d’une autre catégorie (${q.meta.categorie}) : dépose-la avec la sienne`
            : base.empreintes.has(q.empreinte)
              ? 'déjà dans la base'
              : duJour.has(q.empreinte)
                ? 'déjà dans la réserve du quiz du jour'
                : this.livres.has(q.empreinte)
                  ? 'déjà dans un quiz livré'
                  : vues.has(q.empreinte)
                    ? 'deux fois dans ce dépôt'
                    : memeFait
                      ? motifDuMemeFait(memeFait)
                      : place <= 0
                        ? `la catégorie a reçu ses ${PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR} questions du jour`
                        : null
        if (motif) {
          ecartees.push({ texte, motif })
          continue
        }
        vues.add(q.empreinte)
        place--
        const rangee = { ...q, id: nouvelIdentifiant(ids) }
        dansCeDepot.ajouter(rangee)
        acceptees.push(rangee)
      }
      if (acceptees.length > 0) {
        const maintenant = this.maintenant()
        await this.client.batch(
          acceptees.map(q => ({
            sql: 'INSERT INTO campagne_ajouts (id, categorie, entree, ajoutee_le) VALUES (?, ?, ?, ?)',
            args: [q.id, c, JSON.stringify(entreeDeLaBase(q)), maintenant],
          })),
          'write',
        )
        // Écrites : elles se jouent tout de suite. La base fusionnée se refait à la prochaine lecture.
        for (const q of acceptees) {
          this.ajouts.push({ question: q, ajouteeLe: maintenant })
          faits.ajouter(q)
        }
      }
      return { ajoutees: acceptees.length, ecartees }
    })
  }

  /**
   * Ce que la routine a ajouté : de quoi voir qu'elle tourne, et relire ses
   * dernières questions — dans leur version du jour, corrigées depuis s'il
   * le faut (`base`).
   */
  private ajoutsDeLaRoutine(base: BaseDeLaCampagne): AjoutsDeLaRoutine {
    const maintenant = this.maintenant()
    const aujourdhui = jourDe(maintenant)
    const derniers = this.ajouts.slice(-20).reverse()
    return {
      aujourdhui: this.ajouts.filter(a => jourDe(a.ajouteeLe) === aujourdhui).length,
      septJours: this.ajouts.filter(a => a.ajouteeLe > maintenant - 7 * 24 * HEURE_MS).length,
      total: this.ajouts.length,
      dernierLe: this.ajouts.at(-1)?.ajouteeLe ?? null,
      derniers: derniers.map(({ question: deposee, ajouteeLe }) => {
        const q = base.parId.get(deposee.id) ?? deposee
        const remplacante = this.corrections.get(q.id)?.question.id
        return {
          id: q.id,
          texte: q.texte,
          categorie: q.meta.categorie,
          sousTheme: q.meta.sousTheme,
          difficulte: q.meta.difficulte,
          ajouteeLe,
          retiree: this.retirees.has(q.id),
          ...(remplacante !== undefined && remplacante !== q.id && { remplacee: true as const }),
        }
      }),
    }
  }

  /** Pour `/healthz` : agrégé, lu en mémoire, sans un intitulé — la route est publique. */
  santeDeLaBase(): { ajoutees: number; dernierApport: number | null } {
    return { ajoutees: this.ajouts.length, dernierApport: this.ajouts.at(-1)?.ajouteeLe ?? null }
  }

  // ── Les signalements ────────────────────────────────────────────────────

  /**
   * Un joueur signale une erreur dans une question qu'il vient de jouer —
   * après sa réponse : avant, il signalerait sans avoir vu la bonne. Un
   * second signalement du même joueur remplace le premier.
   */
  async signaler(profileId: string, serieId: string, index: number, texte: unknown): Promise<void> {
    const propre = tronquer(String(texte ?? '').trim(), SIGNALEMENT_MAX)
    if (!propre) throw new Error('Dis en une phrase ce qui ne va pas')
    const s = await this.serie(profileId, serieId)
    if (!s) throw new Error('Cette série est introuvable')
    if (!Number.isInteger(index) || index < 0 || index >= s.index) throw new Error('Réponds d’abord à cette question')
    const q = s.questions[index]
    if (!(await this.base()).parId.has(q.id)) throw new Error('Cette question n’est plus dans la campagne')
    await this.client.execute({
      sql: `INSERT INTO campagne_signalements (question_id, profile_id, serie_id, texte, cree_le) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(question_id, profile_id) DO UPDATE SET serie_id = excluded.serie_id, texte = excluded.texte, cree_le = excluded.cree_le, traite_le = NULL`,
      args: [q.id, profileId, s.id, propre, this.maintenant()],
    })
  }

  /**
   * Les questions signalées et pas encore relues, la plus récente d'abord :
   * qui les signale — ce qu'il en dit, où il l'a jouée, ce qu'il y a
   * répondu —, ceux déjà relus avec, et ce que disent toutes les réponses de
   * campagne. Sa réponse se lit dans la version qu'il a jouée, que sa série
   * garde — réponses mélangées, et peut-être corrigées depuis — : seule
   * cette question en revient (`json_extract`), pas la série entière. Les
   * prénoms se lisent au profil, dans la route (`campagne.ts`).
   */
  async signalements(): Promise<SignalementDeCampagne[]> {
    const [res, base, fichiers, mesure] = await Promise.all([
      this.client.execute(
        `SELECT g.question_id, g.profile_id, g.texte, g.cree_le, g.traite_le, s.mode, s.branche, s.palier, r.choix, r.juste,
                json_extract(s.questions, '$[' || r.position || ']') AS vue
         FROM campagne_signalements g
         LEFT JOIN campagne_series s ON s.id = g.serie_id
         LEFT JOIN campagne_reponses r ON r.serie_id = g.serie_id AND r.reserve_id = g.question_id
         WHERE g.question_id IN (
           SELECT question_id FROM campagne_signalements WHERE traite_le IS NULL
           GROUP BY question_id ORDER BY MAX(cree_le) DESC LIMIT ${SIGNALEMENTS_MONTRES}
         )
         ORDER BY g.cree_le DESC`,
      ),
      this.base(),
      this.fichiers(),
      this.mesures(),
    ])
    // Les remplaçantes : nées d'une correction qui a changé la bonne réponse.
    const remplacantes = new Map<string, number>()
    for (const [ancienne, c] of this.corrections) if (c.question.id !== ancienne) remplacantes.set(c.question.id, c.corrigeeLe)
    const parQuestion = new Map<string, Record<string, unknown>[]>()
    for (const r of res.rows) {
      const id = String(r.question_id)
      const lignes = parQuestion.get(id)
      if (lignes) lignes.push(r)
      else parQuestion.set(id, [r])
    }
    const sortie: SignalementDeCampagne[] = []
    for (const [id, lignes] of parQuestion) {
      const q = base.parId.get(id)
      if (!q) continue
      const rapports = lignes.map(r => rapportDe(r, q))
      const ouverts = rapports.filter(r => r.traiteLe === null)
      if (ouverts.length === 0) continue
      const surPlace = this.corrections.get(id)
      sortie.push({
        questionId: q.id,
        texte: q.texte,
        reponses: q.reponses,
        bonne: q.bonne,
        anecdote: q.anecdote,
        categorie: q.meta.categorie,
        sousTheme: q.meta.sousTheme,
        difficulte: q.meta.difficulte,
        niveau: niveauDeQuestion(q.meta.difficulte, mesure.get(q.id)),
        mesure: mesure.get(q.id) ?? { justes: 0, total: 0 },
        origine: remplacantes.has(q.id) ? 'correction' : fichiers.parId.has(q.id) ? 'depot' : 'routine',
        corrigeeLe: surPlace?.question.id === q.id ? surPlace.corrigeeLe : (remplacantes.get(q.id) ?? null),
        ...(this.retirees.has(q.id) && { retiree: true as const }),
        joueurs: ouverts.length,
        rapports,
        dernier: Math.max(...ouverts.map(r => r.le)),
      })
    }
    return sortie.sort((a, b) => b.dernier - a.dernier)
  }

  /** « Garder » : la question est juste, ses signalements se referment. */
  async garder(questionId: string): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE campagne_signalements SET traite_le = ? WHERE question_id = ? AND traite_le IS NULL',
      args: [this.maintenant(), questionId],
    })
  }

  /**
   * « Retirer » : la campagne ne la tire plus, pour personne — les séries en
   * cours la gardent, elles l'ont déjà. Ses signalements se referment avec.
   * Pour la reprendre plutôt que la perdre, il y a « Corriger ».
   */
  async retirer(questionId: string): Promise<void> {
    if (!(await this.base()).parId.has(questionId)) throw new Error('Cette question n’est pas dans la base')
    const maintenant = this.maintenant()
    await this.client.batch(
      [
        { sql: 'INSERT OR IGNORE INTO campagne_retraits (question_id, retiree_le) VALUES (?, ?)', args: [questionId, maintenant] },
        { sql: 'UPDATE campagne_signalements SET traite_le = ? WHERE question_id = ? AND traite_le IS NULL', args: [maintenant, questionId] },
      ],
      'write',
    )
    this.retirees.add(questionId)
  }

  /**
   * « Corriger » : la question se joue désormais dans sa version corrigée,
   * relue par le juge de la base comme une ligne du dépôt. La même bonne
   * réponse, le même identifiant : ses réponses passées et sa difficulté
   * mesurée la suivent. Une autre bonne réponse, et ce n'est plus la même
   * question (`bonneReponseChange`) : elle repart sous un identifiant neuf,
   * sans les mesures de l'ancienne, qui est retirée — et sans ce qui
   * justifiait l'ancienne réponse (son explication, sa valeur, sa date).
   * Les séries déjà tirées, le défi de la semaine compris, gardent la
   * version qu'elles ont lue. Ses signalements se referment.
   *
   * Rangée dans Turso, pas dans les fichiers du dépôt : elle vaut sans
   * déploiement, et l'emporte sur la ligne du fichier tant qu'elle existe.
   * Sous le verrou des dépôts : un identifiant neuf ou un intitulé ne se
   * prennent pas deux fois.
   */
  corriger(questionId: string, brut: unknown): Promise<QuestionCorrigee> {
    return this.avecVerrou('#depot', async () => {
      const [base, duJour] = await Promise.all([this.base(), this.empreintesDuJour()])
      const avant = base.parId.get(questionId)
      if (!avant) throw new Error('Cette question n’est pas dans la base')
      if (this.retirees.has(questionId)) throw new Error('Cette question est retirée de la campagne : on ne la corrige plus')
      const proposee = lireLaCorrection(brut)
      if (!proposee) throw new Error('Envoie l’intitulé, les réponses, l’index de la bonne et l’anecdote')
      // Rangée pour rien, elle masquerait encore la ligne du fichier le jour où on la reprendrait dans le dépôt.
      const pareille =
        proposee.texte === avant.texte &&
        proposee.anecdote === avant.anecdote &&
        proposee.bonne === avant.bonne &&
        proposee.reponses.length === avant.reponses.length &&
        proposee.reponses.every((r, i) => r === avant.reponses[i])
      if (pareille) throw new Error('Rien n’a changé : « Garder » referme ses signalements')
      const nouvelle = bonneReponseChange(avant, proposee)
      const lu = lireQuestionDeLaBase({
        ...entreeDeLaBase(avant),
        ...proposee,
        leurres: leurresApres(avant, proposee),
        ...(nouvelle && { explication: '', valeur: null, date: null }),
      })
      if ('refus' in lu) throw new Error(`Correction refusée : ${lu.refus}`)
      // Un intitulé neuf n'est celui d'aucune autre question jouable : ni de
      // la base, ni de la réserve du quiz du jour, ni d'un quiz livré.
      if (lu.question.empreinte !== avant.empreinte) {
        this.livres ??= empreintesDesLivres()
        const e = lu.question.empreinte
        if (base.questions.some(x => x.id !== questionId && x.empreinte === e && !this.retirees.has(x.id))) throw new Error('Cet intitulé est déjà celui d’une autre question de la campagne')
        if (duJour.has(e)) throw new Error('Cet intitulé est déjà dans la réserve du quiz du jour')
        if (this.livres.has(e)) throw new Error('Cet intitulé est déjà dans un quiz livré')
      }
      const corrigee = { ...lu.question, id: nouvelle ? nouvelIdentifiant(new Set(base.parId.keys())) : questionId }
      const maintenant = this.maintenant()
      await this.client.batch(
        [
          {
            sql: `INSERT INTO campagne_corrections (question_id, entree, corrigee_le) VALUES (?, ?, ?)
                  ON CONFLICT(question_id) DO UPDATE SET entree = excluded.entree, corrigee_le = excluded.corrigee_le`,
            args: [questionId, JSON.stringify(entreeDeLaBase(corrigee)), maintenant],
          },
          ...(nouvelle ? [{ sql: 'INSERT OR IGNORE INTO campagne_retraits (question_id, retiree_le) VALUES (?, ?)', args: [questionId, maintenant] }] : []),
          { sql: 'UPDATE campagne_signalements SET traite_le = ? WHERE question_id = ? AND traite_le IS NULL', args: [maintenant, questionId] },
        ],
        'write',
      )
      // Écrite : elle se joue tout de suite. La base fusionnée se refait à la prochaine lecture.
      this.corrections.set(questionId, { question: corrigee, corrigeeLe: maintenant })
      this.versionDesCorrections++
      if (nouvelle) this.retirees.add(questionId)
      return { id: corrigee.id, nouvelle }
    })
  }

  /** L'écran de l'administrateur : la base, ce qu'on en joue, et les signalements à relire. */
  async administration(): Promise<AdminDeLaCampagne> {
    const [jouables, signalements, base] = await Promise.all([this.jouables(), this.signalements(), this.base()])
    return {
      questions: base.questions.length,
      jouables: jouables.length,
      retirees: this.retirees.size,
      parCategorie: parCategorie(jouables),
      parDifficulte: CATEGORIES.map(categorie => {
        const difficultes = [0, 0, 0, 0, 0]
        for (const q of jouables) if (q.meta.categorie === categorie) difficultes[q.meta.difficulte - 1]++
        return { categorie, difficultes }
      }),
      ajouts: this.ajoutsDeLaRoutine(base),
      signalements,
    }
  }

  /** Un profil supprimé : ses séries, leurs réponses et ses signalements, sous son verrou. */
  oublierProfil(profileId: string): Promise<void> {
    return this.avecVerrou(profileId, async () => {
      this.enCours.delete(profileId)
      await this.client.batch(
        [
          { sql: 'DELETE FROM campagne_reponses WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
          { sql: 'DELETE FROM campagne_series WHERE profile_id = ?', args: [profileId] },
          { sql: 'DELETE FROM campagne_signalements WHERE profile_id = ?', args: [profileId] },
          { sql: 'DELETE FROM sentier_acquis WHERE profile_id = ?', args: [profileId] },
        ],
        'write',
      )
    })
  }

  close() {
    this.ferme = true
    this.client.close()
  }
}

/**
 * La lecture de ses bonnes réponses, comptées par heure : une ligne par
 * bonne réponse — des milliers pour un fidèle — repartait de Turso à chaque
 * bonne réponse. Seule (`justesParJour`), ou au bout du lot qui écrit une
 * réponse.
 */
function lectureDesJustes(profileId: string): InStatement {
  return {
    sql: `SELECT CAST(r.repondue_le / ${HEURE_MS} AS INTEGER) AS heure, COUNT(*) AS n
          FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
          WHERE s.profile_id = ? AND r.juste = 1 GROUP BY heure`,
    args: [profileId],
  }
}

/**
 * Tout ce que sa ligne d'expérience compte : ses bonnes réponses, heure par
 * heure, et les paliers des sentiers qu'il a validés en jouant — une fois
 * chacun (`xpDuPalier`). Lues ensemble, au bout du lot qui écrit une bonne
 * réponse : la ligne se réécrit toujours en entier, et une ligne sans ses
 * paliers les aurait repris.
 */
function lecturesDeLExperience(profileId: string): InStatement[] {
  return [
    lectureDesJustes(profileId),
    {
      sql: `SELECT DISTINCT branche, palier FROM campagne_series WHERE profile_id = ? AND mode = 'sentier' AND issue = 'validee'`,
      args: [profileId],
    },
  ]
}

/** Sa ligne d'expérience de campagne, de ce que `lecturesDeLExperience` a lu. */
function experienceLue([justes, paliers]: readonly ResultSet[]): { parJour: Map<string, number>; xp: number } {
  const parJour = justesParJourDe(justes.rows)
  const xp = xpDeCampagne(parJour.values()) + paliers.rows.reduce((n, r) => n + xpDuPalier(Number(r.palier)), 0)
  return { parJour, xp }
}

/** Des heures aux jours de Paris : il change de jour à une heure pile, hiver comme été — une heure n'est jamais à cheval sur deux jours. */
function justesParJourDe(lignes: readonly Record<string, unknown>[]): Map<string, number> {
  const parJour = new Map<string, number>()
  for (const r of lignes) {
    const jour = jourDe(Number(r.heure) * HEURE_MS)
    parJour.set(jour, (parJour.get(jour) ?? 0) + Number(r.n))
  }
  return parJour
}

/**
 * La version des règles de la campagne que la relecture a appliquées aux
 * séries passées (`relireLesSeries`) : 1 depuis ses hauts faits et ses
 * paliers (le 5 octobre 2026). Une règle de plus la fait monter.
 */
const VERSION_DES_SERIES = 1

/** Le Funambule : autant de bonnes réponses d'affilée sur sa dernière vie. */
export const FUNAMBULE = 9
/** La Grande Série : autant de bonnes réponses dans une série de toutes les catégories. */
export const GRANDE_SERIE = 30
/**
 * Sans une égratignure : les expertes doivent venir après les trois marches
 * complètes — quinze questions. Une catégorie jouée seule, qui n'a pas cinq
 * questions de chaque marche, les sert plus tôt : ce n'est pas le même
 * exploit.
 */
const AVANT_LES_EXPERTES = 3 * QUESTIONS_PAR_MARCHE

/** Les catégories qu'une série retient en base : aucune ou toutes, c'est NULL — toutes. */
function categoriesRetenues(categories?: readonly string[]): string | null {
  const choisies = [...new Set(categories ?? [])].filter(c => (CATEGORIES as readonly string[]).includes(c))
  return choisies.length === 0 || choisies.length >= CATEGORIES.length ? null : JSON.stringify(choisies)
}

/**
 * Les hauts faits d'une série finie, lus sur ses réponses dans l'ordre :
 * dérivation pure, comme ceux d'une soirée. Le Funambule compte les bonnes
 * réponses d'affilée après la deuxième erreur ; Sans une égratignure, que
 * tout était juste jusqu'à la première experte ; la Grande Série, une série
 * de toutes les catégories (`categories` NULL) — pas celle d'un sujet, qui
 * les traverse sans les poser toutes.
 */
export function hautsFaitsDeLaSerie(
  s: { questions: readonly { niveau: Niveau }[]; justes: number; categories?: readonly string[] | null; sujet?: string | null },
  justes: readonly boolean[],
): string[] {
  const cles: string[] = []
  let erreurs = 0
  let derniereVie = 0
  let meilleure = 0
  for (const j of justes) {
    if (!j) {
      erreurs++
      derniereVie = 0
    } else if (erreurs === VIES - 1) {
      derniereVie++
      meilleure = Math.max(meilleure, derniereVie)
    }
  }
  if (meilleure >= FUNAMBULE) cles.push('hf:funambule')
  const experte = s.questions.findIndex(q => q.niveau === 'expert')
  if (experte >= AVANT_LES_EXPERTES && justes.length > experte - 1 && justes.slice(0, experte).every(Boolean)) cles.push('hf:intact')
  if (s.justes >= GRANDE_SERIE && !s.categories && !s.sujet) cles.push('hf:grande-serie')
  return cles
}

/** La fin d'une série et l'Éclat de son défi, en une annonce : ce qui est tombé à la suite, chaque légendaire une fois. */
function ensemble(serie: Recompenses, defi: RecompensesDuDefi): RecompensesDuDefi {
  const recompenses = [...(serie.recompenses ?? []), ...(defi.recompenses ?? [])]
  const legendaires = [...new Set([...(serie.legendaires ?? []), ...(defi.legendaires ?? [])])]
  return {
    ...(recompenses.length > 0 && { recompenses }),
    ...(legendaires.length > 0 && { legendaires }),
    ...(defi.eclat && { eclat: defi.eclat }),
  }
}

/** Ce qu'une fin annonce d'une clé tombée : son emoji et son titre — « L'Alpiniste · Argent » pour un palier. */
function tombee(cle: string): PalierTombe {
  const p = palierDe(cle)
  const h = hautFait(cle)
  return { key: cle, emoji: p ? p.hautFait.emoji : (h?.emoji ?? '✨'), title: p ? titreDePalier(p.hautFait, p.palier) : (h?.title ?? cle) }
}

/** Les vainqueurs d'un défi clos, tels que la clôture les a écrits. */
function lireVainqueurs(brut: unknown): string[] {
  if (typeof brut !== 'string') return []
  try {
    const lu: unknown = JSON.parse(brut)
    return Array.isArray(lu) ? lu.map(String) : []
  } catch {
    return []
  }
}

function versSerie(r: Record<string, unknown>): Serie {
  const questions = (JSON.parse(String(r.questions)) as (QuestionDeSerie & { reserveId?: string })[]).map(({ reserveId, ...q }) => ({ ...q, id: q.id ?? reserveId ?? '' }))
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    questions,
    index: Number(r.position),
    vies: Number(r.vies),
    justes: Number(r.justes),
    finieLe: r.finie_le === null || r.finie_le === undefined ? null : Number(r.finie_le),
    mode:
      r.mode === 'sentier' || r.mode === 'defi' || r.mode === 'duel' || r.mode === 'revision' || r.mode === 'rencontre' ? r.mode : 'serie',
    branche: brancheParCle(r.branche)?.key ?? null,
    palier: r.palier === null || r.palier === undefined ? null : Number(r.palier),
    seuil: r.seuil === null || r.seuil === undefined ? null : Number(r.seuil),
    rejeu: Number(r.rejeu ?? 0) === 1,
    issue: r.issue === 'validee' || r.issue === 'ratee' ? r.issue : null,
    categories: lireCategories(r.categories),
    sujet: typeof r.sujet === 'string' ? r.sujet : null,
    semaine: typeof r.semaine === 'string' ? r.semaine : null,
    duel: typeof r.duel === 'string' ? r.duel : null,
    adversaire: lireAdversaire(r.adversaire),
  }
}

/** L'adversaire qu'une rencontre a gardé ; null : pas une rencontre, ou illisible. */
function lireAdversaire(brut: unknown): AdversaireGarde | null {
  if (typeof brut !== 'string') return null
  try {
    const lu = JSON.parse(brut) as Record<string, unknown>
    if (typeof lu.serie !== 'string' || typeof lu.profil !== 'string' || !Array.isArray(lu.reponses)) return null
    return { serie: lu.serie, profil: lu.profil, reponses: lu.reponses.map(x => x === true) }
  } catch {
    return null
  }
}

/** Les bonnes réponses de l'adversaire sur les questions qu'une rencontre a déjà jouées : le score d'en face, à la reprise. */
function sesJustesAvant(s: Serie): number {
  return s.adversaire ? s.adversaire.reponses.slice(0, s.index).filter(Boolean).length : 0
}

/** Ce qu'une réponse de rencontre dit de l'adversaire sur la même question, et les deux scores — finie, son issue contre son score entier. */
function coupDeLaRencontre(a: AdversaireGarde, index: number, toi: number, finie: boolean): CoupDeLaRencontre {
  const total = a.reponses.filter(Boolean).length
  return {
    lui: index < a.reponses.length ? a.reponses[index] : null,
    toi,
    sesJustes: a.reponses.slice(0, index + 1).filter(Boolean).length,
    ...(finie && { issue: issueDeRencontre(toi, total) }),
  }
}

/** Un adversaire possible : une série finie d'un autre joueur, et ce qu'on a déjà vu de ses premières questions. */
export interface CandidatALaRencontre {
  serie: string
  profil: string
  justes: number
  finieLe: number
  /** Ses questions jouées — et les trois d'après, qu'on peut atteindre — que celui qui cherche a déjà vues. */
  dejaVues: number
}

/**
 * L'adversaire d'une rencontre : de son niveau d'abord — à un point près,
 * c'est pareil : deux bonnes réponses d'écart font une autre partie —, puis
 * celui dont il a vu le moins de questions — une rencontre sur des questions
 * qu'on connaît n'en est pas une —, puis au hasard. Null : personne.
 */
export function choisirUnAdversaire(candidats: readonly CandidatALaRencontre[], niveau: number, hasard: () => number = Math.random): CandidatALaRencontre | null {
  let meilleur: CandidatALaRencontre | null = null
  let sonRang: number[] | null = null
  for (const c of candidats) {
    const r = [Math.floor(Math.abs(c.justes - niveau) / 2), c.dejaVues, hasard()]
    if (!sonRang || passeAvant(r, sonRang)) {
      meilleur = c
      sonRang = r
    }
  }
  return meilleur
}

/** Un code de défi entre amis, à recopier sans se tromper (`LETTRES_D_UN_CODE`). */
function nouveauCode(): string {
  return Array.from(randomBytes(LONGUEUR_D_UN_CODE), o => LETTRES_D_UN_CODE[o % LETTRES_D_UN_CODE.length]).join('')
}

/**
 * Les sujets d'une question de la base, lus une fois : la page de la
 * campagne les compte à chaque ouverture, cinq mille questions et dix-neuf
 * sujets — au dixième de cœur de l'hébergeur, recompté à chaque fois, la
 * page attendait.
 */
const SUJETS_LUS = new WeakMap<QuestionDeLaBase, readonly string[]>()
function sujetsDeLaQuestion(q: QuestionDeLaBase): readonly string[] {
  let lus = SUJETS_LUS.get(q)
  if (!lus) SUJETS_LUS.set(q, (lus = sujetsDe(q.meta)))
  return lus
}

/** Les catégories retenues d'une série : null — toutes, ou une série d'avant la colonne. */
function lireCategories(brut: unknown): string[] | null {
  if (typeof brut !== 'string') return null
  try {
    const lu: unknown = JSON.parse(brut)
    return Array.isArray(lu) ? lu.map(String) : null
  } catch {
    return null
  }
}

/**
 * Une question de la base, telle que la série la garde : ses réponses
 * mélangées pour cette série-ci — on ne retient pas une place —, sauf
 * « Vrai » et « Faux », qui restent dans cet ordre.
 */
function versQuestionDeSerie(q: QuestionDeLaBase, niveau: Niveau): QuestionDeSerie {
  const ordre = q.reponses.length === 2 ? [0, 1] : melanger(q.reponses.map((_, i) => i))
  return {
    id: q.id,
    texte: q.texte,
    reponses: ordre.map(i => q.reponses[i]),
    bonne: ordre.indexOf(q.bonne),
    categorie: q.meta.categorie,
    anecdote: q.anecdote,
    niveau,
    sousTheme: q.meta.sousTheme,
  }
}

/** Ce que le téléphone reçoit d'une question : jamais la bonne réponse ni l'anecdote avant la sienne. */
function questionMontree(q: QuestionDeSerie, index: number): QuestionDeCampagne {
  return { index, texte: q.texte, reponses: q.reponses, categorie: q.categorie, niveau: q.niveau, ...(q.sousTheme && { sousTheme: q.sousTheme }) }
}

function vueDeSerie(s: Serie): SerieDeCampagne {
  const finie = s.finieLe !== null
  return {
    id: s.id,
    vies: s.vies,
    justes: s.justes,
    total: s.questions.length,
    finie,
    ...(!finie && s.questions[s.index] && { question: questionMontree(s.questions[s.index], s.index) }),
    ...((s.mode === 'serie' || s.mode === 'duel' || s.mode === 'rencontre') && s.categories && s.categories.length > 0 && { categories: s.categories }),
    ...((s.mode === 'serie' || s.mode === 'duel' || s.mode === 'rencontre') && s.sujet && { sujet: s.sujet }),
  }
}

/** La marche la plus haute parmi des questions jouées : « jusqu'au niveau difficile ». */
function plusHaute(questions: readonly QuestionDeSerie[]): Niveau {
  return NIVEAUX[Math.max(0, ...questions.map(q => NIVEAUX.indexOf(q.niveau)))]
}

/** Les catégories et leur nombre de questions, dans l'ordre fixe de la liste (`shared/categories.ts`). */
function parCategorie(questions: readonly QuestionDeLaBase[]): { categorie: string; questions: number }[] {
  const compte = new Map<string, number>()
  for (const q of questions) compte.set(q.meta.categorie, (compte.get(q.meta.categorie) ?? 0) + 1)
  return CATEGORIES.filter(c => compte.has(c)).map(c => ({ categorie: c, questions: compte.get(c)! }))
}

/** Une entrée de la base rangée dans Turso — un dépôt de la routine, une correction —, relue par le juge du jour. */
function relireUneEntree(brut: unknown): { question: QuestionDeLaBase } | { refus: string } {
  try {
    return lireQuestionDeLaBase(JSON.parse(String(brut)))
  } catch {
    return { refus: 'JSON illisible' }
  }
}

/**
 * Les corrections de l'administrateur, sur la base du dépôt et de la
 * routine : les remplaçantes d'abord — une question neuve, sous son propre
 * identifiant —, puis les corrections sur place, qui prennent la place de la
 * version d'avant. Une remplaçante se corrige donc comme les autres. Une
 * correction sur place dont la question a quitté la base ne la fait pas
 * revenir.
 */
function appliquerLesCorrections(
  questions: readonly QuestionDeLaBase[],
  corrections: ReadonlyMap<string, { question: QuestionDeLaBase }>,
): QuestionDeLaBase[] {
  const parId = new Map(questions.map(q => [q.id, q]))
  for (const [ancienne, c] of corrections) if (c.question.id !== ancienne && !parId.has(c.question.id)) parId.set(c.question.id, c.question)
  for (const [id, c] of corrections) if (c.question.id === id && parId.has(id)) parId.set(id, c.question)
  return [...parId.values()]
}

/**
 * Ce que l'écran de l'administrateur envoie pour corriger une question, mis
 * en forme : des textes sur une ligne, sans espaces en trop — le juge de la
 * base refuserait un retour à la ligne collé avec l'intitulé. Il dira le
 * reste. Null : pas une correction.
 */
function lireLaCorrection(brut: unknown): CorrectionDeQuestion | null {
  if (!brut || typeof brut !== 'object') return null
  const b = brut as Record<string, unknown>
  if (typeof b.texte !== 'string' || !Array.isArray(b.reponses) || !b.reponses.every(r => typeof r === 'string')) return null
  if (typeof b.bonne !== 'number' || !Number.isInteger(b.bonne)) return null
  if (b.anecdote !== null && b.anecdote !== undefined && typeof b.anecdote !== 'string') return null
  const uneLigne = (t: string) => t.replace(/\s+/g, ' ').trim()
  const anecdote = typeof b.anecdote === 'string' ? b.anecdote.trim() : ''
  return { texte: uneLigne(b.texte), reponses: (b.reponses as string[]).map(uneLigne), bonne: b.bonne, anecdote: anecdote || null }
}

/**
 * Les leurres d'une question corrigée. Ses mauvaises réponses d'abord : le
 * juge les y veut toutes, et n'en garde que huit. Puis ceux d'avant qu'on
 * ne montrait pas. Une réponse que la correction a ôtée n'en est plus un :
 * on l'ôte parce qu'elle trompait mal — juste, elle aussi, ou ambiguë. La
 * bonne réponse n'en est jamais un.
 */
export function leurresApres(avant: QuestionDeLaBase, apres: CorrectionDeQuestion): string[] {
  const juste = sansAccent(apres.reponses[apres.bonne] ?? '')
  const restent = new Set(apres.reponses.map(sansAccent))
  const otees = new Set(avant.reponses.map(sansAccent).filter(r => !restent.has(r)))
  const vus = new Set<string>()
  const leurres: string[] = []
  for (const l of [...apres.reponses.filter((_, i) => i !== apres.bonne), ...avant.meta.leurres]) {
    const cle = sansAccent(l)
    if (cle === juste || otees.has(cle) || vus.has(cle)) continue
    vus.add(cle)
    leurres.push(l)
  }
  return leurres
}

/**
 * Un signalement, tel que l'administration le lit : sa ligne, sa série et
 * sa réponse jointes (`signalements`). La version qu'il a jouée — réponses
 * dans l'ordre de sa série — dit ce qu'il a répondu, et si la base a changé
 * depuis : corrigée ici, ou dans son fichier.
 */
function rapportDe(r: Record<string, unknown>, q: QuestionDeLaBase): RapportDeSignalement {
  const vue = lireLaVersionJouee(r.vue)
  const choix = r.choix === null || r.choix === undefined ? null : Number(r.choix)
  const ou = r.mode === 'sentier' || r.mode === 'defi' || r.mode === 'duel' || r.mode === 'revision' || r.mode === 'rencontre' ? r.mode : 'serie'
  return {
    profileId: String(r.profile_id),
    prenom: null,
    login: null,
    texte: String(r.texte),
    le: Number(r.cree_le),
    traiteLe: r.traite_le === null || r.traite_le === undefined ? null : Number(r.traite_le),
    ou,
    ...(ou === 'sentier' && typeof r.branche === 'string' && { branche: r.branche }),
    ...(ou === 'sentier' && r.palier !== null && r.palier !== undefined && { palier: Number(r.palier) }),
    reponse: vue && choix !== null ? (vue.reponses[choix] ?? null) : null,
    juste: r.juste === null || r.juste === undefined ? null : Number(r.juste) === 1,
    ...(vue && !memeVersion(vue, q) && { versionDAvant: true as const }),
  }
}

/** La question telle qu'une série l'a gardée (`QuestionDeSerie`) : ce qu'il en faut pour lire une réponse. Null : illisible. */
function lireLaVersionJouee(brut: unknown): { texte: string; reponses: string[]; bonne: number; anecdote: string | null } | null {
  if (typeof brut !== 'string') return null
  try {
    const v = JSON.parse(brut) as Record<string, unknown>
    if (typeof v.texte !== 'string' || !Array.isArray(v.reponses) || typeof v.bonne !== 'number') return null
    return { texte: v.texte, reponses: v.reponses.map(String), bonne: v.bonne, anecdote: typeof v.anecdote === 'string' ? v.anecdote : null }
  } catch {
    return null
  }
}

/** La même version qu'une question de la base : le même intitulé, les mêmes réponses — dans n'importe quel ordre, la série les mélange —, la même bonne, la même anecdote. */
function memeVersion(vue: { texte: string; reponses: string[]; bonne: number; anecdote: string | null }, q: QuestionDeLaBase): boolean {
  const triees = (r: readonly string[]) => [...r].sort().join('\n')
  return vue.texte === q.texte && triees(vue.reponses) === triees(q.reponses) && vue.reponses[vue.bonne] === q.reponses[q.bonne] && vue.anecdote === q.anecdote
}

function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/** Un identifiant neuf de huit caractères, comme ceux que le rangement du dépôt tire (`base-campagne.ts ranger`). */
function nouvelIdentifiant(pris: Set<string>): string {
  for (;;) {
    const id = Array.from(randomBytes(8), o => 'abcdefghijklmnopqrstuvwxyz0123456789'[o % 36]).join('')
    if (!pris.has(id)) {
      pris.add(id)
      return id
    }
  }
}

/** Une épreuve telle que sa page la reprend : jamais la bonne réponse de la question en cours. */
function vueDEpreuve(e: Serie): EpreuveDeSentier {
  const finie = e.finieLe !== null
  return {
    id: e.id,
    branche: e.branche!,
    palier: e.palier!,
    rejeu: e.rejeu,
    seuil: e.seuil ?? regleDuPalier(e.palier)?.seuil ?? QUESTIONS_PAR_EPREUVE,
    justes: e.justes,
    fausses: e.index - e.justes,
    total: e.questions.length,
    issue: e.issue,
    finie,
    ...(!finie && e.questions[e.index] && { question: questionMontree(e.questions[e.index], e.index) }),
  }
}

/**
 * Ses sentiers, des deux lectures (`lecturesDesSentiers`) : pour chaque
 * branche, le plus haut de ce qu'il tenait d'avant et de ses épreuves
 * validées — elles se suivent : valider le septième, c'est avoir les six
 * d'avant —, et la meilleure note de chaque palier en étoiles.
 */
function sentiersLus(acquis: readonly Record<string, unknown>[], validees: readonly Record<string, unknown>[]): SentierDuJoueur[] {
  const parBranche = new Map(BRANCHES.map(b => [b.key, { acquis: 0, haut: 0, etoiles: PALIERS.map(() => 0) }]))
  for (const r of acquis) {
    const s = parBranche.get(String(r.branche) as CleDeBranche)
    if (s) s.acquis = Math.max(s.acquis, Number(r.paliers))
  }
  for (const r of validees) {
    const s = parBranche.get(String(r.branche) as CleDeBranche)
    const palier = Number(r.palier)
    const regle = regleDuPalier(palier)
    if (!s || !regle) continue
    s.haut = Math.max(s.haut, palier)
    s.etoiles[palier - 1] = Math.max(s.etoiles[palier - 1], etoilesDe(Number(r.justes), Number(r.seuil ?? regle.seuil)))
  }
  return BRANCHES.map(b => {
    const s = parBranche.get(b.key)!
    return { branche: b.key, paliers: Math.min(PALIER_DU_MAITRE, Math.max(s.acquis, s.haut)), acquis: s.acquis, etoiles: s.etoiles }
  })
}

/**
 * D'où emprunter quand un niveau manque à la catégorie : le même, puis le
 * plus dur d'à côté, puis le plus facile. Une base qui grandit chaque matin
 * finit par remplir chaque niveau ; d'ici là, une épreuve se joue toujours.
 */
const EMPRUNTS: Readonly<Record<Niveau, readonly Niveau[]>> = {
  facile: ['facile', 'moyen', 'difficile', 'expert'],
  moyen: ['moyen', 'difficile', 'facile', 'expert'],
  difficile: ['difficile', 'expert', 'moyen', 'facile'],
  expert: ['expert', 'difficile', 'moyen', 'facile'],
}

/**
 * Une question vue ces dernières vingt-quatre heures ne revient qu'en
 * dernier recours. Une fois les jamais vues d'une marche épuisées, le tirage
 * reprenait les déjà vues au hasard : celle d'il y a cinq minutes valait
 * celle d'il y a trois semaines, et qui usait ses douze vies sur un palier
 * revoyait le soir même les questions qu'il venait de rater (un retour de
 * joueur, le 10 octobre 2026). Une redite d'hier soir se remarque ; celle
 * d'il y a trois semaines est une révision.
 */
export const VUE_RECENTE_MS = 24 * HEURE_MS

/** Ce qu'un joueur a vu d'une question : jamais, ou quand pour la dernière fois — et si c'était ces dernières vingt-quatre heures. */
function fraicheurDe(vues: ReadonlyMap<string, number>, maintenant: number) {
  return (id: string): { recente: number; vue: number; le: number } => {
    const le = vues.get(id)
    return le === undefined ? { recente: 0, vue: 0, le: 0 } : { recente: maintenant - le < VUE_RECENTE_MS ? 1 : 0, vue: 1, le }
  }
}

/**
 * Les questions rangées par ce qu'un joueur en a vu : les jamais vues
 * d'abord, puis les déjà vues de la plus anciennement vue à la plus récente,
 * celles des dernières vingt-quatre heures en tout dernier. Le tri est
 * stable : chaque groupe garde l'ordre qu'on lui donne — le hasard du
 * battage, pour les jamais vues.
 */
export function parFraicheur<T extends { id: string }>(questions: readonly T[], vues: ReadonlyMap<string, number>, maintenant: number): T[] {
  const fraicheur = fraicheurDe(vues, maintenant)
  return [...questions].sort((a, b) => {
    const x = fraicheur(a.id)
    const y = fraicheur(b.id)
    return x.recente - y.recente || x.vue - y.vue || x.le - y.le
  })
}

/** `a` passe-t-il avant `b` ? Deux rangs se lisent de gauche à droite. */
function passeAvant(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/**
 * Les seize questions d'une épreuve, tirées dans la catégorie de son sentier
 * selon le mélange de son palier : jamais vues d'abord, puis les sous-thèmes
 * les moins servis, puis les déjà vues de la plus anciennement vue à la plus
 * récente (`parFraicheur`). Aux paliers « toute la catégorie », chaque
 * sous-thème passe d'abord, même par une question déjà vue : on ne valide
 * pas le stade sur le seul football — mais jamais par une question vue ces
 * dernières vingt-quatre heures, qui ne sort qu'en dernier recours, partout
 * (`VUE_RECENTE_MS`). Avant, un chapitre (`shared/chapitres.ts`) : ses
 * sous-thèmes passent devant le reste de la catégorie, même par une question
 * déjà vue — c'est son thème —, ses sous-thèmes servis à tour de rôle ; le
 * reste ne complète que ce que le thème n'a plus de frais. Une marche
 * épuisée de jamais vues reste sa marche : emprunter au voisin changerait la
 * difficulté du palier, que ses mélanges ont mesurée. Pas de vrai ou faux là
 * où le palier n'en veut pas. Dans le désordre : chaque question peut être
 * la difficile.
 */
export function tirerUneEpreuve(
  jouables: readonly QuestionDeLaBase[],
  regle: RegleDuPalier,
  vues: ReadonlyMap<string, number>,
  mesure: ReadonlyMap<string, { justes: number; total: number }>,
  maintenant: number,
  /** Les sous-thèmes du chapitre de ce palier (`chapitreDuPalier`) ; vide : aucun chapitre. */
  chapitre: readonly string[] = [],
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  const pool = regle.sansVraiFaux ? jouables.filter(q => q.reponses.length !== 2) : jouables
  if (pool.length < QUESTIONS_PAR_EPREUVE) throw new Error('Ce sentier n’a pas encore assez de questions : reviens bientôt')
  const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
  for (const q of melanger(pool)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
  const usage = new Map<string, number>()
  const prises = new Set<string>()
  const fraicheur = fraicheurDe(vues, maintenant)
  const duChapitre = regle.touteLaCategorie ? new Set<string>() : new Set(chapitre)
  // Le rang d'une question pour la place suivante — le plus petit gagne : une
  // vue d'hier soir en dernier, partout ; puis, aux paliers « toute la
  // catégorie », le sous-thème le moins servi avant la jamais vue ; dans un
  // chapitre, son thème avant tout le reste, puis la jamais vue, puis le
  // sous-thème le moins servi ; ailleurs, la jamais vue d'abord ; enfin la
  // plus anciennement vue.
  const rang = (q: QuestionDeLaBase): number[] => {
    const servi = usage.get(q.meta.sousTheme) ?? 0
    const f = fraicheur(q.id)
    if (regle.touteLaCategorie) return [f.recente, servi, f.vue, f.le]
    if (duChapitre.size > 0) return [f.recente, duChapitre.has(q.meta.sousTheme) ? 0 : 1, f.vue, servi, f.le]
    return [f.recente, f.vue, servi, f.le]
  }
  const tirees: { question: QuestionDeLaBase; niveau: Niveau }[] = []
  for (const [niveau, combien] of Object.entries(regle.melange) as [Niveau, number][]) {
    for (let i = 0; i < combien; i++) {
      for (const n of EMPRUNTS[niveau]) {
        let meilleure: QuestionDeLaBase | null = null
        let sonRang: number[] | null = null
        for (const q of parNiveau[n]) {
          if (prises.has(q.id)) continue
          const r = rang(q)
          if (!sonRang || passeAvant(r, sonRang)) {
            meilleure = q
            sonRang = r
            // Jamais vue, du thème, d'un sous-thème encore à servir : rien ne fera mieux.
            if (r.every(x => x === 0)) break
          }
        }
        if (meilleure) {
          prises.add(meilleure.id)
          usage.set(meilleure.meta.sousTheme, (usage.get(meilleure.meta.sousTheme) ?? 0) + 1)
          tirees.push({ question: meilleure, niveau: n })
          break
        }
      }
    }
  }
  return melanger(tirees)
}

/** Les sous-thèmes d'une catégorie, pour dire qu'une épreuve les couvre : le catalogue de l'étiquetage. */
export const sousThemesDe = (categorie: string): readonly string[] =>
  ((SOUS_THEMES as Record<string, readonly { cle: string }[]>)[categorie] ?? []).map(s => s.cle)

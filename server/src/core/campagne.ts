import { randomBytes, randomUUID } from 'node:crypto'
import type { InStatement, ResultSet } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from './distante'
import { BaseDeLaCampagne, entreeDeLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from './baseCampagne'
import {
  DEPOT_MAX,
  PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR,
  QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR,
  commandeDeLaCategorie,
  consigneDEcriture,
  empreintesDesLivres,
} from './consigneCampagne'
import { jourDe, minutesAvantMinuit } from '../../../shared/jour'
import { tronquer } from '../../../shared/avatars'
import { CATEGORIES } from '../../../shared/categories'
import { BRANCHES, branche as brancheParCle, deLaBranche, type CleDeBranche, type Paliers } from '../../../shared/branches'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import {
  NIVEAUX,
  QUESTIONS_PAR_SERIE,
  QUESTIONS_POUR_JOUER,
  SIGNALEMENT_MAX,
  VIES,
  niveauDeQuestion,
  ordreDeSerie,
  xpDeCampagne,
  xpDuJourDeCampagne,
  type AdminDeLaCampagne,
  type AjoutsDeLaRoutine,
  type CommandeDeLaBase,
  type DepotDeLaBase,
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type Niveau,
  type QuestionDeCampagne,
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
  epreuveFinie,
  etoilesDe,
  issueDe,
  regleDuPalier,
  sentierQuOnAvance,
  titreDeMaitre,
  viesDe,
  type AdminDesSentiers,
  type EpreuveDeSentier,
  type EtatDesSentiers,
  type IssueDEpreuve,
  type RegleDuPalier,
  type ReponseDEpreuve,
  type SentierDuJoueur,
  type SentiersDAccueil,
  type StatsDuPalier,
  type VieDesSentiers,
} from '../../../shared/sentiers'

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
  mode: 'serie' | 'sentier'
  /** L'épreuve d'un sentier : sa branche, son palier, son seuil figé au départ — un seuil réglé ensuite ne change pas une épreuve en cours. */
  branche: CleDeBranche | null
  palier: number | null
  seuil: number | null
  rejeu: boolean
  issue: IssueDEpreuve | null
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
 * celles qu'il a déjà vues. Sa difficulté part de l'estimation de l'écriture
 * et se corrige par les réponses de campagne (`niveauDeQuestion`).
 * Une bonne réponse y rapporte l'expérience d'une bonne réponse en soirée,
 * sans plafond (`xpDeCampagne`), dans sa ligne à part (`LIGNE_CAMPAGNE`) ;
 * et un confetti, comme au quiz du jour (`ProfileStore.justesDeCampagne`).
 */
export class CampagneStore {
  private client: Client
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
  /** Le dépôt et les ajouts ensemble, refaits quand un ajout arrive. */
  private fusion: { fichiers: BaseDeLaCampagne; ajouts: number; base: BaseDeLaCampagne } | null = null
  /** Les intitulés des quiz livrés, lus au premier dépôt : la base ne les reprend pas. */
  private livres: Set<string> | null = null
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
  private mesuresGardees: { a: number; parQuestion: Map<string, { justes: number; total: number }> } | null = null

  constructor(
    url: string,
    authToken?: string,
    opts: {
      maintenant?: () => number
      base?: BaseDeLaCampagne | (() => BaseDeLaCampagne)
      empreintesDuJour?: () => Promise<ReadonlySet<string>>
      ecrireXp?: (profileId: string, xp: number, jours: number) => Promise<unknown>
    } = {},
  ) {
    this.client = clientDistant(url, authToken)
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
   * La base qu'on joue : celle du dépôt, et ce que la routine y a ajouté.
   * Refaite seulement quand un ajout arrive — une série la lit à chaque
   * fois. Un ajout que le dépôt aurait rangé depuis (même identifiant, même
   * intitulé) n'y entre pas deux fois.
   */
  private async base(): Promise<BaseDeLaCampagne> {
    const fichiers = await this.fichiers()
    if (this.ajouts.length === 0) return fichiers
    const f = this.fusion
    if (f && f.fichiers === fichiers && f.ajouts === this.ajouts.length) return f.base
    const ids = new Set(fichiers.parId.keys())
    const enPlus = this.ajouts.map(a => a.question).filter(q => !ids.has(q.id) && !fichiers.empreintes.has(q.empreinte))
    const base = new BaseDeLaCampagne([...fichiers.questions, ...enPlus])
    this.fusion = { fichiers, ajouts: this.ajouts.length, base }
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
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT question_id FROM campagne_retraits',
        'SELECT entree, ajoutee_le FROM campagne_ajouts ORDER BY ajoutee_le',
      ],
      'write',
    )
    for (const r of resultats[resultats.length - 2].rows) this.retirees.add(String(r.question_id))
    let illisibles = 0
    for (const r of resultats[resultats.length - 1].rows) {
      // Relue par le juge du jour : une règle durcie depuis le dépôt l'écarte, comme une ligne du dépôt.
      const lu = (() => {
        try {
          return lireQuestionDeLaBase(JSON.parse(String(r.entree)))
        } catch {
          return { refus: 'JSON illisible' }
        }
      })()
      if ('refus' in lu) illisibles++
      else this.ajouts.push({ question: lu.question, ajouteeLe: Number(r.ajoutee_le) })
    }
    if (illisibles > 0) console.warn(`[campagne] ${illisibles} question(s) déposée(s) par la routine écartée(s) : le juge de la base ne les accepte plus`)
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
    const res = await this.client.execute('SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM campagne_reponses GROUP BY reserve_id')
    const parQuestion = new Map(res.rows.map(r => [String(r.reserve_id), { justes: Number(r.justes), total: Number(r.total) }]))
    this.mesuresGardees = { a: this.maintenant(), parQuestion }
    return parQuestion
  }

  /** Les questions de la base qu'un joueur a déjà vues en campagne : elles passent après les autres. */
  private async vuesPar(profileId: string): Promise<Set<string>> {
    const res = await this.client.execute({
      sql: `SELECT DISTINCT r.reserve_id FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id WHERE s.profile_id = ?`,
      args: [profileId],
    })
    return new Set(res.rows.map(r => String(r.reserve_id)))
  }

  async etat(profileId: string): Promise<EtatDeCampagne> {
    const [series, jouables, parJour, enCours] = await Promise.all([
      this.client.execute({
        sql: `SELECT COUNT(*) AS n, COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`,
        args: [profileId],
      }),
      this.jouables(),
      this.justesParJour(profileId),
      this.serieEnCours(profileId),
    ])
    return {
      record: Number(series.rows[0]?.record ?? 0),
      series: Number(series.rows[0]?.n ?? 0),
      xpAujourdhui: xpDuJourDeCampagne(parJour.get(jourDe(this.maintenant())) ?? 0),
      enCours: enCours ? vueDeSerie(enCours) : null,
      categories: parCategorie(jouables),
      questions: jouables.length,
    }
  }

  /**
   * Une série neuve — la précédente, laissée en route, s'arrête là. Chaque
   * marche tire d'abord parmi les questions que ce joueur n'a jamais vues :
   * il ne revoit une question qu'une fois toutes les autres de sa marche
   * passées, et la base en compte des milliers.
   */
  commencer(profileId: string, categories?: readonly string[]): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const [jouables, mesure, vues] = await Promise.all([this.jouables(categories), this.mesures(), this.vuesPar(profileId)])
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error(
          categories && categories.length > 0
            ? 'Pas assez de questions dans ces catégories : ajoutes-en une autre'
            : 'La campagne n’a pas encore de questions à poser : reviens bientôt',
        )
      }
      const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
      // Battues, puis les jamais vues devant : le tri garde le hasard de
      // chaque groupe, et chaque marche cet ordre.
      const battues = melanger(jouables).sort((a, b) => Number(vues.has(a.id)) - Number(vues.has(b.id)))
      for (const q of battues) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
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
      }
      const maintenant = this.maintenant()
      this.enCours.delete(profileId)
      await this.client.batch(
        [
          // La série laissée en route s'arrête : une seule à la fois. Une épreuve des sentiers, elle, attend.
          { sql: `UPDATE campagne_series SET finie_le = ? WHERE profile_id = ? AND finie_le IS NULL AND ${SERIES}`, args: [maintenant, profileId] },
          {
            sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le)
                  VALUES (?, ?, ?, 0, ?, 0, ?, NULL)`,
            args: [serie.id, profileId, JSON.stringify(questions), VIES, maintenant],
          },
        ],
        'write',
      )
      this.garderEnCours(serie)
      return vueDeSerie(serie)
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
      if (!s || s.mode !== 'serie') throw new Error('Cette série est introuvable')
      if (s.finieLe !== null) throw new Error('Cette série est finie : commence-en une autre')
      if (index !== s.index) throw new Error('Cette question est passée : la série a continué sans elle')
      const q = s.questions[s.index]
      const c = typeof choix === 'number' && Number.isInteger(choix) && choix >= 0 && choix < q.reponses.length ? choix : null
      const juste = c === q.bonne
      const vies = juste ? s.vies : s.vies - 1
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
      if (finie) lot.unshift({ sql: `SELECT COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL AND ${SERIES}`, args: [profileId] })
      if (juste) lot.push(lectureDesJustes(profileId))
      let res: ResultSet[]
      try {
        res = await this.client.batch(lot, 'write')
      } catch (e) {
        this.enCours.delete(profileId)
        throw e
      }
      if (finie) this.enCours.delete(profileId)
      else this.garderEnCours({ ...s, index: position, vies, justes })
      const avant = finie ? Number(res[0].rows[0]?.record ?? 0) : 0
      const xp = juste ? await this.crediter(profileId, justesParJourDe(res[res.length - 1].rows)) : 0
      return {
        juste,
        xp,
        bonne: q.bonne,
        anecdote: q.anecdote,
        vies,
        justes,
        finie,
        ...(finie && { recordAvant: avant, niveauAtteint: plusHaute(s.questions.slice(0, position)) }),
        ...(finie && justes > avant && { record: true }),
        ...(!finie && { suivante: questionMontree(s.questions[position], position) }),
      }
    })
  }

  /**
   * Une bonne réponse vient d'entrer : sa ligne d'expérience se relit en
   * entier, sous le verrou du profil où l'on est déjà. Rend ce que cette
   * réponse rapporte. Une base qui refuse d'écrire la ligne ne fait pas
   * échouer la réponse, déjà rangée : la bonne réponse suivante réécrit la
   * ligne entière.
   */
  private async crediter(profileId: string, parJour: Map<string, number>): Promise<number> {
    try {
      await this.ecrireXp(profileId, xpDeCampagne(parJour.values()), parJour.size)
      return xpDuJourDeCampagne(1)
    } catch (e) {
      console.error('[campagne] expérience non écrite, la prochaine bonne réponse la réécrira :', e)
      return 0
    }
  }

  /** « Mes réponses », une série finie : chaque question posée, sa bonne réponse, la sienne, et l'anecdote. */
  async correction(profileId: string, id: string): Promise<CorrectionDeCampagne[]> {
    const s = await this.serie(profileId, id)
    if (!s) throw new Error('Cette série est introuvable')
    // En cours, la correction donnerait les réponses de la question qu'on a sous les yeux.
    if (s.finieLe === null) throw new Error('La correction attend la fin de la série')
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

  /** Ses bonnes réponses en campagne, toutes séries comprises : ses confettis de campagne. */
  async justesDe(profileId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] })
    return Number(res.rows[0]?.n ?? 0)
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
      const questions = tirerUneEpreuve(jouables, regle, vues, mesure).map(x => versQuestionDeSerie(x.question, x.niveau))
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
      // Finie et validée : sa meilleure note d'avant sur ce palier, pour dire un record.
      if (finie && issue === 'validee') {
        lot.unshift({
          sql: `SELECT COALESCE(MAX(justes), 0) AS avant FROM campagne_series
                WHERE profile_id = ? AND mode = 'sentier' AND branche = ? AND palier = ? AND issue = 'validee' AND id <> ?`,
          args: [profileId, e.branche, e.palier, e.id],
        })
      }
      if (juste) lot.push(lectureDesJustes(profileId))
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
      const xp = juste ? await this.crediter(profileId, justesParJourDe(res[res.length - 1].rows)) : 0
      const reponse: ReponseDEpreuve = { juste, bonne: q.bonne, anecdote: q.anecdote, xp, epreuve: vueDEpreuve(apres) }
      if (finie && issue === 'validee') {
        const avant = Number(res[0].rows[0]?.avant ?? 0)
        reponse.etoiles = etoilesDe(justes, seuil)
        if (avant > 0 && justes > avant) reponse.record = true
        // Le palier vient d'être conquis (pas rejoué) : ce qu'il ouvre.
        if (!e.rejeu) {
          const regle = regleDuPalier(e.palier)
          const b = brancheParCle(e.branche)!
          if (regle?.avatar !== null && regle?.avatar !== undefined) reponse.avatar = b.portraits[regle.avatar].key
          if (regle?.maitre) reponse.maitre = titreDeMaitre(b)
        }
      }
      if (issue === 'ratee' && !e.rejeu) reponse.vies = await this.vies(profileId)
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
   * Les sentiers, côté administrateur : palier par palier, ce que les vraies
   * réponses disent — la part qui le valide du premier coup, les essais, les
   * vies perdues avant de le valider —, toutes branches ou une seule, sur
   * les trois derniers mois. Les rejeux n'y comptent pas : ils ne risquent
   * rien. De quoi régler un seuil sur des faits, pas sur une estimation.
   */
  async adminDesSentiers(cle: unknown): Promise<AdminDesSentiers> {
    const b = brancheParCle(cle) ?? null
    const maintenant = this.maintenant()
    const semaine = maintenant - 7 * 24 * HEURE_MS
    const [lignes, recentes, achetees] = await Promise.all([
      this.client.execute({
        sql: `SELECT profile_id, branche, palier, issue FROM campagne_series
              WHERE mode = 'sentier' AND rejeu = 0 AND issue IS NOT NULL AND commencee_le > ?${b ? ' AND branche = ?' : ''}
              ORDER BY commencee_le`,
        args: b ? [maintenant - STATS_DES_SENTIERS_MS, b.key] : [maintenant - STATS_DES_SENTIERS_MS],
      }),
      this.client.execute({
        sql: `SELECT COUNT(*) AS n, COUNT(DISTINCT profile_id) AS joueurs FROM campagne_series WHERE mode = 'sentier' AND commencee_le > ?${b ? ' AND branche = ?' : ''}`,
        args: b ? [semaine, b.key] : [semaine],
      }),
      this.viesAcheteesDepuis?.(semaine) ?? 0,
    ])
    // Les essais de chacun sur chaque palier, dans l'ordre : le premier dit « du premier coup ».
    const essais = new Map<string, IssueDEpreuve[]>()
    for (const r of lignes.rows) {
      const k = `${r.palier}|${r.profile_id}|${r.branche}`
      const liste = essais.get(k) ?? []
      liste.push(r.issue === 'validee' ? 'validee' : 'ratee')
      essais.set(k, liste)
    }
    const paliers: StatsDuPalier[] = PALIERS.map(regle => {
      const groupes = [...essais].filter(([k]) => k.startsWith(`${regle.n}|`)).map(([, liste]) => liste)
      const valides = groupes.filter(g => g.includes('validee'))
      return {
        palier: regle.n,
        joueurs: new Set([...essais.keys()].filter(k => k.startsWith(`${regle.n}|`)).map(k => k.split('|')[1])).size,
        essais: groupes.reduce((n, g) => n + g.length, 0),
        premierEssai: groupes.length > 0 ? groupes.filter(g => g[0] === 'validee').length / groupes.length : null,
        viesAvantDeValider: valides.length > 0 ? valides.reduce((n, g) => n + g.indexOf('validee'), 0) / valides.length : null,
      }
    })
    return {
      semaine: { joueurs: Number(recentes.rows[0]?.joueurs ?? 0), epreuves: Number(recentes.rows[0]?.n ?? 0), viesAchetees: achetees },
      branche: b?.key ?? null,
      paliers,
    }
  }

  // ── La routine du matin ─────────────────────────────────────────────────

  /**
   * Ce que la routine doit écrire aujourd'hui (Paris) : par catégorie,
   * combien encore — la commande moins ce qu'elle a déjà déposé, si elle
   * repasse —, les sous-thèmes et les difficultés qui manquent le plus
   * (`commandeDeLaCategorie`), et la consigne qu'elle donne à l'IA, avec les
   * intitulés déjà écrits dans ces sous-thèmes-là : la catégorie entière
   * ferait des consignes de plus en plus longues à mesure que la base grandit.
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
      return { categorie, aEcrire, quotas, consigne: consigneDEcriture(categorie, quotas, { sorte: 'routine' }, deja) }
    })
    return { aEcrire: categories.reduce((n, c) => n + c.aEcrire, 0), parEnvoi: DEPOT_MAX, categories }
  }

  /**
   * Le dépôt de la routine : chaque entrée relue par le juge de la base
   * (`lireQuestionDeLaBase`), comme une ligne du dépôt ; écartée, avec sa
   * raison, si elle est d'une autre catégorie, déjà dans la base, dans la
   * réserve du quiz du jour ou dans un quiz livré, ou si la catégorie a
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
                    : place <= 0
                      ? `la catégorie a reçu ses ${PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR} questions du jour`
                      : null
        if (motif) {
          ecartees.push({ texte, motif })
          continue
        }
        vues.add(q.empreinte)
        place--
        acceptees.push({ ...q, id: nouvelIdentifiant(ids) })
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
        for (const q of acceptees) this.ajouts.push({ question: q, ajouteeLe: maintenant })
      }
      return { ajoutees: acceptees.length, ecartees }
    })
  }

  /** Ce que la routine a ajouté : de quoi voir qu'elle tourne, et relire ses dernières questions. */
  private ajoutsDeLaRoutine(): AjoutsDeLaRoutine {
    const maintenant = this.maintenant()
    const aujourdhui = jourDe(maintenant)
    const derniers = this.ajouts.slice(-20).reverse()
    return {
      aujourdhui: this.ajouts.filter(a => jourDe(a.ajouteeLe) === aujourdhui).length,
      septJours: this.ajouts.filter(a => a.ajouteeLe > maintenant - 7 * 24 * HEURE_MS).length,
      total: this.ajouts.length,
      dernierLe: this.ajouts.at(-1)?.ajouteeLe ?? null,
      derniers: derniers.map(({ question: q, ajouteeLe }) => ({
        id: q.id,
        texte: q.texte,
        categorie: q.meta.categorie,
        sousTheme: q.meta.sousTheme,
        difficulte: q.meta.difficulte,
        ajouteeLe,
        retiree: this.retirees.has(q.id),
      })),
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

  /** Les questions signalées et pas encore relues, la plus récente d'abord : combien de joueurs, et ce qu'ils disent. */
  async signalements(): Promise<SignalementDeCampagne[]> {
    const res = await this.client.execute(
      `SELECT question_id, COUNT(*) AS n, MAX(cree_le) AS dernier, json_group_array(texte) AS textes
       FROM campagne_signalements WHERE traite_le IS NULL GROUP BY question_id ORDER BY dernier DESC LIMIT 50`,
    )
    const base = await this.base()
    return res.rows.flatMap(r => {
      const q = base.parId.get(String(r.question_id))
      if (!q) return []
      return [
        {
          questionId: q.id,
          texte: q.texte,
          reponses: q.reponses,
          bonne: q.bonne,
          anecdote: q.anecdote,
          categorie: q.meta.categorie,
          sousTheme: q.meta.sousTheme,
          joueurs: Number(r.n),
          textes: lireTextes(r.textes).slice(-3),
          dernier: Number(r.dernier),
        },
      ]
    })
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
   * Corrigée dans la base, elle reviendrait sous un nouvel identifiant.
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
      ajouts: this.ajoutsDeLaRoutine(),
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

/** Des heures aux jours de Paris : il change de jour à une heure pile, hiver comme été — une heure n'est jamais à cheval sur deux jours. */
function justesParJourDe(lignes: readonly Record<string, unknown>[]): Map<string, number> {
  const parJour = new Map<string, number>()
  for (const r of lignes) {
    const jour = jourDe(Number(r.heure) * HEURE_MS)
    parJour.set(jour, (parJour.get(jour) ?? 0) + Number(r.n))
  }
  return parJour
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
    mode: r.mode === 'sentier' ? 'sentier' : 'serie',
    branche: brancheParCle(r.branche)?.key ?? null,
    palier: r.palier === null || r.palier === undefined ? null : Number(r.palier),
    seuil: r.seuil === null || r.seuil === undefined ? null : Number(r.seuil),
    rejeu: Number(r.rejeu ?? 0) === 1,
    issue: r.issue === 'validee' || r.issue === 'ratee' ? r.issue : null,
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

function lireTextes(brut: unknown): string[] {
  try {
    const textes = JSON.parse(String(brut)) as unknown
    return Array.isArray(textes) ? textes.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
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
 * Les seize questions d'une épreuve, tirées dans la catégorie de son sentier
 * selon le mélange de son palier : jamais vues d'abord, puis les sous-thèmes
 * les moins servis. Aux paliers « toute la catégorie », chaque sous-thème
 * passe d'abord, même par une question déjà vue : on ne valide pas le stade
 * sur le seul football. Pas de vrai ou faux là où le palier n'en veut pas.
 * Dans le désordre : chaque question peut être la difficile.
 */
export function tirerUneEpreuve(
  jouables: readonly QuestionDeLaBase[],
  regle: RegleDuPalier,
  vues: ReadonlySet<string>,
  mesure: ReadonlyMap<string, { justes: number; total: number }>,
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  const pool = regle.sansVraiFaux ? jouables.filter(q => q.reponses.length !== 2) : jouables
  if (pool.length < QUESTIONS_PAR_EPREUVE) throw new Error('Ce sentier n’a pas encore assez de questions : reviens bientôt')
  const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
  for (const q of melanger(pool)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
  const usage = new Map<string, number>()
  const prises = new Set<string>()
  const score = (q: QuestionDeLaBase) => {
    const servi = usage.get(q.meta.sousTheme) ?? 0
    return (regle.touteLaCategorie ? servi * 10_000 : servi) + (vues.has(q.id) ? 1000 : 0)
  }
  const tirees: { question: QuestionDeLaBase; niveau: Niveau }[] = []
  for (const [niveau, combien] of Object.entries(regle.melange) as [Niveau, number][]) {
    for (let i = 0; i < combien; i++) {
      for (const n of EMPRUNTS[niveau]) {
        let meilleure: QuestionDeLaBase | null = null
        let sonScore = Infinity
        for (const q of parNiveau[n]) {
          if (prises.has(q.id)) continue
          const x = score(q)
          if (x < sonScore) {
            meilleure = q
            sonScore = x
            if (x === 0) break
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

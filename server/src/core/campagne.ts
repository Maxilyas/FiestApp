import { randomUUID } from 'node:crypto'
import { clientDistant, type Client } from './distante'
import { BaseDeLaCampagne, type QuestionDeLaBase } from './baseCampagne'
import { jourDe } from '../../../shared/jour'
import { tronquer } from '../../../shared/avatars'
import { CATEGORIES } from '../../../shared/categories'
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
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type Niveau,
  type QuestionDeCampagne,
  type ReponseDeCampagne,
  type SerieDeCampagne,
  type SignalementDeCampagne,
} from '../../../shared/campagne'

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
}

interface Serie {
  id: string
  profileId: string
  questions: QuestionDeSerie[]
  index: number
  vies: number
  justes: number
  finieLe: number | null
}

/** La difficulté mesurée se relit au plus toutes les dix minutes : elle bouge lentement, et chaque série la lit. */
const MESURES_GARDEES_MS = 10 * 60_000

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
  /** La base, lue à la première demande sans figer le serveur (`BaseDeLaCampagne.depuisLeDossier`) ; les tests en donnent une petite. */
  private base: () => Promise<BaseDeLaCampagne>
  /** Les intitulés de la réserve du quiz du jour (`JourStore.empreintes`) : la campagne n'en pose aucun. */
  private empreintesDuJour: () => Promise<ReadonlySet<string>>
  /** Écrit sa ligne d'expérience (`ProfileStore.ecrireXpDeCampagne`). */
  private ecrireXp: (profileId: string, xp: number, jours: number) => Promise<unknown>
  /** Les questions retirées après un signalement : la campagne ne les tire plus. Peu nombreuses, gardées en mémoire. */
  private retirees = new Set<string>()
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
    this.base =
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
   * Ses bonnes réponses de campagne, jour par jour (Paris) : de quoi relire
   * toute sa ligne d'expérience, et dire ce qu'aujourd'hui a rapporté. Relues
   * en entier à chaque fois : un total tenu à côté se serait perdu au premier
   * hoquet de la base, quand celui-ci se refait à la bonne réponse suivante.
   */
  private async justesParJour(profileId: string): Promise<Map<string, number>> {
    const res = await this.client.execute({
      sql: `SELECT r.repondue_le FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id WHERE s.profile_id = ? AND r.juste = 1`,
      args: [profileId],
    })
    const parJour = new Map<string, number>()
    for (const r of res.rows) {
      const jour = jourDe(Number(r.repondue_le))
      parJour.set(jour, (parJour.get(jour) ?? 0) + 1)
    }
    return parJour
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
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT question_id FROM campagne_retraits',
      ],
      'write',
    )
    for (const r of resultats[resultats.length - 1].rows) this.retirees.add(String(r.question_id))
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
        sql: 'SELECT COUNT(*) AS n, COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL',
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
      const serie: Serie = { id: randomUUID(), profileId, questions, index: 0, vies: VIES, justes: 0, finieLe: null }
      const maintenant = this.maintenant()
      await this.client.batch(
        [
          // La série laissée en route s'arrête : une seule à la fois.
          { sql: 'UPDATE campagne_series SET finie_le = ? WHERE profile_id = ? AND finie_le IS NULL', args: [maintenant, profileId] },
          {
            sql: `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le)
                  VALUES (?, ?, ?, 0, ?, 0, ?, NULL)`,
            args: [serie.id, profileId, JSON.stringify(questions), VIES, maintenant],
          },
        ],
        'write',
      )
      return vueDeSerie(serie)
    })
  }

  /** La série en cours de ce profil, s'il en a une. */
  async serieEnCours(profileId: string): Promise<Serie | null> {
    const res = await this.client.execute({
      sql: 'SELECT * FROM campagne_series WHERE profile_id = ? AND finie_le IS NULL ORDER BY commencee_le DESC LIMIT 1',
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
      const s = await this.serie(profileId, id)
      // Le voisin n'en sait pas plus (invariant 3) : la série d'un autre est introuvable.
      if (!s) throw new Error('Cette série est introuvable')
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
      // Le record se lit avant d'écrire la fin : battu, la fin le dit, et l'ancien avec.
      const avant = finie
        ? Number(
            (
              await this.client.execute({
                sql: 'SELECT COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL',
                args: [profileId],
              })
            ).rows[0]?.record ?? 0,
          )
        : 0
      await this.client.batch(
        [
          {
            sql: 'INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)',
            args: [s.id, s.index, q.id, c, juste ? 1 : 0, maintenant],
          },
          {
            sql: 'UPDATE campagne_series SET position = ?, vies = ?, justes = ?, finie_le = ? WHERE id = ?',
            args: [position, vies, justes, finie ? maintenant : null, s.id],
          },
        ],
        'write',
      )
      const xp = juste ? await this.crediter(profileId) : 0
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
  private async crediter(profileId: string): Promise<number> {
    try {
      const parJour = await this.justesParJour(profileId)
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

  /** Cet intitulé est-il dans la base ? La réserve du quiz du jour le refuse alors (`JourStore.dansLaCampagne`). */
  async dansLaBase(empreinte: string): Promise<boolean> {
    return (await this.base()).empreintes.has(empreinte)
  }

  /** Ses bonnes réponses en campagne, toutes séries comprises : ses confettis de campagne. */
  async justesDe(profileId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] })
    return Number(res.rows[0]?.n ?? 0)
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
      signalements,
    }
  }

  /** Un profil supprimé : ses séries, leurs réponses et ses signalements, sous son verrou. */
  oublierProfil(profileId: string): Promise<void> {
    return this.avecVerrou(profileId, async () => {
      await this.client.batch(
        [
          { sql: 'DELETE FROM campagne_reponses WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
          { sql: 'DELETE FROM campagne_series WHERE profile_id = ?', args: [profileId] },
          { sql: 'DELETE FROM campagne_signalements WHERE profile_id = ?', args: [profileId] },
        ],
        'write',
      )
    })
  }

  close() {
    this.client.close()
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
  }
}

/** Ce que le téléphone reçoit d'une question : jamais la bonne réponse ni l'anecdote avant la sienne. */
function questionMontree(q: QuestionDeSerie, index: number): QuestionDeCampagne {
  return { index, texte: q.texte, reponses: q.reponses, categorie: q.categorie, niveau: q.niveau }
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

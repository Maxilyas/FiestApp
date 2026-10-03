import { randomUUID } from 'node:crypto'
import { clientDistant, type Client } from './distante'
import { toPlayable, type QuizQuestionDef } from '../../../shared/library'
import { preparerPartie } from '../../../shared/hasard'
import { jourDe } from '../../../shared/jour'
import {
  QUESTIONS_PAR_SERIE,
  VIES,
  niveauMesure,
  ordreDeSerie,
  xpDeCampagne,
  xpDuJourDeCampagne,
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type Niveau,
  type QuestionDeCampagne,
  type ReponseDeCampagne,
  type SerieDeCampagne,
} from '../../../shared/campagne'

/** Une question de la série, telle que le serveur la garde : la bonne réponse avec. */
interface QuestionDeSerie {
  reserveId: string
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

/** Sous ce nombre de questions jouables, la campagne attend : une série de trois questions n'en est pas une. */
export const QUESTIONS_POUR_JOUER = 10

/**
 * La campagne solo (`shared/campagne.ts`) : ses séries, dans la base
 * permanente comme le quiz du jour — une série reprise demain sur un autre
 * téléphone retrouve sa question. Toute la règle est ici : le téléphone ne
 * reçoit jamais la bonne réponse avant d'avoir répondu (invariant 1), et
 * c'est le serveur qui compte les vies.
 *
 * Ses questions sont celles du quiz du jour déjà posées (`jour_reserve`,
 * `posee_le` passé) : relues, et mesurées sur les réponses des joueurs
 * (`jour_reponses`, rapportées à leur question par le tirage du jour).
 * Une bonne réponse y rapporte l'expérience d'une bonne réponse en soirée,
 * sans plafond (`xpDeCampagne`), dans sa ligne à part
 * (`LIGNE_CAMPAGNE`) ; et un confetti, comme au quiz du jour
 * (`ProfileStore.justesDeCampagne`).
 */
export class CampagneStore {
  private client: Client
  private maintenant: () => number
  private verrous = new Map<string, Promise<unknown>>()
  /** La part de joueurs qui ont trouvé chaque question posée (`JourStore.mesures`). */
  private mesurer: () => Promise<Map<string, { justes: number; total: number }>>
  /** Écrit sa ligne d'expérience (`ProfileStore.ecrireXpDeCampagne`). */
  private ecrireXp: (profileId: string, xp: number, jours: number) => Promise<unknown>

  constructor(
    url: string,
    authToken?: string,
    opts: {
      maintenant?: () => number
      mesures?: () => Promise<Map<string, { justes: number; total: number }>>
      ecrireXp?: (profileId: string, xp: number, jours: number) => Promise<unknown>
    } = {},
  ) {
    this.client = clientDistant(url, authToken)
    this.maintenant = opts.maintenant ?? Date.now
    this.mesurer = opts.mesures ?? (async () => new Map())
    this.ecrireXp = opts.ecrireXp ?? (async () => {})
  }

  /**
   * Ses bonnes réponses de campagne, jour par jour (Paris) : de quoi relire
   * toute sa ligne d'expérience, chaque journée plafonnée à part. Relues en
   * entier à chaque fois : un total tenu à côté se serait perdu au premier
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
    await this.client.batch(
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
        `CREATE TABLE IF NOT EXISTS campagne_reponses (
           serie_id    TEXT NOT NULL,
           position    INTEGER NOT NULL,
           reserve_id  TEXT NOT NULL,
           choix       INTEGER,
           juste       INTEGER NOT NULL,
           repondue_le INTEGER NOT NULL,
           PRIMARY KEY (serie_id, position)
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

  /** Les questions que la campagne peut poser : déjà sorties au quiz du jour, avant aujourd'hui. */
  private async jouables(categories?: readonly string[]) {
    const aujourdhui = jourDe(this.maintenant())
    const res = await this.client.execute({
      sql: `SELECT id, question, categorie FROM jour_reserve WHERE retiree_le IS NULL AND posee_le IS NOT NULL AND posee_le < ?`,
      args: [aujourdhui],
    })
    const filtre = categories && categories.length > 0 ? new Set(categories) : null
    return res.rows
      .map(r => ({ id: String(r.id), question: String(r.question), categorie: r.categorie == null ? null : String(r.categorie) }))
      .filter(r => !filtre || (r.categorie !== null && filtre.has(r.categorie)))
  }

  async etat(profileId: string): Promise<EtatDeCampagne> {
    const [series, jouables] = await Promise.all([
      this.client.execute({
        sql: 'SELECT COUNT(*) AS n, COALESCE(MAX(justes), 0) AS record FROM campagne_series WHERE profile_id = ? AND finie_le IS NOT NULL',
        args: [profileId],
      }),
      this.jouables(),
    ])
    const aujourdhui = (await this.justesParJour(profileId)).get(jourDe(this.maintenant())) ?? 0
    const parCategorie = new Map<string, number>()
    for (const j of jouables) if (j.categorie) parCategorie.set(j.categorie, (parCategorie.get(j.categorie) ?? 0) + 1)
    const enCours = await this.serieEnCours(profileId)
    return {
      record: Number(series.rows[0]?.record ?? 0),
      series: Number(series.rows[0]?.n ?? 0),
      xpAujourdhui: xpDuJourDeCampagne(aujourdhui),
      enCours: enCours ? vueDeSerie(enCours) : null,
      categories: [...parCategorie.entries()].sort((a, b) => b[1] - a[1]).map(([categorie, questions]) => ({ categorie, questions })),
      questions: jouables.length,
    }
  }

  /**
   * Une série neuve — la précédente, laissée en route, s'arrête là. Les
   * questions déjà vues en campagne passent après les autres : on ne refait
   * pas la même série à la suivante.
   */
  commencer(profileId: string, categories?: readonly string[]): Promise<SerieDeCampagne> {
    return this.avecVerrou(profileId, async () => {
      const [jouables, mesure, vues] = await Promise.all([
        this.jouables(categories),
        this.mesurer(),
        this.client.execute({
          sql: `SELECT DISTINCT r.reserve_id FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id WHERE s.profile_id = ?`,
          args: [profileId],
        }),
      ])
      if (jouables.length < QUESTIONS_POUR_JOUER) {
        throw new Error('Pas encore assez de questions pour une série : le quiz du jour en pose dix chaque jour, reviens demain')
      }
      const dejaVues = new Set(vues.rows.map(r => String(r.reserve_id)))
      const parNiveau: Record<Niveau, QuestionDeSerie[]> = { facile: [], moyen: [], difficile: [], expert: [] }
      // Battues d'abord, les jamais vues devant : chaque marche garde cet ordre.
      const battues = melanger(jouables).sort((a, b) => Number(dejaVues.has(a.id)) - Number(dejaVues.has(b.id)))
      for (const j of battues) {
        const p = toPlayable({ ...(JSON.parse(j.question) as QuizQuestionDef), id: j.id })
        if (!p || p.kind !== 'choice' || p.variante) continue
        const [copie] = preparerPartie([p], { melangerReponses: true }, Math.random)
        if (!copie || copie.kind !== 'choice') continue
        const m = mesure.get(j.id)
        const niveau = (m && niveauMesure(m.justes, m.total)) ?? 'moyen'
        parNiveau[niveau].push({
          reserveId: j.id,
          texte: copie.text,
          reponses: copie.answers,
          bonne: copie.correct,
          categorie: copie.category ?? null,
          anecdote: copie.anecdote ?? null,
          niveau,
        })
      }
      const questions = ordreDeSerie(parNiveau, QUESTIONS_PAR_SERIE).map(x => x.question)
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
      // Le record se lit avant d'écrire la fin : battu, la fin le dit.
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
            args: [s.id, s.index, q.reserveId, c, juste ? 1 : 0, maintenant],
          },
          {
            sql: 'UPDATE campagne_series SET position = ?, vies = ?, justes = ?, finie_le = ? WHERE id = ?',
            args: [position, vies, justes, finie ? maintenant : null, s.id],
          },
        ],
        'write',
      )
      const xp = juste ? await this.crediter(profileId, maintenant) : 0
      return {
        juste,
        xp,
        bonne: q.bonne,
        anecdote: q.anecdote,
        vies,
        justes,
        finie,
        ...(finie && justes > avant && { record: true }),
        ...(!finie && { suivante: questionMontree(s.questions[position], position) }),
      }
    })
  }

  /**
   * Une bonne réponse vient d'entrer : sa ligne d'expérience se relit en
   * entier, sous le verrou du profil où l'on est déjà. Rend ce que cette
   * réponse rapporte. Une base qui refuse
   * d'écrire la ligne ne fait pas échouer la réponse, déjà rangée : la
   * bonne réponse suivante réécrit la ligne entière.
   */
  private async crediter(profileId: string, maintenant: number): Promise<number> {
    try {
      const parJour = await this.justesParJour(profileId)
      const ceJour = parJour.get(jourDe(maintenant)) ?? 0
      await this.ecrireXp(profileId, xpDeCampagne(parJour.values()), parJour.size)
      return xpDuJourDeCampagne(ceJour) - xpDuJourDeCampagne(ceJour - 1)
    } catch (e) {
      console.error('[campagne] expérience non écrite, la prochaine bonne réponse la réécrira :', e)
      return 0
    }
  }

  /** « Mes réponses », une série finie : chaque question posée, sa bonne réponse et la sienne. */
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

  /** Ses bonnes réponses en campagne, toutes séries comprises : ses confettis de campagne. */
  async justesDe(profileId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'SELECT COALESCE(SUM(justes), 0) AS n FROM campagne_series WHERE profile_id = ?', args: [profileId] })
    return Number(res.rows[0]?.n ?? 0)
  }

  /** Un profil supprimé : ses séries et leurs réponses, sous son verrou. */
  oublierProfil(profileId: string): Promise<void> {
    return this.avecVerrou(profileId, async () => {
      await this.client.batch(
        [
          { sql: 'DELETE FROM campagne_reponses WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
          { sql: 'DELETE FROM campagne_series WHERE profile_id = ?', args: [profileId] },
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
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    questions: JSON.parse(String(r.questions)) as QuestionDeSerie[],
    index: Number(r.position),
    vies: Number(r.vies),
    justes: Number(r.justes),
    finieLe: r.finie_le === null || r.finie_le === undefined ? null : Number(r.finie_le),
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

function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}


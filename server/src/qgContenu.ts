import type { Express, RequestHandler } from 'express'
import type { JourStore } from './core/jour'
import type { CampagneStore } from './core/campagne'
import { wrap } from './core/http'
import { enTranches } from './core/tourniquet'
import { contenuDuCabinetEnTranches } from './core/cabinet/contenu'
import {
  CONTENU_GARDE_MS,
  JOURS_DES_QUESTIONS_DU_JOUR,
  cherchableDe,
  contenuDuCabinetAuQg,
  lireLeFiltre,
  questionsDuJourAuQg,
  questionsRetenuesEnTranches,
  totauxDesQuestionsEnTranches,
  unePage,
  type FiltreDesQuestions,
  type PageDesQuestions,
  type PageDesReserves,
  type QuestionAuQg,
  type TotauxDesQuestions,
} from '../../shared/qgContenu'

export interface ContenuDeps {
  jour: Pick<JourStore, 'questionsAuQg' | 'reserveAuQg'>
  campagne: Pick<CampagneStore, 'questionsAuQg' | 'baseAuQg'>
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
  /** Une routine remplit la réserve du quiz du jour : `RESERVE_TOKEN` est posé. */
  reserveAutomatique: boolean
}

/**
 * Une lecture gardée `CONTENU_GARDE_MS`, partagée par qui la demande pendant
 * qu'elle se fait — deux onglets du QG ne relisent pas deux fois — ; ratée,
 * elle ne se garde pas : la page suivante réessaie. Passée sa minute, elle
 * s'oublie d'elle-même : les questions jouées de toute la campagne — des
 * milliers d'objets — n'attendent pas en mémoire, dans les 512 Mo de
 * l'hébergeur, que l'administrateur revienne sur la page.
 */
class LectureGardee<T> {
  private garde: { a: number; lue: Promise<T> } | null = null

  constructor(private readonly maintenant: () => number) {}

  oublier(): void {
    this.garde = null
  }

  lire(faire: () => Promise<T>): Promise<T> {
    const maintenant = this.maintenant()
    if (this.garde && maintenant - this.garde.a < CONTENU_GARDE_MS) return this.garde.lue
    const garde = { a: maintenant, lue: faire() }
    this.garde = garde
    garde.lue.catch(() => {
      if (this.garde === garde) this.garde = null
    })
    // Une minuterie qui ne retient pas le processus : le serveur qui s'arrête ne l'attend pas.
    setTimeout(() => {
      if (this.garde === garde) this.garde = null
    }, CONTENU_GARDE_MS).unref()
    return garde.lue
  }
}

/** Une lecture des questions jouées, gardée : ses lignes, ses tuiles, et le dernier filtre qu'on y a demandé, trié. */
interface LesQuestions {
  lueLe: number
  lignes: QuestionAuQg[]
  totaux: TotauxDesQuestions
  /** Ce qu'une recherche lit de chacune, sans casse ni accents, calculé une fois par question. */
  cherchables: WeakMap<QuestionAuQg, string>
  /**
   * Le dernier filtre, sa page mise à part, et ses questions triées — en
   * tranches, partagées par qui les demande pendant qu'elles se font :
   * feuilleter ne trie pas tout de nouveau.
   */
  retenues: { cle: string; questions: Promise<QuestionAuQg[]> } | null
}

/**
 * Le contenu au QG (le QG 2, lot 7) : les questions jouées de la campagne et
 * du quiz du jour (`/admin#questions`), la réserve, la base et le contenu du
 * Cabinet (`/admin#reserves`). Chaque lecture se garde une minute
 * (`CONTENU_GARDE_MS`) — la page se trie, se filtre et se feuillette à chaque
 * toucher, et chaque fois relue, elle aurait refait des milliers de questions
 * et relu la réserve du jour —, et un geste du QG la fait oublier
 * (`oublierApresUnGeste`) : la page relue après « Retirer » ne montre plus la
 * question. Ce qui se relit le fait chez son magasin, par ses index ; ce qui
 * passe toute la base, en tranches.
 */
export class ContenuDuQg {
  private readonly questions: LectureGardee<LesQuestions>
  private readonly reserves: LectureGardee<PageDesReserves>

  constructor(private readonly deps: ContenuDeps) {
    this.questions = new LectureGardee(deps.maintenant)
    this.reserves = new LectureGardee(deps.maintenant)
  }

  /** Un geste a peut-être changé une question, la réserve ou la base : la lecture suivante repart de zéro. */
  oublier(): void {
    this.questions.oublier()
    this.reserves.oublier()
  }

  private lesQuestions(): Promise<LesQuestions> {
    return this.questions.lire(async () => {
      const lueLe = this.deps.maintenant()
      const [jour, campagne] = await Promise.all([this.deps.jour.questionsAuQg(), this.deps.campagne.questionsAuQg()])
      const lignes = [...questionsDuJourAuQg(jour), ...campagne]
      return { lueLe, lignes, totaux: await enTranches(totauxDesQuestionsEnTranches(lignes)), cherchables: new WeakMap(), retenues: null }
    })
  }

  /** La page des questions que demande l'adresse (`lireLeFiltre`) : les tuiles, puis une page de celles que le filtre retient. */
  async pageDesQuestions(brut: Record<string, unknown>): Promise<PageDesQuestions> {
    const filtre = lireLeFiltre(brut)
    const lues = await this.lesQuestions()
    const { page: _page, ...sansLaPage } = filtre
    const cle = JSON.stringify(sansLaPage)
    if (lues.retenues?.cle !== cle) {
      const cherchable = (q: QuestionAuQg) => {
        let c = lues.cherchables.get(q)
        if (c === undefined) lues.cherchables.set(q, (c = cherchableDe(q)))
        return c
      }
      lues.retenues = { cle, questions: enTranches(questionsRetenuesEnTranches(lues.lignes, filtre, cherchable)) }
    }
    // Les siennes, même si une autre demande a changé de filtre pendant le tri.
    const retenues = await lues.retenues.questions
    const { page, pages, lignes } = unePage(retenues, filtre.page)
    const compris: FiltreDesQuestions = { ...filtre, page }
    return {
      maintenant: this.deps.maintenant(),
      lueLe: lues.lueLe,
      totaux: lues.totaux,
      filtre: compris,
      total: retenues.length,
      pages,
      lignes,
      joursDuJour: JOURS_DES_QUESTIONS_DU_JOUR,
    }
  }

  /** La réserve du quiz du jour, la base de la campagne catégorie par marche, et le contenu neuf du Cabinet. */
  pageDesReserves(): Promise<PageDesReserves> {
    return this.reserves.lire(async () => {
      const [jour, campagne, cabinet] = await Promise.all([
        this.deps.jour.reserveAuQg(),
        this.deps.campagne.baseAuQg(),
        // Lu du disque une fois par processus, en tranches ; illisible, la page s'en passe.
        contenuDuCabinetEnTranches().then(contenuDuCabinetAuQg, () => null),
      ])
      return { maintenant: this.deps.maintenant(), jour: { ...jour, remplissage: { automatique: this.deps.reserveAutomatique } }, campagne, cabinet }
    })
  }
}

/**
 * Un geste de l'administrateur — corriger, reclasser, retirer, annuler, coller
 * une liste, supprimer un profil… — peut changer ce que les pages du contenu
 * montrent : toute écriture sous `/api/admin` oublie leur lecture gardée, à
 * son arrivée et à sa fin — une page relue pendant le geste aurait gardé
 * l'état d'avant une minute de plus. Les gestes sont rares : la page suivante
 * relit, c'est tout ce que ça coûte.
 */
export function oublierApresUnGeste(contenu: ContenuDuQg): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      contenu.oublier()
      res.on('finish', () => contenu.oublier())
    }
    next()
  }
}

/**
 * Les routes du contenu au QG, sous `/api/admin` (gardées d'un bloc avec les
 * autres, `api.ts`) : des lectures seulement — les gestes sont ceux de la page
 * des signalements, leurs routes à elles (`/api/admin/jour/…`,
 * `/api/admin/campagne/…`). Des soirées, rien : leurs questions sont aux
 * animateurs, et aucune réponse n'y nomme un joueur.
 */
export function mountContenuDuQg(app: Express, contenu: ContenuDuQg) {
  // Le filtre dans l'adresse : `?mode=jour&etat=pieges&mot=fleuve&tri=bonnes&sens=monte&page=2`.
  app.get(
    '/api/admin/questions',
    wrap(async (req, res) => {
      res.json(await contenu.pageDesQuestions(req.query as Record<string, unknown>))
    }),
  )
  app.get(
    '/api/admin/reserves',
    wrap(async (_req, res) => {
      res.json(await contenu.pageDesReserves())
    }),
  )
}

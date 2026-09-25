import type { Express, Response } from 'express'
import type { QuizStore } from './core/quizStore'
import type { Instantane, PartageStore } from './core/partages'
import { wrap } from './core/http'
import { accountOf, requireAdmin } from './auth/http'
import { titreLibre } from '../../shared/library'
import { STATUTS_AU_CATALOGUE, lireCode, type StatutAuCatalogue } from '../../shared/partage'

interface PartagesDeps {
  store: QuizStore
  partages: PartageStore
  onLibraryChanged: (spaceId: string) => Promise<void>
}

/**
 * Les essais manqués de « Recevoir par un code », par espace : dix par quart
 * d'heure. Six caractères parmi trente et un font près d'un milliard de
 * codes, et ce plafond en rend la devinette hors de portée.
 */
const ESSAIS_PAR_FENETRE = 10
const FENETRE_MS = 15 * 60 * 1000

/**
 * Les routes du partage (`core/partages.ts`), derrière la porte de l'API :
 * il faut être animateur connecté. L'espace est toujours celui de la session.
 */
export function mountPartages(app: Express, deps: PartagesDeps) {
  const spaceOf = (res: Response) => accountOf(res).id
  const manques = new Map<string, number[]>()
  const manquesRecents = (spaceId: string) => {
    const recents = (manques.get(spaceId) ?? []).filter(t => t > Date.now() - FENETRE_MS)
    manques.set(spaceId, recents)
    return recents
  }

  /** L'instantané d'un quiz de l'espace, ou null s'il n'est pas le sien. */
  const instantaneDe = async (spaceId: string, quizId: string): Promise<Instantane | null> => {
    const quiz = await deps.store.get(spaceId, quizId)
    return quiz && { titre: quiz.title, questions: quiz.questions, reglages: quiz.reglages ?? {} }
  }

  /** Une copie reçue — d'un code, du catalogue — rangée dans l'espace, photos recopiées. */
  const recevoirDans = async (spaceId: string, instantane: Instantane) => {
    const questions = await deps.store.copierPhotos(spaceId, instantane.questions)
    const titres = (await deps.store.list(spaceId)).map(q => q.title)
    const quiz = await deps.store.create(spaceId, titreLibre(instantane.titre, titres), questions, undefined, instantane.reglages)
    await deps.onLibraryChanged(spaceId)
    return quiz
  }

  // ── Un code, à quelqu'un ──

  app.post(
    '/api/quizzes/:id/partage',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const instantane = await instantaneDe(spaceId, req.params.id)
      if (!instantane) return res.status(404).json({ error: 'Quiz introuvable' })
      if (instantane.questions.length === 0) return res.status(400).json({ error: 'Ce quiz n’a encore aucune question à partager' })
      res.status(201).json(await deps.partages.partager(spaceId, req.params.id, instantane))
    }),
  )

  app.get(
    '/api/quizzes/:id/partages',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      if (!(await deps.store.get(spaceId, req.params.id))) return res.status(404).json({ error: 'Quiz introuvable' })
      res.json(await deps.partages.partagesDuQuiz(spaceId, req.params.id))
    }),
  )

  app.delete(
    '/api/partages/:code',
    wrap(async (req, res) => {
      const code = lireCode(req.params.code)
      if (!code || !(await deps.partages.revoquer(spaceOf(res), code))) return res.status(404).json({ error: 'Code introuvable' })
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/partages/recevoir',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      if (manquesRecents(spaceId).length >= ESSAIS_PAR_FENETRE) {
        return res.status(429).json({ error: 'Trop de codes essayés : réessaie dans un quart d’heure' })
      }
      const code = lireCode(typeof req.body?.code === 'string' ? req.body.code : '')
      const recu = code ? await deps.partages.recevoir(code) : null
      if (recu === null || recu === 'perime') {
        manquesRecents(spaceId).push(Date.now())
        return recu === 'perime'
          ? res.status(410).json({ error: 'Ce code a expiré ou a été annulé : demande-en un nouveau' })
          : res.status(404).json({ error: 'Ce code ne mène à aucun quiz : vérifie-le, lettre par lettre' })
      }
      res.status(201).json(await recevoirDans(spaceId, recu))
    }),
  )

  // ── Une copie, à tous : le catalogue ──

  app.post(
    '/api/quizzes/:id/catalogue',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const instantane = await instantaneDe(spaceId, req.params.id)
      if (!instantane) return res.status(404).json({ error: 'Quiz introuvable' })
      if (instantane.questions.length === 0) return res.status(400).json({ error: 'Ce quiz n’a encore aucune question à proposer' })
      const entree = await deps.partages.proposer(spaceId, req.params.id, accountOf(res).name, req.body?.description, instantane)
      res.status(201).json(entree)
    }),
  )

  /** Ce que « Partir d'un modèle » montre du catalogue : les copies publiées. */
  app.get(
    '/api/catalogue',
    wrap(async (_req, res) => {
      res.json(await deps.partages.catalogue('publie'))
    }),
  )

  app.post(
    '/api/catalogue/:id',
    wrap(async (req, res) => {
      const trouve = await deps.partages.entree(req.params.id)
      // Une copie qui n'est pas publiée n'existe pas pour les animateurs.
      if (!trouve || trouve.entree.statut !== 'publie') return res.status(404).json({ error: 'Quiz introuvable au catalogue' })
      res.status(201).json(await recevoirDans(spaceOf(res), trouve.instantane))
    }),
  )

  // ── L'administrateur relit, publie, refuse, retire ──

  app.get(
    '/api/admin/catalogue',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.partages.catalogue())
    }),
  )

  /** Les questions d'une copie proposée : l'administrateur la relit avant de la publier. */
  app.get(
    '/api/admin/catalogue/:id',
    requireAdmin,
    wrap(async (req, res) => {
      const trouve = await deps.partages.entree(req.params.id)
      if (!trouve) return res.status(404).json({ error: 'Entrée introuvable' })
      res.json({ ...trouve.entree, questions: trouve.instantane.questions })
    }),
  )

  app.post(
    '/api/admin/catalogue/:id',
    requireAdmin,
    wrap(async (req, res) => {
      const statut = req.body?.statut as StatutAuCatalogue
      if (!STATUTS_AU_CATALOGUE.includes(statut)) return res.status(400).json({ error: 'Statut inconnu' })
      if (!(await deps.partages.changerStatut(req.params.id, statut))) return res.status(404).json({ error: 'Entrée introuvable' })
      res.json({ ok: true })
    }),
  )
}

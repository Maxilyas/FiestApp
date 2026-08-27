import express, { type Express, type Request, type Response } from 'express'
import type { QuizStore } from './core/quizStore'

interface ApiDeps {
  store: QuizStore
  hostKey: string
  /** Appelé après chaque modification : recharge le cache lu par le module de jeu. */
  onLibraryChanged: () => Promise<void>
}

/** Express 4 n'attrape pas les rejets de promesse : on le fait ici. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
    fn(req, res).catch((e: Error) => {
      if (!res.headersSent) res.status(400).json({ error: e.message })
    })
  }

/**
 * API de la bibliothèque de quiz, utilisée par l'espace animateur (/edit).
 * Même clé secrète que l'écran commun — sauf les images, que les téléphones
 * des invités doivent pouvoir charger pendant la partie.
 */
export function mountApi(app: Express, deps: ApiDeps) {
  // Les photos arrivent en dataURL dans le corps JSON.
  app.use('/api', express.json({ limit: '4mb' }))

  app.use('/api', (req, res, next) => {
    const key = req.header('x-quizz-key') ?? (typeof req.query.key === 'string' ? req.query.key : '')
    if (key !== deps.hostKey) return res.status(401).json({ error: 'Clé incorrecte' })
    next()
  })

  app.get(
    '/api/quizzes',
    wrap(async (_req, res) => {
      res.json(await deps.store.list())
    }),
  )

  app.post(
    '/api/quizzes',
    wrap(async (req, res) => {
      const quiz = await deps.store.create(req.body?.title ?? 'Nouveau quiz', req.body?.questions ?? [])
      await deps.onLibraryChanged()
      res.status(201).json(quiz)
    }),
  )

  app.get(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const quiz = await deps.store.get(req.params.id)
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      res.json(quiz)
    }),
  )

  app.put(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const quiz = await deps.store.save(req.params.id, req.body?.title, req.body?.questions)
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged()
      res.json(quiz)
    }),
  )

  app.delete(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const ok = await deps.store.remove(req.params.id)
      if (!ok) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged()
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/quizzes/:id/duplicate',
    wrap(async (req, res) => {
      const quiz = await deps.store.duplicate(req.params.id)
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged()
      res.status(201).json(quiz)
    }),
  )

  app.post(
    '/api/images',
    wrap(async (req, res) => {
      const id = await deps.store.saveImage(req.body?.dataUrl)
      res.status(201).json({ url: `/media/image/${id}` })
    }),
  )

  // Public : les téléphones affichent les photos pendant la partie.
  app.get(
    '/media/image/:id',
    wrap(async (req, res) => {
      const image = await deps.store.getImage(req.params.id)
      if (!image) return res.status(404).end()
      // L'identifiant est unique et le contenu ne change jamais : cache long.
      res.set('Content-Type', image.mime)
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
      res.send(image.bytes)
    }),
  )
}

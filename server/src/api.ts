import express, { type Express } from 'express'
import type { QuizStore } from './core/quizStore'
import type { ArchiveStore } from './core/archive'
import type { AuthStore } from './auth/store'
import { wrap } from './core/http'
import { csrfGuard, requireAccount } from './auth/http'
import { mountAuthApi } from './auth/routes'

interface ApiDeps {
  store: QuizStore
  archives: ArchiveStore
  auth: AuthStore
  /** En ligne : cookie en HTTPS seulement, et origine des écritures contrôlée. */
  online: boolean
  /** L'origine publique de l'application, si on la connaît. */
  publicOrigin: string | null
  /** Appelé après chaque modification : recharge le cache lu par le module de jeu. */
  onLibraryChanged: () => Promise<void>
}

/**
 * API de la bibliothèque de quiz, utilisée par l'espace animateur (/edit),
 * et de l'historique. Il faut être connecté — sauf pour les images, que les
 * téléphones des invités doivent pouvoir charger pendant la partie.
 */
export function mountApi(app: Express, deps: ApiDeps) {
  // Dans l'ordre : la protection contre les requêtes forgées, les deux routes
  // publiques (se connecter, activer son compte), puis la porte — vérifiée
  // AVANT de lire le corps : sinon n'importe qui pouvait faire analyser
  // quatre mégaoctets de JSON au serveur sans être connecté.
  app.use('/api', csrfGuard({ online: deps.online, publicOrigin: deps.publicOrigin }))
  mountAuthApi(app, { auth: deps.auth, online: deps.online })
  app.use('/api', requireAccount(deps.auth))

  // Les photos arrivent en dataURL dans le corps JSON.
  app.use('/api', express.json({ limit: '4mb' }))

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
      // Après coup : une photo retirée d'une question n'a plus à occuper la base.
      deps.store.pruneImages().catch(() => {})
    }),
  )

  app.delete(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const ok = await deps.store.remove(req.params.id)
      if (!ok) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged()
      res.json({ ok: true })
      deps.store.pruneImages().catch(() => {})
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

  // L'historique se lit sans clé (/soirees.json) ; le renommer ou l'élaguer,
  // c'est l'animateur.
  app.put(
    '/api/soirees/:id',
    wrap(async (req, res) => {
      const title = String(req.body?.title ?? '').trim()
      if (!title) return res.status(400).json({ error: 'Il faut un titre' })
      const summary = await deps.archives.rename(req.params.id, title)
      if (!summary) return res.status(404).json({ error: 'Soirée introuvable' })
      res.json(summary)
    }),
  )

  app.delete(
    '/api/soirees/:id',
    wrap(async (req, res) => {
      const ok = await deps.archives.remove(req.params.id)
      if (!ok) return res.status(404).json({ error: 'Soirée introuvable' })
      res.json({ ok: true })
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

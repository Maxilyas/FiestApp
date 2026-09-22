import express, { type Express } from 'express'
import type { QuizStore } from './core/quizStore'
import type { ArchiveStore } from './core/archive'
import type { AuthStore } from './auth/store'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { accountOf, csrfGuard, requireAccount } from './auth/http'
import { mountAuthApi } from './auth/routes'
import { mountProfileApi } from './auth/profileRoutes'

interface ApiDeps {
  store: QuizStore
  archives: ArchiveStore
  auth: AuthStore
  /** Les profils des joueurs récurrents — rien à voir avec les comptes d'animateur. */
  profiles: ProfileStore
  /** En ligne : cookie en HTTPS seulement, et origine des écritures contrôlée. */
  online: boolean
  /** L'origine publique de l'application, si on la connaît. */
  publicOrigin: string | null
  /** Appelé après chaque modification : recharge le cache lu par le module de jeu. */
  onLibraryChanged: (spaceId: string) => Promise<void>
  /** Supprime un compte et tout ce qu'il a laissé — composé dans `createQuizServer`, où tout est à portée. */
  removeAccount: (accountId: string) => Promise<void>
}

/**
 * API de la bibliothèque de quiz, utilisée par l'espace animateur (/edit),
 * et de l'historique. Il faut être connecté — sauf pour les images, que les
 * téléphones des invités doivent pouvoir charger pendant la partie.
 *
 * L'espace n'est jamais lu dans la requête : c'est celui de la session. Un
 * identifiant de quiz ou de soirée qui n'est pas du sien vaut « introuvable ».
 */
export function mountApi(app: Express, deps: ApiDeps) {
  // Dans l'ordre : la protection contre les requêtes forgées, les deux routes
  // publiques (se connecter, activer son compte), puis la porte — vérifiée
  // AVANT de lire le corps : sinon n'importe qui pouvait faire analyser
  // quatre mégaoctets de JSON au serveur sans être connecté.
  app.use('/api', csrfGuard({ online: deps.online, publicOrigin: deps.publicOrigin }))
  mountAuthApi(app, { auth: deps.auth, online: deps.online, removeAccount: deps.removeAccount })
  // Les routes du profil joueur passent AVANT la porte : un invité n'a pas
  // de compte d'animateur, et n'a pas à en avoir un pour s'inscrire.
  mountProfileApi(app, { profiles: deps.profiles, auth: deps.auth, online: deps.online })
  app.use('/api', requireAccount(deps.auth))

  // Les photos arrivent en dataURL dans le corps JSON.
  app.use('/api', express.json({ limit: '4mb' }))

  /** L'espace de l'animateur connecté : celui de sa session, et pas un autre. */
  const spaceOf = (res: express.Response) => accountOf(res).id

  app.get(
    '/api/quizzes',
    wrap(async (_req, res) => {
      res.json(await deps.store.list(spaceOf(res)))
    }),
  )

  app.post(
    '/api/quizzes',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const quiz = await deps.store.create(spaceId, req.body?.title ?? 'Nouveau quiz', req.body?.questions ?? [])
      await deps.onLibraryChanged(spaceId)
      res.status(201).json(quiz)
    }),
  )

  app.get(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const quiz = await deps.store.get(spaceOf(res), req.params.id)
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      res.json(quiz)
    }),
  )

  app.put(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const quiz = await deps.store.save(spaceId, req.params.id, req.body?.title, req.body?.questions)
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged(spaceId)
      res.json(quiz)
      // Après coup : une photo retirée d'une question n'a plus à occuper la base.
      deps.store.pruneImages(spaceId).catch(() => {})
    }),
  )

  app.delete(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const ok = await deps.store.remove(spaceId, req.params.id)
      if (!ok) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged(spaceId)
      res.json({ ok: true })
      deps.store.pruneImages(spaceId).catch(() => {})
    }),
  )

  app.post(
    '/api/quizzes/:id/duplicate',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const quiz = await deps.store.duplicate(spaceId, req.params.id)
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged(spaceId)
      res.status(201).json(quiz)
    }),
  )

  app.post(
    '/api/images',
    wrap(async (req, res) => {
      const id = await deps.store.saveImage(spaceOf(res), req.body?.dataUrl)
      res.status(201).json({ url: `/media/image/${id}` })
    }),
  )

  // L'historique se lit sans session (/s/<espace>/soirees.json) ; le
  // renommer ou l'élaguer, c'est l'animateur — et seulement le sien.
  app.put(
    '/api/soirees/:id',
    wrap(async (req, res) => {
      const title = String(req.body?.title ?? '').trim()
      if (!title) return res.status(400).json({ error: 'Il faut un titre' })
      const summary = await deps.archives.rename(spaceOf(res), req.params.id, title)
      if (!summary) return res.status(404).json({ error: 'Soirée introuvable' })
      res.json(summary)
    }),
  )

  app.delete(
    '/api/soirees/:id',
    wrap(async (req, res) => {
      const ok = await deps.archives.remove(spaceOf(res), req.params.id)
      if (!ok) return res.status(404).json({ error: 'Soirée introuvable' })
      res.json({ ok: true })
    }),
  )

  // Public : les téléphones affichent les photos pendant la partie.
  // L'identifiant est un UUID impossible à deviner : c'est lui la clé.
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

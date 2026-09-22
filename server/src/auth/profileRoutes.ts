import express, { type Express } from 'express'
import { wrap } from '../core/http'
import type { ProfileStore } from './profiles'
import type { AuthStore } from './store'
import { dummyHash, passwordProblem } from './password'
import {
  LoginBudget,
  clearPlayerCookie,
  clientIp,
  readPlayerToken,
  setPlayerCookie,
} from './http'
import { Budget } from '../core/budget'

interface ProfileApiDeps {
  profiles: ProfileStore
  /** Pour dire chez qui une soirée passée s'est jouée, dans l'historique. */
  auth: AuthStore
  /** En ligne, le cookie ne voyage qu'en HTTPS. */
  online: boolean
}

/**
 * S'inscrire, se connecter, se relire : les routes du profil joueur.
 *
 * Rien ici n'est nécessaire pour jouer — l'invité anonyme ne passe par aucune
 * de ces routes et ne perd rien. Un profil ajoute de la mémoire, pas un droit
 * d'entrée.
 */
export function mountProfileApi(app: Express, deps: ProfileApiDeps) {
  const { profiles } = deps
  const small = express.json({ limit: '4kb' })
  const budget = new LoginBudget()
  /**
   * Les inscriptions par adresse. Plus serré que les connexions : on veut
   * qu'une tablée partage sans mal la même adresse en 4G, pas qu'un script
   * remplisse la base de profils fantômes.
   */
  const inscriptions = new Budget(10, 5, { skipLoopback: true })
  const noStore = (res: express.Response) => res.set('Cache-Control', 'no-store')
  /** « Chez Bob » plutôt qu'un identifiant, dans l'historique des soirées. */
  const nomDEspace = (spaceId: string) => deps.auth.byId(spaceId)?.name ?? null

  /** Le profil connecté derrière le cookie, ou null. */
  const current = async (req: express.Request) => {
    const token = readPlayerToken(req.header('cookie'))
    return token ? profiles.bySession(token) : null
  }

  const openSession = async (req: express.Request, res: express.Response, profileId: string) => {
    const token = await profiles.createSession(profileId, req.header('user-agent') ?? '')
    setPlayerCookie(res, token, deps.online)
  }

  app.post(
    '/api/joueur/inscription',
    small,
    wrap(async (req, res) => {
      noStore(res)
      if (!inscriptions.take(clientIp(req))) {
        return res.status(429).json({ error: 'Trop d’inscriptions d’un coup — réessaie dans une minute' })
      }
      const problem = passwordProblem(req.body?.password)
      if (problem) return res.status(400).json({ error: problem })
      const { profile, recovery } = await profiles.register({
        login: req.body?.login,
        password: req.body.password,
        name: req.body?.name,
        avatar: req.body?.avatar,
      })
      await openSession(req, res, profile.id)
      // Le code de secours ne repassera jamais par ici : c'est la seule fois
      // où il existe en clair, et la page doit le dire clairement.
      res.status(201).json({ profile: profiles.toPublic(profile), recovery })
    }),
  )

  app.post(
    '/api/joueur/connexion',
    small,
    wrap(async (req, res) => {
      noStore(res)
      const login = String(req.body?.login ?? '').trim().toLowerCase()
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      const ip = clientIp(req)
      if (!budget.allow(ip, `joueur:${login}`)) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      const found = await profiles.verify(login, password, await dummyHash())
      if (!found) {
        budget.failed(`joueur:${login}`)
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
      }
      budget.succeeded(`joueur:${login}`)
      await openSession(req, res, found.id)
      await profiles.touchSeen(found.id)
      res.json({ profile: profiles.toPublic(found) })
    }),
  )

  app.post(
    '/api/joueur/deconnexion',
    wrap(async (req, res) => {
      const token = readPlayerToken(req.header('cookie'))
      if (token) await profiles.revokeSession(token)
      clearPlayerCookie(res)
      res.json({ ok: true })
    }),
  )

  // Le profil connecté. Sans cookie, ce n'est pas une erreur : c'est juste un
  // invité anonyme, et la page d'inscription doit pouvoir le demander sans
  // rien afficher de fâcheux.
  app.get(
    '/api/joueur/moi',
    wrap(async (req, res) => {
      noStore(res)
      const me = await current(req)
      // Sa propre page a droit au détail : l'étagère à badges et l'historique.
      res.json({ profile: me ? await profiles.toDetail(me, nomDEspace) : null })
    }),
  )

  app.put(
    '/api/joueur/moi',
    small,
    wrap(async (req, res) => {
      noStore(res)
      const me = await current(req)
      if (!me) return res.status(401).json({ error: 'Connexion requise' })
      const updated = await profiles.update(me.id, {
        name: req.body?.name,
        avatar: req.body?.avatar,
        finition: req.body?.finition,
      })
      res.json({ profile: profiles.toPublic(updated) })
    }),
  )

  app.post(
    '/api/joueur/mot-de-passe',
    small,
    wrap(async (req, res) => {
      noStore(res)
      const me = await current(req)
      if (!me) return res.status(401).json({ error: 'Connexion requise' })
      const problem = passwordProblem(req.body?.next)
      if (problem) return res.status(400).json({ error: problem })
      await profiles.setPassword(me.id, req.body.next)
      await profiles.revokeAll(me.id)
      await openSession(req, res, me.id)
      res.json({ ok: true })
    }),
  )

  // Le code de secours : la seule porte de retour, faute d'adresse e-mail.
  // Il se consomme, et on en rend un neuf — sinon un code recopié une fois
  // resterait bon pour toujours.
  app.post(
    '/api/joueur/secours',
    small,
    wrap(async (req, res) => {
      noStore(res)
      const login = String(req.body?.login ?? '').trim().toLowerCase()
      const ip = clientIp(req)
      if (!budget.allow(ip, `secours:${login}`)) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      const problem = passwordProblem(req.body?.password)
      if (problem) return res.status(400).json({ error: problem })
      const recovery = await profiles.useRecovery(login, req.body?.code, req.body.password, await dummyHash())
      if (!recovery) {
        budget.failed(`secours:${login}`)
        return res.status(400).json({ error: 'Identifiant ou code de secours incorrect' })
      }
      budget.succeeded(`secours:${login}`)
      const found = await profiles.byLogin(login)
      if (found) await openSession(req, res, found.id)
      res.json({ recovery, profile: found ? profiles.toPublic(found) : null })
    }),
  )
}

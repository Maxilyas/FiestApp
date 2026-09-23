import express, { type Express } from 'express'
import { wrap } from '../core/http'
import type { AuthStore } from './store'
import type { ProfileStore } from './profiles'
import { dummyHash, passwordProblem, verifyPassword } from './password'
import {
  accountOf,
  clearSessionCookie,
  clientIp,
  loginBudgetOf,
  requireAccount,
  requireAdmin,
  sessionOf,
  setSessionCookie,
} from './http'
import { normalizeLogin } from '../../../shared/space'

interface AuthApiDeps {
  auth: AuthStore
  /** Les profils joueurs : un animateur y rattache le sien pour n'avoir qu'une porte. */
  profiles: ProfileStore
  /** En ligne, le cookie ne voyage qu'en HTTPS. */
  online: boolean
  /** Supprime un compte et tout ce qu'il a laissé (voir `createQuizServer`). */
  removeAccount: (accountId: string) => Promise<void>
}

/**
 * Se connecter, activer son compte, changer de mot de passe ; et pour
 * l'administrateur, créer et gérer les comptes des autres.
 *
 * Deux routes sont publiques : la connexion et l'activation. Elles lisent un
 * corps minuscule et passent par la limite d'essais. Tout le reste exige
 * une session — vérifiée avant de lire quoi que ce soit.
 */
export function mountAuthApi(app: Express, deps: AuthApiDeps) {
  const { auth } = deps
  const small = express.json({ limit: '8kb' })
  // La même réserve que les portes du profil : elles ouvrent la même console.
  const budget = loginBudgetOf(app)
  const account = requireAccount(auth)
  const noStore = (res: express.Response) => res.set('Cache-Control', 'no-store')

  /** Ouvre une session pour ce compte et pose le cookie. */
  const openSession = async (req: express.Request, res: express.Response, accountId: string) => {
    const token = await auth.createSession(accountId, req.header('user-agent') ?? '')
    setSessionCookie(res, token, deps.online)
  }

  app.post(
    '/api/auth/login',
    small,
    wrap(async (req, res) => {
      noStore(res)
      const login = normalizeLogin(req.body?.login)
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      const ip = clientIp(req)
      // Préfixée : la réserve est commune avec les portes du profil, et un
      // identifiant de compte ne doit pas pouvoir tomber sur la clé d'un profil.
      const cle = `compte:${login}`
      if (!budget.allow(ip, cle)) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      const found = auth.byLogin(login)
      // Un identifiant inconnu coûte le même temps qu'un mot de passe faux :
      // rien, pas même la durée, ne dit si le compte existe.
      const ok = await verifyPassword(password, found?.passwordHash ?? (await dummyHash()))
      if (!found || !found.passwordHash || found.disabledAt || !ok) {
        budget.failed(cle)
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
      }
      budget.succeeded(cle)
      await openSession(req, res, found.id)
      await auth.touchLogin(found.id)
      res.json({ account: auth.toPublic(found), space: auth.publicSpace(found) })
    }),
  )

  app.post(
    '/api/auth/logout',
    account,
    wrap(async (_req, res) => {
      await auth.revokeSession(sessionOf(res))
      clearSessionCookie(res)
      res.json({ ok: true })
    }),
  )

  app.get(
    '/api/auth/me',
    account,
    wrap(async (_req, res) => {
      const me = accountOf(res)
      const profil = me.profileId ? await deps.profiles.byId(me.profileId) : null
      res.json({
        account: auth.toPublic(me),
        space: auth.publicSpace(me),
        profil: profil ? deps.profiles.toPublic(profil) : null,
      })
    }),
  )

  // Le lien d'activation : le jeton arrive dans le corps (la page l'a lu dans
  // le fragment de l'adresse), avec le mot de passe choisi.
  //
  // Seule la réserve de l'adresse compte ici, sans verrou d'échecs. Les
  // échecs étaient comptés sous une clé unique, « activation », que rien ne
  // remettait à zéro : cinq liens périmés, venus de n'importe qui et à
  // n'importe quel moment, fermaient toutes les activations et toutes les
  // réinitialisations du serveur pendant un quart d'heure. Et un verrou par
  // adresse ne protégerait rien de plus — un jeton de 256 bits ne se devine
  // pas — tout en refusant son nouveau lien à qui a recliqué cinq fois
  // l'ancien, ou à une tablée qui partage la même adresse.
  app.post(
    '/api/auth/activate',
    small,
    wrap(async (req, res) => {
      noStore(res)
      if (!budget.allow(clientIp(req))) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      const problem = passwordProblem(req.body?.password)
      if (problem) return res.status(400).json({ error: problem })
      const found = await auth.consumeActivation(String(req.body?.token ?? ''))
      if (!found) {
        return res.status(400).json({ error: 'Lien invalide ou expiré — demande un nouveau lien à l’administrateur' })
      }
      await auth.setPassword(found.id, req.body.password)
      await auth.revokeAllSessions(found.id)
      await openSession(req, res, found.id)
      await auth.touchLogin(found.id)
      res.json({ account: auth.toPublic(found), space: auth.publicSpace(found) })
    }),
  )

  app.post(
    '/api/auth/password',
    account,
    small,
    wrap(async (req, res) => {
      const me = accountOf(res)
      const current = typeof req.body?.current === 'string' ? req.body.current : ''
      // Une session volée — un portable resté ouvert sur « Mon compte » — ne
      // doit pas pouvoir essayer des mots de passe sans limite : c'est la même
      // réserve et la même clé que la connexion, qui se ferment ensemble.
      const cle = `compte:${me.login}`
      if (!budget.allow(clientIp(req), cle)) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      if (!(await verifyPassword(current, me.passwordHash))) {
        budget.failed(cle)
        return res.status(400).json({ error: 'Le mot de passe actuel ne correspond pas' })
      }
      budget.succeeded(cle)
      const problem = passwordProblem(req.body?.next)
      if (problem) return res.status(400).json({ error: problem })
      await auth.setPassword(me.id, req.body.next)
      // Toutes les sessions se ferment, y compris celle-ci — puis on en rouvre une.
      await auth.revokeAllSessions(me.id)
      await openSession(req, res, me.id)
      res.json({ ok: true })
    }),
  )

  /**
   * Rattacher son profil joueur à son espace, ou l'en détacher.
   *
   * Il faut prouver les deux identités pour les lier : la session
   * d'animateur d'un côté, l'identifiant et le mot de passe du profil de
   * l'autre. Après quoi une seule des deux portes suffit — c'est tout
   * l'intérêt — mais cette première fois-là, non.
   */
  app.post(
    '/api/space/profil',
    account,
    small,
    wrap(async (req, res) => {
      noStore(res)
      const me = accountOf(res)
      const login = normalizeLogin(req.body?.login)
      const ip = clientIp(req)
      // Le même verrou que `/api/joueur/connexion` : c'est le même mot de
      // passe qu'on vérifie, et deux clés doublaient les essais contre lui.
      const cle = `joueur:${login}`
      if (!budget.allow(ip, cle)) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      const found = await deps.profiles.verify(login, password, await dummyHash())
      if (!found) {
        budget.failed(cle)
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
      }
      budget.succeeded(cle)
      const autre = auth.byProfile(found.id)
      if (autre && autre.id !== me.id) {
        return res.status(400).json({ error: 'Ce profil anime déjà une autre soirée' })
      }
      // Rattacher un autre profil ferme les consoles de l'ancien — sauf celle-ci.
      await auth.linkProfile(me.id, found.id, sessionOf(res))
      res.json({ profil: deps.profiles.toPublic(found) })
    }),
  )

  app.delete(
    '/api/space/profil',
    account,
    wrap(async (_req, res) => {
      noStore(res)
      await auth.linkProfile(accountOf(res).id, null, sessionOf(res))
      res.json({ profil: null })
    }),
  )

  app.put(
    '/api/space/settings',
    account,
    small,
    wrap(async (req, res) => {
      const me = await auth.updateSettings(accountOf(res).id, req.body)
      res.json({ space: auth.publicSpace(me) })
    }),
  )

  // ── Administration ──────────────────────────────────────────────────────

  app.get(
    '/api/admin/accounts',
    account,
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(auth.list().map(a => auth.toPublic(a)))
    }),
  )

  app.post(
    '/api/admin/accounts',
    account,
    requireAdmin,
    small,
    wrap(async (req, res) => {
      const created = await auth.create({ login: req.body?.login, name: req.body?.name, slug: req.body?.slug })
      const activation = await auth.createActivation(created.id)
      res.status(201).json({ account: auth.toPublic(created), activation })
    }),
  )

  app.post(
    '/api/admin/accounts/:id/activation',
    account,
    requireAdmin,
    wrap(async (req, res) => {
      const target = auth.byId(req.params.id)
      if (!target) return res.status(404).json({ error: 'Compte introuvable' })
      res.json({ activation: await auth.createActivation(target.id) })
    }),
  )

  app.post(
    '/api/admin/accounts/:id/disable',
    account,
    requireAdmin,
    wrap(async (req, res) => {
      const target = auth.byId(req.params.id)
      if (!target) return res.status(404).json({ error: 'Compte introuvable' })
      if (target.id === accountOf(res).id) return res.status(400).json({ error: 'Pas ton propre compte' })
      res.json({ account: auth.toPublic(await auth.setDisabled(target.id, true)) })
    }),
  )

  app.post(
    '/api/admin/accounts/:id/enable',
    account,
    requireAdmin,
    wrap(async (req, res) => {
      const target = auth.byId(req.params.id)
      if (!target) return res.status(404).json({ error: 'Compte introuvable' })
      res.json({ account: auth.toPublic(await auth.setDisabled(target.id, false)) })
    }),
  )

  app.put(
    '/api/admin/accounts/:id',
    account,
    requireAdmin,
    small,
    wrap(async (req, res) => {
      const target = auth.byId(req.params.id)
      if (!target) return res.status(404).json({ error: 'Compte introuvable' })
      const updated = await auth.update(target.id, { name: req.body?.name, slug: req.body?.slug })
      res.json({ account: auth.toPublic(updated) })
    }),
  )

  // Supprimer un compte : seulement désactivé (c'est le pas de recul), jamais
  // le sien, jamais l'espace par défaut — c'est chez lui que mènent les
  // anciennes adresses. Tout ce qu'il a laissé part avec lui.
  app.delete(
    '/api/admin/accounts/:id',
    account,
    requireAdmin,
    wrap(async (req, res) => {
      const target = auth.byId(req.params.id)
      if (!target) return res.status(404).json({ error: 'Compte introuvable' })
      if (target.id === accountOf(res).id) return res.status(400).json({ error: 'Pas ton propre compte' })
      if (target.id === auth.defaultSpaceId) {
        return res.status(400).json({ error: 'L’espace par défaut ne se supprime pas : les anciennes adresses mènent chez lui' })
      }
      if (!target.disabledAt) return res.status(400).json({ error: 'Désactive d’abord le compte' })
      await deps.removeAccount(target.id)
      res.json({ ok: true })
    }),
  )
}

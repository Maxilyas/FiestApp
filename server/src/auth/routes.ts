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
  refuserLesTeles,
  requireAccount,
  requireAdmin,
  sessionOf,
  setSessionCookie,
  readPlayerToken,
} from './http'
import type { AccountRec } from './store'
import { normalizeLogin } from '../../../shared/space'
import type { ProfilDeLEspace } from '../../../shared/profil'

interface AuthApiDeps {
  auth: AuthStore
  /** Les profils joueurs : un animateur y rattache le sien pour n'avoir qu'une porte. */
  profiles: ProfileStore
  /** En ligne, le cookie ne voyage qu'en HTTPS. */
  online: boolean
  /** Supprime un compte et tout ce qu'il a laissé (voir `createQuizServer`). */
  removeAccount: (accountId: string, opts?: { reprendre?: boolean }) => Promise<void>
  /** Les réglages d'un espace ont changé : sa salle doit les recevoir. */
  espaceChange: (accountId: string) => void
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
  const pasDeTele = refuserLesTeles(auth)

  /**
   * Le profil qui tient l'espace, tel que « Mon compte » le montre — rien de
   * plus. Toute session du compte lit cette page, la télé branchée chez un
   * tiers comprise : le profil au complet y portait le récit de ses Divins,
   * que l'invariant 21 réserve à leur seul porteur.
   */
  const profilDeLEspace = (p: Parameters<ProfileStore['toPublic']>[0]): ProfilDeLEspace => {
    const { login, name, avatar, finition, eclats, legendaire, niveau } = deps.profiles.toPublic(p)
    return { login, name, avatar, finition, eclats, legendaire, niveau }
  }

  /**
   * Changer le profil qui tient l'espace — le remplacer, le détacher —
   * demande une preuve fraîche : le mot de passe de ce profil, ou celui du
   * compte. Une session ne suffit plus : le téléphone prêté, dont le cookie
   * du profil ouvre la console sans rien redemander, y rattachait le profil
   * de l'emprunteur, qui gardait ensuite la console pour lui. L'essai compte
   * contre les deux secrets, sous les clés de leurs connexions : changer de
   * porte ne double pas les essais contre eux.
   */
  const prouver = async (
    req: express.Request,
    me: AccountRec,
  ): Promise<{ ok: true } | { ok: false; statut: number; error: string }> => {
    const preuve = typeof req.body?.preuve === 'string' ? req.body.preuve : ''
    // Rien à vérifier n'est pas un essai, comme au changement de mot de passe.
    if (!preuve) return { ok: false, statut: 400, error: 'Tape le mot de passe du profil rattaché — ou celui du compte' }
    const lie = me.profileId ? await deps.profiles.byId(me.profileId).catch(() => null) : null
    const cles = [`compte:${me.login}`, ...(lie ? [`joueur:${lie.login}`] : [])]
    const ip = clientIp(req)
    for (const [i, cle] of cles.entries()) {
      if (budget.allow(ip, cle)) continue
      for (const prise of cles.slice(0, i)) budget.abandon(prise)
      return { ok: false, statut: 429, error: 'Trop d’essais — réessaie dans un quart d’heure' }
    }
    const parLeCompte = !!me.passwordHash && (await verifyPassword(preuve, me.passwordHash))
    const parLeProfil = !parLeCompte && !!lie && (await verifyPassword(preuve, lie.passwordHash))
    if (!parLeCompte && !parLeProfil) {
      for (const cle of cles) budget.failed(cle)
      return { ok: false, statut: 400, error: 'Ce n’est ni le mot de passe du profil rattaché, ni celui du compte' }
    }
    for (const [i, cle] of cles.entries()) {
      if ((i === 0) === parLeCompte) budget.succeeded(cle)
      else budget.abandon(cle)
    }
    return { ok: true }
  }

  /** Ouvre une session pour ce compte et pose le cookie. */
  const openSession = async (req: express.Request, res: express.Response, accountId: string) => {
    const token = await auth.createSession(accountId, req.header('user-agent') ?? '')
    setSessionCookie(res, token, deps.online)
    return token
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
      const verifie = found?.passwordHash
      // Un identifiant inconnu coûte le même temps qu'un mot de passe faux :
      // rien, pas même la durée, ne dit si le compte existe.
      const ok = await verifyPassword(password, verifie ?? (await dummyHash()))
      if (!found || !found.passwordHash || !ok) {
        budget.failed(cle)
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
      }
      // Le bon mot de passe, sur un compte en pause : le dire. « Incorrect »
      // faisait retaper un mot de passe juste, puis réveiller l'administrateur
      // pour un lien qui n'y changeait rien. Ne l'apprend que qui connaît
      // déjà le mot de passe.
      if (found.disabledAt) {
        budget.abandon(cle)
        return res.status(403).json({ error: 'Ton compte est en pause : demande à l’administrateur de le réactiver' })
      }
      budget.succeeded(cle)
      const jeton = await openSession(req, res, found.id)
      // Un changement de mot de passe parti pendant qu'on vérifiait ferme les
      // sessions qu'il connaît, pas celle qu'on vient d'ouvrir : le haché a
      // bougé, l'ancien mot de passe ne vaut plus rien.
      if (auth.byId(found.id)?.passwordHash !== verifie) {
        const ouverte = auth.resolveSession(jeton)
        if (ouverte) await auth.revokeSession(ouverte.session.id)
        clearSessionCookie(res)
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
      }
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
        profil: profil ? profilDeLEspace(profil) : null,
      })
    }),
  )

  // Lire un lien avant de s'en servir : l'identifiant et l'espace qu'il
  // ouvre, pour les dire sur la page — et au gestionnaire de mots de passe,
  // qui range le mot de passe choisi sous cet identifiant.
  // Comme l'activation, sans verrou d'échecs : la réserve de l'adresse suffit.
  app.post(
    '/api/auth/activation',
    small,
    wrap(async (req, res) => {
      noStore(res)
      if (!budget.allow(clientIp(req))) {
        return res.status(429).json({ error: 'Trop d’essais — réessaie dans un quart d’heure' })
      }
      const lu = await auth.lireActivation(String(req.body?.token ?? ''))
      if (!lu) return res.status(404).json({ error: 'Lien invalide — demande un nouveau lien à l’administrateur' })
      // Le compte ne se dit qu'à un lien qui sert encore : servi ou expiré, un
      // lien qui traîne dans une messagerie ne vaut plus rien, et ne doit pas
      // donner la moitié des identifiants. Qui l'a servi connaît son identifiant.
      if (lu.etat !== 'valide') return res.json({ etat: lu.etat })
      res.json({ login: lu.account.login, name: lu.account.name, slug: lu.account.slug, etat: lu.etat })
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
   * l'intérêt — mais cette première fois-là, non. Le profil déjà ouvert sur
   * ce navigateur ne redit pas son identifiant : sa session le dit, et son
   * mot de passe le confirme — l'arbitrage du 27 septembre 2026. Sans ce mot
   * de passe, un ami connecté à son profil sur l'ordinateur de l'animateur
   * serait rattaché d'un clic, et garderait la console.
   */
  app.post(
    '/api/space/profil',
    account,
    pasDeTele,
    small,
    wrap(async (req, res) => {
      noStore(res)
      const me = accountOf(res)
      const jeton = req.body?.login ? null : readPlayerToken(req.header('cookie'))
      const ouvert = jeton ? await deps.profiles.bySession(jeton) : null
      const login = normalizeLogin(req.body?.login) || ouvert?.login || ''
      // Remplacer le profil qui tient l'espace demande sa preuve, avant tout :
      // les identifiants de l'autre profil ne disent rien de celui-ci.
      const lie = me.profileId ? await deps.profiles.byId(me.profileId).catch(() => null) : null
      if (me.profileId && lie?.login !== login) {
        const preuve = await prouver(req, me)
        if (!preuve.ok) return res.status(preuve.statut).json({ error: preuve.error })
      }
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
      res.json({ profil: profilDeLEspace(found) })
    }),
  )

  app.delete(
    '/api/space/profil',
    account,
    pasDeTele,
    small,
    wrap(async (req, res) => {
      noStore(res)
      const me = accountOf(res)
      if (me.profileId) {
        const preuve = await prouver(req, me)
        if (!preuve.ok) return res.status(preuve.statut).json({ error: preuve.error })
      }
      await auth.linkProfile(me.id, null, sessionOf(res))
      res.json({ profil: null })
    }),
  )

  app.put(
    '/api/space/settings',
    account,
    small,
    wrap(async (req, res) => {
      const me = await auth.updateSettings(accountOf(res).id, req.body)
      // Le titre, l'accroche, la date : les téléphones les lisent dans
      // l'instantané. La veille suivante de n'importe qui les portait ; plus
      // maintenant qu'une veille ne repart qu'à l'écran commun.
      deps.espaceChange(me.id)
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
      // Pas pour soi : « Mon compte » change son mot de passe en donnant
      // l'actuel. Un lien pour soi le changeait sans — n'importe quelle
      // session d'administrateur suffisait, le téléphone prêté compris, et il
      // en sortait une console de trente jours, le vrai propriétaire dehors.
      if (target.id === accountOf(res).id) {
        return res.status(400).json({ error: 'Pas pour ton propre compte : change ton mot de passe dans « Mon compte »' })
      }
      // Un lien pour un compte en pause ouvrait une session sur un espace
      // que l'administrateur venait de fermer.
      if (target.disabledAt) return res.status(400).json({ error: 'Réactive d’abord le compte' })
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
      if (target.id === accountOf(res).id) return res.status(400).json({ error: 'Tu ne peux pas désactiver ton propre compte' })
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
  // anciennes adresses. Tout ce qu'il a laissé part avec lui. Ce que ses
  // soirées ont crédité aux joueurs, l'administrateur le garde ou le reprend
  // (`?credits=reprendre`), à chaque suppression — un compte qui fabriquait
  // des soirées, ou un ami qui s'en va (l'arbitrage du 27 septembre 2026).
  // Sans rien dire, une page d'avant garde les crédits, comme avant.
  app.delete(
    '/api/admin/accounts/:id',
    account,
    requireAdmin,
    wrap(async (req, res) => {
      const target = auth.byId(req.params.id)
      if (!target) return res.status(404).json({ error: 'Compte introuvable' })
      if (target.id === accountOf(res).id) return res.status(400).json({ error: 'Tu ne peux pas supprimer ton propre compte' })
      if (target.id === auth.defaultSpaceId) {
        return res.status(400).json({ error: 'L’espace par défaut ne se supprime pas : les anciennes adresses mènent chez lui' })
      }
      if (!target.disabledAt) return res.status(400).json({ error: 'Désactive d’abord le compte' })
      await deps.removeAccount(target.id, { reprendre: req.query.credits === 'reprendre' })
      res.json({ ok: true })
    }),
  )
}

import express, { type Express } from 'express'
import { wrap } from '../core/http'
import type { ProfileRec, ProfileStore } from './profiles'
import type { AuthStore } from './store'
import { dummyHash, passwordProblem } from './password'
import {
  LoginBudget,
  clearPlayerCookie,
  clearSessionCookie,
  clientIp,
  readPlayerToken,
  readSessionToken,
  setPlayerCookie,
  setSessionCookie,
} from './http'
import { Budget } from '../core/budget'
import { isValidLogin, normalizeLogin } from '../../../shared/space'

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

  /**
   * L'espace qu'anime ce profil, s'il en tient un — et la session d'animateur
   * qui va avec.
   *
   * C'est ici que les deux identités se rejoignent : on se connecte avec son
   * profil, et si un espace lui est rattaché, la console s'ouvre sans
   * redemander quoi que ce soit. Le compte garde son propre mot de passe pour
   * qui préfère l'ancienne porte, mais plus personne n'est obligé d'en tenir
   * deux en tête.
   *
   * Un compte fermé ne rouvre rien : le rattachement ne contourne aucun des
   * garde-fous de `/api/auth/login`.
   */
  const ouvrirConsole = async (req: express.Request, res: express.Response, profileId: string) => {
    const espace = deps.auth.byProfile(profileId)
    if (!espace || espace.disabledAt) return null
    const token = await deps.auth.createSession(espace.id, req.header('user-agent') ?? '')
    setSessionCookie(res, token, deps.online)
    await deps.auth.touchLogin(espace.id)
    return deps.auth.publicSpace(espace)
  }

  /** Ce que rend une connexion de joueur : son profil, et son espace s'il en anime un. */
  const identite = async (req: express.Request, res: express.Response, profile: ProfileRec) => ({
    profile: profiles.toPublic(profile),
    espace: await ouvrirConsole(req, res, profile.id),
  })

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
      // Un identifiant déjà pris n'est pas une impasse : on en propose un
      // libre, que la page pose dans le champ d'un geste.
      //
      // Oui, répondre ça confirme qu'un profil porte ce nom. Dans une
      // application de fête où un profil ne contient qu'un pseudo et de
      // l'expérience — aucune adresse, aucune donnée personnelle — le confort
      // d'une invitée qui n'y connaît rien vaut plus que ce secret-là, et la
      // route est déjà limitée par adresse juste au-dessus.
      const voulu = normalizeLogin(req.body?.login)
      if (isValidLogin(voulu) && (await profiles.byLogin(voulu))) {
        const suggestion = await profiles.suggestLogin(voulu)
        return res.status(400).json({
          error: `« ${voulu} » est déjà pris`,
          ...(suggestion && { suggestion }),
        })
      }
      const { profile, recovery } = await profiles.register({
        login: req.body?.login,
        password: req.body.password,
        name: req.body?.name,
        avatar: req.body?.avatar,
      })
      await openSession(req, res, profile.id)
      // Le code de secours ne repassera jamais par ici : c'est la seule fois
      // où il existe en clair, et la page doit le dire clairement.
      res.status(201).json({ ...(await identite(req, res, profile)), recovery })
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
      res.json(await identite(req, res, found))
    }),
  )

  app.post(
    '/api/joueur/deconnexion',
    wrap(async (req, res) => {
      const token = readPlayerToken(req.header('cookie'))
      // Le profil AVANT de fermer sa session : c'est lui qui dit si la
      // console ouverte ici est la sienne.
      const me = token ? await profiles.bySession(token).catch(() => null) : null
      if (token) await profiles.revokeSession(token)
      clearPlayerCookie(res)
      // Une seule porte à l'aller, une seule au retour : se déconnecter de
      // son profil referme la console que CE profil avait ouverte. Sinon
      // « ce n'est pas moi », tapé sur un téléphone prêté, laisserait la
      // soirée pilotable par le suivant.
      //
      // On ne touche pas à une console qui n'est pas la sienne : un
      // animateur peut très bien piloter sa soirée depuis ce navigateur tout
      // en y jouant sous un profil qui n'a rien à voir, et ce bouton-là ne
      // doit pas lui éteindre l'écran commun.
      const hote = readSessionToken(req.header('cookie'))
      const ouverte = hote ? deps.auth.resolveSession(hote) : null
      if (ouverte && me && ouverte.account.profileId === me.id) {
        // `AuthStore` révoque par identifiant de session, `ProfileStore` par
        // jeton : les deux conventions se ressemblent assez pour qu'on s'y
        // trompe, et un jeton passé là ne révoque rien, en silence.
        await deps.auth.revokeSession(ouverte.session.id)
        clearSessionCookie(res)
      }
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
      // L'espace rattaché s'y ajoute : c'est lui qui fait apparaître « Animer
      // ma soirée » sur l'accueil.
      const espace = me ? deps.auth.byProfile(me.id) : undefined
      res.json({
        profile: me ? await profiles.toDetail(me, nomDEspace) : null,
        espace: espace && !espace.disabledAt ? deps.auth.publicSpace(espace) : null,
      })
    }),
  )

  /**
   * Ouvre la console de l'espace rattaché, depuis une session de joueur.
   *
   * La session d'animateur dure trente jours, celle du joueur un an : celui
   * qui revient six mois plus tard est toujours reconnu comme joueur et ne
   * l'est plus comme animateur. Ce bouton-là rouvre la porte sans rien
   * redemander — c'est la même personne, et elle l'a déjà prouvé.
   */
  app.post(
    '/api/joueur/console',
    wrap(async (req, res) => {
      noStore(res)
      const me = await current(req)
      if (!me) return res.status(401).json({ error: 'Connexion requise' })
      const espace = await ouvrirConsole(req, res, me.id)
      if (!espace) return res.status(403).json({ error: 'Aucune soirée à animer avec ce profil' })
      res.json({ espace })
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
      if (!found) return res.json({ recovery, profile: null, espace: null })
      await openSession(req, res, found.id)
      // Le code de secours rouvre la console aussi. C'est assumé : il n'y a
      // pas d'adresse e-mail dans cette application, donc pas d'autre porte
      // de retour — et un animateur qui a perdu son mot de passe la veille de
      // sa fête ne doit pas devoir réveiller l'administrateur.
      res.json({ recovery, ...(await identite(req, res, found)) })
    }),
  )
}

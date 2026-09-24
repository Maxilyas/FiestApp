import express, { type Express } from 'express'
import type { QuizStore } from './core/quizStore'
import type { ArchiveStore } from './core/archive'
import type { AuthStore } from './auth/store'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { tronquer } from '../../shared/avatars'
import { horsBornesALEnvoi } from '../../shared/library'
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
  /**
   * Les photos que citent les parties de l'espace encore sur le disque local
   * — celle qui se joue, et celles déjà jouées que la soirée n'a pas encore
   * rangées. Le ménage des photos ne doit pas les effacer.
   */
  photosEnJeu: (spaceId: string) => Iterable<string>
  /** Supprime un compte et tout ce qu'il a laissé — composé dans `createQuizServer`, où tout est à portée. */
  removeAccount: (accountId: string) => Promise<void>
  /** L'identifiant de la soirée en cours d'un espace, s'il est tiré : elle ne se retire pas de l'historique. */
  soireeEnCours: (spaceId: string) => string | null
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
  mountAuthApi(app, { auth: deps.auth, profiles: deps.profiles, online: deps.online, removeAccount: deps.removeAccount })
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

  /**
   * Le dernier enregistrement de chaque quiz, par espace : son jeton, son
   * numéro d'essai et la version qu'il a écrite. L'éditeur tire un jeton par
   * clic sur « Enregistrer », et numérote les essais que `auReveil` en fait :
   * un premier essai passé dont la réponse s'est perdue ne fait pas entrer le
   * suivant en conflit avec lui-même, et un essai abandonné par le client qui
   * n'arrive qu'après son rejeu ne réécrit pas l'ancien texte par-dessus. En
   * mémoire seulement : perdu au redémarrage, il ne coûte qu'un conflit de
   * trop — qui ne perd rien, le brouillon est là.
   */
  const derniers = new Map<string, { jeton: string; essai: number; version: number }>()
  /**
   * Un enregistrement à la fois par quiz. Sans ça, deux essais du même clic
   * arrivés ensemble — l'abandonné qui arrive quand même au réveil, et le
   * rejoué — lisaient tous deux `derniers` avant que l'un l'écrive : le
   * second recevait « enregistré ailleurs » pour son propre clic.
   */
  const enCours = new Map<string, Promise<unknown>>()
  const unParUn = <T,>(cle: string, fn: () => Promise<T>): Promise<T> => {
    const suite = (enCours.get(cle) ?? Promise.resolve()).then(fn, fn)
    const fin = suite.then(
      () => {},
      () => {},
    )
    enCours.set(cle, fin)
    // Le dernier de la file la range en partant : la carte ne garde pas un
    // quiz par quiz jamais enregistré depuis le démarrage.
    fin.then(() => {
      if (enCours.get(cle) === fin) enCours.delete(cle)
    })
    return suite
  }

  app.put(
    '/api/quizzes/:id',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      const id = req.params.id
      const cle = `${spaceId}:${id}`
      const jeton = typeof req.body?.jeton === 'string' ? tronquer(req.body.jeton, 64) : null
      // Sans numéro (aucune page n'envoie un jeton sans lui), l'essai compte
      // pour le plus récent : il écrit, comme avant.
      const essai =
        typeof req.body?.essai === 'number' && Number.isFinite(req.body.essai) ? req.body.essai : Number.POSITIVE_INFINITY
      // La version d'où partent les modifications : si le quiz a été
      // enregistré ailleurs depuis — l'autre appareil —, on refuse au lieu
      // d'écraser en silence. Sans `base` (une page d'avant), comme avant.
      const base = typeof req.body?.base === 'number' && Number.isFinite(req.body.base) ? req.body.base : undefined
      if (base !== undefined) {
        const horsBornes = horsBornesALEnvoi(req.body?.questions)
        if (horsBornes) return res.status(400).json({ error: horsBornes })
      }
      const quiz = await unParUn(cle, async () => {
        const d = derniers.get(cle)
        const memeClic = jeton !== null && d !== undefined && d.jeton === jeton
        // Un essai périmé de ce clic : un plus récent a déjà écrit, il ne réécrit rien.
        if (memeClic && essai <= d.essai) return deps.store.get(spaceId, id)
        const q = await deps.store.save(spaceId, id, req.body?.title, req.body?.questions, memeClic ? d.version : base)
        if (q && q !== 'conflit') {
          if (jeton !== null) derniers.set(cle, { jeton, essai, version: q.updatedAt })
          else derniers.delete(cle)
        }
        return q
      })
      if (quiz === 'conflit') {
        const actuel = await deps.store.get(spaceId, req.params.id)
        return res.status(409).json({
          error: 'Ce quiz a été enregistré ailleurs pendant que tu écrivais — un autre appareil ? Choisis la version à garder.',
          conflit: { updatedAt: actuel?.updatedAt ?? null },
        })
      }
      if (!quiz) return res.status(404).json({ error: 'Quiz introuvable' })
      await deps.onLibraryChanged(spaceId)
      res.json(quiz)
      // Après coup : une photo retirée d'une question n'a plus à occuper la
      // base — sauf si la partie en cours ou une soirée archivée la montre encore.
      deps.store.pruneImages(spaceId, undefined, deps.photosEnJeu(spaceId)).catch(() => {})
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
      deps.store.pruneImages(spaceId, undefined, deps.photosEnJeu(spaceId)).catch(() => {})
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

  // Retirer une soirée de l'historique reprend aussi ce qu'elle avait
  // crédité aux profils — expérience, prix, hauts faits, Éclats : une soirée
  // d'essai laissait sinon, pour toujours, le niveau gagné en testant. La
  // soirée en cours, elle, ne se retire pas d'ici : elle s'efface depuis
  // l'écran commun (« C'était un essai »), qui sait aussi vider la salle.
  app.delete(
    '/api/soirees/:id',
    wrap(async (req, res) => {
      const spaceId = spaceOf(res)
      if (deps.soireeEnCours(spaceId) === req.params.id) {
        return res.status(409).json({ error: 'La soirée en cours s’efface depuis l’écran commun — « C’était un essai »' })
      }
      const ok = await deps.archives.remove(spaceId, req.params.id)
      if (!ok) return res.status(404).json({ error: 'Soirée introuvable' })
      await deps.profiles.retirerSoireeEntiere(req.params.id, spaceId)
      res.json({ ok: true })
    }),
  )

  // Public, et sans espace : une exception assumée au cloisonnement par
  // `space_id`. Les téléphones des invités chargent les photos sans session,
  // et exiger l'espace n'ajouterait rien — son nom est public. L'identifiant
  // est donc la permission : un UUID v4 tiré au hasard (122 bits), qui ne
  // s'énumère pas et ne se devine pas. On ne l'apprend qu'en voyant la
  // question : dans l'éditeur de son espace, à l'écran pendant la partie, ou
  // dans le bilan public une fois qu'elle est jouée. Celle d'une question pas
  // encore jouée reste introuvable, même du voisin. Formats bornés à JPEG,
  // PNG et WebP : jamais de SVG, qui porterait du script. Ce qui ferait
  // tomber la règle : un identifiant prévisible, ou une route qui les liste.
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

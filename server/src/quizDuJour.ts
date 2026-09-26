import { createHash, timingSafeEqual } from 'node:crypto'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import type { JourStore } from './core/jour'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { readPlayerToken, requireAdmin } from './auth/http'
import { A_ECRIRE_A_LA_MAIN, A_ECRIRE_MAX } from './core/consigne'
import { parseImportedQuestions } from '../../shared/library'
import { jourDe, jourValide, moisDe } from '../../shared/jour'

interface JourDeps {
  jour: JourStore
  profiles: ProfileStore
  /** L'heure du serveur, celle du magasin : un classement « d'aujourd'hui » se lit au même jour. */
  maintenant: () => number
  /** Une routine peut remplir la réserve : `RESERVE_TOKEN` est posé. L'administration le dit. */
  reserveAutomatique?: boolean
}

const MOIS = /^\d{4}-\d{2}$/

/**
 * Les routes du quiz du jour, pour les profils : jouer, se classer, relire,
 * signaler. Elles passent AVANT la porte des animateurs — un joueur n'a pas
 * de compte d'animateur —, derrière celle des profils : un invité anonyme
 * n'a pas de quiz du jour, et le serveur le lui dit sans détour.
 */
export function mountJour(app: Express, deps: JourDeps) {
  const petit = express.json({ limit: '4kb' })

  /** Le profil connecté, ou un 401 qui dit quoi faire. */
  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour jouer au quiz du jour' })
    return profil
  }

  app.get(
    '/api/jour',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.jour.etat(profil))
    }),
  )

  app.post(
    '/api/jour/commencer',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.jour.commencer(profil))
    }),
  )

  app.post(
    '/api/jour/suivante',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.jour.suivante(profil))
    }),
  )

  app.post(
    '/api/jour/repondre',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const { jour, index, choix } = req.body ?? {}
      res.json(await deps.jour.repondre(profil, String(jour ?? ''), Number(index), choix))
    }),
  )

  // `?jour=2026-09-25` ou `?mois=2026-09` ; aujourd'hui par défaut.
  app.get(
    '/api/jour/classement',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const mois = typeof req.query.mois === 'string' ? req.query.mois : ''
      if (MOIS.test(mois)) return res.json(await deps.jour.classementDuMois(mois, profil.id))
      const jour = jourValide(req.query.jour) ? req.query.jour : jourDe(deps.maintenant())
      res.json(await deps.jour.classementDuJour(jour, profil.id))
    }),
  )

  app.get(
    '/api/jour/correction/:jour',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const correction = await deps.jour.correction(profil, req.params.jour)
      // Avant minuit, pour qui n'a pas fini : elle donnerait le quiz à qui ne l'a pas joué.
      if (!correction) return res.status(404).json({ error: 'La correction s’ouvre quand tu as fini, ou à minuit' })
      res.json(correction)
    }),
  )

  app.post(
    '/api/jour/signaler',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const { jour, index, texte } = req.body ?? {}
      await deps.jour.signaler(profil, String(jour ?? ''), Number(index), texte)
      res.json({ ok: true })
    }),
  )
}

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest()

/**
 * La réserve, pour la routine qui la remplit (`RESERVE_TOKEN`) : ce qu'il
 * faut écrire — la consigne —, puis le dépôt. Un jeton qui ne sait faire
 * que ça : ni lire un profil, ni retirer une question. S'il fuitait, il ne
 * coûterait que des questions en trop, que l'administration retire. Sans
 * jeton posé, la porte n'existe pas.
 *
 * La routine tourne sur l'abonnement Claude de l'administrateur : aucune
 * clé d'IA n'est confiée au serveur. Elle passe AVANT la porte des
 * animateurs — elle n'en est pas un —, mais derrière la protection contre
 * les requêtes forgées : son dépôt porte `X-Requested-With: quizz`, comme
 * toute écriture.
 */
export function mountReserve(app: Express, deps: { jour: JourStore; jeton: string | null }) {
  const attendu = deps.jeton ? empreinte(deps.jeton) : null
  const depot = express.json({ limit: '256kb' })

  /**
   * La porte, AVANT de lire le corps : sans elle, n'importe qui faisait
   * analyser un quart de mégaoctet de JSON au serveur. Les jetons se
   * comparent par leur empreinte, en temps constant : ni le jeton ni sa
   * longueur ne se devinent à la montre.
   */
  const porte = (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store')
    if (!attendu) return res.status(404).json({ error: 'Le dépôt automatique n’est pas ouvert sur ce serveur' })
    const recu = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '')?.[1] ?? ''
    if (!timingSafeEqual(empreinte(recu), attendu)) return res.status(401).json({ error: 'Jeton de la réserve refusé' })
    next()
  }

  app.get(
    '/api/jour/reserve',
    porte,
    wrap(async (_req, res) => {
      res.json({ ...(await deps.jour.consigne()), parEnvoi: A_ECRIRE_MAX })
    }),
  )

  app.post(
    '/api/jour/reserve',
    porte,
    depot,
    wrap(async (req, res) => {
      const liste = typeof req.body?.liste === 'string' ? req.body.liste : ''
      if (!liste.trim()) return res.status(400).json({ error: 'Envoie les questions dans « liste », au format de la consigne' })
      const lu = parseImportedQuestions(liste)
      if (lu.questions.length > A_ECRIRE_MAX) {
        return res.status(400).json({ error: `${A_ECRIRE_MAX} questions au plus par envoi : coupe la liste en plusieurs` })
      }
      const { ajoutees, ecartees } = await deps.jour.ajouter(lu.questions, 'ia')
      console.log(`[jour] dépôt de la routine : ${ajoutees} ajoutée${ajoutees > 1 ? 's' : ''}, ${ecartees.length} écartée${ecartees.length > 1 ? 's' : ''}`)
      res.json({ ajoutees, ecartees, ignores: lu.ignores })
    }),
  )
}

/**
 * La réserve, les signalements et les profils masqués, pour l'administrateur
 * seul (`/admin`). Passe derrière la porte des animateurs.
 */
export function mountJourAdmin(app: Express, deps: JourDeps) {
  app.get(
    '/api/admin/jour',
    requireAdmin,
    wrap(async (_req, res) => {
      const [reserve, signalements, masques] = await Promise.all([
        deps.jour.etatDeLaReserve(),
        deps.jour.signalements(),
        deps.jour.profilsPourLAdministration(''),
      ])
      res.json({
        reserve,
        signalements,
        masques,
        remplissage: { automatique: !!deps.reserveAutomatique },
        aujourdhui: jourDe(deps.maintenant()),
        mois: moisDe(jourDe(deps.maintenant())),
      })
    }),
  )

  // « Copier la consigne pour une IA » : la même que celle de la routine,
  // pour un chatbot où l'on colle à la main — trente questions d'un coup.
  app.get(
    '/api/admin/jour/consigne',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.jour.consigne(A_ECRIRE_A_LA_MAIN))
    }),
  )

  app.get(
    '/api/admin/jour/prochaines',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.jour.prochaines())
    }),
  )

  // « Coller une liste » : le même format, le même analyseur que l'éditeur.
  app.post(
    '/api/admin/jour/liste',
    requireAdmin,
    wrap(async (req, res) => {
      const texte = typeof req.body?.texte === 'string' ? req.body.texte : ''
      if (!texte.trim()) return res.status(400).json({ error: 'Colle une liste de questions' })
      const lu = parseImportedQuestions(texte)
      const { ajoutees, ecartees } = await deps.jour.ajouter(lu.questions, 'liste')
      res.json({ ajoutees, ecartees, ignores: lu.ignores })
    }),
  )

  app.post(
    '/api/admin/jour/garder',
    requireAdmin,
    wrap(async (req, res) => {
      await deps.jour.garder(String(req.body?.jour ?? ''), Number(req.body?.index))
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/jour/annuler',
    requireAdmin,
    wrap(async (req, res) => {
      await deps.jour.annuler(String(req.body?.jour ?? ''), Number(req.body?.index))
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/jour/retirer',
    requireAdmin,
    wrap(async (req, res) => {
      const retiree = await deps.jour.retirer(String(req.body?.reserveId ?? ''))
      if (!retiree) return res.status(404).json({ error: 'Cette question n’est plus dans la réserve' })
      // Ses signalements, s'il y en avait, n'ont plus rien à attendre.
      if (jourValide(req.body?.jour)) await deps.jour.garder(req.body.jour, Number(req.body?.index))
      res.json({ ok: true })
    }),
  )

  app.get(
    '/api/admin/jour/profils',
    requireAdmin,
    wrap(async (req, res) => {
      res.json(await deps.jour.profilsPourLAdministration(typeof req.query.q === 'string' ? req.query.q.slice(0, 40) : ''))
    }),
  )

  app.post(
    '/api/admin/jour/masquer',
    requireAdmin,
    wrap(async (req, res) => {
      const profil = await deps.profiles.byId(String(req.body?.profileId ?? ''))
      if (!profil) return res.status(404).json({ error: 'Profil introuvable' })
      await deps.jour.masquer(profil.id, req.body?.masque !== false)
      res.json({ ok: true })
    }),
  )
}

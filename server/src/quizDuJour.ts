import express, { type Express, type Request, type Response } from 'express'
import type { JourStore } from './core/jour'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { readPlayerToken, requireAdmin } from './auth/http'
import { parseImportedQuestions } from '../../shared/library'
import { jourDe, jourValide, moisDe } from '../../shared/jour'

interface JourDeps {
  jour: JourStore
  profiles: ProfileStore
  /** L'heure du serveur, celle du magasin : un classement « d'aujourd'hui » se lit au même jour. */
  maintenant: () => number
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
      res.json({ reserve, signalements, masques, aujourdhui: jourDe(deps.maintenant()), mois: moisDe(jourDe(deps.maintenant())) })
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

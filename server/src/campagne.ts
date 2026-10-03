import express, { type Express, type Request, type Response } from 'express'
import type { CampagneStore } from './core/campagne'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'
import { CATEGORIES } from '../../shared/categories'

interface CampagneDeps {
  campagne: CampagneStore
  profiles: ProfileStore
}

/**
 * Les routes de la campagne solo, pour les profils — comme le quiz du jour,
 * avant la porte des animateurs : un joueur n'a pas de compte d'animateur.
 * Un invité anonyme n'a pas de campagne, et le serveur le lui dit.
 */
export function mountCampagne(app: Express, deps: CampagneDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour jouer la campagne' })
    return profil
  }

  app.get(
    '/api/campagne',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.etat(profil.id))
    }),
  )

  app.post(
    '/api/campagne/serie',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      // Seules les catégories de la liste fixe : le reste ne filtrerait rien.
      const brut: unknown = req.body?.categories
      const categories = Array.isArray(brut) ? brut.filter((c): c is string => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c)).slice(0, CATEGORIES.length) : []
      res.json(await deps.campagne.commencer(profil.id, categories))
    }),
  )

  app.post(
    '/api/campagne/serie/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      res.json(await deps.campagne.repondre(profil.id, String(req.params.id), Number(req.body?.index), req.body?.choix))
    }),
  )

  app.get(
    '/api/campagne/serie/:id/correction',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.correction(profil.id, String(req.params.id)))
    }),
  )
}

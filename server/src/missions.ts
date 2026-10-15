import express, { type Express, type Request, type Response } from 'express'
import type { ProfileStore } from './auth/profiles'
import type { Missions } from './core/missions'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'

interface MissionsDeps {
  missions: Missions
  profiles: ProfileStore
}

/**
 * Les missions du jour et le coffre de la semaine (`core/missions.ts`), pour
 * les profils : comme le quiz du jour et la campagne, avant la porte des
 * animateurs. Un invité anonyme n'en a pas, et le serveur le lui dit.
 */
export function mountMissions(app: Express, deps: MissionsDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour tes missions du jour' })
    return profil
  }

  // Ses missions du jour : tirées à sa première visite du jour, jugées sur
  // ses journaux, ce qui vient d'être fait retenu et dit (`nouvelles`). Une
  // lecture qui écrit : l'accueil la demande une fois montré, la fin de
  // chaque partie une fois, pour annoncer la mission accomplie.
  app.get(
    '/api/joueur/missions',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.missions.duJour(profil.id))
    }),
  )

  // Ouvrir le coffre d'une semaine passée : le tirage, une fois ; rouvert, il
  // redonne ce qu'il a donné — la scène de l'ouverture peut se rejouer après
  // un rechargement sans rien tirer de plus.
  app.post(
    '/api/joueur/coffre',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const coffre = await deps.missions.ouvrirLeCoffre(profil.id, req.body?.semaine)
      res.json({ coffre })
    }),
  )
}

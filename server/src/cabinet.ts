import express, { type Express, type Request, type Response } from 'express'
import type { ProfileStore } from './auth/profiles'
import { readPlayerToken } from './auth/http'
import { wrap } from './core/http'
import { PARTIE_INTROUVABLE, type CabinetStore } from './core/cabinet/magasin'
import { pageDuCabinet, vueDeLaPartie } from './core/cabinet/vue'

/** Ce que dit une route du Cabinet là où il n'ouvre pas encore — la production, tant que son drapeau ne l'ouvre pas. */
export const CABINET_FERME = 'Le Cabinet de curiosités ouvre bientôt : reviens dans quelques jours'
export const CABINET_SANS_PROFIL = 'Connecte-toi à ton profil pour ouvrir ton Cabinet'

interface CabinetDeps {
  cabinet: CabinetStore
  profiles: ProfileStore
  /**
   * Ses routes répondent-elles ? Hors de la production toujours, en
   * production quand son drapeau l'ouvre (`cabinetOuvert`, calculé une fois
   * par `server.ts`) : fermé, chacune répond 404, et la page servie le dit
   * d'avance (`<meta name="cabinet" content="ferme">`).
   */
  ouvert: boolean
}

/**
 * Les routes du Cabinet de curiosités (`shared/cabinet/vues.ts`), pour les
 * profils — un invité anonyme n'a pas de musée, et le serveur le lui dit :
 * la page, commencer une partie, un geste. Chaque réponse porte l'heure du
 * serveur (`maintenant`), que la page mesure, et ne se garde nulle part
 * (`no-store`). Ses signalements passent par la route de la série
 * (`/api/campagne/serie/:id/signalement`), à la position de la pièce.
 */
export function mountCabinet(app: Express, deps: CabinetDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    if (!deps.ouvert) {
      res.status(404).json({ error: CABINET_FERME })
      return null
    }
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: CABINET_SANS_PROFIL })
    return profil
  }

  // Le musée, la visite du jour, ce qui reste à jouer, la partie en cours. Préchargée avec la page, elle le dit
  // (`prechargee`) : son heure se mesure sur le préchargement, pas autour d'un `fetch` qui la trouve déjà là.
  app.get(
    '/api/cabinet',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const page = pageDuCabinet(await deps.cabinet.page(profil.id))
      res.json(req.header('x-requested-with') ? page : { ...page, prechargee: true })
    }),
  )

  // Commencer : une case de la visite, une chasse, ou une partie libre, et la carte-bonus emportée.
  app.post(
    '/api/cabinet/partie',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(vueDeLaPartie(await deps.cabinet.commencer(profil.id, req.body)))
    }),
  )

  // Un geste, avec le rang qu'il croit suivre (invariant 12) : passé, ou sur une partie finie, il rend la vue d'à
  // présent avec son refus — la page s'y range ; une partie qui n'est pas la sienne est introuvable (invariant 3).
  app.post(
    '/api/cabinet/partie/:id/geste',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const issue = await deps.cabinet.geste(profil.id, String(req.params.id), req.body?.rang, req.body?.geste)
      if ('introuvable' in issue) res.status(404).json({ error: PARTIE_INTROUVABLE })
      else if ('passe' in issue) res.status(409).json({ error: issue.pourquoi, partie: vueDeLaPartie(issue.passe) })
      else res.json(vueDeLaPartie(issue.partie))
    }),
  )
}

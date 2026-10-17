import express, { type Express, type Request, type Response } from 'express'
import type { CampagneStore } from './core/campagne'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'
import { EXPEDITION_EN_PRODUCTION } from '../../shared/jokers'

interface ExpeditionDeps {
  campagne: CampagneStore
  profiles: ProfileStore
  /**
   * Ses routes répondent : hors de la production, ou une fois ses jokers
   * venus (`EXPEDITION_EN_PRODUCTION`, `shared/jokers.ts`). Sans jokers, le
   * joueur moyen n'arrive au bout que trois fois sur cent : rien ne s'y gagne
   * en production avant que le mode soit entier.
   */
  ouverte: boolean
}

/**
 * L'expédition répond-elle ? Hors de la production toujours — la
 * préproduction (`APP_ENV`), `npm run dev`, les tests —, en production une
 * fois ses jokers venus.
 */
export function expeditionOuverte({ online, env }: { online: boolean; env: string }): boolean {
  return EXPEDITION_EN_PRODUCTION || !online || env !== 'production'
}

/**
 * Les routes de l'Expédition (`shared/expedition.ts`), pour les profils —
 * comme la campagne, dont elle est une partie d'un autre mode : sa
 * correction et ses signalements passent par les routes de la série
 * (`/api/campagne/serie/:id/…`). Un invité anonyme n'a pas d'expédition, et
 * le serveur le lui dit.
 */
export function mountExpedition(app: Express, deps: ExpeditionDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    if (!deps.ouverte) {
      res.status(404).json({ error: 'L’expédition arrive bientôt : reviens dans quelques jours' })
      return null
    }
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour partir en expédition' })
    return profil
  }

  // Celle qu'il a en route, sinon la prochaine : son numéro et ses gardiens.
  app.get(
    '/api/expedition',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.pageDeLExpedition(profil.id))
    }),
  )

  // Partir, avec son équipée : deux légendaires au plus, les siens ou l'invité du jour.
  app.post(
    '/api/expedition',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.partirEnExpedition(profil.id, req.body?.equipee ?? []))
    }),
  )

  // Un geste — avancer, jouer un joker, prendre une offre, camper, garder un gardien —, avec le rang qu'il croit suivre.
  app.post(
    '/api/expedition/:id/geste',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.gesteDExpedition(profil.id, String(req.params.id), Number(req.body?.rang), req.body?.geste))
    }),
  )

  // Une réponse, avec le rang de la question qu'elle vise.
  app.post(
    '/api/expedition/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.repondreEnExpedition(profil.id, String(req.params.id), Number(req.body?.position), req.body?.choix))
    }),
  )

  app.post(
    '/api/expedition/:id/abandon',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.abandonnerLExpedition(profil.id, String(req.params.id)))
    }),
  )
}

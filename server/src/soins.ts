import express, { type Express, type Request, type Response } from 'express'
import type { ProfileStore } from './auth/profiles'
import type { Soins } from './core/soins'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'

interface SoinsDeps {
  soins: Soins
  profiles: ProfileStore
}

/**
 * S'occuper de son compagnon (`core/soins.ts`), pour les profils : ses envies
 * du jour, son cadeau, la cueillette, son jardin. Comme ses missions, avant
 * la porte des animateurs — un invité anonyme n'a pas de compagnon, et le
 * serveur le lui dit.
 */
export function mountSoins(app: Express, deps: SoinsDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour t’occuper de ton compagnon' })
    return profil
  }

  // Ses soins d'aujourd'hui, pour tous ses compagnons : ses envies, son
  // cadeau s'il est ouvert, sa complicité, son record, son jardin — et ses
  // trouvailles, à lui pour tous. La page de son compagnon les lit en
  // s'ouvrant ; la niche du coin, jamais.
  app.get(
    '/api/joueur/soins',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.soins.duJour(profil.id))
    }),
  )

  // Une envie comblée — le goûter, le câlin : une fois par jour, la seconde n'écrit rien.
  app.post(
    '/api/joueur/compagnons/:cle/envie',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.soins.combler(profil.id, req.params.cle, req.body?.envie))
    }),
  )

  // Son cadeau du jour, ses trois envies comblées : le tirage, une fois ;
  // rouvert, il redonne ce qu'il a donné.
  app.post(
    '/api/joueur/compagnons/:cle/cadeau',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.soins.ouvrirLeCadeau(profil.id, req.params.cle))
    }),
  )

  // Une partie de cueillette : son score, son record — la première du jour comble son envie de jouer.
  app.post(
    '/api/joueur/compagnons/:cle/cueillette',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.soins.cueillir(profil.id, req.params.cle, req.body?.score))
    }),
  )

  // Son jardin aménagé, en entier : chaque place vérifiée avant d'écrire, tout passe ou rien.
  app.put(
    '/api/joueur/compagnons/:cle/jardin',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.soins.amenager(profil.id, req.params.cle, req.body?.jardin))
    }),
  )
}

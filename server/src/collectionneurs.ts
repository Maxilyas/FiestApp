import type { Express, Request, Response } from 'express'
import type { ProfileStore } from './auth/profiles'
import type { Collectionneurs } from './core/collectionneurs'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'

interface CollectionneursDeps {
  collectionneurs: Collectionneurs
  profiles: ProfileStore
}

/**
 * Le classement des collectionneurs (`core/collectionneurs.ts`), pour les
 * profils — avant la porte des animateurs, comme la campagne : un invité
 * anonyme n'a pas de collection, et le serveur le lui dit (invariant 8).
 * Les deux routes lisent la mémoire ; seule la fiche du visiteur se refait.
 */
export function mountCollectionneurs(app: Express, deps: CollectionneursDeps) {
  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour voir le classement des collections' })
    return profil
  }

  // Sa page : sa place à chaque catégorie, les têtes, ses amis, les Divins.
  app.get(
    '/api/collectionneurs',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.collectionneurs.pour(profil.id))
    }),
  )

  // La vitrine d'un joueur — la sienne comprise : un masqué ou un suspendu ne s'y ouvre pas, comme sa carte.
  app.get(
    '/api/collectionneurs/:id',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const vitrine = await deps.collectionneurs.vitrine(profil.id, String(req.params.id))
      if (!vitrine) return res.status(404).json({ error: 'Cette vitrine est introuvable : rouvre le classement' })
      res.json(vitrine)
    }),
  )
}

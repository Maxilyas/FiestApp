import express, { type Express, type Request, type Response } from 'express'
import type { AuthStore } from './auth/store'
import type { ProfileStore } from './auth/profiles'
import type { Maintenance } from './core/maintenance'
import type { Sphinx } from './core/sphinx'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'
import { quiEstCe } from './maintenance'

export interface DepsDesRoutesDuSphinx {
  sphinx: Sphinx
  profiles: ProfileStore
  auth: AuthStore
  maintenance: Maintenance
}

/**
 * Sa page fermée pour qui demande — en maintenance, ou bientôt disponible et
 * lui pas testeur —, ou null. Lu en mémoire (`quiEstCe`) : la ligne des
 * missions le demande à chaque lecture.
 */
export function sphinxFermePour(deps: Pick<DepsDesRoutesDuSphinx, 'auth' | 'profiles' | 'maintenance'>, req: Request): 'maintenance' | 'bientot' | null {
  if (!deps.maintenance.estFermee('sphinx')) return null
  if (deps.maintenance.laisseEntrer('sphinx', quiEstCe(deps, req))) return null
  return deps.maintenance.etatDe('sphinx') === 'bientot' ? 'bientot' : 'maintenance'
}

/**
 * Le Sphinx de l'accueil (`core/sphinx.ts`), pour les profils : comme les
 * missions, avant la porte des animateurs. Un invité anonyme n'en a pas
 * (invariant 8), et le serveur le lui dit.
 */
export function mountSphinx(app: Express, deps: DepsDesRoutesDuSphinx) {
  const petit = express.json({ limit: '2kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour rencontrer le Sphinx' })
    return profil
  }

  // La visite du jour — tirée et figée à cette lecture si personne ne l'a
  // encore fait —, la phrase du Divin du moment telle qu'il la voit, et les
  // phrases reconstituées : pour tout profil, habitué ou non, l'album la
  // montre. Sa page fermée pour lui, rien ne se lit ni ne se pose : elle le
  // dit, et c'est tout.
  app.get(
    '/api/joueur/sphinx',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const fermee = sphinxFermePour(deps, req)
      res.json(fermee ? { fermee } : await deps.sphinx.lire(profil.id))
    }),
  )

  // Un geste sur la visite du jour — l'écouter, la remettre à plus tard,
  // répondre, donner sa langue au chat — et son verdict, avec son accusé
  // (`accuse`). Sa porte se ferme avec sa page (`PORTES_DES_PAGES.sphinx`,
  // 423, devant cette route).
  app.post(
    '/api/joueur/sphinx',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const issue = await deps.sphinx.geste(profil.id, req.body)
      if ('refus' in issue) res.status(issue.refus).json({ error: issue.error })
      else res.json(issue)
    }),
  )
}

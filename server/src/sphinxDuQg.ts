import type { Express } from 'express'
import type { Sphinx } from './core/sphinx'
import type { ProfileStore } from './auth/profiles'
import { accountOf } from './auth/http'
import { wrap } from './core/http'
import { noterLeGeste } from './core/journalDesGestes'

export interface SphinxDuQgDeps {
  sphinx: Pick<Sphinx, 'auQg' | 'reponseAuQg'>
  profiles: Pick<ProfileStore, 'byId'>
}

/**
 * Le Sphinx de l'accueil au QG (`/admin#sphinx`, l'étape 3 du plan du
 * 24 novembre 2026), sous `/api/admin`, gardé d'un bloc (`api.ts`,
 * `admin-seulement.test.ts`).
 *
 * La page se lit sans rien écrire : des comptes, les vers des énigmes, jamais
 * une réponse ni un mot d'une légende — le propriétaire joue aussi. La réponse
 * d'une énigme n'arrive que par son geste, qui la range d'abord parmi celles
 * que le profil de l'administrateur a vues (celui que tient son compte,
 * `accounts.profile_id`) : le Sphinx ne la lui proposera jamais. Le journal
 * des gestes le note sans la citer.
 */
export function mountSphinxDuQg(app: Express, deps: SphinxDuQgDeps) {
  app.get(
    '/api/admin/sphinx',
    wrap(async (_req, res) => {
      res.json(await deps.sphinx.auQg(accountOf(res).profileId))
    }),
  )

  app.post(
    '/api/admin/sphinx/enigmes/:numero/reponse',
    wrap(async (req, res) => {
      const profileId = accountOf(res).profileId
      const issue = await deps.sphinx.reponseAuQg(String(req.params.numero), profileId)
      if ('refus' in issue) return res.status(issue.refus).json({ error: issue.error })
      const profil = profileId ? await deps.profiles.byId(profileId) : null
      noterLeGeste(res, {
        sorte: 'profil',
        resume: `Réponse d’une énigme du Sphinx lue au QG : n° ${issue.numero}${issue.deja ? ', déjà vue' : ''} — comptée pour vue sur le profil de ${profil ? `${profil.name} (@${profil.login})` : 'l’administrateur'}`,
        cible: profileId,
      })
      res.json(issue)
    }),
  )
}

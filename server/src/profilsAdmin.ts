import type { Express } from 'express'
import type { ProfileStore } from './auth/profiles'
import type { AccountRec, AuthStore } from './auth/store'
import { estSalonDuProfil, estUnSalon } from './auth/store'
import type { QuizStore } from './core/quizStore'
import { accountOf } from './auth/http'
import { wrap } from './core/http'
import { tronquer } from '../../shared/avatars'
import type { ProfilDAdministration } from '../../shared/profil'
import type { EspaceDAdministration } from '../../shared/space'

interface ProfilsAdminDeps {
  profiles: ProfileStore
  auth: AuthStore
  store: QuizStore
  /** Les espaces dont une soirée pas encore close compte ce profil parmi ses invités — actives ou laissées en plan. */
  soireesPasCloses: (profileId: string) => string[]
  /** Supprime le profil et ce qui n'était qu'à lui — composé dans `createQuizServer`, où tout est à portée. */
  supprimerProfil: (profileId: string) => Promise<{ salon: 'detache' | null }>
}

/**
 * « Les profils », à `/admin` : l'administrateur les cherche, et en supprime
 * un. Sous `/api/admin`, gardé d'un bloc (`api.ts`) : administrateur seul,
 * jamais depuis une télé branchée.
 */
export function mountProfilsAdmin(app: Express, deps: ProfilsAdminDeps) {
  const ligne = async (moi: AccountRec, p: { profil: Parameters<ProfileStore['niveauOf']>[0]; niveau: number; soirees: number }): Promise<ProfilDAdministration> => {
    const salon = deps.auth.byProfile(p.profil.id)
    return {
      id: p.profil.id,
      login: p.profil.login,
      nom: p.profil.name,
      avatar: p.profil.avatar,
      niveau: p.niveau,
      soirees: p.soirees,
      vuLe: p.profil.lastSeenAt,
      salon: salon ? { slug: salon.slug, quiz: await deps.store.count(salon.id), propre: estSalonDuProfil(salon) } : null,
      toi: salon?.id === moi.id,
    }
  }

  app.get(
    '/api/admin/profils',
    wrap(async (req, res) => {
      const { total, profils } = await deps.profiles.pourLAdministration(typeof req.query.q === 'string' ? tronquer(req.query.q, 40) : '')
      const moi = accountOf(res)
      res.json({ total, profils: await Promise.all(profils.map(p => ligne(moi, p))) })
    }),
  )

  // « Les salons » : tous les espaces, chacun avec son titulaire — les
  // profils se chargent d'un coup (`byIds`), pas un aller-retour par espace.
  // `/api/admin/accounts` reste, pour les pages d'avant.
  app.get(
    '/api/admin/espaces',
    wrap(async (_req, res) => {
      const moi = accountOf(res)
      const comptes = deps.auth.list()
      const profils = await deps.profiles.byIds(comptes.flatMap(a => (a.profileId ? [a.profileId] : [])))
      const parId = new Map(profils.flatMap(p => (p ? [[p.id, p] as const] : [])))
      const espaces: EspaceDAdministration[] = await Promise.all(
        comptes.map(async a => {
          const titulaire = a.profileId ? parId.get(a.profileId) : undefined
          return {
            ...deps.auth.toPublic(a),
            salon: estUnSalon(a),
            titulaire: titulaire ? { nom: titulaire.name, avatar: titulaire.avatar } : null,
            quiz: await deps.store.count(a.id),
            toi: a.id === moi.id,
          }
        }),
      )
      res.json(espaces)
    }),
  )

  // Supprimer un profil : jamais le sien — l'administrateur s'enfermerait
  // dehors —, et jamais pendant qu'il joue une soirée pas encore close, son
  // salon compris : sa clôture le créditerait, lui, ses prix, ses hauts faits
  // et ses paliers, sous un identifiant qui n'existe plus. L'espace qu'il
  // tenait reste, détaché — les souvenirs des soirées qu'on y a jouées
  // s'ouvrent toujours (l'arbitrage du 3 octobre 2026).
  app.delete(
    '/api/admin/profils/:id',
    wrap(async (req, res) => {
      const profil = await deps.profiles.byId(req.params.id)
      if (!profil) return res.status(404).json({ error: 'Ce profil est introuvable' })
      const salon = deps.auth.byProfile(profil.id)
      if (salon?.id === accountOf(res).id) return res.status(400).json({ error: 'C’est ton propre profil : il ne se supprime pas d’ici' })
      const ailleurs = deps.soireesPasCloses(profil.id)
      if (ailleurs.length > 0) {
        const chez = deps.auth.byId(ailleurs[0])?.name ?? 'un autre animateur'
        return res.status(409).json({ error: `${profil.name} joue une soirée pas encore close chez ${chez} : elle doit être close d’abord` })
      }
      res.json({ ok: true, ...(await deps.supprimerProfil(profil.id)) })
    }),
  )
}

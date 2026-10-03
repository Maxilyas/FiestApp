import type { Express } from 'express'
import type { ProfileStore } from './auth/profiles'
import type { AccountRec, AuthStore } from './auth/store'
import { estSalonDuProfil } from './auth/store'
import type { QuizStore } from './core/quizStore'
import { accountOf } from './auth/http'
import { wrap } from './core/http'
import { tronquer } from '../../shared/avatars'
import type { ProfilDAdministration } from '../../shared/profil'

interface ProfilsAdminDeps {
  profiles: ProfileStore
  auth: AuthStore
  store: QuizStore
  /** Les espaces dont une soirée pas encore close compte ce profil parmi ses invités — actives ou laissées en plan. */
  soireesPasCloses: (profileId: string) => string[]
  /** Supprime le profil et ce qui n'était qu'à lui — composé dans `createQuizServer`, où tout est à portée. */
  supprimerProfil: (profileId: string) => Promise<{ salon: 'supprime' | 'detache' | null }>
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

  // Supprimer un profil : jamais le sien — l'administrateur s'enfermerait
  // dehors —, et jamais pendant qu'il joue une soirée pas encore close : sa
  // clôture le créditerait, lui, ses prix, ses hauts faits et ses paliers,
  // sous un identifiant qui n'existe plus. Son salon à lui part avec lui, la
  // soirée qui s'y joue comprise ; ce que ses soirées ont rapporté aux autres
  // joueurs leur reste (`removeAccount`, crédits gardés).
  app.delete(
    '/api/admin/profils/:id',
    wrap(async (req, res) => {
      const profil = await deps.profiles.byId(req.params.id)
      if (!profil) return res.status(404).json({ error: 'Ce profil est introuvable' })
      const salon = deps.auth.byProfile(profil.id)
      if (salon?.id === accountOf(res).id) return res.status(400).json({ error: 'C’est ton propre profil : il ne se supprime pas d’ici' })
      const ailleurs = deps.soireesPasCloses(profil.id).filter(spaceId => !(salon && estSalonDuProfil(salon) && salon.id === spaceId))
      if (ailleurs.length > 0) {
        const chez = deps.auth.byId(ailleurs[0])?.name ?? 'un autre animateur'
        return res.status(409).json({ error: `${profil.name} joue une soirée pas encore close chez ${chez} : elle doit être close d’abord` })
      }
      res.json({ ok: true, ...(await deps.supprimerProfil(profil.id)) })
    }),
  )
}

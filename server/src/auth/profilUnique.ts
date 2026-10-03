import type { AuthStore } from './store'
import { estUnSalon } from './store'
import type { ProfileStore } from './profiles'

/**
 * Un seul profil (le choix du propriétaire du 3 octobre 2026) : plus
 * d'animateur d'un côté et de joueur de l'autre. Chaque compte d'animateur
 * d'avant — un mot de passe, et pas de profil — reçoit le sien, au même
 * identifiant et au même mot de passe, et s'y rattache : la personne se
 * connecte comme avant, à l'accueil cette fois, et son espace devient son
 * salon.
 *
 * Une fois, au premier démarrage qui la connaît (`DRAPEAU`) : un compte
 * détaché plus tard ne se verrait pas recréer un profil dans son dos. Une
 * base neuve n'a rien d'avant, le drapeau s'y pose sans rien parcourir — le
 * compte de l'administrateur qu'elle vient de créer n'est pas « d'avant ».
 *
 * Un identifiant déjà pris par un autre profil ne se devine pas : ce peut
 * être la même personne, sous deux identités, ou une autre. Le compte reste
 * tel quel, et l'administrateur le rattache d'un geste (« Les salons »).
 * Le seul profil reconnu est celui qu'une première tentative interrompue a
 * déjà créé : même identifiant, même haché, et pas d'espace.
 */
export const DRAPEAU = 'profil-unique-2026-10-03'

export async function adopterLesComptes(
  auth: AuthStore,
  profiles: ProfileStore,
  baseNeuve: boolean,
): Promise<{ adoptes: string[]; laisses: string[] }> {
  const issue = { adoptes: [] as string[], laisses: [] as string[] }
  if (await profiles.drapeau(DRAPEAU)) return issue
  if (!baseNeuve) {
    for (const compte of auth.list()) {
      if (compte.profileId || !compte.passwordHash || compte.disabledAt || estUnSalon(compte)) continue
      let profil = await profiles.adopter({ login: compte.login, name: compte.name, passwordHash: compte.passwordHash })
      if (!profil) {
        const homonyme = await profiles.byLogin(compte.login)
        const leSien = homonyme && homonyme.passwordHash === compte.passwordHash && !auth.byProfile(homonyme.id)
        if (!leSien) {
          issue.laisses.push(compte.login)
          continue
        }
        profil = homonyme
      }
      await auth.linkProfile(compte.id, profil.id)
      issue.adoptes.push(compte.login)
    }
  }
  await profiles.poserDrapeau(DRAPEAU)
  return issue
}

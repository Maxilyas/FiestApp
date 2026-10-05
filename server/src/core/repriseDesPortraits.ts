import { BRANCHES, portrait, portraitsOuverts, type CleDeBranche, type Paliers } from '../../../shared/branches'
import { paliersDesPortraits } from '../../../shared/sentiers'
import type { ProfileStore } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import { enParallele } from './space'

/**
 * La reprise des avatars du savoir.
 *
 * Jusqu'au 5 octobre 2026, un portrait s'ouvrait aux bonnes réponses de sa
 * catégorie, en soirée comme au quiz du jour, aux seuils d'avant
 * (`SEUILS_D_AVANT`). Les sentiers du savoir sont devenus le seul chemin
 * (`shared/sentiers.ts`) ; chacun garde ce qu'il avait, en paliers : k
 * portraits d'une branche valent les 2k premiers paliers de son sentier
 * (`paliersDesPortraits`) — validés sans épreuve, donc sans étoiles. Celui
 * qui avait le lynx reprend au septième palier de la forêt.
 *
 * Une fois, au premier démarrage qui la connaît (`DRAPEAU`) : les acquis
 * s'écrivent (`sentier_acquis`) et ne bougent plus — une soirée retirée de
 * l'historique ensuite ne reprend rien, un palier ne se perd jamais. Une
 * base neuve n'a rien d'avant : le drapeau s'y pose sans rien parcourir.
 * Une reprise interrompue se rejoue en entier au démarrage suivant : chaque
 * écriture garde le plus haut de ce qui est déjà là.
 */
export const DRAPEAU = 'sentiers-du-savoir-2026-10-05'

/** Les seuils d'avant les sentiers, figés ici : ils ne servent plus qu'à la reprise. */
export const SEUILS_D_AVANT = [3, 20, 40, 75, 130, 200] as const

/** Profils relus de front : chacun coûte deux lectures, son historique et son quiz du jour. */
const EN_PARALLELE = 8

/** Les paliers que valent ses bonnes réponses d'avant, branche par branche : une dérivation pure. */
export function paliersRepris(savoir: Readonly<Record<string, number>>): Paliers {
  const paliers: Partial<Record<CleDeBranche, number>> = {}
  for (const b of BRANCHES) {
    const portraits = SEUILS_D_AVANT.filter(seuil => (savoir[b.categorie] ?? 0) >= seuil).length
    if (portraits > 0) paliers[b.key] = paliersDesPortraits(portraits)
  }
  return paliers
}

export async function reprendreLesPortraits(
  deps: { profiles: ProfileStore; campagne: CampagneStore },
  baseNeuve: boolean,
): Promise<{ profils: number; portraits: number; otes: number } | null> {
  if (await deps.profiles.drapeau(DRAPEAU)) return null
  const issue = { profils: 0, portraits: 0, otes: 0 }
  if (!baseNeuve) {
    const lignes: { profileId: string; branche: CleDeBranche; paliers: number }[] = []
    const repris = new Map<string, Paliers>()
    await enParallele([...(await deps.profiles.idsExistants())], EN_PARALLELE, async profileId => {
      const paliers = paliersRepris(await deps.profiles.savoirDe(profileId))
      repris.set(profileId, paliers)
      for (const [branche, n] of Object.entries(paliers) as [CleDeBranche, number][]) lignes.push({ profileId, branche, paliers: n })
    })
    await deps.campagne.retenirAcquis(lignes)
    for (const [profileId, paliers] of repris) {
      if (Object.keys(paliers).length > 0) issue.profils++
      issue.portraits += portraitsOuverts(paliers).length
      // Le portrait qu'il porte s'est vérifié quand il l'a pris, et se croit
      // désormais sur parole : un palier ne se perd pas. Celui que son savoir
      // ne lui donnait plus — une soirée retirée depuis — s'ôte ici, une fois.
      const rec = await deps.profiles.byId(profileId)
      if (rec && portrait(rec.legendaire) && !portraitsOuverts(paliers).includes(rec.legendaire!)) {
        await deps.profiles.update(profileId, { legendaire: null })
        issue.otes++
      }
    }
  }
  await deps.profiles.poserDrapeau(DRAPEAU)
  return issue
}

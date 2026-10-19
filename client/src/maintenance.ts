// Ce que la page servie dit de la maintenance (`<meta name="maintenance">`,
// posée par `ecrireLeService`, `server/src/core/page.ts`) : les pages fermées,
// et si celui qui regarde y entre encore — l'administrateur, qui vérifie la
// réparation avant de rouvrir. Lu une fois : la page ne change pas sous les
// yeux, rouverte elle se relit. Le bandeau, lui, est déjà dans la page : il
// n'a besoin d'aucun script.
//
// Sous `npm run dev`, Vite sert la page telle quelle : rien n'y est posé, et
// rien n'est fermé (règle `client.md`).
import { lireLesFermees, type PageEnMaintenance } from '../../shared/maintenance'

let lu: { fermees: ReadonlySet<PageEnMaintenance>; passe: boolean } | null = null

function lire(): { fermees: ReadonlySet<PageEnMaintenance>; passe: boolean } {
  if (lu) return lu
  const contenu = (nom: string): string | null => {
    try {
      return document.querySelector(`meta[name="${nom}"]`)?.getAttribute('content') ?? null
    } catch {
      // Hors d'une vraie page — un rendu de test —, rien n'est fermé.
      return null
    }
  }
  lu = { fermees: new Set(lireLesFermees(contenu('maintenance'))), passe: contenu('maintenance-passe') === 'oui' }
  return lu
}

/** Les pages fermées, pour tous : l'accueil le dit sur leurs boutons, à l'administrateur aussi. */
export const pagesEnMaintenance = (): ReadonlySet<PageEnMaintenance> => lire().fermees

/** Fermée à qui regarde : l'administrateur, lui, y entre encore. */
export const fermeePourMoi = (page: PageEnMaintenance): boolean => lire().fermees.has(page) && !lire().passe

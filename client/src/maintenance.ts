// Ce que la page servie dit de la maintenance (`<meta name="maintenance">`,
// `bientot`, `maintenance-passe`, `avant-premiere`, posées par
// `ecrireLeService`, `server/src/core/page.ts`) : les pages fermées — en
// maintenance, bientôt disponibles —, et si celui qui regarde y entre
// encore — l'administrateur partout, qui vérifie la réparation avant de
// rouvrir, un testeur dans celles qu'il essaie. Lu une fois : la page ne
// change pas sous les yeux, rouverte elle se relit. Le bandeau, lui, est déjà
// dans la page : il n'a besoin d'aucun script.
//
// Sous `npm run dev`, Vite sert la page telle quelle : rien n'y est posé, et
// rien n'est fermé (règle `client.md`).
import { boutonDeLaPage, fermeePour, lireLesFermees, PAGES_EN_MAINTENANCE, type BoutonDeLaPage, type PageEnMaintenance, type VuDuService } from '../../shared/maintenance'

let lu: VuDuService | null = null

function lire(): VuDuService {
  if (lu) return lu
  const contenu = (nom: string): string | null => {
    try {
      return document.querySelector(`meta[name="${nom}"]`)?.getAttribute('content') ?? null
    } catch {
      // Hors d'une vraie page — un rendu de test —, rien n'est fermé.
      return null
    }
  }
  lu = {
    fermees: lireLesFermees(contenu('maintenance')),
    bientot: lireLesFermees(contenu('bientot')),
    admin: contenu('maintenance-passe') === 'oui',
    avantPremiere: lireLesFermees(contenu('avant-premiere')),
  }
  return lu
}

/** En maintenance, pour tous : l'administrateur, qui y entre, le lit sur l'onglet du défi. */
export const enMaintenance = (page: PageEnMaintenance): boolean => lire().fermees.includes(page)

/** Fermée à qui regarde, et pourquoi ; null s'il y entre — l'administrateur partout, un testeur dans la sienne. */
export const fermeePourMoi = (page: PageEnMaintenance): 'maintenance' | 'bientot' | null => fermeePour(lire(), page)

/** Ce que l'accueil dit de chaque page sur son bouton (`boutonDeLaPage`) ; rien pour une page ouverte. */
export function boutonsDesPages(): Partial<Record<PageEnMaintenance, BoutonDeLaPage>> {
  const vu = lire()
  return Object.fromEntries(PAGES_EN_MAINTENANCE.flatMap(p => (boutonDeLaPage(vu, p) ? [[p, boutonDeLaPage(vu, p)]] : [])))
}

/** Son bouton de l'accueil est éteint : ce qui y mène se tait — la bannière d'un résultat de duel. */
export const boutonEteint = (page: PageEnMaintenance): boolean => {
  const bouton = boutonDeLaPage(lire(), page)
  return bouton === 'maintenance' || bouton === 'bientot'
}

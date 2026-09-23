// Entre deux soirées, les pages de l'espace montrent la dernière soirée close.
//
// La clôture efface la soirée en cours. Le souvenir et le bilan de l'espace —
// où mène le QR du podium, scanné pendant la soirée — accueillaient l'invité
// qui les rouvrait le lendemain d'un « La soirée n'a pas encore commencé ».
// Tant que la suivante n'a rien joué, le serveur leur fait désigner la
// dernière soirée close (`derniere`) : la page la lit et la montre à sa
// place, sous l'adresse de l'espace, puis revient d'elle-même à la soirée en
// cours dès qu'une question y est jouée. Pas de redirection vers l'archive :
// l'animateur qui ouvre le souvenir avant le premier quiz, pour le garder
// sous la main, y resterait bloqué sur la soirée d'avant.

import type { DerniereSoiree } from '../../shared/archive'
import { dataUrl } from './routes'

async function lireJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return (await r.json()) as T
}

/**
 * Le lecteur d'une page de l'espace : la soirée en cours, ou l'archive que
 * désigne l'adresse — et, entre deux soirées, la dernière soirée close.
 * Celle-ci ne se lit qu'une fois par soirée désignée : une page ouverte se
 * rafraîchit toutes les vingt secondes, une archive ne bouge plus.
 */
export function lecteurDePage<T extends { derniere?: DerniereSoiree }>(
  slug: string,
  fichier: 'recap.json' | 'bilan.json',
  archiveId: string | null,
): () => Promise<T> {
  let gardee: { id: string; page: T } | null = null
  return async () => {
    const page = await lireJson<T>(dataUrl(slug, fichier, archiveId))
    const derniere = archiveId ? undefined : page.derniere
    if (!derniere) return page
    if (gardee?.id !== derniere.id) {
      // Retirée de l'historique entre les deux lectures, ou le réseau qui
      // flanche : la page de l'espace telle quelle, et on réessaiera.
      const archive = await lireJson<T>(dataUrl(slug, fichier, derniere.id)).catch(() => null)
      if (!archive) return page
      gardee = { id: derniere.id, page: archive }
    }
    return gardee.page
  }
}

// Ce que le serveur dit d'une adresse avant même que le client ne s'ouvre :
// son statut, sa redirection, ses balises d'aperçu et son indexation.
//
// Toutes les adresses rendaient le même HTML, en 200 : un lien collé dans
// WhatsApp ne montrait rien, une adresse inconnue passait pour une page, et
// rien n'empêchait un moteur de ranger les souvenirs de soirée. Le client ne
// peut rien y faire — un aperçu de lien n'exécute aucun script.
//
// Rien ici ne nomme un invité : le titre vient des réglages de l'espace, que
// son entrée affiche déjà à qui scanne le QR. Et un espace inconnu vaut
// « introuvable », sans rien dire des autres (invariant 3) — sauf la seule
// devinette permise, `chez-‹saisie›`, qui ne mène qu'à l'adresse qu'on
// aurait trouvée en tapant les cinq lettres de plus.

import { parseRoute, slugTape, type PublicPage } from '../../../shared/adresses'
import type { PublicSpace } from '../../../shared/space'

export const NOM_APPLI = 'FiestApp'
export const PROMESSE = 'Le quiz de soirée : les invités jouent depuis leur téléphone, un écran commun anime la salle.'

export type DecisionPage =
  | { redirection: string }
  | {
      statut: 200 | 404
      titre: string
      description: string
      /** Seul l'accueil se laisse ranger par un moteur : le reste est une soirée privée. */
      indexable: boolean
      /** Une soirée archivée dont l'existence reste à vérifier (dans la base permanente). */
      archive?: { spaceSlug: string; id: string }
    }

const DESCRIPTIONS: Record<PublicPage, string> = {
  souvenir: 'Le podium, les prix et les chiffres de la soirée.',
  stats: 'Le podium, les prix et les chiffres de la soirée.',
  bilan: 'Chaque question, et ce que la salle a répondu.',
  'bilan/fiches': 'Chaque question, et ce que la salle a répondu.',
  soirees: 'Toutes les soirées de cet espace.',
}
const SUFFIXES: Record<PublicPage, string> = {
  souvenir: 'Souvenir',
  stats: 'Souvenir',
  bilan: 'Bilan',
  'bilan/fiches': 'Bilan',
  soirees: 'Les soirées',
}

export const INTROUVABLE = {
  statut: 404 as const,
  titre: `Soirée introuvable · ${NOM_APPLI}`,
  description: 'Cette adresse ne mène à aucune soirée.',
  indexable: false,
}

/**
 * Lit une adresse. `trouver` rend l'espace d'un nom exact, ou rien — il ne
 * sert qu'à dire oui ou non, jamais à chercher un voisin.
 */
export function decrirePage(chemin: string, trouver: (slug: string) => PublicSpace | undefined): DecisionPage {
  const route = parseRoute(chemin)
  if (route.kind === 'landing') return { statut: 200, titre: `${NOM_APPLI} · le quiz de soirée`, description: PROMESSE, indexable: true }
  if (route.kind === 'account') return { statut: 200, titre: NOM_APPLI, description: PROMESSE, indexable: false }
  if (route.kind === 'unknown') return INTROUVABLE

  const segments = chemin.split('/').filter(Boolean)
  const reste = segments.slice(1).join('/')
  const vers = (slug: string) => `/${slug}${reste ? `/${reste}` : ''}`

  const espace = trouver(route.slug)
  if (!espace) {
    // « nadia » quand l'espace s'appelle « chez-nadia » : Nadia a dit « c'est
    // chez Nadia », deux invitées ont tapé son prénom. On essaie cette seule
    // forme, et on ne propose jamais rien d'autre.
    const devine = route.slug.startsWith('chez-') ? '' : slugTape(`chez-${route.slug}`)
    if (devine && trouver(devine)) return { redirection: vers(devine) }
    return INTROUVABLE
  }
  // L'adresse telle qu'on l'a tapée (« /Chez-Bruno ») devient celle de
  // l'espace : c'est elle qu'on recopiera ou qu'on partagera ensuite.
  if (segments[0] !== espace.slug) return { redirection: vers(espace.slug) }

  if (route.kind === 'join') {
    return {
      statut: 200,
      titre: espace.title,
      description: 'Rejoins le quiz depuis ton téléphone : un prénom, et c’est parti.',
      indexable: false,
    }
  }
  return {
    statut: 200,
    titre: `${espace.title} · ${SUFFIXES[route.page]}`,
    description: DESCRIPTIONS[route.page],
    indexable: false,
    ...(route.archiveId ? { archive: { spaceSlug: espace.slug, id: route.archiveId } } : {}),
  }
}

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * Pose le titre et les balises d'une page dans le HTML du client. `base` est
 * l'origine publique : un aperçu de lien ne lit qu'une image à adresse
 * complète.
 */
export function habillerPage(
  html: string,
  page: { titre: string; description: string; indexable: boolean },
  base: string,
  chemin: string,
): string {
  const titre = echapper(page.titre)
  const description = echapper(page.description)
  const balises = [
    `<meta name="description" content="${description}">`,
    page.indexable ? '' : '<meta name="robots" content="noindex, nofollow">',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${NOM_APPLI}">`,
    `<meta property="og:title" content="${titre}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${echapper(base)}/icone-512.png">`,
    `<meta property="og:url" content="${echapper(base + chemin)}">`,
    `<meta name="twitter:card" content="summary">`,
  ]
    .filter(Boolean)
    .join('\n    ')
  // Des fonctions, pas des chaînes : une chaîne de remplacement lit « $& »,
  // « $` », « $' » et « $$ », et le titre « Soirée $& co » recopiait le
  // `<title>` d'origine au milieu de la page.
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${titre}</title>`)
    .replace('</head>', () => `  ${balises}\n  </head>`)
}

/**
 * Pour les robots : l'accueil seul. Les pages de soirée portent aussi leur
 * `noindex` — un robot qui ne lit pas ce fichier ne les rangera pas pour
 * autant —, et les données (`/s/`) ni l'API n'ont rien à y faire.
 */
export const ROBOTS_TXT = ['User-agent: *', 'Disallow: /s/', 'Disallow: /api/', 'Disallow: /media/', ''].join('\n')

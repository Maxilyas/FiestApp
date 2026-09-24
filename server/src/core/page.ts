// La page que reçoit le téléphone d'un invité, nommée avant tout script.
//
// Entre le scan du QR et l'écran d'entrée, il y a une seconde de téléchargement
// en 4G — celle où l'on se demande si le QR a marché. Elle affichait
// « Chargement… » sur un écran noir. Le serveur connaît l'espace à l'adresse :
// il glisse le nom de la soirée dans la page, et l'attente dit déjà « La
// soirée d'Antoine », à la place où l'entrée l'écrira.
//
// Rien qui ne soit déjà public : c'est ce que `space.json` dit à quiconque, et
// l'entrée elle-même. Une adresse inconnue reçoit la page nue, comme avant.

import { RESERVED_SLUGS, SLUG, type PublicSpace } from '../../../shared/space'

/** L'espace qu'ouvre l'adresse d'un téléphone d'invité (`/<espace>`), s'il y en a un. */
export function espaceDeLEntree(chemin: string): string | null {
  const parts = chemin.split('/').filter(Boolean)
  if (parts.length !== 1) return null
  const [slug] = parts
  return SLUG.test(slug) && !RESERVED_SLUGS.has(slug) ? slug : null
}

const ENTITES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const echapper = (texte: string) => texte.replace(/[&<>"']/g, c => ENTITES[c])

/**
 * La page, nommée : le titre de l'onglet, et deux balises que le repli du
 * client lit (`client/src/annonce.tsx`). Les remplacements passent par une
 * fonction : un titre qui contiendrait « $& » ne doit rien réinjecter.
 */
export function pageDEntree(html: string, space: Pick<PublicSpace, 'title' | 'eyebrow' | 'headline'>): string {
  const metas =
    `<meta name="soiree-eyebrow" content="${echapper(space.eyebrow)}">\n` +
    `    <meta name="soiree-headline" content="${echapper(space.headline)}">`
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${echapper(space.title)}</title>`)
    .replace('</head>', () => `  ${metas}\n  </head>`)
}

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
//
// Toute page reçoit aussi, avant son script, ce qu'elle va demander au
// serveur (`prechargerDonnees`) et son attente déjà écrite (`ecrireAttente`) :
// le temps de l'affichage passait à attendre, en file — la page, son script,
// son code, puis ses données (`retours/2026-10-05/affichage-des-pages.md`).

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

/**
 * Les données de départ de la page, demandées avec son script
 * (`shared/depart.ts`) : sans elles, la page attendait son code pour les
 * demander — un aller-retour de plus, cache plein compris. `crossorigin` :
 * le `fetch` de la page est en mode cors, même chez soi, et un préchargement
 * d'un autre mode ne lui servirait pas.
 */
export function prechargerDonnees(html: string, adresses: string[]): string {
  if (adresses.length === 0) return html
  const liens = adresses.map(a => `<link rel="preload" as="fetch" href="${echapper(a)}" crossorigin>`).join('\n    ')
  return html.replace('</head>', () => `  ${liens}\n  </head>`)
}

/**
 * L'attente, écrite dans la page : elle ne paraissait qu'une fois React
 * exécuté — 0,7 s en 4G, 2 s en 4G lente —, elle paraît dès la feuille de
 * style arrivée. Le même balisage que `Patience` (`client/src/annonce.tsx`),
 * que React remet à sa place sans que rien ne bouge : pour l'invité, le nom
 * de la soirée et « On arrive… » ; ailleurs, « Chargement… ».
 */
export function ecrireAttente(html: string, entete?: Pick<PublicSpace, 'eyebrow' | 'headline'>): string {
  const attente = entete?.headline
    ? `<div class="join entree"><div class="join-head"><span class="join-eyebrow">${echapper(entete.eyebrow)}</span>` +
      `<h1 class="join-title${entete.headline.length > 12 ? ' compact' : ''}">${echapper(entete.headline)}</h1></div>` +
      `<div class="attente" role="status"><p class="muted">On arrive…</p></div></div>`
    : `<div class="center-page"><div class="attente" role="status"><p class="muted">Chargement…</p></div></div>`
  return html.replace('<div id="root"></div>', () => `<div id="root">${attente}</div>`)
}

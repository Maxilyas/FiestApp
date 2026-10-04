import type { ReactNode } from 'react'

/**
 * Les icônes de l'interface : un trait de 1,8 px, la couleur du texte qui
 * les porte. Elles remplacent les emojis d'interface — les avatars et les
 * emojis d'équipe, eux, restent des emojis : ce sont les invités qui les
 * choisissent.
 *
 * Décoratives par défaut (`aria-hidden`) : le libellé à côté dit déjà tout.
 * Quand une icône est seule (bouton son, plein écran), c'est le bouton qui
 * porte le `aria-label`.
 */
export type IconName =
  | 'alert'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-up'
  | 'award'
  | 'bar-chart'
  | 'bell'
  | 'bell-off'
  | 'book'
  | 'camera'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'clipboard'
  | 'clock'
  | 'copy'
  | 'crown'
  | 'download'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'flag'
  | 'hash'
  | 'home'
  | 'keyboard'
  | 'list'
  | 'lock'
  | 'maximize'
  | 'message'
  | 'more'
  | 'music'
  | 'image'
  | 'archive'
  | 'search'
  | 'share'
  | 'shuffle'
  | 'monitor'
  | 'smartphone'
  | 'moon'
  | 'pause'
  | 'play'
  | 'plus'
  | 'rotate'
  | 'skip'
  | 'sparkles'
  | 'star'
  | 'sun'
  | 'target'
  | 'timer'
  | 'trash'
  | 'trophy'
  | 'users'
  | 'volume'
  | 'volume-off'
  | 'x'
  | 'x-circle'
  | 'zap'
  // Les emblèmes des catégories, sur les écussons de savoir.
  | 'bulb'
  | 'globe'
  | 'leaf'
  | 'palette'
  | 'utensils'
  | 'dice'
  | 'glass'
  | 'shield'

/** Tracées au trait, sauf `filled` : lecture, pause, avance rapide. */
const ICONS: Record<IconName, { paths: ReactNode; filled?: boolean }> = {
  // Les réglages du hasard, l'ordre gardé, le menu d'une ligne, la recherche,
  // le partage, l'extrait sonore, la photo de la révélation, l'anecdote.
  shuffle: { paths: <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /> },
  lock: {
    paths: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
  },
  more: {
    filled: true,
    paths: (
      <>
        <circle cx="5" cy="12" r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="19" cy="12" r="1.9" />
      </>
    ),
  },
  search: {
    paths: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20.5 20.5-4.2-4.2" />
      </>
    ),
  },
  share: {
    paths: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </>
    ),
  },
  music: {
    paths: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
  },
  image: {
    paths: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.5-3.5L6 21" />
      </>
    ),
  },
  message: { paths: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /> },
  alert: {
    paths: (
      <>
        <path d="M12 4 2.5 20h19L12 4Z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    ),
  },
  'arrow-down': { paths: <path d="M12 5v14M6 13l6 6 6-6" /> },
  'arrow-left': { paths: <path d="M19 12H5M11 6l-6 6 6 6" /> },
  archive: {
    paths: (
      <>
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
      </>
    ),
  },
  'arrow-up': { paths: <path d="M12 19V5M6 11l6-6 6 6" /> },
  award: {
    paths: (
      <>
        <circle cx="12" cy="9" r="5.5" />
        <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
      </>
    ),
  },
  'bar-chart': { paths: <path d="M5 20v-9M12 20V4M19 20v-6" /> },
  // Le rappel du soir du quiz du jour ; barrée, les notifications bloquées.
  bell: {
    paths: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 6.5-2.5 8-2.5 8h17S18 15.5 18 9Z" />
        <path d="M10.3 20.5a2 2 0 0 0 3.4 0" />
      </>
    ),
  },
  'bell-off': {
    paths: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 6.5-2.5 8-2.5 8h17S18 15.5 18 9Z" />
        <path d="M10.3 20.5a2 2 0 0 0 3.4 0M3.5 3.5l17 17" />
      </>
    ),
  },
  book: {
    paths: (
      <>
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5V4.5Z" />
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      </>
    ),
  },
  camera: {
    paths: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
        <circle cx="12" cy="13" r="3.2" />
      </>
    ),
  },
  check: { paths: <path d="M5 12.5 10 17.5 19 7" /> },
  'check-circle': {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.5 2.5L16 9.5" />
      </>
    ),
  },
  'chevron-down': { paths: <path d="m6 9 6 6 6-6" /> },
  clipboard: {
    paths: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M9 11h6M9 15h6" />
      </>
    ),
  },
  clock: {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  copy: {
    paths: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
  },
  crown: { paths: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" /> },
  download: {
    paths: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14" />,
  },
  edit: {
    paths: (
      <>
        <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
        <path d="m13 7 4 4" />
      </>
    ),
  },
  eye: {
    paths: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  'eye-off': {
    paths: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.2" />
        <path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      </>
    ),
  },
  flag: {
    paths: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h12l-2.5 4L17 12H5" />
      </>
    ),
  },
  hash: { paths: <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /> },
  keyboard: {
    paths: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
      </>
    ),
  },
  list: {
    paths: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
      </>
    ),
  },
  maximize: { paths: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /> },
  // L'accueil, sur les pages de l'animateur.
  home: { paths: <path d="M3 10.5 12 3l9 7.5M5.5 8.5V21h13V8.5M10 21v-6h4v6" /> },
  monitor: {
    paths: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  smartphone: {
    paths: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
  },
  moon: { paths: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /> },
  pause: {
    paths: (
      <>
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </>
    ),
    filled: true,
  },
  play: { paths: <path d="M6 4l14 8-14 8V4Z" />, filled: true },
  plus: { paths: <path d="M12 5v14M5 12h14" /> },
  rotate: {
    paths: (
      <>
        <path d="M3 4v6h6" />
        <path d="M4.5 14A8 8 0 1 0 6.5 7L3 10" />
      </>
    ),
  },
  skip: {
    paths: (
      <>
        <path d="M5 5l9 7-9 7V5Z" />
        <rect x="16" y="5" width="3" height="14" rx="1" />
      </>
    ),
    filled: true,
  },
  sparkles: {
    paths: (
      <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
      </>
    ),
  },
  star: { paths: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" /> },
  sun: {
    paths: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
      </>
    ),
  },
  target: {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.2" />
      </>
    ),
  },
  timer: {
    paths: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" />
      </>
    ),
  },
  trash: {
    paths: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
  },
  trophy: {
    paths: (
      <>
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
        <path d="M12 14v3M8 21h8M9.5 17h5v4h-5z" />
      </>
    ),
  },
  users: {
    paths: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
        <path d="M17.5 13.6A6.5 6.5 0 0 1 21.5 20" />
      </>
    ),
  },
  volume: {
    paths: (
      <>
        <path d="M4 10v4h4l5 4V6L8 10H4Z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
      </>
    ),
  },
  'volume-off': {
    paths: (
      <>
        <path d="M4 10v4h4l5 4V6L8 10H4Z" />
        <path d="m17 9 4 6M21 9l-4 6" />
      </>
    ),
  },
  x: { paths: <path d="M6 6l12 12M18 6 6 18" /> },
  'x-circle': {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </>
    ),
  },
  zap: { paths: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /> },
  // Les emblèmes des catégories qui n'en avaient pas : la culture générale,
  // la géographie, la nature, les arts et lettres, la cuisine, les jeux, la
  // fête (`components/Ecusson.tsx`).
  bulb: {
    paths: (
      <>
        <path d="M9.5 18h5M10.5 21h3" />
        <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3Z" />
      </>
    ),
  },
  globe: {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" />
      </>
    ),
  },
  leaf: {
    paths: (
      <>
        <path d="M5 20c0-9 5.5-15 15-15 0 9.5-6 15-15 15Z" />
        <path d="M5 20l9-9" />
      </>
    ),
  },
  palette: {
    paths: (
      <>
        <path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-1-.8-1.5-.8-2.4 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
        <circle cx="7.5" cy="11.5" r="1" />
        <circle cx="10" cy="7" r="1" />
        <circle cx="15" cy="7.5" r="1" />
      </>
    ),
  },
  utensils: {
    paths: (
      <>
        <path d="M6 3v6a2 2 0 0 0 4 0V3M8 11v10" />
        <path d="M18 21V3c-2.2 1.3-3.5 4-3.5 7.5V13H18" />
      </>
    ),
  },
  dice: {
    paths: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="9" cy="9" r="0.6" />
        <circle cx="15" cy="9" r="0.6" />
        <circle cx="12" cy="12" r="0.6" />
        <circle cx="9" cy="15" r="0.6" />
        <circle cx="15" cy="15" r="0.6" />
      </>
    ),
  },
  shield: { paths: <path d="M12 3 20 6v5.5c0 4.8-3.3 8.6-8 10.5-4.7-1.9-8-5.7-8-10.5V6l8-3Z" /> },
  glass: {
    paths: (
      <>
        <path d="M6 4h12l-1.4 5.2a4.8 4.8 0 0 1-9.2 0L6 4Z" />
        <path d="M12 14v6M8.5 20h7" />
      </>
    ),
  },
}

export function Icon({ name, size, className }: { name: IconName; size?: number; className?: string }) {
  const { paths, filled } = ICONS[name]
  return (
    <svg
      className={'icon' + (className ? ' ' + className : '')}
      viewBox="0 0 24 24"
      style={size ? { width: size, height: size } : undefined}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  )
}

/**
 * La série de jours joués : une flamme au trait. Ici plutôt qu'avec le quiz
 * du jour (`Jour.tsx`) : la carte d'un joueur et la fin de soirée la
 * montrent aussi, et la tirer de là faisait venir tout le quiz du jour avec
 * elles.
 */
export function Flamme({ className }: { className?: string }) {
  return (
    <svg className={'icon flamme' + (className ? ` ${className}` : '')} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21.5c3.9 0 6.4-2.5 6.4-6 0-3.2-2.1-5.2-3.3-6.9-.4 1.5-1.2 2.5-2.2 2.9.3-3-1.2-5.8-3.7-7.5.3 2.7-1 4.4-2.4 6.1-1.3 1.6-1.2 3.4-1.2 5.3 0 3.6 2.5 6.1 6.4 6.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

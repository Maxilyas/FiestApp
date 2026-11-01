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
  | 'arrow-right'
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
  | 'chevron-right'
  | 'clipboard'
  | 'clock'
  | 'copy'
  | 'crown'
  | 'download'
  | 'edit'
  | 'effacer'
  | 'eye'
  | 'eye-off'
  | 'flag'
  | 'hash'
  | 'hanger'
  | 'home'
  | 'keyboard'
  | 'list'
  | 'lock'
  | 'maximize'
  | 'megaphone'
  | 'message'
  | 'more'
  | 'more-vertical'
  | 'music'
  | 'image'
  | 'archive'
  | 'search'
  | 'share'
  | 'share-ios'
  | 'shuffle'
  | 'monitor'
  | 'smartphone'
  | 'moon'
  | 'pause'
  | 'play'
  | 'plus'
  | 'plus-square'
  | 'rotate'
  | 'skip'
  | 'sparkles'
  | 'star'
  | 'sun'
  | 'swords'
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
  // Les thèmes de la campagne (`client/src/iconeDuSujet.ts`).
  | 'paw'
  | 'volcan'
  | 'medal'
  | 'dancer'
  | 'stethoscope'
  | 'code'
  | 'telescope'
  | 'gamepad'
  | 'bulles'
  | 'landmark'
  | 'lettres'
  | 'hi'
  | 'enye'
  // Les fêtes de la campagne : Noël, Halloween, le Nouvel An, les anniversaires.
  | 'sapin'
  | 'citrouille'
  | 'artifice'
  | 'gateau'
  // Les pays de la campagne, tous du même repère.
  | 'repere'
  // Les univers de la campagne : Disney, Harry Potter, James Bond, Marvel, le Seigneur des anneaux, Star Wars, Stargate.
  | 'chateau'
  | 'baguette'
  | 'noeud'
  | 'bouclier'
  | 'anneau'
  | 'sabre'
  | 'porte'
  // Les fils rouges du 17 octobre 2026 au soir : Paris, la mer, l'outre-mer, les citations, le calcul mental.
  | 'tour-eiffel'
  | 'ancre'
  | 'palmier'
  | 'guillemets'
  | 'operations'
  // Puis la Révolution et l'Empire, l'aviation, les présidents de la République, les dinosaures.
  | 'bicorne'
  | 'avion'
  | 'pupitre'
  | 'dinosaure'
  // Les duels : le temps qui reste, sans chrono, l'aide, une vie, un résultat qui attend.
  | 'hourglass'
  | 'infinity'
  | 'help'
  | 'heart'
  | 'spark'
  // L'album des avatars : où chacun se gagne — sur les sentiers, à sa saison, en boutique.
  | 'mountain'
  | 'calendar'
  | 'bag'
  // Les signalements du QG : reclasser une question.
  | 'tag'
  // Les missions du jour et le coffre de la semaine.
  | 'coffre'
  | 'missions'
  // L'expédition : la source qui rend une vie, le campement avant le gardien ;
  // ses écus, l'échoppe qui les dépense, la boussole et le maillot jaune ;
  // le tampon de son passeport ; une fiole, à boire quand on veut.
  | 'source'
  | 'campement'
  | 'ecu'
  | 'echoppe'
  | 'boussole'
  | 'maillot'
  | 'tampon'
  | 'fiole'

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
  // Les gestes qui installent l'application (`Installer.tsx`), dessinés comme
  // le téléphone les montre : le « Partager » de Safari, « Sur l'écran
  // d'accueil », le menu de Chrome.
  'share-ios': {
    paths: (
      <>
        <path d="M12 3v11M8 6.5 12 3l4 3.5" />
        <path d="M8.5 10H6.5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2" />
      </>
    ),
  },
  'plus-square': {
    paths: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3.5" />
        <path d="M12 8.5v7M8.5 12h7" />
      </>
    ),
  },
  'more-vertical': {
    filled: true,
    paths: (
      <>
        <circle cx="12" cy="5" r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="12" cy="19" r="1.9" />
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
  // L'annonce de l'administrateur à tous : son onglet du QG, sa carte sur l'accueil.
  megaphone: {
    paths: (
      <>
        <path d="m3 11 18-5v12L3 14v-3Z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </>
    ),
  },
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
  // Les quatre pas de l'épingle, au pied de l'Épingle : vers l'est, la flèche d'en face.
  'arrow-right': { paths: <path d="M5 12h14M13 6l6 6-6 6" /> },
  // La touche qui efface la dernière lettre, au clavier du Mot mystère : le mot « Effacer » ne tenait pas dans une touche de
  // 360 px de large, et « ⌫ » n'est dans aucune de nos polices — il venait d'une autre, ou en carré sous Windows 10.
  effacer: {
    paths: (
      <>
        <path d="M21 5H9l-7 7 7 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
        <path d="m17 9-5 6M12 9l5 6" />
      </>
    ),
  },
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
  'chevron-right': { paths: <path d="m9 6 6 6-6 6" /> },
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
  // La loge, où l'on s'habille : un cintre.
  hanger: {
    paths: (
      <>
        <path d="M12 9.5V8a2.25 2.25 0 1 0-2.25-2.25" />
        <path d="M12 9.5 3.4 15.6A1.3 1.3 0 0 0 4.2 18h15.6a1.3 1.3 0 0 0 .8-2.4L12 9.5Z" />
      </>
    ),
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
  // Deux épées croisées : les duels, sur l'accueil et sur leur page.
  swords: {
    paths: (
      <>
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
        <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
        <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
        <path d="M5 14l4 4M7 17l-3 3M3 19l2 2" />
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
  // Les thèmes que les emblèmes des catégories ne disaient pas : la feuille
  // de la nature, le globe de la géographie, la cible du sport y auraient
  // fait croire à une catégorie.
  paw: {
    paths: (
      <>
        <circle cx="5.5" cy="10.5" r="1.8" />
        <circle cx="9.5" cy="5.8" r="1.8" />
        <circle cx="14.5" cy="5.8" r="1.8" />
        <circle cx="18.5" cy="10.5" r="1.8" />
        <path d="M12 11.5c-2.6 0-5.5 3.3-5.5 5.9 0 1.6 1.2 2.6 2.7 2.6 1.1 0 1.9-.6 2.8-.6s1.7.6 2.8.6c1.5 0 2.7-1 2.7-2.6 0-2.6-2.9-5.9-5.5-5.9Z" />
      </>
    ),
  },
  // Un volcan qui fume au-dessus de la vague : volcans et océans. La planète à
  // anneau qu'avait la Terre et l'espace est partie avec l'espace.
  volcan: {
    paths: (
      <>
        <path d="M3.5 17.5 9 8.5c1 .9 2 1.3 3 1.3s2-.4 3-1.3l5.5 9" />
        <path d="M10.6 6.2a1.7 1.7 0 0 1 1.5-2.6 2 2 0 0 1 3.7.4 1.5 1.5 0 0 1-.3 2.9" />
        <path d="M3 20.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
      </>
    ),
  },
  medal: {
    paths: (
      <>
        <path d="M7.5 3 10.2 9.4M16.5 3l-2.7 6.4" />
        <circle cx="12" cy="15" r="6" />
        <circle cx="12" cy="15" r="2.4" />
      </>
    ),
  },
  // Une danseuse en tutu, les bras ouverts, une jambe repliée : la danse. La
  // note de musique aurait fait croire à la catégorie Musique, et une
  // silhouette sans tutu, essayée, se lisait comme un coureur.
  dancer: {
    paths: (
      <>
        <circle cx="12" cy="3.6" r="1.6" />
        <path d="M6.2 8.4c1.9-.9 3.8-1.3 5.8-1.3s3.9.4 5.8 1.3M12 5.3v5.4" />
        <path d="M7.2 13.4 9.4 10.7h5.2l2.2 2.7Z" />
        <path d="M11 13.4V21M13 13.4l1.8 4.2-1.6 3" />
      </>
    ),
  },
  // Le stéthoscope : les métiers de la santé, l'outil que tous reconnaissent.
  stethoscope: {
    paths: (
      <>
        <path d="M4.5 3.5h2M12.5 3.5h2M5.5 3.5V8a4 4 0 0 0 8 0V3.5" />
        <path d="M9.5 12v2.5a4.5 4.5 0 0 0 9 0v-2" />
        <circle cx="18.5" cy="10.5" r="2" />
      </>
    ),
  },
  // Les chevrons d'une balise : l'informatique. L'écran était pris par le
  // petit écran, la planète par la Terre et l'espace — d'où la lunette pour
  // l'astronomie, posée sur son trépied, qu'elle a gardée.
  code: { paths: <path d="M8 7 3 12l5 5M16 7l5 5-5 5M13.5 5l-3 14" /> },
  telescope: {
    paths: (
      <>
        <path d="m4 11.5 12.5-6.2 1.8 3.6L5.8 15.1Z" />
        <path d="m18.3 4.4 2.2-1.1 1.8 3.6-2.2 1.1" />
        <path d="m11 12.5-3.5 8.5M11 12.5l3.5 8.5" />
      </>
    ),
  },
  // Une manette, deux bulles de BD (une seule était prise par les surnoms),
  // un fronton à colonnes : les jeux vidéo, la BD, les monuments.
  gamepad: {
    paths: (
      <>
        <path d="M7 7h10a5 5 0 0 1 4.6 7l-1 2.4a2.6 2.6 0 0 1-4.3.7L14.5 15h-5l-1.8 2.1a2.6 2.6 0 0 1-4.3-.7l-1-2.4A5 5 0 0 1 7 7Z" />
        <path d="M7.5 9.8v3M6 11.3h3M15.5 11h.01M17.5 12.5h.01" />
      </>
    ),
  },
  bulles: {
    paths: (
      <>
        <path d="M3 4.5h11v7.5H8l-3 2.5V12H3Z" />
        <path d="M17 8h4v8h-2v2.5L16 16h-6v-1.5" />
      </>
    ),
  },
  landmark: { paths: <path d="M3 9.5 12 4l9 5.5ZM4 20.5h16M5.5 17.5h13M6.5 10.5v7M10 10.5v7M14 10.5v7M17.5 10.5v7" /> },
  // « Aa », une capitale et sa minuscule : la langue française. Le livre était
  // pris par l'origine des mots.
  lettres: {
    paths: (
      <>
        <path d="M2.5 19 8 5l5.5 14M4.6 14h6.8" />
        <circle cx="17.5" cy="16" r="3" />
        <path d="M20.5 12.5V19" />
      </>
    ),
  },
  // « Hi » pour l'anglais, la ñ pour l'espagnol : deux langues, deux lettres,
  // comme le « Aa » du français — pas un drapeau, l'anglais n'est pas qu'anglais.
  hi: { paths: <path d="M5 6v12M12.5 6v12M5 12h7.5M18 11v7M18 7.2v.01" /> },
  enye: { paths: <path d="M8.5 19v-8.5M8.5 13.5a3.5 3.5 0 0 1 7 0V19M8 7.5c1.1-1.3 2.3-1.5 3.6-.6s2.6.8 3.9-.7" /> },
  // Les fêtes (le 17 octobre 2026) : le sapin de Noël et son pied, la citrouille et ses côtes, le feu
  // d'artifice du Nouvel An, le gâteau et ses trois bougies. L'amour a déjà son cœur.
  sapin: { paths: <path d="M12 2.8 7.4 8.6h2.4l-3.6 4.8h2.6L5 18.6h14l-3.8-5.2h2.6l-3.6-4.8h2.4L12 2.8ZM12 18.6v2.8" /> },
  citrouille: {
    paths: (
      <>
        <path d="M12 7.5c-1.2-.9-2.6-1.3-4.2-1.3C5.1 6.2 3 9 3 13s2.1 6.8 4.8 6.8c1.6 0 3-.4 4.2-1.3 1.2.9 2.6 1.3 4.2 1.3 2.7 0 4.8-2.8 4.8-6.8s-2.1-6.8-4.8-6.8c-1.6 0-3 .4-4.2 1.3Z" />
        <path d="M12 7.5c-1.3 1.4-2 3.3-2 5.5s.7 4.1 2 5.5c1.3-1.4 2-3.3 2-5.5s-.7-4.1-2-5.5ZM12 7.5V4.5c0-.9.5-1.5 1.5-1.8" />
      </>
    ),
  },
  artifice: { paths: <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M5.6 18.4l2.5-2.5M15.9 8.1l2.5-2.5M12 10.5v3M10.5 12h3" /> },
  // Le repère d'une carte : un pays. Quatorze drapeaux ne tiennent pas dans un
  // trait, et ceux des emojis s'écrivent en lettres sous Windows 10 (« IT »).
  repere: {
    paths: (
      <>
        <path d="M12 21.2c-3.9-4.4-6.6-8.1-6.6-11.2a6.6 6.6 0 0 1 13.2 0c0 3.1-2.7 6.8-6.6 11.2Z" />
        <circle cx="12" cy="10" r="2.4" />
      </>
    ),
  },
  // Les univers : chacun l'objet qu'on reconnaît de loin — le château de
  // Disney, la baguette du sorcier, le nœud papillon de 007, le bouclier
  // étoilé, l'Anneau unique, le sabre laser. Un logo aurait été une marque.
  chateau: {
    paths: (
      <>
        <path d="M3.5 21h17M5.5 21v-8M9.5 21v-8M4.8 13 7.5 8.5l2.7 4.5M14.5 21v-8M18.5 21v-8M13.8 13l2.7-4.5 2.7 4.5" />
        <path d="M9.5 15h5M10.5 15V9.8L12 6.5l1.5 3.3V15M11 21v-2.6a1 1 0 0 1 2 0V21" />
      </>
    ),
  },
  baguette: {
    paths: (
      <>
        <path d="M3.6 19 13.3 9.3l1.4 1.4L5 20.4Z" />
        <path d="M17 3.5v3.2M15.4 5.1h3.2M19.8 9.3v2M18.8 10.3h2M12.6 4.2v1.6M11.8 5h1.6" />
      </>
    ),
  },
  noeud: {
    paths: (
      <>
        <path d="M3 8.5v7l6.5-2.4v-2.2L3 8.5ZM21 8.5v7l-6.5-2.4v-2.2L21 8.5Z" />
        <path d="M9.5 10.3h5v3.4h-5Z" />
      </>
    ),
  },
  bouclier: {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5.6" />
        <path d="m12 9.3.8 1.7 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.7.9.4-1.8-1.3-1.2 1.8-.2Z" />
      </>
    ),
  },
  anneau: {
    paths: (
      <>
        <ellipse cx="12" cy="13.5" rx="8" ry="4.6" />
        <ellipse cx="12" cy="12.6" rx="5.4" ry="2.6" />
        <path d="M18 4v2.6M16.7 5.3h2.6" />
      </>
    ),
  },
  sabre: {
    paths: (
      <>
        <path d="M10.6 13.4 19.8 4.2M7.6 12.6l3.8 3.8" />
        <path d="M3.4 19.2 8.6 14l1.4 1.4-5.2 5.2Z" />
      </>
    ),
  },
  // Stargate (le 1er novembre 2026) : l'anneau de la porte des étoiles, le
  // seul objet que les trois séries partagent, et trois de ses chevrons —
  // cinq, en 28 pixels, en faisaient une roue dentée.
  porte: {
    paths: (
      <>
        <circle cx="12" cy="12" r="8.6" />
        <circle cx="12" cy="12" r="5.4" />
        <path d="M9.9 2.1 12 5.4l2.1-3.3M21.6 15.1l-3.9.2 1.8 3.5M4.5 18.8l1.8-3.5-3.9-.2" />
      </>
    ),
  },
  // Les fils rouges du 17 octobre 2026 au soir. Les rois et reines de France
  // ont la couronne (`crown`), qui existait déjà.
  'tour-eiffel': {
    paths: (
      <>
        <path d="M12 2.5V5M10.8 5h2.4M10.8 5 7 21M13.2 5 17 21" />
        <path d="M9.3 11.5h5.4M8.1 16.5h7.8M9.5 21a2.5 2.5 0 0 1 5 0" />
      </>
    ),
  },
  ancre: {
    paths: (
      <>
        <circle cx="12" cy="5" r="2.4" />
        <path d="M12 7.4V21M8.5 10.5h7M5 13H3.5a8.5 8.5 0 0 0 17 0H19" />
      </>
    ),
  },
  palmier: {
    paths: (
      <>
        <path d="M13 21c.2-3.6-.3-6.8-1.6-9.6" />
        <path d="M11.4 11.4C10.2 8.7 7.6 7.6 4.5 8.2M11.4 11.4c.2-2.9 2-4.9 5-5.4M11.4 11.4c2.7-.9 5.2-.1 7.1 2M11.4 11.4c-2.6.4-4.6 2-5.4 4.6M7 21h10" />
      </>
    ),
  },
  guillemets: {
    paths: (
      <>
        <path d="M10 6.5H6v5h4v-5Zm0 5c0 3-1.3 5-4 6" />
        <path d="M18 6.5h-4v5h4v-5Zm0 5c0 3-1.3 5-4 6" />
      </>
    ),
  },
  operations: {
    paths: (
      <>
        <path d="M7 4.5v5M4.5 7h5M14.5 7h5" />
        <path d="m5 15 4 4M9 15l-4 4M14.5 17h5M17 14.5v.01M17 19.5v.01" />
      </>
    ),
  },
  // Le bicorne de l'Empereur, porté en bataille : un croissant, ses deux pointes en bas, la cocarde devant. En amande,
  // il se lisait comme un œil — celui de l'insolite.
  bicorne: {
    paths: (
      <>
        <path d="M2.5 16C5 10 8.5 7.5 12 7.5s7 2.5 9.5 8.5c-3-1.7-6.2-2.6-9.5-2.6S5.5 14.3 2.5 16Z" />
        <circle cx="12" cy="10.6" r="1.3" />
      </>
    ),
  },
  avion: {
    paths: <path d="M21 15.5v-1.8l-7.5-4.7V4a1.5 1.5 0 0 0-3 0v5L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8l7.5 2.3Z" />,
  },
  // Le pupitre et son micro : le discours d'un président.
  pupitre: {
    paths: (
      <>
        <path d="M5 10.5h14M7 10.5l1 10h8l1-10M6 20.5h12" />
        <path d="M12 10.5V7M10.8 5.2a1.2 1.2 0 1 1 2.4 0V7h-2.4V5.2Z" />
      </>
    ),
  },
  // Un sauropode, de profil : le long cou, la queue, deux pattes.
  dinosaure: {
    paths: (
      <>
        <path d="M3 14c3-.2 5.5-4.5 10-4.5 1.2 0 2.2.2 3 .5V5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-1V13c0 1.6-1.4 2.5-3.5 2.5H8.5C6 15.5 4.2 15 3 14Z" />
        <path d="M9 15.5V20M15.5 15.5V20" />
      </>
    ),
  },
  gateau: {
    paths: (
      <>
        <path d="M4.5 20.5V13a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7.5M3 20.5h18" />
        <path d="M4.5 15.5c1.2.9 2.4.9 3.6 0s2.4-.9 3.6 0 2.4.9 3.6 0 2.4-.9 3.6 0M8 11.5v-3M12 11.5v-3M16 11.5v-3M8 5.5v.01M12 5.5v.01M16 5.5v.01" />
      </>
    ),
  },
  // Les duels (la maquette choisie par le propriétaire le 12 octobre 2026) :
  // le temps qu'il reste à l'autre, « sans chrono », « Comment ça marche ? »,
  // une vie, et l'étincelle d'un résultat qui attend d'être vu.
  hourglass: { paths: <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" /> },
  infinity: { paths: <path d="M6.5 15.5a3.5 3.5 0 1 1 0-7c3 0 8 7 11 7a3.5 3.5 0 1 0 0-7c-3 0-8 7-11 7Z" /> },
  help: {
    paths: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.6-2.8 2.6M12 16.8h.01" />
      </>
    ),
  },
  heart: { paths: <path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11Z" />, filled: true },
  spark: { paths: <path d="M12 2.5c.6 4.6 2.9 6.9 9.5 9.5-6.6 2.6-8.9 4.9-9.5 9.5-.6-4.6-2.9-6.9-9.5-9.5 6.6-2.6 8.9-4.9 9.5-9.5Z" />, filled: true },
  // Deux sommets, celui du fond plus haut : les sentiers du savoir qu'on gravit.
  mountain: { paths: <path d="m3 20 6.5-11 3.5 6 2.5-4L21 20H3Z" /> },
  // Le sac de la boutique, celui de la barre du menu : ce qui s'y achète.
  bag: {
    paths: (
      <>
        <path d="M5 8h14l-1 12.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20.5L5 8Z" />
        <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
      </>
    ),
  },
  calendar: {
    paths: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
  // Une étiquette, son œillet : « Reclasser » une question — sa catégorie, son sous-thème, sa difficulté.
  tag: {
    paths: (
      <>
        <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0L3.5 12.2Z" />
        <circle cx="8" cy="8" r="1.4" />
      </>
    ),
  },
  // Un coffre, son couvercle bombé et sa serrure : le coffre de la semaine, et ce qui en sort.
  coffre: {
    paths: (
      <>
        <path d="M3.5 11V9.5C3.5 6.5 7 4.5 12 4.5s8.5 2 8.5 5V11" />
        <rect x="3.5" y="11" width="17" height="8.5" rx="1.5" />
        <path d="M3.5 11h17M8 4.9V11M16 4.9V11" />
        <rect x="10.3" y="9.6" width="3.4" height="4" rx="0.8" />
      </>
    ),
  },
  // Une liste cochée : les missions du jour.
  missions: {
    paths: (
      <>
        <path d="M10 6h10M10 12h10M10 18h10" />
        <path d="m3.5 6 1.4 1.4 2.6-2.6M3.5 12l1.4 1.4 2.6-2.6" />
        <circle cx="5.2" cy="18" r="1.4" />
      </>
    ),
  },
  // Une goutte : la source de l'expédition, qui rend une vie.
  source: { paths: <path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0c0-4.2 6-10.6 6-10.6Z" /> },
  // Un feu sur ses deux bûches : le campement, la dernière halte avant le gardien.
  campement: {
    paths: (
      <>
        <path d="M12 3c1 3.2 4.5 4.8 4.5 8.8a4.5 4.5 0 0 1-9 0c0-2.1 1.1-3.5 2.2-4.6.2 1.5.9 2.4 1.8 2.8-.4-2.2.1-4.8.5-7Z" />
        <path d="M4 21l16-4M20 21 4 17" />
      </>
    ),
  },
  // Une pièce frappée d'une couronne : l'écu, la monnaie de l'expédition — pas un confetti.
  ecu: {
    paths: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="5.5" />
        <path d="m9.6 13.4-.6-3 1.8 1.2L12 9.4l1.2 2.2L15 10.4l-.6 3h-4.8Z" />
      </>
    ),
  },
  // Un étal sous son auvent rayé : l'échoppe.
  echoppe: {
    paths: (
      <>
        <path d="M3.5 9.5 5 4.5h14l1.5 5" />
        <path d="M3.5 9.5a2.1 2.1 0 0 0 4.25 0 2.1 2.1 0 0 0 4.25 0 2.1 2.1 0 0 0 4.25 0 2.1 2.1 0 0 0 4.25 0" />
        <path d="M5 11.5v8.5h14v-8.5M10 20v-4.5h4V20" />
      </>
    ),
  },
  // Une boussole : l'inconnu se dévoile.
  boussole: {
    paths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
      </>
    ),
  },
  // Un maillot : le sport paie double.
  maillot: {
    paths: <path d="M9 3.5 4 6l-1.5 4.5L6 12v8.5h12V12l3.5-1.5L20 6l-5-2.5a3 3 0 0 1-6 0Z" />,
  },
  // Un tampon encreur, sa poignée et son trait : le passeport de l'expédition.
  tampon: {
    paths: (
      <>
        <path d="M10 13.5V10c0-1.2-1.2-1.8-1.2-3.4a3.2 3.2 0 0 1 6.4 0c0 1.6-1.2 2.2-1.2 3.4v3.5" />
        <path d="M5 18v-2a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 16v2Z" />
        <path d="M5 21h14" />
      </>
    ),
  },
  // Une fiole ronde : son bouchon, son col, sa panse, et ce qui y reste.
  fiole: {
    paths: (
      <>
        <path d="M8.5 3h7" />
        <path d="M10 3v5.3a6.5 6.5 0 1 0 4 0V3" />
        <path d="M7 15.5h10" />
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

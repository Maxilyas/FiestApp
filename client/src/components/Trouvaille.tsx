// Les trente trouvailles du jardin de son compagnon, dessinées (la maquette
// validée par le propriétaire le 20 octobre 2026,
// `retours/2026-10-20/mon-compagnon/` ; leurs règles : `shared/trouvailles.ts`).
// Des dessins de la maquette, dans un carré de 64 dont le sol est à 60 : ils
// seront peints comme les ornements de la niche, et prendront leur place ici.
//
// En JSX, jamais en texte posé d'un bloc : React le reparserait à chaque rendu
// (règle `medaillons.md`).

import type { CSSProperties, ReactElement } from 'react'

interface DessinDeTrouvaille {
  /** Sa boîte dans le carré de 64 (x, y, largeur, hauteur) : l'icône s'y recadre, et sa place se touche là. */
  boite: readonly [number, number, number, number]
  /** Ce qui luit dans la nuit de son jardin : un halo à sa couleur — un disque peint dessous virait au gris. */
  lueur?: string
  formes: (nom?: string) => ReactElement
}

const DESSINS: Readonly<Record<string, DessinDeTrouvaille>> = {
  gamelle: {
    boite: [10, 40, 44, 22],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="20" ry="2.6" fill="#000" opacity=".25" />
        <path d="M18 47c2-4 6-5 8-3 2-3 6-3 8 0 2-2 6-2 8 2z" fill="#c08a4a" />
        <circle cx="23" cy="45.5" r="2" fill="#a8723a" />
        <circle cx="38" cy="45" r="1.8" fill="#a8723a" />
        <path d="M13 48h38c-1.4 7.5-8 11.5-19 11.5S14.4 55.5 13 48z" fill="#2b4470" />
        <path d="M13 48h19v11.5C21 59.5 14.4 55.5 13 48z" fill="#34528a" />
        <rect x="11.5" y="46.5" width="41" height="3.2" rx="1.6" fill="#d9b56a" />
        <path d="M32 51.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#f3d27a" />
      </>
    ),
  },
  boite: {
    boite: [16, 6, 36, 56],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="10" ry="2" fill="#000" opacity=".25" />
        <rect x="29.5" y="30" width="5" height="30" rx="1.2" fill="#6b4a32" />
        <path d="M19 32V21a13 10.5 0 0 1 26 0v11z" fill="#7a3b52" />
        <path d="M19 32V21a13 10.5 0 0 1 13-10.5V32z" fill="#8c4862" />
        <rect x="18" y="30.5" width="28" height="3.5" rx="1.4" fill="#5a2a3d" />
        <rect x="24" y="20" width="10" height="2" rx="1" fill="#3a1a28" />
        <rect x="43.5" y="9" width="1.8" height="14" rx=".9" fill="#c99c4c" />
        <path d="M44.4 9h6v5h-6z" fill="#e9c97f" />
        <path d="M32 28.5c-2.3-1.7-3.5-2.7-3.5-4.1 0-1 .8-1.8 1.8-1.8.7 0 1.3.4 1.7 1 .4-.6 1-1 1.7-1 1 0 1.8.8 1.8 1.8 0 1.4-1.2 2.4-3.5 4.1z" fill="#f6c6d6" />
      </>
    ),
  },
  coussin: {
    boite: [6, 38, 52, 24],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="24" ry="2.6" fill="#000" opacity=".25" />
        <path d="M9 50c0-7 9-10.5 23-10.5S55 43 55 50c0 6-9 9-23 9S9 56 9 50z" fill="#8d7cc8" />
        <path d="M11 48c1.5-5 9.5-7.5 21-7.5s19.5 2.5 21 7.5c-4.5-2.6-12-3.6-21-3.6S15.5 45.4 11 48z" fill="#b9aaf0" />
        <path d="M32 48.5 22 44.5M32 48.5l10-4M32 48.5l-9 5M32 48.5l9 5" stroke="#6f60ab" strokeWidth="1" fill="none" />
        <circle cx="32" cy="48.5" r="2" fill="#5e4f99" />
        <circle cx="9.5" cy="50" r="2" fill="#f3d27a" />
        <circle cx="54.5" cy="50" r="2" fill="#f3d27a" />
      </>
    ),
  },
  pelote: {
    boite: [16, 34, 38, 28],
    formes: () => (
      <>
        <ellipse cx="30" cy="60" rx="12" ry="2.2" fill="#000" opacity=".25" />
        <circle cx="30" cy="48" r="11.5" fill="#e8739a" />
        <path d="M20.5 43c5 1 12 6 15 14M23.5 38.5c5 3 10 10 11 18M28.5 36.6c4 4 8 11 7 19M19.4 49c5-1 13 1 19 6M39 41.5c-6 1-14 6-17 13" stroke="#b9476d" strokeWidth="1.2" fill="none" />
        <path d="M40 54c4 1 7 3 10 6" stroke="#e8739a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  fanions: {
    boite: [0, 2, 64, 26],
    formes: () => (
      <>
        <path d="M2 6Q32 26 62 6" stroke="#e9c97f" strokeWidth="1.2" fill="none" />
        <path d="M5.7 9.7 12.7 10.7 9.2 19.2z" fill="#e8739a" />
        <path d="M14.7 13.4 21.7 14.4 18.2 22.9z" fill="#f3d27a" />
        <path d="M23.7 15.2 30.7 16.2 27.2 24.7z" fill="#7fa6dd" />
        <path d="M33.3 16.2 40.3 15.2 36.8 24.7z" fill="#6fcf8a" />
        <path d="M42.3 14.4 49.3 13.4 45.8 22.9z" fill="#b77bff" />
        <path d="M51.3 10.7 58.3 9.7 54.8 19.2z" fill="#f49ab8" />
      </>
    ),
  },
  ballons: {
    boite: [14, 2, 40, 52],
    formes: () => (
      <>
        <path d="M25 28c2 8-2 14 4 24M37 25.5c-1 8 3 15-4 26.5M45 31.5c-3 8 0 14-8 20.5" stroke="#e8dcc4" strokeWidth=".9" fill="none" />
        <ellipse cx="25" cy="18" rx="8" ry="10" fill="#e8739a" />
        <ellipse cx="37" cy="15" rx="8.5" ry="10.5" fill="#7fa6dd" />
        <ellipse cx="45" cy="22" rx="7.5" ry="9.5" fill="#f3d27a" />
        <path d="M21 13c1-3 3-4 5-4.5M33 9.5c1-3 3-4 5-4.5M42 17c1-3 2.6-4 4.4-4.4" stroke="#fff" strokeWidth="1.4" opacity=".55" fill="none" strokeLinecap="round" />
        <path d="M24 28l1 2 1-2zM36 25.5l1 2 1-2zM44 31.5l1 2 1-2z" fill="#c99c4c" />
      </>
    ),
  },
  seau: {
    boite: [14, 18, 36, 44],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="11" ry="2" fill="#000" opacity=".25" />
        <path d="M30 40c-2-8-6-12-10-14M33 40c0-9 2-14 6-17M35 41c3-6 7-9 11-9" stroke="#3f7e5c" strokeWidth="1.6" fill="none" />
        <circle cx="20" cy="26" r="4" fill="#f49ab8" />
        <circle cx="20" cy="26" r="1.5" fill="#f3d27a" />
        <circle cx="39" cy="22" r="4.5" fill="#fff4f7" />
        <circle cx="39" cy="22" r="1.6" fill="#f3d27a" />
        <circle cx="46" cy="32" r="3.8" fill="#b9aaf0" />
        <circle cx="46" cy="32" r="1.4" fill="#f3d27a" />
        <path d="M22 40h20l-2.5 19.5h-15z" fill="#5f87b8" />
        <path d="M22 40h10v19.5h-7.5z" fill="#7fa6dd" />
        <rect x="21" y="38.5" width="22" height="3.2" rx="1.4" fill="#c9d8ea" />
      </>
    ),
  },
  buches: {
    boite: [8, 32, 48, 30],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="22" ry="2.4" fill="#000" opacity=".25" />
        <rect x="10" y="50" width="44" height="9" rx="4.5" fill="#8a5a36" />
        <rect x="14" y="42" width="36" height="9" rx="4.5" fill="#9c6a42" />
        <rect x="20" y="34" width="24" height="9" rx="4.5" fill="#8a5a36" />
        <circle cx="14.5" cy="54.5" r="3.4" fill="#e3c08a" />
        <circle cx="18.5" cy="46.5" r="3.4" fill="#e3c08a" />
        <circle cx="24.5" cy="38.5" r="3.4" fill="#e3c08a" />
        <circle cx="14.5" cy="54.5" r="1.6" fill="none" stroke="#b8894f" strokeWidth=".8" />
        <circle cx="18.5" cy="46.5" r="1.6" fill="none" stroke="#b8894f" strokeWidth=".8" />
        <circle cx="24.5" cy="38.5" r="1.6" fill="none" stroke="#b8894f" strokeWidth=".8" />
      </>
    ),
  },
  balle: {
    boite: [20, 40, 24, 22],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="8" ry="1.8" fill="#000" opacity=".25" />
        <circle cx="32" cy="51" r="8.5" fill="#f3d27a" />
        <path d="M23.8 49c5 2 11 2 16.4 0M24.5 54.5c5 1.8 10.5 1.8 15 0" stroke="#e8739a" strokeWidth="2" fill="none" />
        <path d="M27 46c1.4-1.8 3-2.6 5-2.8" stroke="#fff" strokeWidth="1.4" opacity=".6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  paillasson: {
    boite: [4, 48, 56, 14],
    formes: () => (
      <>
        <rect x="7" y="52" width="50" height="8" rx="2" fill="#b58a52" />
        <rect x="9" y="53.5" width="46" height="5" rx="1.5" fill="none" stroke="#8a6438" strokeWidth="1" />
        <path d="M32 58.4c-2-1.4-3-2.3-3-3.4 0-.8.7-1.5 1.5-1.5.6 0 1.1.3 1.5.8.4-.5.9-.8 1.5-.8.8 0 1.5.7 1.5 1.5 0 1.1-1 2-3 3.4z" fill="#e8739a" />
      </>
    ),
  },
  bouleau: {
    boite: [12, 2, 40, 60],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="14" ry="2.6" fill="#000" opacity=".25" />
        <path d="M30 60l.8-30h3.4l.8 30z" fill="#efe9dc" />
        <path d="M31 50h2.4M31.5 40h2.2M31 45.5h1.6M32.5 55h2" stroke="#3a2c24" strokeWidth="1.4" />
        <path d="M32.5 38 25 29M32.5 35l8-8" stroke="#efe9dc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="32" cy="18" r="13" fill="#3f7e5c" />
        <circle cx="22" cy="25" r="9" fill="#4e9a6f" />
        <circle cx="42" cy="25" r="9" fill="#4e9a6f" />
        <circle cx="31" cy="11" r="9" fill="#5fb07f" />
        <circle cx="38" cy="15" r="6" fill="#6cc08d" opacity=".8" />
      </>
    ),
  },
  cerfvolant: {
    boite: [16, 2, 30, 60],
    formes: () => (
      <>
        <path d="M30 4 41 17 30 34 19 17z" fill="#e8739a" />
        <path d="M30 4 41 17H30z" fill="#f49ab8" />
        <path d="M30 17H19l11 17z" fill="#c95a80" />
        <path d="M30 4v30M19 17h22" stroke="#f3e2c8" strokeWidth=".8" />
        <path d="M30 34c-2 6 4 9 0 15s3 8 1 12" stroke="#e9c97f" strokeWidth="1" fill="none" />
        <path d="M27.5 40l2.5 1.6-2.5 1.6zM32.5 40 30 41.6l2.5 1.6z" fill="#f3d27a" />
        <path d="M28 49l2.5 1.6L28 52.2zM33 49l-2.5 1.6L33 52.2z" fill="#7fa6dd" />
      </>
    ),
  },
  carillon: {
    boite: [18, 0, 28, 54],
    formes: () => (
      <>
        <path d="M32 0v8" stroke="#c99c4c" strokeWidth="1.1" />
        <path d="M21 13Q32 4 43 13z" fill="#7a3b52" />
        <path d="M24.5 13v20M29.5 13v27M34.5 13v24M39.5 13v18" stroke="#e9c97f" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M32 13v31" stroke="#c99c4c" strokeWidth=".7" />
        <path d="M32 51.5c-2.6-1.9-4-3.1-4-4.7 0-1.1.9-2 2-2 .8 0 1.5.4 2 1.1.5-.7 1.2-1.1 2-1.1 1.1 0 2 .9 2 2 0 1.6-1.4 2.8-4 4.7z" fill="#e8739a" />
      </>
    ),
  },
  brouette: {
    boite: [6, 28, 54, 34],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="24" ry="2.4" fill="#000" opacity=".25" />
        <path d="M44 44 58 38M44 49l13-5" stroke="#6b4a32" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="53" r="6.5" fill="#3a2c24" />
        <circle cx="20" cy="53" r="2.4" fill="#c99c4c" />
        <path d="M12 41c4-5 26-6 34-1z" fill="#4e9a6f" />
        <circle cx="18" cy="35" r="4" fill="#f49ab8" />
        <circle cx="26" cy="32" r="4.5" fill="#f3d27a" />
        <circle cx="34" cy="34" r="4" fill="#b9aaf0" />
        <circle cx="40" cy="37" r="3.5" fill="#fff4f7" />
        <path d="M8 40h40l-6 12H16z" fill="#c0603c" />
        <path d="M8 40h20v12H16z" fill="#d87850" />
      </>
    ),
  },
  panneau: {
    boite: [12, 14, 44, 48],
    formes: nom => (
      <>
        <ellipse cx="32" cy="60" rx="10" ry="2" fill="#000" opacity=".25" />
        <rect x="30" y="30" width="4" height="30" rx="1" fill="#6b4a32" />
        <path d="M14 18h36l4 7-4 7H14z" fill="#9c6a42" />
        <path d="M14 18h36l4 7H14z" fill="#b58050" />
        {nom ? (
          <text x="29" y="27.4" fontSize="6.4" fontWeight="700" textAnchor="middle" fill="#3e2716" textLength={Math.min(26, nom.length * 3.7)} lengthAdjust="spacingAndGlyphs">
            {nom}
          </text>
        ) : (
          <path d="M19 25h20" stroke="#5a3a24" strokeWidth="2" strokeLinecap="round" />
        )}
        <path d="M45 28.4c-1.8-1.3-2.8-2.2-2.8-3.3 0-.8.6-1.4 1.4-1.4.6 0 1 .3 1.4.7.4-.4.8-.7 1.4-.7.8 0 1.4.6 1.4 1.4 0 1.1-1 2-2.8 3.3z" fill="#e8739a" />
      </>
    ),
  },
  nichoir: {
    boite: [16, 4, 32, 58],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="9" ry="2" fill="#000" opacity=".25" />
        <rect x="30.5" y="30" width="3" height="30" rx="1" fill="#6b4a32" />
        <path d="M22 30V18h20v12z" fill="#d9a066" />
        <path d="M19 19 32 7l13 12z" fill="#7a3b52" />
        <circle cx="32" cy="23" r="3" fill="#3a2418" />
        <rect x="30" y="27" width="4" height="1.6" rx=".8" fill="#6b4a32" />
        <rect x="21" y="29" width="22" height="2.4" rx="1" fill="#b98250" />
      </>
    ),
  },
  tapis: {
    boite: [4, 48, 56, 14],
    formes: () => (
      <>
        <ellipse cx="32" cy="56" rx="27" ry="5.5" fill="#c07a8e" />
        <ellipse cx="32" cy="56" rx="21" ry="4.2" fill="#e8b4c4" />
        <ellipse cx="32" cy="56" rx="14" ry="2.8" fill="#c07a8e" />
        <ellipse cx="32" cy="56" rx="7" ry="1.4" fill="#f3d27a" />
      </>
    ),
  },
  tournesols: {
    boite: [14, 8, 36, 54],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="14" ry="2.2" fill="#000" opacity=".25" />
        <path d="M26 60V24M38 60V30" stroke="#4e9a6f" strokeWidth="2" />
        <path d="M26 44c-5-1-8-4-9-8 5 0 8 3 9 8zM38 48c5-1 8-4 9-8-5 0-8 3-9 8z" fill="#5fb07f" />
        <circle cx="26" cy="12.5" r="3" fill="#f3c53a" />
        <circle cx="33" cy="16" r="3" fill="#f3c53a" />
        <circle cx="33" cy="24" r="3" fill="#f3c53a" />
        <circle cx="26" cy="27.5" r="3" fill="#f3c53a" />
        <circle cx="19" cy="24" r="3" fill="#f3c53a" />
        <circle cx="19" cy="16" r="3" fill="#f3c53a" />
        <circle cx="26" cy="20" r="4.6" fill="#6b4a32" />
        <circle cx="38" cy="22" r="2.5" fill="#f3c53a" />
        <circle cx="43.5" cy="25" r="2.5" fill="#f3c53a" />
        <circle cx="43.5" cy="31" r="2.5" fill="#f3c53a" />
        <circle cx="38" cy="34" r="2.5" fill="#f3c53a" />
        <circle cx="32.5" cy="31" r="2.5" fill="#f3c53a" />
        <circle cx="32.5" cy="25" r="2.5" fill="#f3c53a" />
        <circle cx="38" cy="28" r="3.8" fill="#6b4a32" />
      </>
    ),
  },
  lanterne: {
    boite: [16, 0, 32, 62],
    lueur: '#ffb066',
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="9" ry="2" fill="#000" opacity=".25" />
        <rect x="30.5" y="26" width="3" height="34" rx="1" fill="#6b4a32" />
        <rect x="25" y="2.5" width="14" height="3" rx="1.2" fill="#d9b56a" />
        <path d="M24.5 5.5c-2.4 4.6-2.4 10.4 0 15h15c2.4-4.6 2.4-10.4 0-15z" fill="#e8743a" />
        <path d="M24.5 5.5c-1.6 4.6-1.6 10.4 0 15h6c-1.2-4.6-1.2-10.4 0-15z" fill="#f59a52" />
        <path d="M28.5 6c-.8 4.4-.8 9.6 0 14M32 5.5v15M35.5 6c.8 4.4.8 9.6 0 14" stroke="#b84c26" strokeWidth=".8" fill="none" />
        <rect x="25" y="20" width="14" height="2.6" rx="1" fill="#d9b56a" />
        <path d="M32 22.6V26" stroke="#e8739a" strokeWidth="1.4" />
      </>
    ),
  },
  champignons: {
    boite: [12, 34, 40, 28],
    lueur: '#4fe3c1',
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="18" ry="2.4" fill="#000" opacity=".25" />
        <path d="M22 60V49h5v11z" fill="#e8dcc4" />
        <path d="M14 49c0-7 5-11 10.5-11S35 42 35 49z" fill="#4fe3c1" />
        <circle cx="20" cy="44" r="1.4" fill="#e9fff8" />
        <circle cx="26" cy="41.5" r="1.2" fill="#e9fff8" />
        <circle cx="30" cy="46" r="1.2" fill="#e9fff8" />
        <path d="M39 60v-7h4v7z" fill="#e8dcc4" />
        <path d="M34 53c0-5 4-8 7-8s7 3 7 8z" fill="#8ff0d2" />
        <circle cx="39" cy="49" r="1" fill="#e9fff8" />
        <circle cx="43" cy="50.5" r="1" fill="#e9fff8" />
      </>
    ),
  },
  feu: {
    boite: [12, 22, 40, 40],
    lueur: '#ffa04a',
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="18" ry="2.4" fill="#000" opacity=".25" />
        <path d="M18 58 46 50M18 50l28 8" stroke="#7a4e2e" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 52c-8-3-9-10-4-16 0 4 2 5 3 5-1-6 3-11 7-13-1 5 3 8 3 13 0 6-4 10-9 11z" fill="#f3863a" />
        <path d="M32 51c-4-2-4.5-6-2-9 .5 2 1.5 3 2.5 3 0-3 1.5-5.5 3.5-7 0 3 1.5 4.5 1.5 7 0 3.5-2.5 5.5-5.5 6z" fill="#ffd36a" />
        <circle cx="16" cy="58" r="2.4" fill="#9fa4ad" />
        <circle cx="48" cy="58" r="2.4" fill="#9fa4ad" />
        <circle cx="22" cy="60" r="2.2" fill="#9fa4ad" />
        <circle cx="42" cy="60" r="2.2" fill="#9fa4ad" />
      </>
    ),
  },
  lampadaire: {
    boite: [16, 0, 32, 62],
    lueur: '#d6ff8c',
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="9" ry="2" fill="#000" opacity=".25" />
        <rect x="30.5" y="20" width="3" height="40" rx="1" fill="#3a3f4a" />
        <rect x="27" y="56" width="10" height="4" rx="1" fill="#2d313a" />
        <path d="M25 8h14l-2 12H27z" fill="#e9f7c8" opacity=".9" />
        <path d="M24 8h16l-8-6z" fill="#3a3f4a" />
        <rect x="26" y="19" width="12" height="2.4" rx="1" fill="#3a3f4a" />
        <circle cx="22" cy="12" r="1.3" fill="#d6ff8c" />
        <circle cx="44" cy="18" r="1.1" fill="#d6ff8c" />
        <circle cx="41" cy="6" r="1" fill="#d6ff8c" />
        <circle cx="20" cy="22" r="1" fill="#d6ff8c" />
      </>
    ),
  },
  lune: {
    boite: [12, 0, 38, 44],
    lueur: '#f3dc96',
    formes: () => (
      <>
        <path d="M32 0v9" stroke="#c99c4c" strokeWidth="1" />
        <path d="M37 11a15 15 0 1 0 8 26 12 12 0 0 1-8-26z" fill="#f3dc96" />
        <path d="M37 11a15 15 0 0 0-10 25" stroke="#e9c97f" strokeWidth="1" fill="none" opacity=".6" />
        <circle cx="30" cy="25" r="1.4" fill="#d9b56a" />
        <circle cx="27" cy="31" r="1" fill="#d9b56a" />
        <path d="M44 32l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#fff4c7" />
      </>
    ),
  },
  hamac: {
    boite: [2, 20, 60, 42],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="28" ry="2.4" fill="#000" opacity=".25" />
        <rect x="5" y="22" width="3.4" height="38" rx="1" fill="#6b4a32" />
        <rect x="55.6" y="22" width="3.4" height="38" rx="1" fill="#6b4a32" />
        <path d="M8.4 26C18 44 46 44 55.6 26" stroke="#e8dcc4" strokeWidth="1" fill="none" />
        <path d="M10 30c8 13 36 13 44 0-6 8-38 8-44 0z" fill="#e8739a" />
        <path d="M10 30c8 13 36 13 44 0" stroke="#f49ab8" strokeWidth="2" fill="none" />
        <path d="M16 33.5h32M14 31.5h36" stroke="#c95a80" strokeWidth=".8" opacity=".6" />
      </>
    ),
  },
  cerisier: {
    boite: [6, 0, 52, 62],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="20" ry="2.6" fill="#000" opacity=".25" />
        <path d="M30 60c1-9-2-15 1-22 1.5-3.5 4-6 4-9h3c0 4-2.6 7-3.4 10-2 7 .6 13 0 21z" fill="#6b4a32" />
        <path d="M33.5 38c-4-2.4-8-3.6-12-3.4M35 34.5c4-2 8-2.6 11-1.4" stroke="#6b4a32" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="32" cy="18" r="13" fill="#f49ab8" />
        <circle cx="19" cy="26" r="9.5" fill="#e8739a" />
        <circle cx="45" cy="25" r="9.5" fill="#f6b6cc" />
        <circle cx="27" cy="10" r="9" fill="#fbc9d9" />
        <circle cx="40" cy="12" r="8" fill="#f49ab8" />
        <circle cx="24" cy="17" r="1.3" fill="#fff4f7" />
        <circle cx="36" cy="9" r="1.3" fill="#fff4f7" />
        <circle cx="44" cy="22" r="1.3" fill="#fff4f7" />
        <circle cx="18" cy="25" r="1.3" fill="#fff4f7" />
        <circle cx="31" cy="23" r="1.3" fill="#fff4f7" />
        <ellipse cx="52" cy="44" rx="1.6" ry="1" fill="#fbc9d9" transform="rotate(30 52 44)" />
        <ellipse cx="12" cy="40" rx="1.6" ry="1" fill="#fbc9d9" transform="rotate(-20 12 40)" />
        <ellipse cx="46" cy="54" rx="1.6" ry="1" fill="#fbc9d9" />
      </>
    ),
  },
  bassin: {
    boite: [2, 46, 60, 17],
    formes: () => (
      <>
        <ellipse cx="32" cy="55" rx="28" ry="7" fill="#7a6a58" />
        <ellipse cx="32" cy="54.5" rx="25.5" ry="5.6" fill="#2b6f8a" />
        <ellipse cx="28" cy="53.5" rx="14" ry="2.4" fill="#4fa3b8" opacity=".6" />
        <path d="M20 55.5a4 2.2 0 1 0 6 .2l-3-.2z" fill="#4e9a6f" />
        <path d="M38 53.5a4.4 2.4 0 1 0 6.6.2l-3.3-.2z" fill="#5fb07f" />
        <circle cx="41.5" cy="52.6" r="1.6" fill="#f49ab8" />
        <circle cx="23" cy="54.4" r="1.2" fill="#fff4f7" />
      </>
    ),
  },
  arcenciel: {
    boite: [2, 12, 60, 34],
    formes: () => (
      <>
        <path d="M6 40a26 26 0 0 1 52 0" stroke="#e8739a" strokeWidth="3.4" fill="none" />
        <path d="M9.5 40a22.5 22.5 0 0 1 45 0" stroke="#f3c53a" strokeWidth="3.4" fill="none" />
        <path d="M13 40a19 19 0 0 1 38 0" stroke="#6fcf8a" strokeWidth="3.4" fill="none" />
        <path d="M16.5 40a15.5 15.5 0 0 1 31 0" stroke="#7fa6dd" strokeWidth="3.4" fill="none" />
        <path d="M20 40a12 12 0 0 1 24 0" stroke="#b77bff" strokeWidth="3.4" fill="none" />
        <ellipse cx="9" cy="41" rx="6.5" ry="3.6" fill="#f3ece2" />
        <ellipse cx="55" cy="41" rx="6.5" ry="3.6" fill="#f3ece2" />
      </>
    ),
  },
  cabane: {
    boite: [6, 2, 52, 60],
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="22" ry="2.6" fill="#000" opacity=".25" />
        <path d="M29 60l1-26h4l1 26z" fill="#6b4a32" />
        <circle cx="18" cy="24" r="10" fill="#3f7e5c" />
        <circle cx="46" cy="24" r="10" fill="#3f7e5c" />
        <circle cx="32" cy="14" r="12" fill="#4e9a6f" />
        <path d="M20 36V24h24v12z" fill="#d9a066" />
        <path d="M17 25 32 12l15 13z" fill="#7a3b52" />
        <rect x="29" y="27" width="6" height="9" rx="1" fill="#6b4a32" />
        <rect x="23" y="27" width="4" height="4" rx=".6" fill="#ffd36a" />
        <path d="M19 36h26" stroke="#9c6a42" strokeWidth="2" />
        <path d="M40 37v20M44 37v20M40 42h4M40 47h4M40 52h4" stroke="#b58050" strokeWidth="1.2" />
      </>
    ),
  },
  fontaine: {
    boite: [8, 8, 48, 54],
    lueur: '#bfe0ff',
    formes: () => (
      <>
        <ellipse cx="32" cy="60" rx="22" ry="2.6" fill="#000" opacity=".25" />
        <path d="M10 52h44l-3 8H13z" fill="#cfd6e0" />
        <ellipse cx="32" cy="52" rx="22" ry="3.6" fill="#9fc1e6" />
        <rect x="29" y="34" width="6" height="18" rx="1.4" fill="#cfd6e0" />
        <ellipse cx="32" cy="34" rx="10" ry="2.6" fill="#9fc1e6" />
        <path d="M32 32c-6-6-10-4-12 2M32 32c6-6 10-4 12 2M32 32V20" stroke="#bfe0ff" strokeWidth="1.4" fill="none" />
        <path d="M32 10l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#ffe7a3" />
        <circle cx="20" cy="26" r="1" fill="#fff4c7" />
        <circle cx="45" cy="24" r="1.2" fill="#fff4c7" />
        <circle cx="25" cy="16" r=".9" fill="#fff4c7" />
        <circle cx="41" cy="14" r=".9" fill="#fff4c7" />
      </>
    ),
  },
  etoile: {
    boite: [4, 6, 50, 36],
    lueur: '#ffe7a3',
    formes: () => (
      <>
        <path d="M6 40C18 34 26 28 34 20" stroke="#ffe7a3" strokeWidth="5" strokeLinecap="round" opacity=".35" fill="none" />
        <path d="M10 40C20 35 27 29 34 21" stroke="#fff4c7" strokeWidth="2.4" strokeLinecap="round" opacity=".7" fill="none" />
        <path d="M40 8l3.4 7 7.6 1.1-5.5 5.4 1.3 7.6L40 25.5l-6.8 3.6 1.3-7.6L29 16.1l7.6-1.1z" fill="#ffe7a3" />
        <circle cx="38" cy="18" r="1.1" fill="#6b4a32" />
        <circle cx="42.5" cy="18" r="1.1" fill="#6b4a32" />
        <path d="M38.3 21.5c1 .9 2.8.9 3.8 0" stroke="#6b4a32" strokeWidth=".9" fill="none" strokeLinecap="round" />
      </>
    ),
  },
}

/** Sa boîte dans le carré de 64 : là où sa place se touche, dans l'éditeur du jardin. */
export function boiteDeLaTrouvaille(cle: string): readonly [number, number, number, number] {
  return DESSINS[cle]?.boite ?? [0, 0, 64, 64]
}

/**
 * Une trouvaille : dans le carré de son jardin (64 × 64, le sol à 60), ou
 * recadrée en icône (`icone`) ; en silhouette dorée tant qu'elle n'est pas
 * trouvée (`silhouette`). « Le panneau à son nom » écrit le sien (`nom`).
 */
export function Trouvaille({ cle, icone = false, silhouette = false, nom, className }: { cle: string; icone?: boolean; silhouette?: boolean; nom?: string | null; className?: string }) {
  const d = DESSINS[cle]
  if (!d) return null
  const luit = !silhouette && !!d.lueur
  const classes = ['trouvaille', silhouette ? 'trouvaille-silhouette' : luit ? 'trouvaille-luit' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <svg className={classes} viewBox={icone ? d.boite.join(' ') : '0 0 64 64'} style={luit ? ({ '--lueur': `${d.lueur}aa` } as CSSProperties) : undefined} aria-hidden="true">
      {d.formes(nom ?? undefined)}
    </svg>
  )
}

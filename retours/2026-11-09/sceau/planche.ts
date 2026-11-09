// La planche du sceau : trois dessins candidats, posés sur les vrais avatars de
// l'application (`Avatar.tsx`, `Legendaire.tsx`, `Lumiere.tsx`, `Bordure.tsx`)
// sous la vraie feuille de style — chaque finition et sa lumière, l'Éclat, les
// matières, les bordures de ligue —, en grand, dans la salle, dans une ligne.
// Le sceau prend le métal de la finition portée, celui que la bordure de ligue
// prend déjà : il appartient à la tenue, il ne se colle pas dessus.
//
//   npx tsx retours/2026-11-09/sceau/planche.ts
//
// Écrit `planche.html` (autonome : les peintures y sont incluses) et ses photos
// à côté de lui. Une maquette, pas du code livré : rien de `client/` ne bouge.
import { createRequire } from 'node:module'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'

Object.assign(globalThis, { React })
const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../..')
const { renderToStaticMarkup } = await import('react-dom/server')
const duClient = (f: string) => import(path.join(RACINE, 'client/src', f))
await duClient('components/Legendaire.tsx')
await duClient('components/Lumiere.tsx')
await duClient('components/Bordure.tsx')
const { Avatar } = await duClient('components/Avatar.tsx')
const { NOM_FINITION } = await import(path.join(RACINE, 'shared/profil.ts'))

// ── Les métaux : ceux des bordures de ligue (`dessinDesBordures.ts`, `METAUX`), recopiés pour la maquette ──
type Metal = { m: string[]; bord: string; lueur: string }
const METAUX: Record<string, Metal> = {
  mat: { m: ['#7d5416', '#f6dd94', '#b8892f', '#fff0bf', '#8f6219'], bord: '#3a2508', lueur: '#f6cf73' },
  argent: { m: ['#7c858f', '#f4f6f9', '#a3acb6', '#ffffff', '#858e98'], bord: '#2c3138', lueur: '#e8eef6' },
  or: { m: ['#7d5416', '#f6dd94', '#b8892f', '#fff0bf', '#8f6219'], bord: '#3a2508', lueur: '#f6cf73' },
  holo: { m: ['#f7b8e8', '#9fe3ff', '#fff1a6', '#b9f5c6', '#f7b8e8'], bord: '#5b4a70', lueur: '#f7c8ef' },
  prisme: { m: ['#ff8fa3', '#ffd166', '#7aa8ff', '#3ff0d0', '#ff8fa3'], bord: '#3d2f5a', lueur: '#ffffff' },
  aurore: { m: ['#58e6b4', '#5aaaff', '#be78ff', '#58e6b4', '#5aaaff'], bord: '#16313f', lueur: '#8ff5d6' },
  constellation: { m: ['#1b2357', '#3a4ca8', '#141a45', '#5468cc', '#1b2357'], bord: '#e2c27a', lueur: '#a9b8ff' },
  abysses: { m: ['#062a3d', '#1fb6c9', '#0b4f6c', '#7ff6ff', '#062a3d'], bord: '#031822', lueur: '#7ff6ff' },
  orage: { m: ['#16235e', '#9fd8ff', '#2a4fb8', '#e9f7ff', '#16235e'], bord: '#0b1236', lueur: '#bfe6ff' },
  envol: { m: ['#b28a3e', '#fffdf5', '#f3e2b0', '#ffffff', '#c79d4a'], bord: '#6b5320', lueur: '#fff3cf' },
  disco: { m: ['#4a4f63', '#f4f6fb', '#9aa3b5', '#ffffff', '#4a4f63'], bord: '#17161d', lueur: '#ff8fd0' },
  singularite: { m: ['#050308', '#ff9a3c', '#1a0c08', '#fff3d6', '#050308'], bord: '#ff7a1f', lueur: '#ffb86b' },
}

let n = 0
const degrade = (id: string, mt: Metal, angle = 'x1="0" y1="0" x2="1" y2="1"') =>
  `<linearGradient id="${id}" ${angle}>${mt.m.map((c, i) => `<stop offset="${(i / 4) * 100}%" stop-color="${c}"/>`).join('')}</linearGradient>`

/** L'étoile frappée : quatre branches longues, quatre courtes, comme une étoile de navigation. */
const etoile = (cx: number, cy: number, r: number, fill: string, extra = '') => {
  const p: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2
    const rr = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.55 : r * 0.24
    p.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`)
  }
  return `<polygon points="${p.join(' ')}" fill="${fill}" ${extra}/>`
}

// ── Les trois sceaux ──

/** La légende de chaque légendaire, gravée comme sur le pourtour d'une monnaie : son nom et son exploit. */
const LEGENDES: Record<string, string> = {
  'lg:comete': 'LA COMÈTE ✦ QUATRE CENTS RÉFLEXES ✦',
  'lg:phenix': 'LE PHÉNIX ✦ IL RENAÎT QUAND ON LE CROYAIT FINI ✦',
  'lg:lion': 'LE LION ✦ HUIT FOIS ROI DE LA SOIRÉE ✦',
  'lg:kraken': 'LE KRAKEN ✦ TROIS LANTERNES ROUGES ✦',
  'lg:dragon': 'LE DRAGON D’OR ✦ TROIS QUIZ, UN SEUL SOIR ✦',
  'lg:ouroboros': 'L’OUROBOROS ✦ CENT JOURS D’AFFILÉE ✦',
  'lg:renard': 'LE RENARD ✦ DIX SOIRÉES À LA MAISON ✦',
  'lg:tigre': 'LE TIGRE ✦ DIX FOIS LE PLUS RAPIDE ✦',
}

/**
 * A · La légende gravée : un anneau de lettres frappées autour du médaillon,
 * dans le métal de la finition, comme le pourtour d'une monnaie. En petit, les
 * lettres deviennent un perlé : le même anneau, qu'on reconnaît sans le lire.
 */
function legende(mt: Metal, cle: string, petit: boolean): string {
  const g = `sc${n++}`, c = `sc${n++}`
  const texte = LEGENDES[cle] ?? 'SCELLÉ ✦'
  const anneau = petit
    ? Array.from({ length: 28 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 28
        return `<circle cx="${(50 + Math.cos(a) * 44).toFixed(2)}" cy="${(50 + Math.sin(a) * 44).toFixed(2)}" r="${i % 7 === 0 ? 2.6 : 1.6}" fill="url(#${g})" stroke="${mt.bord}" stroke-width="0.5"/>`
      }).join('')
    : `<path id="${c}" d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" fill="none"/>
       <circle cx="50" cy="50" r="47.6" fill="none" stroke="url(#${g})" stroke-width="1.1"/>
       <circle cx="50" cy="50" r="38.2" fill="none" stroke="url(#${g})" stroke-width="0.8"/>
       <text font-family="Cormorant Garamond, Georgia, serif" font-weight="700" font-size="8.4" letter-spacing="1.1" fill="url(#${g})" stroke="${mt.bord}" stroke-width="0.35" paint-order="stroke">
         <textPath href="#${c}" startOffset="0" textLength="258">${texte}</textPath></text>`
  return `<svg class="sc sc-legende${petit ? ' sc-petit' : ''}" viewBox="0 0 100 100" aria-hidden="true"><defs>${degrade(g, mt, 'x1="0" y1="0" x2="0" y2="1"')}</defs>${anneau}</svg>`
}

/** B · La décoration : une médaille d'ordre au pied du médaillon, à son ruban — lie-de-vin pour l'éclat, nuit pour l'ombre. */
function decoration(mt: Metal, cle: string): string {
  const g = `sc${n++}`, r = `sc${n++}`
  const ombre = ['lg:kraken', 'lg:fantome', 'lg:trou-noir', 'lg:chauve-souris'].includes(cle)
  const [r1, r2] = ombre ? ['#1d2346', '#2c3566'] : ['#7c1626', '#a62538']
  return `<svg class="sc sc-decoration" viewBox="0 0 44 56" aria-hidden="true"><defs>${degrade(g, mt)}
    <linearGradient id="${r}" x1="0" x2="1"><stop offset="0" stop-color="${r1}"/><stop offset="0.5" stop-color="${r2}"/><stop offset="1" stop-color="${r1}"/></linearGradient></defs>
    <path d="M10 0 H34 L29 22 L22 26 L15 22 Z" fill="url(#${r})"/>
    <path d="M19 0 V23 M25 0 V23" stroke="url(#${g})" stroke-width="1.6"/>
    <rect x="12" y="19" width="20" height="5" rx="1.5" fill="url(#${g})" stroke="${mt.bord}" stroke-width="0.6"/>
    ${etoile(22, 39, 16.5, `url(#${g})`, `stroke="${mt.bord}" stroke-width="0.8" stroke-linejoin="round"`)}
    <circle cx="22" cy="39" r="7.2" fill="url(#${g})" stroke="${mt.bord}" stroke-width="0.8"/>
    <circle cx="22" cy="39" r="5" fill="${mt.lueur}" opacity="0.35"/>
    ${etoile(22, 39, 4.6, mt.bord, 'opacity="0.8"')}
    <path class="sc-eclair" d="M17 34 L20 31.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`
}

/**
 * C · L'étoile du zénith : une étoile de navigation sertie au sommet du cercle,
 * dans le métal de la finition, sa pierre au cœur à la lueur de la finition ;
 * un halo qui respire derrière, et sa lumière qui fait le tour du cercle.
 * Avec une bordure de ligue, elle couronne la bordure, au-dessus de son cran du
 * sommet. En petit, elle grossit un peu, pour rester une étoile.
 */
function zenith(mt: Metal, _cle?: string, petit?: boolean): string {
  const g = `sc${n++}`, h = `sc${n++}`, pierre = `sc${n++}`
  const branches = (r: number, court: number, fin: number) => {
    const p: string[] = []
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i - Math.PI / 2
      const rr = i % 4 === 0 ? r : i % 2 === 0 ? court : fin
      p.push(`${(40 + Math.cos(a) * rr).toFixed(2)},${(40 + Math.sin(a) * rr).toFixed(2)}`)
    }
    return p.join(' ')
  }
  // Les arêtes de chaque branche : la moitié claire, la moitié dans l'ombre — l'étoile est taillée, pas plate.
  const aretes = [0, 1, 2, 3].map(k => {
    const a = (Math.PI / 2) * k - Math.PI / 2, b = a + Math.PI / 8
    return `<polygon points="40,40 ${(40 + Math.cos(a) * 25).toFixed(2)},${(40 + Math.sin(a) * 25).toFixed(2)} ${(40 + Math.cos(b) * 5.6).toFixed(2)},${(40 + Math.sin(b) * 5.6).toFixed(2)}" fill="${mt.bord}" opacity="0.4"/>`
  }).join('')
  return `${petit ? '' : `<span class="sc-tour" style="--lueur:${mt.lueur}"></span>`}
    <svg class="sc sc-zenith${petit ? ' sc-petit' : ''}" viewBox="0 0 80 80" aria-hidden="true"><defs>${degrade(g, mt)}
      <radialGradient id="${h}"><stop offset="0" stop-color="${mt.lueur}" stop-opacity="1"/><stop offset="0.4" stop-color="${mt.lueur}" stop-opacity="0.45"/><stop offset="1" stop-color="${mt.lueur}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${pierre}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="0.4" stop-color="${mt.lueur}"/><stop offset="1" stop-color="${mt.m[2]}"/></radialGradient></defs>
      <g class="sc-rayons">${Array.from({ length: 16 }, (_, i) => {
        const a = (Math.PI / 8) * i
        const r = i % 2 === 0 ? 39 : 31
        return `<line x1="${(40 + Math.cos(a) * 9).toFixed(2)}" y1="${(40 + Math.sin(a) * 9).toFixed(2)}" x2="${(40 + Math.cos(a) * r).toFixed(2)}" y2="${(40 + Math.sin(a) * r).toFixed(2)}" stroke="${mt.lueur}" stroke-width="${i % 2 === 0 ? 1.1 : 0.7}" stroke-linecap="round" opacity="0.55"/>`
      }).join('')}</g>
      <circle class="sc-halo" cx="40" cy="40" r="26" fill="url(#${h})"/>
      <polygon points="${branches(25, 11, 5.4)}" fill="url(#${g})" stroke="${mt.bord}" stroke-width="1.4" stroke-linejoin="round"/>
      ${aretes}
      <polygon points="${branches(12, 7.5, 3.6)}" transform="rotate(22.5 40 40)" fill="url(#${g})" stroke="${mt.bord}" stroke-width="0.9" stroke-linejoin="round" opacity="0.95"/>
      <circle cx="40" cy="40" r="6" fill="url(#${pierre})" stroke="${mt.bord}" stroke-width="1.1"/>
      <path class="sc-eclair" d="M40 11 V22 M40 58 V69 M11 40 H22 M58 40 H69" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
    </svg>`
}

const POURQUOI_ECARTE: Record<string, string> = {
  legende: 'Superbe sur un médaillon nu, illisible en dessous de 60 pixels, et autour d’une bordure de ligue il double la taille de l’avatar.',
  decoration: 'Elle tient sous toutes les finitions, mais se perd sous les grandes bordures et prend la place du prénom sur le podium.',
}

const SCEAUX = {
  legende: (mt: Metal, cle: string, petit: boolean) => legende(mt, cle, petit),
  decoration: (mt: Metal, cle: string) => decoration(mt, cle),
  zenith: (mt: Metal, cle: string, petit: boolean) => zenith(mt, cle, petit),
} as const
type Sceau = keyof typeof SCEAUX | null

/** Un avatar rendu par l'application, son sceau posé dans sa boîte (1,12 em, le médaillon). */
function avatar(props: Record<string, any>, sceau: Sceau, taille: number, cls = 'av-sujet'): string {
  let html = renderToStaticMarkup(React.createElement(Avatar, { avatar: '🦊', className: cls, ...props }))
  if (sceau) html = html.replace(/<\/span>$/, `${SCEAUX[sceau](METAUX[props.finition ?? 'mat'], props.legendaire, taille < 40)}</span>`)
  return `<span class="boite" style="font-size:${taille}px">${html}</span>`
}

const fig = (contenu: string, legende: string) => `<figure>${contenu}<figcaption>${legende}</figcaption></figure>`

const FINITIONS_MONTREES = ['mat', 'argent', 'or', 'holo', 'prisme', 'aurore', 'constellation', 'abysses', 'orage', 'envol', 'disco', 'singularite']
const NOMS_DES_SCEAUX: Record<string, [string, string]> = {
  legende: ['A · La légende gravée', 'Son nom et son exploit frappés tout autour, comme le pourtour d’une monnaie. En petit, un perlé.'],
  decoration: ['B · La décoration', 'Une médaille d’ordre au pied du médaillon, à son ruban : lie-de-vin pour l’éclat, nuit pour l’ombre.'],
  zenith: ['C · L’étoile du zénith', 'Une étoile de métal au sommet, et sa lumière qui fait le tour du cercle toutes les six secondes.'],
}

// Les tenues complètes : tout ce qu'un avatar peut porter à la fois.
const TENUES: [string, Record<string, any>][] = [
  ['Comète · Or', { legendaire: 'lg:comete', finition: 'or' }],
  ['Phénix éclaté · Or · Fleurons', { legendaire: 'lg:phenix', finition: 'or', eclat: true, bordure: { ligue: 'or', crans: 12 } }],
  ['Lion en jade · Envol', { legendaire: 'lg:lion', finition: 'envol', eclat: 'jade' }],
  ['Kraken · Constellation · Soleil noir', { legendaire: 'lg:kraken', finition: 'constellation', bordure: { ligue: 'maitre', crans: 12 } }],
  ['Dragon éclaté · Singularité', { legendaire: 'lg:dragon', finition: 'singularite', eclat: true }],
  ['Ouroboros · Orage · Couronne de brillants', { legendaire: 'lg:ouroboros', finition: 'orage', bordure: { ligue: 'diamant', crans: 9 } }],
  ['Renard en obsidienne · Disco', { legendaire: 'lg:renard', finition: 'disco', eclat: 'obsidienne' }],
  ['Tigre · Abysses · Givre', { legendaire: 'lg:tigre', finition: 'abysses', bordure: { ligue: 'platine', crans: 12 } }],
]

/** Avant, après : chaque tenue telle qu'elle est aujourd'hui, puis scellée. */
const avantApres = `
  <div class="paires">${TENUES.map(
    ([nom, p]) => `<div class="paire"><div class="deux">${avatar(p, null, 76)}${avatar(p, 'zenith', 76)}</div><p>${nom}</p></div>`,
  ).join('')}</div>`

/** La carte d'un joueur, en grand : le sceau là où il est le sujet. */
const carte = (qui: string, niv: number, titre: string, p: Record<string, any>, plaque: string) => `
  <div class="carte-mq">
    <div class="carte-tete"><span class="gemme-niv">${niv}</span><span><b>${qui}</b><small>${titre}</small></span></div>
    <div class="carte-illu">${avatar({ ...p, grand: true }, 'zenith', 128)}</div>
    <div class="plaque"><span class="plaque-etoile">✦</span> ${plaque}</div>
  </div>`

const INVITES: [string, number, Record<string, any>, boolean][] = [
  ['Camille', 32, { legendaire: 'lg:comete', finition: 'constellation' }, true],
  ['Hugo', 18, { legendaire: 'lg:comete', finition: 'or' }, false],
  ['Léa', 41, { legendaire: 'lg:lion', finition: 'envol', eclat: 'jade', bordure: { ligue: 'or', crans: 12 } }, true],
  ['Malik', 23, { legendaire: 'lg:ouroboros', finition: 'aurore' }, false],
  ['Inès', 36, { legendaire: 'lg:renard', finition: 'orage', eclat: true }, true],
  ['Tom', 0, {}, false],
]

/** La salle d'une soirée, au téléphone : les puces des invités, à leur vraie taille. */
const salle = `<div class="tel-mq"><p class="tel-code">K7Q2</p><p class="tel-sous">6 invités · le quiz commence bientôt</p>
  ${INVITES.map(([nom, niv, p, s]) => `<div class="invite-mq">${p.legendaire ? avatar(p, s ? 'zenith' : null, 34, 'lb-avatar') : '<span class="boite" style="font-size:30px">🐸</span>'}<b>${nom}</b>${niv ? `<span class="niv">${niv}</span>` : ''}</div>`).join('')}
  </div>`

/** La fin d'un quiz à l'écran commun : le podium, où tout le monde regarde. */
const podium = `<div class="podium-mq">
  ${[1, 0, 2].map(i => { const [nom, , p, s] = INVITES[[0, 2, 4][i]]; return `<div class="marche-mq m${i}">${avatar(p, s ? 'zenith' : null, [96, 76, 64][i])}<b>${nom}</b><i class="socle-mq">${i + 1}</i></div>` }).join('')}
  </div>`

const ecartes = (['legende', 'decoration'] as const).map(
  sc => `<div class="ecarte"><h3>${NOMS_DES_SCEAUX[sc][0]}</h3><div class="rang">${TENUES.slice(0, 4).map(([nom, p]) => fig(avatar(p, sc, 60), nom)).join('')}</div><p>${POURQUOI_ECARTE[sc]}</p></div>`,
).join('')

const STYLE = `
  body { margin: 0; padding: 32px max(16px, env(safe-area-inset-left, 0px)) 64px; background: var(--bg); color: var(--ink); font-family: var(--sans); min-height: 0; }
  .page { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 48px; }
  h1 { font-family: var(--serif); font-size: clamp(2.2rem, 5vw, 3.2rem); margin: 0; font-weight: 600; }
  h2 { font-family: var(--serif); font-size: 2rem; margin: 0; font-weight: 600; }
  h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin: 8px 0 0; font-weight: 600; }
  .chapeau { display: flex; flex-direction: column; gap: 12px; max-width: 70ch; color: var(--muted); }
  .chapeau b { color: var(--ink); }
  .chapeau .dit { font-family: var(--serif); font-style: italic; font-size: 1.25rem; color: var(--accent-text); }
  .candidat { display: flex; flex-direction: column; gap: 14px; padding-top: 28px; border-top: 1px solid rgba(var(--accent-rgb), 0.22); }
  .candidat header p { margin: 4px 0 0; color: var(--muted); }
  .rang { display: flex; flex-wrap: wrap; gap: 44px 26px; align-items: flex-end; padding: 18px 4px 6px; }
  .rang.serre { gap: 26px 20px; }
  .rang.petit { gap: 18px 16px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 30px; width: 140px; }
  .serre figure { width: 88px; gap: 26px; }
  .petit figure { width: 52px; gap: 10px; }
  figcaption { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.3; }
  .boite { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .boite > .av { line-height: 1; }
  .barre { display: flex; gap: 8px; flex-wrap: wrap; }
  .barre button { font: 600 0.85rem var(--sans); color: var(--ink); background: transparent; border: 1px solid rgba(var(--accent-rgb), 0.35); border-radius: 999px; padding: 7px 15px; cursor: pointer; }
  .barre button[aria-pressed='true'] { background: var(--accent); color: var(--on-accent); }
  .cartes { display: flex; flex-wrap: wrap; gap: 20px; }
  .carte-mq { width: min(300px, 100%); padding: 16px; border-radius: 22px; display: flex; flex-direction: column; gap: 10px; align-items: center;
    background: linear-gradient(160deg, var(--bg-halo), var(--bg-raised)); box-shadow: inset 0 0 0 3px var(--accent), inset 0 0 0 5px var(--bg), inset 0 0 0 6px var(--accent); }
  .carte-tete { align-self: stretch; display: flex; gap: 10px; align-items: center; }
  .carte-tete span:last-child { display: flex; flex-direction: column; line-height: 1.15; }
  .carte-tete b { font-family: var(--serif); font-size: 1.4rem; }
  .carte-tete small { color: var(--muted); }
  .gemme-niv { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 0.8rem; }
  .carte-illu { padding: 92px 0 40px; }
  .plaque { font-size: 0.82rem; color: var(--accent-text); border: 1px solid var(--accent); border-radius: 999px; padding: 5px 12px; text-align: center; }

  .paires { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 34px 20px; padding-top: 18px; }
  .paire { display: flex; flex-direction: column; align-items: center; gap: 26px; }
  .paire .deux { display: flex; gap: 80px; align-items: center; justify-content: center; min-height: 190px; padding-top: 30px; }
  .paire p { margin: 0; font-size: 12px; color: var(--muted); text-align: center; }
  .scenes { display: flex; flex-wrap: wrap; gap: 24px; align-items: stretch; }
  .tel-mq { width: min(340px, 100%); padding: 20px 18px; border-radius: 24px; border: 1px solid rgba(var(--accent-rgb), 0.25); background: var(--bg); display: flex; flex-direction: column; gap: 4px; }
  .tel-code { margin: 0; text-align: center; font-family: var(--serif); font-size: 2.2rem; letter-spacing: 0.18em; color: var(--accent-text); font-weight: 700; }
  .tel-sous { margin: 0 0 10px; text-align: center; color: var(--muted); font-size: 0.8rem; }
  .invite-mq { display: flex; align-items: center; gap: 16px; padding: 14px 6px 10px; border-bottom: 1px solid rgba(var(--accent-rgb), 0.14); }
  .invite-mq b { flex: 1; }
  .invite-mq .niv { font-size: 0.78rem; color: var(--accent-text); border: 1px solid var(--accent); border-radius: 999px; padding: 1px 8px; }
  .podium-mq { flex: 1; min-width: min(420px, 100%); border-radius: 18px; border: 1px solid rgba(var(--accent-rgb), 0.25); background: radial-gradient(ellipse at 50% 0%, var(--bg-halo), var(--bg) 70%); display: flex; align-items: flex-end; justify-content: center; gap: 36px; padding: 70px 20px 0; overflow: hidden; }
  .marche-mq { display: flex; flex-direction: column; align-items: center; gap: 34px; }
  .marche-mq b { font-size: 1.05rem; }
  .marche-mq .socle-mq { font-style: normal; width: 110px; display: grid; place-items: center; font-family: var(--serif); font-size: 2rem; font-weight: 700; color: var(--accent-text); background: rgba(var(--accent-rgb), 0.08); border-radius: 12px 12px 0 0; }
  .marche-mq.m0 .socle-mq { height: 110px; } .marche-mq.m1 .socle-mq { height: 76px; } .marche-mq.m2 .socle-mq { height: 52px; }
  .ecarte { display: flex; flex-direction: column; gap: 6px; }
  .ecarte p { margin: 0; color: var(--muted); font-size: 0.9rem; max-width: 70ch; }
  .plaque-etoile { color: var(--accent-text); }

  /* Le sceau, dans la boîte du médaillon (1,12 em) : au-dessus de tout, même de ce qui déborde. */
  .sc { position: absolute; z-index: 6; pointer-events: none; filter: drop-shadow(0 0.02em 0.03em rgba(0, 0, 0, 0.55)); overflow: visible; }
  .sc-legende { width: 1.5em; height: 1.5em; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 0; filter: drop-shadow(0 0 0.03em rgba(0,0,0,0.6)); }
  .sc-legende.sc-petit { width: 1.42em; height: 1.42em; }
  .av-bordure .sc-legende { width: 2.24em; height: 2.24em; }
  .sc-decoration { width: 0.5em; left: 50%; top: calc(100% - 0.2em); transform: translateX(-50%); }
  .av-bordure .sc-decoration { top: calc(100% + 0.06em); }
  /* Centrée sur le cercle, à son sommet ; sur une bordure, sur le bord de la bordure, qu'elle couronne. */
  .sc-zenith { width: 0.82em; left: 50%; top: 0; transform: translate(-50%, -50%); filter: drop-shadow(0 0.02em 0.05em rgba(0, 0, 0, 0.65)); }
  .av-bordure .sc-zenith { top: -0.34em; width: 0.9em; }
  .sc-zenith.sc-petit { width: 1em; }
  .sc-petit .sc-rayons { display: none; }
  .av-bordure .sc-zenith.sc-petit { top: -0.3em; }
  .sc-tour { position: absolute; z-index: 5; pointer-events: none; inset: -0.02em; border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0 78%, var(--lueur) 92%, #fff 95%, transparent 97%);
    -webkit-mask: radial-gradient(closest-side, transparent 88%, #000 90%, #000 99%, transparent 100%);
            mask: radial-gradient(closest-side, transparent 88%, #000 90%, #000 99%, transparent 100%); opacity: 0.9; }
  .lb-avatar .sc-tour { display: none; }
  @media (prefers-reduced-motion: no-preference) {
    .av-sujet .sc-tour { animation: sc-tour 6s linear infinite; }
    @keyframes sc-tour { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .av-sujet .sc-halo { animation: sc-halo 3.2s ease-in-out infinite; transform-origin: 40px 40px; }
    @keyframes sc-halo { 0%, 100% { opacity: 0.55; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.2); } }
    .av-sujet .sc-rayons { animation: sc-rayons 24s linear infinite; transform-origin: 40px 40px; }
    @keyframes sc-rayons { to { transform: rotate(360deg); } }
    .av-sujet .sc-eclair { animation: sc-eclair 5s ease-in-out infinite; }
    @keyframes sc-eclair { 0%, 76%, 100% { opacity: 0; } 82% { opacity: 0.95; } }
  }
  .sc-eclair { opacity: 0; }
`

const html = `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le sceau des légendaires</title>
<style>${readFileSync(path.join(RACINE, 'client/src/styles.css'), 'utf8')}${STYLE}</style>
<body><main class="page">
  <header class="chapeau">
    <h1>L'étoile du zénith</h1>
    <p class="dit">« Il faut que ça rende très joli, et qu'on ait envie de le garder. »</p>
    <p>Le sceau d'un légendaire gagné par son exploit : <b>une étoile taillée, sertie au sommet du cercle</b>, sa pierre au cœur. Elle est rendue ici sur <b>les vrais avatars de l'application</b>, avec tout ce qu'on peut porter à la fois : les douze finitions et leur lumière, l'Éclat, les matières, les bordures de ligue des duels.</p>
    <p>Elle prend <b>le métal de la finition portée</b>, celui que la bordure de ligue prend déjà : d'or en Or, d'eau qui luit en Abysses, de nuit cerclée de feu en Singularité. Sur une bordure, elle la couronne. Là où l'avatar est le sujet, un halo respire derrière elle, et toutes les six secondes sa lumière fait le tour du cercle.</p>
    <div class="barre" role="group" aria-label="Thème"><button type="button" data-t="" aria-pressed="true">Velours</button><button type="button" data-t="ivoire" aria-pressed="false">Ivoire</button></div>
  </header>

  <section class="candidat"><header><h2>Avant, après</h2><p>Chaque tenue telle qu'elle est aujourd'hui, puis scellée. Aucune ne perd rien : l'étoile se pose au seul endroit que personne n'occupe.</p></header>
    ${avantApres}</section>

  <section class="candidat"><header><h2>Sous chaque finition</h2><p>La Comète, de Mat à Singularité : douze métaux, douze étoiles.</p></header>
    <div class="rang serre">${FINITIONS_MONTREES.map(f => fig(avatar({ legendaire: 'lg:comete', finition: f }, 'zenith', 54), NOM_FINITION[f])).join('')}</div></section>

  <section class="candidat"><header><h2>Là où les autres la voient</h2><p>La salle au téléphone, à la taille des puces : Camille, Léa et Inès ont leur étoile, pas Hugo ni Malik, venus du Cabinet. Puis le podium de l'écran commun.</p></header>
    <div class="scenes">${salle}${podium}</div></section>

  <section class="candidat"><header><h2>En grand, sur la carte</h2><p>Là où on la regarde : sa plaque dit l'exploit.</p></header>
    <div class="cartes">
      ${carte('Léa', 41, 'La Reine de la soirée', { legendaire: 'lg:lion', finition: 'envol', eclat: 'jade', bordure: { ligue: 'or', crans: 12 } }, 'Huit fois reine d’une soirée')}
      ${carte('Camille', 32, 'L’Éclair de la maison', { legendaire: 'lg:phenix', finition: 'or', eclat: true, bordure: { ligue: 'or', crans: 12 } }, 'Il renaît : trois remontées')}
      ${carte('Inès', 36, 'La Nuit blanche', { legendaire: 'lg:kraken', finition: 'constellation', bordure: { ligue: 'maitre', crans: 12 } }, 'Trois lanternes rouges')}
    </div></section>

  <section class="candidat"><header><h2>Les deux autres pistes, écartées</h2><p>Dessinées et rendues de même, elles tenaient moins bien face à tout le reste.</p></header>
    ${ecartes}</section>
</main>
<script>
  document.querySelectorAll('.barre button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.t) document.documentElement.dataset.theme = b.dataset.t; else delete document.documentElement.dataset.theme
    document.querySelectorAll('.barre button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
  }))
</script></body></html>`

// Les polices, incluses une fois ; les peintures, à côté de la page (`medaillons/`), qu'on publie avec elle :
// incluses à chaque avatar, la page pesait 13 Mo. Pour les photos, une copie qui les lit dans `client/public`.
const inclus = (sous: string, f: string, type: string) => `data:${type};base64,${readFileSync(path.join(RACINE, 'client/public', sous, f)).toString('base64')}`
const avecPolices = html.replace(/url\('\/fonts\/([\w.-]+\.woff2)'\)/g, (_m, f) => `url('${inclus('fonts', f, 'font/woff2')}')`)
const PEINTURES = [...new Set([...avecPolices.matchAll(/\/medaillons\/([\w.-]+\.webp)/g)].map(m => m[1]))]
const sortie = path.join(ICI, 'planche.html')
writeFileSync(sortie, avecPolices.replace(/\/medaillons\//g, 'medaillons/'))
writeFileSync(path.join(ICI, 'peintures.json'), JSON.stringify(Object.fromEntries(PEINTURES.map(f => [`medaillons/${f}`, `client/public/medaillons/${f}`])), null, 1))
const pourLesPhotos = path.join(ICI, '.planche-locale.html')
writeFileSync(pourLesPhotos, avecPolices.replace(/\/medaillons\//g, 'file://' + path.join(RACINE, 'client/public/medaillons') + '/'))
console.log(sortie, Math.round(readFileSync(sortie).length / 1024), 'Ko,', PEINTURES.length, 'peintures')

// Les photos, en Velours et en Ivoire.
const { chromium } = createRequire(import.meta.url)('playwright')
const nav = await chromium.launch({ args: ['--allow-file-access-from-files'] })
for (const theme of ['', 'ivoire']) {
  const onglet = await nav.newPage({ viewport: { width: 1280, height: 900 } })
  const erreurs: string[] = []
  onglet.on('pageerror', (e: Error) => erreurs.push(e.message))
  await onglet.goto('file://' + pourLesPhotos)
  if (theme) await onglet.evaluate(t => (document.documentElement.dataset.theme = t), theme)
  await onglet.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  await onglet.waitForTimeout(1200)
  await onglet.screenshot({ path: path.join(ICI, `planche${theme ? '-' + theme : ''}.png`), fullPage: true })
  if (erreurs.length) console.error(erreurs)
  await onglet.close()
}
await nav.close()
if (!process.env.GARDER) rmSync(pourLesPhotos)

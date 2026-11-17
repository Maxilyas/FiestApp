// La planche des bordures de ligue : ce qu'elles donnent aujourd'hui autour
// des avatars que les joueurs portent vraiment, puis trois pistes pour qu'elles
// soient jolies à chaque victoire — posées sur les vrais avatars de
// l'application (`Avatar.tsx`, `Legendaire.tsx`, `Portrait.tsx`,
// `Compagnon.tsx`, `Lumiere.tsx`) sous la vraie feuille de style, en grand,
// dans une ligue de classement, en Velours et en Ivoire.
//
//   cd server && npx tsx ../retours/2026-11-17/bordures/planche.ts
//
// Écrit `planche.html`, `planche-ivoire.html` (que git ignore : six mégaoctets
// chacune, la feuille de l'application comprise — les peintures s'y lisent
// dans `client/public`, par un chemin relatif) et leurs photos à côté d'elles,
// section par section. `SEULEMENT=face,jonc` n'en refait que quelques-unes,
// `SANS_IVOIRE=1` saute le thème clair. Une maquette, pas du code livré : rien
// de `client/` ne bouge.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { apaise, jonc, parure, type Ligue, type Metal } from './dessins'

Object.assign(globalThis, { React })
const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../..')
const { renderToStaticMarkup } = await import('react-dom/server')
const duClient = (f: string) => import(path.join(RACINE, 'client/src', f))
await duClient('components/Legendaire.tsx')
await duClient('components/Portrait.tsx')
for (const b of ['monde', 'mythes', 'oceans', 'espace', 'foret', 'ecran', 'scene', 'contes', 'stade', 'brigade', 'arcade', 'carnaval']) await duClient(`components/portraits/${b}.ts`)
await duClient('components/compagnons-peints.ts')
await duClient('components/Lumiere.tsx')
await duClient('components/Bordure.tsx')
const { inscrireDessin } = await duClient('components/medaillons.ts')
const { svgDuCadre, svgDesRayons } = await duClient('components/dessinDesBordures.ts')
const { METAUX } = (await duClient('components/metaux.ts')) as { METAUX: Record<string, Metal> }
const { Bordure: BordureDAujourdhui } = await duClient('components/Bordure.tsx')
const { Avatar } = await duClient('components/Avatar.tsx')
const { LIGUES, NOM_DE_LA_BORDURE } = await import(path.join(RACINE, 'shared/duels.ts'))
const { NOM_FINITION } = await import(path.join(RACINE, 'shared/profil.ts'))

// ── Les tenues ────────────────────────────────────────────────────────────

/** Une tenue : l'avatar, sa finition, son Éclat, sa bordure. */
interface Tenue {
  avatar: string
  legendaire?: string
  finition: string
  eclat?: boolean | string
  ligue: Ligue
  crans: number
  /** Son légendaire est scellé : l'étoile du zénith, au sommet. */
  sceau?: boolean
}

/**
 * Ce que portent, avec une bordure, les dix-neuf joueurs de la production
 * qui en ont une — relevé le 17 novembre 2026, en lecture seule
 * (`PROD_LECTURE_URL`), sans un nom ni un identifiant : la tenue seule.
 * Quatorze ne sont pas serties ; treize entourent un avatar peint ; onze
 * portent une finition à lumière.
 */
const EN_PRODUCTION: Tenue[] = [
  { avatar: '🦊', legendaire: 'lg:phenix', finition: 'constellation', eclat: 'obsidienne', ligue: 'diamant', crans: 11 },
  { avatar: '🦊', legendaire: 'lg:dragon', finition: 'aurore', ligue: 'diamant', crans: 2 },
  { avatar: '🦊', legendaire: 'lg:comete', finition: 'constellation', eclat: true, ligue: 'platine', crans: 12 },
  { avatar: '🦊', legendaire: 'br:pangolin', finition: 'prisme', ligue: 'or', crans: 3 },
  { avatar: '🦩', finition: 'or', ligue: 'bronze', crans: 1 },
  { avatar: '🦊', legendaire: 'lg:chauve-souris', finition: 'aurore', eclat: true, ligue: 'bronze', crans: 0 },
  { avatar: '👑', finition: 'or', ligue: 'bronze', crans: 2 },
  { avatar: '🦊', legendaire: 'lg:coq', finition: 'aurore', ligue: 'platine', crans: 4 },
  { avatar: '🦊', legendaire: 'cp:panda-sakura', finition: 'prisme', ligue: 'bronze', crans: 12 },
  { avatar: '🦊', legendaire: 'lg:chouette', finition: 'aurore', ligue: 'argent', crans: 10 },
  { avatar: '🦊', legendaire: 'lg:renard', finition: 'holo', ligue: 'bronze', crans: 8 },
  { avatar: '🦊', legendaire: 'lg:renard', finition: 'holo', ligue: 'platine', crans: 12 },
  { avatar: '🦊', legendaire: 'lg:chimere', finition: 'abysses', ligue: 'maitre', crans: 12 },
  { avatar: '🦁', finition: 'holo', eclat: true, ligue: 'or', crans: 5 },
  { avatar: '🐨', finition: 'or', ligue: 'bronze', crans: 2 },
  { avatar: '🦊', legendaire: 'br:anubis', finition: 'aurore', ligue: 'or', crans: 12 },
  { avatar: '🦊', finition: 'argent', ligue: 'bronze', crans: 2 },
  { avatar: '🦊', legendaire: 'br:fennec', finition: 'prisme', ligue: 'bronze', crans: 4 },
  { avatar: '🦊', finition: 'or', eclat: true, ligue: 'bronze', crans: 1 },
]

// ── Les pistes ────────────────────────────────────────────────────────────

/** Le métal d'une ligue — l'or pour les maîtres, dont le bandeau est d'émail. */
const metalDeLaLigue = (ligue: Ligue): Metal => METAUX[ligue === 'maitre' ? 'or' : ligue]
/** Le métal de la finition, la règle d'aujourd'hui : en Mat, celui de la ligue. */
const metalDeLaFinition = (ligue: Ligue, finition: string): Metal => (finition === 'mat' ? metalDeLaLigue(ligue) : METAUX[finition])

type Piste = 'aujourdhui' | 'apaise' | 'jonc' | 'parure'
/** D'où vient le métal : de la finition (aujourd'hui), ou de la ligue. */
type Source = 'finition' | 'ligue'

const image = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** Chaque dessin une fois dans la page : une classe, son image en fond. */
const IMAGES = new Map<string, string>()
function classeDe(svg: string): string {
  let c = IMAGES.get(svg)
  if (!c) IMAGES.set(svg, (c = `bi-${IMAGES.size}`))
  return c
}

/** La bordure d'une piste, à la place de celle de l'application (`inscrireDessin`). */
function bordureDe(piste: Piste, source: Source) {
  if (piste === 'aujourdhui') return BordureDAujourdhui
  return function Bordure({ ligue, crans, finition }: { ligue: Ligue; crans: number; finition: string }) {
    const met = source === 'ligue' ? metalDeLaLigue(ligue) : metalDeLaFinition(ligue, finition)
    let cadre: string
    let rayons: string | null = null
    if (piste === 'apaise') {
      const f = source === 'ligue' ? 'mat' : finition
      cadre = apaise(svgDuCadre(ligue, 12, f), crans)
      const r = svgDesRayons(ligue, 12, f)
      rayons = r ? apaise(r, crans) : null
    } else cadre = piste === 'jonc' ? jonc(ligue, crans, met) : parure(ligue, crans, met)
    return React.createElement(
      'span',
      { className: `bo bo-${ligue}${crans >= 12 ? ' bo-sertie' : ''}`, 'aria-hidden': 'true' },
      rayons && React.createElement('i', { className: `bo-rayons bi ${classeDe(rayons)}` }),
      React.createElement('i', { className: `bo-cadre bi ${classeDe(cadre)}` }),
    )
  }
}

// ── La page ───────────────────────────────────────────────────────────────

const PUBLIC = path.relative(ICI, path.join(RACINE, 'client/public')).replaceAll('\\', '/') + '/'
const localiser = (html: string) =>
  html
    .replaceAll(/(?<![\w.])\/(medaillons|portraits|compagnons)\//g, `${PUBLIC}$1/`)
    .replaceAll("url('/fonts/", `url('${PUBLIC}fonts/`)
const FEUILLE = localiser(readFileSync(path.join(RACINE, 'client/src/styles.css'), 'utf8'))

/** Un avatar rendu sous une piste, à cette taille (1 em), dans une case qui laisse la place à sa bordure. */
function case_(t: Tenue, piste: Piste, source: Source, taille: number, classe: string, legende = ''): string {
  inscrireDessin({ Bordure: bordureDe(piste, source) })
  const av = renderToStaticMarkup(
    React.createElement(Avatar, { avatar: t.avatar, legendaire: t.legendaire, finition: t.finition, eclat: t.eclat || undefined, bordure: { ligue: t.ligue, crans: t.crans }, sceau: t.sceau, className: classe }),
  )
  return `<figure class="piste-${piste}" style="width:${Math.round(Math.max(taille * 2.5, 44))}px"><span class="boite" style="font-size:${taille}px;height:${Math.round(taille * 2.3)}px">${localiser(av)}</span>${legende ? `<figcaption>${legende}</figcaption>` : ''}</figure>`
}

const STYLE = `
  body { margin: 0; padding: 28px 32px 60px; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, sans-serif; min-height: 0; width: 1500px; box-sizing: border-box; }
  section { padding: 8px 0 34px; }
  h1 { font: 600 30px var(--serif, Georgia, serif); margin: 0 0 6px; }
  h2 { font: 600 24px var(--serif, Georgia, serif); margin: 26px 0 4px; color: var(--accent-text); }
  h3 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin: 26px 0 0; color: var(--muted); font-weight: 600; }
  p { margin: 4px 0; max-width: 980px; }
  p.sous { color: var(--muted); }
  ul { margin: 6px 0 0; padding-left: 20px; max-width: 980px; }
  li { margin: 3px 0; }
  .rang { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px 6px; padding: 14px 0 4px; }
  .rang.serre { gap: 8px 0; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  figcaption { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.3; }
  .boite { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .boite > .av { line-height: 1; }
  .bi { background: center / 100% 100% no-repeat; }
  /* Le filet du halo d'Or, à 1,45 em : sous le bandeau d'aujourd'hui, il ne se voyait pas ; autour d'une bordure fine, il ferait un second cercle. */
  .piste-jonc .av-bordure.av-or::before, .piste-parure .av-bordure.av-or::before { box-shadow: none; }
  /* L'étoile d'un légendaire scellé couronne la bordure : plus fine, son bord est plus près de l'avatar. */
  .piste-jonc .av-bordure .sc { top: -0.05em !important; }
  .piste-parure .av-bordure .sc { top: -0.02em !important; }
  table.face { border-collapse: collapse; margin-top: 10px; }
  table.face th { font-size: 13px; font-weight: 600; color: var(--accent-text); padding: 6px 10px; text-align: center; }
  table.face th small { display: block; font-weight: 400; color: var(--muted); }
  table.face td { padding: 2px 10px; text-align: center; border-top: 1px solid rgba(var(--accent-rgb), 0.16); }
  table.face td.nom { text-align: left; font-size: 12px; color: var(--muted); width: 150px; }
  .zoom { display: inline-block; transform: scale(3); transform-origin: 0 0; }
  .loupe { height: 150px; overflow: hidden; }
`

const NOMS: Record<Piste, [string, string]> = {
  aujourdhui: ['Aujourd’hui', 'les alliages du 12 octobre'],
  apaise: ['1 · Les alliages, apaisés', 'le même dessin, sans pointillé'],
  jonc: ['2 · Le jonc serti', 'un anneau fin, douze pierres'],
  parure: ['3 · La parure', 'une couronne qui pousse'],
}

const ligues = LIGUES.map((l: { cle: Ligue }) => l.cle) as Ligue[]
const LEGENDAIRES_DES_LIGUES: Record<Ligue, string> = { bronze: 'lg:renard', argent: 'lg:chouette', or: 'lg:phenix', platine: 'lg:comete', diamant: 'lg:dragon', maitre: 'lg:chimere' }
const dit = (t: Tenue) => `${t.legendaire ? t.legendaire.replace(/^\w+:/, '') : t.avatar} · ${NOM_FINITION[t.finition]}${t.eclat ? ' · éclaté' : ''}<br>${t.ligue} ${t.crans}/12`

/** Les rangées d'une piste : ses six ligues, ses crans, les tenues de la production, en petit. */
function rangees(piste: Piste, source: Source): string {
  const G = 78
  return (
    `<h3>Les six ligues, serties — sur un emoji, puis sur un légendaire</h3>` +
    `<div class="rang">${ligues.map(l => case_({ avatar: '🦊', finition: 'or', ligue: l, crans: 12 }, piste, source, G, 'av-sujet', `${NOM_DE_LA_BORDURE[l]}`)).join('')}` +
    `${ligues.map(l => case_({ avatar: '🦊', legendaire: LEGENDAIRES_DES_LIGUES[l], finition: 'or', ligue: l, crans: 12 }, piste, source, G, 'av-sujet', l)).join('')}` +
    `${case_({ avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', ligue: 'or', crans: 12, sceau: true }, piste, source, G, 'av-sujet', 'scellé : son étoile')}</div>` +
    `<h3>Chaque victoire — la ligue de bronze, où jouent neuf joueurs sur dix-neuf, puis la ligue d’or</h3>` +
    `<div class="rang">${[0, 1, 2, 3, 5, 8, 11, 12].map(n => case_({ avatar: '🐨', finition: 'or', ligue: 'bronze', crans: n }, piste, source, 62, 'av-sujet', `${n} sur 12`)).join('')}` +
    `${[0, 1, 3, 6, 9, 12].map(n => case_({ avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', ligue: 'or', crans: n }, piste, source, 62, 'av-sujet', `${n} sur 12`)).join('')}</div>` +
    `<h3>Les dix-neuf tenues de la production</h3>` +
    `<div class="rang">${EN_PRODUCTION.map(t => case_(t, piste, source, 62, 'av-sujet', dit(t))).join('')}</div>` +
    `<h3>Dans une ligne de classement (1,2 rem) — à sa taille, puis à la loupe</h3>` +
    `<div class="rang serre">${EN_PRODUCTION.map(t => case_(t, piste, source, 19, 'lb-avatar')).join('')}</div>` +
    `<div class="loupe"><div class="zoom"><div class="rang serre" style="width:1100px">${EN_PRODUCTION.slice(0, 10).map(t => case_(t, piste, source, 19, 'lb-avatar')).join('')}</div></div></div>`
  )
}

/** Les mêmes tenues sous chaque piste, côte à côte : ce qu'on regarde d'abord. */
function faceAFace(tenues: Tenue[]): string {
  const pistes: [Piste, Source][] = [['aujourdhui', 'finition'], ['apaise', 'ligue'], ['jonc', 'ligue'], ['parure', 'ligue']]
  return (
    `<table class="face"><tr><th></th>${pistes.map(([p]) => `<th>${NOMS[p][0]}<small>${NOMS[p][1]}</small></th>`).join('')}</tr>` +
    tenues.map(t => `<tr><td class="nom">${dit(t)}</td>${pistes.map(([p, s]) => `<td>${case_(t, p, s, 84, 'av-sujet')}</td>`).join('')}</tr>`).join('') +
    `</table>`
  )
}

/** D'où vient le métal : la même tenue, le métal de sa ligue puis celui de sa finition. */
function lesDeuxMetaux(piste: Piste): string {
  const tenues: Tenue[] = [
    { avatar: '🦊', legendaire: 'lg:renard', finition: 'holo', ligue: 'bronze', crans: 8 },
    { avatar: '🦊', legendaire: 'cp:panda-sakura', finition: 'prisme', ligue: 'bronze', crans: 12 },
    { avatar: '🦊', legendaire: 'lg:chouette', finition: 'aurore', ligue: 'argent', crans: 10 },
    { avatar: '🦊', legendaire: 'br:anubis', finition: 'aurore', ligue: 'or', crans: 12 },
    { avatar: '🦊', legendaire: 'lg:comete', finition: 'constellation', eclat: true, ligue: 'platine', crans: 12 },
    { avatar: '🦊', legendaire: 'lg:chimere', finition: 'abysses', ligue: 'maitre', crans: 12 },
    { avatar: '🦁', finition: 'holo', eclat: true, ligue: 'or', crans: 5 },
  ]
  return (['ligue', 'finition'] as Source[])
    .map(s => `<h3>${NOMS[piste][0]} — le métal de ${s === 'ligue' ? 'la ligue' : 'la finition (la règle d’aujourd’hui)'}</h3><div class="rang">${tenues.map(t => case_(t, piste, s, 74, 'av-sujet', dit(t))).join('')}</div>`)
    .join('')
}

const CHOISIES = [EN_PRODUCTION[1], EN_PRODUCTION[10], EN_PRODUCTION[6], EN_PRODUCTION[13], EN_PRODUCTION[9], EN_PRODUCTION[8], EN_PRODUCTION[15], EN_PRODUCTION[0], EN_PRODUCTION[12]]

const corps = () =>
  `<section id="face"><h1>Les bordures de ligue : trois pistes</h1>
  <p class="sous">Les tenues sont celles que les joueurs portent en production, le 17 novembre 2026 — sans leurs noms. Chaque piste est dessinée par-dessus les vrais avatars, sous la vraie feuille.</p>
  ${faceAFace(CHOISIES)}</section>` +
  `<section id="constat"><h2>Aujourd’hui : ce que la production montre</h2>
  <ul><li><b>Quatorze bordures sur dix-neuf ne sont pas serties</b> : c’est l’état qu’on voit le plus, et c’est le moins beau — un coin de métal sur une roue en pointillé, de travers.</li>
  <li><b>Le bandeau est large et chargé</b> (dents, stries, perles) : autour d’un avatar peint, il lui dispute l’œil ; dans une ligne de classement, il fait un halo brouillé.</li>
  <li><b>Le métal vient de la finition</b> : en Holo, Prisme ou Aurore — onze tenues sur dix-neuf —, c’est un arc-en-ciel pastel autour d’une peinture, et la ligue ne se lit plus (un bronze porté en Or est doré).</li></ul>
  ${rangees('aujourdhui', 'finition')}</section>` +
  (['apaise', 'jonc', 'parure'] as Piste[])
    .map(
      p => `<section id="${p}"><h2>${NOMS[p][0]}</h2><p>${PITCH[p]}</p>${rangees(p, 'ligue')}</section>`,
    )
    .join('') +
  `<section id="metal"><h2>Le métal : de la ligue, ou de la finition ?</h2>
  <p>Aujourd’hui, la ligue donne la forme et la finition le métal (la maquette des alliages, le 12 octobre). Les trois pistes sont dessinées au métal de la ligue : le bronze est de bronze, quel que soit le niveau — et la finition garde le cercle du médaillon, sa lumière, son halo. Les deux se comparent ici.</p>
  ${lesDeuxMetaux('apaise')}${lesDeuxMetaux('jonc')}${lesDeuxMetaux('parure')}</section>`

const PITCH: Record<Exclude<Piste, 'aujourdhui'>, string> = {
  apaise:
    'Les six dessins validés le 12 octobre, intacts — le Moletage, le Perlé, les Fleurons, le Givre, la Couronne, le Soleil noir. Deux retouches : un cran à gagner est le même métal, patiné, au lieu d’un pointillé ; et les crans se polissent du bas vers le haut, des deux côtés à la fois. La bordure est toujours entière, toujours symétrique. Le moins de changement : ni nom, ni taille, ni dessin — seul le métal, ici celui de la ligue comme pour les deux autres pistes (la question se pose à part, plus bas).',
  jonc:
    'Un jonc de métal, deux fois plus fin, et douze chatons : chaque victoire y sertit la pierre de la ligue — un rivet, une perle, un rubis, un cristal, un brillant, une étoile d’or. La ligue se lit à la matière du jonc (moleté, perlé, gravé, givré, taillé, émaillé) et à son insigne, en bas. L’avatar reste le sujet ; la bordure est un bijou autour de lui.',
  parure:
    'Un fil de métal, l’insigne de la ligue en bas, et une feuille par victoire : la couronne pousse des deux côtés vers le haut — laurier de bronze, olivier d’argent, feuille d’or et ses rubis, aiguilles de givre, marquises de diamant, flammes du Soleil noir. Un cran à gagner n’est qu’un bourgeon sur le fil. Deux victoires font déjà un début de couronne ; douze la referment.',
}

const page = (theme = '') => {
  IMAGES.clear()
  const c = corps()
  const images = [...IMAGES].map(([svg, cl]) => `.${cl}{background-image:url("${image(svg)}")}`).join('\n')
  return `<!doctype html><html lang="fr"${theme ? ` data-theme="${theme}"` : ''}><meta charset="utf-8"><title>Les bordures de ligue : trois pistes</title><style>${FEUILLE}${STYLE}${images}</style><body>${c}</body></html>`
}

// ── Les photos ────────────────────────────────────────────────────────────

const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const { chromium } = createRequire(path.join(globale, 'planche.js'))('playwright')
const seulement = process.env.SEULEMENT?.split(',')
const navigateur = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'] })
try {
  for (const [nom, theme] of [['planche', ''], ['planche-ivoire', 'ivoire']] as const) {
    if (theme && process.env.SANS_IVOIRE) continue
    const fichier = path.join(ICI, `${nom}.html`)
    writeFileSync(fichier, page(theme))
    const onglet = await navigateur.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: Number(process.env.DENSITE ?? 1.5) })
    const erreurs: string[] = []
    onglet.on('pageerror', (e: Error) => erreurs.push(e.message))
    onglet.on('requestfailed', (r: any) => erreurs.push(r.url().slice(-70)))
    await onglet.goto('file://' + fichier)
    await onglet.waitForLoadState('networkidle')
    await onglet.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await onglet.waitForTimeout(800)
    for (const id of ['face', 'constat', 'apaise', 'jonc', 'parure', 'metal']) {
      if (seulement && !seulement.includes(id)) continue
      if (theme && !['face', 'jonc', 'parure'].includes(id)) continue
      await onglet.locator(`#${id}`).screenshot({ path: path.join(ICI, `${nom}-${id}.jpg`), type: 'jpeg', quality: 84 })
    }
    await onglet.close()
    if (erreurs.length) console.error(`[${nom}]`, erreurs.slice(0, 6))
    console.log(fichier)
  }
} finally {
  await navigateur.close()
}

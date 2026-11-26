// La planche des bordures au choix : la ligue se gagne, le motif se choisit.
// Chaque motif posé sur les vrais avatars de l'application (`Avatar.tsx`,
// `Legendaire.tsx`, `Portrait.tsx`, `Compagnon.tsx`) sous la vraie feuille de
// style — en grand, dans une ligne de classement, à chaque victoire —, en
// Velours et en Ivoire.
//
//   cd server && npx tsx ../retours/2026-11-26/bordures-au-choix/planche.ts
//
// Écrit `planche.html` et `planche-ivoire.html` (que git ignore : les
// peintures s'y lisent dans `client/public`, par un chemin relatif) et leurs
// photos à côté d'elles, section par section. `SEULEMENT=accordee,crans` n'en
// refait que quelques-unes, `SANS_IVOIRE=1` saute le thème clair. Une
// maquette, pas du code livré : rien de `client/` ne bouge.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { NOM_DU_MOTIF, PIERRES_D_AVATAR, svgDuMotif, type CleDeMotif } from './dessins'

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
const { Bordure: BordureDAujourdhui } = await duClient('components/Bordure.tsx')
const { Avatar } = await duClient('components/Avatar.tsx')
const { NOM_DE_LA_BORDURE } = await import(path.join(RACINE, 'shared/duels.ts'))

type Ligue = 'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | 'maitre'
/** Un motif de la maquette, ou `feuilles-<ligue>` : le brin d'une ligue porté dans une autre. */
type Motif = CleDeMotif | `feuilles-${Ligue}`

/** Une tenue : l'avatar, sa finition, sa bordure — sa ligue, ses crans, son motif, ses pierres. */
interface Tenue {
  avatar: string
  legendaire?: string
  finition: string
  ligue: Ligue
  crans: number
  motif: Motif
  pierres?: keyof typeof PIERRES_D_AVATAR
  /** Sans bordure du tout (la pastille « Sans » de la loge). */
  sans?: boolean
}

// ── Les bordures ──────────────────────────────────────────────────────────

const image = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** Chaque dessin une fois dans la page : une classe, son image en fond. */
const IMAGES = new Map<string, string>()
function classeDe(svg: string): string {
  let c = IMAGES.get(svg)
  if (!c) IMAGES.set(svg, (c = `bi-${IMAGES.size}`))
  return c
}

/** La bordure d'un motif, à la place de celle de l'application (`inscrireDessin`) — « Les Feuilles », la sienne. */
function bordureDe(motif: Motif, pierres?: keyof typeof PIERRES_D_AVATAR) {
  if (motif === 'feuilles') return BordureDAujourdhui
  return function Bordure({ ligue, crans }: { ligue: Ligue; crans: number }) {
    const cadre = svgDuMotif(ligue, crans, motif, pierres ? PIERRES_D_AVATAR[pierres][1] : undefined)
    return React.createElement(
      'span',
      { className: `bo bo-${ligue}${crans >= 12 ? ' bo-sertie' : ''}`, 'aria-hidden': 'true' },
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

/** Un avatar rendu sous un motif, à cette taille (1 em). */
function avatar(t: Tenue, classe: string): string {
  inscrireDessin({ Bordure: bordureDe(t.motif, t.pierres) })
  return localiser(
    renderToStaticMarkup(React.createElement(Avatar, { avatar: t.avatar, legendaire: t.legendaire, finition: t.finition, bordure: t.sans ? null : { ligue: t.ligue, crans: t.crans }, className: classe })),
  )
}

/** Un avatar dans une case qui laisse la place à sa bordure, sa légende dessous. */
function case_(t: Tenue, taille: number, classe = 'av-sujet', legende = ''): string {
  return `<figure style="width:${Math.round(Math.max(taille * 2.4, 44))}px"><span class="boite" style="font-size:${taille}px;height:${Math.round(taille * 2.3)}px">${avatar(t, classe)}</span>${legende ? `<figcaption>${legende}</figcaption>` : ''}</figure>`
}

const STYLE = `
  body { margin: 0; padding: 28px 32px 60px; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, sans-serif; min-height: 0; width: 1500px; box-sizing: border-box; }
  section { padding: 8px 0 34px; }
  h1 { font: 600 30px var(--serif, Georgia, serif); margin: 0 0 6px; }
  h2 { font: 600 24px var(--serif, Georgia, serif); margin: 22px 0 4px; color: var(--accent-text); }
  h3 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin: 22px 0 0; color: var(--muted); font-weight: 600; }
  p { margin: 4px 0; max-width: 1040px; }
  p.sous { color: var(--muted); }
  .rang { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px 6px; padding: 14px 0 4px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  figcaption { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.3; }
  .boite { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .boite > .av { line-height: 1; }
  .bi { background: center / 100% 100% no-repeat; }
  .av-bordure.av-or::before { box-shadow: none; }
  table.cat { border-collapse: collapse; margin-top: 10px; }
  table.cat th { font-size: 12px; font-weight: 600; color: var(--accent-text); padding: 6px 6px; text-align: center; }
  table.cat th small { display: block; font-weight: 400; color: var(--muted); }
  table.cat td { padding: 2px 6px; text-align: center; border-top: 1px solid rgba(var(--accent-rgb), 0.16); vertical-align: middle; }
  table.cat td.nom { text-align: left; width: 210px; }
  table.cat td.nom b { font: 600 18px var(--serif, Georgia, serif); display: block; }
  table.cat td.nom span { font-size: 12px; color: var(--muted); }
  table.cat td.nom em { display: inline-block; margin-top: 4px; font-style: normal; font-size: 11px; padding: 1px 7px; border-radius: 99px; border: 1px solid rgba(var(--accent-rgb), .45); color: var(--accent-text); }
  td.ligne { white-space: nowrap; }
  td.ligne .lb { display: flex; align-items: center; gap: 2px; font-size: 13px; padding: 3px 4px; }
  .paires { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px 18px; padding-top: 14px; }
  .paire { display: flex; align-items: center; justify-content: center; gap: 2px; padding: 8px 4px 10px; border-radius: 14px; background: rgba(var(--accent-rgb), .06); }
  .paire .fleche { font-size: 22px; color: var(--muted); }
  .paire-titre { grid-column: 1 / -1; }
  .tels { display: flex; gap: 40px; align-items: flex-start; padding-top: 14px; }
  .tel { width: 360px; box-sizing: border-box; border-radius: 28px; padding: 18px 14px 20px; background: var(--bg); border: 1px solid rgba(var(--accent-rgb), .3); box-shadow: 0 18px 50px rgba(0,0,0,.35); }
  .tel h4 { margin: 0; font: 600 20px var(--serif, Georgia, serif); }
  .tel .mini { font-size: 12px; color: var(--muted); margin: 2px 0 0; }
  .tel .tete { display: flex; align-items: center; gap: 14px; padding: 8px 4px 10px; border-bottom: 1px solid rgba(var(--accent-rgb), .18); }
  .tel .rangee-titre { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 14px 2px 4px; font-weight: 600; }
  .pastilles { display: flex; flex-wrap: wrap; gap: 6px 2px; }
  .pastille { position: relative; display: flex; flex-direction: column; align-items: center; width: 64px; padding: 4px 0 5px; border-radius: 12px; font-size: 11px; line-height: 1.2; text-align: center; color: var(--ink); }
  .pastille .boite { height: 46px; }
  .pastille.portee { background: rgba(var(--accent-rgb), .14); outline: 1.5px solid rgba(var(--accent-rgb), .7); }
  .pastille.verrou { opacity: .5; }
  .pastille small { color: var(--muted); font-size: 10px; }
  .pastille .coche { position: absolute; top: 2px; right: 4px; font-size: 11px; color: var(--accent-text); }
  .rayon { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tuile { border-radius: 14px; padding: 8px 6px 10px; background: rgba(var(--accent-rgb), .07); border: 1px solid rgba(var(--accent-rgb), .18); display: flex; flex-direction: column; align-items: center; font-size: 12px; text-align: center; }
  .tuile .boite { height: 80px; }
  .tuile b { font-weight: 600; }
  .tuile .prix { color: var(--accent-text); font-weight: 600; margin-top: 2px; }
  .tuile .prix.gris { color: var(--muted); font-weight: 400; }
  .tel .lien { font-size: 12px; color: var(--accent-text); margin: 12px 2px 0; }
  .tel .maquette-note { margin: 10px 0 4px; padding: 8px 10px; border-radius: 12px; font-size: 12px; background: rgba(var(--accent-rgb), .1); }
`

const PHENIX = (motif: Motif, ligue: Ligue = 'or', crans = 12): Tenue => ({ avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', ligue, crans, motif })

/** Les colonnes du catalogue : chaque motif sur un emoji, sur des légendaires, dans six ligues, et dans une ligne. */
const COLONNES: [string, string, (m: Motif) => Tenue][] = [
  ['Un emoji', 'ligue d’or, sertie', m => ({ avatar: '🦊', finition: 'or', ligue: 'or', crans: 12, motif: m })],
  ['Le Phénix', 'ligue d’or, sertie', m => PHENIX(m)],
  ['Un emoji', 'bronze, 5 sur 12', m => ({ avatar: '🐨', finition: 'argent', ligue: 'bronze', crans: 5, motif: m })],
  ['La Chouette', 'argent, sertie', m => ({ avatar: '🦊', legendaire: 'lg:chouette', finition: 'aurore', ligue: 'argent', crans: 12, motif: m })],
  ['Le Dragon', 'diamant, 8 sur 12', m => ({ avatar: '🦊', legendaire: 'lg:dragon', finition: 'prisme', ligue: 'diamant', crans: 8, motif: m })],
  ['La Chimère', 'maîtres, sertie', m => ({ avatar: '🦊', legendaire: 'lg:chimere', finition: 'or', ligue: 'maitre', crans: 12, motif: m })],
]

interface Ligne {
  motif: Motif
  dit: string
  obtenu: string
}

function catalogue(lignes: Ligne[]): string {
  return (
    `<table class="cat"><tr><th></th>${COLONNES.map(([a, b]) => `<th>${a}<small>${b}</small></th>`).join('')}<th>Dans un classement<small>à sa taille (1,2 rem)</small></th></tr>` +
    lignes
      .map(
        l =>
          `<tr><td class="nom"><b>${l.motif.startsWith('feuilles-') ? 'Les Feuilles' : NOM_DU_MOTIF[l.motif as CleDeMotif]}</b><span>${l.dit}</span><br><em>${l.obtenu}</em></td>` +
          COLONNES.map(([, , t]) => `<td>${case_(t(l.motif), 62)}</td>`).join('') +
          `<td class="ligne">${(['bronze', 'or', 'maitre'] as Ligue[])
            .map(
              (lg, i) =>
                `<div class="lb">${i + 1}.${case_({ avatar: ['🐨', '🦊', '🦁'][i], legendaire: i === 1 ? 'lg:phenix' : undefined, finition: 'or', ligue: lg, crans: [5, 12, 9][i], motif: l.motif }, 19, 'lb-avatar')}</div>`,
            )
            .join('')}</td></tr>`,
      )
      .join('') +
    `</table>`
  )
}

const OFFERTS: Ligne[] = [
  { motif: 'feuilles', dit: 'la parure d’aujourd’hui : le brin de sa ligue', obtenu: 'offerte · d’office' },
  { motif: 'jonc', dit: 'un anneau large, une pierre sertie par victoire — le plus sobre', obtenu: 'offert' },
  { motif: 'nu', dit: 'la ligue seule, son insigne ; les crans se lisent dans « Ma collection »', obtenu: 'offert' },
]
const DES_DUELS: Ligne[] = [
  { motif: 'perles', dit: 'un trio de perles par victoire, à la pierre de la ligue', obtenu: 'sertir la bordure d’argent' },
  { motif: 'rouages', dit: 'l’atelier d’Automate : un engrenage et son pignon', obtenu: 'battre Automate 50 fois' },
  { motif: 'flammes', dit: 'les flammes du Soleil noir, à toutes les ligues', obtenu: 'atteindre la ligue des maîtres' },
]
const EN_BOUTIQUE: Ligne[] = [
  { motif: 'etoiles', dit: 'une étoile par victoire, reliées en constellation', obtenu: 'boutique · 🎊 400' },
  { motif: 'ecailles', dit: 'deux écailles par victoire : une armure de dragon', obtenu: 'boutique · 🎊 400' },
  { motif: 'vagues', dit: 'une vague qui s’enroule vers le haut, son écume', obtenu: 'boutique · 🎊 400' },
  { motif: 'rayons', dit: 'un soleil art déco, trois rais par victoire', obtenu: 'boutique · 🎊 400' },
  { motif: 'fleurs', dit: 'une fleur de bijou et son bouton, le cœur à la pierre', obtenu: 'boutique · 🎊 400' },
  { motif: 'plumes', dit: 'une rémige par victoire : deux ailes qui se referment', obtenu: 'boutique · 🎊 400' },
]
const DE_SAISON: Ligne[] = [
  { motif: 'coeurs', dit: 'émail rose ourlé du métal de la ligue', obtenu: 'Saint-Valentin · 🎊 250' },
  { motif: 'houx', dit: 'émail vert et ses baies, ourlé du métal de la ligue', obtenu: 'Noël · 🎊 250' },
]

/** Un avatar avant et après, chacun sa légende. */
const paire = (avant: Tenue, ditAvant: string, apres: Tenue, ditApres: string) =>
  `<div class="paire">${case_(avant, 64, 'av-sujet', ditAvant)}<span class="fleche">→</span>${case_(apres, 64, 'av-sujet', ditApres)}</div>`

const ACCORDES: [Tenue, Motif, string][] = [
  [{ avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', ligue: 'or', crans: 12, motif: 'feuilles' }, 'flammes', 'Phénix'],
  [{ avatar: '🦊', legendaire: 'lg:chouette', finition: 'aurore', ligue: 'argent', crans: 10, motif: 'feuilles' }, 'plumes', 'Chouette'],
  [{ avatar: '🦊', legendaire: 'lg:dragon', finition: 'aurore', ligue: 'diamant', crans: 12, motif: 'feuilles' }, 'ecailles', 'Dragon'],
  [{ avatar: '🦊', legendaire: 'lg:kraken', finition: 'or', ligue: 'maitre', crans: 12, motif: 'feuilles' }, 'vagues', 'Kraken'],
  [{ avatar: '🦊', legendaire: 'lg:comete', finition: 'or', ligue: 'platine', crans: 12, motif: 'feuilles' }, 'etoiles', 'Comète'],
  [{ avatar: '🦊', legendaire: 'lg:lion', finition: 'or', ligue: 'or', crans: 8, motif: 'feuilles' }, 'rayons', 'Lion'],
  [{ avatar: '🦊', legendaire: 'cp:panda-sakura', finition: 'prisme', ligue: 'bronze', crans: 12, motif: 'feuilles' }, 'fleurs', 'Panda des cerisiers'],
  [{ avatar: '🦊', legendaire: 'br:poseidon', finition: 'argent', ligue: 'argent', crans: 6, motif: 'feuilles' }, 'vagues', 'Poséidon'],
  [{ avatar: '🦊', legendaire: 'br:robot', finition: 'or', ligue: 'bronze', crans: 5, motif: 'feuilles' }, 'rouages', 'Robot'],
  [{ avatar: '🦊', legendaire: 'lg:serpent', finition: 'holo', ligue: 'or', crans: 9, motif: 'feuilles' }, 'ecailles', 'Serpent'],
  [{ avatar: '🦊', legendaire: 'lg:sapin', finition: 'or', ligue: 'platine', crans: 12, motif: 'feuilles' }, 'houx', 'Sapin'],
  [{ avatar: '🦊', legendaire: 'lg:trou-noir', finition: 'or', ligue: 'maitre', crans: 9, motif: 'feuilles' }, 'etoiles', 'Trou noir'],
]

const accordee = () =>
  `<section id="accordee"><h1>Les bordures au choix</h1>
  <p class="sous">La ligue se gagne, le motif se choisit. Le métal, l’insigne du bas et le nombre de crans restent ceux de la ligue — un bronze reste de bronze, douze victoires restent douze victoires — ; seul ce qui pousse à chaque victoire change. Dessiné sur les vrais avatars, sous la vraie feuille.</p>
  <h2>1 · « Accordée » : le motif suit l’avatar qu’on porte</h2>
  <p>À gauche, la parure d’aujourd’hui ; à droite, le motif qui va à l’avatar. Un nouveau réglage d’office, à la place de « Les Feuilles » : chaque légendaire, portrait ou compagnon dit son motif (ses flammes au Phénix, ses écailles au Dragon, ses vagues au Kraken) ; un emoji garde les feuilles de sa ligue.</p>
  <div class="paires">${ACCORDES.map(([t, m, n]) => paire(t, 'aujourd’hui', { ...t, motif: m }, `${n} · ${NOM_DU_MOTIF[m as CleDeMotif]}`)).join('')}</div></section>`

const catalogues = () =>
  `<section id="catalogue-1"><h2>2 · Les motifs : offerts, puis gagnés aux duels</h2>
  <p>Chacun dans six ligues, à son métal, sur un emoji et sur des légendaires, puis dans une ligne de classement. Un cran à gagner reste un bourgeon sur le fil (ou un chaton vide, une perle en attente).</p>
  <h3>Offerts à tous</h3>${catalogue(OFFERTS)}
  <h3>Gagnés aux duels — ils restent des trophées</h3>${catalogue(DES_DUELS)}</section>` +
  `<section id="catalogue-2"><h2>3 · Les motifs de la boutique, et ceux de saison</h2>
  <p>Acheter un motif n’achète ni la ligue, ni un cran : il se dessine au métal de la ligue où l’on est, et ne pousse qu’à chaque victoire. Les prix sont à titre d’exemple.</p>
  <h3>En boutique</h3>${catalogue(EN_BOUTIQUE)}
  <h3>De saison — en boutique pendant leur fête, ou gagnés avec son légendaire</h3>${catalogue(DE_SAISON)}</section>`

const LIGUES_DES_FEUILLES: Ligue[] = ['bronze', 'argent', 'or', 'platine', 'diamant', 'maitre']
const feuilles = () =>
  `<section id="feuilles"><h2>4 · Chaque bordure sertie prête sa feuille</h2>
  <p>Rien à dessiner : les six brins existent. Sertir une bordure (douze victoires) ouvre son brin à toutes les autres — l’olivier d’argent en ligue d’or, les marquises du diamant en bronze. Au métal de la ligue où l’on est, avec ses pierres.</p>
  <h3>En ligue d’or, sur un emoji puis sur le Phénix</h3>
  <div class="rang">${LIGUES_DES_FEUILLES.map(l => case_({ avatar: '🦊', finition: 'or', ligue: 'or', crans: 12, motif: `feuilles-${l}` }, 66, 'av-sujet', `${NOM_DE_LA_BORDURE[l]}${l === 'or' ? ' (la sienne)' : ''}`)).join('')}</div>
  <div class="rang">${LIGUES_DES_FEUILLES.map(l => case_({ ...PHENIX(`feuilles-${l}`) }, 66, 'av-sujet', NOM_DE_LA_BORDURE[l])).join('')}</div>
  <h3>En ligue de bronze, 7 victoires sur 12</h3>
  <div class="rang">${LIGUES_DES_FEUILLES.map(l => case_({ avatar: '🐨', finition: 'argent', ligue: 'bronze', crans: 7, motif: `feuilles-${l}` }, 66, 'av-sujet', `${NOM_DE_LA_BORDURE[l]}${l === 'bronze' ? ' (la sienne)' : ''}`)).join('')}</div></section>`

const PALIERS = [0, 1, 2, 4, 6, 9, 12]
const crans = () =>
  `<section id="crans"><h2>5 · Chaque victoire, quel que soit le motif</h2>
  <p>La règle des crans ne bouge pas : douze, du bas vers le haut, à droite puis à gauche — symétrique à chaque victoire, le haut (que couvre ce qui sort d’un médaillon) se referme en dernier.</p>
  ${(
    [
      ['etoiles', { avatar: '🦊', legendaire: 'lg:comete', finition: 'or', ligue: 'platine' }],
      ['ecailles', { avatar: '🦊', legendaire: 'lg:dragon', finition: 'or', ligue: 'or' }],
      ['vagues', { avatar: '🐙', finition: 'argent', ligue: 'argent' }],
      ['jonc', { avatar: '🦊', legendaire: 'lg:renard', finition: 'or', ligue: 'bronze' }],
    ] as [Motif, Omit<Tenue, 'crans' | 'motif'>][]
  )
    .map(([m, t]) => `<h3>${NOM_DU_MOTIF[m as CleDeMotif]}</h3><div class="rang">${PALIERS.map(n => case_({ ...t, crans: n, motif: m }, 58, 'av-sujet', `${n} sur 12`)).join('')}</div>`)
    .join('')}</section>`

const PIERRE_DE_LA_LIGUE: Record<Ligue, string> = { bronze: 'Cuivre', argent: 'Perle', or: 'Rubis', platine: 'Glace', diamant: 'Brillant', maitre: 'Onyx' }
const pierres = () =>
  `<section id="pierres"><h2>6 · Les pierres de l’avatar</h2>
  <p>Une seconde touche, plus discrète : les pierres serties prennent la couleur de l’avatar au lieu de celle de la ligue — le rubis de l’or devient une aigue-marine sous le Kraken. Le métal et l’insigne disent toujours la ligue. D’office avec « Accordée », ou au choix.</p>
  <div class="paires">${(
    [
      [{ avatar: '🦊', legendaire: 'lg:kraken', finition: 'or', ligue: 'or', crans: 12, motif: 'jonc' }, 'mer'],
      [{ avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', ligue: 'or', crans: 12, motif: 'jonc' }, 'feu'],
      [{ avatar: '🦊', legendaire: 'lg:dragon', finition: 'or', ligue: 'or', crans: 12, motif: 'perles' }, 'jade'],
      [{ avatar: '🦊', legendaire: 'lg:licorne', finition: 'or', ligue: 'or', crans: 12, motif: 'perles' }, 'nuit'],
      [{ avatar: '🦊', legendaire: 'lg:comete', finition: 'or', ligue: 'argent', crans: 12, motif: 'fleurs' }, 'ciel'],
      [{ avatar: '🦊', legendaire: 'lg:rose', finition: 'or', ligue: 'argent', crans: 12, motif: 'fleurs' }, 'rose'],
      [{ avatar: '🦊', legendaire: 'lg:pegase', finition: 'or', ligue: 'bronze', crans: 12, motif: 'rayons' }, 'ciel'],
      [{ avatar: '🦊', legendaire: 'lg:salamandre', finition: 'or', ligue: 'diamant', crans: 12, motif: 'etoiles' }, 'feu'],
    ] as [Tenue, keyof typeof PIERRES_D_AVATAR][]
  )
    .map(([t, p]) => paire(t, `${PIERRE_DE_LA_LIGUE[t.ligue]}, celle de la ligue`, { ...t, pierres: p }, PIERRES_D_AVATAR[p][0]))
    .join('')}</div></section>`

/** Une pastille de la loge : l'avatar porté sous un motif, son nom, et ce qu'il faut pour l'avoir. */
const pastille = (t: Tenue, nom: string, etat: 'portee' | 'a-lui' | 'verrou', dessous = '') =>
  `<div class="pastille${etat === 'portee' ? ' portee' : etat === 'verrou' ? ' verrou' : ''}">${etat === 'portee' ? '<span class="coche">✓</span>' : ''}<span class="boite" style="font-size:20px">${avatar(t, '')}</span>${nom}${dessous ? `<small>${dessous}</small>` : ''}</div>`

const loge = () => {
  const moi = (m: Motif, ligue: Ligue = 'or', crans = 7): Tenue => ({ avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', ligue, crans, motif: m })
  return `<section id="loge"><h2>7 · Dans la loge, et à la boutique</h2>
  <p>La pièce « Avatar » de la loge garde sa rangée « Bordure » (la ligue) et en gagne une, « Motif » : un toucher essaie sur la carte, « Porter » enregistre, comme le reste. La boutique ouvre un rayon « Bordures », où chaque motif se montre autour de ton avatar, à ta ligue et à tes crans.</p>
  <div class="tels">
  <div class="tel"><h4>M’habiller · Avatar</h4><p class="mini">La salle voit</p>
    <div class="tete"><span class="boite" style="font-size:44px;height:104px;width:104px">${avatar(moi('flammes'), 'av-sujet')}</span><div><b>Ligue d’or · 7 sur 12</b><p class="mini">Accordée au Phénix : ses flammes.<br>Encore 5 victoires pour la sertir.</p></div></div>
    <div class="rangee-titre">Bordure</div>
    <div class="pastilles">${pastille(moi('flammes'), 'Auto', 'portee', 'la plus haute')}${pastille({ ...moi('nu'), sans: true }, 'Sans', 'a-lui')}${pastille(moi('flammes', 'bronze', 12), 'Bronze', 'a-lui', 'sertie')}${pastille(moi('flammes', 'argent', 12), 'Argent', 'a-lui', 'sertie')}${pastille(moi('flammes', 'or', 7), 'Or', 'a-lui', '7/12')}</div>
    <div class="rangee-titre">Motif</div>
    <div class="pastilles">${pastille(moi('flammes'), 'Accordée', 'portee', 'à l’avatar')}${pastille(moi('feuilles'), 'Feuilles', 'a-lui')}${pastille(moi('jonc'), 'Jonc', 'a-lui')}${pastille(moi('nu'), 'Fil nu', 'a-lui')}${pastille(moi('perles'), 'Perles', 'a-lui')}${pastille(moi('feuilles-argent'), 'Olivier', 'a-lui', 'de l’argent')}${pastille(moi('etoiles'), 'Étoiles', 'a-lui')}${pastille(moi('rouages'), 'Rouages', 'verrou', '31/50 Automate')}${pastille(moi('flammes'), 'Flammes', 'verrou', 'ligue des maîtres')}</div>
    <p class="lien">5 motifs à la boutique · 2 à gagner aux duels →</p>
  </div>
  <div class="tel"><h4>Boutique · Bordures</h4><p class="mini">400 chacune · la ligue reste à gagner</p>
    <div class="maquette-note">Un motif se dessine au métal de ta ligue, et ne pousse qu’à chaque victoire.</div>
    <div class="rayon">${(
      [
        ['ecailles', 'Écailles', '🎊 400'],
        ['vagues', 'Vagues', '🎊 400'],
        ['rayons', 'Rayons', '🎊 400'],
        ['fleurs', 'Fleurs', '🎊 400'],
        ['plumes', 'Plumes', '🎊 400'],
        ['etoiles', 'Étoiles', '✓ à toi'],
        ['houx', 'Houx', '🎊 250 · Noël'],
        ['coeurs', 'Cœurs', 'en février'],
      ] as [Motif, string, string][]
    )
      .map(([m, n, p]) => `<div class="tuile"><span class="boite" style="font-size:34px">${avatar(moi(m), 'av-sujet')}</span><b>${n}</b><span class="prix${p.startsWith('en ') ? ' gris' : ''}">${p}</span></div>`)
      .join('')}</div>
  </div>
  </div></section>`
}

const page = (theme = '') => {
  IMAGES.clear()
  const c = accordee() + catalogues() + feuilles() + crans() + pierres() + loge()
  const images = [...IMAGES].map(([svg, cl]) => `.${cl}{background-image:url("${image(svg)}")}`).join('\n')
  return `<!doctype html><html lang="fr"${theme ? ` data-theme="${theme}"` : ''}><meta charset="utf-8"><title>Les bordures au choix</title><style>${FEUILLE}${STYLE}${images}</style><body>${c}</body></html>`
}

// ── Les photos ────────────────────────────────────────────────────────────

const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const { chromium } = createRequire(path.join(globale, 'planche.js'))('playwright')
const seulement = process.env.SEULEMENT?.split(',')
const SECTIONS = ['accordee', 'catalogue-1', 'catalogue-2', 'feuilles', 'crans', 'pierres', 'loge']
const EN_IVOIRE = ['accordee', 'catalogue-2', 'loge']
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
    for (const id of SECTIONS) {
      if (seulement && !seulement.includes(id)) continue
      if (theme && !EN_IVOIRE.includes(id)) continue
      await onglet.locator(`#${id}`).screenshot({ path: path.join(ICI, `${nom}-${id}.jpg`), type: 'jpeg', quality: 84 })
    }
    await onglet.close()
    if (erreurs.length) console.error(`[${nom}]`, erreurs.slice(0, 6))
    console.log(fichier)
  }
} finally {
  await navigateur.close()
}

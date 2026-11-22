// Maquette : un Divin sous une bordure de ligue, sous la lumière d'une finition
// (le 22 novembre 2026, `README.md`). `Avatar.tsx` refusait alors l'une et
// l'autre sous un Divin : la maquette recompose son JSX à la main, avec les
// vrais composants (`Divin`, `Bordure`, `Lumiere`) et la vraie feuille de
// style, plus quelques règles à elle (préfixe `mq-`), qui disaient ce que la
// mise en œuvre aurait à écrire.
//
// Elle ne se rejoue telle quelle qu'au commit d'avant la mise en œuvre
// (`8cac370`) : depuis, la feuille de l'application habille elle-même un
// Divin bordé, et ses règles s'ajouteraient à celles de la maquette. La
// planche d'aujourd'hui : `server/scripts/planche-bordures.ts`.
//
//   cd server && npx tsx ../retours/2026-11-22/divins-habilles/planche.ts <dossier de sortie>
//   (`SEULEMENT=5` pour une planche, `DENSITE=2` pour la photo qu'on montre)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEPOT = fileURLToPath(new URL('../../../', import.meta.url))
const duDepot = createRequire(DEPOT + 'client/src/components/maquette.js')
const React = duDepot('react')
Object.assign(globalThis, { React })
const { renderToStaticMarkup } = duDepot('react-dom/server')

const { LIGUES, NOM_DE_LA_BORDURE } = await import(DEPOT + 'shared/duels.ts')
const { NOM_FINITION } = await import(DEPOT + 'shared/profil.ts')
const { DIVINS } = await import(DEPOT + 'shared/divins.ts')
const duClient = (fichier: string) => import(DEPOT + 'client/src/' + fichier)
await duClient('components/Legendaire.tsx')
const { Divin } = await duClient('components/Divin.tsx')
const { Lumiere } = await duClient('components/Lumiere.tsx')
const { Bordure } = await duClient('components/Bordure.tsx')
const { Avatar } = await duClient('components/Avatar.tsx')

const sortie = path.resolve(process.argv[2] ?? 'maquette')
mkdirSync(sortie, { recursive: true })

const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'x.js'))('playwright')

const PUBLIC = 'file://' + DEPOT + 'client/public/'
const localiser = (html: string) =>
  html.replaceAll('/medaillons/', `${PUBLIC}medaillons/`).replaceAll('/portraits/', `${PUBLIC}portraits/`).replaceAll("url('/fonts/", `url('${PUBLIC}fonts/`)
const FEUILLE = localiser(readFileSync(DEPOT + 'client/src/styles.css', 'utf8'))

const h = React.createElement

interface Tenue {
  ligue?: string
  crans?: number
  lumiere?: string
  metal?: 'argent' | 'or' | 'holo'
  /** Ses propres rayons et ses étincelles : gardés, ou laissés à la lumière de la finition. */
  rayons?: boolean
  classe?: string
  grand?: boolean
  /** Ce que `Lumiere` retire autour d'un médaillon (`medaillon`) : essayé des deux façons. */
  commeUnMedaillon?: boolean
  /** Un fil un peu plus large que celui d'un médaillon (2,13 em pour 1,9). */
  large?: boolean
  /** Ses rayons passent derrière la bordure et en sortent, entre les feuilles : une gloire. */
  gloire?: boolean
  /** Le bijou grandit dans son fil (1 = comme un médaillon) : il passe franchement par-dessus. */
  deborde?: number
  /** Un métal ne trace pas de cercle : il teinte ses rayons, sa lueur. */
  teinte?: 'argent' | 'or' | 'holo'
}

/** Sa lumière (`--dv-rvb`), lue dans ce que `Divin` rend : `THEMES` n'est pas exporté. */
const lumiereDe = (cle: string) => /--dv-rvb:([^;"]+)/.exec(renderToStaticMarkup(h(Divin, { cle })))?.[1].trim() ?? '255, 230, 170'

/** Un Divin habillé : le JSX d'`Avatar`, moins ses deux refus. */
function divinHabille(cle: string, t: Tenue = {}) {
  const classes = ['av', 'av-divin', t.classe ?? 'av-sujet']
  if (t.metal) classes.push(`av-${t.metal}`)
  if (t.lumiere) classes.push('av-lumiere')
  if (t.ligue) classes.push('av-bordure', 'mq-bordee')
  if (t.rayons === false) classes.push('mq-sans-rayons')
  if (t.large) classes.push('mq-large')
  if (t.gloire) classes.push('mq-en-gloire')
  if (t.deborde) classes.push('mq-deborde')
  if (t.teinte) classes.push(`mq-teinte-${t.teinte}`)
  const dedans = [
    t.gloire ? h('span', { key: 'g', className: 'mq-gloire', style: { '--dv-rvb': lumiereDe(cle) } }, h('i', { className: 'mq-g1' }), h('i', { className: 'mq-g2' })) : null,
    t.ligue ? h(Bordure, { key: 'b', ligue: t.ligue, crans: t.crans ?? 12 }) : null,
    h('span', { key: 'e', className: 'av-emoji' }, h(Divin, { cle, grand: t.grand })),
  ]
  return h(
    'span',
    { className: classes.join(' '), style: t.deborde ? { '--mq-deborde': t.deborde } : undefined },
    t.lumiere ? h(Lumiere, { finition: t.lumiere, medaillon: t.commeUnMedaillon ?? true, bordure: !!t.ligue }, dedans) : dedans,
  )
}

const figure = (dedans: string, taille: number, legende: string, large = 2.3) =>
  `<figure style="width:${Math.max(taille * large, 70)}px"><span class="boite" style="font-size:${taille}px;height:${taille * large}px">${localiser(dedans)}</span>${
    legende ? `<figcaption>${legende}</figcaption>` : ''
  }</figure>`

const mq = (cle: string, t: Tenue, taille: number, legende = '', large?: number) => figure(renderToStaticMarkup(divinHabille(cle, t)), taille, legende, large)
/** Tel qu'aujourd'hui : le vrai `Avatar`, qui refuse tout sous un Divin. */
const vrai = (props: Record<string, unknown>, taille: number, legende = '', large?: number) =>
  figure(renderToStaticMarkup(h(Avatar, { avatar: '🦊', className: 'av-sujet', ...props })), taille, legende, large)

const nom = (cle: string) => DIVINS.find((d: { key: string }) => d.key === cle)?.nom ?? cle

const STYLE = `
  body { margin: 0; padding: 28px 32px 36px; background: var(--bg); color: var(--ink); font: 15px system-ui, sans-serif; min-height: 0; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 30px 0 2px; color: var(--accent-text); }
  p.sous { margin: 0 0 6px; color: var(--muted); max-width: 980px; line-height: 1.45; }
  .ligne { display: flex; align-items: flex-start; gap: 10px; padding: 14px 0 10px; border-top: 1px solid rgba(var(--accent-rgb), 0.2); margin-top: 10px; }
  .nom { width: 168px; flex: none; font-weight: 600; padding-top: 18px; }
  .nom small { display: block; font-weight: 400; color: var(--muted); margin-top: 3px; line-height: 1.35; }
  .cases { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: flex-start; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  figcaption { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.3; }
  .boite { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .boite > .av { line-height: 1; font-size: inherit; }
  /* La liste : une vraie ligne de classement, pour juger à sa taille. */
  .mq-liste { width: 340px; margin-top: 0; }
  .colonnes { display: flex; gap: 34px; flex-wrap: wrap; }
  .colonnes h3 { font-size: 13px; font-weight: 600; margin: 0 0 6px; color: var(--muted); }

  /* ── Ce que la maquette ajoute à la feuille ── */
  /* La bordure autour d'un Divin : son bijou fait 1,12 em, comme un médaillon. */
  .mq-bordee .bo { --d: 1.9em; }
  .carte-avatar.mq-bordee .bo { --d: 2.47em; }
  .mq-large .bo { --d: 2.13em; }
  .carte-avatar.mq-large .bo { --d: 2.77em; }
  /* Ses rayons et ses étincelles laissent la place : la lueur et l'éclat sur l'or restent. */
  .mq-sans-rayons .dv-rayons, .mq-sans-rayons .dv-etincelles { display: none; }

  /* La gloire : ses rayons derrière la bordure, qui en sortent entre les feuilles. Ceux du bijou s'effacent. */
  .mq-en-gloire .dv-rayons { display: none; }
  .mq-gloire { position: absolute; top: 50%; left: 50%; width: 0; height: 0; z-index: 0; pointer-events: none; }
  .carte-avatar .mq-gloire { --mq-k: 1.3; }
  .mq-gloire > i { --g: calc(var(--mq-g, 2.8em) * var(--mq-k, 1)); position: absolute; top: 0; left: 0; width: var(--g); height: var(--g); margin: calc(var(--g) / -2) 0 0 calc(var(--g) / -2); border-radius: 50%; animation: dv-tourne 48s linear infinite;
    -webkit-mask: radial-gradient(circle closest-side, #000 0 42%, rgba(0,0,0,.7) 60%, transparent 100%); mask: radial-gradient(circle closest-side, #000 0 42%, rgba(0,0,0,.7) 60%, transparent 100%); }
  .mq-g1 { background: repeating-conic-gradient(from 0deg, rgba(var(--dv-rvb), 0) 0deg 9deg, rgba(var(--dv-rvb), 0.62) 11deg, rgba(var(--dv-rvb), 0) 13deg 18deg); }
  .mq-gloire > .mq-g2 { --mq-g: 2.35em; background: repeating-conic-gradient(from 5deg, rgba(255, 245, 210, 0) 0deg 14deg, rgba(255, 245, 210, 0.55) 15.5deg, rgba(255, 245, 210, 0) 17deg 24deg); animation-duration: 34s; animation-direction: reverse; }

  /* Le bijou déborde : il grandit sur place, la mise en page ne bouge pas. */
  .mq-deborde .av-emoji > .dv { scale: var(--mq-deborde, 1); }

  /* Un métal teinte sa lumière — ses rayons, sa lueur, sa gloire —, sans tracer de cercle. */
  .mq-teinte-argent .dv-peint, .mq-teinte-argent .mq-gloire { --dv-rvb: 206, 224, 255 !important; }
  .mq-teinte-or .dv-peint, .mq-teinte-or .mq-gloire { --dv-rvb: 255, 198, 84 !important; }
  .mq-teinte-holo .dv-rayons:not(.dv-rayons-2), .mq-teinte-holo .mq-g1 {
    background: conic-gradient(from 0deg, #ff8fb4, #ffd27a, #b4ff9c, #7fe6ff, #b9a2ff, #ff8fb4);
    -webkit-mask-image: repeating-conic-gradient(from 0deg, transparent 0deg 9deg, #000 11deg, transparent 13deg 18deg), radial-gradient(circle, #000 30%, transparent 68%);
    mask-image: repeating-conic-gradient(from 0deg, transparent 0deg 9deg, #000 11deg, transparent 13deg 18deg), radial-gradient(circle, #000 30%, transparent 68%);
    -webkit-mask-composite: source-in; mask-composite: intersect; }
  .mq-teinte-holo .mq-g1 {
    -webkit-mask-image: repeating-conic-gradient(from 0deg, transparent 0deg 9deg, #000 11deg, transparent 13deg 18deg), radial-gradient(circle closest-side, #000 0 42%, rgba(0,0,0,.7) 60%, transparent 100%);
    mask-image: repeating-conic-gradient(from 0deg, transparent 0deg 9deg, #000 11deg, transparent 13deg 18deg), radial-gradient(circle closest-side, #000 0 42%, rgba(0,0,0,.7) 60%, transparent 100%); }
  .mq-teinte-holo .dv-lueur { background: conic-gradient(from 40deg, rgba(255,143,180,.5), rgba(255,210,122,.5), rgba(180,255,156,.5), rgba(127,230,255,.5), rgba(185,162,255,.5), rgba(255,143,180,.5)); -webkit-mask: radial-gradient(circle, #000 10%, transparent 68%); mask: radial-gradient(circle, #000 10%, transparent 68%); }
`

const page = (titre: string, sous: string, corps: string, theme = '') =>
  `<!doctype html><html${theme ? ` data-theme="${theme}"` : ''}><meta charset="utf-8"><style>${FEUILLE}${STYLE}</style>
  <body><h1>${titre}</h1><p class="sous">${sous}</p>${corps}</body></html>`

const ligne = (titre: string, sous: string, cases: string) => `<div class="ligne"><div class="nom">${titre}<small>${sous}</small></div><div class="cases">${cases}</div></div>`

const TOUS: string[] = DIVINS.map((d: { key: string }) => d.key)
const LUMIERES = ['prisme', 'aurore', 'constellation', 'abysses', 'orage', 'envol', 'disco', 'singularite']
const lig = (i: number) => LIGUES[i % LIGUES.length].cle

// ── 1. Les bordures ─────────────────────────────────────────────────────────
const T = 62
const bordures =
  ligne('Aujourd’hui', 'le vrai composant : ni bordure, ni finition', ['dv:seraphin', 'dv:helios', 'dv:athena', 'dv:pantheon', 'dv:dechu', 'dv:hecate'].map(c => vrai({ legendaire: c, finition: 'constellation', bordure: { ligue: 'or', crans: 12 } }, T, nom(c))).join('')) +
  ligne('Les six ligues', 'Le Séraphin, douze crans', LIGUES.map((l: any) => mq('dv:seraphin', { ligue: l.cle }, T, `${NOM_DE_LA_BORDURE[l.cle]}<br>${l.nom}`)).join('')) +
  ligne('Les six ligues', 'Athéna, sept crans', LIGUES.map((l: any) => mq('dv:athena', { ligue: l.cle, crans: 7 }, T, NOM_DE_LA_BORDURE[l.cle])).join('')) +
  ligne('Les dix-huit', 'chacun sa silhouette dans le fil', TOUS.map((c, i) => mq(c, { ligue: lig(i + 2), crans: [12, 9, 5, 12, 3, 8][i % 6] }, T, nom(c))).join('')) +
  ligne('La taille du fil', 'celle d’un médaillon (à gauche), ou un peu plus large (à droite)', ['dv:seraphin', 'dv:helios', 'dv:pantheon', 'dv:thot'].map(c => mq(c, { ligue: 'or' }, T, `${nom(c)}<br>comme un médaillon`) + mq(c, { ligue: 'or', large: true }, T, 'plus large')).join('')) +
  ligne('Ses rayons', 'gardés (à gauche) ou éteints sous la bordure (à droite)', ['dv:helios', 'dv:arbre', 'dv:nike'].map(c => mq(c, { ligue: 'diamant' }, T, `${nom(c)}<br>rayons gardés`) + mq(c, { ligue: 'diamant', rayons: false }, T, 'rayons éteints')).join(''))

// ── 2. Les lumières ─────────────────────────────────────────────────────────
const L = 58
const lumieres =
  ligne('Elle remplace', 'la lumière de la finition à la place de ses rayons', LUMIERES.map(f => mq('dv:athena', { lumiere: f, rayons: false, classe: 'av-sujet carte-avatar' }, L, NOM_FINITION[f], 3)).join('')) +
  ligne('Elle s’ajoute', 'ses rayons et la lumière de la finition', LUMIERES.map(f => mq('dv:athena', { lumiere: f, classe: 'av-sujet carte-avatar' }, L, NOM_FINITION[f], 3)).join('')) +
  ligne('En grand', 'à gauche elle remplace ses rayons, à droite elle s’y ajoute', [['dv:athena', 'constellation'], ['dv:seraphin', 'aurore'], ['dv:hecate', 'singularite']].map(([c, f]) => mq(c, { lumiere: f, rayons: false, grand: true, classe: 'av-sujet carte-avatar' }, 86, `${nom(c)} · ${NOM_FINITION[f as keyof typeof NOM_FINITION]}<br>remplace`, 2.8) + mq(c, { lumiere: f, grand: true, classe: 'av-sujet carte-avatar' }, 86, 's’ajoute', 2.8)).join('')) +
  ligne('D’autres bijoux', 'elle remplace', [['dv:seraphin', 'envol'], ['dv:helios', 'singularite'], ['dv:dechu', 'orage'], ['dv:lotus', 'aurore'], ['dv:artemis', 'constellation'], ['dv:chronos', 'prisme'], ['dv:osiris', 'abysses'], ['dv:pantheon', 'disco']].map(([c, f]) => mq(c, { lumiere: f, rayons: false, classe: 'av-sujet carte-avatar' }, L, `${nom(c)}<br>${NOM_FINITION[f as keyof typeof NOM_FINITION]}`, 3)).join('')) +
  ligne('Les métaux', 'Argent, Or, Holo : le halo d’un emoji autour d’un bijou', ['dv:seraphin', 'dv:hecate', 'dv:heracles'].map(c => (['argent', 'or', 'holo'] as const).map(m => mq(c, { metal: m }, L, `${nom(c)}<br>${NOM_FINITION[m]}`, 2.2)).join('')).join(''))

// ── 3. Ensemble, et en petit ────────────────────────────────────────────────
let place = 0
const rang = (dedans: string, prenom: string, points: string) => `<div class="lb-row" style="animation:none"><span class="lb-rank">${(place = (place % 6) + 1)}</span>${localiser(dedans)}<span class="lb-name">${prenom}</span><span class="lb-score">${points}</span></div>`
const enListe = (titre: string, tenue: (c: string, i: number) => Tenue) =>
  `<div><h3>${titre}</h3><div class="leaderboard mq-liste">${['dv:seraphin', 'dv:athena', 'dv:helios', 'dv:pantheon', 'dv:dechu', 'dv:thot']
    .map((c, i) => rang(renderToStaticMarkup(divinHabille(c, { ...tenue(c, i), classe: 'lb-avatar' })), nom(c), `${9840 - i * 730}`))
    .join('')}</div></div>`
const vraiRang = (props: Record<string, unknown>, prenom: string, points: string) => rang(renderToStaticMarkup(h(Avatar, { avatar: '🦊', className: 'lb-avatar', ...props })), prenom, points)

const ensemble =
  ligne('Bordure et lumière', 'la lumière remplace ses rayons', [['dv:seraphin', 'envol', 'maitre'], ['dv:athena', 'constellation', 'diamant'], ['dv:helios', 'aurore', 'or'], ['dv:hecate', 'abysses', 'platine'], ['dv:nike', 'prisme', 'argent'], ['dv:sisyphe', 'orage', 'bronze']].map(([c, f, l]) => mq(c, { lumiere: f, ligue: l, rayons: false, classe: 'av-sujet carte-avatar' }, L, `${nom(c)}<br>${NOM_FINITION[f as keyof typeof NOM_FINITION]} · ${NOM_DE_LA_BORDURE[l as keyof typeof NOM_DE_LA_BORDURE]}`, 3.2)).join('')) +
  ligne('À côté d’un légendaire', 'même ligue, même finition : qui est le plus rare ?', vrai({ legendaire: 'lg:phenix', finition: 'constellation', bordure: { ligue: 'diamant', crans: 12 }, className: 'av-sujet carte-avatar' }, L, 'Phénix (aujourd’hui)', 3.2) + vrai({ legendaire: 'dv:seraphin', className: 'av-sujet carte-avatar' }, L, 'Séraphin (aujourd’hui)', 3.2) + mq('dv:seraphin', { ligue: 'diamant', classe: 'av-sujet carte-avatar' }, L, 'Séraphin, bordure seule', 3.2) + mq('dv:seraphin', { ligue: 'diamant', lumiere: 'constellation', rayons: false, classe: 'av-sujet carte-avatar' }, L, 'Séraphin, bordure et lumière', 3.2)) +
  `<h2>Dans un classement</h2><p class="sous">Les vraies lignes d’un classement, l’avatar à 19 px, figé comme dans toutes les listes : ni rayons, ni étincelles.</p><div class="colonnes" style="margin-top:12px">
    <div><h3>Aujourd’hui</h3><div class="leaderboard mq-liste">${['dv:seraphin', 'dv:athena', 'dv:helios'].map((c, i) => vraiRang({ legendaire: c }, nom(c), `${9840 - i * 730}`)).join('')}${vraiRang({ legendaire: 'lg:phenix', finition: 'or', bordure: { ligue: 'or', crans: 9 } }, 'Un Phénix bordé', '7650')}${vraiRang({ finition: 'constellation', bordure: { ligue: 'diamant', crans: 12 } }, 'Un emoji bordé', '6920')}${vraiRang({ legendaire: 'dv:thot' }, nom('dv:thot'), '6190')}</div></div>
    ${enListe('Avec sa bordure', (_c, i) => ({ ligue: lig(i), crans: [12, 8, 5, 12, 3, 10][i] }))}
    ${enListe('Bordure et lumière', (_c, i) => ({ ligue: lig(i), crans: [12, 8, 5, 12, 3, 10][i], lumiere: LUMIERES[i + 1], rayons: false }))}
  </div>`

const ivoire =
  ligne('Aujourd’hui', 'sans rien', ['dv:seraphin', 'dv:helios', 'dv:athena', 'dv:pantheon', 'dv:dechu', 'dv:hecate'].map(c => vrai({ legendaire: c }, T, nom(c))).join('')) +
  ligne('Les six ligues', 'douze crans', LIGUES.map((l: any, i: number) => mq(['dv:seraphin', 'dv:helios', 'dv:athena', 'dv:pantheon', 'dv:dechu', 'dv:hecate'][i], { ligue: l.cle }, T, NOM_DE_LA_BORDURE[l.cle])).join('')) +
  ligne('Les lumières', 'elles remplacent ses rayons', LUMIERES.map((f, i) => mq(['dv:athena', 'dv:lotus', 'dv:artemis', 'dv:osiris', 'dv:dechu', 'dv:seraphin', 'dv:pantheon', 'dv:helios'][i], { lumiere: f, rayons: false, classe: 'av-sujet carte-avatar' }, L, NOM_FINITION[f as keyof typeof NOM_FINITION], 3)).join('')) +
  ligne('Bordure et lumière', '', [['dv:seraphin', 'envol', 'maitre'], ['dv:athena', 'constellation', 'diamant'], ['dv:helios', 'aurore', 'or'], ['dv:hecate', 'abysses', 'platine']].map(([c, f, l]) => mq(c, { lumiere: f, ligue: l, rayons: false, classe: 'av-sujet carte-avatar' }, L, `${nom(c)}<br>${NOM_FINITION[f as keyof typeof NOM_FINITION]} · ${NOM_DE_LA_BORDURE[l as keyof typeof NOM_DE_LA_BORDURE]}`, 3.2)).join(''))

const P = 66
const QUATRE: [string, string][] = [['dv:seraphin', 'diamant'], ['dv:helios', 'or'], ['dv:athena', 'platine'], ['dv:dechu', 'maitre']]
const nf = (f: string) => NOM_FINITION[f as keyof typeof NOM_FINITION]
const nb = (l: string) => NOM_DE_LA_BORDURE[l as keyof typeof NOM_DE_LA_BORDURE]
/** Ce que je préconise, d'un mot : la bordure, la gloire, le bijou à 1,12. */
const PRECO = { gloire: true, deborde: 1.12 } as const
const gloires = (taille: number) => QUATRE.map(([c, l]) => mq(c, { ligue: l }, taille, `${nom(c)}<br>bordure simple`, 2.5) + mq(c, { ligue: l, gloire: true }, taille, 'en gloire', 2.5)).join('')
const lesDixHuit = (taille: number) => TOUS.map((c, i) => mq(c, { ligue: lig(i + 2), crans: [12, 9, 5, 12, 3, 8][i % 6], ...PRECO }, taille, nom(c), 2.5)).join('')
const pistes =
  ligne('1 · En gloire', 'à gauche la bordure simple ; à droite ses rayons passent derrière elle et en sortent', gloires(P)) +
  ligne('2 · Le bijou déborde', 'en gloire : à sa taille, puis 1,12 et 1,25 fois', ['dv:seraphin', 'dv:pantheon', 'dv:thot'].map(c => [1, 1.12, 1.25].map(k => mq(c, { ligue: 'or', gloire: true, deborde: k }, P, k === 1 ? `${nom(c)}<br>à sa taille` : `× ${String(k).replace('.', ',')}`, 2.3)).join('')).join('')) +
  ligne('3 · Les métaux', 'Argent, Or, Holo teintent sa lumière au lieu de tracer un cercle', ['dv:seraphin', 'dv:hecate', 'dv:arbre'].map(c => mq(c, {}, P, `${nom(c)}<br>sa lumière`, 1.75) + (['argent', 'or', 'holo'] as const).map(m => mq(c, { teinte: m }, P, nf(m), 1.75)).join('')).join('')) +
  ligne('Métal et bordure', 'en gloire, le bijou à 1,12', [['dv:seraphin', 'diamant', 'argent'], ['dv:hecate', 'maitre', 'holo'], ['dv:arbre', 'or', 'or'], ['dv:chronos', 'platine', 'holo'], ['dv:nike', 'argent', 'argent'], ['dv:lotus', 'bronze', 'holo']].map(([c, l, m]) => mq(c, { ligue: l, ...PRECO, teinte: m as 'or' }, P, `${nom(c)}<br>${nf(m)} · ${nb(l)}`, 2.5)).join('')) +
  ligne('4 · Les lumières', 'du 15 au 50 : elles prennent la place de sa gloire', [['dv:seraphin', 'envol', 'maitre'], ['dv:athena', 'constellation', 'diamant'], ['dv:helios', 'singularite', 'or'], ['dv:artemis', 'aurore', 'platine'], ['dv:nike', 'prisme', 'argent'], ['dv:dechu', 'orage', 'bronze']].map(([c, f, l]) => mq(c, { lumiere: f, ligue: l, rayons: false, deborde: 1.12, classe: 'av-sujet carte-avatar' }, 54, `${nom(c)}<br>${nf(f)} · ${nb(l)}`, 3.3)).join('')) +
  ligne('Les dix-huit', 'bordure, gloire, bijou à 1,12', lesDixHuit(P)) +
  ligne('À côté d’un légendaire', 'sur la carte, même ligue', vrai({ legendaire: 'lg:phenix', finition: 'constellation', bordure: { ligue: 'diamant', crans: 12 }, className: 'av-sujet carte-avatar' }, 58, 'Phénix · Constellation', 3.3) + vrai({ legendaire: 'dv:seraphin', className: 'av-sujet carte-avatar' }, 58, 'Séraphin, aujourd’hui', 3.3) + mq('dv:seraphin', { ligue: 'diamant', ...PRECO, classe: 'av-sujet carte-avatar' }, 58, 'Séraphin en gloire', 3.3) + mq('dv:seraphin', { ligue: 'diamant', ...PRECO, teinte: 'holo', classe: 'av-sujet carte-avatar' }, 58, 'en gloire, Holo', 3.3) + mq('dv:seraphin', { ligue: 'diamant', lumiere: 'constellation', rayons: false, deborde: 1.12, classe: 'av-sujet carte-avatar' }, 58, 'sous Constellation', 3.3)) +
  `<h2>Dans un classement</h2><p class="sous">Une liste reste calme : la bordure et le bijou, sans gloire ni lumière qui bouge.</p><div class="colonnes" style="margin-top:12px">
    <div><h3>Aujourd’hui</h3><div class="leaderboard mq-liste">${['dv:seraphin', 'dv:athena', 'dv:helios'].map((c, i) => vraiRang({ legendaire: c }, nom(c), `${9840 - i * 730}`)).join('')}${vraiRang({ legendaire: 'lg:phenix', finition: 'or', bordure: { ligue: 'or', crans: 9 } }, 'Un Phénix bordé', '7650')}${vraiRang({ legendaire: 'dv:dechu' }, nom('dv:dechu'), '6920')}${vraiRang({ legendaire: 'dv:thot' }, nom('dv:thot'), '6190')}</div></div>
    ${enListe('Préconisé', (_c, i) => ({ ligue: lig(i), crans: [12, 8, 5, 12, 3, 10][i], deborde: 1.12 }))}
  </div>`
const pistesIvoire = ligne('En gloire', 'bordure simple, puis en gloire', gloires(P)) + ligne('Les dix-huit', 'bordure, gloire, bijou à 1,12', lesDixHuit(P))

const PLANCHES: [string, string, number, string?][] = [
  ['1-bordures', page('Un Divin sous une bordure de ligue', 'Maquette. Les vrais composants et la vraie feuille de style ; la bordure a la taille qu’elle prend autour d’un médaillon. Le métal est celui de la ligue.', bordures), 1500],
  ['2-lumieres', page('Un Divin sous la lumière d’une finition', 'Maquette, à la taille de la carte d’un joueur. Du niveau 15 au 50, puis les trois métaux — qui posent un cercle autour d’un bijou qui n’est pas rond.', lumieres), 1780],
  ['3-ensemble', page('Bordure et lumière ensemble, et en petit', 'Maquette. Sur la carte d’un joueur, puis dans une ligne de classement.', ensemble), 1500],
  ['5-pistes', page('Ce que je préconise pour les Divins', 'Maquette. Quatre gestes propres aux Divins : la gloire, le bijou qui déborde, les métaux qui teintent sa lumière, les lumières qui prennent la place de sa gloire.', pistes), 1780],
  ['6-pistes-ivoire', page('Les mêmes, en Ivoire', 'Maquette.', pistesIvoire, 'ivoire'), 1780],
  ['4-ivoire', page('En Ivoire, le thème clair', 'Maquette.', ivoire, 'ivoire'), 1700],
]

const navigateur = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'] })
try {
  for (const [nomDeLaPlanche, html, largeur] of PLANCHES.filter(p => !process.env.SEULEMENT || p[0].startsWith(process.env.SEULEMENT))) {
    const fichier = path.join(sortie, `${nomDeLaPlanche}.html`)
    writeFileSync(fichier, html)
    const onglet = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, deviceScaleFactor: Number(process.env.DENSITE ?? 1) })
    const erreurs: string[] = []
    onglet.on('pageerror', (e: Error) => erreurs.push(e.message))
    onglet.on('requestfailed', (r: any) => erreurs.push(`${r.url()} : ${r.failure()?.errorText}`))
    await onglet.goto('file://' + fichier)
    await onglet.waitForLoadState('networkidle')
    await onglet.setViewportSize({ width: largeur, height: await onglet.evaluate('document.body.scrollHeight') })
    await onglet.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await onglet.waitForTimeout(700)
    await onglet.screenshot({ path: path.join(sortie, `${nomDeLaPlanche}.png`), fullPage: true })
    await onglet.close()
    if (erreurs.length) console.error(`[${nomDeLaPlanche}]`, erreurs.slice(0, 5))
    console.log(path.join(sortie, `${nomDeLaPlanche}.png`))
  }
} finally {
  await navigateur.close()
}

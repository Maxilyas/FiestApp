// La lumière des trois dernières finitions : le Diamant (Prisme, niveau 15),
// les Voiles (Aurore, 20), l'Astrolabe (Constellation, 25).
//
// Leurs halos d'avant tenaient dans 1,45 em : Prisme était Holo avec une
// étoile, Aurore un disque flou, et la salle ne voyait pas qu'on avait monté
// de cinq niveaux. Ils ont maintenant une lumière qui déborde — dessinée à
// part (`client/src/components/Lumiere.tsx`), chargée à la demande comme
// les médaillons, posée autour de l'emoji comme du médaillon, jamais d'un
// Divin — et qui ne bouge que par ce que le navigateur compose.
//
// Pas de serveur : des modules du client, rendus en HTML, et la feuille de
// style. Chaque test échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Ce que le test lit du module des dessins — écrit à la main, comme `medaillons.test.ts`. */
interface Medaillons {
  sortesDesAvatars(avatars: readonly { legendaire?: string | null; finition?: string | null }[]): string[]
}

/** Un avatar du client, rendu en HTML — la même recette que `eclat.test.ts`. */
async function avatar(props: object): Promise<string> {
  Object.assign(globalThis, { React: (await import('react')).default })
  const { Avatar } = await import(url('components/Avatar.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  return renderToStaticMarkup(React.createElement(Avatar, { avatar: '🦊', ...props }))
}

/** Les dessins, arrivés : ils s'inscrivent en s'évaluant, comme au navigateur. */
async function charger(...fichiers: string[]) {
  for (const f of fichiers) await import(url(`components/${f}.tsx`))
}

/** Les règles de la feuille, sélecteur et corps. */
const REGLES = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ sel: sel.trim(), corps }))

/** Le corps d'une animation nommée : ses images clés. */
function imagesCles(nom: string): string {
  const debut = CSS.indexOf(`@keyframes ${nom} {`)
  assert.ok(debut >= 0, `@keyframes ${nom} existe`)
  let profondeur = 0
  let i = CSS.indexOf('{', debut)
  const ouverture = i
  do {
    if (CSS[i] === '{') profondeur++
    else if (CSS[i] === '}') profondeur--
    i++
  } while (profondeur > 0)
  return CSS.slice(ouverture + 1, i - 1)
}

// ── 1. À la demande ───────────────────────────────────────────────────────

test('une salle sans niveau 15 ne télécharge pas la lumière ; un Divin ne la fait pas venir', async () => {
  const m: Medaillons = await import(url('components/medaillons.ts'))
  // Une salle d'anonymes, d'emojis, de finitions jusqu'à Holo : rien.
  assert.deepEqual(m.sortesDesAvatars([{}, { finition: 'mat' }, { finition: 'or' }, { finition: 'holo', legendaire: null }]), [])
  for (const finition of ['prisme', 'aurore', 'constellation', 'abysses', 'orage', 'envol', 'disco', 'singularite']) {
    assert.deepEqual(m.sortesDesAvatars([{ finition: 'holo' }, { finition }]), ['lumiere'], finition)
  }
  // Un légendaire porté en Constellation : son médaillon et sa lumière.
  assert.deepEqual(m.sortesDesAvatars([{ legendaire: 'lg:phenix', finition: 'constellation' }]), ['legendaire', 'lumiere'])
  // Un Divin n'a pas de finition : sa lumière est la sienne.
  assert.deepEqual(m.sortesDesAvatars([{ legendaire: 'dv:lotus', finition: 'constellation' }]), ['divin'])
  // Une finition inconnue — une page d'avant, une valeur trafiquée — ne demande rien.
  assert.deepEqual(m.sortesDesAvatars([{ finition: 'arc-en-ciel' }]), [])
})

// ── 2. Autour de l'emoji, du médaillon — jamais d'un Divin ────────────────

test('en attendant sa lumière, l’emoji garde son halo d’avant', async () => {
  // Rien n'est encore arrivé dans ce processus : c'est le premier rendu d'une page.
  const html = await avatar({ finition: 'constellation' })
  assert.match(html, /class="av av-constellation"/)
  assert.doesNotMatch(html, /av-lumiere|class="lu /)
  // Et la feuille garde ce halo pour ce temps-là, et pour lui seulement :
  // une fois la lumière posée, l'Éclat retrouve ses paillettes — le halo
  // d'Aurore les remplaçait, une règle `::after` de même poids venue après.
  const halos = REGLES.filter(r => /\.av-(prisme|aurore|constellation|abysses|orage|envol|disco|singularite)[^,{]*::(before|after)/.test(r.sel))
  assert.ok(halos.length >= 10, `les halos d'attente sont lus (${halos.length})`)
  // Chacune des cinq du 1er novembre 2026 a le sien : sa couleur se voit avant sa lumière.
  for (const f of ['abysses', 'orage', 'envol', 'disco', 'singularite']) {
    assert.ok(halos.some(r => r.sel.includes(`.av-${f}:not(.av-lumiere)::before`)), `${f} a son halo d'attente`)
  }
  for (const r of halos) {
    for (const s of r.sel.split(',').filter(s => /\.av-(prisme|aurore|constellation|abysses|orage|envol|disco|singularite)/.test(s))) {
      assert.match(s, /:not\(\.av-lumiere\)/, `${s.trim()} s'efface quand la lumière est là`)
    }
  }
})

test('la lumière entoure l’emoji : derrière lui, puis devant — le Diamant, les Voiles, l’Astrolabe', async () => {
  await charger('Lumiere', 'Legendaire', 'Divin')
  const calques: Record<string, RegExp[]> = {
    prisme: [/lu-cristal/, /lu-feux/, /lu-glace/, /lu-spectres-1/, /lu-balayage/, /lu-etincelle/],
    aurore: [/lu-lueur/, /lu-voile lu-voile-1/, /lu-voile lu-voile-2/, /lu-ion lu-ion-1/],
    constellation: [/lu-nebuleuse/, /lu-astrolabe/, /lu-gemmes/, /lu-orbite lu-orbite-arriere/, /lu-orbite lu-orbite-avant/, /lu-astre/],
  }
  for (const [finition, attendus] of Object.entries(calques)) {
    const html = await avatar({ finition })
    assert.match(html, new RegExp(`class="av av-${finition} av-lumiere"`), finition)
    for (const c of attendus) assert.match(html, c, `${finition} : ${c.source}`)
    // L'emoji entre les deux : ce qui est derrière avant lui, ce qui passe devant après.
    const [arriere, emoji, avant] = ['lu lu-arriere', '🦊', 'lu lu-avant'].map(t => html.indexOf(t))
    assert.ok(arriere >= 0 && arriere < emoji && emoji < avant, `${finition} : l'emoji entre ses deux calques`)
    // Muette : l'oreille entend l'avatar, pas ses étoiles.
    assert.match(html, /<span class="lu lu-arriere" aria-hidden="true">/)
    assert.doesNotMatch(html, /<img(?![^>]*alt="")/, 'chaque image est décorative')
  }
  // Jusqu'à Holo, et pour un anonyme : pas de lumière.
  for (const finition of ['holo', 'or', undefined]) assert.doesNotMatch(await avatar({ finition }), /class="lu /, String(finition))
})

test('autour d’un médaillon, son cercle fait l’anneau ; un Divin garde la sienne', async () => {
  await charger('Lumiere', 'Legendaire', 'Divin')
  // L'Astrolabe autour du Phénix : l'orbite et la nébuleuse, pas le limbe ni
  // l'anneau serti — c'est le cercle du médaillon qui est gradué. Deux
  // anneaux autour d'un disque faisaient une cible.
  const astrolabe = await avatar({ legendaire: 'lg:phenix', finition: 'constellation' })
  assert.match(astrolabe, /class="av av-legendaire av-lumiere"/)
  assert.match(astrolabe, /lu-orbite-avant/)
  assert.doesNotMatch(astrolabe, /lu-astrolabe|lu-gemmes/)
  assert.match(astrolabe, /lg-cercle-constellation/)
  assert.match(astrolabe, /stroke-dasharray/, 'le limbe du médaillon est gradué')
  // Le Diamant le sertit : la bague de cristal, sans la lueur qui remplit la bague d'un emoji.
  const diamant = await avatar({ legendaire: 'lg:phenix', finition: 'prisme' })
  assert.match(diamant, /lu-cristal/)
  assert.doesNotMatch(diamant, /lu-glace/)
  assert.match(diamant, /lg-cercle-prisme/)
  // Les Voiles se lèvent derrière lui comme derrière un emoji.
  assert.match(await avatar({ legendaire: 'lg:phenix', finition: 'aurore' }), /lu-voile-1/)
  // Un Divin ne prend ni finition ni lumière.
  const divin = await avatar({ legendaire: 'dv:lotus', finition: 'constellation' })
  assert.match(divin, /class="av av-divin"/)
  assert.doesNotMatch(divin, /class="lu |av-lumiere|av-constellation/)
})

test('les cinq de prestige, du 30 au 50 : chacune sa matière, autour de l’emoji comme du médaillon', async () => {
  // Le choix du propriétaire du 1er novembre 2026, sur une planche de douze : les grands fonds, l'orage, les ailes,
  // la piste de danse, le trou noir — rien de commun avec celles d'avant.
  await charger('Lumiere', 'Legendaire', 'Divin')
  const calques: Record<string, RegExp[]> = {
    abysses: [/lu-eau/, /lu-faisceaux/, /lu-plancton lu-plancton-1/, /lu-meduse lu-meduse-1/, /lu-meduse lu-meduse-2/, /lu-bulle lu-bulle-1/],
    orage: [/lu-nuage/, /lu-foudre lu-foudre-1/, /lu-foudre lu-foudre-2/, /lu-zebrure lu-zebrure-1/, /lu-zebrure lu-zebrure-4/, /lu-crepitement lu-crepitement-1/],
    envol: [/lu-clarte/, /lu-aile lu-aile-gauche/, /lu-aile lu-aile-droite/, /lu-aureole/, /lu-plume lu-plume-1/],
    disco: [/lu-piste/, /lu-boule/, /lu-reflets lu-reflets-1/, /lu-reflets lu-reflets-2/, /lu-miroite lu-miroite-1/],
    singularite: [/lu-accretion/, /lu-lentille/, /lu-ombre/, /lu-photons/, /lu-disque lu-disque-arriere/, /lu-disque lu-disque-avant/, /lu-tourbillon/],
  }
  for (const [finition, attendus] of Object.entries(calques)) {
    const html = await avatar({ finition })
    assert.match(html, new RegExp(`class="av av-${finition} av-lumiere"`), finition)
    for (const c of attendus) assert.match(html, c, `${finition} : ${c.source}`)
    const [arriere, emoji, avant] = ['lu lu-arriere', '🦊', 'lu lu-avant'].map(t => html.indexOf(t))
    assert.ok(arriere >= 0 && arriere < emoji && emoji < avant, `${finition} : l'emoji entre ses deux calques`)
    assert.doesNotMatch(html, /<img(?![^>]*alt="")/, `${finition} : chaque image est décorative`)
    // Autour d'un médaillon, son cercle dit la finition.
    assert.match(await avatar({ legendaire: 'lg:phenix', finition }), new RegExp(`lg-cercle-${finition}`), `${finition} : le cercle du médaillon`)
  }
  // Le disque de la Singularité passe derrière la tête, puis devant : sa moitié proche après l'emoji.
  const disque = await avatar({ finition: 'singularite' })
  assert.ok(disque.indexOf('lu-disque-avant') > disque.indexOf('🦊') && disque.indexOf('lu-disque-arriere') < disque.indexOf('🦊'))
  // Autour d'un médaillon, ce qui fait anneau autour d'un emoji laisse la place à son cercle : ni l'arc d'Orage, ni
  // l'ombre et l'anneau de photons de la Singularité — son disque, lui, passe encore sous le menton.
  const orage = await avatar({ legendaire: 'lg:phenix', finition: 'orage' })
  assert.doesNotMatch(orage, /lu-foudre/)
  assert.match(orage, /lu-zebrure-1/, 'ses éclairs frappent autour du médaillon')
  const trouNoir = await avatar({ legendaire: 'lg:phenix', finition: 'singularite' })
  assert.doesNotMatch(trouNoir, /lu-ombre|lu-photons/)
  assert.match(trouNoir, /lu-disque-avant/)
  // Sous une bordure de ligue, la boule de Disco s'efface — la bordure en prend les miroirs —, ses reflets restent.
  const { Lumiere } = await import(url('components/Lumiere.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  const sousBordure = renderToStaticMarkup(React.createElement(Lumiere, { finition: 'disco', bordure: true }, '🦊'))
  assert.doesNotMatch(sousBordure, /lu-boule/)
  assert.match(sousBordure, /lu-reflets-1/)
  // Au repos, ce qui ne vit que par son mouvement se tait — une bulle figée serait une tache sur la joue —, et le
  // premier éclair d'Orage reste, pour qu'on la reconnaisse dans une liste.
  for (const sel of ['.lu-bulle', '.lu-plume', '.lu-zebrure']) assert.match(REGLES.find(r => r.sel === sel)?.corps ?? '', /opacity:\s*0;/, sel)
  assert.match(REGLES.find(r => r.sel === '.lu-zebrure-1')?.corps ?? '', /opacity:\s*0\.9;/)
})

// ── 3. Ce que la salle paie ───────────────────────────────────────────────

test('la lumière ne bouge que par ce que le navigateur compose', () => {
  // Cinquante avatars sur le PC d'un vidéoprojecteur : une animation de
  // filtre, de fond ou de masque redessinerait chaque image. Seuls
  // `rotate`, `scale`, `translate`, `transform` et `opacity` se composent.
  const calques = REGLES.filter(r => /(^|[\s,])\.lu-[\w-]+/.test(r.sel))
  assert.ok(calques.length > 20, `les calques sont lus (${calques.length})`)
  const noms = new Set<string>()
  for (const r of calques) {
    for (const m of r.corps.matchAll(/animation(?:-name)?:\s*([^;]+)/g)) {
      const nom = m[1].split(/\s+/).find(t => /^[a-z]+-[a-z-]+$/.test(t) && !/^(ease|linear|infinite|reverse|alternate)/.test(t))
      if (nom) noms.add(nom)
    }
    assert.doesNotMatch(r.corps, /transition/, `${r.sel} ne fait pas de transition`)
  }
  assert.ok(noms.size >= 6, `les mouvements sont lus : ${[...noms].join(', ')}`)
  for (const nom of noms) {
    for (const [, propriete] of imagesCles(nom).matchAll(/([a-z-]+)\s*:/g)) {
      assert.ok(['rotate', 'scale', 'translate', 'transform', 'opacity'].includes(propriete), `@keyframes ${nom} anime ${propriete}`)
    }
  }
})

test('dans les listes, la lumière reste mais se resserre et se fige ; moins de mouvement, elle s’arrête', () => {
  const fige = (selecteur: string) =>
    REGLES.some(r => r.sel.split(',').some(s => s.trim() === selecteur) && /animation:\s*none/.test(r.corps))
  // Les mêmes listes que les halos et les médaillons : classement, salle
  // d'attente, choix des finitions, grille des avatars du profil.
  for (const s of [
    '.av.lb-avatar:not(.av-sujet) .lu *',
    '.player-chip .lu *',
    '.leaderboard .lb-row:nth-child(n + 6) .lu *',
    '.finitions .finition-btn:not(.selected):not(:hover) .lu *',
    '.grille-unique .case-avatar:not(.selected):not(.ouverte):not(:hover) .lu *',
  ]) {
    assert.ok(fige(s), `${s} ne bouge pas`)
  }
  // À 2,8 em, elle mordait sur la ligne voisine — et sur le prénom, même
  // dans une ligne où elle bouge (le podium du téléphone, `av-sujet`).
  const selecteurs = (r: { sel: string }) => r.sel.split(',').map(s => s.trim())
  const resserre = REGLES.find(r => selecteurs(r).includes('.av-lumiere .lu'))
  assert.match(resserre?.corps ?? '', /scale:\s*0\.\d+/)
  // Là où l'avatar est le sujet, toute sa place, et la page la lui réserve.
  const entiere = REGLES.find(r => selecteurs(r).includes('.podium-avatar .lu') && selecteurs(r).includes('.finition-btn .lu'))
  assert.match(entiere?.corps ?? '', /scale:\s*1;/)
  for (const s of ['.retour-avatar.av-lumiere', '.carte-avatar.av-lumiere', '.finition-btn .av-lumiere']) {
    assert.ok(REGLES.some(r => selecteurs(r).includes(s) && /margin/.test(r.corps)), `${s} a sa marge`)
  }
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.lu \* \{ animation: none !important; \}/)
  // Au repos, ce qui ne vit que par son mouvement se tait : une étincelle
  // qui monte, figée, serait un point vert collé à la joue.
  const ion = REGLES.find(r => r.sel === '.lu-ion')
  assert.match(ion?.corps ?? '', /opacity:\s*0;/)
})

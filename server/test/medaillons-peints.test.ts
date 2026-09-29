// Les légendaires et les Divins peints (`server/scripts/anime/legendaires.ts`) :
// leurs fichiers, servis sous leur empreinte, et ce que chaque état montre —
// la carte sous sa pellicule holo, sa version rare qui sort du cadre, la
// silhouette à gagner, le bijou d'un Divin qui vit, le voile de celui qui
// n'est pas descendu. Des modules du client, rendus en HTML ; un serveur
// jetable pour la route seulement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { demarrer } from './banc'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Là où le build prend les fichiers peints, qu'il sert sous `/medaillons/`. */
const PUBLICS = new URL('../../client/public/medaillons/', import.meta.url)

/**
 * Ce qu'un fichier peint pèse au plus, par taille : une salle d'habitués en
 * porte plusieurs, et chaque téléphone télécharge ceux qu'il voit — la petite
 * taille, 22 Ko en moyenne. Le plus chargé, le Bouquet final éclaté, dont la
 * découpe garde les gerbes et la fumée des feux d'artifice, monte à 139 Ko
 * en grand et 52 en petit ; au-delà, c'est un fichier qui n'est pas passé
 * par la chaîne (un PNG, une image en 2K).
 */
const POIDS_MAX: Record<string, number> = { '512': 150_000, '256': 55_000 }

/** Un fichier peint : son adresse, sous son empreinte, et son poids. */
function verifierFichier(f: string, nom: string, taille: '512' | '256') {
  assert.match(f, new RegExp(`^/medaillons/${nom}-${taille}\\.[0-9a-f]{10}\\.webp$`), f)
  const fichier = new URL(f.slice('/medaillons/'.length), PUBLICS)
  assert.ok(existsSync(fichier), `${f} est cité mais absent`)
  const poids = statSync(fichier).size
  assert.ok(poids <= POIDS_MAX[taille], `${f} pèse ${poids} octets`)
}

// ── 1. Les fichiers ───────────────────────────────────────────────────────

test('chaque légendaire a sa carte peinte, sa version rare et sa créature détourée, sous leur empreinte', async () => {
  const { IMAGES } = await import(url('components/legendaires-peints.ts'))
  assert.deepEqual(Object.keys(IMAGES).sort(), LEGENDAIRES.map(l => l.key).sort(), 'les seize, et eux seuls')
  for (const l of LEGENDAIRES) {
    const i = IMAGES[l.key]
    const id = l.key.slice(3)
    for (const [variante, paire] of [
      ['art', i.art],
      ['rare', i.rare],
      ['rare-perso', i.rarePerso],
    ] as const) {
      assert.equal(paire.length, 2, `${l.key} : ${variante}, grand puis petit`)
      verifierFichier(paire[0], `${id}-${variante}`, '512')
      verifierFichier(paire[1], `${id}-${variante}`, '256')
    }
    // La silhouette d'un légendaire à gagner n'a besoin que de sa forme : la petite taille suffit.
    verifierFichier(i.perso, `${id}-perso`, '256')
  }
})

test('chaque Divin a son bijou, détouré, en deux tailles', async () => {
  const { BADGES } = await import(url('components/divins-peints.ts'))
  assert.deepEqual(Object.keys(BADGES).sort(), DIVINS.map(d => d.key).sort(), 'les cinq, et eux seuls')
  for (const d of DIVINS) {
    const [grand, petit] = BADGES[d.key]
    verifierFichier(grand, `${d.key.slice(3)}-badge`, '512')
    verifierFichier(petit, `${d.key.slice(3)}-badge`, '256')
  }
})

test('les fichiers peints sont tous cités : un médaillon repeint emporte l’ancien', async () => {
  const { IMAGES } = await import(url('components/legendaires-peints.ts'))
  const { BADGES } = await import(url('components/divins-peints.ts'))
  const cites = new Set<string>()
  for (const i of Object.values<any>(IMAGES)) for (const f of [...i.art, ...i.rare, ...i.rarePerso, i.perso]) cites.add(f)
  for (const paire of Object.values<string[]>(BADGES)) for (const f of paire) cites.add(f)
  const presents = readdirSync(PUBLICS).map(f => `/medaillons/${f}`)
  assert.deepEqual(
    presents.filter(f => !cites.has(f)),
    [],
    'des fichiers que plus personne ne cite',
  )
})

test('le serveur les sert pour un an, et un fichier absent est un 404', async () => {
  // Le client compilé n'existe qu'après le build : un dossier d'une page et d'un médaillon suffit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  mkdirSync(path.join(dist, 'medaillons'))
  const { BADGES } = await import(url('components/divins-peints.ts'))
  const nom = BADGES['dv:helios'][1].slice('/medaillons/'.length)
  copyFileSync(new URL(nom, PUBLICS), path.join(dist, 'medaillons', nom))
  const banc = await demarrer({ clientDist: dist })
  try {
    const r = await fetch(`${banc.url}/medaillons/${nom}`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'image/webp')
    assert.match(String(r.headers.get('cache-control')), /max-age=31536000.*immutable/)
    // Un médaillon repeint change d'adresse : l'ancienne n'ouvre pas l'application à sa place.
    const absent = await fetch(`${banc.url}/medaillons/helios-badge-256.0000000000.webp`)
    assert.equal(absent.status, 404)
    assert.doesNotMatch(await absent.text(), /<title>FiestApp/)
  } finally {
    await banc.close()
  }
})

// ── 2. Ce que chaque état montre ──────────────────────────────────────────

const legendaire = (props: object) => rendu('components/Legendaire', 'Legendaire', props)

test('un légendaire est une carte peinte sous sa pellicule : l’image, l’arc-en-ciel, la diffraction, le reflet', async () => {
  const html = await legendaire({ cle: 'lg:dragon' })
  assert.match(html, /<span class="lg lg-eclat lg-dragon" role="img" aria-label="Le Dragon d’Or">/)
  // Petit par défaut — une liste en montre vingt.
  assert.match(html, /<img class="lg-art" src="\/medaillons\/dragon-art-256\.[0-9a-f]{10}\.webp" alt=""/)
  // Dans l'ordre : l'image, puis ce qui la fait briller, le reflet au-dessus de tout.
  const ordre = ['lg-art', 'lg-feuille', 'lg-diffraction', 'lg-reflet'].map(c => html.indexOf(`class="${c}"`))
  assert.ok(ordre.every((p, k) => p > 0 && (k === 0 || p > ordre[k - 1])), `${ordre}`)
  // Son cercle d'or d'origine, hors d'un porteur ; ni version rare, ni ce qui va avec.
  assert.match(html, /class="lg-bord"/)
  assert.doesNotMatch(html, /lg-cercle|lg-eclate|lg-gerbe|lg-debord|lg-paillettes|lg-feuille-2|-rare-/)
  // Le reflet ne suit le doigt qu'en grand.
  assert.doesNotMatch(html, /lg-touche-libre/)
  // Le disque tient sa couleur le temps que l'image arrive.
  assert.match(html, /stop-color="#2f8f68"/)
})

test('en grand, ses grands fichiers, et le reflet suit le doigt', async () => {
  const html = await legendaire({ cle: 'lg:dragon', grand: true })
  assert.match(html, /class="lg lg-eclat lg-dragon lg-touche-libre"/)
  assert.match(html, /dragon-art-512\./)
  assert.doesNotMatch(html, /-256\./)
})

test('éclaté : sa version rare sous le prisme, ses paillettes, sa gerbe — et la créature sort du cadre', async () => {
  const html = await legendaire({ cle: 'lg:renard', eclat: true })
  assert.match(html, /aria-label="Le Renard Lunaire, éclaté"/)
  assert.match(html, /class="lg lg-eclat lg-renard lg-eclate"/)
  assert.match(html, /<img class="lg-art" src="\/medaillons\/renard-rare-256\./)
  assert.doesNotMatch(html, /renard-art-/)
  assert.equal((html.match(/class="lg-gerbe( lg-gerbe-2)?"/g) ?? []).length, 2, 'deux gerbes croisées, derrière')
  assert.equal((html.match(/class="lg-paillettes( lg-paillettes-2)?"/g) ?? []).length, 2)
  assert.match(html, /class="lg-feuille lg-feuille-2"/)
  // Ce qui sort du cadre vient après le disque et son anneau : il passe par-dessus.
  assert.match(html, /<img class="lg-debord" src="\/medaillons\/renard-rare-perso-256\.[0-9a-f]{10}\.webp" alt=""/)
  assert.ok(html.indexOf('lg-debord') > html.indexOf('lg-disque'))
  assert.ok(html.indexOf('lg-gerbe') < html.indexOf('lg-carte'), 'la gerbe est derrière la carte')
})

test('une légende de l’ombre garde sa pellicule noire et son anneau d’ombre', async () => {
  const html = await legendaire({ cle: 'lg:trou-noir' })
  assert.match(html, /class="lg lg-ombre lg-trou-noir"/)
  assert.match(html, /stop-color="#6d4fb3"/)
  // Portée, la finition prend son cercle, et le filet violet reste.
  const porte = await legendaire({ cle: 'lg:trou-noir', finition: 'or' })
  assert.match(porte, /lg-cercle lg-cercle-or/)
  assert.match(porte, /stroke="#b48cff"/)
  assert.doesNotMatch(porte, /fill="url\(#[^"]*-bord\)"/, 'son anneau d’ombre cède la place')
})

test('à gagner : sa forme seule, en silhouette dorée — ni image, ni pellicule, ni Éclat, ni reflet au doigt', async () => {
  const html = await legendaire({ cle: 'lg:sphinx', verrouille: true, eclat: true, finition: 'or', grand: true })
  assert.match(html, /<span class="lg lg-eclat lg-sphinx lg-verrou" role="img" aria-label="Le Sphinx — pas encore gagné">/)
  assert.match(html, /<span class="lg-silhouette" style="-webkit-mask-image:url\(\/medaillons\/sphinx-perso-256\.[0-9a-f]{10}\.webp\);mask-image:url\(\/medaillons\/sphinx-perso-256\./)
  assert.doesNotMatch(html, /lg-art|lg-feuille|lg-reflet|lg-eclate|lg-gerbe|lg-debord|lg-cercle|lg-touche-libre|-rare/)
})

test('deux médaillons sur une page ne partagent jamais un dégradé', async () => {
  const ids = (html: string) => [...html.matchAll(/\bid="([^"]*)"/g)].map(x => x[1])
  const a = ids(await legendaire({ cle: 'lg:phenix' }))
  const b = ids(await legendaire({ cle: 'lg:lion' }))
  assert.ok(a.length >= 2)
  for (const id of a) assert.ok(!b.includes(id), id)
})

const divin = (props: object) => rendu('components/Divin', 'Divin', props)

test('un Divin est un bijou qui vit : ses rayons, sa lueur, l’éclat sur son or, ses étincelles', async () => {
  const html = await divin({ cle: 'dv:helios' })
  assert.match(html, /<span class="dv dv-helios dv-peint" role="img" aria-label="Hélios" style="--dv-rvb:255, 201, 74">/)
  assert.match(html, /<img class="dv-bijou" src="\/medaillons\/helios-badge-256\.[0-9a-f]{10}\.webp" alt=""/)
  assert.equal((html.match(/class="dv-rayons( dv-rayons-2)?"/g) ?? []).length, 2)
  assert.match(html, /class="dv-lueur"/)
  // L'éclat ne glisse que sur le bijou : le bijou lui sert de masque.
  assert.match(html, /<span class="dv-or" style="-webkit-mask-image:url\(\/medaillons\/helios-badge-256\.[^)]*\);mask-image:url\(\/medaillons\/helios-badge-256\.[^)]*\)"><span class="dv-or-bande"><\/span><\/span>/)
  assert.equal((html.match(/class="dv-scintille"/g) ?? []).length, 5)
  // Regardé en grand, son grand fichier.
  assert.match(await divin({ cle: 'dv:helios', grand: true }), /helios-badge-512\./)
})

test('pas encore descendu, un Divin ne montre rien de lui : ni son bijou, ni son nom', async () => {
  for (const d of DIVINS) {
    const html = await divin({ cle: d.key, verrouille: true })
    assert.match(html, new RegExp(`^<svg class="dv dv-${d.key.slice(3)} dv-voile"`), 'un voile, et rien à précharger')
    assert.match(html, /aria-label="Un Divin — personne ne sait ce qui le fait descendre"/)
    assert.doesNotMatch(html, /medaillons|badge|dv-peint/)
    assert.ok(!html.includes(d.nom), `${d.key} : son nom`)
  }
})

// ── 3. Ce que la salle paie ───────────────────────────────────────────────

const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Le corps d'un bloc `@keyframes`, accolades imbriquées comprises. */
function keyframes(nom: string): string {
  const debut = CSS.indexOf(`@keyframes ${nom} {`)
  assert.ok(debut >= 0, `@keyframes ${nom}`)
  let profondeur = 0
  for (let i = CSS.indexOf('{', debut); i < CSS.length; i++) {
    if (CSS[i] === '{') profondeur++
    else if (CSS[i] === '}' && --profondeur === 0) return CSS.slice(debut, i + 1)
  }
  throw new Error(`@keyframes ${nom} n'est pas fermé`)
}

test('leur lumière ne bouge que par transform et opacity — le PC du vidéoprojecteur en fait tourner plusieurs', () => {
  const noms = new Set<string>()
  for (const m of CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!/\.(lg|dv)-/.test(m[1])) continue
    for (const a of m[2].matchAll(/animation(?:-name)?:\s*([^;]+)/g)) {
      for (const partie of a[1].split(',')) {
        const nom = partie.trim().split(/\s+/).find(t => /^(lg|dv)-[a-z0-9-]+$/.test(t))
        if (nom) noms.add(nom)
      }
    }
  }
  assert.ok(noms.size >= 10, `les animations sont lues (${[...noms].join(', ')})`)
  for (const nom of noms) {
    const proprietes = [...keyframes(nom).matchAll(/([a-z-]+)\s*:/g)].map(m => m[1])
    for (const p of proprietes) assert.ok(['transform', 'opacity'].includes(p), `${nom} anime ${p}`)
  }
  // Et aucun filtre : chacun se recalcule à chaque image.
  for (const m of CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (/\.(lg|dv)-/.test(m[1])) assert.doesNotMatch(m[2], /(^|[;\s])filter\s*:/, m[1].trim())
  }
})

test('dans une liste, ils tiennent dans leur cadre : ni gerbe, ni débord, ni rayons, ni étincelles', () => {
  for (const liste of ['.av.lb-avatar:not(.av-sujet)', '.player-chip']) {
    for (const quoi of ['.lg-gerbe', '.lg-debord', '.dv-rayons', '.dv-etincelles']) {
      const selecteur = `${liste} ${quoi}`
      const regle = [...CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)].find(m => m[1].split(',').map(s => s.trim()).includes(selecteur))
      assert.ok(regle && /display:\s*none/.test(regle[2]), selecteur)
    }
  }
})

test('« réduire les animations » les arrête, et la silhouette d’un légendaire à gagner ne bouge jamais', () => {
  const reduits = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([^{}]*\{[^{}]*\}\s*)+\}/g)].map(m => m[0])
  for (const s of ['.lg *', '.dv *']) {
    assert.ok(
      reduits.some(bloc => bloc.includes(`${s} { animation: none !important; }`)),
      `${s} sous « réduire les animations »`,
    )
  }
  assert.match(CSS, /\.lg-verrou \* \{ animation: none !important; \}/)
})

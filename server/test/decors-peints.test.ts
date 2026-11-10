// Les décors peints (`server/scripts/anime/decors.ts`) : le Calendrier des
// Heures, les quatre thèmes peints, vingt fonds de carte — deux gagnés, six du
// trésor, douze des savoirs que la boutique vend — et les quatre coffres de
// la semaine. Leurs fichiers, servis sous
// leur empreinte et d'un poids qu'un téléphone porte ; ce qui les cite — la
// table du calendrier, celle des coffres, le bloc que la chaîne réécrit dans
// chaque feuille — ; aucun fichier que plus personne ne cite ; et l'horloge
// de Paris, qui dit aux feuilles l'heure, le moment du ciel et le mois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { demarrer } from './banc'
import { PAGES } from '../../shared/calendrier'
import { FONDS_EN_BOUTIQUE } from '../../shared/fonds'

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url)

/** Là où le build prend les décors, qu'il sert sous `/decors/`. */
const PUBLICS = new URL('../../client/public/decors/', import.meta.url)

/** Les deux repères du bloc que la livraison réécrit, dans chaque feuille qui cite un décor. */
const DEBUT = '/* ── Décors peints : écrit par `server/scripts/anime/decors.ts --livrer`, on ne le retouche pas à la main ── */'
const FIN = '/* ── Fin des décors peints ── */'

/** Les thèmes peints : chacun ses images, sous des propriétés `--decor-…` de sa feuille. */
const THEMES_PEINTS: Record<string, string[]> = {
  horloge: ['cadran', 'aiguille-heures', 'aiguille-minutes', 'engrenage-grand', 'engrenage-petit'],
  ciel: ['aube', 'jour', 'crepuscule', 'nuit'],
  heures: ['folio'],
  sommet: ['montagne', 'drapeaux'],
}

/**
 * Ce qu'un décor pèse au plus. Une page du calendrier, la plus chargée des
 * enluminures, en 512 et 256 : une grille de douze se télécharge d'un coup.
 * Un décor plein écran, en 720 de large, et le cadran de l'horloge, en 960 :
 * au-delà, c'est un fichier qui n'est pas passé par la chaîne (un PNG, une
 * image en 2K).
 */
function poidsMax(nom: string): number {
  if (/^page-\d\d(-doree)?-512\./.test(nom)) return 160_000
  if (/^page-\d\d(-doree)?-256\./.test(nom)) return 55_000
  return 230_000
}

/** Un décor cité : son adresse sous empreinte, le fichier là où le build le prend, son poids. */
function verifierFichier(adresse: string, nom?: RegExp) {
  assert.match(adresse, /^\/decors\/[\w-]+\.[0-9a-f]{10}\.webp$/, adresse)
  const fichier = adresse.slice('/decors/'.length)
  if (nom) assert.match(fichier, nom, adresse)
  const chemin = new URL(fichier, PUBLICS)
  assert.ok(existsSync(chemin), `${adresse} est cité mais absent`)
  const octets = readFileSync(chemin)
  assert.equal(octets.subarray(8, 12).toString('ascii'), 'WEBP', `${adresse} est une image WebP`)
  assert.ok(statSync(chemin).size <= poidsMax(fichier), `${adresse} pèse ${statSync(chemin).size} octets`)
}

/** Le bloc de la chaîne dans une feuille, et ce qui reste autour, écrit à la main. */
function bloc(feuille: string): { dedans: string; dehors: string } {
  const css = readFileSync(client(feuille), 'utf8')
  const debut = css.indexOf(DEBUT)
  const fin = css.indexOf(FIN)
  assert.ok(debut >= 0 && fin > debut, `${feuille} : les repères des décors peints`)
  return { dedans: css.slice(debut + DEBUT.length, fin), dehors: css.slice(0, debut) + css.slice(fin) }
}

const adresses = (css: string) => [...css.matchAll(/url\((\/decors\/[^)]+)\)/g)].map(m => m[1])

// ── 1. Le calendrier ──────────────────────────────────────────────────────

test('le calendrier a ses douze pages peintes et leurs dorées, en deux tailles, sous leur empreinte', async () => {
  const { PAGES_PEINTES } = await import(client('components/calendrier-peint.ts').href)
  // Sans ordre : `Object.keys` range les clés entières ('10', '11', '12') devant '01'.
  assert.deepEqual(Object.keys(PAGES_PEINTES).sort(), PAGES.map(p => p.mois).sort(), 'les douze mois, et eux seuls')
  for (const p of PAGES) {
    const { page, doree } = PAGES_PEINTES[p.mois]
    for (const [variante, paire] of [
      ['', page],
      ['-doree', doree],
    ] as const) {
      assert.equal(paire.length, 2, `${p.nom}${variante} : grande puis petite`)
      verifierFichier(paire[0], new RegExp(`^page-${p.mois}${variante}-512\\.`))
      verifierFichier(paire[1], new RegExp(`^page-${p.mois}${variante}-256\\.`))
    }
  }
})

// ── 2. Les thèmes peints et les fonds de carte ────────────────────────────

test('chaque thème peint nomme ses décors dans le bloc de la chaîne, et seulement là', () => {
  for (const [cle, images] of Object.entries(THEMES_PEINTS)) {
    const { dedans, dehors } = bloc(`themes/${cle}.css`)
    // Écrit à la main, le reste de la feuille ne lit que les propriétés :
    // une adresse recopiée là serait périmée au premier repeint.
    assert.deepEqual(adresses(dehors), [], `${cle} : une adresse hors du bloc`)
    for (const image of images) {
      const m = new RegExp(`--decor-${image}: url\\(([^)]+)\\);`).exec(dedans)
      assert.ok(m, `${cle} : --decor-${image}`)
      verifierFichier(m[1])
      assert.match(dehors, new RegExp(`var\\(--decor-${image}\\)`), `${cle} : --decor-${image} est porté`)
    }
  }
})

test('les Très Riches Heures montrent la page du mois de Paris : une règle par mois, la page du calendrier', async () => {
  const { dedans, dehors } = bloc('themes/heures.css')
  const { PAGES_PEINTES } = await import(client('components/calendrier-peint.ts').href)
  for (const p of PAGES) {
    const m = new RegExp(`:root\\[data-theme='heures'\\]\\[data-mois='${p.mois}'\\] \\{\\s*--decor-page: url\\(([^)]+)\\);`).exec(dedans)
    assert.ok(m, `${p.nom} : sa règle`)
    // La même image que la grande page du calendrier : un seul fichier, qu'on ait la page ou le thème.
    assert.equal(m[1], PAGES_PEINTES[p.mois].page[0], `${p.nom} : la page du calendrier`)
  }
  assert.match(dehors, /var\(--decor-page\)/)
})

test('les fonds du Triomphe et du Cadran solaire sont peints, dans le bloc de la feuille principale', () => {
  const { dedans, dehors } = bloc('styles.css')
  for (const f of ['triomphe', 'cadran']) {
    const m = new RegExp(`\\.carte-fond\\.fond-${f} \\{ --fond-peint: url\\(([^)]+)\\); \\}`).exec(dedans)
    assert.ok(m, `fond ${f}`)
    verifierFichier(m[1], new RegExp(`^fond-${f}-720\\.`))
  }
  assert.deepEqual(adresses(dehors), [], 'aucune adresse de décor hors du bloc')
  assert.match(dehors, /var\(--fond-peint\)/)
})

test('les six fonds du trésor sont peints, dans le même bloc, chacun son voile écrit à la main', () => {
  const { dedans, dehors } = bloc('styles.css')
  for (const f of ['voie-lactee', 'lanternes', 'abysses', 'bibliotheque', 'dragon', 'cite-celeste']) {
    const m = new RegExp(`\\.carte-fond\\.fond-${f} \\{ --fond-peint: url\\(([^)]+)\\); \\}`).exec(dedans)
    assert.ok(m, `fond ${f}`)
    verifierFichier(m[1], new RegExp(`^fond-${f}-720\\.`))
    // Sa couleur de fond et son voile de nuit vivent hors du bloc : la livraison ne les réécrit pas.
    assert.match(dehors, new RegExp(`\\.carte-fond\\.fond-${f} \\{ background-color: #[0-9a-f]{6}; \\}`), `fond ${f} : sa couleur`)
    assert.match(dehors, new RegExp(`\\.carte-fond\\.fond-${f}::before`), `fond ${f} : son voile`)
  }
})

test('les douze fonds des savoirs sont peints, dans le même bloc, chacun son voile écrit à la main', () => {
  const { dedans, dehors } = bloc('styles.css')
  // Tous ceux que la boutique vend : un fond de plus au catalogue sans sa peinture ferait rougir ici.
  assert.equal(FONDS_EN_BOUTIQUE.length, 12)
  for (const { key: f } of FONDS_EN_BOUTIQUE) {
    const m = new RegExp(`\\.carte-fond\\.fond-${f} \\{ --fond-peint: url\\(([^)]+)\\); \\}`).exec(dedans)
    assert.ok(m, `fond ${f}`)
    verifierFichier(m[1], new RegExp(`^fond-${f}-720\\.`))
    assert.match(dehors, new RegExp(`\\.carte-fond\\.fond-${f} \\{ background-color: #[0-9a-f]{6}; \\}`), `fond ${f} : sa couleur`)
    assert.match(dehors, new RegExp(`\\.carte-fond\\.fond-${f}::before`), `fond ${f} : son voile`)
    // Et la règle commune qui pose son image : sans elle, le bloc nommait une image que rien ne montrait.
    assert.match(dehors, new RegExp(`\\.carte-fond\\.fond-${f}[,\\s][^{]*\\{\\s*background: var\\(--fond-peint\\)`), `fond ${f} : son image posée`)
  }
})

test('les quatre coffres de la semaine sont peints, fermés et ouverts sur le même cadre', async () => {
  // Posés l'un sur l'autre dans la scène de l'ouverture : la caisse ne saute
  // pas quand le couvercle s'ouvre. `rapport` réserve leur place, `fente` dit
  // où filtre la lumière — au milieu de l'image, jamais sur un bord.
  const { COFFRES_PEINTS } = await import(client('components/coffres-peints.ts').href)
  assert.deepEqual(Object.keys(COFFRES_PEINTS).sort(), ['argent', 'bois', 'or', 'royal'])
  for (const [rang, c] of Object.entries<any>(COFFRES_PEINTS)) {
    verifierFichier(c.ferme, new RegExp(`^coffre-${rang}-ferme-480\\.`))
    verifierFichier(c.ouvert, new RegExp(`^coffre-${rang}-ouvert-480\\.`))
    assert.ok(c.rapport > 0.6 && c.rapport < 1.5, `${rang} : son rapport ${c.rapport}`)
    assert.ok(c.fente > 0.3 && c.fente < 0.8, `${rang} : sa fente ${c.fente}`)
  }
})

test('les décors sont tous cités : un décor repeint emporte l’ancien', async () => {
  const { PAGES_PEINTES } = await import(client('components/calendrier-peint.ts').href)
  const { COFFRES_PEINTS } = await import(client('components/coffres-peints.ts').href)
  const cites = new Set<string>()
  for (const { page, doree } of Object.values<any>(PAGES_PEINTES)) for (const f of [...page, ...doree]) cites.add(f)
  for (const { ferme, ouvert } of Object.values<any>(COFFRES_PEINTS)) for (const f of [ferme, ouvert]) cites.add(f)
  for (const feuille of [...Object.keys(THEMES_PEINTS).map(c => `themes/${c}.css`), 'styles.css']) {
    for (const a of adresses(readFileSync(client(feuille), 'utf8'))) cites.add(a)
  }
  const presents = readdirSync(PUBLICS).map(f => `/decors/${f}`)
  assert.deepEqual(
    presents.filter(f => !cites.has(f)),
    [],
    'des fichiers que plus personne ne cite',
  )
  // Et aucune autre feuille ne cite un décor : un thème qui n'est pas peint n'a rien à télécharger.
  for (const f of readdirSync(client('themes/'))) {
    if (f.endsWith('.css') && !(f.replace(/\.css$/, '') in THEMES_PEINTS)) assert.deepEqual(adresses(readFileSync(client(`themes/${f}`), 'utf8')), [], f)
  }
})

test('ce qu’un thème peint fait télécharger à la fois tient dans quelques centaines de kilo-octets', () => {
  // Le ciel n'en porte que deux à la fois (le moment, et celui vers lequel
  // il fond) ; les Heures, le folio et la page du mois.
  const poids = (a: string) => statSync(new URL(a.slice('/decors/'.length), PUBLICS)).size
  for (const [cle, images] of Object.entries(THEMES_PEINTS)) {
    const { dedans } = bloc(`themes/${cle}.css`)
    const tailles = images.map(i => poids(new RegExp(`--decor-${i}: url\\(([^)]+)\\);`).exec(dedans)![1]))
    const page = cle === 'heures' ? Math.max(...adresses(dedans).map(poids)) : 0
    const aLaFois = cle === 'ciel' ? tailles.sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0) : tailles.reduce((a, b) => a + b, 0) + page
    assert.ok(aLaFois <= 450_000, `${cle} : ${aLaFois} octets à la fois`)
  }
})

/**
 * Les couches fixes du décor d'un thème — `html::before`, `body::before`…
 * `#root::after` —, chacune avec ce que sa feuille lui déclare, toutes règles
 * fondues. Sans les images clés ni le bloc du mouvement réduit, qui coupe
 * les animations.
 */
function couchesFixes(cle: string): Map<string, Record<string, string>> {
  const css = readFileSync(client(`themes/${cle}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const regles = css.slice(0, css.indexOf('@keyframes'))
  const couches = new Map<string, Record<string, string>>()
  for (const [, selecteurs, corps] of regles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selecteur of selecteurs.split(',')) {
      const m = new RegExp(`^:root\\[data-theme='${cle}'\\](?: (body|#root))?::(before|after)$`).exec(selecteur.trim())
      if (!m) continue
      const nom = `${m[1] ?? 'html'}::${m[2]}`
      const couche = couches.get(nom) ?? {}
      // Une déclaration finit sa ligne : le motif de la neige, en SVG, porte ses propres deux-points.
      for (const declaration of corps.split(/;\s*\n/)) {
        const i = declaration.indexOf(':')
        if (i > 0) couche[declaration.slice(0, i).trim()] = declaration.slice(i + 1).trim()
      }
      couches.set(nom, couche)
    }
  }
  return couches
}

/** Une couche qui bouge : la carte graphique lui garde un calque à sa taille, tant qu'elle bouge. */
const animees = (couches: Map<string, Record<string, string>>) => [...couches].filter(([, c]) => c.animation).map(([nom]) => nom)

test('le Sommet ne peint qu’une couche en plein écran, et celles qui bougent à la taille de ce qu’elles montrent', () => {
  // Au classement du quiz du jour, sur un téléphone à la densité 2,625, son
  // décor tenait 82 Mo de calques : la montagne, ses lueurs à la taille de la
  // montagne, le voile et la neige, quatre plein-écrans et plus (le
  // 10 novembre 2026, règle `css.md`). 56 depuis, dont 21 pour la neige.
  const couches = couchesFixes('sommet')
  assert.deepEqual([...couches.keys()].sort(), ['#root::after', '#root::before', 'body::after', 'body::before', 'html::before'])
  const pleinEcran = [...couches].filter(([, c]) => c.inset === '0').map(([nom]) => nom)
  assert.deepEqual(pleinEcran, ['html::before'], 'une seule couche couvre l’écran : la montagne')
  // Le voile est peint sur le tableau, dans ses couleurs : ni couche à lui, ni `opacity`.
  const montagne = couches.get('html::before')!
  assert.match(montagne.background, /^var\(--sommet-voile\)[^,]*,\s*var\(--decor-montagne\)/, 'le voile sur la montagne, dans la même couche')
  assert.equal(montagne.animation, undefined, 'la montagne ne bouge pas')
  assert.equal(montagne.opacity, undefined)
  assert.deepEqual(animees(couches).sort(), ['#root::after', '#root::before', 'body::after', 'body::before'])
  // Les lueurs des camps : deux cadres dans la boîte de la montagne, pas la boîte entière.
  for (const nom of ['body::before', '#root::before']) {
    const lueur = couches.get(nom)!
    assert.match(lueur.animation, /^sommet-lanternes /, nom)
    assert.equal(lueur.width, 'calc(var(--sommet-l) * var(--camps-l))', nom)
    assert.equal(lueur.height, 'calc(var(--sommet-h) * var(--camps-h))', nom)
    const part = Number(lueur['--camps-l']) * Number(lueur['--camps-h'])
    assert.ok(part > 0 && part <= 0.15, `${nom} : ${part} de la boîte de la montagne`)
    // Le voile passait sur elles : chacune le porte, découpé par ses lueurs.
    assert.match(lueur.background, /^var\(--sommet-voile\)/, nom)
    assert.equal(lueur.mask, 'var(--lueurs)', nom)
  }
  // Chaque camp tombe dans un des deux cadres, sa lueur entière.
  const cadres = ['body::before', '#root::before'].map(nom => {
    const c = couches.get(nom)!
    const [x, y, l, h] = ['x', 'y', 'l', 'h'].map(k => Number(c[`--camps-${k}`]) * 100)
    return { x, y, l, h }
  })
  const lueurs = [...couches.get('body::before')!['--lueurs'].matchAll(/radial-gradient\(([\d.]+)% ([\d.]+)% at ([\d.]+)% ([\d.]+)%/g)].map(m => m.slice(1).map(Number))
  assert.equal(lueurs.length, 4, 'quatre camps')
  for (const [rx, ry, x, y] of lueurs) {
    assert.ok(
      cadres.some(c => x - rx >= c.x && x + rx <= c.x + c.l && y - ry >= c.y && y + ry <= c.y + c.h),
      `le camp à ${x} % · ${y} % sort de son cadre`,
    )
  }
  // Les drapeaux, à leur taille de toujours, portent le voile de même.
  const drapeaux = couches.get('body::after')!
  assert.match(drapeaux.animation, /^sommet-vent /)
  assert.equal(drapeaux.width, 'var(--drapeaux-l)')
  assert.match(drapeaux.background, /^var\(--sommet-voile\)/)
  assert.equal(drapeaux.mask, 'var(--drapeaux)')
  // La neige ne dépasse l'écran que du pas de son motif, du côté d'où elle vient.
  const neige = couches.get('#root::after')!
  assert.match(neige.animation, /^sommet-neige /)
  assert.deepEqual([neige.top, neige.right, neige.bottom, neige.left], ['-240px', '-240px', '0', '0'])
  assert.match(neige.background, / \/ 240px 240px repeat$/)
  assert.match(readFileSync(client('themes/sommet.css'), 'utf8'), /@keyframes sommet-neige \{\s*to \{\s*transform: translate\(-240px, 240px\);/)
})

test('l’or des Heures scintille dans deux bandes, le long des bords, pas sur tout l’écran', () => {
  // Huit points d'or sur une couche en plein écran : un calque entier que la
  // carte graphique gardait pour eux (42 Mo la page, 33 depuis).
  const couches = couchesFixes('heures')
  assert.deepEqual(animees(couches).sort(), ['#root::after', '#root::before'])
  for (const nom of animees(couches)) {
    const bande = couches.get(nom)!
    assert.match(bande.animation, /^heures-or /, nom)
    assert.equal(bande.inset, undefined, `${nom} : une couche qui scintille en plein écran`)
    assert.equal(bande.width, '10%', nom)
    assert.equal(bande.background.match(/radial-gradient\(/g)?.length, 4, `${nom} : ses quatre points`)
  }
  assert.equal(couches.get('#root::before')!.left, '0')
  assert.equal(couches.get('#root::after')!.right, '0')
})

test('le serveur les sert pour un an, et un décor absent est un 404', async () => {
  // Le client compilé n'existe qu'après le build : un dossier d'une page et d'un décor suffit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  mkdirSync(path.join(dist, 'decors'))
  const nom = readdirSync(PUBLICS).find(f => f.endsWith('.webp'))!
  copyFileSync(new URL(nom, PUBLICS), path.join(dist, 'decors', nom))
  const banc = await demarrer({ clientDist: dist })
  try {
    const r = await fetch(`${banc.url}/decors/${nom}`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'image/webp')
    assert.match(String(r.headers.get('cache-control')), /max-age=31536000.*immutable/)
    // Un décor repeint change d'adresse : l'ancienne n'ouvre pas l'application à sa place.
    const absent = await fetch(`${banc.url}/decors/page-10-512.0000000000.webp`)
    assert.equal(absent.status, 404)
    assert.doesNotMatch(await absent.text(), /<title>FiestApp/)
  } finally {
    await banc.close()
  }
})

// ── 3. L'heure de Paris ───────────────────────────────────────────────────

test('l’horloge lit l’heure de Paris, heure d’été comprise, quelle que soit celle du téléphone', async () => {
  const { heureDeParis } = await import(client('themeJoueur.ts').href)
  // 22 h 30 à Londres un 5 octobre : déjà le 6 à Paris, à minuit et demi.
  assert.deepEqual(heureDeParis(new Date('2026-10-05T22:30:00Z')), { mois: '10', minutes: 30 })
  // La Saint-Sylvestre à 23 h 30 en temps universel : le Nouvel An à Paris (heure d'hiver, +1).
  assert.deepEqual(heureDeParis(new Date('2026-12-31T23:30:00Z')), { mois: '01', minutes: 30 })
  // Le passage à l'heure d'été : 1 h 30 en temps universel, 3 h 30 à Paris.
  assert.deepEqual(heureDeParis(new Date('2026-03-29T01:30:00Z')), { mois: '03', minutes: 3 * 60 + 30 })
})

test('le ciel suit les moments de Paris, et passe de l’un à l’autre en fondu, une heure à cheval sur la bascule', async () => {
  const { momentDuCiel } = await import(client('themeJoueur.ts').href)
  const a = (h: number, m = 0) => momentDuCiel(h * 60 + m)
  assert.deepEqual(a(2), { ciel: 'nuit' }, 'avant l’aube, la nuit de la veille')
  assert.deepEqual(a(7), { ciel: 'aube' })
  assert.deepEqual(a(13), { ciel: 'jour' })
  assert.deepEqual(a(19, 30), { ciel: 'crepuscule' })
  assert.deepEqual(a(23), { ciel: 'nuit' })
  // À la bascule, moitié-moitié ; une demi-heure avant, rien encore — le
  // fondu commence la minute suivante ; une demi-heure après, tout.
  assert.deepEqual(a(5), { ciel: 'nuit', vers: 'aube', fondu: 0.5 })
  assert.deepEqual(a(4, 45), { ciel: 'nuit', vers: 'aube', fondu: 0.25 })
  assert.deepEqual(a(4, 30), { ciel: 'nuit' })
  assert.deepEqual(a(4, 31), { ciel: 'nuit', vers: 'aube', fondu: 1 / 60 })
  assert.deepEqual(a(9, 15), { ciel: 'aube', vers: 'jour', fondu: 0.75 })
  assert.deepEqual(a(18, 29), { ciel: 'jour', vers: 'crepuscule', fondu: 59 / 60 })
  assert.deepEqual(a(18, 30), { ciel: 'crepuscule' }, 'le fondu fini, le moment suivant')
  assert.deepEqual(a(21, 10), { ciel: 'crepuscule', vers: 'nuit', fondu: 40 / 60 })
})

// Le retour du 10 novembre 2026, une photo d'un téléphone Android sous Le
// Ciel, à 18 h 15 : au quiz du jour joué, le haut du classement en friture,
// deux lignes perdues. En plein fondu vers le crépuscule, le décor tenait
// trois calques plein écran — le tableau, celui qui vient, le voile — en plus
// de la page et de son contenu : 52 Mo à la densité d'un téléphone. Node n'a
// pas de carte graphique : ce test garde la feuille, et
// `retours/2026-11-10/reproductions/classement-en-friture.ts` compte les
// calques dans un Chromium (31 Mo depuis, à toute heure du jour).
test('le Ciel tient tout son décor dans une seule couche fixe, même en plein fondu', () => {
  const ciel = readFileSync(client('themes/ciel.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const regles = [...ciel.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ selecteurs: m[1].split(',').map(s => s.trim()), corps: m[2] }))
  const de = (motif: RegExp) => regles.filter(r => r.selecteurs.some(s => motif.test(s)))
  // Le voile n'a plus de couche à lui : il se peint sur le tableau, sa force dans l'alpha de ses couleurs.
  assert.equal(de(/#root::before/).length, 0, 'aucune règle ne pose `#root::before`')
  assert.match(ciel, /--voile-peint:\s*linear-gradient\([^;]*rgb\(14 20 48 \/ var\(--voile\)\)/)
  assert.match(ciel, /--voile:\s*calc\(var\(--voile-de\) \+ \(var\(--voile-vers\) - var\(--voile-de\)\) \* var\(--ciel-fondu, 0\)\)/)
  const tableau = de(/body::before$/)
  assert.ok(tableau.some(r => /background-image:\s*var\(--voile-peint\), var\(--tableau\)/.test(r.corps)))
  // Rien dans cette couche ne la ferait recomposer : ni opacité, ni animation, ni transition.
  for (const r of tableau) assert.doesNotMatch(r.corps, /opacity|animation|transition|transform/, r.selecteurs.join(', '))
  // Pendant une bascule, les deux tableaux se fondent dans la même couche…
  assert.match(
    ciel,
    /@supports \(background-image: -webkit-cross-fade\([^{]*\{\s*:root\[data-theme='ciel'\]\[data-ciel-vers\] body::before \{\s*background-image: var\(--voile-peint\), -webkit-cross-fade\(var\(--tableau\), var\(--tableau-vers\), var\(--ciel-fondu, 0\)\);\s*\}\s*:root\[data-theme='ciel'\]\[data-ciel-vers\] body::after \{\s*content: none;/,
  )
  // … et la couche du second n'existe, pour qui ne sait pas les fondre, que pendant une bascule.
  for (const r of de(/body::after$/)) {
    for (const s of r.selecteurs.filter(s => /body::after$/.test(s))) assert.match(s, /\[data-ciel-vers|\[data-heure-suivie\]/, s)
  }
  // Un moment ne cite que son tableau : un téléphone n'en télécharge qu'un, deux pendant un fondu.
  for (const r of regles) {
    const cites = r.corps.match(/var\(--decor-\w+\)/g) ?? []
    assert.ok(cites.length <= 1, `${r.selecteurs.join(', ')} cite ${cites.length} tableaux`)
  }
  // La lueur du soleil bas, animée, garde un calque : il a la taille de sa tache, pas celle de l'écran.
  for (const moment of ['aube', 'crepuscule']) {
    const [lueur] = de(new RegExp(`^:root\\[data-theme='ciel'\\]\\[data-ciel='${moment}'\\] #root::after$`)).filter(r => r.selecteurs.length === 1)
    assert.ok(lueur, `la lueur : ${moment}`)
    const marges = /inset:\s*([\d.]+)% ([\d.]+)% ([\d.]+)% ([\d.]+)%/.exec(lueur.corps)
    assert.ok(marges, `la lueur de ${moment} dit sa place`)
    const [haut, droite, bas, gauche] = marges.slice(1).map(Number)
    assert.ok(((100 - haut - bas) * (100 - droite - gauche)) / 100 < 20, `la lueur de ${moment} prend moins d'un cinquième de l'écran`)
  }
})

test('les feuilles lisent ce que l’horloge pose : chaque moment du ciel, les deux aiguilles', () => {
  const ciel = readFileSync(client('themes/ciel.css'), 'utf8')
  for (const moment of ['aube', 'jour', 'crepuscule', 'nuit']) {
    assert.match(ciel, new RegExp(`\\[data-ciel='${moment}'\\]`), `ciel : ${moment}`)
    assert.match(ciel, new RegExp(`\\[data-ciel-vers='${moment}'\\]`), `ciel : vers ${moment}`)
  }
  assert.match(ciel, /var\(--ciel-fondu/)
  const horloge = readFileSync(client('themes/horloge.css'), 'utf8')
  assert.match(horloge, /transform: rotate\(var\(--horloge-heures/)
  assert.match(horloge, /transform: rotate\(var\(--horloge-minutes/)
  // Le pas de l'aiguille n'anime qu'une heure suivie : à l'ouverture, elle est déjà à sa place.
  assert.match(horloge, /\[data-heure-suivie\][^{]*\{\s*transition: transform/)
  // Et l'horloge ne tourne que pour ces trois thèmes.
  const module = readFileSync(client('themeJoueur.ts'), 'utf8')
  assert.match(module, /SUIVENT_L_HEURE = new Set\(\['horloge', 'ciel', 'heures'\]\)/)
})

// Les compagnons peints (`server/scripts/anime/livrer-compagnons.ts`) : leurs
// fichiers, servis sous leur empreinte, et ce que chaque forme montre — le
// disque teinté de la première, le décor des suivantes et l'anneau de leur
// rareté, ce qui sort du cercle, la forme ultime et son monde vivant, la
// métamorphose que l'Éclat lui ouvre, la silhouette de ce qu'on n'a pas. Des
// modules du client, rendus en HTML ; un serveur jetable pour la route
// seulement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { demarrer } from './banc'
import { COMPAGNONS, FORMES_DES_COMPAGNONS, METAMORPHOSES, type FormeDeCompagnon } from '../../shared/compagnons'
import { FINITIONS } from '../../shared/profil'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** La feuille du client, sans ses commentaires. */
const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Là où le build prend les fichiers peints, qu'il sert sous `/compagnons/`. */
const PUBLICS = new URL('../../client/public/compagnons/', import.meta.url)

/**
 * Ce qu'un fichier pèse au plus, par taille : comme un portrait. Le plus
 * chargé, les feux d'artifice du chat — de la lumière, avec sa transparence —,
 * monte à 129 Ko en grand ; en petit, l'île en fleurs triomphante et ses
 * pétales qui tourbillonnent, à 45 Ko. Au-delà, c'est un fichier qui n'est pas
 * passé par la chaîne.
 */
const POIDS_MAX: Record<string, number> = { '512': 130_000, '256': 46_000 }

/** Les couches vivantes de chaque forme ultime, celles que `Compagnon.tsx` pose. */
const COUCHES: Record<string, string[]> = { loup: ['rubans'], chat: ['feux', 'lanternes'], tortue: ['brume', 'oiseaux'], luciole: ['lucioles'] }

/** Toutes les formes qui se peignent : les seize — la luciole comprise, livrée le 20 octobre 2026 —, et les quatre métamorphoses — la luciole-aurore, peinte le même jour. */
const PEINTES: readonly FormeDeCompagnon[] = [...FORMES_DES_COMPAGNONS, ...METAMORPHOSES]

/** Le nom de ses fichiers : `loup-ultime`, et sa métamorphose sous son nom dans la chaîne, `loup-eclat-tempete`. */
const nomDesFichiers = (f: FormeDeCompagnon) => `${f.compagnon}-${f.metamorphose ? 'eclat-' : ''}${f.key.slice(f.key.indexOf('-') + 1)}`

/** Les morceaux d'un fichier WebP (un RIFF), dans l'ordre : `VP8X`, `ALPH`, `VP8 `… */
function morceaux(octets: Buffer): string[] {
  const noms: string[] = []
  for (let i = 12; i + 8 <= octets.length; ) {
    noms.push(octets.toString('ascii', i, i + 4))
    const taille = octets.readUInt32LE(i + 4)
    i += 8 + taille + (taille % 2)
  }
  return noms
}

function verifierPaire(paire: [string, string], nom: string) {
  for (const [f, taille] of [
    [paire[0], '512'],
    [paire[1], '256'],
  ] as const) {
    assert.match(f, new RegExp(`^/compagnons/${nom}-${taille}\\.[0-9a-f]{10}\\.webp$`), f)
    const fichier = new URL(f.slice('/compagnons/'.length), PUBLICS)
    assert.ok(existsSync(fichier), `${f} est cité mais absent`)
    const poids = statSync(fichier).size
    assert.ok(poids <= POIDS_MAX[taille], `${f} pèse ${poids} octets`)
  }
}

// ── 1. Les fichiers ───────────────────────────────────────────────────────

test('chaque forme a ses fichiers sous leur empreinte : l’animal et ses trois humeurs ; son décor dès la deuxième ; le monde vivant de la forme ultime ; sa métamorphose, sous sa clé', async () => {
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  // Les métamorphoses, peintes le 13 octobre 2026, ne partaient pas : un loup
  // éclaté ne changeait que de quatre paillettes (le retour du 19 octobre).
  assert.deepEqual(Object.keys(DESSINS).sort(), PEINTES.map(f => f.key).sort(), 'les seize et les quatre métamorphoses, et elles seules')
  for (const f of PEINTES) {
    const d = DESSINS[f.key]
    const nom = nomDesFichiers(f)
    verifierPaire(d.perso, `${nom}-perso`)
    // Ses humeurs, que la niche échange à la révélation : sans elles, elle ne saurait plus réagir.
    assert.deepEqual(Object.keys(d.humeurs ?? {}).sort(), ['depite', 'ravi', 'triomphe'], `${f.key} : ses humeurs`)
    for (const [humeur, paire] of Object.entries<[string, string]>(d.humeurs)) verifierPaire(paire, `${nom}-${humeur}`)
    // La première forme est peinte seule : le disque teinté de son compagnon la reçoit.
    if (f.rang === 0) assert.equal(d.disque, undefined, f.key)
    else verifierPaire(d.disque, `${nom}-disque`)
    if (f.rang === 3 && !f.metamorphose) {
      assert.deepEqual(Object.keys(d.vivant).sort(), [...COUCHES[f.compagnon]].sort(), f.key)
      for (const [cle, paire] of Object.entries<[string, string]>(d.vivant)) verifierPaire(paire, `${nom}-vivant-${cle}`)
    } else assert.equal(d.vivant, undefined, `${f.key} : son monde ne vit qu’à la forme ultime — sa métamorphose a le sien, peint autour d’elle`)
  }
})

test('le monde vivant arrive avec sa transparence : rien à fondre dans la page', async () => {
  // Sa lumière, peinte sur du noir, se posait en `screen` ; mais un mélange ne
  // traverse pas un calque isolé, et la carte d'un joueur en grand montrait le
  // carré noir autour du loup. La chaîne en fait de la transparence : chaque
  // fichier vivant porte sa couche alpha — l'en-tête étendu le dit (`VP8X`,
  // drapeau 0x10) et elle suit (`ALPH`).
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  for (const f of FORMES_DES_COMPAGNONS.filter(x => x.rang === 3)) {
    for (const [cle, paire] of Object.entries<[string, string]>(DESSINS[f.key].vivant)) {
      for (const adresse of paire) {
        const octets = readFileSync(new URL(adresse.slice('/compagnons/'.length), PUBLICS))
        assert.equal(octets.toString('ascii', 12, 16), 'VP8X', `${f.key} ${cle} : ${adresse}`)
        assert.ok((octets[20] & 0x10) !== 0 && morceaux(octets).includes('ALPH'), `${f.key} ${cle} : ${adresse} est opaque`)
      }
    }
  }
  // Et rien ne se mélange plus : ni la page, ni le composant.
  const source = readFileSync(new URL('../../client/src/components/Compagnon.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /mix-blend|cp-lumiere/)
  assert.doesNotMatch(CSS, /\.cp[ .][^{]*\{[^}]*mix-blend-mode/)
})

test('les fichiers peints sont tous cités : un compagnon repeint emporte l’ancien', async () => {
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  const cites = new Set<string>()
  for (const d of Object.values<any>(DESSINS))
    for (const f of [...(d.disque ?? []), ...d.perso, ...Object.values<string[]>(d.humeurs ?? {}).flat(), ...Object.values<string[]>(d.vivant ?? {}).flat()]) cites.add(f)
  const presents = readdirSync(PUBLICS).map(f => `/compagnons/${f}`)
  assert.deepEqual(
    presents.filter(f => !cites.has(f)),
    [],
    'des fichiers que plus personne ne cite',
  )
})

test('le serveur les sert pour un an, et un fichier absent est un 404', async () => {
  // Le client compilé n'existe qu'après le build : un dossier d'une page et d'un fichier suffit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  mkdirSync(path.join(dist, 'compagnons'))
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  const nom = DESSINS['cp:loup-louveteau'].perso[1].slice('/compagnons/'.length)
  copyFileSync(new URL(nom, PUBLICS), path.join(dist, 'compagnons', nom))
  const banc = await demarrer({ clientDist: dist })
  try {
    const r = await fetch(`${banc.url}/compagnons/${nom}`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'image/webp')
    assert.match(String(r.headers.get('cache-control')), /max-age=31536000.*immutable/)
    // Repeint, il change d'adresse : l'ancienne n'ouvre pas l'application à sa place.
    const absent = await fetch(`${banc.url}/compagnons/loup-louveteau-perso-256.0000000000.webp`)
    assert.equal(absent.status, 404)
    assert.doesNotMatch(await absent.text(), /<title>FiestApp/)
  } finally {
    await banc.close()
  }
})

// ── 2. Ce que chaque forme montre ─────────────────────────────────────────

/** Une forme rendue, ses fichiers inscrits : ce que fait la page qui les charge. */
async function compagnon(props: object): Promise<string> {
  await import(url('components/compagnons-peints.ts'))
  return rendu('components/Compagnon', 'Compagnon', props)
}

test('il grandit sous nos yeux : le disque teinté, puis son décor, ce qui sort du cercle, et l’anneau de sa rareté', async () => {
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  // La première forme : seule sur le disque teinté du loup, sous un simple filet, rien qui sorte.
  const louveteau = await compagnon({ cle: 'cp:loup-louveteau' })
  assert.match(louveteau, /^<svg class="pt cp cp-loup" viewBox="0 0 100 100" role="img" aria-label="Le louveteau"><title>Le louveteau<\/title>/)
  assert.ok(louveteau.includes(DESSINS['cp:loup-louveteau'].perso[1]), 'la petite taille, à la taille du texte')
  assert.match(louveteau, /stop-color="#9fc1e6"/)
  assert.match(louveteau, /stroke="#ffffff" stroke-opacity="\.22"/)
  assert.doesNotMatch(louveteau, /pt-debord|pt-aura|cp-vivant/)
  // La deuxième : son décor, sous l'anneau rare.
  const jeune = await compagnon({ cle: 'cp:loup-jeune' })
  assert.ok(jeune.includes(DESSINS['cp:loup-jeune'].disque[1]))
  assert.match(jeune, /stroke="#5fa8ff" stroke-width="2\.2"/)
  assert.doesNotMatch(jeune, /pt-debord/)
  // La troisième sort du cercle par le haut, sous l'anneau épique.
  const adulte = await compagnon({ cle: 'cp:loup-adulte' })
  assert.match(adulte, /stroke="#b77bff"/)
  assert.match(adulte, /<g class="pt-debord" mask="url\(#[^)]+_dehors\)">/)
  // La forme ultime du loup : l'anneau légendaire, son aura, ses étoiles, et ses rubans d'étoiles qui tournent hors du cercle.
  const ultime = await compagnon({ cle: 'cp:loup-ultime', grand: true })
  assert.match(ultime, /stroke="#f2b84b"/)
  assert.match(ultime, /class="pt-aura"/)
  assert.equal(ultime.match(/class="pt-etoile"/g)?.length, 5)
  assert.match(ultime, /<g class="pt-debord cp-vivant cp-tourne">/)
  assert.ok(ultime.includes(DESSINS['cp:loup-ultime'].vivant.rubans[0]), 'en grand, ses grands fichiers')
})

test('le chat et la tortue sortent du cercle tout entiers à leur forme ultime, leur monde avec eux', async () => {
  const esprit = await compagnon({ cle: 'cp:chat-esprit' })
  // Tout entier dehors — la liste, qui cache ce qui déborde, garde celui du disque.
  assert.match(esprit, /<g class="pt-debord" mask="url\(#[^)]+_entier\)"><image href="\/compagnons\/chat-esprit-perso-256\.[0-9a-f]{10}\.webp" x="-22" y="-22" width="144" height="144"\/><\/g>/)
  // Ses lanternes et ses flammes touchent le bord de l'image peinte : il
  // s'estompe avant lui, sans quoi la coupe traçait un carré autour de lui.
  assert.match(esprit, /<mask id="[^"]+_entier"[^>]*><g filter="url\(#[^)]+_bord\)"><rect x="-17" y="-17" width="134" height="134" fill="#fff"\/><\/g><\/mask>/)
  const silhouette = await compagnon({ cle: 'cp:chat-esprit', verrouille: true })
  assert.match(silhouette, /<g class="pt-debord" mask="url\(#[^)]+_entier\)"><rect [^>]*mask="url\(#[^)]+_forme\)"/, 'sa silhouette aussi')
  assert.doesNotMatch(esprit, /pt-etoile/, 'ses lanternes lui suffisent')
  // Ses feux d'artifice derrière lui, ses lanternes devant, qui montent.
  const feux = esprit.indexOf('cp-pulse')
  const lanternes = esprit.indexOf('cp-monte')
  const lui = esprit.indexOf('x="-22" y="-22"')
  assert.ok(feux > 0 && lanternes > 0 && feux < lui && lui < lanternes, 'les feux derrière, les lanternes devant')
  // La brume de la tortue dérive, ses oiseaux volent.
  const ile = await compagnon({ cle: 'cp:tortue-ile' })
  assert.match(ile, /<g class="pt-debord cp-vivant cp-derive">/)
  assert.match(ile, /<g class="pt-debord cp-vivant cp-vole">/)
})

test('sa métamorphose, une forme de plus : son décor, lui tout entier hors du disque, l’aura et l’anneau à sa couleur, ni monde vivant ni étoiles', async () => {
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  const rare = DESSINS['cp:loup-tempete']
  const tempete = await compagnon({ cle: 'cp:loup-tempete' })
  assert.match(tempete, /^<svg class="pt cp cp-loup" viewBox="0 0 100 100" role="img" aria-label="Le loup-tempête"><title>Le loup-tempête<\/title>/)
  assert.ok(tempete.includes(rare.disque[1]) && tempete.includes(rare.perso[1]), 'son décor et lui, en petit')
  assert.ok(!tempete.includes(DESSINS['cp:loup-ultime'].perso[1]) && !tempete.includes(DESSINS['cp:loup-ultime'].disque[1]), 'rien du loup des étoiles')
  // Tout entier hors du disque, estompé avant le bord de son image ; une liste, qui cache ce qui déborde, garde celui du disque.
  assert.ok(tempete.includes(`<g class="pt-debord" mask="url(#`) && tempete.includes(`_entier)"><image href="${rare.perso[1]}" x="-22" y="-22" width="144" height="144"/></g>`))
  // L'aura et l'anneau à sa couleur ; son monde est le sien : ni rubans, ni étoiles.
  assert.match(tempete, /stroke="#4fe3c1" stroke-width="2\.2"/)
  assert.match(tempete, /class="pt-aura"/)
  assert.match(tempete, /stop-color="#4fe3c1" stop-opacity="\.5"/)
  assert.doesNotMatch(tempete, /cp-vivant|pt-etoile|#f2b84b/)
  assert.ok((await compagnon({ cle: 'cp:loup-tempete', grand: true })).includes(rare.perso[0]), 'en grand, ses grands fichiers')
  // Le chat-soleil et l'île en fleurs de même, chacun sa couleur.
  for (const [cle, couleur] of [
    ['cp:chat-soleil', '#ffcf6b'],
    ['cp:tortue-fleurs', '#fff1b8'],
  ]) {
    const html = await compagnon({ cle })
    assert.ok(html.includes(DESSINS[cle].perso[1]), cle)
    assert.match(html, new RegExp(`stroke="${couleur}"`), cle)
    assert.doesNotMatch(html, /cp-vivant/, `${cle} : ses lanternes, sa brume restent au monde de sa forme ultime`)
  }
  // Pas encore à lui — l'album : sa silhouette dorée, tout entière hors du disque.
  const verrou = await compagnon({ cle: 'cp:loup-tempete', verrouille: true })
  assert.match(verrou, /aria-label="Le loup-tempête — pas encore à toi"/)
  assert.match(verrou, /<g class="pt-debord" mask="url\(#[^)]+_entier\)"><rect [^>]*mask="url\(#[^)]+_forme\)"/)
  assert.doesNotMatch(verrou, /pt-aura/)
  // Porté sous une finition, son cercle prend la place de son anneau, comme pour toute forme.
  const porte = await compagnon({ cle: 'cp:loup-tempete', finition: 'or' })
  assert.match(porte, /class="lg-cercle lg-cercle-or"/)
  assert.doesNotMatch(porte, /stroke="#4fe3c1"/)
})

test('pas encore à lui : sa silhouette dorée sur un disque sombre — ni aura, ni monde vivant ; porté, la finition devient son cercle', async () => {
  const verrou = await compagnon({ cle: 'cp:tortue-ile', verrouille: true })
  assert.match(verrou, /aria-label="La tortue-île — pas encore à toi"/)
  assert.match(verrou, /stop-color="#3a2c24"/)
  assert.match(verrou, /mask="url\(#[^)]+_forme\)"/)
  assert.doesNotMatch(verrou, /pt-aura|cp-vivant/)
  // Porté par un profil de la finition Or : son cercle, à la place de l'anneau de rareté.
  const porte = await compagnon({ cle: 'cp:chat-jeune', finition: 'or' })
  assert.match(porte, /class="lg-cercle lg-cercle-or"/)
  assert.doesNotMatch(porte, /stroke="#5fa8ff"/)
  // En Mat, rien ne change : l'anneau de sa rareté reste.
  assert.match(await compagnon({ cle: 'cp:chat-jeune', finition: 'mat' }), /stroke="#5fa8ff"/)
})

test('porté sous l’Argent ou l’Or, on le voit encore : le cercle de la finition passe sous son disque, comme sous un portrait', async () => {
  // Le cercle d'un métal est un disque plein, dont le disque peint ne laisse
  // voir que le bord (`Cercle.tsx`). Posé par-dessus la scène, il cachait
  // l'animal entier — « cela remplit le cercle intégralement et on ne voit
  // plus l'image » (le retour du propriétaire du 14 octobre 2026) ; Holo, un
  // simple anneau, passait.
  for (const f of PEINTES) {
    // Mat n'a pas de cercle : l'anneau de sa rareté reste (plus haut).
    for (const finition of FINITIONS.filter(x => x !== 'mat')) {
      const html = await compagnon({ cle: f.key, finition })
      const cercle = html.indexOf(`<g class="lg-cercle lg-cercle-${finition}">`)
      const scene = html.indexOf(' clip-path="url(#')
      assert.ok(cercle > 0, `${f.key} en ${finition} : son cercle`)
      assert.ok(scene > cercle, `${f.key} en ${finition} : son cercle passe sous le disque, sinon il le couvre`)
    }
  }
})

/** Chaque identifiant d'un rendu, avec l'élément qui le porte tout entier : ce qu'un `url(#…)` de la page ira chercher. */
const definitions = (html: string) =>
  new Map([...html.matchAll(/<([a-zA-Z]+)\b[^>]*?\sid="([^"]*)"[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g)].map(m => [m[2], m[0]]))

/** Tous les états d'une forme : chaque finition ou aucune, à lui ou non, en grand ou non. */
const ETATS = [undefined, ...FINITIONS].flatMap(finition => [false, true].flatMap(verrouille => [false, true].map(grand => ({ finition, verrouille, grand }))))

test('rendus chacun dans sa racine, comme sur une planche, deux états d’un compagnon ne se prennent jamais un dégradé', async () => {
  // Deux racines React numérotent chacune `useId` depuis zéro, et le premier
  // dégradé d'un nom gagne : sur une planche, l'Or d'un compagnon avait le
  // dégradé de l'Argent posé avant lui.
  const argent = definitions(await compagnon({ cle: 'cp:loup-jeune', finition: 'argent' }))
  for (const id of definitions(await compagnon({ cle: 'cp:loup-jeune', finition: 'or' })).keys()) assert.ok(!argent.has(id), id)
  // Quels que soient la forme — sa métamorphose comprise, qui peint autrement le même rang — et son état, un nom ne dit jamais deux choses.
  const vus = new Map<string, string>()
  for (const f of PEINTES) {
    for (const etat of ETATS) {
      for (const [id, definition] of definitions(await compagnon({ cle: f.key, ...etat }))) {
        const avant = vus.get(id)
        if (avant) assert.equal(definition, avant, `${id}, ${JSON.stringify(etat)}`)
        vus.set(id, definition)
      }
    }
  }
})

test('porté, il prend la place de l’emoji comme un portrait — éclaté, ses paillettes sur la forme même —, et ce qui l’anime se fige s’il le faut', async () => {
  await import(url('components/compagnons-peints.ts'))
  const avatar = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'cp:loup-jeune', finition: 'mat' })
  assert.match(avatar, /^<span class="av av-portrait"><span class="av-emoji"><svg class="pt cp cp-loup"/)
  assert.doesNotMatch(avatar, /🦊/, 'l’emoji ne se montre plus dessous')
  // Éclatée, sa forme ultime reste la sienne, sous les paillettes de l'Éclat : sa
  // métamorphose ne la remplace pas, elle se choisit (le 19 octobre 2026, « je
  // veux que ce soit un choix »). Plus jeune, de même.
  const { DESSINS } = await import(url('components/compagnons-peints.ts'))
  for (const cle of ['cp:loup-ultime', 'cp:loup-jeune']) {
    const eclate = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: cle, finition: 'mat', eclat: true })
    assert.match(eclate, /^<span class="av av-portrait av-eclat"><span class="av-emoji"><svg class="pt cp cp-loup"/, cle)
    assert.ok(eclate.includes(DESSINS[cle].perso[1]), cle)
    assert.ok(!eclate.includes(DESSINS['cp:loup-tempete'].perso[1]), `${cle} : rien du loup-tempête`)
  }
  // Sa métamorphose portée prend la place de l'emoji comme ses formes ; l'Éclat qui la lui a ouverte y pose aussi ses paillettes.
  const tempete = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'cp:loup-tempete', finition: 'mat', eclat: true })
  assert.match(tempete, /^<span class="av av-portrait av-eclat"><span class="av-emoji"><svg class="pt cp cp-loup"/)
  assert.ok(tempete.includes(DESSINS['cp:loup-tempete'].perso[1]))
  // Son monde vivant bouge par `transform` et `opacity`.
  for (const m of ['tourne', 'pulse', 'monte', 'derive', 'vole']) assert.match(CSS, new RegExp(`\\.cp \\.cp-${m} \\{[^}]*animation: cp-${m} `), m)
  // Le système demande moins de mouvement : tout ce qui est dans un portrait s'arrête, le compagnon compris.
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.pt \* \{ animation: none !important; \}/)
  // Un catalogue, trois compagnons : chacun son allure dans le composant.
  const source = readFileSync(new URL('../../client/src/components/Compagnon.tsx', import.meta.url), 'utf8')
  for (const c of COMPAGNONS) assert.match(source, new RegExp(`\\n  ${c.key}: \\{`), c.key)
})

// Les ornements de la niche, peints (`server/scripts/anime/ornements.ts`) —
// le souhait du propriétaire, le 19 octobre 2026 : « Dessinés comme sur la
// maquette […] et aussi des versions vraiment très jolies avec des peintures
// payantes de différents styles. On choisit lesquels montrer » ; le
// Féerique, choisi le 20 sur la planche de l'essai. Leurs fichiers, servis
// sous leur empreinte ; chacun à son plan sur la niche — le halo au fond, le
// lierre derrière elle, l'or de l'arche sur son cadre, sous la guirlande, et
// son étoile devant tout — ; et, ornement par ornement, le choix de le
// montrer peint, dessiné, ou de le cacher. Des modules du client, rendus en
// HTML ; un serveur jetable pour la route seulement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { demarrer } from './banc'
import { ORNEMENTS, STYLES_PEINTS } from '../../shared/ornements'
import { compagnon } from '../../shared/compagnons'
import { isValidSlug } from '../../shared/space'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Un composant de la niche, rendu tel que la page le montre. */
async function rendre(composant: string, props: object): Promise<string> {
  const module = await import(url('components/Niche.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const peints = async () => (await import(url('components/ornements-peints.ts'))).ORNEMENTS_PEINTS

/** Là où le build prend les fichiers peints, qu'il sert sous `/ornements/`. */
const PUBLICS = new URL('../../client/public/ornements/', import.meta.url)

/**
 * Ce qu'un fichier pèse au plus, par taille. Les plus lourds, le halo — de la
 * lumière, toute en transparence — et le lierre touffu : 32 Ko en grand, 13 en
 * petit. Au-delà, c'est un fichier qui n'est pas passé par la chaîne.
 */
const POIDS_MAX: Record<string, number> = { '512': 40_000, '256': 16_000 }

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

// ── 1. Les fichiers ───────────────────────────────────────────────────────

test('chaque style peint a ses calques pour les quatre ornements, sous leur empreinte, en deux tailles, avec leur transparence', async () => {
  const ORNEMENTS_PEINTS = await peints()
  assert.deepEqual(Object.keys(ORNEMENTS_PEINTS), [...STYLES_PEINTS])
  for (const style of STYLES_PEINTS) {
    // Un style se livre entier, ou pas : à moitié peint, il montrerait la moitié de la légende.
    assert.deepEqual(Object.keys(ORNEMENTS_PEINTS[style]), ORNEMENTS.map(o => o.key), style)
    for (const o of ORNEMENTS) {
      for (const c of ORNEMENTS_PEINTS[style][o.key]) {
        for (const [f, taille] of [
          [c.fichiers[0], '512'],
          [c.fichiers[1], '256'],
        ]) {
          assert.match(f, new RegExp(`^/ornements/[a-z]+-${style}-${taille}\\.[0-9a-f]{10}\\.webp$`), f)
          const fichier = new URL(f.slice('/ornements/'.length), PUBLICS)
          assert.ok(existsSync(fichier), `${f} est cité mais absent`)
          assert.ok(statSync(fichier).size <= POIDS_MAX[taille], `${f} pèse ${statSync(fichier).size} octets`)
          // Posé par-dessus la niche, un calque opaque la cacherait toute.
          const octets = readFileSync(fichier)
          assert.equal(octets.toString('ascii', 12, 16), 'VP8X', f)
          assert.ok((octets[20] & 0x10) !== 0 && morceaux(octets).includes('ALPH'), `${f} est opaque`)
        }
      }
    }
  }
  // Chacun à son plan : l'étoile de l'arche, découpée de son cadre, passe devant la lampe du sommet ; l'or, sous celles des flancs.
  assert.deepEqual(
    Object.fromEntries(ORNEMENTS.map(o => [o.key, ORNEMENTS_PEINTS.feerique[o.key].map((c: { plan: string }) => c.plan)])),
    { guirlande: ['devant'], lierre: ['derriere'], arche: ['cadre', 'devant'], halo: ['fond'] },
  )
})

test('les fichiers peints sont tous cités : un ornement repeint emporte l’ancien', async () => {
  const ORNEMENTS_PEINTS = await peints()
  const cites = new Set<string>(Object.values<any>(ORNEMENTS_PEINTS).flatMap(s => Object.values<any>(s).flatMap(cs => cs.flatMap((c: { fichiers: string[] }) => c.fichiers))))
  assert.deepEqual(
    readdirSync(PUBLICS)
      .map(f => `/ornements/${f}`)
      .filter(f => !cites.has(f)),
    [],
    'des fichiers que plus personne ne cite',
  )
})

test('le serveur les sert pour un an, un fichier absent est un 404, et aucun espace ne s’appelle « ornements »', async () => {
  // Un espace à ce nom n'aurait plus d'adresse : le dossier passe devant lui.
  assert.equal(isValidSlug('ornements'), false)
  // Le client compilé n'existe qu'après le build : un dossier d'une page et d'un fichier suffit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  mkdirSync(path.join(dist, 'ornements'))
  const nom = (await peints()).feerique.guirlande[0].fichiers[1].slice('/ornements/'.length)
  copyFileSync(new URL(nom, PUBLICS), path.join(dist, 'ornements', nom))
  const banc = await demarrer({ clientDist: dist })
  try {
    const r = await fetch(`${banc.url}/ornements/${nom}`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'image/webp')
    assert.match(String(r.headers.get('cache-control')), /max-age=31536000.*immutable/)
    const absent = await fetch(`${banc.url}/ornements/guirlande-feerique-256.0000000000.webp`)
    assert.equal(absent.status, 404)
    assert.doesNotMatch(await absent.text(), /<title>FiestApp/)
  } finally {
    await banc.close()
  }
})

// ── 2. Sur la niche ───────────────────────────────────────────────────────

/** Où commence chaque morceau de la niche rendue : -1 quand il n'y est pas. */
const ou = (html: string, quoi: string) => html.indexOf(quoi)

test('peints d’office, chacun à son plan : le halo au fond, le lierre derrière elle, l’or sur son cadre, puis la guirlande, puis l’étoile', async () => {
  const P = (await peints()).feerique
  const html = await rendre('Niche', { compagnon: 'loup', rang: 3, paliers: 4 })
  const cadre = ou(html, '<span class="niche-cadre orne-or"')
  assert.ok(cadre > 0, 'l’arche dorée garde son cadre d’or, sous l’or peint')
  // La niche du coin de la page prend leurs grands fichiers, comme le dessin de son compagnon.
  const [halo, lierre, arche, guirlande, etoile] = [P.halo[0], P.lierre[0], P.arche[0], P.guirlande[0], P.arche[1]].map(c => ou(html, `href="${c.fichiers[0]}"`))
  assert.ok(halo > 0 && halo < lierre && lierre < cadre, 'le halo puis le lierre, posés avant le cadre : il passe dessus')
  assert.ok(cadre < arche && arche < guirlande && guirlande < etoile, 'l’or, puis la guirlande, puis l’étoile devant tout')
  // Un calque peint se pose dans le repère de la chaîne : 120 unités, la niche (54 × 62) au centre.
  assert.match(html, /<image class="orne-peint orne-peint-guirlande" href="[^"]+" x="-33" y="-29" width="120" height="120"><\/image>/)
  // Son ciel scintille toujours, peint ou dessiné ; le halo peint respire, comme celui du dessin.
  assert.match(html, /class="orne orne-halo"/)
  assert.match(html, /class="orne-peint orne-peint-halo"/)
  // Rien de la maquette ne se mêle à la peinture.
  assert.doesNotMatch(html, /orne-guirlande"|orne-lierre"|orne-arche"|class="niche-halo"/)
  // En petit — la carte d'un joueur, le bouton du profil —, ses petits fichiers.
  const mini = await rendre('NicheEnMiniature', { niche: { compagnon: 'loup', rang: 3, paliers: 4 }, taille: 54 })
  assert.ok(mini.includes(`href="${P.guirlande[0].fichiers[1]}"`) && !mini.includes(P.guirlande[0].fichiers[0]), 'sa petite taille')
})

test('un style par ornement, mêlés comme il veut : dessiné, il reste celui de la maquette ; caché, il n’est nulle part', async () => {
  const P = (await peints()).feerique
  const html = await rendre('Niche', { compagnon: 'chat', rang: 3, paliers: 4, ornements: { guirlande: 'dessin', lierre: 'cache', halo: 'dessin' } })
  assert.match(html, /class="orne orne-guirlande"/, 'sa guirlande dessinée')
  assert.ok(!html.includes(P.guirlande[0].fichiers[0]), 'pas la peinte')
  assert.ok(!html.includes('lierre-feerique') && !html.includes('orne-lierre'), 'le lierre caché')
  assert.match(html, /class="niche-halo"/, 'le halo dessiné, derrière elle')
  assert.ok(html.includes(`href="${P.arche[0].fichiers[0]}"`) && html.includes(`href="${P.arche[1].fichiers[0]}"`), 'l’arche, peinte d’office')
})

// ── 3. Son choix ──────────────────────────────────────────────────────────

test('« Sa niche s’embellit », dans « Décorer » : chaque ornement gagné, ses trois choix — Féerique, Dessin, Caché —, chacun son aperçu', async () => {
  const P = (await peints()).feerique
  const html = await rendre('SaNicheSEmbellit', { niche: { compagnon: 'loup', rang: 3, paliers: 2, ornements: { lierre: 'dessin' } }, c: compagnon('loup'), busy: false, onOrner: () => {} })
  const groupes = [...html.matchAll(/<div class="niche-orne" role="group" aria-labelledby="([^"]+)">([\s\S]*?)<\/div><\/div>/g)]
  assert.equal(groupes.length, 2, 'les deux qu’il a gagnés, et eux seuls')
  for (const [g, titre, presse] of [
    [groupes[0], 'Amis pour la vie', 'Féerique'],
    [groupes[1], 'Complices', 'Dessin'],
  ] as const) {
    // Le groupe se nomme par son ornement ; chaque choix, par son style — un nom fixe, l'état par aria-pressed (`design.test.ts`).
    assert.ok(html.includes(`id="${g[1]}"><b>${titre}</b>`), titre)
    const choix = [...g[2].matchAll(/<button type="button" class="niche-orne-style" aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)]
    assert.deepEqual(
      choix.map(c => [/<span class="niche-orne-style-nom">([^<]+)<\/span>/.exec(c[2])?.[1], c[1]]),
      ['Féerique', 'Dessin', 'Caché'].map(s => [s, String(s === presse)]),
      titre,
    )
  }
  // Chaque choix se voit avant de se toucher : l'ornement seul sur une petite niche vide, peint, dessiné, ou rien.
  const guirlande = groupes[0][2]
  assert.ok(guirlande.includes(`href="${P.guirlande[0].fichiers[1]}"`), 'son aperçu peint')
  assert.match(guirlande, /class="orne orne-guirlande"/, 'son aperçu dessiné')
  assert.match(html, /Inséparables · à 10[\s ]?000/, 'le suivant s’annonce')
})

test('le halo peint respire comme celui du dessin, et s’arrête quand le téléphone demande moins de mouvement', () => {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const bloc = css.slice(css.indexOf('.niche-ornements'))
  assert.ok(/\.orne-peint-halo \{[^}]*animation: orne-halo /.test(bloc), 'le halo peint respire')
  assert.ok(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.orne-peint-halo[^@]*animation: none/.test(bloc), 'et s’arrête au mouvement réduit')
})

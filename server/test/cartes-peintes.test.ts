// Les cartes peintes de l'Expédition (`server/scripts/anime/cartes.ts`) : les
// vingt-trois cartes sans légendaire, chacune son illustration — « les cartes
// c'est des rectangles pas très jolis, ça serait pas possible de faire de
// vraies cartes ? Ça rajouterait à l'immersion » (le propriétaire, le 18
// octobre 2026). Leurs fichiers, sous leur empreinte et d'un poids qu'un
// téléphone porte ; la table qui les cite ; aucun fichier que plus personne ne
// cite ; servis un an ; et la carte dessinée qui les montre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { demarrer } from './banc'
import { CARTES_DES_RENCONTRES, carteDeRencontre } from '../../shared/rencontres'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url)

/** Là où le build prend les cartes, qu'il sert sous `/cartes/`. */
const PUBLICS = new URL('../../client/public/cartes/', import.meta.url)

/** La table des cartes peintes, telle que la chaîne l'écrit. */
const peintes = async (): Promise<Record<string, readonly [string, string]>> => (await import(client('components/cartes-peintes.ts').href)).CARTES_PEINTES

/**
 * Ce qu'une carte pèse au plus : la grande, levée seule à l'écran ; la petite,
 * cinq dans la main, toutes dans le codex. Au-delà, c'est un fichier qui n'est
 * pas passé par la chaîne (un PNG, une image en 1K).
 */
const poidsMax = (taille: '480' | '240') => (taille === '480' ? 40_000 : 14_000)

test('chaque carte sans légendaire a son illustration, en deux tailles, sous son empreinte', async () => {
  const table = await peintes()
  const aPeindre = CARTES_DES_RENCONTRES.filter(c => !c.legendaire).map(c => c.cle)
  // Toutes, et elles seules : une carte de plus au catalogue sans sa peinture rougirait ici. Celle d'un légendaire est son médaillon.
  assert.deepEqual(Object.keys(table).sort(), [...aPeindre].sort())
  for (const [cle, paire] of Object.entries(table)) {
    assert.equal(paire.length, 2, `${cle} : la grande, puis la petite`)
    for (const [adresse, taille] of [
      [paire[0], '480'],
      [paire[1], '240'],
    ] as const) {
      assert.match(adresse, new RegExp(`^/cartes/${cle}-${taille}\\.[0-9a-f]{10}\\.webp$`), adresse)
      const chemin = new URL(adresse.slice('/cartes/'.length), PUBLICS)
      assert.ok(existsSync(chemin), `${adresse} est cité mais absent`)
      assert.equal(readFileSync(chemin).subarray(8, 12).toString('ascii'), 'WEBP', `${adresse} est une image WebP`)
      assert.ok(statSync(chemin).size <= poidsMax(taille), `${adresse} pèse ${statSync(chemin).size} octets`)
    }
  }
})

test('les cartes peintes sont toutes citées : une carte repeinte emporte l’ancienne', async () => {
  const cites = new Set(Object.values(await peintes()).flat())
  assert.deepEqual(
    readdirSync(PUBLICS)
      .map(f => `/cartes/${f}`)
      .filter(f => !cites.has(f)),
    [],
    'des fichiers que plus personne ne cite',
  )
})

test('la carte dessinée montre sa peinture — la grande levée, la petite ailleurs ; une carte de légendaire garde son médaillon', async () => {
  const table = await peintes()
  const { CarteDessinee } = (await import(client('views/RencontresDExpedition.tsx').href)) as { CarteDessinee: (p: Record<string, unknown>) => React.ReactNode }
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendre = (cle: string, taille: string) => renderToStaticMarkup(React.createElement(CarteDessinee, { c: carteDeRencontre(cle), taille }))
  const art = (html: string) => /<span class="exp-vc-art">([\s\S]*?)<\/span>/.exec(html)?.[1] ?? ''
  assert.equal(art(rendre('concentration', 'main')), `<img class="exp-vc-peinture" src="${table.concentration[1]}" alt="" loading="lazy" decoding="async"/>`)
  assert.match(art(rendre('concentration', 'rangee')), new RegExp(`src="${table.concentration[1]}"`))
  assert.match(art(rendre('concentration', 'levee')), new RegExp(`src="${table.concentration[0]}"`))
  // Le dessin d'avant ne s'y pose plus par-dessus.
  assert.doesNotMatch(rendre('concentration', 'main'), /class="icon/)
  assert.doesNotMatch(rendre('tresor', 'main'), /exp-vc-peinture/)
  assert.match(rendre('tresor', 'main'), /exp-medaillon exp-visage-joker/)
})

test('le serveur les sert pour un an, et une carte absente est un 404', async () => {
  // Le client compilé n'existe qu'après le build : un dossier d'une page et d'une carte suffit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  mkdirSync(path.join(dist, 'cartes'))
  const nom = readdirSync(PUBLICS).find(f => f.endsWith('.webp'))!
  copyFileSync(new URL(nom, PUBLICS), path.join(dist, 'cartes', nom))
  const banc = await demarrer({ clientDist: dist })
  try {
    const r = await fetch(`${banc.url}/cartes/${nom}`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'image/webp')
    assert.match(String(r.headers.get('cache-control')), /max-age=31536000.*immutable/)
    // Une carte repeinte change d'adresse : l'ancienne n'ouvre pas l'application à sa place.
    const absent = await fetch(`${banc.url}/cartes/concentration-480.0000000000.webp`)
    assert.equal(absent.status, 404)
    assert.doesNotMatch(await absent.text(), /<title>FiestApp/)
  } finally {
    await banc.close()
  }
})

// Les dessins des légendaires et des Divins, chargés à la demande
// (`client/src/components/medaillons.ts`) : ce qu'un invité anonyme ne
// télécharge pas, et ce que devient la page quand ils ne viennent pas — un
// fichier en 404 après un redéploiement, une 4G qui ne répond plus.
// Pas de serveur : des modules du client, rendus en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/**
 * Une instance neuve du module des dessins : chaque test simule sa propre
 * panne, et l'état du module vaut pour toute la page — comme au navigateur.
 */
async function medaillons(instance = ''): Promise<Medaillons> {
  return await import(`${url('components/medaillons.ts')}${instance && `?${instance}`}`)
}

/**
 * Ce que le test lit du module — écrit à la main : le typecheck du serveur
 * ne compile pas le JSX du client, qu'un `typeof import` lui ferait suivre.
 */
interface Medaillons {
  chargeur: { importer: () => Promise<unknown> }
  chargerDessins(): Promise<void>
  chargerDessinsAuPlus(ms?: number): Promise<void>
  complets(): boolean
  ATTENTE_MAX_DESSINS: number
}

/** Un composant du client, rendu en HTML — la même recette que `eclat.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// ── 1. Le chemin de l'invité ──────────────────────────────────────────────

/** Les fichiers qu'une page importe statiquement, de proche en proche. */
function importsStatiques(depart: string): Set<string> {
  const vus = new Set<string>()
  const pile = [depart]
  while (pile.length) {
    const fichier = pile.pop()!
    if (vus.has(fichier)) continue
    vus.add(fichier)
    const texte = readFileSync(fichier, 'utf8')
      // Un commentaire qui cite un import ne charge rien.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    // `import type` s'efface à la compilation, et `import('…')` est justement
    // le chargement à la demande : seuls comptent les imports de valeurs, et
    // ceux qui ne gardent rien (`import './Legendaire'` l'évaluerait aussi).
    const cibles = [
      ...[...texte.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"](\.[^'"]+)['"]/gm)].filter(m => !m[1]).map(m => m[2]),
      ...[...texte.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)].map(m => m[1]),
    ]
    for (const cible of cibles) {
      const base = path.resolve(path.dirname(fichier), cible)
      const trouve = [base, `${base}.tsx`, `${base}.ts`].find(f => /\.tsx?$/.test(f) && existsSync(f))
      if (trouve) pile.push(trouve)
    }
  }
  return vus
}

test('le téléphone de l’invité n’importe les dessins qu’à la demande', () => {
  const chemin = importsStatiques(path.join(client, 'views/PlayerApp.tsx'))
  // Le parcours voit bien le chemin : sinon ce test ne garderait rien.
  assert.ok(chemin.has(path.join(client, 'components/Avatar.tsx')), 'Avatar est sur le chemin')
  assert.ok(chemin.has(path.join(client, 'components/medaillons.ts')), 'medaillons est sur le chemin')
  for (const dessin of ['components/Legendaire.tsx', 'components/Divin.tsx', 'components/Carriere.tsx']) {
    assert.ok(!chemin.has(path.join(client, dessin)), `${dessin} ne part pas avec la page de l’invité`)
  }
})

// ── 2. Sans les dessins, l'emoji ──────────────────────────────────────────

test('sans ses dessins, un légendaire porté rend l’emoji, sans exception', async () => {
  const html = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'lg:phenix', finition: 'or' })
  assert.ok(html.includes('🦊'), html)
  assert.ok(!html.includes('av-legendaire'), 'pas de classe de médaillon autour d’un emoji')
  // Un Divin aussi : l'emoji nu, sans finition.
  const divin = await rendu('components/Avatar', 'Avatar', { avatar: '🐼', legendaire: 'dv:seraphin', finition: 'or' })
  assert.ok(divin.includes('🐼') && !divin.includes('av-or'), divin)
})

// ── 3. Un échec vaut pour toute la page ───────────────────────────────────

test('un chargement qui échoue ne se relance plus, et ne rejette jamais', async () => {
  const m = await medaillons('echec')
  let appels = 0
  m.chargeur.importer = () => {
    appels++
    return Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
  }
  await m.chargerDessins()
  assert.equal(appels, 1)
  // Chaque nouvel avatar le redemande : le navigateur garde l'échec d'un
  // `import()`, redemander ne ferait que redessiner la page à chaque fois.
  for (let i = 0; i < 5; i++) await m.chargerDessins()
  await m.chargerDessinsAuPlus(10)
  assert.equal(appels, 1, 'un seul essai pour toute la page')
  assert.equal(m.complets(), false)
})

test('une requête de dessins muette ne retient personne plus que la borne', async () => {
  const m = await medaillons('muet')
  m.chargeur.importer = () => new Promise(() => {})
  const t0 = Date.now()
  await m.chargerDessinsAuPlus(50)
  assert.ok(Date.now() - t0 < 1000, `rendu la main après ${Date.now() - t0} ms`)
  assert.ok(m.ATTENTE_MAX_DESSINS <= 3000, 'la borne des pages reste de l’ordre de deux secondes')
})

// ── 4. Ce qui n'a pas d'emoji le dit ──────────────────────────────────────

test('à la fin de soirée, un médaillon qui ne viendra plus mène au profil', async () => {
  // L'instance que lisent `Avatar` et `FinDeSoiree` : sa panne est celle de la page.
  const m = await medaillons()
  const fin = {
    soiree: { id: '2026-09-24-k7x2q', titre: 'La soirée de Nadia', slug: 'chez-nadia' },
    nom: 'Jeanne',
    avatar: '🦊',
    rang: 1,
    points: 1200,
    joueurs: 6,
    aJoue: true,
    hautsFaits: [],
    profil: {
      xp: 180,
      niveauAvant: 3,
      niveauApres: 4,
      paliers: [],
      legendaires: ['lg:phenix'],
      divins: [{ key: 'dv:seraphin', legende: '', ton: 'eclat' }],
      finitions: [],
    },
  }
  // La fin de soirée vit dans la page de l'invité, qui lit son adresse à
  // l'évaluation (`routes.ts`) : on lui en donne une.
  Object.assign(globalThis, { window: { location: { pathname: '/chez-nadia', search: '', hash: '' } } })
  const props = { fin, profil: null, onSuivante: () => {} }
  // En chemin, sa place est gardée, vide : pas encore de lien.
  assert.ok(!(await rendu('components/FinDeSoiree', 'FinDeSoiree', props)).includes('Le voir sur ton profil'))
  m.chargeur.importer = () => Promise.reject(new TypeError('404'))
  await m.chargerDessins()
  const html = await rendu('components/FinDeSoiree', 'FinDeSoiree', props)
  // Le légendaire et le Divin gagnés ce soir : chacun son lien vers le profil.
  assert.equal(html.split('Le voir sur ton profil').length - 1, 2, html)
  assert.ok(html.includes('href="/profil"'))
  // Ailleurs, sans repli, un médaillon manquant garde sa place vide.
  assert.equal(await rendu('components/Avatar', 'Dessin', { cle: 'lg:phenix' }), '<span class="lg" aria-hidden="true"></span>')
})

// ── 5. Figés dans les listes, animés là où ils sont le sujet ──────────────

test('au podium du quiz, le téléphone anime ses trois médaillons', async () => {
  const podium = [
    { id: 'a', name: 'Jeanne', avatar: '🦊', points: 900, legendaire: 'lg:phenix', finition: 'or' },
    { id: 'b', name: 'Bob', avatar: '🐼', points: 600 },
    { id: 'c', name: 'Léa', avatar: '🐸', points: 300, legendaire: 'dv:seraphin' },
  ]
  const html = await rendu('games/quiz/PlayerView', 'QuizPlayer', {
    view: { phase: 'finished', podium, yourQuizRank: 2, yourQuizTotal: 600 },
    send: () => {},
    teams: [],
  })
  // `.av.lb-avatar:not(.av-sujet)` fige un médaillon dans une liste : les
  // trois marches, elles, sont le sujet de l'écran.
  const avatars = [...html.matchAll(/class="(av [^"]*)"/g)].map(m => m[1])
  assert.equal(avatars.length, 3, html)
  for (const classes of avatars) assert.ok(classes.split(' ').includes('av-sujet'), classes)
})

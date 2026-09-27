// Les reproductions de perf-client (constats 1, 2 et 5), sur le modèle de server/test/medaillons.test.ts :
// ce que chaque page importe statiquement (et donc télécharge avant de
// s'afficher), et ce que la feuille de style commune porte à chaque page.
// Elles ÉCHOUENT sur b57035c et passeront le jour où c'est corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/perf-client/chemins.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../client/src')

/** Les fichiers qu'un module importe statiquement, de proche en proche (même règle que medaillons.test.ts). */
function importsStatiques(depart: string): Set<string> {
  const vus = new Set<string>()
  const pile = [depart]
  while (pile.length) {
    const fichier = pile.pop()!
    if (vus.has(fichier)) continue
    vus.add(fichier)
    const texte = readFileSync(fichier, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
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
const f = (x: string) => path.join(client, x)

// perf-client-5 (coût mesuré de recompenses-vitrine-9) : l'accueil anonyme (/) ne voit que « Me connecter » et
// « Rejoindre une soirée » ; il télécharge pourtant les dessins (14 Ko br) et
// les trois onglets du profil (7 Ko br) — mesuré : 1 854 → 1 675 ms (HTTP/2, ×4).
test('l’accueil anonyme n’importe ni les dessins ni les onglets du profil', () => {
  const chemin = importsStatiques(f('views/ProfilApp.tsx'))
  assert.ok(chemin.has(f('components/Avatar.tsx')), 'le parcours voit le chemin')
  for (const x of ['components/Legendaire.tsx', 'components/Divin.tsx', 'components/Apparence.tsx', 'components/Trophees.tsx']) {
    assert.ok(!chemin.has(f(x)), `${x} ne part pas avec l’accueil anonyme`)
  }
})

// perf-client-2 : le chemin du QR a repris 69 ms (HTTP/2) à 259 ms (HTTP/1.1)
// avec #58/#59 — la carte d'un joueur (au toucher d'un nom), la fin de soirée
// (à la clôture) et Jour.tsx (pour une seule icône, Flamme) n'ont rien à faire
// devant l'écran d'entrée.
test('le téléphone de l’invité ne télécharge pas avant l’entrée ce qui ne sert qu’après', () => {
  const chemin = importsStatiques(f('views/PlayerApp.tsx'))
  assert.ok(chemin.has(f('components/Entree.tsx')), 'le parcours voit le chemin')
  for (const x of ['components/CarteJoueur.tsx', 'components/FinDeSoiree.tsx', 'components/Jour.tsx']) {
    assert.ok(!chemin.has(f(x)), `${x} ne part pas avec l’écran d’entrée`)
  }
})

// perf-client-2 : la feuille commune (index.css, importée par main.tsx) porte
// les fonds de carte (11,8 Ko bruts), le quiz du jour, l'écran commun… que
// l'invité ne voit jamais : 7 % en sont utilisés jusqu'à la salle d'attente.
test('la feuille de style commune ne porte pas les décors d’une page qu’on ouvre ailleurs', () => {
  const main = readFileSync(f('main.tsx'), 'utf8')
  const communes = [...main.matchAll(/^\s*import\s+['"](\.[^'"]+\.css)['"]/gm)].map(m => readFileSync(path.resolve(client, m[1]), 'utf8')).join('\n')
  assert.ok(communes.length > 0, 'main.tsx importe bien une feuille')
  for (const [quoi, re] of [['les fonds de carte', /\.carte-fond\.fond-nuit::before/], ['le quiz du jour', /\.jour-saison\b/], ['l’écran de clôture', /\.cloture-/]] as const) {
    assert.ok(!re.test(communes), `${quoi} ne partent pas avec la feuille de chaque page`)
  }
})

// perf-client-1 : un Divin verrouillé (une « nébuleuse ») anime dix formes de
// son SVG, que le navigateur ne compose pas : les cinq de la grille
// d'Apparence — l'onglet par défaut de TOUT profil — occupent ~45 % du fil
// principal d'un téléphone ×4, sans arrêt. Les légendaires verrouillés, eux,
// sont figés (`.lg-verrou *`).
test('un Divin verrouillé se tient tranquille, comme un légendaire verrouillé', () => {
  const css = readFileSync(f('styles.css'), 'utf8')
  assert.match(css, /\.lg-verrou \* \{ animation: none !important; \}/, 'la règle des légendaires verrouillés existe (témoin)')
  assert.match(css, /\.dv-voile \*[^{]*\{\s*animation:\s*none/, 'une règle fige les formes d’un Divin verrouillé')
})

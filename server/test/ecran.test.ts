// L'écran commun, à la taille de la salle : ce qui s'y décide sans navigateur.
//
// Le rendu lui-même se regarde (`scripts/rendu-ecran.ts`, en 1366 × 768,
// 1920 × 1080 et au téléphone) ; ici, les deux dérivations qui le règlent —
// le palier de taille des réponses longues, et la hauteur des marches du
// podium — et les garde-fous de la feuille de style qu'une retouche
// défairait sans que le typecheck le voie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answersSizeClass, questionSizeClass } from '../../client/src/games/quiz/questionSize'

const { hauteurDeMarche } = await import(new URL('../../client/src/components/Podium.tsx', import.meta.url).href)
const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')

test('les réponses longues prennent un palier plus petit, la plus longue décide pour toute la grille', () => {
  assert.equal(answersSizeClass(['Vrai', 'Faux']), '')
  assert.equal(answersSizeClass(undefined), '')
  // Soixante caractères tiennent encore à la taille normale.
  assert.equal(answersSizeClass(['a'.repeat(60), 'b']), '')
  assert.equal(answersSizeClass(['a'.repeat(61), 'b']), ' ans-md')
  // Cent caractères, ce qu'une liste écrite par une IA produit volontiers.
  assert.equal(answersSizeClass(['court', 'x'.repeat(100), 'moyen']), ' ans-sm')
  // La question garde ses paliers à elle.
  assert.equal(questionSizeClass('x'.repeat(130)), ' q-sm')
})

test('un podium serré reste un podium : le premier est toujours le plus haut, à 14 points d’écart au moins', () => {
  // 1 030, 882, 828 : les marches faisaient 100, 90 et 86 %.
  const serre = [hauteurDeMarche(1, 1030, 1030), hauteurDeMarche(2, 882, 1030), hauteurDeMarche(3, 828, 1030)]
  assert.equal(serre[0], 1)
  assert.ok(serre[0] - serre[1] >= 0.14 - 1e-9, `1er ${serre[0]} contre 2e ${serre[1]}`)
  assert.ok(serre[1] - serre[2] >= 0.14 - 1e-9, `2e ${serre[1]} contre 3e ${serre[2]}`)
  // Un écart franc garde sa proportion : la hauteur dit encore l'écart.
  assert.ok(Math.abs(hauteurDeMarche(3, 108, 395) - (0.3 + (0.7 * 108) / 395)) < 1e-9)
  // Deux ex æquo, à la même hauteur ; le plancher tient à zéro point.
  assert.equal(hauteurDeMarche(1, 500, 500), hauteurDeMarche(1, 500, 500))
  assert.equal(hauteurDeMarche(2, 0, 500), 0.3)
  assert.equal(hauteurDeMarche(1, 0, 0), 0.3)
})

test('la scène suit la hauteur des grands écrans, et seulement d’eux', () => {
  // La taille racine de /host, réservée aux écrans larges : on anime aussi
  // /host au téléphone, où rien ne doit grossir.
  const bloc = /@media \(min-width: 1101px\) \{\s*html:has\(\.host\) \{ font-size: max\(100%, min\(100vh \/ 48, 100vw \/ 85\)\); \}/
  assert.match(css, bloc)
  // Le QR d'accueil et les réponses de la télé ne sont plus en pixels fixes.
  assert.doesNotMatch(css, /\.invite-qr \.qr-box svg \{ width: 148px/)
  assert.doesNotMatch(css, /\.quiz-host \.ans-btn \{[^}]*padding: 0 30px/)
})

test('rien ne se lit à travers la console, et aucun classement de la scène ne défile', () => {
  // Sans fond, « Piment » se lisait derrière « Question suivante ».
  assert.match(css, /\.host-console \{ position: relative; z-index: 1; background: var\(--bg\); \}/)
  // Les classements de la révélation n'ont plus de plancher qui les pousse
  // sous la console : ils se coupent à ce qui tient.
  assert.doesNotMatch(css, /\.host\.staging \.reveal-boards \{[^}]*min-height: (120px|7\.5rem)/)
  assert.match(css, /\.host\.staging \.scene-listes \{[^}]*overflow: hidden/)
})

test('en Velours, le voile d’une mauvaise réponse épargne son compte', () => {
  // Posé sur toute la carte, il laissait le compte à 2,39:1.
  const racine = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
  assert.match(racine, /--dim-carte: 1;/)
  assert.match(racine, /--dim-contenu: var\(--dim\);/)
})

test('à la révélation d’une estimation, les estimations prennent ce qu’il leur faut, les classements le reste', () => {
  // À parts fixes (`flex: 1.4 1 0`), trois estimations laissaient 140 px vides
  // au-dessus d'un « Top du quiz » coupé au troisième joueur sur quatre.
  assert.match(css, /\.quiz-host:has\(\.reveal-boards\) \.guess-reveal \{ flex: 0 1 auto; min-height: 0; max-height: 60%; \}/)
})

test('un 1920 × 1080 a la place d’un 1366 × 768, et un classement révélé garde toujours sa première ligne', () => {
  // Tout compte en `rem` sur grand écran : un bloc réservé au 768 laissait
  // moins de place en 1080, où la révélation montrait une équipe sur trois.
  assert.doesNotMatch(css, /@media \(max-height: 820px\)/)
  // « et 5 autres » sans une seule ligne au-dessus ne disait rien.
  assert.match(css, /\.host\.staging \.reveal-boards \.coupe-zone \{ min-height: 4rem; \}/)
})

test('au podium de la soirée, la suite du classement passe avant les distinctions', () => {
  // Trois cartes de distinctions prenaient toute la colonne : il restait une
  // ligne du classement, et « et 4 autres ».
  assert.match(css, /\.host\.staging \.scene-listes \{ align-self: stretch; \}/)
  assert.match(css, /\.host\.staging \.scene-listes > \.coupe-trophees \{ flex: 0 1 auto; max-height: 50%; \}/)
})

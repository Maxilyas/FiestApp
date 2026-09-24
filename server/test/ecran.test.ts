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

const { hauteursDesMarches } = await import(new URL('../../client/src/components/Podium.tsx', import.meta.url).href)
const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')

// Ce que la feuille de style réserve aux grands écrans (`min-width: 1101px`),
// et ce qui vaut partout — donc aussi pour l'animateur qui tient /host au
// téléphone, où rien ne doit grossir.
function blocsGrandsEcrans(): { dedans: string; dehors: string } {
  let dedans = ''
  let dehors = ''
  let i = 0
  const ouverture = '@media (min-width: 1101px) {'
  for (let j = css.indexOf(ouverture); j !== -1; j = css.indexOf(ouverture, i)) {
    dehors += css.slice(i, j)
    let profondeur = 0
    let k = j + ouverture.length - 1
    do {
      if (css[k] === '{') profondeur++
      else if (css[k] === '}') profondeur--
      k++
    } while (profondeur > 0)
    dedans += css.slice(j, k)
    i = k
  }
  dehors += css.slice(i)
  return { dedans, dehors }
}
const { dedans: grandsEcrans, dehors: partout } = blocsGrandsEcrans()

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

test('un podium serré reste un podium : chaque marche à 14 points sous la précédente au moins', () => {
  const h = (...marches: [number, number][]) => hauteursDesMarches(marches.map(([rang, points]) => ({ rang, points })))
  const ecart = (a: number, b: number, quoi: string) => assert.ok(a - b >= 0.14 - 1e-9, `${quoi} : ${a} contre ${b}`)
  // 1 030, 882, 828 : les marches faisaient 100, 90 et 86 %.
  const serre = h([1, 1030], [2, 882], [3, 828])
  assert.equal(serre[0], 1)
  ecart(serre[0], serre[1], '1er et 2e')
  ecart(serre[1], serre[2], '2e et 3e')
  // 315, 115, 114 : plafonnée par rang seulement (0,86, puis 0,72), chaque
  // marche gardait sa proportion, et la 2e et la 3e mesuraient 0,555 et
  // 0,553 — deux blocs égaux. Plafonnée par la marche d'avant, la 3e descend.
  const decroche = h([1, 315], [2, 115], [3, 114])
  ecart(decroche[1], decroche[2], '2e et 3e à un point')
  // Un écart franc garde sa proportion : la hauteur dit encore l'écart.
  assert.ok(Math.abs(h([1, 395], [2, 300], [3, 108])[2] - (0.3 + (0.7 * 108) / 395)) < 1e-9)
  // Deux ex æquo, à la même hauteur — en tête comme derrière.
  const [a, b, c] = h([1, 500], [1, 500], [3, 200])
  assert.equal(a, 1)
  assert.equal(b, a)
  ecart(b, c, 'ex æquo en tête et 3e')
  const [, d, e] = h([1, 500], [2, 300], [2, 300])
  assert.equal(e, d)
  // Le plancher tient à zéro point, et personne ne marque : tous au plancher.
  assert.equal(h([1, 500], [2, 0])[1], 0.3)
  assert.deepEqual(h([1, 0], [1, 0], [1, 0]), [0.3, 0.3, 0.3])
})

test('la scène suit la hauteur des grands écrans, et seulement d’eux', () => {
  // La taille racine de /host, réservée aux écrans larges : on anime aussi
  // /host au téléphone, où rien ne doit grossir.
  const bloc = /@media \(min-width: 1101px\) \{\s*html:has\(\.host\) \{ font-size: max\(100%, min\(100vh \/ 48, 100vw \/ 85\)\); \}/
  assert.match(css, bloc)
  // Le QR d'accueil et les réponses de la télé ne sont plus en pixels fixes —
  // sur un grand écran : au téléphone, le QR garde ses 148 px.
  assert.doesNotMatch(grandsEcrans, /\.invite-qr \.qr-box svg \{ width: 148px/)
  assert.match(grandsEcrans, /\.invite-qr \.qr-box svg \{ width: clamp\(/)
  assert.match(partout, /\.invite-qr \.qr-box svg \{ width: 148px; height: 148px; \}/)
  assert.doesNotMatch(css, /\.quiz-host \.ans-btn \{[^}]*padding: 0 30px/)
})

test('rien ne se lit à travers la console, et aucun classement de la scène ne défile', () => {
  // Sans fond, « Piment » se lisait derrière « Question suivante ».
  assert.match(css, /\.host-console \{ position: relative; z-index: 1; background: var\(--bg\); \}/)
  // Les classements de la révélation n'ont plus de plancher qui les pousse
  // sous la console : ils se coupent à ce qui tient. Sur un grand écran : au
  // téléphone, la page défile, et ils gardent le plancher d'avant.
  assert.doesNotMatch(grandsEcrans, /\.host\.staging \.reveal-boards \{[^}]*min-height: (120px|7\.5rem)/)
  assert.match(grandsEcrans, /\.host\.staging \.reveal-boards \{ flex: 1 1 0; min-height: 0; overflow: hidden;/)
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

test('la console tenue au téléphone ne grossit pas', () => {
  // Le bandeau d'état en serif, les prénoms du podium à 2,2 rem, les
  // classements à 1,25 rem : écrits pour la salle, et réservés à la télé.
  // Au téléphone, « Ophélie » se coupait en « Ophéli / e ».
  for (const regle of [
    /\.host\.staging \.quiz-status \.pill \{/,
    /\.host\.staging \.podium-name \{ font-size: 2\.2rem/,
    /\.host\.staging \.lb-row \{ font-size: 1\.25rem/,
    /\.host\.staging \.final-podium \{ --podium-tete: 9\.5rem/,
    /\.host\.staging \.estimations \.podium:has\(> :nth-child\(5\)\) \{/,
  ]) {
    assert.match(grandsEcrans, regle)
    assert.doesNotMatch(partout, regle)
  }
  // Une liste ne se coupe que sur un grand écran : ailleurs, la page défile.
  assert.doesNotMatch(partout, /\.coupe-zone \{[^}]*overflow: hidden/)
  // Un nom se coupe entre deux mots, pas en plein milieu.
  assert.doesNotMatch(css, /\.podium-name \{[^}]*overflow-wrap: anywhere/)
})

test('la pause se lit partout : sur la question longue, au téléphone, et les réponses restent lisibles', () => {
  // Au centre d'une scène qui défile, « En pause » tombait hors de l'écran
  // de l'animateur qui tient /host au téléphone.
  assert.match(css, /@media \(max-width: 1100px\) \{\s*\.pause-voile \{ position: static; font-size: 2rem; \}/)
  // Sur un fond, pour ne pas s'écrire sur la dernière ligne de la question.
  assert.match(css, /\.pause-voile > span \{[^}]*background: var\(--bg\);/)
  // À 15 %, les réponses tombaient à 1,35:1 en Ivoire.
  assert.match(css, /\.quiz-host:has\(> \.pause-voile\) > :is\(\.ans-grid, \.big-waiting, \.compte-reponses\) \{ opacity: 0\.4; \}/)
})

test('le niveau du vainqueur reste hors de la coupe de son nom', () => {
  // Coupé à deux lignes avec le nom, le niveau d'un nom long disparaissait.
  assert.doesNotMatch(css, /\.podium-name \{[^}]*line-clamp/)
  assert.match(css, /\.podium-nom \{[^}]*-webkit-line-clamp: 2;/)
  const podium = readFileSync(new URL('../../client/src/components/Podium.tsx', import.meta.url), 'utf8')
  assert.match(podium, /<span className="podium-nom">\{row\.name\}<\/span>\s*<Niveau/)
})

test('la boîte « Clore la soirée » garde ses proportions en 1920 × 1080', () => {
  // Hors de .host, elle gardait 460 px de large autour d'un texte agrandi.
  assert.match(grandsEcrans, /html:has\(\.host\) \.dialog \{ width: min\(28\.75rem, 100%\); font-size: 1rem; gap: 0\.875rem;/)
})

test('au téléphone, « Réponse enregistrée » reste sous des réponses longues', () => {
  // Posé au bas d'une page de la hauteur de la fenêtre, il s'écrivait sur la
  // deuxième carte quand quatre réponses longues faisaient défiler la page.
  assert.match(css, /\.player-shell:has\(\.ans-grid:is\(\.ans-md, \.ans-sm\)\) \{ height: auto; min-height: 100dvh; \}/)
})

test('en 1920 × 1080, le toast reste au-dessus de la console', () => {
  assert.match(grandsEcrans, /\.host > \.toast \{ bottom: 5\.25rem; \}/)
})

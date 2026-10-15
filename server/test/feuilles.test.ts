// Une feuille, une carte ou un dialogue ouvert : la page de dessous ne défile
// plus, et rien ne clignote en l'ouvrant (les remarques du propriétaire du
// 15 octobre 2026, sur la feuille des missions du jour).
//
// « Une sorte de saccade où l'image remonte un peu un coup » : arrivé au bout
// de la feuille, le geste suivant passait à la page de l'accueil — 309
// pixels, mesurés au doigt dans Chromium — et, au téléphone, la barre
// d'adresse se repliait : l'écran grandissait, et la feuille, posée en bas
// d'un voile fixe, sautait d'un coup. Le même voile sert vingt-six feuilles,
// la carte d'un joueur et les dialogues.
//
// « L'intégralité de l'écran qui clignote très rapidement » : le voile se
// posait noir d'un coup, sous une feuille encore transparente — 38, puis 15,
// puis 34 de luminosité, filmé image par image. Et figer la page par son
// défilement (`html { overflow: hidden }`, la première réponse à la saccade)
// la changeait de nature à l'ouverture : la barre d'adresse peut revenir, et
// tout l'écran se redimensionnait le temps qu'elle glisse. Puis, en fondu
// d'opacité, le voile emportait la feuille avec lui : « c'est la page de
// dessous qui s'affiche une micro seconde (l'accueil) », au téléphone — sa
// couleur seule s'anime depuis.
//
// Un vrai geste demande un navigateur ; ici, les règles qui l'empêchent, et
// les voiles qui les portent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const css = source('styles.css')
/** Une règle de la feuille de style, jusqu'à son accolade fermante. */
const regle = (selecteur: string) => {
  const debut = css.indexOf(`${selecteur} {`)
  assert.ok(debut >= 0, selecteur)
  return css.slice(debut, css.indexOf('}', debut))
}

test('le cadre qui défile garde ses gestes : arrivé au bout, il ne les passe pas à la page de dessous', () => {
  assert.match(regle('.carte-corps'), /overflow-y: auto; overscroll-behavior: contain;/, 'le corps d’une feuille')
  assert.match(regle('.carte-defile'), /overflow-y: auto; overscroll-behavior: contain;/, 'la carte d’un joueur')
})

test('le voile ne laisse passer aucun geste vers la page — sans jamais figer la page elle-même', () => {
  // `touch-action` s'arrête au cadre qui défile : la feuille défile toujours, rien d'autre.
  assert.match(regle('.carte-voile'), /touch-action: none;/)
  assert.match(regle('.dialog-backdrop'), /touch-action: none;/)
  assert.doesNotMatch(css, /html:has\([^)]*\)\s*\{\s*overflow: hidden/, 'le défilement de la page ne change pas à l’ouverture')
  // Les voiles que ces règles visent sont bien ceux que posent la feuille, le dialogue et la carte.
  assert.match(source('components/Pieces.tsx'), /<div className="carte-voile" onClick=\{onFermer\}>/)
  assert.match(source('components/Dialog.tsx'), /<div className="dialog-backdrop" onClick=/)
  assert.match(source('components/CarteJoueur.tsx'), /<div className="dialog-backdrop" onClick=\{onFermer\}>/)
})

/** Une animation de la feuille de style, jusqu'à la fin de son dernier pas. */
const pas = (nom: string) => {
  const debut = css.indexOf(`@keyframes ${nom} {`)
  assert.ok(debut >= 0, nom)
  return css.slice(debut, css.indexOf('}\n}', debut))
}

test('à l’ouverture, le voile s’assombrit avec la feuille qui monte, par sa couleur — et celui d’une carte ou d’un dialogue : rien ne clignote', () => {
  assert.match(regle('.carte-voile'), /animation: voile-tombe 0\.22s ease-out both;/, 'le voile au pas de la feuille')
  assert.match(regle('.carte-feuille'), /animation: carte-monte 0\.22s ease-out;/)
  // Le voile s'assombrit par sa couleur, jamais par son opacité : en fondu
  // d'opacité, il emportait la feuille, tout l'écran repartait de transparent,
  // et au téléphone l'accueil reparaissait le temps d'une image.
  assert.match(pas('voile-tombe'), /from \{ background-color: rgba\(8, 5, 4, 0\);/)
  assert.doesNotMatch(pas('voile-tombe'), /opacity/)
  assert.doesNotMatch(regle('.carte-voile'), /opacity/)
  // Le voile d'une carte ou d'un dialogue de même : la carte d'un joueur, sa fiche, un « Partir ? ».
  assert.match(regle('.dialog-backdrop'), /animation: voile-tombe 0\.15s ease-out both;/)
  assert.doesNotMatch(regle('.dialog-backdrop'), /opacity/)
  // La feuille ne s'efface pas elle-même : transparente sur un voile déjà noir, elle faisait le trou.
  assert.doesNotMatch(pas('carte-monte'), /opacity/)
})

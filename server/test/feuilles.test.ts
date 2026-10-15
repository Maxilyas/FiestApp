// Une feuille, une carte ou un dialogue ouvert : la page de dessous ne défile
// plus (la remarque du propriétaire du 15 octobre 2026, sur la feuille des
// missions du jour : « une sorte de saccade où l'image remonte un peu un
// coup »). Arrivé au bout de la feuille, le geste suivant passait à la page de
// l'accueil — 309 pixels, mesurés au doigt dans Chromium — et, au téléphone,
// la barre d'adresse se repliait : l'écran grandissait, et la feuille, posée
// en bas d'un voile fixe, sautait d'un coup. Le même voile sert vingt-six
// feuilles, la carte d'un joueur et les dialogues.
//
// Un vrai geste demande un navigateur (la sonde : `rendu-missions.ts`
// photographie la feuille) ; ici, les règles qui l'empêchent, et les voiles
// qui les déclenchent.
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

test('une feuille, une carte ou un dialogue ouvert : la page sous le voile ne bouge plus du tout', () => {
  assert.match(css, /html:has\(\.carte-voile, \.dialog-backdrop\) \{ overflow: hidden; \}/)
  // Les voiles que la règle reconnaît sont bien ceux que posent la feuille, le dialogue et la carte.
  assert.match(source('components/Pieces.tsx'), /<div className="carte-voile" onClick=\{onFermer\}>/)
  assert.match(source('components/Dialog.tsx'), /<div className="dialog-backdrop" onClick=/)
  assert.match(source('components/CarteJoueur.tsx'), /<div className="dialog-backdrop" onClick=\{onFermer\}>/)
  // Fixes, tous les deux : la page de dessous n'a plus à défiler pour les montrer.
  assert.match(regle('.carte-voile'), /position: fixed;/)
  assert.match(regle('.dialog-backdrop'), /position: fixed;/)
})

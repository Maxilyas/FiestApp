// La fin d'un quiz, au téléphone du chef (la remarque du propriétaire du 3
// octobre 2026) : sur la dernière question, son bouton dit « Le podium » ;
// le podium à l'écran, le même bouton, au même endroit, devient « Quiz
// suivant ». Un double toucher, ou un toucher qui croisait le rythme
// automatique, lançait le quiz suivant : la salle passait de la révélation à
// « Le quiz va commencer… » sans jamais voir son podium. « Quiz suivant »
// attend donc qu'on l'ait regardé. Et la salle d'attente ne garde le code
// en grand que tant qu'elle se remplit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

test('« Quiz suivant » n’accepte aucun toucher pendant que le podium arrive', () => {
  const barre = source('components/BarreDuChef.tsx')
  assert.match(barre, /export const PODIUM_AVANT_LA_SUITE_MS = 2500/)
  // Avant l'affichage : un toucher ne tombe jamais entre « Quiz suivant » à l'écran et son garde.
  assert.match(barre, /useLayoutEffect\(\(\) => \{\s*if \(v\?\.phase !== 'finished'\) return setPodiumRegarde\(true\)\s*setPodiumRegarde\(false\)\s*const t = setTimeout\(\(\) => setPodiumRegarde\(true\), PODIUM_AVANT_LA_SUITE_MS\)/)
  assert.match(barre, /aria-disabled=\{!podiumRegarde \|\| undefined\}\s*onClick=\{\(\) => podiumRegarde && lancer\(\)\}/)
})

test('l’invitation en grand tant que la salle arrive ; un quiz joué, le code reste dans la barre', () => {
  const barre = source('components/BarreDuChef.tsx')
  assert.match(barre, /const commencee = c\.snapshot\.players\.some\(p => p\.score > 0\)/)
  assert.match(barre, /\{place && !enJeu && !commencee && createPortal\(<InvitationDuSalon/)
  // Le code reste à un toucher, son QR dans une feuille.
  assert.match(barre, /className="barre-chef-code" onClick=\{\(\) => setQr\(true\)\}/)
})

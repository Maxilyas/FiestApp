// « Parfois, quand on clique vite sur une réponse, ça la sélectionne au lieu
// de la valider » (la remarque du propriétaire du 4 octobre 2026). Rejoué
// dans Chromium au doigt : touchée à l'arrivée de la question, la case
// glissait encore de son animation d'entrée, et le toucher retombait dans
// l'interstice ; appuyée un peu longtemps, son texte se surlignait, sans
// `click`. La réponse se prend maintenant au lever du doigt (`toucher`), et
// les cases du téléphone arrivent sur place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const { toucher } = (await import(client('toucher.ts').href)) as typeof import('../../client/src/toucher')

const CASE = { left: 0, right: 100, top: 0, bottom: 50 }
const cible = (disabled = false) => ({ disabled, getBoundingClientRect: () => CASE })
const doigt = (t: number, x = 50, y = 25, el = cible()) =>
  ({ pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: t, currentTarget: el }) as never
const clic = (t: number) => ({ timeStamp: t }) as never

test('au doigt, la réponse part au lever, une seule fois', () => {
  let n = 0
  const p = toucher(() => n++)
  p.onPointerUp(doigt(1000))
  assert.equal(n, 1, 'le lever du doigt répond, sans attendre le click')
  // Le click que le navigateur fait suivre n'est que son écho.
  p.onClick(clic(1040))
  assert.equal(n, 1, 'une case à cocher touchée une fois ne se décoche pas aussitôt')
  // Le geste suivant, lui, compte.
  p.onClick(clic(5000))
  assert.equal(n, 2)
})

test('le doigt levé hors de la case, ou sur une case éteinte, ne répond rien', () => {
  let n = 0
  const p = toucher(() => n++)
  p.onPointerUp(doigt(10_000, 50, 80))
  p.onPointerUp(doigt(20_000, 50, 25, cible(true)))
  assert.equal(n, 0)
})

test('la souris et le clavier gardent le click', () => {
  let n = 0
  const p = toucher(() => n++)
  p.onPointerUp({ ...(doigt(30_000) as object), pointerType: 'mouse' } as never)
  assert.equal(n, 0)
  p.onClick(clic(30_010))
  assert.equal(n, 1)
})

test('chaque case de réponse du téléphone passe par toucher, et arrive sur place', () => {
  for (const f of ['games/quiz/PlayerView.tsx', 'views/CampagneApp.tsx']) {
    // La balise ouvrante de chaque bouton : jusqu'au premier « > » qui n'est pas une flèche.
    const balises = readFileSync(client(f), 'utf8')
      .replaceAll('=>', '⇒')
      .split('<button')
      .slice(1)
      .map(b => b.slice(0, b.indexOf('>')))
      .filter(b => /ans-btn|valider-variante/.test(b))
    assert.ok(balises.length > 0, f)
    for (const b of balises) {
      assert.doesNotMatch(b, /onClick=/, `${f} : une case répond au click seul`)
      assert.match(b, /toucher\(/, `${f} : une case sans toucher`)
    }
  }
  const css = readFileSync(client('styles.css'), 'utf8')
  const regle = [...css.matchAll(/\n\.quiz-player \.ans-btn \{([^}]*)\}/g)].map(m => m[1]).join('')
  assert.match(regle, /user-select: none/, 'le texte d’une case ne se surligne pas')
  assert.match(regle, /animation: ans-fondu/, 'la case arrive en fondu')
  assert.match(regle, /animation-delay: 0s/, 'et toutes ensemble')
  assert.doesNotMatch(css.match(/@keyframes ans-fondu \{[^}]*\}/)?.[0] ?? 'absente', /transform|translate/, 'sans bouger')
})

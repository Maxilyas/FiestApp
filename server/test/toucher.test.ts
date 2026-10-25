// « Parfois, quand on clique vite sur une réponse, ça la sélectionne au lieu
// de la valider » (la remarque du propriétaire du 4 octobre 2026). Rejoué
// dans Chromium au doigt : touchée à l'arrivée de la question, la case
// glissait encore de son animation d'entrée, et le toucher retombait dans
// l'interstice ; appuyée un peu longtemps, son texte se surlignait, sans
// `click`. La réponse se prend maintenant au lever du doigt (`toucher`), et
// les cases du téléphone arrivent sur place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

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

test('le click qui suit un doigt ne touche pas le bouton qui a glissé sous lui', () => {
  // La frise, au téléphone (le retour du propriétaire du 20 octobre 2026 : « tant que l'on n'a pas mis le bon ordre, ça enlève
  // tout de ce qu'on a mis. On peut pas cliquer sur effacer ou valider ») : la carte posée quitte sa rangée, « Effacer » remonte
  // sous le doigt, et le click que le navigateur fait suivre y tombait — tout ce qui était posé s'effaçait, et les deux boutons
  // s'éteignaient. Passé par toucher, le bouton ignore cet écho.
  let posees = 0
  let effacees = 0
  const carte = toucher(() => posees++)
  const effacer = toucher(() => effacees++)
  carte.onPointerUp(doigt(50_000))
  effacer.onClick(clic(50_020))
  assert.deepEqual([posees, effacees], [1, 0])
  // Touché pour de bon, il efface.
  effacer.onPointerUp(doigt(50_400))
  assert.equal(effacees, 1)
})

test('un dialogue ouvert au lever du doigt ne se referme pas sous son écho : le voile ignore le click qui suit', async () => {
  // « Quitter » entre deux manches du Cabinet, au doigt (regardé en 360 × 640, le 25 octobre 2026) : sans chrono à mettre en
  // pause, la confirmation s'ouvrait au lever du doigt, et le click que le navigateur fait suivre tombait sur son voile, qui la
  // refermait — rien ne s'ouvrait, et à la souris, si. Le voile reconnaît cet écho.
  const { estLEchoDUnDoigt } = (await import(client('toucher.ts').href)) as typeof import('../../client/src/toucher')
  let ouvert = 0
  toucher(() => ouvert++).onPointerUp(doigt(60_000))
  assert.equal(ouvert, 1)
  assert.equal(estLEchoDUnDoigt(clic(60_030)), true, 'l’écho du doigt')
  assert.equal(estLEchoDUnDoigt(clic(61_000)), false, 'un toucher du voile pour de bon le ferme')
  assert.match(readFileSync(client('components/Dialog.tsx'), 'utf8'), /<div className="dialog-backdrop" onClick=\{e => !estLEchoDUnDoigt\(e\) && close\(null\)\}>/)
})

test('au Cabinet, l’écho du doigt ne suit pas le lien venu sous lui : le premier click qui suit le doigt s’arrête à la capture', async () => {
  // « Revenir au musée », au bas du bilan, au doigt (le rendu du 25 octobre 2026, `rendu-cabinet.ts`) : le musée paraissait au
  // lever du doigt, et le `click` qui suit tombait sur la tuile venue sous lui — un lien, qui n'ignore pas l'écho comme un bouton
  // passé par `toucher` : Léa arrivait dans la salle de l'Érudit, ou à la visite du jour, au lieu du musée.
  const { arreterLEcho, prendreLeDoigt } = (await import(client('toucher.ts').href)) as typeof import('../../client/src/toucher')
  const natif = (timeStamp: number, isTrusted = true) => {
    const vu = { suivi: true, remonte: true }
    return { vu, evenement: { isTrusted, timeStamp, preventDefault: () => void (vu.suivi = false), stopPropagation: () => void (vu.remonte = false) } }
  }
  toucher(() => {}).onPointerUp(doigt(70_000))
  const echo = natif(70_040)
  arreterLEcho(echo.evenement)
  assert.deepEqual(echo.vu, { suivi: false, remonte: false }, 'ni le lien suivi, ni son onClick')
  // Un doigt n'a qu'un écho : un toucher franc juste après, sur un lien du musée, l'ouvre.
  const franc = natif(70_500)
  arreterLEcho(franc.evenement)
  assert.deepEqual(franc.vu, { suivi: true, remonte: true }, 'le toucher suivant passe')
  // Sans doigt, la souris et le clavier gardent leur click.
  const souris = natif(90_000)
  arreterLEcho(souris.evenement)
  assert.deepEqual(souris.vu, { suivi: true, remonte: true })
  // Un click que le code lance n'est l'écho de rien, et ne prend pas sa place : celui du navigateur, après lui, s'arrête.
  toucher(() => {}).onPointerUp(doigt(100_000))
  const parLeCode = natif(100_010, false)
  arreterLEcho(parLeCode.evenement)
  assert.deepEqual(parLeCode.vu, { suivi: true, remonte: true }, 'un click du code passe')
  const echoApres = natif(100_030)
  arreterLEcho(echoApres.evenement)
  assert.deepEqual(echoApres.vu, { suivi: false, remonte: false })
  // Le doigt pris hors de `toucher` — la carte de France — a son écho de même ; bien après, rien n'est plus un écho.
  prendreLeDoigt({ timeStamp: 110_000 })
  const tardif = natif(111_000)
  arreterLEcho(tardif.evenement)
  assert.deepEqual(tardif.vu, { suivi: true, remonte: true }, 'au-delà de 800 ms, un autre geste')
  // La page du Cabinet le pose à la capture du document — avant React, et avant le lien — tant qu'elle est là.
  const page = readFileSync(client('views/CabinetApp.tsx'), 'utf8')
  assert.match(page, /document\.addEventListener\('click', arreterLEcho, true\)/)
  assert.match(page, /document\.removeEventListener\('click', arreterLEcho, true\)/)
})

test('« Effacer » et « Valider » des formes qui se posent passent par toucher — la forme à composer, la frise, et celles à venir', () => {
  const source = readFileSync(client('views/ExpeditionApp.tsx'), 'utf8').replaceAll('=>', '⇒')
  const rangees = source
    .split('className="exp-composer-gestes"')
    .slice(1)
    .map(r => r.slice(0, r.indexOf('</div>')))
  assert.ok(rangees.length >= 2, 'la forme à composer et la frise')
  for (const r of rangees) {
    const balises = r
      .split('<button')
      .slice(1)
      .map(b => b.slice(0, b.indexOf('>')))
    assert.ok(balises.length > 0, 'une rangée de gestes sans bouton')
    for (const b of balises) {
      assert.doesNotMatch(b, /onClick=/, 'un geste qui répond au click seul : l’écho d’une carte posée y tombe')
      assert.match(b, /toucher\(/, 'un geste sans toucher')
    }
  }
})

test('au Cabinet, chaque geste d’une partie passe par toucher : une réponse, le choix du Pari, la carte-bonus, la suite, le bilan', () => {
  // Une réponse touchée change l'écran au lever du doigt : « Garder » et « Parier » prennent la place des réponses, « Manche
  // suivante » celle de la dernière, « Faux » et « Vrai » restent sous lui d'une affirmation à l'autre. Le `click` qui suit tombait
  // sur ce qui avait glissé là : au Pari, il gardait des étoiles qu'on voulait parier. Chaque écran de jeu, d'office : à la Frise,
  // « Poser ici » se retire sous le doigt qui vient de poser, et un `click` seul aurait pris l'événement remonté à sa place.
  const jeux = readdirSync(client('views/cabinet/jeux')).map(f => `views/cabinet/jeux/${f}`)
  // Un écran de jeu exporte son `JeuALEcran` ; un module d'outils du dossier, s'il en vient un, peut n'avoir aucun bouton — ceux
  // qu'il a passent par toucher comme les autres.
  const estUnEcran = (f: string) => /export const \w+: JeuALEcran</.test(readFileSync(client(f), 'utf8'))
  for (const jeu of ['Pari', 'Eclair', 'Detail', 'Frise']) assert.ok(estUnEcran(`views/cabinet/jeux/${jeu}.tsx`), jeu)
  for (const f of [...jeux, 'views/cabinet/Partie.tsx', 'views/cabinet/Bilan.tsx']) {
    const balises = readFileSync(client(f), 'utf8')
      .replaceAll('=>', '⇒')
      .split('<button')
      .slice(1)
      .map(b => b.slice(0, b.indexOf('>')))
    if (!f.startsWith('views/cabinet/jeux/') || estUnEcran(f)) assert.ok(balises.length > 0, f)
    for (const b of balises) {
      assert.doesNotMatch(b, /onClick=/, `${f} : un geste qui répond au click seul`)
      assert.match(b, /toucher\(/, `${f} : un geste sans toucher`)
    }
  }
  // Les réponses du Pari sont celles du téléphone : sous `.quiz-player`, elles arrivent sur place et ne se surlignent pas.
  assert.match(readFileSync(client('views/cabinet/Partie.tsx'), 'utf8'), /<div className="quiz-player cab-manche">/)
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

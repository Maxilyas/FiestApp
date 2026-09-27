// Le son de la télé qu'on pilote à la télécommande.
//
// Le contexte audio ne naissait que de trois clics sur la page même —
// « Lancer un quiz », un écran de fin, le bouton des sons. Quand on anime au
// téléphone, la télé, celle qui doit sonner, ne voit jamais ces clics : ni
// 3-2-1, ni tic-tac, ni révélation, ni fanfare, toute la soirée, sous
// l'icône « son allumé ». Le premier geste sur la page ouvre maintenant le
// son, où qu'il tombe, et une page déjà touchée l'ouvre au premier son.
//
// Pas de navigateur : le module du client (`client/src/sound.ts`), dans Node,
// devant un faux `AudioContext` qui compte ce qu'on lui fait jouer.
import { test } from 'node:test'
import assert from 'node:assert/strict'

/** Ce que le test lit du module — écrit à la main : le typecheck du serveur ne suit pas le client. */
interface ModuleSon {
  sound: { reveal(): void; go(): void }
  ouvrirAuPremierGeste(cible: EventTarget): () => void
  sonPret(): boolean
}

/** Un faux contexte audio : il compte les contextes nés et les sons joués. */
function fauxAudio() {
  const compte = { contextes: 0, sons: 0 }
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
  class FauxContexte {
    state = 'running'
    currentTime = 0
    destination = {}
    onstatechange: (() => void) | null = null
    constructor() {
      compte.contextes++
    }
    resume() {
      return Promise.resolve()
    }
    createGain() {
      return { gain: param, connect: (x: unknown) => x }
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: param,
        connect: (x: unknown) => x,
        start: () => compte.sons++,
        stop() {},
      }
    }
  }
  return { compte, FauxContexte }
}

/** Une page neuve : son module, son contexte audio, et ce qu'elle a déjà vu de ses visiteurs. */
async function page(instance: string, dejaTouchee: boolean) {
  const { compte, FauxContexte } = fauxAudio()
  Object.assign(globalThis, { window: globalThis, AudioContext: FauxContexte })
  Object.defineProperty(globalThis.navigator, 'userActivation', {
    value: { hasBeenActive: dejaTouchee },
    configurable: true,
  })
  const son: ModuleSon = await import(`${new URL('../../client/src/sound.ts', import.meta.url).href}?${instance}`)
  return { son, compte }
}

test('une page que personne n’a touchée reste muette, sans rien tenter', async () => {
  const { son, compte } = await page('intacte', false)
  son.sound.reveal()
  assert.deepEqual(compte, { contextes: 0, sons: 0 })
  assert.equal(son.sonPret(), false, 'la console le dit : « Activer le son »')
})

test('un geste n’importe où sur la page de la télé ouvre le son', async () => {
  const { son, compte } = await page('geste', false)
  const document = new EventTarget()
  const oublier = son.ouvrirAuPremierGeste(document)
  document.dispatchEvent(new Event('pointerdown'))
  assert.equal(compte.contextes, 1)
  assert.equal(son.sonPret(), true)
  son.sound.reveal()
  assert.equal(compte.sons, 3, 'la révélation sonne : trois notes')
  oublier()
})

test('une page déjà touchée — le clic qui a connecté la télé — sonne dès le premier son', async () => {
  const { son, compte } = await page('touchee', true)
  son.sound.go()
  assert.equal(compte.contextes, 1)
  assert.equal(compte.sons, 2, 'le départ de la question sonne : deux notes')
})

// « FiestApp sur ton écran d'accueil » : la carte qui dit aux joueurs, au pied
// de l'accueil d'un téléphone, comment installer l'application — les gestes
// de l'iPhone et ceux d'Android, et sur Android, quand Chrome l'offre, un
// toucher (`client/src/installation.ts`, `components/Installer.tsx`).
//
// Pas de navigateur en intégration continue : le module se joue dans Node,
// sous un faux navigateur, et la carte se rend en HTML — son câblage dans
// l'accueil se relit dans la source, comme la page du jour
// (`jour-telephone.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const source = (f: string) => readFileSync(client(f), 'utf8')
/** Le module de l'installation, neuf : il garde l'invitation de Chrome. */
const installation = (): Promise<any> => import(`${client('installation.ts').href}?${Math.random()}`)

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

test('la carte parle à un téléphone : l’iPhone et l’iPad ensemble, Android — rien sur un ordinateur', async () => {
  const { telephoneDe } = await installation()
  assert.equal(telephoneDe(IPHONE, 'iPhone', 5), 'iphone')
  // Safari fait passer l'iPad pour un Mac ; un Mac n'a pas d'écran tactile.
  assert.equal(telephoneDe(IPAD, 'MacIntel', 5), 'iphone')
  assert.equal(telephoneDe(IPAD, 'MacIntel', 0), null, 'un vrai Mac : rien à poser sur un écran d’accueil')
  assert.equal(telephoneDe(ANDROID, 'Linux armv8l', 5), 'android')
  assert.equal(telephoneDe(WINDOWS, 'Win32', 0), null)
})

test('l’invitation de Chrome est gardée dès qu’elle arrive, offerte d’un toucher, et ne sert qu’une fois', async () => {
  const module = await installation()
  const fenetre = new EventTarget()
  module.ecouterLInstallation(fenetre)
  let prevenue = 0
  const arreter = module.suivreLInstallation(() => prevenue++)
  assert.equal(module.invitationOfferte(), false)

  const invites: string[] = []
  const invitation = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: async () => void invites.push('fenêtre de Chrome'),
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  })
  fenetre.dispatchEvent(invitation)
  assert.equal(invitation.defaultPrevented, true, 'gardée : elle ne surgit plus d’elle-même en bas de l’écran')
  assert.equal(module.invitationOfferte(), true)
  assert.equal(prevenue, 1, 'la carte l’apprend')

  assert.equal(await module.installer(), 'acceptee')
  assert.deepEqual(invites, ['fenêtre de Chrome'])
  assert.equal(module.invitationOfferte(), false, 'elle ne sert qu’une fois')
  assert.equal(await module.installer(), 'indisponible')

  // Refusée, Chrome en refera une plus tard : la nouvelle est gardée de même.
  fenetre.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) }))
  assert.equal(await module.installer(), 'refusee')

  assert.equal(module.installeeDepuisIci(), false)
  fenetre.dispatchEvent(new Event('appinstalled'))
  assert.equal(module.installeeDepuisIci(), true, 'installée : la carte n’a plus rien à dire')
  arreter()
  const avant = prevenue
  fenetre.dispatchEvent(new Event('appinstalled'))
  assert.equal(prevenue, avant, 'qui ne suit plus n’est plus prévenu')
})

test('masquée d’un toucher, elle ne revient pas sur ce téléphone — et un stockage refusé ne casse rien', async () => {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const memoire = new Map<string, string>()
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => void memoire.set(k, v) },
    })
    const module = await installation()
    assert.equal(module.carteMasquee(), false)
    module.masquerLaCarte()
    assert.equal(module.carteMasquee(), true)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    assert.equal(module.carteMasquee(), false)
    assert.doesNotThrow(() => module.masquerLaCarte())
  } finally {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant)
    else delete (globalThis as Record<string, unknown>).localStorage
  }
})

/** La carte rendue en HTML, dans cet état. */
async function rendu(props: object): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { CarteDInstallation } = await import(client('components/Installer.tsx').href)
  const rien = () => {}
  return renderToStaticMarkup(
    React.createElement(CarteDInstallation, {
      telephone: 'iphone',
      onglet: 'iphone',
      ouverte: false,
      offerte: false,
      avecProfil: false,
      onBasculer: rien,
      onOnglet: rien,
      onInstaller: rien,
      onMasquer: rien,
      ...props,
    }),
  )
}
const texte = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
/** Les étapes d'une liste : « 1 · Ouvre cette page… ». */
const etapes = (html: string) =>
  [...html.matchAll(/<li><span class="installer-numero" aria-hidden="true">(\d)<\/span><span>([\s\S]*?)<\/span><\/li>/g)].map(m => `${m[1]} · ${texte(m[2]).trim()}`)

test('repliée, la carte tient sur une ligne qu’on touche pour la dérouler', async () => {
  const html = await rendu({})
  assert.match(
    html,
    /^(<link[^>]*>)?<section class="card installer"><button type="button" class="installer-tete" aria-expanded="false"><img class="installer-icone" src="\/icone.svg" alt="" width="32" height="32"\/><span class="installer-titre">Installer l’application<\/span><svg class="icon"[\s\S]*?<\/svg><\/button><\/section>$/,
    'l’icône qu’on retrouvera sur l’écran d’accueil, son nom, la flèche — et rien d’autre',
  )
  assert.doesNotMatch(html, /aria-controls/, 'rien à contrôler tant qu’elle est repliée')
  // Même quand Chrome offre d'installer : repliée, elle reste une ligne.
  assert.doesNotMatch(await rendu({ telephone: 'android', onglet: 'android', offerte: true }), /Installer maintenant/)
})

test('déroulée : ce qu’elle apporte, les gestes de l’iPhone et ceux d’Android à leur onglet, « Ne plus afficher » — et sur Android, un toucher quand Chrome l’offre', async () => {
  const iphone = await rendu({ ouverte: true })
  assert.match(iphone, /<section class="card installer ouverte"><button type="button" class="installer-tete" aria-expanded="true" aria-controls="installer-detail">/)
  assert.match(texte(iphone), /Sans passer par un store : elle s’ouvre d’un toucher, en plein écran, comme une vraie appli\./)
  assert.doesNotMatch(texte(iphone), /quiz du jour/, 'sans profil, pas de quiz du jour à rappeler')
  assert.match(texte(await rendu({ ouverte: true, avecProfil: true })), /Et elle peut te rappeler le quiz du jour, le soir\./)
  assert.match(iphone, /<div class="onglets onglets-petits" role="tablist" aria-label="Ton téléphone">/)
  assert.match(iphone, /id="installer-onglet-iphone" type="button" role="tab" aria-selected="true"/)
  assert.match(iphone, /id="installer-onglet-android" type="button" role="tab" aria-selected="false"/)
  assert.match(iphone, /role="tabpanel" id="installer-panneau-iphone" aria-labelledby="installer-onglet-iphone"/)
  assert.deepEqual(etapes(iphone), [
    '1 · Ouvre cette page dans Safari.',
    '2 · Touche Partager , en bas — en haut sur iPad.',
    '3 · Choisis Sur l’écran d’accueil , puis Ajouter.',
  ])
  // Les icônes telles que le téléphone les montre, dans la phrase.
  assert.match(iphone, /Partager<\/b> <svg class="icon"[\s\S]*?<\/svg>, en bas/)
  // Les guillemets tiennent à leurs mots (`espacesFines`).
  assert.match(iphone, /Depuis Instagram, WhatsApp ou Messenger\u00a0: «\u202fOuvrir dans Safari\u202f» d’abord\./)
  // Les numéros en pastille, cachés à l'oreille : la liste numérotée les dit déjà.
  assert.match(iphone, /<ol class="installer-etapes"><li><span class="installer-numero" aria-hidden="true">1<\/span>/)
  assert.match(iphone, /<button type="button" class="installer-masquer">Ne plus afficher<\/button>/)
  assert.doesNotMatch(iphone, /Installer maintenant/, 'l’iPhone ne propose jamais d’installer d’un toucher')
  assert.doesNotMatch(await rendu({ ouverte: true, offerte: true }), /Installer maintenant/, 'même si un navigateur le prétendait')

  const android = await rendu({ telephone: 'android', onglet: 'android', ouverte: true })
  assert.match(android, /id="installer-onglet-android" type="button" role="tab" aria-selected="true"/)
  assert.deepEqual(etapes(android), [
    '1 · Ouvre cette page dans Chrome.',
    '2 · Touche le menu , en haut à droite.',
    '3 · Choisis Installer l’application — ou Ajouter à l’écran d’accueil.',
  ])
  assert.match(texte(android), /Samsung Internet : menu ≡, puis Ajouter la page à › Écran d’accueil\./)
  assert.doesNotMatch(android, /Installer maintenant/, 'sans l’invitation de Chrome, pas de bouton qui ne ferait rien')
  assert.match(
    await rendu({ telephone: 'android', onglet: 'android', ouverte: true, offerte: true }),
    /<button type="button" class="btn btn-accent btn-block">.*Installer maintenant<\/button><div class="onglets onglets-petits"/,
    'le toucher d’abord, les gestes dessous',
  )
})

test('au pied de l’accueil, avec ou sans profil : les trois gros boutons d’abord, l’écoute de Chrome dès le démarrage', async () => {
  const profil = source('views/ProfilApp.tsx')
  // Sans profil : sous le choix, que la carte ne pousse pas hors de l'écran.
  assert.match(profil, /pied=\{<Installer \/>\}/)
  // Avec profil : sous ce qu'on vient faire, la promesse du rappel en plus.
  assert.match(profil, /<AccueilJouer [^\n]*\/>\s*\{\/\*[^}]*\*\/\}\s*<Installer avecProfil \/>/)
  const formulaire = source('components/ProfilForm.tsx')
  const choix = formulaire.slice(formulaire.indexOf("if (mode === 'choix')"), formulaire.indexOf('const creation = mode'))
  assert.ok(choix.indexOf('Créer un profil') < choix.indexOf('{pied}'), 'le pied vient après les trois boutons')
  assert.match(choix, /<div className="join-grow" \/>\s*\{pied\}\s*<\/div>/, 'au pied de la page, après la respiration du bas')

  // Rendu, l'accueil sans profil garde ses trois gros boutons en tête. Le
  // formulaire tire la liaison de la soirée, qui écoute la page : de quoi
  // l'évaluer, comme `connexion-claire.test.ts`.
  Object.assign(globalThis, {
    window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
    document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  })
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { ProfilForm } = await import(client('components/ProfilForm.tsx').href)
  const html = renderToStaticMarkup(
    React.createElement(ProfilForm, {
      onDone: () => {},
      echappee: React.createElement('button', { type: 'button', className: 'btn btn-accent btn-big btn-block' }, 'Jouer sans compte'),
      pied: React.createElement('section', { className: 'card installer' }, 'la carte'),
    }),
  )
  assert.deepEqual([...html.matchAll(/btn-big btn-block[^>]*>([^<]+)</g)].map(m => m[1]), ['Jouer sans compte', 'Me connecter', 'Créer un profil'])
  assert.ok(html.indexOf('Créer un profil') < html.indexOf('la carte'))

  // L'invitation arrive tôt : on l'écoute au démarrage de chaque page d'un téléphone.
  assert.match(source('main.tsx'), /if \(App !== HostApp\) ecouterLInstallation\(\)/)
  // Le rappel du soir lit la même règle : installée, ou pas.
  assert.match(source('rappel.ts'), /import \{ estInstallee \} from '\.\/installation'/)
})

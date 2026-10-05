// Ce qu'une page demande dès son arrivée — et ce qu'elle n'attend plus.
//
// Le temps de l'affichage passait à attendre, en file : la page, son script,
// son code, puis ses données, chaque étape partant quand la précédente était
// arrivée (`retours/2026-10-05/affichage-des-pages.md`). Le serveur, qui
// sert la page, y pose maintenant ce qu'elle demandera
// (`<link rel="preload" as="fetch">`, `shared/depart.ts`) et son attente déjà
// écrite (`core/page.ts`) ; la dernière soirée close part avec la page de
// l'espace qui la désigne ; les sentiers partent avec la campagne, et les
// onglets du profil avec la boutique.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Invite,
  type Socket,
} from './banc'
import { ecrireAttente, prechargerDonnees } from '../src/core/page'
import { donneesDeDepart } from '../../shared/depart'
import { parseRoute } from '../../shared/adresses'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const source = (f: string) => readFileSync(client(f), 'utf8')

/** Le squelette d'un client construit : une tête, une racine vide. */
const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>FiestApp</title>
  </head>
  <body><div id="root"></div></body>
</html>`

/** Les données que la page servie fait précharger, dans l'ordre. */
const prechargees = (html: string) =>
  [...html.matchAll(/<link rel="preload" as="fetch" href="([^"]+)" crossorigin>/g)].map(m => m[1].replaceAll('&amp;', '&'))

/** Ce qu'une adresse demandera dès son code arrivé. */
const de = (chemin: string) => donneesDeDepart(parseRoute(chemin))

// ── 1. Ce que chaque page demande ─────────────────────────────────────────

test('chaque page dit ce qu’elle demandera dès son code arrivé — avec les adresses mêmes qu’elle demande', () => {
  assert.deepEqual(de('/'), ['/api/auth/me', '/api/joueur/moi?accueil'])
  for (const c of ['/profil', '/boutique']) assert.deepEqual(de(c), ['/api/auth/me', '/api/joueur/moi'], c)
  assert.deepEqual(de('/jour'), ['/api/jour', '/api/joueur/moi?leger'])
  assert.deepEqual(de('/campagne'), ['/api/campagne', '/api/joueur/moi?leger'])
  assert.deepEqual(de('/edit'), ['/api/quizzes', '/api/auth/me', '/api/joueur/theme'])
  for (const c of ['/banc/souvenir', '/banc/stats']) assert.deepEqual(de(c), ['/s/banc/recap.json', '/api/auth/me', '/api/joueur/theme'], c)
  assert.deepEqual(de('/banc/bilan'), ['/s/banc/bilan.json', '/api/auth/me', '/api/joueur/theme'])
  // Les fiches s'impriment en Ivoire : pas de thème à confirmer.
  assert.deepEqual(de('/banc/bilan/fiches'), ['/s/banc/bilan.json', '/api/auth/me'])
  assert.deepEqual(de('/banc/soirees'), ['/s/banc/soirees.json', '/api/auth/me', '/api/joueur/theme'])
  assert.deepEqual(de('/banc/soirees/2026-10-05-abc/bilan'), ['/s/banc/soirees/2026-10-05-abc/bilan.json', '/api/auth/me', '/api/joueur/theme'])
  // L'entrée d'un invité attend sa liaison temps réel, pas une donnée ; l'écran commun aussi.
  for (const c of ['/banc', '/host', '/tele', '/compte', '/nulle/part/ici']) assert.deepEqual(de(c), [], c)

  // Le préchargement ne sert que si l'adresse est la même, lettre pour
  // lettre : la page les prend au même module.
  const api = source('api.ts')
  for (const cle of ['console', 'moi', 'moiAccueil', 'moiLeger', 'jour', 'campagne', 'quiz']) {
    assert.match(api, new RegExp(`DEPART\\.${cle}\\b`), `api.ts demande DEPART.${cle}`)
  }
  assert.match(source('themeJoueur.ts'), /fetch\(DEPART\.theme, /)
  assert.match(source('routes.ts'), /return adresseDesDonnees\(slug, file, archiveId\)/)
})

// ── 2. La page servie ─────────────────────────────────────────────────────

test('les données de départ partent dans la tête de la page, et l’attente y est déjà écrite — sans rien y injecter', () => {
  const page = prechargerDonnees(PAGE, ['/api/auth/me', '/s/banc/recap.json'])
  assert.deepEqual(prechargees(page), ['/api/auth/me', '/s/banc/recap.json'])
  assert.ok(page.lastIndexOf('rel="preload"') < page.indexOf('</head>'), 'dans la tête')
  assert.equal(prechargerDonnees(PAGE, []), PAGE)

  assert.match(
    ecrireAttente(PAGE),
    /<div id="root"><div class="center-page"><div class="attente" role="status"><p class="muted">Chargement…<\/p><\/div><\/div><\/div>/,
  )
  assert.match(ecrireAttente(PAGE, { eyebrow: 'La soirée', headline: 'd’Antoine' }), /<span class="join-eyebrow">La soirée<\/span><h1 class="join-title">d’Antoine<\/h1>/)
  assert.match(ecrireAttente(PAGE, { eyebrow: 'Ce soir', headline: 'Les douze coups de minuit' }), /class="join-title compact"/)
  // Sans nom, l'attente ordinaire — comme `Patience`.
  assert.match(ecrireAttente(PAGE, { eyebrow: 'La soirée', headline: '' }), /Chargement…/)
  // Un nom de soirée ne peut rien injecter, et « $& » ne réinjecte pas ce qu'il remplace.
  const piege = ecrireAttente(PAGE, { eyebrow: '"><script>alert(1)</script>', headline: 'Sam $& Léa' })
  assert.ok(!piege.includes('<script>'), piege)
  assert.match(piege, /Sam \$&amp; Léa/)
})

test('l’attente que le serveur écrit est celle que React dessinera : rien ne bouge quand il la remplace', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const avant = (globalThis as { document?: unknown }).document
  // `annonce.tsx` lit les balises de la page à son chargement : une instance par page.
  const patience = async (metas: Record<string, string>, instance: string) => {
    Object.assign(globalThis, {
      document: {
        querySelector: (sel: string) => {
          const nom = /name="([^"]+)"/.exec(sel)?.[1] ?? ''
          return nom in metas ? { getAttribute: () => metas[nom] } : null
        },
      },
    })
    const { Patience } = await import(`${client('annonce.tsx').href}?${instance}`)
    return renderToStaticMarkup(React.createElement(Patience, { texte: React.createElement('p', { className: 'muted' }, 'Chargement…') }))
  }
  const ecrite = (entete?: { eyebrow: string; headline: string }) =>
    ecrireAttente('<div id="root"></div>', entete).replace(/^<div id="root">|<\/div>$/g, '')
  // React écrit l'apostrophe `&#x27;`, le serveur `&#39;` : la même.
  const memes = (a: string, b: string) => assert.equal(a.replaceAll('&#x27;', '&#39;'), b.replaceAll('&#x27;', '&#39;'))
  try {
    memes(await patience({}, 'sans-nom'), ecrite())
    const entete = { eyebrow: "L'apéro & co", headline: 'chez Léa' }
    memes(await patience({ 'soiree-eyebrow': entete.eyebrow, 'soiree-headline': entete.headline }, 'court'), ecrite(entete))
    const long = { eyebrow: 'La soirée', headline: 'des anciens de la promo 2012' }
    memes(await patience({ 'soiree-eyebrow': long.eyebrow, 'soiree-headline': long.headline }, 'long'), ecrite(long))
  } finally {
    Object.assign(globalThis, { document: avant })
  }
  // Et c'est bien `Patience` que les routes montrent en attendant leur code.
  assert.match(source('main.tsx'), /<Suspense fallback=\{<Patience texte=\{<p className="muted">Chargement…<\/p>\} \/>\}>/)
})

test('la page servie fait précharger ce que sa vue demandera ; l’entrée d’un invité, elle, porte déjà son nom', async () => {
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), PAGE)
  const banc = await demarrer({ clientDist: dist })
  try {
    const lire = async (chemin: string) => (await fetch(banc.url + chemin)).text()
    const s = ADMIN.slug
    for (const chemin of ['/', '/profil', '/boutique', '/jour', '/campagne', '/edit', `/${s}/souvenir`, `/${s}/bilan`, `/${s}/bilan/fiches`, `/${s}/soirees`]) {
      const html = await lire(chemin)
      assert.ok(de(chemin).length > 0, chemin)
      assert.deepEqual(prechargees(html), de(chemin), chemin)
      assert.match(html, /<div id="root"><div class="center-page"><div class="attente" role="status"><p class="muted">Chargement…<\/p>/, chemin)
    }
    // L'entrée : rien à précharger, le nom de la soirée écrit à sa place.
    const entree = await lire(`/${s}`)
    assert.deepEqual(prechargees(entree), [])
    assert.match(entree, /<div id="root"><div class="join entree"><div class="join-head"><span class="join-eyebrow">[^<]+<\/span><h1 class="join-title[^"]*">[^<]+<\/h1><\/div>/)
    assert.match(entree, /<p class="muted">On arrive…<\/p>/)
    // Une adresse qui ne mène nulle part ne précharge rien.
    const ailleurs = await fetch(`${banc.url}/personne-ici`)
    assert.equal(ailleurs.status, 404)
    assert.deepEqual(prechargees(await ailleurs.text()), [])
  } finally {
    await banc.close()
    rmSync(dist, { recursive: true, force: true })
  }
})

// ── 3. Le quiz du jour et son heure ───────────────────────────────────────

test('la partie du jour que la page a préchargée ne fausse pas son chrono : l’aller-retour se lit dans le préchargement', async () => {
  const { mesureDeLaReponse, tempsDuPrechargement } = await import(client('clock.ts').href)
  // Le Resource Timing du préchargement, au nom de l'adresse.
  const perf = (entrees: object[]) => ({
    timeOrigin: 1_000_000,
    getEntriesByName: (nom: string) => (nom === 'https://banc/api/jour' ? entrees : []),
  })
  const page = 'https://banc/jour'
  assert.deepEqual(tempsDuPrechargement('/api/jour', perf([{ initiatorType: 'link', requestStart: 200, responseStart: 380 }]), page), {
    sentAt: 1_000_200,
    receivedAt: 1_000_380,
  })
  // Un `fetch` n'est pas le préchargement ; sans temps lisibles, rien.
  assert.equal(tempsDuPrechargement('/api/jour', perf([{ initiatorType: 'fetch', requestStart: 200, responseStart: 380 }]), page), null)
  assert.equal(tempsDuPrechargement('/api/jour', perf([{ initiatorType: 'link', requestStart: 0, responseStart: 0 }]), page), null)
  assert.equal(tempsDuPrechargement('/api/jour', perf([]), page), null)

  // Arrivée par son `fetch`, la mesure se cerne autour de lui ; préchargée,
  // elle se lit dans le préchargement — et sans lui, il n'y en a pas : un
  // aller-retour de zéro, que `bestSample` aurait gardé pour le plus juste,
  // décalait toutes les échéances de l'avance qu'avait prise la page.
  const autour = { sentAt: 5_000, receivedAt: 5_040 }
  const prechargement = () => ({ sentAt: 1_000_200, receivedAt: 1_000_380 })
  assert.deepEqual(mesureDeLaReponse({ maintenant: 5_020 }, autour, prechargement), { serverTime: 5_020, ...autour })
  assert.deepEqual(mesureDeLaReponse({ maintenant: 1_000_290, prechargee: true }, autour, prechargement), {
    serverTime: 1_000_290,
    sentAt: 1_000_200,
    receivedAt: 1_000_380,
  })
  assert.equal(mesureDeLaReponse({ maintenant: 1_000_290, prechargee: true }, autour, () => null), null)
  assert.equal(mesureDeLaReponse({}, autour, prechargement), null)
  assert.match(source('api.ts'), /etat: \(\) => avecLHeure\(\(\) => req<PartieDuJour>\(DEPART\.jour\), DEPART\.jour\)/)

  // Le serveur le dit : sans l'en-tête maison, c'est le préchargement.
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'lea', 'Léa')
    const partie = async (entetes: Record<string, string>) =>
      (await (await fetch(`${banc.url}/api/jour`, { headers: { Cookie: cookie, ...entetes } })).json()) as { prechargee?: true; maintenant?: number }
    const prechargee = await partie({})
    assert.equal(prechargee.prechargee, true)
    assert.equal(typeof prechargee.maintenant, 'number')
    assert.equal((await partie({ 'X-Requested-With': 'quizz' })).prechargee, undefined, 'la page, elle, mesure autour de son fetch')
  } finally {
    await banc.close()
  }
})

// ── 4. Plus de demande en file ────────────────────────────────────────────

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, number][][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

test('entre deux soirées, la page de l’espace porte celle de la soirée close : le souvenir ne la redemande plus', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    const [bob, dora] = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙')]
    await jouerQuiz(host, quiz, [
      [
        [bob, 0],
        [dora, 1],
      ],
      [
        [bob, 0],
        [dora, 1],
      ],
    ])
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'La veille' })
    assert.equal((await close).kind, 'info')

    // Les profils muets : la page de la soirée close se sert amputée, jamais
    // gardée — et celle de l'espace qui la porte non plus, sans quoi elle
    // l'aurait montrée amputée jusqu'à son échéance.
    const calculs = async () => ((await (await fetch(`${banc.url}/healthz`)).json()) as any).pages?.calculs as number
    const byIds = ProfileStore.prototype.byIds
    ProfileStore.prototype.byIds = () => Promise.reject(new Error('base muette'))
    try {
      for (let i = 0; i < 2; i++) {
        const avant = await calculs()
        const espace = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/recap.json`)).json()) as any
        assert.equal(espace.derniere?.page?.archive?.title, 'La veille', 'servie quand même')
        assert.equal((await calculs()) - avant, 2, 'ni l’une ni l’autre gardée : la suivante réessaie')
      }
    } finally {
      ProfileStore.prototype.byIds = byIds
    }

    for (const fichier of ['recap.json', 'bilan.json'] as const) {
      const espace = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/${fichier}`)).json()) as any
      assert.equal(espace.derniere?.title, 'La veille', fichier)
      const archivee = await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/${espace.derniere.id}/${fichier}`)).json()
      assert.deepEqual(espace.derniere.page, archivee, `${fichier} : la page de la soirée close part avec celle de l’espace`)
    }
  } finally {
    await banc.close()
  }
})

test('le souvenir de l’espace montre la soirée jointe sans la redemander — et la demande à un serveur d’avant', async () => {
  const avant = { window: (globalThis as { window?: unknown }).window, fetch: globalThis.fetch }
  Object.assign(globalThis, { window: { location: { pathname: '/', search: '', hash: '' } } })
  const appels: string[] = []
  const reponses = new Map<string, unknown>()
  globalThis.fetch = (async (url: string) => {
    appels.push(url)
    return { ok: reponses.has(url), status: reponses.has(url) ? 200 : 404, json: async () => reponses.get(url) }
  }) as unknown as typeof fetch
  try {
    const { lecteurDePage } = await import(client('derniere.ts').href)
    const archivee = { archive: { title: 'La veille' } }
    reponses.set('/s/banc/recap.json', { derniere: { id: 'v', title: 'La veille', heldAt: 1, page: archivee } })
    assert.deepEqual(await lecteurDePage('banc', 'recap.json', null)(), archivee)
    assert.deepEqual(appels, ['/s/banc/recap.json'], 'une seule demande')

    appels.length = 0
    reponses.set('/s/banc/recap.json', { derniere: { id: 'v', title: 'La veille', heldAt: 1 } })
    reponses.set('/s/banc/soirees/v/recap.json', archivee)
    assert.deepEqual(await lecteurDePage('banc', 'recap.json', null)(), archivee)
    assert.deepEqual(appels, ['/s/banc/recap.json', '/s/banc/soirees/v/recap.json'], 'un serveur d’avant : la page à son adresse')
  } finally {
    Object.assign(globalThis, { window: avant.window })
    globalThis.fetch = avant.fetch
  }
})

test('les sentiers partent avec la campagne, une fois ; les onglets du profil avec la boutique', async () => {
  const avant = { window: (globalThis as { window?: unknown }).window, fetch: globalThis.fetch }
  Object.assign(globalThis, {
    window: { location: { pathname: '/campagne', search: '', hash: '#sentiers', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  })
  let demandes = 0
  globalThis.fetch = (async (url: string) => {
    if (url === '/api/campagne/sentiers') demandes++
    return { ok: true, status: 200, text: async () => JSON.stringify({ vies: 12, numero: demandes }) }
  }) as unknown as typeof fetch
  try {
    const { demanderLesSentiers, lesSentiers } = await import(client('views/Sentiers.tsx').href)
    demanderLesSentiers()
    demanderLesSentiers()
    assert.equal(demandes, 1, 'une seule demande d’avance')
    assert.deepEqual(await lesSentiers(), { vies: 12, numero: 1 }, 'le montage reprend celle d’avance')
    assert.equal(demandes, 1)
    assert.deepEqual(await lesSentiers(), { vies: 12, numero: 2 }, 'les suivants redemandent')
  } finally {
    Object.assign(globalThis, { window: avant.window })
    globalThis.fetch = avant.fetch
  }
  // La campagne les demande avec son état, quand elle s'ouvre sur eux.
  assert.match(
    source('views/CampagneApp.tsx'),
    /const etat = api\.campagne\.etat\(\)\n\s*etat\.catch\(\(\) => \{\}\)\n\s*if \(modeDe\(window\.location\.hash\) === 'sentiers'\) demanderLesSentiers\(\)/,
  )
  assert.match(source('views/Sentiers.tsx'), /const lu = await lesSentiers\(\)/)
  // La boutique et un écran du profil n'attendent plus le profil pour demander leurs onglets.
  assert.match(source('views/ProfilApp.tsx'), /if \(profilConnuIci\(\) \|\| VUE === 'boutique' \|\| \(VUE === 'profil' && lireEcran\(\)\)\) void panneaux\.charger\(\)/)
})

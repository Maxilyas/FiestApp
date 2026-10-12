// Ce qu'une page demande dès son arrivée — et ce qu'elle n'attend plus.
//
// Le temps de l'affichage passait à attendre, en file : la page, son script,
// son code, puis ses données, chaque étape partant quand la précédente était
// arrivée (`retours/2026-10-05/affichage-des-pages.md`). Le serveur, qui
// sert la page, y pose maintenant ce qu'elle demandera
// (`<link rel="preload" as="fetch">`, `shared/depart.ts`) et son attente déjà
// écrite (`core/page.ts`) ; la dernière soirée close part avec la page de
// l'espace qui la désigne ; les sentiers partent avec la campagne, les
// onglets du profil avec la boutique ; et l'entrée d'un invité n'attend plus
// sa liaison temps réel pour paraître (`entree.json`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  qcm,
  type Invite,
  type Socket,
} from './banc'
import { ecrireAttente, prechargerDonnees } from '../src/core/page'
import { donneesDeDepart, donneesDuFragment, entreeUtilisable, versLesSentiers, type EntreeDeDepart } from '../../shared/depart'
import { parseRoute } from '../../shared/adresses'
import { BRANCHES } from '../../shared/branches'
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
  // L'entrée d'un invité, son état de départ ; l'écran commun attend sa liaison temps réel, pas une donnée.
  assert.deepEqual(de('/banc'), ['/s/banc/entree.json'])
  for (const c of ['/host', '/tele', '/compte', '/nulle/part/ici']) assert.deepEqual(de(c), [], c)

  // Le préchargement ne sert que si l'adresse est la même, lettre pour
  // lettre : la page les prend au même module.
  const api = source('api.ts')
  for (const cle of ['console', 'moi', 'moiAccueil', 'moiLeger', 'jour', 'campagne', 'sentiers', 'carnet', 'sujets', 'quiz']) {
    assert.match(api, new RegExp(`DEPART\\.${cle}\\b`), `api.ts demande DEPART.${cle}`)
  }
  assert.match(source('themeJoueur.ts'), /fetch\(DEPART\.theme, /)
  assert.match(source('routes.ts'), /return adresseDesDonnees\(slug, file, archiveId\)/)
  // L'entrée la demande à son ouverture, quel que soit le téléphone.
  assert.match(source('views/PlayerApp.tsx'), /await fetch\(dataUrl\(slug, 'entree\.json'\)\)/)
})

test('les sentiers et l’onglet « Apprendre », que le serveur ne peut pas précharger, partent du premier script — par la règle qui les fera demander', () => {
  // `#sentiers` ne parvient pas au serveur : le premier script de la page les
  // précharge (`main.tsx`), une demi-seconde avant le code de la campagne.
  const campagne = parseRoute('/campagne')
  // Les sentiers seuls : les parcours de thème, qui partaient avec eux, sont dans « Apprendre » (le 12 octobre 2026).
  const sentiers = ['/api/campagne/sentiers']
  assert.deepEqual(donneesDuFragment(campagne, '#sentiers'), sentiers)
  for (const b of BRANCHES) assert.deepEqual(donneesDuFragment(campagne, `#sentier-${b.key}`), sentiers, b.key)
  for (const hash of ['', '#defi', '#duel-K7M2QX', '#sentiersx', '#sentier', '#carnets']) assert.deepEqual(donneesDuFragment(campagne, hash), [], hash)
  assert.deepEqual(donneesDuFragment(parseRoute('/profil'), '#sentiers'), [], 'ailleurs que la campagne, rien')
  assert.deepEqual(donneesDuFragment(parseRoute('/profil'), '#carnet'), [], 'ailleurs que la campagne, rien')
  // Les adresses que `Sentiers.tsx` écrit tombent sous la règle.
  assert.match(source('views/Sentiers.tsx'), /export const ADRESSE_DES_SENTIERS = '#sentiers'\nconst PREFIXE = '#sentier-'/)
  assert.ok(versLesSentiers('#sentiers') && versLesSentiers('#sentier-foret'))

  // Le premier script pose le préchargement ; la campagne s'ouvre sur les
  // sentiers par la même règle, et les demande alors à coup sûr : un
  // préchargement qu'elle ne reprendrait pas attendrait son `fetch` suivant.
  assert.match(source('main.tsx'), /for \(const adresse of donneesDuFragment\(route, window\.location\.hash\)\) \{/)
  assert.match(source('main.tsx'), /lien\.rel = 'preload'\n\s*lien\.as = 'fetch'\n\s*lien\.href = adresse\n\s*lien\.crossOrigin = 'anonymous'/)
  // Un défi entre amis (`#duel-K7M2QX`) et sa préparation vivent dans la page des duels : la campagne n'y lit jamais un sentier.
  assert.match(
    source('views/CampagneApp.tsx'),
    /const modeDe = \(hash: string\): Mode =>\s*DUELS\s*\? estLeLancement\(hash\)\s*\? 'defier'\s*: codeDuLien\(hash\)\s*\? 'duel'\s*: 'duels'\s*: hash === ADRESSE_DU_DEFI\s*\? 'defi'\s*: hash === ADRESSE_DU_CARNET\s*\? 'carnet'\s*: versLesSentiers\(hash\)\s*\? 'sentiers'\s*: 'serie'/,
  )
  // L'onglet « Apprendre » (`#carnet`) : son carnet et ses parcours de thème, que sa page demande ensemble à son
  // ouverture, quel que soit le visiteur (`parcours.test.ts`) — par la même adresse que la règle lit.
  assert.deepEqual(donneesDuFragment(campagne, '#carnet'), ['/api/campagne/carnet', '/api/campagne/sujets'], '#carnet')
  assert.match(source('views/Carnet.tsx'), /export const ADRESSE_DU_CARNET = ADRESSE_D_APPRENDRE/)
  // La préparation d'un défi non plus — contre quelqu'un compris (`#defier-<id>`) : elle lit l'état de la campagne, que la page demande toujours.
  assert.deepEqual(donneesDuFragment(campagne, '#defier'), [], '#defier')
  assert.deepEqual(donneesDuFragment(campagne, '#defier-a1b2'), [], '#defier-a1b2')
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
  // Et c'est bien `Patience` que la racine montrerait si une page suspendait.
  assert.match(source('main.tsx'), /<Suspense fallback=\{<Patience texte=\{<p className="muted">Chargement…<\/p>\} \/>\}>/)
})

test('le premier rendu est la page même : son code arrive avant, et React n’a aucune attente à retenir', () => {
  // Une route paresseuse (`lazy`) suspendait au premier rendu : React posait
  // son attente, puis retenait la page au moins trois dixièmes de seconde
  // après elle — même son code déjà en cache, au retour d'un joueur. Le code
  // part dès le démarrage, et l'attente que le serveur a écrite reste à
  // l'écran jusqu'à la page.
  const racine = source('main.tsx')
  assert.doesNotMatch(racine, /\blazy\(/)
  assert.match(racine, /^const code = App\(\)$/m)
  assert.match(racine, /^code\.then\(\n\s*Vue => rendre\(<Page Vue=\{Vue\} \/>\),\n\s*\(erreur: unknown\) => rendre\(<Perdu erreur=\{erreur\} \/>\),\n\)$/m)
  // Un seul rendu de la racine, une fois le code là ; un code perdu tombe dans le filet.
  assert.equal([...racine.matchAll(/\.render\(/g)].length, 1)
  assert.match(racine, /const Perdu = \(\{ erreur \}: \{ erreur: unknown \}\): ReactNode => \{\n\s*throw erreur\n\}/)
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
    // L'entrée : son état de départ préchargé, le nom de la soirée écrit à sa place.
    const entree = await lire(`/${s}`)
    assert.deepEqual(prechargees(entree), [`/s/${s}/entree.json`])
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

test('l’entrée d’un invité part avec la page : ce que la liaison lui dirait, profil compris, sans l’attendre', async () => {
  // Son code arrivé, l'entrée attendait la poignée de main de la liaison et
  // deux échanges : une demi-seconde en 4G, une seconde en 4G lente, sur la
  // page que toute la salle ouvre en même temps.
  const banc = await demarrer()
  try {
    const s = ADMIN.slug
    const entree = (cookie?: string, slug = s) => fetch(`${banc.url}/s/${slug}/entree.json`, cookie ? { headers: { Cookie: cookie } } : {})
    const lea = await invite(banc.url, 'Léa', '🦊')
    // Ce que `party:watch` dit au même instant, à un téléphone sans profil puis avec.
    const regarder = async (cookie?: string) => {
      const tel = connecter(banc.url, cookie)
      const watched = await emitAck<{ ok: boolean; profile?: { name: string } }>(tel, 'party:watch', { slug: s })
      const snapshot = await instantane(tel)
      tel.disconnect()
      return { watched, snapshot }
    }

    const anonyme = await entree()
    assert.equal(anonyme.status, 200)
    // Propre à chaque téléphone — son profil —, et vivante : rien ne la garde en route.
    assert.equal(anonyme.headers.get('cache-control'), 'no-store')
    const sansProfil = (await anonyme.json()) as EntreeDeDepart
    assert.equal(sansProfil.profile, undefined, 'un invité anonyme n’a pas de profil')
    const parLaLiaison = await regarder()
    assert.deepEqual(sansProfil.snapshot, parLaLiaison.snapshot, 'le même instantané que la liaison')
    // L'instantané des téléphones : la salle, sans dire qui est connecté (invariant 4).
    assert.deepEqual(sansProfil.snapshot.players.map(p => p.name), ['Léa'])
    assert.ok(sansProfil.snapshot.players.every(p => !('connected' in p)), 'jamais `connected` aux téléphones')
    assert.equal(sansProfil.snapshot.wifi, null, 'le wifi reste à l’écran commun')

    // Le profil que le cookie reconnaît, comme `party:watch` le salue.
    const cookie = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🦉')
    const avecProfil = (await (await entree(cookie)).json()) as EntreeDeDepart
    const zoe = await regarder(cookie)
    assert.equal(avecProfil.profile?.name, 'Zoé')
    assert.deepEqual(avecProfil.profile, zoe.watched.profile)
    assert.deepEqual(avecProfil.snapshot, zoe.snapshot)

    // Un espace inconnu, ou fermé, n'a pas d'entrée — pas plus qu'à `party:watch`.
    assert.equal((await entree(undefined, 'personne-ici')).status, 404)
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'lea', name: 'Léa', slug: 'chez-lea' }, admin)
    const { account } = (await cree.json()) as { account: { id: string } }
    assert.equal((await entree(undefined, 'chez-lea')).status, 200)
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${account.id}/disable`, {}, admin)).status, 200)
    assert.equal((await entree(undefined, 'chez-lea')).status, 404)
    lea.socket.disconnect()
  } finally {
    await banc.close()
  }
})

test('l’entrée préchargée ne sert qu’au téléphone qui n’a rien à reprendre', () => {
  assert.equal(entreeUtilisable({ jeton: false, fin: false, liaison: false }), true, 'le QR scanné')
  // Un jeton attend sa re-présentation : l'instantané seul montrait la salle
  // d'attente d'un invité que la soirée ne connaît peut-être plus.
  assert.equal(entreeUtilisable({ jeton: true, fin: false, liaison: false }), false, 'un téléphone qui revient')
  assert.equal(entreeUtilisable({ jeton: false, fin: true, liaison: false }), false, 'une fin de soirée gardée')
  assert.equal(entreeUtilisable({ jeton: false, fin: false, liaison: true }), false, 'la liaison, plus fraîche, a parlé')

  // La page s'en sert ainsi, et ne crie pas à la coupure tant que la liaison
  // n'a pas eu le temps de s'ouvrir.
  const page = source('views/PlayerApp.tsx')
  assert.match(page, /if \(perime \|\| !entree \|\| !entreeUtilisable\(\{ jeton: !!me\?\.token, fin: !!fin, liaison \}\)\) return/)
  assert.match(page, /const liaison = presenteeParLaLiaison\.current \|\| !!snapshot/)
  assert.match(page, /<BandeauCoupure connecte=\{s\.connected \|\| premiereLiaison\} \/>/)
})

test('le téléphone qui revient envoie son jeton derrière sa présentation, sans attendre sa réponse : un aller-retour de moins', async () => {
  // Rechargé, réveillé, la page présentait la soirée, attendait sa réponse,
  // puis seulement reprenait sa place : un aller-retour de plus à chaque
  // réveil, en pleine question parfois. La liaison garde l'ordre des
  // messages : les deux partent ensemble.
  const banc = await demarrer()
  try {
    const s = ADMIN.slug
    const lea = await invite(banc.url, 'Léa', '🦊')
    lea.socket.disconnect()
    const tel = connecter(banc.url)
    const [watched, reprise] = await Promise.all([
      emitAck<{ ok: boolean }>(tel, 'party:watch', { slug: s }),
      emitAck<{ ok: boolean; playerId: string; token: string; name: string }>(tel, 'player:join', { slug: s, token: lea.token }),
    ])
    assert.equal(watched.ok, true)
    assert.equal(reprise.ok, true)
    assert.equal(reprise.playerId, lea.playerId, 'sa place, pas une nouvelle')
    assert.equal(reprise.name, 'Léa')
    const snapshot = await instantane<{ players: { id: string }[] }>(tel, sn => sn.players.some(p => p.id === lea.playerId))
    assert.equal(snapshot.players.length, 1, 'personne de plus dans la salle')
    // Un jeton que la soirée ne connaît plus se refuse de même : le téléphone repasse par l'entrée.
    const autre = connecter(banc.url)
    const [, refus] = await Promise.all([
      emitAck(autre, 'party:watch', { slug: s }),
      emitAck<{ ok: boolean; reason?: string }>(autre, 'player:join', { slug: s, token: 'jeton-inconnu' }),
    ])
    assert.equal(refus.ok, false)
    assert.equal(refus.reason, 'unknown-token')
    tel.disconnect()
    autre.disconnect()
  } finally {
    await banc.close()
  }
  // La page les envoie ainsi.
  assert.match(
    source('views/PlayerApp.tsx'),
    /const presentation = watchParty\(slug\)\n(?:\s*\/\/[^\n]*\n)*\s*const reprise = token \? representer\(token\)\.catch\(\(\) => \{\}\) : undefined\n\s*const watched = await presentation\n/,
  )
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
  let sujets = 0
  globalThis.fetch = (async (url: string) => {
    if (url === '/api/campagne/sentiers') demandes++
    if (url === '/api/campagne/sujets') sujets++
    return { ok: true, status: 200, text: async () => JSON.stringify({ vies: 12, numero: demandes }) }
  }) as unknown as typeof fetch
  try {
    const { demanderLesSentiers, lesSentiers } = await import(client('views/Sentiers.tsx').href)
    demanderLesSentiers()
    demanderLesSentiers()
    assert.equal(demandes, 1, 'une seule demande d’avance')
    assert.equal(sujets, 0, 'les parcours de thème ne partent plus avec eux : ils sont dans « Apprendre »')
    assert.deepEqual(await lesSentiers(), { vies: 12, numero: 1 }, 'le montage reprend celle d’avance')
    assert.equal(demandes, 1)
    assert.deepEqual(await lesSentiers(), { vies: 12, numero: 2 }, 'les suivants redemandent')
  } finally {
    Object.assign(globalThis, { window: avant.window })
    globalThis.fetch = avant.fetch
  }
  // La campagne les demande avec son état, quand elle s'ouvre sur eux ; les duels, servis par le même code, ne demandent ni l'un ni l'autre.
  assert.match(
    source('views/CampagneApp.tsx'),
    /const etat = DUELS \? null : api\.campagne\.etat\(\)\n\s*etat\?\.catch\(\(\) => \{\}\)\n\s*if \(!DUELS && modeDe\(window\.location\.hash\) === 'sentiers'\) demanderLesSentiers\(\)/,
  )
  assert.match(source('views/Sentiers.tsx'), /const lu = await lesSentiers\(\)/)
  assert.doesNotMatch(source('views/Sentiers.tsx'), /lesSujets|api\.campagne\.sujets/, 'un préchargement que la page ne reprendrait pas partirait pour rien')
  // La boutique et un écran du profil n'attendent plus le profil pour demander leurs onglets —
  // jamais l'accueil, qui n'en montre rien (`campagne-ouverture.test.ts`).
  assert.match(source('views/ProfilApp.tsx'), /if \(VUE === 'boutique' \|\| \(VUE === 'profil' && \(profilConnuIci\(\) \|\| lireEcran\(\)\)\)\) void panneaux\.charger\(\)/)
})

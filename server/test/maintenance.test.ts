// Le bandeau et la maintenance (`/admin#maintenance`, le souhait du
// propriétaire du 19 octobre 2026, le jour où le quiz du jour et les défis ne
// s'ouvraient plus en production) : un bandeau rouge que l'administrateur pose
// pour prévenir les joueurs, et des pages qu'il ferme le temps d'une
// réparation — « pour pas que les gens tentent d'accéder à quelque chose qui
// ne marche pas ».
//
// Le serveur écrit l'un et l'autre dans chaque page qu'il sert ; ces épreuves
// lisent donc les pages d'un client minimal, qui tient lieu de construit
// (`clientDist`), et jouent les routes comme le ferait un téléphone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createECDH, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import express from 'express'
import React from 'react'
import { ADMIN, baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { parseRoute } from '../../shared/adresses'
import {
  BANDEAU_MAX,
  PAGES_EN_MAINTENANCE,
  ceQuiEstPose,
  ecrireLesFermees,
  lireLesFermees,
  montreLeBandeau,
  pageDeLAdresse,
  type EtatDeLaMaintenance,
} from '../../shared/maintenance'
import { ecrireLeService } from '../src/core/page'
import { lireLeBandeau } from '../src/core/maintenance'
import { PORTES_DES_PAGES } from '../src/maintenance'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

// L'application Express du serveur, attrapée à sa première requête, comme `journal.test.ts`.
let application: { _router: { stack: { route?: { path: string | string[]; methods: Record<string, boolean> } }[] } } | null = null
const traiter = (express as any).application.handle
;(express as any).application.handle = function (this: any, ...args: unknown[]) {
  application ??= this
  return traiter.apply(this, args)
}

const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>FiestApp</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

/** Un banc qui sert des pages : un client minimal tient lieu de construit. */
async function bancAvecPages(opts: Parameters<typeof demarrer>[0] = {}) {
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), PAGE)
  const banc = await demarrer({ clientDist: dist, ...opts })
  return {
    banc,
    page: async (chemin: string, cookie?: string) => (await fetch(banc.url + chemin, cookie ? { headers: { Cookie: cookie } } : {})).text(),
    async fermer() {
      await banc.close()
      rmSync(dist, { recursive: true, force: true })
    },
  }
}

const bandeau = (banc: Banc, admin: string, texte: string | null) =>
  ecrire(banc.url, '/api/admin/maintenance/bandeau', { texte }, admin, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const fermer = (banc: Banc, admin: string, page: string, fermee = true) =>
  ecrire(banc.url, `/api/admin/maintenance/pages/${page}`, { fermee }, admin, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Le texte du bandeau rouge d'une page servie, s'il y en a un. */
const leBandeau = (html: string) => /<div class="bandeau-du-service" role="status">([^<]*)<\/div>/.exec(html)?.[1] ?? null

// ── 1. Les règles ─────────────────────────────────────────────────────────

test('chaque adresse dit sa page à fermer, et le bandeau se montre partout hors d’une soirée', () => {
  assert.deepEqual(
    ['/jour', '/campagne', '/duels', '/expedition', '/boutique', '/', '/profil', '/salon', '/admin', '/host'].map(a => pageDeLAdresse(parseRoute(a))),
    ['jour', 'campagne', 'duels', 'expedition', 'boutique', null, null, null, null, null],
    'le défi n’a pas d’adresse à lui : son onglet se dit dans le fragment, que le serveur ne reçoit pas',
  )
  for (const a of ['/', '/profil', '/boutique', '/jour', '/campagne', '/duels', '/expedition', '/salon', '/edit', '/compte', '/admin', '/connexion', '/nulle/part/ici']) {
    assert.equal(montreLeBandeau(parseRoute(a)), true, a)
  }
  // Ni le téléphone d'un invité, ni l'écran commun, ni les pages publiques d'une soirée.
  for (const a of ['/banc', '/host', '/tele', '/banc/souvenir', '/banc/bilan', '/banc/soirees', '/banc/soirees/abc']) assert.equal(montreLeBandeau(parseRoute(a)), false, a)
  // Les pages fermées s'écrivent dans l'ordre du QG, et se relisent sans ce qui n'en est pas une.
  assert.equal(ecrireLesFermees(['boutique', 'jour', 'jour']), 'jour boutique')
  assert.deepEqual(lireLesFermees('jour  defi soirees <script>'), ['jour', 'defi'])
  assert.deepEqual(lireLesFermees(null), [])
  assert.equal(ceQuiEstPose({ bandeau: { texte: 'x', depuis: 0 }, pages: { jour: 1, campagne: null, defi: 2, duels: null, expedition: null, boutique: null } }), 3)
})

test('un bandeau se lit resserré, et trop long se refuse plutôt que de se couper au milieu d’un mot', () => {
  assert.equal(lireLeBandeau('  Le quiz du jour\n\nest   en panne  '), 'Le quiz du jour est en panne')
  assert.equal(lireLeBandeau('   '), null)
  assert.equal(lireLeBandeau(42), null)
  assert.equal(lireLeBandeau('é'.repeat(BANDEAU_MAX)), 'é'.repeat(BANDEAU_MAX))
  assert.throws(() => lireLeBandeau('é'.repeat(BANDEAU_MAX + 1)), /tient en 140 caractères/)
})

test('le bandeau s’écrit au-dessus de la racine, échappé : l’administrateur l’écrit, tout le monde le lit', () => {
  const page = ecrireLeService(PAGE, { bandeau: '<script>alert(1)</script> & « $& »', fermees: [], admin: false, ici: null })
  assert.ok(!page.includes('<script>'), page)
  assert.match(page, /<div class="bandeau-du-service" role="status">&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; « \$&amp; »<\/div><div id="root"><\/div>/)
  assert.doesNotMatch(page, /name="maintenance/, 'rien de fermé : pas de balise')
  // Une page fermée : la balise pour tous, et pour l'administrateur qui y entre, sa ligne à lui.
  const fermee = ecrireLeService(PAGE, { bandeau: null, fermees: ['jour', 'defi'], admin: true, ici: 'jour' })
  assert.match(fermee, /<meta name="maintenance" content="jour defi">/)
  assert.match(fermee, /<meta name="maintenance-passe" content="oui">/)
  assert.match(fermee, /class="bandeau-du-service bandeau-administrateur"[^>]*>Le quiz du jour est en maintenance pour les joueurs : toi seul y entres/)
  assert.ok(fermee.indexOf('name="maintenance"') < fermee.indexOf('</head>'))
  assert.equal(leBandeau(fermee), null, 'le bandeau rouge reste à l’administrateur : sans lui, rien de rouge')
  const pourUnJoueur = ecrireLeService(PAGE, { bandeau: null, fermees: ['jour'], admin: false, ici: 'jour' })
  assert.doesNotMatch(pourUnJoueur, /maintenance-passe|bandeau-administrateur/)
})

// ── 2. Les pages servies ──────────────────────────────────────────────────

test('le bandeau posé au QG paraît en tête de chaque page hors d’une soirée, survit au réveil, et se retire', async () => {
  const { banc, page, fermer: eteindre } = await bancAvecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    for (const chemin of ['/', '/jour', '/admin']) assert.equal(leBandeau(await page(chemin)), null, chemin)

    const pose = await bandeau(banc, admin, '  Le quiz du jour est en panne : on répare, merci de votre patience !  ')
    assert.equal(pose.status, 200)
    assert.equal((pose.corps as EtatDeLaMaintenance).bandeau?.texte, 'Le quiz du jour est en panne : on répare, merci de votre patience !')
    // La typographie se pose à l'affichage : l'espace fine devant le deux-points et le point d'exclamation.
    const attendu = 'Le quiz du jour est en panne : on répare, merci de votre patience !'
    for (const chemin of ['/', '/profil', '/boutique', '/jour', '/campagne', '/duels', '/salon', '/edit', '/compte', '/admin']) {
      assert.equal(leBandeau(await page(chemin)), attendu, chemin)
    }
    // Jamais pendant une soirée : ni le téléphone d'un invité, ni l'écran commun, ni ses pages publiques.
    for (const chemin of [`/${ADMIN.slug}`, '/host', '/tele', `/${ADMIN.slug}/souvenir`, `/${ADMIN.slug}/bilan`]) {
      assert.doesNotMatch(await page(chemin), /bandeau-du-service/, chemin)
    }

    // La base permanente le garde : le disque effacé d'un réveil ne l'emporte pas.
    await banc.redemarrer({ disqueEfface: true })
    assert.equal(leBandeau(await page('/')), attendu)

    // Le même texte, ou rien à retirer : refusé, et rien ne va au journal.
    const admin2 = await connexionAnimateur(banc.url)
    assert.equal((await bandeau(banc, admin2, 'Le quiz du jour est en panne : on répare, merci de votre patience !')).status, 400)
    assert.equal((await bandeau(banc, admin2, 'x'.repeat(BANDEAU_MAX + 1))).status, 400)
    assert.equal((await bandeau(banc, admin2, '   ')).status, 400)
    assert.equal((await bandeau(banc, admin2, null)).status, 200)
    assert.equal((await bandeau(banc, admin2, null)).status, 400, 'aucun bandeau à retirer')
    assert.equal(leBandeau(await page('/')), null)
  } finally {
    await eteindre()
  }
})

test('une page fermée se sert sans rien précharger, et l’administrateur y entre encore — sa ligne le lui dit', async () => {
  const { banc, page, fermer: eteindre } = await bancAvecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    const ouverte = await page('/jour')
    assert.match(ouverte, /<link rel="preload" as="fetch" href="\/api\/jour"/)
    assert.doesNotMatch(ouverte, /name="maintenance"/)

    assert.equal((await fermer(banc, admin, 'jour')).status, 200)
    const fermee = await page('/jour')
    assert.match(fermee, /<meta name="maintenance" content="jour">/)
    assert.doesNotMatch(fermee, /rel="preload" as="fetch"/, 'l’écran de la maintenance ne demandera rien')
    assert.doesNotMatch(fermee, /maintenance-passe|bandeau-administrateur/)
    // L'accueil le sait aussi : son bouton le dit.
    assert.match(await page('/'), /<meta name="maintenance" content="jour">/)

    // L'administrateur, par sa console : la page s'ouvre, préchargée, et le lui rappelle.
    const pourLui = await page('/jour', admin)
    assert.match(pourLui, /<meta name="maintenance-passe" content="oui">/)
    assert.match(pourLui, /rel="preload" as="fetch" href="\/api\/jour"/)
    assert.match(pourLui, /bandeau-administrateur[^>]*>Le quiz du jour est en maintenance pour les joueurs/)
    // Sur une page ouverte, il n'a rien à lire de plus.
    assert.doesNotMatch(await page('/campagne', admin), /bandeau-administrateur/)

    assert.equal((await fermer(banc, admin, 'jour')).status, 400, 'déjà fermée : rien ne change, rien au journal')
    assert.equal((await fermer(banc, admin, 'soirees')).status, 400, 'une page qui ne se ferme pas')
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/jour', {}, admin, 'PUT')).status, 400, 'ni fermer ni rouvrir : on ne devine pas')

    // Fermée, elle le reste après un réveil ; rouverte, elle se sert comme avant.
    await banc.redemarrer({ disqueEfface: true })
    assert.match(await page('/jour'), /<meta name="maintenance" content="jour">/)
    const etat = await fermer(banc, await connexionAnimateur(banc.url), 'jour', false)
    assert.equal(etat.status, 200)
    assert.equal((etat.corps as EtatDeLaMaintenance).pages.jour, null)
    assert.match(await page('/jour'), /rel="preload" as="fetch" href="\/api\/jour"/)
  } finally {
    await eteindre()
  }
})

// ── 3. Les portes ─────────────────────────────────────────────────────────

test('une page fermée ferme ce qui y commence — 423 et son motif, jamais 503 —, laisse finir ce qui est commencé, et l’administrateur passe', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    // Léa commence son quiz du jour avant la fermeture : sa partie se finira.
    const commencee = (await (await ecrire(banc.url, '/api/jour/commencer', {}, lea)).json()) as { question: { jour: string; index: number } }
    assert.ok(commencee.question)

    assert.equal((await fermer(banc, admin, 'jour')).status, 200)
    const refus = await ecrire(banc.url, '/api/jour/commencer', {}, lea)
    assert.equal(refus.status, 423)
    assert.deepEqual(await refus.json(), { error: 'Le quiz du jour est en maintenance : reviens un peu plus tard', maintenance: 'jour' })
    // Lue comme Express la lit : la casse et la barre finale ne la contournent pas.
    assert.equal((await ecrire(banc.url, '/API/Jour/Commencer/', {}, lea)).status, 423)
    // Sa question déjà à l'écran se répond, sa page se relit.
    assert.equal((await ecrire(banc.url, '/api/jour/repondre', { jour: commencee.question.jour, index: commencee.question.index, choix: 0 }, lea)).status, 200)
    assert.equal((await fetch(`${banc.url}/api/jour`, { headers: { Cookie: lea } })).status, 200)
    // L'administrateur passe, par la session de sa console : le refus qu'il reçoit est celui de la route, pas la porte.
    assert.notEqual((await ecrire(banc.url, '/api/jour/commencer', {}, admin)).status, 423)

    // La campagne fermée ferme aussi le défi de la semaine, qui vit dans sa page ; le défi seul, le défi seul.
    assert.equal((await fermer(banc, admin, 'campagne')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/campagne/serie', { categories: [] }, lea)).status, 423)
    assert.equal((await ecrire(banc.url, '/api/campagne/defi', {}, lea)).status, 423)
    assert.equal((await fermer(banc, admin, 'campagne', false)).status, 200)
    assert.equal((await fermer(banc, admin, 'defi')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/campagne/defi', {}, lea)).status, 423)
    assert.equal((await ecrire(banc.url, '/api/campagne/serie', { categories: [] }, lea)).status, 200, 'le reste de la campagne reste ouvert')
    // Les duels : `:code` vaut un segment.
    assert.equal((await fermer(banc, admin, 'duels')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/campagne/duel/K7M2QX', {}, lea)).status, 423)

    // Tout rouvert, plus rien ne ferme.
    for (const p of ['jour', 'defi', 'duels']) assert.equal((await fermer(banc, admin, p, false)).status, 200, p)
    assert.notEqual((await ecrire(banc.url, '/api/campagne/defi', {}, lea)).status, 423)
  } finally {
    await banc.close()
  }
})

test('chaque porte d’une page en maintenance est une route du serveur — lue dans le routeur', async () => {
  // Une route renommée sortirait en silence de la porte : la page fermée
  // laisserait recommencer ce qui ne marche pas.
  const banc = await demarrer()
  try {
    await fetch(`${banc.url}/healthz`)
    assert.ok(application, 'l’application a servi une requête')
    const routes = new Set(
      application._router.stack.flatMap(c => {
        const r = c.route
        if (!r || typeof r.path !== 'string') return []
        return Object.keys(r.methods).map(m => `${m.toUpperCase()} ${r.path}`)
      }),
    )
    const absentes = PAGES_EN_MAINTENANCE.flatMap(p => PORTES_DES_PAGES[p].filter(porte => !routes.has(porte)).map(porte => `${p} : ${porte}`))
    assert.deepEqual(absentes, [])
    assert.ok(PAGES_EN_MAINTENANCE.every(p => PORTES_DES_PAGES[p].length > 0), 'chaque page ferme au moins une porte')
  } finally {
    await banc.close()
  }
})

// ── 4. Le rappel du soir ──────────────────────────────────────────────────

/** Paris, l'heure qu'on veut : septembre, UTC+2. */
const aParis = (jour: number, heure: number, minute = 0) => Date.UTC(2026, 8, jour, heure - 2, minute)

test('le quiz du jour en maintenance, le rappel du soir attend : rouvert avant la fin du rappel, il part', async () => {
  // Un service de push sur la machine, qui compte ce qu'il reçoit.
  const recus: string[] = []
  const service = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      recus.push(req.url ?? '')
      res.statusCode = 201
      res.end()
    })
  })
  await new Promise<void>(resolve => service.listen(0, '127.0.0.1', resolve))
  const horloge = { t: aParis(26, 10) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, rappels: { intervalleMs: 20, servicesDePush: url => url.hostname === '127.0.0.1' } })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    const abonnement = {
      endpoint: `http://127.0.0.1:${(service.address() as AddressInfo).port}/push/lea`,
      expirationTime: null,
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
    }
    assert.equal((await ecrire(banc.url, '/api/jour/rappel', { abonnement }, lea)).status, 200)
    assert.equal((await fermer(banc, admin, 'jour')).status, 200)

    horloge.t = aParis(26, 18, 5)
    await patienter(300)
    assert.deepEqual(recus, [], '« Ton quiz du jour t’attend » vers une page fermée : rien ne part')

    assert.equal((await fermer(banc, admin, 'jour', false)).status, 200)
    const fin = Date.now() + 10_000
    while (recus.length === 0 && Date.now() < fin) await patienter(20)
    assert.deepEqual(recus, ['/push/lea'], 'rien n’était réservé : la tournée part dès la réouverture')
  } finally {
    await banc.close()
    await new Promise<void>(resolve => service.close(() => resolve()))
  }
})

// ── 5. L'accueil ──────────────────────────────────────────────────────────

test('à l’accueil, une page en maintenance éteint son bouton et le dit ; le défi fermé seul ne se propose plus', async () => {
  // Le client lit son adresse une fois, au chargement : posée avant l'import, après les serveurs du banc.
  Object.assign(globalThis, { window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc' }, opener: null } })
  const module = await import(new URL('../../client/src/components/AccueilDesRoles.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const campagne = { vies: 11, avance: null, defi: { joueurs: 12, neuf: true } }
  const accueil = (fermees: string[]) =>
    renderToStaticMarkup(
      React.createElement(module.AccueilJouer, {
        enCours: [],
        onRejoindre: () => {},
        lendemain: null,
        campagne,
        jour: { serie: 3, jours: [] },
        duels: { joues: 0, defisRecus: { n: 2, de: 'Léa' } },
        fermees: new Set(fermees),
      }),
    )
  const bouton = (html: string, titre: string) => html.split('<a ').find(x => x.includes(`<b>${titre}</b>`))!

  const ouvert = accueil([])
  assert.doesNotMatch(ouvert, /gros-ferme|En maintenance/)
  assert.match(bouton(ouvert, 'La campagne'), /href="\/campagne#defi"/)

  const ferme = accueil(['jour', 'duels'])
  for (const titre of ['Le quiz du jour', 'Les duels']) {
    const b = bouton(ferme, titre)
    assert.match(b, /class="gros-bouton gros-ferme"/, titre)
    assert.match(b, /<span class="gros-detail">En maintenance : reviens un peu plus tard<\/span>/, titre)
  }
  // Ni « À jouer », ni les défis reçus comptés en rouge : ils inviteraient à entrer.
  assert.doesNotMatch(bouton(ferme, 'Le quiz du jour'), /À jouer/)
  assert.doesNotMatch(bouton(ferme, 'Les duels'), /gros-compteur/)
  assert.doesNotMatch(bouton(ferme, 'La campagne'), /gros-ferme/)

  const sansLeDefi = bouton(accueil(['defi']), 'La campagne')
  assert.doesNotMatch(sansLeDefi, /#defi|défi de la semaine/)
  assert.doesNotMatch(sansLeDefi, /gros-ferme/, 'le reste de la campagne reste ouvert')
  assert.match(bouton(accueil(['campagne']), 'La campagne'), /class="gros-bouton gros-ferme" href="\/campagne"/)
})

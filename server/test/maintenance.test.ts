// Le bandeau et la maintenance (`/admin#maintenance`, le souhait du
// propriétaire du 19 octobre 2026, le jour où le quiz du jour et les défis ne
// s'ouvraient plus en production) : un bandeau rouge que l'administrateur pose
// pour prévenir les joueurs, et des pages qu'il ferme le temps d'une
// réparation — « pour pas que les gens tentent d'accéder à quelque chose qui
// ne marche pas ». Puis, le même jour, des pages bientôt disponibles —
// l'Expédition, qu'il essayait encore —, ouvertes à leurs seuls testeurs :
// « autoriser l'accès à des personnes si je veux qu'ils testent ». Remplacée
// par le Cabinet, l'Expédition a quitté le QG le 1er novembre 2026 : les
// duels tiennent ici son rôle d'exemple.
//
// Le serveur écrit l'un et l'autre dans chaque page qu'il sert ; ces épreuves
// lisent donc les pages d'un client minimal, qui tient lieu de construit
// (`clientDist`), et jouent les routes comme le ferait un téléphone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createECDH, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import express from 'express'
import React from 'react'
import { ADMIN, baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { parseRoute } from '../../shared/adresses'
import {
  BANDEAU_MAX,
  PAGES_EN_MAINTENANCE,
  boutonDeLaPage,
  ceQuiEstPose,
  ecrireLesFermees,
  fermeePour,
  lireLesFermees,
  montreLeBandeau,
  pageDeLAdresse,
  type EtatDeLaMaintenance,
  type VuDuService,
} from '../../shared/maintenance'
import { ecrireLeService } from '../src/core/page'
import { Maintenance, lireLeBandeau } from '../src/core/maintenance'
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
// `{ fermee }`, le corps d'une page du QG d'avant les pages bientôt disponibles : il vaut toujours.
const fermer = (banc: Banc, admin: string, page: string, fermee = true) =>
  ecrire(banc.url, `/api/admin/maintenance/pages/${page}`, { fermee }, admin, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const changer = (banc: Banc, admin: string, page: string, etat: string) =>
  ecrire(banc.url, `/api/admin/maintenance/pages/${page}`, { etat }, admin, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const testeur = (banc: Banc, admin: string, page: string, id: string, methode: 'PUT' | 'DELETE' = 'PUT') =>
  ecrire(banc.url, `/api/admin/maintenance/pages/${page}/testeurs/${id}`, undefined, admin, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const idDe = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id as string

/** Le texte du bandeau rouge d'une page servie, s'il y en a un. */
const leBandeau = (html: string) => /<div class="bandeau-du-service" role="status">([^<]*)<\/div>/.exec(html)?.[1] ?? null

// ── 1. Les règles ─────────────────────────────────────────────────────────

test('chaque adresse dit sa page à fermer, et le bandeau se montre partout hors d’une soirée', () => {
  assert.deepEqual(
    ['/jour', '/campagne', '/duels', '/cabinet', '/boutique', '/', '/profil', '/salon', '/admin', '/host', '/expedition'].map(a => pageDeLAdresse(parseRoute(a))),
    ['jour', 'campagne', 'duels', 'cabinet', 'boutique', null, null, null, null, null, null],
    'le défi n’a pas d’adresse à lui : son onglet se dit dans le fragment, que le serveur ne reçoit pas — ni l’Expédition, remplacée par le Cabinet, une page que le QG ne ferme plus',
  )
  assert.ok(!(PAGES_EN_MAINTENANCE as readonly string[]).includes('expedition'), 'son départ fermé partout, sa ligne au QG ne fermait plus rien')
  for (const a of ['/', '/profil', '/boutique', '/jour', '/campagne', '/duels', '/expedition', '/cabinet', '/salon', '/edit', '/compte', '/admin', '/connexion', '/nulle/part/ici']) {
    assert.equal(montreLeBandeau(parseRoute(a)), true, a)
  }
  // Ni le téléphone d'un invité, ni l'écran commun, ni les pages publiques d'une soirée.
  for (const a of ['/banc', '/host', '/tele', '/banc/souvenir', '/banc/bilan', '/banc/soirees', '/banc/soirees/abc']) assert.equal(montreLeBandeau(parseRoute(a)), false, a)
  // Les pages fermées s'écrivent dans l'ordre du QG, et se relisent sans ce qui n'en est pas une.
  assert.equal(ecrireLesFermees(['boutique', 'jour', 'jour']), 'jour boutique')
  assert.deepEqual(lireLesFermees('jour  defi soirees <script>'), ['jour', 'defi'])
  assert.deepEqual(lireLesFermees(null), [])
  assert.equal(ceQuiEstPose({ bandeau: { texte: 'x', depuis: 0 }, pages: { jour: 1, campagne: null, defi: 2, duels: null, cabinet: null, boutique: null } }), 3)
})

test('un bandeau se lit resserré, et trop long se refuse plutôt que de se couper au milieu d’un mot', () => {
  assert.equal(lireLeBandeau('  Le quiz du jour\n\nest   en panne  '), 'Le quiz du jour est en panne')
  assert.equal(lireLeBandeau('   '), null)
  assert.equal(lireLeBandeau(42), null)
  assert.equal(lireLeBandeau('é'.repeat(BANDEAU_MAX)), 'é'.repeat(BANDEAU_MAX))
  assert.throws(() => lireLeBandeau('é'.repeat(BANDEAU_MAX + 1)), /tient en 140 caractères/)
})

test('le bandeau s’écrit au-dessus de la racine, échappé : l’administrateur l’écrit, tout le monde le lit', () => {
  const page = ecrireLeService(PAGE, { bandeau: '<script>alert(1)</script> & « $& »', fermees: [], bientot: [], admin: false, avantPremiere: [], ici: null })
  assert.ok(!page.includes('<script>'), page)
  assert.match(page, /<div class="bandeau-du-service" role="status">&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; « \$&amp; »<\/div><div id="root"><\/div>/)
  assert.doesNotMatch(page, /name="maintenance/, 'rien de fermé : pas de balise')
  // Une page fermée : la balise pour tous, et pour l'administrateur qui y entre, sa ligne à lui.
  const fermee = ecrireLeService(PAGE, { bandeau: null, fermees: ['jour', 'defi'], bientot: [], admin: true, avantPremiere: [], ici: 'jour' })
  assert.match(fermee, /<meta name="maintenance" content="jour defi">/)
  assert.match(fermee, /<meta name="maintenance-passe" content="oui">/)
  assert.match(fermee, /class="bandeau-du-service bandeau-administrateur"[^>]*>Le quiz du jour est en maintenance pour les joueurs : toi seul y entres/)
  assert.ok(fermee.indexOf('name="maintenance"') < fermee.indexOf('</head>'))
  assert.equal(leBandeau(fermee), null, 'le bandeau rouge reste à l’administrateur : sans lui, rien de rouge')
  const pourUnJoueur = ecrireLeService(PAGE, { bandeau: null, fermees: ['jour'], bientot: [], admin: false, avantPremiere: [], ici: 'jour' })
  assert.doesNotMatch(pourUnJoueur, /maintenance-passe|bandeau-administrateur/)

  // Bientôt disponible : sa balise pour tous, celle d'un testeur pour lui seul — jamais la liste des testeurs.
  const bientot = ecrireLeService(PAGE, { bandeau: null, fermees: [], bientot: ['cabinet', 'duels'], admin: false, avantPremiere: [], ici: null })
  assert.match(bientot, /<meta name="bientot" content="duels cabinet">/, 'dans l’ordre du QG')
  assert.doesNotMatch(bientot, /name="maintenance"|avant-premiere|bandeau-administrateur/)
  const pourSonTesteur = ecrireLeService(PAGE, { bandeau: null, fermees: [], bientot: ['cabinet'], admin: false, avantPremiere: ['cabinet'], ici: null })
  assert.match(pourSonTesteur, /<meta name="avant-premiere" content="cabinet">/)
  assert.doesNotMatch(pourSonTesteur, /maintenance-passe/)
  // L'administrateur y entre, sans ligne à lire : rien n'y est cassé, et le QG lui dit ce qu'il a posé.
  const pourLui = ecrireLeService(PAGE, { bandeau: null, fermees: [], bientot: ['cabinet'], admin: true, avantPremiere: [], ici: null })
  assert.match(pourLui, /<meta name="maintenance-passe" content="oui">/)
  assert.doesNotMatch(pourLui, /bandeau-du-service/)
})

test('le bandeau passe au-dessus du décor de chaque thème — leurs couches fixes recouvraient tout ce qui n’est pas dans la racine', () => {
  // Sous Le Sommet, la montagne peinte couvrait le bandeau : il ne restait que
  // sa place, une barre vide (le retour du propriétaire du 19 octobre 2026). Un
  // thème peint son décor en couches fixes, au niveau 0 (`html::before`,
  // `body::before`, `body::after`), et remonte `#root` au niveau 1 ; le bandeau,
  // posé avant `#root`, restait dans le flux, sous elles.
  const lire = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
  const regle = /\n\.bandeau-du-service \{([^}]*)\}/.exec(lire('styles.css'))?.[1] ?? ''
  assert.match(regle, /position: relative;/, 'sans position, son niveau ne vaut rien')
  const niveau = Number(/z-index: (-?\d+);/.exec(regle)?.[1] ?? Number.NaN)
  assert.ok(niveau >= 1, `le bandeau au niveau ${niveau}`)
  const fautes: string[] = []
  const themes = readdirSync(new URL('../../client/src/themes/', import.meta.url)).filter(f => f.endsWith('.css'))
  assert.ok(themes.length >= 30, `${themes.length} feuilles de thème`)
  for (const fichier of themes) {
    for (const [, selecteurs, corps] of lire(`themes/${fichier}`).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // Les couches du décor, posées hors de la racine : sur la page, sur son corps.
      const decor = selecteurs.split(',').some(s => /(\]|html|body)::(before|after)$/.test(s.trim()))
      const z = /z-index:\s*(-?\d+)/.exec(corps)
      if (decor && z && Number(z[1]) >= niveau) fautes.push(`${fichier} : ${selecteurs.trim()} au niveau ${z[1]}`)
    }
  }
  assert.deepEqual(fautes, [])
})

test('une fois la page là, le bandeau se reprend dans la racine, tel que le serveur l’a écrit : le voile d’un thème peint ne le couvre plus', async () => {
  // Hors de `#root`, le voile de nuit du Sommet — une couche de `#root`, que
  // le thème remonte d'un niveau — l'effaçait encore : une barre sombre.
  const { renderToStaticMarkup } = await import('react-dom/server')
  const composant = new URL('../../client/src/components/BandeauxDuService.tsx', import.meta.url).href
  const avant = (globalThis as { document?: unknown }).document
  const poses = [
    { className: 'bandeau-du-service', textContent: 'Le quiz du jour est en panne : on répare' },
    { className: 'bandeau-du-service bandeau-administrateur', textContent: 'Le quiz du jour est en maintenance pour les joueurs' },
  ]
  try {
    // Ceux d'avant la racine seulement : l'aperçu du QG en porte la classe, dans la page.
    Object.assign(globalThis, { document: { querySelectorAll: (sel: string) => (sel === 'body > .bandeau-du-service' ? poses : []) } })
    const { BandeauxDuService } = await import(`${composant}?poses`)
    assert.equal(
      renderToStaticMarkup(React.createElement(BandeauxDuService)),
      '<div><div class="bandeau-du-service" role="status">Le quiz du jour est en panne : on répare</div>' +
        '<div class="bandeau-du-service bandeau-administrateur" role="status">Le quiz du jour est en maintenance pour les joueurs</div></div>',
    )
  } finally {
    Object.assign(globalThis, { document: avant })
  }
  // Sans bandeau posé — une soirée, l'écran commun, `npm run dev` —, rien.
  const { BandeauxDuService: aucun } = await import(`${composant}?aucun`)
  assert.equal(renderToStaticMarkup(React.createElement(aucun)), '')
  // La racine le rend avant tout le reste, hors du filet : une page qui tombe le garde.
  assert.match(
    readFileSync(new URL('../../client/src/main.tsx', import.meta.url), 'utf8'),
    /racine\.render\(\s*<React\.StrictMode>\s*\{\/\*[^*]*\*\/\}\s*<BandeauxDuService \/>\s*<Filet>/,
  )
})

test('une page bientôt disponible n’est fermée qu’à qui attend : ses testeurs et l’administrateur y entrent', () => {
  const vu = (v: Partial<VuDuService>): VuDuService => ({ fermees: ['jour'], bientot: ['cabinet'], admin: false, avantPremiere: [], ...v })
  const joueur = vu({})
  assert.deepEqual(
    PAGES_EN_MAINTENANCE.map(p => [fermeePour(joueur, p), boutonDeLaPage(joueur, p)]),
    // Dans l'ordre du QG : le quiz du jour, la campagne, le défi, les duels, le Cabinet, la boutique.
    [['maintenance', 'maintenance'], [null, null], [null, null], [null, null], ['bientot', 'bientot'], [null, null]],
  )
  // Son testeur y entre, et son bouton le lui dit ; la page en maintenance lui reste fermée.
  const testeur = vu({ avantPremiere: ['cabinet'] })
  assert.deepEqual([fermeePour(testeur, 'cabinet'), boutonDeLaPage(testeur, 'cabinet')], [null, 'avant-premiere'])
  assert.deepEqual([fermeePour(testeur, 'jour'), boutonDeLaPage(testeur, 'jour')], ['maintenance', 'maintenance'])
  // L'administrateur entre partout ; sur l'accueil, ce qui ne marche pas reste éteint, même pour lui.
  const admin = vu({ admin: true })
  assert.deepEqual(
    PAGES_EN_MAINTENANCE.map(p => fermeePour(admin, p)),
    PAGES_EN_MAINTENANCE.map(() => null),
  )
  assert.deepEqual([boutonDeLaPage(admin, 'jour'), boutonDeLaPage(admin, 'cabinet')], ['maintenance', 'avant-premiere'])
  // La pastille rouge du QG ne compte que ce qui ne marche pas : une page bientôt disponible peut attendre des semaines.
  const aucune = Object.fromEntries(PAGES_EN_MAINTENANCE.map(p => [p, null])) as EtatDeLaMaintenance['pages']
  assert.equal(ceQuiEstPose({ bandeau: null, pages: aucune, bientot: { ...aucune, cabinet: 1 } } as Pick<EtatDeLaMaintenance, 'bandeau' | 'pages'>), 0)
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

test('une page bientôt disponible se sert fermée à qui attend, ouverte à ses testeurs et à l’administrateur — et le reste après un réveil', async () => {
  const { banc, page, fermer: eteindre } = await bancAvecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐸')
    const tomId = await idDe(banc, tom)
    assert.match(await page('/duels'), /rel="preload" as="fetch"/, 'ouverte, elle précharge son départ')

    const pose = await changer(banc, admin, 'duels', 'bientot')
    assert.equal(pose.status, 200)
    assert.equal(typeof (pose.corps as EtatDeLaMaintenance).bientot.duels, 'number')
    assert.equal((pose.corps as EtatDeLaMaintenance).pages.duels, null, 'pas en maintenance : rien n’y est cassé')
    // Sans profil, ou d'un profil qui attend : fermée, et rien de préchargé.
    for (const cookie of [undefined, lea]) {
      const html = await page('/duels', cookie)
      assert.match(html, /<meta name="bientot" content="duels">/)
      assert.doesNotMatch(html, /avant-premiere|maintenance-passe|rel="preload" as="fetch"/)
    }

    // Son testeur, par sa session de joueur : la page s'ouvre, préchargée, et l'accueil le sait.
    const ajout = await testeur(banc, admin, 'duels', tomId)
    assert.equal(ajout.status, 200)
    assert.deepEqual(
      (ajout.corps as EtatDeLaMaintenance).testeurs.duels.map(t => [t.nom, t.login]),
      [['Tom', 'tom']],
    )
    const pourTom = await page('/duels', tom)
    assert.match(pourTom, /<meta name="avant-premiere" content="duels">/)
    assert.match(pourTom, /rel="preload" as="fetch"/)
    assert.match(await page('/', tom), /<meta name="avant-premiere" content="duels">/)
    assert.doesNotMatch(await page('/', lea), /avant-premiere/, 'chacun ne sait que ce qui le regarde')
    // L'administrateur, par sa console : il y entre, sans ligne à lire — rien n'y est cassé.
    const pourLui = await page('/duels', admin)
    assert.match(pourLui, /<meta name="maintenance-passe" content="oui">/)
    assert.match(pourLui, /rel="preload" as="fetch"/)
    assert.doesNotMatch(pourLui, /bandeau-administrateur/)

    // Ce qui ne changerait rien, ou ne se comprend pas, se refuse.
    assert.equal((await changer(banc, admin, 'duels', 'bientot')).status, 400)
    assert.equal((await changer(banc, admin, 'duels', 'peut-etre')).status, 400)
    assert.equal((await testeur(banc, admin, 'duels', tomId)).status, 400, 'déjà testeur')
    assert.equal((await testeur(banc, admin, 'duels', await idDe(banc, lea), 'DELETE')).status, 400, 'elle ne teste rien')
    assert.equal((await testeur(banc, admin, 'duels', 'personne')).status, 404)
    assert.equal((await testeur(banc, admin, 'soirees', tomId)).status, 400)

    // La base permanente garde l'état et ses testeurs : le disque effacé d'un réveil ne l'ouvre à personne de plus.
    await banc.redemarrer({ disqueEfface: true })
    assert.match(await page('/duels', lea), /<meta name="bientot" content="duels">/)
    assert.match(await page('/duels', tom), /<meta name="avant-premiere" content="duels">/)

    // Ouverte à tous, plus rien ne se pose — et elle garde ses testeurs pour une prochaine fois.
    const ouverte = await changer(banc, await connexionAnimateur(banc.url), 'duels', 'ouverte')
    assert.equal(ouverte.status, 200)
    assert.equal((ouverte.corps as EtatDeLaMaintenance).bientot.duels, null)
    assert.deepEqual(
      (ouverte.corps as EtatDeLaMaintenance).testeurs.duels.map(t => t.login),
      ['tom'],
    )
    assert.doesNotMatch(await page('/duels', lea), /name="bientot"/)
  } finally {
    await eteindre()
  }
})

test('le magasin : une page bientôt disponible est fermée pour le rappel du soir, et un profil oublié ne teste plus rien', async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'quizz-maintenance-'))
  const url = `file:${path.join(dossier, 'permanente.db')}`
  const magasin = new Maintenance(url)
  try {
    await magasin.init()
    await magasin.changerLEtat('jour', 'bientot')
    // « Ton quiz du jour t'attend » vers une page fermée : la tournée attend (`RappelStore`, `enPause`).
    assert.equal(magasin.estFermee('jour'), true)
    await magasin.ajouterUnTesteur('jour', 'p1')
    assert.equal(magasin.laisseEntrer('jour', { admin: false, profil: 'p1' }), true)
    assert.equal(magasin.laisseEntrer('jour', { admin: false, profil: 'p2' }), false)
    assert.equal(magasin.laisseEntrer('jour', { admin: true, profil: null }), true)
    // En maintenance, ses testeurs attendent avec les autres : ce qui ne marche pas ne s'essaie pas.
    await magasin.changerLEtat('jour', 'maintenance')
    assert.equal(magasin.laisseEntrer('jour', { admin: false, profil: 'p1' }), false)
    await magasin.changerLEtat('jour', 'bientot')
    // Un profil supprimé (`supprimerProfil`) ne teste plus rien, en mémoire comme en base.
    await magasin.oublierProfil('p1')
    assert.equal(magasin.laisseEntrer('jour', { admin: false, profil: 'p1' }), false)
    const relue = new Maintenance(url)
    try {
      await relue.init()
      assert.equal(relue.etatDe('jour'), 'bientot')
      assert.deepEqual(relue.etat().testeurs.jour, [])
    } finally {
      relue.close()
    }
  } finally {
    magasin.close()
    rmSync(dossier, { recursive: true, force: true })
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

test('une page bientôt disponible ferme ses portes à qui attend, ses testeurs passent — et une page en maintenance les arrête quand même', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐸')
    const tomId = await idDe(banc, tom)
    assert.equal((await changer(banc, admin, 'duels', 'bientot')).status, 200)
    assert.equal((await testeur(banc, admin, 'duels', tomId)).status, 200)

    const refus = await ecrire(banc.url, '/api/campagne/duel', {}, lea)
    assert.equal(refus.status, 423)
    assert.deepEqual(await refus.json(), { error: 'Les duels arrivent bientôt : reviens dans quelques jours', bientot: 'duels' })
    assert.notEqual((await ecrire(banc.url, '/api/campagne/duel', {}, tom)).status, 423, 'son testeur part')
    assert.notEqual((await ecrire(banc.url, '/api/campagne/duel', {}, admin)).status, 423, 'l’administrateur passe la porte')
    // Retiré, il attend avec les autres.
    assert.equal((await testeur(banc, admin, 'duels', tomId, 'DELETE')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/campagne/duel', {}, tom)).status, 423)

    // Le défi bientôt disponible, Tom pour l'essayer ; puis la campagne en maintenance : sa porte est aussi celle du
    // défi, et ce qui ne marche pas ne s'essaie pas.
    assert.equal((await changer(banc, admin, 'defi', 'bientot')).status, 200)
    assert.equal((await testeur(banc, admin, 'defi', tomId)).status, 200)
    assert.equal((await ecrire(banc.url, '/api/campagne/defi', {}, lea)).status, 423)
    assert.notEqual((await ecrire(banc.url, '/api/campagne/defi', {}, tom)).status, 423)
    assert.equal((await changer(banc, admin, 'campagne', 'maintenance')).status, 200)
    const arrete = await ecrire(banc.url, '/api/campagne/defi', {}, tom)
    assert.equal(arrete.status, 423)
    assert.equal(((await arrete.json()) as { maintenance?: string }).maintenance, 'campagne')
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

test('à l’accueil, une page en maintenance éteint son bouton et le dit ; le défi fermé seul éteint sa tuile, sous son onglet', async () => {
  // Le client lit son adresse une fois, au chargement : posée avant l'import, après les serveurs du banc.
  Object.assign(globalThis, { window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc' }, opener: null } })
  const module = await import(new URL('../../client/src/components/AccueilDesRoles.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const campagne = { vies: 11, avance: null }
  const accueil = (fermees: string[]) =>
    renderToStaticMarkup(
      React.createElement(module.AccueilJouer, {
        enCours: [],
        onRejoindre: () => {},
        lendemain: null,
        campagne,
        defi: { joueurs: 12 },
        jour: { serie: 3, jours: [] },
        duels: { joues: 0, defisRecus: { n: 2, de: 'Léa' } },
        etats: Object.fromEntries(fermees.map(p => [p, 'maintenance'])),
      }),
    )
  const bouton = (html: string, titre: string) => html.split('<a ').find(x => x.includes(`<b>${titre}</b>`))!

  const ouvert = accueil([])
  assert.doesNotMatch(ouvert, /gros-ferme|En maintenance/)
  assert.match(bouton(ouvert, 'Le défi de la semaine'), /href="\/campagne#defi".*<span class="pastille-attente">À relever<\/span>/)
  assert.match(ouvert, /, à relever<\/span>/)

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

  // Le défi fermé seul : sa tuile s'éteint sous son onglet, sans pastille ni point — elle inviterait à entrer. La
  // campagne, elle, reste ouverte.
  const sansLeDefi = accueil(['defi'])
  const tuile = bouton(sansLeDefi, 'Le défi de la semaine')
  assert.match(tuile, /^class="gros-bouton gros-ferme" href="\/campagne#defi"/)
  assert.match(tuile, /<span class="gros-detail">En maintenance : reviens un peu plus tard<\/span>/)
  assert.doesNotMatch(tuile, /À relever/)
  assert.doesNotMatch(sansLeDefi, /, à relever<\/span>/)
  assert.doesNotMatch(bouton(sansLeDefi, 'La campagne'), /gros-ferme/, 'le reste de la campagne reste ouvert')
  assert.match(bouton(accueil(['campagne']), 'La campagne'), /class="gros-bouton gros-ferme" href="\/campagne"/)
})

test('à l’accueil, une page bientôt disponible s’éteint pour qui attend, et dit « En test » à son testeur ; son écran ne parle pas de panne', async () => {
  Object.assign(globalThis, { window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc' }, opener: null } })
  const module = await import(new URL('../../client/src/components/AccueilDesRoles.tsx', import.meta.url).href)
  const { MaintenanceApp } = await import(new URL('../../client/src/views/MaintenanceApp.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const campagne = { vies: 11, avance: null }
  // Le bouton des duels sert d'exemple à une page qui se ferme — celui de l'Expédition l'était jusqu'au 1er novembre 2026,
  // quand le QG a cessé de la fermer (`PAGES_EN_MAINTENANCE`) : remplacée par le Cabinet, il n'y avait plus rien à fermer.
  const accueil = (etats: Record<string, string>) =>
    renderToStaticMarkup(
      React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, campagne, defi: { joueurs: 12 }, jour: { serie: 0, jours: [] }, etats }),
    )
  const bouton = (html: string, titre: string) => html.split('<a ').find(x => x.includes(`<b>${titre}</b>`))!

  // Qui attend : le bouton s'éteint, sans rouge — rien n'y est cassé —, la tuile du défi bientôt disponible aussi, sous son onglet.
  const attend = accueil({ duels: 'bientot', defi: 'bientot' })
  for (const [titre, href] of [
    ['Les duels', '/duels'],
    ['Le défi de la semaine', '/campagne#defi'],
  ]) {
    const b = bouton(attend, titre)
    assert.match(b, new RegExp(`^class="gros-bouton gros-ferme gros-bientot" href="${href}"`), titre)
    assert.match(b, /<span class="gros-detail">Bientôt disponible<\/span>/, titre)
  }
  assert.doesNotMatch(attend, /, à relever<\/span>/)
  // « À relever » reste au défi qu'il essaie, comme « À jouer » au quiz du jour.
  assert.match(bouton(accueil({ defi: 'avant-premiere' }), 'Le défi de la semaine'), /<span class="pastille-attente">À relever<\/span>/)
  // Son testeur : ouvert, et il le sait.
  const essaie = bouton(accueil({ duels: 'avant-premiere' }), 'Les duels')
  assert.match(essaie, /^class="gros-bouton" href="\/duels"/)
  assert.match(essaie, /<span class="pastille-attente">En test<\/span>/)
  // Ce qu'il attend d'abord passe devant : « À jouer » reste au quiz du jour qu'il essaie.
  assert.match(bouton(accueil({ jour: 'avant-premiere' }), 'Le quiz du jour'), /<span class="pastille-attente">À jouer<\/span>/)

  // Son écran : ce qui arrive, sans « réparation » ni « Réessayer » — réessayer n'y changerait rien avant des jours.
  const ecran = (pourquoi: string) => renderToStaticMarkup(React.createElement(MaintenanceApp, { page: 'duels', pourquoi }))
  assert.match(ecran('bientot'), /<h1 id="en-maintenance-titre">Les duels arrivent bientôt<\/h1>/)
  assert.doesNotMatch(ecran('bientot'), /Réessayer|réparation/)
  assert.match(ecran('maintenance'), /<h1 id="en-maintenance-titre">Les duels sont en maintenance<\/h1>/)
  assert.match(ecran('maintenance'), /Réessayer/)
})

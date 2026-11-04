// Ce que vivent les téléphones des joueurs (le QG 2, lot 9) : le temps
// d'affichage, la réponse au doigt, ce qui saute et les erreurs du client,
// mesurés dans la page d'un téléphone sur quatre, envoyés sans cookie quand
// elle se cache, agrégés à l'heure au serveur — sans un nom ni une adresse :
// un salon se dit « une soirée », le QG ne se mesure pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { connexionAnimateur, demarrer, ecrire } from './banc'
import { lireUneMesure, p75, pageMesuree, telephonesDeLaPeriode, type TelephonesDeLHeure } from '../../shared/telephones'
import type { PageDuServeur } from '../../shared/santeDuServeur'

test('la page d’une adresse se lit au serveur : un salon est une soirée, sans son nom ; le QG ne se mesure pas', () => {
  assert.equal(pageMesuree('/'), 'accueil')
  assert.equal(pageMesuree('/profil'), 'profil')
  assert.equal(pageMesuree('/boutique?essayer=1'), 'boutique')
  assert.equal(pageMesuree('/jour'), 'jour')
  assert.equal(pageMesuree('/cabinet'), 'cabinet')
  assert.equal(pageMesuree('/chez-nadia'), 'soiree')
  assert.equal(pageMesuree('/chez-nadia/souvenir'), 'souvenir')
  assert.equal(pageMesuree('/host'), 'ecran')
  assert.equal(pageMesuree('/tele'), 'ecran')
  assert.equal(pageMesuree('/admin'), null)
  assert.equal(pageMesuree('/connexion'), 'autre')
  assert.equal(pageMesuree(42), 'autre')
  assert.equal(pageMesuree('pas une adresse'), 'autre')
})

test('une mesure reçue se relit, bornée : ce qui ne se lit pas s’ignore, rien d’autre ne passe', () => {
  assert.deepEqual(lireUneMesure({ chemin: '/chez-nadia', lcp: 1234.6, inp: 88.2, cls: 0.12345, erreurs: 2, appareil: 'android', installee: true, nom: 'Léa' }), {
    page: 'soiree',
    lcp: 1235,
    inp: 88,
    cls: 0.123,
    erreurs: 2,
    appareil: 'android',
    installee: true,
  })
  // Safari : ni LCP ni INP — la page compte, ses erreurs aussi.
  assert.deepEqual(lireUneMesure({ chemin: '/jour', lcp: null, inp: null, cls: null, erreurs: 1, appareil: 'iphone' }), {
    page: 'jour',
    lcp: null,
    inp: null,
    cls: null,
    erreurs: 1,
    appareil: 'iphone',
    installee: false,
  })
  // Rien de mesuré, sans une erreur : la page compte encore — sinon les iPhone sortaient de la part des appareils.
  assert.deepEqual(lireUneMesure({ chemin: '/cabinet', lcp: null, inp: null, cls: null, erreurs: 0, appareil: 'iphone' }), {
    page: 'cabinet',
    lcp: null,
    inp: null,
    cls: null,
    erreurs: 0,
    appareil: 'iphone',
    installee: false,
  })
  // Hors bornes — un seul chiffre suffit à rendre la mesure suspecte —, ou au QG : rien.
  assert.equal(lireUneMesure({ chemin: '/jour', lcp: -5, inp: 1e9, cls: 'beaucoup', erreurs: 0 }), null)
  assert.equal(lireUneMesure({ chemin: '/jour', lcp: 900, inp: -1 }), null)
  assert.equal(lireUneMesure({ chemin: '/jour', lcp: 900, erreurs: 'trois' }), null)
  assert.equal(lireUneMesure({ chemin: '/admin', lcp: 900 }), null)
  assert.equal(lireUneMesure('n’importe quoi'), null)
  assert.equal(lireUneMesure({ chemin: '/jour', lcp: 900, appareil: 'Mozilla/5.0 (Linux; Android 14)' })?.appareil, 'autre', 'le navigateur ne passe pas')
})

test('le 75ᵉ centile, et des heures fondues en une période : les vues s’additionnent, les centiles se pondèrent', () => {
  assert.equal(p75([]), null)
  assert.equal(p75([100, 200, 300, 400]), 400)
  assert.equal(p75([1, 2, 3, 4, 5, 6, 7, 8]), 7)
  const h1: TelephonesDeLHeure = {
    pages: [{ page: 'jour', vues: 3, erreurs: 1, lcp: { n: 3, p75: 1000 }, inp: null, cls: { n: 3, p75: 0.1 } }],
    appareils: { android: 2, iphone: 1 },
    installees: 1,
  }
  const h2: TelephonesDeLHeure = {
    pages: [
      { page: 'jour', vues: 1, erreurs: 0, lcp: { n: 1, p75: 2000 }, inp: { n: 1, p75: 80 }, cls: { n: 1, p75: 0.2 } },
      { page: 'cabinet', vues: 5, erreurs: 0, lcp: null, inp: null, cls: null },
    ],
    appareils: { android: 6 },
    installees: 0,
  }
  const t = telephonesDeLaPeriode([h1, undefined, h2])
  assert.deepEqual(t.appareils, { android: 8, iphone: 1 })
  assert.equal(t.installees, 1)
  assert.deepEqual(t.pages.map(p => [p.page, p.vues]), [['cabinet', 5], ['jour', 4]], 'les plus vues d’abord')
  const jour = t.pages.find(p => p.page === 'jour')!
  assert.deepEqual([jour.lcp, jour.inp, jour.cls, jour.erreurs], [{ n: 4, p75: 1250 }, { n: 1, p75: 80 }, { n: 4, p75: 0.125 }, 1])
})

test('au banc : un téléphone envoie sans cookie, le serveur agrège à l’heure, et la page du serveur le dit — sans un nom', async () => {
  const banc = await demarrer()
  try {
    const envoyer = (corps: unknown) => ecrire(banc.url, '/api/mesures', corps)
    for (const corps of [
      { chemin: '/chez-nadia', lcp: 1800, inp: 120, cls: 0.02, erreurs: 0, appareil: 'android', installee: false },
      { chemin: '/chez-nadia', lcp: 2600, inp: 260, cls: 0.2, erreurs: 1, appareil: 'iphone', installee: true },
      { chemin: '/jour', lcp: 1200, inp: 90, cls: 0, erreurs: 0, appareil: 'android', installee: true },
      // Un navigateur qui ne mesure rien : une vue, un appareil.
      { chemin: '/cabinet', lcp: null, inp: null, cls: null, erreurs: 0, appareil: 'iphone', installee: false },
      // Ce qui ne se lit pas : 204 comme le reste, sans rien compter.
      { chemin: '/admin', lcp: 900 },
      'pas une mesure',
    ]) {
      assert.equal((await envoyer(corps)).status, 204)
    }
    // Sans l'en-tête de la page, la garde des écritures refuse, comme partout.
    assert.equal((await fetch(`${banc.url}/api/mesures`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403)

    const admin = await connexionAnimateur(banc.url)
    const page = (await (await fetch(`${banc.url}/api/admin/serveur?periode=1h`, { headers: { Cookie: admin } })).json()) as PageDuServeur
    const t = page.telephones!
    assert.deepEqual(t.pages.map(p => [p.page, p.vues, p.erreurs]), [['soiree', 2, 1], ['jour', 1, 0], ['cabinet', 1, 0]])
    assert.deepEqual(t.appareils, { android: 2, iphone: 2 })
    assert.equal(t.pages.find(p => p.page === 'cabinet')?.lcp, null, 'rien de mesuré, rien d’inventé')
    assert.equal(t.installees, 2)
    assert.ok(!JSON.stringify(t).includes('nadia'), 'le salon ne se nomme pas')
    // Personne n'attend une mesure : elle ne compte pas parmi ce qu'un joueur attend (ses quelques millisecondes
    // feraient passer les vraies routes pour plus rapides), et ne garde pas Turso chaud.
    assert.ok(page.routes.length > 0, 'les routes de la page sont là')
    assert.ok(!page.routes.some(r => r.route.includes('/api/mesures')), 'la mesure n’est pas une route qu’on attend')
  } finally {
    await banc.close()
  }
})

test('le code de la mesure ne vient qu’au téléphone tiré au sort, après la page : jamais dans l’entrée', () => {
  const main = readFileSync(new URL('../../client/src/main.tsx', import.meta.url), 'utf8')
  assert.match(main, /import\('\.\/mesures'\)/)
  assert.doesNotMatch(main, /^import .*['"]\.\/mesures['"]/m)
  const mesures = readFileSync(new URL('../../client/src/mesures.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(mesures, /^import /m, 'rien n’y importe')
  assert.match(mesures, /credentials: 'omit'/, 'sans cookie')
})

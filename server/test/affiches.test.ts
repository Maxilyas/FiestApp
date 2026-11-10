// L'affiche d'une nouveauté, au QG (`/admin#affiches`, sous « Animer ») — le
// souhait du propriétaire du 1er novembre 2026, à la veille d'ouvrir le Cabinet
// de curiosités : « beaucoup de gens n'utilisent pas des fonctionnalités car
// ils ne sont pas au courant ». Une affiche en haut de l'accueil de chaque
// profil, « Nouveau » sur le bouton de sa page, jusqu'à ce qu'il y aille — la
// page servie le dit au serveur —, et des confettis à sa première visite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, relireJusqua, type Banc } from './banc'
import {
  DESTINATIONS,
  PAGES_A_L_AFFICHE,
  PHRASE_D_AFFICHE_MAX,
  TITRE_D_AFFICHE_MAX,
  ceQueMontreLAccueil,
  lireLAffiche,
  motDeLaPremiereVisite,
  pageALAfficheDeLAdresse,
  type AfficheDAccueil,
  type PageDesAffiches,
} from '../../shared/affiches'
import { PAGES_EN_MAINTENANCE, pageDeLAdresse } from '../../shared/maintenance'
import { parseRoute } from '../../shared/adresses'
import type { ProfilDAccueil } from '../../shared/profil'
import type { JournalDuQg } from '../../shared/qg'

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
async function avecPages(opts: Parameters<typeof demarrer>[0] = {}): Promise<Banc & { dist: string }> {
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), PAGE)
  const banc = await demarrer({ clientDist: dist, ...opts })
  const fermer = banc.close.bind(banc)
  return Object.assign(banc, {
    dist,
    async close() {
      await fermer()
      rmSync(dist, { recursive: true, force: true })
    },
  })
}

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const accueil = async (banc: Banc, cookie: string) => (await lire<{ profile: ProfilDAccueil }>(banc, cookie, '/api/joueur/moi?accueil')).corps.profile
/** Ce que son accueil dit des affiches : leur titre, et si elles sont rangées. */
const sesAffiches = async (banc: Banc, cookie: string) => ((await accueil(banc, cookie)).affiches ?? []).map(a => [a.titre, a.rangee])
const solde = async (banc: Banc, cookie: string) => (await accueil(banc, cookie)).boutique?.confettis.solde
/** Il ouvre une page, comme un navigateur : le serveur sert le HTML, avec son cookie. */
const ouvrir = async (banc: Banc, cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
  assert.equal(r.status, 200, chemin)
  await r.text()
}

const CABINET = { page: 'cabinet', titre: 'Le Cabinet de curiosités ouvre ses portes', phrase: 'Trois actes, trois gardiens à vaincre.', jours: 14, confettis: 50 }

test('une affiche se lit au QG telle qu’elle partira : refusée plutôt que coupée, sa page parmi celles qui ont une adresse', () => {
  assert.deepEqual(lireLAffiche({ ...CABINET, titre: '  Le Cabinet   ouvre  ' }), { ...CABINET, titre: 'Le Cabinet ouvre' })
  assert.equal(lireLAffiche({ ...CABINET, confettis: undefined }).confettis, 0)
  for (const [faux, motif] of [
    [{ ...CABINET, page: 'defi' }, /Choisis la page/],
    [{ ...CABINET, page: 'constructor' }, /Choisis la page/],
    [{ ...CABINET, titre: '   ' }, /Écris le titre/],
    [{ ...CABINET, titre: 'é'.repeat(TITRE_D_AFFICHE_MAX + 1) }, /Le titre tient en 48 caractères/],
    [{ ...CABINET, phrase: 42 }, /Écris la phrase/],
    [{ ...CABINET, phrase: 'é'.repeat(PHRASE_D_AFFICHE_MAX + 1) }, /La phrase tient en 140 caractères/],
    [{ ...CABINET, jours: 10 }, /combien de jours/],
    [{ ...CABINET, confettis: 501 }, /Entre 0 et 500 confettis/],
    [{ ...CABINET, confettis: 2.5 }, /Entre 0 et 500 confettis/],
    [null, /Choisis la page/],
  ] as const) {
    assert.throws(() => lireLAffiche(faux), motif, JSON.stringify(faux))
  }
  assert.equal(lireLAffiche({ ...CABINET, titre: 'é'.repeat(TITRE_D_AFFICHE_MAX) }).titre.length, TITRE_D_AFFICHE_MAX)
  // Chaque page à l'affiche a son adresse, que le serveur reconnaît en la servant (`pageALAfficheDeLAdresse`) : sans
  // elle, sa visite ne se noterait jamais. Celles qui se ferment au QG la gardent aussi dans `pageDeLAdresse` ; les
  // collectionneurs, à l'affiche depuis le 9 novembre 2026, ne s'y ferment pas : ils ne commencent rien.
  for (const page of PAGES_A_L_AFFICHE) {
    assert.equal(pageALAfficheDeLAdresse(parseRoute(DESTINATIONS[page].chemin)), page, DESTINATIONS[page].chemin)
    if (page === 'collectionneurs') assert.equal(pageDeLAdresse(parseRoute(DESTINATIONS[page].chemin)), null, 'une page qui ne commence rien ne se ferme pas')
    else {
      assert.ok((PAGES_EN_MAINTENANCE as readonly string[]).includes(page), page)
      assert.equal(pageDeLAdresse(parseRoute(DESTINATIONS[page].chemin)), page, DESTINATIONS[page].chemin)
    }
    assert.ok(lireLAffiche({ page, titre: DESTINATIONS[page].titre, phrase: DESTINATIONS[page].phrase, jours: 7 }), `ce que le QG propose pour ${page} passe`)
  }
  assert.equal(motDeLaPremiereVisite('cabinet'), 'Pour ta première visite au Cabinet de curiosités')
})

test('l’accueil montre en grand la plus récente qu’il n’a pas rangée, et « Nouveau » sur chaque page à l’affiche qui lui est ouverte', () => {
  const affiche = (id: string, page: AfficheDAccueil['page'], rangee = false): AfficheDAccueil => ({ id, page, titre: id, phrase: '', confettis: 0, rangee })
  const toutes = [affiche('a', 'cabinet'), affiche('b', 'duels', true), affiche('c', 'campagne')]
  assert.deepEqual(ceQueMontreLAccueil(toutes, () => true), { grande: toutes[0], nouvelles: ['cabinet', 'duels', 'campagne'] })
  // Rangée d'ici, sans attendre le serveur : la suivante qu'il n'a pas rangée prend sa place ; la pastille reste.
  assert.deepEqual(ceQueMontreLAccueil(toutes, () => true, new Set(['a'])), { grande: toutes[2], nouvelles: ['cabinet', 'duels', 'campagne'] })
  // Le Cabinet fermé pour lui — en maintenance, ou absent de ce serveur — : ni affiche, ni pastille.
  assert.deepEqual(ceQueMontreLAccueil(toutes, p => p !== 'cabinet'), { grande: toutes[2], nouvelles: ['duels', 'campagne'] })
  assert.deepEqual(ceQueMontreLAccueil([affiche('b', 'duels', true)], () => true), { grande: null, nouvelles: ['duels'] })
  assert.deepEqual(ceQueMontreLAccueil([], () => true), { grande: null, nouvelles: [] })
})

test('une affiche des collectionneurs : « Nouveau » sur le gros bouton de son profil jusqu’à sa visite, que le serveur note', async () => {
  // « Fais un “Nouveau” sur le bouton, par le QG » (le propriétaire, le 9 novembre 2026) : la page ne se ferme pas au
  // QG, et sa visite se note quand même — sans quoi l'affiche et la pastille ne se tairaient jamais.
  const banc = await avecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const { titre, phrase } = DESTINATIONS.collectionneurs
    const posee = await faire(banc, admin, '/api/admin/affiches', { id: 'collectionneurs', page: 'collectionneurs', titre, phrase, jours: 14, confettis: 20 })
    assert.equal(posee.status, 200, posee.corps.error)
    // Son profil la lit, comme son accueil : le gros bouton des collectionneurs dit « Nouveau ».
    const profil = async () => (await lire<{ profile: { affiches?: AfficheDAccueil[] } }>(banc, lea, '/api/joueur/moi')).corps.profile
    assert.deepEqual((await profil()).affiches?.map(a => a.page), ['collectionneurs'])
    assert.deepEqual(await sesAffiches(banc, lea), [[titre, false]])
    const avant = (await solde(banc, lea)) ?? 0
    // Il ouvre la page : sa visite se note, ses confettis tombent, l'affiche et la pastille se taisent.
    await ouvrir(banc, lea, '/collectionneurs')
    await relireJusqua(profil, p => p.affiches === undefined)
    assert.deepEqual(await sesAffiches(banc, lea), [])
    assert.equal(await solde(banc, lea), avant + 20)
  } finally {
    await banc.close()
  }
})

test('une affiche du Cabinet : chaque accueil la montre jusqu’à la visite, qui la tait et offre ses confettis une fois ; « Plus tard » la range', async () => {
  const banc = await avecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    assert.deepEqual((await lire<PageDesAffiches>(banc, admin, '/api/admin/affiches')).corps.affiches, [])
    assert.equal((await accueil(banc, lea)).affiches, undefined, 'sans affiche, rien ne s’ajoute à l’accueil')

    const posee = await faire(banc, admin, '/api/admin/affiches', { id: 'cabinet-ouvre', ...CABINET })
    assert.equal(posee.status, 200, posee.corps.error)
    const page = posee.corps as PageDesAffiches
    assert.deepEqual(
      page.affiches.map(a => [a.id, a.page, a.titre, a.confettis, a.ouvertes, a.rangees, a.retireeLe, Math.round((a.fin - a.le) / 86_400_000)]),
      [['cabinet-ouvre', 'cabinet', CABINET.titre, 50, 0, 0, null, 14]],
    )

    // Chacun la voit ; Bob la range — elle reste à son accueil, rangée : la pastille de son bouton la lit encore.
    for (const qui of [lea, bob]) assert.deepEqual(await sesAffiches(banc, qui), [[CABINET.titre, false]])
    assert.equal((await faire(banc, bob, '/api/joueur/affiches/cabinet-ouvre/ranger')).status, 200)
    assert.equal((await faire(banc, bob, '/api/joueur/affiches/cabinet-ouvre/ranger')).status, 200, 'refait, rien ne change')
    assert.deepEqual(await sesAffiches(banc, bob), [[CABINET.titre, true]])
    assert.deepEqual(await sesAffiches(banc, lea), [[CABINET.titre, false]], 'rangée pour Bob seul')
    assert.equal((await faire(banc, bob, '/api/joueur/affiches/inconnue/ranger')).status, 404)
    assert.equal((await ecrire(banc.url, '/api/joueur/affiches/cabinet-ouvre/ranger', {})).status, 401)

    // Léa ouvre le Cabinet — la page servie suffit : l'affiche se tait à son accueil, et ses confettis arrivent, avec leur mot.
    assert.equal(await solde(banc, lea), 0)
    await ouvrir(banc, lea, '/cabinet')
    const apres = await relireJusqua(
      () => accueil(banc, lea),
      p => p.affiches === undefined && p.boutique?.confettis.solde === 50,
    )
    assert.equal(apres.affiches, undefined)
    assert.equal(apres.boutique?.confettis.solde, 50)
    assert.deepEqual(
      (apres.annonces ?? []).flatMap(a => (a.sorte === 'confettis' ? [[a.confettis, a.mot]] : [])),
      [[50, 'Pour ta première visite au Cabinet de curiosités']],
    )
    // Rouverte, la page n'offre rien de plus — ni après un redémarrage, qui oublie ce que la mémoire avait noté.
    await ouvrir(banc, lea, '/cabinet')
    await banc.redemarrer()
    await ouvrir(banc, lea, '/cabinet')
    assert.equal(await solde(banc, lea), 50)
    // Une autre page ne compte pas pour elle.
    await ouvrir(banc, bob, '/duels')
    await ouvrir(banc, bob, '/')
    assert.deepEqual(await sesAffiches(banc, bob), [[CABINET.titre, true]])

    // Max arrive après : elle pousse vers une page, elle ne raconte pas un fait d'avant lui — il la voit aussi.
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🐸')
    assert.deepEqual(await sesAffiches(banc, max), [[CABINET.titre, false]])

    // Le QG compte ce qu'elle a fait : Léa y est allée ; Bob l'a rangée sans y aller.
    const comptee = (await lire<PageDesAffiches>(banc, admin, '/api/admin/affiches')).corps.affiches[0]
    assert.deepEqual([comptee.ouvertes, comptee.rangees], [1, 1])

    // Le même envoi refait — sa réponse perdue en route — se refuse ; une seconde affiche du Cabinet aussi, tant que la première se montre.
    const rejouee = await faire(banc, admin, '/api/admin/affiches', { id: 'cabinet-ouvre', ...CABINET })
    assert.equal(rejouee.status, 409)
    assert.match(rejouee.corps.error, /déjà posée/)
    const seconde = await faire(banc, admin, '/api/admin/affiches', { id: 'cabinet-encore', ...CABINET, titre: 'Encore le Cabinet' })
    assert.equal(seconde.status, 409)
    assert.match(seconde.corps.error, /Le Cabinet de curiosités a déjà son affiche, « Le Cabinet de curiosités ouvre ses portes » : retire-la/)
    for (const [corps, motif] of [
      [{ ...CABINET, id: 'sans-titre-1', titre: '' }, /Écris le titre/],
      [{ ...CABINET, id: 'sans-page-01', page: 'defi' }, /Choisis la page/],
      [{ ...CABINET, id: 'trop-de-dons', page: 'duels', confettis: 1000 }, /Entre 0 et 500 confettis/],
    ] as const) {
      const r = await faire(banc, admin, '/api/admin/affiches', corps)
      assert.equal(r.status, 400, JSON.stringify(corps))
      assert.match(r.corps.error, motif)
    }
    // Une affiche des duels, à côté : une par page, pas une en tout. La plus récente passe devant à l'accueil.
    assert.equal((await faire(banc, admin, '/api/admin/affiches', { id: 'duels-neufs', page: 'duels', titre: 'Les duels changent', phrase: 'Viens voir.', jours: 7 })).status, 200)
    assert.deepEqual(await sesAffiches(banc, max), [
      ['Les duels changent', false],
      [CABINET.titre, false],
    ])

    // Retirée : elle se tait partout, et sa page n'offre plus rien — Max ouvre le Cabinet trop tard.
    const retiree = await faire(banc, admin, '/api/admin/affiches/cabinet-ouvre', undefined, 'DELETE')
    assert.equal(retiree.status, 200, retiree.corps.error)
    assert.ok((retiree.corps as PageDesAffiches).affiches.find(a => a.id === 'cabinet-ouvre')?.retireeLe)
    assert.deepEqual(await sesAffiches(banc, max), [['Les duels changent', false]])
    await ouvrir(banc, max, '/cabinet')
    await ouvrir(banc, max, '/duels')
    await relireJusqua(
      () => sesAffiches(banc, max),
      a => a.length === 0,
    )
    assert.equal(await solde(banc, max), 0, 'l’affiche des duels n’offrait rien, celle du Cabinet était retirée')
    assert.equal((await faire(banc, admin, '/api/admin/affiches/cabinet-ouvre', undefined, 'DELETE')).status, 400, 'déjà retirée')
    assert.equal((await faire(banc, admin, '/api/admin/affiches/inconnue', undefined, 'DELETE')).status, 404)
    // Retirée, une autre affiche du Cabinet peut se poser.
    assert.equal((await faire(banc, admin, '/api/admin/affiches', { id: 'cabinet-encore', ...CABINET, titre: 'Encore le Cabinet' })).status, 200)

    // Chaque geste au journal, sous les annonces, visant l'affiche.
    const gestes = (await lire<JournalDuQg>(banc, admin, '/api/admin/gestes?sorte=annonce')).corps.gestes
    assert.deepEqual(
      gestes.map(g => [g.resume, g.cible]).reverse(),
      [
        ['Affiche posée : Le Cabinet de curiosités — « Le Cabinet de curiosités ouvre ses portes », 14 jours — 50 confettis à la première visite', 'cabinet-ouvre'],
        ['Affiche posée : Les duels — « Les duels changent », 7 jours', 'duels-neufs'],
        ['Affiche retirée : Le Cabinet de curiosités — « Le Cabinet de curiosités ouvre ses portes » — les confettis offerts restent', 'cabinet-ouvre'],
        ['Affiche posée : Le Cabinet de curiosités — « Encore le Cabinet », 14 jours — 50 confettis à la première visite', 'cabinet-encore'],
      ],
    )
  } finally {
    await banc.close()
  }
})

test('sa fin passée, une affiche se tait et n’offre plus rien ; une page fermée à qui la demande ne note pas sa visite', async () => {
  const banc = await avecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    assert.equal((await faire(banc, admin, '/api/admin/affiches', { id: 'boutique-neuve', page: 'boutique', titre: 'Du neuf en boutique', phrase: 'Viens voir.', jours: 7, confettis: 20 })).status, 200)
    assert.equal((await faire(banc, admin, '/api/admin/affiches', { id: 'duels-neufs', page: 'duels', titre: 'Les duels changent', phrase: 'Viens voir.', jours: 7, confettis: 30 })).status, 200)

    // Les duels en maintenance : Léa ouvre leur page, qui le lui dit — ce n'est pas une visite, et l'accueil ne lui en montre rien.
    assert.equal((await faire(banc, admin, '/api/admin/maintenance/pages/duels', { fermee: true }, 'PUT')).status, 200)
    await ouvrir(banc, lea, '/duels')
    assert.equal(await solde(banc, lea), 0)
    assert.deepEqual(await sesAffiches(banc, lea), [
      ['Les duels changent', false],
      ['Du neuf en boutique', false],
    ], 'le serveur dit les deux : c’est l’accueil qui tait une page fermée (`ceQueMontreLAccueil`)')

    // La boutique, passée sa fin : écrite à la main dans la base, comme deux semaines plus tard.
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    base.prepare('UPDATE qg_affiches SET fin = ? WHERE id = ?').run(Date.now() - 1000, 'boutique-neuve')
    base.close()
    // Le serveur tenait sa fin en mémoire : la page de Bob ne note rien d'une affiche passée — ni visite, ni confettis.
    await ouvrir(banc, bob, '/boutique')
    assert.deepEqual(await sesAffiches(banc, bob), [['Les duels changent', false]])
    assert.equal(await solde(banc, bob), 0)
    const affiches = (await lire<PageDesAffiches>(banc, admin, '/api/admin/affiches')).corps.affiches
    assert.deepEqual(
      affiches.map(a => [a.id, a.ouvertes]),
      [
        ['duels-neufs', 0],
        ['boutique-neuve', 0],
      ],
    )
    // Passée, elle ne se retire plus : elle ne se montre déjà plus.
    assert.equal((await faire(banc, admin, '/api/admin/affiches/boutique-neuve', undefined, 'DELETE')).status, 400)
  } finally {
    await banc.close()
  }
})

test('là où le Cabinet ne s’ouvre pas, son affiche se refuse : elle mènerait à une page qui n’y répond pas', async () => {
  const banc = await avecPages({ cabinet: false })
  try {
    const admin = await connexionAnimateur(banc.url)
    const r = await faire(banc, admin, '/api/admin/affiches', { id: 'cabinet-ferme', ...CABINET })
    assert.equal(r.status, 400)
    assert.match(r.corps.error, /ne s’ouvre pas sur ce serveur/)
    assert.deepEqual((await lire<PageDesAffiches>(banc, admin, '/api/admin/affiches')).corps.affiches, [])
    // Les autres pages, si.
    assert.equal((await faire(banc, admin, '/api/admin/affiches', { id: 'campagne-neuve', page: 'campagne', titre: 'La campagne grandit', phrase: 'Viens voir.', jours: 21 })).status, 200)
  } finally {
    await banc.close()
  }
})

test('un profil supprimé emporte ce qu’il avait fait des affiches', async () => {
  const banc = await avecPages()
  try {
    const admin = await connexionAnimateur(banc.url)
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🦉')
    const idTom = (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id as string
    assert.equal((await faire(banc, admin, '/api/admin/affiches', { id: 'cabinet-ouvre', ...CABINET })).status, 200)
    assert.equal((await faire(banc, tom, '/api/joueur/affiches/cabinet-ouvre/ranger')).status, 200)
    await ouvrir(banc, tom, '/cabinet')
    await relireJusqua(
      () => accueil(banc, tom),
      p => p.affiches === undefined,
    )
    assert.equal((await faire(banc, admin, `/api/admin/profils/${idTom}`, undefined, 'DELETE')).status, 200)
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      assert.equal((base.prepare('SELECT COUNT(*) AS n FROM profile_affiches WHERE profile_id = ?').get(idTom) as { n: number }).n, 0)
      assert.equal((base.prepare('SELECT COUNT(*) AS n FROM profile_dons WHERE profile_id = ?').get(idTom) as { n: number }).n, 0)
    } finally {
      base.close()
    }
    const affiche = (await lire<PageDesAffiches>(banc, admin, '/api/admin/affiches')).corps.affiches[0]
    assert.deepEqual([affiche.ouvertes, affiche.rangees], [0, 0])
  } finally {
    await banc.close()
  }
})

test('l’affiche et la pastille, rendues : le bouton mène à la page, ses confettis dits dedans ; « Nouveau » après ce qui attend déjà', async () => {
  // Le client lit son adresse une fois, au chargement : posée avant l'import, après les serveurs des épreuves d'avant.
  Object.assign(globalThis, { React, window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc' }, opener: null } })
  const { AfficheDeLaNouveaute } = await import(new URL('../../client/src/components/AfficheDeLaNouveaute.tsx', import.meta.url).href)
  const { AccueilJouer } = await import(new URL('../../client/src/components/AccueilDesRoles.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const affiche = { id: 'cabinet-ouvre', page: 'cabinet', titre: 'Le Cabinet ouvre', phrase: 'Trois gardiens à vaincre.', confettis: 50 }

  // Sur l'accueil : un vrai lien vers sa page, ses confettis sous le geste qui les donne, et « Plus tard ».
  const vraie = renderToStaticMarkup(React.createElement(AfficheDeLaNouveaute, { affiche, onRanger: () => {} }))
  assert.match(vraie, /^<section class="affiche affiche-cabinet" aria-labelledby="affiche-titre-cabinet-ouvre">/)
  assert.match(vraie, /<h2 class="affiche-titre" id="affiche-titre-cabinet-ouvre">Le Cabinet ouvre<\/h2>/)
  const lien = /<a class="affiche-aller" href="\/cabinet">(.*?)<\/a>/.exec(vraie)?.[1] ?? ''
  assert.match(lien, /Visiter le Cabinet/)
  // Ses confettis en deux temps, dans le lien : couchée en bandeau, l'affiche ne montre que ce qui tient entier sur sa
  // ligne — « +50 confettis », puis « à ta première visite » —, et la phrase reste une phrase pour qui l'écoute.
  assert.match(lien, /<span class="affiche-cadeau"><span class="affiche-cadeau-combien">\+50\xa0confettis<\/span><span class="affiche-cadeau-quand"> à ta première visite<\/span><\/span>/)
  assert.match(lien.replace(/<[^>]+>/g, ''), /\+50\xa0confettis à ta première visite$/)
  assert.match(vraie, /<button type="button" class="affiche-plus-tard">Plus tard<\/button>/)
  assert.match(vraie, /<div class="affiche-scene" aria-hidden="true">/, 'la scène peinte est décorative')
  // Couchée en bandeau — un téléphone, où l'affiche en grand faisait défiler l'accueil — : la même affiche, les mêmes
  // mots, le même lien ; une classe de plus, et rien d'autre.
  const bandeau = renderToStaticMarkup(React.createElement(AfficheDeLaNouveaute, { affiche, onRanger: () => {}, forme: 'bandeau' }))
  assert.equal(bandeau, vraie.replace('class="affiche affiche-cabinet"', 'class="affiche affiche-cabinet affiche-bandeau"'))
  assert.equal(renderToStaticMarkup(React.createElement(AfficheDeLaNouveaute, { affiche, onRanger: () => {}, forme: 'affiche' })), vraie)
  // L'aperçu du QG : rien ne s'y touche, rien ne mène nulle part ; sans confettis, il n'en promet pas.
  const apercu = renderToStaticMarkup(React.createElement(AfficheDeLaNouveaute, { affiche: { ...affiche, confettis: 0 } }))
  assert.doesNotMatch(apercu, /<a |<button/)
  assert.doesNotMatch(apercu, /confetti/)

  const accueil = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(AccueilJouer, {
        enCours: [],
        onRejoindre: () => {},
        lendemain: null,
        campagne: { vies: 11, avance: null },
        defi: { joueurs: 12 },
        jour: { serie: 0, jours: [] },
        cabinet: true,
        remplacee: true,
        ...props,
      }),
    )
  const bouton = (html: string, titre: string) => html.split('<a ').find(x => x.includes(`<b>${titre}</b>`)) ?? ''
  // « Nouveau » sur chaque page à l'affiche, et nulle part ailleurs.
  const neuf = accueil({ nouvelles: ['cabinet', 'duels', 'campagne'] })
  for (const titre of ['Le Cabinet de curiosités', 'Les duels', 'La campagne']) assert.match(bouton(neuf, titre), /<span class="pastille-nouveaute">.*Nouveau<\/span>/, titre)
  assert.doesNotMatch(bouton(neuf, 'Le quiz du jour'), /pastille-nouveaute/)
  assert.doesNotMatch(accueil({}), /pastille-nouveaute/, 'sans affiche, rien de neuf')
  // Ce qui attend déjà passe devant : une traversée en route, le résultat d'un duel.
  const occupe = accueil({ nouvelles: ['cabinet', 'duels'], traversee: { acte: 2, coeurs: 3 }, duels: { joues: 0, resultats: { n: 1, de: 'Léa', code: 'abc123' } } })
  assert.match(bouton(occupe, 'Le Cabinet de curiosités'), /En route/)
  assert.match(bouton(occupe, 'Les duels'), /Résultat/)
  assert.doesNotMatch(occupe, /pastille-nouveaute/)
})

test('couchée en bandeau, l’affiche tient à la place d’« À la une » : le bandeau entier mène à sa page, sa phrase se lit encore, rien n’y est coupé au milieu', () => {
  // En grand, elle faisait défiler l'accueil d'un téléphone — 179 px en 360 × 640, 67 en 390 × 844, le relevé du
  // 9 novembre 2026 — : le dernier cas où un téléphone d'aujourd'hui défilait encore. Ce qui tient se mesure au
  // navigateur (`rendu-accueil.ts`, le cas `affiche`) ; ici, ce que la feuille ne doit pas perdre en la couchant.
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const bloc = (selecteur: string) => css.match(new RegExp(`(?:^|\\n) *${selecteur.replace(/[.*+?()[\]]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? ''
  // La page choisit la forme sur la taille de l'écran : sous 940 px de haut ou 600 de large — tous les téléphones —,
  // le bandeau ; au-delà — une tablette debout, un grand écran —, l'affiche entière, qui y a sa place.
  const composant = readFileSync(new URL('../../client/src/components/AfficheDeLaNouveaute.tsx', import.meta.url), 'utf8')
  assert.match(composant, /'\(max-height: 939px\), \(max-width: 599px\)'/)
  // Une rangée : la scène et « Nouveau » à gauche, le titre et le geste à droite.
  assert.match(bloc('.affiche-bandeau'), /display: grid;[^}]*grid-template-columns: auto minmax\(0, 1fr\);/)
  // Le bandeau entier mène à la page : le lien se tend sur lui — comme « À la une », qu'il remplace —, « Plus tard »
  // par-dessus. L'anneau du focus reste celui de l'application (`design.test.ts`, A2), à l'or de l'affiche : celui du
  // thème, sombre sous l'Ivoire, se perdrait dans sa nuit.
  assert.match(bloc('.affiche-bandeau .affiche-aller::after'), /content: ''; position: absolute; inset: 0;/)
  assert.match(bloc('.affiche-bandeau .affiche-plus-tard'), /position: absolute;[^}]*z-index: 3;/)
  assert.match(bloc('.affiche-bandeau .affiche-aller:focus-visible'), /outline-color: #f3d488; outline-offset: 2px;/)
  // Sa phrase ne se montre qu'en grand : cachée à l'œil, jamais retirée — le lecteur d'écran la lit toujours.
  assert.match(bloc('.affiche-bandeau .affiche-phrase'), /clip-path: inset\(50%\);/)
  assert.doesNotMatch(bloc('.affiche-bandeau .affiche-phrase'), /display: none/)
  // Son titre : sa rangée a toujours la hauteur de deux lignes — court ou long, le bandeau fait la même taille —, et il
  // n'est jamais coupé : le QG refuse un titre trop long plutôt que de le couper, le bandeau ne le coupe pas non plus.
  assert.match(bloc('.affiche-bandeau'), /grid-template-rows: minmax\(calc\(var\(--affiche-titre\) \* 2\.2\), auto\) auto;/)
  assert.match(bloc('.affiche-bandeau .affiche-titre'), /font-size: var\(--affiche-titre\); line-height: 1\.1;/)
  assert.doesNotMatch(bloc('.affiche-bandeau .affiche-titre'), /overflow|max-height|line-clamp|ellipsis/)
  // Ce que la visite rapporte : des morceaux entiers ou rien (`flex-wrap`, une seule ligne de haut) — sous le nom du
  // bouton d'or, et sur le petit téléphone à la suite de son geste, qui s'y écrit sans bouton.
  assert.match(bloc('.affiche-bandeau .affiche-cadeau'), /display: flex; flex-wrap: wrap;[^}]*height: 1\.25em; overflow: clip;/)
  const petit = css.match(/@media \(max-height: 719px\) \{\n  \.affiche-bandeau \{[^@]*/)?.[0] ?? ''
  assert.match(petit, /\.affiche-bandeau \.affiche-aller-texte \{ flex-direction: row; flex-wrap: wrap;[^}]*height: 1\.3em; overflow: clip;/)
  assert.match(petit, /\.affiche-bandeau \.affiche-cadeau \{ display: contents;/)
  // Aucun texte sous le plus petit de l'application (`--t-label`, 0,6875 rem).
  const tailles = [...css.matchAll(/--affiche-(?:titre|geste|cadeau|plus-tard): ([\d.]+)rem;/g)].map(m => Number(m[1]))
  assert.ok(tailles.length >= 8, `${tailles.length} tailles lues`)
  assert.ok(Math.min(...tailles) >= 0.6875, `la plus petite : ${Math.min(...tailles)} rem`)
  // Sur le petit téléphone, une soirée où revenir prend aussi sa place, comme celle d'« À la une » : on revient là pour
  // retourner jouer. La pastille « Nouveau » de son bouton reste, et l'affiche revient après la soirée.
  assert.match(petit, /\n  \.accueil:has\(\.gros-principal\) \.affiche \{ display: none; \}\n/)
  // Un peu plus haute qu'« À la une », dont elle prend la place : la page se resserre entre ses blocs plutôt que de défiler.
  assert.match(css, /\.accueil:has\(\.affiche-bandeau\) \{ --accueil-ecart: 8px; --accueil-serre: 5px; \}/)
  // Et « Nouveau », sur la ligne de sa page, perd son étincelle là où elle ferait passer « Le Cabinet de curiosités » sur
  // deux lignes : sa rangée, plus haute que les autres, poussait « Entre amis » sous le menu.
  assert.match(css, /@media \(max-width: 411px\) \{\n  \.accueil-gestes \.pastille-nouveaute \.icon \{ display: none; \}\n\}/)
})

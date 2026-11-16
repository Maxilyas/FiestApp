// Où le Cabinet de curiosités répond : hors de la production toujours, en
// production sous son drapeau (`cabinetOuvert`) — la page ne le lit pas, le
// serveur le lui dit (`<meta name="cabinet" content="ferme">`), et chacune de
// ses routes répond 404 en mots. Puis la maintenance du QG : le Cabinet en
// maintenance, ou bientôt disponible, ferme le départ d'une traversée (`POST
// /api/cabinet/traversee`) et les portes du musée qui dort — son départ, ses
// achats, ses dorures, son échange — ; jamais un geste : une traversée en
// route va au bout, une partie commencée se finit.
//
// Puis l'effacement de l'Expédition (le choix du propriétaire du 31 octobre
// 2026, son code retiré du dépôt le 16 novembre) : sans drapeau ni option,
// aucune de ses adresses ne répond — 404 —, `/expedition` mène au Cabinet, la
// page du Cabinet ne dit plus « Ton expédition t'attend », l'accueil n'a plus
// son bouton, l'album tait sa voie.
// Et ce que la décision du propriétaire du 25 octobre 2026 — pas de migration
// — a retiré : plus rien ne se rapporte de l'Expédition au Cabinet.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { DIX_HEURES, aLaMain, baseDuCabinet, bancDuCabinet, commencer, dossierDEssai, fermerLesMagasins, jouer, laPage, lire, magasinDEssai, ok, poster, type BancDuCabinet } from './cabinet-banc'
import { CABINET_FERME } from '../src/cabinet'
import { BALISE_DU_CABINET_FERME } from '../src/core/page'
import { PORTES_DES_PAGES } from '../src/maintenance'
import { CABINET_EN_PRODUCTION, cabinetOuvert } from '../../shared/cabinet/ouverture'
import { modeDeLaSource } from '../../shared/pannes'
import { PAGES_EN_MAINTENANCE, PAGES_FERMABLES } from '../../shared/maintenance'
import { cleDeLExpedition, estUneVoieDExpedition, legendaire, legendairesDebloques, voiesDe, voiesMontrees } from '../../shared/legendaires'
import { compagnon, pourLAvoir } from '../../shared/compagnons'
import type { PageDeLaTraversee, PageDuCabinet } from '../../shared/cabinet/vues'

after(fermerLesMagasins)

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

/** Un banc du Cabinet qui sert des pages : un client minimal tient lieu de construit. */
async function avecPages(opts: Parameters<typeof bancDuCabinet>[0] = {}): Promise<BancDuCabinet & { page: (chemin: string) => Promise<string>; fermer: () => Promise<void> }> {
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), PAGE)
  const b = await bancDuCabinet({ clientDist: dist, ...opts })
  return {
    ...b,
    page: async chemin => (await fetch(b.banc.url + chemin)).text(),
    async fermer() {
      await b.banc.close()
      rmSync(dist, { recursive: true, force: true })
    },
  }
}

test('le Cabinet répond hors de la production, et en production sous son drapeau', () => {
  assert.equal(cabinetOuvert({ online: false, env: 'production' }), true, '`npm run dev`, les tests')
  assert.equal(cabinetOuvert({ online: true, env: 'preprod' }), true, 'la préproduction')
  assert.equal(cabinetOuvert({ online: true, env: 'production' }), CABINET_EN_PRODUCTION, 'la production, sous son drapeau')
})

test('fermé, chaque route du Cabinet répond 404 en mots, à tous — et la page servie le dit d’avance', async () => {
  const ferme = await avecPages({ cabinet: false })
  try {
    const lea = await inscrireProfil(ferme.banc.url, 'lea', 'Léa')
    for (const [quoi, r] of [
      ['la page, sans profil', await laPage(ferme, undefined)],
      ['la page', await laPage(ferme, lea)],
      ['commencer', await commencer(ferme, lea, { origine: 'libre', jeu: 'pari', carte: null })],
      ['un geste', await poster(ferme, lea, '/api/cabinet/partie/une-partie/geste', { rang: 2, geste: { quoi: 'quitter' } })],
      ['une partie relue', await lire(ferme, lea, '/api/cabinet/partie/une-partie')],
      ['un cartel', await lire(ferme, lea, '/api/cabinet/oeuvre/prudence')],
      ['un achat', await poster(ferme, lea, '/api/cabinet/oeuvre/bastion/achat', { prix: 400 })],
      ['une dorure', await poster(ferme, lea, '/api/cabinet/oeuvre/prudence/dorure', { prix: 100 })],
      ['un échange', await poster(ferme, lea, '/api/cabinet/visite/echange', { case: 0 })],
      ['les murs', await lire(ferme, lea, '/api/cabinet/murs')],
    ] as const) {
      assert.deepEqual([r.status, r.corps], [404, { error: CABINET_FERME }], quoi)
      assert.equal(r.entetes.get('cache-control'), 'no-store', quoi)
    }
    for (const chemin of ['/', '/profil', '/campagne']) assert.ok((await ferme.page(chemin)).includes(BALISE_DU_CABINET_FERME), chemin)
  } finally {
    await ferme.fermer()
  }
  const ouvert = await avecPages()
  try {
    assert.ok(!(await ouvert.page('/')).includes('name="cabinet"'), 'ouvert, aucune balise')
  } finally {
    await ouvert.fermer()
  }
})

test('fermé, sa page ne prépare rien : ni la base de la campagne, ni les tas d’un mode qui ne répond pas', async () => {
  // Ouvert, la page du Cabinet lance la lecture de la base derrière sa réponse (`campagne-charge.test.ts`) ; fermé —
  // la production —, une requête avec un cookie de profil la lançait encore après son 404.
  let lectures = 0
  const ferme = await demarrer({ cabinet: false, baseDeLaCampagne: () => (lectures++, baseDuCabinet()), prechauffageCampagneMs: 3_600_000, prechauffageAuProfil: true })
  try {
    const lea = await inscrireProfil(ferme.url, 'lea', 'Léa')
    assert.equal((await fetch(`${ferme.url}/api/cabinet`, { headers: { Cookie: lea } })).status, 404)
    await patienter(100)
    assert.equal(lectures, 0)
  } finally {
    await ferme.close()
  }
})

test('en maintenance, le Cabinet ferme le départ d’une traversée, et les portes du musée qui dort — jamais un geste : la traversée en route va au bout', async () => {
  assert.ok(PAGES_EN_MAINTENANCE.includes('cabinet'))
  // Ce qui recommence quelque chose. Le départ d'une traversée d'abord, la seule porte que la page ouvre encore : jusqu'au
  // 10 novembre 2026 elle n'y était pas, et la page fermée, un départ envoyé à la main passait. Puis celles du musée, que
  // plus aucun écran n'appelle mais dont le serveur répond encore : une partie, une dépense de poussière d'or, un jeu de la
  // visite changé (le lot C3).
  assert.deepEqual(PORTES_DES_PAGES.cabinet, [
    'POST /api/cabinet/traversee',
    'POST /api/cabinet/partie',
    'POST /api/cabinet/oeuvre/:cle/achat',
    'POST /api/cabinet/oeuvre/:cle/dorure',
    'POST /api/cabinet/visite/echange',
  ])
  // Ce que le QG en dit à l'administrateur : la traversée, plus les achats ni l'échange d'un jeu, qu'aucun écran ne montre.
  assert.match(PAGES_FERMABLES.cabinet.ferme, /le départ d’une traversée/)
  assert.match(PAGES_FERMABLES.cabinet.ferme, /la traversée en cours se finit/)
  assert.doesNotMatch(PAGES_FERMABLES.cabinet.ferme, /achat|échange|partie/)
  // Sa panne se dit sous son nom : la page, son départ, un geste, et ce qui dépense la poussière.
  for (const source of [
    'GET /api/cabinet',
    'POST /api/cabinet/traversee',
    'POST /api/cabinet/traversee/:id/geste',
    'POST /api/cabinet/partie',
    'POST /api/cabinet/partie/:id/geste',
    'GET /api/cabinet/oeuvre/:cle',
    'POST /api/cabinet/oeuvre/:cle/achat',
  ])
    assert.equal(modeDeLaSource(source), 'cabinet', source)

  const b = await bancDuCabinet()
  try {
    const admin = await connexionAnimateur(b.banc.url)
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
    const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
    const tomId = (await lire(b, tom, '/api/joueur/moi?leger')).corps.profile.id as string
    const enRoute = ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'une partie commencée avant')
    // La traversée de Zoé, partie avant la maintenance : ses cartes ne sont pas encore choisies.
    const partir = (cookie: string) => poster<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee', {})
    const geste = (cookie: string, t: { id: string; rang: number }, g: Record<string, unknown>) =>
      poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: g })
    const partie = ok(await partir(zoe), 'une traversée partie avant').traversee!
    const changer = (etat: string) => ecrire(b.banc.url, '/api/admin/maintenance/pages/cabinet', { etat }, admin, 'PUT')
    assert.equal((await changer('maintenance')).status, 200)

    const enMaintenance = [423, { error: `${PAGES_FERMABLES.cabinet.titre} : reviens un peu plus tard`, maintenance: 'cabinet' }]
    // Le départ d'une traversée se ferme : rien n'a commencé pour Tom.
    const sansDepart = await partir(tom)
    assert.deepEqual([sansDepart.status, sansDepart.corps], enMaintenance, 'le départ d’une traversée')
    assert.equal(ok(await lire<PageDeLaTraversee>(b, tom, '/api/cabinet/traversee'), 'se relire ne recommence rien').traversee, null)
    // Celle de Zoé va au bout : ses cartes, puis une épreuve où elle entre — la maintenance ne coupe personne en route.
    const cartes = ok(await geste(zoe, partie, { quoi: 'cartes', cartes: ['coup-d-oeil', 'echange', 'panacee'] }), 'ses cartes, en pleine maintenance').traversee!
    const etape = cartes.actes[0].etapes.find(e => cartes.atteignables.includes(e.id) && e.sorte === 'epreuve')!
    const entree = ok(await geste(zoe, cartes, { quoi: 'aller', etape: etape.id, ...(etape.choix && { theme: 0 }) }), 'une épreuve où elle entre')
    assert.equal(entree.traversee!.ou.sorte, 'epreuve')

    const refus = await commencer(b, tom, { origine: 'libre', jeu: 'pari', carte: null })
    assert.deepEqual([refus.status, refus.corps], enMaintenance)
    for (const [chemin, corps] of [
      ['/api/cabinet/oeuvre/bastion/achat', { prix: 400 }],
      ['/api/cabinet/oeuvre/prudence/dorure', { prix: 100 }],
      ['/api/cabinet/visite/echange', { case: 0 }],
    ] as const) {
      const r = await poster(b, tom, chemin, corps)
      assert.deepEqual([r.status, r.corps], enMaintenance, chemin)
    }
    // Se relire ne recommence rien : le cartel d'une œuvre, les murs, la page.
    assert.equal((await lire(b, tom, '/api/cabinet/oeuvre/prudence')).status, 200)
    assert.equal((await lire(b, tom, '/api/cabinet/murs')).status, 200)
    // L'administrateur passe la porte, reconnu par sa console : sans profil, c'est le Cabinet qui le lui dit.
    assert.equal((await commencer(b, admin, { origine: 'libre', jeu: 'pari', carte: null })).status, 401)
    // Ce qui est commencé passe : la page, le geste, la fin.
    assert.equal((await laPage(b, lea)).status, 200)
    assert.equal(ok(await jouer(b, lea, enRoute, { quoi: 'quitter' }), 'quitter en pleine maintenance').phase, 'finie')

    // Bientôt disponible : fermé à qui attend, ouvert à ses testeurs.
    assert.equal((await changer('bientot')).status, 200)
    assert.equal((await ecrire(b.banc.url, `/api/admin/maintenance/pages/cabinet/testeurs/${tomId}`, undefined, admin, 'PUT')).status, 200)
    const attend = await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null })
    assert.deepEqual([attend.status, attend.corps], [423, { error: `${PAGES_FERMABLES.cabinet.bientot} : reviens dans quelques jours`, bientot: 'cabinet' }])
    assert.equal((await commencer(b, tom, { origine: 'libre', jeu: 'pari', carte: null })).status, 200, 'son testeur part')
    // La traversée de même : qui attend ne part pas, son testeur si — un autre profil que Tom, qu'une partie du musée attend.
    const attendLaTraversee = await partir(lea)
    assert.deepEqual([attendLaTraversee.status, attendLaTraversee.corps], [423, { error: `${PAGES_FERMABLES.cabinet.bientot} : reviens dans quelques jours`, bientot: 'cabinet' }])
    const max = await inscrireProfil(b.banc.url, 'max', 'Max')
    const maxId = (await lire(b, max, '/api/joueur/moi?leger')).corps.profile.id as string
    assert.equal((await ecrire(b.banc.url, `/api/admin/maintenance/pages/cabinet/testeurs/${maxId}`, undefined, admin, 'PUT')).status, 200)
    assert.equal(ok(await partir(max), 'son testeur part en traversée').traversee?.ou.sorte, 'cartes')
  } finally {
    await b.banc.close()
  }
})

// ── La fermeture de l'Expédition (le lot C8) ──────────────────────────────

/** Une lecture et une écriture d'un banc ordinaire, leur corps en JSON. */
const lireDu = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const posterAu = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('le banc ne force plus rien de l’Expédition : son option a quitté le serveur avec son code', () => {
  // Jusqu'au 16 novembre 2026, le banc posait `expeditionRemplacee: false` pour que les fichiers qui partaient en
  // expédition tournent encore. Son code parti, plus aucun réglage ne la rouvre : ni option du serveur, ni drapeau.
  const lancement = readFileSync(new URL('./banc.ts', import.meta.url), 'utf8').match(/createQuizServer\(\{[^}]*\}\)/)?.[0] ?? ''
  assert.match(lancement, /\.\.\.reglages \}\)$/, lancement)
  assert.doesNotMatch(lancement, /expedition|rencontres|questionAuCentre/i, lancement)
  const serveur = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(serveur, /expeditionRemplacee|EXPEDITION_REMPLACEE|questionAuCentre/, 'aucun drapeau de l’Expédition dans le serveur')
})

test('l’Expédition ne répond plus : chacune de ses adresses dit 404, et `/expedition` mène au Cabinet, sans drapeau', async () => {
  // Le choix du propriétaire du 31 octobre 2026 : « l'Expédition doit être effacée et plus accessible, uniquement le
  // Cabinet visible ». Son code a quitté le dépôt le 16 novembre : plus aucune de ses routes n'existe — une expédition
  // restée en route ne se finit pas, ce qu'elle avait donné reste (`apres-l-expedition.test.ts`).
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), PAGE)
  const banc = await demarrer({ baseDeLaCampagne: baseDuCabinet(), horlogeDuJour: () => DIX_HEURES, clientDist: dist })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')

    // Chacune de ses adresses d'avant, à tous : « introuvable », jamais « Connexion requise » — la porte des animateurs,
    // plus bas, les aurait prises pour les siennes.
    for (const [quoi, r] of [
      ['le départ, de Léa', await posterAu(banc, lea, '/api/expedition')],
      ['le départ, de Tom', await posterAu(banc, tom, '/api/expedition')],
      ['la page', await lireDu(banc, lea, '/api/expedition')],
      ['un pas', await posterAu(banc, lea, '/api/expedition/une-expedition/geste', { rang: 1, geste: { quoi: 'avancer', vers: '1-0' } })],
      ['une réponse', await posterAu(banc, lea, '/api/expedition/une-expedition/reponse', { position: 0, choix: 0 })],
      ['l’abandon', await posterAu(banc, lea, '/api/expedition/une-expedition/abandon')],
      ['un cadrage', await lireDu(banc, lea, '/api/expedition/une-expedition/detail/0/1')],
      ['un dévoilement', await lireDu(banc, lea, '/api/expedition/une-expedition/devoilement?position=0')],
    ] as const) {
      assert.deepEqual([r.status, r.corps.error], [404, 'Introuvable'], quoi)
    }
    // Aucune de ses routes dans le serveur : la seule ligne qui les nomme est celle qui répond 404 à toutes.
    const sources = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8')
    assert.deepEqual(sources.match(/['"`]\/api\/expedition[^'"`]*['"`]/g), ["'/api/expedition'"])
    // Son adresse, d'un favori ou d'un vieux lien, mène au Cabinet qui l'a remplacée.
    for (const chemin of ['/expedition', '/expedition/']) {
      const r = await fetch(`${banc.url}${chemin}`, { redirect: 'manual' })
      assert.equal(r.status, 302, chemin)
      assert.equal(r.headers.get('location'), '/cabinet', chemin)
    }
    assert.equal((await fetch(`${banc.url}/cabinet`, { redirect: 'manual' })).status, 200, 'le Cabinet se sert')
  } finally {
    await banc.close()
    rmSync(dist, { recursive: true, force: true })
  }
})

test('la page du Cabinet ne dit plus rien d’une expédition, même restée en route dans la base', async () => {
  // Le musée lisait l'expédition en route à son lot froid, pour une ligne « Ton expédition t'attend : la finir » qui,
  // l'Expédition effacée, aurait mené à `/expedition`, qui renvoie au Cabinet — une boucle. La lecture, le crochet qui
  // la tenait à jour (`expeditionChange`) et le champ de la page sont partis avec elle : le lot froid en lit une de moins.
  const banc = await demarrer({ baseDeLaCampagne: baseDuCabinet(), horlogeDuJour: () => DIX_HEURES })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const id = (await lireDu(banc, lea, '/api/joueur/moi?leger')).corps.profile.id as string
    const page = async () => (await lireDu(banc, lea, '/api/cabinet')).corps as PageDuCabinet
    assert.equal('expedition' in (await page()), false, 'rien en route : pas un mot')
    // Une expédition restée en route, comme la production en garde une : relue à froid, la page n'en dit toujours rien.
    aLaMain(
      banc.quizDbUrl.replace(/^file:/, ''),
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES ('exp-en-route', '${id}', '[]', 0, 3, 0, ${DIX_HEURES - 1000}, NULL, 'expedition')`,
    )
    await banc.redemarrer()
    const froide = await page()
    assert.equal('expedition' in froide, false)
    assert.equal(JSON.stringify(froide).includes('exp-en-route'), false, 'ni son identifiant, nulle part')
    assert.equal((await lireDu(banc, lea, '/api/expedition')).status, 404)
  } finally {
    await banc.close()
  }
})

test('l’album tait la voie de l’Expédition, toujours — et un légendaire gardé là-bas reste à lui', () => {
  const kraken = legendaire('lg:kraken')!
  for (const cabinet of [true, false]) assert.equal(voiesMontrees(kraken, cabinet).some(estUneVoieDExpedition), false, 'elle mènerait à un mode qui n’existe plus')
  assert.equal(voiesMontrees(kraken).some(estUneVoieDExpedition), false, 'd’office non plus')
  // Les autres voies ne bougent pas avec elle, celle du Cabinet comprise : ce que l'album montre, c'est tout sauf elle.
  assert.deepEqual(
    voiesMontrees(kraken, true),
    voiesDe(kraken).filter(v => !estUneVoieDExpedition(v)),
  )
  assert.ok(voiesDe(kraken).some(estUneVoieDExpedition), 'sa voie existe toujours : elle compte pour qui la tient')
  // Une voie tue n'est qu'un texte : rangée, elle donne toujours son légendaire (invariant 22).
  assert.ok(legendairesDebloques(new Map([[cleDeLExpedition('lg:kraken'), 1]])).includes('lg:kraken'))
  // La luciole de même : chaque refus qui dit où l'avoir envoie à la boutique, jamais à une expédition.
  assert.doesNotMatch(pourLAvoir(compagnon('luciole')!), /exp[ée]dition/i)
})

/** Un composant du client, rendu en HTML : son JSX est compilé pour un `React` global, posé avant d'importer le premier. */
async function rendu(fichier: string, composant: string, props: object, pathname = '/'): Promise<string> {
  Object.assign(globalThis, { React, window: { location: { pathname, search: '', hash: '', origin: 'http://banc' }, opener: null } })
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

test('l’accueil n’a plus de bouton pour l’Expédition : le Cabinet de curiosités a pris sa place', async () => {
  // Son bouton et la prop qui le rouvrait (`remplacee`) sont partis avec sa page, le 16 novembre 2026 : plus rien ne mène à
  // `/expedition`, quels que soient les drapeaux.
  const accueil = (props: object) => rendu('components/AccueilDesRoles', 'AccueilJouer', { enCours: [], onRejoindre: () => {}, lendemain: null, ...props })
  const ouvert = await accueil({ cabinet: true })
  assert.doesNotMatch(ouvert, /href="\/expedition"|L’Expédition/)
  // Le Cabinet est à sa place — sous les duels, avant « Entre amis ».
  assert.match(ouvert, /Les duels.*href="\/cabinet".*Le Cabinet de curiosités.*id="jouer-amis"/)
  // Là où le serveur ferme le Cabinet, ni l'un ni l'autre.
  assert.doesNotMatch(await accueil({ cabinet: false }), /href="\/expedition"|href="\/cabinet"/)
  // D'office, le bouton du Cabinet ne compte qu'une ligne de plus à sa section.
  assert.match(ouvert, /aria-labelledby="jouer-seul" style="--jouer-part:5"/)
})

// La page de l'Expédition, son départ fermé qui menait au Cabinet et sa fin, est partie avec son code le 16 novembre 2026 :
// `/expedition` y mène directement (plus haut).

// ── Pas de migration (la décision du propriétaire du 25 octobre 2026) ──────

test('plus rien ne se rapporte de l’Expédition : la base refuse l’origine, et la porte ne lit plus son codex', async () => {
  // « Je veux que tous les joueurs repartent à zéro » : chacun commence son Cabinet avec les quatre œuvres de départ.
  // L'origine `expedition` ne s'écrit plus — le schéma n'avait jamais servi hors des bases jetables : la `CHECK` se
  // resserre sans rien migrer —, et la porte ne garde rien de ce que la migration lisait.
  const fichier = path.join(dossierDEssai(), 'sans-migration.db')
  const { campagne } = await magasinDEssai(fichier, { t: DIX_HEURES })
  for (const origine of ['partie', 'achat', 'depart']) {
    aLaMain(fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES ('lea', 'oeuvre-${origine}', '${origine}', 0)`)
  }
  assert.throws(() => aLaMain(fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES ('lea', 'plume', 'expedition', 0)`), /CHECK constraint failed/)
  assert.equal('codexDuProfil' in campagne.porte(), false, 'la porte ne lit plus le codex de l’Expédition')
})

// Où le Cabinet de curiosités répond : hors de la production toujours, en
// production sous son drapeau (`cabinetOuvert`) — la page ne le lit pas, le
// serveur le lui dit (`<meta name="cabinet" content="ferme">`), et chacune de
// ses routes répond 404 en mots. Puis la maintenance du QG : le Cabinet en
// maintenance, ou bientôt disponible, ferme son départ (`POST
// /api/cabinet/partie`), ses achats, ses dorures et son échange — jamais un
// geste : une partie commencée se finit.
//
// Puis la fermeture de l'Expédition, prête (le lot C8) : sous son drapeau
// (`EXPEDITION_REMPLACEE`, que l'option `expeditionRemplacee` du serveur force
// au banc), son seul départ se refuse en mots — après « t'attend », qui reste
// le premier mot pour qui en a une en route —, ses autres routes servent (une
// expédition en route se finit), sa page le dit (`departFerme`) et mène au
// Cabinet, l'accueil perd son bouton, l'album tait sa voie. Et ce que la
// décision du propriétaire du 25 octobre 2026 — pas de migration — a retiré :
// plus rien ne se rapporte de l'Expédition au Cabinet.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { DIX_HEURES, aLaMain, baseDuCabinet, bancDuCabinet, commencer, dossierDEssai, fermerLesMagasins, jouer, laPage, lire, magasinDEssai, ok, poster, type BancDuCabinet } from './cabinet-banc'
import type { QuizServerOptions } from '../src/server'
import { CABINET_FERME } from '../src/cabinet'
import { BALISE_DU_CABINET_FERME } from '../src/core/page'
import { PORTES_DES_PAGES } from '../src/maintenance'
import { CABINET_EN_PRODUCTION, cabinetOuvert } from '../../shared/cabinet/ouverture'
import { modeDeLaSource } from '../../shared/pannes'
import { PAGES_EN_MAINTENANCE, PAGES_FERMABLES } from '../../shared/maintenance'
import { EXPEDITION_EN_PRODUCTION, EXPEDITION_REMPLACEE } from '../../shared/jokers'
import { cleDeLExpedition, estUneVoieDExpedition, legendaire, legendairesDebloques, voiesMontrees } from '../../shared/legendaires'
import { DEPART_FERME, type PageDeLExpedition, type VueDeLExpedition } from '../../shared/expedition'

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

test('en maintenance, le Cabinet ferme son départ, ses achats et son échange — jamais un geste : la partie commencée se finit', async () => {
  assert.ok(PAGES_EN_MAINTENANCE.includes('cabinet'))
  // Ce qui recommence quelque chose : une partie, une dépense de poussière d'or, un jeu de la visite changé (le lot C3 y a
  // ajouté l'achat, la dorure et l'échange, nés avec leurs routes).
  assert.deepEqual(PORTES_DES_PAGES.cabinet, ['POST /api/cabinet/partie', 'POST /api/cabinet/oeuvre/:cle/achat', 'POST /api/cabinet/oeuvre/:cle/dorure', 'POST /api/cabinet/visite/echange'])
  // Sa panne se dit sous son nom : la page, son départ, un geste, et ce qui dépense la poussière.
  for (const source of ['GET /api/cabinet', 'POST /api/cabinet/partie', 'POST /api/cabinet/partie/:id/geste', 'GET /api/cabinet/oeuvre/:cle', 'POST /api/cabinet/oeuvre/:cle/achat'])
    assert.equal(modeDeLaSource(source), 'cabinet', source)

  const b = await bancDuCabinet()
  try {
    const admin = await connexionAnimateur(b.banc.url)
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
    const tomId = (await lire(b, tom, '/api/joueur/moi?leger')).corps.profile.id as string
    const enRoute = ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'une partie commencée avant')
    const changer = (etat: string) => ecrire(b.banc.url, '/api/admin/maintenance/pages/cabinet', { etat }, admin, 'PUT')
    assert.equal((await changer('maintenance')).status, 200)

    const refus = await commencer(b, tom, { origine: 'libre', jeu: 'pari', carte: null })
    const enMaintenance = [423, { error: `${PAGES_FERMABLES.cabinet.titre} : reviens un peu plus tard`, maintenance: 'cabinet' }]
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

/** Le pas vers une question : le premier étage n'en pose que, et une source relirait le carnet. */
const versUneQuestion = (v: VueDeLExpedition) => v.permises.find(id => v.carte?.escales.find(e => e.id === id)?.sorte === 'question') ?? v.permises[0]

test('le banc garde le départ de l’Expédition ouvert à ses tests ; sans l’option, le serveur suit le drapeau du code', async () => {
  // Les vingt-trois fichiers qui partent en expédition ne bougent pas le jour où le drapeau ferme le départ : le banc pose
  // l'option à faux (`banc.ts`). Sans elle, ce que dit le drapeau — fermé à l'ouverture du Cabinet, partout.
  const essais: [string, Partial<QuizServerOptions>][] = [
    ['le banc', {}],
    ['le drapeau du code', { expeditionRemplacee: undefined }],
  ]
  for (const [quoi, reglages] of essais) {
    const banc = await demarrer({ baseDeLaCampagne: baseDuCabinet(), ...reglages })
    try {
      const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
      const ferme = quoi === 'le drapeau du code' && EXPEDITION_REMPLACEE
      const depart = await posterAu(banc, lea, '/api/expedition')
      assert.equal(depart.status, ferme ? 400 : 200, quoi)
      if (ferme) assert.equal(depart.corps.error, DEPART_FERME, quoi)
      assert.equal((await lireDu(banc, lea, '/api/expedition')).corps.departFerme, ferme ? 'cabinet' : undefined, quoi)
    } finally {
      await banc.close()
    }
  }
})

test('remplacée, l’Expédition refuse son seul départ en mots — après « t’attend » —, et une expédition en route se finit', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDuCabinet(), horlogeDuJour: () => DIX_HEURES })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    // Ouverte : rien ne se dit d'un départ fermé, et Léa part.
    assert.equal((await lireDu(banc, lea, '/api/expedition')).corps.departFerme, undefined)
    const partie = await posterAu(banc, lea, '/api/expedition')
    assert.equal(partie.status, 200, partie.corps.error)
    const v: VueDeLExpedition = partie.corps

    // La mise en ligne qui ferme le départ : le même disque, et le serveur relit son drapeau en démarrant.
    await banc.redemarrer({ reglages: { expeditionRemplacee: true } })

    // Qui en a une en route l'apprend d'abord : elle l'attend. Les autres, que l'Expédition a laissé place au Cabinet.
    const deLea = await posterAu(banc, lea, '/api/expedition')
    assert.deepEqual([deLea.status, deLea.corps.error], [400, 'Ton expédition t’attend : reprends-la, ou abandonne-la d’abord'])
    const deTom = await posterAu(banc, tom, '/api/expedition')
    assert.deepEqual([deTom.status, deTom.corps.error], [400, DEPART_FERME])
    assert.match(DEPART_FERME, /Cabinet de curiosités/)

    // La page garde sa forme, et le dit — à qui n'a rien en route comme à qui finit la sienne.
    const pageDeTom: PageDeLExpedition = (await lireDu(banc, tom, '/api/expedition')).corps
    assert.equal(pageDeTom.departFerme, 'cabinet')
    assert.equal(pageDeTom.expedition, null)
    assert.equal(pageDeTom.prochaine.gardiens.length, 3, 'la page garde sa forme')
    const pageDeLea: PageDeLExpedition = (await lireDu(banc, lea, '/api/expedition')).corps
    assert.equal(pageDeLea.departFerme, 'cabinet')
    assert.equal(pageDeLea.expedition?.id, v.id)

    // Ses autres routes servent : un pas, sa question, la réponse, l'abandon, puis « Mes réponses » par la série.
    const pas = await posterAu(banc, lea, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers: versUneQuestion(v) } })
    assert.equal(pas.status, 200, pas.corps.error)
    const q = pas.corps.expedition.question
    assert.ok(q, 'le premier étage pose une question')
    const reponse = await posterAu(banc, lea, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: 0 })
    assert.equal(reponse.status, 200, reponse.corps.error)
    const abandon = await posterAu(banc, lea, `/api/expedition/${v.id}/abandon`)
    assert.equal(abandon.status, 200, abandon.corps.error)
    assert.equal(abandon.corps.expedition.issue, 'abandonnee')
    assert.equal((await lireDu(banc, lea, `/api/campagne/serie/${v.id}/correction`)).status, 200)

    // Finie, plus rien ne l'attend : son départ se refuse comme aux autres.
    const encore = await posterAu(banc, lea, '/api/expedition')
    assert.deepEqual([encore.status, encore.corps.error], [400, DEPART_FERME])
    const apres: PageDeLExpedition = (await lireDu(banc, lea, '/api/expedition')).corps
    assert.deepEqual([apres.expedition, apres.departFerme], [null, 'cabinet'])
  } finally {
    await banc.close()
  }
})

test('remplacée, l’album tait la voie de l’Expédition — et un légendaire gardé là-bas reste à lui', () => {
  const kraken = legendaire('lg:kraken')!
  const dite = (remplacee: boolean) => voiesMontrees(kraken, true, remplacee).some(estUneVoieDExpedition)
  assert.equal(dite(false), EXPEDITION_EN_PRODUCTION, 'son départ ouvert, l’album la dit')
  assert.equal(dite(true), false, 'remplacée, il la tait : elle mènerait à un départ qui se refuse')
  assert.equal(voiesMontrees(kraken).some(estUneVoieDExpedition), EXPEDITION_EN_PRODUCTION && !EXPEDITION_REMPLACEE, 'les drapeaux du code, d’office')
  // Les autres voies ne bougent pas avec elle, celle du Cabinet comprise.
  const autres = (remplacee: boolean) => voiesMontrees(kraken, true, remplacee).filter(v => !estUneVoieDExpedition(v))
  assert.deepEqual(autres(true), autres(false))
  // Une voie tue n'est qu'un texte : rangée, elle donne toujours son légendaire (invariant 22).
  assert.ok(legendairesDebloques(new Map([[cleDeLExpedition('lg:kraken'), 1]])).includes('lg:kraken'))
})

/** Un composant du client, rendu en HTML : son JSX est compilé pour un `React` global, posé avant d'importer le premier. */
async function rendu(fichier: string, composant: string, props: object, pathname = '/'): Promise<string> {
  Object.assign(globalThis, { React, window: { location: { pathname, search: '', hash: '', origin: 'http://banc' }, opener: null } })
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Ce qu'un rendu dit, sans ses balises ni ses espaces fines (`espacesFines`). */
const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[  ⁠]/g, ' ').replace(/\s+/g, ' ')

test('remplacée, l’accueil n’a plus le bouton de l’Expédition : le Cabinet de curiosités prend sa place', async () => {
  const accueil = (props: object) => rendu('components/AccueilDesRoles', 'AccueilJouer', { enCours: [], onRejoindre: () => {}, lendemain: null, ...props })
  // Le départ ouvert : les deux, l'un après l'autre (`navigation.test.ts`).
  assert.match(await accueil({ remplacee: false, cabinet: true }), /href="\/expedition".*href="\/cabinet"/)
  // Remplacée : l'Expédition s'en va, le Cabinet est à sa place — sous les duels, avant « Entre amis ».
  const apres = await accueil({ remplacee: true, cabinet: true })
  assert.doesNotMatch(apres, /href="\/expedition"|L’Expédition/)
  assert.match(apres, /Les duels.*href="\/cabinet".*Le Cabinet de curiosités.*id="jouer-amis"/)
  // Là où le serveur ferme le Cabinet, ni l'un ni l'autre : le départ de l'Expédition est fermé partout.
  assert.doesNotMatch(await accueil({ remplacee: true, cabinet: false }), /href="\/expedition"|href="\/cabinet"/)
})

test('remplacée, la page de l’Expédition ne propose plus « Partir » : elle dit le Cabinet et y mène — celle en route se reprend', async () => {
  const rien = () => {}
  const depart = (page: PageDeLExpedition) => rendu('views/ExpeditionApp', 'Depart', { page, busy: false, erreur: '', onPartir: rien, onReprendre: rien, onAbandonner: rien }, '/expedition')
  const prochaine: PageDeLExpedition['prochaine'] = { numero: 7, gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'], aLui: [], invite: 'lg:lion', equipables: [], rencontres: true }

  const ouvert = await depart({ expedition: null, prochaine, passeport: [] })
  assert.match(ouvert, /Partir<\/button>/)
  assert.doesNotMatch(ouvert, /href="\/cabinet"/)

  const ferme = await depart({ expedition: null, prochaine, passeport: ['animaux'], departFerme: 'cabinet' })
  assert.doesNotMatch(ferme, /Partir<\/button>/, 'plus de départ à proposer')
  assert.doesNotMatch(texte(ferme), /Ce qui t’attend|part avec toi|Ton codex|Ton paquet/, 'ni gardiens annoncés, ni équipe, ni codex : il ne partira pas')
  assert.ok(texte(ferme).includes(texte(DEPART_FERME)), 'la phrase du refus, la même')
  assert.match(ferme, /<a class="btn btn-primary btn-big btn-block" href="\/cabinet">.*Le Cabinet de curiosités<\/a>/)
  assert.match(texte(ferme), /Ton passeport/, 'ses tampons restent à lui')

  // Une expédition en route se reprend, ou s'abandonne : le départ fermé ne la touche pas.
  const vue = { id: 'x', numero: 7, acte: 0, rang: 3, issue: 'en-route', gardiens: prochaine.gardiens.map(cle => ({ cle, vaincu: false })), vies: 3, justes: 2, courage: 41, equipee: [], invite: 'lg:lion' } as unknown as VueDeLExpedition
  const enRoute = await depart({ expedition: vue, prochaine, passeport: [], departFerme: 'cabinet' })
  assert.match(enRoute, /Reprendre<\/button>/)
  assert.match(enRoute, /Abandonner cette expédition<\/button>/)

  // Sa fin ne propose plus « Une autre expédition » : elle mène au Cabinet.
  const vaincus = ['lg:kraken', 'lg:dragon', 'lg:oracle'].map(cle => ({ cle, vaincu: true }))
  const finie = { id: 'x', numero: 7, acte: 3, gardiens: vaincus, carte: null, ici: null, trace: [], permises: [], vies: 2, justes: 24, issue: 'au-bout', moyen: false, rang: 30 }
  const fin = (departFerme: boolean) =>
    rendu(
      'views/ExpeditionApp',
      'FinDeLExpedition',
      { fin: { e: 'fin', vue: finie, tombe: {}, correction: null }, gains: { xp: 0, justes: 24, tampons: [] }, erreur: '', onCorrection: rien, onAutre: rien, departFerme },
      '/expedition',
    )
  assert.match(await fin(false), /Une autre expédition<\/button>/)
  const finFermee = await fin(true)
  assert.doesNotMatch(finFermee, /Une autre expédition/)
  assert.match(finFermee, /<a class="btn btn-primary btn-big btn-block" href="\/cabinet">.*Le Cabinet de curiosités<\/a>/)
  assert.match(finFermee, /Mes réponses<\/button>/)
})

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

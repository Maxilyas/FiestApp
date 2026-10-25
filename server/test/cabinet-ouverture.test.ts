// Où le Cabinet de curiosités répond : hors de la production toujours, en
// production sous son drapeau (`cabinetOuvert`) — la page ne le lit pas, le
// serveur le lui dit (`<meta name="cabinet" content="ferme">`), et chacune de
// ses routes répond 404 en mots. Puis la maintenance du QG : le Cabinet en
// maintenance, ou bientôt disponible, ferme son départ (`POST
// /api/cabinet/partie`) — jamais un geste : une partie commencée se finit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { connexionAnimateur, ecrire, inscrireProfil } from './banc'
import { bancDuCabinet, commencer, jouer, laPage, lire, ok, poster, type BancDuCabinet } from './cabinet-banc'
import { CABINET_FERME } from '../src/cabinet'
import { BALISE_DU_CABINET_FERME } from '../src/core/page'
import { PORTES_DES_PAGES } from '../src/maintenance'
import { CABINET_EN_PRODUCTION, cabinetOuvert } from '../../shared/cabinet/ouverture'
import { modeDeLaSource } from '../../shared/pannes'
import { PAGES_EN_MAINTENANCE, PAGES_FERMABLES } from '../../shared/maintenance'

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

test('en maintenance, le Cabinet ferme son départ — jamais un geste : la partie commencée se finit', async () => {
  assert.ok(PAGES_EN_MAINTENANCE.includes('cabinet'))
  assert.deepEqual(PORTES_DES_PAGES.cabinet, ['POST /api/cabinet/partie'])
  // Sa panne se dit sous son nom : la page, son départ, un geste.
  for (const source of ['GET /api/cabinet', 'POST /api/cabinet/partie', 'POST /api/cabinet/partie/:id/geste']) assert.equal(modeDeLaSource(source), 'cabinet', source)

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
    assert.deepEqual([refus.status, refus.corps], [423, { error: `${PAGES_FERMABLES.cabinet.titre} : reviens un peu plus tard`, maintenance: 'cabinet' }])
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

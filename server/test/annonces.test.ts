// Les annonces à tous, au QG (`/admin#annonces`, sous « Animer ») — le souhait
// du propriétaire du 19 octobre 2026, le soir où le quiz du jour et les défis
// s'étaient rouverts en production : « une annonce pour dire que l'incident
// est résolu, et envoyer des confettis à tous pour le dédommagement ». Un
// message que chaque profil lit une fois, en haut de son accueil, et, si on
// veut, des confettis pour chacun — un don par profil, qui ne se reprend pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ANNONCE_MAX, lireLeMessage, lireLesConfettis, type PageDesAnnonces } from '../../shared/annonces'
import type { AnnonceDeLAdministrateur, FicheDuJoueur, ProfilDAccueil } from '../../shared/profil'
import type { JournalDuQg } from '../../shared/qg'

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const annoncer = (banc: Banc, admin: string, corps: { id?: string; message?: unknown; confettis?: unknown }) => faire(banc, admin, '/api/admin/annonces', corps)
const accueil = async (banc: Banc, cookie: string) => (await lire<{ profile: ProfilDAccueil }>(banc, cookie, '/api/joueur/moi?accueil')).corps.profile
/** Ce que son accueil lui annonce, de ce que l'administrateur a dit à tous. */
const sesAnnonces = async (banc: Banc, cookie: string) =>
  ((await accueil(banc, cookie)).annonces ?? []).flatMap((a: AnnonceDeLAdministrateur) => (a.sorte === 'annonce' ? [[a.message, a.confettis]] : a.sorte === 'confettis' ? [['don', a.confettis]] : []))
const idDe = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string
const lesGestes = async (banc: Banc, admin: string) => (await lire<JournalDuQg>(banc, admin, '/api/admin/gestes?sorte=annonce')).corps.gestes.map(g => g.resume)

test('le message et les confettis d’une annonce : resserrés, refusés plutôt que coupés, de 0 à 500 par profil', () => {
  assert.equal(lireLeMessage('  Le quiz du jour\n  remarche !  '), 'Le quiz du jour remarche !')
  assert.equal(lireLeMessage('é'.repeat(ANNONCE_MAX)), 'é'.repeat(ANNONCE_MAX))
  assert.throws(() => lireLeMessage('é'.repeat(ANNONCE_MAX + 1)), /tient en 200 caractères/)
  for (const vide of ['', '   ', null, undefined, 42]) assert.throws(() => lireLeMessage(vide), /Écris le message/)
  assert.deepEqual([lireLesConfettis(undefined), lireLesConfettis(null), lireLesConfettis(0), lireLesConfettis(500)], [0, 0, 0, 500])
  for (const faux of [-1, 501, 2.5, '50', Number.NaN]) assert.throws(() => lireLesConfettis(faux), /Entre 0 et 500 confettis/, String(faux))
})

test('une annonce à tous : chaque profil la lit une fois sur son accueil, avec ses confettis — ni le suspendu, ni celui venu après', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const [idLea, idZoe] = [await idDe(banc, lea), await idDe(banc, zoe)]
    assert.equal((await faire(banc, admin, `/api/admin/profils/${idZoe}/suspendre`)).status, 200)

    // La page dit combien la recevraient : les profils d'aujourd'hui, sans la suspendue.
    const avant = (await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps
    assert.deepEqual(avant.annonces, [])
    const profils = avant.profils
    assert.ok(profils >= 2, `${profils} profils`)

    const faite = await annoncer(banc, admin, { id: 'incident-du-19', message: '  Le quiz du jour et le défi   remarchent. Merci de votre patience !  ', confettis: 50 })
    assert.equal(faite.status, 200, faite.corps.error)
    const page = faite.corps as PageDesAnnonces
    assert.deepEqual(
      page.annonces.map(a => [a.id, a.message, a.confettis, a.destinataires, a.retireeLe]),
      [['incident-du-19', 'Le quiz du jour et le défi remarchent. Merci de votre patience !', 50, profils, null]],
    )

    // Léa et Bob la lisent, avec leurs cinquante confettis, dans leur solde — une fois : le don ne se redit pas à part.
    for (const qui of [lea, bob]) {
      assert.deepEqual(await sesAnnonces(banc, qui), [['Le quiz du jour et le défi remarchent. Merci de votre patience !', 50]])
      assert.equal((await accueil(banc, qui)).boutique?.confettis.solde, 50)
    }
    assert.deepEqual((await lire<FicheDuJoueur>(banc, admin, `/api/admin/profils/${idLea}`)).corps.confettis, { solde: 50, offerts: 50 })

    // Suspendue à son envoi, Zoé n'a rien reçu : réactivée — ses sessions sont tombées avec la suspension —, elle
    // lit le message, sans les confettis qu'elle n'a pas reçus.
    assert.equal((await faire(banc, admin, `/api/admin/profils/${idZoe}/reactiver`)).status, 200)
    const revenue = await ecrire(banc.url, '/api/joueur/connexion', { login: 'zoe', password: 'motdepasse1' })
    assert.equal(revenue.status, 200)
    const zoeRevenue = cookieDe(revenue, 'qz_joueur')
    assert.deepEqual(await sesAnnonces(banc, zoeRevenue), [['Le quiz du jour et le défi remarchent. Merci de votre patience !', 0]])
    assert.equal((await accueil(banc, zoeRevenue)).boutique?.confettis.solde, 0)

    // Max arrive après : elle parle d'avant lui, il ne la lit pas.
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🐸')
    assert.deepEqual(await sesAnnonces(banc, max), [])
    assert.equal((await accueil(banc, max)).boutique?.confettis.solde, 0)

    // Le même envoi, refait — sa réponse perdue en route : refusé, rien n'est offert deux fois, rien ne se note de plus.
    const rejouee = await annoncer(banc, admin, { id: 'incident-du-19', message: 'Le quiz du jour et le défi remarchent. Merci de votre patience !', confettis: 50 })
    assert.equal(rejouee.status, 409)
    assert.match(rejouee.corps.error, /déjà partie/)
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 50)
    assert.equal((await accueil(banc, max)).boutique?.confettis.solde, 0, 'rejouée, elle ne donne rien aux profils venus depuis')
    assert.equal((await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps.annonces.length, 1)
    assert.deepEqual(await lesGestes(banc, admin), [`Annonce à ${profils} profils : « Le quiz du jour et le défi remarchent. Merci de votre patience ! » — 50 confettis chacun`])

    // Ce qui ne va pas se refuse, sans rien envoyer.
    for (const [corps, motif] of [
      [{ message: '   ' }, /Écris le message/],
      [{ message: 'x'.repeat(ANNONCE_MAX + 1) }, /tient en 200 caractères/],
      [{ message: 'Bonjour', confettis: 501 }, /Entre 0 et 500 confettis/],
      [{ message: 'Bonjour', confettis: '50' }, /Entre 0 et 500 confettis/],
    ] as const) {
      const refus = await annoncer(banc, admin, corps)
      assert.equal(refus.status, 400, JSON.stringify(corps))
      assert.match(refus.corps.error, motif)
    }
    assert.equal((await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps.annonces.length, 1)

    // Un joueur n'y touche pas : sans console, la porte de `/api/admin` ne s'ouvre pas (un animateur : `admin-seulement.test.ts`).
    assert.equal((await annoncer(banc, lea, { message: 'Coucou' })).status, 401)
  } finally {
    await banc.close()
  }
})

test('un message seul, puis retiré : l’accueil le tait — et les confettis d’une annonce retirée restent à chacun', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')

    const cadeau = (await annoncer(banc, admin, { id: 'cadeau-de-noel', message: 'Joyeux Noël à tous !', confettis: 20 })).corps as PageDesAnnonces
    const seule = await annoncer(banc, admin, { id: 'expedition-ouverte', message: 'L’Expédition est ouverte à tous !' })
    assert.equal(seule.status, 200, seule.corps.error)
    assert.equal((seule.corps as PageDesAnnonces).annonces[0].confettis, 0)
    assert.deepEqual(await sesAnnonces(banc, lea), [
      ['L’Expédition est ouverte à tous !', 0],
      ['Joyeux Noël à tous !', 20],
    ])

    // Retirées : l'accueil ne les dit plus ; le cadeau, lui, reste dans le solde.
    for (const id of ['expedition-ouverte', 'cadeau-de-noel']) {
      const retiree = await faire(banc, admin, `/api/admin/annonces/${id}`, undefined, 'DELETE')
      assert.equal(retiree.status, 200, retiree.corps.error)
    }
    assert.deepEqual(await sesAnnonces(banc, lea), [])
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 20)
    const page = (await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps
    assert.ok(page.annonces.every(a => a.retireeLe !== null))
    assert.equal(cadeau.annonces[0].retireeLe, null)

    // Déjà retirée, introuvable : le geste se refuse, le journal ne note que ce qui a changé.
    assert.match((await faire(banc, admin, '/api/admin/annonces/cadeau-de-noel', undefined, 'DELETE')).corps.error, /déjà retirée/)
    assert.equal((await faire(banc, admin, '/api/admin/annonces/inconnue', undefined, 'DELETE')).status, 404)
    const gestes = await lesGestes(banc, admin)
    assert.deepEqual(gestes.slice(0, 2), ['Annonce retirée : « Joyeux Noël à tous ! » — ses confettis restent offerts', 'Annonce retirée : « L’Expédition est ouverte à tous ! »'])
    assert.equal(gestes.length, 4)
  } finally {
    await banc.close()
  }
})

test('l’annonce et ses dons s’écrivent ensemble, ou rien : une base qui refuse les dons ne laisse pas une annonce sans cadeau', async () => {
  const banc = await demarrer()
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    db.exec(`CREATE TRIGGER refus BEFORE INSERT ON profile_dons BEGIN SELECT RAISE(ABORT, 'quota'); END`)
    assert.equal((await annoncer(banc, admin, { id: 'avant-la-panne', message: 'Merci de votre patience !', confettis: 10 })).status, 500)
    db.exec('DROP TRIGGER refus')
    assert.deepEqual((await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps.annonces, [])
    assert.deepEqual(await sesAnnonces(banc, lea), [])

    // Le même envoi, une fois la base revenue : il part, en entier.
    assert.equal((await annoncer(banc, admin, { id: 'avant-la-panne', message: 'Merci de votre patience !', confettis: 10 })).status, 200)
    assert.deepEqual(await sesAnnonces(banc, lea), [['Merci de votre patience !', 10]])
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 10)
  } finally {
    db.close()
    await banc.close()
  }
})

test('sur l’accueil, une annonce dit ce qu’elle offre à lui — et « Compris », quand elle n’offre rien', async () => {
  Object.assign(globalThis, { React })
  const { CarteDeLAdministrateur } = await import(new URL('../../client/src/components/CarteDeLAdministrateur.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const carte = (annonce: AnnonceDeLAdministrateur, onRanger?: () => void) => renderToStaticMarkup(React.createElement(CarteDeLAdministrateur, { annonce, prenom: 'Léa', onRanger }))
  const avec = carte({ id: 'annonce:a', sorte: 'annonce', message: 'Le quiz du jour remarche : merci !', confettis: 50, le: 0 }, () => {})
  // Sa typographie posée à l'affichage : l'insécable devant les deux-points, la fine devant le point d'exclamation.
  assert.match(avec, /<b>\+50 confettis, à tous les joueurs<\/b><span>Le quiz du jour remarche : merci !<\/span>/)
  assert.match(avec, /<button type="button" class="annonce-admin-merci">Merci<\/button>/)
  const seule = carte({ id: 'annonce:b', sorte: 'annonce', message: 'L’Expédition est ouverte à tous.', confettis: 0, le: 0 }, () => {})
  assert.match(seule, /<b>À tous les joueurs<\/b>/)
  assert.match(seule, />Compris<\/button>/)
  // À l'aperçu du QG, le bouton n'est qu'une image : rien ne s'y arrête au clavier.
  assert.doesNotMatch(carte({ id: 'apercu', sorte: 'annonce', message: 'Aperçu', confettis: 0, le: 0 }), /<button/)
})

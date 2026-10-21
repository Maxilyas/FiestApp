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
import { ANNONCE_MAX, CHOIX_LONGUEUR_MAX, MOT_MAX, lireLaQuestion, lireLaReponse, lireLeMessage, lireLesConfettis, type PageDesAnnonces } from '../../shared/annonces'
import type { AnnonceDeLAdministrateur, FicheDuJoueur, ProfilDAccueil } from '../../shared/profil'
import type { JournalDuQg } from '../../shared/qg'

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const annoncer = (banc: Banc, admin: string, corps: { id?: string; message?: unknown; confettis?: unknown; question?: unknown }) => faire(banc, admin, '/api/admin/annonces', corps)
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

// La question d'une annonce (le souhait du propriétaire du 21 octobre 2026) : demander un vote,
// une note ou quelques mots aux joueurs, et leur donner des confettis pour avoir répondu.
const repondre = (banc: Banc, cookie: string, annonce: string, reponse: unknown) =>
  faire(banc, cookie, `/api/joueur/annonces/${annonce}/reponse`, { reponse })
const sesQuestions = async (banc: Banc, cookie: string) =>
  ((await accueil(banc, cookie)).annonces ?? []).flatMap((a: AnnonceDeLAdministrateur) => (a.sorte === 'annonce' && a.question ? [a.question] : []))

test('la question d’une annonce : un vote de deux à cinq choix, une note de 1 à 5, un mot — refusés plutôt que corrigés', () => {
  assert.equal(lireLaQuestion(undefined), null)
  assert.deepEqual(lireLaQuestion({ sorte: 'note' }), { sorte: 'note', choix: [], recompense: 0 })
  assert.deepEqual(lireLaQuestion({ sorte: 'vote', choix: [' Les duels ', 'La  campagne'], recompense: 20 }), { sorte: 'vote', choix: ['Les duels', 'La campagne'], recompense: 20 })
  for (const [brut, motif] of [
    [{ sorte: 'sondage' }, /vote, note ou mot libre/],
    [{ sorte: 'vote', choix: ['Un seul'] }, /au moins 2 choix/],
    [{ sorte: 'vote', choix: ['a', 'b', 'c', 'd', 'e', 'f'] }, /5 choix au plus/],
    [{ sorte: 'vote', choix: ['a', ''] }, /Un choix est vide/],
    [{ sorte: 'vote', choix: ['a', 'A'] }, /Deux choix sont les mêmes/],
    [{ sorte: 'vote', choix: ['a', 'x'.repeat(CHOIX_LONGUEUR_MAX + 1)] }, /40 caractères/],
    [{ sorte: 'note', recompense: 501 }, /Entre 0 et 500 confettis/],
    ['vote', /mal formée/],
  ] as const) assert.throws(() => lireLaQuestion(brut), motif, JSON.stringify(brut))

  const vote = { sorte: 'vote' as const, choix: ['a', 'b'] }
  assert.equal(lireLaReponse(vote, 1), '1')
  for (const faux of [-1, 2, 0.5, '1', null]) assert.throws(() => lireLaReponse(vote, faux), /Choisis une des réponses/, String(faux))
  assert.equal(lireLaReponse({ sorte: 'note', choix: [] }, 5), '5')
  for (const faux of [0, 6, 2.5, '3']) assert.throws(() => lireLaReponse({ sorte: 'note', choix: [] }, faux), /note de 1 à 5/, String(faux))
  assert.equal(lireLaReponse({ sorte: 'mot', choix: [] }, '  Plus  de duels \n'), 'Plus de duels')
  assert.throws(() => lireLaReponse({ sorte: 'mot', choix: [] }, '   '), /Écris ta réponse/)
  assert.throws(() => lireLaReponse({ sorte: 'mot', choix: [] }, 'x'.repeat(MOT_MAX + 1)), /200 caractères/)
})

test('un vote avec récompense : une réponse par profil, ses confettis une fois, ses résultats au QG, puis la question close', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')

    // Une question mal formée ne part pas, et n'emporte pas l'annonce.
    const mauvaise = await annoncer(banc, admin, { message: 'Quel mode en premier ?', question: { sorte: 'vote', choix: ['Les duels'] } })
    assert.equal(mauvaise.status, 400)
    assert.equal((await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps.annonces.length, 0)

    const faite = await annoncer(banc, admin, {
      id: 'sondage-des-modes',
      message: 'Quel mode voulez-vous voir grandir ?',
      question: { sorte: 'vote', choix: ['Les duels', 'La campagne', 'L’Expédition'], recompense: 10 },
    })
    assert.equal(faite.status, 200, faite.corps.error)
    assert.equal((faite.corps as PageDesAnnonces).annonces[0].question?.resultats.reponses, 0)
    assert.match((await lesGestes(banc, admin))[0], /avec un vote, 10 confettis par réponse/)

    // L'accueil de Léa la pose avec ses choix et sa récompense — sans que rien ne soit donné avant la réponse.
    assert.deepEqual(await sesQuestions(banc, lea), [{ sorte: 'vote', choix: ['Les duels', 'La campagne', 'L’Expédition'], recompense: 10 }])
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 0)

    // Une réponse hors des choix, ou sans compte : refusée, rien n'est écrit.
    assert.equal((await repondre(banc, lea, 'sondage-des-modes', 3)).status, 400)
    assert.equal((await repondre(banc, '', 'sondage-des-modes', 0)).status, 401)
    assert.equal((await repondre(banc, lea, 'inconnue', 0)).status, 404)

    // Elle répond : dix confettis, une fois. La question ne revient plus sur son accueil ; le message, oui, comme une annonce.
    const reponse = await repondre(banc, lea, 'sondage-des-modes', 1)
    assert.equal(reponse.status, 200, reponse.corps.error)
    assert.deepEqual(reponse.corps, { confettis: 10 })
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 10)
    assert.deepEqual(await sesQuestions(banc, lea), [])
    assert.deepEqual(await sesAnnonces(banc, lea), [['Quel mode voulez-vous voir grandir ?', 0]], 'son don de réponse ne se redit pas en « +10 confettis »')
    const encore = await repondre(banc, lea, 'sondage-des-modes', 0)
    assert.equal(encore.status, 409)
    assert.match(encore.corps.error, /déjà répondu/)
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 10, 'une seule récompense')

    // Bob vote autrement ; le QG compte, dans l'ordre des choix.
    assert.equal((await repondre(banc, bob, 'sondage-des-modes', 0)).status, 200)
    const page = (await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps
    assert.deepEqual(page.annonces[0].question?.resultats, { reponses: 2, comptes: [1, 1, 0], moyenne: null, mots: [] })

    // Close : plus de réponse, les confettis donnés et les résultats restent.
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🐸')
    assert.deepEqual(await sesQuestions(banc, max), [], 'une annonce d’avant lui ne le questionne pas')
    assert.equal((await repondre(banc, max, 'sondage-des-modes', 0)).status, 404)
    const close = await faire(banc, admin, '/api/admin/annonces/sondage-des-modes/cloturer')
    assert.equal(close.status, 200, close.corps.error)
    assert.notEqual((close.corps as PageDesAnnonces).annonces[0].question?.fermeeLe, null)
    assert.equal((await faire(banc, admin, '/api/admin/annonces/sondage-des-modes/cloturer')).status, 400, 'déjà close')
    assert.equal((await faire(banc, admin, '/api/admin/annonces/inconnue/cloturer')).status, 404)
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 10)
    assert.match((await lesGestes(banc, admin))[0], /Question close : « Quel mode voulez-vous voir grandir \? » — 2 réponses/)

    // Un joueur ne clôt rien.
    assert.equal((await faire(banc, lea, '/api/admin/annonces/sondage-des-modes/cloturer')).status, 401)
  } finally {
    await banc.close()
  }
})

test('une note et un mot libre : la moyenne, les mots avec leur auteur — et une question rejouée ne s’ajoute pas à une annonce faite', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')

    await annoncer(banc, admin, { id: 'note-expedition', message: 'Comment trouves-tu l’Expédition ?', question: { sorte: 'note' } })
    await annoncer(banc, admin, { id: 'mot-libre-ideal', message: 'Une idée pour la prochaine version ?', question: { sorte: 'mot', recompense: 5 } })
    // Une annonce seule, rejouée avec une question : l'annonce faite n'en gagne pas.
    await annoncer(banc, admin, { id: 'message-seul-1', message: 'Bonne soirée !' })
    assert.equal((await annoncer(banc, admin, { id: 'message-seul-1', message: 'Bonne soirée !', question: { sorte: 'note' } })).status, 409)
    assert.equal((await repondre(banc, lea, 'message-seul-1', 3)).status, 404)

    assert.equal((await repondre(banc, lea, 'note-expedition', 4)).status, 200)
    assert.equal((await repondre(banc, bob, 'note-expedition', 5)).status, 200)
    assert.equal((await repondre(banc, lea, 'note-expedition', 0)).status, 409, 'déjà répondu, même hors des bornes')

    assert.equal((await repondre(banc, lea, 'mot-libre-ideal', '   ')).status, 400)
    assert.equal((await repondre(banc, lea, 'mot-libre-ideal', '  Un mode   coopératif !  ')).status, 200)
    assert.equal((await accueil(banc, lea)).boutique?.confettis.solde, 5)

    const page = (await lire<PageDesAnnonces>(banc, admin, '/api/admin/annonces')).corps
    const parId = new Map(page.annonces.map(a => [a.id, a.question]))
    assert.deepEqual(parId.get('note-expedition')?.resultats, { reponses: 2, comptes: [0, 0, 0, 1, 1], moyenne: 4.5, mots: [] })
    const mots = parId.get('mot-libre-ideal')?.resultats
    assert.equal(mots?.reponses, 1)
    assert.deepEqual(mots?.mots.map(m => [m.prenom, m.texte]), [['Léa', 'Un mode coopératif !']])
    assert.equal(parId.get('message-seul-1'), null)

    // Retirée, une annonce ne reçoit plus de réponse.
    assert.equal((await faire(banc, admin, '/api/admin/annonces/mot-libre-ideal', {}, 'DELETE')).status, 200)
    assert.equal((await repondre(banc, bob, 'mot-libre-ideal', 'Trop tard')).status, 404)
  } finally {
    await banc.close()
  }
})

// La fiche d'un joueur, au QG (`/admin#profils`, les choix du 13 octobre
// 2026) : ce qu'il a joué, ses confettis, sa connexion, l'épreuve qui
// l'attend — et les gestes qui l'aident sans rien lui demander : lui offrir
// des confettis, lui tirer un code de secours neuf, changer un prénom qui ne
// va pas, le suspendre et le réactiver, rouvrir sa connexion fermée, libérer
// son épreuve de sentier, le remettre au classement. Chacun se joue ici pour
// de vrai — le joueur le voit, ou ne le voit plus —, et se note au journal,
// sur son profil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, invite, type Banc } from './banc'
import type { FicheDuJoueur, ProfilDAccueil, ProfilDAdministration } from '../../shared/profil'
import type { JournalDuQg } from '../../shared/qg'

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any, entetes: r.headers }))
const fiche = async (banc: Banc, admin: string, id: string) => (await lire<FicheDuJoueur>(banc, admin, `/api/admin/profils/${id}`)).corps
const sesGestes = async (banc: Banc, admin: string, id: string) =>
  (await lire<JournalDuQg>(banc, admin, `/api/admin/gestes?cible=${id}`)).corps.gestes.map(g => g.resume)
const connexion = (banc: Banc, login: string, password: string) => faire(banc, '', '/api/joueur/connexion', { login, password })

/** Un banc, l'administrateur, et Léa : son profil, son cookie, son identifiant. */
async function avecLea(): Promise<{ banc: Banc; admin: string; lea: string; id: string }> {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
  const admin = await connexionAnimateur(banc.url)
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string
  return { banc, admin, lea, id }
}

test('la fiche d’un joueur : ce qu’il a joué, ses confettis, sa connexion, l’épreuve qui l’attend', async () => {
  const { banc, admin, id } = await avecLea()
  try {
    const f = await fiche(banc, admin, id)
    assert.deepEqual(
      [f.login, f.nom, f.suspendu, f.suspenduLe, f.masque, f.confettis, f.connexion, f.epreuve, f.toi],
      ['lea', 'Léa', false, null, false, { solde: 0, offerts: 0 }, { fermeeJusquA: null }, null, false],
    )
    assert.deepEqual(f.jour, { joues: 0, victoires: 0 })
    assert.equal(typeof f.creeLe, 'number')
    assert.equal((await lire(banc, admin, '/api/admin/profils/inconnu')).status, 404)
  } finally {
    await banc.close()
  }
})

test('offrir des confettis : dans son solde, dit une fois sur son accueil avec le mot — entre 1 et 500, jamais à un suspendu', async () => {
  const { banc, admin, lea, id } = await avecLea()
  try {
    const don = await faire(banc, admin, `/api/admin/profils/${id}/confettis`, { confettis: 100, mot: '  Merci   pour samedi !  ' })
    assert.equal(don.status, 200, don.corps.error)
    assert.deepEqual([don.corps.confettis, don.corps.mot], [100, 'Merci pour samedi !'])
    for (const confettis of [0, 501, 2.5, '100', null]) {
      const refus = await faire(banc, admin, `/api/admin/profils/${id}/confettis`, { confettis })
      assert.equal(refus.status, 400, `${confettis}`)
      assert.match(refus.corps.error, /Entre 1 et 500 confettis/)
    }

    // Son solde les compte, et son accueil le lui dit — le mot compris.
    const accueil = (await lire<{ profile: ProfilDAccueil }>(banc, lea, '/api/joueur/moi?accueil')).corps.profile
    assert.equal(accueil.boutique?.confettis.solde, 100)
    assert.deepEqual(
      accueil.annonces?.map(a => (a.sorte === 'confettis' ? [a.sorte, a.confettis, a.mot] : [a.sorte])),
      [['confettis', 100, 'Merci pour samedi !']],
    )
    assert.deepEqual((await fiche(banc, admin, id)).confettis, { solde: 100, offerts: 100 })
    assert.deepEqual(await sesGestes(banc, admin, id), ['100 confettis offerts : Léa (@lea) — « Merci pour samedi ! »'])

    // Un seul confetti s'accorde, et sans mot rien ne suit.
    assert.equal((await faire(banc, admin, `/api/admin/profils/${id}/confettis`, { confettis: 1 })).status, 200)
    assert.equal((await sesGestes(banc, admin, id))[0], '1 confetti offert : Léa (@lea)')
  } finally {
    await banc.close()
  }
})

test('un code de secours neuf : l’ancien ne vaut plus rien, le joueur rentre par « Mot de passe oublié ? »', async () => {
  const { banc, admin, id } = await avecLea()
  try {
    const premier = await faire(banc, admin, `/api/admin/profils/${id}/secours`)
    assert.equal(premier.status, 200, premier.corps.error)
    assert.equal(premier.entetes.get('cache-control'), 'no-store', 'un secret ne se garde nulle part')
    assert.equal(premier.corps.login, 'lea')
    assert.match(premier.corps.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    const second = (await faire(banc, admin, `/api/admin/profils/${id}/secours`)).corps.code as string

    const avecLePremier = await faire(banc, '', '/api/joueur/secours', { login: 'lea', code: premier.corps.code, password: 'nouveau-mdp-1' })
    assert.equal(avecLePremier.status, 400, 'le code d’avant ne vaut plus rien')
    const avecLeSecond = await faire(banc, '', '/api/joueur/secours', { login: 'lea', code: second, password: 'nouveau-mdp-1' })
    assert.equal(avecLeSecond.status, 200, avecLeSecond.corps.error)
    assert.ok(avecLeSecond.corps.recovery, 'un code neuf, à lui seul cette fois')
    assert.equal((await connexion(banc, 'lea', 'nouveau-mdp-1')).status, 200)

    // Au journal, le geste — jamais le code.
    const journal = JSON.stringify((await lire(banc, admin, `/api/admin/gestes?cible=${id}`)).corps)
    assert.deepEqual(await sesGestes(banc, admin, id), ['Code de secours neuf tiré : Léa (@lea)', 'Code de secours neuf tiré : Léa (@lea)'])
    for (const code of [premier.corps.code, second]) assert.ok(!journal.includes(code))
  } finally {
    await banc.close()
  }
})

test('renommer : un prénom qui ne va pas change, et son accueil le lui dit une fois', async () => {
  const { banc, admin, lea, id } = await avecLea()
  try {
    const renomme = await faire(banc, admin, `/api/admin/profils/${id}/prenom`, { nom: 'Léa B.' })
    assert.equal(renomme.status, 200, renomme.corps.error)
    assert.equal((await fiche(banc, admin, id)).nom, 'Léa B.')
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/prenom`, { nom: 'Léa B.' })).corps.error, /déjà son prénom/)
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/prenom`, { nom: '   ' })).corps.error, /Il faut un prénom/)
    const accueil = (await lire<{ profile: ProfilDAccueil }>(banc, lea, '/api/joueur/moi?accueil')).corps.profile
    assert.equal(accueil.name, 'Léa B.')
    assert.deepEqual(
      accueil.annonces?.map(a => (a.sorte === 'prenom' ? [a.sorte, a.nom] : [a.sorte])),
      [['prenom', 'Léa B.']],
    )
    assert.deepEqual(await sesGestes(banc, admin, id), ['Profil renommé : « Léa » devient « Léa B. » (@lea)'])

    // Qu'elle le change elle-même, et l'annonce se tait : sur un autre
    // téléphone, elle lui aurait présenté son choix comme celui de l'administrateur.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { name: 'Léa Bertin' }, lea, 'PUT')).status, 200)
    const ensuite = (await lire<{ profile: ProfilDAccueil }>(banc, lea, '/api/joueur/moi?accueil')).corps.profile
    assert.equal(ensuite.name, 'Léa Bertin')
    assert.equal(ensuite.annonces, undefined)
  } finally {
    await banc.close()
  }
})

test('suspendre : plus de connexion — le bon mot de passe le dit —, plus personne ne le trouve ; réactivé, tout revient', async () => {
  const { banc, admin, lea, id } = await avecLea()
  try {
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const bobId = (await lire(banc, bob, '/api/joueur/moi')).corps.profile.id as string
    assert.ok((await lire<any[]>(banc, bob, '/api/duels/joueurs?q=lea')).corps.some(j => j.profileId === id), 'Bob la trouve, avant')

    const suspendu = await faire(banc, admin, `/api/admin/profils/${id}/suspendre`)
    assert.equal(suspendu.status, 200, suspendu.corps.error)
    // Sa session tombe ; le bon mot de passe le lui dit, un faux reste « incorrect ».
    assert.equal((await lire(banc, lea, '/api/joueur/moi')).corps.profile, null)
    const avecLeBon = await connexion(banc, 'lea', 'motdepasse1')
    assert.equal(avecLeBon.status, 403)
    assert.match(avecLeBon.corps.error, /suspendu/)
    assert.equal((await connexion(banc, 'lea', 'pas-le-bon-1')).status, 401)
    assert.ok(!(await lire<any[]>(banc, bob, '/api/duels/joueurs?q=lea')).corps.some(j => j.profileId === id), 'plus personne ne la trouve')

    // L'administrateur, lui, la trouve encore : c'est d'ici qu'on la réactive.
    const liste = (await lire<{ profils: ProfilDAdministration[] }>(banc, admin, '/api/admin/profils?q=lea')).corps.profils
    assert.deepEqual(liste.map(p => [p.login, p.suspendu]), [['lea', true]])
    const f = await fiche(banc, admin, id)
    assert.equal(f.suspendu, true)
    assert.equal(typeof f.suspenduLe, 'number')
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/suspendre`)).corps.error, /déjà suspendu/)
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/confettis`, { confettis: 10 })).corps.error, /Réactive/)
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/secours`)).corps.error, /Réactive/)

    assert.equal((await faire(banc, admin, `/api/admin/profils/${id}/reactiver`)).status, 200)
    assert.equal((await connexion(banc, 'lea', 'motdepasse1')).status, 200)
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/reactiver`)).corps.error, /pas suspendu/)
    assert.deepEqual(await sesGestes(banc, admin, id), ['Profil réactivé : Léa (@lea)', 'Profil suspendu : Léa (@lea)'])

    // Jamais pendant une soirée pas encore close qui le compte : sa clôture ne le trouverait plus.
    const salle = await invite(banc.url, 'Bob', '🐻', { cookie: bob })
    const refus = await faire(banc, admin, `/api/admin/profils/${bobId}/suspendre`)
    assert.equal(refus.status, 409)
    assert.match(refus.corps.error, /soirée pas encore close/)
    salle.socket.disconnect()
  } finally {
    await banc.close()
  }
})

test('sur son propre profil, l’administrateur s’offre des confettis, mais ne se renomme ni ne se suspend d’ici', async () => {
  const { banc, admin } = await avecLea()
  try {
    // L'administrateur tient son espace avec son profil à lui.
    const sien = await inscrireProfil(banc.url, 'antoine-joue', 'Antoine', '🦁')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, admin)).status, 200)
    const id = (await lire(banc, sien, '/api/joueur/moi')).corps.profile.id as string
    assert.equal((await fiche(banc, admin, id)).toi, true)
    // Ses confettis, il se les offre comme à n'importe qui (« je peux pas
    // m'octroyer des confettis », le propriétaire, le 14 octobre 2026 — le
    // QG le refusait) : son solde les compte, son accueil les annonce.
    const don = await faire(banc, admin, `/api/admin/profils/${id}/confettis`, { confettis: 10 })
    assert.equal(don.status, 200, don.corps.error)
    assert.deepEqual((await fiche(banc, admin, id)).confettis, { solde: 10, offerts: 10 })
    const accueil = (await lire<{ profile: ProfilDAccueil }>(banc, sien, '/api/joueur/moi?accueil')).corps.profile
    assert.equal(accueil.boutique?.confettis.solde, 10)
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/prenom`, { nom: 'Toto' })).corps.error, /depuis ton profil/)
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/suspendre`)).corps.error, /ton propre profil/)
    assert.deepEqual(await sesGestes(banc, admin, id), ['10 confettis offerts : Antoine (@antoine-joue)'], 'le don se note, un refus jamais')
  } finally {
    await banc.close()
  }
})

test('masqué des classements, la fiche le dit — et il s’y remet, suspendu compris', async () => {
  const { banc, admin, id } = await avecLea()
  try {
    assert.equal((await faire(banc, admin, '/api/admin/jour/masquer', { profileId: id, masque: true })).status, 200)
    assert.equal((await fiche(banc, admin, id)).masque, true)
    // Suspendu, il reste dans la liste des masqués, que la page du quiz du
    // jour et celle des duels montrent : « Remettre au classement » y
    // répondait « Profil introuvable », et le masque ne se levait plus.
    assert.equal((await faire(banc, admin, `/api/admin/profils/${id}/suspendre`)).status, 200)
    assert.deepEqual((await lire<{ id: string }[]>(banc, admin, '/api/admin/jour/profils?q=')).corps.map(p => p.id), [id])
    const remis = await faire(banc, admin, '/api/admin/jour/masquer', { profileId: id, masque: false })
    assert.equal(remis.status, 200, remis.corps.error)
    assert.equal((await fiche(banc, admin, id)).masque, false)
    assert.deepEqual((await lire<unknown[]>(banc, admin, '/api/admin/jour/profils?q=')).corps, [])
    assert.deepEqual(await sesGestes(banc, admin, id), [
      'Profil remis au classement du quiz du jour : Léa (@lea)',
      'Profil suspendu : Léa (@lea)',
      'Profil masqué du classement du quiz du jour : Léa (@lea)',
    ])
    // Un profil qui n'existe pas reste introuvable.
    assert.equal((await faire(banc, admin, '/api/admin/jour/masquer', { profileId: 'inconnu', masque: false })).status, 404)
  } finally {
    await banc.close()
  }
})

test('lever le verrou de connexion : cinq essais manqués la ferment, l’administrateur la rouvre', async () => {
  const { banc, admin, id } = await avecLea()
  try {
    assert.match((await faire(banc, admin, `/api/admin/profils/${id}/connexion`)).corps.error, /n’est pas fermée/)
    for (let i = 0; i < 5; i++) assert.equal((await connexion(banc, 'lea', 'pas-le-bon-1')).status, 401)
    assert.equal((await connexion(banc, 'lea', 'motdepasse1')).status, 429, 'fermée, même au bon mot de passe')
    const fermee = (await fiche(banc, admin, id)).connexion.fermeeJusquA
    assert.ok(fermee !== null && fermee > Date.now(), 'la fiche dit jusqu’à quand')

    assert.equal((await faire(banc, admin, `/api/admin/profils/${id}/connexion`)).status, 200)
    assert.equal((await fiche(banc, admin, id)).connexion.fermeeJusquA, null)
    assert.equal((await connexion(banc, 'lea', 'motdepasse1')).status, 200)
    assert.deepEqual(await sesGestes(banc, admin, id), ['Verrou de connexion levé : Léa (@lea)'])
  } finally {
    await banc.close()
  }
})

test('libérer l’épreuve de sentier qui l’attend : refermée sans lui coûter de vie, il en commence une autre', async () => {
  const { banc, admin, lea, id } = await avecLea()
  try {
    const epreuve = await faire(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 })
    assert.equal(epreuve.status, 200, epreuve.corps.error)
    const vies = (await lire(banc, lea, '/api/campagne/sentiers')).corps.vies
    const laissee = (await fiche(banc, admin, id)).epreuve
    assert.deepEqual([laissee?.palier, laissee?.vieEnJeu], [1, true])
    assert.equal(typeof laissee?.sentier, 'string')

    const liberee = await faire(banc, admin, `/api/admin/profils/${id}/epreuve`)
    assert.equal(liberee.status, 200, liberee.corps.error)
    const apres = (await lire(banc, lea, '/api/campagne/sentiers')).corps
    assert.equal(apres.epreuve, null, 'plus rien ne l’attend')
    // Abandonnée par lui, avec une vie en jeu, elle en aurait coûté une.
    assert.deepEqual([apres.vies.jour, apres.vies.reserve], [vies.jour, vies.reserve], 'aucune vie perdue')
    assert.equal((await fiche(banc, admin, id)).epreuve, null)
    assert.equal((await faire(banc, admin, `/api/admin/profils/${id}/epreuve`)).status, 404)
    // Il en recommence une, que l'épreuve laissée bloquait.
    assert.equal((await faire(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 })).status, 200)
    assert.deepEqual(await sesGestes(banc, admin, id), [`Épreuve de sentier libérée, sans coûter de vie : Léa (@lea) — ${laissee?.sentier}, palier 1`])
  } finally {
    await banc.close()
  }
})

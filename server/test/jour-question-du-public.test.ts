// Une question du public au quiz du jour (le choix du propriétaire du 2
// novembre 2026) : une par jour au plus, la plus anciennement acceptée
// d'abord ; signée de son auteur à la révélation — sauf masqué ou supprimé ;
// et pour lui, qui en connaît la réponse, elle ne se joue pas : elle se
// montre, et lui compte sa moyenne sur les autres, en points comme en bonnes
// réponses — jusque dans les recomptes d'une annulation. Sa relecture au QG :
// `jour-propositions.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { XP_MAX_DU_JOUR } from '../../shared/jour'
import { partDeLAuteur } from '../../shared/propositions'
import type { AnnonceDeLAdministrateur } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

/** Lundi 2 novembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 10, 2, 9, 0)
const JOUR = '2026-11-02'
const LENDEMAIN = '2026-11-03'

const CHENILLE = {
  texte: 'Quelle danse de fête fait-on en file, les mains sur les épaules de celui de devant ?',
  reponses: ['Le madison', 'La chenille', 'La farandole', 'La macarena'],
  bonne: 1,
  categorie: 'Autour de la fête',
  anecdote: 'Elle a même sa chanson, « La Chenille », un tube de la Bande à Basile.',
}
const NEPAL = { texte: 'Quel est le seul pays dont le drapeau n’est pas un rectangle ?', reponses: ['Le Bhoutan', 'Le Népal', 'La Suisse', 'Le Vatican'], bonne: 1, categorie: 'Géographie', anecdote: '' }

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Le tirage d'un jour, lu en base : les bonnes réponses, et l'auteur de chaque question du public. */
function tirage(banc: Banc, jour = JOUR): { bonne: number; reponses: string[]; texte: string; auteur?: string }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  } finally {
    db.close()
  }
}

/** Un profil, et l'identifiant que le serveur lui a donné. */
async function profil(banc: Banc, login: string, nom: string, avatar: string) {
  const cookie = await inscrireProfil(banc.url, login, nom, avatar)
  return { cookie, id: (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string }
}

/** Il propose sa question, l'administrateur l'accepte : elle attend son jour, signée. */
async function proposerEtAccepter(banc: Banc, auteur: string, admin: string, q: typeof CHENILLE) {
  const { categorie, anecdote, ...sienne } = q
  assert.equal((await poster(banc, auteur, '/api/jour/propositions', sienne)).status, 200)
  const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
  const id = page.aRelire.find((p: any) => p.texte === q.texte).id
  const ok = await poster(banc, admin, `/api/admin/jour/propositions/${id}/accepter`, { question: { ...sienne, categorie, anecdote } })
  assert.equal(ok.status, 200, ok.corps.error)
}

/**
 * Toute sa partie : chaque question montrée reçoit sa réponse — juste si
 * `juste(i)`, à la première seconde —, et sa propre question, montrée sans se
 * jouer, passe d'un « Question suivante ». Rend la vue finale et chaque
 * révélation, la sienne comprise.
 */
async function jouer(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc, etat.jour)
  const revelations: any[] = []
  for (let garde = 0; garde < 40 && etat.etat === 'en-cours'; garde++) {
    if (etat.question) {
      const i = etat.question.index
      const bonne = questions[i].bonne
      const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
      assert.equal(r.status, 200, r.corps.error)
      revelations.push(r.corps)
    } else if (etat.revelation?.tienne) {
      revelations.push(etat.revelation)
    }
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  if (etat.revelation?.tienne && !revelations.includes(etat.revelation)) revelations.push(etat.revelation)
  return { etat, revelations }
}

test('une question du public par jour, la plus anciennement acceptée d’abord — la suivante le lendemain', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    const chloe = await profil(banc, 'chloe', 'Chloé', '🐼')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    // Acceptée une minute plus tard : la file suit l'heure de l'acceptation (à la même milliseconde, l'ordre serait au hasard).
    horloge.t += 60_000
    await proposerEtAccepter(banc, chloe.cookie, admin, NEPAL)

    const bob = await profil(banc, 'bob', 'Bob', '🐻')
    assert.equal((await lire(banc, bob.cookie, '/api/jour')).corps.total, 10)
    const duJour = tirage(banc).filter(q => q.auteur)
    assert.deepEqual(
      duJour.map(q => [q.texte, q.auteur]),
      [[CHENILLE.texte, lea.id]],
      'une seule, celle de Léa, acceptée la première',
    )
    // Le lendemain, celle de Chloé.
    horloge.t += 24 * 3_600_000
    await lire(banc, bob.cookie, '/api/jour')
    assert.deepEqual(
      tirage(banc, LENDEMAIN).filter(q => q.auteur).map(q => q.auteur),
      [chloe.id],
    )
  }))

test('les autres la jouent comme une autre, signée de son auteur ; lui la voit sans la jouer, et elle lui compte sa moyenne', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const joueurs = await Promise.all(['bob', 'chloe', 'dan'].map((l, i) => profil(banc, l, l, ['🐻', '🐼', '🐸'][i])))

    // Trois joueurs : tout juste, à la première seconde.
    for (const j of joueurs) await jouer(banc, j.cookie, () => true)
    const questions = tirage(banc)
    const k = questions.findIndex(q => q.auteur === lea.id)
    assert.ok(k >= 0, 'sa question est au quiz du jour')

    // Pour les autres : signée, sans rien de plus que son visage.
    const correctionDeBob = (await lire(banc, joueurs[0].cookie, `/api/jour/correction/${JOUR}`)).corps
    assert.equal(correctionDeBob.questions[k].tienne, undefined)
    const bob = await jouer(banc, (await profil(banc, 'eve', 'Ève', '🦉')).cookie, () => true)
    const signee = bob.revelations.find(r => r.index === k)
    assert.deepEqual(signee.auteur, { nom: 'Léa', avatar: '🦊' })
    assert.equal(signee.tienne, undefined)
    assert.equal(JSON.stringify(signee).includes(lea.id), false, 'son identifiant ne part pas aux téléphones')

    // Léa : six justes sur ses neuf autres questions, chacune à 200.
    const autres = questions.map((_, i) => i).filter(i => i !== k)
    const sesJustes = new Set(autres.slice(0, 6))
    const { etat, revelations } = await jouer(banc, lea.cookie, i => sesJustes.has(i))
    const sienne = revelations.find(r => r.index === k)
    assert.equal(sienne.tienne, true, 'montrée, pas jouée')
    assert.deepEqual([sienne.choix, sienne.points, sienne.auteur], [null, 0, undefined])
    assert.equal(sienne.bonne, questions[k].bonne)
    assert.equal(sienne.trouveePar, 1, 'la salle l’a trouvée — lui n’y compte pas')
    assert.equal(revelations.length, 10)
    // Sa partie : 1 200 sur les neuf autres, et sa moyenne pour la sienne.
    assert.equal(etat.etat, 'finie')
    assert.equal(etat.points, 1200 + partDeLAuteur(1200, 9))
    assert.equal(etat.justes, 6 + partDeLAuteur(6, 9))
    assert.equal(etat.xp, Math.floor((XP_MAX_DU_JOUR * etat.points) / 2000))
    // Elle ne se rejoue pas : redemandée, elle rend sa révélation, sans un point.
    const rejouee = await poster(banc, lea.cookie, '/api/jour/repondre', { jour: JOUR, index: k, choix: questions[k].bonne })
    assert.deepEqual([rejouee.corps.tienne, rejouee.corps.points], [true, 0])
    // La correction le redit.
    const correction = (await lire(banc, lea.cookie, `/api/jour/correction/${JOUR}`)).corps.questions[k]
    assert.deepEqual([correction.tienne, correction.points, correction.repondue], [true, partDeLAuteur(1200, 9), false])
    // « Trouvée par » ne compte pas Léa : quatre réponses, quatre justes.
    const salle = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
    try {
      const n = salle.prepare('SELECT COUNT(*) AS n FROM jour_reponses WHERE jour = ? AND question = ?').get(JOUR, k) as { n: number }
      assert.equal(n.n, 4)
    } finally {
      salle.close()
    }
  }))

test('neuf sur neuf : le sans-faute et le maximum ; une annulation recompte sa moyenne, la sienne annulée la lui retire', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const { etat } = await jouer(banc, lea.cookie, () => true)
    assert.deepEqual([etat.points, etat.justes, etat.medaille, etat.xp], [2000, 10, 'or', XP_MAX_DU_JOUR])

    const questions = tirage(banc)
    const k = questions.findIndex(q => q.auteur === lea.id)
    const autre = k === 0 ? 1 : 0
    // Une autre question annulée : 1 600 sur huit, sa moyenne en vaut 200 — toujours le maximum de ce qui compte.
    assert.equal((await poster(banc, admin, '/api/admin/jour/annuler', { jour: JOUR, index: autre })).status, 200)
    let vue = (await lire(banc, lea.cookie, '/api/jour')).corps
    assert.deepEqual([vue.points, vue.justes, vue.pointsPossibles], [1800, 9, 1800])
    // La sienne annulée : elle ne compte plus pour personne, sa moyenne non plus.
    assert.equal((await poster(banc, admin, '/api/admin/jour/annuler', { jour: JOUR, index: k })).status, 200)
    vue = (await lire(banc, lea.cookie, '/api/jour')).corps
    assert.deepEqual([vue.points, vue.justes, vue.pointsPossibles], [1600, 8, 1600])
  }))

test('masqué des classements, il ne signe plus ; le lendemain, son accueil lui dit qu’elle a été jouée', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: lea.id, masque: true })).status, 200)
    const bob = await jouer(banc, (await profil(banc, 'bob', 'Bob', '🐻')).cookie, () => true)
    const k = tirage(banc).findIndex(q => q.auteur === lea.id)
    assert.equal(bob.revelations.find(r => r.index === k).auteur, undefined, 'un profil masqué ne se montre plus aux autres')

    horloge.t += 24 * 3_600_000
    const nouvelles = ((await lire(banc, lea.cookie, '/api/joueur/moi?accueil')).corps.profile.annonces ?? []).filter(
      (a: AnnonceDeLAdministrateur) => a.sorte === 'proposition',
    )
    assert.deepEqual(
      nouvelles.map((a: any) => a.issue),
      ['posee'],
      'jouée, elle le dit — l’acceptation d’avant ne se redit pas à côté',
    )
    assert.equal((await lire(banc, lea.cookie, '/api/jour/propositions')).corps[0].statut, 'posee')
  }))

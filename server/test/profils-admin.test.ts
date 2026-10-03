// « Les profils », à l'administration : les chercher, en supprimer un.
//
// Supprimer un profil emporte tout ce qui n'était qu'à lui — sa fiche, ses
// sessions, son expérience, son étagère, ses éclats, ses parties du quiz du
// jour et de la campagne — et son salon à lui (`creerEspaceDuProfil`), quand
// il en a ouvert un. Ce que ses soirées ont rapporté aux autres joueurs leur
// reste, et les archives où il a joué restent : elles le nomment pour
// toujours, alors le recalcul au démarrage ne le recrédite pas. Jamais le
// profil de l'administrateur, et jamais pendant qu'il joue une soirée pas
// encore close : sa clôture le créditerait sous un identifiant disparu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
} from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')
const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const supprimer = (banc: Banc, admin: string, id: string) =>
  ecrire(banc.url, `/api/admin/profils/${id}`, undefined, admin, 'DELETE').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Une soirée d'un quiz d'une question chez l'administrateur, que ces invités jouent — close, ou laissée ouverte. */
async function soiree(banc: Banc, admin: string, invites: { nom: string; avatar: string; cookie?: string }[], clore: boolean) {
  const quiz = await creerQuiz(banc.url, admin, [qcm('On y est ?')])
  const host = await ecranCommun(banc.url, admin)
  const joueurs = []
  for (const i of invites) joueurs.push(await invite(banc.url, i.nom, i.avatar, i.cookie ? { cookie: i.cookie } : undefined))
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quiz)
  await vue(sessionId, v => v.phase === 'question', 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  // Le premier juste, les autres faux : pas de réflexe partagé.
  for (const [i, j] of joueurs.entries()) await emitAck(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: i === 0 ? 0 : 1 } })
  await revelee
  ;(host as any).emit('host:endSession', { sessionId })
  if (clore) {
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await close).kind, 'info')
  }
  host.close()
  for (const j of joueurs) j.socket.close()
}

/** Toutes les lignes de la base permanente qui portent encore ce profil, table par table. */
function lignesDu(banc: Banc, profileId: string): Record<string, number> {
  const db = new Database(permanente(banc), { readonly: true })
  try {
    const restes: Record<string, number> = {}
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
    for (const { name } of tables) {
      const colonnes = (db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]).map(c => c.name)
      const cles = colonnes.filter(c => c === 'profile_id' || (name === 'profiles' && c === 'id'))
      for (const cle of cles) {
        const n = (db.prepare(`SELECT COUNT(*) AS n FROM ${name} WHERE ${cle} = ?`).get(profileId) as { n: number }).n
        if (n > 0) restes[`${name}.${cle}`] = n
      }
    }
    return restes
  } finally {
    db.close()
  }
}

test('l’administrateur cherche les profils : son niveau, ses soirées, son salon — et le sien marqué', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await ecrire(banc.url, '/api/joueur/espace', {}, bob)
    // L'administrateur tient son espace avec son profil à lui.
    await inscrireProfil(banc.url, 'antoine-joue', 'Antoine', '🦁')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, admin)).status, 200)

    const tout = (await lire(banc, admin, '/api/admin/profils')).corps
    assert.equal(tout.total, 3)
    const par = (login: string) => tout.profils.find((p: any) => p.login === login)
    assert.deepEqual(
      { ...par('lea'), id: undefined, vuLe: undefined },
      { id: undefined, login: 'lea', nom: 'Léa', avatar: '🦊', niveau: 1, soirees: 0, vuLe: undefined, salon: null, toi: false },
    )
    assert.deepEqual([par('bob').salon.propre, par('bob').salon.quiz, /^s-/.test(par('bob').salon.slug)], [true, 0, true], 'le salon de Bob, à lui')
    assert.deepEqual([par('antoine-joue').toi, par('antoine-joue').salon.propre], [true, false], 'l’espace de l’administrateur n’est pas un salon de profil')

    const cherche = (await lire(banc, admin, '/api/admin/profils?q=L%C3%A9')).corps
    assert.deepEqual(
      cherche.profils.map((p: any) => p.login),
      ['lea'],
      'un prénom, sans tenir compte de la casse',
    )
    assert.equal(cherche.total, 3, 'le total reste celui du serveur')
  } finally {
    await banc.close()
  }
})

test('supprimer un profil emporte tout ce qui n’était qu’à lui, son salon compris — et rien de ce qu’il a fait gagner aux autres', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string

    // Son salon, avec un quiz.
    const salon = (await (await ecrire(banc.url, '/api/joueur/espace', {}, lea)).json()) as { espace: { slug: string } }
    // Le quiz du jour, puis une série de campagne le lendemain.
    const jour = (await (await ecrire(banc.url, '/api/jour/commencer', {}, lea)).json()) as { jour: string }
    await ecrire(banc.url, '/api/jour/repondre', { jour: jour.jour, index: 0, choix: 0 }, lea)
    await ecrire(banc.url, '/api/jour/commencer', {}, bob)
    assert.ok((await lire(banc, bob, `/api/jour/classement?jour=${jour.jour}`)).corps.lignes.some((l: any) => l.nom === 'Léa'), 'Léa au classement, gardé en mémoire')
    horloge.t += 24 * 3_600_000
    const serie = (await (await ecrire(banc.url, '/api/campagne/serie', {}, lea)).json()) as { id: string }
    await ecrire(banc.url, `/api/campagne/serie/${serie.id}/reponse`, { index: 0, choix: 0 }, lea)
    // Une soirée close chez l'administrateur, avec Bob.
    await soiree(banc, admin, [{ nom: 'Léa', avatar: '', cookie: lea }, { nom: 'Bob', avatar: '', cookie: bob }], true)
    const bobAvant = (await lire(banc, bob, '/api/joueur/moi')).corps.profile
    assert.ok(Object.keys(lignesDu(banc, leaId)).length >= 5, 'Léa a laissé des traces un peu partout')

    const fait = await supprimer(banc, admin, leaId)
    assert.equal(fait.status, 200, JSON.stringify(fait.corps))
    assert.equal(fait.corps.salon, 'supprime')

    // Plus une ligne à son nom, dans aucune table — une table de plus serait relue ici.
    assert.deepEqual(lignesDu(banc, leaId), {})
    const db = new Database(permanente(banc), { readonly: true })
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM campagne_reponses WHERE serie_id = ?').get(serie.id) as { n: number }).n, 0, 'ses réponses de campagne')
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE slug = ?').get(salon.espace.slug) as { n: number }).n, 0, 'son salon')
    const archives = (db.prepare(`SELECT COUNT(*) AS n FROM soirees`).get() as { n: number }).n
    db.close()
    assert.equal(archives, 1, 'la soirée où elle a joué reste dans l’historique')
    assert.equal((await fetch(`${banc.url}/${salon.espace.slug}`)).status, 404, 'l’adresse de son salon ne mène plus nulle part')

    // Ses téléphones ne la connaissent plus, et son identifiant se reprend.
    assert.equal((await lire(banc, lea, '/api/joueur/moi')).corps.profile, null)
    const neuve = await inscrireProfil(banc.url, 'lea', 'Léa', '🐱')
    assert.equal((await lire(banc, neuve, '/api/joueur/moi')).corps.profile.xp, 0, 'une autre personne, partie de zéro')

    // Bob garde tout : son expérience, sa soirée — et le classement du jour la perd.
    const bobApres = (await lire(banc, bob, '/api/joueur/moi')).corps.profile
    assert.deepEqual([bobApres.xp, bobApres.soirees.length], [bobAvant.xp, bobAvant.soirees.length])
    assert.ok(!(await lire(banc, bob, `/api/jour/classement?jour=${jour.jour}`)).corps.lignes.some((l: any) => l.nom === 'Léa'), 'le classement gardé s’est relu')
    assert.equal((await supprimer(banc, admin, leaId)).status, 404, 'introuvable, une fois parti')
  } finally {
    await banc.close()
  }
})

test('ni le profil de l’administrateur, ni un profil qui joue une soirée pas encore close', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const sien = await inscrireProfil(banc.url, 'antoine-joue', 'Antoine', '🦁')
    await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, admin)
    const sienId = (await lire(banc, sien, '/api/joueur/moi')).corps.profile.id
    const refus = await supprimer(banc, admin, sienId)
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /ton propre profil/)

    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id
    await soiree(banc, admin, [{ nom: 'Léa', avatar: '', cookie: lea }, { nom: 'Bob', avatar: '🐻' }], false)
    const enJeu = await supprimer(banc, admin, leaId)
    assert.equal(enJeu.status, 409)
    assert.match(enJeu.corps.error, /Léa joue une soirée pas encore close chez Antoine/)
    assert.ok(Object.keys(lignesDu(banc, leaId)).length > 0, 'rien n’est parti')

    // Une fois la soirée close, la porte s'ouvre.
    const host = await ecranCommun(banc.url, admin)
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    await close
    host.close()
    assert.equal((await supprimer(banc, admin, leaId)).status, 200)
    assert.equal((await supprimer(banc, admin, 'inconnu')).status, 404)
  } finally {
    await banc.close()
  }
})

test('un compte d’animateur qu’il tenait reste, détaché ; et le recalcul ne recrédite pas un profil supprimé', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    // Nadia, un compte d'animateur à mot de passe, que le profil de Léa tient.
    const cree = (await (await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' }, admin)).json()) as {
      account: { id: string }
      activation: { token: string }
    }
    assert.equal((await ecrire(banc.url, '/api/auth/activate', { token: cree.activation.token, password: 'nadia-pass-1' })).status, 200)
    const nadia = await connexionAnimateur(banc.url, 'nadia', 'nadia-pass-1')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'lea', password: 'motdepasse1' }, nadia)).status, 200)
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id
    // Une soirée close chez l'administrateur : une archive qui la nomme.
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await soiree(banc, admin, [{ nom: 'Léa', avatar: '', cookie: lea }, { nom: 'Bob', avatar: '', cookie: bob }], true)

    const fait = await supprimer(banc, admin, leaId)
    assert.equal(fait.corps.salon, 'detache')
    const reste = (await lire(banc, admin, '/api/admin/accounts')).corps.find((a: any) => a.login === 'nadia')
    assert.ok(reste, 'le compte de Nadia reste')
    assert.equal((await lire(banc, nadia, '/api/auth/me')).status, 200, 'sa console, ouverte par son mot de passe, tient')

    // Le barème monte : toutes les soirées se relisent — l'archive nomme Léa.
    const db = new Database(permanente(banc))
    db.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', ${VERSION_BAREME - 1})`).run()
    db.close()
    await banc.redemarrer()
    assert.deepEqual(lignesDu(banc, leaId), {}, 'pas une ligne, pas un prix, pas un palier sous son nom')
  } finally {
    await banc.close()
  }
})

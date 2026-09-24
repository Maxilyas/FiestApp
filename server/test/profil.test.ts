// Le profil, fil d'une soirée à l'autre : ce que la page `/profil` relit.
//
// La tablée du 24 septembre y a trouvé trois trous, tous côté serveur :
//
// · une même soirée, deux chiffres d'expérience — la fin annonçait +24,
//   paliers de carrière compris, et « Mes soirées » en listait 4 : rien ne
//   disait lesquels des 24 étaient des paliers ;
// · « Mes soirées » ne montrait que la date : ni le titre que l'animateur
//   avait donné, ni de quoi ouvrir SON bilan, qui redemandait « Qui es-tu ? » ;
// · « Rejoindre une soirée » ignorait celle où l'on jouait déjà : Sofia,
//   inscrite chez Nadia, retombait sur « Quelle soirée ? ».
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
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
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { ArchiveStore } from '../src/core/archive'
import { XP_PALIER } from '../../shared/hautsfaits'

// L'Éclat est un tirage : chaque test dit ce qu'il en attend.
ProfileStore.tirageEclat = () => false

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Un quiz d'une question : Alice trouve, la salle se trompe. */
async function jouer(host: Socket, quizId: string, alice: Invite, salle: Invite[]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question', 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const [qui, choice] of [[alice, 0], ...salle.map(i => [i, 1])] as [Invite, number][]) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
    assert.equal(ack.ok, true, `réponse refusée : ${ack.error}`)
  }
  await revelee
  const fin = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await fin
  ;(host as any).emit('host:endSession', { sessionId })
}

async function clore(host: Socket, title: string) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', { title })
  assert.equal((await toast).kind, 'info')
}

/** Attend que la soirée en cours se soit rangée d'elle-même. */
async function rangee(banc: Banc): Promise<string> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    if (current?.id) return current.id
    if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger toute seule après son quiz')
  }
}

const moi = async (banc: Banc, cookie: string) =>
  (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(permanente(banc))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

test('la fin de soirée dit à part l’expérience des paliers : la ligne de « Mes soirées » est la même que celle de la fin', () =>
  avecBanc(async banc => {
    const tirage = ProfileStore.tirageEclat
    // Le premier Éclat fait tomber un palier de carrière : c'est le plus
    // court chemin vers une fin de soirée qui en annonce un.
    ProfileStore.tirageEclat = () => true
    try {
      const cookie = await connexionAnimateur(banc.url)
      const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
      const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      const host = await ecranCommun(banc.url, cookie)
      const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
      const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙')]
      await jouer(host, quiz, alice, salle)
      await rangee(banc)

      const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin d’Alice', 15_000)
      await clore(host, 'Chez les tests')
      const gain = (await fin).profil
      assert.ok(gain.paliers.length > 0, 'un palier est tombé ce soir')
      assert.equal(gain.xpPaliers, gain.paliers.length * XP_PALIER[0], 'la fin dit ce que les paliers ont rapporté')

      const { profile } = await moi(banc, aliceCookie)
      assert.equal(profile.soirees.length, 1)
      assert.equal(
        profile.soirees[0].xp,
        gain.xp - gain.xpPaliers,
        '« Mes soirées » et la fin disent le même chiffre pour la soirée',
      )
      assert.equal(profile.xp, gain.xp, 'et le total du profil, paliers compris, reste celui de la fin')
    } finally {
      ProfileStore.tirageEclat = tirage
    }
  }))

test('« Mes soirées » dit le titre de chaque soirée et qui l’on y était — de quoi ouvrir son bilan sans « Qui es-tu ? »', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙')]
    await jouer(host, quiz, alice, salle)
    const soiree = await rangee(banc)

    // Retenu au crédit, lu en base AVANT toute visite : la page `/profil`
    // rattrape dans l'archive une ligne sans joueur, et masquerait un crédit
    // qui l'aurait oublié.
    const auCredit = () =>
      enBase(banc, db => db.prepare('SELECT joueur_id FROM profile_xp WHERE soiree_id = ?').get(soiree)) as
        | { joueur_id: string | null }
        | undefined
    for (const limite = Date.now() + 8000; !auCredit(); await patienter(100)) {
      if (Date.now() > limite) assert.fail('le quiz aurait dû créditer Alice')
    }
    assert.equal(auCredit()?.joueur_id, alice.playerId, 'le crédit retient le joueur qu’Alice était')

    // Encore en cours : la ligne existe déjà, sous le titre du jour.
    let ligne = (await moi(banc, aliceCookie)).profile.soirees[0]
    assert.equal(ligne.soireeId, soiree)
    assert.equal(ligne.joueurId, alice.playerId, 'le joueur qu’Alice était ce soir-là')
    assert.match(ligne.titre, /^Soirée du /)

    await clore(host, 'Chez les tests')
    ligne = (await moi(banc, aliceCookie)).profile.soirees[0]
    assert.equal(ligne.titre, 'Chez les tests', 'le titre donné à la clôture')
    assert.equal(ligne.joueurId, alice.playerId)

    // L'animateur la renomme dans son historique : la ligne suit — un titre
    // recopié au crédit aurait gardé l'ancien pour toujours.
    const renommee = await ecrire(banc.url, `/api/soirees/${soiree}`, { title: 'La grande soirée' }, cookie, 'PUT')
    assert.equal(renommee.status, 200)
    assert.equal((await moi(banc, aliceCookie)).profile.soirees[0].titre, 'La grande soirée')

    // Une ligne créditée avant qu'on retienne le joueur : elle le retrouve
    // dans l'archive, où le rattachement au profil a survécu, et le garde.
    enBase(banc, db => db.prepare('UPDATE profile_xp SET joueur_id = NULL').run())
    ligne = (await moi(banc, aliceCookie)).profile.soirees[0]
    assert.equal(ligne.joueurId, alice.playerId, 'relu dans l’archive')
    const retenu = enBase(banc, db =>
      db.prepare('SELECT joueur_id FROM profile_xp WHERE soiree_id = ?').get(soiree),
    ) as { joueur_id: string | null }
    assert.equal(retenu.joueur_id, alice.playerId, 'et retenu : on ne relit pas l’archive à chaque visite')
  }))

test('`/profil` connaît la soirée où l’on joue en ce moment — et elle seule', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bobCookie = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')

    assert.deepEqual((await moi(banc, aliceCookie)).enCours, [], 'personne ne l’attend nulle part')

    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const encours = (await moi(banc, aliceCookie)).enCours
    assert.deepEqual(
      encours.map((e: any) => e.slug),
      [ADMIN.slug],
      'Alice est inscrite chez l’administrateur du banc',
    )
    assert.equal(encours[0].nom, ADMIN.name)
    assert.deepEqual((await moi(banc, bobCookie)).enCours, [], 'Bob, lui, n’y est pas')

    // Laissée ouverte depuis la veille, sans un signe de vie : elle ne
    // l'attend plus — « Revenir chez » menait à une salle vide.
    const vieillir = (ms: number) => {
      const db = new Database(banc.dbPath)
      try {
        db.prepare('UPDATE players SET created_at = created_at - ?').run(ms)
        db.prepare('UPDATE sessions SET updated_at = updated_at - ?').run(ms)
      } finally {
        db.close()
      }
    }
    vieillir(13 * 3600_000)
    assert.deepEqual((await moi(banc, aliceCookie)).enCours, [], 'treize heures sans rien : plus en cours')
    vieillir(-13 * 3600_000)
    assert.equal((await moi(banc, aliceCookie)).enCours.length, 1)

    // Close, la soirée ne l'attend plus.
    const salle = [await invite(banc.url, 'Dora', '🐙'), await invite(banc.url, 'Eve', '🐝')]
    await jouer(host, quiz, alice, salle)
    await rangee(banc)
    await clore(host, 'Chez les tests')
    assert.deepEqual((await moi(banc, aliceCookie)).enCours, [])
  }))

/** Une soirée close où Alice a joué, et sa ligne remise comme avant la colonne `joueur_id`. */
async function ligneDAvant(banc: Banc) {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
  const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
  const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙')]
  await jouer(host, quiz, alice, salle)
  const soiree = await rangee(banc)
  await clore(host, 'Chez les tests')
  enBase(banc, db => db.prepare('UPDATE profile_xp SET joueur_id = NULL').run())
  const retenu = () =>
    (enBase(banc, db => db.prepare('SELECT joueur_id FROM profile_xp WHERE soiree_id = ?').get(soiree)) as { joueur_id: string | null })
      .joueur_id
  return { aliceCookie, alice, soiree, retenu }
}

test('le rattrapage de « Mon bilan » : une panne passagère ne retient rien, et ne fait pas tomber la page', () =>
  avecBanc(async banc => {
    const { aliceCookie, alice, soiree, retenu } = await ligneDAvant(banc)
    const lire = (cookie: string) => fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })

    // L'archive ne répond pas, une fois : la page s'affiche sans le lien,
    // et rien n'est retenu — « personne » retenu sur une seconde de panne,
    // c'était « Mon bilan » perdu pour toujours.
    const joueurDuProfil = ArchiveStore.prototype.joueurDuProfil
    ArchiveStore.prototype.joueurDuProfil = async () => {
      throw new Error('base muette')
    }
    try {
      const res = await lire(aliceCookie)
      assert.equal(res.status, 200, 'la page se lit malgré la panne')
      const { profile } = (await res.json()) as any
      assert.equal(profile.soirees[0].joueurId, null)
      assert.equal(retenu(), null, 'rien de retenu sur une panne')
    } finally {
      ArchiveStore.prototype.joueurDuProfil = joueurDuProfil
    }

    // L'écriture refusée (quota, coupure) : la page se lit encore, avec le
    // lien de ce soir — elle répondait 500, et l'accueil proposait
    // « Retrouver mon profil » à quelqu'un de connecté.
    enBase(banc, db =>
      db.exec(`CREATE TRIGGER refus BEFORE UPDATE OF joueur_id ON profile_xp BEGIN SELECT RAISE(ABORT, 'quota'); END`),
    )
    const res = await lire(aliceCookie)
    assert.equal(res.status, 200, 'une écriture refusée ne fait pas tomber la page')
    assert.equal(((await res.json()) as any).profile.soirees[0].joueurId, alice.playerId, 'le lien de ce soir, relu')
    assert.equal(retenu(), null)
    enBase(banc, db => db.exec('DROP TRIGGER refus'))

    // La panne passée, la visite suivante relit et retient.
    assert.equal((await moi(banc, aliceCookie)).profile.soirees[0].joueurId, alice.playerId)
    assert.equal(retenu(), alice.playerId, `retenu pour ${soiree}`)
  }))

test('l’archive d’une soirée : le joueur d’un profil, rien sans rattachement, et une base muette qui lève', () =>
  avecBanc(async banc => {
    const { aliceCookie, alice, soiree, retenu } = await ligneDAvant(banc)
    const espace = (enBase(banc, db => db.prepare('SELECT space_id FROM soirees WHERE id = ?').get(soiree)) as any).space_id
    const profilId = (enBase(banc, db => db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice')) as any).id
    const archives = new ArchiveStore(banc.quizDbUrl)
    try {
      assert.equal(await archives.joueurDuProfil(espace, soiree, profilId), alice.playerId)
      assert.equal(await archives.joueurDuProfil(espace, soiree, 'inconnu'), null)
      assert.equal(await archives.joueurDuProfil('ailleurs', soiree, profilId), null, 'l’espace d’un autre : introuvable')

      // La base ne répond pas : l'erreur remonte, pour qu'on relise plus
      // tard. Avalée, elle se lisait « l'archive ne le nomme pas ».
      const client = (archives as any).client
      const execute = client.execute.bind(client)
      client.execute = async () => {
        throw new Error('base muette')
      }
      await assert.rejects(archives.joueurDuProfil(espace, soiree, profilId), /base muette/)
      client.execute = execute
      assert.equal(await archives.joueurDuProfil(espace, soiree, profilId), alice.playerId, 'relue la fois suivante')

      // Rangée avant les profils : personne n'y porte de `profileId`.
      enBase(banc, db => {
        const { data } = db.prepare('SELECT data FROM soirees WHERE id = ?').get(soiree) as any
        const archive = JSON.parse(data)
        for (const p of archive.players) delete p.profileId
        db.prepare('UPDATE soirees SET data = ? WHERE id = ?').run(JSON.stringify(archive), soiree)
      })
      assert.equal(await archives.joueurDuProfil(espace, soiree, profilId), null)
    } finally {
      archives.close()
    }

    // Lue, et muette sur ce profil : la ligne retient « personne » — on ne
    // relira pas l'archive à chaque visite — et n'ouvre aucun bilan.
    assert.equal((await moi(banc, aliceCookie)).profile.soirees[0].joueurId, null)
    assert.equal(retenu(), '')
  }))

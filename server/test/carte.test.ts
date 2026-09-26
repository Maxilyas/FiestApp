// La carte d'un joueur : ce qu'on voit en touchant son nom.
//
// Les avatars, les finitions et les badges ne se voyaient que de leur
// porteur : personne ne pouvait regarder le profil de quelqu'un d'autre. La
// carte les montre à la salle, à côté de ce que l'invité fait ce soir — et
// seulement dans l'espace où il joue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecrire,
  ecranCommun,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
} from './banc'

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const carte = (banc: Banc, id: string, slug = ADMIN.slug) => fetch(`${banc.url}/s/${slug}/joueurs/${id}.json`)

/** Écrit dans la base permanente (le fichier `file:` qui tient le rôle de Turso). */
function ecrireEnBase(banc: Banc, fn: (db: Database.Database) => void) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    fn(db)
  } finally {
    db.close()
  }
}

test('la carte d’un invité dit sa soirée ; celle d’un profil, son niveau et ce qu’il a gagné — sous son surnom', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const dora = await invite(banc.url, 'Dora', '🐙')

    // Une question : Alice trouve, les autres non.
    const sessionId = await lancerQuiz(host, quiz)
    await attendre(alice.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
    const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
    for (const [qui, choice] of [
      [alice, 0],
      [bob, 1],
      [dora, 1],
    ] as [Invite, number][]) {
      assert.equal((await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })).ok, true)
    }
    await revelee
    // Le podium crédite la soirée au profil d'Alice.
    const creditee = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du podium', 15_000)
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    await creditee

    // Bob est anonyme : sa soirée, et rien qui dise ce qui lui manque.
    const deBob = (await (await carte(banc, bob.playerId)).json()) as any
    assert.equal(deBob.nom, 'Bob')
    assert.deepEqual(deBob.ceSoir, {
      points: 0,
      rang: 0,
      joueurs: 3,
      reponses: 1,
      qcm: 1,
      justes: 0,
      estimations: 0,
      coupDOeil: null,
    })
    assert.equal(deBob.profil, undefined)
    assert.equal(deBob.niveau, undefined, 'ni niveau, ni pastille : l’absence, pas l’infériorité')

    // L'animateur donne un surnom à Alice pour la soirée : il ne touche pas
    // à son profil, et la carte dit les deux.
    ;(host as any).emit('host:renamePlayer', { playerId: alice.playerId, name: 'La Renarde' })
    await instantane<any>(host, s => s.players.some((p: any) => p.name === 'La Renarde'), 'le surnom')
    const dAlice = (await (await carte(banc, alice.playerId)).json()) as any
    assert.equal(dAlice.nom, 'La Renarde')
    assert.equal(dAlice.ceSoir.rang, 1)
    assert.equal(dAlice.ceSoir.justes, 1)
    assert.equal(dAlice.profil?.prenom, 'Alice', 'le profil garde son prénom')
    assert.equal(typeof dAlice.profil?.niveau, 'number')
    assert.deepEqual(dAlice.profil?.legendaires, [])
    assert.equal(dAlice.profil?.fiche.soirees, 1, 'la soirée en cours compte déjà dans sa fiche')
    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: aliceCookie } })).json()) as any
    assert.equal(moi.profile.name, 'Alice', 'le surnom du soir ne renomme pas le profil')
  }))

test('une carte ne se lit que dans l’espace où l’invité joue', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    // Un second espace, et son invitée.
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'marc', name: 'Marc', slug: 'chez-marc' }, cookie)
    assert.equal(cree.status, 201)
    const marcel = await invite(banc.url, 'Marcel', '🐢', { slug: 'chez-marc' })
    await invite(banc.url, 'Alice', '🦊')
    await patienter(100)

    assert.equal((await carte(banc, marcel.playerId, 'chez-marc')).status, 200)
    assert.equal((await carte(banc, marcel.playerId)).status, 404, 'l’invité du voisin vaut « introuvable »')
    assert.equal((await carte(banc, 'personne')).status, 404)
  }))

// La carte montrait « ses récompenses les plus rares », six : sous dix
// profils, la rareté se tait, et c'étaient les prix les plus souvent gagnés
// — six fois L'Éclair, que la salle voit remettre à chaque soirée.

test('la carte montre ses trois plus beaux hauts faits, et le nombre de ses prix — pas six fois L’Éclair', () =>
  avecBanc(async banc => {
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Son étagère, écrite en base : une ligne par récompense et par soirée.
    ecrireEnBase(banc, db => {
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const profil = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      const ranger = db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      const etagere: [string, string, string, number][] = [
        ['eclair', '⚡', 'L’Éclair', 6],
        ['sauveur', '🦸', 'Le Sauveur', 1],
        ['hf:foudre', '⚡', 'La Foudre', 3],
        ['hf:increvable', '🛡️', 'L’Increvable', 2],
        ['hf:grand-chelem', '🎯', 'Grand Chelem', 1],
        ['hf:zero-pointe', '🥚', 'Le Zéro Pointé', 1],
        ['hf:bavard:1', '💬', 'Le Bavard · Bronze', 1],
        ['hf:bavard:2', '💬', 'Le Bavard · Argent', 1],
      ]
      for (const [badge, emoji, title, fois] of etagere) {
        for (let i = 0; i < fois; i++) ranger.run(profil, badge, `soiree-${i}`, espace, emoji, title, 1000 + i)
      }
    })
    // Le serveur relit l'étagère d'un profil quand il le charge : au démarrage suivant.
    await banc.redemarrer()
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })

    const p = ((await (await carte(banc, alice.playerId)).json()) as any).profil
    // Le Grand Chelem, que peu décrochent, avant L'Increvable et La Foudre ;
    // Le Bavard à son plus haut palier seulement ; ni l'ombre, ni les prix.
    assert.deepEqual(
      p.vitrine.map((b: any) => b.key),
      ['hf:grand-chelem', 'hf:increvable', 'hf:bavard:2'],
    )
    assert.equal(p.vitrine[1].fois, 2, 'le nombre de fois part avec lui')
    assert.deepEqual(p.prix, { eus: 2, total: 20 }, 'deux prix différents sur vingt — L’Éclair compte une fois')
    assert.equal(p.hautsFaits, 5, 'un palier compte pour son haut fait')
  }))

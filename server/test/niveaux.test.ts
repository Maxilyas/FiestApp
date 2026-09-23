// Les niveaux se méritent — et personne n'en redescend.
//
// Sur des soirées de deux quiz de cinquante questions, la courbe à 25 faisait
// passer le joueur médian niveau 5 dès son premier soir et niveau 10 à son
// sixième : toutes les finitions filaient en une dizaine de soirées. La
// courbe passe de 25 à 60 (`XP_PAR_PALIER`, mesuré par
// `server/scripts/calibrage.ts`).
// Mais un profil garde le niveau qu'il avait atteint, tant que l'ancienne
// courbe le lui donne encore. Chaque test échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecranCommun, inscrireProfil, instantane, invite, type Banc } from './banc'
import { finitionsOuvertes, niveauDuProfil, niveauPour, progression, xpDuNiveau } from '../../shared/profil'

// ── 1. La courbe ──────────────────────────────────────────────────────────

test('la courbe se mérite : 60 × (n − 1)² — le niveau 2 le premier soir, le 10 après des mois', () => {
  assert.equal(niveauPour(59), 1)
  assert.equal(niveauPour(60), 2, 'une première soirée y suffit')
  assert.equal(niveauPour(391), 3, 'la soirée d’un joueur médian, deux quiz de cinquante questions : il était niveau 4')
  assert.equal(xpDuNiveau(10), 4860)
  assert.equal(niveauPour(2500), 7, 'il était niveau 11')
})

test('un niveau gardé tient tant que la courbe d’alors le donne encore', () => {
  const gardes = [{ pas: 25, niveau: 11 }]
  assert.equal(niveauDuProfil(2500, gardes), 11, 'rien ne redescend')
  assert.equal(niveauDuProfil(2500, []), 7)
  // La courbe du jour finit par le rattraper, puis le dépasse.
  assert.equal(niveauDuProfil(xpDuNiveau(12), gardes), 12)
  // Une soirée retirée de l'historique emporte son expérience : le niveau
  // gardé redescend avec elle, comme il l'aurait fait sur l'ancienne courbe.
  assert.equal(niveauDuProfil(1600, gardes), 9)
  assert.equal(niveauDuProfil(100, gardes), 3)
  // Et il ne monte jamais au-dessus de ce qu'il avait : au-delà, c'est la courbe du jour.
  assert.equal(niveauDuProfil(100_000, gardes), niveauPour(100_000))
})

test('sur un niveau gardé, la barre compte depuis zéro et se remplit pile au niveau suivant', () => {
  const gardes = [{ pas: 25, niveau: 11 }]
  assert.deepEqual(progression(2500, gardes), { niveau: 11, acquis: 2500, requis: xpDuNiveau(12) })
  // Juste avant le niveau 12, la barre est presque pleine ; au niveau 12, elle repart comme d'habitude.
  const presque = progression(xpDuNiveau(12) - 1, gardes)
  assert.equal(presque.niveau, 11)
  assert.equal(presque.requis - presque.acquis, 1)
  assert.deepEqual(progression(xpDuNiveau(12), gardes), { niveau: 12, acquis: 0, requis: xpDuNiveau(13) - xpDuNiveau(12) })
  // Sans niveau gardé, rien ne change.
  assert.deepEqual(progression(2500), { niveau: 7, acquis: 2500 - xpDuNiveau(7), requis: xpDuNiveau(8) - xpDuNiveau(7) })
})

// ── 2. Sur un vrai serveur ────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

/** Écrit l'expérience d'un profil dans la base permanente, derrière le dos du serveur — qu'on redémarre ensuite. */
function poserXp(banc: Banc, login: string, xp: number, avantLeDurcissement: boolean) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    db.prepare('UPDATE profiles SET xp = ? WHERE login = ?').run(xp, login)
    // On remonte le temps : la base est celle d'avant la nouvelle courbe.
    if (avantLeDurcissement) {
      db.prepare(`DELETE FROM meta WHERE key = 'courbe_durcie'`).run()
      db.prepare('DELETE FROM profile_niveaux').run()
    }
  } finally {
    db.close()
  }
}

test('un niveau atteint avant le durcissement reste à son porteur — partout, et à lui seul', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    poserXp(banc, 'alice', 2500, true)
    await banc.redemarrer()

    const profil = await moi(banc, alice)
    assert.equal(profil.niveau, 11, 'le niveau 11 de l’ancienne courbe, pas le 7 de la nouvelle')
    assert.ok(profil.ouvertes.includes('holo'), 'et la finition du niveau 10 avec lui')
    assert.deepEqual(finitionsOuvertes(11), profil.ouvertes)
    assert.equal(profil.acquis, 2500, 'la barre compte depuis zéro…')
    assert.equal(profil.requis, xpDuNiveau(12), '…jusqu’au niveau 12 de la nouvelle courbe')

    // La salle le voit aussi : le mur ne lit pas un autre niveau que sa page.
    const cookie = await connexionAnimateur(banc.url)
    const host = await ecranCommun(banc.url, cookie)
    const joueuse = await invite(banc.url, 'Alice', '🦊', { cookie: alice })
    const snap = await instantane<any>(host, s => s.players.some((p: any) => p.id === joueuse.playerId), 'Alice dans la salle')
    assert.equal(snap.players.find((p: any) => p.id === joueuse.playerId)?.niveau, 11)
    joueuse.socket.close()
    host.close()

    // Bob atteint la même expérience après : la nouvelle courbe vaut pour lui,
    // et un redémarrage ne lui rend pas l'ancienne.
    poserXp(banc, 'bob', 2500, false)
    await banc.redemarrer()
    assert.equal((await moi(banc, bob)).niveau, 7)
    assert.equal((await moi(banc, alice)).niveau, 11, 'Alice garde toujours le sien')
  }))

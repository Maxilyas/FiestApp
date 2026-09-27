// La ligne d'expérience des paliers (`#paliers`) se relit puis se réécrit en
// deux allers-retours, hors transaction et sans verrou commun
// (`ProfileStore.ecrireXpDesPaliers`). Deux chemins qui décernent un palier
// au même profil — la clôture d'une soirée (`accorderPaliers`) et le quiz du
// jour (`accorderPaliersDuJour` : fin de partie, nuit, recompte d'une
// annulation) — peuvent s'y croiser : le plus lent réécrit une somme
// périmée, et l'expérience d'un palier disparaît du total.
//
// La course est forcée ici : l'écriture du quiz du jour est tenue entre sa
// lecture et son écriture, le temps que la clôture passe. En production, la
// fenêtre est un aller-retour vers Turso.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/paliers-course.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { gainVide, releveVide } from '../../../shared/profil'
import { XP_PALIER } from '../../../shared/hautsfaits'

test('un palier de soirée et un palier du jour décernés au même instant : aucun des deux ne perd son expérience', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'paliers-course-'))
  const fichier = path.join(dir, 'permanente.db')
  const store = new ProfileStore(`file:${fichier}`)
  try {
    await store.init()
    const { profile } = await store.register({ login: 'alice', password: 'motdepasse1', name: 'Alice', avatar: '🦊' })
    const id = profile.id
    // Trois soirées closes qui comptent (répondu à deux) : L'Habitué · Bronze est dû.
    for (const n of [1, 2, 3]) {
      await store.creditSoiree({
        profileId: id,
        soireeId: `2026-09-2${n}-soiree`,
        spaceId: 'espace',
        gain: { ...gainVide(), reponses: 1 },
        releve: { ...releveVide(), questions: 1, reponses: 1 },
        xp: 1,
      })
    }

    // L'écriture de la ligne des paliers par le quiz du jour est tenue
    // APRÈS sa lecture — exactement la fenêtre entre les deux `await` de
    // `ecrireXpDesPaliers`.
    const client = (store as any).client
    const execute = client.execute.bind(client)
    let relacher!: () => void
    const tenue = new Promise<void>(r => (relacher = r))
    let signaler!: () => void
    const arrivee = new Promise<void>(r => (signaler = r))
    let premiere = true
    client.execute = async (stmt: any) => {
      if (premiere && typeof stmt === 'object' && /INSERT INTO profile_xp/.test(stmt.sql) && stmt.args?.[1] === '#paliers') {
        premiere = false
        signaler()
        await tenue
      }
      return execute(stmt)
    }

    // Septième jour de quiz du jour : L'Assidu · Bronze (10).
    const duJour = store.accorderPaliersDuJour(id, '2026-09-26', { joues: 7, victoires: 0, sansFautes: 0 })
    await arrivee
    // Pendant ce temps, la soirée se clôt : L'Habitué · Bronze (10).
    assert.deepEqual(await store.accorderPaliers(id, '2026-09-23-soiree', 'espace'), ['hf:habitue:1'])
    relacher()
    assert.deepEqual(await duJour, ['hf:assidu:1'])

    const db = new Database(fichier, { readonly: true })
    try {
      const paliers = db.prepare(`SELECT badge FROM profile_badges WHERE profile_id = ? ORDER BY badge`).all(id)
      assert.deepEqual(paliers, [{ badge: 'hf:assidu:1' }, { badge: 'hf:habitue:1' }], 'les deux paliers sont rangés')
      const ligne = db.prepare(`SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#paliers'`).get(id) as { xp: number }
      const total = db.prepare('SELECT xp FROM profiles WHERE id = ?').get(id) as { xp: number }
      assert.equal(ligne.xp, 2 * XP_PALIER[0], `la ligne des paliers paie les deux paliers (vu : ${ligne.xp})`)
      assert.equal(total.xp, 3 + 2 * XP_PALIER[0], `le total compte les deux paliers (vu : ${total.xp})`)
    } finally {
      db.close()
    }
  } finally {
    store.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

// Même absence de verrou, deux clôtures : le palier que deux soirées closes
// au même instant atteignent ensemble se range sous les DEUX, et chacune le
// fête comme neuf. `espaces.test.ts` (« deux soirées closes au même
// instant… ») passe parce que la base locale répond assez vite pour que la
// seconde lise l'étagère déjà relue ; ici, l'écriture de la première est
// tenue le temps que la seconde décide.
test('deux clôtures simultanées : le palier qu’elles atteignent ensemble tombe une fois', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'paliers-course-'))
  const fichier = path.join(dir, 'permanente.db')
  const store = new ProfileStore(`file:${fichier}`)
  try {
    await store.init()
    const { profile } = await store.register({ login: 'remi', password: 'motdepasse1', name: 'Rémi', avatar: '🐧' })
    const id = profile.id
    for (const [n, espace] of [[1, 'A'], [2, 'A'], [3, 'B']] as const) {
      await store.creditSoiree({
        profileId: id,
        soireeId: `2026-09-2${n}-soiree-${espace}`,
        spaceId: espace,
        gain: { ...gainVide(), reponses: 1 },
        releve: { ...releveVide(), questions: 1, reponses: 1 },
        xp: 1,
      })
    }
    const client = (store as any).client
    const batch = client.batch.bind(client)
    let relacher!: () => void
    const tenue = new Promise<void>(r => (relacher = r))
    let signaler!: () => void
    const arrivee = new Promise<void>(r => (signaler = r))
    let premiere = true
    client.batch = async (stmts: any[], mode?: string) => {
      const range = stmts.some(s => typeof s === 'object' && /INSERT INTO profile_badges/.test(s.sql) && s.args?.[1] === 'hf:habitue:1')
      if (premiere && range) {
        premiere = false
        signaler()
        await tenue
      }
      return batch(stmts, mode)
    }
    // A (la deuxième soirée) clôt : son rangement de L'Habitué est tenu…
    const chezA = store.accorderPaliers(id, '2026-09-22-soiree-A', 'A')
    await arrivee
    // … pendant que B clôt la sienne, au même instant.
    const chezB = await store.accorderPaliers(id, '2026-09-23-soiree-B', 'B')
    relacher()
    const annonces = { A: await chezA, B: chezB }

    const db = new Database(fichier, { readonly: true })
    try {
      // Trois soirées chez deux hôtes : L'Habitué · Bronze et Le Globe-trotteur · Bronze.
      const rangs = db
        .prepare(`SELECT badge, COUNT(*) AS n FROM profile_badges WHERE profile_id = ? GROUP BY badge ORDER BY badge`)
        .all(id) as { badge: string; n: number }[]
      assert.deepEqual(
        { rangs, annonces: [...annonces.A, ...annonces.B].sort() },
        {
          rangs: [
            { badge: 'hf:globe-trotteur:1', n: 1 },
            { badge: 'hf:habitue:1', n: 1 },
          ],
          annonces: ['hf:globe-trotteur:1', 'hf:habitue:1'],
        },
        'chaque palier se range une fois, et ne s’annonce qu’à une des deux fins de soirée',
      )
    } finally {
      db.close()
    }
  } finally {
    store.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

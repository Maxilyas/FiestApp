// Contre-expertise de recompenses-comptes-3 : la course de `#paliers` et le
// palier rangé deux fois se produisent-ils avec des temps de Turso
// ordinaires, sans qu'on tienne une écriture à la main ?
//
// Chaque requête du client libsql attend un aller (u) avant de s'exécuter et
// un retour (d) avant de rendre, u + d ≈ 20 ms, partagés au hasard — des
// réponses qui peuvent arriver dans le désordre, comme sur HTTP. Les deux
// décernements partent à quelques millisecondes d'écart (au hasard dans
// 0-60 ms). On compte, sur N essais, combien perdent l'expérience d'un
// palier (a) ou rangent un palier deux fois (b).
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/verification/recompenses/paliers-latence.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import { gainVide, releveVide } from '../../../../shared/profil'
import { XP_PALIER } from '../../../../shared/hautsfaits'

const ESSAIS = Number(process.env.ESSAIS ?? 40)
// GIGUE=18 : un aller-retour entre 2 et 38 ms — Turso un soir de charge.
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Un client lent : aller et retour tirés au hasard, 20 ms à eux deux (± 8). */
function ralentir(store: ProfileStore, rtt = 20, gigue = Number(process.env.GIGUE ?? 8)) {
  const client = (store as any).client
  const execute = client.execute.bind(client)
  const batch = client.batch.bind(client)
  const trajet = async <T>(f: () => Promise<T>) => {
    const total = rtt + (Math.random() * 2 - 1) * gigue
    const aller = Math.random() * total
    await attendre(aller)
    const r = await f()
    await attendre(total - aller)
    return r
  }
  client.execute = (stmt: any) => trajet(() => execute(stmt))
  client.batch = (stmts: any, mode?: any) => trajet(() => batch(stmts, mode))
}

async function nouveau(dir: string, n: number) {
  const fichier = path.join(dir, `p${n}.db`)
  const store = new ProfileStore(`file:${fichier}`)
  await store.init()
  const { profile } = await store.register({ login: `p${n}`, password: 'motdepasse1', name: 'P', avatar: '🦊' })
  return { store, fichier, id: profile.id }
}

async function soiree(store: ProfileStore, id: string, soireeId: string, spaceId: string) {
  await store.creditSoiree({
    profileId: id,
    soireeId,
    spaceId,
    gain: { ...gainVide(), reponses: 1 },
    releve: { ...releveVide(), questions: 1, reponses: 1 },
    xp: 1,
  })
}

test(`(a) un palier du jour et un palier de soirée au même instant, ${ESSAIS} essais à 20 ms`, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'paliers-latence-'))
  let pertes = 0
  try {
    for (let n = 0; n < ESSAIS; n++) {
      const { store, fichier, id } = await nouveau(dir, n)
      for (const k of [1, 2, 3]) await soiree(store, id, `2026-09-2${k}-soiree`, 'espace')
      ralentir(store)
      const decalage = Math.random() * 60
      await Promise.all([
        store.accorderPaliersDuJour(id, '2026-09-26', { joues: 7, victoires: 0, sansFautes: 0 }),
        attendre(decalage).then(() => store.accorderPaliers(id, '2026-09-23-soiree', 'espace')),
      ])
      store.close()
      const db = new Database(fichier, { readonly: true })
      const ligne = db.prepare(`SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#paliers'`).get(id) as { xp: number }
      db.close()
      if (ligne.xp !== 2 * XP_PALIER[0]) pertes++
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(`[mesure] (a) ${pertes} perte(s) sur ${ESSAIS} essais`)
  assert.equal(pertes, 0, `${pertes} essais sur ${ESSAIS} perdent l’expérience d’un palier`)
})

test(`(b) deux clôtures du même profil dans deux espaces, ${ESSAIS} essais à 20 ms`, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'paliers-latence-'))
  let doubles = 0
  try {
    for (let n = 0; n < ESSAIS; n++) {
      const { store, fichier, id } = await nouveau(dir, n)
      for (const [k, e] of [[1, 'A'], [2, 'A'], [3, 'B']] as const) await soiree(store, id, `2026-09-2${k}-soiree-${e}`, e)
      ralentir(store)
      const decalage = Math.random() * 60
      await Promise.all([
        store.accorderPaliers(id, '2026-09-22-soiree-A', 'A'),
        attendre(decalage).then(() => store.accorderPaliers(id, '2026-09-23-soiree-B', 'B')),
      ])
      store.close()
      const db = new Database(fichier, { readonly: true })
      const n2 = db.prepare(`SELECT COUNT(*) AS n FROM profile_badges WHERE profile_id = ? AND badge = 'hf:habitue:1'`).get(id) as { n: number }
      db.close()
      if (n2.n > 1) doubles++
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(`[mesure] (b) ${doubles} palier(s) rangé(s) deux fois sur ${ESSAIS} essais`)
  assert.equal(doubles, 0, `${doubles} essais sur ${ESSAIS} rangent L’Habitué deux fois`)
})

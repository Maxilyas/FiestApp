// Les allers-retours de chaque route, vague par vague, sur le fichier `file:`
// qui tient lieu de Turso — le compteur des tests (`duels-attente.test.ts`,
// `profil-charge.test.ts`) : un aller-retour dure au moins un tour de boucle,
// ce qui part ensemble est en vol ensemble, et le rang d'un appel dit combien
// il en a attendu. Un profil neuf, chaque route lue deux fois, puis comptée.
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/allers-par-route.ts
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { demarrer, inscrireProfil } from '../../../server/test/banc.ts'

const compte = { actif: false, finis: 0, sqls: [] as string[] }
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    const rang = compte.finis + 1
    if (compte.actif) await new Promise<void>(r => setImmediate(r))
    const res = await origine.apply(this, args)
    if (compte.actif) {
      compte.finis = Math.max(compte.finis, rang)
      const instructions = (methode === 'batch' ? args[0] : [args[0]]) as (string | { sql: string })[]
      const sqls = instructions.map(s => (typeof s === 'string' ? s : s.sql).replace(/\s+/g, ' ').trim().slice(0, 90))
      compte.sqls.push(`${rang}. ${methode === 'batch' ? `[lot de ${sqls.length}] ` : ''}${sqls.join(' ‖ ')}`)
    }
    return res
  }
}

const banc = await demarrer({ prechauffageCampagneMs: 3_600_000 })
const cookie = await inscrireProfil(banc.url, 'lea', 'Léa')
const lire = (chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(r => r.json())
for (const route of ['/api/joueur/moi', '/api/joueur/moi?accueil', '/api/joueur/nouveautes', '/api/joueur/missions', '/api/duels']) {
  await lire(route)
  await lire(route)
  Object.assign(compte, { actif: true, finis: 0, sqls: [] })
  await lire(route)
  compte.actif = false
  console.log(`\n${route} — ${compte.sqls.length} allers-retours, ${compte.finis} en série`)
  for (const s of compte.sqls.sort((a, b) => parseInt(a) - parseInt(b))) console.log(`  ${s}`)
}
await banc.close()
process.exit(0)

// Le serveur du banc solo (`solo-charge.mjs`), dans son propre processus : le
// générateur le met au dixième de cœur (cgroup), et ses joueurs restent dehors.
// La base permanente est derrière le faux Turso que le générateur a lancé
// (`BASE_URL`). Compilé comme le paquet de production d'abord :
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-11-03/reproductions/solo-serveur.ts ../export/banc/solo-serveur.mjs
import { demarrer } from '../../../server/test/banc.ts'

const banc = await demarrer({ quizDbUrl: process.env.BASE_URL!, cabinet: true, expeditionRemplacee: true, prechauffageCampagneMs: 500 })
console.log(`PRET ${banc.url}`)
process.on('SIGTERM', () => {
  banc.close().finally(() => process.exit(0))
})

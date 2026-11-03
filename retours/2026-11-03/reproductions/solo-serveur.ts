// Le serveur du banc solo (`solo-charge.mjs`), dans son propre processus : le
// générateur le met au dixième de cœur (cgroup), et ses joueurs restent dehors.
// La base permanente est derrière le faux Turso que le générateur a lancé
// (`BASE_URL`). Compilé comme le paquet de production d'abord :
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-11-03/reproductions/solo-serveur.ts ../export/banc/solo-serveur.mjs
import { writeFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { demarrer } from '../../../server/test/banc.ts'
import { choisirLeTransport } from '../../../server/src/core/distante.ts'

// Le transport de la production (`/healthz` : `base.connexions.transport`, le 3 novembre 2026), sauf `TRANSPORT=fetch`.
choisirLeTransport(process.env.TRANSPORT === 'fetch' ? 'fetch' : 'leger')
const banc = await demarrer({ quizDbUrl: process.env.BASE_URL!, cabinet: true, expeditionRemplacee: true, prechauffageCampagneMs: 500 })
console.log(`PRET ${banc.url}`)

// Un profil pris à la demande (`solo-charge.mjs --profil`) : SIGUSR2 le commence, le suivant l'écrit dans
// PROFIL_FICHIER — `--cpu-prof` aurait mêlé le démarrage et le préchauffage à la charge qu'on mesure.
let session: Session | null = null
process.on('SIGUSR2', async () => {
  if (!session) {
    session = new Session()
    session.connect()
    await session.post('Profiler.enable')
    await session.post('Profiler.setSamplingInterval', { interval: 500 })
    await session.post('Profiler.start')
    console.log('PROFIL commencé')
    return
  }
  const { profile } = await session.post('Profiler.stop')
  writeFileSync(process.env.PROFIL_FICHIER!, JSON.stringify(profile))
  session.disconnect()
  session = null
  console.log('PROFIL écrit')
})
process.on('SIGTERM', () => {
  banc.close().finally(() => process.exit(0))
})

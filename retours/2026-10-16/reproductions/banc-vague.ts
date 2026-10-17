// L'accueil d'un téléphone, à chaud : les six requêtes qu'il lance de front
// (`moi?accueil`, la pastille de « Profil », les missions, le quiz du jour,
// les duels, la campagne), pour un joueur puis pour quatre à la fois — le
// processeur du processus et les allers-retours vers la base, la médiane de
// sept vagues. Sur la base que `banc-gel.ts` a laissée ; chaque joueur a déjà
// ouvert son accueil une fois — sa première visite du jour tire ses missions
// et retient ce qu'il a vu, ce qui ne se refait pas.
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/banc-vague.ts
//   cd server && GEL=1 node --import tsx ../retours/2026-10-16/reproductions/banc-vague.ts   (au dixième de cœur, comme banc-gel.ts)
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { fauxTurso, attendre, DONNEES } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, ecrire, cookieDe } from '../../../server/test/banc.ts'

const GEL = process.env.GEL === '1'
const fichier = path.join(DONNEES, 'permanente-gel.db')
const faux = await fauxTurso(fichier, { neuf: false })
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 500, rappels: { intervalleMs: 3_600_000 } })
if (GEL) {
  // Le serveur au dixième de cœur ; le faux Turso reste dehors, à 30 ms l'aller-retour.
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  writeFileSync('/sys/fs/cgroup/cpu/cgroup.procs', String(faux.enfant.pid))
  await faux.latence(30)
}
// Le préchauffage de la campagne passé : la base lue, les cotes, la mesure, le modèle.
await attendre(GEL ? 90_000 : 15_000)

const joueurs: string[] = []
for (const k of [0, 2, 5, 9]) {
  const res = await ecrire(banc.url, '/api/joueur/connexion', { login: `joueur${k}`, password: 'motdepasse1' })
  joueurs.push(cookieDe(res, 'qz_joueur'))
}
const VAGUE = ['/api/joueur/moi?accueil', '/api/joueur/nouveautes', '/api/joueur/missions', '/api/jour', '/api/duels', '/api/campagne']
const lire = async (cookie: string, chemin: string) => (await (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })).text()).length
const vague = (cookies: readonly string[]) => Promise.all(cookies.flatMap(c => VAGUE.map(r => lire(c, r))))

// Chaque joueur a ouvert son accueil : ses missions tirées, sa loge retenue, son profil en mémoire.
for (let i = 0; i < 2; i++) await vague(joueurs)

const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]
for (const n of [1, 4]) {
  const cpu: number[] = []
  const mur: number[] = []
  const gels: number[] = []
  const allers: number[] = []
  for (let essai = 0; essai < 7; essai++) {
    await attendre(GEL ? 3_000 : 300)
    await faux.remise()
    // Le plus long gel de la boucle pendant la vague : ce que toute la salle attend.
    const boucle = monitorEventLoopDelay({ resolution: 5 })
    boucle.enable()
    const c = process.cpuUsage()
    const t = performance.now()
    await vague(joueurs.slice(0, n))
    mur.push(performance.now() - t)
    const u = process.cpuUsage(c)
    boucle.disable()
    cpu.push((u.user + u.system) / 1000)
    gels.push(Math.max(0, boucle.max / 1e6 - 5))
    allers.push((await faux.releve()).allers.length)
  }
  console.log(
    `l’accueil de ${n} joueur${n > 1 ? 's' : ''} : ${Math.round(mediane(cpu))} ms de processeur, ${mediane(allers)} allers-retours, ` +
      `${Math.round(mediane(mur))} ms, la boucle gelée ${Math.round(mediane(gels))} ms au plus (médianes de sept vagues)`,
  )
}
await banc.close()
faux.fermer()
process.exit(0)

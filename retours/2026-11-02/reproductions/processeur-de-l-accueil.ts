// Le processeur et les allers-retours de l'accueil d'un profil, au transport
// léger de la production (`QUIZ_DB_TRANSPORT=leger`) : chaque route seule, puis
// l'accueil entier — la console, l'en-tête et les missions de front, puis la
// pastille des nouveautés —, puis quatre accueils de front ; `N` fois chacun,
// `PASSAGES` passages (trois), la médiane gardée — `SEULEMENT=accueil` : les
// deux derniers seuls. Le client du banc vit dans le même processus : son
// `fetch` compte avec le serveur. Sur la base que le banc du gel a laissée
// (`../../2026-10-16/reproductions/banc-gel.ts`, à lancer d'abord). La machine
// du banc est partagée : avant et après se comparent en séries entrelacées,
// l'ancien code dans un autre arbre (`git worktree add`, `DONNEES` vers la
// même base).
//
//   cd server && N=100 node --import tsx ../retours/2026-11-02/reproductions/processeur-de-l-accueil.ts
import path from 'node:path'
import { fauxTurso, attendre, DONNEES } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, ecrire, cookieDe } from '../../../server/test/banc.ts'
import { choisirLeTransport } from '../../../server/src/core/distante.ts'

choisirLeTransport('leger')
const fichier = path.join(DONNEES, 'permanente-gel.db')
const faux = await fauxTurso(fichier, { neuf: false })
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 500, rappels: { intervalleMs: 3_600_000 }, fraicheurDesDuelsMs: 30_000 })
await attendre(15_000)
const cookies: string[] = []
for (const k of [0, 2, 5, 9]) cookies.push(cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: `joueur${k}`, password: 'motdepasse1' }), 'qz_joueur'))
const lire = async (cookie: string, chemin: string) => (await (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })).text()).length
const accueil = async (c: string) => {
  await Promise.all(['/api/auth/me', '/api/joueur/moi?accueil', '/api/joueur/missions'].map(r => lire(c, r)))
  await lire(c, '/api/joueur/nouveautes')
}
for (const c of cookies) for (let i = 0; i < 3; i++) await accueil(c)

const N = Number(process.env.N ?? 40)
const PASSAGES = Number(process.env.PASSAGES ?? 3)
const mesurer = async (nom: string, f: (c: string) => Promise<unknown>) => {
  const passages: number[] = []
  let allers = 0
  for (let p = 0; p < PASSAGES; p++) {
    await faux.remise()
    const avant = process.cpuUsage()
    for (let i = 0; i < N; i++) await f(cookies[i % cookies.length])
    const d = process.cpuUsage(avant)
    passages.push((d.user + d.system) / 1000 / N)
    allers = (await faux.releve()).allers.length / N
    await attendre(200)
  }
  passages.sort((a, b) => a - b)
  const mediane = passages[Math.floor(passages.length / 2)]
  console.log(`${nom.padEnd(34)} ${mediane.toFixed(1).padStart(6)} ms de processeur (passages : ${passages.map(x => x.toFixed(1)).join(' · ')}) · ${allers.toFixed(1)} allers-retours`)
}
if (process.env.SEULEMENT !== 'accueil') {
  await mesurer('GET /api/joueur/moi?accueil', c => lire(c, '/api/joueur/moi?accueil'))
  await mesurer('GET /api/joueur/missions', c => lire(c, '/api/joueur/missions'))
  await mesurer('GET /api/joueur/nouveautes', c => lire(c, '/api/joueur/nouveautes'))
}
await mesurer('l’accueil entier', accueil)
await mesurer('quatre accueils de front', () => Promise.all(cookies.map(accueil)))
await banc.close()
faux.fermer()
process.exit(0)

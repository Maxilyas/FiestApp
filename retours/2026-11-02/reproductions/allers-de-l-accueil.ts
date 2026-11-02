// Les allers-retours de l'accueil d'un profil, un par un : chaque route seule —
// ses vagues, et les instructions de chaque aller-retour —, puis l'accueil tel
// que la page le lance : la console, l'en-tête et les missions de front, la
// pastille des nouveautés une fois montré. Sur la base que le banc du gel a
// laissée (`../../2026-10-16/reproductions/banc-gel.ts`, à lancer d'abord), à la
// fraîcheur des duels de la production — le banc les relit à chaque lecture.
//
//   cd server && node --import tsx ../retours/2026-11-02/reproductions/allers-de-l-accueil.ts
//   JOUEUR=joueur5 DETAIL=0 …   (un autre joueur ; les comptes seuls)
import path from 'node:path'
import { fauxTurso, attendre, DONNEES, vagues } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, ecrire, cookieDe } from '../../../server/test/banc.ts'

const fichier = path.join(DONNEES, 'permanente-gel.db')
const faux = await fauxTurso(fichier, { neuf: false })
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 500, rappels: { intervalleMs: 3_600_000 }, fraicheurDesDuelsMs: 30_000 })
await attendre(15_000)
const login = process.env.JOUEUR ?? 'joueur0'
const cookie = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login, password: 'motdepasse1' }), 'qz_joueur')
const lire = async (chemin: string) => (await (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })).text()).length
const ROUTES = ['/api/auth/me', '/api/joueur/moi?accueil', '/api/joueur/missions', '/api/joueur/nouveautes']
for (let i = 0; i < 2; i++) for (const r of ROUTES) await lire(r)

await faux.remise()
for (const r of ROUTES) {
  await faux.etiquette(r)
  await lire(r)
  await attendre(300)
}
await faux.etiquette('accueil')
await Promise.all(ROUTES.slice(0, 3).map(lire))
await lire('/api/joueur/nouveautes')
await attendre(300)
await faux.etiquette('(fin)')
const { allers } = await faux.releve()
const court = (s: string) => s.replace(/\s+/g, ' ').slice(0, Number(process.env.LARGEUR ?? 140))
for (const r of [...ROUTES, 'accueil']) {
  const a = allers.filter(x => x.etiquette === r)
  const v = vagues(a)
  console.log(`\n${r} — ${a.length} allers-retours, ${v.length} vagues, ${a.reduce((s, x) => s + x.instructions, 0)} instructions`)
  if (process.env.DETAIL !== '0')
    v.forEach((vague, i) => {
      for (const x of vague) console.log(`  v${i + 1} ${String(x.instructions).padStart(2)} instr. ${String(Math.round(x.octets / 1024)).padStart(4)} Ko · ${x.sqls.map(court).join('\n                          · ')}`)
    })
}
await banc.close()
faux.fermer()
process.exit(0)

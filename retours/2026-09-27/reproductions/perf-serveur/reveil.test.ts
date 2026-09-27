// Le matin, au réveil de l'hébergeur : la veille (500 joueurs) n'est pas
// close, et dix profils ouvrent le quiz du jour en même temps que cinq autres
// ouvrent l'accueil. Qui attend la nuit, et combien de temps, à 50 ms
// l'aller-retour ? Mesure — rien n'échoue.
//   cd server && nice -n 10 node --import tsx --test --test-timeout=300000 ../export/evaluations/perf-serveur/reveil.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { compteur } from './compteur'
import { peupler } from './peupler'
import { ADMIN, demarrer } from '../../../server/test/banc'

const MATIN = Date.UTC(2026, 8, 27, 5, 0)
/** La latence simulée de Turso : 50 ms par défaut, `RTT=80` pour le haut de la fourchette. */
const RTT = Number(process.env.RTT ?? 50)
/** Les joueurs de la veille : 500 par défaut. */
const HIER = Number(process.env.HIER ?? 500)

test('au réveil, la nuit d’hier fait attendre tout le monde', async () => {
  const horloge = { t: MATIN }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const fichier = banc.quizDbUrl.replace(/^file:/, '')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const pop = peupler(fichier, { spaceId, aujourdhui: '2026-09-27', profils: Math.max(500, HIER), hier: HIER })
    await banc.redemarrer()
    const charge = execSync('uptime').toString().trim()
    compteur.rtt = RTT
    compteur.appels = []
    const t0 = performance.now()
    const demande = async (chemin: string, id: string) => {
      const debut = performance.now() - t0
      const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: pop.cookie(id) } })
      await r.json()
      return { chemin, depart: Math.round(debut), duree: Math.round(performance.now() - t0 - debut), status: r.status }
    }
    const toutes = await Promise.all([
      ...pop.ids.slice(0, 10).map((id, k) => new Promise(res => setTimeout(res, k * 200)).then(() => demande('/api/jour', id))),
      ...pop.ids.slice(10, 15).map((id, k) => new Promise(res => setTimeout(res, 100 + k * 400)).then(() => demande('/api/joueur/moi', id))),
    ])
    compteur.rtt = 0
    const sortie = { charge, rtt: RTT, hier: HIER, allersRetours: compteur.appels.length, demandes: toutes }
    console.log(JSON.stringify(sortie, null, 1))
    writeFileSync(new URL(`./mesures-reveil-${RTT}ms-${HIER}.json`, import.meta.url), JSON.stringify(sortie, null, 1))
  } finally {
    compteur.rtt = 0
    await banc.close()
  }
})

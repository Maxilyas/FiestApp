// Contre-expertise de perf-serveur-1 à 3 : les mêmes chemins, à l'échelle
// d'un serveur d'amis. L'expert mesure 500 joueurs la veille (200 par jour
// avant) à 50 et 80 ms ; ici, 30, 100 et 500 joueurs, à 25 ms (Render
// Francfort vers une base Turso « en Europe », MISE-EN-LIGNE.md:48 et :70 ;
// distante.ts:15 : « Turso répond en quelques dizaines de millisecondes »).
// Ses outils (`compteur.ts`, `peupler.ts`), réutilisés tels quels : les
// allers-retours sont des comptes, la durée une estimation (latence fixe).
// Mesure : rien n'échoue.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=300000 \
//     ../export/evaluations/verification/mesures/echelle.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { mesurer } from '../../perf-serveur/compteur'
import { peupler } from '../../perf-serveur/peupler'
import { ADMIN, demarrer } from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Dimanche 27 septembre 2026, 7 h à Paris : la veille n'est pas close. */
const MATIN = Date.UTC(2026, 8, 27, 5, 0)
const RTT = 25
const lignes: Record<string, unknown>[] = []

/** `N=30` : une seule taille, et le détail par appelant du matin. */
const TAILLES = process.env.N ? [Number(process.env.N)] : [30, 100, 500]
for (const n of TAILLES) {
  test(`${n} joueurs la veille, ${n} par jour avant : le matin, puis la journée`, async () => {
    const horloge = { t: MATIN }
    const banc = await demarrer({ horlogeDuJour: () => horloge.t })
    try {
      const fichier = banc.quizDbUrl.replace(/^file:/, '')
      const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const pop = peupler(fichier, { spaceId, aujourdhui: '2026-09-27', profils: n, hier: n, parJour: n, joueursDuSoir: n })
      await banc.redemarrer()
      const lire = (chemin: string, id: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: pop.cookie(id) } }).then(r => r.json())
      // 1. Le matin, serveur froid : la première visite clôt la veille.
      const matin = (await mesurer('1re visite du jour', () => lire('/api/jour', pop.ids[0]), RTT)).mesure
      // 2. Réveil en journée : la veille est close, la mémoire est vide.
      await banc.redemarrer()
      const reveil = (await mesurer('réveil, rien à clore', () => lire('/api/jour', pop.ids[1]), RTT)).mesure
      // 3. L'accueil d'un profil qui joue tous les jours (l'assidue), serveur chaud.
      await lire('/api/joueur/moi', pop.ids[0])
      const accueil = (await mesurer('GET /api/joueur/moi', () => lire('/api/joueur/moi', pop.ids[0]), RTT)).mesure
      if (process.env.N) console.log(JSON.stringify(Object.entries(matin.parAppelant).sort((a, b) => b[1] - a[1])))
      for (const m of [matin, reveil, accueil]) {
        const l = { joueurs: n, quoi: m.quoi, allersRetours: m.appels, enSerie: m.enSerie, ms: m.ms, lignes: m.lignes }
        lignes.push(l)
        console.log(JSON.stringify(l))
      }
    } finally {
      await banc.close()
    }
  })
}

test('écrire les mesures', { skip: !!process.env.N }, () => {
  const charge = execSync('uptime').toString().trim()
  writeFileSync(new URL('./echelle.json', import.meta.url), JSON.stringify({ charge, rtt: RTT, lignes }, null, 1))
})

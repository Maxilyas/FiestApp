// Ce que la mémoire garde des profils et du quiz du jour, et ce que coûte la
// décoration d'un invité à profil dans chaque instantané (`apparenceDe`,
// laurier compris). Le serveur du banc tourne dans ce processus : le tas
// mesuré est le sien. À lancer avec --expose-gc :
//   nice -n 10 node --expose-gc --import tsx --test --test-timeout=600000 ../export/evaluations/perf-serveur/memoire.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { peupler } from './peupler'
import { ADMIN, demarrer } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { JourStore } from '../../../server/src/core/jour'

const MATIN = Date.UTC(2026, 8, 27, 5, 0)
const gc = () => {
  for (let i = 0; i < 3; i++) (globalThis as any).gc?.()
}
const tas = () => {
  gc()
  return process.memoryUsage().heapUsed
}

test('la mémoire des profils, et la décoration d’un instantané', async () => {
  const sortie: Record<string, unknown> = { charge: execSync('uptime').toString().trim() }
  const horloge = { t: MATIN }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const fichier = banc.quizDbUrl.replace(/^file:/, '')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const pop = peupler(fichier, { spaceId, aujourdhui: '2026-09-27' })
    await banc.redemarrer()
    const cookie = pop.cookie(pop.ids[0])
    const avant = tas()
    // Le classement du mois charge les 500 profils en mémoire.
    await fetch(`${banc.url}/api/jour/classement?mois=2026-09`, { headers: { Cookie: cookie } }).then(r => r.json())
    const apres = tas()
    sortie.profilsEnMemoire = { profils: 500, koParProfil: +((apres - avant) / 500 / 1024).toFixed(2), moEnTout: +((apres - avant) / 1048576).toFixed(2) }
    // Relire ne fait pas grandir : tout est déjà là.
    for (let k = 0; k < 5; k++) await fetch(`${banc.url}/api/jour/classement?mois=2026-09`, { headers: { Cookie: cookie } }).then(r => r.json())
    sortie.apresCinqRelectures = { moDePlus: +((tas() - apres) / 1048576).toFixed(2) }
  } finally {
    await banc.close()
  }

  // La décoration : un ProfileStore et un JourStore seuls, sur une base peuplée,
  // pour chronométrer `apparenceDe` — ce que chaque instantané fait pour chaque
  // invité à profil (`Party.toPublic` → `badgeOf`).
  const banc2 = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const fichier = banc2.quizDbUrl.replace(/^file:/, '')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const pop = peupler(fichier, { spaceId, aujourdhui: '2026-09-27' })
    const profiles = new ProfileStore(banc2.quizDbUrl)
    await profiles.init()
    const jour = new JourStore(banc2.quizDbUrl, undefined, { profiles, maintenant: () => horloge.t })
    await jour.init()
    const recs = []
    for (const id of pop.ids.slice(0, 300)) recs.push((await profiles.byId(id))!)
    const chrono = (quoi: string) => {
      const durees: number[] = []
      for (let tour = 0; tour < 30; tour++) {
        const t0 = performance.now()
        for (const p of recs) profiles.apparenceDe(p)
        durees.push(performance.now() - t0)
      }
      durees.sort((a, b) => a - b)
      return { quoi, mediane: +durees[15].toFixed(2), p90: +durees[27].toFixed(2) }
    }
    const sans = chrono('300 invités à profil, sans laurier branché')
    profiles.laurierDe = id => jour.laureats().has(id)
    // Les lauriers lus une fois : `laureats()` rend alors la liste en mémoire.
    jour.laureats()
    await new Promise(r => setTimeout(r, 300))
    const avec = chrono('300 invités à profil, laurier branché (jour de Paris relu à chaque appel)')
    sortie.decoration = { sans, avec, parInstantane: 'deux constructions par diffusion (écrans et téléphones)' }
    jour.close()
    profiles.close()
  } finally {
    await banc2.close()
  }
  sortie.chargeFin = execSync('uptime').toString().trim()
  console.log(JSON.stringify(sortie, null, 1))
  writeFileSync(new URL('./mesures-memoire.json', import.meta.url), JSON.stringify(sortie, null, 1))
})

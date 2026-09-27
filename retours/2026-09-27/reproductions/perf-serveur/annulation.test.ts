// « Annuler la question pour tous » un soir où 500 profils ont joué : combien
// d'allers-retours, et combien de temps la page d'administration attend, à
// 50 ms l'aller-retour. Le client abandonne à vingt secondes
// (`DELAI_REQUETE_MS`, client/src/api.ts). Mesure — rien n'échoue.
//   cd server && nice -n 10 node --import tsx --test --test-timeout=300000 ../export/evaluations/perf-serveur/annulation.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { mesurer } from './compteur'
import { peupler } from './peupler'
import { ADMIN, connexionAnimateur, demarrer, ecrire } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Dimanche 27 septembre 2026, 22 h à Paris : 500 profils ont joué le quiz du jour. */
const SOIR = Date.UTC(2026, 8, 27, 20, 0)

test('annuler une question du jour joué par 500 profils', async () => {
  const banc = await demarrer({ horlogeDuJour: () => SOIR })
  try {
    const fichier = banc.quizDbUrl.replace(/^file:/, '')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    // « Demain » pour le peuplement : la veille qu'il laisse ouverte est aujourd'hui.
    peupler(fichier, { spaceId, aujourdhui: '2026-09-28' })
    await banc.redemarrer()
    const admin = await connexionAnimateur(banc.url)
    // Les profils se chargent une fois (le classement du jour), comme en vrai à 22 h.
    await fetch(`${banc.url}/api/admin/jour`, { headers: { Cookie: admin } })
    // Une première annulation, sans latence : elle charge les profils et
    // décerne les paliers que le peuplement n'a pas écrits (L'Assidu…).
    // La seconde mesure le cas ordinaire : profils en mémoire, rien de neuf.
    const premiere = await mesurer('première annulation (préparation, sans latence)', () =>
      ecrire(banc.url, '/api/admin/jour/annuler', { jour: '2026-09-27', index: 3 }, admin).then(r => r.status),
    0)
    const charge = execSync('uptime').toString().trim()
    const { mesure, resultat } = await mesurer(
      'POST /api/admin/jour/annuler — 500 joueurs aujourd’hui',
      () => ecrire(banc.url, '/api/admin/jour/annuler', { jour: '2026-09-27', index: 4 }, admin).then(async r => ({ status: r.status, corps: await r.json() })),
      50,
    )
    const sortie = { charge, premiere: { appels: premiere.mesure.appels, statut: premiere.resultat }, mesure, statut: resultat.status }
    console.log(JSON.stringify(sortie, null, 1))
    writeFileSync(new URL('./mesures-annulation.json', import.meta.url), JSON.stringify(sortie, null, 1))
  } finally {
    await banc.close()
  }
})

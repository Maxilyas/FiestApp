// Créer les équipes d'un coup, au nombre qu'on veut.
//
// Chez Nadia, le 24 septembre : sept invités, et un seul bouton — « Créer les
// 6 équipes d'un coup ». Six équipes pour sept, c'est une soirée en solo
// déguisée. Le nombre se règle maintenant (de deux à six) ; une page d'avant,
// qui n'envoie rien, en crée toujours six.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, demarrer, ecranCommun, instantane, type Banc, type Socket } from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const banc of bancs) await banc.close()
})

/** Crée les équipes par le geste de la console, puis rend ce que la salle voit. */
async function semer(host: Socket, charge: unknown, attendu: number): Promise<any[]> {
  ;(host as any).emit('host:seedTeams', charge)
  const snap = await instantane<any>(host, s => s.teams.length === attendu, `${attendu} équipes`)
  return snap.teams
}

/** Retire toutes les équipes, pour repartir d'un écran vierge. */
async function toutRetirer(host: Socket, equipes: any[]) {
  for (const t of equipes) (host as any).emit('host:removeTeam', { teamId: t.id })
  await instantane<any>(host, s => s.teams.length === 0, 'plus aucune équipe')
}

test('le nombre d’équipes créées d’un coup se règle, de deux à six', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
  await instantane(host)

  const trois = await semer(host, { count: 3 }, 3)
  assert.deepEqual(
    trois.map(t => t.name),
    ['Les Salseras', 'Les Rumberos', 'Les Micros'],
    'les premières équipes par défaut, dans l’ordre',
  )
  await toutRetirer(host, trois)

  // Une page d'avant n'envoie rien : les six, comme avant.
  await toutRetirer(host, await semer(host, undefined, 6))
  // Un nombre absurde est ramené dans les bornes, jamais refusé en silence.
  await toutRetirer(host, await semer(host, { count: 99 }, 6))
  await toutRetirer(host, await semer(host, { count: 1 }, 2))
  await toutRetirer(host, await semer(host, { count: 'quatre' }, 6))
})

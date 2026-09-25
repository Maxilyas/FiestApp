// La salle d'attente de l'écran commun : ses puces ne se redessinent que
// quand ce qu'elles montrent change (`memesPuces`, `client/src/egalite.ts`,
// la comparaison que `memo` fait des props de `PuceJoueur`). Pas de serveur.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** La comparaison des props d'une puce : vrai = pas de redessin. */
async function comparaison(): Promise<(a: object, b: object) => boolean> {
  return (await import(url('egalite.ts'))).memesPuces
}

const joueur = { id: 'p1', name: 'Camille', avatar: '🦊', connected: true, teamId: 't1' }
const equipes = (n: number) => [
  { id: 't1', name: 'Les Renards', emoji: '🦊', position: 0, memberCount: n, total: 100 * n, average: 50 + n, bonus: 0 },
  { id: 't2', name: 'Les Pandas', emoji: '🐼', position: 1, memberCount: 2, total: 200, average: 60, bonus: n },
]

test('avec des équipes, une arrivée ne redessine pas les puces des autres', async () => {
  const memes = await comparaison()
  // L'instantané suivant : tout est neuf, l'effectif, le total, la moyenne et
  // les prix ont bougé — rien de ce que la puce montre.
  assert.equal(memes({ p: { ...joueur }, teams: equipes(3) }, { p: { ...joueur }, teams: equipes(4) }), true)
  // Ce que la puce montre se redessine : le menu des équipes…
  const renommee = equipes(3).map(t => (t.id === 't2' ? { ...t, name: 'Les Koalas' } : t))
  assert.equal(memes({ p: joueur, teams: equipes(3) }, { p: joueur, teams: renommee }), false)
  const emoji = equipes(3).map(t => (t.id === 't2' ? { ...t, emoji: '🐨' } : t))
  assert.equal(memes({ p: joueur, teams: equipes(3) }, { p: joueur, teams: emoji }), false)
  assert.equal(memes({ p: joueur, teams: equipes(3) }, { p: joueur, teams: equipes(3).slice(0, 1) }), false)
  assert.equal(memes({ p: joueur, teams: equipes(3) }, { p: joueur, teams: equipes(3).reverse() }), false)
  // …et le joueur lui-même.
  assert.equal(memes({ p: joueur, teams: equipes(3) }, { p: { ...joueur, teamId: 't2' }, teams: equipes(3) }), false)
})

// Le relevé de tous les collectionneurs en fond (`core/collectionneurs.ts`) :
// « attention à la performance pour ne pas geler le serveur » (le propriétaire,
// le 9 novembre 2026). Au dixième de cœur de l'hébergeur, compter la collection
// de quelques centaines de profils d'une traite gèlerait la boucle — la salle
// avec. Il passe donc une tranche par tour de boucle (`rendreLaMain`), jamais
// pendant qu'une question attend ses réponses (`laisserPasserLaSalle`), sous
// son nom pour la sonde des gels. On compte les tours, on ne chronomètre pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { Collectionneurs, PROFILS_PAR_TRANCHE, type DepsDesCollectionneurs, type ProfilDuCollectionneur } from '../src/core/collectionneurs'
import { ceQuiTournait } from '../src/core/gels'
import { LEGENDAIRES } from '../../shared/legendaires'
import type { ProfileRec } from '../src/auth/profiles'

/** Un collectionneur inventé : un légendaire et un niveau, de quoi être classé. */
const profil = (id: string): ProfilDuCollectionneur => ({
  id,
  nom: id,
  creeLe: 0,
  avatar: '🦊',
  apparence: {},
  bordure: null,
  niveau: 5,
  legendaires: [LEGENDAIRES[0].key],
  scelles: [],
  divins: [],
  compagnons: [],
  eclatsPoses: 0,
  eclates: [],
  matieres: {},
  portees: {},
  hautsFaits: [],
  prix: [],
  calendrier: { pages: [], dorees: [], mois: '', joursCeMois: 0 },
  titresDates: [],
  sentiers: {},
  bordures: [],
  themes: [],
  fonds: [],
  gerbes: [],
  finitions: ['mat'],
  timbres: 0,
})

/** Des magasins inventés, de mémoire : chaque collection comptée retient le tour de boucle où elle l'a été, et ce qui tournait. */
function magasins(n: number, tour: () => number) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`)
  const comptees: { tour: number; noms: string[] }[] = []
  const deps: DepsDesCollectionneurs = {
    profiles: {
      byIds: async (lus: readonly string[]) => lus.map(id => ({ id, name: id, createdAt: 0 }) as ProfileRec),
      cached: () => undefined,
      idsExistants: async () => new Set(ids),
      collectionDe: (p: ProfileRec) => {
        const t = performance.now()
        comptees.push({ tour: tour(), noms: ceQuiTournait(t, t).map(c => c.quoi) })
        return profil(p.id)
      },
      themesAchetes: async () => new Map(),
      lireLaMeta: async () => null,
      ecrireLaMeta: async () => {},
    } as unknown as DepsDesCollectionneurs['profiles'],
    campagne: {
      collectionneurDe: async () => ({ paliers: {}, amis: [] }),
      paliersDeTous: async () => new Map(),
      liguesDeTous: async () => new Map(),
    } as unknown as DepsDesCollectionneurs['campagne'],
    jour: {
      resumeDe: async () => ({ joues: 0, victoires: 0 }),
      resumesDeTous: async () => new Map(),
      estMasque: () => false,
      versionDesExclus: () => '0#0',
    } as unknown as DepsDesCollectionneurs['jour'],
  }
  return { deps, comptees }
}

/** Un compteur de tours de boucle, un `setImmediate` qui se repose à chaque tour. */
function tours() {
  let tour = 0
  let tourne = true
  const tourner = () => {
    tour++
    if (tourne) setImmediate(tourner)
  }
  setImmediate(tourner)
  return { lire: () => tour, arreter: () => (tourne = false) }
}

test('le relevé de tous : une tranche par tour de boucle, jamais plus de `PROFILS_PAR_TRANCHE` collections d’une traite, sous son nom', async () => {
  const t = tours()
  try {
    const n = 5 * PROFILS_PAR_TRANCHE + 3
    const { deps, comptees } = magasins(n, t.lire)
    await new Collectionneurs(deps).relever()
    assert.equal(comptees.length, n, 'chacun compté')
    const parTour = new Map<number, number>()
    for (const c of comptees) parTour.set(c.tour, (parTour.get(c.tour) ?? 0) + 1)
    assert.ok(Math.max(...parTour.values()) <= PROFILS_PAR_TRANCHE, `par tour : ${[...parTour.values()].join(', ')}`)
    assert.ok(parTour.size >= Math.ceil(n / PROFILS_PAR_TRANCHE), `${parTour.size} tours pour ${n} profils`)
    assert.ok(
      comptees.every(c => c.noms.includes('fond · collectionneurs')),
      `nommé pour la sonde des gels : ${comptees[0].noms.join(', ')}`,
    )
  } finally {
    t.arreter()
  }
})

test('une question qui attend ses réponses : le relevé ne compte rien avant qu’elle passe', async () => {
  const t = tours()
  try {
    const { deps, comptees } = magasins(3, t.lire)
    let enJeu = true
    const c = new Collectionneurs(deps)
    c.salleEnJeu = () => enJeu
    const releve = c.relever()
    // `laisserPasserLaSalle` regarde quatre fois par seconde : un tiers de seconde, et toujours rien.
    await new Promise(r => setTimeout(r, 350))
    assert.equal(comptees.length, 0, 'rien pendant la question')
    enJeu = false
    await releve
    assert.equal(comptees.length, 3, 'la question passée, il reprend')
  } finally {
    t.arreter()
  }
})

test('un seul relevé à la fois, et pas de nouvel essai juste après', async () => {
  const t = tours()
  try {
    const { deps, comptees } = magasins(4, t.lire)
    const c = new Collectionneurs(deps)
    await Promise.all([c.relever(), c.relever(), c.relever()])
    assert.equal(comptees.length, 4, 'trois demandes de front : un relevé')
    await c.relever()
    assert.equal(comptees.length, 4, 'tout juste fait, il ne se refait pas')
  } finally {
    t.arreter()
  }
})

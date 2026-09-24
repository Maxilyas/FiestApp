// La fin de soirée que le téléphone garde, et rouvre au rechargement : ce
// qu'on range (jamais le récit d'un Divin) et ce qu'on accepte de relire.
// Dérivations pures : pas de serveur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { finAGarder, finLisible, soireeCloseLisible, type FinDeSoiree } from '../../shared/fin'

const soiree = { id: '2026-09-24-k7x2q', titre: 'La soirée de Nadia', slug: 'chez-nadia' }

const fin = (): FinDeSoiree => ({
  soiree,
  joueurId: 'p1',
  nom: 'Jeanne',
  avatar: '🦊',
  rang: 1,
  points: 1200,
  joueurs: 6,
  aJoue: true,
  prix: [{ key: 'eclair', emoji: '⚡', title: 'L’Éclair', detail: '2,4 s de moyenne' }],
  hautsFaits: [{ key: 'hf:sans-faute', emoji: '🎯', title: 'Sans faute', ton: 'eclat' }],
  profil: {
    xp: 180,
    niveauAvant: 3,
    niveauApres: 4,
    paliers: [],
    legendaires: ['lg:renard'],
    divins: [{ key: 'dv:1', legende: 'Il était une fois…', ton: 'eclat' }],
    finitions: [],
  },
})

test('le récit d’un Divin ne se range pas sur le téléphone', () => {
  const gardee = finAGarder(fin())
  assert.deepEqual(gardee.profil?.divins, [{ key: 'dv:1', ton: 'eclat', legende: '' }])
  assert.ok(!JSON.stringify(gardee).includes('Il était une fois'))
  // Le reste de la fin est intact, et se relit.
  assert.equal(gardee.nom, 'Jeanne')
  assert.ok(finLisible(JSON.parse(JSON.stringify(gardee))))
  // Un anonyme n'a pas de profil : rien à retirer.
  const { profil: _, ...anonyme } = fin()
  assert.deepEqual(finAGarder(anonyme), anonyme)
})

test('une fin gardée d’une autre forme ne se rouvre pas', () => {
  assert.ok(finLisible(fin()))
  // Une page d'avant ne connaissait ni aJoue, ni prix, ni joueurId.
  const { aJoue: _a, prix: _p, joueurId: _j, ...davant } = fin()
  assert.ok(finLisible(davant))
  // Ce qu'un déploiement pourrait changer : la page restait sur « Oups ».
  const abimees: unknown[] = [
    null,
    'fin',
    { ...fin(), hautsFaits: undefined },
    { ...fin(), soiree: { id: 'x' } },
    { ...fin(), rang: '1' },
    { ...fin(), prix: {} },
    { ...fin(), profil: { ...fin().profil, divins: undefined } },
    { ...fin(), profil: { ...fin().profil, finitions: [1] } },
  ]
  for (const x of abimees) assert.equal(finLisible(x), false, JSON.stringify(x))
  assert.ok(soireeCloseLisible(soiree))
  assert.equal(soireeCloseLisible({ id: 1, titre: 't', slug: 's' }), false)
})

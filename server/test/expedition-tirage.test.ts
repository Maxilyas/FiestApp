// Le tirage d'une escale de l'expédition (`tirerPourUneEscale`, le 17
// octobre 2026). Il battait tout son tas, comme une épreuve, pour n'en
// prendre qu'une question — le gardien, les vingt-cinq mille de la base :
// 17 ms de processeur à chaque gardien, dix fois plus au dixième de cœur de
// l'hébergeur. Il lit désormais le tas dans un ordre tiré à mesure, et
// s'arrête à la première question qui ne peut être battue. On compte ce
// qu'il lit — on ne chronomètre pas (règle `tests.md`) —, et on garde ses
// règles : la marche, jamais vues d'abord, une vue d'hier soir en dernier,
// sans vrai ou faux pour le gardien, sans jumelle de ce que l'expédition a
// déjà posé tant qu'il en a d'autres.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tirerPourUneEscale } from '../src/core/campagne'
import type { QuestionDeLaBase } from '../src/core/baseCampagne'
import type { Niveau } from '../../shared/campagne'

const MAINTENANT = Date.UTC(2026, 9, 17, 8, 0)
const JOUR = 86400_000

/** Une question d'essai : 2 facile, 3 moyenne, 4 difficile, 5 experte ; ce que le tirage en lit, rien de plus. */
function question(id: string, difficulte: number, { texte, reponses, sousTheme = 'essai' }: { texte?: string; reponses?: string[]; sousTheme?: string } = {}): QuestionDeLaBase {
  return {
    id,
    texte: texte ?? `Question numéro ${id} de l'essai, laquelle est la bonne ?`,
    reponses: reponses ?? [`Bonne ${id}`, `Autre A${id}`, `Autre B${id}`, `Autre C${id}`],
    bonne: 0,
    anecdote: null,
    meta: { categorie: 'Histoire', sousTheme, difficulte },
  } as unknown as QuestionDeLaBase
}

const tirer = (
  tas: readonly (readonly QuestionDeLaBase[])[],
  marche: Niveau,
  combien: number,
  { vues = new Map<string, number>(), sansVraiFaux = false, posees = [] as QuestionDeLaBase[] } = {},
) => tirerPourUneEscale(tas, marche, combien, { sansVraiFaux, vues, mesure: new Map(), maintenant: MAINTENANT, posees })

test('le gardien ne lit que quelques questions de la base, pas toutes', () => {
  const base = Array.from({ length: 20_000 }, (_, i) => question(`q${i}`, 2 + (i % 4), { sousTheme: `st${i % 40}` }))
  const lues = new Set<number>()
  const tas = new Proxy(base, {
    get(cible, cle, recepteur) {
      if (typeof cle === 'string' && /^\d+$/.test(cle)) lues.add(Number(cle))
      return Reflect.get(cible, cle, recepteur)
    },
  })
  const tirees = tirer([tas], 'difficile', 6, { sansVraiFaux: true })
  assert.equal(tirees.length, 6)
  assert.ok(
    tirees.every(t => t.niveau === 'difficile'),
    'toutes à sa marche',
  )
  // Une sur quatre est difficile, et toutes sont jamais vues : six places en lisent quelques dizaines.
  assert.ok(lues.size < 400, `${lues.size} questions lues sur vingt mille pour six`)
})

test('à sa marche, et jamais vues d’abord : la seule jamais vue sort à chaque fois', () => {
  const tas = [Array.from({ length: 60 }, (_, i) => question(`m${i}`, 2 + (i % 3)))]
  const vues = new Map(tas[0].filter((q, i) => i % 3 === 1 && q.id !== 'm31').map(q => [q.id, MAINTENANT - 30 * JOUR]))
  for (let essai = 0; essai < 30; essai++) {
    const [t] = tirer(tas, 'moyen', 1, { vues })
    assert.equal(t.question.id, 'm31')
    assert.equal(t.niveau, 'moyen')
  }
})

test('toutes vues : la plus anciennement vue, une vue d’hier soir en tout dernier', () => {
  const tas = [[question('vieille', 3), question('ancienne', 3), question('hier', 3), question('facile', 2)]]
  const vues = new Map([
    ['vieille', MAINTENANT - 10 * JOUR],
    ['ancienne', MAINTENANT - 5 * JOUR],
    ['hier', MAINTENANT - 3600_000],
  ])
  for (let essai = 0; essai < 20; essai++) assert.equal(tirer(tas, 'moyen', 1, { vues })[0].question.id, 'vieille')
  // Les trois tirées d'un coup : la vue d'hier soir vient la dernière, jamais la jamais vue d'une autre marche.
  assert.deepEqual(
    tirer(tas, 'moyen', 3, { vues })
      .map(t => t.question.id)
      .sort(),
    ['ancienne', 'hier', 'vieille'],
  )
})

test('le gardien : jamais un vrai ou faux, jamais deux fois la même', () => {
  const tas = [
    Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0 ? question(`vf${i}`, 4, { reponses: ['Vrai', 'Faux'], texte: `Vrai ou faux numéro ${i} : c'est bien ça ?` }) : question(`q${i}`, 4, { sousTheme: `st${i}` }),
    ),
  ]
  for (let essai = 0; essai < 20; essai++) {
    const tirees = tirer(tas, 'difficile', 6, { sansVraiFaux: true })
    assert.equal(tirees.length, 6)
    assert.ok(
      tirees.every(t => t.question.reponses.length === 4),
      'aucun vrai ou faux',
    )
    assert.equal(new Set(tirees.map(t => t.question.id)).size, 6, 'six questions distinctes')
  }
})

test('une marche vide emprunte, d’abord à la plus dure', () => {
  const tas = [[question('experte', 5), question('moyenne', 3), question('facile', 2)]]
  assert.deepEqual(
    tirer(tas, 'difficile', 1).map(t => [t.question.id, t.niveau]),
    [['experte', 'expert']],
  )
  assert.deepEqual(
    tirer([[question('moyenne', 3), question('facile', 2)]], 'difficile', 1).map(t => [t.question.id, t.niveau]),
    [['moyenne', 'moyen']],
  )
})

test('pas la jumelle d’une question que l’expédition a posée, tant qu’il en a une autre', () => {
  const film = (id: string, titre: string) => question(id, 3, { texte: `Qui a réalisé le film « ${titre} » ?`, reponses: [`Réalisateur ${id}`, `Autre A${id}`, `Autre B${id}`, `Autre C${id}`] })
  const posee = film('posee', 'Le Mépris')
  const tas = [[film('jumelle', 'Les Enfants du paradis'), question('autre', 3)]]
  for (let essai = 0; essai < 20; essai++) assert.equal(tirer(tas, 'moyen', 1, { posees: [posee] })[0].question.id, 'autre')
  // Rien d'autre : la jumelle sort quand même — une escale a toujours sa question.
  assert.equal(tirer([[film('jumelle', 'Les Enfants du paradis')]], 'moyen', 1, { posees: [posee] })[0].question.id, 'jumelle')
})

test('un tas en morceaux — les catégories d’un mélange — se lit comme un seul', () => {
  const histoire = [question('h1', 3), question('h2', 3)]
  const sport = [question('s1', 3)]
  // Les deux morceaux sortent, chacun à sa part.
  const sorties = new Map<string, number>()
  for (let essai = 0; essai < 300; essai++) {
    const id = tirer([histoire, sport], 'moyen', 1)[0].question.id
    sorties.set(id, (sorties.get(id) ?? 0) + 1)
  }
  assert.deepEqual([...sorties.keys()].sort(), ['h1', 'h2', 's1'])
  // La seule jamais vue est dans le second morceau : elle sort.
  const vues = new Map([
    ['h1', MAINTENANT - 9 * JOUR],
    ['h2', MAINTENANT - 9 * JOUR],
  ])
  for (let essai = 0; essai < 20; essai++) assert.equal(tirer([histoire, sport], 'moyen', 1, { vues })[0].question.id, 's1')
})

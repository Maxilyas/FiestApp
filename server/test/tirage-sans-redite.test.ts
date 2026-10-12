// Une épreuve sans redite, un duel sans déjà-vu (les constats de l'experte du
// jeu solo, le 11 octobre 2026, `retours/2026-10-11/experts/nouveautes-solo.md`,
// constat 14).
//
// Au premier palier de la forêt, seize questions : « le petit du cerf », « de
// la vache », « de la chèvre », « du sanglier », mêmes leurres — agneau,
// poulain, chevreau, veau. Et un défi entre amis, tiré pour personne, reposait
// à son auteur la colombe vue dix minutes plus tôt dans son épreuve.
//
// Une épreuve ne prend plus deux questions jumelles — la même forme
// d'intitulé, ou deux réponses en commun — quand sa marche en a d'autres
// aussi fraîches ; un duel se tire sur ce que ses deux joueurs n'ont pas vu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { gabaritDe, jumelles, tirerUneEpreuve } from '../src/core/campagne'
import { regleDuPalier } from '../../shared/sentiers'
import { NIVEAUX, QUESTIONS_PAR_MARCHE, niveauDeQuestion, type Niveau } from '../../shared/campagne'

const MAINTENANT = Date.UTC(2026, 9, 12, 20)
const JOUR_MS = 24 * 3_600_000

/** Une question facile de la Nature, mammifères. */
function question(n: number, texte: string, reponses: string[]) {
  const lu = lireQuestionDeLaBase({
    id: `j${String(n).padStart(7, '0')}`,
    texte,
    reponses,
    bonne: 0,
    anecdote: `L'anecdote ${n}.`,
    categorie: 'Nature',
    sousTheme: 'mammiferes',
    etiquettes: [],
    difficulte: 2,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: reponses.slice(1),
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}

const PETITS = ['Le chevreau', 'L’agneau', 'Le veau', 'Le poulain', 'Le faon']
const MERES = ['de la chèvre', 'de la brebis', 'de la vache', 'de la jument', 'de la biche', 'de l’ânesse']

/** Six « Comment appelle-t-on le petit de… », mêmes leurres ; et trente questions qui ne se ressemblent pas. */
function laForet() {
  const famille = MERES.map((mere, i) => question(i, `Comment appelle-t-on le petit ${mere} ?`, [PETITS[i % PETITS.length], ...PETITS.filter((_, j) => j !== i % PETITS.length).slice(0, 3)]))
  // Chacune sa forme : l'énigme 12 ne commence pas comme l'énigme 13.
  const autres = Array.from({ length: 30 }, (_, i) => question(100 + i, `Énigme ${i} : quel animal se cache au bois ?`, [`Bonne ${i}`, `Autre A${i}`, `Autre B${i}`, `Autre C${i}`]))
  return { famille, autres, base: new BaseDeLaCampagne([...famille, ...autres]) }
}

test('la forme d’un intitulé : ses trois premiers mots pleins, sans accents', () => {
  assert.equal(gabaritDe('Qui a réalisé le film « Amélie » ?'), 'qui realise film')
  assert.equal(gabaritDe('Qui a réalisé le film « Le Grand Bleu » ?'), 'qui realise film')
  assert.equal(gabaritDe('Comment appelle-t-on le petit de la chèvre ?'), 'comment appelle t')
  assert.notEqual(gabaritDe('Quel est le plus long fleuve de France ?'), gabaritDe('Quelle ville est la capitale du Canada ?'))
})

test('deux questions jumelles : la même forme, ou deux réponses en commun — jamais un vrai ou faux', () => {
  const chevre = { texte: 'Comment appelle-t-on le petit de la chèvre ?', reponses: ['Le chevreau', 'L’agneau', 'Le veau', 'Le poulain'] }
  // Une autre forme, mais les mêmes petits : la redite se voit à ses leurres.
  const vache = { texte: 'Quel est le nom du petit de la vache ?', reponses: ['veau', 'chevreau', 'Le faon', 'Le marcassin'] }
  assert.equal(jumelles(chevre, vache), true)
  assert.equal(jumelles({ texte: 'Qui a réalisé le film « Amélie » ?', reponses: ['A', 'B', 'C', 'D'] }, { texte: 'Qui a réalisé le film « Léon » ?', reponses: ['E', 'F', 'G', 'H'] }), true)
  // Une réponse en commun ne fait pas une redite.
  assert.equal(jumelles(chevre, { texte: 'Quel animal donne la laine ?', reponses: ['Le mouton', 'L’agneau', 'La chèvre', 'Le lama'] }), false)
  // Un vrai ou faux n'a pas de jumelle : c'est un genre.
  const vf = (texte: string) => ({ texte, reponses: ['Vrai', 'Faux'] })
  assert.equal(jumelles(vf('Vrai ou faux : la baleine est un poisson ?'), vf('Vrai ou faux : la chauve-souris est un oiseau ?')), false)
})

test('une épreuve ne prend pas deux jumelles quand sa marche en a d’autres aussi fraîches — ni ne leur préfère une déjà vue', () => {
  const { famille, autres, base } = laForet()
  const deLaFamille = new Set(famille.map(q => q.id))
  // Seize faciles parmi six jumelles et trente autres : une jumelle au plus, à chaque tirage.
  for (let essai = 0; essai < 25; essai++) {
    const epreuve = tirerUneEpreuve(base.questions, regleDuPalier(1)!, new Map(), new Map(), MAINTENANT)
    assert.equal(epreuve.length, 16)
    assert.ok(epreuve.filter(x => deLaFamille.has(x.question.id)).length <= 1, `essai ${essai} : une jumelle au plus`)
  }
  // La fraîcheur passe devant : les autres vues il y a trois semaines, les six jumelles, jamais vues, sont toutes prises.
  const vues = new Map(autres.map((q, i) => [q.id, MAINTENANT - 21 * JOUR_MS + i]))
  const epreuve = tirerUneEpreuve(base.questions, regleDuPalier(1)!, vues, new Map(), MAINTENANT)
  assert.equal(epreuve.filter(x => deLaFamille.has(x.question.id)).length, famille.length)
})

// ── Un duel ────────────────────────────────────────────────────────────────

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des questions vues ce soir par un profil : une série finie, ses réponses au journal. */
function vuesCeSoir(banc: Banc, profileId: string, ids: readonly string[]) {
  base(banc, db => {
    const serie = randomUUID()
    const le = Date.now() - 3_600_000
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 0, 0, ?, ?)`).run(
      serie,
      profileId,
      ids.length,
      le,
      le + 60_000,
    )
    ids.forEach((id, i) => db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, 0, ?)').run(serie, i, id, le + i))
  })
}

test('un duel se tire sur ce que ses deux joueurs n’ont pas vu', async () => {
  const BASE = baseDEssai(120, { categories: ['Histoire'] })
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await inscrireProfil(banc.url, 'tom', 'Tom', '🐼')
    // Chaque marche : un tiers vu ce soir par Léa, un tiers par Tom, un tiers que personne n'a vu.
    const parNiveau = new Map<Niveau, string[]>(NIVEAUX.map(n => [n, []]))
    for (const q of BASE.questions) parNiveau.get(niveauDeQuestion(q.meta.difficulte))!.push(q.id)
    const deLea: string[] = []
    const deTom: string[] = []
    for (const ids of parNiveau.values()) {
      const tiers = Math.floor(ids.length / 3)
      deLea.push(...ids.slice(0, tiers))
      deTom.push(...ids.slice(tiers, 2 * tiers))
    }
    vuesCeSoir(banc, idDe(banc, 'lea'), deLea)
    vuesCeSoir(banc, idDe(banc, 'tom'), deTom)

    const lance = await ecrire(banc.url, '/api/campagne/duel', { categories: ['Histoire'], adversaire: idDe(banc, 'tom') }, lea)
    assert.equal(lance.status, 200, await lance.clone().text())
    const { code } = (await lance.json()) as { code: string }
    const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_duels WHERE code = ?').get(code) as { questions: string }).questions)) as { id: string; niveau: Niveau }[]
    // Les marches qu'on joue d'abord — cinq faciles, cinq moyennes, cinq difficiles — : rien de ce soir, ni à l'un ni à l'autre.
    const joueesDAbord = questions.slice(0, 3 * QUESTIONS_PAR_MARCHE)
    for (const n of ['facile', 'moyen', 'difficile'] as const) assert.ok(parNiveau.get(n)!.length >= 3 * QUESTIONS_PAR_MARCHE, `assez de ${n}s pour le dire`)
    const vuesCeSoirParLun = new Set([...deLea, ...deTom])
    assert.deepEqual(
      joueesDAbord.filter(q => vuesCeSoirParLun.has(q.id)).map(q => q.id),
      [],
      'aucune question vue ce soir par Léa ou par Tom',
    )
  } finally {
    await banc.close()
  }
})

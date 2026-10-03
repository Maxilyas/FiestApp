// La campagne solo : une série qui monte en difficulté, trois vies, sans
// chronomètre.
//
// Ses questions sont celles que le quiz du jour a déjà posées — jamais une
// de la réserve encore à sortir, qui gâcherait le quiz de demain —, rangées
// par la part des joueurs qui les ont trouvées. Le serveur compte les vies
// et ne donne la bonne réponse qu'après la sienne (invariant 1) ; une bonne
// réponse y vaut un confetti, comme au quiz du jour, et l'expérience d'une
// bonne réponse en soirée — plafonnée par jour, puisqu'elle se rejoue sans
// fin —, dans une ligne que l'historique des soirées ignore.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import {
  NIVEAUX,
  QUESTIONS_PAR_MARCHE,
  VIES,
  XP_MAX_PAR_JOUR,
  XP_PAR_JUSTE,
  niveauMesure,
  ordreDeSerie,
  xpDeCampagne,
  xpDuJourDeCampagne,
  type Niveau,
} from '../../shared/campagne'
import { XP } from '../../shared/profil'

// ── Les règles pures ───────────────────────────────────────────────────────

test('la difficulté se lit sur la part des joueurs qui ont trouvé — pas en dessous de cinq réponses', () => {
  assert.equal(niveauMesure(4, 4), null, 'quatre réponses ne disent rien')
  assert.equal(niveauMesure(9, 10), 'facile')
  assert.equal(niveauMesure(5, 10), 'moyen')
  assert.equal(niveauMesure(3, 10), 'difficile')
  assert.equal(niveauMesure(1, 10), 'expert')
})

test('une série monte : cinq de chaque marche, de la plus facile à l’expert, puis le reste au plus dur', () => {
  const marche = (n: Niveau, k: number) => Array.from({ length: k }, (_, i) => `${n}-${i}`)
  const serie = ordreDeSerie({ facile: marche('facile', 7), moyen: marche('moyen', 6), difficile: marche('difficile', 2), expert: marche('expert', 1) })
  const niveaux = serie.map(x => x.niveau)
  assert.deepEqual(niveaux.slice(0, QUESTIONS_PAR_MARCHE), Array(QUESTIONS_PAR_MARCHE).fill('facile'))
  assert.deepEqual(niveaux.slice(5, 10), Array(5).fill('moyen'))
  assert.deepEqual(niveaux.slice(10), ['difficile', 'difficile', 'expert', 'moyen', 'facile', 'facile'], 'le reste, en reprenant du plus dur')
  assert.equal(new Set(serie.map(x => x.question)).size, serie.length, 'chaque question une fois')
  assert.deepEqual([...NIVEAUX], ['facile', 'moyen', 'difficile', 'expert'])
})

test('une bonne réponse rapporte celle d’une soirée, sans réflexe ; chaque journée plafonnée à part', () => {
  assert.equal(XP_PAR_JUSTE, XP.juste)
  assert.equal(XP_MAX_PAR_JOUR, 45)
  assert.ok(XP_MAX_PAR_JOUR < 75, 'en dessous du quiz du jour, qui ne se joue qu’une fois')
  assert.equal(xpDuJourDeCampagne(0), 0)
  assert.equal(xpDuJourDeCampagne(4), 12)
  assert.equal(xpDuJourDeCampagne(15), 45)
  assert.equal(xpDuJourDeCampagne(40), 45, 'le plafond')
  assert.equal(xpDeCampagne([40, 2, 15]), 45 + 6 + 45, 'un jour sans partie ne reporte rien')
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les bonnes réponses d'une série, lues en base : le téléphone ne les voit jamais avant. */
function bonnesDe(banc: Banc, serie: string): number[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(r.questions) as { bonne: number }[]).map(q => q.bonne)
  } finally {
    db.close()
  }
}

/** Les identifiants de la réserve qu'une série pose. */
function idsDe(banc: Banc, serie: string): string[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(r.questions) as { reserveId: string }[]).map(q => q.reserveId)
  } finally {
    db.close()
  }
}

test('la campagne joue les questions déjà posées au quiz du jour : trois vies, la bonne réponse après la sienne, un confetti par bonne réponse', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    assert.equal((await fetch(`${banc.url}/api/campagne`)).status, 401, 'un invité anonyme n’a pas de campagne')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Rien n'a encore été posé : la réserve ne se gâche pas.
    const vide = await lire(banc, lea, '/api/campagne')
    assert.equal(vide.corps.questions, 0)
    const tropTot = await poster(banc, lea, '/api/campagne/serie')
    assert.equal(tropTot.status, 400)
    assert.match(tropTot.corps.error, /reviens demain/)
    // Le quiz du jour d'aujourd'hui tire ses dix questions… qui ne servent pas encore.
    await poster(banc, lea, '/api/jour/commencer')
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.questions, 0, 'les questions du jour ne sortent pas en campagne le jour même')
    // Le lendemain, elles sont jouables.
    horloge.t += 24 * 3_600_000
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.equal(etat.questions, 10)
    assert.deepEqual([etat.record, etat.series, etat.enCours], [0, 0, null])

    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    assert.equal(serie.vies, VIES)
    assert.equal(serie.total, 10)
    assert.equal(serie.question.index, 0)
    assert.equal(serie.question.bonne, undefined, 'ni la bonne réponse…')
    assert.equal(serie.question.anecdote, undefined, '… ni l’anecdote avant la sienne')
    assert.ok(NIVEAUX.includes(serie.question.niveau))
    const bonnes = bonnesDe(banc, serie.id)
    const solde = async () => (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    const avant = (await lire(banc, lea, '/api/joueur/moi')).corps

    // Juste, puis faux trois fois : la série s'arrête à la troisième erreur.
    const r0 = (await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: 0, choix: bonnes[0] })).corps
    assert.deepEqual([r0.juste, r0.vies, r0.justes, r0.finie, r0.bonne], [true, 3, 1, false, bonnes[0]])
    assert.equal(r0.suivante.index, 1)
    assert.equal(r0.suivante.bonne, undefined)
    // Un double toucher sur la question passée ne compte pas.
    assert.equal((await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: 0, choix: bonnes[0] })).status, 400)
    for (let i = 1; i <= 3; i++) {
      const r = (await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: (bonnes[i] + 1) % 2 })).corps
      assert.equal(r.vies, VIES - i)
      assert.equal(r.finie, i === 3)
    }
    const fin = (await lire(banc, lea, '/api/campagne')).corps
    assert.deepEqual([fin.record, fin.series, fin.enCours], [1, 1, null], 'le record : une bonne réponse')
    // « Mes réponses » : chaque question posée, sa bonne réponse et la sienne.
    const correction = (await lire(banc, lea, `/api/campagne/serie/${serie.id}/correction`)).corps
    assert.equal(correction.length, 4)
    assert.deepEqual(correction.map((c: any) => c.juste), [true, false, false, false])
    // Une bonne réponse, un confetti, et l'expérience d'une bonne réponse en soirée.
    assert.deepEqual([r0.xp], [XP_PAR_JUSTE], 'la réponse dit ce qu’elle rapporte')
    const apres = await solde()
    assert.equal(apres.xp, avant.profile.xp + XP_PAR_JUSTE, 'une bonne réponse, trois points d’expérience')
    assert.equal(apres.boutique.confettis.gagnes, avant.profile.boutique.confettis.gagnes + 1, 'une bonne réponse, un confetti')
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.xpAujourdhui, XP_PAR_JUSTE)

    // Une autre série : les questions jamais vues en campagne passent devant.
    const deux = (await poster(banc, lea, '/api/campagne/serie')).corps
    const vues = new Set(idsDe(banc, serie.id).slice(0, 4))
    const premieres = idsDe(banc, deux.id).slice(0, 6)
    assert.ok(premieres.every(id => !vues.has(id)), 'les six premières n’ont pas été vues')
    // Le voisin ne voit ni ne joue la série d'un autre (invariant 3).
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    const intrus = await poster(banc, bob, `/api/campagne/serie/${deux.id}/reponse`, { index: 0, choix: 0 })
    assert.match(intrus.corps.error, /introuvable/)
  } finally {
    await banc.close()
  }
})

test('l’expérience de campagne s’arrête au plafond du jour, repart le lendemain, et ne fait pas une soirée', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    await poster(banc, lea, '/api/jour/commencer')
    horloge.t += 24 * 3_600_000
    const moi = async () => (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    const depart = await moi()
    /** Une série entière, toutes ses réponses justes : ce que chacune a rapporté. */
    const toutJuste = async () => {
      const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
      const bonnes = bonnesDe(banc, serie.id)
      const gains: number[] = []
      for (let i = 0; i < serie.total; i++) {
        gains.push((await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: bonnes[i] })).corps.xp)
      }
      return gains
    }
    // Vingt bonnes réponses le même jour : les quinze premières paient.
    const gains = [...(await toutJuste()), ...(await toutJuste())]
    assert.equal(gains.length, 20)
    assert.deepEqual(gains.slice(0, 15), Array(15).fill(XP_PAR_JUSTE))
    assert.deepEqual(gains.slice(15), Array(5).fill(0), 'au plein, plus rien')
    const plein = await moi()
    assert.equal(plein.xp, depart.xp + XP_MAX_PAR_JOUR)
    assert.equal(plein.boutique.confettis.gagnes, depart.boutique.confettis.gagnes + 20, 'les confettis, eux, continuent')
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.xpAujourdhui, XP_MAX_PAR_JOUR)
    // La campagne n'est pas une soirée : l'historique ne la compte pas.
    assert.ok(Array.isArray(plein.soirees))
    assert.deepEqual(plein.soirees, depart.soirees, 'pas de soirée de plus')
    // Le lendemain, le compteur repart.
    horloge.t += 24 * 3_600_000
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.xpAujourdhui, 0)
    const demain = await toutJuste()
    assert.equal(demain[0], XP_PAR_JUSTE)
    assert.equal((await moi()).xp, depart.xp + XP_MAX_PAR_JOUR + 10 * XP_PAR_JUSTE)
  } finally {
    await banc.close()
  }
})

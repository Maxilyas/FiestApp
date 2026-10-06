// La campagne solo : une série qui monte en difficulté, trois vies, sans
// chronomètre.
//
// Ses questions viennent de sa base à elle (`core/baseCampagne.ts`), jamais
// de la réserve du quiz du jour — elle en reposait les questions, vues et
// corrigées chaque matin —, et chaque marche tire d'abord ce que le joueur
// n'a jamais vu. Leur difficulté part de l'estimation de l'écriture, que les
// réponses de campagne corrigent. Le serveur compte les vies et ne donne la
// bonne réponse qu'après la sienne (invariant 1) ; une bonne réponse y vaut
// un confetti, comme au quiz du jour, et l'expérience d'une bonne réponse en
// soirée — sans plafond : chacun monte à son rythme —, dans une ligne que
// l'historique des soirées ignore. Une question signalée se relit à
// l'administration, qui peut la retirer pour tous.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import {
  NIVEAUX,
  QUESTIONS_PAR_MARCHE,
  JUSTES_DOUBLEES_PAR_JOUR,
  REPONSES_FICTIVES,
  VIES,
  XP_PAR_JUSTE,
  niveauDeQuestion,
  niveauMesure,
  ordreDeSerie,
  tauxLisse,
  xpDeCampagne,
  xpDeLaBonneReponse,
  xpDuJourDeCampagne,
  type Niveau,
} from '../../shared/campagne'
import { XP_PALIER } from '../../shared/hautsfaits'
import { empreinteDe } from '../src/core/jour'

// ── Les règles pures ───────────────────────────────────────────────────────

test('la difficulté du quiz du jour se lit sur la part des joueurs qui ont trouvé — pas en dessous de cinq réponses', () => {
  assert.equal(niveauMesure(4, 4), null, 'quatre réponses ne disent rien')
  assert.equal(niveauMesure(9, 10), 'facile')
  assert.equal(niveauMesure(5, 10), 'moyen')
  assert.equal(niveauMesure(3, 10), 'difficile')
  assert.equal(niveauMesure(1, 10), 'expert')
})

test('une question de campagne part de sa difficulté estimée, et les réponses des joueurs la corrigent', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(d => niveauDeQuestion(d)),
    ['facile', 'facile', 'moyen', 'difficile', 'expert'],
    'jamais jouée : l’estimation de l’écriture',
  )
  // Trois joueurs qui ratent une « 2 » la font monter d'une marche ; deux ne suffisent pas.
  assert.equal(niveauDeQuestion(2, { justes: 0, total: 2 }), 'facile')
  assert.equal(niveauDeQuestion(2, { justes: 0, total: 3 }), 'moyen')
  // Une « 5 » que trois joueurs trouvent d'affilée quitte l'expert.
  assert.equal(niveauDeQuestion(5, { justes: 2, total: 2 }), 'expert')
  assert.equal(niveauDeQuestion(5, { justes: 3, total: 3 }), 'difficile')
  // Mille réponses : l'estimation ne pèse presque plus.
  assert.ok(Math.abs(tauxLisse(1, 300, 1000) - 0.3) < 0.02)
  assert.equal(REPONSES_FICTIVES, 20)
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

test('une bonne réponse rapporte cinq points, dix parmi les vingt premières du jour, sans plafond', () => {
  assert.equal(XP_PAR_JUSTE, 5)
  assert.equal(JUSTES_DOUBLEES_PAR_JOUR, 20)
  assert.equal(xpDuJourDeCampagne(0), 0)
  assert.equal(xpDuJourDeCampagne(4), 40, 'les premières du jour paient double')
  assert.equal(xpDuJourDeCampagne(15), 150)
  assert.equal(xpDuJourDeCampagne(20), 200)
  assert.equal(xpDuJourDeCampagne(40), 300, 'plus de plafond : la quarantième paie encore, au prix simple')
  assert.equal(xpDeCampagne([40, 2, 15]), 300 + 20 + 150, 'chaque journée a ses vingt premières')
  assert.deepEqual([1, 20, 21, 40].map(xpDeLaBonneReponse), [10, 10, 5, 5])
  assert.equal(xpDeLaBonneReponse(0), 0)
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les questions d'une série, lues en base : le téléphone ne voit jamais la bonne réponse avant la sienne. */
function questionsDe(banc: Banc, serie: string): { id: string; bonne: number; niveau: Niveau; anecdote: string | null }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return JSON.parse(r.questions)
  } finally {
    db.close()
  }
}

/** Répond à la question `index` d'une série, juste ou faux. */
const repondre = (banc: Banc, cookie: string, serie: string, index: number, juste: boolean) => {
  const q = questionsDe(banc, serie)[index]
  return poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index, choix: juste ? q.bonne : (q.bonne + 1) % 4 })
}

test('la campagne joue sa propre base, dès le premier jour : trois vies, la bonne réponse après la sienne, la fin de série et sa correction', async () => {
  const base = baseDEssai(40)
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: base })
  try {
    assert.equal((await fetch(`${banc.url}/api/campagne`)).status, 401, 'un invité anonyme n’a pas de campagne')
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Plus besoin d'attendre que le quiz du jour ait posé ses questions.
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.equal(etat.questions, 40)
    assert.deepEqual(etat.categories, [{ categorie: 'Histoire', questions: 40 }])
    assert.deepEqual([etat.record, etat.series, etat.enCours], [0, 0, null])

    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    assert.equal(serie.vies, VIES)
    assert.equal(serie.total, 40)
    assert.equal(serie.question.index, 0)
    assert.equal(serie.question.bonne, undefined, 'ni la bonne réponse…')
    assert.equal(serie.question.anecdote, undefined, '… ni l’anecdote avant la sienne')
    const qs = questionsDe(banc, serie.id)
    assert.ok(qs.every(q => base.parId.has(q.id)), 'chaque question vient de la base')
    // Les réponses sont mélangées pour la série : la bonne n'est pas toujours la première.
    const solde = async () => (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    const avant = await solde()

    // Juste, puis faux trois fois : la série s'arrête à la troisième erreur.
    const r0 = (await repondre(banc, lea, serie.id, 0, true)).corps
    assert.deepEqual([r0.juste, r0.vies, r0.justes, r0.finie, r0.bonne, r0.xp], [true, 3, 1, false, qs[0].bonne, xpDeLaBonneReponse(1)])
    assert.equal(r0.anecdote, base.parId.get(qs[0].id)!.anecdote, 'l’anecdote, après la réponse')
    assert.equal(r0.suivante.index, 1)
    assert.equal(r0.suivante.bonne, undefined)
    assert.equal(r0.recordAvant, undefined, 'le record ne se dit qu’à la fin')
    // Un double toucher sur la question passée ne compte pas.
    assert.equal((await repondre(banc, lea, serie.id, 0, true)).status, 400)
    let fin: any
    for (let i = 1; i <= 3; i++) {
      fin = (await repondre(banc, lea, serie.id, i, false)).corps
      assert.equal(fin.vies, VIES - i)
      assert.equal(fin.finie, i === 3)
    }
    // La fin de série : le record battu et l'ancien, la marche la plus haute atteinte.
    assert.deepEqual([fin.record, fin.recordAvant], [true, 0])
    const plusHaute = NIVEAUX[Math.max(...qs.slice(0, 4).map(q => NIVEAUX.indexOf(q.niveau)))]
    assert.equal(fin.niveauAtteint, plusHaute)
    const apresSerie = (await lire(banc, lea, '/api/campagne')).corps
    assert.deepEqual([apresSerie.record, apresSerie.series, apresSerie.enCours], [1, 1, null], 'le record : une bonne réponse')

    // « Mes réponses » : chaque question posée, sa bonne réponse, la sienne — et son anecdote.
    const correction = (await lire(banc, lea, `/api/campagne/serie/${serie.id}/correction`)).corps
    assert.equal(correction.length, 4)
    assert.deepEqual(
      correction.map((c: any) => c.juste),
      [true, false, false, false],
    )
    assert.deepEqual(
      correction.map((c: any) => c.anecdote),
      qs.slice(0, 4).map(q => base.parId.get(q.id)!.anecdote),
    )

    // Une bonne réponse, un confetti, et son expérience — la première du jour paie double.
    const apres = await solde()
    assert.equal(apres.xp, avant.xp + 2 * XP_PAR_JUSTE, 'la première bonne réponse du jour, dix points d’expérience')
    assert.equal(apres.boutique.confettis.gagnes, avant.boutique.confettis.gagnes + 1, 'une bonne réponse, un confetti')
    assert.equal(apresSerie.xpAujourdhui, 2 * XP_PAR_JUSTE)
    assert.equal(apresSerie.justesAujourdhui, 1)

    // Une seconde série moins bonne : le record n'est pas battu, et la fin le redit.
    const deux = (await poster(banc, lea, '/api/campagne/serie')).corps
    let fin2: any
    for (let i = 0; i < 3; i++) fin2 = (await repondre(banc, lea, deux.id, i, false)).corps
    assert.deepEqual([fin2.finie, fin2.record, fin2.recordAvant], [true, undefined, 1])

    // Le voisin ne voit ni ne joue la série d'un autre (invariant 3).
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    const intrus = await poster(banc, bob, `/api/campagne/serie/${deux.id}/reponse`, { index: 3, choix: 0 })
    assert.match(intrus.corps.error, /introuvable/)
  } finally {
    await banc.close()
  }
})

test('un joueur ne revoit une question qu’une fois toutes les autres de sa marche passées', async () => {
  // Trente questions moyennes : une seule marche, qu'une série entière parcourt.
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: baseDEssai(30, { difficultes: [3] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const une = (await poster(banc, lea, '/api/campagne/serie')).corps
    for (let i = 0; i < 3; i++) await repondre(banc, lea, une.id, i, false)
    const vues = questionsDe(banc, une.id)
      .slice(0, 3)
      .map(q => q.id)
    const deux = questionsDe(banc, (await poster(banc, lea, '/api/campagne/serie')).corps.id).map(q => q.id)
    assert.equal(deux.length, 30)
    assert.deepEqual(new Set(deux.slice(-3)), new Set(vues), 'les trois déjà vues passent en dernier')
    // Une série laissée en route ne compte pas ses questions jamais montrées comme vues.
    const trois = questionsDe(banc, (await poster(banc, lea, '/api/campagne/serie')).corps.id).map(q => q.id)
    assert.deepEqual(new Set(trois.slice(-3)), new Set(vues))
  } finally {
    await banc.close()
  }
})

test('la série monte de marche en marche, sur la difficulté estimée à l’écriture, que les réponses de campagne corrigent', async () => {
  // Douze questions de chaque difficulté : 24 faciles (1 et 2), 12 moyennes, 12 difficiles, 12 expertes.
  const base = baseDEssai(60, { difficultes: [1, 2, 3, 4, 5] })
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const qs = questionsDe(banc, serie.id)
    assert.deepEqual(
      qs.slice(0, 20).map(q => q.niveau),
      [...Array(5).fill('facile'), ...Array(5).fill('moyen'), ...Array(5).fill('difficile'), ...Array(5).fill('expert')],
    )
    for (const q of qs) assert.equal(q.niveau, niveauDeQuestion(base.parId.get(q.id)!.meta.difficulte), q.id)
    assert.equal(serie.question.niveau, 'facile', 'le téléphone voit la marche, pas la bonne réponse')

    // Les réponses de campagne corrigent l'estimation : une « 1 » que quarante joueurs ratent n'est plus facile.
    const cible = base.questions.find(q => q.meta.difficulte === 1)!
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const ratee = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, 0, ?, 1, 0, ?)')
    for (let i = 0; i < 40; i++) ratee.run(`ailleurs-${i}`, cible.id, DEBUT)
    db.close()
    // La mesure se relit au plus toutes les dix minutes.
    horloge.t += 11 * 60_000
    const apres = questionsDe(banc, (await poster(banc, lea, '/api/campagne/serie')).corps.id)
    assert.equal(apres.find(q => q.id === cible.id)?.niveau, 'difficile')
  } finally {
    await banc.close()
  }
})

test('la campagne ne pose rien de la réserve du quiz du jour, et la réserve refuse ce que la campagne a déjà', async () => {
  const base = baseDEssai(20)
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: base })
  try {
    // Une question que la réserve avait avant la base : elle reste au quiz du jour.
    const premiere = base.questions[0]
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.prepare(`INSERT INTO jour_reserve (id, question, empreinte, categorie, source, ajoutee_le) VALUES (?, ?, ?, ?, 'liste', 1)`).run(
      'reserve-a',
      JSON.stringify({ kind: 'choice', text: premiere.texte, answers: premiere.reponses, correct: premiere.bonne, target: null, unit: '', duration: 20, image: null, observeSeconds: null }),
      empreinteDe(premiere.texte),
      'Histoire',
    )
    db.close()
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.questions, 19)
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    assert.ok(!questionsDe(banc, serie.id).some(q => q.id === premiere.id), 'jamais en campagne')

    // Et une liste collée pour le quiz du jour : ce que la campagne a déjà en est écarté.
    const admin = await connexionAnimateur(banc.url)
    const q = base.questions[1]
    const liste = `# Histoire\n\n${q.texte}\n* ${q.reponses[q.bonne]}\n${q.reponses.filter((_, i) => i !== q.bonne).join('\n')}\n`
    const colle = (await poster(banc, admin, '/api/admin/jour/liste', { texte: liste })).corps
    assert.equal(colle.ajoutees, 0)
    assert.deepEqual(
      colle.ecartees.map((e: any) => e.raison),
      ['déjà dans la campagne'],
    )
  } finally {
    await banc.close()
  }
})

test('signaler une erreur : après sa réponse, relue par l’administrateur, qui garde la question ou la retire pour tous', async () => {
  const base = baseDEssai(20)
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: base })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    const admin = await connexionAnimateur(banc.url)
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const qs = questionsDe(banc, serie.id)
    const signaler = (cookie: string, index: number, texte = 'La réponse B est juste aussi') => poster(banc, cookie, `/api/campagne/serie/${serie.id}/signalement`, { index, texte })

    const tropTot = await signaler(lea, 0)
    assert.equal(tropTot.status, 400)
    assert.match(tropTot.corps.error, /Réponds d’abord/, 'avant sa réponse, on n’a pas vu la bonne')
    await repondre(banc, lea, serie.id, 0, true)
    await repondre(banc, lea, serie.id, 1, true)
    assert.equal((await signaler(lea, 0, '  ')).status, 400, 'une phrase, pas du vide')
    assert.equal((await signaler(lea, 0)).status, 200)
    assert.equal((await signaler(lea, 0, 'Et la C aussi')).status, 200, 'le second remplace le premier')
    assert.match((await signaler(bob, 0)).corps.error, /introuvable/, 'la série d’un autre')

    const etat = (await lire(banc, admin, '/api/admin/campagne')).corps
    assert.deepEqual([etat.questions, etat.jouables, etat.retirees], [20, 20, 0])
    assert.equal(etat.signalements.length, 1)
    assert.deepEqual(
      [etat.signalements[0].questionId, etat.signalements[0].joueurs, etat.signalements[0].rapports.map((r: any) => r.texte)],
      [qs[0].id, 1, ['Et la C aussi']],
    )
    assert.equal(etat.signalements[0].anecdote, base.parId.get(qs[0].id)!.anecdote)

    // « Garder » : la question reste, ses signalements se referment.
    await signaler(lea, 1)
    assert.equal((await poster(banc, admin, '/api/admin/campagne/garder', { questionId: qs[1].id })).status, 200)
    // « Retirer » : plus personne ne la tire, même après un redémarrage.
    assert.equal((await poster(banc, admin, '/api/admin/campagne/retirer', { questionId: qs[0].id })).status, 200)
    const apres = (await lire(banc, admin, '/api/admin/campagne')).corps
    assert.deepEqual([apres.jouables, apres.retirees, apres.signalements], [19, 1, []])
    await banc.redemarrer()
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.questions, 19)
    const neuve = (await poster(banc, lea, '/api/campagne/serie')).corps
    assert.ok(!questionsDe(banc, neuve.id).some(q => q.id === qs[0].id), 'la question retirée ne sort plus')
    assert.equal((await poster(banc, admin, '/api/admin/campagne/retirer', { questionId: 'inconnue' })).status, 400)
  } finally {
    await banc.close()
  }
})

test('l’expérience de campagne paie chaque bonne réponse, sans plafond, et ne fait pas une soirée', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(10) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const moi = async () => (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    const depart = await moi()
    /** Une série entière, toutes ses réponses justes : ce que chacune a rapporté. */
    const toutJuste = async () => {
      const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
      const gains: number[] = []
      for (let i = 0; i < serie.total; i++) gains.push((await repondre(banc, lea, serie.id, i, true)).corps.xp)
      return gains
    }
    // Vingt bonnes réponses le même jour : toutes paient double — il y avait
    // un plafond à quinze —, puis la suite au prix simple, sans plafond.
    const gains = [...(await toutJuste()), ...(await toutJuste())]
    assert.equal(gains.length, 20)
    assert.deepEqual(gains, Array(20).fill(2 * XP_PAR_JUSTE), 'les vingt premières du jour paient double')
    assert.deepEqual(await toutJuste(), Array(10).fill(XP_PAR_JUSTE), 'la vingt et unième paie encore, au prix simple')
    const plein = await moi()
    // Et L'Alpiniste · Bronze, une série de dix justes : un palier de la
    // campagne paie comme tout palier (le 5 octobre 2026).
    assert.equal(plein.xp, depart.xp + 20 * 2 * XP_PAR_JUSTE + 10 * XP_PAR_JUSTE + XP_PALIER[0])
    assert.equal(plein.boutique.confettis.gagnes, depart.boutique.confettis.gagnes + 30, 'un confetti chacune')
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.xpAujourdhui, xpDuJourDeCampagne(30))
    // La campagne n'est pas une soirée : l'historique ne la compte pas.
    assert.ok(Array.isArray(plein.soirees))
    assert.deepEqual(plein.soirees, depart.soirees, 'pas de soirée de plus')
    // Le lendemain, le compteur repart.
    horloge.t += 24 * 3_600_000
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.xpAujourdhui, 0)
    const demain = await toutJuste()
    assert.equal(demain[0], 2 * XP_PAR_JUSTE, 'le lendemain, les vingt premières repartent')
    assert.equal((await moi()).xp, depart.xp + xpDuJourDeCampagne(30) + xpDuJourDeCampagne(10) + XP_PALIER[0], 'le palier ne paie qu’une fois')
  } finally {
    await banc.close()
  }
})

// Les signalements de la campagne, côté administrateur (`/admin#campagne`) :
// qui signale une question — son prénom, son identifiant —, ce qu'il en dit,
// où il l'a jouée et ce qu'il y a répondu, à côté de ce que disent toutes
// les réponses de campagne. Puis, au-delà de « Garder » et « Retirer » :
// corriger la question (la remarque du propriétaire du 5 octobre 2026).
//
// Une correction garde l'identifiant de la question tant que la bonne
// réponse reste la même — une coquille, un leurre ambigu remplacé, une
// anecdote reprise : ses réponses passées et sa difficulté mesurée la
// suivent. Une autre bonne réponse, et ce n'est plus la même question : elle
// repart sous un identifiant neuf, l'ancienne est retirée (CLAUDE.md, « Une
// question de la base de la campagne garde son identifiant »). Rangée dans
// Turso, la correction se joue tout de suite et survit au réveil ; les séries
// déjà tirées gardent la version qu'elles ont lue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { bonneReponseChange, niveauDeQuestion } from '../../shared/campagne'
import { leurresApres } from '../src/core/campagne'

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
/** La difficulté mesurée se relit toutes les dix minutes : on avance l'horloge d'autant pour la lire à jour. */
const RELECTURE_DES_MESURES = 11 * 60_000

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))

interface QuestionGardee {
  id: string
  texte: string
  reponses: string[]
  bonne: number
  anecdote: string | null
}

/** Les questions d'une série ou d'une épreuve, telles que la base permanente les garde : la bonne réponse avec. */
function questionsDe(banc: Banc, serie: string): QuestionGardee[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return JSON.parse(r.questions)
  } finally {
    db.close()
  }
}

/** Une correction rangée, telle que Turso la garde. */
function correctionRangee(banc: Banc, questionId: string): any {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT entree FROM campagne_corrections WHERE question_id = ?').get(questionId) as { entree: string } | undefined
    return r ? JSON.parse(r.entree) : null
  } finally {
    db.close()
  }
}

/**
 * Joue une série — ou une épreuve, `chemin` le dit — jusqu'à la question
 * `cible`, juste à chaque fois, puis y répond `choix` : rend sa position.
 */
async function jouerJusqua(banc: Banc, cookie: string, chemin: 'serie' | 'epreuve', id: string, cible: string, choix: (q: QuestionGardee) => number): Promise<number> {
  const qs = questionsDe(banc, id)
  const position = qs.findIndex(q => q.id === cible)
  assert.ok(position >= 0, 'la question visée est dans la série')
  for (let i = 0; i <= position; i++) {
    const r = await poster(banc, cookie, `/api/campagne/${chemin}/${id}/reponse`, { index: i, choix: i === position ? choix(qs[i]) : qs[i].bonne })
    assert.equal(r.status, 200, r.corps.error)
  }
  return position
}

const signaler = (banc: Banc, cookie: string, serie: string, index: number, texte: string) =>
  poster(banc, cookie, `/api/campagne/serie/${serie}/signalement`, { index, texte })

test('une correction change la bonne réponse quand la réponse juste change — pas pour la casse, les accents, la ponctuation ou l’ordre', () => {
  const avant = { reponses: ['Saint-Malo', 'Brest', 'Lorient', 'Vannes'], bonne: 0 }
  assert.equal(bonneReponseChange(avant, { reponses: ['Brest', 'saint malo', 'Lorient', 'Vannes'], bonne: 1 }), false, 'la même réponse, ailleurs et autrement écrite')
  assert.equal(bonneReponseChange(avant, { reponses: ['Saint-Malo', 'Quimper', 'Lorient', 'Vannes'], bonne: 0 }), false, 'un leurre remplacé')
  assert.equal(bonneReponseChange(avant, { reponses: ['Saint-Malo', 'Brest', 'Lorient', 'Vannes'], bonne: 1 }), true, 'une autre réponse marquée juste')
  assert.equal(bonneReponseChange(avant, { reponses: ['Saint-Brieuc', 'Brest', 'Lorient', 'Vannes'], bonne: 0 }), true, 'la réponse juste réécrite')
  assert.equal(bonneReponseChange({ reponses: ['Vrai', 'Faux'], bonne: 0 }, { reponses: ['Vrai', 'Faux'], bonne: 1 }), true, 'un vrai devenu faux')
})

test('les leurres suivent les réponses corrigées : les nouvelles d’abord, l’ôtée n’en est plus, la juste jamais', () => {
  const avant = baseDEssai(1).questions[0]
  assert.deepEqual(avant.reponses, ['Bonne 0', 'Autre A0', 'Autre B0', 'Autre C0'])
  assert.deepEqual(avant.meta.leurres, ['Autre A0', 'Autre B0', 'Autre C0', 'Autre D0', 'Autre E0', 'Autre F0'])
  // « La B est juste aussi » : on la remplace par une vraie fausse.
  assert.deepEqual(leurresApres(avant, { texte: avant.texte, reponses: ['Bonne 0', 'Autre A0', 'Nouvelle', 'Autre C0'], bonne: 0, anecdote: null }), [
    'Autre A0',
    'Nouvelle',
    'Autre C0',
    'Autre D0',
    'Autre E0',
    'Autre F0',
  ])
  // Un leurre qu'on ne montrait pas devient la bonne réponse, à la place d'une
  // mauvaise : il n'en est plus un, l'ancienne bonne le devient, l'ôtée non plus.
  assert.deepEqual(leurresApres(avant, { texte: avant.texte, reponses: ['Bonne 0', 'Autre A0', 'Autre B0', 'Autre D0'], bonne: 3, anecdote: null }), [
    'Bonne 0',
    'Autre A0',
    'Autre B0',
    'Autre E0',
    'Autre F0',
  ])
})

test('l’administrateur voit qui signale une question, où il l’a jouée, ce qu’il y a répondu, et ce qu’en disent toutes les réponses', async () => {
  const horloge = { t: DEBUT }
  // Seize questions d'Histoire : une série les tire toutes, une épreuve des mythologies aussi.
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(16) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    const admin = await connexionAnimateur(banc.url)

    // Léa, en série, se trompe sur la question visée et la signale.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const cible = questionsDe(banc, serie.id)[3]
    const fausse = (q: QuestionGardee) => (q.bonne + 1) % q.reponses.length
    const sonChoix = cible.reponses[fausse(cible)]
    const ici = await jouerJusqua(banc, lea, 'serie', serie.id, cible.id, fausse)
    assert.equal((await signaler(banc, lea, serie.id, ici, 'La réponse qu’on dit fausse est juste aussi')).status, 200)

    // Bob, sur le sentier des mythologies, la trouve et la signale quand même.
    horloge.t += 60_000
    const epreuve = (await poster(banc, bob, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 })).corps
    const la = await jouerJusqua(banc, bob, 'epreuve', epreuve.id, cible.id, q => q.bonne)
    assert.equal((await signaler(banc, bob, epreuve.id, la, 'L’anecdote se trompe de siècle')).status, 200)

    horloge.t += RELECTURE_DES_MESURES
    const etat = await lire(banc, admin, '/api/admin/campagne')
    assert.equal(etat.status, 200, etat.corps.error)
    assert.equal(etat.corps.signalements.length, 1)
    const s = etat.corps.signalements[0]
    assert.equal(s.questionId, cible.id)
    assert.equal(s.joueurs, 2)
    assert.deepEqual(s.mesure, { justes: 1, total: 2 }, 'les réponses de campagne : Léa s’est trompée, Bob a trouvé')
    assert.equal(s.niveau, niveauDeQuestion(s.difficulte, { justes: 1, total: 2 }))
    assert.deepEqual([s.origine, s.corrigeeLe, s.retiree], ['depot', null, undefined])
    // Le plus récent d'abord : Bob, sur son sentier, puis Léa, en série.
    const [deBob, deLea] = s.rapports
    assert.deepEqual(
      [deBob.prenom, deBob.login, deBob.ou, deBob.branche, deBob.palier, deBob.juste, deBob.reponse, deBob.texte, deBob.traiteLe],
      ['Bob', 'bob', 'sentier', 'mythes', 1, true, cible.reponses[cible.bonne], 'L’anecdote se trompe de siècle', null],
    )
    assert.deepEqual(
      [deLea.prenom, deLea.login, deLea.ou, deLea.juste, deLea.reponse, deLea.texte],
      ['Léa', 'lea', 'serie', false, sonChoix, 'La réponse qu’on dit fausse est juste aussi'],
      'sa réponse, telle qu’elle l’a lue dans sa série — mélangée',
    )
    assert.equal(deLea.versionDAvant, undefined, 'elle a lu la version de la base')

    // « Garder » referme les deux ; un troisième signalement les fait relire avec lui.
    assert.equal((await poster(banc, admin, '/api/admin/campagne/garder', { questionId: cible.id })).status, 200)
    assert.deepEqual((await lire(banc, admin, '/api/admin/campagne')).corps.signalements, [])
    const carl = await inscrireProfil(banc.url, 'carl', 'Carl')
    horloge.t += 60_000
    const sienne = (await poster(banc, carl, '/api/campagne/serie')).corps
    const position = await jouerJusqua(banc, carl, 'serie', sienne.id, cible.id, q => q.bonne)
    await signaler(banc, carl, sienne.id, position, 'Deux réponses justes')
    const relue = (await lire(banc, admin, '/api/admin/campagne')).corps.signalements[0]
    assert.equal(relue.joueurs, 1, 'un seul à relire')
    assert.deepEqual(
      relue.rapports.map((r: any) => [r.prenom, r.traiteLe === null]),
      [
        ['Carl', true],
        ['Bob', false],
        ['Léa', false],
      ],
      'ceux déjà relus, avec',
    )
  } finally {
    await banc.close()
  }
})

test('corriger une coquille ou un leurre : la question garde son identifiant, se joue corrigée tout de suite, et après le réveil', async () => {
  const horloge = { t: DEBUT }
  const base = baseDEssai(20)
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    const admin = await connexionAnimateur(banc.url)
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const cible = questionsDe(banc, serie.id)[0]
    const avant = base.parId.get(cible.id)!
    await jouerJusqua(banc, lea, 'serie', serie.id, cible.id, q => q.bonne)
    await signaler(banc, lea, serie.id, 0, '« Autre A » est juste aussi, et une faute dans l’intitulé')
    // Bob a déjà tiré sa série : elle garde la version qu'elle a lue.
    const tiree = (await poster(banc, bob, '/api/campagne/serie')).corps

    const correction = {
      texte: `${avant.texte.replace('laquelle', 'laquelle donc')}`,
      reponses: [avant.reponses[0], 'Une vraie fausse', avant.reponses[2], avant.reponses[3]],
      bonne: 0,
      anecdote: 'Une anecdote reprise.',
    }
    const fait = await poster(banc, admin, '/api/admin/campagne/corriger', { questionId: cible.id, correction })
    assert.equal(fait.status, 200, fait.corps.error)
    assert.deepEqual(fait.corps, { id: cible.id, nouvelle: false })
    const apres = (await lire(banc, admin, '/api/admin/campagne')).corps
    assert.deepEqual([apres.signalements, apres.questions, apres.jouables, apres.retirees], [[], 20, 20, 0], 'refermée, rien de retiré')

    // Rangée avec ses leurres : le remplacé n'en est plus un, sa fiche reste la même.
    const rangee = correctionRangee(banc, cible.id)
    assert.equal(rangee.id, cible.id)
    assert.ok(!rangee.leurres.includes(avant.reponses[1]) && rangee.leurres.includes('Une vraie fausse'))
    assert.deepEqual([rangee.sousTheme, rangee.difficulte, rangee.explication], [avant.meta.sousTheme, avant.meta.difficulte, avant.meta.explication])

    // La série suivante la pose corrigée ; celle de Bob, tirée avant, garde l'ancienne.
    const neuve = (await poster(banc, lea, '/api/campagne/serie')).corps
    const posee = questionsDe(banc, neuve.id).find(q => q.id === cible.id)!
    assert.deepEqual(
      [posee.texte, [...posee.reponses].sort(), posee.reponses[posee.bonne], posee.anecdote],
      [correction.texte, [...correction.reponses].sort(), avant.reponses[0], 'Une anecdote reprise.'],
    )
    assert.equal(questionsDe(banc, tiree.id).find(q => q.id === cible.id)!.texte, avant.texte)

    // Bob la joue dans sa version d'avant et la signale : l'administration le sait.
    horloge.t += 60_000
    const position = await jouerJusqua(banc, bob, 'serie', tiree.id, cible.id, q => q.bonne)
    await signaler(banc, bob, tiree.id, position, 'Encore une faute')
    const signalee = (await lire(banc, admin, '/api/admin/campagne')).corps.signalements[0]
    assert.equal(signalee.texte, correction.texte, 'la version du jour')
    assert.equal(signalee.origine, 'depot')
    assert.equal(typeof signalee.corrigeeLe, 'number')
    assert.equal(signalee.rapports[0].versionDAvant, true, 'Bob a lu la version d’avant')

    // Au réveil, sur un disque effacé : toujours corrigée.
    await banc.redemarrer({ disqueEfface: true })
    const reveil = (await poster(banc, lea, '/api/campagne/serie')).corps
    assert.equal(questionsDe(banc, reveil.id).find(q => q.id === cible.id)!.texte, correction.texte)
  } finally {
    await banc.close()
  }
})

test('quand la bonne réponse change, la question repart sous un nouvel identifiant et l’ancienne est retirée', async () => {
  const horloge = { t: DEBUT }
  const base = baseDEssai(20)
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    const admin = await connexionAnimateur(banc.url)
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const cible = questionsDe(banc, serie.id)[0]
    const avant = base.parId.get(cible.id)!
    await jouerJusqua(banc, lea, 'serie', serie.id, cible.id, q => (q.bonne + 1) % 4)
    await signaler(banc, lea, serie.id, 0, 'La bonne réponse est la deuxième')
    const tiree = (await poster(banc, bob, '/api/campagne/serie')).corps

    // La deuxième réponse était la bonne.
    const correction = { texte: avant.texte, reponses: [...avant.reponses], bonne: 1, anecdote: avant.anecdote }
    const fait = await poster(banc, admin, '/api/admin/campagne/corriger', { questionId: cible.id, correction })
    assert.equal(fait.status, 200, fait.corps.error)
    assert.equal(fait.corps.nouvelle, true)
    const neuf = fait.corps.id
    assert.match(neuf, /^[a-z0-9]{8}$/)
    assert.notEqual(neuf, cible.id)
    const apres = (await lire(banc, admin, '/api/admin/campagne')).corps
    assert.deepEqual([apres.signalements, apres.questions, apres.jouables, apres.retirees], [[], 21, 20, 1], 'l’ancienne retirée, la neuve jouable')
    // Ce qui justifiait l'ancienne réponse ne la suit pas.
    const rangee = correctionRangee(banc, cible.id)
    assert.deepEqual([rangee.id, rangee.bonne, rangee.explication, rangee.valeur, rangee.date], [neuf, 1, '', null, null])
    assert.ok(rangee.leurres.includes(avant.reponses[0]) && !rangee.leurres.includes(avant.reponses[1]))

    // Les séries suivantes posent la neuve, jamais l'ancienne.
    const neuve = (await poster(banc, lea, '/api/campagne/serie')).corps
    const ids = questionsDe(banc, neuve.id).map(q => q.id)
    assert.ok(ids.includes(neuf) && !ids.includes(cible.id))
    // L'ancienne ne se corrige plus : elle est retirée.
    assert.match((await poster(banc, admin, '/api/admin/campagne/corriger', { questionId: cible.id, correction })).corps.error, /retirée/)

    // Bob la signale dans la version que sa série avait tirée : l'administration la dit retirée.
    horloge.t += 60_000
    const position = await jouerJusqua(banc, bob, 'serie', tiree.id, cible.id, q => q.bonne)
    await signaler(banc, bob, tiree.id, position, 'La réponse est fausse')
    const signalee = (await lire(banc, admin, '/api/admin/campagne')).corps.signalements[0]
    assert.deepEqual([signalee.questionId, signalee.retiree], [cible.id, true])

    // Une remplaçante se corrige comme les autres, sous son identifiant.
    const coquille = { ...correction, texte: `${avant.texte.replace('laquelle', 'laquelle donc')}` }
    assert.deepEqual((await poster(banc, admin, '/api/admin/campagne/corriger', { questionId: neuf, correction: coquille })).corps, { id: neuf, nouvelle: false })
    await banc.redemarrer({ disqueEfface: true })
    const reveil = (await poster(banc, lea, '/api/campagne/serie')).corps
    const posee = questionsDe(banc, reveil.id).find(q => q.id === neuf)!
    assert.deepEqual([posee.texte, posee.reponses[posee.bonne]], [coquille.texte, avant.reponses[1]])
    assert.ok(!questionsDe(banc, reveil.id).some(q => q.id === cible.id), 'l’ancienne reste retirée au réveil')
    assert.equal((await lire(banc, await connexionAnimateur(banc.url), '/api/admin/campagne')).corps.retirees, 1)
  } finally {
    await banc.close()
  }
})

test('une correction que le juge de la base refuse ne change rien, et le dit', async () => {
  const base = baseDEssai(20)
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: base })
  try {
    const admin = await connexionAnimateur(banc.url)
    const q = base.questions[0]
    const corriger = (questionId: string, correction: unknown) => poster(banc, admin, '/api/admin/campagne/corriger', { questionId, correction })
    const correcte = { texte: q.texte, reponses: [...q.reponses], bonne: 0, anecdote: q.anecdote }

    assert.equal((await corriger('inconnue', correcte)).corps.error, 'Cette question n’est pas dans la base')
    assert.equal((await corriger(q.id, { texte: q.texte })).status, 400, 'pas une correction')
    assert.equal((await corriger(q.id, { ...correcte, texte: ` ${q.texte} ` })).corps.error, 'Rien n’a changé : « Garder » referme ses signalements')
    const refus = async (correction: unknown, motif: RegExp) => {
      const r = await corriger(q.id, correction)
      assert.equal(r.status, 400)
      assert.match(r.corps.error, motif)
    }
    await refus({ ...correcte, reponses: [q.reponses[0], q.reponses[1], q.reponses[1], q.reponses[3]] }, /^Correction refusée : deux réponses identiques$/)
    await refus({ ...correcte, texte: `${q.texte} ${q.reponses[0]}` }, /la bonne réponse est écrite dans l’intitulé/)
    await refus({ ...correcte, reponses: q.reponses.slice(0, 3) }, /quatre réponses/)
    await refus({ ...correcte, texte: base.questions[1].texte }, /déjà celui d’une autre question de la campagne/)
    // Rien n'a bougé.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
    try {
      assert.equal((db.prepare('SELECT COUNT(*) AS n FROM campagne_corrections').get() as { n: number }).n, 0)
    } finally {
      db.close()
    }
    // Un intitulé collé sur deux lignes, des espaces en trop : remis sur une ligne, pas refusé.
    const collee = await corriger(q.id, { ...correcte, texte: q.texte.replace(' : ', ' :\n  '), anecdote: '  ' })
    assert.equal(collee.status, 200, collee.corps.error)
    assert.deepEqual([correctionRangee(banc, q.id).texte, correctionRangee(banc, q.id).anecdote], [q.texte, null])
  } finally {
    await banc.close()
  }
})

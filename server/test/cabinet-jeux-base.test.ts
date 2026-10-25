// Les quatre jeux du Cabinet qui posent une question de la base de la
// campagne — le Pari, l'Éclair, le Mot mystère, le Filet —, par leurs règles
// pures (`shared/cabinet/jeux/`). Ce que la conception exige d'eux : les deux
// étapes du Pari, l'étoile gardée à « Quitter », sa seconde question tirée au
// départ et jamais montrée avant « Parier » ; l'Éclair, ses cinq affirmations
// jugées ensemble et rien de leur vérité avant le verdict ; les couleurs du
// Mot mystère et leurs lettres doubles, le souffle, la longueur d'un mot ; la
// piste du Filet qui ne met jamais la réponse sous le curseur, le bord du
// filet que la virgule flottante ne départage pas (invariant 15), la zone
// d'Éclairer qui contient toujours la réponse.
//
// Le moule commun (`RegleDuJeu`, `regle.ts`) dit comment le pli s'en sert :
// `tranche` d'abord — oui, le geste va à `juger` ; non, à `apresLeGeste`. Ces
// épreuves jouent les règles comme le pli les jouera. Les mêmes jeux par les
// routes viendront avec le serveur du Cabinet.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hasardDe } from '../../shared/missions'
import { ecartEstimation } from '../../shared/classement'
import * as B from '../../shared/cabinet/bareme'
import { refusDuPouvoir, effacablesAuPlus } from '../../shared/cabinet/pouvoirs'
import { deplier, idDeLEclair, PREFIXE_DU_CABINET } from '../../shared/cabinet/pieces'
import { justeDeLaPiece, type RegleDuJeu, type VerdictDUneManche } from '../../shared/cabinet/jeux/regle'
import { GESTE_A_JUGER, type QuestionTiree } from '../../shared/cabinet/jeux/deLaBase'
import { REGLE_DU_PARI, type EtatDuPari, type PariTire } from '../../shared/cabinet/jeux/pari'
import { REGLE_DE_L_ECLAIR, affirmationDe, type EclairTire } from '../../shared/cabinet/jeux/eclair'
import { REGLE_DU_MOT, couleursDuMot, etatDesTouches, motDeLaQuestion, type MotTire } from '../../shared/cabinet/jeux/mot'
import {
  REGLE_DU_FILET,
  dansLeFilet,
  demiLargeur,
  milieuDeLaPiste,
  pisteDuFilet,
  seTendAuFilet,
  type FiletTire,
  type PisteDuFilet,
} from '../../shared/cabinet/jeux/filet'

// ── Les pièces d'essai ──────────────────────────────────────────────────

const qcm = (id: string, bonne: number, o: Partial<QuestionTiree> = {}): QuestionTiree => ({
  id,
  texte: `Quelle est la réponse ${id} ?`,
  reponses: ['Riga', 'Vilnius', 'Tallinn', 'Minsk'],
  bonne,
  categorie: 'Géographie',
  anecdote: `Le savais-tu de ${id}.`,
  niveau: 'facile',
  ...o,
})

/** Le refus d'Éclairer quand la manche n'a plus rien à souffler : celui de la seule règle des pouvoirs. */
const RIEN_A_ECLAIRER = refusDuPouvoir({ pouvoir: 'eclairer', force: 1, jeu: 'pari', servi: 0, aEclairer: false })

/**
 * Un geste joué comme le pli le jouera : lu, puis `tranche` dit s'il va à
 * `juger` (le verdict) ou à `apresLeGeste` (l'état d'après, ou son refus).
 */
function jouer<T, E, G>(r: RegleDuJeu<T, E, G, unknown, unknown>, t: T, e: E, brut: unknown): { etat: E } | { verdict: VerdictDUneManche } | { refus: string } {
  const g = r.lireLeGeste(brut, t)
  assert.ok(g !== null, `illisible : ${JSON.stringify(brut)}`)
  if (r.tranche!(t, e, g)) return { verdict: r.juger(t, e, g) }
  const apres = r.apresLeGeste(t, e, g)
  return typeof apres === 'string' ? { refus: apres } : { etat: apres }
}
const etatDe = <E>(x: { etat: E } | { verdict: VerdictDUneManche } | { refus: string }): E => {
  assert.ok('etat' in x, `un état attendu : ${JSON.stringify(x)}`)
  return x.etat
}
const verdictDe = (x: { verdict: VerdictDUneManche } | object): VerdictDUneManche => {
  assert.ok('verdict' in x, `un verdict attendu : ${JSON.stringify(x)}`)
  return x.verdict as VerdictDUneManche
}
const refusDe = (x: { refus: string } | object): string => {
  assert.ok('refus' in x, `un refus attendu : ${JSON.stringify(x)}`)
  return x.refus as string
}
const eclaire = <E>(r: { eclairer(t: never, e: E, h: () => number, c?: number): E | string }, t: unknown, e: E, graine: string, cible?: number): E => {
  const x = r.eclairer(t as never, e, hasardDe(graine), cible)
  assert.ok(typeof x !== 'string', `Éclairer refusé : ${x}`)
  return x
}

test('les quatre règles suivent le moule : leur clé, leurs étapes, leurs durées', () => {
  const regles = [REGLE_DU_PARI, REGLE_DE_L_ECLAIR, REGLE_DU_MOT, REGLE_DU_FILET]
  assert.deepEqual(
    regles.map(r => r.cle),
    ['pari', 'eclair', 'mot', 'filet'],
  )
  for (const r of regles) {
    assert.equal(r.etapes, r.cle === 'pari' ? 2 : 1, r.cle)
    assert.equal(r.dureeMs(1), B.DUREES_DES_JEUX[r.cle] * 1000, `${r.cle} : sa durée vient du barème`)
    assert.equal(typeof r.tranche, 'function', `${r.cle} : le pli demande d'abord si le geste tranche`)
  }
  // Le Pari a un chrono par étape, le même.
  assert.equal(REGLE_DU_PARI.dureeMs(2), B.DUREES_DES_JEUX.pari * 1000)
  // Éclairer sans rien à souffler se refuse par la seule règle des pouvoirs, en mots.
  assert.equal(RIEN_A_ECLAIRER, 'Ce jeu n’a plus rien à éclairer')
})

test('les règles sont pures : ni horloge, ni hasard que la graine ne redonne', () => {
  // Une échéance se lit à l'heure du serveur (invariant 6), le hasard d'Éclairer à la graine de la partie :
  // recharger redonne la même réponse effacée, la même lettre, la même zone.
  for (const f of ['deLaBase', 'pari', 'eclair', 'mot', 'filet']) {
    const texte = readFileSync(new URL(`../../shared/cabinet/jeux/${f}.ts`, import.meta.url), 'utf8')
    assert.doesNotMatch(texte, /Date\.now\(|new Date\(|Math\.random\(/, `${f}.ts`)
  }
})

// ── Le Pari ─────────────────────────────────────────────────────────────

const PARI: PariTire = {
  jeu: 'pari',
  q1: qcm('q1', 1, { texte: 'Quelle est la capitale de la Lituanie ?', reponses: ['Riga', 'Vilnius', 'Tallinn', 'Minsk'] }),
  q2: qcm('q2', 3, {
    texte: 'Quel fleuve traverse Kaunas ?',
    reponses: ['La Daugava', 'Le Dniepr', 'La Vistule', 'Le Niémen'],
    niveau: 'difficile',
    anecdote: 'Le Niémen se jette dans la Baltique.',
  }),
}
const repondre = (choix?: number) => ({ quoi: 'repondre', ...(choix !== undefined && { reponse: { pari: { choix } } }) })

test('le Pari : juste, il garde une étoile ou la parie — deux étapes, chacune sa question', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  assert.equal(ouvert.etape, 1)
  assert.equal(ouvert.auChoix, false)

  // Juste à la première : la manche n'est pas tranchée, il choisit.
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  assert.equal(auChoix.auChoix, true, 'juste : il garde ou il parie')
  assert.equal(auChoix.etape, 1)

  // Garder : une étoile, une pièce — la première, juste.
  const garde = verdictDe(jouer(r, PARI, auChoix, { quoi: 'garder' }))
  assert.equal(garde.naturel, B.ETOILES_DU_PARI.garder)
  assert.deepEqual(garde.pieces, [{ juste: true, choix: 1, composee: null, etape: 1 }])

  // Parier : la seconde question, son chrono ; réussie, trois étoiles et deux pièces justes.
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  assert.equal(pari.etape, 2)
  assert.equal(pari.auChoix, false)
  const gagne = verdictDe(jouer(r, PARI, pari, repondre(3)))
  assert.equal(gagne.naturel, B.ETOILES_DU_PARI.parier)
  assert.deepEqual(gagne.pieces, [
    { juste: true, choix: 1, composee: null, etape: 1 },
    { juste: true, choix: 3, composee: null, etape: 2 },
  ])
  // Ratée, rien — mais la première reste une juste : chaque pièce se juge à sa bonne réponse.
  const perdu = verdictDe(jouer(r, PARI, pari, repondre(0)))
  assert.equal(perdu.naturel, 0)
  assert.deepEqual(perdu.pieces.map(p => [p.juste, p.choix]), [[true, 1], [false, 0]])
  assert.deepEqual(perdu.pieces.map(p => justeDeLaPiece(perdu.naturel, 'pari') ?? p.juste), [true, false], 'au Pari, la juste suit la bonne réponse')

  // Fausse à la première : tranchée, zéro, une pièce.
  const rate = verdictDe(jouer(r, PARI, ouvert, repondre(2)))
  assert.equal(rate.naturel, 0)
  assert.deepEqual(rate.pieces, [{ juste: false, choix: 2, composee: null, etape: 1 }])
  // Envoyée sans réponse, à l'échéance : zéro, et rien de choisi.
  assert.deepEqual(verdictDe(jouer(r, PARI, ouvert, repondre())).pieces, [{ juste: false, choix: null, composee: null, etape: 1 }])
})

test('le Pari : laissé au choix puis quitté, l’étoile est gardée ; quitté ailleurs, rien', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  for (const fin of ['quittee', 'expiree'] as const) {
    // Il l'avait gagnée : quitter au choix, ou la partie close le lendemain, la garde.
    assert.deepEqual(r.juger(PARI, auChoix, fin), { naturel: B.ETOILES_DU_PARI.garder, pieces: [{ juste: true, choix: 1, composee: null, etape: 1 }] }, fin)
    // Pas encore répondu : zéro, et la pièce s'écrit sans choix — il l'a vue.
    assert.deepEqual(r.juger(PARI, ouvert, fin), { naturel: 0, pieces: [{ juste: false, choix: null, composee: null, etape: 1 }] }, fin)
    // Le pari fait, pas répondu : zéro, la seconde sans choix.
    const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
    assert.deepEqual(r.juger(PARI, pari, fin).pieces.map(p => [p.juste, p.choix, p.etape]), [[true, 1, 1], [false, null, 2]], fin)
    assert.equal(r.juger(PARI, pari, fin).naturel, 0)
  }
  // Ce qu'une réponse arrivée trop tard portait ne compte pas : `expiree` ne lit rien d'elle.
  assert.deepEqual(r.juger(PARI, ouvert, 'expiree').pieces[0].choix, null)
})

test('le Pari : chaque geste à son moment, refusé en mots sinon', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  assert.equal(refusDe(jouer(r, PARI, ouvert, { quoi: 'garder' })), 'Réponds d’abord à la question')
  assert.equal(refusDe(jouer(r, PARI, ouvert, { quoi: 'parier' })), 'Réponds d’abord à la question')
  assert.equal(refusDe(jouer(r, PARI, auChoix, repondre(2))), 'Garde ton étoile, ou parie-la')
  assert.equal(refusDe(jouer(r, PARI, pari, { quoi: 'garder' })), 'Le pari est fait : réponds à la question')
  assert.equal(refusDe(jouer(r, PARI, pari, { quoi: 'parier' })), 'Le pari est fait : réponds à la question')
  // Un geste qui tranche ne passe jamais par `apresLeGeste` : s'il s'y perd, il se refuse sans rien changer.
  assert.equal(r.apresLeGeste(PARI, ouvert, { quoi: 'repondre', choix: 2 }), GESTE_A_JUGER)
  assert.equal(r.apresLeGeste(PARI, auChoix, { quoi: 'garder' }), GESTE_A_JUGER)
})

test('le Pari : ce que la page envoie se relit champ par champ', () => {
  const r = REGLE_DU_PARI
  assert.deepEqual(r.lireLeGeste(repondre(2), PARI), { quoi: 'repondre', choix: 2 })
  assert.deepEqual(r.lireLeGeste({ quoi: 'repondre', auto: true }, PARI), { quoi: 'repondre', choix: null })
  assert.deepEqual(r.lireLeGeste({ quoi: 'garder', manche: 1 }, PARI), { quoi: 'garder' })
  assert.deepEqual(r.lireLeGeste({ quoi: 'parier' }, PARI), { quoi: 'parier' })
  for (const brut of [
    null,
    'garder',
    [],
    { quoi: 'essai', lettres: 'RIGA' },
    { quoi: 'repondre', reponse: { pari: { choix: 4 } } },
    { quoi: 'repondre', reponse: { pari: { choix: -1 } } },
    { quoi: 'repondre', reponse: { pari: { choix: 1.5 } } },
    { quoi: 'repondre', reponse: { pari: { choix: '1' } } },
    { quoi: 'repondre', reponse: { filet: { x: 3, taille: 'petit' } } },
    { quoi: 'repondre', reponse: 'Vilnius' },
  ])
    assert.equal(r.lireLeGeste(brut, PARI), null, JSON.stringify(brut))
})

test('le Pari : sa seconde question, tirée au départ, ne part jamais avant « Parier »', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  for (const e of [ouvert, auChoix]) {
    const vue = JSON.stringify(r.montrer(PARI, e))
    for (const secret of [PARI.q2.texte, ...PARI.q2.reponses, PARI.q2.anecdote!]) assert.ok(!vue.includes(secret), `« ${secret} » avant le pari`)
    assert.ok(!vue.includes(PARI.q1.anecdote!), 'l’anecdote attend la révélation')
    assert.ok(!/"bonne"/.test(vue), 'jamais la bonne réponse')
  }
  // Avant sa réponse, ni la bonne ni rien qui la désigne ; au choix, la sienne — juste, le serveur l'a dit.
  assert.deepEqual(r.montrer(PARI, ouvert), { jeu: 'pari', etape: 1, auChoix: false, question: { texte: PARI.q1.texte, reponses: PARI.q1.reponses, categorie: 'Géographie' }, effacees: [] })
  assert.equal(r.montrer(PARI, auChoix).choix, 1)
  // Parier montre la question tirée au départ, telle quelle : rien ne se tire à « Parier ».
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  assert.deepEqual(r.montrer(PARI, pari).question, { texte: PARI.q2.texte, reponses: PARI.q2.reponses, categorie: 'Géographie' })
  assert.ok(!JSON.stringify(r.montrer(PARI, pari)).includes(PARI.q2.anecdote!))
})

test('le Pari : Éclairer efface une mauvaise réponse, deux au plus à chaque étape, jamais au choix', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  assert.equal(effacablesAuPlus(4), 2)
  const une = eclaire(r, PARI, ouvert, 'p:eclairer:2')
  const deux = eclaire(r, PARI, une, 'p:eclairer:3')
  assert.equal(deux.effacees[0].length, 2)
  assert.ok(!deux.effacees[0].includes(PARI.q1.bonne), 'jamais la bonne')
  assert.equal(new Set(deux.effacees[0]).size, 2, 'jamais deux fois la même')
  assert.equal(r.eclairer(PARI, deux, hasardDe('p:eclairer:4')), RIEN_A_ECLAIRER, 'deux sur quatre : il en reste toujours deux')
  // Le hasard vient de la graine : rejoué, le même effacement.
  assert.deepEqual(eclaire(r, PARI, ouvert, 'p:eclairer:2'), une)
  assert.deepEqual(r.montrer(PARI, deux).effacees, deux.effacees[0])
  // Au choix, rien à souffler ; au pari, deux de plus, sur la seconde question.
  const auChoix = etatDe(jouer(r, PARI, deux, repondre(1)))
  assert.equal(r.eclairer(PARI, auChoix, hasardDe('x')), RIEN_A_ECLAIRER)
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  assert.deepEqual(r.montrer(PARI, pari).effacees, [])
  const eclairee = eclaire(r, PARI, pari, 'p:eclairer:5')
  assert.equal(eclairee.effacees[1].length, 1)
  assert.ok(!eclairee.effacees[1].includes(PARI.q2.bonne))
  assert.deepEqual(eclairee.effacees[0], deux.effacees[0], 'la première garde les siennes')
})

test('le Pari : seule la première question, répondue dans les temps et sans aide, est nue', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  const gagne = verdictDe(jouer(r, PARI, pari, repondre(3)))
  const p1 = r.piece(PARI, pari, gagne, { manche: 0, tirage: 0, etape: 1 })
  const p2 = r.piece(PARI, pari, gagne, { manche: 0, tirage: 0, etape: 2 })
  // La nue mesure : ni forme, l'identifiant de la base, la question telle que la partie l'a tirée.
  assert.deepEqual(p1, { ...PARI.q1, cabinet: { jeu: 'pari', manche: 0, tirage: 0, etape: 1 } })
  assert.equal(p1.forme, undefined)
  // La seconde n'est répondue que par qui parie — des joueurs sûrs d'eux : elle ne mesure rien.
  assert.equal(p2.forme, 'pari')
  assert.equal(p2.id, 'q2')
  assert.equal(p2.niveau, 'difficile')
  // Expirée, quittée : une ligne qui compterait fausse à la mesure — sa forme l'en écarte.
  const expiree = r.juger(PARI, ouvert, 'expiree')
  assert.equal(r.piece(PARI, ouvert, expiree, { manche: 1, tirage: 1, etape: 1 }).forme, 'pari')
  // Éclairée : aidée, elle porte sa forme.
  const eclairee = eclaire(r, PARI, ouvert, 'p:eclairer:2')
  const juste = verdictDe(jouer(r, PARI, etatDe(jouer(r, PARI, eclairee, repondre(1))), { quoi: 'garder' }))
  assert.equal(r.piece(PARI, eclairee, juste, { manche: 0, tirage: 0, etape: 1 }).forme, 'pari')
  // La pièce garde ses réponses à part : la retoucher ne retouche pas le plan figé.
  assert.notEqual(p1.reponses, PARI.q1.reponses)
})

test('le Pari : la révélation dit ce qui s’est passé, chaque réponse marquée', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  const titre = (e: EtatDuPari, v: VerdictDUneManche) => r.reveler(PARI, e, v).titre
  assert.equal(titre(auChoix, verdictDe(jouer(r, PARI, auChoix, { quoi: 'garder' }))), 'Étoile gardée')
  assert.equal(titre(pari, verdictDe(jouer(r, PARI, pari, repondre(3)))), 'Pari gagné !')
  assert.equal(titre(pari, verdictDe(jouer(r, PARI, pari, repondre(0)))), 'Pari perdu')
  assert.equal(titre(ouvert, verdictDe(jouer(r, PARI, ouvert, repondre(0)))), 'Raté')
  assert.equal(titre(ouvert, r.juger(PARI, ouvert, 'expiree')), 'Pas de réponse')
  const revele = r.reveler(PARI, pari, verdictDe(jouer(r, PARI, pari, repondre(0))))
  assert.deepEqual(revele.questions, [
    { texte: PARI.q1.texte, reponses: PARI.q1.reponses, bonne: 1, choix: 1 },
    { texte: PARI.q2.texte, reponses: PARI.q2.reponses, bonne: 3, choix: 0 },
  ])
  assert.equal(revele.savais, PARI.q2.anecdote, 'le savais-tu de la question qui a tranché')
  assert.deepEqual(r.cartel(PARI, verdictDe(jouer(r, PARI, pari, repondre(3)))), { sujet: PARI.q2.texte, reponse: 'Le Niémen', anecdote: PARI.q2.anecdote })
})

// ── L'Éclair ────────────────────────────────────────────────────────────

const CINQ = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id, i) =>
  qcm(id, 0, { texte: `Affirmation ${id} ?`, reponses: [`Bonne ${id}`, `Mauvaise ${id} a`, `Mauvaise ${id} b`, `Mauvaise ${id} c`], niveau: i === 3 ? 'moyen' : 'facile', anecdote: i === 0 ? null : `Le savais-tu de ${id}.` }),
)
// Vraies, fausse, vraie, fausse, vraie.
const ECLAIR: EclairTire = { jeu: 'eclair', affirmations: CINQ.map((question, i) => ({ question, proposee: i % 2 === 0 ? 0 : 2 })) }
const eclair = (reponses?: (boolean | null)[]) => ({ quoi: 'repondre', ...(reponses && { reponse: { eclair: { reponses } } }) })

test('l’Éclair : une affirmation propose la bonne réponse une fois sur deux, sinon une des mauvaises', () => {
  let vraies = 0
  for (let n = 0; n < 1000; n++) {
    const a = affirmationDe(CINQ[0], hasardDe(`affirmation:${n}`))
    if (a.proposee === CINQ[0].bonne) vraies++
    else assert.ok(a.proposee >= 0 && a.proposee < 4)
    assert.equal(a.question, CINQ[0])
  }
  assert.ok(Math.abs(vraies / 1000 - B.PART_DES_VRAIES) < 0.05, `${vraies} vraies sur 1000`)
  assert.deepEqual(affirmationDe(CINQ[0], hasardDe('même')), affirmationDe(CINQ[0], hasardDe('même')), 'la même graine, la même affirmation')
})

test('l’Éclair : les cinq se jugent ensemble — les non répondues comptent fausses', () => {
  const r = REGLE_DE_L_ECLAIR
  const e = r.ouvrir(ECLAIR)
  const v = (reponses?: (boolean | null)[]) => verdictDe(jouer(r, ECLAIR, e, eclair(reponses)))
  const justes = [true, false, true, false, true]
  assert.deepEqual(v(justes), { naturel: 3, pieces: [{ juste: true, choix: 0, composee: 'VFVFV' }] })
  assert.deepEqual(v([true, false, true, false, false]), { naturel: 2, pieces: [{ juste: true, choix: 0, composee: 'VFVFF' }] })
  assert.deepEqual(v([true, false, true, null, null]), { naturel: 1, pieces: [{ juste: false, choix: -1, composee: 'VFV..' }] })
  assert.deepEqual(v([true, true, null, null, null]), { naturel: 0, pieces: [{ juste: false, choix: -1, composee: 'VV...' }] })
  // Rien répondu — l'échéance, la page sans réponse, la manche quittée ou expirée : zéro, rien de choisi.
  for (const rien of [v(), v([null, null, null, null, null]), r.juger(ECLAIR, e, 'expiree'), r.juger(ECLAIR, e, 'quittee')])
    assert.deepEqual(rien, { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] })
  // Les barèmes, lus dans `bareme.ts`.
  assert.deepEqual(B.JUSTES_DE_L_ECLAIR, [5, 4, 3])
  // Une réponse envoyée plus courte : le reste n'est pas répondu ; plus longue ou d'autre chose, illisible.
  assert.deepEqual(r.lireLeGeste(eclair([true, false]), ECLAIR), { quoi: 'repondre', reponses: [true, false, null, null, null] })
  for (const brut of [eclair([true, false, true, false, true, true]), eclair(['vrai'] as never), { quoi: 'repondre', reponse: { eclair: {} } }, { quoi: 'eclairer' }])
    assert.equal(r.lireLeGeste(brut, ECLAIR), null, JSON.stringify(brut))
  // Un seul geste à l'Éclair : il tranche toujours.
  assert.equal(r.apresLeGeste(ECLAIR, e, { quoi: 'repondre', reponses: justes }), GESTE_A_JUGER)
})

test('l’Éclair : rien de leur vérité ne part avant le verdict, sauf ce qu’Éclairer souffle', () => {
  const r = REGLE_DE_L_ECLAIR
  const e = r.ouvrir(ECLAIR)
  const vue = r.montrer(ECLAIR, e)
  assert.deepEqual(vue, {
    jeu: 'eclair',
    categorie: 'Géographie',
    affirmations: CINQ.map((q, i) => ({ texte: q.texte, proposee: q.reponses[i % 2 === 0 ? 0 : 2] })),
    soufflees: [],
  })
  // Une affirmation fausse ne dit jamais la bonne réponse qu'elle cache.
  const texte = JSON.stringify(vue)
  for (const i of [1, 3]) assert.ok(!texte.includes(CINQ[i].reponses[0]), `la bonne de ${CINQ[i].id}`)
  assert.ok(!/vraie|bonne|anecdote/.test(texte))
  // Éclairer souffle celle qu'il vise, une fois chacune.
  const une = eclaire(r, ECLAIR, e, 'x', 1)
  assert.deepEqual(r.montrer(ECLAIR, une).soufflees, [{ affirmation: 1, vraie: false }])
  assert.equal(r.eclairer(ECLAIR, une, hasardDe('x'), 1), 'Cette affirmation est déjà éclairée')
  assert.equal(r.eclairer(ECLAIR, une, hasardDe('x'), 5), 'Choisis l’affirmation à éclairer')
  assert.equal(r.eclairer(ECLAIR, une, hasardDe('x')), 'Choisis l’affirmation à éclairer')
  let toutes = une
  for (const i of [0, 2, 3, 4]) toutes = eclaire(r, ECLAIR, toutes, 'x', i)
  assert.equal(r.eclairer(ECLAIR, toutes, hasardDe('x'), 0), RIEN_A_ECLAIRER)
  // L'état ne tient aucune réponse : la page les garde jusqu'à l'envoi — Changer, avant, ne perd rien du serveur.
  assert.deepEqual(Object.keys(e), ['soufflees'])
})

test('l’Éclair : sa pièce est un composé hors de la base, sa révélation dit chacune', () => {
  const r = REGLE_DE_L_ECLAIR
  const e = r.ouvrir(ECLAIR)
  const v = verdictDe(jouer(r, ECLAIR, e, eclair([true, true, null, false, true])))
  const piece = r.piece(ECLAIR, e, v, { manche: 2, tirage: 4 })
  assert.equal(piece.id, idDeLEclair(['e1', 'e2', 'e3', 'e4', 'e5']))
  assert.ok(piece.id.startsWith(PREFIXE_DU_CABINET))
  assert.deepEqual(deplier(piece.id), ['e1', 'e2', 'e3', 'e4', 'e5'], 'ses cinq questions, pour les sept jours sans redite')
  assert.equal(piece.forme, 'eclair')
  assert.equal(piece.categorie, 'Géographie', 'cinq d’une même catégorie : la mission « catégorie » la compte')
  assert.equal(piece.niveau, 'moyen', 'la marche la plus haute de ses cinq')
  assert.deepEqual(piece.cabinet, { jeu: 'eclair', manche: 2, tirage: 4 })
  const revele = r.reveler(ECLAIR, e, v)
  assert.equal(revele.titre, '3 sur 5')
  assert.deepEqual(
    revele.affirmations.map(a => [a.vraie, a.reponse, a.juste, a.bonne]),
    [
      [true, true, true, 'Bonne e1'],
      [false, true, false, 'Bonne e2'],
      [true, null, false, 'Bonne e3'],
      [false, false, true, 'Bonne e4'],
      [true, true, true, 'Bonne e5'],
    ],
  )
  // « Le savais-tu ? » de la première ratée, sinon de la première qui en a un.
  assert.equal(revele.savais, 'Le savais-tu de e2.')
  assert.equal(r.reveler(ECLAIR, e, verdictDe(jouer(r, ECLAIR, e, eclair([true, false, true, false, true])))).savais, 'Le savais-tu de e2.')
  assert.equal(r.cartel(ECLAIR, v).anecdote, 'Le savais-tu de e2.')
})

// ── Le Mot mystère ──────────────────────────────────────────────────────

const MOT: MotTire = { jeu: 'mot', question: qcm('m1', 1, { texte: 'Quelle est la capitale de la Lituanie ?' }), lettres: 'VILNIUS', affiche: 'Vilnius' }
const essai = (lettres: string) => ({ quoi: 'essai', lettres })

test('le Mot mystère : les couleurs, lettres doubles comprises', () => {
  // Bien placée d'abord, puis ailleurs tant que le mot en a encore — une lettre ne se compte pas deux fois.
  assert.deepEqual(couleursDuMot('PLUME', 'PLAGE'), ['bien', 'bien', 'absente', 'absente', 'bien'])
  assert.deepEqual(couleursDuMot('LILAS', 'SALLE'), ['ailleurs', 'absente', 'bien', 'ailleurs', 'ailleurs'])
  // Deux E dans l'essai, un seul dans le mot, et bien placé : le second ne vaut rien.
  assert.deepEqual(couleursDuMot('EELLE', 'PLAGE'), ['absente', 'absente', 'ailleurs', 'absente', 'bien'])
  // Deux L dans le mot, trois dans l'essai : deux comptent — le bien placé, puis le premier des autres.
  assert.deepEqual(couleursDuMot('LLLAS', 'SALLE'), ['ailleurs', 'absente', 'bien', 'ailleurs', 'ailleurs'])
  assert.deepEqual(couleursDuMot('LLLLL', 'SALLE'), ['absente', 'absente', 'bien', 'bien', 'absente'])
  assert.deepEqual(couleursDuMot('VILNIUS', 'VILNIUS'), Array(7).fill('bien'))
  // Le clavier : chaque touche, ce que les essais en ont appris de mieux.
  assert.deepEqual(
    etatDesTouches([
      { lettres: 'LILAS', couleurs: couleursDuMot('LILAS', 'SALLE') },
      { lettres: 'LILLE', couleurs: couleursDuMot('LILLE', 'SALLE') },
    ]),
    { L: 'bien', I: 'absente', A: 'ailleurs', S: 'ailleurs', E: 'bien' },
  )
})

test('le Mot mystère : un seul mot de cinq à sept lettres, que l’intitulé ne dit pas', () => {
  const q = (bonne: string, texte = 'Quelle est la réponse ?') => ({ texte, reponses: [bonne, 'Autre', 'Encore', 'Aussi'], bonne: 0 })
  assert.deepEqual(motDeLaQuestion(q('Vilnius')), { lettres: 'VILNIUS', affiche: 'Vilnius' })
  // L'article se pose d'office : on trouve le mot, pas l'article ; « Œ » en fait deux lettres.
  assert.deepEqual(motDeLaQuestion(q('La Joconde')), { lettres: 'JOCONDE', affiche: 'La Joconde' })
  assert.deepEqual(motDeLaQuestion(q('Le cœur')), { lettres: 'COEUR', affiche: 'Le cœur' })
  assert.deepEqual(motDeLaQuestion(q('Éphèse')), { lettres: 'EPHESE', affiche: 'Éphèse' })
  for (const [bonne, pourquoi] of [
    ['Riga', 'quatre lettres'],
    ['Saint-Lô', 'un trait d’union'],
    ['Copenhague', 'dix lettres'],
    ['Mont Blanc', 'deux mots'],
    ['Prud’hon', 'une apostrophe'],
    ['1515', 'des chiffres'],
  ])
    assert.equal(motDeLaQuestion(q(bonne)), null, pourquoi)
  assert.equal(motDeLaQuestion(q('Vilnius', 'Combien d’habitants compte Vilnius ?')), null, 'soufflé par l’intitulé')
  assert.equal(motDeLaQuestion(q('Vilnius', 'Quelle capitale compte 600 000 habitants ?')), null, 'un chiffre dans l’intitulé')
  assert.equal(motDeLaQuestion(q('Vilnius', 'Laquelle de ces villes est en Lituanie ?')), null, 'un intitulé qui parle de ses choix')
  for (const n of [B.LETTRES_DU_MOT_MIN, B.LETTRES_DU_MOT_MAX]) assert.ok(motDeLaQuestion(q('A'.repeat(n))))
})

test('le Mot mystère : trouvé tôt, il vaut plus — l’essai qui trouve ou le cinquième tranche', () => {
  const r = REGLE_DU_MOT
  let e = r.ouvrir(MOT)
  // Une longueur fausse ne se dépense pas.
  assert.equal(refusDe(jouer(r, MOT, e, essai('RIGA'))), 'Il faut 7 lettres')
  // Trouvé au premier ou au deuxième : trois étoiles.
  assert.deepEqual(verdictDe(jouer(r, MOT, e, essai('VILNIUS'))), { naturel: 3, pieces: [{ juste: true, choix: 0, composee: 'VILNIUS' }] })
  e = etatDe(jouer(r, MOT, e, essai('KAUNASS')))
  assert.deepEqual(e.essais, ['KAUNASS'])
  assert.equal(verdictDe(jouer(r, MOT, e, essai('VILNIUS'))).naturel, 3)
  e = etatDe(jouer(r, MOT, e, essai('PALANGA')))
  assert.deepEqual(verdictDe(jouer(r, MOT, e, essai('VILNIUS'))), { naturel: 2, pieces: [{ juste: true, choix: 0, composee: 'KAUNASS,PALANGA,VILNIUS' }] })
  e = etatDe(jouer(r, MOT, e, essai('SIAULIA')))
  assert.equal(verdictDe(jouer(r, MOT, e, essai('VILNIUS'))).naturel, 2)
  // Le cinquième tranche : trouvé, une étoile — pas une juste ; pas trouvé, rien.
  e = etatDe(jouer(r, MOT, e, essai('KLAIPED')))
  assert.deepEqual(verdictDe(jouer(r, MOT, e, essai('VILNIUS'))), { naturel: 1, pieces: [{ juste: false, choix: -1, composee: 'KAUNASS,PALANGA,SIAULIA,KLAIPED,VILNIUS' }] })
  assert.deepEqual(verdictDe(jouer(r, MOT, e, essai('TRAKAIS'))), { naturel: 0, pieces: [{ juste: false, choix: -1, composee: 'KAUNASS,PALANGA,SIAULIA,KLAIPED,TRAKAIS' }] })
  // Expirée : ce qu'il avait essayé compte ; sans un essai, rien de choisi.
  assert.deepEqual(r.juger(MOT, e, 'expiree'), { naturel: 0, pieces: [{ juste: false, choix: -1, composee: 'KAUNASS,PALANGA,SIAULIA,KLAIPED' }] })
  assert.deepEqual(verdictDe(jouer(r, MOT, r.ouvrir(MOT), { quoi: 'repondre', auto: true })), { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] })
  // Les bornes, lues dans `bareme.ts`.
  assert.deepEqual(B.ESSAIS_DES_ETOILES, [2, 4, 5])
  assert.equal(B.ESSAIS_DU_MOT, 5)
  // Ce qu'un téléphone envoie : des capitales sans accents ; le reste ne se lit pas.
  for (const brut of [essai('vilnius'), essai('VILNIÜS'), essai(''), { quoi: 'essai' }, { quoi: 'essai', lettres: 7 }])
    assert.equal(r.lireLeGeste(brut, MOT), null, JSON.stringify(brut))
  assert.equal(r.apresLeGeste(MOT, r.ouvrir(MOT), { quoi: 'essai', lettres: 'VILNIUS' }), GESTE_A_JUGER)
})

test('le Mot mystère : Éclairer souffle une lettre à sa place, jamais le mot entier', () => {
  const r = REGLE_DU_MOT
  const ouvert = r.ouvrir(MOT)
  // Rejoué de la même graine, la même lettre.
  assert.deepEqual(eclaire(r, MOT, ouvert, 'm:eclairer:2'), eclaire(r, MOT, ouvert, 'm:eclairer:2'))
  let e = ouvert
  for (let n = 0; n < 6; n++) e = eclaire(r, MOT, e, `m:eclairer:${n}`)
  assert.equal(new Set(e.soufflees).size, 6, 'chaque fois une autre')
  assert.equal(r.eclairer(MOT, e, hasardDe('encore')), RIEN_A_ECLAIRER, 'sept lettres : six au plus')
  assert.deepEqual(
    r.montrer(MOT, e).soufflees.map(s => s.lettre).join(''),
    e.soufflees.map(p => MOT.lettres[p]).join(''),
  )
  // Ce qu'il a trouvé ne se souffle pas : les lettres bien placées d'un essai comptent parmi ce qu'il sait.
  const essaye = etatDe(jouer(r, MOT, ouvert, essai('VILLAGE'))) // V, I, L bien placées
  for (let n = 0; n < 50; n++) {
    const s = eclaire(r, MOT, essaye, `m:${n}`).soufflees
    assert.ok(![0, 1, 2].includes(s[0]), `position ${s[0]} déjà trouvée`)
  }
  let presque = essaye
  for (let n = 0; n < 3; n++) presque = eclaire(r, MOT, presque, `m:${n}:presque`)
  assert.equal(r.eclairer(MOT, presque, hasardDe('fin')), RIEN_A_ECLAIRER, 'trois trouvées et trois soufflées : la septième resterait seule')
})

test('le Mot mystère : la page ne reçoit ni le mot ni les réponses, seulement ce qu’il a appris', () => {
  const r = REGLE_DU_MOT
  const e = etatDe(jouer(r, MOT, r.ouvrir(MOT), essai('VILLAGE')))
  const vue = r.montrer(MOT, e)
  assert.deepEqual(vue, {
    jeu: 'mot',
    categorie: 'Géographie',
    texte: MOT.question.texte,
    longueur: 7,
    essaisMax: 5,
    essais: [{ lettres: 'VILLAGE', couleurs: ['bien', 'bien', 'bien', 'absente', 'absente', 'absente', 'absente'] }],
    soufflees: [],
  })
  const texte = JSON.stringify(vue)
  for (const secret of ['VILNIUS', 'Vilnius', ...MOT.question.reponses, MOT.question.anecdote!]) assert.ok(!texte.includes(secret), secret)
  const v = verdictDe(jouer(r, MOT, e, essai('VILNIUS')))
  const revele = r.reveler(MOT, e, v)
  assert.equal(revele.titre, 'Trouvé en 2 essais')
  assert.deepEqual(revele.essais.map(x => x.lettres), ['VILLAGE', 'VILNIUS'])
  assert.equal(r.reveler(MOT, e, r.juger(MOT, e, 'expiree')).titre, 'C’était « Vilnius »')
  const joconde: MotTire = { ...MOT, lettres: 'JOCONDE', affiche: 'La Joconde' }
  assert.equal(r.reveler(joconde, r.ouvrir(joconde), r.juger(joconde, r.ouvrir(joconde), 'expiree')).titre, 'C’était « la Joconde »')
  const piece = r.piece(MOT, e, v, { manche: 1, tirage: 1 })
  assert.deepEqual(piece, { ...MOT.question, forme: 'mot', cabinet: { jeu: 'mot', manche: 1, tirage: 1 } })
})

// ── Le Filet ────────────────────────────────────────────────────────────

const position = (valeur: number, p: PisteDuFilet) => (valeur - p.min) / (p.max - p.min)

test('le Filet : la piste se tire au départ, et la réponse n’est jamais sous le curseur d’office', () => {
  const [bas, haut] = B.POSITION_DE_LA_REPONSE
  for (const [valeur, annee] of [[1845, true], [1001, true], [2024, true], [42, false], [8848, false], [10, false], [67_000_000, false], [12.5, false]] as const) {
    let centre = 0
    let gauche = 0
    let droite = 0
    for (let n = 0; n < 1000; n++) {
      const p = pisteDuFilet(valeur, annee, hasardDe(`piste:${valeur}:${n}`))
      assert.ok(p, `${valeur}`)
      const x = position(valeur, p)
      assert.ok(x >= bas && x <= haut, `${valeur} à ${x} de la piste ${JSON.stringify(p)}`)
      if (annee) {
        assert.ok(Number.isInteger(p.min) && p.pas === 1)
        assert.ok(p.max - p.min >= B.PISTE_DES_ANNEES[0] && p.max - p.min <= B.PISTE_DES_ANNEES[1], `${p.max - p.min} ans`)
      } else {
        assert.equal(p.min, 0)
        assert.equal(p.pas, Math.max(1, Math.round(p.max / B.PAS_DE_LA_PISTE)))
      }
      // Le curseur part du milieu : la réponse dans son petit filet d'office, c'était la faille de la maquette.
      if (dansLeFilet(milieuDeLaPiste(p), 'petit', valeur, p)) centre++
      if (x < 0.4) gauche++
      if (x > 0.6) droite++
    }
    // Une fois sur douze environ, au hasard de sa place ; les bornes rondes d'une estimation, qui
    // rapprochent ses places possibles, l'emmènent vers une sur dix. La maquette d'avant : toujours.
    assert.ok(centre < 150, `${valeur} : ${centre} fois sur 1000 sous le curseur`)
    assert.ok(gauche > 250 && droite > 250, `${valeur} : ${gauche} à gauche, ${droite} à droite`)
  }
  // La même graine, la même piste.
  assert.deepEqual(pisteDuFilet(1845, true, hasardDe('même')), pisteDuFilet(1845, true, hasardDe('même')))
  // Ce que le Filet pose : une année entière dès 1001, une estimation dès dix.
  assert.ok(seTendAuFilet(1001, true) && seTendAuFilet(10, false) && seTendAuFilet(12.5, false))
  for (const [valeur, annee] of [[1000, true], [1845.5, true], [9.9, false], [Number.NaN, false], [Infinity, false]] as const) {
    assert.equal(seTendAuFilet(valeur, annee), false, `${valeur}`)
    assert.equal(pisteDuFilet(valeur, annee, hasardDe('x')), null, `${valeur}`)
  }
})

test('le Filet : le bord du filet ne dépend pas de la virgule flottante (invariant 15)', () => {
  // 0,09 × 20 vaut 1,7999999999999998 en virgule flottante, et 14 − 12,2 vaut 1,8000000000000007 :
  // comparé tel quel, un lancer pile au bord du filet moyen tombait dehors.
  const piste: PisteDuFilet = { min: 0, max: 20, pas: 1 }
  assert.ok(0.09 * 20 < 1.8 && 14 - 12.2 > 1.8, 'le piège existe')
  assert.equal(demiLargeur('moyen', piste), 1.8)
  assert.equal(ecartEstimation(14, 12.2), 1.8)
  assert.ok(dansLeFilet(14, 'moyen', 12.2, piste), 'pile au bord : dedans')
  assert.ok(dansLeFilet(10.4, 'moyen', 12.2, piste), 'de l’autre côté aussi')
  assert.ok(!dansLeFilet(14.1, 'moyen', 12.2, piste), 'un dixième au-delà : dehors')
  // Une piste d'années : 0,09 × 119 vaut 10,709999999999999.
  const annees: PisteDuFilet = { min: 1800, max: 1919, pas: 1 }
  assert.equal(demiLargeur('moyen', annees), 10.71)
  assert.equal(demiLargeur('petit', { min: 0, max: 100, pas: 1 }), 3.5, '0,035 × 100 vaut 3,5000000000000004')
  assert.ok(dansLeFilet(103.5, 'petit', 100, { min: 0, max: 100, pas: 1 }))
})

const FILET: FiletTire = {
  jeu: 'filet',
  question: qcm('f1', 2, { texte: 'En quelle année Louis Braille a-t-il publié son alphabet ?', reponses: ['1815', '1829', '1837', '1845'], bonne: 1 }),
  valeur: 1829,
  annee: true,
  piste: { min: 1790, max: 1890, pas: 1 },
}
const lancer = (x: number, taille: string) => ({ quoi: 'repondre', reponse: { filet: { x, taille } } })

test('le Filet : petit, il rapporte plus — juste dans le petit ou le moyen', () => {
  const r = REGLE_DU_FILET
  const e = r.ouvrir(FILET)
  const v = (x: number, taille: string) => verdictDe(jouer(r, FILET, e, lancer(x, taille)))
  // Cent ans de piste : le petit filet tient 3,5 ans de chaque côté, le moyen 9, le grand 20.
  assert.deepEqual(v(1832, 'petit'), { naturel: 3, pieces: [{ juste: true, choix: 0, composee: '1832|petit' }] })
  assert.deepEqual(v(1838, 'moyen'), { naturel: 2, pieces: [{ juste: true, choix: 0, composee: '1838|moyen' }] })
  assert.deepEqual(v(1848, 'grand'), { naturel: 1, pieces: [{ juste: false, choix: -1, composee: '1848|grand' }] })
  assert.deepEqual(v(1833, 'petit'), { naturel: 0, pieces: [{ juste: false, choix: -1, composee: '1833|petit' }] })
  assert.deepEqual(v(1850, 'grand'), { naturel: 0, pieces: [{ juste: false, choix: -1, composee: '1850|grand' }] })
  for (const rien of [verdictDe(jouer(r, FILET, e, { quoi: 'repondre', auto: true })), r.juger(FILET, e, 'expiree'), r.juger(FILET, e, 'quittee')])
    assert.deepEqual(rien, { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }, 'sans lancer, rien de choisi')
  // Ce que la page envoie : un nombre fini sur la piste, un des trois filets.
  for (const brut of [lancer(1789, 'petit'), lancer(1891, 'petit'), lancer(Number.NaN, 'petit'), lancer(1829, 'énorme'), lancer(1829, 'constructor'), { quoi: 'repondre', reponse: { filet: { x: '1829', taille: 'petit' } } }, { quoi: 'reculer' }])
    assert.equal(r.lireLeGeste(brut, FILET), null, JSON.stringify(brut))
  assert.deepEqual(r.lireLeGeste(lancer(1890, 'grand'), FILET), { quoi: 'repondre', lancer: { x: 1890, taille: 'grand' } })
  assert.equal(r.apresLeGeste(FILET, e, { quoi: 'repondre', lancer: null }), GESTE_A_JUGER)
})

test('le Filet : la zone d’Éclairer contient toujours la réponse, sur la piste, une fois', () => {
  const r = REGLE_DU_FILET
  for (const t of [FILET, { ...FILET, valeur: 1791 }, { ...FILET, valeur: 1889 }, { ...FILET, valeur: 42, annee: false, piste: { min: 0, max: 61, pas: 1 } }]) {
    for (let n = 0; n < 1000; n++) {
      const z = eclaire(r, t, r.ouvrir(t), `f:eclairer:${n}`).zone!
      assert.ok(z.de <= t.valeur && t.valeur <= z.a, `${t.valeur} hors de ${z.de}–${z.a}`)
      assert.ok(z.de >= t.piste.min && z.a <= t.piste.max, `${z.de}–${z.a} hors de la piste`)
      assert.ok(Math.abs(z.a - z.de - B.ZONE_DU_FILET * (t.piste.max - t.piste.min)) < 1e-9, 'trente pour cent de la piste')
    }
  }
  const une = eclaire(r, FILET, r.ouvrir(FILET), 'f:1')
  assert.deepEqual(eclaire(r, FILET, r.ouvrir(FILET), 'f:1'), une, 'la même graine, la même zone')
  assert.equal(r.eclairer(FILET, une, hasardDe('f:2')), RIEN_A_ECLAIRER)
  assert.deepEqual(r.montrer(FILET, une).zone, une.zone)
})

test('le Filet : la page ne reçoit jamais la valeur ; la révélation la dit', () => {
  const r = REGLE_DU_FILET
  const e = r.ouvrir(FILET)
  const vue = r.montrer(FILET, e)
  assert.deepEqual(vue, { jeu: 'filet', categorie: 'Géographie', texte: FILET.question.texte, annee: true, piste: FILET.piste, zone: null })
  const texte = JSON.stringify(vue)
  for (const secret of ['1829', ...FILET.question.reponses, FILET.question.anecdote!]) assert.ok(!texte.includes(secret), secret)
  const v = verdictDe(jouer(r, FILET, e, lancer(1838, 'moyen')))
  const revele = r.reveler(FILET, e, v)
  assert.equal(revele.titre, 'Dans le filet')
  assert.equal(revele.valeur, 1829)
  assert.equal(revele.reponse, '1829')
  assert.deepEqual(revele.lancer, { x: 1838, taille: 'moyen' })
  assert.equal(r.reveler(FILET, e, verdictDe(jouer(r, FILET, e, lancer(1850, 'petit')))).titre, 'À côté')
  assert.equal(r.reveler(FILET, e, r.juger(FILET, e, 'expiree')).titre, 'Pas de lancer')
  const piece = r.piece(FILET, e, v, { manche: 0, tirage: 3 })
  assert.equal(piece.id, 'f1', 'une question de la base : carnet et signalement')
  assert.equal(piece.forme, 'filet', 'une estimation n’est jamais « juste » au sens d’un QCM')
  assert.deepEqual(r.cartel(FILET, v), { sujet: FILET.question.texte, reponse: '1829', anecdote: FILET.question.anecdote })
})

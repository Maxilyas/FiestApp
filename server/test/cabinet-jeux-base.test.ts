// Les quatre jeux du Cabinet qui posent une question de la base de la
// campagne — le Pari, l'Éclair, le Mot mystère, le Filet —, par leurs règles
// pures (`shared/cabinet/jeux/`). Ce que la conception exige d'eux : les deux
// étapes du Pari, les étoiles gardées à « Quitter », sa seconde question tirée au
// départ et jamais montrée avant « Parier » ; l'Éclair, ses cinq affirmations
// jugées ensemble et rien de leur vérité avant le verdict ; les couleurs du
// Mot mystère et leurs lettres doubles, le souffle, la longueur d'un mot ; la
// piste du Filet, qui ne met jamais la réponse au milieu d'office — y rester
// ne rapporte que la part de la piste que couvre le filet — et ne passe
// jamais l'année du départ, le bord du filet que la virgule flottante ne
// départage pas (invariant 15), la zone d'Éclairer qui contient toujours la
// réponse.
//
// Le moule commun (`RegleDuJeu`, `regle.ts`) dit comment le pli s'en sert :
// `trancheLaManche` d'abord — oui, le geste va à `juger` ; non, à
// `apresLeGeste`. Ces épreuves jouent les règles comme le pli les jouera ; puis
// le tirage des quatre au serveur (`core/cabinet/tirages/`) — le mot que la
// règle lit de la question, jamais deux fois le même ; la valeur du Filet, sa
// piste au hasard du serveur, à l'année du jour de Paris du départ —, et les
// quatre par les routes, d'une partie entière.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  bancDuCabinet,
  baseDuCabinet,
  commencer,
  anneeDuCabinet,
  filetDe,
  jouer as unGeste,
  jouerUnEclair,
  jouerUnFilet,
  jouerUnMot,
  jouerUnPari,
  motDe,
  motDuCabinet,
  ok,
  ouvrir as ouvrirLaManche,
  unPariParfait,
  valeurDuCabinet,
} from './cabinet-banc'
import type { QuestionDeLaBase } from '../src/core/baseCampagne'
import { tirerLePlan, type ContexteDuTirage } from '../src/core/cabinet/tirages/index'
import { estUnQcmDuCabinet, valeurDuFilet } from '../src/core/cabinet/tirages/tas'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART } from '../../shared/cabinet/oeuvres'
import { niveauDeQuestion, type MesureDUneQuestion } from '../../shared/campagne'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { vuesDuCabinet } from '../../shared/cabinet/vues'
import type { ContenuTire } from '../../shared/cabinet/jeux/index'
import { hasardDe } from '../../shared/missions'
import { decimales, ecartEstimation } from '../../shared/classement'
import * as B from '../../shared/cabinet/bareme'
import { refusDuPouvoir, effacablesAuPlus } from '../../shared/cabinet/pouvoirs'
import { deplier, idDeLEclair, PREFIXE_DU_CABINET } from '../../shared/cabinet/pieces'
import { MOTS_DU_PARI, justeDeLaPiece, trancheLaManche, type RegleDuJeu, type VerdictDUneManche } from '../../shared/cabinet/jeux/regle'
import { GESTE_A_JUGER, eclairerSertEncore, type QuestionTiree } from '../../shared/cabinet/jeux/outils'
import { REGLE_DU_PARI, type EtatDuPari, type PariTire } from '../../shared/cabinet/jeux/pari'
import { REGLE_DE_L_ECLAIR, affirmationDe, type EclairTire } from '../../shared/cabinet/jeux/eclair'
import { REGLE_DU_MOT, couleursDuMot, etatDesTouches, motDeLaQuestion, type MotMontre, type MotRevele, type MotTire } from '../../shared/cabinet/jeux/mot'
import {
  REGLE_DU_FILET,
  TAILLES_DU_FILET,
  dansLeFilet,
  demiLargeur,
  milieuDeLaPiste,
  pisteDuFilet,
  seTendAuFilet,
  type FiletRevele,
  type FiletTire,
  type PisteDuFilet,
  type TailleDuFilet,
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

/** L'année du départ de la partie : le tireur la lit au jour de Paris du départ, jamais à l'horloge. */
const DEPART = 2026

/**
 * Un geste joué comme le pli le jouera : lu, puis `trancheLaManche` dit s'il
 * va à `juger` (le verdict) ou à `apresLeGeste` (l'état d'après, ou son refus).
 */
function jouer<T, E, G extends { quoi: string }>(r: RegleDuJeu<T, E, G, unknown, unknown>, t: T, e: E, brut: unknown): { etat: E } | { verdict: VerdictDUneManche } | { refus: string } {
  const g = r.lireLeGeste(brut, t)
  assert.ok(g !== null, `illisible : ${JSON.stringify(brut)}`)
  if (trancheLaManche(r, t, e, g)) return { verdict: r.juger(t, e, g) }
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
  }
  // Le Pari a un chrono par étape, le même.
  assert.equal(REGLE_DU_PARI.dureeMs(2), B.DUREES_DES_JEUX.pari * 1000)
  // Éclairer sans rien à souffler se refuse par la seule règle des pouvoirs, en mots.
  assert.equal(RIEN_A_ECLAIRER, 'Ce jeu n’a plus rien à éclairer')
})

test('les règles sont pures : ni horloge, ni hasard que la graine ne redonne', () => {
  // Une échéance se lit à l'heure du serveur (invariant 6), le hasard d'Éclairer à la graine de la partie :
  // recharger redonne la même réponse effacée, la même lettre, la même zone.
  for (const f of ['outils', 'pari', 'eclair', 'mot', 'filet']) {
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

test('le Pari : juste, il garde ses étoiles ou les parie — deux étapes, chacune sa question', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  assert.equal(ouvert.etape, 1)
  assert.equal(ouvert.auChoix, false)

  // Juste à la première : la manche n'est pas tranchée, il choisit.
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  assert.equal(auChoix.auChoix, true, 'juste : il garde ou il parie')
  assert.equal(auChoix.etape, 1)

  // Garder : ses étoiles (`ETOILES_DU_PARI.garder`), une pièce — la première, juste.
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

test('le Pari : laissé au choix puis quitté, ses étoiles sont gardées ; quitté ailleurs, rien', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  for (const fin of ['quittee', 'expiree'] as const) {
    // Il les avait gagnées : quitter au choix, ou la partie close le lendemain, les garde.
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
  // Deux étoiles gardées depuis le calibrage du 25 octobre 2026 : le refus les dit au nombre du barème.
  assert.equal(B.ETOILES_DU_PARI.garder, 2)
  assert.equal(refusDe(jouer(r, PARI, auChoix, repondre(2))), 'Garde tes étoiles, ou parie-les')
  assert.equal(refusDe(jouer(r, PARI, auChoix, repondre(2))), MOTS_DU_PARI.gardeOuParie, 'les mots du Pari, d’une seule source')
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
  // Au choix, rien à souffler — même sans rien d'effacé : la question est répondue, et Éclairer
  // y dépenserait un usage et ôterait à la première sa nudité (D4).
  const choixNu = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  assert.equal(r.eclairer(PARI, choixNu, hasardDe('x')), RIEN_A_ECLAIRER)
  assert.deepEqual(choixNu.effacees, [[], []])
  // Au pari, deux de plus, sur la seconde question.
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
  // Arrivée dans le temps en plus de « Prendre son temps » : seul le pli le sait, et il le dit (`aidee`).
  // Nue, la ligne compterait à la mesure, à la précision et à L'Érudit.
  const garde = verdictDe(jouer(r, PARI, auChoix, { quoi: 'garder' }))
  assert.equal(r.piece(PARI, auChoix, garde, { manche: 0, tirage: 0, etape: 1 }).forme, undefined)
  assert.equal(r.piece(PARI, auChoix, garde, { manche: 0, tirage: 0, etape: 1, aidee: true }).forme, 'pari')
  assert.equal(r.piece(PARI, pari, gagne, { manche: 0, tirage: 0, etape: 1, aidee: false }).forme, undefined)
  // La pièce garde ses réponses à part : la retoucher ne retouche pas le plan figé.
  assert.notEqual(p1.reponses, PARI.q1.reponses)
})

test('le Pari : la révélation dit ce qui s’est passé, chaque réponse marquée', () => {
  const r = REGLE_DU_PARI
  const ouvert = r.ouvrir(PARI)
  const auChoix = etatDe(jouer(r, PARI, ouvert, repondre(1)))
  const pari = etatDe(jouer(r, PARI, auChoix, { quoi: 'parier' }))
  const titre = (e: EtatDuPari, v: VerdictDUneManche) => r.reveler(PARI, e, v).titre
  // Les étoiles gardées, au nombre du barème : deux depuis le calibrage du 25 octobre 2026.
  assert.equal(titre(auChoix, verdictDe(jouer(r, PARI, auChoix, { quoi: 'garder' }))), 'Étoiles gardées')
  assert.equal(titre(auChoix, verdictDe(jouer(r, PARI, auChoix, { quoi: 'garder' }))), MOTS_DU_PARI.gardees, 'les mots du Pari, d’une seule source')
  // Le jeu ne les recopie pas : un mot qui compte ses étoiles (« Étoile gardée ») n'y est écrit nulle part — l'accord
  // s'y décidait à part de l'annonce, et une phrase de plus en aurait fait une troisième copie (`motsDuPari`).
  const code = readFileSync(new URL('../../shared/cabinet/jeux/pari.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /['"`][^'"`\n]*[ée]toile/i, 'pari.ts écrit ses étoiles en dur')
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
    const a = affirmationDe(CINQ[0], hasardDe(`affirmation:${n}`))!
    if (a.proposee === CINQ[0].bonne) vraies++
    else assert.ok(a.proposee >= 0 && a.proposee < 4)
    assert.equal(a.question, CINQ[0])
  }
  assert.ok(Math.abs(vraies / 1000 - B.PART_DES_VRAIES) < 0.05, `${vraies} vraies sur 1000`)
  assert.deepEqual(affirmationDe(CINQ[0], hasardDe('même')), affirmationDe(CINQ[0], hasardDe('même')), 'la même graine, la même affirmation')
  // Deux réponses : une fausse ne proposerait que l'autre, et un vrai ou faux de la base se lirait
  // « Vrai ? — Faux ». Elle ne se récrit pas, comme à l'Expédition (`aSaForme`).
  for (const reponses of [['Vrai', 'Faux'], ['Riga'], []]) assert.equal(affirmationDe(qcm('vf', 0, { reponses }), hasardDe('vf')), null, JSON.stringify(reponses))
  assert.ok(affirmationDe(qcm('trois', 0, { reponses: ['A', 'B', 'C'] }), hasardDe('trois')))
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
  // L'intitulé se lit en capitales sans accents comme la réponse — une seule règle, `capitalesSansAccents` :
  // « cœur » y fait COEUR, « Éphèse » EPHESE, et le mot soufflé se voit.
  assert.equal(motDeLaQuestion(q('Le cœur', 'Quel organe appelle-t-on aussi « le Cœur » ?')), null, 'Œ soufflé')
  assert.equal(motDeLaQuestion(q('Éphèse', 'Où se trouvait le temple d’Artémis, à EPHÈSE ?')), null, 'accent soufflé')
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

test('le Filet : la piste se tire au départ, la réponse n’y est jamais au milieu d’office', () => {
  const [bas, haut] = B.POSITION_DE_LA_REPONSE
  // La part des places de la réponse que couvre chaque filet posé au milieu : 7, 18 et 40 % de la
  // piste, sur les 84 % où elle peut tomber — ce que rapporte un lancer qui ne sait rien.
  const part = (t: TailleDuFilet) => (2 * B.LARGEURS_DU_FILET[t]) / (haut - bas)
  for (const [valeur, annee] of [[1845, true], [1001, true], [1950, true], [42, false], [8848, false], [10, false], [67_000_000, false], [12.5, false]] as const) {
    const auMilieu: Record<TailleDuFilet, number> = { petit: 0, moyen: 0, grand: 0 }
    let gauche = 0
    let droite = 0
    for (let n = 0; n < 1000; n++) {
      const p = pisteDuFilet(valeur, annee, hasardDe(`piste:${valeur}:${n}`), DEPART)
      assert.ok(p, `${valeur}`)
      const x = position(valeur, p)
      assert.ok(x >= bas && x <= haut, `${valeur} à ${x} de la piste ${JSON.stringify(p)}`)
      if (annee) {
        assert.ok(Number.isInteger(p.min) && p.pas === 1)
        assert.ok(p.max - p.min >= B.PISTE_DES_ANNEES[0] && p.max - p.min <= B.PISTE_DES_ANNEES[1], `${p.max - p.min} ans`)
        assert.ok(p.max <= DEPART, `${valeur} : la piste passe ${DEPART}, ${JSON.stringify(p)}`)
      } else {
        assert.equal(p.min, 0)
        if (Number.isInteger(valeur)) assert.equal(p.pas, Math.max(1, Math.round(p.max / B.PAS_DE_LA_PISTE)))
      }
      // Le curseur part du milieu : la réponse dans son filet d'office, c'était la faille de la maquette.
      const milieu = milieuDeLaPiste(p)
      for (const t of TAILLES_DU_FILET) if (dansLeFilet(milieu, t, valeur, p)) auMilieu[t]++
      if (x < 0.4) gauche++
      if (x > 0.6) droite++
    }
    // Au milieu, rien de plus que la part du filet, au hasard de sa place — les bornes rondes d'une
    // estimation, qui rapprochent ses places possibles, en ajoutent un peu : 8 848 m prend le petit
    // filet une fois sur neuf au lieu d'une sur douze. La maquette d'avant : toujours. Qu'un lancer
    // au milieu, sans rien savoir, prenne encore une étoile au grand filet près d'une fois sur deux,
    // c'est le barème même (`LARGEURS_DU_FILET`) : le calibrage du Cabinet le mesure.
    for (const t of TAILLES_DU_FILET)
      assert.ok(auMilieu[t] <= 1000 * (part(t) + 0.06), `${valeur} : ${auMilieu[t]} fois sur 1000 dans le ${t} filet du milieu`)
    assert.ok(gauche > 250 && droite > 250, `${valeur} : ${gauche} à gauche, ${droite} à droite`)
  }
  // La même graine, la même piste.
  assert.deepEqual(pisteDuFilet(1845, true, hasardDe('même'), DEPART), pisteDuFilet(1845, true, hasardDe('même'), DEPART))
  // Ce que le Filet pose : une année entière dès 1001, une estimation dès dix.
  assert.ok(seTendAuFilet(1001, true, DEPART) && seTendAuFilet(10, false, DEPART) && seTendAuFilet(12.5, false, DEPART))
  for (const [valeur, annee] of [[1000, true], [1845.5, true], [9.9, false], [Number.NaN, false], [Infinity, false]] as const) {
    assert.equal(seTendAuFilet(valeur, annee, DEPART), false, `${valeur}`)
    assert.equal(pisteDuFilet(valeur, annee, hasardDe('x'), DEPART), null, `${valeur}`)
  }
})

test('le Filet : une piste d’années s’arrête à l’année du départ, et ne trahit pas la réponse', () => {
  // Pour 2015, neuf pistes sur dix passaient 2026, jusqu'à 2124 : qui savait seulement que la
  // réponse n'est pas dans l'avenir visait le milieu du passé, et prenait le petit ou le moyen
  // filet une fois sur trois au lieu d'une sur cinq. Tirer la piste pour qu'elle s'arrête avant
  // l'année du départ aurait été pire : sa place dépendrait de la réponse, collée à son bout — pour
  // 2015, un joueur qui le sait l'aurait prise neuf fois sur dix (sa loi a posteriori). Coupée à
  // l'année du départ, la piste ne dit rien de plus que ce qu'il sait déjà, et garde ses cinquante
  // ans et sa réponse sous 92 % tant que l'année a quarante-six ans ; plus récente, elle ne se pose pas.
  const [bas, haut] = B.POSITION_DE_LA_REPONSE
  const recul = B.PISTE_DES_ANNEES[0] - Math.ceil(bas * B.PISTE_DES_ANNEES[0])
  assert.equal(recul, 46)
  for (const valeur of [1900, 1950, 1960, DEPART - 50, DEPART - recul]) {
    let coupees = 0
    let auMilieu = 0
    for (let n = 0; n < 1000; n++) {
      const p = pisteDuFilet(valeur, true, hasardDe(`depart:${valeur}:${n}`), DEPART)
      assert.ok(p, `${valeur}`)
      assert.ok(p.max <= DEPART, `${valeur} : ${JSON.stringify(p)}`)
      assert.ok(p.max - p.min >= B.PISTE_DES_ANNEES[0] && p.max - p.min <= B.PISTE_DES_ANNEES[1], `${valeur} : ${p.max - p.min} ans`)
      const x = position(valeur, p)
      assert.ok(x >= bas && x <= haut, `${valeur} à ${x} de ${JSON.stringify(p)}`)
      if (p.max === DEPART) coupees++
      if (dansLeFilet(milieuDeLaPiste(p), 'moyen', valeur, p)) auMilieu++
    }
    if (valeur >= 1960) assert.ok(coupees > 0, `${valeur} : aucune piste coupée`)
    // Le prix de la coupe : une piste coupée rapproche la réponse de son milieu. Rien avant 1950 ;
    // à quarante-six ans du départ, le moyen filet du milieu la prend 28 fois sur 100 au lieu de 21.
    // Le calibrage du Cabinet le pèse contre les années récentes que le Filet ne pose plus.
    assert.ok(auMilieu <= 1000 * ((2 * B.LARGEURS_DU_FILET.moyen) / (haut - bas) + 0.09), `${valeur} : ${auMilieu} fois sur 1000 dans le moyen filet du milieu`)
  }
  // Une piste qui ne l'atteint pas est celle d'avant : la coupe ne change rien d'autre au tirage.
  for (let n = 0; n < 200; n++)
    assert.deepEqual(pisteDuFilet(1845, true, hasardDe(`avant:${n}`), DEPART), pisteDuFilet(1845, true, hasardDe(`avant:${n}`), 3000))
  // Plus récente, ou dans l'avenir : ni piste, ni filet.
  for (const valeur of [DEPART - recul + 1, DEPART - 4, DEPART, DEPART + 6]) {
    assert.equal(seTendAuFilet(valeur, true, DEPART), false, `${valeur}`)
    assert.equal(pisteDuFilet(valeur, true, hasardDe('x'), DEPART), null, `${valeur}`)
  }
  // L'année du départ ne touche pas une estimation.
  assert.deepEqual(pisteDuFilet(2024, false, hasardDe('e'), DEPART), pisteDuFilet(2024, false, hasardDe('e'), 1000))
  assert.ok(seTendAuFilet(2024, false, DEPART))
})

test('le Filet : sur une piste courte, le pas s’affine — le petit filet atteint toujours la réponse', () => {
  // 12,5 sur une piste de 0 à 14, au pas d'un : le petit filet n'y tient que 0,49 de chaque côté,
  // aucune place du curseur ne prenait la réponse, et ★★★ était hors d'atteinte.
  const courte: PisteDuFilet = { min: 0, max: 14, pas: 1 }
  assert.ok(!dansLeFilet(12, 'petit', 12.5, courte) && !dansLeFilet(13, 'petit', 12.5, courte), 'le piège existe')
  for (const valeur of [10.5, 11.5, 12.5, 12.25, 10, 11, 42.5, 8848.5]) {
    for (let n = 0; n < 2000; n++) {
      const p = pisteDuFilet(valeur, false, hasardDe(`court:${valeur}:${n}`), DEPART)!
      // La place du curseur la plus proche de la réponse, telle que la page la poserait.
      const k = Math.round((valeur - p.min) / p.pas)
      assert.ok(dansLeFilet(p.min + k * p.pas, 'petit', valeur, p), `${valeur} hors d'atteinte sur ${JSON.stringify(p)}`)
      // Le milieu tombe sur un pas, écrit comme il se lit.
      assert.ok(decimales(milieuDeLaPiste(p)) <= decimales(p.pas), `${milieuDeLaPiste(p)} au pas de ${p.pas}`)
      // Un pas plus fin seulement là où il le faut : une réponse entière garde le sien.
      if (Number.isInteger(valeur) || p.max >= 15) assert.equal(p.pas, Math.max(1, Math.round(p.max / B.PAS_DE_LA_PISTE)), `${valeur} : ${JSON.stringify(p)}`)
    }
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

// ── Le contrat avec le pli ──────────────────────────────────────────────

test('le pli demande d’abord si un geste tranche : ce que le jeu en dit, sinon seul « repondre »', () => {
  // Un jeu qui n'en dit rien — le Détail, la Frise, codés à côté — suit le contrat des gestes :
  // `repondre` tranche, « Reculer d'un pas », un indice, le mot de la Réplique attendent leur réponse.
  // Pris dans l'autre sens, le premier « Reculer » du Détail aurait tranché la manche à zéro.
  const muet: Pick<RegleDuJeu<null, null, { quoi: string }, unknown, unknown>, 'tranche'> = {}
  assert.equal(trancheLaManche(muet, null, null, { quoi: 'repondre' }), true)
  for (const quoi of ['reculer', 'indice', 'nom', 'mot', 'essai', 'garder', 'parier'])
    assert.equal(trancheLaManche(muet, null, null, { quoi }), false, quoi)
  // Le Filet et l'Éclair n'ont qu'un geste, `repondre` : la règle commune leur suffit.
  assert.equal(REGLE_DU_FILET.tranche, undefined)
  assert.equal(REGLE_DE_L_ECLAIR.tranche, undefined)
  assert.equal(trancheLaManche(REGLE_DU_FILET, FILET, REGLE_DU_FILET.ouvrir(FILET), { quoi: 'repondre', lancer: null }), true)
  assert.equal(trancheLaManche(REGLE_DE_L_ECLAIR, ECLAIR, REGLE_DE_L_ECLAIR.ouvrir(ECLAIR), { quoi: 'repondre', reponses: [] }), true)
  // Le Pari et le Mot disent les leurs : une juste à la première question attend son choix,
  // et « Garder » tranche ; l'essai qui trouve tranche, l'essai qui ne trouve pas, non.
  const ouvert = REGLE_DU_PARI.ouvrir(PARI)
  assert.equal(trancheLaManche(REGLE_DU_PARI, PARI, ouvert, { quoi: 'repondre', choix: PARI.q1.bonne }), false)
  assert.equal(trancheLaManche(REGLE_DU_PARI, PARI, ouvert, { quoi: 'repondre', choix: 0 }), true)
  assert.equal(trancheLaManche(REGLE_DU_PARI, PARI, { ...ouvert, auChoix: true, choix1: 1 }, { quoi: 'garder' }), true)
  const mot = REGLE_DU_MOT.ouvrir(MOT)
  assert.equal(trancheLaManche(REGLE_DU_MOT, MOT, mot, { quoi: 'essai', lettres: 'VILNIUS' }), true)
  assert.equal(trancheLaManche(REGLE_DU_MOT, MOT, mot, { quoi: 'essai', lettres: 'KAUNASS' }), false)
  assert.equal(trancheLaManche(REGLE_DU_MOT, MOT, mot, { quoi: 'repondre' }), true)
})

test('Éclairer sert-il encore ? Le jeu le dit par le refus des pouvoirs, mot pour mot', () => {
  // Le pli pose `aEclairer` de là : la page grise le bouton sans rien recopier.
  assert.equal(eclairerSertEncore(REGLE_DU_FILET, FILET, REGLE_DU_FILET.ouvrir(FILET)), true)
  assert.equal(eclairerSertEncore(REGLE_DU_FILET, FILET, { zone: { de: 1800, a: 1830 } }), false)
  assert.equal(eclairerSertEncore(REGLE_DU_PARI, PARI, REGLE_DU_PARI.ouvrir(PARI)), true)
  assert.equal(eclairerSertEncore(REGLE_DU_PARI, PARI, { ...REGLE_DU_PARI.ouvrir(PARI), auChoix: true, choix1: 1 }), false, 'au choix')
  // L'Éclair a besoin d'une cible : sans elle, il refuse autrement tant qu'il en reste une à souffler.
  assert.equal(eclairerSertEncore(REGLE_DE_L_ECLAIR, ECLAIR, REGLE_DE_L_ECLAIR.ouvrir(ECLAIR)), true)
  assert.equal(eclairerSertEncore(REGLE_DE_L_ECLAIR, ECLAIR, { soufflees: [0, 1, 2, 3, 4] }), false)
  assert.equal(eclairerSertEncore(REGLE_DU_MOT, MOT, REGLE_DU_MOT.ouvrir(MOT)), true)
  assert.equal(eclairerSertEncore(REGLE_DU_MOT, MOT, { essais: [], soufflees: [0, 1, 2, 3, 4, 5] }), false, 'jamais le mot entier')
})

// ── Le tirage, au serveur ─────────────────────────────────────────────────
// Ce que les tireurs du Pari et de l'Éclair tirent au départ, sur une base
// d'essai — huit questions de chaque marche dans chaque catégorie —, le hasard
// celui du serveur : les marches mesurées, la catégorie, rien deux fois dans le
// plan, et « rien ne revient avant sept jours », d'un jeu à l'autre.

const BASE_DU_TIRAGE = baseDuCabinet()
const PORTE_D_ESSAI = { deLaCategorie: (jouables: readonly QuestionDeLaBase[], c: Categorie) => jouables.filter(q => q.meta.categorie === c) }
const MESURE = new Map<string, MesureDUneQuestion>()
const niveauDe = (id: string) => niveauDeQuestion(BASE_DU_TIRAGE.parId.get(id)!.meta.difficulte, MESURE.get(id))
const contexte = (vues: ReadonlyMap<string, number> = new Map(), maintenant = DIX_HEURES): ContexteDuTirage => ({
  porte: PORTE_D_ESSAI,
  jouables: BASE_DU_TIRAGE.questions,
  mesures: MESURE,
  vues,
  maintenant,
  hasard: Math.random,
})
const idsDuPlan = (plan: readonly ContenuTire[]) =>
  plan.flatMap(t => (t.jeu === 'pari' ? [t.q1.id, t.q2.id] : t.jeu === 'eclair' ? t.affirmations.map(a => a.question.id) : []))

test('le tirage du Pari : une facile ou moyenne, sa seconde difficile ou experte de la même catégorie, rien deux fois dans le plan', () => {
  for (let essai = 0; essai < 20; essai++) {
    // Trois manches et trois rechanges : la force 3 de Changer.
    const plan = tirerLePlan('pari', contexte(), 3) as PariTire[]
    assert.equal(plan.length, 6)
    for (const t of plan) {
      assert.ok(['facile', 'moyen'].includes(t.q1.niveau) && t.q1.niveau === niveauDe(t.q1.id), `${t.q1.id} : ${t.q1.niveau}`)
      assert.ok(['difficile', 'expert'].includes(t.q2.niveau) && t.q2.niveau === niveauDe(t.q2.id), `${t.q2.id} : ${t.q2.niveau}`)
      assert.equal(t.q2.categorie, t.q1.categorie, 'la seconde, de la même catégorie')
      // Telle que la partie la garde : ses réponses mélangées pour elle, sa bonne suivie.
      const base = BASE_DU_TIRAGE.parId.get(t.q1.id)!
      assert.equal(t.q1.reponses[t.q1.bonne], base.reponses[base.bonne])
    }
    const ids = idsDuPlan(plan)
    assert.equal(new Set(ids).size, ids.length, 'jamais deux fois la même question, rechanges comprises')
    assert.equal(new Set(plan.slice(0, 3).map(t => t.q1.categorie)).size, 3, 'les trois manches tournent sur les catégories')
  }
})

test('le tirage de l’Éclair : cinq affirmations d’une même catégorie, faciles ou moyennes, récrites par la règle du jeu', () => {
  for (let essai = 0; essai < 20; essai++) {
    const plan = tirerLePlan('eclair', contexte(), 1) as EclairTire[]
    assert.equal(plan.length, 4)
    for (const t of plan) {
      assert.equal(t.affirmations.length, B.AFFIRMATIONS_DE_L_ECLAIR)
      assert.equal(new Set(t.affirmations.map(a => a.question.categorie)).size, 1, 'une seule catégorie : sa pièce en a une')
      for (const a of t.affirmations) {
        assert.ok(['facile', 'moyen'].includes(a.question.niveau))
        assert.ok(Number.isInteger(a.proposee) && a.proposee >= 0 && a.proposee < 4)
      }
    }
    const ids = idsDuPlan(plan)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('rien ne revient avant sept jours, d’un jeu à l’autre : un composé de l’Éclair se déplie, et le Pari ne le repose pas', () => {
  // Le tireur, sur des vues déjà dépliées : que le magasin les déplie avant de tirer, c'est `cabinet-journal.test.ts`
  // qui l'éprouve, par les routes.
  // Il a vu, il y a six jours, à l'Éclair, toutes les faciles et moyennes de toutes les catégories sauf cinq.
  const faciles = BASE_DU_TIRAGE.questions.filter(q => ['facile', 'moyen'].includes(niveauDe(q.id)))
  const neuves = new Set(faciles.slice(0, 5).map(q => q.id))
  const vuesAvant = faciles.filter(q => !neuves.has(q.id)).map(q => q.id)
  const ilYA = (jours: number) => DIX_HEURES - jours * 24 * 3_600_000
  const composes = new Map<string, number>()
  for (let i = 0; i < vuesAvant.length; i += 5) composes.set(idDeLEclair(vuesAvant.slice(i, i + 5)), ilYA(6))
  const vues = vuesDuCabinet(composes)
  for (let essai = 0; essai < 10; essai++) {
    const [t] = tirerLePlan('pari', contexte(vues), 0) as PariTire[]
    assert.ok(neuves.has(t.q1.id), `${t.q1.id} vue il y a six jours, reposée devant une jamais vue`)
  }
  // Les jamais vues épuisées, la moins récemment vue revient : celle d'il y a huit jours devant celle d'il y a six.
  const toutes = new Map<string, number>(faciles.map(q => [q.id, ilYA(neuves.has(q.id) ? 8 : 6)]))
  for (let essai = 0; essai < 10; essai++) {
    const [t] = tirerLePlan('pari', contexte(toutes), 0) as PariTire[]
    assert.ok(neuves.has(t.q1.id), `${t.q1.id} : vue il y a six jours, passée devant une vue il y a huit`)
  }
})

test('le tas des QCM du Cabinet : quatre réponses courtes, un intitulé court, et aucune réponse dite dans l’intitulé', () => {
  const q = (texte: string, reponses: string[]) => ({ texte, reponses })
  assert.equal(estUnQcmDuCabinet(q('Quelle est la capitale de la Lituanie ?', ['Riga', 'Vilnius', 'Tallinn', 'Minsk'])), true)
  assert.equal(estUnQcmDuCabinet(q('La Terre est-elle ronde ?', ['Vrai', 'Faux'])), false, 'un vrai ou faux de la base')
  assert.equal(estUnQcmDuCabinet(q(`${'Une question bien trop longue pour se lire chrono en marche. '.repeat(3)}?`, ['a', 'b', 'c', 'd'])), false)
  assert.equal(estUnQcmDuCabinet(q('Qui ?', ['Une réponse bien trop longue pour tenir sur un bouton', 'b', 'c', 'd'])), false)
  assert.equal(estUnQcmDuCabinet(q('Quel fleuve traverse Lyon, le Rhône ou la Seine ?', ['le Rhône', 'la Loire', 'la Seine', 'la Garonne'])), false, 'l’intitulé la dit')
})

/** Un contexte de tirage sur ces seules questions, à cette heure, au hasard qu'on lui donne. */
const surCesQuestions = (jouables: readonly QuestionDeLaBase[], o: { maintenant?: number; vues?: ReadonlyMap<string, number>; hasard?: () => number } = {}): ContexteDuTirage => ({
  porte: PORTE_D_ESSAI,
  jouables,
  mesures: MESURE,
  vues: o.vues ?? new Map(),
  maintenant: o.maintenant ?? DIX_HEURES,
  hasard: o.hasard ?? Math.random,
})

test('le tirage du Mot mystère : le mot que la règle du jeu lit de la question, facile ou moyen — jamais deux fois le même dans un plan', () => {
  for (let essai = 0; essai < 20; essai++) {
    // Trois manches et trois rechanges : la force 3 de Changer.
    const plan = tirerLePlan('mot', contexte(), 3) as MotTire[]
    assert.equal(plan.length, 6)
    for (const t of plan) {
      const base = BASE_DU_TIRAGE.parId.get(t.question.id)!
      // Ses lettres et ce qu'elle écrit, de la seule règle du jeu : le tireur n'a pas la sienne.
      assert.deepEqual({ lettres: t.lettres, affiche: t.affiche }, motDeLaQuestion(base))
      assert.ok(t.lettres.length >= B.LETTRES_DU_MOT_MIN && t.lettres.length <= B.LETTRES_DU_MOT_MAX)
      assert.ok(B.MARCHES_DU_MOT.includes(t.question.niveau) && t.question.niveau === niveauDe(t.question.id), `${t.question.id} : ${t.question.niveau}`)
      // Telle que la partie la garde : ses réponses mélangées pour elle, sa bonne suivie.
      assert.equal(t.question.reponses[t.question.bonne], t.affiche)
    }
    assert.equal(new Set(plan.map(t => t.lettres)).size, plan.length, 'jamais deux fois le même mot, rechanges comprises')
    assert.equal(new Set(plan.slice(0, 3).map(t => t.question.categorie)).size, 3, 'les trois manches tournent sur les catégories')
  }
  // Deux questions de la base qui mènent au même mot : une seule par partie — la révélation de l'une donnait l'autre.
  const [a, b, c] = CATEGORIES
  const balcon = motDuCabinet(0, a)
  const jumeau = { ...motDuCabinet(0, b), id: 'mot90000' }
  assert.equal(motDeLaQuestion(jumeau)?.lettres, motDeLaQuestion(balcon)?.lettres)
  for (let essai = 0; essai < 20; essai++) {
    const plan = tirerLePlan('mot', surCesQuestions([balcon, jumeau, motDuCabinet(2, b), motDuCabinet(4, c)]), 1) as MotTire[]
    assert.equal(plan.length, 3, 'trois mots distincts, et pas de rechange : le quatrième redirait le premier')
    assert.equal(new Set(plan.map(t => t.lettres)).size, 3)
  }
  // Sans trois mots à poser, pas de partie : le départ le dit (« Ce jeu n’a pas de quoi jouer aujourd’hui »).
  assert.equal(tirerLePlan('mot', surCesQuestions([balcon, jumeau, motDuCabinet(2, b)]), 0), null)
})

test('le tirage du Filet : une année ou une estimation de la base, sa piste au hasard du serveur — jamais deux fois la même valeur', () => {
  for (let essai = 0; essai < 20; essai++) {
    const plan = tirerLePlan('filet', contexte(), 3) as FiletTire[]
    assert.equal(plan.length, 6)
    for (const t of plan) {
      const v = valeurDuFilet(BASE_DU_TIRAGE.parId.get(t.question.id)!)!
      assert.deepEqual({ valeur: t.valeur, annee: t.annee, ...(t.unite !== undefined && { unite: t.unite }) }, v, 'la valeur que dit la question de la base')
      assert.ok(t.piste.min <= t.valeur && t.valeur <= t.piste.max, `${t.valeur} hors de ${JSON.stringify(t.piste)}`)
      if (t.annee) assert.ok(t.piste.max <= 2026, 'une piste d’années s’arrête à l’année du départ')
      assert.ok(B.MARCHES_DU_FILET.includes(t.question.niveau) && t.question.niveau === niveauDe(t.question.id))
      assert.equal(t.question.reponses[t.question.bonne], BASE_DU_TIRAGE.parId.get(t.question.id)!.reponses[0])
    }
    assert.equal(new Set(plan.map(t => t.valeur)).size, plan.length, 'jamais deux fois la même valeur')
    assert.ok(plan.some(t => t.annee) && plan.some(t => !t.annee && t.unite === 'km'), 'des années et des estimations, l’unité dite')
  }
  // La piste vient du hasard du tirage — celui du serveur, que le magasin lui donne —, jamais d'une graine : au plus bas,
  // la réponse tombe en bas de sa piste ; au plus haut, en haut — une estimation un peu moins, sa borne arrondie au-dessus
  // pour se lire (`borneRonde`). Une année comme une estimation.
  const trois = [valeurDuCabinet(0, CATEGORIES[0]), valeurDuCabinet(1, CATEGORIES[1]), valeurDuCabinet(2, CATEGORIES[2])]
  const places = (h: number) => (tirerLePlan('filet', surCesQuestions(trois, { hasard: () => h }), 0) as FiletTire[]).map(t => (t.valeur - t.piste.min) / (t.piste.max - t.piste.min))
  for (const x of places(0)) assert.ok(x >= B.POSITION_DE_LA_REPONSE[0] && x < 0.1, `en bas : ${x}`)
  for (const x of places(0.9999)) assert.ok(x > 0.8 && x <= B.POSITION_DE_LA_REPONSE[1], `en haut : ${x}`)

  // Deux questions de la base qui visent la même valeur — la base en a plus de deux cents, 1789 en tête — : une seule par
  // partie, la révélation de l'une donnait l'autre. Les valeurs d'essai sont toutes distinctes : il y faut un jumeau.
  const [a, b, c, d] = CATEGORIES
  const bastille = anneeDuCabinet(80, a, 1789)
  const jumelle = anneeDuCabinet(81, b, 1789)
  for (let essai = 0; essai < 20; essai++) {
    const plan = tirerLePlan('filet', surCesQuestions([bastille, jumelle, valeurDuCabinet(1, c), valeurDuCabinet(3, d)]), 1) as FiletTire[]
    assert.equal(plan.length, 3, 'trois valeurs distinctes, et pas de rechange : la quatrième redirait la première')
    assert.equal(new Set(plan.map(t => t.valeur)).size, 3)
  }
  // Sans trois valeurs à viser, pas de partie.
  assert.equal(tirerLePlan('filet', surCesQuestions([bastille, jumelle, valeurDuCabinet(1, c)]), 0), null)
  // Les manches tournent sur les catégories : deux valeurs d'une même catégorie n'en font qu'une manche, tant qu'une autre a de quoi.
  for (let essai = 0; essai < 20; essai++) {
    const plan = tirerLePlan('filet', surCesQuestions([anneeDuCabinet(82, a, 1600), anneeDuCabinet(84, a, 1650), valeurDuCabinet(1, b), valeurDuCabinet(3, c)]), 0) as FiletTire[]
    assert.equal(new Set(plan.map(t => t.question.categorie)).size, 3, JSON.stringify(plan.map(t => t.question.id)))
  }
})

test('le tirage du Filet lit l’année du jour de Paris du départ, jamais l’horloge : une année trop récente se remplace par une autre', () => {
  // 1981 se pose dès 2027 — quarante-six ans de recul (`seTendAuFilet`). Le 31 décembre 2026 à 23 h 30 à Paris (22 h 30 en
  // temps universel), elle ne se pose pas ; une heure plus tard, le 1er janvier 2027 à Paris — encore 2026 en temps universel —, si.
  const [a, b, c, d] = CATEGORIES
  const recente = anneeDuCabinet(90, a, 1981)
  const autres = [valeurDuCabinet(1, b), valeurDuCabinet(3, c)]
  const avant = Date.UTC(2026, 11, 31, 22, 30)
  const apres = Date.UTC(2026, 11, 31, 23, 30)
  assert.equal(new Date(apres).getUTCFullYear(), 2026)
  assert.equal(tirerLePlan('filet', surCesQuestions([recente, ...autres], { maintenant: avant }), 0), null, 'trop récente en 2026 : deux questions, pas de partie')
  for (let essai = 0; essai < 10; essai++) {
    const plan = tirerLePlan('filet', surCesQuestions([recente, ...autres], { maintenant: apres }), 0) as FiletTire[]
    const la = plan.find(t => t.question.id === recente.id)
    assert.ok(la, 'posée en 2027')
    assert.ok(la.piste.max <= 2027 && la.piste.min <= 1981, JSON.stringify(la.piste))
  }
  // Une année trop récente ne bloque rien : jamais vue, elle passe après une vue il y a trois jours — elle ne se tire pas.
  const vueIlYA = new Map([[valeurDuCabinet(0, d).id, DIX_HEURES - 3 * 24 * 3_600_000]])
  for (let essai = 0; essai < 10; essai++) {
    const plan = tirerLePlan('filet', surCesQuestions([anneeDuCabinet(91, a, 2001), valeurDuCabinet(0, d), ...autres], { vues: vueIlYA }), 0) as FiletTire[]
    assert.deepEqual(plan.map(t => t.question.id).sort(), [valeurDuCabinet(0, d).id, ...autres.map(q => q.id)].sort())
  }
})

test('le tas du Filet : une année entière, ou une estimation jouée au plus près — jamais un intitulé qui dit sa valeur ou suppose ses choix', () => {
  const [a] = CATEGORIES
  assert.deepEqual(valeurDuFilet(anneeDuCabinet(0, a, 1789)), { valeur: 1789, annee: true })
  assert.deepEqual(valeurDuFilet(valeurDuCabinet(1, a)), { valeur: 1231, annee: false, unite: 'km' })
  const avec = (q: QuestionDeLaBase, texte: string): QuestionDeLaBase => ({ ...q, texte })
  assert.equal(valeurDuFilet(avec(anneeDuCabinet(0, a, 1789), 'La Bastille tombe en 1789 : en quelle année ?')), null, 'l’intitulé dit l’année')
  assert.equal(valeurDuFilet(avec(valeurDuCabinet(1, a), 'Combien de kilomètres, 1 231 environ, le Cabinet compte-t-il ?')), null, 'l’intitulé dit le nombre, une espace dedans')
  assert.equal(valeurDuFilet(avec(anneeDuCabinet(0, a, 1789), 'Laquelle de ces années vit la prise de la Bastille ?')), null, 'il suppose ses choix')
  assert.equal(valeurDuFilet(motDuCabinet(0, a)), null, 'un mot ne se vise pas')
  assert.equal(valeurDuFilet(BASE_DU_TIRAGE.questions[0]), null, 'une question sans valeur')
  // En chiffres romains aussi, l'intitulé dit sa valeur (hfc1jqv0, wbwha5mi dans la base) ; un mot romain qui en dit une
  // autre — Louis XVI, et non 1793 — ne retire rien.
  assert.equal(valeurDuFilet(avec(anneeDuCabinet(0, a, 1789), 'Quelle année s’écrit MDCCLXXXIX en chiffres romains ?')), null, 'MDCCLXXXIX, 1789')
  assert.deepEqual(valeurDuFilet(avec(anneeDuCabinet(0, a, 1793), 'En quelle année Louis XVI est-il guillotiné ?')), { valeur: 1793, annee: true })
  assert.equal(valeurDuFilet(avec(valeurDuCabinet(1, a), 'Combien de kilomètres font MCCXXXI pas du Cabinet ?')), null, 'MCCXXXI, 1231')
  // Une réponse de 1000 à 2099 a la forme d'une année sans en être une, si l'intitulé ne la demande pas : ni piste
  // d'années, ni estimation (kvw7f8ri, 1729 ; 62wo2j0e, 12 en binaire).
  assert.equal(valeurDuFilet(avec(anneeDuCabinet(0, a, 1729), 'Quel est le plus petit entier qui s’écrit de deux façons comme somme de deux cubes ?')), null)
  assert.deepEqual(valeurDuFilet(avec(anneeDuCabinet(0, a, 1940), 'Quelle est l’année de la découverte de la grotte de Lascaux ?')), { valeur: 1940, annee: true })
  // Un numéro ne se vise pas plus qu'il ne s'estime, même au milieu de l'intitulé (b700w4ib : le maillot de l'arrière).
  const maillot = { ...valeurDuCabinet(1, a), texte: 'Au rugby, quel numéro de maillot porte l’arrière ?' }
  assert.equal(valeurDuFilet(maillot), null)
})

test('par les routes : le Pari et l’Éclair d’un bout à l’autre — neuf étoiles et le cadre doré, le pari perdu, les étoiles gardées', async () => {
  const b = await bancDuCabinet()
  try {
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const parfait = await unPariParfait(b, lea, ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari'))
    assert.deepEqual([parfait.phase, parfait.bilan?.total, parfait.bilan?.naturel, parfait.bilan?.aidee], ['finie', 9, [3, 3, 3], false])
    assert.equal(parfait.bilan?.issue, 'libre', 'une partie libre ne gagne pas d’œuvre')
    assert.equal(parfait.bilan?.poussiere, 9 * B.POUSSIERE_PAR_ETOILE)

    // Le pari perdu, puis les étoiles gardées, puis une manche ratée : 0, 2, 0.
    let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari')
    v = await jouerUnPari(b, lea, v, 0, 'parier-faux')
    assert.equal(v.revelation?.corps.jeu, 'pari')
    assert.equal((v.revelation?.corps as { titre: string }).titre, 'Pari perdu')
    v = await ouvrirLaManche(b, lea, v, 1)
    v = await jouerUnPari(b, lea, v, 1, 'garder')
    v = await ouvrirLaManche(b, lea, v, 2)
    v = await jouerUnPari(b, lea, v, 2, 'rater')
    assert.deepEqual(v.bilan?.etoiles, [0, B.ETOILES_DU_PARI.garder, 0])

    // L'Éclair : trois manches justes, neuf étoiles.
    let e = ok(await commencer(b, lea, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair')
    for (let k = 0; k < 3; k++) {
      if (k > 0) e = await ouvrirLaManche(b, lea, e, k)
      e = await jouerUnEclair(b, lea, e, k)
    }
    assert.deepEqual([e.phase, e.bilan?.total, e.bilan?.naturel], ['finie', 9, [3, 3, 3]])
    assert.equal(e.bilan?.cartel?.manche, 0, 'le cartel garde la plus étoilée qui a une anecdote, la première à égalité')
  } finally {
    await b.banc.close()
  }
})

test('par les routes : le Mot mystère et le Filet d’un bout à l’autre — les couleurs que rend le serveur, la longueur refusée en mots, le filet lancé', async () => {
  const b = await bancDuCabinet()
  try {
    const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
    // Le Mot : trouvé au deuxième essai, au troisième, puis jamais — 3, 2, 0.
    let m = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'mot', carte: null }), 'le Mot')
    const t0 = motDe(b, m.id, 0)
    assert.deepEqual(m.enCours, { jeu: 'mot', categorie: t0.question.categorie, texte: t0.question.texte, longueur: t0.lettres.length, essaisMax: B.ESSAIS_DU_MOT, essais: [], soufflees: [] })
    // Une longueur fausse se refuse en mots, sans rien dépenser ; des minuscules ne se lisent pas.
    const court = await unGeste(b, zoe, m, { quoi: 'essai', manche: 0, lettres: 'AB' })
    assert.deepEqual([court.status, court.corps], [400, { error: `Il faut ${t0.lettres.length} lettres` }])
    assert.deepEqual((await unGeste(b, zoe, m, { quoi: 'essai', manche: 0, lettres: t0.lettres.toLowerCase() })).corps, { error: 'Ce geste ne se lit pas : recharge la page' })
    // Un essai aux lettres doubles : ses couleurs, rendues par le serveur, ne colorent pas plus de fois la lettre que le mot ne l'a.
    const doubles = t0.lettres[0].repeat(t0.lettres.length)
    m = ok(await unGeste(b, zoe, m, { quoi: 'essai', manche: 0, lettres: doubles }), 'l’essai aux doubles')
    const [essai] = (m.enCours as MotMontre).essais
    assert.deepEqual(essai, { lettres: doubles, couleurs: couleursDuMot(doubles, t0.lettres) })
    assert.equal(essai.couleurs.filter(c => c !== 'absente').length, [...t0.lettres].filter(l => l === t0.lettres[0]).length)
    m = ok(await unGeste(b, zoe, m, { quoi: 'essai', manche: 0, lettres: t0.lettres }), 'le mot')
    assert.equal((m.revelation?.corps as MotRevele).titre, 'Trouvé en 2 essais')
    m = await ouvrirLaManche(b, zoe, m, 1)
    m = await jouerUnMot(b, zoe, m, 1, 3)
    m = await ouvrirLaManche(b, zoe, m, 2)
    m = await jouerUnMot(b, zoe, m, 2, null)
    assert.equal((m.revelation?.corps as MotRevele).titre, `C’était « ${motDe(b, m.id, 2).affiche} »`)
    assert.deepEqual([m.phase, m.bilan?.naturel, m.bilan?.total], ['finie', [3, 2, 0], 5])

    // Le Filet : dans le petit, puis le moyen, puis à côté du grand — 3, 2, 0.
    let f = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'filet', carte: null }), 'le Filet')
    const f0 = filetDe(b, f.id, 0)
    assert.deepEqual(f.enCours, { jeu: 'filet', categorie: f0.question.categorie, texte: f0.question.texte, annee: f0.annee, ...(f0.unite !== undefined && { unite: f0.unite }), piste: f0.piste, zone: null })
    assert.equal((await unGeste(b, zoe, f, { quoi: 'repondre', manche: 0, reponse: { filet: { x: f0.piste.max + 1, taille: 'petit' } } })).status, 400, 'hors de la piste')
    f = await jouerUnFilet(b, zoe, f, 0, 'petit')
    assert.equal((f.revelation?.corps as FiletRevele).titre, 'Dans le filet')
    f = await ouvrirLaManche(b, zoe, f, 1)
    f = await jouerUnFilet(b, zoe, f, 1, 'moyen')
    f = await ouvrirLaManche(b, zoe, f, 2)
    f = await jouerUnFilet(b, zoe, f, 2, 'grand', false)
    assert.equal((f.revelation?.corps as FiletRevele).titre, 'À côté')
    assert.deepEqual([f.phase, f.bilan?.naturel, f.bilan?.total], ['finie', [3, 2, 0], 5])
    // Laissé au temps : la page envoie sa réponse vide à l'échéance, passée la grâce — la manche se juge sans lancer.
    const x = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'filet', carte: null }), 'le Filet laissé au temps')
    b.horloge.t = x.chrono!.echeance + B.GRACE_D_UNE_MANCHE_MS + 1
    const expire = ok(await unGeste(b, zoe, x, { quoi: 'repondre', manche: 0, auto: true }), 'l’échéance')
    assert.equal((expire.revelation?.corps as FiletRevele).titre, 'Pas de lancer')
    ok(await unGeste(b, zoe, expire, { quoi: 'quitter' }), 'quitter')

    // Une œuvre qui se trouve au Mot mystère, au Filet, se chasse à son jeu.
    for (const jeu of ['mot', 'filet'] as const) {
      const oeuvre = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === jeu && !OEUVRES_DE_DEPART.includes(o.cle))!
      const chasse = ok(await commencer(b, zoe, { origine: 'chasse', oeuvre: oeuvre.cle, carte: null }), `la chasse au jeu ${jeu}`)
      assert.equal(chasse.jeu, jeu)
      ok(await unGeste(b, zoe, chasse, { quoi: 'quitter' }), 'quitter la chasse')
    }
  } finally {
    await b.banc.close()
  }
})

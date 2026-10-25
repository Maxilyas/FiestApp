// Le Détail et la Frise du Cabinet de curiosités (`shared/cabinet/jeux/`, la
// règle `.claude/rules/cabinet.md`) : leurs règles, sans serveur, puis au
// serveur. Le Détail — un tableau en quatre cadrages emboîtés ; « Reculer d'un
// pas » en montre plus et coûte une étoile ; quatre titres d'époques voisines.
// La Frise — une seule frise qui grandit, trois événements, puis cinq, puis
// sept, du plus ancien au plus récent. Au serveur (le lot C2) : leur tirage, sur
// la base livrée, le plancher des frises de sujets, la route des cadrages — rien
// avant d'être atteint, l'adresse d'un tirage, jamais celle d'une manche — et
// une partie de chacun par les routes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import express from 'express'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { hasardDe } from '../../shared/missions'
import { PREFIXE_DE_LA_FRISE, anneeDite, choisirLaFriseSansRepli } from '../../shared/frise'
import { ERREUR_SERVEUR } from '../src/core/http'
import { releve } from '../src/core/pouls'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { detailsDeLaBase, fichierDuCadrage, tableauxDuDetail } from '../src/core/details'
import { evenementsDeLaBase } from '../src/core/frises'
import { contenuDuCabinet } from '../src/core/cabinet/contenu'
import { tirerLePlan, type ContexteDuTirage } from '../src/core/cabinet/tirages/index'
import { frisesDesSujets } from '../src/core/cabinet/tirages/tas'
import { PARTIE_INTROUVABLE, TABLEAU_INTROUVABLE } from '../src/core/cabinet/magasin'
import { CABINET_SANS_PROFIL } from '../src/cabinet'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  bancDuCabinet,
  commencer,
  departEnBase,
  detailDe,
  dossierDEssai,
  enBase,
  fermerLesMagasins,
  friseDe,
  magasinDEssai,
  jouer,
  jouerUnDetail,
  jouerUneFrise,
  laPage,
  ok,
  ouvrir,
  unCadrage,
  type BancDuCabinet,
} from './cabinet-banc'
import { CATEGORIES } from '../../shared/categories'
import { NIVEAUX } from '../../shared/campagne'
import { sujetParCle, estRemplace } from '../../shared/sujets'
import { CATEGORIE_DU_DETAIL } from '../../shared/expedition'
import {
  DUREES_DES_JEUX,
  ECART_DES_ANNEES_DE_LA_FRISE,
  EFFACES_AU_PLUS,
  ERREURS_DE_LA_FRISE,
  ERREURS_D_UN_OUBLI,
  ETOILES_AU_CADRAGE,
  EVENEMENTS_D_UNE_FRISE_A_THEME,
  TITRES_DU_DETAIL,
  VAGUES_DE_LA_FRISE,
  VOISINS_EN_ANNEES,
} from '../../shared/cabinet/bareme'
import { effacablesAuPlus, refusDuPouvoir } from '../../shared/cabinet/pouvoirs'
import { PREFIXE_DU_CABINET, deplier, idDeLaFriseATheme, idDeLaFriseDeSujet, idDuTableau } from '../../shared/cabinet/pieces'
import { JEUX, justeDeLaPiece } from '../../shared/cabinet/jeux/regle'
import { GESTE_A_JUGER } from '../../shared/cabinet/jeux/outils'
import { vuesDuCabinet } from '../../shared/cabinet/vues'
import {
  QUESTION_DU_TABLEAU,
  REGLE_DU_DETAIL,
  adresseDUnCadrage,
  detailTire,
  refusDuCadrage,
  type DetailTire,
  type EtatDuDetail,
  type TableauDuCabinet,
} from '../../shared/cabinet/jeux/detail'
import {
  REGLE_DE_LA_FRISE,
  erreursComptees,
  erreursDeLaFrise,
  etoilesDeLaFrise,
  friseEnVagues,
  type EtatDeLaFrise,
  type FriseAPartager,
  type FriseTiree,
} from '../../shared/cabinet/jeux/frise'

/** La phrase que dit la seule règle des refus quand le jeu n'a plus rien à souffler : les jeux ne la recopient pas. */
const RIEN_A_ECLAIRER = refusDuPouvoir({ pouvoir: 'eclairer', force: 3, jeu: 'detail', servi: 0, aEclairer: false })

// ── Le Détail ─────────────────────────────────────────────────────────────

const CIBLE: TableauDuCabinet = { qid: 'Q100', titre: 'La Cible', peintre: 'Anne Peintre', annee: 1600 }
/** Les cinq plus proches de 1600 sont à 1, 2, 5, 10 et 12 ans ; les autres, plus loin. */
const AUTRES: TableauDuCabinet[] = [
  { qid: 'Q1', titre: 'Le Voisin', peintre: 'Bruno', annee: 1601 },
  { qid: 'Q2', titre: 'La Voisine', peintre: 'Carla', annee: 1598 },
  { qid: 'Q3', titre: 'Le Port', peintre: 'Bruno', annee: 1605 },
  { qid: 'Q4', titre: 'La Moisson', peintre: 'Denis', annee: 1590 },
  { qid: 'Q5', titre: 'Le Concert', peintre: 'Emma', annee: 1612 },
  { qid: 'Q6', titre: 'La Tempête', peintre: 'Fanny', annee: 1580 },
  { qid: 'Q7', titre: 'Le Pont', peintre: 'Gilles', annee: 1650 },
  { qid: 'Q8', titre: 'Les Nymphéas', peintre: 'Hugo', annee: 1700 },
  { qid: 'Q9', titre: 'La Madone', peintre: 'Inès', annee: 1400 },
]
const LES_CINQ = ['Le Voisin', 'La Voisine', 'Le Port', 'La Moisson', 'Le Concert']

function unDetail(graine = 'detail', anecdote: string | null = null): DetailTire {
  const t = detailTire(CIBLE, AUTRES, hasardDe(graine), { anecdote, categorie: 'Arts & lettres' })
  assert.ok(t, 'le tableau a de quoi proposer trois voisins')
  return t
}

/** Reculer tant de pas depuis l'ouverture. */
function reculer(t: DetailTire, pas: number): EtatDuDetail {
  let e = REGLE_DU_DETAIL.ouvrir(t)
  for (let i = 0; i < pas; i++) {
    const apres = REGLE_DU_DETAIL.apresLeGeste(t, e, { quoi: 'reculer' })
    assert.equal(typeof apres, 'object', `le pas ${i + 1} se fait`)
    e = apres as EtatDuDetail
  }
  return e
}

const unAutreTitre = (t: DetailTire) => t.titres.findIndex((_, i) => i !== t.bonne)

test('le Détail : chaque pas en arrière vaut une étoile de moins, juste au deuxième cadrage au plus', () => {
  const t = unDetail()
  const cadrages = ETOILES_AU_CADRAGE.length
  assert.deepEqual([...ETOILES_AU_CADRAGE], [3, 2, 1, 0], 'au 1er cadrage ★★★, au 2e ★★, au 3e ★, au tableau entier rien')
  for (let pas = 0; pas < cadrages; pas++) {
    const e = reculer(t, pas)
    const vu = REGLE_DU_DETAIL.montrer(t, e)
    assert.equal(vu.cadrage, pas + 1)
    assert.equal(vu.cadrages, cadrages)
    assert.equal(vu.vaut, ETOILES_AU_CADRAGE[pas], 'la vue dit ce que vaut la réponse maintenant')
    assert.equal(vu.peutReculer, pas + 1 < cadrages)
    const v = REGLE_DU_DETAIL.juger(t, e, { quoi: 'repondre', titre: t.bonne })
    assert.equal(v.naturel, ETOILES_AU_CADRAGE[pas])
    assert.equal(v.pieces.length, 1, 'une pièce par manche')
    const juste = justeDeLaPiece(v.naturel, 'detail')
    assert.equal(v.pieces[0].juste, juste)
    assert.equal(juste, pas + 1 <= 2, 'reconnu au deuxième cadrage au plus')
    // La colonne `choix` suit la juste : 0, la réponse dite ; −1, une réponse qui ne paie pas.
    assert.equal(v.pieces[0].choix, juste ? 0 : -1)
    assert.equal(v.pieces[0].composee, `${pas + 1}|${t.bonne}`, 'le cadrage, puis le titre choisi')
  }
  // Le tableau entier : plus rien à reculer.
  assert.equal(REGLE_DU_DETAIL.apresLeGeste(t, reculer(t, cadrages - 1), { quoi: 'reculer' }), 'Tu vois déjà le tableau entier')
})

test('le Détail : « Reculer » ne tranche pas la manche, une réponse si — égarée hors du jugement, elle ne change rien', () => {
  // Le pli demande d'abord au jeu si un geste tranche : sans quoi « Reculer » se jugerait, et la manche tomberait à zéro.
  const t = unDetail()
  const e = reculer(t, 1)
  assert.equal(REGLE_DU_DETAIL.tranche(t, e, { quoi: 'reculer' }), false)
  assert.equal(REGLE_DU_DETAIL.tranche(t, e, { quoi: 'repondre', titre: t.bonne }), true)
  assert.equal(REGLE_DU_DETAIL.tranche(t, e, { quoi: 'repondre', titre: null }), true, 'à l’échéance, sans réponse aussi')
  // La même phrase que les autres jeux du Cabinet : un geste qui se juge ne passe jamais par `apresLeGeste`.
  assert.equal(REGLE_DU_DETAIL.apresLeGeste(t, e, { quoi: 'repondre', titre: t.bonne }), GESTE_A_JUGER)
})

test('le Détail : un faux titre, le temps écoulé ou la partie quittée ne valent rien', () => {
  const t = unDetail()
  const e = reculer(t, 1)
  const faux = REGLE_DU_DETAIL.juger(t, e, { quoi: 'repondre', titre: unAutreTitre(t) })
  assert.equal(faux.naturel, 0)
  assert.deepEqual(faux.pieces, [{ juste: false, choix: -1, composee: `2|${unAutreTitre(t)}` }])
  // Sans réponse, le serveur sait seulement jusqu'où il avait reculé : `.` dit « pas répondu », comme à l'Éclair.
  for (const r of ['expiree', 'quittee', { quoi: 'repondre', titre: null }] as const) {
    const v = REGLE_DU_DETAIL.juger(t, e, r)
    assert.equal(v.naturel, 0, JSON.stringify(r))
    assert.deepEqual(v.pieces, [{ juste: false, choix: null, composee: '2|.' }], JSON.stringify(r))
  }
})

test('le Détail : trois titres d’époques voisines, tirés parmi les cinq plus proches en années, dans un ordre figé au départ', () => {
  assert.equal(TITRES_DU_DETAIL, 4)
  assert.equal(VOISINS_EN_ANNEES, 5)
  const vusEnLeurre = new Set<string>()
  const places = new Set<number>()
  for (let i = 0; i < 300; i++) {
    const t = unDetail(`detail:${i}`)
    assert.equal(t.jeu, 'detail')
    assert.equal(t.titres.length, TITRES_DU_DETAIL)
    assert.equal(new Set(t.titres.map(x => x.titre)).size, TITRES_DU_DETAIL, 'quatre titres différents')
    assert.deepEqual(t.titres[t.bonne], { titre: CIBLE.titre, peintre: CIBLE.peintre }, 'le bon, avec son peintre')
    const leurres = t.titres.filter((_, k) => k !== t.bonne)
    for (const l of leurres) {
      assert.ok(LES_CINQ.includes(l.titre), `${l.titre} n’est pas parmi les cinq plus proches en années`)
      vusEnLeurre.add(l.titre)
      assert.equal(l.peintre, AUTRES.find(x => x.titre === l.titre)!.peintre, 'chaque titre avec son peintre')
    }
    places.add(t.bonne)
  }
  assert.deepEqual([...vusEnLeurre].sort(), [...LES_CINQ].sort(), 'chacun des cinq plus proches finit par être proposé')
  assert.deepEqual([...places].sort(), [0, 1, 2, 3], 'le bon titre n’a pas de place à lui')
  // La même graine redonne la même manche : une reprise après un redémarrage redonne les mêmes titres, au même ordre.
  assert.deepEqual(unDetail('reprise'), unDetail('reprise'))
})

test('le Détail : à écart égal en années, l’identifiant départage — l’ordre du fichier ne change rien à la manche', () => {
  // Deux à deux à la même distance de 1600 : sans départage, l'ordre où le serveur lit ses tableaux choisirait les
  // voisins, et une graine rejouée après un fichier réordonné ne redonnerait plus la même manche.
  const egaux: TableauDuCabinet[] = [
    { qid: 'Q31', titre: 'L’Aube', peintre: 'Jean', annee: 1599 },
    { qid: 'Q32', titre: 'Le Midi', peintre: 'Karl', annee: 1601 },
    { qid: 'Q33', titre: 'Le Soir', peintre: 'Léa', annee: 1598 },
    { qid: 'Q34', titre: 'La Nuit', peintre: 'Marc', annee: 1602 },
    { qid: 'Q35', titre: 'Le Printemps', peintre: 'Nina', annee: 1597 },
    { qid: 'Q36', titre: 'L’Hiver', peintre: 'Omar', annee: 1603 },
  ]
  const tirer = (autres: readonly TableauDuCabinet[], graine: string) => detailTire(CIBLE, autres, hasardDe(graine), { anecdote: null, categorie: 'Arts & lettres' })
  for (let i = 0; i < 60; i++) {
    const t = tirer(egaux, `egaux:${i}`)
    assert.ok(t)
    assert.deepEqual(tirer([...egaux].reverse(), `egaux:${i}`), t, 'le même tirage, le fichier à rebours')
    // À trois ans, Q35 passe avant Q36 : L'Hiver n'est jamais parmi les cinq plus proches.
    assert.ok(!t.titres.some(x => x.titre === 'L’Hiver'), JSON.stringify(t.titres))
  }
})

test('le Détail : pas de manche sans trois voisins, et jamais deux fois le même titre', () => {
  assert.equal(detailTire(CIBLE, AUTRES.slice(0, 2), hasardDe('peu'), { anecdote: null, categorie: 'Arts & lettres' }), null)
  // Le tableau lui-même, ou un autre du même titre, ne se propose pas en leurre ; deux voisins homonymes, une fois.
  const homonymes: TableauDuCabinet[] = [
    CIBLE,
    { qid: 'Q50', titre: CIBLE.titre, peintre: 'Un autre', annee: 1600 },
    { qid: 'Q51', titre: 'Le Double', peintre: 'Jean', annee: 1601 },
    { qid: 'Q52', titre: 'Le Double', peintre: 'Jeanne', annee: 1602 },
    { qid: 'Q53', titre: 'Le Tiers', peintre: 'Karl', annee: 1603 },
  ]
  assert.equal(detailTire(CIBLE, homonymes, hasardDe('homonymes'), { anecdote: null, categorie: 'Arts & lettres' }), null, 'deux titres seulement à proposer')
  const t = detailTire(CIBLE, [...homonymes, { qid: 'Q54', titre: 'Le Quart', peintre: 'Léa', annee: 1640 }], hasardDe('homonymes'), { anecdote: null, categorie: 'Arts & lettres' })
  assert.ok(t)
  assert.deepEqual(t.titres.map(x => x.titre).sort(), ['La Cible', 'Le Double', 'Le Quart', 'Le Tiers'])
})

test('le Détail : Éclairer efface un mauvais titre, deux au plus, et le même à chaque relecture', () => {
  assert.equal(EFFACES_AU_PLUS, 2)
  assert.equal(effacablesAuPlus(TITRES_DU_DETAIL), 2, 'deux titres restent toujours')
  const efface = new Set<string>()
  for (let i = 0; i < 120; i++) {
    const t = unDetail(`eclairer:${i}`)
    const hasard = hasardDe(`graine:eclairer:${i}`)
    let e = REGLE_DU_DETAIL.ouvrir(t)
    for (let n = 1; n <= effacablesAuPlus(t.titres.length); n++) {
      const apres = REGLE_DU_DETAIL.eclairer(t, e, hasard)
      assert.equal(typeof apres, 'object', `le ${n}e éclairage sert`)
      e = apres as EtatDuDetail
      assert.equal(e.effaces.length, n)
      assert.ok(!e.effaces.includes(t.bonne), 'jamais le bon titre')
      assert.equal(new Set(e.effaces).size, n, 'jamais deux fois le même')
    }
    for (const k of e.effaces) efface.add(t.titres[k].titre)
    // Plus rien à souffler : la phrase de la seule règle des refus, que le pli porte (`aEclairer: false`).
    assert.equal(REGLE_DU_DETAIL.eclairer(t, e, hasard), RIEN_A_ECLAIRER)
    const vu = REGLE_DU_DETAIL.montrer(t, e)
    assert.deepEqual(vu.titres.map(x => x.efface), t.titres.map((_, k) => e.effaces.includes(k)))
    assert.equal(vu.titres.filter(x => !x.efface).length, 2)
    // Un titre effacé est un mauvais titre : y répondre ne paie rien.
    assert.equal(REGLE_DU_DETAIL.juger(t, e, { quoi: 'repondre', titre: e.effaces[0] }).naturel, 0)
    // Le hasard rejoué de la graine redonne les mêmes titres effacés.
    const rejoue = hasardDe(`graine:eclairer:${i}`)
    const e1 = REGLE_DU_DETAIL.eclairer(t, REGLE_DU_DETAIL.ouvrir(t), rejoue) as EtatDuDetail
    assert.deepEqual((REGLE_DU_DETAIL.eclairer(t, e1, rejoue) as EtatDuDetail).effaces, e.effaces)
  }
  assert.equal(efface.size, LES_CINQ.length, 'chaque mauvais titre peut s’effacer')
})

test('le Détail : un cadrage ne se montre qu’atteint, ou tous une fois la manche tranchée', () => {
  const t = unDetail()
  const ouverte = REGLE_DU_DETAIL.ouvrir(t)
  assert.equal(refusDuCadrage(ouverte, 1, false), null, 'le premier, dès l’ouverture')
  assert.equal(refusDuCadrage(ouverte, 2, false), 'Recule d’un pas pour voir plus')
  assert.equal(refusDuCadrage(ouverte, 4, false), 'Recule d’un pas pour voir plus')
  const unPas = reculer(t, 1)
  assert.equal(refusDuCadrage(unPas, 2, false), null, 'après « Reculer », un de plus')
  assert.equal(refusDuCadrage(unPas, 3, false), 'Recule d’un pas pour voir plus')
  for (let k = 1; k <= ETOILES_AU_CADRAGE.length; k++) assert.equal(refusDuCadrage(ouverte, k, true), null, `tranchée, le cadrage ${k}`)
  for (const k of [0, 5, 1.5, Number.NaN]) assert.equal(refusDuCadrage(ouverte, k, true), 'Ce cadrage n’existe pas', String(k))
})

test('le Détail : la page n’envoie que ses gestes, relus champ par champ', () => {
  const t = unDetail()
  const lire = (brut: unknown) => REGLE_DU_DETAIL.lireLeGeste(brut, t)
  assert.deepEqual(lire({ quoi: 'reculer', manche: 1 }), { quoi: 'reculer' })
  assert.deepEqual(lire({ quoi: 'repondre', manche: 0, reponse: { detail: { titre: 2 } } }), { quoi: 'repondre', titre: 2 })
  // À l'échéance, la page envoie ce qu'elle a : parfois rien.
  assert.deepEqual(lire({ quoi: 'repondre', manche: 0, auto: true }), { quoi: 'repondre', titre: null })
  for (const brut of [
    null,
    'reculer',
    [],
    { quoi: 'clore', pourquoi: 'lendemain' },
    { quoi: 'essai', lettres: 'PLUME' },
    { quoi: 'repondre', reponse: { detail: { titre: 4 } } },
    { quoi: 'repondre', reponse: { detail: { titre: -1 } } },
    { quoi: 'repondre', reponse: { detail: { titre: 1.5 } } },
    { quoi: 'repondre', reponse: { detail: { titre: '2' } } },
    { quoi: 'repondre', reponse: { detail: {} } },
    { quoi: 'repondre', reponse: { frise: { ordre: [0] } } },
    { quoi: 'repondre', reponse: 'Q100' },
  ]) {
    assert.equal(lire(brut), null, JSON.stringify(brut))
  }
})

test('le Détail : la manche ne dit jamais quel titre est le bon, ni rien du tableau (invariant 1)', () => {
  const t = unDetail('secret', 'Une anecdote qui nommerait le tableau.')
  // Le même jeu de titres, un autre tableau derrière : ce que la page reçoit ne change pas d'un signe.
  const autre: DetailTire = {
    ...t,
    bonne: unAutreTitre(t),
    tableau: { qid: 'Q999', titre: t.titres[unAutreTitre(t)].titre, peintre: t.titres[unAutreTitre(t)].peintre, annee: 1234 },
    anecdote: 'Une tout autre anecdote.',
    categorie: 'Histoire',
  }
  for (const pas of [0, 1, 3]) {
    const e = reculer(t, pas)
    assert.deepEqual(REGLE_DU_DETAIL.montrer(t, e), REGLE_DU_DETAIL.montrer(autre, e))
    const vu = JSON.stringify(REGLE_DU_DETAIL.montrer(t, e))
    for (const secret of [CIBLE.qid, String(CIBLE.annee), 'anecdote', 'bonne']) assert.ok(!vu.includes(secret), `« ${secret} » dans ${vu}`)
  }
})

test('le Détail : la révélation, la pièce et le cartel', () => {
  const t = unDetail('revelation')
  const e = reculer(t, 1)
  const juste = REGLE_DU_DETAIL.juger(t, e, { quoi: 'repondre', titre: t.bonne })
  const r = REGLE_DU_DETAIL.reveler(t, e, juste)
  assert.equal(r.jeu, 'detail')
  assert.equal(r.titre, 'Reconnu')
  assert.equal(r.reconnu, true)
  assert.equal(r.repondu, null)
  assert.equal(r.cadrage, 2)
  assert.deepEqual(r.tableau, { titre: CIBLE.titre, peintre: CIBLE.peintre, annee: CIBLE.annee })
  // Sans anecdote de sa question de la base, il dit ce qu'il est.
  assert.equal(r.savais, 'La Cible, peint par Anne Peintre en 1600.')
  assert.deepEqual(r.titres.map(x => x.bon), t.titres.map((_, k) => k === t.bonne))
  assert.deepEqual(r.titres.map(x => x.choisi), t.titres.map((_, k) => k === t.bonne))

  const k = unAutreTitre(t)
  const rate = REGLE_DU_DETAIL.reveler(t, e, REGLE_DU_DETAIL.juger(t, e, { quoi: 'repondre', titre: k }))
  assert.equal(rate.titre, 'C’était…')
  assert.equal(rate.reconnu, false)
  assert.equal(rate.repondu, t.titres[k].titre, '« Tu avais répondu « … » »')
  assert.equal(rate.titres[k].choisi, true)
  const sans = REGLE_DU_DETAIL.reveler(t, e, REGLE_DU_DETAIL.juger(t, e, 'expiree'))
  assert.equal(sans.titre, 'C’était…')
  assert.equal(sans.repondu, null)
  assert.ok(sans.titres.every(x => !x.choisi))

  // Reconnu au tableau entier : le bon titre, mais plus une étoile — « Reconnu » seul, sur un bandeau sans étoile, se lisait
  // comme une victoire. Au cadrage d'avant, il l'est encore tout court ; un mauvais titre au tableau entier reste « C'était… ».
  const entier = reculer(t, ETOILES_AU_CADRAGE.length - 1)
  const tard = REGLE_DU_DETAIL.juger(t, entier, { quoi: 'repondre', titre: t.bonne })
  assert.equal(tard.naturel, 0)
  assert.equal(REGLE_DU_DETAIL.reveler(t, entier, tard).titre, 'Reconnu, au tableau entier')
  assert.equal(REGLE_DU_DETAIL.reveler(t, entier, tard).reconnu, true)
  const avant = reculer(t, ETOILES_AU_CADRAGE.length - 2)
  assert.equal(REGLE_DU_DETAIL.reveler(t, avant, REGLE_DU_DETAIL.juger(t, avant, { quoi: 'repondre', titre: t.bonne })).titre, 'Reconnu')
  assert.equal(REGLE_DU_DETAIL.reveler(t, entier, REGLE_DU_DETAIL.juger(t, entier, { quoi: 'repondre', titre: k })).titre, 'C’était…')

  const avecAnecdote = unDetail('revelation', 'Il l’a peint de nuit, sur place.')
  assert.equal(REGLE_DU_DETAIL.reveler(avecAnecdote, e, juste).savais, 'Il l’a peint de nuit, sur place.')

  const p = REGLE_DU_DETAIL.piece(t, e, juste, { manche: 1, tirage: 4 })
  assert.equal(p.id, idDuTableau(CIBLE.qid))
  assert.ok(p.id.startsWith(PREFIXE_DU_CABINET), 'un tableau n’est pas la question « Qui a peint… ? » de la base')
  assert.deepEqual(deplier(p.id), [p.id])
  assert.equal(p.forme, 'detail')
  assert.equal(p.texte, QUESTION_DU_TABLEAU)
  assert.deepEqual(p.reponses, ['La Cible — Anne Peintre, 1600'])
  assert.equal(p.bonne, 0)
  assert.equal(p.niveau, 'moyen', 'un tableau n’a pas de marche')
  assert.equal(p.categorie, 'Arts & lettres')
  assert.equal(p.anecdote, r.savais)
  assert.deepEqual(p.cabinet, { jeu: 'detail', manche: 1, tirage: 4 })

  assert.deepEqual(REGLE_DU_DETAIL.cartel(t, juste), { sujet: QUESTION_DU_TABLEAU, reponse: 'La Cible — Anne Peintre, 1600', anecdote: r.savais })
  assert.equal(REGLE_DU_DETAIL.cle, 'detail')
  assert.equal(REGLE_DU_DETAIL.etapes, 1)
  assert.equal(REGLE_DU_DETAIL.dureeMs(1), DUREES_DES_JEUX.detail * 1000)
})

// ── La Frise ──────────────────────────────────────────────────────────────

const EVENEMENTS = [
  { libelle: 'Premier vol motorisé', annee: 1903 },
  { libelle: 'Traversée de la Manche en avion', annee: 1909 },
  { libelle: 'Premier vol commercial régulier', annee: 1919 },
  { libelle: 'Traversée de l’Atlantique en solitaire', annee: 1927 },
  { libelle: 'Création d’Air France', annee: 1933 },
  { libelle: 'Mur du son franchi', annee: 1947 },
  { libelle: 'Premier vol du Concorde', annee: 1969 },
]
const A_THEME: FriseAPartager = {
  sorte: 'theme',
  cle: 'aviation',
  theme: 'L’aviation',
  // Dans le désordre : le partage les range lui-même dans le temps.
  evenements: [EVENEMENTS[4], EVENEMENTS[0], EVENEMENTS[6], EVENEMENTS[2], EVENEMENTS[1], EVENEMENTS[5], EVENEMENTS[3]],
  savais: 'Le Concorde reliait Paris à New York en trois heures et demie.',
  categorie: 'Histoire',
}
const DE_SUJET: FriseAPartager = {
  sorte: 'sujet',
  cle: 'inventions',
  theme: 'Les inventions',
  evenements: [
    { libelle: 'La lampe à incandescence', annee: 1879, id: 'q-lampe' },
    { libelle: 'Le téléphone', annee: 1876, id: 'q-telephone' },
    { libelle: 'Le cinématographe', annee: 1895, id: 'q-cinema' },
    { libelle: 'La première radio', annee: 1901, id: 'q-radio' },
    { libelle: 'La télévision', annee: 1926, id: 'q-tele' },
    { libelle: 'Le transistor', annee: 1947, id: 'q-transistor' },
    { libelle: 'La roue', annee: -3500, id: 'q-roue' },
  ],
  savais: null,
  categorie: 'Sciences',
  niveau: 'difficile',
}

function uneFrise(graine = 'frise', frise: FriseAPartager = A_THEME): FriseTiree[] {
  const ts = friseEnVagues(frise, hasardDe(graine))
  assert.ok(ts, 'sept événements bien écartés font une frise')
  return ts
}

/** Les jetons de la manche dans l'ordre où il les pose, à partir des rangs dans le temps qu'il croit justes. */
function jetonsDe(t: FriseTiree, rangs: readonly number[]): number[] {
  const vu = REGLE_DE_LA_FRISE.montrer(t, REGLE_DE_LA_FRISE.ouvrir(t))
  const ancres = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
  return rangs.map(r => {
    const a = ancres.indexOf(r)
    return a >= 0 ? vu.ancres[a].jeton : vu.nouveaux[t.vagues[t.vague].indexOf(r)].jeton
  })
}

/** La réponse d'une manche, des rangs dans le temps à ce que la page envoie, relue comme le serveur la relit. */
function repondre(t: FriseTiree, rangs: readonly number[]) {
  const g = REGLE_DE_LA_FRISE.lireLeGeste({ quoi: 'repondre', manche: t.vague, reponse: { frise: { ordre: jetonsDe(t, rangs) } } }, t)
  assert.ok(g, `${rangs} se lit`)
  return g
}

test('la Frise : trois, puis deux, puis deux nouveaux venus, chacun une fois, dans un ordre montré au hasard', () => {
  assert.deepEqual([...VAGUES_DE_LA_FRISE], [3, 2, 2])
  assert.equal(EVENEMENTS_D_UNE_FRISE_A_THEME, 7)
  const ordresDeLaPremiere = new Set<string>()
  let chronologiques = 0
  const premiers = new Set<number>()
  for (let i = 0; i < 400; i++) {
    const ts = uneFrise(`vagues:${i}`)
    assert.equal(ts.length, VAGUES_DE_LA_FRISE.length, 'une tirée par manche')
    ts.forEach((t, k) => {
      assert.equal(t.jeu, 'frise')
      assert.equal(t.vague, k)
      assert.deepEqual(t.vagues, ts[0].vagues, 'les trois manches partagent la même frise')
      assert.deepEqual(t.evenements, ts[0].evenements)
    })
    const t = ts[0]
    assert.deepEqual(t.evenements.map(e => e.annee), EVENEMENTS.map(e => e.annee), 'les événements dans l’ordre du temps')
    assert.deepEqual(t.vagues.map(v => v.length), [...VAGUES_DE_LA_FRISE])
    assert.deepEqual(t.vagues.flat().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6], 'chaque événement dans une vague, une fois')
    ordresDeLaPremiere.add(t.vagues[0].join(''))
    premiers.add(t.vagues[0][0])
    // Une vague de deux montrée toujours à rebours dirait l'ordre : il faut les deux.
    if (t.vagues[1][0] < t.vagues[1][1]) chronologiques++
  }
  assert.ok(chronologiques > 120 && chronologiques < 280, `${chronologiques} sur 400 montrées dans l’ordre du temps`)
  assert.equal(premiers.size, 7, 'n’importe quel événement peut ouvrir la frise')
  assert.ok(ordresDeLaPremiere.size > 120, `${ordresDeLaPremiere.size} premières vagues différentes : elles se partagent au hasard`)
  assert.deepEqual(uneFrise('reprise'), uneFrise('reprise'), 'la même graine, la même frise : une reprise redonne tout')
})

test('la Frise : une frise qui grandit — les ancres à leur vraie place, leur année dite, les nouveaux venus sans la leur', () => {
  const ts = uneFrise('grandit')
  for (const t of ts) {
    const vu = REGLE_DE_LA_FRISE.montrer(t, REGLE_DE_LA_FRISE.ouvrir(t))
    assert.equal(vu.jeu, 'frise')
    assert.equal(vu.theme, 'L’aviation')
    assert.equal(vu.vague, t.vague)
    const ancres = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
    assert.deepEqual(vu.ancres.map(a => a.annee), ancres.map(r => EVENEMENTS[r].annee), 'les ancres dans l’ordre du temps')
    assert.deepEqual(vu.ancres.map(a => a.libelle), ancres.map(r => EVENEMENTS[r].libelle))
    assert.deepEqual(vu.nouveaux.map(n => n.libelle), t.vagues[t.vague].map(r => EVENEMENTS[r].libelle), 'les nouveaux venus dans l’ordre montré')
    assert.deepEqual([...vu.ancres, ...vu.nouveaux].map(j => j.jeton), [...Array(ancres.length + VAGUES_DE_LA_FRISE[t.vague]).keys()])
    // Invariant 1 : ni l'année d'un nouveau venu, ni rien qui la dise.
    for (const n of vu.nouveaux) assert.ok(!('annee' in n), n.libelle)
    const texte = JSON.stringify(vu)
    for (const r of t.vagues[t.vague]) assert.ok(!texte.includes(String(EVENEMENTS[r].annee)), `${EVENEMENTS[r].annee} dans ${texte}`)
  }
  assert.deepEqual(
    ts.map(t => REGLE_DE_LA_FRISE.montrer(t, REGLE_DE_LA_FRISE.ouvrir(t)).ancres.length),
    [0, 3, 5],
    'trois événements, puis cinq, puis sept',
  )
})

test('la Frise : un nouveau venu est faux si une ancre le contredit, ou, entre les mêmes ancres, son voisin — et pas posé il est faux', () => {
  const annees = [1800, 1850, 1900, 1950, 2000]
  // Les rangs 1 et 3 sont les nouveaux venus ; 0, 2 et 4, les ancres.
  assert.deepEqual(erreursDeLaFrise([0, 1, 2, 3, 4], annees, [1, 3]), [], 'tout à sa place')
  assert.deepEqual(erreursDeLaFrise([0, 2, 1, 3, 4], annees, [1, 3]), [1], 'un plus récent juste avant lui')
  assert.deepEqual(erreursDeLaFrise([0, 1, 2, 4, 3], annees, [1, 3]), [3], 'un plus ancien juste après lui')
  assert.deepEqual(erreursDeLaFrise([0, 3, 2, 1, 4], annees, [1, 3]), [1, 3], 'croisés')
  assert.deepEqual(erreursDeLaFrise([0, 2, 3, 4], annees, [1, 3]), [1], 'pas posé, il est faux')
  assert.deepEqual(erreursDeLaFrise([0, 2, 4], annees, [1, 3]), [1, 3])
  // Une ancre le juge de n'importe quel côté : collés au bout de la frise, dans leur ordre, ils sont faux tous les deux.
  // Jugés par leurs seuls voisins, l'un passait pour juste — ★★ et une pièce juste, sans rien savoir des ancres.
  assert.deepEqual(erreursDeLaFrise([0, 2, 4, 1, 3], annees, [1, 3]), [1, 3], 'collés en queue')
  assert.deepEqual(erreursDeLaFrise([1, 3, 0, 2, 4], annees, [1, 3]), [1, 3], 'collés en tête')
  assert.deepEqual(erreursDeLaFrise([1, 3, 0, 2], [10, 15, 20, 25], [1, 3]), [1, 3], '15 posé avant 10')
  assert.deepEqual(erreursDeLaFrise([0, 3, 1, 2], [1800, 1850, 1900, 2000], [1, 2]), [1, 2], 'tous deux après 2000')
  // Bien posé entre ses ancres, il reste juste quand un autre s'égare — au loin, ou collé à lui : la révélation ne le
  // marque pas pour la faute d'un autre. Comparé à tout ce qui l'entoure, il était faux dans les deux cas.
  assert.deepEqual(erreursDeLaFrise([3, 0, 1, 2, 4], annees, [1, 3]), [3], 'un égaré au loin')
  assert.deepEqual(erreursDeLaFrise([0, 3, 1, 2, 4], annees, [1, 3]), [3], 'un égaré collé à lui')
  // Entre les mêmes ancres, deux nouveaux venus échangés se contredisent l'un l'autre : deux erreurs.
  assert.deepEqual(erreursDeLaFrise([0, 2, 1, 3], [1800, 1850, 1860, 1900], [1, 2]), [1, 2], 'échangés entre 1800 et 1900')
  assert.deepEqual(erreursDeLaFrise([0, 2, 1], [1800, 1850, 1900], [0, 1, 2]), [1, 2], 'sans ancre, côte à côte')
  assert.deepEqual(erreursDeLaFrise([2, 0, 1], [1800, 1850, 1900], [0, 1, 2]), [0, 2], 'un bloc décalé : celui qui passe devant, et celui qu’il contredit')
  // Une ancre ne compte jamais : elle est à sa vraie place, son année dite.
  assert.deepEqual(erreursDeLaFrise([4, 3, 2, 1, 0], annees, []), [])
  // Les années, pas les rangs : des années quelconques, dans le désordre de la liste.
  assert.deepEqual(erreursDeLaFrise([1, 2, 0], [1969, 1903, 1927], [0, 1, 2]), [], '1903, 1927, 1969')
  assert.deepEqual(erreursDeLaFrise([2, 1, 0], [1969, 1903, 1927], [0, 1, 2]), [1, 2], '1927 avant 1903 : les deux se contredisent')
})

test('la Frise : sans faute ★★★, une erreur ★★, deux rien — un laissé de côté en compte deux, et rien de posé, rien', () => {
  // Deux erreurs valaient ★ jusqu'au calibrage du 25 octobre 2026 : avec des vagues de deux, une manche où les deux
  // nouveaux venus sont posés ne descendait jamais sous ★, et qui rangeait au hasard gagnait une commune plus
  // d'une partie sur quatre (28,2 %, près du double du Détail, le suivant). Sans faute ou une erreur, désormais ;
  // au-delà, rien.
  assert.deepEqual([...ERREURS_DE_LA_FRISE], [0, 1, 1])
  assert.equal(ERREURS_D_UN_OUBLI, 2)
  assert.deepEqual([0, 1, 2, 3, 4].map(etoilesDeLaFrise), [3, 2, 0, 0, 0])
  assert.equal(erreursComptees([0, 2], [1, 2]), 1 + ERREURS_D_UN_OUBLI, 'un faux posé, un laissé de côté')
  const [premiere, , troisieme] = uneFrise('bareme')
  const juste = [...premiere.vagues[0]].sort((a, b) => a - b)
  // La première manche : trois nouveaux venus, aucune ancre.
  const cas: [number[], number, boolean][] = [
    [juste, 3, true],
    [[juste[0], juste[2], juste[1]], 0, false], // deux voisins échangés : deux erreurs
    [[juste[2], juste[0], juste[1]], 0, false], // un bloc décalé : deux erreurs
    [[juste[2], juste[1], juste[0]], 0, false],
    // Laissé de côté, il compte autant que la pire place : à une erreur, ne pas poser celui dont on doute valait
    // ★★ et une pièce juste, quand le poser n'importe où ailleurs qu'à sa place en coûtait deux.
    [[juste[1], juste[2]], 0, false],
    // Un seul jeton posé n'a personne pour le contredire : à une erreur par oubli, il valait ★ sans rien ranger.
    [[juste[0]], 0, false],
    [[juste[1]], 0, false],
    [[juste[2]], 0, false],
  ]
  for (const [rangs, etoiles, estJuste] of cas) {
    const v = REGLE_DE_LA_FRISE.juger(premiere, REGLE_DE_LA_FRISE.ouvrir(premiere), repondre(premiere, rangs))
    assert.equal(v.naturel, etoiles, `${rangs}`)
    assert.equal(v.pieces.length, 1)
    assert.equal(v.pieces[0].juste, estJuste, 'juste à une erreur au plus')
    assert.equal(v.pieces[0].juste, justeDeLaPiece(v.naturel, 'frise'))
    assert.equal(v.pieces[0].choix, estJuste ? 0 : -1)
    assert.equal(v.pieces[0].composee, rangs.join(''), 'l’ordre posé, en rangs dans le temps')
  }
  // Rien de posé — le temps écoulé sans un geste, une partie quittée, une manche en retard : rien. Sans quoi
  // deux nouveaux venus laissés en plan vaudraient deux erreurs, une étoile, pour n'avoir rien fait.
  const e = REGLE_DE_LA_FRISE.ouvrir(troisieme)
  const ancres = troisieme.vagues.slice(0, 2).flat().sort((a, b) => a - b)
  for (const r of [repondre(troisieme, ancres), { quoi: 'repondre' as const, rangs: null }, 'expiree' as const, 'quittee' as const]) {
    assert.deepEqual(REGLE_DE_LA_FRISE.juger(troisieme, e, r), { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }, JSON.stringify(r))
  }
  // Un posé sur deux, à sa place, parmi les ancres : l'autre laissé de côté compte deux erreurs, rien — une pièce
  // fausse, sa réponse gardée (`choix` −1, l'ordre posé) : il a répondu, ce n'est pas une manche sans réponse.
  const [n1, n2] = troisieme.vagues[2]
  const unSeul = [...ancres, n1].sort((a, b) => a - b)
  const v = REGLE_DE_LA_FRISE.juger(troisieme, e, repondre(troisieme, unSeul))
  assert.deepEqual(v, { naturel: 0, pieces: [{ juste: false, choix: -1, composee: unSeul.join('') }] })
  const tout = [...ancres, n1, n2].sort((a, b) => a - b)
  assert.equal(REGLE_DE_LA_FRISE.juger(troisieme, e, repondre(troisieme, tout)).naturel, 3)
})

test('la Frise : à la première manche, sans ancre, une seule erreur ne se peut pas — tout ou rien', () => {
  // Sans ancre, deux voisins dans le désordre se contredisent l'un l'autre, faux tous les deux, et un oubli compte
  // deux erreurs (`ERREURS_D_UN_OUBLI`) : la première manche n'a que zéro erreur, ou deux au moins. Depuis que deux
  // erreurs ne valent plus une étoile (le calibrage du 25 octobre 2026), elle se joue ★★★ ou rien — deux voisins
  // échangés y valaient ★. Le palier ★★ que l'annonce dit ne s'atteint qu'aux manches 2 et 3, parmi des ancres.
  const annees = EVENEMENTS.map(x => x.annee)
  const [premiere, deuxieme, troisieme] = uneFrise('tout ou rien')
  const nouveaux = premiere.vagues[0]
  // Toutes les réponses où quelque chose est posé : un, deux ou les trois nouveaux venus, dans chaque ordre.
  const ordres = (reste: readonly number[]): number[][] => reste.flatMap(x => [[x], ...ordres(reste.filter(y => y !== x)).map(o => [x, ...o])])
  const etoiles = new Map<number, number>()
  for (const rangs of ordres(nouveaux)) {
    const compte = erreursComptees(rangs, erreursDeLaFrise(rangs, annees, nouveaux))
    assert.notEqual(compte, 1, `${rangs} : une seule erreur à la première manche`)
    const v = REGLE_DE_LA_FRISE.juger(premiere, REGLE_DE_LA_FRISE.ouvrir(premiere), repondre(premiere, rangs))
    assert.equal(v.naturel, compte === 0 ? 3 : 0, `${rangs}`)
    etoiles.set(v.naturel, (etoiles.get(v.naturel) ?? 0) + 1)
  }
  assert.deepEqual(Object.fromEntries(etoiles), { 0: 14, 3: 1 }, 'quinze réponses : une seule à ★★★, les quatorze autres à rien')
  // Parmi des ancres, une erreur se peut : l'un des deux nouveaux venus à sa place, l'autre qu'une ancre contredit.
  for (const t of [deuxieme, troisieme]) {
    const ancres = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
    const [a, b] = t.vagues[t.vague]
    let uneErreur = 0
    for (let i = 0; i <= ancres.length; i++) {
      for (let j = 0; j <= ancres.length + 1; j++) {
        const rangs = [...ancres]
        rangs.splice(i, 0, a)
        rangs.splice(j, 0, b)
        if (erreursComptees(rangs, erreursDeLaFrise(rangs, annees, [a, b])) !== 1) continue
        assert.equal(REGLE_DE_LA_FRISE.juger(t, REGLE_DE_LA_FRISE.ouvrir(t), repondre(t, rangs)).naturel, 2, `${rangs}`)
        uneErreur++
      }
    }
    assert.ok(uneErreur > 0, `manche ${t.vague + 1} : une erreur s’y fait, ★★`)
  }
})

test('la Frise : deux nouveaux venus collés au bout, sans rien savoir des ancres, ne sont justes qu’à leur vraie place', () => {
  // La faille de la relecture : jugés par leurs seuls voisins, deux nouveaux venus collés en tête ou en queue, dans
  // leur ordre, faisaient une erreur au plus — ★★ et une pièce juste aux manches 2 et 3, quelles que soient les ancres.
  const annees = EVENEMENTS.map(x => x.annee)
  let manches = 0
  let justes = 0
  for (let i = 0; i < 400; i++) {
    for (const t of uneFrise(`colles:${i}`).slice(1)) {
      const ancres = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
      const [a, b] = [...t.vagues[t.vague]].sort((x, y) => x - y)
      for (const bout of ['tete', 'queue'] as const) {
        const rangs = bout === 'tete' ? [a, b, ...ancres] : [...ancres, a, b]
        // Un rang est une place dans le temps : en tête, à sa place s'il précède toutes les ancres ; en queue, s'il les suit.
        const aSaPlace = [a, b].filter(x => (bout === 'tete' ? x < ancres[0] : x > ancres[ancres.length - 1])).length
        assert.equal(erreursDeLaFrise(rangs, annees, [a, b]).length, 2 - aSaPlace, `${bout} : ${rangs}`)
        const v = REGLE_DE_LA_FRISE.juger(t, REGLE_DE_LA_FRISE.ouvrir(t), repondre(t, rangs))
        // Deux erreurs, rien ; une, ★★ ; aucune, ★★★ (`ERREURS_DE_LA_FRISE`).
        assert.equal(v.naturel, [0, 2, 3][aSaPlace], `${bout} : ${rangs}`)
        assert.equal(v.pieces[0].juste, aSaPlace > 0, 'juste seulement si l’un des deux est vraiment au bout')
        manches++
        if (v.pieces[0].juste) justes++
      }
    }
  }
  // Collés au hasard d'un bout, ils y sont rarement : la stratégie ne paie plus.
  assert.ok(justes < manches / 2, `${justes} justes sur ${manches} manches`)
})

test('la Frise : poser n’est jamais pire que s’abstenir, et sans faute veut dire dans l’ordre', () => {
  // Chaque nouveau venu laissé de côté, posé à n'importe quelle place : le compte du barème ne monte jamais — la pire
  // place coûte la sienne et celle du voisin qu'il contredit, autant qu'un oubli (`ERREURS_D_UN_OUBLI`).
  const annees = EVENEMENTS.map(x => x.annee)
  const hasard = hasardDe('poser ou pas')
  let essais = 0
  let enOrdre = 0
  for (let i = 0; i < 300; i++) {
    for (const t of uneFrise(`poser:${i}`)) {
      const nouveaux = t.vagues[t.vague]
      // Une réponse au hasard : chaque nouveau venu posé, ou laissé, à une place tirée parmi ceux déjà posés.
      const rangs = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
      for (const x of nouveaux) if (hasard() < 0.7) rangs.splice(Math.floor(hasard() * (rangs.length + 1)), 0, x)
      const compte = (o: readonly number[]) => erreursComptees(o, erreursDeLaFrise(o, annees, nouveaux))
      for (const x of nouveaux.filter(r => !rangs.includes(r))) {
        for (let p = 0; p <= rangs.length; p++) {
          const pose = [...rangs.slice(0, p), x, ...rangs.slice(p)]
          assert.ok(compte(pose) <= compte(rangs), `${pose} compte ${compte(pose)}, ${rangs} sans ${x} ${compte(rangs)}`)
          essais++
        }
      }
      // Sans faute si et seulement si tout est posé, dans l'ordre du temps.
      const dansLOrdre = rangs.length === t.vagues.slice(0, t.vague + 1).flat().length && rangs.every((r, k) => k === 0 || r > rangs[k - 1])
      if (dansLOrdre) enOrdre++
      assert.equal(erreursDeLaFrise(rangs, annees, nouveaux).length === 0, dansLOrdre, `${rangs}`)
    }
  }
  assert.ok(essais > 300 && enOrdre > 20, `${essais} places essayées, ${enOrdre} frises dans l’ordre`)
})

test('la Frise : la page envoie ses jetons, les ancres dans leur ordre, relus en rangs dans le temps', () => {
  const t = uneFrise('gestes')[1]
  const ancres = t.vagues[0].slice().sort((a, b) => a - b)
  const [a, b] = t.vagues[1]
  const lire = (ordre: unknown) => REGLE_DE_LA_FRISE.lireLeGeste({ quoi: 'repondre', manche: 1, reponse: { frise: { ordre } } }, t)
  // Les jetons : les ancres d'abord (0 à 2, dans le temps), puis les nouveaux venus dans l'ordre montré (3 et 4).
  assert.deepEqual(lire([0, 3, 1, 2, 4]), { quoi: 'repondre', rangs: [ancres[0], a, ancres[1], ancres[2], b] })
  assert.deepEqual(lire([0, 1, 2, 4]), { quoi: 'repondre', rangs: [...ancres, b] }, 'un nouveau venu peut manquer : il compte deux erreurs')
  assert.deepEqual(REGLE_DE_LA_FRISE.lireLeGeste({ quoi: 'repondre', manche: 1, auto: true }, t), { quoi: 'repondre', rangs: null })
  for (const ordre of [
    [1, 0, 2, 3, 4], // deux ancres échangées : elles ne bougent pas
    [0, 1, 3, 4], // une ancre manque
    [0, 1, 2, 3, 3],
    [0, 1, 2, 3, 5],
    [0, 1, 2, 3, -1],
    [0, 1, 2, 3, 1.5],
    [0, 1, 2, 3, '4'],
    [0, 1, 2, 3, 4, 4],
    '01234',
    null,
  ]) {
    assert.equal(lire(ordre), null, JSON.stringify(ordre))
  }
  for (const brut of [null, { quoi: 'reculer' }, { quoi: 'repondre', reponse: { detail: { titre: 0 } } }, { quoi: 'clore', pourquoi: 'lendemain' }]) {
    assert.equal(REGLE_DE_LA_FRISE.lireLeGeste(brut, t), null, JSON.stringify(brut))
  }
  // Sa seule réponse tranche la manche : égarée hors du jugement, elle se refuse comme aux autres jeux, sans rien changer.
  assert.equal(REGLE_DE_LA_FRISE.tranche(t, REGLE_DE_LA_FRISE.ouvrir(t), { quoi: 'repondre', rangs: null }), true)
  assert.equal(REGLE_DE_LA_FRISE.apresLeGeste(t, REGLE_DE_LA_FRISE.ouvrir(t), { quoi: 'repondre', rangs: null }), GESTE_A_JUGER)
})

test('la Frise : Éclairer dévoile l’année du premier nouveau venu pas encore dévoilé, jamais de tous', () => {
  for (const t of uneFrise('eclairer')) {
    let e: EtatDeLaFrise = REGLE_DE_LA_FRISE.ouvrir(t)
    const nouveaux = t.vagues[t.vague]
    // Tous dévoilés, la manche se rangerait seule parmi des ancres datées : il en reste toujours un à placer de mémoire.
    for (let n = 1; n < nouveaux.length; n++) {
      const apres = REGLE_DE_LA_FRISE.eclairer(t, e, hasardDe('inutile'))
      assert.equal(typeof apres, 'object')
      e = apres as EtatDeLaFrise
      assert.deepEqual(e.devoiles, nouveaux.slice(0, n), 'dans l’ordre montré')
      const vu = REGLE_DE_LA_FRISE.montrer(t, e)
      assert.deepEqual(
        vu.nouveaux.map(x => x.annee),
        nouveaux.map((r, k) => (k < n ? EVENEMENTS[r].annee : undefined)),
      )
    }
    assert.equal(REGLE_DE_LA_FRISE.eclairer(t, e, hasardDe('inutile')), RIEN_A_ECLAIRER)
  }
})

test('la Frise : sept années distinctes, à trois ans d’écart au moins', () => {
  assert.equal(ECART_DES_ANNEES_DE_LA_FRISE, 3)
  const avec = (annees: number[]): FriseAPartager => ({ ...A_THEME, evenements: annees.map((annee, i) => ({ libelle: `Événement ${i}`, annee })) })
  assert.ok(friseEnVagues(avec([1900, 1903, 1906, 1909, 1912, 1915, 1918]), hasardDe('juste')), 'trois ans pile')
  assert.equal(friseEnVagues(avec([1900, 1902, 1906, 1909, 1912, 1915, 1918]), hasardDe('serre')), null, 'deux ans : au hasard')
  assert.equal(friseEnVagues(avec([1900, 1900, 1906, 1909, 1912, 1915, 1918]), hasardDe('double')), null)
  assert.equal(friseEnVagues(avec([1900, 1906, 1909, 1912, 1915, 1918]), hasardDe('six')), null, 'six ne font pas trois vagues')
  assert.equal(friseEnVagues(avec([1890, 1900, 1906, 1909, 1912, 1915, 1918, 1930]), hasardDe('huit')), null)
  // Une frise d'un sujet de la base dit la question de chaque événement : ses pièces les nomment.
  const sansQuestion = { ...DE_SUJET, evenements: DE_SUJET.evenements.map((e, i) => (i === 3 ? { libelle: e.libelle, annee: e.annee } : e)) }
  assert.equal(friseEnVagues(sansQuestion, hasardDe('sujet')), null)
  // Celle d'un sujet aussi, autant d'événements que les vagues en posent.
  const huit = { ...DE_SUJET, evenements: [...DE_SUJET.evenements, { libelle: 'Le laser', annee: 1960, id: 'q-laser' }] }
  assert.equal(friseEnVagues(huit, hasardDe('sujet')), null)
  assert.equal(friseEnVagues({ ...DE_SUJET, evenements: DE_SUJET.evenements.slice(1) }, hasardDe('sujet')), null)
})

test('la Frise : une pièce par manche, unique dans sa partie', () => {
  // Une frise à thème : son identifiant et la manche.
  const ts = uneFrise('pieces')
  const ids = ts.map((t, k) => {
    const juste = [...t.vagues.slice(0, k + 1).flat()].sort((a, b) => a - b)
    const v = REGLE_DE_LA_FRISE.juger(t, REGLE_DE_LA_FRISE.ouvrir(t), repondre(t, juste))
    const p = REGLE_DE_LA_FRISE.piece(t, REGLE_DE_LA_FRISE.ouvrir(t), v, { manche: k as 0 | 1 | 2, tirage: k })
    assert.equal(p.id, idDeLaFriseATheme('aviation', k))
    assert.deepEqual(deplier(p.id), [p.id], 'une frise à thème n’a pas de question de la base')
    assert.equal(p.forme, 'frise')
    assert.equal(p.bonne, 0)
    assert.equal(p.categorie, 'Histoire')
    assert.equal(p.niveau, 'moyen', 'sans marche, une frise à thème est moyenne')
    assert.equal(p.anecdote, A_THEME.savais)
    assert.deepEqual(p.cabinet, { jeu: 'frise', manche: k, tirage: k })
    const nouveaux = [...t.vagues[k]].sort((a, b) => a - b)
    assert.deepEqual(p.reponses, [nouveaux.map(r => `${EVENEMENTS[r].annee} : ${EVENEMENTS[r].libelle}`).join(' · ')])
    assert.equal(v.pieces[0].composee, juste.join(''))
    return p.id
  })
  assert.equal(new Set(ids).size, 3)
  // Un rang par chiffre au journal, comme la frise de l'Expédition : il en faut moins de onze.
  assert.ok(EVENEMENTS_D_UNE_FRISE_A_THEME <= 10)

  // Une frise d'un sujet : les questions de ses nouveaux venus, dans l'ordre du temps — déplié, ce qu'il a vu.
  const ss = uneFrise('pieces', DE_SUJET)
  const parRang = ss[0].evenements.map(e => e.id!)
  const vues = ss.map((t, k) => {
    const v = REGLE_DE_LA_FRISE.juger(t, REGLE_DE_LA_FRISE.ouvrir(t), 'quittee')
    const p = REGLE_DE_LA_FRISE.piece(t, REGLE_DE_LA_FRISE.ouvrir(t), v, { manche: k as 0 | 1 | 2, tirage: k })
    const ids = [...t.vagues[k]].sort((a, b) => a - b).map(r => parRang[r])
    assert.equal(p.id, idDeLaFriseDeSujet(ids))
    assert.deepEqual(deplier(p.id), ids)
    assert.equal(p.niveau, 'difficile', 'la marche de son sujet')
    assert.equal(p.anecdote, null)
    return deplier(p.id)
  })
  assert.deepEqual(vues.flat().sort(), DE_SUJET.evenements.map(e => e.id!).sort(), 'ses sept questions, une fois chacune')
  assert.equal(ss[0].evenements[0].annee, -3500)
  const premiere = ss.find(t => t.vagues[t.vague].includes(0))!
  const piece = REGLE_DE_LA_FRISE.piece(premiere, REGLE_DE_LA_FRISE.ouvrir(premiere), REGLE_DE_LA_FRISE.juger(premiere, REGLE_DE_LA_FRISE.ouvrir(premiere), 'expiree'), { manche: premiere.vague as 0 | 1 | 2, tirage: 0 })
  assert.ok(piece.reponses[0].startsWith(`${anneeDite(-3500)} : La roue`), piece.reponses[0])
})

test('la Frise : la révélation range tout à sa vraie année, et dit le savais-tu à la dernière manche', () => {
  const ts = uneFrise('revelation')
  const t = ts[2]
  const ancres = t.vagues.slice(0, 2).flat().sort((a, b) => a - b)
  const [n1, n2] = t.vagues[2]
  const juste = [...ancres, n1, n2].sort((a, b) => a - b)
  const e = REGLE_DE_LA_FRISE.ouvrir(t)
  // n2 égaré entre deux ancres qui le contredisent : il est faux, n1 reste à sa place.
  const sansN2 = juste.filter(r => r !== n2)
  const egare = [...Array(sansN2.length + 1).keys()]
    .map(p => [...sansN2.slice(0, p), n2, ...sansN2.slice(p)])
    .find(o => erreursDeLaFrise(o, EVENEMENTS.map(x => x.annee), [n1, n2]).join() === String(n2))
  assert.ok(egare, 'une place où n2 seul est faux')
  const v = REGLE_DE_LA_FRISE.juger(t, e, repondre(t, egare))
  const r = REGLE_DE_LA_FRISE.reveler(t, e, v)
  assert.equal(r.jeu, 'frise')
  assert.equal(r.theme, 'L’aviation')
  assert.equal(r.faux, 1)
  assert.equal(r.pasPoses, 0)
  assert.equal(r.titre, '1 erreur')
  assert.deepEqual(r.rangee.map(x => x.annee), EVENEMENTS.map(x => x.annee), 'toute la frise, dans l’ordre du temps')
  assert.deepEqual(
    r.rangee.map(x => x.place),
    EVENEMENTS.map((_, k) => (k === n1 ? 'juste' : k === n2 ? 'faux' : null)),
    'les nouveaux venus marqués, les ancres non',
  )
  assert.deepEqual(r.rangee.map(x => x.nouveau), EVENEMENTS.map((_, k) => k === n1 || k === n2))
  assert.equal(r.savais, A_THEME.savais, 'à la troisième manche, le savais-tu de la frise')

  const parfaite = REGLE_DE_LA_FRISE.reveler(t, e, REGLE_DE_LA_FRISE.juger(t, e, repondre(t, juste)))
  assert.equal(parfaite.titre, 'Sans faute')
  assert.equal(parfaite.faux, 0)
  assert.equal(parfaite.pasPoses, 0)
  const rien = REGLE_DE_LA_FRISE.reveler(t, e, REGLE_DE_LA_FRISE.juger(t, e, 'expiree'))
  assert.equal(rien.titre, 'Rien de rangé')
  assert.equal(rien.pasPoses, 2)
  assert.deepEqual(rien.rangee.filter(x => x.nouveau).map(x => x.place), ['pas-pose', 'pas-pose'])
  // Laissé de côté, il se dit à part : « 1 erreur » quand il en compte deux au barème tromperait.
  const sansN2Pose = REGLE_DE_LA_FRISE.reveler(t, e, REGLE_DE_LA_FRISE.juger(t, e, repondre(t, sansN2)))
  assert.deepEqual([sansN2Pose.titre, sansN2Pose.faux, sansN2Pose.pasPoses], ['1 pas posé', 0, 1])
  assert.deepEqual(
    sansN2Pose.rangee.map(x => x.place),
    EVENEMENTS.map((_, k) => (k === n1 ? 'juste' : k === n2 ? 'pas-pose' : null)),
  )
  // n2 seul faux, c'est qu'une ancre le contredit — deux échangés le seraient tous deux : sans n1, il le reste.
  const egareSansN1 = egare.filter(r => r !== n1)
  assert.deepEqual(erreursDeLaFrise(egareSansN1, EVENEMENTS.map(x => x.annee), [n1, n2]), [n1, n2])
  const deux = REGLE_DE_LA_FRISE.reveler(t, e, REGLE_DE_LA_FRISE.juger(t, e, repondre(t, egareSansN1)))
  assert.deepEqual([deux.titre, deux.faux, deux.pasPoses], ['1 erreur, 1 pas posé', 1, 1])

  // Les deux premières manches ne montrent que ce qui est posé jusqu'à elles, sans le savais-tu.
  const premiere = ts[0]
  const vagueUn = [...premiere.vagues[0]].sort((a, b) => a - b)
  const r0 = REGLE_DE_LA_FRISE.reveler(premiere, REGLE_DE_LA_FRISE.ouvrir(premiere), REGLE_DE_LA_FRISE.juger(premiere, REGLE_DE_LA_FRISE.ouvrir(premiere), repondre(premiere, vagueUn)))
  assert.deepEqual(r0.rangee.map(x => x.annee), vagueUn.map(k => EVENEMENTS[k].annee))
  assert.equal(r0.savais, null)

  // Le cartel : la frise et ce que la manche a daté.
  const nouveaux = [n1, n2].sort((a, b) => a - b)
  assert.deepEqual(REGLE_DE_LA_FRISE.cartel(t, v), {
    sujet: 'La frise : L’aviation',
    reponse: nouveaux.map(k => `${EVENEMENTS[k].annee} : ${EVENEMENTS[k].libelle}`).join(' · '),
    anecdote: A_THEME.savais,
  })
  assert.equal(REGLE_DE_LA_FRISE.cle, 'frise')
  assert.equal(REGLE_DE_LA_FRISE.etapes, 1)
  assert.equal(REGLE_DE_LA_FRISE.dureeMs(1), DUREES_DES_JEUX.frise * 1000)
})

test('le Détail et la Frise sont purs : ni horloge, ni hasard à eux', () => {
  // Le hasard vient de qui appelle — le serveur au tirage, la graine secrète de la partie pour Éclairer —, l'heure aussi :
  // rejoué, le pli redonne tout.
  for (const f of ['detail.ts', 'frise.ts', 'outils.ts']) {
    const texte = readFileSync(new URL(`../../shared/cabinet/jeux/${f}`, import.meta.url), 'utf8')
    assert.ok(!/Date\.now|new Date|Math\.random|performance\.now/.test(texte), f)
  }
})

// ── Le tirage, au serveur, sur la base livrée ─────────────────────────────
// Ce que les tireurs du Détail et de la Frise tirent au départ : les cent
// tableaux de `server/content/details/`, les frises à thème de
// `server/content/cabinet/frises.json`, et celles des sujets de la base — ses
// événements datés (`server/content/frises/`), regroupés par sujet. La base
// d'essai du banc n'a ni tableau demandé ni événement daté : la base livrée,
// lue une fois pour ces épreuves.

let livree: { questions: readonly QuestionDeLaBase[]; parId: ReadonlyMap<string, QuestionDeLaBase>; evenements: ReturnType<typeof evenementsDeLaBase> } | null = null
function laBaseLivree() {
  if (!livree) {
    const { questions } = lireLaBase()
    const parId = new Map(questions.map(q => [q.id, q]))
    livree = { questions, parId, evenements: evenementsDeLaBase(parId) }
  }
  return livree
}

/** Ce qu'un tireur lit, sur la base livrée : la porte n'y donne que ce que les tireurs demandent. */
function surLaBaseLivree(vues: ReadonlyMap<string, number> = new Map()): ContexteDuTirage {
  const { questions, parId, evenements } = laBaseLivree()
  return {
    porte: { deLaCategorie: (j, c) => j.filter(q => q.meta.categorie === c), parIdDe: () => parId, evenementsDe: () => evenements },
    jouables: questions,
    mesures: new Map(),
    vues,
    maintenant: DIX_HEURES,
    hasard: Math.random,
  }
}

const UNE_HEURE = 3_600_000

test('le tirage du Détail : un tableau de la fiche, jamais vu d’abord, ni le même tableau ni le même titre deux fois dans le plan, l’anecdote de sa question de la base', () => {
  const tableaux = tableauxDuDetail()
  assert.ok(tableaux.length >= 80, `${tableaux.length} tableaux livrés`)
  const parQid = new Map(tableaux.map(t => [t.qid, t]))
  const anecdotes = new Map(detailsDeLaBase(laBaseLivree().parId).map(d => [d.tableau.qid, d.question.anecdote]))
  assert.ok(anecdotes.size > 50, `${anecdotes.size} tableaux que demande une question de la base`)
  let avecAnecdote = 0
  for (let essai = 0; essai < 30; essai++) {
    // Trois manches et trois rechanges : la force 3 de Changer.
    const plan = tirerLePlan('detail', surLaBaseLivree(), 3) as DetailTire[]
    assert.equal(plan.length, 6)
    const proposes = new Set<string>()
    for (const t of plan) {
      const fiche = parQid.get(t.tableau.qid)
      assert.ok(fiche, `${t.tableau.qid} n’est pas un tableau livré`)
      assert.deepEqual(t.tableau, { qid: fiche.qid, titre: fiche.titre, peintre: fiche.peintre, annee: fiche.annee })
      assert.equal(t.titres[t.bonne].titre, fiche.titre)
      // Un titre proposé — un leurre comme une réponse — ne revient pas en réponse plus loin dans le plan.
      assert.ok(!proposes.has(fiche.titre), `${fiche.titre}, déjà proposé, revient en réponse`)
      for (const x of t.titres) proposes.add(x.titre)
      assert.equal(t.categorie, CATEGORIE_DU_DETAIL, 'la catégorie des tableaux : les missions la lisent')
      assert.equal(t.anecdote, anecdotes.get(fiche.qid) ?? null, 'l’anecdote de sa question « Qui a peint… ? », sinon rien : la règle dit alors ce qu’il est')
      if (t.anecdote) avecAnecdote++
    }
    assert.equal(new Set(plan.map(t => t.tableau.qid)).size, plan.length, 'jamais deux fois le même tableau, rechanges comprises')
    // Et un leurre ne reprend jamais le tableau d'une autre manche — ni d'avant, ni d'une rechange : sa manche se répondrait
    // d'avoir vu l'autre.
    plan.forEach((t, k) => {
      const ailleurs = new Set(plan.filter((_, j) => j !== k).map(x => x.titres[x.bonne].titre))
      for (const [i, x] of t.titres.entries()) assert.ok(i === t.bonne || !ailleurs.has(x.titre), `${x.titre}, leurre de la manche ${k}, est la réponse d’une autre`)
    })
  }
  assert.ok(avecAnecdote > 0)

  // Le jamais vu d'abord : tous vus sauf deux — au Cabinet, ou par une question de la base qui le demande —, puis le plus
  // anciennement vu, parmi ceux dont le titre n'a pas encore été proposé. Les deux jamais vus aux deux bouts du temps :
  // voisins en années, le titre de l'un, proposé en leurre à l'autre, l'écarterait de la réponse — par la règle, pas par
  // le hasard de l'ordre du fichier.
  const parAnnee = [...tableaux].sort((x, y) => x.annee - y.annee)
  const [a, b] = [parAnnee[0], parAnnee[parAnnee.length - 1]]
  const [c, ...autres] = tableaux.filter(t => t !== a && t !== b)
  const prochesDe = (t: typeof a) => parAnnee.filter(x => x !== t).sort((x, y) => Math.abs(x.annee - t.annee) - Math.abs(y.annee - t.annee)).slice(0, VOISINS_EN_ANNEES)
  assert.ok(!prochesDe(a).includes(b) && !prochesDe(b).includes(a), 'aucun des deux parmi les voisins de l’autre')
  const vues = new Map<string, number>(autres.map((t, i) => [idDuTableau(t.qid), DIX_HEURES - (i + 2) * UNE_HEURE]))
  vues.set(c.questions[0], DIX_HEURES - UNE_HEURE)
  const vuLe = (qid: string) => (qid === c.qid ? DIX_HEURES - UNE_HEURE : vues.get(idDuTableau(qid)))
  for (let essai = 0; essai < 20; essai++) {
    const [p, q, r] = tirerLePlan('detail', surLaBaseLivree(vues), 0) as DetailTire[]
    assert.deepEqual([p, q].map(t => t.tableau.qid).sort(), [a.qid, b.qid].sort(), 'les deux jamais vus d’abord')
    const proposes = new Set([p, q].flatMap(t => t.titres.map(x => x.titre)))
    const restants = tableaux.filter(t => t.qid !== a.qid && t.qid !== b.qid && !proposes.has(t.titre))
    const plusAncien = restants.reduce((x, y) => (vuLe(y.qid)! < vuLe(x.qid)! ? y : x))
    assert.equal(r.tableau.qid, plusAncien.qid, 'puis le plus anciennement vu')
  }
})

test('le tirage de la Frise : trois vagues d’une même frise, à thème ou d’un sujet de la base, en alternance de fraîcheur — jamais de rechange', () => {
  const themes = new Map(contenuDuCabinet().frises.map(f => [f.id, f]))
  const { parId, evenements } = laBaseLivree()
  const libelleDe = new Map(evenements.map(e => [e.id, e]))
  const sortes = { theme: 0, sujet: 0 }
  for (let essai = 0; essai < 60; essai++) {
    // Une carte de Changer en demanderait trois : la Frise n'en a jamais — sa règle relit un départ à trois tirages.
    const plan = tirerLePlan('frise', surLaBaseLivree(), 3) as FriseTiree[]
    assert.ok(plan)
    assert.equal(plan.length, 3, 'ses trois manches, sans rechange')
    plan.forEach((t, k) => {
      assert.equal(t.vague, k)
      assert.deepEqual(t.evenements, plan[0].evenements, 'une seule frise, qui grandit')
      assert.deepEqual(t.vagues, plan[0].vagues)
    })
    const t = plan[0]
    sortes[t.sorte]++
    assert.equal(t.evenements.length, EVENEMENTS_D_UNE_FRISE_A_THEME)
    t.evenements.forEach((e, i) => i > 0 && assert.ok(e.annee - t.evenements[i - 1].annee >= ECART_DES_ANNEES_DE_LA_FRISE, `${t.cle} : ${t.evenements.map(x => x.annee)}`))
    assert.ok((CATEGORIES as readonly string[]).includes(t.categorie), t.categorie)
    if (t.sorte === 'theme') {
      const f = themes.get(t.cle)
      assert.ok(f, `${t.cle} : une frise à thème livrée`)
      assert.equal(t.theme, f.theme)
      assert.equal(t.savais, f.savais)
      assert.deepEqual(t.evenements.map(e => `${e.annee} ${e.libelle}`).sort(), f.evenements.map(e => `${e.annee} ${e.libelle}`).sort())
    } else {
      const s = sujetParCle(t.cle)
      assert.ok(s && !estRemplace(t.cle), `${t.cle} : un sujet qu’on peut encore jouer`)
      assert.equal(t.theme, s.nom, 'le nom du sujet pour thème')
      assert.ok(t.niveau && NIVEAUX.includes(t.niveau), 'la marche de son sujet')
      for (const e of t.evenements) {
        assert.ok(e.id && parId.has(e.id), 'chaque événement, sa question de la base : ses pièces la nomment')
        assert.deepEqual([e.libelle, e.annee], [libelleDe.get(e.id)!.evenement, libelleDe.get(e.id)!.annee], 'sa ligne et l’année de sa question')
      }
    }
  }
  assert.ok(sortes.theme > 10 && sortes.sujet > 10, `l’une et l’autre, tant que tout est frais : ${JSON.stringify(sortes)}`)

  // Les frises à thème toutes rangées ce matin : celle d'un sujet passe devant. Et les questions des événements toutes vues
  // ce matin — en série, ou rangées au Cabinet, dépliées —, la frise à thème.
  const ceMatin = DIX_HEURES - UNE_HEURE
  const themesRanges = new Map([...themes.keys()].flatMap(id => [0, 1, 2].map(k => [idDeLaFriseATheme(id, k), ceMatin] as const)))
  const evenementsVus = new Map(evenements.map(e => [e.id, ceMatin]))
  // Rangées par l'Expédition aussi : ses frises tiennent en une ligne, leurs questions jointes (`frise:<id>+<id>…`), que
  // les vues du Cabinet déplient comme les siennes — sans quoi un événement rangé hier là-bas repassait ici pour frais.
  const ids = evenements.map(e => e.id)
  const frisesDeLExpedition = new Map(Array.from({ length: Math.ceil(ids.length / 4) }, (_, i) => [PREFIXE_DE_LA_FRISE + ids.slice(4 * i, 4 * i + 4).join('+'), ceMatin] as const))
  for (let essai = 0; essai < 20; essai++) {
    assert.equal((tirerLePlan('frise', surLaBaseLivree(themesRanges), 0) as FriseTiree[])[0].sorte, 'sujet')
    assert.equal((tirerLePlan('frise', surLaBaseLivree(evenementsVus), 0) as FriseTiree[])[0].sorte, 'theme')
    assert.equal((tirerLePlan('frise', surLaBaseLivree(vuesDuCabinet(frisesDeLExpedition)), 0) as FriseTiree[])[0].sorte, 'theme', 'vues dans une frise de l’Expédition')
  }
})

test('un plancher de frises de sujets : la base livrée en fait au moins cinquante-cinq, chacune ses sept années à trois ans d’écart', () => {
  const { questions, parId, evenements } = laBaseLivree()
  const sujets = frisesDesSujets({ parIdDe: () => parId, evenementsDe: () => evenements }, questions)
  // Soixante et un le 25 octobre 2026 — les époques redécoupées écartées : un sujet de moins se dit ici, il ne se perd pas en silence.
  assert.ok(sujets.length >= 55, `${sujets.length} sujets font une frise`)
  assert.equal(new Set(sujets.map(s => s.cle)).size, sujets.length)
  for (const s of sujets) {
    assert.ok(sujetParCle(s.cle) && !estRemplace(s.cle), s.cle)
    assert.ok(choisirLaFriseSansRepli(s.evenements, ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, Math.random), `${s.cle} : trop serré pour sept années`)
  }
})

// ── Par les routes ────────────────────────────────────────────────────────
// Un vrai serveur, la base d'essai du Cabinet : les tableaux et les frises à
// thème sont livrés avec le serveur, la base n'y est pour rien.

let leBanc: BancDuCabinet | undefined
const unBanc = async () => (leBanc ??= await bancDuCabinet())
after(() => leBanc?.banc.close())
after(fermerLesMagasins)

/** Les allers-retours vers la base permanente pendant un travail : chaque `execute` et chaque `batch` (le compteur de `cabinet-charge.test.ts`). */
const compte = { actif: false, appels: 0 }
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.appels++
    return origine.apply(this, args)
  }
}
async function allersRetours<T>(travail: () => Promise<T>): Promise<{ appels: number; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0 })
  try {
    const resultat = await travail()
    return { appels: compte.appels, resultat }
  } finally {
    compte.actif = false
  }
}

test('un cadrage ne coûte rien à la base tant que sa partie vit en mémoire ; finie, un aller-retour, par sa clé', async () => {
  const m = await magasinDEssai(path.join(dossierDEssai(), 'detail.db'), { t: DIX_HEURES })
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: null })
  const enCours = await allersRetours(() => m.cabinet.cadrage('qui', p.id, 0, 1))
  assert.deepEqual([enCours.appels, 'fichier' in enCours.resultat], [0, true], 'la partie en mémoire, l’image sur disque')
  assert.ok('partie' in (await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })))
  const finie = await allersRetours(() => m.cabinet.cadrage('qui', p.id, 0, 4))
  assert.deepEqual([finie.appels, 'fichier' in finie.resultat], [1, true], 'finie, elle ne vit plus en mémoire : sa ligne et ses gestes, d’un lot')
  // La partie d'un autre profil : rien ne la distingue d'une partie qui n'existe pas (invariant 3).
  assert.deepEqual(await m.cabinet.cadrage('autre', p.id, 0, 1), { introuvable: 'partie' })
})

test('deux serveurs pendant une mise en ligne : un cadrage atteint chez l’autre se sert ici, la partie relue une fois', async () => {
  // Chacun sa mémoire, une base : la page tient sa vue du serveur qui a joué « Reculer », et demande l'image à l'autre.
  const fichier = path.join(dossierDEssai(), 'deux.db')
  const horloge = { t: DIX_HEURES }
  const a = await magasinDEssai(fichier, horloge)
  const b = await magasinDEssai(fichier, horloge)
  const p = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: null })
  assert.ok('fichier' in (await b.cabinet.cadrage('qui', p.id, 0, 1)), 'l’autre la lit, et la garde au premier cadrage')
  assert.ok('partie' in (await a.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'reculer', manche: 0 })))
  const relu = await allersRetours(() => b.cabinet.cadrage('qui', p.id, 0, 2))
  assert.deepEqual([relu.appels, 'fichier' in relu.resultat], [1, true], 'refusé sur sa mémoire, il relit la partie, et sert')
  // Relue, la base fait foi : ce qui n'est pas atteint reste refusé ; hors des quatre cadrages, rien à relire.
  assert.deepEqual(await b.cabinet.cadrage('qui', p.id, 0, 3), { refus: 'Recule d’un pas pour voir plus' })
  const horsDesQuatre = await allersRetours(() => b.cabinet.cadrage('qui', p.id, 0, 5))
  assert.deepEqual([horsDesQuatre.appels, horsDesQuatre.resultat], [0, { refus: 'Ce cadrage n’existe pas' }])
  // Ce que le plan figé suffit à refuser ne se relit pas non plus, quoi que l'autre ait joué : un indice hors du plan ou
  // illisible, la partie d'un autre jeu. Une page qui se trompe ne paie pas un aller-retour par demande, sous le verrou.
  for (const tirage of [3, 9, Number.NaN, -1, 0.5]) {
    const r = await allersRetours(() => b.cabinet.cadrage('qui', p.id, tirage, 1))
    assert.deepEqual([r.appels, r.resultat], [0, { introuvable: 'tableau' }], `le tirage ${tirage}`)
  }
  const pari = await b.cabinet.commencer('autre', { origine: 'libre', jeu: 'pari', carte: null })
  const auPari = await allersRetours(() => b.cabinet.cadrage('autre', pari.id, 0, 1))
  assert.deepEqual([auPari.appels, auPari.resultat], [0, { introuvable: 'tableau' }], 'une partie du Pari n’a pas de tableau')
})

test('deux serveurs : une partie finie chez l’autre, relue pour un cadrage, ne laisse pas son musée la croire en cours', async () => {
  // L'autre serveur finit la partie ; la page demande à celui-ci le tableau entier de la révélation. Relue pour le
  // servir, la partie est finie : le musée gardé ici, qui la disait en cours, ne dit plus vrai — gardé, il refusait tout
  // départ (« Ta partie au Détail t'attend ») à une partie que plus rien ne pouvait finir.
  const fichier = path.join(dossierDEssai(), 'finie-ailleurs.db')
  const horloge = { t: DIX_HEURES }
  const a = await magasinDEssai(fichier, horloge)
  const b = await magasinDEssai(fichier, horloge)
  const p = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: null })
  assert.equal((await b.cabinet.page('qui')).enCours?.id, p.id, 'l’autre la garde, avec son musée')
  assert.ok('partie' in (await a.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })))
  assert.ok('fichier' in (await b.cabinet.cadrage('qui', p.id, 0, 4)), 'refusé sur sa mémoire, il relit la partie, finie : tout se sert')
  const page = await b.cabinet.page('qui')
  assert.deepEqual([page.enCours, page.musee.enCours], [null, null], 'son musée ne la dit plus en cours')
  const suivante = await b.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  assert.equal(suivante.depart.jeu, 'pari', 'une autre partie part')
})

/** Les octets d'un cadrage tel que le serveur le garde, à côté de la route. */
const octetsDe = (qid: string, cadrage: number) => readFileSync(fichierDuCadrage(qid, cadrage))

test('par les routes : un cadrage du Détail ne se sert qu’atteint — 400 avant « Reculer », 200 après, tous après le verdict — et à sa seule partie', async () => {
  const b = await unBanc()
  const lea = await inscrireProfil(b.banc.url, 'lea-detail', 'Léa')
  const tom = await inscrireProfil(b.banc.url, 'tom-detail', 'Tom')
  let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'detail', carte: null }), 'le Détail')
  assert.equal(v.jeu, 'detail')
  assert.equal(v.tirage, 0, 'la première manche joue le premier tirage du plan')
  assert.equal(v.enCours?.jeu === 'detail' && v.enCours.cadrage, 1)
  const t = detailDe(b, v.id, 0)

  // Le premier cadrage, dès l'ouverture : ses octets, gardés par le téléphone — son adresse ne désigne qu'eux.
  const premier = await unCadrage(b, lea, v.id, 0, 1)
  assert.equal(premier.status, 200, premier.erreur)
  assert.equal(premier.entetes.get('content-type'), 'image/webp')
  assert.equal(premier.entetes.get('cache-control'), 'private, max-age=86400')
  assert.ok(premier.octets.equals(octetsDe(t.tableau.qid, 1)))
  // Le suivant attend « Reculer » : servi d'avance, le tableau entier se téléchargerait avant la réponse (invariant 1).
  for (const k of [2, 4]) {
    const tot = await unCadrage(b, lea, v.id, 0, k)
    assert.deepEqual([tot.status, tot.erreur], [400, 'Recule d’un pas pour voir plus'], `le cadrage ${k}`)
    assert.equal(tot.entetes.get('cache-control'), 'no-store', 'un refus ne se garde pas : après « Reculer », la même adresse sert')
  }
  v = ok(await jouer(b, lea, v, { quoi: 'reculer', manche: 0 }), 'reculer')
  assert.equal(v.enCours?.jeu === 'detail' && v.enCours.cadrage, 2)
  const deuxieme = await unCadrage(b, lea, v.id, 0, 2)
  assert.equal(deuxieme.status, 200)
  assert.ok(deuxieme.octets.equals(octetsDe(t.tableau.qid, 2)))
  assert.equal((await unCadrage(b, lea, v.id, 0, 3)).status, 400)

  // La partie d'un autre profil, ou qui n'existe pas : introuvable (invariant 3) ; sans profil, rien.
  for (const [qui, id] of [
    [tom, v.id],
    [lea, 'nulle-part'],
  ] as const) {
    const r = await unCadrage(b, qui, id, 0, 1)
    assert.deepEqual([r.status, r.erreur], [404, PARTIE_INTROUVABLE])
  }
  assert.deepEqual(await unCadrage(b, undefined, v.id, 0, 1).then(r => [r.status, r.erreur]), [401, CABINET_SANS_PROFIL])
  // Un tableau qu'aucune manche ne joue — la manche suivante pas encore ouverte, au-delà du plan — ; un cadrage qui n'existe pas.
  for (const tirage of [1, 2, 9, 'x', '-1', '0.5']) {
    const r = await unCadrage(b, lea, v.id, tirage, 1)
    assert.deepEqual([r.status, r.erreur], [404, TABLEAU_INTROUVABLE], `le tirage ${tirage}`)
  }
  for (const cadrage of [0, 5, 'x', '1.5', '01']) {
    const r = await unCadrage(b, lea, v.id, 0, cadrage)
    assert.deepEqual([r.status, r.erreur], [400, 'Ce cadrage n’existe pas'], `le cadrage ${cadrage}`)
  }

  // Le verdict : tous les cadrages, pour la révélation et « Mes réponses ».
  v = await jouerUnDetail(b, lea, v, 0)
  assert.equal(v.revelation?.corps.jeu, 'detail')
  assert.equal(v.revelation?.tirage, 0, 'la révélation dit son tirage : la page y demande le tableau entier')
  for (let k = 1; k <= 4; k++) {
    const r = await unCadrage(b, lea, v.id, 0, k)
    assert.equal(r.status, 200, `le cadrage ${k} après le verdict`)
    assert.ok(r.octets.equals(octetsDe(t.tableau.qid, k)))
  }
  // Une partie qui n'est pas au Détail n'a pas de tableau.
  ok(await jouer(b, lea, v, { quoi: 'quitter' }), 'quitter')
  const pari = ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari')
  assert.deepEqual(await unCadrage(b, lea, pari.id, 0, 1).then(r => [r.status, r.erreur]), [404, TABLEAU_INTROUVABLE])
  ok(await jouer(b, lea, pari, { quoi: 'quitter' }), 'quitter le Pari')
})

test('par les routes : après « Changer », l’adresse dit la rechange — l’image d’avant ne revient pas du cache, et la partie finie sert la sienne', async () => {
  const b = await unBanc()
  const ines = await inscrireProfil(b.banc.url, 'ines-detail', 'Inès')
  // L'Échange, une œuvre de départ : Changer une fois, une rechange au plan.
  let v = ok(await commencer(b, ines, { origine: 'libre', jeu: 'detail', carte: 'echange' }), 'le Détail')
  const plan = departEnBase(b.fichier, v.id).tirages as DetailTire[]
  assert.equal(plan.length, 4)
  assert.equal(v.tirage, 0)
  v = ok(await jouer(b, ines, v, { quoi: 'changer', manche: 0 }), 'changer')
  assert.equal(v.tirage, 3, 'la manche joue la rechange : l’indice du tirage dans le plan figé, jamais celui de la manche')
  assert.deepEqual(
    v.enCours?.jeu === 'detail' && v.enCours.titres.map(x => x.titre),
    plan[3].titres.map(x => x.titre),
  )
  const neuf = await unCadrage(b, ines, v.id, 3, 1)
  assert.equal(neuf.status, 200)
  assert.ok(neuf.octets.equals(octetsDe(plan[3].tableau.qid, 1)))
  assert.ok(!neuf.octets.equals(octetsDe(plan[0].tableau.qid, 1)), 'un autre tableau')
  assert.deepEqual(await unCadrage(b, ines, v.id, 0, 1).then(r => [r.status, r.erreur]), [404, TABLEAU_INTROUVABLE], 'le tableau d’avant n’est plus en jeu')
  v = await jouerUnDetail(b, ines, v, 0, { pas: 1, juste: false })
  assert.equal(v.revelation?.tirage, 3)
  // Finie, la partie ne vit plus en mémoire : elle se relit, et sert encore le tableau de chaque manche jouée.
  v = ok(await jouer(b, ines, v, { quoi: 'quitter' }), 'quitter')
  assert.equal(v.phase, 'finie')
  assert.equal((await unCadrage(b, ines, v.id, 3, 4)).status, 200)
  assert.equal((await unCadrage(b, ines, v.id, 0, 1)).status, 404)
  assert.equal((await unCadrage(b, ines, v.id, 1, 1)).status, 404, 'une manche jamais ouverte n’a pas de tableau')
})

test('par les routes : un cadrage que le téléphone n’attend plus n’est pas une panne ; une vraie panne se dit, et ne se garde pas', async () => {
  const b = await unBanc()
  const zoe = await inscrireProfil(b.banc.url, 'zoe-detail', 'Zoé')
  const v = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'detail', carte: null }), 'le Détail')
  const route = 'GET /api/cabinet/partie/:id/detail/:tirage/:cadrage'
  const auReleve = () => releve.lignes('banc').reduce((n, l) => n + (l.erreurs[route] ?? 0), 0)
  const releveAvant = auReleve()
  const journal: string[] = []
  const errorAvant = console.error
  const warnAvant = console.warn
  console.error = console.warn = (...args: unknown[]) => void journal.push(args.map(String).join(' '))
  // Ce que `sendFile` dit à la route, guetté sans rien y changer : on attend chaque fin plutôt qu'un délai.
  const reponse = express.response as unknown as { sendFile: (...args: unknown[]) => void }
  const sendFileAvant = reponse.sendFile
  const ABANDONS = 4
  const codes: unknown[] = []
  let tousServis!: () => void
  const servis = new Promise<void>(r => (tousServis = r))
  reponse.sendFile = function (this: unknown, ...args: unknown[]) {
    const fin = args.pop() as (e?: Error) => void
    sendFileAvant.call(this, ...args, (e?: Error) => {
      try {
        fin(e)
      } finally {
        codes.push((e as NodeJS.ErrnoException | undefined)?.code)
        if (codes.length === ABANDONS) tousServis()
      }
    })
  }
  try {
    // Un téléphone qui change d'écran ou perd le réseau, sa demande à peine partie : la route lit la partie, puis
    // `sendFile` ne trouve plus personne à qui répondre (ECONNABORTED).
    const { port } = new URL(b.banc.url)
    for (let i = 0; i < ABANDONS; i++) {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(Number(port), 'localhost', () => {
          socket.write(`GET ${adresseDUnCadrage(v.id, 0, 1)} HTTP/1.1\r\nHost: localhost\r\nCookie: ${zoe}\r\nX-Requested-With: quizz\r\n\r\n`, () => {
            socket.destroy()
            resolve()
          })
        })
        socket.on('error', reject)
      })
    }
    await servis
    assert.deepEqual(codes, Array(ABANDONS).fill('ECONNABORTED'), 'chaque téléchargement parti en route')
    assert.deepEqual(journal, [], 'rien au journal du serveur')
    assert.equal(auReleve(), releveAvant, 'aucune erreur serveur au relevé de l’heure')
    // Un disque qui ne rend pas l'image : une erreur serveur, dite au journal et au relevé — et sa réponse ne se garde
    // pas sous l'adresse de l'image, que le téléphone redemandera.
    reponse.sendFile = (...args: unknown[]) => {
      const fin = args.pop() as (e?: Error) => void
      setImmediate(() => fin(Object.assign(new Error('lecture impossible'), { code: 'EIO' })))
    }
    const panne = await unCadrage(b, zoe, v.id, 0, 1)
    assert.deepEqual([panne.status, panne.erreur], [500, ERREUR_SERVEUR])
    assert.equal(panne.entetes.get('cache-control'), 'no-store')
    assert.match(panne.entetes.get('content-type') ?? '', /json/)
    assert.equal(auReleve(), releveAvant + 1)
    assert.equal(journal.length, 1, journal.join('\n'))
  } finally {
    reponse.sendFile = sendFileAvant
    console.error = errorAvant
    console.warn = warnAvant
  }
  // Rien de cassé : la même adresse sert, ensuite.
  assert.equal((await unCadrage(b, zoe, v.id, 0, 1)).status, 200)
})

test('par les routes : la Frise d’un bout à l’autre — trois, puis deux, puis deux nouveaux venus, sans faute, neuf étoiles ; Changer n’y sert jamais', async () => {
  const b = await unBanc()
  const noe = await inscrireProfil(b.banc.url, 'noe-frise', 'Noé')
  let v = ok(await commencer(b, noe, { origine: 'libre', jeu: 'frise', carte: null }), 'la Frise')
  const d = departEnBase(b.fichier, v.id)
  assert.equal(d.tirages.length, 3)
  const t = d.tirages[0] as FriseTiree
  assert.equal(d.theme, t.theme, 'le thème se fige au départ, avec le plan')
  for (let k = 0; k < 3; k++) {
    if (k > 0) v = await ouvrir(b, noe, v, k)
    const montre = v.enCours?.jeu === 'frise' ? v.enCours : null
    assert.ok(montre, `la manche ${k}`)
    assert.equal(montre.theme, t.theme)
    assert.deepEqual([montre.ancres.length, montre.nouveaux.length], [[0, 3], [3, 2], [5, 2]][k])
    v = await jouerUneFrise(b, noe, v, k)
    assert.equal(v.revelation?.corps.jeu === 'frise' && v.revelation.corps.titre, 'Sans faute')
  }
  assert.deepEqual([v.phase, v.bilan?.total, v.bilan?.naturel, v.bilan?.aidee], ['finie', 9, [3, 3, 3], false])
  const pieces = enBase(b.fichier, db => db.prepare('SELECT reserve_id, forme, juste FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(v.id)) as { reserve_id: string; forme: string; juste: number }[]
  assert.deepEqual(
    pieces.map(p => [p.reserve_id, p.forme, p.juste]),
    [0, 1, 2].map(k => [idDeLaFriseATheme(t.cle, k), 'frise', 1]),
    'une pièce par manche, unique dans sa partie : la base d’essai n’a que des frises à thème',
  )
  // Une carte de Changer s'emporte à la Frise — elle ne coûte rien — mais n'y sert pas, et le plan n'a pas de rechange.
  let c = ok(await commencer(b, noe, { origine: 'libre', jeu: 'frise', carte: 'echange' }), 'la Frise et l’Échange')
  assert.equal(departEnBase(b.fichier, c.id).tirages.length, 3)
  const changer = await jouer(b, noe, c, { quoi: 'changer', manche: 0 })
  assert.deepEqual([changer.status, (changer.corps as unknown as { error: string }).error], [400, `Changer ne sert pas ${JEUX.frise.a}`])
  c = ok(await jouer(b, noe, c, { quoi: 'quitter' }), 'quitter')
  // Rien de posé à la manche quittée : sa pièce s'écrit, sans rien de rangé.
  assert.equal(c.bilan?.total, 0)
  assert.ok(friseDe(b, c.id, 0))
  assert.equal(ok(await laPage(b, noe), 'la page').enCours, null)
})

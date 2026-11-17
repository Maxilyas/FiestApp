// Le Filet en deux étapes (`shared/cabinet/jeux/filetEnDeuxTemps.ts`, `parEtape` ; la décision, « Le Filet en deux
// étapes », `docs/architecture/decisions.md`) — le 17 novembre 2026, le retour que le propriétaire rapportait : « si tu
// choisis la mauvaise époque, tu as automatiquement faux », et sa demande, « découper le jeu en deux parties, trouver la
// tranche de l'époque puis la date exacte dedans ». Ce que ce fichier en exige : une mauvaise époque ne prend rien à ce
// que la valeur rapporte ; l'époque se choisit pour de bon, et la bonne ne part au téléphone qu'ensuite (invariant 1) ;
// rien, avant, ne la trahit — pas même le refus d'un lancer ; chaque étape a son chrono, et l'échéance de la première ne
// coûte que l'époque ; les aides et Éclairer s'arrêtent avec elle ; une manche tirée avant garde sa règle d'un seul
// lancer (`cabinet-filet-en-deux-temps.test.ts`). Par la règle pure, par le pli, puis par les routes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import * as B from '../../shared/cabinet/bareme'
import { hasardDe } from '../../shared/missions'
import { lireLeDepart, lireUnGeste } from '../../shared/cabinet/lecture'
import { chronoDuDepart, etoilesDesManches, pliDeLaPartie, type CarteDuDepart, type DepartDUnePartie } from '../../shared/cabinet/partie'
import { JOKER_D_ECLAIRER } from '../../shared/cabinet/pieces'
import { REGLES, regleDe } from '../../shared/cabinet/jeux/index'
import { eclairerSertEncore, rienAEclairer, type QuestionTiree } from '../../shared/cabinet/jeux/outils'
import { JEUX, trancheLaManche, type VerdictDUneManche } from '../../shared/cabinet/jeux/regle'
import {
  AIDES_DU_FILET,
  REGLE_DU_FILET_EN_DEUX_TEMPS as R,
  epoqueDAbord,
  epoqueJouee,
  epoqueRetiree,
  etapesDeLaComposee,
  etoilesEnDeuxEtapes,
  pisteDeLaValeur,
  seJoueEnDeuxEtapes,
  tirageEnDeuxTemps,
  type EtatDuFiletEnDeuxTemps,
  type FiletEnDeuxEtapesTire,
  type FiletEnDeuxTempsMontre,
  type FiletEnDeuxTempsRevele,
  type FiletEnDeuxTempsTire,
} from '../../shared/cabinet/jeux/filetEnDeuxTemps'
import type { VueDeLaPartie } from '../../shared/cabinet/vues'
import { inscrireProfil } from './banc'
import { bancDuCabinet, baseDuCabinet, commencer, departEnBase, fermerLesMagasins, jouer as unGeste, ok, vraiesQuestionsDuFilet } from './cabinet-banc'
import { MIDI, Partie, S, carte, departDe, ouvrir } from './cabinet-plans'

/** L'année du départ : le tireur la lit au jour de Paris du départ, jamais à l'horloge. */
const DEPART = 2026

const question = (o: Partial<QuestionTiree> = {}): QuestionTiree => ({
  id: 'q1',
  texte: 'En quelle année l’Algérie devient-elle indépendante ?',
  reponses: ['1962', '1958', '1954', '1968'],
  bonne: 0,
  categorie: 'Histoire',
  anecdote: 'Les accords d’Évian sont signés en mars 1962.',
  niveau: 'facile',
  ...o,
})

/** Un tirage d'essai tel que le tireur le fait aujourd'hui : en deux étapes, ce que vaut chacune figé avec le reste. */
function tirage(valeur: number, annee: boolean, place: number, o: { indice?: string | null; unite?: string } = {}): FiletEnDeuxEtapesTire {
  const t = tirageEnDeuxTemps(
    {
      question: question({ reponses: [String(valeur), '1', '2', '3'] }),
      valeur,
      annee,
      ...(o.unite !== undefined && { unite: o.unite }),
      place,
      anneeDuDepart: DEPART,
      reperes: [],
      indice: o.indice === undefined ? 'Quand le général de Gaulle revient au pouvoir' : o.indice,
    },
    hasardDe(`tirage:${valeur}:${place}`),
  )
  assert.ok(t && seJoueEnDeuxEtapes(t), `${valeur} à la place ${place} : pas de tirage en deux étapes`)
  return t
}

/** Un geste joué comme le pli le jouera : lu, puis `trancheLaManche` dit s'il va à `juger` ou à `apresLeGeste`. */
function jouer(t: FiletEnDeuxTempsTire, e: EtatDuFiletEnDeuxTemps, brut: unknown): { etat: EtatDuFiletEnDeuxTemps } | { verdict: VerdictDUneManche } | { refus: string } {
  const g = R.lireLeGeste(brut, t)
  assert.ok(g !== null, `illisible : ${JSON.stringify(brut)}`)
  if (trancheLaManche(R, t, e, g)) return { verdict: R.juger(t, e, g) }
  const apres = R.apresLeGeste(t, e, g)
  return typeof apres === 'string' ? { refus: apres } : { etat: apres }
}
const etatDe = (x: ReturnType<typeof jouer>): EtatDuFiletEnDeuxTemps => {
  assert.ok('etat' in x, `un état attendu : ${JSON.stringify(x)}`)
  return x.etat
}
const verdictDe = (x: ReturnType<typeof jouer>): VerdictDUneManche => {
  assert.ok('verdict' in x, `un verdict attendu : ${JSON.stringify(x)}`)
  return x.verdict
}
const refusDe = (x: ReturnType<typeof jouer>): string => {
  assert.ok('refus' in x, `un refus attendu : ${JSON.stringify(x)}`)
  return x.refus
}
const epoque = (choix: number) => ({ quoi: 'epoque', manche: 0, choix })
const lancer = (piste: number, x: number) => ({ quoi: 'repondre', manche: 0, reponse: { filet: { epoque: piste, x } } })
const aide = (cle: string) => ({ quoi: 'aide', manche: 0, aide: cle })
/** L'époque jouée, puis la valeur visée dans la piste que la manche ouvre : le verdict. */
function manche(t: FiletEnDeuxEtapesTire, choix: number, x: number, e: EtatDuFiletEnDeuxTemps = R.ouvrir(t)): { etat: EtatDuFiletEnDeuxTemps; verdict: VerdictDUneManche } {
  const etat = etatDe(jouer(t, e, epoque(choix)))
  return { etat, verdict: verdictDe(jouer(t, etat, lancer(R.montrer(t, etat).piste!, x))) }
}

// ── Le barème ───────────────────────────────────────────────────────────

test('en deux étapes : une mauvaise époque ne prend rien à ce que la valeur rapporte', () => {
  // 1962, dans 1950–1974, la deuxième de quatre époques : à 2 ans le petit anneau, à 6 le grand.
  const t = tirage(1962, true, 1)
  assert.deepEqual(t.tranches.map(x => x.de), [1925, 1950, 1975, 2000])
  assert.deepEqual([t.bonnes, t.anneaux, t.parEtape], [[1], { trois: 2, deux: 6 }, B.ETOILES_DES_ETAPES_DU_FILET])
  const etoiles = (choisie: number | null, x: number | null) => etoilesEnDeuxEtapes(t, choisie, x)
  // La bonne époque : une étoile, puis une de plus tout près, deux pile dedans — comme d'un seul lancer.
  assert.deepEqual([etoiles(1, 1962), etoiles(1, 1960), etoiles(1, 1957), etoiles(1, 1956), etoiles(1, 1955), etoiles(1, 1974)], [3, 3, 2, 2, 1, 1])
  // La mauvaise : d'un seul lancer, le curseur restait dans son époque et la manche était perdue. Ici la valeur se vise
  // dans la bonne, et rapporte ce qu'elle rapporte.
  assert.deepEqual([etoiles(0, 1962), etoiles(0, 1960), etoiles(0, 1957), etoiles(0, 1955), etoiles(3, 1974)], [2, 2, 1, 0, 0])
  // Le temps a pris l'époque : la valeur seule ; l'époque seule, sans lancer ; rien.
  assert.deepEqual([etoiles(null, 1962), etoiles(null, 1957), etoiles(1, null), etoiles(0, null), etoiles(null, null)], [2, 1, 1, 0, 0])
  // Une grandeur : 6 % et 25 % de la réponse, l'écart lu au dixième.
  const g = tirage(16, false, 0)
  assert.deepEqual([etoilesEnDeuxEtapes(g, 0, 15.04), etoilesEnDeuxEtapes(g, 0, 17), etoilesEnDeuxEtapes(g, 0, 20.1), etoilesEnDeuxEtapes(g, 1, 17), etoilesEnDeuxEtapes(g, 1, 20.1)], [3, 2, 1, 1, 0])
})

test('en deux étapes : la manche jouée — l’époque pour de bon, puis la valeur dans la bonne ; sa pièce, sa révélation', () => {
  const t = tirage(1962, true, 1)
  const e0 = R.ouvrir(t)
  assert.deepEqual(e0, { aides: [], etape: 1, epoque: null })
  // La mauvaise époque, puis pile sur l'année : deux étoiles, la pièce juste — il a su placer l'année.
  const rate = manche(t, 0, 1962)
  assert.deepEqual(rate.etat, { aides: [], etape: 2, epoque: 0 })
  assert.deepEqual(rate.verdict, { naturel: 2, pieces: [{ juste: true, choix: 0, composee: '1962|0' }] })
  const r = R.reveler(t, rate.etat, rate.verdict)
  assert.deepEqual([r.titre, r.etoiles, r.avantLesAides, r.payees, r.ecart], ['Pile dedans', 2, 2, 0, 0])
  assert.deepEqual(r.criteres, { epoque: false, deux: true, trois: true }, 'une étoile par coche')
  assert.deepEqual([r.choisie, r.lancer, r.bonnes, r.parEtape], [0, { epoque: 1, x: 1962 }, [1], B.ETOILES_DES_ETAPES_DU_FILET])
  // La bonne époque, loin de l'année : son étoile, et la pièce n'est pas juste.
  const loin = manche(t, 1, 1974)
  assert.deepEqual(loin.verdict, { naturel: 1, pieces: [{ juste: false, choix: -1, composee: '1974|1' }] })
  assert.equal(R.reveler(t, loin.etat, loin.verdict).titre, 'La bonne époque')
  // La mauvaise, tout près : une étoile, « Tout près » ; la mauvaise et loin : rien, « À côté ».
  const pres = manche(t, 2, 1957)
  assert.deepEqual([pres.verdict.naturel, R.reveler(t, pres.etat, pres.verdict).titre], [1, 'Tout près'])
  const aCote = manche(t, 3, 1974)
  assert.deepEqual(aCote.verdict, { naturel: 0, pieces: [{ juste: false, choix: -1, composee: '1974|3' }] })
  assert.equal(R.reveler(t, aCote.etat, aCote.verdict).titre, 'À côté')
  // Tout juste : trois étoiles.
  assert.deepEqual(manche(t, 1, 1962).verdict, { naturel: 3, pieces: [{ juste: true, choix: 0, composee: '1962|1' }] })
  assert.equal(R.reveler(tirage(250, false, 1, { unite: 'g' }), { aides: [], etape: 2, epoque: 1 }, { naturel: 1, pieces: [{ juste: false, choix: -1, composee: '120|1' }] }).titre, 'Le bon ordre de grandeur')
  // La pièce relue : la valeur visée et l'époque choisie, l'une sans l'autre parfois.
  assert.deepEqual(etapesDeLaComposee('1962|0'), { x: 1962, epoque: 0 })
  assert.deepEqual(etapesDeLaComposee('1962|.|e'), { x: 1962, epoque: null })
  assert.deepEqual(etapesDeLaComposee('.|2|I'), { x: null, epoque: 2 })
  for (const c of [null, '', '.|.|e', 'x|7', '|']) assert.deepEqual(etapesDeLaComposee(c), { x: null, epoque: null }, String(c))
})

// ── Les gestes et leurs refus ───────────────────────────────────────────

test('en deux étapes : l’époque d’abord, une seule fois — et aucun refus ne dit laquelle est la bonne', () => {
  const t = tirage(1962, true, 1)
  const e0 = R.ouvrir(t)
  // Un lancer avant l'époque se refuse dans les mêmes mots, dans la bonne piste comme dans une autre : refusé à la
  // lecture pour l'une seulement, il aurait dit la bonne avant qu'elle soit jouée.
  assert.equal(refusDe(jouer(t, e0, lancer(1, 1962))), epoqueDAbord(t))
  assert.equal(refusDe(jouer(t, e0, lancer(0, 1940))), epoqueDAbord(t))
  assert.equal(refusDe(jouer(t, e0, lancer(3, 2010))), 'Choisis d’abord l’époque')
  assert.equal(epoqueDAbord(tirage(250, false, 1)), 'Choisis d’abord l’ordre de grandeur')
  // Une époque se lit à son rang parmi les quatre, rien d'autre.
  for (const choix of [4, -1, 1.5, '1', null]) assert.equal(R.lireLeGeste({ quoi: 'epoque', choix }, t), null, String(choix))
  assert.deepEqual(R.lireLeGeste(epoque(3), t), { quoi: 'epoque', choix: 3 })
  // L'époque jouée, la bonne est à l'écran : ni une autre époque, ni une aide qui y menait.
  const e1 = etatDe(jouer(t, e0, epoque(0)))
  assert.equal(refusDe(jouer(t, e1, epoque(1))), epoqueJouee(t))
  assert.equal(refusDe(jouer(t, e1, aide('epoques'))), 'L’époque est jouée : vise l’année')
  assert.equal(R.eclairer(t, e1, () => 0, 0), rienAEclairer('filet'))
  assert.ok(eclairerSertEncore(R, t, e0) && !eclairerSertEncore(R, t, e1), 'Éclairer ne sert qu’à la première étape')
  // Une époque que « Deux époques de moins » a retirée ne se choisit pas : l'écran ne la laisse pas toucher.
  const aidee = etatDe(jouer(t, e0, aide('epoques')))
  assert.equal(refusDe(jouer(t, aidee, epoque(t.retirables[0]))), epoqueRetiree(t))
  assert.deepEqual(etatDe(jouer(t, aidee, epoque(1))), { aides: [{ cle: 'epoques', offerte: false }], etape: 2, epoque: 1 })
  // Un tirage d'avant n'a pas ce geste : son époque part avec son lancer, qui tranche d'emblée.
  const { parEtape: _, ...avant } = t
  assert.equal(R.lireLeGeste(epoque(1), avant), null)
  assert.deepEqual(R.ouvrir(avant), { aides: [] })
  assert.ok(trancheLaManche(R, avant, R.ouvrir(avant), R.lireLeGeste(lancer(1, 1962), avant)!))
  assert.ok(!trancheLaManche(R, t, e0, R.lireLeGeste(lancer(1, 1962), t)!) && trancheLaManche(R, t, e1, R.lireLeGeste(lancer(1, 1962), t)!))
})

test('en deux étapes : la bonne époque ne part au téléphone qu’une fois la sienne jouée (invariant 1)', () => {
  const t = tirage(1962, true, 1)
  const avant = R.montrer(t, R.ouvrir(t))
  for (const champ of ['valeur', 'bonnes', 'choisie', 'piste', 'retirables', 'question', 'reponse', 'savais']) assert.ok(!(champ in avant), champ)
  assert.ok(!JSON.stringify(avant).includes('1962'), 'la valeur')
  assert.deepEqual([avant.etape, avant.parEtape], [1, B.ETOILES_DES_ETAPES_DU_FILET])
  // Une aide prise n'en dit pas plus : deux époques retirées, jamais la bonne.
  const aidee = R.montrer(t, etatDe(jouer(t, R.ouvrir(t), aide('epoques'))))
  assert.ok(!('bonnes' in aidee) && !('piste' in aidee))
  // L'époque jouée : la sienne, la bonne, et la piste qui s'ouvre — toujours pas la valeur.
  const apres = R.montrer(t, etatDe(jouer(t, R.ouvrir(t), epoque(3))))
  assert.deepEqual([apres.etape, apres.choisie, apres.bonnes, apres.piste], [2, 3, [1], 1])
  assert.ok(!('valeur' in apres) && !JSON.stringify(apres).includes('1962'), 'la valeur')
  assert.equal(R.montrer(t, etatDe(jouer(t, R.ouvrir(t), epoque(1)))).piste, 1)
})

test('en deux étapes : une grandeur pile sur une borne a deux bonnes tranches, et la piste de celle qu’il a choisie', () => {
  // 10 000 m², de 3 000 à 10 000 comme de 10 000 à 30 000.
  const t = tirage(10000, false, 2, { unite: 'm²' })
  assert.deepEqual(t.bonnes, [1, 2])
  assert.deepEqual([pisteDeLaValeur(t, 1), pisteDeLaValeur(t, 2), pisteDeLaValeur(t, 0), pisteDeLaValeur(t, null)], [1, 2, 2, 2], 'la sienne si elle est bonne, sinon celle où la réponse commence')
  for (const bonne of [1, 2]) assert.equal(manche(t, bonne, 10000).verdict.naturel, 3, `la tranche ${bonne}`)
  assert.equal(manche(t, 0, 10000).verdict.naturel, 2)
  // La réponse est sur la piste ouverte, quelle qu'elle soit.
  for (const k of [1, 2]) assert.ok(t.valeur >= t.tranches[k].de && t.valeur <= t.tranches[k].a)
})

// ── Les aides ───────────────────────────────────────────────────────────

test('en deux étapes : une aide payée retire une étoile de ce que la manche valait, jamais le cœur ; offerte, rien', () => {
  const t = tirage(1962, true, 1)
  const payee = etatDe(jouer(t, R.ouvrir(t), aide('indice')))
  assert.equal(R.montrer(t, payee).indice, t.indice)
  // La bonne époque et pile dedans, l'indice payé : trois moins une.
  const juste = manche(t, 1, 1962, payee)
  assert.deepEqual(juste.verdict, { naturel: 2, payees: 1, pieces: [{ juste: true, choix: 0, composee: '1962|1|i' }] })
  // La bonne époque seule : son étoile part avec l'aide, la manche reste réussie — `payees` le dit à la traversée.
  const seule = manche(t, 1, 1974, payee)
  assert.deepEqual(seule.verdict, { naturel: 0, payees: 1, pieces: [{ juste: false, choix: -1, composee: '1974|1|i' }] })
  const r = R.reveler(t, seule.etat, seule.verdict)
  assert.deepEqual([r.avantLesAides, r.payees, r.etoiles], [1, 1, 0])
  // Ratée de bout en bout, l'aide ne prend rien : la manche coûte son cœur comme toujours, jamais à cause d'elle.
  assert.deepEqual(manche(t, 0, 1974, payee).verdict, { naturel: 0, pieces: [{ juste: false, choix: -1, composee: '1974|0|i' }] })
  // Offerte par Éclairer, à la première étape : rien de retiré.
  const offerte = R.eclairer(t, R.ouvrir(t), () => 0, AIDES_DU_FILET.indexOf('epoques'))
  assert.ok(typeof offerte !== 'string')
  assert.deepEqual(manche(t, 1, 1962, offerte).verdict, { naturel: 3, pieces: [{ juste: true, choix: 0, composee: '1962|1|E' }] })
})

// ── Le temps ────────────────────────────────────────────────────────────

test('en deux étapes : l’échéance de l’époque ne coûte que l’époque ; celle de la valeur garde l’époque trouvée', () => {
  const t = tirage(1962, true, 1)
  // La réponse vide que la page envoie à l'échéance, et que le pli joue pour un téléphone éteint : à la première étape,
  // elle ne tranche pas — l'époque est perdue, la valeur s'ouvre sur la bonne.
  const vide = R.lireLeGeste({ quoi: 'repondre' }, t)!
  assert.ok(!trancheLaManche(R, t, R.ouvrir(t), vide))
  const perdue = etatDe(jouer(t, R.ouvrir(t), { quoi: 'repondre' }))
  assert.deepEqual(perdue, { aides: [], etape: 2, epoque: null })
  const vue = R.montrer(t, perdue)
  assert.deepEqual([vue.etape, vue.choisie, vue.bonnes, vue.piste], [2, null, [1], 1])
  // Puis la valeur, pile : deux étoiles sur trois.
  const v = verdictDe(jouer(t, perdue, lancer(1, 1962)))
  assert.deepEqual(v, { naturel: 2, pieces: [{ juste: true, choix: 0, composee: '1962|.' }] })
  assert.deepEqual([R.reveler(t, perdue, v).choisie, R.reveler(t, perdue, v).titre], [null, 'Pile dedans'])
  // À la seconde étape, la réponse vide tranche : rien de visé. Le temps écoulé garde ce que le serveur savait, l'époque.
  assert.ok(trancheLaManche(R, t, perdue, vide))
  const trouvee: EtatDuFiletEnDeuxTemps = { aides: [], etape: 2, epoque: 1 }
  assert.deepEqual(R.juger(t, trouvee, 'expiree'), { naturel: 1, pieces: [{ juste: false, choix: -1, composee: '.|1' }] })
  assert.deepEqual(R.juger(t, trouvee, vide), { naturel: 1, pieces: [{ juste: false, choix: -1, composee: '.|1' }] })
  const rien = R.juger(t, perdue, 'expiree')
  assert.deepEqual(rien, { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] })
  assert.equal(R.reveler(t, perdue, rien).titre, 'Le temps a filé')
  // Quitter laisse zéro et `choix` nul, comme partout ; ce qu'il avait fait reste écrit, et la révélation ne lui compte rien.
  const quittee = R.juger(t, trouvee, 'quittee')
  assert.deepEqual(quittee, { naturel: 0, pieces: [{ juste: false, choix: null, composee: '.|1' }] })
  assert.deepEqual([R.reveler(t, trouvee, quittee).etoiles, R.reveler(t, trouvee, quittee).avantLesAides], [0, 0])
})

/** Un départ d'épreuve en deux étapes, trois manches tirées comme le serveur les tire, et une carte qui éclaire. */
function departEnDeuxEtapes(cartes: CarteDuDepart[] = [carte('eclairer', 1)]): DepartDUnePartie {
  const tirages = [tirage(1962, true, 1), tirage(2500, false, 2, { unite: 'km' }), tirage(1789, true, 0)]
  return departDe('filet', { v: 3, origine: 'traversee', traversee: { id: 'tr-1', etape: 'a0r0c0', assaut: 0 }, cartes, carte: null, chrono: chronoDuDepart('filet', cartes), tirages })
}

test('en deux étapes, au pli : chaque étape a son chrono — le temps passé sur l’époque n’est pas pris à la valeur', () => {
  // Deux étapes à la règle comme à l'annonce, et deux durées figées au départ.
  assert.deepEqual([REGLES.filet.etapes, JEUX.filet.etapes, regleDe('filet').etapes], [2, 2, 2])
  const d = departEnDeuxEtapes()
  const duree = B.DUREES_DES_JEUX.filet * S
  assert.deepEqual(d.chrono.etapesMs, [duree, duree])
  const p = new Partie(d)
  // La première manche : l'époque à 50 s, la mauvaise ; la valeur 55 s plus tard — au-delà du chrono de l'époque, bien
  // avant celui de la valeur, parti quand l'époque a été jouée. Pile : deux étoiles.
  p.joue(ouvrir(0), MIDI)
  assert.equal(p.refuse({ quoi: 'repondre', manche: 0, reponse: { filet: { epoque: 1, x: 1962 } } }, MIDI + 5 * S), 'Choisis d’abord l’époque')
  p.joue({ quoi: 'epoque', manche: 0, choix: 0 }, MIDI + 50 * S)
  assert.equal(p.etat.manches[0].etapes.length, 2, 'la seconde étape est ouverte')
  assert.equal(p.etat.manches[0].etapes[1].ouverteLe, MIDI + 50 * S)
  p.joue({ quoi: 'repondre', manche: 0, reponse: { filet: { epoque: 1, x: 1962 } } }, MIDI + 105 * S)
  assert.deepEqual([p.etat.pieces[0].composee, p.etat.pieces[0].juste], ['1962|0', true])
  // La deuxième : Éclairer offre l'indice, puis le téléphone s'éteint. L'échéance de l'époque passée, la réponse vide de
  // la page arrive en retard : elle porte l'expiration de l'époque — perdue —, et la valeur s'est ouverte à cette heure-là.
  const t1 = MIDI + 200 * S
  p.joue(ouvrir(1), t1)
  p.joue({ quoi: 'eclairer', manche: 1, affirmation: AIDES_DU_FILET.indexOf('indice') }, t1 + 2 * S)
  const limite = t1 + duree + d.chrono.graceMs
  p.joue({ quoi: 'repondre', manche: 1, auto: true }, limite + 1 * S)
  const m1 = p.etat.manches[1]
  assert.deepEqual([m1.verdict, m1.etapes.length, m1.etapes[1].ouverteLe], [null, 2, limite], 'l’époque perdue, la valeur ouverte à l’échéance de l’époque')
  assert.deepEqual(m1.etat, { aides: [{ cle: 'indice', offerte: true }], etape: 2, epoque: null })
  // Il revient à temps pour la valeur : à 4 % de 2 500 km, le petit anneau — deux étoiles, et la pièce porte Éclairer.
  p.joue({ quoi: 'repondre', manche: 1, reponse: { filet: { epoque: 2, x: 2400 } } }, limite + 20 * S)
  assert.deepEqual([p.etat.pieces[1].composee, p.etat.pieces[1].joker], ['2400|.|I', JOKER_D_ECLAIRER])
  // La troisième : la bonne époque, puis plus rien jusqu'au bout du chrono de la valeur — son étoile reste.
  const t2 = limite + 60 * S
  p.joue(ouvrir(2), t2)
  p.joue({ quoi: 'epoque', manche: 2, choix: 0 }, t2 + 10 * S)
  p.joue({ quoi: 'repondre', manche: 2, auto: true }, t2 + 10 * S + duree + d.chrono.graceMs + 1)
  assert.deepEqual([p.etat.pieces[2].composee, p.etat.pieces[2].choix], ['.|0', -1])
  assert.deepEqual(
    etoilesDesManches(d, p.etat).map(m => [m.naturel, m.payees]),
    [
      [2, 0],
      [2, 0],
      [1, 0],
    ],
  )
  assert.ok(p.etat.fin)
  // Le pli rejoué d'une traite redonne la même partie ; le départ et le geste se relisent à leur forme.
  assert.deepEqual(pliDeLaPartie(d, p.gestes), p.etat)
  assert.deepEqual(lireLeDepart(JSON.stringify(d)), d)
  assert.deepEqual(lireUnGeste({ quoi: 'epoque', manche: 0, choix: 2 }), { quoi: 'epoque', manche: 0, choix: 2 })
  for (const choix of [-1, 1.5, '2', undefined]) assert.equal(lireUnGeste({ quoi: 'epoque', manche: 0, choix }), null, String(choix))
  // Un barème qui ne se lit pas rend le départ illisible, plutôt qu'une manche jugée de travers.
  const tordu = { ...d, tirages: [{ ...d.tirages[0], parEtape: { epoque: 1, deux: 2, trois: 1 } }, ...d.tirages.slice(1)] }
  assert.equal(lireLeDepart(JSON.stringify(tordu)), null, 'le petit anneau ne vaut jamais moins que le grand')
})

test('en deux étapes, au pli : un téléphone éteint dès l’ouverture laisse les deux étapes expirer, à leur heure', () => {
  const d = departEnDeuxEtapes([])
  const duree = B.DUREES_DES_JEUX.filet * S
  const p = new Partie(d)
  p.joue(ouvrir(0), MIDI)
  // « Quitter » le lendemain : la manche s'est jugée d'elle-même, datée du bout de sa seconde étape.
  p.joue({ quoi: 'clore', pourquoi: 'lendemain' }, MIDI + 3600 * S)
  const m = p.etat.manches[0]
  assert.deepEqual([m.fin, m.etapes.length, m.verdict?.naturel], ['expiree', 2, 0])
  assert.equal(m.trancheeLe, MIDI + 2 * (duree + d.chrono.graceMs))
  assert.deepEqual([p.etat.pieces[0].choix, p.etat.pieces[0].composee], [null, null])
})

// ── Par les routes ───────────────────────────────────────────────────────

const ouverts: { close(): unknown }[] = []
after(() => ouverts.forEach(o => o.close()))
after(fermerLesMagasins)

test('en deux étapes, par les routes : la mauvaise époque, puis la bonne année — la manche n’est plus perdue', async () => {
  const b = await bancDuCabinet({ filetEnDeuxTemps: true, baseDeLaCampagne: baseDuCabinet(8, vraiesQuestionsDuFilet(10)) })
  ouverts.push(b.banc)
  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  const v0 = ok(await commencer(b, lea, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'commencer')
  const t = (departEnBase(b.fichier, v0.id).tirages as FiletEnDeuxTempsTire[])[0]
  // La première étape : rien de la bonne époque dans la vue.
  const m0 = v0.enCours as FiletEnDeuxTempsMontre
  assert.deepEqual([m0.etape, 'bonnes' in m0, 'piste' in m0], [1, false, false])
  // Un lancer d'emblée — la page d'avant la mise en ligne, restée ouverte — se refuse en mots, sans rien juger.
  const tot = await unGeste(b, lea, v0, { quoi: 'repondre', manche: 0, reponse: { filet: { epoque: t.bonnes[0], x: t.valeur } } })
  assert.deepEqual([tot.status, (tot.corps as { error?: string }).error], [400, epoqueDAbord(t)])
  // La mauvaise époque, choisie pour de bon : la vue dit la bonne, ouvre sa piste, et le chrono repart.
  const mauvaise = t.tranches.findIndex((_, k) => !t.bonnes.includes(k))
  const v1: VueDeLaPartie = ok(await unGeste(b, lea, v0, { quoi: 'epoque', manche: 0, choix: mauvaise }), 'l’époque')
  const m1 = v1.enCours as FiletEnDeuxTempsMontre
  assert.deepEqual([v1.phase, m1.etape, m1.choisie, m1.bonnes, m1.piste], ['jouer', 2, mauvaise, t.bonnes, t.bonnes[t.bonnes.length - 1]])
  assert.ok(v1.chrono && v0.chrono && v1.chrono.echeance > v0.chrono.echeance - 1, 'un chrono neuf pour la valeur')
  // Pile sur la valeur : d'un seul lancer, cette manche valait zéro et coûtait un cœur.
  const v2 = ok(await unGeste(b, lea, v1, { quoi: 'repondre', manche: 0, reponse: { filet: { epoque: m1.piste!, x: t.valeur } } }), 'le lancer')
  const corps = v2.revelation?.corps as FiletEnDeuxTempsRevele
  assert.deepEqual([corps.etoiles, corps.choisie, corps.criteres], [t.parEtape!.trois, mauvaise, { epoque: false, deux: true, trois: true }])
  assert.equal(v2.manches[0].etoiles, 2)
})

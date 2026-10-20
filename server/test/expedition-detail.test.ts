// Le détail (la version 15 du départ, le 20 octobre 2026). Le propriétaire :
// « Je veux quelque chose de bien plus difficile, aussi met un offset car tu
// as tendance à sous estimer la difficulté. Fait la forme du détail. Les
// autres suit tes recommandations » (`retours/2026-10-20/le-detail.md`). Un
// tableau dont on ne voit d'abord qu'un détail, ses cadrages à l'heure du
// serveur jusqu'au tableau entier, et son peintre à trouver ; des
// adversaires plus durs ; l'Élan qui aide et revient ; la question retrouvée
// au second essai qui entre au carnet. Les règles pures, le contenu livré, le
// générateur, les cartes, le pli, puis les routes et l'écran.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { demandeLePeintre, detailsDeLaBase, fichierDuCadrage, tableauxDuDetail, type DetailDeLaBase } from '../src/core/details'
import { detailPourUneEscale } from '../src/core/campagne'
import { NIVEAU_MAX, codexDuNiveau } from '../../shared/codex'
import {
  CRANS_D_UNE_QUESTION_DURE,
  CARTES_DU_SECOND_ESSAI,
  VERSION_DES_FAMILLES,
  PARADE_DE_LA_RARETE,
  SOIN_DU_DETAIL,
  VERSION_DU_DETAIL,
  attaqueEnQuestion,
  carteALaVersion,
  cransDeLaForme,
  cransDesPouvoirs,
  effaceesDuTour,
  refusDeLaCarte,
  retombentALErreur,
  soinALaVersion,
  type ContexteDUneCarte,
  type QuestionDuTour,
} from '../../shared/rencontres'
import {
  ARRET_SUR_IMAGE_MS,
  CADRAGES_DU_DETAIL,
  CATEGORIE_DU_DETAIL,
  MARCHES_DES_ACTES,
  MS_PAR_CADRAGE,
  POIDS_DES_ESCALES_DES_RENCONTRES,
  POIDS_DES_FORMES_AU_DETAIL,
  POIDS_DES_FORMES_A_LA_FRISE,
  QUESTION_DU_DETAIL,
  cadragesMontres,
  carteDUnActe,
  chanceSelonLaForme,
  instantDuCadrage,
  marcheDe,
  pliDeLExpedition,
  refusDUneCarte,
  type DepartDExpedition,
  type VueDeLExpedition,
} from '../../shared/expedition'
import { Journal, depart, pieces, rendre, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const V = VERSION_DU_DETAIL

// ── Les règles pures ────────────────────────────────────────────────────────

test('les cadrages d’un détail à l’heure du serveur : le premier dès la question vue, un tous les cinq secondes, jusqu’au tableau entier ; Arrêt sur image les retient', () => {
  const t0 = 1_000_000
  assert.equal(cadragesMontres(t0, t0 - 1), 0, 'rien avant')
  assert.equal(cadragesMontres(t0, t0), 1)
  assert.equal(cadragesMontres(t0, t0 + MS_PAR_CADRAGE - 1), 1)
  assert.equal(cadragesMontres(t0, t0 + MS_PAR_CADRAGE), 2)
  assert.equal(cadragesMontres(t0, t0 + 3 * MS_PAR_CADRAGE), CADRAGES_DU_DETAIL)
  assert.equal(cadragesMontres(t0, t0 + 60_000), CADRAGES_DU_DETAIL, 'jamais plus que le tableau entier')
  assert.deepEqual([1, 2, 3, 4].map(n => instantDuCadrage(n, t0) - t0), [0, MS_PAR_CADRAGE, 2 * MS_PAR_CADRAGE, 3 * MS_PAR_CADRAGE])
  // Arrêté pendant le premier : le deuxième attend la pause.
  const arret = t0 + 1000
  assert.equal(cadragesMontres(t0, t0 + MS_PAR_CADRAGE + 1000, arret), 1)
  assert.equal(instantDuCadrage(2, t0, arret), t0 + MS_PAR_CADRAGE + ARRET_SUR_IMAGE_MS)
  assert.equal(cadragesMontres(t0, instantDuCadrage(2, t0, arret), arret), 2)
})

test('un détail : deux crans reconnu avant la moitié de ses cadrages, un après ; au hasard, une chance sur quatre', () => {
  assert.equal(cransDeLaForme({ forme: 'detail', reponses: 4, devoile: { mots: 1, sur: 4 } }), CRANS_D_UNE_QUESTION_DURE)
  assert.equal(cransDeLaForme({ forme: 'detail', reponses: 4, devoile: { mots: 2, sur: 4 } }), CRANS_D_UNE_QUESTION_DURE)
  assert.equal(cransDeLaForme({ forme: 'detail', reponses: 4, devoile: { mots: 3, sur: 4 } }), 1)
  assert.equal(cransDeLaForme({ forme: 'detail', reponses: 4, devoile: { mots: 4, sur: 4 } }), 1)
  assert.equal(cransDeLaForme({ forme: 'detail', reponses: 4 }), 1, 'sans heure, le tableau entier')
  assert.equal(chanceSelonLaForme(0.6, 'detail'), 0.6, 'quatre choix : le savoir tel quel')
})

// ── Le contenu livré ────────────────────────────────────────────────────────

const LA_BASE = lireLaBase()
const PAR_ID = new Map(LA_BASE.questions.map(q => [q.id, q]))

test('les tableaux livrés : cent, chacun ses quatre cadrages ; dans la vraie base, presque tous ont leur question « Qui a peint… ? », jamais une question de dimensions ou de musée', () => {
  const tableaux = tableauxDuDetail()
  assert.equal(tableaux.length, 100)
  for (const t of tableaux) for (let k = 1; k <= CADRAGES_DU_DETAIL; k++) assert.ok(readFileSync(fichierDuCadrage(t.qid, k)).length > 1000, `${t.qid}-${k}`)
  const details = detailsDeLaBase(PAR_ID)
  assert.ok(details.length >= 95, `${details.length} tableaux posables`)
  for (const d of details) {
    assert.ok(demandeLePeintre(d.question), d.question.texte)
    assert.equal(d.question.meta.categorie, CATEGORIE_DU_DETAIL, d.question.id)
    // La base écrit parfois le peintre autrement (« Pierre-Auguste Renoir ») : son nom de famille, au moins.
    const nom = d.tableau.peintre.split(' ').pop()!.toLowerCase().slice(0, 4)
    assert.ok(d.question.reponses[d.question.bonne].toLowerCase().includes(nom), `${d.tableau.peintre} / ${d.question.reponses[d.question.bonne]}`)
  }
  const dimensions = LA_BASE.questions.find(q => q.texte.startsWith('Combien de mètres de large mesure Le Sacre'))
  if (dimensions) assert.equal(demandeLePeintre(dimensions), false)
})

test('le tableau d’une escale : jamais vu d’abord — aucune de ses questions —, à la marche de l’escale s’il en reste ; puis le plus anciennement vu', () => {
  const details = detailsDeLaBase(PAR_ID).slice(0, 6)
  const marche = (q: QuestionDeLaBase) => (details.findIndex(d => d.question === q) < 3 ? 'facile' : 'moyen')
  const vues = new Map<string, number>()
  const tire = (m: 'facile' | 'moyen') => detailPourUneEscale(details, m, vues, marche)!
  for (let n = 0; n < 50; n++) assert.ok(details.indexOf(tire('moyen')) >= 3, 'à sa marche')
  // Vu par une autre de ses questions — une série lui a demandé sa largeur : le tableau est vu.
  for (const d of details.slice(0, 5)) vues.set(d.tableau.questions[d.tableau.questions.length - 1], 1000 + details.indexOf(d))
  for (let n = 0; n < 20; n++) assert.equal(tire('facile'), details[5], 'le seul jamais vu, même hors de sa marche')
  vues.set(details[5].question.id, 5000)
  assert.equal(tire('facile'), details[0], 'tous vus : le plus anciennement')
})

// ── Le générateur ───────────────────────────────────────────────────────────

test('la version 15 : la moitié de l’escale de la frise en détail, dès l’étage 2, sur le même tirage — un détail se pose en Arts & lettres', () => {
  let details = 0
  let frises = 0
  let formes = 0
  for (let i = 0; i < 400; i++) {
    const tirer = (poids: typeof POIDS_DES_FORMES_AU_DETAIL) => carteDUnActe(`detail:${i}`, i % 3, ['animaux'], undefined, POIDS_DES_ESCALES_DES_RENCONTRES, poids, true)
    const avant = tirer(POIDS_DES_FORMES_A_LA_FRISE)
    const apres = tirer(POIDS_DES_FORMES_AU_DETAIL)
    assert.ok(!avant.escales.some(e => e.forme === 'detail'), 'la version 14 n’en pose aucun')
    assert.deepEqual(
      apres.escales.map(e => [e.id, e.sorte, e.curiosite]),
      avant.escales.map(e => [e.id, e.sorte, e.curiosite]),
      'la même carte, à la forme près',
    )
    apres.escales.forEach((e, k) => {
      const a = avant.escales[k]
      if (e.forme === 'detail') {
        details++
        assert.equal(a.forme, 'frise', 'pris à la frise')
        assert.deepEqual(e.theme, { categories: [CATEGORIE_DU_DETAIL] }, 'son tableau vient d’Arts & lettres')
        assert.ok(e.etage > 0, 'jamais au premier étage')
      } else {
        assert.equal(e.forme, a.forme)
        assert.deepEqual(e.theme, a.theme)
      }
      if (e.forme === 'frise') frises++
      if (e.forme && e.etage > 0) formes++
    })
  }
  assert.ok(Math.abs(details / formes - 0.05) < 0.02, `${details} détails sur ${formes} escales`)
  assert.ok(Math.abs(frises / formes - 0.05) < 0.02, `${frises} frises sur ${formes} escales`)
})

test('bien plus difficile, à la version 15 seulement : l’acte 3 en experte en haut, son gardien aussi ; une expédition partie en version 14 garde ses marches', () => {
  const haut = { sorte: 'question' as const, etage: 4 }
  const gardien = { sorte: 'gardien' as const, etage: 6 }
  assert.equal(marcheDe(2, haut, VERSION_DES_FAMILLES), MARCHES_DES_ACTES[2].haut)
  assert.equal(marcheDe(2, gardien, VERSION_DES_FAMILLES), 'difficile')
  assert.equal(marcheDe(2, haut, V), 'expert')
  assert.equal(marcheDe(2, { sorte: 'elite', etage: 4 }, V), 'difficile', 'l’élite garde sa marche')
  assert.equal(marcheDe(2, gardien, V), 'expert')
  // Les deux premiers actes ne bougent pas.
  for (const acte of [0, 1]) for (const e of [haut, gardien, { sorte: 'elite' as const, etage: 3 }]) assert.equal(marcheDe(acte, e, V), marcheDe(acte, e, VERSION_DES_FAMILLES))
})

// ── Les cartes ──────────────────────────────────────────────────────────────

/** Un détail sous les yeux : ce que les règles des cartes en lisent. */
const surUnDetail = (main: string[], q: Partial<QuestionDuTour> = {}): ContexteDUneCarte => ({
  v: V,
  tour: { phase: 'question', inspiration: 0, jouees: [], surLaQuestion: [] },
  main,
  pouvoirs: [],
  question: { reponses: 4, tiree: 'detail', forme: 'detail', six: true, nombre: false, datee: true, categorie: CATEGORIE_DU_DETAIL, ...q },
  courage: 50,
  derniereFrappe: 0,
  defausse: 1,
})

test('sur un détail, ce qui s’y comprend se joue — effacer, souffler une lettre, l’époque, deux réponses, l’arrêter — ; ce qui le changerait de forme se refuse en le disant', () => {
  for (const cle of ['coup-d-oeil', 'initiale', 'lettre', 'repere', 'enigme', 'double-chance', 'arret-sur-image']) {
    if (!carteALaVersion(cle, V)) continue
    assert.equal(refusDeLaCarte(surUnDetail([cle]), cle), null, cle)
  }
  const sansAutreForme = 'Pas sur un détail : sans son tableau, la question le nommerait'
  for (const cle of ['corser', 'polymorphe', 'simplifier', 'miroir', 'metamorphose', 'prisme']) {
    if (!carteALaVersion(cle, V)) continue
    assert.equal(refusDeLaCarte(surUnDetail([cle]), cle), sansAutreForme, cle)
  }
  if (carteALaVersion('deux-visages', V)) assert.equal(refusDeLaCarte(surUnDetail(['deux-visages']), 'deux-visages'), 'Pas sur un détail : deux tableaux à la fois, tu n’en regarderais aucun')
  assert.equal(effaceesDuTour(['coup-d-oeil'], [], { reponses: 4, forme: 'detail' }, V), 1)
})

test('dans le pli, un détail s’annonce avant d’être vu : ses cadrages ne courent qu’une fois la question sous les yeux ; reconnu tôt, il vaut plus', () => {
  const j = new Journal(depart('detail:pli', [], { v: V, codex: codexDuNiveau(1, [], [], V) }))
  j.avancer('e00')
  // Le pli se rejoue d'un bout à l'autre : la question posée en détail ouvre son tour en préparation.
  const e = j.poser({ forme: 'detail', tiree: 'detail', reponses: 4, mots: CADRAGES_DU_DETAIL })
  assert.equal(e.rencontre!.tour.phase, 'preparation')
  assert.equal(j.vue().annonce?.forme, 'detail')
  assert.equal(j.vue().apercu!.juste.auPremierMot, CRANS_D_UNE_QUESTION_DURE)
  assert.equal(j.vue().apercu!.juste.brises, 1)
  assert.equal(j.voir().rencontre!.tour.phase, 'question')
})

// ── L'Élan du détail ────────────────────────────────────────────────────────

test('l’Élan de la version 15 : Foulée efface une réponse et revient, le Rythme en efface deux, Vent arrière posé efface à chaque question et retombe à l’erreur ; la version 14 garde les siens', () => {
  const q = { reponses: 4 }
  assert.equal(effaceesDuTour(['foulee'], [], q, V), 1)
  assert.equal(effaceesDuTour(['foulee+'], [], q, V), 2)
  assert.equal(effaceesDuTour(['rythme'], [], q, V), 2)
  assert.equal(effaceesDuTour([], ['vent-arriere'], q, V), 1)
  assert.equal(effaceesDuTour(['foulee'], [], q, VERSION_DES_FAMILLES), 0, 'en version 14, Foulée frappe')
  assert.equal(effaceesDuTour(['rythme'], [], q, VERSION_DES_FAMILLES), 1)
  assert.equal(effaceesDuTour([], ['vent-arriere'], q, VERSION_DES_FAMILLES), 0)
  assert.equal(cransDesPouvoirs({ pouvoirs: ['vent-arriere'], v: V }), 0, 'il efface au lieu de frapper')
  assert.equal(cransDesPouvoirs({ pouvoirs: ['vent-arriere'], v: VERSION_DES_FAMILLES }), 2)
  assert.ok(retombentALErreur(V).has('vent-arriere') && !retombentALErreur(VERSION_DES_FAMILLES).has('vent-arriere'))
  for (const cle of ['foulee', 'rythme']) {
    assert.equal(carteALaVersion(cle, V)!.moment, 'reflexe', cle)
    assert.ok(carteALaVersion(cle, V)!.indice, `${cle} aide : la mesure l’écarte`)
  }
  assert.equal(carteALaVersion('foulee', V)!.resume, 'Efface 1, revient')
  assert.equal(carteALaVersion('foulee', VERSION_DES_FAMILLES)!.resume, '+2, revient')
  assert.equal(carteALaVersion('vent-arriere', V)!.moment, 'pouvoir')
  // Foulée se refuse comme le Rythme : rien à effacer d'un vrai ou faux.
  const vf: ContexteDUneCarte = { ...surUnDetail(['foulee']), question: { reponses: 2, tiree: 'vrai-faux', forme: 'vrai-faux', six: false, nombre: false, datee: false, categorie: 'Histoire' } }
  assert.equal(refusDeLaCarte(vf, 'foulee'), 'Pas sur un vrai ou faux : elle répondrait à ta place')
})

test('les cartes plus rares aident à gagner : jouée sur la question, une rare pare la moitié de l’attaque d’une erreur, une épique toute ; le soin rend la moitié — la version 14 garde les siens ; les règles le disent', async () => {
  const [commune, rare, epique] = ['coup-d-oeil', 'lecon', 'vision']
  assert.deepEqual([commune, rare, epique].map(cle => carteALaVersion(cle, V)?.rarete), ['commun', 'rare', 'epique'])
  const attaque = (jouees: string[], v: number, frappe = 9) => attaqueEnQuestion({ frappe, tour: { jouees, surLaQuestion: [] }, pouvoirs: [], v })
  assert.equal(PARADE_DE_LA_RARETE.rare, 0.5)
  assert.equal(PARADE_DE_LA_RARETE.epique, 1)
  assert.equal(attaque([], V), 9)
  assert.equal(attaque([commune], V), 9, commune)
  assert.equal(attaque([rare], V, 8), 4, rare)
  assert.equal(attaque([epique], V), 0, epique)
  assert.equal(attaque([`${epique}+`], V), 0, 'améliorée, la même rareté')
  assert.equal(attaque([rare], VERSION_DES_FAMILLES), 9, 'en version 14, la rareté ne pare rien')
  assert.equal(attaque([epique], VERSION_DES_FAMILLES), 9)
  // Le soin, durci pour tous : la source, le campement, l'échoppe et la fiole rendent la moitié, arrondie au-dessus.
  assert.equal(SOIN_DU_DETAIL, 0.5)
  assert.equal(soinALaVersion(15, V), 8)
  assert.equal(soinALaVersion(15, VERSION_DES_FAMILLES), 15)
  const { FeuilleDesRegles } = (await pieces()) as unknown as { FeuilleDesRegles: Composant }
  const regles = async (v: number) => texte(await rendre(FeuilleDesRegles, { rencontres: true, v, codex: codexDuNiveau(NIVEAU_MAX, [], [], v), ascension: 0, onFermer: rien }))
  assert.match(await regles(V), /Une carte rare jouée sur la question pare la moitié de son attaque si tu te trompes, une épique toute\./)
  assert.doesNotMatch(await regles(VERSION_DES_FAMILLES), /carte rare jouée/)
})

/**
 * Un journal du détail où cette carte est dans la main de l'élite, la
 * question sous les yeux, où elle se joue : ses offres ne proposent qu'elle
 * (comme `dansLaMain` des familles). Une graine cherchée, jamais choisie.
 */
function dansLaMain(cle: string): Journal {
  const codex = codexDuNiveau(NIVEAU_MAX, [], [], V)
  for (let n = 0; n < 3000; n++) {
    const j = new Journal(depart(`elan:${cle}:${n}`, [], { v: V, codex: { ...codex, cartes: [cle] } }))
    let e = j.avancer('e00')
    if (e.rencontre!.tour.phase === 'preparation') e = j.voir(0)
    const autre = e.rencontre!.main.find(k => k !== cle && refusDUneCarte(j.depart, e, k, j.questions) === null)
    if (autre) j.jouer(autre)
    j.gagner()
    j.prendreSiOfferte(cle)
    j.avancer('e10')
    j.prendreSiOfferte(cle)
    e = j.avancer('e20')
    // La carte prise rejoint la pioche de l'acte : elle vient en main au fil des questions de l'élite.
    for (let q = 0; q < 3 && e.rencontre?.sorte === 'elite'; q++) {
      if (e.rencontre.tour.phase === 'preparation') e = j.voir(0)
      if (e.rencontre?.main.includes(cle) && refusDUneCarte(j.depart, e, cle, j.questions) === null) return j
      e = j.repondre(false)
    }
  }
  throw new Error(`aucune graine ne met ${cle} dans une main où elle se joue`)
}

test('l’Élan de la version 15 dans le pli : Foulée jouée efface sans frapper, et revient ; Vent arrière posé retombe à la première erreur', () => {
  const j = dansLaMain('foulee')
  const avant = j.vue().apercu!.juste.brises
  let e = j.jouer('foulee')
  assert.equal(e.rencontre!.tour.charge, 0, 'elle ne frappe plus')
  assert.equal(j.vue().apercu!.juste.brises, avant)
  e = j.repondre(true)
  assert.deepEqual(e.coup!.revenues, ['foulee'])
  const v = dansLaMain('vent-arriere')
  e = v.jouer('vent-arriere')
  assert.ok(e.rencontre!.pouvoirs.includes('vent-arriere'))
  e = v.repondre(false)
  assert.deepEqual(e.coup!.retombees, ['vent-arriere'], 'sa première erreur le fait retomber')
})

// ── Par les routes ──────────────────────────────────────────────────────────

const DETAILS: DetailDeLaBase[] = detailsDeLaBase(PAR_ID)
const BASE = new BaseDeLaCampagne([...baseDEssai(120, { categories: [CATEGORIE_DU_DETAIL] }).questions, ...DETAILS.map(d => d.question)])
const horloge = { t: Date.UTC(2026, 9, 20, 9, 0) }

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, questionAuCentre: true, horlogeDuJour: () => horloge.t })
})

after(() => banc.close())

const lire = (cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const image = (cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, type: r.headers.get('content-type'), octets: Buffer.from(await r.arrayBuffer()) }))
const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fn: (db: Database.Database) => T, ecriture = false): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Les questions telles que l'expédition les garde : le tableau d'un détail, que seul le serveur sait. */
const questionsDe = (id: string): { id: string; texte: string; bonne: number; devoileLe?: number; detail?: { qid: string; titre: string; peintre: string; annee: number } }[] =>
  base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/** Partir à la version de la préproduction (le détail, v15), puis récrire le départ : les escales des deux premiers étages en détail. */
async function partirAuDetail(cookie: string): Promise<VueDeLExpedition> {
  const r = await poster(cookie, '/api/expedition', { rencontres: true, questionAuCentre: true })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(db => {
    const d = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    assert.equal(d.v, V, 'la préproduction part au détail')
    for (const e of d.cartes[0].escales) {
      if (e.etage > 1) continue
      for (const cle of ['curiosite', 'chance'] as const) delete e[cle]
      Object.assign(e, { sorte: 'question', theme: { categories: [CATEGORIE_DU_DETAIL] }, forme: 'detail' })
    }
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
const page = (): Promise<{ Escale: Composant }> => import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)

test('par les routes et à l’écran : un détail — ni le tableau ni son intitulé avant le verdict ; chaque cadrage à son heure, pas avant ; reconnu tôt, deux crans ; le tableau entier à la révélation ; raté, au carnet ; « Mes réponses »', async () => {
  const c = await inscrireProfil(banc.url, 'amatrice', 'Amatrice')
  let v = await partirAuDetail(c)
  v = (await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })).corps.expedition
  // L'annonce d'abord : un détail ne court qu'une fois vu.
  assert.equal(v.question, undefined)
  assert.equal(v.rencontre!.annonce!.forme, 'detail')
  const position = v.rencontre!.position!
  const gardee = questionsDe(v.id)[position]
  assert.ok(gardee.detail, 'la question garde son tableau')
  const { qid, titre } = gardee.detail!
  const tot = await lire(c, `/api/expedition/${v.id}/detail/${position}/1`)
  assert.equal(tot.status, 400)
  assert.equal(tot.corps.error, 'Prépare-toi, puis vois la question : elle n’est pas encore sous tes yeux')
  // Vue : son premier cadrage, à l'heure du serveur.
  v = (await geste(c, v, { quoi: 'voir', mise: 0, position })).corps.expedition
  const q = v.question!
  assert.equal(q.forme, 'detail')
  assert.equal(q.texte, QUESTION_DU_DETAIL)
  assert.deepEqual(q.detail, { depuis: horloge.t })
  assert.equal(questionsDe(v.id)[position].devoileLe, horloge.t)
  // Invariant 1 : ni le QID, ni le titre, ni l'intitulé de la base, qui le nomme.
  for (const secret of [qid, titre, gardee.texte]) assert.ok(!JSON.stringify(v).includes(secret), `${secret} ne part pas`)
  const premier = await image(c, `/api/expedition/${v.id}/detail/${position}/1`)
  assert.equal(premier.status, 200)
  assert.equal(premier.type, 'image/webp')
  assert.ok(premier.octets.equals(readFileSync(fichierDuCadrage(qid, 1))))
  const deuxieme = await image(c, `/api/expedition/${v.id}/detail/${position}/2`)
  assert.equal(deuxieme.status, 425, 'pas avant son heure')
  assert.equal((await image(c, `/api/expedition/${v.id}/detail/${position}/4`)).status, 425, 'ni le tableau entier')
  horloge.t += MS_PAR_CADRAGE
  const alheure = await image(c, `/api/expedition/${v.id}/detail/${position}/2`)
  assert.equal(alheure.status, 200)
  assert.ok(alheure.octets.equals(readFileSync(fichierDuCadrage(qid, 2))))
  for (const k of [0, 5]) assert.equal((await image(c, `/api/expedition/${v.id}/detail/${position}/${k}`)).status, 400, `cadrage ${k}`)
  // L'écran : le tableau du moment, ses quatre pas, la question du détail — jamais le titre.
  const { Escale } = await page()
  const props = (vue: VueDeLExpedition, reponse: unknown = null) => ({ vue, avant: reponse ? v : null, question: v.question, reponse, choix: null, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien })
  const html = await rendre(Escale, props(v))
  assert.match(html, /class="exp-detail"/)
  assert.match(html, /aria-valuemax="4"/)
  assert.match(texte(html), /Qui a peint ce tableau/)
  assert.ok(!texte(html).includes(titre))
  // Reconnu au deuxième cadrage : deux crans, et le tableau nommé.
  const laBase = PAR_ID.get(gardee.id)!
  const juste = await poster(c, `/api/expedition/${v.id}/reponse`, { position, choix: q.reponses.indexOf(laBase.reponses[laBase.bonne]) })
  assert.equal(juste.status, 200, juste.corps.error)
  assert.equal(juste.corps.juste, true)
  assert.equal(juste.corps.coup.brises, CRANS_D_UNE_QUESTION_DURE)
  assert.deepEqual(juste.corps.detail, { titre, peintre: gardee.detail!.peintre, annee: gardee.detail!.annee })
  const ligne = base(db => db.prepare('SELECT reserve_id, forme FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, position)) as Record<string, unknown>
  assert.deepEqual(ligne, { reserve_id: gardee.id, forme: 'detail' }, 'sa question de la base, à sa forme')
  assert.equal((await image(c, `/api/expedition/${v.id}/detail/${position}/4`)).status, 200, 'répondue, le tableau entier')
  const revele = await rendre(Escale, props(juste.corps.expedition, juste.corps))
  assert.match(revele, /class="tableau-entier"/)
  assert.ok(texte(revele).includes(titre.replace(/'/g, '’')), 'nommé à la révélation')
  // Le suivant : un autre tableau — raté, il entre au carnet.
  v = juste.corps.expedition
  for (let n = 0; n < 6 && v.rencontre && v.question; n++) {
    const p = v.question.index
    const g = questionsDe(v.id)[p]
    const b = PAR_ID.get(g.id)
    v = (await poster(c, `/api/expedition/${v.id}/reponse`, { position: p, choix: b ? v.question.reponses.indexOf(b.reponses[b.bonne]) : 0 })).corps.expedition
  }
  if (v.offre) v = (await geste(c, v, { quoi: 'prendre', jokers: [] })).corps.expedition
  const avance = await geste(c, v, { quoi: 'avancer', vers: v.permises[0] })
  assert.equal(avance.status, 200, avance.corps.error)
  v = avance.corps.expedition
  const p2 = v.rencontre!.position!
  if (v.rencontre!.phase === 'preparation') v = (await geste(c, v, { quoi: 'voir', mise: 0, position: p2 })).corps.expedition
  const g2 = questionsDe(v.id)[p2]
  assert.ok(g2.detail && g2.detail.qid !== qid, 'jamais deux fois le même tableau d’abord')
  const b2 = PAR_ID.get(g2.id)!
  const fausse = v.question!.reponses.findIndex(x => x !== b2.reponses[b2.bonne])
  const rate = await poster(c, `/api/expedition/${v.id}/reponse`, { position: p2, choix: fausse })
  assert.equal(rate.status, 200, rate.corps.error)
  assert.equal(rate.corps.juste, false)
  const carnet = (await lire(c, '/api/campagne/carnet')).corps
  assert.equal(carnet.aRevoir + carnet.demain + carnet.plusTard, 1, 'le tableau raté entre au carnet, sous sa question de la base')
  // « Mes réponses » : la question du détail, le tableau entier, nommé — servi une fois l'expédition finie.
  assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  const correction = (await lire(c, `/api/campagne/serie/${v.id}/correction`)).corps
  const corrigee = correction[p2]
  assert.equal(corrigee.texte, QUESTION_DU_DETAIL)
  assert.deepEqual(corrigee.detail, { titre: g2.detail!.titre, peintre: g2.detail!.peintre, annee: g2.detail!.annee, image: `/api/expedition/${v.id}/detail/${p2}/${CADRAGES_DU_DETAIL}` })
  assert.equal((await image(c, corrigee.detail.image)).status, 200)
  const { SerieCorrigee } = (await import(new URL('../../client/src/components/SerieCorrigee.tsx', import.meta.url).href)) as { SerieCorrigee: Composant }
  const mesReponses = (await rendre(SerieCorrigee, { correction })).split('<li class="corrige ').slice(1)
  assert.match(mesReponses[p2], /class="tableau-entier"/)
  assert.ok(texte(mesReponses[p2]).includes(g2.detail!.titre.replace(/'/g, '’')))
  // Un autre profil ne lit pas ses tableaux : son expédition lui est introuvable.
  const autre = await inscrireProfil(banc.url, 'voisin', 'Voisin')
  assert.equal((await image(autre, corrigee.detail.image)).status, 400)
})

// ── Le carnet et le second essai ────────────────────────────────────────────

test('le carnet : une question retrouvée au second essai y entre — sa première réponse était fausse — ; une bonne réponse aidée d’un indice, non', async () => {
  const c = await inscrireProfil(banc.url, 'rempart', 'Rempart')
  const v = (await poster(c, '/api/expedition', { rencontres: true, questionAuCentre: true })).corps as VueDeLExpedition
  const [essai, indice] = BASE.questions.filter(q => q.reponses.length === 4).slice(0, 2)
  const hier = horloge.t - 2 * 86_400_000
  base(db => {
    const inserer = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, joker, forme) VALUES (?, ?, ?, 0, 1, ?, ?, NULL)')
    inserer.run(v.id, 90, essai.id, hier, CARTES_DU_SECOND_ESSAI[0])
    inserer.run(v.id, 91, indice.id, hier, 'coup-d-oeil')
  }, true)
  const carnet = (await lire(c, '/api/campagne/carnet')).corps
  assert.equal(carnet.aRevoir, 1, 'retrouvée au second essai : à revoir')
  assert.deepEqual(new Set(CARTES_DU_SECOND_ESSAI), new Set(['parade', 'second-souffle', 'bastion', 'cuirasse']))
})

// « Ton style » (le 19 octobre 2026) : « Pour les cartes il faut vraiment plus
// de gameplay différents. Quitte à rajouter des communes aussi. Là aujourd'hui
// j'ai l'impression de piocher tout le temps la même chose et de pas avoir à
// choisir de style de jeu. » Une famille se choisit au départ : ses deux
// cartes partent dans le paquet, chaque récompense en propose une, et le codex
// ouvre la variété d'abord — trois styles au niveau 1, un de plus à chacun des
// trois suivants. Le calcul, le pli, les routes, la page.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { ECHELLE, NIVEAUX, codexDuNiveau, ecrireLeBilan, niveauDuStyle, offreDuCodex, ouvertureDe, stylesDuNiveau } from '../../shared/codex'
import {
  BASES_REMPLACEES_PAR_LE_STYLE,
  CARTES_DE_DEPART_DU_STYLE,
  CARTES_DES_RENCONTRES,
  CARTES_PAR_OFFRE,
  FAMILLES_DE_CARTES,
  PAQUET_DES_RENCONTRES,
  RARETES_DU_JEU_COMPLET,
  STYLES,
  VERSION_DU_JEU_COMPLET,
  carteDeRencontre,
  carteDuLegendaire,
  estUnStyle,
  paquetDesRencontres,
  type StyleDeJeu,
} from '../../shared/rencontres'
import {
  GARDIEN,
  pliDeLExpedition,
  styleDuDepart,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type PageDeLExpedition,
  type QuestionPosee,
  type VueDeLExpedition,
} from '../../shared/expedition'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const famille = (cle: string) => carteDeRencontre(cle)!.famille

// ── L'échelle et le paquet ──────────────────────────────────────────────────

test('l’échelle ouvre la variété d’abord : trois styles au niveau 1, un de plus aux niveaux 2, 3 et 4 — chacun avec ses trois communes, ses deux cartes de départ comprises', () => {
  assert.deepEqual(STYLES, ['rempart', 'erudit', 'devin', 'flambeur', 'elan', 'metamorphe'], 'dans l’ordre où le codex les ouvre')
  assert.deepEqual(stylesDuNiveau(1), ['rempart', 'erudit', 'devin'])
  assert.deepEqual(
    [2, 3, 4].map(n => stylesDuNiveau(n).slice(-1)[0]),
    ['flambeur', 'elan', 'metamorphe'],
  )
  assert.deepEqual(stylesDuNiveau(10), STYLES)
  assert.deepEqual(STYLES.map(niveauDuStyle), [1, 1, 1, 2, 3, 4])
  assert.deepEqual(codexDuNiveau(1, []).styles, ['rempart', 'erudit', 'devin'], 'le codex d’un niveau les dit, pour le départ')
  for (const style of STYLES) {
    const communes = CARTES_DES_RENCONTRES.filter(c => c.famille === style && c.rarete === 'commun')
    assert.equal(communes.length, 3, style)
    for (const c of communes) assert.deepEqual(ouvertureDe(c.cle), { niveau: niveauDuStyle(style) }, `${c.cle} s’ouvre avec son style`)
    for (const cle of CARTES_DE_DEPART_DU_STYLE[style]) assert.deepEqual([famille(cle), carteDeRencontre(cle)!.rarete], [style, 'commun'], cle)
    assert.ok(FAMILLES_DE_CARTES[style].jeu, `${style} dit sa façon de gagner`)
  }
  // Le niveau 1 tirait huit cartes à gagner, presque toutes neutres : seize maintenant, des neutres et trois familles entières.
  assert.equal(ECHELLE[0].cartes.length, 16)
  assert.deepEqual([...new Set(ECHELLE[0].cartes.map(famille))].sort(), ['devin', 'erudit', 'neutre', 'rempart'])
  assert.deepEqual(
    [estUnStyle('devin'), estUnStyle('neutre'), estUnStyle('Devin'), estUnStyle(42)],
    [true, false, false, false],
    'les neutres sont à tout le monde : pas un style',
  )
})

test('le paquet d’un style : ses deux cartes à la place de deux cartes de base de même nature — l’attaque d’une Concentration, la protection d’une Prudence ; sans style, celui de toujours', () => {
  assert.deepEqual(paquetDesRencontres([]), [...PAQUET_DES_RENCONTRES].sort())
  const compte = (paquet: string[]) => ['concentration', 'prudence'].map(cle => paquet.filter(c => c === cle).length)
  for (const style of STYLES) {
    const paquet = paquetDesRencontres(['lg:dragon'], style)
    assert.equal(paquet.length, PAQUET_DES_RENCONTRES.length + 1, 'autant de cartes, et celle de l’invité')
    for (const cle of [...CARTES_DE_DEPART_DU_STYLE[style], carteDuLegendaire('lg:dragon')!.cle]) assert.ok(paquet.includes(cle), `${style} : ${cle}`)
    const [x, y] = BASES_REMPLACEES_PAR_LE_STYLE[style]
    assert.deepEqual(compte(paquet), [4 - [x, y].filter(c => c === 'concentration').length, 4 - [x, y].filter(c => c === 'prudence').length], style)
  }
  // Mesuré : l'Érudit, le Flambeur et l'Élan, qui ne font qu'attaquer, gardent leurs quatre Prudences — sans quoi leur paquet manquait
  // de boucliers ; le Rempart garde ses quatre Concentrations.
  assert.deepEqual(
    STYLES.map(style => compte(paquetDesRencontres([], style))),
    [
      [4, 2],
      [2, 4],
      [3, 3],
      [2, 4],
      [2, 4],
      [3, 3],
    ],
  )
})

// ── Les offres ──────────────────────────────────────────────────────────────

/**
 * Les offres d'avant « Ton style », relevées avant lui : un codex du niveau 10
 * de l'échelle d'alors — Génie et Inarrêtable y étaient, Lancée et
 * Échauffement non —, le Phénix et Banco, dans l'ordre du catalogue.
 */
const DIX_D_AVANT = [
  'concentration', 'prudence', 'coup-d-oeil', 'echange', 'pioche', 'arret-sur-image', 'detour', 'evidence', 'double-chance', 'sursis', 'meditation',
  'sang-froid', 'panacee', 'maitrise', 'tout-ou-rien', 'quitte-ou-double', 'surmenage', 'plume', 'savoir-faire', 'memoire', 'bibliotheque', 'lecon',
  'expose', 'encyclopedie', 'genie', 'doubler-la-mise', 'pourboire', 'cagnotte', 'banco', 'assurance', 'fortune', 'pactole', 'rafle', 'corser',
  'simplifier', 'volte-face', 'prisme', 'miroir', 'cameleon', 'metamorphose', 'polymorphe', 'foulee', 'acceleration', 'rythme', 'sprint',
  'vent-arriere', 'inarretable', 'parade', 'muraille', 'pansement', 'contre-attaque', 'cuirasse', 'second-souffle', 'bastion', 'represailles',
  'lucidite', 'augure', 'presage', 'troisieme-oeil', 'voyance', 'astrolabe', 'vision', 'revelation', 'renaissance',
]
const OFFRES_D_AVANT: Record<string, string[]> = {
  'dix:0': ['lecon', 'second-souffle', 'cameleon'],
  'tresor:0': ['renaissance', 'parade', 'fortune'],
  'dix:1': ['contre-attaque', 'lecon', 'cuirasse'],
  'tresor:1': ['renaissance', 'lecon', 'simplifier'],
  'dix:2': ['augure', 'parade', 'voyance'],
  'tresor:2': ['renaissance', 'tout-ou-rien', 'prisme'],
  'dix:3': ['fortune', 'second-souffle', 'bibliotheque'],
  'tresor:3': ['renaissance', 'savoir-faire', 'expose'],
  'dix:4': ['lecon', 'doubler-la-mise', 'second-souffle'],
  'tresor:4': ['renaissance', 'plume', 'memoire'],
  'dix:5': ['troisieme-oeil', 'pansement', 'surmenage'],
  'tresor:5': ['renaissance', 'tout-ou-rien', 'voyance'],
}

test('sans style, une offre est celle d’avant lui, carte pour carte : une expédition partie avant se rejoue telle qu’elle s’est jouée', () => {
  const paquet = ['concentration', 'concentration', 'prudence', 'parade', 'contre-attaque', 'plume']
  for (let k = 0; k < 6; k++) {
    assert.deepEqual(offreDuCodex(`avant:${k}`, k, DIX_D_AVANT, paquet, RARETES_DU_JEU_COMPLET.elite), OFFRES_D_AVANT[`dix:${k}`], `dix:${k}`)
    assert.deepEqual(offreDuCodex(`avant:${k}`, k, DIX_D_AVANT, paquet, RARETES_DU_JEU_COMPLET.rencontre, true), OFFRES_D_AVANT[`tresor:${k}`], `tresor:${k}`)
  }
})

test('une offre d’un style : une de ses cartes d’abord — la même à chaque lecture —, puis deux d’ailleurs ; après la légendaire d’un trésor ; aucune s’il n’en a pas d’ouverte', () => {
  const ouvertes = codexDuNiveau(10, ['lg:phenix'], ['pari-de-40']).cartes
  for (const style of STYLES) {
    let dAilleurs = 0
    for (let k = 0; k < 120; k++) {
      const offre = offreDuCodex(`style:${style}:${k}`, k, ouvertes, [], RARETES_DU_JEU_COMPLET.rencontre, false, style)
      assert.equal(offre.length, CARTES_PAR_OFFRE)
      assert.equal(new Set(offre).size, CARTES_PAR_OFFRE, 'trois distinctes')
      assert.equal(famille(offre[0]), style, `${style}, offre ${k} : ${offre}`)
      assert.deepEqual(offreDuCodex(`style:${style}:${k}`, k, ouvertes, [], RARETES_DU_JEU_COMPLET.rencontre, false, style), offre, 'recharger ne la change pas')
      if (offre.slice(1).some(cle => famille(cle) !== style)) dAilleurs++
    }
    assert.ok(dAilleurs > 100, `${style} : les deux autres viennent de partout (${dAilleurs} sur 120)`)
  }
  // Au niveau 1, sa carte est une de ses communes, que son codex ouvre — même quand l'élite tire une rare.
  const deUn = codexDuNiveau(1, []).cartes
  for (const style of stylesDuNiveau(1)) {
    for (let k = 0; k < 60; k++) {
      const offre = offreDuCodex(`un:${style}:${k}`, k, deUn, [], RARETES_DU_JEU_COMPLET.elite, false, style)
      assert.ok(deUn.includes(offre[0]) && famille(offre[0]) === style, `${style} : ${offre[0]}`)
      assert.ok(offre.every(cle => deUn.includes(cle)), 'rien hors de son codex')
    }
  }
  // Une qu'il n'a pas encore, s'il en reste : l'Érudit part avec Plume et Savoir-faire — Mémoire, la troisième de ses communes, jusqu'à
  // ce qu'il la prenne ; puis l'une des trois. Améliorée, une carte de son paquet est encore la sienne.
  const erudit = paquetDesRencontres([], 'erudit')
  for (let k = 0; k < 60; k++) assert.equal(offreDuCodex(`neuve:${k}`, k, deUn, erudit, RARETES_DU_JEU_COMPLET.rencontre, false, 'erudit')[0], 'memoire')
  const tout = [...erudit, 'memoire+']
  const reprises = new Set(Array.from({ length: 60 }, (_, k) => offreDuCodex(`neuve:${k}`, k, deUn, tout, RARETES_DU_JEU_COMPLET.rencontre, false, 'erudit')[0]))
  assert.deepEqual([...reprises].sort(), ['memoire', 'plume', 'savoir-faire'])
  // Avec un style, les deux autres viennent de partout, au même poids : la couleur de son paquet ne les tire plus vers une famille.
  const duRempart = (paquet: string[]) => {
    let n = 0
    for (let k = 0; k < 400; k++) for (const cle of offreDuCodex(`poids:${k}`, k, ouvertes, paquet, RARETES_DU_JEU_COMPLET.rencontre, false, 'devin').slice(1)) if (famille(cle) === 'rempart') n++
    return n
  }
  const sansRien = duRempart([])
  const avecLeRempart = duRempart(['parade', 'parade', 'contre-attaque', 'contre-attaque', 'muraille', 'muraille'])
  assert.ok(avecLeRempart < 1.3 * sansRien, `du Rempart : ${avecLeRempart} contre ${sansRien}`)
  // Le trésor d'un gardien : la légendaire de son codex d'abord, puis sa carte.
  const tresor = offreDuCodex('tresor:style', 0, codexDuNiveau(3, ['lg:chouette']).cartes, [], RARETES_DU_JEU_COMPLET.elite, true, 'devin')
  assert.deepEqual([tresor[0], famille(tresor[1])], ['sagesse', 'devin'])
  // Un style dont son codex n'ouvre aucune carte — un départ trafiqué — : trois cartes d'ailleurs, sans refus.
  const ferme = offreDuCodex('ferme', 0, deUn, [], RARETES_DU_JEU_COMPLET.elite, false, 'metamorphe')
  assert.equal(ferme.length, CARTES_PAR_OFFRE)
  assert.ok(ferme.every(cle => famille(cle) !== 'metamorphe'))
})

// ── Le pli ──────────────────────────────────────────────────────────────────

/** Une carte faite à la main : une question au bas, un coffre, une question, le campement, le gardien. */
function carte(): CarteDUnActe {
  const q = { theme: { categories: ['Histoire'] }, forme: 'quatre' as const, chance: 0.7 }
  return {
    depart: ['e00'],
    chanceDuGardien: 0.6,
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', ...q, suite: ['e10'] },
      { id: 'e10', etage: 1, colonne: 0, sorte: 'coffre', suite: ['e20'] },
      { id: 'e20', etage: 2, colonne: 0, sorte: 'question', ...q, suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}

/** Un départ du jeu complet au niveau 1 — avec ce style, ou sans. */
const depart = (graine: string, style?: StyleDeJeu, v: DepartDExpedition['v'] = VERSION_DU_JEU_COMPLET): DepartDExpedition => ({
  v,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee: ['lg:licorne'],
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
  codex: { ...codexDuNiveau(1, []), renommee: 0 },
  ...(style && { style }),
})

/** Un journal qu'on écrit comme le serveur : chaque geste, puis ce que le pli demande de tirer. */
class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, this.reponses)
  }
  private tirer() {
    const e = this.etat()
    for (let k = 0; e.aTirer && k < e.aTirer.combien; k++) {
      this.questions.push({ escale: e.aTirer.escale, acte: e.aTirer.acte, reponses: 4, niveau: 'facile', tiree: 'quatre', six: true, datee: true, categorie: 'Histoire' })
    }
  }
  geste(g: GesteDExpedition): EtatDeLExpedition {
    this.gestes.push(g)
    this.tirer()
    return this.etat()
  }
  /** Tout juste, jusqu'au bout de la rencontre : l'offre qui suit. */
  gagner(): EtatDeLExpedition {
    let e = this.etat()
    for (let n = 0; n < 30 && (e.rencontre || e.enAttente !== null); n++) {
      if (e.rencontre?.tour.phase === 'preparation') e = this.geste({ quoi: 'voir', mise: 0, position: e.enAttente! })
      this.reponses.set(e.enAttente!, true)
      this.tirer()
      e = this.etat()
    }
    return e
  }
}

test('le pli : le paquet de son style, une de ses cartes à chaque récompense — le coffre compris ; un départ sans style, ou d’avant le codex, n’en a pas', () => {
  for (const style of stylesDuNiveau(1)) {
    for (let n = 0; n < 15; n++) {
      const j = new Journal(depart(`pli:${style}:${n}`, style))
      assert.deepEqual(j.etat().paquet, paquetDesRencontres(['lg:licorne'], style))
      j.geste({ quoi: 'avancer', vers: 'e00' })
      let e = j.gagner()
      assert.equal(famille(e.offre!.jokers[0]), style, `${style} ${n}, après la rencontre : ${e.offre!.jokers}`)
      j.geste({ quoi: 'prendre', jokers: [] })
      e = j.geste({ quoi: 'avancer', vers: 'e10' })
      assert.equal(famille(e.offre!.jokers[0]), style, `${style} ${n}, au coffre : ${e.offre!.jokers}`)
    }
  }
  // Sans style, le paquet de toujours ; avant le codex, un style posé ne compte pas ; un style inconnu non plus.
  assert.deepEqual(new Journal(depart('pli:sans')).etat().paquet, paquetDesRencontres(['lg:licorne']))
  assert.equal(styleDuDepart(depart('pli:v6', 'devin', 6)), undefined)
  assert.equal(styleDuDepart({ ...depart('pli:faux'), style: 'neutre' as unknown as StyleDeJeu }), undefined)
  assert.equal(styleDuDepart(depart('pli:devin', 'devin')), 'devin')
})

// ── Les routes ──────────────────────────────────────────────────────────────

function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `styl${String(i).padStart(4, '0')}`,
    texte: `Question d'essai des styles numéro ${i} : laquelle de ces réponses est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE })
})

after(() => banc.close())

const lire = (cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fn: (db: Database.Database) => T, ecriture = false): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const departDe = (id: string): DepartDExpedition => base(db => JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(id) as { expedition: string }).expedition))

/** Partir avec ce qu'on demande ; l'abandonner aussitôt, pour repartir ensuite. */
async function partirPuisAbandonner(c: string, demande: Record<string, unknown>): Promise<{ v: VueDeLExpedition; depart: DepartDExpedition }> {
  const r = await poster(c, '/api/expedition', demande)
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  const lu = departDe(v.id)
  assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  return { v, depart: lu }
}

test('le départ prend son style parmi ceux que son codex ouvre : ses deux cartes dans le paquet ; la fétiche à l’Érudit seul ; un style fermé part au premier des siens, sans refus', async () => {
  const c = await inscrireProfil(banc.url, 'styles', 'Style')
  const page: PageDeLExpedition = (await lire(c, '/api/expedition')).corps
  assert.deepEqual(page.prochaine.codex?.styles, ['rempart', 'erudit', 'devin'], 'au niveau 1, trois styles')
  const invite = page.prochaine.invite
  // Le Devin : ses deux cartes, et pas de catégorie fétiche — elle est à l'Érudit.
  let { v, depart: d } = await partirPuisAbandonner(c, { rencontres: true, style: 'devin', fetiche: 'Histoire' })
  assert.deepEqual([v.style, d.style], ['devin', 'devin'])
  assert.deepEqual(v.cartes?.paquet, paquetDesRencontres([invite], 'devin'))
  assert.deepEqual([v.fetiche, d.fetiche], [undefined, undefined], 'le Devin ne porte pas de catégorie fétiche')
  // L'Érudit : la sienne part avec lui.
  ;({ v, depart: d } = await partirPuisAbandonner(c, { rencontres: true, style: 'erudit', fetiche: 'Histoire' }))
  assert.deepEqual([v.style, v.fetiche], ['erudit', 'Histoire'])
  assert.ok(v.cartes?.paquet.includes('plume') && v.cartes.paquet.includes('savoir-faire'))
  // Le Métamorphe s'ouvre au niveau 4 : un téléphone partagé l'a retenu pour un autre profil — le premier des siens, sans refus.
  ;({ depart: d } = await partirPuisAbandonner(c, { rencontres: true, style: 'metamorphe' }))
  assert.equal(d.style, 'rempart')
  // Ce qui n'est pas un style — les neutres, un texte trafiqué — ne pose rien : le paquet de toujours.
  ;({ v, depart: d } = await partirPuisAbandonner(c, { rencontres: true, style: 'neutre' }))
  assert.equal(d.style, undefined)
  assert.deepEqual(v.cartes?.paquet, paquetDesRencontres([invite]))
  // Aux règles d'avant — sans rencontres demandées —, pas de style : des jokers.
  ;({ depart: d } = await partirPuisAbandonner(c, { style: 'devin' }))
  assert.deepEqual([d.v, d.style], [4, undefined])
})

test('au niveau 4, les six styles : le Métamorphe part avec Corser et Simplifier', async () => {
  const c = await inscrireProfil(banc.url, 'styles4', 'Style quatre')
  const { v: premiere } = await partirPuisAbandonner(c, { rencontres: true })
  // Le niveau 4, juste : sa renommée écrite au bilan de l'expédition finie.
  base(db => db.prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?').run(ecrireLeBilan({ escales: NIVEAUX[3], adversaires: 0, elites: 0, gardiens: 0, auBout: false }), premiere.id), true)
  const page: PageDeLExpedition = (await lire(c, '/api/expedition')).corps
  assert.deepEqual(page.prochaine.codex?.styles, STYLES)
  const { v, depart: d } = await partirPuisAbandonner(c, { rencontres: true, style: 'metamorphe' })
  assert.equal(d.style, 'metamorphe')
  assert.ok(v.cartes?.paquet.includes('corser') && v.cartes.paquet.includes('simplifier'))
})

// ── La page ─────────────────────────────────────────────────────────────────

type Composant = (props: Record<string, unknown>) => React.ReactNode
const rien = () => {}

async function rendre(composant: Composant, props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(composant, props))
}

/** Ce qu'on lit à l'écran : le texte seul, ses espaces fines rendues ordinaires. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/[\s  ]+/g, ' ')

/** Le départ tel que la page le sert, au niveau dit — et, retenu sur le téléphone, ce style. */
async function leDepart(niveau: number, retenu?: string): Promise<string> {
  const { Depart } = (await import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)) as { Depart: Composant }
  Object.assign(globalThis, { localStorage: { getItem: (cle: string) => (cle === 'quizz.expedition.style' ? (retenu ?? null) : null), setItem: rien } })
  const prochaine: PageDeLExpedition['prochaine'] = {
    numero: 7,
    gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
    aLui: [],
    invite: 'lg:lion',
    equipables: [],
    rencontres: true,
    codex: { renommee: NIVEAUX[niveau - 1], ...codexDuNiveau(niveau, []), ascension: 0 },
  }
  return rendre(Depart, { page: { expedition: null, prochaine, passeport: [] }, busy: false, erreur: '', onPartir: rien, onReprendre: rien, onAbandonner: rien })
}

/** Les pastilles des styles : leur nom et si elles sont choisies. */
const pastilles = (html: string) =>
  [...(/<div class="exp-styles"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '').matchAll(/<button[^>]*aria-checked="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map(m => [texte(m[2]).trim(), m[1]])

test('le départ propose ses styles en pastilles — rien de retenu, le premier — et dit celui qui partira : sa devise, sa façon de gagner, ses deux cartes, le prochain à s’ouvrir', async () => {
  const html = await leDepart(1)
  assert.match(html, /<h2 class="label" id="exp-style-titre">Ton style<\/h2>/)
  assert.deepEqual(pastilles(html), [
    ['Rempart', 'true'],
    ['Érudit', 'false'],
    ['Devin', 'false'],
  ])
  const lu = texte(html)
  assert.match(lu, /Le Rempart · « Je tiens bon » Il gagne en tenant, à coups de boucliers et de courage\./)
  assert.match(lu, /Tu pars avec Parade et Pansement, à la place de deux Prudences ; chaque récompense propose une carte de ton style\./)
  assert.match(lu, /Le Flambeur s’ouvre au niveau 2\./)
  assert.doesNotMatch(lu, /Ta catégorie fétiche/, 'elle est à l’Érudit')
  assert.match(html, /exp-voir-le-paquet" aria-haspopup="dialog">Ton paquet · 11 cartes/, 'les deux de son style à la place de deux de base, et la carte de l’invité')
  // Le style se dit avant le paquet qu'il fait.
  assert.ok(html.indexOf('exp-style-titre') < html.indexOf('exp-voir-le-paquet'))
  // L'Érudit retenu : il est choisi, et sa catégorie fétiche se choisit avec lui.
  const erudit = await leDepart(1, 'erudit')
  assert.deepEqual(pastilles(erudit)[1], ['Érudit', 'true'])
  assert.match(texte(erudit), /Tu pars avec Plume et Savoir-faire, à la place de deux Concentrations[\s\S]*Ta catégorie fétiche : aucune Choisir/)
  // Un style que son codex n'ouvre pas encore — retenu pour un autre profil — : le premier des siens.
  assert.deepEqual(pastilles(await leDepart(1, 'metamorphe'))[0], ['Rempart', 'true'])
  // Au niveau 4, les six, et plus rien à attendre.
  const quatre = await leDepart(4)
  assert.equal(pastilles(quatre).length, 6)
  assert.doesNotMatch(texte(quatre), /s’ouvre au niveau/)
})

test('les règles disent les styles : le choix du départ, la récompense de son style, chacun et sa façon de gagner — fermé, son niveau', async () => {
  const { FeuilleDesRegles } = (await import(new URL('../../client/src/views/RencontresDExpedition.tsx', import.meta.url).href)) as { FeuilleDesRegles: Composant }
  const lu = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: ['fetiche'], styles: stylesDuNiveau(1) }, onFermer: rien }))
  assert.match(lu, /Ton style Au départ, choisis ton style : une famille de cartes\. Deux de ses cartes partent dans ton paquet, à la place de deux cartes de base\./)
  assert.match(lu, /Chaque récompense propose une carte de ton style, une que tu n’as pas encore s’il en reste ; les deux autres viennent de partout\./)
  assert.match(lu, /Ton style ne fait pas tout : un paquet qui ne fait qu’attaquer tombe vite\. Prends aussi de quoi te protéger\./)
  assert.match(lu, /Le Devin — « Je lis les signes » : il efface les mauvaises réponses avant de choisir\. Le Flambeur/, 'ouvert : sans niveau')
  assert.match(lu, /Le Flambeur — « Je parie sur moi » : il gagne des écus et les parie ; ses gains frappent aussi\. Il s’ouvre au niveau 2 d’explorateur\./)
  assert.match(lu, /Le Métamorphe — « Je change la question » : six choix pour frapper plus, un vrai ou faux pour risquer moins\. Il s’ouvre au niveau 4 d’explorateur\./)
  assert.match(lu, /Une des trois est de ton style/)
  assert.doesNotMatch(lu, /sceaux|Charge|Garde|inspiration/, 'les mots de l’écran')
  // Avant le codex — aux règles d'avant —, pas de style.
  assert.doesNotMatch(texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], onFermer: rien })), /Ton style/)
})

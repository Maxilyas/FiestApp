// Le prototype des rencontres par ses routes, sur un vrai serveur : le départ
// qui les choisit — hors de la production seulement —, la question tirée au
// même lot que le pas mais gardée au serveur tant qu'il prépare (invariant 1),
// la mise, le verdict qui brise ou qui frappe, la victoire et sa carte à
// prendre ; un dévoilement qui ne court qu'une fois la question vue
// (invariant 6), et les deux cartes qui changent la forme de la question —
// Corser, Simplifier —, reposée de sa question de la base ; une fiole (le
// codex) achetée à l'échoppe et bue la question sous les yeux. Les règles
// seules et le pli : `expedition-rencontres.test.ts`, `codex.test.ts`.
//
// La carte et la main se tirent au hasard de la graine : chaque essai force
// les escales dans le départ gardé en base, et une graine où le pli tire ce
// qu'il lui faut — le pli rejoue ce que le serveur jouera —, puis redémarre
// le serveur, qui le relit.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { rencontresOuvertes } from '../src/expedition'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import {
  PRIX_DE_L_ECHOPPE,
  fioleDeLOffre,
  pliDeLExpedition,
  type DepartDExpedition,
  type FormeDEscale,
  type GesteDExpedition,
  type QuestionPosee,
  type VueDeLExpedition,
} from '../../shared/expedition'
import {
  CARTES_PAR_OFFRE,
  CARTES_DES_ACTES,
  CLAIRVOYANCE_SUR_LA_QUESTION,
  COURAGE_MAX,
  ECUS_AU_DEPART,
  ENERGIE_DES_ACTES,
  FRAPPE_DES_RENCONTRES,
  FRAPPE_EN_PLUS_PAR_QUESTION,
  MULTIPLICATEUR_DU_SIX_CHOIX,
  MULTIPLICATEUR_DU_VRAI_OU_FAUX,
  PAQUET_DES_RENCONTRES,
  RENCONTRES_EN_PRODUCTION,
  SAVOIR_DES_MARCHES,
  SCEAUX_DES_RENCONTRES,
  VERSION_DU_CODEX,
  VERSION_DU_JEU_COMPLET,
  ameliorer,
  paquetDesRencontres,
} from '../../shared/rencontres'
import { NIVEAUX, NIVEAU_MAX, codexDuNiveau } from '../../shared/codex'

/** Une question d'essai — 2 facile, 3 moyenne, 4 difficile —, ses mauvaises réponses et trois leurres de plus : Corser s'y joue. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `renc${String(i).padStart(4, '0')}`,
    texte: `Question d'essai des rencontres numéro ${i} : laquelle de ces réponses est la bonne ?`,
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

/** L'heure du serveur, à la main : un dévoilement se lit à elle. */
const horloge = { t: Date.UTC(2026, 9, 18, 8, 0) }

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, horlogeDuJour: () => horloge.t })
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

interface QuestionGardee {
  id: string
  texte: string
  reponses: string[]
  bonne: number
  forme?: string
  tiree?: string
  proposee?: string
  devoileLe?: number
}

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
const questionsDe = (id: string): QuestionGardee[] => base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

const departDe = (id: string): DepartDExpedition => base(db => JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(id) as { expedition: string }).expedition))

const reponseEnBase = (serie: string, position: number) =>
  base(db => db.prepare('SELECT forme, joker, juste FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(serie, position)) as { forme: string | null; joker: string | null; juste: number }

/**
 * Partir aux rencontres, puis récrire le départ gardé — `forcer` le change —,
 * et redémarrer le serveur pour qu'il le relise : l'expédition en route ne se
 * garde en mémoire que tant que le processus vit.
 */
async function partirEt(cookie: string, corps: object, forcer: (depart: DepartDExpedition) => void): Promise<VueDeLExpedition> {
  const r = await poster(cookie, '/api/expedition', corps)
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(db => {
    const depart = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    forcer(depart)
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(depart), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

/** La première graine de cette famille où le pli tire ce qu'il faut. */
function graineOu(depart: DepartDExpedition, prefixe: string, convient: (d: DepartDExpedition) => boolean): void {
  for (let k = 0; k < 5000; k++) {
    const d = { ...depart, graine: `${prefixe}:${k}` }
    if (convient(d)) {
      depart.graine = d.graine
      return
    }
  }
  throw new Error(`aucune graine ne convient (${prefixe})`)
}

/** Tout le premier étage du premier acte en escales à question d'Histoire, à cette forme. */
function premierEtage(depart: DepartDExpedition, forme: FormeDEscale): string {
  for (const e of depart.cartes[0].escales) {
    if (e.etage !== 0) continue
    e.sorte = 'question'
    e.theme = { categories: ['Histoire'] }
    e.forme = forme
    e.chance = 0.7
  }
  return depart.cartes[0].depart[0]
}

const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

async function avancer(cookie: string, v: VueDeLExpedition, vers: string): Promise<VueDeLExpedition> {
  const r = await geste(cookie, v, { quoi: 'avancer', vers })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

/** Une carte de la main, sur la question qui attend — en préparation, son rang seul la dit. */
async function jouer(cookie: string, v: VueDeLExpedition, cle: string): Promise<VueDeLExpedition> {
  const r = await geste(cookie, v, { quoi: 'jouer', joker: cle, position: v.rencontre!.position })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

async function voir(cookie: string, v: VueDeLExpedition, mise: number): Promise<VueDeLExpedition> {
  const r = await geste(cookie, v, { quoi: 'voir', mise, position: v.rencontre!.position })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

async function repondre(cookie: string, v: VueDeLExpedition, juste: boolean) {
  const q = questionsDe(v.id)[v.question!.index]
  const r = await poster(cookie, `/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

const PREPARE = 'Prépare-toi, puis vois la question : elle n’est pas encore sous tes yeux'

test('les rencontres ne s’ouvrent pas en production tant que leur drapeau ne le dit pas', () => {
  assert.equal(RENCONTRES_EN_PRODUCTION, false, 'un prototype : la préproduction d’abord')
  assert.equal(rencontresOuvertes({ online: true, env: 'production' }), false)
  assert.equal(rencontresOuvertes({ online: true, env: 'preprod' }), true)
  assert.equal(rencontresOuvertes({ online: false, env: 'production' }), true, '`npm run dev`, les tests')
})

test('la page propose les rencontres ; le départ les prend — son courage, ses écus, le paquet des rencontres et la carte de l’invité, son codex ; au niveau 1, ni catégorie fétiche ni pari', async () => {
  const c = await inscrireProfil(banc.url, 'depart5', 'Départ')
  const page = (await lire(c, '/api/expedition')).corps
  assert.equal(page.prochaine.rencontres, true, 'hors de la production, le départ les propose')
  const r = await poster(c, '/api/expedition', { rencontres: true, fetiche: 'Histoire' })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  assert.equal(v.courage, COURAGE_MAX)
  assert.equal(v.ecus, ECUS_AU_DEPART)
  // Le codex (v7) : plus d'équipe à choisir, l'invité du jour prête sa carte ; sa catégorie fétiche attend le niveau 5.
  assert.deepEqual(v.equipee, [page.prochaine.invite])
  assert.deepEqual(v.cartes?.paquet, paquetDesRencontres([page.prochaine.invite]))
  assert.equal(v.fetiche, undefined, 'au niveau 1, sa catégorie fétiche ne part pas')
  assert.equal(v.jokers, undefined, 'des cartes à la place des jokers')
  assert.equal(v.rencontre, undefined, 'aucune rencontre avant le premier pas')
  const depart = departDe(v.id)
  // La version 8 (le jeu complet, le 19 octobre 2026) : la version 6 — la main qui grandit avec les actes, les rares qui attendent l'acte 2,
  // plus d'adversaires —, le codex de son niveau, figé au départ (la 7), et l'énergie qui suit les actes.
  assert.equal(depart.v, VERSION_DU_JEU_COMPLET)
  assert.deepEqual(v.cartes?.parQuestion, [3, 4, 5], 'les règles disent ce que tire chaque acte : la page n’en recopie rien')
  assert.deepEqual(v.cartes?.energie, [...ENERGIE_DES_ACTES], 'et l’énergie de chaque acte : deux à l’acte 1')
  // Le départ fige ce que le codex ouvre ; de ses dos, il en prend un — au niveau 1, l'ordinaire. Sans victoire, aucun cran de
  // l'Ascension ouvert : la fin dira celui qu'une première victoire ouvre.
  const { dos: _dos, ...ouvert } = codexDuNiveau(1, [])
  assert.deepEqual(depart.codex, { ...ouvert, renommee: 0, ascensionOuverte: 0 })
  assert.equal(depart.dos, 'ordinaire')
  assert.equal(depart.ascension, undefined)
  assert.deepEqual(v.cartes?.codex, { niveau: 1, regles: [], renommee: 0, exploits: [], ascensionOuverte: 0 })
  assert.equal(depart.fetiche, undefined)
})

test('une catégorie fétiche hors des douze ne part pas ; sans rencontres demandées, le départ reste aux jokers', async () => {
  const c = await inscrireProfil(banc.url, 'fetiche', 'Fétiche')
  const refus = await poster(c, '/api/expedition', { rencontres: true, fetiche: 'Pétanque' })
  assert.equal(refus.status, 400)
  assert.equal(refus.corps.error, 'Choisis ta catégorie fétiche parmi les douze')
  const v = (await poster(c, '/api/expedition', { fetiche: 'Histoire' })).corps as VueDeLExpedition
  const depart = departDe(v.id)
  assert.equal(depart.v, 4, 'les règles d’avant : une expédition en route finit sous les siennes')
  assert.equal(depart.fetiche, undefined)
  assert.ok(v.jokers, 'ses jokers')
  assert.deepEqual([v.courage, v.cartes, v.fetiche], [undefined, undefined, undefined])
})

test('une escale à question est une rencontre : l’annonce et la main d’abord, la question une fois vue ; juste, elle brise et la mise paie ; fausse, il frappe, moins la Garde ; tombé, une carte à prendre', async () => {
  const c = await inscrireProfil(banc.url, 'rencontre', 'Rencontre')
  let premiere = ''
  let v = await partirEt(c, { rencontres: true, fetiche: 'Histoire' }, depart => {
    // Un explorateur au codex entier : le pari est ouvert (le codex, v7).
    depart.codex = codexDuNiveau(NIVEAU_MAX, [])
    premiere = premierEtage(depart, 'quatre')
    // Concentration et Coup d'œil à la première main, Prudence à la deuxième.
    const q0: QuestionPosee = { escale: premiere, acte: 0, reponses: 4, tiree: 'quatre', six: true, niveau: 'facile', categorie: 'Histoire' }
    graineOu(depart, 'prepare', d => {
      const un = pliDeLExpedition(d, [{ quoi: 'avancer', vers: premiere }], [], new Map()).rencontre?.main ?? []
      if (!un.includes('concentration') || !un.includes('coup-d-oeil')) return false
      const gestes: GesteDExpedition[] = [
        { quoi: 'avancer', vers: premiere },
        { quoi: 'jouer', joker: 'concentration', position: 0 },
        { quoi: 'voir', mise: 10, position: 0 },
      ]
      return !!pliDeLExpedition(d, gestes, [q0], new Map([[0, true]])).rencontre?.main.includes('prudence')
    })
  })
  v = await avancer(c, v, premiere)
  const r = v.rencontre!
  assert.deepEqual([r.sorte, r.adversaire, r.categorie], ['question', 'Le Scribe', 'Histoire'], 'l’adversaire de sa catégorie')
  const sceaux = SCEAUX_DES_RENCONTRES.question[0]
  assert.deepEqual([r.sceaux, r.max, r.frappe], [sceaux, sceaux, FRAPPE_DES_RENCONTRES.question[0]])
  // L'énergie de l'acte 1 (le jeu complet) : deux, pour trois cartes — il choisit.
  assert.deepEqual([r.phase, r.position, r.inspiration], ['preparation', 0, ENERGIE_DES_ACTES[0]])
  // La version 6 : trois cartes à l'acte 1 (« ça fait beaucoup de bonus en main en même temps »).
  assert.equal(r.main.length, CARTES_DES_ACTES[0])
  assert.equal(r.pioche, paquetDesRencontres(departDe(v.id).equipee ?? []).length - CARTES_DES_ACTES[0], 'son paquet, la carte de l’invité du jour comprise, moins sa main')
  assert.equal(paquetDesRencontres(departDe(v.id).equipee ?? []).length, PAQUET_DES_RENCONTRES.length + 1)
  assert.equal(v.question, undefined, 'en préparation, la question ne part pas (invariant 1)')
  assert.equal(questionsDe(v.id).length, 1, 'tirée au même lot que le pas, gardée au serveur')
  const annonce = r.annonce!
  assert.deepEqual([annonce.categorie, annonce.forme], ['Histoire', 'quatre'])
  assert.equal(annonce.savoir, SAVOIR_DES_MARCHES[annonce.niveau])
  assert.equal(r.apercu!.juste.brises, annonce.savoir)
  assert.equal(r.apercu!.faux.perdu, r.frappe)

  // Ni réponse, ni carte de réflexe avant de la voir ; et une mise permise, qu'il peut payer.
  const tot = await poster(c, `/api/expedition/${v.id}/reponse`, { position: 0, choix: 0 })
  assert.deepEqual([tot.status, tot.corps.error], [400, PREPARE])
  assert.equal(r.refus['coup-d-oeil'], 'Elle se joue pendant la question : vois-la d’abord')
  assert.equal((await geste(c, v, { quoi: 'jouer', joker: 'coup-d-oeil', position: 0 })).status, 400)
  for (const [mise, refus] of [
    [7, 'Parie 0, 10, 20 ou 40 écus'],
    [40, 'Il te manque 15 écus pour parier autant'],
  ] as const) {
    const m = await geste(c, v, { quoi: 'voir', mise, position: 0 })
    assert.deepEqual([m.status, m.corps.error], [400, refus])
  }

  // Concentration : +4 de Charge, l'aperçu le dit ; puis il mise dix écus et voit la question.
  v = await jouer(c, v, 'concentration')
  assert.deepEqual([v.rencontre!.charge, v.rencontre!.inspiration], [4, ENERGIE_DES_ACTES[0] - 1])
  assert.equal(v.rencontre!.apercu!.juste.brises, annonce.savoir + 4)
  assert.equal(v.question, undefined)
  v = await voir(c, v, 10)
  assert.equal(v.rencontre!.phase, 'question')
  assert.ok(v.question, 'vue, elle part')
  assert.equal((v.question as any).bonne, undefined, 'sans sa bonne réponse (invariant 1)')
  assert.equal(v.rencontre!.mise, 10)
  // Coup d'œil, la question sous les yeux : une réponse effacée, et la réponse ne mesure plus rien.
  v = await jouer(c, v, 'coup-d-oeil')
  assert.equal(v.question!.effacees?.length, 1)
  const juste = await repondre(c, v, true)
  assert.deepEqual(juste.coup, { juste: true, brises: annonce.savoir + 4, frappe: 0, absorbee: 0, perdu: 0, mise: 5 }, 'juste, la mise rapporte la moitié de ce qu’elle engage')
  assert.deepEqual(reponseEnBase(v.id, 0), { forme: null, joker: 'coup-d-oeil', juste: 1 }, 'aidée par un indice : elle ne mesure rien')
  v = juste.expedition
  assert.equal(v.ecus, ECUS_AU_DEPART + 5)
  assert.deepEqual([v.rencontre!.sceaux, v.rencontre!.phase, v.rencontre!.position], [sceaux - annonce.savoir - 4, 'preparation', 1])
  assert.equal(v.question, undefined, 'la suivante, tirée, attend qu’il la voie')

  // Prudence : Garde 5 ; fausse, sa frappe a grandi d'une question, la Garde en prend cinq, la mise est perdue.
  v = await jouer(c, v, 'prudence')
  v = await voir(c, v, 10)
  const frappe = FRAPPE_DES_RENCONTRES.question[0] + FRAPPE_EN_PLUS_PAR_QUESTION
  const faux = await repondre(c, v, false)
  assert.deepEqual(faux.coup, { juste: false, brises: 0, frappe, absorbee: 5, perdu: frappe - 5, mise: -10 })
  v = faux.expedition
  assert.equal(v.courage, COURAGE_MAX - (frappe - 5))
  assert.equal(v.ecus, ECUS_AU_DEPART + 5 - 10, 'fausse, la mise est perdue entière')
  assert.equal(v.vies, 3, 'les vies de la série ne sont qu’un reflet du courage')

  // Il tombe à la bonne réponse qui brise son dernier sceau : les écus de l'escale, puis trois cartes, une à prendre.
  let fin: any = null
  for (let k = 0; k < 4 && !fin; k++) {
    v = await voir(c, v, 0)
    const rep = await repondre(c, v, true)
    if (rep.coup.victoire) fin = rep
    else v = rep.expedition
  }
  assert.ok(fin, 'il tombe')
  assert.ok(fin.coup.victoire.ecus > 0, 'les écus de l’escale')
  v = fin.expedition
  assert.equal(v.rencontre, undefined)
  assert.deepEqual([v.offre?.jokers.length, v.offre?.aPrendre], [CARTES_PAR_OFFRE, 1])
  const prise = v.offre!.jokers[0]
  const pris = await geste(c, v, { quoi: 'prendre', jokers: [prise] })
  assert.equal(pris.status, 200, pris.corps.error)
  assert.ok(pris.corps.expedition.cartes.paquet.includes(prise), 'elle rejoint son paquet')
})

test('un dévoilement en rencontre ne court qu’une fois la question vue : ses mots ne partent pas en préparation', async () => {
  const c = await inscrireProfil(banc.url, 'devoile5', 'Dévoile')
  let premiere = ''
  let v = await partirEt(c, { rencontres: true }, depart => {
    premiere = premierEtage(depart, 'devoilement')
  })
  v = await avancer(c, v, premiere)
  assert.equal(v.rencontre!.annonce!.forme, 'devoilement')
  const apercu = v.rencontre!.apercu!.juste
  assert.ok(apercu.auPremierMot! > apercu.brises, 'trouvée au premier mot, elle brise plus')
  const tot = await fetch(`${banc.url}/api/expedition/${v.id}/devoilement?position=0`, { headers: { Cookie: c } })
  assert.deepEqual([tot.status, ((await tot.json()) as { error: string }).error], [400, PREPARE], 'ses mots diraient la question avant l’heure')
  horloge.t += 20_000
  v = await voir(c, v, 0)
  assert.equal(questionsDe(v.id)[0].devoileLe, horloge.t, 'son texte court depuis qu’il la voit, à l’heure du serveur')
  assert.deepEqual([v.question!.forme, v.question!.texte], ['devoilement', ''], 'son intitulé ne part pas entier')
})

/**
 * Une carte de famille en main à la première rencontre : un codex entier qui
 * l'a ouverte, le coffre du premier pas la propose, il la prend, et la main
 * de l'escale d'après la tire.
 */
function forcerEnMain(depart: DepartDExpedition, cle: string, legendaire: string): { coffre: string; question: string } {
  depart.equipee = [legendaire]
  depart.codex = codexDuNiveau(NIVEAU_MAX, [])
  const carte = depart.cartes[0]
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const coffre = parId.get(carte.depart[0])!
  coffre.sorte = 'coffre'
  delete coffre.theme
  delete coffre.forme
  delete coffre.chance
  const question = parId.get(coffre.suite[0])!
  question.sorte = 'question'
  question.theme = { categories: ['Histoire'] }
  question.forme = 'quatre'
  question.chance = 0.7
  const gestes: GesteDExpedition[] = [
    { quoi: 'avancer', vers: coffre.id },
    { quoi: 'prendre', jokers: [cle] },
    { quoi: 'avancer', vers: question.id },
  ]
  // Le coffre la propose — la règle du pli, celle de sa version — et la main d'après la tire.
  graineOu(depart, cle, d => !!pliDeLExpedition(d, gestes.slice(0, 1), [], new Map()).offre?.jokers.includes(cle) && !!pliDeLExpedition(d, gestes, [], new Map()).rencontre?.main.includes(cle))
  return { coffre: coffre.id, question: question.id }
}

/** Le coffre, la carte prise, la rencontre d'après : la carte en main, jouable. */
async function jusquALaCarte(c: string, cle: string): Promise<VueDeLExpedition> {
  let chemin = { coffre: '', question: '' }
  let v = await partirEt(c, { rencontres: true }, depart => {
    chemin = forcerEnMain(depart, cle, 'lg:janus')
  })
  v = await avancer(c, v, chemin.coffre)
  assert.ok(v.offre?.jokers.includes(cle), 'le coffre la propose : son codex l’a ouverte')
  const pris = await geste(c, v, { quoi: 'prendre', jokers: [cle] })
  assert.equal(pris.status, 200, pris.corps.error)
  v = await avancer(c, pris.corps.expedition, chemin.question)
  assert.ok(v.rencontre?.main.includes(cle))
  assert.equal(v.rencontre!.refus[cle], null)
  return v
}

test('Corser repose la question à six choix, de sa question de la base : sa bonne réponse gardée, une fois et demie brisée', async () => {
  const c = await inscrireProfil(banc.url, 'corser', 'Corser')
  let v = await jusquALaCarte(c, 'corser')
  const savoir = v.rencontre!.annonce!.savoir
  const avant = questionsDe(v.id)[0]
  v = await jouer(c, v, 'corser')
  const corsee = questionsDe(v.id)[0]
  assert.equal(corsee.id, avant.id, 'la même question')
  assert.deepEqual([corsee.forme, corsee.reponses.length, corsee.tiree], ['six', 6, 'quatre'], 'sa forme de tirage reste : la règle des cartes la relit')
  const deLaBase = BASE.parId.get(corsee.id)!
  assert.equal(corsee.reponses[corsee.bonne], deLaBase.reponses[deLaBase.bonne])
  assert.ok(deLaBase.reponses.every(x => corsee.reponses.includes(x)), 'ses quatre réponses, et deux leurres')
  assert.equal(v.rencontre!.annonce!.forme, 'six')
  assert.equal(v.rencontre!.apercu!.juste.brises, Math.round(savoir * MULTIPLICATEUR_DU_SIX_CHOIX))
  assert.equal(v.question, undefined, 'toujours cachée : il prépare encore')
  v = await voir(c, v, 0)
  assert.deepEqual([v.question!.forme, v.question!.reponses.length], ['six', 6])
  const r = await repondre(c, v, true)
  assert.equal(r.coup.brises, Math.round(savoir * MULTIPLICATEUR_DU_SIX_CHOIX))
  assert.deepEqual(reponseEnBase(v.id, 0), { forme: 'six', joker: null, juste: 1 }, 'à six choix, elle n’a plus sa difficulté : elle ne mesure rien')
})

test('Simplifier la repose en vrai ou faux : Garde 3, moitié moins brisée ; fausse, la Garde prend sa part de la frappe', async () => {
  const c = await inscrireProfil(banc.url, 'simplifier', 'Simplifier')
  let v = await jusquALaCarte(c, 'simplifier')
  const savoir = v.rencontre!.annonce!.savoir
  v = await jouer(c, v, 'simplifier')
  const simple = questionsDe(v.id)[0]
  assert.deepEqual([simple.reponses, simple.forme, simple.tiree], [['Vrai', 'Faux'], 'vrai-faux', 'quatre'])
  const deLaBase = BASE.parId.get(simple.id)!
  assert.ok(deLaBase.reponses.includes(simple.proposee!), 'une des réponses de la question')
  assert.equal(simple.bonne === 0, simple.proposee === deLaBase.reponses[deLaBase.bonne], '« Vrai » quand elle propose la bonne')
  assert.equal(v.rencontre!.garde, 3)
  assert.equal(v.rencontre!.annonce!.forme, 'vrai-faux')
  assert.equal(v.rencontre!.apercu!.juste.brises, Math.round(savoir * MULTIPLICATEUR_DU_VRAI_OU_FAUX))
  v = await voir(c, v, 0)
  assert.deepEqual(v.question!.reponses, ['Vrai', 'Faux'])
  assert.equal(v.question!.proposee, simple.proposee)
  const r = await repondre(c, v, false)
  const frappe = FRAPPE_DES_RENCONTRES.question[0]
  assert.deepEqual(r.coup, { juste: false, brises: 0, frappe, absorbee: 3, perdu: frappe - 3, mise: 0 })
  assert.equal(r.expedition.courage, COURAGE_MAX - (frappe - 3))
})

test('une fiole (le codex) : l’échoppe en vend une, une fois ; la clairvoyance se boit la question sous les yeux — une mauvaise réponse effacée, jamais la bonne, et la réponse est aidée', async () => {
  const c = await inscrireProfil(banc.url, 'fioles', 'Fioles')
  let v = await partirEt(c, { rencontres: true }, d => {
    // Au niveau 3, les fioles s'ouvrent. En bas, des échoppes — la première fiole qu'elles tirent, la clairvoyance — ; au-dessus, des questions d'Histoire.
    d.codex = { ...codexDuNiveau(3, []), renommee: NIVEAUX[2] }
    for (const e of d.cartes[0].escales) {
      if (e.etage === 0) {
        e.sorte = 'echoppe'
        delete e.theme
        delete e.forme
        delete e.chance
      } else if (e.etage === 1) {
        e.sorte = 'question'
        e.theme = { categories: ['Histoire'] }
        e.forme = 'quatre'
        e.chance = 0.7
      }
    }
    graineOu(d, 'fiole', x => fioleDeLOffre(x.graine, 0) === 'clairvoyance')
  })
  assert.deepEqual(v.fioles, { tenues: [], refus: {} }, 'à son niveau, la barre a de quoi les porter')
  v = await avancer(c, v, v.permises[0])
  assert.equal(v.echoppe?.fiole, 'clairvoyance')
  let r = await geste(c, v, { quoi: 'acheter', article: 'fiole', prix: 1 })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  assert.deepEqual(v.fioles?.tenues, ['clairvoyance'])
  assert.equal(v.ecus, ECUS_AU_DEPART - PRIX_DE_L_ECHOPPE.fiole, 'au prix du barème, pas à celui que la page écrirait')
  assert.equal(v.fioles?.refus.clairvoyance, 'Elle se boit la question sous les yeux')
  r = await geste(c, v, { quoi: 'acheter', article: 'fiole' })
  assert.deepEqual([r.status, r.corps.error], [400, 'Déjà achetée'])
  // La rencontre d'au-dessus : préparée, la fiole attend — la question n'est pas encore sous ses yeux.
  v = await avancer(c, v, v.permises[0])
  r = await geste(c, v, { quoi: 'boire', fiole: 'clairvoyance', position: v.rencontre!.position })
  assert.deepEqual([r.status, r.corps.error], [400, 'Elle se boit la question sous les yeux'])
  v = await voir(c, v, 0)
  assert.equal(v.fioles?.refus.clairvoyance, null)
  assert.equal(v.question?.effacees, undefined)
  r = await geste(c, v, { quoi: 'boire', fiole: 'clairvoyance', position: v.question!.index })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  assert.deepEqual(v.fioles?.tenues, [])
  const position = v.question!.index
  const effacees = v.question?.effacees ?? []
  assert.equal(effacees.length, 1, 'une mauvaise réponse effacée')
  assert.ok(!effacees.includes(questionsDe(v.id)[position].bonne), 'jamais la bonne : le serveur seul la sait')
  await repondre(c, v, true)
  assert.equal(reponseEnBase(v.id, position).joker, CLAIRVOYANCE_SUR_LA_QUESTION, 'une réponse aidée : la mesure ne la compte pas')
})

// ── Les cartes améliorées (le jeu complet) ──────────────────────────────────

/** Le premier étage du premier acte en campements, le deuxième en échoppes : la forge, puis l'étal. */
function forgeEtEtal(depart: DepartDExpedition): { bas: string; haut: string } {
  for (const e of depart.cartes[0].escales) {
    if (e.etage !== 0 && e.etage !== 1) continue
    e.sorte = e.etage === 0 ? 'campement' : 'echoppe'
    delete e.theme
    delete e.forme
    delete e.chance
  }
  const bas = depart.cartes[0].depart[0]
  return { bas, haut: depart.cartes[0].escales.find(e => e.id === bas)!.suite[0] }
}

test('le jeu complet, par les routes : une carte améliorée au campement, une autre à l’échoppe, au prix du barème ; ce qui ne s’améliore pas, refusé en clair', async () => {
  const c = await inscrireProfil(banc.url, 'forge', 'Forge')
  let chemin = { bas: '', haut: '' }
  let v = await partirEt(c, { rencontres: true }, d => {
    assert.equal(d.v, VERSION_DU_JEU_COMPLET)
    chemin = forgeEtEtal(d)
  })
  v = await avancer(c, v, chemin.bas)
  assert.equal(v.campement, true)
  let r = await geste(c, v, { quoi: 'camper', ameliorer: 'surmenage' })
  assert.deepEqual([r.status, r.corps.error], [400, 'Cette carte n’est pas dans ton paquet'])
  r = await geste(c, v, { quoi: 'camper', ameliorer: 'concentration', retirer: 'prudence' })
  assert.deepEqual([r.status, r.corps.error], [400, 'Ce geste ne se lit pas : recharge la page'], 'un choix à la fois')
  r = await geste(c, v, { quoi: 'camper', ameliorer: 'concentration' })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  const paquet = v.cartes!.paquet
  assert.deepEqual([paquet.filter(x => x === 'concentration').length, paquet.filter(x => x === 'concentration+').length], [3, 1])
  assert.equal(v.courage, COURAGE_MAX, 'pas de repos : il a amélioré')
  v = await avancer(c, v, chemin.haut)
  assert.equal(v.echoppe?.ameliorer, true)
  r = await geste(c, v, { quoi: 'acheter', article: 'ameliorer', joker: 'concentration+', prix: 1 })
  assert.deepEqual([r.status, r.corps.error], [400, 'Elle est déjà améliorée'])
  r = await geste(c, v, { quoi: 'acheter', article: 'ameliorer', joker: 'prudence', prix: 1 })
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  assert.ok(v.cartes!.paquet.includes('prudence+'))
  assert.equal(v.ecus, ECUS_AU_DEPART - PRIX_DE_L_ECHOPPE.ameliorer, 'au prix du barème, pas à celui que la page écrirait')
  r = await geste(c, v, { quoi: 'acheter', article: 'ameliorer', joker: 'coup-d-oeil' })
  assert.deepEqual([r.status, r.corps.error], [400, 'Une carte améliorée par échoppe'])
})

test('une expédition d’avant le jeu complet n’améliore rien : ni le campement, ni l’échoppe', async () => {
  const c = await inscrireProfil(banc.url, 'forgeavant', 'Forge avant')
  let chemin = { bas: '', haut: '' }
  let v = await partirEt(c, { rencontres: true }, d => {
    d.v = VERSION_DU_CODEX
    chemin = forgeEtEtal(d)
  })
  v = await avancer(c, v, chemin.bas)
  let r = await geste(c, v, { quoi: 'camper', ameliorer: 'concentration' })
  assert.deepEqual([r.status, r.corps.error], [400, 'Cette expédition n’améliore pas ses cartes : repose-toi, ou retire une carte'])
  r = await geste(c, v, { quoi: 'camper' })
  assert.equal(r.status, 200, r.corps.error)
  v = await avancer(c, r.corps.expedition, chemin.haut)
  assert.equal(v.echoppe?.ameliorer, undefined)
  r = await geste(c, v, { quoi: 'acheter', article: 'ameliorer', joker: 'prudence' })
  assert.deepEqual([r.status, r.corps.error], [400, 'On n’améliore pas de carte ici'])
})

/**
 * Une carte améliorée en main à la première rencontre : le coffre du premier
 * pas la propose, il la prend, le campement d'au-dessus l'améliore, et la main
 * de l'escale d'après tire son exemplaire « + ».
 */
function forcerAmelioreeEnMain(depart: DepartDExpedition, cle: string, legendaire: string): { coffre: string; camp: string; question: string } {
  depart.equipee = [legendaire]
  depart.codex = codexDuNiveau(NIVEAU_MAX, [])
  const carte = depart.cartes[0]
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const coffre = parId.get(carte.depart[0])!
  const camp = parId.get(coffre.suite[0])!
  const question = parId.get(camp.suite[0])!
  for (const [e, sorte] of [
    [coffre, 'coffre'],
    [camp, 'campement'],
  ] as const) {
    e.sorte = sorte
    delete e.theme
    delete e.forme
    delete e.chance
  }
  question.sorte = 'question'
  question.theme = { categories: ['Histoire'] }
  question.forme = 'quatre'
  question.chance = 0.7
  const gestes: GesteDExpedition[] = [
    { quoi: 'avancer', vers: coffre.id },
    { quoi: 'prendre', jokers: [cle] },
    { quoi: 'avancer', vers: camp.id },
    { quoi: 'camper', ameliorer: cle },
    { quoi: 'avancer', vers: question.id },
  ]
  graineOu(
    depart,
    `${cle}+`,
    d => !!pliDeLExpedition(d, gestes.slice(0, 1), [], new Map()).offre?.jokers.includes(cle) && !!pliDeLExpedition(d, gestes, [], new Map()).rencontre?.main.includes(ameliorer(cle)),
  )
  return { coffre: coffre.id, camp: camp.id, question: question.id }
}

test('Double chance+ : gratuite, deux réponses choisies — et la réponse est aidée, sous la clé de sa carte', async () => {
  const c = await inscrireProfil(banc.url, 'doubleplus', 'Double plus')
  let chemin = { coffre: '', camp: '', question: '' }
  let v = await partirEt(c, { rencontres: true }, d => {
    chemin = forcerAmelioreeEnMain(d, 'double-chance', 'lg:janus')
  })
  v = await avancer(c, v, chemin.coffre)
  let r = await geste(c, v, { quoi: 'prendre', jokers: ['double-chance'] })
  assert.equal(r.status, 200, r.corps.error)
  v = await avancer(c, r.corps.expedition, chemin.camp)
  r = await geste(c, v, { quoi: 'camper', ameliorer: 'double-chance' })
  assert.equal(r.status, 200, r.corps.error)
  v = await avancer(c, r.corps.expedition, chemin.question)
  assert.ok(v.rencontre?.main.includes('double-chance+'))
  v = await voir(c, v, 0)
  assert.equal(v.rencontre!.refus['double-chance+'], null)
  const energie = v.rencontre!.inspiration
  v = await jouer(c, v, 'double-chance+')
  assert.equal(v.rencontre!.inspiration, energie, 'gratuite')
  assert.equal(v.question!.deux, true, 'deux réponses à choisir, comme sa carte')
  const position = v.question!.index
  const q = questionsDe(v.id)[position]
  r = await poster(c, `/api/expedition/${v.id}/reponse`, { position, choix: [(q.bonne + 1) % q.reponses.length, q.bonne] })
  assert.equal(r.status, 200, r.corps.error)
  assert.equal(r.corps.coup.juste, true, 'l’une des deux est la bonne')
  assert.equal(reponseEnBase(v.id, position).joker, 'double-chance', 'une réponse aidée, sous la clé de sa carte')
})

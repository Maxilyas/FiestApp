// Les jokers de l'Expédition, joués par les routes : l'équipée et l'invité du
// jour ; ce qu'un joker montre d'une question, sans jamais la bonne réponse
// (invariant 1) ; et ce qu'une réponse aidée compte — son confetti, son
// expérience, Le Marathonien —, mais ni la précision et les écussons, ni la
// mesure des difficultés, ni le carnet, qui ne la tient pas pour retrouvée
// (`campagne_reponses.joker`, `REPONSE_NUE`). Une erreur aidée, elle, entre au
// carnet. Et aucun autre mode n'accepte un joker (invariant 8).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { jourDe } from '../../shared/jour'
import { GARDIEN, inviteDuJour, type VueDeLExpedition } from '../../shared/expedition'
import { LEGENDAIRES_A_JOKER, joker, jokerDuLegendaire } from '../../shared/jokers'

function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `mesu${String(i).padStart(4, '0')}`,
    texte: `Question d'essai d'une mesure numéro ${i} : laquelle est la bonne ?`,
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

/** Huit questions de chaque marche dans chacune des douze catégories. */
const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
const questionsDe = (banc: Banc, id: string): { id: string; bonne: number; reponses: string[]; escale: string; carnet?: true }[] =>
  base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

const geste = async (banc: Banc, cookie: string, v: VueDeLExpedition, g: object): Promise<VueDeLExpedition> => {
  const r = await poster(banc, cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

async function repondre(banc: Banc, cookie: string, v: VueDeLExpedition, juste: boolean, position = v.question!.index) {
  const q = questionsDe(banc, v.id)[position]
  const r = await poster(banc, cookie, `/api/expedition/${v.id}/reponse`, { position, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** Le pas suivant sur la carte : une offre laissée, une vie au campement, le gardien, sinon une question plutôt qu'un coffre ou une source. */
function pasSuivant(banc: Banc, cookie: string, v: VueDeLExpedition) {
  if (v.offre) return geste(banc, cookie, v, { quoi: 'prendre', jokers: [] })
  if (v.campement) return geste(banc, cookie, v, { quoi: 'camper' })
  const sorte = (id: string) => v.carte!.escales.find(e => e.id === id)?.sorte
  const vers = v.permises.includes(GARDIEN) ? GARDIEN : (v.permises.find(id => sorte(id) === 'question') ?? v.permises[0])
  return geste(banc, cookie, v, { quoi: 'avancer', vers })
}

/**
 * Jusqu'à une question qui attend, ce joker en main. La main se tire au
 * hasard de la graine — le profil change à chaque essai : en chemin, il joue
 * un Coup d'œil ou un Échange, quand il le peut, pour faire tourner le paquet.
 */
async function jusquEnMain(banc: Banc, cookie: string, depart: VueDeLExpedition, cle: string): Promise<VueDeLExpedition> {
  let v = depart
  for (let pas = 0; pas < 60 && v.issue === 'en-route'; pas++) {
    if (!v.question) {
      v = await pasSuivant(banc, cookie, v)
      continue
    }
    if (v.jokers!.main.includes(cle) && v.jokers!.refus[cle] === null) return v
    const pour = ['coup-d-oeil', 'echange'].find(j => j !== cle && v.jokers!.main.includes(j) && v.jokers!.refus[j] === null)
    if (pour && !v.joue) {
      v = await geste(banc, cookie, v, { quoi: 'jouer', joker: pour })
      continue
    }
    v = (await repondre(banc, cookie, v, true)).expedition
  }
  throw new Error(`${cle} ne vient pas en main`)
}

/** Le premier pas vers la source la plus proche qu'il peut encore atteindre ; null : aucune dans l'acte. */
function versUneSource(v: VueDeLExpedition): string | null {
  const parId = new Map(v.carte!.escales.map(e => [e.id, e]))
  const file: string[][] = v.permises.map(id => [id])
  while (file.length > 0) {
    const chemin = file.shift()!
    const e = parId.get(chemin[chemin.length - 1])
    if (!e) continue
    if (e.sorte === 'source') return chemin[0]
    for (const id of e.suite) file.push([...chemin, id])
  }
  return null
}

/** Un jour où l'invité est ce légendaire : il part dans l'équipée sans être à lui. */
function unJourOu(legendaire: string): number {
  for (let k = 0; k < 2000; k++) {
    const t = Date.UTC(2026, 9, 1, 10) + k * 86_400_000
    if (inviteDuJour(jourDe(t)) === legendaire) return t
  }
  throw new Error(`${legendaire} n’est jamais l’invité du jour`)
}

test('l’équipée : les siens ou l’invité du jour, deux au plus ; son joker rejoint le paquet ; l’invité ne garde aucun acte', async () => {
  const t = unJourOu('lg:janus')
  const banc = await demarrer({ horlogeDuJour: () => t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const page = (await lire(banc, lea, '/api/expedition')).corps
    assert.deepEqual([page.prochaine.invite, page.prochaine.equipables], ['lg:janus', []], 'l’invité du jour ; aucun des siens')
    assert.ok(!page.prochaine.gardiens.includes('lg:janus'), 'l’invité du jour ne garde aucun acte')
    const autre = LEGENDAIRES_A_JOKER.find(cle => cle !== 'lg:janus')!
    assert.equal((await poster(banc, lea, '/api/expedition', { equipee: [autre] })).corps.error, 'Ce légendaire n’est pas à toi : seul l’invité du jour part sans être à toi')
    assert.equal((await poster(banc, lea, '/api/expedition', { equipee: ['lg:janus', 'lg:janus', 'lg:phenix'] })).corps.error, 'Ton équipée tient 2 légendaires : laisses-en un')
    assert.equal((await poster(banc, lea, '/api/expedition', { equipee: 'lg:janus' })).corps.error, 'Ton équipée ne se lit pas : recharge la page')
    const v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition', { equipee: ['lg:janus'] })).corps
    assert.deepEqual([v.equipee, v.invite], [['lg:janus'], 'lg:janus'])
    assert.deepEqual([...v.jokers!.paquet].sort(), ['coup-d-oeil', 'coup-d-oeil', 'coup-d-oeil', 'deux-visages', 'echange'], 'le paquet de départ, et Deux visages')
    assert.deepEqual(v.jokers!.main, [], 'rien en main avant la première question')
    const a = await geste(banc, lea, v, { quoi: 'avancer', vers: v.permises[0] })
    assert.equal(a.jokers!.main.length, 1, 'une question, un joker tiré')
    // Rechargée, la page redonne la même main.
    assert.deepEqual((await lire(banc, lea, '/api/expedition')).corps.expedition.jokers.main, a.jokers!.main)
  } finally {
    await banc.close()
  }
})

test('un Coup d’œil efface une mauvaise réponse, jamais la bonne ; aidée, la réponse paie, mais ni la précision ni la mesure ne la comptent', async () => {
  const horloge = { t: Date.UTC(2026, 9, 12, 8) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    v = await jusquEnMain(banc, lea, v, 'coup-d-oeil')
    const avant = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    const position = v.question!.index
    // Sur une autre question que celle qui attend : refusé.
    assert.equal((await poster(banc, lea, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'jouer', joker: 'coup-d-oeil', position: position + 5 } })).corps.error, 'Cette question est passée : l’expédition a continué sans elle')
    v = await geste(banc, lea, v, { quoi: 'jouer', joker: 'coup-d-oeil' })
    const q = questionsDe(banc, v.id)[position]
    assert.equal(v.joue, 'coup-d-oeil')
    assert.equal(v.question!.effacees!.length, 1)
    assert.ok(!v.question!.effacees!.includes(q.bonne), 'jamais la bonne')
    assert.equal((v.question as any).bonne, undefined, 'la bonne réponse ne part pas avant la sienne (invariant 1)')
    assert.ok(v.jokers!.defausse.includes('coup-d-oeil'))
    for (const cle of v.jokers!.main) if (joker(cle)?.sorte === 'jouer') assert.equal(v.jokers!.refus[cle], 'Un seul joker par question')
    const r = await repondre(banc, lea, v, true)
    assert.equal(r.juste, true)
    assert.ok(r.xp > 0, 'aidée, elle paie son expérience')
    const ligne = base(banc, db => db.prepare('SELECT joker, juste FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, position)) as { joker: string; juste: number }
    assert.deepEqual(ligne, { joker: 'coup-d-oeil', juste: 1 })
    const apres = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.deepEqual([apres.fiche.qcm, apres.fiche.justes], [avant.fiche.qcm, avant.fiche.justes], 'ni la précision ni les écussons ne la comptent')
    // La mesure : relue au plus toutes les dix minutes, elle ne la compte pas.
    await poster(banc, lea, `/api/campagne/serie/${v.id}/signalement`, { index: position, texte: 'Pour relire sa mesure.' })
    horloge.t += 11 * 60_000
    const admin = await connexionAnimateur(banc.url)
    const signalee = (await lire(banc, admin, '/api/admin/campagne')).corps.signalements.find((s: any) => s.questionId === q.id)
    assert.ok(signalee, 'la question signalée se relit au QG')
    assert.equal(signalee.mesure?.total ?? 0, 0, 'la mesure ne compte pas une réponse aidée')
  } finally {
    await banc.close()
  }
})

test('au carnet, une bonne réponse aidée ne retrouve rien ; une erreur aidée y entre', async () => {
  const horloge = { t: Date.UTC(2026, 9, 12, 8) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Une série ratée d'emblée : une question au carnet, qui revient le lendemain.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const q0 = questionsDe(banc, serie.id)[0]
    await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: 0, choix: (q0.bonne + 1) % q0.reponses.length })
    await poster(banc, lea, `/api/campagne/serie/${serie.id}/abandon`)
    horloge.t += 86_400_000
    assert.equal((await lire(banc, lea, '/api/campagne/carnet')).corps.aRevoir, 1, 'à son rendez-vous, le lendemain')
    // L'expédition : une source la repose — trouvée sous un Coup d'œil, elle ne compte pas pour retrouvée.
    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    for (let pas = 0; pas < 80 && !(v.question && questionsDe(banc, v.id)[v.question.index]?.carnet); pas++) {
      if (v.question) v = (await repondre(banc, lea, v, true)).expedition
      else if (v.offre || v.campement) v = await pasSuivant(banc, lea, v)
      else {
        // Droit vers la source la plus proche : la carte change à chaque profil, et la première route n'y mène pas toujours.
        const vers = versUneSource(v)
        v = vers ? await geste(banc, lea, v, { quoi: 'avancer', vers }) : await pasSuivant(banc, lea, v)
      }
    }
    const reprise = questionsDe(banc, v.id)[v.question!.index]
    assert.equal(reprise.id, q0.id, 'la source repose la question du carnet')
    assert.ok(v.jokers!.main.includes('coup-d-oeil'), 'deux questions, deux tirages : un Coup d’œil au moins')
    v = await geste(banc, lea, v, { quoi: 'jouer', joker: 'coup-d-oeil' })
    await repondre(banc, lea, v, true)
    assert.equal((await lire(banc, lea, '/api/campagne/carnet')).corps.aRevoir, 1, 'trouvée par un joker, elle ne prouve rien : toujours à revoir')
    // Une erreur aidée : sous un Coup d'œil, ratée — elle entre au carnet comme une autre.
    let w = (await lire(banc, lea, '/api/expedition')).corps.expedition as VueDeLExpedition
    const demain = (await lire(banc, lea, '/api/campagne/carnet')).corps.demain
    for (let pas = 0; pas < 40; pas++) {
      if (w.question && w.jokers!.main.includes('coup-d-oeil') && w.jokers!.refus['coup-d-oeil'] === null && !questionsDe(banc, w.id)[w.question.index].carnet) break
      if (w.question) w = (await repondre(banc, lea, w, true)).expedition
      else w = await pasSuivant(banc, lea, w)
    }
    w = await geste(banc, lea, w, { quoi: 'jouer', joker: 'coup-d-oeil' })
    await repondre(banc, lea, w, false)
    assert.equal((await lire(banc, lea, '/api/campagne/carnet')).corps.demain, demain + 1, 'l’erreur aidée revient demain')
  } finally {
    await banc.close()
  }
})

test('Échange : une autre question de la même escale, tirée et gardée, qui se répond nue', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    v = await jusquEnMain(banc, lea, v, 'echange')
    const position = v.question!.index
    const avant = questionsDe(banc, v.id)
    v = await geste(banc, lea, v, { quoi: 'jouer', joker: 'echange' })
    const apres = questionsDe(banc, v.id)
    assert.equal(v.question!.index, position + 1, 'une autre question, au rang suivant')
    assert.equal(apres[position + 1].escale, avant[position].escale, 'de la même escale')
    assert.notEqual(apres[position + 1].id, avant[position].id)
    await repondre(banc, lea, v, true)
    const lignes = base(banc, db => db.prepare('SELECT position, joker FROM campagne_reponses WHERE serie_id = ? AND position IN (?, ?)').all(v.id, position, position + 1)) as { position: number; joker: string | null }[]
    assert.deepEqual(lignes, [{ position: position + 1, joker: null }], 'celle d’avant ne se répond pas ; l’autre se répond nue')
  } finally {
    await banc.close()
  }
})

test('Passe-muraille traverse une question — au carnet comme ratée, sans vie perdue ; l’Énigme dit le siècle et le domaine', async () => {
  const banc = await demarrer({ horlogeDuJour: () => unJourOu('lg:fantome'), baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition', { equipee: ['lg:fantome'] })).corps
    assert.ok(v.jokers!.paquet.includes(jokerDuLegendaire('lg:fantome')!.cle))
    v = await jusquEnMain(banc, lea, v, 'passe-muraille')
    const position = v.question!.index
    const vies = v.vies
    const demain = (await lire(banc, lea, '/api/campagne/carnet')).corps.demain
    v = await geste(banc, lea, v, { quoi: 'jouer', joker: 'passe-muraille' })
    assert.equal(v.vies, vies, 'sans vie perdue')
    assert.notEqual(v.question?.index, position, 'la question est traversée')
    const ligne = base(banc, db => db.prepare('SELECT joker, juste, choix FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, position))
    assert.deepEqual(ligne, { joker: 'passe-muraille', juste: 0, choix: null })
    assert.equal((await lire(banc, lea, '/api/campagne/carnet')).corps.demain, demain + 1, 'elle part au carnet comme ratée')
  } finally {
    await banc.close()
  }

  const sphinx = await demarrer({ horlogeDuJour: () => unJourOu('lg:sphinx'), baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(sphinx.url, 'lea', 'Léa')
    let v: VueDeLExpedition = (await poster(sphinx, lea, '/api/expedition', { equipee: ['lg:sphinx'] })).corps
    v = await jusquEnMain(sphinx, lea, v, 'enigme')
    v = await geste(sphinx, lea, v, { quoi: 'jouer', joker: 'enigme' })
    assert.match(v.question!.indice!, /^Elle ne se date pas · /, 'les questions d’essai n’ont pas de date')
    assert.ok(v.question!.indice!.includes(v.question!.categorie!), 'et son domaine')
    const position = v.question!.index
    await repondre(sphinx, lea, v, true)
    const ligne = base(sphinx, db => db.prepare('SELECT joker FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, position)) as { joker: string }
    assert.equal(ligne.joker, 'enigme', 'aidée par l’Énigme')
  } finally {
    await sphinx.close()
  }
})

test('aucun autre mode n’accepte un joker : ni le quiz du jour, ni la campagne et ses duels, ni la soirée (invariant 8)', () => {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  for (const fichier of ['src/quizDuJour.ts', 'src/campagne.ts', 'src/sockets.ts', 'src/missions.ts']) {
    assert.doesNotMatch(readFileSync(path.join(racine, fichier), 'utf8'), /joker/i, `${fichier} : un joker ne sort jamais de l’expédition`)
  }
})

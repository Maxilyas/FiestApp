// Les formes de l'Expédition (l'étape 3 du brief du 17 octobre 2026) : six
// choix — ses quatre réponses et deux leurres —, un vrai ou faux tiré d'une
// question à quatre choix, un dévoilement mot à mot ; et Arrêt sur image. La
// bonne réponse ne part jamais avant la sienne (invariant 1), un dévoilement
// ne livre que les mots déjà dits, son compte se lit à l'heure du serveur
// (invariant 6), et une réponse d'une autre forme ne mesure rien.
//
// La carte se tire au hasard de la graine, et son premier étage ne pose que
// quatre choix et vrai ou faux : chaque essai force les formes dans le
// départ gardé en base, puis redémarre le serveur, qui le relit.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import {
  ARRET_SUR_IMAGE_MS,
  MS_PAR_MOT,
  chanceSelonLaForme,
  marcheDe,
  motsDe,
  motsDits,
  offreDeJokers,
  pliDeLExpedition,
  refusDuJoker,
  type DepartDExpedition,
  type FormeDEscale,
  type GesteDExpedition,
  type VueDeLExpedition,
} from '../../shared/expedition'

/** Une question d'essai — 2 facile, 3 moyenne, 4 difficile —, ses mauvaises réponses et trois leurres de plus. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `form${String(i).padStart(4, '0')}`,
    texte: `Question d'essai des formes numéro ${i} : laquelle de ces réponses est la bonne ?`,
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

/** L'heure du serveur, à la main : le dévoilement se lit à elle. */
const horloge = { t: Date.UTC(2026, 9, 17, 8, 0) }

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
  proposee?: string
  devoileLe?: number
  arretLe?: number
}

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
const questionsDe = (id: string): QuestionGardee[] => base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/**
 * Partir, puis récrire le départ gardé — `forcer` le change —, et redémarrer
 * le serveur pour qu'il le relise : l'expédition en route ne se garde en
 * mémoire que tant que le processus vit.
 */
async function partirEt(cookie: string, forcer: (depart: DepartDExpedition) => void): Promise<VueDeLExpedition> {
  const v = (await poster(cookie, '/api/expedition')).corps as VueDeLExpedition
  base(db => {
    const depart = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    forcer(depart)
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(depart), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

/** Toutes les escales du premier étage du premier acte à cette forme. */
const auPremierEtage = (forme: FormeDEscale) => (depart: DepartDExpedition) => {
  for (const e of depart.cartes[0].escales) if (e.etage === 0) e.forme = forme
}

const avancer = async (cookie: string, v: VueDeLExpedition, vers: string): Promise<VueDeLExpedition> => {
  const r = await poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers } })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

async function repondre(cookie: string, v: VueDeLExpedition, juste: boolean) {
  const q = questionsDe(v.id)[v.question!.index]
  const r = await poster(cookie, `/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

const reponseEnBase = (serie: string, position: number) =>
  base(db => db.prepare('SELECT forme, joker, juste FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(serie, position)) as { forme: string | null; joker: string | null; juste: number }

/** Les mots qu'un dévoilement livre d'un coup, à l'heure où on le demande : on lit jusqu'à ce qu'il se taise. */
async function motsLivres(cookie: string, v: VueDeLExpedition): Promise<string[]> {
  const arret = new AbortController()
  const r = await fetch(`${banc.url}/api/expedition/${v.id}/devoilement?position=${v.question!.index}`, { headers: { Cookie: cookie }, signal: arret.signal })
  assert.equal(r.status, 200)
  assert.match(r.headers.get('cache-control') ?? '', /no-transform/, 'jamais compressée : elle garderait les mots jusqu’au dernier')
  const lecteur = r.body!.getReader()
  const decodeur = new TextDecoder()
  let texte = ''
  try {
    for (;;) {
      const lu = await Promise.race([lecteur.read(), new Promise<null>(fin => setTimeout(() => fin(null), 400))])
      if (lu === null || lu.done) break
      texte += decodeur.decode(lu.value, { stream: true })
    }
  } finally {
    arret.abort()
  }
  return texte.split('\n').filter(Boolean)
}

test('six choix : ses quatre réponses et deux leurres, la bonne jamais avant la sienne ; sa réponse ne mesure rien', async () => {
  const six = await inscrireProfil(banc.url, 'six', 'Six')
  const v = await partirEt(six, auPremierEtage('six'))
  const a = await avancer(six, v, v.permises[0])
  const q = a.question!
  assert.equal(q.forme, 'six')
  assert.equal(q.reponses.length, 6)
  assert.equal((q as any).bonne, undefined, 'la bonne réponse ne part pas avant la sienne (invariant 1)')
  assert.equal((q as any).anecdote, undefined)
  const gardee = questionsDe(a.id)[q.index]
  const deLaBase = BASE.parId.get(gardee.id)!
  assert.ok(
    deLaBase.reponses.every(r => q.reponses.includes(r)),
    'ses quatre réponses y sont',
  )
  assert.equal(new Set(q.reponses).size, 6, 'deux leurres qui ne redisent aucune réponse')
  assert.equal(gardee.reponses[gardee.bonne], deLaBase.reponses[deLaBase.bonne])

  const avant = (await lire(six, '/api/joueur/moi')).corps.profile.fiche
  const r = await repondre(six, a, true)
  assert.equal(r.juste, true)
  assert.ok(r.xp > 0, 'juste, elle paie son expérience')
  assert.deepEqual(reponseEnBase(a.id, q.index), { forme: 'six', joker: null, juste: 1 })
  const apres = (await lire(six, '/api/joueur/moi')).corps.profile.fiche
  assert.deepEqual([apres.qcm, apres.justes], [avant.qcm, avant.justes], 'à six choix, elle n’a plus sa difficulté : ni la précision ni les écussons ne la comptent')
})

test('vrai ou faux tiré d’une question à quatre choix : une réponse proposée, à dire vraie ou fausse ; juste, elle ne retrouve rien au carnet', async () => {
  const vf = await inscrireProfil(banc.url, 'vraifaux', 'Vraifaux')
  const v = await partirEt(vf, auPremierEtage('vrai-faux'))
  const a = await avancer(vf, v, v.permises[0])
  const q = a.question!
  assert.equal(q.forme, 'vrai-faux')
  assert.deepEqual(q.reponses, ['Vrai', 'Faux'])
  const gardee = questionsDe(a.id)[q.index]
  const deLaBase = BASE.parId.get(gardee.id)!
  assert.equal(q.proposee, gardee.proposee)
  assert.ok(deLaBase.reponses.includes(q.proposee!), 'une des réponses de la question')
  assert.equal(gardee.bonne === 0, q.proposee === deLaBase.reponses[deLaBase.bonne], '« Vrai » quand elle propose la bonne')
  assert.equal((q as any).bonne, undefined)
  // Un joker qui efface ou qui double ne s'y joue pas : il répondrait à sa place.
  for (const cle of a.jokers!.main) if (cle === 'coup-d-oeil') assert.equal(a.jokers!.refus[cle], 'Pas sur un vrai ou faux : il répondrait à ta place')

  // Ratée, elle entre au carnet ; reprise le lendemain en vrai ou faux et trouvée, elle n'y avance pas — une nue, si.
  const r = await repondre(vf, a, false)
  assert.equal(r.juste, false)
  assert.deepEqual(reponseEnBase(a.id, q.index), { forme: 'vrai-faux', joker: null, juste: 0 })
  const carnet = async () => (await lire(vf, '/api/campagne/carnet')).corps
  horloge.t += 86_400_000
  assert.equal((await carnet()).aRevoir, 1, 'à revoir le lendemain')
  const reprendre = (position: number, forme: string | null) =>
    base(db => {
      db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, forme) VALUES (?, ?, ?, 0, 1, ?, ?)').run(a.id, position, gardee.id, horloge.t, forme)
    }, true)
  reprendre(900, 'vrai-faux')
  assert.equal((await carnet()).aRevoir, 1, 'trouvée en vrai ou faux tiré d’une autre, elle ne prouve rien')
  reprendre(901, null)
  assert.equal((await carnet()).aRevoir, 0, 'trouvée nue, elle avance au rendez-vous suivant')
  horloge.t -= 86_400_000
})

test('un dévoilement ne livre que les mots déjà dits, à l’heure du serveur ; sa réponse dit où il en était', async () => {
  const dev = await inscrireProfil(banc.url, 'devoile', 'Dévoile')
  const v = await partirEt(dev, auPremierEtage('devoilement'))
  const a = await avancer(dev, v, v.permises[0])
  const q = a.question!
  assert.equal(q.forme, 'devoilement')
  assert.equal(q.texte, '', 'l’intitulé ne part pas entier (invariant 1)')
  const gardee = questionsDe(a.id)[q.index]
  const mots = motsDe(gardee.texte)
  assert.equal(q.devoilement?.mots, mots.length)
  assert.equal(gardee.devoileLe, horloge.t, 'il commence à son tirage, à l’heure du serveur')

  // Deux mots et demi plus tard : trois mots, pas un de plus.
  horloge.t = gardee.devoileLe! + 2.5 * MS_PAR_MOT
  assert.deepEqual(await motsLivres(dev, a), mots.slice(0, 3))

  // Sa réponse arrive au cinquième mot : c'est l'heure du serveur qui le dit, et la réponse redonne l'intitulé entier.
  horloge.t = gardee.devoileLe! + 4.2 * MS_PAR_MOT
  const r = await repondre(dev, a, false)
  assert.deepEqual(r.devoile, { mots: 5, sur: mots.length })
  assert.equal(r.texte, gardee.texte)
  assert.deepEqual(reponseEnBase(a.id, q.index), { forme: 'devoilement', joker: null, juste: 0 })
  // Répondue, la question ne se dévoile plus.
  const fermee = await fetch(`${banc.url}/api/expedition/${a.id}/devoilement?position=${q.index}`, { headers: { Cookie: dev } })
  assert.equal(fermee.status, 400)
})

/** Le refus d'un joker de la main, s'il y est ; undefined : il n'est pas en main. */
const refusDansLaMain = (v: VueDeLExpedition, cle: string) => (v.jokers!.main.includes(cle) ? v.jokers!.refus[cle] : undefined)

/**
 * Arrêt sur image en main au deuxième pas : la graine choisie pour que la
 * première offre — celle du coffre, au premier étage du dessus — le
 * propose, et que la main le tire à la question d'après, un dévoilement.
 * Le pli rejoue ce que le serveur jouera : la même graine, les mêmes gestes.
 */
function forcerArretSurImage(depart: DepartDExpedition): { premiere: string; coffre: string; devoilement: string } {
  const carte = depart.cartes[0]
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const premiere = parId.get(carte.depart[0])!
  premiere.forme = 'quatre'
  const coffre = parId.get(premiere.suite[0])!
  coffre.sorte = 'coffre'
  delete coffre.theme
  delete coffre.forme
  delete coffre.chance
  const devoilement = parId.get(coffre.suite[0])!
  devoilement.sorte = 'question'
  devoilement.theme = { categories: ['Histoire'] }
  devoilement.forme = 'devoilement'
  const gestes: GesteDExpedition[] = [
    { quoi: 'avancer', vers: premiere.id },
    { quoi: 'avancer', vers: coffre.id },
    { quoi: 'prendre', jokers: ['arret-sur-image'] },
    { quoi: 'avancer', vers: devoilement.id },
  ]
  const posees = [
    { escale: premiere.id, acte: 0, reponses: 4 },
    { escale: devoilement.id, acte: 0, reponses: 4, forme: 'devoilement' as const },
  ]
  for (let k = 0; k < 5000; k++) {
    const graine = `arret:${k}`
    if (!offreDeJokers(graine, 0, depart.v).includes('arret-sur-image')) continue
    const e = pliDeLExpedition({ ...depart, graine }, gestes, posees, new Map([[0, true]]))
    if (e.main.includes('arret-sur-image')) {
      depart.graine = graine
      return { premiere: premiere.id, coffre: coffre.id, devoilement: devoilement.id }
    }
  }
  throw new Error('aucune graine ne met Arrêt sur image en main')
}

test('Arrêt sur image : sur un dévoilement seulement ; joué, le compte s’arrête cinq secondes, mots et réponse avec lui', async () => {
  const arret = await inscrireProfil(banc.url, 'arret', 'Arrêt')
  let chemin: ReturnType<typeof forcerArretSurImage> | null = null
  let v = await partirEt(arret, depart => {
    chemin = forcerArretSurImage(depart)
  })
  const { premiere, coffre, devoilement } = chemin!
  v = await avancer(arret, v, premiere)
  assert.equal(refusDansLaMain(v, 'arret-sur-image'), undefined, 'pas encore en main')
  v = (await repondre(arret, v, true)).expedition
  v = await avancer(arret, v, coffre)
  assert.ok(v.offre?.jokers.includes('arret-sur-image'), 'le coffre le propose')
  const r1 = await poster(arret, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'prendre', jokers: ['arret-sur-image'] } })
  v = r1.corps.expedition
  v = await avancer(arret, v, devoilement)
  assert.equal(v.question?.forme, 'devoilement')
  assert.equal(refusDansLaMain(v, 'arret-sur-image'), null, 'sur un dévoilement, il se joue')
  const gardee = questionsDe(v.id)[v.question!.index]
  const total = motsDe(gardee.texte).length

  // Joué au deuxième mot et demi : le compte s'arrête.
  horloge.t = gardee.devoileLe! + 1.5 * MS_PAR_MOT
  const joue = await poster(arret, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'jouer', joker: 'arret-sur-image', position: v.question!.index } })
  assert.equal(joue.status, 200, joue.corps.error)
  v = joue.corps.expedition
  assert.equal(questionsDe(v.id)[v.question!.index].arretLe, horloge.t, 'l’heure du serveur où il l’a arrêté')
  // Trois secondes plus tard, en pleine pause : toujours deux mots.
  horloge.t += 3000
  assert.deepEqual(await motsLivres(arret, v), motsDe(gardee.texte).slice(0, 2))
  // La pause finie, le compte reprend là où il en était : sa réponse le lit, la pause en moins.
  horloge.t = gardee.devoileLe! + 1.5 * MS_PAR_MOT + ARRET_SUR_IMAGE_MS + 0.6 * MS_PAR_MOT
  const r = await repondre(arret, v, true)
  assert.deepEqual(r.devoile, { mots: 3, sur: total })
})

test('le Commandement change la catégorie d’une escale, pas sa forme : la carte ramène sa chance à la forme, comme au départ', async () => {
  const lion = await inscrireProfil(banc.url, 'lion', 'Lion')
  let premiere = ''
  let v = await partirEt(lion, depart => {
    // Le Lion dans l'équipée, et une graine où la main le tire à la première question ; l'étage du dessus en vrai ou faux.
    depart.equipee = ['lg:lion']
    const carte = depart.cartes[0]
    premiere = carte.depart[0]
    for (const e of carte.escales) if (e.etage === 1 && (e.sorte === 'question' || e.sorte === 'elite')) e.forme = 'vrai-faux'
    for (let k = 0; k < 500; k++) {
      const e = pliDeLExpedition({ ...depart, graine: `lion:${k}` }, [{ quoi: 'avancer', vers: premiere }], [{ escale: premiere, acte: 0, reponses: 4 }], new Map())
      if (e.main.includes('commandement')) {
        depart.graine = `lion:${k}`
        return
      }
    }
    throw new Error('aucune graine ne met le Commandement en main')
  })
  v = await avancer(lion, v, premiere)
  assert.ok(v.jokers?.main.includes('commandement'))
  v = (await repondre(lion, v, true)).expedition
  const joue = await poster(lion, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'jouer', joker: 'commandement', categorie: 'Cuisine' } })
  assert.equal(joue.status, 200, joue.corps.error)
  v = joue.corps.expedition
  const depart = base(db => JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition)) as DepartDExpedition
  const commandees = v.carte!.escales.filter(e => v.permises.includes(e.id) && e.forme === 'vrai-faux')
  assert.ok(commandees.length > 0, 'une escale en vrai ou faux au pas suivant')
  for (const e of commandees) {
    assert.deepEqual(e.theme, { categories: ['Cuisine'] })
    const aQuatre = depart.chances!.Cuisine[marcheDe(0, e)]!
    assert.equal(e.chance, Math.round(chanceSelonLaForme(aQuatre, 'vrai-faux') * 1000) / 1000, 'sa chance en vrai ou faux, pas celle à quatre choix')
  }
})

test('Arrêt sur image ne se joue que sur un dévoilement, Deux visages jamais : une seule règle, celle du pli', () => {
  const depart: DepartDExpedition = { v: 3, graine: 'regle', numero: 0, gardiens: [], cartes: [], moyen: false, equipee: [] }
  const vide = pliDeLExpedition(depart, [], [], new Map())
  const e = { ...vide, main: ['arret-sur-image', 'deux-visages', 'coup-d-oeil'], enAttente: 0 }
  const sur = (forme?: FormeDEscale) => [{ escale: 'e00', acte: 0, reponses: 4, ...(forme && { forme }) }]
  assert.equal(refusDuJoker(depart, e, 'arret-sur-image', sur()), 'Arrêt sur image se joue sur un dévoilement')
  assert.equal(refusDuJoker(depart, e, 'arret-sur-image', sur('six')), 'Arrêt sur image se joue sur un dévoilement')
  assert.equal(refusDuJoker(depart, e, 'arret-sur-image', sur('devoilement')), null)
  assert.equal(refusDuJoker(depart, e, 'deux-visages', sur('devoilement')), 'Deux visages ne se joue pas sur un dévoilement')
  assert.equal(refusDuJoker(depart, e, 'deux-visages', sur('six')), null)
  assert.equal(refusDuJoker(depart, e, 'coup-d-oeil', [{ escale: 'e00', acte: 0, reponses: 2, forme: 'vrai-faux' }]), 'Pas sur un vrai ou faux : il répondrait à ta place')
})

test('les offres d’une expédition partie avant les formes ne connaissent pas Arrêt sur image : rejouée, elle garde les siennes', () => {
  let depuisLesFormes = 0
  for (let rang = 0; rang < 400; rang++) {
    assert.ok(!offreDeJokers('avant', rang, 2).includes('arret-sur-image'), 'une expédition de la version 2 ne le voit jamais')
    assert.deepEqual(offreDeJokers('avant', rang), offreDeJokers('avant', rang, 2), 'la version 2, par défaut')
    if (offreDeJokers('depuis', rang, 3).includes('arret-sur-image')) depuisLesFormes++
  }
  assert.ok(depuisLesFormes > 20, `${depuisLesFormes} offres sur 400 le proposent depuis les formes`)
})

test('le compte d’un dévoilement : un mot tout de suite, un tous les MS_PAR_MOT, la pause d’Arrêt sur image en moins', () => {
  assert.equal(motsDits(10, 1000, 999), 0, 'avant de se poser, rien')
  assert.equal(motsDits(10, 1000, 1000), 1)
  assert.equal(motsDits(10, 1000, 1000 + 3 * MS_PAR_MOT - 1), 3)
  assert.equal(motsDits(10, 1000, 1000 + 3 * MS_PAR_MOT), 4)
  assert.equal(motsDits(10, 1000, 1000 + 100 * MS_PAR_MOT), 10, 'jamais plus que son texte')
  const arret = 1000 + MS_PAR_MOT
  assert.equal(motsDits(10, 1000, arret + ARRET_SUR_IMAGE_MS - 1, arret), 2, 'en pleine pause')
  assert.equal(motsDits(10, 1000, arret + ARRET_SUR_IMAGE_MS + MS_PAR_MOT, arret), 3, 'la pause finie, il reprend')
})

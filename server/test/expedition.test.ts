// L'Expédition (`shared/expedition.ts`, le brief du 17 octobre 2026) : trois
// actes, une carte tirée au sort chacun, un gardien au bout, et un légendaire
// à garder au bout du troisième. Le serveur tire et juge (invariant 1), un
// geste dit le rang qu'il suit (invariant 12), et rien d'autre que le
// journal ne dit où l'on en est.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { expeditionOuverte } from '../src/expedition'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { xpDeLaBonneReponse } from '../../shared/campagne'
import { GARDIEN, MARCHES_DES_ACTES, type CarteDUnActe, type VueDeLExpedition } from '../../shared/expedition'
import { LEGENDAIRES_A_JOKER } from '../../shared/jokers'
import { LEGENDAIRES, cleDeLExpedition, legendaire } from '../../shared/legendaires'

/** Une question d'essai de la catégorie et de la difficulté qu'on veut : 2 facile, 3 moyenne, 4 difficile. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `expe${String(i).padStart(4, '0')}`,
    texte: `Question d'essai d'une expédition numéro ${i} : laquelle est la bonne ?`,
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

/** Huit questions de chaque marche dans chacune des douze catégories : de quoi tirer trois actes et leurs gardiens. */
const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
function questionsDe(banc: Banc, id: string): { id: string; bonne: number; reponses: string[]; categorie: string; escale: string; acte: number }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

const avancer = (banc: Banc, cookie: string, v: VueDeLExpedition, vers: string) =>
  poster(banc, cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers } })

async function repondre(banc: Banc, cookie: string, v: VueDeLExpedition, juste: boolean) {
  const q = questionsDe(banc, v.id)[v.question!.index]
  const r = await poster(banc, cookie, `/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** Joue jusqu'à ce que l'acte en cours change ou que l'expédition s'arrête : la première escale permise, toujours ; `juste` dit chaque réponse. */
async function jouerLActe(banc: Banc, cookie: string, depart: VueDeLExpedition, juste: () => boolean): Promise<VueDeLExpedition> {
  let v = depart
  const acte = v.acte
  for (let pas = 0; pas < 60 && v.issue === 'en-route' && v.acte === acte; pas++) {
    if (v.question) {
      v = (await repondre(banc, cookie, v, juste())).expedition
      continue
    }
    const vers = v.permises.includes(GARDIEN) ? GARDIEN : v.permises[0]
    const r = await avancer(banc, cookie, v, vers)
    assert.equal(r.status, 200, r.corps.error)
    v = r.corps.expedition
  }
  return v
}

test('partir : trois cartes, trois gardiens qu’il n’a pas, et la bonne réponse jamais avant la sienne', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const page = (await lire(banc, lea, '/api/expedition')).corps
    assert.equal(page.expedition, null)
    assert.equal(page.prochaine.gardiens.length, 3)
    assert.equal(new Set(page.prochaine.gardiens).size, 3, 'trois gardiens distincts')
    for (const g of page.prochaine.gardiens) {
      assert.ok(LEGENDAIRES_A_JOKER.includes(g), `${g} a son joker`)
      assert.equal(legendaire(g)?.saison, undefined, `${g} n’est pas de saison`)
    }

    const v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    assert.deepEqual([v.acte, v.vies, v.justes, v.issue, v.rang, v.ici], [0, 3, 0, 'en-route', 0, null])
    assert.equal(v.numero, page.prochaine.numero, 'la carte annoncée est celle du départ')
    assert.deepEqual(
      v.gardiens.map(g => g.cle),
      page.prochaine.gardiens,
    )
    assert.ok(v.moyen, 'sans réponses, la chance d’un joueur moyen')
    assert.deepEqual(v.permises, v.carte!.depart)
    assert.ok(v.carte!.escales.some(e => e.id === GARDIEN))
    assert.ok(v.carte!.escales.filter(e => e.sorte === 'question').every(e => typeof e.chance === 'number' && e.chance > 0 && e.chance < 1))

    // Une à la fois : celle qu'il a laissée l'attend.
    assert.equal((await poster(banc, lea, '/api/expedition')).corps.error, 'Ton expédition t’attend : reprends-la, ou abandonne-la d’abord')
    // Pas sur sa route, ou un rang qui n'est pas le suivant : refusé, et rien ne bouge.
    assert.equal((await avancer(banc, lea, v, GARDIEN)).corps.error, 'Cette escale n’est pas sur ta route : choisis-en une reliée à la tienne')
    assert.equal((await poster(banc, lea, `/api/expedition/${v.id}/geste`, { rang: 7, geste: { quoi: 'avancer', vers: v.permises[0] } })).corps.error, 'Ce geste est passé : l’expédition a continué sans lui')
    assert.equal((await poster(banc, lea, `/api/expedition/${v.id}/geste`, { rang: 1, geste: { quoi: 'garder', legendaire: v.gardiens[0].cle } })).corps.error, 'Va au bout de l’acte 3 pour garder un gardien')

    const vers = v.permises[0]
    const escale = v.carte!.escales.find(e => e.id === vers)!
    const a = (await avancer(banc, lea, v, vers)).corps.expedition as VueDeLExpedition
    assert.equal(a.question?.escale, vers)
    assert.equal((a.question as any).bonne, undefined, 'jamais la bonne réponse avant la sienne (invariant 1)')
    assert.equal((a.question as any).anecdote, undefined)
    const tiree = questionsDe(banc, a.id)[a.question!.index]
    if (escale.theme && 'categories' in escale.theme) assert.ok(escale.theme.categories.includes(tiree.categorie), 'la question est du thème de l’escale')
    // Recharger ne retire rien : la même question attend.
    const relue = (await lire(banc, lea, '/api/expedition')).corps.expedition as VueDeLExpedition
    assert.deepEqual([relue.question?.index, relue.question?.texte, relue.rang], [a.question!.index, a.question!.texte, 1])
    // Un geste par-dessus une question qui attend, refusé.
    assert.equal((await avancer(banc, lea, a, a.carte!.escales.find(e => e.id === vers)!.suite[0])).corps.error, 'Cette escale n’est pas sur ta route : choisis-en une reliée à la tienne')
    assert.equal((await poster(banc, lea, `/api/expedition/${a.id}/reponse`, { position: a.question!.index + 1, choix: 0 })).corps.error, 'Cette question est passée : l’expédition a continué sans elle')

    const bonne = await repondre(banc, lea, a, true)
    assert.deepEqual([bonne.juste, bonne.xp, bonne.expedition.vies, bonne.expedition.justes], [true, xpDeLaBonneReponse(1), 3, 1])
    assert.equal(bonne.anecdote, BASE.parId.get(tiree.id)!.anecdote, 'l’anecdote arrive avec le verdict')
    const b = (await avancer(banc, lea, bonne.expedition, bonne.expedition.permises[0])).corps.expedition as VueDeLExpedition
    if (b.question) {
      const ratee = await repondre(banc, lea, b, false)
      const escaleB = b.carte!.escales.find(e => e.id === b.ici)!
      // Une source ratée ne coûte rien ; une question ratée, une vie.
      assert.equal(ratee.expedition.vies, escaleB.sorte === 'source' ? 3 : 2)
    }
  } finally {
    await banc.close()
  }
})

test('le gardien tombe à sa n-ième bonne réponse, l’acte suivant s’ouvre ; au bout, il garde un légendaire, un seul, parmi ses gardiens', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const avant = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    const gardiens = v.gardiens.map(g => g.cle)

    // L'acte 1 sans une faute, jusqu'au gardien : sa quatrième bonne réponse le fait tomber.
    let tombe: string | undefined
    for (let pas = 0; pas < 40 && v.acte === 0; pas++) {
      if (v.question) {
        const r = await repondre(banc, lea, v, true)
        if (r.vaincu) tombe = r.vaincu
        if (v.gardien) assert.equal(r.expedition.acte === 1, v.gardien.trouvees + 1 === MARCHES_DES_ACTES[0].aTrouver, 'il tombe à sa quatrième')
        v = r.expedition
        continue
      }
      v = (await avancer(banc, lea, v, v.permises.includes(GARDIEN) ? GARDIEN : v.permises[0])).corps.expedition
    }
    assert.equal(tombe, gardiens[0])
    assert.deepEqual([v.acte, v.ici, v.trace, v.gardiens[0].vaincu, v.gardiens[1].vaincu], [1, null, [], true, false])
    assert.deepEqual(v.permises, v.carte!.depart, 'l’acte 2 s’ouvre sur sa carte')
    // Les questions de reste du gardien ne se posent pas : la suivante vient de l'acte 2.
    const a2 = (await avancer(banc, lea, v, v.permises[0])).corps.expedition as VueDeLExpedition
    assert.equal(questionsDe(banc, v.id)[a2.question?.index ?? 0]?.acte, 1)
    v = await jouerLActe(banc, lea, a2, () => true)
    assert.equal(v.acte, 2)
    v = await jouerLActe(banc, lea, v, () => true)
    assert.deepEqual([v.acte, v.issue, v.carte], [3, 'au-bout', null])
    assert.ok(v.gardiens.every(g => g.vaincu))

    // Au bout : un gardien de son expédition, un seul.
    assert.equal((await poster(banc, lea, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'garder', legendaire: 'lg:licorne' } })).corps.error, 'Ce gardien n’est pas de ton expédition')
    const garde = (await poster(banc, lea, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'garder', legendaire: gardiens[1] } })).corps
    assert.equal(garde.expedition.issue, 'legendaire')
    assert.equal(garde.expedition.garde, gardiens[1])
    assert.deepEqual(garde.legendaires, [gardiens[1]], 'la fin annonce le légendaire gardé')
    assert.equal((await poster(banc, lea, `/api/expedition/${v.id}/geste`, { rang: v.rang + 2, geste: { quoi: 'garder', legendaire: gardiens[2] } })).corps.error, 'Cette expédition est finie : pars pour une autre')

    const apres = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.ok(apres.legendaires.includes(gardiens[1]), 'le légendaire est à lui')
    assert.ok(!apres.legendaires.includes(gardiens[0]) && !apres.legendaires.includes(gardiens[2]), 'les deux autres retournent sur la carte')
    assert.ok(!avant.legendaires.includes(gardiens[1]))
    // La ligne qui le lui donne n'est ni sur l'étagère, ni au compte des badges : seul le légendaire se montre.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
    try {
      const lignes = db.prepare(`SELECT badge FROM profile_badges WHERE badge LIKE 'expedition:%'`).all() as { badge: string }[]
      assert.deepEqual(
        lignes.map(l => l.badge),
        [`expedition:${gardiens[1].slice(3)}`],
      )
      const autres = db.prepare(`SELECT COUNT(*) AS n FROM profile_badges WHERE badge NOT LIKE 'expedition:%' AND badge NOT LIKE 'saison:%' AND badge NOT LIKE 'dv:%'`).get() as { n: number }
      assert.equal(apres.badges, autres.n, 'le compte des badges ne le compte pas')
    } finally {
      db.close()
    }

    // Finie, elle se corrige comme toute partie ; la page annonce la suivante, et ses gardiens n'ont plus celui-là.
    const correction = (await lire(banc, lea, `/api/campagne/serie/${v.id}/correction`)).corps
    assert.ok(correction.length >= 20 && correction.every((c: any) => c.juste))
    // « L'activité » du QG compte ce qui lui a été posé, ses réponses : pas les
    // questions de reste de ses trois gardiens, tirées d'avance, que sa
    // position saute — deux chacun, vaincus sans une faute.
    const admin = await connexionAnimateur(banc.url)
    const activite = (await lire(banc, admin, '/api/admin/activite')).corps
    assert.equal(activite.joueurs.find((j: { login: string }) => j.login === 'lea')?.questions.campagne, correction.length)
    const page = (await lire(banc, lea, '/api/expedition')).corps
    assert.equal(page.expedition, null)
    assert.ok(!page.prochaine.gardiens.includes(gardiens[1]), 'il a ce légendaire : il ne garde plus d’acte pour lui')
    assert.notEqual(page.prochaine.numero, v.numero, 'une carte neuve')
  } finally {
    await banc.close()
  }
})

test('la dernière vie perdue finit l’expédition, ses erreurs vont au carnet ; abandonner la finit sans légendaire', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    let fin: any = null
    for (let pas = 0; pas < 40 && v.issue === 'en-route'; pas++) {
      if (v.question) {
        fin = await repondre(banc, lea, v, false)
        v = fin.expedition
        continue
      }
      // Les sources épargnent qui les rate : le chemin les évite quand il peut, pour finir vite.
      const vers = v.permises.find(id => v.carte!.escales.find(e => e.id === id)?.sorte === 'question') ?? (v.permises.includes(GARDIEN) ? GARDIEN : v.permises[0])
      v = (await avancer(banc, lea, v, vers)).corps.expedition
    }
    assert.deepEqual([v.issue, v.vies], ['perdue', 0])
    assert.equal((await poster(banc, lea, `/api/expedition/${v.id}/abandon`)).corps.error, 'Cette expédition est finie : pars pour une autre')
    // Ses erreurs reviennent demain au carnet, comme celles d'une série.
    const carnet = (await lire(banc, lea, '/api/campagne/carnet')).corps
    assert.ok(carnet.demain >= 3, `${carnet.demain} au carnet`)

    const autre: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    assert.notEqual(autre.numero, v.numero)
    const abandonnee = (await poster(banc, lea, `/api/expedition/${autre.id}/abandon`)).corps
    assert.equal(abandonnee.expedition.issue, 'abandonnee')
    assert.equal((await lire(banc, lea, '/api/expedition')).corps.expedition, null)
    // Une expédition est à son profil seul : celle d'un autre est introuvable (invariant 3).
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    const sienne: VueDeLExpedition = (await poster(banc, tom, '/api/expedition')).corps
    assert.equal((await avancer(banc, lea, sienne, sienne.permises[0])).corps.error, 'Cette expédition est introuvable')
  } finally {
    await banc.close()
  }
})

/** Le plus court chemin d'en bas jusqu'à une source de l'acte : de quoi y mener une expédition. */
function versUneSource(carte: CarteDUnActe): string[] {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const file: string[][] = carte.depart.map(id => [id])
  while (file.length > 0) {
    const chemin = file.shift()!
    const e = parId.get(chemin[chemin.length - 1])!
    if (e.sorte === 'source') return chemin
    for (const id of e.suite) file.push([...chemin, id])
  }
  return []
}

test('une source reprend une question du carnet : comme une révision, ni la précision ni la mesure ne comptent sa réponse, déjà lue', async () => {
  const horloge = { t: Date.UTC(2026, 9, 12, 8) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Une série ratée d'emblée : trois questions au carnet.
    const serie = (await poster(banc, lea, '/api/campagne/serie')).corps
    const deLaSerie = questionsDe(banc, serie.id)
    for (const i of [0, 1, 2]) await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: (deLaSerie[i].bonne + 1) % deLaSerie[i].reponses.length })
    const auCarnet = deLaSerie.slice(0, 3).map(q => q.id)

    let v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    const chemin = versUneSource(v.carte!)
    assert.ok(chemin.length > 1, 'chaque acte a sa source')
    let justes = 0
    for (const id of chemin.slice(0, -1)) {
      v = (await avancer(banc, lea, v, id)).corps.expedition
      if (v.question) {
        v = (await repondre(banc, lea, v, true)).expedition
        justes++
      }
    }
    v = (await avancer(banc, lea, v, chemin[chemin.length - 1])).corps.expedition
    const reprise = questionsDe(banc, v.id)[v.question!.index] as { id: string; carnet?: true }
    assert.ok(auCarnet.includes(reprise.id), 'la source repose une question de son carnet')
    assert.equal(reprise.carnet, true)
    await repondre(banc, lea, v, true)

    // Sa précision : les trois de la série et les escales d'avant, pas la question reprise.
    const fiche = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.fiche
    assert.deepEqual([fiche.qcm, fiche.justes], [3 + justes, justes])
    // Sa mesure : la seule réponse de la série — relue au plus toutes les dix minutes.
    await poster(banc, lea, `/api/campagne/serie/${v.id}/signalement`, { index: v.question!.index, texte: 'Pour relire sa mesure.' })
    horloge.t += 11 * 60_000
    const admin = await connexionAnimateur(banc.url)
    const signalee = (await lire(banc, admin, '/api/admin/campagne')).corps.signalements.find((s: any) => s.questionId === reprise.id)
    assert.deepEqual(signalee.mesure, { justes: 0, total: 1 })
    assert.equal(signalee.rapports[0].ou, 'expedition', 'le QG dit où il l’a jouée')
  } finally {
    await banc.close()
  }
})

test('un gardien qu’il a déjà se dit avant le départ et en route : les places qui manquent se prennent parmi les siens', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const id = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id
    // Tous les légendaires qu'une expédition peut lui faire garder, sauf deux — gagnés, disons, en expédition.
    const possibles = LEGENDAIRES.filter(l => LEGENDAIRES_A_JOKER.includes(l.key) && !l.saison).map(l => l.key)
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const ranger = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:essai', '', '🧭', 'essai', 1)`)
      for (const cle of possibles.slice(2)) ranger.run(id, cleDeLExpedition(cle))
    } finally {
      db.close()
    }
    // Relu au démarrage : le profil sait ce qu'il a.
    await banc.redemarrer()
    const page = (await lire(banc, lea, '/api/expedition')).corps
    assert.deepEqual(page.prochaine.gardiens.slice(0, 2).sort(), possibles.slice(0, 2).sort(), 'ceux qu’il n’a pas d’abord')
    assert.deepEqual(page.prochaine.aLui, [page.prochaine.gardiens[2]], 'la troisième place, parmi les siens : la page le dit avant le départ')
    const v: VueDeLExpedition = (await poster(banc, lea, '/api/expedition')).corps
    assert.deepEqual(
      v.gardiens.map(g => g.aLui === true),
      [false, false, true],
    )
  } finally {
    await banc.close()
  }
})

test('en production, l’expédition attend ses jokers : ses routes ne répondent qu’hors de la production', () => {
  assert.equal(expeditionOuverte({ online: true, env: 'production' }), false)
  assert.equal(expeditionOuverte({ online: true, env: 'preprod' }), true)
  assert.equal(expeditionOuverte({ online: false, env: 'production' }), true, '`npm run dev`, les tests')
})

// Les écus de l'Expédition sur un vrai serveur (l'étape 4 du brief du 17
// octobre 2026) : ils meurent avec l'expédition, et le solde de confettis
// n'en sait rien ; l'échoppe vend contre eux, et refuse en mots ; ce que cache
// l'inconnu ne part jamais avant d'être dévoilé (invariant 1), et un piège
// sur la dernière vie finit l'expédition d'un geste ; la loupe dit le siècle
// d'une question d'Histoire, qui ne mesure plus rien. Ce que le pli en fait :
// `expedition-ecus.test.ts`.
//
// La carte se tire au hasard de la graine : chaque essai force ses escales
// dans le départ gardé en base, puis redémarre le serveur, qui le relit.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import {
  ECUS_DES_PISTES,
  PRIX_DE_L_ECHOPPE,
  contenuDeLInconnu,
  talismanDeLOffre,
  type DepartDExpedition,
  type EscaleDeLaCarte,
  type VueDeLExpedition,
} from '../../shared/expedition'

/** Une question d'essai — 2 facile, 3 moyenne, 4 difficile ; celles d'Histoire se datent : la loupe en dit le siècle. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id: `ecus${String(i).padStart(4, '0')}`,
    texte: `Question d'essai des écus numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, `Autre A${i}`, `Autre B${i}`, `Autre C${i}`],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: categorie === 'Histoire' ? { valeur: '1789', precision: 'annee' } : null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: [`Autre A${i}`, `Autre B${i}`, `Autre C${i}`, `Leurre D${i}`, `Leurre E${i}`],
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

const questionsDe = (id: string): { id: string; reponses: string[]; bonne: number; categorie: string }[] =>
  base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/** Partir, puis récrire le départ gardé — `forcer` le change —, et redémarrer le serveur pour qu'il le relise. */
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

/** Une escale de l'étage changée : une question noire — trente écus, trouvée —, de cette catégorie ; ou une autre sorte, sans thème ni chance. */
function enQuestionNoire(e: EscaleDeLaCarte, categorie = 'Sport') {
  e.sorte = 'question'
  e.theme = { categories: [categorie] }
  e.forme = 'quatre'
  e.chance = 0.1
}
function enSorte(e: EscaleDeLaCarte, sorte: EscaleDeLaCarte['sorte']) {
  e.sorte = sorte
  delete e.theme
  delete e.forme
  delete e.chance
}
const etage = (depart: DepartDExpedition, n: number) => depart.cartes[0].escales.filter(e => e.etage === n)

const geste = async (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

async function avancer(cookie: string, v: VueDeLExpedition, vers: string): Promise<VueDeLExpedition> {
  const r = await geste(cookie, v, { quoi: 'avancer', vers })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps.expedition
}

async function repondre(cookie: string, v: VueDeLExpedition, juste: boolean) {
  const q = questionsDe(v.id)[v.question!.index]
  const r = await poster(cookie, `/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** Le pas suivant vers une escale de cette sorte. */
const versUne = (v: VueDeLExpedition, sorte: string) => v.permises.find(id => v.carte!.escales.find(e => e.id === id)?.sorte === sorte)!

const solde = async (cookie: string): Promise<number> => (await lire(cookie, '/api/joueur/moi')).corps.profile.boutique.confettis.solde

test('les écus meurent avec l’expédition, et le solde de confettis n’en sait rien', async () => {
  const lea = await inscrireProfil(banc.url, 'ecus', 'Écus')
  let v = await partirEt(lea, depart => {
    for (const e of etage(depart, 0)) enQuestionNoire(e)
  })
  assert.equal(v.ecus, 0, 'elle part sans écus')
  const avant = await solde(lea)
  v = await avancer(lea, v, v.permises[0])
  const r = await repondre(lea, v, true)
  assert.equal(r.ecus, ECUS_DES_PISTES.noire, 'une escale noire trouvée')
  assert.equal(r.expedition.ecus, ECUS_DES_PISTES.noire)
  assert.equal(await solde(lea), avant + 1, 'un confetti : une bonne réponse, pas ses écus')

  // Abandonnée, elle finit avec ses écus ; la suivante repart de zéro, et le solde n'a pas bougé.
  const fin = await poster(lea, `/api/expedition/${v.id}/abandon`)
  assert.equal(fin.status, 200, fin.corps.error)
  assert.equal(await solde(lea), avant + 1)
  const suivante = (await poster(lea, '/api/expedition')).corps as VueDeLExpedition
  assert.notEqual(suivante.id, v.id)
  assert.equal(suivante.ecus, 0, 'les écus sont morts avec elle')
})

test('l’échoppe : un achat se paie en écus, un refus se dit en mots, et l’échoppe se quitte en avançant', async () => {
  const marc = await inscrireProfil(banc.url, 'echoppe', 'Échoppe')
  let v = await partirEt(marc, depart => {
    for (const e of etage(depart, 0)) enQuestionNoire(e)
    for (const e of etage(depart, 1)) enSorte(e, 'echoppe')
    // Au-dessus, des questions : la carte tirée pouvait y poser sa propre échoppe, et le pas d'après en rouvrait une.
    for (const e of etage(depart, 2)) enQuestionNoire(e)
  })
  v = await avancer(marc, v, v.permises[0])
  v = (await repondre(marc, v, true)).expedition
  v = await avancer(marc, v, versUne(v, 'echoppe'))
  assert.ok(v.echoppe, 'son étal')
  assert.equal(v.echoppe!.jokers.length, 3)
  const acheter = (article: string, joker?: string) => geste(marc, v, { quoi: 'acheter', article, ...(joker && { joker }) })

  assert.equal((await acheter('vie')).corps.error, 'Tu as déjà tes trois vies')
  assert.equal((await acheter('talisman')).corps.error, `Il te manque ${PRIX_DE_L_ECHOPPE.talisman - ECUS_DES_PISTES.noire} écus`)
  assert.equal((await acheter('retirer', 'renaissance')).corps.error, 'Ce joker n’est pas dans ton paquet')
  const coups = (x: VueDeLExpedition) => [...x.jokers!.paquet, ...x.jokers!.main].filter(c => c === 'coup-d-oeil').length
  const avant = coups(v)
  const r = await acheter('retirer', 'coup-d-oeil')
  assert.equal(r.status, 200, r.corps.error)
  v = r.corps.expedition
  assert.equal(v.ecus, ECUS_DES_PISTES.noire - PRIX_DE_L_ECHOPPE.retirer)
  assert.equal(coups(v), avant - 1, 'un Coup d’œil de moins')
  assert.deepEqual(v.echoppe!.achats, ['retirer'])
  // Le journal garde le prix payé — celui du barème, pas celui qu'une page enverrait.
  const ecrit = base(db => db.prepare('SELECT geste FROM expedition_gestes WHERE serie_id = ? AND rang = ?').get(v.id, v.rang)) as { geste: string }
  assert.deepEqual(JSON.parse(ecrit.geste), { quoi: 'acheter', article: 'retirer', joker: 'coup-d-oeil', prix: PRIX_DE_L_ECHOPPE.retirer })
  assert.equal((await acheter('retirer', 'coup-d-oeil')).corps.error, 'Un joker retiré par échoppe')
  // Un geste d'un rang passé — un double toucher — ne paie pas deux fois.
  const rejoue = await poster(marc, `/api/expedition/${v.id}/geste`, { rang: v.rang, geste: { quoi: 'acheter', article: 'retirer', joker: 'echange' } })
  assert.equal(rejoue.status, 400)
  assert.equal((await lire(marc, '/api/expedition')).corps.expedition.ecus, ECUS_DES_PISTES.noire - PRIX_DE_L_ECHOPPE.retirer)

  v = await avancer(marc, v, v.permises[0])
  assert.equal(v.echoppe, undefined, 'quittée en avançant')
})

test('ce que cache l’inconnu ne part jamais avant d’être dévoilé (invariant 1) ; entré, il se dit', async () => {
  const ines = await inscrireProfil(banc.url, 'inconnu', 'Inconnu')
  let graine = ''
  let v = await partirEt(ines, depart => {
    for (const e of etage(depart, 0)) enQuestionNoire(e)
    for (const e of etage(depart, 1)) enSorte(e, 'inconnu')
    graine = depart.graine
  })
  const cache = (x: unknown) => JSON.stringify(x)
  for (const brut of [cache(v), cache((await lire(ines, '/api/expedition')).corps)]) {
    assert.doesNotMatch(brut, /"contenu"|marchand|piege|passage/, 'rien de ce qu’il cache')
  }
  v = await avancer(ines, v, v.permises[0])
  v = (await repondre(ines, v, true)).expedition
  const vers = versUne(v, 'inconnu')
  const contenu = contenuDeLInconnu(graine, 0, vers)
  v = await avancer(ines, v, vers)
  assert.equal(v.inconnu?.contenu, contenu)
  assert.equal(v.carte!.escales.find(e => e.id === vers)!.contenu, contenu, 'passé, il se montre sur la carte')
  const autres = v.carte!.escales.filter(e => e.sorte === 'inconnu' && e.id !== vers)
  assert.ok(autres.every(e => e.contenu === undefined), 'les autres restent cachés')
  if (contenu === 'marchand') assert.ok(v.echoppe)
  if (contenu === 'piege') assert.equal(v.vies, 2)
  if (contenu === 'passage') assert.ok(v.inconnu!.legendaire)
})

test('un piège sur la dernière vie finit l’expédition d’un geste, comme une réponse', async () => {
  const pia = await inscrireProfil(banc.url, 'piege', 'Piège')
  let v = await partirEt(pia, depart => {
    for (const e of etage(depart, 0)) enQuestionNoire(e)
    for (const e of etage(depart, 1)) enQuestionNoire(e)
    for (const e of etage(depart, 2)) enSorte(e, 'inconnu')
    // Une graine où tous les inconnus du troisième étage sont des pièges.
    for (let k = 0; k < 20000; k++) {
      const g = `piege:${k}`
      if (etage(depart, 2).every(e => contenuDeLInconnu(g, 0, e.id) === 'piege')) {
        depart.graine = g
        return
      }
    }
    throw new Error('aucune graine')
  })
  v = await avancer(pia, v, v.permises[0])
  v = (await repondre(pia, v, false)).expedition
  v = await avancer(pia, v, v.permises[0])
  v = (await repondre(pia, v, false)).expedition
  assert.equal(v.vies, 1)
  const r = await geste(pia, v, { quoi: 'avancer', vers: versUne(v, 'inconnu') })
  assert.equal(r.status, 200, r.corps.error)
  assert.equal(r.corps.expedition.issue, 'perdue')
  assert.equal(r.corps.expedition.vies, 0)
  const ligne = base(db => db.prepare('SELECT finie_le, issue FROM campagne_series WHERE id = ?').get(v.id)) as { finie_le: number | null; issue: string }
  assert.ok(ligne.finie_le !== null)
  assert.equal(ligne.issue, 'perdue')
  assert.equal((await lire(pia, '/api/expedition')).corps.expedition, null, 'plus d’expédition en route')
})

test('la loupe, achetée à l’échoppe, dit le siècle d’une question d’Histoire — et sa réponse ne mesure plus rien', async () => {
  const lou = await inscrireProfil(banc.url, 'loupe', 'Loupe')
  let v = await partirEt(lou, depart => {
    for (const e of etage(depart, 0)) enQuestionNoire(e)
    for (const e of etage(depart, 1)) enQuestionNoire(e)
    for (const e of etage(depart, 2)) enSorte(e, 'echoppe')
    for (const e of etage(depart, 3)) enQuestionNoire(e, 'Histoire')
    // Une graine où la première échoppe vend la loupe.
    for (let k = 0; k < 500; k++) {
      if (talismanDeLOffre(`loupe:${k}`, 0, [], true) === 'loupe') {
        depart.graine = `loupe:${k}`
        return
      }
    }
    throw new Error('aucune graine')
  })
  v = await avancer(lou, v, v.permises[0])
  v = (await repondre(lou, v, true)).expedition
  v = await avancer(lou, v, v.permises[0])
  v = (await repondre(lou, v, true)).expedition
  assert.equal(v.ecus, 2 * ECUS_DES_PISTES.noire)
  v = await avancer(lou, v, versUne(v, 'echoppe'))
  assert.equal(v.echoppe!.talisman, 'loupe')
  const achat = await geste(lou, v, { quoi: 'acheter', article: 'talisman' })
  assert.equal(achat.status, 200, achat.corps.error)
  v = achat.corps.expedition
  assert.deepEqual(v.talismans, ['loupe'])
  assert.equal(v.ecus, 2 * ECUS_DES_PISTES.noire - PRIX_DE_L_ECHOPPE.talisman)
  v = await avancer(lou, v, v.permises[0])
  assert.equal(v.question!.categorie, 'Histoire')
  assert.equal(v.question!.siecle, 'Le XVIIIe siècle', 'la loupe dit son siècle')
  await repondre(lou, v, true)
  const ligne = base(db => db.prepare('SELECT joker FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, v.question!.index)) as { joker: string | null }
  assert.equal(ligne.joker, 'loupe', 'aidée : ni la mesure, ni le savoir ne la comptent')
})

test('une expédition partie avant les écus se reprend sans eux', async () => {
  const ana = await inscrireProfil(banc.url, 'avant', 'Avant')
  const v = await partirEt(ana, depart => {
    depart.v = 3
  })
  assert.equal(v.ecus, undefined)
  assert.equal(v.talismans, undefined)
  const r = await geste(ana, v, { quoi: 'acheter', article: 'vie' })
  assert.equal(r.corps.error, 'Cette expédition n’a pas d’écus : recharge la page')
})

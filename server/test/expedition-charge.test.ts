// L'Expédition sur Turso : ce que chaque geste coûte à la base permanente.
//
// Le 17 octobre 2026 (« n'oublie pas le côté performance […] niveau
// requête »), une escale se jouait en trois allers-retours de suite —
// relire l'expédition, relire ce qu'il a vu, écrire —, une réponse en deux
// ou trois : 29 ms chacun sur une connexion gardée, 225 sur une connexion à
// rouvrir (la revue du 14 octobre 2026). L'expédition en route se garde en
// mémoire, ce qu'il a vu aussi, lu à son départ : une escale ne coûte plus
// que son écriture. Comme `campagne-charge.test.ts`, on compte les
// allers-retours sur le fichier `file:` qui tient lieu de Turso — chaque
// `execute` et chaque `batch` en est un.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { ProfileStore } from '../src/auth/profiles'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import type { VueDeLExpedition } from '../../shared/expedition'

ProfileStore.tirageEclat = () => false

/** Ce que la base permanente a servi pendant une mesure. */
const compte = { actif: false, appels: 0 }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.appels++
    return origine.apply(this, args)
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0 })
  try {
    const resultat = await travail()
    return { appels: compte.appels, resultat }
  } finally {
    compte.actif = false
  }
}

/** Une question d'essai de la catégorie et de la difficulté qu'on veut : 2 facile, 3 moyenne, 4 difficile. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `char${String(i).padStart(4, '0')}`,
    texte: `Question d'essai numéro ${i} d'une expédition qu'on chronomètre : laquelle est la bonne ?`,
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

/** Samedi 17 octobre 2026, 10 h à Paris : l'horloge ne bouge pas, rien ne se relit en fond pendant qu'on compte. */
const MAINTENANT = Date.UTC(2026, 9, 17, 8, 0)

let banc: Banc
let cookie: string

const poster = async (chemin: string, corps: unknown = {}) => {
  const r = await ecrire(banc.url, chemin, corps, cookie)
  return { status: r.status, corps: (await r.json()) as any }
}

/** Les bonnes réponses de sa partie, lues en base : la page ne les voit jamais avant la sienne. */
function bonnes(serie: string): number[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return (JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions) as { bonne: number }[]).map(
      q => q.bonne,
    )
  } finally {
    db.close()
  }
}

const sorteDe = (v: VueDeLExpedition, id: string) => v.carte!.escales.find(e => e.id === id)?.sorte

/**
 * Le pas suivant vers une question : une question ou une élite — la carte
 * tirée n'en a pas à chaque étage —, sinon tout sauf une source, qui relit
 * le carnet, et l'inconnu (l'étape 4), dont un piège sur la dernière vie
 * finirait l'expédition — et sa fin lit plus. Le premier étage n'a que des
 * questions.
 */
const versUneQuestion = (v: VueDeLExpedition) =>
  v.permises.find(id => sorteDe(v, id) === 'question') ??
  v.permises.find(id => sorteDe(v, id) === 'elite') ??
  v.permises.find(id => sorteDe(v, id) !== 'source' && sorteDe(v, id) !== 'inconnu') ??
  v.permises[0]

const avancer = (v: VueDeLExpedition, vers: string) => poster(`/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers } })

/** Jusqu'à la prochaine question qui attend, sans rien compter : une offre laissée, une vie au campement, des pas vers des questions. */
async function jusquAUneQuestion(v: VueDeLExpedition): Promise<VueDeLExpedition> {
  for (let pas = 0; pas < 20 && !v.question; pas++) {
    const geste = v.offre ? { quoi: 'prendre', jokers: [] } : v.campement ? { quoi: 'camper' } : { quoi: 'avancer', vers: versUneQuestion(v) }
    const r = await poster(`/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste })
    assert.equal(r.status, 200, r.corps.error)
    v = r.corps.expedition
  }
  assert.ok(v.question, 'une question attend')
  return v
}

const repondre = (v: VueDeLExpedition, juste: boolean) => {
  const bonne = bonnes(v.id)[v.question!.index]
  return poster(`/api/expedition/${v.id}/reponse`, { position: v.question!.index, choix: juste ? bonne : (bonne + 1) % 4 })
}

/** Celle qu'un essai raté aurait laissée en route s'abandonne : chaque essai part d'une expédition neuve. */
async function laisserLaPlace() {
  const page = (await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: cookie } })).json()) as { expedition: VueDeLExpedition | null }
  if (page.expedition) assert.equal((await poster(`/api/expedition/${page.expedition.id}/abandon`)).status, 200)
}

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, horlogeDuJour: () => MAINTENANT })
  cookie = await inscrireProfil(banc.url, 'arpenteuse', 'Arpenteuse')
  // Une première expédition, jouée un pas puis abandonnée : la base, la
  // mesure des difficultés et le modèle du savoir se lisent une fois pour
  // tout le serveur — ce n'est pas ce qu'on compte.
  const v = (await poster('/api/expedition')).corps as VueDeLExpedition
  const a = (await avancer(v, versUneQuestion(v))).corps.expedition as VueDeLExpedition
  const r = (await repondre(a, true)).corps.expedition as VueDeLExpedition
  assert.equal((await poster(`/api/expedition/${r.id}/abandon`)).status, 200)
  await patienter(500)
})

after(() => banc.close())

test('partir, avancer, répondre : chaque geste ne coûte que son écriture', async () => {
  await laisserLaPlace()
  const depart = await mesurer(() => poster('/api/expedition'))
  assert.equal(depart.resultat.status, 200, depart.resultat.corps.error)
  // Ses deux vérifications et ce qu'il a vu d'une lecture, son départ d'une écriture.
  assert.equal(depart.appels, 2, `${depart.appels} allers-retours pour partir`)
  const v = depart.resultat.corps as VueDeLExpedition

  // L'expédition en mémoire, ce qu'il a vu lu au départ : la question se tire sans rien relire.
  const escale = await mesurer(() => avancer(v, versUneQuestion(v)))
  assert.equal(escale.resultat.status, 200, escale.resultat.corps.error)
  assert.equal(escale.appels, 1, `${escale.appels} allers-retours pour une escale`)
  const a = escale.resultat.corps.expedition as VueDeLExpedition
  assert.ok(a.question, 'sa question attend')

  // Une mauvaise réponse : son écriture seule.
  const fausse = await mesurer(() => repondre(a, false))
  assert.equal(fausse.resultat.corps.juste, false)
  assert.equal(fausse.appels, 1, `${fausse.appels} allers-retours pour une mauvaise réponse`)

  // Une bonne : son écriture, puis sa ligne d'expérience, comme en série.
  const suite = await jusquAUneQuestion(fausse.resultat.corps.expedition)
  const juste = await mesurer(() => repondre(suite, true))
  assert.equal(juste.resultat.corps.juste, true)
  assert.equal(juste.appels, 2, `${juste.appels} allers-retours pour une bonne réponse`)

  // Un joker joué sur la question qui attend : son geste seul, même s'il en tire une autre. La main
  // se remplit d'une question à l'autre — et un joker qui efface ne se joue pas sur un vrai ou faux.
  // Pas sur une source : Échange y reprendrait une question du carnet, qu'il relit.
  const jouableIci = (x: VueDeLExpedition) => sorteDe(x, x.question!.escale) !== 'source' && x.jokers!.main.some(j => !x.jokers!.refus[j])
  let d = await jusquAUneQuestion(juste.resultat.corps.expedition)
  for (let pas = 0; pas < 12 && !jouableIci(d); pas++) d = await jusquAUneQuestion((await repondre(d, true)).corps.expedition)
  const jouable = d.jokers!.main.find(j => !d.jokers!.refus[j])
  assert.ok(jouable, `un joker se joue sur sa question (${d.jokers!.main.join(', ')})`)
  const joker = await mesurer(() => poster(`/api/expedition/${d.id}/geste`, { rang: d.rang + 1, geste: { quoi: 'jouer', joker: jouable, position: d.question!.index } }))
  assert.equal(joker.resultat.status, 200, joker.resultat.corps.error)
  assert.equal(joker.appels, 1, `${joker.appels} allers-retours pour jouer ${jouable}`)

  assert.equal((await poster(`/api/expedition/${d.id}/abandon`)).status, 200)
})

test('une réponse ailleurs dans la campagne : la question suivante relit ce qu’il a vu', async () => {
  await laisserLaPlace()
  const v = (await poster('/api/expedition')).corps as VueDeLExpedition
  // Une question de série, entre deux escales : vue ailleurs, elle doit compter pour l'expédition.
  const serie = (await poster('/api/campagne/serie')).corps
  assert.equal((await poster(`/api/campagne/serie/${serie.id}/reponse`, { index: 0, choix: bonnes(serie.id)[0] })).status, 200)
  const escale = await mesurer(() => avancer(v, versUneQuestion(v)))
  assert.equal(escale.resultat.status, 200, escale.resultat.corps.error)
  assert.equal(escale.appels, 2, `${escale.appels} allers-retours : ce qu'il a vu se relit, puis l'escale s'écrit`)
  // Puis elle ne coûte de nouveau que son écriture — une source, qui relit le carnet, un aller-retour de plus.
  const a = (await repondre(escale.resultat.corps.expedition, true)).corps.expedition as VueDeLExpedition
  const vers = versUneQuestion(a)
  const suivante = await mesurer(() => avancer(a, vers))
  assert.equal(suivante.resultat.status, 200, suivante.resultat.corps.error)
  assert.equal(suivante.appels, sorteDe(a, vers) === 'source' ? 2 : 1, `${suivante.appels} allers-retours pour l'escale d'après (${sorteDe(a, vers)})`)
  assert.equal((await poster(`/api/expedition/${a.id}/abandon`)).status, 200)
})

test('une écriture ratée : rien de ce qui a raté ne reste en mémoire', async () => {
  await laisserLaPlace()
  const v = (await poster('/api/expedition')).corps as VueDeLExpedition
  const vers = versUneQuestion(v)
  const armer = (sql: string) => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      db.exec(sql)
    } finally {
      db.close()
    }
  }
  armer(`CREATE TRIGGER panne_geste BEFORE INSERT ON expedition_gestes BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`)
  try {
    const rate = await avancer(v, vers)
    assert.equal(rate.status, 500, 'la base refuse : le geste échoue')
  } finally {
    armer('DROP TRIGGER panne_geste')
  }
  // Le même geste, au même rang : il passe, sur l'expédition telle que la base la dit — relue.
  const repris = await mesurer(() => avancer(v, vers))
  assert.equal(repris.resultat.status, 200, repris.resultat.corps.error)
  assert.equal(repris.appels, 3, `${repris.appels} allers-retours : l'expédition et ce qu'il a vu se relisent, puis le geste s'écrit`)
  const a = repris.resultat.corps.expedition as VueDeLExpedition
  assert.equal(a.rang, 1, 'un seul geste au journal')
  assert.equal(bonnes(a.id).length, 1, 'une seule question tirée')
  assert.equal((await poster(`/api/expedition/${a.id}/abandon`)).status, 200)
})

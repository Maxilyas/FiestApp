// Les Divins des duels : Nikê et Osiris, qui demandent de gagner, et Ariane,
// qui ne demande qu'un fil — trois des douze venus le 21 novembre 2026,
// quand les Divins ont quitté les soirées pour les modes qu'on joue seul.
//
// Leurs règles vivent dans `core/divins.ts`, en fonctions pures ; ici, ce que
// le serveur en fait, par ses routes, sur un serveur jetable. Trois portes à
// tenir. Qui joue un duel classé en second le finit par sa dernière réponse :
// s'il gagne, sa fin le juge et l'annonce. Qui l'a lancé a joué sans savoir :
// sa victoire se juge quand il ouvre la page de son duel, une fois. Et le dé,
// contre Automate, se juge à sa fin comme un duel gagné — sauf pour Nikê, qui
// veut quelqu'un en face. Une défaite, une égalité, un défi entre amis
// d'avant ne font rien descendre de ce qui demande une victoire.
//
// Descendu, un Divin ne redescend pas : sa condition tenue le reste, et
// chaque duel d'après l'aurait annoncé de nouveau. Et un duel que sa semaine
// ferme compte comme un duel joué : ce qu'il a fait tenir ne se perd pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { DUREE_D_UN_DUEL_MS, VIES } from '../../shared/campagne'
import { ProfileStore, cleDeSerie } from '../src/auth/profiles'
import { CampagneStore } from '../src/core/campagne'

// Un Éclat tiré au hasard ferait tomber un palier : rien ici n'en dépend.
ProfileStore.tirageEclat = () => false

/** Mardi 6 octobre 2026, 10 h à Paris (UTC+2). */
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
// Cent vingt questions d'une seule catégorie : un duel en tire soixante, de quoi jouer trente et une bonnes réponses et trois fautes.
const BASE = baseDEssai(120)

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

interface Joueur {
  cookie: string
  id: string
}

async function inscrire(banc: Banc, login: string, nom: string, avatar: string): Promise<Joueur> {
  const cookie = await inscrireProfil(banc.url, login, nom, avatar)
  return { cookie, id: base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id) }
}

/** Ses Divins rangés, et sous quelle partie : une ligne chacun, dans l'ordre où ils sont descendus. */
const divinsRanges = (banc: Banc, joueur: Joueur) =>
  base(banc, db =>
    (db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'dv:%' ORDER BY created_at, badge`).all(joueur.id) as {
      badge: string
      soiree_id: string
    }[]).map(r => `${r.badge} sous ${r.soiree_id}`),
  )

const cles = (corps: any): string[] => (corps.divins ?? []).map((d: any) => d.key)
const justes = (n: number): boolean[] => Array<boolean>(n).fill(true)
const fautes = (n: number): boolean[] => Array<boolean>(n).fill(false)

/**
 * Joue une tentative, réponse après réponse : `plan` dit, dans l'ordre, celles
 * qu'il trouve. Il doit la mener à sa fin, pas plus loin — un plan trop court
 * ou trop long est une erreur de l'épreuve, pas du serveur. Et rien ne
 * s'annonce avant la dernière réponse : un Divin qui dépend de la victoire
 * dirait, en route, le score d'en face (règle `duels.md`). Rend sa fin — ou,
 * `enRoute`, sa dernière réponse : il pose le téléphone là, la partie pas finie.
 */
async function jouer(banc: Banc, joueur: Joueur, serie: string, plan: readonly boolean[], { enRoute = false } = {}): Promise<any> {
  const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  assert.ok(qs.length >= plan.length, `${qs.length} questions pour un plan de ${plan.length}`)
  let derniere: any = null
  for (let i = 0; i < plan.length; i++) {
    assert.ok(!derniere?.finie, `la partie a fini à la réponse ${i}, avant le bout de son plan (${plan.length})`)
    const choix = plan[i] ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length
    const r = await poster(banc, joueur.cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    assert.equal(r.corps.juste, plan[i], `la réponse ${i}`)
    if (!r.corps.finie) assert.equal(r.corps.divins, undefined, `rien ne s’annonce avant la fin (réponse ${i})`)
    derniere = r.corps
  }
  assert.equal(derniere?.finie, !enRoute, enRoute ? 'le plan laisse la partie en route' : 'le plan mène la partie à sa fin')
  // Un Divin s'annonce à part : jamais parmi les trophées, où il se lirait comme un haut fait de plus.
  assert.ok(!(derniere.recompenses ?? []).some((x: any) => String(x.key).startsWith('dv:')), 'un Divin n’est pas un trophée')
  return derniere
}

interface Partie {
  /** Sa série : c'est sous elle que se range ce qui descend. */
  serie: string
  /** Sa dernière réponse. */
  fin: any
}

/** La tentative d'un duel contre quelqu'un, et le code de ce duel : l'autre le relève, sa page s'ouvre par lui. */
interface Tentative extends Partie {
  code: string
}

/** Un duel classé : `lanceur` défie `defie` et joue sa tentative jusqu'au bout — il joue le premier, sans rien à battre. */
async function lancer(banc: Banc, lanceur: Joueur, defie: Joueur, plan: readonly boolean[]): Promise<Tentative> {
  const d = await poster(banc, lanceur.cookie, '/api/campagne/duel', { adversaire: defie.id })
  assert.equal(d.status, 200, d.corps.error)
  return { code: d.corps.code, serie: d.corps.serie.id, fin: await jouer(banc, lanceur, d.corps.serie.id, plan) }
}

/** Celui qu'on a défié relève le duel : sa dernière réponse le finit des deux côtés — sauf s'il le laisse `enRoute`. */
async function relever(banc: Banc, defie: Joueur, code: string, plan: readonly boolean[], options?: { enRoute?: boolean }): Promise<Tentative> {
  const t = await poster(banc, defie.cookie, `/api/campagne/duel/${code}`)
  assert.equal(t.status, 200, t.corps.error)
  return { code, serie: t.corps.id, fin: await jouer(banc, defie, t.corps.id, plan, options) }
}

const pageDuDuel = async (banc: Banc, joueur: Joueur, code: string) => {
  const r = await lire(banc, joueur.cookie, `/api/campagne/duel/${code}`)
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/**
 * Le temps d'une épreuve, Automate fait le score qu'on lui dit, puis ses trois
 * fautes : au hasard, on ne saurait pas d'avance à quelle réponse le dé se gagne.
 */
async function contreAutomate<T>(epreuve: (automate: { justes: number }) => Promise<T>): Promise<T> {
  const avant = CampagneStore.reponsesDAutomate
  const automate = { justes: 0 }
  CampagneStore.reponsesDAutomate = () => [...justes(automate.justes), ...fautes(VIES)]
  try {
    return await epreuve(automate)
  } finally {
    CampagneStore.reponsesDAutomate = avant
  }
}

/** Lance le dé et joue le duel contre Automate jusqu'à sa fin. */
async function jouerLeDe(banc: Banc, joueur: Joueur, plan: readonly boolean[]): Promise<Partie> {
  const r = await poster(banc, joueur.cookie, '/api/campagne/rencontre')
  assert.equal(r.status, 200, r.corps.error)
  return { serie: r.corps.serie.id, fin: await jouer(banc, joueur, r.corps.serie.id, plan) }
}

/**
 * `n` bonnes réponses, coupées d'une faute après la douzième : jamais
 * vingt-cinq d'affilée. Ariane ne demande pas de gagner — sans cette faute,
 * elle descendrait sur chaque tentative de l'épreuve de Nikê.
 */
const sansFil = (n: number): boolean[] => [...justes(12), false, ...justes(n - 12)]
/** La même, menée à sa troisième faute : la tentative de qui joue le premier, ou de qui ne dépasse pas le score d'en face. */
const jusquAuBout = (n: number): boolean[] => [...sansFil(n), ...fautes(VIES - 1)]

// ── Nikê ────────────────────────────────────────────────────────────────────

test('Nikê descend sur un duel classé gagné avec trente bonnes réponses — ni à vingt-neuf, ni perdu, ni égal, ni au dé', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrire(banc, 'alice', 'Alice', '🦊')
    const bob = await inscrire(banc, 'bob', 'Bob', '🐻')
    // Tous les refus d'abord, sur le même Bob : il n'a encore rien, chacun aurait pu la lui donner.

    // Gagné, mais à vingt-neuf : sa vingt-neuvième dépasse les vingt-huit d'Alice, le duel finit là.
    const court = await lancer(banc, alice, bob, jusquAuBout(28))
    assert.deepEqual([court.fin.justes, cles(court.fin)], [28, []])
    const a29 = await relever(banc, bob, court.code, sansFil(29))
    assert.deepEqual([a29.fin.justes, a29.fin.contre.justes, cles(a29.fin)], [29, 28, []])

    // Trente, mais perdu : Alice en avait trente et une.
    horloge.t += 60_000
    const perdu = await lancer(banc, alice, bob, jusquAuBout(31))
    assert.deepEqual([perdu.fin.justes, cles(perdu.fin)], [31, []], 'qui joue le premier ne sait pas encore qu’il gagne')
    const a30Perdu = await relever(banc, bob, perdu.code, jusquAuBout(30))
    assert.deepEqual([a30Perdu.fin.justes, a30Perdu.fin.contre.justes, cles(a30Perdu.fin)], [30, 31, []])

    // Trente partout : une égalité n'est pas une victoire — ni pour lui, ni pour elle quand elle ouvre la page du duel.
    horloge.t += 60_000
    const egal = await lancer(banc, alice, bob, jusquAuBout(30))
    const a30Egal = await relever(banc, bob, egal.code, jusquAuBout(30))
    assert.deepEqual([a30Egal.fin.justes, a30Egal.fin.contre.justes, cles(a30Egal.fin)], [30, 30, []])
    const pageEgale = await pageDuDuel(banc, alice, egal.code)
    assert.deepEqual([pageEgale.nouveau, pageEgale.aBattre, cles(pageEgale)], [true, 30, []])
    assert.deepEqual(divinsRanges(banc, alice), [])

    // Trente au dé, gagné contre un Automate à vingt-neuf : Nikê veut quelqu'un en face.
    horloge.t += 60_000
    await contreAutomate(async automate => {
      automate.justes = 29
      const de = await jouerLeDe(banc, bob, sansFil(30))
      assert.deepEqual([de.fin.justes, de.fin.rencontre.enTout, cles(de.fin)], [30, 29, []])
    })
    assert.deepEqual(divinsRanges(banc, bob), [], 'aucun de ces quatre duels ne lui a rien donné')

    // Et le duel classé gagné à trente : elle descend, sur le vainqueur seul, avec son récit, sous sa tentative.
    horloge.t += 60_000
    const juste = await lancer(banc, alice, bob, jusquAuBout(29))
    const gagne = await relever(banc, bob, juste.code, sansFil(30))
    assert.deepEqual([gagne.fin.justes, gagne.fin.contre.justes], [30, 29])
    assert.deepEqual(cles(gagne.fin), ['dv:nike'])
    assert.ok(gagne.fin.divins[0].legende.length > 0 && gagne.fin.divins[0].ton === 'eclat', 'son récit, à lui seul')
    assert.deepEqual(divinsRanges(banc, bob), [`dv:nike sous ${cleDeSerie(gagne.serie)}`])
    // Alice a perdu celui-ci : sa page ne lui annonce rien.
    assert.deepEqual(cles(await pageDuDuel(banc, alice, juste.code)), [])
    assert.deepEqual(divinsRanges(banc, alice), [])

    // Mais elle avait gagné le deuxième, à trente et une, sans le savoir : elle l'apprend en ouvrant sa page, et Nikê
    // descend là, sous sa tentative de ce duel-là.
    const sienne = await pageDuDuel(banc, alice, perdu.code)
    assert.deepEqual([sienne.nouveau, sienne.aBattre, cles(sienne)], [true, 30, ['dv:nike']])
    assert.ok(sienne.divins[0].legende.length > 0 && sienne.divins[0].ton === 'eclat')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:nike sous ${cleDeSerie(perdu.serie)}`])
  }))

// ── Osiris ──────────────────────────────────────────────────────────────────

test('Osiris descend sur un duel gagné après deux fautes pour commencer, classé comme au dé — pas pour une seule, ni pour deux fautes plus tard, ni perdu', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrire(banc, 'alice', 'Alice', '🦊')
    const bob = await inscrire(banc, 'bob', 'Bob', '🐻')
    const cleo = await inscrire(banc, 'cleo', 'Cléo', '🐙')
    const dede = await inscrire(banc, 'dede', 'Dédé', '🐸')
    /** Alice défie quelqu'un et s'arrête à `n` bonnes réponses, ses trois fautes à la fin. */
    const defiDAlice = (qui: Joueur, n: number) => lancer(banc, alice, qui, [...justes(n), ...fautes(VIES)])

    // Classé : Bob rate ses deux premières, puis en trouve deux — une de plus qu'Alice, le duel est gagné.
    const contreBob = await defiDAlice(bob, 1)
    // Avant de jouer, sa page ne dit rien — ni score, ni Divin.
    const avantDeJouer = await pageDuDuel(banc, bob, contreBob.code)
    assert.deepEqual([avantDeJouer.aBattre, avantDeJouer.divins], [undefined, undefined])
    const revenu = await relever(banc, bob, contreBob.code, [false, false, true, true])
    assert.deepEqual([revenu.fin.justes, revenu.fin.vies, revenu.fin.contre.justes], [2, 1, 1])
    assert.deepEqual(cles(revenu.fin), ['dv:osiris'])
    assert.ok(revenu.fin.divins[0].legende.length > 0 && revenu.fin.divins[0].ton === 'eclat', 'son récit, à lui seul')
    assert.deepEqual(divinsRanges(banc, bob), [`dv:osiris sous ${cleDeSerie(revenu.serie)}`])
    // Alice a perdu : rien pour elle, pas même en ouvrant la page du duel.
    assert.deepEqual(cles(await pageDuDuel(banc, alice, contreBob.code)), [])

    // Cléo n'a raté que la première ; Dédé a fait deux fautes, mais pas pour commencer : gagné, et rien.
    horloge.t += 60_000
    const uneFaute = await relever(banc, cleo, (await defiDAlice(cleo, 1)).code, [false, true, true])
    assert.deepEqual([uneFaute.fin.justes, uneFaute.fin.contre.justes, cles(uneFaute.fin)], [2, 1, []])
    const plusTard = await relever(banc, dede, (await defiDAlice(dede, 1)).code, [true, false, false, true])
    assert.deepEqual([plusTard.fin.justes, plusTard.fin.contre.justes, cles(plusTard.fin)], [2, 1, []])

    // Deux fautes pour commencer, mais le duel perdu (Cléo), ou égal (Dédé) : rien.
    horloge.t += 60_000
    const gagneParAlice = await defiDAlice(cleo, 5)
    const perdu = await relever(banc, cleo, gagneParAlice.code, [false, false, true, true, false])
    assert.deepEqual([perdu.fin.justes, perdu.fin.contre.justes, cles(perdu.fin)], [2, 5, []])
    const egal = await relever(banc, dede, (await defiDAlice(dede, 2)).code, [false, false, true, true, false])
    assert.deepEqual([egal.fin.justes, egal.fin.contre.justes, cles(egal.fin)], [2, 2, []])

    // Un défi entre amis d'avant — sans adversaire, amical : personne n'y « gagne » un duel, même en tête de son classement.
    horloge.t += 60_000
    const amical = await poster(banc, alice.cookie, '/api/campagne/duel')
    assert.equal(amical.status, 200, amical.corps.error)
    await jouer(banc, alice, amical.corps.serie.id, [true, ...fautes(VIES)])
    const entreAmis = await relever(banc, dede, amical.corps.code, [false, false, true, true, false])
    assert.deepEqual([entreAmis.fin.justes, entreAmis.fin.defi, cles(entreAmis.fin)], [2, { rang: 1, joueurs: 2 }, []])
    assert.deepEqual(divinsRanges(banc, cleo), [])
    assert.deepEqual(divinsRanges(banc, dede), [])

    // Au dé : Dédé ne rate que la première, puis perd après deux fautes pour commencer — rien. Cléo gagne revenue de
    // deux fautes : il descend, sous sa rencontre.
    horloge.t += 60_000
    await contreAutomate(async automate => {
      automate.justes = 1
      const uneSeule = await jouerLeDe(banc, dede, [false, true, true])
      assert.deepEqual([uneSeule.fin.justes, uneSeule.fin.rencontre.enTout, cles(uneSeule.fin)], [2, 1, []])
      automate.justes = 5
      const battu = await jouerLeDe(banc, dede, [false, false, true, false])
      assert.deepEqual([battu.fin.justes, battu.fin.rencontre.enTout, cles(battu.fin)], [1, 5, []])
      assert.deepEqual(divinsRanges(banc, dede), [])

      automate.justes = 1
      const auDe = await jouerLeDe(banc, cleo, [false, false, true, true])
      assert.deepEqual([auDe.fin.justes, auDe.fin.rencontre.enTout], [2, 1])
      assert.deepEqual(cles(auDe.fin), ['dv:osiris'])
      assert.ok(auDe.fin.divins[0].legende.length > 0 && auDe.fin.divins[0].ton === 'eclat')
      assert.deepEqual(divinsRanges(banc, cleo), [`dv:osiris sous ${cleDeSerie(auDe.serie)}`])
    })
    // Alice n'a gagné qu'un de ses duels, celui que Cléo a perdu, et ses fautes y étaient ses dernières : sa page
    // se retourne sur sa victoire, sans lui.
    const pageDAlice = await pageDuDuel(banc, alice, gagneParAlice.code)
    assert.deepEqual([pageDAlice.nouveau, pageDAlice.aBattre, cles(pageDAlice)], [true, 2, []])
    assert.deepEqual(divinsRanges(banc, alice), [])
  }))

// ── Qui a lancé le duel l'apprend sur sa page ───────────────────────────────

test('qui a lancé le duel apprend sa victoire en ouvrant sa page : le Divin descend là, une fois, sous sa tentative — jamais sur le perdant qui l’a fini', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrire(banc, 'alice', 'Alice', '🦊')
    const bob = await inscrire(banc, 'bob', 'Bob', '🐻')
    const cleo = await inscrire(banc, 'cleo', 'Cléo', '🐙')
    const dede = await inscrire(banc, 'dede', 'Dédé', '🐸')

    // Alice rate ses deux premières, puis en trouve quatre : sa fin ne sait pas si elle gagnera, et ne dit rien.
    const lance = await lancer(banc, alice, bob, [false, false, ...justes(4), false])
    assert.deepEqual([lance.fin.justes, lance.fin.classe, cles(lance.fin)], [4, true, []])
    // Tant que Bob n'a pas joué, sa page non plus.
    const enAttente = await pageDuDuel(banc, alice, lance.code)
    assert.deepEqual([enAttente.nouveau, enAttente.aBattre, enAttente.divins], [undefined, undefined, undefined])

    // Bob le relève, rate lui aussi ses deux premières, et fait moins bien. C'est sa réponse qui finit le duel : rien
    // ne descend sur lui — il a perdu —, ni sur elle tant qu'elle ne l'a pas appris.
    horloge.t += 60_000
    const releve = await relever(banc, bob, lance.code, [false, false, true, true, false])
    assert.deepEqual([releve.fin.justes, releve.fin.contre.justes, cles(releve.fin)], [2, 4, []])
    assert.deepEqual(cles(await pageDuDuel(banc, bob, lance.code)), [])
    assert.deepEqual(divinsRanges(banc, bob), [])
    assert.deepEqual(divinsRanges(banc, alice), [], 'pas avant qu’elle ouvre sa page')

    // Elle ouvre la page de son duel : la carte du verdict se retourne, et Osiris descend avec elle.
    horloge.t += 60_000
    const page = await pageDuDuel(banc, alice, lance.code)
    assert.deepEqual([page.nouveau, page.aBattre], [true, 2])
    assert.deepEqual(cles(page), ['dv:osiris'])
    assert.ok(page.divins[0].legende.length > 0 && page.divins[0].ton === 'eclat', 'son récit, à elle seule')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:osiris sous ${cleDeSerie(lance.serie)}`])
    // Relue, la carte ne se retourne plus, mais la page de ce duel redit ce qu'il lui a valu : jugé à la seule première
    // lecture, il tenait à une réponse — perdue en route, il était rangé sans avoir jamais été annoncé. Une seule ligne
    // en base, et rien sur la page de celui qui l'a perdu.
    const relue = await pageDuDuel(banc, alice, lance.code)
    assert.deepEqual([relue.nouveau, cles(relue)], [undefined, ['dv:osiris']])
    assert.ok(relue.divins[0].legende.length > 0, 'avec son récit, encore')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:osiris sous ${cleDeSerie(lance.serie)}`])
    assert.deepEqual(cles(await pageDuDuel(banc, bob, lance.code)), [])
    assert.deepEqual(divinsRanges(banc, bob), [])

    // Ses réponses se lisent dans l'ordre où elle les a données : Cléo gagne aussi, mais ses fautes sont ses trois
    // dernières — lues à l'envers, elles passeraient pour ses deux premières.
    horloge.t += 60_000
    const aLaFin = await lancer(banc, cleo, bob, [...justes(4), ...fautes(VIES)])
    await relever(banc, bob, aLaFin.code, [true, ...fautes(VIES)])
    const pageDeCleo = await pageDuDuel(banc, cleo, aLaFin.code)
    assert.deepEqual([pageDeCleo.nouveau, pageDeCleo.aBattre, cles(pageDeCleo)], [true, 1, []])
    // Dédé rate ses deux premières et perd ; un autre duel, à égalité : sa page s'ouvre sur un résultat, sans Divin.
    const battu = await lancer(banc, dede, bob, [false, false, true, false])
    await relever(banc, bob, battu.code, [true, true])
    const pageDuBattu = await pageDuDuel(banc, dede, battu.code)
    assert.deepEqual([pageDuBattu.nouveau, pageDuBattu.aBattre, cles(pageDuBattu)], [true, 2, []])
    horloge.t += 60_000
    const egal = await lancer(banc, dede, bob, [false, false, true, false])
    await relever(banc, bob, egal.code, [true, ...fautes(VIES)])
    const pageEgale = await pageDuDuel(banc, dede, egal.code)
    assert.deepEqual([pageEgale.nouveau, pageEgale.aBattre, cles(pageEgale)], [true, 1, []])
    assert.deepEqual(divinsRanges(banc, cleo), [])
    assert.deepEqual(divinsRanges(banc, dede), [])
    assert.deepEqual(divinsRanges(banc, bob), [], 'Bob a gagné un duel, sans une faute pour commencer')

    // Fermé au bout de sa semaine, un duel commencé des deux côtés compte sur ce qu'il a atteint (règle `duels.md`) :
    // Cléo a laissé le sien en route, Dédé l'a donc gagné, revenu de deux fautes. Tant qu'il est ouvert, sa page ne
    // lui dit rien — ni le score d'en face, ni ce qu'il vaudrait ; fermé, elle se retourne, et le Divin avec.
    horloge.t += 60_000
    const laisse = await lancer(banc, dede, cleo, [false, false, ...justes(3), false])
    await relever(banc, cleo, laisse.code, [true], { enRoute: true })
    const ouvert = await pageDuDuel(banc, dede, laisse.code)
    assert.deepEqual([ouvert.nouveau, ouvert.aBattre, ouvert.divins], [undefined, undefined, undefined])
    horloge.t += DUREE_D_UN_DUEL_MS
    assert.deepEqual(cles(await pageDuDuel(banc, cleo, laisse.code)), [])
    const ferme = await pageDuDuel(banc, dede, laisse.code)
    assert.deepEqual([ferme.minutesRestantes, ferme.nouveau, ferme.aBattre, cles(ferme)], [0, true, 1, ['dv:osiris']])
    assert.deepEqual(divinsRanges(banc, dede), [`dv:osiris sous ${cleDeSerie(laisse.serie)}`])
    assert.deepEqual(divinsRanges(banc, cleo), [])
  }))

// ── Ariane ──────────────────────────────────────────────────────────────────

test('Ariane descend sur vingt-cinq bonnes réponses d’affilée dans la tentative d’un duel, même perdu — pas sur vingt-quatre', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrire(banc, 'alice', 'Alice', '🦊')
    const bob = await inscrire(banc, 'bob', 'Bob', '🐻')
    const cleo = await inscrire(banc, 'cleo', 'Cléo', '🐙')

    // Alice : vingt-six bonnes réponses, mais son fil casse à la vingt-quatrième. Rien.
    const lance = await lancer(banc, alice, bob, [...justes(24), false, ...justes(2), false, false])
    assert.deepEqual([lance.fin.justes, cles(lance.fin)], [26, []])
    // Bob en trouve vingt-cinq d'affilée, puis perd ses trois vies : il perd le duel, et elle descend quand même.
    horloge.t += 60_000
    const releve = await relever(banc, bob, lance.code, [...justes(25), ...fautes(VIES)])
    assert.deepEqual([releve.fin.justes, releve.fin.contre.justes], [25, 26])
    assert.deepEqual(cles(releve.fin), ['dv:ariane'])
    assert.ok(releve.fin.divins[0].legende.length > 0 && releve.fin.divins[0].ton === 'eclat', 'son récit, à lui seul')
    assert.deepEqual(divinsRanges(banc, bob), [`dv:ariane sous ${cleDeSerie(releve.serie)}`])
    // Alice a gagné, et l'apprend sur sa page : sa victoire ne lui donne pas le fil qu'elle n'a pas tenu.
    assert.deepEqual(cles(await pageDuDuel(banc, alice, lance.code)), [])
    assert.deepEqual(divinsRanges(banc, alice), [])

    // Elle n'attend pas l'issue du duel : Cléo le lance, tient son fil après une première faute, et sa fin l'annonce
    // sans que personne l'ait encore relevé.
    horloge.t += 60_000
    const seule = await lancer(banc, cleo, bob, [false, ...justes(25), false, false])
    assert.deepEqual([seule.fin.justes, seule.fin.classe, cles(seule.fin)], [25, true, ['dv:ariane']])
    assert.deepEqual(divinsRanges(banc, cleo), [`dv:ariane sous ${cleDeSerie(seule.serie)}`])

    // Au dé aussi, et battue de même : Alice tient son fil, puis laisse à Automate ses trente bonnes réponses.
    horloge.t += 60_000
    await contreAutomate(async automate => {
      automate.justes = 30
      const de = await jouerLeDe(banc, alice, [...justes(25), ...fautes(VIES)])
      assert.deepEqual([de.fin.justes, de.fin.rencontre.enTout, cles(de.fin)], [25, 30, ['dv:ariane']])
      assert.deepEqual(divinsRanges(banc, alice), [`dv:ariane sous ${cleDeSerie(de.serie)}`])
    })
  }))

// ── Il ne redescend pas ─────────────────────────────────────────────────────

test('descendu, Osiris ne redescend pas : ni sur un autre duel gagné de même, ni au dé, ni sur la page d’un duel qu’on avait lancé', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrire(banc, 'alice', 'Alice', '🦊')
    const bob = await inscrire(banc, 'bob', 'Bob', '🐻')
    const revenir = [false, false, true, true]

    // Bob le gagne une première fois, en relevant le duel d'Alice.
    const premier = await relever(banc, bob, (await lancer(banc, alice, bob, [true, ...fautes(VIES)])).code, revenir)
    assert.deepEqual(cles(premier.fin), ['dv:osiris'])
    const rangeChezBob = [`dv:osiris sous ${cleDeSerie(premier.serie)}`]
    assert.deepEqual(divinsRanges(banc, bob), rangeChezBob)

    // Le lendemain, la revanche, gagnée de même : sa condition tient toujours, rien ne s'annonce, rien ne se range.
    horloge.t += 24 * 3_600_000
    const second = await relever(banc, bob, (await lancer(banc, alice, bob, [true, ...fautes(VIES)])).code, revenir)
    assert.deepEqual([second.fin.justes, second.fin.contre.justes, cles(second.fin)], [2, 1, []])
    // Au dé non plus.
    await contreAutomate(async automate => {
      automate.justes = 1
      const de = await jouerLeDe(banc, bob, revenir)
      assert.deepEqual([de.fin.justes, de.fin.rencontre.enTout, cles(de.fin)], [2, 1, []])
    })
    assert.deepEqual(divinsRanges(banc, bob), rangeChezBob)

    // Par l'autre porte : Alice lance deux duels, qu'elle gagne revenue de deux fautes. La page du premier le lui
    // annonce, et ne le range qu'une fois, même ouverte deux fois de front : c'est la base qui le garde, pas l'ordre
    // des lectures — la seconde le redit si la première l'a déjà rangé, sinon elle se tait. Celle du second duel se
    // retourne sans lui : il n'est rangé que sous le premier.
    horloge.t += 60_000
    const lances: Tentative[] = []
    for (let i = 0; i < 2; i++) {
      const lance = await lancer(banc, alice, bob, [false, false, ...justes(3), false])
      await relever(banc, bob, lance.code, [true, ...fautes(VIES)])
      lances.push(lance)
      horloge.t += 60_000
    }
    const deFront = await Promise.all([pageDuDuel(banc, alice, lances[0].code), pageDuDuel(banc, alice, lances[0].code)])
    const dits = deFront.flatMap(cles)
    assert.ok(dits.length >= 1 && dits.every(cle => cle === 'dv:osiris'), `l’une des deux lectures au moins l’annonce, et rien d’autre : ${dits.join(', ')}`)
    assert.deepEqual(divinsRanges(banc, alice), [`dv:osiris sous ${cleDeSerie(lances[0].serie)}`], 'une seule ligne')
    assert.deepEqual(cles(await pageDuDuel(banc, alice, lances[0].code)), ['dv:osiris'], 'et la page de ce duel le redit')
    const pageDApres = await pageDuDuel(banc, alice, lances[1].code)
    assert.deepEqual([pageDApres.nouveau, pageDApres.aBattre, cles(pageDApres)], [true, 1, []])
    assert.deepEqual(divinsRanges(banc, alice), [`dv:osiris sous ${cleDeSerie(lances[0].serie)}`])
    assert.deepEqual(divinsRanges(banc, bob), rangeChezBob)
  }))

// ── Ce que la fermeture arrête ──────────────────────────────────────────────

// Une tentative laissée en route n'a pas de dernière réponse pour la juger : c'est la fermeture du duel, au bout de sa
// semaine, qui l'arrête — et le duel compte alors, perdu, sur ce qu'elle avait atteint. Le défi de la semaine a son
// filet pour ce cas (`cloreLeDefi` range ce qu'une tentative laissée en route avait fait descendre). Le duel n'en
// avait pas quand cette épreuve a été écrite, le 21 novembre 2026 : `fermerLeDuel` arrêtait la tentative sans rien
// juger, et le fil tenu se perdait.
test('une tentative que la fermeture du duel arrête garde le fil qu’elle avait tenu : Ariane se range sous elle', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrire(banc, 'alice', 'Alice', '🦊')
    const bob = await inscrire(banc, 'bob', 'Bob', '🐻')
    // Alice en trouve vingt-six, sans fil. Bob relève, en trouve vingt-cinq d'affilée — pas de quoi la dépasser, sa
    // partie continue —, et pose son téléphone, ses trois vies en main.
    const lance = await lancer(banc, alice, bob, jusquAuBout(26))
    const laissee = await relever(banc, bob, lance.code, justes(25), { enRoute: true })
    assert.deepEqual([laissee.fin.justes, laissee.fin.vies], [25, VIES])
    assert.deepEqual(divinsRanges(banc, bob), [], 'en route, rien : sa partie n’est pas finie')

    // Une semaine passe. Le duel ferme, commencé des deux côtés : Bob l'a perdu, vingt-cinq à vingt-six. Chacun ouvre
    // sa page — la première lecture d'après la fermeture fige ce qui restait en route.
    horloge.t += DUREE_D_UN_DUEL_MS
    const pageDeBob = await pageDuDuel(banc, bob, lance.code)
    assert.deepEqual([pageDeBob.minutesRestantes, pageDeBob.aBattre, pageDeBob.tentative.finie], [0, 26, true])
    await pageDuDuel(banc, alice, lance.code)
    // Vingt-cinq d'affilée dans la tentative d'un duel, même perdu : elle est descendue, sous cette tentative.
    assert.deepEqual(divinsRanges(banc, bob), [`dv:ariane sous ${cleDeSerie(laissee.serie)}`])
    assert.deepEqual(divinsRanges(banc, alice), [])
  }))

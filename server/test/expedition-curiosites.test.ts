// Les curiosités (la version 12 du départ, le 19 octobre 2026 — l'étape 4 de
// « La question au centre », `retours/2026-10-19/les-curiosites.md`). Le
// testeur : « des trucs bonus sur le chemin qui te filent des récompenses
// cool » ; le propriétaire : le rébus à composer, cent plats écrits pour
// elles, la récompense au choix, une par acte. Le générateur, les rébus et
// les plats livrés, le pli et sa récompense, les routes, l'écran.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireLaBase } from '../src/core/baseCampagne'
import { NIVEAU_MAX, codexDuNiveau, niveauDeLaRegle } from '../../shared/codex'
import { VERSION_DES_COUPS_DE_POUCE, VERSION_DES_CURIOSITES, VERSION_DES_FAMILLES, VERSION_DU_DETAIL, carteDeRencontre } from '../../shared/rencontres'
import { gabaritDe } from '../../shared/lettres'
import { CURIOSITE_DES_L_ETAGE, PREFIXE_DU_REBUS, QUESTION_DU_REBUS, ceQueRapporteUneCuriosite, emojisDe, refusDuRebus, type Rebus } from '../../shared/curiosites'
import {
  GARDIEN,
  POIDS_DES_ESCALES_DES_RENCONTRES,
  POIDS_DES_FORMES_A_COMPOSER,
  carteDUnActe,
  refusDUneCarte,
  type CarteDUnActe,
  type DepartDExpedition,
  type VueDeLExpedition,
} from '../../shared/expedition'
import { Journal, carte, depart, pieces, rendre, rien, texte, type Composant } from './expedition-journal'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const V = VERSION_DES_CURIOSITES
const REBUS = JSON.parse(readFileSync(new URL('../content/curiosites/rebus.json', import.meta.url), 'utf8')) as Rebus[]
const PLATS = JSON.parse(readFileSync(new URL('../content/curiosites/plats.json', import.meta.url), 'utf8')) as { id: string; plat: string }[]

// ── Le générateur ───────────────────────────────────────────────────────────

test('la version 12 : une curiosité par acte, dès l’étage 2, tirée à part — aucune autre escale ne bouge', () => {
  let rebus = 0
  let poses = 0
  for (let i = 0; i < 600; i++) {
    const acte = i % 3
    const tirer = (curiosites: boolean) => carteDUnActe(`curiosite:${i}`, acte, [], undefined, POIDS_DES_ESCALES_DES_RENCONTRES, POIDS_DES_FORMES_A_COMPOSER, curiosites)
    const avant = tirer(false)
    const apres = tirer(true)
    assert.ok(!avant.escales.some(e => e.sorte === 'curiosite'), 'la version 11 n’en pose aucune')
    const changees = apres.escales.filter((e, k) => JSON.stringify(e) !== JSON.stringify(avant.escales[k]))
    if (!avant.escales.some(e => e.sorte === 'question' && e.etage >= CURIOSITE_DES_L_ETAGE)) {
      assert.equal(changees.length, 0, 'sans question à changer, pas de curiosité')
      continue
    }
    assert.equal(changees.length, 1, 'une seule escale change')
    const c = changees[0]
    const d = avant.escales.find(e => e.id === c.id)!
    assert.equal(d.sorte, 'question', 'une escale à question')
    assert.ok(c.etage >= CURIOSITE_DES_L_ETAGE, 'dès le deuxième étage')
    assert.equal(c.sorte, 'curiosite')
    assert.ok(c.curiosite === 'plat' || c.curiosite === 'rebus')
    assert.deepEqual([c.theme, c.forme, c.chance], [undefined, undefined, undefined], 'ni thème, ni forme, ni chance')
    assert.deepEqual([c.id, c.etage, c.colonne, c.suite], [d.id, d.etage, d.colonne, d.suite], 'sa place et ses liens')
    assert.deepEqual(tirer(true), apres, 'la même graine redonne la même')
    poses++
    if (c.curiosite === 'rebus') rebus++
  }
  assert.ok(poses > 590, `${poses} curiosités sur 600 actes`)
  assert.ok(Math.abs(rebus / poses - 0.5) < 0.06, `${rebus} rébus sur ${poses}`)
})

// ── Le contenu ──────────────────────────────────────────────────────────────

test('les rébus livrés : chacun se pose — des emojis d’avant Unicode 13, sans drapeau ni liant, une réponse qui se compose —, aucun ne se répète', () => {
  assert.ok(REBUS.length >= 100, `${REBUS.length} rébus`)
  for (const r of REBUS) assert.equal(refusDuRebus(r), null, r.id)
  assert.equal(new Set(REBUS.map(r => r.id)).size, REBUS.length, 'un identifiant chacun')
  assert.equal(new Set(REBUS.map(r => gabaritDe(r.reponse)!.lettres)).size, REBUS.length, 'une réponse chacun')
  for (const genre of Object.keys(QUESTION_DU_REBUS)) assert.ok(REBUS.some(r => r.genre === genre), `${genre} : sa question sert`)
  // Ce qui ne se pose pas, et pourquoi.
  const bon: Rebus = { id: 'essai', genre: 'mot', emojis: '🚪🔑', reponse: 'Porte-clés', lecture: 'Une porte et une clé : un porte-clés.' }
  assert.equal(refusDuRebus(bon), null)
  for (const [emojis, pourquoi] of [
    ['\u{1F1EB}\u{1F1F7}🥖', 'un drapeau : sous Windows 10, deux lettres'],
    ['👨\u{200D}🍳🍲', 'un liant'],
    ['👍\u{1F3FD}🍲', 'une couleur de peau'],
    ['\u{1FAE0}🍲', 'un emoji d’Unicode 14'],
    ['🚪 et 🔑', 'du texte'],
    ['🚪', 'un seul'],
    ['🚪🔑🚪🔑🚪', 'cinq'],
  ]) assert.notEqual(refusDuRebus({ ...bon, emojis }), null, pourquoi)
  for (const reponse of ['Le Seigneur des anneaux', 'Zoé', 'Apollo 11']) assert.notEqual(refusDuRebus({ ...bon, reponse }), null, reponse)
  assert.notEqual(refusDuRebus({ ...bon, genre: 'chanson' }), null)
  assert.notEqual(refusDuRebus({ ...bon, id: 'Avec Majuscule' }), null)
  assert.notEqual(refusDuRebus({ ...bon, lecture: '' }), null)
  assert.deepEqual(emojisDe('🦁👑'), ['🦁', '👑'])
  assert.deepEqual(emojisDe('⭐⚔️'), ['⭐', '⚔️'], 'la variante reste avec son emoji')
})

test('les plats livrés : chacun une question de cuisine de la base, à quatre choix, qui demande d’où vient un plat', () => {
  const parId = new Map(lireLaBase().questions.map(q => [q.id, q]))
  assert.ok(PLATS.length >= 150, `${PLATS.length} plats`)
  assert.equal(new Set(PLATS.map(p => p.id)).size, PLATS.length, 'chacun une fois')
  for (const p of PLATS) {
    const q = parId.get(p.id)
    assert.ok(q, `${p.plat} (${p.id}) : plus dans la base — retire-le de la liste, ou mets-y la question qui l’a remplacé`)
    assert.equal(q.meta.categorie, 'Cuisine', p.plat)
    assert.equal(q.reponses.length, 4, p.plat)
    assert.match(q.texte, /quel(le)? (pays|région|ville|île|État|province|archipel|canton|territoire)\b/, p.plat)
  }
  assert.equal(ceQueRapporteUneCuriosite(false, false), 'une carte rare')
  assert.equal(ceQueRapporteUneCuriosite(true, false), 'une carte rare ou une fiole')
  assert.equal(ceQueRapporteUneCuriosite(true, true), 'une carte rare, une fiole ou un talisman')
})

// ── Dans le pli ─────────────────────────────────────────────────────────────

/** Le plan des curiosités : une question au bas, puis une curiosité, une élite, une question, le campement, le gardien. */
function planDesCuriosites(sorte: 'plat' | 'rebus' = 'rebus'): CarteDUnActe {
  const c = carte()
  return { ...c, escales: c.escales.map(e => (e.id === 'e10' ? { id: 'e10', etage: 1, colonne: 0, sorte: 'curiosite' as const, curiosite: sorte, suite: ['e20'] } : e)) }
}

/** Un départ des curiosités, au niveau d'explorateur `niveau` : ses offres tirent dans tout son codex. */
const enV12 = (g: string, niveau = NIVEAU_MAX): DepartDExpedition =>
  depart(g, [], { v: V, codex: codexDuNiveau(niveau, [], [], V), cartes: [planDesCuriosites(), planDesCuriosites('plat'), planDesCuriosites()] })

/** Jusqu'à la curiosité de l'acte : l'adversaire du bas battu sans une faute, sa récompense laissée. */
function jusquALaCuriosite(d: DepartDExpedition, j = new Journal(d)): Journal {
  j.avancer('e00')
  j.gagner()
  j.prendreSiOfferte()
  j.avancer('e10')
  return j
}

test('dans le pli : une curiosité se répond sans adversaire ni cartes ; ratée, rien — ni courage, ni la série d’affilée', () => {
  const j = jusquALaCuriosite(enV12('curiosite:ratee'))
  const e = j.etat()
  assert.equal(e.rencontre, null, 'sans adversaire')
  assert.notEqual(e.enAttente, null, 'sa question attend')
  assert.ok(e.affilee > 0, 'une série d’affilée en cours')
  const carte = e.cycle!.main[0]
  assert.ok(carte, 'une carte en main')
  assert.equal(refusDUneCarte(j.depart, e, carte, j.questions), 'Une curiosité se répond sans cartes : garde-les pour les adversaires')
  const rate = j.repondre(false)
  assert.equal(rate.offre, null)
  assert.deepEqual([rate.courage, rate.affilee, rate.justes, rate.ecus], [e.courage, e.affilee, e.justes, e.ecus], 'rien de perdu')
  assert.equal(j.avancer('e20').rencontre?.sorte, 'elite', 'la route continue')
})

test('dans le pli : trouvée, sa récompense — des cartes rares, la fiole et le talisman à leur niveau ; une à prendre, laissée elle ne rapporte rien', () => {
  const fioles = niveauDeLaRegle('fioles', V)
  const talismans = niveauDeLaRegle('talismans', V)
  assert.deepEqual([fioles, talismans], [3, 4])
  for (const [niveau, attendu] of [
    [1, { fiole: false, talisman: false }],
    [fioles, { fiole: true, talisman: false }],
    [NIVEAU_MAX, { fiole: true, talisman: true }],
  ] as const) {
    const j = jusquALaCuriosite(enV12(`curiosite:offre:${niveau}`, niveau))
    const avant = j.etat()
    const e = j.repondre(true)
    assert.equal(e.justes, avant.justes + 1, `niveau ${niveau}`)
    assert.equal(e.affilee, avant.affilee, 'elle ne fait ni ne coupe la série d’affilée')
    const o = e.offre!
    assert.equal(o.curiosite, true)
    assert.equal(o.aPrendre, 1)
    assert.equal(o.coffre, undefined, 'laissée, pas d’écus')
    assert.deepEqual([!!o.fiole, !!o.talisman], [attendu.fiole, attendu.talisman], `niveau ${niveau}`)
    // Trois places : des cartes rares là où la fiole et le talisman n'ont pas la leur — au niveau 1, il n'en a que deux d'ouvertes.
    const places = 3 - (o.fiole ? 1 : 0) - (o.talisman ? 1 : 0)
    const rares = codexDuNiveau(niveau, [], [], V).cartes.filter(c => carteDeRencontre(c)?.rarete === 'rare')
    assert.equal(o.jokers.length, Math.min(places, rares.length), `niveau ${niveau}`)
    assert.ok(o.jokers.every(c => carteDeRencontre(c)?.rarete === 'rare'), o.jokers.join(', '))
    // Laissée : rien, ni écus. Une carte, la fiole ou le talisman pris : à lui.
    assert.equal(j.copie().prendre([]).ecus, e.ecus)
    assert.ok(j.copie().prendre([o.jokers[0]]).paquet.includes(o.jokers[0]))
    if (o.fiole) assert.deepEqual(j.copie().geste({ quoi: 'prendre', jokers: [], fiole: o.fiole }).fioles, [o.fiole])
    if (o.talisman) assert.ok(j.copie().geste({ quoi: 'prendre', jokers: [], talisman: o.talisman }).talismans.includes(o.talisman))
  }
})

test('dans le pli : son sac de fioles plein, la récompense offre une carte rare à la place', () => {
  const j = new Journal(enV12('curiosite:sac'))
  for (let acte = 0; acte < 3; acte++) {
    jusquALaCuriosite(j.depart, j)
    const o = j.repondre(true).offre!
    if (acte < 2) {
      assert.ok(o.fiole, `acte ${acte + 1} : une fiole`)
      j.geste({ quoi: 'prendre', jokers: [], fiole: o.fiole })
    } else {
      assert.equal(j.etat().fioles.length, 2)
      assert.equal(o.fiole, undefined, 'deux fioles portées : plus de place pour une troisième')
      assert.equal(o.jokers.length, 2, 'une carte à sa place')
      return
    }
    for (const vers of ['e20', 'e30']) {
      j.avancer(vers)
      j.gagner()
      j.prendreSiOfferte()
    }
    j.avancer('cg')
    j.geste({ quoi: 'camper' })
    j.avancer(GARDIEN)
    j.gagner()
    j.prendreSiOfferte()
  }
  assert.fail('l’acte 3 n’a pas été atteint')
})

// ── Par les routes ──────────────────────────────────────────────────────────

/** Une petite base, et quelques plats de la vraie : ceux de la liste qu'une curiosité tire. */
const PLATS_DE_LA_BASE = (() => {
  const ids = new Set(PLATS.slice(0, 12).map(p => p.id))
  return lireLaBase().questions.filter(q => ids.has(q.id))
})()
const BASE = new BaseDeLaCampagne([...baseDEssai(120, { categories: ['Histoire', 'Cuisine'] }).questions, ...PLATS_DE_LA_BASE])

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE, questionAuCentre: true })
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

/** Les questions telles que l'expédition les garde, bonne réponse comprise : ce que seul le serveur sait. */
const questionsDe = (id: string): { id: string; texte: string; reponses: string[]; bonne: number; rebus?: string }[] =>
  base(db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions))

/**
 * Partir en version 12, puis récrire le départ gardé — un rébus à chaque
 * escale du premier étage, un plat à chaque escale du deuxième, un rébus au
 * troisième — et redémarrer le serveur pour qu'il le relise.
 */
async function partirAuxCuriosites(cookie: string): Promise<VueDeLExpedition> {
  const r = await poster(cookie, '/api/expedition', { rencontres: true, questionAuCentre: true })
  assert.equal(r.status, 200, r.corps.error)
  const v = r.corps as VueDeLExpedition
  base(db => {
    const d = JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(v.id) as { expedition: string }).expedition) as DepartDExpedition
    for (const e of d.cartes[0].escales) {
      if (e.etage > 2) continue
      for (const cle of ['theme', 'forme', 'chance'] as const) delete e[cle]
      Object.assign(e, { sorte: 'curiosite', curiosite: e.etage === 1 ? 'plat' : 'rebus' })
    }
    db.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), v.id)
  }, true)
  await banc.redemarrer()
  return (await lire(cookie, '/api/expedition')).corps.expedition
}

const geste = (cookie: string, v: VueDeLExpedition, g: unknown) => poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
const page = (): Promise<{ CarteDeLActe: Composant; Escale: Composant }> => import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)

test('par les routes et à l’écran : un rébus, ses emojis et ses cases sans sa réponse ; un plat de la liste ; trouvée, la récompense ; un rébus ne mesure rien, n’entre pas au carnet, ne se signale pas', async () => {
  const c = await inscrireProfil(banc.url, 'curieux', 'Curieux')
  let v = await partirAuxCuriosites(c)
  // La préproduction part au détail (v15), qui garde la frise et les curiosités.
  assert.equal(v.cartes!.v, VERSION_DU_DETAIL)
  const { CarteDeLActe, Escale } = await page()
  // Sur le plan : « Curiosité », son nom, ce qu'elle rapporte.
  const plan = texte(await rendre(CarteDeLActe, { vue: v, carte: v.carte!, busy: false, erreur: '', onAvancer: rien, onAbandonner: rien, onPartir: rien, onJouer: rien }))
  assert.match(plan, /Curiosité/)
  assert.match(plan, /Le rébus/)
  // Le premier rébus : ses emojis et ses cases, jamais sa réponse (invariant 1).
  v = (await geste(c, v, { quoi: 'avancer', vers: v.carte!.depart[0] })).corps.expedition
  const q = v.question!
  const gardee = questionsDe(v.id)[q.index]
  assert.ok(gardee.id.startsWith(PREFIXE_DU_REBUS), gardee.id)
  const rebus = REBUS.find(r => PREFIXE_DU_REBUS + r.id === gardee.id)!
  assert.equal(q.rebus, rebus.emojis)
  assert.equal(q.texte, QUESTION_DU_REBUS[rebus.genre])
  assert.deepEqual(q.reponses, [])
  assert.equal(q.forme, 'lettres')
  assert.deepEqual(q.composer!.mots, gabaritDe(rebus.reponse)!.mots)
  assert.ok(!JSON.stringify(v).includes(JSON.stringify(rebus.reponse)), 'sa réponse ne part pas')
  assert.ok(!JSON.stringify(v).includes(rebus.lecture), 'ni comment il se lit')
  assert.equal(v.rencontre, undefined, 'sans adversaire')
  // À l'écran : son en-tête, ce qu'elle rapporte, ses emojis en grand, une case chacun.
  const html = await rendre(Escale, { vue: v, avant: null, question: q, reponse: null, choix: null, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien })
  assert.match(texte(html), /Curiosité · Le rébus/)
  assert.match(texte(html), /Une curiosité : trouvée, une carte rare au choix ; ratée, rien de perdu\./)
  assert.match(html, new RegExp(`<p class="exp-rebus">${emojisDe(rebus.emojis)!.map(x => `<span>${x}</span>`).join('')}</p>`))
  // Raté : rien de perdu ; ce qu'il fallait composer ; la réponse garde sa forme — elle ne mesure rien.
  const g = gabaritDe(rebus.reponse)!
  const fausse = g.lettres[0] === 'Z' ? `Y${g.lettres.slice(1)}` : `Z${g.lettres.slice(1)}`
  const rate = await poster(c, `/api/expedition/${v.id}/reponse`, { position: q.index, choix: fausse })
  assert.equal(rate.status, 200, rate.corps.error)
  assert.equal(rate.corps.juste, false)
  assert.equal(rate.corps.bonneReponse, rebus.reponse)
  assert.equal(rate.corps.anecdote, rebus.lecture)
  assert.equal(rate.corps.expedition.offre, undefined)
  assert.equal(rate.corps.expedition.courage, v.courage, 'pas une once de courage')
  const ligne = base(db => db.prepare('SELECT reserve_id, choix, forme FROM campagne_reponses WHERE serie_id = ? AND position = ?').get(v.id, q.index)) as Record<string, unknown>
  assert.deepEqual(ligne, { reserve_id: gardee.id, choix: -1, forme: 'lettres' })
  const revele = texte(
    await rendre(Escale, { vue: rate.corps.expedition, avant: v, question: q, reponse: rate.corps, choix: -1, composee: fausse, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien }),
  )
  assert.match(revele, /Raté… une curiosité ne coûte rien/)
  assert.doesNotMatch(revele, /Signaler une erreur/, 'un rébus ne se signale pas')
  // Il n'entre pas au carnet, et ne se signale pas.
  const carnet = (await lire(c, '/api/campagne/carnet')).corps
  assert.deepEqual([carnet.aRevoir, carnet.demain, carnet.plusTard], [0, 0, 0])
  const signale = await poster(c, `/api/campagne/serie/${v.id}/signalement`, { index: q.index, texte: 'Il ne se lit pas' })
  assert.equal(signale.status, 400)
  assert.equal(signale.corps.error, 'Un rébus ne se signale pas : seules les questions de la campagne le peuvent')
  // Le plat : une question de la liste, à quatre choix, telle que la base l'a écrite.
  v = rate.corps.expedition
  v = (await geste(c, v, { quoi: 'avancer', vers: v.permises[0] })).corps.expedition
  const p = v.question!
  const plat = questionsDe(v.id)[p.index]
  assert.ok(PLATS.some(x => x.id === plat.id), `${plat.id} : un plat de la liste`)
  assert.equal(p.reponses.length, 4)
  assert.equal(p.rebus, undefined)
  // Trouvé : sa récompense, au niveau 1 des cartes rares.
  const trouve = await poster(c, `/api/expedition/${v.id}/reponse`, { position: p.index, choix: plat.bonne })
  assert.equal(trouve.status, 200, trouve.corps.error)
  assert.equal(trouve.corps.juste, true)
  const offre = trouve.corps.expedition.offre
  assert.equal(offre?.curiosite, true)
  assert.ok(offre.jokers.length > 0 && offre.jokers.every((x: string) => carteDeRencontre(x)?.rarete === 'rare'), offre.jokers.join(', '))
  const bienVu = texte(
    await rendre(Escale, { vue: trouve.corps.expedition, avant: v, question: p, reponse: trouve.corps, choix: plat.bonne, busy: false, erreur: '', onRepondre: rien, onJouer: rien, onSuite: rien, onPartir: rien, onSignaler: rien }),
  )
  // Son expérience suit le verdict, après sa ponctuation : « Ta récompense t'attend +10 XP » se lisait comme dix points de récompense.
  assert.match(bienVu, /Bien vu, ta récompense t’attend ! \+\d+ XP/)
  assert.match(bienVu, /Choisir ta récompense/)
  v = trouve.corps.expedition
  v = (await geste(c, v, { quoi: 'prendre', jokers: [offre.jokers[0]] })).corps.expedition
  assert.ok(v.cartes!.paquet.includes(offre.jokers[0]))
  // Le second rébus n'est pas le premier : jamais vu d'abord.
  v = (await geste(c, v, { quoi: 'avancer', vers: v.permises[0] })).corps.expedition
  const second = questionsDe(v.id)[v.question!.index]
  assert.ok(second.id.startsWith(PREFIXE_DU_REBUS) && second.id !== gardee.id, `${second.id} après ${gardee.id}`)
  // « Mes réponses » : le rébus garde ses emojis, sans quoi son intitulé ne dirait rien.
  assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  const correction = (await lire(c, `/api/campagne/serie/${v.id}/correction`)).corps
  assert.equal(correction[q.index].rebus, rebus.emojis)
  assert.deepEqual(correction[q.index].reponses[0], rebus.reponse)
  assert.equal(correction[p.index].rebus, undefined)
  // Et la page les montre : le serveur les envoyait, la liste corrigée ne les lisait pas (vu au rendu, le 19 octobre 2026).
  const { SerieCorrigee } = (await import(new URL('../../client/src/components/SerieCorrigee.tsx', import.meta.url).href)) as { SerieCorrigee: Composant }
  const mesReponses = (await rendre(SerieCorrigee, { correction })).split('<li').slice(1)
  assert.match(mesReponses[q.index], new RegExp(`<p class="corrige-rebus">${rebus.emojis}</p>`))
  assert.doesNotMatch(mesReponses[p.index], /corrige-rebus/)
})

test('à l’écran : les règles de la version 12 disent la curiosité, ce qu’elle rapporte à son niveau ; celles de la version 11 n’en disent rien', async () => {
  const { FeuilleDesRegles } = (await pieces()) as unknown as { FeuilleDesRegles: Composant }
  const regles = async (v: number, niveau: number) => texte(await rendre(FeuilleDesRegles, { rencontres: true, v, codex: codexDuNiveau(niveau, [], [], v), ascension: 0, onFermer: rien }))
  assert.match(await regles(V, 1), /Une curiosité, une par acte : d’où vient un plat, ou un rébus en emojis à composer — sans adversaire ni cartes\. Trouvée, une carte rare au choix ; ratée, rien de perdu\./)
  assert.match(await regles(V, NIVEAU_MAX), /Trouvée, une carte rare, une fiole ou un talisman au choix/)
  assert.doesNotMatch(await regles(VERSION_DES_COUPS_DE_POUCE, NIVEAU_MAX), /curiosité/i)
})

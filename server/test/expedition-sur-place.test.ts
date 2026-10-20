// Les cartes jouées sur place (la phase d'optimisation de l'Expédition, le
// 19 octobre 2026 : « une phase d'optimisation des performances […] chargement
// des images / requêtes etc ») : en préparation, chaque carte jouée coûtait un
// aller-retour — quatre ou cinq par question, au réseau d'un téléphone, puis
// une écriture de Turso. Celles dont tout l'effet se lit de la vue se jouent
// dans la page (`jouerSurPlace`, `vueApresLaCarte`) et partent avec le geste
// suivant, d'un seul lot (`GesteAvecSesCartes`). Ici : chaque carte jouée sur
// place donne la vue que le pli rend, puis des expéditions jouées au hasard,
// carte après carte ; celles qui attendent le serveur ne s'y jouent pas. Par
// les routes : la vue entière que la page prédit, le lot qui écrit les gestes
// qu'auraient écrits des gestes partis un à un — tous ou aucun —, d'un seul
// aller-retour à la base.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { ProfileStore } from '../src/auth/profiles'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { hasardDe } from '../../shared/missions'
import {
  CARTES_DES_RENCONTRES,
  MISES,
  STYLES,
  VERSION_DES_HUIT_FAMILLES,
  ameliorer,
  baseDe,
  carteDeRencontre,
  formeDeLaCarte,
  refusDeLAmelioration,
  type StyleDeJeu,
} from '../../shared/rencontres'
import { ATTENDENT_LE_SERVEUR, escalesPermises, jouerSurPlace, seJoueSurPlace, vueApresLaCarte, type DepartDExpedition, type VueDeLExpedition } from '../../shared/expedition'
import { Journal, avecEnMain, avecEnMainAmelioree, carteDeLaForge, depart, enMain } from './expedition-journal'

ProfileStore.tirageEclat = () => false

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
const laPage = (): Promise<{
  avecLesCartesSurPlace: (vue: VueDeLExpedition, sur: { id: string; rang: number; cartes: string[] } | null) => { vue: VueDeLExpedition; cartes: string[] }
}> => import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)

// ── Le calcul : chaque carte, puis des expéditions entières ─────────────────

/**
 * Un journal où cette carte se joue, en préparation, dans la première main de
 * l'élite : prise au coffre — améliorée à la forge, pour un « + » —, ou celle
 * d'un légendaire de l'équipe. Zizanie attend le doute : le Sophiste part avec
 * Insinuation, jouée d'abord.
 */
function ouElleSeJoue(cle: string) {
  const c = carteDeRencontre(cle)!
  const jouable = (j: Journal) => j.vue().refus[cle] === null
  const doute = (j: Journal) => {
    if (!enMain(j, 'insinuation')) return false
    j.jouer('insinuation')
    return jouable(j)
  }
  const scenario = baseDe(cle) === 'zizanie' ? doute : jouable
  const sophiste: Partial<DepartDExpedition> = baseDe(cle) === 'zizanie' ? { style: 'sophiste' } : {}
  if (c.amelioree) return avecEnMainAmelioree(baseDe(cle), scenario, 1, sophiste)
  return avecEnMain(cle, scenario, c.legendaire ? { equipee: [c.legendaire], invite: c.legendaire } : sophiste)
}

test('chaque carte qui se joue sur place donne la vue que le pli rend ; les autres attendent le serveur', () => {
  let surPlace = 0
  for (const c of CARTES_DES_RENCONTRES) {
    for (const cle of c.amelioration ? [c.cle, ameliorer(c.cle)] : [c.cle]) {
      const attend = c.moment === 'route' || c.moment === 'reflexe' || ATTENDENT_LE_SERVEUR.has(c.cle) || !!formeDeLaCarte(cle)
      assert.equal(seJoueSurPlace(cle, VERSION_DES_HUIT_FAMILLES), !attend, cle)
      if (attend) continue
      const j = ouElleSeJoue(cle)
      const avant = j.vue()
      const ici = jouerSurPlace(avant, cle, j.depart.fetiche)
      assert.ok(ici, `${cle} se joue sur place`)
      j.jouer(cle)
      assert.deepEqual(ici, j.vue(), `${cle} : la vue de la page est celle du pli`)
      surPlace++
    }
  }
  // Les cartes du jeu qui tirent, reposent la question ou rendent du courage restent au serveur : une trentaine.
  assert.ok(surPlace > 100, `${surPlace} cartes jouées sur place`)
})

test('une carte qui attend le serveur ne se joue pas sur place, même jouable ; ni la question vue, ni une carte refusée', () => {
  for (const cle of ['pioche', 'sprint', 'corser', 'panacee']) {
    const j = ouElleSeJoue(cle)
    assert.equal(j.vue().refus[cle], null, `${cle} se joue ici`)
    assert.equal(jouerSurPlace(j.vue(), cle, j.depart.fetiche), null, `${cle} attend le serveur`)
  }
  const j = ouElleSeJoue('concentration')
  // Refusée : la vue le dit déjà, la page ne la joue pas.
  const sansEnergie = { ...j.vue(), refus: { ...j.vue().refus, concentration: 'Il te manque de l’énergie' } }
  assert.equal(jouerSurPlace(sansEnergie, 'concentration', j.depart.fetiche), null)
  // La question vue : plus de préparation, le serveur seul.
  j.voir(0)
  assert.equal(jouerSurPlace(j.vue(), 'concentration', j.depart.fetiche), null)
})

/**
 * Une expédition jouée au hasard, sur le plan fait à la main et sa forge : des
 * cartes en préparation tant qu'il y en a de jouables, chacune jouée sur place
 * comparée à la vue du pli qui l'a jouée ; puis la question vue, à une mise
 * permise, et une réponse au hasard.
 */
function auHasard(n: number, style: StyleDeJeu | undefined): number {
  const h = hasardDe(`sur-place:${n}`)
  const un = <T>(liste: readonly T[]) => liste[Math.floor(h() * liste.length)]
  // Tout le codex des huit familles, sauf les légendaires : les offres tirent de partout. Les cartes de la version 11 en sont
  // écartées — le départ prend la version de ses cartes (`depart`), et la question au centre n'a plus de préparation à jouer ici.
  const codex = CARTES_DES_RENCONTRES.filter(c => !c.legendaire && (c.depuis ?? 0) <= VERSION_DES_HUIT_FAMILLES).map(c => c.cle)
  const j = new Journal(depart(`sur-place:${n}`, codex, { cartes: [carteDeLaForge(), carteDeLaForge(), carteDeLaForge()], ...(style && { style }) }))
  let comparees = 0
  for (let pas = 0; pas < 300; pas++) {
    const e = j.etat()
    if (e.issue !== 'en-route') break
    if (e.offre) {
      j.prendre(e.offre.jokers.length > 0 && h() < 0.8 ? [un(e.offre.jokers)] : [])
      continue
    }
    if (e.campement) {
      const ameliorables = e.paquet.filter(cle => refusDeLAmelioration(e.paquet, cle) === null)
      j.geste(ameliorables.length > 0 && h() < 0.6 ? { quoi: 'camper', ameliorer: un(ameliorables) } : { quoi: 'camper' })
      continue
    }
    if (e.rencontre?.tour.phase === 'preparation') {
      for (let k = 0; k < 8 && h() < 0.9; k++) {
        const avant = j.vue()
        const jouables = [...new Set(avant.main)].filter(cle => avant.refus[cle] === null)
        if (jouables.length === 0) break
        const cle = un(jouables)
        const ici = jouerSurPlace(avant, cle, j.depart.fetiche)
        j.jouer(cle)
        if (!ici) continue
        assert.deepEqual(ici, j.vue(), `expédition ${n}, pas ${pas} : ${cle} après ${avant.jouees.join(', ') || 'rien'}`)
        comparees++
      }
      const v = j.vue()
      if (v.phase === 'preparation') j.voir(un(MISES.filter(m => v.mises?.[m] === null)))
      j.repondre(h() < 0.65)
      continue
    }
    if (e.enAttente !== null) {
      j.repondre(h() < 0.65)
      continue
    }
    const permises = escalesPermises(j.depart, e)
    if (permises.length === 0) break
    j.avancer(un(permises))
  }
  return comparees
}

test('des expéditions jouées au hasard, de tous les styles : chaque carte jouée sur place, l’une après l’autre, donne la vue du pli', () => {
  let comparees = 0
  for (let n = 0; n < 18; n++) comparees += auHasard(n, n % 9 === 8 ? undefined : STYLES[n % STYLES.length])
  assert.ok(comparees > 300, `${comparees} cartes comparées`)
})

// ── Par les routes ──────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure, comme `expedition-charge.test.ts`. */
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

/** Une question d'essai : 2 facile, 3 moyenne, 4 difficile. */
function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `plac${String(i).padStart(4, '0')}`,
    texte: `Question d'essai numéro ${i} des cartes jouées sur place : laquelle est la bonne ?`,
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
  banc = await demarrer({ baseDeLaCampagne: BASE, horlogeDuJour: () => Date.UTC(2026, 9, 19, 8, 0) })
})

after(() => banc.close())

const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const lire = (cookie: string) => fetch(`${banc.url}/api/expedition`, { headers: { Cookie: cookie } }).then(async r => (await r.json()) as { expedition: VueDeLExpedition | null })

/** Les gestes que le journal tient, dans leur ordre. */
const journalDe = (serie: string) => {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return (db.prepare('SELECT rang, geste FROM expedition_gestes WHERE serie_id = ? ORDER BY rang').all(serie) as { rang: number; geste: string }[]).map(x => ({
      rang: x.rang,
      geste: JSON.parse(x.geste),
    }))
  } finally {
    db.close()
  }
}

const sorteDe = (v: VueDeLExpedition, id: string) => v.carte!.escales.find(e => e.id === id)?.sorte

/**
 * Jusqu'à une rencontre qui se prépare, où au moins `combien` cartes se
 * jouent sur place l'une après l'autre : sinon, une réponse juste et la
 * suite. La main se tire au hasard du serveur : on marche jusqu'à elle.
 */
async function jusquAUnePreparation(cookie: string, v: VueDeLExpedition, combien: number): Promise<{ v: VueDeLExpedition; cartes: string[] }> {
  for (let pas = 0; pas < 60; pas++) {
    if (v.rencontre?.phase === 'preparation') {
      const cartes = surPlaceDe(v)
      if (cartes.length >= combien) return { v, cartes }
    }
    const g = v.offre
      ? { quoi: 'prendre', jokers: [] }
      : v.campement
        ? { quoi: 'camper' }
        : v.rencontre?.phase === 'preparation'
          ? { quoi: 'voir', mise: 0, position: v.rencontre.position }
          : null
    if (g) {
      const r = await poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: g })
      assert.equal(r.status, 200, r.corps.error)
      v = r.corps.expedition
    } else if (v.question) {
      const r = await poster(cookie, `/api/expedition/${v.id}/reponse`, { position: v.question.index, choix: bonnes(v.id)[v.question.index] })
      assert.equal(r.status, 200, r.corps.error)
      v = r.corps.expedition
    } else {
      const vers = v.permises.find(id => sorteDe(v, id) === 'question' || sorteDe(v, id) === 'elite') ?? v.permises.find(id => sorteDe(v, id) !== 'inconnu') ?? v.permises[0]
      const r = await poster(cookie, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers } })
      assert.equal(r.status, 200, r.corps.error)
      v = r.corps.expedition
    }
  }
  throw new Error(`aucune préparation où ${combien} cartes se jouent sur place`)
}

/** Les cartes de la main qui se jouent sur place l'une après l'autre, dans l'ordre de la main. */
function surPlaceDe(v: VueDeLExpedition): string[] {
  const cartes: string[] = []
  let x: VueDeLExpedition = v
  for (const cle of v.rencontre!.main) {
    const apres: VueDeLExpedition | null = vueApresLaCarte(x, cle)
    if (!apres) continue
    cartes.push(cle)
    x = apres
  }
  return cartes
}

/** Les bonnes réponses, lues en base : la page ne les voit jamais avant la sienne. */
const bonnes = (serie: string): number[] => {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return (JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions) as { bonne: number }[]).map(q => q.bonne)
  } finally {
    db.close()
  }
}

test('par les routes : la vue que la page prédit est celle que le serveur rend ; ses cartes partent avec le geste suivant, d’un seul aller-retour, au journal de gestes partis un à un', async () => {
  const c = await inscrireProfil(banc.url, 'surplace', 'Sur place')
  const parti = await poster(c, '/api/expedition', { rencontres: true })
  assert.equal(parti.status, 200, parti.corps.error)
  const { v, cartes } = await jusquAUnePreparation(c, parti.corps as VueDeLExpedition, 2)

  // Une carte, seule, comme avant : la vue que la page a prédite, champ pour champ — le rang, le courage, les vies, les fioles, la rencontre.
  const predite = vueApresLaCarte(v, cartes[0])!
  const seule = await poster(c, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'jouer', joker: cartes[0], position: v.rencontre!.position } })
  assert.equal(seule.status, 200, seule.corps.error)
  assert.deepEqual(predite, seule.corps.expedition, 'la page prédit la vue du serveur')

  // Les suivantes sur place, puis la question vue : un seul geste, ses cartes avec lui.
  let x: VueDeLExpedition = seule.corps.expedition
  const autres: string[] = []
  for (const cle of surPlaceDe(x)) {
    x = vueApresLaCarte(x, cle)!
    autres.push(cle)
  }
  assert.ok(autres.length > 0, 'au moins une carte de plus se joue sur place')
  // La page les rejoue sur la vue du serveur tant qu'elle n'a pas bougé — « ← Partir » puis « Reprendre » les retrouve —, et les
  // oublie dès qu'un geste est passé sans elles.
  const { avecLesCartesSurPlace } = await laPage()
  const base: VueDeLExpedition = seule.corps.expedition
  assert.deepEqual(avecLesCartesSurPlace(base, { id: v.id, rang: base.rang, cartes: autres }), { vue: x, cartes: autres })
  assert.deepEqual(avecLesCartesSurPlace(base, { id: v.id, rang: base.rang - 1, cartes: autres }), { vue: base, cartes: [] })
  const mise = MISES.find(m => x.rencontre!.mises?.[m] === null)!
  const avant = journalDe(v.id).length
  const lot = await mesurer(() =>
    poster(c, `/api/expedition/${v.id}/geste`, {
      rang: seule.corps.expedition.rang + 1,
      geste: { quoi: 'voir', mise, position: v.rencontre!.position },
      avant: autres.map(joker => ({ quoi: 'jouer', joker, position: v.rencontre!.position })),
    }),
  )
  assert.equal(lot.resultat.status, 200, lot.resultat.corps.error)
  assert.equal(lot.appels, 1, `${lot.appels} allers-retours pour ${autres.length} cartes et la question vue`)
  const vue = lot.resultat.corps.expedition as VueDeLExpedition
  assert.equal(vue.rang, x.rang + 1, 'chaque carte compte son geste')
  assert.equal(vue.rencontre!.phase, 'question')
  assert.deepEqual(vue.rencontre!.jouees, [cartes[0], ...autres])
  assert.deepEqual(
    journalDe(v.id).slice(avant),
    [...autres.map(joker => ({ quoi: 'jouer', joker, position: v.rencontre!.position })), { quoi: 'voir', mise, position: v.rencontre!.position }].map((geste, k) => ({
      rang: avant + 1 + k,
      geste,
    })),
    'le journal de gestes partis un à un',
  )
  // Relue de la base — le serveur redémarré n'a plus rien en mémoire —, l'expédition est la même.
  await banc.redemarrer()
  assert.deepEqual((await lire(c)).expedition, vue)
})

test('par les routes : un lot refusé n’écrit rien — une carte qui n’est pas en main, une qui attend le serveur, un rang passé, ce qui ne se lit pas', async () => {
  const c = await inscrireProfil(banc.url, 'refus', 'Refus')
  const parti = await poster(c, '/api/expedition', { rencontres: true })
  const { v, cartes } = await jusquAUnePreparation(c, parti.corps as VueDeLExpedition, 1)
  const position = v.rencontre!.position
  const voir = { quoi: 'voir', mise: 0, position }
  const essais: [unknown, number, string][] = [
    // La deuxième n'est pas dans sa main : la première, jouable, ne s'écrit pas non plus.
    [
      { rang: v.rang + 1, geste: voir, avant: [{ quoi: 'jouer', joker: cartes[0], position }, { quoi: 'jouer', joker: 'genie', position }] },
      400,
      'Cette carte n’est plus dans ta main : recharge la page',
    ],
    // Une carte qui tire passe seule : sous une autre, son tirage se ferait ailleurs.
    [{ rang: v.rang + 1, geste: voir, avant: [{ quoi: 'jouer', joker: 'pioche', position }] }, 400, 'Cette carte se joue seule : recharge la page'],
    [{ rang: v.rang, geste: voir, avant: [{ quoi: 'jouer', joker: cartes[0], position }] }, 400, 'Ce geste est passé : l’expédition a continué sans lui'],
    [{ rang: v.rang + 1, geste: voir, avant: [{ quoi: 'voir', mise: 0, position }] }, 400, 'Ce geste ne se lit pas : recharge la page'],
    [{ rang: v.rang + 1, geste: voir, avant: { quoi: 'jouer', joker: cartes[0] } }, 400, 'Ce geste ne se lit pas : recharge la page'],
  ]
  const avant = journalDe(v.id)
  for (const [corps, statut, motif] of essais) {
    const r = await poster(c, `/api/expedition/${v.id}/geste`, corps)
    assert.equal(r.status, statut, JSON.stringify(corps))
    assert.equal(r.corps.error, motif)
    assert.deepEqual(journalDe(v.id), avant, `rien d’écrit : ${JSON.stringify(corps)}`)
  }
  assert.deepEqual((await lire(c)).expedition, v, 'la page relue est celle d’avant')
  await patienter(0)
})

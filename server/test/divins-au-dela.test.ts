// Les Divins qui se jugent au-delà d'un mode (le 21 novembre 2026) : Hécate,
// au Cabinet de curiosités, et les deux que seul le magasin des profils voit
// d'un bout à l'autre — Artémis, sur les trois journaux qui font grandir un
// compagnon, et le Panthéon, sur une journée de Paris lue dans quatre modes.
//
// Leurs règles pures se lisent dans `core/divins.ts` ; ici, c'est le câblage
// qu'on éprouve, sur un vrai serveur : chaque mode n'apporte que des faits, la
// règle juge de l'autre côté, et ce qui descend se range sous la partie qui
// l'a fait tomber — le jour, la série, la traversée —, s'annonce à son seul
// joueur avec son récit, et ne redescend pas. L'état d'avant s'écrit à la main
// dans la base, comme le serveur l'aurait écrit ; le dernier pas se joue par
// les routes, puisque c'est lui qui juge.
//
// Chaque épreuve a son serveur jetable, et ses témoins : à côté de celui sur
// qui le Divin descend, ceux à qui il manque une seule chose.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { ProfileStore, VERSION_BAREME, cleDeSerie, cleDuJour } from '../src/auth/profiles'
import { CampagneStore } from '../src/core/campagne'
import type { BaseDeLaCampagne } from '../src/core/baseCampagne'
import { resumeDeLaTraversee } from '../../shared/cabinet/resume'
import {
  VERSION_DE_LA_TRAVERSEE,
  etatDeLaTraversee,
  refusDuGesteDeLaTraversee,
  tracerLaCarte,
  type CleDeCarte,
  type DepartDeLaTraversee,
  type EtapeDeLaCarte,
  type EtatDeLaTraversee,
  type GesteDeLaTraversee,
  type GesteDeLaTraverseeEcrit,
} from '../../shared/cabinet/traversee'
import { VIES } from '../../shared/campagne'
import { CATEGORIES } from '../../shared/categories'
import { coteDuScore } from '../../shared/duels'
import { gainVide, releveVide } from '../../shared/profil'
import { QUESTIONS_PAR_EPREUVE } from '../../shared/sentiers'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { baseDuCabinet } from './cabinet-banc'

// Un Éclat tiré au hasard ferait tomber un palier : rien ici n'en dépend.
ProfileStore.tirageEclat = () => false
// Les douze du 21 novembre 2026 attendent leur bijou, et leur clé ne se range pas tant que le catalogue public ne les
// nomme pas : ici, la porte est ouverte. Le banc démarre son serveur dans ce processus — ces statiques valent pour lui.
ProfileStore.divinAuCatalogue = () => true

// ── Le banc, et de quoi lui parler ────────────────────────────────────────

interface Horloge {
  t: number
}

async function avecBanc(debut: number, baseDeLaCampagne: BaseDeLaCampagne, scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

/** Douze questions de chacune des douze catégories : de quoi jouer une série ou un duel au dé. */
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
/** Cent vingt questions de Nature : de quoi jouer une épreuve de la forêt, et la rejouer. */
const FORET = baseDEssai(120, { categories: ['Nature'] })
/** La base d'essai du Cabinet : ses pages s'y ouvrent comme dans ses propres épreuves. */
const CABINET = baseDuCabinet()

// Telle que la page lit : avec l'en-tête maison — sans lui, le Cabinet la prendrait pour un préchargement.
const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
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
  login: string
  cookie: string
  id: string
}

/** Un profil neuf, son cookie et son identifiant : l'état d'avant s'écrit sous lui. */
async function joueur(banc: Banc, login: string): Promise<Joueur> {
  const cookie = await inscrireProfil(banc.url, login, login[0].toUpperCase() + login.slice(1))
  return { login, cookie, id: base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id) }
}

/** Les Divins rangés sur son étagère, chacun sous ce qui l'a fait descendre, dans l'ordre où ils sont tombés. */
const divinsRanges = (banc: Banc, j: Joueur) =>
  base(banc, db =>
    (db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'dv:%' ORDER BY created_at, badge`).all(j.id) as { badge: string; soiree_id: string }[]).map(
      r => `${r.badge} sous ${r.soiree_id}`,
    ),
  )

/** Les Divins qu'une fin annonce : l'état d'une partie du jour, la dernière réponse d'une série ou d'une épreuve, la vue d'une traversée. */
const cles = (fin: any): string[] => (fin?.divins ?? []).map((d: any) => d.key)

/** Un Divin s'annonce avec son récit, et rien d'autre : sa clé, sa légende, son ton — jamais ce qui l'a fait descendre. */
function avecSonRecit(fin: any, cle: string) {
  const d = (fin.divins as any[]).find(x => x.key === cle)
  assert.ok(d, `${cle} s’annonce`)
  assert.deepEqual(Object.keys(d).sort(), ['key', 'legende', 'ton'])
  assert.ok(typeof d.legende === 'string' && d.legende.length > 20, 'son récit')
  assert.equal(d.ton, 'eclat')
}

/** Midi à Paris, un jour de septembre 2026 (heure d'été, UTC+2) : aucune saison. */
const midi = (jour: number) => Date.UTC(2026, 8, jour, 10, 0)
/** Le premier instant de ce jour-là à Paris — écrit en dur : c'est la borne que le serveur doit retrouver seul. */
const minuit = (jour: number) => Date.UTC(2026, 8, jour - 1, 22, 0)
const septembre = (jour: number) => `2026-09-${String(jour).padStart(2, '0')}`
const HEURE = 3_600_000

// ── Les quatre parts d'une journée ────────────────────────────────────────

/** Joue toute la partie du jour, une réponse toutes les cinq secondes : `juste(i)` dit s'il trouve la question i. Rend l'état de la partie finie. */
async function jouerLeJour(banc: Banc, horloge: Horloge, j: Joueur, juste: (i: number) => boolean = () => true) {
  let etat = (await poster(banc, j.cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    // Cinq secondes par réponse : assez lent pour qu'aucun Divin de la vitesse ne s'en mêle.
    horloge.t += 5000
    const bonne = questions[i].bonne
    const r = await poster(banc, j.cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, j.cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** Un palier de sentier validé, fini à `le`, tel que son épreuve l'aurait laissé : seize sur seize d'office — ses trois étoiles. */
function palierValide(banc: Banc, j: Joueur, le: number, { justes = QUESTIONS_PAR_EPREUVE, palier = 1 } = {}) {
  base(banc, db =>
    db
      .prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, branche, palier, seuil, rejeu, issue)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'sentier', 'foret', ?, 10, 0, 'validee')`,
      )
      .run(randomUUID(), j.id, QUESTIONS_PAR_EPREUVE, justes, le - 60_000, le, palier),
  )
}

/** Un duel au dé fini à `le`, tel que sa rencontre l'aurait laissé : Automate, ses réponses gardées avec elle. Gagné d'office. */
function duelAuDe(banc: Banc, j: Joueur, le: number, { justes = 10, sesJustes = 7 } = {}) {
  const id = randomUUID()
  const adversaire = { serie: id, profil: '', reponses: [...Array<boolean>(sesJustes).fill(true), ...Array<boolean>(VIES).fill(false)], simule: true }
  base(banc, db =>
    db
      .prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      )
      .run(id, j.id, justes + VIES, justes, le - 60_000, le, JSON.stringify(adversaire)),
  )
}

/**
 * Un duel classé gagné, lancé par quelqu'un d'autre — sans profil, qu'aucun classement ne nomme —, à sa cote figée : sa
 * tentative finie à `lui`, celle d'en face à `enFace`. Il compte au jour où il s'est joué des deux côtés.
 */
function duelClasse(banc: Banc, j: Joueur, { lui, enFace }: { lui: number; enFace: number }) {
  const code = randomUUID()
  const autre = randomUUID()
  base(banc, db => {
    db.prepare(`INSERT INTO campagne_duels (code, auteur, questions, cree_le, ferme_le, adversaire, cote_auteur) VALUES (?, ?, '[]', ?, ?, ?, ?)`).run(
      code,
      autre,
      Math.min(lui, enFace) - 180_000,
      Math.max(lui, enFace) + 7 * 24 * HEURE,
      j.id,
      coteDuScore(7),
    )
    const tentative = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, duel) VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'duel', ?)`,
    )
    tentative.run(randomUUID(), autre, 7 + VIES, 7, enFace - 60_000, enFace, code)
    tentative.run(randomUUID(), j.id, 10 + VIES, 10, lui - 60_000, lui, code)
  })
}

// ── Une traversée du Cabinet, écrite à la main ────────────────────────────

const GARDIENS: [string, string, string] = ['lg:renard', 'lg:sphinx', 'lg:dragon']

/**
 * Comment elle est menée : les mains vides — ni coffre, ni achat —, par le coffre de chaque acte, ou sans coffre mais
 * avec un achat chez le marchand.
 */
type Facon = 'mains-vides' | 'coffre' | 'achat'

interface Traversee {
  depart: DepartDeLaTraversee
  gestes: GesteDeLaTraverseeEcrit[]
  etat: EtatDeLaTraversee
  /** Ce que la base porte à la place de ses gestes, quand ce n'est pas eux (`illisible`). */
  ecrits?: readonly unknown[]
}

/**
 * Une traversée gagnée, jouée au pli geste par geste comme le serveur les aurait écrits : chaque épreuve conclue à
 * trois étoiles par manche, chaque amélioration offerte prise par la première carte qui monte — celle d'un gardien
 * vaincu ne se refuse pas, le pas suivant l'attend —, le premier gardien choisi au bout. Chaque acte n'a qu'un coffre,
 * au deuxième rang, et chaque étape du premier file tout droit : il y a toujours un chemin qui l'évite, et un qui y mène.
 */
function traverseeGagnee(facon: Facon): Traversee {
  let x = 7
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const depart: DepartDeLaTraversee = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-09-20', actes: tracerLaCarte(hasard, GARDIENS, { epingle: ['Rome'], frise: ['Rome'] }) }
  const gestes: GesteDeLaTraverseeEcrit[] = []
  const pousser = (geste: GesteDeLaTraversee) => gestes.push({ geste, faitLe: gestes.length + 1 })
  const cartes: CleDeCarte[] = ['cagnotte', 'panacee', 'pourboire']
  pousser({ quoi: 'cartes', cartes })
  let e = etatDeLaTraversee(depart, gestes)
  let parties = 0
  let achete = false
  for (let garde = 0; garde < 400 && !e.fin; garde++) {
    const ici = depart.actes[e.acte].etapes
    const etapeDe = (id: string) => ici.find(s => s.id === id)!
    const versUnCoffre = (s: EtapeDeLaCarte) => s.suivantes.some(id => etapeDe(id).sorte === 'coffre')
    const achat: GesteDeLaTraversee = { quoi: 'acheter', article: 'amelioration', carte: e.cartes[0].cle }
    if (e.ameliorations > 0) pousser({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 2)!.cle })
    else if (e.ou.sorte === 'legendaire') pousser({ quoi: 'legendaire', gardien: GARDIENS[0] })
    else if (facon === 'achat' && !achete && e.ou.sorte === 'marchand' && refusDuGesteDeLaTraversee(depart, e, achat, 0) === null) {
      pousser(achat)
      achete = true
    } else {
      const suivantes = (e.ou.sorte === 'gardien' ? [e.ou.etape] : etapeDe(e.position).suivantes).map(etapeDe)
      const sansCoffre = suivantes.filter(s => s.sorte !== 'coffre')
      const etape =
        facon === 'coffre'
          ? (suivantes.find(s => s.sorte === 'coffre') ?? suivantes.find(versUnCoffre) ?? suivantes[0])
          : // Ni le coffre, ni l'étape qui n'aurait plus que lui devant elle.
            (sansCoffre.find(s => s.suivantes.length === 0 || s.suivantes.some(id => etapeDe(id).sorte !== 'coffre')) ?? sansCoffre[0])
      if (etape.sorte === 'coffre' || etape.sorte === 'marchand') pousser({ quoi: 'aller', etape: etape.id })
      else {
        const partie = `partie-${++parties}`
        pousser({ quoi: 'epreuve', etape: etape.id, partie })
        pousser({ quoi: 'conclure', partie, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })), aides: { eclairer: 0, changer: 0, temps: 0 } })
      }
    }
    e = etatDeLaTraversee(depart, gestes)
  }
  assert.equal(e.ignores, 0, 'le pli accepte chaque geste écrit')
  assert.equal(e.fin?.issue, 'gagnee')
  return { depart, gestes, etat: e }
}

/** La même, arrêtée devant le choix de son légendaire : le geste qui la gagne reste à jouer — par la route, ou jamais. */
function devantLeChoix(t: Traversee): Traversee {
  const gestes = t.gestes.slice(0, -1)
  const etat = etatDeLaTraversee(t.depart, gestes)
  assert.equal(etat.ou.sorte, 'legendaire')
  return { depart: t.depart, gestes, etat }
}

/** La même, abandonnée devant le choix de son légendaire : menée au bout de ses trois gardiens, jamais gagnée. */
function abandonnee(t: Traversee): Traversee {
  const gestes = [...devantLeChoix(t).gestes, { geste: { quoi: 'abandonner' } as GesteDeLaTraversee, faitLe: t.gestes.length }]
  const etat = etatDeLaTraversee(t.depart, gestes)
  assert.equal(etat.fin?.issue, 'abandonnee')
  return { depart: t.depart, gestes, etat }
}

/**
 * La même, gagnée, avec au milieu un geste que ce code ne relit pas — celui d'une version à venir. Seule la base la
 * porte : le pli ne la rejoue pas, son état reste celui de la traversée gagnée.
 */
function illisible(t: Traversee): Traversee {
  const ecrits: unknown[] = t.gestes.map(g => g.geste)
  ecrits.splice(5, 0, { quoi: 'troquer', contre: 'une-cle' })
  return { ...t, ecrits }
}

const MAINS_VIDES = traverseeGagnee('mains-vides')
const AVEC_COFFRE = traverseeGagnee('coffre')
const AVEC_ACHAT = traverseeGagnee('achat')

/** Les étapes à coffre de sa carte où elle est allée, et ses achats : ce qui lui remplit les mains. */
function sesMains(t: Traversee) {
  const coffres = new Set(t.depart.actes.flatMap(a => a.etapes.filter(s => s.sorte === 'coffre').map(s => s.id)))
  return {
    coffres: t.gestes.filter(({ geste: g }) => g.quoi === 'aller' && coffres.has(g.etape)).length,
    achats: t.gestes.filter(({ geste: g }) => g.quoi === 'acheter').length,
    offertes: t.gestes.filter(({ geste: g }) => g.quoi === 'ameliorer').length,
  }
}

/**
 * Une traversée écrite en base comme le serveur l'aurait écrite : en route, ou finie à `finieLe` avec son issue, son
 * légendaire et son résumé. `commenceeLe` les range : la page lit la dernière commencée.
 */
function ecrireLaTraversee(banc: Banc, j: Joueur, id: string, t: Traversee, commenceeLe: number, finieLe?: number) {
  const fin = t.etat.fin
  assert.equal(fin !== null, finieLe !== undefined, 'une traversée finie dit quand, une traversée en route ne le dit pas')
  base(banc, db =>
    db.transaction(() => {
      db.prepare(`INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le, finie_le, issue, legendaire, resume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        j.id,
        JSON.stringify(t.depart),
        commenceeLe,
        finieLe ?? null,
        fin?.issue ?? null,
        fin?.legendaire ?? null,
        fin ? JSON.stringify(resumeDeLaTraversee(t.depart, t.gestes)) : null,
      )
      const geste = db.prepare(`INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (?, ?, ?, ?, ?)`)
      const ecrits = t.ecrits ?? t.gestes.map(g => g.geste)
      ecrits.forEach((g, k) => geste.run(id, k + 1, JSON.stringify(g), commenceeLe + k + 1, `u${k}`))
    })(),
  )
}

/** Le dernier geste d'une traversée, par les routes : sa page la montre devant le choix du légendaire, il le choisit. Rend la vue de sa fin. */
async function choisirLeLegendaire(banc: Banc, j: Joueur, id: string) {
  const page = await lire(banc, j.cookie, '/api/cabinet/traversee')
  assert.equal(page.status, 200, page.corps.error)
  const t = page.corps.traversee
  assert.equal(t?.id, id, 'la page lit la dernière commencée')
  assert.equal(t.ou.sorte, 'legendaire')
  const fin = await poster(banc, j.cookie, `/api/cabinet/traversee/${id}/geste`, { rang: t.rang, geste: { quoi: 'legendaire', gardien: GARDIENS[0] } })
  assert.equal(fin.status, 200, fin.corps.error)
  assert.equal(fin.corps.traversee.fin?.issue, 'gagnee')
  return fin.corps.traversee
}

// ── Une partie de la campagne, par les routes ─────────────────────────────

/**
 * Une partie de la campagne déjà commencée — une série, un duel au dé, la tentative d'un duel classé — jouée jusqu'à sa
 * fin : `justes` bonnes réponses, puis des fautes. Les bonnes réponses se lisent en base : le téléphone ne les voit
 * jamais avant la sienne. Rend ce que sa dernière réponse dit.
 */
async function finirLaSerie(banc: Banc, j: Joueur, id: string, justes: number) {
  const questions = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const r = await poster(banc, j.cookie, `/api/campagne/serie/${id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    if (r.corps.finie) return { id, fin: r.corps }
  }
  throw new Error(`la série ${id} ne finit pas`)
}

/** Une série — ou un duel au dé, par sa route — commencée puis jouée jusqu'à sa fin (`finirLaSerie`). */
async function jouerUneSerie(banc: Banc, j: Joueur, justes: number, chemin = '/api/campagne/serie') {
  const depart = await poster(banc, j.cookie, chemin)
  assert.equal(depart.status, 200, depart.corps.error)
  const id = (depart.corps.serie?.id ?? depart.corps.id) as string
  assert.ok(id, JSON.stringify(depart.corps))
  return finirLaSerie(banc, j, id, justes)
}

/**
 * Un duel classé par les routes, une minute entre chaque pas : lancé et joué par l'un — `sesJustes` bonnes réponses —,
 * relevé et joué par l'autre. Rend son code, et la fin de chacun.
 */
async function duelParLesRoutes(banc: Banc, horloge: Horloge, lanceur: Joueur, sesJustes: number, second: Joueur, lesSiennes: number) {
  horloge.t += 60_000
  const lance = await poster(banc, lanceur.cookie, '/api/campagne/duel', { adversaire: second.id })
  assert.equal(lance.status, 200, lance.corps.error)
  const premier = await finirLaSerie(banc, lanceur, lance.corps.serie.id, sesJustes)
  horloge.t += 60_000
  const releve = await poster(banc, second.cookie, `/api/campagne/duel/${lance.corps.code}`)
  assert.equal(releve.status, 200, releve.corps.error)
  return { code: lance.corps.code as string, premier, second: await finirLaSerie(banc, second, releve.corps.id, lesSiennes) }
}

/** La bonne réponse d'une question de `baseDEssai` : celle qui commence par « Bonne ». */
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

/** Le premier palier de la forêt, par les routes, jusqu'à sa seizième question : tout juste, sauf la question `faute`. Rend sa dernière réponse. */
async function jouerLePalier(banc: Banc, j: Joueur, faute: number | null = null) {
  const depart = await poster(banc, j.cookie, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })
  assert.equal(depart.status, 200, depart.corps.error)
  let e = depart.corps
  let derniere: any = null
  for (let i = 0; !e.finie && e.question; i++) {
    const q = e.question
    const r = await poster(banc, j.cookie, `/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix: i === faute ? (bonneDe(q) + 1) % q.reponses.length : bonneDe(q) })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    e = r.corps.epreuve
  }
  assert.ok(e.finie, 'l’épreuve va au bout')
  return { id: e.id as string, fin: derniere }
}

// ── Un compagnon, et ses bonnes réponses d'avant ──────────────────────────

/**
 * Une soirée d'avant, jouée à plusieurs, et ses bonnes réponses données avec chacun de ces compagnons : la ligne que la
 * croissance d'un compagnon relit (`releve.compagnons`), une seule pour trente mille réponses — ses journaux du jour et
 * de la campagne en voudraient une par réponse. Elle rapporte aussi ses confettis : de quoi adopter.
 */
function soireeDAvant(banc: Banc, j: Joueur, avec: Record<string, number>) {
  const n = Object.values(avec).reduce((a, b) => a + b, 0)
  const detail = { v: VERSION_BAREME, gain: { ...gainVide(), reponses: n }, releve: { ...releveVide(), questions: n, reponses: n, qcm: n, justes: n, compagnons: avec } }
  base(banc, db =>
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree-d-avant', 'salon', 0, ?, 1)`).run(j.id, JSON.stringify(detail)),
  )
}

/** Il adopte ce compagnon à la boutique, qui s'installe dans sa niche ; rend ses bonnes réponses avec chacun des siens, telles que sa niche les lit. */
async function adopter(banc: Banc, j: Joueur, compagnon: string): Promise<Record<string, number>> {
  const achat = await poster(banc, j.cookie, '/api/joueur/compagnons', { compagnon })
  assert.equal(achat.status, 200, achat.corps.error)
  assert.equal(achat.corps.profile.niche, compagnon, 'adopté, il s’installe')
  const fiche = (await lire(banc, j.cookie, '/api/joueur/niche')).corps
  return Object.fromEntries((fiche.compagnons as { compagnon: string; justes: number }[]).map(a => [a.compagnon, a.justes]))
}

// ── 1. Hécate, au Cabinet ─────────────────────────────────────────────────

test('les traversées écrites à la main : les mains vides, par les coffres, par un achat — et l’amélioration d’un gardien vaincu, qui ne se refuse pas', () => {
  // Ce que les épreuves du serveur tiennent pour acquis de leurs trois traversées : si la carte ou le pli changeaient,
  // c'est ici que ça se lirait, pas dans un Divin qui ne descend plus.
  assert.deepEqual(sesMains(MAINS_VIDES), { coffres: 0, achats: 0, offertes: 2 }, 'ni coffre ni achat : les deux améliorations sont celles des gardiens des actes I et II')
  assert.deepEqual([sesMains(AVEC_ACHAT).coffres, sesMains(AVEC_ACHAT).achats], [0, 1], 'sans coffre, un seul achat')
  assert.ok(sesMains(AVEC_COFFRE).coffres >= 1 && sesMains(AVEC_COFFRE).achats === 0, 'un coffre au moins, aucun achat')
  assert.deepEqual(sesMains(abandonnee(MAINS_VIDES)), sesMains(MAINS_VIDES), 'abandonnée devant son légendaire, elle l’a été les mains vides aussi')
})

test('Hécate descend à la deuxième traversée gagnée les mains vides — dans la vue de sa fin, avec son récit, rangée sous elle ; la première seule, rien ; et elle ne redescend pas', () =>
  avecBanc(midi(26), CABINET, async (banc, horloge) => {
    const une = await joueur(banc, 'une')
    const deux = await joueur(banc, 'deux')

    // Sa première, gagnée les mains vides : une seule l'avait fait, le jour où la règle est arrivée — rien.
    ecrireLaTraversee(banc, une, 'premiere-d-une', devantLeChoix(MAINS_VIDES), 1000)
    const seule = await choisirLeLegendaire(banc, une, 'premiere-d-une')
    assert.deepEqual(cles(seule), [])
    assert.equal('divins' in seule, false, 'sans Divin, la vue n’en dit rien')
    assert.deepEqual(divinsRanges(banc, une), [])

    // Une gagnée les mains vides la veille, déjà en base ; la deuxième se gagne ici, par son dernier geste.
    ecrireLaTraversee(banc, deux, 'premiere-de-deux', MAINS_VIDES, 1000, midi(25))
    ecrireLaTraversee(banc, deux, 'deuxieme-de-deux', devantLeChoix(MAINS_VIDES), 2_000_000)
    const fin = await choisirLeLegendaire(banc, deux, 'deuxieme-de-deux')
    assert.deepEqual(cles(fin), ['dv:hecate'])
    avecSonRecit(fin, 'dv:hecate')
    assert.deepEqual(divinsRanges(banc, deux), [`dv:hecate sous ${cleDeSerie('deuxieme-de-deux')}`])
    // Tant que ce serveur la garde, sa page la redit : l'écran de fin se relit sans la perdre.
    assert.deepEqual(cles((await lire(banc, deux.cookie, '/api/cabinet/traversee')).corps.traversee), ['dv:hecate'])

    // Relue après un réveil, sa fin se tait — comme ses paliers, la mémoire seule le savait : rien d'un Divin ne s'écrit
    // au Cabinet. Son étagère, elle, l'a toujours.
    await banc.redemarrer()
    const relue = (await lire(banc, deux.cookie, '/api/cabinet/traversee')).corps.traversee
    assert.deepEqual([relue.id, relue.fin?.issue], ['deuxieme-de-deux', 'gagnee'])
    assert.equal('divins' in relue, false, 'relue, la fin ne le redit pas')
    assert.deepEqual(divinsRanges(banc, deux), [`dv:hecate sous ${cleDeSerie('deuxieme-de-deux')}`])

    // Une troisième, les mains vides encore, le lendemain : sa condition tient toujours, et rien ne s'annonce. Le serveur
    // redémarre d'abord — il garde en mémoire la dernière qu'il a lue, et ne verrait pas celle qu'on écrit derrière lui.
    await banc.redemarrer()
    horloge.t = midi(27)
    ecrireLaTraversee(banc, deux, 'troisieme-de-deux', devantLeChoix(MAINS_VIDES), 3_000_000)
    assert.deepEqual(cles(await choisirLeLegendaire(banc, deux, 'troisieme-de-deux')), [])
    assert.deepEqual(divinsRanges(banc, deux), [`dv:hecate sous ${cleDeSerie('deuxieme-de-deux')}`])
  }))

test('Hécate ne descend ni sur un coffre ouvert, ni sur un achat, ni sur une traversée qui n’est pas gagnée — et jamais sur une traversée qui ne l’est pas elle-même', () =>
  avecBanc(midi(26), CABINET, async (banc) => {
    // Chacun a deux traversées menées au bout de leurs trois gardiens : une en base, l'autre gagnée ici par son dernier
    // geste. Une seule chose manque à chacun.
    const cas: [string, Traversee[], Traversee, string][] = [
      ['coffre', [MAINS_VIDES], AVEC_COFFRE, 'celle qui finit a ouvert un coffre'],
      ['marchand', [MAINS_VIDES], AVEC_ACHAT, 'celle qui finit a acheté chez le marchand'],
      ['avant', [AVEC_COFFRE], MAINS_VIDES, 'celle d’avant avait ouvert un coffre : une seule les mains vides'],
      ['achete', [AVEC_ACHAT], MAINS_VIDES, 'celle d’avant avait acheté : une seule les mains vides'],
      ['laissee', [abandonnee(MAINS_VIDES)], MAINS_VIDES, 'celle d’avant, les mains vides, n’a pas été gagnée'],
      // Un geste d'un code à venir — l'autre serveur d'une mise en ligne : on ne sait pas ce qu'il a pris, elle ne compte pas.
      ['illisible', [illisible(MAINS_VIDES)], MAINS_VIDES, 'celle d’avant porte un geste que ce code ne relit pas'],
      // Deux les mains vides déjà en base — d'avant la règle, que rien n'a rattrapées — : la troisième, par un coffre, ne la fait pas tomber.
      ['trois', [MAINS_VIDES, MAINS_VIDES], AVEC_COFFRE, 'elle ne descend que sur une traversée menée elle-même les mains vides'],
    ]
    for (const [login, avant, derniere, pourquoi] of cas) {
      const j = await joueur(banc, login)
      avant.forEach((t, k) => ecrireLaTraversee(banc, j, `d-avant-${k}-de-${login}`, t, 1000 * (k + 1), midi(24 + k)))
      ecrireLaTraversee(banc, j, `derniere-de-${login}`, devantLeChoix(derniere), 2_000_000)
      assert.deepEqual(cles(await choisirLeLegendaire(banc, j, `derniere-de-${login}`)), [], pourquoi)
      assert.deepEqual(divinsRanges(banc, j), [], pourquoi)
    }
  }))

// ── 2. Artémis, sur les trois journaux d'un compagnon ─────────────────────

test('Artémis descend à la trente-millième bonne réponse avec le même compagnon, à la fin d’une partie du jour — ni à 29 999, ni avec deux compagnons à vingt mille, ni sans compagnon', () =>
  avecBanc(midi(26), BASE, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const bob = await joueur(banc, 'bob')
    const cleo = await joueur(banc, 'cleo')
    const dede = await joueur(banc, 'dede')
    soireeDAvant(banc, alice, { loup: 29_999 })
    soireeDAvant(banc, bob, { loup: 29_998 })
    soireeDAvant(banc, cleo, { loup: 20_000, chat: 20_000 })
    // Quarante mille réponses au nom d'un loup qu'il n'a pas : ce que le jeu n'écrit jamais, et la forme la plus dure de « sans compagnon ».
    soireeDAvant(banc, dede, { loup: 40_000 })
    assert.deepEqual(await adopter(banc, alice, 'loup'), { loup: 29_999 })
    assert.deepEqual(await adopter(banc, bob, 'loup'), { loup: 29_998 })
    await adopter(banc, cleo, 'loup')
    assert.deepEqual(await adopter(banc, cleo, 'chat'), { loup: 20_000, chat: 20_000 })

    // Une seule bonne réponse sur dix : la trente-millième d'Alice, la 29 999ᵉ de Bob.
    const fin = await jouerLeJour(banc, horloge, alice, i => i === 0)
    assert.deepEqual(cles(fin), ['dv:artemis'])
    avecSonRecit(fin, 'dv:artemis')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:artemis sous ${cleDuJour(septembre(26))}`])
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, bob, i => i === 0)), [], 'à une bonne réponse près')
    // Un sans-faute de Cléo, son chat dans la niche : vingt mille dix avec lui, quarante mille dix en tout — pas avec le même.
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, cleo)), [], 'le même compagnon, pas tous ensemble')
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, dede)), [], 'sans compagnon, rien à compter')
    for (const j of [bob, cleo, dede]) assert.deepEqual(divinsRanges(banc, j), [])

    // Le lendemain, une de plus : trente mille une, sa condition tient toujours — elle ne redescend pas.
    horloge.t = midi(27)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice, i => i === 0)), [])
    assert.deepEqual(divinsRanges(banc, alice), [`dv:artemis sous ${cleDuJour(septembre(26))}`])
    // Et Bob y arrive à son tour, un jour après elle.
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, bob, i => i === 0)), ['dv:artemis'])
    assert.deepEqual(divinsRanges(banc, bob), [`dv:artemis sous ${cleDuJour(septembre(27))}`])
  }))

test('Artémis compte ses soirées, son quiz du jour et sa campagne ensemble : elle descend à la fin de la série qui donne la trente-millième', () =>
  avecBanc(midi(26), BASE, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const bob = await joueur(banc, 'bob')
    soireeDAvant(banc, alice, { loup: 29_989 })
    soireeDAvant(banc, bob, { loup: 29_988 })
    await adopter(banc, alice, 'loup')
    await adopter(banc, bob, 'loup')
    // Dix au quiz du jour : 29 999 pour Alice — rien encore.
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice)), [])
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, bob)), [])
    assert.equal((await lire(banc, alice.cookie, '/api/joueur/niche')).corps.niche.justes, 29_999, 'ses soirées et son quiz du jour, ensemble')

    // Une série : une bonne réponse, puis ses trois vies. La trente-millième est celle-là.
    const serie = await jouerUneSerie(banc, alice, 1)
    assert.deepEqual(cles(serie.fin), ['dv:artemis'])
    avecSonRecit(serie.fin, 'dv:artemis')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:artemis sous ${cleDeSerie(serie.id)}`])
    assert.deepEqual(cles((await jouerUneSerie(banc, bob, 1)).fin), [], 'à une bonne réponse près')
    assert.deepEqual(divinsRanges(banc, bob), [])

    // Une autre série, deux de plus : elle ne redescend pas.
    assert.deepEqual(cles((await jouerUneSerie(banc, alice, 2)).fin), [])
    assert.deepEqual(divinsRanges(banc, alice), [`dv:artemis sous ${cleDeSerie(serie.id)}`])
  }))

// ── 3. Le Panthéon, la dernière part étant le quiz du jour ────────────────

test('le Panthéon descend sur le sans-faute qui finit sa journée : un palier à trois étoiles, un duel gagné, une traversée gagnée, le même jour de Paris — et rien s’il en manque une', () =>
  avecBanc(midi(26), BASE, async (banc, horloge) => {
    const matin = midi(26) - 3 * HEURE
    /** Sa traversée du jour, par un coffre : Hécate n'a rien à y voir. */
    const traversee = (j: Joueur, finieLe: number, t = AVEC_COFFRE) => ecrireLaTraversee(banc, j, `traversee-de-${j.login}`, t, finieLe - HEURE, finieLe)

    // Alice : ses trois parts du matin, puis son sans-faute.
    const alice = await joueur(banc, 'alice')
    palierValide(banc, alice, matin)
    duelAuDe(banc, alice, matin + HEURE)
    traversee(alice, matin + 2 * HEURE)
    const fin = await jouerLeJour(banc, horloge, alice)
    assert.deepEqual(cles(fin), ['dv:pantheon'])
    avecSonRecit(fin, 'dv:pantheon')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDuJour(septembre(26))}`])

    // À chacun de ceux-là, une seule chose manque.
    const temoins: [string, (j: Joueur) => void, ((i: number) => boolean) | undefined, string][] = [
      ['bob', j => (palierValide(banc, j, matin), duelAuDe(banc, j, minuit(26) - 1), traversee(j, matin)), undefined, 'son duel gagné hier, à une milliseconde de minuit'],
      ['cleo', j => (palierValide(banc, j, matin), duelAuDe(banc, j, matin), traversee(j, matin)), i => i !== 4, 'neuf sur dix au quiz du jour'],
      ['dede', j => (palierValide(banc, j, matin, { justes: QUESTIONS_PAR_EPREUVE - 1 }), duelAuDe(banc, j, matin), traversee(j, matin)), undefined, 'son palier validé à quinze sur seize : deux étoiles'],
      ['eve', j => (palierValide(banc, j, matin), duelAuDe(banc, j, matin, { justes: 6, sesJustes: 7 }), traversee(j, matin)), undefined, 'son duel du jour perdu'],
      ['fay', j => (palierValide(banc, j, matin), duelAuDe(banc, j, matin, { justes: 7, sesJustes: 7 }), traversee(j, matin)), undefined, 'son duel du jour à égalité'],
      ['gus', j => (palierValide(banc, j, minuit(26) - 1), duelAuDe(banc, j, matin), traversee(j, matin)), undefined, 'son palier validé hier, à une milliseconde de minuit'],
      ['hugo', j => (palierValide(banc, j, matin), duelAuDe(banc, j, matin), traversee(j, minuit(26) - 1)), undefined, 'sa traversée gagnée hier, à une milliseconde de minuit'],
      ['ines', j => (palierValide(banc, j, matin), duelAuDe(banc, j, matin), traversee(j, matin, abandonnee(AVEC_COFFRE))), undefined, 'sa traversée du jour abandonnée devant son légendaire'],
      ['jade', j => (palierValide(banc, j, matin), duelAuDe(banc, j, matin)), undefined, 'aucune traversée'],
    ]
    for (const [login, parts, juste, pourquoi] of temoins) {
      const j = await joueur(banc, login)
      parts(j)
      assert.deepEqual(cles(await jouerLeJour(banc, horloge, j, juste)), [], pourquoi)
      assert.deepEqual(divinsRanges(banc, j), [], pourquoi)
    }

    // Et les bornes du jour, de l'autre côté : tout au premier instant de ce jour de Paris, c'est aujourd'hui. Son duel
    // classé, il l'avait joué la veille au soir ; l'autre l'a fini à minuit — il compte au jour où il s'est joué des deux côtés.
    const kim = await joueur(banc, 'kim')
    palierValide(banc, kim, minuit(26))
    duelClasse(banc, kim, { lui: minuit(26) - 10 * 60_000, enFace: minuit(26) })
    traversee(kim, minuit(26))
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, kim)), ['dv:pantheon'], 'minuit pile est aujourd’hui')
    // L'inverse : un duel classé qu'il a fini aujourd'hui, contre un score posé la veille — joué des deux côtés aujourd'hui.
    const lou = await joueur(banc, 'lou')
    palierValide(banc, lou, matin)
    duelClasse(banc, lou, { lui: matin, enFace: minuit(26) - HEURE })
    traversee(lou, matin)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, lou)), ['dv:pantheon'], 'un duel classé compte comme un duel au dé')
  }))

test('le Panthéon lit le jour de Paris, pas vingt-quatre heures : le dimanche du changement d’heure en a vingt-cinq', () =>
  // Le 25 octobre 2026, 23 h 40 à Paris — 22 h 40 UTC, l'heure d'hiver revenue dans la nuit. Ce jour-là va du 24 à 22 h UTC
  // au 25 à 23 h UTC.
  avecBanc(Date.UTC(2026, 9, 25, 22, 40), BASE, async (banc, horloge) => {
    const debut = Date.UTC(2026, 9, 24, 22, 0)
    const vingtCinquieme = Date.UTC(2026, 9, 25, 22, 0)
    // Alice : une traversée gagnée à 0 h 10, heure d'été — plus de vingt-quatre heures avant son sans-faute — ; un palier à
    // 23 h 20, heure d'hiver, dans la vingt-cinquième heure du jour ; un duel dix minutes après. Le même jour, tous.
    const alice = await joueur(banc, 'alice')
    ecrireLaTraversee(banc, alice, 'traversee-d-alice', AVEC_COFFRE, debut - HEURE, debut + 10 * 60_000)
    palierValide(banc, alice, vingtCinquieme + 20 * 60_000)
    duelAuDe(banc, alice, vingtCinquieme + 30 * 60_000)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice)), ['dv:pantheon'])
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDuJour('2026-10-25')}`])
    // Bob, les mêmes — sauf sa traversée, gagnée à 23 h 59 la veille : onze minutes avant celle d'Alice, et un autre jour.
    const bob = await joueur(banc, 'bob')
    ecrireLaTraversee(banc, bob, 'traversee-de-bob', AVEC_COFFRE, debut - HEURE, debut - 60_000)
    palierValide(banc, bob, vingtCinquieme + 20 * 60_000)
    duelAuDe(banc, bob, vingtCinquieme + 30 * 60_000)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, bob)), [], 'sa traversée est de la veille')
    // Cléo : son palier une minute avant, à 23 h 59 la veille.
    const cleo = await joueur(banc, 'cleo')
    ecrireLaTraversee(banc, cleo, 'traversee-de-cleo', AVEC_COFFRE, debut - HEURE, debut + 10 * 60_000)
    palierValide(banc, cleo, debut - 60_000)
    duelAuDe(banc, cleo, vingtCinquieme + 30 * 60_000)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, cleo)), [], 'son palier est de la veille')
  }))

// ── 4. Le Panthéon, la dernière part étant une autre ──────────────────────

test('le Panthéon descend sur la traversée qui finit sa journée — dans la vue de sa fin, rangé sous elle ; et avec Hécate, si elle est la deuxième les mains vides', () =>
  avecBanc(midi(26), CABINET, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const bob = await joueur(banc, 'bob')
    const cleo = await joueur(banc, 'cleo')
    // Le sans-faute d'abord : il ne peut rien conclure seul.
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice)), [])
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, bob, i => i !== 0)), [])
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, cleo)), [])
    for (const j of [alice, bob, cleo]) {
      palierValide(banc, j, horloge.t)
      duelAuDe(banc, j, horloge.t)
    }
    horloge.t += HEURE

    // Alice gagne sa traversée, par un coffre : la dernière de ses quatre parts.
    ecrireLaTraversee(banc, alice, 'traversee-d-alice', devantLeChoix(AVEC_COFFRE), 2_000_000)
    const fin = await choisirLeLegendaire(banc, alice, 'traversee-d-alice')
    assert.deepEqual(cles(fin), ['dv:pantheon'])
    avecSonRecit(fin, 'dv:pantheon')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDeSerie('traversee-d-alice')}`])
    // Bob, la même : son quiz du jour avait une faute.
    ecrireLaTraversee(banc, bob, 'traversee-de-bob', devantLeChoix(AVEC_COFFRE), 2_000_000)
    assert.deepEqual(cles(await choisirLeLegendaire(banc, bob, 'traversee-de-bob')), [], 'neuf sur dix au quiz du jour')
    assert.deepEqual(divinsRanges(banc, bob), [])
    // Cléo, les mains vides, pour la deuxième fois : les deux descendent sur la même fin, chacun son récit.
    ecrireLaTraversee(banc, cleo, 'premiere-de-cleo', MAINS_VIDES, 1000, midi(20))
    ecrireLaTraversee(banc, cleo, 'deuxieme-de-cleo', devantLeChoix(MAINS_VIDES), 2_000_000)
    const double = await choisirLeLegendaire(banc, cleo, 'deuxieme-de-cleo')
    assert.deepEqual(cles(double), ['dv:hecate', 'dv:pantheon'])
    avecSonRecit(double, 'dv:hecate')
    avecSonRecit(double, 'dv:pantheon')
    assert.deepEqual(divinsRanges(banc, cleo), [`dv:hecate sous ${cleDeSerie('deuxieme-de-cleo')}`, `dv:pantheon sous ${cleDeSerie('deuxieme-de-cleo')}`])

    // Et par la même porte, Artémis : la trente-millième de Dana est tombée en soirée, où plus rien ne descend — elle
    // l'attendait à la fin de sa partie suivante jouée seule, et c'est une traversée.
    const dana = await joueur(banc, 'dana')
    soireeDAvant(banc, dana, { loup: 30_000 })
    assert.deepEqual(await adopter(banc, dana, 'loup'), { loup: 30_000 })
    ecrireLaTraversee(banc, dana, 'traversee-de-dana', devantLeChoix(AVEC_COFFRE), 2_000_000)
    const sienne = await choisirLeLegendaire(banc, dana, 'traversee-de-dana')
    assert.deepEqual(cles(sienne), ['dv:artemis'])
    avecSonRecit(sienne, 'dv:artemis')
    assert.deepEqual(divinsRanges(banc, dana), [`dv:artemis sous ${cleDeSerie('traversee-de-dana')}`])
  }))

test('le Panthéon descend sur le palier à trois étoiles qui finit sa journée — rejoué compris, pas à quinze sur seize', () =>
  avecBanc(midi(26), FORET, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const bob = await joueur(banc, 'bob')
    for (const j of [alice, bob]) {
      assert.deepEqual(cles(await jouerLeJour(banc, horloge, j)), [])
      duelAuDe(banc, j, horloge.t)
      ecrireLaTraversee(banc, j, `traversee-de-${j.login}`, AVEC_COFFRE, horloge.t - HEURE, horloge.t)
    }
    horloge.t += HEURE

    // Alice : seize sur seize, à sa première épreuve.
    const sienne = await jouerLePalier(banc, alice)
    assert.equal(sienne.fin.etoiles, 3)
    assert.deepEqual(cles(sienne.fin), ['dv:pantheon'])
    avecSonRecit(sienne.fin, 'dv:pantheon')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDeSerie(sienne.id)}`])

    // Bob : validé avec une faute — deux étoiles, rien. Puis il le rejoue sans une faute : ses trois étoiles, et sa journée.
    const validee = await jouerLePalier(banc, bob, 3)
    assert.equal(validee.fin.etoiles, 2)
    assert.deepEqual(cles(validee.fin), [], 'quinze sur seize')
    assert.deepEqual(divinsRanges(banc, bob), [])
    const rejouee = await jouerLePalier(banc, bob)
    assert.equal(rejouee.fin.epreuve.rejeu, true, 'un palier déjà validé se rejoue')
    assert.deepEqual(cles(rejouee.fin), ['dv:pantheon'])
    assert.deepEqual(divinsRanges(banc, bob), [`dv:pantheon sous ${cleDeSerie(rejouee.id)}`])
  }))

test('le Panthéon descend sur le duel au dé gagné qui finit sa journée — pas sur un duel perdu', async () => {
  const avant = CampagneStore.reponsesDAutomate
  // Automate trouve une question, puis rate ses trois vies : deux bonnes réponses le battent, et le duel s'arrête là.
  CampagneStore.reponsesDAutomate = () => [true, ...Array<boolean>(VIES).fill(false)]
  try {
    await avecBanc(midi(26), BASE, async (banc, horloge) => {
      const alice = await joueur(banc, 'alice')
      const bob = await joueur(banc, 'bob')
      for (const j of [alice, bob]) {
        assert.deepEqual(cles(await jouerLeJour(banc, horloge, j)), [])
        palierValide(banc, j, horloge.t)
        ecrireLaTraversee(banc, j, `traversee-de-${j.login}`, AVEC_COFFRE, horloge.t - HEURE, horloge.t)
      }
      horloge.t += HEURE

      const gagne = await jouerUneSerie(banc, alice, 2, '/api/campagne/rencontre')
      assert.deepEqual(cles(gagne.fin), ['dv:pantheon'])
      avecSonRecit(gagne.fin, 'dv:pantheon')
      assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDeSerie(gagne.id)}`])
      // Bob perd le sien : trois fautes d'emblée.
      const perdu = await jouerUneSerie(banc, bob, 0, '/api/campagne/rencontre')
      assert.deepEqual(cles(perdu.fin), [], 'son duel du jour est perdu')
      assert.deepEqual(divinsRanges(banc, bob), [])
    })
  } finally {
    CampagneStore.reponsesDAutomate = avant
  }
})

test('le Panthéon descend sur le duel classé gagné qui finit sa journée : à la dernière réponse de qui le joue en second, à sa page pour qui l’avait lancé', () =>
  avecBanc(midi(26), BASE, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const bob = await joueur(banc, 'bob')
    for (const j of [alice, bob]) {
      assert.deepEqual(cles(await jouerLeJour(banc, horloge, j)), [])
      palierValide(banc, j, horloge.t)
      ecrireLaTraversee(banc, j, `traversee-de-${j.login}`, AVEC_COFFRE, horloge.t - HEURE, horloge.t)
    }

    // Alice le lance et trouve trois questions ; Bob le relève et n'en trouve aucune. Sa fin à elle n'en savait rien,
    // la sienne à lui n'a rien gagné : c'est en ouvrant la page du duel qu'elle l'apprend — une fois.
    const premier = await duelParLesRoutes(banc, horloge, alice, 3, bob, 0)
    assert.deepEqual(cles(premier.premier.fin), [], 'elle a joué la première : sa fin ne sait pas si elle gagnera')
    assert.deepEqual(cles(premier.second.fin), [], 'il l’a perdu')
    horloge.t += 60_000
    const page = (await lire(banc, alice.cookie, `/api/campagne/duel/${premier.code}`)).corps
    assert.equal(page.nouveau, true)
    assert.deepEqual(cles(page), ['dv:pantheon'])
    avecSonRecit(page, 'dv:pantheon')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDeSerie(premier.premier.id)}`])
    assert.deepEqual(cles((await lire(banc, alice.cookie, `/api/campagne/duel/${premier.code}`)).corps), [], 'sa page relue ne le redit pas')

    // La revanche : elle n'en trouve qu'une, il la bat à sa deuxième bonne réponse — son duel du jour, et sa journée.
    const revanche = await duelParLesRoutes(banc, horloge, alice, 1, bob, 2)
    assert.deepEqual(cles(revanche.second.fin), ['dv:pantheon'])
    avecSonRecit(revanche.second.fin, 'dv:pantheon')
    assert.deepEqual(divinsRanges(banc, bob), [`dv:pantheon sous ${cleDeSerie(revanche.second.id)}`])
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDeSerie(premier.premier.id)}`])
  }))

test('le Panthéon ne se perd pas quand la victoire d’un duel lancé ne s’apprend que le lendemain : sa journée est celle où le duel s’est joué des deux côtés', () =>
  // Relevé en écrivant ces épreuves, le 21 novembre 2026 : la page du duel jugeait la journée de sa lecture
  // (`divinsDeSaVictoire` : « gagné aujourd'hui »). Ouverte le lendemain — ou cinq minutes après minuit —, la victoire de
  // la veille ne complétait plus aucune journée ; et cette lecture retenant le résultat vu, plus rien ne la rejugeait :
  // les quatre le même jour, et personne pour le dire.
  avecBanc(midi(26), BASE, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const bob = await joueur(banc, 'bob')
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice)), [])
    palierValide(banc, alice, horloge.t)
    ecrireLaTraversee(banc, alice, 'traversee-d-alice', AVEC_COFFRE, horloge.t - HEURE, horloge.t)
    // Elle le lance et le joue le 26 ; Bob le relève et le perd le 26 : ce jour-là, ses quatre parts y sont.
    const duel = await duelParLesRoutes(banc, horloge, alice, 3, bob, 0)
    assert.deepEqual(cles(duel.premier.fin), [])
    // Elle n'ouvre sa page que le lendemain à midi.
    horloge.t = midi(27)
    const page = (await lire(banc, alice.cookie, `/api/campagne/duel/${duel.code}`)).corps
    assert.equal(page.nouveau, true, 'elle apprend sa victoire')
    assert.deepEqual(cles(page), ['dv:pantheon'], 'sa journée du 26 est complète : la page qui lui apprend sa victoire la juge')
    assert.deepEqual(divinsRanges(banc, alice), [`dv:pantheon sous ${cleDeSerie(duel.premier.id)}`])
  }))

// ── 5. Il ne redescend pas ────────────────────────────────────────────────

test('descendu, le Panthéon ne redescend pas : le lendemain, les quatre parts refaites ne l’annoncent plus — ni au quiz du jour, ni au Cabinet', () =>
  avecBanc(midi(26), CABINET, async (banc, horloge) => {
    const alice = await joueur(banc, 'alice')
    const sesParts = (jour: number, palier: number) => {
      palierValide(banc, alice, midi(jour) - 3 * HEURE, { palier })
      duelAuDe(banc, alice, midi(jour) - 2 * HEURE)
      ecrireLaTraversee(banc, alice, `traversee-du-${jour}`, AVEC_COFFRE, midi(jour) - 2 * HEURE, midi(jour) - HEURE)
    }
    sesParts(26, 1)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice)), ['dv:pantheon'])
    const range = [`dv:pantheon sous ${cleDuJour(septembre(26))}`]
    assert.deepEqual(divinsRanges(banc, alice), range)

    // Le lendemain, les quatre de nouveau : son sans-faute les réunit encore, et rien ne s'annonce.
    horloge.t = midi(27)
    sesParts(27, 2)
    assert.deepEqual(cles(await jouerLeJour(banc, horloge, alice)), [])
    assert.deepEqual(divinsRanges(banc, alice), range)
    // Ni par une autre porte : une traversée de plus gagnée ce jour-là rejuge la même journée, et se tait de même.
    horloge.t += HEURE
    ecrireLaTraversee(banc, alice, 'une-de-plus', devantLeChoix(AVEC_COFFRE), midi(27))
    assert.deepEqual(cles(await choisirLeLegendaire(banc, alice, 'une-de-plus')), [])
    assert.deepEqual(divinsRanges(banc, alice), range)
  }))

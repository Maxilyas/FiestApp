// Ce que les deux gros gestes de la page des duels font attendre — le retour
// du propriétaire du 13 octobre 2026 : « quand je clique sur "Défier" ou le
// dé pour défier un automate, l'attente est perceptible ». En production,
// chaque `execute` et chaque `batch` est un aller-retour HTTP vers Turso —
// 230 ms en médiane, 765 au 95ᵉ centile, ce jour-là (`/healthz`) — : on
// compte ceux qui se suivent sur le fichier `file:` qui en tient lieu, comme
// `jour-charge.test.ts`.
//
// Le dé en attendait trois, l'un derrière l'autre : sa rencontre laissée et
// sa cote, puis ses séries et ce qu'il a vu, puis l'écriture. « Défier »
// attendait tout l'état de la campagne — quatre lectures de son passé, 800 ms
// en production — pour n'en lire que les catégories et les sujets, les mêmes
// pour tous.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { ProfileStore } from '../src/auth/profiles'
import { VUE_RECENTE_MS, parFraicheur } from '../src/core/campagne'

ProfileStore.tirageEclat = () => false

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure. */
const compte = { actif: false, appels: 0, finis: 0, sqls: [] as string[] }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    // Un aller-retour dure au moins un tour de boucle, comme sur le réseau :
    // ce qui part ensemble est en vol ensemble, et le rang d'un appel dit
    // combien d'allers-retours il a attendus (`enSerie`).
    const rang = compte.finis + 1
    if (compte.actif) await new Promise<void>(r => setImmediate(r))
    const res = await origine.apply(this, args)
    if (compte.actif) {
      compte.appels++
      compte.finis = Math.max(compte.finis, rang)
      const premiere = (methode === 'batch' ? (args[0] as unknown[])[0] : args[0]) as string | { sql: string }
      compte.sqls.push(`${rang}. ${(typeof premiere === 'string' ? premiere : premiere.sql).replace(/\s+/g, ' ').trim().slice(0, 70)}`)
    }
    return res
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; enSerie: number; sqls: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0, finis: 0, sqls: [] })
  try {
    const resultat = await travail()
    return { appels: compte.appels, enSerie: compte.finis, sqls: compte.sqls, resultat }
  } finally {
    compte.actif = false
  }
}

// ── Un joueur qui a déjà joué ─────────────────────────────────────────────

let banc: Banc
let cookie: string

const lire = (chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${r.status} ${lu.error ?? ''}`)
    return lu
  })
const poster = (chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => {
    const lu = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${lu.error}`)
    return lu
  })

before(async () => {
  // Le préchauffage de la campagne lit la base : loin des mesures.
  const base = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
  banc = await demarrer({ baseDeLaCampagne: base, prechauffageCampagneMs: 3_600_000 })
  cookie = await inscrireProfil(banc.url, 'lea', 'Léa')
  const profileId = ((await lire('/api/joueur/moi?leger')) as any).profile.id as string
  // Trois séries finies d'avant, écrites dans la base permanente : son niveau, ce qu'il a vu.
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const serie = db.prepare(
    `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 12, 0, 9, ?, ?, 'serie')`,
  )
  const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
  db.transaction(() => {
    for (let s = 0; s < 3; s++) {
      const id = randomUUID()
      const quand = Date.now() - (3 - s) * 86400_000
      serie.run(id, profileId, quand - 600_000, quand)
      for (let p = 0; p < 12; p++) reponse.run(id, p, base.questions[s * 12 + p].id, p < 9 ? 1 : 0, quand - 600_000 + p * 10_000)
    }
  })()
  db.close()
})

after(() => banc.close())

// ── Le dé ─────────────────────────────────────────────────────────────────

test('le dé lit d’un aller-retour sa rencontre laissée, sa cote, ses séries et ce qu’il a vu, puis écrit : deux en série, pas trois', async () => {
  const m = await mesurer(() => poster('/api/campagne/rencontre'))
  assert.ok(m.resultat.serie.question, 'une question à jouer')
  assert.equal(m.resultat.adversaire.nom, 'Automate')
  assert.equal(m.enSerie, 2, `${m.enSerie} allers-retours l’un derrière l’autre :\n${m.sqls.join('\n')}`)

  // Laissée en route, elle se reprend d'un seul aller-retour, sans rien écrire.
  const reprise = await mesurer(() => poster('/api/campagne/rencontre'))
  assert.equal(reprise.resultat.serie.id, m.resultat.serie.id, 'la même rencontre, reprise')
  assert.equal(reprise.enSerie, 1, reprise.sqls.join('\n'))
  assert.equal(reprise.appels, 1, `une seule requête vers la base :\n${reprise.sqls.join('\n')}`)
})

// ── « Défier » ────────────────────────────────────────────────────────────

test('« Défier » : ce que la préparation propose — les catégories et les sujets de la campagne — se lit sans toucher à la base', async () => {
  const etat = await lire('/api/campagne')
  const m = await mesurer(() => lire('/api/campagne/choix'))
  assert.deepEqual(m.resultat, { categories: etat.categories, sujets: etat.sujets }, 'les mêmes que la campagne')
  assert.equal(m.resultat.categories.length, CATEGORIES.length)
  assert.equal(m.appels, 0, `rien de son passé n’y sert :\n${m.sqls.join('\n')}`)
  // Comme toute la campagne : pour les profils.
  assert.equal((await fetch(`${banc.url}/api/campagne/choix`)).status, 401)
})

const client = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')

test('« Défier » s’ouvre sans attendre : la page des duels demande en fond ce que la préparation propose, et elle n’attend plus que cela', () => {
  const page = client('views/CampagneApp.tsx')
  // Demandé avec son code, la page montrée : touché, « Défier » trouve tout là.
  assert.match(page, /void lancement\.charger\(\)\.catch\(\(\) => \{\}\)\s*(\/\/[^\n]*\n\s*)*void lesChoix\(\)/)
  assert.match(page, /if \(!laPreparation \|\| laPreparation === 'perdu' \|\| !choixPourLancer \|\| adversaireAttendu\)/)
  // Plus rien de l'état de la campagne : quatre lectures de son passé, pour deux listes.
  assert.doesNotMatch(page, /etatPourLancer/)
  assert.match(client('api.ts'), /choix: \(\) => req<ChoixDeLaCampagne>\('\/api\/campagne\/choix'\)/)
})

test('le dé touché le montre tout de suite : il s’allume et roule tant que le serveur tire la série — allumé, immobile, sous le mouvement réduit', () => {
  const duels = client('views/Duels.tsx')
  assert.match(duels, /className=\{'duels-hasard' \+ \(roule \? ' roule' : ''\)\}/)
  // Le dé seul roule : la flèche d'une rencontre à reprendre tournerait sur elle-même.
  assert.match(duels, /<Icon name=\{reprendre \? 'play' : 'dice'\} className=\{reprendre \? undefined : 'duels-de'\} \/>/)
  assert.match(duels, /<BoutonsDesDuels busy=\{busy\} roule=\{busy\} /, 'sur la page, il roule pendant sa requête')
  // La page qui arrive l'attend sans le faire rouler (`duels-page.test.ts` la rend).
  assert.match(duels, /<BoutonsDesDuels busy reprendre=\{null\} \/>/)
  const css = client('styles.css')
  assert.match(css, /\.duels-hasard\.roule \{[^}]*border-color: var\(--accent\)/, 'son anneau s’allume, même immobile')
  assert.match(css, /\.duels-hasard\.roule \.duels-de \{[^}]*animation: duels-roule /)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.duels-hasard\.roule \.duels-de \{ animation: none; \}/)
})

// ── Le tirage d'une série ─────────────────────────────────────────────────

test('ranger par fraîcheur : le même ordre qu’un tri complet — jamais vues, vues de la plus ancienne, puis celles de ces vingt-quatre heures', () => {
  // L'ordre d'avant, un tri stable à comparateur : la référence. Il relisait
  // la fraîcheur de chaque question à chaque comparaison — 8 ms sur la vraie
  // base, à chaque série, quatre à dix fois plus au dixième de cœur.
  const reference = <T extends { id: string }>(questions: readonly T[], vues: ReadonlyMap<string, number>, maintenant: number): T[] => {
    const f = (id: string) => {
      const le = vues.get(id)
      return le === undefined ? [0, 0, 0] : [maintenant - le < VUE_RECENTE_MS ? 1 : 0, 1, le]
    }
    return [...questions].sort((a, b) => {
      const [x, y] = [f(a.id), f(b.id)]
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    })
  }
  const maintenant = Date.UTC(2026, 9, 13, 18)
  let graine = 7
  const hasard = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646
  for (let essai = 0; essai < 200; essai++) {
    const questions = Array.from({ length: 1 + Math.floor(hasard() * 60) }, (_, i) => ({ id: `q${i}` }))
    const vues = new Map<string, number>()
    for (const q of questions) {
      const r = hasard()
      // Des jamais vues, des vues il y a longtemps — certaines au même instant —, d'hier soir, et une horloge en avance.
      if (r < 0.3) continue
      vues.set(q.id, r < 0.5 ? maintenant - 30 * 86400_000 : r < 0.6 ? maintenant - 86400_000 * Math.floor(hasard() * 3) : r < 0.9 ? maintenant - Math.floor(hasard() * 2 * VUE_RECENTE_MS) : maintenant + 60_000)
    }
    assert.deepEqual(
      parFraicheur(questions, vues, maintenant).map(q => q.id),
      reference(questions, vues, maintenant).map(q => q.id),
      `essai ${essai}`,
    )
  }
})

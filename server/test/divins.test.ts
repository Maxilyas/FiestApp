// Les Divins : six avatars au-dessus des légendaires, dont personne ne
// connaît la règle.
//
// Trois promesses à tenir. La première : ils sont rares, et ne se mesurent
// qu'à ce que leur joueur a fait lui-même — ni rang, ni salle (le 21 novembre
// 2026 : ils ont quitté les soirées pour le quiz du jour, le défi de la
// semaine et les sentiers). La deuxième : leur règle ne quitte jamais le
// serveur. Ni le paquet du navigateur, ni une réponse d'API, ni l'étagère
// d'un profil ne doit la laisser deviner. La troisième : descendu, un Divin
// ne redescend pas — sa condition tenue le reste, et chaque partie d'après
// l'aurait annoncé de nouveau.
//
// Les règles se testent en dérivation pure ; ce qui descend au quiz du jour,
// sur un serveur jetable. Hélios se joue dans `campagne-defi.test.ts`,
// l'Arbre-Monde dans `sentiers-trophees.test.ts`, où vivent leurs parties.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import {
  JOURS_QUE_LA_FIN_RELIT,
  divinsDebloques,
  divinsDeLaFin,
  divinsDesSentiers,
  divinsDuDebut,
  divinsDuDefi,
  estUnDivin,
  raconter,
  type JourDuDivin,
  type ReponseDuDivin,
} from '../src/core/divins'
import { ProfileStore, cleDuJour } from '../src/auth/profiles'
import { DIVINS } from '../../shared/divins'
import { LEGENDAIRES, partiesDe } from '../../shared/legendaires'
import { clePalier } from '../../shared/hautsfaits'
import { jourAvant } from '../../shared/jour'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'

// Un Éclat tiré au hasard ferait tomber un palier : rien ici n'en dépend.
ProfileStore.tirageEclat = () => false

// ── 1. Les règles, en dérivation pure ─────────────────────────────────────

const JOUR = '2026-10-10'
const heures = (n: number) => Array.from({ length: n }, (_, h) => h)
/** Ses derniers jours finis, du plus ancien à celui-ci : leurs bonnes réponses sur dix. */
const jours = (...justes: (number | null)[]) =>
  new Map<string, JourDuDivin>(
    justes.flatMap((j, i): [string, JourDuDivin][] => (j === null ? [] : [[jourAvant(JOUR, justes.length - 1 - i), { justes: j, comptees: 10 }]])),
  )
const reponses = (ms: number, n = 10): ReponseDuDivin[] => Array.from({ length: n }, () => ({ juste: true, ms }))
const fin = (j: ReadonlyMap<string, JourDuDivin>, r: readonly ReponseDuDivin[] = reponses(8000)) => divinsDeLaFin(JOUR, j, r)

test('Chronos : une partie commencée à chacune des vingt-quatre heures', () => {
  assert.deepEqual(divinsDuDebut(heures(24)), ['dv:chronos'])
  assert.deepEqual(divinsDuDebut(heures(23)), [], 'il en manque une')
  // Mille parties à la même heure n'en font qu'une.
  assert.deepEqual(divinsDuDebut([...heures(23), ...Array<number>(100).fill(12)]), [])
  assert.deepEqual(divinsDuDebut([...heures(24), 3, 3, 17]), ['dv:chronos'])
})

test('le Séraphin : sans une faute, et chaque réponse avant trois secondes', () => {
  assert.deepEqual(fin(jours(10), reponses(2999)), ['dv:seraphin'])
  assert.deepEqual(fin(jours(10), reponses(3000)), [], 'trois secondes pile, c’est trop')
  // Une seule réponse lente suffit à le retenir.
  assert.deepEqual(fin(jours(10), [...reponses(1000, 9), { juste: true, ms: 3400 }]), [])
  // Une faute, même rapide ; une réponse sans chronomètre ; une réponse qui manque.
  assert.deepEqual(fin(jours(9), [...reponses(1000, 9), { juste: false, ms: 900 }]), [])
  assert.deepEqual(fin(jours(10), [...reponses(1000, 9), { juste: true, ms: null }]), [])
  assert.deepEqual(fin(jours(10), reponses(1000, 9)), [])
  // Une question annulée pour tous ne compte plus : neuf qui comptent, neuf rapides.
  const neuf = new Map<string, JourDuDivin>([[JOUR, { justes: 9, comptees: 9 }]])
  assert.deepEqual(divinsDeLaFin(JOUR, neuf, reponses(1000, 9)), ['dv:seraphin'])
})

test('le Lotus Sacré : cinq jours d’affilée, chacun meilleur que la veille, le dernier sans faute', () => {
  assert.equal(JOURS_QUE_LA_FIN_RELIT, 5, 'la fin d’une partie relit ce qu’il lui faut')
  assert.deepEqual(fin(jours(2, 4, 6, 8, 10)), ['dv:lotus'])
  assert.deepEqual(fin(jours(6, 7, 8, 9, 10)), ['dv:lotus'])
  assert.deepEqual(fin(jours(4, 6, 8, 10)), [], 'quatre jours ne suffisent pas')
  assert.deepEqual(fin(jours(2, 4, 6, 6, 10)), [], 'faire aussi bien que la veille n’est pas monter')
  assert.deepEqual(fin(jours(2, 4, 3, 8, 10)), [], 'une rechute en chemin')
  assert.deepEqual(fin(jours(1, 3, 5, 7, 9)), [], 'il faut finir sans faute')
  assert.deepEqual(fin(jours(2, 4, null, 8, 10)), [], 'un jour manqué casse la montée')
})

test('l’Ange Déchu : un sans-faute la veille, trois bonnes réponses au plus ce jour-ci', () => {
  assert.deepEqual(fin(jours(10, 3)), ['dv:dechu'])
  assert.deepEqual(fin(jours(10, 0)), ['dv:dechu'])
  assert.deepEqual(fin(jours(10, 4)), [], 'quatre, ce n’est pas tomber assez bas')
  assert.deepEqual(fin(jours(9, 2)), [], 'la veille n’était pas sans faute')
  assert.deepEqual(fin(jours(10, null, 2)), [], 'pas le lendemain')
  assert.equal(raconter(['dv:dechu'])[0].ton, 'ombre', 'il se gagne en tombant')
})

test('Hélios au défi de la semaine, l’Arbre-Monde sur les sentiers : leurs seuils', () => {
  assert.deepEqual(divinsDuDefi(20), ['dv:helios'])
  assert.deepEqual(divinsDuDefi(31), ['dv:helios'])
  assert.deepEqual(divinsDuDefi(19), [])
  assert.deepEqual(divinsDesSentiers(12), ['dv:arbre'])
  assert.deepEqual(divinsDesSentiers(11), [])
})

test('un profil garde les Divins que son étagère a rangés — et plus aucun ne se déduit de ses légendaires', () => {
  const rangees = new Map([['dv:seraphin', 1], ['dv:dechu', 1], ['hf:laurier', 12]])
  assert.deepEqual(divinsDebloques(rangees), ['dv:seraphin', 'dv:dechu'])
  // Jusqu'au 21 novembre 2026, l'Arbre-Monde se déduisait des légendaires : tous réunis, il ne descend plus.
  const tous = new Map<string, number>()
  for (const l of LEGENDAIRES) {
    for (const c of partiesDe(l.condition)) {
      if ('fois' in c) tous.set(c.hautFait, Math.max(tous.get(c.hautFait) ?? 0, c.fois))
      else for (let p = 1; p <= c.palier; p++) tous.set(clePalier(c.hautFait, p), 1)
    }
  }
  assert.deepEqual(divinsDebloques(tous), [])
  assert.ok(estUnDivin('dv:arbre') && !estUnDivin('lg:phenix') && !estUnDivin('hf:defi'))
})

// ── 2. Le secret ──────────────────────────────────────────────────────────

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'node_modules' || nom === 'dist' ? [] : sources(chemin)
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

/** Les constantes des règles, lues dans le module même : aucune ne s'écrit ailleurs, pas même en commentaire. */
const CONSTANTES_DES_REGLES = [...readFileSync(path.join(racine, 'server/src/core/divins.ts'), 'utf8').matchAll(/^(?:export )?const ([A-Z][A-Z0-9_]{5,}) =/gm)]
  .map(m => m[1])
  .filter(nom => nom !== 'RECITS')

test('ni les règles ni les légendes des Divins ne partent dans le navigateur', () => {
  assert.ok(CONSTANTES_DES_REGLES.length >= 6, `seulement ${CONSTANTES_DES_REGLES.length} constantes lues dans core/divins.ts`)
  const regles = new RegExp(CONSTANTES_DES_REGLES.join('|'))
  // Tout ce que le client emporte vient de client/ et de shared/ : aucun de
  // ces fichiers ne doit importer le module des règles…
  const emporte = [...sources(path.join(racine, 'client/src')), ...sources(path.join(racine, 'shared'))].map(f => ({
    f,
    texte: readFileSync(f, 'utf8'),
  }))
  assert.deepEqual(
    emporte.filter(({ texte }) => /from\s+['"][^'"]*core\/divins['"]/.test(texte)).map(({ f }) => f),
    [],
  )
  // …ni recopier une légende, ni même son début : lue dans le code de la
  // page, elle en dirait presque autant que la règle. Le commentaire de
  // `shared/divins.ts` qui en citait une, pour dire de ne pas le faire, la
  // laissait dans un fichier que le client importe (relevé le 14 octobre
  // 2026) : on cherche donc ses premiers mots, pas la légende entière.
  const legendes = raconter(DIVINS.map(d => d.key)).map(d => d.legende)
  assert.equal(legendes.length, DIVINS.length, 'chaque Divin a son récit')
  for (const legende of legendes) {
    const debut = legende.slice(0, 24)
    assert.deepEqual(emporte.filter(({ texte }) => texte.includes(debut)).map(({ f }) => f), [], legende)
  }
  // …ni le nom d'une constante de leurs règles, qui en dirait le sujet.
  assert.deepEqual(emporte.filter(({ texte }) => regles.test(texte)).map(({ f }) => f), [])
  // Le catalogue public ne porte que de quoi dessiner et nommer.
  for (const d of DIVINS) assert.deepEqual(Object.keys(d).sort(), ['key', 'nom'])
  // Et la documentation ne l'écrit pas non plus : la règle de l'Arbre-Monde
  // s'était glissée dans l'ancien RECOMPENSES.md et dans le CLAUDE.md, alors
  // que les règles vivent dans core/divins.ts « et nulle part ailleurs »
  // (invariants-4). Tout ce qui se lit hors du serveur se relit donc : le
  // README, le CLAUDE.md et ses règles (`.claude/rules/`), et chaque page de
  // `docs/`, la vitrine comprise — ni une constante, ni le début d'une légende.
  const documentation = [
    'README.md',
    'CLAUDE.md',
    ...readdirSync(path.join(racine, '.claude/rules'))
      .filter(f => f.endsWith('.md'))
      .map(f => `.claude/rules/${f}`),
    ...readdirSync(path.join(racine, 'docs'), { recursive: true })
      .map(f => `docs/${String(f).split(path.sep).join('/')}`)
      .filter(f => /\.(md|html)$/.test(f)),
  ]
  assert.ok(documentation.length > 30, `seulement ${documentation.length} pages relues`)
  for (const doc of documentation) {
    const texte = readFileSync(path.join(racine, doc), 'utf8')
    assert.doesNotMatch(texte, regles, doc)
    for (const legende of legendes) assert.ok(!texte.includes(legende.slice(0, 24)), `${doc} recopie le début d'une légende`)
  }
})

// ── 3. Au quiz du jour, sur un vrai serveur ───────────────────────────────

interface Horloge {
  t: number
}

async function avecBanc(debut: number, scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
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

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
const divinsRanges = (banc: Banc, login: string) =>
  base(banc, db =>
    (db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'dv:%' ORDER BY created_at`).all(idDe(banc, login)) as {
      badge: string
      soiree_id: string
    }[]).map(r => `${r.badge} sous ${r.soiree_id}`),
  )

/** Joue toute la partie du jour : `juste(i)` dit s'il trouve la question i, chaque réponse part au bout de `delai(i)` millisecondes. */
async function jouer(banc: Banc, horloge: Horloge, cookie: string, juste: (i: number) => boolean = () => true, delai: (i: number) => number = () => 5000) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    horloge.t += delai(i)
    const bonne = questions[i].bonne
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** Une partie finie d'un jour d'avant, écrite en base : ses bonnes réponses sur dix, et l'instant où elle a commencé. */
function joue(banc: Banc, login: string, jour: string, justes: number, commenceeLe: number) {
  const id = idDe(banc, login)
  base(banc, db => {
    db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(
      jour,
      JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
    )
    db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`,
    ).run(id, jour, commenceeLe, justes * 100, justes, commenceeLe + 120_000)
  })
}

/** Midi à Paris, un jour de septembre 2026 (heure d'été, UTC+2). */
const midi = (jour: number) => Date.UTC(2026, 8, jour, 10, 0)
const septembre = (jour: number) => `2026-09-${String(jour).padStart(2, '0')}`
const cles = (etat: any): string[] => (etat.divins ?? []).map((d: any) => d.key)

test('Chronos descend à la vingt-quatrième heure du cadran — à lui seul, avec son récit, et une seule fois', () =>
  // Samedi 26 septembre 2026, 23 h à Paris : la seule heure où Alice n'a jamais joué.
  avecBanc(Date.UTC(2026, 8, 26, 21, 0), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Vingt-trois jours, de minuit à 22 h, à l'heure de Paris ; Bob, toujours à midi.
    for (let h = 0; h < 23; h++) {
      joue(banc, 'alice', septembre(h + 1), 5, Date.UTC(2026, 8, h + 1, h - 2, 0))
      joue(banc, 'bob', septembre(h + 1), 5, midi(h + 1))
    }
    const fin = await jouer(banc, horloge, alice, i => i < 5)
    assert.deepEqual(cles(fin), ['dv:chronos'])
    assert.ok(fin.divins[0].legende.length > 0 && fin.divins[0].ton === 'eclat', 'son récit, à lui seul')
    assert.deepEqual(cles(await jouer(banc, horloge, bob, i => i < 5)), [], 'vingt-quatre parties à la même heure n’y font rien')

    // Le profil le garde — la liste, rien d'autre : ni sur l'étagère, ni dans le compte des badges.
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.deepEqual(moi.divins.map((d: any) => d.key), ['dv:chronos'])
    assert.ok(!moi.vitrine.some((b: any) => b.key.startsWith('dv:')), 'l’étagère dirait le jour où il est descendu')
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'dv:seraphin' }, alice, 'PUT')).status, 400, 'le Séraphin ne s’est pas montré')
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'dv:chronos' }, alice, 'PUT')).status, 200)

    // Le lendemain, sa condition tient toujours : il ne redescend pas, et rien ne s'annonce.
    horloge.t = Date.UTC(2026, 8, 27, 10, 0)
    assert.deepEqual(cles(await jouer(banc, horloge, alice, i => i < 5)), [])
    assert.deepEqual(divinsRanges(banc, 'alice'), [`dv:chronos sous ${cleDuJour('2026-09-26')}`])
    assert.deepEqual(divinsRanges(banc, 'bob'), [])
  }))

test('le Séraphin descend sur un sans-faute dont aucune réponse n’a attendu trois secondes', () =>
  avecBanc(midi(26), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const cleo = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐙')
    assert.deepEqual(cles(await jouer(banc, horloge, alice, () => true, () => 2000)), ['dv:seraphin'])
    // Une seule réponse à trois secondes ; une seule faute, même rapide.
    assert.deepEqual(cles(await jouer(banc, horloge, bob, () => true, i => (i === 7 ? 3000 : 2000))), [])
    assert.deepEqual(cles(await jouer(banc, horloge, cleo, i => i !== 4, () => 1000)), [])
    assert.deepEqual(divinsRanges(banc, 'alice'), [`dv:seraphin sous ${cleDuJour('2026-09-26')}`])
  }))

test('le Lotus Sacré descend au cinquième jour de progrès, l’Ange Déchu au lendemain d’un sans-faute', () =>
  avecBanc(midi(26), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const cleo = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐙')
    const dede = await inscrireProfil(banc.url, 'dede', 'Dédé', '🐸')
    // Alice monte depuis quatre jours ; Bob a fait aussi bien deux jours de suite.
    ;[2, 4, 6, 8].forEach((justes, i) => joue(banc, 'alice', septembre(22 + i), justes, midi(22 + i)))
    ;[2, 4, 8, 8].forEach((justes, i) => joue(banc, 'bob', septembre(22 + i), justes, midi(22 + i)))
    assert.deepEqual(cles(await jouer(banc, horloge, alice)), ['dv:lotus'])
    assert.deepEqual(cles(await jouer(banc, horloge, bob)), [])
    // Cléo et Dédé sortent d'un sans-faute : trois bonnes réponses pour l'une, quatre pour l'autre.
    joue(banc, 'cleo', septembre(25), 10, midi(25))
    joue(banc, 'dede', septembre(25), 10, midi(25))
    const chute = await jouer(banc, horloge, cleo, i => i < 3)
    assert.deepEqual(cles(chute), ['dv:dechu'])
    assert.equal(chute.divins[0].ton, 'ombre')
    assert.deepEqual(cles(await jouer(banc, horloge, dede, i => i < 4)), [])
  }))

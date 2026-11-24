// Les Divins : dix-huit avatars au-dessus des légendaires, dont personne ne
// connaît la règle — les six d'origine, et douze venus le 21 novembre 2026,
// leurs bijoux peints le lendemain.
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
// l'Arbre-Monde dans `sentiers-trophees.test.ts`, où vivent leurs parties ;
// les douze, chacun dans son mode : `divins-campagne.test.ts`,
// `divins-duels.test.ts`, `divins-au-dela.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import {
  JOURS_QUE_LA_FIN_RELIT,
  REVISIONS_QUE_LA_FIN_RELIT,
  divinsDebloques,
  divinsDeLaFin,
  divinsDeLaJournee,
  divinsDeLaJourneeEntiere,
  divinsDeLaPartie,
  divinsDeLaTraversee,
  divinsDesCompagnons,
  divinsDesRevisions,
  divinsDesSentiers,
  divinsDuDebut,
  divinsDuDefi,
  divinsDuPalier,
  estUnDivin,
  raconter,
  revisionQuiCompte,
  type JourDuDivin,
  type PartieDuDivin,
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

// ── Les douze du 21 novembre 2026 ─────────────────────────────────────────

test('Thot : dix de ses questions acceptées, dit au début de sa partie suivante', () => {
  assert.deepEqual(divinsDuDebut([], 10), ['dv:thot'])
  assert.deepEqual(divinsDuDebut([], 9), [])
  assert.deepEqual(divinsDuDebut(heures(24), 12), ['dv:chronos', 'dv:thot'])
})

test('Athéna : six jours d’affilée, une faute au plus chacun', () => {
  assert.equal(JOURS_QUE_LA_FIN_RELIT, 6, 'la fin d’une partie relit ce qu’il faut au plus long des siens')
  assert.deepEqual(fin(jours(9, 10, 9, 9, 10, 9)), ['dv:athena'])
  assert.deepEqual(fin(jours(9, 10, 9, 9, 9)), [], 'cinq jours ne suffisent pas')
  assert.deepEqual(fin(jours(9, 10, 8, 9, 10, 9)), [], 'deux fautes un seul jour')
  assert.deepEqual(fin(jours(9, 9, 9, null, 9, 9, 9)), [], 'un jour manqué casse la suite')
  // Une question annulée pour tous ne compte plus : huit sur neuf, c'est encore une seule faute.
  const avecUneAnnulee = jours(9, 10, 9, 9, 10, 9)
  avecUneAnnulee.set(jourAvant(JOUR, 2), { justes: 8, comptees: 9 })
  assert.deepEqual(fin(avecUneAnnulee), ['dv:athena'])
  // Elle ne demande pas de monter, le Lotus ne demande pas de tenir : l'un n'entraîne pas l'autre.
  assert.deepEqual(fin(jours(1, 6, 7, 8, 9, 10)), ['dv:lotus'])
  assert.deepEqual(fin(jours(10, 10, 10, 10, 10, 10)), ['dv:athena'])
})

const justes = (n: number) => Array<boolean>(n).fill(true)
const partie = (mode: PartieDuDivin['mode'], reponses: boolean[], gagne?: PartieDuDivin['gagne']) =>
  divinsDeLaPartie({ mode, justes: reponses.filter(Boolean).length, reponses, ...(gagne && { gagne }) })

test('le Démiurge : une série menée au bout, soixante sur soixante', () => {
  // Soixante d'affilée tiennent aussi le fil d'Ariane.
  assert.deepEqual(partie('serie', justes(60)), ['dv:demiurge', 'dv:ariane'])
  assert.deepEqual(partie('serie', justes(59)), ['dv:ariane'], 'il en manque une')
  assert.deepEqual(partie('serie', [...justes(30), false, ...justes(30)]), ['dv:ariane'], 'soixante bonnes, mais une faute en chemin')
  // Ni le défi ni un duel : soixante bonnes réponses n'y sont pas une série menée au bout.
  assert.deepEqual(partie('defi', justes(60)), ['dv:helios', 'dv:ariane'])
  assert.deepEqual(partie('duel', justes(60)), ['dv:ariane'])
})

test('Ariane : vingt-cinq bonnes réponses d’affilée dans une même partie, où qu’elle se joue', () => {
  assert.deepEqual(partie('serie', [...justes(25), false, false, false]), ['dv:ariane'])
  assert.deepEqual(partie('serie', [...justes(24), false, ...justes(24), false, false]), [], 'quarante-huit bonnes, jamais vingt-cinq de suite')
  // Le fil peut commencer n'importe où, et la partie se perdre : elle ne demande pas de gagner.
  assert.deepEqual(partie('duel', [false, false, false, ...justes(25)]), ['dv:ariane'])
  assert.deepEqual(partie('rencontre', [true, false, ...justes(25), false]), ['dv:ariane'])
})

test('Nikê : un duel classé gagné avec trente bonnes réponses', () => {
  const trente = [...justes(12), false, ...justes(18), false, false]
  assert.deepEqual(partie('duel', trente, 'classe'), ['dv:nike'])
  assert.deepEqual(partie('duel', trente.slice(1), 'classe'), [], 'vingt-neuf')
  assert.deepEqual(partie('duel', trente), [], 'perdu, ou à égalité')
  assert.deepEqual(partie('rencontre', trente, 'de'), [], 'au dé, on choisit son adversaire autant qu’on veut')
})

test('Osiris : un duel gagné après avoir raté ses deux premières questions', () => {
  const revenu = [false, false, ...justes(8), false]
  assert.deepEqual(partie('duel', revenu, 'classe'), ['dv:osiris'])
  assert.deepEqual(partie('rencontre', revenu, 'de'), ['dv:osiris'], 'au dé aussi')
  assert.deepEqual(partie('duel', revenu), [], 'revenu de loin, mais battu')
  assert.deepEqual(partie('duel', [false, true, false, ...justes(8)], 'classe'), [], 'la deuxième était bonne')
  assert.deepEqual(partie('duel', [false], 'classe'), [], 'une seule réponse n’en fait pas deux')
  // Tout à la fois : deux fautes, puis trente d'affilée, et la victoire.
  assert.deepEqual(partie('duel', [false, false, ...justes(30)], 'classe'), ['dv:ariane', 'dv:nike', 'dv:osiris'])
})

test('Mnémosyne : ses cinq dernières révisions pleines sans une faute', () => {
  assert.equal(REVISIONS_QUE_LA_FIN_RELIT, 5)
  assert.deepEqual(divinsDesRevisions([10, 10, 10, 10, 10]), ['dv:mnemosyne'])
  assert.deepEqual(divinsDesRevisions([10, 10, 10, 10]), [], 'quatre')
  assert.deepEqual(divinsDesRevisions([10, 10, 9, 10, 10]), [], 'une faute au milieu')
  // La plus récente d'abord : une faute d'il y a six révisions est oubliée, celle de tout à l'heure non.
  assert.deepEqual(divinsDesRevisions([10, 10, 10, 10, 10, 3]), ['dv:mnemosyne'])
  assert.deepEqual(divinsDesRevisions([9, 10, 10, 10, 10, 10]), [])
  // Ce qui compte : une révision pleine, et due tout entière. Cinq passes le même matin sur les mêmes dix questions,
  // revues en avance, la faisaient descendre (relevé au banc le 21 novembre 2026).
  assert.ok(revisionQuiCompte({ questions: 10, enAvance: 0 }))
  assert.ok(!revisionQuiCompte({ questions: 9, enAvance: 0 }), 'trop courte')
  assert.ok(!revisionQuiCompte({ questions: 10, enAvance: 1 }), 'une seule question revue en avance')
})

test('Héraclès, Artémis, Sisyphe, Hécate : leurs seuils', () => {
  assert.deepEqual(divinsDeLaJournee(1000), ['dv:heracles'])
  assert.deepEqual(divinsDeLaJournee(999), [])
  // Le même compagnon : deux qui s'en partagent le double n'y font rien.
  assert.deepEqual(divinsDesCompagnons([120, 30_000]), ['dv:artemis'])
  assert.deepEqual(divinsDesCompagnons([29_999, 29_999]), [])
  assert.deepEqual(divinsDesCompagnons([]), [])
  assert.deepEqual(divinsDuPalier(11), ['dv:sisyphe'])
  assert.deepEqual(divinsDuPalier(10), [])
  assert.deepEqual(divinsDeLaTraversee({ gagneesCeJour: 3 }), ['dv:hecate'])
  assert.deepEqual(divinsDeLaTraversee({ gagneesCeJour: 2 }), [], 'deux, le record du jour où la règle est arrivée')
})

test('le Panthéon : les quatre le même jour, pas une de moins', () => {
  const tout = { sansFaute: true, troisEtoiles: true, duel: true, traversee: true }
  assert.deepEqual(divinsDeLaJourneeEntiere(tout), ['dv:pantheon'])
  for (const part of Object.keys(tout) as (keyof typeof tout)[]) {
    assert.deepEqual(divinsDeLaJourneeEntiere({ ...tout, [part]: false }), [], `sans ${part}`)
  }
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

const MODULE_DES_REGLES = readFileSync(path.join(racine, 'server/src/core/divins.ts'), 'utf8')

/** Les constantes des règles, lues dans le module même : aucune ne s'écrit ailleurs, pas même en commentaire. */
const CONSTANTES_DES_REGLES = [...MODULE_DES_REGLES.matchAll(/^(?:export )?const ([A-Z][A-Z0-9_]{5,}) =/gm)]
  .map(m => m[1])
  .filter(nom => nom !== 'RECITS')

/**
 * Chaque Divin qui a son récit, au catalogue ou non : un récit écrit avant
 * que son bijou soit peint en dit déjà autant que sa règle, et ne doit pas
 * fuir davantage.
 */
const CLES_DES_RECITS = [...MODULE_DES_REGLES.matchAll(/^ {2}'(dv:[a-z]+)': \{ legende:/gm)].map(m => m[1])

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
  // …ni le Sphinx de l'accueil, qui souffle les légendes mot à mot, ni sa réserve d'énigmes : le paquet emporterait
  // les légendes entières et les réponses (invariant 21, le 24 novembre 2026). La page ne lit que `shared/sphinx.ts`.
  assert.deepEqual(
    emporte.filter(({ texte }) => /(from|import)\s*\(?\s*['"][^'"]*(core\/sphinx|content\/sphinx)[^'"]*['"]/.test(texte)).map(({ f }) => f),
    [],
  )
  assert.deepEqual(
    emporte.filter(({ texte }) => texte.includes('content/sphinx/') || texte.includes('enigmes.json')).map(({ f }) => f),
    [],
    'pas même le chemin de la réserve',
  )
  // …ni recopier une légende, ni même son début : lue dans le code de la
  // page, elle en dirait presque autant que la règle. Le commentaire de
  // `shared/divins.ts` qui en citait une, pour dire de ne pas le faire, la
  // laissait dans un fichier que le client importe (relevé le 14 octobre
  // 2026) : on cherche donc ses premiers mots, pas la légende entière.
  assert.ok(CLES_DES_RECITS.length >= 18, `seulement ${CLES_DES_RECITS.length} récits lus dans core/divins.ts`)
  assert.deepEqual(DIVINS.map(d => d.key).filter(cle => !CLES_DES_RECITS.includes(cle)), [], 'chaque Divin du catalogue a son récit')
  const recits = raconter(CLES_DES_RECITS)
  assert.equal(recits.length, CLES_DES_RECITS.length)
  // Un seul se gagne en tombant.
  assert.deepEqual(recits.filter(r => r.ton === 'ombre').map(r => r.key), ['dv:dechu'])
  const legendes = recits.map(d => d.legende)
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

// ── 4. Les deux du quiz du jour parmi les douze, et la porte du catalogue ──

/**
 * Le temps d'une épreuve, un Divin que le catalogue ne nommerait pas : sa
 * règle écrite avant que son bijou soit peint. Les douze du 21 novembre 2026
 * ont attendu les leurs un jour, endormis derrière cette porte.
 */
async function sansLeNommer<T>(cle: string, epreuve: () => Promise<T>): Promise<T> {
  const avant = ProfileStore.divinAuCatalogue
  ProfileStore.divinAuCatalogue = c => c !== cle && avant(c)
  try {
    return await epreuve()
  } finally {
    ProfileStore.divinAuCatalogue = avant
  }
}

test('Athéna descend au sixième jour d’affilée à une faute au plus — et dormirait tant que le catalogue ne la nomme pas', () =>
  avecBanc(midi(26), async (banc, horloge) => {
    // La porte d'office : le catalogue, et rien d'autre.
    assert.ok(ProfileStore.divinAuCatalogue('dv:helios') && ProfileStore.divinAuCatalogue('dv:athena') && !ProfileStore.divinAuCatalogue('dv:inconnu'))
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const cleo = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐙')
    // Cinq jours à une faute au plus pour Alice et Cléo ; Bob en a fait deux, il y a trois jours.
    for (const qui of ['alice', 'cleo']) [9, 10, 9, 9, 10].forEach((justes, i) => joue(banc, qui, septembre(21 + i), justes, midi(21 + i)))
    ;[9, 10, 8, 9, 10].forEach((justes, i) => joue(banc, 'bob', septembre(21 + i), justes, midi(21 + i)))

    // Cléo tient la règle, mais sans son nom au catalogue : rien ne descend, rien ne se range.
    await sansLeNommer('dv:athena', async () => assert.deepEqual(cles(await jouer(banc, horloge, cleo, i => i !== 3)), []))
    assert.deepEqual(divinsRanges(banc, 'cleo'), [])

    const fin = await jouer(banc, horloge, alice, i => i !== 3)
    assert.deepEqual(cles(fin), ['dv:athena'])
    assert.ok(fin.divins[0].legende.length > 0 && fin.divins[0].ton === 'eclat', 'son récit, à elle seule')
    assert.deepEqual(cles(await jouer(banc, horloge, bob, i => i !== 3)), [])
    // Elle est à elle : son profil la liste, et elle se porte — pas Bob.
    assert.deepEqual((await lire(banc, alice, '/api/joueur/moi')).corps.profile.divins.map((d: any) => d.key), ['dv:athena'])
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'dv:athena' }, alice, 'PUT')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'dv:athena' }, bob, 'PUT')).status, 400)
    // Le lendemain, sa suite tient toujours : elle ne redescend pas. Et Cléo, à qui la règle n'a rien repris en
    // dormant, la reçoit à sa partie suivante.
    horloge.t = midi(27)
    assert.deepEqual(cles(await jouer(banc, horloge, alice, i => i !== 3)), [])
    assert.deepEqual(cles(await jouer(banc, horloge, cleo, i => i !== 3)), ['dv:athena'])
    assert.deepEqual(divinsRanges(banc, 'alice'), [`dv:athena sous ${cleDuJour('2026-09-26')}`])
    assert.deepEqual(divinsRanges(banc, 'cleo'), [`dv:athena sous ${cleDuJour('2026-09-27')}`])
    assert.deepEqual(divinsRanges(banc, 'bob'), [])
  }))

/** Des questions de `login` acceptées pour le quiz du jour, relues à `quand` — ou retirées depuis (`statut`). */
function accepter(banc: Banc, login: string, combien: number, quand: number, statut = 'acceptee') {
  const id = idDe(banc, login)
  base(banc, db => {
    const ecrire = db.prepare(`INSERT INTO jour_propositions (id, profile_id, question, proposee_le, statut, relue_le) VALUES (?, ?, ?, ?, ?, ?)`)
    for (let i = 0; i < combien; i++) {
      ecrire.run(`${login}-${statut}-${quand}-${i}`, id, JSON.stringify({ text: `Question ${i} de ${login} ?`, answers: ['a', 'b'], correct: 0 }), quand - 1000, statut, quand)
    }
  })
}

test('Thot descend au début de la partie qui suit sa dixième question acceptée', () =>
  avecBanc(midi(26), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const cleo = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐙')
    accepter(banc, 'alice', 10, midi(25))
    accepter(banc, 'bob', 9, midi(25))
    // Dix pour Cléo aussi, mais l'une a été retirée depuis : elle n'est plus acceptée.
    accepter(banc, 'cleo', 9, midi(25))
    accepter(banc, 'cleo', 1, midi(25), 'retiree')
    const fin = await jouer(banc, horloge, alice, i => i < 5)
    assert.deepEqual(cles(fin), ['dv:thot'])
    assert.ok(fin.divins[0].legende.length > 0)
    assert.deepEqual(cles(await jouer(banc, horloge, bob, i => i < 5)), [])
    assert.deepEqual(cles(await jouer(banc, horloge, cleo, i => i < 5)), [])
    // La dixième de Bob est acceptée après sa partie du jour : c'est celle de demain qui le lui dit.
    accepter(banc, 'bob', 1, horloge.t)
    horloge.t = midi(27)
    assert.deepEqual(cles(await jouer(banc, horloge, bob, i => i < 5)), ['dv:thot'])
    assert.deepEqual(cles(await jouer(banc, horloge, alice, i => i < 5)), [], 'il ne redescend pas')
    assert.deepEqual(divinsRanges(banc, 'alice'), [`dv:thot sous ${cleDuJour('2026-09-26')}`])
    assert.deepEqual(divinsRanges(banc, 'bob'), [`dv:thot sous ${cleDuJour('2026-09-27')}`])
  }))

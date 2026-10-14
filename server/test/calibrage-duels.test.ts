// Le script qui mesure les duels sur la vraie base (`scripts/calibrage-duels.ts`,
// le souhait du propriétaire du 14 octobre 2026 : « avoir exactement les
// métriques utilisateur »). D'ici, il ne s'éprouve que sur une base jetable au
// vrai schéma — celle du banc : il doit relire le journal même que la cote
// relit, ne rien écrire, et ne nommer personne — sa sortie se colle dans une
// conversation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { VIES } from '../../shared/campagne'
import { baseDEssai, demarrer, type Banc } from './banc'

const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HEURE_MS = 3_600_000
const JOUR_MS = 24 * HEURE_MS
// Un lundi, 10 h à Paris.
const T0 = Date.UTC(2026, 9, 5, 8, 0)

const LEA = 'profil-secret-lea'
const TOM = 'profil-secret-tom'
const ZOE = 'profil-secret-zoe'

/**
 * Le script, lancé comme on le lance — jamais avec une base de
 * l'environnement : sur un poste de mesure, ce serait la vraie. Ni le proxy
 * de la machine : chaque épreuve dit le sien.
 */
function mesurer(args: string[] = [], plus: NodeJS.ProcessEnv = {}): Promise<{ code: number | null; sortie: string; erreurs: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const cle of ['PROD_LECTURE_URL', 'PROD_LECTURE_TOKEN', 'QUIZ_DB_URL', 'QUIZ_DB_TOKEN', 'INIT_CWD', 'HTTPS_PROXY', 'NODE_USE_ENV_PROXY']) delete env[cle]
  Object.assign(env, plus)
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--import', 'tsx', 'scripts/calibrage-duels.ts', ...args], { cwd: SERVEUR, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    let erreurs = ''
    proc.stdout.on('data', d => (sortie += d))
    proc.stderr.on('data', d => (erreurs += d))
    proc.on('error', reject)
    proc.on('close', code => resolve({ code, sortie, erreurs }))
  })
}

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Une série finie : allée au bout (plus de vies), ou abandonnée avec les siennes. */
function serie(db: Database.Database, joueur: string, justes: number, finieLe: number, { vies = 0, mode = 'serie' } = {}) {
  db.prepare(
    `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode)
     VALUES (?, ?, '[]', ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), joueur, justes + VIES - vies, vies, justes, finieLe - 60_000, finieLe, mode)
}

/** Un duel au dé fini : ses bonnes réponses contre le score d'Automate. */
function auDe(db: Database.Database, joueur: string, justes: number, sesJustes: number, finieLe: number) {
  const adversaire = { serie: randomUUID(), profil: '', simule: true, reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
  db.prepare(
    `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
     VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
  ).run(randomUUID(), joueur, justes + VIES, justes, finieLe - 60_000, finieLe, JSON.stringify(adversaire))
}

/**
 * Un duel lancé à quelqu'un — classé avec ses deux cotes figées, et depuis la montée ses deux cotes cachées, ou un
 * défi entre amis d'avant, sans —, joué des deux côtés.
 */
function duel(
  db: Database.Database,
  auteur: string,
  adversaire: string | null,
  justes: [number, number],
  lanceLe: number,
  cotes: [number, number] | null,
  cachees: [number, number] | null = null,
) {
  const code = randomUUID().slice(0, 6)
  db.prepare(
    `INSERT INTO campagne_duels (code, auteur, questions, cree_le, ferme_le, adversaire, cote_auteur, cote_adversaire, cote_cachee_auteur, cote_cachee_adversaire)
     VALUES (?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(code, auteur, lanceLe, lanceLe + 7 * JOUR_MS, adversaire, cotes?.[0] ?? null, cotes?.[1] ?? null, cachees?.[0] ?? null, cachees?.[1] ?? null)
  const second = adversaire ?? ZOE
  for (const [joueur, siennes, fin] of [
    [auteur, justes[0], lanceLe + 60_000],
    [second, justes[1], lanceLe + HEURE_MS],
  ] as const) {
    db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, duel)
       VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'duel', ?)`,
    ).run(randomUUID(), joueur, siennes + VIES, siennes, fin - 60_000, fin, code)
  }
}

const compter = (banc: Banc) =>
  base(banc, db => ['campagne_series', 'campagne_duels', 'sqlite_master'].map(t => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n))

test('le script relit le journal que la cote relit, rejoue les règles à l’essai, et ne nomme personne ni n’écrit rien', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(20) })
  try {
    base(banc, db => {
      // La campagne : Léa à 8,2 de moyenne, Tom à 5 ; une série abandonnée, qui ne dit pas jusqu'où elle serait allée.
      for (const [i, j] of [6, 8, 11, 7, 9].entries()) serie(db, LEA, j, T0 - (i + 1) * JOUR_MS)
      for (const [i, j] of [4, 7, 5, 6, 3].entries()) serie(db, TOM, j, T0 - (i + 1) * JOUR_MS)
      serie(db, LEA, 3, T0 - 6 * JOUR_MS, { vies: 2 })
      serie(db, LEA, 9, T0 - JOUR_MS / 2, { mode: 'defi' })
      serie(db, TOM, 5, T0 - JOUR_MS / 2, { mode: 'defi' })
      // Au dé : Léa gagne, perd, fait match nul, gagne ; Tom perd puis gagne.
      auDe(db, LEA, 9, 8, T0 + HEURE_MS)
      auDe(db, LEA, 5, 8, T0 + 2 * HEURE_MS)
      auDe(db, LEA, 8, 8, T0 + 3 * HEURE_MS)
      auDe(db, LEA, 10, 7, T0 + 4 * HEURE_MS)
      auDe(db, TOM, 6, 9, T0 + 1.5 * HEURE_MS)
      auDe(db, TOM, 7, 6, T0 + 2.5 * HEURE_MS)
      // Léa défie Zoé, qui gagne — leurs cotes cachées figées avec les autres, depuis la montée ; puis un défi entre
      // amis d'avant, amical : il ne compte pas.
      duel(db, LEA, ZOE, [7, 9], T0 + 5 * HEURE_MS, [1040, 1000], [1012, 1000])
      duel(db, TOM, null, [8, 4], T0 + 7 * HEURE_MS, null)
    })
    const avant = compter(banc)
    const { code, sortie, erreurs } = await mesurer([banc.quizDbUrl])
    assert.equal(code, 0, erreurs)

    assert.match(sortie, /Séries de campagne finies : 11 — allées au bout \(trois fautes\) : 10 · abandonnées en route : 1/)
    assert.match(sortie, /Allées au bout — 10 séries, 2 joueurs/)
    assert.match(sortie, /score : p10 [\d,]+ · p25 [\d,]+ · médiane 6,5 · p75 [\d,]+ · p90 [\d,]+ · moyenne 6,6/)
    assert.match(sortie, /8 ou plus : 30 % · plus de 10 : 10 % · 12 ou plus : 0 % · record 11/)
    assert.match(sortie, /Moyenne de chaque joueur \(5 séries ou plus\) — 2 joueurs\n\s+p10 [\d,]+ · p25 [\d,]+ · médiane 6,6/)
    assert.match(sortie, /Défi de la semaine, tentatives allées au bout — 2 séries, 2 joueurs/)

    assert.match(sortie, /Joueurs qui ont fini un duel classé : 3/)
    assert.match(sortie, /Parties jouées : 8 — au dé : 6 · contre quelqu’un : 2/, 'le défi entre amis d’avant, amical, n’est pas un duel classé')
    assert.match(sortie, /Issues au dé : gagnées 50 % · nulles 17 % · perdues 33 % — contre quelqu’un : gagnées 50 % · nulles 0 % · perdues 50 %/)
    assert.match(sortie, /Ligues : Bronze 3 · Argent 0 · Or 0 · Platine 0 · Diamant 0 · Maîtres 0/)

    // Rejouées aux règles d'aujourd'hui — la montée —, les deux cotes sont celles que l'application calcule : le rejeu est fidèle.
    assert.match(sortie, /retrouve la cote de chacun — 3 sur 3\./)
    assert.match(sortie, /Aujourd’hui \(1000 = 7, 50 points\)\s+3\s+0\s+0\s+0\s+0\s+0\s/)
    assert.match(sortie, /Avant la montée \(1000 = 8, 50 points\)\s+3\s+0\s+0\s+0\s+0\s+0\s/, 'l’ELO seul d’avant, pour comparer')
    for (const regles of ['Montée · 1000 = 7, 50 points', 'Montée · 1000 = 7, 75 points', 'Montée · 1000 = 7, 100 points']) {
      assert.ok(sortie.includes(regles), regles)
    }
    // Sous l'Or, la montée : le duel perdu de Léa ne la fait pas reculer, ni aucune partie au dé.
    assert.match(sortie, /Reculs : 0 % des parties font baisser la cote/)
    assert.match(sortie, /Cote cachée : p10 \d+/)
    // Une autre participation s'essaie : elle se dit sur chaque ligne essayée, pas sur celle d'aujourd'hui.
    const essai = await mesurer([banc.quizDbUrl, '--participation', '3'])
    assert.equal(essai.code, 0, essai.erreurs)
    assert.ok(essai.sortie.includes('Montée · 1000 = 7, 50 points · +3 sous l’Or'))
    assert.match(essai.sortie, /retrouve la cote de chacun — 3 sur 3\./)

    assert.ok(!sortie.includes('profil-secret'), 'la sortie ne nomme personne : elle se colle dans une conversation')
    assert.deepEqual(compter(banc), avant, 'rien n’est écrit')
  } finally {
    await banc.close()
  }
})

test('sans base, sur un fichier absent, une échelle illisible ou un hôte injoignable, il refuse et dit quoi faire — sans rien créer', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'calibrage-duels-'))
  try {
    const sansBase = await mesurer()
    assert.equal(sansBase.code, 1)
    assert.match(sansBase.erreurs, /PROD_LECTURE_URL/)
    assert.match(sansBase.erreurs, /Jamais QUIZ_DB_URL/)

    const absente = path.join(dir, 'absente.db')
    const introuvable = await mesurer([`file:${absente}`])
    assert.equal(introuvable.code, 1)
    assert.match(introuvable.erreurs, /Base introuvable/)
    assert.ok(!existsSync(absente), 'libsql aurait créé une base vide, et l’on aurait mesuré du vide')

    const vide = path.join(dir, 'vide.db')
    writeFileSync(vide, '')
    const illisible = await mesurer([`file:${vide}`, '--echelles', '7'])
    assert.equal(illisible.code, 1)
    assert.match(illisible.erreurs, /Échelle illisible : « 7 »/)

    // Le cloud, la première fois : derrière son proxy, sans NODE_USE_ENV_PROXY,
    // le `fetch` de Node ne trouvait pas l'hôte (ENOTFOUND), et l'on accusait la
    // politique réseau. `.invalid` ne se résout nulle part.
    const injoignable = await mesurer(['libsql://hote-introuvable.invalid'], { HTTPS_PROXY: 'http://127.0.0.1:9', PROD_LECTURE_TOKEN: 'jeton-d-essai' })
    assert.equal(injoignable.code, 1)
    assert.match(injoignable.erreurs, /lecture impossible/)
    assert.match(injoignable.erreurs, /relance avec NODE_USE_ENV_PROXY=1/)
    assert.ok(!`${injoignable.sortie}${injoignable.erreurs}`.includes('jeton-d-essai'), 'le jeton ne s’écrit jamais')
    // Ni l'adresse : le nom d'hôte d'une base porte celui que l'administrateur
    // lui a donné, un prénom parfois (la première mesure en production).
    assert.match(injoignable.sortie, /· base distante \(libsql\)/)
    assert.ok(!`${injoignable.sortie}${injoignable.erreurs}`.includes('hote-introuvable'), 'l’adresse d’une base distante ne s’écrit pas')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

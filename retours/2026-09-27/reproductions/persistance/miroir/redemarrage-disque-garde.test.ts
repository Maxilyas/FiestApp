// Un redémarrage sur disque GARDÉ — le PC de secours de MISE-EN-LIGNE.md,
// un auto-hébergement — pendant que Turso refusait les écritures.
//
// La file du miroir attendait encore : à l'arrêt, elle est abandonnée (et le
// journal le dit). Au redémarrage, la base locale est pleine : elle fait
// autorité, rien n'est rechargé — et rien ne recopie non plus au miroir ce
// qui lui manque. La resynchronisation ne part qu'après un échec suivi d'un
// succès (`reussite`) ; si Turso répond de nouveau dès le redémarrage,
// aucune n'a lieu. Le miroir reste troué jusqu'à la clôture : si la soirée
// doit ensuite repartir de lui (disque perdu, soirée reprise sur Render), les
// réponses et les gains d'avant l'arrêt n'y sont pas.
//
// Écrite pour passer le jour où c'est corrigé (une resynchronisation de
// chaque espace au démarrage, quand la base locale n'est pas vide).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/miroir/redemarrage-disque-garde.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createQuizServer } from '../../../../server/src/server'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  emitAck,
  fermerTout,
  invite,
  lancerQuiz,
  patienter,
  qcm,
} from '../outils'

const RAPIDE = { reessaisMs: [40, 80, 160], alerteMs: 400, delaiExtinctionMs: 1500 }
const TABLES = ['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions', 'party_soiree']
const dir = path.join(import.meta.dirname, 'disque-garde')
const dbPath = path.join(dir, 'locale.db')
const permanente = path.join(dir, 'permanente.db')
const lancer = () => createQuizServer({ port: 0, dbPath, quizDbUrl: `file:${permanente}`, admin: ADMIN, miroir: RAPIDE })

function panne(armee: boolean) {
  const db = new Database(permanente)
  try {
    db.exec('CREATE TABLE IF NOT EXISTS panne_temoin (armee INTEGER)')
    db.exec('DELETE FROM panne_temoin')
    if (armee) db.exec('INSERT INTO panne_temoin VALUES (1)')
    for (const t of TABLES) {
      for (const op of ['INSERT', 'UPDATE']) {
        db.exec(`CREATE TRIGGER IF NOT EXISTS panne_${t}_${op} BEFORE ${op} ON ${t}
                 WHEN EXISTS (SELECT 1 FROM panne_temoin) BEGIN SELECT RAISE(ABORT, 'panne simulée du miroir'); END`)
      }
    }
  } finally {
    db.close()
  }
}

const compter = (fichier: string, table: string) => {
  const db = new Database(fichier, { readonly: true, fileMustExist: true })
  try {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
  } finally {
    db.close()
  }
}

test('après un redémarrage sur disque gardé, le miroir rattrape ce que la file avait dû abandonner', async () => {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let server = await lancer()
  try {
    let url = `http://localhost:${server.port}`
    const cookie = await connexionAnimateur(url)
    const quiz = await creerQuiz(url, cookie, [qcm('Une ?', ['Oui', 'Non'], 0, 90), qcm('Deux ?', ['Oui', 'Non'], 0, 90)])
    const host = await ecranCommun(url, cookie)
    const alice = await invite(url, 'Alice', '🦊')
    const bob = await invite(url, 'Bob', '🐻')
    await patienter(300)

    // Turso refuse d'écrire pendant la première question.
    panne(true)
    const sessionId = await lancerQuiz(host, quiz)
    await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'Q1', 15_000)
    const revelee = attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation', 15_000)
    for (const j of [alice, bob]) await emitAck(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    await revelee
    await patienter(300)
    const local = { gains: compter(dbPath, 'score_entries'), reponses: compter(dbPath, 'answer_log') }
    console.log('en local avant l’arrêt :', local)

    // Le PC s'arrête, Turso toujours muet : la file s'abandonne.
    fermerTout()
    await server.close()
    // Turso revient pendant qu'il redémarre ; la soirée continue sur le disque gardé.
    panne(false)
    server = await lancer()
    url = `http://localhost:${server.port}`
    await ecranCommun(url, cookie)
    await invite(url, 'Chloé', '🐼')
    await patienter(1500)
    const miroir = { gains: compter(permanente, 'party_scores'), reponses: compter(permanente, 'party_answers') }
    console.log('au miroir, soirée repartie sur le disque gardé :', miroir)

    // Le disque se perd ensuite : tout repart du miroir.
    fermerTout()
    await server.close()
    for (const s of ['', '-wal', '-shm']) rmSync(`${dbPath}${s}`, { force: true })
    server = await lancer()
    const reveil = { gains: compter(dbPath, 'score_entries'), reponses: compter(dbPath, 'answer_log') }
    console.log('au réveil suivant, disque effacé :', reveil)
    assert.deepEqual(reveil, local, 'les gains et les réponses de la première question ont survécu')
  } finally {
    fermerTout()
    await server.close()
  }
})

// Le mode d'une partie (`campagne_series.mode`) se lit dans une seule liste,
// `MODES_DE_SERIE` (`shared/campagne.ts`) : le type des parties, leur lecture
// (`versSerie`), le lieu d'un signalement (`rapportDe`). Un mode que la
// lecture ne connaissait pas se lisait en série — la chaîne de `versSerie`
// le disait d'elle-même : « l'expédition garde le sien, ou une série
// l'accepterait » —, et une partie du Cabinet de curiosités (`mode =
// 'cabinet'`, la conception du Cabinet, § 1.2) se serait laissée répondre,
// abandonner et corriger par les routes de la série, comme une série. Elle a
// les siennes ; celles de la série ne la connaissent pas, sinon pour la
// signaler, et le QG la compte à part.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { MODES_DE_SERIE, type EtatDeCampagne, type SerieDeCampagne, type SignalementDeCampagne } from '../../shared/campagne'
import type { VueDEnsemble } from '../../shared/qg'

ProfileStore.tirageEclat = () => false

/** Mercredi 21 octobre 2026, 10 h à Paris : un jour sans fête. */
const MERCREDI = Date.UTC(2026, 9, 21, 8)
const MINUTE = 60_000

type Reponse<T = any> = { status: number; corps: T }
const lire = <T = any>(banc: Banc, cookie: string, chemin: string): Promise<Reponse<T>> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const poster = <T = any>(banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse<T>> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as T }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/**
 * Une pièce du Cabinet telle que sa partie la garde à la position de sa
 * réponse : le cœur d'une question de la série — ici la question `essai000`
 * de la base d'essai, posée au Pari —, et d'où elle vient.
 */
const PIECE = {
  id: 'essai000',
  // Mot pour mot ceux de la base d'essai (`baseDEssai`) : sa version jouée est la sienne.
  texte: "Question d'essai numéro 0 : laquelle est la bonne ?",
  reponses: ['Autre A0', 'Bonne 0', 'Autre B0', 'Autre C0'],
  bonne: 1,
  categorie: 'Histoire',
  anecdote: "L'anecdote de la question 0.",
  niveau: 'facile',
  forme: 'pari',
  cabinet: { jeu: 'pari', manche: 0, tirage: 0, etape: 2 },
}

test('une partie du Cabinet n’est pas une série : ni ses routes, ni son record, ni la série en cours, ni les records par catégorie', async () => {
  const horloge = { t: MERCREDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(40) })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)

    // Une vraie série d'Histoire : trois bonnes réponses, puis trois fautes.
    const serie = (await poster<SerieDeCampagne>(banc, lea, '/api/campagne/serie', { categories: ['Histoire'] })).corps
    let question = serie.question
    for (let i = 0; question; i++) {
      horloge.t += 10_000
      const choix = question.reponses.findIndex(r => r.startsWith('Bonne') === i < 3)
      const r = await poster(banc, lea, `/api/campagne/serie/${serie.id}/reponse`, { index: question.index, choix })
      assert.equal(r.status, 200, r.corps.error)
      question = r.corps.finie ? undefined : r.corps.suivante
    }

    // Deux parties du Cabinet, écrites comme le Cabinet les écrira : l'une
    // finie, d'une pièce fausse — elle aurait battu le record de la série, et
    // d'une seule catégorie —, l'autre en route, une pièce jugée.
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories, issue)
         VALUES (?, ?, ?, 1, 0, ?, ?, ?, 'cabinet', ?, ?)`,
      )
      partie.run('cab-finie', id, JSON.stringify([PIECE]), 50, horloge.t + MINUTE, horloge.t + 2 * MINUTE, '["Histoire"]', 'manquee')
      partie.run('cab-en-route', id, JSON.stringify([PIECE]), 0, horloge.t + 3 * MINUTE, null, null, null)
      const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, forme) VALUES (?, 0, 'essai000', 0, 0, ?, 'pari')`)
      reponse.run('cab-finie', horloge.t + 2 * MINUTE)
      reponse.run('cab-en-route', horloge.t + 4 * MINUTE)
    })
    horloge.t += 5 * MINUTE

    // La page de la campagne : le record et les séries des seules séries, et rien en cours.
    const etat = (await lire<EtatDeCampagne>(banc, lea, '/api/campagne')).corps
    assert.deepEqual([etat.record, etat.series, etat.enCours], [3, 1, null], 'une partie du Cabinet, finie ou en route, n’est pas une série')
    assert.deepEqual(etat.records, [{ categorie: 'Histoire', record: 3 }], 'ni un record par catégorie')
    // Les paliers de la campagne lisent le même record (`statsDe`) : la fiche du QG le dit.
    assert.equal((await lire(banc, admin, `/api/admin/profils/${id}`)).corps.campagne.record, 3)

    // Les routes de la série ne la jouent pas : ni réponse, ni abandon — elle a les siennes.
    const repondue = await poster(banc, lea, '/api/campagne/serie/cab-en-route/reponse', { index: 1, choix: 0 })
    assert.deepEqual([repondue.status, repondue.corps.error], [400, 'Cette série est introuvable'])
    const abandonnee = await poster(banc, lea, '/api/campagne/serie/cab-en-route/abandon')
    assert.deepEqual([abandonnee.status, abandonnee.corps.error], [400, 'Cette série est introuvable'])
    // Une série neuve referme la série laissée, jamais la partie du Cabinet en route.
    assert.equal((await poster(banc, lea, '/api/campagne/serie', { categories: ['Histoire'] })).status, 200)
    assert.deepEqual(
      base(banc, db => db.prepare("SELECT finie_le, position, (SELECT COUNT(*) FROM campagne_reponses WHERE serie_id = 'cab-en-route') AS reponses FROM campagne_series WHERE id = 'cab-en-route'").get()),
      { finie_le: null, position: 1, reponses: 1 },
      'rien de la série ne l’a touchée',
    )

    // « Mes réponses » d'une partie du Cabinet se relisent au Cabinet.
    const corrigee = await lire(banc, lea, '/api/campagne/serie/cab-finie/correction')
    assert.deepEqual([corrigee.status, corrigee.corps.error], [400, 'Cette partie se relit au Cabinet'])

    // Une question de la base posée au Cabinet se signale par la route de la
    // série, à sa position ; le QG dit qu'il l'a jouée au Cabinet.
    const signalee = await poster(banc, lea, '/api/campagne/serie/cab-finie/signalement', { index: 0, texte: 'La réponse A se défend aussi' })
    assert.equal(signalee.status, 200, signalee.corps.error)
    const page = (await lire<{ campagne: SignalementDeCampagne[] }>(banc, admin, '/api/admin/signalements')).corps
    const signalement = page.campagne.find(s => s.questionId === 'essai000')
    assert.ok(signalement, 'la question signalée au QG')
    assert.deepEqual(
      signalement.rapports.map(r => [r.ou, r.reponse, r.juste, r.versionDAvant]),
      [['cabinet', 'Autre A0', false, undefined]],
      'jouée au Cabinet, et ce qu’il y avait répondu, dans la version que sa partie a gardée',
    )
    Object.assign(globalThis, { React })
    const { CarteDeCampagne } = await import(new URL('../../client/src/components/QgSignalements.tsx', import.meta.url).href)
    const { renderToStaticMarkup } = await import('react-dom/server')
    const carte = renderToStaticMarkup(React.createElement(CarteDeCampagne, { s: signalement, maintenant: horloge.t, occupe: false, faire: async () => {} }))
      .replace(/<!-- -->/g, '')
      // Lue sans ses espaces insécables, qui collent les guillemets et les « · ».
      .replace(/[  ]/g, ' ')
    assert.match(carte, /Histoire › [^<]* · Cabinet/, 'la tête de la carte dit où elle s’est jouée')
    assert.match(carte, /au Cabinet · a répondu « Autre A0 »/)

    // Le QG compte ses parties à part, sous-mode « Cabinet » de la campagne.
    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    assert.deepEqual(vue.campagne.aujourdhui.cabinet, { parties: 2, joueurs: 1 })
    assert.deepEqual(vue.campagne.aujourdhui.serie, { parties: 2, joueurs: 1 }, 'la série jouée, et celle qui vient de commencer')
  } finally {
    await banc.close()
  }
})

// ── Chaque mode écrit est un mode connu ──────────────────────────────────

const SOURCES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

/**
 * Les valeurs d'une liste SQL, coupées à ses virgules du premier niveau —
 * ni dans une parenthèse, ni dans une chaîne —, de `debut` jusqu'à la
 * parenthèse qui la ferme ou, après un `SELECT`, jusqu'à son `FROM`, son
 * `WHERE` ou la fin du texte.
 */
function valeursDe(texte: string, debut: number): string[] {
  const valeurs: string[] = []
  let profondeur = 0
  let chaine = false
  let courante = ''
  for (let i = debut; i < texte.length; i++) {
    const c = texte[i]
    if (chaine) {
      courante += c
      if (c === "'") chaine = false
      continue
    }
    if (c === '`' || (profondeur === 0 && /^\s(FROM|WHERE|ON CONFLICT)\b/.test(texte.slice(i, i + 13)))) break
    if (c === ')' && profondeur === 0) break
    if (c === "'") chaine = true
    if (c === '(') profondeur++
    if (c === ')') profondeur--
    if (c === ',' && profondeur === 0) {
      valeurs.push(courante.trim())
      courante = ''
    } else courante += c
  }
  valeurs.push(courante.trim())
  return valeurs
}

test('chaque mode qu’une partie s’écrit est un mode de la liste : aucun ne se lirait en série', () => {
  // La colonne est `NOT NULL DEFAULT 'serie'` depuis son `ajouterColonne` :
  // aucune ligne n'en est privée. Un mode que `versSerie` ne connaîtrait pas
  // ne peut donc venir que d'une écriture — et il se lirait en série.
  const fichiers = readdirSync(SOURCES, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts'))
  const ecrits: string[] = []
  let insertions = 0
  for (const f of fichiers) {
    const texte = readFileSync(path.join(SOURCES, f), 'utf8')
    for (const m of texte.matchAll(/INSERT INTO campagne_series\s*\(([^)]*)\)\s*(VALUES\s*\(|SELECT\s)/g)) {
      insertions++
      const colonnes = m[1].split(',').map(c => c.trim())
      const k = colonnes.indexOf('mode')
      // Sans la colonne, c'est le défaut de la table : une série.
      if (k < 0) continue
      const valeur = valeursDe(texte, m.index + m[0].length)[k]
      const lu = /^'([a-z]+)'$/.exec(valeur ?? '')
      assert.ok(lu, `${f} : le mode s’écrit en toutes lettres, pour que ce test le lise — « ${valeur} »`)
      assert.ok((MODES_DE_SERIE as readonly string[]).includes(lu[1]), `${f} : le mode « ${lu[1]} » manque à MODES_DE_SERIE — il se lirait en série`)
      ecrits.push(lu[1])
    }
  }
  // La série, la révision, le défi, le duel, la rencontre, l'épreuve, le parcours, l'expédition : sans eux, le test ne lirait rien.
  assert.ok(insertions >= 8, `${insertions} insertions de parties seulement`)
  assert.ok(new Set(ecrits).size >= 7, `les modes écrits : ${[...new Set(ecrits)].join(', ')}`)
  assert.ok(MODES_DE_SERIE.includes('cabinet'), 'le Cabinet est connu avant d’écrire sa première partie')
})

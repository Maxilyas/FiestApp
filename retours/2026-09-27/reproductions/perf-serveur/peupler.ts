// Un serveur qui a vécu : 500 profils, trente jours de quiz du jour, des
// soirées et des étagères — écrits directement dans la base permanente du
// banc (un fichier `file:`), serveur éteint ou au repos. Tout est tiré d'une
// graine : deux passes voient les mêmes données.
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { CATEGORIES } from '../../../shared/categories'
import { CATALOGUE_DES_PRIX } from '../../../server/src/core/stats'
import { HAUTS_FAITS_DE_SOIREE } from '../../../shared/hautsfaits'
import { jourAvant, xpDuJour, xpDuPodium } from '../../../shared/jour'

export interface Peuplement {
  /** Les profils, dans l'ordre : le premier est la joueuse assidue qu'on suit. */
  ids: string[]
  /** Le jeton de session de chaque profil qui en a un (les `joueursDuSoir` premiers). */
  jetons: Map<string, string>
  cookie: (id: string) => string
}

/** Un générateur à graine (mulberry32) : les mêmes données à chaque passe. */
function hasard(graine: number) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRENOMS = [
  'Alice', 'Bob', 'Camille', 'David', 'Emma', 'Farid', 'Gaëlle', 'Hugo', 'Inès', 'Jules', 'Karim', 'Léa', 'Marc', 'Nadia',
  'Oscar', 'Paula', 'Quentin', 'Rose', 'Sami', 'Théo', 'Ursule', 'Victor', 'Wanda', 'Xavier', 'Yasmine', 'Zoé',
]
const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🐙', '🐧', '🐨', '🦁', '🐯', '🐮', '🐷', '🐵']

export function peupler(
  fichier: string,
  opts: {
    spaceId: string
    /** Le jour du banc (Paris) : les trente jours d'avant sont joués, la veille n'est pas close. */
    aujourdhui: string
    profils?: number
    /** Combien ont joué la veille, que la première demande du jour clôt. */
    hier?: number
    /** Combien jouent chacun des jours d'avant. */
    parJour?: number
    jours?: number
    /** Combien ont une session (et jouent ce soir). */
    joueursDuSoir?: number
  },
): Peuplement {
  const { spaceId, aujourdhui, profils = 500, hier = 500, parJour = 200, jours = 30, joueursDuSoir = 200 } = opts
  const r = hasard(20260927)
  const db = new Database(fichier)
  db.pragma('journal_mode = WAL')
  const ids = Array.from({ length: profils }, (_, i) => `perf-${String(i).padStart(4, '0')}-${Math.floor(r() * 1e9).toString(36)}`)
  const jetons = new Map<string, string>()
  const maintenant = Date.UTC(2026, 8, 27, 5, 0)
  const prix = CATALOGUE_DES_PRIX.map(p => ({ key: p.key, emoji: p.emoji, title: p.title }))
  const hf = HAUTS_FAITS_DE_SOIREE.map(h => ({ key: h.key, emoji: h.emoji, title: h.title }))
  const catalogue = [...prix, ...hf]

  db.transaction(() => {
    const insProfil = db.prepare(`INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at, last_seen_at)
                                  VALUES (?, ?, ?, ?, 'auto', 'x', 'x', ?, ?, ?)`)
    const insSession = db.prepare(`INSERT INTO profile_sessions (id, profile_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, 'perf')`)
    const insXp = db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at, joueur_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    const insBadge = db.prepare(`INSERT OR IGNORE INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    ids.forEach((id, i) => {
      const xp = i === 0 ? 4200 : Math.floor(r() * 3000)
      insProfil.run(id, `joueur${String(i).padStart(4, '0')}`, PRENOMS[i % PRENOMS.length], AVATARS[i % AVATARS.length], xp, maintenant - 200 * 86400_000, maintenant)
      if (i < joueursDuSoir) {
        const jeton = `jetonperf${String(i).padStart(4, '0')}${'x'.repeat(24)}`
        jetons.set(id, jeton)
        insSession.run(createHash('sha256').update(jeton).digest('hex'), id, maintenant, maintenant + 300 * 86400_000, maintenant)
      }
      // Ses soirées : vingt-cinq pour l'assidue, jusqu'à dix pour les autres.
      const soirees = i === 0 ? 25 : Math.floor(r() * 11)
      for (let s = 0; s < soirees; s++) {
        const at = maintenant - Math.floor((s + 1) * 7 * 86400_000 * (0.8 + r() * 0.4))
        const soireeId = `2026-${String(1 + (s % 9)).padStart(2, '0')}-${String(1 + (s % 27)).padStart(2, '0')}-${Math.floor(r() * 36 ** 5).toString(36)}`
        const releve = {
          questions: 40,
          reponses: 38,
          qcm: 32,
          justes: Math.floor(r() * 30),
          tempsJustesMs: 90_000,
          meilleurTempsMs: 1800,
          categories: Object.fromEntries(CATEGORIES.slice(0, 6).map(c => [c, { questions: 5, justes: Math.floor(r() * 5) }])),
        }
        insXp.run(id, soireeId, spaceId, 150, JSON.stringify({ v: 6, gain: { reponses: 38, justesse: 60 }, releve }), at, '')
        // Un prix ou un haut fait par soirée, ou rien.
        if (r() < 0.6) {
          const b = catalogue[Math.floor(r() * catalogue.length)]
          insBadge.run(id, b.key, soireeId, spaceId, b.emoji, b.title, at)
        }
      }
    })

    // Le quiz du jour : trente jours joués, la veille pas encore close.
    const insTirage = db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', ?)`)
    const insPartie = db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
                                  VALUES (?, ?, ?, 10, NULL, ?, ?, ?, ?)`)
    const insReponse = db.prepare(`INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    const insCloture = db.prepare(`INSERT INTO jour_clotures (jour, joueurs, close_le) VALUES (?, ?, ?)`)
    const insPodium = db.prepare(`INSERT INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, ?, ?, ?)`)
    const insXpJour = db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, ?)
                                  ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = xp + excluded.xp`)
    for (let k = jours; k >= 1; k--) {
      const jour = jourAvant(aujourdhui, k)
      const debut = Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)), 18, 0)
      const questions = Array.from({ length: 10 }, (_, q) => ({
        reserveId: `res-${jour}-${q}`,
        texte: `Question ${q + 1} du ${jour} : quel est le nom de ce grand fleuve qui traverse plusieurs pays d’Europe ?`,
        reponses: ['Le Danube, bien sûr', 'La Loire, évidemment', 'Le Rhin, sans hésiter', 'La Volga, à coup sûr'],
        bonne: Math.floor(r() * 4),
        categorie: CATEGORIES[(q + k) % CATEGORIES.length],
        duree: 20,
        lectureMs: 3000,
        anecdote: 'Une anecdote de cent cinquante caractères environ, pour que le tirage pèse ce qu’il pèse en vrai une fois écrit par la routine.',
      }))
      insTirage.run(jour, JSON.stringify(questions), debut - 3600_000)
      // La veille : tout le monde ; avant : parJour tirés au hasard, et l'assidue.
      const joueurs = k === 1 ? ids.slice(0, hier) : [ids[0], ...ids.slice(1).filter(() => r() < parJour / profils)]
      const classes: { id: string; points: number }[] = []
      for (const id of joueurs) {
        let points = 0
        let justes = 0
        const t0 = debut + Math.floor(r() * 3 * 3600_000)
        for (let q = 0; q < 10; q++) {
          const juste = r() < 0.6
          const ms = 2000 + Math.floor(r() * 15000)
          const p = juste ? Math.max(50, 200 - Math.floor(ms / 100)) : 0
          points += p
          justes += juste ? 1 : 0
          insReponse.run(id, jour, q, juste ? questions[q].bonne : (questions[q].bonne + 1) % 4, ms, juste ? 1 : 0, p, t0 + q * 25_000)
        }
        const xp = xpDuJour(points, 2000)
        insPartie.run(id, jour, t0, points, justes, t0 + 250_000, xp)
        if (xp > 0) insXpJour.run(id, xp, JSON.stringify({ v: 6, jours: 1 }), t0)
        classes.push({ id, points })
      }
      if (k >= 2) {
        insCloture.run(jour, joueurs.length, debut + 86400_000)
        classes.sort((a, b) => b.points - a.points)
        classes.slice(0, 3).forEach((c, i) => insPodium.run(jour, c.id, i + 1, c.points, xpDuPodium(i + 1, joueurs.length)))
      }
    }
  })()
  db.close()
  return {
    ids,
    jetons,
    cookie: id => `qz_joueur=${jetons.get(id)}`,
  }
}

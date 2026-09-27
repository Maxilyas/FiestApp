// Outils de l'atelier design-recompenses : un banc qui sert le client construit
// dans ce dossier, des profils riches écrits dans la base permanente, et de
// quoi mesurer ce qu'on photographie.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'
import { xpDuNiveau, releveVide } from '../../../shared/profil'
import { hautFait, clePalier } from '../../../shared/hautsfaits'
import { VERSION_BAREME, cleDuJour } from '../../../server/src/auth/profiles'
import { jourAvant, jourDe } from '../../../shared/jour'

export const ICI = path.dirname(fileURLToPath(import.meta.url))
export const CAPTURES = path.join(ICI, 'captures')
mkdirSync(CAPTURES, { recursive: true })

export function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'atelier.js'))('playwright')
}

export async function banc(): Promise<Banc> {
  return demarrer({ clientDist: path.join(ICI, 'dist') })
}

export function base<T>(b: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(b.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

export const idDe = (b: Banc, login: string) =>
  base(b, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
export const espaceDe = (b: Banc) =>
  base(b, db => (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id)

/** Le niveau voulu, par la ligne du quiz du jour (la seule que le démarrage ne relit pas). */
export function mettreAuNiveau(b: Banc, id: string, niveau: number, enPlus = 0) {
  const xp = xpDuNiveau(niveau) + enPlus
  base(b, db => {
    db.prepare(`DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = '#jour'`).run(id)
    db.prepare(
      `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`,
    ).run(id, xp, JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xp, id)
  })
}

/** Des lignes d'étagère : [clé, fois]. Un palier de carrière : `hf:habitue:3` range aussi les paliers d'en dessous. */
export function etagere(b: Banc, id: string, lignes: [string, number][]) {
  const espace = espaceDe(b)
  base(b, db => {
    const insert = db.prepare(
      `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const [cle, fois] of lignes) {
      const m = /^(hf:[a-z-]+):(\d)$/.exec(cle)
      const cles = m ? Array.from({ length: Number(m[2]) }, (_, i) => clePalier(m[1], i + 1)) : [cle]
      const duJour = /^hf:(assidu|sans-faute|champion-du-jour)/.test(cle)
      for (const k of cles) {
        const h = hautFait(k.replace(/:\d$/, ''))
        for (let i = 0; i < fois; i++) {
          insert.run(id, k, duJour ? cleDuJour('2026-06-01') : `soiree-${i + 1}`, duJour ? '' : espace, h?.emoji ?? '🏅', h?.title ?? k, 1000 + i)
        }
      }
    }
  })
}

/** Des soirées rangées : de quoi remplir la fiche, les courbes et les écussons. */
export function soirees(b: Banc, id: string, n: number, categories: Record<string, number>) {
  const espace = espaceDe(b)
  base(b, db => {
    const insert = db.prepare(
      `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 0, ?, ?)`,
    )
    for (let i = 0; i < n; i++) {
      // Les bonnes réponses de chaque catégorie, réparties sur les soirées.
      const cats: Record<string, { questions: number; justes: number }> = {}
      for (const [c, justes] of Object.entries(categories)) {
        const part = Math.floor(justes / n) + (i < justes % n ? 1 : 0)
        if (part > 0) cats[c] = { questions: Math.ceil(part * 1.4), justes: part }
      }
      const justes = Object.values(cats).reduce((s, c) => s + c.justes, 0)
      const releve = {
        ...releveVide(),
        questions: 50,
        reponses: 48,
        qcm: 42,
        justes: Math.min(42, 20 + (i % 7) * 3),
        tempsJustesMs: 30 * 4100,
        meilleurTempsMs: 900 + i * 13,
        reflexes: 3 + (i % 4),
        premiers: 2,
        meilleureSerie: 4 + (i % 5),
        estimations: 8,
        estimationsExactes: i % 2,
        estimationsProches: 3,
        estimationsComparees: 8,
        coupDOeil: 5 + (i % 3),
        quizJoues: 2,
        quizGagnes: i % 3 === 0 ? 1 : 0,
        podiumsQuiz: 1 + (i % 2),
        rang: 1 + (i % 4),
        joueurs: 12,
        points: 4200 + i * 180,
        avatar: '🦊',
        categories: cats,
      }
      void justes
      insert.run(id, `soiree-${i + 1}`, espace, JSON.stringify({ v: VERSION_BAREME, gain: {}, releve }), Date.UTC(2025, 9 + i, 12))
    }
  })
}

/** Des jours de quiz du jour joués, dont `victoires` gagnés. */
export function jours(b: Banc, id: string, joues: number, victoires: number) {
  base(b, db => {
    const partie = db.prepare(
      `INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, ?, ?, 1, 40)`,
    )
    const victoire = db.prepare(`INSERT OR IGNORE INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, 1, ?, 25)`)
    // Chaque jour déjà clos : sans quoi la première demande clôt ces nuits
    // et récrit la ligne #jour — le niveau posé à la main avec.
    const close = db.prepare('INSERT OR IGNORE INTO jour_clotures (jour, joueurs, close_le) VALUES (?, 5, 1)')
    for (let j = 1; j <= joues; j++) {
      const jour = new Date(Date.UTC(2026, 5, 1) + j * 86400000).toISOString().slice(0, 10)
      const justes = [10, 8, 6, 9, 7, 10, 5][j % 7]
      partie.run(id, jour, justes * 180, justes)
      close.run(jour)
      if (j <= victoires) victoire.run(jour, id, justes * 180)
    }
  })
}

export function eclat(b: Banc, id: string, avatar: string) {
  base(b, db =>
    db
      .prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, 'soiree-3', 3)`)
      .run(id, avatar),
  )
}

/** Les vainqueurs d'hier au quiz du jour : leur laurier suit leur prénom. */
export function laureatsDHier(b: Banc, ids: string[]) {
  const hier = jourAvant(jourDe(Date.now()))
  base(b, db => {
    db.prepare('INSERT OR IGNORE INTO jour_clotures (jour, joueurs, close_le) VALUES (?, ?, ?)').run(hier, ids.length + 3, Date.now())
    for (const id of ids) db.prepare('INSERT OR IGNORE INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, 1, 2000, 25)').run(hier, id)
  })
}

export async function changer(b: Banc, cookie: string, patch: object) {
  const r = await ecrire(b.url, '/api/joueur/moi', patch, cookie, 'PUT')
  const corps = (await r.json()) as any
  if (!r.ok) throw new Error(`PUT /api/joueur/moi ${JSON.stringify(patch)} : ${r.status} ${corps.error}`)
  return corps.profile
}

export { ADMIN, ecrire, inscrireProfil }
export type { Banc }

// ── Mesures dans la page ─────────────────────────────────────────────────
// En chaîne : tsx nomme les fonctions imbriquées (`__name`), que la page ne connaît pas.

/** Ce qui déborde de l'écran, les lauriers coupés, les prénoms coupés, les petits textes. */
export const RELEVE = `(() => {
  const vw = document.documentElement.clientWidth
  const out = { largeurPage: document.documentElement.scrollWidth, vw, hauteurPage: document.documentElement.scrollHeight, deborde: [], lauriers: [], coupes: [], petits: {} }
  const nom = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '')
  for (const e of document.querySelectorAll('body *')) {
    const b = e.getBoundingClientRect()
    if (!b.width || !b.height) continue
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden') continue
    if (b.right > vw + 0.5 && !e.closest('.carte-defile, .coupe-zone')) out.deborde.push(nom(e) + ' ' + Math.round(b.right))
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      const fs = parseFloat(cs.fontSize)
      if (fs < 12 && !e.closest('.sr-only')) { const k = nom(e) + ' ' + fs.toFixed(1) + 'px'; out.petits[k] = (out.petits[k] || 0) + 1 }
    }
  }
  for (const l of document.querySelectorAll('.laurier')) {
    const b = l.getBoundingClientRect()
    let visible = b.width > 0
    for (let p = l.parentElement; p && visible; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (/(hidden|clip|auto|scroll)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        const r = p.getBoundingClientRect()
        if (b.right > r.right + 0.5 || b.left < r.left - 0.5 || b.bottom > r.bottom + 0.5 || b.top < r.top - 0.5) visible = false
      }
    }
    const ligne = l.closest('.lb-row, .player-chip, .podium-col, .guess-row, li, p, h2, h3, .course, div')
    out.lauriers.push({ ou: ligne ? nom(ligne) : '?', taille: Math.round(b.width * 10) / 10, visible, texte: (ligne?.textContent || '').trim().slice(0, 40) })
  }
  for (const e of document.querySelectorAll('.nom-laure-texte, .lb-name, .podium-nom, .chip-prenom, .profil-identite h2, .carte-tete h3, .titre-porte')) {
    if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) out.coupes.push(nom(e) + ' « ' + e.textContent.trim().slice(0, 30) + ' » ' + e.clientWidth + '/' + e.scrollWidth)
  }
  return out
})()`

/** Contraste de chaque texte d'une boîte sur le fond réel : on cache le texte, on photographie, on lit les pixels. */
export async function contrastesSurFond(page: any, selecteur: string) {
  const textes: { t: string; couleur: string; r: { x: number; y: number; w: number; h: number } }[] = await page.evaluate(`(() => {
    const boite = document.querySelector(${JSON.stringify(selecteur)})
    const r0 = boite.getBoundingClientRect()
    const out = []
    for (const e of boite.querySelectorAll('*')) {
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
      if (e.closest('.sr-only')) continue
      const b = e.getBoundingClientRect()
      if (!b.width || b.bottom < r0.top || b.top > r0.bottom) continue
      out.push({ t: e.textContent.trim().slice(0, 36), couleur: getComputedStyle(e).color, taille: getComputedStyle(e).fontSize, r: { x: b.x, y: Math.max(b.y, r0.top), w: b.width, h: Math.min(b.bottom, r0.bottom) - Math.max(b.y, r0.top) } })
    }
    return out
  })()`)
  const voile = await page.addStyleTag({ content: `${selecteur} * { color: transparent !important; text-shadow: none !important; } ${selecteur} .av, ${selecteur} svg, ${selecteur} .hf-emoji { visibility: hidden !important; }` })
  await page.waitForTimeout(150)
  const png: Buffer = await page.screenshot({ type: 'png' })
  const dpr = await page.evaluate('devicePixelRatio')
  const args = [`data:image/png;base64,${png.toString('base64')}`, textes, dpr]
  const res = await page.evaluate(
    `(async ([src, textes, dpr]) => {
      const img = new Image(); img.src = src; await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      const g = c.getContext('2d'); g.drawImage(img, 0, 0)
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b)
      return textes.map(t => {
        const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(t.couleur)
        const lt = L(+m[1], +m[2], +m[3])
        const d = g.getImageData(Math.round(t.r.x * dpr), Math.round(t.r.y * dpr), Math.max(1, Math.round(t.r.w * dpr)), Math.max(1, Math.round(t.r.h * dpr))).data
        const crs = []
        for (let i = 0; i < d.length; i += 4) {
          const lf = L(d[i], d[i + 1], d[i + 2])
          crs.push((Math.max(lt, lf) + 0.05) / (Math.min(lt, lf) + 0.05))
        }
        crs.sort((a, b) => a - b)
        const q = f => Math.round(crs[Math.min(crs.length - 1, Math.floor(crs.length * f))] * 100) / 100
        return { texte: t.t, taille: t.taille, pire: q(0), p10: q(0.1), median: q(0.5) }
      })
    })(${JSON.stringify(args)})`,
  )
  await voile.evaluate((e: any) => e.remove())
  return res as { texte: string; taille: string; pire: number; p10: number; median: number }[]
}

export const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))

// Le podium du classement du jour, photographié au téléphone (360 × 640) avec
// chaque marche peinte : les trente-cinq marches (`decors.ts`, le groupe
// `podium`), trois par trois — une plaque par marche, Velours compris pour qui
// n'en a pas —, sous le Velours et l'Ivoire de celui qui regarde, puis une
// planche de toutes. Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-podium.ts [dossier]
//
// Il dit, pour chaque podium, si une marche sort de la colonne de la page, si
// un avatar touche le score au-dessus de lui, et si une pièce de rang n'est
// pas sur sa marche — et sort en erreur pour l'une ou l'autre.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { THEMES } from '../../shared/themes'

ProfileStore.tirageEclat = () => false

/**
 * Ce que la page dit de son podium, mesuré dans le navigateur (du JavaScript
 * en chaîne : le serveur se vérifie sans les types du navigateur) — sa place,
 * s'il sort de sa colonne, et pour chaque marche : si l'avatar ou le haut de
 * ce qui est posé sur ses coins (37,23 % de sa largeur au-dessus d'elle, le
 * gabarit) touche le score, si la pièce du rang sort de la marche, sa peinture.
 */
const MESURER = String.raw`() => {
  const e = document.querySelector('.podium-du-classement')
  const r = e.getBoundingClientRect()
  const col = e.parentElement.getBoundingClientRect()
  const marches = [...e.querySelectorAll('.pdc-marche')].map(m => {
    const valeur = m.querySelector('.pdc-valeur').getBoundingClientRect()
    const avatar = m.querySelector('.pdc-avatar > *')?.getBoundingClientRect()
    const socle = m.querySelector('.pdc-socle').getBoundingClientRect()
    const piece = m.querySelector('.pdc-socle b').getBoundingClientRect()
    const decor = socle.top - 0.3723 * socle.width
    return {
      classe: m.className,
      avatarTouche: (!!avatar && avatar.top < valeur.bottom) || decor < valeur.bottom,
      pieceDehors: piece.left < socle.left || piece.right > socle.right || piece.bottom > socle.bottom,
      peinture: getComputedStyle(m.querySelector('.pdc-socle'), '::before').backgroundImage,
    }
  })
  return { y: r.top + scrollY, h: r.height, deborde: r.left < col.left - 1 || r.right > col.right + 1, marches }
}`

const sortie = path.resolve(process.argv[2] ?? 'rendu-podium')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** Jeudi 19 novembre 2026, 18 h à Paris. */
const horloge = { t: Date.UTC(2026, 10, 19, 17, 0) }
const banc = await demarrer({ horlogeDuJour: () => horloge.t })
const navigateur = await chromium.launch({ headless: true })
const defauts: string[] = []
try {
  const gens: [string, string, string, number][] = [
    ['lea', 'Léa', '🦊', 1800],
    ['hugo', 'Hugo', '🐻', 1600],
    ['zoe', 'Zoé', '🐼', 1400],
    ['tom', 'Tom', '🐸', 1200],
    ['ines', 'Inès', '🦉', 1000],
  ]
  const cookies: Record<string, string> = {}
  for (const [login, nom, emoji] of gens) cookies[login] = await inscrireProfil(banc.url, login, nom, emoji)
  await fetch(`${banc.url}/api/jour`, { headers: { Cookie: cookies.tom } })
  const base = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
  {
    const db = base()
    const idDe = (login: string) => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
    const ins = db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp, temps_des_justes, justes_chronometrees)
                            VALUES (?, '2026-11-19', ?, 10, NULL, ?, ?, ?, 0, ?, ?)`)
    for (const [login, , , points] of gens) ins.run(idDe(login), horloge.t - 3_600_000, points, points / 200, horloge.t - 3_000_000, 4000 * (points / 200), points / 200)
    // Léa porte un portrait peint : un dessin sur sa marche, pas seulement un emoji.
    db.prepare(`UPDATE profiles SET legendaire = 'br:blaireau' WHERE login = 'lea'`).run()
    db.close()
  }
  await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookies.ines, 'PUT')

  // Trois par trois, dans l'ordre du catalogue : Velours (sans plaque) d'abord.
  const cles: (string | null)[] = THEMES.map(t => (t.key === 'velours' ? null : t.key))
  const trios: (string | null)[][] = []
  for (let i = 0; i < cles.length; i += 3) trios.push(cles.slice(i, i + 3))
  while (trios[trios.length - 1].length < 3) trios[trios.length - 1].push(null)

  for (const [n, trio] of trios.entries()) {
    const db = base()
    const pose = db.prepare('UPDATE profiles SET plaque = ? WHERE login = ?')
    pose.run(trio[0], 'lea')
    pose.run(trio[1], 'hugo')
    pose.run(trio[2], 'zoe')
    db.close()
    await banc.redemarrer()
    // Le premier podium aussi sur une tablette : la colonne y fait 560 points, la marche du premier près de 200.
    const ecrans: [string, string, number, number][] = [
      ['velours', 'tom', 360, 640],
      ['ivoire', 'ines', 360, 640],
      ...(n === 0 ? ([['tablette', 'tom', 768, 1024]] as [string, string, number, number][]) : []),
    ]
    for (const [theme, qui, largeur, hauteur] of ecrans) {
      const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2 })
      const [nom, valeur] = cookies[qui].split('=')
      await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
      const page = await contexte.newPage()
      page.on('pageerror', (e: Error) => defauts.push(`[page] ${e.message}`))
      await page.goto(`${banc.url}/jour#classement`)
      await page.waitForSelector('.podium-du-classement')
      // Les peintures se chargent : la photo les attend.
      await page.waitForFunction('document.fonts.status === "loaded"')
      await page.waitForTimeout(900)
      const mesure = (await page.evaluate(`(${MESURER})()`)) as {
        y: number
        h: number
        deborde: boolean
        marches: { classe: string; avatarTouche: boolean; pieceDehors: boolean; peinture: string }[]
      }
      const quoi = `podium ${n + 1} (${trio.map(c => c ?? 'velours').join(', ')}), ${theme}`
      if (mesure.deborde) defauts.push(`${quoi} : le podium sort de la colonne`)
      for (const m of mesure.marches) {
        if (m.avatarTouche) defauts.push(`${quoi} : ${m.classe} — l'avatar ou le décor touche le score`)
        if (m.pieceDehors) defauts.push(`${quoi} : ${m.classe} — la pièce de rang sort de sa marche`)
        if (!/url\(/.test(m.peinture)) defauts.push(`${quoi} : ${m.classe} — sans peinture`)
      }
      await page.screenshot({ path: path.join(sortie, `podium-${String(n + 1).padStart(2, '0')}-${theme}.png`), clip: { x: 0, y: mesure.y - 12, width: largeur, height: mesure.h + 24 } })
      if (n === 0) await page.screenshot({ path: path.join(sortie, `ecran-${theme}.png`) })
      await contexte.close()
    }
  }

  // La planche : chaque podium, Velours à gauche, Ivoire à droite — les photos dans la page même : une page vierge ne lit
  // pas les fichiers du disque.
  const planche = await navigateur.newPage({ viewport: { width: 1480, height: 800 }, deviceScaleFactor: 1 })
  const photo = (f: string) => `data:image/png;base64,${readFileSync(path.join(sortie, f)).toString('base64')}`
  const cellules = trios
    .map((_, n) => {
      const nn = String(n + 1).padStart(2, '0')
      return `<div class="paire"><img src="${photo(`podium-${nn}-velours.png`)}"><img src="${photo(`podium-${nn}-ivoire.png`)}"></div>`
    })
    .join('')
  await planche.setContent(
    `<!doctype html><style>body{margin:0;padding:12px;background:#1c1a18;display:grid;grid-template-columns:repeat(2,1fr);gap:14px}` +
      `.paire{display:flex;gap:6px}.paire img{width:360px}</style>${cellules}`,
  )
  await planche.waitForTimeout(500)
  await planche.screenshot({ path: path.join(sortie, 'planche.png'), fullPage: true })
  console.log(`${trios.length} podiums photographiés : ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}
for (const d of defauts) console.log(`✖ ${d}`)
if (defauts.length) process.exitCode = 1

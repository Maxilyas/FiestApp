// Les récompenses à l'écran, dans les pires cas d'un petit téléphone : ces
// épreuves échouent sur le code du 26 septembre 2026 (b57035c) et passeront
// le jour où les constats design-recompenses-1 à 3 seront corrigés.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/design-recompenses/design-recompenses.test.ts
//
// Le client doit être construit dans ce dossier (`dist/`, consignes-audit.md).
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { peupler, type Joueur } from './profils'
import { ADMIN, chargerPlaywright, patienter, type Banc } from './outils'
import { attendre, creerQuiz, ecranCommun, invite, lancerQuiz, qcm } from '../../../server/test/banc'

let b: Banc
let j: Record<string, Joueur>
let navigateur: any
let gaspard: { playerId: string; token: string }

// Un téléphone : 320 × 568 (un petit Android, l'iPhone SE), et 277 × 492 —
// un 360 × 640 au texte agrandi à 130 % (le zoom de page de Chrome Android).
const TAILLES = [
  { width: 320, height: 568, dsf: 2 },
  { width: 277, height: 492, dsf: 2.6 },
]

async function telephone(taille: (typeof TAILLES)[number], opts: { cookie?: string; moi?: { playerId: string; token: string } } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: taille.width, height: taille.height }, deviceScaleFactor: taille.dsf, isMobile: true, hasTouch: true })
  if (opts.cookie) {
    const [n, v] = opts.cookie.split('=')
    await ctx.addCookies([{ name: n, value: v, url: b.url }])
  }
  // PISTES=1 : les corrections proposées, injectées dans chaque page — l'épreuve doit alors passer.
  if (process.env.PISTES) {
    const css = readFileSync(path.join(import.meta.dirname, 'pistes.css'), 'utf8')
    await ctx.addInitScript((c: string) => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style')
        s.textContent = c
        document.head.append(s)
      })
    }, css)
  }
  if (opts.moi)
    await ctx.addInitScript(([cle, me]: string[]) => localStorage.setItem(cle, me), [`quizz.me.${ADMIN.slug}`, JSON.stringify(opts.moi)])
  return { ctx, page: await ctx.newPage() }
}

before(async () => {
  ;({ b, j } = await peupler())
  navigateur = await chargerPlaywright().chromium.launch({ headless: true })
})
after(async () => {
  await navigateur?.close()
  await b?.close()
})

test('les trois onglets du profil tiennent dans l’écran, jusqu’au texte agrandi', async () => {
  for (const taille of TAILLES) {
    const { ctx, page } = await telephone(taille, { cookie: j.mc.cookie })
    await page.goto(`${b.url}/profil`)
    await page.waitForSelector('.onglets-profil')
    const onglets: { nom: string; droite: number; bord: number }[] = await page.evaluate(`(() => {
      const liste = document.querySelector('.onglets-profil').getBoundingClientRect()
      return [...document.querySelectorAll('.onglets-profil [role=tab]')].map(o => ({
        nom: o.textContent.trim(), droite: o.getBoundingClientRect().right, bord: Math.min(liste.right, document.documentElement.clientWidth),
      }))
    })()`)
    await ctx.close()
    for (const o of onglets)
      assert.ok(o.droite <= o.bord + 0.5, `${taille.width} px : « ${o.nom} » sort de sa barre (${Math.round(o.droite)} > ${Math.round(o.bord)}) — le toucher ne l’atteint plus`)
  }
})

test('au classement et au podium du téléphone, un lauréat garde son prénom et son laurier', async () => {
  const cookie = (await import('../../../server/test/banc')).connexionAnimateur
  const admin = await cookie(b.url)
  const packId = await creerQuiz(b.url, admin, Array.from({ length: 6 }, (_, i) => qcm(`Question ${i + 1} ?`, ['Oui', 'Non'], 0, 30)), 'Six')
  const host = await ecranCommun(b.url, admin)
  const salle: [string, string, string | undefined][] = [
    ['Marie-Charlotte Lefebvre', '🦊', j.mc.cookie],
    ['Guillaume-Maxime Wawrzyn', '🦉', j.gw.cookie],
    ['Camille', '🐙', j.cam2.cookie],
    ['Léa', '🐼', j.lea.cookie],
    ['Kévin', '🐧', undefined],
  ]
  for (const [i, [nom, av, c]] of salle.entries()) {
    const inv = await invite(b.url, nom, av, { cookie: c })
    inv.socket.on('session:view', ({ sessionId, view }: any) => {
      if (view.phase !== 'question' || view.answered) return
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: i < 3 ? 0 : 1 } }, () => {}), 100 + i * 150)
    })
  }
  const g = await invite(b.url, 'Gaspard', '🦊')
  g.socket.close()
  gaspard = { playerId: g.playerId, token: g.token }
  const telephones = await Promise.all(TAILLES.map(t => telephone(t, { moi: gaspard })))
  for (const t of telephones) await t.page.goto(`${b.url}/${ADMIN.slug}`)
  let vue: any = null
  host.on('session:view', (x: any) => (vue = x))
  await lancerQuiz(host, packId)
  const suivant = () => (host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'next', phase: vue.view.phase, qIndex: vue.view.qIndex, round: vue.view.round } })
  for (let q = 0; q < 6; q++) {
    await attendre<any>(host, 'session:view', x => x.view.phase === 'question' && x.view.qIndex === q, `q${q}`, 15000)
    await patienter(1300)
    suivant()
    await attendre<any>(host, 'session:view', x => x.view.phase === 'reveal' && x.view.qIndex === q, `r${q}`, 15000)
    suivant()
  }
  await attendre<any>(host, 'session:view', x => x.view.phase === 'finished', 'fin', 15000)
  await patienter(1500)
  // Chaque ligne d'un lauréat : son laurier entier dans la case du nom, et
  // trois lettres au moins de son prénom, points de suspension compris
  // (mesurées dans la police de la ligne) — ou le prénom entier s'il est plus court.
  const LIRE = `[...document.querySelectorAll('.lb-row')].filter(r => r.querySelector('.laurier')).map(r => {
    const nom = r.querySelector('.lb-name').getBoundingClientRect()
    const l = r.querySelector('.laurier').getBoundingClientRect()
    const texte = r.querySelector('.nom-laure-texte')
    const g = document.createElement('canvas').getContext('2d'); g.font = getComputedStyle(texte).font
    const besoin = Math.min(texte.scrollWidth, Math.ceil(g.measureText(texte.textContent.slice(0, 3) + '…').width))
    return { qui: texte.textContent, prenom: Math.round(texte.getBoundingClientRect().width), besoin, laurier: l.width > 0 && l.right <= nom.right + 0.5 }
  })`
  const constats: string[] = []
  for (const [i, t] of telephones.entries()) {
    for (const r of (await t.page.evaluate(LIRE)) as any[])
      if (r.prenom < r.besoin - 1 || !r.laurier) constats.push(`podium, ${TAILLES[i].width} px : ${r.qui} — ${r.prenom} px de prénom sur ${r.besoin} pour trois lettres, laurier ${r.laurier ? 'vu' : 'coupé'}`)
  }
  ;(host as any).emit('host:endSession', { sessionId: vue.sessionId })
  await patienter(2000)
  for (const [i, t] of telephones.entries()) {
    for (const r of (await t.page.evaluate(LIRE)) as any[])
      if (r.prenom < r.besoin - 1 || !r.laurier) constats.push(`classement, ${TAILLES[i].width} px : ${r.qui} — ${r.prenom} px de prénom sur ${r.besoin} pour trois lettres, laurier ${r.laurier ? 'vu' : 'coupé'}`)
    await t.ctx.close()
  }
  host.close()
  assert.deepEqual(constats, [], 'un lauréat se lit : son prénom (trois lettres au moins) et son laurier')
})

test('la silhouette d’un emoji de collection fermé se voit sur sa case (3:1, comme tout élément graphique)', async () => {
  const { ctx, page } = await telephone({ width: 360, height: 640, dsf: 2 }, { cookie: j.zoe.cookie })
  await page.goto(`${b.url}/profil`)
  await page.waitForSelector('.case-avatar.ferme .silhouette')
  const cases = await page.locator('.case-avatar.ferme:has(.silhouette)').all()
  const contrastes: number[] = []
  for (const c of cases.slice(0, 4)) {
    await c.scrollIntoViewIfNeeded()
    // La case sans son étiquette « niv. N », puis la même sans la silhouette : l'écart est ce que l'œil voit.
    await page.addStyleTag({ content: '.case-niveau { visibility: hidden }' })
    const avec: Buffer = await c.screenshot({ type: 'png' })
    const voile = await page.addStyleTag({ content: '.silhouette { visibility: hidden }' })
    const sans: Buffer = await c.screenshot({ type: 'png' })
    await voile.evaluate((e: any) => e.remove())
    const cr: number = await page.evaluate(`(async () => {
      const lire = async src => { const i = new Image(); i.src = src; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data }
      const a = await lire('data:image/png;base64,${avec.toString('base64')}'), s = await lire('data:image/png;base64,${sans.toString('base64')}')
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      const L = (d, k) => 0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2])
      let meilleur = 1
      for (let k = 0; k < a.length; k += 4) { const x = L(a, k), y = L(s, k); const r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); if (r > meilleur) meilleur = r }
      return meilleur
    })()`)
    contrastes.push(Math.round(cr * 100) / 100)
  }
  await ctx.close()
  assert.ok(contrastes.length > 0)
  for (const cr of contrastes) assert.ok(cr >= 3, `la silhouette ne se détache de sa case qu’à ${cr}:1 (${contrastes.join(', ')})`)
})

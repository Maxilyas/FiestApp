// Outils communs aux scripts d'audit : Playwright (installé globalement,
// comme pour la tablée), axe-core (pris hors du dépôt : AXE=<chemin de
// axe.min.js>, `npm pack axe-core` suffit), et un enregistreur de ce qu'un
// lecteur d'écran annoncerait : chaque changement de texte dans une région
// live (aria-live, role status/alert/log) est noté avec son heure.
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'

const racineGlobale = execSync('npm root -g', { encoding: 'utf8' }).trim()
export const { chromium } = createRequire(path.join(racineGlobale, 'x.js'))('playwright')
export const AXE = process.env.AXE
export const BASE = process.env.BASE ?? 'http://localhost:42211'

export async function navigateur() {
  const executablePath = process.env.CHROMIUM || undefined
  return chromium.launch({ headless: true, executablePath })
}

/** Un contexte : bypassCSP pour injecter axe, et l'enregistreur d'annonces. */
export async function contexte(b, opts = {}) {
  const ctx = await b.newContext({ bypassCSP: true, locale: 'fr-FR', ...opts })
  await ctx.addInitScript(() => {
    window.__annonces = []
    const vivante = el => {
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const live = n.getAttribute('aria-live')
        const role = n.getAttribute('role')
        if (live === 'off') return null
        if (live === 'polite' || live === 'assertive' || role === 'status' || role === 'alert' || role === 'log') return n
      }
      return null
    }
    // Ce qu'un lecteur d'écran lit d'une région live polie (aria-atomic
    // absent) : les nœuds AJOUTÉS et les textes MODIFIÉS, pas toute la région.
    const lisible = n => {
      if (n.nodeType === 3) return n.textContent
      if (n.nodeType !== 1) return ''
      if (n.getAttribute('aria-hidden') === 'true' || n.getAttribute('aria-live') === 'off') return ''
      let t = ''
      for (const c of n.childNodes) t += ' ' + lisible(c)
      const lab = n.getAttribute('aria-label')
      return lab && n.matches('button,[role],img,svg') ? ' ' + lab : t
    }
    new MutationObserver(ms => {
      const lot = new Map()
      for (const m of ms) {
        const cible = m.target.nodeType === 1 ? m.target : m.target.parentElement
        const r = vivante(cible); if (!r) continue
        let t = m.type === 'characterData' ? lisible(m.target) : [...m.addedNodes].map(lisible).join(' ')
        t = t.replace(/\s+/g, ' ').trim(); if (!t) continue
        const cle = (r.getAttribute('role') || 'live:' + r.getAttribute('aria-live')) + '.' + String(r.className).split(' ')[0]
        lot.set(cle, (lot.get(cle) ? lot.get(cle) + ' ' : '') + t)
      }
      for (const [region, texte] of lot) window.__annonces.push({ t: Date.now(), region, longueur: texte.length, texte: texte.slice(0, 400) })
    })
      .observe(document, { subtree: true, childList: true, characterData: true, attributes: false })
  })
  return ctx
}

export async function axe(page, etiquette) {
  await page.addScriptTag({ path: AXE })
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, aide: v.help, exemples: v.nodes.slice(0, 4).map(n => ({ cible: n.target.join(' '), html: n.html.slice(0, 160), resume: (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 200) })) }))
  })
  return { page: etiquette, url: page.url(), violations: r }
}

/** Le focus : l'élément actif, et s'il porte un indicateur visible. */
export async function focus(page) {
  return page.evaluate(() => {
    const a = document.activeElement
    if (!a || a === document.body) return { element: 'body' }
    const cs = getComputedStyle(a)
    const nom = a.getAttribute('aria-label') || (a.innerText || a.value || a.placeholder || '').trim().slice(0, 50)
    return { element: a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ')[0] : ''), nom, outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineWidth + ' ' + cs.outlineColor : 'aucun', boxShadow: cs.boxShadow !== 'none' ? 'oui' : 'non', bord: cs.borderColor }
  })
}

export function resumerAxe(r) {
  const lignes = [`## ${r.page} (${r.url})`]
  if (!r.violations.length) lignes.push('  aucune violation')
  for (const v of r.violations) {
    lignes.push(`  - ${v.id} [${v.impact}] ×${v.n} — ${v.aide}`)
    for (const e of v.exemples) lignes.push(`      ${e.cible} :: ${e.html.replace(/\s+/g, ' ')} ${e.resume ? '→ ' + e.resume : ''}`)
  }
  return lignes.join('\n')
}

// Le contraste des textes tel qu'il s'affiche : couleur, fonds empilés et
// opacités des ancêtres composés (axe laisse ces cas en « incomplet »).
export async function mesurer(page, seuil = 4.5) {
  return page.evaluate(seuil => {
    const rgba = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
    const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 })
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
    const fondDe = el => {
      const pile = []; let degrade = false
      for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); const c = rgba(cs.backgroundColor); if (cs.backgroundImage !== 'none' && n !== document.documentElement) degrade = true; if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break } }
      let f = { r: 255, g: 255, b: 255, a: 1 }
      for (const c of pile.reverse()) f = sur(c, f)
      return { f, degrade }
    }
    const res = []
    const vus = new Set()
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let t; (t = w.nextNode());) {
      const txt = t.textContent.trim(); if (!txt || /^[\p{Extended_Pictographic}\s‍️]+$/u.test(txt)) continue
      const el = t.parentElement; if (vus.has(el)) continue; vus.add(el)
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue
      if (el.closest('[aria-hidden=true]') && !el.closest('.timer')) continue
      if (el.closest('button:disabled, [aria-disabled=true], input:disabled')) continue
      let op = 1; for (let n = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity)
      if (op < 0.05) continue
      const { f, degrade } = fondDe(el)
      const c = rgba(cs.color); const fg = sur({ ...c, a: c.a * op }, f)
      const px = parseFloat(cs.fontSize), gras = Number(cs.fontWeight) >= 700
      const grand = px >= 24 || (gras && px >= 18.66)
      const q = ratio(fg, f)
      if (q < (grand ? 3 : seuil)) res.push({ texte: txt.slice(0, 40), classe: String(el.className).slice(0, 40), ratio: Math.round(q * 100) / 100, taille: px, opacite: Math.round(op * 100) / 100, degrade })
    }
    return res
  }, seuil)
}


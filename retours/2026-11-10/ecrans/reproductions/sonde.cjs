// Sonde du relevé : préchargée dans un script de rendu (`NODE_OPTIONS=--require`), elle note à chaque photo d'une page
// ce dont l'écran défile, sans toucher au script. Rien n'est modifié dans la page : une mesure, puis la photo du script.
//   SONDE_PW  le module playwright que les scripts chargent (npm root -g)/playwright
//   SONDE_OUT le fichier JSONL où écrire
const fs = require('node:fs')
const path = require('node:path')

const MESURE = `(() => {
  const d = document.documentElement
  const menu = document.querySelector('.menu-barre')
  const voile = document.querySelector('.carte-voile, .dialog-backdrop, .coffre-scene')
  const corps = voile && voile.querySelector('.carte-corps, .carte-defile, .dialog')
  const fixe = new WeakMap()
  const estFixe = el => {
    if (!el || el === document.body || el === d) return false
    if (fixe.has(el)) return fixe.get(el)
    const p = getComputedStyle(el).position
    const r = p === 'fixed' ? true : estFixe(el.parentElement)
    fixe.set(el, r)
    return r
  }
  // Le bas de ce qu'un ancêtre laisse voir : ce qu'un cadre coupe ou fait défiler en lui-même ne pousse pas la page.
  const coupe = new WeakMap()
  const basVisible = el => {
    if (!el || el === document.body || el === d) return Infinity
    if (coupe.has(el)) return coupe.get(el)
    let b = basVisible(el.parentElement)
    if (getComputedStyle(el).overflowY !== 'visible') b = Math.min(b, el.getBoundingClientRect().bottom + scrollY)
    coupe.set(el, b)
    return b
  }
  let bas = 0, dernier = ''
  for (const el of document.body.querySelectorAll('*')) {
    if (el.ownerSVGElement) continue
    if (el.childElementCount > 0 && !['BUTTON', 'A', 'svg', 'IMG', 'CANVAS', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) continue
    if (el.closest('.sr-only, [hidden]')) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    if (estFixe(el)) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.position === 'absolute' && cs.pointerEvents === 'none') continue
    const b = Math.min(r.bottom + scrollY, basVisible(el.parentElement))
    if (b > bas) { bas = b; dernier = (typeof el.className === 'string' ? el.className : el.tagName).slice(0, 40) + ' « ' + (el.textContent || '').trim().slice(0, 30) + ' »' }
  }
  const pli = innerHeight - (menu ? Math.round(menu.getBoundingClientRect().height) : 0)
  const shell = document.querySelector('.player-shell, .host, .center-page, .recap, .page')
  // Le geste principal « sous le pouce » : où il est à l'écran, s'il est collé, s'il se voit en entier.
  const pouces = [...document.querySelectorAll('.sous-le-pouce')].map(el => {
    const r = el.getBoundingClientRect()
    const b = el.querySelector('.btn')
    return { texte: (b ? b.textContent : el.textContent || '').trim().slice(0, 30), haut: Math.round(r.top), bas: Math.round(r.bottom), colle: el.classList.contains('colle'), vu: r.top >= 0 && r.bottom <= innerHeight + 0.5 }
  })
  // Le premier bouton principal de la page, s'il n'y a pas de geste sous le pouce : pour comparer avec l'avant.
  const principal = (() => { const b = document.querySelector('.btn-primary.btn-big'); if (!b) return null; const r = b.getBoundingClientRect(); return { texte: (b.textContent || '').trim().slice(0, 30), bas: Math.round(r.bottom), vu: r.top >= 0 && r.bottom <= innerHeight + 0.5 } })()
  return {
    url: location.pathname + location.hash,
    w: innerWidth, h: innerHeight,
    defile: Math.max(0, d.scrollHeight - innerHeight), y: Math.round(scrollY),
    menu: menu ? Math.round(menu.getBoundingClientRect().height) : 0,
    contenu: Math.round(bas), pli, depasse: Math.max(0, Math.round(bas - pli)),
    dernier,
    voile: !!voile,
    feuille: corps ? Math.max(0, corps.scrollHeight - corps.clientHeight) : 0,
    classe: shell ? String(shell.className).slice(0, 80) : '',
    pouces, principal,
    titre: ((document.querySelector('h1') || {}).textContent || document.title || '').trim().slice(0, 60),
  }
})()`

if (process.env.SONDE_PW && process.env.SONDE_OUT && process.argv.some(a => /scripts[\\/](rendu-|releve-)/.test(a))) {
  const pw = require(process.env.SONDE_PW)
  const noter = async (page, opts) => {
    try {
      const m = await page.evaluate(MESURE)
      fs.appendFileSync(process.env.SONDE_OUT, JSON.stringify({ photo: opts && opts.path ? path.basename(opts.path) : null, entiere: !!(opts && opts.fullPage), ...m }) + '\n')
    } catch (e) {
      fs.appendFileSync(process.env.SONDE_OUT, JSON.stringify({ photo: opts && opts.path ? path.basename(opts.path) : null, erreur: String(e && e.message).slice(0, 120) }) + '\n')
    }
  }
  const sonderLaPage = page => {
    if (page.__sondee) return page
    page.__sondee = true
    const photo = page.screenshot.bind(page)
    page.screenshot = async (opts = {}) => {
      await noter(page, opts)
      return photo(opts)
    }
    return page
  }
  const sonderLeContexte = ctx => {
    if (ctx.__sonde) return ctx
    ctx.__sonde = true
    const np = ctx.newPage.bind(ctx)
    ctx.newPage = async (...a) => sonderLaPage(await np(...a))
    ctx.on('page', p => sonderLaPage(p))
    return ctx
  }
  const lancer = pw.chromium.launch.bind(pw.chromium)
  pw.chromium.launch = async (...a) => {
    const nav = await lancer(...a)
    const nc = nav.newContext.bind(nav)
    nav.newContext = async (...x) => sonderLeContexte(await nc(...x))
    const np = nav.newPage.bind(nav)
    nav.newPage = async (...x) => sonderLaPage(await np(...x))
    return nav
  }
}

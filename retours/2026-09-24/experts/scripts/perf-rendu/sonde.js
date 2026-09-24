// La sonde posée dans chaque page AVANT son premier script (addInitScript) :
// elle compte ce que le profileur de Chromium ne donne pas seul.
//
//   · les rendus React : un faux crochet des outils de développement, que
//     React (même en production) appelle à chaque commit — `onCommitFiberRoot` ;
//     avec `__PERF_ATTRIB__`, il nomme aussi les composants qui ont rendu
//     (build non minifié seulement, sinon les noms sont mangés) ;
//   · les images : un compteur par requestAnimationFrame, et le plus long écart ;
//   · les longues tâches, les longues images (LoAF), les décalages (CLS) ;
//   · les messages socket reçus, par nom d'événement.
//
// `window.__perf.prendre()` rend les compteurs depuis le dernier appel, puis
// les remet à zéro : le pilote l'appelle chaque seconde.
;(() => {
  const attrib = !!window.__PERF_ATTRIB__
  const z = () => ({
    commits: 0,
    frames: 0,
    maxGap: 0,
    gaps50: 0, // images de plus de 50 ms (moins de 20 i/s)
    longTasks: 0,
    longTaskMs: 0,
    loaf: 0,
    loafBlockingMs: 0,
    cls: 0,
    msgs: {},
    composants: {},
  })
  let c = z()

  // ── React ───────────────────────────────────────────────────────────────
  const PERFORMED_WORK = 1
  const nomDe = f => {
    const t = f.type
    if (!t) return null
    if (typeof t === 'function') return t.displayName || t.name || null
    if (typeof t === 'object') return t.displayName || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || null
    return null
  }
  // Parcours à la manière des outils de développement : un sous-arbre dont
  // l'enfant n'a pas changé d'objet n'a pas été rendu (bailout) — on l'élague.
  const parcourir = racine => {
    const pile = [racine]
    while (pile.length) {
      const f = pile.pop()
      if ((f.tag === 0 || f.tag === 1 || f.tag === 11 || f.tag === 14 || f.tag === 15)) {
        const neuf = f.alternate === null
        if (neuf || f.flags & PERFORMED_WORK) {
          const n = nomDe(f) || '?'
          c.composants[n] = (c.composants[n] || 0) + 1
        }
      }
      if (f.sibling) pile.push(f.sibling)
      if (f.child && !(f.alternate && f.alternate.child === f.child)) pile.push(f.child)
    }
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject() {
      return 1
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      c.commits++
      if (attrib && root && root.current && root.current.child) {
        try {
          parcourir(root.current.child)
        } catch (e) {
          // Une attribution ratée ne doit pas casser la page mesurée.
        }
      }
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  }

  // ── Images ──────────────────────────────────────────────────────────────
  let dernier = 0
  const boucle = t => {
    if (dernier) {
      const gap = t - dernier
      if (gap > c.maxGap) c.maxGap = gap
      if (gap > 50) c.gaps50++
    }
    dernier = t
    c.frames++
    requestAnimationFrame(boucle)
  }
  requestAnimationFrame(boucle)

  // ── Longues tâches, longues images, décalages ───────────────────────────
  const observer = (type, fn) => {
    try {
      new PerformanceObserver(l => l.getEntries().forEach(fn)).observe({ type, buffered: true })
    } catch (e) {
      // Type inconnu de ce navigateur.
    }
  }
  observer('longtask', e => {
    c.longTasks++
    c.longTaskMs += e.duration
  })
  observer('long-animation-frame', e => {
    c.loaf++
    c.loafBlockingMs += e.blockingDuration || 0
  })
  // Qui se décale : la classe de chaque nœud source, pour trouver le coupable.
  const decrire = n => {
    if (!n || n.nodeType !== 1) return n ? n.nodeName : '?'
    const cl = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    return n.tagName.toLowerCase() + (cl ? '.' + cl : '')
  }
  observer('layout-shift', e => {
    if (e.hadRecentInput) return
    c.cls += e.value
    if (!c.clsSources) c.clsSources = {}
    for (const s of e.sources || []) {
      const k = decrire(s.node)
      c.clsSources[k] = (c.clsSources[k] || 0) + e.value
    }
  })

  // ── Messages socket ─────────────────────────────────────────────────────
  const WS = window.WebSocket
  window.WebSocket = function (...args) {
    const ws = new WS(...args)
    ws.addEventListener('message', ev => {
      if (typeof ev.data !== 'string') return
      const m = /^4[23]\d*\["([^"]+)"/.exec(ev.data)
      const nom = m ? m[1] : ev.data.startsWith('43') ? 'ack' : 'autre'
      const b = (c.msgs[nom] = c.msgs[nom] || { n: 0, octets: 0 })
      b.n++
      b.octets += ev.data.length
    })
    return ws
  }
  window.WebSocket.prototype = WS.prototype
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })

  window.__perf = {
    prendre() {
      const r = c
      c = z()
      return r
    },
  }
})()

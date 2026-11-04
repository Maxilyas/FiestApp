'use strict'
// Les graphes de la maquette, en SVG écrit à la main — sans bibliothèque,
// comme ceux du QG d'aujourd'hui (`GrapheDesJours`, `PileDeGraphes`) : des
// traits fins, une grille en filets pleins, un viseur qui trouve l'heure,
// une infobulle qui dit la valeur d'abord, le glisser pour zoomer, et les
// événements du serveur posés sur chaque courbe.

// ── Monter un graphe à sa vraie largeur ───────────────────────────────

const OBSERVES = new Set()
/** Ceux d'un morceau qui se redessine seul (le direct) : il les défait à chaque tour, sans toucher au reste de la page. */
let collecteur = null
/** Dessine à la largeur du conteneur, et redessine quand elle change. */
function monter(conteneur, dessiner) {
  let derniere = 0
  const rendre = () => {
    const w = Math.floor(conteneur.clientWidth)
    if (!w || w === derniere) return
    derniere = w
    conteneur.replaceChildren(dessiner(w))
  }
  const ro = new ResizeObserver(rendre)
  ro.observe(conteneur)
  OBSERVES.add(ro)
  if (collecteur) collecteur.add(ro)
  conteneur._redessiner = () => {
    derniere = 0
    rendre()
  }
  requestAnimationFrame(rendre)
  return conteneur
}
function liberer() {
  for (const ro of OBSERVES) ro.disconnect()
  OBSERVES.clear()
  cacherInfobulle()
}

// ── L'infobulle ────────────────────────────────────────────────────────

function montrerInfobulle(x, y, titre, lignes, note) {
  const bulle = document.getElementById('infobulle')
  const enfants = [h('div', { class: 'infobulle-titre' }, titre)]
  for (const l of lignes) {
    enfants.push(
      h('div', { class: 'infobulle-ligne' },
        h('span', { class: 'infobulle-cle' + (l.carre ? ' carre' : ''), style: { background: l.couleur || 'transparent', opacity: l.pale ? 0.5 : 1 } }),
        h('b', null, l.valeur),
        h('span', null, l.nom || ''),
      ),
    )
  }
  if (note) enfants.push(h('div', { class: 'infobulle-note' }, note))
  bulle.replaceChildren(...enfants)
  bulle.hidden = false
  const r = bulle.getBoundingClientRect()
  let gx = x + 16
  let gy = y + 14
  if (gx + r.width > window.innerWidth - 8) gx = x - r.width - 16
  if (gy + r.height > window.innerHeight - 8) gy = y - r.height - 14
  bulle.style.left = Math.max(8, gx) + 'px'
  bulle.style.top = Math.max(8, gy) + 'px'
}
function cacherInfobulle() {
  const bulle = document.getElementById('infobulle')
  if (bulle) bulle.hidden = true
}

// ── Les échelles ───────────────────────────────────────────────────────

/** Le haut d'un axe : un chiffre rond au-dessus de la plus haute valeur. */
function hautRond(v) {
  if (!v || v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p
  return 10 * p
}
/** Un pas rond : 1, 2, 2,5 ou 5 fois une puissance de dix — jamais « 1 125 ». */
const pasRond = p => {
  const m = p / Math.pow(10, Math.floor(Math.log10(p)))
  return [1, 2, 2.5, 5, 10].some(x => Math.abs(m - x) < 1e-9)
}
function graduations(haut, n = 4, entiers = false) {
  if (entiers && haut <= 4) return Array.from({ length: haut + 1 }, (_, i) => i)
  const essais = n <= 2 ? [2, 1, 3] : [4, 5, 3, 2, 6]
  const k = essais.find(e => pasRond(haut / e) && (!entiers || Number.isInteger(haut / e))) || n
  return Array.from({ length: k + 1 }, (_, i) => (i * haut) / k)
}
function formatAxe(v, unite) {
  if (unite === 'ms') return v >= 1000 ? nombre(v / 1000, v % 1000 ? 1 : 0) + ' s' : nombre(v) + ' ms'
  if (unite === '%') return nombre(v, v < 10 && v % 1 ? 1 : 0) + ' %'
  if (unite === 'Mo') return nombre(v) + ' Mo'
  if (v >= 10000) return compact(v)
  return nombre(v, v < 10 && v % 1 ? 1 : 0)
}
function formatValeur(v, unite) {
  if (v == null) return '—'
  if (unite === 'ms') return ms(v)
  if (unite === '%') return pct(v, v < 10 ? 1 : 0)
  if (unite === 'Mo') return mo(v)
  if (unite === 'pct-coeur') return nombre(v, 1) + ' %'
  return v >= 100 ? nombre(Math.round(v)) : nombre(v, v < 10 && v % 1 ? 1 : 0)
}

// ── Le temps sur l'axe ─────────────────────────────────────────────────

const PAS_DE_GRADUATION = [MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE, HEURE, 3 * HEURE, 6 * HEURE, 12 * HEURE, JOUR, 2 * JOUR, 7 * JOUR, 14 * JOUR, 28 * JOUR]
function graduationsDuTemps(debut, fin, largeur) {
  const voulu = Math.max(2, Math.floor(largeur / 78))
  const pas = PAS_DE_GRADUATION.find(p => (fin - debut) / p <= voulu) || 28 * JOUR
  const liste = []
  if (pas < JOUR) {
    let t = minuit(debut)
    while (t < debut) t += pas
    for (; t <= fin; t += pas) liste.push(t)
  } else {
    let t = minuit(debut)
    if (pas >= 7 * JOUR) while (paris(t).sem !== 1) t = minuit(t + 26 * HEURE)
    if (t < debut) t = pas >= 7 * JOUR ? minuit(t + pas + 2 * HEURE) : minuit(t + 26 * HEURE)
    for (; t <= fin; t = minuit(t + pas + 2 * HEURE)) liste.push(t)
  }
  return { pas, liste }
}
function libelleDeGraduation(t, pas, duree) {
  const p = paris(t)
  if (pas >= JOUR) return duree <= 12 * JOUR ? jourCourt(t) : dateCourte(t)
  if (p.h === 0 && p.m === 0) return jourCourt(t)
  if (pas < HEURE) return `${p.h} h ${String(p.m).padStart(2, '0')}`
  return `${p.h} h`
}
function libelleDuSeau(t, pas) {
  if (pas < MINUTE) return `${jourCourt(t)} · ${horodatage(t)}`
  if (pas < HEURE) return `${jourCourt(t)} · ${heureEcrite(t)} → ${heureEcrite(t + pas)}`
  if (pas < JOUR) {
    const a = paris(t).h
    const b = paris(t + pas).h
    return `${jourCourt(t)} · ${a} h → ${b} h`
  }
  return dateLongue(t)
}

// ── Les événements posés sur les courbes ──────────────────────────────

const FORME_D_EVENEMENT = {
  'mise-en-ligne': { couleur: 'var(--or)', forme: 'triangle', nom: 'Mise en ligne' },
  'arret-net': { couleur: 'var(--critique)', forme: 'croix', nom: 'Arrêt net' },
  redemarrage: { couleur: 'var(--encre-2)', forme: 'rond', nom: 'Redémarrage' },
  incident: { couleur: 'var(--critique)', forme: 'bande', nom: 'Incident' },
  ouverture: { couleur: 'var(--mode-cabinet)', forme: 'losange', nom: 'Ouverture' },
  affiche: { couleur: 'var(--mode-cabinet)', forme: 'losange', nom: 'Affiche' },
  annonce: { couleur: 'var(--encre-2)', forme: 'losange', nom: 'Annonce' },
}
function glyphe(forme, x, y, couleur) {
  if (forme === 'triangle') return s('path', { d: `M${x - 5},${y + 4} L${x},${y - 5} L${x + 5},${y + 4} Z`, fill: couleur })
  if (forme === 'croix') return s('path', { d: `M${x - 4},${y - 4} L${x + 4},${y + 4} M${x + 4},${y - 4} L${x - 4},${y + 4}`, stroke: couleur, 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none' })
  if (forme === 'rond') return s('circle', { cx: x, cy: y, r: 3.5, fill: 'none', stroke: couleur, 'stroke-width': 1.8 })
  return s('path', { d: `M${x},${y - 5} L${x + 5},${y} L${x},${y + 5} L${x - 5},${y} Z`, fill: couleur })
}

// ── Le viseur partagé ─────────────────────────────────────────────────

const VISEURS = new Map()
function annoncerViseur(groupe, t, source) {
  if (!groupe) return
  for (const ecouteur of VISEURS.get(groupe) || []) if (ecouteur !== source) ecouteur(t)
}
function ecouterViseur(groupe, fn) {
  if (!groupe) return
  if (!VISEURS.has(groupe)) VISEURS.set(groupe, new Set())
  VISEURS.get(groupe).add(fn)
}
function oublierLesViseurs() {
  VISEURS.clear()
}

// ── Le graphique du temps ─────────────────────────────────────────────

/**
 * Des séries sur les seaux d'une fenêtre.
 * opts : f, series [{ nom, valeurs, couleur, forme: 'ligne'|'aire'|'colonnes'|'bande', bas, pale, tirets }],
 * hauteur, unite, empile, plafond { v, texte }, groupe, surZoom(debut, fin), evenements, lecture (élément), nuits,
 * avant (séries de la période d'avant, mêmes indices), nom (pour l'accessibilité)
 */
function grapheTemps(opts) {
  const conteneur = h('div', { class: 'graphe', tabindex: '0', role: 'img', 'aria-label': opts.nom || 'Graphique' })
  let indexClavier = -1
  monter(conteneur, largeur => dessinerTemps(opts, largeur, conteneur, i => (indexClavier = i)))
  conteneur.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const n = opts.f.t.length
    indexClavier = indexClavier < 0 ? n - 1 : borner(indexClavier + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1)
    conteneur.dispatchEvent(new CustomEvent('viser', { detail: indexClavier }))
  })
  conteneur.addEventListener('blur', () => {
    indexClavier = -1
    cacherInfobulle()
  })
  return conteneur
}

function dessinerTemps(opts, largeur, conteneur, noterIndex) {
  const f = opts.f
  const n = f.t.length
  const H = opts.hauteur || 180
  const m = { g: opts.margeGauche ?? 50, d: 14, h: opts.evenements ? 16 : 8, b: 22 }
  const L = Math.max(60, largeur - m.g - m.d)
  const P = H - m.h - m.b
  const t0 = f.t[0]
  const etendue = n * f.pas
  const xT = t => m.g + ((t - t0) / etendue) * L
  const slot = L / n
  const xI = i => m.g + (i + 0.5) * slot
  const series = opts.series

  // Le haut de l'axe : la plus haute valeur, empilée s'il le faut, le plafond compris.
  let haut = 0
  if (opts.empile) {
    for (let i = 0; i < n; i++) haut = Math.max(haut, series.reduce((a, se) => a + (se.valeurs[i] || 0), 0))
  } else for (const se of series) for (const v of se.valeurs) if (v != null) haut = Math.max(haut, v)
  if (opts.avant) for (const se of opts.avant) for (const v of se.valeurs) if (v != null) haut = Math.max(haut, v)
  if (opts.plafond && opts.plafond.v <= haut * 1.6) haut = Math.max(haut, opts.plafond.v * 1.08)
  if (opts.yMax) haut = Math.max(haut, opts.yMax)
  // Un compte (des erreurs, des requêtes) se gradue en entiers : « 0,5 erreur » ne se lit pas.
  const entiers = opts.entiers ?? (!opts.unite && series.every(se => se.valeurs.every(v => v == null || Number.isInteger(v))))
  haut = entiers && haut <= 4 ? Math.max(1, Math.ceil(haut)) : hautRond(haut || 1)
  const yV = v => m.h + P - (v / haut) * P

  const svg = s('svg', { width: largeur, height: H, viewBox: `0 0 ${largeur} ${H}` })
  const defs = s('defs')
  svg.append(defs)

  // La nuit endormie, hachurée : rien n'y a été mesuré.
  if (opts.nuits) {
    let debut = -1
    for (let i = 0; i <= n; i++) {
      const vide = i < n && series.every(se => se.valeurs[i] == null)
      if (vide && debut < 0) debut = i
      if (!vide && debut >= 0) {
        svg.append(s('rect', { class: 'hors', x: m.g + debut * slot, y: m.h, width: (i - debut) * slot, height: P }))
        debut = -1
      }
    }
  }

  // Les incidents : une bande en sourdine sur leur durée.
  const evts = opts.evenements ? EVENEMENTS.filter(e => (e.fin ?? e.t) >= t0 && e.t <= t0 + etendue) : []
  for (const e of evts) {
    if (!e.fin) continue
    const x1 = Math.max(m.g, xT(e.t))
    const x2 = Math.min(m.g + L, xT(e.fin))
    if (x2 > x1) svg.append(s('rect', { x: x1, y: m.h, width: Math.max(2, x2 - x1), height: P, fill: 'rgba(229,72,77,0.09)' }))
  }

  // La grille et l'axe des valeurs.
  const grille = s('g', { class: 'grille-h' })
  const axe = s('g', { class: 'axe' })
  for (const v of graduations(haut, H < 130 ? 2 : 4, entiers)) {
    const y = Math.round(yV(v)) + 0.5
    if (v > 0) grille.append(s('line', { x1: m.g, x2: m.g + L, y1: y, y2: y }))
    axe.append(s('text', { x: m.g - 8, y: y + 3.5, 'text-anchor': 'end' }, formatAxe(v, opts.unite)))
  }
  svg.append(grille)
  svg.append(s('line', { class: 'socle', x1: m.g, x2: m.g + L, y1: m.h + P + 0.5, y2: m.h + P + 0.5 }))

  // L'axe du temps.
  const { pas: pasG, liste } = graduationsDuTemps(t0, t0 + etendue, L)
  let dernierX = -999
  for (const t of liste) {
    // Un jour se nomme en son milieu : sa graduation est une journée, pas un minuit.
    const x = pasG >= JOUR ? xT(t + JOUR / 2) : xT(t)
    if (x < m.g + 10 || x > m.g + L - 10) continue
    if (x - dernierX < 54) continue
    dernierX = x
    axe.append(s('text', { x, y: H - 6, 'text-anchor': 'middle' }, libelleDeGraduation(t, pasG, etendue)))
    const xm = xT(t)
    if (paris(t).h === 0 && paris(t).m === 0 && f.pas < JOUR && xm > m.g) grille.append(s('line', { x1: Math.round(xm) + 0.5, x2: Math.round(xm) + 0.5, y1: m.h, y2: m.h + P, style: 'stroke: rgba(148,166,196,0.13)' }))
  }
  svg.append(axe)

  // Le plafond : celui du conteneur, en tirets — un seuil, pas une grille.
  if (opts.plafond && opts.plafond.v <= haut) {
    const y = Math.round(yV(opts.plafond.v)) + 0.5
    svg.append(s('line', { class: 'plafond', x1: m.g, x2: m.g + L, y1: y, y2: y }))
    svg.append(s('text', { class: 'plafond-texte', x: m.g + L, y: y - 5, 'text-anchor': 'end' }, opts.plafond.texte))
  }

  // Les séries.
  const tracer = (valeurs, x) => {
    let d = ''
    let enCours = false
    valeurs.forEach((v, i) => {
      if (v == null) {
        enCours = false
        return
      }
      d += (enCours ? 'L' : 'M') + x(i).toFixed(1) + ',' + yV(v).toFixed(1)
      enCours = true
    })
    return d
  }
  const aire = (haut1, bas1) => {
    // Une aire par morceau continu.
    let d = ''
    let morceau = []
    const fermer = () => {
      if (morceau.length < 1) return
      const haut2 = morceau.map(i => `${xI(i).toFixed(1)},${yV(haut1[i]).toFixed(1)}`)
      const bas2 = morceau.slice().reverse().map(i => `${xI(i).toFixed(1)},${yV(bas1 ? bas1[i] ?? 0 : 0).toFixed(1)}`)
      if (morceau.length === 1) {
        const x = xI(morceau[0])
        d += `M${x - slot / 2},${yV(haut1[morceau[0]])}L${x + slot / 2},${yV(haut1[morceau[0]])}L${x + slot / 2},${yV(bas1 ? bas1[morceau[0]] : 0)}L${x - slot / 2},${yV(bas1 ? bas1[morceau[0]] : 0)}Z`
      } else d += 'M' + haut2.join('L') + 'L' + bas2.join('L') + 'Z'
      morceau = []
    }
    haut1.forEach((v, i) => {
      if (v == null) fermer()
      else morceau.push(i)
    })
    fermer()
    return d
  }

  if (opts.empile) {
    // Des colonnes empilées : un filet de la surface entre deux segments, le haut arrondi.
    const largeurBarre = Math.max(1, Math.min(24, slot * 0.72))
    const cumul = new Array(n).fill(0)
    const g = s('g')
    series.forEach((se, k) => {
      se.valeurs.forEach((v, i) => {
        if (!v) return
        const y0 = yV(cumul[i])
        cumul[i] += v
        const y1 = yV(cumul[i])
        const dernier = series.slice(k + 1).every(x => !x.valeurs[i])
        const hauteur = Math.max(0, y0 - y1 - (k > 0 ? 2 : 0))
        if (hauteur <= 0) return
        g.append(barre(xI(i) - largeurBarre / 2, y0 - (k > 0 ? 2 : 0) - hauteur, largeurBarre, hauteur, dernier ? Math.min(3, largeurBarre / 2) : 0, se.couleur))
      })
    })
    svg.append(g)
  } else {
    for (const se of series) {
      if (se.forme === 'colonnes') {
        const largeurBarre = Math.max(1, Math.min(24, slot * 0.72))
        const g = s('g')
        se.valeurs.forEach((v, i) => {
          if (!v) return
          const y = yV(v)
          g.append(barre(xI(i) - largeurBarre / 2, y, largeurBarre, m.h + P - y, Math.min(3, largeurBarre / 2), se.couleur, se.pale))
        })
        svg.append(g)
      } else if (se.forme === 'bande') {
        svg.append(s('path', { d: aire(se.valeurs, se.bas), fill: se.couleur, 'fill-opacity': 0.13 }))
        svg.append(s('path', { d: tracer(se.bas, xI), fill: 'none', stroke: se.couleur, 'stroke-width': 1.4, 'stroke-opacity': 0.55, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
        svg.append(s('path', { d: tracer(se.valeurs, xI), fill: 'none', stroke: se.couleur, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
      } else {
        if (se.forme === 'aire') {
          const id = 'deg' + Math.random().toString(36).slice(2, 8)
          defs.append(s('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 }, s('stop', { offset: '0%', 'stop-color': se.couleur, 'stop-opacity': 0.24 }), s('stop', { offset: '100%', 'stop-color': se.couleur, 'stop-opacity': 0.02 })))
          svg.append(s('path', { d: aire(se.valeurs), fill: `url(#${id})` }))
        }
        svg.append(s('path', { d: tracer(se.valeurs, xI), fill: 'none', stroke: se.couleur, 'stroke-width': se.pale ? 1.5 : 2, 'stroke-opacity': se.pale ? 0.55 : 1, 'stroke-dasharray': se.tirets ? '4 3' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
      }
    }
  }
  // La période d'avant, en filet discret.
  if (opts.avant) {
    for (const se of opts.avant) svg.append(s('path', { d: tracer(se.valeurs, xI), fill: 'none', stroke: se.couleur, 'stroke-width': 1.5, 'stroke-opacity': 0.45, 'stroke-dasharray': '4 3', 'stroke-linejoin': 'round' }))
  }

  // Le dernier point d'une courbe : un rond cerclé de la surface.
  for (const se of series) {
    if (opts.empile || se.forme === 'colonnes' || se.pale || se.sansPoint) continue
    let i = se.valeurs.length - 1
    while (i >= 0 && se.valeurs[i] == null) i--
    if (i < 0) continue
    svg.append(s('circle', { cx: xI(i), cy: yV(se.valeurs[i]), r: 4, fill: se.couleur, stroke: 'var(--console)', 'stroke-width': 2 }))
  }

  // Les événements : un repère en haut, un filet discret jusqu'au socle.
  const coucheEvts = s('g')
  for (const e of evts) {
    const forme = FORME_D_EVENEMENT[e.sorte]
    const x = xT(e.t)
    if (x < m.g || x > m.g + L) continue
    coucheEvts.append(s('line', { class: 'repere', x1: Math.round(x) + 0.5, x2: Math.round(x) + 0.5, y1: m.h, y2: m.h + P, stroke: forme.couleur, 'stroke-opacity': 0.4 }))
    coucheEvts.append(glyphe(forme.forme === 'bande' ? 'croix' : forme.forme, x, m.h - 7, forme.couleur))
  }
  svg.append(coucheEvts)

  // Le viseur, la sélection, la cible.
  const viseur = s('line', { class: 'viseur', y1: m.h, y2: m.h + P, visibility: 'hidden' })
  const selection = s('rect', { class: 'selection', y: m.h, height: P, visibility: 'hidden' })
  const cible = s('rect', { class: 'cible', x: m.g, y: 0, width: L, height: m.h + P })
  svg.append(viseur, selection, cible)

  const lireIndex = clientX => {
    const r = svg.getBoundingClientRect()
    return borner(Math.floor((clientX - r.left - m.g) / slot), 0, n - 1)
  }
  const poserViseur = i => {
    const x = Math.round(xI(i)) + 0.5
    viseur.setAttribute('x1', x)
    viseur.setAttribute('x2', x)
    viseur.setAttribute('visibility', 'visible')
    if (opts.lecture) opts.lecture.replaceChildren(...lectureDe(opts, i))
  }
  const enleverViseur = () => {
    viseur.setAttribute('visibility', 'hidden')
    if (opts.lecture) opts.lecture.replaceChildren(...lectureDe(opts, -1))
  }
  const bulle = (i, clientX, clientY) => {
    const lignes = []
    for (const se of opts.empile ? series.slice().reverse() : series) {
      lignes.push({ couleur: se.couleur, carre: opts.empile || se.forme === 'colonnes', valeur: formatValeur(se.valeurs[i], se.unite || opts.unite), nom: se.nom })
      if (se.forme === 'bande') lignes.push({ couleur: se.couleur, pale: true, valeur: formatValeur(se.bas[i], opts.unite), nom: se.nomBas || 'médiane' })
    }
    if (opts.empile && series.length > 1) lignes.push({ valeur: formatValeur(series.reduce((a, se) => a + (se.valeurs[i] || 0), 0), opts.unite), nom: 'en tout' })
    if (opts.avant) for (const se of opts.avant) lignes.push({ couleur: se.couleur, pale: true, valeur: formatValeur(se.valeurs[i], opts.unite), nom: 'période d’avant' })
    const t = f.t[i]
    const proche = evts.find(e => Math.abs(xT(e.t) - xI(i)) <= Math.max(slot, 6) || (e.fin && t + f.pas > e.t && t < e.fin))
    const vide = series.every(se => se.valeurs[i] == null)
    montrerInfobulle(clientX, clientY, libelleDuSeau(t, f.pas), vide ? [{ valeur: 'endormi', nom: 'l’hébergeur dormait' }] : lignes, proche ? `${FORME_D_EVENEMENT[proche.sorte].nom} · ${proche.titre}. ${proche.detail || ''}` : null)
  }

  let glisse = null
  cible.addEventListener('pointerdown', e => {
    if (!opts.surZoom || e.button !== 0) return
    glisse = { x0: e.clientX, i0: lireIndex(e.clientX) }
    cible.setPointerCapture(e.pointerId)
  })
  cible.addEventListener('pointermove', e => {
    const i = lireIndex(e.clientX)
    noterIndex(i)
    poserViseur(i)
    annoncerViseur(opts.groupe, f.t[i], ecouteur)
    if (glisse && Math.abs(e.clientX - glisse.x0) > 4) {
      const a = Math.min(glisse.i0, i)
      const b = Math.max(glisse.i0, i)
      selection.setAttribute('x', m.g + a * slot)
      selection.setAttribute('width', (b - a + 1) * slot)
      selection.setAttribute('visibility', 'visible')
      cacherInfobulle()
    } else bulle(i, e.clientX, e.clientY)
  })
  const finir = e => {
    if (glisse) {
      const i = lireIndex(e.clientX)
      const a = Math.min(glisse.i0, i)
      const b = Math.max(glisse.i0, i)
      selection.setAttribute('visibility', 'hidden')
      if (Math.abs(e.clientX - glisse.x0) > 10 && b > a) opts.surZoom(f.t[a], f.t[b] + f.pas)
      glisse = null
    }
  }
  cible.addEventListener('pointerup', finir)
  cible.addEventListener('pointercancel', () => {
    glisse = null
    selection.setAttribute('visibility', 'hidden')
  })
  cible.addEventListener('pointerleave', () => {
    if (!glisse) {
      enleverViseur()
      cacherInfobulle()
      annoncerViseur(opts.groupe, null, ecouteur)
    }
  })
  const ecouteur = t => {
    if (t == null) return enleverViseur()
    const i = f.t.findIndex((u, k) => t >= u && t < u + f.pas)
    if (i >= 0) poserViseur(i)
    else enleverViseur()
  }
  ecouterViseur(opts.groupe, ecouteur)
  // Un seul écouteur du clavier par graphe : redessiné à chaque largeur, il ne s'empile pas.
  if (conteneur._viser) conteneur.removeEventListener('viser', conteneur._viser)
  conteneur._viser = e => {
    const i = e.detail
    poserViseur(i)
    annoncerViseur(opts.groupe, f.t[i], ecouteur)
    const r = svg.getBoundingClientRect()
    bulle(i, r.left + xI(i), r.top + m.h + 10)
  }
  conteneur.addEventListener('viser', conteneur._viser)
  if (opts.lecture) opts.lecture.replaceChildren(...lectureDe(opts, -1))
  return svg
}

/** Une barre au haut arrondi, carrée au socle. */
function barre(x, y, w, hauteur, r, couleur, pale) {
  if (hauteur <= 0) return s('g')
  const rr = Math.min(r, hauteur, w / 2)
  const d = `M${x},${y + hauteur}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hauteur}Z`
  return s('path', { d, fill: couleur, 'fill-opacity': pale ? 0.45 : 1 })
}

/** Ce que dit la lecture d'un graphe : la dernière valeur, ou celle survolée. */
function lectureDe(opts, i) {
  const f = opts.f
  const k = i >= 0 ? i : (() => {
    let j = f.t.length - 1
    while (j > 0 && opts.series.every(se => se.valeurs[j] == null)) j--
    return j
  })()
  const quandTexte = i >= 0 ? libelleDuSeau(f.t[k], f.pas) : 'dernier relevé'
  const morceaux = [h('span', null, quandTexte + ' · ')]
  opts.series.forEach((se, j) => {
    if (j > 0) morceaux.push(h('span', null, ' · '))
    morceaux.push(h('b', null, formatValeur(se.valeurs[k], se.unite || opts.unite)))
    morceaux.push(h('span', null, ' ' + (se.nomCourt || se.nom).toLowerCase()))
  })
  return morceaux
}

// ── La petite courbe d'une tuile ──────────────────────────────────────

function etincelle(valeurs, { couleur = 'var(--or)', hauteur = 30, discrete = false } = {}) {
  const conteneur = h('div', { class: 'etincelle', 'aria-hidden': 'true' })
  monter(conteneur, largeur => {
    const v = valeurs.map(x => (x == null ? null : x))
    const vals = v.filter(x => x != null)
    const svg = s('svg', { width: largeur, height: hauteur, viewBox: `0 0 ${largeur} ${hauteur}` })
    if (vals.length < 2) return svg
    const bas = Math.min(...vals)
    const hautV = Math.max(...vals)
    const y = x => 3 + (hauteur - 7) * (1 - (hautV === bas ? 0.5 : (x - bas) / (hautV - bas)))
    const x = i => 2 + (i / (v.length - 1)) * (largeur - 6)
    let d = ''
    let a = ''
    let premier = -1
    let dernier = -1
    v.forEach((val, i) => {
      if (val == null) return
      d += (d ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(val).toFixed(1)
      if (premier < 0) premier = i
      dernier = i
    })
    a = d + `L${x(dernier).toFixed(1)},${hauteur}L${x(premier).toFixed(1)},${hauteur}Z`
    const id = 'et' + Math.random().toString(36).slice(2, 8)
    svg.append(s('defs', null, s('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 }, s('stop', { offset: '0%', 'stop-color': couleur, 'stop-opacity': 0.22 }), s('stop', { offset: '100%', 'stop-color': couleur, 'stop-opacity': 0 }))))
    svg.append(s('path', { d: a, fill: `url(#${id})` }))
    svg.append(s('path', { d, fill: 'none', stroke: discrete ? 'var(--encre-3)' : couleur, 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-opacity': discrete ? 0.8 : 1 }))
    svg.append(s('circle', { cx: x(dernier), cy: y(v[dernier]), r: 3.2, fill: couleur, stroke: 'var(--console)', 'stroke-width': 1.6 }))
    return svg
  })
  return conteneur
}

/** Une petite courbe pour une ligne de tableau. */
function miniCourbe(valeurs, couleur = 'var(--or)', alerte = false) {
  const w = 96
  const hh = 24
  const vals = valeurs.filter(v => v != null)
  const bas = Math.min(...vals)
  const hautV = Math.max(...vals)
  const y = v => 3 + (hh - 6) * (1 - (hautV === bas ? 0.5 : (v - bas) / (hautV - bas)))
  const x = i => 2 + (i / (valeurs.length - 1)) * (w - 6)
  const d = valeurs.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join('')
  const k = valeurs.length - 1
  return s('svg', { class: 'mini', viewBox: `0 0 ${w} ${hh}`, width: w, height: hh, 'aria-hidden': 'true' },
    s('path', { d, fill: 'none', stroke: alerte ? 'var(--critique)' : couleur, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
    s('circle', { cx: x(k), cy: y(valeurs[k]), r: 2.6, fill: alerte ? 'var(--critique)' : couleur }),
  )
}

// ── Des colonnes par catégorie (une distribution) ──────────────────────

function colonnes(items, { couleur = 'var(--or)', hauteur = 150, format = v => nombre(v), unite = '', etiquettes = true, surligne = null } = {}) {
  const conteneur = h('div', { class: 'graphe' })
  monter(conteneur, largeur => {
    const m = { g: 8, d: 8, h: 18, b: 24 }
    const L = largeur - m.g - m.d
    const P = hauteur - m.h - m.b
    const plusHaut = Math.max(...items.map(i => i.v), 1)
    const hautV = plusHaut <= 4 ? Math.ceil(plusHaut) : hautRond(plusHaut)
    const slot = L / items.length
    const w = Math.max(4, Math.min(28, slot * 0.66))
    const svg = s('svg', { width: largeur, height: hauteur, viewBox: `0 0 ${largeur} ${hauteur}` })
    const grille = s('g', { class: 'grille-h' })
    for (const v of graduations(hautV, 2, true)) if (v > 0) grille.append(s('line', { x1: m.g, x2: m.g + L, y1: Math.round(m.h + P - (v / hautV) * P) + 0.5, y2: Math.round(m.h + P - (v / hautV) * P) + 0.5 }))
    svg.append(grille)
    svg.append(s('line', { class: 'socle', x1: m.g, x2: m.g + L, y1: m.h + P + 0.5, y2: m.h + P + 0.5 }))
    const axe = s('g', { class: 'axe' })
    items.forEach((it, i) => {
      const x = m.g + (i + 0.5) * slot
      const hh = (it.v / hautV) * P
      const g = s('g')
      const c = it.couleur || (surligne != null && i === surligne ? 'var(--or-vif)' : couleur)
      g.append(barre(x - w / 2, m.h + P - hh, w, hh, 3, c))
      const zone = s('rect', { x: x - slot / 2, y: m.h, width: slot, height: P, fill: 'transparent' })
      zone.addEventListener('pointermove', e => montrerInfobulle(e.clientX, e.clientY, it.nom, [{ couleur: c, carre: true, valeur: format(it.v) + unite, nom: it.detail || '' }]))
      zone.addEventListener('pointerleave', cacherInfobulle)
      g.append(zone)
      svg.append(g)
      if (etiquettes && (items.length <= 14 || i % Math.ceil(items.length / 12) === 0)) axe.append(s('text', { x, y: hauteur - 7, 'text-anchor': 'middle' }, it.nom))
    })
    // La plus haute, nommée par sa valeur ; les autres dans l'infobulle.
    const iMax = items.reduce((a, it, i) => (it.v > items[a].v ? i : a), 0)
    svg.append(s('text', { class: 'valeur-texte', x: m.g + (iMax + 0.5) * slot, y: m.h + P - (items[iMax].v / hautV) * P - 6, 'text-anchor': 'middle' }, format(items[iMax].v) + unite))
    svg.append(axe)
    return svg
  })
  return conteneur
}

// ── La carte de chaleur ───────────────────────────────────────────────

const RAMPE_OR = ['#141a26', '#3a2f1a', '#5a4415', '#8f6c22', '#c79a3e', '#e8c27a', '#fbe3ad']
function couleurDeRampe(x) {
  const r = RAMPE_OR
  if (x == null) return '#10151f'
  const p = borner(x, 0, 1) * (r.length - 1)
  const i = Math.floor(p)
  const t = p - i
  if (i >= r.length - 1) return r[r.length - 1]
  const a = r[i].match(/\w\w/g).map(c => parseInt(c, 16))
  const b = r[i + 1].match(/\w\w/g).map(c => parseInt(c, 16))
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')
}
/**
 * opts : lignes [noms], colonnes [noms], valeurs[l][c] (0–1 pour la couleur), texte(l, c) pour l'infobulle,
 * ecrire(l, c) pour le chiffre dans la case (facultatif), largeurNom, hauteurCase
 */
function chaleur(opts) {
  const conteneur = h('div', { class: 'graphe' })
  monter(conteneur, largeur => {
    const ln = opts.largeurNom ?? 96
    const nc = opts.colonnes.length
    const cw = Math.max(10, (largeur - ln - 4) / nc)
    const ch = opts.hauteurCase ?? Math.min(30, Math.max(16, cw * 0.8))
    const hautEntete = 20
    const H = hautEntete + opts.lignes.length * ch + 2
    const svg = s('svg', { width: largeur, height: H, viewBox: `0 0 ${largeur} ${H}` })
    const axe = s('g', { class: 'axe' })
    const pasCol = Math.ceil(30 / cw)
    opts.colonnes.forEach((c, j) => {
      if (j % pasCol === 0) axe.append(s('text', { x: ln + j * cw + cw / 2, y: 12, 'text-anchor': 'middle' }, c))
    })
    opts.lignes.forEach((l, i) => {
      axe.append(s('text', { x: ln - 8, y: hautEntete + i * ch + ch / 2 + 4, 'text-anchor': 'end' }, l))
      opts.colonnes.forEach((c, j) => {
        const v = opts.valeurs[i][j]
        const x = ln + j * cw + 1
        const y = hautEntete + i * ch + 1
        const fond = couleurDeRampe(v)
        const caseEl = s('rect', { x, y, width: Math.max(1, cw - 2), height: ch - 2, rx: 3, fill: fond })
        caseEl.addEventListener('pointermove', e => {
          caseEl.setAttribute('stroke', 'rgba(255,255,255,0.7)')
          const t = opts.texte(i, j)
          montrerInfobulle(e.clientX, e.clientY, t.titre, [{ couleur: fond, carre: true, valeur: t.valeur, nom: t.nom || '' }], t.note)
        })
        caseEl.addEventListener('pointerleave', () => {
          caseEl.removeAttribute('stroke')
          cacherInfobulle()
        })
        svg.append(caseEl)
        if (opts.ecrire && cw >= 30) {
          const texte = opts.ecrire(i, j)
          if (texte != null) svg.append(s('text', { x: x + (cw - 2) / 2, y: y + ch / 2 + 2.5, 'text-anchor': 'middle', style: `font: 600 10px var(--f-donnee); fill: ${v != null && v > 0.55 ? '#0b0b0b' : 'var(--encre-2)'}; pointer-events: none` }, texte))
        }
      })
    })
    svg.append(axe)
    return svg
  })
  const legende = h('div', { class: 'chaleur-legende' },
    h('span', null, opts.legendeBas || 'peu'),
    h('span', { class: 'rampe', style: { background: `linear-gradient(90deg, ${RAMPE_OR.join(',')})` } }),
    h('span', null, opts.legendeHaut || 'beaucoup'),
  )
  return h('div', null, conteneur, legende)
}

// ── Le nuage de points (les cartes du Cabinet) ────────────────────────

function nuage(points, { xNom, yNom, xFormat = v => pct(v), yFormat = v => pct(v), couleur = 'var(--mode-cabinet)', hauteur = 280, xMed, yMed } = {}) {
  const conteneur = h('div', { class: 'graphe' })
  monter(conteneur, largeur => {
    const m = { g: 44, d: 16, h: 12, b: 34 }
    const L = largeur - m.g - m.d
    const P = hauteur - m.h - m.b
    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)
    const xMin = Math.floor(Math.min(...xs) / 10) * 10
    const xMax = Math.ceil(Math.max(...xs) / 10) * 10
    const yMin = Math.floor(Math.min(...ys) / 5) * 5
    const yMax = Math.ceil(Math.max(...ys) / 5) * 5
    const X = v => m.g + ((v - xMin) / (xMax - xMin)) * L
    const Y = v => m.h + P - ((v - yMin) / (yMax - yMin)) * P
    const svg = s('svg', { width: largeur, height: hauteur, viewBox: `0 0 ${largeur} ${hauteur}` })
    const grille = s('g', { class: 'grille-h' })
    const axe = s('g', { class: 'axe' })
    for (let v = yMin; v <= yMax; v += 5) {
      grille.append(s('line', { x1: m.g, x2: m.g + L, y1: Math.round(Y(v)) + 0.5, y2: Math.round(Y(v)) + 0.5 }))
      axe.append(s('text', { x: m.g - 8, y: Y(v) + 3.5, 'text-anchor': 'end' }, yFormat(v)))
    }
    for (let v = xMin; v <= xMax; v += 10) axe.append(s('text', { x: X(v), y: m.h + P + 16, 'text-anchor': 'middle' }, xFormat(v)))
    axe.append(s('text', { x: m.g + L, y: hauteur - 2, 'text-anchor': 'end' }, xNom + ' →'))
    axe.append(s('text', { x: m.g + 8, y: m.h + 10, 'text-anchor': 'start' }, '↑ ' + yNom))
    svg.append(grille)
    if (xMed != null) svg.append(s('line', { x1: X(xMed), x2: X(xMed), y1: m.h, y2: m.h + P, stroke: 'rgba(148,166,196,0.25)', 'stroke-dasharray': '3 4' }))
    if (yMed != null) svg.append(s('line', { x1: m.g, x2: m.g + L, y1: Y(yMed), y2: Y(yMed), stroke: 'rgba(148,166,196,0.25)', 'stroke-dasharray': '3 4' }))
    svg.append(axe)
    for (const p of points) {
      const g = s('g')
      const cx = X(p.x)
      const cy = Y(p.y)
      g.append(s('circle', { cx, cy, r: 6, fill: couleur, stroke: 'var(--console)', 'stroke-width': 2 }))
      const droite = cx < m.g + L - 110
      g.append(s('text', { class: 'etiquette-texte', x: droite ? cx + 10 : cx - 10, y: cy + 4, 'text-anchor': droite ? 'start' : 'end' }, p.nom))
      const zone = s('circle', { cx, cy, r: 14, fill: 'transparent' })
      zone.addEventListener('pointermove', e => montrerInfobulle(e.clientX, e.clientY, p.nom, [{ couleur, carre: true, valeur: xFormat(p.x), nom: xNom }, { couleur, carre: true, valeur: yFormat(p.y), nom: yNom }], p.note))
      zone.addEventListener('pointerleave', cacherInfobulle)
      g.append(zone)
      svg.append(g)
    }
    return svg
  })
  return conteneur
}

// ── La jauge (un compteur en arc) ─────────────────────────────────────

function jauge(part, { couleur = 'var(--or)', taille = 132, epaisseur = 12, libelle = '', sous = '' } = {}) {
  const r = (taille - epaisseur) / 2
  const c = taille / 2
  const debut = Math.PI * 0.75
  const fin = Math.PI * 2.25
  const angle = debut + (fin - debut) * borner(part, 0, 1)
  const point = a => [c + r * Math.cos(a), c + r * Math.sin(a)]
  const arc = (a1, a2) => {
    const [x1, y1] = point(a1)
    const [x2, y2] = point(a2)
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
  }
  return s('svg', { width: taille, height: taille * 0.86, viewBox: `0 0 ${taille} ${taille * 0.86}`, role: 'img', 'aria-label': `${libelle} ${sous}` },
    s('path', { d: arc(debut, fin), fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': epaisseur, 'stroke-linecap': 'round' }),
    part > 0.004 ? s('path', { d: arc(debut, angle), fill: 'none', stroke: couleur, 'stroke-width': epaisseur, 'stroke-linecap': 'round' }) : null,
    s('text', { x: c, y: c + 4, 'text-anchor': 'middle', style: 'font: 600 22px var(--f-ui); fill: var(--encre)' }, libelle),
    s('text', { x: c, y: c + 22, 'text-anchor': 'middle', style: 'font: 500 10.5px var(--f-donnee); fill: var(--encre-3)' }, sous),
  )
}

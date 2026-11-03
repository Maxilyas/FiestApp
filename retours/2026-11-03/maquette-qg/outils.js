'use strict'
// Les outils de la maquette : fabriquer le DOM, écrire les nombres et les
// heures à la française, tirer un hasard qui se répète d'une visite à
// l'autre — la même heure donne le même chiffre, qu'on la regarde sur une
// semaine ou zoomée sur une heure.

const SVGNS = 'http://www.w3.org/2000/svg'

/** La typographie française à l'affichage : une fine insécable devant ; : ! ? % » et après «. */
function fin(texte) {
  return String(texte)
    .replace(/ ([:;!?%»])/g, '\u202f$1')
    .replace(/« /g, '«\u202f')
}

function poser(el, props, svg) {
  if (!props) return
  for (const [cle, val] of Object.entries(props)) {
    if (val == null || val === false) continue
    if (cle === 'class') el.setAttribute('class', val)
    else if (cle === 'style' && typeof val === 'object') Object.assign(el.style, val)
    else if (cle.startsWith('on') && typeof val === 'function') el.addEventListener(cle.slice(2).toLowerCase(), val)
    else if (cle === 'texte') el.textContent = fin(val)
    else if (cle === 'html') throw new Error('pas de html brut')
    else el.setAttribute(cle, val === true ? '' : String(val))
  }
}

function ajouter(el, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e == null || e === false || e === true) continue
    el.append(typeof e === 'string' || typeof e === 'number' ? document.createTextNode(fin(String(e))) : e)
  }
}

/** Un élément HTML : h('div', { class: 'x', onClick }, enfants…). */
function h(tag, props, ...enfants) {
  const el = document.createElement(tag)
  poser(el, props)
  ajouter(el, enfants)
  return el
}

/** Un élément SVG. */
function s(tag, props, ...enfants) {
  const el = document.createElementNS(SVGNS, tag)
  poser(el, props, true)
  ajouter(el, enfants)
  return el
}

// ── Les icônes : des traits, jamais d'emoji ─────────────────────────────

const TRACES = {
  poste: '<path d="M3 14a9 9 0 0 1 18 0"/><path d="M12 14l4.5-4.5"/><circle cx="12" cy="14" r="1.6"/><path d="M5 19h14"/>',
  direct: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  cloche: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  journal: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  joueurs: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  profil: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 9.5h3M15 13.5h3"/>',
  salon: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  economie: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.2A6 6 0 1 1 9.2 15.5"/><path d="M9 6.5v5M7 8h3.5"/>',
  comparer: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/>',
  soiree: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z"/><path d="M12 13v7M8.5 21h7"/>',
  jour: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  campagne: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  cabinet: '<path d="M3 9l9-6 9 6"/><path d="M4 9h16"/><path d="M6 9v9M10 9v9M14 9v9M18 9v9"/><path d="M3 21h18M4 18h16"/>',
  duels: '<path d="M4 4l10.5 10.5M20 4L9.5 14.5"/><path d="M13 16l3 3M11 16l-3 3"/><path d="M16.5 17.5l2.5-2.5M7.5 17.5L5 15"/>',
  questions: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  drapeau: '<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  reserve: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  catalogue: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  serveur: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
  base: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
  erreur: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  telephone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  annonce: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12"/>',
  etincelles: '<path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8L11 3z"/><path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
  maintenance: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  chercher: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  haut: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  bas: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  tri: '<path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/>',
  ok: '<path d="M20 6L9 17l-5-5"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eclair: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  fusee: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 12l3 3"/><path d="M14.5 4.5C17 2 21 3 21 3s1 4-1.5 6.5L13 16l-5-5 6.5-6.5z"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  lune: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  lecture: '<path d="M7 4l13 8-13 8V4z"/>',
  ecran: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  exporter: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  lien: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  zoom: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  gel: '<path d="M12 2v20M4.9 7l14.2 10M19.1 7L4.9 17"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  retour: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  droite: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  carte: '<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
  couronne: '<path d="M3 8l4.5 4 4.5-7 4.5 7L21 8l-2 11H5L3 8z"/>',
  bouclier: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  filtre: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  sablier: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9s10 3 10 9"/>',
  cle: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  vague: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2"/>',
}

/** Une icône de trait : décorative, sauf qu'on lui donne un nom. */
function icone(nom, nomAccessible) {
  const el = document.createElementNS(SVGNS, 'svg')
  el.setAttribute('viewBox', '0 0 24 24')
  el.setAttribute('width', '16')
  el.setAttribute('height', '16')
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', 'currentColor')
  el.setAttribute('stroke-width', '1.8')
  el.setAttribute('stroke-linecap', 'round')
  el.setAttribute('stroke-linejoin', 'round')
  if (nomAccessible) {
    el.setAttribute('role', 'img')
    el.setAttribute('aria-label', nomAccessible)
  } else el.setAttribute('aria-hidden', 'true')
  // Les tracés sont écrits ici, jamais lus d'ailleurs : seule entrée de balisage brut de la maquette.
  el.innerHTML = TRACES[nom] || TRACES.info
  return el
}

// ── Les nombres et les durées, à la française ───────────────────────────

/** « 1889 » reste une année : les milliers ne se groupent qu'à cinq chiffres, comme `formatNumber` de l'application. */
function nombre(n, decimales = 0) {
  if (n == null || Number.isNaN(n)) return '—'
  const negatif = n < 0
  let [entier, frac] = Math.abs(n).toFixed(decimales).split('.')
  if (entier.length >= 5) entier = entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return (negatif ? '−' : '') + entier + (frac && Number(frac) !== 0 ? ',' + frac : frac ? ',' + frac : '')
}
function compact(n) {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return nombre(n / 1e9, 1) + '\u00a0Md'
  if (a >= 1e6) return nombre(n / 1e6, a >= 1e7 ? 0 : 1) + '\u00a0M'
  if (a >= 1e4) return nombre(n / 1e3, a >= 1e5 ? 0 : 1) + '\u00a0k'
  return nombre(n)
}
const pct = (x, d = 0) => (x == null ? '—' : nombre(x, d) + '\u202f%')
function ms(v) {
  if (v == null) return '—'
  if (v < 1000) return nombre(Math.round(v)) + '\u00a0ms'
  return nombre(Math.round(v / 100) / 10, 1) + '\u00a0s'
}
function mo(v) {
  if (v == null) return '—'
  return v >= 1024 ? nombre(v / 1024, 1) + '\u00a0Go' : nombre(Math.round(v)) + '\u00a0Mo'
}
function dureeMin(min) {
  if (min == null) return '—'
  if (min < 1) return nombre(Math.round(min * 60)) + '\u00a0s'
  if (min < 60) return nombre(Math.round(min)) + '\u00a0min'
  const hh = Math.floor(min / 60)
  const mm = Math.round(min % 60)
  return `${hh}\u00a0h\u00a0${String(mm).padStart(2, '0')}`
}
/** Un écart signé : « +12 % », « −3 % ». */
function ecartSigne(x, d = 0, unite = '\u202f%') {
  if (x == null || !Number.isFinite(x)) return '—'
  const v = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x
  return (v > 0 ? '+' : v < 0 ? '−' : '±') + nombre(Math.abs(v), d) + unite
}

// ── L'heure de Paris ───────────────────────────────────────────────────

const SECONDE = 1000
const MINUTE = 60 * SECONDE
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE
/** Mardi 3 novembre 2026, 22 h 41 à Paris : l'instant de la maquette. */
const T0 = Date.UTC(2026, 10, 3, 21, 41, 0)
/** Le passage à l'heure d'hiver, le 25 octobre 2026 à 3 h : avant, Paris vit à UTC+2. */
const HEURE_D_HIVER = Date.UTC(2026, 9, 25, 1, 0, 0)
const decalageDeParis = t => (t >= HEURE_D_HIVER ? 1 : 2)
function paris(t) {
  const d = new Date(t + decalageDeParis(t) * HEURE)
  return { an: d.getUTCFullYear(), mois: d.getUTCMonth(), jour: d.getUTCDate(), sem: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() }
}
/** Minuit de Paris du jour d'un instant. */
function minuit(t) {
  const p = paris(t)
  return Date.UTC(p.an, p.mois, p.jour) - decalageDeParis(Date.UTC(p.an, p.mois, p.jour) - 2 * HEURE) * HEURE
}
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
function heureEcrite(t, secondes = false) {
  const p = paris(t)
  return `${p.h}\u00a0h\u00a0${String(p.m).padStart(2, '0')}` + (secondes ? `\u202f:\u202f${String(p.s).padStart(2, '0')}`.replace('\u202f:\u202f', ':') : '')
}
function horodatage(t) {
  const p = paris(t)
  return `${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}:${String(p.s).padStart(2, '0')}`
}
const jourCourt = t => `${JOURS_COURTS[paris(t).sem]} ${paris(t).jour}`
const dateCourte = t => `${paris(t).jour}\u00a0${MOIS[paris(t).mois]}`
function dateLongue(t) {
  const p = paris(t)
  return `${JOURS_LONGS[p.sem]} ${p.jour === 1 ? '1er' : p.jour} ${MOIS_LONGS[p.mois]}`
}
/** « aujourd'hui à 22 h 33 », « hier à 23 h 02 », « dim. 1 à 18 h 10 ». */
function quand(t, maintenant) {
  const j = minuit(maintenant)
  if (t >= j) return `aujourd’hui à ${heureEcrite(t)}`
  if (t >= j - JOUR) return `hier à ${heureEcrite(t)}`
  return `${jourCourt(t)} à ${heureEcrite(t)}`
}
function ilYA(t, maintenant) {
  const d = Math.max(0, maintenant - t)
  if (d < MINUTE) return `il y a ${Math.max(1, Math.round(d / SECONDE))}\u00a0s`
  if (d < HEURE) return `il y a ${Math.round(d / MINUTE)}\u00a0min`
  if (d < JOUR) return `il y a ${Math.round(d / HEURE)}\u00a0h`
  return `il y a ${Math.round(d / JOUR)}\u00a0j`
}

// ── Un hasard qui se répète ────────────────────────────────────────────

function empreinte(texte) {
  let x = 2166136261
  for (let i = 0; i < texte.length; i++) {
    x ^= texte.charCodeAt(i)
    x = Math.imul(x, 16777619)
  }
  return x >>> 0
}
const EMPREINTES = new Map()
/** Un nombre de [0, 1) tiré d'une clé et d'un entier : la même paire, le même nombre. */
function hasard(cle, i = 0) {
  let base = EMPREINTES.get(cle)
  if (base === undefined) EMPREINTES.set(cle, (base = empreinte(cle)))
  let x = (base ^ Math.imul(i | 0, 0x9e3779b1)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  return x / 4294967296
}
/** Un bruit centré, de −1 à 1. */
const bruit = (cle, i) => hasard(cle, i) * 2 - 1
/** Un tirage de Poisson, pour compter des erreurs rares. */
function poisson(lambda, cle, i) {
  if (lambda <= 0) return 0
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * bruit(cle, i)))
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  let j = 0
  do {
    k++
    p *= hasard(cle, i * 31 + j++)
  } while (p > L && k < 60)
  return k - 1
}
const borner = (x, a, b) => Math.min(b, Math.max(a, x))
const somme = l => l.reduce((a, b) => a + (b ?? 0), 0)
const moyenne = l => {
  const v = l.filter(x => x != null)
  return v.length ? somme(v) / v.length : null
}
function centile(l, c) {
  const v = l.filter(x => x != null).sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.min(v.length - 1, Math.floor(v.length * c))]
}
const max = l => l.reduce((a, b) => (b != null && (a == null || b > a) ? b : a), null)

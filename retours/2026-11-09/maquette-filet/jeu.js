// La maquette jouable du nouveau Filet (retours/2026-11-09/le-nouveau-filet.md) : une épreuve de trois manches,
// au nouveau Filet ou au Filet d'aujourd'hui, sur de vraies questions que la production a posées. Tout se joue dans
// la page : rien ici n'est servi par FiestApp, et ce que le téléphone retient (les repères gagnés, les questions
// vues, les réglages) vit dans le localStorage, sous try/catch.
//
// Après trois tours de tablée, le 9 novembre 2026 (retours/2026-11-09/la-tablee-du-filet.md) : quatre joueurs ont joué
// la première version contre le Filet d'aujourd'hui, trois chaque version corrigée, un joueur aveugle deux fois au
// lecteur d'écran ; chaque retouche ci-dessous dit qui l'a demandée.
;(() => {
  'use strict'
  const D = window.FILET
  const ANNEE = 2026
  const app = document.getElementById('app')

  // ── Ce que le téléphone retient ────────────────────────────────────────
  // Deuxième version : les repères gagnés sous la première règle — avec une aide — ne valent plus. Claire retrouvait
  // « 1980 », trouvé par un indice payé, Huguette l'Atari. Les réglages et les questions vues, eux, se reprennent.
  const CLE = 'filet-maquette-v2', CLE_D_AVANT = 'filet-maquette-v1'
  function relire() {
    try {
      const ici = localStorage.getItem(CLE)
      if (ici) return JSON.parse(ici)
      return { ...JSON.parse(localStorage.getItem(CLE_D_AVANT) || '{}'), reperes: [] }
    } catch { return {} }
  }
  function retenir() {
    try { localStorage.setItem(CLE, JSON.stringify(memo)) } catch { /* sans stockage, la maquette oublie : rien de grave */ }
  }
  const memo = Object.assign({ reperes: [], vues: [], coupDOeil: true, chrono: true, coulisses: true, acte: 1 }, relire())

  // ── Les nombres, comme FiestApp les écrit ──────────────────────────────
  const FINE = '\u202F', INSECABLE = '\u00A0'
  const grouper = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, FINE)
  /** « 1852 », « 12 500 », « 32,48 » : groupé dès dix mille, une virgule et deux décimales au plus. */
  function nombre(n) {
    if (!Number.isFinite(n)) return '—'
    const signe = n < 0 ? '−' : ''
    const [entier, dec] = String(Math.round(Math.abs(n) * 100) / 100).split('.')
    return signe + (Number(entier) >= 10000 ? grouper(entier) : entier) + (dec ? `,${dec}` : '')
  }
  /**
   * L'écart d'une grandeur, en pour cent de la réponse, au dixième près : le jugement lit ce nombre-là, et l'écran
   * l'écrit tel quel. Arrondi à l'entier pour l'écran seulement, il faisait lire « Ton écart 6 % » sous « À 6 % près :
   * non » (Claire, 17 pour 16) et « 24 % » sous « À 25 % près : non » (Huguette, 190 g pour 250 g).
   */
  const ecartEnPourCent = (x, v) => Math.round((1000 * Math.abs(x - v)) / v) / 10
  const pourCent = p => `${nombre(p)}${FINE}%`
  /** « 300 millions », « 1 milliard » : sur une tranche ou une borne, neuf chiffres ne tenaient pas en 360 de large. */
  function enMots(n) {
    if (n >= 1e9) { const v = n / 1e9; return `${nombre(v)} milliard${v >= 2 ? 's' : ''}` }
    if (n >= 1e6) { const v = n / 1e6; return `${nombre(v)} million${v >= 2 ? 's' : ''}` }
    return nombre(n)
  }
  const echapper = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  /**
   * La typographie d'un texte déjà en HTML : les espaces fines devant ? ! ; : % et dans « », un nombre jamais coupé de
   * ses milliers ni de son unité — les règles se lisaient « de 3 / 000 à 10 000 » et « ★★ à 25 / % » (Claire).
   */
  const typo = h => h
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${FINE}`)
    .replace(/ ([?!;:%»])/g, `${FINE}$1`)
    .replace(/« /g, `«${FINE}`)
    .replace(/ (à|de|sur|et) (?=[\d★])/g, ` $1${INSECABLE}`)
    .replace(/(\d) (ans?|m|km|cm|kg|g|jours|minutes|degrés|étoiles?|★)/g, `$1${INSECABLE}$2`)
  // Comme `espacesFines` de FiestApp, qui colle aussi l'inversion (« parle-t-on ») par un gluon : coupée au trait
  // d'union, la question se lisait « parle-t- / on ».
  const fines = s => typo(echapper(s)).replace(/-(?=\p{Ll})/gu, '-⁠')
  /**
   * L'unité accordée : celles de la base sont au pluriel, et un grand pas d'un an écrivait « − 1 ans » (la
   * vérification du 9 novembre 2026). Sous deux, le français les veut au singulier ; les symboles ne bougent pas.
   */
  const SINGULIERS = { yeux: 'œil', anneaux: 'anneau' }
  const unite = (u, x) => {
    if (!u || Math.abs(x) >= 2) return u
    if (SINGULIERS[u]) return SINGULIERS[u]
    return /^[a-zà-ÿœ][a-zà-ÿœ’']+s$/i.test(u) && !/^(pays|fois|mois)$/.test(u) ? u.slice(0, -1) : u
  }
  const dire = (q, x) => (q.an ? String(Math.round(x)) : nombre(x) + (q.u ? `${INSECABLE}${unite(q.u, x)}` : ''))
  /**
   * Les étoiles écrites dans une phrase se disent en mots à l'oreille : « à 2 ans ★★★ » se lisait « étoile noire,
   * étoile noire, étoile noire ». Les étoiles d'un score (`etoiles`) ont déjà leur nom (`role="img"`).
   */
  const NOMS_DES_ETOILES = ['une étoile', 'deux étoiles', 'trois étoiles']
  const aLOreille = h => h.replace(/★{1,3}/g, m => `<span aria-hidden="true">${m}</span><span class="sr">${NOMS_DES_ETOILES[m.length - 1]}</span>`)
  /** « −1 ★ » à l'œil, « une étoile en moins » à l'oreille — il s'entendait « moins un, une étoile » (Hugo). */
  const enMoins = p => `<span aria-hidden="true">−${p}${INSECABLE}★</span><span class="sr">${NOMS_DES_ETOILES[p - 1] || `${p} étoiles`} en moins</span>`
  const melanger = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
  const auHasard = a => a[Math.floor(Math.random() * a.length)]
  const entre = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
  const accorde = (n, mot, pluriel = mot + 's') => `${n}${INSECABLE}${n > 1 ? pluriel : mot}`
  const ROMAINS = { 1: 'I', 2: 'II', 3: 'III' }
  function etoiles(n, max = 3, payees = 0) {
    const pleines = Math.max(0, n), vides = Math.max(0, max - pleines - payees)
    const dit = `${accorde(pleines, 'étoile')} sur ${max}${payees ? `, ${payees === 1 ? 'une payée' : `${payees} payées`} pour tes aides` : ''}`
    return `<span class="etoiles" role="img" aria-label="${dit}">${'★'.repeat(pleines)}${payees ? `<span class="payee">${'★'.repeat(payees)}</span>` : ''}<span class="vide">${'☆'.repeat(vides)}</span></span>`
  }
  function balise(couleur) {
    const forme = couleur === 'verte' ? '<circle cx="8" cy="8" r="6"/>' : couleur === 'bleue' ? '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/>' : couleur === 'rouge' ? '<path d="M8 2 14.5 13.5h-13Z"/>' : '<path d="M8 1.5 14.5 8 8 14.5 1.5 8Z"/>'
    return `<svg class="balise balise-${couleur}" viewBox="0 0 16 16" aria-hidden="true">${forme}</svg>`
  }

  // ── Le moteur de difficulté ────────────────────────────────────────────
  // La connaissabilité d'une question au Filet : la part des joueurs qui placeraient sa valeur à 5 % près, selon le
  // panel de l'IA — validé sur les 146 vrais lancers d'une question qui ne se calcule pas (AUC 0,78 pour « il savait »,
  // 0,73 pour la difficulté écrite). En production, elle se recale ensuite sur les lancers de chaque question (le
  // cahier des charges, « Le moteur »).
  const piste = p => (p >= 50 ? 'verte' : p >= 30 ? 'bleue' : p >= 15 ? 'rouge' : 'noire')
  const NOM_DE_PISTE = { verte: 'piste verte', bleue: 'piste bleue', rouge: 'piste rouge', noire: 'piste noire' }
  // L'acte I tire ce que chaque Français sait placer (`q.fr`) — le propriétaire, au matin du 9 novembre 2026 : « le
  // levier le plus fort, c'est d'avoir des questions que chacun connaisse, sachant que la population et la
  // connaissance sont des personnes françaises ». Sur les vrais lancers, ces questions se placent à 2 % près sept fois
  // plus souvent que les autres, et se réussissent à 84 % en deux temps (le cahier des charges, § 4). Trop sévère,
  // cette règle seule passait au-dessus des trois manches sur quatre que vise l'acte I, et ne gardait qu'une question
  // sur douze du vivier : le panel à 50 % et plus la complète — 76 % de manches réussies sur les lancers réels, et trois
  // fois plus de questions (le cahier, § 4.5, `filet-en-production.ts severite`). Les actes II et III se partagent le
  // reste par le panel.
  const premierActe = q => q.fr || q.ia >= 50
  const ACTES = {
    1: { nom: 'Acte I', dit: 'Connu de tous', garde: premierActe, regle: 'chaque Français la sait placer, ou le panel à 50 % et plus' },
    2: { nom: 'Acte II', dit: 'Pointu', garde: q => !premierActe(q) && q.ia >= 25, regle: 'le panel de 25 à 49 %' },
    3: { nom: 'Acte III', dit: 'Pour initiés', garde: q => !premierActe(q) && q.ia < 25, regle: 'le panel sous 25 %' },
  }
  const ANCRAGES = { france: 'un sujet français', monde: 'un sujet du monde', etranger: 'un sujet de l’étranger', ailleurs: 'un sujet de l’étranger' }
  function tirer(mode, acte) {
    const vues = new Set(memo.vues)
    // Aujourd'hui, le tirage lit la marche écrite ; le moteur, la connaissabilité au Filet — et il écarte ce qui se
    // calcule ou se convertit (`q.calcul`) : « secondes dans une heure », « le carré de 25 » faisaient de l'acte I un
    // cours de maths (Théo), et l'indice d'un calcul en était la solution (Claire).
    const tas = mode === 'v2'
      ? D.questions.filter(q => !q.calcul && ACTES[acte].garde(q))
      : D.questions.filter(q => (acte === 3 ? q.d >= 3 : q.d <= 3))
    const neuves = tas.filter(q => !vues.has(q.id))
    const source = neuves.length >= 3 ? neuves : tas
    // Une année au moins dans l'épreuve quand le tas en a : le nouveau Filet a deux visages.
    // Jamais deux fois la même valeur dans une épreuve, comme le tireur de la production : la base pose « Lost »,
    // 108 minutes, sous deux formulations, et 1945 trois fois.
    const vue = new Set()
    const unique = qs => qs.filter(q => { const k = `${q.v}|${q.an ? 'an' : q.u}`; return !vue.has(k) && vue.add(k) })
    const annees = unique(melanger(source.filter(q => q.an))), grandeurs = unique(melanger(source.filter(q => !q.an)))
    const prises = annees.length ? [annees[0], ...grandeurs.slice(0, 2)] : grandeurs.slice(0, 3)
    while (prises.length < 3 && annees.length > prises.filter(q => q.an).length) prises.push(annees[prises.filter(q => q.an).length])
    return melanger(prises.slice(0, 3))
  }

  // ── Le nouveau Filet : quatre époques, puis la valeur ──────────────────
  // Une année : des époques de 25 ans depuis 1800, de 50 de 1500 à 1799, d'un siècle avant — on date plus
  // grossièrement ce qui est loin. Les anneaux suivent l'époque : ★★★ à un douzième, ★★ à un quart de sa largeur.
  // Une grandeur : quatre ordres de grandeur bornés par 1, 3, 10, 30, 100… (de 1 000 à 3 000, de 3 000 à 10 000…),
  // ★★★ à 6 %, ★★ à 25 % de la réponse. Centrées sur des nombres ronds (≈ 100), le milieu d'une tranche était la
  // réponse de toutes les questions qui en ont une ronde : cent anneaux, mille grammes.
  const borneDuDemi = k => (k % 2 === 0 ? Math.pow(10, k / 2) : 3 * Math.pow(10, (k - 1) / 2))
  function epoques(q) {
    if (q.an) {
      const T = q.v >= 1800 ? 25 : q.v >= 1500 ? 50 : 100
      const base = Math.floor(q.v / T) * T
      // L'époque de la réponse au hasard parmi les quatre, sans que la frise passe dans l'avenir.
      const places = [0, 1, 2, 3].filter(i => base - i * T + 4 * T - 1 <= ANNEE)
      const i = places.length ? auHasard(places) : 3
      const debut = base - i * T
      return {
        an: true, T, bonne: i, bonnes: [i],
        tranches: [0, 1, 2, 3].map(k => ({ de: debut + k * T, a: debut + (k + 1) * T - 1 })),
        anneaux: [Math.max(1, Math.round(T / 12)), Math.round(T / 4)],
      }
    }
    // La tranche de la valeur : la plus haute borne de la suite 1, 3, 10, 30… qui ne la dépasse pas.
    let k = 0
    while (borneDuDemi(k + 1) <= q.v) k++
    const places = [0, 1, 2, 3].filter(i => k - i >= 0)
    const i = auHasard(places)
    // Pile sur une borne, la réponse est des deux tranches qui la bordent : 10 000 m², « dans quelle case ? »
    // (Huguette) — la bonne était celle d'au-dessus, et celle d'en dessous l'écrivait aussi.
    const surLaBorne = k > 0 && q.v === borneDuDemi(k) && i > 0
    return {
      an: false, bonne: i, bonnes: surLaBorne ? [i - 1, i] : [i],
      tranches: [0, 1, 2, 3].map(j => { const kk = k - i + j; return { k: kk, de: borneDuDemi(kk), a: borneDuDemi(kk + 1) } }),
    }
  }
  /**
   * Les crans de la piste d'une tranche : réguliers, ronds, deux cents au plus — d'un an pour une époque, de 5 de
   * 300 à 1 000, de 10 de 1 000 à 3 000, d'un au moins pour une réponse entière. La piste d'avant était
   * logarithmique et lisait ses crans par un arrondi : son milieu de 300 à 1 000 tombait vers 550, 625 ne se posait
   * pas (Claire), et « + » restait coincé à 1380 et à 62 (Théo, Huguette) — deux crans écrivaient le même nombre.
   */
  function grilleDe(m, i) {
    const t = m.ep.tranches[i]
    if (m.ep.an) return { de: t.de, a: t.a, pas: 1, n: t.a - t.de, dec: 0 }
    let pas = pasRondAuDessus((t.a - t.de) / 200)
    pas = Math.max(pas, Number.isInteger(m.q.v) ? 1 : 0.1)
    return { de: t.de, a: t.a, pas, n: Math.round((t.a - t.de) / pas), dec: decimalesDe(pas) }
  }
  function pasRondAuDessus(x) {
    for (let p = Math.pow(10, Math.floor(Math.log10(x))); ; p *= 10) for (const r of [1, 2, 5]) if (r * p >= x - 1e-12) return r * p
  }
  const decimalesDe = p => (p >= 1 ? 0 : Math.ceil(-Math.log10(p) - 1e-9))
  const valeurDe = (g, i) => Number((g.de + Math.max(0, Math.min(g.n, Math.round(i))) * g.pas).toFixed(g.dec))
  const indexDe = (g, x) => Math.max(0, Math.min(g.n, Math.round((x - g.de) / g.pas)))
  /** Ses graduations : un trait tous les nombres ronds, huit au plus, pour que la piste se lise régulière à l'œil. */
  const pasDesGraduations = g => pasRondAuDessus((g.a - g.de) / 8)
  /**
   * Un grand pas : une graduation (5 ans, 100 g). Sans lui, de 198 anneaux à 100, Hugo — au lecteur d'écran, qui
   * n'a que les boutons — touchait « − » 98 fois ; le Filet d'aujourd'hui en a, la production aussi.
   */
  const cransDUnGrandPas = g => Math.max(1, Math.round(pasDesGraduations(g) / g.pas))
  function graduationsDe(g) {
    const pas = pasDesGraduations(g)
    const traits = []
    for (let v = Math.ceil(g.de / pas) * pas; v <= g.a + 1e-9; v += pas) traits.push(v)
    return traits
  }
  /** La distance d'abord : à ★★★ ou ★★ près, la manche les vaut même dans l'époque d'à côté ; sinon la bonne époque, ★. */
  function naturelles(m, x) {
    const q = m.q, bonne = m.choisie !== null && m.ep.bonnes.includes(m.choisie)
    if (x === null) return bonne ? 1 : 0
    if (q.an) {
      const e = Math.abs(x - q.v)
      if (e <= m.ep.anneaux[0]) return 3
      if (e <= m.ep.anneaux[1]) return 2
    } else {
      const p = ecartEnPourCent(x, q.v)
      if (p <= 6) return 3
      if (p <= 25) return 2
    }
    return bonne ? 1 : 0
  }
  /** Les réponses qu'un lancer à x prendrait à ★★★ et à ★★, en nombres : la règle se dit aussi sur la piste (Claire). */
  function prisesDe(m, x) {
    if (m.q.an) return [[x - m.ep.anneaux[0], x + m.ep.anneaux[0]], [x - m.ep.anneaux[1], x + m.ep.anneaux[1]]]
    // |x − a| ≤ 6 % de a : a entre x / 1,06 et x / 0,94 ; à 25 % : entre x / 1,25 et x / 0,75.
    return [[x / 1.06, x / 0.94], [x / 1.25, x / 0.75]]
  }
  /**
   * Trois chiffres qui comptent, un dixième sous cent — un entier pour une réponse entière, comme les crans —, arrondis
   * vers l'intérieur : ce que la phrase promet, la règle le tient (« de 70,8 à 79,7 » pour des syllabes, non).
   */
  function versLInterieur(v, haut, entier) {
    let p = v < 100 ? 0.1 : Math.pow(10, Math.floor(Math.log10(v)) - 2)
    if (entier) p = Math.max(1, p)
    return Number(((haut ? Math.floor(v / p + 1e-9) : Math.ceil(v / p - 1e-9)) * p).toFixed(decimalesDe(p)))
  }

  /**
   * Les repères de la frise : les siens d'abord (ce qu'il a déjà su dater), puis des dates que tout le monde connaît —
   * deux au plus, jamais du même sujet, jamais la réponse elle-même, et tirés sans regarder où elle est. L'époque d'un
   * repère se tire d'abord, chacune la même chance : choisis parmi ceux qui s'écartent de la réponse, ils tombaient
   * rarement dans sa case, et deux repères dans deux époques valaient « Deux époques de moins » (Claire, au premier
   * tour). Et plus de distance gardée autour d'elle : un repère jamais à moins d'un quart d'époque de la réponse
   * disait où elle n'était pas — avec 1870 sur la piste, elle ne pouvait être qu'entre 1850 et 1863 (Claire, au
   * troisième tour).
   */
  function reperesDe(q, ep) {
    const tranches = ep.tranches
    const dans = (x, j) => x >= tranches[j].de && x <= tranches[j].a
    const mots = new Set(q.t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(m => m.length >= 5))
    const souffle = l => l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).some(m => m.length >= 5 && mots.has(m))
    // La réponse elle-même jamais : « 1969 · Le premier pas sur la Lune » pour une question sur la Lune, que les mots
    // de cinq lettres ne voient pas. Ne dire que « pas cette année-là » ne coûte presque rien.
    const laReponse = x => (ep.an ? x === q.v : Math.abs(x / q.v - 1) < 0.02)
    let siens = [], communs = []
    if (ep.an) {
      siens = memo.reperes.filter(r => r.id !== q.id && !laReponse(r.an) && !souffle(r.l)).map(r => ({ x: r.an, l: r.l, perso: true }))
      communs = D.reperesAnnees.filter(r => !laReponse(r.an) && !souffle(r.l)).map(r => ({ x: r.an, l: r.l, perso: false }))
    } else {
      const u = (q.u || '').toLowerCase()
      communs = D.reperesGrandeurs.filter(r => r.u === u && !laReponse(r.v) && !souffle(r.l)).map(r => ({ x: r.v, l: r.l, perso: false }))
    }
    const pris = []
    const tranche = x => [0, 1, 2, 3].find(j => dans(x, j))
    // Un des siens au plus : les deux repères d'Huguette prenaient toute la frise, et plus une date connue n'y venait.
    for (const r of melanger(siens)) {
      const j = tranche(r.x)
      if (pris.length < 1 && j !== undefined) pris.push({ ...r, j })
    }
    for (const j of melanger([0, 1, 2, 3])) {
      if (pris.length >= 2) break
      if (pris.some(p => p.j === j)) continue
      // Un repère pile sur une borne (30 cm, entre 10–30 et 30–100) est des deux tranches : il ne se tire qu'une fois.
      const ici = communs.filter(r => dans(r.x, j) && !pris.some(p => p.x === r.x))
      if (ici.length) pris.push({ ...auHasard(ici), j })
    }
    return pris.sort((a, b) => a.x - b.x)
  }
  /** Où se pose une valeur sur la frise des quatre tranches, en pour cent : un quart chacune, régulière dedans. */
  function surLaFrise(ep, x) {
    const t = ep.tranches
    if (x <= t[0].de) return 0
    if (x >= t[3].a) return 100
    const j = ep.an ? t.findIndex(u => x <= u.a) : t.findIndex(u => x <= u.a)
    const u = t[j]
    const fin = ep.an ? u.a + 1 : u.a
    return 25 * j + (25 * (x - u.de + (ep.an ? 0.5 : 0))) / (fin - u.de)
  }

  // ── Le Filet d'aujourd'hui, tel que la production le joue ──────────────
  // `shared/cabinet/jeux/filet.ts` et `client/src/views/cabinet/jeux/Filet.tsx`, recopiés : la piste, son pas, ses
  // mots. La première version de la maquette en avait inventé (« Tout près » pour le filet moyen, des dixièmes de
  // pièce, Éclairer sans un mot) que la tablée prenait pour des défauts de la production.
  const DEMI = { petit: 0.035, moyen: 0.09, grand: 0.2 }
  const ETOILES_DU_FILET = { petit: 3, moyen: 2, grand: 1 }
  const NOMS_DES_FILETS = { petit: 'Petit', moyen: 'Moyen', grand: 'Grand' }
  function borneRonde(v, brute) {
    const ordre = 10 ** Math.max(0, Math.floor(Math.log10(brute)) - 1)
    const dessus = Math.ceil(brute / ordre) * ordre
    return v / dessus >= 0.08 ? dessus : Math.floor(brute / ordre) * ordre
  }
  function pasDeLaPiste(v, max) {
    const pas = Math.max(1, Math.round(max / 200))
    const petit = 2 * DEMI.petit * max
    if (Number.isInteger(v) || pas <= petit) return pas
    return [0.5, 0.2, 0.1, 0.05, 0.02, 0.01].find(p => p <= petit) ?? 0.01
  }
  function pisteDAujourdhui(q) {
    if (q.an) {
      const L = entre(50, 119)
      const min = q.v - entre(Math.ceil(0.08 * L), Math.floor(0.92 * L))
      return { min, max: Math.min(min + L, ANNEE), pas: 1 }
    }
    const max = borneRonde(q.v, q.v / (0.08 + Math.random() * 0.84))
    return { min: 0, max, pas: pasDeLaPiste(q.v, max) }
  }
  const surLaPiste = (p, v) => Number(v.toFixed(decimalesDe(p.pas)))
  const auCran = (p, v, arrondi) => surLaPiste(p, Math.min(p.max, Math.max(p.min, p.min + arrondi((v - p.min) / p.pas) * p.pas)))
  const bornesDuFilet = (p, x, taille) => { const w = DEMI[taille] * (p.max - p.min); return { de: auCran(p, x - w, n => Math.ceil(n - 1e-9)), a: auCran(p, x + w, n => Math.floor(n + 1e-9)) } }
  const grandPas = p => Math.max(p.pas, Math.round((p.max - p.min) / 10 / p.pas) * p.pas)

  // ── L'épreuve ──────────────────────────────────────────────────────────
  let E = null // l'épreuve en cours
  let M = null // la manche en cours
  let minuteur = null
  const DUREE = 45_000

  function commencer(mode, acte) {
    memo.acte = acte
    retenir()
    E = { mode, acte, questions: tirer(mode, acte), i: 0, coeurs: 4, resultats: [], offerteUtilisee: false, eclairerUtilise: false }
    ouvrirLaManche()
  }
  function ouvrirLaManche() {
    const q = E.questions[E.i]
    if (E.mode === 'v2') {
      const ep = epoques(q)
      M = { q, ep, choisie: null, grille: null, x: null, retirees: [], aides: [], reperes: reperesDe(q, ep), debut: Date.now(), fin: null }
    } else {
      const p = pisteDAujourdhui(q)
      const milieu = surLaPiste(p, p.min + Math.round((p.max - p.min) / 2 / p.pas) * p.pas)
      M = { q, p, x: milieu, taille: 'moyen', zone: null, debut: Date.now(), fin: null }
    }
    afficherLaManche()
    enHaut('.question')
    lancerLeMinuteur()
  }
  /**
   * Chaque écran neuf s'ouvre en haut, le focus sur son titre : la manche suivante s'ouvrait là où « Manche suivante »
   * avait laissé la page, la question cachée au-dessus (Huguette, à chaque manche).
   */
  function enHaut(selecteur) {
    window.scrollTo(0, 0)
    document.querySelector(selecteur)?.focus({ preventScroll: true })
  }
  function lancerLeMinuteur() {
    clearInterval(minuteur)
    if (!memo.chrono) return
    minuteur = setInterval(() => {
      if (!M || M.fin) return clearInterval(minuteur)
      const reste = Math.max(0, DUREE - (Date.now() - M.debut))
      const barre = document.querySelector('.chrono span')
      if (barre) {
        barre.style.transform = `scaleX(${reste / DUREE})`
        barre.parentElement.classList.toggle('presse', reste < 10_000)
      }
      if (reste === 0) { clearInterval(minuteur); lancer(true) }
    }, 200)
  }

  // Les aides du nouveau Filet : chacune une fois par manche, et chacune payée retire une étoile à ce que la manche
  // rapporte. Elles abaissaient un plafond : qui ne visait qu'une étoile ne payait rien, et les deux prises à chaque
  // manche ratée d'avance faisaient une assurance gratuite pour ses cœurs (Claire). La carte Coup d'œil offre la
  // première de l'épreuve.
  const AIDES = {
    deux: { nom: q => (q.an ? 'Deux époques de moins' : 'Deux ordres de moins') },
    indice: { nom: () => 'Un indice' },
  }
  const payees = m => m.aides.filter(a => !a.offerte).length
  function prendreUneAide(cle) {
    if (!M || M.fin || M.aides.some(a => a.cle === cle)) return
    const offerte = memo.coupDOeil && !E.offerteUtilisee
    if (offerte) E.offerteUtilisee = true
    M.aides.push({ cle, offerte })
    if (cle === 'deux') {
      const mauvaises = melanger([0, 1, 2, 3].filter(i => !M.ep.bonnes.includes(i))).slice(0, 2)
      M.retirees = mauvaises
      if (M.choisie !== null && mauvaises.includes(M.choisie)) { M.choisie = null; M.grille = null; M.x = null }
    }
    afficherLaManche()
    // L'aide prise vient sous les yeux et à l'oreille : le focus va sur ce qu'elle a donné — l'indice, ou ce qui reste
    // des époques. Hugo n'entendait rien venir, et un Tab plus loin tombait sur « Quitter ».
    const el = document.getElementById(cle === 'indice' ? 'indice' : 'retirees')
    el?.focus({ preventScroll: true })
    el?.scrollIntoView({ block: 'nearest' })
  }
  function choisirLEpoque(i) {
    if (!M || M.fin || M.retirees.includes(i) || M.choisie === i) return
    M.choisie = i
    M.grille = grilleDe(M, i)
    // Le curseur se pose au milieu de l'époque choisie, et sa fourchette s'affiche d'emblée — le propriétaire, au matin
    // du 9 novembre : « elle devrait se placer directement au milieu ». Les versions d'avant attendaient un toucher ; le
    // milieu ne donne rien de plus que ce toucher-là, qui est déjà le meilleur coup de qui ne sait rien. Il garde la
    // valeur qu'il visait si elle tient dans la nouvelle époque.
    const g = M.grille
    M.x = M.x !== null && M.x >= g.de && M.x <= g.a ? valeurDe(g, indexDe(g, M.x)) : valeurDe(g, g.n / 2)
    afficherLaManche()
    // La piste qui s'ouvre vient sous les yeux, au-dessus de « Lancer » collé en bas : laissée au bas de l'écran, elle
    // passait sous le bouton, et le toucher du milieu tombait sur lui (le rendu du 9 novembre 2026).
    document.getElementById('curseur-bloc')?.scrollIntoView({ block: 'nearest' })
  }
  function bouger(pos) {
    if (!M || M.fin) return
    if (E.mode === 'v2') {
      if (M.choisie === null) return
      M.x = valeurDe(M.grille, pos)
    } else {
      M.x = surLaPiste(M.p, Math.max(M.p.min, Math.min(M.p.max, M.p.min + Math.round(pos) * M.p.pas)))
    }
    rafraichirLeCurseur()
  }
  function unCran(sens, grand = false) {
    if (!M || M.fin) return
    if (E.mode === 'v2') {
      if (M.choisie === null) return
      // Pas encore posé, « + » ou « − » le pose au milieu de la piste.
      bouger(M.x === null ? M.grille.n / 2 : indexDe(M.grille, M.x) + sens * (grand ? cransDUnGrandPas(M.grille) : 1))
    } else {
      const pas = grand ? grandPas(M.p) / M.p.pas : 1
      bouger(Math.round((M.x - M.p.min) / M.p.pas) + sens * pas)
    }
  }
  function lancer(auto = false) {
    if (!M || M.fin) return
    clearInterval(minuteur)
    let n, rate
    if (E.mode === 'v2') {
      // Le temps écoulé lance ce qui est posé : l'époque seule vaut son étoile, le curseur s'il est posé.
      if (!auto && (M.choisie === null || M.x === null)) return
      M.nat = M.choisie === null ? 0 : naturelles(M, M.x)
      M.payees = Math.min(payees(M), M.nat)
      n = M.nat - M.payees
      // Le cœur tombe à la manche ratée, jamais à cause d'une aide : réussie, même à zéro étoile une fois l'aide
      // payée, elle le garde.
      rate = M.nat === 0
    } else {
      n = Math.abs(M.x - M.q.v) <= DEMI[M.taille] * (M.p.max - M.p.min) + 1e-9 ? ETOILES_DU_FILET[M.taille] : 0
      rate = n === 0
    }
    M.fin = { n, rate, auto, le: Date.now() }
    if (rate) E.coeurs = Math.max(0, E.coeurs - 1)
    // Un repère gagné : une année placée à deux étoiles au moins, sans aide — l'Atari « de l'indice » n'était pas son
    // savoir (Huguette) —, revient sur la frise des prochaines dates.
    if (E.mode === 'v2' && M.q.an && M.nat >= 2 && M.aides.length === 0 && !memo.reperes.some(r => r.id === M.q.id)) {
      memo.reperes.push({ id: M.q.id, an: M.q.v, l: M.q.r || M.q.t.slice(0, 40) })
      M.repereGagne = true
    }
    memo.vues = [...new Set([...memo.vues, M.q.id])].slice(-300)
    retenir()
    E.resultats.push({ q: M.q, n, nat: M.nat ?? n, x: M.x, choisie: M.choisie, aides: M.aides ? M.aides.slice() : [], eclairer: !!M.zone, taille: M.taille, auto })
    afficherLaRevelation()
  }
  function suivante() {
    if (E.coeurs === 0 || E.i >= E.questions.length - 1) return afficherLeBilan()
    E.i++
    ouvrirLaManche()
  }

  // ── L'affichage ────────────────────────────────────────────────────────
  function tete() {
    const a = ACTES[E.acte]
    const coeurs = '♥'.repeat(E.coeurs) + `<span class="perdu">${'♥'.repeat(4 - E.coeurs)}</span>`
    return `<header class="tete">
      <div class="tete-g"><b>${a.nom}</b><span>Manche ${E.i + 1} sur 3</span></div>
      <div class="tete-d"><span class="coeurs" role="img" aria-label="${accorde(E.coeurs, 'cœur')} sur 4">${coeurs}</span>
      <button type="button" class="quitter" data-geste="quitter">Quitter</button></div>
    </header>`
  }
  function chrono() {
    if (!memo.chrono) return ''
    const reste = M.fin ? 0 : Math.max(0, DUREE - (Date.now() - M.debut))
    return `<div class="chrono" aria-hidden="true"><span style="transform:scaleX(${reste / DUREE})"></span></div>`
  }
  function laQuestion(q) {
    const mode = E.mode === 'v2' ? 'Le nouveau Filet' : 'Le Filet d’aujourd’hui'
    return `<div class="question-bloc"><p class="label ligne-du-mode"><span>${echapper(q.c)}</span><span>${mode}</span></p><h2 class="question${q.t.length > 110 ? ' longue' : ''}" tabindex="-1">${fines(q.t)}</h2></div>`
  }
  function coulisses(q) {
    if (!memo.coulisses) return ''
    const c = piste(q.ia)
    const pour = E.mode === 'v2' ? `${ACTES[E.acte].nom} : ${ACTES[E.acte].regle}` : `tirée comme aujourd’hui, sur sa marche écrite (${q.d} sur 5)`
    const regle = M.ep ? (M.ep.an ? `époques de ${M.ep.T} ans · ★★★ à ${accorde(M.ep.anneaux[0], 'an')} · ★★ à ${M.ep.anneaux[1]} ans` : 'tranches de 1 à 3, de 3 à 10… · ★★★ à 6 % · ★★ à 25 % de la réponse') : `piste de ${dire(q, M.p.min)} à ${dire(q, M.p.max)}, crans de ${nombre(M.p.pas)}`
    return `<details class="coulisses"${memo.coulissesOuvertes ? ' open' : ''}><summary>Les coulisses du moteur</summary><dl>
      <dt>Connaissabilité</dt><dd>${balise(c)} ${q.ia} % la placeraient à 5 % près · ${NOM_DE_PISTE[c]}</dd>
      <dt>Chaque Français</dt><dd>${fines(`${q.fr ? 'la sait placer' : 'ne la sait pas placer'}${q.anc ? ` · ${ANCRAGES[q.anc]}` : ''}${q.fp ? ` — ${q.fp}` : ''}`)}</dd>
      <dt>En QCM</dt><dd>${q.qcm} % la trouveraient parmi quatre</dd>
      <dt>Difficulté écrite</dt><dd>${q.d} sur 5</dd>
      <dt>Choisie pour</dt><dd>${fines(pour)}</dd>
      <dt>La règle</dt><dd>${fines(regle)}</dd>
      ${q.calcul ? '<dt>Écartée</dt><dd>se calcule ou se convertit : le nouveau Filet ne la pose pas</dd>' : ''}
    </dl></details>`
  }
  /**
   * La frise des quatre tranches. Ses épingles ont chacune sa forme, et la légende les dit en mots : ▼ la réponse,
   * au-dessus ; ▲ ton lancer, en dessous ; ○ un repère, ◆ le tien. Des ronds de quatre teintes se confondaient
   * pour un daltonien, et le lancer se cachait sous la réponse (Samir, Claire, Huguette). À la révélation, l'époque
   * écrit aussi « la bonne » et « ton choix » : la couleur ne le dit pas seule.
   */
  function frise(m, revelee = false) {
    const ep = m.ep
    const pc = x => surLaFrise(ep, x).toFixed(2)
    const haut = m.reperes.map(r => `<span class="marque${r.perso ? ' perso' : ''}" style="left:${pc(r.x)}%"></span>`).join('') +
      (revelee ? `<span class="marque reponse" style="left:${pc(m.q.v)}%"></span>` : '')
    const lance = revelee && m.choisie !== null && m.x !== null
    const bas = lance ? `<span class="marque lancer" style="left:${pc(m.x)}%"></span>` : ''
    const tranches = ep.tranches.map((t, i) => {
      const bonne = revelee && ep.bonnes.includes(i), choisie = revelee && i === m.choisie
      const classes = ['tranche', m.retirees.includes(i) ? 'retiree' : '', bonne ? 'bonne' : '', choisie ? 'choisie' : ''].filter(Boolean).join(' ')
      const de = ep.an ? t.de : enMots(t.de), a = ep.an ? t.a : enMots(t.a)
      const dit = revelee ? (bonne ? `<span class="dit">${choisie ? 'la bonne, ton choix' : 'la bonne'}</span>` : choisie ? '<span class="dit">ton choix</span>' : '') : ''
      const texte = `<span class="de">${de}</span><span class="a">${a}</span>${dit}`
      return `<button type="button" class="${classes}" data-epoque="${i}" aria-pressed="${m.choisie === i}" aria-label="De ${de} à ${a}${m.retirees.includes(i) ? ', retirée' : ''}${revelee ? (bonne ? ', la bonne' : '') + (choisie ? ', ton choix' : '') : ''}"${revelee || m.retirees.includes(i) ? ' aria-disabled="true"' : ''}>${texte}</button>`
    }).join('')
    const nomme = r => `${ep.an ? r.x : dire(m.q, r.x)} · ${fines(r.l)}${r.perso ? ' (ton repère)' : ''}`
    const legende = [
      ...(revelee ? [`<li class="cle-reponse"><i aria-hidden="true">▼</i>${fines(`La réponse, ${dire(m.q, m.q.v)}`)}</li>`] : []),
      ...(lance ? [`<li class="cle-lancer"><i aria-hidden="true">▲</i>${fines(`Ton lancer, ${dire(m.q, m.x)}`)}</li>`] : []),
      ...m.reperes.map(r => `<li class="${r.perso ? 'cle-perso' : 'cle-repere'}"><i aria-hidden="true">${r.perso ? '◆' : '○'}</i>${nomme(r)}</li>`),
    ]
    return `<div class="frise${revelee ? ' revelee' : ''}${m.reperes.length || revelee ? '' : ' sans-reperes'}"><div class="marques" aria-hidden="true">${haut}</div>
      <div class="tranches" role="group" aria-label="${ep.an ? 'Quatre époques' : 'Quatre ordres de grandeur'}">${tranches}</div>${revelee ? `<div class="marques-bas" aria-hidden="true">${bas}</div>` : ''}</div>
      ${legende.length ? `<ul class="legende">${legende.join('')}</ul>` : ''}`
  }
  /** La place d'une valeur sur la piste ouverte, en pour cent : régulière, d'un bord à l'autre de la tranche. */
  const surLaGrille = (m, x) => {
    const g = m.grille
    return m.ep.an ? (100 * (x - g.de + 0.5)) / (g.a + 1 - g.de) : (100 * (x - g.de)) / (g.a - g.de)
  }
  function anneauxHtml(m) {
    if (m.choisie === null || m.x === null) return ''
    const pc = x => surLaGrille(m, x)
    const bande = (classe, [bas, haut]) => { const g = Math.max(0, pc(bas - (m.ep.an ? 0.5 : 0))), d = Math.min(100, pc(haut + (m.ep.an ? 0.5 : 0))); return d > g ? `<span class="anneau ${classe}" style="left:${g.toFixed(2)}%;width:${(d - g).toFixed(2)}%"></span>` : '' }
    const [trois, deux] = prisesDe(m, m.x)
    return bande('anneau-2', deux) + bande('anneau-3', trois)
  }
  function valeurHtml(m) {
    return `${m.q.an ? m.x : nombre(m.x)}${!m.q.an && m.q.u ? ` <small>${echapper(unite(m.q.u, m.x))}</small>` : ''}`
  }
  /**
   * Les étoiles d'un anneau, une fois les aides payées : celles qui restent, puis la payée, barrée — et à l'oreille,
   * ce qui reste. Après une aide, l'écran montrait encore « ★★★ de 142 à 159 » (Claire, qui n'en gardait qu'une).
   */
  function netHtml(n, p) {
    if (!p) return aLOreille('★'.repeat(n))
    const reste = Math.max(0, n - p)
    const dit = reste ? `${NOMS_DES_ETOILES[reste - 1]}, ton aide payée` : 'plus rien, tes aides payées'
    return `<span aria-hidden="true">${'★'.repeat(reste)}<s class="payee">${'★'.repeat(Math.min(n, p))}</s></span><span class="sr">${dit}</span>`
  }
  /**
   * Ce que couvre le filet : « ★★★ 1935–1939   ★★ 1931–1943 ». À l'oreille, « de 1935 à 1939 et… ». Deux morceaux
   * qui ne se coupent pas — « ★★ » seul en fin de ligne se lisait avec la fourchette d'au-dessus (Huguette) —, côte à
   * côte, ou l'un sous l'autre sur un petit écran : un point entre eux restait seul au bout de la première ligne.
   */
  function couvreHtml(m) {
    const [trois, deux] = prisesDe(m, m.x)
    const entier = Number.isInteger(m.q.v)
    const d = (bas, haut) => {
      const [de, a] = m.q.an ? [Math.ceil(bas), Math.floor(haut)] : [versLInterieur(bas, false, entier), versLInterieur(haut, true, entier)]
      const dit = v => (m.q.an ? v : enMots(v))
      return de === a ? `pile sur ${dit(de)}` : `<span aria-hidden="true">${dit(de)}–${dit(a)}</span><span class="sr">de ${dit(de)} à ${dit(a)}</span>`
    }
    const p = payees(m)
    const fin = `<span class="nobr">${netHtml(3, p)} ${d(...trois)}</span>`
    // Sur une toute petite piste (de 1 à 3), les deux anneaux couvrent la même chose : « ★★★ pile sur 2 · ★★ pile sur
    // 2 » se lisait deux fois pour rien.
    if (d(...trois) === d(...deux)) return fin
    return `${fin}<span class="sr"> et </span><span class="nobr">${netHtml(2, p)} ${d(...deux)}</span>`
  }
  function libelleDuLancer(m) {
    return m.choisie === null ? `Choisis d’abord ${m.q.an ? 'une époque' : 'un ordre de grandeur'}` : 'Lancer le filet'
  }
  /**
   * La valeur : le gros chiffre, ce que couvre le filet, la piste et ses crans, les grands pas — rien d'autre. Les
   * bornes se lisent déjà dans l'époque choisie, et les repères de la piste dans la légende de la frise : en plus,
   * l'écran était « un peu brouillon » (le propriétaire, au matin du 9 novembre).
   */
  function etapeValeur(m) {
    const g = m.grille
    const traits = graduationsDe(g).map(v => `<span class="trait" style="left:${surLaGrille(m, v).toFixed(2)}%"></span>`).join('')
    const i = indexDe(g, m.x)
    const grand = cransDUnGrandPas(g) * g.pas
    const grandDit = m.ep.an ? accorde(grand, 'an') : dire(m.q, grand)
    // Les repères de cette tranche descendent sur la piste : « comme Notre-Dame », 69 m, se cherchait à tâtons (Samir).
    const reperes = m.reperes.filter(r => r.x >= g.de && r.x <= g.a).map(r => `<span class="repere-piste${r.perso ? ' perso' : ''}" style="left:${surLaGrille(m, r.x).toFixed(2)}%"></span>`).join('')
    return `<div class="valeur-vise"><output class="valeur" id="valeur" for="curseur">${valeurHtml(m)}</output></div>
      <p class="couvre" id="couvre">${couvreHtml(m)}</p>
      <div class="curseur apparait" id="curseur-bloc">
        <button type="button" class="cran" id="moins" data-cran="-1" aria-label="Un cran de moins"${i === 0 ? ' aria-disabled="true"' : ''}>−</button>
        <div class="piste"><div class="rail" id="anneaux">${anneauxHtml(m)}</div><div class="decor" aria-hidden="true">${traits}${reperes}</div>
          <input id="curseur" class="range" type="range" min="${g.de}" max="${g.a}" step="${g.pas}" value="${m.x}" aria-label="${m.q.an ? 'L’année' : 'La valeur'}" aria-valuetext="${m.q.an ? m.x : dire(m.q, m.x)}">
        </div>
        <button type="button" class="cran" id="plus" data-cran="1" aria-label="Un cran de plus"${i === g.n ? ' aria-disabled="true"' : ''}>+</button>
      </div>
      <div class="grands-pas"><button type="button" class="cran" id="grand-moins" data-grand="-1" aria-label="${grandDit} de moins"${i === 0 ? ' aria-disabled="true"' : ''}>−${INSECABLE}${grandDit}</button><button type="button" class="cran" id="grand-plus" data-grand="1" aria-label="${grandDit} de plus"${i === g.n ? ' aria-disabled="true"' : ''}>+${INSECABLE}${grandDit}</button></div>`
  }
  function aides(m) {
    const offerte = memo.coupDOeil && !E.offerteUtilisee
    // Sans indice honnête — la question donne déjà l'époque : un sous-marin allemand, la trêve de Noël —, l'aide ne
    // s'offre pas : le juge des indices n'en a trouvé aucun qui ne soit pas la réponse.
    const offertes = Object.entries(AIDES).filter(([cle]) => cle !== 'indice' || m.q.i)
    const boutons = offertes.map(([cle, a]) => {
      const prise = m.aides.find(x => x.cle === cle)
      // « Gratuite » sur les deux, et la phrase dessous dit que seule la première l'est : ce que la tablée a compris
      // d'emblée (Samir, Huguette) ; « Offerte » sur chacune laissait croire à deux aides offertes.
      const cout = prise ? (prise.offerte ? 'Prise · offerte' : `Prise · ${enMoins(1)}`) : offerte ? 'Gratuite' : 'Coûte une étoile'
      return `<button type="button" class="aide${!prise && offerte ? ' offerte' : ''}" data-aide="${cle}"${prise ? ' aria-disabled="true"' : ''}><b>${a.nom(m.q)}</b><small>${cout}</small></button>`
    }).join('')
    const p = payees(m)
    // Ce que l'aide coûte, en clair : une étoile retirée de ce que la manche rapportera — Samir ne savait pas si c'était
    // « une étoile retirée de mon score, ou seulement le plafond qui baisse » —, et jamais le cœur : Claire et Samir ne
    // l'apprenaient qu'à la révélation. Une aide offerte le dit aussi : Huguette, sous « Prise · offerte », croyait
    // avoir payé.
    const offerteIci = m.aides.some(a => a.offerte)
    const prix = p
      ? `${fines('Tes aides :')} ${enMoins(p)}${fines(', jamais un cœur.')}`
      : fines(offerteIci ? 'Ton aide était offerte : elle ne te coûte rien.'
        : offerte ? 'Ta carte Coup d’œil offre la première ; ensuite, une aide coûte une étoile, jamais un cœur.'
        : 'Une aide coûte une étoile, jamais un cœur.')
    return `<section class="aides" aria-label="Les aides"><div class="aides-rangee${offertes.length === 1 ? ' une' : ''}">${boutons}</div><p class="prix">${prix}</p></section>`
  }
  /** Ce que « Deux époques de moins » a laissé, en mots : les cases barrées ne se lisent qu'à l'œil. */
  function retireesHtml(m) {
    if (!m.retirees.length) return ''
    const dit = j => { const t = m.ep.tranches[j]; return m.ep.an ? `${t.de}–${t.a}` : `${enMots(t.de)} à ${enMots(t.a)}` }
    const restent = [0, 1, 2, 3].filter(j => !m.retirees.includes(j))
    return `<p class="note" id="retirees" tabindex="-1">${fines(`Il reste ${dit(restent[0])} et ${dit(restent[1])}.`)}</p>`
  }
  function indiceHtml(m) {
    return m.aides.some(a => a.cle === 'indice') ? `<p class="indice" id="indice" tabindex="-1"><b>Indice · </b>${fines(m.q.i || 'Pas d’indice écrit pour cette question.')}</p>` : ''
  }
  function afficherLaManche() {
    const m = M, q = m.q
    if (E.mode === 'v2') {
      app.innerHTML = `${tete()}${chrono()}${laQuestion(q)}
        <section class="etape"><p class="consigne">${m.choisie === null ? (q.an ? 'Choisis l’époque' : 'Choisis l’ordre de grandeur') : q.an ? 'L’époque' : 'L’ordre de grandeur'}<span>, la bonne vaut${INSECABLE}${netHtml(1, payees(m))}</span></p>${frise(m)}</section>
        ${retireesHtml(m)}${indiceHtml(m)}
        ${m.choisie === null ? '' : `<section class="etape" aria-label="${q.an ? 'L’année' : 'La valeur'}">${etapeValeur(m)}</section>`}
        ${aides(m)}
        <button type="button" class="btn btn-or btn-plein" id="lancer" data-geste="lancer"${m.choisie === null ? ' aria-disabled="true"' : ''}>${libelleDuLancer(m)}</button>
        ${coulisses(q)}`
    } else {
      const p = m.p, L = p.max - p.min
      const zone = m.zone ? `<span class="zone" style="left:${(100 * (m.zone.de - p.min) / L).toFixed(2)}%;width:${(100 * (m.zone.a - m.zone.de) / L).toFixed(2)}%"></span>` : ''
      const zoneDite = m.zone ? `<p class="souffle" id="souffle" tabindex="-1">${fines(`Indice : la réponse est entre ${dire(q, auCran(p, m.zone.de, n => Math.floor(n + 1e-9)))} et ${dire(q, auCran(p, m.zone.a, n => Math.ceil(n - 1e-9)))}.`)}</p>` : ''
      const g = dire(q, grandPas(p))
      app.innerHTML = `${tete()}${chrono()}${laQuestion(q)}
        <div class="valeur-vise"><output class="valeur" id="valeur">${valeurDAujourdhui(m)}</output></div>
        <p class="couvre" id="couvre">${couvreDAujourdhui(m)}</p>
        <div class="curseur"><button type="button" class="cran" data-cran="-1" aria-label="Un cran de moins">−</button>
          <div class="piste"><div class="rail" id="anneaux">${zone}<span class="anneau anneau-2" id="filet-bande" style="${filetDAujourdhui(m)}"></span></div>
            <input id="curseur" class="range" type="range" min="${p.min}" max="${p.max}" step="${p.pas}" value="${m.x}" aria-label="Ton estimation" aria-valuetext="${dire(q, m.x)}"></div>
          <button type="button" class="cran" data-cran="1" aria-label="Un cran de plus">+</button></div>
        <div class="bornes"><span>${dire(q, p.min)}</span><span>${dire(q, p.max)}</span></div>
        <div class="grands-pas"><button type="button" class="cran" data-grand="-1" aria-label="Un grand pas de moins">−${INSECABLE}${g}</button><button type="button" class="cran" data-grand="1" aria-label="Un grand pas de plus">+${INSECABLE}${g}</button></div>
        ${zoneDite}
        <div class="tailles" role="group" aria-label="La taille de ton filet">${Object.keys(DEMI).map(t => `<button type="button" class="taille" data-taille="${t}" aria-pressed="${m.taille === t}">${NOMS_DES_FILETS[t]}${etoiles(ETOILES_DU_FILET[t], ETOILES_DU_FILET[t])}</button>`).join('')}</div>
        ${memo.coupDOeil && !E.eclairerUtilise ? '<button type="button" class="btn" data-geste="eclairer">Éclairer (ta carte Coup d’œil, une fois par épreuve)</button>' : ''}
        <button type="button" class="btn btn-or btn-plein" data-geste="lancer">Lancer le filet</button>
        ${coulisses(q)}`
    }
  }
  const valeurDAujourdhui = m => `${m.q.an ? m.x : nombre(m.x)}${!m.q.an && m.q.u ? ` <small>${echapper(unite(m.q.u, m.x))}</small>` : ''}`
  const couvreDAujourdhui = m => { const b = bornesDuFilet(m.p, m.x, m.taille); return fines(`Ton filet : de ${dire(m.q, b.de)} à ${dire(m.q, b.a)}`) }
  const filetDAujourdhui = m => {
    const p = m.p, L = p.max - p.min, demi = DEMI[m.taille] * L
    const g = Math.max(0, (100 * (m.x - demi - p.min)) / L), d = Math.min(100, (100 * (m.x + demi - p.min)) / L)
    return `left:${g.toFixed(2)}%;width:${(d - g).toFixed(2)}%`
  }
  /**
   * Seul ce que le curseur change se redessine — la valeur, le filet et ce qu'il couvre, le bouton du lancer : redessiné
   * en entier, l'écran lâchait le curseur sous le doigt, au premier toucher comme au premier cran d'un glissé.
   */
  function rafraichirLeCurseur() {
    const q = M.q
    const r = document.getElementById('curseur')
    if (E.mode === 'v2') {
      document.getElementById('valeur').innerHTML = valeurHtml(M)
      document.getElementById('couvre').innerHTML = couvreHtml(M)
      document.getElementById('anneaux').innerHTML = anneauxHtml(M)
      if (r) { r.value = String(M.x); r.setAttribute('aria-valuetext', q.an ? String(M.x) : dire(q, M.x)) }
      const i = indexDe(M.grille, M.x)
      for (const [id, bout] of [['moins', 0], ['grand-moins', 0], ['plus', M.grille.n], ['grand-plus', M.grille.n]]) document.getElementById(id)?.setAttribute('aria-disabled', String(i === bout))
      const b = document.getElementById('lancer')
      if (b) { b.textContent = libelleDuLancer(M); b.setAttribute('aria-disabled', String(M.choisie === null)) }
      return
    }
    document.getElementById('valeur').innerHTML = valeurDAujourdhui(M)
    document.getElementById('couvre').innerHTML = couvreDAujourdhui(M)
    const bande = document.getElementById('filet-bande')
    if (bande) bande.setAttribute('style', filetDAujourdhui(M))
    if (r) { r.value = String(M.x); r.setAttribute('aria-valuetext', dire(q, M.x)) }
  }

  function afficherLaRevelation() {
    const m = M, q = m.q, n = m.fin.n
    let titre, juge = '', piste = ''
    if (E.mode === 'v2') {
      const nat = m.nat
      titre = nat === 3 ? 'Pile dedans' : nat === 2 ? 'Tout près' : nat === 1 ? (q.an ? 'La bonne époque' : 'Le bon ordre de grandeur') : m.fin.auto && m.choisie === null ? 'Le temps a filé' : 'À côté'
      const bonne = m.choisie !== null && m.ep.bonnes.includes(m.choisie)
      const ecartDit = m.choisie === null || m.x === null ? '' : q.an ? accorde(Math.abs(m.x - q.v), 'an') : pourCent(ecartEnPourCent(m.x, q.v))
      // D'où viennent les étoiles, en une ligne : la tablée y tenait (« je sais exactement d'où viennent mes étoiles »),
      // en cinq lignes, la révélation débordait d'un petit écran.
      const critere = (ok, dit) => `<span class="${ok ? 'oui' : 'non'}"><i aria-hidden="true">${ok ? '✓' : '✗'}</i><span class="sr">${ok ? 'oui' : 'non'}, </span>${fines(dit)}</span>`
      juge = `<p class="juge">${critere(bonne, q.an ? 'la bonne époque' : 'le bon ordre de grandeur')}${critere(nat >= 2, q.an ? `à ${m.ep.anneaux[1]} ans près` : 'à 25 % près')}${critere(nat >= 3, q.an ? `à ${accorde(m.ep.anneaux[0], 'an')} près` : 'à 6 % près')}${m.payees ? `<span>${fines('tes aides :')} ${enMoins(m.payees)}</span>` : ''}</p>${!bonne && nat >= 2 ? `<p class="note">${fines(`La mauvaise ${q.an ? 'époque' : 'tranche'}, mais si près de la réponse que la distance compte d’abord.`)}</p>` : ''}`
    } else {
      // Les mots de la production : « Dans le filet » ou « À côté », puis le filet lancé et ce qu'il valait.
      titre = n > 0 ? 'Dans le filet' : m.fin.auto ? 'Le temps a filé' : 'À côté'
      const nom = `Le ${NOMS_DES_FILETS[m.taille].toLowerCase()} filet`
      const valait = ETOILES_DU_FILET[m.taille]
      juge = n > 0 ? `<p class="ligne-filet">${nom} ${etoiles(valait)}</p>` : `<p class="ligne-filet">${nom} (il valait ${accorde(valait, 'étoile')})</p>`
      const p = m.p, L = p.max - p.min
      const zone = m.zone ? `<span class="zone" style="left:${(100 * (m.zone.de - p.min) / L).toFixed(2)}%;width:${(100 * (m.zone.a - m.zone.de) / L).toFixed(2)}%"></span>` : ''
      piste = `<div class="piste piste-revelee" aria-hidden="true"><div class="rail">${zone}<span class="anneau anneau-2" style="${filetDAujourdhui(m)}"></span><span class="vrai" style="left:${(100 * (q.v - p.min) / L).toFixed(2)}%"></span></div></div>
        <div class="bornes"><span>${dire(q, p.min)}</span><span>${dire(q, p.max)}</span></div>`
    }
    const ecart = E.mode === 'v2' && m.choisie !== null ? ` · ${q.an ? `${accorde(Math.abs(m.x - q.v), 'an')} d’écart` : `${pourCent(ecartEnPourCent(m.x, q.v))} d’écart`}` : ''
    const vise = E.mode === 'v2' ? (m.choisie === null ? 'tu n’as pas lancé' : `tu visais ${dire(q, m.x)}${ecart}`) : `tu visais ${dire(q, m.x)}`
    // Le repère promis ne vient pas s'il donnait la réponse : « Il se posera » était une promesse que la frise ne
    // tenait pas (Huguette, Brasília 1960 absent d'une question dont la réponse était 1960).
    const gagne = m.repereGagne ? `<p class="gagne"><b>Nouveau repère :</b> ${fines(q.r)} (${q.v}). Il pourra revenir sur la frise de tes prochaines dates.</p>`
      : E.mode === 'v2' && q.an && m.nat >= 2 && m.aides.length && !memo.reperes.some(r => r.id === q.id) ? `<p class="note">${fines('Trouvée avec une aide : elle ne devient pas ton repère.')}</p>` : ''
    const coeur = m.fin.rate ? '<span class="perte">La manche te coûte un cœur.</span>' : n === 0 && m.nat > 0 ? `<span class="garde">${m.payees > 1 ? 'Tes aides ont pris tes étoiles' : 'Ton aide a pris ton étoile'} ; ton cœur reste.</span>` : ''
    app.innerHTML = `${tete()}${laQuestion(q)}
      <section class="verdict${m.fin.rate ? ' rate' : ''}"><h2 class="grand" tabindex="-1">${titre}</h2>${etoiles(n, 3, m.payees || 0)}${coeur}</section>
      <p class="reponse">${fines(`La réponse : ${dire(q, q.v)}`)}<span class="vise">${fines(vise)}</span></p>
      ${E.mode === 'v2' ? `<section class="etape">${frise(m, true)}</section>` : ''}
      ${piste}${juge}
      ${q.a ? `<p class="anecdote">${fines(q.a)}</p>` : ''}
      ${gagne}
      <button type="button" class="btn btn-or btn-plein" data-geste="suivante">${E.coeurs === 0 || E.i >= 2 ? 'Voir le bilan' : 'Manche suivante'}</button>
      ${coulisses(q)}`
    enHaut('.verdict .grand')
  }

  function afficherLeBilan() {
    const gagnees = E.resultats.reduce((s, r) => s + r.n, 0)
    const perdus = 4 - E.coeurs
    const tombe = E.coeurs === 0
    const aidesDe = r => (E.mode === 'v2' ? (r.aides.length ? ` · ${accorde(r.aides.length, 'aide')}` : '') : r.eclairer ? ' · Éclairer' : '')
    const lignes = E.resultats.map(r => `<li><span class="q">${fines(r.q.t)}</span><span class="r">${fines(`${dire(r.q, r.q.v)} · ${r.choisie === null && E.mode === 'v2' ? 'pas de lancer' : `toi : ${dire(r.q, r.x)}`}${aidesDe(r)}`)}</span>${etoiles(r.n, 3, r.nat - r.n)}</li>`).join('')
    const aidesPrises = E.resultats.flatMap(r => r.aides)
    const offertes = aidesPrises.filter(a => a.offerte).length
    const total = aidesPrises.length
    const resume = E.mode === 'v2'
      ? (!total ? ' · sans aide' : offertes === total ? ` · ${accorde(total, 'aide offerte', 'aides offertes')}` : offertes ? ` · ${accorde(total, 'aide')}, dont${INSECABLE}${offertes}${INSECABLE}offerte` : ` · ${accorde(total, 'aide payée', 'aides payées')}`)
      : E.resultats.some(r => r.eclairer) ? ' · Éclairer pris' : ''
    const nom = n => `l’acte ${ROMAINS[n]}`
    const suivant = E.acte < 3 ? `<button type="button" class="btn" data-geste="acte" data-acte="${E.acte + 1}">Passer à ${nom(E.acte + 1)}</button>` : ''
    const autre = E.mode === 'v2' ? 'Rejouer cet acte au Filet d’aujourd’hui' : 'Rejouer cet acte au nouveau Filet'
    app.innerHTML = `<section class="page bloc"><p class="label">${ACTES[E.acte].nom} · ${E.mode === 'v2' ? 'le nouveau Filet' : 'le Filet d’aujourd’hui'}</p>
      <h1 tabindex="-1">${tombe ? 'Ton dernier cœur est tombé' : 'Épreuve terminée'}</h1>
      <p><span aria-hidden="true">${etoiles(Math.min(3, Math.round(gagnees / 3)))}</span> <b>${accorde(gagnees, 'étoile')} sur 9</b> · ${perdus ? accorde(perdus, 'cœur perdu', 'cœurs perdus') : 'aucun cœur perdu'}${resume}</p>
      <ol class="recap">${lignes}</ol>
      <div class="actions">
        <button type="button" class="btn btn-or btn-plein" data-geste="rejouer">Rejouer ${nom(E.acte)}</button>
        <button type="button" class="btn" data-geste="autre">${autre}</button>
        ${suivant}
        <button type="button" class="btn" data-geste="accueil">Retour à l’accueil</button>
      </div></section>`
    enHaut('h1')
  }

  function afficherLAccueil() {
    clearInterval(minuteur)
    E = null; M = null
    const actes = [1, 2, 3].map(n => `<button type="button" class="acte-btn" data-choisir-acte="${n}" aria-pressed="${memo.acte === n}"><b>${ACTES[n].nom}</b><small>${balise(n === 1 ? 'verte' : n === 2 ? 'bleue' : 'rouge')} ${ACTES[n].dit}</small></button>`).join('')
    const reperes = memo.reperes.length ? `<p class="pied">Tes repères gagnés : ${memo.reperes.slice(-4).map(r => `${r.an} · ${fines(r.l)}`).join(' ; ')}${memo.reperes.length > 4 ? '…' : ''} <button type="button" class="lien" data-geste="oublier">Les oublier</button></p>` : ''
    const jouables = D.questions.filter(q => !q.calcul).length
    app.innerHTML = `<header class="accueil-tete"><p class="label">Le Cabinet de curiosités · maquette du 9 novembre 2026, après trois tours de tablée</p>
        <h1>Le nouveau Filet</h1>
        <p class="chapo">${fines('Aujourd’hui, au Cabinet, les joueurs réussissent 43 % des manches du Filet, moins qu’un joueur qui lancerait le grand filet au milieu sans lire la question (45 %). Voici ce qui change.')}</p></header>
      <ol class="promesses">
        <li><span class="n">1</span><span><b>D’abord l’époque, puis l’année.</b> Quatre époques (ou quatre ordres de grandeur) : trouver la bonne vaut déjà une étoile. Le savoir approximatif paie enfin.</span></li>
        <li><span class="n">2</span><span><b>Le filet se resserre tout seul.</b> Plus de taille à parier : plus tu es près, plus tu gagnes.</span></li>
        <li><span class="n">3</span><span><b>Des repères sur la frise, et deux aides.</b> Des dates connues — et celles que tu as déjà su placer. Une aide payée retire une étoile à la manche ; la carte Coup d’œil offre la première.</span></li>
        <li><span class="n">4</span><span><b>Des questions choisies pour l’acte.</b> L’acte I pose ce que la plupart savent, l’acte III ce que peu savent — et jamais un calcul ni une conversion.</span></li>
      </ol>
      <section class="bloc"><p class="label">L’acte</p><div class="actes" role="group" aria-label="L’acte">${actes}</div></section>
      <div class="modes">
        <button type="button" class="btn btn-or mode-btn" data-geste="jouer" data-mode="v2">Jouer le nouveau Filet<small>3 manches · 4 cœurs · une manche ratée coûte un cœur</small></button>
        <button type="button" class="btn mode-btn" data-geste="jouer" data-mode="actuel">Jouer le Filet d’aujourd’hui<small>les mêmes règles et les mêmes mots qu’en production, pour comparer</small></button>
      </div>
      <section class="reglages" aria-label="Réglages de la maquette">
        <label class="bascule"><span>La carte Coup d’œil en main<small>offre la première aide de l’épreuve (aujourd’hui : Éclairer)</small></span><input type="checkbox" id="r-coup" data-reglage="coupDOeil"${memo.coupDOeil ? ' checked' : ''}></label>
        <label class="bascule"><span>Le chrono de 45 secondes<small>comme en production ; sans, pour explorer</small></span><input type="checkbox" id="r-chrono" data-reglage="chrono"${memo.chrono ? ' checked' : ''}></label>
        <label class="bascule"><span>Les coulisses du moteur<small>ce qu’il sait de chaque question, sous la manche</small></span><input type="checkbox" id="r-coulisses" data-reglage="coulisses"${memo.coulisses ? ' checked' : ''}></label>
      </section>
      <nav class="liens" aria-label="Pour aller plus loin">
        <button type="button" class="lien" data-geste="tablee">Ce que la tablée a changé</button>
        <button type="button" class="lien" data-geste="chiffres">${fines(`Ce que disent les ${D.production.lancers} lancers de la production`)}</button>
        <button type="button" class="lien" data-geste="regles">Les règles du nouveau Filet, en entier</button>
      </nav>
      ${reperes}
      <p class="pied">${fines(`Une page hors de FiestApp : ${D.questions.length} vraies questions du Filet, celles que la production a posées du 1er au 8 novembre 2026, avec la note du moteur et un indice écrit pour chacune — ${jouables} au nouveau Filet, qui écarte ce qui se calcule.`)}</p>`
  }

  // Ce que la tablée du 9 novembre 2026 a trouvé, en deux tours, et ce que la maquette en a fait (la synthèse :
  // retours/2026-11-09/la-tablee-du-filet.md).
  const TABLEE = {
    // Les notes sur 5 — le plaisir, la clarté, la justice — du Filet d'aujourd'hui, puis du nouveau aux deux tours.
    joueurs: [
      { qui: 'Huguette, 72 ans, petit téléphone, texte agrandi', avant: [2, 3, 2], tour1: [4, 4, 3], tour2: [4, 4.5, 4], tour3: [4.5, 4.5, 4.5] },
      { qui: 'Théo, 16 ans, joue vite', avant: [3, 3, 3], tour1: [4, 4, 4], tour2: null, tour3: null },
      { qui: 'Claire, joue chaque soir, calcule tout', avant: [3, 4, 2], tour1: [4, 3, 4], tour2: [4, 4, 4], tour3: [4, 4.5, 4] },
      { qui: 'Samir, daltonien', avant: [3, 3, 2], tour1: [4, 4, 4], tour2: [4, 5, 4], tour3: null },
      { qui: 'Hugo, aveugle, au lecteur d’écran', avant: [2, 3, 2], tour1: null, tour2: [4, 4, 4], tour3: [4.5, 4.5, 4] },
    ],
    tour1: [
      ['La piste répond à chaque toucher, même pile au milieu', 'les quatre : le premier réflexe de qui ne sait pas, et rien ne se passait'],
      ['La piste d’un ordre de grandeur est régulière, en crans ronds', '625 ne se posait pas, « + » restait coincé à 1380 et à 62, le milieu de 300 à 1 000 tombait vers 550'],
      ['Chaque manche s’ouvre en haut', 'la question était cachée au-dessus, à chaque manche'],
      ['L’écart se dit comme il se juge, au dixième', '« Ton écart 6 % » sous « À 6 % près : non », « 24 % » sous « À 25 % près : non »'],
      ['Une aide payée retire une étoile, au lieu d’abaisser un plafond', 'à qui ne visait qu’une étoile, l’aide ne coûtait rien : une assurance gratuite pour ses cœurs'],
      ['Les indices passent un juge à l’aveugle', 'le carré de 25, la puissance de deux de Minecraft, « compte les semaines » : l’indice donnait la réponse'],
      ['Plus de calcul ni de conversion au nouveau Filet', 'l’acte I tournait au cours de maths : secondes dans une heure, millimètres dans un mètre'],
      ['Les repères descendent sur la piste, et leur époque ne dit plus rien de la réponse', 'viser « comme Notre-Dame » se faisait à tâtons ; aucun repère ne tombait dans l’époque de la réponse'],
      ['Des formes, et des mots, pas seulement des couleurs', '▼ la réponse, ▲ ton lancer, ○ un repère, ◆ le tien ; « la bonne » écrit dans l’époque'],
      ['Ce que couvre le filet se dit en nombres', '« à 25 % », il fallait le calculer de tête'],
      ['Une réponse pile sur une borne est des deux ordres de grandeur', '10 000 m² : « dans quelle case ? »'],
      ['Un repère se gagne sans aide', 'l’Atari « de l’indice » devenait un repère sans être un savoir'],
      ['Le Filet d’aujourd’hui de la maquette suit la production mot pour mot', '« Tout près » au filet moyen, des dixièmes de pièce, Éclairer sans un mot : la maquette les avait inventés'],
    ],
    tour2: [
      ['L’indice se lit entre l’époque et la piste', 'sous les aides, il passait derrière le bouton du bas au moment de viser'],
      ['Les indices tiennent dans la tranche du jeu', '85 sur 136 menaient à cheval sur deux époques : « dans les vingt ans qui suivent la Libération », pour 1946, a coûté un cœur à Samir'],
      ['Le filet barre l’étoile payée, et l’aide dit qu’elle ne coûte jamais le cœur', 'après une aide, l’écran montrait encore « ★★★ », et on ne l’apprenait qu’à la révélation'],
      ['« Lancer le filet » n’est plus collé en bas', 'il cachait la piste, le gros chiffre et l’indice sur un petit écran'],
      ['Des grands pas, une graduation à la fois, et des graduations chiffrées', 'au lecteur d’écran, de 198 à 100, il fallait 98 touchers de « − »'],
      ['Le curseur dit sa vraie valeur, le doigt lui donne le focus, le verdict et l’indice le reçoivent', 'le lecteur d’écran annonçait « 12 » pour 1937, et rien quand l’indice arrivait'],
      ['Une tranche s’écrit sans « à »', '« à 30 000 » sortait de l’écran sous un texte agrandi'],
      ['Un repère à soi au plus, et les repères d’avant s’effacent', 'ses deux repères chassaient toute date connue de la frise d’Huguette'],
    ],
    tour3: [
      ['Les repères se tirent sans regarder la réponse', 'tenus loin d’elle, ils disaient où elle n’était pas : « avec 1870 sur la piste, la réponse était forcément entre 1850 et 1863 »'],
      ['Les nombres des graduations s’effacent quand ils se chevauchent', '« 100150200250300 » sous un texte agrandi'],
      ['Plus rien n’est collé au bas de l’écran', '« Manche suivante » couvrait l’écart, les cases et l’anecdote'],
      ['Le barème des étapes barre l’étoile payée', 'il fallait encore faire la soustraction de tête'],
      ['« Deux époques de moins » dit ce qui reste, et « Quitter » demande d’abord', 'au lecteur d’écran, rien ne s’annonçait, et un Tab plus loin tombait sur « Quitter »'],
      ['À l’oreille : « une étoile en moins », la réponse dans la légende, un seul score au bilan', '« moins un, une étoile », « La réponse » sans la réponse, « 2 étoiles sur 3 » puis « 5 sur 9 »'],
    ],
    proprietaire: [
      ['Le curseur se pose au milieu de l’époque choisie, et le filet dit d’emblée ce qu’il couvre', '« lorsque l’on choisit une époque, ça n’affiche pas la fourchette pour l’estimation ; elle devrait se placer directement au milieu ». Le milieu ne rapporte rien de plus que le toucher au milieu, premier geste de qui ne sait pas'],
      ['L’écran s’épure : une ligne par étape, ni barème, ni bornes, ni nombres sous la piste, et la révélation dit d’où viennent les étoiles en une ligne', '« un peu brouillon »'],
      ['L’acte I pose ce que chaque Français sait placer, puis ce que le panel donne à 50 % et plus', '« le levier le plus fort, c’est d’avoir des questions que chacun connaisse, sachant que la population et la connaissance sont des personnes françaises » ; sur les vrais lancers, elles se placent à 2 % près sept fois plus souvent que les autres, et se réussissent à 84 % en deux temps — trop haut pour un acte I : complétées du panel, 76 %, et trois fois plus de questions'],
    ],
    ouvert: [
      'Le milieu de la bonne époque tombe à ★★ une fois sur deux : « ★ pour la bonne époque vaut plutôt une étoile et demie » (Claire). C’est la largeur de l’anneau ★★, qui paie aussi l’à-peu-près : un choix de produit.',
      'Une étoile à moins d’une demi-tranche, même dans l’époque voisine, a été rejouée sur les lancers réels, puis écartée : 83 % de manches réussies sur les questions connues, trop généreux.',
      'Deux gestes au lieu d’un, et un indice à lire : 45 secondes suffisent à Claire, pas à Huguette ni à Hugo. À mesurer en production avant d’y toucher.',
      'Le pari du filet manque à Claire : « il n’y a toujours rien à parier ». Le frisson reste celui de la carte Miser (Quitte ou double).',
    ],
  }
  function afficherLaTablee() {
    clearInterval(minuteur)
    const t = TABLEE
    const notes = n => (n ? n.map(x => nombre(x)).join(' · ') : '—')
    const liste = l => `<ol class="changes">${l.map(([quoi, pourquoi]) => `<li><b>${fines(quoi)}.</b> <span>${fines(pourquoi)}.</span></li>`).join('')}</ol>`
    app.innerHTML = `<section class="page bloc">
      <button type="button" class="lien retour" data-geste="accueil">← L’accueil</button>
      <p class="label">La tablée du 9 novembre 2026</p>
      <h1>Ce que la tablée a changé</h1>
      <p>${fines('Quatre joueurs ont joué la première version contre le Filet d’aujourd’hui, sur de vraies questions de la production, au téléphone ; trois ont rejoué chaque version corrigée, et un joueur aveugle l’a jouée deux fois au lecteur d’écran. Tous préfèrent le nouveau Filet. Leurs notes sur 5 : le plaisir, la clarté, la justice.')}</p>
      <div class="tableau"><table><thead><tr><th>Joueur</th><th>Aujourd’hui</th><th>Nouveau : 1er tour</th><th>2e tour</th><th>3e tour</th></tr></thead><tbody>
        ${t.joueurs.map(j => `<tr><td>${fines(j.qui)}</td><td>${notes(j.avant)}</td><td>${notes(j.tour1)}</td><td>${notes(j.tour2)}</td><td>${notes(j.tour3)}</td></tr>`).join('')}
      </tbody></table></div>
      <h2>Ce que le premier tour a changé</h2>
      ${liste(t.tour1)}
      <h2>Ce que le second tour a changé</h2>
      <p>${fines('« Nettement meilleure », disent les trois qui l’ont rejouée : ce qui les gênait est réglé, un par un. Leurs scores baissent, et c’est voulu : « les aides ne sont plus des étoiles gratuites » (Claire).')}</p>
      ${liste(t.tour2)}
      <h2>Ce que le troisième tour a changé</h2>
      <p>${fines('Les notes montent encore, jusqu’à 4,5 sur 5 ; au lecteur d’écran, Hugo vise « en trois gestes au plus ».')}</p>
      ${liste(t.tour3)}
      <h2>Ce que le propriétaire a changé, au matin</h2>
      <p>${fines('Il a joué la version du troisième tour : « le Filet en deux temps ne me dérange pas en soi, mais là je trouve que c’est un peu brouillon ».')}</p>
      ${liste(t.proprietaire)}
      <h2>Ce qui reste ouvert</h2>
      <ul>${t.ouvert.map(o => `<li>${fines(o)}</li>`).join('')}</ul>
    </section>`
  }

  function afficherLesChiffres() {
    clearInterval(minuteur)
    const P = D.production
    const lignes = P.regles.map(r => `<tr${r.fort ? ' class="fort"' : ''}><td>${fines(r.nom)}</td><td>${r.reussies} %</td><td>${nombre(r.etoiles)}</td><td>${r.aveugle} %</td><td>${r.savoir > 0 ? '+' : ''}${r.savoir}</td></tr>`).join('')
    app.innerHTML = `<section class="page bloc">
      <button type="button" class="lien retour" data-geste="accueil">← L’accueil</button>
      <p class="label">La production, du 1er au 8 novembre 2026</p>
      <h1>${fines(`Ce que disent les ${P.lancers} lancers`)}</h1>
      <p>${fines(`${P.lancers} lancers réels du Filet, ${P.joueurs} joueurs, rejugés sous chaque règle : le curseur posé dit ce que le joueur croyait, la règle dit ce que ça vaut. « Au hasard » : un joueur qui ne lit pas la question.`)}</p>
      <figure class="graphe" aria-label="Manches réussies et part attrapée au hasard, règle par règle">
        <div class="graphe-legende"><span><i class="cle-barre"></i>Manches réussies</span><span><i class="cle-trait"></i>Au hasard, sans lire la question</span></div>
        <div class="graphe-lignes">${P.regles.map(r => `<div class="graphe-ligne${r.fort ? ' fort' : ''}" tabindex="0" title="${echapper(r.nom)} : ${r.reussies} % de manches réussies, ${r.aveugle} % au hasard">
          <span class="graphe-nom">${fines(r.nom)}</span>
          <div class="graphe-piste"><span class="graphe-barre" style="width:${r.reussies}%"></span><span class="graphe-hasard" style="left:${r.aveugle}%"></span></div>
          <span class="graphe-val">${r.reussies}${FINE}%</span></div>`).join('')}</div>
        <div class="graphe-axe" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100${FINE}%</span></div>
      </figure>
      <div class="tableau"><table><thead><tr><th>Règle</th><th>Réussies</th><th>★ / manche</th><th>Au hasard</th><th>Le savoir (pts)</th></tr></thead><tbody>${lignes}</tbody></table></div>
      <h2>Pourquoi le Filet d’aujourd’hui se joue au hasard</h2>
      <ul>${P.pourquoi.map(p => `<li>${fines(p)}</li>`).join('')}</ul>
      <h2>Le moteur de difficulté</h2>
      <ul>${P.moteur.map(p => `<li>${fines(p)}</li>`).join('')}</ul>
      <h2>Ce qui se fait ailleurs</h2>
      <ul>${P.ailleurs.map(p => `<li>${fines(p)}</li>`).join('')}</ul>
      <p class="pied">${fines('Une borne basse : rejugés, les curseurs ont été posés sous l’ancienne règle. Dans le vrai jeu en deux temps, on choisit l’époque parmi quatre boutons, où l’on reconnaît mieux qu’on ne place.')}</p>
    </section>`
  }

  function afficherLesRegles() {
    clearInterval(minuteur)
    app.innerHTML = typo(`<section class="page bloc">
      <button type="button" class="lien retour" data-geste="accueil">← L’accueil</button>
      <p class="label">Les règles</p>
      <h1>Le nouveau Filet</h1>
      <h2>Une manche, deux gestes</h2>
      <ul>
        <li><b>L’époque.</b> Quatre époques côte à côte : de 25 ans depuis 1800, de 50 ans de 1500 à 1799, d’un siècle avant. Pour une grandeur, quatre ordres de grandeur : de 1 000 à 3 000, de 3 000 à 10 000, de 10 000 à 30 000… Une réponse pile sur une borne est des deux.</li>
        <li><b>L’année.</b> La piste s’ouvre sur l’époque choisie, régulière, le curseur posé en son milieu : un toucher le porte là où l’on vise, puis − et + l’ajustent d’un cran. On peut encore changer d’époque.</li>
        <li><b>Le filet se resserre tout seul</b> autour du curseur : ★★★ à un douzième de l’époque (2 ans sur 25), ★★ à un quart (6 ans), ★ pour la bonne époque. Une grandeur : ★★★ à 6 % de la réponse, ★★ à 25 %, ★ pour le bon ordre de grandeur. Sous la valeur, le filet se dit en nombres : « ★★★ 1960–1964 ».</li>
        <li><b>La distance compte d’abord.</b> Au bord d’une époque, à 2 ans près de la réponse, c’est ★★★ même dans l’époque d’à côté.</li>
        <li><b>Ratée</b>, à zéro étoile, la manche coûte un cœur, comme aujourd’hui.</li>
      </ul>
      <h2>Les repères</h2>
      <ul><li>Deux dates connues au plus se posent sur la frise, et descendent sur la piste quand leur époque s’ouvre. Leur époque se tire d’abord, chacune la même chance, puis un repère de cette époque, sans regarder la réponse : jamais du même sujet, jamais la réponse elle-même.</li>
        <li>Une année placée à ★★ sans aide devient <b>ton repère</b> : elle revient sur la frise de tes prochaines dates, avant les autres.</li></ul>
      <h2>Les aides</h2>
      <ul><li><b>Deux époques de moins</b> retire deux mauvaises époques. <b>Un indice</b> donne une phrase pour s’orienter, jamais la valeur : chaque indice est relu par quelqu’un qui ne connaît pas le sujet, et celui qui mène à la réponse se réécrit.</li>
        <li>Chacune, une fois par manche. Payée, elle retire une étoile à ce que la manche rapporte : ★★ moins une, ★. Ratée, la manche coûte un cœur comme toujours ; réussie, elle garde ton cœur, même si l’aide a pris sa seule étoile. La carte Coup d’œil offre la première aide de chaque épreuve.</li></ul>
      <h2>Les questions</h2>
      <ul><li>L’acte I pose ce que chaque Français sait placer : ce qu’on apprend à l’école, ce qu’on voit tous les jours, ce qu’on a entendu partout. Les joueurs sont français, leur savoir aussi.</li>
        <li>Chaque question porte aussi une note : la part des joueurs qui placeraient sa valeur à 5 % près. Celles qu’au moins la moitié connaissent rejoignent l’acte I ; l’acte II pose celles qu’au moins 25 % connaissent, l’acte III le reste.</li>
        <li>Elle part d’une première estimation, que la production corrige ensuite à chaque lancer.</li>
        <li>Une question qui se calcule ou se convertit (le carré de 25, les secondes d’une heure) n’est pas une estimation : le nouveau Filet ne la pose pas.</li></ul>
    </section>`)
  }

  function afficher(ecran) {
    if (ecran === 'chiffres') afficherLesChiffres()
    else if (ecran === 'regles') afficherLesRegles()
    else if (ecran === 'tablee') afficherLaTablee()
    else afficherLAccueil()
    window.scrollTo(0, 0)
  }

  // ── Les gestes ─────────────────────────────────────────────────────────
  app.addEventListener('click', ev => {
    const b = ev.target.closest('button, summary')
    if (!b) return
    if (b.tagName === 'SUMMARY') { memo.coulissesOuvertes = !b.parentElement.open; retenir(); return }
    if (b.getAttribute('aria-disabled') === 'true') return
    const d = b.dataset
    if (d.choisirActe) { memo.acte = Number(d.choisirActe); retenir(); return afficherLAccueil() }
    if (d.epoque !== undefined) return choisirLEpoque(Number(d.epoque))
    if (d.cran) return unCran(Number(d.cran))
    if (d.grand) return unCran(Number(d.grand), true)
    if (d.taille) { M.taille = d.taille; return afficherLaManche() }
    if (d.aide) return prendreUneAide(d.aide)
    switch (d.geste) {
      case 'jouer': return commencer(d.mode, memo.acte)
      case 'lancer': return lancer(false)
      case 'suivante': return suivante()
      case 'rejouer': return commencer(E.mode, E.acte)
      case 'autre': return commencer(E.mode === 'v2' ? 'actuel' : 'v2', E.acte)
      case 'acte': return commencer(E.mode, Number(d.acte))
      case 'accueil': return afficher('accueil')
      case 'quitter': {
        // Comme en production : « Quitter » demande, « Quitter l'épreuve » quitte, « Continuer » revient au jeu.
        if (document.getElementById('confirmer')) return
        app.querySelector('.tete')?.insertAdjacentHTML('afterend', `<div class="confirmer" id="confirmer" role="alertdialog" aria-labelledby="confirmer-titre"><p id="confirmer-titre"><b>Quitter l’épreuve ?</b> ${E && E.resultats.length < 3 ? 'Ce qui est joué reste joué.' : ''}</p><div><button type="button" class="btn" data-geste="accueil">Quitter l’épreuve</button><button type="button" class="btn btn-or" data-geste="continuer">Continuer</button></div></div>`)
        return document.querySelector('[data-geste="continuer"]')?.focus()
      }
      case 'continuer': document.getElementById('confirmer')?.remove(); return app.querySelector('.quitter')?.focus()
      case 'chiffres': return afficher('chiffres')
      case 'regles': return afficher('regles')
      case 'tablee': return afficher('tablee')
      case 'oublier': memo.reperes = []; retenir(); return afficherLAccueil()
      case 'eclairer': {
        if (!M || E.eclairerUtilise) return
        E.eclairerUtilise = true
        // La règle de la production : une zone de trente pour cent de la piste, la réponse n'importe où dedans.
        const L = M.p.max - M.p.min, largeur = 0.3 * L
        const de = Math.min(Math.max(M.q.v - Math.random() * largeur, M.p.min), M.p.max - largeur)
        M.zone = { de, a: de + largeur }
        afficherLaManche()
        // Ce qu'Éclairer a donné prend le focus : son bouton disparaissait sous le doigt, et rien ne se disait (Hugo).
        const dit = document.getElementById('souffle')
        dit?.focus({ preventScroll: true })
        dit?.scrollIntoView({ block: 'nearest' })
        return
      }
    }
  })
  app.addEventListener('input', ev => {
    if (ev.target.id !== 'curseur' || !M) return
    const v = Number(ev.target.value)
    bouger(E.mode === 'v2' ? indexDe(M.grille, v) : Math.round((v - M.p.min) / M.p.pas))
  })
  // Le doigt pose le curseur là où il touche la piste. Sur l'iPhone, un curseur ne se déplace qu'en saisissant sa
  // poignée — et tant que le curseur n'est pas posé, sa poignée est cachée ; et pile au milieu, là où la piste vierge
  // gardait sa valeur, le navigateur ne disait rien : sans ceci, le toucher du milieu ne posait rien (les quatre).
  app.addEventListener('pointerdown', ev => {
    const r = ev.target
    if (r.id !== 'curseur' || !M || M.fin) return
    // La poignée va de la moitié de sa largeur (5 px) à l'autre bord, comme le rail (`index.html`, `.rail`).
    const boite = r.getBoundingClientRect()
    const part = Math.max(0, Math.min(1, (ev.clientX - boite.left - 5) / (boite.width - 10)))
    const crans = E.mode === 'v2' ? M.grille?.n : Math.round((M.p.max - M.p.min) / M.p.pas)
    if (crans === undefined) return
    bouger(Math.round(part * crans))
    // Le doigt donne le focus au curseur : les flèches, et le lecteur d'écran, le suivent (Hugo n'y arrivait qu'après Tab).
    r.focus({ preventScroll: true })
  })
  app.addEventListener('change', ev => {
    const r = ev.target.dataset?.reglage
    if (r) { memo[r] = ev.target.checked; retenir() }
  })
  document.addEventListener('keydown', ev => {
    if (!M || M.fin || ev.target.tagName === 'INPUT' && ev.target.type === 'checkbox') return
    if (ev.key === 'Enter' && ev.target.id === 'curseur') { ev.preventDefault(); lancer(false) }
  })

  afficher('accueil')
})()

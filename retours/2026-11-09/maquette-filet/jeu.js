// La maquette jouable du nouveau Filet (retours/2026-11-09/le-nouveau-filet.md) : une épreuve de trois manches,
// au nouveau Filet ou au Filet d'aujourd'hui, sur de vraies questions que la production a posées. Tout se joue dans
// la page : rien ici n'est servi par FiestApp, et ce que le téléphone retient (les repères gagnés, les questions
// vues, les réglages) vit dans le localStorage, sous try/catch.
;(() => {
  'use strict'
  const D = window.FILET
  const ANNEE = 2026
  const app = document.getElementById('app')

  // ── Ce que le téléphone retient ────────────────────────────────────────
  const CLE = 'filet-maquette-v1'
  function relire() {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}') } catch { return {} }
  }
  function retenir() {
    try { localStorage.setItem(CLE, JSON.stringify(memo)) } catch { /* sans stockage, la maquette oublie : rien de grave */ }
  }
  const memo = Object.assign({ reperes: [], vues: [], coupDOeil: true, chrono: true, coulisses: true, acte: 1 }, relire())

  // ── Les nombres, comme FiestApp les écrit ──────────────────────────────
  const FINE = ' '
  const grouper = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, FINE)
  function nombre(n) {
    if (!Number.isFinite(n)) return '—'
    const entier = Math.abs(n - Math.round(n)) < 1e-9
    if (entier) return Math.abs(n) >= 10000 ? grouper(n) : String(Math.round(n))
    return String(Math.round(n * 100) / 100).replace('.', ',')
  }
  /** Trois chiffres qui comptent au-delà de cent, l'entier en dessous : ce que le curseur d'une grandeur affiche. */
  function lisible(x) {
    if (x >= 1000) { const p = Math.pow(10, Math.floor(Math.log10(x)) - 2); return Math.round(x / p) * p }
    if (x >= 10) return Math.round(x)
    return Math.round(x * 10) / 10
  }
  const echapper = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  // Les espaces fines devant ? ! ; : et dans « », comme `espacesFines` de FiestApp — qui colle aussi l'inversion
  // (« parle-t-on ») par un gluon : coupée au trait d'union, la question se lisait « parle-t- / on ».
  const fines = s => echapper(s).replace(/ ([?!;:»])/g, ' $1').replace(/« /g, '« ').replace(/-(?=\p{Ll})/gu, '-⁠')
  const dire = (q, x) => (q.an ? String(Math.round(x)) : nombre(lisible(x)) + (q.u ? ` ${q.u}` : ''))
  const melanger = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
  const auHasard = a => a[Math.floor(Math.random() * a.length)]
  const entre = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
  const etoiles = (n, max = 3) => `<span class="etoiles" aria-label="${n} étoile${n > 1 ? 's' : ''} sur ${max}">${'★'.repeat(n)}<span class="vide">${'☆'.repeat(Math.max(0, max - n))}</span></span>`
  function balise(couleur) {
    const forme = couleur === 'verte' ? '<circle cx="8" cy="8" r="6"/>' : couleur === 'bleue' ? '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/>' : couleur === 'rouge' ? '<path d="M8 2 14.5 13.5h-13Z"/>' : '<path d="M8 1.5 14.5 8 8 14.5 1.5 8Z"/>'
    return `<svg class="balise balise-${couleur}" viewBox="0 0 16 16" aria-hidden="true">${forme}</svg>`
  }

  // ── Le moteur de difficulté ────────────────────────────────────────────
  // La connaissabilité d'une question au Filet : la part des joueurs qui placeraient sa valeur à 5 % près, selon le
  // panel de l'IA — validé sur les 163 vrais lancers (AUC 0,85 pour « il savait », 0,78 pour la difficulté écrite).
  // En production, elle se recale ensuite sur les lancers de chaque question (le cahier des charges, « Le moteur »).
  const piste = p => (p >= 50 ? 'verte' : p >= 30 ? 'bleue' : p >= 15 ? 'rouge' : 'noire')
  const NOM_DE_PISTE = { verte: 'piste verte', bleue: 'piste bleue', rouge: 'piste rouge', noire: 'piste noire' }
  const ACTES = {
    1: { nom: 'Acte I', de: 40, a: 101, dit: 'Connu', vise: '3 manches sur 4 réussies' },
    2: { nom: 'Acte II', de: 25, a: 40, dit: 'Pointu', vise: '2 sur 3' },
    3: { nom: 'Acte III', de: 0, a: 25, dit: 'Pour initiés', vise: '1 sur 2' },
  }
  function tirer(mode, acte) {
    const vues = new Set(memo.vues)
    // Aujourd'hui, le tirage lit la marche écrite ; le moteur, la connaissabilité au Filet.
    const tas = mode === 'v2'
      ? D.questions.filter(q => q.ia >= ACTES[acte].de && q.ia < ACTES[acte].a)
      : D.questions.filter(q => (acte === 3 ? q.d >= 3 : q.d <= 3))
    const neuves = tas.filter(q => !vues.has(q.id))
    const source = neuves.length >= 3 ? neuves : tas
    // Une année au moins dans l'épreuve quand le tas en a : le nouveau Filet a deux visages.
    const annees = melanger(source.filter(q => q.an)), grandeurs = melanger(source.filter(q => !q.an))
    const prises = annees.length ? [annees[0], ...grandeurs.slice(0, 2)] : grandeurs.slice(0, 3)
    while (prises.length < 3 && annees.length > prises.filter(q => q.an).length) prises.push(annees[prises.filter(q => q.an).length])
    return melanger(prises.slice(0, 3))
  }

  // ── Le nouveau Filet : quatre époques, puis la valeur ──────────────────
  // Une année : des époques de 25 ans depuis 1800, de 50 de 1500 à 1799, d'un siècle avant — on date plus
  // grossièrement ce qui est loin. Les anneaux suivent l'époque : ★★★ à un douzième, ★★ à un quart de sa largeur.
  // Une grandeur : quatre ordres de grandeur bornés par 1, 3, 10, 30, 100… (de 1 000 à 3 000, de 3 000 à 10 000…),
  // ★★★ à 6 %, ★★ à 25 %. Centrées sur des nombres ronds (≈ 100), le milieu d'une tranche était la réponse de
  // toutes les questions qui en ont une ronde : cent anneaux, mille grammes.
  const RAPPORT_3 = Math.log(1.06), RAPPORT_2 = Math.log(1.25)
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
        an: true, T, bonne: i,
        tranches: [0, 1, 2, 3].map(k => ({ de: debut + k * T, a: debut + (k + 1) * T - 1 })),
        anneaux: [Math.max(1, Math.round(T / 12)), Math.round(T / 4)],
      }
    }
    // La tranche de la valeur : la plus haute borne de la suite 1, 3, 10, 30… qui ne la dépasse pas.
    let k = 0
    while (borneDuDemi(k + 1) <= q.v) k++
    const places = [0, 1, 2, 3].filter(i => k - i >= 0)
    const i = auHasard(places)
    return {
      an: false, bonne: i,
      tranches: [0, 1, 2, 3].map(j => { const kk = k - i + j; return { k: kk, de: borneDuDemi(kk), a: borneDuDemi(kk + 1) } }),
    }
  }
  const PAS_D_UNE_GRANDEUR = 240
  function valeurDuCurseur(m, pos) {
    const t = m.ep.tranches[m.choisie]
    if (m.ep.an) return Math.round(t.de + pos)
    return lisible(t.de * Math.pow(t.a / t.de, pos / PAS_D_UNE_GRANDEUR))
  }
  const MILIEU = m => (m.ep.an ? Math.floor(m.ep.T / 2) : PAS_D_UNE_GRANDEUR / 2)
  function positionDe(m, x) {
    if (x === null) return MILIEU(m)
    const t = m.ep.tranches[m.choisie]
    if (m.ep.an) return Math.round(x - t.de)
    return Math.round((PAS_D_UNE_GRANDEUR * Math.log(x / t.de)) / Math.log(t.a / t.de))
  }
  function etoilesDuNouveau(m, x) {
    const q = m.q
    if (x === null) return m.choisie === m.ep.bonne ? 1 : 0
    if (q.an) {
      const e = Math.abs(x - q.v)
      if (e <= m.ep.anneaux[0]) return 3
      if (e <= m.ep.anneaux[1]) return 2
    } else {
      const r = Math.abs(Math.log(x / q.v))
      if (r <= RAPPORT_3) return 3
      if (r <= RAPPORT_2) return 2
    }
    return m.choisie === m.ep.bonne ? 1 : 0
  }
  /** Les repères de la frise : les siens d'abord (ce qu'il a déjà su dater), puis des dates que tout le monde connaît. */
  function reperesDe(q, ep) {
    if (!ep.an) {
      const t0 = ep.tranches[0], t3 = ep.tranches[3]
      const u = (q.u || '').toLowerCase()
      return D.reperesGrandeurs
        .filter(r => r.u === u && r.v >= t0.de && r.v < t3.a && Math.abs(Math.log(r.v / q.v)) > Math.log(1.3))
        .slice(0, 2).map(r => ({ x: r.v, l: r.l, perso: false }))
    }
    const de = ep.tranches[0].de, a = ep.tranches[3].a
    const mots = new Set(q.t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(m => m.length >= 5))
    const souffle = l => l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).some(m => m.length >= 5 && mots.has(m))
    const loin = an => Math.abs(an - q.v) > ep.anneaux[1]
    const siens = memo.reperes.filter(r => r.id !== q.id && r.an >= de && r.an <= a && loin(r.an) && !souffle(r.l)).map(r => ({ x: r.an, l: r.l, perso: true }))
    const communs = melanger(D.reperesAnnees.filter(r => r.an >= de && r.an <= a && loin(r.an) && !souffle(r.l))).map(r => ({ x: r.an, l: r.l, perso: false }))
    const pris = []
    for (const r of [...siens, ...communs]) if (pris.length < 2 && !pris.some(p => Math.abs(p.x - r.x) < (ep.T / 5))) pris.push(r)
    return pris.sort((a, b) => a.x - b.x)
  }
  /** Où se pose une valeur sur la frise des quatre époques, en pour cent. */
  function surLaFrise(ep, x) {
    const t0 = ep.tranches[0], t3 = ep.tranches[3]
    if (ep.an) return Math.max(0, Math.min(100, (100 * (x - t0.de + 0.5)) / (t3.a + 1 - t0.de)))
    return Math.max(0, Math.min(100, (100 * Math.log(x / t0.de)) / Math.log(t3.a / t0.de)))
  }

  // ── Le Filet d'aujourd'hui, tel que la production le joue ──────────────
  const DEMI = { petit: 0.035, moyen: 0.09, grand: 0.2 }
  const ETOILES_DU_FILET = { petit: 3, moyen: 2, grand: 1 }
  function borneRonde(m) { const p = Math.pow(10, Math.floor(Math.log10(m)) - 1); return Math.ceil(m / p) * p }
  function pasRond(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p }
  function pisteDAujourdhui(q) {
    if (q.an) {
      const L = entre(50, 119)
      const min = q.v - entre(Math.ceil(L * 0.08), Math.floor(L * 0.92))
      return { min, max: Math.min(min + L, ANNEE), pas: 1 }
    }
    const max = borneRonde(q.v / (0.08 + Math.random() * 0.84))
    return { min: 0, max, pas: pasRond(max / 200) }
  }

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
      M = { q, ep, choisie: null, x: null, retirees: [], aides: [], reperes: reperesDe(q, ep), debut: Date.now(), fin: null }
    } else {
      const p = pisteDAujourdhui(q)
      const milieu = p.min + Math.round((p.max - p.min) / 2 / p.pas) * p.pas
      M = { q, p, x: milieu, taille: 'moyen', zone: null, debut: Date.now(), fin: null }
    }
    afficherLaManche()
    lancerLeMinuteur()
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

  // Les aides du nouveau Filet coûtent chacune une étoile au plus haut de la manche ; la carte Coup d'œil offre la
  // première de l'épreuve. Deux au plus : la manche vaut encore une étoile.
  const AIDES = {
    deux: { nom: q => (q.an ? 'Deux époques de moins' : 'Deux ordres de moins'), dit: 'Retire deux mauvaises' },
    indice: { nom: () => 'Un indice', dit: 'Une phrase pour s’orienter' },
  }
  const plafondDe = m => 3 - m.aides.filter(a => !a.offerte).length
  function prendreUneAide(cle) {
    if (!M || M.fin || M.aides.some(a => a.cle === cle)) return
    const offerte = memo.coupDOeil && !E.offerteUtilisee
    if (offerte) E.offerteUtilisee = true
    M.aides.push({ cle, offerte })
    if (cle === 'deux') {
      const mauvaises = melanger([0, 1, 2, 3].filter(i => i !== M.ep.bonne)).slice(0, 2)
      M.retirees = mauvaises
      if (M.choisie !== null && mauvaises.includes(M.choisie)) { M.choisie = null; M.x = null }
    }
    afficherLaManche()
  }
  function choisirLEpoque(i) {
    if (!M || M.fin || M.retirees.includes(i) || M.choisie === i) return
    M.choisie = i
    // Le curseur ne part de nulle part : on le pose d'un toucher. Posé d'office au milieu, il donnait des étoiles à qui
    // ne bougeait pas — et le milieu d'une tranche tombait sur les réponses rondes. Il garde la valeur qu'il visait
    // si elle tient dans l'époque choisie.
    const t = M.ep.tranches[i]
    if (M.x !== null && (M.x < t.de || M.x > t.a)) M.x = null
    afficherLaManche()
  }
  function bouger(pos) {
    if (!M || M.fin) return
    if (E.mode === 'v2') {
      if (M.choisie === null) return
      const max = M.ep.an ? M.ep.T - 1 : PAS_D_UNE_GRANDEUR
      const premier = M.x === null
      M.x = valeurDuCurseur(M, Math.max(0, Math.min(max, pos)))
      if (premier) { afficherLaManche(); document.getElementById('curseur')?.focus({ preventScroll: true }); return }
    } else {
      M.x = Math.max(M.p.min, Math.min(M.p.max, Number((M.p.min + pos * M.p.pas).toFixed(6))))
    }
    rafraichirLeCurseur()
  }
  function unCran(sens, grand = false) {
    if (!M || M.fin) return
    if (E.mode === 'v2') {
      if (M.choisie === null) return
      bouger(M.x === null ? MILIEU(M) : positionDe(M, M.x) + sens * (grand ? 5 : 1))
    } else {
      const pas = grand ? Math.max(1, Math.round((M.p.max - M.p.min) / M.p.pas / 10)) : 1
      bouger(Math.round((M.x - M.p.min) / M.p.pas) + sens * pas)
    }
  }
  function lancer(auto = false) {
    if (!M || M.fin) return
    clearInterval(minuteur)
    let n
    if (E.mode === 'v2') {
      // Le temps écoulé lance ce qui est posé : l'époque seule vaut son étoile, le curseur s'il est posé.
      if (!auto && (M.choisie === null || M.x === null)) return
      M.etoilesNaturelles = M.choisie === null ? 0 : etoilesDuNouveau(M, M.x)
      n = Math.min(plafondDe(M), M.etoilesNaturelles)
    } else {
      n = Math.abs(M.x - M.q.v) <= DEMI[M.taille] * (M.p.max - M.p.min) + 1e-9 ? ETOILES_DU_FILET[M.taille] : 0
    }
    M.fin = { n, auto, le: Date.now() }
    if (n === 0) E.coeurs = Math.max(0, E.coeurs - 1)
    // Un repère gagné : une année placée à deux étoiles au moins revient sur la frise des prochaines dates.
    if (E.mode === 'v2' && M.q.an && M.etoilesNaturelles >= 2 && !memo.reperes.some(r => r.id === M.q.id)) {
      memo.reperes.push({ id: M.q.id, an: M.q.v, l: M.q.r || M.q.t.slice(0, 40) })
      M.repereGagne = true
    }
    memo.vues = [...new Set([...memo.vues, M.q.id])].slice(-300)
    retenir()
    E.resultats.push({ q: M.q, n, x: M.x, choisie: M.choisie, bonne: M.ep?.bonne, aides: M.aides?.length ?? 0, taille: M.taille, auto })
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
      <div class="tete-d"><span class="coeurs" role="img" aria-label="${E.coeurs} cœur${E.coeurs > 1 ? 's' : ''} sur 4">${coeurs}</span>
      <button type="button" class="quitter" data-geste="accueil">Quitter</button></div>
    </header>`
  }
  function chrono() {
    if (!memo.chrono) return ''
    const reste = M.fin ? 0 : Math.max(0, DUREE - (Date.now() - M.debut))
    return `<div class="chrono" aria-hidden="true"><span style="transform:scaleX(${reste / DUREE})"></span></div>`
  }
  function laQuestion(q) {
    const mode = E.mode === 'v2' ? 'Le nouveau Filet' : 'Le Filet d’aujourd’hui'
    return `<div class="question-bloc"><p class="label ligne-du-mode"><span>${echapper(q.c)}</span><span>${mode}</span></p><h2 class="question${q.t.length > 110 ? ' longue' : ''}">${fines(q.t)}</h2></div>`
  }
  function coulisses(q) {
    if (!memo.coulisses) return ''
    const c = piste(q.ia)
    const pour = E.mode === 'v2' ? `${ACTES[E.acte].nom} : de ${ACTES[E.acte].de} à ${Math.min(100, ACTES[E.acte].a - 1)} %` : `tirée comme aujourd’hui, sur sa marche écrite (${q.d} sur 5)`
    const regle = M.ep ? (M.ep.an ? `époques de ${M.ep.T} ans · ★★★ à ${M.ep.anneaux[0]} an${M.ep.anneaux[0] > 1 ? 's' : ''} · ★★ à ${M.ep.anneaux[1]} ans` : 'tranches de 1 à 3, de 3 à 10 (×3 ou ×3,3) · ★★★ à 6 % · ★★ à 25 %') : `piste de ${dire(q, M.p.min)} à ${dire(q, M.p.max)}`
    return `<details class="coulisses"${memo.coulissesOuvertes ? ' open' : ''}><summary>Les coulisses du moteur</summary><dl>
      <dt>Connaissabilité</dt><dd>${balise(c)} ${q.ia} % la placeraient à 5 % près · ${NOM_DE_PISTE[c]}</dd>
      <dt>En QCM</dt><dd>${q.qcm} % la trouveraient parmi quatre</dd>
      <dt>Difficulté écrite</dt><dd>${q.d} sur 5</dd>
      <dt>Choisie pour</dt><dd>${pour}</dd>
      <dt>La règle</dt><dd>${regle}</dd>
    </dl></details>`
  }
  function frise(m, revelee = false) {
    const ep = m.ep
    const marques = m.reperes.map(r => `<span class="marque${r.perso ? ' perso' : ''}" style="left:${surLaFrise(ep, r.x).toFixed(2)}%"></span>`).join('')
    const enPlus = revelee
      ? `<span class="marque reponse" style="left:${surLaFrise(ep, m.q.v).toFixed(2)}%" title="La réponse"></span>` +
        (m.choisie !== null && m.x !== null ? `<span class="marque lancer" style="left:${surLaFrise(ep, m.x).toFixed(2)}%" title="Ton lancer"></span>` : '')
      : ''
    const tranches = ep.tranches.map((t, i) => {
      const classes = ['tranche', m.retirees.includes(i) ? 'retiree' : '', revelee && i === ep.bonne ? 'bonne' : '', revelee && i === m.choisie ? 'choisie' : ''].filter(Boolean).join(' ')
      const de = ep.an ? t.de : nombre(t.de), a = ep.an ? t.a : nombre(t.a)
      const texte = `<span class="de">${de}</span><span class="a">${ep.an ? '' : 'à '}${a}</span>`
      const dit = `De ${de} à ${a}`
      return `<button type="button" class="${classes}" data-epoque="${i}" aria-pressed="${m.choisie === i}" aria-label="${dit}${m.retirees.includes(i) ? ', retirée' : ''}"${revelee || m.retirees.includes(i) ? ' aria-disabled="true"' : ''}>${texte}</button>`
    }).join('')
    const legende = m.reperes.length
      ? `<ul class="legende">${m.reperes.map(r => `<li class="${r.perso ? 'perso' : ''}"><i></i>${ep.an ? r.x : dire(m.q, r.x)} · ${fines(r.l)}${r.perso ? ' (ton repère)' : ''}</li>`).join('')}</ul>`
      : ''
    const epingles = revelee ? `<ul class="epingles"><li><i></i>La réponse</li>${m.choisie !== null && m.x !== null ? '<li class="toi"><i></i>Ton lancer</li>' : ''}</ul>` : ''
    return `<div class="frise${revelee ? ' revelee' : m.reperes.length ? '' : ' sans-reperes'}"><div class="marques">${marques}${enPlus}</div>
      <div class="tranches" role="group" aria-label="${ep.an ? 'Quatre époques' : 'Quatre ordres de grandeur'}">${tranches}</div></div>${epingles}${legende}`
  }
  function anneauxHtml(m) {
    if (m.choisie === null || m.x === null) return ''
    const t = m.ep.tranches[m.choisie]
    const pc = x => (m.ep.an ? (100 * (x - t.de + 0.5)) / (t.a + 1 - t.de) : (100 * Math.log(x / t.de)) / Math.log(t.a / t.de))
    const bande = (classe, bas, haut) => { const g = Math.max(0, pc(bas)), d = Math.min(100, pc(haut)); return d > g ? `<span class="anneau ${classe}" style="left:${g.toFixed(2)}%;width:${(d - g).toFixed(2)}%"></span>` : '' }
    if (m.ep.an) return bande('anneau-2', m.x - m.ep.anneaux[1] - 0.5, m.x + m.ep.anneaux[1] + 0.5) + bande('anneau-3', m.x - m.ep.anneaux[0] - 0.5, m.x + m.ep.anneaux[0] + 0.5)
    return bande('anneau-2', m.x / 1.25, m.x * 1.25) + bande('anneau-3', m.x / 1.06, m.x * 1.06)
  }
  function etapeValeur(m) {
    if (m.choisie === null) return `<div class="attente">${m.q.an ? 'Choisis d’abord une époque : la frise s’ouvre sur elle.' : 'Choisis d’abord un ordre de grandeur : la piste s’ouvre sur lui.'}</div>`
    const t = m.ep.tranches[m.choisie]
    const max = m.ep.an ? m.ep.T - 1 : PAS_D_UNE_GRANDEUR
    const bornes = m.ep.an ? [t.de, t.a] : [nombre(t.de), nombre(t.a)]
    const vierge = m.x === null
    const valeur = vierge ? '<span class="a-poser">Touche la piste</span>' : `${m.q.an ? m.x : nombre(lisible(m.x))}${!m.q.an && m.q.u ? ` <small>${echapper(m.q.u)}</small>` : ''}`
    return `<div class="valeur-vise"><output class="valeur" id="valeur" for="curseur">${valeur}</output></div>
      <div class="curseur apparait${vierge ? ' vierge' : ''}">
        <button type="button" class="cran" data-cran="-1" aria-label="Un cran de moins">−</button>
        <div class="piste"><div class="rail" id="anneaux">${anneauxHtml(m)}</div>
          <input id="curseur" class="range" type="range" min="0" max="${max}" step="1" value="${positionDe(m, m.x)}" aria-label="${m.q.an ? 'L’année' : 'La valeur'}" aria-valuetext="${vierge ? 'pas encore posé' : m.q.an ? m.x : dire(m.q, m.x)}">
        </div>
        <button type="button" class="cran" data-cran="1" aria-label="Un cran de plus">+</button>
      </div>
      <div class="bornes"><span>${bornes[0]}</span><span>${bornes[1]}</span></div>`
  }
  function aides(m) {
    const offerte = memo.coupDOeil && !E.offerteUtilisee
    const boutons = Object.entries(AIDES).map(([cle, a]) => {
      const prise = m.aides.find(x => x.cle === cle)
      const cout = prise ? (prise.offerte ? 'Prise · offerte' : 'Prise · −1 ★') : offerte ? 'Gratuite' : 'Coûte une étoile'
      return `<button type="button" class="aide${!prise && offerte ? ' offerte' : ''}" data-aide="${cle}"${prise ? ' aria-disabled="true"' : ''}><b>${a.nom(m.q)}</b><small>${cout}</small></button>`
    }).join('')
    const indice = m.aides.some(a => a.cle === 'indice') ? `<p class="indice"><b>Indice · </b>${fines(m.q.i || 'Pas d’indice écrit pour cette question.')}</p>` : ''
    const carte = offerte ? '<p class="pied">Ta carte Coup d’œil offre ta première aide de l’épreuve ; la suivante coûtera une étoile.</p>' : ''
    return `<section class="aides" aria-label="Les aides"><div class="aides-rangee">${boutons}</div>${indice}${carte}
      <p class="plafond"><span>Cette manche vaut au plus</span>${etoiles(plafondDe(m))}</p></section>`
  }
  function afficherLaManche() {
    const m = M, q = m.q
    if (E.mode === 'v2') {
      app.innerHTML = `${tete()}${chrono()}${laQuestion(q)}
        <section class="etape"><p class="etape-titre"><span><span class="num">1</span><b>${q.an ? 'L’époque' : 'L’ordre de grandeur'}</b></span><span class="regle">la bonne : ★</span></p>${frise(m)}</section>
        <section class="etape"><p class="etape-titre"><span><span class="num">2</span><b>${q.an ? 'L’année' : 'La valeur'}</b></span><span class="regle">${q.an ? `à ${m.ep.anneaux[0]} an${m.ep.anneaux[0] > 1 ? 's' : ''} ★★★ · à ${m.ep.anneaux[1]} ans ★★` : 'à 6 % ★★★ · à 25 % ★★'}</span></p>${etapeValeur(m)}</section>
        ${aides(m)}
        <button type="button" class="btn btn-or btn-plein" data-geste="lancer"${m.choisie === null || m.x === null ? ' aria-disabled="true"' : ''}>${m.choisie === null ? 'Choisis d’abord ' + (q.an ? 'une époque' : 'un ordre de grandeur') : m.x === null ? 'Pose ton curseur sur la piste' : 'Lancer le filet'}</button>
        ${coulisses(q)}`
    } else {
      const p = m.p, L = p.max - p.min
      const pos = Math.round((m.x - p.min) / p.pas)
      const demi = DEMI[m.taille] * L
      const g = Math.max(0, (100 * (m.x - demi - p.min)) / L), d = Math.min(100, (100 * (m.x + demi - p.min)) / L)
      const zone = m.zone ? `<span class="zone" style="left:${(100 * (m.zone.de - p.min) / L).toFixed(2)}%;width:${(100 * (m.zone.a - m.zone.de) / L).toFixed(2)}%"></span>` : ''
      app.innerHTML = `${tete()}${chrono()}${laQuestion(q)}
        <div class="valeur-vise"><output class="valeur" id="valeur">${q.an ? m.x : nombre(m.x)}${!q.an && q.u ? ` <small>${echapper(q.u)}</small>` : ''}</output></div>
        <p class="couvre" id="couvre">Ton filet : de ${dire(q, Math.max(p.min, m.x - demi))} à ${dire(q, Math.min(p.max, m.x + demi))}</p>
        <div class="curseur"><button type="button" class="cran" data-cran="-1" aria-label="Un cran de moins">−</button>
          <div class="piste"><div class="rail" id="anneaux">${zone}<span class="anneau anneau-2" style="left:${g.toFixed(2)}%;width:${(d - g).toFixed(2)}%"></span></div>
            <input id="curseur" class="range" type="range" min="0" max="${Math.round(L / p.pas)}" step="1" value="${pos}" aria-label="${q.an ? 'L’année' : 'La valeur'}"></div>
          <button type="button" class="cran" data-cran="1" aria-label="Un cran de plus">+</button></div>
        <div class="bornes"><span>${dire(q, p.min)}</span><span>${dire(q, p.max)}</span></div>
        <div class="grands-pas"><button type="button" class="cran" data-grand="-1">− un grand pas</button><button type="button" class="cran" data-grand="1">+ un grand pas</button></div>
        <div class="tailles" role="group" aria-label="La taille de ton filet">${Object.keys(DEMI).map(t => `<button type="button" class="taille" data-taille="${t}" aria-pressed="${m.taille === t}">${t[0].toUpperCase() + t.slice(1)}${etoiles(ETOILES_DU_FILET[t], ETOILES_DU_FILET[t])}</button>`).join('')}</div>
        ${memo.coupDOeil && !E.eclairerUtilise ? '<button type="button" class="btn" data-geste="eclairer">Éclairer (ta carte Coup d’œil, une fois par épreuve)</button>' : ''}
        <button type="button" class="btn btn-or btn-plein" data-geste="lancer">Lancer le filet</button>
        ${coulisses(q)}`
    }
  }
  function rafraichirLeCurseur() {
    const v = document.getElementById('valeur')
    if (!v) return
    const q = M.q
    if (E.mode === 'v2') {
      v.innerHTML = `${q.an ? M.x : nombre(lisible(M.x))}${!q.an && q.u ? ` <small>${echapper(q.u)}</small>` : ''}`
      document.getElementById('anneaux').innerHTML = anneauxHtml(M)
      const r = document.getElementById('curseur')
      if (r) { r.value = positionDe(M, M.x); r.setAttribute('aria-valuetext', q.an ? String(M.x) : dire(q, M.x)) }
    } else {
      afficherLaManche()
      document.getElementById('curseur')?.focus({ preventScroll: true })
    }
  }

  function afficherLaRevelation() {
    const m = M, q = m.q, n = m.fin.n
    const titre = n === 3 ? 'Pile dedans' : n === 2 ? 'Tout près' : n === 1 ? (E.mode === 'v2' ? 'La bonne époque' : 'Dans le grand filet') : (m.fin.auto && (E.mode !== 'v2' || m.choisie === null) ? 'Le temps a filé' : 'À côté')
    let juge = ''
    if (E.mode === 'v2') {
      const ecart = m.choisie === null ? null : q.an ? Math.abs(m.x - q.v) : Math.abs(m.x / q.v - 1)
      const ecartDit = ecart === null ? '' : q.an ? `${ecart} an${ecart > 1 ? 's' : ''}` : `${Math.round(100 * ecart)} %`
      const nat = m.etoilesNaturelles
      juge = `<ul class="detail-juge">
        <li><span>${q.an ? 'La bonne époque' : 'Le bon ordre de grandeur'}</span><span class="${m.choisie === m.ep.bonne ? 'oui' : 'non'}">${m.choisie === m.ep.bonne ? '★ oui' : 'non'}</span></li>
        <li><span>${q.an ? `À ${m.ep.anneaux[1]} ans près` : 'À 25 % près'}</span><span class="${nat >= 2 ? 'oui' : 'non'}">${nat >= 2 ? '★★ oui' : 'non'}</span></li>
        <li><span>${q.an ? `À ${m.ep.anneaux[0]} an${m.ep.anneaux[0] > 1 ? 's' : ''} près` : 'À 6 % près'}</span><span class="${nat >= 3 ? 'oui' : 'non'}">${nat >= 3 ? '★★★ oui' : 'non'}</span></li>
        ${ecartDit ? `<li><span>Ton écart</span><span>${ecartDit}</span></li>` : ''}
        ${plafondDe(m) < 3 ? `<li><span>Les aides prises</span><span>au plus ${'★'.repeat(plafondDe(m))}</span></li>` : ''}
      </ul>`
    } else {
      const L = m.p.max - m.p.min, e = Math.abs(m.x - q.v) / L
      juge = `<ul class="detail-juge"><li><span>Ton filet</span><span>${m.taille} (±${Math.round(DEMI[m.taille] * 100)} % de la piste)</span></li>
        <li><span>Ton écart</span><span>${Math.round(e * 1000) / 10} % de la piste</span></li>
        <li><span>Le grand filet au même endroit</span><span class="${e <= 0.2 ? 'oui' : 'non'}">${e <= 0.2 ? '★ l’aurait prise' : 'à côté aussi'}</span></li></ul>`
    }
    const vise = E.mode === 'v2' ? (m.choisie === null ? 'tu n’as pas lancé' : m.x === null ? 'l’époque seule' : `tu visais ${dire(q, m.x)}`) : `tu visais ${dire(q, m.x)}`
    const gagne = m.repereGagne ? `<p class="gagne"><b>Nouveau repère :</b> ${fines(q.r)} (${q.v}). Il se posera sur la frise de tes prochaines dates.</p>` : ''
    app.innerHTML = `${tete()}${laQuestion(q)}
      <section class="verdict${n === 0 ? ' rate' : ''}" aria-live="polite"><span class="grand">${titre}</span>${etoiles(n)}${n === 0 ? '<span>La manche te coûte un cœur.</span>' : ''}</section>
      ${E.mode === 'v2' ? `<section class="etape">${frise(m, true)}</section>` : ''}
      <p class="reponse">La réponse : ${dire(q, q.v)} · ${vise}</p>
      ${juge}
      ${q.a ? `<p class="anecdote">${fines(q.a)}</p>` : ''}
      ${gagne}
      <button type="button" class="btn btn-or btn-plein" data-geste="suivante">${E.coeurs === 0 ? 'Voir le bilan' : E.i >= 2 ? 'Voir le bilan' : 'Manche suivante'}</button>
      ${coulisses(q)}`
    document.querySelector('.verdict')?.focus?.()
  }

  function afficherLeBilan() {
    const total = E.resultats.reduce((s, r) => s + r.n, 0)
    const perdus = 4 - E.coeurs
    const tombe = E.coeurs === 0
    const lignes = E.resultats.map(r => `<li><span class="q">${fines(r.q.t)}</span><span class="r">${dire(r.q, r.q.v)} · ${r.choisie === null && E.mode === 'v2' ? 'pas de lancer' : `toi : ${dire(r.q, r.x)}`}${r.aides ? ` · ${r.aides} aide${r.aides > 1 ? 's' : ''}` : ''}</span>${etoiles(r.n)}</li>`).join('')
    const suivant = E.acte < 3 ? `<button type="button" class="btn" data-geste="acte" data-acte="${E.acte + 1}">Passer à l’${ACTES[E.acte + 1].nom.toLowerCase()}</button>` : ''
    const autre = E.mode === 'v2' ? 'Rejouer cet acte au Filet d’aujourd’hui' : 'Rejouer cet acte au nouveau Filet'
    app.innerHTML = `<section class="page bloc"><p class="label">${ACTES[E.acte].nom} · ${E.mode === 'v2' ? 'le nouveau Filet' : 'le Filet d’aujourd’hui'}</p>
      <h1>${tombe ? 'Ton dernier cœur est tombé' : 'Épreuve terminée'}</h1>
      <p>${etoiles(Math.min(3, Math.round(total / 3)))} <b>${total} étoile${total > 1 ? 's' : ''} sur 9</b> · ${perdus} cœur${perdus > 1 ? 's' : ''} perdu${perdus > 1 ? 's' : ''}${E.mode === 'v2' ? ` · ${E.resultats.reduce((s, r) => s + r.aides, 0)} aide(s)` : ''}</p>
      <ol class="recap">${lignes}</ol>
      <div class="actions">
        <button type="button" class="btn btn-or btn-plein" data-geste="rejouer">Rejouer l’${ACTES[E.acte].nom.toLowerCase()}</button>
        <button type="button" class="btn" data-geste="autre">${autre}</button>
        ${suivant}
        <button type="button" class="btn" data-geste="accueil">Retour à l’accueil</button>
      </div></section>`
  }

  function afficherLAccueil() {
    clearInterval(minuteur)
    E = null; M = null
    const actes = [1, 2, 3].map(n => `<button type="button" class="acte-btn" data-choisir-acte="${n}" aria-pressed="${memo.acte === n}"><b>${ACTES[n].nom}</b><small>${balise(n === 1 ? 'verte' : n === 2 ? 'bleue' : 'rouge')} ${ACTES[n].dit}</small></button>`).join('')
    const reperes = memo.reperes.length ? `<p class="pied">Tes repères gagnés : ${memo.reperes.slice(-4).map(r => `${r.an} · ${fines(r.l)}`).join(' ; ')}${memo.reperes.length > 4 ? '…' : ''} <button type="button" class="lien" data-geste="oublier">Les oublier</button></p>` : ''
    app.innerHTML = `<header class="accueil-tete"><p class="label">Le Cabinet de curiosités · maquette du 9 novembre 2026</p>
        <h1>Le nouveau Filet</h1>
        <p class="chapo">En production, les joueurs réussissent 43 % des manches du Filet, moins qu’un joueur qui lancerait le grand filet au milieu sans lire la question (45 %). Voici ce qui change.</p></header>
      <ol class="promesses">
        <li><span class="n">1</span><span><b>D’abord l’époque, puis l’année.</b> Quatre époques (ou quatre ordres de grandeur) : trouver la bonne vaut déjà une étoile. Le savoir approximatif paie enfin.</span></li>
        <li><span class="n">2</span><span><b>Le filet se resserre tout seul.</b> Plus de taille à parier : plus tu es près, plus tu gagnes.</span></li>
        <li><span class="n">3</span><span><b>Des repères sur la frise, et deux aides.</b> Des dates connues — et celles que tu as déjà su placer. Une aide coûte une étoile ; la carte Coup d’œil offre la première.</span></li>
        <li><span class="n">4</span><span><b>Le moteur choisit les questions.</b> L’acte I ne pose que des sujets que la plupart connaissent ; les loteries attendent l’acte III.</span></li>
      </ol>
      <section class="bloc"><p class="label">L’acte</p><div class="actes" role="group" aria-label="L’acte">${actes}</div></section>
      <div class="modes">
        <button type="button" class="btn btn-or mode-btn" data-geste="jouer" data-mode="v2">Jouer le nouveau Filet<small>3 manches · 4 cœurs · une manche à zéro étoile coûte un cœur</small></button>
        <button type="button" class="btn mode-btn" data-geste="jouer" data-mode="actuel">Jouer le Filet d’aujourd’hui<small>les mêmes règles qu’en production, pour comparer</small></button>
      </div>
      <section class="reglages" aria-label="Réglages de la maquette">
        <label class="bascule"><span>La carte Coup d’œil en main<small>offre la première aide de l’épreuve (aujourd’hui : Éclairer)</small></span><input type="checkbox" id="r-coup" data-reglage="coupDOeil"${memo.coupDOeil ? ' checked' : ''}></label>
        <label class="bascule"><span>Le chrono de 45 secondes<small>comme en production ; sans, pour explorer</small></span><input type="checkbox" id="r-chrono" data-reglage="chrono"${memo.chrono ? ' checked' : ''}></label>
        <label class="bascule"><span>Les coulisses du moteur<small>ce qu’il sait de chaque question, sous la manche</small></span><input type="checkbox" id="r-coulisses" data-reglage="coulisses"${memo.coulisses ? ' checked' : ''}></label>
      </section>
      <nav class="liens" aria-label="Pour aller plus loin">
        <button type="button" class="lien" data-geste="chiffres">Ce que disent les 169 lancers de la production</button>
        <button type="button" class="lien" data-geste="regles">Les règles du nouveau Filet, en entier</button>
      </nav>
      ${reperes}
      <p class="pied">Une page hors de FiestApp : ${D.questions.length} vraies questions du Filet, celles que la production a posées du 1er au 8 novembre 2026, avec la note du moteur et un indice écrit pour chacune.</p>`
  }

  function afficherLesChiffres() {
    clearInterval(minuteur)
    const P = D.production
    const lignes = P.regles.map(r => `<tr${r.fort ? ' class="fort"' : ''}><td>${echapper(r.nom)}</td><td>${r.reussies} %</td><td>${nombre(r.etoiles)}</td><td>${r.aveugle} %</td><td>${r.savoir > 0 ? '+' : ''}${r.savoir}</td></tr>`).join('')
    app.innerHTML = `<section class="page bloc">
      <button type="button" class="lien retour" data-geste="accueil">← L’accueil</button>
      <p class="label">La production, du 1er au 8 novembre 2026</p>
      <h1>Ce que disent les ${P.lancers} lancers</h1>
      <p>${P.lancers} lancers réels du Filet, ${P.joueurs} joueurs, rejugés sous chaque règle : le curseur posé dit ce que le joueur croyait, la règle dit ce que ça vaut. « Au hasard » : un joueur qui ne lit pas la question.</p>
      <div class="tableau"><table><thead><tr><th>Règle</th><th>Réussies</th><th>★ / manche</th><th>Au hasard</th><th>Le savoir (pts)</th></tr></thead><tbody>${lignes}</tbody></table></div>
      <h2>Pourquoi le Filet d’aujourd’hui se joue au hasard</h2>
      <ul>${P.pourquoi.map(p => `<li>${fines(p)}</li>`).join('')}</ul>
      <h2>Le moteur de difficulté</h2>
      <ul>${P.moteur.map(p => `<li>${fines(p)}</li>`).join('')}</ul>
      <h2>Ce qui se fait ailleurs</h2>
      <ul>${P.ailleurs.map(p => `<li>${fines(p)}</li>`).join('')}</ul>
      <p class="pied">Une borne basse : rejugés, les curseurs ont été posés sous l’ancienne règle. Dans le vrai jeu en deux temps, on choisit l’époque parmi quatre boutons, où l’on reconnaît mieux qu’on ne place.</p>
    </section>`
  }

  function afficherLesRegles() {
    clearInterval(minuteur)
    app.innerHTML = `<section class="page bloc">
      <button type="button" class="lien retour" data-geste="accueil">← L’accueil</button>
      <p class="label">Les règles</p>
      <h1>Le nouveau Filet</h1>
      <h2>Une manche, deux gestes</h2>
      <ul>
        <li><b>L’époque.</b> Quatre époques côte à côte : de 25 ans depuis 1800, de 50 ans de 1500 à 1799, d’un siècle avant. Pour une grandeur, quatre ordres de grandeur : de 1 000 à 3 000, de 3 000 à 10 000, de 10 000 à 30 000…</li>
        <li><b>L’année.</b> La piste s’ouvre sur l’époque choisie, sans curseur : on le pose d’un toucher, puis on l’ajuste. On peut encore changer d’époque.</li>
        <li><b>Le filet se resserre tout seul</b> autour du curseur : ★★★ à un douzième de l’époque (2 ans sur 25), ★★ à un quart (6 ans), ★ pour la bonne époque. Une grandeur : ★★★ à 6 %, ★★ à 25 %, ★ pour le bon ordre de grandeur.</li>
        <li><b>À zéro étoile</b>, la manche coûte un cœur, comme aujourd’hui.</li>
      </ul>
      <h2>Les repères</h2>
      <ul><li>Deux dates connues au plus se posent sur la frise, jamais à moins d’un quart d’époque de la réponse, jamais du même sujet.</li>
        <li>Une année placée à ★★ devient <b>ton repère</b> : elle revient sur la frise de tes prochaines dates, avant les autres.</li></ul>
      <h2>Les aides</h2>
      <ul><li><b>Deux époques de moins</b> retire deux mauvaises époques. <b>Un indice</b> donne une phrase pour s’orienter, jamais la valeur.</li>
        <li>Chacune coûte une étoile au plus haut de la manche : avec une aide, elle vaut au plus ★★ ; avec les deux, ★. La carte Coup d’œil offre la première aide de chaque épreuve.</li></ul>
      <h2>Le moteur</h2>
      <ul><li>Chaque question a sa connaissabilité au Filet : la part des joueurs qui placeraient la valeur à 5 % près. L’acte I ne pose que celles qu’au moins 40 % connaissent, l’acte II de 25 à 39 %, l’acte III le reste.</li>
        <li>Elle part de l’avis de l’IA, validé sur les lancers réels, et se recale sur chaque lancer de chaque question.</li></ul>
    </section>`
  }

  function afficher(ecran) {
    if (ecran === 'chiffres') afficherLesChiffres()
    else if (ecran === 'regles') afficherLesRegles()
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
      case 'chiffres': return afficher('chiffres')
      case 'regles': return afficher('regles')
      case 'oublier': memo.reperes = []; retenir(); return afficherLAccueil()
      case 'eclairer': {
        if (!M || E.eclairerUtilise) return
        E.eclairerUtilise = true
        const L = M.p.max - M.p.min, largeur = 0.3 * L
        const de = Math.max(M.p.min, Math.min(M.p.max - largeur, M.q.v - Math.random() * largeur))
        M.zone = { de, a: de + largeur }
        return afficherLaManche()
      }
    }
  })
  app.addEventListener('input', ev => {
    if (ev.target.id === 'curseur') bouger(Number(ev.target.value))
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

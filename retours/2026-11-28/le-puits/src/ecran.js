'use strict'
/* L'écran : le Sphinx et sa boîte, le puits et ses trois cordes, l'atelier, et
   la salle où l'on joue une énigme. Il ne sait rien d'aucune énigme : il
   demande tout au moule de la fiche — partir, jouer un coup, dire si c'est
   fini, se dessiner — et à son verdict, calculé par le programme. C'est ce qui
   fait qu'un moule de plus n'y change pas une ligne.

   Ici les réponses et les secrets vivent dans la page ; dans l'application, ils
   ne quitteraient pas le serveur avant la fin de l'énigme (invariant 1). */
{
  const P = globalThis.P
  const { h } = P
  const $ = id => document.getElementById(id)
  const scene = $('scene'), haut = $('haut'), boite = $('boite'), texte = $('texte'), choix = $('choix')
  const attendre = ms => new Promise(r => setTimeout(r, ms))

  document.head.append(h('style', null, P.styles.join('\n')))

  /* ---------------------------------------------------------------- */
  /* Ce que la maquette retient, sur ce téléphone                      */
  /* ---------------------------------------------------------------- */

  const CLE = 'fiestapp.maquette.puits.v1'
  const etatNeuf = () => ({ intro: false, profondeur: 0, faites: {}, racontees: {}, cordes: null, tirages: 0, son: false, calme: false })
  function etatLu() {
    try {
      const lu = JSON.parse(localStorage.getItem(CLE) || 'null')
      if (lu && lu.faites && typeof lu.profondeur === 'number') return { ...etatNeuf(), ...lu }
    } catch { /* des cookies bloqués : on repart de zéro, sans rien casser */ }
    return etatNeuf()
  }
  let etat = etatLu()
  const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)) } catch { /* rien à garder */ } }
  const calme = () => etat.calme || matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------------------------------------------------------------- */
  /* Les sons : de petits bips d'autrefois, muets tant qu'on ne les veut pas */
  /* ---------------------------------------------------------------- */

  const sons = {
    ctx: null,
    note(f, d, quand = 0, g = 0.035) {
      if (!etat.son) return
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)()
        const o = this.ctx.createOscillator(), a = this.ctx.createGain()
        o.type = 'square'
        o.frequency.value = f
        a.gain.value = g
        o.connect(a).connect(this.ctx.destination)
        const t = this.ctx.currentTime + quand
        o.start(t)
        a.gain.setValueAtTime(g, t + d * 0.7)
        a.gain.linearRampToValueAtTime(0, t + d)
        o.stop(t + d)
      } catch { /* pas de son sur ce téléphone : la maquette reste muette */ }
    },
    bip() { this.note(880, 0.022) },
    menu() { this.note(660, 0.05) },
    pose() { this.note(330, 0.07) },
    non() { this.note(196, 0.12); this.note(147, 0.18, 0.1) },
    oui() { [523, 659, 784, 1047].forEach((f, i) => this.note(f, 0.11, i * 0.09)) },
  }
  function dessinerLeSon() {
    $('son').setAttribute('aria-pressed', String(etat.son))
    $('son-dessin').innerHTML = P.glyphe(etat.son ? 'voix' : 'muet', 14)
  }
  $('son').addEventListener('click', e => {
    e.stopPropagation()
    etat.son = !etat.son
    garder()
    dessinerLeSon()
    sons.menu()
  })

  /* ---------------------------------------------------------------- */
  /* Le Sphinx, qui naît en mosaïque                                   */
  /* ---------------------------------------------------------------- */

  const imageSphinx = new Image()
  imageSphinx.src = 'images/sphinx-perso.webp'
  const imagePrete = new Promise(r => { imageSphinx.onload = r; imageSphinx.onerror = r })
  const toile = $('sphinx-toile')
  const DECOUPE = [0, 0, 256, 172]
  function peindreSphinx(pas) {
    const ctx = toile.getContext('2d')
    const W = toile.width, H = toile.height
    ctx.clearRect(0, 0, W, H)
    if (pas === null || !imageSphinx.naturalWidth) return
    if (pas >= 1) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(imageSphinx, ...DECOUPE, 0, 0, W, H)
      return
    }
    // Une mosaïque de plus en plus fine : le dessin réduit, puis agrandi sans lissage.
    const w = Math.max(3, Math.round(4 + pas * pas * 90))
    const hh = Math.max(2, Math.round(w * 172 / 256))
    const petit = document.createElement('canvas')
    petit.width = w
    petit.height = hh
    petit.getContext('2d').drawImage(imageSphinx, ...DECOUPE, 0, 0, w, hh)
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = Math.min(1, 0.35 + pas)
    ctx.drawImage(petit, 0, 0, w, hh, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  async function materialiser(j) {
    await imagePrete
    if (!calme()) {
      for (let i = 0; i <= 10; i++) {
        peindreSphinx(i / 11)
        sons.note(220 + i * 40, 0.04)
        await attendre(90)
        verifier(j)
      }
      eclair()
    }
    peindreSphinx(1)
    scene.classList.add('glorieux')
  }
  function eclair() {
    const f = $('flash')
    f.classList.remove('part')
    void f.offsetWidth
    f.classList.add('part')
  }
  function secouer() {
    scene.classList.remove('non')
    void scene.offsetWidth
    scene.classList.add('non')
  }

  /* ---------------------------------------------------------------- */
  /* Le Sphinx parle : lettre par lettre, un toucher finit la réplique */
  /* ---------------------------------------------------------------- */

  // Chaque scène porte un jeton : en changer coupe ce que l'ancienne attendait.
  class Coupe extends Error {}
  let jeton = 0, frappe = 0, finirLaFrappe = null, toucher = null
  const verifier = j => { if (j !== jeton) throw new Coupe() }
  function jouer(scenario) {
    const j = ++jeton
    frappe++
    finirLaFrappe = null
    toucher = null
    choix.hidden = true
    boite.classList.remove('attend')
    Promise.resolve().then(() => scenario(j)).catch(e => { if (!(e instanceof Coupe)) throw e })
  }
  async function ecrire(j, brut) {
    verifier(j)
    const phrase = P.fr(brut)
    const moi = ++frappe
    $('texte-lu').textContent = phrase.replace(/\*/g, '')
    boite.classList.remove('attend')
    // Chaque lettre a sa place dès le départ : un mot ne saute pas de ligne en s'écrivant.
    texte.innerHTML = ''
    const lettres = []
    let enValeur = false
    for (const c of phrase) {
      if (c === '*') { enValeur = !enValeur; continue }
      const s = document.createElement('span')
      s.className = 'c'
      s.textContent = c
      if (enValeur) { const em = document.createElement('em'); em.append(s); texte.append(em) } else texte.append(s)
      lettres.push(s)
    }
    let fini = false
    const tout = () => { fini = true; lettres.forEach(s => s.classList.add('v')) }
    finirLaFrappe = tout
    if (calme()) tout()
    for (let i = 0; i < lettres.length && !fini; i++) {
      lettres[i].classList.add('v')
      const c = lettres[i].textContent
      if (i % 2 === 0 && c.trim()) sons.bip()
      await attendre(c === '…' ? 260 : /[.!?]/.test(c) ? 160 : /[,;:]/.test(c) ? 90 : 24)
      verifier(j)
      if (moi !== frappe) return
    }
    if (moi !== frappe) return
    tout()
    finirLaFrappe = null
  }
  async function dire(j, phrase) {
    await ecrire(j, phrase)
    verifier(j)
    boite.classList.add('attend')
    await new Promise(r => { toucher = r })
    toucher = null
    boite.classList.remove('attend')
    sons.menu()
    verifier(j)
  }
  async function demander(j, phrase, options) {
    await ecrire(j, phrase)
    verifier(j)
    choix.innerHTML = ''
    const choisi = new Promise(r => {
      for (const [valeur, libelle] of options) {
        const b = h('button', { type: 'button', onclick: e => { e.stopPropagation(); sons.menu(); r(valeur) } }, libelle)
        b.addEventListener('pointerenter', () => choix.querySelectorAll('button').forEach(x => x.classList.toggle('vise', x === b)))
        choix.append(b)
      }
    })
    choix.hidden = false
    choix.querySelector('button').classList.add('vise')
    const valeur = await choisi
    choix.hidden = true
    verifier(j)
    return valeur
  }
  // Une réaction du Sphinx, sans rien attendre : l'énigme reste jouable pendant qu'il parle.
  function parler(phrase) {
    const j = jeton
    ecrire(j, phrase).catch(e => { if (!(e instanceof Coupe)) throw e })
  }
  // Un toucher hors de tout ce qui se joue : finir la réplique, ou passer à la suivante.
  scene.addEventListener('click', e => {
    if (e.target.closest('button, input, form, a, [role="group"], .plateau, .outils')) return
    if (finirLaFrappe) finirLaFrappe()
    else if (toucher) toucher()
  })
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, button, [role="group"]')) return
    if (e.key === 'Enter' || e.key === ' ') {
      if (finirLaFrappe) { e.preventDefault(); finirLaFrappe() } else if (toucher) { e.preventDefault(); toucher() }
    }
  })

  // Trois allures : le Sphinx raconte (grand), on se promène (moyen), on joue (petit, la boîte basse).
  function allure(nom) {
    scene.classList.toggle('grand', nom === 'raconte')
    scene.classList.toggle('joue', nom === 'joue')
    scene.classList.toggle('glorieux', nom === 'raconte')
  }
  function montrer(...enfants) {
    scene.classList.remove('au-puits')
    haut.classList.remove('centre')
    haut.replaceChildren(...enfants)
    haut.scrollTop = 0
  }
  function montrerAuCentre(...enfants) {
    montrer(...enfants)
    haut.classList.add('centre')
  }
  const points = niveau => h('span', { class: 'points', role: 'img', 'aria-label': `difficulté ${niveau} sur 5` }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= niveau ? 'plein' : '' })))
  const etoiles = n => h('span', { class: 'etoiles', role: 'img', 'aria-label': P.pluriel(n, 'étoile') }, [1, 2, 3].map(i => h('span', { class: i <= n ? 'plein' : '', html: P.glyphe('etoile', 14) })))

  /* ---------------------------------------------------------------- */
  /* Le puits                                                          */
  /* ---------------------------------------------------------------- */

  // Une énigme facile fait descendre d'un palier, une dure de trois : on choisit sa corde et son risque.
  const chute = f => (f.niveau <= 2 ? 1 : f.niveau === 3 ? 2 : 3)
  const niveauDuPalier = p => Math.min(5, 1 + Math.floor(p / 6))
  const METRES_PAR_PALIER = 5
  // Une corde se retient par ce qui la refait : le nom d'une fiche écrite, ou la graine d'une énigme tirée.
  const ficheDe = c => (c.id ? P.fiches.find(f => f.id === c.id) : P.moules[c.moule]?.tirer?.(c.graine, c.niveau))
  function tirerLesCordes() {
    const base = niveauDuPalier(etat.profondeur)
    const alea = P.alea(etat.profondeur * 7919 + etat.tirages * 104729 + 17)
    const pris = new Set()
    const cordes = []
    for (const cible of [base - 1, base, base + 1].map(n => Math.min(5, Math.max(1, n)))) {
      // D'abord une énigme écrite qu'il n'a pas jouée, au plus près du niveau voulu, d'un moule que ce palier n'offre pas déjà.
      const ecrites = P.melanger(alea, P.fiches.filter(f => !etat.faites[f.id] && !pris.has(f.moule) && Math.abs(f.niveau - cible) <= 1))
        .sort((a, b) => Math.abs(a.niveau - cible) - Math.abs(b.niveau - cible))
      if (ecrites.length) { pris.add(ecrites[0].moule); cordes.push({ id: ecrites[0].id }); continue }
      // Sinon une énigme tirée : c'est par elles que le puits n'a pas de fond.
      const tireurs = P.melanger(alea, Object.values(P.moules).filter(m => m.tirer && !pris.has(m.cle)))
      const m = tireurs[0] || P.parmi(alea, Object.values(P.moules).filter(x => x.tirer))
      pris.add(m.cle)
      cordes.push({ moule: m.cle, graine: P.entier(alea, 1, 1e9), niveau: cible })
    }
    return cordes
  }
  function dessinerLePuits() {
    if (!etat.cordes || etat.cordes.some(c => !ficheDe(c))) { etat.cordes = tirerLesCordes(); garder() }
    const resolues = Object.values(etat.faites).filter(x => x.e === 'or').length
    montrer(h('div', { class: 'puits vue' },
      h('p', { class: 'sourcil' }, 'Le puits du Sphinx'),
      h('h1', null, etat.profondeur ? `Palier ${etat.profondeur}` : 'La margelle'),
      h('p', { class: 'fond' }, etat.profondeur ? h('b', null, `${etat.profondeur * METRES_PAR_PALIER} m`) : 'Trois cordes, trois énigmes.', etat.profondeur ? ` sous le sable · ${P.pluriel(resolues, 'énigme résolue', 'énigmes résolues')}` : ' Choisis la tienne.'),
      h('div', { class: 'margelle' }, etat.cordes.map(c => {
        const f = ficheDe(c), m = P.moules[f.moule]
        return h('button', { type: 'button', class: 'corde', onclick: () => jouer(j => enigme(j, f, 'puits')) },
          h('span', { html: P.glyphe(m.glyphe, 30) }),
          h('span', { class: 'cat' }, m.nom),
          h('span', { class: 'n' }, f.titre),
          points(f.niveau),
          h('span', { class: 'chute' }, `↓ ${P.pluriel(chute(f), 'palier')}`))
      })),
      h('div', { class: 'portes' },
        h('button', { type: 'button', class: 'porte-atelier', onclick: () => jouer(j => atelier(j)) }, h('span', { html: P.glyphe('livre', 16) }), `L’atelier · ${P.fiches.length} énigmes`),
        h('button', { type: 'button', class: 'porte-atelier', onclick: () => { etat.tirages++; etat.cordes = null; garder(); jouer(j => puits(j, 'D’autres cordes, alors.')) } }, 'D’autres cordes'))))
    scene.classList.add('au-puits')
  }
  async function puits(j, phrase) {
    allure('promene')
    partie = null
    dessinerLePuits()
    await ecrire(j, phrase || (etat.profondeur ? `Palier *${etat.profondeur}*. Trois cordes : laquelle ?` : 'Trois cordes. Plus l’énigme est dure, plus tu descends.'))
  }

  /* ---------------------------------------------------------------- */
  /* L'atelier : toutes les énigmes, pour les essayer une à une         */
  /* ---------------------------------------------------------------- */

  function dessinerLAtelier() {
    const tireurs = Object.values(P.moules).filter(m => m.tirer)
    const blocs = Object.entries(P.SOCLES).flatMap(([cle, socle]) => {
      const moules = Object.values(P.moules).filter(m => m.socle === cle)
      if (!moules.length) return []
      const lignes = moules.flatMap(m => [
        ...P.fiches.filter(f => f.moule === m.cle).map(f => {
          const faite = etat.faites[f.id]
          return h('li', null, h('button', { type: 'button', class: `ligne ${faite ? faite.e : ''}`, onclick: () => jouer(j => enigme(j, f, 'atelier')) },
            h('span', { html: P.glyphe(m.glyphe, 22) }),
            h('span', null, h('span', { class: 'n' }, f.titre), h('span', { class: 'd' }, `${m.nom} · ${f.source}`)),
            faite?.e === 'or' ? etoiles(faite.etoiles) : points(f.niveau)))
        }),
        m.tirer && h('li', null, h('button', { type: 'button', class: 'ligne', onclick: () => {
          const niveau = 1 + (etat.tirages % 5)
          etat.tirages++
          garder()
          jouer(j => enigme(j, m.tirer(Date.now() % 1e9, niveau), 'atelier'))
        } },
        h('span', { html: P.glyphe(m.glyphe, 22) }),
        h('span', null, h('span', { class: 'n' }, 'En tirer une autre'), h('span', { class: 'd' }, `${m.nom} · le programme en fabrique sans fin`)),
        h('span', { class: 'd' }, '∞'))),
      ])
      return [h('div', { class: 'socle-nom' }, h('p', { class: 'sourcil' }, socle.nom), h('span', null, socle.dit)), h('ul', { class: 'liste' }, lignes)]
    })
    montrer(h('div', { class: 'atelier vue' },
      h('div', { class: 'atelier-tete' },
        h('button', { type: 'button', class: 'retour', 'aria-label': 'Revenir au puits', onclick: () => jouer(j => puits(j)) }, '←'),
        h('div', null, h('h1', null, 'L’atelier'), h('p', { class: 'fond' }, `${P.fiches.length} énigmes écrites, ${Object.keys(P.moules).length} moules ; ${tireurs.length} en tirent d’autres sans fin.`))),
      blocs))
  }
  let hauteurDeLAtelier = 0
  async function atelier(j) {
    allure('promene')
    partie = null
    dessinerLAtelier()
    haut.scrollTop = hauteurDeLAtelier
    await ecrire(j, 'Mon atelier : chaque énigme, à jouer dans l’ordre que tu veux.')
  }
  const retour = (j, origine, phrase) => (origine === 'atelier' ? atelier(j) : puits(j, phrase))

  /* ---------------------------------------------------------------- */
  /* Une énigme                                                        */
  /* ---------------------------------------------------------------- */

  // La partie en cours : sa fiche, son moule, son état, et ce que l'écran en compte.
  let partie = null
  const reste = n => (n >= 2 ? `Il te reste *${['', '', 'deux', 'trois'][n] || n}* essais.` : 'Plus qu’*un* essai.')

  function compteur(p) {
    const jauge = p.m.jauge && p.m.jauge(p.f, p.e)
    if (jauge) return h('p', { class: 'compteur' }, h('b', null, jauge.split(' ')[0]), jauge.split(' ').slice(1).join(' '))
    if (p.essais != null) return h('p', { class: 'compteur' }, h('b', null, String(p.essais)), p.essais > 1 ? 'essais' : 'essai')
    if (p.m.socle === 'duel') return h('p', { class: 'compteur' }, h('b', null, String(p.parties + 1)), p.parties ? 'parties' : 'partie')
    const mieux = p.f.coupsMax ? `sur ${p.f.coupsMax}` : p.v.coups != null ? (p.m.socle === 'pose' ? `sur ${p.v.coups}` : `${p.v.coups} au mieux`) : ''
    return h('p', { class: 'compteur' }, h('b', null, String(p.coups)), [p.m.unite[p.coups > 1 ? 1 : 0], mieux].filter(Boolean).join(' · '))
  }
  function dessinerLaSalle(sourcil) {
    const p = partie
    const plateau = h('div', { class: 'plateau' }, p.m.dessiner({ f: p.f, e: p.e, agir, dire: parler, fige: p.fige }))
    montrer(h('section', { class: 'salle' },
      h('header', { class: 'salle-tete' },
        h('button', { type: 'button', class: 'retour', 'aria-label': 'Plus tard', onclick: () => jouer(j => retour(j, p.origine, 'Prends ton temps. Mon énigme t’attendra.')) }, '←'),
        h('div', null, h('p', { class: 'sourcil' }, sourcil || p.m.nom), h('h2', { class: 'titre' }, p.f.titre)),
        compteur(p)),
      p.f.regle && h('p', { class: 'regle' }, p.f.regle),
      plateau,
      !p.montre && h('footer', { class: 'issues' },
        h('button', { type: 'button', class: 'lien', onclick: () => recommencer() }, 'Recommencer'),
        h('button', { type: 'button', class: 'lien', onclick: () => jouer(j => enigme(j, p.f, p.origine, true)) }, 'Relire'),
        h('button', { type: 'button', class: 'lien', onclick: () => jouer(j => defaite(j, 'Soit.')) }, 'Langue au chat'))))
  }
  // Le plateau se redessine en entier à chaque coup ; l'endroit où l'on avait défilé reste le même.
  function redessiner() {
    const ou = haut.scrollTop
    dessinerLaSalle(partie.montre ? 'La solution' : null)
    haut.scrollTop = ou
  }
  function recommencer() {
    const p = partie
    if (!p || p.montre) return
    p.tour++
    p.e = p.m.depart(p.f, p.tour)
    p.coups = 0
    p.fige = false
    redessiner()
    parler('On reprend du début.')
  }

  function agir(coup) {
    const p = partie
    if (!p || p.fige) return
    const r = p.m.jouer(p.f, p.e, coup)
    if (!r.etat) {
      sons.non()
      secouer()
      parler(r.refus || 'Non.')
      return
    }
    p.e = r.etat
    const compte = !p.m.compte || p.m.compte(coup)
    if (compte) { p.coups++; sons.pose() } else sons.bip()
    redessiner()
    const fin = p.m.fini(p.f, p.e)
    if (fin?.gagne) return jouer(j => victoire(j))
    if (fin?.perdu) return perdu(fin.perdu)
    if (!compte || !p.m.riposte) return
    // Le Sphinx répond : le plateau se fige le temps qu'il pose.
    p.fige = true
    redessiner()
    const k = jeton
    setTimeout(() => {
      if (k !== jeton || partie !== p) return
      p.e = p.m.jouer(p.f, p.e, p.m.riposte(p.f, p.e)).etat
      p.fige = false
      sons.pose()
      redessiner()
      const suite = p.m.fini(p.f, p.e)
      if (suite?.gagne) jouer(j => victoire(j))
      else if (suite?.perdu) perdu(suite.perdu)
    }, calme() ? 150 : 650)
  }
  // Perdu : un essai de moins quand la fiche les compte, puis l'énigme repart du début.
  function perdu(phrase) {
    const p = partie
    sons.non()
    secouer()
    if (p.essais != null && --p.essais <= 0) return jouer(j => defaite(j, phrase))
    p.parties++
    p.fige = true
    redessiner()
    parler(p.essais != null ? `${phrase} ${reste(p.essais)}` : phrase)
    const k = jeton
    setTimeout(() => {
      if (k !== jeton || partie !== p) return
      p.tour++
      p.e = p.m.depart(p.f, p.tour)
      p.coups = 0
      p.fige = false
      redessiner()
    }, calme() ? 500 : 1700)
  }

  async function raconter(j, f) {
    const m = P.moules[f.moule]
    allure('raconte')
    montrerAuCentre(h('div', { class: 'recit vue' },
      h('span', { html: P.glyphe(m.glyphe, 54) }),
      h('p', { class: 'sourcil' }, `${m.nom} · ${P.SOCLES[m.socle].nom}`),
      h('h2', { class: 'titre' }, f.titre),
      h('p', { class: 'source' }, f.source),
      points(f.niveau)))
    for (const phrase of f.recit) await dire(j, phrase)
  }
  async function enigme(j, f, origine, relire) {
    if (origine === 'atelier' && haut.querySelector('.atelier')) hauteurDeLAtelier = haut.scrollTop
    const m = P.moules[f.moule]
    if (relire || !etat.racontees[f.id]) {
      await raconter(j, f)
      etat.racontees[f.id] = true
      garder()
    }
    partie = { f, m, v: P.verdict(f), e: m.depart(f, 0), coups: 0, tour: 0, parties: 0, essais: f.essais ?? null, fige: false, origine }
    allure('joue')
    dessinerLaSalle()
    // La règle est écrite au-dessus du plateau : le Sphinx ne la redit pas.
    await ecrire(j, m.socle === 'duel' ? 'À toi. Tu commences.' : 'À toi.')
  }

  /* ---------------------------------------------------------------- */
  /* La fin d'une énigme                                               */
  /* ---------------------------------------------------------------- */

  // Trois étoiles : la meilleure façon possible, que le programme connaît. Chaque socle la compte à sa manière.
  function etoilesDe(p) {
    if (p.m.etoiles) return p.m.etoiles(p.f, p.e, p.coups)
    if (p.f.essais != null) return Math.max(1, 3 - (p.f.essais - p.essais))
    if (p.m.socle === 'duel') return p.parties === 0 ? 3 : p.parties <= 2 ? 2 : 1
    if (p.m.socle === 'sonde') return p.v.coups != null && p.coups <= p.v.coups ? 3 : 2
    if (p.m.socle === 'pose' || p.v.coups == null) return p.tour === 0 ? 3 : 2
    return p.coups <= p.v.coups ? 3 : p.coups <= p.v.coups * 1.5 ? 2 : 1
  }
  function bilan(p) {
    const u = n => P.pluriel(n, ...p.m.unite)
    if (p.m.socle === 'duel') return p.parties ? `Battu à la ${p.parties + 1}e partie.` : 'Battu du premier coup.'
    if (p.f.essais != null) return p.essais === p.f.essais ? 'Du premier coup.' : `Au ${p.f.essais - p.essais + 1}e essai.`
    if (p.m.socle !== 'chemin' || p.v.coups == null || p.f.limite) return `${u(p.coups)}.`
    return p.coups <= p.v.coups ? `${u(p.coups)} : on ne fait pas mieux.` : `${u(p.coups)}. On peut le faire en ${p.v.coups}.`
  }
  async function victoire(j) {
    const p = partie
    const n = etoilesDe(p)
    const avant = etat.faites[p.f.id]
    etat.faites[p.f.id] = { e: 'or', coups: p.coups, etoiles: Math.max(n, avant?.e === 'or' ? avant.etoiles : 0) }
    const tombe = p.origine === 'puits' ? chute(p.f) : 0
    if (tombe) { etat.profondeur += tombe; etat.cordes = null }
    garder()
    p.fige = true
    redessiner()
    eclair()
    sons.oui()
    await attendre(calme() ? 0 : 500)
    verifier(j)
    allure('promene')
    montrerAuCentre(h('div', { class: 'gain vue' },
      h('span', { html: P.glyphe(p.m.glyphe, 54) }),
      etoiles(n),
      h('h2', null, p.f.titre),
      h('p', null, h('b', null, bilan(p))),
      h('p', null, p.f.source),
      tombe > 0 && h('p', null, h('b', null, `Tu descends de ${P.pluriel(tombe, 'palier')}.`))))
    await dire(j, n === 3 ? '*Résolue*, et de la plus belle façon.' : '*Résolue*.')
    if (n < 3 && p.v.solution && p.m.socle === 'chemin') {
      const veut = await demander(j, 'Tu veux voir la plus courte ?', [['oui', 'Montre-moi'], ['non', 'Pas la peine']])
      if (veut === 'oui') await solution(j, p.f)
    }
    await retour(j, p.origine)
  }
  async function defaite(j, phrase) {
    const p = partie
    if (etat.faites[p.f.id]?.e !== 'or') etat.faites[p.f.id] = { e: 'sable' }
    if (p.origine === 'puits') { etat.tirages++; etat.cordes = null }
    garder()
    allure('promene')
    montrerAuCentre(h('div', { class: 'gain de-sable vue' },
      h('span', { html: P.glyphe(p.m.glyphe, 54) }),
      h('h2', null, p.f.titre),
      h('p', null, 'Elle s’ensable. Tu peux toujours la rejouer à l’atelier.')))
    await dire(j, `${phrase} Regarde comment on la résout.`)
    await solution(j, p.f)
    await retour(j, p.origine)
  }
  // La solution : rejouée coup par coup sur le plateau quand le programme en tient une, dite en mots sinon.
  async function solution(j, f) {
    const m = P.moules[f.moule], v = P.verdict(f)
    if (v.solution && !f.explication) {
      partie = { f, m, v, e: m.depart(f, 0), coups: 0, tour: 0, parties: 0, essais: null, fige: true, montre: true, origine: partie?.origine }
      allure('joue')
      dessinerLaSalle('La solution')
      await ecrire(j, 'Regarde.')
      for (const coup of v.solution) {
        await attendre(calme() ? 350 : 800)
        verifier(j)
        partie.e = m.jouer(f, partie.e, coup).etat
        partie.coups++
        sons.pose()
        redessiner()
      }
      await attendre(500)
      verifier(j)
      await dire(j, v.coups != null ? `Voilà : ${P.pluriel(v.coups, ...m.unite)}.` : 'Voilà.')
      return
    }
    const etapes = f.explication || ['Celle-là, je garde son secret.']
    const liste = h('ol', { class: 'etapes' })
    allure('promene')
    montrer(h('section', { class: 'salle vue' }, h('p', { class: 'sourcil' }, 'La solution, pas à pas'), h('h2', { class: 'titre' }, f.titre), liste))
    for (const etape of etapes) {
      liste.append(h('li', null, etape))
      haut.scrollTop = haut.scrollHeight
      await dire(j, etape)
    }
  }

  /* ---------------------------------------------------------------- */
  /* L'arrivée, et les outils de la maquette                           */
  /* ---------------------------------------------------------------- */

  async function arrivee(j) {
    allure('raconte')
    scene.classList.remove('glorieux')
    montrer()
    await attendre(calme() ? 0 : 350)
    verifier(j)
    boite.classList.add('la')
    await attendre(calme() ? 0 : 420)
    verifier(j)
    await materialiser(j)
    if (!etat.intro) {
      await dire(j, 'Tu aimes les énigmes, Léa ? Alors approche.')
      await dire(j, 'Voici *mon puits*. Il n’a pas de fond.')
      await dire(j, 'À chaque palier, trois cordes : trois énigmes. Tu choisis la tienne.')
      await dire(j, 'Ici, on ne répond pas : on *joue*. Et rien ne presse.')
      etat.intro = true
      garder()
    }
    await puits(j)
  }

  const outilsBouton = $('outils-bouton'), outilsMenu = $('outils-menu')
  const fermerLesOutils = () => { outilsMenu.hidden = true; outilsBouton.setAttribute('aria-expanded', 'false') }
  outilsBouton.addEventListener('click', () => {
    outilsMenu.hidden = !outilsMenu.hidden
    outilsBouton.setAttribute('aria-expanded', String(!outilsMenu.hidden))
  })
  function dessinerLeCalme() {
    scene.classList.toggle('calme', etat.calme)
    $('outil-calme').textContent = etat.calme ? 'Remettre le mouvement' : 'Moins de mouvement'
  }
  outilsMenu.addEventListener('click', e => {
    const outil = e.target.closest('button')?.dataset.outil
    if (!outil) return
    fermerLesOutils()
    if (outil === 'calme') { etat.calme = !etat.calme; garder(); dessinerLeCalme(); return }
    if (outil === 'descendre') { etat.profondeur += 10; etat.cordes = null; garder(); return jouer(j => puits(j, 'Dix paliers plus bas. Les énigmes y sont plus dures.')) }
    const { son, calme: c } = etat
    etat = { ...etatNeuf(), son, calme: c }
    garder()
    peindreSphinx(null)
    jouer(j => arrivee(j))
  })
  document.addEventListener('click', e => { if (!e.target.closest('.outils')) fermerLesOutils() })

  // Ce que le banc d'essai (`jouer.mjs`) touche : ouvrir une énigme sans passer par le récit, jouer sa solution.
  window.maquette = {
    fiches: () => P.fiches.map(f => ({ id: f.id, moule: f.moule, socle: P.moules[f.moule].socle, solution: !!P.verdict(f).solution })),
    ouvrir(id) { const f = P.fiches.find(x => x.id === id); etat.racontees[f.id] = true; jouer(j => enigme(j, f, 'atelier')) },
    tirer(moule, niveau, graine) { const f = P.moules[moule].tirer(graine, niveau); etat.racontees[f.id] = true; jouer(j => enigme(j, f, 'atelier')) },
    resoudre() { for (const coup of partie.v.solution) agir(coup) },
    partie: () => partie && { coups: partie.coups, fige: partie.fige, essais: partie.essais },
    vue: () => haut.firstElementChild?.className || '',
  }

  dessinerLeSon()
  dessinerLeCalme()
  jouer(j => arrivee(j))
}

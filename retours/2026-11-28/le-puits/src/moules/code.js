'use strict'
/* Le code : une sonde. Le Sphinx cache une suite de signes, et ne répond à
   chaque proposition que par deux nombres : combien de signes sont à leur
   place, combien sont dans son code mais ailleurs. C'est « Taureaux et vaches »,
   qu'on jouait au crayon avec des chiffres bien avant que Mordecai Meirowitz
   n'en fasse le Mastermind (1970). Rien ne s'écrit à la main : le moule tire, et
   la stratégie de Donald Knuth (1977) — proposer ce qui laisse, au pire, le
   moins de codes possibles — prouve en combien de propositions on trouve à coup
   sûr. La fiche en permet une de plus : un joueur n'est pas un programme.

   Une fiche donne `cases` (la longueur du code), `glyphes` (parmi combien de
   signes), `repete` (un signe peut revenir), `graine` (d'où sort le code) et
   `coupsMax`. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.code = ['.#######.', '#.......#', '#.#.#.#.#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.#.#.#.#', '#.......#', '.#######.']

  // Chaque signe a sa forme ET sa couleur : qui confond le rouge et le vert lit encore un losange et un triangle.
  // Dessinés, pas tapés : un soleil ou une lune de clavier deviennent des emojis sur un téléphone sur deux.
  const SIGNES = [
    { nom: 'soleil', teinte: '#f0c24b', trace: '<circle cx="12" cy="12" r="5.2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4M4.6 4.6l2.8 2.8M16.6 16.6l2.8 2.8M4.6 19.4l2.8-2.8M16.6 7.4l2.8-2.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' },
    { nom: 'lune', teinte: '#8fb1d8', trace: '<path d="M15.5 2.2a10 10 0 1 0 6.3 13.6a8.2 8.2 0 0 1-6.3-13.6z"/>' },
    { nom: 'étoile', teinte: '#f3ece2', trace: '<path d="M12 1.6l3 7 7.6.6-5.8 5 1.8 7.4L12 17.7l-6.6 3.9 1.8-7.4-5.8-5 7.6-.6z"/>' },
    { nom: 'losange', teinte: '#e06c6c', trace: '<path d="M12 1.5l8 10.5-8 10.5L4 12z"/>' },
    { nom: 'triangle', teinte: '#8fc48a', trace: '<path d="M12 2.5l10.3 18.5H1.7z"/>' },
    { nom: 'anneau', teinte: '#c79be0', trace: '<circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="4.4"/>' },
  ]
  const signe = (g, taille) => h('span', { class: 'co-signe', style: `color:${SIGNES[g].teinte}`, html: `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="currentColor" aria-hidden="true">${SIGNES[g].trace}</svg>` })

  P.style(`
.co { display: grid; gap: 8px; }
.co-legende { display: flex; justify-content: center; gap: 16px; margin: 0; font-size: 11.5px; line-height: 16px; color: var(--muted); }
.co-pion { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 50%; vertical-align: -1px; }
.co-pion.place { background: var(--or); }
.co-pion.ailleurs { border: 2px solid var(--or-clair); }
.co-rangs { display: grid; justify-content: center; gap: 4px; margin: 0; padding: 0; list-style: none; }
.co-rang { display: grid; grid-template-columns: 16px repeat(var(--cases), 40px) 78px; align-items: center; justify-items: center; column-gap: 6px; min-height: 26px; }
.co-rang > small { justify-self: end; font: 600 11px/1 var(--f-pixel); color: var(--muted); }
.co-rang.a-venir > i { width: 7px; height: 7px; border-radius: 50%; background: rgba(243, 236, 226, 0.13); }
.co-rang.en-cours > small { color: var(--or-clair); }
.co-signe { display: grid; place-items: center; line-height: 0; }
.co-reponse { justify-self: end; display: inline-flex; gap: 10px; font: 600 15px/1 var(--f-pixel); color: var(--ink); font-variant-numeric: tabular-nums; }
.co-reponse .co-pion { margin-right: 4px; }
.co-case { width: 40px; height: 40px; padding: 0; display: grid; place-items: center; background: rgba(0, 0, 0, 0.3); border: 1px dashed rgba(217, 181, 106, 0.6); border-radius: 8px; }
.co-case.pleine { border-style: solid; }
.co-case[disabled] { cursor: default; }
.co-palette { display: flex; justify-content: center; gap: 8px; }
.co-palette button { width: 44px; height: 44px; padding: 0; display: grid; place-items: center; background: linear-gradient(180deg, var(--pierre), var(--pierre-sombre)); border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; }
.co-palette button[disabled] { opacity: 0.3; cursor: default; }
`)

  // Tous les codes qu'une fiche permet : c'est parmi eux que le Sphinx tire, et parmi eux qu'on propose.
  const ESPACES = new Map()
  function espace(f) {
    const cle = `${f.cases}-${f.glyphes}-${f.repete ? 'r' : 's'}`
    if (!ESPACES.has(cle)) {
      const codes = []
      const pousse = c => {
        if (c.length === f.cases) return codes.push(c)
        for (let g = 0; g < f.glyphes; g++) if (f.repete || !c.includes(g)) pousse([...c, g])
      }
      pousse([])
      ESPACES.set(cle, { codes, garanti: 0 })
    }
    return ESPACES.get(cle)
  }
  // Un signe ne compte qu'une fois : à sa place d'abord, ailleurs ensuite, autant de fois que le code le porte.
  function repond(secret, code, glyphes) {
    let places = 0
    const dansLeSecret = new Array(glyphes).fill(0), dansLeCode = new Array(glyphes).fill(0)
    secret.forEach((g, i) => { if (code[i] === g) places++; else { dansLeSecret[g]++; dansLeCode[code[i]]++ } })
    let ailleurs = 0
    for (let g = 0; g < glyphes; g++) ailleurs += Math.min(dansLeSecret[g], dansLeCode[g])
    return [places, ailleurs]
  }

  /* La preuve qu'on trouve toujours : on déroule la stratégie de Knuth contre TOUS les codes à la fois. À chaque
     nœud, on propose le code qui laisse la plus petite « pire réponse » (à égalité, un code encore possible : il
     peut tomber juste), et on recommence dans chaque réponse. La profondeur de l'arbre est le nombre garanti —
     quatre propositions à trois signes, cinq à quatre. Knuth a montré que cinq est aussi le mieux qu'on puisse
     promettre au Mastermind (quatre parmi six, avec répétitions) ; un parcours complet, fait à part, dit de même
     des trois niveaux sans répétition. Toutes les réponses sont calculées une fois, dans une table. */
  function garanti(f) {
    const esp = espace(f)
    if (esp.garanti) return esp.garanti
    const { codes } = esp
    const n = codes.length
    const gagne = f.cases * (f.cases + 1)
    const table = new Uint8Array(n * n)
    for (let s = 0; s < n; s++) {
      for (let c = s; c < n; c++) {
        const [places, ailleurs] = repond(codes[s], codes[c], f.glyphes)
        table[s * n + c] = table[c * n + s] = places * (f.cases + 1) + ailleurs
      }
    }
    const parts = new Int32Array(gagne + 1)
    const possible = new Uint8Array(n)
    const profondeur = candidats => {
      if (candidats.length === 1) return 1
      possible.fill(0)
      for (const s of candidats) possible[s] = 1
      let choisi = -1, pire = Infinity
      for (let c = 0; c < n; c++) {
        parts.fill(0)
        let grosse = 0
        for (const s of candidats) { const v = ++parts[table[s * n + c]]; if (v > grosse) grosse = v }
        if (grosse < pire || (grosse === pire && possible[c] && !possible[choisi])) { pire = grosse; choisi = c }
      }
      const suites = new Map()
      for (const s of candidats) {
        const r = table[s * n + choisi]
        if (r === gagne) continue
        if (!suites.has(r)) suites.set(r, [])
        suites.get(r).push(s)
      }
      let p = 1
      for (const suite of suites.values()) p = Math.max(p, 1 + profondeur(suite))
      return p
    }
    esp.garanti = profondeur(codes.map((_, i) => i))
    return esp.garanti
  }

  const complet = (f, c) => Array.isArray(c) && c.length === f.cases && c.every(g => Number.isInteger(g) && g >= 0 && g < f.glyphes)
  const dite = (places, ailleurs) => {
    if (!places && !ailleurs) return 'Rien : aucun de ces signes n’est dans mon code.'
    const a = places ? (places > 1 ? `${places} à leur place` : 'Un seul à sa place') : 'Aucun à sa place'
    const b = ailleurs ? (ailleurs > 1 ? `${ailleurs} ailleurs` : 'un ailleurs') : 'aucun ailleurs'
    return `${a}, ${b}.`
  }

  const moule = P.moule({
    cle: 'code',
    nom: 'Le code',
    socle: 'sonde',
    glyphe: 'code',
    unite: ['proposition', 'propositions'],
    // Dans l'application, le code resterait au serveur, qui ne rendrait que les deux nombres : ici il vit dans
    // l'état, faute de serveur. `ligne` est la proposition qu'on compose, pas encore un coup.
    depart(f, tour) {
      const alea = P.alea(f.graine + (tour || 0))
      return { secret: P.parmi(alea, espace(f).codes).slice(), essais: [], ligne: new Array(f.cases).fill(null) }
    },
    compte: coup => coup.propose !== undefined,
    jauge: (f, e) => `${e.essais.length} sur ${f.coupsMax}`,
    coups: (f, e) => espace(f).codes.filter(c => !e.essais.some(x => x.code.join() === c.join())).map(c => ({ propose: c })),
    jouer(f, e, coup) {
      if (coup.pose !== undefined) {
        const i = e.ligne.indexOf(null)
        if (i < 0) return { refus: 'Ta ligne est pleine : touche une case pour la vider.' }
        if (!f.repete && e.ligne.includes(coup.pose)) return { refus: 'Dans ce code, un signe ne sert qu’une fois.' }
        return { etat: { ...e, ligne: e.ligne.map((g, k) => (k === i ? coup.pose : g)) } }
      }
      if (coup.ote !== undefined) return { etat: { ...e, ligne: e.ligne.map((g, k) => (k === coup.ote ? null : g)) } }
      const c = coup.propose
      if (!complet(f, c)) return { refus: 'Remplis d’abord toutes les cases.' }
      if (!f.repete && new Set(c).size < c.length) return { refus: 'Dans ce code, un signe ne sert qu’une fois.' }
      if (e.essais.some(x => x.code.join() === c.join())) return { refus: 'Tu l’as déjà proposé : je te répondrais la même chose.' }
      const [places, ailleurs] = repond(e.secret, c, f.glyphes)
      return { etat: { ...e, essais: [...e.essais, { code: c.slice(), places, ailleurs }], ligne: new Array(f.cases).fill(null) } }
    },
    fini(f, e) {
      const dernier = e.essais[e.essais.length - 1]
      if (dernier && dernier.places === f.cases) return { gagne: true }
      if (e.essais.length < f.coupsMax) return null
      return { perdu: `C’était : ${e.secret.map(g => SIGNES[g].nom).join(', ')}. J’en grave un autre.` }
    },
    verifier(f) {
      const n = garanti(f)
      if (n > f.coupsMax) return { ok: false, note: `il en faut ${n} pour être sûr, la fiche n’en donne que ${f.coupsMax}` }
      return { ok: true, coups: n, note: `trouvé à coup sûr parmi ${espace(f).codes.length} codes ; ${f.coupsMax} permises` }
    },
    dessiner({ f, e, agir, dire, fige }) {
      const clos = fige || !!moule.fini(f, e)
      const pion = (classe, n) => h('span', null, h('i', { class: `co-pion ${classe}` }), String(n))
      const rang = k => {
        const essai = e.essais[k]
        if (essai) return h('li', { class: 'co-rang', 'aria-label': `Proposition ${k + 1} : ${essai.code.map(g => SIGNES[g].nom).join(', ')}. ${dite(essai.places, essai.ailleurs)}` },
          h('small', null, String(k + 1)), essai.code.map(g => signe(g, 22)),
          h('span', { class: 'co-reponse' }, pion('place', essai.places), pion('ailleurs', essai.ailleurs)))
        if (k > e.essais.length || clos) return h('li', { class: 'co-rang a-venir', 'aria-hidden': 'true' }, h('small', null, String(k + 1)), e.ligne.map(() => h('i')))
        return h('li', { class: 'co-rang en-cours' }, h('small', null, String(k + 1)), e.ligne.map((g, i) => h('button', {
          type: 'button', class: `co-case ${g === null ? '' : 'pleine'}`, disabled: g === null,
          'aria-label': g === null ? `Case ${i + 1}, vide` : `Case ${i + 1} : ${SIGNES[g].nom}. Toucher pour la vider.`,
          onclick: () => agir({ ote: i }),
        }, g !== null && signe(g, 28))))
      }
      const pleine = !e.ligne.includes(null)
      return h('div', { class: 'co', style: `--cases:${f.cases}` },
        h('p', { class: 'co-legende' }, h('span', null, h('i', { class: 'co-pion place' }), 'à sa place'), h('span', null, h('i', { class: 'co-pion ailleurs' }), 'dans le code, ailleurs')),
        h('ol', { class: 'co-rangs' }, Array.from({ length: f.coupsMax }, (_, k) => rang(k))),
        h('div', { class: 'co-palette' }, SIGNES.slice(0, f.glyphes).map((s, g) => h('button', {
          type: 'button', 'aria-label': `Poser : ${s.nom}`, disabled: clos || pleine || (!f.repete && e.ligne.includes(g)),
          onclick: () => agir({ pose: g }),
        }, signe(g, 30)))),
        h('div', { class: 'pose' }, h('button', {
          type: 'button', class: 'bouton', disabled: clos || !pleine,
          onclick: () => {
            // La réponse se lit sur le coup qu'on va jouer : le Sphinx la dit, sauf si la partie s'arrête là.
            const r = moule.jouer(f, e, { propose: e.ligne })
            agir({ propose: e.ligne })
            if (!r.etat || moule.fini(f, r.etat)) return
            const dernier = r.etat.essais[r.etat.essais.length - 1]
            dire(dite(dernier.places, dernier.ailleurs))
          },
        }, 'Proposer')))
    },
    // Rien à inventer que le code : il sort de la graine. `sur` est ce que la stratégie de Knuth garantit pour
    // chaque espace — `verifier` le reprouve à chaque fois —, et la fiche permet une proposition de plus.
    tirer(graine, niveau) {
      const NIVEAUX = [
        { cases: 3, glyphes: 4, repete: false, sur: 4 },
        { cases: 4, glyphes: 5, repete: false, sur: 5 },
        { cases: 4, glyphes: 6, repete: false, sur: 5 },
        { cases: 4, glyphes: 5, repete: true, sur: 5 },
        { cases: 4, glyphes: 6, repete: true, sur: 5 },
      ]
      const EN_MOTS = ['', '', '', 'trois', 'quatre', 'cinq', 'six']
      const { cases, glyphes, repete, sur } = NIVEAUX[Math.min(4, Math.max(0, niveau - 1))]
      const coupsMax = sur + 1
      return {
        id: `code-${cases}-${glyphes}-${repete ? 'r' : 's'}-${graine}`, moule: 'code', niveau, tiree: true,
        titre: `${EN_MOTS[cases][0].toUpperCase() + EN_MOTS[cases].slice(1)} signes parmi ${EN_MOTS[glyphes]}`,
        source: 'Tirée par le programme, sur le modèle de « Taureaux et vaches », jeu de papier traditionnel, et du Mastermind de Mordecai Meirowitz (1970)',
        recit: [
          `J’ai gravé ${EN_MOTS[cases]} signes, pris parmi ${EN_MOTS[glyphes]}. ${repete ? 'Le même peut revenir.' : 'Tous différents.'}`,
          'Propose une suite : je te dirai combien de signes sont à leur place, et combien sont dans mon code, mais ailleurs.',
          `Tu as ${EN_MOTS[coupsMax]} propositions.`,
        ],
        regle: `Un signe pour le poser, une case pour la vider.${repete ? ' Un signe peut revenir.' : ' Jamais deux fois le même signe.'}`,
        cases, glyphes, repete, graine, coupsMax,
      }
    },
  })

  /* ---------------------------------------------------------------- */

  // Deux tirages gardés tels quels, pour l'atelier : quatre signes tous différents, puis les répétitions.
  const SOURCE = '« Taureaux et vaches », jeu de papier traditionnel ; Mastermind, Mordecai Meirowitz, 1970'
  P.fiche({ ...moule.tirer(1970, 2), id: 'code-a', tiree: false, titre: 'Le code du Sphinx', source: SOURCE })
  P.fiche({ ...moule.tirer(1977, 4), id: 'code-b', tiree: false, titre: 'Le code aux signes qui reviennent', source: SOURCE })
}

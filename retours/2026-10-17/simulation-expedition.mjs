// La simulation du brief de l'Expédition (`expedition.md`, « Le calibrage »),
// faite avant tout code : des joueurs inventés jouent des expéditions
// entières sur le générateur de la maquette « La grande carte » et sur la
// règle du brief. Elle ne lit rien du dépôt — le vrai calibrage viendra avec
// l'étape 1 (`server/scripts/calibrage-expedition.ts`), sur le vrai modèle du
// savoir.
//
//   node retours/2026-10-17/simulation-expedition.mjs [expéditions par case]
//
// Le joueur moyen trouve ce que trouve le calibrage des sentiers
// (`TAUX_DU_CALIBRAGE`, `shared/sentiers.ts`) ; le faible et le fort sont
// décalés d'un logit, comme les décale `calibrage-sentiers.ts`.

const TAUX = { facile: 0.85, moyen: 0.55, difficile: 0.3, expert: 0.1 }
const logit = p => Math.log(p / (1 - p))
const sig = x => 1 / (1 + Math.exp(-x))

// Un hasard qui se rejoue : la même graine redonne la même expédition.
function alea(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Le générateur de la maquette, sans ce qui ne sert qu'à dessiner.
function carte(r) {
  const entier = n => Math.floor(r() * n)
  const aretes = {}
  const present = {}
  const existe = (f, c, x) => (aretes[f + ':' + c] || []).includes(x)
  const croise = (f, c, x) => (x === c + 1 && existe(f, c + 1, c)) || (x === c - 1 && existe(f, c - 1, c))
  // Cinq chemins montent du bas, d'une colonne voisine à l'autre, sans jamais
  // en croiser un autre : leurs pas font les escales et les liens.
  for (let p = 0; p < 5; p++) {
    let c = p < 4 ? p : entier(4)
    present['0:' + c] = true
    for (let f = 0; f < 5; f++) {
      const options = [c - 1, c, c + 1].filter(x => x >= 0 && x < 4)
      for (let i = options.length - 1; i > 0; i--) {
        const j = entier(i + 1)
        ;[options[i], options[j]] = [options[j], options[i]]
      }
      let suivant = c
      for (const o of options) {
        if (!croise(f, c, o)) {
          suivant = o
          break
        }
      }
      const cle = f + ':' + c
      if (!aretes[cle]) aretes[cle] = []
      if (!aretes[cle].includes(suivant)) aretes[cle].push(suivant)
      present[f + 1 + ':' + suivant] = true
      c = suivant
    }
  }
  const FORMES = ['classique', 'classique', 'classique', 'classique', 'vraifaux', 'vraifaux', 'six', 'six', 'devoilement', 'devoilement']
  const noeuds = {}
  let elites = 0
  let inconnus = 0
  let echoppes = 0
  for (let f = 0; f < 6; f++) {
    for (let c = 0; c < 4; c++) {
      if (!present[f + ':' + c]) continue
      const id = 'n' + f + c
      const n = { id, f, c }
      let type = 'question'
      if (f > 0) {
        const t = r()
        if (t < 0.46) type = 'question'
        else if (t < 0.58) type = f >= 2 && elites < 2 ? 'elite' : 'question'
        else if (t < 0.68) type = 'source'
        else if (t < 0.8) type = 'coffre'
        else if (t < 0.88) type = inconnus < 2 ? 'inconnu' : 'question'
        else if (t < 0.93) type = echoppes < 1 ? 'echoppe' : 'question'
      }
      if (type === 'elite') elites++
      if (type === 'inconnu') inconnus++
      if (type === 'echoppe') echoppes++
      n.type = type
      if (type === 'question' || type === 'elite') {
        const s = r()
        n.theme = f > 0 && s < 0.18 ? 'melange' : f > 0 && s < 0.32 ? 'pointu' : 'categorie'
        n.cat = entier(12)
        n.cats = [entier(12), entier(12), entier(12)]
        n.forme = f === 0 ? (r() < 0.7 ? 'classique' : 'vraifaux') : FORMES[entier(FORMES.length)]
      }
      noeuds[id] = n
    }
  }
  // Une carte sans source ni coffre ne laisserait aucun choix de soin ou de butin.
  const assurer = type => {
    const ids = Object.keys(noeuds)
    if (ids.some(id => noeuds[id].type === type)) return
    const cible = ids.find(id => noeuds[id].type === 'question' && noeuds[id].f >= 2 && noeuds[id].f <= 4)
    if (cible) noeuds[cible] = { id: cible, f: noeuds[cible].f, c: noeuds[cible].c, type }
  }
  assurer('source')
  assurer('coffre')
  const suite = { S: [] }
  for (let c = 0; c < 4; c++) if (present['0:' + c]) suite.S.push('n0' + c)
  for (let f = 0; f < 5; f++) {
    for (let c = 0; c < 4; c++) if (present[f + ':' + c]) suite['n' + f + c] = (aretes[f + ':' + c] || []).map(x => 'n' + (f + 1) + x)
  }
  return { noeuds, suite }
}

// Le savoir se lit sous le hasard d'un sur quatre ; chaque forme a le sien.
const savoir = p4 => Math.max(0, (p4 - 0.25) / 0.75)
const HASARD = { classique: 1 / 4, devoilement: 1 / 4, six: 1 / 6, vraifaux: 1 / 2 }

function jouer(regles, decalage, graine) {
  const r = alea(graine)
  // Chacun a ses catégories fortes et faibles ; les thèmes pointus lui sont plus durs.
  const parCategorie = Array.from({ length: 12 }, () => (r() + r() + r() - 1.5) * 1.2)
  const p4 = (marche, n) => {
    let ecart = decalage
    if (n.theme === 'categorie') ecart += parCategorie[n.cat]
    if (n.theme === 'melange') ecart += (parCategorie[n.cats[0]] + parCategorie[n.cats[1]]) / 2
    if (n.theme === 'pointu') ecart += regles.pointu
    return sig(logit(TAUX[marche]) + ecart)
  }
  let vies = 3
  let questions = 0
  let paquet = [...regles.paquet]
  let defausse = []
  const main = []
  // La défausse revient au paquet dès qu'il est vide (`vide`), ou au début de
  // chaque acte seulement (`acte`, la règle du brief).
  const tirer = () => {
    if (!paquet.length && regles.cycle !== 'acte') {
      paquet = defausse
      defausse = []
    }
    if (!paquet.length) return null
    return paquet.splice(Math.floor(r() * paquet.length), 1)[0]
  }
  let phenix = regles.paquet.includes('phenix')

  // Une question : il sait (son savoir), ou ne sait pas — et joue alors son meilleur joker.
  const question = (marche, n, forme) => {
    questions++
    const k = savoir(p4(marche, n))
    // La main se garde : un joker tiré par question, trois en main au plus.
    if (main.length < regles.main) {
      const j = tirer()
      if (j) main.push(j)
    }
    let juste
    if (r() < k) juste = true
    else {
      const joue = ['echange', 'sagesse', 'double', 'coupdoeil'].find(j => main.includes(j))
      const hasard = HASARD[forme]
      const choix = Math.round(1 / hasard)
      if (joue) {
        main.splice(main.indexOf(joue), 1)
        defausse.push(joue)
      }
      if (joue === 'echange') {
        const k2 = savoir(p4(marche, n))
        juste = r() < k2 + (1 - k2) * hasard
      } else if (joue === 'sagesse') juste = r() < 1 / Math.max(1, choix - 2)
      else if (joue === 'double') juste = r() < Math.min(1, 2 / choix)
      else if (joue === 'coupdoeil') juste = r() < 1 / Math.max(1, choix - 1)
      else juste = r() < hasard
    }
    if (!juste) {
      vies--
      if (vies === 0 && phenix) {
        phenix = false
        vies = 1
      }
    }
    return juste
  }

  for (let acte = 0; acte < 3; acte++) {
    const regle = regles.actes[acte]
    if (regles.cycle === 'acte' && acte > 0) {
      paquet.push(...defausse, ...main)
      defausse = []
      main.length = 0
    }
    const { noeuds, suite } = carte(r)
    let ici = 'S'
    for (let f = 0; f < 6 && vies > 0; f++) {
      // Il choisit ce qui le sert : se soigner quand il saigne, sinon sa meilleure chance.
      const valeur = id => {
        const n = noeuds[id]
        if (n.type === 'source') return vies < 3 ? 2 : 0.6
        if (n.type === 'coffre') return 1.1
        if (n.type === 'echoppe') return vies < 3 ? 1.2 : 0.7
        if (n.type === 'inconnu') return 0.8
        const marche = n.type === 'elite' ? regle.elite : f < 3 ? regle.bas : regle.haut
        const k = savoir(p4(marche, n))
        return k + (1 - k) * HASARD[n.forme] + (n.type === 'elite' ? 0.15 : 0)
      }
      ici = suite[ici].reduce((a, b) => (valeur(b) > valeur(a) ? b : a))
      const n = noeuds[ici]
      if (n.type === 'question') question(f < 3 ? regle.bas : regle.haut, n, n.forme)
      else if (n.type === 'elite') {
        if (question(regle.elite, n, n.forme) && regles.recompense) paquet.push(regles.recompense)
      } else if (n.type === 'source') {
        questions++
        if (r() < regles.source && vies < 3) vies++
      } else if (n.type === 'coffre') {
        if (regles.recompense) paquet.push(regles.recompense)
      } else if (n.type === 'echoppe') {
        if (vies < 3) vies++
      } else if (n.type === 'inconnu') {
        const t = r()
        if (t < 0.25 && vies < 3) vies++
        else if (t < 0.4) vies--
      }
    }
    if (vies <= 0) return { acte, questions }
    // Le campement : une vie.
    if (vies < 3) vies = Math.min(3, vies + 1)
    // Le gardien tombe à la n-ième bonne réponse ; chaque erreur coûte une vie.
    let trouvees = 0
    while (trouvees < regle.n && vies > 0) if (question(regle.gardien, { theme: 'gardien' }, 'classique')) trouvees++
    if (vies <= 0) return { acte, questions }
  }
  return { acte: 3, questions }
}

const N = Number(process.argv[2]) || 20000
const JOUEURS = [
  ['faible', -1],
  ['moyen', 0],
  ['fort', 1],
]

function mesurer(nom, regles, qui = JOUEURS) {
  const lignes = []
  for (const [joueur, decalage] of qui) {
    let gagnees = 0
    let q = 0
    const actes = [0, 0, 0, 0]
    for (let i = 0; i < N; i++) {
      const fin = jouer(regles, decalage, 1 + i * 7919 + Math.round(decalage * 1e6))
      if (fin.acte === 3) gagnees++
      actes[fin.acte]++
      q += fin.questions
    }
    const part = x => (100 * x / N).toFixed(0) + ' %'
    lignes.push(`${joueur.padEnd(6)} au bout ${part(gagnees).padStart(5)} · s'arrête à l'acte 1 / 2 / 3 : ${actes.slice(0, 3).map(part).join(' / ')} · ${(q / N).toFixed(1)} questions`)
  }
  console.log(nom + '\n  ' + lignes.join('\n  '))
}

// La règle du brief.
const DEPART = ['coupdoeil', 'coupdoeil', 'coupdoeil', 'echange']
const REGLE = {
  paquet: [...DEPART, 'sagesse', 'phenix'],
  main: 3,
  cycle: 'acte',
  recompense: 'double',
  source: 0.5,
  pointu: -0.5,
  actes: [
    { bas: 'facile', haut: 'facile', elite: 'moyen', gardien: 'facile', n: 4 },
    { bas: 'facile', haut: 'moyen', elite: 'moyen', gardien: 'moyen', n: 3 },
    { bas: 'moyen', haut: 'moyen', elite: 'difficile', gardien: 'difficile', n: 3 },
  ],
}

console.log(`${N} expéditions par joueur.\n`)
mesurer('Avec une équipée (la Chouette, le Phénix)', REGLE)
mesurer('Le paquet de départ seul', { ...REGLE, paquet: DEPART })
mesurer('Sans aucun joker', { ...REGLE, paquet: [], recompense: null })
mesurer('Le gardien de l’acte 2 facile, à cinq bonnes réponses', { ...REGLE, actes: [REGLE.actes[0], { ...REGLE.actes[1], gardien: 'facile', n: 5 }, REGLE.actes[2]] })
console.log('\nUn seul Double chance, sans rien gagner en route :')
const moyen = [['moyen', 0]]
for (const cycle of ['vide', 'acte']) {
  const quand = cycle === 'vide' ? 'la défausse rendue dès le paquet vide' : 'la défausse rendue à chaque acte'
  mesurer(`  ${quand}, sans joker`, { ...REGLE, paquet: [], recompense: null, cycle }, moyen)
  mesurer(`  ${quand}, un Double chance`, { ...REGLE, paquet: ['double'], recompense: null, cycle }, moyen)
}

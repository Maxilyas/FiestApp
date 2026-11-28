'use strict'
/* Les lettres qui valent des chiffres : une addition dont chaque lettre cache
   un chiffre. Deux lettres différentes, deux chiffres différents ; aucun nombre
   ne commence par zéro. Henry Dudeney l'a donnée au monde avec SEND + MORE =
   MONEY (The Strand Magazine, juillet 1924) et en a fait un genre, que les
   Anglais appellent « cryptarithme ». On ne devine pas : on déduit, colonne
   après colonne, en commençant par la retenue qui crée une lettre de tête.

   Se tranche d'une réponse : poser un chiffre, en libérer un ne comptent pas,
   seul « Vérifier » compte, et la fiche donne trois essais. Le plateau écrit
   l'addition en chiffres au fur et à mesure, sous chaque lettre.

   Une fiche donne `mots` (les termes) et `somme`. La preuve énumère toutes les
   affectations : une seule doit tenir. Elle donne aussi les coups qui la posent. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.cryptarithme = ['....#....', '....#....', '..#####..', '....#....', '....#....', '.........', '.#######.', '.........', '.#######.']

  P.style(`
.cr { display: grid; gap: 8px; }
.cr-add { display: grid; justify-content: center; gap: 3px; grid-template-columns: repeat(var(--cols), 40px); }
.cr-op { display: grid; place-items: center; font: 700 22px/1 var(--f-pixel); color: var(--or-clair); }
.cr-trait { grid-column: 1 / -1; height: 2px; margin: 2px 0; background: rgba(217, 181, 106, 0.55); border-radius: 1px; }
.cr-l { width: 40px; height: 42px; padding: 0; display: grid; align-content: center; justify-items: center; gap: 1px; background: linear-gradient(180deg, var(--pierre), var(--boite)); border: 1px solid rgba(217, 181, 106, 0.3); border-radius: 8px; }
.cr-l b { font: 600 18px/20px var(--f-pixel); color: var(--ink); }
.cr-l i { min-height: 16px; font: 600 14px/16px var(--f-pixel); font-style: normal; color: var(--or-clair); }
.cr-l.fait { border-color: rgba(217, 181, 106, 0.7); }
.cr-l.sel { border-color: var(--or); background: rgba(var(--sable), 0.22); box-shadow: 0 0 12px rgba(var(--sable), 0.45); }
.cr-l[disabled] { cursor: default; }
.cr-geste { margin: 0; text-align: center; font-size: 12.5px; line-height: 1.3; color: var(--muted); }
.cr-chiffres { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.cr-d { position: relative; height: 40px; padding: 0; display: grid; place-items: center; font: 600 19px/1 var(--f-pixel); color: var(--ink); background: linear-gradient(180deg, var(--pierre), var(--pierre-sombre)); border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; }
.cr-d:active { translate: 0 1px; }
.cr-d small { position: absolute; top: 3px; right: 6px; font: 600 11px/1 var(--f-pixel); color: var(--or-clair); }
.cr-d.pris { opacity: 0.4; }
.cr-d.sien { border-color: var(--or); color: var(--or-clair); }
.cr-d[disabled] { opacity: 0.3; cursor: default; }
.cr-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cr-efface { min-height: 46px; padding: 0 16px; font: 700 15px var(--f-texte); color: var(--or-clair); background: linear-gradient(180deg, var(--pierre), var(--pierre-sombre)); border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; }
.cr-efface[disabled] { opacity: 0.35; cursor: default; }
`)

  // Les lettres dans l'ordre où l'œil les rencontre, de haut en bas puis de gauche à droite.
  const lettresDe = f => [...new Set([...f.mots, f.somme].join(''))]
  const tetes = f => new Set([...f.mots, f.somme].map(m => m[0]))
  const nombre = (mot, val) => Number([...mot].map(l => val[l]).join(''))
  // Les termes et la somme écrits en chiffres, tels que les voit un joueur qui a tout posé.
  const calcul = (f, val) => ({ termes: f.mots.map(m => nombre(m, val)), somme: nombre(f.somme, val) })
  const juste = (f, val) => {
    const { termes, somme } = calcul(f, val)
    return termes.reduce((a, b) => a + b, 0) === somme
  }

  /* Toutes les affectations qui tiennent, deux au plus : on pose les lettres une à une et, dès qu'une colonne est
     entièrement connue, on vérifie son chiffre et sa retenue. Beaucoup moins de dix factorielle. La vérité reste
     `juste`, qui relit l'addition en nombres : la colonne n'est qu'un élagage. */
  function resoudre(f, max = 2) {
    const lettres = lettresDe(f)
    const l = f.somme.length
    const droite = m => [...m].reverse()
    const termes = f.mots.map(droite), somme = droite(f.somme)
    const ordre = []
    for (let k = 0; k < l; k++) for (const t of [...termes, somme]) if (k < t.length && !ordre.includes(t[k])) ordre.push(t[k])
    const interdit = tetes(f)
    const val = {}
    const pris = new Array(10).fill(false)
    const trouvees = []
    const tient = () => {
      let retenue = 0
      for (let k = 0; k < l; k++) {
        const en = termes.filter(t => k < t.length).map(t => t[k])
        if ([...en, somme[k]].some(x => val[x] === undefined)) return true
        const s = en.reduce((a, x) => a + val[x], retenue)
        if (s % 10 !== val[somme[k]]) return false
        retenue = Math.floor(s / 10)
      }
      return retenue === 0
    }
    const pose = i => {
      if (trouvees.length >= max) return
      if (i === ordre.length) { if (tient() && juste(f, val)) trouvees.push({ ...val }); return }
      const lettre = ordre[i]
      for (let d = 0; d < 10; d++) {
        if (pris[d] || (d === 0 && interdit.has(lettre))) continue
        val[lettre] = d; pris[d] = true
        if (tient()) pose(i + 1)
        delete val[lettre]; pris[d] = false
      }
    }
    if (lettres.length <= 10) pose(0)
    return trouvees
  }

  const moule = P.moule({
    cle: 'cryptarithme',
    nom: 'Les lettres qui valent des chiffres',
    socle: 'lettre',
    glyphe: 'cryptarithme',
    unite: ['vérification', 'vérifications'],
    depart: (f, tour) => ({ tour: tour || 0, val: {}, sel: null }),
    // Choisir une lettre, poser ou effacer un chiffre : des gestes de brouillon. Seul « Vérifier » engage.
    compte: coup => coup.verifie !== undefined,
    coups: (f, e) => [
      ...lettresDe(f).map(lettre => ({ lettre })),
      ...Array.from({ length: 10 }, (_, chiffre) => ({ chiffre })),
      { efface: true }, { verifie: true },
    ],
    jouer(f, e, coup) {
      if (e.verifie) return { refus: 'Tu as déjà vérifié.' }
      if (coup.lettre !== undefined) {
        if (!lettresDe(f).includes(coup.lettre)) return { refus: 'Cette lettre n’est pas dans l’addition.' }
        return { etat: { ...e, sel: e.sel === coup.lettre ? null : coup.lettre } }
      }
      if (coup.chiffre !== undefined) {
        if (e.sel === null) return { refus: 'Touche d’abord une lettre.' }
        const d = coup.chiffre
        if (!Number.isInteger(d) || d < 0 || d > 9) return { refus: 'Un chiffre, de 0 à 9.' }
        const autre = Object.keys(e.val).find(l => e.val[l] === d && l !== e.sel)
        if (autre) return { refus: `${autre} porte déjà le ${d}. Libère-la d’abord.` }
        if (d === 0 && tetes(f).has(e.sel)) return { refus: 'Un nombre ne commence pas par zéro.' }
        return { etat: { ...e, val: { ...e.val, [e.sel]: d }, sel: null } }
      }
      if (coup.efface) {
        if (e.sel === null) return { refus: 'Touche d’abord la lettre à libérer.' }
        if (e.val[e.sel] === undefined) return { refus: `${e.sel} n’a pas encore de chiffre.` }
        const val = { ...e.val }
        delete val[e.sel]
        return { etat: { ...e, val, sel: null } }
      }
      if (coup.verifie) {
        const manque = lettresDe(f).filter(l => e.val[l] === undefined).length
        if (manque) return { refus: manque > 1 ? `Il manque ${manque} lettres : donne-leur un chiffre.` : 'Il manque une lettre : donne-lui un chiffre.' }
        return { etat: { ...e, verifie: true } }
      }
      return { refus: 'Je ne comprends pas ce geste.' }
    },
    fini(f, e) {
      if (!e.verifie) return null
      if (juste(f, e.val)) return { gagne: true }
      const { termes, somme } = calcul(f, e.val)
      return { perdu: `${termes.join(' + ')} font ${termes.reduce((a, b) => a + b, 0)}, pas ${somme}.` }
    },
    verifier(f) {
      const lettres = lettresDe(f)
      if (lettres.length > 10) return { ok: false, note: `${lettres.length} lettres : il n’y a que dix chiffres` }
      if (f.mots.some(m => m.length > f.somme.length)) return { ok: false, note: 'la somme est plus courte qu’un terme' }
      const sols = resoudre(f, 2)
      if (!sols.length) return { ok: false, note: 'aucune affectation ne tient' }
      if (sols.length > 1) return { ok: false, note: 'au moins deux affectations tiennent' }
      const val = sols[0]
      const { termes, somme } = calcul(f, val)
      const solution = lettres.flatMap(lettre => [{ lettre }, { chiffre: val[lettre] }])
      solution.push({ verifie: true })
      return { ok: true, coups: 1, solution, note: `une seule : ${termes.join(' + ')} = ${somme}` }
    },
    dessiner({ f, e, agir, fige }) {
      const clos = fige || !!moule.fini(f, e)
      const n = f.somme.length
      const toutes = lettresDe(f)
      const complet = toutes.every(l => e.val[l] !== undefined)

      const cellule = lettre => h('button', {
        type: 'button', class: `cr-l ${e.sel === lettre ? 'sel' : ''} ${e.val[lettre] !== undefined ? 'fait' : ''}`, disabled: clos,
        'aria-label': e.val[lettre] === undefined ? `Lettre ${lettre}, sans chiffre` : `Lettre ${lettre}, vaut ${e.val[lettre]}`,
        onclick: () => agir({ lettre }),
      }, h('b', null, lettre), h('i', null, e.val[lettre] === undefined ? '' : String(e.val[lettre])))
      // Chaque ligne est calée à droite : les colonnes se retrouvent comme sur le papier.
      const ligne = (mot, operateur) => [
        h('span', { class: 'cr-op' }, operateur),
        ...Array.from({ length: n - mot.length }, () => h('span')),
        ...[...mot].map(cellule),
      ]
      const posee = [
        ...f.mots.flatMap((m, i) => ligne(m, i === f.mots.length - 1 ? '+' : '')),
        h('span', { class: 'cr-trait' }),
        ...ligne(f.somme, ''),
      ]

      const geste = e.sel === null ? 'Touche une lettre, puis un chiffre.' : e.val[e.sel] === undefined ? `Quel chiffre pour ${e.sel} ?` : `${e.sel} vaut ${e.val[e.sel]} : change-le, ou efface-le.`
      return h('div', { class: 'cr' },
        h('div', { class: 'cr-add', style: `--cols:${n + 1}`, role: 'group', 'aria-label': `L’addition ${f.mots.join(' plus ')} égale ${f.somme}` }, posee),
        h('p', { class: 'cr-geste' }, geste),
        h('div', { class: 'cr-chiffres' }, Array.from({ length: 10 }, (_, d) => {
          const porteur = toutes.find(l => e.val[l] === d)
          const sien = porteur !== undefined && porteur === e.sel
          return h('button', {
            type: 'button', class: `cr-d ${porteur && !sien ? 'pris' : ''} ${sien ? 'sien' : ''}`, disabled: clos,
            'aria-label': porteur ? `Chiffre ${d}, porté par ${porteur}` : `Chiffre ${d}`, onclick: () => agir({ chiffre: d }),
          }, String(d), porteur ? h('small', null, porteur) : null)
        })),
        h('div', { class: 'cr-actions' },
          h('button', { type: 'button', class: 'cr-efface', disabled: clos || e.sel === null || e.val[e.sel] === undefined, onclick: () => agir({ efface: true }) }, 'Effacer'),
          h('button', { type: 'button', class: 'bouton', disabled: clos || !complet, onclick: () => agir({ verifie: true }) }, 'Vérifier')))
    },
    // Rien à inventer que le choix de l'addition : elles ont été cherchées par le programme, parmi des mots français,
    // et gardées quand elles n'avaient qu'une solution. Le niveau suit le nombre de lettres, puis la forme : à huit
    // lettres ou plus, un double (X + X) se lit par la parité, deux termes différents demandent de vraies retenues.
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const rang = Math.min(5, Math.max(1, niveau))
      const [termes, somme] = P.parmi(alea, TROUVEES[rang]).split('=')
      const f = { mots: termes.split('+'), somme }
      return {
        id: `cryptarithme-${rang}-${graine}`, moule: 'cryptarithme', niveau: rang, tiree: true,
        titre: `${f.mots.join(' + ')} = ${f.somme}`,
        source: SOURCE_PROGRAMME,
        recit: [
          'Chaque lettre de cette addition cache un chiffre.',
          'Deux lettres différentes valent deux chiffres différents, et aucun nombre ne commence par zéro.',
          'Dis-moi ce que vaut chacune.',
        ],
        regle: REGLE,
        explication: expliquer(f),
        essais: 3,
        ...f,
      }
    },
  })

  const SOURCE_PROGRAMME = 'Trouvée par le programme, sur le modèle de Dudeney (1924)'
  const REGLE = 'Une lettre, un chiffre ; deux lettres, deux chiffres. Pas de zéro en tête.'

  // Les additions de mots français qui n'ont qu'une solution, rangées par niveau (le moule les prouve toutes à chaque tirage).
  const TROUVEES = {
    1: ['ZERO+ZERO=ONZE', 'NEUF+NEUF=LUNE', 'ONZE+ONZE=ZERO', 'ART+ART=LOTO', 'DOS+DOS=LOTO', 'JEU+JEU=FETE', 'ETE+ETE=HUIT', 'ETE+THE=CHAT', 'ROC+ROC=LOTO'],
    2: ['CENT+CENT=REINE', 'PAIN+PAIN=REINE', 'JOUR+TOUR=TERRE', 'ILE+MIEL=LAIT', 'OEIL+OEIL=POULE', 'PIED+PIED=REINE', 'COU+ROC=LOTO', 'DES+DOS=FETE', 'LUNE+LUNE=POULE'],
    3: ['DEUX+JEUX=DOUZE', 'CENT+FETE=CHIEN', 'REINE+REINE=AVRIL', 'TERRE+TERRE=PUITS', 'OIE+ONZE=CHIEN', 'VOIE+ZERO=HIVER', 'HIVER+HIVER=SEIZE', 'VIE+VOIE=CHIEN', 'VACHE+VIE=CHIEN'],
    4: ['SEIZE+SEIZE=PAQUES', 'VINGT+VINGT=TREIZE', 'REINE+REINE=PAQUES', 'TERRE+TERRE=SPHINX', 'SABLE+SABLE=PAQUES', 'PUITS+PUITS=SPHINX', 'BIERE+BIERE=SPHINX', 'COEUR+COEUR=QUINZE', 'MALIN+MALIN=QUINZE'],
    5: ['DEUX+SIX=MILLE', 'CENT+NEUF=CARTE', 'EAU+JEUX=LAPIN', 'NUIT+PIE=BOEUF', 'ILE+SUCRE=TROIS', 'COU+MILLE=COEUR', 'JEU+NEUF=DOUZE', 'HIVER+VOIE=TREIZE', 'LAPIN+PIED=TRENTE'],
  }

  /* Trois déductions qui valent toujours, sans rien connaître de la solution : la lettre de tête de la somme, quand elle
     dépasse les termes, est une retenue ; un double donne un dernier chiffre pair ; une lettre de tête n'est jamais zéro.
     La dernière phrase donne la réponse. */
  function expliquer(f) {
    const plus = f.somme.length > Math.max(...f.mots.map(m => m.length))
    const lignes = []
    if (plus && f.mots.length === 2) lignes.push(`${f.somme[0]} est la retenue d’une colonne : elle ne peut valoir que 1.`)
    else lignes.push(`Les lettres de tête, ${[...tetes(f)].join(', ')}, ne valent jamais zéro.`)
    if (f.mots[0] === f.mots[1]) lignes.push(`${f.mots[0].slice(-1)} + ${f.mots[0].slice(-1)} donne ${f.somme.slice(-1)} : ${f.somme.slice(-1)} est un chiffre pair.`)
    const val = resoudre(f, 1)[0]
    const { termes, somme } = calcul(f, val)
    lignes.push(`Colonne après colonne, une seule suite tient : ${termes.join(' + ')} = ${somme}.`)
    return lignes
  }

  /* ---------------------------------------------------------------- */

  // Dudeney, au sommet ; trois sœurs françaises en dessous, du puits au Sphinx. Les déductions sont écrites à la main :
  // chacune est vraie de toute solution, le vérificateur ne laisse passer que celle de la fiche.
  P.fiche({
    id: 'cryptarithme-dudeney', moule: 'cryptarithme', niveau: 5, tiree: false,
    titre: 'Envoie de l’argent',
    source: 'H. E. Dudeney, The Strand Magazine, juillet 1924',
    recit: ['Un étudiant écrit à son père, en trois mots : SEND, MORE, MONEY. Envoie plus d’argent.', 'Ces trois mots sont des nombres, et l’addition tombe juste.', 'Dis-moi ce que vaut chaque lettre.'],
    regle: REGLE,
    explication: [
      'MONEY a une lettre de plus que SEND et MORE : M est une retenue, donc M vaut 1.',
      'À gauche, S + M (et une retenue) doit atteindre 10 + O. Avec M = 1, O ne peut être que 0 : le 1 est pris, et S vaut 8 ou 9.',
      'Alors E + 0 donne N, et N n’est pas E : il y a une retenue, N vaut E + 1.',
      'Avec les chiffres qui restent, une seule suite tient : SEND = 9567, MORE = 1085.',
    ],
    essais: 3, mots: ['SEND', 'MORE'], somme: 'MONEY',
  })
  P.fiche({
    id: 'cryptarithme-puits', moule: 'cryptarithme', niveau: 2, tiree: false,
    titre: 'Deux huit font le puits',
    source: SOURCE_PROGRAMME,
    recit: ['Un nombre de quatre chiffres, écrit en lettres : HUIT. Deux fois le même, et voilà mon puits.', 'Dis-moi ce que vaut chaque lettre.'],
    regle: REGLE,
    explication: [
      'PUITS a un chiffre de plus que HUIT : P est une retenue, donc P vaut 1.',
      'H + H doit franchir la dizaine : H vaut au moins 5.',
      'T + T donne S : S est un chiffre pair.',
      'Colonne après colonne, une seule suite tient : HUIT = 6249.',
    ],
    essais: 3, mots: ['HUIT', 'HUIT'], somme: 'PUITS',
  })
  P.fiche({
    id: 'cryptarithme-hiver', moule: 'cryptarithme', niveau: 3, tiree: false,
    titre: 'Deux seize font l’hiver',
    source: SOURCE_PROGRAMME,
    recit: ['SEIZE et SEIZE ne font pas trente-deux : ils font HIVER, et le froid s’en mêle.', 'Dis-moi ce que vaut chaque lettre.'],
    regle: REGLE,
    explication: [
      'HIVER n’a pas plus de lettres que SEIZE : pas de retenue en tête, donc S + S reste sous 10 et S vaut 4 au plus.',
      'E + E donne R : R est un chiffre pair.',
      'E + E donne R, puis Z + Z (et une retenue) donne E : les colonnes se répondent. En les suivant, une seule suite tient : SEIZE = 32512.',
    ],
    essais: 3, mots: ['SEIZE', 'SEIZE'], somme: 'HIVER',
  })
  P.fiche({
    id: 'cryptarithme-sphinx', moule: 'cryptarithme', niveau: 4, tiree: false,
    titre: 'Mille et mille font un Sphinx',
    source: SOURCE_PROGRAMME,
    recit: ['MILLE et MILLE, additionnés, donnent mon nom : SPHINX.', 'Neuf lettres, neuf chiffres, et pas un de trop.', 'Dis-moi ce que vaut chaque lettre.'],
    regle: REGLE,
    explication: [
      'SPHINX a une lettre de plus que MILLE : S est une retenue, donc S vaut 1.',
      'En tête, M + M (et une retenue) donne 10 + P : M vaut au moins 5.',
      'E + E donne X : X est un chiffre pair.',
      'Colonne après colonne, une seule suite tient : MILLE = 53664.',
    ],
    essais: 3, mots: ['MILLE', 'MILLE'], somme: 'SPHINX',
  })
}

'use strict'
/* Les carrés magiques : ranger des nombres dans une grille pour que chaque
   ligne, chaque colonne et les deux diagonales fassent la même somme. Le plus
   vieux a plus de deux mille ans — le Lo Shu, que la légende chinoise grave sur
   une tortue —, Dürer en glisse un dans sa Melencolia en 1514, et Dudeney leur
   donne un chapitre entier.

   Une fiche donne : `cote`, `somme`, `nombres` (la réserve), `donnes` (les
   cases déjà posées : `{ 4: 5 }` met un 5 dans la case 4, comptée ligne après
   ligne), `demis` (la réserve prête aussi chaque nombre augmenté d'une moitié)
   et `doute` (le plateau offre « C'est impossible » — qui ne l'est jamais ici). */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.carre = ['#########', '#...#...#', '#...#...#', '#...#...#', '#########', '#...#...#', '#...#...#', '#...#...#', '#########']

  P.style(`
.cm { display: grid; justify-items: center; gap: 8px; }
.cm-grille { display: grid; grid-template-columns: repeat(var(--n), var(--c)) 44px; gap: 4px; align-items: center; justify-items: center; }
.cm-case { width: var(--c); height: var(--c); padding: 0; display: grid; place-items: center; border: 1px solid rgba(217, 181, 106, 0.45); border-radius: 8px; background: rgba(0, 0, 0, 0.3); color: var(--ink); font: 600 22px/1 var(--f-pixel); font-variant-numeric: tabular-nums; touch-action: manipulation; }
.cm-case.vide.attend { border-style: dashed; border-color: var(--or-clair); }
.cm-case.donnee { background: linear-gradient(180deg, #4a3a22, #3a2c1a); border-color: var(--or); color: var(--or-clair); cursor: default; }
.cm-case[disabled] { cursor: default; }
.cm-somme { min-width: 34px; text-align: center; font: 600 14px/1.2 var(--f-pixel); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cm-somme.juste { color: var(--or-clair); text-shadow: 0 0 8px rgba(var(--sable), 0.6); }
.cm-somme.fausse { color: var(--faux); }
.cm-somme.biais { height: 18px; grid-column: -2; }
.cm-reserve { display: flex; gap: 3px; width: 100%; justify-content: center; }
.cm-jeton { flex: 0 1 34px; min-width: 0; height: 40px; padding: 0; border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 8px; background: var(--pierre); color: var(--ink); font: 600 15px/1 var(--f-pixel); touch-action: manipulation; }
.cm-jeton.choisi { background: var(--or); border-color: var(--or-clair); color: #1a1412; box-shadow: 0 0 12px rgba(var(--sable), 0.5); }
.cm-jeton[disabled] { opacity: 0.25; cursor: default; }
.cm-jeton.demi { margin-left: 5px; border-style: dashed; color: var(--or-clair); }
.cm-jeton.demi[aria-pressed="true"] { border-style: solid; background: rgba(217, 181, 106, 0.25); }
.cm .lien { min-height: 36px; }
`)

  const ecrit = x => (Number.isInteger(x) ? String(x) : (Math.floor(x) || '') + '½')
  // Lignes, colonnes, puis les deux diagonales : celle qui descend, celle qui monte.
  const alignements = n => {
    const k = [...Array(n).keys()]
    return [...k.map(r => k.map(c => r * n + c)), ...k.map(c => k.map(r => r * n + c)), k.map(i => i * n + i), k.map(i => (n - 1 - i) * n + i)]
  }
  const donnee = (f, i) => f.donnes != null && f.donnes[i] != null
  // Un nombre s'offre s'il est de la réserve — entier, ou avec sa moitié quand la fiche en prête — et pas déjà dans la grille.
  const offert = (f, e, x) => (Number.isInteger(x) ? f.nombres.includes(x) : !!f.demis && f.nombres.includes(x - 0.5)) && !e.g.includes(x)
  const grille = f => [...Array(f.cote * f.cote).keys()].map(i => (donnee(f, i) ? f.donnes[i] : null))

  /* Toutes les façons de finir la grille. Une case qui ferme un alignement n'a
     plus le choix : c'est ce qui tient le compte court, même quand la réserve
     prête dix-huit nombres pour huit cases. */
  function remplir(f, demis) {
    const lignes = alignements(f.cote)
    const g = grille(f)
    const reserve = [...f.nombres, ...(demis ? f.nombres.map(x => x + 0.5) : [])].filter(x => !g.includes(x))
    const vides = g.flatMap((x, i) => (x == null ? [i] : []))
    let total = 0, solution = null
    const descend = k => {
      if (k === vides.length) { total++; solution = solution || vides.map(i => ({ met: [i, g[i]] })); return }
      const i = vides[k]
      let force = null
      for (const l of lignes) {
        if (!l.includes(i) || l.some(j => j !== i && g[j] == null)) continue
        const faut = f.somme - l.reduce((s, j) => s + (g[j] || 0), 0)
        if (force !== null && force !== faut) return
        force = faut
      }
      for (const x of force !== null ? [force] : reserve) {
        if (!reserve.includes(x) || g.includes(x)) continue
        g[i] = x
        descend(k + 1)
        g[i] = null
      }
    }
    descend(0)
    return { n: total, solution, cases: vides.length }
  }

  P.moule({
    cle: 'carre',
    nom: 'Les carrés magiques',
    socle: 'pose',
    glyphe: 'carre',
    unite: ['pose', 'poses'],
    // `main` : le nombre pris dans la réserve, en attente d'une case. `demi` : la réserve montre ses moitiés.
    depart: f => ({ g: grille(f), main: null, demi: false }),
    // Prendre, vider, tourner la réserve : des gestes d'écran. Seul un nombre posé compte.
    compte: coup => coup.met !== undefined,
    jauge: (f, e) => { const n = e.g.filter((x, i) => x != null && !donnee(f, i)).length; return `${n} ${n > 1 ? 'nombres' : 'nombre'} sur ${e.g.filter((_, i) => !donnee(f, i)).length}` },
    coups(f, e) {
      const reserve = [...f.nombres, ...(f.demis ? f.nombres.map(x => x + 0.5) : [])].filter(x => offert(f, e, x))
      return e.g.flatMap((x, i) => (x == null ? reserve.map(v => ({ met: [i, v] })) : donnee(f, i) ? [] : [{ vide: i }]))
    },
    jouer(f, e, coup) {
      if (coup.impossible) return { refus: f.pourtant || 'Si, c’est possible.' }
      if (coup.demi !== undefined) return f.demis ? { etat: { ...e, demi: !!coup.demi, main: null } } : { refus: 'Ici, tous les nombres sont entiers.' }
      if (coup.prend !== undefined) {
        if (coup.prend !== null && !offert(f, e, coup.prend)) return { refus: 'Ce nombre est déjà posé.' }
        return { etat: { ...e, main: coup.prend } }
      }
      if (coup.vide !== undefined) {
        if (donnee(f, coup.vide)) return { refus: 'Celui-là, c’est moi qui l’ai posé.' }
        if (e.g[coup.vide] == null) return { refus: 'Cette case est déjà vide.' }
        return { etat: { ...e, g: e.g.map((x, i) => (i === coup.vide ? null : x)) } }
      }
      const [ou, x] = coup.met
      if (e.g[ou] != null) return { refus: 'Cette case est prise : touche-la pour la vider.' }
      if (!offert(f, e, x)) return { refus: 'Ce nombre n’est plus dans la réserve.' }
      return { etat: { ...e, g: e.g.map((v, i) => (i === ou ? x : v)), main: null } }
    },
    fini: (f, e) => (e.g.every(x => x != null) && alignements(f.cote).every(l => l.reduce((s, i) => s + e.g[i], 0) === f.somme) ? { gagne: true } : null),
    verifier(f) {
      const r = remplir(f, !!f.demis)
      if (!r.n) return { ok: false, note: 'aucune solution' }
      // Une fiche à moitiés tient par son astuce : si des entiers suffisaient, elle n'aurait plus de secret.
      if (f.demis && remplir(f, false).n) return { ok: false, note: 'elle se résout sans une seule moitié' }
      return { ok: true, coups: r.cases, solution: r.solution, note: P.pluriel(r.n, 'solution') + (f.demis ? ', aucune sans moitié' : '') }
    },
    dessiner({ f, e, agir, dire, fige }) {
      const n = f.cote
      const lignes = alignements(n)
      // Trois lignes de 50 pixels laissent la place à la réserve et au doute ; quatre tiennent à 46.
      const cote = n > 3 ? 46 : 50
      const somme = (l, nom, fleche) => {
        const v = l.map(i => e.g[i])
        const s = v.reduce((a, x) => a + (x || 0), 0)
        const pleine = v.every(x => x != null)
        return h('span', {
          class: `cm-somme ${pleine ? (s === f.somme ? 'juste' : 'fausse') : ''} ${fleche ? 'biais' : ''}`,
          role: 'img', 'aria-label': `${nom} : ${v.some(x => x != null) ? ecrit(s) : 'rien'}${pleine ? '' : ', à finir'}`,
        }, (fleche || '') + (v.some(x => x != null) ? ecrit(s) : '·'))
      }
      const une = i => {
        const x = e.g[i]
        const nom = `Ligne ${Math.floor(i / n) + 1}, colonne ${i % n + 1}`
        if (donnee(f, i)) return h('span', { class: 'cm-case donnee', role: 'img', 'aria-label': `${nom} : ${ecrit(x)}, posé par le Sphinx` }, ecrit(x))
        return h('button', {
          type: 'button', disabled: fige,
          class: `cm-case ${x == null ? 'vide' : ''} ${x == null && e.main !== null ? 'attend' : ''}`,
          'aria-label': `${nom} : ${x == null ? 'vide' : ecrit(x)}`,
          onclick: () => {
            if (x != null) return agir({ vide: i })
            if (e.main === null) return dire('Touche d’abord un nombre de la réserve.')
            agir({ met: [i, e.main] })
          },
        }, x == null ? '' : ecrit(x))
      }
      const k = [...Array(n).keys()]
      const reserve = f.nombres.filter(x => !Object.values(f.donnes || {}).includes(e.demi ? x + 0.5 : x)).map(x => (e.demi ? x + 0.5 : x))
      return h('div', { class: 'cm' },
        h('div', { class: 'cm-grille', style: `--n:${n};--c:${cote}px`, role: 'group', 'aria-label': `Un carré de ${n} cases de côté : chaque alignement doit faire ${f.somme}` },
          // La diagonale qui monte finit en haut à droite : sa somme l'y attend, au-dessus de celles des lignes.
          somme(lignes[2 * n + 1], 'La diagonale qui monte', '↗︎ '),
          k.flatMap(r => [...k.map(c => une(r * n + c)), somme(lignes[r], `Ligne ${r + 1}`)]),
          k.map(c => somme(lignes[n + c], `Colonne ${c + 1}`)),
          somme(lignes[2 * n], 'La diagonale qui descend', '↘︎ ')),
        h('div', { class: 'cm-reserve', role: 'group', 'aria-label': 'La réserve' },
          reserve.map(x => h('button', {
            type: 'button', class: `cm-jeton ${e.main === x ? 'choisi' : ''}`, disabled: fige || e.g.includes(x),
            'aria-pressed': e.main === x ? 'true' : 'false', 'aria-label': `Le ${ecrit(x)}`,
            onclick: () => agir({ prend: e.main === x ? null : x }),
          }, ecrit(x))),
          f.demis && h('button', {
            type: 'button', class: 'cm-jeton demi', disabled: fige, 'aria-pressed': e.demi ? 'true' : 'false', 'aria-label': 'Ajouter une moitié à chaque nombre de la réserve',
            onclick: () => agir({ demi: !e.demi }),
          }, '+½')),
        f.doute && h('button', { type: 'button', class: 'lien', disabled: fige, onclick: () => agir({ impossible: true }) }, 'C’est impossible'))
    },
  })

  /* ---------------------------------------------------------------- */

  P.fiche({
    id: 'carre-tortue', moule: 'carre', niveau: 2,
    titre: 'Le carré de la tortue',
    source: 'Le Lo Shu, Chine, avant notre ère : le carré de la rivière Lo, que la légende dit gravé sur le dos d’une tortue',
    recit: [
      'La légende chinoise dit qu’une tortue sortit un jour de la rivière Lo.',
      'Son dos portait les nombres de 1 à 9, rangés en carré : chaque ligne, chaque colonne, chaque diagonale y faisait 15.',
      'Le 5 est au centre. Retrouve la place des huit autres.',
    ],
    regle: 'Touche un nombre, puis une case. Tout doit faire 15 : lignes, colonnes, diagonales.',
    cote: 3, somme: 15, nombres: [1, 2, 3, 4, 5, 6, 7, 8, 9], donnes: { 4: 5 },
  })

  P.fiche({
    id: 'huit-obstine', moule: 'carre', niveau: 3,
    titre: 'Le huit obstiné',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 399 (« The Troublesome Eight »), 1917',
    recit: [
      'Mettre un nombre différent dans chacune des neuf cases, pour que tout fasse 15 : tu sais faire.',
      'Mais au premier essai, le 8 tombe toujours dans un coin.',
      'Cette fois, je le pose moi-même : en haut, au milieu. À toi les huit autres.',
    ],
    regle: 'Un nombre différent par case. Tout doit faire 15 : lignes, colonnes, diagonales.',
    cote: 3, somme: 15, nombres: [1, 2, 3, 4, 5, 6, 7, 8, 9], donnes: { 1: 8 },
    // Le doute est le piège de Dudeney : qui s'en tient aux entiers croit l'énigme impossible.
    demis: true, doute: true, pourtant: 'Si, c’est possible. Relis bien ce que j’ai demandé.',
    explication: [
      'Avec les entiers de 1 à 9, le 8 ne tient que dans un coin.',
      'Mais j’ai dit « un nombre différent », jamais « un nombre entier » : un nombre peut porter une moitié.',
      'Dudeney écrit 4½, 8, 2½ en haut, puis 3, 5, 7, puis 7½, 2, 5½.',
    ],
  })

  P.fiche({
    id: 'carre-durer', moule: 'carre', niveau: 4,
    titre: 'Le carré de Dürer',
    source: 'Albrecht Dürer, Melencolia I, gravure, 1514',
    recit: [
      'En 1514, Albrecht Dürer grave un carré de nombres dans un coin de sa Melencolia : les nombres de 1 à 16.',
      'Lignes, colonnes, diagonales : tout y fait 34.',
      'Il y a caché l’année : 15 et 14 se suivent au milieu de la dernière ligne.',
      'J’ai effacé la moitié des cases. Remets-les.',
    ],
    regle: 'Touche un nombre, puis une case. Tout doit faire 34 : lignes, colonnes, diagonales.',
    // Huit cases données, dont la ligne de la date : le programme compte une seule façon de finir.
    cote: 4, somme: 34, nombres: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    donnes: { 0: 16, 3: 13, 9: 6, 10: 7, 12: 4, 13: 15, 14: 14, 15: 1 },
  })
}

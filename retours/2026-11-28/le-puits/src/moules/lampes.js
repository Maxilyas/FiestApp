'use strict'
/* Les lampes : toucher une lampe la bascule, et ses voisines du dessus, du
   dessous, de gauche et de droite avec elle ; il faut les allumer toutes.
   C'est Lights Out, le jouet de Tiger Electronics (1995) — lui les éteint,
   ici on les rallume, la règle est la même. L'ordre des touches n'y change
   rien, et toucher deux fois la même lampe ne fait rien : une solution n'est
   jamais qu'un choix de lampes, chacune touchée une fois.

   Une fiche donne `cote`, le côté de la grille, et `lampes`, la grille au
   départ, ligne après ligne : « 1 » pour une lampe allumée, « 0 » pour une
   éteinte.

   Aucune fiche n'est écrite à la main : le moule les tire. Il part de tout
   allumé et touche quelques lampes — ce qu'on a défait ainsi se refait
   toujours, alors qu'une grille de seize lampes prise au hasard n'a de
   solution qu'une fois sur seize. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.lampe = ['....#....', '.#.....#.', '...###...', '..#####..', '#.#####.#', '..#####..', '...###...', '.#.....#.', '....#....']

  P.style(`
.la { display: grid; gap: 8px; max-width: 300px; margin: 0 auto; }
.la-lampe { aspect-ratio: 1; min-width: 0; padding: 0; display: grid; place-items: center; border: 1px solid rgba(217, 181, 106, 0.22); border-radius: 12px; background: linear-gradient(180deg, var(--pierre), var(--pierre-sombre)); box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.55); color: rgba(243, 236, 226, 0.13); }
.la-lampe.allumee { border-color: var(--or-clair); background: radial-gradient(circle at 50% 42%, #fff4d6, var(--or-clair) 38%, var(--or) 82%); box-shadow: 0 0 16px rgba(var(--sable), 0.55), inset 0 -4px 0 rgba(0, 0, 0, 0.16); color: rgba(26, 20, 18, 0.5); }
.la-lampe[disabled] { cursor: default; }
.la-lampe.bascule { animation: la-bascule 0.28s ease-out 1; }
@keyframes la-bascule { from { scale: 0.86; } }
`)

  // Ce que bascule chaque lampe d'une grille : elle-même et ses voisines, en un masque de bits.
  const CROIX = {}
  const croix = n => CROIX[n] || (CROIX[n] = Array.from({ length: n * n }, (_, i) => {
    const x = i % n
    return [i, i - n, i + n, x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1].reduce((m, j) => (j >= 0 && j < n * n ? m | 1 << j : m), 0)
  }))
  const tout = n => 2 ** (n * n) - 1

  // À combien de touches de « tout allumé » est chaque grille qu'on peut en tirer : un parcours en largeur
  // parti du but, une fois par taille — 512 grilles pour neuf lampes, 4 096 pour seize.
  const LOIN = {}
  function loin(n) {
    if (LOIN[n]) return LOIN[n]
    const d = (LOIN[n] = new Map([[tout(n), 0]]))
    for (let bord = [tout(n)], k = 1; bord.length; k++) {
      const suivant = []
      for (const m of bord) for (const c of croix(n)) if (!d.has(m ^ c)) { d.set(m ^ c, k); suivant.push(m ^ c) }
      bord = suivant
    }
    return d
  }

  const NOMBRES = { 3: 'Neuf', 4: 'Seize' }

  const moule = P.moule({
    cle: 'lampes',
    nom: 'Les lampes',
    socle: 'chemin',
    glyphe: 'lampe',
    unite: ['touche', 'touches'],
    // `touche` ne sert qu'à l'écran — quelles lampes viennent de basculer — : le masque seul fait l'état.
    depart: f => ({ m: [...f.lampes].reduce((m, c, i) => (c === '1' ? m | 1 << i : m), 0), touche: null }),
    signature: e => e.m,
    coups: f => croix(f.cote).map((_, i) => ({ touche: i })),
    jouer(f, e, coup) {
      const c = croix(f.cote)[coup.touche]
      return c ? { etat: { m: e.m ^ c, touche: coup.touche } } : { refus: 'Il n’y a pas de lampe là.' }
    },
    fini: (f, e) => (e.m === tout(f.cote) ? { gagne: true } : null),
    dessiner({ f, e, agir, fige }) {
      const n = f.cote
      const bascule = e.touche === null ? 0 : croix(n)[e.touche]
      return h('div', { class: 'la', style: `grid-template-columns:repeat(${n},minmax(0,1fr))` },
        croix(n).map((_, i) => {
          const allumee = e.m >> i & 1
          return h('button', {
            type: 'button', class: `la-lampe ${allumee ? 'allumee' : ''} ${bascule >> i & 1 ? 'bascule' : ''}`, disabled: fige,
            'aria-label': `Lampe, rangée ${Math.floor(i / n) + 1}, colonne ${i % n + 1} : ${allumee ? 'allumée' : 'éteinte'}`,
            onclick: () => agir({ touche: i }),
            html: P.glyphe('lampe', n > 3 ? 30 : 40),
          })
        }))
    },
    // Neuf lampes aux trois premiers niveaux, seize ensuite ; partout, une touche de plus par niveau.
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const [n, voulu] = [[3, 2], [3, 3], [3, 4], [4, 5], [4, 6]][Math.min(4, Math.max(0, niveau - 1))]
      const lampes = croix(n).map((_, i) => i)
      // À seize lampes, plusieurs choix de touches font la même grille : six lampes touchées n'en demandent
      // parfois que quatre. On retire tant que le plus court n'est pas celui qu'on veut — au pire, un tirage sur trois convient.
      let m
      do {
        m = P.melanger(alea, lampes).slice(0, voulu).reduce((g, i) => g ^ croix(n)[i], tout(n))
      } while (loin(n).get(m) !== voulu)
      const grille = lampes.map(i => m >> i & 1).join('')
      return {
        id: `lampes-${n}-${grille}`, moule: 'lampes', niveau, tiree: true,
        titre: `${NOMBRES[n]} lampes, ${P.pluriel(grille.split('0').length - 1, 'éteinte')}`,
        source: 'Tirée par le programme, sur le modèle du jeu Lights Out, 1995',
        recit: [
          `${NOMBRES[n]} lampes dans la pierre, et quelques-unes se sont éteintes.`,
          'Touche une lampe : éteinte, elle s’allume ; allumée, elle s’éteint. Et ses voisines en font autant : celles du dessus, du dessous, de gauche et de droite.',
          'Rallume-les toutes.',
        ],
        regle: 'Toucher une lampe la bascule, et ses voisines aussi. Allume-les toutes.',
        cote: n, lampes: grille,
      }
    },
  })

  /* ---------------------------------------------------------------- */

  // Deux tirages gardés tels quels, pour que la liste en montre : une grille de neuf, une de seize.
  const garder = (id, graine, niveau) => {
    const { tiree, ...f } = moule.tirer(graine, niveau)
    P.fiche({ ...f, id })
  }
  garder('lampes-a', 2, 2)
  garder('lampes-b', 4, 4)
}

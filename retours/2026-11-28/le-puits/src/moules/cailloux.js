'use strict'
/* Les cailloux : un duel. Un tas impair, on en prend un, deux ou trois chacun
   son tour, et quand le tas est vide c'est celui qui en tient un nombre impair
   qui gagne — pas celui qui a pris le dernier. Dudeney y jouait sur une plage
   (Amusements in Mathematics, n° 392, 1917) : avec quinze cailloux, qui commence
   gagne en en prenant deux ; avec cinq, treize, vingt et un, il perd toujours.
   Le Sphinx ne compte pas mieux que lui : il a lu toutes les fins de partie.

   Une fiche donne `cailloux`, le nombre de cailloux — impair, sinon personne ou
   tout le monde gagnerait. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.cailloux = ['.........', '....##...', '...####..', '....##...', '.##...##.', '####.####', '####.####', '.##...##.', '.........']

  P.style(`
.ca { display: grid; gap: 8px; }
.ca-main { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 46px; padding: 5px 10px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(217, 181, 106, 0.28); border-radius: 10px; }
.ca-main.au-trait { border-color: var(--or); }
.ca-qui { font: 600 13px/1.15 var(--f-texte); color: var(--ink); }
.ca-qui small { display: block; min-width: 68px; font-weight: 500; font-size: 10.5px; color: var(--muted); white-space: nowrap; }
.ca-pris { display: flex; flex-wrap: wrap; gap: 3px; }
.ca-pris i { width: 10px; height: 9px; border-radius: 50% 44% 52% 46%; background: #a89b8a; }
.ca-main.lui .ca-pris i { background: var(--lapis); }
.ca-main.moi .ca-pris i { background: var(--or); }
.ca-tient { text-align: right; font-size: 11px; line-height: 1.2; color: var(--muted); }
.ca-tient b { display: block; font: 600 20px/1 var(--f-pixel); color: var(--ink); font-variant-numeric: tabular-nums; }
.ca-tient.impair { color: var(--or-clair); }
.ca-tas { min-height: 92px; padding: 8px 4px; display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 7px 8px; }
.ca-tas i { width: 30px; height: 25px; border-radius: 52% 46% 50% 44% / 58% 52% 46% 44%; background: linear-gradient(160deg, #c9bca8, #7d7064); box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.28), 0 3px 4px rgba(0, 0, 0, 0.35); }
.ca-tas i:nth-child(3n) { border-radius: 46% 54% 44% 52% / 50% 46% 56% 48%; rotate: -8deg; }
.ca-tas i:nth-child(4n + 1) { width: 27px; rotate: 6deg; }
.ca-reste { margin: 0; text-align: center; font-size: 12.5px; color: var(--muted); }
.ca-reste b { color: var(--or-clair); font-weight: 600; }
.ca-prises { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.ca-prises .bouton { padding: 0 4px; font-size: 14px; }
`)

  // Le tas est impair : à la fin, un seul des deux tient un nombre impair. `gagne(n, r, p)` dit si celui
  // qui doit jouer, qui tient un nombre de parité p devant r cailloux, finira impair quoi que fasse l'autre.
  const FINS = new Map()
  function gagne(n, r, p) {
    if (!r) return p === 1
    const cle = `${n & 1},${r},${p}`
    if (!FINS.has(cle)) {
      // Ce que tient l'autre se déduit : tout ce qui n'est ni au tas ni chez moi est chez lui.
      const autre = (n - r - p) & 1
      FINS.set(cle, [1, 2, 3].some(t => t <= r && !gagne(n, r - t, autre)))
    }
    return FINS.get(cle)
  }
  // Les prises après lesquelles l'adversaire, quoi qu'il fasse, finira pair.
  const prisesGagnantes = (n, r, adversaire) => [1, 2, 3].filter(t => t <= r && !gagne(n, r - t, adversaire & 1))

  P.moule({
    cle: 'cailloux',
    nom: 'Les cailloux',
    socle: 'duel',
    glyphe: 'cailloux',
    unite: ['partie', 'parties'],
    depart: f => ({ reste: f.cailloux, moi: 0, lui: 0, aMoi: true, dernier: 0 }),
    coups: (f, e) => [1, 2, 3].filter(t => t <= e.reste).map(t => ({ prend: t })),
    jouer(f, e, coup) {
      const t = coup.prend
      if (![1, 2, 3].includes(t)) return { refus: 'Un, deux ou trois cailloux : rien d’autre.' }
      if (t > e.reste) return { refus: e.reste > 1 ? `Il n’en reste que ${e.reste}.` : 'Il n’en reste qu’un.' }
      // La maquette attend ma riposte une demi-seconde : un doigt pressé ne joue pas deux fois de suite.
      if (!coup.lui && !e.aMoi) return { refus: 'Attends : c’est à moi de prendre.' }
      return { etat: { reste: e.reste - t, moi: e.moi + (coup.lui ? 0 : t), lui: e.lui + (coup.lui ? t : 0), aMoi: !!coup.lui, dernier: coup.lui ? t : 0 } }
    },
    fini: (f, e) => (e.reste ? null : e.moi % 2 ? { gagne: true } : { perdu: `Tu en tiens ${e.moi} : c’est pair. L’impair est dans ma patte.` }),
    riposte(f, e) {
      const bonnes = prisesGagnantes(f.cailloux, e.reste, e.moi)
      const parmi = bonnes.length ? bonnes : [1, 2, 3].filter(t => t <= e.reste)
      return { prend: parmi[Math.floor(Math.random() * parmi.length)], lui: true }
    },
    // Un duel n'a pas de plus court chemin : ce qu'on vérifie, c'est que celui qui commence peut finir impair.
    verifier(f) {
      if (f.cailloux % 2 === 0) return { ok: false, note: 'il faut un nombre impair de cailloux' }
      return gagne(f.cailloux, f.cailloux, 0) ? { ok: true, note: 'qui commence peut gagner' } : { ok: false, note: 'qui commence perd toujours' }
    },
    dessiner({ f, e, agir, fige }) {
      const main = (classe, nom, sous, tient, auTrait) => h('div', { class: `ca-main ${classe} ${auTrait ? 'au-trait' : ''}` },
        h('span', { class: 'ca-qui' }, nom, h('small', null, sous)),
        h('span', { class: 'ca-pris', 'aria-hidden': 'true' }, Array.from({ length: tient }, () => h('i'))),
        h('span', { class: `ca-tient ${tient % 2 ? 'impair' : ''}` }, h('b', null, String(tient)), tient % 2 ? 'impair' : 'pair'))
      const fin = !e.reste
      return h('div', { class: 'ca' },
        main('lui', 'Le Sphinx', e.dernier ? `vient d’en prendre ${e.dernier}` : fin || e.aMoi ? 'attend' : 'réfléchit…', e.lui, !fin && !e.aMoi),
        h('div', { class: 'ca-tas', role: 'img', 'aria-label': e.reste ? `Le tas : ${P.pluriel(e.reste, 'caillou', 'cailloux')}` : 'Le tas est vide' }, Array.from({ length: e.reste }, () => h('i'))),
        h('p', { class: 'ca-reste' }, e.reste ? h('b', null, e.reste > 1 ? `Il en reste ${e.reste}.` : 'Il n’en reste qu’un.') : h('b', null, 'Le tas est vide.'), ' À la fin, qui tient l’impair gagne.'),
        main('moi', 'Toi', fin ? 'le tas est vide' : e.aMoi ? 'à toi de prendre' : 'tu attends', e.moi, !fin && e.aMoi),
        h('div', { class: 'ca-prises' }, [1, 2, 3].map(t => h('button', {
          type: 'button', class: 'bouton', disabled: fige || !e.aMoi || t > e.reste, onclick: () => agir({ prend: t }),
        }, `En prendre ${t}`))))
    },
  })

  /* ---------------------------------------------------------------- */

  const MOTS = ['', 'un seul', 'deux', 'trois']
  // La règle de Dudeney, que le calcul retrouve : huit cailloux de plus ne changent rien à la partie.
  const fiche = (cailloux, niveau, titre, recit) => P.fiche({
    id: 'cailloux-' + cailloux, moule: 'cailloux', niveau, titre,
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 392, « The Pebble Game », 1917',
    recit: [...recit, 'Chacun son tour, on en prend un, deux ou trois.', 'Quand il n’en reste plus, celui qui en tient un nombre impair a gagné. Tu commences.'],
    regle: 'Un, deux ou trois par tour. À la fin, qui en tient un nombre impair gagne.',
    cailloux,
    explication: [
      `Commence par en prendre ${MOTS[prisesGagnantes(cailloux, cailloux, 0)[0]]}. Ensuite, après chacun de tes coups, compte ce que tu tiens.`,
      'Un nombre pair ? Laisse-moi 4, 5, 12 ou 13 cailloux. Un nombre impair ? Laisse-m’en 1, 8 ou 9.',
      'Tu le peux à chaque tour — et le tas se vide en te laissant l’impair.',
    ],
  })
  fiche(7, 2, 'Les sept cailloux', ['Sept cailloux entre nous deux.'])
  fiche(11, 3, 'Les onze cailloux', ['Onze cailloux, cette fois.'])
  fiche(15, 4, 'Le jeu des cailloux', ['Quinze cailloux sur le sable, comme sur la plage où ce jeu s’est joué.'])
}

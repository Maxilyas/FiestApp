'use strict'
/* Les menteurs : quelqu'un a fait quelque chose, chacun parle, et une loi dit
   comment ils mentent — « chacun dit une vérité et un mensonge », « un seul dit
   vrai », « un seul ment ». Dudeney en sème dans ses recueils, Smullyan en fait
   des livres entiers (Quel est le titre de ce livre ?, 1978). On ne les résout
   pas en écoutant : on suppose chacun coupable, tour à tour, et on regarde la
   loi craquer.

   Une fiche donne : `gens` (les prénoms), `loi` (`mixte`, `un-vrai`, `un-ment`),
   `paroles` — pour chacun, ce qu'il dit : `{ nie: i }` (« Ce n'est pas i », ou
   « pas moi »), `{ accuse: i }`, `{ ment: i }` —, `question`, et `coupable`.
   On accuse d'un toucher : `essais` vaut 1, à trois ou quatre suspects un
   second essai serait déjà la réponse. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.masque = ['.........', '.#######.', '#.......#', '#.##.##.#', '#.......#', '#..###..#', '.#.....#.', '..#####..', '.........']

  P.style(`
.me { display: grid; gap: 7px; }
.me-loi { margin: 0; text-align: center; font: 600 13px/1.3 var(--f-texte); color: var(--or-clair); }
.me-loi span { display: block; font-weight: 500; font-size: 12px; color: var(--muted); }
.me-qui { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 10px; min-height: 52px; padding: 7px 10px; text-align: left; background: linear-gradient(180deg, var(--pierre), var(--boite)); border: 1px solid rgba(217, 181, 106, 0.38); border-radius: 10px; }
.me-qui:active { translate: 0 1px; }
.me-qui b { font: 600 18px/1.1 var(--f-titre); color: var(--or-clair); }
.me-qui span { display: grid; gap: 2px; font: 500 13.5px/1.3 var(--f-texte); color: var(--ink); }
.me-qui[disabled] { cursor: default; }
.me-qui.accuse { border-color: var(--or); box-shadow: 0 0 14px rgba(var(--sable), 0.4); }
.me-geste { margin: 0; text-align: center; font-size: 11.5px; color: var(--muted); }
`)

  const LOIS = {
    mixte: 'Chacun dit une vérité et un mensonge.',
    'un-vrai': 'Un seul dit vrai.',
    'un-ment': 'Un seul ment.',
  }
  const dite = (f, i, d) => (d.nie !== undefined ? (d.nie === i ? 'Ce n’est pas moi.' : `Ce n’est pas ${f.gens[d.nie]}.`) : d.accuse !== undefined ? `C’est ${f.gens[d.accuse]}.` : `${f.gens[d.ment]} ment.`)
  const liste = noms => (noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0])
  // Ce que vaut une phrase qui parle du coupable ; « X ment » se juge à part, sur ce que vaut X.
  const vraie = (d, c) => (d.nie !== undefined ? c !== d.nie : c === d.accuse)

  /* Tous les mondes sans contradiction, sous la loi : un coupable et, quand chacun n'a qu'une
     phrase, qui dit vrai. On essaie chaque partage des vérités plutôt que de suivre les « X ment »
     de proche en proche : deux qui s'accusent l'un l'autre de mentir font une boucle, et une
     fiche écrite à la main pourrait en porter une. */
  function mondes(f) {
    const n = f.gens.length
    const r = []
    for (let c = 0; c < n; c++) {
      if (f.loi === 'mixte') {
        if (f.paroles.every(p => p.length === 2 && p.every(d => d.ment === undefined) && vraie(p[0], c) !== vraie(p[1], c))) r.push({ c })
        continue
      }
      for (let m = 0; m < 1 << n; m++) {
        const vrai = i => !!((m >> i) & 1)
        const vrais = f.gens.filter((_, i) => vrai(i)).length
        if (vrais !== (f.loi === 'un-vrai' ? 1 : n - 1)) continue
        if (f.paroles.every((p, i) => vrai(i) === (p[0].ment !== undefined ? !vrai(p[0].ment) : vraie(p[0], c)))) r.push({ c, vrais: f.gens.map((_, i) => vrai(i)) })
      }
    }
    return r
  }
  // Qui dirait vrai si `c` était coupable — hors de toute loi : c'est ce qu'on raconte pour l'écarter.
  // Ne vaut que sans boucle : au tirage, « X ment » remonte toujours vers quelqu'un qui finit par parler du coupable.
  const verites = (f, c) => {
    const v = []
    const de = i => (v[i] ??= f.paroles[i][0].ment !== undefined ? !de(f.paroles[i][0].ment) : vraie(f.paroles[i][0], c))
    return f.gens.map((_, i) => de(i))
  }

  /* Une seule déclaration suffit-elle à conclure ? Alors il n'y a pas d'énigme, juste une lecture.
     Sous « une vérité et un mensonge », c'est quelqu'un dont les deux phrases ne laissent qu'un
     coupable (« pas moi », « c'est Ouni » : à trois, c'est forcément le troisième). Sous les deux
     autres lois, c'est une phrase dite deux fois : deux qui disent la même chose disent vrai si un
     seul ment, et faux si un seul dit vrai — on écarte donc toute redite. */
  function tropSimple(f) {
    const n = f.gens.length
    if (f.loi === 'mixte') return f.paroles.some(p => f.gens.filter((_, c) => vraie(p[0], c) !== vraie(p[1], c)).length === 1)
    const dits = f.paroles.map(p => JSON.stringify(p[0]))
    return new Set(dits).size < n
  }

  function expliquer(f) {
    const n = f.gens.length
    const lignes = []
    for (let c = 0; c < n; c++) {
      if (c === f.coupable) continue
      let suite
      if (f.loi === 'mixte') {
        const i = f.paroles.findIndex(p => vraie(p[0], c) === vraie(p[1], c))
        suite = vraie(f.paroles[i][0], c) ? `${f.gens[i]} dirait deux vérités.` : `${f.gens[i]} mentirait deux fois.`
      } else {
        const v = verites(f, c)
        const eux = f.gens.filter((_, i) => v[i] === (f.loi === 'un-vrai'))
        const verbe = f.loi === 'un-vrai' ? ['dirait vrai', 'diraient vrai'] : ['mentirait', 'mentiraient']
        suite = eux.length ? `${liste(eux)} ${verbe[1]} ensemble.` : `plus personne ne ${verbe[0]}.`
      }
      lignes.push(`Suppose ${f.gens[c]} coupable : ${suite} Impossible.`)
    }
    const v = f.loi === 'mixte' ? null : verites(f, f.coupable)
    const seul = v && f.gens[v.findIndex(x => x === (f.loi === 'un-vrai'))]
    lignes.push(`Reste ${f.gens[f.coupable]} : ${f.loi === 'mixte' ? 'chacun dit alors une vérité et un mensonge.' : `${seul} ${f.loi === 'un-vrai' ? 'dit vrai' : 'ment'}, et personne d’autre.`}`)
    return lignes
  }

  // Des prénoms de l'Égypte ancienne, jamais un nom de dieu : on n'accuse pas Thot d'avoir bu la bière.
  const NOMS = ['Khéti', 'Ouni', 'Néferet', 'Iry', 'Méryt', 'Hori']
  const MEFAITS = [
    { titre: 'Les figues du temple', fait: 'a mangé les figues du temple', question: 'Qui a mangé les figues ?' },
    { titre: 'La jarre brisée', fait: 'a brisé la jarre d’huile', question: 'Qui a brisé la jarre ?' },
    { titre: 'L’âne du meunier', fait: 'a détaché l’âne du meunier', question: 'Qui a détaché l’âne ?' },
    { titre: 'La bière du scribe', fait: 'a bu la bière du scribe', question: 'Qui a bu la bière ?' },
    { titre: 'La lampe du sanctuaire', fait: 'a soufflé la lampe du sanctuaire', question: 'Qui a soufflé la lampe ?' },
    { titre: 'Le miel de la reine', fait: 'a goûté au miel de la reine', question: 'Qui a goûté au miel ?' },
  ]
  // Ce que chaque profondeur ose : la loi, et combien de suspects disent « X ment » plutôt que de parler du coupable.
  const NIVEAUX = [
    [['un-ment', 0]],
    [['un-vrai', 0]],
    [['mixte', 0], ['un-vrai', 1], ['un-ment', 1]],
    [['mixte', 0], ['un-vrai', 0], ['un-ment', 0]],
    [['mixte', 0], ['un-vrai', 2], ['un-ment', 2]],
  ]

  const moule = P.moule({
    cle: 'menteurs',
    nom: 'Les menteurs',
    socle: 'preuve',
    glyphe: 'masque',
    unite: ['accusation', 'accusations'],
    depart: () => ({ accuse: null }),
    coups: f => f.gens.map((_, i) => ({ accuse: i })),
    jouer: (f, e, coup) => (e.accuse !== null ? { refus: 'Tu as déjà accusé.' } : { etat: { accuse: coup.accuse } }),
    fini: (f, e) => (e.accuse === null ? null : e.accuse === f.coupable ? { gagne: true } : { perdu: `Ce n’était pas ${f.gens[e.accuse]}.` }),
    // La preuve : on suppose chacun coupable, et un seul tient debout sous la loi.
    verifier(f) {
      if (!LOIS[f.loi]) return { ok: false, note: 'loi inconnue' }
      const coupables = [...new Set(mondes(f).map(m => m.c))]
      if (coupables.length !== 1) return { ok: false, note: coupables.length ? `${coupables.length} coupables possibles` : 'aucun coupable possible' }
      if (coupables[0] !== f.coupable) return { ok: false, note: `le coupable est ${f.gens[coupables[0]]}, pas celui de la fiche` }
      if (tropSimple(f)) return { ok: false, note: 'une seule déclaration suffit à conclure' }
      return { ok: true, coups: 1, solution: [{ accuse: f.coupable }], note: 'une seule réponse' }
    },
    dessiner({ f, e, agir, fige }) {
      return h('div', { class: 'me' },
        h('p', { class: 'me-loi' }, LOIS[f.loi], h('span', null, f.question)),
        f.gens.map((nom, i) => h('button', {
          type: 'button', class: `me-qui ${e.accuse === i ? 'accuse' : ''}`, disabled: fige || e.accuse !== null,
          'aria-label': `Accuser ${nom}, qui dit : ${f.paroles[i].map(d => dite(f, i, d)).join(' ')}`,
          onclick: () => agir({ accuse: i }),
        }, h('b', null, nom), h('span', null, f.paroles[i].map(d => h('span', null, `« ${dite(f, i, d)} »`))))),
        h('p', { class: 'me-geste' }, 'Touche qui tu accuses : tu n’as qu’un essai.'))
    },
    // On tire des déclarations jusqu'à ce qu'un seul coupable tienne debout — et qu'aucune ne le livre à elle seule.
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const rang = Math.min(5, Math.max(1, niveau))
      const n = rang <= 3 ? 3 : 4
      const [loi, ments] = P.parmi(alea, NIVEAUX[rang - 1])
      const gens = P.melanger(alea, NOMS).slice(0, n)
      const mefait = P.parmi(alea, MEFAITS)
      const autre = (...sauf) => P.parmi(alea, gens.map((_, i) => i).filter(i => !sauf.includes(i)))
      const parole = (i, sauf = []) => {
        const j = P.parmi(alea, gens.map((_, k) => k).filter(k => !sauf.includes(k)))
        return j === i || alea() < 0.5 ? { nie: j } : { accuse: j }
      }
      for (let essai = 0; essai < 5000; essai++) {
        let paroles
        if (loi === 'mixte') {
          // Deux phrases sur deux personnes : sur la même, elles ne diraient qu'une chose, ou se contrediraient.
          paroles = gens.map((_, i) => { const a = parole(i); return [a, parole(i, [a.nie ?? a.accuse])] })
        } else {
          paroles = gens.map((_, i) => [parole(i)])
          // « X ment » ne vise jamais quelqu'un qui l'a dit avant lui : pas de boucle, donc une seule lecture.
          // (Deux « X ment » sur deux suspects qui parlent du coupable ne tiennent sous aucune loi : il faut la chaîne.)
          const quiLeDit = P.melanger(alea, gens.map((_, i) => i)).slice(0, ments)
          quiLeDit.forEach((i, k) => { paroles[i] = [{ ment: autre(...quiLeDit.slice(0, k + 1)) }] })
        }
        const f = { gens, loi, paroles }
        const m = mondes(f)
        if (m.length !== 1 || tropSimple(f)) continue
        f.coupable = m[0].c
        return {
          id: `menteurs-${rang}-${graine}`, moule: 'menteurs', niveau: rang, tiree: true, essais: 1,
          titre: mefait.titre,
          source: 'Tirée par le programme, sur le modèle des énigmes de menteurs (Henry Dudeney ; Raymond Smullyan)',
          recit: [
            `Quelqu’un ${mefait.fait}.`,
            `Ils sont ${n === 3 ? 'trois' : 'quatre'} à s’en défendre, et je les ai tous entendus.`,
            loi === 'mixte' ? 'Mais chacun d’eux dit une vérité et un mensonge.' : loi === 'un-vrai' ? `Mais un seul des ${n === 3 ? 'trois' : 'quatre'} dit vrai.` : `Mais un seul des ${n === 3 ? 'trois' : 'quatre'} ment.`,
          ],
          regle: `${LOIS[loi]} Touche le coupable.`,
          question: mefait.question,
          ...f,
          explication: expliquer(f),
        }
      }
      throw new Error('aucun tirage ne donne un seul coupable')
    },
  })

  /* ---------------------------------------------------------------- */

  // Deux tirages gardés pour l'atelier : une loi par fiche, pour qu'on voie les deux façons de mentir.
  P.fiche({ ...moule.tirer(7, 2), id: 'menteurs-a', tiree: false })
  P.fiche({ ...moule.tirer(19, 4), id: 'menteurs-b', tiree: false })
}

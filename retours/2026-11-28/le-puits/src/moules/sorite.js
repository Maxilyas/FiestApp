'use strict'
/* Les sorites : des prémisses saugrenues, et la conclusion qu'il faut tirer de
   toutes ensemble. Lewis Carroll en a fait un jeu de société logique
   (Symbolic Logic, 1896) : « Les canards ne valsent pas ; un officier ne refuse
   jamais une valse ; toutes mes volailles sont des canards » — d'où il sort que
   mes volailles ne sont pas officiers. On ne devine pas : on enchaîne, chaque
   prémisse prenant le relais de la précédente, quitte à la lire à l'envers.

   Une fiche donne : `termes` (`cle`, `sujet` quand on peut parler de lui, `oui` le
   texte affirmé, `non` le texte nié), `premisses` (`texte` et `imp: [de, vers]`,
   chaque bout une clé, précédée de `!` pour sa négation), `sujets` et `dits` — les
   jetons offerts, dans l'ordre où on les montre —, et `conclusion: { sujet, dit }`.
   On répond d'un toucher : `essais` vaut 3, puisque la phrase composée se juge
   d'un coup, et qu'on peut recommencer avec une autre. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.sorite = ['.#######.', '.#.....#.', '.#######.', '....#....', '.#######.', '.#.....#.', '.#######.', '....#....', '...###...']

  P.style(`
.so { display: grid; gap: 5px; }
.so-ps { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
.so-ps li { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 6px; font: 500 12px/1.25 var(--f-texte); color: var(--ink); }
.so-ps b { font: 600 12px/1.3 var(--f-pixel); color: var(--or); }
.so-rang { display: flex; flex-wrap: wrap; gap: 4px; }
.so-j { flex: 1 1 auto; min-height: 40px; padding: 2px 7px; text-align: center; font: 500 12px/1.15 var(--f-texte); color: var(--ink); background: linear-gradient(180deg, var(--pierre), var(--boite)); border: 1px solid rgba(217, 181, 106, 0.38); border-radius: 10px; }
.so-j.dit { border-color: rgba(111, 151, 196, 0.55); }
.so-j:active { translate: 0 1px; }
.so-j.pris { background: var(--or); border-color: var(--or); color: #1a1412; font-weight: 700; }
.so-j[disabled] { cursor: default; }
.so-phrase { display: grid; place-items: center; min-height: 34px; margin: 0; padding: 3px 8px; text-align: center; font: 600 13.5px/1.25 var(--f-titre); color: var(--or-clair); border: 1px dashed rgba(217, 181, 106, 0.4); border-radius: 10px; }
.so-phrase.vide { font: 500 12px/1.3 var(--f-texte); color: var(--muted); }
`)

  const neg = l => (l[0] === '!' ? l.slice(1) : '!' + l)
  const cleDe = l => (l[0] === '!' ? l.slice(1) : l)
  const terme = (f, k) => f.termes.find(t => t.cle === k)
  const dit = (f, l) => (l[0] === '!' ? terme(f, l.slice(1)).non : terme(f, l).oui)
  const phrase = (f, e) => `${terme(f, e.sujet).sujet} ${dit(f, e.dit)}.`

  /* Ce qui découle des prémisses : on essaie tous les mondes possibles (un individu, chaque
     terme vrai ou faux) et on garde ceux qui respectent les implications. `sans` retire une
     prémisse : une paire qui tient encore sans elle n'a pas besoin d'elle. */
  function entraine(f, de, vers, sans = -1) {
    const cles = f.termes.map(t => t.cle)
    const prem = f.premisses.filter((_, i) => i !== sans)
    for (let m = 0; m < 1 << cles.length; m++) {
      const v = l => { const x = !!((m >> cles.indexOf(cleDe(l))) & 1); return l[0] === '!' ? !x : x }
      if (prem.every(p => !v(p.imp[0]) || v(p.imp[1])) && v(de) && !v(vers)) return false
    }
    return true
  }
  // Une paire gagne quand elle découle de toutes les prémisses ensemble — et d'aucune en moins.
  const usePourTout = (f, de, vers) => entraine(f, de, vers) && f.premisses.every((_, i) => !entraine(f, de, vers, i))

  /* La chaîne : chaque prémisse sert une fois, dans un sens ou dans l'autre (une implication
     et sa contraposée disent la même chose). C'est ce qu'écrit l'explication. */
  function chaine(f, de, vers) {
    const aretes = f.premisses.flatMap((p, i) => [{ p: i, de: p.imp[0], vers: p.imp[1] }, { p: i, de: neg(p.imp[1]), vers: neg(p.imp[0]) }])
    const suivre = (courant, pris, chemin) => {
      if (pris.size === f.premisses.length) return courant === vers ? chemin : null
      for (const a of aretes) {
        if (a.de !== courant || pris.has(a.p)) continue
        const r = suivre(a.vers, new Set([...pris, a.p]), [...chemin, a])
        if (r) return r
      }
      return null
    }
    return suivre(de, new Set(), [])
  }

  const moule = P.moule({
    cle: 'sorite',
    nom: 'Les sorites de Lewis Carroll',
    socle: 'preuve',
    glyphe: 'sorite',
    unite: ['conclusion', 'conclusions'],
    depart: () => ({ sujet: null, dit: null, conclu: false }),
    coups: f => [...f.sujets.map(sujet => ({ sujet })), ...f.dits.map(d => ({ dit: d })), { conclut: true }],
    // Choisir un jeton n'est pas un coup : seul « Conclure » engage.
    compte: coup => !!coup.conclut,
    jouer(f, e, coup) {
      if (e.conclu) return { refus: 'C’est dit.' }
      if (coup.conclut) return e.sujet === null || e.dit === null ? { refus: 'Choisis qui, puis ce qu’on en dit.' } : { etat: { ...e, conclu: true } }
      if (coup.sujet !== undefined) return f.sujets.includes(coup.sujet) ? { etat: { ...e, sujet: coup.sujet } } : { refus: 'Ce jeton n’est pas offert.' }
      return f.dits.includes(coup.dit) ? { etat: { ...e, dit: coup.dit } } : { refus: 'Ce jeton n’est pas offert.' }
    },
    fini(f, e) {
      if (!e.conclu) return null
      if (e.sujet === f.conclusion.sujet && e.dit === f.conclusion.dit) return { gagne: true }
      if (entraine(f, e.sujet, e.dit)) return { perdu: 'C’est vrai, mais tu n’as pas usé de toutes les prémisses.' }
      return { perdu: 'Rien, dans ce que je t’ai dit, ne l’affirme.' }
    },
    /* La preuve : la chaîne emploie chaque prémisse, la conclusion en découle, et parmi toutes
       les paires de jetons offertes, aucune autre n'en découle en les employant toutes. */
    verifier(f) {
      const cles = f.termes.map(t => t.cle)
      const { sujet, dit: d } = f.conclusion
      if (new Set(cles).size !== cles.length) return { ok: false, note: 'deux termes portent la même clé' }
      if (f.premisses.some(p => p.imp.some(l => !cles.includes(cleDe(l))))) return { ok: false, note: 'une prémisse nomme un terme inconnu' }
      if (f.dits.some(l => !cles.includes(cleDe(l))) || f.sujets.some(k => !terme(f, k)?.sujet)) return { ok: false, note: 'un jeton nomme un terme inconnu, ou muet' }
      if (!f.sujets.includes(sujet) || !f.dits.includes(d)) return { ok: false, note: 'la conclusion n’est pas parmi les jetons' }
      // Les deux bouts de la chaîne sont les deux seuls termes qui n'apparaissent qu'une fois.
      const vus = {}
      f.premisses.forEach(p => p.imp.forEach(l => { vus[cleDe(l)] = (vus[cleDe(l)] || 0) + 1 }))
      const uniques = Object.keys(vus).filter(k => vus[k] === 1).sort().join()
      if (uniques !== [sujet, cleDe(d)].sort().join()) return { ok: false, note: 'la conclusion ne relie pas les deux termes qui n’apparaissent qu’une fois' }
      if (!chaine(f, sujet, d)) return { ok: false, note: 'aucune chaîne n’emploie toutes les prémisses' }
      if (!usePourTout(f, sujet, d)) return { ok: false, note: 'la conclusion ne découle pas de toutes les prémisses ensemble' }
      const gagnantes = f.sujets.flatMap(k => f.dits.filter(l => usePourTout(f, k, l)).map(l => `${k}/${l}`))
      if (gagnantes.length !== 1) return { ok: false, note: `${gagnantes.length} paires de jetons conviennent : ${gagnantes.join(', ')}` }
      return { ok: true, coups: 1, solution: [{ sujet }, { dit: d }, { conclut: true }], note: 'une seule réponse' }
    },
    dessiner({ f, e, agir, fige }) {
      const clos = fige || e.conclu
      const jeton = (classe, texte, pris, coup) => h('button', { type: 'button', class: `so-j ${classe} ${pris ? 'pris' : ''}`, 'aria-pressed': pris ? 'true' : 'false', disabled: clos, onclick: () => agir(coup) }, texte)
      const pret = e.sujet !== null && e.dit !== null
      return h('div', { class: 'so' },
        h('ol', { class: 'so-ps' }, f.premisses.map((p, i) => h('li', null, h('b', null, `${i + 1}`), h('span', null, p.texte)))),
        h('div', { class: 'so-rang', role: 'group', 'aria-label': 'De qui parle-t-on ?' }, f.sujets.map(k => jeton('sujet', terme(f, k).sujet, e.sujet === k, { sujet: k }))),
        h('div', { class: 'so-rang', role: 'group', 'aria-label': 'Qu’en dit-on ?' }, f.dits.map(l => jeton('dit', dit(f, l), e.dit === l, { dit: l }))),
        h('p', { class: `so-phrase ${pret ? '' : 'vide'}`, 'aria-live': 'polite' }, pret ? phrase(f, e) : e.sujet !== null ? `${terme(f, e.sujet).sujet} …` : 'Choisis qui, puis ce qu’on en dit.'),
        h('button', { type: 'button', class: 'bouton', disabled: clos, onclick: () => agir({ conclut: true }) }, 'Conclure'))
    },

    /* On tire une chaîne de termes que rien ne rattache, des prémisses qui la parcourent chacune
       d'un maillon (parfois à l'envers, parfois par la négation), et on les mélange. Les jetons
       n'offrent jamais un prédicat sur le premier terme : la contraposée de la conclusion — qui dit
       la même chose du dernier terme — ne peut donc pas se composer, et la réponse reste unique. */
    tirer(graine, niveau) {
      const rang = Math.min(5, Math.max(1, niveau))
      const alea = P.alea(graine)
      const nb = [2, 3, 4, 5, 5][rang - 1]
      const pNeg = [0, 0.3, 0.5, 0.5, 0.6][rang - 1]
      const pRenverse = [0, 0.25, 0.5, 0.5, 0.7][rang - 1]
      const extras = rang === 1 ? 2 : 1
      const nSujets = rang >= 4 ? 5 : 4
      const nDits = rang >= 4 ? 5 : 4
      for (let essai = 0; essai < 300; essai++) {
        const adjs = P.melanger(alea, ADJECTIFS).slice(0, nb + 1 + extras)
        const termes = adjs.map((adj, i) => ({ cle: 'abcdefgh'[i], adj, sujet: `Les ${adj}`, oui: `sont ${adj}`, non: `ne sont pas ${adj}` }))
        // Le premier terme est toujours posé en positif : on en parle, on ne parle pas de son contraire.
        const lit = termes.slice(0, nb + 1).map((t, i) => (i > 0 && alea() < pNeg ? '!' : '') + t.cle)
        const premisses = P.melanger(alea, lit.slice(0, nb).map((de, i) => {
          const vers = lit[i + 1]
          const imp = alea() < pRenverse ? [neg(vers), neg(de)] : [de, vers]
          return { texte: dire(termes, imp), imp }
        }))
        const fin = lit[nb]
        const autres = termes.slice(1).map(t => t.cle)
        const sujets = P.melanger(alea, ['a', ...P.melanger(alea, autres).slice(0, nSujets - 1)])
        const dits = P.melanger(alea, [fin, ...P.melanger(alea, autres.flatMap(k => [k, '!' + k]).filter(l => l !== fin)).slice(0, nDits - 1)])
        const f = { termes, premisses, sujets, dits, conclusion: { sujet: 'a', dit: fin } }
        if (!moule.verifier(f).ok) continue
        const ch = chaine(f, 'a', fin)
        const nom = termes[0].adj
        const pas = ch.map((a, i) => {
          if (i === 0) return `Pars des ${nom} : la prémisse ${a.p + 1} dit qu’ils ${dit(f, a.vers)}.`
          const fini = i === ch.length - 1
          return `Or ceux qui ${dit(f, a.de)} ${dit(f, a.vers)} (prémisse ${a.p + 1})${fini ? ` : les ${nom} ${dit(f, fin)}.` : '.'}`
        })
        return {
          id: `sorite-${rang}-${graine}`, moule: 'sorite', niveau: rang, tiree: true, essais: 3,
          titre: P.parmi(alea, TITRES),
          source: 'Tirée par le programme, sur le modèle des sorites de Lewis Carroll (Symbolic Logic, 1896)',
          recit: [
            'Écoute ce que je sais de ces gens.',
            `Je te donne ${['', '', 'deux', 'trois', 'quatre', 'cinq'][nb]} vérités, toutes vraies à la fois.`,
            'Il en sort une conclusion, et une seule : elle les emploie toutes.',
          ],
          regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé de chaque prémisse.',
          ...f,
          explication: nb === 2 ? ['Suis la chaîne, un maillon à la fois.', ...pas] : pas,
        }
      }
      throw new Error('aucun tirage ne donne une seule conclusion')
    },
  })

  /* ---------------------------------------------------------------- */
  /* Le tirage : de quoi bâtir des sorites sans en copier aucun        */
  /* ---------------------------------------------------------------- */

  const ADJECTIFS = ['bavards', 'gourmands', 'rêveurs', 'frileux', 'chanceux', 'paresseux', 'distraits', 'fiers', 'prudents', 'curieux', 'joyeux', 'têtus', 'maladroits', 'chauves']
  const TITRES = ['Les gens de la rive', 'Au marché des sables', 'Le conseil des anciens', 'Une soirée au village', 'Les voisins du puits']
  // Les quatre façons de dire une implication entre deux termes, chacun posé ou nié.
  function dire(termes, [a, b]) {
    const x = termes.find(t => t.cle === cleDe(a)).adj
    const y = termes.find(t => t.cle === cleDe(b)).adj
    if (a[0] !== '!') return b[0] !== '!' ? `Tous les ${x} sont ${y}.` : `Les ${x} ne sont jamais ${y}.`
    return b[0] !== '!' ? `Ceux qui ne sont pas ${x} sont toujours ${y}.` : `Seuls les ${x} sont ${y}.`
  }

  /* ---------------------------------------------------------------- */
  /* Huit sorites de Carroll, traduits                                  */
  /* ---------------------------------------------------------------- */

  // Carroll note chaque sorite avec ses lettres : on garde sa logique, on en refait les phrases.
  const carroll = (n, niveau, o) => P.fiche({ moule: 'sorite', niveau, essais: 3, source: `Traduit de Lewis Carroll, Symbolic Logic, 1896, sorite n° ${n}`, ...o })
  const t = (cle, sujet, oui, non) => ({ cle, sujet, oui, non })

  carroll(5, 2, {
    id: 'sorite-canards', titre: 'Valse de canards',
    recit: ['Trois vérités traînent dans la basse-cour.', 'Prises ensemble, elles en disent une quatrième.', 'Elle n’est écrite nulle part : à toi de la tirer.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des trois prémisses.',
    termes: [
      t('a', 'Les canards', 'sont des canards', 'ne sont pas des canards'),
      t('b', 'Mes volailles', 'sont mes volailles', 'ne sont pas mes volailles'),
      t('c', 'Les officiers', 'sont des officiers', 'ne sont pas des officiers'),
      t('d', 'Les valseurs', 'valsent', 'ne valsent pas'),
    ],
    premisses: [
      { texte: 'Aucun canard ne valse.', imp: ['a', '!d'] },
      { texte: 'Jamais un officier ne refuse de valser.', imp: ['c', 'd'] },
      { texte: 'Toutes mes volailles sont des canards.', imp: ['b', 'a'] },
    ],
    sujets: ['c', 'a', 'b', 'd'], dits: ['c', '!d', '!c', 'd', 'a'],
    conclusion: { sujet: 'b', dit: '!c' },
    explication: [
      'Selon la 3, mes volailles sont des canards.',
      'Selon la 1, les canards ne valsent pas : mes volailles non plus.',
      'Selon la 2, un officier valse toujours : qui ne valse pas n’est pas officier.',
      'Mes volailles ne sont donc pas des officiers.',
    ],
  })

  carroll(12, 2, {
    id: 'sorite-jardinier', titre: 'Le jardinier et Waterloo',
    recit: ['Mon jardinier parle de guerre comme un général.', 'On m’a dit trois choses de lui, de Waterloo et des années.', 'Il en sort quelque chose sur son âge.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des trois prémisses.',
    termes: [
      t('a', 'Quiconque se souvient de Waterloo', 'se souvient de Waterloo', 'ne se souvient pas de Waterloo'),
      t('b', 'Mon jardinier', 'est mon jardinier', 'n’est pas mon jardinier'),
      t('c', 'Quiconque vaut d’être écouté sur l’art militaire', 'vaut d’être écouté sur l’art militaire', 'ne vaut pas d’être écouté sur l’art militaire'),
      t('d', 'Quiconque est très âgé', 'est très âgé', 'n’est pas très âgé'),
    ],
    premisses: [
      { texte: 'Mon jardinier vaut vraiment d’être écouté sur l’art militaire.', imp: ['b', 'c'] },
      { texte: 'Nul ne se souvient de la bataille de Waterloo s’il n’est très âgé.', imp: ['a', 'd'] },
      { texte: 'Nul ne vaut d’être écouté sur l’art militaire s’il ne se souvient de Waterloo.', imp: ['c', 'a'] },
    ],
    sujets: ['d', 'b', 'a', 'c'], dits: ['a', '!d', 'd', 'c', '!a'],
    conclusion: { sujet: 'b', dit: 'd' },
    explication: [
      'Selon la 1, mon jardinier vaut d’être écouté sur l’art militaire.',
      'Selon la 3, nul n’en vaut la peine s’il ne se souvient de Waterloo : il s’en souvient.',
      'Selon la 2, seuls les très vieux s’en souviennent.',
      'Mon jardinier est donc très âgé.',
    ],
  })

  carroll(23, 2, {
    id: 'sorite-cochons', titre: 'Les cochons d’Inde et Beethoven',
    recit: ['La Sonate au clair de lune tombe sur la salle.', 'Voici trois vérités sur ceux qui l’écoutent, ou pas.', 'Une conclusion t’attend, sur les cochons d’Inde.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des trois prémisses.',
    termes: [
      t('a', 'Les cochons d’Inde', 'sont des cochons d’Inde', 'ne sont pas des cochons d’Inde'),
      t('b', 'Les ignorants en musique', 'sont désespérément ignorants en musique', 'ne sont pas désespérément ignorants en musique'),
      t('c', 'Ceux qui se taisent pendant la Sonate', 'se taisent pendant la Sonate', 'ne se taisent pas pendant la Sonate'),
      t('d', 'Les vrais admirateurs de Beethoven', 'apprécient vraiment Beethoven', 'n’apprécient pas vraiment Beethoven'),
    ],
    premisses: [
      { texte: 'Nul qui apprécie vraiment Beethoven ne manque de se taire pendant la Sonate au clair de lune.', imp: ['d', 'c'] },
      { texte: 'Les cochons d’Inde sont désespérément ignorants en musique.', imp: ['a', 'b'] },
      { texte: 'Nul ignorant en musique ne se tait jamais pendant la Sonate au clair de lune.', imp: ['b', '!c'] },
    ],
    sujets: ['d', 'a', 'b', 'c'], dits: ['c', '!d', 'b', '!c', 'd'],
    conclusion: { sujet: 'a', dit: '!d' },
    explication: [
      'Selon la 2, les cochons d’Inde sont ignorants en musique.',
      'Selon la 3, aucun ignorant en musique ne se tait pendant la Sonate : eux non plus.',
      'Selon la 1, qui apprécie vraiment Beethoven se tait pendant la Sonate.',
      'Les cochons d’Inde, qui ne se taisent pas, n’apprécient donc pas vraiment Beethoven.',
    ],
  })

  carroll(27, 3, {
    id: 'sorite-gateau', titre: 'Le gâteau de noces',
    recit: ['Mon médecin est un homme sévère.', 'Quatre choses sont sûres, au sujet de mon souper.', 'Elles décident du sort d’un gâteau de noces.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des quatre prémisses.',
    termes: [
      t('a', 'Un mets qui me réussit', 'me réussit', 'ne me réussit pas'),
      t('b', 'Un mets permis par mon médecin', 'est permis par mon médecin', 'n’est pas permis par mon médecin'),
      t('c', 'Un mets qui convient au souper', 'convient au souper', 'ne convient pas au souper'),
      t('d', 'Un mets très riche', 'est très riche', 'n’est pas très riche'),
      t('e', 'Le gâteau de noces', 'est un gâteau de noces', 'n’est pas un gâteau de noces'),
    ],
    premisses: [
      { texte: 'Mon médecin ne m’autorise que des mets peu riches.', imp: ['b', '!d'] },
      { texte: 'Rien de ce qui me réussit ne convient mal au souper.', imp: ['a', 'c'] },
      { texte: 'Le gâteau de noces est toujours très riche.', imp: ['e', 'd'] },
      { texte: 'Mon médecin m’autorise tous les mets qui conviennent au souper.', imp: ['c', 'b'] },
    ],
    sujets: ['c', 'e', 'd', 'a', 'b'], dits: ['!b', 'd', '!a', '!c', 'a'],
    conclusion: { sujet: 'e', dit: '!a' },
    explication: [
      'Selon la 3, le gâteau de noces est très riche.',
      'Selon la 1, mon médecin n’autorise que des mets peu riches : il ne l’autorise pas.',
      'Selon la 4, il m’autorise tout ce qui convient au souper : le gâteau n’y convient donc pas.',
      'Selon la 2, rien de ce qui me réussit n’y convient mal : le gâteau de noces ne me réussit pas.',
    ],
  })

  carroll(33, 3, {
    id: 'sorite-sirenes', titre: 'Les sirènes du capitaine',
    recit: ['Le journal de bord ne ment pas, dit le capitaine.', 'Il a quatre choses à dire sur ce qu’on croise en mer.', 'La dernière est sur les sirènes.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des quatre prémisses.',
    termes: [
      t('a', 'Les choses notées au journal de bord', 'sont notées au journal de bord', 'ne sont pas notées au journal de bord'),
      t('b', 'Les sirènes', 'sont des sirènes', 'ne sont pas des sirènes'),
      t('c', 'Les choses que j’ai croisées', 'sont des choses que j’ai croisées', 'ne sont pas des choses que j’ai croisées'),
      t('d', 'Les choses remarquées', 'sont remarquées', 'ne sont pas remarquées'),
      t('e', 'Les choses qui valent d’être retenues', 'valent d’être retenues', 'ne valent pas d’être retenues'),
    ],
    premisses: [
      { texte: 'Parmi les choses rencontrées en mer, aucune de celles qu’on n’a pas remarquées n’est une sirène.', imp: ['!d', '!b'] },
      { texte: 'Ce que l’on inscrit au journal de bord vaut sûrement d’être retenu.', imp: ['a', 'e'] },
      { texte: 'Je n’ai jamais rien croisé qui vaille d’être retenu au cours d’une traversée.', imp: ['c', '!e'] },
      { texte: 'Les choses remarquées en mer sont sûrement inscrites au journal.', imp: ['d', 'a'] },
    ],
    sujets: ['b', 'c', 'a', 'd', 'e'], dits: ['!b', 'b', '!e', 'e', '!a'],
    conclusion: { sujet: 'c', dit: '!b' },
    explication: [
      'Selon la 3, ce que j’ai croisé ne vaut pas d’être retenu.',
      'Selon la 2, tout ce qui est inscrit au journal vaut d’être retenu : je n’ai rien croisé d’inscrit.',
      'Selon la 4, ce qu’on remarque est inscrit au journal : je n’ai rien croisé de remarqué.',
      'Selon la 1, toute sirène est remarquée : ce que j’ai croisé n’est donc pas une sirène.',
    ],
  })

  carroll(35, 3, {
    id: 'sorite-voliere', titre: 'La volière et les tartelettes',
    recit: ['Ma volière est pleine d’oiseaux, et tous sont à moi.', 'On sait quatre choses de leur taille et de leur table.', 'Il en sort ce qu’ils ne mangent pas.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des quatre prémisses.',
    termes: [
      t('a', 'Les oiseaux de cette volière', 'sont dans cette volière', 'ne sont pas dans cette volière'),
      t('b', 'Les mangeurs de tartelettes', 'vivent de tartelettes de Noël', 'ne vivent pas de tartelettes de Noël'),
      t('c', 'Mes oiseaux', 'sont à moi', 'ne sont pas à moi'),
      t('d', 'Les oiseaux de neuf pieds', 'mesurent neuf pieds', 'ne mesurent pas neuf pieds'),
      t('e', 'Les autruches', 'sont des autruches', 'ne sont pas des autruches'),
    ],
    premisses: [
      { texte: 'Hors les autruches, aucun oiseau ne mesure neuf pieds.', imp: ['d', 'e'] },
      { texte: 'Nul oiseau de cette volière n’appartient à un autre que moi.', imp: ['a', 'c'] },
      { texte: 'Aucune autruche ne vit de tartelettes de Noël.', imp: ['e', '!b'] },
      { texte: 'Je n’ai aucun oiseau de moins de neuf pieds.', imp: ['c', 'd'] },
    ],
    sujets: ['e', 'a', 'c', 'd', 'b'], dits: ['d', '!b', 'e', 'b', '!e'],
    conclusion: { sujet: 'a', dit: '!b' },
    explication: [
      'Selon la 2, les oiseaux de la volière sont à moi ; selon la 4, les miens ont tous neuf pieds.',
      'Selon la 1, seules les autruches mesurent neuf pieds : ce sont donc des autruches.',
      'Selon la 3, aucune autruche ne vit de tartelettes de Noël.',
      'Aucun oiseau de cette volière ne vit de tartelettes de Noël.',
    ],
  })

  carroll(40, 4, {
    id: 'sorite-chatons', titre: 'Chatons et gorille',
    recit: ['Cinq choses sont sûres, sur les chatons.', 'Elles parlent de queue, de moustaches et de poisson.', 'Et d’un gorille, au bout de la chaîne.'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des cinq prémisses.',
    termes: [
      t('a', 'Qui a les yeux verts', 'a les yeux verts', 'n’a pas les yeux verts'),
      t('b', 'Qui aime le poisson', 'aime le poisson', 'n’aime pas le poisson'),
      t('c', 'Qui a une queue', 'a une queue', 'n’a pas de queue'),
      t('d', 'Qui est éducable', 'est éducable', 'n’est pas éducable'),
      t('e', 'Qui a des moustaches', 'a des moustaches', 'n’a pas de moustaches'),
      t('h', 'Qui joue avec un gorille', 'joue avec un gorille', 'ne joue pas avec un gorille'),
    ],
    premisses: [
      { texte: 'Aucun chaton qui aime le poisson n’est inéducable.', imp: ['b', 'd'] },
      { texte: 'Aucun chaton sans queue ne jouera avec un gorille.', imp: ['!c', '!h'] },
      { texte: 'Les chatons à moustaches aiment toujours le poisson.', imp: ['e', 'b'] },
      { texte: 'Aucun chaton éducable n’a les yeux verts.', imp: ['d', '!a'] },
      { texte: 'Aucun chaton n’a de queue s’il n’a pas de moustaches.', imp: ['c', 'e'] },
    ],
    sujets: ['a', 'h', 'b', 'e', 'd'], dits: ['!c', '!h', 'h', '!d', 'e'],
    conclusion: { sujet: 'a', dit: '!h' },
    explication: [
      'Selon la 4, un chaton aux yeux verts n’est pas éducable.',
      'Selon la 1, ceux qui aiment le poisson sont éducables : il n’aime pas le poisson.',
      'Selon la 3, tout chaton à moustaches aime le poisson : il n’a pas de moustaches.',
      'Selon la 5, sans moustaches, pas de queue.',
      'Selon la 2, sans queue, on ne joue pas avec un gorille.',
    ],
  })

  carroll(42, 4, {
    id: 'sorite-ecritoire', titre: 'L’écritoire aux scorpions',
    recit: ['J’ai des boîtes, et je n’ose pas toutes les ouvrir.', 'Cinq choses sont sûres, sur leur bois, leur peinture et leur contenu.', 'Une d’elles est mon écritoire. Que contient-elle ?'],
    regle: 'Touche qui, puis ce qu’on en dit, et conclus. Il faut avoir usé des cinq prémisses.',
    termes: [
      t('a', 'Une boîte sans crainte', 'se laisse ouvrir sans crainte', 'fait peur à ouvrir'),
      t('b', 'Une boîte à scorpions', 'est pleine de scorpions', 'n’est pas pleine de scorpions'),
      t('c', 'Une boîte d’ici', 'est ici', 'n’est pas ici'),
      t('d', 'Une boîte en palissandre', 'est en palissandre', 'n’est pas en palissandre'),
      t('e', 'Une boîte peinte', 'est peinte', 'n’est pas peinte'),
      t('h', 'Mon écritoire', 'est mon écritoire', 'n’est pas mon écritoire'),
    ],
    premisses: [
      { texte: 'Je n’ose ouvrir aucune de mes boîtes qui sont ici.', imp: ['c', '!a'] },
      { texte: 'Mon écritoire est en palissandre.', imp: ['h', 'd'] },
      { texte: 'Toutes mes boîtes sont peintes, sauf celles qui sont ici.', imp: ['!c', 'e'] },
      { texte: 'Toute boîte à moi que je n’ose pas ouvrir est pleine de scorpions vivants.', imp: ['!a', 'b'] },
      { texte: 'Mes boîtes en palissandre ne sont pas peintes.', imp: ['d', '!e'] },
    ],
    sujets: ['h', 'd', 'e', 'c', 'a'], dits: ['!a', 'b', 'c', '!e', 'e'],
    conclusion: { sujet: 'h', dit: 'b' },
    explication: [
      'Selon la 2, mon écritoire est en palissandre ; selon la 5, elle n’est donc pas peinte.',
      'Selon la 3, toutes mes boîtes sont peintes, sauf celles d’ici : elle est ici.',
      'Selon la 1, je n’ose ouvrir aucune boîte d’ici.',
      'Selon la 4, toute boîte que je n’ose pas ouvrir est pleine de scorpions.',
      'Mon écritoire est pleine de scorpions vivants.',
    ],
  })
}

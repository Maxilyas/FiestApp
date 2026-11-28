'use strict'
/* Les messages chiffrés : un proverbe qu'on ne lit pas tel quel, un outil pour
   le lire, un mot à rendre — le dernier. Quatre chiffres, chacun son outil au
   toucher :
     — le décalage de César : chaque lettre avancée de quelques rangs, que la
       molette fait reculer (Suétone, Vie des douze Césars, « César », LVI) ;
     — l'écriture en miroir de Léonard de Vinci : un bouton retourne le message ;
     — A = 1, B = 2… : des nombres, et une réglette qui donne le rang de chaque
       lettre (tradition) ;
     — le carré de Polybe : une grille de cinq sur cinq, chaque lettre écrite par
       sa ligne et sa colonne, I et J confondus (Polybe, Histoires, livre X).

   Se tranche d'une réponse : tourner la molette, retourner, parcourir les
   nombres ne comptent pas, seul `repond` compte, et la fiche donne trois essais.

   Une fiche donne `chiffre`, `mots` (le message tel qu'il s'affiche : des
   chaînes pour César et le miroir, des listes de nombres ou de paires pour les
   deux autres), `reponse` (le dernier mot) et, pour César, `decalage`. Le
   clair n'est pas dans la fiche : le vérificateur le retrouve par le code même
   de l'outil, et exige que ce soit un des proverbes de la liste — c'est ce qui
   prouve que la fiche n'a qu'une lecture. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.chiffre = ['...###...', '..#...#..', '..#...#..', '.#######.', '.#.....#.', '.#..#..#.', '.#..#..#.', '.#.....#.', '.#######.']

  P.style(`
.ch { display: grid; gap: 8px; }
.ch-msg { display: grid; place-items: center; min-height: 58px; padding: 9px 8px; background: linear-gradient(180deg, var(--pierre), var(--boite)); border: 1px solid rgba(217, 181, 106, 0.38); border-radius: 10px; }
.ch-txt { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 2px 13px; }
.ch-txt.miroir { transform: scaleX(-1); }
.ch-mot { font: 600 19px/1.3 var(--f-pixel); letter-spacing: 1px; color: var(--ink); }
.ch-nb { display: flex; flex-wrap: wrap; justify-content: center; gap: 1px 2px; }
.ch-sym { min-width: 21px; padding: 0 1px; text-align: center; font: 600 14px/21px var(--f-pixel); color: var(--ink); border-radius: 4px; font-variant-numeric: tabular-nums; }
.ch-sym.sel { background: var(--or); color: #1a1412; }
.ch-ap { font: 600 14px/21px var(--f-pixel); color: var(--muted); }
.ch-molette { display: grid; grid-template-columns: 56px minmax(0, 1fr) 56px; gap: 8px; align-items: center; }
.ch-cran, .ch-pas { height: 44px; padding: 0; display: grid; place-items: center; font: 700 22px/1 var(--f-texte); color: var(--or-clair); background: linear-gradient(180deg, var(--pierre), var(--pierre-sombre)); border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; }
.ch-cran:active, .ch-pas:active { translate: 0 1px; }
.ch-cran[disabled], .ch-pas[disabled] { opacity: 0.35; cursor: default; }
.ch-valeur { margin: 0; display: grid; justify-items: center; gap: 1px; text-align: center; }
.ch-valeur b { font: 600 22px/1 var(--f-pixel); color: var(--or-clair); }
.ch-valeur span { font-size: 12px; line-height: 1.25; color: var(--muted); }
.ch-retourne { min-height: 44px; padding: 0 14px; font: 700 15px var(--f-texte); color: var(--or-clair); background: linear-gradient(180deg, var(--pierre), var(--pierre-sombre)); border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; }
.ch-retourne[disabled] { opacity: 0.35; cursor: default; }
.ch-regle { display: grid; grid-template-columns: repeat(13, minmax(0, 1fr)); gap: 2px; }
.ch-r { display: grid; justify-items: center; padding: 2px 0 3px; background: rgba(0, 0, 0, 0.28); border-radius: 4px; }
.ch-r b { font: 600 12px/15px var(--f-pixel); color: var(--or-clair); }
.ch-r i { font: 600 11.5px/14px var(--f-pixel); font-style: normal; color: var(--ink); }
.ch-r.sel { background: var(--or); }
.ch-r.sel b, .ch-r.sel i { color: #1a1412; }
.ch-curseur { display: grid; grid-template-columns: 56px minmax(0, 1fr) 56px; gap: 8px; align-items: center; }
.ch-curseur p { margin: 0; text-align: center; font-size: 12px; line-height: 1.3; color: var(--muted); }
.ch-curseur p b { color: var(--or-clair); font-weight: 600; }
.ch-polybe { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; }
.ch-grille { display: grid; grid-template-columns: 22px repeat(5, 31px); grid-auto-rows: 25px; gap: 2px; }
.ch-grille span { display: grid; place-items: center; font: 600 15px/1 var(--f-pixel); color: var(--ink); background: rgba(0, 0, 0, 0.28); border-radius: 4px; }
.ch-grille .tete { background: none; font-size: 13px; color: var(--muted); }
.ch-grille .tete.sel { color: var(--or-clair); }
.ch-grille .case.sel { background: var(--or); color: #1a1412; }
.ch-grille .case small { font-size: 10px; }
.ch-cote { display: grid; gap: 6px; }
.ch-cote > p { margin: 0; font-size: 12px; line-height: 1.35; color: var(--muted); }
.ch-cote .ch-curseur { grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 4px; }
.ch-reponse { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.ch-champ { min-width: 0; height: 46px; padding: 0 12px; font: 600 16px var(--f-texte); letter-spacing: 1px; text-transform: uppercase; color: var(--ink); background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; }
.ch-champ::placeholder { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--muted); }
.ch-champ[disabled] { opacity: 0.6; }
`)

  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  // Le carré de Polybe : vingt-cinq cases, donc une seule pour I et J. Les proverbes n'ont pas de J, sans quoi la lecture serait ambiguë.
  const GRILLE = ['ABCDE', 'FGHIK', 'LMNOP', 'QRSTU', 'VWXYZ']
  const caseDe = l => {
    const c = l === 'J' ? 'I' : l
    const ligne = GRILLE.findIndex(g => g.includes(c))
    return String(ligne + 1) + String(GRILLE[ligne].indexOf(c) + 1)
  }

  // Un mot est une chaîne de capitales, avec parfois une apostrophe, qui ne se chiffre jamais.
  const decale = (mot, k) => [...mot].map(c => { const i = ALPHA.indexOf(c); return i < 0 ? c : ALPHA[(i + k + 26 * 30) % 26] }).join('')

  // `coder` fabrique le message, `lire` le déchiffre avec ce que l'outil montre : c'est ce dernier que le vérificateur croit.
  const CHIFFRES = {
    miroir: { coder: mot => mot, lire: mot => mot },
    cesar: { coder: (mot, k) => decale(mot, k), lire: (mot, k) => decale(mot, -k) },
    nombres: { coder: mot => [...mot].map(c => (c === '’' ? c : ALPHA.indexOf(c) + 1)), lire: items => items.map(x => (x === '’' ? x : ALPHA[x - 1])).join('') },
    polybe: { coder: mot => [...mot].map(c => (c === '’' ? c : caseDe(c))), lire: items => items.map(x => (x === '’' ? x : GRILLE[x[0] - 1][x[1] - 1])).join('') },
  }

  // Anciens et courts. Le dernier mot de chacun se tape sans apostrophe : on le demande, il faut qu'il s'écrive d'un jet.
  const PROVERBES = [
    'PIERRE QUI ROULE N’AMASSE PAS MOUSSE',
    'PETIT A PETIT L’OISEAU FAIT SON NID',
    'L’HABIT NE FAIT PAS LE MOINE',
    'CHAT ECHAUDE CRAINT L’EAU FROIDE',
    'LA NUIT TOUS LES CHATS SONT GRIS',
    'L’UNION FAIT LA FORCE',
    'PAS DE NOUVELLES BONNES NOUVELLES',
    'APRES LA PLUIE LE BEAU TEMPS',
    'LES CHIENS ABOIENT LA CARAVANE PASSE',
    'L’APPETIT VIENT EN MANGEANT',
    'QUI SEME LE VENT RECOLTE LA TEMPETE',
    'A COEUR VAILLANT RIEN D’IMPOSSIBLE',
  ]
  if (PROVERBES.some(p => p.includes('J'))) throw new Error('Un proverbe porte un J : le carré de Polybe le lirait I.')

  const nbLettres = texte => texte.replace(/[^A-Z]/g, '').length
  const dernier = texte => texte.split(' ').pop()

  // Les lettres d'un message, sans les apostrophes : le curseur de A = 1 et de Polybe les parcourt une à une.
  const lettres = f => f.mots.flat().filter(x => x !== '’')
  const compter = f => lettres(f).length

  /* Ce que l'écran montre du message : à la molette près pour César, à l'envers tant qu'on n'a pas retourné pour le
     miroir. `lecture` en tire le texte, comme un lecteur qui aurait mis l'outil dans la bonne position. */
  const affichage = (f, e) => f.mots.map(m => (f.chiffre === 'cesar' ? CHIFFRES.cesar.lire(m, e.k) : m))
  const lecture = (f, e) => (f.chiffre === 'nombres' || f.chiffre === 'polybe' ? f.mots.map(m => CHIFFRES[f.chiffre].lire(m)) : affichage(f, e)).join(' ')

  const moule = P.moule({
    cle: 'chiffre',
    nom: 'Les messages chiffrés',
    socle: 'lettre',
    glyphe: 'chiffre',
    unite: ['réponse', 'réponses'],
    // `tour` suit le numéro de la reprise : le champ s'en sert pour savoir s'il doit se vider après une erreur.
    depart: (f, tour) => ({ tour: tour || 0, k: 0, retourne: false, i: null }),
    compte: coup => coup.repond !== undefined,
    coups(f, e) {
      if (f.chiffre === 'cesar') return [{ cran: -1 }, { cran: 1 }]
      if (f.chiffre === 'miroir') return [{ retourner: true }]
      return [{ pas: -1 }, { pas: 1 }]
    },
    jouer(f, e, coup) {
      if (e.reponse !== undefined) return { refus: 'Tu as déjà répondu.' }
      if (coup.cran !== undefined) {
        if (f.chiffre !== 'cesar') return { refus: 'Ce message n’a pas de molette.' }
        return { etat: { ...e, k: (e.k + (coup.cran < 0 ? -1 : 1) + 26) % 26 } }
      }
      if (coup.retourner) {
        if (f.chiffre !== 'miroir') return { refus: 'Ce message ne se retourne pas.' }
        return { etat: { ...e, retourne: !e.retourne } }
      }
      if (coup.pas !== undefined) {
        if (f.chiffre !== 'nombres' && f.chiffre !== 'polybe') return { refus: 'Ce message n’a pas de curseur.' }
        const n = compter(f)
        const i = e.i === null ? (coup.pas > 0 ? 0 : n - 1) : (e.i + (coup.pas > 0 ? 1 : -1) + n) % n
        return { etat: { ...e, i } }
      }
      if (coup.repond !== undefined) {
        if (!P.normaliser(coup.repond)) return { refus: 'Écris d’abord le mot.' }
        return { etat: { ...e, reponse: String(coup.repond) } }
      }
      return { refus: 'Je ne comprends pas ce geste.' }
    },
    fini(f, e) {
      if (e.reponse === undefined) return null
      if (P.normaliser(e.reponse) === P.normaliser(f.reponse)) return { gagne: true }
      const court = [...e.reponse.trim()].slice(0, 18).join('')
      return { perdu: `« ${court} » : non, ce n’est pas le dernier mot. Relis le message.` }
    },
    /* La preuve : on lit le message avec l'outil, dans toutes ses positions, et on compte les lectures qui donnent un
       proverbe connu. Une seule, celle de la fiche, et son dernier mot est la réponse. */
    verifier(f) {
      if (!CHIFFRES[f.chiffre]) return { ok: false, note: 'chiffre inconnu' }
      const lectures = []
      for (let k = 0; k < (f.chiffre === 'cesar' ? 26 : 1); k++) {
        const texte = lecture(f, { k })
        if (PROVERBES.includes(texte)) lectures.push({ k, texte })
      }
      if (lectures.length !== 1) return { ok: false, note: lectures.length ? `${lectures.length} lectures donnent un proverbe` : 'aucune lecture ne donne un proverbe' }
      const { k, texte } = lectures[0]
      if (f.chiffre === 'cesar' && k !== f.decalage) return { ok: false, note: `le message se lit au cran ${k}, pas au cran ${f.decalage}` }
      if (P.normaliser(dernier(texte)) !== P.normaliser(f.reponse)) return { ok: false, note: `le dernier mot est ${dernier(texte)}, pas ${f.reponse}` }
      return { ok: true, coups: 1, solution: [{ repond: dernier(texte) }], note: `lu : « ${texte} »` }
    },
    dessiner({ f, e, agir, fige }) {
      const clos = fige || !!moule.fini(f, e)
      const mots = affichage(f, e)
      const nombres = f.chiffre === 'nombres' || f.chiffre === 'polybe'

      // Le message. Pour A = 1 et Polybe, chaque nombre est une case, et celle que le curseur désigne s'allume.
      let rang = 0
      const message = nombres
        ? mots.map(m => h('span', { class: 'ch-nb' }, m.map(x => {
          if (x === '’') return h('span', { class: 'ch-ap' }, x)
          return h('span', { class: `ch-sym ${rang++ === e.i ? 'sel' : ''}` }, String(x))
        })))
        : mots.map(m => h('span', { class: 'ch-mot' }, m))
      const lu = f.chiffre === 'miroir' ? (e.retourne ? 'Message remis à l’endroit.' : 'Message en miroir.') : f.chiffre === 'cesar' ? `Message au cran ${e.k}.` : 'Message en chiffres.'
      const bloc = h('div', { class: 'ch-msg', role: 'img', 'aria-label': `${lu} ${nombres ? mots.map(m => m.join(' ')).join(' / ') : mots.join(' ')}` },
        h('div', { class: `ch-txt ${f.chiffre === 'miroir' && !e.retourne ? 'miroir' : ''}` }, message))

      // Le curseur parcourt le message lettre à lettre, et allume sa case dans la réglette ou la grille : l'outil se touche.
      const curseur = aide => h('div', { class: 'ch-curseur' },
        h('button', { type: 'button', class: 'ch-pas', 'aria-label': 'Lettre précédente', disabled: clos, onclick: () => agir({ pas: -1 }) }, '◂'),
        h('p', null, e.i === null ? aide : h('span', null, h('b', null, String(e.i + 1)), `/${compter(f)}`)),
        h('button', { type: 'button', class: 'ch-pas', 'aria-label': 'Lettre suivante', disabled: clos, onclick: () => agir({ pas: 1 }) }, '▸'))

      let outil
      if (f.chiffre === 'cesar') {
        outil = h('div', { class: 'ch-molette' },
          h('button', { type: 'button', class: 'ch-cran', 'aria-label': 'Reculer la molette d’un cran', disabled: clos, onclick: () => agir({ cran: -1 }) }, '−'),
          h('p', { class: 'ch-valeur' }, h('b', null, String(e.k)), h('span', null, e.k === 0 ? 'Message tel quel' : `Les lettres reculent de ${P.pluriel(e.k, 'cran')}`)),
          h('button', { type: 'button', class: 'ch-cran', 'aria-label': 'Avancer la molette d’un cran', disabled: clos, onclick: () => agir({ cran: 1 }) }, '+'))
      } else if (f.chiffre === 'miroir') {
        outil = h('button', { type: 'button', class: 'ch-retourne', disabled: clos, onclick: () => agir({ retourner: true }) }, e.retourne ? 'Remettre en miroir' : 'Retourner le message')
      } else if (f.chiffre === 'nombres') {
        const choisi = e.i === null ? null : lettres(f)[e.i]
        outil = h('div', { class: 'ch-outil' },
          h('div', { class: 'ch-regle', role: 'img', 'aria-label': 'Réglette : chaque lettre de A à Z avec son rang' },
            [...ALPHA].map((l, i) => h('span', { class: `ch-r ${choisi === i + 1 ? 'sel' : ''}` }, h('b', null, l), h('i', null, String(i + 1))))),
          curseur('Touche ▸ : j’allume la lettre dans la réglette.'))
      } else {
        const choisi = e.i === null ? null : lettres(f)[e.i]
        const ligne = choisi === null ? 0 : +choisi[0], colonne = choisi === null ? 0 : +choisi[1]
        const cases = []
        cases.push(h('span', { class: 'tete' }))
        for (let c = 1; c <= 5; c++) cases.push(h('span', { class: `tete ${colonne === c ? 'sel' : ''}` }, String(c)))
        GRILLE.forEach((g, r) => {
          cases.push(h('span', { class: `tete ${ligne === r + 1 ? 'sel' : ''}` }, String(r + 1)))
          ;[...g].forEach((l, c) => cases.push(h('span', { class: `case ${ligne === r + 1 && colonne === c + 1 ? 'sel' : ''}` }, l === 'I' ? ['I', h('small', null, '/J')] : l)))
        })
        outil = h('div', { class: 'ch-polybe' },
          h('div', { class: 'ch-grille', role: 'img', 'aria-label': 'Carré de Polybe : cinq lignes et cinq colonnes, I et J dans la même case' }, cases),
          h('div', { class: 'ch-cote' },
            h('p', null, 'Ligne d’abord, colonne ensuite : 34 se lit ligne 3, colonne 4. I et J partagent une case. ▸ allume les lettres une à une.'),
            curseur('')))
      }

      // Le texte tapé vit dans le champ : à chaque dessin on le reprend à l'ancien, tant que c'est la même fiche et la même reprise.
      const ancien = typeof document === 'undefined' ? null : document.getElementById('ch-reponse')
      const garde = ancien && ancien.dataset.fiche === f.id && ancien.dataset.tour === String(e.tour) ? ancien.value : ''
      const champ = h('input', {
        id: 'ch-reponse', class: 'ch-champ', type: 'text', placeholder: 'Le dernier mot', 'aria-label': 'Le dernier mot du proverbe',
        'data-fiche': f.id, 'data-tour': String(e.tour), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'done', maxlength: '24', disabled: clos,
      })
      champ.value = e.reponse !== undefined ? e.reponse : garde
      const repondre = () => agir({ repond: champ.value })
      champ.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); repondre() } })

      return h('div', { class: 'ch' }, bloc, outil,
        h('div', { class: 'ch-reponse' }, champ, h('button', { type: 'button', class: 'bouton', disabled: clos, onclick: repondre }, 'Répondre')))
    },
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const rang = Math.min(5, Math.max(1, niveau))
      const chiffre = rang === 1 ? 'miroir' : rang === 2 ? 'nombres' : rang === 3 ? 'cesar' : rang === 4 ? 'polybe' : P.parmi(alea, ['cesar', 'polybe'])
      // Au sommet, les proverbes les plus longs : plus de lettres à lire.
      const texte = P.parmi(alea, rang === 5 ? PROVERBES.filter(p => nbLettres(p) >= 28) : PROVERBES)
      const decalage = chiffre === 'cesar' ? P.entier(alea, 1, 25) : 0
      return fabriquer({ id: `chiffre-${rang}-${graine}`, niveau: rang, tiree: true, chiffre, texte, decalage, titre: TITRES[chiffre] })
    },
  })

  const TITRES = { miroir: 'Un proverbe en miroir', nombres: 'Un proverbe en nombres', cesar: 'Un proverbe décalé', polybe: 'Un proverbe en carré' }
  const SOURCES = {
    miroir: 'Les carnets de Léonard de Vinci, écrits en miroir ; proverbe populaire',
    nombres: 'Le chiffre « A = 1 », tradition ; proverbe populaire',
    cesar: 'Suétone, Vie des douze Césars, « César », LVI ; proverbe populaire',
    polybe: 'Polybe, Histoires, livre X, IIe siècle avant notre ère ; proverbe populaire',
  }

  // Le récit, la règle et la solution se disent avec les mots de la fiche : une seule fabrique pour les écrites et les tirées.
  function fabriquer({ id, niveau, tiree, chiffre, texte, decalage, titre }) {
    const ch = CHIFFRES[chiffre]
    const reponse = dernier(texte)
    const recits = {
      miroir: ['Léonard de Vinci écrivait de droite à gauche, lettres à l’envers : il fallait un miroir pour le lire.', 'Ce proverbe est écrit comme lui. Mon bouton retourne le message.'],
      nombres: ['Un scribe a remplacé chaque lettre par son rang dans l’alphabet : A vaut un, B vaut deux…', 'Ma réglette te dit le rang de chaque lettre.'],
      cesar: [decalage === 3 ? 'Jules César écrivait à ses amis en avançant chaque lettre de trois rangs.' : 'César avançait chaque lettre de trois rangs. Moi, j’ai choisi le nombre à ma façon.', 'Tourne ma molette : les lettres reculent, cran par cran, jusqu’à ce que le message se lise.'],
      polybe: ['Polybe, un Grec, écrivait chaque lettre par deux chiffres : sa ligne, puis sa colonne.', 'Voici sa grille. Le curseur t’aide à suivre le message.'],
    }
    const regles = {
      miroir: 'Retourne le message, lis-le, puis écris son dernier mot.',
      nombres: 'Traduis chaque nombre en lettre, puis écris le dernier mot.',
      cesar: 'Tourne la molette jusqu’à lire un proverbe, puis écris son dernier mot.',
      polybe: 'Chaque paire dit une ligne et une colonne. Écris le dernier mot.',
    }
    const etapes = {
      miroir: ['Touche « Retourner le message » : il se lit à l’endroit.'],
      nombres: ['Cherche chaque nombre sur la réglette : 1 est A, 2 est B…'],
      cesar: [`Tourne la molette jusqu’au cran ${decalage || 3} : les lettres ont reculé d’autant.`],
      polybe: ['Pour chaque paire, prends la ligne puis la colonne : le chiffre de gauche est la ligne.'],
    }
    return {
      id, moule: 'chiffre', niveau, tiree, titre, source: SOURCES[chiffre],
      recit: [...recits[chiffre], 'Dis-moi le dernier mot du proverbe.'],
      regle: regles[chiffre],
      explication: [...etapes[chiffre], `Le proverbe se lit : « ${texte.charAt(0) + texte.slice(1).toLowerCase()} ».`, `Son dernier mot : ${reponse}.`],
      essais: 3,
      chiffre, decalage, reponse,
      mots: texte.split(' ').map(m => ch.coder(m, decalage)),
    }
  }

  /* ---------------------------------------------------------------- */

  // Une fiche par chiffre, du plus simple au plus long : le miroir, A = 1, César — de trois crans, comme chez Suétone —, Polybe.
  P.fiche(fabriquer({ id: 'chiffre-miroir', niveau: 1, chiffre: 'miroir', texte: 'L’UNION FAIT LA FORCE', decalage: 0, titre: 'Le carnet de Léonard' }))
  P.fiche(fabriquer({ id: 'chiffre-nombres', niveau: 2, chiffre: 'nombres', texte: 'LA NUIT TOUS LES CHATS SONT GRIS', decalage: 0, titre: 'A vaut un' }))
  P.fiche(fabriquer({ id: 'chiffre-cesar', niveau: 3, chiffre: 'cesar', texte: 'APRES LA PLUIE LE BEAU TEMPS', decalage: 3, titre: 'Le décalage de César' }))
  P.fiche(fabriquer({ id: 'chiffre-polybe', niveau: 4, chiffre: 'polybe', texte: 'CHAT ECHAUDE CRAINT L’EAU FROIDE', decalage: 0, titre: 'Le carré de Polybe' }))
}

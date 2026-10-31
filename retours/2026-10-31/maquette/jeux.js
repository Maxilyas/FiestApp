// Les neuf jeux du Cabinet, un module chacun : ce qu'il tire, ce qu'il montre, comment il juge.
// Repris de la maquette du 24 octobre (retours/2026-10-24/maquette/jeu.js), sans les étoiles :
// une manche rapporte de l'or (15, 10 ou 5 pièces selon qu'elle est parfaite, bonne ou juste),
// ou c'est une erreur, et l'erreur coûte un cœur. Le moteur (jeu.js) applique les cartes.
//
// Un module reçoit `ctx` : l'épreuve (`ctx.E`, sa manche `ctx.E.m`), la pioche, le juge, le
// rendu, le chrono. Il ne touche ni à l'or ni aux cœurs : c'est `ctx.juger(or, verdict)`.
(function () {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Les espaces insécables du français, pour qu'un « ? » ne parte pas seul à la ligne ; et une
  // inversion (« appelle-t-on », « fut-il ») ne se coupe pas à son trait d'union.
  const typo = s => esc(s).replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ').replace(/(\d) (\d{3})/g, '$1 $2')
    .replace(/([A-Za-zÀ-ÿ]+-t-(?:il|elle|on|ils|elles)|[A-Za-zÀ-ÿ]+-(?:il|elle|on|ils|elles|je|tu|nous|vous|ce)\b)/g, '<span class="insecable">$1</span>');
  const melanger = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const auHasard = a => a[Math.floor(Math.random() * a.length)];
  const nombre = v => Number(v).toLocaleString('fr-FR');
  const sansAccent = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
  const lettreMinuscule = t => (/^(Le|La|Les|L’|L')\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  const savaisQcm = q => q.a || '';

  // ———————————————————————— La carte de France (l'Épingle) ————————————————————————
  const K = 30, OX = 5.4, OY = 51.4, COS = Math.cos(46.5 * Math.PI / 180);
  const proj = (lon, lat) => [((lon + OX) * COS * K + 6), ((OY - lat) * K + 6)];
  const deproj = (x, y) => [(x - 6) / (COS * K) - OX, OY - (y - 6) / K];
  const LARGEUR = Math.ceil((9.7 + OX) * COS * K + 50), HAUTEUR = Math.ceil((OY - 41.3) * K + 12);
  const f1 = v => v.toFixed(1);
  function carteSvg(dessus, jouable) {
    const p = l => l.map(([lo, la]) => proj(lo, la).map(f1).join(',')).join(' ');
    const villes = window.VILLES.map(([n, lo, la]) => { const [x, y] = proj(lo, la); return `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" fill="#8d82a3"/><text x="${f1(x + 5)}" y="${f1(y - 4)}" font-size="11" fill="#b8aac4" font-family="Nunito Sans, sans-serif">${n}</text>`; }).join('');
    return `<svg class="carte-france${jouable ? ' jouable' : ''}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" ${jouable ? 'data-a="m" data-v="carte" role="img" aria-label="Carte de France : touche pour planter ton épingle"' : 'role="img" aria-label="La carte de France"'}>
      <polygon points="${p(window.FRANCE)}" fill="#1d2a2c" stroke="#6fa39a" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="${p(window.CORSE)}" fill="#1d2a2c" stroke="#6fa39a" stroke-width="1.5" stroke-linejoin="round"/>
      ${villes}${dessus}</svg>`;
  }
  const distanceKm = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const epingleSvg = (lon, lat) => { const [x, y] = proj(lon, lat); return `<path d="M${f1(x)} ${f1(y)} l-7 -16 a8.5 8.5 0 1 1 14 0 z" fill="#f7dc9a" stroke="#1d1206" stroke-width="1.5"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2" fill="#1d1206"/>`; };

  // ———————————————————————— Les neuf modules ————————————————————————
  const M = {};

  M.pari = {
    nom: 'Le Pari', a: 'au Pari', emoji: '🎲', duree: 35,
    geste: 'Quatre réponses, une seule juste. Juste : encaisse, ou parie sur une question plus dure.',
    bareme: [['Pari gagné', 25], ['Encaissé', 10]],
    eclairerDit: 'efface deux mauvaises réponses',
    manche(ctx) { const q = ctx.pioche('qcm'); return { q, ordre: melanger([0, 1, 2, 3]), etape: 1, rep: null, efface: [], attente: false }; },
    peutEclairer(ctx) { const m = ctx.E.m; return !m.efface.length && m.rep == null; },
    eclairer(ctx) { const m = ctx.E.m; m.efface = melanger([0, 1, 2, 3].filter(i => i !== m.q.b)).slice(0, 2); },
    peutChanger(ctx) { return ctx.E.m.rep == null; },
    action(ctx, verbe, v) {
      const m = ctx.E.m;
      if (verbe === 'rep') {
        if (m.rep != null) return;
        m.rep = +v;
        if (m.rep !== m.q.b) return ctx.juger(0, { titre: m.etape === 2 ? 'Pari perdu' : 'Raté', savais: savaisQcm(m.q) });
        if (m.etape === 2) return ctx.juger(25, { titre: 'Pari gagné !', savais: savaisQcm(m.q) });
        if (ctx.E.type === 'gardien') return ctx.juger(10, { titre: 'Juste !', savais: savaisQcm(m.q) });
        ctx.chrono.arreter(); m.attente = true; return ctx.rendre();
      }
      if (verbe === 'garder' && m.attente) return ctx.juger(10, { titre: 'Encaissé', savais: savaisQcm(m.q) });
      if (verbe === 'parier' && m.attente) {
        m.q1 = m.q; m.q = ctx.pioche('qcm', { plusDur: true }); m.ordre = melanger([0, 1, 2, 3]);
        m.etape = 2; m.rep = null; m.efface = []; m.attente = false;
        ctx.chrono.relancer(); return ctx.rendre();
      }
    },
    tempsEcoule(ctx) { ctx.juger(0, { titre: 'Temps écoulé', savais: savaisQcm(ctx.E.m.q) }); },
    choix(m, revele) {
      return m.ordre.map(i => `<button class="choix${m.efface.includes(i) ? ' efface' : ''}${m.rep != null || revele ? (i === m.q.b ? ' juste' : i === m.rep ? ' faux' : '') : ''}" data-a="m" data-v="rep:${i}" ${m.rep != null || revele ? 'aria-disabled="true"' : ''}>${esc(m.q.r[i])}</button>`).join('');
    },
    rendre(ctx) {
      const m = ctx.E.m, q = m.q;
      const pari = m.attente ? `<div class="decision"><p>Juste ! Tu encaisses 10, ou tu paries sur une question plus dure : 25 si tu as raison, un cœur si tu te trompes.</p>
        <div class="grille2"><button class="bouton second" data-a="m" data-v="garder">Encaisser 10</button><button class="bouton" data-a="m" data-v="parier">Parier pour 25</button></div></div>` : '';
      return `<div class="bloc pile"><span class="etiquette">${m.etape === 2 ? 'Le pari · une question plus dure' : esc(q.c)}</span><h2 class="question" tabindex="-1">${typo(q.t)}</h2>${this.choix(m)}</div>${pari}`;
    },
    revele(ctx) { const m = ctx.E.m; return `<div class="bloc pile"><p class="petit">${typo(m.q.t)}</p>${this.choix(m, true)}</div>`; },
  };

  M.eclair = {
    nom: 'L’Éclair', a: 'à l’Éclair', emoji: '⚡', duree: 45,
    geste: 'Cinq affirmations, vite : vraies ou fausses ?',
    bareme: [['5 sur 5', 15], ['4 sur 5', 10], ['3 sur 5', 5]],
    eclairerDit: 'souffle la réponse de l’affirmation en cours',
    manche(ctx) {
      const l = [];
      for (let i = 0; i < 5; i++) {
        const q = ctx.pioche('qcm'), vrai = Math.random() < 0.5;
        l.push({ q, prop: q.r[vrai ? q.b : auHasard([0, 1, 2, 3].filter(x => x !== q.b))], vrai });
      }
      return { l, i: 0, reps: [], souffle: -1 };
    },
    peutEclairer(ctx) { const m = ctx.E.m; return m.i < 5 && m.souffle !== m.i; },
    eclairer(ctx) { ctx.E.m.souffle = ctx.E.m.i; },
    peutChanger(ctx) { return ctx.E.m.i === 0; },
    action(ctx, verbe, v) {
      const m = ctx.E.m;
      if (verbe !== 'v' || m.i >= 5) return;
      m.reps.push(v === '1'); m.i++;
      if (m.i >= 5) return this.fin(ctx);
      ctx.rendre();
    },
    fin(ctx) {
      const m = ctx.E.m, n = m.l.filter((x, i) => m.reps[i] === x.vrai).length;
      ctx.juger(n === 5 ? 15 : n === 4 ? 10 : n === 3 ? 5 : 0, { titre: `${n} sur 5`, savais: savaisQcm(m.l[0].q) });
    },
    tempsEcoule(ctx) { this.fin(ctx); },
    rendre(ctx) {
      const m = ctx.E.m, x = m.l[m.i], justes = m.reps.filter((r, i) => r === m.l[i].vrai).length;
      return `<div class="entre"><span class="etiquette">Affirmation ${m.i + 1} sur 5</span><span class="petit pale">${pluriel(justes, 'juste', 'justes')}</span></div>
        <div class="affirmation"><span class="q">${typo(x.q.t)}</span><h2 class="r" tabindex="-1">${esc(x.prop)}</h2>${m.souffle === m.i ? `<span class="souffle">Coup d’œil : c’est ${x.vrai ? 'vrai' : 'faux'}.</span>` : '<span></span>'}</div>
        <div class="grille2"><button class="bouton faux-vrai" data-a="m" data-v="v:0">Faux</button><button class="bouton faux-vrai vrai" data-a="m" data-v="v:1">Vrai</button></div>`;
    },
    revele(ctx) {
      const m = ctx.E.m;
      return `<div class="pile serre">${m.l.map((x, i) => { const r = m.reps[i], ok = r === x.vrai; return `<div class="ligne-eclair ${r === undefined ? '' : ok ? 'ok' : 'ko'}"><p class="mini pale">${typo(x.q.t)}</p><p class="petit"><b>${esc(x.prop)}</b> : ${x.vrai ? 'vrai' : 'faux, c’était ' + esc(x.q.r[x.q.b])}${r === undefined ? ' (pas répondu)' : ''}</p></div>`; }).join('')}</div>`;
    },
  };

  const AZERTY = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
  M.mot = {
    nom: 'Le Mot mystère', a: 'au Mot mystère', emoji: '🔤', duree: 120,
    geste: 'Trouve le mot avec la question pour indice. Cinq essais.',
    bareme: [['En 1 ou 2 essais', 15], ['En 3 ou 4', 10], ['Au 5e', 5]],
    eclairerDit: 'souffle une lettre',
    manche(ctx) { return { q: ctx.pioche('mot'), essais: [], saisie: '', souffle: [] }; },
    peutEclairer(ctx) { const m = ctx.E.m; return m.souffle.length < m.q.m.length - 2; },
    eclairer(ctx) {
      const m = ctx.E.m, idx = [...m.q.m].map((_, i) => i).filter(i => !m.souffle.includes(i));
      const libres = idx.filter(i => i >= m.saisie.length);
      m.souffle.push(auHasard(libres.length ? libres : idx));
      this.remplir(m);
    },
    peutChanger(ctx) { return !ctx.E.m.essais.length; },
    remplir(m) { while (m.saisie.length < m.q.m.length && m.souffle.includes(m.saisie.length)) m.saisie += m.q.m[m.saisie.length]; },
    couleurs(essai, mot) {
      const r = Array(mot.length).fill('absente'), reste = {};
      [...mot].forEach((c, i) => { if (essai[i] === c) r[i] = 'bien'; else reste[c] = (reste[c] || 0) + 1; });
      [...essai].forEach((c, i) => { if (r[i] !== 'bien' && reste[c]) { r[i] = 'ailleurs'; reste[c]--; } });
      return r;
    },
    action(ctx, verbe, t) {
      const m = ctx.E.m; if (verbe !== 't') return;
      const L = m.q.m.length;
      if (t === 'EFFACER') {
        m.saisie = m.saisie.slice(0, -1);
        while (m.saisie.length && m.souffle.includes(m.saisie.length - 1)) m.saisie = m.saisie.slice(0, -1);
      } else if (t === 'VALIDER') {
        if (m.saisie.length !== L) { ctx.toast(`Il faut ${L} lettres.`); return; }
        m.essais.push(m.saisie); m.saisie = '';
        if (m.essais[m.essais.length - 1] === m.q.m || m.essais.length >= 5) return this.fin(ctx);
        this.remplir(m);
      } else if (/^[A-Z]$/.test(t) && m.saisie.length < L) {
        this.remplir(m);
        if (m.saisie.length < L) { m.saisie += t; this.remplir(m); }
      }
      ctx.rendre();
    },
    fin(ctx) {
      const m = ctx.E.m, ok = m.essais.includes(m.q.m), n = m.essais.length;
      ctx.juger(!ok ? 0 : n <= 2 ? 15 : n <= 4 ? 10 : 5, { titre: ok ? 'Trouvé en ' + pluriel(n, 'essai', 'essais') : 'C’était « ' + esc(lettreMinuscule(m.q.aff)) + ' »', savais: m.q.a });
    },
    tempsEcoule(ctx) { this.fin(ctx); },
    grille(m, enJeu) {
      const L = m.q.m.length, lignes = [];
      for (let i = 0; i < 5; i++) {
        const e = m.essais[i];
        if (e) { const c = this.couleurs(e, m.q.m); lignes.push(`<div class="mot-ligne">${[...e].map((x, j) => `<span class="case ${c[j]}" aria-label="${x} ${c[j] === 'bien' ? 'bien placée' : c[j] === 'ailleurs' ? 'ailleurs dans le mot' : 'absente'}">${x}</span>`).join('')}</div>`); }
        else if (i === m.essais.length && enJeu) lignes.push(`<div class="mot-ligne en-cours">${Array.from({ length: L }, (_, j) => `<span class="case courante${!m.saisie[j] && m.souffle.includes(j) ? ' soufflee' : ''}">${m.saisie[j] || (m.souffle.includes(j) ? m.q.m[j] : '')}</span>`).join('')}</div>`);
        else lignes.push(`<div class="mot-ligne">${Array.from({ length: L }, () => '<span class="case"></span>').join('')}</div>`);
      }
      return `<div class="mot-grille">${lignes.join('')}</div>`;
    },
    rendre(ctx) {
      const m = ctx.E.m, L = m.q.m.length;
      return `<div class="bloc"><span class="etiquette">${esc(m.q.c)} · ${L} lettres</span><h2 class="question compacte" tabindex="-1">${typo(m.q.t)}</h2></div>
        <p class="legende-mot mini pale"><span><i class="pastille bien"></i>bien placée</span><span><i class="pastille ailleurs"></i>ailleurs</span><span><i class="pastille absente"></i>absente</span></p>
        ${this.grille(m, true)}`;
    },
    // Le clavier va au pied collé de l'écran, sous le pouce : celui du téléphone poussait « Valider » hors de vue.
    pied(ctx) {
      const m = ctx.E.m, etat = {};
      m.essais.forEach(e => this.couleurs(e, m.q.m).forEach((c, j) => { const x = e[j]; if (etat[x] !== 'bien') etat[x] = c === 'bien' ? 'bien' : etat[x] === 'ailleurs' ? 'ailleurs' : c; }));
      return `<div class="clavier">${AZERTY.map((r, i) => `<div class="rang">${i === 2 ? '<button class="touche large" data-a="m" data-v="t:EFFACER">Effacer</button>' : ''}${[...r].map(x => `<button class="touche ${etat[x] || ''}" data-a="m" data-v="t:${x}">${x}</button>`).join('')}${i === 2 ? '<button class="touche large valider" data-a="m" data-v="t:VALIDER">Valider</button>' : ''}</div>`).join('')}</div>`;
    },
    revele(ctx) { const m = ctx.E.m; return `<p class="petit">${typo(m.q.t)}</p>${this.grille(m, false)}`; },
  };

  M.filet = {
    nom: 'Le Filet', a: 'au Filet', emoji: '🎯', duree: 45,
    geste: 'Une date ou un nombre : place ton curseur, puis choisis ton filet. Petit, il rapporte plus.',
    bareme: [['Petit filet', 15], ['Moyen', 10], ['Grand', 5]],
    eclairerDit: 'montre une zone où se trouve la réponse',
    LARGEURS: { petit: [0.035, 15, 'Petit'], moyen: [0.09, 10, 'Moyen'], grand: [0.2, 5, 'Grand'] },
    // La réponse tombe n'importe où sur la piste, et le curseur part du milieu : rester au centre ne paie pas.
    manche(ctx) {
      const q = ctx.pioche('filet'), pos = 0.08 + Math.random() * 0.84;
      let min, max;
      if (q.annee) { const span = 50 + Math.floor(Math.random() * 70); min = Math.round(q.v - pos * span); max = min + span; }
      else { const brut = q.v / pos, ordre = Math.pow(10, Math.max(0, Math.floor(Math.log10(brut)) - 1)); min = 0; max = Math.max(q.v + 1, Math.ceil(brut / ordre) * ordre); }
      return { q, min, max, x: Math.round((min + max) / 2), largeur: 'moyen', chaud: null };
    },
    peutEclairer(ctx) { return !ctx.E.m.chaud; },
    eclairer(ctx) { const m = ctx.E.m, w = (m.max - m.min) * 0.3, d = Math.random() * w * 0.8; m.chaud = [Math.max(m.min, m.q.v - d), Math.min(m.max, m.q.v - d + w)]; },
    peutChanger() { return true; },
    pas(m) { return m.q.annee ? 1 : Math.max(1, Math.round((m.max - m.min) / 200)); },
    pct(m, v) { return Math.max(0, Math.min(100, 100 * (v - m.min) / (m.max - m.min))); },
    dire(m, v) { return m.q.annee ? String(v) : nombre(v) + (m.q.u ? ' ' + m.q.u : ''); },
    bornes(m) { const w = (m.max - m.min) * this.LARGEURS[m.largeur][0]; return `ton filet : de ${this.dire(m, Math.max(m.min, Math.round(m.x - w)))} à ${this.dire(m, Math.min(m.max, Math.round(m.x + w)))}`; },
    bouger(ctx, v) {
      const m = ctx.E.m; m.x = Math.max(m.min, Math.min(m.max, Math.round(Number(v))));
      const el = document.querySelector('.filet-valeur'); if (el) el.textContent = this.dire(m, m.x);
      const c = document.getElementById('curseur-filet'); if (c && +c.value !== m.x) c.value = m.x;
      const w = (m.max - m.min) * this.LARGEURS[m.largeur][0], maille = document.querySelector('.maille');
      if (maille) { maille.style.left = this.pct(m, m.x - w) + '%'; maille.style.width = (this.pct(m, m.x + w) - this.pct(m, m.x - w)) + '%'; }
      const b = document.querySelector('.filet-bornes'); if (b) b.textContent = this.bornes(m);
    },
    saisie(ctx, nom, valeur) { if (nom === 'curseur-filet') this.bouger(ctx, valeur); },
    action(ctx, verbe, v) {
      const m = ctx.E.m;
      if (verbe === 'moins') return this.bouger(ctx, m.x - this.pas(m));
      if (verbe === 'plus') return this.bouger(ctx, m.x + this.pas(m));
      if (verbe === 'largeur') { m.largeur = v; return ctx.rendre(); }
      if (verbe === 'lancer') return this.lancer(ctx);
    },
    lancer(ctx) {
      const m = ctx.E.m, [f, or] = this.LARGEURS[m.largeur], w = (m.max - m.min) * f;
      m.dedans = Math.abs(m.q.v - m.x) <= w;
      ctx.juger(m.dedans ? or : 0, { titre: m.dedans ? 'Dans le filet !' : 'À côté', sous: `La réponse : ${this.dire(m, m.q.v)} · tu visais ${this.dire(m, m.x)}.`, savais: m.q.a });
    },
    tempsEcoule(ctx) { this.lancer(ctx); },
    piste(m, revele) {
      const w = (m.max - m.min) * this.LARGEURS[m.largeur][0];
      return `<div class="filet-piste"><div class="rail"></div>${m.chaud ? `<div class="chaud" style="left:${this.pct(m, m.chaud[0])}%;width:${this.pct(m, m.chaud[1]) - this.pct(m, m.chaud[0])}%"></div>` : ''}<div class="maille" style="left:${this.pct(m, m.x - w)}%;width:${this.pct(m, m.x + w) - this.pct(m, m.x - w)}%"></div>${revele ? `<div class="vrai" style="left:${this.pct(m, m.q.v)}%"></div>` : ''}<div class="bornes"><span>${this.dire(m, m.min)}</span><span>${this.dire(m, m.max)}</span></div></div>`;
    },
    rendre(ctx) {
      const m = ctx.E.m;
      return `<div class="bloc"><span class="etiquette">${esc(m.q.c)}</span><h2 class="question" tabindex="-1">${typo(m.q.t)}</h2></div>
        <div class="filet-lecture"><span class="filet-valeur">${this.dire(m, m.x)}</span><span class="petit pale filet-bornes">${this.bornes(m)}</span></div>
        ${this.piste(m, false)}
        ${m.chaud ? '<div class="bandeau">Coup d’œil : la réponse est dans la zone dorée.</div>' : ''}
        <div class="ligne"><button class="touche-fine" data-a="m" data-v="moins" aria-label="Un cran de moins">−</button><input id="curseur-filet" type="range" min="${m.min}" max="${m.max}" step="${this.pas(m)}" value="${m.x}" data-i="curseur-filet" aria-label="Ton estimation"><button class="touche-fine" data-a="m" data-v="plus" aria-label="Un cran de plus">+</button></div>
        <div class="grille3" role="group" aria-label="La taille de ton filet">${Object.entries(this.LARGEURS).map(([k, [, or, n]]) => `<button class="choix centre${m.largeur === k ? ' pris' : ''}" aria-pressed="${m.largeur === k}" data-a="m" data-v="largeur:${k}"><span>${n}</span><span class="mini">${or} <i class="piece"></i></span></button>`).join('')}</div>`;
    },
    pied() { return '<button class="bouton" data-a="m" data-v="lancer">Lancer le filet</button>'; },
    revele(ctx) { const m = ctx.E.m; return `<div class="bloc"><p class="petit">${typo(m.q.t)}</p>${this.piste(m, true)}</div>`; },
  };

  M.detail = {
    nom: 'Le Détail', a: 'au Détail', emoji: '🖼️', duree: 45,
    geste: 'Reconnais le tableau à un détail. Chaque pas en arrière en montre plus, et rapporte moins.',
    bareme: [['Au premier coup d’œil', 15], ['Un pas en arrière', 10], ['Deux pas ou plus', 5]],
    eclairerDit: 'efface deux mauvais titres',
    manche(ctx) {
      const t = ctx.pioche('tableau');
      // Les leurres sont les tableaux les plus proches dans le temps : deviner l'époque ne suffit pas.
      const autres = window.TABLEAUX.filter(x => x.q !== t.q).sort((a, b) => Math.abs(a.a - t.a) - Math.abs(b.a - t.a)).slice(0, 5);
      return { t, choix: melanger([t, ...melanger(autres).slice(0, 3)]), cadrage: 1, efface: [], rep: null };
    },
    peutEclairer(ctx) { return !ctx.E.m.efface.length; },
    eclairer(ctx) { const m = ctx.E.m; m.efface = melanger(m.choix.filter(c => c.q !== m.t.q)).slice(0, 2).map(c => c.q); },
    peutChanger(ctx) { return ctx.E.m.cadrage === 1; },
    vaut(m) { return m.cadrage === 1 ? 15 : m.cadrage === 2 ? 10 : 5; },
    action(ctx, verbe, v) {
      const m = ctx.E.m;
      if (verbe === 'reculer' && m.cadrage < 4) { m.cadrage++; return ctx.rendre(); }
      if (verbe === 'rep') {
        m.rep = v; const ok = v === m.t.q;
        return ctx.juger(ok ? this.vaut(m) : 0, { titre: ok ? (m.cadrage === 1 ? 'Au premier coup d’œil !' : 'Reconnu') : 'C’était…', sous: ok ? '' : `Tu avais répondu « ${esc(window.TABLEAUX.find(x => x.q === v).t)} ».`, savais: m.t.an || '' });
      }
    },
    tempsEcoule(ctx) { ctx.juger(0, { titre: 'Temps écoulé', savais: ctx.E.m.t.an || '' }); },
    rendre(ctx) {
      const m = ctx.E.m;
      return `<div class="tableau"><img src="tableaux/${m.t.q}-${m.cadrage}.webp" alt="Un détail du tableau à reconnaître"></div>
        <div class="entre"><span class="petit pale">Ta réponse vaut ${this.vaut(m)} <i class="piece"></i></span><button class="puce" data-a="m" data-v="reculer" ${m.cadrage >= 4 ? 'aria-disabled="true"' : ''}>Reculer d’un pas</button></div>
        <h2 class="sr" tabindex="-1">Quel est ce tableau ?</h2>
        <div class="pile serre">${m.choix.map(c => `<button class="choix${m.efface.includes(c.q) ? ' efface' : ''}" data-a="m" data-v="rep:${c.q}"><span>${esc(c.t)}<br><span class="mini pale">${esc(c.p)}</span></span></button>`).join('')}</div>`;
    },
    revele(ctx) {
      const m = ctx.E.m;
      return `<div class="tableau"><img src="tableaux/${m.t.q}-4.webp" alt="${esc(m.t.t)}"></div>
        <div class="cartel"><span class="etiquette">${esc(m.t.p)} · ${m.t.a}</span><p class="phrase">${esc(m.t.t)}</p></div>`;
    },
  };

  M.frise = {
    nom: 'La Frise', a: 'à la Frise', emoji: '⏳', duree: 60, sansGardien: true,
    geste: 'Range les événements du plus ancien au plus récent. À chaque manche, la frise s’allonge.',
    bareme: [['Sans faute', 15], ['Une erreur', 10], ['Deux erreurs', 5]],
    eclairerDit: 'dévoile l’année d’un nouveau venu',
    preparer(ctx) {
      const E = ctx.E, f = window.FRISES.find(x => x.theme === E.theme) || auHasard(window.FRISES);
      const e = melanger(f.evts.map(([lb, an]) => ({ lb, an })));
      E.frise = { savais: f.savais, vagues: [e.slice(0, 3), e.slice(3, 5), e.slice(5, 7)], posees: [] };
    },
    manche(ctx) { const F = ctx.E.frise, i = ctx.E.manche; return { neufs: F.vagues[i].map(x => ({ ...x })), ordre: i === 0 ? [] : F.posees.map(x => ({ ...x, ancre: true })), choisi: null, devoiles: [] }; },
    peutEclairer(ctx) { const m = ctx.E.m; return [...m.neufs, ...m.ordre.filter(x => !x.ancre)].some(x => !m.devoiles.includes(x.lb)); },
    eclairer(ctx) { const m = ctx.E.m, x = [...m.neufs, ...m.ordre.filter(o => !o.ancre)].find(n => !m.devoiles.includes(n.lb)); if (x) m.devoiles.push(x.lb); },
    peutChanger() { return false; },
    refusDeChanger: 'Échange ne sert pas à la Frise, qui se construit d’un bout à l’autre.',
    action(ctx, verbe, v) {
      const m = ctx.E.m;
      if (verbe === 'choisir') { m.choisi = m.choisi === v ? null : v; return ctx.rendre(); }
      if (verbe === 'placer' && m.choisi) {
        let i = +v, item;
        const k = m.neufs.findIndex(x => x.lb === m.choisi);
        if (k >= 0) item = m.neufs.splice(k, 1)[0];
        else { const j = m.ordre.findIndex(x => x.lb === m.choisi && !x.ancre); if (j < 0) return; item = m.ordre.splice(j, 1)[0]; if (j < i) i--; }
        m.ordre.splice(i, 0, item); m.choisi = null; return ctx.rendre();
      }
      if (verbe === 'valider' && !m.neufs.length) return this.valider(ctx);
    },
    // Un nouveau venu est faux si un voisin le contredit : un plus récent avant lui, ou un plus ancien après.
    erreurs(ordre) {
      const faux = new Set();
      ordre.forEach((x, i) => { if (x.ancre) return; if (!(ordre.slice(0, i).every(y => y.an <= x.an) && ordre.slice(i + 1).every(y => y.an >= x.an))) faux.add(x.lb); });
      return faux;
    },
    valider(ctx) {
      const E = ctx.E, m = E.m, faux = this.erreurs(m.ordre), n = faux.size + m.neufs.length;
      m.faux = faux; m.manquants = m.neufs.map(x => x.lb);
      E.frise.posees = [...m.ordre, ...m.neufs].map(x => ({ lb: x.lb, an: x.an })).sort((a, b) => a.an - b.an);
      ctx.juger(n === 0 ? 15 : n === 1 ? 10 : n === 2 ? 5 : 0, { titre: n === 0 ? 'Sans faute' : pluriel(n, 'erreur', 'erreurs'), sous: n ? 'En rouge, ceux qui n’étaient pas à leur place : les voici à leur vraie année.' : '', savais: E.manche === 2 ? E.frise.savais : '' });
    },
    tempsEcoule(ctx) { this.valider(ctx); },
    rendre(ctx) {
      const m = ctx.E.m;
      const an = x => (x.ancre || m.devoiles.includes(x.lb) ? x.an : '');
      const fente = i => `<button class="fente${m.choisi ? ' vivante' : ''}" data-a="m" data-v="placer:${i}" ${m.choisi ? '' : 'tabindex="-1"'} aria-label="Placer ici">${m.choisi ? 'Placer ici' : ''}</button>`;
      let l = fente(0);
      m.ordre.forEach((x, i) => {
        l += x.ancre
          ? `<div class="evt"><span class="an">${an(x)}</span><span class="pt"></span><span class="lb">${typo(x.lb)}</span></div>`
          : `<button class="evt neuf${m.choisi === x.lb ? ' pris' : ''}" data-a="m" data-v="choisir:${esc(x.lb)}"><span class="an">${an(x)}</span><span class="pt"></span><span class="lb">${typo(x.lb)}</span></button>`;
        l += fente(i + 1);
      });
      const reserve = m.neufs.map(x => `<button class="a-placer${m.choisi === x.lb ? ' pris' : ''}" data-a="m" data-v="choisir:${esc(x.lb)}">${typo(x.lb)}${m.devoiles.includes(x.lb) ? ` <span class="an-devoile">${x.an}</span>` : ''}</button>`).join('');
      return `<h2 class="consigne petit" tabindex="-1">${m.neufs.length ? (m.choisi ? 'Touche maintenant l’endroit où il va.' : 'Touche un événement, puis l’endroit où il va.') : 'Tout est placé. Touche un événement posé pour le déplacer, ou valide.'}</h2>
        ${reserve ? `<div class="reserve"><span class="mini pale">À placer</span>${reserve}</div>` : ''}
        <p class="mini pale">↑ Plus ancien</p><div class="frise">${l}</div><p class="mini pale">↓ Plus récent</p>`;
    },
    pied(ctx) { return `<button class="bouton" data-a="m" data-v="valider" ${ctx.E.m.neufs.length ? 'aria-disabled="true"' : ''}>${ctx.E.m.neufs.length ? `Encore ${pluriel(ctx.E.m.neufs.length, 'événement', 'événements')} à placer` : 'Valider la frise'}</button>`; },
    revele(ctx) {
      const E = ctx.E, m = E.m, vague = E.frise.vagues[E.manche].map(v => v.lb);
      return `<p class="mini pale">↑ Plus ancien</p><div class="frise">${E.frise.posees.map(x => `<div class="evt ${m.faux.has(x.lb) || m.manquants.includes(x.lb) ? 'faux' : vague.includes(x.lb) ? 'juste' : ''}"><span class="an">${x.an}</span><span class="pt"></span><span class="lb">${typo(x.lb)}</span></div>`).join('')}</div><p class="mini pale">↓ Plus récent</p>`;
    },
  };

  M.epingle = {
    nom: 'L’Épingle', a: 'à l’Épingle', emoji: '📍', duree: 45,
    geste: 'Une histoire, un lieu : plante l’épingle sur la carte de France.',
    bareme: [['À moins de 40 km', 15], ['De 40 à 120 km', 10], ['De 120 à 300 km', 5]],
    eclairerDit: 'entoure une zone où chercher',
    preparer(ctx) {
      const E = ctx.E, g = window.EPINGLES.find(x => x.theme === E.theme) || auHasard(window.EPINGLES);
      E.lieux = melanger(g.lieux.map(l => ({ ...l, theme: g.theme })));
    },
    manche(ctx, change) {
      const E = ctx.E;
      // En épreuve, les trois lieux du thème ; contre un gardien ou après un Échange, un lieu d'ailleurs.
      const lieu = !change && E.lieux && E.lieux[E.manche] ? E.lieux[E.manche] : ctx.pioche('lieu');
      return { lieu, pin: null, zone: null };
    },
    peutEclairer(ctx) { return !ctx.E.m.zone; },
    eclairer(ctx) { const l = ctx.E.m.lieu, a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 100; ctx.E.m.zone = { lat: l.lat + Math.sin(a) * d / 111, lon: l.lon + Math.cos(a) * d / (111 * COS), r: 170 }; },
    peutChanger(ctx) { return !ctx.E.m.pin; },
    action(ctx, verbe, v, ev) {
      const m = ctx.E.m;
      if (verbe === 'carte' && ev) {
        const svg = ev.target.closest('svg'); if (!svg) return;
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const [lon, lat] = deproj(p.x, p.y); m.pin = { lon, lat }; return ctx.rendre();
      }
      if (verbe === 'planter' && m.pin) return this.planter(ctx);
    },
    planter(ctx) {
      const m = ctx.E.m, l = m.lieu;
      m.km = m.pin ? distanceKm(m.pin.lat, m.pin.lon, l.lat, l.lon) : null;
      const or = m.km == null ? 0 : m.km < 40 ? 15 : m.km < 120 ? 10 : m.km < 300 ? 5 : 0;
      ctx.juger(or, { titre: m.km == null ? 'Pas d’épingle' : 'À ' + nombre(Math.floor(m.km)) + ' km', sous: `${esc(l.ville)} · ${esc(l.date)}`, savais: l.savais });
    },
    tempsEcoule(ctx) { this.planter(ctx); },
    dessus(m, revele) {
      let d = '';
      if (m.zone) { const [x, y] = proj(m.zone.lon, m.zone.lat); d += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(m.zone.r / 111 * K)}" fill="rgba(120,178,255,.14)" stroke="#78b2ff" stroke-dasharray="4 3"/>`; }
      if (m.pin) d += epingleSvg(m.pin.lon, m.pin.lat);
      if (revele) {
        const [x, y] = proj(m.lieu.lon, m.lieu.lat);
        if (m.pin) { const [a, b] = proj(m.pin.lon, m.pin.lat); d += `<line x1="${f1(a)}" y1="${f1(b)}" x2="${f1(x)}" y2="${f1(y)}" stroke="#f6efe4" stroke-dasharray="3 3"/>`; }
        d += `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="#7ee2a8" stroke="#0b1a14" stroke-width="2"/><text x="${f1(x + 10)}" y="${f1(y + 5)}" font-size="13" font-weight="700" fill="#e9fff3" font-family="Nunito Sans, sans-serif">${esc(m.lieu.nom)}</text>`;
      }
      return d;
    },
    rendre(ctx) {
      const m = ctx.E.m, l = m.lieu;
      return `<div class="cartel"><span class="etiquette">${esc(l.date)} · ${esc(l.theme || ctx.E.theme)}</span><p class="petit">${typo(l.recit)}</p><h2 class="phrase" tabindex="-1">${typo(l.q)}</h2></div>
        ${m.zone ? '<div class="bandeau">Coup d’œil : c’est quelque part dans la zone entourée.</div>' : ''}
        <div class="zone-carte">${carteSvg(this.dessus(m, false), true)}</div>`;
    },
    pied(ctx) { const m = ctx.E.m; return `<button class="bouton" data-a="m" data-v="planter" ${m.pin ? '' : 'aria-disabled="true"'}>${m.pin ? 'Planter ici' : 'Touche la carte de France'}</button>`; },
    revele(ctx) { const m = ctx.E.m; return `<div class="zone-carte">${carteSvg(this.dessus(m, true), false)}</div>`; },
  };

  // Une réponse se lit mot à mot : chaque mot tapé doit appartenir au nom attendu (une faute de frappe tolérée).
  const MOTS_VIDES = new Set(['de', 'd', 'la', 'le', 'du', 'l']);
  function proche(a, b) {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length] <= 1;
  }
  function bonneIdentite(saisie, p) {
    const mots = sansAccent(saisie).split(/[^a-z]+/).filter(w => w && !MOTS_VIDES.has(w));
    const permis = new Set([...sansAccent(p.rep).split(/[^a-z]+/), ...p.cles].filter(Boolean));
    if (!mots.length || mots.length > 4) return false;
    return mots.every(w => [...permis].some(x => proche(w, x))) && mots.some(w => p.cles.some(k => proche(w, k)));
  }

  M.indices = {
    nom: 'Les Indices', a: 'aux Indices', emoji: '🕵️', duree: 75,
    geste: 'Qui suis-je ? Trouve la personne avec le moins d’indices possible.',
    bareme: [['En 1 ou 2 indices', 15], ['En 3', 10], ['En 4 ou 5', 5]],
    eclairerDit: 'donne un indice sans qu’il compte',
    manche(ctx) { return { p: ctx.pioche('qui'), vus: 1, gratuits: 0, faux: [], saisie: '', ok: false, msg: '' }; },
    peutEclairer(ctx) { return ctx.E.m.vus < 5; },
    eclairer(ctx) { ctx.E.m.vus++; ctx.E.m.gratuits++; },
    peutChanger(ctx) { return ctx.E.m.vus === 1 && !ctx.E.m.faux.length; },
    compte(m) { return m.vus - m.gratuits + m.faux.length; },
    vaut(m) { const n = this.compte(m); return n <= 2 ? 15 : n === 3 ? 10 : 5; },
    saisie(ctx, nom, valeur) { if (nom === 'qui') ctx.E.m.saisie = valeur; },
    action(ctx, verbe) {
      const m = ctx.E.m;
      if (verbe === 'plus' && m.vus < 5) { m.vus++; return ctx.rendre(); }
      if (verbe !== 'repondre' || !m.saisie.trim()) return;
      if (bonneIdentite(m.saisie, m.p)) { m.ok = true; return ctx.juger(this.vaut(m), { titre: 'Trouvé : ' + esc(m.p.rep), sous: `Avec ${pluriel(m.vus, 'indice', 'indices')} sous les yeux${m.gratuits ? ` (dont ${m.gratuits} offert${m.gratuits > 1 ? 's' : ''})` : ''}${m.faux.length ? ` et ${pluriel(m.faux.length, 'erreur', 'erreurs')}` : ''}.`, savais: m.p.savais }); }
      m.faux.push(m.saisie); m.saisie = '';
      if (m.vus < 5) { m.vus++; m.msg = 'Non, ce n’est pas ça. Un indice de plus.'; return ctx.rendre(); }
      ctx.juger(0, { titre: 'C’était ' + esc(m.p.rep), savais: m.p.savais });
    },
    tempsEcoule(ctx) { ctx.juger(0, { titre: 'C’était ' + esc(ctx.E.m.p.rep), savais: ctx.E.m.p.savais }); },
    liste(m, tout) { return `<div class="pile serre">${m.p.ind.slice(0, tout ? 5 : m.vus).map((x, i) => `<div class="indice"><b>${i + 1}</b><span>${typo(x)}</span></div>`).join('')}</div>`; },
    rendre(ctx) {
      const m = ctx.E.m, msg = m.msg; m.msg = '';
      return `<div class="entre"><h2 class="etiquette" tabindex="-1">Qui suis-je ?</h2><span class="petit or-texte">ta réponse vaut ${this.vaut(m)} <i class="piece"></i></span></div>
        ${this.liste(m, false)}
        ${msg ? `<div class="bandeau">${msg}</div>` : ''}
        ${m.faux.length ? `<p class="mini pale">Déjà essayé : ${m.faux.map(esc).join(', ')}</p>` : ''}
        <form class="pile serre" data-f="indices"><label class="petit gras" for="reponse-qui">Ta réponse : un nom</label><input class="champ" id="reponse-qui" autocomplete="off" autocapitalize="words" spellcheck="false" value="${esc(m.saisie)}" data-i="qui">
        <div class="grille2"><button type="button" class="bouton second" data-a="m" data-v="plus" ${m.vus >= 5 ? 'aria-disabled="true"' : ''}>Un indice de plus</button><button type="submit" class="bouton">Répondre</button></div></form>`;
    },
    revele(ctx) { return this.liste(ctx.E.m, true); },
  };

  M.replique = {
    nom: 'La Réplique', a: 'à la Réplique', emoji: '🎬', duree: 25,
    geste: 'Complète la réplique culte, puis dis qui l’a dite.',
    bareme: [['Le mot et la personne', 15], ['Le mot seul', 10], ['La personne seule', 5]],
    eclairerDit: 'efface deux mauvaises propositions',
    manche(ctx) { const r = ctx.pioche('rep'); return { r, mots: melanger([r.mot, ...r.leurres]), qui: melanger([r.qui, ...r.autres]), etape: 1, mot: null, quiRep: null, efface: [] }; },
    peutEclairer(ctx) { return !ctx.E.m.efface.length; },
    eclairer(ctx) { const m = ctx.E.m, l = m.etape === 1 ? m.mots.filter(x => x !== m.r.mot) : m.qui.filter(x => x !== m.r.qui); m.efface = melanger(l).slice(0, m.etape === 1 ? 2 : 1); },
    peutChanger(ctx) { return ctx.E.m.etape === 1; },
    action(ctx, verbe, w) {
      const m = ctx.E.m;
      // Chaque question a son chrono : on ne perd pas « Qui l'a dit ? » à cause du mot.
      if (verbe === 'mot' && m.etape === 1) { m.mot = w; m.etape = 2; m.efface = []; ctx.chrono.relancer(); return ctx.rendre(); }
      if (verbe === 'qui' && m.etape === 2) { m.quiRep = w; return this.fin(ctx); }
    },
    fin(ctx) {
      const m = ctx.E.m, r = m.r, mot = m.mot === r.mot, qui = m.quiRep === r.qui;
      ctx.juger(mot && qui ? 15 : mot ? 10 : qui ? 5 : 0, { titre: mot && qui ? 'Le mot et la personne !' : mot ? 'Le bon mot' : qui ? 'La bonne personne' : 'C’était « ' + esc(r.mot) + ' »', sous: `${esc(r.qui)} · ${esc(r.film)}`, savais: '' });
    },
    tempsEcoule(ctx) {
      const m = ctx.E.m;
      if (m.etape === 1) { m.mot = null; m.etape = 2; m.efface = []; ctx.toast('Temps écoulé pour le mot. Qui l’a dit ?'); ctx.chrono.relancer(); return ctx.rendre(); }
      this.fin(ctx);
    },
    phrase(m, mot) { return `<div class="replique"><p>« ${typo(m.r.avant)} <span class="trou">${mot ? esc(mot) : ' '}</span>${typo(m.r.apres)} »</p></div>`; },
    rendre(ctx) {
      const m = ctx.E.m;
      if (m.etape === 1) return `<h2 class="etiquette" tabindex="-1">1 · Le mot qui manque</h2>${this.phrase(m, m.mot)}<div class="grille2">${m.mots.map(w => `<button class="choix centre grand${m.efface.includes(w) ? ' efface' : ''}" data-a="m" data-v="mot:${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
      return `<h2 class="etiquette" tabindex="-1">2 · Qui l’a dite ?</h2>${this.phrase(m, m.mot)}<div class="pile serre">${m.qui.map(w => `<button class="choix${m.efface.includes(w) ? ' efface' : ''}" data-a="m" data-v="qui:${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
    },
    revele(ctx) { const m = ctx.E.m; return `${this.phrase(m, m.r.mot)}${m.quiRep && m.quiRep !== m.r.qui ? `<p class="petit pale">Tu avais répondu ${esc(m.quiRep)}.</p>` : ''}`; },
  };

  // Les noms tels qu'on les dit : « au Pari », « à l'Épingle ».
  window.CABINET_JEUX = { MODULES: M, ordre: ['pari', 'eclair', 'mot', 'filet', 'detail', 'frise', 'epingle', 'indices', 'replique'], outils: { esc, typo, melanger, auHasard, nombre, pluriel, sansAccent } };
})();

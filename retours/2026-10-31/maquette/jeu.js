// Le Cabinet en trois actes : la maquette jouable de la refonte du 31 octobre 2026.
//
// Une partie, trois actes. Un acte : une carte à chemins (chaque étape est un jeu sur un thème,
// ou un coffre), un marchand, puis un gardien légendaire. Quatre notions, pas une de plus :
// les cœurs, l'or, tes cartes, la carte. Bonne réponse : de l'or. Erreur : un cœur.
// Les trois gardiens vaincus, l'un d'eux est à toi.
//
// La partie vit dans le navigateur (localStorage) : elle se reprend où on l'a laissée.
// La carte 3D (scene.js) se charge à part : sans WebGL, tout se joue depuis le panneau.

const { MODULES, outils } = window.CABINET_JEUX;
const { esc, typo, melanger, auHasard, pluriel } = outils;
const $ = s => document.querySelector(s);

// ———————————————————————————————— Les règles, en chiffres ————————————————————————————————

const COEURS_DE_DEPART = 5;
const PV_DES_GARDIENS = [3, 4, 5];
const OR_D_UN_GARDIEN = 30;
const PRIX = { coeur: 25, carte: 60, amelioration: 45 };
const CLE = 'cabinet-trois-actes-v1';

const ACTES = [
  { court: 'Acte I', nom: 'La Serre aux merveilles', teinte: 152, niveau: 'facile', niveauGardien: 'moyen' },
  { court: 'Acte II', nom: 'La Bibliothèque engloutie', teinte: 262, niveau: 'moyen', niveauGardien: 'difficile' },
  { court: 'Acte III', nom: 'L’Observatoire', teinte: 32, niveau: 'difficile', niveauGardien: 'difficile' },
];

const THEMES = {
  'Culture générale': '🧠', Histoire: '🏰', Géographie: '🌍', Sciences: '🔬', Nature: '🌿', 'Cinéma & séries': '🎬',
  Musique: '🎵', 'Arts & lettres': '🎨', Sport: '⚽', Cuisine: '🍳', 'Jeux & pop culture': '🎮', 'Autour de la fête': '🎉',
};
const THEME_FIXE = { detail: 'Peinture', indices: 'Personnages célèbres', replique: 'Répliques cultes' };
const EMOJI_DU_THEME = { Peinture: '🎨', 'Personnages célèbres': '👤', 'Répliques cultes': '💬' };
const JEUX_DE_LA_BASE = ['pari', 'eclair', 'mot', 'filet'];
// Ce que le contenu écrit à la main permet sur une partie : un thème ne revient jamais.
const PLAFOND = { frise: 3, epingle: 4, detail: 3, indices: 3, replique: 3 };

// Les dix cartes-bonus : dix peintures du Cabinet, dix effets qui se disent en une phrase.
const CARTES = {
  'coup-d-oeil': { nom: 'Coup d’œil', sorte: 'active', dit: n => `${n === 2 ? 'Deux fois' : 'Une fois'} par épreuve : un indice sur la manche en cours.` },
  echange: { nom: 'Échange', sorte: 'active', dit: n => `${n === 2 ? 'Deux fois' : 'Une fois'} par épreuve : change la manche pour une autre du même jeu.` },
  'quitte-ou-double': { nom: 'Quitte ou double', sorte: 'active', dit: n => `Une fois par épreuve, mise sur ta réponse : juste, son or est ${n === 2 ? 'triplé' : 'doublé'} ; fausse, elle coûte 2 cœurs.` },
  concentration: { nom: 'Concentration', sorte: 'passive', dit: n => `${n === 2 ? '20' : '10'} secondes de plus à chaque manche.` },
  parade: { nom: 'Parade', sorte: 'passive', dit: n => n === 2 ? 'Ta première erreur de chaque épreuve ne coûte pas de cœur, contre les gardiens aussi.' : 'Ta première erreur de chaque épreuve ne coûte pas de cœur (pas contre les gardiens).' },
  cagnotte: { nom: 'Cagnotte', sorte: 'passive', dit: n => `${n === 2 ? '10' : '5'} pièces de plus à chaque bonne réponse.` },
  panacee: { nom: 'Panacée', sorte: 'passive', dit: n => `${n === 2 ? 'Deux cœurs' : 'Un cœur'} de plus au maximum.` },
  pourboire: { nom: 'Pourboire', sorte: 'passive', dit: n => `Le marchand te fait ${n === 2 ? '20' : '10'} pièces de remise sur chaque achat.` },
  'coup-de-grace': { nom: 'Coup de grâce', sorte: 'passive', dit: n => `Chaque gardien commence avec ${n === 2 ? 'deux points' : 'un point'} de vie en moins.` },
  'second-souffle': { nom: 'Second souffle', sorte: 'unique', dit: n => `Une fois par partie : à ton dernier cœur perdu, tu te relèves avec ${n === 2 ? '4' : '2'} cœurs.` },
};
const ORDRE_DES_CARTES = Object.keys(CARTES);
const SORTE_DITE = { active: 'À jouer', passive: 'Toujours active', unique: 'Une fois par partie' };
const imgCarte = cle => `cartes/${cle}.webp`;

// Les gardiens : vingt et un légendaires, chacun ses trois jeux et sa devise.
const LEGENDAIRES = {
  renard: { nom: 'Le Renard', devise: 'Il ment avec aplomb. Démêle le vrai du faux.', jeux: ['eclair', 'pari', 'replique'] },
  coq: { nom: 'Le Coq', devise: 'Premier levé, premier à répondre.', jeux: ['eclair', 'filet', 'pari'] },
  chouette: { nom: 'La Chouette d’Argent', devise: 'Elle a tout lu, et elle s’en souvient.', jeux: ['mot', 'indices', 'pari'] },
  tigre: { nom: 'Le Tigre', devise: 'Il frappe vite. Ne traîne pas.', jeux: ['eclair', 'pari', 'filet'] },
  'chauve-souris': { nom: 'La Chauve-souris', devise: 'Elle voit dans le noir ce que tu cherches.', jeux: ['detail', 'mot', 'eclair'] },
  scarabee: { nom: 'Le Scarabée', devise: 'Il garde les lieux anciens.', jeux: ['epingle', 'detail', 'indices'] },
  citrouille: { nom: 'La Citrouille', devise: 'Ce soir, c’est sa fête.', jeux: ['mot', 'eclair', 'replique'] },
  sphinx: { nom: 'Le Sphinx', devise: 'Il ne laisse passer que ceux qui savent.', jeux: ['indices', 'mot', 'replique'] },
  janus: { nom: 'Janus', devise: 'Deux visages : l’un dit vrai, l’autre ment.', jeux: ['eclair', 'replique', 'indices'] },
  phenix: { nom: 'Le Phénix', devise: 'Il renaît de ses cendres. Toi, de tes erreurs.', jeux: ['pari', 'filet', 'detail'] },
  fantome: { nom: 'Le Fantôme', devise: 'Il hante les tableaux et les vieux films.', jeux: ['detail', 'replique', 'indices'] },
  salamandre: { nom: 'La Salamandre', devise: 'Elle joue avec le feu, et avec les chiffres.', jeux: ['filet', 'pari', 'eclair'] },
  lion: { nom: 'Le Lion', devise: 'Il règne sur la carte de France.', jeux: ['epingle', 'pari', 'indices'] },
  oracle: { nom: 'L’Oracle', devise: 'Il connaît les dates avant qu’elles arrivent.', jeux: ['filet', 'eclair', 'indices'] },
  serpent: { nom: 'Le Serpent', devise: 'Il glisse un mot faux dans chaque phrase.', jeux: ['mot', 'eclair', 'pari'] },
  dragon: { nom: 'Le Dragon', devise: 'Il garde son or. Prends-le-lui.', jeux: ['pari', 'filet', 'epingle'] },
  kraken: { nom: 'Le Kraken', devise: 'Il remonte des abysses avec ses questions.', jeux: ['epingle', 'filet', 'pari'] },
  chimere: { nom: 'La Chimère', devise: 'Trois têtes, trois jeux, aucune pitié.', jeux: ['detail', 'mot', 'epingle'] },
  ouroboros: { nom: 'L’Ouroboros', devise: 'Tout revient. Surtout les erreurs.', jeux: ['filet', 'eclair', 'replique'] },
  'trou-noir': { nom: 'Le Trou noir', devise: 'Rien ne lui échappe, pas même la lumière.', jeux: ['filet', 'detail', 'mot'] },
  comete: { nom: 'La Comète', devise: 'Elle ne passe qu’une fois. Ne la rate pas.', jeux: ['epingle', 'filet', 'eclair'] },
};
const GARDIENS_DES_ACTES = [
  ['renard', 'coq', 'chouette', 'tigre', 'chauve-souris', 'scarabee'],
  ['sphinx', 'janus', 'phenix', 'fantome', 'salamandre', 'lion', 'oracle', 'serpent'],
  ['dragon', 'kraken', 'chimere', 'ouroboros', 'trou-noir', 'comete'],
];
const imgGardien = (k, grand) => `gardiens/${k}${grand ? '-512' : ''}.webp`;
const ilOuElle = k => /^La /.test(LEGENDAIRES[k].nom) ? 'Elle' : 'Il';
const deLui = k => LEGENDAIRES[k].nom.replace(/^Le /, 'du ').replace(/^La /, 'de la ').replace(/^L’/, 'de l’').replace(/^Janus$/, 'de Janus');
const aLui = k => LEGENDAIRES[k].nom.replace(/^Le /, 'au ').replace(/^La /, 'à la ').replace(/^L’/, 'à l’').replace(/^Janus$/, 'à Janus');

// ———————————————————————————————— L'état ————————————————————————————————

let R = null;          // la partie, gardée dans le navigateur
const V = { ecran: 'titre', selection: null, choix: [], feuille: null, confirmer: null, E: null, garde: 0 };
let vus = new Set();

function sauver() { try { localStorage.setItem(CLE, JSON.stringify(R)); } catch (e) { /* un navigateur sans stockage joue quand même */ } }
function charger() { try { const t = localStorage.getItem(CLE); if (t) { const r = JSON.parse(t); if (r && r.v === 1 && r.actes) return r; } } catch (e) { /* rien de gardé */ } return null; }

const noeud = id => R.actes[+id[1]].noeuds.find(n => n.id === id);
const carte = cle => R.cartes.find(c => c.cle === cle);
const niveau = cle => (carte(cle) ? carte(cle).niveau : 0);
const coeursMax = () => COEURS_DE_DEPART + niveau('panacee');
const atteignables = () => (R && !R.enRoute && R.etape === 'carte' ? noeud(R.position).liens : []);
const themeDit = t => `${THEMES[t] || EMOJI_DU_THEME[t] || '🗺️'} ${esc(t)}`;
const remise = () => [0, 10, 20][niveau('pourboire')];
const prix = p => Math.max(5, p - remise());

// ———————————————————————————————— Une partie neuve ————————————————————————————————

function nouvellePartie() {
  const usage = { jeux: {}, themes: {}, contenus: new Set() };
  const halloween = (() => { const d = new Date(); return (d.getMonth() === 9 && d.getDate() >= 25) || (d.getMonth() === 10 && d.getDate() <= 1); })();
  const gardiens = GARDIENS_DES_ACTES.map((l, a) => (a === 0 && halloween && Math.random() < 0.5 ? 'citrouille' : auHasard(l)));
  return {
    v: 1, etape: 'titre', acte: 0, coeurs: COEURS_DE_DEPART, or: 0, cartes: [],
    actes: [0, 1, 2].map(a => genererActe(a, usage)), gardiens,
    position: 'a0r0c1', visites: ['a0r0c1'], enRoute: null,
    marchands: {}, tresors: {}, vus: [], fin: null,
    stats: { justes: 0, erreurs: 0, or: 0, epreuves: 0, vaincus: [] },
  };
}

// Un acte : le départ, trois rangées de trois étapes (dont un coffre), le marchand, le gardien.
// Chaque colonne file tout droit, et des diagonales qui ne se croisent jamais permettent d'en changer.
function genererActe(a, usage) {
  const noeuds = [];
  const ajouter = (row, col, type) => { const n = { id: `a${a}r${row}c${col}`, acte: a, row, col, type, liens: [] }; noeuds.push(n); return n; };
  const ici = (r, c) => noeuds.find(n => n.row === r && n.col === c);
  ajouter(0, 1, 'depart');
  for (let r = 1; r <= 3; r++) for (let c = 0; c < 3; c++) ajouter(r, c, 'epreuve');
  ici(2, Math.floor(Math.random() * 3)).type = 'tresor';
  ajouter(4, 1, 'marchand');
  ajouter(5, 1, 'gardien');
  for (let c = 0; c < 3; c++) ici(0, 1).liens.push(ici(1, c).id);
  for (let r = 1; r <= 2; r++) {
    for (let c = 0; c < 3; c++) ici(r, c).liens.push(ici(r + 1, c).id);
    for (let c = 0; c < 2; c++) {
      const t = Math.random();
      if (t < 0.38) ici(r, c).liens.push(ici(r + 1, c + 1).id);
      else if (t < 0.76) ici(r, c + 1).liens.push(ici(r + 1, c).id);
    }
  }
  for (let c = 0; c < 3; c++) ici(3, c).liens.push(ici(4, 1).id);
  ici(4, 1).liens.push(ici(5, 1).id);
  for (let r = 1; r <= 3; r++) {
    const rang = noeuds.filter(n => n.row === r && n.type === 'epreuve');
    const jeux = choisirJeux(rang.length, usage);
    rang.forEach((n, i) => { n.jeu = jeux[i]; n.theme = choisirTheme(n.jeu, usage, rang.map(x => x.theme)); });
  }
  return { noeuds };
}

// Les jeux les moins vus d'abord, jamais deux fois le même sur une rangée.
function choisirJeux(n, usage) {
  const dispo = window.CABINET_JEUX.ordre.filter(j => !PLAFOND[j] || (usage.jeux[j] || 0) < PLAFOND[j]);
  const tries = melanger(dispo).sort((x, y) => (usage.jeux[x] || 0) - (usage.jeux[y] || 0)).slice(0, n);
  tries.forEach(j => { usage.jeux[j] = (usage.jeux[j] || 0) + 1; });
  return melanger(tries);
}
function choisirTheme(jeu, usage, voisins) {
  if (THEME_FIXE[jeu]) return THEME_FIXE[jeu];
  if (jeu === 'epingle' || jeu === 'frise') {
    const l = (jeu === 'epingle' ? window.EPINGLES : window.FRISES).map(x => x.theme).filter(t => !usage.contenus.has(t));
    const t = auHasard(l); usage.contenus.add(t); return t;
  }
  const l = melanger(Object.keys(THEMES)).filter(t => !voisins.includes(t)).sort((x, y) => (usage.themes[x] || 0) - (usage.themes[y] || 0));
  usage.themes[l[0]] = (usage.themes[l[0]] || 0) + 1;
  return l[0];
}

// ———————————————————————————————— La pioche ————————————————————————————————

const NIVEAUX = ['facile', 'moyen', 'difficile'];
function marquer(id) { vus.add(id); R.vus.push(id); }
function prendre(liste, id) {
  const l = liste.filter(x => !vus.has(id(x)));
  const x = auHasard(l.length ? l : liste);
  marquer(id(x)); return x;
}
function pioche(sorte, o = {}) {
  const E = V.E, B = window.BASE;
  const theme = THEMES[E.theme] ? E.theme : auHasard(Object.keys(THEMES));
  if (sorte === 'qcm') {
    const niv = o.plusDur ? NIVEAUX[Math.min(2, NIVEAUX.indexOf(E.niveau) + 1)] : E.niveau;
    for (const n of [niv, ...NIVEAUX.filter(x => x !== niv)]) {
      const l = B.qcm[theme][n].filter(q => !vus.has(q.id));
      if (l.length) { const q = auHasard(l); marquer(q.id); return q; }
    }
    return prendre(Object.keys(THEMES).flatMap(t => B.qcm[t][niv]), q => q.id);
  }
  if (sorte === 'mot' || sorte === 'filet') {
    const l = B[sorte === 'mot' ? 'mots' : 'filet'][theme].filter(q => !vus.has(q.id));
    return l.length ? prendre(l, q => q.id) : prendre(Object.values(B[sorte === 'mot' ? 'mots' : 'filet']).flat(), q => q.id);
  }
  if (sorte === 'tableau') return prendre(window.TABLEAUX, t => 'tab:' + t.q);
  if (sorte === 'qui') return prendre(window.QUI, p => 'qui:' + p.rep);
  if (sorte === 'rep') return prendre(window.REPLIQUES, r => 'rep:' + r.avant);
  if (sorte === 'lieu') return prendre(window.EPINGLES.flatMap(g => g.lieux.map(l => ({ ...l, theme: g.theme }))), l => 'lieu:' + l.nom);
  throw new Error('pioche inconnue : ' + sorte);
}

// ———————————————————————————————— Les petits morceaux d'interface ————————————————————————————————

const PIECE = '<i class="piece" aria-hidden="true"></i>';
const COEUR = '<svg class="coeur" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2s-7.6-4.7-9.7-9.4C.7 8.2 2.9 4.4 6.6 4.4c2.2 0 3.7 1.2 4.6 2.7.9-1.5 2.4-2.7 4.6-2.7 3.7 0 5.9 3.8 4.3 7.4-2.1 4.7-8.1 9.4-8.1 9.4z"/></svg>';
const coeursHtml = (n, max) => `<span class="coeurs" role="img" aria-label="${n} ${n > 1 ? 'cœurs' : 'cœur'} sur ${max}">${Array.from({ length: max }, (_, i) => COEUR.replace('class="coeur"', `class="coeur${i < n ? '' : ' vide'}"`)).join('')}</span>`;
const orHtml = n => `<span class="bourse" role="img" aria-label="${n} pièces d’or">${PIECE}<b>${n}</b></span>`;
const pvHtml = (pv, max) => `<span class="pv" role="img" aria-label="${pv} points de vie sur ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < pv ? 'plein' : ''}"></i>`).join('')}</span>`;

function carteHtml(cle, niv, o = {}) {
  const c = CARTES[cle], el = o.action ? 'button' : 'div';
  const attrs = o.action ? `data-a="${o.action}" data-v="${cle}"${o.pressee != null ? ` aria-pressed="${o.pressee}"` : ''}${o.inerte ? ' aria-disabled="true"' : ''}` : '';
  return `<${el} class="carte${o.prise ? ' prise' : ''}${niv === 2 ? ' amelioree' : ''}${o.utilisee ? ' utilisee' : ''}" ${attrs}>
    <span class="peinture"><img src="${imgCarte(cle)}" alt="" loading="lazy">${o.prise ? '<span class="coche" aria-hidden="true">✓</span>' : ''}</span>
    <span class="nom">${c.nom}${niv === 2 ? ' <span class="plus">+</span>' : ''}</span>
    <span class="sorte ${c.sorte}">${o.etiquette || SORTE_DITE[c.sorte]}</span>
    <span class="dit">${c.dit(niv)}</span>${o.bas ? `<span class="bas">${o.bas}</span>` : ''}
  </${el}>`;
}

// Une étape de la carte, dite comme le joueur la voit.
function decrire(n) {
  if (n.type === 'epreuve') {
    const j = MODULES[n.jeu];
    return { emoji: j.emoji, titre: j.nom, sous: themeDit(n.theme), quoi: '', detail: j.geste, cta: `Jouer ${j.a}` };
  }
  if (n.type === 'tresor') return { emoji: '🎁', titre: 'Un coffre', sous: 'Une carte à choisir parmi trois', quoi: 'Trésor', detail: 'Pas de question ici : ouvre-le et choisis une carte.', cta: 'Ouvrir le coffre' };
  if (n.type === 'marchand') return { emoji: '💰', titre: 'Le marchand', sous: 'Des cœurs, des cartes, des améliorations', quoi: 'Boutique', detail: 'Dépense ton or avant d’affronter le gardien.', cta: 'Entrer chez le marchand' };
  const k = R.gardiens[n.acte], g = LEGENDAIRES[k];
  return { img: imgGardien(k), titre: g.nom, sous: esc(g.devise), quoi: `${pvDuGardien(n.acte)} PV`, detail: 'Chaque bonne réponse lui retire un point de vie. Chaque erreur te coûte un cœur.', cta: `Affronter ${g.nom.replace(/^Le /, 'le ').replace(/^La /, 'la ').replace(/^L’/, 'l’')}` };
}
const pvDuGardien = a => Math.max(1, PV_DES_GARDIENS[a] - niveau('coup-de-grace'));

// Ce que la carte 3D écrit sur une île : court, sans balise.
function etiquetteDe(n) {
  if (n.type === 'epreuve') return { emoji: MODULES[n.jeu].emoji, titre: MODULES[n.jeu].nom, sous: `${THEMES[n.theme] || EMOJI_DU_THEME[n.theme] || ''} ${n.theme}`.trim() };
  if (n.type === 'tresor') return { titre: 'Un coffre', sous: 'Une carte à choisir' };
  if (n.type === 'marchand') return { emoji: '💰', titre: 'Le marchand', sous: 'Cœurs et cartes' };
  if (n.type === 'gardien') { const k = R.gardiens[n.acte]; return { img: imgGardien(k), titre: LEGENDAIRES[k].nom, sous: `Gardien · ${ACTES[n.acte].court}` }; }
  return { titre: ACTES[n.acte].court, sous: ACTES[n.acte].nom };
}

// ———————————————————————————————— La tête et le panneau de la carte ————————————————————————————————

function hud() {
  if (!R || V.ecran === 'cartes') return '';
  // Sur l'écran-titre, la tête porte le nom du mode : la carte reste visible entre elle et le panneau.
  if (V.ecran === 'titre') return `<div class="titre-haut"><p class="sur">Le Cabinet de curiosités</p><h1>Trois actes,<br>trois gardiens</h1><p class="petit">Choisis ton chemin, joue, gagne de l’or. Bats les trois gardiens : l’un d’eux sera à toi.</p></div>`;
  const a = ACTES[R.acte], derniere = R.cartes[R.cartes.length - 1];
  return `<div class="hud-ligne">
      ${coeursHtml(R.coeurs, coeursMax())}${orHtml(R.or)}<span class="grand"></span>
      <button class="hud-bouton" data-a="feuille" data-v="cartes" aria-label="Tes cartes : ${R.cartes.length}">${derniere ? `<img class="vignette" src="${imgCarte(derniere.cle)}" alt="">` : ''}<b>${R.cartes.length}</b></button>
      <button class="hud-bouton rond" data-a="feuille" data-v="menu" aria-label="Menu">☰</button>
    </div>
    <p class="hud-acte" style="--teinte:${a.teinte}">${a.court} · ${a.nom}</p>`;
}

function panneau() {
  if (!R) return '';
  if (V.ecran === 'titre') return panneauTitre();
  // Pendant le vol vers l'acte suivant, la carte se regarde : le panneau revient à l'arrivée.
  if (V.ecran !== 'carte' || R.enRoute || V.vol) return '';
  const opts = atteignables();
  if (!opts.length) return '';
  const sel = V.selection && opts.includes(V.selection) ? noeud(V.selection) : null;
  const ligne = n => {
    const d = decrire(n), choisie = sel === n;
    return `<button class="option${choisie ? ' choisie' : ''}${n.type === 'gardien' ? ' gardien' : ''}" data-a="choisir" data-v="${n.id}" aria-pressed="${choisie}">
      <span class="ic" aria-hidden="true">${d.img ? `<img src="${d.img}" alt="">` : d.emoji}</span>
      <span class="txt"><b>${d.titre}</b><small>${d.sous}</small></span><span class="quoi">${d.quoi}</span></button>`;
  };
  const rang = noeud(R.position).row;
  const question = opts.length > 1 ? 'Où vas-tu ?' : noeud(opts[0]).type === 'gardien' ? 'Le gardien t’attend' : 'Le marchand t’attend';
  return `<div class="verre panneau-carte" style="--teinte:${ACTES[R.acte].teinte}">
    <div class="entre"><h2>${question}</h2><span class="mini pale">${rang === 0 ? 'Départ' : rang <= 3 ? `Étape ${rang} sur 3` : 'Avant le gardien'}</span></div>
    <div class="options">${opts.map(id => ligne(noeud(id))).join('')}</div>
    ${sel ? `<p class="detail petit pale">${decrire(sel).detail}</p>` : ''}
    <button class="cta" data-a="y-aller" ${sel ? '' : 'aria-disabled="true"'}>${sel ? decrire(sel).cta : 'Choisis une étape'}</button>
  </div>`;
}

function panneauTitre() {
  const enCours = R.etape === 'carte';
  const trio = R.gardiens.map(k => `<figure class="gardien-mini"><img src="${imgGardien(k)}" alt=""><figcaption>${LEGENDAIRES[k].nom}</figcaption></figure>`).join('');
  if (V.confirmer === 'nouvelle') return `<div class="verre titre"><h2>Recommencer à zéro ?</h2><p class="pale">Ta partie en cours (${ACTES[R.acte].court}, ${R.or} pièces, ${pluriel(R.cartes.length, 'carte', 'cartes')}) sera perdue.</p></div>
    <div class="grille2"><button class="second" data-a="annuler">Garder ma partie</button><button class="cta petit" data-a="recommencer">Recommencer</button></div>`;
  return `<div class="verre titre">
      <p class="sur centre">${enCours ? 'Les gardiens de ta partie' : 'Les gardiens de cette partie'}</p>
      <div class="trio-gardiens" role="list" aria-label="Les gardiens de cette partie">${trio}</div>
    </div>
    ${enCours
      ? `<button class="cta" data-a="reprendre">Reprendre ma partie<small>${ACTES[R.acte].court} · ${R.or} pièces · ${pluriel(R.coeurs, 'cœur', 'cœurs')}</small></button><button class="lien" data-a="nouvelle">Nouvelle partie</button>`
      : `<button class="cta" data-a="commencer">Commencer la partie<small>Une vingtaine de minutes · elle se reprend où tu la laisses</small></button><button class="lien" data-a="feuille" data-v="regles">Comment ça marche ?</button>`}`;
}

// ———————————————————————————————— Les écrans par-dessus la carte ————————————————————————————————

function ecranCartes() {
  const n = V.choix.length;
  return `<div class="colonne">
      <header class="tete-ecran"><p class="sur">Avant de partir</p><h2 tabindex="-1">Choisis 3 cartes</h2>
      <p class="pale">Elles t’accompagnent toute la partie. Les sept autres se gagnent en route : dans les coffres, chez le marchand, auprès des gardiens.</p></header>
      <div class="grille-cartes">${ORDRE_DES_CARTES.map(k => carteHtml(k, 1, { action: 'prendre', pressee: V.choix.includes(k), prise: V.choix.includes(k) })).join('')}</div>
    </div>
    <footer class="pied"><button class="cta" data-a="partir" ${n === 3 ? '' : 'aria-disabled="true"'}>${n === 3 ? 'Partir avec ces 3 cartes' : `Choisis encore ${pluriel(3 - n, 'carte', 'cartes')}`}</button></footer>`;
}

function teteEpreuve() {
  const E = V.E, mod = MODULES[E.jeu];
  const pips = E.type === 'gardien'
    ? `<span class="mini pale">${mod.emoji} ${mod.nom} · ${themeDit(E.theme)}</span>`
    : `<span class="pips" aria-label="Manche ${E.manche + 1} sur 3">${[0, 1, 2].map(i => { const r = E.resultats[i]; return `<i class="${r ? (r.gain ? 'ok' : 'ko') : i === E.manche ? 'ici' : ''}">${r ? (r.gain ? '✓' : '✗') : i + 1}</i>`; }).join('')}</span>`;
  // Deux lignes : ce qu'on joue (ou contre qui), puis où on en est et ce qu'on a.
  const haut = E.type === 'gardien'
    ? `<span class="tete-gardien"><img src="${imgGardien(E.lg)}" alt=""${E.phase === 'revele' && E.verdict && E.verdict.coups ? ' class="frappe"' : ''}><b>${LEGENDAIRES[E.lg].nom}</b>${pvHtml(E.pv, E.pvMax)}</span>`
    : `<span class="tete-jeu"><span class="ic" aria-hidden="true">${mod.emoji}</span><b>${mod.nom}</b><small>${themeDit(E.theme)}</small></span>`;
  return `<header class="tete">
      ${haut}
      <div class="entre">${pips}<span class="ressources">${E.mise && E.phase === 'jouer' ? `<span class="mise">×${niveau('quitte-ou-double') === 2 ? 3 : 2}</span>` : ''}${coeursHtml(R.coeurs, coeursMax())}${orHtml(R.or)}</span></div>
      ${E.phase === 'jouer' ? '<div class="ligne"><div class="chrono grand" aria-hidden="true"><i></i></div><span class="chrono-txt mini pale" aria-hidden="true"></span></div>' : ''}
    </header>`;
}

function annonceEpreuve() {
  const E = V.E, mod = MODULES[E.jeu], a = ACTES[R.acte];
  const notes = [];
  if (niveau('cagnotte')) notes.push(`Cagnotte : ${niveau('cagnotte') === 2 ? 10 : 5} pièces de plus par bonne réponse.`);
  if (niveau('parade')) notes.push('Parade : ta première erreur ne coûte pas de cœur.');
  if (niveau('concentration')) notes.push(`Concentration : ${niveau('concentration') === 2 ? 20 : 10} secondes de plus.`);
  return `<div class="colonne annonce" style="--teinte:${a.teinte}">
      <p class="sur">${a.court} · ${themeDit(E.theme)}</p>
      <div class="grand-ic" aria-hidden="true">${mod.emoji}</div>
      <h2 tabindex="-1">${mod.nom}</h2>
      <p class="geste">${mod.geste}</p>
      <div class="bareme">${mod.bareme.map(([l, n]) => `<div><span>${l}</span><b>+${n} ${PIECE}</b></div>`).join('')}<div class="ko"><span>Une erreur</span><b>−1 ${COEUR}</b></div></div>
      <p class="mini pale centre">3 manches · ${dureeManche()} secondes chacune</p>
      ${notes.length ? `<ul class="notes">${notes.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    </div>
    <footer class="pied"><button class="cta" data-a="commencer-epreuve">Commencer</button></footer>`;
}

function annonceGardien() {
  const E = V.E, g = LEGENDAIRES[E.lg], a = ACTES[R.acte];
  const jeux = E.jeux.map(j => MODULES[j].a);
  return `<div class="colonne annonce gardien" style="--teinte:${a.teinte}">
      <p class="sur">${a.court} · Le gardien</p>
      <div class="portrait"><img src="${imgGardien(E.lg, true)}" alt=""></div>
      <h2 tabindex="-1">${g.nom}</h2>
      <p class="devise">« ${esc(g.devise)} »</p>
      <div class="centre">${pvHtml(E.pv, E.pvMax)}<p class="mini pale">${E.pvMax} points de vie</p></div>
      <p class="petit centre">${ilOuElle(E.lg)} te défie ${jeux.slice(0, -1).join(', ')} et ${jeux[jeux.length - 1]}.</p>
      <div class="regle-gardien"><p>Chaque bonne réponse lui retire un point de vie.</p><p>Chaque erreur te coûte un cœur.</p></div>
    </div>
    <footer class="pied"><button class="cta" data-a="commencer-epreuve">Affronter ${g.nom.replace(/^Le /, 'le ').replace(/^La /, 'la ').replace(/^L’/, 'l’')}</button></footer>`;
}

function verdictHtml() {
  const E = V.E, v = E.verdict, ok = v.gain > 0;
  let ligne;
  if (ok) ligne = `+${v.gain} ${PIECE}${v.coups ? ` <span class="coup">${LEGENDAIRES[E.lg].nom} perd ${v.coups > 1 ? 'deux points' : 'un point'} de vie</span>` : ''}`;
  else ligne = v.perte ? `−${v.perte} ${COEUR}` : 'Aucun cœur perdu';
  return `<div class="verdict ${ok ? 'ok' : 'ko'}"><h2 tabindex="-1">${v.titre}</h2><p class="gain">${ligne}</p>${v.sous ? `<p class="petit">${v.sous}</p>` : ''}${v.effets.length ? `<ul class="effets">${v.effets.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}</div>`;
}

function libelleSuite() {
  const E = V.E;
  if (E.mort) return 'Voir la fin de la partie';
  if (E.type === 'gardien' && E.pv <= 0) return `${LEGENDAIRES[E.lg].nom} est vaincu${/^La /.test(LEGENDAIRES[E.lg].nom) ? 'e' : ''} !`;
  if (E.type === 'epreuve' && E.manche >= 2) return 'Voir le bilan';
  return 'Manche suivante';
}

// Les cartes à jouer, sous le pouce. Les autres agissent seules : leur effet se lit au verdict.
function plateau() {
  const E = V.E, mod = MODULES[E.jeu], c = ctx();
  const boutons = [];
  const reste = cle => Math.max(0, (cle === 'quitte-ou-double' ? 1 : niveau(cle)) - (E.usages[cle] || 0));
  if (niveau('coup-d-oeil')) {
    const ok = reste('coup-d-oeil') > 0 && mod.peutEclairer(c);
    boutons.push(`<button class="carte-jouee" data-a="jouer-carte" data-v="coup-d-oeil" ${ok ? '' : 'aria-disabled="true"'}><img src="${imgCarte('coup-d-oeil')}" alt=""><span><b>Coup d’œil · ${reste('coup-d-oeil')}</b><small>${mod.eclairerDit}</small></span></button>`);
  }
  if (niveau('echange')) {
    const ok = reste('echange') > 0 && mod.peutChanger(c);
    boutons.push(`<button class="carte-jouee" data-a="jouer-carte" data-v="echange" ${ok ? '' : 'aria-disabled="true"'}><img src="${imgCarte('echange')}" alt=""><span><b>Échange · ${reste('echange')}</b><small>${E.jeu === 'frise' ? 'ne sert pas à la Frise' : 'une autre manche'}</small></span></button>`);
  }
  if (niveau('quitte-ou-double')) {
    const f = niveau('quitte-ou-double') === 2 ? 3 : 2, ok = reste('quitte-ou-double') > 0 && !E.mise;
    boutons.push(`<button class="carte-jouee${E.mise ? ' active' : ''}" data-a="jouer-carte" data-v="quitte-ou-double" aria-pressed="${!!E.mise}" ${ok ? '' : 'aria-disabled="true"'}><img src="${imgCarte('quitte-ou-double')}" alt=""><span><b>${E.mise ? `Misé : ×${f}` : `Quitte ou double · ${reste('quitte-ou-double')}`}</b><small>${E.mise ? 'faux : 2 cœurs' : `or ×${f}, ou 2 cœurs`}</small></span></button>`);
  }
  // À trois, chaque carte n'a plus que son nom : avec sa peinture et son rôle, elle prenait quatre lignes.
  return boutons.length ? `<div class="plateau${boutons.length >= 3 ? ' nombreux' : ''}">${boutons.join('')}</div>` : '';
}

function ecranEpreuve() {
  const E = V.E, mod = MODULES[E.jeu];
  if (E.phase === 'annonce') return E.type === 'gardien' ? annonceGardien() : annonceEpreuve();
  if (E.phase === 'bilan') return bilanEpreuve();
  if (E.phase === 'victoire') return victoireGardien();
  const jouer = E.phase === 'jouer', c = ctx();
  const corps = jouer ? mod.rendre(c) : verdictHtml() + mod.revele(c) + (E.verdict.savais ? `<div class="savais"><span class="etiquette">Le savais-tu ?</span><p>${typo(E.verdict.savais)}</p></div>` : '');
  const pied = jouer ? (mod.pied ? mod.pied(c) : '') + plateau() : `<button class="cta" data-a="suite">${libelleSuite()}</button>`;
  return `<div class="colonne epreuve${jouer ? '' : ' revele'}" style="--teinte:${ACTES[R.acte].teinte}">${teteEpreuve()}<div class="corps pile">${corps}</div></div>${pied ? `<footer class="pied">${pied}</footer>` : ''}`;
}

function bilanEpreuve() {
  const E = V.E, mod = MODULES[E.jeu];
  const or = E.resultats.reduce((s, r) => s + r.gain, 0), perdus = E.resultats.reduce((s, r) => s + r.perte, 0);
  const justes = E.resultats.filter(r => r.gain).length;
  return `<div class="colonne bilan" style="--teinte:${ACTES[R.acte].teinte}">
      <p class="sur">${mod.emoji} ${mod.nom} · ${themeDit(E.theme)}</p>
      <h2 tabindex="-1">${justes === 3 ? 'Sans faute !' : justes ? 'Épreuve passée' : 'Épreuve difficile'}</h2>
      <div class="pips grands">${E.resultats.map(r => `<i class="${r.gain ? 'ok' : 'ko'}">${r.gain ? '✓' : '✗'}</i>`).join('')}</div>
      <div class="chiffres"><div><b>+${or}</b><span>pièces</span></div><div><b>${perdus ? '−' + perdus : '0'}</b><span>${perdus > 1 ? 'cœurs perdus' : 'cœur perdu'}</span></div></div>
      <div class="ressources centre">${coeursHtml(R.coeurs, coeursMax())}${orHtml(R.or)}</div>
    </div>
    <footer class="pied"><button class="cta" data-a="retour-carte">Retour à la carte</button></footer>`;
}

function victoireGardien() {
  const E = V.E, g = LEGENDAIRES[E.lg];
  return `<div class="colonne victoire">
      <div class="rayons" aria-hidden="true"></div>
      <div class="portrait vaincu"><img src="${imgGardien(E.lg, true)}" alt=""></div>
      <h2 tabindex="-1">${g.nom} s’incline !</h2>
      <p class="gain">+${OR_D_UN_GARDIEN} ${PIECE}</p>
      <p class="pale centre">${R.acte < 2 ? 'Tes cœurs reviennent au complet. Une récompense t’attend avant l’acte suivant.' : 'Les trois gardiens sont vaincus. L’un d’eux va te suivre.'}</p>
    </div>
    <footer class="pied"><button class="cta" data-a="apres-gardien">${R.acte < 2 ? 'Choisir ta récompense' : 'Choisir ton légendaire'}</button></footer>`;
}

// Trois offres : des cartes que tu n'as pas, sinon des améliorations, sinon de l'or.
function offres(n) {
  const neuves = melanger(ORDRE_DES_CARTES.filter(k => !carte(k))).slice(0, n).map(cle => ({ type: 'carte', cle }));
  const amelio = melanger(R.cartes.filter(c => c.niveau === 1).map(c => c.cle)).slice(0, n - neuves.length).map(cle => ({ type: 'amelioration', cle }));
  const l = [...neuves, ...amelio];
  while (l.length < n) l.push({ type: 'or', n: 40 });
  return l;
}
function offreHtml(o, i, action) {
  if (o.type === 'or') return `<button class="offre-or" data-a="${action}" data-v="${i}">${PIECE}<b>+${o.n} pièces</b></button>`;
  return carteHtml(o.cle, o.type === 'amelioration' ? 2 : 1, { action, etiquette: o.type === 'amelioration' ? 'Amélioration' : null }).replace(`data-v="${o.cle}"`, `data-v="${i}"`);
}

function ecranRecompense() {
  const a = ACTES[R.acte];
  return `<div class="colonne">
      <header class="tete-ecran"><p class="sur">${a.court} · La récompense ${deLui(R.gardiens[R.acte])}</p><h2 tabindex="-1">Choisis une carte</h2><p class="pale">Elle te suit jusqu’à la fin de la partie.</p></header>
      <div class="grille-cartes trois">${R.recompense.map((o, i) => offreHtml(o, i, 'prendre-recompense')).join('')}</div>
    </div>`;
}

function ecranTresor() {
  const t = R.tresors[R.enRoute];
  if (!t.ouvert) return `<div class="colonne tresor" style="--teinte:${ACTES[R.acte].teinte}">
      <p class="sur">${ACTES[R.acte].court} · Un trésor</p><h2 tabindex="-1">Un coffre au bord du chemin</h2>
      <button class="coffre" data-a="ouvrir-coffre" aria-label="Ouvrir le coffre"><img src="decors/coffre-ferme.webp" alt=""></button>
      <p class="pale centre">Pas de question ici. Ouvre-le : une carte t’attend.</p>
    </div>
    <footer class="pied"><button class="cta" data-a="ouvrir-coffre">Ouvrir le coffre</button></footer>`;
  return `<div class="colonne tresor ouvert">
      <img class="coffre-ouvert" src="decors/coffre-ouvert.webp" alt="">
      <header class="tete-ecran centre"><h2 tabindex="-1">Choisis une carte</h2><p class="pale">Les deux autres restent dans le coffre.</p></header>
      <div class="grille-cartes trois">${t.offres.map((o, i) => offreHtml(o, i, 'prendre-tresor')).join('')}</div>
    </div>`;
}

function ecranMarchand() {
  const st = R.marchands[R.enRoute], plein = R.coeurs >= coeursMax();
  const pc = prix(PRIX.coeur), pk = prix(PRIX.carte), pa = prix(PRIX.amelioration);
  const achat = (action, v, p, possible, raison) => `<button class="achat" data-a="${action}" data-v="${v}" ${possible && R.or >= p ? '' : 'aria-disabled="true"'} aria-label="Acheter pour ${p} pièces${raison ? ' : ' + raison : ''}">${p} ${PIECE}</button>`;
  // Le prix vit dans la carte, sous son effet : à côté, il serrait le texte sur six lignes.
  const etal = st.cartes.map(k => st.achetees.includes(k)
    ? carteHtml(k, 1, { bas: '<span class="vendu-dit">Achetée</span>', utilisee: true })
    : carteHtml(k, 1, { bas: achat('acheter-carte', k, pk, true) })).join('');
  const ameliorables = R.cartes.filter(c => c.niveau === 1);
  return `<div class="colonne marchand">
      <div class="enseigne"><img src="decors/marchand.webp" alt=""><div class="enseigne-texte"><p class="sur">${ACTES[R.acte].court} · Le marchand</p><h2 tabindex="-1">Le marchand</h2><p class="replique-marchand">« Tout s’achète ici, sauf le savoir. Celui-là, tu l’as gagné. »</p></div></div>
      <div class="ressources entre">${coeursHtml(R.coeurs, coeursMax())}${orHtml(R.or)}</div>
      ${remise() ? `<p class="mini pale">Pourboire : ${remise()} pièces de remise sur chaque achat.</p>` : ''}
      <section class="rayon"><h3>Un cœur</h3><div class="article"><span class="ic-coeur">${COEUR}</span><span class="txt">${plein ? 'Tes cœurs sont au complet.' : 'Regagne un cœur perdu.'}</span>${achat('acheter-coeur', '', pc, !plein)}</div></section>
      <section class="rayon"><h3>Des cartes</h3>${etal ? `<div class="etal">${etal}</div>` : '<p class="pale petit">Tu as déjà toutes les cartes.</p>'}</section>
      <section class="rayon"><h3>Améliorer une carte</h3>
        ${ameliorables.length ? `<div class="pile serre">${ameliorables.map(c => `<div class="article amelio"><img src="${imgCarte(c.cle)}" alt=""><span class="txt"><b>${CARTES[c.cle].nom} +</b><small>${CARTES[c.cle].dit(2)}</small></span>${achat('ameliorer', c.cle, pa, true)}</div>`).join('')}</div>` : '<p class="pale petit">Toutes tes cartes sont déjà améliorées.</p>'}
      </section>
    </div>
    <footer class="pied"><button class="cta" data-a="quitter-marchand">Reprendre la route</button></footer>`;
}

function ecranLegendaire() {
  return `<div class="colonne legendaire">
      <header class="tete-ecran centre"><p class="sur">Les trois actes sont faits</p><h2 tabindex="-1">Choisis ton légendaire</h2>
      <p class="pale">Tu as vaincu les trois gardiens. L’un d’eux te suit désormais : il devient ton avatar, en soirée comme ici.</p></header>
      <div class="trois-legendaires">${R.gardiens.map(k => `<button class="legendaire-choix" data-a="choisir-legendaire" data-v="${k}"><img src="${imgGardien(k, true)}" alt=""><span><b>${LEGENDAIRES[k].nom}</b><small>${esc(LEGENDAIRES[k].devise)}</small></span></button>`).join('')}</div>
    </div>`;
}

function ecranFin() {
  const f = R.fin, s = R.stats;
  const chiffres = `<div class="chiffres"><div><b>${s.justes}</b><span>bonnes réponses</span></div><div><b>${s.or}</b><span>pièces gagnées</span></div><div><b>${R.cartes.length}</b><span>cartes</span></div></div>`;
  if (f.issue === 'victoire') {
    const k = f.legendaire, g = LEGENDAIRES[k];
    return `<div class="colonne gagne">
        <div class="rayons" aria-hidden="true"></div>
        <div class="tableau-legendaire"><div class="bordure"><img src="${imgGardien(k, true)}" alt=""></div><span class="ruban">Légendaire</span></div>
        <h2 tabindex="-1">${g.nom} est à toi !</h2>
        <p class="pale centre">${ilOuElle(k)} devient ton avatar : on ${ilOuElle(k) === 'Elle' ? 'la' : 'le'} verra à côté de ton prénom, en soirée comme au Cabinet.</p>
        ${chiffres}
      </div>
      <footer class="pied"><button class="cta" data-a="nouvelle-partie">Rejouer une partie<small>Trois nouveaux gardiens, de nouveaux chemins</small></button></footer>`;
  }
  const vaincus = s.vaincus.map(k => LEGENDAIRES[k].nom);
  return `<div class="colonne fin">
      <p class="sur">${ACTES[f.acte].court} · ${ACTES[f.acte].nom}</p>
      <h2 tabindex="-1">Ta partie s’arrête ici</h2>
      <p class="pale centre">${f.ou}</p>
      ${chiffres}
      <p class="petit centre">${vaincus.length ? `Gardiens vaincus : ${vaincus.join(', ')}.` : 'Aucun gardien vaincu cette fois.'}</p>
      <p class="pale petit centre">Tout recommence à l’Acte I, avec de nouveaux chemins et de nouveaux gardiens.</p>
    </div>
    <footer class="pied"><button class="cta" data-a="nouvelle-partie">Nouvelle partie</button></footer>`;
}

// ———————————————————————————————— Les feuilles : tes cartes, le menu, les règles ————————————————————————————————

const REGLES = `<ol class="regles">
    <li><b>Choisis ton chemin.</b> Chaque étape de la carte est un jeu, sur un thème. Les neuf jeux s’y croisent.</li>
    <li><b>Bonne réponse : de l’or.</b> 15, 10 ou 5 pièces selon que la manche est parfaite, bonne ou juste.</li>
    <li><b>Erreur : un cœur en moins.</b> Plus de cœur, la partie s’arrête et tout recommence à l’Acte I.</li>
    <li><b>Le marchand</b>, avant chaque gardien, vend des cœurs, des cartes et des améliorations.</li>
    <li><b>Au bout de chaque acte, un gardien.</b> Bats les trois : l’un d’eux sera à toi.</li>
  </ol>`;

function feuille() {
  if (!V.feuille) return '';
  let titre, corps;
  if (V.feuille === 'cartes') {
    titre = 'Tes cartes';
    corps = R.cartes.length ? `<div class="grille-cartes">${R.cartes.map(c => carteHtml(c.cle, c.niveau, { utilisee: c.cle === 'second-souffle' && c.utilisee, etiquette: c.cle === 'second-souffle' && c.utilisee ? 'Déjà utilisée' : null })).join('')}</div>` : '<p class="pale">Pas encore de carte.</p>';
  } else if (V.feuille === 'regles') {
    titre = 'Comment ça marche ?'; corps = REGLES;
  } else {
    titre = 'Menu';
    corps = `<div class="pile">
        <button class="second" data-a="feuille" data-v="regles">Comment ça marche ?</button>
        <section class="outils"><p class="etiquette">Outils de la maquette</p><p class="mini pale">Pour tout voir vite. Ils n’existeront pas dans le jeu.</p>
          <div class="grille2"><button class="second" data-a="outil" data-v="or">+100 pièces</button><button class="second" data-a="outil" data-v="coeurs">Cœurs au complet</button>
          <button class="second" data-a="outil" data-v="marchand">Aller au marchand</button><button class="second" data-a="outil" data-v="gardien">Aller au gardien</button>
          <button class="second" data-a="outil" data-v="acte">Gagner cet acte</button><button class="second" data-a="outil" data-v="perdre">Perdre la partie</button></div></section>
        ${V.confirmer === 'abandon'
          ? `<div class="bandeau">Abandonner ? La partie s’arrête et tout recommence à l’Acte I.</div><div class="grille2"><button class="second" data-a="annuler">Continuer</button><button class="cta petit" data-a="abandonner-oui">Abandonner</button></div>`
          : '<button class="second danger" data-a="abandonner">Abandonner la partie</button>'}
      </div>`;
  }
  return `<div class="voile" data-a="fermer-feuille"></div><div class="feuille-corps" role="dialog" aria-modal="true" aria-labelledby="titre-feuille">
      <div class="entre"><h2 id="titre-feuille" tabindex="-1">${titre}</h2><button class="fermer" data-a="fermer-feuille" aria-label="Fermer">✕</button></div>${corps}</div>`;
}

// ———————————————————————————————— Le rendu ————————————————————————————————

const ECRANS = { cartes: ecranCartes, epreuve: ecranEpreuve, marchand: ecranMarchand, tresor: ecranTresor, recompense: ecranRecompense, legendaire: ecranLegendaire, fin: ecranFin };
const surLaCarte = () => V.ecran === 'titre' || V.ecran === 'carte';

function rendreTout() {
  $('#hud').innerHTML = hud();
  $('#panneau').innerHTML = panneau();
  $('#ui').classList.toggle('titre', V.ecran === 'titre');
  rendreEcran();
  const f = $('#feuille'); f.hidden = !V.feuille; f.innerHTML = feuille();
  // Le carton de l'acte ne survit pas à un écran qui s'ouvre par-dessus la carte.
  if (!surLaCarte()) { clearTimeout(carton.t); $('#carton').hidden = true; }
  syncScene();
}
let derniereVue = '';
function rendreEcran() {
  const el = $('#ecran'), vue = ECRANS[V.ecran];
  el.hidden = !vue;
  if (!vue) { derniereVue = ''; return; }
  const garde = el.scrollTop;
  el.innerHTML = vue();
  // Un même écran redessiné garde sa place ; un écran neuf commence en haut, le focus à son titre.
  const cle = V.ecran + (V.E ? `:${V.E.manche}:${V.E.phase}:${V.E.m && V.E.m.etape || ''}` : '');
  if (cle !== derniereVue) {
    el.scrollTop = 0; derniereVue = cle;
    const t = el.querySelector('[tabindex="-1"]'); if (t) t.focus({ preventScroll: true });
  } else el.scrollTop = garde;
  // Au Mot mystère, la ligne en cours revient au milieu : sous les essais d'avant, elle passait sous le clavier.
  const ligne = el.querySelector('.mot-ligne.en-cours');
  if (ligne && V.E.m.essais.length) ligne.scrollIntoView({ block: 'center' });
  if (V.E && V.E.phase === 'jouer') tic();
}

let toastMinuteur = null;
function toast(t) {
  clearTimeout(toastMinuteur);
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = t; toastMinuteur = setTimeout(() => el.remove(), 2800);
}

// ———————————————————————————————— L'épreuve et le gardien ————————————————————————————————

function ctx() { return { E: V.E, pioche, juger, rendre: rendreEcran, toast, chrono: { relancer: () => lancerChrono(dureeManche()), arreter: arreterChrono } }; }
const mod = () => MODULES[V.E.jeu];
const dureeManche = () => MODULES[V.E.jeu].duree + [0, 10, 20][niveau('concentration')];

function ouvrirEpreuve(n) {
  V.E = { type: 'epreuve', noeud: n.id, jeu: n.jeu, theme: n.theme, niveau: ACTES[n.acte].niveau, manche: 0, resultats: [], phase: 'annonce', usages: {}, parade: false };
  V.ecran = 'epreuve'; V.garde = performance.now() + 400;
  rendreTout();
}
function ouvrirGardien(n) {
  const k = R.gardiens[n.acte], pv = pvDuGardien(n.acte);
  V.E = { type: 'gardien', noeud: n.id, lg: k, jeux: LEGENDAIRES[k].jeux, jeu: LEGENDAIRES[k].jeux[0], theme: '', niveau: ACTES[n.acte].niveauGardien, manche: 0, resultats: [], phase: 'annonce', usages: {}, parade: false, pv, pvMax: pv };
  V.ecran = 'epreuve'; V.garde = performance.now() + 400;
  rendreTout();
}
function commencerEpreuve() {
  const E = V.E;
  if (E.type === 'epreuve' && mod().preparer) mod().preparer(ctx());
  ouvrirManche(false);
}
function ouvrirManche(change) {
  const E = V.E;
  if (E.type === 'gardien') {
    E.jeu = E.jeux[E.manche % E.jeux.length];
    E.theme = THEME_FIXE[E.jeu] || (E.jeu === 'epingle' ? '' : auHasard(Object.keys(THEMES).filter(t => t !== E.theme)));
  }
  E.phase = 'jouer'; E.verdict = null;
  if (!change) E.mise = false;
  E.m = mod().manche(ctx(), change);
  if (E.jeu === 'epingle' && E.type === 'gardien') E.theme = E.m.lieu.theme;
  V.garde = performance.now() + 400;
  rendreEcran();
  lancerChrono(dureeManche());
}

let minuteur = null;
function lancerChrono(duree) {
  arreterChrono();
  V.E.duree = duree; V.E.finChrono = performance.now() + duree * 1000;
  minuteur = setInterval(tic, 100); tic();
}
function arreterChrono() { clearInterval(minuteur); minuteur = null; }
function tic() {
  const E = V.E;
  if (!E || E.phase !== 'jouer' || !minuteur) return;
  const reste = Math.max(0, (E.finChrono - performance.now()) / 1000);
  const trait = document.querySelector('.chrono i');
  if (trait) { trait.style.transform = `scaleX(${reste / E.duree})`; trait.parentNode.classList.toggle('court', reste < 8); }
  const txt = document.querySelector('.chrono-txt'); if (txt) txt.textContent = Math.ceil(reste) + ' s';
  if (reste <= 0) { arreterChrono(); mod().tempsEcoule(ctx()); }
}

// Le seul endroit où l'or et les cœurs bougent pendant un jeu : les cartes s'y appliquent.
function juger(or, verdict) {
  const E = V.E;
  if (!E || E.phase !== 'jouer') return;
  arreterChrono();
  const effets = [];
  let gain = 0, perte = 0, coups = 0;
  const facteur = niveau('quitte-ou-double') === 2 ? 3 : 2;
  if (or > 0) {
    gain = or;
    if (niveau('cagnotte')) { const b = niveau('cagnotte') === 2 ? 10 : 5; gain += b; effets.push(`Cagnotte : +${b}`); }
    if (E.mise) { gain *= facteur; effets.push(`Quitte ou double gagné : or ×${facteur}`); }
    if (E.type === 'gardien') { coups = E.mise ? 2 : 1; E.pv = Math.max(0, E.pv - coups); }
    R.stats.justes++;
  } else {
    perte = E.mise ? 2 : 1;
    if (E.mise) effets.push('Quitte ou double perdu : deux cœurs');
    const par = niveau('parade');
    if (par && !E.parade && (E.type === 'epreuve' || par === 2)) { E.parade = true; perte = 0; effets.push('Parade : cette erreur ne te coûte rien'); }
    R.coeurs = Math.max(0, R.coeurs - perte);
    R.stats.erreurs++;
  }
  R.or += gain; R.stats.or += gain;
  if (R.coeurs <= 0) {
    const ss = carte('second-souffle');
    if (ss && !ss.utilisee) { ss.utilisee = true; R.coeurs = Math.min(coeursMax(), ss.niveau === 2 ? 4 : 2); effets.push(`Second souffle : tu te relèves avec ${R.coeurs} cœurs`); }
    else E.mort = true;
  }
  E.resultats.push({ gain, perte, coups });
  E.verdict = { gain, perte, coups, effets, titre: verdict.titre, sous: verdict.sous || '', savais: verdict.savais || '' };
  E.mise = false; E.phase = 'revele';
  V.garde = performance.now() + 450;
  sauver();
  rendreEcran();
  annoncer(`${verdict.titre.replace(/<[^>]+>/g, '')}. ${gain ? `Plus ${gain} pièces.` : perte ? `Moins ${perte} ${perte > 1 ? 'cœurs' : 'cœur'}.` : ''}`);
}

function suite() {
  const E = V.E;
  if (E.mort) return finDePartie(false, E.type === 'gardien' ? `Face ${aLui(E.lg)}, au bout de l’${ACTES[R.acte].court.replace('Acte', 'acte')}.` : `${MODULES[E.jeu].a.replace(/^au /, 'Au ').replace(/^à /, 'À ').replace(/^aux /, 'Aux ')}, sur le thème ${E.theme}.`);
  if (E.type === 'gardien' && E.pv <= 0) {
    // La victoire s'écrit tout de suite, récompense tirée : rechargée, la page ne rejoue pas le gardien.
    E.phase = 'victoire'; R.or += OR_D_UN_GARDIEN; R.stats.or += OR_D_UN_GARDIEN; R.stats.vaincus.push(E.lg);
    R.coeurs = coeursMax(); arriverAuNoeud();
    if (R.acte < 2) R.recompense = offres(3);
    sauver(); return rendreTout();
  }
  if (E.type === 'epreuve' && E.manche >= 2) { E.phase = 'bilan'; return rendreTout(); }
  E.manche++;
  ouvrirManche(false);
}

function arriverAuNoeud() {
  const id = R.enRoute;
  R.position = id; R.visites.push(id); R.enRoute = null;
  sauver();
}

// ———————————————————————————————— La carte : choisir, voyager, arriver ————————————————————————————————

function yAller() {
  const id = V.selection;
  if (!id || !atteignables().includes(id) || V.vol) return;
  R.enRoute = id; V.selection = null; sauver();
  rendreTout();
  const arrivee = () => ouvrirNoeud(noeud(id));
  if (scene) scene.voyager(R.position, id).then(arrivee); else arrivee();
}
function ouvrirNoeud(n) {
  if (n.type === 'epreuve') return ouvrirEpreuve(n);
  if (n.type === 'gardien') return ouvrirGardien(n);
  if (n.type === 'tresor') { if (!R.tresors[n.id]) R.tresors[n.id] = { ouvert: false, offres: offres(3) }; sauver(); V.ecran = 'tresor'; return rendreTout(); }
  if (n.type === 'marchand') {
    if (!R.marchands[n.id]) R.marchands[n.id] = { cartes: melanger(ORDRE_DES_CARTES.filter(k => !carte(k))).slice(0, 3), achetees: [] };
    sauver(); V.ecran = 'marchand'; return rendreTout();
  }
}
function retourCarte() {
  V.E = null; V.ecran = 'carte';
  const opts = atteignables(); V.selection = opts.length === 1 ? opts[0] : null;
  rendreTout();
}

function prendreCarte(cle) {
  const c = carte(cle);
  if (c) { c.niveau = 2; if (cle === 'panacee') R.coeurs = Math.min(coeursMax(), R.coeurs + 1); return; }
  R.cartes.push({ cle, niveau: 1 });
  if (cle === 'panacee') R.coeurs = Math.min(coeursMax(), R.coeurs + 1);
}
function prendreOffre(o) {
  if (o.type === 'or') { R.or += o.n; R.stats.or += o.n; toast(`+${o.n} pièces`); return; }
  prendreCarte(o.cle);
  toast(o.type === 'amelioration' ? `${CARTES[o.cle].nom} est améliorée` : `${CARTES[o.cle].nom} rejoint tes cartes`);
}

function versActeSuivant() {
  R.acte++; R.position = `a${R.acte}r0c1`; R.visites.push(R.position); R.recompense = null; R.coeurs = coeursMax();
  sauver();
  V.E = null; V.ecran = 'carte'; V.selection = null; V.vol = !!scene;
  rendreTout();
  if (scene) scene.volerVersActe(R.acte).then(() => { V.vol = false; rendreTout(); carton(R.acte); }); else carton(R.acte);
}

function finDePartie(victoire, ou, legendaire) {
  arreterChrono();
  R.fin = victoire ? { issue: 'victoire', legendaire } : { issue: 'defaite', acte: R.acte, ou };
  R.etape = 'fin'; sauver();
  V.E = null; V.ecran = 'fin'; V.feuille = null; V.confirmer = null;
  rendreTout();
}

function lancerNouvellePartie() {
  R = nouvellePartie(); vus = new Set(); sauver();
  V.choix = []; V.selection = null; V.E = null; V.feuille = null; V.confirmer = null;
  if (scene) scene.construire(R);
}

// Le carton de l'acte : son nom, et qui attend au bout.
function carton(a) {
  const el = $('#carton'), k = R.gardiens[a];
  el.innerHTML = `<p class="sur">${ACTES[a].court}</p><h2>${ACTES[a].nom}</h2><p class="pale">${LEGENDAIRES[k].nom} t’attend au bout du chemin.</p>`;
  el.style.setProperty('--teinte', ACTES[a].teinte);
  el.hidden = false; el.classList.remove('part'); void el.offsetWidth; el.classList.add('vient');
  clearTimeout(carton.t); carton.t = setTimeout(() => { el.classList.add('part'); setTimeout(() => { el.hidden = true; }, 600); }, 2600);
}

function annoncer(t) { const el = $('#annonce'); el.textContent = ''; setTimeout(() => { el.textContent = t; }, 30); }

// ———————————————————————————————— Les gestes ————————————————————————————————

function agir(a, v, ev, el) {
  switch (a) {
    case 'commencer': V.choix = []; V.ecran = 'cartes'; return rendreTout();
    case 'reprendre': {
      // Une partie quittée entre deux écrans reprend là où elle attendait un geste.
      if (R.coeurs <= 0) return finDePartie(false, 'Ton dernier cœur était tombé avant que tu quittes la page.');
      if (R.recompense) { V.ecran = 'recompense'; return rendreTout(); }
      if (noeud(R.position).type === 'gardien' && R.acte >= 2) { V.ecran = 'legendaire'; return rendreTout(); }
      V.ecran = 'carte'; rendreTout();
      if (R.enRoute) return ouvrirNoeud(noeud(R.enRoute));
      const opts = atteignables(); V.selection = opts.length === 1 ? opts[0] : null; rendreTout();
      return carton(R.acte);
    }
    case 'nouvelle': V.confirmer = 'nouvelle'; return rendreTout();
    case 'annuler': V.confirmer = null; return rendreTout();
    case 'recommencer': lancerNouvellePartie(); V.ecran = 'titre'; return rendreTout();
    case 'prendre': {
      const i = V.choix.indexOf(v);
      if (i >= 0) V.choix.splice(i, 1);
      else if (V.choix.length < 3) V.choix.push(v);
      else toast('Trois cartes au plus : retire d’abord une carte.');
      return rendreEcran();
    }
    case 'partir': {
      if (V.choix.length !== 3) return toast('Choisis trois cartes.');
      R.cartes = V.choix.map(cle => ({ cle, niveau: 1 }));
      R.coeurs = coeursMax(); R.etape = 'carte'; sauver();
      V.ecran = 'carte'; V.selection = null; rendreTout();
      return carton(0);
    }
    case 'choisir': if (atteignables().includes(v)) { V.selection = v; rendreTout(); } return;
    case 'y-aller': return yAller();
    case 'commencer-epreuve': return commencerEpreuve();
    case 'm': {
      const [verbe, ...reste] = v.split(':');
      return mod().action(ctx(), verbe, reste.join(':'), ev, el);
    }
    case 'jouer-carte': {
      const E = V.E, c = ctx();
      if (!E || E.phase !== 'jouer') return;
      const max = v === 'quitte-ou-double' ? 1 : niveau(v);
      if ((E.usages[v] || 0) >= max) return toast('Cette carte a déjà servi dans cette épreuve.');
      if (v === 'coup-d-oeil') { if (!mod().peutEclairer(c)) return toast('Rien à éclairer pour l’instant.'); E.usages[v] = (E.usages[v] || 0) + 1; mod().eclairer(c); return rendreEcran(); }
      if (v === 'echange') { if (!mod().peutChanger(c)) return toast(mod().refusDeChanger || 'Trop tard pour changer : la manche est entamée.'); E.usages[v] = (E.usages[v] || 0) + 1; toast('Nouvelle manche, nouveau chrono.'); return ouvrirManche(true); }
      if (v === 'quitte-ou-double') { if (E.mise) return; E.usages[v] = 1; E.mise = true; return rendreEcran(); }
      return;
    }
    case 'suite': return suite();
    case 'retour-carte': { R.stats.epreuves++; arriverAuNoeud(); return retourCarte(); }
    case 'apres-gardien': {
      V.E = null;
      if (R.acte >= 2) { V.ecran = 'legendaire'; return rendreTout(); }
      if (!R.recompense) { R.recompense = offres(3); sauver(); }
      V.ecran = 'recompense'; return rendreTout();
    }
    case 'prendre-recompense': { prendreOffre(R.recompense[+v]); return versActeSuivant(); }
    case 'ouvrir-coffre': { R.tresors[R.enRoute].ouvert = true; sauver(); if (scene) scene.ouvrirCoffre(R.enRoute); return rendreTout(); }
    case 'prendre-tresor': { prendreOffre(R.tresors[R.enRoute].offres[+v]); arriverAuNoeud(); return retourCarte(); }
    case 'acheter-coeur': {
      const p = prix(PRIX.coeur);
      if (R.coeurs >= coeursMax()) return toast('Tes cœurs sont déjà au complet.');
      if (R.or < p) return toast(`Il te manque ${p - R.or} pièces.`);
      R.or -= p; R.coeurs++; sauver(); toast('Un cœur de plus'); return rendreTout();
    }
    case 'acheter-carte': {
      const p = prix(PRIX.carte), st = R.marchands[R.enRoute];
      if (R.or < p) return toast(`Il te manque ${p - R.or} pièces.`);
      if (st.achetees.includes(v) || carte(v)) return;
      R.or -= p; st.achetees.push(v); prendreCarte(v); sauver(); toast(`${CARTES[v].nom} rejoint tes cartes`); return rendreTout();
    }
    case 'ameliorer': {
      const p = prix(PRIX.amelioration), c = carte(v);
      if (!c || c.niveau === 2) return;
      if (R.or < p) return toast(`Il te manque ${p - R.or} pièces.`);
      R.or -= p; prendreCarte(v); sauver(); toast(`${CARTES[v].nom} est améliorée`); return rendreTout();
    }
    case 'quitter-marchand': { arriverAuNoeud(); return retourCarte(); }
    case 'choisir-legendaire': return finDePartie(true, '', v);
    case 'nouvelle-partie': lancerNouvellePartie(); V.ecran = 'titre'; return rendreTout();
    case 'feuille': V.feuille = v; V.confirmer = null; rendreTout(); { const t = document.querySelector('#feuille h2'); if (t) t.focus(); } return;
    case 'fermer-feuille': V.feuille = null; V.confirmer = null; return rendreTout();
    case 'abandonner': V.confirmer = 'abandon'; return rendreTout();
    case 'abandonner-oui': V.feuille = null; return finDePartie(false, 'Tu as abandonné la partie.');
    case 'outil': return outil(v);
  }
}

// Les outils de la maquette : voir chaque écran sans jouer vingt minutes.
function outil(v) {
  if (R.etape !== 'carte') return toast('Commence d’abord une partie.');
  V.feuille = null;
  if (v === 'or') { R.or += 100; toast('+100 pièces'); }
  if (v === 'coeurs') { R.coeurs = coeursMax(); toast('Cœurs au complet'); }
  if (v === 'perdre') { R.coeurs = 0; sauver(); return finDePartie(false, 'Les outils de la maquette ont eu raison de toi.'); }
  if (v === 'marchand' || v === 'gardien' || v === 'acte') {
    arreterChrono(); V.E = null; R.enRoute = null;
    R.position = `a${R.acte}r${v === 'marchand' ? 3 : 4}c1`;
    if (v === 'acte') {
      R.position = `a${R.acte}r5c1`; R.stats.vaincus.push(R.gardiens[R.acte]); sauver();
      if (R.acte >= 2) { V.ecran = 'legendaire'; return rendreTout(); }
      R.recompense = offres(3); sauver(); V.ecran = 'recompense'; return rendreTout();
    }
    V.ecran = 'carte'; V.selection = atteignables()[0];
    if (scene) scene.sauterA(R.position);
  }
  sauver(); rendreTout();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  // L'écho du doigt : un toucher qui change l'écran ne doit pas jouer le bouton qui apparaît dessous.
  if (el.closest('#ecran') && performance.now() < V.garde) return;
  if (el.getAttribute('aria-disabled') === 'true' && el.dataset.a !== 'm') {
    if (el.dataset.a === 'y-aller') toast('Touche d’abord une étape sur la carte ou dans la liste.');
    else if (el.dataset.a === 'partir') toast(`Choisis encore ${pluriel(3 - V.choix.length, 'carte', 'cartes')}.`);
    else if (el.classList.contains('achat')) toast(R.coeurs >= coeursMax() && el.dataset.a === 'acheter-coeur' ? 'Tes cœurs sont déjà au complet.' : 'Pas assez d’or.');
    return;
  }
  if (el.getAttribute('aria-disabled') === 'true' && el.dataset.a === 'm') return;
  agir(el.dataset.a, el.dataset.v || '', ev, el);
});
document.addEventListener('input', ev => {
  const i = ev.target.dataset && ev.target.dataset.i;
  if (i && V.E && V.E.phase === 'jouer' && mod().saisie) mod().saisie(ctx(), i, ev.target.value);
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.dataset.f === 'indices' && V.E && V.E.phase === 'jouer') mod().action(ctx(), 'repondre');
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && V.feuille) { V.feuille = null; return rendreTout(); }
  const E = V.E;
  if (!E || E.phase !== 'jouer' || E.jeu !== 'mot' || V.feuille || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const k = ev.key.length === 1 ? ev.key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : ev.key;
  if (/^[A-Z]$/.test(k)) { ev.preventDefault(); mod().action(ctx(), 't', k); }
  else if (k === 'Backspace') { ev.preventDefault(); mod().action(ctx(), 't', 'EFFACER'); }
  else if (k === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { ev.preventDefault(); mod().action(ctx(), 't', 'VALIDER'); }
});

// ———————————————————————————————— La scène 3D ————————————————————————————————

let scene = null;
function syncScene() {
  if (!scene || !R) return;
  // Sous un écran plein, la scène se fige : le téléphone garde sa batterie pour le chrono.
  scene.maj(R, { selection: V.selection, mode: V.ecran === 'titre' || V.ecran === 'cartes' ? 'titre' : 'carte', pause: !surLaCarte() });
}
async function chargerLaScene() {
  try {
    const m = await import('./scene.js');
    scene = await m.creerScene($('#scene'), {
      toucher: id => { if (V.ecran === 'carte' && !V.vol && atteignables().includes(id)) { V.selection = id; rendreTout(); } },
      etiquetteDe,
      teintes: ACTES.map(a => a.teinte),
    });
    scene.construire(R);
    syncScene();
  } catch (e) {
    console.error(e);
    $('#scene').innerHTML = '<p class="sans3d">La carte en 3D ne s’affiche pas sur cet appareil. Les étapes se choisissent dans le panneau.</p>';
  }
}

// Pour les rendus automatiques et la curiosité : l'état, et de quoi le pousser.
window.__maquette = { get R() { return R; }, V, agir, outil, noeud, atteignables, pioche, juger: (or, t) => juger(or, { titre: t || 'Test' }) };

// ———————————————————————————————— Le départ ————————————————————————————————

R = charger();
if (!R || R.etape === 'fin') R = nouvellePartie();
vus = new Set(R.vus);
sauver();
rendreTout();
chargerLaScene();

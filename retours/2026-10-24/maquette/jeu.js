// Le Cabinet de curiosités — maquette jouable, version 2. Tout tient ici : les
// règles, les écrans, les neuf mini-jeux. L'état vit dans le navigateur.
(function () {
'use strict';

// ———————————————————————————————— Les règles ————————————————————————————————

const FAMILLES = [
  { id: 'erudit', nom: "L'Érudit", salle: "la salle de l'Érudit", devise: 'Je connais mon rayon' },
  { id: 'devin', nom: 'Le Devin', salle: 'la salle du Devin', devise: 'Je lis les signes' },
  { id: 'rempart', nom: 'Le Rempart', salle: 'la salle du Rempart', devise: 'Je tiens bon' },
  { id: 'elan', nom: "L'Élan", salle: "la salle de l'Élan", devise: 'Je ne m’arrête plus' },
  { id: 'metamorphe', nom: 'Le Métamorphe', salle: 'la salle du Métamorphe', devise: 'Je change la question' },
  { id: 'flambeur', nom: 'Le Flambeur', salle: 'la salle du Flambeur', devise: 'Je parie sur moi' },
  { id: 'sophiste', nom: 'Le Sophiste', salle: 'la salle du Sophiste', devise: 'Je sème le doute' },
  { id: 'temeraire', nom: 'Le Téméraire', salle: 'la salle du Téméraire', devise: 'Je joue avec le feu' },
  { id: 'neutre', nom: 'Le Vestibule', salle: 'le Vestibule', devise: 'Pour tout le monde' }
];
const FAM = Object.fromEntries(FAMILLES.map(f => [f.id, f]));

// Le pouvoir d'une carte vient de sa famille ; sa rareté le rend plus fort.
const POUVOIRS = {
  eclairer: { nom: 'Éclairer', dit: 'Un indice, propre à chaque jeu.', force: n => `${n} indice${n > 1 ? 's' : ''} par partie` },
  proteger: { nom: 'Protéger', dit: 'Une fois par partie, ta première manche imparfaite gagne des étoiles.', force: n => `+${n >= 3 ? 2 : 1} étoile${n >= 3 ? 's' : ''}, une fois par partie` },
  temps: { nom: 'Prendre son temps', dit: 'Du temps en plus à chaque manche.', force: n => `+${10 * n} s par manche` },
  miser: { nom: 'Miser', dit: 'Avant une manche, sans l’avoir vue : parfaite, elle rapporte des étoiles en plus ; sinon, rien.', force: n => `+${n + 1} étoiles si la manche misée est parfaite` },
  changer: { nom: 'Changer', dit: 'Remplace la manche par une autre, avant de répondre.', force: n => `${n} fois par partie` }
};
const POUVOIR_DE_LA_FAMILLE = { erudit: 'eclairer', devin: 'eclairer', sophiste: 'changer', metamorphe: 'changer', rempart: 'proteger', elan: 'temps', flambeur: 'miser', temeraire: 'miser' };
const POUVOIR_DU_NEUTRE = {
  'coup-d-oeil': 'eclairer', repere: 'eclairer', lettre: 'eclairer', initiale: 'eclairer', evidence: 'eclairer',
  prudence: 'proteger', sursis: 'proteger', 'double-chance': 'proteger', panacee: 'proteger', 'sang-froid': 'proteger',
  concentration: 'temps', 'arret-sur-image': 'temps', meditation: 'temps', maitrise: 'temps', pioche: 'temps',
  echange: 'changer', detour: 'changer',
  'tout-ou-rien': 'miser', 'quitte-ou-double': 'miser', surmenage: 'miser'
};
const FORCE = { commun: 1, rare: 2, maudit: 2, epique: 3, legendaire: 3 };
const RARETE = { commun: 'Commune', rare: 'Rare', maudit: 'Maudite', epique: 'Épique', legendaire: 'Légendaire' };
// Ce qu'il faut d'étoiles (sur 9) pour gagner une œuvre. Le cadre doré, lui, exige trois manches parfaites sans aide.
const SEUIL = { commun: 5, rare: 6, maudit: 6, epique: 7 };
const PRIX_ACHAT = { commun: 200, rare: 400, maudit: 400, epique: 700 };
const PRIX_DORURE = { commun: 50, rare: 100, maudit: 100, epique: 160 };
const POUSSIERE_DU_DOUBLE = { commun: 30, rare: 60, maudit: 60, epique: 120 };
const POUSSIERE_PAR_ETOILE = 2;
const LIBRES_QUI_PAIENT = 5;      // au-delà, une partie libre se joue pour le plaisir
const CHASSES_PAR_JOUR = 2;
const FRAICHEUR = 7;              // une manche vue ne revient pas avant une semaine
const DEPART = ['coup-d-oeil', 'prudence', 'concentration', 'echange'];

// Deux gardiens par salle : le premier à la salle complète, le second à la salle toute dorée.
const GARDIENS = {
  erudit: ['chouette', 'lion'], devin: ['sphinx', 'oracle'], rempart: ['phenix', 'ouroboros'], elan: ['tigre', 'comete'],
  metamorphe: ['janus', 'serpent'], flambeur: ['dragon', 'renard'], sophiste: ['fantome', 'chauve-souris'],
  temeraire: ['salamandre', 'kraken'], neutre: ['coq', 'chimere']
};
const AUTRES_LEGENDAIRES = {
  scarabee: { comment: 'Trente jours de visite d’affilée', pouvoir: 'proteger' },
  'trou-noir': { comment: 'Le Cabinet entier : les 84 œuvres', pouvoir: 'miser' },
  citrouille: { comment: 'Une œuvre gagnée pendant la saison d’Halloween', pouvoir: 'eclairer' },
  sapin: { comment: 'Une œuvre gagnée pendant la saison de Noël', pouvoir: 'proteger' },
  bouquet: { comment: 'Une œuvre gagnée pendant la semaine du Nouvel An', pouvoir: 'temps' }
};
const NOM_DU_LEGENDAIRE = { chouette: "La Chouette d'Argent", lion: 'Le Lion', sphinx: 'Le Sphinx', oracle: "L'Oracle", phenix: 'Le Phénix', ouroboros: "L'Ouroboros", tigre: 'Le Tigre', comete: 'La Comète', janus: 'Janus', serpent: 'Le Serpent', dragon: 'Le Dragon', renard: 'Le Renard', fantome: 'Le Fantôme', 'chauve-souris': 'La Chauve-souris', salamandre: 'La Salamandre', kraken: 'Le Kraken', coq: 'Le Coq', chimere: 'La Chimère', scarabee: 'Le Scarabée', 'trou-noir': 'Le Trou noir', citrouille: 'La Citrouille', sapin: 'Le Sapin', bouquet: 'Le Bouquet' };
const salleDuGardien = lg => Object.keys(GARDIENS).find(f => GARDIENS[f].includes(lg));

const CARTES = window.CARTES;
const OEUVRES = CARTES.filter(c => c.img);           // les 84 cartes peintes : les œuvres du Cabinet
const CARTE = Object.fromEntries(CARTES.map(c => [c.k, c]));
const CARTE_DU_LEGENDAIRE = Object.fromEntries(CARTES.filter(c => c.lg).map(c => [c.lg, c]));

// Un gardien porte le pouvoir de sa salle : le Phénix protège, comme le Rempart qu'il garde.
function pouvoirDe(c) {
  if (c.lg) { const f = salleDuGardien(c.lg); if (f) return f === 'neutre' ? (c.lg === 'coq' ? 'temps' : 'changer') : POUVOIR_DE_LA_FAMILLE[f]; return AUTRES_LEGENDAIRES[c.lg].pouvoir; }
  return c.f === 'neutre' ? POUVOIR_DU_NEUTRE[c.k] : POUVOIR_DE_LA_FAMILLE[c.f];
}
const forceDe = c => FORCE[c.r] || 1;
const forceDite = c => POUVOIRS[pouvoirDe(c)].force(forceDe(c));

// La saison en cours, lue au calendrier : un gardien de fête ne se réveille qu'à sa fête.
function saison() {
  const d = new Date(), m = d.getMonth() + 1, j = d.getDate();
  if ((m === 10 && j >= 15) || (m === 11 && j <= 5)) return 'citrouille';
  if (m === 12) return 'sapin';
  if (m === 1 && j <= 7) return 'bouquet';
  return null;
}

// ———————————————————————————————— Les mini-jeux ————————————————————————————————

const JEUX = [
  { id: 'epingle', nom: "L'Épingle", a: 'à l’Épingle', geste: 'Une histoire, un lieu : plante l’épingle sur la carte.', bareme: 'à moins de 40 km ★★★ · 120 km ★★ · 300 km ★', eclairer: 'entoure une grande zone où chercher', duree: 45 },
  { id: 'frise', nom: 'La Frise', a: 'à la Frise', geste: 'Range les événements du plus ancien au plus récent. À chaque manche, la frise s’allonge.', bareme: 'sans faute ★★★ · une erreur ★★ · deux ★', eclairer: 'dévoile l’année d’un nouveau venu', duree: 60 },
  { id: 'mot', nom: 'Le Mot mystère', a: 'au Mot mystère', geste: 'Trouve le mot, avec la question pour indice. Cinq essais.', bareme: 'en 1 ou 2 essais ★★★ · 3 ou 4 ★★ · 5 ★', eclairer: 'souffle une lettre', duree: 120 },
  { id: 'detail', nom: 'Le Détail', a: 'au Détail', geste: 'Reconnais le tableau. Chaque pas en arrière en montre plus, et vaut une étoile de moins.', bareme: 'au premier coup d’œil ★★★ · un pas ★★ · deux ★', eclairer: 'efface un mauvais titre', duree: 45 },
  { id: 'filet', nom: 'Le Filet', a: 'au Filet', geste: 'Place ton curseur, puis choisis la taille de ton filet : petit, il rapporte plus.', bareme: 'petit filet ★★★ · moyen ★★ · grand ★', eclairer: 'montre une zone où est la réponse', duree: 45 },
  { id: 'pari', nom: 'Le Pari', a: 'au Pari', geste: 'Juste : garde une étoile, ou parie-la sur une question plus difficile.', bareme: 'garder ★ · parier et réussir ★★★', eclairer: 'efface une mauvaise réponse', duree: 35 },
  { id: 'eclair', nom: "L'Éclair", a: 'à l’Éclair', geste: 'Cinq affirmations : vraies ou fausses ?', bareme: '5 justes ★★★ · 4 ★★ · 3 ★', eclairer: 'souffle la réponse en cours', duree: 45 },
  { id: 'indices', nom: 'Les Indices', a: 'aux Indices', geste: 'Qui suis-je ? Réponds avec le moins d’indices possible.', bareme: 'en 1 ou 2 indices ★★★ · 3 ★★ · 4 ou 5 ★', eclairer: 'un indice gratuit', duree: 75 },
  { id: 'replique', nom: 'La Réplique', a: 'à la Réplique', geste: 'Complète la réplique culte, puis dis qui l’a dite.', bareme: 'le bon mot ★★ · la bonne personne ★', eclairer: 'efface une mauvaise proposition', duree: 25 }
];
const JEU = Object.fromEntries(JEUX.map(j => [j.id, j]));
const hacher = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
// Chaque œuvre se trouve à un jeu fixe : son cadre vide le dit.
const jeuDeLaCarte = c => JEUX[hacher(c.k) % JEUX.length].id;

// ———————————————————————————————— L'état ————————————————————————————————

const CLE = 'cabinet-maquette-v2';
let S;
const neuf = () => ({ jour: 1, oeuvres: Object.fromEntries(DEPART.map(k => [k, { n: 1, dore: false, cartel: null, origine: 'depart' }])), poussiere: 0, legendaires: [], visite: null, chasses: { jour: 1, n: 0 }, libres: { jour: 1, n: 0 }, jours: [], murs: { lieux: [], dates: [] }, emportee: 'coup-d-oeil', guide: false, vus: {}, eveils: [] });
function charger() { try { const t = localStorage.getItem(CLE); if (t) return Object.assign(neuf(), JSON.parse(t)); } catch (e) {} return neuf(); }
function sauver() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) {} }
S = charger();

let vue = { ecran: 'hall' };
let P = null;
let minuteur = null;
let toastTimer = null;

// ———————————————————————————————— Outils ————————————————————————————————

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Les espaces insécables du français : un « 6 000 » ou un « : » ne se coupent pas en fin de ligne.
const typo = s => esc(s).replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ').replace(/(\d) (\d{3})/g, '$1 $2');
const melanger = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const auHasard = a => a[Math.floor(Math.random() * a.length)];
const etoiles = (n, sur = 3) => '★'.repeat(Math.max(0, Math.min(n, sur))) + '☆'.repeat(Math.max(0, sur - n));
const nombre = v => Number(v).toLocaleString('fr-FR');
const sansAccent = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
function toast(t) { clearTimeout(toastTimer); let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = t; toastTimer = setTimeout(() => el.remove(), 2800); }

const possede = k => !!S.oeuvres[k];
const oeuvresDe = f => OEUVRES.filter(c => c.f === f);
const ordreRarete = { commun: 0, rare: 1, maudit: 2, epique: 3, legendaire: 4 };
const trierParRarete = l => l.slice().sort((a, b) => ordreRarete[a.r] - ordreRarete[b.r] || a.n.localeCompare(b.n));
const totalPossedees = () => OEUVRES.filter(c => possede(c.k)).length;
const imgCarte = c => c.lg ? `medaillons/${c.lg}.webp` : c.img;
const cartesEmportables = () => {
  const l = OEUVRES.filter(c => possede(c.k));
  for (const lg of S.legendaires) if (CARTE_DU_LEGENDAIRE[lg]) l.push(CARTE_DU_LEGENDAIRE[lg]);
  return trierParRarete(l);
};
const decrireOeuvre = c => `une œuvre ${RARETE[c.r].toLowerCase()} de ${FAM[c.f].salle}`;

// Ce qui a été vu cette semaine ne revient pas, tant qu'il reste du neuf.
function pioche(cle, tas, id = x => x.id || x.t || x.q || x.rep || x.avant || x.theme) {
  const vus = S.vus, recent = x => vus[cle + ':' + id(x)] != null && S.jour - vus[cle + ':' + id(x)] < FRAICHEUR;
  P.dejaPioches = P.dejaPioches || new Set();
  let l = tas.filter(x => !recent(x) && !P.dejaPioches.has(cle + ':' + id(x)));
  if (!l.length) l = tas.filter(x => !P.dejaPioches.has(cle + ':' + id(x))).sort((a, b) => (vus[cle + ':' + id(a)] || 0) - (vus[cle + ':' + id(b)] || 0)).slice(0, 3);
  if (!l.length) l = tas;
  const x = auHasard(l);
  vus[cle + ':' + id(x)] = S.jour; P.dejaPioches.add(cle + ':' + id(x));
  return x;
}

// ———————————————————————————————— La visite, la chasse, la série ————————————————————————————————

function cibleAuHasard(exclues) {
  const manquantes = OEUVRES.filter(c => !possede(c.k) && !exclues.includes(c.k));
  const poids = { commun: 6, rare: 3, maudit: 1, epique: 1 };
  if (!manquantes.length) {
    const a = OEUVRES.filter(c => !S.oeuvres[c.k].dore && !exclues.includes(c.k));
    return a.length ? auHasard(a).k : null;
  }
  const total = manquantes.reduce((s, c) => s + poids[c.r], 0);
  let x = Math.random() * total;
  for (const c of manquantes) { x -= poids[c.r]; if (x <= 0) return c.k; }
  return manquantes[0].k;
}
function visiteDuJour() {
  if (S.visite && S.visite.jour === S.jour) return S.visite;
  // Les jeux des deux derniers jours passent après les autres : la visite tourne.
  const recents = (S.jeuxRecents || []).filter(x => S.jour - x.jour <= 2).map(x => x.jeu);
  const jeux = [...melanger(JEUX.map(j => j.id).filter(j => !recents.includes(j))), ...melanger(recents)].slice(0, 3);
  S.jeuxRecents = [...(S.jeuxRecents || []).filter(x => S.jour - x.jour <= 2), ...jeux.map(jeu => ({ jeu, jour: S.jour }))];
  const cibles = [];
  for (let i = 0; i < 3; i++) cibles.push(cibleAuHasard(cibles));
  S.visite = { jour: S.jour, echange: true, parties: jeux.map((j, i) => ({ jeu: j, cible: cibles[i], faite: false, etoiles: 0, gagnee: false })) };
  sauver();
  return S.visite;
}
const chassesRestantes = () => (S.chasses.jour === S.jour ? CHASSES_PAR_JOUR - S.chasses.n : CHASSES_PAR_JOUR);
const libresQuiPaient = () => (S.libres.jour === S.jour ? Math.max(0, LIBRES_QUI_PAIENT - S.libres.n) : LIBRES_QUI_PAIENT);
// La série se lit jusqu'à hier tant qu'on n'a pas joué aujourd'hui : elle n'est pas perdue au réveil.
function serie() { let j = S.jours.includes(S.jour) ? S.jour : S.jour - 1, n = 0; while (S.jours.includes(j)) { n++; j--; } return n; }
const joueAujourdhui = () => S.jours.includes(S.jour);

// ———————————————————————————————— Les écrans du musée ————————————————————————————————

const fleche = (c = 'currentColor') => `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const barre = (cible, nom, droite = '') => `<div class="entre"><button class="retour" data-a="aller" data-v="${cible}">← ${nom}</button>${droite}</div>`;

function ecranHall() {
  const v = visiteDuJour();
  const faites = v.parties.filter(p => p.faite).length;
  const portes = FAMILLES.map(f => {
    const l = oeuvresDe(f.id), n = l.filter(c => possede(c.k)).length;
    const belle = trierParRarete(l.filter(c => possede(c.k))).pop() || l[0];
    const complete = n === l.length;
    return `<button class="porte" data-a="salle" data-v="${f.id}" aria-label="${esc(f.nom)}, ${n} œuvres sur ${l.length}">
      <span class="arche ${complete ? 'complete' : ''}"><img src="${belle.img}" alt="" loading="lazy" style="${n ? '' : 'filter:grayscale(1) brightness(.5)'}"></span>
      <span class="n">${esc(f.nom)}</span><span class="mini ${complete ? 'or' : 'muet'}">${n} / ${l.length}${complete ? ' · gardien réveillé' : ''}</span></button>`;
  }).join('');
  const tot = totalPossedees(), s = serie(), sa = saison();
  return `
  <div class="entre"><span class="etiquette">Jour ${S.jour}</span><span class="petit or" style="font-weight:600">${nombre(S.poussiere)} poussière d’or</span></div>
  <div class="pile" style="gap:6px">
    <h1>Ton Cabinet</h1>
    <p class="petit muet">${tot} œuvres sur ${OEUVRES.length} · ${pluriel(S.legendaires.length, 'gardien', 'gardiens')} sur 23</p>
    <div class="jauge"><span style="width:${(100 * tot / OEUVRES.length).toFixed(1)}%"></span></div>
  </div>
  ${!S.guide ? `<div class="bandeau or pile" style="gap:6px"><b>Bienvenue au Cabinet.</b><span>Chaque carte peinte est une œuvre à exposer dans ton musée. Tu les gagnes en jouant à de petits jeux de deux minutes. Une salle complète réveille son gardien légendaire.</span><button class="retour" data-a="guide-lu" style="align-self:flex-start">C’est parti</button></div>`
    : s > 0 ? `<div class="bandeau ligne"><span class="chiffre">${s}</span><span class="petit">${s > 1 ? 'jours de visite d’affilée' : 'jour de visite'}${joueAujourdhui() ? (s > 1 ? '. Belle régularité !' : '. Reviens demain pour commencer une série.') : '. Joue aujourd’hui pour garder ta série.'}</span></div>` : ''}
  <button class="tuile active" data-a="visite" style="background:var(--or);color:#1a1412;border-color:var(--or)">
    <span style="flex:1;display:flex;flex-direction:column;gap:2px">
      <span class="etiquette" style="color:#1a1412">Aujourd'hui</span>
      <span class="titre-tuile">La visite du jour</span>
      <span class="petit">${faites === 3 ? 'Faite. Reviens demain, ou pars à la chasse dans une salle.' : `3 parties de deux minutes · ${faites} sur 3 faites`}</span>
    </span>${fleche('#1a1412')}</button>
  ${sa && !S.legendaires.includes(sa) ? `<div class="bandeau or ligne"><img class="medaillon" style="width:44px;height:44px" src="medaillons/${sa}.webp" alt=""><span class="petit">Gardien de saison : ${AUTRES_LEGENDAIRES[sa].comment.replace('Une œuvre gagnée', 'gagne une œuvre')}, et ${NOM_DU_LEGENDAIRE[sa]} se réveillera.</span></div>` : ''}
  ${prochainGardien()}
  <div class="entre"><h3>Les salles</h3><span class="mini muet">${chassesRestantes()} chasse${chassesRestantes() > 1 ? 's' : ''} aujourd’hui</span></div>
  <div class="grille3">${portes}</div>
  <button class="tuile" data-a="galerie"><span class="ligne" style="gap:4px">${S.legendaires.slice(-3).map(l => `<img class="medaillon" style="width:44px;height:44px" src="medaillons/${l}.webp" alt="">`).join('') || `<img class="medaillon endormi" style="width:44px;height:44px" src="medaillons/chouette.webp" alt="">`}</span>
    <span style="flex:1;display:flex;flex-direction:column"><span class="titre-tuile" style="font-size:20px">Les gardiens</span><span class="mini muet">${S.legendaires.length} sur 23 réveillés</span></span></button>
  <div class="grille2">
    <button class="tuile" data-a="murs" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="titre-tuile" style="font-size:20px">Tes murs</span><span class="mini muet">${S.murs.lieux.length + S.murs.dates.length ? `${pluriel(S.murs.lieux.length, 'lieu', 'lieux')}, ${pluriel(S.murs.dates.length, 'date', 'dates')}` : 'Ta carte et ta frise'}</span></button>
    <button class="tuile" data-a="libre" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="titre-tuile" style="font-size:20px">Jouer librement</span><span class="mini muet">Les 9 jeux, à volonté</span></button>
  </div>
  <button class="retour" data-a="regles" style="align-self:center">Comment ça marche ?</button>
  ${outils()}`;
}
function prochainGardien() {
  const l = FAMILLES.map(f => ({ f, g: GARDIENS[f.id][0], reste: oeuvresDe(f.id).filter(c => !possede(c.k)).length })).filter(x => x.reste > 0 && !S.legendaires.includes(x.g)).sort((a, b) => a.reste - b.reste)[0];
  if (!l) return '';
  return `<button class="tuile" data-a="salle" data-v="${l.f.id}"><img class="medaillon endormi" style="width:48px;height:48px" src="medaillons/${l.g}.webp" alt=""><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span class="etiquette">Le prochain gardien</span><span class="petit"><b>${NOM_DU_LEGENDAIRE[l.g]}</b> : encore ${pluriel(l.reste, 'œuvre', 'œuvres')} dans ${esc(l.f.salle)}.</span></span>${fleche()}</button>`;
}
const outils = () => `<div class="outils"><span class="titre">Outils de la maquette (pas dans le jeu)</span>
  <button class="puce" data-a="jour">Passer au jour suivant</button><button class="puce" data-a="avance">Charger un joueur avancé</button><button class="puce" data-a="poussiere">+500 poussière</button><button class="puce" data-a="raz">Recommencer à zéro</button></div>`;

function ecranVisite() {
  const v = visiteDuJour();
  const tuiles = v.parties.map((p, i) => {
    const c = p.cible ? CARTE[p.cible] : null, j = JEU[p.jeu], a = c && possede(c.k);
    const enJeu = p.faite ? (p.gagnee && c ? `tu as gagné ${esc(c.n)}` : 'l’œuvre reste à gagner') : !c ? 'pour la poussière d’or' : a ? (S.oeuvres[c.k].dore ? `${esc(c.n)}, cadre doré` : `pour dorer ${esc(c.n)}`) : `peut te faire gagner ${decrireOeuvre(c)}`;
    return `<button class="tuile ${p.faite ? 'faite' : ''}" data-a="${p.faite ? '' : 'partie-visite'}" data-v="${i}" ${p.faite ? 'aria-disabled="true"' : ''}>
      <span class="vignette">${a ? `<img src="${c.img}" alt="">` : '<span class="q">?</span>'}</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">
        <span class="etiquette" style="${p.faite ? 'color:var(--rare)' : ''}">${p.faite ? `Faite · ${p.etoiles} sur 9${p.gagnee ? ' · gagnée' : ''}` : 'À jouer'}</span>
        <span class="titre-tuile">${j.nom}</span>
        <span class="mini muet">${enJeu}</span>
      </span></button>${!p.faite && v.echange ? `<button class="retour" data-a="echanger" data-v="${i}" style="align-self:flex-end;margin-top:-8px;font-size:13px">Changer de jeu</button>` : ''}`;
  }).join('');
  const s = serie();
  return `${barre('hall', 'Le Cabinet')}
  <div class="pile" style="gap:6px"><h1>La visite du jour</h1><p class="petit muet">Trois parties de deux minutes. Chacune peut te faire gagner une œuvre : tu ne la découvres qu’une fois gagnée.</p></div>
  ${tuiles}
  ${v.echange ? '<p class="mini muet">Un jeu ne te plaît pas ? Tu peux en changer un, une fois par jour.</p>' : ''}
  <div class="bloc pile" style="gap:6px"><b>La chasse : l’œuvre de ton choix</b><p class="petit muet">Dans une salle, touche un cadre vide : il dit à quel jeu se trouve son œuvre, et tu peux partir la chercher. ${pluriel(chassesRestantes(), 'chasse', 'chasses')} aujourd’hui.</p></div>
  <div class="bandeau or ligne"><span class="chiffre">${s}</span><span class="petit">${s > 1 ? 'jours de visite d’affilée' : s === 1 ? 'jour de visite' : 'Commence ta série aujourd’hui'}${s && !joueAujourdhui() ? ' : joue aujourd’hui pour la garder' : ''}. Au trentième, le Scarabée se réveille.</span></div>`;
}

function ecranSalle(f) {
  const fam = FAM[f], l = trierParRarete(oeuvresDe(f)), n = l.filter(c => possede(c.k)).length;
  const dorees = l.filter(c => possede(c.k) && S.oeuvres[c.k].dore).length;
  const cadres = l.map(c => {
    if (possede(c.k)) {
      const o = S.oeuvres[c.k];
      return `<button class="oeuvre" data-a="cartel" data-v="${c.k}"><span class="cadre ${o.dore ? 'dore' : ''}"><img src="${c.img}" alt="${esc(c.n)}" loading="lazy"></span>
        <span class="nom"><span class="gemme g-${c.r}"></span>${esc(c.n)}</span><span class="mini muet">${POUVOIRS[pouvoirDe(c)].nom}${o.dore ? ' · doré' : ''}</span></button>`;
    }
    const j = JEU[jeuDeLaCarte(c)];
    return `<button class="oeuvre" data-a="manquante" data-v="${c.k}"><span class="vide"><span class="q">?</span><span class="mini muet">à chercher</span><span class="petit" style="font-weight:700">${j.a}</span></span>
      <span class="nom" style="color:var(--muet)"><span class="gemme g-${c.r}"></span>${RARETE[c.r]}</span></button>`;
  }).join('');
  const [g1, g2] = GARDIENS[f];
  const a1 = S.legendaires.includes(g1), a2 = S.legendaires.includes(g2);
  return `${barre('hall', 'Le Cabinet', `<span class="petit muet">${n} / ${l.length}</span>`)}
  <div class="pile" style="gap:4px"><h1>${esc(fam.nom)}</h1><p class="petit muet">${f === 'neutre' ? 'Des cartes de toutes sortes : chacune a son pouvoir.' : `Les cartes de cette salle ont le pouvoir « ${POUVOIRS[POUVOIR_DE_LA_FAMILLE[f]].nom} ». ${POUVOIRS[POUVOIR_DE_LA_FAMILLE[f]].dit}`}</p></div>
  <div class="grille2">${cadres}</div>
  <div class="bloc pile">
    <div class="ligne"><img class="medaillon ${a1 ? '' : 'endormi'}" src="medaillons/${g1}.webp" alt=""><span style="flex:1"><b>${NOM_DU_LEGENDAIRE[g1]}</b>, gardien de la salle<br><span class="petit muet">${a1 ? 'Réveillé : il t’accompagne.' : `Il dort. Il se réveille quand la salle est complète : encore ${pluriel(l.length - n, 'œuvre', 'œuvres')}.`}</span></span></div>
    <div class="ligne"><img class="medaillon ${a2 ? '' : 'endormi'}" src="medaillons/${g2}.webp" alt=""><span style="flex:1"><b>${NOM_DU_LEGENDAIRE[g2]}</b>, second gardien<br><span class="petit muet">${a2 ? 'Réveillé.' : `Il se réveille quand tous les cadres sont dorés : ${dorees} sur ${l.length}.`}</span></span></div>
  </div>`;
}

function ecranManquante(k) {
  const c = CARTE[k], j = JEU[jeuDeLaCarte(c)], prix = PRIX_ACHAT[c.r], ch = chassesRestantes();
  return `${barre('salle:' + c.f, FAM[c.f].nom)}
  <div class="vide" style="max-width:100%"><span class="q" style="font-size:56px">?</span><span class="petit muet">${decrireOeuvre(c)}</span></div>
  <div class="bloc pile" style="gap:6px"><span class="etiquette">Elle se trouve ${j.a}</span><h2>${j.nom}</h2><p class="petit muet">${j.geste}</p><p class="petit">Il faut <b>${SEUIL[c.r]} étoiles sur 9</b> pour la gagner.</p></div>
  <button class="bouton" data-a="chasser" data-v="${k}" ${ch ? '' : 'disabled'}>${ch ? `Partir à sa recherche · ${pluriel(ch, 'chasse', 'chasses')} aujourd’hui` : 'Plus de chasse aujourd’hui : reviens demain'}</button>
  <button class="bouton second" data-a="acheter" data-v="${k}" ${S.poussiere >= prix ? '' : 'disabled'}>L’acheter · ${prix} poussière d’or</button>
  <p class="mini muet" style="text-align:center">Tu as ${nombre(S.poussiere)} poussière d’or. Chaque partie en rapporte, même ratée.</p>`;
}

function blocCartel(o, c) {
  const k = o && o.cartel;
  if (k) return `<div class="cartel"><span class="etiquette">Ce que tu as appris en la gagnant</span>
    ${k.sujet ? `<p class="mini" style="color:var(--encre-muette)">${typo(k.sujet)}</p>` : ''}${k.rep ? `<p class="petit" style="font-weight:700">${typo(k.rep)}</p>` : ''}
    <p class="phrase">${typo(k.txt)}</p><span class="mini" style="color:var(--encre-muette)">Gagnée ${JEU[k.jeu] ? JEU[k.jeu].a : ''}${k.theme ? ' · ' + esc(k.theme) : ''} · ${k.etoiles} sur 9 · jour ${k.jour}</span></div>`;
  const texte = c.lg ? 'Réveillé dans ton Cabinet. Son pouvoir est le plus fort de sa famille.' : o && o.origine === 'achat' ? 'Achetée avec ta poussière d’or. Gagne-la en jouant pour qu’elle garde ce que tu as appris.' : 'Offerte à ton arrivée. Les œuvres que tu gagnes garderont ici ce que tu as appris.';
  return `<div class="cartel"><span class="etiquette">${c.lg ? 'Gardien' : o && o.origine === 'achat' ? 'Achetée' : 'Carte de départ'}</span><p class="phrase">${texte}</p></div>`;
}

function ecranCartel(k) {
  const c = CARTE[k], o = S.oeuvres[k] || null, p = pouvoirDe(c), estLg = !!c.lg;
  const doreCout = PRIX_DORURE[c.r];
  const retour = estLg ? barre('galerie', 'Les gardiens') : barre('salle:' + c.f, FAM[c.f].nom);
  return `${retour}
  <div class="cadre ${o && o.dore ? 'dore' : ''}" style="padding:10px">${estLg ? `<img src="medaillons/${c.lg}.webp" alt="${esc(c.n)}" style="aspect-ratio:1">` : `<img src="${c.img}" alt="${esc(c.n)}">`}</div>
  <div class="entre"><h1>${esc(estLg ? NOM_DU_LEGENDAIRE[c.lg] : c.n)}</h1><span class="ligne petit" style="gap:6px"><span class="gemme g-${c.r}"></span>${RARETE[c.r]}</span></div>
  ${blocCartel(o, c)}
  <div class="bloc pile" style="gap:6px"><b>Sa carte-bonus : ${POUVOIRS[p].nom}</b><p class="petit muet">${POUVOIRS[p].dit} ${forceDite(c)}.</p>
    <button class="bouton ${S.emportee === k ? 'second' : ''}" data-a="emporter" data-v="${k}">${S.emportee === k ? 'C’est ta carte-bonus' : 'En faire ma carte-bonus'}</button></div>
  ${o && !o.dore && !estLg ? `<button class="bouton second" data-a="dorer" data-v="${k}" ${S.poussiere >= doreCout ? '' : 'disabled'}>Dorer son cadre · ${doreCout} poussière d’or</button><button class="bouton second" data-a="dorer-en-jouant" data-v="${k}" ${chassesRestantes() ? '' : 'disabled'}>La rejouer ${JEU[jeuDeLaCarte(c)].a} pour la dorer · une chasse</button><p class="mini muet" style="text-align:center">Doré en jouant : trois manches parfaites, sans qu’un pouvoir ait servi.</p>` : ''}`;
}

function ecranGalerie() {
  const tous = Object.keys(NOM_DU_LEGENDAIRE);
  const comment = lg => { const f = salleDuGardien(lg); if (f) return GARDIENS[f][0] === lg ? `Complète ${FAM[f].salle}` : `Dore tous les cadres de ${FAM[f].salle}`; return AUTRES_LEGENDAIRES[lg].comment; };
  const l = tous.map(lg => {
    const a = S.legendaires.includes(lg);
    return `<button class="oeuvre" data-a="${a ? 'cartel' : ''}" data-v="${CARTE_DU_LEGENDAIRE[lg] ? CARTE_DU_LEGENDAIRE[lg].k : ''}" style="align-items:center;text-align:center">
      <img class="medaillon ${a ? '' : 'endormi'}" style="width:74px;height:74px" src="medaillons/${lg}.webp" alt="">
      <span class="petit" style="font-weight:700">${a ? NOM_DU_LEGENDAIRE[lg] : 'Endormi'}</span><span class="mini muet">${a ? POUVOIRS[pouvoirDe(CARTE_DU_LEGENDAIRE[lg])].nom : esc(comment(lg))}</span></button>`;
  }).join('');
  return `${barre('hall', 'Le Cabinet', `<span class="petit muet">${S.legendaires.length} / 23</span>`)}
  <div class="pile" style="gap:4px"><h1>Les gardiens</h1><p class="petit muet">Les légendaires veillent sur les salles. Chacun se réveille d’une façon précise, et devient une carte-bonus très forte.</p></div>
  <div class="grille3">${l}</div>`;
}

function ecranEveil() {
  const l = S.eveils.splice(0); sauver();
  return `<div class="pile" style="align-items:center;text-align:center;gap:10px;margin-top:20px">
    ${l.map(lg => `<img class="medaillon eveil" style="width:150px;height:150px;border-width:3px" src="medaillons/${lg}.webp" alt=""><span class="etiquette">Un gardien se réveille</span><h1>${NOM_DU_LEGENDAIRE[lg]}</h1><p class="petit muet">${salleDuGardien(lg) ? `Il veille désormais sur ${FAM[salleDuGardien(lg)].salle}.` : `Gardien de saison : ${AUTRES_LEGENDAIRES[lg].comment.toLowerCase()}.`} Sa carte-bonus : ${POUVOIRS[pouvoirDe(CARTE_DU_LEGENDAIRE[lg])].nom}, ${forceDite(CARTE_DU_LEGENDAIRE[lg])}.</p>`).join('<hr style="width:60%;border:none;border-top:1px solid rgba(255,255,255,.1)">')}
  </div><button class="bouton" data-a="aller" data-v="galerie">Voir les gardiens</button><button class="bouton second" data-a="aller" data-v="hall">Retour au Cabinet</button>`;
}

function ecranMurs() {
  const pins = S.murs.lieux.map(l => { const [x, y] = proj(l.lon, l.lat); return `<circle cx="${x}" cy="${y}" r="5" fill="var(--juste)" stroke="#16202a" stroke-width="1.5"><title>${esc(l.nom)}</title></circle>`; }).join('');
  const dates = S.murs.dates.slice().sort((a, b) => a.an - b.an);
  return `${barre('hall', 'Le Cabinet')}
  <div class="pile" style="gap:4px"><h1>Tes murs</h1><p class="petit muet">Ce que tes parties t’ont appris trouve sa place ici : un lieu sur ta carte, une date sur ta frise.</p></div>
  <div class="zone-carte">${carteSvg(pins, false)}</div>
  <p class="mini muet" style="text-align:center">${pluriel(S.murs.lieux.length, 'lieu épinglé', 'lieux épinglés')}${S.murs.lieux.length ? ' : ' + S.murs.lieux.map(l => esc(l.nom)).join(', ') : ''}</p>
  <div class="bloc pile" style="gap:8px"><span class="etiquette">Ta frise · du plus ancien au plus récent</span>${dates.length ? `<div class="frise">${dates.map(d => `<div class="evt"><span class="an">${d.an < 0 ? -d.an + ' av.' : d.an}</span><span class="pt"></span><span class="lb">${typo(d.lb)}</span></div>`).join('')}</div>` : '<p class="petit muet">Encore vide. Une partie de Frise ou d’Épingle la commencera.</p>'}</div>`;
}

function ecranLibre() {
  const r = libresQuiPaient();
  return `${barre('hall', 'Le Cabinet')}
  <div class="pile" style="gap:4px"><h1>Jouer librement</h1><p class="petit muet">Les neuf jeux, autant que tu veux, sans œuvre à gagner. ${r ? `Tes ${pluriel(r, 'prochaine partie rapporte', 'prochaines parties rapportent')} de la poussière d’or ; ensuite, c’est pour le plaisir.` : 'Pour aujourd’hui, c’est pour le plaisir : la poussière d’or revient demain.'}</p></div>
  ${JEUX.map(j => `<button class="tuile" data-a="partie-libre" data-v="${j.id}"><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span class="titre-tuile">${j.nom}</span><span class="mini muet">${j.geste}</span></span>${fleche()}</button>`).join('')}`;
}

function ecranRegles() {
  const mot = (m, d) => `<div><b class="petit">${m}</b><p class="mini muet">${d}</p></div>`;
  return `${barre('hall', 'Le Cabinet')}
  <h1>Comment ça marche</h1>
  <div class="bloc pile" style="gap:6px"><b>Le principe</b><p class="petit muet">Ton Cabinet est un musée à remplir : 84 œuvres, les cartes peintes, rangées en neuf salles. Tu les gagnes en jouant à de petits jeux de deux minutes. Chaque partie a trois manches, et chaque manche vaut jusqu’à trois étoiles : neuf en tout.</p></div>
  <div class="bloc pile" style="gap:6px"><b>Chaque jour</b><p class="petit muet">La visite du jour te propose trois parties. Tu as aussi deux chasses : tu choisis une œuvre qui te manque et tu joues au jeu où elle se trouve. Et tu peux jouer librement autant que tu veux.</p></div>
  <div class="bloc pile" style="gap:8px"><b>Les mots du Cabinet</b>
    ${mot('Œuvre', 'Une carte peinte, à exposer dans sa salle.')}
    ${mot('Rareté', 'Commune, rare, épique : plus une œuvre est rare, plus il faut d’étoiles pour la gagner (5, 6 ou 7 sur 9).')}
    ${mot('Cadre doré', 'Une œuvre gagnée sans faute — trois manches parfaites, sans qu’un pouvoir ait servi — ou dorée avec de la poussière d’or.')}
    ${mot('Poussière d’or', 'La monnaie du Cabinet. Chaque partie en rapporte, même ratée. Elle achète une œuvre précise ou dore un cadre.')}
    ${mot('Gardien', 'Un légendaire qui veille sur une salle. Il se réveille quand la salle est complète ; un second, quand elle est toute dorée.')}
    ${mot('Carte-bonus', 'Une de tes cartes, que tu emmènes dans tes parties pour son pouvoir. Elle ne s’use jamais.')}
    ${mot('Chasse', 'Partir chercher l’œuvre de ton choix, ou rejouer une œuvre pour la dorer : deux fois par jour.')}
    ${mot('Série', 'Le nombre de jours d’affilée où tu as joué une partie de visite ou de chasse.')}
    ${mot('Le Pari', 'Un des neuf jeux : après une bonne réponse, tu gardes une étoile ou tu paries sur une question plus difficile.')}
  </div>
  <div class="bloc pile" style="gap:8px"><b>Les pouvoirs des cartes-bonus</b><p class="mini muet">Le pouvoir vient de la salle de la carte ; sa rareté le rend plus fort.</p>
    ${Object.values(POUVOIRS).map(p => mot(p.nom, p.dit)).join('')}</div>
  <div class="bloc pile" style="gap:6px"><b>Ce que tu apprends</b><p class="petit muet">Chaque œuvre gagnée garde sur son cartel la question, la réponse et l’anecdote de la partie. Les lieux et les dates rejoignent tes murs. Ce que tu as vu ne revient pas avant une semaine.</p></div>`;
}

// ———————————————————————————————— La partie ————————————————————————————————

function nouvellePartie(jeu, cible, origine, index) {
  arreterMinuteur();
  const ok = k => k && (S.oeuvres[k] || (CARTE[k] && CARTE[k].lg && S.legendaires.includes(CARTE[k].lg)));
  P = { jeu, cible, origine, index, emportee: ok(S.emportee) ? S.emportee : null, usages: 0, manche: 0, etoiles: [], naturel: [], miseFaite: false, mise: false, phase: 'annonce', m: null, savais: [], theme: '', lieux: [], dates: [] };
  vue = { ecran: 'annonce' };
  rendre();
  window.scrollTo(0, 0);
}

function ecranAnnonce() {
  const j = JEU[P.jeu], c = P.cible ? CARTE[P.cible] : null;
  const choix = cartesEmportables().sort((x, y) => (y.k === P.emportee) - (x.k === P.emportee)).map(e => `<button class="oeuvre" data-a="choisir-emportee" data-v="${e.k}" style="width:82px;flex:none;align-items:center;text-align:center">
      <span class="cadre" style="width:78px;padding:3px;${P.emportee === e.k ? 'background:var(--or);box-shadow:0 0 0 2px var(--or)' : ''}"><img src="${imgCarte(e)}" alt=""></span>
      <span class="mini" style="font-weight:700;line-height:1.15">${esc(e.lg ? NOM_DU_LEGENDAIRE[e.lg] : e.n)}</span><span class="mini muet" style="line-height:1.15">${POUVOIRS[pouvoirDe(e)].nom}</span></button>`).join('');
  const emp = P.emportee ? CARTE[P.emportee] : null;
  const deja = c && possede(c.k);
  const retour = P.origine === 'libre' ? ['libre', 'Jouer librement'] : P.origine === 'chasse' ? ['salle:' + c.f, FAM[c.f].nom] : ['visite', 'La visite'];
  const dit = emp ? (pouvoirDe(emp) === 'eclairer' ? `${j.eclairer} — ${forceDite(emp)}` : `${POUVOIRS[pouvoirDe(emp)].dit} ${forceDite(emp)}.`) : '';
  return `${barre(retour[0], retour[1])}
  <div class="pile" style="gap:4px"><span class="etiquette">Trois manches · neuf étoiles</span><h1>${esc(j.nom)}</h1><p class="petit muet">${j.geste}</p></div>
  ${c ? `<div class="bloc ligne" style="gap:14px"><span class="cadre" style="width:116px;flex:none;${deja ? '' : 'box-shadow:0 0 18px rgba(217,181,106,.3)'}">${deja ? `<img src="${c.img}" alt="">` : `<span class="vide" style="border:none"><span class="q">?</span></span>`}</span>
     <span class="pile" style="gap:4px"><span class="etiquette">${deja ? 'Pour dorer' : 'À gagner'}</span><span class="titre-tuile">${deja ? esc(c.n) : 'Une œuvre ' + RARETE[c.r].toLowerCase()}</span><span class="mini muet">${deja ? 'Trois manches parfaites, sans qu’un pouvoir ait servi, pour dorer son cadre.' : `Il faut ${SEUIL[c.r]} étoiles sur 9 ; neuf sans qu’un pouvoir ait servi pour un cadre doré. Elle rejoindra ${esc(FAM[c.f].salle)}.`}</span></span></div>`
    : `<div class="bandeau">Partie libre : pas d’œuvre en jeu. ${libresQuiPaient() ? 'Chaque étoile rapporte de la poussière d’or.' : 'Pour le plaisir : tu as eu ta poussière du jour.'}</div>`}
  <p class="petit" style="text-align:center"><span class="muet">Par manche :</span> ${j.bareme}</p>
  <div class="pile" style="gap:8px"><b>Ta carte-bonus</b><p class="mini muet">Les cartes que tu possèdes ont un pouvoir. Choisis celle qui t’aidera pendant la partie : elle ne s’use pas.${emp ? ` <span style="color:var(--fg)">${esc(emp.lg ? NOM_DU_LEGENDAIRE[emp.lg] : emp.n)} : ${POUVOIRS[pouvoirDe(emp)].nom.toLowerCase()} — ${dit}</span>` : ''}${P.jeu === 'frise' && emp && pouvoirDe(emp) === 'changer' ? ' Changer ne sert pas à la Frise, qui se construit d’un bout à l’autre.' : ''}</p>
    <div class="defile">${choix}<button class="oeuvre" data-a="choisir-emportee" data-v="" style="width:82px;flex:none;align-items:center;text-align:center"><span class="vide" style="width:78px;${P.emportee ? '' : 'border-color:var(--or)'}"></span><span class="mini">Aucune</span></button></div></div>
  <button class="bouton" data-a="commencer">Commencer</button>`;
}

// La carte-bonus emportée : ce qu'il en reste, et si elle peut servir maintenant.
const empCarte = () => P.emportee ? CARTE[P.emportee] : null;
// Protéger et Miser ne servent qu'une fois par partie ; la rareté règle leur force, pas leur nombre.
const usagesRestants = () => { const c = empCarte(); if (!c) return 0; const p = pouvoirDe(c); return (p === 'proteger' || p === 'miser' ? 1 : forceDe(c)) - P.usages; };
const bonusDeMise = c => forceDe(c) + 1;
const bonusDeProtection = c => forceDe(c) >= 3 ? 2 : 1;
const nomCarte = c => esc(c.lg ? NOM_DU_LEGENDAIRE[c.lg] : c.n);
function puceDuPouvoir() {
  const c = empCarte(); if (!c) return '';
  const p = pouvoirDe(c), reste = usagesRestants();
  if (p === 'temps') return `<span class="carte-emportee passive"><img src="${imgCarte(c)}" alt=""><span><b>${nomCarte(c)}</b><br><span class="muet">+${10 * forceDe(c)} s, toujours actif</span></span></span>`;
  if (p === 'proteger') return `<span class="carte-emportee passive ${reste <= 0 ? 'use' : ''}"><img src="${imgCarte(c)}" alt=""><span><b>${nomCarte(c)} · ${Math.max(0, reste)}</b><br><span class="muet">${reste > 0 ? `+${bonusDeProtection(c)} à ta prochaine manche imparfaite` : 'a déjà protégé une manche'}</span></span></span>`;
  if (p === 'miser') return `<span class="carte-emportee passive ${P.miseFaite && !P.mise ? 'use' : ''}"><img src="${imgCarte(c)}" alt=""><span><b>${nomCarte(c)}</b><br><span class="muet">${P.mise ? `mise sur cette manche : +${bonusDeMise(c)} si parfaite` : P.miseFaite ? 'mise déjà jouée' : 'tu pourras miser avant une manche'}</span></span></span>`;
  if (p === 'changer' && P.jeu === 'frise') return `<span class="carte-emportee passive use"><img src="${imgCarte(c)}" alt=""><span><b>${nomCarte(c)}</b><br><span class="muet">Changer ne sert pas à la Frise</span></span></span>`;
  const jouable = reste > 0 && P.phase === 'jouer' && peutJouerLePouvoir(p);
  const libelle = p === 'eclairer' ? JEU[P.jeu].eclairer : 'changer de manche';
  return `<button class="carte-emportee ${jouable ? '' : 'use'}" data-a="${jouable ? 'pouvoir' : ''}" ${jouable ? '' : 'aria-disabled="true"'}><img src="${imgCarte(c)}" alt=""><span><b>${nomCarte(c)} · ${Math.max(0, reste)}</b><br><span class="muet">${libelle}</span></span></button>`;
}
function peutJouerLePouvoir(p) {
  if (p === 'changer') return !P.m.touche && P.jeu !== 'frise';
  return MODULES[P.jeu].peutEclairer ? MODULES[P.jeu].peutEclairer() : true;
}
function jouerLePouvoir() {
  const c = empCarte(); if (!c || usagesRestants() <= 0) return;
  const p = pouvoirDe(c);
  if (!peutJouerLePouvoir(p)) return;
  P.usages++; P.aide = true;
  if (p === 'changer') { P.m = MODULES[P.jeu].manche(P.manche, true); P.m.touche = false; toast('Nouvelle manche — le chrono continue.'); }
  else MODULES[P.jeu].eclairer();
  rendre();
}

// Une manche commence : la mise d'abord (sans rien voir), puis la manche et son chrono.
function ouvrirLaManche() {
  const c = empCarte();
  P.note = ''; P.tempsEcoule = false; P.quitter = false;
  if (c && pouvoirDe(c) === 'miser' && !P.miseFaite) { P.phase = 'avant'; P.m = null; return rendre(); }
  demarrerLaManche();
}
function garderLaPartie() { S.enCours = { jeu: P.jeu, cible: P.cible, origine: P.origine, index: P.index, etoiles: P.etoiles, naturel: P.naturel, aide: P.aide, theme: P.theme, savais: P.savais, lieux: P.lieux, dates: P.dates }; sauver(); }
function demarrerLaManche() {
  P.phase = 'jouer';
  garderLaPartie();
  P.m = MODULES[P.jeu].manche(P.manche, false);
  lancerMinuteur();
  rendre();
  window.scrollTo(0, 0);
}
function commencer() {
  MODULES[P.jeu].preparer && MODULES[P.jeu].preparer();
  vue = { ecran: 'jeu' };
  ouvrirLaManche();
}
function dureeDeLaManche() {
  const c = empCarte();
  return JEU[P.jeu].duree + (c && pouvoirDe(c) === 'temps' ? 10 * forceDe(c) : 0);
}
function lancerMinuteur(duree) {
  arreterMinuteur();
  P.duree = duree || dureeDeLaManche(); P.fin = Date.now() + P.duree * 1000;
  minuteur = setInterval(majChrono, 250);
}
function majChrono() {
  if (!P || P.phase !== 'jouer' || !P.fin) return arreterMinuteur();
  const reste = Math.max(0, (P.fin - Date.now()) / 1000);
  const el = document.querySelector('.chrono span'); if (el) { el.style.width = (100 * reste / P.duree) + '%'; el.classList.toggle('bientot', reste < 8); }
  const t = document.querySelector('.chrono-txt'); if (t) t.textContent = Math.ceil(reste) + ' s';
  if (reste <= 0) { arreterMinuteur(); P.tempsEcoule = true; MODULES[P.jeu].tempsEcoule(); }
}
function arreterMinuteur() { if (minuteur) clearInterval(minuteur); minuteur = null; }

// Une manche se juge : ses étoiles, la mise, la protection, puis la révélation.
function jugerLaManche(n, savais) {
  arreterMinuteur();
  let e = n, note = P.tempsEcoule ? 'Temps écoulé. ' : '';
  const c = empCarte();
  P.naturel[P.manche] = n;
  // Le temps en plus n'aide que s'il a servi : répondre avant la fin du temps normal laisse la manche sans aide.
  if (c && pouvoirDe(c) === 'temps' && P.fin && P.fin - Date.now() < 10 * forceDe(c) * 1000) P.aide = true;
  if (P.mise) { e = n === 3 ? 3 + bonusDeMise(c) : 0; note += n === 3 ? `Mise gagnée : +${bonusDeMise(c)} étoiles.` : 'Mise perdue : la manche ne rapporte rien.'; P.mise = false; P.aide = true; P.usages++; }
  else if (n < 3 && c && pouvoirDe(c) === 'proteger' && usagesRestants() > 0) { e = Math.min(3, n + bonusDeProtection(c)); P.usages++; P.aide = true; note += `${nomCarte(c)} protège la manche : +${e - n} étoile${e - n > 1 ? 's' : ''}.`; }
  P.etoiles[P.manche] = e;
  if (savais) P.savais.push(savais);
  P.phase = 'revele'; P.note = note;
  garderLaPartie();
  rendre();
}
function mancheSuivante() {
  if (P.manche >= 2) return finirLaPartie();
  P.manche++;
  ouvrirLaManche();
}
// Quitter compte la partie avec ses étoiles : on ne relance pas une chasse jusqu'à tomber sur du facile.
function quitter(confirme) {
  if (!confirme) { P.quitter = true; if (P.phase === 'jouer' && P.fin) { P.resteAvantQuitter = Math.max(1, (P.fin - Date.now()) / 1000); arreterMinuteur(); } return rendre(); }
  arreterMinuteur();
  if (P.origine === 'libre') { if (S.libres.jour !== S.jour) S.libres = { jour: S.jour, n: 0 }; S.libres.n++; S.enCours = null; sauver(); P = null; return aller('libre'); }
  for (let i = 0; i < 3; i++) if (P.etoiles[i] == null) { P.etoiles[i] = 0; P.naturel[i] = 0; }
  P.manche = 2;
  finirLaPartie();
}

function ecranJeu() {
  const total = Math.min(9, P.etoiles.reduce((s, x) => s + (x || 0), 0));
  const points = [0, 1, 2].map(i => `<span class="${i < P.manche || (i === P.manche && P.phase === 'revele') ? 'fait' : ''}"></span>`).join('');
  const haut = `<div class="haut-collant"><div class="haut-jeu"><div class="points" aria-label="Manche ${P.manche + 1} sur 3">${points}</div><span class="petit or" style="font-weight:700">${total} / 9 ★</span><button class="retour" data-a="quitter" style="font-size:14px">Quitter</button></div>
    ${P.phase === 'jouer' ? `<div class="ligne"><div class="chrono" style="flex:1"><span style="width:100%"></span></div><span class="mini muet chrono-txt" style="width:38px;text-align:right">${Math.ceil(P.duree)} s</span></div>` : ''}
    ${P.quitter ? `<div class="bandeau or pile" style="gap:8px"><span class="petit">${P.origine === 'libre' ? 'Quitter cette partie libre ?' : 'Quitter ? La partie compte avec les étoiles déjà gagnées, et ' + (P.origine === 'chasse' ? 'la chasse est utilisée.' : 'elle sera faite pour aujourd’hui.')}</span><div class="grille2"><button class="bouton second" data-a="rester">Continuer</button><button class="bouton" data-a="quitter-oui">Quitter</button></div></div>` : ''}</div>`;
  if (P.phase === 'avant') {
    const c = empCarte();
    return `${haut}<div class="pile" style="align-items:center;text-align:center;gap:12px;margin-top:24px"><span class="etiquette">Manche ${P.manche + 1} sur 3</span><img src="${imgCarte(c)}" alt="" style="width:160px;border-radius:6px;border:4px solid var(--cadre)"><h2>Miser sur cette manche ?</h2><p class="petit muet">Tu ne la vois pas encore. Parfaite (trois étoiles) : +${bonusDeMise(c)} étoiles en plus. Sinon : elle ne rapporte rien. Une seule mise par partie.</p></div>
      <div class="grille2"><button class="bouton second" data-a="ne-pas-miser">Pas cette fois</button><button class="bouton" data-a="miser">Miser</button></div>`;
  }
  const corps = MODULES[P.jeu].rendre();
  const pied = P.phase === 'revele'
    ? `<div class="pied-collant pile">${P.note ? `<div class="bandeau or">${P.note}</div>` : ''}<button class="bouton" data-a="suivante">${P.manche >= 2 ? 'Voir le bilan' : 'Manche suivante'}</button></div>`
    : `<div class="ligne" style="justify-content:flex-start">${puceDuPouvoir()}</div>`;
  return `${haut}${corps}${pied}`;
}
const revelation = (e, titre, sous) => `<div class="entre"><span class="verdict">${titre}</span><span class="etoiles" style="font-size:22px" aria-label="${e} étoiles sur 3">${etoiles(e)}</span></div>${sous ? `<p class="petit muet" style="margin-top:-6px">${sous}</p>` : ''}`;
const leSavais = s => s && s.txt ? `<div class="cartel"><span class="etiquette">Le savais-tu ?</span><p class="phrase">${typo(s.txt)}</p></div>` : '';

// ———————————————————————————————— Le bilan ————————————————————————————————

function finirLaPartie() {
  arreterMinuteur();
  const total = Math.min(9, P.etoiles.reduce((s, x) => s + (x || 0), 0));
  const parfaite = P.naturel.length === 3 && P.naturel.every(x => x === 3) && !P.aide;
  const c = P.cible ? CARTE[P.cible] : null;
  const savais = P.savais.find(s => s && s.txt) || null;
  const r = { total, carte: null, dore: false, nouvelle: false, double: false, poussiere: 0, eveils: [], lieuxNeufs: 0, datesNeuves: 0 };
  if (P.origine === 'libre') {
    if (libresQuiPaient()) { r.poussiere = POUSSIERE_PAR_ETOILE * total; if (S.libres.jour !== S.jour) S.libres = { jour: S.jour, n: 0 }; S.libres.n++; }
  } else {
    r.poussiere = Math.max(4, POUSSIERE_PAR_ETOILE * total);
    if (c) {
      const deja = possede(c.k);
      if (!deja && total >= SEUIL[c.r]) {
        S.oeuvres[c.k] = { n: 1, dore: parfaite, origine: 'partie', cartel: { ...(savais || { txt: '' }), jeu: P.jeu, theme: P.theme, etoiles: total, jour: S.jour } };
        r.carte = c.k; r.nouvelle = true; r.dore = parfaite;
        const sa = saison(); if (sa && !S.legendaires.includes(sa)) { S.legendaires.push(sa); r.eveils.push(sa); }
      } else if (deja && parfaite && !S.oeuvres[c.k].dore) {
        S.oeuvres[c.k].dore = true; r.carte = c.k; r.dore = true;
      } else if (deja && total >= SEUIL[c.r]) {
        S.oeuvres[c.k].n++; r.carte = c.k; r.double = true; r.poussiere += POUSSIERE_DU_DOUBLE[c.r];
        if (!S.oeuvres[c.k].cartel && savais) S.oeuvres[c.k].cartel = { ...savais, jeu: P.jeu, theme: P.theme, etoiles: total, jour: S.jour };
      }
    }
  }
  S.poussiere += r.poussiere;
  S.enCours = null;
  for (const l of P.lieux) if (!S.murs.lieux.some(x => x.nom === l.nom)) { S.murs.lieux.push(l); r.lieuxNeufs++; }
  for (const d of P.dates) if (!S.murs.dates.some(x => x.lb === d.lb)) { S.murs.dates.push(d); r.datesNeuves++; }
  if (P.origine === 'visite') { const v = S.visite.parties[P.index]; v.faite = true; v.etoiles = total; v.gagnee = r.nouvelle || r.dore; }
  if (P.origine === 'chasse') { if (S.chasses.jour !== S.jour) S.chasses = { jour: S.jour, n: 0 }; S.chasses.n++; }
  if (P.origine !== 'libre' && !S.jours.includes(S.jour)) S.jours.push(S.jour);
  r.eveils.push(...verifierLesGardiens());
  sauver();
  P.resultat = r; P.phase = 'bilan';
  vue = { ecran: 'bilan' };
  rendre();
  window.scrollTo(0, 0);
}
function verifierLesGardiens() {
  const neufs = [];
  const reveiller = lg => { if (!S.legendaires.includes(lg)) { S.legendaires.push(lg); neufs.push(lg); } };
  for (const f of FAMILLES) {
    const l = oeuvresDe(f.id), [g1, g2] = GARDIENS[f.id];
    if (l.every(c => possede(c.k))) reveiller(g1);
    if (l.every(c => possede(c.k) && S.oeuvres[c.k].dore)) reveiller(g2);
  }
  if (OEUVRES.every(c => possede(c.k))) reveiller('trou-noir');
  if (serie() >= 30) reveiller('scarabee');
  return neufs;
}

function ecranBilan() {
  const r = P.resultat, c = r.carte ? CARTE[r.carte] : P.cible ? CARTE[P.cible] : null;
  const lignes = P.etoiles.map((e, i) => `<div class="entre bloc" style="padding:10px 14px"><span>Manche ${i + 1}</span><span class="etoiles">${e > 3 ? `★★★ +${e - 3}` : etoiles(e)}</span></div>`).join('');
  let message;
  if (r.nouvelle && r.dore) message = `<b>Sans faute : tu la gagnes, et son cadre est doré.</b>`;
  else if (r.nouvelle) message = `<b>${r.total} étoiles : c'est gagné.</b><br><span class="petit muet">Une œuvre t’attend. Pour son cadre doré : trois manches parfaites, sans qu’un pouvoir ait servi.</span>`;
  else if (r.dore) message = `<b>Trois manches parfaites : le cadre se dore.</b>`;
  else if (r.double) message = `<b>Gagnée, mais tu l’avais déjà.</b><br><span class="petit muet">Le double devient de la poussière d’or.</span>`;
  else if (P.origine === 'libre') message = r.poussiere ? `<b>Partie libre : +${r.poussiere} poussière d’or.</b>` : `<b>Partie libre, pour le plaisir.</b><br><span class="petit muet">Ta poussière d’or du jour est déjà gagnée.</span>`;
  else if (!c) message = `<b>Bien joué.</b>`;
  else message = `<b>Pas assez d’étoiles cette fois.</b><br><span class="petit muet">Il en fallait ${SEUIL[c.r]}. L’œuvre reste à gagner.</span>`;
  const peutRetenter = P.origine === 'visite' && c && !r.nouvelle && !possede(c.k) && chassesRestantes() > 0;
  const appris = [r.lieuxNeufs ? `+${pluriel(r.lieuxNeufs, 'lieu', 'lieux')} sur ta carte` : '', r.datesNeuves ? `+${pluriel(r.datesNeuves, 'date', 'dates')} sur ta frise` : ''].filter(Boolean).join(' · ');
  return `<div class="pile" style="align-items:center;gap:2px;margin-top:8px"><span class="etiquette muet">${JEU[P.jeu].nom}${P.theme ? ' · ' + esc(P.theme) : ''}</span>
    <span class="verdict" style="font-size:60px;color:var(--or)">${r.total} / 9</span></div>
  <div class="pile" style="gap:8px">${lignes}</div>
  <div class="bandeau or">${message}${r.poussiere && P.origine !== 'libre' ? `<br><span class="petit muet">+${r.poussiere} poussière d’or.</span>` : ''}</div>
  ${appris ? `<p class="mini muet" style="text-align:center">${appris}</p>` : ''}
  ${r.nouvelle || r.dore || r.double ? `<button class="bouton" data-a="acquisition">${r.double ? 'Voir l’œuvre' : 'Découvrir ton œuvre'}</button>` : r.eveils.length ? `<button class="bouton" data-a="eveil">${NOM_DU_LEGENDAIRE[r.eveils[0]]} se réveille</button>` : `<button class="bouton" data-a="apres">Continuer</button>`}
  ${peutRetenter ? `<button class="bouton second" data-a="retenter">Retenter cette œuvre ${JEU[P.jeu].a} · utilise une chasse</button>` : ''}
  ${P.origine === 'libre' ? `<button class="bouton second" data-a="rejouer">Rejouer à ce jeu</button>` : ''}`;
}

function ecranAcquisition() {
  const r = P.resultat, c = CARTE[r.carte];
  const salle = oeuvresDe(c.f), n = salle.filter(x => possede(x.k)).length;
  const reste = salle.filter(x => !possede(x.k)).map(x => JEU[jeuDeLaCarte(x)].a);
  const g = GARDIENS[c.f][0];
  return `<div class="pile apparait" style="align-items:center;gap:4px;margin-top:6px;text-align:center"><span class="etiquette">${r.nouvelle ? 'Nouvelle œuvre' : r.dore ? 'Cadre doré' : 'Un double'}</span><h1 style="font-size:40px">${esc(c.n)}</h1><span class="petit muet">${RARETE[c.r]} · ${esc(FAM[c.f].salle)}</span></div>
  <div class="cadre ${S.oeuvres[c.k].dore ? 'dore' : ''} apparait" style="padding:12px;box-shadow:0 18px 50px rgba(217,181,106,.25)"><img src="${c.img}" alt="${esc(c.n)}"></div>
  ${r.nouvelle ? blocCartel(S.oeuvres[c.k], c) : ''}
  <div class="bloc pile" style="gap:8px"><div class="entre"><b>${esc(FAM[c.f].nom)}</b><span class="or">${n} / ${salle.length}</span></div><div class="jauge"><span style="width:${100 * n / salle.length}%"></span></div>
    <span class="petit muet">${n === salle.length ? 'Salle complète !' : `Encore ${pluriel(salle.length - n, 'œuvre', 'œuvres')} à trouver : ${[...new Set(reste)].join(', ')}. ${NOM_DU_LEGENDAIRE[g]}, le gardien, ${n >= salle.length - 2 ? 's’étire' : 'dort encore'}.`}</span></div>
  ${r.nouvelle ? `<div class="bloc pile" style="gap:4px"><b>Sa carte-bonus : ${POUVOIRS[pouvoirDe(c)].nom}</b><span class="petit muet">${POUVOIRS[pouvoirDe(c)].dit} ${forceDite(c)}.</span></div>` : ''}
  <button class="bouton" data-a="${r.eveils.length ? 'eveil' : 'apres'}">${r.eveils.length ? NOM_DU_LEGENDAIRE[r.eveils[0]] + ' se réveille' : 'Continuer'}</button>`;
}

// ———————————————————————————————— La carte de France ————————————————————————————————

const K = 30, OX = 5.4, OY = 51.4, COS = Math.cos(46.5 * Math.PI / 180);
const proj = (lon, lat) => [((lon + OX) * COS * K + 6).toFixed(1), ((OY - lat) * K + 6).toFixed(1)];
const deproj = (x, y) => [(x - 6) / (COS * K) - OX, OY - (y - 6) / K];
const LARGEUR = Math.ceil((9.7 + OX) * COS * K + 50), HAUTEUR = Math.ceil((OY - 41.3) * K + 12);
function carteSvg(dessus, cliquable) {
  const p = l => l.map(([lo, la]) => proj(lo, la).join(',')).join(' ');
  const villes = window.VILLES.map(([n, lo, la]) => { const [x, y] = proj(lo, la); return `<circle cx="${x}" cy="${y}" r="2.6" fill="#a59886"/><text x="${+x + 5}" y="${+y - 4}" font-size="11" fill="#b9ad9c" font-family="Figtree,sans-serif">${n}</text>`; }).join('');
  return `<svg class="carte-france" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" ${cliquable ? 'data-a="carte" role="img" aria-label="Carte de France : touche pour planter ton épingle"' : 'role="img" aria-label="Ta carte de France"'}>
    <polygon points="${p(window.FRANCE)}" fill="#2b3a2a" stroke="#6f8f6a" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="${p(window.CORSE)}" fill="#2b3a2a" stroke="#6f8f6a" stroke-width="1.5" stroke-linejoin="round"/>
    ${villes}${dessus}</svg>`;
}
const distanceKm = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const epingleSvg = (lon, lat) => { const [x, y] = proj(lon, lat); return `<path d="M${x} ${y} l-7 -16 a8.5 8.5 0 1 1 14 0 z" fill="var(--or)" stroke="#1a1412" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="2" fill="#1a1412"/>`; };

// ———————————————————————————————— Les neuf modules ————————————————————————————————

const B = window.BASE;
const MODULES = {};
const qcmSavais = q => ({ sujet: q.t, rep: q.r[q.b], txt: q.a });

MODULES.epingle = {
  preparer() { const g = pioche('epingle', window.EPINGLES, x => x.theme); P.theme = g.theme; P.groupe = melanger(g.lieux); P.reserve = melanger(window.EPINGLES.filter(x => x !== g).flatMap(x => x.lieux)); },
  manche(i, change) { return { lieu: change ? P.reserve.pop() : P.groupe[i], pin: null, zone: null, touche: false }; },
  etoiles(km) { return km < 40 ? 3 : km < 120 ? 2 : km < 300 ? 1 : 0; },
  peutEclairer() { return !P.m.zone; },
  eclairer() { const l = P.m.lieu, a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 100; P.m.zone = { lat: l.lat + Math.sin(a) * d / 111, lon: l.lon + Math.cos(a) * d / (111 * COS), r: 170 }; },
  clic(x, y) { if (P.phase !== 'jouer') return; const [lon, lat] = deproj(x, y); P.m.pin = { lon, lat }; P.m.touche = true; rendre(); },
  valider() { const m = P.m; if (!m.pin) return; m.km = distanceKm(m.pin.lat, m.pin.lon, m.lieu.lat, m.lieu.lon); this.retenir(); jugerLaManche(this.etoiles(m.km), { sujet: m.lieu.q, rep: m.lieu.ville + ', ' + m.lieu.date, txt: m.lieu.savais }); },
  retenir() { const l = P.m.lieu; P.lieux.push({ nom: l.nom, lat: l.lat, lon: l.lon }); P.dates.push({ lb: l.nom + ' — ' + l.recit.split('.')[0], an: l.an }); },
  tempsEcoule() { if (P.m.pin) this.valider(); else { P.m.km = null; this.retenir(); jugerLaManche(0, { sujet: P.m.lieu.q, rep: P.m.lieu.ville, txt: P.m.lieu.savais }); } },
  rendre() {
    const m = P.m, l = m.lieu;
    let dessus = '';
    if (m.zone) { const [x, y] = proj(m.zone.lon, m.zone.lat); dessus += `<circle cx="${x}" cy="${y}" r="${(m.zone.r / 111 * K).toFixed(1)}" fill="rgba(127,183,232,.14)" stroke="var(--rare)" stroke-dasharray="4 3"/>`; }
    if (P.phase === 'revele') { const [x, y] = proj(l.lon, l.lat); if (m.pin) { const [a, b] = proj(m.pin.lon, m.pin.lat); dessus += `<line x1="${a}" y1="${b}" x2="${x}" y2="${y}" stroke="#f3ead9" stroke-dasharray="3 3"/>`; } dessus += `<circle cx="${x}" cy="${y}" r="7" fill="var(--juste)" stroke="#16202a" stroke-width="2"/><text x="${+x + 10}" y="${+y + 5}" font-size="13" font-weight="700" fill="#e1effa" font-family="Figtree,sans-serif">${esc(l.nom)}</text>`; }
    if (m.pin) dessus += epingleSvg(m.pin.lon, m.pin.lat);
    if (P.phase === 'revele') {
      return `${revelation(Math.min(3, P.naturel[P.manche]), m.km == null ? 'Pas d’épingle' : 'À ' + nombre(Math.round(m.km)) + ' km', esc(l.ville) + ' · ' + esc(l.date))}<div class="zone-carte">${carteSvg(dessus, false)}</div>${leSavais({ txt: l.savais })}`;
    }
    return `<div class="cartel" style="gap:4px"><span class="etiquette">${esc(l.date)} · ${esc(P.theme)}</span><p class="petit">${typo(l.recit)}</p><p class="phrase" style="font-size:22px">${typo(l.q)}</p></div>
      ${m.zone ? '<div class="bandeau">Indice : c’est quelque part dans la zone entourée.</div>' : ''}
      <p class="mini muet">${m.pin ? 'Touche ailleurs pour déplacer ton épingle.' : 'Touche la carte pour planter ton épingle.'}</p>
      <div class="zone-carte">${carteSvg(dessus, true)}</div>
      <button class="bouton" data-a="m" data-v="valider" ${m.pin ? '' : 'disabled'}>Planter ici</button>`;
  }
};

MODULES.frise = {
  preparer() { const f = pioche('frise', window.FRISES, x => x.theme); P.theme = f.theme; P.friseSavais = f.savais; const e = melanger(f.evts.map(([lb, an]) => ({ lb, an }))); P.vagues = [e.slice(0, 3), e.slice(3, 5), e.slice(5, 7)]; P.posees = []; },
  manche(i) { return { neufs: P.vagues[i].map(x => ({ ...x })), ordre: i === 0 ? [] : P.posees.map(x => ({ ...x, ancre: true })), choisi: null, devoiles: [], touche: false }; },
  peutEclairer() { return P.m.neufs.some(x => !P.m.devoiles.includes(x.lb)) || P.m.ordre.some(x => !x.ancre && !P.m.devoiles.includes(x.lb)); },
  eclairer() { const x = P.m.neufs.find(n => !P.m.devoiles.includes(n.lb)) || P.m.ordre.find(n => !n.ancre && !P.m.devoiles.includes(n.lb)); if (x) P.m.devoiles.push(x.lb); },
  choisir(lb) { if (P.phase !== 'jouer') return; P.m.choisi = P.m.choisi === lb ? null : lb; rendre(); },
  placer(i) {
    const m = P.m; if (!m.choisi) return;
    const k = m.neufs.findIndex(x => x.lb === m.choisi);
    let item;
    if (k >= 0) item = m.neufs.splice(k, 1)[0];
    else { const j = m.ordre.findIndex(x => x.lb === m.choisi && !x.ancre); if (j < 0) return; item = m.ordre.splice(j, 1)[0]; if (j < i) i--; }
    m.ordre.splice(i, 0, item); m.choisi = null; m.touche = true; rendre();
  },
  // Un nouveau venu est faux si un voisin le contredit : un plus récent avant lui, ou un plus ancien après.
  erreurs(ordre) {
    const faux = new Set();
    ordre.forEach((x, i) => { if (x.ancre) return; if (!(ordre.slice(0, i).every(y => y.an <= x.an) && ordre.slice(i + 1).every(y => y.an >= x.an))) faux.add(x.lb); });
    return faux;
  },
  valider() {
    const m = P.m, faux = this.erreurs(m.ordre), nn = faux.size + m.neufs.length;
    m.faux = faux; m.manquants = m.neufs.length;
    P.posees = [...m.ordre, ...m.neufs].map(x => ({ lb: x.lb, an: x.an })).sort((a, b) => a.an - b.an);
    for (const x of P.vagues[P.manche]) P.dates.push({ lb: x.lb, an: x.an });
    const s = P.manche === 2 ? { sujet: 'La frise : ' + P.theme, rep: P.posees.map(x => x.an + ' : ' + x.lb).join(' · '), txt: P.friseSavais } : null;
    jugerLaManche(nn === 0 ? 3 : nn === 1 ? 2 : nn === 2 ? 1 : 0, s);
  },
  tempsEcoule() { this.valider(); },
  rendre() {
    const m = P.m;
    if (P.phase === 'revele') {
      const l = P.posees.map(x => `<div class="evt ${m.faux.has(x.lb) || (m.manquants && P.vagues[P.manche].some(v => v.lb === x.lb) && !m.ordre.some(o => o.lb === x.lb)) ? 'faux' : P.vagues[P.manche].some(v => v.lb === x.lb) ? 'juste' : ''}"><span class="an">${x.an}</span><span class="pt"></span><span class="lb">${typo(x.lb)}</span></div>`).join('');
      const err = m.faux.size + m.manquants;
      return `${revelation(Math.min(3, P.naturel[P.manche]), err === 0 ? 'Sans faute' : pluriel(err, 'erreur', 'erreurs'), err ? 'En orange, ceux qui n’étaient pas à leur place : les voici à leur vraie année.' : '')}<p class="mini muet">↑ Plus ancien</p><div class="frise">${l}</div><p class="mini muet">↓ Plus récent</p>${P.manche === 2 ? leSavais({ txt: P.friseSavais }) : ''}`;
    }
    const an = x => x.ancre || m.devoiles.includes(x.lb) ? x.an : '';
    const fente = i => `<button class="fente ${m.choisi ? 'vivante' : ''}" data-a="m" data-v="placer:${i}" aria-label="Placer ici">${m.choisi ? 'Placer ici' : ''}</button>`;
    let l = fente(0);
    m.ordre.forEach((x, i) => {
      l += `<div class="evt ${x.ancre ? '' : 'neuf'}" ${x.ancre ? '' : `data-a="m" data-v="choisir:${esc(x.lb)}" style="cursor:pointer"`}><span class="an">${an(x)}</span><span class="pt" style="${x.ancre ? '' : 'background:var(--creme)'}"></span><span class="lb" style="${m.choisi === x.lb ? 'box-shadow:inset 0 0 0 3px var(--juste)' : ''}">${typo(x.lb)}</span></div>`;
      l += fente(i + 1);
    });
    const tray = m.neufs.map(x => `<button class="a-placer ${m.choisi === x.lb ? 'pris' : ''}" data-a="m" data-v="choisir:${esc(x.lb)}">${typo(x.lb)}${m.devoiles.includes(x.lb) ? ` <span style="float:right;color:#3d6f9e">${x.an}</span>` : ''}</button>`).join('');
    return `<div class="pile" style="gap:2px"><span class="etiquette">Manche ${P.manche + 1} · ${esc(P.theme)}</span><p class="petit muet">${m.neufs.length ? (m.choisi ? 'Touche maintenant l’endroit où il va.' : 'Touche un événement, puis l’endroit où il va.') : 'Tout est placé. Touche un événement posé pour le déplacer, ou valide.'}</p></div>
      <p class="mini muet">↑ Plus ancien</p><div class="frise">${l}</div><p class="mini muet">↓ Plus récent</p>
      <div class="pied-collant pile" style="gap:8px">${tray ? `<span class="mini muet">À placer</span>${tray}` : ''}
      <button class="bouton" data-a="m" data-v="valider" ${m.neufs.length ? 'disabled' : ''}>Valider la frise</button></div>`;
  }
};

const AZERTY = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
MODULES.mot = {
  manche() { const q = pioche('mot', B.mots); return { q, essais: [], saisie: '', souffle: [], touche: false }; },
  peutEclairer() { return P.m.souffle.length < P.m.q.m.length - 1; },
  eclairer() { const m = P.m; const libres = [...m.q.m].map((_, i) => i).filter(i => !m.souffle.includes(i)); m.souffle.push(auHasard(libres)); },
  couleurs(essai, mot) {
    const r = Array(mot.length).fill('absente'), reste = {};
    [...mot].forEach((c, i) => { if (essai[i] === c) r[i] = 'bien'; else reste[c] = (reste[c] || 0) + 1; });
    [...essai].forEach((c, i) => { if (r[i] !== 'bien' && reste[c]) { r[i] = 'ailleurs'; reste[c]--; } });
    return r;
  },
  touche(t) {
    const m = P.m; if (P.phase !== 'jouer') return;
    if (t === 'EFFACER') m.saisie = m.saisie.slice(0, -1);
    else if (t === 'VALIDER') { if (m.saisie.length === m.q.m.length) { m.essais.push(m.saisie); m.saisie = ''; m.touche = true; if (m.essais[m.essais.length - 1] === m.q.m || m.essais.length >= 5) return this.fin(); } else toast(`Il faut ${m.q.m.length} lettres.`); }
    else if (m.saisie.length < m.q.m.length) m.saisie += t;
    rendre();
  },
  fin() { const m = P.m, ok = m.essais.includes(m.q.m), n = m.essais.length; jugerLaManche(!ok ? 0 : n <= 2 ? 3 : n <= 4 ? 2 : 1, { sujet: m.q.t, rep: m.q.aff, txt: m.q.a }); },
  tempsEcoule() { this.fin(); },
  rendre() {
    const m = P.m, L = m.q.m.length;
    const lignes = [];
    for (let i = 0; i < 5; i++) {
      const e = m.essais[i];
      if (e) { const c = this.couleurs(e, m.q.m); lignes.push(`<div class="mot-ligne">${[...e].map((x, j) => `<span class="case ${c[j]}">${x}</span>`).join('')}</div>`); }
      else if (i === m.essais.length && P.phase === 'jouer') lignes.push(`<div class="mot-ligne">${Array.from({ length: L }, (_, j) => `<span class="case courante ${!m.saisie[j] && m.souffle.includes(j) ? 'soufflee' : ''}">${m.saisie[j] || (m.souffle.includes(j) ? m.q.m[j] : '')}</span>`).join('')}</div>`);
      else lignes.push(`<div class="mot-ligne">${Array.from({ length: L }, () => '<span class="case"></span>').join('')}</div>`);
    }
    const etat = {};
    m.essais.forEach(e => this.couleurs(e, m.q.m).forEach((c, j) => { const x = e[j]; if (etat[x] !== 'bien') etat[x] = c === 'bien' ? 'bien' : etat[x] === 'ailleurs' ? 'ailleurs' : c; }));
    if (P.phase === 'revele') {
      const ok = m.essais.includes(m.q.m);
      return `${revelation(Math.min(3, P.naturel[P.manche]), ok ? 'Trouvé en ' + pluriel(m.essais.length, 'essai', 'essais') : 'C’était « ' + esc(m.q.aff.charAt(0).toLowerCase() === m.q.aff.charAt(0) || !/^(Le|La|Les|L’|L')\b/.test(m.q.aff) ? m.q.aff : m.q.aff.charAt(0).toLowerCase() + m.q.aff.slice(1)) + ' »', typo(m.q.t))}<div class="mot-grille">${lignes.join('')}</div>${leSavais({ txt: m.q.a })}`;
    }
    const clav = AZERTY.map((r, i) => `<div class="rang">${i === 2 ? '<button class="touche large" data-a="m" data-v="t:EFFACER">Effacer</button>' : ''}${[...r].map(x => `<button class="touche ${etat[x] || ''}" data-a="m" data-v="t:${x}">${x}</button>`).join('')}${i === 2 ? '<button class="touche large valider" data-a="m" data-v="t:VALIDER">Valider</button>' : ''}</div>`).join('');
    return `<div class="bloc"><span class="etiquette">${esc(m.q.c)} · un mot de ${L} lettres</span><p class="question compacte">${typo(m.q.t)}</p></div>
      <div class="ligne mini muet" style="justify-content:center;gap:12px;flex-wrap:wrap"><span class="ligne" style="gap:5px"><span class="pastille bien"></span>bien placée</span><span class="ligne" style="gap:5px"><span class="pastille ailleurs"></span>ailleurs dans le mot</span><span class="ligne" style="gap:5px"><span class="pastille absente"></span>absente</span></div>
      <div class="mot-grille">${lignes.join('')}</div>
      <div class="pied-collant clavier">${clav}</div>`;
  }
};

MODULES.detail = {
  preparer() { P.theme = 'Les chefs-d’œuvre'; },
  manche() {
    const t = pioche('tab', window.TABLEAUX, x => x.q);
    // Les leurres sont les tableaux les plus proches dans le temps : deviner à l'époque ne suffit pas.
    const autres = window.TABLEAUX.filter(x => x.q !== t.q).sort((a, b) => Math.abs(a.a - t.a) - Math.abs(b.a - t.a)).slice(0, 5);
    return { t, choix: melanger([t, ...melanger(autres).slice(0, 3)]), cadrage: 1, efface: [], rep: null, touche: false };
  },
  peutEclairer() { return P.m.efface.length < 2; },
  eclairer() { const m = P.m; const x = m.choix.find(c => c.q !== m.t.q && !m.efface.includes(c.q)); if (x) m.efface.push(x.q); },
  reculer() { if (P.m.cadrage < 4) { P.m.cadrage++; P.m.touche = true; rendre(); } },
  savais(t) { return { sujet: 'Quel est ce tableau ?', rep: `${t.t} — ${t.p}, ${t.a}`, txt: t.an || `${t.t}, peint par ${t.p} en ${t.a}.` }; },
  repondre(q) { const m = P.m; m.rep = q; jugerLaManche(q === m.t.q ? Math.max(0, 4 - m.cadrage) : 0, this.savais(m.t)); },
  tempsEcoule() { P.m.rep = null; jugerLaManche(0, this.savais(P.m.t)); },
  rendre() {
    const m = P.m;
    if (P.phase === 'revele') {
      const ok = m.rep === m.t.q;
      return `${revelation(Math.min(3, P.naturel[P.manche]), ok ? 'Reconnu' : 'C’était…', ok ? '' : m.rep ? 'Tu avais répondu « ' + esc(window.TABLEAUX.find(x => x.q === m.rep).t) + ' ».' : '')}<div class="tableau"><img src="tableaux/${m.t.q}-4.webp" alt="${esc(m.t.t)}" style="aspect-ratio:auto;object-fit:contain"></div>
        <div class="cartel"><span class="etiquette">${esc(m.t.p)} · ${m.t.a}</span><p class="phrase">${esc(m.t.t)}</p>${m.t.an ? `<p class="petit">${typo(m.t.an)}</p>` : ''}</div>`;
    }
    return `<div class="tableau"><img src="tableaux/${m.t.q}-${m.cadrage}.webp" alt="Un détail du tableau"></div>
      <div class="entre"><span class="petit muet">Ta réponse vaut ${etoiles(Math.max(0, 4 - m.cadrage))}</span><button class="puce" data-a="m" data-v="reculer" ${m.cadrage >= 4 ? 'disabled' : ''}>Reculer d’un pas</button></div>
      <div class="pile" style="gap:8px">${m.choix.map(c => `<button class="choix ${m.efface.includes(c.q) ? 'efface' : ''}" data-a="m" data-v="rep:${c.q}"><span>${esc(c.t)}<br><span class="mini muet" style="font-weight:400">${esc(c.p)}</span></span></button>`).join('')}</div>`;
  }
};

MODULES.filet = {
  // La réponse tombe n'importe où sur la piste, et le curseur part du milieu : rester au centre ne paie plus.
  manche() {
    const q = pioche('filet', B.filet), pos = 0.08 + Math.random() * 0.84;
    let min, max;
    if (q.annee) { const span = 50 + Math.floor(Math.random() * 70); min = Math.round(q.v - pos * span); max = min + span; }
    else { const brut = q.v / pos, ordre = Math.pow(10, Math.max(0, Math.floor(Math.log10(brut)) - 1)); min = 0; max = Math.max(q.v + 1, Math.ceil(brut / ordre) * ordre); }
    return { q, min, max, x: Math.round((min + max) / 2), largeur: 'moyen', chaud: null, touche: false };
  },
  LARGEURS: { petit: [0.035, 3, 'Petit'], moyen: [0.09, 2, 'Moyen'], grand: [0.2, 1, 'Grand'] },
  pas() { const m = P.m; return m.q.annee ? 1 : Math.max(1, Math.round((m.max - m.min) / 200)); },
  peutEclairer() { return !P.m.chaud; },
  eclairer() { const m = P.m, w = (m.max - m.min) * 0.3, d = Math.random() * w * 0.8; m.chaud = [Math.max(m.min, m.q.v - d), Math.min(m.max, m.q.v - d + w)]; },
  bouger(v) { const m = P.m; m.x = Math.max(m.min, Math.min(m.max, Number(v))); m.touche = true; const t = document.querySelector('.filet-valeur'); if (t) t.textContent = this.dire(m.x); const c = document.getElementById('curseur'); if (c && +c.value !== m.x) c.value = m.x; this.majMaille(); },
  majMaille() { const m = P.m, w = (m.max - m.min) * this.LARGEURS[m.largeur][0], el = document.querySelector('.maille'); if (el) { el.style.left = this.pct(m.x - w) + '%'; el.style.width = (this.pct(m.x + w) - this.pct(m.x - w)) + '%'; } const b = document.querySelector('.filet-bornes'); if (b) b.textContent = `ton filet : de ${this.dire(Math.round(m.x - w))} à ${this.dire(Math.round(m.x + w))}`; },
  pct(v) { const m = P.m; return Math.max(0, Math.min(100, 100 * (v - m.min) / (m.max - m.min))); },
  dire(v) { return P.m.q.annee ? String(v) : nombre(v) + (P.m.q.u ? ' ' + P.m.q.u : ''); },
  lancer() { const m = P.m, [f, e] = this.LARGEURS[m.largeur], w = (m.max - m.min) * f; m.dedans = Math.abs(m.q.v - m.x) <= w; jugerLaManche(m.dedans ? e : 0, { sujet: m.q.t, rep: this.dire(m.q.v), txt: m.q.a }); },
  tempsEcoule() { this.lancer(); },
  rendre() {
    const m = P.m, w = (m.max - m.min) * this.LARGEURS[m.largeur][0];
    const piste = `<div class="filet-piste"><div class="rail"></div>${m.chaud ? `<div class="chaud" style="left:${this.pct(m.chaud[0])}%;width:${this.pct(m.chaud[1]) - this.pct(m.chaud[0])}%"></div>` : ''}<div class="maille" style="left:${this.pct(m.x - w)}%;width:${this.pct(m.x + w) - this.pct(m.x - w)}%"></div>${P.phase === 'revele' ? `<div class="vrai" style="left:${this.pct(m.q.v)}%"></div>` : ''}<div class="bornes"><span>${this.dire(m.min)}</span><span>${this.dire(m.max)}</span></div></div>`;
    if (P.phase === 'revele') {
      return `${revelation(Math.min(3, P.naturel[P.manche]), m.dedans ? 'Dans le filet' : 'À côté', 'La réponse : ' + this.dire(m.q.v) + ' · tu visais ' + this.dire(m.x) + '.')}<div class="bloc"><p class="petit">${typo(m.q.t)}</p>${piste}</div>${leSavais({ txt: m.q.a })}`;
    }
    return `<div class="bloc"><span class="etiquette">${esc(m.q.c)}</span><p class="question">${typo(m.q.t)}</p></div>
      <div class="pile" style="align-items:center;gap:2px"><span class="verdict filet-valeur" style="font-size:44px">${this.dire(m.x)}</span><span class="petit muet filet-bornes">ton filet : de ${this.dire(Math.round(m.x - w))} à ${this.dire(Math.round(m.x + w))}</span></div>
      ${piste}
      ${m.chaud ? '<div class="bandeau">Indice : la réponse est dans la zone dorée.</div>' : ''}
      <div class="ligne"><button class="touche-fine" data-a="m" data-v="moins" aria-label="Un cran de moins">−</button><input id="curseur" type="range" min="${m.min}" max="${m.max}" step="${this.pas()}" value="${m.x}" data-i="curseur" aria-label="Ton estimation"><button class="touche-fine" data-a="m" data-v="plus" aria-label="Un cran de plus">+</button></div>
      <p class="mini muet">Taille de ton filet</p>
      <div class="grille3">${Object.entries(this.LARGEURS).map(([k, [, e, n]]) => `<button class="choix ${m.largeur === k ? 'pris' : ''}" data-a="m" data-v="largeur:${k}" style="flex-direction:column;justify-content:center;gap:2px"><span>${n}</span><span class="etoiles mini">${'★'.repeat(e)}</span></button>`).join('')}</div>
      <button class="bouton" data-a="m" data-v="lancer">Lancer le filet</button>`;
  }
};

MODULES.pari = {
  manche() { const q = pioche('qcm', B.qcm); return { q, etape: 1, rep: null, efface: [], touche: false }; },
  peutEclairer() { return P.m.efface.length < 2 && P.m.rep == null; },
  eclairer() { const m = P.m; const i = [0, 1, 2, 3].find(i => i !== m.q.b && !m.efface.includes(i)); m.efface.push(i); },
  repondre(i) {
    const m = P.m; if (m.rep != null) return; m.rep = i; m.touche = true;
    if (i !== m.q.b) { m.perdu = true; return jugerLaManche(0, qcmSavais(m.q)); }
    if (m.etape === 2) return jugerLaManche(3, qcmSavais(m.q));
    arreterMinuteur(); rendre();
  },
  garder() { jugerLaManche(1, qcmSavais(P.m.q)); },
  parier() { const m = P.m; m.q1 = m.q; m.q = pioche('qcm', B.dur); m.etape = 2; m.rep = null; m.efface = []; lancerMinuteur(); rendre(); },
  tempsEcoule() { P.m.perdu = true; jugerLaManche(0, qcmSavais(P.m.q)); },
  rendre() {
    const m = P.m, q = m.q;
    const choix = q.r.map((r, i) => `<button class="choix ${m.efface.includes(i) ? 'efface' : ''} ${m.rep != null ? (i === q.b ? 'juste' : i === m.rep ? 'faux' : '') : ''}" data-a="m" data-v="rep:${i}">${esc(r)}</button>`).join('');
    if (P.phase === 'revele') {
      return `${revelation(Math.min(3, P.naturel[P.manche]), m.perdu ? (m.etape === 2 ? 'Pari perdu' : 'Raté') : m.etape === 2 ? 'Pari gagné !' : 'Étoile gardée', '')}<div class="bloc pile"><p class="petit">${typo(q.t)}</p>${choix}</div>${leSavais({ txt: q.a })}`;
    }
    const juste = m.rep != null && m.rep === q.b;
    return `<div class="bloc pile"><span class="etiquette">${m.etape === 2 ? 'Le pari · question difficile' : esc(q.c)}</span><p class="question">${typo(q.t)}</p>${choix}</div>
      ${juste ? `<div class="pile"><p class="petit" style="text-align:center">Juste ! Tu gardes ★, ou tu paries pour ★★★ sur une question plus difficile. Raté, la manche ne rapporte rien.</p><div class="grille2"><button class="bouton second" data-a="m" data-v="garder">Garder ★</button><button class="bouton" data-a="m" data-v="parier">Parier → ★★★</button></div></div>` : ''}`;
  }
};

MODULES.eclair = {
  manche() {
    const l = []; for (let i = 0; i < 5; i++) { const q = pioche('qcm', B.qcm); const vrai = Math.random() < 0.5; const r = vrai ? q.b : auHasard([0, 1, 2, 3].filter(x => x !== q.b)); l.push({ q, prop: q.r[r], vrai }); }
    return { l, i: 0, reps: [], souffle: -1, touche: false };
  },
  peutEclairer() { return P.m.souffle !== P.m.i; },
  eclairer() { P.m.souffle = P.m.i; },
  repondre(v) { const m = P.m; if (m.i >= 5) return; m.reps.push(v); m.touche = true; m.i++; if (m.i >= 5) return this.fin(); rendre(); },
  fin() { const m = P.m, n = m.l.filter((x, i) => m.reps[i] === x.vrai).length; m.n = n; jugerLaManche(n === 5 ? 3 : n === 4 ? 2 : n === 3 ? 1 : 0, qcmSavais(m.l[0].q)); },
  tempsEcoule() { this.fin(); },
  rendre() {
    const m = P.m;
    if (P.phase === 'revele') {
      return `${revelation(Math.min(3, P.naturel[P.manche]), m.n + ' sur 5', '')}<div class="pile" style="gap:8px">${m.l.map((x, i) => { const ok = m.reps[i] === x.vrai; return `<div class="bloc" style="padding:10px 12px;box-shadow:inset 0 0 0 2px ${m.reps[i] === undefined ? 'rgba(255,255,255,.15)' : ok ? 'var(--juste)' : 'var(--faux)'}"><p class="mini muet">${typo(x.q.t)}</p><p class="petit"><b>${esc(x.prop)}</b> : ${x.vrai ? 'vrai' : 'faux, c’était ' + esc(x.q.r[x.q.b])}${m.reps[i] === undefined ? ' (pas répondu)' : ''}</p></div>`; }).join('')}</div>${leSavais({ txt: m.l[0].q.a })}`;
    }
    const x = m.l[m.i], j = m.reps.filter((r, i) => r === m.l[i].vrai).length;
    return `<div class="entre"><span class="etiquette">Affirmation ${m.i + 1} sur 5</span><span class="petit muet">${pluriel(j, 'juste', 'justes')}</span></div>
      <div class="affirmation"><span class="q">${typo(x.q.t)}</span><span class="r">${esc(x.prop)}</span>${m.souffle === m.i ? `<span class="petit" style="color:#3d6f9e;font-weight:700">Indice : c’est ${x.vrai ? 'vrai' : 'faux'}.</span>` : '<span></span>'}</div>
      <div class="grille2"><button class="bouton second" style="min-height:64px;border-color:var(--faux)" data-a="m" data-v="v:0">Faux</button><button class="bouton second" style="min-height:64px;border-color:var(--juste)" data-a="m" data-v="v:1">Vrai</button></div>`;
  }
};

// Une réponse se lit mot à mot : chaque mot tapé doit appartenir au nom attendu (une faute de frappe tolérée).
const MOTS_VIDES = new Set(['de', 'd', 'la', 'le', 'du', 'l']);
function proche(a, b) { if (a === b) return true; if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] <= 1; }
function bonneIdentite(saisie, p) {
  const mots = sansAccent(saisie).split(/[^a-z]+/).filter(w => w && !MOTS_VIDES.has(w));
  const permis = new Set([...sansAccent(p.rep).split(/[^a-z]+/), ...p.cles].filter(Boolean));
  if (!mots.length || mots.length > 4) return false;
  return mots.every(w => [...permis].some(x => proche(w, x))) && mots.some(w => p.cles.some(k => proche(w, k)));
}

MODULES.indices = {
  preparer() { P.theme = 'Qui suis-je ?'; },
  manche() { return { p: pioche('qui', window.QUI, x => x.rep), vus: 1, gratuits: 0, faux: [], saisie: '', ok: false, touche: false }; },
  peutEclairer() { return P.m.vus < 5; },
  eclairer() { P.m.vus++; P.m.gratuits++; },
  plus() { const m = P.m; if (m.vus < 5) { m.vus++; m.touche = true; rendre(); } },
  savais() { return { sujet: 'Qui suis-je ?', rep: P.m.p.rep, txt: P.m.p.savais }; },
  repondre() {
    const m = P.m; if (!m.saisie.trim()) return;
    m.touche = true;
    if (bonneIdentite(m.saisie, m.p)) { m.ok = true; const n = m.vus - m.gratuits + m.faux.length; return jugerLaManche(n <= 2 ? 3 : n === 3 ? 2 : 1, this.savais()); }
    m.faux.push(m.saisie); m.saisie = '';
    if (m.vus < 5) { m.vus++; m.msg = 'Non : une étoile de moins, et un indice de plus.'; rendre(); } else jugerLaManche(0, this.savais());
  },
  tempsEcoule() { jugerLaManche(0, this.savais()); },
  rendre() {
    const m = P.m, n = m.vus - m.gratuits + m.faux.length;
    const l = m.p.ind.map((x, i) => i < m.vus || P.phase === 'revele' ? `<div class="indice"><b>${i + 1}</b><span>${typo(x)}</span></div>` : `<div class="indice cache"><b>${i + 1}</b><span class="petit">${i === m.vus ? 'Indice suivant' : ''}</span></div>`).join('');
    if (P.phase === 'revele') return `${revelation(Math.min(3, P.naturel[P.manche]), m.ok ? 'Trouvé' : 'C’était ' + esc(m.p.rep), m.ok ? `${esc(m.p.rep)}, en ${pluriel(n, 'indice', 'indices')}.` : '')}<div class="pile" style="gap:6px">${l}</div>${leSavais({ txt: m.p.savais })}`;
    const msg = m.msg; m.msg = '';
    return `<div class="entre"><span class="etiquette">Qui suis-je ?</span><span class="petit or">ta réponse vaut ${etoiles(n <= 2 ? 3 : n === 3 ? 2 : 1)}</span></div>
      <div class="pile" style="gap:6px">${m.p.ind.slice(0, m.vus).map((x, i) => `<div class="indice"><b>${i + 1}</b><span>${typo(x)}</span></div>`).join('')}</div>
      ${msg ? `<div class="bandeau">${msg}</div>` : ''}
      ${m.faux.length ? `<p class="mini muet">Déjà essayé : ${m.faux.map(esc).join(', ')}</p>` : ''}
      <form class="pile" style="gap:8px" data-f="indices"><label class="petit" for="reponse-qui" style="font-weight:600">Ta réponse : un nom</label><input class="champ" id="reponse-qui" autocomplete="off" value="${esc(m.saisie)}" data-i="qui">
      <div class="grille2"><button type="button" class="bouton second" data-a="m" data-v="plus" ${m.vus >= 5 ? 'disabled' : ''}>Un indice de plus</button><button type="submit" class="bouton">Répondre</button></div></form>
      ${m.vus < 5 ? `<p class="mini muet">Encore ${pluriel(5 - m.vus, 'indice caché', 'indices cachés')}.</p>` : ''}`;
  }
};

MODULES.replique = {
  preparer() { P.theme = 'Répliques cultes'; },
  manche() { const r = pioche('rep', window.REPLIQUES, x => x.avant); return { r, mots: melanger([r.mot, ...r.leurres]), qui: melanger([r.qui, ...r.autres]), etape: 1, mot: null, quiRep: null, efface: [], touche: false }; },
  peutEclairer() { return P.m.efface.length < 2; },
  eclairer() { const m = P.m; const l = m.etape === 1 ? m.mots.filter(x => x !== m.r.mot) : m.qui.filter(x => x !== m.r.qui); const x = l.find(y => !m.efface.includes(y)); if (x) m.efface.push(x); },
  // Chaque question a son propre chrono : on ne perd pas « Qui l'a dit ? » à cause du premier.
  mot(w) { const m = P.m; if (m.etape !== 1) return; m.mot = w; m.etape = 2; m.efface = []; m.touche = true; lancerMinuteur(); rendre(); },
  qui(w) { const m = P.m; if (m.etape !== 2) return; m.quiRep = w; this.fin(); },
  fin() { const m = P.m, r = m.r; jugerLaManche((m.mot === r.mot ? 2 : 0) + (m.quiRep === r.qui ? 1 : 0), { sujet: `« ${r.avant} … ${r.apres.trim()} »`, rep: `${r.mot} — ${r.qui}`, txt: `« ${r.avant} ${r.mot}${r.apres} » : ${r.qui}, ${r.film}.` }); },
  tempsEcoule() { if (P.m.etape === 1) { P.m.mot = null; P.m.etape = 2; P.tempsEcoule = false; toast('Temps écoulé pour le mot. Qui l’a dit ?'); lancerMinuteur(); rendre(); } else this.fin(); },
  rendre() {
    const m = P.m, r = m.r;
    const phrase = `<div class="replique"><p>« ${typo(r.avant)} <span class="trou">${m.mot ? esc(m.mot) : '&nbsp;'}</span>${typo(r.apres)} »</p></div>`;
    if (P.phase === 'revele') return `${revelation(Math.min(3, P.naturel[P.manche]), m.mot === r.mot ? 'Le bon mot' : 'C’était « ' + esc(r.mot) + ' »', `${esc(r.qui)} · ${esc(r.film)}`)}<div class="replique"><p>« ${typo(r.avant)} <span class="trou">${esc(r.mot)}</span>${typo(r.apres)} »</p></div>${m.quiRep && m.quiRep !== r.qui ? `<p class="petit muet">Tu avais répondu ${esc(m.quiRep)}.</p>` : ''}`;
    if (m.etape === 1) return `<span class="etiquette">1 · Le mot qui manque</span>${phrase}<div class="grille2">${m.mots.map(w => `<button class="choix ${m.efface.includes(w) ? 'efface' : ''}" style="justify-content:center;font-size:17px" data-a="m" data-v="mot:${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
    return `<span class="etiquette">2 · Qui l’a dit ?</span>${phrase}<div class="pile" style="gap:8px">${m.qui.map(w => `<button class="choix ${m.efface.includes(w) ? 'efface' : ''}" data-a="m" data-v="qui:${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
  }
};

// ———————————————————————————————— L'aiguillage ————————————————————————————————

function rendre() {
  const app = document.getElementById('app');
  const [e, arg] = vue.ecran.split(':');
  const ecrans = { hall: ecranHall, visite: ecranVisite, salle: () => ecranSalle(arg), manquante: () => ecranManquante(arg), cartel: () => ecranCartel(arg), galerie: ecranGalerie, eveil: ecranEveil, murs: ecranMurs, libre: ecranLibre, regles: ecranRegles, annonce: ecranAnnonce, jeu: ecranJeu, bilan: ecranBilan, acquisition: ecranAcquisition };
  app.innerHTML = (ecrans[e] || ecranHall)();
  if (e === 'jeu' && P && P.jeu === 'filet' && P.phase === 'jouer') MODULES.filet.majMaille();
  if (e === 'jeu' && P && P.phase === 'jouer') majChrono();
  // Au Mot mystère, la ligne en cours reste visible au-dessus du clavier collé.
  if (e === 'jeu' && P && P.jeu === 'mot' && P.m && P.m.essais.length >= 2) { const c = document.querySelector('.case.courante'); if (c) c.scrollIntoView({ block: 'center' }); }
}
function aller(ecran) { vue = { ecran }; rendre(); window.scrollTo(0, 0); }
function reveilAuBesoin(g, message) { sauver(); if (g.length) { S.eveils.push(...g); sauver(); return aller('eveil'); } toast(message); rendre(); }

document.addEventListener('click', ev => {
  const svg = ev.target.closest('svg[data-a="carte"]');
  if (svg && P && P.jeu === 'epingle') { const r = svg.getBoundingClientRect(); MODULES.epingle.clic((ev.clientX - r.left) * LARGEUR / r.width, (ev.clientY - r.top) * HAUTEUR / r.height); return; }
  const b = ev.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, v = b.dataset.v;
  if (!a) return;
  switch (a) {
    case 'aller': return aller(v);
    case 'salle': return aller('salle:' + v);
    case 'visite': case 'galerie': case 'murs': case 'libre': case 'regles': return aller(a);
    case 'guide-lu': S.guide = true; sauver(); return rendre();
    case 'cartel': return v && aller('cartel:' + v);
    case 'manquante': return aller('manquante:' + v);
    case 'partie-visite': { const p = visiteDuJour().parties[+v]; return nouvellePartie(p.jeu, p.cible, 'visite', +v); }
    case 'partie-libre': return nouvellePartie(v, null, 'libre');
    case 'chasser': { if (!chassesRestantes()) return; return nouvellePartie(jeuDeLaCarte(CARTE[v]), v, 'chasse'); }
    case 'acheter': { const c = CARTE[v]; if (S.poussiere < PRIX_ACHAT[c.r]) return; S.poussiere -= PRIX_ACHAT[c.r]; S.oeuvres[v] = { n: 1, dore: false, cartel: null, origine: 'achat' }; vue = { ecran: 'cartel:' + v }; return reveilAuBesoin(verifierLesGardiens(), `${c.n} rejoint ${FAM[c.f].salle}.`); }
    case 'dorer': { const c = CARTE[v]; if (S.poussiere < PRIX_DORURE[c.r]) return; S.poussiere -= PRIX_DORURE[c.r]; S.oeuvres[v].dore = true; return reveilAuBesoin(verifierLesGardiens(), 'Cadre doré.'); }
    case 'emporter': S.emportee = v; sauver(); toast(`${CARTE[v].lg ? NOM_DU_LEGENDAIRE[CARTE[v].lg] : CARTE[v].n} est ta carte-bonus.`); return rendre();
    case 'choisir-emportee': P.emportee = v || null; S.emportee = v || null; sauver(); return rendre();
    case 'commencer': return commencer();
    case 'pouvoir': return jouerLePouvoir();
    case 'miser': P.mise = true; P.miseFaite = true; return demarrerLaManche();
    case 'ne-pas-miser': if (P.manche === 2) P.miseFaite = true; return demarrerLaManche();
    case 'suivante': return mancheSuivante();
    case 'quitter': return quitter(false);
    case 'quitter-oui': return quitter(true);
    case 'rester': P.quitter = false; if (P.resteAvantQuitter) { const d = P.duree; lancerMinuteur(P.resteAvantQuitter); P.duree = d; P.fin = Date.now() + P.resteAvantQuitter * 1000; P.resteAvantQuitter = 0; } return rendre();
    case 'acquisition': vue = { ecran: 'acquisition' }; return rendre();
    case 'eveil': S.eveils.push(...P.resultat.eveils); P.resultat.eveils = []; sauver(); P = null; return aller('eveil');
    case 'apres': { const o = P.origine, c = P.cible ? CARTE[P.cible] : null; P = null; return aller(o === 'visite' ? 'visite' : o === 'chasse' && c ? 'salle:' + c.f : o === 'libre' ? 'libre' : 'hall'); }
    case 'retenter': { const c = P.cible; return nouvellePartie(P.jeu, c, 'chasse'); }
    case 'echanger': { const v2 = visiteDuJour(); const pris = v2.parties.map(x => x.jeu); v2.parties[+v].jeu = auHasard(JEUX.map(j => j.id).filter(j => !pris.includes(j))); v2.echange = false; sauver(); return rendre(); }
    case 'dorer-en-jouant': { if (!chassesRestantes()) return; return nouvellePartie(jeuDeLaCarte(CARTE[v]), v, 'chasse'); }
    case 'rejouer': return nouvellePartie(P.jeu, null, 'libre');
    case 'm': return action(v);
    case 'jour': S.jour++; sauver(); toast('Jour ' + S.jour + ' : une nouvelle visite t’attend.'); return aller('hall');
    case 'avance': S = avance(); sauver(); toast('Joueur avancé chargé.'); return aller('hall');
    case 'poussiere': S.poussiere += 500; sauver(); return rendre();
    case 'raz': S = neuf(); sauver(); P = null; return aller('hall');
  }
});
function action(v) {
  if (!P || !P.m || P.phase !== 'jouer') return;
  const [k, ...r] = v.split(':'); const x = r.join(':');
  const M = MODULES[P.jeu];
  switch (P.jeu) {
    case 'epingle': if (k === 'valider') M.valider(); break;
    case 'frise': if (k === 'choisir') M.choisir(x); else if (k === 'placer') M.placer(+x); else if (k === 'valider') M.valider(); break;
    case 'mot': if (k === 't') M.touche(x); break;
    case 'detail': if (k === 'reculer') M.reculer(); else if (k === 'rep') M.repondre(x); break;
    case 'filet': if (k === 'largeur') { P.m.largeur = x; P.m.touche = true; rendre(); } else if (k === 'lancer') M.lancer(); else if (k === 'moins') M.bouger(P.m.x - M.pas()); else if (k === 'plus') M.bouger(P.m.x + M.pas()); break;
    case 'pari': if (k === 'rep') M.repondre(+x); else if (k === 'garder') M.garder(); else if (k === 'parier') M.parier(); break;
    case 'eclair': if (k === 'v') M.repondre(x === '1'); break;
    case 'indices': if (k === 'plus') M.plus(); break;
    case 'replique': if (k === 'mot') M.mot(x); else if (k === 'qui') M.qui(x); break;
  }
}
document.addEventListener('input', ev => {
  const i = ev.target.dataset.i; if (!i || !P || !P.m) return;
  if (i === 'curseur') MODULES.filet.bouger(ev.target.value);
  if (i === 'qui') P.m.saisie = ev.target.value;
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.dataset.f === 'indices' && P && P.phase === 'jouer') { const el = document.getElementById('reponse-qui'); if (el) P.m.saisie = el.value; MODULES.indices.repondre(); }
});
// Le clavier physique sert aussi au Mot mystère, sur ordinateur.
document.addEventListener('keydown', ev => {
  if (!P || P.jeu !== 'mot' || P.phase !== 'jouer' || ev.target.tagName === 'INPUT') return;
  const k = sansAccent(ev.key).toUpperCase();
  if (/^[A-Z]$/.test(k)) MODULES.mot.touche(k); else if (ev.key === 'Backspace') MODULES.mot.touche('EFFACER'); else if (ev.key === 'Enter') MODULES.mot.touche('VALIDER');
});

// Un joueur qui a déjà joué trois semaines : pour voir les salles se remplir et les gardiens.
function avance() {
  const s = neuf(); s.guide = true; s.jour = 22; s.poussiere = 420; s.jours = Array.from({ length: 21 }, (_, i) => i + 1);
  const garder = (k, dore) => { s.oeuvres[k] = { n: 1, dore, origine: 'partie', cartel: { sujet: 'Une question d’il y a quelques jours', rep: 'Sa réponse', txt: 'Ici, l’anecdote apprise en la gagnant.', jeu: jeuDeLaCarte(CARTE[k]), theme: '', etoiles: dore ? 9 : 7, jour: 1 + Math.floor(Math.random() * 20) } }; };
  for (const c of oeuvresDe('neutre')) garder(c.k, Math.random() < 0.3);
  for (const c of oeuvresDe('rempart')) if (c.k !== 'muraille') garder(c.k, Math.random() < 0.4);
  for (const c of oeuvresDe('erudit').slice(0, 5)) garder(c.k, false);
  for (const c of oeuvresDe('devin').slice(0, 3)) garder(c.k, false);
  for (const f of ['elan', 'flambeur', 'metamorphe', 'sophiste']) for (const c of oeuvresDe(f).slice(0, 2)) garder(c.k, false);
  s.legendaires = ['coq'];
  s.murs.lieux = [{ nom: 'Alésia', lat: 47.537, lon: 4.5 }, { nom: 'Orléans', lat: 47.902, lon: 1.909 }, { nom: 'Arles', lat: 43.677, lon: 4.631 }];
  s.murs.dates = [{ lb: 'Prise de la Bastille', an: 1789 }, { lb: 'Premiers pas sur la Lune', an: 1969 }, { lb: 'Alésia — le siège de César', an: -52 }];
  s.emportee = 'sursis';
  return s;
}

// Une partie interrompue (page rechargée, appli fermée) compte avec ses étoiles, comme si on l'avait quittée.
if (S.enCours) { P = Object.assign({ usages: 0, manche: 2, miseFaite: true, m: null, phase: 'jouer' }, S.enCours); vue = { ecran: 'jeu' }; for (let i = 0; i < 3; i++) if (P.etoiles[i] == null) { P.etoiles[i] = 0; P.naturel[i] = 0; } finirLaPartie(); toast('Ta partie interrompue a été comptée.'); }
else rendre();
})();

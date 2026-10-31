// Tire de la vraie base de la campagne ce que joue la maquette : des QCM par
// thème et par difficulté (un acte plus loin, une question plus dure), des mots
// pour le Mot mystère et des valeurs pour le Filet, thème par thème — chaque
// étape de la carte annonce un jeu ET un thème, il faut de quoi tenir parole.
// Les tableaux du Détail sont ceux de la maquette du 24 octobre.
//
//   node retours/2026-10-31/maquette/extraire.cjs . retours/2026-10-31/maquette/donnees.js
const fs = require('fs');
const path = require('path');
const racine = process.argv[2] || '.';
const sortie = process.argv[3] || path.join(__dirname, 'donnees.js');

let toutes = [];
const dossier = path.join(racine, 'server/content/campagne');
for (const f of fs.readdirSync(dossier)) if (f.endsWith('.json')) toutes = toutes.concat(JSON.parse(fs.readFileSync(path.join(dossier, f))));
toutes = toutes.filter(q => !(q.aRelire || []).length && q.anecdote && q.anecdote.length < 200);

// Le même hasard à chaque extraction : la maquette ne change pas d'un tirage à l'autre.
let graine = 31102026;
const hasard = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
const tirer = (liste, n) => { const a = liste.slice(), o = []; while (o.length < n && a.length) o.push(a.splice(Math.floor(hasard() * a.length), 1)[0]); return o; };

const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const majuscules = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const sansArticle = w => w.replace(/^(Le |La |Les |L'|L’|Un |Une |Des )/, '');
// Une question qui écrit sa réponse dans son intitulé ne se pose pas.
const donne = q => norm(q.texte).includes(norm(sansArticle(q.reponses[q.bonne])));
// Les QCM qui parlent de leurs choix ne se jouent pas en vrai ou faux (l'Éclair les pose aussi).
const parleDeSesChoix = q => /\b(parmi|lequel|laquelle|lesquels|lesquelles|ces propositions|ci-dessous|suivant)/i.test(q.texte);
const qcmPossible = q => q.reponses.length === 4 && q.texte.length < 130 && q.reponses.every(x => x.length < 34) && !donne(q) && !parleDeSesChoix(q);
const qcm = q => ({ id: q.id, t: q.texte, r: q.reponses, b: q.bonne, a: q.anecdote, c: q.categorie });

const CATEGORIES = ['Culture générale', 'Histoire', 'Géographie', 'Sciences', 'Nature', 'Cinéma & séries', 'Musique', 'Arts & lettres', 'Sport', 'Cuisine', 'Jeux & pop culture', 'Autour de la fête'];
const NIVEAUX = { facile: [1, 2], moyen: [3], difficile: [4] };
const PAR_NIVEAU = { facile: 24, moyen: 24, difficile: 20 };

const base = { qcm: {}, mots: {}, filet: {} };
for (const c of CATEGORIES) {
  const deLaCategorie = toutes.filter(q => q.categorie === c);
  base.qcm[c] = {};
  for (const [niveau, diffs] of Object.entries(NIVEAUX)) {
    base.qcm[c][niveau] = tirer(deLaCategorie.filter(q => diffs.includes(q.difficulte) && qcmPossible(q)), PAR_NIVEAU[niveau]).map(qcm);
  }
  // Le Mot mystère : un mot de cinq à huit lettres, sans espace ni trait d'union.
  base.mots[c] = tirer(deLaCategorie.filter(q => {
    const m = majuscules(sansArticle(q.reponses[q.bonne]));
    return /^[A-Z]{5,8}$/.test(m) && q.difficulte <= 3 && q.texte.length < 120 && !/\d/.test(q.texte) && !donne(q);
  }), 12).map(q => ({ id: q.id, t: q.texte, m: majuscules(sansArticle(q.reponses[q.bonne])), aff: sansArticle(q.reponses[q.bonne]), a: q.anecdote, c }));
  // Le Filet : des années, et des nombres que l'intitulé ne trahit pas.
  const annees = tirer(deLaCategorie.filter(q => /^En quelle année/.test(q.texte) && q.date && q.date.precision === 'annee' && /^\d{4}$/.test(q.date.valeur) && +q.date.valeur > 1000), 7)
    .map(q => ({ id: q.id, t: q.texte, v: +q.date.valeur, u: '', annee: true, a: q.anecdote, c }));
  const nombres = tirer(deLaCategorie.filter(q => q.valeur && typeof q.valeur.nombre === 'number' && Number.isInteger(q.valeur.nombre) && q.valeur.nombre >= 10 && q.texte.length < 130
    && !/année/.test(q.texte) && !norm(q.texte).includes(String(q.valeur.nombre)) && !/^Combien vaut/.test(q.texte)), 7)
    .map(q => ({ id: q.id, t: q.texte, v: q.valeur.nombre, u: q.valeur.unite || '', a: q.anecdote, c }));
  base.filet[c] = annees.concat(nombres);
}

// Les tableaux du Détail et leurs quatre cadrages : ceux de la maquette du 24 octobre.
global.window = {};
require(path.resolve(racine, 'retours/2026-10-24/maquette/donnees.js'));
const tableaux = window.TABLEAUX;

fs.writeFileSync(sortie,
  '// Écrit par extraire.cjs : un échantillon de la base de la campagne, par thème et par difficulté.\n'
  + 'window.BASE = ' + JSON.stringify(base) + ';\n'
  + 'window.TABLEAUX = ' + JSON.stringify(tableaux) + ';\n');

const compte = o => Object.entries(o).map(([c, l]) => `${c} ${Array.isArray(l) ? l.length : Object.values(l).map(x => x.length).join('/')}`).join(' · ');
console.log('QCM (facile/moyen/difficile) :', compte(base.qcm));
console.log('Mots :', compte(base.mots));
console.log('Filet :', compte(base.filet));
console.log('Tableaux :', tableaux.length, '·', Math.round(fs.statSync(sortie).size / 1024), 'Ko');

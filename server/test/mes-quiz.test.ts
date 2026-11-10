// « Mes quiz » au pouce : des cartes, deux feuilles, une fiche par quiz.
//
// La liste ne montre que l'essentiel — la pastille du quiz, son nom, une
// ligne de faits, ▶ pour le lancer. Créer (cinq façons) et trier ont chacun
// leur feuille ; les gestes rares, qui attendaient sous un « ⋯ » flottant
// par ligne, vivent dans la fiche du quiz, « Supprimer » seul tout en bas.
// « Lancer » ouvre un salon sur ce quiz.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import type { QuizSummary } from '../../shared/library'
import type { Programme } from '../../shared/programme'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/edit', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/edit', search: '', hash: '', origin: 'http://banc' },
})

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

/** Un module du client, par son adresse : le typecheck du serveur ne lit pas le JSX. */
const importer = (fichier: string) => import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)

async function rendu(composant: string, props: object): Promise<string> {
  const module = await importer('components/MesQuiz')
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const CINE: QuizSummary = {
  id: 'q-cine',
  title: '🎬 Ciné des années 90',
  questionCount: 10,
  readyCount: 10,
  updatedAt: Date.now() - 86_400_000,
  categories: ['Cinéma & séries', 'Musique'],
  photos: 3,
  dureeS: 600,
  joue: { fois: 2, dernier: Date.now() - 7 * 86_400_000 },
}

const rien = () => {}
const gestes = {
  onFermer: rien,
  onModifier: rien,
  onDupliquer: rien,
  onPartager: rien,
  onExporter: rien,
  onProposer: rien,
  onArchiver: rien,
  onSupprimer: rien,
}

test('le titre d’un quiz donne son emoji et son nom ; sans emoji, l’initiale', async () => {
  const { separerTitre } = await importer('components/MesQuiz')
  assert.deepEqual(separerTitre('🎬 Ciné des années 90'), { emoji: '🎬', nom: 'Ciné des années 90' })
  assert.deepEqual(separerTitre('❤️ La saint-Valentin'), { emoji: '❤️', nom: 'La saint-Valentin' })
  assert.deepEqual(separerTitre('Quiz de Noël'), { emoji: null, nom: 'Quiz de Noël' })
  // Un titre qui n'est qu'un emoji reste un titre : sans nom, pas de séparation.
  assert.deepEqual(separerTitre('🎉'), { emoji: null, nom: '🎉' })
  const sansEmoji = await rendu('CarteDeQuiz', { quiz: { ...CINE, title: 'quiz de Noël' }, brouillon: false, onFiche: rien })
  assert.match(sansEmoji, /<span class="quiz-pastille"[^>]*aria-hidden="true">Q<\/span>/)
})

/** Ce qu'un balisage donne à lire : son texte, sans ses balises. */
const texte = (html: string) => html.replace(/<[^>]+>/g, '')

test('une carte : la pastille, le nom, une ligne de faits, et ▶ qui ouvre un salon sur ce quiz', async () => {
  const html = await rendu('CarteDeQuiz', { quiz: CINE, brouillon: false, onFiche: rien })
  assert.match(html, /<span class="quiz-pastille" style="--lueur:#ff6b8a" aria-hidden="true">🎬<\/span>/, 'la lueur de sa catégorie')
  assert.match(html, /<b>Ciné des années 90<\/b>/)
  // Ses faits se disent en morceaux depuis le 10 novembre 2026 : mis bout à bout, la phrase d'avant, mot pour mot.
  assert.match(texte(html), /10 questions · ≈ 10 min · joué 2 fois/)
  assert.match(html, /<a class="quiz-carte-lancer" href="\/salon\?quiz=q-cine" aria-label="Lancer « 🎬 Ciné des années 90 »">/)
  assert.match(html, /aria-label="🎬 Ciné des années 90 : ouvrir sa fiche"/)
  // Rien de prêt, ou archivé : rien à lancer.
  for (const q of [{ ...CINE, readyCount: 0 }, { ...CINE, archivedAt: Date.now() }]) {
    assert.doesNotMatch(await rendu('CarteDeQuiz', { quiz: q, brouillon: false, onFiche: rien }), /quiz-carte-lancer/)
  }
  // Ce qui manque se dit sur la carte — derrière ce qui attend dans ce navigateur, plus pressant : l'ordre a changé avec
  // la ligne, les mots non.
  assert.match(texte(await rendu('CarteDeQuiz', { quiz: { ...CINE, readyCount: 6 }, brouillon: true, onFiche: rien })), /Des modifications attendent dans ce navigateur · 4 à compléter/)
})

// « Mes quiz » en lignes (le 10 novembre 2026 — le propriétaire : « revoir l'onglet quiz […] modifier la disposition et
// l'aspect si tu trouves cela nécessaire »). En 360 × 640, des cartes de 68 à 128 px — un nom sur trois lignes, les
// faits sur deux, « à compléter » sur la sienne — n'en montraient que trois sur dix sous 247 px de tête. Ce qui tient à
// l'écran se mesure au navigateur (`server/scripts/rendu-mes-quiz.ts`) ; ici, la ligne, ses morceaux et la feuille.
test('la ligne d’un quiz : son nom, puis ses faits en morceaux, du plus pressant au plus accessoire', async () => {
  const { faitsDuQuiz } = await importer('components/MesQuiz')
  const dits = (q: QuizSummary, brouillon = false) => (faitsDuQuiz(q, brouillon) as { texte: string; alerte?: string; trouve?: boolean }[]).map(f => f.texte)
  assert.deepEqual(dits(CINE), ['10 questions', '≈ 10 min', 'joué 2 fois'])
  assert.deepEqual(dits({ ...CINE, joue: undefined }), ['10 questions', '≈ 10 min', 'jamais joué'])
  // Ce que la recherche a trouvé d'abord — c'est ce qu'on cherche —, puis ce qui attend ici, ce qui manque, ses faits.
  assert.deepEqual(dits({ ...CINE, readyCount: 6, trouve: 'Qui a réalisé Titanic ?', archivedAt: 1 }, true), [
    'Trouvé dans « Qui a réalisé Titanic ? »',
    'Des modifications attendent',
    ' dans ce navigateur',
    '4 à compléter',
    '6 questions',
    '≈ 10 min',
    'joué 2 fois',
    'Archivé',
  ])
  // Un modèle à personnaliser, dix réponses à écrire : « 10 à compléter » dit déjà qu'aucune n'est prête.
  assert.deepEqual(dits({ ...CINE, readyCount: 0, dureeS: 0, joue: undefined }), ['10 à compléter'])
  assert.deepEqual(dits({ ...CINE, questionCount: 0, readyCount: 0, dureeS: 0, joue: undefined }), ['Aucune question encore'])
  // Des questions mises de côté, aucune à compléter : le compte reste.
  assert.deepEqual(dits({ ...CINE, questionCount: 2, readyCount: 0, deCote: 2, dureeS: 0, joue: undefined }), ['0 question'])

  // Chaque morceau dans son `span` : la feuille ne montre que ceux qui tiennent entiers. Une alerte prend sa couleur et
  // son icône ; sa suite (« dans ce navigateur ») s'y colle, sans point ni icône de plus.
  const html = await rendu('CarteDeQuiz', { quiz: { ...CINE, readyCount: 6 }, brouillon: true, onFiche: rien })
  const ligne = /<span class="quiz-carte-faits">(.*?)<\/span><\/span><\/button>/.exec(html)?.[1]
  assert.ok(ligne, 'la ligne de faits se trouve')
  const morceaux = [...ligne.matchAll(/<span class="(quiz-fait[^"]*)">(.*?)<\/span>/g)]
  assert.equal(morceaux.map(m => m[0]).join(''), ligne, 'la ligne n’est faite que de ses morceaux')
  assert.deepEqual(morceaux.map(m => m[1]), ['quiz-fait warn', 'quiz-fait warn', 'quiz-fait warn', 'quiz-fait', 'quiz-fait', 'quiz-fait'])
  assert.deepEqual(morceaux.map(m => texte(m[2])), ['Des modifications attendent', ' dans ce navigateur', ' · 4 à compléter', ' · 6 questions', ' · ≈ 10 min', ' · joué 2 fois'])
  assert.deepEqual(morceaux.map(m => (m[2].match(/<svg/g) ?? []).length), [1, 0, 1, 0, 0, 0], 'une icône par alerte, pas par morceau')
  // Plus de ligne à part pour « à compléter », le brouillon ou « Archivé » : tout tient dans la ligne de faits.
  assert.doesNotMatch(html, /class="warn small"/)

  const css = source('styles.css')
  // Son nom sur une ligne, coupé au bout ; ses faits, une ligne qui ne montre que des morceaux entiers.
  assert.match(css, /\.quiz-carte-texte b \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/)
  assert.match(css, /\.quiz-carte-faits \{ display: flex; flex-wrap: wrap; align-content: flex-start; height: 1\.3em; overflow: clip;/)
  assert.match(css, /\.quiz-fait \{ flex: none; white-space: pre; \}/)
  assert.match(css, /\.quiz-fait:first-child \{ flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; \}/)
  // Une seule carte, un filet entre deux quiz.
  assert.match(css, /\.quiz-cartes \{[^}]*border: 1px solid var\(--edge\);[^}]*background: var\(--surface\);/)
  assert.match(css, /\.quiz-carte \+ \.quiz-carte \{ border-top: 1px solid var\(--edge\); \}/)
  // Trois pas de hauteur d'écran — un portable court comme un téléphone : des lignes de 64, 60 et 56 px, jamais sous une
  // cible de doigt.
  assert.match(css, /\.mes-quiz \{[^}]*--quiz-rang: 64px;/)
  const pas = [...css.matchAll(/@media \(max-height: (\d+)px\) \{\s*\.mes-quiz \{[^}]*--quiz-rang: (\d+)px;/g)].map(m => [Number(m[1]), Number(m[2])])
  assert.deepEqual(pas, [[819, 60], [719, 56]])
  assert.match(css, /\.quiz-carte \{ display: flex; align-items: center; min-height: var\(--quiz-rang\); \}/)
  // ▶ : un rond plus petit que sa cible, qui garde 44 px sous le doigt.
  assert.match(css, /\.quiz-carte-lancer \{[^}]*width: 44px;\s*height: 44px;[^}]*border: calc\(\(44px - var\(--quiz-lancer, 44px\)\) \/ 2\) solid transparent;/)
})

test('la tête de « Mes quiz » : « Créer un quiz » à côté du titre, et ce qu’un petit écran tait reste à l’oreille', () => {
  const editeur = source('views/EditorApp.tsx')
  // Le même bouton, le même nom — à côté du titre, plus en gros bouton sur sa ligne.
  assert.match(editeur, /<div className="bibliotheque-titre">\s*<h1>Mes quiz<\/h1>\s*\{list && \(\s*<button\s+type="button"\s+className="btn btn-primary bibliotheque-creer"/)
  assert.equal(editeur.match(/\n\s+Créer un quiz\n/g)?.length, 1, 'un seul « Créer un quiz » sur la page')
  const liste = editeur.slice(editeur.indexOf('<main className="page-corps">'), editeur.indexOf("feuille === 'creer' &&"))
  assert.doesNotMatch(liste, /btn-big/, 'plus de gros bouton avant la liste')
  const css = source('styles.css')
  // Le texte agrandi sur un écran très étroit : le bouton passe sous le titre, il n'élargit pas la page.
  assert.match(css, /\.bibliotheque-titre \{ display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;/)
  const CACHE = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;'
  // Combien de quiz, sous 820 px de haut ; « Animer », sous 720 : cachés à l'œil comme `.sr-only`, jamais retirés.
  assert.ok(css.includes(`@media (max-height: 819px) {\n  .bibliotheque-compte { ${CACHE} }\n}`))
  assert.ok(css.includes(`@media (max-height: 719px) {\n  .bibliotheque-tete > .label { ${CACHE} }`))
  const bloc = css.slice(css.indexOf('/* ── Mes quiz'), css.indexOf('/* Ce que l\'historique sait d\'une question'))
  assert.ok(bloc.length > 2000, 'le bloc de « Mes quiz » se lit')
  assert.doesNotMatch(bloc.replace(/\/\*[\s\S]*?\*\//g, ''), /\.(?:bibliotheque|fiche|quiz-heros)[^{]*\{[^}]*display: none/, 'rien n’y est retiré : ce qui se tait reste lu')
})

test('la fiche d’un quiz sur un téléphone : l’emblème à côté du nom, deux gestes côte à côte, des gestes rares sur une ligne', async () => {
  const html = await rendu('FicheDeQuiz', { quiz: CINE, brouillon: false, occupe: false, exportEnCours: false, ...gestes })
  // « Modifier les questions » en deux temps : son verbe, puis « les questions », que la feuille cache à l'œil à côté de « Lancer ».
  assert.match(html, /<button type="button" class="btn btn-big btn-block"><svg[^>]*>.*?<\/svg><span>Modifier<span class="fiche-suite"> les questions<\/span><\/span><\/button>/)
  // Ce qu'un geste rare dit sous son nom : une classe à lui, que la feuille tient sur une ligne ou cache à l'œil.
  assert.equal(html.match(/<span class="muted small fiche-geste-detail">/g)?.length, 5)
  assert.match(html, /<p class="muted quiz-heros-contenu">10 questions prêtes · ≈ 10 min · 3 photos<\/p>/)

  const css = source('styles.css')
  const CACHE = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;'
  // Sur un écran étroit ou court — un téléphone, un portable —, l'emblème à côté du nom ; le reste dessous, sur toute la largeur.
  assert.match(css, /@media \(max-width: 700px\), \(max-height: 819px\) \{\s*\.quiz-heros \{ display: grid; grid-template-columns: auto minmax\(0, 1fr\);/)
  assert.match(css, /\.quiz-heros > :not\(\.quiz-pastille, h1\) \{ grid-column: 1 \/ -1; \}/)
  // Sous 820 px de haut, les deux gestes côte à côte quand ils sont deux, et « les questions » caché à l'œil.
  assert.ok(css.includes(`@media (max-height: 819px) {\n  .quiz-fiche-gestes:has(> :nth-child(2)) { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }`))
  assert.ok(css.includes(`.quiz-fiche-gestes:has(> :nth-child(2)) .fiche-suite { ${CACHE} }`))
  // Sous 720, chaque geste rare garde son nom seul, et « Plus » se tait.
  assert.ok(css.includes(`@media (max-height: 719px) {\n  .fiche-plus > .label,\n  .fiche-geste-detail { ${CACHE} }\n}`))
  // Un geste rare ne descend pas sous une cible de doigt.
  assert.match(css, /--quiz-rare: 48px;/)
  assert.match(css, /@media \(max-height: 719px\) \{\s*\.mes-quiz \{[^}]*--quiz-rare: 44px;/)
  // Le survol n'allume un geste que sous une souris : au doigt, il restait sur le geste venu sous lui à l'ouverture.
  assert.match(css, /@media \(hover: hover\) \{\s*\.fiche-geste:hover:not\(:disabled\) \{ background: var\(--accent-soft\); \}\s*\}/)
})

test('les deux feuilles de « Mes quiz » et les premiers pas : tout ce qu’on y choisit se voit d’abord', () => {
  const editeur = source('views/EditorApp.tsx')
  assert.match(editeur, /<Feuille titre="Créer un quiz" className="feuille-creer"/)
  assert.match(editeur, /<Feuille\s+titre="Trier et filtrer"\s+className="feuille-trier"/)
  const css = source('styles.css')
  // Leurs écarts resserrés sur un téléphone, par leur classe : les autres feuilles gardent leurs mesures.
  assert.match(css, /@media \(max-width: 700px\), \(max-height: 819px\) \{\s*\.feuille-creer \.carte-barre,\s*\.feuille-trier \.carte-barre \{/)
  assert.match(css, /\.feuille-creer \.choix-ligne \{ gap: 12px; padding: 6px 10px; \}/)
  // Une pastille garde ses 44 px sous le doigt : la feuille ne touche pas à sa hauteur.
  assert.doesNotMatch(css, /\.feuille-trier \.pill-btn \{[^}]*min-height/)
  // Les premiers pas : le quiz tout prêt, puis les trois autres départs, puis les modèles.
  const premiersPas = editeur.slice(editeur.indexOf('function PremiersPas('), editeur.indexOf('const ACCORDS_AFFICHES'))
  const places = ['Composer un quiz tout prêt', 'Coller une liste — tes notes', 'Importer le quiz d\'un ami', 'Créer mon quiz', '{rayons.map('].map(t => premiersPas.indexOf(t))
  assert.ok(places.every(p => p > 0), 'chaque départ est là')
  assert.deepEqual([...places].sort((a, b) => a - b), places, 'les départs avant les modèles')
  assert.equal(premiersPas.match(/className="premiers-pas-choix"/g)?.length, 1)
  // Un seul bouton d'or dans la carte : le départ qu'on recommande.
  assert.equal(premiersPas.match(/className="btn btn-primary"/g)?.length, 1)
  // Rouverts depuis « Créer un quiz », les modèles se referment d'en haut, à côté de leur titre — et encore au bout du
  // catalogue, pour qui l'a lu jusque-là. Le même nom aux deux : celui d'en haut le dit à l'oreille, « Fermer » à l'œil.
  const fermer = [premiersPas.indexOf('aria-label="Fermer les modèles"'), premiersPas.indexOf('{rayons.map('), premiersPas.lastIndexOf('Fermer les modèles')]
  assert.ok(fermer.every(p => p > 0), 'les deux « Fermer les modèles » sont là')
  assert.deepEqual([...fermer].sort((a, b) => a - b), fermer, 'l’un avant les modèles, l’autre après')
  assert.match(premiersPas, /\{onFermer \? \(\s*<div className="premiers-pas-tete">\s*\{titre\}\s*<button type="button" className="btn btn-ghost btn-small" aria-label="Fermer les modèles" onClick=\{onFermer\}>/)
  assert.match(css, /\.premiers-pas-tete \{ display: flex; align-items: center; justify-content: space-between; gap: 12px; \}/)
})

test('la fiche : Lancer et Modifier en grand, les gestes rares dessous, Supprimer seul tout en bas', async () => {
  const fiche = (q: QuizSummary) => rendu('FicheDeQuiz', { quiz: q, brouillon: false, occupe: false, exportEnCours: false, ...gestes })
  const html = await fiche(CINE)
  // Lu dans son texte : « Modifier les questions » s'écrit en deux morceaux depuis le 10 novembre 2026 (son verbe, puis
  // « les questions », qu'un petit écran cache à l'œil à côté de « Lancer ») — les mêmes mots, dans le même ordre.
  const lu = texte(html)
  const ordre = ['Mes quiz', 'Lancer', 'Modifier les questions', 'Dupliquer', 'Partager par un code', 'Exporter en fichier', 'Proposer au catalogue', 'Archiver', 'Supprimer ce quiz']
  const places = ordre.map(t => lu.indexOf(t))
  assert.ok(places.every(i => i >= 0), `tout y est : ${ordre.filter((_, i) => places[i] < 0)}`)
  assert.deepEqual([...places].sort((a, b) => a - b), places, 'dans cet ordre')
  assert.match(html, />Lancer</, '« Lancer », un mot seul sur son bouton')
  assert.match(html, /<a class="btn btn-primary btn-big btn-block" href="\/salon\?quiz=q-cine">/)
  assert.match(html, /<a class="lien-discret jour-sortie" href="\/edit">/, '« ← Mes quiz », un lien qui s’ouvre aussi dans un onglet')
  assert.match(html, /<li>Cinéma &amp; séries<\/li><li>Musique<\/li>/)
  assert.match(html, /10 questions prêtes · ≈ 10 min · 3 photos/)
  // Archivé : il ressort, il ne se lance pas.
  const archive = await fiche({ ...CINE, archivedAt: Date.now() })
  assert.match(archive, /Ressortir de l’archive/)
  assert.doesNotMatch(archive, />Lancer</)
  // Vide : on l'écrit, on ne le partage ni ne le propose.
  const vide = await fiche({ ...CINE, questionCount: 0, readyCount: 0, categories: [] })
  assert.match(texte(vide), /Écrire les questions/)
  assert.match(vide, /<button type="button" class="fiche-geste" disabled="">.*?<b>Partager par un code<\/b>/)
  assert.match(vide, /<button type="button" class="fiche-geste" disabled="">.*?<b>Proposer au catalogue<\/b>/)
})

test('« Mes quiz » : deux feuilles, une fiche à son adresse, plus un seul menu flottant', () => {
  const editeur = source('views/EditorApp.tsx')
  assert.doesNotMatch(editeur, /LigneDeQuiz|MenuNouveau|useFermeture|menu-deroulant/)
  assert.match(editeur, /<Feuille titre="Créer un quiz"/)
  assert.match(editeur, /<Feuille\s+titre="Trier et filtrer"/)
  for (const choix of ['Un quiz vide', 'Coller une liste', 'Partir d’un modèle', 'Recevoir par un code', 'Importer un fichier']) {
    assert.match(editeur, new RegExp(`titre="${choix}"`), choix)
  }
  // Le retour du navigateur referme la fiche ; « Mes quiz », depuis l'éditeur, y ramène.
  assert.match(editeur, /history\.pushState\(\{ \[FICHE_ICI\]: true \}, '', `\/edit\?fiche=\$\{encodeURIComponent\(id\)\}`\)/)
  assert.match(editeur, /setFiche\(ficheDeLAdresse\(\)\)/)
  // Le filtre choisi reste en vue, et se retire d'un toucher.
  assert.match(editeur, /aria-label=\{`Retirer le filtre « \$\{filtreActif\.label\} »`\}/)
  const css = source('styles.css')
  assert.doesNotMatch(css, /\.menu-deroulant|\.quiz-ligne\b|\.bouton-plus/, 'leur feuille de style est partie avec eux')

})

test('« Mes quiz » ne prépare plus le programme du soir : il se choisit en créant le salon', () => {
  // « Lancer » ouvre déjà un salon sur ce quiz, et le salon a son programme ;
  // le panneau en tête de « Mes quiz » et « Mettre au programme » ne
  // faisaient que le doubler (la remarque du propriétaire du 3 octobre 2026).
  assert.doesNotMatch(source('views/EditorApp.tsx'), /Programme|prog\./)
  assert.doesNotMatch(source('components/MesQuiz.tsx'), /programme/i)
  assert.doesNotMatch(source('styles.css'), /\.programme\b|\.programme-/)
  assert.match(source('views/SalonApp.tsx'), /export function quizDuSalon\(/)
})

test('« Lancer » ouvre un salon sur ce quiz seul ; sinon, le programme d’hier reprend sa place', async () => {
  const { quizDuSalon } = await importer('views/SalonApp')
  const liste: QuizSummary[] = [
    CINE,
    { ...CINE, id: 'q-rock', title: '🎸 Rock', readyCount: 8 },
    { ...CINE, id: 'q-vieux', title: 'Vieux', archivedAt: 1 },
  ]
  const programme = { entrees: [{ quizId: 'q-rock', multiplier: 2 }, { quizId: 'q-cine', multiplier: 3 }, { quizId: 'parti', multiplier: 1 }] } as unknown as Programme
  assert.deepEqual(quizDuSalon(liste, programme, null), [
    { id: 'q-rock', titre: '🎸 Rock', multiplicateur: 2 },
    { id: 'q-cine', titre: '🎬 Ciné des années 90', multiplicateur: 3 },
  ])
  assert.deepEqual(quizDuSalon(liste, programme, 'q-cine'), [{ id: 'q-cine', titre: '🎬 Ciné des années 90', multiplicateur: 3 }], 'son multiplicateur d’hier gardé')
  assert.deepEqual(quizDuSalon(liste, null, 'q-rock'), [{ id: 'q-rock', titre: '🎸 Rock', multiplicateur: 1 }])
  // Archivé, ou d'ailleurs : la demande ne compte pas.
  assert.equal(quizDuSalon(liste, programme, 'q-vieux').length, 2)
  assert.equal(quizDuSalon(liste, programme, 'q-du-voisin').length, 2)
})

// La tablée du 9 novembre 2026 : Nadia a quitté « Nouveau salon » pour régler
// le temps de ses questions dans « Mes quiz ». Au retour, plus rien — ni ses
// quiz, ni ses équipes, ni la télé : cinq minutes sur dix de préparation.
test('« Nouveau salon » garde sa préparation : un brouillon sur ce téléphone, jusqu’à l’ouverture', async () => {
  const stock = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => stock.get(k) ?? null,
      setItem: (k: string, v: string) => void stock.set(k, v),
      removeItem: (k: string) => void stock.delete(k),
    },
  })
  const { brouillonDuSalon, chefIci, oublierBrouillon, retenirBrouillon } = await import(new URL('../../client/src/chef.ts', import.meta.url).href)
  const brouillon = {
    slug: 's-abc234',
    nom: 'Les 40 ans de Sam',
    quiz: [{ id: 'q-rock', multiplicateur: 2 }, { id: 'q-cine', multiplicateur: 1 }],
    ecran: 'tele',
    joue: true,
    rythme: null,
    equipes: true,
    equipesPreparees: [{ nom: 'Les Randonneurs', emoji: '🔥' }, { nom: 'Les Pizzaïolos', emoji: '🌶️' }],
  }
  assert.equal(brouillonDuSalon('s-abc234'), null, 'rien de préparé')
  retenirBrouillon(brouillon)
  assert.deepEqual(brouillonDuSalon('s-abc234'), brouillon)
  assert.equal(brouillonDuSalon('chez-un-autre'), null, 'celui d’un autre espace ne vaut pas ici')
  // Préparer un salon ne fait pas de ce téléphone celui du chef : la barre attend « Ouvrir le salon ».
  assert.equal(chefIci('s-abc234'), null)
  // Un brouillon abîmé ne fait pas tomber la page : ce qui se lit se garde, le reste revient à l'office.
  stock.set('quizz.salon', JSON.stringify({ slug: 's-abc234', nom: 42, quiz: [{ id: 'q-rock', multiplicateur: 9 }, { id: 7 }, 'x'], ecran: 'cinema', rythme: 7, equipes: 'oui' }))
  assert.deepEqual(brouillonDuSalon('s-abc234'), { slug: 's-abc234', nom: '', quiz: [{ id: 'q-rock', multiplicateur: 1 }], ecran: 'telephones', joue: true, rythme: null, equipes: false })
  stock.set('quizz.salon', '{')
  assert.equal(brouillonDuSalon('s-abc234'), null)
  retenirBrouillon(brouillon)
  oublierBrouillon()
  assert.equal(brouillonDuSalon('s-abc234'), null, '« Ouvrir le salon » l’oublie : le programme et les réglages du chef le tiennent')

  // Ses quiz passent devant le programme d'hier — mais pas devant « Lancer », qui ouvre un salon sur un quiz seul.
  const { quizDuSalon } = await importer('views/SalonApp')
  const liste: QuizSummary[] = [CINE, { ...CINE, id: 'q-rock', title: '🎸 Rock', readyCount: 8 }]
  const programme = { entrees: [{ quizId: 'q-cine', multiplier: 3 }] } as unknown as Programme
  assert.deepEqual(quizDuSalon(liste, programme, null, [{ id: 'q-rock', multiplicateur: 2 }, { id: 'supprime-depuis', multiplicateur: 1 }]), [
    { id: 'q-rock', titre: '🎸 Rock', multiplicateur: 2 },
  ])
  assert.deepEqual(quizDuSalon(liste, programme, null, []), [], 'il avait tout retiré : le programme d’hier ne revient pas')
  assert.deepEqual(quizDuSalon(liste, programme, 'q-cine', [{ id: 'q-rock', multiplicateur: 2 }]), [{ id: 'q-cine', titre: '🎬 Ciné des années 90', multiplicateur: 3 }])
  // Le retour du détour : le crayon mène à « Mes quiz », d'où le chemin qui
  // revient au salon est « Lancer ». Sur un quiz qu'elle préparait déjà, il
  // lui rend son brouillon entier, pas ce quiz seul.
  assert.deepEqual(
    quizDuSalon(liste, programme, 'q-cine', [{ id: 'q-rock', multiplicateur: 2 }, { id: 'q-cine', multiplicateur: 1 }]),
    [
      { id: 'q-rock', titre: '🎸 Rock', multiplicateur: 2 },
      { id: 'q-cine', titre: '🎬 Ciné des années 90', multiplicateur: 1 },
    ],
    '« Lancer » sur un quiz du brouillon garde les autres',
  )

  const salon = source('views/SalonApp.tsx')
  // Ce que la page a chargé n'est pas un brouillon : il ne s'écrit qu'à partir du premier changement.
  assert.ok(/if \(depart\.current === null\) \{\s*depart\.current = cle\s*return\s*\}/.test(salon), 'le chargement ne s’écrit pas')
  assert.ok(salon.includes('retenirBrouillon(brouillon)'), 'chaque changement se retient')
  const ouvrir = salon.slice(salon.indexOf('const ouvrir = async'), salon.indexOf('const jouables'))
  // Une fois le salon ouvert, pas avant : un refus du serveur la laisse sur sa page, son brouillon intact.
  assert.ok(ouvrir.includes('oublierBrouillon()') && ouvrir.indexOf('oublierBrouillon()') > ouvrir.indexOf('await api.joueur.salon('), 'ouvert, le salon n’a plus de brouillon')
  // Et chaque quiz du salon mène à sa page, d'où l'on règle son temps par question : le brouillon attend.
  assert.ok(salon.includes('href={`/edit?quiz=${encodeURIComponent(q.id)}`}'), 'la carte d’un quiz ouvre sa page')
  // « Pas encore de quiz prêt » se lisait quand tous ses quiz étaient déjà dans le salon.
  assert.ok(salon.includes('Tous tes quiz prêts sont déjà dans ce salon.'))
})

test('« Nouveau salon » demande le nom de la soirée, et l’écrit en ouvrant', () => {
  const salon = source('views/SalonApp.tsx')
  assert.ok(/<label className="label" htmlFor="salon-nom">\s*Le nom de la soirée\s*<\/label>/.test(salon))
  assert.ok(!/id="salon-nom"[^>]*autoFocus/.test(salon), 'pas d’autoFocus : le clavier pousserait la page')
  const ouvrir = salon.slice(salon.indexOf('const ouvrir = async'), salon.indexOf('const jouables'))
  // Seulement s'il a changé : un salon rouvert tel quel n'écrit rien de plus.
  assert.ok(ouvrir.includes('api.space.saveSettings(reglagesAuNom(nom, espace))'), 'le nom part avec l’ouverture, tous les réglages de l’espace avec lui')
  assert.ok(ouvrir.indexOf('api.space.saveSettings(') < ouvrir.indexOf('api.joueur.salon('), 'avant que le salon s’ouvre : la télé et l’entrée le portent d’emblée')
})

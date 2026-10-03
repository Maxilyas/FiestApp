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
  onProgramme: rien,
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

test('une carte : la pastille, le nom, une ligne de faits, et ▶ qui ouvre un salon sur ce quiz', async () => {
  const html = await rendu('CarteDeQuiz', { quiz: CINE, brouillon: false, onFiche: rien })
  assert.match(html, /<span class="quiz-pastille" style="--lueur:#ff6b8a" aria-hidden="true">🎬<\/span>/, 'la lueur de sa catégorie')
  assert.match(html, /<b>Ciné des années 90<\/b>/)
  assert.match(html, /10 questions · ≈ 10 min · joué 2 fois/)
  assert.match(html, /<a class="quiz-carte-lancer" href="\/salon\?quiz=q-cine" aria-label="Lancer « 🎬 Ciné des années 90 »">/)
  assert.match(html, /aria-label="🎬 Ciné des années 90 : ouvrir sa fiche"/)
  // Rien de prêt, ou archivé : rien à lancer.
  for (const q of [{ ...CINE, readyCount: 0 }, { ...CINE, archivedAt: Date.now() }]) {
    assert.doesNotMatch(await rendu('CarteDeQuiz', { quiz: q, brouillon: false, onFiche: rien }), /quiz-carte-lancer/)
  }
  // Ce qui manque se dit sur la carte.
  assert.match(await rendu('CarteDeQuiz', { quiz: { ...CINE, readyCount: 6 }, brouillon: true, onFiche: rien }), /4 à compléter.*Des modifications attendent/)
})

test('la fiche : Lancer et Modifier en grand, les gestes rares dessous, Supprimer seul tout en bas', async () => {
  const fiche = (q: QuizSummary, auProgramme: boolean | null = false) =>
    rendu('FicheDeQuiz', { quiz: q, brouillon: false, occupe: false, exportEnCours: false, auProgramme, occupeProgramme: false, ...gestes })
  const html = await fiche(CINE)
  const ordre = ['Mes quiz', '>Lancer<', 'Modifier les questions', 'Mettre au programme', 'Dupliquer', 'Partager par un code', 'Exporter en fichier', 'Proposer au catalogue', 'Archiver', 'Supprimer ce quiz']
  const places = ordre.map(t => html.indexOf(t))
  assert.ok(places.every(i => i > 0), `tout y est : ${ordre.filter((_, i) => places[i] < 0)}`)
  assert.deepEqual([...places].sort((a, b) => a - b), places, 'dans cet ordre')
  assert.match(html, /<a class="btn btn-primary btn-big btn-block" href="\/salon\?quiz=q-cine">/)
  assert.match(html, /<a class="lien-discret jour-sortie" href="\/edit">/, '« ← Mes quiz », un lien qui s’ouvre aussi dans un onglet')
  assert.match(html, /<li>Cinéma &amp; séries<\/li><li>Musique<\/li>/)
  assert.match(html, /10 questions prêtes · ≈ 10 min · 3 photos/)
  // Archivé : il ressort, il ne se lance pas, il n'entre pas au programme.
  const archive = await fiche({ ...CINE, archivedAt: Date.now() }, null)
  assert.match(archive, /Ressortir de l’archive/)
  assert.doesNotMatch(archive, />Lancer<|programme/)
  // Vide : on l'écrit, on ne le partage ni ne le propose.
  const vide = await fiche({ ...CINE, questionCount: 0, readyCount: 0, categories: [] }, null)
  assert.match(vide, /Écrire les questions/)
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

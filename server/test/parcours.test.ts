// Les parcours de thème — « les sentiers à thème » jusqu'au 12 octobre 2026 —
// ont quitté le dessous des douze sentiers pour l'onglet « Apprendre », sous
// le carnet (la proposition 1 de la maquette, validée par le propriétaire le
// même jour, qui voulait les remettre en question : rangés sous les sentiers,
// dont ils n'ont ni les vies ni les avatars, on prenait les uns pour les
// autres). Une ligne par parcours, une famille à la fois, et les mots de la
// page : un parcours, ses étapes.
//
// Pas de serveur : la liste, la fiche et la fin d'une étape, rendues en HTML.
// La règle même des parcours se joue contre un serveur (`sentiers-sujets.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { SUJETS } from '../../shared/sujets'
import type { EpreuveDeSujet, EtatDesSujets, SentierDeSujet } from '../../shared/sentiersDeSujets'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '#carnet', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
})

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const rendre = async (composant: string, props: Record<string, unknown>): Promise<string> => {
  const module = await import(client('views/Parcours.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const parcours = (sujet: string, paliers: number, etoiles: number[] = [0, 0, 0, 0, 0, 0]): SentierDeSujet => ({ sujet, paliers, etoiles })
const LAISSEE: EpreuveDeSujet = {
  id: 's1',
  sujet: 'animaux',
  palier: 1,
  rejeu: false,
  seuil: 7,
  justes: 1,
  fausses: 0,
  total: 10,
  issue: null,
  finie: false,
  question: { index: 1, texte: '…', reponses: ['a', 'b', 'c', 'd'], niveau: 'facile', categorie: 'Nature' },
}

// Ce que la tuile disait, la ligne le dit : où il en est, la difficulté de l'étape à jouer — on sait
// contre quoi on joue avant d'entrer (le souhait du propriétaire du 11 octobre 2026) —, ses étoiles.
test('une ligne de parcours dit où il en est, la difficulté de son étape à jouer et ses étoiles', async () => {
  const deux = await rendre('LigneDeParcours', { parcours: parcours('animaux', 1, [2, 0, 0, 0, 0, 0]), onFiche: () => {} })
  assert.match(deux, /aria-label="Les animaux : étape 2 sur 6, facile à moyen, 2 étoiles"/)
  assert.match(deux, /<b>Les animaux<\/b><span class="muted small">étape 2 sur 6 · facile à moyen<\/span><\/span><span class="parcours-etoiles">★ 2<\/span>/)
  assert.match(await rendre('LigneDeParcours', { parcours: parcours('inventions', 0), onFiche: () => {} }), /<span class="muted small">à commencer · facile<\/span>/)
  // Accompli : plus rien à jouer, plus de difficulté ; la couronne à la place de son icône.
  const fini = await rendre('LigneDeParcours', { parcours: parcours('annees-80', 6, [3, 3, 3, 3, 3, 3]), onFiche: () => {} })
  assert.match(fini, /class="parcours-ligne parcours-accompli" aria-label="Les années 80 : accompli, 18 étoiles"/)
  assert.match(fini, /<span class="muted small">accompli<\/span>/)
})

test('les parcours : celui laissé en route à reprendre, ceux en cours, puis une famille à la fois — les thèmes d’abord', async () => {
  const etat: EtatDesSujets = {
    sujets: SUJETS.map(s => (s.cle === 'annees-80' ? parcours(s.cle, 2, [3, 2, 0, 0, 0, 0]) : s.cle === 'pieges' ? parcours(s.cle, 6, [1, 1, 1, 1, 1, 1]) : parcours(s.cle, 0))),
    epreuve: LAISSEE,
  }
  const html = await rendre('ParcoursDeTheme', { etat, onEtape: () => {} })
  assert.match(html, /<section class="parcours" aria-labelledby="parcours-titre"><h2 id="parcours-titre">Les parcours de thème<\/h2>/)
  assert.match(html, /6 étapes de 10 questions, 7 bonnes réponses pour passer, sans vies/)
  assert.match(html, /<\/svg>Reprendre · Les animaux, étape 1<\/button>/)
  // En cours : la laissée d'abord — même sans étape validée —, puis ceux qui ont avancé ; un accompli n'en est plus.
  const enCours = html.slice(html.indexOf('aria-label="Tes parcours en cours"'), html.indexOf('</ul>', html.indexOf('aria-label="Tes parcours en cours"')))
  assert.deepEqual([...enCours.matchAll(/<b>([^<]+)<\/b>/g)].map(m => m[1]), ['Les animaux', 'Les années 80'])
  // L'étape laissée se dit sur sa ligne : « à commencer » mentait sur un parcours qu'on joue.
  assert.match(enCours, /aria-label="Les animaux : étape 1 sur 6, en route"/)
  assert.match(enCours, /<span class="muted small">étape 1 sur 6 · en route<\/span>/)
  assert.match(enCours, /aria-label="Les années 80 : étape 3 sur 6, facile à moyen, 5 étoiles"/)
  // Les familles en onglets, la première ouverte : ses parcours seuls, sans ceux d'en cours — les autres familles ne se rendent pas.
  assert.deepEqual([...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]+)<\/button>/g)].map(m => `${m[2]}${m[1] === 'true' ? ' *' : ''}`), ['Thèmes *', 'Époques', 'Fils rouges'])
  const famille = html.slice(html.indexOf('id="parcours-famille"'))
  const themes = SUJETS.filter(s => s.famille === 'theme' && s.cle !== 'animaux').map(s => s.nom)
  assert.deepEqual([...famille.matchAll(/<b>([^<]+)<\/b>/g)].map(m => m[1]), themes)
  assert.doesNotMatch(html, /Les pièges|Les années 90/, 'les époques et les fils rouges attendent leur onglet')
  // Sans parcours d'une famille, pas d'onglet pour elle ; d'une seule, pas d'onglets du tout.
  const seuls = await rendre('ParcoursDeTheme', { etat: { sujets: [parcours('annees-80', 0), parcours('annees-90', 0)], epreuve: null }, onEtape: () => {} })
  assert.doesNotMatch(seuls, /role="tab"|Reprendre|Tes parcours en cours/)
  assert.equal(seuls.match(/class="parcours-ligne"/g)?.length, 2)
})

test('la fiche d’un parcours : ses six étapes, la suivante à jouer, celle laissée à reprendre, les autres fermées', async () => {
  const sujet = SUJETS.find(s => s.cle === 'animaux')!
  const fiche = (p: SentierDeSujet, laissee: EpreuveDeSujet | null = null) =>
    rendre('FicheDuParcours', { parcours: p, description: sujet.description, laissee, busy: false, onJouer: () => {} })
  const html = await fiche(parcours('animaux', 1, [2, 0, 0, 0, 0, 0]))
  assert.equal(html.match(/<b>Étape \d<\/b>/g)?.length, 6)
  assert.match(html, /<li class="etape-faite">.*?<b>Étape 1<\/b><span class="muted small">10 faciles<\/span>.*?aria-label="Rejouer l’étape 1"/)
  assert.match(html, /<li class="etape-visee">.*?<b>Étape 2<\/b><span class="muted small">7 faciles et 3 moyennes<\/span><\/span><button type="button" class="btn btn-primary btn-small">Jouer<\/button>/)
  assert.equal(html.match(/<li class="etape-avenir">/g)?.length, 4)
  // L'étape laissée sur ce parcours : « Reprendre », le serveur la reprend telle quelle.
  const reprise = await fiche(parcours('animaux', 0), LAISSEE)
  assert.match(reprise, /aria-label="Reprendre l’étape 1">Reprendre<\/button>/)
  assert.doesNotMatch(reprise, />Jouer<\/button>/)
  assert.match(await fiche(parcours('animaux', 6, [3, 3, 3, 3, 3, 3])), /Parcours accompli : rejoue une étape pour ses étoiles\./)
})

test('la fin d’une étape parle d’étapes et de parcours : l’étape d’après, réessayer, le retour aux parcours', async () => {
  const fin = (e: Partial<EpreuveDeSujet>, reste: object = {}) =>
    rendre('FinDeLEtape', {
      fin: { e: 'fin', reponse: { juste: true, bonne: 0, anecdote: null, xp: 5, epreuve: { ...LAISSEE, question: undefined, finie: true, ...e }, ...reste }, xp: 40, justesIci: 8, correction: null },
      busy: false,
      erreur: '',
      onCorrection: () => {},
      onRejouer: () => {},
      onSuivant: () => {},
      onRetour: () => {},
    })
  const validee = await fin({ issue: 'validee', justes: 8, fausses: 2 }, { etoiles: 1 })
  assert.match(validee, /<span class="label epreuve-validee">Les animaux · étape 1 sur 6<\/span>/)
  assert.match(validee, /<h1>Étape validée<\/h1>/)
  assert.match(validee, /<\/svg>Jouer l’étape 2<\/button>/)
  assert.match(validee, />Retour aux parcours<\/button>/)
  const ratee = await fin({ issue: 'ratee', justes: 3, fausses: 4 })
  assert.match(ratee, /<h1>Pas cette fois<\/h1>/)
  assert.match(ratee, /<\/svg>Réessayer<\/button>/)
  assert.match(await fin({ issue: 'validee', palier: 6, justes: 10, fausses: 0 }, { etoiles: 3 }), /<h1>Parcours accompli !<\/h1>/)
  // Ses mots, pas ceux des sentiers (ses classes, elles, gardent l'habit des épreuves).
  for (const html of [validee, ratee]) assert.doesNotMatch(html.replace(/<[^>]*>/g, ' '), /[Pp]alier|[Ss]entier/, 'ni palier ni sentier')
})

test('l’onglet « Apprendre » tient le carnet, puis les parcours — préchargés ensemble, joués sur place', () => {
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /\{\s*id: 'carnet',\s*nom: 'Apprendre',\s*icone: 'book',/)
  const carnet = readFileSync(client('views/Carnet.tsx'), 'utf8')
  assert.ok(carnet.indexOf('carnet-appris') < carnet.indexOf('<ParcoursDeTheme'), 'le carnet d’abord, les parcours dessous')
  // Le carnet ramassé, comme la maquette : ce qu'une révision rapporte tient sur une ligne, plus en trois pastilles.
  assert.doesNotMatch(carnet, /campagne-puces/)
  assert.match(carnet, /<p className="carnet-gains">/)
  // L'étape prend la place de la page, sans quitter l'onglet ; revenue, la page reprend aux parcours.
  assert.match(carnet, /if \(etape\) \{\s*return \(\s*<JeuDuParcours\s+key=\{etape\.id\}\s+depart=\{etape\}/)
  assert.match(carnet, /document\.getElementById\('parcours-titre'\)\?\.scrollIntoView\(\{ block: 'start' \}\)/)
  // Le carnet et les parcours demandés ensemble à l'ouverture : la règle du préchargement (`depart.test.ts`).
  assert.match(carnet, /api\.campagne\.carnet\s*\.etat\(\)[\s\S]*?api\.campagne\.sujets\s*\.etat\(\)/)
})

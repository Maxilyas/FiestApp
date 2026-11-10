// L'éditeur d'un quiz, au téléphone : une question tient sur un écran, et ce
// qu'on vient y faire — écrire l'intitulé et ses réponses — se voit d'abord.
//
// « Est ce que tu peux revoir l'onglet quiz maintenant ? Tu peux si tu le
// souhaites modifier la disposition et l'aspect si tu trouves cela
// nécessaire » (le propriétaire, le 10 novembre 2026). En 360 × 640, un QCM à
// quatre réponses faisait 1071 px de haut, son intitulé à 287 px du haut de sa
// carte, sous cinq rangées — son numéro, deux de sortes, deux de gestes ; celui
// de la première question n'arrivait qu'à 588 px, au bas du premier écran.
// Depuis : 541 px, l'intitulé à 69 px du haut de sa carte, celui de la première
// question à 250.
//
// Ce que l'écran montre se mesure au navigateur
// (`server/scripts/rendu-editeur.ts`, qui sort en erreur si la question type
// regrandit). Ici, ce qui le tient sans navigateur : la carte rendue telle
// qu'un téléphone et un ordinateur la reçoivent — chaque geste à son nom, dans
// son ordre —, la page de l'éditeur, et sa feuille : ce qui se resserre, ce qui
// ne se cache qu'à l'œil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import type { QuizQuestionDef } from '../../shared/library'

const source = (fichier: string) => readFileSync(new URL(`../../${fichier}`, import.meta.url), 'utf8')
const CSS = source('client/src/styles.css')
const EDITEUR = source('client/src/views/EditorApp.tsx')

/** La largeur sous laquelle l'éditeur se range en une colonne : la même dans la feuille et dans la carte. */
const TELEPHONE = '(max-width: 600px)'

type Ecran = 'telephone' | 'ordinateur'

/**
 * L'écran sur lequel la carte se rend. Elle n'en lit que la largeur
 * (`useTelephone`), pour ce que la feuille de style ne sait pas décider : un
 * repli ouvert ou fermé.
 */
function surUn(ecran: Ecran) {
  const lieu = { pathname: '/edit', search: '', hash: '', origin: 'http://banc' }
  Object.assign(globalThis, {
    // Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
    React,
    location: lieu,
    window: {
      location: lieu,
      matchMedia: (requete: string) => ({ media: requete, matches: ecran === 'telephone' && requete === TELEPHONE, addEventListener() {}, removeEventListener() {} }),
    },
  })
}

const rien = () => {}
const ACTIONS = { changer: rien, changerParId: rien, deplacer: rien, insererApres: rien, dupliquer: rien, supprimer: rien, uneAutre: async () => null }

/** Un QCM à quatre réponses, tiré de la base : il a « Une autre » parmi ses gestes. */
const QCM: QuizQuestionDef = {
  id: 'base-hist-042',
  kind: 'choice',
  text: 'La capitale de l’Australie ?',
  answers: ['Canberra', 'Sydney', 'Melbourne', 'Perth'],
  correct: 0,
  target: null,
  unit: '',
  duration: 20,
  image: null,
  observeSeconds: null,
  category: null,
}

/** La carte de la deuxième question d'un quiz de trois, qui mélange ses réponses — le cas où elle a tous ses gestes. */
async function carte(ecran: Ecran, question: Partial<QuizQuestionDef> = {}): Promise<string> {
  surUn(ecran)
  // Par son adresse : le typecheck du serveur ne lit pas le JSX.
  const { CarteDeQuestion } = await import(new URL('../../client/src/views/EditorApp.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(
    React.createElement(CarteDeQuestion, {
      index: 1,
      total: 3,
      question: { ...QCM, ...question },
      melange: true,
      piecesDisparues: [],
      souvenir: null,
      marche: 'difficile',
      spot: null,
      actions: ACTIONS,
    }),
  )
}

const enClair = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

/**
 * Ce qui se touche sur une carte, dans l'ordre, chacun par son nom : celui
 * qu'on entend (`aria-label`), sinon celui qu'on lit — le texte d'un bouton ou
 * d'un repli, l'invite d'un champ.
 */
function gestes(html: string): string[] {
  const noms: string[] = []
  for (const m of enClair(html).matchAll(/<(button|summary|textarea|select|input)\b([^>]*)>(?:([\s\S]*?)<\/\1>)?/g)) {
    const [, balise, attributs, dedans] = m
    if (/type="file"/.test(attributs)) continue
    const dit = /aria-label="([^"]*)"/.exec(attributs)?.[1]
    const lu = balise === 'button' || balise === 'summary' ? (dedans ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : /placeholder="([^"]*)"/.exec(attributs)?.[1]
    noms.push(dit ?? lu ?? balise)
  }
  return noms
}

/** Un morceau de la carte rendue, d'une classe à la suivante. */
function entre(html: string, debut: string, fin: string): string {
  const d = html.indexOf(`class="${debut}`)
  const f = html.indexOf(`class="${fin}`, d + 1)
  assert.ok(d >= 0 && f > d, `« ${debut} » puis « ${fin} » dans la carte`)
  return html.slice(d, f)
}

// ── La carte ────────────────────────────────────────────────────────────────

/** Les gestes d'un QCM, tels qu'ils se nommaient avant la retouche : aucun n'a disparu, aucun n'a changé de nom. */
const GESTES_D_UN_QCM = [
  'Question 2 sur 3, déplacer',
  'QCM',
  'Estimation',
  'Qui dans la salle ?',
  'Intitulé de la question 2',
  'La réponse 1 est la bonne',
  'Réponse 1',
  'La réponse 2 est la bonne',
  'Réponse 2',
  'La réponse 3 est la bonne',
  'Réponse 3',
  'La réponse 4 est la bonne',
  'Réponse 4',
  'Temps de réponse, en secondes',
  'Catégorie de la question',
  'Ajouter une photo',
  'Ajouter un son',
  'Plusieurs bonnes réponses',
  'À remettre dans l’ordre',
  'Garder cet ordre',
  'Mise de côté',
  'Anecdote, note, intertitre',
  'Elle ne devait rester que vingt ans…',
  'Raconte le voyage à Rome',
  'Manche 2 : le cinéma',
  'Ajouter',
  'Monter la question 2',
  'Descendre la question 2',
  'Insérer une question après la question 2',
  'Dupliquer la question 2',
  'Aperçu de la question 2',
  'Une autre question à la place de la question 2',
  'Supprimer la question 2',
]

test('la carte d’une question, de haut en bas : ce qu’on écrit d’abord, ses réglages, ses gestes au pied', async () => {
  for (const ecran of ['telephone', 'ordinateur'] as const) {
    const html = await carte(ecran)
    // Le même ordre sur les deux : la feuille de style resserre, elle ne déplace rien.
    const ordre = ['question-head', 'input question-texte', 'answers-edit', 'question-reglages', 'question-replis', 'question-gestes']
    const places = ordre.map(c => html.indexOf(`class="${c}`))
    assert.ok(places.every(p => p >= 0), `${ecran} : ${ordre.filter((_, i) => places[i] < 0).join(', ')}`)
    assert.deepEqual([...places].sort((a, b) => a - b), places, `${ecran} : la tête, l’intitulé, les réponses, les réglages, les replis, les gestes`)

    // La tête ne porte que le numéro, la marche et la sorte : en tête, ses sept gestes repoussaient l'intitulé à
    // 287 px du haut de sa carte sur un téléphone.
    assert.deepEqual(gestes(entre(html, 'question-head', 'input question-texte')), ['Question 2 sur 3, déplacer', 'QCM', 'Estimation', 'Qui dans la salle ?'], ecran)
    assert.match(entre(html, 'question-head', 'input question-texte'), /<span class="pill pill-marche"[^>]*>Difficile<\/span>/)
    // Ses réglages courants, deux à deux : le temps et la catégorie, la photo et l'extrait.
    assert.deepEqual(gestes(entre(html, 'question-champs', 'question-pieces')), ['Temps de réponse, en secondes', 'Catégorie de la question'], ecran)
    assert.deepEqual(gestes(entre(html, 'question-pieces', 'question-replis')), ['Ajouter une photo', 'Ajouter un son'], ecran)
    // Ses gestes ferment la carte : la déplacer et en ajouter une, puis la regarder, en tirer une autre, l'enlever.
    assert.deepEqual(
      gestes(html.slice(html.indexOf('class="question-gestes"'))),
      ['Monter la question 2', 'Descendre la question 2', 'Insérer une question après la question 2', 'Dupliquer la question 2', 'Aperçu de la question 2', 'Une autre question à la place de la question 2', 'Supprimer la question 2'],
      ecran,
    )
  }
})

test('aucun geste n’a disparu, aucun n’a changé de nom — au téléphone comme à l’ordinateur', async () => {
  assert.deepEqual(gestes(await carte('ordinateur')), GESTES_D_UN_QCM)
  // Le téléphone a les mêmes, et un repli de plus pour ranger ses réglages rares.
  const enPoche = gestes(await carte('telephone'))
  assert.deepEqual(enPoche.filter(g => g !== 'Plus de réglages'), GESTES_D_UN_QCM)
  assert.equal(enPoche[enPoche.indexOf('Plus de réglages') + 1], 'Plusieurs bonnes réponses', 'le repli s’ouvre sur ce qu’il range')

  // Ce qu'un téléphone montre en icône garde son nom, écrit dans le bouton : l'ordinateur le lit, le lecteur d'écran
  // d'un téléphone aussi — la feuille ne le cache qu'à l'œil.
  for (const ecran of ['telephone', 'ordinateur'] as const) {
    const html = await carte(ecran)
    for (const nom of ['Aperçu', 'Une autre', 'Supprimer']) assert.match(html, new RegExp(`<span class="question-geste-nom">${nom}</span></button>`), `${ecran} : ${nom}`)
    assert.match(html, /<span class="question-mot">Question <\/span>2<\/button>/, `${ecran} : « Question 2 », son mot dans la pastille`)
    // Chaque bascule dit son état — son icône devant, son nom entier.
    const icone = '<svg[^>]*>(?:<(path|circle|rect)[^>]*></\\1>)*</svg>'
    for (const bascule of ['QCM', 'Estimation', 'Qui dans la salle ?', 'Plusieurs bonnes réponses', 'À remettre dans l’ordre', 'Garder cet ordre', 'Mise de côté']) {
      assert.match(html, new RegExp(`<button[^>]*aria-pressed="(?:true|false)"[^>]*>${icone}${bascule.replace('?', '\\?')}</button>`), `${ecran} : ${bascule}`)
    }
  }

  // Une question écrite à la main n'a pas de voisine à tirer ; seule dans son quiz, son numéro ne se déplace pas.
  assert.ok(!gestes(await carte('telephone', { id: 'q-main' })).some(g => g.startsWith('Une autre')))
  surUn('telephone')
  const { CarteDeQuestion } = await import(new URL('../../client/src/views/EditorApp.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const seule = renderToStaticMarkup(React.createElement(CarteDeQuestion, { index: 0, total: 1, question: QCM, melange: false, piecesDisparues: [], souvenir: null, marche: null, spot: null, actions: ACTIONS }))
  assert.match(seule, /<span class="pill question-numero"><span class="question-mot">Question <\/span>1<\/span>/)
  assert.ok(!gestes(seule).includes('Garder cet ordre'), 'un quiz qui garde l’ordre écrit n’a rien à garder')
})

test('au téléphone, les réglages rares d’un QCM se rangent sous « Plus de réglages » — ouvert dès que l’un est posé', async () => {
  const repli = (html: string) => /<details class="question-plus"( open="")?><summary>(?:<svg[\s\S]*?<\/svg>)?([^<]*)<\/summary>/.exec(html)
  // Rien de posé : fermé, son nom seul.
  const ferme = repli(await carte('telephone'))
  assert.ok(ferme, 'le repli existe au téléphone')
  assert.equal(ferme[1], undefined, 'fermé tant que rien n’est posé')
  assert.equal(ferme[2], 'Plus de réglages')
  // Un réglage en vigueur ne se cache pas : le repli arrive ouvert, et dit combien.
  const poses: [string, Partial<QuizQuestionDef>, string][] = [
    ['plusieurs bonnes réponses', { variante: 'plusieurs', bonnes: [0, 2] }, 'Plus de réglages · 1'],
    ['à remettre dans l’ordre', { variante: 'ordre' }, 'Plus de réglages · 1'],
    ['son ordre gardé', { ordreFixe: true }, 'Plus de réglages · 1'],
    ['mise de côté', { deCote: true }, 'Plus de réglages · 1'],
    ['plusieurs, et de côté', { variante: 'plusieurs', bonnes: [1], deCote: true }, 'Plus de réglages · 2'],
  ]
  for (const [quoi, question, nom] of poses) {
    const ouvert = repli(await carte('telephone', question))
    assert.ok(ouvert, quoi)
    assert.equal(ouvert[1], ' open=""', `${quoi} : ouvert d’emblée`)
    assert.equal(ouvert[2], nom, quoi)
  }
  // Ses quatre pastilles sont dedans, dans leur groupe nommé.
  const dedans = entre(await carte('telephone'), 'question-plus', 'entourage')
  assert.deepEqual(gestes(dedans), ['Plus de réglages', 'Plusieurs bonnes réponses', 'À remettre dans l’ordre', 'Garder cet ordre', 'Mise de côté'])
  assert.match(dedans, /<div class="variantes" role="group" aria-label="Sorte du QCM 2">/)

  // À l'ordinateur, des pastilles à plat : pas de repli pour quatre boutons qui tiennent sur une rangée.
  assert.doesNotMatch(await carte('ordinateur'), /question-plus/)
  assert.doesNotMatch(await carte('ordinateur', { deCote: true }), /question-plus/)
  // Une estimation, un « Qui dans la salle ? » n'ont que la mise de côté à ranger : elle reste en vue, sans repli.
  for (const autre of [{ kind: 'number', target: 4806, unit: 'm' }, { variante: 'sondage', answers: [] }] as Partial<QuizQuestionDef>[]) {
    const html = await carte('telephone', autre)
    assert.doesNotMatch(html, /question-plus/)
    assert.deepEqual(gestes(entre(html, 'question-replis', 'entourage')), ['Mise de côté'])
  }
})

test('« Anecdote, note, intertitre » : ouvert d’emblée à l’ordinateur s’il est rempli, replié au téléphone, son compte à côté', async () => {
  const repli = (html: string) => /<details class="entourage"( open="")?><summary>(?:<svg[\s\S]*?<\/svg>)?([^<]*)<\/summary>/.exec(html)
  const rempli = { anecdote: 'Elle a été repeinte trois fois depuis.', note: 'Raconte le voyage.' }
  for (const ecran of ['telephone', 'ordinateur'] as const) {
    const vide = repli(await carte(ecran))
    assert.ok(vide, ecran)
    assert.equal(vide[1], undefined, `${ecran} : fermé tant qu’il est vide`)
    assert.equal(vide[2], 'Anecdote, note, intertitre')
    assert.equal(repli(await carte(ecran, rempli))?.[2], 'Anecdote, note, intertitre · 2', `${ecran} : il dit ce qu’il porte`)
  }
  assert.equal(repli(await carte('ordinateur', rempli))?.[1], ' open=""')
  // Ouvert, il ajoutait 391 px à chaque question d'un quiz tout prêt, qui arrivent toutes avec leur anecdote : au
  // téléphone, son compte suffit.
  assert.equal(repli(await carte('telephone', rempli))?.[1], undefined)
  // Replié, rien n'en est perdu : ses champs sont dans la page, avec ce qu'on y a écrit.
  assert.match(await carte('telephone', rempli), /<textarea[^>]*>Elle a été repeinte trois fois depuis\.<\/textarea>/)
})

test('une carte ne se redessine que si ce qu’elle montre change, et ne demande la largeur que pour ses replis', () => {
  assert.match(EDITEUR, /export const CarteDeQuestion = memo\(function CarteDeQuestion\(/)
  // Ce que la page lui passe : des valeurs stables, jamais une fonction ni un objet neufs à chaque rendu.
  const appel = /<CarteDeQuestion\b([\s\S]*?)\/>/.exec(EDITEUR)?.[1].replace(/\/\/[^\n]*/g, '')
  assert.ok(appel, 'la page rend ses cartes par CarteDeQuestion')
  const props = [...appel.matchAll(/^\s+(\w+)=\{/gm)].map(m => m[1])
  assert.deepEqual(props, ['key', 'index', 'total', 'question', 'melange', 'piecesDisparues', 'souvenir', 'marche', 'spot', 'actions'])
  assert.doesNotMatch(appel, /=>|=\{\{|=\{\[/, 'ni fonction, ni objet, ni liste écrits dans l’appel')
  // La largeur se lit dans la carte, par la même borne que la feuille.
  assert.ok(EDITEUR.includes(`const TELEPHONE = '${TELEPHONE}'`))
  assert.match(EDITEUR, /function QuestionCard\([\s\S]*?const telephone = useTelephone\(\)/)
  assert.equal(EDITEUR.match(/= useTelephone\(\)/g)?.length, 1, 'une seule lecture, dans la carte : la page ne se redessine pas pour elle')
})

// ── La page ─────────────────────────────────────────────────────────────────

test('entre l’en-tête et la première question, une seule rangée ; ce que le quiz a à dire se lit sous les questions', () => {
  const debut = EDITEUR.indexOf('<div className="editor editeur-quiz">')
  assert.ok(debut >= 0, 'la page de l’éditeur porte sa classe : « Mes quiz », qui porte « editor » aussi, ne se resserre pas avec elle')
  // Sans ses commentaires : ils nomment ce qu'ils expliquent, avant lui.
  const page = EDITEUR.slice(debut, EDITEUR.indexOf('\nfunction ReglerToutLeQuiz('))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
  const place = (texte: string) => {
    const i = page.indexOf(texte)
    assert.ok(i >= 0, `« ${texte} » dans la page de l’éditeur`)
    return i
  }
  const ordre = [
    '<header className="editor-header is-collant">',
    '<main className="page-corps">',
    '<div className="row editor-outils">',
    'Régler tout le quiz',
    'className="muted small editor-enregistre">Enregistré {quand(savedAt)}',
    '<CarteDeQuestion',
    'le podium de ce quiz ne rapportera pas',
    '<div className="row en-premier">',
    'Mélanger les réponses à chaque partie',
    'Ajouter une question',
    'Coller une liste',
  ].map(place)
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'dans cet ordre')
  // L'heure de l'enregistrement ne prend plus sa ligne : elle descendait chaque carte de 36 px à chaque « Enregistrer ».
  assert.equal(page.match(/Enregistré \{quand\(savedAt\)\}/g)?.length, 1)

  // L'en-tête : où en est le quiz d'un côté — ce qui manque ou ce qui est prêt, puis sa durée —, « Enregistrer » de l'autre.
  const entete = page.slice(0, page.indexOf('</header>'))
  const etat = entete.slice(entete.indexOf('<div className="editor-etat">'), entete.indexOf('<button className="btn btn-primary"'))
  assert.ok(etat.includes('a-completer') && etat.includes('prête') && etat.includes('duree-quiz'), 'l’état du quiz tient dans son cadre')
  assert.ok(entete.indexOf('<div className="editor-etat">') > entete.indexOf('aria-label="Titre du quiz"'))
})

// ── La feuille ──────────────────────────────────────────────────────────────

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Le corps de la première règle de la feuille dont le sélecteur est exactement celui-ci. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|\\})\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

/** Les règles d'un bloc `@media`, à partir d'un repère de la feuille : chacune ses sélecteurs et ses déclarations. */
function reglesDuBloc(repere: string, requete: string): { selecteurs: string[]; corps: string }[] {
  const depuis = CSS.indexOf(repere)
  assert.ok(depuis >= 0, `le repère « ${repere} » de styles.css`)
  const suite = sansCommentaires(CSS.slice(depuis).replace(/^[^]*?\*\//, ''))
  const debut = suite.indexOf(`${requete} {`)
  assert.ok(debut >= 0, `le bloc ${requete} après « ${repere} »`)
  let niveau = 0
  let fin = -1
  for (let i = suite.indexOf('{', debut); i < suite.length && fin < 0; i++) {
    if (suite[i] === '{') niveau++
    else if (suite[i] === '}' && --niveau === 0) fin = i
  }
  assert.ok(fin > 0, `le bloc ${requete} se ferme`)
  return [...suite.slice(suite.indexOf('{', debut) + 1, fin).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({
    selecteurs: m[1].split(',').map(s => s.trim()),
    corps: m[2].trim(),
  }))
}

const BLOC = 'L\'éditeur d\'un quiz, au téléphone'
const telephone = () => reglesDuBloc(BLOC, `@media ${TELEPHONE}`)
/** Ce qu'un téléphone déclare pour ce sélecteur, toutes ses règles réunies. */
const auTelephone = (selecteur: string): string => {
  const corps = telephone().filter(r => r.selecteurs.includes(selecteur)).map(r => r.corps)
  assert.ok(corps.length, `le téléphone règle ${selecteur}`)
  return corps.join(' ')
}

test('la feuille : le téléphone se règle dans le bloc de l’éditeur, sous sa classe, et « Mes quiz » n’en sait rien', () => {
  const regles = telephone()
  assert.ok(regles.length > 40, `le bloc tient la carte entière (${regles.length} règles)`)
  for (const r of regles) for (const s of r.selecteurs) assert.match(s, /^\.editeur-quiz(?:$|[ :])/, `${s} : sous la classe de la page de l’éditeur`)
  // Ses mesures sont des variables, posées sur la page : une rangée fait la hauteur d'un doigt.
  assert.match(auTelephone('.editeur-quiz'), /--eq-rang:\s*44px/)
  // Il vit dans la section de l'éditeur, pas en fin de feuille : avant les animations, après la carte d'une question.
  const ou = CSS.indexOf(BLOC)
  assert.ok(ou > CSS.indexOf('\n.question-card {') && ou < CSS.indexOf('ANIMATIONS'), 'à sa place dans la feuille')
  assert.equal(CSS.split(BLOC).length, 2, 'un seul bloc')
})

test('ce qu’un téléphone tait se cache à l’œil seulement, jamais par display: none', () => {
  const cache = [...regle('.sr-only').matchAll(/([\w-]+):\s*([^;]+);/g)].map(m => `${m[1]}: ${m[2].trim()}`)
  assert.equal(cache.length, 6, 'les six déclarations de .sr-only')
  // Le mot « Question » devant son numéro, le nom de l'aperçu, d'« Une autre » et de « Supprimer » sous leur icône.
  for (const tu of ['.editeur-quiz .question-mot', '.editeur-quiz .question-geste-nom']) {
    for (const declaration of cache) assert.ok(auTelephone(tu).includes(declaration), `${tu} : ${declaration}`)
  }
  for (const r of telephone()) assert.doesNotMatch(r.corps, /display:\s*none/, r.selecteurs.join(', '))
  // Dans l'en-tête, la flèche de « 2 à compléter » de même : la rangée collée n'en fait qu'une.
  const entete = reglesDuBloc('Où en est le quiz — ce qui est prêt', `@media ${TELEPHONE}`)
  const dansLEntete = (selecteur: string) => entete.filter(r => r.selecteurs.includes(selecteur)).map(r => r.corps).join(' ')
  for (const declaration of cache) assert.ok(dansLEntete('.editor-header .a-completer > .icon:last-child').includes(declaration), `la flèche : ${declaration}`)
  // Et la durée ne se montre que si elle tient à la suite de « prêtes » : une rangée qui passe à la ligne, haute
  // d'une seule, coupée au-delà — jamais retirée de la page, que le lecteur d'écran lit toujours.
  const etat = dansLEntete('.editor-etat')
  assert.match(etat, /flex-wrap:\s*wrap/)
  assert.match(etat, /height:\s*44px/)
  assert.match(etat, /overflow:\s*clip/)
  for (const r of entete) assert.doesNotMatch(r.corps, /display:\s*none/, r.selecteurs.join(', '))
})

test('sous l’encoche d’un iPhone, la rangée collée s’arrête sous elle, et le titre passe derrière le cache de la page', () => {
  // L'application installée va jusqu'en haut de l'écran (`viewport-fit=cover`) : le titre commençait à 22 px, sous
  // l'encoche, et la rangée collée s'y glissait. Le cache — haut comme elle, collé en haut, au-dessus de l'en-tête —
  // tient le titre dessous au repos, et le couvre quand il s'en va ; sans encoche, il ne fait aucune hauteur.
  const cache = auTelephone('.editeur-quiz::before')
  assert.match(cache, /position:\s*sticky;\s*top:\s*0/)
  assert.match(cache, /height:\s*env\(safe-area-inset-top, 0px\)/)
  assert.match(cache, /background:\s*var\(--bg\)/)
  const entete = reglesDuBloc('Où en est le quiz — ce qui est prêt', `@media ${TELEPHONE}`)
  const colle = entete.filter(r => r.selecteurs.includes('.editor-header.is-collant')).map(r => r.corps).join(' ')
  // La rangée collée commence où le cache finit : le `top` de l'en-tête est l'encoche, moins ce qui s'en va (62 px).
  assert.match(colle, /top:\s*calc\(env\(safe-area-inset-top, 0px\) - 62px\)/)
  // Le cache passe devant l'en-tête, qui passe devant la page.
  const devant = Number(/z-index:\s*(\d+)/.exec(cache)?.[1])
  const enTete = Number(/z-index:\s*(\d+)/.exec(regle('.editor-header.is-collant'))?.[1])
  assert.ok(devant > enTete, `le cache (${devant}) devant l’en-tête (${enTete})`)
  // Et la page ne garde au-dessus du titre que ce que l'encoche ne tient pas déjà : jamais un vide sous lui.
  assert.match(auTelephone('.editeur-quiz'), /padding:\s*max\(0px, 12px - env\(safe-area-inset-top, 0px\)\)/)
  assert.doesNotMatch(entete.map(r => r.corps).join(' '), /margin-bottom:[^;]*safe-area/)
})

test('chaque rangée de la carte fait la hauteur d’un doigt, et rien ne s’écrit trop petit', () => {
  // Ce qui se touche prend la hauteur d'une rangée (44 px).
  for (const cible of [
    '.editeur-quiz .kind-toggle .pill-btn',
    '.editeur-quiz .answer-edit',
    '.editeur-quiz .answer-edit .input',
    '.editeur-quiz .categorie-select',
    '.editeur-quiz .question-plus > summary',
    '.editeur-quiz .entourage > summary',
    '.editeur-quiz .question-rares .pill-btn',
    '.editeur-quiz .question-gestes .btn-small',
  ]) {
    assert.match(auTelephone(cible), /min-height:\s*var\(--eq-rang\)/, cible)
  }
  // Un geste en icône est aussi large que haut.
  assert.match(auTelephone('.editeur-quiz .question-gestes .btn-small'), /min-width:\s*var\(--eq-rang\)/)
  // Le numéro, une pastille de 32 px, se touche sur 44 : sa boîte de toucher dépasse de lui (son cadre d'un pixel compris).
  const pastille = Number(/min-height:\s*(\d+)px/.exec(auTelephone('.editeur-quiz .question-numero'))?.[1])
  const depasse = Number(/inset:\s*-(\d+)px/.exec(auTelephone('.editeur-quiz .pill-button.question-numero::after'))?.[1])
  assert.ok(pastille - 2 + 2 * depasse >= 44, `le numéro se touche sur ${pastille - 2 + 2 * depasse} px`)

  // Aucun texte sous l'étiquette (`--t-label`, 11 px à la taille ordinaire), et tout en `rem` : il suit le texte agrandi.
  const plancher = Number(/--t-label:\s*([\d.]+)rem/.exec(CSS)?.[1])
  assert.equal(plancher, 0.6875)
  const tailles = telephone().flatMap(r => [...r.corps.matchAll(/font-size:\s*([^;]+);/g)].map(m => ({ sur: r.selecteurs, taille: m[1].trim() })))
  assert.ok(tailles.length >= 5)
  for (const { sur, taille } of tailles) {
    const ou = sur.join(', ')
    const rem = /^([\d.]+)rem$/.exec(taille)
    assert.ok(rem, `${ou} : ${taille} s’écrit en rem`)
    assert.ok(Number(rem[1]) >= plancher, `${ou} : ${taille}`)
    // Un champ où l'on écrit ne descend pas sous 16 px : iOS agrandirait la page au toucher.
    if (sur.some(s => /(\.input|textarea|select|-area|-input)$/.test(s))) assert.ok(Number(rem[1]) >= 1, `${ou} : un champ à ${taille}`)
  }
  // La liste collée s'écrivait à 14,4 px.
  assert.match(auTelephone('.editeur-quiz .import-area'), /font-size:\s*1rem/)
})

test('la feuille de tous les écrans : les gestes au pied sous un filet, l’intitulé qui grandit avec son texte', () => {
  assert.match(regle('.question-gestes'), /border-top:\s*1px solid var\(--edge\)/)
  // L'aperçu, « Une autre » et « Supprimer » à droite, à l'écart de ce qui déplace.
  assert.match(regle('.question-geste-fin'), /margin-left:\s*auto/)
  assert.match(regle('.question-texte'), /field-sizing:\s*content/)
  // La tête n'écarte plus deux rangées de boutons : le numéro, puis la sorte, à la file.
  assert.doesNotMatch(regle('.question-head'), /space-between/)
  // Une tablette garde la carte d'un ordinateur, sous le doigt : ce qui s'y touche fait 44 px aussi.
  const tablette = reglesDuBloc('Une tablette garde la carte d\'un ordinateur', '@media (pointer: coarse) and (min-width: 601px)')
  const sur = (selecteur: string) => tablette.filter(r => r.selecteurs.includes(selecteur)).map(r => r.corps).join(' ')
  assert.match(sur('.editeur-quiz .categorie-select'), /min-height:\s*44px/)
  assert.match(sur('.editeur-quiz .observe-edit > .row'), /min-height:\s*44px/)
  // Le repli de ce qui entoure la question garde sa hauteur à l'œil : sa boîte de toucher dépasse de lui.
  const repli = Number(/min-height:\s*(\d+)px/.exec(regle('.entourage > summary'))?.[1])
  const depasse = Number(/inset:\s*-(\d+)px 0/.exec(sur('.editeur-quiz .entourage > summary::after'))?.[1])
  assert.ok(repli + 2 * depasse >= 44, `le repli se touche sur ${repli + 2 * depasse} px`)
})

test('« Régler tout le quiz », au téléphone : chaque réglage sous son nom, ses deux choix côte à côte', () => {
  // Ce que la feuille resserre tient à la forme du panneau : trois groupes nommés, chacun son nom puis ses deux choix.
  const panneau = EDITEUR.slice(EDITEUR.indexOf('\nfunction ReglerToutLeQuiz('), EDITEUR.indexOf('\nfunction QuestionPreview('))
  const groupes = [...panneau.matchAll(/<div className="row" role="group" aria-label="([^"]+)">\s*<span className="muted">([^<]+)<\/span>/g)].map(m => [m[1], m[2]])
  assert.deepEqual(groupes, [
    ['Ordre des réponses', 'Réponses'],
    ['Ordre des questions', 'Questions'],
    ['Combien de questions à chaque partie', 'Par partie'],
  ])
  for (const choix of ['Dans l’ordre écrit', 'Mélangées à chaque partie', 'Tirées dans un autre ordre', 'Toutes les questions', 'Un tirage au hasard', 'Pour toutes', 'Fermer']) {
    assert.ok(panneau.includes(choix), `« ${choix} » y est toujours`)
  }
  // Le nom d'un groupe prend sa ligne, ses deux choix se partagent la suivante ; le temps et la catégorie gardent
  // « Pour toutes » à côté de leur champ.
  assert.match(auTelephone(".editeur-quiz .regler-tout > .row[role='group'] > .muted"), /flex-basis:\s*100%/)
  assert.match(auTelephone(".editeur-quiz .regler-tout > .row[role='group'] > .pill-btn"), /flex:\s*1 1 0/)
  assert.match(auTelephone('.editeur-quiz .regler-tout > .row > label.row'), /flex:\s*1 1 0/)
  assert.match(auTelephone('.editeur-quiz .regler-tout > .row > .btn-small'), /flex:\s*none/)
})

test('l’aperçu d’une question, au téléphone : les deux colonnes de l’écran commun, en plus petit', () => {
  // À 18 px dans des cases de 132, une réponse d'un mot se coupait par syllabes (« Can-berra », « Mel-bour-ne » sur
  // trois lignes). Le bloc suit la règle de base de l'aperçu, et ne vaut que sous 600 px de large.
  const apres = CSS.slice(CSS.indexOf('.preview-frame .row { justify-content: space-between; }'))
  const bloc = /^[^@]*@media \(max-width: 600px\) \{([\s\S]*?)\n\}/.exec(apres)?.[1]
  assert.ok(bloc, 'le bloc du téléphone suit les règles de l’aperçu')
  assert.match(bloc, /\.preview-stage \.ans-btn \{ min-height: 60px; gap: 8px; padding: 6px 10px; font-size: 0\.95rem; \}/)
  assert.match(bloc, /\.preview-stage \.ans-grid \{ gap: 8px; \}/)
  // Deux colonnes toujours : c'est l'écran commun qu'on regarde, en réduction.
  assert.doesNotMatch(bloc, /grid-template-columns/)
})

// ── Le script qui le mesure ─────────────────────────────────────────────────

test('le script de rendu garde ce qui a été atteint, et sort par le code de sortie de Node', () => {
  const script = source('server/scripts/rendu-editeur.ts')
  // Une question type sous 620 px en 360 × 640 : la cible de la retouche. Le plafond du script est ce qui a été
  // atteint, plus bas encore.
  const plafonds = /type: \{ telephone: (\d+), tablette: (\d+), portable: (\d+) \}/.exec(script)
  assert.ok(plafonds, 'les plafonds de la question type, par sorte d’écran')
  assert.ok(Number(plafonds[1]) < 620, `au téléphone, ${plafonds[1]} px au plus`)
  assert.ok(Number(plafonds[3]) < 526, `au portable, ${plafonds[3]} px au plus : moins qu’avant la retouche`)
  for (const faute of ['LA QUESTION TYPE FAIT', 'SOUS LA MOITIÉ DE L’ÉCRAN', 'CIBLE SOUS', 'TEXTE SOUS 11 PX', 'CHAMP SOUS', 'LA PAGE DÉBORDE', 'UNE RÉPONSE D’UN MOT SE COUPE']) {
    assert.ok(script.includes(faute), `le script sait dire « ${faute} »`)
  }
  assert.match(script, /process\.exitCode = 1/)
  // Jamais `process.exit()` : ce qu'il vient d'écrire ne serait pas toujours parti (règle `tests.md`).
  assert.doesNotMatch(script.replace(/\/\/[^\n]*/g, ''), /process\.exit\(/)
  // Ni la photo d'une page entière ni celle d'un élément, qui peut dépasser de l'écran : elles rendent au téléphone
  // émulé un pointeur de souris, et la page photographiée n'est plus celle qu'on vient de mesurer.
  assert.doesNotMatch(script.replace(/\/\/[^\n]*/g, ''), /fullPage|locator\([^)]*\)\.screenshot/)
})

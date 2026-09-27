// Mission « bibliothèque » — l'aller-retour « Copier en liste » → « Coller une liste ».
//
// `ecrireListe` promet (shared/liste.ts) que la liste se recolle « à
// l'identique », sauf les photos qui « reviennent attendues ». Ces épreuves
// décrivent le comportement voulu : elles échouent aujourd'hui là où
// l'aller-retour perd ou abîme quelque chose.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/bibliotheque/aller-retour-liste.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyQuestion,
  normalizeQuestions,
  parseImportedQuestions,
  toPlayable,
  type QuizQuestionDef,
} from '../../../shared/library'
import { ecrireListe } from '../../../shared/liste'
import { CATEGORIES } from '../../../shared/categories'
import { suiteFixe } from '../../../shared/hasard'

/** Ce qu'« Enregistrer » garde de ces questions : le point de départ réel de « Copier en liste ». */
const enregistre = (qs: Partial<QuizQuestionDef>[]) => normalizeQuestions(qs.map(q => ({ ...emptyQuestion(), ...q })))

const recolle = (qs: QuizQuestionDef[], titre?: string) => parseImportedQuestions(ecrireListe(qs, titre))

// ── 1. Une anecdote sur deux lignes ──────────────────────────────────────
//
// L'anecdote et la note se tapent dans un <textarea> (EditorApp.tsx:3324,
// :3335) : Entrée y fait un retour à la ligne, que `normalizeQuestions`
// garde (`texteLibre` ne replie que les espaces et les tabulations).
// `ecrireListe` l'écrit tel quel derrière « Anecdote : » — la seconde ligne
// devient une réponse au recollage.

test('une anecdote sur deux lignes se recolle sans devenir une réponse', () => {
  const [q] = enregistre([
    {
      text: 'La tour Eiffel devait être démontée.',
      answers: ['Vrai', 'Faux', '', ''],
      correct: 0,
      anecdote: 'Elle ne devait rester que vingt ans.\nLa radio l’a sauvée.',
    },
  ])
  assert.ok(q.anecdote?.includes('\n'), 'le serveur garde le retour à la ligne tapé dans le textarea')
  const relu = recolle([q])
  assert.equal(relu.questions.length, 1)
  const r = relu.questions[0]
  assert.deepEqual(
    r.answers.filter(Boolean),
    ['Vrai', 'Faux'],
    `les réponses recollées : ${JSON.stringify(r.answers)} — correct = ${r.correct}`,
  )
})

test('une note sur deux paragraphes ne coupe pas la question en deux', () => {
  const [q] = enregistre([
    {
      text: 'Quelle est la capitale de l’Australie ?',
      answers: ['Sydney', 'Canberra', 'Melbourne', 'Perth'],
      correct: 1,
      note: 'Demande à Julie.\n\nElle y a vécu deux ans.',
    },
  ])
  const relu = recolle([q])
  assert.deepEqual(
    relu.questions.map(x => [x.text, x.answers, x.correct]),
    [[q.text, q.answers, q.correct]],
    `recollé : ${JSON.stringify(relu.questions.map(x => [x.text, x.answers, x.correct]))} · ignorés : ${JSON.stringify(relu.ignores)}`,
  )
})

test('« dans l’ordre » : une anecdote sur deux lignes ne s’ajoute pas au bon ordre', () => {
  const [q] = enregistre([
    {
      text: 'Remettez ces inventions dans l’ordre.',
      variante: 'ordre',
      answers: ['L’imprimerie', 'La machine à vapeur', 'Le téléphone', ''],
      anecdote: 'Gutenberg, vers 1450.\nBell, en 1876.',
    },
  ])
  const r = recolle([q]).questions[0]
  assert.deepEqual(r.answers.filter(Boolean), ['L’imprimerie', 'La machine à vapeur', 'Le téléphone'], JSON.stringify(r.answers))
})

// ── 2. Ce que la liste ne dit pas, et qui compte ─────────────────────────

test('une question mise de côté reste de côté au recollage', () => {
  const [q] = enregistre([{ text: 'Trop dure pour ce soir ?', answers: ['a', 'b', '', ''], correct: 0, deCote: true }])
  assert.equal(toPlayable(q), null, 'de côté : elle ne se joue pas')
  const r = recolle([q]).questions[0]
  assert.equal(toPlayable(r), null, 'recollée, elle se jouerait : « de côté » n’a pas voyagé')
})

test('un blind test recollé attend son extrait, comme une question attend sa photo', () => {
  const [q] = enregistre([
    { text: 'Quel est ce titre ?', answers: ['Macarena', 'Mambo n° 5', '', ''], correct: 0, son: '/media/image/0f3c2a64-9d1e-4b8a-8f0e-5a1b2c3d4e5f' },
  ])
  assert.ok(q.son)
  const r = recolle([q]).questions[0]
  // La photo de la question revient « attendue » et la question ne se joue
  // plus ; l'extrait, lui, disparaît sans un mot et la question reste prête.
  assert.equal(toPlayable(r), null, 'recollé, le blind test se joue sans extrait, et rien ne le dit')
})

test('la photo de la révélation s’annonce, comme celle de la question', () => {
  const [q] = enregistre([
    {
      text: 'Qui est ce bébé ?',
      answers: ['Julie', 'Marc', '', ''],
      correct: 0,
      imageRevelation: '/media/image/0f3c2a64-9d1e-4b8a-8f0e-5a1b2c3d4e5f',
    },
  ])
  const texte = ecrireListe([q])
  assert.match(texte, /révélation/i, `la liste ne dit rien de la photo de la révélation :\n${texte}`)
})

test('une réponse « - de 10 » ou « + de 20 » garde son signe', () => {
  const [q] = enregistre([
    { text: 'Combien de fois Julie a-t-elle déménagé ?', answers: ['- de 5', '5 à 10', '+ de 10', ''], correct: 2 },
  ])
  const r = recolle([q]).questions[0]
  assert.deepEqual(r.answers, q.answers, `recollées : ${JSON.stringify(r.answers)}`)
})

// ── 3. Un test de propriété ─────────────────────────────────────────────
//
// Des quiz fabriqués au hasard (graine fixe), dans ce que l'éditeur laisse
// écrire : intitulés, réponses, variantes, estimations, temps, catégories,
// ordre fixe, anecdote/note/intertitre (sur une ligne), photos. On compare
// ce que la liste promet de garder. Les écarts sont rangés par champ.

// Ce qu'on tape vraiment dans une case de réponse — dont « - de 5 » et « + de 10 »,
// qu'une question sur un âge ou un nombre appelle naturellement.
const MOTS = ['Paris', 'Lyon', 'Vrai', 'Faux', 'Le Mans', 'Dune', '1984', '3,14', 'Ça', 'Élise', 'Où ?', 'Macarena', 'Aucune de ces réponses', '🎂 Gâteau', 'Photo : la plage', 'A. Lincoln', 'Réponse : B', '#1 des ventes', '- de 5', '+ de 10', '12 %', '-40 °C']
const INTITULES = ['Quelle est la capitale ?', 'Combien de marches ?', '# Quiz musical ?', 'Temps : 30 s', '2. étape ?', 'Qui a dit « bonjour » ?', 'Titre : un film ?', '1984 est un roman de ?', 'Q7 est une voiture ?', '🎂 Quel âge ?', 'Photo : qui est-ce ?']
const UNITES = ['', 'm', 'km', '€', 'ans', '°C', 'kg', '%', 'bougies']
const CIBLES = [0, 1, 27, 1889, 8849, -41.5, 0.8, 35000, 1e21, -1.5e-7, 12.25, 1000000]

function fabriquer(graine: number): QuizQuestionDef[] {
  const h = suiteFixe(graine)
  const de = <T,>(xs: readonly T[]): T => xs[Math.floor(h() * xs.length)]
  const n = 1 + Math.floor(h() * 6)
  const qs: Partial<QuizQuestionDef>[] = []
  for (let i = 0; i < n; i++) {
    const commun: Partial<QuizQuestionDef> = {
      text: de(INTITULES) + (h() < 0.3 ? ` ${i}` : ''),
      duration: de([10, 20, 20, 30, 45, 120]),
      category: h() < 0.5 ? de(CATEGORIES) : null,
      ...(h() < 0.2 && { anecdote: `Le saviez-vous ${i} ?` }),
      ...(h() < 0.2 && { note: `Pour moi ${i}` }),
      ...(h() < 0.15 && { intertitre: `Manche ${i}` }),
      ...(h() < 0.15 && { photoAttendue: `photo-${i}.jpg` }),
    }
    const sorte = h()
    if (sorte < 0.25) {
      qs.push({ ...commun, kind: 'number', target: de(CIBLES), unit: de(UNITES) })
    } else if (sorte < 0.3) {
      qs.push({ ...commun, kind: 'number', enDirect: true, target: null, unit: de(UNITES) })
    } else {
      const nb = 2 + Math.floor(h() * 3)
      const answers = Array.from({ length: 4 }, (_, k) => (k < nb ? `${de(MOTS)}${h() < 0.5 ? ` ${k}` : ''}` : ''))
      // Des réponses distinctes : deux cases identiques ne se distinguent pas à la relecture non plus.
      const vues = new Set<string>()
      for (let k = 0; k < 4; k++) if (answers[k] && vues.has(answers[k])) answers[k] = `${answers[k]} bis${k}`; else vues.add(answers[k])
      const v = h()
      if (v < 0.12) qs.push({ ...commun, variante: 'plusieurs', answers, bonnes: [0, nb - 1] })
      else if (v < 0.22 && nb >= 3) qs.push({ ...commun, variante: 'ordre', answers, correct: -1 })
      else if (v < 0.27) qs.push({ ...commun, variante: 'sondage', answers: ['', '', '', ''], correct: -1 })
      else qs.push({ ...commun, answers, correct: Math.floor(h() * nb), ...(h() < 0.15 && { ordreFixe: true }) })
    }
  }
  return enregistre(qs)
}

/** Ce que la liste promet de garder d'une question. */
function promesse(q: QuizQuestionDef) {
  const remplies = q.answers.map(a => a.trim()).filter(Boolean)
  return {
    text: q.text.trim(),
    kind: q.kind,
    variante: q.variante ?? null,
    reponses: q.kind === 'number' || q.variante === 'sondage' ? null : remplies,
    bonne: q.kind === 'number' || q.variante ? null : q.correct >= 0 ? (q.answers[q.correct] ?? '').trim() || null : null,
    bonnes: q.variante === 'plusieurs' ? (q.bonnes ?? []).map(i => q.answers[i]).filter(Boolean) : null,
    cible: q.kind === 'number' && !q.enDirect ? q.target : null,
    unite: q.kind === 'number' ? q.unit.trim() : null,
    enDirect: q.kind === 'number' ? !!q.enDirect : null,
    duree: q.duration,
    categorie: q.category ?? null,
    ordreFixe: q.kind === 'choice' && q.variante !== 'ordre' ? !!q.ordreFixe : null,
    anecdote: q.anecdote ?? null,
    note: q.note ?? null,
    intertitre: q.intertitre ?? null,
    photo: !!(q.image || q.photoAttendue),
  }
}

test('propriété : 400 quiz fabriqués au hasard se recollent comme ils ont été copiés', () => {
  const ecarts = new Map<string, string[]>()
  for (let graine = 1; graine <= 400; graine++) {
    const qs = fabriquer(graine)
    const relu = recolle(qs, `Quiz ${graine}`)
    const attendu = qs.filter(q => q.text.trim()).map(promesse)
    const obtenu = relu.questions.map(promesse)
    if (relu.titre !== `Quiz ${graine}`) (ecarts.get('titre') ?? ecarts.set('titre', []).get('titre')!).push(`graine ${graine}`)
    if (obtenu.length !== attendu.length) {
      ;(ecarts.get('nombre') ?? ecarts.set('nombre', []).get('nombre')!).push(`graine ${graine} : ${attendu.length} → ${obtenu.length}`)
      continue
    }
    attendu.forEach((a, i) => {
      for (const cle of Object.keys(a) as (keyof typeof a)[]) {
        if (JSON.stringify(a[cle]) !== JSON.stringify(obtenu[i][cle])) {
          const liste = ecarts.get(cle) ?? ecarts.set(cle, []).get(cle)!
          liste.push(`graine ${graine} q${i + 1} : ${JSON.stringify(a[cle])} → ${JSON.stringify(obtenu[i][cle])}`)
        }
      }
    })
  }
  const resume = [...ecarts].map(([cle, cas]) => `${cle} : ${cas.length} écart(s), p. ex. ${cas.slice(0, 3).join(' | ')}`)
  assert.deepEqual(resume, [], resume.join('\n'))
})

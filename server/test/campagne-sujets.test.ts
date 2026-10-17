// Une série sur un sujet qui traverse les douze catégories — une époque, la
// France, les pionnières — (un retour de joueur du 10 octobre 2026 : jouer
// « au-delà des douze catégories »). Les sujets se lisent sur les
// métadonnées que chaque question porte déjà (`shared/sujets.ts`) : pas une
// question de plus à écrire. Une série à sujet n'est pas une série de toutes
// les catégories : la Grande Série ne la compte pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { hautsFaitsDeLaSerie } from '../src/core/campagne'
import { FAMILLES_DE_SUJETS, SUJETS, sujetsDe } from '../../shared/sujets'
import { ETIQUETTES, SOUS_THEMES } from '../../shared/etiquettes'
import { NIVEAUX, niveauDeQuestion, type Niveau } from '../../shared/campagne'
import type { Categorie } from '../../shared/categories'

// ── Le catalogue, pur ───────────────────────────────────────────────────────

const meta = (date: { valeur: string; precision: string } | null, etiquettes: string[] = [], portee = 'monde', categorie = 'Histoire', sousTheme = 'civilisations') =>
  ({ date, etiquettes, portee, categorie, sousTheme }) as Parameters<typeof sujetsDe>[0]

test('une question est d’une époque par sa date, d’un fil rouge par ses étiquettes ou sa portée', () => {
  assert.deepEqual(sujetsDe(meta({ valeur: '1985-06', precision: 'mois' }, ['record'], 'france')), ['annees-80', 'france', 'records'])
  // Une décennie s'écrit par sa première année : elle tombe dans la sienne.
  assert.deepEqual(sujetsDe(meta({ valeur: '1980', precision: 'decennie' })), ['annees-80'])
  assert.deepEqual(sujetsDe(meta({ valeur: '-27', precision: 'annee' })), ['avant-1800'])
  assert.deepEqual(sujetsDe(meta({ valeur: '1889-03-31', precision: 'jour' })), ['xixe'])
  // Au siècle près, « 1801 » dit tout le XIXe : elle n'est d'aucune époque.
  assert.deepEqual(sujetsDe(meta({ valeur: '1801', precision: 'siecle' })), [])
  assert.deepEqual(sujetsDe(meta(null, ['idee-recue', 'contes-legendes'])), ['mythes-legendes', 'insolite', 'enfance'])
  assert.deepEqual(sujetsDe(meta(null)), [])
})

// Un thème (le souhait du propriétaire du 11 octobre 2026 : « prévoir pour
// l'avenir de rajouter des thèmes ») se lit sur les sous-thèmes de sa
// catégorie, et au-delà sur une étiquette que toutes portent.
test('une question est d’un thème par son sous-thème, dans sa catégorie, ou par une étiquette qui traverse les catégories', () => {
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Nature', 'oiseaux')), ['animaux'])
  // Un animal au cinéma : l'étiquette le range avec les animaux.
  assert.deepEqual(sujetsDe(meta(null, ['animaux'], 'monde', 'Cinéma & séries', 'sagas')), ['animaux'])
  // Les plantes ne sont pas des animaux, et un sous-thème ne vaut que dans sa catégorie.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Nature', 'plantes')), [])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Histoire', 'espace')), [])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Géographie', 'reliefs')), ['terre-espace'])
  // Un thème se croise avec une époque et un fil rouge : chacun le sien.
  assert.deepEqual(sujetsDe(meta({ valeur: '1998', precision: 'annee' }, ['coupe-du-monde', 'record'], 'france', 'Sport', 'football')), ['grands-rendez-vous', 'annees-90', 'france', 'records'])
  // Le petit écran (le 11 octobre 2026) : les séries du cinéma et la télévision des jeux, un écran pour deux catégories.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Cinéma & séries', 'series')), ['petit-ecran'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Jeux & pop culture', 'tele')), ['petit-ecran'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Cinéma & séries', 'cinema-fr')), [])
  // La danse et les métiers de la santé (le 15 octobre 2026) : un sous-thème neuf par catégorie, leur étiquette ailleurs.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Musique', 'danses')), ['danse'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Arts & lettres', 'ballet')), ['danse'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Autour de la fête', 'bal')), ['danse'])
  assert.deepEqual(sujetsDe(meta(null, ['danse'], 'monde', 'Sport', 'rugby')), ['danse'], 'le haka des All Blacks')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Musique', 'classique')), [], 'un concerto n’est pas de la danse')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'sante')), ['sante'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'medecine')), ['sante'])
  // Le corps humain est du thème : c'est le socle de tous ces métiers.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'corps')), ['sante'])
  // Le métier, pas sa fiction (le 17 octobre 2026) : une série d'hôpital ou une pièce de Molière reste hors du thème, l'histoire d'une épidémie y entre.
  assert.deepEqual(sujetsDe(meta(null, ['sante'], 'monde', 'Cinéma & séries', 'series')), ['petit-ecran'], 'une série d’hôpital')
  assert.deepEqual(sujetsDe(meta(null, ['sante'], 'monde', 'Arts & lettres', 'poesie-theatre')), [], 'Le Médecin malgré lui')
  assert.deepEqual(sujetsDe(meta(null, ['sante'], 'monde', 'Histoire', 'faits-divers')), ['sante'], 'la peste noire')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'societe')), [], 'les autres métiers n’en sont pas')
  // L'informatique et l'astronomie (le 17 octobre 2026) : leur sous-thème des sciences, qu'un autre thème lisait déjà.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'techno')), ['inventions', 'informatique'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'espace')), ['terre-espace', 'astronomie'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'terre')), ['terre-espace'], 'un volcan n’est pas de l’astronomie')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Jeux & pop culture', 'internet')), [], 'les réseaux sociaux ne sont pas l’informatique')
  // Les jeux vidéo, la BD et les monuments (le 17 octobre 2026 encore).
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Jeux & pop culture', 'jeux-video')), ['jeux-video'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Arts & lettres', 'bd')), ['bd'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Cinéma & séries', 'sagas')), [], 'Harry Potter n’est pas de la BD')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Géographie', 'sites')), ['monuments'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Arts & lettres', 'sculpture-archi')), ['monuments'])
  // La langue française (le 17 octobre 2026) : son sous-thème, et l'étiquette pour une expression rangée ailleurs.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'francais')), ['francais'])
  assert.deepEqual(sujetsDe(meta(null, ['francais'], 'monde', 'Autour de la fête', 'bal')), ['danse', 'francais'], '« ouvrir le bal »')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'langue')), [], 'l’alphabet coréen n’est pas du français')
  assert.deepEqual(sujetsDe(meta(null, ['etymologie'], 'monde', 'Nature', 'disparus')), ['animaux', 'mots'], 'le nom d’un dinosaure reste à l’origine des mots, pas au français')
  // L'anglais et l'espagnol (le même jour) : chacun son sous-thème, et son étiquette pour le mot qu'on croise ailleurs.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'anglais')), ['anglais'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'espagnol')), ['espagnol'])
  assert.deepEqual(sujetsDe(meta(null, ['alcool', 'anglais'], 'monde', 'Autour de la fête', 'cocktails')), ['anglais'], '« happy hour »')
  assert.deepEqual(sujetsDe(meta(null, ['espagnol'], 'monde', 'Autour de la fête', 'noel')), ['espagnol'], '« Feliz Navidad »')
})

test('le catalogue des sujets : des clés uniques, des étiquettes qui existent, des époques qui se suivent sans se chevaucher', () => {
  assert.equal(new Set(SUJETS.map(s => s.cle)).size, SUJETS.length)
  const connues = new Set(ETIQUETTES.flatMap(f => f.etiquettes.map(e => e.cle)))
  for (const s of SUJETS) for (const e of s.etiquettes ?? []) assert.ok(connues.has(e), `${s.cle} : ${e}`)
  const epoques = SUJETS.filter(s => s.famille === 'epoque')
  for (const s of epoques) assert.ok(s.annees && s.annees[0] <= s.annees[1], s.cle)
  for (let i = 1; i < epoques.length; i++) assert.equal(epoques[i].annees![0], epoques[i - 1].annees![1] + 1, `${epoques[i - 1].cle} puis ${epoques[i].cle}`)
  for (const s of SUJETS.filter(s => s.famille === 'fil')) assert.ok(!s.annees && !s.sousThemes && (s.etiquettes || s.portee), s.cle)
  // Un thème se lit sur des sous-thèmes qui existent dans leur catégorie, et sur des étiquettes ; jamais sur une date ou une portée.
  const themes = SUJETS.filter(s => s.famille === 'theme')
  assert.ok(themes.length >= 5, 'les premiers thèmes')
  for (const s of themes) {
    assert.ok(!s.annees && !s.portee && s.sousThemes, s.cle)
    for (const [categorie, cles] of Object.entries(s.sousThemes!) as [Categorie, readonly string[]][]) {
      assert.ok(SOUS_THEMES[categorie], `${s.cle} : ${categorie}`)
      for (const cle of cles) assert.ok(SOUS_THEMES[categorie].some(x => x.cle === cle), `${s.cle} : ${categorie} › ${cle}`)
    }
  }
  // Chaque famille a sa rangée à l'écran, une seule fois.
  assert.deepEqual(new Set(FAMILLES_DE_SUJETS.map(f => f.famille)), new Set(SUJETS.map(s => s.famille)))
  assert.equal(new Set(FAMILLES_DE_SUJETS.map(f => f.famille)).size, FAMILLES_DE_SUJETS.length)
})

test('un fil rouge et un thème ont chacun leur icône — sans elle, l’horloge des époques', async () => {
  const { iconeDuSujet } = await import(new URL('../../client/src/iconeDuSujet.ts', import.meta.url).href)
  for (const s of SUJETS) {
    if (s.famille === 'epoque') assert.equal(iconeDuSujet(s), 'clock', s.cle)
    else assert.notEqual(iconeDuSujet(s), 'clock', `${s.cle} : ajoute son icône à client/src/iconeDuSujet.ts`)
  }
})

// Un thème qu'on ajoute et qui manque de questions : `generer-campagne.ts preparer --theme=<clé>` écrit ce qui lui manque.
test('chaque sujet tient une série dans la base livrée : cent questions, cinq de chaque marche — sept catégories pour une époque ou un fil rouge', () => {
  const { questions } = lireLaBase()
  for (const s of SUJETS) {
    const siennes = questions.filter(q => sujetsDe(q.meta).includes(s.cle))
    assert.ok(siennes.length >= 100, `${s.cle} : ${siennes.length} questions`)
    const categories = new Set(siennes.map(q => q.meta.categorie))
    // Un thème a son nom, pas l'obligation de traverser les catégories : les animaux vivent surtout dans la nature.
    if (s.famille !== 'theme') assert.ok(categories.size >= 7, `${s.cle} : ${categories.size} catégories — un sujet traverse les catégories`)
    const parNiveau = new Map<Niveau, number>()
    for (const q of siennes) parNiveau.set(niveauDeQuestion(q.meta.difficulte), (parNiveau.get(niveauDeQuestion(q.meta.difficulte)) ?? 0) + 1)
    for (const n of NIVEAUX) assert.ok((parNiveau.get(n) ?? 0) >= 5, `${s.cle} › ${n} : ${parNiveau.get(n) ?? 0}`)
  }
})

test('la Grande Série se gagne dans une série de toutes les catégories, pas sur un sujet', () => {
  const questions = Array.from({ length: 30 }, () => ({ niveau: 'facile' as Niveau }))
  const justes = Array<boolean>(30).fill(true)
  assert.ok(hautsFaitsDeLaSerie({ questions, justes: 30, categories: null }, justes).includes('hf:grande-serie'))
  assert.ok(!hautsFaitsDeLaSerie({ questions, justes: 30, categories: null, sujet: 'annees-80' }, justes).includes('hf:grande-serie'))
})

// ── Au serveur ──────────────────────────────────────────────────────────────

/** Une question d'essai, de la catégorie et de la difficulté qu'on veut, avec ses étiquettes et sa date. */
function question(i: number, categorie: Categorie, { etiquettes = [] as string[], date = null as { valeur: string; precision: string } | null } = {}): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `sujet${String(i).padStart(3, '0')}`,
    texte: `Question d'essai à sujet numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes,
    difficulte: 1 + (i % 5),
    ageMin: 10,
    date,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

// Leurs premiers sous-thèmes — les capitales, le football, la chanson française — ne sont d'aucun thème.
const CATEGORIES_DU_BANC: Categorie[] = ['Histoire', 'Sport', 'Géographie', 'Musique']
/** Vingt records, vingt souvenirs des années 80, vingt questions sans sujet ; chacun sur quatre catégories. */
const RECORDS = Array.from({ length: 20 }, (_, i) => question(i, CATEGORIES_DU_BANC[i % 4], { etiquettes: ['record'] }))
const ANNEES_80 = Array.from({ length: 20 }, (_, i) => question(20 + i, CATEGORIES_DU_BANC[i % 4], { date: { valeur: '1985', precision: 'annee' } }))
const SANS_SUJET = Array.from({ length: 20 }, (_, i) => question(40 + i, CATEGORIES_DU_BANC[i % 4]))
/** Et un thème : dix mammifères de la nature, et cinq animaux du cinéma, par leur étiquette. */
const ANIMAUX = [
  ...Array.from({ length: 10 }, (_, i) => question(60 + i, 'Nature')),
  ...Array.from({ length: 5 }, (_, i) => question(70 + i, 'Cinéma & séries', { etiquettes: ['animaux'] })),
]
const BASE = new BaseDeLaCampagne([...RECORDS, ...ANNEES_80, ...SANS_SUJET, ...ANIMAUX])

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les questions qu'une série a tirées, telles qu'elle les garde. */
function tirees(banc: Banc, serie: string): string[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const { questions } = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(questions) as { id: string }[]).map(q => q.id)
  } finally {
    db.close()
  }
}

test('une série sur un sujet ne pose que ses questions, à travers les catégories, et le garde à la reprise', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // La page sait quels sujets ont de quoi faire une série, et combien.
    const etat = (await lire(banc, lea, '/api/campagne')).corps
    assert.deepEqual(etat.sujets, [
      { sujet: 'animaux', questions: 15 },
      { sujet: 'annees-80', questions: 20 },
      { sujet: 'records', questions: 20 },
    ])
    // Un sujet l'emporte sur des catégories envoyées avec lui : il les traverse.
    const serie = (await poster(banc, lea, '/api/campagne/serie', { sujet: 'records', categories: ['Nature'] })).corps
    assert.ok(serie.id, serie.error)
    assert.equal(serie.sujet, 'records')
    assert.equal(serie.categories, undefined)
    const ids = tirees(banc, serie.id)
    assert.equal(ids.length, 20, 'toutes ses questions, et rien d’autre')
    assert.deepEqual(new Set(ids), new Set(RECORDS.map(q => q.id)))
    // Reprise sur un autre téléphone, elle sait son sujet.
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.enCours.sujet, 'records')
    // Une décennie : les questions datées de ses années.
    const annees = (await poster(banc, lea, '/api/campagne/serie', { sujet: 'annees-80' })).corps
    assert.deepEqual(new Set(tirees(banc, annees.id)), new Set(ANNEES_80.map(q => q.id)))
    // Un thème : ses sous-thèmes dans leur catégorie, et son étiquette ailleurs.
    const animaux = (await poster(banc, lea, '/api/campagne/serie', { sujet: 'animaux' })).corps
    assert.equal(animaux.sujet, 'animaux')
    assert.deepEqual(new Set(tirees(banc, animaux.id)), new Set(ANIMAUX.map(q => q.id)))
    // Un sujet inconnu, ou trop maigre, se refuse avec ce qu'il faut faire.
    const inconnu = await poster(banc, lea, '/api/campagne/serie', { sujet: 'astrologie' })
    assert.equal(inconnu.status, 400)
    assert.equal(inconnu.corps.error, 'Ce sujet n’existe plus : choisis-en un autre')
    const maigre = await poster(banc, lea, '/api/campagne/serie', { sujet: 'pionnieres' })
    assert.equal(maigre.status, 400)
    assert.equal(maigre.corps.error, 'Pas assez de questions sur ce sujet pour l’instant : choisis-en un autre')
    // Sans sujet, rien ne change : toutes les catégories.
    const toutes = (await poster(banc, lea, '/api/campagne/serie', {})).corps
    assert.equal(toutes.sujet, undefined)
    assert.equal(tirees(banc, toutes.id).length, 60)
  } finally {
    await banc.close()
  }
})

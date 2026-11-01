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
import { hautsFaitsDeLaSerie, sujetsDeLaQuestion } from '../src/core/campagne'
import { composerUnQuiz, idDeLaBase } from '../src/core/quizToutPret'
import {
  FAMILLES_DE_SUJETS,
  QUESTIONS_POUR_UNE_RUBRIQUE,
  RUBRIQUES,
  SUJETS,
  SUJETS_ET_RUBRIQUES,
  SUJETS_REMPLACES,
  aUnParcours,
  anneeDe,
  cleDeRubrique,
  estRemplace,
  fetesDansLOrdre,
  rubriqueDe,
  rubriquesDeLaCategorie,
  sujetParCle,
  sujetsDe,
  sujetsEtRubriqueDe,
} from '../../shared/sujets'
import { ETIQUETTES, PORTEES, SOUS_THEMES } from '../../shared/etiquettes'
import { NIVEAUX, niveauDeQuestion, type Niveau } from '../../shared/campagne'
import type { Categorie } from '../../shared/categories'

// ── Le catalogue, pur ───────────────────────────────────────────────────────

const meta = (date: { valeur: string; precision: string } | null, etiquettes: string[] = [], portee = 'monde', categorie = 'Histoire', sousTheme = 'civilisations') =>
  ({ date, etiquettes, portee, categorie, sousTheme }) as Parameters<typeof sujetsDe>[0]

test('une question est d’une époque par sa date, d’un fil rouge par ses étiquettes ou sa portée', () => {
  assert.deepEqual(sujetsDe(meta({ valeur: '1985-06', precision: 'mois' }, ['record'], 'france')), ['annees-80', 'france', 'records'])
  // Une décennie s'écrit par sa première année : elle tombe dans la sienne.
  assert.deepEqual(sujetsDe(meta({ valeur: '1980', precision: 'decennie' })), ['annees-80'])
  // Les époques larges redécoupées (le 17 octobre 2026) : la neuve, puis l'ancienne, remplacée, qui se lit encore.
  assert.deepEqual(sujetsDe(meta({ valeur: '-27', precision: 'annee' })), ['antiquite', 'avant-1800'])
  assert.deepEqual(sujetsDe(meta({ valeur: '1715', precision: 'annee' })), ['grand-siecle', 'avant-1800'], 'la mort de Louis XIV clôt le Grand Siècle')
  assert.deepEqual(sujetsDe(meta({ valeur: '1936', precision: 'annee' })), ['1919-1938', '1900-1949'])
  assert.deepEqual(sujetsDe(meta({ valeur: '2023-05', precision: 'mois' })), ['depuis-2020', 'depuis-2010'])
  assert.deepEqual(sujetsDe(meta({ valeur: '1889-03-31', precision: 'jour' })), ['xixe'])
  // Au siècle près, « 1801 » dit tout le XIXe : elle n'est d'aucune époque.
  assert.deepEqual(sujetsDe(meta({ valeur: '1801', precision: 'siecle' })), [])
  // Les contes et légendes sont aux mythes, plus aux souvenirs d'enfance (le 17 octobre 2026) : la moitié du thème était des deux.
  assert.deepEqual(sujetsDe(meta(null, ['idee-recue', 'contes-legendes'])), ['mythes-legendes', 'insolite'])
  assert.deepEqual(sujetsDe(meta(null, ['enfance'])), ['enfance'])
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
  // Les dinosaures (le 17 octobre 2026, au soir) ont quitté les animaux, qui en contenaient les quatre cinquièmes :
  // leur thème tient leur rubrique, et leur étiquette les porte ailleurs — Jurassic Park.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Nature', 'disparus')), ['dinosaures'])
  assert.deepEqual(sujetsDe(meta(null, ['dinosaures'], 'monde', 'Cinéma & séries', 'sagas')), ['dinosaures'])
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
  // L'informatique et l'astronomie (le 17 octobre 2026) : leur sous-thème des sciences, que les inventions et la
  // Terre et l'espace — « Volcans et océans » — lisaient aussi, puis ont laissé : un thème n'en contient pas un autre.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'techno')), ['informatique'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'espace')), ['astronomie'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'terre')), ['terre-espace'], 'un volcan n’est pas de l’astronomie')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Sciences', 'savants')), ['inventions'])
  assert.deepEqual(sujetsDe(meta(null, ['invention'], 'monde', 'Jeux & pop culture', 'jouets')), ['inventions'], 'le cube de Rubik')
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
  assert.deepEqual(sujetsDe(meta(null, ['etymologie'], 'monde', 'Nature', 'disparus')), ['dinosaures', 'mots'], 'le nom d’un dinosaure reste à l’origine des mots, pas au français')
  // L'anglais et l'espagnol (le même jour) : chacun son sous-thème, et son étiquette pour le mot qu'on croise ailleurs.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'anglais')), ['anglais'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'espagnol')), ['espagnol'])
  assert.deepEqual(sujetsDe(meta(null, ['alcool', 'anglais'], 'monde', 'Autour de la fête', 'cocktails')), ['anglais'], '« happy hour »')
  // Les fêtes (le 17 octobre 2026) : leur sous-thème d'« Autour de la fête », et l'étiquette qui les nomme ailleurs.
  assert.deepEqual(sujetsDe(meta(null, ['espagnol'], 'monde', 'Autour de la fête', 'noel')), ['espagnol', 'noel'], '« Feliz Navidad »')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Autour de la fête', 'halloween')), ['halloween'])
  assert.deepEqual(sujetsDe(meta(null, ['noel'], 'monde', 'Cinéma & séries', 'cinema-fr')), ['noel'], '« Le père Noël est une ordure »')
  assert.deepEqual(sujetsDe(meta(null, ['saint-valentin'], 'monde', 'Autour de la fête', 'traditions')), ['amour'], 'la Saint-Valentin est de l’amour')
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Autour de la fête', 'anniversaires')), ['anniversaires'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Autour de la fête', 'traditions')), [], 'les fêtes du monde n’en sont pas une')
  // La francophonie : sa portée, comme la France la sienne.
  assert.deepEqual(sujetsDe(meta(null, [], 'francophonie', 'Musique', 'chanson-fr')), ['francophonie'])
  // Les records : leur étiquette, et la rubrique de la culture générale qu'ils tiennent — la plus grande ville de Suisse.
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Culture générale', 'records')), ['records'])
  // Les pays (le 17 octobre 2026) : leur étiquette seule, dans toutes les catégories — un match, deux pays.
  assert.deepEqual(sujetsDe(meta(null, ['italie'], 'monde', 'Cuisine', 'monde')), ['italie'])
  assert.deepEqual(sujetsDe(meta(null, ['royaume-uni', 'japon'], 'monde', 'Sport', 'combat')), ['japon', 'royaume-uni'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Géographie', 'capitales')), [], 'une capitale n’est d’aucun pays sans son étiquette')
  // Les univers (le même jour) : leur étiquette seule, de la saga au cinéma à sa chanson.
  assert.deepEqual(sujetsDe(meta(null, ['harry-potter'], 'monde', 'Cinéma & séries', 'sagas')), ['harry-potter'])
  assert.deepEqual(sujetsDe(meta(null, ['james-bond', 'royaume-uni'], 'monde', 'Musique', 'ecrans')), ['james-bond', 'royaume-uni'])
  assert.deepEqual(sujetsDe(meta(null, [], 'monde', 'Cinéma & séries', 'sagas')), [], 'une saga n’est d’aucun univers sans son étiquette')
})

test('le catalogue des sujets : des clés uniques, des étiquettes qui existent, des époques qui se suivent sans se chevaucher', () => {
  assert.equal(new Set(SUJETS.map(s => s.cle)).size, SUJETS.length)
  const connues = new Set(ETIQUETTES.flatMap(f => f.etiquettes.map(e => e.cle)))
  for (const s of SUJETS) for (const e of s.etiquettes ?? []) assert.ok(connues.has(e), `${s.cle} : ${e}`)
  const epoques = SUJETS.filter(s => s.famille === 'epoque')
  for (const s of epoques) assert.ok(s.annees && s.annees[0] <= s.annees[1], s.cle)
  for (let i = 1; i < epoques.length; i++) assert.equal(epoques[i].annees![0], epoques[i - 1].annees![1] + 1, `${epoques[i - 1].cle} puis ${epoques[i].cle}`)
  // Un fil rouge se lit sur ses étiquettes ou sa portée ; un sous-thème, seulement celui dont il tient la rubrique.
  for (const s of SUJETS.filter(s => s.famille === 'fil')) assert.ok(!s.annees && (!s.sousThemes || s.categorie) && (s.etiquettes || s.portee), s.cle)
  // Un thème se lit sur des sous-thèmes qui existent dans leur catégorie, et sur des étiquettes ; jamais sur une date ou une portée.
  // Ou sur sa seule étiquette (le 17 octobre 2026, au soir) : la Révolution et l'Empire, le polar — aucun sous-thème ne les dit.
  const themes = SUJETS.filter(s => s.famille === 'theme')
  assert.ok(themes.length >= 5, 'les premiers thèmes')
  for (const s of themes) {
    assert.ok(!s.annees && !s.portee && (s.sousThemes || s.etiquettes?.length), s.cle)
    for (const [categorie, cles] of Object.entries(s.sousThemes ?? {}) as [Categorie, readonly string[]][]) {
      assert.ok(SOUS_THEMES[categorie], `${s.cle} : ${categorie}`)
      for (const cle of cles) assert.ok(SOUS_THEMES[categorie].some(x => x.cle === cle), `${s.cle} : ${categorie} › ${cle}`)
    }
  }
  // Une fête se lit sur un sous-thème d'« Autour de la fête », et a son jour — sauf les anniversaires, chacun le sien.
  const fetes = SUJETS.filter(s => s.famille === 'fete')
  assert.deepEqual(fetes.map(s => s.cle), ['noel', 'nouvel-an', 'halloween', 'amour', 'anniversaires'])
  for (const s of fetes) {
    assert.ok(!s.annees && !s.portee, s.cle)
    assert.deepEqual(Object.keys(s.sousThemes ?? {}), ['Autour de la fête'], s.cle)
    for (const cle of s.sousThemes!['Autour de la fête']!) assert.ok(SOUS_THEMES['Autour de la fête'].some(x => x.cle === cle), `${s.cle} › ${cle}`)
    assert.equal(!!s.jour, s.cle !== 'anniversaires', s.cle)
  }
  // Un pays, un univers se lit sur son étiquette, de sa famille (« Les pays », « Les univers »), et sur rien d'autre ;
  // chaque étiquette de la famille a son sujet, rangés dans l'ordre de l'alphabet, sans l'article.
  for (const [famille, laFamille] of [
    ['pays', 'Les pays'],
    ['univers', 'Les univers'],
  ] as const) {
    const siennes = ETIQUETTES.find(f => f.famille === laFamille)!.etiquettes.map(e => e.cle)
    const sujets = SUJETS.filter(s => s.famille === famille)
    for (const s of sujets) assert.ok(!s.annees && !s.portee && !s.sousThemes && s.etiquettes?.length === 1 && s.etiquettes[0] === s.cle, s.cle)
    assert.deepEqual(sujets.map(s => s.cle).sort(), [...siennes].sort(), famille)
    assert.deepEqual(
      sujets.map(s => s.nom),
      [...sujets.map(s => s.nom)].sort((a, b) => a.replace(/^(L’|Le |La |Les )/, '').localeCompare(b.replace(/^(L’|Le |La |Les )/, ''), 'fr')),
      `${famille} : dans l’ordre de l’alphabet, sans l’article`,
    )
  }
  // Ni une fête ni une rubrique ne montent en parcours : le sentier de leur catégorie le fait.
  assert.deepEqual(
    SUJETS_ET_RUBRIQUES.filter(s => !aUnParcours(s)).map(s => s.famille).filter((f, i, toutes) => toutes.indexOf(f) === i),
    ['fete', 'rubrique'],
  )
  // Chaque famille a sa rangée à l'écran, une seule fois.
  assert.deepEqual(new Set(FAMILLES_DE_SUJETS.map(f => f.famille)), new Set(SUJETS.map(s => s.famille)))
  assert.equal(new Set(FAMILLES_DE_SUJETS.map(f => f.famille)).size, FAMILLES_DE_SUJETS.length)
})

// Les époques larges redécoupées (le 17 octobre 2026, « apporter beaucoup de
// choix ») : « Avant 1800 » mêlait les pharaons et Voltaire. Les anciennes se
// lisent encore — un parcours commencé, un choix retenu —, sans se proposer.
test('une époque remplacée couvre exactement celles qui la remplacent, et aucune liste de choix ne la propose', () => {
  const epoques = SUJETS.filter(s => s.famille === 'epoque')
  assert.equal(epoques.length, 17)
  for (const r of SUJETS_REMPLACES) {
    assert.equal(r.famille, 'epoque', r.cle)
    const siennes = epoques.filter(s => s.annees![0] >= r.annees![0] && s.annees![1] <= r.annees![1])
    assert.ok(siennes.length >= 2, `${r.cle} : redécoupée en plusieurs`)
    assert.equal(siennes[0].annees![0], r.annees![0], `${r.cle} commence avec ${siennes[0].cle}`)
    assert.equal(siennes.at(-1)!.annees![1], r.annees![1], `${r.cle} finit avec ${siennes.at(-1)!.cle}`)
    // Lue encore, par sa clé et son nom ; jamais dans ce qu'une partie propose.
    assert.equal(sujetParCle(r.cle), r)
    assert.ok(estRemplace(r.cle))
    assert.ok(!SUJETS_ET_RUBRIQUES.some(s => s.cle === r.cle))
  }
  assert.deepEqual(
    SUJETS_REMPLACES.map(r => r.cle),
    ['avant-1800', '1900-1949', 'depuis-2010'],
  )
  assert.ok(!estRemplace('antiquite') && !estRemplace(undefined))
})

// Les fêtes se rangent de la plus proche à la plus lointaine (le 17 octobre
// 2026) : FiestApp en est une, et celle qui vient s'y lit sans défiler.
test('les fêtes, de la plus proche à la plus lointaine : celle du jour d’abord, celle d’hier au bout, les anniversaires à la fin', () => {
  const fetes = SUJETS.filter(s => s.famille === 'fete')
  const ordre = (mois: number, jour: number) => fetesDansLOrdre(fetes, new Date(2026, mois - 1, jour, 12)).map(s => s.cle)
  assert.deepEqual(ordre(10, 17), ['halloween', 'noel', 'nouvel-an', 'amour', 'anniversaires'])
  assert.deepEqual(ordre(10, 31), ['halloween', 'noel', 'nouvel-an', 'amour', 'anniversaires'], 'le jour même, elle ouvre encore la rangée')
  assert.deepEqual(ordre(11, 1), ['noel', 'nouvel-an', 'amour', 'halloween', 'anniversaires'], 'passée, elle attend l’an prochain')
  assert.deepEqual(ordre(12, 26), ['nouvel-an', 'amour', 'halloween', 'noel', 'anniversaires'])
  assert.deepEqual(ordre(2, 1), ['amour', 'halloween', 'noel', 'nouvel-an', 'anniversaires'])
})

test('un fil rouge et un thème ont chacun leur icône — sans elle, l’horloge des époques ; une rubrique, l’emblème de sa catégorie', async () => {
  // L'emblème d'une catégorie vit avec l'écusson (`components/Ecusson.tsx`), dont les icônes s'écrivent en JSX : React d'abord.
  Object.assign(globalThis, { React: (await import('react')).default })
  const { iconeDuSujet } = await import(new URL('../../client/src/iconeDuSujet.ts', import.meta.url).href)
  const { EMBLEME } = await import(new URL('../../client/src/components/Ecusson.tsx', import.meta.url).href)
  for (const s of SUJETS) {
    if (s.famille === 'epoque') assert.equal(iconeDuSujet(s), 'clock', s.cle)
    else assert.notEqual(iconeDuSujet(s), 'clock', `${s.cle} : ajoute son icône à client/src/iconeDuSujet.ts`)
  }
  for (const r of RUBRIQUES) assert.equal(iconeDuSujet(r), EMBLEME[r.categorie!], r.cle)
})

// Les rubriques (le choix du propriétaire du 17 octobre 2026, « apporter
// beaucoup de choix ») : chaque sous-thème seul, choisi sous sa catégorie —
// « Sport », puis « Football ». La base en avait de quoi : plus de deux cents
// questions par sous-thème, et le joueur n'en choisissait presque aucun.
test('chaque sous-thème est une rubrique : sa clé dit sa catégorie, elle s’ajoute aux sujets d’une question, et une rubrique que la base livrée sert tient une série', () => {
  const tenues = SUJETS.filter(s => s.categorie).length
  assert.equal(RUBRIQUES.length + tenues, Object.values(SOUS_THEMES).flat().length, 'une rubrique par sous-thème, ou le sujet qui la tient')
  assert.equal(new Set(SUJETS_ET_RUBRIQUES.map(s => s.cle)).size, SUJETS_ET_RUBRIQUES.length, 'aucune clé partagée avec un sujet')
  assert.ok(RUBRIQUES.every(r => r.famille === 'rubrique' && r.categorie && r.cle === cleDeRubrique(r.categorie, r.sousThemes![r.categorie]![0])))
  // « france » n'est pas le même en cuisine et en géographie : la catégorie le précède.
  assert.equal(cleDeRubrique('Cinéma & séries', 'cinema-fr'), 'cinema-series/cinema-fr')
  assert.notEqual(cleDeRubrique('Géographie', 'france'), cleDeRubrique('Cuisine', 'france'))
  assert.deepEqual(
    { ...sujetParCle('cuisine/techniques') },
    {
      cle: 'cuisine/techniques',
      nom: 'Techniques et vocabulaire',
      famille: 'rubrique',
      description: 'Cuisine',
      categorie: 'Cuisine',
      sousThemes: { Cuisine: ['techniques'] },
    },
  )
  // Les sujets d'une question ne disent pas sa rubrique : elle s'y ajoute, au bout.
  const m = meta({ valeur: '1998', precision: 'annee' }, ['coupe-du-monde'], 'france', 'Sport', 'football')
  assert.deepEqual(sujetsDe(m), ['grands-rendez-vous', 'annees-90', 'france'])
  assert.deepEqual(sujetsEtRubriqueDe(m), ['grands-rendez-vous', 'annees-90', 'france', 'sport/football'])
  assert.equal(rubriqueDe({ categorie: 'Cuisine', sousTheme: 'france' }), 'cuisine/france')
  assert.equal(rubriqueDe({ categorie: 'Cuisine', sousTheme: 'capitales' }), null, 'un sous-thème d’une autre catégorie n’en est pas une')
  // Une rubrique que la base livrée sert — cent questions au moins — tient une série : cinq de chaque marche.
  const { questions } = lireLaBase()
  const parRubrique = new Map<string, QuestionDeLaBase[]>()
  for (const q of questions) {
    const r = rubriqueDe(q.meta)!
    const siennes = parRubrique.get(r)
    if (siennes) siennes.push(q)
    else parRubrique.set(r, [q])
  }
  const servies = RUBRIQUES.filter(r => (parRubrique.get(r.cle)?.length ?? 0) >= QUESTIONS_POUR_UNE_RUBRIQUE)
  // Celles qu'un sujet tient se jouent par lui, qui tient une série (plus bas) : la base en servait 96 en tout le 17 octobre 2026.
  assert.ok(servies.length + tenues >= 90, `${servies.length} rubriques servies et ${tenues} tenues par un sujet`)
  for (const r of servies) {
    for (const n of NIVEAUX) assert.ok(parRubrique.get(r.cle)!.filter(q => niveauDeQuestion(q.meta.difficulte) === n).length >= 5, `${r.cle} › ${n}`)
  }
})

// Douze thèmes doublaient leur rubrique — « Les jeux vidéo » et « Jeux
// vidéo », les mêmes questions, deux lignes au carnet (le souhait du
// propriétaire du 17 octobre 2026 : « modifier des thèmes s'il y en a qui se
// recoupent »). Un sujet qui ne lit qu'un sous-thème en tient la rubrique.
test('un sujet qui ne lit qu’un sous-thème en tient la rubrique : une seule porte par sous-thème, sous sa catégorie', () => {
  const tenants = SUJETS.filter(s => s.categorie)
  for (const s of tenants) {
    assert.deepEqual(Object.keys(s.sousThemes ?? {}), [s.categorie], `${s.cle} : son sous-thème est de sa catégorie, et le seul`)
    assert.equal(s.sousThemes![s.categorie!]!.length, 1, s.cle)
  }
  assert.equal(new Set(tenants.map(s => `${s.categorie}/${s.sousThemes![s.categorie!]![0]}`)).size, tenants.length, 'une rubrique, un sujet au plus')
  // Sous chaque catégorie, une porte par sous-thème, dans leur ordre : la rubrique, ou le sujet qui la tient.
  for (const categorie of Object.keys(SOUS_THEMES) as Categorie[]) {
    const portes = rubriquesDeLaCategorie(categorie).map(cle => sujetParCle(cle)!)
    assert.deepEqual(
      portes.map(s => s.sousThemes![categorie]![0]),
      SOUS_THEMES[categorie].map(st => st.cle),
      categorie,
    )
  }
  assert.deepEqual(rubriquesDeLaCategorie('Sciences'), [
    'astronomie',
    'sciences/terre',
    'sciences/corps',
    'sciences/medecine',
    'sciences/physique-chimie',
    'sciences/maths',
    'informatique',
    'inventions',
  ])
  // La rubrique tenue n'existe plus : ni à choisir, ni parmi les sujets d'une question — son sujet y est déjà.
  assert.equal(sujetParCle('jeux-pop-culture/jeux-video'), undefined)
  const jeu = meta(null, [], 'monde', 'Jeux & pop culture', 'jeux-video')
  assert.deepEqual(sujetsEtRubriqueDe(jeu), ['jeux-video'])
  // Elle dit encore son sous-thème : la voisine d'une question le garde (`uneAutreQuestion`).
  assert.equal(rubriqueDe(jeu), 'jeux-pop-culture/jeux-video')
})

// La règle, sur la base livrée : ce qui se recoupe se voit dans les questions.
test('dans la base livrée, aucun sujet ne double une rubrique, et deux sujets ne se contiennent pas', () => {
  const { questions } = lireLaBase()
  const membres = new Map<string, Set<string>>()
  for (const q of questions) {
    for (const s of sujetsEtRubriqueDe(q.meta)) {
      const siens = membres.get(s)
      if (siens) siens.add(q.id)
      else membres.set(s, new Set([q.id]))
    }
  }
  const communes = (a: Set<string>, b: Set<string>) => [...a].filter(id => b.has(id)).length
  // Les quatre cinquièmes de leurs questions en commun, ensemble : le même sujet sous deux noms. Les monuments en ont
  // trois cinquièmes avec la sculpture et l'architecture — ils réunissent deux rubriques —, les jeux vidéo en avaient tout.
  for (const s of SUJETS) {
    const siennes = membres.get(s.cle)!
    for (const r of RUBRIQUES) {
      const celles = membres.get(r.cle)
      if (!celles || celles.size < QUESTIONS_POUR_UNE_RUBRIQUE) continue
      const c = communes(siennes, celles)
      assert.ok(c / (siennes.size + celles.size - c) < 0.8, `${s.cle} double ${r.cle} : donne-lui sa catégorie (\`categorie\`), il la tiendra`)
    }
  }
  // Un thème n'en contient pas la moitié d'un autre : l'astronomie était toute dans la Terre et l'espace. Hors époques,
  // qui se lisent à la date, et hors portées — la France tient la moitié de la langue française, et c'est juste.
  // Un univers, lui, peut vivre dans un thème plus large, comme un zoom sur lui (le choix du propriétaire du
  // 1er novembre 2026) : Lost tient aux quatre cinquièmes dans le petit écran, et c'est juste — une série de fans
  // est une série. L'inverse reste interdit : un thème ne tient pas à moitié dans un univers, ni deux univers l'un
  // dans l'autre.
  const transverses = SUJETS.filter(s => s.famille !== 'epoque' && !s.portee)
  for (let i = 0; i < transverses.length; i++) {
    for (let j = i + 1; j < transverses.length; j++) {
      const a = membres.get(transverses[i].cle)!
      const b = membres.get(transverses[j].cle)!
      const [petit, grand] = a.size <= b.size ? [transverses[i], transverses[j]] : [transverses[j], transverses[i]]
      if (petit.famille === 'univers' && grand.famille === 'theme') continue
      const part = communes(a, b) / Math.min(a.size, b.size)
      assert.ok(part < 0.5, `${transverses[i].cle} et ${transverses[j].cle} se recoupent à ${Math.round(part * 100)} %`)
    }
  }
})

// La règle d'avant, sujet par sujet : la référence. Elle passait les
// vingt-sept sujets pour chacune des vingt-quatre mille questions de la base —
// 35 à 60 ms à la première ouverture de la campagne après chaque réveil, dix
// fois plus au dixième de cœur de l'hébergeur (le banc du 16 octobre 2026).
test('les sujets d’une question, lus par leur index : les mêmes, dans le même ordre, que la règle lue sujet par sujet', () => {
  const reference = (m: Parameters<typeof sujetsDe>[0]) => {
    const annee = anneeDe(m.date)
    return [...SUJETS, ...SUJETS_REMPLACES].filter(
      s =>
        (s.annees && annee !== null && annee >= s.annees[0] && annee <= s.annees[1]) ||
        (s.etiquettes && !s.etiquettesHors?.includes(m.categorie as Categorie) && s.etiquettes.some(e => m.etiquettes.includes(e))) ||
        (s.portee && m.portee === s.portee) ||
        (s.sousThemes && !!s.sousThemes[m.categorie as Categorie]?.includes(m.sousTheme)),
    ).map(s => s.cle)
  }
  const { questions } = lireLaBase()
  for (const q of questions) assert.deepEqual(sujetsDe(q.meta), reference(q.meta), q.id)
  // Et ce que la base n'a pas : chaque étiquette, chaque sous-thème, deux étiquettes d'un même sujet, une date aux bornes de chaque époque.
  let graine = 3
  const hasard = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646
  const parmi = <T>(liste: readonly T[]) => liste[Math.floor(hasard() * liste.length)]
  const bornes = [...SUJETS, ...SUJETS_REMPLACES].flatMap(s => (s.annees ? [s.annees[0] - 1, s.annees[0], s.annees[1], s.annees[1] + 1] : []))
  const etiquettes = ETIQUETTES.flatMap(f => f.etiquettes.map(e => e.cle))
  const categories = Object.keys(SOUS_THEMES) as Categorie[]
  for (let i = 0; i < 5000; i++) {
    const categorie = parmi(categories)
    const m = meta(
      hasard() < 0.2 ? null : { valeur: String(hasard() < 0.5 ? parmi(bornes) : Math.floor(hasard() * 2200) - 100), precision: parmi(['jour', 'annee', 'decennie', 'siecle']) },
      Array.from({ length: Math.floor(hasard() * 4) }, () => parmi(etiquettes)),
      parmi(PORTEES),
      categorie,
      parmi(SOUS_THEMES[categorie]).cle,
    )
    assert.deepEqual(sujetsDe(m), reference(m), JSON.stringify(m))
  }
})

// Un thème qu'on ajoute et qui manque de questions : `generer-campagne.ts preparer --theme=<clé>` écrit ce qui lui manque.
test('chaque sujet tient une série dans la base livrée : cent questions, cinq de chaque marche — sept catégories pour une époque ou un fil rouge', () => {
  const { questions } = lireLaBase()
  for (const s of SUJETS) {
    const siennes = questions.filter(q => sujetsDe(q.meta).includes(s.cle))
    assert.ok(siennes.length >= 100, `${s.cle} : ${siennes.length} questions`)
    const categories = new Set(siennes.map(q => q.meta.categorie))
    // Un thème a son nom, pas l'obligation de traverser les catégories : les animaux vivent surtout dans la nature. Une fête, dans celle de la fête.
    if (s.famille === 'epoque' || s.famille === 'fil') assert.ok(categories.size >= 7, `${s.cle} : ${categories.size} catégories — un sujet traverse les catégories`)
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

/** Une question d'essai, de la catégorie et de la difficulté qu'on veut, avec ses étiquettes, sa date et son sous-thème — le premier de sa catégorie, d'office. */
function question(
  i: number,
  categorie: Categorie,
  { etiquettes = [] as string[], date = null as { valeur: string; precision: string } | null, sousTheme = SOUS_THEMES[categorie][0].cle } = {},
): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `sujet${String(i).padStart(3, '0')}`,
    texte: `Question d'essai à sujet numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme,
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

test('une rubrique se propose à cent questions, se joue comme un sujet — sa série, son quiz tout prêt — et n’a pas de parcours', async () => {
  const football = Array.from({ length: 100 }, (_, i) => question(100 + i, 'Sport'))
  const rugby = Array.from({ length: 99 }, (_, i) => question(200 + i, 'Sport', { sousTheme: 'rugby' }))
  const base = new BaseDeLaCampagne([...football, ...rugby])
  const duFootball = new Set(football.map(q => q.id))
  // Le quiz tout prêt d'une soirée, sur le football : ses questions seules.
  const quiz = composerUnQuiz(
    base.questions,
    sujetsDeLaQuestion,
    new Map(),
    { categories: [], sujet: 'sport/football', difficulte: 'progressive', nombre: 20, enfants: false, estimations: false },
    { ids: new Set(), empreintes: new Set(), posees: new Map() },
  )
  assert.equal(quiz.length, 20)
  assert.ok(quiz.every(q => duFootball.has(idDeLaBase(q.id)!)))
  const banc = await demarrer({ baseDeLaCampagne: base })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Cent questions : le football se propose, à la série comme au duel ; à quatre-vingt-dix-neuf, le rugby attend.
    assert.deepEqual((await lire(banc, lea, '/api/campagne')).corps.sujets, [{ sujet: 'sport/football', questions: 100 }])
    assert.deepEqual((await lire(banc, lea, '/api/campagne/choix')).corps.sujets, [{ sujet: 'sport/football', questions: 100 }])
    // Sa série ne pose que lui, et le garde à la reprise.
    const serie = (await poster(banc, lea, '/api/campagne/serie', { sujet: 'sport/football' })).corps
    assert.equal(serie.sujet, 'sport/football')
    assert.ok(tirees(banc, serie.id).every(id => duFootball.has(id)))
    assert.equal((await lire(banc, lea, '/api/campagne')).corps.enCours.sujet, 'sport/football')
    // Ni parcours, ni étape : son sous-thème se monte déjà sur le sentier du sport.
    assert.deepEqual((await lire(banc, lea, '/api/campagne/sujets')).corps.sujets, [])
    const etape = await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'sport/football', palier: 1 })
    assert.deepEqual([etape.status, etape.corps.error], [400, 'Ce parcours n’existe pas'])
  } finally {
    await banc.close()
  }
})

// « Avant 1800 » redécoupée (le 17 octobre 2026) : qui avait monté une étape
// de son parcours la garde, et le finit ; les autres ne la voient plus.
test('une époque redécoupée ne se propose plus ; un parcours commencé sur elle se poursuit, ses étapes validées gardées', async () => {
  const antiques = Array.from({ length: 70 }, (_, i) => question(500 + i, CATEGORIES_DU_BANC[i % 4], { date: { valeur: '-27', precision: 'annee' } }))
  const banc = await demarrer({ baseDeLaCampagne: new BaseDeLaCampagne(antiques) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    // La feuille ne propose que la neuve, les parcours aussi.
    assert.deepEqual((await lire(banc, lea, '/api/campagne')).corps.sujets, [{ sujet: 'antiquite', questions: 70 }])
    const parcoursDe = async (cookie: string) => (await lire(banc, cookie, '/api/campagne/sujets')).corps.sujets.map((s: { sujet: string; paliers: number }) => [s.sujet, s.paliers])
    assert.deepEqual(await parcoursDe(lea), [['antiquite', 0]])
    const refus = await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'avant-1800', palier: 1 })
    assert.deepEqual([refus.status, refus.corps.error], [400, 'Cette époque se joue maintenant en plusieurs : choisis-en une'])
    // Bob avait validé la première étape d'« Avant 1800 » avant le redécoupage.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const { id } = db.prepare('SELECT id FROM profiles WHERE login = ?').get('bob') as { id: string }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, sujet, palier, issue) VALUES (?, ?, '[]', 10, 0, 8, ?, ?, 'sujet', 'avant-1800', 1, 'validee')`,
      ).run('bob-avant-1800', id, Date.now() - 120_000, Date.now() - 60_000)
    } finally {
      db.close()
    }
    assert.deepEqual(await parcoursDe(bob), [['antiquite', 0], ['avant-1800', 1]], 'son parcours, au bout')
    const suite = await poster(banc, bob, '/api/campagne/sujets/epreuve', { sujet: 'avant-1800', palier: 2 })
    assert.equal(suite.status, 200, suite.corps.error)
    assert.deepEqual([suite.corps.sujet, suite.corps.palier], ['avant-1800', 2])
    // Léa, elle, ne le voit toujours pas.
    assert.deepEqual(await parcoursDe(lea), [['antiquite', 0]])
  } finally {
    await banc.close()
  }
})

test('une fête se propose et se joue comme un sujet — son sous-thème, son étiquette ailleurs — mais n’a pas de parcours', async () => {
  const halloween = Array.from({ length: 100 }, (_, i) => question(300 + i, 'Autour de la fête', { sousTheme: 'halloween' }))
  const ailleurs = Array.from({ length: 5 }, (_, i) => question(400 + i, 'Cinéma & séries', { etiquettes: ['halloween'] }))
  const banc = await demarrer({ baseDeLaCampagne: new BaseDeLaCampagne([...halloween, ...ailleurs]) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    // Cent questions dans son sous-thème : elle en tient la rubrique, qui ne se propose pas une seconde fois.
    assert.deepEqual((await lire(banc, lea, '/api/campagne')).corps.sujets, [{ sujet: 'halloween', questions: 105 }])
    const serie = (await poster(banc, lea, '/api/campagne/serie', { sujet: 'halloween' })).corps
    assert.equal(serie.sujet, 'halloween')
    const siennes = new Set([...halloween, ...ailleurs].map(q => q.id))
    assert.ok(tirees(banc, serie.id).every(id => siennes.has(id)), 'ses questions seules')
    // Cent cinq questions : un thème aurait son parcours ; une fête, non — le sentier de la fête la monte déjà.
    assert.deepEqual((await lire(banc, lea, '/api/campagne/sujets')).corps.sujets, [])
    const etape = await poster(banc, lea, '/api/campagne/sujets/epreuve', { sujet: 'halloween', palier: 1 })
    assert.deepEqual([etape.status, etape.corps.error], [400, 'Ce parcours n’existe pas'])
  } finally {
    await banc.close()
  }
})

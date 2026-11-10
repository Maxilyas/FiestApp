// Deux questions qui posent le même fait sous deux intitulés : l'empreinte
// les laissait entrer dans la base de la campagne, d'une catégorie à
// l'autre — Gotham City en lettres et au cinéma, l'Hindenburg en culture
// générale et en histoire. La règle (`core/memeFait.ts`) : la même bonne
// réponse et une chose en commun — une entité hors la réponse, ou l'essentiel
// des mots —, ou deux questions retournées, la réponse de chacune étant le
// sujet de l'autre ; ou, dans un seul sens, la réponse chiffrée de l'une déjà
// écrite dans l'intitulé de l'autre. Le script de la base et le dépôt de la
// routine la lisent tous les deux (`campagne-routine.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { IndexDesFaits, faitDe, memeFait, motifDuMemeFait, normeDUnNom, presquePareils, traitsDe } from '../src/core/memeFait'
import { SOUS_THEMES } from '../../shared/etiquettes'
import type { Categorie } from '../../shared/categories'

type Entite = [nom: string, type: string]

/** Une question de la base, la bonne réponse en premier, relue par le juge de la base. */
function question(
  texte: string,
  reponses: string[],
  { entites = [] as Entite[], valeur = null as { nombre: number; unite: string } | null, categorie = 'Culture générale' as Categorie } = {},
): QuestionDeLaBase {
  const mauvaises = reponses.slice(1)
  const lu = lireQuestionDeLaBase(
    {
      texte,
      reponses,
      bonne: 0,
      anecdote: 'Une anecdote vraie.',
      categorie,
      sousTheme: SOUS_THEMES[categorie][0].cle,
      etiquettes: [],
      difficulte: 3,
      ageMin: 10,
      date: null,
      entites: entites.map(([nom, type]) => ({ nom, type, description: 'pour lever l’homonymie' })),
      portee: 'monde',
      valeur,
      leurres: reponses.length === 2 ? [reponses[1]] : [...mauvaises, 'Leurre un', 'Leurre deux', 'Leurre trois'],
      dureeDeVie: 'stable',
      explication: '',
      source: null,
      confiance: 3,
      aRelire: [],
    },
    { sansId: true },
  )
  if ('refus' in lu) throw new Error(`${texte} : ${lu.refus}`)
  return lu.question
}

const meme = (a: QuestionDeLaBase, b: QuestionDeLaBase) => memeFait(faitDe(a)!, faitDe(b)!)

const gotham = question('Dans quelle ville imaginaire Batman protège-t-il les habitants ?', ['Gotham City', 'Metropolis', 'Star City', 'Central City'], {
  entites: [
    ['Gotham City', 'lieu'],
    ['Batman', 'personnage'],
  ],
  categorie: 'Arts & lettres',
})
const gothamAuCinema = question('Comment se nomme la cité que le justicier masqué de DC Comics veille la nuit ?', ['Gotham City', 'Metropolis', 'Smallville', 'Coast City'], {
  entites: [['Batman', 'personnage']],
  categorie: 'Cinéma & séries',
})

test('le même fait sous un autre intitulé : une entité en commun hors la réponse, ou l’essentiel des mots', () => {
  assert.equal(meme(gotham, gothamAuCinema), true, 'Batman, des deux côtés')
  // Aucune entité commune hors la réponse : les mots le disent, la même année aussi.
  const athenes = question('En 1896, quelle ville accueille les premiers Jeux olympiques modernes ?', ['Athènes', 'Paris', 'Londres', 'Rome'], { entites: [['Athènes', 'lieu']] })
  const athenesRetournee = question('Dans quelle ville se tiennent, en 1896, les premiers Jeux olympiques de l’ère moderne ?', ['Athènes', 'Rome', 'Paris', 'Berlin'], {
    entites: [['Pierre de Coubertin', 'personne']],
    categorie: 'Histoire',
  })
  assert.equal(meme(athenes, athenesRetournee), true)
})

test('la même réponse ne fait pas le même fait : Victor Hugo, une année, un nombre', () => {
  const miserables = question('Qui a écrit le roman Les Misérables ?', ['Victor Hugo', 'Émile Zola', 'Honoré de Balzac', 'Alexandre Dumas'], {
    entites: [['Les Misérables', 'oeuvre']],
  })
  const pantheon = question('Quel écrivain entre au Panthéon lors de funérailles nationales en 1885 ?', ['Victor Hugo', 'Voltaire', 'Émile Zola', 'Jean Jaurès'], {
    entites: [['Panthéon', 'lieu']],
  })
  assert.equal(meme(miserables, pantheon), false)
  // Les mêmes mots, deux années : deux Coupes du monde, la France les deux fois.
  const en1998 = question('Quel pays remporte la Coupe du monde de football en 1998 ?', ['France', 'Brésil', 'Italie', 'Croatie'], {
    entites: [['Coupe du monde de football 1998', 'evenement']],
    categorie: 'Sport',
  })
  const en2018 = question('Quel pays remporte la Coupe du monde de football en 2018 ?', ['France', 'Croatie', 'Belgique', 'Brésil'], {
    entites: [['Coupe du monde de football 2018', 'evenement']],
    categorie: 'Sport',
  })
  assert.equal(meme(en1998, en2018), false)
  // Une réponse chiffrée répond à des questions taillées pareil.
  const cordes = (instrument: string) =>
    question(`Combien de cordes compte un ${instrument} d’orchestre ?`, ['4', '5', '6', '7'], { valeur: { nombre: 4, unite: 'cordes' }, categorie: 'Musique' })
  assert.equal(meme(cordes('violon'), cordes('alto')), false)
  // Un vrai ou faux ne dit rien du fait par sa réponse.
  assert.equal(faitDe(question('La baleine bleue est un mammifère.', ['Vrai', 'Faux'], { categorie: 'Nature' })), null)
})

test('retournée, la même question l’est encore : la réponse de chacune est le sujet de l’autre', () => {
  const chaplin = question('Quel acteur britannique a créé le personnage du vagabond Charlot ?', ['Charlie Chaplin', 'Buster Keaton', 'Harold Lloyd', 'Stan Laurel'], {
    entites: [['Charlot', 'personnage']],
    categorie: 'Cinéma & séries',
  })
  const charlot = question('Quel nom les Français donnent-ils au vagabond incarné par Charlie Chaplin ?', ['Charlot', 'Fantômas', 'Arsène', 'Gavroche'], {
    entites: [['Charlie Chaplin', 'personne']],
    categorie: 'Jeux & pop culture',
  })
  assert.equal(meme(chaplin, charlot), true)
  // Un seul sens ne suffit pas : Chaplin a tourné bien d'autres films.
  const temps = question('Quel film de 1936 montre Charlie Chaplin pris dans les rouages d’une usine ?', ['Les Temps modernes', 'Le Kid', 'La Ruée vers l’or', 'Le Dictateur'], {
    entites: [['Charlie Chaplin', 'personne']],
    categorie: 'Cinéma & séries',
  })
  assert.equal(meme(chaplin, temps), false)
})

test('retournées par l’intitulé : chacune écrit la réponse de l’autre, et elles parlent de la même chose', () => {
  // La première génération en nombre les a écrites le même jour, en culture
  // générale et en géographie : seul leur correcteur, qui les avait sur la même fiche, les a vues.
  const dragon = question('Quel animal fabuleux figure sur le drapeau du Bhoutan ?', ['Dragon', 'Phénix', 'Griffon', 'Licorne'], {
    entites: [
      ['Drapeau du Bhoutan', 'objet'],
      ['Himalaya', 'lieu'],
    ],
    categorie: 'Culture générale',
  })
  const bhoutan = question('Quel pays de l’Himalaya a un dragon blanc sur son drapeau ?', ['Bhoutan', 'Népal', 'Tibet', 'Sikkim'], {
    entites: [
      ['Bhoutan', 'lieu'],
      ['Drapeau du Bhoutan', 'objet'],
      ['Himalaya', 'lieu'],
    ],
    categorie: 'Géographie',
  })
  assert.equal(meme(dragon, bhoutan), true)
  assert.equal(new IndexDesFaits([dragon]).chercher(bhoutan), dragon, 'd’une catégorie à l’autre')
  assert.deepEqual([...new IndexDesFaits([dragon, bhoutan]).paires()], [[dragon, bhoutan]], 'deux entités en commun, une seule paire')
  // D'un seul sens, deux faits : le drapeau du Bhoutan a aussi ses couleurs.
  const couleurs = question('Quelles couleurs partagent en deux triangles le drapeau du Bhoutan ?', ['Jaune et orange', 'Rouge et blanc', 'Vert et jaune', 'Bleu et blanc'], {
    entites: [['Drapeau du Bhoutan', 'objet']],
    categorie: 'Géographie',
  })
  assert.equal(meme(bhoutan, couleurs), false)
  assert.equal(meme(dragon, couleurs), false)
  // Sans rien dont elles parlent toutes deux, deux questions qui se citent posent deux faits : le peintre, le musée.
  const peintre = question('Quel peintre a peint La Joconde, exposée au Louvre ?', ['Léonard de Vinci', 'Raphaël', 'Titien', 'Botticelli'], {
    entites: [['La Joconde', 'oeuvre']],
    categorie: 'Arts & lettres',
  })
  const musee = question('Quel musée parisien expose une célèbre toile de Léonard de Vinci ?', ['Le Louvre', 'Orsay', 'Le Petit Palais', 'Beaubourg'], {
    entites: [['Musée du Louvre', 'lieu']],
    categorie: 'Arts & lettres',
  })
  assert.equal(meme(peintre, musee), false)
})

// Le 9 novembre 2026, 36 des 140 questions à nombre écrites pour le Filet du
// Cabinet passaient le juge avec leur réponse déjà écrite dans la base : la
// date d'une œuvre est dans l'intitulé qui demande son auteur. L'autre
// question ne l'écrit pas en retour — « Eugène Delacroix » n'est pas dans
// l'intitulé qui demande l'année, seulement « Delacroix » —, et une réponse
// chiffrée ne se jugeait que par ses entités, à réponse égale.
const peintre = question('Quel peintre a représenté la révolution de Juillet 1830 dans La Liberté guidant le peuple ?', ['Eugène Delacroix', 'Théodore Géricault', 'Jacques-Louis David', 'Gustave Courbet'], {
  entites: [
    ['La Liberté guidant le peuple', 'oeuvre'],
    ['Eugène Delacroix', 'personne'],
  ],
  categorie: 'Arts & lettres',
})
const annee = question('En quelle année Delacroix peint-il La Liberté guidant le peuple ?', ['1830', '1815', '1848', '1871'], {
  entites: [
    ['Eugène Delacroix', 'personne'],
    ['La Liberté guidant le peuple', 'oeuvre'],
  ],
  valeur: { nombre: 1830, unite: '' },
  categorie: 'Arts & lettres',
})
// La base n'a pour entité que sa réponse : c'est d'elle que parle la question à nombre.
const zaire = question('Quel pays d’Afrique centrale s’est appelé Zaïre de 1971 à 1997 ?', ['République démocratique du Congo', 'République du Congo', 'Angola', 'Gabon'], {
  entites: [['République démocratique du Congo', 'lieu']],
  categorie: 'Géographie',
})
const en1997 = question('En quelle année le Zaïre reprend-il le nom de République démocratique du Congo ?', ['1997', '1960', '1971', '2006'], {
  entites: [
    ['Zaïre', 'lieu'],
    ['République démocratique du Congo', 'lieu'],
  ],
  valeur: { nombre: 1997, unite: '' },
  categorie: 'Géographie',
})

test('une réponse chiffrée retournée : écrite dans l’intitulé d’une autre question, qui parle de la même chose', () => {
  assert.equal(meme(annee, peintre), true, 'le tableau des deux côtés, et 1830 dans l’intitulé')
  assert.equal(meme(peintre, annee), true, 'dans les deux sens : jouées toutes deux, l’une donne la réponse de l’autre')
  assert.equal(meme(en1997, zaire), true, 'la réponse de l’autre parmi ses entités, et 1997 dans l’intitulé')
  assert.equal(meme(zaire, en1997), true)
  // Écrite autrement, c'est le même nombre : « 330 m » et « 330 mètres ».
  const hauteur = question('Quelle hauteur la tour Eiffel atteint-elle, antennes comprises, en mètres ?', ['330 m', '300 m', '312 m', '324 m'], {
    entites: [['Tour Eiffel', 'lieu']],
    valeur: { nombre: 330, unite: 'm' },
    categorie: 'Géographie',
  })
  const monument = question('Quel monument parisien, haut de 330 mètres, a été bâti pour l’Exposition universelle de 1889 ?', ['La tour Eiffel', 'Le Grand Palais', 'Le Trocadéro', 'Le Sacré-Cœur'], {
    entites: [['Exposition universelle de 1889', 'evenement']],
    categorie: 'Histoire',
  })
  assert.equal(meme(hauteur, monument), true)
  // Un jour de l'année s'écrit entier : « le 14 juillet ».
  const fete = question('Quel jour la France célèbre-t-elle sa fête nationale ?', ['Le 14 juillet', 'Le 4 août', 'Le 8 mai', 'Le 11 novembre'], {
    entites: [['Fête nationale française', 'evenement']],
    categorie: 'Autour de la fête',
  })
  const depuis = question('En quelle année le 14 Juillet est-il devenu la fête nationale française ?', ['1880', '1789', '1848', '1870'], {
    entites: [['Fête nationale française', 'evenement']],
    valeur: { nombre: 1880, unite: '' },
    categorie: 'Histoire',
  })
  assert.equal(meme(fete, depuis), true)
})

test('l’entité commune décide, pas un mot commun, ni un nombre qui se croise', () => {
  // Un contrôle par nom propre commun les rapprochait, le 9 novembre 2026 : la tour et le Tour, la Finlande et l'« Empire ».
  const montparnasse = question('En quelle année la tour Montparnasse, à Paris, est-elle achevée ?', ['1973', '1965', '1969', '1981'], {
    entites: [['Tour Montparnasse', 'lieu']],
    valeur: { nombre: 1973, unite: '' },
    categorie: 'Géographie',
  })
  const ocana = question('Qui a remporté le classement général du Tour de France 1973 ?', ['Luis Ocaña', 'Eddy Merckx', 'Bernard Thévenet', 'Raymond Poulidor'], {
    entites: [
      ['Tour de France 1973', 'evenement'],
      ['Luis Ocaña', 'personne'],
    ],
    categorie: 'Sport',
  })
  assert.equal(meme(montparnasse, ocana), false)
  const finlande = question('En quelle année la Finlande proclame-t-elle son indépendance, après l’Empire russe ?', ['1917', '1905', '1921', '1939'], {
    entites: [['Finlande', 'lieu']],
    valeur: { nombre: 1917, unite: '' },
    categorie: 'Géographie',
  })
  const tsar = question('Quel tsar abdique en mars 1917, à la chute de l’Empire russe ?', ['Nicolas II', 'Alexandre III', 'Alexandre II', 'Nicolas Ier'], {
    entites: [
      ['Empire russe', 'lieu'],
      ['Nicolas II', 'personne'],
    ],
    categorie: 'Histoire',
  })
  assert.equal(meme(finlande, tsar), false)
  // La même œuvre, un autre nombre dans l'intitulé : un autre fait.
  const salon = question('Quelle toile de Delacroix l’État achète-t-il au Salon de 1831 ?', ['La Liberté guidant le peuple', 'La Mort de Sardanapale', 'Scènes des massacres de Scio', 'Dante et Virgile aux enfers'], {
    entites: [['Eugène Delacroix', 'personne']],
    categorie: 'Arts & lettres',
  })
  assert.equal(meme(annee, salon), false)
  // Un petit nombre se croise par hasard : vingt-quatre épisodes, et un 24 mai.
  const lost: Entite = ['Lost : Les Disparus', 'oeuvre']
  const episodes = question('Combien d’épisodes compte la deuxième saison de « Lost : Les Disparus » ?', ['24', '22', '23', '25'], {
    entites: [lost],
    valeur: { nombre: 24, unite: 'épisodes' },
    categorie: 'Cinéma & séries',
  })
  const finale = question('Quelle finale de saison de « Lost : Les Disparus », centrée sur Desmond, est diffusée le 24 mai 2006 ?', ['Vivre ensemble, mourir seul', 'L’Exode', 'Au cœur de la jungle', 'Le Début de la fin'], {
    entites: [lost],
    categorie: 'Cinéma & séries',
  })
  assert.equal(meme(episodes, finale), false)
  // Sauf quand l'autre a pour réponse ce dont on demande le nombre : la même question, retournée.
  const noces = question('Après combien d’années de mariage célèbre-t-on les noces d’or ?', ['50', '25', '40', '60'], {
    entites: [['Noces d’or', 'evenement']],
    valeur: { nombre: 50, unite: 'ans' },
    categorie: 'Autour de la fête',
  })
  const cinquante = question('Comment appelle-t-on les 50 ans de mariage ?', ['Les noces d’or', 'Les noces d’argent', 'Les noces de diamant', 'Les noces de perle'], { categorie: 'Autour de la fête' })
  assert.equal(meme(noces, cinquante), true)
  // Un chiffre collé à des lettres n'est pas ce nombre : « M6 » n'écrit pas 6.
  const fiscale = question('À quelle date commence l’année fiscale des particuliers au Royaume-Uni ?', ['6 avril', '1er janvier', '1er avril', '5 juillet'], {
    entites: [
      ['Année fiscale britannique', 'notion'],
      ['Royaume-Uni', 'lieu'],
    ],
    categorie: 'Autour de la fête',
  })
  const diner = question('Dans quel pays est né le format de l’émission « Un dîner presque parfait », adaptée sur M6 ?', ['Royaume-Uni', 'Allemagne', 'Pays-Bas', 'Suède'], {
    entites: [['Un dîner presque parfait', 'oeuvre']],
    categorie: 'Jeux & pop culture',
  })
  assert.equal(meme(fiscale, diner), false)
  // Une entité qui porte le nombre dans son nom n'est que la réponse : toute question sur la Coupe du monde 2018 écrit 2018.
  const mondial: Entite = ['Coupe du monde de football 2018', 'evenement']
  const video = question('En quelle année l’assistance vidéo à l’arbitrage fait-elle ses débuts en Coupe du monde ?', ['2018', '2010', '2014', '2022'], {
    entites: [['Assistance vidéo à l’arbitrage', 'notion'], mondial],
    valeur: { nombre: 2018, unite: '' },
    categorie: 'Sport',
  })
  const russie = question('En 2018, quel pays organise la Coupe du monde de football, remportée par la France ?', ['Russie', 'Brésil', 'Qatar', 'Afrique du Sud'], { entites: [mondial], categorie: 'Sport' })
  assert.equal(meme(video, russie), false)
})

test('l’index trouve la réponse chiffrée retournée dans les deux sens, par ses entités', () => {
  assert.equal(new IndexDesFaits([peintre, zaire]).chercher(annee), peintre)
  assert.equal(new IndexDesFaits([peintre, zaire]).chercher(en1997), zaire, 'par la réponse de l’autre, rangée parmi ses entités')
  // La question à nombre est déjà là : celle qui écrit sa réponse arrive.
  assert.equal(new IndexDesFaits([annee, en1997]).chercher(peintre), annee)
  assert.equal(new IndexDesFaits([annee, en1997]).chercher(zaire), en1997, 'par sa réponse, dont parle la question à nombre')
  assert.deepEqual([...new IndexDesFaits([zaire, en1997]).paires()], [[zaire, en1997]])
  assert.deepEqual([...new IndexDesFaits([en1997, zaire]).paires()], [[en1997, zaire]], 'quel que soit l’ordre d’arrivée')
  // Le motif dit à chacune ce qu'elle peut faire : la question à nombre s'écrit sur un autre fait, l'autre peut retirer le nombre.
  assert.equal(motifDuMemeFait(peintre, annee), 'pose sans doute le même fait que « Quel peintre a représenté la révolution de Juillet 1830 dans La Liberté guidant le peuple ? » (Arts & lettres) : écris-en un autre')
  assert.equal(
    motifDuMemeFait(annee, peintre),
    'donne dans son intitulé la réponse (1830) de « En quelle année Delacroix peint-il La Liberté guidant le peuple ? » (Arts & lettres) : retire-la de l’intitulé, ou écris une autre question',
  )
  assert.equal(motifDuMemeFait(gotham, gothamAuCinema), motifDuMemeFait(gotham), 'le même fait posé deux fois : le motif de toujours')
})

test('la même grandeur est la même réponse : avec ou sans son unité, ou dans une autre', () => {
  // La base avait les noces d'or deux fois, « 50 ans » et « 50 », la semaine du Front populaire en « 40 h » et en
  // « 40 heures » ; et le 9 novembre 2026, une canette en centilitres passait à côté de la canette de 330 ml.
  const regne = (texte: string, reponses: string[]) =>
    question(texte, reponses, { entites: [['Louis XIV', 'personne']], valeur: { nombre: 72, unite: 'ans' }, categorie: 'Histoire' })
  assert.equal(
    meme(regne('Combien d’années Louis XIV a-t-il régné, l’un des plus longs règnes d’Europe ?', ['72 ans', '54 ans', '61 ans', '80 ans']), regne('Pendant combien d’années Louis XIV règne-t-il, de 1643 à 1715 ?', ['72', '59', '64', '77'])),
    true,
  )
  const semaine = (texte: string, reponses: string[], unite: string) =>
    question(texte, reponses, { entites: [['Front populaire', 'organisation']], valeur: { nombre: 40, unite }, categorie: 'Histoire' })
  assert.equal(
    meme(
      semaine('En 1936, à combien d’heures par semaine le Front populaire limite-t-il la durée du travail ?', ['40 h', '35 h', '39 h', '48 h'], 'h'),
      semaine('Quelle durée légale de la semaine de travail le Front populaire fixe-t-il en juin 1936 ?', ['40 heures', '35 heures', '45 heures', '48 heures'], 'heures'),
    ),
    true,
  )
  const canette = (texte: string, reponses: string[], valeur: { nombre: number; unite: string }, entite = 'Canette') =>
    question(texte, reponses, { entites: [[entite, 'objet']], valeur, categorie: 'Cuisine' })
  const enMillilitres = canette('Quelle est la contenance, en millilitres, d’une canette de soda standard en Europe ?', ['330 mL', '250 mL', '300 mL', '500 mL'], { nombre: 330, unite: 'mL' })
  const enCentilitres = canette('Quelle est, en centilitres, la contenance standard d’une canette de soda ?', ['33 cl', '25 cl', '30 cl', '50 cl'], { nombre: 33, unite: 'cl' })
  assert.equal(meme(enCentilitres, enMillilitres), true, '33 cl et 330 ml')
  assert.equal(new IndexDesFaits([enMillilitres]).chercher(enCentilitres), enMillilitres)
  // Sans rien dont elles parlent toutes deux, deux grandeurs égales restent deux faits — comme deux réponses égales.
  assert.equal(meme(enCentilitres, canette('Combien de millilitres contient une petite bouteille de soda en verre ?', ['330 ml', '200 ml', '250 ml', '500 ml'], { nombre: 330, unite: 'ml' }, 'Bouteille en verre')), false)
  // Les durées ne se convertissent pas : cent soixante-huit heures et sept jours répondent à deux questions.
  const duree = (texte: string, reponses: string[], valeur: { nombre: number; unite: string }) =>
    question(texte, reponses, { entites: [['Semaine', 'notion']], valeur, categorie: 'Culture générale' })
  assert.equal(
    meme(duree('Combien d’heures compte une semaine ?', ['168', '144', '148', '196'], { nombre: 168, unite: 'heures' }), duree('Combien de jours compte une semaine ?', ['7', '5', '6', '8'], { nombre: 7, unite: 'jours' })),
    false,
  )
  // La valeur étiquetée est parfois celle de l'intitulé, pas de la réponse : « Apollo 11 », étiquetée 1969, n'est pas l'année 1969.
  const armstrong: Entite = ['Neil Armstrong', 'personne']
  const sur1969 = { entites: [armstrong], valeur: { nombre: 1969, unite: '' }, categorie: 'Sciences' as const }
  assert.equal(
    meme(question('Quelle mission pose Neil Armstrong sur la Lune ?', ['Apollo 11', 'Apollo 8', 'Apollo 13', 'Gemini 4'], sur1969), question('En quelle année Neil Armstrong marche-t-il sur la Lune ?', ['1969', '1961', '1965', '1972'], sur1969)),
    false,
  )
  // Ni deux unités sans rapport : onze joueurs, onze mètres.
  const foot = (texte: string, reponses: string[], valeur: { nombre: number; unite: string }) =>
    question(texte, reponses, { entites: [['Football', 'notion']], valeur, categorie: 'Sport' })
  assert.equal(
    meme(foot('Combien de joueurs une équipe de football aligne-t-elle au coup d’envoi ?', ['11', '9', '10', '12'], { nombre: 11, unite: 'joueurs' }), foot('À combien de mètres du but se tire un penalty au football ?', ['11 m', '9 m', '10 m', '12 m'], { nombre: 11, unite: 'm' })),
    false,
  )
})

test('un nom se compare sans ce qui ne le distingue pas : préposition, article, accents, ponctuation', () => {
  assert.equal(normeDUnNom('En Belgique'), normeDUnNom('la Belgique'))
  assert.equal(normeDUnNom('L’Algérie'), normeDUnNom("l'Algerie"))
  assert.equal(normeDUnNom('Le canal de Suez'), normeDUnNom('Canal de Suez'))
  assert.notEqual(normeDUnNom('Le Havre'), normeDUnNom('Havre-Saint-Pierre'))
})

test('l’index trouve le fait d’une base d’une catégorie à l’autre, et dit chaque paire une fois', () => {
  // Une autre réponse, et la même entité : un autre fait.
  const autre = question('Quel village anglais a donné son surnom à New York, puis son nom à la ville de Batman ?', ['Gotham', 'Bibury', 'Lacock', 'Castle Combe'], {
    entites: [['Batman', 'personnage']],
  })
  const index = new IndexDesFaits([gotham, autre])
  assert.equal(index.chercher(gothamAuCinema), gotham)
  assert.equal(index.chercher(question('Quelle ville américaine borde le lac Michigan au sud-ouest ?', ['Chicago', 'Detroit', 'Milwaukee', 'Toledo'])), undefined)
  index.ajouter(gothamAuCinema)
  assert.deepEqual([...index.paires()], [[gotham, gothamAuCinema]])
  assert.equal(motifDuMemeFait(gotham), 'pose sans doute le même fait que « Dans quelle ville imaginaire Batman protège-t-il les habitants ? » (Arts & lettres) : écris-en un autre')
})

test('deux intitulés presque pareils, que `voisines` montre : pas deux années d’un même palmarès', () => {
  // Au pilote de Wikidata du 10 octobre 2026, les vainqueurs des grands tours, année par année, faisaient mille paires.
  const voisins = (a: string, b: string) => presquePareils(traitsDe(a), traitsDe(b))
  assert.ok(voisins('Quel peintre a réalisé « La Ronde de nuit » ?', 'Quel peintre a réalisé « La Ronde des prisonniers » ?'))
  assert.ok(!voisins('Qui a remporté le classement général du Tour de France 1976 ?', 'Qui a remporté le classement général du Tour de France 1977 ?'), 'deux années, deux faits')
  assert.ok(voisins('Qui a remporté le Tour de France 1976 ?', 'En 1976, qui a remporté le Tour de France ?'), 'la même année, presque le même intitulé')
  assert.ok(voisins('Qui a remporté le Tour de France 1976 ?', 'Qui a remporté le Tour de France ?'), 'un nombre d’un seul côté ne dit rien')
  assert.ok(!voisins('Quel peintre a réalisé « La Ronde de nuit » ?', 'Quelle est la capitale du Pérou ?'))
})

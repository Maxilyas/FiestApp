// Deux questions qui posent le même fait sous deux intitulés : l'empreinte
// les laissait entrer dans la base de la campagne, d'une catégorie à
// l'autre — Gotham City en lettres et au cinéma, l'Hindenburg en culture
// générale et en histoire. La règle (`core/memeFait.ts`) : la même bonne
// réponse et une chose en commun — une entité hors la réponse, ou l'essentiel
// des mots —, ou deux questions retournées, la réponse de chacune étant le
// sujet de l'autre. Le script de la base et le dépôt de la routine la lisent
// tous les deux (`campagne-routine.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { IndexDesFaits, faitDe, memeFait, motifDuMemeFait, normeDUnNom } from '../src/core/memeFait'
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

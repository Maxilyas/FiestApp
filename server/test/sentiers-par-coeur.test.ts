// Ce qui s'apprend par cœur — une année, le réalisateur d'un film — ne fait
// plus une épreuve à lui seul : aucune question de ces sortes aux quatre
// premiers paliers, deux au plus ensuite, tant que la marche en a d'autres
// aussi fraîches (`seSaitParCoeur`, `RegleDuPalier.parCoeurMax`,
// `tirerUneEpreuve`). Et une personne se mesure à part des autres mots
// (`FormeDeReponse`, `familleDeQuestion`).
//
// Le retour d'un joueur du 1er novembre 2026 : « ce qui rendait le sentier
// difficile c'est surtout le nom de réalisateur inconnu, ou bien de film qui
// date de trop longtemps. Pareil pour les dates […] c'est à chaque fois un
// peu au pif ». En production ce jour-là, au septième palier du sentier du
// cinéma, deux questions sur cinq en étaient, trouvées à 31 %, et deux
// épreuves sur douze s'y validaient.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { familleDeQuestion, formeDeReponse, reponseEstUnePersonne, seSaitParCoeur } from '../../shared/campagne'
import { PALIERS, PAR_COEUR_DES, PAR_COEUR_PAR_EPREUVE, regleDuPalier } from '../../shared/sentiers'
import { PALIERS_DES_SUJETS } from '../../shared/sentiersDeSujets'
import { chapitreDuPalier } from '../../shared/chapitres'
import { BRANCHES } from '../../shared/branches'
import { lireLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { tirerUneEpreuve } from '../src/core/campagne'

const MAINTENANT = Date.UTC(2026, 10, 1, 12)
const CINEMA = 'Cinéma & séries'

const parCoeur = (q: QuestionDeLaBase) =>
  seSaitParCoeur({ texte: q.texte, reponses: q.reponses, bonne: q.bonne, valeur: q.meta.valeur, categorie: q.meta.categorie, entites: q.meta.entites })

type Sorte = 'realisateur' | 'annee' | 'film'

/** Une question de cinéma valide : demander un réalisateur, une année, ou un film. */
function deCinema(id: string, sorte: Sorte, { sousTheme = 'cinema-monde', difficulte = 2 }: { sousTheme?: string; difficulte?: number } = {}): QuestionDeLaBase {
  const n = Number(id.replace(/\D/g, '')) || 0
  const commun = {
    id,
    bonne: 0,
    anecdote: null,
    categorie: CINEMA,
    sousTheme,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    portee: 'monde',
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  }
  const lu = lireQuestionDeLaBase(
    sorte === 'realisateur'
      ? {
          ...commun,
          texte: `Qui a réalisé le film d'essai numéro ${n} ?`,
          reponses: [`Cinéaste Juste${n}`, `Cinéaste Autre${n}`, `Cinéaste Troisième${n}`, `Cinéaste Quatrième${n}`],
          leurres: [`Cinéaste Autre${n}`, `Cinéaste Troisième${n}`, `Cinéaste Quatrième${n}`],
          date: null,
          entites: [{ nom: `Cinéaste Juste${n}`, type: 'personne', description: 'cinéaste' }],
          valeur: null,
        }
      : sorte === 'annee'
        ? {
            ...commun,
            texte: `En quelle année est sorti le film d'essai numéro ${n} ?`,
            reponses: [String(1950 + (n % 40)), String(1940 + (n % 40)), String(1960 + (n % 40)), String(1970 + (n % 40))],
            leurres: [String(1940 + (n % 40)), String(1960 + (n % 40)), String(1970 + (n % 40))],
            date: { valeur: String(1950 + (n % 40)), precision: 'annee' },
            entites: [],
            valeur: { nombre: 1950 + (n % 40), unite: '' },
          }
        : {
            ...commun,
            texte: `Dans quel film d'essai numéro ${n} voit-on la scène attendue ?`,
            reponses: [`Film juste ${n}`, `Film autre ${n}`, `Film troisième ${n}`, `Film quatrième ${n}`],
            leurres: [`Film autre ${n}`, `Film troisième ${n}`, `Film quatrième ${n}`],
            date: null,
            entites: [],
            valeur: null,
          },
  )
  if ('refus' in lu) throw new Error(`${id} : ${lu.refus}`)
  return lu.question
}

/** Des questions de chaque sorte, à chaque difficulté des douze paliers et du maître. */
function tasDeCinema(combien: Readonly<Partial<Record<Sorte, number>>>, options: { sousTheme?: string } = {}): QuestionDeLaBase[] {
  let i = 0
  return (Object.entries(combien) as [Sorte, number][]).flatMap(([sorte, n]) =>
    Array.from({ length: n }, () => {
      i++
      return deCinema(`${sorte.slice(0, 2)}${String(i).padStart(6, '0')}`, sorte, { ...options, difficulte: 1 + (i % 5) })
    }),
  )
}

test('ce qui s’apprend par cœur : une année, celui qui a réalisé un film ou créé une série — pas le peintre, ni le film', () => {
  const q = (texte: string, reponse: string, { categorie = CINEMA, type = 'personne', valeur = null as { unite: string } | null } = {}) => ({
    texte,
    reponses: [reponse, 'Autre A', 'Autre B', 'Autre C'],
    bonne: 0,
    valeur,
    categorie,
    entites: [{ nom: reponse, type }],
  })
  assert.ok(seSaitParCoeur(q('En quelle année est sorti Le Mépris ?', '1963', { type: 'oeuvre', valeur: { unite: '' } })))
  assert.ok(seSaitParCoeur(q('Qui a réalisé le film Le Mépris ?', 'Jean-Luc Godard')))
  assert.ok(seSaitParCoeur(q('Quelle réalisatrice a signé Portrait de la jeune fille en feu ?', 'Céline Sciamma')))
  assert.ok(seSaitParCoeur(q('Quel cinéaste japonais a tourné Les Sept Samouraïs ?', 'Akira Kurosawa')))
  assert.ok(seSaitParCoeur(q('Qui a créé la série Twin Peaks avec Mark Frost ?', 'David Lynch')))
  assert.ok(seSaitParCoeur(q('Qui a réalisé le film Metropolis, sorti en 1927 ?', 'Fritz Lang', { categorie: 'Arts & lettres' })), 'un film, hors du cinéma')
  assert.ok(!seSaitParCoeur(q('Quel peintre a réalisé La Joconde ?', 'Léonard de Vinci', { categorie: 'Arts & lettres' })), 'pas un film')
  assert.ok(!seSaitParCoeur(q('Quel film Steven Spielberg a-t-il réalisé en 1993 ?', 'Jurassic Park', { type: 'oeuvre' })), 'un film, pas une personne')
  assert.ok(!seSaitParCoeur(q('Quel studio a réalisé Toy Story ?', 'Pixar', { type: 'organisation' })))
  assert.ok(!seSaitParCoeur(q('Quel acteur joue Indiana Jones ?', 'Harrison Ford')), 'un acteur se voit à l’écran')
  assert.ok(!seSaitParCoeur(q('Quel peintre réaliste a peint Un enterrement à Ornans ?', 'Gustave Courbet', { categorie: 'Arts & lettres' })), '« réaliste » n’est pas « réalisé »')
  assert.ok(!seSaitParCoeur(q('Qui a réalisé la première ascension de l’Everest ?', 'Edmund Hillary', { categorie: 'Sport' })), 'réaliser un exploit')
  assert.ok(!seSaitParCoeur(q('En quel siècle vécut Molière ?', 'Au XVIIe siècle', { type: 'periode' })))
})

test('une personne a sa forme, et sa famille dans sa catégorie ; sans ses entités, elle se lit en mots', () => {
  const godard = { reponses: ['Jean-Luc Godard', 'François Truffaut', 'Éric Rohmer', 'Claude Chabrol'], bonne: 0, valeur: null }
  const entites = [{ nom: 'Jean-Luc Godard', type: 'personne' }]
  assert.ok(reponseEstUnePersonne({ ...godard, entites }))
  assert.ok(reponseEstUnePersonne({ ...godard, entites: [{ nom: 'jean-luc GODARD', type: 'personne' }] }), 'sans casse ni accents')
  assert.ok(!reponseEstUnePersonne({ ...godard, entites: [{ nom: 'Jean-Luc Godard', type: 'personnage' }] }), 'un personnage n’en est pas une')
  assert.equal(formeDeReponse({ ...godard, entites }), 'personne')
  assert.equal(formeDeReponse(godard), 'mots')
  assert.equal(formeDeReponse({ reponses: ['1963', '1959', '1967', '1971'], bonne: 0, valeur: { unite: '' }, entites }), 'annee', 'une année reste une année')
  assert.equal(familleDeQuestion({ categorie: CINEMA, difficulte: 3, forme: 'personne' }), 'Cinéma & séries|personne|3')
  assert.notEqual(familleDeQuestion({ categorie: CINEMA, difficulte: 3, forme: 'personne' }), familleDeQuestion({ categorie: 'Sport', difficulte: 3, forme: 'personne' }))
  assert.notEqual(familleDeQuestion({ categorie: CINEMA, difficulte: 3, forme: 'personne' }), familleDeQuestion({ categorie: CINEMA, difficulte: 3, forme: 'mots' }))
  assert.equal(familleDeQuestion({ categorie: CINEMA, difficulte: 4, forme: 'personne' }), null)
})

test('aucune aux quatre premiers paliers, deux au plus ensuite et au maître ; les parcours de thème n’en savent rien', () => {
  for (const p of PALIERS) assert.equal(p.parCoeurMax, p.n >= PAR_COEUR_DES ? PAR_COEUR_PAR_EPREUVE : 0, `palier ${p.n}`)
  assert.deepEqual([PAR_COEUR_DES, PAR_COEUR_PAR_EPREUVE], [5, 2])
  // Un mélange réglé au QG garde le plafond de son palier.
  assert.equal(regleDuPalier(7, { 7: { moyen: 16 } })!.parCoeurMax, PAR_COEUR_PAR_EPREUVE)
  for (const p of PALIERS_DES_SUJETS) assert.equal(p.parCoeurMax, undefined)
})

test('une épreuve ne pose plus que ce que son palier permet de par cœur, tant que la marche a d’autres questions aussi fraîches', () => {
  const tas = tasDeCinema({ realisateur: 120, annee: 120, film: 160 })
  for (const n of [1, 3, 4, 5, 7, 10, 12, 13]) {
    const regle = regleDuPalier(n)!
    for (let essai = 0; essai < 20; essai++) {
      const epreuve = tirerUneEpreuve(tas, regle, new Map(), new Map(), MAINTENANT)
      assert.equal(epreuve.length, 16)
      const combien = epreuve.filter(x => parCoeur(x.question)).length
      assert.ok(combien <= regle.parCoeurMax!, `palier ${n} : ${combien} par cœur`)
    }
  }
  // Sans plafond — un parcours de thème —, le tirage les prend comme les autres.
  const sansPlafond = { ...regleDuPalier(7)!, parCoeurMax: undefined }
  const prises = Array.from({ length: 20 }, () => tirerUneEpreuve(tas, sansPlafond, new Map(), new Map(), MAINTENANT).filter(x => parCoeur(x.question)).length)
  assert.ok(prises.reduce((s, x) => s + x, 0) / prises.length > 4, 'six sur dix du tas sont par cœur')
})

test('le plafond cède à la fraîcheur et au thème du chapitre : jamais une redite pour l’éviter, jamais hors du thème', () => {
  // Les autres questions déjà vues il y a trois semaines : les par cœur jamais vues passent devant.
  const tas = tasDeCinema({ realisateur: 60, film: 60 })
  const vues = new Map(tas.filter(q => !parCoeur(q)).map((q, i) => [q.id, MAINTENANT - 21 * 86_400_000 + i]))
  const epreuve = tirerUneEpreuve(tas, regleDuPalier(3)!, vues, new Map(), MAINTENANT)
  assert.equal(epreuve.filter(x => vues.has(x.question.id)).length, 0, 'aucune redite tant qu’il reste du frais')
  // Un chapitre tout en réalisateurs reste son chapitre ; le reste de la catégorie ne le remplace pas.
  const chapitre = tasDeCinema({ realisateur: 60 }, { sousTheme: 'cinema-monde' })
  const ailleurs = tasDeCinema({ film: 60 }, { sousTheme: 'sagas' }).map(q => ({ ...q, id: `x${q.id.slice(1)}` }))
  const p3 = tirerUneEpreuve([...chapitre, ...ailleurs], regleDuPalier(3)!, new Map(), new Map(), MAINTENANT, ['cinema-monde'])
  assert.ok(p3.every(x => x.question.meta.sousTheme === 'cinema-monde'))
  // Et un tas sans autre chose : l'épreuve se joue quand même.
  const seuls = tasDeCinema({ annee: 60 })
  assert.equal(tirerUneEpreuve(seuls, regleDuPalier(1)!, new Map(), new Map(), MAINTENANT).length, 16)
})

test('sur la base livrée, le sentier du cinéma tient ses plafonds, chapitre par chapitre', () => {
  const ecran = BRANCHES.find(b => b.key === 'ecran')!
  const { questions } = lireLaBase()
  const jouables = questions.filter(q => q.meta.categorie === ecran.categorie)
  assert.ok(jouables.filter(parCoeur).length > 400, 'le cinéma en a des centaines')
  for (let n = 1; n <= 13; n++) {
    const regle = regleDuPalier(n)!
    const chapitre = chapitreDuPalier(ecran.key, n)?.sousThemes ?? []
    for (let essai = 0; essai < 5; essai++) {
      const epreuve = tirerUneEpreuve(jouables, regle, new Map(), new Map(), MAINTENANT, chapitre)
      const combien = epreuve.filter(x => parCoeur(x.question)).length
      assert.ok(combien <= regle.parCoeurMax!, `palier ${n} : ${combien} par cœur`)
    }
  }
})

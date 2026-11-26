// Une question d'univers dit de quel univers elle parle (`core/universNommes.ts`,
// le 26 novembre 2026) : hors de son thème — une série de toutes les
// catégories, le défi, le quiz tout prêt de l'écran commun —, son intitulé
// est tout ce que le joueur en lit. « Quel est le titre français de l'épisode
// 12 de la saison 6 ? » ne disait pas Lost ; la base en avait 391 ainsi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireLaBase, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { REPERES_DES_UNIVERS, universSansSonNom } from '../src/core/universNommes'
import { ETIQUETTES } from '../../shared/etiquettes'
import { SUJETS } from '../../shared/sujets'

/** Une entrée de lot, sans identifiant : ce que la routine du matin ou un rédacteur déposent. */
function entree(texte: string, etiquette: string, o: { reponses?: string[]; entites?: { nom: string; type: string; description: string }[] } = {}) {
  const reponses = o.reponses ?? ['Les Jaffa', 'Les Tok’ra', 'Les Asgard', 'Les Nox']
  return {
    texte,
    reponses,
    bonne: 0,
    anecdote: null,
    categorie: 'Cinéma & séries',
    sousTheme: 'series',
    etiquettes: [etiquette],
    difficulte: 3,
    ageMin: 10,
    date: null,
    entites: o.entites ?? [{ nom: 'Teal’c', type: 'personnage', description: 'guerrier jaffa' }],
    portee: 'monde',
    valeur: null,
    leurres: [...reponses.slice(1), 'Les Wraith', 'Les Ori'],
    dureeDeVie: 'stable',
    explication: 'La réponse, et pourquoi.',
    source: { titre: 'Stargate SG-1', site: 'wikipedia-fr' },
    confiance: 3,
    aRelire: [],
  }
}

const verdict = (texte: string, etiquette = 'stargate', o?: Parameters<typeof entree>[2]) => {
  const lu = lireQuestionDeLaBase(entree(texte, etiquette, o), { sansId: true })
  return 'refus' in lu ? lu.refus : 'acceptée'
}

test('une question neuve d’un univers qui ne le nomme pas se refuse, et le refus dit quoi écrire', () => {
  const refus = verdict('De quelle race de guerriers vient Teal’c, qui a trahi Apophis ?')
  assert.match(refus, /ne dit pas de quel univers il parle : nomme Stargate/)
  assert.match(refus, /« Dans Stargate, … »/)
  assert.equal(verdict('Dans « Stargate SG-1 », de quelle race de guerriers vient Teal’c, qui a trahi Apophis ?'), 'acceptée')
  // Le titre d'un épisode ne dit pas une série : « Révélations » ne dit Stargate à personne.
  assert.match(verdict('Dans « Révélations », de quelle race de guerriers vient Teal’c ?'), /nomme Stargate/)
  // Kaamelott n'a que son nom : Arthur et Guenièvre sont aussi ceux de la légende, qui n'a pas les mêmes réponses.
  assert.match(verdict('Quel lien de parenté unit Yvain à la reine Guenièvre ?', 'kaamelott', { reponses: ['Son frère', 'Son cousin', 'Son fils', 'Son oncle'] }), /nomme Kaamelott/)
  assert.equal(verdict('Dans Kaamelott, quel lien de parenté unit Yvain à la reine Guenièvre ?', 'kaamelott', { reponses: ['Son frère', 'Son cousin', 'Son fils', 'Son oncle'] }), 'acceptée')
})

test('un repère que tout le monde rattache à l’univers suffit, au pluriel près', () => {
  const sorts = { reponses: ['Alohomora', 'Lumos', 'Accio', 'Expelliarmus'] }
  assert.match(verdict('Quel sort lancé d’un coup de baguette ouvre les serrures ?', 'harry-potter', sorts), /nomme Harry Potter/)
  assert.equal(verdict('À Poudlard, quel sort lancé d’un coup de baguette ouvre les serrures ?', 'harry-potter', sorts), 'acceptée')
  const lieux = { reponses: ['Fondcombe', 'La Lothlórien', 'Le Gondor', 'Le Rohan'] }
  assert.equal(verdict('Quel refuge elfique accueille les hobbits avant le conseil d’Elrond ?', 'seigneur-des-anneaux', lieux), 'acceptée')
})

test('un titre d’œuvre suffit quand l’univers en compte, pas une réplique entre guillemets', () => {
  const amis = { reponses: ['Timon', 'Rafiki', 'Zazu', 'Nala'], entites: [{ nom: 'Le Roi lion', type: 'oeuvre', description: 'film Disney de 1994' }] }
  assert.equal(verdict('Quel suricate devient l’ami de Simba dans « Le Roi lion » ?', 'disney', amis), 'acceptée')
  assert.equal(verdict('Quel suricate devient l’ami du lionceau du « Roi lion » ?', 'disney', amis), 'acceptée', 'sans son article')
  const ours = { reponses: ['Winnie l’Ourson', 'Baloo', 'Petit Jean', 'Bourriquet'] }
  assert.match(verdict('Quel ours de dessin animé soupire « Oh, bother ! » en cherchant son miel ?', 'disney', ours), /nomme Disney et Pixar/)
  const bond = { reponses: ['Honor Blackman', 'Ursula Andress', 'Diana Rigg', 'Jane Seymour'] }
  assert.equal(verdict('Quelle actrice joue Pussy Galore dans « Goldfinger » (1964) ?', 'james-bond', bond), 'acceptée', 'un film de 007 sans son entité')
})

test('une question dont la bonne réponse est l’univers le décrit déjà', () => {
  const series = { reponses: ['Lost', 'Heroes', 'Fringe', 'Prison Break'] }
  assert.equal(verdict('Quelle série suit les rescapés du vol Oceanic 815 ?', 'lost', series), 'acceptée')
})

test('la base livrée nomme l’univers de chacune de ses questions d’univers', () => {
  const sans = lireLaBase().questions.filter(q => universSansSonNom(q))
  assert.deepEqual(
    sans.slice(0, 10).map(q => `${q.id} [${universSansSonNom(q)}] ${q.texte}`),
    [],
    `${sans.length} question(s) qui ne nomment pas leur univers (base-campagne.ts univers, puis corriger)`,
  )
})

test('chaque univers du catalogue a ses repères', () => {
  // Un univers neuf sans repères : ses questions passeraient toutes, nommées ou non.
  const famille = ETIQUETTES.find(f => f.famille === 'Les univers')
  assert.ok(famille, 'la famille « Les univers » des étiquettes')
  for (const e of famille.etiquettes) assert.ok(REPERES_DES_UNIVERS[e.cle], `${e.cle} n’a pas de repères (REPERES_DES_UNIVERS)`)
  for (const s of SUJETS.filter(s => s.famille === 'univers')) for (const e of s.etiquettes ?? []) assert.ok(REPERES_DES_UNIVERS[e], `${s.cle} : ${e} n’a pas de repères`)
  for (const cle of Object.keys(REPERES_DES_UNIVERS)) assert.ok(famille.etiquettes.some(e => e.cle === cle), `${cle} n’est pas une étiquette d’univers`)
})

test('une question de la base, relue, ne se juge pas sur son univers : seul ce qui entre se refuse', () => {
  // Un dépôt d'avant de la routine qui ne le nommait pas sortirait du jeu à la lecture, sans que personne l'ait décidé.
  const lu = lireQuestionDeLaBase({ ...entree('De quelle race de guerriers vient Teal’c, qui a trahi Apophis ?', 'stargate'), id: 'abcd1234' })
  assert.ok('question' in lu)
})

// Les faits de Wikidata pour la base de la campagne (`scripts/faits-wikidata.ts`) :
// ce qui se décide sans réseau — les leurres d'une réponse, la difficulté a
// priori, la fiche qui devient une entrée de la base avec les phrases du
// rédacteur, la consigne, le choix des fiches d'une génération, et la
// fusion qui sert de vérificateur au rédacteur. L'extraction elle-même
// interroge Wikidata : elle ne se joue pas ici.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES, TYPES_D_ENTITE } from '../../shared/etiquettes'
import { TriDesEntrees, lireLot } from '../scripts/lots-campagne'
import {
  FAMILLES,
  ajouterUneLigneDeVues,
  anneeDe,
  choisirLeurres,
  choisirLesFiches,
  consigneDesFaits,
  difficulteAPriori,
  entreeDeLaFiche,
  estFrancais,
  fenetreDesVues,
  fichesDeLaFamille,
  fichiersDuLot,
  fusionner,
  guillemets,
  joursDesDumps,
  laureatsParAnnee,
  ligneDeFiche,
  mediane,
  medianesDesJours,
  qidDe,
  sousThemeDUnAlbum,
  titresAmbigus,
  valeurActuelle,
  Wikidata,
  type EntiteWd,
  type FicheDeFait,
} from '../scripts/faits-wikidata'

const peintre = (qid: string, nom: string, annee: number, pays = 'Q55', liens = 60): EntiteWd => ({ qid, nom, description: null, titre: nom, liens, annees: [annee], pays: [pays] })

const VERMEER = peintre('Q1', 'Johannes Vermeer', 1632, 'Q55', 120)
const VIVIER = [
  VERMEER,
  peintre('Q2', 'Pieter de Hooch', 1629),
  peintre('Q3', 'Jan Steen', 1626),
  peintre('Q4', 'Gabriel Metsu', 1629),
  peintre('Q5', 'Gerard ter Borch', 1617),
  peintre('Q6', 'Carel Fabritius', 1622),
  peintre('Q7', 'Nicolas Maes', 1634),
  peintre('Q8', 'Nicolas Poussin', 1594, 'Q142'),
  peintre('Q9', 'Claude Monet', 1840, 'Q142', 200),
  peintre('Q10', 'Jan Vermeer', 1628),
  peintre('Q11', 'Frans Hals', 1582),
]

/** Une fiche de tableau, au format de l'extraction : l'entrée de la base sans ses phrases. */
function fiche(o: Partial<FicheDeFait> = {}): FicheDeFait {
  return {
    famille: 'tableaux',
    qids: ['Q100', 'Q1'],
    demande: 'qui a peint le tableau',
    indices: ['un musée de La Haye'],
    vues: { sujet: 60, reponse: 900 },
    texte: 'Qui a peint « La Dame au parapluie vert » ?',
    reponses: ['Jan Steen', 'Johannes Vermeer', 'Pieter de Hooch', 'Gabriel Metsu'],
    bonne: 1,
    categorie: 'Arts & lettres',
    sousTheme: 'peinture',
    etiquettes: [],
    difficulte: 4,
    ageMin: 10,
    date: { valeur: '1661', precision: 'annee' },
    entites: [
      { nom: 'La Dame au parapluie vert', type: 'oeuvre', description: 'tableau' },
      { nom: 'Johannes Vermeer', type: 'personne', description: 'peintre néerlandais' },
    ],
    portee: 'monde',
    valeur: null,
    leurres: ['Pieter de Hooch', 'Jan Steen', 'Gabriel Metsu', 'Nicolas Maes', 'Gerard ter Borch', 'Carel Fabritius'],
    dureeDeVie: 'stable',
    source: { titre: 'La Dame au parapluie vert', site: 'wikipedia-fr' },
    confiance: 3,
    aRelire: [],
    ...o,
  }
}

test('les leurres d’une réponse : le même vivier, les années proches, le même pays d’abord, jamais son nom de famille', () => {
  const leurres = choisirLeurres(VERMEER, VIVIER, { ecart: 60 })
  assert.ok(leurres, 'six leurres au moins')
  assert.ok(leurres.length >= 6 && leurres.length <= 7, `${leurres.length} leurres`)
  assert.ok(!leurres.includes('Johannes Vermeer'), 'jamais la réponse')
  assert.ok(!leurres.includes('Jan Vermeer'), 'pas un homonyme de son nom de famille')
  assert.ok(!leurres.includes('Claude Monet'), 'pas à deux siècles d’écart')
  assert.deepEqual(leurres.slice(0, 3).sort(), ['Gabriel Metsu', 'Nicolas Maes', 'Pieter de Hooch'], 'les plus proches, du même pays')
  assert.ok(!leurres.slice(0, 5).includes('Nicolas Poussin'), 'un autre pays passe après')
  assert.ok(!(choisirLeurres(VERMEER, VIVIER, { ecart: 60, exclus: new Set(['Q2']) }) ?? []).includes('Pieter de Hooch'), 'ce qui répond aussi au sujet est exclu')
  const varies = choisirLeurres(VERMEER, VIVIER, { ecart: 60, affiches: new Map([['Pieter de Hooch', 5], ['Gabriel Metsu', 5]]) })
  assert.ok(varies && !varies.slice(0, 3).includes('Pieter de Hooch') && !varies.slice(0, 3).includes('Gabriel Metsu'), 'les leurres déjà souvent affichés cèdent la place')
  assert.equal(choisirLeurres(VERMEER, VIVIER.slice(0, 5), { ecart: 60 }), null, 'sous six, pas de fiche')
  assert.equal(choisirLeurres({ ...VERMEER, annees: [] }, VIVIER, { ecart: 60 }), null, 'sans année, rien ne se compare')
})

test('la difficulté a priori : les vues du sujet en France, la réponse qui se devine, le palmarès sur le vainqueur', () => {
  assert.equal(difficulteAPriori('sujet', { sujet: 3000, reponse: 3000, leurres: [3000, 3000, 3000] }), 1)
  assert.equal(difficulteAPriori('sujet', { sujet: 10, reponse: 50, leurres: [50, 50, 50] }), 5)
  assert.equal(difficulteAPriori('sujet', { sujet: 60, reponse: 2000, leurres: [40, 30, 50] }), 3, 'Monet parmi des inconnus se devine')
  assert.equal(difficulteAPriori('sujet', { sujet: 200, reponse: 20, leurres: [900, 800, 1000] }), 5, 'un auteur obscur parmi des leurres célèbres')
  assert.equal(difficulteAPriori('sujet', { sujet: 2000, reponse: 15, leurres: [15, 20, 10] }), 5, 'le Pentagone est célèbre, son architecte non')
  assert.equal(difficulteAPriori('sujet', { sujet: 100, reponse: 115, leurres: [100, 120, 90] }), 3, 'Des glaneuses : cent vues par jour, une question moyenne')
  assert.equal(difficulteAPriori('palmares', { sujet: 5, reponse: 2000, leurres: [] }), 2, 'un champion célèbre, mais l’année à retrouver')
  assert.equal(difficulteAPriori('palmares', { sujet: 5, reponse: 40, leurres: [] }), 5)
  assert.equal(difficulteAPriori('palmares', { sujet: 5, reponse: 1500, leurres: [] }, { moinsSuivi: true }), 3, 'le Tour d’Espagne se suit moins que le Tour de France')
  assert.equal(difficulteAPriori('sujet', { sujet: 300, reponse: 270, leurres: [270, 250, 260] }), 2)
  assert.equal(difficulteAPriori('sujet', { sujet: 300, reponse: 270, leurres: [270, 250, 260] }, { echelle: 0.5 }), 3, 'un film est plus lu qu’un tableau : à vues égales, son réalisateur est moins su')
  for (const v of [0, 1, 50, 10_000]) {
    const d = difficulteAPriori('sujet', { sujet: v, reponse: v, leurres: [v] })
    assert.ok(d >= 1 && d <= 5)
  }
})

test('une fiche devient une entrée de la base : les phrases du rédacteur, tout le reste de la fiche', () => {
  const gabarit = lireQuestionDeLaBase(entreeDeLaFiche(fiche()), { sansId: true })
  assert.ok('question' in gabarit, `sans phrases, l’intitulé du gabarit passe le juge : ${'refus' in gabarit ? gabarit.refus : ''}`)
  const p = { ref: 1, t: 'Quel peintre de Delft a représenté une dame au parapluie vert ?', a: 'Une anecdote vraie.', x: 'La toile est de lui.', bonne: 0, reponses: ['Moi'] }
  const entree = entreeDeLaFiche(fiche(), p)!
  assert.equal(entree.texte, p.t)
  assert.equal(entree.anecdote, p.a)
  assert.equal(entree.explication, p.x)
  assert.equal(entree.bonne, 1, 'le rédacteur ne change pas la réponse')
  assert.deepEqual(entree.reponses, fiche().reponses)
  assert.equal(entree.famille, undefined, 'ce qui sert à la génération ne part pas dans la base')
  assert.equal(entree.qids, undefined)
  const lu = lireQuestionDeLaBase(entree, { sansId: true })
  assert.ok('question' in lu)
  assert.equal(entreeDeLaFiche(fiche(), { ref: 1, t: null, motif: 'deux tableaux de ce nom' }), null, 'écartée par le rédacteur')
  assert.equal(entreeDeLaFiche(fiche(), { ref: 1, t: 'Qui a peint « La Dame au parapluie vert » ?', a: null })!.anecdote, null, 'sans rien de certain, pas d’anecdote')
  const trahie = lireQuestionDeLaBase(entreeDeLaFiche(fiche(), { ref: 1, t: 'Qui a peint « La Dame au parapluie vert », le Vermeer le plus discret ?' }), { sansId: true })
  assert.ok('refus' in trahie && /Vermeer/.test(trahie.refus), 'le nom de famille de la réponse dans l’intitulé : le juge le refuse')
})

test('les guillemets d’un titre prennent leurs espaces, même collés par le rédacteur', () => {
  // Au pilote du 10 octobre 2026, un rédacteur sur douze écrivait «Anora» ; les 2 452 guillemets de la base ont leurs espaces.
  const e = entreeDeLaFiche(fiche(), { ref: 1, t: 'Qui a peint «La Dame au parapluie vert» ?', a: 'Elle répond à «La Liseuse».', x: '«  La Dame » est de lui.' })!
  assert.equal(e.texte, 'Qui a peint « La Dame au parapluie vert » ?')
  assert.equal(e.anecdote, 'Elle répond à « La Liseuse ».')
  assert.equal(e.explication, '« La Dame » est de lui.')
  assert.equal(guillemets('Qui a peint « La Joconde » ?'), 'Qui a peint « La Joconde » ?', 'rien ne change à ce qui est juste')
})

test('un fait de l’année ne s’écrit pas encore : le correcteur ne le connaît pas, il attend l’an prochain', () => {
  // Au pilote du 10 octobre 2026, le correcteur a retiré les vainqueurs 2026 du Tour, du Giro et de la Vuelta, écrits pour rien.
  const tableaux = FAMILLES.find(f => f.cle === 'tableaux')!
  const sujet = (qid: string, nom: string): EntiteWd => ({ qid, nom, description: null, titre: nom, liens: 30 })
  const x = {
    faits: [
      { sujet: sujet('Q100', 'La Toile neuve'), reponse: VERMEER, annee: 2026, indices: [], francais: false },
      { sujet: sujet('Q101', 'La Toile ancienne'), reponse: VERMEER, annee: 1661, indices: [], francais: false },
    ],
    vivier: VIVIER,
    homonymes: new Set<string>(),
  }
  const vues = new Map<string, number>([['La Toile neuve', 500], ['La Toile ancienne', 500], ...VIVIER.map(e => [e.nom, 100] as [string, number])])
  const { fiches, ecartes } = fichesDeLaFamille(tableaux, x, vues, new Date('2026-10-10'))
  assert.deepEqual(fiches.map(f => f.entites[0].nom), ['La Toile ancienne'])
  assert.equal(Object.values(ecartes).reduce((s, n) => s + n, 0), 1, JSON.stringify(ecartes))
  assert.equal(fichesDeLaFamille(tableaux, x, vues, new Date('2027-01-02')).fiches.length, 2, 'l’an prochain, il se relit')
})

test('le musée d’un tableau : celui d’aujourd’hui, pas ceux de son histoire', () => {
  // Wikidata donnait à « La Madeleine à la veilleuse » trois collections, et le rédacteur en avait tiré « une version à Cologne ».
  const madeleine = [
    { v: 'Q700959', l: 'musée Wallraf-Richartz', debut: '1941-01-01T00:00:00Z' },
    { v: 'Q1053735', l: 'Munich Central Collecting Point', debut: '1946-03-19T00:00:00Z', fin: '1946-03-27T00:00:00Z' },
    { v: 'Q3044768', l: 'département des peintures du musée du Louvre', debut: '1949-01-01T00:00:00Z' },
  ]
  assert.equal(valeurActuelle(madeleine)?.l, 'département des peintures du musée du Louvre', 'le Louvre depuis 1949, pas Cologne')
  assert.equal(valeurActuelle([{ v: 'Q1', l: 'musée du Prado' }])?.l, 'musée du Prado')
  assert.equal(valeurActuelle([{ v: 'Q1', l: 'musée A' }, { v: 'Q2', l: 'musée B' }]), null, 'deux musées sans date : on ne choisit pas')
  assert.equal(valeurActuelle([{ v: 'Q1', l: 'musée A', fin: '1900-01-01T00:00:00Z' }]), null, 'un musée quitté n’est plus le sien')
  assert.equal(valeurActuelle([]), null)
})

test('la consigne d’un lot montre chaque fiche, le fichier à écrire et le vérificateur, et rien de ce que la base a déjà', () => {
  const fiches = [fiche(), fiche({ qids: ['Q101', 'Q1'], entites: [{ nom: 'Le Liseur', type: 'oeuvre', description: 'tableau' }, fiche().entites[1]] })]
  const c = consigneDesFaits(fiches, { phrases: '/tmp/x.phrases.json', verifier: 'npx tsx scripts/faits-wikidata.ts fusionner wd1-01' })
  for (const [i, f] of fiches.entries()) assert.ok(c.includes(ligneDeFiche(i + 1, f)), `la fiche ${i + 1}`)
  assert.ok(c.includes('/tmp/x.phrases.json'))
  assert.ok(c.includes('fusionner wd1-01'))
  assert.ok(c.includes('qui a peint le tableau'))
  assert.ok(!c.includes('DÉJÀ ÉCRITES'), 'le fait est neuf : pas de liste des intitulés')
  // Au pilote, trois intitulés recopiaient une année fausse de Wikidata (« Métro 2033 », paru en 2007 : en 2005), et une
  // explication tirait d'une description (« réalisatrice et scénariste ») que Patty Jenkins avait écrit « Wonder Woman ».
  assert.ok(c.includes('Wikidata, qui se trompe parfois'), 'la consigne dit de ne pas tout croire de la fiche')
  assert.ok(ligneDeFiche(1, fiche()).includes('réponse : Johannes Vermeer'))
  assert.ok(ligneDeFiche(1, fiche()).includes('mauvaises réponses affichées : Jan Steen, Pieter de Hooch, Gabriel Metsu'))
})

test('le choix des fiches : rien de ce que la base pose déjà, autant par famille, des lots d’une seule famille', () => {
  const deja = lireQuestionDeLaBase({ ...entreeDeLaFiche(fiche())!, id: 'abcd1234' })
  assert.ok('question' in deja)
  const tri = new TriDesEntrees([(deja as { question: QuestionDeLaBase }).question], new Set())
  const tableaux = [fiche(), ...['Le Liseur', 'La Ruelle claire', 'Le Verre de vin rose', 'La Lettre bleue'].map((nom, i) =>
    fiche({ qids: [`Q${200 + i}`, 'Q1'], texte: `Qui a peint « ${nom} » ?`, entites: [{ nom, type: 'oeuvre', description: 'tableau' }, fiche().entites[1]], source: { titre: nom, site: 'wikipedia-fr' } }),
  )]
  const films = ['Le Train sifflera', 'La Rivière lente', 'Un été à Lisbonne'].map((nom, i) =>
    fiche({
      famille: 'films',
      qids: [`Q${300 + i}`, 'Q2'],
      texte: `Qui a réalisé « ${nom} » ?`,
      categorie: 'Cinéma & séries',
      sousTheme: 'cinema-monde',
      entites: [{ nom, type: 'oeuvre', description: 'film' }, { nom: 'Pieter de Hooch', type: 'personne', description: 'réalisateur' }],
      reponses: ['Jan Steen', 'Pieter de Hooch', 'Johannes Vermeer', 'Gabriel Metsu'],
      leurres: ['Jan Steen', 'Johannes Vermeer', 'Gabriel Metsu', 'Nicolas Maes', 'Gerard ter Borch', 'Carel Fabritius'],
      source: { titre: nom, site: 'wikipedia-fr' },
    }),
  )
  const lots = choisirLesFiches(new Map([['tableaux', tableaux], ['films', films]]), tri, { questions: 6, parLot: 2 })
  const toutes = lots.flat()
  assert.ok(!toutes.some(f => f.qids[0] === 'Q100'), 'le fait que la base pose déjà reste de côté')
  assert.equal(toutes.filter(f => f.famille === 'tableaux').length, 3, 'la moitié chacune')
  assert.equal(toutes.filter(f => f.famille === 'films').length, 3)
  for (const lot of lots) {
    assert.ok(lot.length <= 2)
    assert.equal(new Set(lot.map(f => f.famille)).size, 1, 'une seule famille par lot : une seule question dans la consigne')
  }
  // Une part donnée à une famille : pas plus qu'elle, ce qui reste à l'autre.
  const tri2 = new TriDesEntrees([(deja as { question: QuestionDeLaBase }).question], new Set())
  const parts = choisirLesFiches(new Map([['tableaux', tableaux], ['films', films]]), tri2, { questions: 6, parLot: 30, quotas: new Map([['tableaux', 1]]) }).flat()
  assert.equal(parts.filter(f => f.famille === 'tableaux').length, 1, 'sa part, pas la moitié')
  assert.equal(parts.filter(f => f.famille === 'films').length, 3)
})

test('fusionner, le vérificateur du rédacteur : un lot ordinaire, chaque refus avec sa fiche, les fiches écartées à part', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'faits-'))
  try {
    const id = 'essai-01'
    const f = fichiersDuLot(racine, id)
    mkdirSync(f.dossier, { recursive: true })
    const seconde = fiche({ qids: ['Q101', 'Q1'], texte: 'Qui a peint « Le Liseur au chapeau » ?', entites: [{ nom: 'Le Liseur au chapeau', type: 'oeuvre', description: 'tableau' }, fiche().entites[1]] })
    const troisieme = fiche({ qids: ['Q102', 'Q1'], texte: 'Qui a peint « La Ruelle aux pigeons » ?', entites: [{ nom: 'La Ruelle aux pigeons', type: 'oeuvre', description: 'tableau' }, fiche().entites[1]] })
    writeFileSync(f.faits, JSON.stringify([fiche(), seconde, troisieme]))
    writeFileSync(
      f.phrases,
      JSON.stringify([
        { ref: 1, t: 'Quel peintre de Delft a peint « La Dame au parapluie vert » ?', a: 'Une anecdote.', x: 'Une explication.' },
        { ref: 2, t: 'Qui a peint « Le Liseur au chapeau », le Vermeer le plus sombre ?', a: null, x: 'Une explication.' },
        { ref: 3, t: null, motif: 'deux tableaux de ce nom' },
      ]),
    )
    const lignes: string[] = []
    const refus = fusionner(id, { racine, dire: l => lignes.push(l) })
    assert.equal(refus, 1, lignes.join('\n'))
    assert.ok(lignes.some(l => l.startsWith('✗ REFUS ref 2') && l.includes('Vermeer')), 'la fiche 2 trahit sa réponse')
    assert.ok(lignes.some(l => l.startsWith('écartée : ref 3') && l.includes('deux tableaux de ce nom')))
    const lot = lireLot(f.lot) as Record<string, unknown>[]
    assert.equal(lot.length, 2, 'les fiches écartées ne sont pas dans le lot')
    assert.equal(lot[0].texte, 'Quel peintre de Delft a peint « La Dame au parapluie vert » ?')
    assert.ok(readFileSync(f.lot, 'utf8').startsWith('[\n{'), 'une entrée par ligne, comme tout lot')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('chaque famille écrit des fiches que le juge peut lire : sa catégorie, son sous-thème, ses types, son gabarit', () => {
  const fait = {
    sujet: { qid: 'Q100', nom: 'Le Sujet', description: null, titre: 'Le Sujet', liens: 30 },
    reponse: VERMEER,
    annee: 1985,
    indices: ['le Tour de France'],
    francais: true,
  }
  for (const fam of FAMILLES) {
    assert.ok(SOUS_THEMES[fam.categorie].some(s => s.cle === fam.sousTheme(fait)), `${fam.cle} : ${fam.sousTheme(fait)} est un sous-thème de ${fam.categorie}`)
    assert.ok((TYPES_D_ENTITE as readonly string[]).includes(fam.typeSujet), `${fam.cle} : ${fam.typeSujet}`)
    const g = fam.gabarit(fait)
    assert.ok(g.length >= 10 && g.endsWith(' ?') && !g.includes('undefined'), `${fam.cle} : ${g}`)
  }
  assert.equal(new Set(FAMILLES.map(f => f.cle)).size, FAMILLES.length, 'une clé par famille')
  assert.equal(FAMILLES.find(f => f.cle === 'grands-tours')!.gabarit(fait), 'En 1985, qui remporte le Tour de France ?')
})

test('un titre est ambigu quand un autre auteur connu le porte, pas les versions du même auteur ni une copie obscure', () => {
  const e = (q: string) => `http://www.wikidata.org/entity/${q}`
  const sujets = [
    { qid: 'Q1', nom: 'La Naissance de Vénus', auteur: 'Q10', liens: 57 },
    { qid: 'Q3', nom: 'Le Cri', auteur: 'Q30', liens: 90 },
    { qid: 'Q5', nom: 'Autoportrait', auteur: 'Q50', liens: 15 },
    { qid: 'Q7', nom: 'La Joconde', auteur: 'Q70', liens: 146 },
  ]
  const ambigus = titresAmbigus(sujets, [
    { item: e('Q1'), l: 'La Naissance de Vénus', a: e('Q10'), n: 57 },
    { item: e('Q2'), l: 'La naissance de Vénus', a: e('Q20'), n: 30 },
    { item: e('Q3'), l: 'Le Cri', a: e('Q30'), n: 90 },
    { item: e('Q4'), l: 'Le Cri', a: e('Q30'), n: 40 },
    { item: e('Q5'), l: 'Autoportrait', a: e('Q50'), n: 15 },
    { item: e('Q6'), l: 'Autoportrait', n: 6 },
    { item: e('Q7'), l: 'La Joconde', a: e('Q70'), n: 146 },
    { item: e('Q8'), l: 'La Joconde', n: 3 },
  ])
  assert.ok(ambigus.has('la naissance de venus'), 'deux peintres connus : la question aurait deux réponses')
  assert.ok(!ambigus.has('le cri'), 'plusieurs versions du même peintre : une seule réponse')
  assert.ok(ambigus.has('autoportrait'), 'un auteur inconnu compte pour un autre auteur')
  assert.ok(!ambigus.has('la joconde'), 'une copie anonyme que personne ne connaît ne trouble personne')
})

test('les vues d’un article : la médiane de trente jours, les jours sans lecteur comptés, les redirections suivies', async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'vues-'))
  const vrai = globalThis.fetch
  const demandes: string[] = []
  // Trente jours de vues, du plus ancien au plus récent ; un jour sans lecteur n'est pas dans la réponse de l'API.
  const jours = (vues: number[]) => ({ items: vues.map((v, i) => ({ timestamp: `202609${String(i + 1).padStart(2, '0')}00`, views: v })) })
  const articles: Record<string, ReturnType<typeof jours>> = {
    Salvador_Dalí: jours(Array(30).fill(1000)),
    // À partir du 1er octobre 2026 : en moyenne, 4 500 vues par jour et une difficulté 1 ; un jour ordinaire, 300.
    'À_l’est_d’Éden': jours([...Array(26).fill(300), 10052, 11547, 13109, 16994]),
    // Lu deux jours sur trente : la médiane des trente, pas celle des deux.
    Un_article_oublié: jours([40, 60]),
    El_tres_de_mayo_de_1808_en_Madrid: jours(Array(30).fill(130)),
  }
  globalThis.fetch = (async (url: string | URL) => {
    const u = new URL(String(url))
    if (u.hostname === 'wikimedia.org') {
      const titre = decodeURIComponent(u.pathname.split('/')[9])
      demandes.push(titre)
      assert.match(u.pathname, /\/per-article\/fr\.wikipedia\/all-access\/user\/.+\/daily\/\d{8}\/\d{8}$/)
      return articles[titre] ? new Response(JSON.stringify(articles[titre]), { status: 200 }) : new Response('{"type":"not_found"}', { status: 404 })
    }
    // L'API de Wikipédia, pour les articles presque sans lecteurs : « Tres de mayo » est une redirection.
    demandes.push(`redirections : ${u.searchParams.get('titles')}`)
    return new Response(JSON.stringify({ query: { redirects: [{ from: 'Tres de mayo', to: 'El tres de mayo de 1808 en Madrid' }] } }), { status: 200 })
  }) as typeof fetch
  try {
    const titres = ['Tres de mayo', 'Salvador Dalí', 'À l’est d’Éden', 'Un article oublié']
    const vues = await new Wikidata(dossier, 0).vues(titres)
    assert.equal(vues.get('Salvador Dalí'), 1000)
    assert.equal(vues.get('À l’est d’Éden'), 300, 'un pic de quelques jours ne fait pas un livre que tout le monde connaît')
    assert.equal(vues.get('Un article oublié'), 0, 'vingt-huit jours sans lecteur')
    assert.equal(vues.get('Tres de mayo'), 130, 'la redirection suivie')
    assert.ok(demandes.some(d => d.startsWith('redirections : ') && d.includes('Tres de mayo') && d.includes('Un article oublié')))
    assert.ok(!demandes.some(d => d.startsWith('redirections : ') && d.includes('Salvador Dalí')), 'un article lu ne se demande pas')
    assert.equal(mediane([]), 0)
    assert.equal(mediane([4, 1, 3, 2]), 3, 'entre les deux du milieu, arrondie')
    const avant = demandes.length
    const encore = await new Wikidata(dossier, 0).vues(['Tres de mayo'])
    assert.equal(encore.get('Tres de mayo'), 130)
    assert.equal(demandes.length, avant, 'gardées sur le disque : rien ne se redemande')
    assert.deepEqual(fenetreDesVues(new Date('2026-10-11T08:00:00Z')), ['20260910', '20261009'], 'trente jours, jusqu’à avant-hier')
  } finally {
    globalThis.fetch = vrai
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('les fichiers quotidiens de vues : les articles de Wikipédia en français, tous accès additionnés, la médiane des jours', () => {
  // L'API REST des vues renvoyait chaque requête à une minute le 11 octobre 2026 : les fichiers quotidiens disent tout d'un coup.
  const vues = new Map<string, Uint32Array>()
  const jours = 3
  const lignes = [
    'fr.wikipedia La_Joconde 12345 desktop 400 A100B300',
    'fr.wikipedia La_Joconde 12345 mobile-web 500 A500',
    'en.wikipedia Mona_Lisa 999 desktop 9000 A9000',
    'fr.wikipedia Une_page_absente null desktop 70 A70',
    'fr.wikipedia Spécial:Recherche 1 desktop 5000 A5000',
    'fr.wikipedia Discussion_utilisateur:Untel 2 desktop 30 A30',
    'fr.wikipedia Star_Wars:_Episode_IV 77 desktop 80 A80',
    'fr.wiktionary joconde 5 desktop 3 C3',
  ]
  for (const l of lignes) ajouterUneLigneDeVues(vues, 0, jours, l)
  ajouterUneLigneDeVues(vues, 1, jours, 'fr.wikipedia La_Joconde 12345 desktop 1000 A1000')
  ajouterUneLigneDeVues(vues, 2, jours, 'fr.wikipedia La_Joconde 12345 desktop 800 A800')
  assert.deepEqual([...vues.keys()].sort(), ['La Joconde', 'Star Wars: Episode IV'], 'ni une autre langue, ni une page absente, ni une page spéciale ou de discussion')
  assert.deepEqual(Array.from(vues.get('La Joconde')!), [900, 1000, 800], 'ordinateur et mobile additionnés')
  const medianes = medianesDesJours(vues)
  assert.equal(medianes['La Joconde'], 900)
  assert.equal(medianes['Star Wars: Episode IV'], undefined, 'lu un jour sur trois : zéro un jour ordinaire, pas gardé')
  const dix = joursDesDumps(new Date('2026-10-11T08:00:00Z'), 10)
  assert.equal(dix.length, 10)
  assert.equal(dix[0], '20261009', 'le plus récent : avant-hier')
  assert.equal(dix[1], '20261006', 'un jour sur trois')
  assert.equal(dix[9], '20260912')
})

test('les vues viennent de l’index des fichiers quotidiens quand il est là, sans une requête de plus', async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'index-'))
  const vrai = globalThis.fetch
  const demandes: string[] = []
  writeFileSync(path.join(dossier, 'vues-des-dumps.json'), JSON.stringify({ le: new Date().toISOString(), jours: [], vues: { 'La Joconde': 900, 'El tres de mayo de 1808 en Madrid': 130 } }))
  globalThis.fetch = (async (url: string | URL) => {
    const u = new URL(String(url))
    demandes.push(u.hostname)
    return new Response(JSON.stringify({ query: { redirects: [{ from: 'Tres de mayo', to: 'El tres de mayo de 1808 en Madrid' }] } }), { status: 200 })
  }) as typeof fetch
  try {
    const vues = await new Wikidata(dossier, 0).vues(['La Joconde', 'Tres de mayo', 'Un inconnu'])
    assert.equal(vues.get('La Joconde'), 900)
    assert.equal(vues.get('Tres de mayo'), 130, 'la redirection suivie, la cible lue dans l’index')
    assert.equal(vues.get('Un inconnu'), 0)
    assert.deepEqual(demandes, ['fr.wikipedia.org'], 'une seule requête : où mènent les articles presque sans lecteurs')
  } finally {
    globalThis.fetch = vrai
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('les lauréats d’un prix, année par année : une année à deux lauréats se voit, chacun garde ses années', () => {
  const e = (q: string) => `http://www.wikidata.org/entity/${q}`
  const { parAnnee, annees } = laureatsParAnnee([
    { l: e('Q1'), an: '1998' },
    { l: e('Q2'), an: '1999' },
    { l: e('Q3'), an: '1999' },
    { l: e('Q1'), an: '2000' },
    { l: e('Q1'), an: '2000' },
    { l: 'http://www.wikidata.org/.well-known/genid/x', an: '2001' },
    { l: e('Q4') },
  ])
  assert.deepEqual(parAnnee.get(1998), ['Q1'])
  assert.deepEqual(parAnnee.get(1999), ['Q2', 'Q3'], 'deux lauréats : la question aurait deux réponses justes')
  assert.deepEqual(parAnnee.get(2000), ['Q1'], 'une ligne en double ne fait pas deux lauréats')
  assert.deepEqual(annees.get('Q1'), [1998, 2000], 'ses années de prix le situent parmi les leurres')
  assert.equal(parAnnee.has(2001), false, 'un lauréat inconnu ne compte pas')
})

test('un film est français par sa langue, pas par ses coproducteurs ni par son réalisateur', () => {
  // Sur Wikidata, « Bridget Jones Baby » a la France parmi ses pays d'origine, et Polanski la nationalité française.
  assert.equal(estFrancais({ langues: ['Q1860'], pays: ['Q145', 'Q30', 'Q142'], paysDeLAuteur: ['Q145'] }), false, 'une coproduction tournée en anglais')
  assert.equal(estFrancais({ langues: ['Q1860'], pays: ['Q145'], paysDeLAuteur: ['Q142', 'Q36'] }), false, 'Le Pianiste')
  assert.equal(estFrancais({ langues: ['Q150'], pays: ['Q142'], paysDeLAuteur: ['Q142'] }), true, 'Le Fabuleux Destin d’Amélie Poulain')
  assert.equal(estFrancais({ langues: null, pays: ['Q142'], paysDeLAuteur: [] }), true, 'un livre, sans langue lue : son pays')
  assert.equal(estFrancais({ langues: null, pays: [], paysDeLAuteur: ['Q142'] }), true, 'ou celui de son auteur')
})

test('un album va au sous-thème de son genre, puis à la chanson française s’il est français', () => {
  assert.equal(sousThemeDUnAlbum({ genres: ['Q6010'], francais: true }), 'rap-electro', 'L’École du micro d’argent : du rap avant tout')
  assert.equal(sousThemeDUnAlbum({ genres: ['Q8341'], francais: false }), 'jazz-monde')
  assert.equal(sousThemeDUnAlbum({ genres: ['Q9778'], francais: false }), 'rap-electro')
  assert.equal(sousThemeDUnAlbum({ genres: [], francais: true }), 'chanson-fr')
  assert.equal(sousThemeDUnAlbum({ francais: false }), 'pop-rock')
})

test('un palmarès : la bonne réponse change de place d’une année à l’autre, le même sujet n’y fait rien', () => {
  // Tous les Goncourt ont pour sujet le prix : la place de la bonne réponse, tirée du seul sujet, était toujours la même.
  const goncourt = FAMILLES.find(f => f.cle === 'goncourt')!
  const prix: EntiteWd = { qid: 'Q187300', nom: 'Prix Goncourt', description: 'prix littéraire', titre: 'Prix Goncourt', liens: 60 }
  const ecrivain = (q: number, an: number): EntiteWd => ({ qid: `Q${q}`, nom: `Écrivaine Numéro${q}`, description: null, titre: `Écrivaine Numéro${q}`, liens: 20, annees: [an], pays: ['Q142'], femme: true, humain: true })
  const vivier = Array.from({ length: 30 }, (_, i) => ecrivain(500 + i, 1980 + i))
  const x = { faits: vivier.map(r => ({ sujet: prix, reponse: r, annee: r.annees![0], indices: [], francais: true })), vivier, homonymes: new Set<string>() }
  const vues = new Map<string, number>(vivier.map(e => [e.titre!, 50]))
  const { fiches } = fichesDeLaFamille(goncourt, x, vues, new Date('2026-10-10'))
  assert.ok(fiches.length >= 20, `${fiches.length} fiches`)
  assert.ok(new Set(fiches.map(f => f.bonne)).size >= 3, 'la bonne réponse n’est pas toujours au même endroit')
  assert.ok(fiches.every(f => f.portee === 'france' && f.etiquettes.includes('femmes')), 'un lauréat français peu traduit : la portée « france »')
  assert.ok(fiches.every(f => f.entites[1].type === 'personne'))
  assert.equal(fiches[0].texte, `En ${fiches[0].date!.valeur}, qui reçoit le prix Goncourt ?`)
})

test('une réponse de Wikidata se lit malgré un caractère de contrôle brut dans un libellé, et se garde', async () => {
  // Un libellé portait un caractère de contrôle que JSON refuse : les romans ne s'extrayaient pas.
  const dossier = mkdtempSync(path.join(tmpdir(), 'sparql-'))
  const vrai = globalThis.fetch
  let appels = 0
  globalThis.fetch = (async () => {
    appels++
    return new Response('{"results":{\n"bindings":[{"item":{"type":"uri","value":"http://www.wikidata.org/entity/Q1"},"l":{"type":"literal","value":"Le Livre\u0007 perdu\tde \\"Paris\\"\\nII"}}]}}', { status: 200 })
  }) as typeof fetch
  try {
    const lignes = await new Wikidata(dossier).sparql('SELECT ?item ?l WHERE { }')
    assert.deepEqual(lignes, [{ item: 'http://www.wikidata.org/entity/Q1', l: 'Le Livre  perdu de "Paris"\nII' }], 'les caractères bruts deviennent des espaces, les séquences échappées restent')
    await new Wikidata(dossier).sparql('SELECT ?item ?l WHERE { }')
    assert.equal(appels, 1, 'gardée sur le disque')
  } finally {
    globalThis.fetch = vrai
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('les dates et les identifiants de Wikidata', () => {
  assert.equal(anneeDe('+1985-07-21T00:00:00Z'), 1985)
  assert.equal(anneeDe('-0027-01-01T00:00:00Z'), -27)
  assert.equal(anneeDe('inconnue'), null)
  assert.equal(qidDe('http://www.wikidata.org/entity/Q42'), 'Q42')
  assert.equal(qidDe('http://www.wikidata.org/.well-known/genid/abc'), null, 'une valeur inconnue n’est pas une entité')
})

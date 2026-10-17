// La génération en nombre de la base de la campagne
// (`scripts/generer-campagne.ts`) : le script prépare et range, les agents du
// dépôt écrivent et relisent, lancés en nombre par une session Claude Code —
// sur l'abonnement, sans rien payer de plus. Ce qui doit tenir : deux lots
// écrits en même temps ne partagent jamais un sous-thème (ils poseraient les
// mêmes faits), ce que chaque agent a vérifié seul se revérifie ensemble avec
// le juge et le dédoublonnage du rangement, la vague suivante sait ce que la
// précédente a écrit, une relecture rejouée ne retire pas deux fois, un lot
// non relu ne se range pas par mégarde. Les agents, ici, sont des fichiers
// écrits à leur place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { consigneDEcriture, type QuotaDEcriture } from '../src/core/consigneCampagne'
import { SERVEUR } from '../src/racine'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { BRANCHES } from '../../shared/branches'
import { niveauDeQuestion, type Niveau } from '../../shared/campagne'
import { sujetParCle } from '../../shared/sujets'
import {
  QUESTIONS_PAR_LOT,
  charger,
  commandeDesSentiers,
  commandeDuSujet,
  commandeDuTheme,
  etat,
  lireLesDecisions,
  planDeLaGeneration,
  preparer,
  sauver,
  suite,
  totaux,
  type Contexte,
  type Mission,
} from '../scripts/generer-campagne'
import { TriDesEntrees, appliquerLesDecisions, lireLot, lotsEnAttente } from '../scripts/lots-campagne'

/** Une entrée qu'accepte le juge de la base : sa bonne réponse et ses mots lui sont propres. */
function entree(n: number, { categorie = 'Géographie' as Categorie, sousTheme = '', difficulte = 3 } = {}): Record<string, unknown> {
  const mauvaises = [`Leurre ${n} premier`, `Leurre ${n} second`, `Leurre ${n} troisième`]
  return {
    texte: `Quel fait numéro ${n} distingue ce lieu ${n} de ses voisins ?`,
    reponses: [`Réponse ${n} exacte`, ...mauvaises],
    bonne: 0,
    anecdote: 'Une anecdote vraie.',
    categorie,
    sousTheme: sousTheme || SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [{ nom: `Lieu ${n}`, type: 'lieu', description: 'pour lever l’homonymie' }],
    portee: 'monde',
    valeur: null,
    leurres: [...mauvaises, `Leurre ${n} quatrième`, `Leurre ${n} cinquième`, `Leurre ${n} sixième`],
    dureeDeVie: 'stable',
    explication: 'Parce que.',
    source: { titre: `Lieu ${n}`, site: 'wikipedia-fr' },
    confiance: 3,
    aRelire: [],
  }
}

function question(n: number, o: Parameters<typeof entree>[1] = {}): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({ ...entree(n, o), id: `base${String(n).padStart(4, '0')}` })
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}

const totalDe = (l: { quotas: { n: number }[] }) => l.quotas.reduce((s, q) => s + q.n, 0)

function contexte(base: QuestionDeLaBase[] = []): Contexte & { journal: string[] } {
  const journal: string[] = []
  return { dossier: mkdtempSync(path.join(tmpdir(), 'lots-')), base, livres: new Set(), dire: l => journal.push(l), journal }
}

/** Le fichier qu'une mission fait écrire : celui de sa consigne, ou celui de ses décisions. */
const cible = (m: Mission) => /(?:dans|décisions dans) (\S+\.json)/.exec(m.mission.replace(/, puis.*$/, ''))![1]
const consigneDe = (m: Mission) => readFileSync(/Ta consigne est dans (\S+\.md)/.exec(m.mission)![1], 'utf8')

/** Ce qu'écrirait un agent rédacteur : les questions que sa consigne demande, chacune son fait, numérotées depuis `depart`. */
function ecrireLeLot(m: Mission, depart: number): Record<string, unknown>[] {
  const consigne = consigneDe(m)
  const categorie = /CATÉGORIE « ([^»]+) »/.exec(consigne)![1] as Categorie
  let n = depart
  return [...consigne.matchAll(/^- ([a-z-]+) \(.*\) : (\d+) questions? de difficulté (\d)$/gm)].flatMap(([, cle, combien, d]) =>
    Array.from({ length: Number(combien) }, () => entree(n++, { categorie, sousTheme: cle, difficulte: Number(d) })),
  )
}

test('le plan : la commande de chaque catégorie, en lots bornés, sans sous-thème partagé dans une vague', () => {
  const vagues = planDeLaGeneration([], { nom: 'g1', questions: 4800 })
  const lots = vagues.flatMap(v => v.lots)
  assert.equal(lots.reduce((s, l) => s + totalDe(l), 0), 4800, 'toutes les questions demandées')
  for (const c of CATEGORIES) assert.equal(lots.filter(l => l.categorie === c).reduce((s, l) => s + totalDe(l), 0), 400, c)
  for (const l of lots) {
    assert.ok(totalDe(l) <= QUESTIONS_PAR_LOT, `${l.id} : ${totalDe(l)} questions`)
    assert.match(l.id, /^g1-\d{2,}$/, 'un nom de lot que `consigne` et `ranger` relisent')
    for (const q of l.quotas) assert.ok(SOUS_THEMES[l.categorie].some(s => s.cle === q.cle), `${q.cle} dans ${l.categorie}`)
    assert.ok(l.quotas.every(q => q.difficulte && q.difficulte >= 1 && q.difficulte <= 5), 'la difficulté de chaque ligne est dite')
  }
  assert.equal(new Set(lots.map(l => l.id)).size, lots.length, 'chaque lot a son identifiant, qui nomme son fichier')
  // Écrits en même temps, deux lots ne se voient pas : un sous-thème partagé, ce sont les mêmes faits deux fois.
  for (const [i, v] of vagues.entries()) {
    const vus = new Set<string>()
    for (const l of v.lots) {
      for (const cle of new Set(l.quotas.map(q => q.cle))) {
        assert.ok(!vus.has(`${l.categorie}/${cle}`), `vague ${i + 1} : ${l.categorie}/${cle} dans deux lots`)
        vus.add(`${l.categorie}/${cle}`)
      }
    }
  }
  assert.ok(vagues.length >= 2, 'quatre cents questions par catégorie débordent un lot par sous-thème')
})

test('le plan lance aussi peu d’agents que possible : pas de lot de sept questions à côté d’un lot qui avait la place', () => {
  // L'histoire de la base au 10 octobre 2026 : 84 questions à écrire se répartissent 26, 24, 15, 7, 4, 4 et 4.
  const comptes: Record<string, number> = { civilisations: 75, pouvoirs: 75, guerres: 75, explorations: 64, personnages: 72, 'vie-autrefois': 53, 'faits-divers': 55 }
  const existantes = Object.entries(comptes).flatMap(([sousTheme, n]) => Array.from({ length: n }, (_, i) => ({ categorie: 'Histoire', sousTheme, difficulte: 1 + (i % 5) })))
  const [vague, ...autres] = planDeLaGeneration(existantes, { nom: 'g1', questions: 84, categories: ['Histoire'] })
  assert.equal(autres.length, 0)
  assert.deepEqual(
    vague.lots.map(totalDe),
    [30, 28, 26],
    'trois agents ; pris dans l’ordre du catalogue, il en fallait quatre, dont un pour sept questions',
  )
})

test('le plan suit ce qui manque, et ne touche que les catégories choisies', () => {
  // Une base pleine de capitales faciles : la commande vise le reste.
  const existantes = Array.from({ length: 200 }, () => ({ categorie: 'Géographie', sousTheme: 'capitales', difficulte: 1 }))
  const lots = planDeLaGeneration(existantes, { nom: 'geo', questions: 40, categories: ['Géographie'] }).flatMap(v => v.lots)
  assert.ok(lots.every(l => l.categorie === 'Géographie'))
  const quotas = lots.flatMap(l => l.quotas)
  assert.ok(!quotas.some(q => q.difficulte === 1), 'la base a déjà trop de faciles')
  assert.ok(!quotas.some(q => q.cle === 'capitales'), 'ni de capitales')
})

test('pour les sentiers : chaque chapitre à la marche que ses deux paliers demandent, puis ce que la catégorie demande encore', () => {
  const parMarche = (lignes: readonly QuotaDEcriture[]) => {
    const m: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
    for (const l of lignes) m[niveauDeQuestion(l.difficulte!)] += l.n
    return m
  }
  // Une base vide, une montée : chaque sentier commande ce que ses treize paliers posent, marche par marche.
  const une = commandeDesSentiers([], 1)
  for (const b of BRANCHES) assert.deepEqual(parMarche(une.get(b.categorie)!), { facile: 63, moyen: 87, difficile: 42, expert: 16 }, b.categorie)
  const fete = une.get('Autour de la fête')!
  const de = (sousThemes: readonly string[], marche: Niveau) => fete.filter(l => sousThemes.includes(l.cle) && niveauDeQuestion(l.difficulte!) === marche).reduce((s, l) => s + l.n, 0)
  assert.equal(de(['noel', 'nouvel-an'], 'facile'), 30, 'les deux premiers paliers : seize faciles puis quatorze, à Noël et au Nouvel An')
  assert.equal(de(['traditions'], 'moyen'), 29, 'le quatrième chapitre, ses vingt-neuf moyennes aux fêtes du monde')
  assert.ok(
    fete.filter(l => niveauDeQuestion(l.difficulte!) === 'facile').every(l => l.difficulte === 1 || l.difficulte === 2),
    'une facile s’écrit en difficulté 1 ou 2',
  )

  // Le cinéma a de tout ; Noël, vingt faciles : rien au cinéma, et le Nouvel An d'abord, le moins fourni.
  const cinema = SOUS_THEMES['Cinéma & séries'].flatMap(s => [1, 3, 4, 5].flatMap(difficulte => Array.from({ length: 60 }, () => ({ categorie: 'Cinéma & séries', sousTheme: s.cle, difficulte }))))
  const noel = Array.from({ length: 20 }, () => ({ categorie: 'Autour de la fête', sousTheme: 'noel', difficulte: 2 }))
  const deux = commandeDesSentiers([...cinema, ...noel], 2)
  assert.equal(deux.has('Cinéma & séries'), false, 'le cinéma ne manque de rien')
  const faciles = (cle: string) => deux.get('Autour de la fête')!.filter(l => l.cle === cle && l.difficulte! <= 2).reduce((s, l) => s + l.n, 0)
  assert.deepEqual([faciles('noel'), faciles('nouvel-an')], [10, 30], 'soixante faciles pour deux montées : trente chacun')

  // Le plan en fait des lots, comme d'une commande à parts égales.
  const lots = planDeLaGeneration([], { nom: 's1', questions: 0, commandes: une }).flatMap(v => v.lots)
  assert.equal(lots.reduce((s, l) => s + totalDe(l), 0), 12 * 208)
  assert.ok(lots.every(l => totalDe(l) <= QUESTIONS_PAR_LOT))
})

test('préparer pour les sentiers : la commande dit combien, sans --questions', () => {
  const ctx = contexte()
  try {
    const { generation, missions } = preparer(ctx, { sentiers: 1, nom: 's1' })
    assert.equal(generation.demandees, 12 * 208)
    assert.ok(missions.length > 0)
    assert.throws(() => preparer(contexte(), { sentiers: 9 }), /de 1 à 5 montées/)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

// Un thème qu'on ajoute (`shared/sujets.ts`, le souhait du propriétaire du
// 11 octobre 2026 : « prévoir pour l'avenir de rajouter des thèmes ») se
// remplit sans attendre que la base le croise.
test('pour un thème : ce que ses six paliers et une série demandent, marche par marche, dans ses sous-thèmes — le moins fourni d’abord', () => {
  const parMarche = (lignes: readonly QuotaDEcriture[]) => {
    const m: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
    for (const l of lignes) m[niveauDeQuestion(l.difficulte!)] += l.n
    return m
  }
  const meta = (categorie: string, sousTheme: string, difficulte: number, etiquettes: string[] = []) => ({ categorie, sousTheme, difficulte, etiquettes, date: null, portee: 'monde' as const })
  // Une base vide : deux montées de ses six paliers — 21 faciles, 24 moyennes et 15 difficiles chacune —, et les cinq expertes d'une série.
  const terre = sujetParCle('terre-espace')!
  const vide = commandeDuTheme(terre, [])
  assert.deepEqual([...vide.keys()].sort(), ['Géographie', 'Sciences'])
  const toutes = [...vide.values()].flat()
  assert.deepEqual(parMarche(toutes), { facile: 42, moyen: 48, difficile: 30, expert: 5 })
  const deSousTheme = (cle: string) => toutes.filter(l => l.cle === cle).reduce((s, l) => s + l.n, 0)
  // Ses trois sous-thèmes depuis que l'espace est à l'astronomie (le 17 octobre 2026).
  assert.deepEqual(['terre', 'eaux', 'reliefs'].map(deSousTheme), [42, 42, 41], 'ses trois sous-thèmes à tour de rôle')
  assert.equal(deSousTheme('espace'), 0, 'rien de l’astronomie')
  assert.ok(vide.get('Géographie')!.every(l => l.cle === 'eaux' || l.cle === 'reliefs'), 'rien hors de ses sous-thèmes')

  // Ce que ses étiquettes lui apportent compte : quarante animaux faciles au cinéma, il n'en manque que deux — écrits en nature.
  const animaux = sujetParCle('animaux')!
  const auCinema = Array.from({ length: 40 }, () => meta('Cinéma & séries', 'sagas', 2, ['animaux']))
  const commande = commandeDuTheme(animaux, auCinema)
  assert.deepEqual([...commande.keys()], ['Nature'])
  assert.equal(parMarche(commande.get('Nature')!).facile, 2)
  // Plein, rien à écrire ; lu sur ses seules étiquettes, il ne se commande pas.
  const plein = (['mammiferes', 'oiseaux'] as const).flatMap(s => [1, 3, 4, 5].flatMap(d => Array.from({ length: 30 }, () => meta('Nature', s, d))))
  assert.equal(commandeDuTheme(animaux, plein).size, 0)
  assert.throws(() => commandeDuTheme({ ...animaux, sousThemes: undefined }, []), /ne se lit que sur ses étiquettes/)

  const ctx = contexte()
  try {
    const { generation, missions } = preparer(ctx, { theme: 'terre-espace', nom: 't1' })
    assert.equal(generation.demandees, 125)
    assert.ok(missions.length > 0)
    assert.throws(() => preparer(contexte(), { theme: 'annees-80' }), /l'un des thèmes de shared\/sujets\.ts \(animaux, /)
    assert.throws(() => preparer(contexte(), { theme: 'animaux', questions: 10 }), /un seul à la fois/)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

// Le souhait du propriétaire du 15 octobre 2026 : étoffer les plus petits
// thèmes — un fil rouge, une époque, un thème —, là où ils vivent déjà.
test('pour un sujet : n questions de plus là où il vit, aux difficultés qui lui manquent, chacune dite sienne hors de ses sous-thèmes', () => {
  const meta = (categorie: string, sousTheme: string, difficulte: number, o: { etiquettes?: string[]; annee?: string } = {}) => ({
    categorie,
    sousTheme,
    difficulte,
    etiquettes: o.etiquettes ?? [],
    date: o.annee ? { valeur: o.annee, precision: 'annee' as const } : null,
    portee: 'monde' as const,
  })
  const deLaPaire = (c: Map<Categorie, QuotaDEcriture[]>, categorie: Categorie, cle: string) => (c.get(categorie) ?? []).filter(l => l.cle === cle).reduce((s, l) => s + l.n, 0)
  const parDifficulte = (lignes: readonly QuotaDEcriture[], d: number) => lignes.filter(l => l.difficulte === d).reduce((s, l) => s + l.n, 0)

  // Trente surnoms au cyclisme, dix chez les rois, tous experts ou difficiles ; cinquante questions de football qui n'en sont pas.
  const surnoms = sujetParCle('surnoms')!
  const base = [
    ...Array.from({ length: 30 }, () => meta('Sport', 'cyclisme', 5, { etiquettes: ['surnom'] })),
    ...Array.from({ length: 10 }, () => meta('Histoire', 'personnages', 4, { etiquettes: ['surnom'] })),
    ...Array.from({ length: 50 }, () => meta('Sport', 'football', 1)),
  ]
  const commande = commandeDuSujet(surnoms, base, 40)
  const lignes = [...commande.values()].flat()
  assert.equal(lignes.reduce((s, l) => s + l.n, 0), 40)
  assert.deepEqual([deLaPaire(commande, 'Sport', 'cyclisme'), deLaPaire(commande, 'Histoire', 'personnages'), deLaPaire(commande, 'Sport', 'football')], [30, 10, 0], 'là où il vit, à proportion')
  assert.ok(lignes.every(l => l.contrainte === 'chacune étiquetée « surnom » (Les surnoms)'), 'hors de ses sous-thèmes — il n’en a pas —, son étiquette')
  assert.equal(parDifficulte(lignes, 5), 0, 'des expertes, il en a déjà trop')
  assert.ok(parDifficulte(lignes, 1) > 0 && parDifficulte(lignes, 2) > 0 && parDifficulte(lignes, 3) > 0, 'les faciles et les moyennes qui lui manquent')
  assert.ok(new Set(commande.get('Sport')!.map(l => l.difficulte)).size >= 3, 'chaque paire un peu de chaque difficulté')

  // Une époque : datée dans ses années.
  const annees50 = sujetParCle('annees-50')!
  const auJazz = commandeDuSujet(annees50, [meta('Musique', 'jazz-monde', 3, { annee: '1955' }), meta('Musique', 'jazz-monde', 3, { annee: '1975' })], 6)
  assert.deepEqual([...auJazz.keys()], ['Musique'])
  assert.ok(auJazz.get('Musique')!.every(l => l.cle === 'jazz-monde' && l.contrainte === 'chacune datée de 1950 à 1959 (Les années 50)'))

  // Un thème : dans son sous-thème, rien à dire de plus ; ailleurs, son étiquette.
  const mythes = sujetParCle('mythes-legendes')!
  const enMythes = commandeDuSujet(mythes, [...Array.from({ length: 3 }, () => meta('Culture générale', 'mythes', 3)), meta('Autour de la fête', 'halloween', 3, { etiquettes: ['contes-legendes'] })], 8)
  assert.deepEqual([deLaPaire(enMythes, 'Culture générale', 'mythes'), deLaPaire(enMythes, 'Autour de la fête', 'halloween')], [6, 2])
  assert.ok(enMythes.get('Culture générale')!.every(l => l.contrainte === undefined))
  assert.ok(enMythes.get('Autour de la fête')!.every(l => l.contrainte === 'chacune étiquetée « contes-legendes » (Mythes et légendes)'))
  // Sans question encore, ses sous-thèmes ; sans sous-thème ni question, rien ne dit où écrire.
  assert.deepEqual([...commandeDuSujet(mythes, [], 4).keys()], ['Culture générale'])
  assert.throws(() => commandeDuSujet(surnoms, [], 4), /rien ne dit où l'écrire/)

  // Deux sujets dans un même sous-thème : deux morceaux d'une même vague, chacun sa contrainte jusque dans la consigne.
  const deux = new Map<Categorie, QuotaDEcriture[]>([
    [
      'Histoire',
      [
        { cle: 'personnages', n: 3, difficulte: 2, contrainte: 'chacune étiquetée « surnom » (Les surnoms)' },
        { cle: 'personnages', n: 2, difficulte: 2, contrainte: 'chacune datée de 1950 à 1959 (Les années 50)' },
      ],
    ],
  ])
  const vagues = planDeLaGeneration([], { nom: 'p1', questions: 0, commandes: deux })
  assert.equal(vagues.length, 1)
  const quotas = vagues[0].lots.flatMap(l => l.quotas)
  assert.deepEqual(quotas.map(q => `${q.n} ${q.contrainte}`).sort(), ['2 chacune datée de 1950 à 1959 (Les années 50)', '3 chacune étiquetée « surnom » (Les surnoms)'])
  const consigne = consigneDEcriture('Histoire', quotas, { sorte: 'fichier', fichier: '/tmp/lots/p1-01.json' })
  assert.match(consigne, /^- personnages \(.*\) : 3 questions de difficulté 2, chacune étiquetée « surnom » \(Les surnoms\)$/m)
  assert.match(consigne, /^Une ligne qui finit par « chacune … » écrit pour un thème de « Sur quoi \? »/m)

  // Préparer : n questions de plus pour chacun des sujets nommés.
  const surnom = lireQuestionDeLaBase({ ...entree(1, { categorie: 'Sport', sousTheme: 'cyclisme' }), etiquettes: ['surnom'], id: 'surn0001' })
  if ('refus' in surnom) throw new Error(surnom.refus)
  const ctx = contexte([surnom.question])
  try {
    const { generation, missions } = preparer(ctx, { sujet: 'mythes-legendes,surnoms', questions: 10, nom: 'f1' })
    assert.equal(generation.demandees, 20)
    assert.ok(missions.length > 0)
    assert.match(ctx.journal.join('\n'), /cyclisme : Les surnoms 10/)
    assert.throws(() => preparer(contexte(), { sujet: 'surnoms' }), /avec --questions=<nombre>/)
    assert.throws(() => preparer(contexte(), { sujet: 'licornes', questions: 5 }), /des sujets de shared\/sujets\.ts \(animaux, /)
    assert.throws(() => preparer(contexte(), { sujet: 'surnoms', questions: 5, inventaire: 'danse' }), /--sujet ne se mêle/)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

test('la consigne d’un lot : un seul fichier, vérifié jusqu’à zéro refus, rien d’autre', () => {
  const fichier = '/tmp/lots/g1-007.json'
  const consigne = consigneDEcriture('Sport', [{ cle: 'rugby', n: 12, difficulte: 4 }], { sorte: 'fichier', fichier }, ['Un intitulé déjà écrit ?'])
  assert.match(consigne, /^TA PART — 12 QUESTIONS À ÉCRIRE, CATÉGORIE « Sport »/m)
  assert.match(consigne, /Écris toutes tes questions d'un seul coup dans \/tmp\/lots\/g1-007\.json/)
  assert.ok(consigne.includes(`cd ${SERVEUR} && npx tsx scripts/base-campagne.ts verifier ${fichier}`), 'le vérificateur du rangement, sur son fichier')
  assert.match(consigne, /N'écris rien d'autre que ce fichier/)
  assert.doesNotMatch(consigne, /-01\.json|\{lot\}/, 'pas de série de fichiers à numéroter')
  assert.match(consigne, /Un intitulé déjà écrit \?/)
})

test('lire des décisions : seules celles qui visent la fiche, et disent quoi faire', () => {
  const refs = new Set(['g1-01.json#0', 'g1-01.json#1', 'g1-01.json#2'])
  const { decisions, ecartees } = lireLesDecisions(
    [
      { ref: 'g1-01.json#0', action: 'retirer', motif: 'record battu' },
      { ref: '[g1-01#1]', action: 'corriger', champs: { anecdote: 'Corrigée.' }, motif: 'date' },
      { ref: 'g1-09.json#0', action: 'retirer' },
      { ref: 'g1-01.json#2', action: 'garder' },
      { ref: 'g1-01.json#2', action: 'corriger' },
      'du texte',
    ],
    refs,
  )
  assert.deepEqual(decisions, [
    { ref: 'g1-01.json#0', action: 'retirer', motif: 'record battu' },
    { ref: 'g1-01.json#1', action: 'corriger', champs: { anecdote: 'Corrigée.' }, motif: 'date' },
  ])
  assert.equal(ecartees, 4)
})

test('le juge des lots : ce que le rangement refuserait, dans son ordre', () => {
  const tri = new TriDesEntrees([question(1)], new Set([question(7).empreinte]))
  const sorte = (j: ReturnType<TriDesEntrees['juger']>) => ('sorte' in j ? j.sorte : 'acceptée')
  assert.equal(sorte(tri.juger({ ...entree(5), confiance: 2 }, 'a#0')), 'juge')
  assert.equal(sorte(tri.juger(entree(1), 'a#1')), 'base', 'le même intitulé que la base')
  assert.equal(sorte(tri.juger(entree(7), 'a#2')), 'livre', 'le même intitulé qu’un quiz livré')
  // Le même fait sous un autre intitulé : même réponse, même lieu.
  assert.equal(sorte(tri.juger({ ...entree(1), texte: 'Par quoi ce lieu se distingue-t-il vraiment de tous les autres ?' }, 'a#3')), 'fait')
  assert.equal(sorte(tri.juger(entree(6), 'a#4')), 'acceptée')
  assert.deepEqual(tri.juger(entree(6), 'b#0'), { refus: 'doublon de a#4', sorte: 'doublon' })
})

test('appliquer une relecture : retirer, corriger une phrase — jamais une réponse —, retirer ce que le juge refuse', () => {
  const lots = new Map([['g1-01.json', [entree(1), entree(2), entree(3), entree(4)]]])
  const fait = appliquerLesDecisions(
    [
      { ref: 'g1-01.json#0', action: 'retirer' },
      { ref: 'g1-01.json#1', action: 'corriger', champs: { anecdote: 'Une meilleure anecdote.', reponses: ['a', 'b', 'c', 'd'] } },
      { ref: 'g1-01.json#2', action: 'corriger', champs: { difficulte: 9 } },
    ],
    lots,
  )
  assert.equal(fait.retirees, 2, 'la retirée, et la corrigée que le juge refuse')
  assert.equal(fait.corrigees, 1)
  const apres = fait.lots.get('g1-01.json')! as { texte: string; anecdote: string; reponses: string[] }[]
  assert.deepEqual(
    apres.map(e => e.texte),
    [entree(2).texte, entree(4).texte],
  )
  assert.equal(apres[0].anecdote, 'Une meilleure anecdote.')
  assert.deepEqual(apres[0].reponses, entree(2).reponses, 'les réponses ne bougent pas')
  assert.equal(lots.get('g1-01.json')!.length, 4, 'les lots donnés restent tels quels')
  assert.deepEqual(fait.ignorees, [])
})

test('une correction se lit sous les noms que lit le correcteur — « intitulé », « difficulté » —, et une correction qui ne nomme rien ne passe pas pour faite', () => {
  // Le 10 octobre 2026, dix corrections ainsi nommées passaient pour faites, et n'avaient rien changé.
  const lots = new Map([['g2-06.json', [entree(1), entree(2), entree(3)]]])
  const fait = appliquerLesDecisions(
    [
      { ref: 'g2-06.json#0', action: 'corriger', champs: { difficulté: 2 } },
      { ref: 'g2-06.json#1', action: 'corriger', champs: { intitulé: 'Quel fait numéro 2 distingue vraiment ce lieu 2 ?', difficulte: '4' } },
      { ref: 'g2-06.json#2', action: 'corriger', champs: { couleur: 'bleue' } },
    ],
    lots,
  )
  const apres = fait.lots.get('g2-06.json')! as { texte: string; difficulte: number }[]
  assert.equal(apres[0].difficulte, 2)
  assert.equal(apres[1].texte, 'Quel fait numéro 2 distingue vraiment ce lieu 2 ?')
  assert.equal(apres[1].difficulte, 4, 'une difficulté écrite en lettres se lit')
  assert.equal(fait.corrigees, 2)
  assert.deepEqual(
    fait.ignorees.map(d => d.ref),
    ['g2-06.json#2'],
  )
  assert.deepEqual(apres[2], entree(3), 'rien de changé, et elle le dit')
})

test('de bout en bout : préparer, écrire par vagues, recueillir, relire, et laisser des lots prêts à ranger', () => {
  const ctx = contexte([question(1, { categorie: 'Sport', sousTheme: 'rugby' })])
  try {
    // Des lots de cinq : chaque sous-thème en demande deux, donc deux vagues.
    const { generation: g, missions } = preparer(ctx, { questions: 120, categories: ['Sport', 'Musique'], parLot: 5 })
    assert.equal(g.nom, 'g1')
    assert.ok(g.vagues.length >= 2)
    assert.equal(missions.length, g.vagues[0].lots.length, 'un rédacteur par lot de la première vague')
    assert.ok(missions.every(m => m.agent === 'redacteur-campagne'))
    assert.ok(!existsSync(path.join(ctx.dossier, 'g1', `${g.vagues[1].lots[0].id}.consigne.md`)), 'la seconde vague attend la première')
    // Rien n'est rendu : la suite redemande les mêmes lots.
    assert.equal(suite(ctx, charger(ctx)).length, missions.length)

    let numero = 1000
    const ecrire = (ms: readonly Mission[]) => {
      for (const m of ms.filter(m => m.agent === 'redacteur-campagne')) {
        const questions = ecrireLeLot(m, numero)
        numero += questions.length
        // L'agent a vérifié seul : il ne savait ni la base d'un autre lot, ni que son voisin écrirait le même fait.
        writeFileSync(cible(m), JSON.stringify([...questions, entree(1, { categorie: 'Sport', sousTheme: 'rugby' })]))
      }
    }
    const relire = (ms: readonly Mission[]) => {
      for (const m of ms.filter(m => m.agent === 'relecteur-campagne')) {
        const fiche = readFileSync(/Ta fiche est dans (\S+\.txt)/.exec(m.mission)![1], 'utf8')
        const refs = [...fiche.matchAll(/^\[(\S+#\d+)\]/gm)].map(([, ref]) => ref)
        // Retire la première question de la fiche, corrige l'anecdote de la deuxième.
        writeFileSync(
          cible(m),
          JSON.stringify([
            { ref: refs[0], action: 'retirer', motif: 'douteuse' },
            { ref: refs[1], action: 'corriger', champs: { anecdote: 'Relue et corrigée.' }, motif: 'précision' },
          ]),
        )
      }
    }

    ecrire(missions)
    let suivantes = suite(ctx, charger(ctx))
    const apres1 = charger(ctx)
    assert.ok(apres1.vagues[0].recueil && apres1.vagues[1].consignes, 'la première recueillie, la seconde à écrire')
    assert.ok(suivantes.some(m => m.agent === 'relecteur-campagne'), 'la première vague se relit…')
    assert.ok(suivantes.some(m => m.agent === 'redacteur-campagne'), '… pendant que la seconde s’écrit')
    // La seconde vague sait ce que la première a écrit dans ses sous-thèmes.
    const lot2 = apres1.vagues[1].lots[0]
    const consigne2 = readFileSync(path.join(ctx.dossier, 'g1', `${lot2.id}.consigne.md`), 'utf8')
    const ecrits1 = apres1.vagues[0].lots.flatMap(l => lireLot(path.join(ctx.dossier, `${l.id}.json`))) as { texte: string; categorie: string; sousTheme: string }[]
    const voisins = ecrits1.filter(e => e.categorie === lot2.categorie && lot2.quotas.some(q => q.cle === e.sousTheme))
    assert.ok(voisins.length > 0)
    for (const e of voisins) assert.ok(consigne2.includes(e.texte), `« ${e.texte} » rappelé à ${lot2.id}`)

    for (let tour = 0; tour < 10 && suivantes.length > 0; tour++) {
      ecrire(suivantes)
      relire(suivantes)
      suivantes = suite(ctx, charger(ctx))
    }
    const fini = charger(ctx)
    assert.ok(fini.vagues.every(v => v.relecture), 'chaque vague relue')
    const nbLots = fini.vagues.flatMap(v => v.lots).length
    const nbFiches = fini.vagues.flatMap(v => v.fiches ?? []).length
    const t = totaux(fini)
    assert.equal(t.ecrites, 120 + nbLots)
    assert.equal(t.refus.base, nbLots, 'la question de la base, recopiée dans chaque lot, écartée au recueil')
    assert.equal(t.acceptees, 120)
    assert.equal(t.retirees, nbFiches)
    assert.equal(t.corrigees, nbFiches)
    // Les lots : rangeables tels quels, sans les retirées, les corrigées corrigées.
    const fichiers = readdirSync(ctx.dossier).filter(f => /^g1-\d+\.json$/.test(f))
    const gardees = fichiers.flatMap(f => lireLot(path.join(ctx.dossier, f)))
    assert.equal(gardees.length, 120 - nbFiches)
    for (const e of gardees) assert.ok('question' in lireQuestionDeLaBase(e, { sansId: true }))
    assert.equal(gardees.filter(e => (e as { anecdote: string }).anecdote === 'Relue et corrigée.').length, nbFiches)
    assert.match(ctx.journal.join('\n'), /ranger \.\.\/\.lots-campagne\/g1-\*\.json/, 'le bilan dit quoi faire ensuite')

    // Rejouée, la relecture repart des lots recueillis : elle ne retire pas deux fois.
    const avant = fichiers.map(f => readFileSync(path.join(ctx.dossier, f), 'utf8'))
    for (const v of fini.vagues) delete v.relecture
    sauver(ctx, fini)
    assert.deepEqual(suite(ctx, charger(ctx)), [])
    assert.deepEqual(
      fichiers.map(f => readFileSync(path.join(ctx.dossier, f), 'utf8')),
      avant,
    )
    assert.equal(totaux(charger(ctx)).retirees, nbFiches, 'ni ne compte deux fois')
    // Une génération finie en laisse préparer une autre, qui ne reprend pas ses faits.
    assert.equal(lotsEnAttente(ctx.dossier, new Set()).length, 120 - nbFiches)
    assert.equal(preparer(ctx, { questions: 12, categories: ['Sport'] }).generation.nom, 'g2')
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

test('deux agents posent le même fait : le recueil de la vague n’en garde qu’un', () => {
  const ctx = contexte()
  try {
    const { generation: g, missions } = preparer(ctx, { questions: 40, categories: ['Cuisine'], parLot: 20 })
    assert.ok(missions.length >= 2)
    // Chacun a vérifié seul, contre la base : rien ne lui disait que son voisin écrirait la même question.
    for (const [i, m] of missions.entries()) writeFileSync(cible(m), JSON.stringify([...ecrireLeLot(m, 100 * (i + 1)), entree(9999, { categorie: 'Cuisine', sousTheme: 'chefs' })]))
    suite(ctx, charger(ctx, g.nom))
    assert.equal(totaux(charger(ctx, g.nom)).refus.doublon, missions.length - 1, 'le premier lot garde la question, les autres la perdent')
    assert.match(readFileSync(path.join(ctx.dossier, g.nom, 'refus-1.txt'), 'utf8'), /doublon de g1-\d+\.json#\d+/)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

test('--forcer : un lot jamais rendu compte pour vide, une fiche sans décisions met ses lots de côté — jamais rangés', () => {
  const ctx = contexte()
  try {
    const { generation: g, missions } = preparer(ctx, { questions: 40, categories: ['Nature'], parLot: 20 })
    assert.equal(g.vagues.length, 1)
    const [premiere, ...autres] = missions
    for (const [i, m] of autres.entries()) writeFileSync(cible(m), JSON.stringify(ecrireLeLot(m, 100 * (i + 1))))
    // Sans --forcer, la suite attend l'agent qui manque.
    assert.deepEqual(
      suite(ctx, charger(ctx)).map(m => m.quoi),
      [premiere.quoi],
    )
    const relectures = suite(ctx, charger(ctx), { forcer: true })
    assert.deepEqual(totaux(charger(ctx)).manquants, [premiere.quoi.split(' ')[0]])
    assert.ok(relectures.length > 0 && relectures.every(m => m.agent === 'relecteur-campagne'), '--forcer ne passe pas outre ce qu’il vient de demander')
    assert.deepEqual(suite(ctx, charger(ctx), { forcer: true }), [])
    const fini = charger(ctx)
    assert.ok(fini.vagues[0].relecture)
    const misDeCote = totaux(fini).aRelire
    assert.ok(misDeCote.length > 0)
    for (const f of misDeCote) {
      assert.ok(!existsSync(path.join(ctx.dossier, f)), `${f} hors de portée de ranger g1-*.json`)
      assert.ok(existsSync(path.join(ctx.dossier, g.nom, 'a-relire', f)))
    }
    assert.match(ctx.journal.join('\n'), /Sans relecture, mis de côté/)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

test('une génération à la fois : deux, écrites ensemble, viseraient les mêmes sous-thèmes sans se voir', () => {
  const ctx = contexte()
  try {
    preparer(ctx, { questions: 24, categories: ['Histoire'] })
    assert.throws(() => preparer(ctx, { questions: 24, categories: ['Histoire'] }), /« g1 » n'est pas finie/)
    etat(ctx, charger(ctx))
    assert.match(ctx.journal.join('\n'), /vague 1 : \d+ lots — 0\/\d+ lots écrits/)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})

// Un lot écrit à la main, que `base-campagne.ts` lit : la même forme qu'un lot d'une génération.
test('les lots en attente : ceux que le juge accepte, sauf ceux nommés et ce que la base a déjà', () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'lots-'))
  try {
    writeFileSync(path.join(dossier, 'geo1-01.json'), JSON.stringify([entree(1), entree(2), { texte: 'cassée' }]))
    writeFileSync(path.join(dossier, 'geo1-02.json'), JSON.stringify([entree(3)]))
    writeFileSync(path.join(dossier, 'notes.json'), JSON.stringify([entree(4)]))
    writeFileSync(path.join(dossier, 'geo1-03.json'), '[{"texte": "en cours d’écri')
    const attente = lotsEnAttente(dossier, new Set([question(2).empreinte]), new Set(['geo1-02.json']))
    assert.deepEqual(
      attente.map(a => a.ou),
      ['geo1-01.json#0'],
    )
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

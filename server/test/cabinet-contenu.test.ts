// Le contenu neuf du Cabinet de curiosités (le lot B4 de la conception) : les
// lieux datés de l'Épingle, les fiches des Indices, les répliques, les frises
// à thème — ce que la base de la campagne n'a pas. Des agents l'ont écrit et
// relu ; ici, ce que chaque entrée doit être pour arriver sur un téléphone,
// ce qui fait deux fois la même, et ce que le contenu livré doit tenir.
//
// Un juge, une seule fois écrit (`server/src/core/cabinet/contenu.ts`) : le
// serveur l'applique au chargement, le script de rangement à chaque lot, ce
// test au contenu livré. Deux copies de ces règles finiraient par dire deux
// choses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  DOSSIER_DU_CONTENU,
  LIEUX_VOISINS_KM,
  SORTES,
  SORTES_DU_CONTENU,
  contenuDuCabinet,
  ligneDe,
  lireLeContenu,
  refusDeLaFiche,
  refusDeLaFriseATheme,
  refusDeLaReplique,
  refusDuLieu,
  trier,
  type SorteDuContenu,
} from '../src/core/cabinet/contenu'
import {
  CASES_DE_LA_VISITE,
  CHASSES_PAR_JOUR,
  CLES_MAX,
  EVENEMENTS_D_UNE_FRISE_A_THEME,
  INDICES_D_UNE_FICHE,
  INDICE_MAX,
  JOURS_SANS_REDITE,
  LIBRES_QUI_PAIENT,
  MANCHES_PAR_PARTIE,
  MOTS_D_UNE_REPLIQUE_MAX,
  QUESTION_MAX,
  RECIT_MAX,
  SAVAIS_MAX,
} from '../../shared/cabinet/bareme'
import { CLES_DES_JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import { distanceKm } from '../../shared/cabinet/france'
import type { Fiche, FriseATheme, Lieu, Replique } from '../../shared/cabinet/contenu'

/**
 * Ce que le contenu livré tient, au moins : un plancher qui ne recule pas. Il
 * monte quand un lot entre — un lot rangé puis perdu par une fusion
 * maladroite ferait rougir ce test, pas un joueur qui retombe sur les mêmes
 * lieux.
 */
const AU_MOINS: Readonly<Record<SorteDuContenu, number>> = { lieux: 90, fiches: 60, repliques: 60, frises: 18 }

const brut = (s: SorteDuContenu): unknown[] => JSON.parse(readFileSync(path.join(DOSSIER_DU_CONTENU, SORTES[s].fichier), 'utf8'))

// ── Le contenu livré ────────────────────────────────────────────────────────

test('chaque lieu, fiche, réplique et frise livrée passe son juge, aucune ne se répète, et le plancher tient', () => {
  for (const s of SORTES_DU_CONTENU) {
    const entrees = brut(s)
    const { gardees, ecartees } = trier(s, entrees)
    assert.deepEqual(
      ecartees.map(e => `${(e.entree as { id?: string })?.id ?? '?'} : ${e.motif}`),
      [],
      `${SORTES[s].fichier} : ce qui ne se pose pas se corrige dans le contenu, jamais en desserrant le juge`,
    )
    assert.equal(gardees.length, entrees.length)
    assert.ok(gardees.length >= AU_MOINS[s], `${SORTES[s].fichier} : ${gardees.length} entrées, le plancher en veut ${AU_MOINS[s]}`)
  }
})

test('une entrée par ligne, ses champs dans l’ordre du juge : une relecture de PR se fait entrée par entrée', () => {
  for (const s of SORTES_DU_CONTENU) {
    const fichier = SORTES[s].fichier
    const lignes = readFileSync(path.join(DOSSIER_DU_CONTENU, fichier), 'utf8').trimEnd().split('\n')
    assert.equal(lignes[0], '[', fichier)
    assert.equal(lignes.at(-1), ']', fichier)
    const entrees = lignes.slice(1, -1)
    entrees.forEach((l, i) => {
      const e = JSON.parse(l.replace(/,$/, '')) as never
      assert.equal(l, ligneDe(s, e) + (i < entrees.length - 1 ? ',' : ''), `${fichier} : ${l.slice(0, 60)}`)
    })
  }
})

test('chaque thème de l’Épingle a de quoi faire une partie : trois lieux d’un même thème', () => {
  const parTheme = new Map<string, number>()
  for (const l of contenuDuCabinet().lieux) parTheme.set(l.theme, (parTheme.get(l.theme) ?? 0) + 1)
  for (const [theme, n] of parTheme) assert.ok(n >= MANCHES_PAR_PARTIE, `« ${theme} » : ${n} lieux`)
})

test('chaque jeu du contenu neuf tient sept jours sans redite, au rythme d’une visite, deux chasses et cinq libres', () => {
  // Le rythme d'un joueur assidu : les trois parties de sa visite, ses deux
  // chasses, ses cinq parties libres qui paient — dix parties par jour, que la
  // visite fait tourner sur les neuf jeux (ceux des deux jours d'avant passent
  // après). Chaque jeu en reçoit donc deux par jour au plus, en moyenne
  // arrondie au-dessus ; sur sept jours sans redite, il lui faut autant de
  // contenus que de manches — une frise à thème, elle, fait une partie entière
  // (ses trois vagues sont les trois manches).
  const partiesParJour = Math.ceil((CASES_DE_LA_VISITE + CHASSES_PAR_JOUR + LIBRES_QUI_PAIENT) / CLES_DES_JEUX.length)
  assert.equal(partiesParJour, 2)
  const contenu = contenuDuCabinet()
  const tient: [CleDeJeu, number, number][] = [
    ['epingle', contenu.lieux.length, MANCHES_PAR_PARTIE],
    ['indices', contenu.fiches.length, MANCHES_PAR_PARTIE],
    ['replique', contenu.repliques.length, MANCHES_PAR_PARTIE],
    ['frise', contenu.frises.length, 1],
  ]
  for (const [jeu, n, parPartie] of tient) {
    const faut = JOURS_SANS_REDITE * partiesParJour * parPartie
    assert.ok(n >= faut, `${jeu} : ${n} contenus pour ${faut}`)
  }
  // L'Épingle tire ses trois lieux d'un même thème : chaque thème fait autant de parties qu'il a de fois trois lieux.
  const parTheme = new Map<string, number>()
  for (const l of contenu.lieux) parTheme.set(l.theme, (parTheme.get(l.theme) ?? 0) + 1)
  const parties = [...parTheme.values()].reduce((s, n) => s + Math.floor(n / MANCHES_PAR_PARTIE), 0)
  assert.ok(parties >= JOURS_SANS_REDITE * partiesParJour, `${parties} parties d'Épingle à thème`)
})

test('le serveur lit le contenu livré une fois, hors de client/public', () => {
  const contenu = contenuDuCabinet()
  assert.equal(contenuDuCabinet(), contenu, 'lu une fois par processus')
  for (const s of SORTES_DU_CONTENU) assert.equal(contenu[s].length, brut(s).length, s)
  // Chaque entrée porte sa réponse (invariant 1) : servie d'avance, elle serait sur le téléphone avant la question.
  assert.ok(DOSSIER_DU_CONTENU.endsWith(path.join('server', 'content', 'cabinet')))
  const racine = path.resolve(DOSSIER_DU_CONTENU, '../../..')
  for (const s of SORTES_DU_CONTENU) assert.ok(!existsSync(path.join(racine, 'client/public', SORTES[s].fichier)) && !existsSync(path.join(racine, 'client/public/cabinet')), s)
})

test('un fichier qui manque, une entrée qui ne se pose pas : le serveur s’en passe et le dit au journal', t => {
  const dossier = mkdtempSync(path.join(os.tmpdir(), 'cabinet-contenu-'))
  try {
    const avertis = t.mock.method(console, 'warn', () => {})
    writeFileSync(path.join(dossier, SORTES.lieux.fichier), JSON.stringify([LIEU, { ...LIEU, id: 'hors-de-france', lat: 52.5 }, { ...LIEU, id: 'beaune-encore', lon: 4.84 }]))
    writeFileSync(path.join(dossier, SORTES.frises.fichier), '[{"id":')
    const lu = lireLeContenu(dossier)
    assert.deepEqual(lu.lieux.map(l => l.id), [LIEU.id], 'le lieu hors de France et le doublon s’écartent')
    assert.deepEqual([lu.fiches.length, lu.repliques.length, lu.frises.length], [0, 0, 0], 'un fichier absent ou illisible ne donne rien')
    const dits = avertis.mock.calls.map(c => c.arguments.join(' '))
    assert.ok(dits.some(d => d.includes('hors-de-france')), dits.join('\n'))
    assert.ok(dits.some(d => d.includes('beaune-encore') && d.includes(LIEU.id)), 'le doublon dit qui il redit')
    assert.ok(dits.some(d => d.includes(SORTES.fiches.fichier)), 'le fichier qui manque se dit')
    assert.ok(dits.some(d => d.includes(SORTES.frises.fichier)), 'le fichier illisible se dit')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

// ── Les juges ───────────────────────────────────────────────────────────────

const LIEU: Lieu = {
  id: 'arts-hospices-de-beaune',
  theme: "Les lieux de l'art",
  nom: "L'Hôtel-Dieu de Beaune",
  commune: 'Beaune',
  departement: "Côte-d'Or",
  lat: 47.022,
  lon: 4.837,
  annee: 1443,
  date: '1443',
  recit: "Le chancelier d'un puissant duc et sa femme fondent un hôpital pour les pauvres.",
  question: 'Où se trouve cet hôpital aux toits multicolores ?',
  savais: 'Ses vins sont vendus aux enchères depuis 1859.',
  categorie: 'Arts & lettres',
}

test('un lieu : dans la France, sa commune et son département jamais dits avant la révélation, une question « Où … ? »', () => {
  assert.equal(refusDuLieu(LIEU), null)
  // Le nom du lieu peut se dire : il ne donne pas la commune.
  assert.equal(refusDuLieu({ ...LIEU, question: 'Où se trouve la place Stanislas ?', commune: 'Nancy', departement: 'Meurthe-et-Moselle' }), null)
  assert.equal(refusDuLieu({ ...LIEU, commune: 'Le Havre', departement: 'Seine-Maritime', recit: 'Le centre d’un grand port est rebâti.' }), null, 'un mot de la commune ne la dit pas')
  for (const [lieu, pourquoi] of [
    [{ ...LIEU, lat: 52.5 }, 'hors du cadre de la France'],
    [{ ...LIEU, lon: 9.9 }, 'à l’est de la Corse'],
    [{ ...LIEU, lat: Number.NaN }, 'une latitude qui n’est pas un nombre'],
    [{ ...LIEU, lat: '47.022' }, 'une latitude en texte'],
    [{ ...LIEU, recit: 'Le chancelier fonde un hôpital à Beaune.' }, 'la commune dans le récit'],
    [{ ...LIEU, question: 'Où se trouve cet hôpital, près de beaune ?' }, 'la commune sans sa capitale'],
    [{ ...LIEU, recit: 'Un hôpital fondé en Côte d’Or, pour les pauvres.' }, 'le département, apostrophe courbe et sans trait d’union'],
    [{ ...LIEU, recit: 'Un hôpital au cœur de la Cote-d’Or.' }, 'le département sans son accent'],
    [{ ...LIEU, commune: 'Le Havre', departement: 'Seine-Maritime', recit: 'Le centre du Havre est rebâti en béton.' }, 'la commune sans son article'],
    [{ ...LIEU, date: 'à Beaune, en 1443' }, 'la commune dans la date, montrée avec la question'],
    [{ ...LIEU, theme: 'Beaune et ses vignes' }, 'la commune dans le thème, montré avec la question'],
    [{ ...LIEU, question: 'Quel est cet hôpital ?' }, 'une question qui ne demande pas où'],
    [{ ...LIEU, question: `Où se trouve ${'x'.repeat(QUESTION_MAX)} ?` }, 'une question trop longue'],
    [{ ...LIEU, recit: 'Un hôpital.'.padEnd(RECIT_MAX + 1, '.') }, 'un récit trop long'],
    [{ ...LIEU, savais: 'Un vin.'.padEnd(SAVAIS_MAX + 1, '.') }, 'un savais trop long'],
    [{ ...LIEU, annee: 1443.5 }, 'une année qui n’est pas entière'],
    [{ ...LIEU, categorie: 'Peinture' }, 'une catégorie inconnue'],
    [{ ...LIEU, id: 'cab:lieu:beaune' }, 'le code pose le préfixe'],
    [{ ...LIEU, id: 'Beaune' }, 'un identifiant en capitales'],
    [{ ...LIEU, commune: '' }, 'une commune vide'],
    [{ ...LIEU, recit: ' Un hôpital.' }, 'un blanc au bord'],
    [{ ...LIEU, recit: 'Un hôpital  pour les pauvres.' }, 'une double espace'],
    [{ ...LIEU, recit: 'Un hôpital 🏥 pour les pauvres.' }, 'un emoji'],
    [{ ...LIEU, ville: 'Beaune' }, 'un champ que le format n’a pas'],
    [(({ savais: _, ...l }) => l)(LIEU), 'un champ qui manque'],
    [null, 'pas un objet'],
  ] as [unknown, string][]) assert.notEqual(refusDuLieu(lieu), null, pourquoi)
})

const FICHE: Fiche = {
  id: 'histoire-jeanne-d-arc',
  reponse: "Jeanne d'Arc",
  cles: ['arc', 'darc'],
  indices: [
    'À mon procès, on m’a demandé si j’étais en état de grâce.',
    'Je suis née vers 1412 dans une famille de paysans, au bord de la Meuse.',
    'Un évêque nommé Pierre Cauchon a présidé mon procès.',
    'À dix-sept ans, j’ai conduit le dauphin jusqu’à Reims.',
    'On m’appelle la Pucelle d’Orléans.',
  ],
  savais: 'Sa condamnation est annulée en 1456.',
  categorie: 'Histoire',
}

test('une fiche : cinq indices courts, ni la réponse ni une clé, et des clés que la réponse tapée retrouve', () => {
  assert.equal(refusDeLaFiche(FICHE), null)
  const indices = (k: number, indice: string) => FICHE.indices.map((x, i) => (i === k ? indice : x))
  for (const [fiche, pourquoi] of [
    [{ ...FICHE, indices: indices(4, 'Je suis Jeanne d’Arc.') }, 'la réponse dans un indice'],
    [{ ...FICHE, indices: indices(0, 'On dit de moi : la Pucelle d’ARC.') }, 'une clé dans un indice, en capitales'],
    [{ ...FICHE, reponse: 'Louis de Funès', cles: ['funes'], indices: indices(1, 'Les Funès venaient d’Espagne.') }, 'une clé sans accent, écrite avec'],
    [{ ...FICHE, indices: FICHE.indices.slice(0, INDICES_D_UNE_FICHE - 1) }, 'quatre indices'],
    [{ ...FICHE, indices: indices(2, 'Un évêque.'.padEnd(INDICE_MAX + 1, '.')) }, 'un indice trop long'],
    [{ ...FICHE, cles: [] }, 'aucune clé'],
    [{ ...FICHE, cles: ['arc', 'darc', 'jeanne', 'pucelle'].slice(0, CLES_MAX + 1) }, 'trop de clés'],
    [{ ...FICHE, cles: ['ar'] }, 'une clé de deux lettres'],
    [{ ...FICHE, cles: ['arc', 'Jeanne'] }, 'une clé en capitales'],
    [{ ...FICHE, cles: ['arc', 'arc'] }, 'deux fois la même clé'],
    [{ ...FICHE, cles: ['pucelle'] }, 'aucune clé dans la réponse : tapée en entier, elle ne trouverait personne'],
    [{ ...FICHE, reponse: '' }, 'une réponse vide'],
    [{ ...FICHE, categorie: 'Moyen Âge' }, 'une catégorie inconnue'],
  ] as [unknown, string][]) assert.notEqual(refusDeLaFiche(fiche), null, pourquoi)
})

const REPLIQUE: Replique = {
  id: 'chanson-deux-amours',
  avant: "J'ai deux amours, mon",
  mot: 'pays',
  apres: ' et Paris.',
  leurres: ['homme', 'village', 'public'],
  qui: 'Joséphine Baker',
  autres: ['Mistinguett', 'Fréhel'],
  source: "J'ai deux amours, 1930",
  savais: 'Créée au Casino de Paris.',
  categorie: 'Musique',
}

test('une réplique : un seul mot qui manque, trois leurres et deux autres personnes distincts, quinze mots au plus', () => {
  assert.equal(refusDeLaReplique(REPLIQUE), null)
  assert.equal(refusDeLaReplique({ ...REPLIQUE, avant: 'Vers l’', mot: 'infini', apres: ' et au-delà !' }), null, 'un trou après une apostrophe')
  assert.equal(refusDeLaReplique({ ...REPLIQUE, avant: 'Tikki,', mot: 'transforme', apres: '-moi !' }), null, 'un trou suivi d’un trait d’union')
  for (const [replique, pourquoi] of [
    [{ ...REPLIQUE, mot: 'mon pays' }, 'deux mots dans le trou'],
    [{ ...REPLIQUE, leurres: ['homme', 'village', 'Pays'] }, 'un leurre qui est le mot'],
    [{ ...REPLIQUE, leurres: ['homme', 'village', 'Village'] }, 'deux leurres pareils'],
    [{ ...REPLIQUE, leurres: ['homme', 'village'] }, 'deux leurres'],
    [{ ...REPLIQUE, leurres: ['homme', 'beau village', 'public'] }, 'un leurre de deux mots'],
    [{ ...REPLIQUE, autres: ['Mistinguett', 'Josephine Baker'] }, 'qui parmi les autres, sans accent'],
    [{ ...REPLIQUE, autres: ['Mistinguett'] }, 'une seule autre personne'],
    [{ ...REPLIQUE, apres: ` ${Array.from({ length: MOTS_D_UNE_REPLIQUE_MAX }, () => 'et').join(' ')}.` }, 'plus de quinze mots'],
    [{ ...REPLIQUE, apres: 'et Paris.' }, 'le mot collé à la suite'],
    [{ ...REPLIQUE, apres: ' et Paris. ' }, 'un blanc au bout'],
    [{ ...REPLIQUE, avant: "J'ai deux amours, mon " }, 'un blanc avant le trou'],
    [{ ...REPLIQUE, source: '' }, 'sans source'],
    [{ ...REPLIQUE, savais: 'Une revue.'.padEnd(SAVAIS_MAX + 1, '.') }, 'un savais trop long'],
  ] as [unknown, string][]) assert.notEqual(refusDeLaReplique(replique), null, pourquoi)
})

const FRISE: FriseATheme = {
  id: 'frise-aviation',
  theme: "L'aviation",
  evenements: [
    { libelle: 'Les frères Wright font voler leur Flyer près de Kitty Hawk', annee: 1903 },
    { libelle: 'Alberto Santos-Dumont fait voler son 14-bis au bois de Boulogne', annee: 1906 },
    { libelle: 'Roland Garros relie Fréjus à Bizerte par-dessus la Méditerranée', annee: 1913 },
    { libelle: 'Charles Lindbergh relie New York à Paris sans escale', annee: 1927 },
    { libelle: "Amelia Earhart traverse seule l'Atlantique en avion", annee: 1932 },
    { libelle: 'Chuck Yeager franchit le mur du son', annee: 1947 },
    { libelle: 'Le Concorde entre en service commercial', annee: 1976 },
  ],
  savais: 'Le vol de Lindbergh a duré plus de 33 heures.',
  categorie: 'Histoire',
}

test('une frise à thème : sept événements qui ne disent pas quand, à trois ans d’écart au moins', () => {
  assert.equal(refusDeLaFriseATheme(FRISE), null)
  const avec = (k: number, e: object) => FRISE.evenements.map((x, i) => (i === k ? e : x))
  assert.equal(EVENEMENTS_D_UNE_FRISE_A_THEME, 7)
  for (const [frise, pourquoi] of [
    [{ ...FRISE, evenements: FRISE.evenements.slice(1) }, 'six événements'],
    [{ ...FRISE, evenements: avec(0, { libelle: 'Les frères Wright volent en 1903', annee: 1903 }) }, 'un libellé qui date'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1905 }) }, 'deux années à deux ans'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1903 }) }, 'la même année'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[0].libelle, annee: 1906 }) }, 'deux fois le même libellé'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1906.5 }) }, 'une année qui n’est pas entière'],
    [{ ...FRISE, evenements: avec(1, { libelle: FRISE.evenements[1].libelle, annee: 1906, date: '1906' }) }, 'un champ de trop dans un événement'],
    [{ ...FRISE, theme: '' }, 'sans thème'],
  ] as [unknown, string][]) assert.notEqual(refusDeLaFriseATheme(frise), null, pourquoi)
})

// ── Les doublons ────────────────────────────────────────────────────────────

test('les doublons : le même identifiant, le même lieu à deux kilomètres, la même personne, la même citation, le même thème', () => {
  const pres = { ...LIEU, id: 'beaune-hotel-dieu', lat: 47.03 }
  assert.ok(distanceKm(LIEU, pres) < LIEUX_VOISINS_KM)
  const loin = { ...LIEU, id: 'dijon', lat: 47.32, lon: 5.04 }
  const lieux = trier('lieux', [LIEU, pres, loin, { ...loin, lat: 47.5 }])
  assert.deepEqual(lieux.gardees.map(l => l.id), [LIEU.id, 'dijon'])
  assert.match(lieux.ecartees[0].motif, new RegExp(LIEU.id), 'il dit qui il redit')
  assert.match(lieux.ecartees[1].motif, /dijon/, 'le même identifiant')
  assert.equal(trier('lieux', [pres], [LIEU]).ecartees.length, 1, 'ce qui est déjà rangé compte')

  const fiches = trier('fiches', [FICHE, { ...FICHE, id: 'jeanne', reponse: "JEANNE D'ARC" }])
  assert.deepEqual([fiches.gardees.length, fiches.ecartees.length], [1, 1], 'la même personne, en capitales')

  const repliques = trier('repliques', [REPLIQUE, { ...REPLIQUE, id: 'baker', avant: "J’ai deux amours : mon" }])
  assert.deepEqual([repliques.gardees.length, repliques.ecartees.length], [1, 1], 'la même citation, sa ponctuation près')

  const frises = trier('frises', [FRISE, { ...FRISE, id: 'aviation-encore', theme: "L'Aviation" }])
  assert.deepEqual([frises.gardees.length, frises.ecartees.length], [1, 1], 'le même thème')

  const refusee = trier('fiches', [{ ...FICHE, cles: [] }])
  assert.deepEqual([refusee.gardees.length, refusee.ecartees.length], [0, 1], 'le juge passe avant les doublons')
})

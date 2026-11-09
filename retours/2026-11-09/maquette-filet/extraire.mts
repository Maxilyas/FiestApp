// Fabrique les données de la maquette du nouveau Filet (`donnees.js`) : les questions du Filet que la production a
// posées du 1er au 8 novembre 2026 (`questions-posees.json`), lues dans la base livrée par la règle même du tireur
// (`valeurDuFilet`) ; la note du panel de l'IA (`panel-ia.json`, la connaissabilité au Filet et en QCM) ; l'indice et
// le repère écrits pour chacune par des agents (`indices.json`), passés au juge plus bas ; ce que chaque Français sait
// placer (`ancrage.json`) ; des repères que tout le monde connaît ; et les chiffres de la production que la page « Ce
// que disent les lancers » montre.
//
//   cd server && node --import tsx ../retours/2026-11-09/maquette-filet/extraire.mts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../server/src/core/cabinet/tirages/tas.ts'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const lireJson = (f: string) => JSON.parse(fs.readFileSync(path.join(ICI, f), 'utf8'))
const parId = new Map(((lireLaBase() as any).questions as any[]).map(q => [q.id, q]))
const notes = new Map((lireJson('panel-ia.json') as any[]).map(n => [n.id, n]))
const indices = new Map((lireJson('indices.json') as any[]).map(n => [n.id, n]))
// ── Ce que chaque Français sait placer ──────────────────────────────────────────────────────────────────────
// Le propriétaire, au matin du 9 novembre 2026 : « le levier le plus fort, c'est d'avoir des questions que chacun
// connaisse, sachant que la population et la connaissance sont des personnes françaises ». Des agents ont classé
// chaque question sans voir ni le panel ni les lancers : `chacun`, un adulte français pris au hasard la place à ★★ de
// mémoire ; `ancrage`, son sujet est français, du monde, ou de l'étranger. L'acte I de la maquette tire les premières.
const ancrages = new Map((lireJson('ancrage.json') as any[]).map(a => [a.id, a]))

// ── Le juge des indices : un indice oriente, il ne donne jamais la valeur ───────────────────────────────────
// Une année : aucun nombre de trois ou quatre chiffres à moins de 15 ans d'elle. Une grandeur : aucun nombre à moins
// de 20 % d'elle, ni son nom en toutes lettres. Au-delà de cent signes, il ne tient plus sous la question.
// Ce juge-ci ne lit que la lettre ; le sens, un juge qui lit à la place d'un profane l'a relu, en trois passes — 42
// des 140 premiers indices lui donnaient la valeur (le carré de 25 « fois cent, puis le quart », Minecraft « une
// puissance de deux entre seize et cent ») ; il n'y en a plus aucun (`juge-des-indices.json`). Un indice vide est un
// choix : la question donne déjà l'époque (un sous-marin allemand, la trêve de Noël), et tout indice serait la réponse.
const MOTS: Record<number, string> = { 10: 'dix', 11: 'onze', 12: 'douze', 13: 'treize', 14: 'quatorze', 15: 'quinze', 16: 'seize', 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante', 100: 'cent', 1000: 'mille' }
function nombresDe(texte: string): number[] {
  return [...texte.replace(/[  ]/g, ' ').matchAll(/\d[\d ]*(?:,\d+)?/g)].map(m => Number(m[0].replace(/ /g, '').replace(',', '.'))).filter(Number.isFinite)
}
function refusDeLIndice(indice: string, valeur: number, annee: boolean): string | null {
  if (!indice) return 'vide'
  if (indice.length > 100) return `${indice.length} signes`
  for (const n of nombresDe(indice)) {
    if (annee && n >= 100 && Math.abs(n - valeur) < 15) return `écrit ${n}, à moins de 15 ans de ${valeur}`
    if (!annee && n > 0 && Math.abs(n / valeur - 1) < 0.2) return `écrit ${n}, à moins de 20 % de ${valeur}`
  }
  const mot = MOTS[valeur]
  if (!annee && mot && new RegExp(`\\b${mot}\\b`, 'i').test(indice)) return `écrit « ${mot} »`
  return null
}

// ── Ce qui se calcule n'est pas une estimation ──────────────────────────────────────────────────────────────
// Un calcul (le carré de 25), une conversion d'unités (les secondes d'une heure), une question qui écrit de quoi
// trouver sa réponse (Verdun « du 21 février au 18 décembre ») : on la sait ou on la calcule, on ne l'estime pas.
// Le moteur les donnait connues de tous, et l'acte I tournait au cours de maths (Théo, la tablée du 9 novembre
// 2026) ; leur indice en était la solution (le juge des indices : 16 de ses 58 « valeur », et un comptage à la passe
// des tranches). Le Filet d'aujourd'hui de la maquette les pose encore, comme la production.
const CALCULS = new Set([
  'gwncegep', 'eq6d1uie', '3yiw4do8', 'ct92jdvr', // le carré de 25, un nombre abondant, six diviseurs, les carrés parfaits
  'cb6v7fpw', 'gawi2k69', 'brg0edw0', 'm1tml875', 'j1ln7nbb', 'b1x00df9', 'hn1ubkxc', // secondes, millimètres, grammes, kilos, m², cm², jours d'une année
  'ybtwkxdb', 'cxyvjgrc', '4t6omvq2', 'ksswsd14', // le tour complet, le triangle, l'équilatéral, les grades
  '563gbevt', // Verdun : la question donne ses deux dates
  '8semz46o', // les chiffres 9 de 1 à 100 : ils se comptent (trouvé par le juge des indices, à la passe des tranches)
])

const questions: any[] = []
const refusés: string[] = []
for (const id of lireJson('questions-posees.json') as string[]) {
  const q = parId.get(id), n: any = notes.get(id), ind: any = indices.get(id)
  if (!q || !n || n.estimation == null) continue
  const v = valeurDuFilet(q)
  if (!v) continue
  const refus = !ind ? 'absent' : ind.indice === '' ? null : refusDeLIndice(ind.indice, v.valeur, v.annee)
  if (refus) refusés.push(`${id} (${v.valeur}) : ${refus} — ${ind?.indice ?? ''}`)
  questions.push({
    id, t: q.texte, v: v.valeur, an: v.annee, u: v.unite ?? '', c: q.meta.categorie, d: q.meta.difficulte,
    a: q.anecdote ?? '', ia: n.estimation, qcm: n.qcm, i: refus ? '' : ind.indice, r: ind?.repere ?? '',
    ...(CALCULS.has(id) ? { calcul: true } : {}),
    ...(ancrages.get(id)?.chacun ? { fr: true } : {}), anc: ancrages.get(id)?.ancrage ?? '',
  })
}

// ── Des repères que tout le monde connaît ───────────────────────────────────────────────────────────────────
// Des dates que tout Français a apprises à l'école ou vécues, chacune vérifiée ; la frise n'en pose que deux, jamais du
// sujet de la question, jamais la réponse elle-même (`reperesDe`, jeu.js).
const reperesAnnees = [
  [1066, 'Guillaume le Conquérant en Angleterre'], [1096, 'La première croisade'], [1163, 'Notre-Dame de Paris commencée'], [1214, 'La bataille de Bouvines'],
  [1270, 'La mort de Saint Louis'], [1337, 'Début de la guerre de Cent Ans'], [1347, 'La peste noire arrive en Europe'], [1429, 'Jeanne d’Arc délivre Orléans'],
  [1453, 'La chute de Constantinople'], [1492, 'Colomb atteint l’Amérique'], [1515, 'Marignan'], [1519, 'La mort de Léonard de Vinci'],
  [1539, 'L’ordonnance de Villers-Cotterêts'], [1572, 'La Saint-Barthélemy'], [1598, 'L’édit de Nantes'], [1610, 'L’assassinat d’Henri IV'],
  [1643, 'Louis XIV devient roi'], [1682, 'La cour s’installe à Versailles'], [1685, 'La révocation de l’édit de Nantes'], [1715, 'La mort de Louis XIV'],
  [1769, 'La naissance de Napoléon'], [1776, 'L’indépendance américaine'], [1783, 'La première montgolfière habitée'], [1789, 'La prise de la Bastille'],
  [1793, 'L’exécution de Louis XVI'], [1804, 'Le sacre de Napoléon'], [1815, 'Waterloo'], [1822, 'Champollion lit les hiéroglyphes'],
  [1830, 'Les Trois Glorieuses'], [1848, 'L’abolition de l’esclavage'], [1859, 'Darwin publie De l’origine des espèces'], [1869, 'Le canal de Suez'],
  [1870, 'La guerre franco-prussienne'], [1876, 'Le téléphone de Graham Bell'], [1885, 'La mort de Victor Hugo'], [1886, 'La statue de la Liberté'],
  [1889, 'La tour Eiffel'], [1895, 'Le cinématographe des Lumière'], [1896, 'Les premiers Jeux olympiques modernes'], [1903, 'Le premier Tour de France'],
  [1905, 'La séparation des Églises et de l’État'], [1912, 'Le naufrage du Titanic'], [1914, 'Début de la Grande Guerre'], [1917, 'La révolution russe'],
  [1918, 'L’armistice'], [1927, 'Lindbergh traverse l’Atlantique'], [1929, 'Le krach de Wall Street'], [1936, 'Les congés payés'],
  [1939, 'Début de la Seconde Guerre mondiale'], [1944, 'Le débarquement en Normandie'], [1945, 'La fin de la Seconde Guerre mondiale'], [1953, 'Le premier sommet de l’Everest'],
  [1957, 'Spoutnik'], [1958, 'La Ve République'], [1962, 'La fin de la guerre d’Algérie'], [1963, 'L’assassinat de Kennedy'],
  [1968, 'Mai 68'], [1969, 'Le premier pas sur la Lune'], [1977, 'La Guerre des étoiles au cinéma'], [1981, 'L’abolition de la peine de mort'],
  [1989, 'La chute du mur de Berlin'], [1991, 'La fin de l’URSS'], [1994, 'Le tunnel sous la Manche'], [1998, 'La France championne du monde'],
  [2001, 'Les attentats du 11 Septembre'], [2002, 'L’euro dans les poches'], [2007, 'Le premier iPhone'], [2018, 'La deuxième étoile des Bleus'],
].map(([an, l]) => ({ an, l }))
const reperesGrandeurs = [
  ['m', 50, 'L’Arc de triomphe'], ['m', 69, 'Les tours de Notre-Dame'], ['m', 330, 'La tour Eiffel'], ['m', 828, 'Burj Khalifa'],
  ['m', 4806, 'Le mont Blanc'], ['m', 8849, 'L’Everest'], ['km', 42, 'Un marathon'], ['km', 777, 'La Seine'],
  ['km', 1006, 'La Loire'], ['km', 40075, 'Le tour de la Terre'], ['km', 384400, 'La Lune'], ['cm', 30, 'Une règle d’écolier'],
  ['minutes', 90, 'Un match de football'], ['°c', 100, 'L’eau qui bout'], ['°c', 37, 'Le corps humain'],
].map(([u, v, l]) => ({ u, v, l }))
// Pas de définition d'unité (une heure, un siècle, une tonne) : « 100 ans · Un siècle », pour l'âge d'Orson Welles,
// apprenait à Huguette ce qu'est un siècle (la tablée du 9 novembre 2026).

// ── Les chiffres de la production (le cahier des charges, « Ce que disent les lancers ») ─────────────────────
const production = {
  lancers: 169,
  joueurs: 9,
  regles: [
    { nom: 'Le Filet d’aujourd’hui (le filet choisi)', reussies: 43, etoiles: 0.67, aveugle: 45, savoir: -2 },
    { nom: 'Le filet qui se resserre tout seul', reussies: 56, etoiles: 1.12, aveugle: 45, savoir: 11 },
    { nom: 'En deux temps : l’époque, puis la valeur', reussies: 62, etoiles: 1.2, aveugle: 25, savoir: 37 },
    { nom: 'En deux temps, questions du moteur (≥ 25 %)', reussies: 66, etoiles: 1.38, aveugle: 25, savoir: 41, fort: true },
    { nom: 'En deux temps, questions du moteur (≥ 40 %)', reussies: 74, etoiles: 1.74, aveugle: 25, savoir: 49, fort: true },
  ],
  pourquoi: [
    'Le pari sur la taille du filet se retourne contre les joueurs : ils prennent le moyen ou le petit 80 fois sur 169, et réussissent 43 % des manches quand le grand filet, posé au même endroit, en aurait réussi 56 %.',
    'La réponse tombe entre 8 et 92 % de la piste : le grand filet laissé au milieu l’attrape près d’une fois sur deux, sans lire la question.',
    'On sait, ou on ne sait pas : aux questions faciles, 73 % des curseurs tombent à moins de 2 % de la valeur ; aux moyennes, 14 % seulement, et la moitié à plus de 20 %.',
    'Le savoir approximatif ne rapporte rien : 47 % des curseurs tombent dans le bon tiers de la piste (33 % au hasard), et n’en tirent aucune étoile.',
    'La difficulté est mesurée en QCM, où l’on écarte trois mauvaises réponses : « Combien de cm² dans un m² ? », moyenne en QCM, se pose sur une piste de 0 à 35 000.',
    'L’aide existe mais personne ne l’a : Éclairer n’a jamais servi au Filet ; la carte Coup d’œil était dans 4 traversées sur 34.',
  ],
  moteur: [
    'Le panel de l’IA prédit qui « savait » au Filet bien mieux que la difficulté écrite : AUC 0,85 contre 0,78, sur 163 lancers.',
    'En QCM, il colle mieux à la réussite réelle que la difficulté écrite : corrélation de rang 0,62 contre 0,49, sur 369 questions et 1 729 premières réponses.',
    'Quand il annonce qu’au moins un joueur sur deux la placerait, 57 % savaient vraiment ; sous 25 %, 4 à 7 %. Ces loteries faisaient 44 % des questions tirées.',
    'La notoriété du sujet (ses vues sur Wikipédia, ses langues) n’aide pas : une question sur Astérix peut porter sur un détail obscur. C’est le fait qui doit être connu, pas son sujet.',
  ],
  ailleurs: [
    'Aucun jeu d’estimation n’est en tout-ou-rien : GeoGuessr paie la distance (5 000 × e^(−10 d / D)), les jeux de dates retirent quelques points par année d’écart, Kahoot propose une marge.',
    'Placer par rapport à ce qu’on connaît : Timeline et Hitster font insérer un événement entre d’autres. Apprendre quelques valeurs repères améliore toutes les estimations, encore quatre mois après.',
    'Une aide coûte du score, pas une monnaie : Only Connect paie 5, 3, 2 ou 1 point selon les indices vus ; un indice ne doit jamais rendre la réponse devinable.',
    'Une difficulté se mesure en jouant : les problèmes d’échecs de Lichess ont chacun une cote, mise à jour à chaque essai ; Duolingo vise environ 70 % de réussite, les applis d’entraînement 65 à 80 %.',
  ],
}

const sortie = `// Écrit par extraire.mts : ${questions.length} questions du Filet que la production a posées, la note du moteur, un indice et un repère chacune.\nwindow.FILET = ${JSON.stringify({ questions, reperesAnnees, reperesGrandeurs, production })}\n`
fs.writeFileSync(path.join(ICI, 'donnees.js'), sortie)
console.log(`${questions.length} questions (${questions.filter(q => q.an).length} années), ${questions.filter(q => q.i).length} indices retenus, ${refusés.length} refusés`)
for (const r of refusés) console.log('  refusé', r)
const parActe = [(q: any) => q.fr, (q: any) => !q.fr && q.ia >= 25, (q: any) => !q.fr && q.ia < 25].map(garde => questions.filter(q => !q.calcul && garde(q)))
console.log('par acte :', parActe.map((qs, i) => `${['I', 'II', 'III'][i]} ${qs.length} (${qs.filter(q => q.an).length} années)`).join(' · '))

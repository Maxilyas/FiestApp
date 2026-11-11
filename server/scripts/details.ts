// Les images du « détail », une forme de question de l'Expédition : un
// tableau célèbre dont on ne voit d'abord qu'un détail, qui s'élargit en
// quatre cadrages jusqu'au tableau entier (`retours/2026-10-20/la-frise.md`,
// « Le détail, quand les images viendront »). Depuis `server/` :
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/details.ts choisir           les candidats : ceux de la base, puis les célèbres de Wikidata
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/details.ts telecharger [n]   les miniatures des n premiers pas encore regardés, dans le cache
//   npx tsx scripts/details.ts planches                               des planches quadrillées, pour choisir à l'œil
//   npx tsx scripts/details.ts decouper [--tout]                      les quatre cadrages des tableaux neufs, et la fiche
//   npx tsx scripts/details.ts verifier                          ce que `details.test.ts` garde, en plus court
//
// Les candidats sont d'abord les tableaux que la base de la campagne pose déjà
// (« Qui a peint « … » ? ») : la forme de l'Expédition tirait ses leurres de la
// même base. Puis, depuis le 11 novembre 2026, les tableaux les plus célèbres
// de Wikidata, que la base ne pose pas (`celebres`) : le Détail du Cabinet de
// curiosités demande un titre parmi quatre, pas « Qui l'a peint ? », et cent
// tableaux ne tenaient pas cinq traversées — en production, les trois joueurs
// les plus assidus en avaient vu 100, 84 et 72, et quatre manches sur dix
// étaient des redites, réussies à 71 % contre 44 % sur un tableau neuf
// (`retours/2026-11-08/le-cabinet-en-production.md`). Un tableau venu de là n'a
// pas de question (`questions` vide) : l'Expédition ne le posait pas
// (`detailsDeLaBase`), et sa révélation dit ce qu'il est, sans anecdote.
// Le peintre est mort en 1955 au plus tard — soixante-dix ans révolus en
// 2026 : le tableau est du domaine public partout où l'application se joue.
//
// Le choix d'un détail se fait à l'œil, sur les planches : parlant pour qui
// connaît le tableau, jamais ce qui le nomme d'un coup (la main de la
// Joconde, pas son visage). Il vit ici (`DETAILS`), avec ce qu'on a écarté et
// pourquoi (`ECARTES`) : un script qui refait tout doit savoir ce qu'on a vu.
// L'année aussi : Wikidata date un sur cinq des cent à la décennie ou au siècle,
// et se trompe à l'année pour quelques-uns. Elle se lit à sa précision
// (`anneeDuTableau`) ; ce qu'il ne date pas à l'année, ou date faux, s'écrit à
// la main, vérifié (`ANNEES_A_LA_MAIN`) — `choisir` relève ce qui manque, et
// `verifier` refuse une fiche qui en reste sans année.
//
// Le cache (la réponse de Wikidata, les miniatures, les planches) vit dans
// `.details/`, à la racine, que git ignore : il ne suit pas le dépôt. `decouper`
// ne refait donc que ce qui manque — un tableau livré dont le détail n'a pas
// bougé garde ses quatre images et sa ligne, sans sa miniature (`--tout` refait
// tout, miniatures retéléchargées). Les images livrées et leur fiche
// vont dans `server/content/details/` — hors de `client/public` : servi en
// fichier statique, le tableau entier se téléchargeait avant la réponse
// (invariant 1) ; la forme sert chaque cadrage à son heure.
//
// Wikimedia refuse une requête sans User-Agent identifiable, une largeur de
// miniature hors de sa liste (1920, 1280 et 960 passent) et l'original : une
// miniature à la fois, cinq secondes entre deux ; sur un 429, la largeur
// suivante, puis on attend de plus en plus. Le 20 octobre 2026, cent onze
// miniatures ont pris une heure.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVEUR } from '../src/racine'
import { lireLaBase } from '../src/core/baseCampagne'
import { Wikidata, anneeDe, qidDe } from './faits-wikidata'
import { dansLaPage, deDataUrl, pagePixels } from './anime/pixels'

const CACHE = path.join(SERVEUR, '..', '.details')
export const DOSSIER_DES_DETAILS = path.join(SERVEUR, 'content', 'details')
export const FICHE_DES_DETAILS = path.join(DOSSIER_DES_DETAILS, 'tableaux.json')
const CANDIDATS = path.join(CACHE, 'candidats.json')
const UA = 'FiestAppDetail/0.1 (https://github.com/Maxilyas/FiestApp) node'

/** Soixante-dix ans après la mort du peintre, au 1er janvier : en 2026, mort en 1955 au plus tard. */
export const MORT_AU_PLUS_TARD = 1955
/** La largeur du détail, en part de celle du tableau ; les cadrages suivants, jusqu'au tableau entier. */
export const ECHELLES = [0.2, 0.36, 0.6, 1] as const
/** Ce qu'un cadrage pèse au plus, et sa taille : environ 640 de large, jamais plus de 800 de haut. */
export const POIDS_MAX = 40 * 1024
const LARGEUR = 640
const HAUTEUR_MAX = 800
/** Un tableau que moins de dix Wikipédia décrivent est, sous un titre célèbre, une copie ou une version obscure (« Marat assassiné », 0). */
const LIENS_MIN = 10
/**
 * Combien de candidats pas encore regardés `telecharger` va chercher, les plus liés d'abord (`telecharger 80` en demande
 * quatre-vingts). Le 20 octobre 2026, les 111 premiers de la base ont donné cent tableaux (`DETAILS`) et onze écartés
 * (`ECARTES`).
 */
const A_REGARDER = 60
/**
 * Hors de la base, un tableau entre par sa célébrité : ce que douze Wikipédia au moins décrivent — 1 151 tableaux de
 * Wikidata le 11 novembre 2026, tous peintres confondus. Ceux de la base passent devant, à dix (`LIENS_MIN`) : ils ont
 * leur question, et son anecdote.
 */
const LIENS_D_UN_CELEBRE = 12
/** Les tableaux d'une requête à Wikidata : au-delà, elle n'aboutit plus dans sa minute. */
const TABLEAUX_PAR_REQUETE = 120
/** Entre deux requêtes à Wikimedia : à une seconde et demie, une image sur deux attendait un 429 de plus en plus long. */
const PAUSE = 5_000
/** Les largeurs de miniature que Wikimedia accepte, de la plus grande : le détail en est agrandi. */
const LARGEURS = [1920, 1280, 960] as const

/** Un tableau de la fiche (`server/content/details/tableaux.json`). */
export interface TableauDuDetail {
  qid: string
  titre: string
  peintre: string
  annee: number | null
  mortDuPeintre: number
  fichier: string
  page: string
  statut: 'domaine public'
  /** Quatre cadrages, du détail au tableau entier, en fractions de l'image : x, y, largeur, hauteur. */
  cadrages: [number, number, number, number][]
  /** Ce qu'on a rogné de sa miniature avant de la découper (`ROGNAGES`) : à gauche, en haut, à droite, en bas. */
  rognage?: [number, number, number, number]
  /** Les questions de la base qui le demandent ; aucune pour un tableau venu de Wikidata seul (`celebres`). */
  questions: string[]
}

interface Candidat {
  qid: string
  titre: string
  peintre: string
  annee: number | null
  mortDuPeintre: number
  fichier: string
  liens: number
  questions: string[]
}

/**
 * Le centre du détail, en fractions du tableau, choisi à l'œil sur sa planche.
 * Le détail fait un cinquième de la largeur : posé trop près du bord, il est
 * ramené dedans.
 */
const DETAILS: Record<string, [number, number]> = {
  Q12418: [0.50, 0.83], // La Joconde : les mains
  Q128910: [0.80, 0.55], // La Cène : trois apôtres à droite
  Q471379: [0.11, 0.40], // Le Cri : les deux promeneurs du pont
  Q45585: [0.55, 0.86], // La Nuit étoilée : le village et son clocher
  Q185372: [0.66, 0.40], // La Jeune Fille à la perle : le pan du turban
  Q29530: [0.22, 0.40], // La Liberté guidant le peuple : l'homme au haut-de-forme
  Q219831: [0.92, 0.72], // La Ronde de nuit : le tambour
  Q151047: [0.80, 0.62], // La Naissance de Vénus : la robe fleurie de l'Heure
  Q208758: [0.74, 0.92], // Les Ménines : le chien
  Q154469: [0.45, 0.33], // Les Mangeurs de pommes de terre : la lampe
  Q698487: [0.56, 0.62], // Le Baiser : les cercles de la robe
  Q1892745: [0.82, 0.92], // Salvator Mundi : la sphère de cristal
  Q474338: [0.42, 0.45], // La Dame à l'hermine : le collier
  Q157541: [0.17, 0.25], // Les Tournesols : une fleur fanée
  Q321303: [0.62, 0.56], // Le Jardin des délices : les fruits géants
  Q311243: [0.78, 0.37], // Le Voyageur contemplant une mer de nuages : le rocher dans la brume
  Q212616: [0.64, 0.24], // Le Radeau de la Méduse : l'homme qui agite son linge
  Q478271: [0.74, 0.40], // Les Cosaques zaporogues écrivant une lettre au sultan de Turquie : les rieurs du fond
  Q152509: [0.20, 0.88], // Le Déjeuner sur l'herbe : le panier renversé
  Q152867: [0.74, 0.72], // La Maja nue : les coussins
  Q464782: [0.45, 0.17], // American Gothic : la fenêtre gothique
  Q661378: [0.92, 0.73], // La Leçon d'anatomie du docteur Tulp : le livre ouvert
  Q167605: [0.27, 0.68], // La Laitière : la corbeille de pain
  Q683274: [0.88, 0.73], // Bal du moulin de la Galette : les verres sur la table
  Q220859: [0.09, 0.91], // Les Époux Arnolfini : les socques (le lustre montrait la signature du peintre)
  Q737062: [0.95, 0.62], // Olympia : le chat noir
  Q476458: [0.88, 0.74], // Le Serment des Horaces : les femmes en pleurs
  Q1025704: [0.72, 0.73], // Terrasse du café le soir : les tables de la terrasse
  Q523974: [0.28, 0.90], // Vue de Delft : les deux femmes sur la berge
  Q727875: [0.82, 0.45], // Vénus d'Urbin : les servantes au coffre
  Q1245354: [0.08, 0.85], // Un bar aux Folies Bergère : les bouteilles du comptoir
  Q500985: [0.62, 0.58], // Chasseurs dans la neige : les patineurs
  Q1133420: [0.80, 0.16], // La Reddition de Bréda : les lances
  Q1231009: [0.18, 0.62], // Le Sacre de Napoléon : l'assistance
  Q328079: [0.06, 0.94], // La Madone Sixtine : la tiare
  Q533619: [0.12, 0.12], // Les Proverbes flamands : les tartes sur le toit
  Q1170315: [0.17, 0.16], // Carré noir sur fond blanc : un coin du carré, ses craquelures
  Q699091: [0.93, 0.85], // La Tour de Babel : le port et ses bateaux
  Q17277950: [0.22, 0.22], // Les Joueurs de cartes : le chapeau du fumeur
  Q354396: [0.60, 0.72], // Portrait d'Adele Bloch-Bauer I : les yeux de la robe
  Q656434: [0.76, 0.68], // La Belle Ferronnière : le nœud de la manche
  Q1212937: [0.72, 0.60], // Les Ambassadeurs : le luth
  Q1978815: [0.90, 0.52], // La Grande Odalisque : le rideau et la pipe
  Q4195595: [0.50, 0.92], // Ivan le Terrible tue son fils : le tapis et le sceptre tombé
  Q540488: [0.73, 0.88], // Un enterrement à Ornans : le chien
  Q890678: [0.20, 0.35], // D'où venons-nous ? Que sommes-nous ? Où allons-nous ? : l'idole bleue
  Q969377: [0.62, 0.20], // La Vocation de saint Matthieu : la fenêtre
  Q500951: [0.66, 0.58], // Le Christ jaune : le paysan au loin
  Q546297: [0.10, 0.22], // Lamentation sur le Christ mort : les pleureuses
  Q588695: [0.55, 0.20], // L'Art de la peinture : le lustre
  Q153441: [0.50, 0.92], // La Fornarina : les mains sur le drapé rouge
  Q275349: [0.42, 0.24], // Vénus à son miroir : le ruban du miroir
  Q644856: [0.12, 0.74], // Le Triomphe de la Mort : la charrette de crânes
  Q1133821: [0.12, 0.72], // La Mort de Sardanapale : la tête du cheval
  Q1167178: [0.47, 0.86], // L'Atelier du peintre : le chat blanc
  Q1167907: [0.30, 0.72], // Le Déjeuner des canotiers : les bouteilles et le raisin
  Q1192570: [0.65, 0.16], // La Parabole des aveugles : le clocher
  Q1239950: [0.35, 0.44], // L'Absinthe : la carafe
  Q2366825: [0.07, 0.52], // La Charrette de foin : la maison au bord de l'eau
  Q2727560: [0.82, 0.48], // La Décollation de saint Jean-Baptiste : les prisonniers à la fenêtre
  Q2290433: [0.72, 0.34], // Scènes des massacres de Scio : le cheval cabré
  Q669994: [0.36, 0.90], // L'Île des morts : la barque et la figure blanche
  Q94802: [0.45, 0.61], // L'Enterrement du comte d'Orgaz : les fraises des gentilshommes
  Q2293936: [0.60, 0.90], // Le Petit Bacchus malade : les pêches
  Q334360: [0.60, 0.60], // L'Abbaye dans une forêt de chênes : la fenêtre de l'abbaye en ruine
  Q194137: [0.82, 0.48], // La Mer de glace : l'épave du navire
  Q1368055: [0.25, 0.27], // Des glaneuses : les meules au loin
  Q2339059: [0.12, 0.65], // Pluie, Vapeur et Vitesse : le pont de gauche
  Q794077: [0.84, 0.42], // Amour sacré et Amour profane : le clocher du village
  Q405814: [0.60, 0.12], // La Nef des fous : la cime de l'arbre
  Q1216387: [0.30, 0.68], // La Dentellière : les fils qui débordent du coussin
  Q2304870: [0.15, 0.17], // Les Sept Péchés capitaux et les Quatre Dernières Étapes humaines : le médaillon du lit de mort
  Q867403: [0.88, 0.82], // La Vierge au long cou : la colonne et le prophète
  Q1314013: [0.18, 0.26], // Les Sabines : la forteresse
  Q2213811: [0.55, 0.68], // Le Chariot de foin : les roues du chariot
  Q2317837: [0.12, 0.62], // Le Cauchemar : la table et ses fioles
  Q257580: [0.85, 0.84], // Le Dernier Voyage du Téméraire : la bouée au crépuscule
  Q3808227: [0.90, 0.12], // Jeunes Filles au piano : le bouquet sur le piano
  Q930535: [0.68, 0.74], // Femmes de Tahiti : les mains qui tressent
  Q951105: [0.50, 0.38], // Le Repas chez Levi : la tour derrière les arcades
  Q1114571: [0.75, 0.88], // Les Parapluies : le cerceau
  Q1452762: [0.12, 0.50], // Rue de Paris, temps de pluie : la voiture à cheval
  Q2480921: [0.40, 0.88], // La Vierge au chanoine Van der Paele : le tapis
  Q3080509: [0.75, 0.85], // La Baigneuse Valpinçon : la dentelle du drap
  Q531329: [0.48, 0.47], // Le Pèlerinage à l'île de Cythère : les angelots dans le ciel
  Q107486133: [0.75, 0.25], // L'Ange déchu : les anges qui passent
  Q1090837: [0.88, 0.38], // Une baignade à Asnières : la voile sur la Seine
  Q164517: [0.40, 0.55], // La Danse : les deux mains qui se cherchent
  Q2445726: [0.72, 0.50], // The Lady of Shalott : les bougies de la barque
  Q2571560: [0.88, 0.72], // L'Angélus : la brouette
  Q26250: [0.70, 0.92], // Le Fifre : les guêtres
  Q276174: [0.15, 0.62], // Les Roses d'Héliogabale : les pétales
  Q693746: [0.35, 0.90], // Le Moine au bord de la mer : le moine, minuscule sur la grève
  Q1237863: [0.10, 0.12], // Pollice verso : la foule des gradins
  Q1282840: [0.50, 0.88], // Napoléon Ier sur le trône impérial : l'aigle du tapis
  Q13726073: [0.30, 0.45], // Le Chardonneret : la mangeoire
  Q746716: [0.15, 0.60], // Narcisse : la main sur l'eau
  Q1212737: [0.62, 0.85], // Femmes d'Alger dans leur appartement : le narguilé
  Q1217187: [0.50, 0.32], // La Calomnie d'Apelle : la statue dans sa niche
  Q16333797: [0.25, 0.62], // Vertumne : le lys
}

/** Les candidats écartés à l'œil, et pourquoi. */
const ECARTES: Record<string, string> = {
  Q252485: "La Grande Vague de Kanagawa : une estampe, pas un tableau, et la marge du papier autour",
  Q186953: "L'École d'Athènes : la fresque avec le mur, la porte et le soubassement autour",
  Q334138: "L'Origine du monde : trop cru pour un jeu ouvert dès dix ans, et le cadre doré autour",
  Q227494: "Trente-six vues du mont Fuji : une série d'estampes, pas un tableau",
  Q549847: "Le Printemps : un liseré du cadre doré tout autour",
  Q1189907: "Les Nymphéas : une série de quelque deux cent cinquante toiles : la question ne dit pas laquelle",
  Q1200522: "Les Désastres de la guerre : une série de gravures, pas un tableau",
  Q2027662: "Le Bain turc : un tondo posé sur du blanc, et une foule de nus pour un jeu ouvert dès dix ans",
  Q2045726: "La Bataille d'Anghiari : une copie de Rubens : l'original de Léonard est perdu",
  Q2343778: "La Belle Jardinière : l'arc du cadre doré se voit en haut",
  Q557000: "Les Meules : une série de vingt-cinq toiles : la question ne dit pas laquelle",
}

/**
 * Ce qu'on rogne d'une miniature avant de la découper, en fractions de l'image : à gauche, en haut, à droite, en bas.
 * Commons photographie souvent la toile avec ce qui l'entoure — un liseré noir, le bord effrangé, un pan du cadre, les
 * ajouts d'un panneau —, et les onze premiers écartés l'étaient presque tous pour cela ; au deuxième lot, « La Mort de
 * Socrate » et « Le Retour du fils prodigue » y passaient. Un rognage ne coupe que hors de la peinture, ou une frange
 * qu'on ne regrette pas : un haut cintré, lui, ne se rogne pas — il faudrait couper le tableau (« Ophélie »). Le
 * centre d'un détail (`DETAILS`) se lit sur l'image rognée, celle que la planche montre.
 */
const ROGNAGES: Record<string, [number, number, number, number]> = {}

/** Le rectangle gardé d'une miniature, en fractions : x, y, largeur, hauteur — tout, sans rognage. */
function gardeDeLaMiniature(qid: string): [number, number, number, number] {
  const [gauche, haut, droite, bas] = ROGNAGES[qid] ?? [0, 0, 0, 0]
  return [gauche, haut, 1 - gauche - droite, 1 - haut - bas]
}

/** Un cadrage du tableau, reporté sur sa miniature : le tableau n'en est que la part gardée. */
function surLaMiniature(qid: string, r: readonly [number, number, number, number]): [number, number, number, number] {
  const [x, y, l, h] = gardeDeLaMiniature(qid)
  return [x + r[0] * l, y + r[1] * h, r[2] * l, r[3] * h]
}

/**
 * La précision d'une date de Wikidata (`wikibase:timePrecision`) à partir de
 * laquelle elle dit son année : 9, l'année ; 10, le mois ; 11, le jour. En
 * dessous, 8 la décennie et 7 le siècle — rangés sous une année qui n'en dit
 * aucune, la première de la décennie (« 1850 » pour les années 1850) ou de
 * Wikidata (« 1801 » pour le XIXᵉ siècle).
 */
export const PRECISION_DE_L_ANNEE = 9

/**
 * Une date de Wikidata lue à sa précision : son année, si elle la dit ; rien
 * sinon. Lue sans elle, une date à la décennie devenait sa première année :
 * « Le Fifre, 1850 », que son « Le savais-tu ? » disait refusé au Salon de 1866
 * (la deuxième tablée, le 26 octobre 2026). Une précision inconnue ne date rien.
 */
export function anneeALaPrecision(valeur: string, precision: string | number | undefined): number | null {
  const p = Number(precision)
  return precision !== undefined && Number.isInteger(p) && p >= PRECISION_DE_L_ANNEE ? anneeDe(valeur) : null
}

/**
 * L'année d'un tableau, de ses dates de création (P571, hors rang déprécié) :
 * la plus tardive de celles qui disent leur année — peint en plusieurs années,
 * il se date de l'année où il fut achevé ; des sources qui divergent, de la
 * plus récente. Aucune : rien, et elle s'écrit à la main (`ANNEES_A_LA_MAIN`),
 * jamais devinée.
 */
export function anneeDuTableau(dates: readonly { valeur: string; precision?: string | number }[]): number | null {
  const annees = dates.map(d => anneeALaPrecision(d.valeur, d.precision)).filter((a): a is number => a !== null)
  return annees.length > 0 ? Math.max(...annees) : null
}

/**
 * Les années écrites à la main, qui l'emportent sur Wikidata — chacune vérifiée
 * le 26 octobre 2026, avec ce qui la fonde (la deuxième tablée, la synthèse,
 * axe 10). Un intervalle prend l'année que dit sa question de la base, sinon la
 * dernière : celle où la toile fut achevée, ou laissée. Deux sortes :
 *
 * - fausses dans la fiche — Wikidata à la décennie ou au siècle, ou faux à
 *   l'année : le script lisait la première année de la décennie ;
 * - relevées — Wikidata n'en dit aucune à l'année : l'année de la fiche, dans
 *   l'intervalle que donnent les musées, gardée pour qu'un découpage refait ne
 *   la perde pas. Celles qu'on ne sait qu'à la décennie le disent : une
 *   décennie juste vaut mieux qu'une année inventée.
 *
 * Un tableau neuf que Wikidata ne date pas à l'année s'ajoute ici : `choisir`
 * le relève.
 */
export const ANNEES_A_LA_MAIN: Record<string, number> = {
  // Fausses dans la fiche.
  Q26250: 1866, // Le Fifre : refusé au Salon de 1866, dit sa question — Wikidata : 1850, à l'année
  Q1167178: 1855, // L'Atelier du peintre : 1854-1855, « grande toile de 1855 » — Wikidata : les années 1850
  Q540488: 1850, // Un enterrement à Ornans : 1849-1850 — Wikidata : les années 1840
  Q693746: 1810, // Le Moine au bord de la mer : 1808-1810, « achevé en 1810 » — Wikidata : les années 1800, et 1808
  Q746716: 1597, // Narcisse : vers 1597-1599, « vers 1597 » — Wikidata : vers 1600, et 1597
  Q867403: 1540, // La Vierge au long cou : 1534-1540, laissée inachevée à la mort de Parmigianino — Wikidata : le XVIIᵉ siècle
  Q969377: 1600, // La Vocation de saint Matthieu : 1599-1600, « vers 1600 » — Wikidata : juillet 1609
  Q128910: 1498, // La Cène : 1495-1498 — Wikidata : les années 1490
  Q930535: 1891, // Femmes de Tahiti : Gauguin arrive à Tahiti en juin 1891 — Wikidata : 1890
  Q275349: 1651, // Vénus à son miroir : 1647-1651, la National Gallery — Wikidata : 1644
  // Relevées : Wikidata ne les date qu'à la décennie ou au siècle.
  Q321303: 1490, // Le Jardin des délices : vers 1490-1510 — à la décennie
  Q1217187: 1497, // La Calomnie d'Apelle : les années 1490 — à la décennie
  Q405814: 1500, // La Nef des fous : vers 1500 — à la décennie
  Q12418: 1503, // La Joconde : commencée en 1503
  Q2213811: 1510, // Le Chariot de foin : vers 1510-1516
  Q328079: 1512, // La Madone Sixtine : 1512-1513
  Q794077: 1514, // Amour sacré et Amour profane : vers 1514
  Q153441: 1519, // La Fornarina : 1518-1520
  Q523974: 1661, // Vue de Delft : 1660-1661
  Q588695: 1667, // L'Art de la peinture : 1666-1668
  Q334360: 1809, // L'Abbaye dans une forêt de chênes : 1808-1810
  Q194137: 1823, // La Mer de glace : 1823-1824
  Q1167907: 1880, // Le Déjeuner des canotiers : 1880-1881
  Q1114571: 1881, // Les Parapluies : 1881-1886
  Q478271: 1890, // Les Cosaques zaporogues : 1880-1891 — à la décennie
  Q17277950: 1893, // Les Joueurs de cartes : la série de 1890-1895 — à la décennie
  Q890678: 1897, // D'où venons-nous ? Que sommes-nous ? Où allons-nous ? : 1897-1898
  // ── Le 11 novembre 2026, les tableaux venus avec le deuxième lot. Chacune recoupée : avec l'année que dit sa question
  // de la base quand il en a une, avec l'intervalle que Wikidata tient de son musée (« date au plus tôt », « au plus
  // tard »), avec la date peinte sur la toile quand elle en porte une. Un intervalle prend toujours sa dernière année.
  // Fausses à l'année.
  Q556553: 1567, // Le Pays de Cocagne : signé et daté 1567 — Wikidata : 1550
  Q544315: 1668, // L'Astronome : daté 1668 sur l'armoire — Wikidata : 1664
  Q45130: 1669, // Le Géographe : daté 1669 — Wikidata : 1668
  Q2914912: 1849, // Les Casseurs de pierres : peint en 1849, montré au Salon de 1850 — Wikidata : 1849 et 1850
  Q1118295: 1888, // La Chaise de Vincent avec sa pipe : peinte à Arles en décembre 1888 — Wikidata : 1889
  Q1197647: 1913, // La Tour des chevaux bleus : 1913, disparue en 1945 — Wikidata : 1913 et 1914
  Q883994: 1600, // Vue de Tolède : vers 1599-1600, le Metropolitan Museum — Wikidata : 1596
  Q3821820: 1876, // La Classe de danse : la toile du musée d'Orsay, 1873-1876 — Wikidata : 1871, celle de New York
  Q2627056: 1610, // David avec la tête de Goliath : celui de la Galerie Borghèse, 1609-1610 — Wikidata : 1605
  Q921429: 1908, // La Desserte rouge : « toile de 1908 », dit sa question — Wikidata : 1907
  Q3222585: 1845, // Le Désespéré : « vers 1843-1845 », dit sa question — Wikidata : 1840
  Q3212142: 1726, // La Raie : vers 1725-1726, le Louvre — Wikidata : 1727
  // Datées de la première année de leur intervalle.
  Q1044742: 1886, // Un dimanche après-midi à l'île de la Grande Jatte : 1884-1886
  Q3234845: 1888, // Les Poseuses : « achevé en 1888 », dit sa question
  Q2915406: 1943, // Broadway Boogie-Woogie : « de 1942-1943 », dit sa question
  Q175628: 1873, // Les Bateliers de la Volga : 1870-1873
  Q1065493: 1852, // Ophélie : 1851-1852
  Q2622172: 1869, // La Famille Bellelli : entre 1858 et 1869, le musée d'Orsay
  Q17001535: 1915, // La Mort et la Vie : 1908-1915, reprise après son premier prix
  Q2735507: 1807, // La Maja vêtue : 1800-1807, le Prado
  Q1150997: 1823, // Saturne dévorant un de ses fils : les Peintures noires, 1820-1823
  Q500936: 1823, // Le Chien : de même
  Q1747282: 1823, // Duel au gourdin : de même
  Q3757652: 1660, // Deux Femmes à la fenêtre : vers 1655-1660 — Wikidata : 1670 aussi
  Q1619527: 1750, // Les Époux Andrews : vers 1750, la National Gallery
  Q123935: 1629, // Le Triomphe de Bacchus : 1628-1629
  Q4693305: 1640, // Agnus Dei : 1635-1640, le Prado
  Q3387944: 1719, // Pierrot : 1718-1719
  Q3607521: 1895, // Au Moulin-Rouge : 1892-1895
  Q3220204: 1788, // Le Baiser à la dérobée : la fin des années 1780 — à la décennie
  // Relevées : Wikidata ne les date qu'à la décennie ou au siècle.
  Q1212920: 1460, // La Flagellation du Christ : vers 1459-1460 — à la décennie
  Q2415259: 1505, // Saint Michel et le Dragon : 1503-1505
  Q930137: 1508, // La Tempête : vers 1506-1508 — à la décennie
  Q877191: 1509, // Les Trois Philosophes : 1508-1509
  Q500812: 1510, // Vénus endormie : vers 1508-1510, achevée par Titien
  Q783215: 1516, // Saint Jean-Baptiste : 1513-1516, le Louvre
  Q563727: 1519, // La Vierge, l'Enfant Jésus et sainte Anne : vers 1503-1519, laissée inachevée à la mort de Léonard
  Q1206860: 1523, // Bacchus et Ariane : 1520-1523
  Q2273890: 1548, // Miracle de l'esclave : « peint en 1548 », dit sa question
  Q185255: 1563, // Les Noces de Cana : 1562-1563
  Q663133: 1595, // Les Tricheurs : vers 1595, le musée Kimbell
  Q597114: 1606, // La Mort de la Vierge : 1601-1606
  Q2594673: 1610, // Samson et Dalila : 1609-1610
  Q3210253: 1645, // La Madeleine à la veilleuse : vers 1640-1645
  Q1240092: 1650, // Portrait d'Innocent X : peint à Rome en 1650
  Q700251: 1659, // La Liseuse à la fenêtre : 1657-1659
  Q984058: 1660, // Les Fileuses : 1655-1660, le Prado
  Q766782: 1669, // La Fiancée juive : vers 1665-1669
  Q2629559: 1768, // Les Hasards heureux de l'escarpolette : 1767-1768
  Q3228069: 1778, // Le Verrou : vers 1777-1778
  Q40432: 1855, // Le Marché aux chevaux : 1852-1855, montré au Salon de 1853 et repris depuis
  Q970968: 1862, // Symphonie en blanc n° 1 : 1861-1862, refusée au Salon de 1863
  Q2270938: 1906, // Les Grandes Baigneuses : celles de Philadelphie, 1900-1906
}

/**
 * Ce que Wikidata dit de travers d'un tableau qu'on retient, écrit à la main : un titre en anglais ou mal orthographié,
 * un sous-titre qui n'en est pas un, le titre que ses musées français ne lui donnent pas ; et son peintre, quand deux y
 * ont travaillé et que le libellé donne l'autre (« La Source — Alexandre Desgoffe », qui n'en a peint que le fond). Le
 * titre d'un tableau de la base ne se retouche pas ici : c'est celui que sa question écrit.
 */
export const A_LA_MAIN: Record<string, { titre?: string; peintre?: string }> = {
  Q2282256: { titre: 'Les Iris' }, // « Iris »
  Q1150997: { titre: 'Saturne dévorant un de ses fils' }, // « … un de ses enfants »
  Q2666439: { peintre: 'Ivan Chichkine' }, // Constantin Savitski n'y a peint que les oursons
  Q1215604: { peintre: 'Jean-Auguste-Dominique Ingres' }, // Alexandre Desgoffe et Paul Balze l'ont aidé à l'achever
  Q2395218: { titre: "La Femme à l'ombrelle" }, // « … — Madame Monet et son fils »
  Q2665048: { titre: 'Dante et Virgile' }, // « Dante et Virgille en Enfer »
  Q509806: { titre: 'Washington traversant le Delaware' }, // « Washington Crossing the Delaware »
  Q846213: { titre: 'Flaming June' }, // « June flamboyante », que personne ne dit
  Q1240092: { titre: "Portrait d'Innocent X" }, // « Innocent X »
  Q3642171: { titre: 'Bonjour Monsieur Courbet' }, // « La Rencontre, ou … »
  Q977777: { titre: 'Proserpine' }, // « Perséphone » : Rossetti l'a nommée de son nom latin
  Q2985455: { titre: 'Portrait de monsieur Bertin' }, // « Louis-François Bertin »
  Q8874171: { titre: "L'Espérance" }, // « Hope »
  Q3937621: { titre: 'Marie-Antoinette et ses enfants' }, // « Marie-Antoinette de Lorraine-Habsbourg, reine de France et ses enfants »
  Q3027255: { titre: 'Didon construisant Carthage' }, // « … ou l'Ascension de l'Empire carthaginois »
  Q3228387: { titre: 'Le Chapeau de paille' }, // « Le chapeau de paille »
  Q3055367: { titre: "L'Entrée des croisés à Constantinople" }, // « Prise de Constantinople par les croisés (12 avril 1204) »
  Q532486: { titre: 'Judith et sa servante' }, // « Judith et sa Servante »
  Q646337: { titre: 'Nocturne en noir et or : la fusée qui retombe' }, // « Nuit en noir et or, … »
  Q3818263: { titre: "L'Arbre rouge" }, // « Arbre rouge »
  Q17001535: { titre: 'La Mort et la Vie' }, // « La Vie et la Mort » : « Tod und Leben »
  Q6402081: { titre: 'Le Chevalier à la main sur la poitrine' }, // « Le Gentilhomme … »
}

const norme = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Les tableaux de la base : leur titre, les questions qui les citent, et ce qu'elles disent (pour reconnaître le peintre). */
function tableauxDeLaBase(): Map<string, { ids: string[]; textes: string[] }> {
  const out = new Map<string, { ids: string[]; textes: string[] }>()
  for (const q of lireLaBase().questions) {
    if (q.meta.sousTheme !== 'peinture') continue
    const entites = q.meta.entites ?? []
    for (const e of entites) {
      if (e.type !== 'oeuvre') continue
      const t = out.get(e.nom) ?? { ids: [], textes: [] }
      t.ids.push(q.id)
      t.textes.push(norme([q.texte, q.reponses[q.bonne], q.meta.explication ?? '', ...entites.map(x => `${x.nom} ${x.description ?? ''}`)].join(' ')))
      out.set(e.nom, t)
    }
  }
  return out
}

async function choisir() {
  const base = tableauxDeLaBase()
  const wd = new Wikidata(CACHE)
  const titres = [...base.keys()].map(t => `${JSON.stringify(t)}@fr`).join(' ')
  // Sans classe exigée : « Le Cri » ou « Les Tournesols » ne sont pas des
  // « peintures » sur Wikidata (une série, une version), et seules des copies
  // obscures sortaient sous leur nom. Le peintre nommé par la question trie.
  // Chaque date de création avec sa précision, hors rang déprécié : lue sans
  // elle (`wdt:P571`), une date à la décennie devenait sa première année.
  const lignes = await wd.sparql(`SELECT ?item ?l ?img ?peintre ?pl ?mort ?date ?prec ?n WHERE {
  VALUES ?l { ${titres} }
  ?item rdfs:label ?l ; wdt:P18 ?img ; wdt:P170 ?peintre ; wikibase:sitelinks ?n .
  ?peintre wdt:P570 ?mort .
  OPTIONAL { ?item p:P571 ?st . ?st psv:P571 ?vn . ?vn wikibase:timeValue ?date ; wikibase:timePrecision ?prec . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank } }
  OPTIONAL { ?peintre rdfs:label ?pl FILTER(lang(?pl) = 'fr') }
}`)
  // Toutes ses dates, d'une ligne à l'autre : un tableau en a parfois plusieurs, chacune sa ligne.
  const datesDe = new Map<string, { valeur: string; precision: string }[]>()
  for (const l of lignes) {
    const qid = qidDe(l.item)
    if (qid && l.date && l.prec) (datesDe.get(qid) ?? datesDe.set(qid, []).get(qid)!).push({ valeur: l.date, precision: l.prec })
  }
  // Un titre a ses homonymes (« Les Tournesols » d'Egon Schiele) : on garde celui
  // dont le peintre est nommé par la question, et, de ceux-là, le plus lié.
  const parTitre = new Map<string, Candidat>()
  let sansPeintre = 0
  for (const l of lignes) {
    const qid = qidDe(l.item)
    const mort = anneeDe(l.mort)
    if (!qid || mort === null || !l.pl) continue
    const b = base.get(l.l)!
    const nomDeFamille = norme(l.pl).split(' ').filter(m => m.length > 2).pop() ?? ''
    if (!b.textes.some(t => t.includes(nomDeFamille))) {
      sansPeintre++
      continue
    }
    const fichier = decodeURIComponent(l.img.slice(l.img.indexOf('FilePath/') + 9)).replace(/ /g, '_')
    const c: Candidat = { qid, titre: l.l, peintre: A_LA_MAIN[qid]?.peintre ?? l.pl, annee: anneeDuTableau(datesDe.get(qid) ?? []), mortDuPeintre: mort, fichier, liens: Number(l.n), questions: [...new Set(b.ids)].sort() }
    const avant = parTitre.get(l.l)
    // Plusieurs peintres (un atelier) ou plusieurs dates : la mort la plus tardive compte.
    if (avant?.qid === qid) avant.mortDuPeintre = Math.max(avant.mortDuPeintre, mort)
    else if (!avant || c.liens > avant.liens) parTitre.set(l.l, c)
  }
  const deLaBase = [...parTitre.values()]
    .filter(c => c.mortDuPeintre <= MORT_AU_PLUS_TARD && c.liens >= LIENS_MIN && /\.(jpe?g|png)$/i.test(c.fichier))
    .sort((a, b) => b.liens - a.liens || a.qid.localeCompare(b.qid))
  // Ceux de la base d'abord : ils ont leur question. Puis les célèbres que la base ne pose pas, les plus liés d'abord.
  // Un titre de la base que Wikidata écrit à une majuscule ou un accent près (« Impression, soleil levant », « Impression,
  // Soleil levant ») ne se trouvait pas par son libellé exact : le célèbre du même titre, de son peintre, le reprend, avec
  // ses questions — sans quoi il était écarté des deux côtés, la base croyant le tenir.
  const sansTableau = new Map<string, { titre: string; ids: string[]; textes: string[] }>()
  for (const [titre, b] of base) if (!parTitre.has(titre) && !sansTableau.has(norme(titre))) sansTableau.set(norme(titre), { titre, ...b })
  const trouves = await celebres(wd, new Set([...parTitre.values()].map(c => c.qid)), new Set([...parTitre.keys()].map(norme)), datesDe)
  const repris = new Set<string>()
  const celebresTries = trouves.flatMap(c => {
    const b = sansTableau.get(norme(c.titre))
    if (!b) return [c]
    // Un homonyme d'un autre peintre que celui de la question n'est pas le tableau de la base, et ne prend pas son titre.
    const nomDeFamille = norme(c.peintre).split(' ').filter(m => m.length > 2).pop() ?? ''
    if (repris.has(b.titre) || !b.textes.some(t => t.includes(nomDeFamille))) return []
    repris.add(b.titre)
    return [{ ...c, titre: b.titre, questions: [...new Set(b.ids)].sort() }]
  })
  const horsDeLaBase = celebresTries.filter(c => c.questions.length === 0)
  const candidats = [...[...deLaBase, ...celebresTries.filter(c => c.questions.length > 0)].sort((a, b) => b.liens - a.liens || a.qid.localeCompare(b.qid)), ...horsDeLaBase]
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(CANDIDATS, JSON.stringify(candidats, null, 1))
  console.log(`${base.size} tableaux dans la base, ${parTitre.size} trouvés sur Wikidata (${sansPeintre} homonymes d'un autre peintre écartés) et ${repris.size} repris à une majuscule près, ${candidats.length - horsDeLaBase.length} candidats du domaine public ; ${horsDeLaBase.length} célèbres hors de la base :`)
  for (const c of candidats) console.log(`  ${c.qid.padEnd(10)} ${String(c.liens).padStart(3)}  ${c.titre} — ${c.peintre} (†${c.mortDuPeintre})${c.questions.length ? '' : '  [hors de la base]'}${ECARTES[c.qid] ? '  [écarté]' : DETAILS[c.qid] ? '' : '  [à voir]'}`)
  // Ce que Wikidata ne date pas à l'année, et que personne n'a encore écrit : à vérifier, puis dans `ANNEES_A_LA_MAIN`.
  // Seulement ceux qu'on a choisis, ou de la base : mille célèbres pas encore regardés n'ont pas à se dater.
  const aDater = candidats.filter(c => !ECARTES[c.qid] && c.annee === null && ANNEES_A_LA_MAIN[c.qid] === undefined && (DETAILS[c.qid] || c.questions.length > 0))
  if (aDater.length > 0) console.log(`${aDater.length} sans année, à écrire à la main dans ANNEES_A_LA_MAIN :`)
  for (const c of aDater) console.log(`  ${c.qid.padEnd(10)} ${c.titre} — ${c.peintre} : ${(datesDe.get(c.qid) ?? []).map(d => `${d.valeur.slice(0, 10)} (précision ${d.precision})`).join(', ') || 'aucune date'}`)
}

/**
 * Les tableaux célèbres que la base ne pose pas : ce que Wikidata range parmi les peintures et que
 * `LIENS_D_UN_CELEBRE` Wikipédia décrivent, son image, son titre français, son peintre mort à temps. En deux temps —
 * les identifiants d'abord, puis leurs fiches par paquets : d'une seule requête, les libellés de mille tableaux ne
 * rentraient pas dans la minute de Wikidata. Ni un tableau que la base pose déjà (`deja`), ni un titre qu'un autre
 * porte (`titresPris`, puis le plus lié des célèbres) : deux tableaux du même titre feraient deux bonnes réponses.
 */
async function celebres(wd: Wikidata, deja: ReadonlySet<string>, titresPris: ReadonlySet<string>, datesDe: Map<string, { valeur: string; precision: string }[]>): Promise<Candidat[]> {
  const lies = await wd.sparql(`SELECT ?item ?n WHERE { ?item wdt:P31 wd:Q3305213 ; wikibase:sitelinks ?n . FILTER(?n >= ${LIENS_D_UN_CELEBRE}) }`)
  const liens = new Map<string, number>()
  for (const l of lies) {
    const qid = qidDe(l.item)
    if (qid && !deja.has(qid)) liens.set(qid, Number(l.n))
  }
  const qids = [...liens.keys()].sort()
  const parQid = new Map<string, Candidat>()
  for (let i = 0; i < qids.length; i += TABLEAUX_PAR_REQUETE) {
    const lignes = await wd.sparql(`SELECT ?item ?l ?img ?pl ?mort ?date ?prec WHERE {
  VALUES ?item { ${qids.slice(i, i + TABLEAUX_PAR_REQUETE).map(q => `wd:${q}`).join(' ')} }
  ?item wdt:P18 ?img ; wdt:P170 ?peintre ; rdfs:label ?l . FILTER(lang(?l) = 'fr')
  ?peintre wdt:P570 ?mort ; rdfs:label ?pl . FILTER(lang(?pl) = 'fr')
  OPTIONAL { ?item p:P571 ?st . ?st psv:P571 ?vn . ?vn wikibase:timeValue ?date ; wikibase:timePrecision ?prec . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank } }
}`)
    // Dans un ordre fixe : un tableau a parfois deux images ou deux peintres, et la première ligne fait sa fiche.
    for (const l of [...lignes].sort((a, b) => a.item.localeCompare(b.item) || a.img.localeCompare(b.img) || a.pl.localeCompare(b.pl))) {
      const qid = qidDe(l.item)
      const mort = anneeDe(l.mort)
      if (!qid || mort === null) continue
      if (l.date && l.prec) {
        const dates = datesDe.get(qid) ?? datesDe.set(qid, []).get(qid)!
        if (!dates.some(d => d.valeur === l.date && d.precision === l.prec)) dates.push({ valeur: l.date, precision: l.prec })
      }
      const avant = parQid.get(qid)
      if (avant) avant.mortDuPeintre = Math.max(avant.mortDuPeintre, mort)
      else {
        const fichier = decodeURIComponent(l.img.slice(l.img.indexOf('FilePath/') + 9)).replace(/ /g, '_')
        parQid.set(qid, { qid, titre: A_LA_MAIN[qid]?.titre ?? l.l, peintre: A_LA_MAIN[qid]?.peintre ?? l.pl, annee: null, mortDuPeintre: mort, fichier, liens: liens.get(qid)!, questions: [] })
      }
    }
  }
  const pris = new Set(titresPris)
  return [...parQid.values()]
    .filter(c => c.mortDuPeintre <= MORT_AU_PLUS_TARD && /\.(jpe?g|png)$/i.test(c.fichier))
    .sort((a, b) => b.liens - a.liens || a.qid.localeCompare(b.qid))
    .filter(c => {
      // Un libellé qui n'est qu'un identifiant, ou le titre d'un autre : le plus lié le garde.
      const t = norme(c.titre)
      if (!t || /^q\d+$/.test(t) || pris.has(t)) return false
      pris.add(t)
      return true
    })
    .map(c => ({ ...c, annee: anneeDuTableau(datesDe.get(c.qid) ?? []) }))
}

const lireCandidats = (): Candidat[] => JSON.parse(readFileSync(CANDIDATS, 'utf8'))

/** L'adresse d'une miniature : Commons range ses fichiers sous l'empreinte md5 de leur nom. */
export function adresseDeLaMiniature(fichier: string, largeur: number): string {
  const h = createHash('md5').update(fichier).digest('hex')
  const nom = encodeURIComponent(fichier)
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${nom}/${largeur}px-${nom}`
}

const imageDuCache = (qid: string) => (existsSync(path.join(CACHE, 'images')) ? readdirSync(path.join(CACHE, 'images')).find(f => f.startsWith(`${qid}-`)) : undefined)
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))
/** Ses quatre cadrages sont-ils livrés ? Sa miniature ne sert alors plus à rien. */
const livre = (qid: string) => ECHELLES.every((_, i) => existsSync(path.join(DOSSIER_DES_DETAILS, `${qid}-${i + 1}.webp`)))

/**
 * Ceux dont il faut la miniature : les tableaux choisis qui ne sont pas encore découpés, puis les `combien` premiers
 * candidats que personne n'a regardés — ni détail, ni écart. Un tableau livré n'en a plus besoin : le cache ne suit
 * pas le dépôt, et retélécharger les cent d'origine prenait une heure pour rien.
 */
function aTelecharger(combien: number, tout: boolean): Candidat[] {
  const candidats = lireCandidats().filter(c => !ECARTES[c.qid])
  return [...candidats.filter(c => DETAILS[c.qid] && (tout || !livre(c.qid))), ...candidats.filter(c => !DETAILS[c.qid]).slice(0, combien)]
}

async function telecharger() {
  mkdirSync(path.join(CACHE, 'images'), { recursive: true })
  const combien = Number(process.argv.slice(3).find(a => /^\d+$/.test(a)) ?? A_REGARDER)
  // Des identifiants en argument : ceux-là seuls — les célèbres se choisissent à la main dans la liste de `choisir`,
  // où le plus lié n'est pas toujours celui qu'un joueur français reconnaît (vingt Madones avant « La Classe de danse »).
  const demandes = new Set(process.argv.slice(3).filter(a => /^Q\d+$/.test(a)))
  const liste = demandes.size > 0 ? lireCandidats().filter(c => demandes.has(c.qid) && !ECARTES[c.qid]) : aTelecharger(combien, process.argv.includes('--tout'))
  for (const c of liste) {
    if (imageDuCache(c.qid)) continue
    // Une miniature que personne n'a encore demandée se fabrique, et Wikimedia
    // en rationne la fabrique : la 1920 répond souvent 429 quand la 1280, déjà
    // faite pour les pages de Commons, passe aussitôt. Un 429 fait donc
    // descendre d'une largeur ; refusé aux trois, on attend, de plus en plus.
    for (let tour = 1; tour <= 4 && !imageDuCache(c.qid); tour++) {
      let rationne = false
      for (const largeur of LARGEURS) {
        await attendre(PAUSE)
        const r = await fetch(adresseDeLaMiniature(c.fichier, largeur), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
        if (r.ok) {
          const ext = (r.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg'
          writeFileSync(path.join(CACHE, 'images', `${c.qid}-${largeur}.${ext}`), Buffer.from(await r.arrayBuffer()))
          console.log(`  ${c.qid} ${largeur} px — ${c.titre}`)
          break
        }
        // Un 400 ou un 404 : l'original est plus étroit que cette largeur, on prend la suivante.
        if (r.status === 429) rationne = true
      }
      if (!imageDuCache(c.qid) && rationne) {
        console.error(`  ${c.qid} : 429 aux trois largeurs, on attend ${30 * tour} s`)
        await attendre(30_000 * tour)
      } else break
    }
    if (!imageDuCache(c.qid)) console.error(`  ${c.qid} : aucune miniature — ${c.titre}`)
  }
}

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'details.js'))('playwright')
}

const dataUrl = (fichier: string) => `data:image/${fichier.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(fichier).toString('base64')}`

// Dans la page : une vignette quadrillée (un trait tous les dixièmes, chiffré),
// et un cadrage réduit à sa taille, encodé de moins en moins fort jusqu'à son
// poids. Le quadrillage donne à l'œil le centre d'un détail en fractions.
const OUTILS = String.raw`
async function vignette(src, cote, titre, garde) {
  const img = await charger(src)
  const sx = garde[0] * img.naturalWidth, sy = garde[1] * img.naturalHeight, sl = garde[2] * img.naturalWidth, sh = garde[3] * img.naturalHeight
  const k = cote / Math.max(sl, sh)
  const l = Math.round(sl * k), h = Math.round(sh * k)
  const c = toile(l, h + 22), x = c.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
  x.drawImage(img, sx, sy, sl, sh, 0, 0, l, h)
  x.font = '13px sans-serif'
  for (let i = 1; i < 10; i++) {
    x.strokeStyle = i === 5 ? 'rgba(255,0,0,.9)' : 'rgba(255,255,0,.7)'
    x.beginPath(); x.moveTo(l * i / 10, 0); x.lineTo(l * i / 10, h); x.moveTo(0, h * i / 10); x.lineTo(l, h * i / 10); x.stroke()
    x.fillStyle = '#ff0'; x.fillText(String(i), l * i / 10 + 2, 13); x.fillText(String(i), 2, h * i / 10 - 2)
  }
  x.fillStyle = '#000'; x.fillText(titre, 4, h + 16)
  return c.toDataURL('image/png')
}
async function cadrage(src, r, largeur, hauteurMax, poidsMax) {
  const img = await charger(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const sx = r[0] * W, sy = r[1] * H, sl = r[2] * W, sh = r[3] * H
  let k = Math.min(largeur / sl, hauteurMax / sh)
  // La qualité seule ne suffit pas à une toile chargée (l'or d'Adele
  // Bloch-Bauer pesait 58 Ko à 0,2) : passé 0,5, l'image rapetisse.
  for (;;) {
    const c = toile(Math.round(sl * k), Math.round(sh * k)), x = c.getContext('2d')
    x.imageSmoothingQuality = 'high'
    x.drawImage(img, sx, sy, sl, sh, 0, 0, c.width, c.height)
    for (let q = 0.8; q >= 0.5; q -= 0.06) {
      const d = c.toDataURL('image/webp', q)
      if ((d.length - d.indexOf(',') - 1) * 0.75 <= poidsMax) return d
    }
    k *= 0.9
  }
}
`

async function avecLaPage<T>(f: (page: any) => Promise<T>): Promise<T> {
  const { chromium } = chargerPlaywright()
  const nav = await chromium.launch({ headless: true })
  try {
    const page = await pagePixels(nav)
    await page.addScriptTag({ content: OUTILS })
    return await f(page)
  } finally {
    await nav.close()
  }
}

/** Des planches de six, à regarder : celles des tableaux qui n'ont encore ni détail ni écart. */
async function planches() {
  const dossier = path.join(CACHE, 'planches')
  mkdirSync(dossier, { recursive: true })
  const voir = lireCandidats().filter(c => !DETAILS[c.qid] && !ECARTES[c.qid] && imageDuCache(c.qid))
  // Celles des tableaux décidés s'en vont, celles qui manquent se font : les miniatures arrivent par paquets, et une
  // planche qu'on est en train de regarder ne s'efface pas sous les yeux.
  const voulues = new Set(voir.map(c => `${c.qid}.png`))
  for (const f of readdirSync(dossier)) if (!voulues.has(f)) rmSync(path.join(dossier, f))
  const aFaire = voir.filter(c => !existsSync(path.join(dossier, `${c.qid}.png`)))
  if (aFaire.length > 0) {
    await avecLaPage(async page => {
      for (const c of aFaire) {
        const d = await dansLaPage<string>(page, 'vignette', dataUrl(path.join(CACHE, 'images', imageDuCache(c.qid)!)), 600, `${c.qid} ${c.titre} — ${c.peintre}`, gardeDeLaMiniature(c.qid))
        writeFileSync(path.join(dossier, `${c.qid}.png`), deDataUrl(d))
      }
    })
  }
  console.log(`${voir.length} vignettes dans ${dossier}, dont ${aFaire.length} neuves`)
}

/**
 * Les quatre cadrages, emboîtés : chacun interpole linéairement le détail et
 * le tableau entier — un rectangle compris entre deux rectangles emboîtés
 * contient le premier et tient dans le second.
 */
export function cadragesDe(centre: readonly [number, number]): [number, number, number, number][] {
  const d = ECHELLES[0]
  const x0 = Math.min(1 - d, Math.max(0, centre[0] - d / 2))
  const y0 = Math.min(1 - d, Math.max(0, centre[1] - d / 2))
  const arrondi = (v: number) => Math.round(v * 10_000) / 10_000
  return ECHELLES.map(s => {
    const t = (s - d) / (1 - d)
    return [arrondi(x0 * (1 - t)), arrondi(y0 * (1 - t)), arrondi(s), arrondi(s)]
  })
}

async function decouper() {
  const candidats = lireCandidats().filter(c => DETAILS[c.qid] && !ECARTES[c.qid])
  const tout = process.argv.includes('--tout')
  // Ce qui est livré reste : un tableau dont le détail n'a pas bougé garde ses images et sa ligne, telles quelles.
  const livres = new Map<string, TableauDuDetail>(existsSync(FICHE_DES_DETAILS) ? (JSON.parse(readFileSync(FICHE_DES_DETAILS, 'utf8')) as TableauDuDetail[]).map(t => [t.qid, t]) : [])
  const garde = (c: Candidat) => {
    const t = livres.get(c.qid)
    const memeDecoupe = t !== undefined && JSON.stringify(t.cadrages) === JSON.stringify(cadragesDe(DETAILS[c.qid])) && JSON.stringify(t.rognage ?? null) === JSON.stringify(ROGNAGES[c.qid] ?? null)
    return !tout && memeDecoupe && livre(c.qid) ? t : undefined
  }
  const sansImage = candidats.filter(c => !garde(c) && !imageDuCache(c.qid))
  if (sansImage.length > 0) throw new Error(`${sansImage.map(c => c.qid).join(', ')} : pas de miniature dans le cache, lance telecharger`)
  const fiche: TableauDuDetail[] = []
  mkdirSync(DOSSIER_DES_DETAILS, { recursive: true })
  const voulus = new Set<string>()
  let decoupes = 0
  await avecLaPage(async page => {
    for (const c of candidats) {
      const tel = garde(c)
      if (tel) {
        fiche.push(tel)
        for (let i = 1; i <= ECHELLES.length; i++) voulus.add(`${c.qid}-${i}.webp`)
        continue
      }
      decoupes++
      const src = dataUrl(path.join(CACHE, 'images', imageDuCache(c.qid)!))
      const cadrages = cadragesDe(DETAILS[c.qid])
      for (const [i, r] of cadrages.entries()) {
        const nom = `${c.qid}-${i + 1}.webp`
        writeFileSync(path.join(DOSSIER_DES_DETAILS, nom), deDataUrl(await dansLaPage<string>(page, 'cadrage', src, surLaMiniature(c.qid, r), LARGEUR, HAUTEUR_MAX, POIDS_MAX)))
        voulus.add(nom)
      }
      fiche.push({
        qid: c.qid,
        titre: c.titre,
        peintre: c.peintre,
        // Écrite à la main, elle l'emporte : Wikidata se trompe aussi à l'année (« Le Fifre, 1850 »).
        annee: ANNEES_A_LA_MAIN[c.qid] ?? c.annee,
        mortDuPeintre: c.mortDuPeintre,
        fichier: c.fichier,
        page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.fichier)}`,
        statut: 'domaine public',
        cadrages,
        // Ce qu'on a rogné de la miniature, pour qu'un découpage refait le sache : les cadrages se lisent sur l'image rognée.
        ...(ROGNAGES[c.qid] && { rognage: ROGNAGES[c.qid] }),
        questions: c.questions,
      })
    }
  })
  for (const f of readdirSync(DOSSIER_DES_DETAILS)) if (f.endsWith('.webp') && !voulus.has(f)) rmSync(path.join(DOSSIER_DES_DETAILS, f))
  fiche.sort((a, b) => a.qid.localeCompare(b.qid))
  // Un tableau par ligne : une diff dit lequel a changé.
  writeFileSync(FICHE_DES_DETAILS, `[\n${fiche.map(t => '  ' + JSON.stringify(t)).join(',\n')}\n]\n`)
  console.log(`${fiche.length} tableaux, ${voulus.size} images dans ${DOSSIER_DES_DETAILS} — ${decoupes} découpés, ${fiche.length - decoupes} gardés tels quels`)
  verifier()
}

/** Ce que la fiche doit être : `details.test.ts` le garde, ceci le dit plus court après un découpage. */
export function refusDeLaFiche(fiche: readonly TableauDuDetail[], images: readonly string[], poids: (nom: string) => number): string[] {
  const refus: string[] = []
  const vus = new Set<string>()
  const titres = new Set<string>()
  for (const t of fiche) {
    if (vus.has(t.qid)) refus.push(`${t.qid} : deux fois dans la fiche`)
    vus.add(t.qid)
    if (t.mortDuPeintre > MORT_AU_PLUS_TARD) refus.push(`${t.qid} : peintre mort en ${t.mortDuPeintre}, pas encore du domaine public`)
    // Sans année — Wikidata ne la dit qu'à la décennie ou au siècle, et personne ne l'a écrite à la main — : le
    // serveur l'écarterait au chargement (« fiche incomplète », `core/details.ts`), et le tableau quittait le Détail
    // et l'Expédition sans qu'une épreuve rougisse. Refusé ici, `verifier` et `details.test.ts` l'arrêtent avant.
    if (t.annee === null) refus.push(`${t.qid} : sans année — à écrire à la main dans ANNEES_A_LA_MAIN`)
    // Une date à la décennie ou au siècle lue comme une année : « La Vierge au long cou, 1600 », son peintre mort en 1540.
    else if (t.annee > t.mortDuPeintre) refus.push(`${t.qid} : daté de ${t.annee}, après la mort de son peintre (${t.mortDuPeintre})`)
    if (t.cadrages.length !== 4) refus.push(`${t.qid} : ${t.cadrages.length} cadrages`)
    for (const [i, [x, y, l, h]] of t.cadrages.entries()) {
      if (x < 0 || y < 0 || l <= 0 || h <= 0 || x + l > 1.00001 || y + h > 1.00001) refus.push(`${t.qid} : cadrage ${i + 1} hors du tableau`)
      const avant = t.cadrages[i - 1]
      if (avant && !(x <= avant[0] && y <= avant[1] && x + l >= avant[0] + avant[2] - 1e-6 && y + h >= avant[1] + avant[3] - 1e-6 && l > avant[2]))
        refus.push(`${t.qid} : cadrage ${i + 1} n'emboîte pas le ${i}`)
    }
    const dernier = t.cadrages[3]
    if (dernier && dernier.join() !== '0,0,1,1') refus.push(`${t.qid} : le dernier cadrage n'est pas le tableau entier`)
    // Sans question de la base, il se pose quand même au Cabinet, qui demande son titre : un tableau venu de Wikidata
    // seul n'en a pas (`celebres`). Deux tableaux du même titre, eux, feraient deux bonnes réponses parmi quatre.
    if (titres.has(t.titre)) refus.push(`${t.qid} : « ${t.titre} », un titre qu'un autre tableau porte déjà`)
    titres.add(t.titre)
    for (let i = 1; i <= 4; i++) {
      const nom = `${t.qid}-${i}.webp`
      if (!images.includes(nom)) refus.push(`${nom} manque`)
      else if (poids(nom) > POIDS_MAX) refus.push(`${nom} pèse ${Math.round(poids(nom) / 1024)} Ko`)
    }
  }
  for (const nom of images) if (!vus.has(nom.replace(/-\d\.webp$/, ''))) refus.push(`${nom} : aucune fiche`)
  return refus
}

function verifier() {
  const fiche: TableauDuDetail[] = JSON.parse(readFileSync(FICHE_DES_DETAILS, 'utf8'))
  const images = readdirSync(DOSSIER_DES_DETAILS).filter(f => f.endsWith('.webp'))
  const poids = (nom: string) => readFileSync(path.join(DOSSIER_DES_DETAILS, nom)).length
  const refus = refusDeLaFiche(fiche, images, poids)
  const total = images.reduce((s, n) => s + poids(n), 0)
  console.log(`${fiche.length} tableaux, ${images.length} images, ${(total / 1024 / 1024).toFixed(1)} Mo${refus.length ? '' : ' — rien à redire'}`)
  for (const r of refus) console.error(`  ${r}`)
  if (refus.length) process.exitCode = 1
}

const COMMANDES: Record<string, () => unknown> = { choisir, telecharger, planches, decouper, verifier }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commande = COMMANDES[process.argv[2] ?? '']
  if (commande) await commande()
  else {
    console.error(`Usage : npx tsx scripts/details.ts <${Object.keys(COMMANDES).join('|')}>`)
    process.exitCode = 1
  }
}

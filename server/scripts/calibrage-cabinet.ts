// Le calibrage du Cabinet de curiosités : combien de jours il faut pour tout
// posséder et tout dorer, ce qu'une journée rapporte de poussière d'or, de
// confettis et d'expérience — comparé à une série de la campagne, à la
// minute —, quand les gardiens se réveillent, et ce que vaut chaque jeu, joué
// par qui sait et par qui répond au hasard. Le Cabinet l'attend avant
// d'ouvrir : les chiffres de la maquette (`retours/2026-10-24/maquette/jeu.js`)
// se remesurent ici sur le vrai code, et le troisième des choix délégués —
// les parties libres paient-elles plus qu'une série ? — se tranche sur eux
// (`docs/architecture/decisions.md`, « Les sept choix laissés au
// propriétaire »). Ses chiffres datés : `docs/reference/baremes.md`.
//
// Des joueurs inventés jouent les règles partagées — aucune n'est recopiée.
// Chaque partie part d'un départ que le serveur relirait (`lireLeDepart` en
// relit des centaines), et chaque geste passe par le vrai pli
// (`jouerUnGeste`) à l'heure où il arrive : le chrono, la grâce, les
// pouvoirs, le verdict de chaque jeu, les pièces justes, le bilan, l'issue et
// la poussière sont ceux du code. La visite du jour, les refus d'un départ,
// le solde, les achats, les dorures et les gardiens dus passent par le musée
// (`shared/cabinet/musee.ts`) ; l'expérience par celle de la campagne
// (`xpDuJourDeCampagne`) ; la série de comparaison par l'ordre des marches
// d'une vraie série (`ordreDeSerie`, `VIES`). Ne s'invente que ce qui ne
// s'écrit pas en règle : le contenu des questions de la base (synthétique ;
// les lieux, les fiches, les répliques et les frises sont ceux qu'on livre),
// ce que chaque joueur sait (`MODELE`), le temps qu'il met (`SECONDES`), et
// ses choix — la carte-bonus, l'œuvre qu'il chasse, ce qu'il achète. Les
// quelques reflets que le serveur tient en SQL (la série du profil, la visite
// figée, les lignes d'œuvres d'un bilan, d'un achat) s'y tiennent comme le
// lot qui les écrit — celui du départ, celui de la fin.
//
// Le savoir : celui de la campagne pour les questions de la base — un joueur
// moyen trouve ce que trouve le calibrage des sentiers (`TAUX_DU_CALIBRAGE`),
// un plus fort ou plus faible est décalé d'un logit, comme dans
// `calibrage-sentiers.ts` —, et pour le reste un modèle, faute de parties
// jouées à mesurer : la tablée, puis les vraies parties de la préproduction,
// le corrigeront. Le joueur au hasard répond au hasard partout où il faut
// savoir (une réponse, une épingle, un ordre, un nom), et prend ailleurs ce
// qui rapporte le plus en moyenne — le grand filet, garder l'étoile du Pari
// quand parier ne vaut pas la peine : c'est le plancher de chaque jeu.
//
// Un barème s'essaie sans toucher au fichier (`--essai NOM=…`) : la constante
// de `shared/cabinet/bareme.ts` prend une autre valeur en mémoire, avant que
// les règles ne se chargent — d'où leurs `import()` plus bas —, et ce sont
// les règles du code qui la lisent. Un tableau ou une table seulement : un
// nombre exporté ne se réécrit pas, il s'essaie dans le fichier.
//
//   npx tsx scripts/calibrage-cabinet.ts [--parcours 4] [--jours 365] [--parties 1000] [--mesures 100]
//     [--joueurs moyen,bon] [--arrivees neuf,30,60] [--graine cabinet] [--sans-musee]
//     [--essai ERREURS_DE_LA_FRISE=0/1/1] [--essai SEUILS_DES_RARETES=commun:6/rare:7]
//     [--essai MARCHES_DU_PARI=pari:moyen+difficile]
//
// Une quarantaine de secondes d'office ; `--sans-musee` n'en garde que les
// jeux un à un et les confettis à la minute, une dizaine.
import type { Niveau } from '../../shared/campagne'
import type { Lieu, Fiche, Replique, FriseATheme } from '../../shared/cabinet/contenu'
import type { ContenuTire } from '../../shared/cabinet/jeux/index'
import type { CleDeJeu } from '../../shared/cabinet/jeux/regle'
import type { QuestionTiree } from '../../shared/cabinet/jeux/outils'
import type { PariMontre, PariTire } from '../../shared/cabinet/jeux/pari'
import type { EclairMontre, EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { MotMontre, MotTire } from '../../shared/cabinet/jeux/mot'
import type { FiletMontre, FiletTire, TailleDuFilet } from '../../shared/cabinet/jeux/filet'
import type { DetailMontre, DetailTire, TableauDuCabinet } from '../../shared/cabinet/jeux/detail'
import type { FriseMontree, FriseTiree } from '../../shared/cabinet/jeux/frise'
import type { EpingleMontree, EpingleTiree } from '../../shared/cabinet/jeux/epingle'
import type { IndicesMontres, IndicesTires } from '../../shared/cabinet/jeux/indices'
import type { RepliqueMontreeAQui, RepliqueMontreeAuMot, RepliqueTiree } from '../../shared/cabinet/jeux/replique'
import type { Point } from '../../shared/cabinet/france'
import type { CleDePouvoir, Force } from '../../shared/cabinet/pouvoirs'
import type { CleDOeuvre } from '../../shared/cabinet/oeuvres'
import type { CadreDuDepart, LigneDOeuvre, LigneDuProfil, Musee, PartieDuJour, VisiteDuJour } from '../../shared/cabinet/musee'
import type { CarteDuDepart, DepartDUnePartie, EtatDeLaPartie, GesteDuCabinet, IssueDUnePartie, Manche, OrigineDUnePartie, ReponseDUnJeu } from '../../shared/cabinet/partie'
// Avant l'essai, rien qui lise le barème : `bareme.ts` n'importe que des types, la campagne et les nombres rien du Cabinet.
import * as BAREME from '../../shared/cabinet/bareme'
import { NIVEAUX } from '../../shared/campagne'
import { lireNombre } from '../../shared/nombres'

// ── Les options ───────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2)
const valeursDe = (nom: string): string[] => ARGS.flatMap((a, i) => (a === `--${nom}` && ARGS[i + 1] !== undefined ? [ARGS[i + 1]] : []))
function entier(nom: string, defaut: number): number {
  const brut = valeursDe(nom).at(-1)
  if (brut === undefined) return defaut
  const n = lireNombre(brut)
  if (n === null || !Number.isInteger(n) || n < 1) arreter(`--${nom} attend un entier positif, pas « ${brut} »`)
  return n
}
function liste(nom: string): string[] | null {
  const brut = valeursDe(nom).at(-1)
  return brut === undefined ? null : brut.split(',').map(x => x.trim()).filter(Boolean)
}
function arreter(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Les parcours de chaque joueur, à chaque arrivée : un musée rempli jour après jour, de son premier matin à la fin. */
const PARCOURS = entier('parcours', 4)
/** L'horizon d'un parcours, en jours de calendrier : au-delà, « plus d'un an ». */
const JOURS = entier('jours', 365)
/** Les parties de chaque jeu, par joueur, pour ce qu'il vaut sans carte-bonus. */
const PARTIES = entier('parties', 1000)
/** Les parties qui mesurent une carte-bonus à un jeu, quand un joueur se demande laquelle emporter. */
const MESURES = entier('mesures', 100)
const GRAINE = valeursDe('graine').at(-1) ?? 'cabinet'
const SANS_MUSEE = ARGS.includes('--sans-musee')

// ── Un barème à l'essai, avant que les règles ne se chargent ──────────────

/**
 * La constante prend la valeur essayée en mémoire — le fichier ne change pas.
 * Les règles se chargent après (leurs `import()`) : ce qu'un module en tire à
 * son chargement (la valeur d'une étoile gardée du Pari, le recul d'une année
 * du Filet) se tire alors de la valeur essayée.
 */
function essayer(texte: string): string {
  const egal = texte.indexOf('=')
  const nom = texte.slice(0, egal)
  if (egal < 1 || !Object.hasOwn(BAREME, nom)) arreter(`--essai ${texte} : « ${nom} » n'est pas une constante de shared/cabinet/bareme.ts`)
  const cible: unknown = (BAREME as Record<string, unknown>)[nom]
  if (typeof cible !== 'object' || cible === null) arreter(`--essai ${nom} : un nombre exporté ne se réécrit pas en mémoire — essaie-le dans shared/cabinet/bareme.ts, le temps de la mesure`)
  const morceaux = texte.slice(egal + 1).split('/')
  if (Array.isArray(cible)) {
    // Un barème chiffré garde sa forme — trois paliers restent trois ; une liste de marches peut s'allonger.
    const marches = typeof cible[0] === 'string'
    if (!marches && morceaux.length !== cible.length) arreter(`--essai ${nom} : ${cible.length} valeurs attendues, séparées par « / »`)
    cible.splice(0, cible.length, ...morceaux.map(x => valeurEssayee(nom, cible[0], x)))
  } else {
    const table = cible as Record<string, unknown>
    for (const m of morceaux) {
      const [cle, valeur] = m.split(':')
      if (!Object.hasOwn(table, cle) || valeur === undefined) arreter(`--essai ${nom} : « ${cle} » n'en est pas une clé (${Object.keys(table).join(', ')})`)
      table[cle] = valeurEssayee(nom, table[cle], valeur)
    }
  }
  return `${nom} = ${JSON.stringify(cible)}`
}
/** Une valeur essayée, de la forme de celle qu'elle remplace : un nombre, une marche (`facile`), ou des marches (`moyen+difficile`). */
function valeurEssayee(nom: string, avant: unknown, texte: string): number | string | string[] {
  if (Array.isArray(avant)) return texte.split('+').map(x => valeurEssayee(nom, avant[0], x) as string)
  if (typeof avant === 'string') return (NIVEAUX as readonly string[]).includes(texte) ? texte : arreter(`--essai ${nom} : « ${texte} » n'est pas une marche (${NIVEAUX.join(', ')})`)
  return lireNombre(texte) ?? arreter(`--essai ${nom} : « ${texte} » n'est pas un nombre`)
}
const ESSAIS = valeursDe('essai').map(essayer)

// ── Les règles, chargées après l'essai ────────────────────────────────────

const { CLES_DES_JEUX, JEUX } = await import('../../shared/cabinet/jeux/regle')
const { regleDe } = await import('../../shared/cabinet/jeux/index')
const P = await import('../../shared/cabinet/partie')
const { lireLeDepart } = await import('../../shared/cabinet/lecture')
const M = await import('../../shared/cabinet/musee')
const { OEUVRES, OEUVRES_DE_DEPART, JEU_DE_L_OEUVRE, estUneOeuvre, oeuvre } = await import('../../shared/cabinet/oeuvres')
const { pouvoirDe, forceDe } = await import('../../shared/cabinet/pouvoirs')
const { AUTRES_GARDIENS, pouvoirDuGardien, GARDIENS, GARDIENS_DE_SAISON, conditionDuGardien } = await import('../../shared/cabinet/salles')
/** Le gardien de la série, qui se réveille aux jours d'affilée, pas au musée. */
const SCARABEE = AUTRES_GARDIENS.find(g => 'serie' in g.reveil)!.legendaire
const { echeanceDe } = await import('../../shared/cabinet/chrono')
const { DANS_LA_FRANCE, dansLaFrance, distanceKm } = await import('../../shared/cabinet/france')
const { affirmationDe } = await import('../../shared/cabinet/jeux/eclair')
const { pisteDuFilet } = await import('../../shared/cabinet/jeux/filet')
const { detailTire } = await import('../../shared/cabinet/jeux/detail')
const { friseEnVagues } = await import('../../shared/cabinet/jeux/frise')
const { epingleTiree, pointADistance } = await import('../../shared/cabinet/jeux/epingle')
const { repliqueTiree } = await import('../../shared/cabinet/jeux/replique')
const { battre, auHasard } = await import('../../shared/cabinet/jeux/outils')
const { decimales } = await import('../../shared/classement')
const { hasardDe } = await import('../../shared/missions')
const { jourAvant, jourDe } = await import('../../shared/jour')
const { minuitDe } = await import('../../shared/qg')
const { formatNumber } = await import('../../shared/typographie')
const { TAUX_DU_CALIBRAGE } = await import('../../shared/sentiers')
const { JUSTES_DOUBLEES_PAR_JOUR, QUESTIONS_PAR_SERIE, VIES, ordreDeSerie, xpDuJourDeCampagne } = await import('../../shared/campagne')
const { codexDuNiveau } = await import('../../shared/codex')
const { VERSION_DES_HUIT_FAMILLES } = await import('../../shared/rencontres')
const { contenuDuCabinet } = await import('../src/core/cabinet/contenu')

const {
  CHANGEMENTS_PAR_PARTIE,
  DEPARTS_PAR_HEURE,
  ETOILES_AU_CADRAGE,
  ETOILES_DU_FILET,
  ETOILES_DU_PARI,
  ETOILES_D_UNE_PARTIE,
  LARGEURS_DU_FILET,
  BONUS_DE_MISE,
  MANCHES_PAR_PARTIE,
  MARCHES_DE_L_ECLAIR,
  MARCHES_DU_FILET,
  MARCHES_DU_MOT,
  MARCHES_DU_PARI,
  PRIX_D_UNE_DORURE,
  PRIX_D_UNE_OEUVRE,
  SEUILS_DES_RARETES,
  ZONE_DU_FILET,
} = BAREME

// ── Les joueurs ───────────────────────────────────────────────────────────

interface Joueur {
  nom: string
  /** Ce qu'il sait de plus qu'un joueur moyen, en logit ; null : il répond au hasard. */
  theta: number | null
  /** Le temps qu'il met, au regard du joueur moyen. */
  vitesse: number
  /** La part des jours où il vient. */
  assiduite: number
  chasses: number
  libres: number
  /** Il change le jeu d'une case de la visite qui lui va mal. */
  echange: boolean
}

/**
 * Le moyen et le complétionniste suivent le rythme des simulations de la
 * maquette — une visite, deux chasses, cinq parties libres —, l'un au savoir
 * du calibrage, l'autre une marche plus haut ; le bon sait autant que le
 * complétionniste, mais ne joue pas de partie libre ; l'occasionnel vient un
 * jour sur deux à peu près, pour sa visite et une chasse.
 */
const TOUS_LES_JOUEURS: readonly Joueur[] = [
  { nom: 'occasionnel', theta: -0.5, vitesse: 1.3, assiduite: 4 / 7, chasses: 1, libres: 0, echange: false },
  { nom: 'moyen', theta: 0, vitesse: 1, assiduite: 1, chasses: 2, libres: 5, echange: true },
  { nom: 'bon', theta: 1, vitesse: 0.9, assiduite: 1, chasses: 2, libres: 0, echange: true },
  { nom: 'complétionniste', theta: 1, vitesse: 0.9, assiduite: 1, chasses: 2, libres: 5, echange: true },
  { nom: 'hasard', theta: null, vitesse: 0.6, assiduite: 1, chasses: 2, libres: 5, echange: false },
]
const filtre = liste('joueurs')
const JOUEURS = filtre ? TOUS_LES_JOUEURS.filter(j => filtre.includes(j.nom)) : TOUS_LES_JOUEURS
if (JOUEURS.length === 0) arreter(`--joueurs : aucun de ${TOUS_LES_JOUEURS.map(j => j.nom).join(', ')}`)
/** Deux joueurs qui savent autant et vont aussi vite jouent chaque partie pareil : leurs mesures se partagent. */
const cleDuSavoir = (j: Joueur) => `${j.theta}:${j.vitesse}`

/**
 * Ce que chaque joueur sait, hors des questions de la base : un modèle — la
 * part d'un joueur moyen, décalée de son logit. Chaque part dit ce qu'elle
 * suppose ; la tablée et les vraies parties la remplaceront.
 */
const MODELE = {
  /** Le Mot mystère : sans savoir le mot, il le déduit de ses couleurs, une fois sur trois — mieux à chaque lettre soufflée (en logit). */
  motDeduit: 0.35,
  motParLettre: 0.8,
  /** … et le trouve alors au troisième, quatrième ou cinquième essai. */
  motAuxEssais: [0.4, 0.35, 0.25],
  /** Le Filet : il sait la valeur, à un centième et demi de piste près… */
  filetSait: 0.3,
  filetPrecis: 0.015,
  /** … sinon il l'estime, à tant de piste près (un écart type). */
  filetFlou: 0.12,
  /** Le Détail : il reconnaît le tableau, au premier, deuxième ou troisième cadrage. */
  detailReconnu: 0.45,
  detailAuCadrage: [0.45, 0.35, 0.2],
  /** La Frise : il sait l'année d'un événement ; sinon il l'estime, à tant de l'étendue de la frise près. */
  friseSait: 0.45,
  friseFlou: 0.25,
  /** L'Épingle : il sait le lieu (à une quinzaine de kilomètres) ; sinon sa région (de 40 à 220 km) ; sinon rien. */
  epingleSait: 0.3,
  epinglePresKm: 15,
  epingleRegion: 0.55,
  epingleRegionKm: [40, 220],
  /** Les Indices : il reconnaît la personne, au premier, au deuxième… au cinquième indice. */
  indicesReconnu: 0.7,
  indicesAuRang: [0.1, 0.15, 0.2, 0.25, 0.3],
  /** La Réplique : il sait le mot ; qui l'a dite, s'il savait le mot, ou sinon. */
  repliqueMot: 0.5,
  repliqueQuiSiMot: 0.8,
  repliqueQui: 0.33,
}

/**
 * Le temps de chaque geste, en secondes, pour un joueur moyen — lire, chercher,
 * toucher ; un tirage de plus ou moins un tiers s'y ajoute. Hors des manches,
 * l'annonce (la carte-bonus, « Commencer »), chaque révélation et le bilan.
 */
const SECONDES = {
  pariQuestion: 9,
  pariChoix: 2,
  eclairAffirmation: 5,
  motEssai: 12,
  filet: 14,
  detailRegard: 6,
  friseBase: 8,
  friseParVenu: 6,
  epingle: 18,
  indiceLu: 7,
  indiceNom: 9,
  repliqueEtape: 8,
  pouvoir: 2,
  annonce: 10,
  revelation: 6,
  bilan: 8,
}
/** Une question de série, lecture de l'anecdote comprise — le chiffre de `calibrage-sentiers.ts`. */
const SECONDES_PAR_QUESTION_DE_SERIE = 20

// ── Le hasard ─────────────────────────────────────────────────────────────

type Hasard = () => number
const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))
/** Un tirage d'une loi normale centrée réduite, d'un hasard qui se rejoue. */
const normale = (r: Hasard) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
/** Un rang tiré selon des poids. */
function selon(poids: readonly number[], r: Hasard): number {
  let x = r() * poids.reduce((a, b) => a + b, 0)
  for (let i = 0; i < poids.length; i++) if ((x -= poids[i]) < 0) return i
  return poids.length - 1
}
/** La fonction d'erreur (Abramowitz et Stegun, 7.1.26) : la chance qu'une estimation tombe dans un filet. */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x < 0 ? -y : y
}

/** La chance d'un joueur, d'une part de base décalée de son logit. */
const chance = (base: number, theta: number) => sigmoide(logit(base) + theta)
/** Ce qu'il trouve d'une question de la base à cette marche — devinette comprise, comme le calibrage des sentiers. */
const trouve = (j: Joueur, n: Niveau, propositions = 4) => (j.theta === null ? 1 / propositions : chance(TAUX_DU_CALIBRAGE[n], j.theta))
/** Ce qu'il sait vraiment, sans deviner, d'une question à tant de propositions. */
const sait = (j: Joueur, n: Niveau, propositions = 4) => (j.theta === null ? 0 : Math.max(0, (trouve(j, n, propositions) - 1 / propositions) / (1 - 1 / propositions)))
/**
 * Quand il ne sait pas, la chance que sa réponse tombe juste : une sur quatre
 * d'ordinaire, moins à une marche que la salle trouve moins qu'au hasard — une
 * experte se trouve à 10 % : ses mauvaises réponses attirent. Ainsi il trouve,
 * Éclairer à part, exactement ce que trouve la campagne (`trouve`).
 */
const devineJuste = (j: Joueur, n: Niveau, propositions = 4) => {
  const k = sait(j, n, propositions)
  return Math.min(1 / propositions, (trouve(j, n, propositions) - k) / Math.max(1e-9, 1 - k))
}
const part = (j: Joueur, base: number) => (j.theta === null ? 0 : chance(base, j.theta))

// ── Le contenu ────────────────────────────────────────────────────────────

const CONTENU = contenuDuCabinet()
if (CONTENU.lieux.length < 3 || CONTENU.fiches.length < 3 || CONTENU.repliques.length < 3 || CONTENU.frises.length < 1) arreter('server/content/cabinet/ ne se lit pas : le calibrage joue le contenu livré')
const LIEUX: readonly Lieu[] = CONTENU.lieux
const FICHES: readonly Fiche[] = CONTENU.fiches
const REPLIQUES: readonly Replique[] = CONTENU.repliques
const FRISES: readonly FriseATheme[] = CONTENU.frises

/**
 * Des tableaux d'essai, d'années voisines : le Détail ne se joue ici qu'au
 * cadrage où il reconnaît, et ce que ses titres disent n'y change rien — les
 * cent vrais tirent `shared/expedition.ts` avec eux.
 */
const TABLEAUX: readonly TableauDuCabinet[] = Array.from({ length: 40 }, (_, i) => ({ qid: `Q${1000 + i}`, titre: `Le tableau ${i}`, peintre: `Le peintre ${i % 13}`, annee: 1420 + i * 13 }))

let numero = 0
/** Une question de la base, synthétique : ce qu'un jeu en lit — ses quatre réponses, sa bonne, sa marche. */
function question(niveau: Niveau, r: Hasard): QuestionTiree {
  numero++
  return { id: `q-${numero}`, texte: `La question ${numero} ?`, reponses: ['Riga', 'Vilnius', 'Tallinn', 'Minsk'], bonne: Math.floor(r() * 4), categorie: 'Géographie', anecdote: 'Le savais-tu ?', niveau }
}
/**
 * La marche d'une question, parmi celles que le tireur de ce jeu prend
 * (`MARCHES_DU_PARI`, `MARCHES_DE_L_ECLAIR`…), chacune autant : la fraîcheur
 * du tirage ne préfère aucune marche.
 */
const uneMarche = (marches: readonly Niveau[], r: Hasard): Niveau => auHasard(marches, r)
/** Ce qu'il trouve, en moyenne, d'une question tirée parmi ces marches. */
const surLesMarches = (j: Joueur, marches: readonly Niveau[]) => marches.reduce((n, k) => n + trouve(j, k), 0) / marches.length
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const motAuHasard = (n: number, r: Hasard) => Array.from({ length: n }, () => LETTRES[Math.floor(r() * LETTRES.length)]).join('')

/** Des éléments distincts, tirés d'une liste. */
const distincts = <T>(tas: readonly T[], n: number, r: Hasard): T[] => battre(tas, r).slice(0, n)

/** Ce qu'un départ tire, comme le tireur du serveur : les trois manches, puis les rechanges de Changer. */
function tirer(jeu: CleDeJeu, n: number, r: Hasard, anneeDuDepart: number): ContenuTire[] {
  switch (jeu) {
    case 'pari':
      return Array.from({ length: n }, (): PariTire => ({ jeu, q1: question(uneMarche(MARCHES_DU_PARI.question, r), r), q2: question(uneMarche(MARCHES_DU_PARI.pari, r), r) }))
    case 'eclair':
      return Array.from({ length: n }, (): EclairTire => ({ jeu, affirmations: Array.from({ length: BAREME.AFFIRMATIONS_DE_L_ECLAIR }, () => affirmationDe(question(uneMarche(MARCHES_DE_L_ECLAIR, r), r), r)!) }))
    case 'mot':
      return Array.from({ length: n }, (): MotTire => {
        const lettres = motAuHasard(BAREME.LETTRES_DU_MOT_MIN + Math.floor(r() * (BAREME.LETTRES_DU_MOT_MAX - BAREME.LETTRES_DU_MOT_MIN + 1)), r)
        return { jeu, question: question(uneMarche(MARCHES_DU_MOT, r), r), lettres, affiche: lettres[0] + lettres.slice(1).toLowerCase() }
      })
    case 'filet':
      return Array.from({ length: n }, (): FiletTire => {
        for (;;) {
          // Trois sur cinq des années, le reste des estimations, de dix à cent mille.
          const annee = r() < 0.6
          const valeur = annee ? 1100 + Math.floor(r() * 870) : Math.round(10 ** (1 + 4 * r()))
          const piste = pisteDuFilet(valeur, annee, r, anneeDuDepart)
          if (piste) return { jeu, question: question(uneMarche(MARCHES_DU_FILET, r), r), valeur, annee, piste }
        }
      })
    case 'detail':
      return distincts(TABLEAUX, n, r).map(t => detailTire(t, TABLEAUX, r, { anecdote: null, categorie: 'Arts & lettres' })!)
    case 'frise': {
      // Une frise se construit d'un bout à l'autre : ses trois manches, jamais de rechange.
      const f = auHasard(FRISES, r)
      return friseEnVagues({ sorte: 'theme', cle: f.id, theme: f.theme, evenements: f.evenements, savais: f.savais, categorie: f.categorie }, r)!
    }
    case 'epingle':
      return distincts(LIEUX, n, r).map(l => epingleTiree(l, r))
    case 'indices':
      return distincts(FICHES, n, r).map((fiche): IndicesTires => ({ jeu, fiche }))
    case 'replique':
      return distincts(REPLIQUES, n, r).map(x => repliqueTiree(x, r))
  }
}

/** Les départs relus comme le serveur les relirait, par jeu : un plan qu'il refuserait ferait mentir tout le calibrage. */
const RELUS = new Map<CleDeJeu, number>()
const RELUS_PAR_JEU = 40

/** Un départ, du cadre que le musée accepte : le plan entier, son chrono, sa graine. */
function departDu(cadre: CadreDuDepart, jour: string, r: Hasard): DepartDUnePartie {
  const changer = cadre.carte?.pouvoir === 'changer' && JEUX[cadre.jeu].changeable
  const rechanges = changer ? CHANGEMENTS_PAR_PARTIE[cadre.carte!.force] : 0
  const d: DepartDUnePartie = {
    ...cadre,
    v: P.VERSION_DU_DEPART,
    jour,
    chrono: P.chronoDuDepart(cadre.jeu, cadre.carte),
    graine: `${GRAINE}:${numero++}`,
    tirages: tirer(cadre.jeu, MANCHES_PAR_PARTIE + rechanges, r, P.anneeDuDepart({ jour })),
  }
  const relus = RELUS.get(d.jeu) ?? 0
  if (relus < RELUS_PAR_JEU) {
    if (!lireLeDepart(JSON.stringify(d))) arreter(`Le calibrage a tiré un départ ${d.jeu} que le serveur ne relirait pas : ${JSON.stringify(d).slice(0, 300)}…`)
    RELUS.set(d.jeu, relus + 1)
  }
  return d
}

/** Un point de la carte de France tiré au hasard : dans le cadre, et à moins de 60 km d'un lieu livré — la terre, à peu près. */
function pointDeFrance(r: Hasard): Point {
  const { latMin, latMax, lonMin, lonMax } = DANS_LA_FRANCE
  for (;;) {
    const p = { lat: latMin + r() * (latMax - latMin), lon: lonMin + r() * (lonMax - lonMin) }
    if (LIEUX.some(l => distanceKm(p, l) < 60)) return p
  }
}
/**
 * Un point ramené dans le cadre de la France : le centre d'une zone éclairée
 * près d'une côte tombe parfois en mer, et la page ne laisse pas planter
 * hors du cadre — le joueur plante au bord.
 */
function dansLeCadre(p: Point): Point {
  const { latMin, latMax, lonMin, lonMax } = DANS_LA_FRANCE
  const borne = (x: number, min: number, max: number) => Math.min(max - 1e-6, Math.max(min + 1e-6, x))
  return { lat: borne(p.lat, latMin, latMax), lon: borne(p.lon, lonMin, lonMax) }
}

// ── Une partie, geste à geste ─────────────────────────────────────────────

/**
 * Ce que veut le joueur de cette partie : atteindre un seuil, dorer, les
 * étoiles (une partie libre qui paie sa poussière), ou les confettis — une
 * partie libre au-delà de la cinquième ne paie plus que ses pièces justes, et
 * qui la joue pour elles parie toujours au Pari : chaque pari ajoute une pièce.
 */
interface Objectif {
  seuil: number | null
  dorer: boolean
  confettis?: true
}

/** Ce qu'une mesure dit d'un jeu, pour un joueur, sans carte : ce que miser y vaudrait. */
interface Allure {
  parfaites: number
  moyenne: number
}

/** Une partie qu'un joueur mène, à l'heure du serveur : chaque geste arrive après le temps qu'il met, et le vrai pli le juge. */
class Partie {
  e: EtatDeLaPartie = P.ETAT_DU_DEPART
  t: number
  readonly debut: number
  readonly savoirs = new Map<number, unknown>()
  enRetard = 0
  constructor(
    readonly d: DepartDUnePartie,
    readonly j: Joueur,
    readonly r: Hasard,
    t0: number,
    readonly objectif: Objectif,
  ) {
    this.t = t0
    this.debut = t0
  }

  /** Ce qu'il sait d'un contenu, tiré la première fois qu'il le voit : Changer en montre un autre. */
  savoir<T>(tirage: number, tirer: () => T): T {
    if (!this.savoirs.has(tirage)) this.savoirs.set(tirage, tirer())
    return this.savoirs.get(tirage) as T
  }
  oui = (p: number) => this.r() < p

  get manche() {
    return P.mancheEnCours(this.e)!
  }
  tiree<T>(): T {
    return this.d.tirages[this.manche.tirage] as T
  }
  vue<T>(): T {
    const m = this.manche
    return regleDe(this.d.jeu).montrer(this.d.tirages[m.tirage], m.etat) as T
  }
  tranchee = () => this.e.fin !== null || this.manche.verdict !== null

  /** Le geste tel que la page l'envoie, joué par le vrai pli : un refus serait une erreur du calibrage. */
  private jouer(g: GesteDuCabinet) {
    const apres = P.jouerUnGeste(this.d, this.e, g, Math.round(this.t))
    if (typeof apres === 'string') throw new Error(`${this.d.jeu}, manche ${'manche' in g ? g.manche : '?'} : ${JSON.stringify(g)} refusé — ${apres}`)
    this.e = apres
  }

  /**
   * Un geste, après le temps qu'il met à le faire. S'il arrive après
   * l'échéance et sa grâce, la page a envoyé d'elle-même, à l'échéance, ce
   * qu'elle avait sous les yeux (`aLEcheance`) : l'épingle posée, la frise
   * rangée, le curseur — ou rien. Faux s'il est arrivé trop tard.
   */
  geste(g: GesteDuCabinet, secondes: number, aLEcheance?: (echeance: number) => ReponseDUnJeu | undefined): boolean {
    const m = P.mancheEnCours(this.e)
    // Une manche déjà tranchée — l'échéance passée pendant un geste d'avant — ne prend plus rien.
    if (g.quoi !== 'ouvrir' && 'manche' in g && (this.e.fin !== null || m?.verdict)) return false
    const arrivee = this.t + secondes * 1000 * this.j.vitesse * Math.exp(0.3 * normale(this.r))
    if (m && m.verdict === null && 'manche' in g && P.leChronoCourt(m)) {
      const etape = P.etapeEnCours(m)
      const echeance = echeanceDe(etape, arrivee)
      if (arrivee > echeance + etape.graceMs) {
        this.t = echeance + 300
        const reponse = aLEcheance?.(echeance)
        this.jouer({ quoi: 'repondre', manche: g.manche, auto: true, ...(reponse && { reponse }) })
        this.enRetard++
        return false
      }
    }
    this.t = arrivee
    this.jouer(g)
    return true
  }
  repondre(m: Manche, reponse: ReponseDUnJeu, secondes: number, gardee = false): boolean {
    return this.geste({ quoi: 'repondre', manche: m, reponse }, secondes, gardee ? () => reponse : undefined)
  }

  /** Un pouvoir se joue-t-il maintenant ? La règle du pli, jamais une recopie (`pouvoirMaintenant`). */
  peut(pouvoir: CleDePouvoir): boolean {
    if (this.d.carte?.pouvoir !== pouvoir || this.objectif.dorer) return false
    return P.pouvoirMaintenant(this.d, this.e, Math.round(this.t))?.jouable === true
  }
  eclairer(m: Manche, affirmation?: number) {
    this.geste({ quoi: 'eclairer', manche: m, ...(affirmation !== undefined && { affirmation }) }, SECONDES.pouvoir)
  }
  /** Changer, s'il sait qu'il ne sait pas : vrai si la manche a changé de contenu. */
  changer(m: Manche, neSaitPas: boolean): boolean {
    if (!neSaitPas || !this.peut('changer')) return false
    return this.geste({ quoi: 'changer', manche: m }, SECONDES.pouvoir)
  }
  /** Une proposition parmi celles qui ne sont pas effacées. */
  parmi(n: number, effacees: readonly number[]): number {
    return auHasard(
      Array.from({ length: n }, (_, k) => k).filter(k => !effacees.includes(k)),
      this.r,
    )
  }
  /**
   * Sa réponse à une question de la base qu'il ne sait pas : juste à la chance
   * de sa marche (`devineJuste`), que chaque réponse effacée par Éclairer
   * relève d'autant — deux restantes, deux fois plus de chances qu'à quatre.
   */
  devine(q: QuestionTiree, effacees: readonly number[]): number {
    const restantes = q.reponses.length - effacees.length
    if (this.oui(Math.min(1, (devineJuste(this.j, q.niveau, q.reponses.length) * q.reponses.length) / restantes))) return q.bonne
    return auHasard(
      q.reponses.map((_, k) => k).filter(k => k !== q.bonne && !effacees.includes(k)),
      this.r,
    )
  }
  /** Les étoiles déjà gagnées, après les pouvoirs : le Pari en lit son choix. */
  etoilesAvant(m: Manche): number {
    return P.etoilesDesManches(this.d, this.e)
      .slice(0, m)
      .reduce((n, x) => n + (x.etoiles ?? 0), 0)
  }
}

/** Le Pari : sa réponse, puis garder ou parier — le choix qui l'approche le plus de son seuil. */
function mancheDuPari(p: Partie, m: Manche): void {
  const t = p.tiree<PariTire>()
  const s = p.savoir(p.manche.tirage, () => ({ q1: p.oui(sait(p.j, t.q1.niveau)), q2: p.oui(sait(p.j, t.q2.niveau)) }))
  if (p.changer(m, !s.q1)) return mancheDuPari(p, m)
  if (!s.q1 && p.peut('eclairer')) p.eclairer(m)
  const choix1 = s.q1 ? t.q1.bonne : p.devine(t.q1, p.vue<PariMontre>().effacees)
  if (!p.repondre(m, { pari: { choix: choix1 } }, SECONDES.pariQuestion) || p.tranchee()) return
  if (!parier(p, m)) {
    p.geste({ quoi: 'garder', manche: m }, SECONDES.pariChoix)
    return
  }
  p.geste({ quoi: 'parier', manche: m }, SECONDES.pariChoix)
  if (!s.q2 && p.peut('eclairer')) p.eclairer(m)
  const choix2 = s.q2 ? t.q2.bonne : p.devine(t.q2, p.vue<PariMontre>().effacees)
  p.repondre(m, { pari: { choix: choix2 } }, SECONDES.pariQuestion)
}

/**
 * Garder ou parier : pour dorer, parier toujours (trois parfaites), et pour les
 * confettis aussi (une pièce de plus) ; en partie libre, parier quand le pari
 * rapporte plus que l'étoile gardée ; vers un
 * seuil, le choix qui lui donne le plus de chances de l'atteindre, les
 * manches qui restent comprises — garder trois fois ne fait que trois étoiles.
 */
function parier(p: Partie, m: Manche): boolean {
  if (p.objectif.dorer || p.objectif.confettis) return true
  const p1 = surLesMarches(p.j, MARCHES_DU_PARI.question)
  const p2 = surLesMarches(p.j, MARCHES_DU_PARI.pari)
  const { garder, parier: pari } = ETOILES_DU_PARI
  const seuil = p.objectif.seuil
  if (seuil === null) return p2 * pari > garder
  const memo = new Map<string, number>()
  const V = (reste: number, s: number): number => {
    if (reste === 0) return s >= seuil ? 1 : 0
    const cle = `${reste}:${s}`
    if (!memo.has(cle)) memo.set(cle, p1 * Math.max(V(reste - 1, s + garder), p2 * V(reste - 1, s + pari) + (1 - p2) * V(reste - 1, s)) + (1 - p1) * V(reste - 1, s))
    return memo.get(cle)!
  }
  const reste = MANCHES_PAR_PARTIE - 1 - m
  const s = p.etoilesAvant(m)
  return p2 * V(reste, s + pari) + (1 - p2) * V(reste, s) > V(reste, s + garder)
}

/** L'Éclair : cinq affirmations ; il dit ce qu'il sait, devine le reste, et souffle d'abord ce qu'il ignore. */
function mancheDeLEclair(p: Partie, m: Manche): void {
  const t = p.tiree<EclairTire>()
  const s = p.savoir(p.manche.tirage, () => t.affirmations.map(a => p.oui(sait(p.j, a.question.niveau))))
  if (p.changer(m, s.filter(x => !x).length >= 3)) return mancheDeLEclair(p, m)
  for (let i = 0; i < s.length; i++) if (!s[i] && p.peut('eclairer')) p.eclairer(m, i)
  const soufflees = new Map(p.vue<EclairMontre>().soufflees.map(x => [x.affirmation, x.vraie]))
  const reponses = t.affirmations.map((a, i) => soufflees.get(i) ?? (s[i] ? a.proposee === a.question.bonne : p.r() < 0.5))
  const parAffirmation = SECONDES.eclairAffirmation * p.j.vitesse * 1000
  // À l'échéance, la page envoie celles qu'il a eu le temps de dire.
  p.geste({ quoi: 'repondre', manche: m, reponse: { eclair: { reponses } } }, SECONDES.eclairAffirmation * reponses.length, echeance => {
    const dites = Math.max(0, Math.min(reponses.length, Math.floor((echeance - p.manche.etapes[0].ouverteLe) / parAffirmation)))
    return { eclair: { reponses: reponses.map((x, i) => (i < dites ? x : null)) } }
  })
}

/** Le Mot mystère : le mot s'il le sait ; sinon des essais, et le mot trouvé aux couleurs, s'il le déduit. */
function mancheDuMot(p: Partie, m: Manche): void {
  const t = p.tiree<MotTire>()
  const s = p.savoir(p.manche.tirage, () => p.oui(sait(p.j, t.question.niveau)))
  if (p.changer(m, !s)) return mancheDuMot(p, m)
  const faux = () => {
    for (;;) {
      const x = motAuHasard(t.lettres.length, p.r)
      if (x !== t.lettres) return x
    }
  }
  if (s) {
    p.geste({ quoi: 'essai', manche: m, lettres: t.lettres }, SECONDES.motEssai)
    return
  }
  if (p.peut('eclairer')) p.eclairer(m)
  const soufflees = p.vue<MotMontre>().soufflees.length
  const deduit = p.j.theta !== null && p.oui(chance(MODELE.motDeduit, p.j.theta + MODELE.motParLettre * soufflees))
  const trouveA = deduit ? 3 + selon(MODELE.motAuxEssais, p.r) : 0
  for (let essai = 1; essai <= BAREME.ESSAIS_DU_MOT && !p.tranchee(); essai++) {
    if (!p.geste({ quoi: 'essai', manche: m, lettres: essai === trouveA ? t.lettres : faux() }, SECONDES.motEssai)) return
  }
}

/** Le Filet : son estimation, puis le filet qui lui rapporte le plus en moyenne à ce qu'il sait d'elle. */
function mancheDuFilet(p: Partie, m: Manche): void {
  const t = p.tiree<FiletTire>()
  const s = p.savoir(p.manche.tirage, () => p.oui(part(p.j, MODELE.filetSait)))
  if (p.changer(m, !s)) return mancheDuFilet(p, m)
  if (!s && p.peut('eclairer')) p.eclairer(m)
  const { piste, zone } = p.vue<FiletMontre>()
  const longueur = piste.max - piste.min
  const flou = p.j.theta === null ? Infinity : s ? MODELE.filetPrecis : MODELE.filetFlou * Math.exp(-0.3 * p.j.theta)
  let x = p.j.theta === null ? piste.min + p.r() * longueur : t.valeur + normale(p.r) * flou * longueur
  // Éclairé, il garde son estimation dans la zone dorée ; elle y borne son écart.
  const ecart = zone ? Math.min(flou, ZONE_DU_FILET / Math.sqrt(12)) : flou
  if (zone) x = Math.min(Math.max(x, zone.de), zone.a)
  const surLePas = Number((piste.min + Math.round((Math.min(Math.max(x, piste.min), piste.max) - piste.min) / piste.pas) * piste.pas).toFixed(decimales(piste.pas)))
  const lance = Math.min(Math.max(surLePas, piste.min), piste.max)
  const tailles = Object.keys(LARGEURS_DU_FILET) as TailleDuFilet[]
  const vaut = (taille: TailleDuFilet) => ETOILES_DU_FILET[taille] * (Number.isFinite(ecart) ? erf(LARGEURS_DU_FILET[taille] / (ecart * Math.SQRT2)) : 2 * LARGEURS_DU_FILET[taille])
  const taille = tailles.reduce((a, b) => (vaut(b) > vaut(a) ? b : a))
  p.repondre(m, { filet: { x: lance, taille } }, SECONDES.filet, true)
}

/** Le Détail : il répond au cadrage où il reconnaît ; sinon il recule tant que reculer vaut mieux que deviner. */
function mancheDuDetail(p: Partie, m: Manche): void {
  const t = p.tiree<DetailTire>()
  const s = p.savoir(p.manche.tirage, () => ({ reconnu: p.oui(part(p.j, MODELE.detailReconnu)), au: 1 + selon(MODELE.detailAuCadrage, p.r) }))
  if (p.changer(m, !(s.reconnu && s.au === 1))) return mancheDuDetail(p, m)
  let eclaire = false
  while (!p.tranchee()) {
    const v = p.vue<DetailMontre>()
    if (s.reconnu && v.cadrage >= s.au) {
      p.repondre(m, { detail: { titre: t.bonne } }, SECONDES.detailRegard)
      return
    }
    if (!eclaire && p.peut('eclairer')) {
      p.eclairer(m)
      eclaire = true
      continue
    }
    const restants = v.titres.filter(x => !x.efface).length
    // Ce qu'il sait de lui : reconnaître au cadrage suivant, sachant qu'il n'a pas reconnu jusqu'ici.
    const R = part(p.j, MODELE.detailReconnu)
    const deja = MODELE.detailAuCadrage.slice(0, v.cadrage).reduce((a, b) => a + b, 0)
    const ensuite = (R * (MODELE.detailAuCadrage[v.cadrage] ?? 0)) / Math.max(1e-9, 1 - R * deja)
    const plusTard = ETOILES_AU_CADRAGE[v.cadrage] ?? 0
    const reculer = v.peutReculer && !p.objectif.dorer && ensuite * plusTard + (1 - ensuite) * (plusTard / restants) > v.vaut / restants
    if (!reculer) {
      p.repondre(m, { detail: { titre: p.parmi(v.titres.length, v.titres.flatMap((x, k) => (x.efface ? [k] : []))) } }, SECONDES.detailRegard)
      return
    }
    if (!p.geste({ quoi: 'reculer', manche: m }, SECONDES.detailRegard)) return
  }
}

/** La Frise : chaque nouveau venu à l'année qu'il lui prête — la vraie s'il la sait —, parmi les ancres. */
function mancheDeLaFrise(p: Partie, m: Manche): void {
  const t = p.tiree<FriseTiree>()
  const annees = t.evenements.map(e => e.annee)
  const etendue = Math.max(...annees) - Math.min(...annees)
  // Une seule frise pour les trois manches : ce qu'il en sait vaut pour toute la partie.
  const estimees = p.savoir(0, () => annees.map(a => (p.j.theta !== null && p.oui(part(p.j, MODELE.friseSait)) ? a : a + normale(p.r) * MODELE.friseFlou * etendue * Math.exp(-0.3 * (p.j.theta ?? 0)))))
  const nouveaux = t.vagues[t.vague]
  if (p.j.theta !== null && nouveaux.some(rg => estimees[rg] !== annees[rg]) && p.peut('eclairer')) p.eclairer(m)
  const v = p.vue<FriseMontree>()
  let ordre: number[]
  if (p.j.theta === null) {
    ordre = v.ancres.map(a => a.jeton)
    for (const n of battre(v.nouveaux, p.r)) ordre.splice(Math.floor(p.r() * (ordre.length + 1)), 0, n.jeton)
  } else {
    const poses = [
      ...v.ancres.map(a => ({ jeton: a.jeton, annee: a.annee, ancre: 0 })),
      ...v.nouveaux.map((n, i) => ({ jeton: n.jeton, annee: n.annee ?? estimees[nouveaux[i]], ancre: 1 })),
    ]
    ordre = poses.sort((a, b) => a.annee - b.annee || a.ancre - b.ancre).map(x => x.jeton)
  }
  p.repondre(m, { frise: { ordre } }, SECONDES.friseBase + SECONDES.friseParVenu * v.nouveaux.length, true)
}

/** L'Épingle : le lieu s'il le sait, sa région sinon, ou n'importe où — et au centre de la zone éclairée. */
function mancheDeLEpingle(p: Partie, m: Manche): void {
  const t = p.tiree<EpingleTiree>()
  const s = p.savoir(p.manche.tirage, () => ({ lieu: p.oui(part(p.j, MODELE.epingleSait)), region: p.oui(part(p.j, MODELE.epingleRegion)) }))
  if (p.changer(m, !s.lieu && !s.region)) return mancheDeLEpingle(p, m)
  if (!s.lieu && p.peut('eclairer')) p.eclairer(m)
  const { zone } = p.vue<EpingleMontree>()
  const autour = (km: () => number): Point => {
    for (let essai = 0; essai < 30; essai++) {
      const x = pointADistance(t.lieu, km(), p.r() * 360)
      if (dansLaFrance(x)) return x
    }
    return pointDeFrance(p.r)
  }
  const [pres, loin] = MODELE.epingleRegionKm
  const epingle =
    p.j.theta === null
      ? pointDeFrance(p.r)
      : s.lieu
        ? autour(() => -MODELE.epinglePresKm * Math.log(1 - p.r()))
        : zone
          ? dansLeCadre({ lat: zone.lat, lon: zone.lon })
          : s.region
            ? autour(() => pres + p.r() * (loin - pres))
            : pointDeFrance(p.r)
  p.repondre(m, { epingle }, SECONDES.epingle, true)
}

/** Les Indices : un indice de plus jusqu'à reconnaître la personne ; au hasard, des noms d'autres fiches. */
function mancheDesIndices(p: Partie, m: Manche): void {
  const t = p.tiree<IndicesTires>()
  const s = p.savoir(p.manche.tirage, () => ({ reconnu: p.oui(part(p.j, MODELE.indicesReconnu)), au: 1 + selon(MODELE.indicesAuRang, p.r) }))
  if (p.changer(m, !s.reconnu)) return mancheDesIndices(p, m)
  if (p.j.theta !== null && p.peut('eclairer')) p.eclairer(m)
  const essayes = new Set<string>()
  const unAutreNom = () => {
    const restants = FICHES.filter(f => !essayes.has(f.reponse) && (p.j.theta === null || f.id !== t.fiche.id))
    const nom = auHasard(restants, p.r).reponse
    essayes.add(nom)
    return nom
  }
  while (!p.tranchee()) {
    const v = p.vue<IndicesMontres>()
    const ok =
      p.j.theta === null
        ? p.geste({ quoi: 'nom', manche: m, texte: unAutreNom() }, SECONDES.indiceNom)
        : s.reconnu && v.indices.length >= s.au
          ? p.geste({ quoi: 'nom', manche: m, texte: t.fiche.reponse }, SECONDES.indiceNom)
          : v.caches > 0
            ? p.geste({ quoi: 'indice', manche: m }, SECONDES.indiceLu)
            : p.geste({ quoi: 'nom', manche: m, texte: unAutreNom() }, SECONDES.indiceNom)
    if (!ok) return
  }
}

/** La Réplique : le mot, puis qui l'a dite — ce qu'il sait, ou parmi ce qu'Éclairer laisse. */
function mancheDeLaReplique(p: Partie, m: Manche): void {
  const t = p.tiree<RepliqueTiree>()
  const s = p.savoir(p.manche.tirage, () => {
    const mot = p.oui(part(p.j, MODELE.repliqueMot))
    return { mot, qui: p.j.theta !== null && p.oui(mot ? MODELE.repliqueQuiSiMot : part(p.j, MODELE.repliqueQui)) }
  })
  if (p.changer(m, !s.mot)) return mancheDeLaReplique(p, m)
  if (!s.mot && p.peut('eclairer')) p.eclairer(m)
  const auMot = p.vue<RepliqueMontreeAuMot>()
  const choix = s.mot ? t.bonMot : p.parmi(t.mots.length, auMot.mots.flatMap((x, k) => (x.efface ? [k] : [])))
  p.geste({ quoi: 'mot', manche: m, choix }, SECONDES.repliqueEtape)
  if (p.tranchee()) return
  if (!s.qui && p.peut('eclairer')) p.eclairer(m)
  const aQui = p.vue<RepliqueMontreeAQui>()
  const qui = s.qui ? t.bonneQui : p.parmi(t.personnes.length, aQui.personnes.flatMap((x, k) => (x.efface ? [k] : [])))
  p.repondre(m, { replique: { qui } }, SECONDES.repliqueEtape)
}

const MANCHES: { readonly [J in CleDeJeu]: (p: Partie, m: Manche) => void } = {
  pari: mancheDuPari,
  eclair: mancheDeLEclair,
  mot: mancheDuMot,
  filet: mancheDuFilet,
  detail: mancheDuDetail,
  frise: mancheDeLaFrise,
  epingle: mancheDeLEpingle,
  indices: mancheDesIndices,
  replique: mancheDeLaReplique,
}

/** Une partie jouée : son état final, ce qu'elle a duré, ses pièces justes. */
interface PartieJouee {
  depart: DepartDUnePartie
  etat: EtatDeLaPartie
  secondes: number
  justes: number
  enRetard: number
}

/**
 * Une partie entière : chaque manche ouverte — misée avant d'être vue, si la
 * mise y vaut plus que ce qu'il y gagne d'ordinaire —, jouée, révélée.
 */
function jouerLaPartie(d: DepartDUnePartie, j: Joueur, r: Hasard, t0: number, objectif: Objectif, allure: Allure | null): PartieJouee {
  const p = new Partie(d, j, r, t0 + SECONDES.annonce * 1000, objectif)
  for (let m = 0 as Manche; m < MANCHES_PAR_PARTIE; m = (m + 1) as Manche) {
    const carte = d.carte
    const miser = carte?.pouvoir === 'miser' && allure !== null && p.peut('miser') && allure.parfaites * (3 + BONUS_DE_MISE[carte.force]) > allure.moyenne
    p.geste({ quoi: 'ouvrir', manche: m, ...(miser && { miser: true as const }) }, 0)
    MANCHES[d.jeu](p, m)
    if (!P.mancheEnCours(p.e)?.verdict) throw new Error(`${d.jeu} : la manche ${m} ne s'est pas tranchée`)
    p.t += SECONDES.revelation * 1000
  }
  if (!p.e.fin) throw new Error(`${d.jeu} : la partie ne s'est pas finie`)
  return { depart: d, etat: p.e, secondes: (p.t - t0) / 1000 + SECONDES.bilan, justes: p.e.pieces.filter(x => x.juste).length, enRetard: p.enRetard }
}

// ── Ce que vaut un jeu, et chaque carte-bonus à ce jeu ────────────────────

/** Ce que des parties d'un jeu ont donné : les totaux, les cadres dorés, les justes, le temps, les manches parfaites. */
interface Mesure {
  parties: number
  totaux: number[]
  dorees: number
  justes: number
  secondes: number
  parfaites: number
  etoiles: number
  enRetard: number
}

const MESURES_FAITES = new Map<string, Mesure>()
const T_MESURE = Date.UTC(2027, 1, 1, 18)
const JOUR_MESURE = jourDe(T_MESURE)
type CarteMesuree = { pouvoir: CleDePouvoir; force: Force } | null

/** La carte-bonus d'une mesure : une œuvre, ou un gardien, qui a ce pouvoir à cette force — le pli ne lit que les deux. */
function carteDe(c: CarteMesuree): CarteDuDepart | null {
  if (!c) return null
  const cle = [...OEUVRES.map(o => o.cle as string), ...GARDIENS].find(k => pouvoirDe(k) === c.pouvoir && forceDe(k) === c.force)
  if (!cle) throw new Error(`aucune carte-bonus ne ${c.pouvoir} à la force ${c.force}`)
  return { cle, pouvoir: c.pouvoir, force: c.force }
}

/** Les trois objectifs d'une partie qu'on mesure : un seuil, dorer, ou les étoiles (`LIBRE`). */
const LIBRE: Objectif = { seuil: null, dorer: false }
const DORER: Objectif = { seuil: null, dorer: true }
const CONFETTIS: Objectif = { seuil: null, dorer: false, confettis: true }
const versLeSeuil = (seuil: number): Objectif => ({ seuil, dorer: false })

/**
 * Ce que vaut un jeu pour ce joueur, avec cette carte, vers cet objectif : des
 * parties libres, jouées comme il les jouerait — le Pari ne se joue pas pareil
 * vers cinq étoiles ou vers sept, le Détail pas pareil pour dorer. Gardée : un
 * joueur qui choisit sa carte-bonus relit ce qu'il a déjà mesuré.
 */
function mesurer(j: Joueur, jeu: CleDeJeu, c: CarteMesuree, objectif: Objectif, n = MESURES): Mesure {
  const cle = `${cleDuSavoir(j)}|${jeu}|${c ? `${c.pouvoir}${c.force}` : '-'}|${objectif.dorer ? 'dorer' : objectif.confettis ? 'confettis' : (objectif.seuil ?? 'libre')}|${n}`
  const deja = MESURES_FAITES.get(cle)
  if (deja) return deja
  const r = hasardDe(`${GRAINE}:mesure:${cle}`)
  const carte = carteDe(c)
  const allure = objectif.dorer || carte?.pouvoir !== 'miser' ? null : allureDe(j, jeu)
  const x: Mesure = { parties: 0, totaux: Array(ETOILES_D_UNE_PARTIE + 1).fill(0), dorees: 0, justes: 0, secondes: 0, parfaites: 0, etoiles: 0, enRetard: 0 }
  for (let i = 0; i < n; i++) {
    const d = departDu({ jeu, origine: 'libre', cible: null, but: null, seuil: null, payee: false, carte }, JOUR_MESURE, r)
    const jouee = jouerLaPartie(d, j, r, T_MESURE, objectif, allure)
    const res = P.resultatDe(d, jouee.etat)
    x.parties++
    x.totaux[res.total]++
    if (res.cadreDore) x.dorees++
    x.justes += jouee.justes
    x.secondes += jouee.secondes
    x.parfaites += res.naturel.filter(k => k === 3).length
    x.etoiles += res.naturel.reduce((a, b) => a + b, 0)
    x.enRetard += jouee.enRetard
  }
  MESURES_FAITES.set(cle, x)
  return x
}
/** Ce que miser vaudrait : la part des manches parfaites, et les étoiles d'une manche, sans carte. */
const allureDe = (j: Joueur, jeu: CleDeJeu): Allure => {
  const x = mesurer(j, jeu, null, LIBRE)
  return { parfaites: x.parfaites / (3 * x.parties), moyenne: x.etoiles / (3 * x.parties) }
}
const auMoins = (x: Mesure, seuil: number) => x.totaux.slice(seuil).reduce((a, b) => a + b, 0) / x.parties
const moyenneDe = (x: Mesure) => x.totaux.reduce((n, k, total) => n + k * total, 0) / x.parties

// ── Le musée d'un joueur, jour après jour ─────────────────────────────────

/** Une arrivée au Cabinet : un profil neuf, ou un explorateur qui rapporte les œuvres de son codex. */
interface Arrivee {
  nom: string
  oeuvres: readonly CleDOeuvre[]
}
/**
 * Ce qu'un explorateur rapporte : les œuvres que son codex ouvre (la version 9
 * des huit familles, celle des plus vieux départs, sans exploit) — trente au
 * niveau 3, soixante au niveau 6. La migration (lot C5) prend l'union des
 * codex de ses départs : celui du plus haut niveau atteint en est la part
 * sûre.
 */
const rapportees = (niveau: number) => codexDuNiveau(niveau, [], [], VERSION_DES_HUIT_FAMILLES).cartes.filter(estUneOeuvre)
const TOUTES_LES_ARRIVEES: readonly Arrivee[] = [
  { nom: 'neuf', oeuvres: [] },
  { nom: '30', oeuvres: rapportees(3) },
  { nom: '60', oeuvres: rapportees(6) },
]
const filtreDesArrivees = liste('arrivees')
const ARRIVEES = filtreDesArrivees ? TOUTES_LES_ARRIVEES.filter(a => filtreDesArrivees.includes(a.nom)) : TOUTES_LES_ARRIVEES

interface Parcours {
  toutPossede: number | null
  toutDore: number | null
  /** Le jour où chaque gardien s'est réveillé — 0 : dès l'arrivée. */
  gardiens: number[]
  joursJoues: number
  poussiere: number
  /** Les parties, leurs justes et leurs minutes, par origine. */
  parOrigine: Record<OrigineDUnePartie, { parties: number; justes: number; secondes: number }>
  xp: number
  gagnees: number
  achetees: number
  doreesEnJouant: number
  doreesALaPoussiere: number
  /** Jusqu'à tout posséder : la poussière et les jours joués, ce que la page promet d'abord. */
  poussiereAvant: number
  joursAvant: number
}

const JOUR_MS = 24 * 3_600_000
/** Le premier soir de chaque parcours : un lundi de février, loin des fêtes — le calendrier des saisons n'y joue pas. */
const T0 = Date.UTC(2027, 1, 1, 18)

function parcourir(j: Joueur, arrivee: Arrivee, k: number): Parcours {
  const r = hasardDe(`${GRAINE}:parcours:${j.nom}:${arrivee.nom}:${k}`)
  const graineDeLaVisite = `${GRAINE}:visite:${j.nom}:${arrivee.nom}:${k}`
  const lignes = new Map<string, LigneDOeuvre>()
  const ligne = (cle: string, o: Partial<LigneDOeuvre> & Pick<LigneDOeuvre, 'origine' | 'gagneeLe'>): LigneDOeuvre => ({
    oeuvre: cle,
    saison: null,
    serieId: null,
    prix: null,
    doreeLe: null,
    dorure: null,
    prixDorure: null,
    serieDoree: null,
    ...o,
  })
  for (const cle of arrivee.oeuvres) lignes.set(cle, ligne(cle, { origine: 'expedition', gagneeLe: T0 - JOUR_MS }))
  let profil: LigneDuProfil | null = null
  const legendaires = new Set<string>()
  let parties: PartieDuJour[] = []
  let jour = jourDe(T0)
  const musee = (): Musee => M.museeDe({ jour, profil, oeuvres: [...lignes.values()], parties, legendaires, enCours: null })
  const x: Parcours = {
    toutPossede: null,
    toutDore: null,
    gardiens: [],
    joursJoues: 0,
    poussiere: 0,
    parOrigine: { visite: { parties: 0, justes: 0, secondes: 0 }, chasse: { parties: 0, justes: 0, secondes: 0 }, libre: { parties: 0, justes: 0, secondes: 0 } },
    xp: 0,
    gagnees: 0,
    achetees: 0,
    doreesEnJouant: 0,
    doreesALaPoussiere: 0,
    poussiereAvant: 0,
    joursAvant: 0,
  }
  let jourDuParcours = 0
  /** La réconciliation : chaque gardien dû et pas encore réveillé se réveille — rien ne se reprend. */
  const reconcilier = () => {
    for (const g of M.gardiensDus(musee())) {
      if (legendaires.has(g.legendaire)) continue
      legendaires.add(g.legendaire)
      x.gardiens.push(jourDuParcours)
    }
  }
  reconcilier()

  // Ce qu'il sait de ses chances, d'une carte-bonus à l'autre : la mesure, gardée.
  const cartesDe = (m: Musee): CarteMesuree[] => {
    const vues = new Map<string, CarteMesuree>([['-', null]])
    for (const cle of [...M.possedees(m), ...[...legendaires].filter(l => pouvoirDuGardien(l))]) {
      const pouvoir = pouvoirDe(cle)
      const force = forceDe(cle)
      if (pouvoir && force) vues.set(`${pouvoir}${force}`, { pouvoir, force })
    }
    return [...vues.values()]
  }
  const meilleure = (m: Musee, jeu: CleDeJeu, but: 'gagner' | 'dorer' | 'libre', seuil: number | null): { carte: CarteMesuree; vaut: number } => {
    let mieux: { carte: CarteMesuree; vaut: number } = { carte: null, vaut: -1 }
    for (const c of cartesDe(m)) {
      // Pour dorer, seul ce qui n'ôte pas le cadre doré : Protéger et le temps en plus n'agissent qu'à une manche imparfaite, ou au-delà du temps normal.
      if (but === 'dorer' && c && c.pouvoir !== 'proteger' && c.pouvoir !== 'temps') continue
      const mesure = mesurer(j, jeu, c, but === 'dorer' ? DORER : but === 'libre' ? LIBRE : versLeSeuil(seuil!))
      const vaut = but === 'dorer' ? mesure.dorees / mesure.parties : but === 'libre' ? moyenneDe(mesure) : auMoins(mesure, seuil!)
      if (vaut > mieux.vaut + 1e-9) mieux = { carte: c, vaut }
    }
    return mieux
  }
  const cleDeLaCarte = (m: Musee, c: CarteMesuree): string | null => {
    if (!c) return null
    return [...M.possedees(m), ...legendaires].find(cle => pouvoirDe(cle) === c.pouvoir && forceDe(cle) === c.force) ?? null
  }

  /** Le premier lot du jour qui écrit, comme celui du départ : la ligne du profil, la série, la visite figée. */
  const premierLotDuJour = (v: VisiteDuJour, compte: boolean) => {
    const veille = jourAvant(jour)
    const gelees = M.visitesAGarder(v, profil?.visites ?? [])
    if (!profil) {
      profil = { poussiere: 0, serie: compte ? 1 : 0, serieJour: compte ? jour : null, serieRecord: compte ? 1 : 0, visites: gelees, partie: null }
      return
    }
    const serie = !compte || (profil.serieJour ?? '') >= jour ? profil.serie : profil.serieJour === veille ? profil.serie + 1 : 1
    profil = {
      ...profil,
      serie,
      serieJour: compte ? ((profil.serieJour ?? '') > jour ? profil.serieJour : jour) : profil.serieJour,
      serieRecord: Math.max(profil.serieRecord, serie),
      visites: profil.visites[0]?.jour === jour ? profil.visites : gelees,
    }
  }

  /** Une partie, de la demande à son bilan : le cadre que le musée accepte, le plan, le jeu, puis ce que le lot de fin écrit. */
  const jouer = (demande: Parameters<typeof M.cadreDuDepart>[1], v: VisiteDuJour, t: number, objectif: Objectif): number => {
    const m = musee()
    const cadre = M.cadreDuDepart(m, demande, v, CLES_DES_JEUX)
    if (typeof cadre === 'string') throw new Error(`${j.nom} : départ refusé (${JSON.stringify(demande)}) — ${cadre}`)
    premierLotDuJour(v, cadre.origine !== 'libre')
    const d = departDu(cadre, jour, r)
    const allure = d.carte?.pouvoir === 'miser' ? allureDe(j, d.jeu) : null
    const jouee = jouerLaPartie(d, j, r, t, objectif, allure)
    const apres = musee()
    const cible = d.cible as CleDOeuvre | null
    const aLui = cible ? { possedee: M.possedees(apres).has(cible), doree: M.dorees(apres).has(cible) } : null
    const bilan = P.bilanDe(d, jouee.etat, aLui)
    const fin = t + jouee.secondes * 1000
    const id = `${GRAINE}:${numero++}`
    const ecrire = (issue: IssueDUnePartie) => {
      if (!cible) return
      const avant = lignes.get(cible)
      if (issue === 'gagnee' || issue === 'gagnee-doree') {
        const doree = issue === 'gagnee-doree'
        lignes.set(cible, ligne(cible, { origine: 'partie', gagneeLe: fin, serieId: id, ...(doree && { doreeLe: fin, dorure: 'partie' as const, serieDoree: id }) }))
        x.gagnees++
        if (doree) x.doreesEnJouant++
      } else if (issue === 'doree') {
        lignes.set(cible, { ...(avant ?? ligne(cible, { origine: 'depart', gagneeLe: fin })), doreeLe: fin, dorure: 'partie', serieDoree: id })
        x.doreesEnJouant++
      }
    }
    ecrire(bilan.issue)
    profil = { ...profil!, poussiere: profil!.poussiere + bilan.poussiere }
    parties = [...parties, { id, commenceeLe: t, finieLe: fin, issue: bilan.issue, origine: d.origine, visite: d.visite ?? null, jeu: d.jeu, cible: d.cible, payee: d.payee, total: bilan.total }]
    x.poussiere += bilan.poussiere
    if (x.toutPossede === null) x.poussiereAvant += bilan.poussiere
    const o = x.parOrigine[d.origine]
    o.parties++
    o.justes += jouee.justes
    o.secondes += jouee.secondes
    reconcilier()
    return fin + 20_000
  }

  const seuilDe = (cle: CleDOeuvre) => SEUILS_DES_RARETES[oeuvre(cle)!.rarete]
  for (jourDuParcours = 1; jourDuParcours <= JOURS; jourDuParcours++) {
    let t = T0 + (jourDuParcours - 1) * JOUR_MS
    if (r() > j.assiduite) continue
    jour = jourDe(t)
    parties = []
    x.joursJoues++
    if (x.toutPossede === null) x.joursAvant++
    const minuit = minuitDe(t)
    const graine = { graine: graineDeLaVisite, jour, minuit, jeux: CLES_DES_JEUX }
    let v = M.visiteDuJour(musee(), graine)
    const avantLaJournee = x.parOrigine.visite.justes + x.parOrigine.chasse.justes + x.parOrigine.libre.justes

    // L'échange : la case dont le jeu lui va le plus mal, si l'autre jeu lui va mieux.
    if (j.echange) {
      const m = musee()
      const vaut = (jeu: CleDeJeu, cible: CleDOeuvre | null) => (cible ? meilleure(m, jeu, 'gagner', seuilDe(cible)).vaut : 1)
      const pire = v.cases.map((c, i) => ({ i, vaut: vaut(c.jeu, c.cible) })).sort((a, b) => a.vaut - b.vaut)[0]
      const autre = M.jeuDeLEchange(m, v, graine)
      if (pire && autre && M.refusDeLEchange(m, v, pire.i, autre) === null && vaut(autre, v.cases[pire.i].cible) > pire.vaut + 0.05) {
        v = M.visiteEchangee(v, pire.i as Manche, autre)
        premierLotDuJour(v, false)
      }
    }

    // La visite : ses trois cases, chacune vers son seuil — ou pour dorer, la poussière d'un double sinon.
    for (let c = 0; c < v.cases.length; c++) {
      const m = musee()
      const kase = v.cases[c]
      const seuil = kase.cible ? seuilDe(kase.cible) : null
      const but = kase.cible === null ? 'libre' : 'gagner'
      const { carte } = meilleure(m, kase.jeu, but, seuil)
      t = jouer({ origine: 'visite', case: c, carte: cleDeLaCarte(m, carte) }, v, t, { seuil, dorer: false })
    }

    // Les chasses : ce qui lui rapporte le plus en moyenne — une œuvre qui lui manque, « Retenter » une visite manquée, ou une dorure.
    for (let c = 0; c < j.chasses; c++) {
      const m = musee()
      if (M.chassesRestantes(m) === 0) break
      const a = M.possedees(m)
      const dor = M.dorees(m)
      let mieux: { vaut: number; demande: Parameters<typeof M.cadreDuDepart>[1]; objectif: Objectif } | null = null
      const proposer = (vaut: number, demande: Parameters<typeof M.cadreDuDepart>[1], objectif: Objectif) => {
        if (!mieux || vaut > mieux.vaut) mieux = { vaut, demande, objectif }
      }
      for (const o of OEUVRES) {
        if (!a.has(o.cle)) {
          const b = meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'gagner', seuilDe(o.cle))
          proposer(b.vaut * PRIX_D_UNE_OEUVRE[o.rarete], { origine: 'chasse', oeuvre: o.cle, carte: cleDeLaCarte(m, b.carte) }, { seuil: seuilDe(o.cle), dorer: false })
        } else if (!dor.has(o.cle)) {
          const b = meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'dorer', null)
          proposer(b.vaut * PRIX_D_UNE_DORURE[o.rarete], { origine: 'chasse', oeuvre: o.cle, carte: cleDeLaCarte(m, b.carte) }, { seuil: null, dorer: true })
        }
      }
      for (const manquee of parties.filter(pp => pp.origine === 'visite' && pp.issue === 'manquee' && pp.cible && !a.has(pp.cible as CleDOeuvre))) {
        const cle = manquee.cible as CleDOeuvre
        const b = meilleure(m, manquee.jeu, 'gagner', seuilDe(cle))
        proposer(b.vaut * PRIX_D_UNE_OEUVRE[oeuvre(cle)!.rarete], { origine: 'chasse', oeuvre: cle, carte: cleDeLaCarte(m, b.carte), retente: true }, { seuil: seuilDe(cle), dorer: false })
      }
      const choisie = mieux as { vaut: number; demande: Parameters<typeof M.cadreDuDepart>[1]; objectif: Objectif } | null
      if (!choisie) break
      t = jouer(choisie.demande, v, t, choisie.objectif)
    }

    // Les parties libres : le jeu qui lui rapporte le plus d'étoiles, donc de poussière.
    for (let l = 0; l < j.libres; l++) {
      const m = musee()
      const choix = CLES_DES_JEUX.map(jeu => ({ jeu, ...meilleure(m, jeu, 'libre', null) })).sort((a, b) => b.vaut - a.vaut)[0]
      t = jouer({ origine: 'libre', jeu: choix.jeu, carte: cleDeLaCarte(m, choix.carte) }, v, t, { seuil: null, dorer: false })
    }

    // Les achats : ce qu'il a le moins de chances de gagner en jouant, tant que sa poussière le paie ; puis les dorures.
    for (;;) {
      const m = musee()
      const solde = M.soldeDe(m)
      const a = M.possedees(m)
      const manquantes = OEUVRES.filter(o => !a.has(o.cle))
      const sorte = manquantes.length > 0 ? 'achat' : 'dorure'
      const candidates = (sorte === 'achat' ? manquantes : OEUVRES.filter(o => !M.dorees(m).has(o.cle))).filter(o => M.prixDe(o.cle, sorte)! <= solde)
      if (candidates.length === 0) break
      const chanceDe = (o: (typeof OEUVRES)[number]) =>
        sorte === 'achat' ? meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'gagner', seuilDe(o.cle)).vaut : meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'dorer', null).vaut
      const o = candidates.map(c => ({ c, p: chanceDe(c) })).sort((a1, b1) => a1.p - b1.p || M.prixDe(b1.c.cle, sorte)! - M.prixDe(a1.c.cle, sorte)!)[0].c
      const prix = M.prixDe(o.cle, sorte)!
      const refus = M.refusDeLAchat(m, o.cle, prix, sorte)
      if (refus) throw new Error(`${j.nom} : ${sorte} de ${o.cle} refusé — ${refus}`)
      if (sorte === 'achat') {
        lignes.set(o.cle, ligne(o.cle, { origine: 'achat', gagneeLe: t, prix }))
        x.achetees++
      } else {
        lignes.set(o.cle, { ...(lignes.get(o.cle) ?? ligne(o.cle, { origine: 'depart', gagneeLe: t })), doreeLe: t, dorure: 'poussiere', prixDorure: prix })
        x.doreesALaPoussiere++
      }
      reconcilier()
    }

    const justes = x.parOrigine.visite.justes + x.parOrigine.chasse.justes + x.parOrigine.libre.justes - avantLaJournee
    x.xp += xpDuJourDeCampagne(justes)
    const m = musee()
    if (x.toutPossede === null && M.possedees(m).size === OEUVRES.length) x.toutPossede = jourDuParcours
    if (x.toutDore === null && M.dorees(m).size === OEUVRES.length) x.toutDore = jourDuParcours
    // Tout doré, il ne reste que le Scarabée : qui vient chaque jour l'attend encore, l'occasionnel jamais.
    if (x.toutDore !== null && (legendaires.has(SCARABEE) || j.assiduite < 1)) break
  }
  return x
}

// ── La série de la campagne, pour comparer ────────────────────────────────

/** Une série jouée par ce joueur : les marches dans l'ordre d'une vraie série, jusqu'à la troisième erreur. */
function serieDe(j: Joueur, r: Hasard): { justes: number; questions: number } {
  const parNiveau = Object.fromEntries(NIVEAUX.map(n => [n, Array<Niveau>(QUESTIONS_PAR_SERIE).fill(n)])) as Record<Niveau, Niveau[]>
  let vies = VIES
  let justes = 0
  let questions = 0
  for (const { niveau } of ordreDeSerie(parNiveau)) {
    questions++
    if (r() < trouve(j, niveau)) justes++
    else if (--vies === 0) break
  }
  return { justes, questions }
}

// ── L'affichage ───────────────────────────────────────────────────────────

const enPourcent = (x: number) => `${formatNumber(Math.round(x * 1000) / 10)} %`
const arrondi = (x: number, n = 1) => formatNumber(Math.round(x * 10 ** n) / 10 ** n)
const colonnes = (cases: readonly string[], largeurs: readonly number[]) => cases.map((c, i) => (i === 0 ? c.padEnd(largeurs[i]) : c.padStart(largeurs[i]))).join('  ')
function mediane(xs: readonly number[]): number {
  const t = [...xs].sort((a, b) => a - b)
  return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2
}
const jours = (xs: readonly (number | null)[]) => {
  const atteints = xs.filter((x): x is number => x !== null)
  if (atteints.length === 0) return `plus de ${JOURS} j`
  const tous = atteints.length === xs.length
  return `${formatNumber(mediane(atteints))} j (${formatNumber(Math.min(...atteints))}–${formatNumber(Math.max(...atteints))})${tous ? '' : `, ${xs.length - atteints.length} sur ${xs.length} au-delà de ${JOURS} j`}`
}

const debut = performance.now()
console.log(`Le calibrage du Cabinet de curiosités — graine « ${GRAINE} », ${PARTIES} parties par jeu et par joueur, ${PARCOURS} parcours de ${JOURS} jours au plus`)
for (const e of ESSAIS) console.log(`Essai : ${e}`)
console.log('')

// 1. Chaque jeu, sans carte-bonus : ce qu'il donne à chaque joueur, et au hasard.
const SAVOIRS = [...new Map(JOUEURS.map(j => [cleDuSavoir(j), j])).values()]
const SEUILS_MONTRES = [...new Set(Object.values(SEUILS_DES_RARETES))].sort((a, b) => a - b)
console.log('Les jeux, un à un — sans carte-bonus')
console.log(`  la part des parties à ${SEUILS_MONTRES.join(', ')} étoiles ou plus, chacune jouée vers ce seuil (les seuils des raretés), puis, en partie libre, les étoiles en moyenne, les pièces justes, les minutes d'une partie, et les manches où l'échéance l'a pris de court`)
const LARGEURS = [14, 16, 26, 6, 7, 8, 7]
console.log('  ' + colonnes(['jeu', 'joueur', SEUILS_MONTRES.map(s => `≥ ${s}`).join(' · '), '★/9', 'justes', 'minutes', 'retard'], LARGEURS))
const TABLE = new Map<string, Mesure>()
const AU_HASARD: { jeu: CleDeJeu; part: number }[] = []
for (const jeu of CLES_DES_JEUX) {
  for (const j of SAVOIRS) {
    const x = mesurer(j, jeu, null, LIBRE, PARTIES)
    TABLE.set(`${j.nom}|${jeu}`, x)
    const parts = SEUILS_MONTRES.map(s => auMoins(mesurer(j, jeu, null, versLeSeuil(s), PARTIES), s))
    if (j.theta === null) AU_HASARD.push({ jeu, part: parts[0] })
    console.log(
      '  ' +
        colonnes(
          [JEUX[jeu].nom, j.nom, parts.map(enPourcent).join(' · '), arrondi(moyenneDe(x)), arrondi(x.justes / x.parties, 2), arrondi(x.secondes / x.parties / 60, 2), enPourcent(x.enRetard / (3 * x.parties))],
          LARGEURS,
        ),
    )
  }
}
if (AU_HASARD.length > 0) console.log(`  Au hasard, une commune (${SEUILS_MONTRES[0]} étoiles) : ${AU_HASARD.sort((a, b) => b.part - a.part).map(x => `${JEUX[x.jeu].nom} ${enPourcent(x.part)}`).join(' · ')}`)
console.log('')

// 2. Ce qu'une partie rapporte, à la minute, contre une série.
console.log('Les confettis et l\'expérience, à la minute — une pièce juste est une bonne réponse de campagne')
console.log(`  une partie libre jouée pour ses confettis (au-delà de la cinquième du jour, elle ne paie plus que ses pièces), sans carte-bonus, puis avec la meilleure d'un gardien ; une série à ${SECONDES_PAR_QUESTION_DE_SERIE} s la question ; à l'heure, le Cabinet borné à ${DEPARTS_PAR_HEURE} départs`)
const SERIES = 4000
const LARGEURS_2 = [16, 30, 30, 30, 18]
console.log('  ' + colonnes(['joueur', 'série : justes · questions', 'série /min', 'Cabinet /min, son meilleur jeu', 'à l\'heure'], LARGEURS_2))
const DEBIT_DE_LA_SERIE = new Map<string, number>()
const GARDIENS_DE_FORCE_3: CarteMesuree[] = (['eclairer', 'proteger', 'temps', 'miser', 'changer'] as const).map(pouvoir => ({ pouvoir, force: 3 }))
for (const j of SAVOIRS) {
  const r = hasardDe(`${GRAINE}:serie:${j.nom}`)
  let justes = 0
  let questions = 0
  for (let i = 0; i < SERIES; i++) {
    const s = serieDe(j, r)
    justes += s.justes
    questions += s.questions
  }
  const parMinute = justes / ((questions * SECONDES_PAR_QUESTION_DE_SERIE) / 60)
  DEBIT_DE_LA_SERIE.set(cleDuSavoir(j), parMinute)
  const debit = (x: Mesure) => {
    const minutes = x.secondes / x.parties / 60
    return { parMinute: x.justes / x.parties / minutes, parHeure: Math.min(DEPARTS_PAR_HEURE, 60 / minutes) * (x.justes / x.parties) }
  }
  const parJeu = CLES_DES_JEUX.map(jeu => ({ jeu, ...debit(mesurer(j, jeu, null, CONFETTIS, PARTIES)) })).sort((a, b) => b.parMinute - a.parMinute)
  const avecUnGardien = CLES_DES_JEUX.flatMap(jeu => GARDIENS_DE_FORCE_3.map(c => ({ jeu, c, ...debit(mesurer(j, jeu, c, CONFETTIS)) }))).sort((a, b) => b.parMinute - a.parMinute)
  for (const [dit, best] of [
    ['sans carte', parJeu[0]],
    [`${avecUnGardien[0].c!.pouvoir} 3`, avecUnGardien[0]],
  ] as const) {
    console.log(
      '  ' +
        colonnes(
          [
            dit === 'sans carte' ? j.nom : '',
            dit === 'sans carte' ? `${arrondi(justes / SERIES)} · ${arrondi(questions / SERIES)}` : '',
            dit === 'sans carte' ? arrondi(parMinute, 2) : '',
            `${arrondi(best.parMinute, 2)} (${JEUX[best.jeu].nom}, ${dit})`,
            `${arrondi(parMinute * 60, 0)} contre ${arrondi(best.parHeure, 0)}`,
          ],
          LARGEURS_2,
        ),
    )
  }
  console.log('    sans carte : ' + parJeu.map(x => `${JEUX[x.jeu].nom} ${arrondi(x.parMinute, 2)}`).join(' · '))
}
console.log(`  L'expérience suit les confettis : ${formatNumber(xpDuJourDeCampagne(1))} points pour chacune des ${formatNumber(JUSTES_DOUBLEES_PAR_JOUR)} premières bonnes réponses du jour, ${formatNumber(xpDuJourDeCampagne(JUSTES_DOUBLEES_PAR_JOUR + 1) - xpDuJourDeCampagne(JUSTES_DOUBLEES_PAR_JOUR))} ensuite — la série et le Cabinet les partagent.`)
console.log('')

// 3. Le musée, jour après jour.
if (!SANS_MUSEE) {
  console.log(`Le musée, jour après jour — ${PARCOURS} parcours par joueur et par arrivée ; la médiane, puis le plus court et le plus long`)
  console.log(`  arrivées : neuf (les ${OEUVRES_DE_DEPART.length} œuvres de départ), un explorateur au niveau 3 (${TOUTES_LES_ARRIVEES[1].oeuvres.length} œuvres rapportées), au niveau 6 (${TOUTES_LES_ARRIVEES[2].oeuvres.length})`)
  const SEMAINES = [1, 2, 4, 8, 13, 26, 52]
  for (const j of JOUEURS) {
    for (const a of ARRIVEES) {
      const parcours = Array.from({ length: PARCOURS }, (_, k) => parcourir(j, a, k))
      const parJour = (f: (x: Parcours) => number, sur: (x: Parcours) => number = x => x.joursJoues) => arrondi(mediane(parcours.map(x => f(x) / Math.max(1, sur(x)))), 0)
      const justes = (x: Parcours) => x.parOrigine.visite.justes + x.parOrigine.chasse.justes + x.parOrigine.libre.justes
      const minutes = (x: Parcours) => (x.parOrigine.visite.secondes + x.parOrigine.chasse.secondes + x.parOrigine.libre.secondes) / 60
      const nParties = (x: Parcours) => x.parOrigine.visite.parties + x.parOrigine.chasse.parties + x.parOrigine.libre.parties
      console.log(`  ${j.nom}, ${a.nom === 'neuf' ? 'neuf' : `${a.nom} œuvres rapportées`}`)
      console.log(`    tout posséder : ${jours(parcours.map(x => x.toutPossede))} · tout dorer : ${jours(parcours.map(x => x.toutDore))}`)
      const serie = DEBIT_DE_LA_SERIE.get(cleDuSavoir(j))
      const alaMinute = mediane(parcours.map(x => justes(x) / Math.max(1, minutes(x))))
      console.log(
        `    par jour joué : ${parJour(nParties)} parties, ${parJour(minutes)} min, ${parJour(x => x.poussiere)} poussières (${parJour(x => x.poussiereAvant, x => x.joursAvant)} avant de tout posséder), ${parJour(justes)} confettis — ${arrondi(alaMinute, 2)} la minute${serie ? `, ${arrondi(serie, 2)} en série` : ''} —, ${parJour(x => x.xp)} d'expérience`,
      )
      console.log(
        `    œuvres : ${arrondi(mediane(parcours.map(x => x.gagnees)), 0)} gagnées en jouant, ${arrondi(mediane(parcours.map(x => x.achetees)), 0)} achetées ; cadres dorés : ${arrondi(mediane(parcours.map(x => x.doreesEnJouant)), 0)} en jouant, ${arrondi(mediane(parcours.map(x => x.doreesALaPoussiere)), 0)} à la poussière`,
      )
      console.log(`    gardiens réveillés, semaine ${SEMAINES.join(', ')} : ${SEMAINES.map(s => arrondi(mediane(parcours.map(x => x.gardiens.filter(g => g <= s * 7).length)), 1)).join(' · ')} (sur ${GARDIENS.length - GARDIENS_DE_SAISON.length}, ceux de saison à part)`)
      const premiers = parcours.map(x => x.gardiens.find(g => g > 0) ?? null)
      console.log(`    le premier gardien réveillé en jouant : ${jours(premiers)}${parcours.some(x => x.gardiens.includes(0)) ? ` ; dès l'arrivée : ${arrondi(mediane(parcours.map(x => x.gardiens.filter(g => g === 0).length)), 0)}` : ''}`)
    }
  }
  console.log(`  Les ${GARDIENS_DE_SAISON.length} gardiens de saison ne jouent pas : les parcours commencent en février, et leurs fêtes n'y comptent pas (${GARDIENS_DE_SAISON.map(conditionDuGardien).join(' ; ')}).`)
  console.log('')
}
console.log(`Fini en ${arrondi((performance.now() - debut) / 1000)} s.`)

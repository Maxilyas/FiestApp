import { DIVINS, type DivinDescendu } from '../../../shared/divins'
import { jourAvant } from '../../../shared/jour'

/**
 * Ce qui fait descendre les Divins — et c'est un secret.
 *
 * Un légendaire annonce sa règle : on le veut parce qu'on sait ce qu'il
 * demande. Un Divin se tait. Ses règles vivent ici, côté serveur, et nulle
 * part ailleurs : ni `shared/` ni `client/` n'importent ce module (un test y
 * veille, `divins.test.ts`), le paquet du navigateur n'en porte donc pas une
 * ligne, et le serveur n'envoie jamais que la liste des Divins descendus.
 * Qui veut savoir doit jouer — ou lire le code du serveur.
 *
 * Ils ne descendent plus sur les soirées (le choix du propriétaire du
 * 21 novembre 2026 : « la soirée c'est juste pour jouer […] le gros du jeu
 * se trouve en dehors »). Quatre s'y jugeaient, dans des salles de six à huit
 * joueurs : sur cinquante-quatre soirées de la production, six avaient six
 * joueurs, aucune les trois quiz qu'un retournement demandait, et personne
 * n'avait vu descendre un seul Divin — le quiz du jour, lui, réunit dix à
 * dix-sept joueurs chaque jour. Chacun se gagne donc là où l'on joue : au
 * quiz du jour, au défi de la semaine, sur les sentiers.
 *
 * Deux règles tiennent toutes les autres. Aucune ne dépend de qui est là : un
 * Divin ne se mesure qu'à ce que son joueur a fait lui-même — ni rang, ni
 * salle, ni « le plus rapide de tous ». Et chaque seuil est posé juste
 * au-dessus de ce que le meilleur avait fait ce jour-là, mesuré sur la
 * production : rare, mais à portée. Personne ne remplissait aucune de ces
 * règles le jour où elles sont arrivées — rien n'a donc été repris, ni donné
 * d'office.
 *
 * Ce module ne lit rien : chaque mode lui apporte ce qu'il sait de son
 * joueur, et range lui-même ce qui descend, sous sa propre clé (le jour, la
 * semaine du défi, l'épreuve), comme ses hauts faits. Ce sont donc des
 * dérivations des journaux, comme eux : relu, un jour ou une épreuve redit
 * le même Divin.
 *
 * Et comme tout le profil, un Divin ne donne AUCUN avantage de jeu, ni
 * d'expérience : c'est une apparition, pas une récompense de plus.
 */

/**
 * Ce que chaque Divin raconte à qui l'a. Ces lignes disent presque la règle :
 * elles restent ici, et ne partent qu'avec un Divin descendu (`raconter`).
 */
const RECITS: Record<string, Omit<DivinDescendu, 'key'>> = {
  'dv:helios': { legende: 'Vingt réponses justes au défi de la semaine : le soleil s’est levé pour lui.', ton: 'eclat' },
  'dv:seraphin': { legende: 'Dix réponses, pas une faute, et aucune n’a attendu trois secondes.', ton: 'eclat' },
  'dv:lotus': { legende: 'Cinq jours durant, il a fait mieux que la veille — jusqu’à la lumière.', ton: 'eclat' },
  'dv:arbre': { legende: 'Douze sentiers, douze couronnes : il les a toutes cueillies.', ton: 'eclat' },
  'dv:dechu': { legende: 'La veille, il brillait sans une faute. Le lendemain, il est tombé.', ton: 'ombre' },
  'dv:chronos': { legende: 'Il a joué à chaque heure du cadran : le temps n’a plus de secret pour lui.', ton: 'eclat' },
}

/** Les Divins descendus, avec leur récit — pour leur seul porteur. */
export function raconter(cles: readonly string[]): DivinDescendu[] {
  return cles.flatMap(key => (RECITS[key] ? [{ key, ...RECITS[key] }] : []))
}

/** Une clé de Divin, parmi ce qu'une partie vient de ranger : elle s'annonce à part, jamais comme un trophée. */
export const estUnDivin = (cle: string) => cle.startsWith('dv:')

// ── Le quiz du jour ─────────────────────────────────────────────────────────

/** Chronos : une partie commencée à chacune des heures du cadran, à l'heure de Paris. */
const HEURES_DU_CADRAN = 24

/**
 * Ce qu'une partie du quiz du jour fait descendre en commençant. Chronos, le
 * maître du temps : il a joué à toutes les heures du jour et de la nuit, une
 * au moins à chacune — le meilleur en comptait dix-sept, et il manquait à
 * tous celles d'une heure à six heures du matin.
 */
export function divinsDuDebut(heures: Iterable<number>): string[] {
  return new Set(heures).size >= HEURES_DU_CADRAN ? ['dv:chronos'] : []
}

/** Une partie finie du quiz du jour, telle que les Divins la lisent. */
export interface JourDuDivin {
  justes: number
  /** Ses questions qui comptent : celles du tirage, moins les annulées. */
  comptees: number
}

/** Une réponse de la partie qui finit, à une question qui compte. */
export interface ReponseDuDivin {
  juste: boolean
  /** Le temps qu'il a mis, au chronomètre du serveur ; null pour une question qu'il n'a pas chronométrée. */
  ms: number | null
}

/** Le Séraphin : chaque réponse en moins de trois secondes — le meilleur sans-faute en avait une à 3,4. */
const ECLAIR_DU_SERAPHIN_MS = 3000
/** Le Lotus : autant de jours d'affilée, chacun meilleur que la veille. Le plus long progrès en comptait quatre. */
const JOURS_DU_LOTUS = 5
/** L'Ange Déchu : au lendemain d'un sans-faute, autant de bonnes réponses au plus. Personne n'était tombé si bas. */
const CHUTE_DE_L_ANGE = 3

/** Combien de jours la fin d'une partie relit, le sien compris : de quoi juger le plus long des siens. */
export const JOURS_QUE_LA_FIN_RELIT = JOURS_DU_LOTUS

const sansFaute = (j: JourDuDivin | undefined) => !!j && j.comptees > 0 && j.justes >= j.comptees

/**
 * Ce qu'une partie du quiz du jour fait descendre en finissant, sur ses
 * derniers jours finis (`jours`, le sien compris) et ses réponses du jour.
 *
 * Le Séraphin : sans une faute, et chaque réponse partie avant trois
 * secondes — la vitesse contre soi-même, pas contre la salle. Le Lotus : cinq
 * jours d'affilée, chacun avec plus de bonnes réponses que la veille, le
 * dernier sans faute — monté du fond jusqu'à la lumière, sans que personne
 * d'autre n'y soit pour rien. L'Ange Déchu, d'ombre : un sans-faute la
 * veille, et trois bonnes réponses au plus ce jour-ci.
 */
export function divinsDeLaFin(jour: string, jours: ReadonlyMap<string, JourDuDivin>, reponses: readonly ReponseDuDivin[]): string[] {
  const aujourdhui = jours.get(jour)
  if (!aujourdhui) return []
  const cles: string[] = []
  if (
    sansFaute(aujourdhui) &&
    reponses.length >= aujourdhui.comptees &&
    reponses.every(r => r.juste && r.ms !== null && r.ms < ECLAIR_DU_SERAPHIN_MS)
  ) {
    cles.push('dv:seraphin')
  }
  if (sansFaute(aujourdhui)) {
    let monte = true
    for (let i = 1; i < JOURS_DU_LOTUS && monte; i++) {
      const avant = jours.get(jourAvant(jour, i))
      const apres = jours.get(jourAvant(jour, i - 1))!
      monte = !!avant && avant.justes < apres.justes
    }
    if (monte) cles.push('dv:lotus')
  }
  if (sansFaute(jours.get(jourAvant(jour, 1))) && aujourdhui.justes <= CHUTE_DE_L_ANGE) cles.push('dv:dechu')
  return cles
}

// ── Le défi de la semaine ───────────────────────────────────────────────────

/** Hélios : autant de bonnes réponses au défi de la semaine, sur sa seule tentative. Le meilleur en avait dix-sept. */
const JUSTES_D_HELIOS = 20

/** Ce qu'une tentative du défi de la semaine fait descendre, à ses bonnes réponses. */
export function divinsDuDefi(justes: number): string[] {
  return justes >= JUSTES_D_HELIOS ? ['dv:helios'] : []
}

// ── Les sentiers ────────────────────────────────────────────────────────────

/**
 * L'Arbre-Monde : maître de chacun des douze sentiers — ses douze branches.
 * Douze, nommément : une branche ajoutée un jour ne lui reprendrait rien,
 * l'Arbre se range une fois descendu. (Jusqu'au 21 novembre 2026, il se
 * déduisait des légendaires qu'on avait : onze de ceux qu'il demandait
 * étaient devenus des gardiens du Cabinet, et il serait descendu sans un mot,
 * hors de toute partie.)
 */
const SENTIERS_DE_L_ARBRE = 12

/** Ce que la validation d'un maître fait descendre, au nombre de sentiers dont il est maître. */
export function divinsDesSentiers(maitres: number): string[] {
  return maitres >= SENTIERS_DE_L_ARBRE ? ['dv:arbre'] : []
}

// ── Ce qu'un profil garde ───────────────────────────────────────────────────

/**
 * Les Divins qu'un profil a vus descendre : ceux que son étagère a rangés,
 * tous sous la clé de ce qui les a fait tomber — un jour, une semaine du
 * défi, une épreuve. Rangé, un Divin reste : aucune de ces clés ne se retire.
 */
export function divinsDebloques(recompenses: ReadonlyMap<string, number>): string[] {
  return DIVINS.filter(d => (recompenses.get(d.key) ?? 0) > 0).map(d => d.key)
}

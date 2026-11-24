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
 * quiz du jour, au défi de la semaine, sur les sentiers — et, pour les douze
 * venus le même jour, dans une série, une révision, un duel, au Cabinet, ou
 * de l'un à l'autre.
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
  // Les douze du 21 novembre 2026.
  'dv:athena': { legende: 'Six jours de suite, neuf sur dix au moins : sa sagesse ne faiblit pas.', ton: 'eclat' },
  'dv:thot': { legende: 'Dix de ses questions retenues pour le quiz du jour : le scribe lui tend son calame.', ton: 'eclat' },
  'dv:demiurge': { legende: 'Soixante sur soixante : la série n’avait plus rien à lui demander.', ton: 'eclat' },
  'dv:ariane': { legende: 'Vingt-cinq bonnes réponses d’affilée : il n’a pas lâché le fil.', ton: 'eclat' },
  'dv:mnemosyne': { legende: 'Cinq révisions de dix questions, pas une faute : rien de ce qu’il a appris ne s’est perdu.', ton: 'eclat' },
  'dv:heracles': { legende: 'Mille bonnes réponses en un seul jour : douze travaux n’y auraient pas suffi.', ton: 'eclat' },
  'dv:sisyphe': { legende: 'Onze fois le même palier lui a échappé ; le même jour, il l’a validé. Le rocher est resté en haut.', ton: 'eclat' },
  'dv:nike': { legende: 'Un duel gagné, trente bonnes réponses : la victoire avait des ailes.', ton: 'eclat' },
  'dv:osiris': { legende: 'Deux fautes pour commencer, et le duel gagné quand même : il est revenu d’entre les morts.', ton: 'eclat' },
  'dv:hecate': { legende: 'En un seul jour, trois traversées gagnées : la déesse aux trois visages l’a reconnu pour sien.', ton: 'eclat' },
  'dv:artemis': { legende: 'Trente mille bonnes réponses avec le même compagnon : ils chassent ensemble depuis longtemps.', ton: 'eclat' },
  'dv:pantheon': { legende: 'Le même jour : un sans-faute, trois étoiles, un duel et une traversée. Tous les dieux étaient là.', ton: 'eclat' },
}

/** Les Divins descendus, avec leur récit — pour leur seul porteur. */
export function raconter(cles: readonly string[]): DivinDescendu[] {
  return cles.flatMap(key => (RECITS[key] ? [{ key, ...RECITS[key] }] : []))
}

/**
 * La légende d'un Divin, pour le Sphinx de l'accueil (`core/sphinx.ts`), qui
 * la souffle mot à mot à qui résout ses énigmes : elle ne quitte le serveur
 * que mot à mot, ou entière une fois que tous l'ont reconstituée
 * (invariant 21). Null pour un Divin sans récit.
 */
export function legendeDe(cle: string): string | null {
  return RECITS[cle]?.legende ?? null
}

/** Une clé de Divin, parmi ce qu'une partie vient de ranger : elle s'annonce à part, jamais comme un trophée. */
export const estUnDivin = (cle: string) => cle.startsWith('dv:')

// ── Le quiz du jour ─────────────────────────────────────────────────────────

/** Chronos : une partie commencée à chacune des heures du cadran, à l'heure de Paris. */
const HEURES_DU_CADRAN = 24
/** Thot : autant de ses questions acceptées pour le quiz du jour. Le plus assidu en comptait trois. */
const QUESTIONS_DE_THOT = 10

/**
 * Ce qu'une partie du quiz du jour fait descendre en commençant. Chronos, le
 * maître du temps : il a joué à toutes les heures du jour et de la nuit, une
 * au moins à chacune — le meilleur en comptait dix-sept, et il manquait à
 * tous celles d'une heure à six heures du matin. Thot, le scribe : dix de ses
 * questions acceptées (`acceptees` — celles qu'on lui a retirées depuis n'y
 * sont plus) ; leur acceptation n'a pas d'écran à elle, c'est sa partie
 * suivante qui le lui dit, comme La Plume.
 */
export function divinsDuDebut(heures: Iterable<number>, acceptees = 0): string[] {
  const cles: string[] = []
  if (new Set(heures).size >= HEURES_DU_CADRAN) cles.push('dv:chronos')
  if (acceptees >= QUESTIONS_DE_THOT) cles.push('dv:thot')
  return cles
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
/** Athéna : autant de jours d'affilée, une faute au plus chacun. La plus longue suite en comptait cinq. */
const JOURS_D_ATHENA = 6
const FAUTES_D_ATHENA = 1

/** Combien de jours la fin d'une partie relit, le sien compris : de quoi juger le plus long des siens. */
export const JOURS_QUE_LA_FIN_RELIT = Math.max(JOURS_DU_LOTUS, JOURS_D_ATHENA)

const sansFaute = (j: JourDuDivin | undefined) => !!j && j.comptees > 0 && j.justes >= j.comptees
const presqueSansFaute = (j: JourDuDivin | undefined) => !!j && j.comptees > 0 && j.justes >= j.comptees - FAUTES_D_ATHENA

/**
 * Ce qu'une partie du quiz du jour fait descendre en finissant, sur ses
 * derniers jours finis (`jours`, le sien compris) et ses réponses du jour.
 *
 * Le Séraphin : sans une faute, et chaque réponse partie avant trois
 * secondes — la vitesse contre soi-même, pas contre la salle. Le Lotus : cinq
 * jours d'affilée, chacun avec plus de bonnes réponses que la veille, le
 * dernier sans faute — monté du fond jusqu'à la lumière, sans que personne
 * d'autre n'y soit pour rien. L'Ange Déchu, d'ombre : un sans-faute la
 * veille, et trois bonnes réponses au plus ce jour-ci. Athéna : six jours
 * d'affilée, chacun à une faute au plus sur ses questions qui comptent — la
 * constance, là où le Lotus veut un progrès.
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
  if (Array.from({ length: JOURS_D_ATHENA }, (_, i) => jours.get(jourAvant(jour, i))).every(presqueSansFaute)) cles.push('dv:athena')
  return cles
}

// ── Le défi de la semaine ───────────────────────────────────────────────────

/** Hélios : autant de bonnes réponses au défi de la semaine, sur sa seule tentative. Le meilleur en avait dix-sept. */
const JUSTES_D_HELIOS = 20

/** Ce qu'une tentative du défi de la semaine fait descendre, à ses bonnes réponses. */
export function divinsDuDefi(justes: number): string[] {
  return justes >= JUSTES_D_HELIOS ? ['dv:helios'] : []
}

// ── Une partie de la campagne : la série, le défi, un duel ───────────────────

/** Le Démiurge : une série menée au bout de ses soixante questions, toutes justes. Le record en comptait trente et une. */
const SERIE_DU_DEMIURGE = 60
/** Ariane : autant de bonnes réponses d'affilée dans une même partie. La plus longue suite en comptait vingt-trois. */
const FIL_D_ARIANE = 25
/** Nikê : un duel classé gagné avec autant de bonnes réponses. Le meilleur vainqueur en avait vingt-six. */
const JUSTES_DE_NIKE = 30
/** Osiris : un duel gagné après avoir raté ses premières questions, autant qu'il y en a ici. Personne ne l'avait fait. */
const FAUTES_D_OSIRIS = 2

/** Une partie finie, telle que les Divins la lisent. */
export interface PartieDuDivin {
  /** Une série, le défi de la semaine, un duel contre quelqu'un (`duel`) ou contre Automate (`rencontre`). */
  mode: 'serie' | 'defi' | 'duel' | 'rencontre'
  justes: number
  /** Ses réponses, dans l'ordre où il les a données : juste ou non. */
  reponses: readonly boolean[]
  /** Un duel qu'il a gagné : classé, contre quelqu'un, ou au dé. Rien pour un duel perdu, égal, ou un défi entre amis d'avant. */
  gagne?: 'classe' | 'de'
}

/** La plus longue suite de bonnes réponses d'une partie. */
function plusLongFil(reponses: readonly boolean[]): number {
  let fil = 0
  let record = 0
  for (const juste of reponses) {
    fil = juste ? fil + 1 : 0
    if (fil > record) record = fil
  }
  return record
}

/**
 * Ce qu'une partie de la campagne fait descendre en finissant.
 *
 * Hélios, au défi de la semaine (`divinsDuDefi`). Le Démiurge : une série
 * dont les soixante questions sont justes — elle s'arrête là, il n'y a rien
 * au-delà. Ariane : vingt-cinq bonnes réponses d'affilée, sans lâcher le fil,
 * dans une série, le défi ou un duel. Nikê : un duel classé gagné avec trente
 * bonnes réponses — contre quelqu'un, pas contre Automate, qu'on choisit
 * d'affronter autant qu'on veut. Osiris : un duel gagné, classé ou au dé,
 * après avoir raté ses deux premières questions — revenu de loin.
 */
export function divinsDeLaPartie(p: PartieDuDivin): string[] {
  const cles = p.mode === 'defi' ? divinsDuDefi(p.justes) : []
  if (p.mode === 'serie' && p.justes >= SERIE_DU_DEMIURGE && p.reponses.every(Boolean)) cles.push('dv:demiurge')
  if (plusLongFil(p.reponses) >= FIL_D_ARIANE) cles.push('dv:ariane')
  if (p.gagne === 'classe' && p.justes >= JUSTES_DE_NIKE) cles.push('dv:nike')
  if (p.gagne && p.reponses.length >= FAUTES_D_OSIRIS && p.reponses.slice(0, FAUTES_D_OSIRIS).every(juste => !juste)) cles.push('dv:osiris')
  return cles
}

// ── Le carnet ───────────────────────────────────────────────────────────────

/** Mnémosyne : autant de révisions d'affilée, chacune de dix questions et sans une faute. La plus longue suite en comptait quatre, révisions en avance comprises. */
const REVISIONS_DE_MNEMOSYNE = 5
/** Une révision qui compte pour elle : pleine, autant de questions — une révision plus courte ne prouve rien, et ne casse rien. */
export const QUESTIONS_D_UNE_REVISION_PLEINE = 10

/**
 * Une révision compte-t-elle pour Mnémosyne ? Pleine, et due tout entière :
 * pas une question revue en avance (« Revoir tout mon carnet »). Sans cela,
 * cinq passes le même matin sur les mêmes dix questions la faisaient
 * descendre — et le carnet lui-même tient une réponse en avance pour ne rien
 * prouver. Comme une révision courte, une révision en avance ne compte pas,
 * et ne casse rien.
 */
export const revisionQuiCompte = (r: { questions: number; enAvance: number }) => r.questions >= QUESTIONS_D_UNE_REVISION_PLEINE && r.enAvance === 0

/**
 * Ce qu'une révision fait descendre en finissant, sur ses dernières révisions
 * finies qui comptent (`revisionQuiCompte`), la plus récente d'abord (leurs
 * bonnes réponses) : les cinq dernières sans une faute. Une révision pleine
 * laissée en route n'a pas ses dix bonnes réponses : elle casse la suite —
 * sans quoi on quitterait à la première question qu'on ne sait pas.
 */
export function divinsDesRevisions(justesDesDernieres: readonly number[]): string[] {
  const dernieres = justesDesDernieres.slice(0, REVISIONS_DE_MNEMOSYNE)
  return dernieres.length >= REVISIONS_DE_MNEMOSYNE && dernieres.every(j => j >= QUESTIONS_D_UNE_REVISION_PLEINE) ? ['dv:mnemosyne'] : []
}
/** Combien de révisions pleines la fin d'une révision relit. */
export const REVISIONS_QUE_LA_FIN_RELIT = REVISIONS_DE_MNEMOSYNE

// ── La journée ──────────────────────────────────────────────────────────────

/** Héraclès : autant de bonnes réponses de campagne le même jour, à Paris. La plus grosse journée en comptait 735. */
const JUSTES_D_HERACLES = 1000

/**
 * Ce qu'une partie de la campagne fait descendre en finissant, aux bonnes
 * réponses de sa plus grosse journée, tous ses modes ensemble — celles qui
 * comptent pour son expérience, révisions comprises. Sa plus grosse, pas
 * celle de cette fin : la journée dont la millième tombait dans une partie
 * laissée en route, ou finie passé minuit, n'aurait jamais été jugée.
 */
export function divinsDeLaJournee(justesDeSaPlusGrosseJournee: number): string[] {
  return justesDeSaPlusGrosseJournee >= JUSTES_D_HERACLES ? ['dv:heracles'] : []
}

// ── Le compagnon ────────────────────────────────────────────────────────────

/**
 * Artémis : autant de bonnes réponses avec le même compagnon dans sa niche —
 * le compte qui le fait grandir, soirées, quiz du jour et campagne ensemble.
 * Le plus fidèle en comptait 4 300 : sept mois, au rythme des plus rapides.
 */
const JUSTES_D_ARTEMIS = 30_000

/** Ce que la fin d'une partie fait descendre, aux bonnes réponses données avec chacun de ses compagnons. */
export function divinsDesCompagnons(justes: Iterable<number>): string[] {
  for (const n of justes) if (n >= JUSTES_D_ARTEMIS) return ['dv:artemis']
  return []
}

// ── Le Cabinet de curiosités ────────────────────────────────────────────────

/** Hécate : autant de traversées gagnées le même jour, à Paris. Le record était de deux, atteint deux fois. */
const TRAVERSEES_D_HECATE = 3

/**
 * Hécate, la déesse aux trois visages : trois traversées gagnées le même
 * jour de Paris (`gagneesCeJour`, celle qui finit comprise) — elle descend
 * sur la troisième. Le choix du propriétaire du 22 novembre 2026, parmi
 * quatre règles mesurées sur les vingt-cinq traversées gagnées de la
 * production. La première, la veille — gagner sans ouvrir un coffre ni rien
 * acheter, ni prendre une amélioration — ne se pouvait pas : l'amélioration
 * qu'un gardien vaincu offre ne se refuse pas ; et sans elle, un joueur
 * l'avait déjà fait.
 */
export function divinsDeLaTraversee(t: { gagneesCeJour: number }): string[] {
  return t.gagneesCeJour >= TRAVERSEES_D_HECATE ? ['dv:hecate'] : []
}

// ── Le même jour, partout ───────────────────────────────────────────────────

/** Ce qu'il a fait un même jour de Paris, mode par mode. */
export interface JourneeDuDivin {
  /** Un sans-faute au quiz du jour. */
  sansFaute: boolean
  /** Un palier de sentier validé à trois étoiles. */
  troisEtoiles: boolean
  /** Un duel gagné, classé ou au dé. */
  duel: boolean
  /** Une traversée du Cabinet gagnée. */
  traversee: boolean
}

/**
 * Le Panthéon : les quatre le même jour — un sans-faute au quiz du jour, un
 * palier à trois étoiles, un duel gagné, une traversée gagnée. Personne n'en
 * avait réuni plus de trois. Il descend sur celle des quatre parties qui
 * finit la dernière : chacune le juge à sa fin.
 */
export function divinsDeLaJourneeEntiere(j: JourneeDuDivin): string[] {
  return j.sansFaute && j.troisEtoiles && j.duel && j.traversee ? ['dv:pantheon'] : []
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

/** Sisyphe : un palier validé après l'avoir raté autant de fois en jeu le même jour, à Paris. Le plus obstiné en comptait dix. */
const ECHECS_DE_SISYPHE = 11

/**
 * Ce qu'un palier validé en jeu fait descendre, aux épreuves de ce même
 * palier qu'il avait ratées ce jour-là avant elle — celles qui lui ont coûté
 * une vie. Ce palier-là, pas tous : ses échecs du jour, tous sentiers
 * ensemble, en comptaient déjà vingt-deux chez la plus obstinée, et la règle
 * serait descendue six fois sur elle le jour de son arrivée. Onze sur le
 * même : presque toutes les vies du jour pour un seul rocher.
 */
export function divinsDuPalier(echecsDuJourSurCePalier: number): string[] {
  return echecsDuJourSurCePalier >= ECHECS_DE_SISYPHE ? ['dv:sisyphe'] : []
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

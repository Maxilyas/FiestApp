// Le QG de l'administrateur (`/admin`) : ce qu'il montre se dérive ici, à
// l'écart des magasins qui le lisent — la vue d'ensemble, le direct, ce qui
// attend un geste. Des dérivations pures : le serveur les calcule, le client
// les écrit, les tests les jouent l'horloge à la main.
//
// Des chiffres, jamais un contenu : des soirées des autres, le QG ne voit ni
// les quiz, ni les questions, ni les prénoms des invités — seulement où elles
// en sont et combien elles comptent de monde (le choix du 13 octobre 2026).

import { jourAvant, jourDe, jourEnToutesLettres, minutesDeParis } from './jour'
import { formatNumber } from './typographie'

/**
 * Les quatre modes de jeu, dans l'ordre de leur pile, du bas vers le haut :
 * l'or des soirées, le vert de la campagne, l'orange du quiz du jour, le bleu
 * des duels. Cet ordre est celui que la vérification des couleurs a validé —
 * voisins, deux d'entre eux restent distincts aux daltonismes — : il ne se
 * change pas sans la refaire (`.qg-ecran`, `styles.css`).
 */
export const MODES_DU_QG = ['soiree', 'campagne', 'jour', 'duel'] as const
export type ModeDuQg = (typeof MODES_DU_QG)[number]

export const NOM_DU_MODE: Record<ModeDuQg, string> = { soiree: 'Soirées', campagne: 'Campagne', jour: 'Quiz du jour', duel: 'Duels' }

/**
 * Les séries de la campagne qui se jouent en duel : contre quelqu'un, ou
 * contre Automate. Une seule table les range toutes (`campagne_series`) ; le
 * reste — série, sentier, parcours, révision, défi de la semaine — est la
 * campagne.
 */
const MODES_DE_DUEL: readonly string[] = ['duel', 'rencontre']

export function modeDeLaSerie(mode: string | null): 'campagne' | 'duel' {
  return mode !== null && MODES_DE_DUEL.includes(mode) ? 'duel' : 'campagne'
}

/**
 * Une soirée sans un geste depuis six heures est laissée en plan : finie à
 * minuit sans être close, elle paraît le lendemain matin (le choix du
 * 13 octobre 2026). Ses invités attendent leurs récompenses de soirée, et
 * leurs profils ne se suppriment pas tant qu'elle n'est pas close.
 */
export const EN_PLAN_MS = 6 * 3_600_000

/** Sous ce nombre de jours d'avance, la réserve du quiz du jour s'allume : une semaine pour coller une liste. */
export const ALERTE_JOURS_D_AVANCE = 7

/** La vue d'ensemble regarde trente jours en arrière, aujourd'hui compris. */
export const JOURS_DU_QG = 30

/** Ce que les tuiles d'aujourd'hui tracent : douze jours, aujourd'hui en dernier. */
export const JOURS_DES_TUILES = 12

/** « D'habitude » : la moyenne des sept jours d'avant, chacun arrêté à la même heure. */
export const JOURS_DE_L_HABITUDE = 7

// ── Ce que le serveur envoie ──────────────────────────────────────────────

/** Une soirée pas encore close, telle que le QG la voit : des chiffres, jamais un prénom d'invité ni un quiz. */
export interface SoireeDuQg {
  spaceId: string
  /** Le nom qu'on lit de l'espace (`nomDeLEspace`), et l'avatar de son titulaire. */
  salon: { nom: string; avatar: string | null }
  etat: 'en-cours' | 'en-plan'
  /** Les invités inscrits ce soir, et ceux dont le téléphone est là. */
  inscrits: number
  connectes: number
  /** Le début de la soirée : sa première question jouée, sinon son premier invité. */
  depuis: number
  /** Son dernier signe de vie : une arrivée, une réponse, un quiz qui avance. */
  dernierSigne: number
  /** Les quiz qu'on y a déjà joués, celui en cours compris s'il a commencé. */
  quizJoues: number
  /** La partie en cours : sa phase, son numéro dans la soirée et où elle en est. Null entre deux quiz. */
  partie: { phase: string; quiz: number; question: number | null; questions: number | null } | null
  /** Un écran d'animateur est branché — la console, la télé, la barre d'un salon. */
  ecran: boolean
  /** Le miroir de cet espace est en retard : l'écran commun le dit déjà. */
  sauvegardeEnRetard: boolean
}

export interface DirectDuQg {
  maintenant: number
  soirees: SoireeDuQg[]
  /** Les téléphones d'invités connectés, toutes soirées confondues. */
  invitesConnectes: number
  /** Les profils passés ces cinq dernières minutes. */
  profilsEnLigne: number
  miroir: { enAttente: number; echecsConsecutifs: number; enEchecDepuis: string | null; espacesEnRetard: number } | null
  serveur: {
    env: string
    version: string | null
    enMarcheDepuisS: number
    memoireMo: number | null
    /** Le processeur d'un cœur, en moyenne sur la dernière minute — l'hébergeur gratuit n'en donne qu'un dixième. */
    cpuPct: number | null
    /** La part du temps où la boucle travaille : à cent, les réponses attendent leur tour. */
    bouclePct: number | null
    baseP95Ms: number | null
    connexions: number | null
  }
}

/** Un chiffre d'aujourd'hui, et ce qu'il valait d'habitude à la même heure. */
export interface CompteDuJour {
  aujourdhui: number
  /** La moyenne des sept jours d'avant, chacun arrêté à la même heure ; null sans jour d'avant à comparer. */
  habituel: number | null
  /** Les douze derniers jours, du plus ancien à aujourd'hui (à l'heure qu'il est). */
  parJour: number[]
}

export const TUILES_DU_QG = ['profilsActifs', 'partiesDuJour', 'seriesDeCampagne', 'duels', 'nouveauxProfils', 'achats'] as const
export type TuileDuQg = (typeof TUILES_DU_QG)[number]

/** Des noms courts : à l'ordinateur, six tuiles tiennent sur une ligne, et un nom sur deux lignes décalait son chiffre. */
export const NOM_DE_LA_TUILE: Record<TuileDuQg, string> = {
  profilsActifs: 'Profils actifs',
  partiesDuJour: 'Quiz du jour',
  seriesDeCampagne: 'Séries de campagne',
  duels: 'Duels joués',
  nouveauxProfils: 'Nouveaux profils',
  achats: 'Achats en boutique',
}

/** Les participations d'un jour, mode par mode : un joueur compte une fois par mode et par jour. */
export interface ParticipationsDuJour {
  jour: string
  modes: Record<ModeDuQg, number>
}

/** Ce qui attend un geste, en chiffres : `lesChosesATraiter` en fait la liste. */
export interface ATraiterDuQg {
  reserve: { joursDAvance: number } | null
  signalementsDuJour: { questions: number; joueurs: number }
  signalementsDeLaCampagne: { questions: number; joueurs: number }
  /** Les copies proposées au catalogue, à relire. */
  catalogue: number
  /** La dernière tournée du rappel du soir, depuis le démarrage. */
  rappel: { jour: string; envoyes: number; echecs: number } | null
  /** Le dernier dépôt de la routine du matin, dans la réserve du jour et dans la base de la campagne. */
  routine: { jour: number | null; campagne: number | null }
}

export interface VueDEnsemble {
  maintenant: number
  /** Le jour de Paris. */
  jour: string
  aujourdhui: Record<TuileDuQg, CompteDuJour>
  participations: ParticipationsDuJour[]
  aTraiter: ATraiterDuQg
}

// ── Les jours de Paris ────────────────────────────────────────────────────

/**
 * Le premier instant du jour de Paris d'un instant, à la milliseconde : lu
 * dans le jour lui-même, jamais compté en heures — le jour du passage à
 * l'heure d'été n'en a que vingt-trois, celui du retour vingt-cinq.
 */
export function minuitDe(instant: number): number {
  const jour = jourDe(instant)
  // Vingt-six heures avant, on est toujours la veille : un jour en a vingt-cinq au plus.
  let avant = instant - 26 * 3_600_000
  let apres = instant
  while (apres - avant > 1) {
    const milieu = Math.floor((avant + apres) / 2)
    if (jourDe(milieu) === jour) apres = milieu
    else avant = milieu
  }
  return apres
}

/** Les minuits de Paris des `n` derniers jours, le plus ancien d'abord, celui d'aujourd'hui en dernier. */
export function minuitsDeParis(maintenant: number, n: number): number[] {
  const minuits = [minuitDe(maintenant)]
  while (minuits.length < n) minuits.unshift(minuitDe(minuits[0] - 1))
  return minuits
}

/** L'indice du jour d'un instant parmi les minuits ; -1 avant le premier. */
function jourDeLInstant(minuits: readonly number[], quand: number): number {
  let bas = -1
  let haut = minuits.length - 1
  while (bas < haut) {
    const milieu = Math.ceil((bas + haut) / 2)
    if (minuits[milieu] <= quand) bas = milieu
    else haut = milieu - 1
  }
  return bas
}

/** Un fait daté : une partie commencée, un achat — et qui, pour compter des personnes. */
export interface Evenement {
  quand: number
  qui?: string
}

/**
 * Un chiffre du jour : aujourd'hui jusqu'à maintenant, et ce qu'il valait
 * d'habitude à la même heure — la moyenne des sept jours d'avant, chacun
 * arrêté au même écart de son minuit. Comparé à des journées entières, un
 * soir à 21 h se lisait toujours en baisse. `distincts` compte les personnes
 * (`qui`), pas les faits. `minuits` vient de `minuitsDeParis`, aujourd'hui en
 * dernier ; ce qui tombe avant le premier ou après maintenant ne compte pas.
 */
export function compteDuJour(
  evenements: readonly Evenement[],
  minuits: readonly number[],
  maintenant: number,
  { distincts = false }: { distincts?: boolean } = {},
): CompteDuJour {
  const n = minuits.length
  const ecart = maintenant - minuits[n - 1]
  const entiers = minuits.map(() => new Set<string>())
  const memeHeure = minuits.map(() => new Set<string>())
  let rang = 0
  for (const e of evenements) {
    if (e.quand > maintenant) continue
    const i = jourDeLInstant(minuits, e.quand)
    if (i < 0) continue
    // Sans `qui`, chaque fait compte : il prend une clé à lui.
    const cle = distincts && e.qui !== undefined ? e.qui : `#${rang++}`
    entiers[i].add(cle)
    if (e.quand - minuits[i] <= ecart) memeHeure[i].add(cle)
  }
  const avant = memeHeure.slice(Math.max(0, n - 1 - JOURS_DE_L_HABITUDE), n - 1)
  return {
    aujourdhui: entiers[n - 1].size,
    habituel: avant.length > 0 ? Math.round(avant.reduce((s, x) => s + x.size, 0) / avant.length) : null,
    parJour: entiers.slice(-JOURS_DES_TUILES).map(s => s.size),
  }
}

/** Le jour de Paris de chaque minuit : lu à midi, loin des deux bords. */
export function joursDesMinuits(minuits: readonly number[]): string[] {
  return minuits.map(m => jourDe(m + 12 * 3_600_000))
}

/**
 * Les participations de chaque jour, mode par mode. Seul, un joueur compte
 * une fois par mode et par jour : trois séries de campagne le même soir font
 * une participation. En soirée, chaque invité qui a joué compte — avec ou
 * sans profil —, au jour où sa soirée a commencé.
 */
export function participationsParJour(
  solo: readonly { quand: number; qui: string; mode: Exclude<ModeDuQg, 'soiree'> }[],
  soirees: readonly { quand: number; joueurs: number }[],
  minuits: readonly number[],
  maintenant: number,
): ParticipationsDuJour[] {
  const jours = joursDesMinuits(minuits)
  const personnes = minuits.map(() => ({ campagne: new Set<string>(), jour: new Set<string>(), duel: new Set<string>() }))
  const enSoiree = minuits.map(() => 0)
  for (const e of solo) {
    const i = e.quand <= maintenant ? jourDeLInstant(minuits, e.quand) : -1
    if (i >= 0) personnes[i][e.mode].add(e.qui)
  }
  for (const s of soirees) {
    const i = s.quand <= maintenant ? jourDeLInstant(minuits, s.quand) : -1
    if (i >= 0) enSoiree[i] += s.joueurs
  }
  return jours.map((jour, i) => ({
    jour,
    modes: { soiree: enSoiree[i], campagne: personnes[i].campagne.size, jour: personnes[i].jour.size, duel: personnes[i].duel.size },
  }))
}

// ── Ce qu'on lit ──────────────────────────────────────────────────────────

/** Une soirée est laissée en plan quand son dernier signe de vie date de six heures ou plus. */
export function etatDeLaSoiree(dernierSigne: number, maintenant: number): SoireeDuQg['etat'] {
  return maintenant - dernierSigne >= EN_PLAN_MS ? 'en-plan' : 'en-cours'
}

/**
 * Où en est une soirée, en mots et sans rien de son contenu : « Quiz 2 ·
 * question 7 sur 15 ». La question se compte à partir de 1 ; le moteur, lui,
 * la numérote à partir de 0.
 */
export function ouEnEstLaSoiree(s: Pick<SoireeDuQg, 'partie' | 'quizJoues' | 'etat'>): string {
  const p = s.partie
  if (!p) {
    if (s.quizJoues === 0) return 'Salle d’attente'
    return `Entre deux quiz · ${s.quizJoues} joué${s.quizJoues > 1 ? 's' : ''}`
  }
  const quiz = `Quiz ${p.quiz}`
  const sur = p.question !== null && p.questions !== null ? `${p.question + 1} sur ${p.questions}` : null
  switch (p.phase) {
    case 'pickPack':
      return 'Choix du quiz'
    case 'getReady':
    case 'intertitre':
      return sur ? `${quiz} · avant la question ${sur}` : `${quiz} · ça commence`
    case 'question':
    case 'observe':
    case 'cible':
      return sur ? `${quiz} · question ${sur}` : quiz
    case 'reveal':
      return sur ? `${quiz} · réponse de la question ${sur}` : quiz
    case 'finished':
      return `${quiz} · podium`
    default:
      return quiz
  }
}

/** L'espace insécable d'une durée ou d'une heure : au téléphone, « sans un geste depuis 8 » finissait une ligne, et « h 00 » ouvrait la suivante. */
const INSECABLE = ' '

/**
 * Une durée qu'on lit d'un coup d'œil : « 18 min », « 1 h 12 », « 3 j ».
 * Arrondie vers le bas : une soirée commencée il y a cinquante-neuf minutes
 * n'a pas encore « 1 h ».
 */
export function dureeEcrite(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'moins d’une minute'
  if (minutes < 60) return `${minutes}${INSECABLE}min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `${heures}${INSECABLE}h${INSECABLE}${String(minutes % 60).padStart(2, '0')}`
  return `${Math.floor(heures / 24)}${INSECABLE}j`
}

const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « 14 sept. », « 1er oct. » : sous l'axe d'un graphique, où « septembre » ne tient pas trois fois au téléphone. */
export function jourAbrege(jour: string): string {
  const [, mois, quantieme] = jour.split('-').map(Number)
  return `${quantieme === 1 ? '1er' : quantieme} ${MOIS_ABREGES[mois - 1] ?? ''}`
}

/** L'heure de Paris d'un instant, « 21 h 04 » : celle de l'administrateur, où que tourne le serveur. */
export function heureEcrite(instant: number): string {
  const minutes = minutesDeParis(instant)
  return `${Math.floor(minutes / 60)}${INSECABLE}h${INSECABLE}${String(minutes % 60).padStart(2, '0')}`
}

/** Un instant passé, au jour de Paris : « aujourd’hui à 7 h 02 », « hier à 23 h 10 », « le 9 octobre ». */
export function quandEcrit(instant: number, maintenant: number): string {
  const jour = jourDe(instant)
  const aujourdhui = jourDe(maintenant)
  if (jour === aujourdhui) return `aujourd’hui à ${heureEcrite(instant)}`
  if (jour === jourAvant(aujourdhui)) return `hier à ${heureEcrite(instant)}`
  return `le ${jourEnToutesLettres(jour, true)}`
}

/**
 * Sous vingt d'habitude, un pourcentage ment : trois parties contre deux
 * feraient « 50 % de plus ». La tuile dit alors le chiffre d'habitude.
 */
export const HABITUDE_EN_POURCENTS = 20

export interface EcartALHabitude {
  sens: 'plus' | 'moins' | null
  /** Ce qu'on lit sous le chiffre : « 5 % », « 7 d’habitude », « comme d’habitude ». */
  texte: string
  /** Ce que le lecteur d'écran lit après, la flèche ne se lisant pas : « de plus que d’habitude ». */
  suite: string
}

/** Aujourd'hui comparé à la même heure des sept jours d'avant ; rien sans jour d'avant à comparer. */
export function ecartALHabitude(c: CompteDuJour): EcartALHabitude | null {
  if (c.habituel === null) return null
  const pareil = { sens: null, texte: 'comme d’habitude', suite: '' }
  if (c.habituel < HABITUDE_EN_POURCENTS) return c.aujourdhui === c.habituel ? pareil : { sens: null, texte: `${formatNumber(c.habituel)} d’habitude`, suite: '' }
  const pourcents = Math.round(((c.aujourdhui - c.habituel) / c.habituel) * 100)
  if (pourcents === 0) return pareil
  return {
    sens: pourcents > 0 ? 'plus' : 'moins',
    texte: `${formatNumber(Math.abs(pourcents))} %`,
    suite: pourcents > 0 ? ' de plus que d’habitude' : ' de moins que d’habitude',
  }
}

/**
 * Les graduations d'un axe qui part de zéro : quelques crans ronds — 1, 2 ou
 * 5 fois une puissance de dix, jamais moins d'un : on compte des personnes —,
 * le dernier au-dessus du maximum.
 */
export function graduations(max: number): number[] {
  if (!(max > 0)) return [0]
  const brut = max / 4
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = Math.max(1, [1, 2, 5, 10].map(m => m * puissance).find(p => p >= brut) ?? brut)
  return Array.from({ length: Math.ceil(max / pas) + 1 }, (_, i) => i * pas)
}

/** Une chose qui attend un geste : ce qu'on lit, et l'écran qui la montre. */
export interface ChoseATraiter {
  cle: string
  /** Allumée en rouge : elle presse. */
  alerte: boolean
  titre: string
  detail: string
  /** L'écran du QG qui la montre ; null, rien encore à ouvrir — la ligne suffit. */
  ecran: 'jour' | 'campagne' | 'catalogue' | null
}

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`

/**
 * La liste de ce qui attend un geste, la plus pressée d'abord : le miroir en
 * panne et la réserve qui baisse s'allument, le reste s'aligne. Rien qui
 * n'attende pas : une liste qui dit toujours quelque chose ne se lit plus.
 */
export function lesChosesATraiter(vue: ATraiterDuQg | null, direct: Pick<DirectDuQg, 'soirees' | 'miroir'> | null): ChoseATraiter[] {
  const choses: ChoseATraiter[] = []
  const miroir = direct?.miroir
  if (miroir && (miroir.enEchecDepuis !== null || miroir.espacesEnRetard > 0)) {
    choses.push({
      cle: 'miroir',
      alerte: true,
      titre: 'Le miroir Turso est en panne',
      detail: `${pluriel(miroir.enAttente, 'écriture')} en attente${miroir.espacesEnRetard > 0 ? `, ${pluriel(miroir.espacesEnRetard, 'salon')} en retard` : ''}`,
      ecran: null,
    })
  }
  if (vue?.reserve && vue.reserve.joursDAvance < ALERTE_JOURS_D_AVANCE) {
    choses.push({
      cle: 'reserve',
      alerte: true,
      titre: 'La réserve du quiz du jour',
      detail: `${pluriel(vue.reserve.joursDAvance, 'jour')} d’avance, l’alerte est à ${ALERTE_JOURS_D_AVANCE}`,
      ecran: 'jour',
    })
  }
  if (vue && vue.signalementsDuJour.questions > 0) {
    const s = vue.signalementsDuJour
    choses.push({
      cle: 'signalements-jour',
      alerte: false,
      titre: 'Signalements du quiz du jour',
      detail: `${pluriel(s.questions, 'question')}, ${pluriel(s.joueurs, 'joueur')}`,
      ecran: 'jour',
    })
  }
  if (vue && vue.signalementsDeLaCampagne.questions > 0) {
    const s = vue.signalementsDeLaCampagne
    choses.push({
      cle: 'signalements-campagne',
      alerte: false,
      titre: 'Signalements de la campagne',
      detail: `${pluriel(s.questions, 'question')}, ${pluriel(s.joueurs, 'joueur')}`,
      ecran: 'campagne',
    })
  }
  if (vue && vue.catalogue > 0) {
    choses.push({
      cle: 'catalogue',
      alerte: false,
      titre: vue.catalogue > 1 ? `${vue.catalogue} copies à relire` : 'Une copie à relire',
      detail: vue.catalogue > 1 ? 'proposées au catalogue' : 'proposée au catalogue',
      ecran: 'catalogue',
    })
  }
  for (const s of direct?.soirees ?? []) {
    if (s.etat !== 'en-plan') continue
    choses.push({
      cle: `en-plan-${s.spaceId}`,
      alerte: false,
      titre: 'Une soirée laissée en plan',
      detail: `${s.salon.nom}, ${pluriel(s.inscrits, 'invité')}`,
      ecran: null,
    })
  }
  if (vue?.rappel && vue.rappel.echecs > 0) {
    choses.push({
      cle: 'rappel',
      alerte: false,
      titre: 'Le rappel du soir',
      detail: `${pluriel(vue.rappel.echecs, 'envoi')} en échec sur ${vue.rappel.envoyes + vue.rappel.echecs}`,
      ecran: null,
    })
  }
  return choses
}

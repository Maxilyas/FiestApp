// La campagne solo : une série de questions qui montent en difficulté, trois
// vies, sans chronomètre. Elle se joue seul, avec son profil, quand on veut
// — l'entre-deux des soirées, comme le quiz du jour, mais sans rendez-vous.
//
// Une bonne réponse y rapporte de l'expérience — cinq points, dix pour les
// vingt premières du jour —, sans plafond : chacun monte à son rythme. Et un
// confetti.
//
// Ses questions viennent de sa base à elle (`server/src/core/baseCampagne.ts`),
// écrite et étiquetée d'avance, jamais de la réserve du quiz du jour : elle
// en reposait les questions, vues et corrigées chaque matin (le choix du
// propriétaire du 3 octobre 2026). Un joueur n'y revoit une question
// qu'une fois toutes les autres de sa marche passées, la plus anciennement
// vue d'abord — et celle d'hier soir en dernier recours.

import type { Finition } from './profil'
import { jourAvant, jourDe, type LaurierPorte, type PalierTombe } from './jour'
import { sansAccent } from './homonymes'

/** Les vies d'une série : la troisième erreur la termine. */
export const VIES = 3

/** Au plus, les questions d'une série : au-delà, on a tout gagné. */
export const QUESTIONS_PAR_SERIE = 60

/** Combien de questions par marche avant que la difficulté monte. */
export const QUESTIONS_PAR_MARCHE = 5

/** Sous ce nombre de questions jouables, la campagne attend : une série de trois questions n'en est pas une. */
export const QUESTIONS_POUR_JOUER = 10

export type Niveau = 'facile' | 'moyen' | 'difficile' | 'expert'

export const NIVEAUX: readonly Niveau[] = ['facile', 'moyen', 'difficile', 'expert']

export const NOM_NIVEAU: Record<Niveau, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
  expert: 'Expert',
}

/**
 * Sous ce nombre de réponses, une question du quiz du jour n'a pas de
 * difficulté mesurée : trois joueurs ne disent rien de la France entière.
 */
export const REPONSES_POUR_MESURER = 5

/**
 * Le niveau d'une part de joueurs qui trouvent. Les seuils sont ceux de la
 * consigne du quiz du jour : une facile, presque tout le monde ; une
 * moyenne, une personne sur deux ; une difficile, une sur quatre au plus.
 */
export function niveauDuTaux(part: number): Niveau {
  if (part >= 0.7) return 'facile'
  if (part >= 0.4) return 'moyen'
  if (part >= 0.2) return 'difficile'
  return 'expert'
}

/** La difficulté d'une question du quiz du jour, lue sur la part de ceux qui l'ont trouvée (la consigne de la réserve). */
export function niveauMesure(justes: number, total: number): Niveau | null {
  return total < REPONSES_POUR_MESURER ? null : niveauDuTaux(justes / total)
}

/**
 * La part de joueurs qu'on attend d'une question avant toute réponse : sa
 * difficulté estimée à l'écriture (de 1 à 5, `shared/etiquettes.ts`). Par
 * les seuils de `niveauDuTaux`, 1 et 2 sont faciles, 3 moyenne, 4 difficile,
 * 5 experte.
 */
export const TAUX_A_PRIORI: Readonly<Record<number, number>> = { 1: 0.9, 2: 0.8, 3: 0.55, 4: 0.3, 5: 0.1 }

/**
 * Ce que pèse l'a priori, en réponses fictives : « 3 sur 4 » ne dit rien,
 * « 300 sur 400 », si. À vingt, il faut trois réponses contraires d'affilée
 * pour qu'une question au bord de sa marche en change — une 2 que trois
 * joueurs ratent, une 5 que trois joueurs trouvent —, et une centaine
 * pour que l'estimation ne compte presque plus. À dix, une seule réponse
 * suffisait : la question qu'un seul joueur fort trouvait quittait l'expert.
 */
export const REPONSES_FICTIVES = 20

/**
 * La part lissée de joueurs qui trouvent une question de campagne : ses
 * vraies réponses mêlées à des réponses fictives tirées de son a priori,
 * qui s'effacent à mesure que les vraies arrivent. Sans elle, une question
 * jamais jouée passait pour moyenne, et une série où presque rien n'était
 * mesuré ne montait pas (l'état des lieux du 3 octobre 2026).
 */
export function tauxLisse(difficulte: number, justes = 0, total = 0): number {
  const a = TAUX_A_PRIORI[difficulte] ?? TAUX_A_PRIORI[3]
  return (justes + REPONSES_FICTIVES * a) / (total + REPONSES_FICTIVES)
}

/** Le niveau d'une question de la base : son a priori, corrigé par les réponses de campagne. */
export function niveauDeQuestion(difficulte: number, mesure?: { justes: number; total: number }): Niveau {
  return niveauDuTaux(tauxLisse(difficulte, mesure?.justes, mesure?.total))
}

/** Un signalement tient en une phrase : celle de l'écran, comme au quiz du jour. */
export const SIGNALEMENT_MAX = 280

/** Une réponse tient sur un bouton de téléphone : bien moins que les 120 caractères qu'accepte l'éditeur. */
export const MAX_REPONSE = 70

/** Ce qui fait une réponse, pour la reconnaître d'une version à l'autre : ni casse, ni accents, ni ponctuation. */
const reconnaissable = (reponse: string) =>
  sansAccent(reponse)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Une correction change-t-elle la bonne réponse ? Alors ce n'est plus la
 * même question : elle repart sous un nouvel identifiant, et les mesures de
 * l'ancienne — ses réponses, sa difficulté — ne la suivent pas. Une
 * coquille, un leurre ambigu remplacé, une anecdote reprise, des réponses
 * dans un autre ordre : la même question, le même identifiant. L'écran de
 * l'administrateur le dit avant d'enregistrer, le serveur le décide.
 */
export function bonneReponseChange(avant: { reponses: readonly string[]; bonne: number }, apres: { reponses: readonly string[]; bonne: number }): boolean {
  return reconnaissable(avant.reponses[avant.bonne] ?? '') !== reconnaissable(apres.reponses[apres.bonne] ?? '')
}

/**
 * L'ordre d'une série : cinq de chaque marche, de la plus facile à la plus
 * dure, puis tout ce qui reste au plus dur. Chaque marche a déjà été battue
 * (mélangée) par l'appelant : la fonction ne tire rien, elle range.
 */
export function ordreDeSerie<T>(parNiveau: Record<Niveau, readonly T[]>, max = QUESTIONS_PAR_SERIE): { question: T; niveau: Niveau }[] {
  const pris = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  const serie: { question: T; niveau: Niveau }[] = []
  const prendre = (n: Niveau, combien: number) => {
    const reste = parNiveau[n].slice(pris[n], pris[n] + combien)
    pris[n] += reste.length
    for (const question of reste) serie.push({ question, niveau: n })
  }
  for (const n of NIVEAUX) prendre(n, QUESTIONS_PAR_MARCHE)
  // Le reste, en montant : les plus dures d'abord n'auraient plus de sens
  // après l'expert ; on reprend où chaque marche s'était arrêtée.
  for (const n of [...NIVEAUX].reverse()) prendre(n, Infinity)
  return serie.slice(0, max)
}

/**
 * L'expérience d'une bonne réponse en campagne — séries, épreuves des
 * sentiers, défi de la semaine. Elle valait celle d'une bonne réponse en
 * soirée (`XP.juste`, 3), choisie le 3 octobre 2026 ; le propriétaire l'a
 * voulue plus généreuse le 6 octobre 2026 : la campagne est ce qu'on joue
 * le plus après le quiz du jour, et les soirées sont rares.
 */
export const XP_PAR_JUSTE = 5

/**
 * Les premières bonnes réponses de chaque journée paient double : revenir
 * chaque jour rapporte plus qu'enchaîner les séries d'un coup (le choix du
 * 6 octobre 2026).
 */
export const JUSTES_DOUBLEES_PAR_JOUR = 20

/**
 * L'expérience d'une journée de campagne (à l'heure de Paris) : chaque bonne
 * réponse paie, sans plafond, et les vingt premières deux fois. Elle avait un
 * plafond, quinze bonnes réponses par jour, pour que la campagne, qui se
 * rejoue sans fin, n'avale pas les soirées ; le propriétaire l'a levé le 3
 * octobre 2026 : « que les gens puissent augmenter à leur rythme ».
 */
export function xpDuJourDeCampagne(justes: number): number {
  const n = Math.max(0, Math.floor(justes))
  return (n + Math.min(n, JUSTES_DOUBLEES_PAR_JOUR)) * XP_PAR_JUSTE
}

/** Ce que rapporte la `n`-ième bonne réponse d'une journée : double parmi les vingt premières. */
export function xpDeLaBonneReponse(n: number): number {
  return n >= 1 ? xpDuJourDeCampagne(n) - xpDuJourDeCampagne(n - 1) : 0
}

/** Toute l'expérience de campagne, journée par journée. */
export function xpDeCampagne(justesParJour: Iterable<number>): number {
  let xp = 0
  for (const n of justesParJour) xp += xpDuJourDeCampagne(n)
  return xp
}

/** Une question de la série, telle que le téléphone la reçoit : sans la bonne réponse. */
export interface QuestionDeCampagne {
  index: number
  texte: string
  reponses: string[]
  categorie: string | null
  niveau: Niveau
  /** Son sous-thème (`shared/etiquettes.ts`) : les sentiers le disent, la série d'avant ne le gardait pas. */
  sousTheme?: string
}

/** Ce que dit une réponse : juste ou non, la bonne, l'anecdote — et la suite. */
export interface ReponseDeCampagne {
  juste: boolean
  bonne: number
  anecdote: string | null
  vies: number
  justes: number
  finie: boolean
  /** Un record battu à la fin de la série. */
  record?: boolean
  /** À la fin de la série : le record d'avant elle — « L'ancien était de 12 ». */
  recordAvant?: number
  /** À la fin de la série : la marche la plus haute qu'elle a atteinte. */
  niveauAtteint?: Niveau
  /** L'expérience que cette réponse rapporte (`xpDeLaBonneReponse`) : double parmi les vingt premières du jour, 0 pour une fausse. */
  xp: number
  suivante?: QuestionDeCampagne
  /** À la fin de la série : les hauts faits et les paliers qu'elle a fait tomber (le Funambule, L'Alpiniste…). */
  recompenses?: { key: string; emoji: string; title: string }[]
  /** Et les légendaires qu'ils ouvrent : la Salamandre, le Serpent à plumes, l'Éléphant… */
  legendaires?: string[]
  /** À la fin d'un défi — de la semaine, ou entre amis : sa place à son classement, pour l'instant. */
  defi?: { rang: number; joueurs: number }
  /** À la fin d'un défi de la semaine : ce qui a éclaté pour lui — l'emoji qu'il porte, ou son légendaire (`CHANCE_ECLAT_DU_DEFI`). */
  eclat?: string
}

/** Une série, telle que sa page la reprend. */
export interface SerieDeCampagne {
  id: string
  vies: number
  justes: number
  total: number
  finie: boolean
  question?: QuestionDeCampagne
  /** Les catégories qu'elle joue ; absentes : toutes. « Rejouer » les reprend, même pour une série reprise d'un autre téléphone. */
  categories?: string[]
  /** Le sujet qu'elle suit à travers toutes les catégories (`shared/sujets.ts`) : une époque, un fil rouge. */
  sujet?: string
}

/**
 * Une série abandonnée (« Recommencer », un retour de joueur du 10 octobre
 * 2026 : on ne pouvait pas repartir tant qu'il restait des vies) : ce que sa
 * fin dit, comme une série perdue — son record et ses hauts faits lus sur ce
 * qu'elle a joué, rien de plus.
 */
export interface FinDeSerie {
  justes: number
  recordAvant: number
  record?: boolean
  niveauAtteint?: Niveau
  recompenses?: { key: string; emoji: string; title: string }[]
  legendaires?: string[]
}

/**
 * Le Tour du monde : autant de bonnes réponses dans une série de chaque
 * catégorie, jouée seule. Ici, pas au serveur : la page de la campagne dit
 * ce qui manque à chaque catégorie.
 */
export const RECORD_DU_TOUR_DU_MONDE = 10

/** La page de la campagne : le record, la série en cours, ce qu'on peut viser. */
export interface EtatDeCampagne {
  record: number
  series: number
  /** L'expérience de campagne gagnée aujourd'hui (Paris). */
  xpAujourdhui: number
  /** Ses bonnes réponses de campagne aujourd'hui : les vingt premières paient double (`JUSTES_DOUBLEES_PAR_JOUR`). */
  justesAujourdhui?: number
  enCours: SerieDeCampagne | null
  /** Les catégories qui ont des questions à jouer, et combien. */
  categories: { categorie: string; questions: number }[]
  /** Les sujets qui ont de quoi faire une série, et combien de questions ; absents : un serveur d'avant. */
  sujets?: { sujet: string; questions: number }[]
  /** Toutes catégories, les questions que la campagne peut poser : sous dix, elle attend. */
  questions: number
  /** Son record dans chaque catégorie jouée seule — ce que le Tour du monde demande, dix dans chacune. */
  records?: { categorie: string; record: number }[]
}

/**
 * Un joueur qui signale une question : qui, ce qu'il en dit, où il l'a
 * jouée et ce qu'il y a répondu — « la B est juste aussi » ne se lit pas
 * de la même façon venant de celui qui a répondu B.
 */
export interface RapportDeSignalement {
  profileId: string
  /** Son prénom et son identifiant, lus au profil ; null : le profil n'existe plus. */
  prenom: string | null
  login: string | null
  texte: string
  le: number
  /** Déjà relu — gardé, corrigé — et quand : un signalement de plus après un « Garder » se lit avec ceux d'avant. */
  traiteLe: number | null
  /** Où il l'a jouée : une série, une épreuve d'un sentier (sa branche, son palier), le défi de la semaine, un défi entre amis. */
  ou: 'serie' | 'sentier' | 'defi' | 'duel'
  branche?: string
  palier?: number
  /** Sa réponse, telle qu'il l'a lue, et si c'était la bonne ; null si elle n'est plus au journal. */
  reponse: string | null
  juste: boolean | null
  /** La version qu'il a jouée n'est plus celle de la base : la question a été corrigée depuis. */
  versionDAvant?: true
}

/** Une question que des joueurs ont signalée, pour l'administrateur (`/admin#campagne`). */
export interface SignalementDeCampagne {
  questionId: string
  texte: string
  reponses: string[]
  bonne: number
  anecdote: string | null
  categorie: string
  sousTheme: string
  /** Sa difficulté estimée à l'écriture (de 1 à 5), et la marche où les réponses de campagne la placent. */
  difficulte: number
  niveau: Niveau
  /** Ses réponses en campagne, séries, épreuves et défis ensemble — relues toutes les dix minutes. */
  mesure: { justes: number; total: number }
  /** D'où elle vient : la base du dépôt, la routine du matin, ou une correction faite ici — et quand elle l'a été. */
  origine: 'depot' | 'routine' | 'correction'
  corrigeeLe: number | null
  /** Déjà retirée de la campagne : il ne reste qu'à refermer ce qu'on en dit. */
  retiree?: true
  /** Combien de joueurs la signalent encore. */
  joueurs: number
  /** Ce que chacun en dit, les plus récents d'abord, ceux déjà relus compris. */
  rapports: RapportDeSignalement[]
  dernier: number
}

/**
 * Ce que l'administrateur corrige d'une question de la campagne : ce que le
 * joueur lit. Le reste de sa fiche — catégorie, sous-thème, difficulté
 * estimée — ne bouge pas ; ses leurres suivent les réponses.
 */
export interface CorrectionDeQuestion {
  texte: string
  reponses: string[]
  bonne: number
  anecdote: string | null
}

/** Ce que dit une correction enregistrée : sous quel identifiant la question se joue désormais. */
export interface QuestionCorrigee {
  id: string
  /** La bonne réponse a changé : un nouvel identifiant, l'ancienne retirée. */
  nouvelle: boolean
}

/** La campagne, côté administrateur : sa base, et ce que les joueurs y signalent. */
export interface AdminDeLaCampagne {
  /** Toute la base, et ce que la campagne peut en poser : moins les questions retirées, et celles du quiz du jour. */
  questions: number
  jouables: number
  retirees: number
  parCategorie: { categorie: string; questions: number }[]
  /** Les jouables de chaque catégorie, par difficulté estimée à l'écriture (de 1 à 5) : ce que la routine rattrape. */
  parDifficulte: { categorie: string; difficultes: number[] }[]
  /** Ce que la routine du matin a ajouté (`/api/campagne/base`). */
  ajouts: AjoutsDeLaRoutine
  signalements: SignalementDeCampagne[]
}

/** La commande du matin, pour la routine qui agrandit la base (`GET /api/campagne/base`). */
export interface CommandeDeLaBase {
  /** Toutes catégories : ce qu'il reste à écrire aujourd'hui. Zéro : la routine s'arrête en une ligne. */
  aEcrire: number
  /** Ce qu'un dépôt porte au plus. */
  parEnvoi: number
  /**
   * Ce qu'on donne d'abord à l'IA qui écrit, une fois pour toutes les
   * catégories : le format, les règles, l'échelle — null quand il n'y a rien
   * à écrire. Absente d'un serveur d'avant, dont chaque consigne était entière.
   */
  consigneCommune: string | null
  categories: {
    categorie: string
    aEcrire: number
    /** Chaque sous-thème à écrire, combien, et à quelle difficulté. */
    quotas: { cle: string; n: number; difficulte?: number }[]
    /** Sa part de la consigne, à lire après la commune — null quand la catégorie a son compte du jour. */
    consigne: string | null
  }[]
}

/** Ce que dit un dépôt de la routine (`POST /api/campagne/base`). */
export interface DepotDeLaBase {
  ajoutees: number
  ecartees: { texte: string; motif: string }[]
}

/** Ce que la routine a ajouté à la base, pour l'administrateur. */
export interface AjoutsDeLaRoutine {
  aujourdhui: number
  septJours: number
  total: number
  dernierLe: number | null
  /**
   * Les plus récents d'abord : un coup d'œil, et « Retirer » si l'un cloche.
   * Corrigé depuis, il se lit dans sa version du jour ; remplacé — sa bonne
   * réponse a changé —, il est retiré, et sa remplaçante se joue à sa place.
   */
  derniers: { id: string; texte: string; categorie: string; sousTheme: string; difficulte: number; ajouteeLe: number; retiree: boolean; remplacee?: true }[]
}

/** Une question corrigée, à la fin d'une série : « Mes réponses ». */
export interface CorrectionDeCampagne {
  texte: string
  reponses: string[]
  bonne: number
  choix: number | null
  juste: boolean
  niveau: Niveau
  anecdote: string | null
}

// ── Le défi de la semaine ─────────────────────────────────────────────────

/**
 * Le défi de la semaine : la même série pour tous, du lundi au dimanche à
 * Paris — tirée au premier qui l'ouvre, puis figée —, trois vies, sans
 * chronomètre, une seule tentative. Son classement compte les bonnes
 * réponses, rang partagé (invariant 15) ; ses premiers portent le laurier
 * d'argent toute la semaine suivante — à deux joueurs au moins, comme le
 * champion du mois : seul, on n'a battu personne.
 */
export const JOUEURS_POUR_LE_DEFI = 2

/**
 * Le lundi de la semaine d'un jour de Paris, « 2026-10-05 » : la clé du
 * défi. Lu au calendrier, sans fuseau — le jour est déjà celui de Paris.
 */
export function semaineDe(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number)
  const depuisLundi = (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7
  return jourAvant(jour, depuisLundi)
}

/** La semaine d'avant (`n` = 1), ou d'après (`n` négatif). */
export const semaineAvant = (semaine: string, n = 1) => jourAvant(semaine, 7 * n)

/**
 * Les minutes qui restent avant la clôture du défi, lundi à minuit (Paris) :
 * comptées jusqu'à l'instant où la semaine change, comme `minutesAvantMinuit`
 * — une semaine qui passe à l'heure d'hiver a une heure de plus.
 */
export function minutesAvantLundi(instant: number): number {
  const semaine = semaineDe(jourDe(instant))
  let avant = instant
  let apres = instant + 8 * 24 * 3_600_000
  while (apres - avant > 1000) {
    const milieu = Math.floor((avant + apres) / 2)
    if (semaineDe(jourDe(milieu)) === semaine) avant = milieu
    else apres = milieu
  }
  return Math.max(1, Math.round((apres - instant) / 60_000))
}

/** Une ligne du classement du défi : comme celle du quiz du jour, ses bonnes réponses au lieu de points. */
export interface LigneDuDefi {
  profileId: string
  /** Le prénom de son profil, marque d'homonymie comprise. */
  nom: string
  avatar: string
  niveau: number
  finition?: Finition
  legendaire?: string
  eclat?: true
  laurier?: LaurierPorte
  justes: number
  rang: number
  /** Sa tentative n'est pas finie : il peut encore monter. */
  enCours?: true
}

/** La page du défi (`GET /api/campagne/defi`). */
export interface DefiDeLaSemaine {
  /** Le lundi de la semaine, « 2026-10-05 ». */
  semaine: string
  /** Les minutes avant sa clôture, lundi à minuit à Paris. */
  minutesRestantes: number
  /** Sa tentative : en cours, elle se reprend ; finie, elle attend la semaine prochaine. */
  tentative: SerieDeCampagne | null
  joueurs: number
  lignes: LigneDuDefi[]
  /** Sa ligne, si elle n'est pas dans celles qu'on montre. */
  moi?: LigneDuDefi
  /** Qui regarde, s'il est classé : sa ligne se distingue. */
  sienne?: string
  /** Les premiers de la semaine passée : le laurier d'argent est à eux cette semaine. */
  vainqueurs: { nom: string; avatar: string }[]
  /**
   * Sa semaine passée, s'il a relevé le défi : sa place, ce qu'elle lui a
   * valu, et de quoi relire sa correction — qui attend la clôture, pour ne
   * rien souffler à ceux qui jouent encore.
   */
  saSemainePassee?: { serie: string; justes: number; rang: number; joueurs: number; recompenses: PalierTombe[] }
}

// ── Le défi entre amis ──────────────────────────────────────────────────────
//
// Le défi de la semaine se joue contre tout le monde ; celui-ci, contre qui
// on veut, en différé (un retour de joueur du 10 octobre 2026 : « un mode
// défi en différé, compétitif ») : on lance un tirage, on le joue, on
// envoie le lien — chacun de ceux qui l'ouvrent, profil en main, joue les
// mêmes questions, une fois, dans la semaine. Ni laurier, ni haut fait :
// rien qu'on gagnerait à se défier soi-même d'un second profil.

/** Une semaine pour le relever : ensuite, son classement se fige et sa correction s'ouvre. */
export const DUREE_D_UN_DUEL_MS = 7 * 24 * 3_600_000

/** Les défis qu'un joueur tient ouverts à la fois : chacun fige son tirage en base. */
export const DUELS_OUVERTS_MAX = 5

/** Les lettres d'un code de défi : ni 0 ni O, ni 1, I ni L, qu'on confond en les recopiant. */
export const LETTRES_D_UN_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const LONGUEUR_D_UN_CODE = 6

/** Le code d'un défi lu dans une saisie ou une adresse (`#duel-K7M2QX`) : en capitales, ou null. */
export function lireCodeDuDuel(brut: unknown): string | null {
  if (typeof brut !== 'string') return null
  const code = brut.trim().replace(/^#?duel-/i, '').toUpperCase()
  return code.length === LONGUEUR_D_UN_CODE && [...code].every(c => LETTRES_D_UN_CODE.includes(c)) ? code : null
}

/** La page d'un défi entre amis (`GET /api/campagne/duel/:code`). */
export interface DuelEntreAmis {
  code: string
  /** Qui l'a lancé ; `toi` quand c'est lui qui regarde. */
  auteur: { nom: string; avatar: string; toi?: true }
  /** Ce qu'il fait jouer : un sujet, ou des catégories ; ni l'un ni l'autre : toutes. */
  sujet?: string
  categories?: string[]
  /** Les minutes avant qu'il ferme ; 0 : fermé, son classement figé et sa correction ouverte. */
  minutesRestantes: number
  /** Sa tentative : en cours, elle se reprend ; finie, elle attend les autres. */
  tentative: SerieDeCampagne | null
  joueurs: number
  lignes: LigneDuDefi[]
  moi?: LigneDuDefi
  sienne?: string
}

/** Un défi entre amis qu'il a lancé ou relevé, pour le retrouver (`GET /api/campagne/duels`). */
export interface ResumeDuDuel {
  code: string
  auteur: string
  sujet?: string
  categories?: string[]
  joueurs: number
  /** Ses bonnes réponses et sa place, s'il y a répondu. */
  justes: number | null
  rang: number | null
  minutesRestantes: number
}

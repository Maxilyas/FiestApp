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
import type { EtatDuCarnet, SuiteDeLaRevision } from './revision'
import type { BordureDeLigue, CleDeLigue, CoteApresLeDuel, EnjeuDuDuel, JoueurCroise, SemaineDesDuels } from './duels'
import type { IssueDUnSignalement } from './qgSignalements'

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
 * mesuré ne montait pas (l'état des lieux du 3 octobre 2026). Les réponses
 * fictives partent du taux de sa famille quand elle en a un (`depart`,
 * `mesuresEnFamille`), de son estimation d'écriture sinon.
 */
export function tauxLisse(difficulte: number, justes = 0, total = 0, depart?: number): number {
  const a = depart ?? TAUX_A_PRIORI[difficulte] ?? TAUX_A_PRIORI[3]
  return (justes + REPONSES_FICTIVES * a) / (total + REPONSES_FICTIVES)
}

/**
 * Ce que la campagne sait d'une question : ses bonnes réponses et ses
 * réponses — révisions exclues —, et la part d'où partent ses réponses
 * fictives, celle de sa famille (`mesuresEnFamille`). Sans `depart`, son
 * estimation d'écriture (`TAUX_A_PRIORI`).
 */
export interface MesureDUneQuestion {
  justes: number
  total: number
  depart?: number
}

/** Le niveau d'une question de la base : son a priori, corrigé par les réponses de campagne. */
export function niveauDeQuestion(difficulte: number, mesure?: MesureDUneQuestion): Niveau {
  return niveauDuTaux(tauxLisse(difficulte, mesure?.justes, mesure?.total, mesure?.depart))
}

// ── Les familles ────────────────────────────────────────────────────────────
//
// Une question ne se mesurait que par ses propres réponses : vingt réponses
// fictives de son estimation contre au plus sept vrais joueurs, en
// production, le 15 octobre 2026 — l'estimation gagnait toujours. Sur 5 801
// questions jouées, 39 avaient changé de marche, et aucune moyenne n'était
// devenue difficile : les quatorze que moins de 30 % des joueurs trouvaient
// restaient moyennes, Lincoln compris (0 sur 5). Une famille — les questions
// d'une même catégorie et d'une même difficulté estimée, les années, les
// nombres et les vrai ou faux mis à part — en a des centaines : sa part se
// mesure, et chaque question en part au lieu de partir de l'estimation seule.
// Mesuré ce jour-là : une 3 qui se répond par une année se trouve à 33 %,
// une 2 du sport à 66 %, une 2 des sciences à 82 %.

/**
 * Les difficultés estimées qui partent de leur famille. Au-delà, seuls les
 * plus forts atteignent ces questions, au bout d'une série ou en haut des
 * sentiers : leur part mesurée dirait qui les a jouées plus que ce qu'elles
 * valent — 41 % pour les 4, 33 % une fois corrigée de qui avait répondu (le
 * modèle du savoir, le 15 octobre 2026). Elles gardent leur estimation.
 */
export const DIFFICULTES_EN_FAMILLE: readonly number[] = [1, 2, 3]

/**
 * La forme de la bonne réponse : ce qui, à difficulté égale, la rend plus
 * dure. Une année ne se devine pas — quatre dates voisines, et rien pour
 * écarter les leurres —, un autre nombre non plus, et un vrai ou faux se joue
 * à pile ou face. Mesuré sur les 3 le 15 octobre 2026 : 33 % pour une année,
 * 51 % pour un nombre, 56 % pour des mots.
 */
export type FormeDeReponse = 'annee' | 'nombre' | 'vrai-faux' | 'mots'

/** Une année, de 1000 à 2099 : au-delà, ou avec une unité (« 1920 pixels »), c'est un nombre. */
const ANNEE = /^(1\d{3}|20\d{2})$/

export function formeDeReponse(q: { reponses: readonly string[]; bonne: number; valeur?: { unite: string } | null }): FormeDeReponse {
  if (q.reponses.length === 2) return 'vrai-faux'
  const bonne = (q.reponses[q.bonne] ?? '').trim()
  if (ANNEE.test(bonne) && !q.valeur?.unite) return 'annee'
  return q.valeur || /\d/.test(bonne) ? 'nombre' : 'mots'
}

/**
 * La famille d'une question : sa catégorie et sa difficulté estimée, ou, pour
 * une année, un nombre ou un vrai ou faux, sa forme et sa difficulté, toutes
 * catégories ensemble — chaque catégorie n'en a que quelques dizaines. Null
 * hors de `DIFFICULTES_EN_FAMILLE`.
 */
export function familleDeQuestion(q: { categorie: string; difficulte: number; forme: FormeDeReponse }): string | null {
  if (!DIFFICULTES_EN_FAMILLE.includes(q.difficulte)) return null
  return `${q.forme === 'mots' ? q.categorie : '*'}|${q.forme}|${q.difficulte}`
}

/**
 * Les mesures de la base, chaque question d'une famille avec la part d'où
 * elle part (`depart`) : celle de ses voisines de famille, lissée elle aussi
 * vers l'estimation d'écriture (`tauxLisse`). La famille se compte sur la
 * première réponse de chacun (`premieres`) : revue, une question a déjà
 * montré sa correction — les dates ratées puis revues passaient de 33 à 38 %
 * en production, et leur famille restait moyenne. Ses propres réponses n'y
 * sont pas — elles comptent déjà pour elle : deux fois, elles la pousseraient
 * deux fois —, et une question n'y pèse que `REPONSES_FICTIVES` réponses au
 * plus : une question piège, ratée cent fois, n'emporte pas toute sa famille.
 * Les questions jamais jouées y ont leur ligne, à zéro réponse : c'est d'elles
 * que la famille dit le plus. Pure : les tirages, le quiz tout prêt et
 * l'administration la lisent pareil.
 */
export function mesuresEnFamille(
  questions: Iterable<{ id: string; difficulte: number; famille: string | null }>,
  parQuestion: ReadonlyMap<string, { justes: number; total: number }>,
  premieres: ReadonlyMap<string, { justes: number; total: number }> = parQuestion,
): Map<string, MesureDUneQuestion> {
  // Le poids d'une question dans sa famille : toutes ses réponses jusqu'à vingt, vingt au-delà.
  const poids = (m: { total: number } | undefined) => (!m || m.total <= 0 ? 0 : m.total <= REPONSES_FICTIVES ? 1 : REPONSES_FICTIVES / m.total)
  const sommes = new Map<string, { justes: number; total: number }>()
  const membres: { id: string; difficulte: number; famille: string }[] = []
  for (const q of questions) {
    if (!q.famille) continue
    membres.push(q as { id: string; difficulte: number; famille: string })
    const m = premieres.get(q.id)
    const k = poids(m)
    if (k === 0) continue
    let s = sommes.get(q.famille)
    if (!s) sommes.set(q.famille, (s = { justes: 0, total: 0 }))
    s.justes += m!.justes * k
    s.total += m!.total * k
  }
  const mesures = new Map<string, MesureDUneQuestion>(parQuestion)
  // Une question jamais jouée part de toute sa famille : une seule ligne, la
  // même pour toutes — quatorze mille objets refaits toutes les dix minutes,
  // au dixième de cœur de l'hébergeur, pour dire treize fois la même chose.
  const jamaisJouees = new Map<string, MesureDUneQuestion>()
  for (const q of membres) {
    const s = sommes.get(q.famille)
    if (!s) continue
    const m = parQuestion.get(q.id)
    const p = premieres.get(q.id)
    if (!m && !p) {
      let ligne = jamaisJouees.get(q.famille)
      if (!ligne) jamaisJouees.set(q.famille, (ligne = Object.freeze({ justes: 0, total: 0, depart: tauxLisse(q.difficulte, s.justes, s.total) })))
      mesures.set(q.id, ligne)
      continue
    }
    const k = poids(p)
    const voisines = { justes: s.justes - (p ? p.justes * k : 0), total: s.total - (p ? p.total * k : 0) }
    // Seule mesurée de sa famille : ses voisines ne disent rien encore.
    if (voisines.total < 1e-9) continue
    mesures.set(q.id, { justes: m?.justes ?? 0, total: m?.total ?? 0, depart: tauxLisse(q.difficulte, voisines.justes, voisines.total) })
  }
  return mesures
}

// ── Ce que les réponses contredisent ────────────────────────────────────────

/**
 * La marche que les seules réponses d'une question diraient, quand elle n'est
 * pas celle où la campagne la tire, et de combien elles la contredisent
 * (`force`) : l'écart à la part d'où elle partait — sa famille, ou son
 * estimation —, compté en écarts types d'un tirage de `total` réponses. Null
 * sous `REPONSES_POUR_MESURER` réponses, ou d'accord avec sa marche. Les
 * familles reclassent d'elles-mêmes ce qui ressemble à ses voisines : restent
 * les questions qui font exception à la leur (le choix du 15 octobre 2026 :
 * « la liste des moyennes que personne ne trouve »).
 */
export function marcheContredite(
  difficulte: number,
  mesure: MesureDUneQuestion | undefined,
): { niveau: Niveau; niveauMesure: Niveau; force: number; difficulteProposee: number } | null {
  if (!mesure || mesure.total < REPONSES_POUR_MESURER) return null
  const part = mesure.justes / mesure.total
  const niveau = niveauDeQuestion(difficulte, mesure)
  const niveauMesure = niveauDuTaux(part)
  if (niveau === niveauMesure) return null
  const depart = Math.min(0.99, Math.max(0.01, mesure.depart ?? TAUX_A_PRIORI[difficulte] ?? TAUX_A_PRIORI[3]))
  const force = Math.abs(part - depart) / Math.sqrt((depart * (1 - depart)) / mesure.total)
  return { niveau, niveauMesure, force, difficulteProposee: difficultePourLaPart(part) }
}

/**
 * La difficulté estimée qui va à une part de bonnes réponses : celle de sa
 * marche — la 1 pour une question que presque tout le monde trouve, la 2
 * pour le reste des faciles. Ce que « Reclasser » propose au QG.
 */
export function difficultePourLaPart(part: number): number {
  const n = niveauDuTaux(part)
  return n === 'facile' ? (part >= 0.85 ? 1 : 2) : n === 'moyen' ? 3 : n === 'difficile' ? 4 : 5
}

/** Une question de la base que ses réponses contredisent, pour l'administrateur (`/admin#campagne`). */
export interface QuestionContredite {
  questionId: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string
  sousTheme: string
  difficulte: number
  /** La marche où la campagne la tire, et celle que ses seules réponses diraient. */
  niveau: Niveau
  niveauMesure: Niveau
  /** Ses réponses, révisions exclues. */
  mesure: { justes: number; total: number }
  difficulteProposee: number
}

/** Au plus, les questions contredites que le QG montre : les plus nettes d'abord. */
export const CONTREDITES_MONTREES = 20

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
  /** À la fin d'un défi entre amis qu'il a lancé : les amis choisis au lancement, à qui il vient de partir (`campagne_envois_prevus`). */
  partiA?: string[]
  /** À la fin d'un duel classé qu'il a lancé : sa cote bougera quand l'autre l'aura joué (`shared/duels.ts`). */
  classe?: true
  /**
   * À la fin d'un duel classé joué le second : celui d'en face et son score —
   * le duel est joué, les deux cotes ont bougé (`duel`). Son profil, pour la
   * revanche ; absent d'un masqué, qu'on ne retrouve pas.
   */
  contre?: Adversaire & { profileId?: string }
  /** À la fin d'un défi de la semaine : ce qui a éclaté pour lui — l'emoji qu'il porte, ou son légendaire (`CHANCE_ECLAT_DU_DEFI`). */
  eclat?: string
  /** Une révision (`shared/revision.ts`) : où en est la question après cette réponse — apprise, ou quand elle revient. */
  revision?: SuiteDeLaRevision
  /** À la fin d'une révision : son carnet, relu. */
  carnet?: EtatDuCarnet
  /** Une rencontre : ce que l'adversaire avait fait de cette question, et les deux scores. */
  rencontre?: CoupDeLaRencontre
  /** À la fin d'une rencontre — un duel classé (`shared/duels.ts`) : ce qu'elle a fait à sa cote, à sa ligue et à sa semaine. */
  duel?: CoteApresLeDuel
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
  /** Les sujets et les rubriques (`SUJETS_ET_RUBRIQUES`) qui ont de quoi faire une série, et combien de questions ; absents : un serveur d'avant. */
  sujets?: { sujet: string; questions: number }[]
  /** Toutes catégories, les questions que la campagne peut poser : sous dix, elle attend. */
  questions: number
  /** Son record dans chaque catégorie jouée seule — ce que le Tour du monde demande, dix dans chacune. */
  records?: { categorie: string; record: number }[]
}

/**
 * Ce que la campagne peut poser, le même pour tous : ses catégories et ses
 * sujets jouables (`GET /api/campagne/choix`). La préparation d'un duel n'a
 * besoin que de cela, et l'attendait dans tout l'état de la campagne
 * (`EtatDeCampagne`) — quatre lectures de son passé avant de s'ouvrir.
 */
export type ChoixDeLaCampagne = Required<Pick<EtatDeCampagne, 'categories' | 'sujets'>>

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
  /** Ce qui en a été fait, quand il a été relu (`shared/qgSignalements.ts`) ; null : relu avant qu'on l'écrive, le 14 octobre 2026. */
  issue: IssueDUnSignalement | null
  /** Où il l'a jouée : une série, une épreuve d'un sentier (sa branche, son palier), le défi de la semaine, un défi entre amis, une révision de son carnet, une rencontre, un parcours de thème (`sujet`), une expédition. */
  ou: 'serie' | 'sentier' | 'defi' | 'duel' | 'revision' | 'rencontre' | 'sujet' | 'expedition'
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
  /** Les questions jouables que leurs réponses contredisent (`marcheContredite`), les plus nettes d'abord, `CONTREDITES_MONTREES` au plus ; et combien en tout. */
  contredites: QuestionContredite[]
  contreditesEnTout: number
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
  /** Un vrai ou faux de l'expédition tiré d'une question à quatre choix : la réponse qu'il proposait. */
  proposee?: string
  /** Le même, quand la réponse proposée était fausse : la bonne de ses quatre réponses. */
  bonneReponse?: string
  /**
   * Une question à composer de l'expédition (v11) : ce qu'il a composé, en
   * capitales. Ses `reponses` sont sa bonne et, fausse, cette composition :
   * ni choix, ni leurs formes.
   */
  composee?: string
  /** Un rébus de l'expédition (une curiosité, v12) : ses emojis, que l'intitulé désigne. */
  rebus?: string
  /**
   * Une frise de l'expédition (v13) : ses `reponses` sont ses événements dans
   * l'ordre du temps ; leurs années, alignées, et, ratée, l'ordre qu'il avait
   * donné — le rang dans le temps de chaque événement qu'il avait posé, du
   * premier au dernier (`sienne`).
   */
  frise?: { annees: number[]; sienne?: number[] }
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
  /** Sa bordure de ligue des duels, autour de son avatar (`ProfileStore.bordureDe`). */
  bordure?: BordureDeLigue
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
  /** Les premiers de la semaine passée : le laurier d'argent est à eux cette semaine. Avec ce qu'ils portent : l'emoji seul les montrait autrement qu'au classement. */
  vainqueurs: ({ nom: string; avatar: string } & SonApparence)[]
  /**
   * Sa semaine passée, s'il a relevé le défi : sa place, ce qu'elle lui a
   * valu, et de quoi relire sa correction — qui attend la clôture, pour ne
   * rien souffler à ceux qui jouent encore.
   */
  saSemainePassee?: { serie: string; justes: number; rang: number; joueurs: number; recompenses: PalierTombe[] }
}

/**
 * Le défi de la semaine sur l'accueil, à tout profil, dans son onglet à côté
 * du quiz du jour (`CampagneStore.defiDAccueil`) : ceux qui l'ont relevé,
 * comptés comme son classement, et sa tentative — ouverte, ou finie avec sa
 * place. Ce que l'onglet dit, la page du défi le montre.
 */
export interface DefiDAccueil {
  joueurs: number
  /** Sa tentative ouverte : ses bonnes réponses, à reprendre. */
  enCours?: { justes: number }
  /** Sa tentative finie : ses bonnes réponses et sa place, rang partagé (invariant 15) — le classement court jusqu'à dimanche minuit. */
  releve?: { justes: number; rang: number }
}

// ── Le défi entre amis ──────────────────────────────────────────────────────
//
// Le défi de la semaine se joue contre tout le monde ; celui-ci, contre qui
// on veut, en différé (un retour de joueur du 10 octobre 2026 : « un mode
// défi en différé, compétitif ») : on choisit à qui et sur quoi, on le joue
// d'abord — et à sa dernière réponse, il part aux amis choisis, en
// notification sur leur téléphone (le souhait du propriétaire du
// 11 octobre 2026 : « choisir avec qui je le lance, sur quel thème […] et
// que ça envoie une notif à la personne pour faire le même ») ; aux autres,
// par son lien. Chacun de ceux qui l'ouvrent, profil en main, joue les
// mêmes questions, une fois, dans la semaine. Ni laurier, ni haut fait :
// rien qu'on gagnerait à se défier soi-même d'un second profil.

/** Une semaine pour le relever : ensuite, son classement se fige et sa correction s'ouvre. */
export const DUREE_D_UN_DUEL_MS = 7 * 24 * 3_600_000

/**
 * Les défis entre amis d'avant qu'un joueur tient ouverts à la fois : chacun
 * fige son tirage en base. Un duel classé n'a pas de plafond — un seul ouvert
 * par adversaire suffit (le choix du propriétaire du 13 octobre 2026 : « je
 * veux pouvoir avoir autant de défis en cours que possible »).
 */
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
  /**
   * Qui l'a lancé ; `toi` quand c'est lui qui regarde. Un duel classé dit sa
   * ligue, s'il a fini un duel classé : l'anneau de son avatar, le bord de sa
   * carte en prennent la couleur. Et ce qu'il porte, son légendaire comme au
   * classement (`SonApparence`).
   */
  auteur: { nom: string; avatar: string; toi?: true; ligue?: CleDeLigue } & SonApparence
  /** Ce qu'il fait jouer : un sujet, ou des catégories ; ni l'un ni l'autre : toutes. */
  sujet?: string
  categories?: string[]
  /** Les minutes avant qu'il ferme ; 0 : fermé, son classement figé et sa correction ouverte. */
  minutesRestantes: number
  /** Sa tentative : en cours, elle se reprend ; finie, elle attend les autres. */
  tentative: SerieDeCampagne | null
  /** Le sien, pas encore joué jusqu'au bout : les amis choisis au lancement, à qui il partira à sa dernière réponse. */
  prevus?: string[]
  /**
   * Un duel classé (`shared/duels.ts`) : qui a été défié — `toi` quand c'est
   * lui qui regarde —, sa ligue et ce qu'il porte comme l'auteur, et, joué
   * des deux côtés, ce qu'il a fait à sa cote.
   */
  contre?: { nom: string; avatar: string; toi?: true; ligue?: CleDeLigue } & SonApparence
  ecart?: number
  /** Un duel classé qu'il n'a pas encore fini : ce qu'il met en jeu sur sa cote, contre la cote d'en face figée au lancement (`enjeuContre`). */
  enjeu?: EnjeuDuDuel
  /**
   * Un duel classé que l'autre a fini : son score — dit une fois sa propre
   * tentative finie, ou le duel fermé. Avant, il ne part pas : on le voyait
   * avant même de jouer (le souhait du propriétaire du 12 octobre 2026).
   */
  aBattre?: number
  /** Un duel classé joué des deux côtés : sa correction est ouverte — personne d'autre n'y joue. */
  corrige?: true
  /**
   * Joué des deux côtés, et vu pour la première fois par qui l'a lancé : la
   * page retourne sa carte devant lui. Cette lecture l'a retenu vu
   * (`campagne_duels.vu_le`) : l'accueil ne le compte plus.
   */
  nouveau?: true
  /** Joué des deux côtés : sa cote juste après ce duel, sa ligue, sa place au classement des duels aujourd'hui, et sa semaine. */
  apres?: { cote: number; ligue: CleDeLigue; rang?: number; semaine?: SemaineDesDuels }
  /** Joué des deux côtés : celui d'en face, pour la revanche — absent d'un masqué ou d'un profil parti, qu'on ne défie pas —, avec ce qu'il porte. */
  revanche?: { profileId: string; nom: string; avatar: string } & SonApparence
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

// Ses amis (le souhait du propriétaire du 11 octobre 2026 : « défi entre amis
// avec liste d'amis », puis « une liste d'amis avec leur classement et leur
// ligue, et pouvoir ajouter des amis ») : ceux qu'il a ajoutés — trouvés par
// leur prénom, d'un toucher, sans demande ni attente : sa liste à lui, comme
// un carnet d'adresses —, et ceux avec qui il a joué un défi ou un duel. Un
// profil masqué n'y paraît jamais. Un ami se retire d'un toucher : ni lui ni
// ses défis ne parviennent plus, jusqu'à ce qu'il l'ajoute de nouveau ou
// qu'ils jouent de nouveau ensemble.

/** Les amis qu'on montre, les plus récents d'abord : de quoi défier sa bande, pas un annuaire. */
export const AMIS_MONTRES = 40

/** Les défis reçus qu'on montre, les plus récents d'abord. */
export const DEFIS_RECUS_MONTRES = 10

/** Un ami : quelqu'un avec qui il a joué un défi entre amis. */
/**
 * Ce qu'un joueur porte, comme une ligne de classement le montre : sa
 * finition, le médaillon qu'il porte à la place de l'emoji, son Éclat. Ses
 * amis, ses défis reçus et une recherche ne disaient que l'emoji : une amie
 * avait deux visages sur la même page — une chouette dans « Tes amis », son
 * écureuil peint au classement (l'experte du jeu solo, le 11 octobre 2026).
 */
export interface SonApparence {
  finition?: Finition
  legendaire?: string
  eclat?: true
  /** La bordure de ligue qu'il porte, là où ses duels sont lus avec lui (`bordurePortee`). */
  bordure?: BordureDeLigue
}

export interface AmiDeCampagne extends SonApparence {
  profileId: string
  /** Son prénom, marqué « (2) » s'il en partage un autre et l'avatar avec (`nomsAffiches`). */
  nom: string
  avatar: string
  /** Lu pour un défi (`?duel=`) : il le lui a déjà envoyé, ou l'ami l'a relevé — rien à renvoyer. */
  deja?: 'recu' | 'releve'
  /** Sa cote et sa ligue, s'il a fini un duel classé ; sa place au classement des duels, s'il y est. */
  cote?: number
  ligue?: CleDeLigue
  rang?: number
  /**
   * En ligne ces cinq dernières minutes — dans la feuille des amis seulement
   * (`AmisDeLaFeuille`), et seulement entre amis réciproques : chacun a
   * ajouté l'autre. Rien sinon : l'absence, pas « hors ligne ».
   */
  enLigne?: true
}

/**
 * La feuille des amis (`GET /api/duels/amis`, le souhait du propriétaire du
 * 11 octobre 2026 : « une fenêtre avec la liste des amis, s'il est connecté,
 * ajouter, supprimer, défier ») : sa liste — qui est en ligne, entre amis
 * réciproques —, ceux qui l'ont ajouté sans qu'il les ait ajoutés, et des
 * joueurs qu'il a croisés, à ajouter d'un toucher.
 */
export interface AmisDeLaFeuille {
  amis: AmiDeCampagne[]
  /** Ceux qui l'ont ajouté et qu'il n'a pas ajoutés, les plus récents d'abord (`AJOUTS_MONTRES` au plus) — jamais un qu'il a retiré. */
  tOntAjoute: AmiDeCampagne[]
  /** Des joueurs qu'il a croisés (`JOUEURS_CROISES` au plus) — ni un ami, ni l'un de ceux qui l'ont ajouté. */
  croises: JoueurCroise[]
}

/** « Ils t'ont ajouté » : les plus récents, de quoi rendre la pareille — pas une liste de suiveurs. */
export const AJOUTS_MONTRES = 5

/** Un défi qu'on lui a envoyé — d'un ami, ou un duel classé de qui l'a défié —, qu'il n'a pas encore relevé. */
export interface DefiRecu {
  code: string
  auteur: { nom: string; avatar: string } & SonApparence
  sujet?: string
  categories?: string[]
  minutesRestantes: number
  /** Un duel classé : sa cote s'y joue. */
  classe?: true
  /** Le score à battre de qui l'a lancé, sa tentative finie — un défi entre amis seulement : celui d'un duel classé se dévoile à sa dernière réponse. */
  score?: number
}

/** Ses amis et ce qu'ils lui ont envoyé (`GET /api/campagne/amis`). */
export interface MesAmis {
  amis: AmiDeCampagne[]
  recus: DefiRecu[]
  /** Lu pour un défi (`?duel=`) qu'il a lancé : il peut l'envoyer. Celui d'un autre se partage par son lien. */
  sien?: true
}

// ── Affronter un inconnu ────────────────────────────────────────────────────
//
// Un adversaire tout de suite, sans liste d'amis ni attente (le choix du
// 10 octobre 2026, après la question « peut-on défier des inconnus ? ») : la
// série finie d'un autre joueur, de son niveau — ses questions, dans le même
// ordre, et son score à battre. Rien à modérer : on ne s'écrit pas, on ne
// s'attend pas. Ni classement, ni laurier, ni Éclat : un face-à-face, qui
// paie comme une série. Depuis le 13 octobre 2026, c'est toujours Automate,
// l'adversaire simulé, qui joue comme lui (`core/campagne.ts`) : son niveau
// ne se lit plus à la médiane de ses dix dernières séries, mais dans toutes
// ses réponses (`core/modeleDuSavoir.ts`).

export type IssueDeRencontre = 'gagnee' | 'perdue' | 'egalite'

/** L'issue d'une rencontre finie : plus de bonnes réponses que lui, autant, ou moins. */
export const issueDeRencontre = (toi: number, lui: number): IssueDeRencontre => (toi > lui ? 'gagnee' : toi === lui ? 'egalite' : 'perdue')

/**
 * Un adversaire : son prénom, son avatar et ce qu'il porte (`SonApparence` :
 * son légendaire, pas l'emoji d'en dessous), et ses bonnes réponses sur ces
 * questions — le score à battre.
 */
export interface Adversaire extends SonApparence {
  nom: string
  avatar: string
  justes: number
  /**
   * Automate, l'adversaire simulé — quand il a affronté toutes les séries
   * des autres, le dé ne disparaît plus (le souhait du propriétaire du
   * 13 octobre 2026) : la page le dit simulé.
   */
  simule?: true
}

/**
 * L'adversaire d'une rencontre qui se joue : son prénom, son avatar, ce qu'il
 * porte. Son score entier ne part qu'à la dernière réponse
 * (`CoupDeLaRencontre.enTout`) — « à battre : 8 » se lisait avant même la
 * première question (le souhait du propriétaire du 12 octobre 2026). Question
 * par question, ce qu'il en avait fait se dit après sa réponse à soi.
 */
export type AdversaireEnJeu = Omit<Adversaire, 'justes'>

/** Une rencontre, commencée ou reprise (`POST /api/campagne/rencontre`) : la partie, et qui l'on affronte. */
export interface RencontreDeCampagne {
  serie: SerieDeCampagne
  adversaire: AdversaireEnJeu
  /** Ses bonnes réponses sur les questions déjà jouées : le score d'en face, quand on la reprend. */
  sesJustes: number
  /** Ce qu'elle met en jeu sur sa cote, redit à chaque question — à chances égales, connu avant de tirer (`enjeuDuDe`) ; absent d'un serveur d'avant. */
  enjeu?: EnjeuDuDuel
}

/**
 * Ce qu'une réponse de rencontre dit en plus : ce que l'adversaire avait
 * fait de cette question — juste, faux, ou null s'il s'était arrêté avant —,
 * et les deux scores à cet instant ; finie, son issue.
 */
export interface CoupDeLaRencontre {
  lui: boolean | null
  toi: number
  sesJustes: number
  issue?: IssueDeRencontre
  /** Finie : son score entier, enfin dit — la carte du verdict le retourne. */
  enTout?: number
}

/** Une rencontre de sa liste (`GET /api/campagne/rencontres`). */
export interface ResumeDeRencontre {
  serie: string
  adversaire: Adversaire
  justes: number
  /** Null : en cours. */
  issue: IssueDeRencontre | null
  le: number
  /** Ce qu'elle a fait à sa cote (`releverLesDuels`) ; absent d'une rencontre en cours. */
  ecart?: number
}

export interface MesRencontres {
  enCours: RencontreDeCampagne | null
  /** Les plus récentes d'abord. */
  passees: ResumeDeRencontre[]
}

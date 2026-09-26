// Le profil d'un joueur récurrent : son niveau, ses finitions d'avatar, le
// barème d'expérience d'une soirée, et les chiffres qu'elle laisse.
//
// Les hauts faits vivent dans `shared/hautsfaits.ts`, les avatars légendaires
// dans `shared/legendaires.ts`, la rareté dans `shared/badges.ts`.
//
// Tout ce qui est ici est pur et partagé : le serveur calcule, le client
// affiche, et les tests vérifient la courbe sans lancer de serveur. Rien de
// ce fichier ne touche à une base.
//
// ── La règle qui gouverne tout ────────────────────────────────────────────
//
// Un profil ne donne JAMAIS un avantage de jeu : pas de point bonus, pas de
// temps en plus, pas de question plus facile. La moitié d'une salle sera
// toujours anonyme, et une soirée où les inscrits marquent plus n'est plus
// une soirée. Un profil donne de l'expérience, un niveau, des finitions, des
// hauts faits et une mémoire — du prestige et de la durée, jamais de la
// performance.

import type { BadgePorte } from './badges'
import type { HautFaitVu } from './hautsfaits'
import type { DivinDescendu } from './divins'
import type { CarriereDuJour } from './jour'

// ── Niveaux ───────────────────────────────────────────────────────────────

/**
 * Le pas de la courbe de niveau : le niveau n demande XP_PAR_PALIER × (n−1)².
 *
 * Il était à 12, avec 50 points de présence par soirée : le niveau 10
 * tombait en huit soirées pour tout le monde. Puis à 25, sans présence
 * gratuite — mais des soirées de deux quiz de cinquante questions
 * rapportent deux à trois fois l'expérience de soirées courtes : le joueur
 * médian passait niveau 5 dès son premier soir et niveau 10 à son sixième,
 * et toutes les finitions filaient en une dizaine de soirées. On n'avait
 * plus le temps de progresser.
 *
 * À 60, mesuré par `server/scripts/calibrage.ts` : sur des soirées de deux
 * quiz de trente questions, le meilleur de la bande atteint le niveau 10
 * vers sa onzième soirée, le joueur médian vers sa dix-neuvième ; à deux
 * quiz de cinquante, vers la septième et la douzième ; sur des soirées plus
 * courtes, plus lentement. Le niveau 20 redevient une légende, et le niveau
 * 2 tombe toujours le premier soir — même d'une petite soirée de trente
 * questions sans rien d'autre (à 75, elle n'y suffisait plus). Personne n'y
 * a perdu un niveau : ceux qu'il avait atteints sur la courbe d'avant, un
 * profil les garde (`niveauDuProfil`).
 */
export const XP_PAR_PALIER = 60

/** Le niveau qu'une expérience donne sur une courbe de ce pas. */
export function niveauSurCourbe(xp: number, pas: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / pas)) + 1
}

/** Le niveau que vaut cette expérience sur la courbe du jour. Le premier niveau est 1, jamais 0. */
export function niveauPour(xp: number): number {
  return niveauSurCourbe(xp, XP_PAR_PALIER)
}

/**
 * Un niveau gardé : celui qu'un profil avait atteint sur une courbe d'avant,
 * quand elle s'est durcie (`COURBES_D_AVANT`, `auth/profiles.ts`).
 */
export interface NiveauGarde {
  /** Le pas de la courbe d'alors : son niveau n demandait `pas` × (n − 1)². */
  pas: number
  niveau: number
}

/**
 * Le niveau d'un profil : celui de la courbe du jour, ou celui qu'il avait
 * gardé d'une courbe d'avant, s'il est plus haut.
 *
 * Un niveau gardé tient tant que la courbe d'alors le donne encore : une
 * soirée retirée de l'historique l'emporte avec son expérience, comme elle
 * l'aurait fait avant. Tout ce qui montre le niveau d'un profil — le mur, sa
 * page, sa fin de soirée, ses finitions — passe par ici : un seul oubli, et
 * il lirait deux niveaux différents.
 */
export function niveauDuProfil(xp: number, gardes: readonly NiveauGarde[]): number {
  let niveau = niveauPour(xp)
  for (const g of gardes) niveau = Math.max(niveau, Math.min(g.niveau, niveauSurCourbe(xp, g.pas)))
  return niveau
}

/** L'expérience totale qu'il faut avoir atteint pour ce niveau. */
export function xpDuNiveau(niveau: number): number {
  return Math.max(0, niveau - 1) ** 2 * XP_PAR_PALIER
}

/**
 * Où en est la barre : ce qui est acquis dans le niveau courant, et ce qu'il y
 * faut.
 *
 * Sur un niveau gardé que la courbe du jour n'a pas encore rejoint, il n'y a
 * pas de « niveau courant » à remplir : la barre compte alors depuis zéro,
 * jusqu'à ce que demande le niveau suivant. Elle avance à chaque soirée et se
 * remplit pile quand il tombe — une barre vide pendant des mois, ou un « 0 /
 * 1 575 » qui en cachait 6 575, ne disaient pas la vérité.
 */
export function progression(xp: number, gardes: readonly NiveauGarde[] = []): { niveau: number; acquis: number; requis: number } {
  const niveau = niveauDuProfil(xp, gardes)
  const total = Math.max(0, xp)
  if (niveau > niveauPour(xp)) return { niveau, acquis: total, requis: xpDuNiveau(niveau + 1) }
  const bas = xpDuNiveau(niveau)
  return { niveau, acquis: total - bas, requis: xpDuNiveau(niveau + 1) - bas }
}

// ── Finitions d'avatar ────────────────────────────────────────────────────
//
// L'emoji ne change jamais : Alice reste le renard. Ce qui change, c'est sa
// finition — ce qui l'entoure. Aucun nouvel objet à dessiner, ça tient à
// l'échelle du vidéoprojecteur, et l'identité de chacun est préservée.

export const FINITIONS = ['mat', 'argent', 'or', 'holo', 'prisme', 'aurore', 'constellation'] as const
export type Finition = (typeof FINITIONS)[number]

/**
 * Ce que le joueur a choisi de porter. `auto` — le choix par défaut — porte
 * toujours la plus belle finition qu'il a : personne n'allait la chercher sur
 * sa page, et un profil ressemblait à un anonyme, pastille mise à part.
 * Choisir une finition l'épingle, y compris une plus sobre.
 */
export type FinitionChoisie = Finition | 'auto'

/** Le niveau à partir duquel chaque finition se choisit. */
export const NIVEAU_FINITION: Record<Finition, number> = {
  mat: 1,
  argent: 3,
  or: 6,
  holo: 10,
  prisme: 15,
  aurore: 20,
  constellation: 25,
}

/** Comment on annonce une finition à celui qui vient de la débloquer. */
export const NOM_FINITION: Record<Finition, string> = {
  mat: 'Mat',
  argent: 'Argent',
  or: 'Or',
  holo: 'Holo',
  prisme: 'Prisme',
  aurore: 'Aurore',
  constellation: 'Constellation',
}

/** Celles qu'on peut porter à ce niveau. */
export function finitionsOuvertes(niveau: number): Finition[] {
  return FINITIONS.filter(f => niveau >= NIVEAU_FINITION[f])
}

/** La plus belle finition ouverte à ce niveau. */
export function meilleureFinition(niveau: number): Finition {
  const ouvertes = finitionsOuvertes(niveau)
  return ouvertes[ouvertes.length - 1] ?? 'mat'
}

/** Borne ce qui arrive du navigateur : `auto`, ou une finition qu'on a. Le reste vaut `auto`. */
export function choixDeFinition(raw: unknown, niveau: number): FinitionChoisie {
  if (raw === 'auto') return 'auto'
  const trouvee = FINITIONS.find(f => f === raw)
  return trouvee && niveau >= NIVEAU_FINITION[trouvee] ? trouvee : 'auto'
}

/**
 * La finition qu'on voit : celle qu'on a épinglée si on peut encore la porter,
 * la plus belle qu'on a sinon.
 */
export function finitionPortee(choisie: unknown, niveau: number): Finition {
  const choix = choixDeFinition(choisie, niveau)
  return choix === 'auto' ? meilleureFinition(niveau) : choix
}

/** Ancien nom, gardé pour les appels qui bornent une finition précise : `mat` quand on ne l'a pas. */
export function finitionValide(raw: unknown, niveau: number): Finition {
  const trouvee = FINITIONS.find(f => f === raw)
  return trouvee && niveau >= NIVEAU_FINITION[trouvee] ? trouvee : 'mat'
}

// ── L'Éclat ───────────────────────────────────────────────────────────────

/**
 * Une chance sur autant, par soirée jouée, qu'un des avatars d'un profil
 * « s'éclate » — définitivement, et pour cet emoji-là seulement.
 *
 * Les finitions se gagnent au mérite, les avatars légendaires aux hauts
 * faits ; l'Éclat, lui, ne se gagne pas. On ne peut ni l'acheter ni
 * l'accélérer, seulement venir jouer : c'est la seule échelle où le premier
 * et le dernier de la salle sont à égalité.
 */
export const CHANCE_ECLAT = 40

// ── Barème d'expérience ───────────────────────────────────────────────────
//
// L'expérience se MÉRITE. Elle ne récompense plus d'être venu — cinquante
// points de présence pour une seule question jouée, c'était presque la moitié
// d'une soirée —, mais ce qu'on fait : répondre, viser juste, vite, finir
// devant. Répondre rapporte encore un peu, pour que personne ne reparte les
// mains vides ; le reste va au mérite.
//
// Ce qu'un quiz rapporte se crédite à son podium et ne bouge plus. Le podium
// de la soirée, qui changeait de mains d'un quiz à l'autre, ne se décide qu'à
// la clôture : l'expérience ne redescend jamais pendant une soirée.

export const XP = {
  /** Par question à laquelle on a répondu, juste ou non. */
  reponse: 1,
  /** Par question à choix juste. */
  juste: 3,
  /** En plus : juste, et parmi le tiers le plus rapide des bonnes réponses. */
  reflexe: 2,
  /** Estimation : la plus proche de la salle (ex æquo : tous). */
  estimationMeilleure: 5,
  /** Estimation : dans le tiers le plus proche, hors la plus proche. */
  estimationProche: 3,
  /**
   * Podium d'un quiz, rang partagé. Il a une marche de moins que la salle :
   * à deux, seul le premier y monte — le dernier n'est jamais sur le podium.
   */
  podiumQuiz: [25, 15, 10],
  /** Toutes ses questions à choix d'un quiz justes. */
  sansFaute: 15,
  /** Podium de la soirée, à la clôture — une marche de moins que la salle, lui aussi. */
  podiumSoiree: [60, 40, 25],
  /** Avoir répondu à presque toutes les questions qu'on vous a posées, à la clôture. */
  assiduite: 10,
} as const

/**
 * Les seuils sous lesquels rien ne se gagne. Sans eux, une « soirée » d'une
 * question à deux joueurs rapportait une présence, un podium et une victoire
 * de quiz — 128 points par tour, et on recommençait.
 *
 * L'expérience se gagne dès deux joueurs : un duel est une vraie partie, et
 * à trois ou quatre seuils, les petites tablées ne gagnaient rien. Ce qui
 * ferme la porte aux parties fabriquées, ce sont les questions — cinq pour
 * un podium de quiz, quinze pour la soirée — et le podium qui a toujours une
 * marche de moins que la salle. Les hauts faits, eux, gardent leur salle de
 * quatre : à deux, « la Lanterne Rouge » tomberait à chaque partie.
 */
export const SEUILS = {
  /** Une question ne rapporte que si elle a été posée à autant de joueurs. */
  salleQuestion: 2,
  /** Un quiz ne distribue son podium qu'avec autant de questions… */
  questionsQuiz: 5,
  /** …et autant de joueurs qui ont répondu. */
  salleQuiz: 2,
  /** Le sans-faute demande au moins autant de questions à choix. */
  sansFauteQcm: 5,
  /** La soirée ne distribue ses bonus qu'avec autant de questions… */
  questionsSoiree: 15,
  /** …et autant de joueurs qui ont répondu. */
  salleSoiree: 2,
  /** L'assiduité : la part des questions posées auxquelles on a répondu. */
  assiduitePart: 0.9,
  /** Le réflexe — et le plus rapide — se jugent parmi au moins autant de bonnes réponses. */
  reflexeJustes: 2,
  /** Les hauts faits ne se décernent que dans une salle d'autant de joueurs. */
  salleHautsFaits: 4,
} as const

/** Le détail d'un gain de soirée — conservé tel quel, pour qu'on puisse l'expliquer. */
export interface GainSoiree {
  /** Avoir répondu. */
  reponses: number
  /** Questions à choix justes. */
  justesse: number
  /** Réponses justes parmi les plus rapides. */
  reflexe: number
  /** Estimations proches. */
  estimation: number
  /** Podiums de quiz et sans-faute. */
  quiz: number
  /** Podium de la soirée et assiduité — à la clôture seulement. */
  soiree: number
  /** Les hauts faits de la soirée — à la clôture seulement. */
  hautsFaits: number
}

export function gainVide(): GainSoiree {
  return { reponses: 0, justesse: 0, reflexe: 0, estimation: 0, quiz: 0, soiree: 0, hautsFaits: 0 }
}

/**
 * Une soirée compte si l'on y a répondu à une question posée à deux joueurs
 * au moins — c'est ce que dit `gain.reponses`, qui ne paie que celles-là.
 * Seul devant son téléphone, on enchaînait les « soirées » d'une question :
 * chacune tirait un Éclat, et dix d'entre elles faisaient tomber L'Habitué
 * jusqu'au Renard Lunaire. La même règle ferme les deux portes.
 */
export function soireeQuiCompte(gain: GainSoiree): boolean {
  return gain.reponses > 0
}

export function totalGain(g: GainSoiree): number {
  return g.reponses + g.justesse + g.reflexe + g.estimation + g.quiz + g.soiree + g.hautsFaits
}

/**
 * Le relevé brut d'une soirée, conservé à côté du gain.
 *
 * On pourrait le redéduire du gain en divisant par le barème — mais alors,
 * retoucher le barème un jour rendrait faux tout ce qui a été écrit avant.
 * Les chiffres bruts, eux, ne périment pas : ce sont eux que la fiche de
 * carrière et les hauts faits de carrière additionnent.
 */
export interface ReleveSoiree {
  /** Questions qui lui ont été posées. */
  questions: number
  /** Réponses envoyées, questions à choix et estimations. */
  reponses: number
  /** Questions à choix auxquelles il a répondu. */
  qcm: number
  /** Questions à choix justes. */
  justes: number
  /** Somme des temps de ses bonnes réponses, en ms — la moyenne se déduit. */
  tempsJustesMs: number
  /** Sa bonne réponse la plus rapide, en ms ; null s'il n'en a pas. */
  meilleurTempsMs: number | null
  /** Justes, et parmi le tiers le plus rapide des bonnes réponses. */
  reflexes: number
  /** Le plus rapide à trouver, parmi trois bonnes réponses au moins. */
  premiers: number
  /** Plus longue série de bonnes réponses d'affilée. */
  meilleureSerie: number
  /** Estimations envoyées, exactes, dans le tiers le plus proche. */
  estimations: number
  estimationsExactes: number
  estimationsProches: number
  /** Somme des écarts relatifs de ses estimations (bornés à 10) — la moyenne se déduit. */
  ecartRelatif: number
  /** Estimations mesurées à au moins une autre proposition : celles qui ont un coup d'œil. */
  estimationsComparees: number
  /**
   * Somme de leurs coups d'œil — la part de la salle que chacune bat ou
   * égale (`coupDOeil`, `server/src/core/journal.ts`) —, la moyenne se déduit.
   * Absente des soirées rangées avant lui (`VERSION_BAREME` 6) que rien n'a
   * pu relire : elles comptent alors zéro estimation comparée.
   */
  coupDOeil: number
  /** Seul de la salle à trouver. */
  seulJuste: number
  /** Juste quand la majorité de la salle se trompait. */
  flair: number
  /** Justes dans la dernière seconde. */
  derniereSeconde: number
  /** Revirements avant la révélation. */
  revirements: number
  /** Quiz joués, gagnés, finis sur le podium (quiz de salle suffisante). */
  quizJoues: number
  quizGagnes: number
  podiumsQuiz: number
  /** Son rang sur la soirée ; 0 s'il n'a pas marqué. */
  rang: number
  /** Joueurs qui ont répondu ce soir-là. */
  joueurs: number
  /** Ses points de la soirée. */
  points: number
  /** L'emoji joué ce soir-là. */
  avatar: string
  /** Par catégorie de question : posées, justes. */
  categories: Record<string, { questions: number; justes: number }>
}

export function releveVide(): ReleveSoiree {
  return {
    questions: 0,
    reponses: 0,
    qcm: 0,
    justes: 0,
    tempsJustesMs: 0,
    meilleurTempsMs: null,
    reflexes: 0,
    premiers: 0,
    meilleureSerie: 0,
    estimations: 0,
    estimationsExactes: 0,
    estimationsProches: 0,
    ecartRelatif: 0,
    estimationsComparees: 0,
    coupDOeil: 0,
    seulJuste: 0,
    flair: 0,
    derniereSeconde: 0,
    revirements: 0,
    quizJoues: 0,
    quizGagnes: 0,
    podiumsQuiz: 0,
    rang: 0,
    joueurs: 0,
    points: 0,
    avatar: '',
    categories: {},
  }
}

// ── La carrière ───────────────────────────────────────────────────────────

/** Ce qu'un profil a accumulé sur toutes ses soirées : la fiche, et la base des hauts faits de carrière. */
export interface Carriere {
  soirees: number
  questions: number
  reponses: number
  qcm: number
  justes: number
  tempsJustesMs: number
  meilleurTempsMs: number | null
  reflexes: number
  premiers: number
  meilleureSerie: number
  estimations: number
  estimationsExactes: number
  estimationsProches: number
  ecartRelatif: number
  estimationsComparees: number
  coupDOeil: number
  seulJuste: number
  flair: number
  derniereSeconde: number
  revirements: number
  quizJoues: number
  quizGagnes: number
  podiumsQuiz: number
  /** Soirées finies sur le podium. */
  podiumsSoiree: number
  /** Hôtes différents chez qui il a joué. */
  hotes: number
  /** Emojis différents joués. */
  avatars: number
  /** Emojis éclatés. */
  eclats: number
  niveau: number
  categories: Record<string, { questions: number; justes: number }>
}

/** Additionne des relevés en une carrière. */
export function carriereDe(
  soirees: { releve: ReleveSoiree; gain: GainSoiree; spaceId: string }[],
  extra: { eclats: number; niveau: number },
): Carriere {
  const c: Carriere = {
    soirees: 0,
    questions: 0,
    reponses: 0,
    qcm: 0,
    justes: 0,
    tempsJustesMs: 0,
    meilleurTempsMs: null,
    reflexes: 0,
    premiers: 0,
    meilleureSerie: 0,
    estimations: 0,
    estimationsExactes: 0,
    estimationsProches: 0,
    ecartRelatif: 0,
    estimationsComparees: 0,
    coupDOeil: 0,
    seulJuste: 0,
    flair: 0,
    derniereSeconde: 0,
    revirements: 0,
    quizJoues: 0,
    quizGagnes: 0,
    podiumsQuiz: 0,
    podiumsSoiree: 0,
    hotes: 0,
    avatars: 0,
    eclats: extra.eclats,
    niveau: extra.niveau,
    categories: {},
  }
  const hotes = new Set<string>()
  const avatars = new Set<string>()
  for (const { releve: r, gain, spaceId } of soirees) {
    // Une soirée jouée seul reste dans l'historique, mais ce n'est pas une
    // soirée : ni pour la fiche, ni pour L'Habitué.
    if (soireeQuiCompte(gain)) c.soirees++
    c.questions += r.questions
    c.reponses += r.reponses
    c.qcm += r.qcm
    c.justes += r.justes
    c.tempsJustesMs += r.tempsJustesMs
    if (r.meilleurTempsMs !== null && (c.meilleurTempsMs === null || r.meilleurTempsMs < c.meilleurTempsMs)) {
      c.meilleurTempsMs = r.meilleurTempsMs
    }
    c.reflexes += r.reflexes
    c.premiers += r.premiers
    c.meilleureSerie = Math.max(c.meilleureSerie, r.meilleureSerie)
    c.estimations += r.estimations
    c.estimationsExactes += r.estimationsExactes
    c.estimationsProches += r.estimationsProches
    c.ecartRelatif += r.ecartRelatif
    // Estimation par estimation, pas soirée par soirée : une soirée de deux
    // estimations ne pèse pas autant qu'une de soixante.
    c.estimationsComparees += r.estimationsComparees
    c.coupDOeil += r.coupDOeil
    c.seulJuste += r.seulJuste
    c.flair += r.flair
    c.derniereSeconde += r.derniereSeconde
    c.revirements += r.revirements
    c.quizJoues += r.quizJoues
    c.quizGagnes += r.quizGagnes
    c.podiumsQuiz += r.podiumsQuiz
    if (r.rang >= 1 && r.rang <= 3) c.podiumsSoiree++
    if (spaceId) hotes.add(spaceId)
    if (r.avatar) avatars.add(r.avatar)
    for (const [cat, v] of Object.entries(r.categories ?? {})) {
      const t = (c.categories[cat] ??= { questions: 0, justes: 0 })
      t.questions += v.questions
      t.justes += v.justes
    }
  }
  c.hotes = hotes.size
  c.avatars = avatars.size
  return c
}

/**
 * Les chiffres qu'on montre d'une carrière — dérivés, jamais rangés.
 *
 * Deux mesures de justesse, une par type de question, et chacune avec sa
 * base : la précision ne compte que les QCM — une estimation n'est ni juste
 * ni fausse —, et elle s'affichait seule, à côté de réponses qui comptaient
 * tout. « 50 % » sur deux QCM se lisait comme sur deux cents, chez qui avait
 * joué soixante-deux estimations. Les estimations ont leur chiffre, le coup
 * d'œil, et aucune des deux ne se fond dans l'autre : une précision qui les
 * mélangerait bougerait avec la part d'estimations du quiz, pas avec le
 * joueur.
 */
export interface Fiche {
  soirees: number
  reponses: number
  /** Part des questions à choix justes, null sans réponse. */
  precision: number | null
  /** La base de la précision : QCM répondus, et justes. */
  qcm: number
  justes: number
  /**
   * Le coup d'œil moyen des estimations : la part de la salle que chacune
   * bat ou égale. Null sans estimation comparée — seul, on ne se mesure à
   * personne.
   */
  coupDOeil: number | null
  /** Sa base : les estimations mesurées à au moins une autre proposition. */
  estimationsComparees: number
  /** Temps moyen des bonnes réponses, en ms. */
  reflexeMoyenMs: number | null
  meilleurTempsMs: number | null
  meilleureSerie: number
  quizGagnes: number
  podiumsQuiz: number
  estimationsExactes: number
  /** Part des bonnes réponses trouvées quand la salle se trompait. */
  flair: number | null
  hotes: number
}

/**
 * Le coup d'œil moyen d'une soirée ou d'une carrière : la part de la salle
 * que ses estimations battent ou égalent. Null sans estimation comparée —
 * « — », jamais « 0 % ».
 */
export const coupDOeilMoyen = (r: Pick<ReleveSoiree, 'coupDOeil' | 'estimationsComparees'>): number | null =>
  r.estimationsComparees > 0 ? r.coupDOeil / r.estimationsComparees : null

export function ficheDe(c: Carriere): Fiche {
  return {
    soirees: c.soirees,
    reponses: c.reponses,
    precision: c.qcm > 0 ? c.justes / c.qcm : null,
    qcm: c.qcm,
    justes: c.justes,
    coupDOeil: coupDOeilMoyen(c),
    estimationsComparees: c.estimationsComparees,
    reflexeMoyenMs: c.justes > 0 ? Math.round(c.tempsJustesMs / c.justes) : null,
    meilleurTempsMs: c.meilleurTempsMs,
    meilleureSerie: c.meilleureSerie,
    quizGagnes: c.quizGagnes,
    podiumsQuiz: c.podiumsQuiz,
    estimationsExactes: c.estimationsExactes,
    flair: c.justes > 0 ? c.flair / c.justes : null,
    hotes: c.hotes,
  }
}

// ── Ce qu'un profil ajoute à une ligne d'écran ─────────────────────────────

/**
 * Ce qu'un profil ajoute à une ligne d'écran — classement, podium, pastille.
 *
 * Les champs sont facultatifs et restent ABSENTS pour un invité anonyme :
 * ni « Niv. 0 », ni pastille grise, ni finition neutre. Une salle est
 * toujours à moitié anonyme, et elle ne doit rien lire qui ressemble à un
 * rang inférieur. L'absence, pas l'infériorité.
 */
export interface Distinctions {
  niveau?: number
  finition?: Finition
  eclat?: boolean
  /**
   * L'avatar dessiné qu'il porte — il remplace l'emoji à l'écran : un
   * légendaire (`lg:…`) ou un Divin (`dv:…`).
   */
  legendaire?: string
}

/**
 * Recopie les distinctions d'un joueur sur une ligne d'affichage, en n'y
 * posant que ce qui existe — une ligne d'anonyme reste nue, et l'instantané
 * qui part à toute la salle n'en porte pas le poids.
 */
export function distinctions(source: Distinctions | undefined | null): Distinctions {
  if (!source) return {}
  return {
    ...(source.niveau !== undefined && { niveau: source.niveau }),
    ...(source.finition && { finition: source.finition }),
    ...(source.eclat && { eclat: true }),
    ...(source.legendaire && { legendaire: source.legendaire }),
  }
}

/**
 * Le profil tel que les écrans le voient. Jamais de haché, jamais de jeton.
 *
 * Volontairement léger : il voyage dans l'accusé de réception d'une
 * inscription à une soirée, donc à chaque téléphone qui arrive. L'étagère,
 * l'historique et la fiche, eux, ne partent que sur demande — voir
 * `PublicProfileDetail`.
 */
export interface PublicProfile {
  id: string
  login: string
  name: string
  avatar: string
  /** La finition qu'on voit sur lui. */
  finition: Finition
  /** Ce qu'il a choisi : `auto` porte toujours la plus belle. */
  finitionChoisie: FinitionChoisie
  xp: number
  niveau: number
  /** Ce qui est acquis dans le niveau courant, et ce qu'il y faut. */
  acquis: number
  requis: number
  /** Les finitions qu'il peut porter. */
  ouvertes: Finition[]
  /** Les emojis qui ont éclaté pour lui. */
  eclats: string[]
  /** Combien de badges il porte — le détail se demande à part. */
  badges: number
  /** L'avatar dessiné qu'il porte, s'il en porte un : un légendaire ou un Divin. */
  legendaire: string | null
  /** Les avatars légendaires qu'il a débloqués. */
  legendaires: string[]
  /** Les Divins descendus sur lui, avec leur récit. Ce qui les fait descendre ne quitte jamais le serveur. */
  divins: DivinDescendu[]
  /**
   * Le titre qu'il porte sous son prénom — la clé d'un haut fait gagné, qui
   * s'écrit de son nom (`hautFait(cle).title`) —, ou rien. Absent d'un
   * serveur d'avant.
   */
  titre?: string | null
  /** Les hauts faits qu'il a choisi de montrer sur sa carte ; null : les plus durs, d'office. */
  vitrineChoisie?: string[] | null
}

/** Une soirée jouée, telle que la page profil la relit. */
export interface SoireeJouee {
  soireeId: string
  /** Le nom de l'espace où elle s'est jouée (« chez Bob »), quand on le retrouve. */
  chez: string | null
  /** L'adresse de l'espace, pour relire la soirée — null si l'espace n'existe plus. */
  slug: string | null
  /**
   * Son titre, tel que l'historique de l'espace le porte aujourd'hui — un
   * renommage s'y voit. Null si la soirée n'y est plus.
   */
  titre: string | null
  /** L'invité qu'on y était : de quoi ouvrir son bilan sans « Qui es-tu ? ». */
  joueurId: string | null
  /** L'expérience de la soirée, hors paliers de carrière (ils ont leur ligne). */
  xp: number
  gain: GainSoiree
  releve: ReleveSoiree
  at: number
}

/** Le profil au complet, pour sa propre page — et pour elle seule. */
export interface PublicProfileDetail extends PublicProfile {
  vitrine: BadgePorte[]
  soirees: SoireeJouee[]
  /** Les chiffres de carrière. */
  fiche: Fiche
  /** Par catégorie : posées, justes. */
  categories: Record<string, { questions: number; justes: number }>
  /** Tous les hauts faits du catalogue, gagnés ou non, avec leur progression. */
  hautsFaits: HautFaitVu[]
  /** Son quiz du jour : médailles, série, podiums, derniers jours. Absent d'un serveur d'avant. */
  jour?: CarriereDuJour
  /**
   * Sa collection de prix de soirée, dans l'ordre du catalogue : ceux qu'il
   * a (`fois`), et ceux qui manquent encore. Absente d'un serveur d'avant.
   */
  prix?: PrixDeCollection[]
}

/** Un prix de soirée dans la collection d'un profil : zéro fois, il manque encore. */
export interface PrixDeCollection {
  key: string
  emoji: string
  title: string
  rule: string
  fois: number
}

/**
 * Ce qu'un profil garde, dit pareil partout où l'on en propose un.
 *
 * Jamais « tes points » : les points se gagnent pareil avec ou sans profil
 * (invariant 8) et ne passent pas d'une soirée à l'autre. Une phrase écrite
 * pour Jeanne, qui cherchait à « retrouver ses points », les lui promettait
 * pourtant. Ce qui la suit vraiment, c'est ce qui se voit : son niveau, ses
 * prix et ses avatars.
 */
export const PITCH_PROFIL = 'Un profil garde ton niveau, tes prix et tes avatars d’une soirée à l’autre.'

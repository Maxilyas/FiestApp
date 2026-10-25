// Le tirage à la pièce : une question à la fois, ou quelques-unes, dans un tas
// gardé — une escale de l'Expédition, une manche du Cabinet de curiosités —, et
// la fraîcheur que partagent tous les tirages de la campagne. Sorti de
// `core/campagne.ts` le 25 octobre 2026, avant le Cabinet, sans changer d'un
// tirage : le Cabinet tire comme l'Expédition sans importer `CampagneStore` ni
// ses onze mille lignes.
//
// `core/campagne.ts` lit ce module — la série, l'épreuve, le défi, le duel et
// le dé y prennent leur fraîcheur, leurs emprunts, leur battage —, jamais
// l'inverse : rien d'ici ne connaît une partie, un magasin, ni une forme de
// l'Expédition (`aSaForme` reste là-bas ; l'Éclair du Cabinet récrit ses
// affirmations par sa propre règle, `affirmationDe`). Il réexporte ce qu'il
// exportait (`tirerPourUneEscale`, `VUE_RECENTE_MS`) le temps que ses lecteurs
// viennent ici.
//
// Le hasard est celui du serveur (`Math.random`) : aucune fonction d'ici ne
// prend de graine. Un tirage rejoué d'une graine que la page connaît — son
// profil, sa partie — lui dirait ce que la partie va poser, réponses comprises
// (invariant 1). Une retouche se vérifie au même hasard contre le code
// d'avant, gardé dans `tirage-a-la-piece.test.ts`.

import type { QuestionDeLaBase } from './baseCampagne'
import { DejaPrises, type Intitule } from './jumelles'
import { niveauDeQuestion, type MesureDUneQuestion, type Niveau } from '../../../shared/campagne'

/** Un battage au hasard du serveur (Fisher-Yates), sur une copie. Le tirage d'une série le suit carte pour carte (`PreparationDuTirage`). */
export function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/**
 * Ce qu'une partie garde d'une question de la base qu'elle a tirée : le cœur
 * d'une question de série — ce que le journal y relit (`categorie`, `niveau`)
 * et ce que le signalement compare à la base. Une série, une expédition y
 * ajoutent leurs champs (`QuestionDeSerie` l'étend, `core/campagne.ts`) ; une
 * question du Cabinet a la même forme, et s'y lie par le typage, pas par une
 * copie.
 */
export interface QuestionDeLaPartie {
  id: string
  texte: string
  reponses: string[]
  bonne: number
  categorie: string | null
  anecdote: string | null
  niveau: Niveau
  sousTheme?: string
}

/**
 * Une question de la base, telle que la série la garde : ses réponses
 * mélangées pour cette série-ci — on ne retient pas une place —, sauf
 * « Vrai » et « Faux », qui restent dans cet ordre.
 */
export function versQuestionDeSerie(q: QuestionDeLaBase, niveau: Niveau): QuestionDeLaPartie {
  const ordre = q.reponses.length === 2 ? [0, 1] : melanger(q.reponses.map((_, i) => i))
  return {
    id: q.id,
    texte: q.texte,
    reponses: ordre.map(i => q.reponses[i]),
    bonne: ordre.indexOf(q.bonne),
    categorie: q.meta.categorie,
    anecdote: q.anecdote,
    niveau,
    sousTheme: q.meta.sousTheme,
  }
}

/**
 * Une question vue ces dernières vingt-quatre heures ne revient qu'en
 * dernier recours. Une fois les jamais vues d'une marche épuisées, le tirage
 * reprenait les déjà vues au hasard : celle d'il y a cinq minutes valait
 * celle d'il y a trois semaines, et qui usait ses douze vies sur un palier
 * revoyait le soir même les questions qu'il venait de rater (un retour de
 * joueur, le 10 octobre 2026). Une redite d'hier soir se remarque ; celle
 * d'il y a trois semaines est une révision.
 */
export const VUE_RECENTE_MS = 24 * 3600_000

/**
 * La même fraîcheur en un chiffre, sans rien bâtir : 0 jamais vue, 1 vue,
 * 2 vue ces dernières vingt-quatre heures — ou dans la fenêtre qu'on lui
 * donne. Un tirage la lit pour chacune de ses vues.
 */
export const classeDeFraicheur = (le: number | undefined, maintenant: number, fenetreMs = VUE_RECENTE_MS): 0 | 1 | 2 =>
  le === undefined ? 0 : maintenant - le < fenetreMs ? 2 : 1

/** Ce qu'un joueur a vu d'une question : jamais, ou quand pour la dernière fois — et si c'était dans la fenêtre, vingt-quatre heures d'office. */
export function fraicheurDe(vues: Pick<ReadonlyMap<string, number>, 'get'>, maintenant: number, fenetreMs = VUE_RECENTE_MS) {
  return (id: string): { recente: number; vue: number; le: number } => {
    const le = vues.get(id)
    return le === undefined ? { recente: 0, vue: 0, le: 0 } : { recente: classeDeFraicheur(le, maintenant, fenetreMs) === 2 ? 1 : 0, vue: 1, le }
  }
}

/**
 * D'où emprunter quand un niveau manque à la catégorie : le même, puis le
 * plus dur d'à côté, puis le plus facile. Une base qui grandit chaque matin
 * finit par remplir chaque niveau ; d'ici là, une épreuve se joue toujours.
 */
export const EMPRUNTS: Readonly<Record<Niveau, readonly Niveau[]>> = {
  facile: ['facile', 'moyen', 'difficile', 'expert'],
  moyen: ['moyen', 'difficile', 'facile', 'expert'],
  difficile: ['difficile', 'expert', 'moyen', 'facile'],
  expert: ['expert', 'difficile', 'moyen', 'facile'],
}

/** `a` passe-t-il avant `b` ? Deux rangs se lisent de gauche à droite. */
export function passeAvant(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/**
 * Un ordre au hasard qui se tire à mesure qu'on le lit : le p-ième rang ne
 * se tire qu'au moment où on le demande (Fisher-Yates à l'endroit, ses
 * échanges dans une table). Aussi uniforme que `melanger`, sans recopier ni
 * battre tout un tas pour n'en lire que dix.
 */
class OrdreParesseux {
  private readonly echanges = new Map<number, number>()
  private readonly tires: number[] = []

  constructor(private readonly n: number) {}

  /** Le p-ième indice de l'ordre ; undefined au-delà du tas. */
  rang(p: number): number | undefined {
    while (this.tires.length <= p && this.tires.length < this.n) {
      const i = this.tires.length
      const j = i + Math.floor(Math.random() * (this.n - i))
      const aJ = this.echanges.get(j) ?? j
      this.echanges.set(j, this.echanges.get(i) ?? i)
      // Le rang i est tiré : on ne le relira plus.
      this.echanges.delete(i)
      this.tires.push(aJ)
    }
    return this.tires[p]
  }
}

/**
 * Les questions d'une escale de l'expédition — une, ou celles d'un
 * gardien —, choisies comme celles d'une épreuve (`tirerUneEpreuve`) : à sa
 * marche, empruntée au voisin si elle est vide (`EMPRUNTS`) ; jamais vues
 * d'abord, une vue ces vingt-quatre heures en dernier ; puis le sous-thème le
 * moins servi du tirage ; puis la jumelle d'une question déjà prise après les
 * autres — celles que l'expédition a déjà posées comprises (`posees`) ; puis
 * la plus anciennement vue. Le tas se lit au hasard, dans un ordre tiré à
 * mesure (`OrdreParesseux`), et la lecture s'arrête à la première qui ne
 * peut être battue — une jamais vue, d'un sous-thème encore à servir, sans
 * jumelle : la même loi que le battage entier, quelques questions lues au
 * lieu de toutes. Une épreuve bat d'avance les deux mille questions de sa
 * catégorie pour en prendre seize ; une escale n'en prend qu'une, et le
 * gardien tirait dans les vingt-cinq mille de la base : 17 ms de
 * processeur à chaque gardien, dix fois plus au dixième de cœur de
 * l'hébergeur (le banc du 17 octobre 2026). Le tas vient en morceaux — les
 * catégories d'un mélange, chacune gardée (`deLaCategorie`) —, lus comme un
 * seul. `garde` écarte ce que la forme de l'escale ne sait pas poser : six
 * choix sans deux leurres, un dévoilement de trois mots.
 *
 * Le Cabinet y tire les questions de la base de ses manches — le Pari,
 * l'Éclair, le Mot, le Filet —, d'un tas à lui, gardé, sans forme de
 * l'Expédition : sa fenêtre de sept jours (`fenetreMs`) et deux marches qui se
 * valent (`aussi`). Sans eux, le tirage est celui d'avant, au même hasard.
 */
export function tirerPourUneEscale(
  tas: readonly (readonly QuestionDeLaBase[])[],
  marche: Niveau,
  combien: number,
  {
    sansVraiFaux,
    garde,
    vues,
    mesure,
    maintenant,
    posees = [],
    fenetreMs = VUE_RECENTE_MS,
    aussi = [],
  }: {
    sansVraiFaux: boolean
    garde?: (q: QuestionDeLaBase) => boolean
    /** Ce qu'il a vu, et quand ; ce que la partie a posé, à l'instant. */
    vues: Pick<ReadonlyMap<string, number>, 'get'>
    mesure: ReadonlyMap<string, MesureDUneQuestion>
    maintenant: number
    /** Les questions que la partie a déjà posées : leurs jumelles passent après. */
    posees?: readonly Intitule[]
    /**
     * Ce qu'une vue garde de récent : vue depuis moins longtemps, une question
     * ne revient qu'en dernier recours. Les vingt-quatre heures de toute la
     * campagne d'office (`VUE_RECENTE_MS`) ; sept jours au Cabinet
     * (`JOURS_SANS_REDITE`), où le Pari et l'Éclair puisent dans le même tas —
     * et dans la fenêtre, une question vue il y a trois jours ne passe plus
     * devant celle d'il y a trois semaines pour un sous-thème moins servi.
     */
    fenetreMs?: number
    /**
     * Les marches qui valent la sienne, lues avec elle à chaque place — une
     * question « facile ou moyenne » au Cabinet : entre elles, la fraîcheur
     * départage, jamais la marche, et chacune sort à sa marche. Puis les
     * emprunts de la sienne (`EMPRUNTS`), sans elles.
     */
    aussi?: readonly Niveau[]
  },
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  const n = tas.reduce((s, morceau) => s + morceau.length, 0)
  const question = (k: number): QuestionDeLaBase => {
    for (const morceau of tas) {
      if (k < morceau.length) return morceau[k]
      k -= morceau.length
    }
    throw new RangeError(`question ${k} hors du tas`)
  }
  const ordre = new OrdreParesseux(n)
  // La marche de chaque question lue, une fois : une place relit le début de l'ordre.
  const marches = new Map<number, Niveau>()
  const marcheDeLa = (k: number, q: QuestionDeLaBase): Niveau => {
    let m = marches.get(k)
    if (m === undefined) marches.set(k, (m = niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))))
    return m
  }
  // La sienne et celles qui la valent, ensemble ; puis chaque emprunt, un à un. Sans `aussi`, les étapes sont ses emprunts mêmes.
  const etapes: (readonly Niveau[])[] = [[marche, ...aussi], ...EMPRUNTS[marche].filter(m => m !== marche && !aussi.includes(m)).map(m => [m])]
  const usage = new Map<string, number>()
  const prises = new Set<number>()
  const deja = new DejaPrises()
  for (const q of posees) deja.prendre(q)
  const fraicheur = fraicheurDe(vues, maintenant, fenetreMs)
  const rang = (q: QuestionDeLaBase): number[] => {
    const f = fraicheur(q.id)
    return [f.recente, f.vue, usage.get(q.meta.sousTheme) ?? 0, deja.jumelle(q) ? 1 : 0, f.le]
  }
  const tirees: { question: QuestionDeLaBase; niveau: Niveau }[] = []
  for (let place = 0; place < combien; place++) {
    for (const etape of etapes) {
      let meilleure = -1
      let sonRang: number[] | null = null
      for (let p = 0; ; p++) {
        const k = ordre.rang(p)
        if (k === undefined) break
        if (prises.has(k)) continue
        const q = question(k)
        if (sansVraiFaux && q.reponses.length === 2) continue
        if (!etape.includes(marcheDeLa(k, q))) continue
        if (garde && !garde(q)) continue
        const r = rang(q)
        if (!sonRang || passeAvant(r, sonRang)) {
          meilleure = k
          sonRang = r
          // Jamais vue, d'un sous-thème encore à servir, sans jumelle : rien ne fera mieux.
          if (r.every(x => x === 0)) break
        }
      }
      if (meilleure >= 0) {
        const q = question(meilleure)
        prises.add(meilleure)
        deja.prendre(q)
        usage.set(q.meta.sousTheme, (usage.get(q.meta.sousTheme) ?? 0) + 1)
        // Sa marche à elle : celle de l'étape, sauf parmi celles qui se valent.
        tirees.push({ question: q, niveau: marches.get(meilleure)! })
        break
      }
    }
  }
  return melanger(tirees)
}

/**
 * Parmi ces candidats, un jamais vu, au hasard ; sinon le plus anciennement
 * vu. Ce qui se tire hors de la base y passe — un rébus, un plat de
 * l'Expédition ; un lieu, une fiche, une réplique du Cabinet. Il n'a pas de
 * fenêtre à recevoir : le plus anciennement vu d'abord ne repose rien de vu
 * ces sept jours — ni ces vingt-quatre heures — tant qu'il reste autre chose,
 * et le contenu épuisé ne rend que le moins récemment vu.
 */
export function laMoinsVue<T>(candidats: readonly T[], idDe: (x: T) => string, vues: Pick<ReadonlyMap<string, number>, 'get'>): T | undefined {
  const jamais: T[] = []
  let ancienne: T | undefined
  let le = Number.POSITIVE_INFINITY
  for (const x of candidats) {
    const v = vues.get(idDe(x))
    if (v === undefined) jamais.push(x)
    else if (v < le) {
      le = v
      ancienne = x
    }
  }
  return jamais.length > 0 ? jamais[Math.floor(Math.random() * jamais.length)] : ancienne
}

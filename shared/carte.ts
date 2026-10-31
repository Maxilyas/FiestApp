// La carte d'un joueur : ce qu'on voit en touchant son nom.
//
// Les avatars, les finitions et les badges n'avaient qu'un public, leur
// porteur : personne ne pouvait regarder le profil de quelqu'un d'autre. La
// carte le montre à la salle — son niveau, ses légendaires, ses plus beaux
// hauts faits, sa collection de prix, quelques chiffres —, à côté de ce qu'il
// fait ce soir.
//
// Un invité anonyme a sa carte aussi : sa soirée, et rien qui dise ce qui lui
// manque. Un surnom donné par l'animateur ne touche pas au profil : la carte
// dit les deux, le nom du soir et le prénom du profil.

import type { CleDeLigue } from './duels'
import type { BadgePorte } from './badges'
import type { Distinctions, Fiche } from './profil'
import type { CompagnonPossede } from './compagnons'
import { VITRINE_MAX, cleRangee, plusBeaux } from './hautsfaits'
import { CATEGORIES, type Categorie } from './categories'
import { palierEcusson } from './ecussons'
import { BRANCHES, ouvertsDansLaBranche, prochainDansLaBranche, type Branche, type Paliers, type Portrait } from './branches'
import { PALIER_DU_MAITRE, PALIERS_DU_SENTIER } from './sentiers'

/**
 * La vitrine d'une carte : les hauts faits qu'il a choisis, dans son ordre —
 * un haut fait de carrière à son plus haut palier, qui monte avec lui —, ou,
 * s'il n'a rien choisi, ses trois plus beaux (`plusBeaux`). La carte que le
 * serveur compose et ce que sa page en montre — la tuile « Ma carte », le
 * choix de la vitrine — lisent la même règle : la page en avait sa copie,
 * qui aurait fini par montrer une autre vitrine que la carte.
 */
export function vitrineDeLaCarte(etagere: BadgePorte[], choisie: readonly string[] | null, recompenses: ReadonlyMap<string, number>): BadgePorte[] {
  if (!choisie) return plusBeaux(etagere, VITRINE_MAX)
  const parCle = new Map(etagere.map(b => [b.key, b]))
  return choisie.flatMap(cle => {
    const rangee = cleRangee(cle, recompenses)
    const badge = rangee ? parCle.get(rangee) : undefined
    return badge ? [badge] : []
  })
}

export interface CarteDeJoueur extends Distinctions {
  /** Le nom qu'il porte ce soir, marque d'homonymie comprise. */
  nom: string
  avatar: string
  /** Sa soirée — absente de la carte qu'on regarde depuis sa page, hors soirée. */
  ceSoir?: {
    points: number
    /** Rang partagé dans la soirée, 0 tant qu'il n'a rien marqué. */
    rang: number
    /** Joueurs qui ont répondu ce soir, pour dire « 3ᵉ sur 12 ». */
    joueurs: number
    /** Toutes ses réponses, QCM et estimations. */
    reponses: number
    /**
     * Les QCM auxquels il a répondu, et ses bonnes réponses : « 1/2 justes ».
     * Une estimation n'est jamais juste — comptée avec les QCM, elle faisait
     * lire « 1/64 justes » à qui en avait joué soixante-deux.
     */
    qcm: number
    justes: number
    /**
     * Les estimations qu'il a proposées, comptées à part, et leur coup d'œil :
     * la part de la salle qu'elles battent ou égalent, null sans estimation
     * mesurée à une autre.
     */
    estimations: number
    coupDOeil: number | null
  }
  /** Son profil, s'il en a un. */
  profil?: {
    /** Le prénom de son profil — il diffère du nom du soir quand l'animateur lui a donné un surnom. */
    prenom: string
    niveau: number
    legendaires: string[]
    /** Les Divins descendus sur lui — sans un mot de ce qui les a fait descendre. */
    divins: string[]
    /**
     * Ses plus beaux hauts faits, trois au plus : exploits et paliers de
     * carrière, les plus rares à décrocher d'abord (`plusBeaux`,
     * `shared/hautsfaits.ts`). Le nom vient d'avant, quand elle rangeait six
     * prix et hauts faits : une page ouverte avant le lit encore.
     */
    vitrine: BadgePorte[]
    /** Combien de hauts faits différents il a décrochés. */
    hautsFaits: number
    /** Le titre qu'il porte sous son prénom : la clé d'un haut fait (`hf:oracle`). Absent s'il n'en porte pas. */
    titre?: string
    /** Son quiz du jour, en une ligne : les jours joués, les victoires. Absent s'il n'y a jamais joué. */
    jour?: { joues: number; victoires: number }
    /**
     * Sa ligue des duels et sa cote (`shared/duels.ts`). Absente tant qu'il
     * n'a fini aucun duel classé. Sa bordure de ligue, elle, se porte avec
     * l'avatar (`Distinctions.bordure`), relue avec sa cote (`carteDuProfil`).
     */
    duels?: { ligue: CleDeLigue; cote: number }
    /**
     * Sa campagne : le record de ses séries, ses bonnes réponses — séries,
     * épreuves, défis, révisions —, les paliers validés de ses sentiers.
     * Absente tant qu'il n'y a rien gagné. Qui ne joue qu'en solo y lisait
     * « Soirées 0 · Quiz gagnés 0 · Coup d'œil — » : des mesures de soirée
     * qu'il n'a jamais prises (l'experte du jeu solo, le 11 octobre 2026) ;
     * ses cadrans sont maintenant ceux-là (`cadransDeLaCarte`).
     */
    campagne?: { record: number; justes: number; paliers: number }
    /**
     * Ses écussons de savoir les plus hauts, trois au plus (`plusBeauxEcussons`).
     * Absents tant qu'il n'en a aucun.
     */
    ecussons?: { categorie: string; palier: 1 | 2 | 3 }[]
    /**
     * Ce qu'il sait, catégorie par catégorie, dans l'ordre des catégories :
     * ses QCM et ses bonnes réponses, tous modes de jeu ensemble — les mêmes
     * que ses écussons et que « Ma carrière ». Le radar de sa face « Son
     * savoir » (`radarDuSavoir`). Absent tant qu'il n'a joué aucun QCM rangé
     * dans une catégorie, et d'un serveur d'avant.
     */
    savoir?: SavoirDUneCategorie[]
    /**
     * Les paliers validés de ses sentiers, ceux qu'il a commencés — 13 quand
     * le palier du maître l'est aussi : sa face « Ses sentiers »
     * (`sentiersDeLaCarte`). Absents tant qu'il n'en a validé aucun.
     */
    sentiers?: Paliers
    /** Le fond de sa carte, s'il en porte un (`shared/fonds.ts`) : la carte qu'on ouvre change d'allure. */
    fond?: string
    /**
     * Le compagnon de sa niche, tel qu'elle le montre — la forme qu'il y a
     * choisie, son Éclat, les paliers de sa niche et ses ornements — et son
     * nom, s'il lui en a donné un (le propriétaire, le 19 octobre 2026 : « Le
     * compagnon sur la carte doit avoir son nom »). Absent sans compagnon.
     */
    compagnon?: CompagnonPossede
    /**
     * Les prix du palmarès : ils tombent à chaque soirée, et six fois
     * L'Éclair ne disait rien à la salle. C'est la collection qui se montre —
     * combien de prix différents, sur tous ceux qu'une personne peut
     * remporter. Absent d'un serveur d'avant.
     */
    prix?: { eus: number; total: number }
    /**
     * La précision avec sa base, le coup d'œil avec la sienne. La carte ne
     * montre plus la plus longue série, qui a cédé sa case au coup d'œil —
     * elle part encore pour les pages ouvertes avant, qui la lisent.
     */
    fiche: Pick<
      Fiche,
      | 'soirees'
      | 'precision'
      | 'qcm'
      | 'justes'
      | 'coupDOeil'
      | 'estimationsComparees'
      | 'reflexeMoyenMs'
      | 'quizGagnes'
      | 'meilleureSerie'
    >
  }
}

// ── Son savoir et ses sentiers : les deux faces de plus ─────────────────────
//
// Le souhait du propriétaire du 31 octobre 2026 : « une carte radar pour les
// joueurs où on peut voir les forces et faiblesses en fonction des
// catégories […] que l'on pourrait swipe pour avoir plus d'info. Aussi de
// voir les paliers de la campagne / maître obtenu » — et, sur la maquette :
// « Tout le monde voit les faiblesses ». Deux dérivations pures de ce que la
// carte reçoit, que la page dessine et que les tests relisent.

/**
 * Les QCM qu'il faut dans une catégorie pour qu'elle paraisse au radar : en
 * deçà, sa part de bonnes réponses ne dirait rien — une sur une, c'est
 * 100 %, et une erreur de plus la ferait tomber à 50. Un choix de produit
 * (`docs/reference/baremes.md`).
 */
export const QCM_POUR_LE_RADAR = 10

/** Ses QCM et ses bonnes réponses dans une catégorie, tous modes de jeu ensemble. */
export interface SavoirDUneCategorie {
  categorie: string
  questions: number
  justes: number
}

/** Un rayon du radar : une catégorie, sa part de bonnes réponses, son écusson. */
export interface RayonDuRadar {
  categorie: Categorie
  questions: number
  justes: number
  /** Sa part de bonnes réponses, de 0 à 1 ; null sous `QCM_POUR_LE_RADAR` — le rayon reste à découvrir. */
  part: number | null
  /** La même en pour cent, arrondie, telle que la carte l'écrit ; null avec elle. */
  pourcent: number | null
  /** Son écusson — 0 sans —, de ses bonnes réponses : celui que montre la page du profil. */
  ecusson: 0 | 1 | 2 | 3
}

export interface RadarDuSavoir {
  /** Les douze, dans l'ordre des catégories : le radar a toujours ses douze rayons. */
  rayons: RayonDuRadar[]
  /** Combien paraissent : chacun dès `QCM_POUR_LE_RADAR`. */
  connus: number
  /** Ses forces, trois au plus, la plus sûre d'abord. */
  forces: Categorie[]
  /**
   * Ce qui lui reste à conquérir, deux au plus, le plus faible d'abord — dès
   * cinq rayons connus : en deçà, un rayon serait à la fois une force et une
   * faiblesse. Tout le monde le voit (le choix du 31 octobre 2026).
   */
  aConquerir: Categorie[]
}

/**
 * Le plus sûr d'abord : la meilleure part — comparée en entiers, jamais en
 * flottants (invariant 15) —, puis le plus de bonnes réponses — 9 sur 10 a
 * moins prouvé que 90 sur 100 —, puis l'ordre des catégories, pour que deux
 * lectures rangent pareil.
 */
function plusSur(a: RayonDuRadar, b: RayonDuRadar): number {
  return b.justes * a.questions - a.justes * b.questions || b.justes - a.justes || CATEGORIES.indexOf(a.categorie) - CATEGORIES.indexOf(b.categorie)
}

/**
 * Le radar de sa face « Son savoir » : ses douze rayons, ses forces et ce
 * qui lui reste à conquérir ; null tant qu'aucune catégorie n'atteint
 * `QCM_POUR_LE_RADAR` — la carte n'a pas cette face, plutôt qu'un radar vide.
 * Une catégorie hors de la liste fixe (un quiz d'avant les catégories) ne
 * compte pas : le radar n'a pas de rayon pour elle.
 */
export function radarDuSavoir(savoir: readonly SavoirDUneCategorie[] | undefined): RadarDuSavoir | null {
  const parCategorie = new Map((savoir ?? []).map(s => [s.categorie, s]))
  const rayons = CATEGORIES.map((categorie): RayonDuRadar => {
    const s = parCategorie.get(categorie)
    const questions = entier(s?.questions)
    const justes = entier(s?.justes)
    const part = questions >= QCM_POUR_LE_RADAR ? Math.min(1, justes / questions) : null
    return { categorie, questions, justes, part, pourcent: part === null ? null : Math.round(part * 100), ecusson: palierEcusson(justes) }
  })
  const connus = rayons.filter(r => r.part !== null).sort(plusSur)
  if (connus.length === 0) return null
  return {
    rayons,
    connus: connus.length,
    forces: connus.slice(0, 3).map(r => r.categorie),
    aConquerir: connus.length >= 5 ? connus.slice(3).reverse().slice(0, 2).map(r => r.categorie) : [],
  }
}

/** Un compte reçu, tel qu'il se lit : un entier positif, zéro pour tout le reste. */
const entier = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/** Un sentier de sa carte. */
export interface SentierDeLaCarte {
  branche: Branche
  /** Ses paliers validés, de 1 à 12. */
  paliers: number
  /** Son palier de maître validé. */
  maitre: boolean
  /** Le dernier portrait qu'il y a gagné ; null avant le deuxième palier. */
  portrait: Portrait | null
  /** Le prochain à gagner — son `palier` dit celui qui l'ouvre ; null quand ses six sont gagnés. */
  prochain: Portrait | null
}

export interface SentiersDeLaCarte {
  /** Ceux qu'il a commencés, dans l'ordre des branches — celui des catégories. */
  sentiers: SentierDeLaCarte[]
  /** Ses paliers validés, sur les douze de chaque sentier : le palier du maître se compte à part, dans `maitres`. */
  paliers: number
  /** Ses portraits gagnés. */
  portraits: number
  maitres: number
}

/**
 * Sa face « Ses sentiers » : ceux qu'il a commencés — l'absence, pas « 0 sur
 * 12 » —, leur dernier portrait, ses maîtres ; null tant qu'il n'a validé
 * aucun palier. Les paliers repris d'un ancien portrait y comptent, comme
 * sur sa page : ce sont les siens.
 */
export function sentiersDeLaCarte(paliers: Paliers | undefined): SentiersDeLaCarte | null {
  const sentiers = BRANCHES.flatMap((branche): SentierDeLaCarte[] => {
    const valides = entier(paliers?.[branche.key])
    if (valides === 0) return []
    const ouverts = ouvertsDansLaBranche(branche, { [branche.key]: valides })
    return [
      {
        branche,
        paliers: Math.min(PALIERS_DU_SENTIER, valides),
        maitre: valides >= PALIER_DU_MAITRE,
        portrait: ouverts > 0 ? branche.portraits[ouverts - 1] : null,
        prochain: prochainDansLaBranche(branche, { [branche.key]: valides })?.portrait ?? null,
      },
    ]
  })
  if (sentiers.length === 0) return null
  return {
    sentiers,
    paliers: sentiers.reduce((n, s) => n + s.paliers, 0),
    portraits: sentiers.reduce((n, s) => n + ouvertsDansLaBranche(s.branche, { [s.branche.key]: s.paliers }), 0),
    maitres: sentiers.filter(s => s.maitre).length,
  }
}

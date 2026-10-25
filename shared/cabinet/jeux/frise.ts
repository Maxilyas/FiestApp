// La Frise : une seule frise qui grandit d'une manche à l'autre. Trois
// événements à ranger du plus ancien au plus récent, puis deux de plus parmi
// eux, puis deux encore : sept au bout (`VAGUES_DE_LA_FRISE`). À chaque
// manche, ceux d'avant sont déjà à leur vraie place, leur année dite — les
// ancres —, et les nouveaux venus se posent parmi eux. Une frise à thème
// (`server/content/cabinet/frises.json`) ou celle d'un sujet de la base, dont
// chaque événement est une question datée (`server/content/frises/`).
//
// Ici, la règle pure (le moule : `regle.ts`) : ce qui est faux
// (`erreursDeLaFrise`), ce que valent les erreurs, ce qu'Éclairer dévoile, ce
// que la manche montre et ce que la révélation range, la pièce que le journal
// garde ; et la frise partagée en vagues au départ (`friseEnVagues`), que le
// tirage du serveur appelle une fois les sept événements choisis. Changer n'y
// sert jamais (`JEUX.frise.changeable`) : remplacer une manche défairait les
// deux autres.
//
// Rien ici ne lit l'heure ni ne tire au hasard de lui-même : le hasard vient
// de la graine de la partie, et le pli rejoué redonne la même frise.

import type { Niveau } from '../../campagne'
import { QUESTION_DE_LA_FRISE, anneeDite } from '../../frise'
import { DUREES_DES_JEUX, ECART_DES_ANNEES_DE_LA_FRISE, ERREURS_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, VAGUES_DE_LA_FRISE } from '../bareme'
import { idDeLaFriseATheme, idDeLaFriseDeSujet, type PieceDuCabinet } from '../pieces'
import { refusDuPouvoir } from '../pouvoirs'
import { JEUX, justeDeLaPiece, type RegleDuJeu, type VerdictDUneManche } from './regle'

/** Un événement d'une frise : sa ligne, qui ne dit jamais quand (`refusDuLibelle`), et son année. */
export interface EvenementTire {
  libelle: string
  annee: number
  /** Sa question de la base, pour la frise d'un sujet : les pièces la nomment, la fraîcheur la déplie. */
  id?: string
}

/** Sept événements choisis par le serveur, avant d'être partagés en vagues. */
export interface FriseAPartager {
  /** Une frise à thème écrite pour le Cabinet, ou celle d'un sujet de la base. */
  sorte: 'theme' | 'sujet'
  /** L'identifiant de la frise à thème, ou le sujet. */
  cle: string
  /** « L'aviation », « Les inventions ». */
  theme: string
  evenements: readonly EvenementTire[]
  /** « Le savais-tu ? » de la frise : le sien, ou l'anecdote d'une question de ses événements. */
  savais: string | null
  categorie: string
  /** La marche de son sujet ; sans elle, une frise est moyenne. */
  niveau?: Niveau
}

/** Ce que le départ fige d'une manche de la Frise : toute la frise, et la vague que cette manche pose. */
export interface FriseTiree {
  jeu: 'frise'
  sorte: 'theme' | 'sujet'
  cle: string
  theme: string
  /** Les sept, dans l'ordre du temps : un événement se désigne par son rang. */
  evenements: EvenementTire[]
  /** Les rangs de chaque vague, dans l'ordre où la page montre ses nouveaux venus. */
  vagues: number[][]
  /** La vague de cette manche : celles d'avant sont ses ancres. */
  vague: number
  savais: string | null
  categorie: string
  niveau?: Niveau
}

/** Où en est une manche : les nouveaux venus qu'Éclairer a datés, par leur rang. */
export interface EtatDeLaFrise {
  devoiles: number[]
}

/**
 * Ce que la page envoie à la Frise : sa réponse seule — elle range au doigt
 * sans rien dire au serveur. L'ordre posé, en rangs dans le temps, relu des
 * jetons de l'écran ; null, rien d'envoyé.
 */
export type GesteDeLaFrise = { quoi: 'repondre'; rangs: number[] | null }

/**
 * Ce que la manche montre : les ancres, leur année dite, et les nouveaux venus
 * sans la leur, sauf celle qu'Éclairer a dévoilée — jamais l'ordre de ceux-ci
 * (invariant 1). Chaque événement porte le jeton que la page renvoie : les
 * ancres d'abord, dans le temps, puis les nouveaux venus dans l'ordre montré.
 */
export interface FriseMontree {
  jeu: 'frise'
  theme: string
  vague: number
  ancres: { jeton: number; libelle: string; annee: number }[]
  nouveaux: { jeton: number; libelle: string; annee?: number }[]
}

/** La révélation : la frise à sa place, chaque nouveau venu marqué — jamais la couleur seule, la page y met ses mots. */
export interface FriseRevelee {
  jeu: 'frise'
  theme: string
  vague: number
  /** « Sans faute », « 1 erreur », « Rien de rangé ». */
  titre: string
  /** Les nouveaux venus faux ou pas posés — tous, quand rien n'est rangé. */
  erreurs: number
  /** Tout ce qui est posé jusqu'à cette manche, dans l'ordre du temps ; `place` null pour une ancre. */
  rangee: { libelle: string; annee: number; nouveau: boolean; place: 'juste' | 'faux' | 'pas-pose' | null }[]
  /** « Le savais-tu ? » de la frise, à la dernière manche seulement : une fois par partie. */
  savais: string | null
}

/** La phrase de la seule règle des refus quand il n'y a plus rien à dévoiler : la règle du jeu ne la recopie pas. */
const RIEN_A_ECLAIRER = refusDuPouvoir({ pouvoir: 'eclairer', force: 1, jeu: 'frise', servi: 0, aEclairer: false })!

/**
 * Les nouveaux venus qui sont faux, dans l'ordre où `nouveaux` les donne. Un
 * nouveau venu est faux si un voisin le contredit — celui posé juste avant lui
 * est plus récent, ou celui juste après plus ancien —, et faux s'il n'est pas
 * posé. Ses voisins seuls le jugent : bien posé entre deux ancres, il reste
 * juste quand un autre s'égare au loin, et la révélation ne le marque pas pour
 * la faute d'un autre. Sans faute quand, et seulement quand, la frise est dans
 * l'ordre : les ancres le sont toujours, chaque paire de voisins se vérifie.
 * Une ancre ne compte jamais.
 *
 * @param ordre les événements posés, du plus ancien au plus récent selon lui : leur indice dans `annees`
 * @param annees l'année de chaque événement
 * @param nouveaux les indices des nouveaux venus de la manche
 */
export function erreursDeLaFrise(ordre: readonly number[], annees: readonly number[], nouveaux: readonly number[]): number[] {
  return nouveaux.filter(x => {
    const i = ordre.indexOf(x)
    if (i < 0) return true
    return (i > 0 && annees[ordre[i - 1]] > annees[x]) || (i < ordre.length - 1 && annees[ordre[i + 1]] < annees[x])
  })
}

/** Les étoiles de tant d'erreurs : sans faute ★★★, une ★★, deux ★, au-delà rien (`ERREURS_DE_LA_FRISE`). */
export function etoilesDeLaFrise(erreurs: number): VerdictDUneManche['naturel'] {
  const palier = ERREURS_DE_LA_FRISE.findIndex(au => erreurs <= au)
  return (palier < 0 ? 0 : 3 - palier) as VerdictDUneManche['naturel']
}

/** Des années qui se rangent : toutes distinctes, à `ECART_DES_ANNEES_DE_LA_FRISE` ans au moins l'une de l'autre — plus près, elles se rangeraient au hasard. */
const bienEcartees = (annees: readonly number[]) => {
  const triees = [...annees].sort((a, b) => a - b)
  return triees.every((a, i) => i === 0 || a - triees[i - 1] >= ECART_DES_ANNEES_DE_LA_FRISE)
}

/**
 * La frise partagée en vagues, au départ : une tirée par manche, qui portent
 * toutes la même frise. Les sept événements se battent sur la graine ; les
 * trois premiers font la première vague, les deux suivants la deuxième, les
 * deux derniers la troisième — chaque vague dans l'ordre même du battage, qui
 * est l'ordre montré. Pas l'ordre montré de l'Expédition (`ordreMontre`),
 * jamais le bon : sur une vague de deux, « jamais le bon », c'est toujours à
 * rebours — l'ordre se lirait sans rien savoir. Ici, chaque nouveau venu se
 * pose de toute façon : l'ordre du temps peut se montrer, au hasard comme les
 * autres.
 *
 * Null : la frise ne se partage pas — pas autant d'événements que les vagues
 * en posent, deux années trop proches, ou, d'un sujet, un événement sans sa
 * question.
 */
export function friseEnVagues(frise: FriseAPartager, hasard: () => number): FriseTiree[] | null {
  const evenements = [...frise.evenements].sort((a, b) => a.annee - b.annee)
  if (evenements.length !== EVENEMENTS_D_UNE_FRISE_A_THEME || !bienEcartees(evenements.map(e => e.annee))) return null
  if (frise.sorte === 'sujet' && evenements.some(e => !e.id)) return null
  const rangs = evenements.map((_, r) => r)
  for (let i = rangs.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(hasard() * (i + 1)))
    ;[rangs[i], rangs[j]] = [rangs[j], rangs[i]]
  }
  const vagues: number[][] = []
  let pris = 0
  for (const n of VAGUES_DE_LA_FRISE) {
    vagues.push(rangs.slice(pris, pris + n))
    pris += n
  }
  return vagues.map((_, vague) => ({
    jeu: 'frise',
    sorte: frise.sorte,
    cle: frise.cle,
    theme: frise.theme,
    evenements: evenements.map(e => ({ ...e })),
    vagues: vagues.map(v => [...v]),
    vague,
    savais: frise.savais,
    categorie: frise.categorie,
    ...(frise.niveau ? { niveau: frise.niveau } : {}),
  }))
}

/** Les ancres de la manche, dans l'ordre du temps, et ses nouveaux venus, dans l'ordre montré — par leur rang. */
function enJeu(t: FriseTiree): { ancres: number[]; nouveaux: number[] } {
  return { ancres: t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b), nouveaux: t.vagues[t.vague] ?? [] }
}

/** Ce qui est posé jusqu'à cette manche, dans l'ordre du temps. */
const jusquIci = (t: FriseTiree) => t.vagues.slice(0, t.vague + 1).flat().sort((a, b) => a - b)

/** Les nouveaux venus de la manche, dans l'ordre du temps, dits avec leur année : la réponse au journal et au cartel. */
const ceQuIlFallaitDater = (t: FriseTiree) =>
  [...enJeu(t).nouveaux]
    .sort((a, b) => a - b)
    .map(r => `${anneeDite(t.evenements[r].annee)} : ${t.evenements[r].libelle}`)
    .join(' · ')

/**
 * L'ordre posé, au journal (`composee`) : un rang dans le temps par chiffre,
 * comme la frise de l'Expédition (« 1032 ») — sept événements y tiennent.
 */
const composee = (rangs: readonly number[]) => rangs.join('')

/** La colonne `composee` relue : chaque chiffre un rang déjà posé à cette manche, une fois. Null : rien de rangé, ou illisible. */
function relue(c: string | null | undefined, t: FriseTiree): number[] | null {
  if (typeof c !== 'string' || !/^\d+$/.test(c)) return null
  const rangs = [...c].map(Number)
  const poses = jusquIci(t)
  return new Set(rangs).size === rangs.length && rangs.every(r => poses.includes(r)) ? rangs : null
}

/** Une manche sans rien de posé : rien, comme partout ailleurs une manche sans réponse. */
const SANS_REPONSE: VerdictDUneManche = { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }

/** Un objet venu du téléphone, lu champ par champ. */
const objet = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null)

export const REGLE_DE_LA_FRISE: RegleDuJeu<FriseTiree, EtatDeLaFrise, GesteDeLaFrise, FriseMontree, FriseRevelee> = {
  cle: 'frise',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.frise * 1000,

  ouvrir: () => ({ devoiles: [] }),

  /**
   * Les jetons de l'écran, du plus ancien au plus récent selon lui, relus en
   * rangs dans le temps : chacun une fois, les ancres toutes là et dans leur
   * ordre — elles ne bougent pas. Un nouveau venu peut manquer : à
   * l'échéance, la page envoie la frise telle qu'elle est, et ce qui n'est
   * pas posé est faux.
   */
  lireLeGeste(brut, t) {
    const g = objet(brut)
    if (g?.quoi !== 'repondre') return null
    if (g.reponse === undefined || g.reponse === null) return { quoi: 'repondre', rangs: null }
    const ordre = objet(objet(g.reponse)?.frise)?.ordre
    const { ancres, nouveaux } = enJeu(t)
    const n = ancres.length + nouveaux.length
    if (!Array.isArray(ordre) || ordre.length > n) return null
    if (!ordre.every(j => Number.isInteger(j) && j >= 0 && j < n) || new Set(ordre).size !== ordre.length) return null
    const jetons = ordre as number[]
    const lesAncres = jetons.filter(j => j < ancres.length)
    if (lesAncres.length !== ancres.length || lesAncres.some((j, i) => j !== i)) return null
    return { quoi: 'repondre', rangs: jetons.map(j => (j < ancres.length ? ancres[j] : nouveaux[j - ancres.length])) }
  },

  // La frise se range sur le téléphone : aucun geste du serveur ne la tranche à moitié.
  apresLeGeste: () => `Ce geste ne sert pas ${JEUX.frise.a}`,

  juger(t, _e, reponse) {
    if (typeof reponse === 'string' || reponse.rangs === null) return SANS_REPONSE
    const { nouveaux } = enJeu(t)
    // Rien de posé ne vaut rien : sans quoi deux nouveaux venus laissés en plan feraient deux erreurs, une étoile.
    if (!reponse.rangs.some(r => nouveaux.includes(r))) return SANS_REPONSE
    const erreurs = erreursDeLaFrise(reponse.rangs, t.evenements.map(e => e.annee), nouveaux).length
    const naturel = etoilesDeLaFrise(erreurs)
    const juste = justeDeLaPiece(naturel, 'frise') === true
    return { naturel, pieces: [{ juste, choix: juste ? 0 : -1, composee: composee(reponse.rangs) }] }
  },

  /**
   * L'année du premier nouveau venu pas encore dévoilé, dans l'ordre montré —
   * jamais de tous : datés parmi des ancres datées, ils se rangeraient seuls.
   * Il en reste toujours un à placer de mémoire, comme le Mot mystère garde
   * toujours une lettre à trouver.
   */
  eclairer(t, e) {
    const reste = enJeu(t).nouveaux.filter(r => !e.devoiles.includes(r))
    if (reste.length <= 1) return RIEN_A_ECLAIRER
    return { devoiles: [...e.devoiles, reste[0]] }
  },

  montrer(t, e) {
    const { ancres, nouveaux } = enJeu(t)
    return {
      jeu: 'frise',
      theme: t.theme,
      vague: t.vague,
      ancres: ancres.map((r, j) => ({ jeton: j, libelle: t.evenements[r].libelle, annee: t.evenements[r].annee })),
      nouveaux: nouveaux.map((r, i) => ({
        jeton: ancres.length + i,
        libelle: t.evenements[r].libelle,
        ...(e.devoiles.includes(r) ? { annee: t.evenements[r].annee } : {}),
      })),
    }
  },

  reveler(t, _e, v) {
    const { nouveaux } = enJeu(t)
    const rangs = relue(v.pieces[0]?.composee, t)
    const faux = rangs ? erreursDeLaFrise(rangs, t.evenements.map(e => e.annee), nouveaux) : nouveaux
    const erreurs = faux.length
    return {
      jeu: 'frise',
      theme: t.theme,
      vague: t.vague,
      titre: !rangs ? 'Rien de rangé' : erreurs === 0 ? 'Sans faute' : `${erreurs} erreur${erreurs > 1 ? 's' : ''}`,
      erreurs,
      rangee: jusquIci(t).map(r => {
        const nouveau = nouveaux.includes(r)
        const place = !nouveau ? null : !rangs?.includes(r) ? 'pas-pose' : faux.includes(r) ? 'faux' : 'juste'
        return { libelle: t.evenements[r].libelle, annee: t.evenements[r].annee, nouveau, place }
      }),
      savais: t.vague === t.vagues.length - 1 ? t.savais : null,
    }
  },

  piece(t, _e, _v, i): PieceDuCabinet {
    // Unique dans sa partie : le signalement joint par (partie, identifiant). La frise à thème et sa manche ;
    // celle d'un sujet, les questions de ses nouveaux venus, que la fraîcheur du Cabinet déplie.
    const questions = [...enJeu(t).nouveaux]
      .sort((a, b) => a - b)
      .flatMap(r => {
        const id = t.evenements[r].id
        return id ? [id] : []
      })
    return {
      id: t.sorte === 'theme' ? idDeLaFriseATheme(t.cle, t.vague) : idDeLaFriseDeSujet(questions),
      texte: `${QUESTION_DE_LA_FRISE} (${t.theme})`,
      reponses: [ceQuIlFallaitDater(t)],
      bonne: 0,
      categorie: t.categorie,
      anecdote: t.savais,
      niveau: t.niveau ?? 'moyen',
      forme: 'frise',
      cabinet: { jeu: 'frise', manche: i.manche, tirage: i.tirage },
    }
  },

  // Le cartel garde la manche qu'il a le mieux rangée : la frise, ce qu'elle a daté, et son savais-tu.
  cartel: t => ({ sujet: `La frise : ${t.theme}`, reponse: ceQuIlFallaitDater(t), anecdote: t.savais }),
}

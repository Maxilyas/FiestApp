import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { aLaDemande, useALaDemande, type ALaDemande } from '../../aLaDemande'
import { api, motifDe, refusDuServeur } from '../../api'
import { serverNow } from '../../clock'
import { confirmDialog, fermerLeDialogue, promptDialog } from '../../components/Dialog'
import { Etoiles } from '../../components/Etoiles'
import { GerbeDeJuste } from '../../components/Gerbe'
import { Icon, type IconName } from '../../components/Icon'
import { NicheALaRevelation } from '../../components/NicheReagit'
import { Sortie } from '../../components/Pieces'
import { TimerBar } from '../../components/TimerBar'
import { rendreLeFocus } from '../../focus'
import { espacesFines } from '../../format'
import { insister } from '../../insister'
import { nicheRelacheSonSouffle, nicheRetientSonSouffle } from '../../niche'
import { useGardeRetour, type IssueDuRetour } from '../../retour'
import { showToast } from '../../state'
import { toucher } from '../../toucher'
import { SIGNALEMENT_MAX } from '../../../../shared/campagne'
import { gesteAccepte } from '../../../../shared/console'
import { reactionDuSolo, type ReactionALaRevelation } from '../../../../shared/niche'
import { ETOILES_D_UNE_JUSTE, ETOILES_D_UNE_PARTIE, ETOILES_PAR_MANCHE, MANCHES_PAR_PARTIE } from '../../../../shared/cabinet/bareme'
import type { CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { poussieresDites } from '../../../../shared/cabinet/musee'
import { POUVOIRS, refusDuPouvoir, type CleDePouvoir } from '../../../../shared/cabinet/pouvoirs'
import type { MancheMontree, RevelationDUneManche } from '../../../../shared/cabinet/jeux/index'
import type { FinDUneManche, GesteDuCabinet, Manche, ReponseDUnJeu } from '../../../../shared/cabinet/partie'
import type { RevelationVue, VueDeLaPartie } from '../../../../shared/cabinet/vues'
import { CE_QUI_BORNE_LA_BANDE, poserLaBande, poserLeMotDeQuitter, type OuvertureDeLaBande } from './bande'
import type { BilanDeLaPartie } from './Bilan'
import { etoilesDites } from './EnEtoiles'
import { titreDeLaPartie } from './ecrans'

// Une partie du Cabinet à l'écran (§ 2.2-2.7 de la conception) : le cadre
// d'une manche — la tête collée (les trois manches, les étoiles sur neuf,
// « Quitter », le chrono), la manche de son jeu, le pied collé (la carte-bonus
// et son geste, la suite) —, la mise qui se décide sans avoir vu, le voile de
// la pause, la révélation, puis le bilan (`Bilan.tsx`, à la demande).
//
// Rien ne s'y juge : la page envoie des gestes, au rang qu'elle croit suivre
// (invariant 12), et montre la vue que le serveur rend — un geste passé (un
// double toucher, un autre onglet) rend la vue d'à présent, où elle se range.
// Le chrono se lit à l'heure du serveur (`serverNow`, invariant 6), jamais à
// celle du téléphone ; à l'échéance, la page envoie d'elle-même ce qu'elle
// tenait (`repondre`, `auto`) — l'Éclair, ses réponses ; la Frise, ce qu'elle a
// rangé ; le Filet, son curseur et sa taille, tels qu'ils sont ; l'Épingle,
// celle qu'il a posée ; le Pari, le Détail, le Mot mystère, les Indices et la
// Réplique, rien : le serveur a déjà ce qui compte —, et
// insiste tant que le réseau manque : son rang la garde d'un double. Le
// serveur a une grâce pour le réseau ; la page ne la recopie pas, elle n'en
// a pas besoin.
//
// Chaque jeu a son écran, chargé à la demande (`ECRANS`, demandé dès
// l'annonce) : un module de `jeux/` qui dit ce que la page tient seule d'une
// manche, ce qui part à l'échéance, la manche et sa révélation. De ses règles
// (`shared/cabinet/jeux/`), qui jugent, la page ne prend que des types et ce
// qu'une règle exporte pour elle — les mots du Pari (`MOTS_DU_PARI`), la
// question du tableau et l'adresse d'un cadrage du Détail —, que le paquet
// garde seuls : jamais le pli, ni la lecture d'un geste.

// ── L'écran d'un jeu ──────────────────────────────────────────────────────

/** Un geste du jeu, tel que son écran l'envoie : le cadre y ajoute la manche, l'appel le rang. */
export type GesteDuJeu = SansManche<Extract<GesteDuCabinet, { manche: Manche }>>
/** `Omit` geste par geste : sur l'union entière, il n'en gardait que les clés communes. */
type SansManche<T> = T extends unknown ? Omit<T, 'manche'> : never

/**
 * Où une manche trouve ses images : sa partie, et l'indice de son contenu dans
 * le plan figé (`VueDeLaPartie.tirage`, `RevelationVue.tirage`) — l'adresse
 * d'un cadrage du Détail les porte (`adresseDUnCadrage`), jamais la manche :
 * après « Changer », la même manche joue un autre tableau, et le cache du
 * téléphone aurait rendu l'image d'avant. Absent, pour les révélations écrites
 * à la main des épreuves : pas d'image à demander.
 */
export interface OuEstLaManche {
  partie: string
  tirage?: number
}

export interface PropsDUneManche<M, L> extends OuEstLaManche {
  montree: M
  /** Ce que la page tient seule de la manche : les réponses de l'Éclair, l'affirmation sous les yeux, la frise rangée à moitié. */
  local: L
  setLocal: (l: L) => void
  envoyer: (g: GesteDuJeu) => void
  /**
   * La demi-seconde après un changement d'écran, ou après ce qui change sous le doigt (`sousLeDoigtDe` : chaque vue que le
   * serveur accepte) : un toucher qui y tombe était destiné à l'écran d'avant.
   */
  garde: () => boolean
  /**
   * La demi-seconde après un changement d'écran seulement — « Manche suivante » qui laisse sa place au clavier —, pas après une
   * vue neuve de la même manche : les lettres du Mot, tapées dès que les couleurs d'un essai paraissent, s'y perdaient sans un mot.
   */
  gardeDeLEcran: () => boolean
  busy: boolean
}

/**
 * L'écran d'un jeu : ce dont le cadre a besoin pour lui, sans rien de ses
 * règles. Pur : la manche montrée (`MancheMontree`) et ce que la page tient
 * (`L`) suffisent.
 */
export interface JeuALEcran<M, R, L> {
  /** Ce que la page tient au début d'une manche. */
  localDe(m: M): L
  /** Ce qui distingue le contenu d'une manche : « Changer » en pose un autre, et ce que la page tenait repart de zéro. */
  cleDe(m: M): string
  /** Ce qui part de soi-même à l'échéance : ce que la page tenait, ou rien — la manche se juge alors sur ce que le serveur savait. */
  aLEcheance(m: M, l: L): ReponseDUnJeu | undefined
  /** Ce qu'Éclairer vise, quand le jeu le demande : l'affirmation sous les yeux, à l'Éclair. */
  cibleDEclairer?(m: M, l: L): number | undefined
  /** Un geste fait sur place, que le serveur ne connaît pas encore : « Changer » vient avant (l'Éclair, une réponse donnée). */
  aJoueSurPlace?(m: M, l: L): boolean
  /**
   * Ce qui change sous le doigt sans que la vue change : l'affirmation de
   * l'Éclair, sous les mêmes « Faux » et « Vrai » ; la frise qui s'allonge
   * d'une pose. Le cadre y relance la demi-seconde de garde — un double
   * toucher répondait aussi à l'affirmation suivante, sans qu'on l'ait lue.
   * Ce que change une vue neuve (« Reculer », Éclairer, « Changer ») n'a rien
   * à y dire : le cadre la relance à chaque vue (`sousLeDoigtDe`).
   */
  sousEcranDe?(m: M, l: L): string
  Manche(p: PropsDUneManche<M, L>): ReactNode
  /**
   * Ce que le jeu colle au bas de l'écran, sous le pouce, pendant la manche :
   * le clavier du Mot mystère. Le cadre le pose dans son pied collé, sous la
   * carte-bonus qui sert encore — une qui ne sert plus se pose sous la manche,
   * et le clavier reste collé. Rendu dans la manche même, il aurait collé au
   * même bas que la carte-bonus, et l'un aurait couvert l'autre.
   */
  Pied?(p: PropsDUneManche<M, L>): ReactNode
  /**
   * La révélation d'une manche, et comment elle s'est tranchée (`fin`) :
   * quittée au bon mot, la Réplique se titre « Le bon mot » et ne rapporte
   * rien — son corps ne le savait pas, et ne disait pas pourquoi. Le cadre la
   * passe (`RevelationDeLaManche`), et « Mes réponses » (`Bilan.tsx`) aussi :
   * c'est là seulement qu'une manche quittée se montre — une partie quittée
   * s'ouvre sur son bilan.
   */
  Revelation(p: { corps: R; fin?: FinDUneManche } & OuEstLaManche): ReactNode
}

/** L'écran d'un jeu, ses types effacés : le cadre ne le lit que pour le jeu de sa partie, avec la manche que la vue de ce jeu montre. */
export type EcranEfface = JeuALEcran<MancheMontree, RevelationDUneManche, unknown>

/**
 * Les écrans des jeux, chacun à la demande — la page du musée ne les
 * télécharge pas, l'annonce demande celui de sa partie. Un jeu sans écran
 * ici s'annonce sans « Commencer » (`AnnonceEnAttente`, `CabinetApp.tsx`) :
 * le serveur peut en livrer un avant que la page n'ait le sien.
 */
const ECRANS: Partial<Record<CleDeJeu, ALaDemande<EcranEfface>>> = {
  pari: aLaDemande(() => import('./jeux/Pari').then(m => m.PARI as unknown as EcranEfface)),
  eclair: aLaDemande(() => import('./jeux/Eclair').then(m => m.ECLAIR as unknown as EcranEfface)),
  detail: aLaDemande(() => import('./jeux/Detail').then(m => m.DETAIL as unknown as EcranEfface)),
  frise: aLaDemande(() => import('./jeux/Frise').then(m => m.FRISE as unknown as EcranEfface)),
  mot: aLaDemande(() => import('./jeux/MotMystere').then(m => m.MOT as unknown as EcranEfface)),
  filet: aLaDemande(() => import('./jeux/Filet').then(m => m.FILET as unknown as EcranEfface)),
  epingle: aLaDemande(() => import('./jeux/Epingle').then(m => m.EPINGLE as unknown as EcranEfface)),
  indices: aLaDemande(() => import('./jeux/Indices').then(m => m.INDICES as unknown as EcranEfface)),
  replique: aLaDemande(() => import('./jeux/Replique').then(m => m.REPLIQUE as unknown as EcranEfface)),
}

export const ecranDuJeu = (jeu: CleDeJeu): ALaDemande<EcranEfface> | undefined => ECRANS[jeu]

/** Le bilan, à la demande : l'écran des gains et ses catalogues ne servent qu'à la fin. */
const LE_BILAN = aLaDemande(() => import('./Bilan'))

// ── Le chrono, à l'heure du serveur ───────────────────────────────────────

/**
 * Ce que la tête montre du chrono : l'échéance, la durée de l'étape, sous la pause ce qui restait — figé tant qu'elle dure —,
 * et le temps en plus de Prendre son temps (`enPlusMs`), où le repère se pose.
 */
export interface ChronoMontre {
  echeance: number
  dureeMs: number
  figeMs?: number
  enPlusMs?: number
}

/**
 * Le chrono de la vue, à `t` (l'heure du serveur). Sous la pause de
 * « Quitter ? », l'échéance recule tant qu'il reste de la pause : celle que la
 * vue dit (`echeance`, à l'heure où elle a été lue) plus ce qui en reste
 * (`pauseResteMs`) — l'instant où la réponse partira si la confirmation reste
 * ouverte. Jusque-là le chrono se fige sur ce qui restait ; passé, il reprend
 * sous le voile (§ 2.7).
 */
export function chronoMontre(vue: Pick<VueDeLaPartie, 'chrono' | 'maintenant'>, t: number): ChronoMontre | null {
  const c = vue.chrono
  if (!c) return null
  const enPlus = c.enPlusMs ? { enPlusMs: c.enPlusMs } : {}
  if (c.pauseResteMs === undefined) return { echeance: c.echeance, dureeMs: c.dureeMs, ...enPlus }
  const echeance = c.echeance + c.pauseResteMs
  if (t >= vue.maintenant + c.pauseResteMs) return { echeance, dureeMs: c.dureeMs, ...enPlus }
  return { echeance, dureeMs: c.dureeMs, figeMs: Math.max(0, c.echeance - vue.maintenant), ...enPlus }
}

/**
 * Le chrono est-il passé dans le temps en plus de Prendre son temps, à `t` (l'heure du serveur) — sous la pause, à ce qui
 * restait ? Le repère tombe au début du temps en plus ; le serveur ne le marque qu'après sa grâce : à quelques secondes près, la
 * page avertit plus tôt, jamais plus tard.
 */
export function dansLeTempsEnPlus(c: ChronoMontre | null, t: number): boolean {
  if (!c?.enPlusMs) return false
  return (c.figeMs ?? c.echeance - t) <= c.enPlusMs
}

/** La ligne de Prendre son temps, passé son repère, tant que la partie vise le cadre doré. */
export const TEMPS_EN_PLUS_DIT = 'Temps en plus : répondre maintenant ôte le cadre doré'

/**
 * `dansLeTempsEnPlus` à présent, et la page redessinée à l'instant où il bascule : la tête ne se redessine qu'à chaque
 * seconde de son chiffre, et la ligne de la carte-bonus attendait la vue suivante.
 */
function useDansLeTempsEnPlus(c: ChronoMontre | null): boolean {
  const [, setTic] = useState(0)
  const dedans = dansLeTempsEnPlus(c, serverNow())
  const echeance = c?.echeance
  const enPlus = c?.enPlusMs
  const fige = c?.figeMs !== undefined
  useEffect(() => {
    if (dedans || fige || echeance === undefined || !enPlus) return
    const id = setTimeout(() => setTic(n => n + 1), Math.max(0, echeance - enPlus - serverNow()) + 20)
    return () => clearTimeout(id)
  }, [dedans, fige, echeance, enPlus])
  return dedans
}

/**
 * Ce que la partie quittée emporte, tel que le serveur le compte
 * (`VueDeLaPartie.siTuQuittes` : « Quitter » joué par le pli, rien d'écrit) :
 * ses étoiles et sa poussière d'or. « Quitter ? » promettait « les étoiles déjà
 * gagnées », et Lucas, sous Prudence, est reparti avec une étoile et quatre
 * poussières sans en avoir gagné aucune (la tablée du 25 octobre 2026). Les
 * mots seulement : la règle reste au serveur, qui la change sans que la page la
 * recopie. Elle en déduisait que Protéger avait compté — le total quitté plus
 * haut que celui de la partie, la manche quittée relevée — et le disait encore
 * quand une manche quittée ne se relevait plus : au Pari laissé au choix, les
 * deux étoiles gardées devenaient « Protéger compris » (la relecture des
 * régressions du 26 octobre 2026). Ce que la vue ne dit pas, la page le tait.
 */
function ceQuOnEmporte(vue: Pick<VueDeLaPartie, 'origine'>, s: { total: number; poussiere: number }): string {
  const etoiles = s.total > 0 ? etoilesDites(s.total) : null
  const avec =
    etoiles === null
      ? s.poussiere > 0
        ? `sans étoile, et ${poussieresDites(s.poussiere)}`
        : 'sans étoile ni poussière d’or'
      : s.poussiere > 0
        ? `avec ${etoiles} et ${poussieresDites(s.poussiere)}`
        : `avec ${etoiles}`
  // Ce que le départ a consommé : la chasse, la case de la visite ; en libre, l'une de celles qui paient, si elle a payé.
  const consomme = vue.origine === 'chasse' ? ' ; ta chasse est utilisée' : vue.origine === 'visite' ? ' ; cette partie de la visite est faite' : s.poussiere > 0 ? ' : c’est l’une de tes parties libres qui paient' : ''
  return `Tu repars ${avec}${consomme}.`
}

/**
 * Ce que demande « Quitter ? » (§ 2.6) : ce que la partie emporte, comme le
 * serveur le compte (`siTuQuittes`), et ce que le départ a consommé — sans le
 * compte (une page d'avant, une vue écrite à la main), qu'elle compte avec ses
 * étoiles. Sous la pause, combien de temps le chrono attend ; refusée
 * (`PLUS_DE_PAUSE`, ses pauses épuisées ou son temps passé), la phrase du
 * serveur : la confirmation s'ouvre quand même, et le chrono continue.
 */
export function messageDuQuitter(vue: Pick<VueDeLaPartie, 'origine'> & Partial<Pick<VueDeLaPartie, 'siTuQuittes'>>, o: { pauseMs?: number; refus?: string } = {}): { titre: string; message: string } {
  const compte = vue.siTuQuittes
    ? ceQuOnEmporte(vue, vue.siTuQuittes)
    : vue.origine === 'libre'
      ? 'Elle compte avec ses étoiles.'
      : `La partie compte avec les étoiles déjà gagnées, et ${vue.origine === 'chasse' ? 'ta chasse est utilisée' : 'cette partie de la visite est faite'}.`
  const chrono = o.pauseMs !== undefined && o.pauseMs > 0 ? ` Le chrono t’attend ${secondesAuPlus(o.pauseMs)} au plus, la manche cachée.` : o.refus ? ` ${o.refus}.` : ''
  return { titre: vue.origine === 'libre' ? 'Quitter cette partie ?' : 'Quitter ?', message: compte + chrono }
}

/** Ce qui reste de pause, en secondes entières vers le haut : arrondies, 300 ms se lisaient « 0 secondes », et une seule « 1 secondes ». */
function secondesAuPlus(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000))
  return `${s} seconde${s > 1 ? 's' : ''}`
}

/** Ce que la page envoie d'elle-même à l'échéance : quand, et quoi. */
export interface EnvoiALEcheance {
  /** Dans combien de millisecondes, à l'heure du serveur. */
  readonly dans: number
  /** La réponse « auto » de la manche, de ce que la page tient à l'instant où elle part : le curseur du Filet a pu bouger depuis. */
  readonly geste: (local: unknown) => GesteDuCabinet
}

/**
 * Ce que la page envoie d'elle-même, vu à `t`, l'heure du serveur : à
 * l'échéance de l'étape qui court — sous la pause de « Quitter ? », reculée de
 * ce qui reste de pause, la confirmation encore ouverte —, tout de suite si
 * elle est passée, la réponse que l'écran du jeu tire de ce que la page tient
 * (`aLEcheance` : les affirmations de l'Éclair, rien au Pari) ; rien sans
 * l'écran du jeu, ni sans manche montrée, ni sans chrono : la mise qui se
 * décide, le choix du Pari, la révélation. Sortie de l'effet qui l'appelle,
 * toute : gardée par son seul texte, une garde changée en
 * `if (pret || !pret) return` — plus jamais rien d'envoyé — passait toutes les
 * épreuves (l'audit du code du 25 octobre 2026), et la garde laissée à l'effet
 * aussi (la relecture du lot page-1). L'effet n'a plus que le plan absent.
 */
export function aEnvoyerALEcheance(
  vue: Pick<VueDeLaPartie, 'phase' | 'chrono' | 'maintenant' | 'manche' | 'enCours'>,
  t: number,
  ecran: Pick<EcranEfface, 'aLEcheance'> | null,
): EnvoiALEcheance | null {
  const m = vue.enCours
  if (!ecran || !m || (vue.phase !== 'jouer' && vue.phase !== 'pause')) return null
  const c = chronoMontre(vue, t)
  if (!c) return null
  const manche = vue.manche
  return {
    dans: Math.max(0, c.echeance - t),
    geste: local => {
      const reponse = ecran.aLEcheance(m, local)
      return { quoi: 'repondre', manche, auto: true, ...(reponse && { reponse }) }
    },
  }
}

/**
 * La vue `b` remplace-t-elle `a` ? Jamais une plus ancienne : deux réponses
 * se croisent — un geste et la page relue au retour au premier plan, la
 * réponse « auto » et un toucher —, et la dernière arrivée n'est pas toujours
 * la plus récente. Le rang d'abord ; à rang égal, l'heure où le serveur l'a
 * dite (une pause qui s'écoule ne change pas le rang).
 */
export function plusRecente(a: Pick<VueDeLaPartie, 'rang' | 'maintenant'>, b: Pick<VueDeLaPartie, 'rang' | 'maintenant'>): boolean {
  return b.rang > a.rang || (b.rang === a.rang && b.maintenant >= a.maintenant)
}

/**
 * La réponse partie d'elle-même à l'échéance, « Quitter ? » ouvert, a-t-elle
 * tourné la page sous lui ? Arrivée, elle a fermé la pause (§ 2.7) : la
 * manche tranchée, ou l'étape suivante ouverte — à la Réplique, « Qui l'a
 * dit ? » —, la confirmation ne promet plus rien de vrai (« le chrono
 * t'attend, la manche cachée »), et « Continuer » n'aurait plus de pause à
 * reprendre : elle se ferme. Revenue sur la même étape (passée : l'autre
 * onglet l'a rejouée), elle reste ouverte.
 */
export function laReponseTourneLaPage(avant: VueDeLaPartie, apres: VueDeLaPartie): boolean {
  if (apres.phase !== 'jouer' && apres.phase !== 'pause') return true
  return apres.manche !== avant.manche || etapeDe(apres) !== etapeDe(avant)
}

/**
 * Ce que la révélation fête (§ 3.0). La niche dit ce que le journal retient :
 * la pièce juste dès deux étoiles naturelles (D3) nourrit le compagnon, quoi
 * qu'en fassent les pouvoirs — ravie, dépitée à zéro, calme à une. La gerbe
 * ne fête que ce que le bandeau fête : une juste qu'il dit à deux étoiles et
 * plus. Ni une mise perdue (une juste, zéro étoile : la gerbe éclatait sur un
 * bandeau rouge), ni une manche que Protéger porte d'une étoile à deux (pas
 * une juste : elle ne paie pas un confetti de plus, § 4.2).
 */
export function ceQueFeteLaRevelation(naturel: number, etoiles: number): { gerbe: boolean; niche: ReactionALaRevelation } {
  const juste = naturel >= ETOILES_D_UNE_JUSTE
  return { gerbe: juste && etoiles >= ETOILES_D_UNE_JUSTE, niche: reactionDuSolo(juste ? true : naturel === 0 ? false : null) }
}

/**
 * Le geste peut-il trancher la manche ? La niche retient alors son souffle
 * jusqu'au verdict : une réponse, touchée ou partie d'elle-même à l'échéance ;
 * les étoiles gardées du Pari ; chaque essai du Mot mystère et chaque nom des
 * Indices — la page ne sait pas s'il trouve (invariant 1), et le dernier
 * tranche même faux. Sans eux, ces deux jeux ne la retenaient jamais : la
 * partie, pour elle, ne se jouait pas, et une forme atteinte au bilan ne la
 * faisait pas sortir.
 */
export function leGesteRetientLeSouffle(g: Pick<GesteDuCabinet, 'quoi'>): boolean {
  return g.quoi === 'repondre' || g.quoi === 'garder' || g.quoi === 'essai' || g.quoi === 'nom'
}

/**
 * L'essai ou le nom revenu sans verdict — la manche encore à jouer — relâche le
 * souffle : des couleurs, un indice de plus ne sont pas une révélation, et
 * retenu d'un essai à l'autre, il assombrissait la niche jusqu'à deux minutes.
 * Une réponse attend toujours son verdict : au Pari juste, la mise se décide le
 * souffle retenu.
 */
export function leSouffleSeRelache(g: Pick<GesteDuCabinet, 'quoi'>, apres: Pick<VueDeLaPartie, 'phase'>): boolean {
  return (g.quoi === 'essai' || g.quoi === 'nom') && (apres.phase === 'jouer' || apres.phase === 'pause')
}

// ── Les pièces du cadre ───────────────────────────────────────────────────

const ICONE_DU_POUVOIR: Record<CleDePouvoir, IconName> = { eclairer: 'bulb', proteger: 'shield', temps: 'hourglass', miser: 'dice', changer: 'shuffle' }

/** « 3 étoiles sur 9 » : le total de la tête, à l'oreille. */
const etoilesSurNeuf = (n: number) => `${etoilesDites(n)} sur ${ETOILES_D_UNE_PARTIE}`

/**
 * Le seuil que la tête rappelle sous le total : celui d'une œuvre à gagner
 * (« il en faut 6 ») ; en visite pour dorer, celui de son double (« le double
 * à 5 ») — le cadre, lui, demande toutes les manches parfaites, que les cercles
 * disent. Une chasse pour dorer fige aussi un seuil (`cadreDuDepart`), qui ne
 * donne rien : sans cadre doré, elle est manquée, il n'y a pas de double en
 * chasse (`issueDe`). La tête disait « il en faut 5 » sous l'annonce qui venait
 * de dire « toutes ses manches parfaites » (la relecture du lot page-2).
 */
export function seuilDeLaTete(vue: Pick<VueDeLaPartie, 'enJeu' | 'seuil' | 'origine'>): string | null {
  if (vue.seuil === null || !vue.enJeu) return null
  if ('rarete' in vue.enJeu) return `il en faut ${vue.seuil}`
  if ('pourDorer' in vue.enJeu && vue.origine === 'visite') return `le double à ${vue.seuil}`
  return null
}

/**
 * Ce qui change sous le doigt sans changer d'écran, et relance la demi-seconde
 * de garde : chaque vue que le serveur accepte (son rang) — Éclairer efface un
 * titre, « Changer » pose un autre tableau, « Reculer » l'élargit, sous les
 * mêmes boutons —, et ce que l'écran du jeu change sans elle (`sousEcranDe`).
 * Sans le rang, un double toucher sur la carte-bonus en jouait deux usages :
 * la réponse du premier revenue avant le second, rien n'avait relancé la garde.
 */
export function sousLeDoigtDe(vue: Pick<VueDeLaPartie, 'rang' | 'enCours'>, ecran: EcranEfface | null, local: unknown): string {
  const duJeu = ecran && vue.enCours ? (ecran.sousEcranDe?.(vue.enCours, local) ?? '') : ''
  return `${vue.rang}|${duJeu}`
}

/** L'étape où en est la manche, pour les jeux qui en ont deux : le cadre change d'écran avec elle. */
const etapeDe = (vue: VueDeLaPartie) => {
  const m = vue.enCours as { etape?: number; auChoix?: boolean } | undefined
  return `${m?.etape ?? 1}${m?.auChoix ? '+' : ''}`
}

/**
 * Les secondes qui pressent, au chrono d'une manche : ses manches durent de 25
 * à 120 secondes, et les cinq d'une question de soirée y arrivaient tard.
 */
export const SECONDES_QUI_PRESSENT = 10

/**
 * La tête collée : les trois manches — jouées, leurs étoiles ; celle qui se
 * joue, cerclée —, les étoiles sur neuf, « Quitter », et le chrono quand il
 * court. Elle pose `--bg` sous elle : les thèmes repeignent `.card` d'un verre.
 * « Quitter » est une icône et son mot : quand la tête n'a plus la place — le
 * texte agrandi, la niche posée —, le mot se cache (`@container tete`,
 * `styles.css`) et le bouton garde son nom ; au texte du téléphone à 130 %,
 * « 0 / 9 ★ » passait dessous (Jeanne, à la tablée du 25 octobre 2026). Une
 * police de thème plus large que celles d'office le cache aussi, mesurée
 * (`useLeMotDeQuitter`).
 */
function TeteDeLaPartie({ vue, chrono, onQuitter }: { vue: VueDeLaPartie; chrono: ChronoMontre | null; onQuitter: () => void }) {
  const seuil = seuilDeLaTete(vue)
  const rangee = useRef<HTMLDivElement>(null)
  useLeMotDeQuitter(rangee)
  return (
    <header className="cab-tete-partie">
      <div className="cab-tete-ligne" ref={rangee}>
        <span className="cab-points" role="img" aria-label={`Manche ${vue.manche + 1} sur ${MANCHES_PAR_PARTIE}`}>
          {vue.manches.map((m, k) => (
            <span
              key={k}
              className={'cab-point' + (m.etoiles !== null ? ' cab-point-joue' : k === vue.manche && vue.phase !== 'avant' && vue.phase !== 'finie' ? ' cab-point-ici' : '')}
            >
              {m.etoiles ?? ''}
            </span>
          ))}
        </span>
        {/* Le seuil, rappelé sous le total quand une œuvre est en jeu : l'annonce le disait, la tête plus — Camille n'a su ni s'il
            fallait parier, ni que l'œuvre était perdue (la tablée du 25 octobre 2026). Sur sa ligne : à côté, il passait la tête à
            la ligne en 360 de large, la niche posée. */}
        <span className="cab-total" role="img" aria-label={seuil === null ? etoilesSurNeuf(vue.total) : `${etoilesSurNeuf(vue.total)}, ${seuil}`}>
          <span className="cab-total-ligne">
            <b>{vue.total}</b>
            {` / ${ETOILES_D_UNE_PARTIE} ★`}
          </span>
          {seuil !== null && <span className="cab-seuil-tete">{seuil}</span>}
        </span>
        {vue.phase !== 'finie' && (
          <button type="button" className="btn cab-quitter" aria-label="Quitter" {...toucher(onQuitter)}>
            <Icon name="x" />
            <span className="cab-quitter-mot">Quitter</span>
          </button>
        )}
      </div>
      {/* Sous Prendre son temps, le repère du temps en plus : Camille perdait son cadre doré sans le voir (la tablée du 26). */}
      {chrono && <TimerBar deadline={chrono.echeance} duration={chrono.dureeMs / 1000} frozenMs={chrono.figeMs} urgence={SECONDES_QUI_PRESSENT} repereMs={chrono.enPlusMs} />}
    </header>
  )
}

/**
 * Le mot de « Quitter », montré tant qu'il tient sur la rangée des manches
 * (`poserLeMotDeQuitter`, `bande.ts`) : remesuré quand la rangée change de
 * taille — le téléphone tourné, la niche posée, le mot qui la faisait passer à
 * la ligne —, et quand une police du thème arrive après la tête
 * (`font-display: swap`), qui l'élargit sans changer sa largeur. Chaque mesure
 * rend le même verdict sur la même rangée : l'observateur ne boucle pas.
 */
function useLeMotDeQuitter(rangee: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = rangee.current
    if (!el) return
    const poser = () => poserLeMotDeQuitter(el)
    poser()
    const suivi = typeof ResizeObserver === 'function' ? new ResizeObserver(poser) : null
    suivi?.observe(el)
    document.fonts?.addEventListener('loadingdone', poser)
    return () => {
      suivi?.disconnect()
      document.fonts?.removeEventListener('loadingdone', poser)
    }
  }, [rangee])
}

/**
 * La carte-bonus pendant une manche : Éclairer et Changer, un geste — grisé
 * avec sa raison, celle que la vue porte (`pouvoir.refus`) ; Protéger, le
 * temps en plus et la mise, une ligne : ils agissent seuls, ou se sont décidés
 * avant la manche. Prendre son temps, passé le repère du chrono, dit ce que
 * coûte de répondre tant que la partie vise le cadre doré : sa ligne ne
 * changeait jamais, et le cadre se perdait sans un mot (Camille, à la tablée du
 * 26 octobre 2026) — dite à l'oreille quand elle change.
 */
function CarteDeLaManche({
  vue,
  ecran,
  local,
  busy,
  chrono,
  cadreDejaDore = false,
  onGeste,
}: {
  vue: VueDeLaPartie
  ecran: EcranEfface
  local: unknown
  busy: boolean
  chrono: ChronoMontre | null
  cadreDejaDore?: boolean
  onGeste: (g: GesteDuCabinet) => void
}) {
  const enPlus = useDansLeTempsEnPlus(chrono)
  const c = vue.carte
  if (!c || !vue.enCours) return null
  const icone = <Icon name={ICONE_DU_POUVOIR[c.pouvoir]} />
  if (c.pouvoir !== 'eclairer' && c.pouvoir !== 'changer') {
    const dit = c.pouvoir === 'temps' && enPlus && viseLeCadreDore(vue, cadreDejaDore) ? TEMPS_EN_PLUS_DIT : c.dit
    return (
      <p className="cab-carte-ligne">
        {icone}
        <span aria-live={c.pouvoir === 'temps' ? 'polite' : undefined}>{espacesFines(dit)}</span>
      </p>
    )
  }
  const m = vue.enCours
  // Ce que le serveur ne sait pas encore : une réponse de l'Éclair donnée sur place. La seule règle des refus le dit, sur ce que la
  // page tient (`refusDuPouvoir` : « Change avant de répondre ») — elle ne s'écrit pas une seconde fois ici.
  const surPlace = c.pouvoir === 'changer' && ecran.aJoueSurPlace?.(m, local) ? refusDuPouvoir({ pouvoir: 'changer', force: c.force, jeu: vue.jeu, servi: 0, aJoue: true, rechanges: 1 }) : null
  const refus = vue.pouvoir?.jouable ? surPlace : (vue.pouvoir?.refus ?? null)
  const cible = ecran.cibleDEclairer?.(m, local)
  const geste: GesteDuCabinet = c.pouvoir === 'eclairer' ? { quoi: 'eclairer', manche: vue.manche, ...(cible !== undefined && { affirmation: cible }) } : { quoi: 'changer', manche: vue.manche }
  return (
    <>
      <button type="button" className="btn btn-block cab-pouvoir" aria-disabled={refus !== null || busy || undefined} {...toucher(() => refus === null && !busy && onGeste(geste))}>
        {icone}
        {POUVOIRS[c.pouvoir].nom}
        <span className="cab-reste">{` · encore ${c.reste}`}</span>
      </button>
      {refus && <p className="cab-raison">{espacesFines(refus)}</p>}
    </>
  )
}

/**
 * La partie vise-t-elle encore le cadre doré ? Une œuvre en jeu — à gagner ou
 * à dorer ; ni en libre, ni pour la poussière d'or —, et chaque manche déjà
 * jugée parfaite d'elle-même (`naturel`) sans qu'un pouvoir ait servi : la
 * note d'une manche dit le pouvoir qui l'a aidée (« éclairée », une mise,
 * « changée », « temps en plus »). Une mise jouée l'ôte (`cadreDore`) : Théo a
 * misé, fait 9 sur 9, et gagné son œuvre sans cadre doré, sans que rien l'ait
 * dit (la tablée du 25 octobre 2026). Une œuvre à dorer dont le cadre est déjà
 * doré (`cadreDejaDore` : la dorure achetée dans la journée, que la page lit de
 * ses salles) n'a plus de cadre à perdre, seulement son double.
 */
export function viseLeCadreDore(vue: Pick<VueDeLaPartie, 'enJeu' | 'manches'>, cadreDejaDore = false): boolean {
  if (cadreDejaDore || !vue.enJeu || 'poussiere' in vue.enJeu) return false
  return vue.manches.every(m => m.naturel === null || (m.naturel === ETOILES_PAR_MANCHE && !m.note))
}

/** La mise, avant une manche, sans l'avoir vue : « Pas cette fois » l'ouvre sans elle (§ 4.1). */
export function MiserOuPas({
  vue,
  manche,
  cadreDejaDore = false,
  busy,
  onMiser,
}: {
  vue: VueDeLaPartie
  manche: Manche
  cadreDejaDore?: boolean
  busy: boolean
  onMiser: (oui: boolean) => void
}) {
  return (
    <section className="cab-bloc cab-mise" aria-labelledby="cab-miser">
      <span className="cab-surtitre">{`Manche ${manche + 1} sur ${MANCHES_PAR_PARTIE}`}</span>
      <h2 id="cab-miser">Miser sur cette manche ?</h2>
      <p className="cab-ligne">{espacesFines(POUVOIRS.miser.dit)}</p>
      {vue.carte && <p className="cab-ligne cab-dit">{espacesFines(vue.carte.dit)}</p>}
      {viseLeCadreDore(vue, cadreDejaDore) && <p className="cab-ligne">{espacesFines('Tu vises le cadre doré : miser le perdrait.')}</p>}
      <div className="cab-gestes">
        <button type="button" className="btn btn-primary" aria-disabled={busy || undefined} {...toucher(() => !busy && onMiser(true))}>
          Miser
        </button>
        <button type="button" className="btn" aria-disabled={busy || undefined} {...toucher(() => !busy && onMiser(false))}>
          Pas cette fois
        </button>
      </div>
    </section>
  )
}

/**
 * Sous la confirmation de « Quitter ? », la manche se cache : la pause n'achète
 * pas de temps pour chercher (D10). Une pause sans question — la page
 * rechargée sous « Quitter ? » puis reprise du musée, « Continuer » perdu en
 * route, la pause écrite dont la réponse s'est perdue — a son « Continuer »
 * sous le voile (`onReprendre`) : sans lui, la manche restait cachée, sans un
 * bouton, jusqu'à son échéance, et ne valait rien.
 *
 * La pause bornée passée, le chrono reprend sous le voile (`repris`) : le
 * voile le dit, en une région qui se dit — il disait « En pause » pendant que
 * les secondes défilaient dans la tête (Lucas, à la tablée du 25 octobre
 * 2026).
 */
export function VoileDeLaPause({ busy = false, repris = false, onReprendre }: { busy?: boolean; repris?: boolean; onReprendre?: () => void }) {
  const attente = onReprendre ? 'Ta manche t’attend, cachée.' : repris ? 'Ta manche reste cachée : réponds à « Quitter ? »' : 'La manche se cache le temps de ta réponse.'
  return (
    <div className="cab-voile" role="note">
      <Icon name={repris ? 'hourglass' : 'pause'} />
      <p className="cab-voile-dit" aria-live="polite">
        <b>{repris ? 'Le chrono a repris' : 'En pause'}</b>
        <span>{espacesFines(attente)}</span>
      </p>
      {onReprendre && (
        <button type="button" className="btn btn-primary btn-big" aria-disabled={busy || undefined} {...toucher(() => !busy && onReprendre())}>
          Continuer
        </button>
      )}
    </div>
  )
}

/**
 * Le titre d'une révélation, et ce qui se dit dessous. Le titre du corps vient du jeu, qui ne sait rien de la mise : misée et
 * pas parfaite, la manche ne vaut rien, et « Reconnu » coiffait zéro étoile, « Trouvé en 3 essais » aussi (Théo, à la tablée du
 * 26 octobre 2026). Une mise perdue se titre donc « Mise perdue », le titre du jeu dessous — et pourquoi, s'il avait trouvé à
 * moitié ; une mise gagnée garde le titre du jeu, sa note dit ce qu'elle a rapporté.
 */
export function titreDeLaRevelation(r: Pick<RevelationVue, 'misee' | 'corps'>, naturel: number | null): { titre: string; dessous?: string } {
  if (r.misee !== 'perdue') return { titre: r.corps.titre }
  return { titre: 'Mise perdue', dessous: naturel ? `${r.corps.titre} : la mise voulait la manche parfaite.` : r.corps.titre }
}

/** Ce que « Signaler une erreur » vise : la question, ou, au Pari parié, l'une des deux — le seul jeu qui en ait deux. */
const ceQuOnSignale = (positions: readonly number[], i: number) => (positions.length === 1 ? 'cette question' : i === 0 ? 'la première question' : 'la question du pari')

/**
 * La révélation d'une manche (§ 3.0) : ses étoiles et pourquoi elles
 * diffèrent (« +4 : mise gagnée »), un titre qui dit ce qui s'est passé — le
 * `h2` de l'écran, pour tous les jeux —, le
 * corps de son jeu, « Le savais-tu ? », « Signaler une erreur » pour les
 * seules questions de la base. La niche et la gerbe la fêtent, chacune ce
 * qu'elle sait (`ceQueFeteLaRevelation`).
 */
export function RevelationDeLaManche({ vue, revelation: r, ecran, onSignaler }: { vue: VueDeLaPartie; revelation: RevelationVue; ecran: EcranEfface; onSignaler: (position: number) => void }) {
  const m = vue.manches[r.manche]
  const etoiles = m?.etoiles ?? 0
  const fete = ceQueFeteLaRevelation(m?.naturel ?? 0, etoiles)
  const titre = titreDeLaRevelation(r, m?.naturel ?? null)
  return (
    <>
      <div className={'card result-banner ' + (etoiles > 0 ? 'result-ok' : 'result-ko')} role="status">
        <NicheALaRevelation cle={`cabinet:${vue.id}:${r.manche}`} reaction={fete.niche} />
        <span className="big cab-etoiles-manche">
          <Etoiles n={Math.min(3, etoiles)} grandes />
        </span>
        {/* Le titre de la révélation, où le focus se pose quand elle prend la place de la manche (`rendreLeFocus`) : la réponse
            touchée disparue, il tombait sur la page, et le lecteur d'écran ne disait rien du verdict. */}
        <h2 className="cab-titre-revele">{espacesFines(titre.titre)}</h2>
        {titre.dessous && <p className="cab-titre-du-jeu">{espacesFines(titre.dessous)}</p>}
        {/* Une mise perdue a son titre : la note qui la disait ne le redit pas. */}
        {m?.note && r.misee !== 'perdue' && <p className="cab-note">{espacesFines(m.note)}</p>}
        {r.fin === 'expiree' && <p>Temps écoulé</p>}
        {r.fin === 'quittee' && <p>Manche quittée</p>}
        {fete.gerbe && <GerbeDeJuste />}
      </div>
      <ecran.Revelation corps={r.corps} partie={vue.id} tirage={r.tirage} fin={r.fin} />
      {r.corps.savais && (
        <p className="card anecdote">
          <Icon name="message" />
          <span>
            <b>Le savais-tu ?</b> {espacesFines(r.corps.savais)}
          </span>
        </p>
      )}
      {r.signalables.map((position, i) => (
        <button key={position} type="button" className="lien-signaler link-inline small" {...toucher(() => onSignaler(position))}>
          {`Signaler une erreur dans ${ceQuOnSignale(r.signalables, i)}`}
        </button>
      ))}
    </>
  )
}

// ── Ce que la tête et le pied collés laissent à la manche ─────────────────

/**
 * La bande de la manche (`bande.ts`), posée sur la page de la partie :
 * `--cab-tete`, où se collent la question de l'Épingle et le tableau du
 * Détail ; `--cab-fenetre` ; `--cab-place`, ce qui reste à la carte de
 * l'Épingle sous sa question collée, et au tableau du Détail avec un titre
 * sous lui. Mesurée quand l'étape (`cle`) ou ce qui la borne (`forme` : la
 * manche, la révélation, la mise ; le pied collé ou posé) changent, puis quand
 * la tête, le pied ou la question changent de taille et quand la fenêtre
 * change — jamais à chaque rendu : une lettre du Mot, un cran du Filet
 * refaisaient trois mesures et un observateur.
 */
function useBandeDeLaManche(page: RefObject<HTMLDivElement | null>, cle: string | null, forme: string) {
  const ouverture = useRef<OuvertureDeLaBande | null>(null)
  useLayoutEffect(() => {
    const el = page.current
    if (!el) return
    const poser = () => {
      ouverture.current = poserLaBande(el, window, cle, ouverture.current)
    }
    poser()
    const suivi = typeof ResizeObserver === 'function' ? new ResizeObserver(poser) : null
    el.querySelectorAll(CE_QUI_BORNE_LA_BANDE).forEach(c => suivi?.observe(c))
    window.addEventListener('resize', poser)
    return () => {
      suivi?.disconnect()
      window.removeEventListener('resize', poser)
    }
  }, [page, cle, forme])
}

export interface PropsDeLEcran {
  vue: VueDeLaPartie
  /** L'écran du jeu : en chemin (null), ou perdu — le navigateur garde l'échec d'un `import()`. */
  ecran: EcranEfface | null | 'perdu'
  local: unknown
  setLocal: (l: unknown) => void
  chrono: ChronoMontre | null
  busy: boolean
  /** La manche dont la mise se décide, ouverte d'une révélation ; la phase `avant` décide de la première. */
  miser: Manche | null
  /** L'œuvre à dorer a déjà son cadre (`dejaDoree`, lu de la page du musée) : la mise n'a pas de cadre à perdre. */
  cadreDejaDore?: boolean
  garde: () => boolean
  gardeDeLEcran: () => boolean
  onGeste: (g: GesteDuCabinet) => void
  onQuitter: () => void
  /** La pause sans question à qui la reprendre : « Continuer » sous le voile. Absent, « Quitter ? » est ouvert et répondra. */
  onReprendre?: () => void
  onSuivante: () => void
  onMiser: (oui: boolean) => void
  onSignaler: (position: number) => void
  onMusee: () => void
}

/**
 * Une partie à l'écran, telle que la vue la dit — pur, sa bande mesurée à part
 * (`useBandeDeLaManche`) : le contrôleur (`Partie`) tient la vue, les gestes,
 * le chrono et ce que la page tient seule.
 */
export function EcranDeLaPartie(p: PropsDeLEcran) {
  const { vue, ecran } = p
  const page = useRef<HTMLDivElement>(null)
  const r = vue.revelation
  const ouverte = vue.phase === 'avant' ? 0 : p.miser
  let corps: ReactNode
  let pied: ReactNode = null
  let colle = true
  // Une carte-bonus qui ne sert plus, sous la manche, quand le jeu garde le bas de l'écran pour lui (le clavier du Mot).
  let pose: ReactNode = null
  // Ce qui est à l'écran, pour la bande : une manche ouverte a son étape, mesurée à son ouverture ; le reste n'en a pas.
  let quoi = 'attente'
  let cleDeLaBande: string | null = null
  if (ecran === 'perdu') {
    corps = (
      <div className="cab-bloc">
        <p className="cab-ligne">{espacesFines('Ce jeu ne s’est pas chargé : recharge la page, ta partie t’attend.')}</p>
        <button type="button" className="btn btn-primary" {...toucher(() => window.location.reload())}>
          Recharger
        </button>
      </div>
    )
  } else if (!ecran) {
    corps = (
      <p className="cab-ligne" aria-busy="true">
        Chargement…
      </p>
    )
  } else if (ouverte !== null) {
    quoi = 'mise'
    corps = <MiserOuPas vue={vue} manche={ouverte} cadreDejaDore={p.cadreDejaDore} busy={p.busy} onMiser={p.onMiser} />
  } else if (r && (vue.phase === 'revele' || vue.phase === 'finie')) {
    quoi = 'revelation'
    corps = <RevelationDeLaManche vue={vue} revelation={r} ecran={ecran} onSignaler={p.onSignaler} />
    pied = (
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={p.busy || undefined} {...toucher(() => !p.busy && p.onSuivante())}>
        {vue.phase === 'finie' ? 'Voir le bilan' : 'Manche suivante'}
      </button>
    )
  } else if (vue.phase === 'pause') {
    quoi = 'pause'
    // Sa pause passée, le chrono court sous le voile : `chronoMontre` ne le fige plus.
    corps = <VoileDeLaPause busy={p.busy} repris={p.chrono !== null && p.chrono.figeMs === undefined} onReprendre={p.onReprendre} />
  } else if (vue.enCours) {
    quoi = 'manche'
    // Une étape par écran du jeu (`etapeDe`) : « Changer » la garde — un autre tableau, un autre lieu, à la même taille.
    cleDeLaBande = `${vue.id}:${vue.manche}:${etapeDe(vue)}`
    const manche: PropsDUneManche<MancheMontree, unknown> = {
      montree: vue.enCours,
      partie: vue.id,
      tirage: vue.tirage,
      local: p.local,
      setLocal: p.setLocal,
      envoyer: g => p.onGeste({ ...g, manche: vue.manche } as GesteDuCabinet),
      garde: p.garde,
      gardeDeLEcran: p.gardeDeLEcran,
      busy: p.busy,
    }
    corps = <ecran.Manche {...manche} />
    // La carte-bonus reste sous le pouce tant qu'elle peut servir ; sans carte, pas de pied, qui collait un bandeau vide au bas de l'écran.
    const carte = vue.carte ? <CarteDeLaManche vue={vue} ecran={ecran} local={p.local} busy={p.busy} chrono={p.chrono} cadreDejaDore={p.cadreDejaDore} onGeste={p.onGeste} /> : null
    const sert = !!vue.pouvoir?.jouable
    if (ecran.Pied) {
      // Le pied du jeu reste collé, la carte-bonus qui sert encore au-dessus de lui ; une qui ne sert plus se pose sous la manche.
      pied = (
        <>
          {sert && carte}
          <ecran.Pied {...manche} />
        </>
      )
      pose = sert ? null : carte
    } else if (carte) {
      pied = carte
      colle = sert
    }
  }
  // Ce qui borne la bande et peut changer d'élément : ce qui est à l'écran, la manche, le pied collé ou posé.
  const formeDeLaBande = `${quoi}:${vue.manche}:${pied ? (colle ? 'colle' : 'pose') : '-'}:${pose ? 'pose' : '-'}`
  useBandeDeLaManche(page, cleDeLaBande, formeDeLaBande)
  // Rien ne court entre deux manches, ni avant la mise : on peut repartir au musée, la partie l'y attend.
  const sansChrono = vue.phase === 'revele' || (vue.phase === 'avant' && !vue.chrono)
  return (
    <div ref={page} className="player-shell cab-page cab-partie">
      {sansChrono && <Sortie vers="Le Cabinet" href="/cabinet" onClick={p.onMusee} />}
      <TeteDeLaPartie vue={vue} chrono={p.chrono} onQuitter={p.onQuitter} />
      <div className="quiz-player cab-manche">{corps}</div>
      {pose && <div className="cab-pied-partie cab-pied-pose">{pose}</div>}
      {pied && <div className={colle ? 'cab-pied-partie' : 'cab-pied-partie cab-pied-pose'}>{pied}</div>}
    </div>
  )
}

// ── La partie ─────────────────────────────────────────────────────────────

/**
 * La partie qui se joue : sa vue, ses gestes, le chrono, la pause de
 * « Quitter ? », la garde du retour du navigateur pendant une manche, puis le
 * bilan. `relue` : la partie telle que la page du musée l'a relue — au retour
 * au premier plan, après un refus —, qui prend la place de la sienne si elle
 * est plus avancée.
 */
export function Partie({
  depart,
  relue,
  cadreDejaDore = false,
  onMusee,
  onRelire,
  onFinie,
  onRejouer,
  onRetenter,
}: {
  depart: VueDeLaPartie
  relue: VueDeLaPartie | null
  /** L'œuvre à dorer a déjà son cadre (`dejaDoree`) : la vue ne le dit pas, la page le lit de ses salles. */
  cadreDejaDore?: boolean
  onMusee: () => void
  onRelire: () => void
  /** Elle vient de finir — sa dernière manche, « Quitter », ou relue finie d'un autre onglet : son œuvre a pu changer. */
  onFinie?: () => void
  onRejouer?: () => void
  /** Une partie de la visite manquée : « Retenter » sa case, au bilan. */
  onRetenter?: () => void
}) {
  const [vue, setVue] = useState(depart)
  const [busy, setBusy] = useState(false)
  const [miser, setMiser] = useState<Manche | null>(null)
  const [bilanOuvert, setBilanOuvert] = useState(false)
  const [local, setLocalBrut] = useState<{ cle: string; valeur: unknown } | null>(null)
  const [, setTic] = useState(0)
  // « Quitter ? » posé — la pause demandée, la confirmation ouverte, sa réponse en route — : la pause a sa question.
  const [question, setQuestion] = useState(false)
  const ecran = useALaDemande(ecranDuJeu(depart.jeu)!)
  const bilan = useALaDemande(LE_BILAN)
  const pret = ecran && ecran !== 'perdu' ? ecran : null

  // Ce que les gestes et les minuteries lisent au moment où ils partent : la vue d'à présent, pas celle de leur rendu.
  const vueRef = useRef(vue)
  const enVol = useRef(false)
  const enQuestion = useRef(false)
  const monte = useRef(true)

  // Démontée « Quitter ? » ouvert — un second retour ferme la partie —, elle emporte sa question : laissée là, la confirmation
  // restait par-dessus le musée, et « Quitter » y aurait clos une partie que la page ne montrait plus, sans la relire.
  useEffect(() => {
    monte.current = true
    return () => {
      monte.current = false
      if (enQuestion.current) fermerLeDialogue()
    }
  }, [])

  const cleDuLocal = pret && vue.enCours ? `${vue.manche}:${pret.cleDe(vue.enCours)}` : null
  const valeur = local && local.cle === cleDuLocal ? local.valeur : pret && vue.enCours ? pret.localDe(vue.enCours) : null
  const localRef = useRef(valeur)
  localRef.current = valeur
  const setLocal = (v: unknown) => {
    if (cleDuLocal === null) return
    localRef.current = v
    setLocalBrut({ cle: cleDuLocal, valeur: v })
  }

  /** La vue d'après — jamais une vue plus ancienne que celle qu'on tient (`plusRecente`). */
  const ranger = useCallback((v: VueDeLaPartie) => {
    if (!plusRecente(vueRef.current, v)) return
    vueRef.current = v
    setVue(v)
  }, [])

  // La partie relue par la page — au retour au premier plan, l'horloge remise à zéro : elle a pu continuer sans nous.
  useEffect(() => {
    if (relue && relue.id === vueRef.current.id && !enVol.current) ranger(relue)
  }, [relue, ranger])

  // Finie, elle a pu gagner, dorer ou doubler son œuvre : la page l'apprend aussitôt, la partie encore à l'écran — à sa sortie,
  // l'œuvre d'une chasse reparue par le retour du navigateur aurait montré un instant le cartel d'avant.
  const finie = vue.phase === 'finie'
  useEffect(() => {
    if (finie) onFinie?.()
  }, [finie, onFinie])

  /**
   * Un geste, au rang de la vue d'à présent. Un seul à la fois ; celui que la
   * page envoie d'elle-même à l'échéance (`auto`) attend son tour, et insiste
   * tant que le réseau manque — un refus du serveur, lui, ne se retente pas.
   */
  const jouer = useCallback(
    async (geste: GesteDuCabinet, auto = false): Promise<void> => {
      const v = vueRef.current
      if (enVol.current) {
        if (auto) throw new Error('Un geste est déjà en route')
        return
      }
      // Un geste qui peut trancher la manche — une réponse, les étoiles gardées, un essai du Mot, un nom des Indices — : la niche
      // retient son souffle.
      if (leGesteRetientLeSouffle(geste)) nicheRetientSonSouffle()
      enVol.current = true
      setBusy(true)
      try {
        const r = await api.cabinet.geste(v.id, v.rang, geste)
        ranger(r.partie)
        // L'essai ou le nom revenu sans verdict, pas encore trouvé : elle reprend son souffle jusqu'au suivant.
        if (leSouffleSeRelache(geste, r.partie)) nicheRelacheSonSouffle()
        // Partie d'elle-même à l'échéance, la réponse a tourné la page sous la confirmation ouverte : elle se ferme.
        if (auto && enQuestion.current && laReponseTourneLaPage(v, r.partie)) fermerLeDialogue()
        // Passé : un double toucher, l'autre onglet. À l'échéance, la réponse a croisé la sienne : rien à dire.
        if (r.passe && !auto) showToast({ kind: 'info', message: r.passe })
      } catch (e) {
        if (auto && !refusDuServeur(e)) throw e
        // L'essai ou le nom perdu en route, ou refusé, n'a pas de verdict non plus ; la page relue dira le sien, s'il en a un.
        if (leSouffleSeRelache(geste, vueRef.current)) nicheRelacheSonSouffle()
        showToast({ kind: 'error', message: motifDe(e) })
        if (refusDuServeur(e)) onRelire()
      } finally {
        enVol.current = false
        setBusy(false)
      }
    },
    [ranger, onRelire],
  )

  // Chaque écran de la partie commence en haut, rend son focus, et refuse un toucher dans la demi-seconde (`gesteAccepte`) : il
  // était destiné à l'écran d'avant — « Manche suivante » qui prend la place d'une réponse sous le doigt.
  const changement = useRef<number | null>(null)
  const premiere = useRef(true)
  const cleDEcran = `${vue.phase}:${vue.manche}:${etapeDe(vue)}:${miser ?? ''}:${bilanOuvert}`
  // Ce qui change sous le doigt sans changer d'écran — une vue neuve, l'affirmation suivante de l'Éclair — relance la garde, sans
  // défiler : les mêmes « Faux » et « Vrai » restent sous le pouce, et le second toucher d'un double répondait à une affirmation pas lue.
  const sousLeDoigt = sousLeDoigtDe(vue, pret, valeur)
  useEffect(() => {
    changement.current = performance.now()
  }, [cleDEcran, sousLeDoigt])
  // L'écran seul, pour ce qui ne bouge pas avec une vue neuve de la même manche — les lettres du Mot (`gardeDeLEcran`).
  const changementDEcran = useRef<number | null>(null)
  useEffect(() => {
    changementDEcran.current = performance.now()
  }, [cleDEcran])
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    window.scrollTo(0, 0)
    rendreLeFocus(document.querySelector('.cab-page'), ['.cab-question', 'h2', 'h1'])
  }, [cleDEcran])
  const garde = useCallback(() => gesteAccepte(changement.current, performance.now()), [])
  const gardeDeLEcran = useCallback(() => gesteAccepte(changementDEcran.current, performance.now()), [])

  const agir = (geste: GesteDuCabinet) => {
    if (garde()) void jouer(geste)
  }

  // À l'échéance, la page envoie ce qu'elle tient — sous la confirmation ouverte aussi : la pause passée, le chrono a repris sous
  // le voile (`aEnvoyerALEcheance`). Une vue neuve (un geste, une pause, une reprise) annule l'envoi prévu et en prévoit un autre.
  useEffect(() => {
    const envoi = aEnvoyerALEcheance(vue, serverNow(), pret)
    if (!envoi) return
    const rang = vue.rang
    return insister(
      async () => {
        // Une vue neuve est arrivée entre-temps (l'autre onglet, la pause) : elle a prévu son envoi, celui-ci n'a plus rien à dire.
        if (vueRef.current.rang === rang) await jouer(envoi.geste(localRef.current), true)
      },
      { premier: envoi.dans },
    )
  }, [vue, pret, jouer])

  // La pause finie (ses secondes, `PAUSE_MAX_MS`), le chrono reprend sous le voile : la tête se redessine à cet instant.
  useEffect(() => {
    const reste = vue.phase === 'pause' ? vue.chrono?.pauseResteMs : undefined
    if (reste === undefined) return
    const dans = vue.maintenant + reste - serverNow()
    if (dans <= 0) return
    const id = setTimeout(() => setTic(n => n + 1), dans + 20)
    return () => clearTimeout(id)
  }, [vue])

  /**
   * « Quitter ? » (§ 2.6, 2.7) : la pause d'abord, si un chrono court — la
   * manche se voile, le chrono se fige le temps de la pause au plus (`PAUSE_MAX_MS`) —, puis la
   * confirmation. Refusée (`PLUS_DE_PAUSE`), la pause ne fige rien, et la
   * confirmation s'ouvre quand même : quitter reste possible. « Continuer »
   * reprend ; « Quitter la partie » la compte avec ses étoiles.
   */
  const demanderAQuitter = useCallback(async (): Promise<IssueDuRetour> => {
    if (enQuestion.current) return 'reste'
    enQuestion.current = true
    setQuestion(true)
    try {
      const v = vueRef.current
      let pauseMs: number | undefined
      let refus: string | undefined
      if (v.phase === 'jouer' && v.chrono && !enVol.current) {
        enVol.current = true
        setBusy(true)
        try {
          const r = await api.cabinet.geste(v.id, v.rang, { quoi: 'pause', manche: v.manche })
          ranger(r.partie)
          pauseMs = r.partie.phase === 'pause' ? r.partie.chrono?.pauseResteMs : undefined
        } catch (e) {
          refus = motifDe(e)
        } finally {
          enVol.current = false
          setBusy(false)
        }
      }
      const { titre, message } = messageDuQuitter(vueRef.current, { pauseMs, refus })
      // « Quitter la partie » : la tête porte déjà un « Quitter », et Camille ne savait lequel toucher (la tablée du 25 octobre 2026).
      // Prudente : « Continuer », le geste qu'on attend, est le bouton plein ; celui qui perd la partie, un contour rouge — sous une
      // pause de dix secondes, Ophélie touchait le plein (la tablée du 26).
      const oui = await confirmDialog({ title: titre, message, confirmLabel: 'Quitter la partie', cancelLabel: 'Continuer', prudent: true })
      // Fermée par la partie qui se démonte : rien ne part d'un écran qui n'est plus là. La partie attend au musée, en pause —
      // « Reprendre » la rouvre sous son voile, qui a son « Continuer » —, et le chrono n'attend pas plus que la pause (`PAUSE_MAX_MS`).
      if (!monte.current) return 'parti'
      const apres = vueRef.current
      if (oui && apres.phase !== 'finie') await jouer({ quoi: 'quitter' })
      else if (!oui && apres.phase === 'pause') await jouer({ quoi: 'reprendre', manche: apres.manche })
      return vueRef.current.phase === 'finie' ? 'parti' : 'reste'
    } finally {
      enQuestion.current = false
      setQuestion(false)
    }
  }, [ranger, jouer])

  // Une pause sans question : « Continuer » sous le voile la reprend.
  const reprendre = () => {
    if (garde()) void jouer({ quoi: 'reprendre', manche: vueRef.current.manche })
  }

  // Pendant une manche, le retour du navigateur demande lui aussi « Quitter ? » : un pouce qui glisse du bord coûtait la manche.
  // Sa garde se pose par-dessus l'entrée de la partie (`poserLEntreeDeLaPartie`), qu'elle recopie : le retour qui la consomme laisse
  // la partie ouverte.
  useGardeRetour(vue.phase === 'jouer' || vue.phase === 'pause', demanderAQuitter)

  const suivante = () => {
    if (!garde()) return
    if (vue.phase === 'finie') return setBilanOuvert(true)
    const k = (vue.manche + 1) as Manche
    if (vue.carte?.pouvoir === 'miser' && vue.pouvoir?.jouable) return setMiser(k)
    void jouer({ quoi: 'ouvrir', manche: k })
  }

  const decider = async (oui: boolean) => {
    if (!garde()) return
    const k = vue.phase === 'avant' ? 0 : (miser ?? ((vue.manche + 1) as Manche))
    await jouer({ quoi: 'ouvrir', manche: k, ...(oui && { miser: true as const }) })
    if (vueRef.current.phase !== 'avant' && vueRef.current.phase !== 'revele') setMiser(null)
  }

  const signaler = async (position: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(vue.id, position, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  // Le bilan : la dernière manche révélée d'abord (« Voir le bilan ») ; quittée ou close, tout de suite.
  const montrerLeBilan = vue.phase === 'finie' && (bilanOuvert || !vue.revelation || !!vue.bilan?.quittee || !!vue.bilan?.lendemain)
  // Le titre de l'onglet suit la manche, puis le bilan (`titreDeLaPartie`) : d'un onglet à l'autre, le lecteur d'écran ne disait
  // que « Le Cabinet de curiosités ». La page reprend le sien en revenant au musée (`CabinetApp.tsx`).
  useEffect(() => {
    document.title = titreDeLaPartie(vue, montrerLeBilan)
    // Le jeu et la manche seuls : une vue neuve de la même manche — un essai, une pause — ne change pas le titre.
  }, [vue.jeu, vue.manche, montrerLeBilan])
  if (montrerLeBilan) {
    if (bilan === 'perdu' || !bilan) {
      return (
        <div className="player-shell cab-page" aria-busy={!bilan || undefined}>
          <p className="cab-ligne">{bilan ? espacesFines('Le bilan ne s’est pas chargé, mais ta partie est bien comptée : ton musée l’a gardée.') : 'Chargement…'}</p>
          <button type="button" className="btn btn-primary btn-big btn-block" {...toucher(onMusee)}>
            Revenir au musée
          </button>
        </div>
      )
    }
    const LeBilan: typeof BilanDeLaPartie = bilan.BilanDeLaPartie
    return <LeBilan vue={vue} ecran={pret} onMusee={onMusee} onRejouer={onRejouer} onRetenter={onRetenter} />
  }
  return (
    <EcranDeLaPartie
      vue={vue}
      ecran={ecran}
      local={valeur}
      setLocal={setLocal}
      chrono={chronoMontre(vue, serverNow())}
      busy={busy}
      miser={miser}
      cadreDejaDore={cadreDejaDore}
      garde={garde}
      gardeDeLEcran={gardeDeLEcran}
      onGeste={agir}
      onQuitter={() => void demanderAQuitter()}
      onReprendre={vue.phase === 'pause' && !question ? reprendre : undefined}
      onSuivante={suivante}
      onMiser={oui => void decider(oui)}
      onSignaler={position => void signaler(position)}
      onMusee={onMusee}
    />
  )
}

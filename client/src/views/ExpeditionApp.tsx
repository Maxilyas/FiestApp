import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError, api, motifDe } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { Shape } from '../components/Shape'
import { Feuille, GesteDuBas, PieceTete, Sortie } from '../components/Pieces'
import { Vies } from '../components/Vies'
import { Balise } from '../components/Balise'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { CompagnonRejoint, LegendaireOuvert } from '../components/Ouverts'
import { SerieCorrigee } from '../components/SerieCorrigee'
import { FriseRangee } from '../components/FriseRangee'
import { DetailQuiSElargit, useCadrage } from '../components/TableauDuDetail'
import { TableauEntier } from '../components/TableauEntier'
import { APorter, CeQueTuGagnes, MissionsAccomplies, NouveauxTrophees, emojisAPorter, retenirLeNiveau, useNiveauRelu } from '../components/Gains'
import { GerbeDeJuste } from '../components/Gerbe'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { espacesFines, formatNumber } from '../format'
import { showToast } from '../state'
import { porterTheme } from '../themeJoueur'
import { porterGerbe } from '../gerbe'
import { nicheRetientSonSouffle, porterNiche } from '../niche'
import { NicheALaRevelation } from '../components/NicheReagit'
import { rareEnCampagne, reactionDuSolo } from '../../../shared/niche'
import { GEMME_MAUDITE, gemme } from '../gemmes'
import { useModale } from '../modale'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { iconeDuSujet } from '../iconeDuSujet'
import { aPorterDesTrophees, partsDeLXp, tropheesTombes, xpDesTrophees } from '../../../shared/gains'
import { NOM_NIVEAU, SIGNALEMENT_MAX, VIES, type CorrectionDeCampagne, type Niveau } from '../../../shared/campagne'
import { couleurDePiste } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { compositionDite } from '../../../shared/lettres'
import { NOM_DE_LA_CURIOSITE, ceQueRapporteUneCuriosite, emojisDe } from '../../../shared/curiosites'
import { anneeDite } from '../../../shared/frise'
import { saison as laSaison, type Saison } from '../../../shared/saisons'
import type { RareteDeTheme } from '../../../shared/themes'
import { hautFait } from '../../../shared/hautsfaits'
import { CATEGORIES } from '../../../shared/categories'
import { enumerer } from '../../../shared/classement'
import {
  JOKERS_DES_LEGENDAIRES,
  JOKERS_SANS_LEGENDAIRE,
  PAQUET_DE_DEPART,
  PLACES_DE_L_EQUIPEE,
  joker as jokerDeCle,
  jokerDuLegendaire,
  talisman as talismanDeCle,
  type Joker,
  type SorteDeJoker,
} from '../../../shared/jokers'
import type { PalierTombe } from '../../../shared/jour'
import type { CleDeCompagnon } from '../../../shared/compagnons'
import {
  ACTES,
  CADRAGES_DU_DETAIL,
  ECUS_D_UN_COFFRE_LAISSE,
  ECUS_D_UN_GARDIEN,
  ETAGES,
  GARDIEN,
  MARCHES_DES_ACTES,
  adresseDuCadrage,
  auGardien,
  chanceDeVaincre,
  chanceDuJoueurMoyen,
  chancesDuTrace,
  duGardien,
  escalesAtteignables,
  gardienAuFeminin,
  leGardien,
  marcheDe,
  nomDuGardien,
  paquetDeDepart,
  passeportParFamille,
  prixDeLArticle,
  prixDeLEscale,
  refusDeLAchat,
  traceLePlusSur,
  vueApresLaCarte,
  type ApresUnGeste,
  type ArticleDeLEchoppe,
  type CarteDUnActe,
  type ContenuDeLInconnu,
  type EscaleDeLaCarte,
  type JokersEnJeu,
  type PageDeLExpedition,
  type QuestionAComposer,
  type FriseAPoser,
  type QuestionDExpedition,
  type ReponseDExpedition,
  type SensDeLOracle,
  type ThemeDEscale,
  type VueDeLExpedition,
} from '../../../shared/expedition'
import { cranOuvertParLaVictoire, cransDeLAdversaire, exploitDe, niveauDuStyle, pointsDeLAdversaire, soinALAscension, type DosDuPaquet } from '../../../shared/codex'
import {
  CARTES_DES_ACTES,
  CARTES_DES_RENCONTRES,
  COURAGE_A_L_ECHOPPE,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UN_PIEGE,
  COURAGE_D_UNE_SOURCE,
  effetDeLaFiole,
  soinALaVersion,
  COURAGE_MAX,
  FAMILLES_DE_CARTES,
  FIOLES_MAX,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_CURIOSITES,
  VERSION_DES_FAMILLES,
  VERSION_DU_DETAIL,
  VERSION_DES_HUIT_FAMILLES,
  VERSION_DU_CODEX,
  VERSION_DU_JEU_COMPLET,
  carteALaVersion,
  carteDeRencontre,
  carteDuLegendaire,
  estDeRoute,
  fioleDe,
  paquetDesRencontres,
  parmi,
  refusDeLAmelioration,
  stylesDeLaVersion,
  type CarteDeRencontre,
  type CleDeFiole,
  type SorteDeRencontre,
  type StyleDeJeu,
} from '../../../shared/rencontres'
import {
  Adversaire,
  adversaireALaRevelation,
  Apercu,
  AvantApres,
  BoireUneFiole,
  BoutonDesRegles,
  COURT,
  CarteLevee,
  CartesAPrendre,
  ChoixDeLAscension,
  ChoixDuDos,
  ChoixDuStyle,
  Courage,
  FeticheDuDepart,
  FeuilleDesCartes,
  FeuilleDesRegles,
  FeuilleDuCodex,
  GuideDesRencontres,
  LigneDeCarte,
  RangeeDeCartes,
  MainDeRencontre,
  NiveauDExplorateur,
  RenommeeGagnee,
  PreparationDeLaRencontre,
  SesFioles,
  ToutesLesCartes,
  VerreDeFiole,
  VersionDesCartes,
  VisageDeLaCarte,
  ascensionRetenue,
  ceQueLaCarteAFait,
  changementDeLaCarte,
  comptesDesCartes,
  dosDuPaquet,
  dosRetenu,
  exploitsNeufs,
  feticheRetenue,
  gemmeDeLaCarte,
  mainDeLActe,
  origineDeLaCarte,
  pourcents,
  prechargerLesPeintures,
  recompenseDe,
  retenirLAscension,
  retenirLaFetiche,
  retenirLeDos,
  retenirLeStyle,
  styleRetenu,
  verdictDeLaRencontre,
} from './RencontresDExpedition'

// L'Expédition (`/expedition`, le brief : `retours/2026-10-17/expedition.md`,
// les maquettes validées par le propriétaire le 17 octobre 2026) : trois
// actes, chacun une carte tirée au sort, un gardien au bout de chacun, et
// l'un des trois à garder au bout du troisième. Le serveur tire, juge et
// replie (`shared/expedition.ts`) ; la page dessine la carte, et calcule
// dans le téléphone, sur les chances que le serveur a déjà montrées, la plus
// sûre des escales qu'elle propose.
//
// Les écrans suivent les maquettes : le départ et ses trois gardiens (1),
// l'équipée (2, en feuille, comme le choix des catégories : rien ne change
// avant « Choisir »), la carte d'un acte (3, revue deux fois le 18 octobre
// 2026 : seule l'escale où l'on est s'y éclaire, puis l'acte en petit en haut
// et les escales proposées en cartes en bas), une escale et la main (4), le
// gardien (7), le gardien vaincu (8), le choix du légendaire (9), un joker
// pour son paquet (12), le dévoilement (11), un talisman (6) ;
// puis l'écran des gains de tous les modes (`Gains.tsx`). Le campement, que
// les maquettes n'avaient pas, suit l'offre ; l'échoppe et l'inconnu (l'étape
// 4), aussi.
//
// Un joker se joue en deux touchers : sa carte se lève, et dit ce qu'il fait
// — ou pourquoi il ne se joue pas maintenant (`refusDuJoker`, calculé par le
// serveur) —, puis son bouton le joue. Joué, il ne se reprend pas : un
// toucher perdu sur la main ne doit rien coûter.

/** Ce que la fin fait tomber — et le compagnon qu'elle amène : la luciole, à la Première traversée. */
type Fin = { recompenses?: PalierTombe[]; legendaires?: string[]; compagnon?: CleDeCompagnon }

/**
 * Ce que le départ choisit, aux rencontres : son style, sa catégorie fétiche, le dos de son paquet, son cran de l'Ascension — et
 * `questionAuCentre`, la version 10, là où la page la dit ouverte.
 */
type ChoixDuDepart = { style: StyleDeJeu | null; fetiche: string | null; dos: DosDuPaquet | null; ascension: number; questionAuCentre?: boolean }

type Ecran =
  | { e: 'chargement' }
  | { e: 'anonyme' }
  /** En production, le drapeau la refermant : ses routes répondent 404 (`expeditionOuverte`). */
  | { e: 'bientot'; motif: string }
  | { e: 'erreur'; motif: string }
  /** Le départ : la prochaine expédition, ou celle qui l'attend (`vue`). */
  | { e: 'depart'; page: PageDeLExpedition }
  /**
   * En route : la carte, une escale ou le gardien, une offre, le campement,
   * le choix au bout — l'écran se lit de la vue. Une question répondue garde
   * sa révélation (`reponse`) jusqu'à « Suite » : la vue, elle, est déjà
   * celle d'après, et `avant` celle de la question — ses vies, son joker, ses
   * posés : ce que la réponse a coûté se lit de l'écart. À composer (v11),
   * ce qu'il a composé (`composee`) : la révélation le redit ; une frise
   * (v13), l'ordre qu'il a donné (`ordre`, par le rang de ses cartes à
   * l'écran).
   */
  | {
      e: 'route'
      vue: VueDeLExpedition
      question?: QuestionDExpedition
      reponse?: ReponseDExpedition
      choix?: number
      composee?: string
      ordre?: number[]
      avant?: VueDeLExpedition
    }
  | { e: 'vaincu'; vue: VueDeLExpedition; gardien: string }
  /** L'inconnu vient de se dévoiler — un piège, un légendaire de passage — ; `tombe` : le piège a pris sa dernière vie. */
  | { e: 'inconnu'; vue: VueDeLExpedition; tombe?: Fin }
  | { e: 'fin'; vue: VueDeLExpedition; tombe: Fin; correction: CorrectionDeCampagne[] | null }

/**
 * L'écran qu'ouvre la page lue : à l'arrivée, l'expédition en route reprend
 * où elle en est ; en partant (« ← Partir »), le départ la garde, avec
 * « Reprendre ». Partir la montrait comme à l'arrivée : elle se rouvrait sur
 * l'écran même qu'on quittait, et l'on n'en sortait que par le navigateur (le
 * retour du propriétaire du 18 octobre 2026, « Je ne peux pas partir de
 * l'expédition »).
 */
export function ecranDeLaPage(page: PageDeLExpedition, enPartant = false): Extract<Ecran, { e: 'route' | 'depart' }> {
  return page.expedition && !enPartant ? { e: 'route', vue: page.expedition } : { e: 'depart', page }
}

/** La marche d'une question, accordée à elle : « facile », « moyenne », « difficile ». */
const MARCHE: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }

/** Ce qu'une escale pose : « Histoire », « Histoire et Sport », « Histoire, Sport et Cinéma », « Les années 80 ». */
function nomDuTheme(theme: ThemeDEscale | undefined): string {
  if (!theme) return ''
  if ('sujet' in theme) return sujetParCle(theme.sujet)?.nom ?? 'Un thème pointu'
  return enumerer(theme.categories)
}

/** Le nom court d'un thème sous une escale : « Histoire », « Mélange », « Les années 80 » — un mélange montre ses catégories en emblèmes, et sa ligne les nomme. */
function nomCourtDuTheme(t: ThemeDEscale | undefined): string {
  if (!t) return 'Question'
  if ('sujet' in t) return sujetParCle(t.sujet)?.nom ?? 'Thème pointu'
  return t.categories.length > 1 ? 'Mélange' : (COURT[t.categories[0]] ?? t.categories[0])
}

/** Les catégories d'un mélange — aucune pour une catégorie seule, un thème pointu ou une escale sans question. */
const categoriesDuMelange = (e: EscaleDeLaCarte): readonly string[] => (e.theme && !('sujet' in e.theme) && e.theme.categories.length > 1 ? e.theme.categories : [])

/** Ce que cache l'inconnu, en un mot sous l'escale. */
const CONTENU: Record<ContenuDeLInconnu, string> = { marchand: 'Marchand', piege: 'Piège', passage: 'De passage' }

/**
 * Ce que rapporte une curiosité (v12), aux règles de son codex : celles que
 * le pli tire — une carte rare, et la fiole et le talisman à leur niveau.
 */
const recompenseDeLaCuriosite = (vue: Pick<VueDeLExpedition, 'cartes'>) => {
  const codex = vue.cartes?.codex
  return ceQueRapporteUneCuriosite(!codex || codex.regles.includes('fioles'), !codex || codex.regles.includes('talismans'))
}

/** Ce qu'on lit sous l'escale, sur la carte. */
function etiquette(e: EscaleDeLaCarte, acte: number, gardiens: readonly { cle: string }[]): string {
  if (e.sorte === 'curiosite') return 'Curiosité'
  if (e.sorte === 'source') return 'Source'
  if (e.sorte === 'campement') return 'Campement'
  if (e.sorte === 'coffre') return 'Coffre'
  if (e.sorte === 'echoppe') return 'Échoppe'
  if (e.sorte === 'inconnu') return e.contenu ? CONTENU[e.contenu] : 'Inconnu'
  if (e.sorte === 'gardien') return nomDuGardien(gardiens[acte]?.cle ?? '')
  if (e.sorte === 'elite') return `Élite · ${nomCourtDuTheme(e.theme)}`
  return nomCourtDuTheme(e.theme)
}

/**
 * L'emblème d'une escale : sa catégorie, son sujet, le mélange ; la goutte
 * d'une source, le feu d'un campement, les épées d'une élite, l'étal d'une
 * échoppe ; l'inconnu, un point d'interrogation — dévoilé, ce qu'il cache.
 */
function iconeDe(e: EscaleDeLaCarte): IconName {
  // Une curiosité (v12) : le couvert du plat, l'image du rébus.
  if (e.sorte === 'curiosite') return e.curiosite === 'rebus' ? 'image' : 'utensils'
  if (e.sorte === 'source') return 'source'
  if (e.sorte === 'campement') return 'campement'
  if (e.sorte === 'coffre') return 'coffre'
  if (e.sorte === 'echoppe') return 'echoppe'
  if (e.sorte === 'inconnu') return e.contenu === 'marchand' ? 'echoppe' : e.contenu === 'piege' ? 'alert' : e.contenu === 'passage' ? 'sparkles' : 'help'
  if (e.sorte === 'elite') return 'swords'
  const t = e.theme
  if (!t) return 'help'
  if ('sujet' in t) {
    const s = sujetParCle(t.sujet)
    return s ? iconeDuSujet(s) : 'star'
  }
  return t.categories.length > 1 ? 'shuffle' : (EMBLEME[t.categories[0]] ?? 'help')
}

/**
 * Ce qu'une escale cache, en une phrase : ce qu'on lit en la touchant, et au
 * lecteur d'écran. Sous L'écholocation, la carte ne dit plus sa chance : la
 * phrase non plus. `court` : sans sa chance ni ses écus — la ligne sous les
 * cartes, où sa carte les montre déjà.
 */
function decrire(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'acte' | 'gardiens' | 'moyen' | 'vies' | 'jokers' | 'ecus' | 'cartes'>, carte: CarteDUnActe, court = false): string {
  if (vue.cartes) return decrireEnRencontres(e, vue, carte, court)
  const qui = vue.moyen ? 'pour un joueur moyen' : 'pour toi'
  // Ce qu'elle paie, trouvée (l'étape 4) : sa chance dite, la carte peut le dire — sous L'écholocation, ni l'une ni l'autre.
  const prix = vue.ecus !== undefined && e.chance !== undefined && (e.sorte === 'question' || e.sorte === 'elite') ? ` · ${prixDeLEscale(e)} écus` : ''
  const chance = e.chance === undefined || court ? '' : ` · ${pourcents(e.chance)} ${qui}${prix}`
  if (e.sorte === 'source') return `Une source : une question de ton carnet. Retrouvée, elle te rend une vie ; ratée, elle ne coûte rien${chance}`
  if (e.sorte === 'campement') return vue.jokers ? 'Un campement : une vie, jusqu’à trois — ou un joker retiré de ton paquet' : 'Un campement : il te rend une vie, jusqu’à trois'
  if (e.sorte === 'coffre') {
    return vue.ecus !== undefined
      ? `Un coffre : un joker au choix parmi trois, pour ton paquet — ou ${ECUS_D_UN_COFFRE_LAISSE} écus, si tu n’en prends aucun`
      : 'Un coffre : un joker au choix parmi trois, pour ton paquet'
  }
  if (e.sorte === 'echoppe') return 'Une échoppe : une vie, des jokers, un talisman, contre tes écus'
  if (e.sorte === 'inconnu') {
    if (e.contenu === 'marchand') return 'Un marchand : une échoppe, contre tes écus'
    if (e.contenu === 'piege') return 'Un piège : il te coûte une vie'
    if (e.contenu === 'passage') return 'Un légendaire de passage : son joker dans ta main, jusqu’au bout de l’acte'
    return 'L’inconnu : un marchand, un piège qui coûte une vie, ou un légendaire de passage'
  }
  if (e.sorte === 'gardien') {
    const g = vue.gardiens[vue.acte]?.cle ?? ''
    const m = MARCHES_DES_ACTES[Math.min(vue.acte, ACTES - 1)]
    const regle = `${nomDuGardien(g)}, gardien de l’acte : ${m.aTrouver} bonnes réponses à trouver, en questions ${MARCHE[m.gardien]}s`
    if (court || (vue.jokers && carte.chanceDuGardien === undefined)) return regle
    const p = carte.chanceDuGardien ?? chanceDuJoueurMoyen(m.gardien)
    return `${regle} · ${pourcents(chanceDeVaincre(p, m.aTrouver, vue.vies))} de le vaincre avec ${vue.vies} vie${vue.vies > 1 ? 's' : ''}`
  }
  const t = e.theme
  const quoi = !t ? 'Une question' : 'sujet' in t ? `Thème pointu : ${nomDuTheme(t)}` : t.categories.length > 1 ? `Mélange : ${nomDuTheme(t)}` : nomDuTheme(t)
  const tampon = e.aTamponner ? ' · un tampon neuf pour ton passeport' : ''
  if (e.sorte === 'elite') return `Une élite, ${quoi.charAt(0).toLowerCase()}${quoi.slice(1)} · ${MARCHE[marcheDe(vue.acte, e)]}. Trouvée, un joker au choix ; ratée, une vie${chance}${tampon}`
  return `${quoi} · ${MARCHE[marcheDe(vue.acte, e)]}${chance}${tampon}`
}

/**
 * Ce qu'un adversaire demande, à la version de son départ : des points à lui
 * faire perdre — dans la question au centre (v10), des bonnes réponses, ses
 * crans. Le plan, son panneau et le campement le disent des mêmes mots.
 */
function aFaireTomber(vue: Pick<VueDeLExpedition, 'cartes'>, sorte: SorteDeRencontre, acte: number, cran: number): string {
  if ((vue.cartes?.v ?? 0) < VERSION_DE_LA_QUESTION_AU_CENTRE) return `${pointsDeLAdversaire(sorte, acte, cran)} points à lui faire perdre`
  const n = cransDeLAdversaire(sorte, acte, cran)
  return `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''} pour en venir à bout`
}

/**
 * Ce qu'une escale cache, aux rencontres : une escale à question
 * est un adversaire — les points à lui faire perdre, sa chance par question —, le courage
 * remplace les vies, une carte les jokers.
 */
function decrireEnRencontres(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'acte' | 'gardiens' | 'moyen' | 'ecus' | 'cartes'>, carte: CarteDUnActe, court = false): string {
  const qui = vue.moyen ? 'pour un joueur moyen' : 'pour toi'
  const prix = e.chance !== undefined && (e.sorte === 'question' || e.sorte === 'elite') ? ` · ${prixDeLEscale(e)} écus à la victoire` : ''
  const chance = e.chance === undefined || court ? '' : ` · ${pourcents(e.chance)} par question ${qui}${prix}`
  // Son cran de l'Ascension : les points des adversaires et ce que rend un repos s'y lisent, comme le pli les compte.
  const cran = vue.cartes?.ascension ?? 0
  if (e.sorte === 'curiosite') {
    const quoi = e.curiosite === 'rebus' ? 'un rébus en emojis, à composer' : 'un plat dont tu devines d’où il vient'
    return `Une curiosité : ${quoi}, sans adversaire. Trouvée, ${recompenseDeLaCuriosite(vue)} au choix ; ratée, elle ne coûte rien`
  }
  if (e.sorte === 'source') return `Une source : une question de ton carnet. Retrouvée, elle te rend ${soinALAscension(COURAGE_D_UNE_SOURCE, vue.cartes?.v ?? 0, cran)} de courage ; ratée, elle ne coûte rien${chance}`
  if (e.sorte === 'campement') {
    const repos = `Un campement : ${soinALAscension(COURAGE_D_UN_CAMPEMENT, vue.cartes?.v ?? 0, cran)} de courage`
    return (vue.cartes?.v ?? 0) >= VERSION_DU_JEU_COMPLET ? `${repos}, une carte retirée de ton paquet ou une carte améliorée` : `${repos} — ou une carte retirée de ton paquet`
  }
  if (e.sorte === 'coffre') return `Un coffre : une carte au choix parmi trois, pour ton paquet — ou ${ECUS_D_UN_COFFRE_LAISSE} écus, si tu n’en prends aucune`
  if (e.sorte === 'echoppe') return 'Une échoppe : du courage, des cartes, un talisman, contre tes écus'
  if (e.sorte === 'inconnu') {
    if (e.contenu === 'marchand') return 'Un marchand : une échoppe, contre tes écus'
    if (e.contenu === 'piege') return `Un piège : il te coûte ${COURAGE_D_UN_PIEGE} de courage`
    if (e.contenu === 'passage') return 'Un légendaire de passage : sa carte dans ton paquet, jusqu’au bout de l’acte'
    return `L’inconnu : un marchand, un piège qui coûte ${COURAGE_D_UN_PIEGE} de courage, ou un légendaire de passage`
  }
  const acte = Math.min(vue.acte, ACTES - 1)
  if (e.sorte === 'gardien') {
    const g = vue.gardiens[vue.acte]?.cle ?? ''
    const m = MARCHES_DES_ACTES[acte]
    const p = carte.chanceDuGardien
    return `${nomDuGardien(g)}, gardien de l’acte : ${aFaireTomber(vue, 'gardien', acte, cran)}, en questions ${MARCHE[m.gardien]}s${p === undefined || court ? '' : ` · ${pourcents(p)} par question ${qui}`}`
  }
  const t = e.theme
  const quoi = !t ? 'Une question' : 'sujet' in t ? `Thème pointu : ${nomDuTheme(t)}` : t.categories.length > 1 ? `Mélange : ${nomDuTheme(t)}` : nomDuTheme(t)
  const tampon = e.aTamponner ? ' · un tampon neuf pour ton passeport' : ''
  if (e.sorte === 'elite')
    return `Une élite, ${quoi.charAt(0).toLowerCase()}${quoi.slice(1)} · ${MARCHE[marcheDe(vue.acte, e)]} : ${aFaireTomber(vue, 'elite', acte, cran)}. Tombée, une carte au choix, plus souvent rare${chance}${tampon}`
  return `${quoi} · ${MARCHE[marcheDe(vue.acte, e)]} : un adversaire, ${aFaireTomber(vue, 'question', acte, cran)}${chance}${tampon}`
}

// ── Les jokers ──────────────────────────────────────────────────────────────

/** Ce qu'est un joker, en une ligne : quand il se joue. */
const SORTE: Record<SorteDeJoker, string> = {
  jouer: 'À jouer sur une question, puis défaussé',
  poser: 'À poser : il agit jusqu’au bout de l’acte',
  carte: 'Sur le plan, entre deux escales',
}
const SORTE_COURTE: Record<SorteDeJoker, string> = { jouer: 'à jouer', poser: 'à poser', carte: 'sur le plan' }
const RARETE: Record<Joker['rarete'], string> = { commun: 'commun', rare: 'rare', maudit: 'maudit', legendaire: 'légendaire' }

/**
 * La couleur d'un joker, au cadre de sa carte : la gemme de sa rareté, celle
 * de l'album et de la boutique (`gemmes.ts`) — argent, bleu, or —, et le
 * rouge sombre des maudites pour un maudit, plus fort mais qui coûte : le
 * pourpre est à l'épique, que les cartes des rencontres ont depuis le jeu
 * complet. Une seule couleur par rareté dans toute l'application.
 */
const GEMME_DU_JOKER: Record<Exclude<Joker['rarete'], 'maudit'>, RareteDeTheme> = { commun: 'commune', rare: 'rare', legendaire: 'legendaire' }
const gemmeDuJoker = (j: Joker) => (j.rarete === 'maudit' ? GEMME_MAUDITE : gemme(GEMME_DU_JOKER[j.rarete]))

/** Le dessin d'un joker sans légendaire ; celui d'un légendaire est son médaillon. */
const ICONE_DU_JOKER: Readonly<Record<string, IconName>> = {
  'coup-d-oeil': 'eye',
  echange: 'rotate',
  pioche: 'plus-square',
  detour: 'arrow-up',
  'arret-sur-image': 'pause',
  'double-chance': 'copy',
  sursis: 'shield',
  'tout-ou-rien': 'dice',
  'quitte-ou-double': 'zap',
}

/** Le dessin d'un talisman. */
const ICONE_DU_TALISMAN: Readonly<Record<string, IconName>> = { loupe: 'search', 'maillot-jaune': 'maillot', boussole: 'boussole' }

/** Ses écus, à côté de ses vies (l'étape 4) : une pièce et un nombre. */
function Ecus({ n }: { n: number }) {
  return (
    <span className="exp-ecus" role="img" aria-label={`${n} écu${n > 1 ? 's' : ''}`}>
      <Icon name="ecu" />
      <b>{formatNumber(n)}</b>
    </span>
  )
}

/**
 * La barre du haut : « ← Partir », le « ? » des règles — « il faudrait juste
 * un onglet règles qu'on peut consulter de n'importe quelle page » (la revue
 * du 18 octobre 2026) : les pages ne disent plus leurs règles en
 * paragraphes —, ce qui agit sur lui en petit — ses jokers posés, en
 * rencontre les cartes posées pour toute la rencontre, le cadre de leur
 * rareté, et ses talismans —, ses écus — d'une expédition qui en a — et ses
 * vies. Une carte posée se touche et se lève : « un icône en haut pour
 * montrer qu'on l'a tout le long (comme un talisman visible), parce que des
 * trucs écrits partout c'est trop d'infos » — elle se disait en toutes
 * lettres sous la main. Ici, pas sous la carte : une ligne de plus y montait
 * le panneau jusqu'à la moitié de l'écran.
 */
export function Barre({
  vue,
  onPartir,
  sansSortie,
}: {
  vue: Pick<VueDeLExpedition, 'ecus' | 'vies' | 'talismans' | 'jokers' | 'courage' | 'rencontre' | 'cartes' | 'carte' | 'fioles'> & Partial<Pick<VueDeLExpedition, 'acte'>>
  onPartir: () => void
  sansSortie?: boolean
}) {
  const [regles, setRegles] = useState(false)
  const [regardee, setRegardee] = useState<string | null>(null)
  const talismans = vue.talismans ?? []
  const poses = (vue.jokers?.poses ?? []).map(cle => jokerDeCle(cle)).filter((j): j is Joker => !!j)
  const posees = (vue.rencontre?.pouvoirs ?? []).map(cle => carteDeRencontre(cle)).filter((c): c is CarteDeRencontre => !!c)
  const dits = [
    poses.length > 0 && `Posés : ${poses.map(j => j.nom).join(', ')}`,
    talismans.length > 0 && `Tes talismans : ${talismans.map(cle => talismanDeCle(cle)?.nom ?? cle).join(', ')}`,
  ].filter(Boolean)
  const fioles = (vue.fioles?.tenues.length ?? 0) > 0
  return (
    <div className="exp-barre">
      {!sansSortie && <Sortie vers="Partir" href="/expedition" onClick={onPartir} />}
      <BoutonDesRegles onOuvrir={() => setRegles(true)} />
      {vue.ecus !== undefined && <Ecus n={vue.ecus} />}
      {/* En rencontres, le courage remplace les trois vies. */}
      {vue.courage !== undefined ? <Courage n={vue.courage} /> : <Vies restantes={vue.vies} />}
      {/* Ce qu'il porte, après les écus et le courage : d'un bloc, il passe à la ligne quand il ne tient plus, et rien d'autre ne bouge. */}
      {(posees.length > 0 || dits.length > 0 || fioles) && (
        <span className="exp-sac">
          {posees.length > 0 && (
            <span className="exp-posees" role="group" aria-label="Posées pour toute la rencontre">
              {posees.map(c => (
                <button key={c.cle} type="button" className="exp-pose" style={gemmeDeLaCarte(c)} data-carte={c.cle} aria-haspopup="dialog" aria-label={c.nom} onClick={() => setRegardee(c.cle)}>
                  <VisageDeLaCarte c={c} />
                </button>
              ))}
            </span>
          )}
          {dits.length > 0 && (
            <span className="exp-talismans" role="img" aria-label={dits.join(' ; ')}>
              {poses.map(j => (
                <span key={j.cle} className="exp-pose" style={gemmeDuJoker(j)}>
                  <VisageDuJoker j={j} />
                </span>
              ))}
              {talismans.map(cle => (
                <Icon key={cle} name={ICONE_DU_TALISMAN[cle] ?? 'sparkles'} />
              ))}
            </span>
          )}
          {/* Ses fioles (le codex), à boire d'ici, sur chaque écran. */}
          {fioles && vue.fioles && <SesFioles fioles={vue.fioles} />}
        </span>
      )}
      {regles && (
        <FeuilleDesRegles
          rencontres={vue.courage !== undefined}
          parQuestion={vue.cartes?.parQuestion}
          codex={vue.cartes?.codex}
          ascension={vue.cartes?.ascension}
          energie={vue.cartes?.energie}
          v={vue.cartes?.v}
          acte={vue.acte}
          // Sur le plan, le plan d'abord ; en rencontre, l'ordre où l'on joue.
          debut={vue.rencontre ? undefined : vue.carte ? 'plan' : undefined}
          onFermer={() => setRegles(false)}
        />
      )}
      {regardee && <CarteLevee cle={regardee} onReposer={() => setRegardee(null)} />}
    </div>
  )
}

/** Un joker en petit : le médaillon du légendaire qui le donne, sinon son icône. */
function VisageDuJoker({ j }: { j: Joker }) {
  return j.legendaire ? <Medaillon cle={j.legendaire} className="exp-medaillon exp-visage-joker" /> : <Icon name={ICONE_DU_JOKER[j.cle] ?? 'sparkles'} />
}

/** L'ordre du catalogue : ceux de départ et des offres, puis ceux des légendaires. */
const RANG_AU_CATALOGUE = new Map([...JOKERS_SANS_LEGENDAIRE, ...JOKERS_DES_LEGENDAIRES].map((j, i) => [j.cle, i]))

/**
 * Des jokers comptés : « Coup d’œil ×3 », dans l'ordre du catalogue — pas
 * celui de leur nom : `localeCompare` en français chargerait les données
 * d'`Intl` (règle `client.md`).
 */
function comptes(cles: readonly string[]): { cle: string; nom: string; n: number }[] {
  const n = new Map<string, number>()
  for (const cle of cles) n.set(cle, (n.get(cle) ?? 0) + 1)
  return [...n]
    .map(([cle, x]) => ({ cle, nom: jokerDeCle(cle)?.nom ?? cle, n: x }))
    .sort((a, b) => (RANG_AU_CATALOGUE.get(a.cle) ?? 99) - (RANG_AU_CATALOGUE.get(b.cle) ?? 99))
}

const ditDesComptes = (cles: readonly string[]) => comptes(cles).map(c => (c.n > 1 ? `${c.nom} ×${c.n}` : c.nom))

/** Des jokers comptés, en jetons : le paquet, la défausse. */
function Jetons({ cles, vide }: { cles: readonly string[]; vide: string }) {
  if (cles.length === 0) return <p className="muted small">{vide}</p>
  return (
    <ul className="exp-jetons">
      {ditDesComptes(cles).map(t => (
        <li key={t} className="exp-jeton">
          {t}
        </li>
      ))}
    </ul>
  )
}

/**
 * Ce qu'un joker joué vient de faire, quand la question ne le montre pas
 * d'elle-même : une vie rendue, des jokers tirés, une escale ouverte. Null :
 * l'écran le dit déjà — les réponses effacées, l'autre question.
 */
function ceQuIlAFait(cle: string, avant: VueDeLExpedition, apres: VueDeLExpedition): string | null {
  const j = jokerDeCle(cle)
  if (!j) return null
  if (j.sorte === 'poser') return cle === 'abysses' ? `« ${j.nom} » est posé : il t’a coûté une vie` : `« ${j.nom} » est posé jusqu’au bout de l’acte`
  if (cle === 'passe-muraille') return 'Traversée : la question part à ton carnet, sans te coûter de vie'
  if (cle === 'reveil') return 'Une vie de plus'
  if (cle === 'horizon') return 'Ta vie te revient — et le prochain coffre sera vide'
  if (cle === 'feu-d-artifice') return 'Ta défausse revient dans ton paquet'
  if (cle === 'pioche') {
    const tires = (apres.jokers?.main.length ?? 0) - ((avant.jokers?.main.length ?? 1) - 1)
    return tires > 0 ? `${tires === 1 ? 'Un joker' : 'Deux jokers'} de plus dans ta main` : 'Ton paquet est vide : rien à tirer'
  }
  if (cle === 'detour') return 'Ton pas suivant va où tu veux, à l’étage du dessus'
  if (cle === 'raccourci') return 'Ton pas suivant saute une escale'
  if (cle === 'commandement') return apres.route?.commandement ? `Au pas suivant, une question ou une élite posera ${apres.route.commandement}` : null
  if (cle === 'maison' || cle === 'boule') {
    const ouverte = apres.carte?.escales.find(e => avant.carte?.escales.find(x => x.id === e.id)?.sorte !== e.sorte)
    return ouverte ? `${ouverte.sorte === 'source' ? 'Une source' : 'Un coffre'} s’ouvre au-dessus de toi` : null
  }
  if (cle === 'lanterne') {
    const pieges = apres.carte?.escales.filter(e => e.contenu === 'piege').length ?? 0
    return pieges === 0 ? 'La lanterne éclaire l’acte : aucun piège sur ce plan' : `La lanterne montre ${pieges === 1 ? 'un piège' : `${pieges} pièges`} sur le plan`
  }
  return null
}

/**
 * La page : elle lit l'expédition en route, sinon la prochaine, puis suit
 * chaque geste. Ce que la visite rapporte se compte en chemin — l'expérience
 * de chaque bonne réponse, ses confettis — pour l'écran des gains, comme en
 * série.
 */
export function ExpeditionApp() {
  const [ecran, setEcranBrut] = useState<Ecran>({ e: 'chargement' })
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [gains, setGains] = useState<GainsDeLExpedition>({ xp: 0, justes: 0, tampons: [] })
  const [surPlace, setSurPlace] = useState<CartesSurPlace | null>(null)
  // Les petites peintures de son paquet, d'avance — une carte tirée arrive peinte —, et celles d'une offre ou d'une échoppe : la
  // révélation qui la précède leur laisse le temps.
  const enRoute = ecran.e === 'route' ? ecran.vue : null
  useEffect(() => {
    if (enRoute) prechargerLesPeintures([...(enRoute.cartes?.paquet ?? []), ...(enRoute.offre?.jokers ?? []), ...(enRoute.echoppe?.jokers ?? [])])
  }, [enRoute])
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    setErreur('')
    window.scrollTo(0, 0)
  }

  /** L'expédition en route reprend où elle en est ; sans elle — ou en partant —, le départ. */
  const montrer = (page: PageDeLExpedition, enPartant = false) => setEcran(ecranDeLaPage(page, enPartant))

  const relire = async (enPartant = false) => {
    try {
      montrer(await api.expedition.page(), enPartant)
    } catch (e) {
      if (e instanceof UnauthorizedError) setEcran({ e: 'anonyme' })
      else if (e instanceof ApiError && e.statut === 404) setEcran({ e: 'bientot', motif: e.message })
      else setEcran({ e: 'erreur', motif: motifDe(e) })
    }
  }

  useEffect(() => {
    let vivant = true
    // Demandée d'emblée, à l'adresse même que la page servie a préchargée (`DEPART.expedition`).
    const page = api.expedition.page()
    page.catch(() => {})
    ;(async () => {
      try {
        const moi = await api.joueur.moiLeger()
        if (!vivant) return
        // Le thème de son profil habille la page, comme la campagne ; sa gerbe éclate à ses bonnes réponses ; son compagnon, dans sa niche.
        void porterTheme(moi.profile?.theme)
        porterGerbe(moi.profile?.gerbe)
        porterNiche(moi.profile)
        if (moi.profile) retenirLeNiveau(moi.profile.niveau)
      } catch {
        // Sans le profil léger, la page se joue quand même : le thème attendra.
      }
      try {
        const p = await page
        if (vivant) montrer(p)
      } catch (e) {
        if (!vivant) return
        if (e instanceof UnauthorizedError) setEcran({ e: 'anonyme' })
        else if (e instanceof ApiError && e.statut === 404) setEcran({ e: 'bientot', motif: e.message })
        else setEcran({ e: 'erreur', motif: motifDe(e) })
      }
    })()
    return () => {
      vivant = false
    }
  }, [])

  /** Un geste qui n'est pas passé : le refus se dit, et la page se relit — un autre onglet a peut-être joué. */
  const refuse = (e: unknown) => {
    const motif = motifDe(e)
    void relire().then(() => setErreur(motif))
  }

  /** Partir — aux rencontres, là où elles s'ouvrent (partout, depuis qu'elles sont le jeu), avec son style, sa catégorie fétiche, le dos de son paquet et son cran de l'Ascension. */
  const partir = async (equipee: readonly string[], rencontres: ChoixDuDepart | null) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const vue = await api.expedition.partir(
        equipee,
        rencontres
          ? {
              rencontres: true,
              ...(rencontres.questionAuCentre && { questionAuCentre: true as const }),
              ...(rencontres.style && { style: rencontres.style }),
              ...(rencontres.fetiche && { fetiche: rencontres.fetiche }),
              ...(rencontres.dos && { dos: rencontres.dos }),
              ...(rencontres.ascension > 0 && { ascension: rencontres.ascension }),
            }
          : {},
      )
      retenirLEquipee(equipee)
      // Ce que la fin dira est celui de cette expédition : la précédente, jouée sur la même page, a eu sa fin.
      setGains({ xp: 0, justes: 0, tampons: [] })
      setEcran({ e: 'route', vue })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Un geste qui rend l'expédition d'après : l'écran se relit d'elle — sauf celui que `puis` choisit. Les cartes jouées sur
   * place sont parties avec lui ; refusé, il ne s'est pas écrit, elles non plus : elles reviennent dans la main.
   */
  const geste = async (faire: () => Promise<ApresUnGeste>, puis?: (apres: VueDeLExpedition, r: ApresUnGeste) => Ecran | void) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const r = await faire()
      setSurPlace(null)
      setEcran(puis?.(r.expedition, r) ?? { e: 'route', vue: r.expedition })
    } catch (e) {
      setSurPlace(null)
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  const avancer = (vue: VueDeLExpedition, vers: string) =>
    geste(
      () => api.expedition.avancer(vue.id, vue.rang + 1, vers),
      (apres, r) => {
        // Une expédition de l'étape 1 n'a pas de jokers : son campement rend sa vie d'office, et seul ce mot le dit. En rencontres, ni jokers ni question en vue : la règle n'est pas pour elle.
        if (!apres.jokers && !apres.cartes && vers !== GARDIEN && !apres.question) {
          showToast({ kind: 'info', message: apres.vies > vue.vies ? 'Le campement te rend une vie' : 'Tes trois vies sont là : le campement veille sur elles' })
        }
        // Un piège sur sa dernière vie finit l'expédition d'un pas : l'inconnu le dit d'abord, puis la fin.
        const tombe = apres.issue === 'perdue' ? { recompenses: r.recompenses, legendaires: r.legendaires } : undefined
        // L'inconnu dévoilé a son écran ; le marchand ouvre son échoppe, qui a le sien.
        if (apres.inconnu && apres.inconnu.contenu !== 'marchand') return { e: 'inconnu', vue: apres, ...(tombe && { tombe }) }
        if (tombe) return { e: 'fin', vue: apres, tombe, correction: null }
      },
    )

  /**
   * Un joker : sur la question à l'écran — sa position, qu'un joker périmé soit refusé —, sur la carte, ou posé. Une
   * carte des rencontres vise de même la question qui attend, même cachée tant qu'il prépare : son rang seul part. En
   * préparation, celle dont tout l'effet se lit de la vue se joue sur place (`vueApresLaCarte`) et part avec le geste
   * suivant (`cartes`, celles déjà jouées ainsi), toutes d'un seul aller-retour — chacune en coûtait un. `vue` est celle
   * que la page montre, ses cartes jouées sur place comprises : le geste porte le rang de la première.
   */
  const jouer = (vue: VueDeLExpedition, cle: string, plus: { categorie?: string; montre?: number } = {}, cartes: readonly string[] = []) => {
    if (busy) return
    if (plus.categorie === undefined && plus.montre === undefined && vueApresLaCarte(vue, cle)) {
      setSurPlace({ id: vue.id, rang: vue.rang - cartes.length, cartes: [...cartes, cle] })
      const dit = ceQueLaCarteAFait(cle, vue.cartes?.v)
      if (dit) showToast({ kind: 'info', message: dit })
      return
    }
    const position = vue.question?.index ?? vue.rencontre?.position
    return geste(
      () => api.expedition.jouer(vue.id, vue.rang + 1 - cartes.length, cle, { ...(position !== undefined && { position }), ...plus }, cartes),
      apres => {
        // Une carte de route dit ce qu'elle ouvre, comme un joker de carte ; une carte de combat, ce que l'écran ne montre pas.
        const dit = vue.cartes && !estDeRoute(cle) ? ceQueLaCarteAFait(cle, vue.cartes.v) : ceQuIlAFait(cle, vue, apres)
        if (dit) showToast({ kind: 'info', message: dit })
      },
    )
  }

  /** En rencontre : sa mise dite, il voit la question qui attend — ses cartes jouées sur place avec lui. */
  const voir = (vue: VueDeLExpedition, mise: number, cartes: readonly string[] = []) =>
    geste(() => api.expedition.voir(vue.id, vue.rang + 1 - cartes.length, mise, vue.rencontre?.position, cartes))

  const prendre = (vue: VueDeLExpedition, jokers: readonly string[], talisman?: string, fiole?: CleDeFiole) =>
    geste(
      () => api.expedition.prendre(vue.id, vue.rang + 1, jokers, talisman, fiole),
      apres => {
        // Un coffre passé sans rien prendre : ses écus, qu'un mot dit.
        const gagnes = (apres.ecus ?? 0) - (vue.ecus ?? 0)
        if (gagnes > 0) showToast({ kind: 'info', message: `+${gagnes} écus : le coffre reste fermé, tu passes` })
      },
    )

  const camper = (vue: VueDeLExpedition, choix: { retirer?: string; ameliorer?: string }) => geste(() => api.expedition.camper(vue.id, vue.rang + 1, choix))

  /** À l'échoppe : un article, payé en écus ; l'échoppe reste ouverte pour le suivant. */
  const acheter = (vue: VueDeLExpedition, article: ArticleDeLEchoppe, joker?: string) => geste(() => api.expedition.acheter(vue.id, vue.rang + 1, article, joker))

  /** Une fiole bue (le codex), de la barre : pendant une question, sur celle qui attend — son rang seul part, comme une carte ; en préparation, les cartes jouées sur place avec elle. */
  const boire = (vue: VueDeLExpedition, fiole: CleDeFiole, cartes: readonly string[] = []) => {
    const position = vue.question?.index ?? vue.rencontre?.position
    return geste(
      () => api.expedition.boire(vue.id, vue.rang + 1 - cartes.length, fiole, position, cartes),
      () => {
        const f = fioleDe(fiole)
        if (f) showToast({ kind: 'info', message: `${f.nom} : ${effetDeLaFiole(f, vue.cartes?.v ?? 0)}` })
      },
    )
  }

  /**
   * L'échoppe qu'il a laissée sans avancer (« Reprendre la route ») : la carte
   * s'affiche, et l'échoppe se rouvre d'un bouton tant qu'il n'a pas fait son
   * pas. Elle ne bloque rien : le pas suivant la quitte.
   */
  const [echoppeLaissee, setEchoppeLaissee] = useState<string | null>(null)

  /** Une réponse — deux sous Double chance, ses lettres à composer —, à la question qu'il a choisie sous Deux visages. */
  const repondre = async (vue: VueDeLExpedition, q: QuestionDExpedition, choix: number | readonly number[] | string) => {
    if (busy) return
    // Sa niche retient son souffle jusqu'au verdict du serveur.
    nicheRetientSonSouffle()
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.expedition.repondre(vue.id, q.index, choix)
      // Les familles (v14) : un second essai — rien n'est jugé, la question reste, sa réponse ratée effacée, et il répond encore ; sa
      // niche retient son souffle jusqu'au vrai verdict.
      if (reponse.essai) {
        setEcranBrut({ e: 'route', vue: reponse.expedition })
        return
      }
      setGains(g => ({ xp: g.xp + reponse.xp, justes: g.justes + (reponse.juste ? 1 : 0), tampons: reponse.tampon ? [...g.tampons, reponse.tampon] : g.tampons }))
      // La révélation reste à l'écran, sans le faire défiler : la bonne réponse est sous le doigt. Composée, elle n'est aucune de ses
      // réponses : la révélation dit ce qu'il a composé.
      if (typeof choix === 'string') {
        setEcranBrut({ e: 'route', vue: reponse.expedition, question: q, reponse, choix: reponse.bonne, composee: choix, avant: vue })
        return
      }
      // Une frise (v13) : l'ordre qu'il a donné, que la révélation redit à côté du bon.
      if (q.frise && Array.isArray(choix)) {
        setEcranBrut({ e: 'route', vue: reponse.expedition, question: q, reponse, choix: reponse.bonne, ordre: [...choix], avant: vue })
        return
      }
      const premier = typeof choix === 'number' ? choix : (choix.includes(reponse.bonne) ? reponse.bonne : choix[0])
      setEcranBrut({ e: 'route', vue: reponse.expedition, question: q, reponse, choix: premier, avant: vue })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  /** Après une révélation : le gardien qui tombe, la fin, ou la suite de la route. */
  const suite = (vue: VueDeLExpedition, r: ReponseDExpedition) => {
    if (r.vaincu) return setEcran({ e: 'vaincu', vue, gardien: r.vaincu })
    if (vue.issue === 'perdue') return setEcran({ e: 'fin', vue, tombe: { recompenses: r.recompenses, legendaires: r.legendaires }, correction: null })
    setEcran({ e: 'route', vue })
  }

  const garder = async (vue: VueDeLExpedition, cle: string) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const apres = await api.expedition.garder(vue.id, vue.rang + 1, cle)
      setEcran({ e: 'fin', vue: apres.expedition, tombe: { recompenses: apres.recompenses, legendaires: apres.legendaires, compagnon: apres.compagnon }, correction: null })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  const abandonner = async (vue: VueDeLExpedition) => {
    if (busy) return
    const oui = await confirmDialog({
      title: 'Abandonner l’expédition ?',
      message: 'Elle s’arrête là, sans légendaire. Tes bonnes réponses restent à toi, et tes erreurs reviendront à ton carnet.',
      confirmLabel: 'Abandonner',
      danger: true,
    })
    if (!oui) return
    setBusy(true)
    setErreur('')
    try {
      const apres = await api.expedition.abandonner(vue.id)
      setEcran({ e: 'fin', vue: apres.expedition, tombe: { recompenses: apres.recompenses, legendaires: apres.legendaires }, correction: null })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  /** « ← Partir » : l'expédition attend, rien ne se perd — on revient au départ, qui la reprend. */
  const quitter = () => void relire(true).then(() => showToast({ kind: 'info', message: 'Ton expédition t’attend : reprends-la quand tu veux' }))

  const signaler = async (serie: string, index: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(serie, index, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  if (ecran.e === 'chargement') {
    return (
      <div className="player-shell expedition" aria-busy="true">
        <Sortie />
        <PieceTete piece="Seul" titre="L’Expédition" />
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  if (ecran.e === 'anonyme' || ecran.e === 'bientot' || ecran.e === 'erreur') {
    const retour = encodeURIComponent('/expedition')
    return (
      <div className="player-shell expedition">
        <Sortie />
        <PieceTete piece="Seul" titre="L’Expédition" />
        {ecran.e === 'anonyme' ? (
          <>
            <p>L’expédition se joue avec ton profil : les légendaires que tu y gardes y restent.</p>
            <a className="btn btn-primary btn-big btn-block" href={`/?next=${retour}`}>
              Me connecter
            </a>
            <a className="btn btn-block" href={`/?creer=1&next=${retour}`}>
              Créer mon profil
            </a>
          </>
        ) : (
          <p className={ecran.e === 'erreur' ? 'error' : undefined}>{espacesFines(ecran.motif)}</p>
        )}
      </div>
    )
  }

  if (ecran.e === 'depart') {
    return (
      <Depart
        page={ecran.page}
        busy={busy}
        erreur={erreur}
        onPartir={(equipee, rencontres) => void partir(equipee, rencontres)}
        onReprendre={vue => setEcran({ e: 'route', vue })}
        onAbandonner={vue => void abandonner(vue)}
      />
    )
  }

  if (ecran.e === 'vaincu') {
    const { vue, gardien } = ecran
    return <GardienVaincu vue={vue} gardien={gardien} onSuite={() => setEcran({ e: 'route', vue })} />
  }

  if (ecran.e === 'inconnu') {
    const { vue, tombe } = ecran
    return <Inconnu vue={vue} onSuite={() => setEcran(tombe ? { e: 'fin', vue, tombe, correction: null } : { e: 'route', vue })} />
  }

  if (ecran.e === 'fin') {
    const voirCorrection = async () => {
      try {
        setEcranBrut({ ...ecran, correction: await api.campagne.correction(ecran.vue.id) })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    return <FinDeLExpedition fin={ecran} gains={gains} erreur={erreur} onCorrection={() => void voirCorrection()} onAutre={() => void relire()} />
  }

  // La vue du serveur, et les cartes jouées sur place depuis : la main, l'énergie, l'aperçu qu'elles laissent.
  const { vue, cartes } = avecLesCartesSurPlace(ecran.vue, surPlace)
  // Ses cartes se lisent à la version de son départ : une expédition partie avant le codex garde ses chiffres. Ses fioles se
  // boivent de la barre de chaque écran — sauf à la révélation d'une réponse : bue là, l'écran passait à la suite, et
  // l'écart avec la vue d'avant, qui dit ce que la réponse a coûté, aurait compté la fiole.
  const aSaVersion = (x: ReactNode, fioles = true) => (
    <VersionDesCartes.Provider value={vue.cartes?.v ?? VERSION_DU_CODEX}>
      <BoireUneFiole.Provider value={fioles ? fiole => void boire(vue, fiole, cartes) : null}>{x}</BoireUneFiole.Provider>
    </VersionDesCartes.Provider>
  )
  const surLaMain = { onJouer: (cle: string, plus?: { categorie?: string; montre?: number }) => void jouer(vue, cle, plus, cartes) }
  if (ecran.reponse && ecran.question) {
    return aSaVersion(
      <Escale
        vue={vue}
        avant={ecran.avant ?? null}
        question={ecran.question}
        reponse={ecran.reponse}
        choix={ecran.choix ?? null}
        composee={ecran.composee}
        ordre={ecran.ordre}
        busy={busy}
        erreur={erreur}
        onRepondre={() => {}}
        onJouer={() => {}}
        onSuite={() => suite(vue, ecran.reponse!)}
        onPartir={quitter}
        onSignaler={() => void signaler(vue.id, ecran.question!.index)}
      />,
      false,
    )
  }
  if (vue.issue === 'au-bout') return <ChoixDuLegendaire vue={vue} busy={busy} erreur={erreur} onGarder={cle => void garder(vue, cle)} />
  if (vue.offre) return aSaVersion(<Offre vue={vue} offre={vue.offre} busy={busy} erreur={erreur} onPrendre={(jokers, talisman, fiole) => void prendre(vue, jokers, talisman, fiole)} onPartir={quitter} />)
  if (vue.campement) return aSaVersion(<Campement vue={vue} busy={busy} erreur={erreur} onCamper={choix => void camper(vue, choix)} onPartir={quitter} />)
  // L'échoppe où il est, tant qu'il ne l'a pas laissée : elle se rouvre de la carte.
  const ouEstLEchoppe = `${vue.id}:${vue.acte}:${vue.ici}`
  if (vue.echoppe && echoppeLaissee !== ouEstLEchoppe) {
    return aSaVersion(
      <Echoppe
        // Un achat fait, l'étal se relit sans rien de choisi : l'article acheté restait sous le bouton.
        key={`${vue.id}:${vue.rang}`}
        vue={vue}
        echoppe={vue.echoppe}
        busy={busy}
        erreur={erreur}
        onAcheter={(article, joker) => void acheter(vue, article, joker)}
        onReprendre={() => setEchoppeLaissee(ouEstLEchoppe)}
        onPartir={quitter}
      />
    )
  }
  // En rencontre, la question qui attend se prépare avant de se voir : l'annonce, l'aperçu, la mise, la main.
  if (vue.rencontre && vue.rencontre.phase === 'preparation') {
    return aSaVersion(
      <PreparationDeLaRencontre
        // Une question neuve repart d'une mise nulle ; une carte jouée la garde.
        key={`${vue.id}:${vue.rencontre.position}`}
        vue={vue}
        r={vue.rencontre}
        barre={<Barre vue={vue} onPartir={quitter} />}
        busy={busy}
        erreur={erreur}
        onJouer={surLaMain.onJouer}
        onVoir={mise => void voir(vue, mise, cartes)}
      />
    )
  }
  if (vue.question) {
    return aSaVersion(
      <Escale
        // Une autre question — Échange, La mue — repart de zéro : rien de choisi, rien de montré.
        key={`${vue.id}:${vue.question.index}`}
        vue={vue}
        avant={null}
        question={vue.question}
        reponse={null}
        choix={null}
        busy={busy}
        erreur={erreur}
        onRepondre={(q, choix) => void repondre(vue, q, choix)}
        onSuite={() => {}}
        onPartir={quitter}
        onSignaler={() => {}}
        {...surLaMain}
      />
    )
  }
  if (!vue.carte) return null
  return aSaVersion(
    <CarteDeLActe
      key={`${vue.id}:${vue.acte}`}
      vue={vue}
      carte={vue.carte}
      busy={busy}
      erreur={erreur}
      onAvancer={vers => void avancer(vue, vers)}
      onPartir={quitter}
      onEchoppe={vue.echoppe ? () => setEchoppeLaissee(null) : undefined}
      {...surLaMain}
    />
  )
}

/** Les cartes jouées sur place depuis la dernière vue du serveur : l'expédition et le rang qu'elles suivent. */
interface CartesSurPlace {
  id: string
  rang: number
  cartes: string[]
}

/**
 * La vue que la page montre : celle du serveur, et les cartes jouées sur place
 * depuis (`vueApresLaCarte`), tant qu'il n'a pas bougé — un geste passé, un
 * autre onglet, et elles ne suivent plus rien. « ← Partir » puis
 * « Reprendre » les retrouve ; recharger la page les rend à la main : rien
 * n'en était parti.
 */
export function avecLesCartesSurPlace(vue: VueDeLExpedition, sur: CartesSurPlace | null): { vue: VueDeLExpedition; cartes: string[] } {
  if (!sur || sur.id !== vue.id || sur.rang !== vue.rang) return { vue, cartes: [] }
  let v = vue
  const cartes: string[] = []
  for (const cle of sur.cartes) {
    const apres = vueApresLaCarte(v, cle)
    if (!apres) break
    v = apres
    cartes.push(cle)
  }
  return { vue: v, cartes }
}

/** Ce que la fin redit de l'expédition jouée sur cette page : son expérience, ses confettis, ses tampons neufs. */
interface GainsDeLExpedition {
  xp: number
  justes: number
  tampons: string[]
}

/** L'équipée de son dernier départ, retenue sur le téléphone. */
const CLE_DE_L_EQUIPEE = 'quizz.expedition.equipee'

function equipeeRetenue(): string[] {
  try {
    const lue: unknown = JSON.parse(localStorage.getItem(CLE_DE_L_EQUIPEE) ?? '[]')
    return Array.isArray(lue) ? lue.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function retenirLEquipee(equipee: readonly string[]) {
  try {
    localStorage.setItem(CLE_DE_L_EQUIPEE, JSON.stringify(equipee))
  } catch {
    // Un stockage refusé : la prochaine équipée se proposera d'elle-même.
  }
}

/**
 * L'équipée proposée au départ : celle du dernier départ, de ce qu'il peut
 * encore emmener ; ses places libres, l'invité du jour d'abord — c'est par lui
 * qu'un profil découvre ce que font les jokers —, puis les siens.
 */
function equipeeDeDepart(p: PageDeLExpedition['prochaine']): string[] {
  const possibles = new Set([p.invite, ...p.equipables])
  const equipee = [...new Set(equipeeRetenue().filter(cle => possibles.has(cle)))].slice(0, PLACES_DE_L_EQUIPEE)
  for (const cle of [p.invite, ...p.equipables]) if (equipee.length < PLACES_DE_L_EQUIPEE && !equipee.includes(cle)) equipee.push(cle)
  return equipee
}

// ── Les pièces ──────────────────────────────────────────────────────────────

/** Un gardien en médaillon, à la taille du texte qui l'entoure — son dessin peint vient à la demande (`Dessin`). */
function Medaillon({ cle, verrouille, grand, className }: { cle: string; verrouille?: boolean; grand?: boolean; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <Dessin cle={cle} verrouille={verrouille} grand={grand} />
    </span>
  )
}

/** Le joker d'un gardien : son nom, ce qu'il fait. Vaincu, il le glisse dans le paquet ; gardé, il part dans les équipées suivantes. */
function SonJoker({ cle }: { cle: string }) {
  const j = jokerDuLegendaire(cle)
  if (!j) return null
  return (
    <span className="exp-joker">
      <b>{`Son joker : ${j.nom}`}</b>
      {j.maudit && <span className="exp-maudit">maudit</span>}
      <span className="muted small">{espacesFines(j.effet)}</span>
    </span>
  )
}

/** La carte d'un gardien, aux rencontres : son nom, ce qu'elle fait. Vaincu, il la glisse dans le paquet ; gardé, elle part dans les équipées suivantes. */
function SaCarte({ cle }: { cle: string }) {
  const c = carteDuLegendaire(cle)
  if (!c) return null
  return (
    <span className="exp-joker">
      <b>{`Sa carte : ${c.nom}`}</b>
      {c.maudit && <span className="exp-maudit">maudite</span>}
      <span className="muted small">{espacesFines(c.effet)}</span>
    </span>
  )
}

/** La règle d'un gardien, acte par acte : combien de bonnes réponses, sur quelles questions. */
const regleDuGardien = (acte: number) => {
  const m = MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)]
  return `${m.aTrouver === 4 ? 'Quatre' : 'Trois'} bonnes réponses, en questions ${MARCHE[m.gardien]}s`
}

/**
 * Le départ (la maquette 1) : les trois gardiens côte à côte, puis l'équipe
 * qui part avec lui — « Changer » ouvre sa feuille ; celle qui l'attend, à
 * reprendre, avec l'équipe qu'elle a emmenée. Un gardien qu'il a déjà le dit
 * d'une pastille (le choix du 17 octobre 2026). Ce qu'il fallait savoir pour
 * partir — ce que fait un gardien, combien de questions, ce que garde
 * « ← Partir », d'où viennent les tampons — est dans les règles, au « ? »
 * d'en haut : « Trop d'infos écrites sur la page on s'y perd » (la revue du
 * 18 octobre 2026).
 */
export function Depart({
  page,
  busy,
  erreur,
  onPartir,
  onReprendre,
  onAbandonner,
}: {
  page: PageDeLExpedition
  busy: boolean
  erreur: string
  /** `rencontres` : partir aux rencontres, avec son style, sa catégorie fétiche, le dos de son paquet et son cran de l'Ascension ; null, aux règles d'avant. */
  onPartir: (equipee: readonly string[], rencontres: ChoixDuDepart | null) => void
  onReprendre: (vue: VueDeLExpedition) => void
  /** Celle qui l'attend s'abandonne d'ici aussi : « J'aimerais pouvoir abandonner une expédition » (le 18 octobre 2026) — le geste ne vivait qu'au fond de la feuille de la carte. */
  onAbandonner: (vue: VueDeLExpedition) => void
}) {
  const vue = page.expedition
  const gardiens = vue ? vue.gardiens : page.prochaine.gardiens.map(cle => ({ cle, vaincu: false, ...(page.prochaine.aLui.includes(cle) && { aLui: true as const }) }))
  const [equipee, setEquipee] = useState<string[]>(() => equipeeDeDepart(page.prochaine))
  const [choisir, setChoisir] = useState(false)
  const [passeport, setPasseport] = useState(false)
  const [regles, setRegles] = useState(false)
  const [paquet, setPaquet] = useState(false)
  const [voirLeCodex, setCodex] = useState(false)
  // Les rencontres, là où elles s'ouvrent — partout, depuis qu'elles sont le jeu : le départ ne les demande plus (« ne plus
  // demander ça, c'est vraiment le jeu maintenant », le 19 octobre 2026), il les prend. Sa catégorie fétiche, retenue.
  const ouvertes = !vue && !!page.prochaine.rencontres
  const [fetiche, setFetiche] = useState(feticheRetenue)
  // Le dos de son paquet (le codex) : celui qu'il a choisi la dernière fois, s'il l'a encore — sinon le plus rare des siens.
  const [dos, setDos] = useState(() => (page.prochaine.codex ? dosRetenu(page.prochaine.codex.dos) : null))
  // Son cran de l'Ascension, parmi ceux qu'il a ouverts : celui de la dernière fois, ou aucun.
  const [cran, setCran] = useState(() => (page.prochaine.codex ? ascensionRetenue(page.prochaine.codex.ascension) : 0))
  // Son style (le 19 octobre 2026), parmi ceux que son codex ouvre : celui de la dernière fois, sinon le premier des siens.
  const styles = page.prochaine.codex?.styles ?? []
  const [style, setStyle] = useState(() => styleRetenu(page.prochaine.codex?.styles ?? []))
  const enRencontres = vue ? vue.courage !== undefined : ouvertes
  // La version que ses pièces lisent : celle de l'expédition en route, sinon celle qui partirait — la question au centre, ses
  // coups de pouce, ses curiosités, sa frise, ses familles et son détail (v15), là où la page la dit ouverte. Ses cartes, son codex, ses
  // styles, son Ascension et ses règles en dépendent.
  const v = vue ? (vue.cartes?.v ?? VERSION_DU_CODEX) : page.prochaine.questionAuCentre ? VERSION_DU_DETAIL : VERSION_DES_HUIT_FAMILLES
  // Le codex (v7) : celui qu'elle a figé en route, celui qui partirait avant ; aux règles d'avant, aucun.
  const codex = page.prochaine.codex
  // L'Ascension se choisit une fois une expédition menée au bout ; un serveur d'avant elle ne dit rien de ses crans.
  const ouverte = !vue && enRencontres ? (codex?.ascension ?? 0) : 0
  const auCodex = vue ? !!vue.cartes?.codex : enRencontres && !!codex
  const feticheOuverte = !codex || codex.regles.includes('fetiche')
  // Celle qui l'attend dit l'équipée qu'elle a emmenée ; une expédition de l'étape 1 n'en avait pas. Au codex, l'invité du jour seul.
  const montree = vue ? (vue.jokers || vue.cartes ? vue.equipee : null) : auCodex ? [page.prochaine.invite] : equipee
  // Sans légendaire à lui, rien à choisir : l'invité du jour part d'office, et une ligne le dit. Deux places, dont une libre,
  // demandaient de choisir ce qu'il n'avait pas (« c'est pas clair de devoir mettre des légendaires sur la première page, surtout
  // qu'au début on n'a pas forcément ça », le 18 octobre 2026). Au codex, plus d'équipe à choisir pour personne : ses légendaires
  // ouvrent leur carte au codex, et l'invité du jour prête la sienne.
  const invite = auCodex ? (vue ? vue.invite : page.prochaine.invite) : !vue && page.prochaine.equipables.length === 0 ? page.prochaine.invite : undefined
  // La saison de son départ — celle qu'elle a eue, en route ; celle d'aujourd'hui, avant de partir.
  const s = laSaison(vue ? vue.saison : page.prochaine.saison)
  const tampons = page.passeport.length
  // Le paquet qui partirait : en rencontres, il s'ouvre en vraies cartes — les deux de son style comprises ; aux règles d'avant, il
  // se dit en une ligne.
  const sonPaquet = !vue && montree && enRencontres ? paquetDesRencontres(montree, style ?? undefined, v) : null
  // Le style qui s'ouvre ensuite, et son niveau : la ligne du départ dit ce que le jeu fera gagner.
  const prochainStyle = stylesDeLaVersion(v).find(x => !styles.includes(x))
  // Sa catégorie fétiche est à l'Érudit, qui en vit : un autre style ne la porte pas.
  const feticheDuDepart = feticheOuverte && (!style || style === 'erudit') ? fetiche : null
  // Les cartes de l'expédition à sa version : la question au centre n'en joue que soixante-deux.
  const cartesDuCodex = CARTES_DES_RENCONTRES.filter(c => carteALaVersion(c.cle, v)).length
  const ecranDuDepart = (
    <div className="player-shell expedition">
      <div className="exp-haut-du-depart">
        <Sortie />
        <BoutonDesRegles onOuvrir={() => setRegles(true)} />
      </div>
      <header className="exp-tete">
        <h1>L’Expédition</h1>
        <p className="muted">{espacesFines('Bats les trois gardiens : tu repars avec l’un d’eux.')}</p>
      </header>
      {s && <BandeauDeLaSaison saison={s} gardiens={gardiens.map(g => g.cle)} enRoute={!!vue} />}
      <section className="card exp-gardiens" aria-labelledby="exp-gardiens-titre">
        <h2 className="label" id="exp-gardiens-titre">
          {vue ? `Ton expédition n° ${formatNumber(vue.numero)}` : 'Ce qui t’attend'}
        </h2>
        {/* Côte à côte, sans leur règle : ce qu'il faut pour les vaincre est dans les règles, au « ? » d'en haut. */}
        <ol className="exp-trois-gardiens">
          {gardiens.map((g, acte) => (
            <li key={g.cle} className={'exp-gardien-col' + (g.vaincu ? ' exp-vaincu-ligne' : '')}>
              <Medaillon cle={g.cle} className="exp-medaillon" />
              <span className="label">{`Acte ${acte + 1}`}</span>
              <b className="exp-gardien-nom">{nomDuGardien(g.cle)}</b>
              {g.vaincu ? (
                <span className="exp-pastille">{gardienAuFeminin(g.cle) ? 'vaincue' : 'vaincu'}</span>
              ) : g.aLui ? (
                <span className="exp-pastille">déjà à toi</span>
              ) : vue && acte === vue.acte ? (
                <span className="exp-pastille exp-pastille-or">en route</span>
              ) : (
                s?.legendaire === g.cle && <span className="exp-pastille exp-pastille-or">de saison</span>
              )}
            </li>
          ))}
        </ol>
      </section>
      {invite ? (
        <p className="card exp-invite-seul">
          <Medaillon cle={invite} className="exp-medaillon" />
          <span>{espacesFines(`${nomDuGardien(invite)}, ${gardienAuFeminin(invite) ? 'l’invitée' : 'l’invité'} du jour, part avec toi : ${enRencontres ? 'sa carte rejoint ton paquet' : 'son joker rejoint ton paquet'}.`)}</span>
        </p>
      ) : montree && (
        <section className="card exp-equipee" aria-labelledby="exp-equipee-titre">
          <div className="exp-section-tete">
            <h2 className="label" id="exp-equipee-titre">
              Ton équipe
            </h2>
            {!vue && (
              <button type="button" className="link-inline small exp-changer" aria-haspopup="dialog" onClick={() => setChoisir(true)}>
                Changer
                <Icon name="chevron-right" />
              </button>
            )}
          </div>
          <Places equipee={montree} invite={vue ? vue.invite : page.prochaine.invite} siens={vue ? null : page.prochaine.equipables} rencontres={enRencontres} />
          {!vue && !enRencontres && <p className="muted small">{espacesFines(`Ton paquet au départ : ${ditDesComptes(paquetDeDepart(montree)).join(', ')}.`)}</p>}
        </section>
      )}
      {/* Son style, avant le paquet qu'il fait ; un serveur d'avant les styles n'en dit aucun : la catégorie fétiche, seule. */}
      {ouvertes && style ? (
        <ChoixDuStyle
          styles={styles}
          style={style}
          onChoisir={setStyle}
          fetiche={fetiche}
          feticheOuverte={feticheOuverte}
          onFetiche={setFetiche}
          {...(prochainStyle && { prochain: { style: prochainStyle, niveau: niveauDuStyle(prochainStyle, v) } })}
        />
      ) : (
        ouvertes && feticheOuverte && <FeticheDuDepart fetiche={fetiche} onFetiche={setFetiche} />
      )}
      {sonPaquet && (
        <button type="button" className="link-inline small exp-voir-le-paquet" aria-haspopup="dialog" onClick={() => setPaquet(true)}>
          {`Ton paquet · ${sonPaquet.length} cartes`}
          <Icon name="chevron-right" />
        </button>
      )}
      {ouverte > 0 && <ChoixDeLAscension ouverte={ouverte} cran={cran} onChoisir={setCran} />}
      <section className="card exp-passeport" aria-labelledby="exp-passeport-titre">
        <div className="exp-section-tete">
          <h2 className="label" id="exp-passeport-titre">
            Ton passeport
          </h2>
          <button type="button" className="link-inline small exp-ouvrir" aria-haspopup="dialog" onClick={() => setPasseport(true)}>
            Ouvrir
            <Icon name="chevron-right" />
          </button>
        </div>
        <p className="exp-passeport-compte">
          <Icon name="tampon" />
          <b>{formatNumber(tampons)}</b>
          {` tampon${tampons > 1 ? 's' : ''} sur ${formatNumber(TAMPONS_DU_PASSEPORT)}`}
        </p>
      </section>
      {/* Le codex des cartes, aux rencontres : toutes les cartes de l'expédition, de la commune à la légendaire ; son niveau d'explorateur et ce qu'il en a. */}
      {enRencontres && (
        <section className="card exp-codex-du-depart" aria-labelledby="exp-codex-titre">
          <div className="exp-section-tete">
            <h2 className="label" id="exp-codex-titre">
              Ton codex
            </h2>
            <button type="button" className="link-inline small exp-ouvrir" aria-haspopup="dialog" onClick={() => setCodex(true)}>
              Ouvrir
              <Icon name="chevron-right" />
            </button>
          </div>
          {codex && <NiveauDExplorateur renommee={codex.renommee} />}
          <p className="exp-passeport-compte">
            <Icon name="book" />
            <b>{formatNumber(codex ? codex.cartes.length : cartesDuCodex)}</b>
            {codex ? ` cartes sur ${formatNumber(cartesDuCodex)}` : ' cartes'}
          </p>
          {/* Ses dos de cartes, là où il en a plusieurs : celui qui partira habille sa pioche sur le plan. */}
          {!vue && codex && <ChoixDuDos siens={codex.dos} dos={dos} onChoisir={setDos} />}
        </section>
      )}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <div className="exp-depart-pied">
        {vue ? (
          <>
            <p className="muted small centre">
              {`Acte ${Math.min(vue.acte, ACTES - 1) + 1}${vue.cartes?.ascension ? ` · Ascension ${vue.cartes.ascension}` : ''} · ${vue.courage !== undefined ? `${vue.courage} de courage sur ${COURAGE_MAX}` : `${vue.vies} vie${vue.vies > 1 ? 's' : ''} sur ${VIES}`} · ${vue.justes} bonne${vue.justes > 1 ? 's' : ''} réponse${vue.justes > 1 ? 's' : ''}`}
            </p>
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => onReprendre(vue)}>
              <Icon name="play" />
              Reprendre
            </button>
            {/* Discret sous « Reprendre », et confirmé : un toucher perdu ne coûte pas l'expédition. */}
            <button type="button" className="link-inline small exp-abandonner" aria-disabled={busy || undefined} onClick={() => !busy && onAbandonner(vue)}>
              Abandonner cette expédition
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary btn-big btn-block"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (ouvertes) retenirLaFetiche(fetiche)
                if (enRencontres && dos) retenirLeDos(dos)
                if (enRencontres && style) retenirLeStyle(style)
                if (ouverte > 0) retenirLAscension(cran, ouverte)
                // Sa catégorie fétiche attend son niveau, et l'Érudit : sans lui, elle ne part pas. Son cran, ceux qu'il a ouverts.
                onPartir(
                  equipee,
                  enRencontres
                    ? { style, fetiche: feticheDuDepart, dos, ascension: ouverte > 0 ? Math.min(cran, ouverte) : 0, ...(v >= VERSION_DE_LA_QUESTION_AU_CENTRE && { questionAuCentre: true }) }
                    : null,
                )
              }}
            >
              <Icon name="flag" />
              Partir
            </button>
          </>
        )}
      </div>
      {choisir && <FeuilleDeLEquipee prochaine={page.prochaine} equipee={equipee} rencontres={enRencontres} onChoisir={setEquipee} onFermer={() => setChoisir(false)} />}
      {passeport && <FeuilleDuPasseport tampons={page.passeport} onFermer={() => setPasseport(false)} />}
      {paquet && sonPaquet && <FeuilleDesCartes paquet={sonPaquet} ascension={ouverte > 0 ? cran : 0} onFermer={() => setPaquet(false)} />}
      {voirLeCodex && <FeuilleDuCodex codex={codex} onFermer={() => setCodex(false)} />}
      {regles && (
        <FeuilleDesRegles
          rencontres={enRencontres}
          parQuestion={vue?.cartes?.parQuestion ?? (enRencontres ? CARTES_DES_ACTES : undefined)}
          codex={vue ? vue.cartes?.codex : enRencontres ? codex : undefined}
          ascension={vue ? vue.cartes?.ascension : ouverte > 0 ? cran : undefined}
          energie={vue?.cartes?.energie}
          v={vue?.cartes?.v ?? (enRencontres ? v : undefined)}
          acte={vue?.acte}
          debut="expedition"
          onFermer={() => setRegles(false)}
        />
      )}
    </div>
  )
  // Ses pièces — le style, l'Ascension, le codex, le paquet — se lisent à sa version.
  return <VersionDesCartes.Provider value={v}>{ecranDuDepart}</VersionDesCartes.Provider>
}

/** Les tampons d'un passeport complet : un par sujet de l'onglet des thèmes. */
const TAMPONS_DU_PASSEPORT = passeportParFamille([]).reduce((n, f) => n + f.sujets.length, 0)

/** « d’Halloween », « de Noël », « du Nouvel An » : une saison après « la saison ». */
const DE_LA_SAISON: Readonly<Record<string, string>> = { halloween: 'd’Halloween', noel: 'de Noël', 'nouvel-an': 'du Nouvel An' }

/**
 * La saison d'un départ (le 18 octobre 2026) : sa fête plus souvent sur les
 * cartes, et son légendaire au bout de l'acte 3 quand il le garde — en
 * expédition, la seule porte vers lui, ouverte à sa saison seulement. En
 * route, celle qu'elle a eue à son départ.
 */
function BandeauDeLaSaison({ saison: s, gardiens, enRoute }: { saison: Saison; gardiens: readonly string[]; enRoute: boolean }) {
  const garde = gardiens[ACTES - 1] === s.legendaire
  const fete = sujetParCle(s.key)
  const elle = gardienAuFeminin(s.legendaire)
  const tete = enRoute ? `Partie à la saison ${DE_LA_SAISON[s.key]}` : `La saison ${DE_LA_SAISON[s.key]}, ${s.periode}`
  const suite = garde ? `, et ${leGardien(s.legendaire)} garde l’acte 3 : en expédition, ${elle ? 'elle' : 'il'} ne se gagne qu’à sa saison` : ''
  return (
    <p className="card exp-saison">
      <Icon name={fete ? iconeDuSujet(fete) : 'sparkles'} />
      <span>{espacesFines(`${tete} : ses escales reviennent plus souvent sur ${enRoute ? 'ton plan' : 'tes plans'}${suite}.`)}</span>
    </p>
  )
}

/**
 * Son passeport (le 18 octobre 2026) : chaque thème pointu de l'expédition,
 * famille par famille — tamponné, son emblème en couleur ; à trouver, en
 * creux. Une famille complète le dit. Le Globe-trotter compte les tampons.
 */
function FeuilleDuPasseport({ tampons, onFermer }: { tampons: readonly string[]; onFermer: () => void }) {
  const familles = passeportParFamille(tampons)
  const tenus = familles.reduce((n, f) => n + f.tamponnes, 0)
  const globe = hautFait('hf:globe-trotter')
  const paliers = globe?.famille === 'carriere' ? globe.paliers : null
  return (
    <Feuille titre="Ton passeport" className="feuille-passeport" onFermer={onFermer}>
      <p className="muted small">
        {espacesFines(
          `${formatNumber(tenus)} tampon${tenus > 1 ? 's' : ''} sur ${formatNumber(TAMPONS_DU_PASSEPORT)}. Trouve une escale d’un thème pointu : son tampon est à toi. Sur le plan, ceux qui te manquent le disent.`,
        )}
      </p>
      {familles.map(f => (
        <section key={f.famille} className="exp-passeport-famille" aria-labelledby={`passeport-${f.famille}`}>
          <h3 className="label" id={`passeport-${f.famille}`}>
            {`${f.nom} · ${f.tamponnes} / ${f.sujets.length}`}
            {f.tamponnes === f.sujets.length && <span className="exp-pastille exp-pastille-or">complet</span>}
          </h3>
          <ul className="exp-tampons">
            {f.sujets.map(x => {
              const sujet = sujetParCle(x.cle)
              return (
                <li key={x.cle} className={'exp-tampon-case' + (x.tamponne ? ' exp-tamponne' : '')}>
                  <Icon name={sujet ? iconeDuSujet(sujet) : 'star'} />
                  <span>{x.nom}</span>
                  <span className="sr-only">{x.tamponne ? ', tamponné' : ', à trouver'}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {paliers && (
        <p className="muted small">{espacesFines(`Le Globe-trotter, ton trophée : bronze à ${paliers[0]} tampons, argent à ${paliers[1]}, or à ${paliers[2]}.`)}</p>
      )}
    </Feuille>
  )
}

/** « Le Phénix » sous un médaillon : le nom sans son article, qui tient sous quatre-vingts pixels. */
const nomCourt = (cle: string) => nomDuGardien(cle).replace(/^(Le|La|Les) /, '').replace(/^L’/, '')

/** Le médaillon d'un légendaire de l'équipée ; l'invité du jour qu'il n'a pas, son ruban dessous — que `DitInvite` dit à l'oreille, après son nom. */
function MedaillonDeLEquipee({ cle, invite }: { cle: string; invite: boolean }) {
  return (
    <span className="exp-medaillon-ruban" aria-hidden="true">
      <Medaillon cle={cle} className="exp-medaillon" />
      {invite && <span className="exp-ruban">{gardienAuFeminin(cle) ? 'invitée' : 'invité'}</span>}
    </span>
  )
}

const DitInvite = ({ cle }: { cle: string }) => <span className="sr-only">{gardienAuFeminin(cle) ? ', invitée du jour' : ', invité du jour'}</span>

/**
 * Les deux places de l'équipée : le médaillon de chacun et son joker, ou une
 * place libre. `siens` : ceux qu'il a — l'invité du jour qui n'en est pas le
 * dit ; null, l'équipée d'une expédition en route, qui le dit d'elle-même.
 */
function Places({ equipee, invite, siens, rencontres }: { equipee: readonly string[]; invite?: string; siens: readonly string[] | null; rencontres?: boolean }) {
  return (
    <ul className="exp-places">
      {Array.from({ length: PLACES_DE_L_EQUIPEE }, (_, k) => {
        const cle = equipee[k]
        if (!cle) {
          return (
            <li key={k} className="exp-place exp-place-libre">
              Une place libre
            </li>
          )
        }
        const invitee = siens !== null && cle === invite && !siens.includes(cle)
        return (
          <li key={cle} className="exp-place">
            <MedaillonDeLEquipee cle={cle} invite={invitee} />
            <span className="exp-place-texte">
              <b>{nomCourt(cle)}</b>
              {invitee && <DitInvite cle={cle} />}
              <span className="exp-place-joker">{(rencontres ? carteDuLegendaire(cle) : jokerDuLegendaire(cle))?.nom}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * La feuille de l'équipée (la maquette 2) : ses deux places, les légendaires
 * qu'il peut emmener — l'invité du jour d'abord, s'il ne l'a pas —, la fiche
 * du dernier touché et son joker ; tous les jokers de l'expédition, dépliés à
 * la demande. Un toucher emmène ou laisse ; un troisième prend la place du
 * premier. Rien ne change avant « Choisir ».
 */
export function FeuilleDeLEquipee({
  prochaine,
  equipee,
  rencontres,
  onChoisir,
  onFermer,
}: {
  prochaine: PageDeLExpedition['prochaine']
  equipee: readonly string[]
  /** Aux rencontres, chacun apporte sa carte et sa famille, pas son joker. */
  rencontres?: boolean
  onChoisir: (equipee: string[]) => void
  onFermer: () => void
}) {
  const [choisis, setChoisis] = useState<string[]>(() => [...equipee])
  const [vu, setVu] = useState(() => equipee[0] ?? prochaine.invite)
  const [tous, setTous] = useState(false)
  const siens = new Set(prochaine.equipables)
  const liste = [...(siens.has(prochaine.invite) ? [] : [prochaine.invite]), ...prochaine.equipables]
  const toucher = (cle: string) => {
    setVu(cle)
    setChoisis(c => (c.includes(cle) ? c.filter(x => x !== cle) : c.length < PLACES_DE_L_EQUIPEE ? [...c, cle] : [...c.slice(1), cle]))
  }
  const j = jokerDuLegendaire(vu)
  const carte = rencontres ? carteDuLegendaire(vu) : undefined
  const statut = choisis.includes(vu) ? 'Dans ton équipe' : !siens.has(vu) ? (gardienAuFeminin(vu) ? 'Invitée du jour' : 'Invité du jour') : 'Touche pour l’emmener'
  return (
    <Feuille
      titre="Ton équipe"
      className="feuille-equipee"
      onFermer={onFermer}
      pied={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            onChoisir(choisis)
            onFermer()
          }}
        >
          {choisis.length > 0 ? `Choisir · ${choisis.map(leGardien).join(' et ')}` : 'Partir sans équipe'}
        </button>
      }
    >
      <p className="muted small">
        {espacesFines(
          rencontres
            ? 'Deux places : chacun glisse sa carte dans ton paquet, et sa famille dans tes récompenses — les cartes que tes victoires et tes coffres proposent.'
            : 'Deux places : chacun glisse son joker dans ton paquet, avec tes jokers de départ — Coup d’œil trois fois, Échange.',
        )}
      </p>
      <Places equipee={choisis} invite={prochaine.invite} siens={prochaine.equipables} rencontres={rencontres} />
      <h3 className="label">{prochaine.equipables.length > 0 ? 'Tes légendaires à joker' : 'L’invité du jour'}</h3>
      <div className="exp-equipables">
        {liste.map(cle => (
          <button key={cle} type="button" className="exp-equipable" aria-pressed={choisis.includes(cle)} onClick={() => toucher(cle)}>
            <MedaillonDeLEquipee cle={cle} invite={!siens.has(cle)} />
            <span className="exp-equipable-nom">{nomCourt(cle)}</span>
            {!siens.has(cle) && <DitInvite cle={cle} />}
          </button>
        ))}
      </div>
      {prochaine.equipables.length === 0 && (
        <p className="muted small">
          {espacesFines('Tu n’as pas encore de légendaire à joker : l’invité du jour part avec toi. Garde un gardien au bout d’une expédition, et son joker sera de la suivante.')}
        </p>
      )}
      {carte ? (
        <section className="exp-fiche" aria-live="polite">
          <div className="exp-fiche-tete">
            <b className="exp-gardien-nom">{nomDuGardien(vu)}</b>
            <span className="small exp-statut">{statut}</span>
          </div>
          <span className="label exp-surtitre">{`Sa carte · ${carte.nom} · ${FAMILLES_DE_CARTES[carte.famille].nom}`}</span>
          <p>{espacesFines(carte.effet)}</p>
          <span className="muted small">{espacesFines(origineDeLaCarte(carte))}</span>
        </section>
      ) : (
        j && (
          <section className="exp-fiche" aria-live="polite">
            <div className="exp-fiche-tete">
              <b className="exp-gardien-nom">{nomDuGardien(vu)}</b>
              <span className="small exp-statut">{statut}</span>
            </div>
            <span className="label exp-surtitre">{`Son joker · ${j.nom}`}</span>
            <p>{espacesFines(j.effet)}</p>
            <span className="muted small">{SORTE[j.sorte]}</span>
          </section>
        )
      )}
      <button type="button" className="link-inline small exp-tous" aria-expanded={tous} aria-controls={rencontres ? 'exp-toutes-les-cartes' : 'exp-tous-les-jokers'} onClick={() => setTous(!tous)}>
        {rencontres ? `Les ${CARTES_DES_RENCONTRES.length} cartes des rencontres` : `Les ${JOKERS_SANS_LEGENDAIRE.length + JOKERS_DES_LEGENDAIRES.length} jokers de l’expédition`}
        <Icon name="chevron-down" />
      </button>
      {/* Replié, il ne se rend pas : trente-deux fiches pour qui ne les demande pas (règle `client.md`). */}
      {tous && (rencontres ? <ToutesLesCartes siens={siens} invite={prochaine.invite} /> : <TousLesJokers siens={siens} invite={prochaine.invite} />)}
    </Feuille>
  )
}

/**
 * Tous les jokers de l'expédition (la maquette 10) : ceux de départ et des
 * offres, puis ceux des légendaires — à lui, l'invité du jour, ou à gagner.
 * C'est là qu'un profil sans légendaire voit ce qu'il irait chercher.
 */
function TousLesJokers({ siens, invite }: { siens: ReadonlySet<string>; invite: string }) {
  const ligne = (j: Joker, dit?: string) => (
    <li key={j.cle} className="exp-joker-du-catalogue">
      <VisageDuJoker j={j} />
      <span className="exp-joker">
        <b>{j.nom}</b>
        <span className="muted small">{`${j.legendaire ? `${nomDuGardien(j.legendaire)} · ` : ''}${SORTE_COURTE[j.sorte]} · ${RARETE[j.rarete]}${dit ? ` · ${dit}` : ''}`}</span>
        <span className="small">{espacesFines(j.effet)}</span>
      </span>
    </li>
  )
  return (
    <div id="exp-tous-les-jokers" className="exp-catalogue">
      <h3 className="label">Au départ et dans les coffres</h3>
      <ul>{JOKERS_SANS_LEGENDAIRE.map(j => ligne(j, PAQUET_DE_DEPART.includes(j.cle) ? 'de départ' : undefined))}</ul>
      <h3 className="label">Ceux des légendaires</h3>
      <ul>
        {JOKERS_DES_LEGENDAIRES.map(j =>
          ligne(j, siens.has(j.legendaire!) ? 'à toi' : j.legendaire === invite ? 'l’invité du jour' : 'à gagner au bout d’une expédition'),
        )}
      </ul>
    </div>
  )
}

// ── La carte d'un acte ──────────────────────────────────────────────────────
//
// Six étages de quatre colonnes, deux campements, le gardien en haut ; on
// part d'en bas. L'écran de la carte (revu le 18 octobre 2026, « ça serait
// possible que ce soit de vrais cartes en bas ? ») : l'acte en petit en haut,
// tout entier, pour voir où l'on est (`PetitPlan`) ; en bas, les escales où
// l'on peut aller, en cartes (`CarteDEscale`), puis « Y aller ». Le plan
// s'ouvrait en grand dans sa feuille ; depuis le 19 octobre 2026, ses escales
// se touchent sur place, et ce qu'elles cachent se lit sous les cartes.

/** Les colonnes en pour cent de la largeur : le plan tient tout écran de téléphone. */
const COLONNES_X = [12.5, 37.5, 62.5, 87.5]
/** Le point de départ, en bas de la carte : pas une escale, d'où partent les liens du premier étage. */
const DEPART = '·'

/**
 * L'acte en petit : ses rangées en pour cent de la hauteur du plan, qu'il
 * prend de ce que le panneau lui laisse — l'acte entier tient en 180 pixels
 * en 360 × 640, et grandit sur un écran plus haut.
 */
const EN_PETIT = { gardien: 9, campement: 22, haut: 33, pas: 10.6, depart: 95 }

function enPetit(e: EscaleDeLaCarte): { x: number; y: number } {
  if (e.sorte === 'gardien') return { x: 50, y: EN_PETIT.gardien }
  if (e.sorte === 'campement') return { x: e.colonne === 0 ? 25 : 75, y: EN_PETIT.campement }
  return { x: COLONNES_X[e.colonne] ?? 50, y: EN_PETIT.haut + (ETAGES - 1 - e.etage) * EN_PETIT.pas }
}

/** Les pas d'un chemin, deux à deux : « a→b ». */
const pas = (chemin: readonly string[]) => new Set(chemin.slice(1).map((id, i) => `${chemin[i]}→${id}`))

/**
 * La plus sûre des escales proposées : le premier pas du tracé le plus sûr
 * d'ici au campement, que la carte ne dessine plus (le 18 octobre 2026). Sous
 * Le détour ou Le raccourci, le pas suivant ne suit plus les liens : le tracé
 * part de chacune des escales permises, et la meilleure l'emporte.
 */
function laPlusSureDesProposees(carte: CarteDUnActe, vue: Pick<VueDeLExpedition, 'ici' | 'vies' | 'acte' | 'permises' | 'route'>): string | null {
  if (!vue.route?.detour && !vue.route?.raccourci) return traceLePlusSur(carte, vue.ici, vue.vies, vue.acte)[0] ?? null
  let meilleur: { id: string; vaincre: number } | null = null
  for (const id of vue.permises) {
    if (id === GARDIEN) continue
    // Le premier pas ne se relit pas aux liens : il part d'une escale permise, d'où les liens reprennent.
    const t = traceLePlusSur(carte, vue.ici, vue.vies, vue.acte, { debut: [id] })
    if (t.length === 0) continue
    const { vaincre } = chancesDuTrace(carte, t, vue.vies, vue.acte)
    if (!meilleur || vaincre > meilleur.vaincre + 1e-9) meilleur = { id, vaincre }
  }
  return meilleur?.id ?? null
}

/** Ce que la carte est pour lui, lu une fois pour le plan, ses cartes et sa feuille. */
interface LectureDeLaCarte {
  parId: ReadonlyMap<string, EscaleDeLaCarte>
  /** Où il peut encore aller : par les liens d'ici, et — Le détour, Le raccourci — par chaque escale permise. */
  atteignables: ReadonlySet<string>
  /** Les escales permises, de gauche à droite comme sur le plan : l'ordre de leurs cartes. */
  proposees: readonly string[]
}

function lireLaCarte(carte: CarteDUnActe, vue: Pick<VueDeLExpedition, 'ici' | 'permises'>): LectureDeLaCarte {
  const parId = new Map(carte.escales.map(e => [e.id, e]))
  const atteignables = escalesAtteignables(carte, vue.ici)
  for (const id of vue.permises) {
    atteignables.add(id)
    for (const x of escalesAtteignables(carte, id)) atteignables.add(x)
  }
  const ou = (id: string) => enPetit(parId.get(id)!)
  const proposees = vue.permises.filter(id => parId.has(id)).sort((a, b) => ou(a).x - ou(b).x || ou(b).y - ou(a).y)
  return { parId, atteignables, proposees }
}

/**
 * L'état d'une escale, en classes, sur le plan comme en grand : une seule
 * brille, celle où il est ; les proposées s'entourent, la touchée en or ; le
 * reste attend en retrait — sauf le gardien, le but de l'acte.
 */
function etatDeLEscale(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'ici' | 'trace'>, lecture: LectureDeLaCarte, retenue: string | null) {
  const ici = e.id === vue.ici
  const passee = vue.trace.includes(e.id) && !ici
  const proposee = lecture.proposees.includes(e.id)
  const loin = !ici && !passee && !proposee && !lecture.atteignables.has(e.id)
  const classes = [`exp-${e.sorte}`]
  if (ici) classes.push('exp-ici')
  else if (passee) classes.push('exp-passee')
  // Pas `exp-proposee` : c'est la réponse proposée d'un vrai ou faux, et sa règle faisait des escales des cartes carrées.
  else if (proposee) classes.push('exp-a-portee')
  else if (loin) classes.push('exp-loin')
  else if (e.sorte !== 'gardien') classes.push('exp-plus-loin')
  if (e.id === retenue) classes.push('exp-choisie')
  if (e.contenu === 'piege') classes.push('exp-piege')
  return { classes, ici, passee, proposee, loin }
}

type Point = { x: number; y: number }

/**
 * Les liens d'un plan : faits, en vie — ils mènent encore quelque part —, ou
 * morts, presque effacés. D'ici vers une escale proposée, ils se tracent à
 * part, par-dessus : sous Le détour ou Le raccourci, le pas suivant ne suit
 * plus les liens, et le seul trait qui s'éclaire est celui du pas choisi.
 */
function liensDuPlan(
  carte: CarteDUnActe,
  vue: Pick<VueDeLExpedition, 'ici' | 'trace'>,
  lecture: LectureDeLaCarte,
  retenue: string | null,
  ou: (id: string) => Point,
): { de: Point; a: Point; cle: string; sorte?: string }[] {
  const faits = pas([DEPART, ...vue.trace])
  const depuis = vue.ici ?? DEPART
  const liens: { de: Point; a: Point; cle: string; sorte?: string }[] = []
  const lier = (de: string, a: string) => {
    const cle = `${de}→${a}`
    if (de === depuis && lecture.proposees.includes(a)) return
    const enVie = (de === depuis || lecture.atteignables.has(de)) && lecture.atteignables.has(a)
    liens.push({ de: ou(de), a: ou(a), cle, sorte: faits.has(cle) ? 'lien-fait' : enVie ? undefined : 'lien-mort' })
  }
  for (const id of carte.depart) lier(DEPART, id)
  for (const e of carte.escales) for (const id of e.suite) if (lecture.parId.has(id)) lier(e.id, id)
  for (const id of lecture.proposees) liens.push({ de: ou(depuis), a: ou(id), cle: `${depuis}⇢${id}`, sorte: id === retenue ? 'lien-propose lien-choisi' : 'lien-propose' })
  return liens
}

/** Un gain d'une carte d'escale : son dessin, un nombre ; ce qu'il dit, sa description le dit déjà. */
type Gain = { cle: string; dessin: ReactNode; texte: string; vie?: boolean }

/**
 * Ce qu'une carte d'escale montre : sa sorte, son nom — le thème d'une
 * question, ce que donne une autre escale —, et ce qu'elle rapporte trouvée,
 * ou coûte : des écus, un joker, une vie, un tampon.
 */
function faceDeLEscale(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'acte' | 'gardiens' | 'ecus' | 'jokers' | 'cartes'>): { sorte: string; nom: string; gains: Gain[] } {
  const enEcus = (n: number): Gain[] => (vue.ecus === undefined ? [] : [{ cle: 'ecus', dessin: <Icon name="ecu" />, texte: `+${n}` }])
  // Aux rencontres, ce que rend une source, un campement — ce que prend un piège — est du courage.
  const v5 = !!vue.cartes
  const vie = (texte: string): Gain => ({ cle: 'vie', dessin: <Icon name="heart" />, texte, vie: true })
  const joker: Gain[] = vue.jokers || v5 ? [{ cle: 'joker', dessin: <i className="exp-glyphe-joker" />, texte: '+1' }] : []
  const tampon: Gain[] = e.aTamponner ? [{ cle: 'tampon', dessin: <Icon name="tampon" />, texte: '' }] : []
  // Une escale sans chance dite — sous L'écholocation — ne dit pas non plus ses écus : ils en dépendent.
  const prix = e.chance === undefined ? [] : enEcus(prixDeLEscale(e))
  // Son cran de l'Ascension : un repos y rend moins.
  const cran = vue.cartes?.ascension ?? 0
  switch (e.sorte) {
    case 'question':
      return { sorte: v5 ? 'Rencontre' : 'Question', nom: nomCourtDuTheme(e.theme), gains: [...prix, ...tampon] }
    case 'elite':
      return { sorte: 'Élite', nom: nomCourtDuTheme(e.theme), gains: [...joker, ...prix, ...tampon] }
    case 'source':
      return { sorte: 'Source', nom: 'Ton carnet', gains: [vie(v5 ? `+${soinALAscension(COURAGE_D_UNE_SOURCE, vue.cartes?.v ?? 0, cran)}` : '+1')] }
    case 'curiosite':
      return { sorte: 'Curiosité', nom: NOM_DE_LA_CURIOSITE[e.curiosite ?? 'plat'], gains: joker }
    case 'campement':
      return { sorte: 'Campement', nom: 'Le repos', gains: [vie(v5 ? `+${soinALAscension(COURAGE_D_UN_CAMPEMENT, vue.cartes?.v ?? 0, cran)}` : '+1')] }
    case 'coffre':
      return { sorte: 'Coffre', nom: v5 ? 'Une carte au choix' : 'Un joker au choix', gains: joker }
    case 'echoppe':
      return { sorte: 'Échoppe', nom: 'Contre tes écus', gains: [] }
    case 'inconnu':
      if (e.contenu === 'piege') return { sorte: 'Inconnu', nom: 'Un piège', gains: [vie(v5 ? `−${COURAGE_D_UN_PIEGE}` : '−1')] }
      if (e.contenu === 'marchand') return { sorte: 'Inconnu', nom: 'Un marchand', gains: [] }
      if (e.contenu === 'passage') return { sorte: 'Inconnu', nom: 'De passage', gains: joker }
      return { sorte: 'Inconnu', nom: 'Qui sait ?', gains: [] }
    case 'gardien': {
      const g = vue.gardiens[vue.acte]?.cle ?? ''
      return { sorte: 'Gardien', nom: nomDuGardien(g), gains: [...enEcus(ECUS_D_UN_GARDIEN), ...((v5 ? carteDuLegendaire(g) : jokerDuLegendaire(g)) ? joker : [])] }
    }
  }
  return { sorte: 'Escale', nom: etiquette(e, vue.acte, vue.gardiens), gains: [] }
}

/**
 * Une escale proposée, en carte (le 18 octobre 2026, « de vrais cartes en
 * bas ») : sa sorte, son emblème, son nom, sa chance et ce qu'elle rapporte.
 * Touchée, elle se lève, cerclée d'or — son escale aussi, sur le plan —, et
 * « Y aller » la nomme ; la plus sûre porte son ruban. Sa description dit le
 * reste, à l'oreille : sa marche, à qui est la chance, son tampon.
 */
function CarteDEscale({
  e,
  vue,
  carte,
  chance,
  choisie,
  sure,
  onToucher,
}: {
  e: EscaleDeLaCarte
  vue: VueDeLExpedition
  carte: CarteDUnActe
  chance: number | undefined
  choisie: boolean
  sure: boolean
  onToucher: () => void
}) {
  const face = faceDeLEscale(e, vue)
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  // En rencontres, moins de mots (la revue du 18 octobre 2026, « trop de détails écrits en dessous de chaque icône ») : seules
  // l'élite et le gardien disent leur sorte, et une escale sans adversaire se nomme d'un mot. Sa description dit le reste.
  const v5 = !!vue.cartes
  const sansAdversaire = e.sorte !== 'question' && e.sorte !== 'elite' && e.sorte !== 'gardien'
  // Une curiosité (v12) dit sa sorte et ce qu'elle demande : un plat ou un rébus, c'est ce qu'on choisit en la prenant.
  const curiosite = e.sorte === 'curiosite'
  const sorte = !v5 || (!sansAdversaire && e.sorte !== 'question') || curiosite ? face.sorte : null
  const nom = !v5 || !sansAdversaire || curiosite ? face.nom : e.sorte === 'inconnu' ? (e.contenu ? face.nom : 'Inconnu') : face.sorte
  // Un mélange montre ses catégories, chacune son emblème (le 19 octobre 2026 : « on ne peut pas voir le mélange » sans ouvrir le plan).
  const melange = categoriesDuMelange(e)
  return (
    <button
      type="button"
      className={`exp-carte-escale exp-${e.sorte}` + (e.contenu === 'piege' ? ' exp-piege' : '')}
      data-escale={e.id}
      // Son nom ne bouge pas : « choisie » passe par aria-pressed, « la plus sûre » par la description (`design.test.ts`).
      aria-label={decrire(e, vue, carte)}
      aria-pressed={choisie}
      aria-describedby={sure ? 'exp-dit-sure' : undefined}
      onClick={onToucher}
    >
      {sure && (
        <span className="exp-la-plus-sure" aria-hidden="true">
          la plus sûre
        </span>
      )}
      {sorte && (
        <span className="exp-carte-sorte" aria-hidden="true">
          {sorte}
        </span>
      )}
      <span className={'exp-carte-embleme' + (melange.length > 0 ? ' exp-embleme-melange' : '')} aria-hidden="true">
        {e.sorte === 'gardien' ? (
          <Medaillon cle={gardien} className="exp-medaillon" />
        ) : melange.length > 0 ? (
          melange.map(c => <Icon key={c} name={EMBLEME[c] ?? 'help'} />)
        ) : (
          <Icon name={iconeDe(e)} />
        )}
      </span>
      <b className="exp-carte-nom" aria-hidden="true">
        {nom}
      </b>
      {(chance !== undefined || face.gains.length > 0) && (
        <span className="exp-carte-pied" aria-hidden="true">
          {chance !== undefined && (
            <span className="exp-carte-chance">
              <Balise couleur={couleurDePiste(chance)} />
              {pourcents(chance)}
            </span>
          )}
          {face.gains.map(g => (
            <span key={g.cle} className={'exp-carte-gain' + (g.vie ? ' exp-gain-vie' : '')} data-gain={g.cle}>
              {g.dessin}
              {g.texte}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

/**
 * Le plan de l'acte, en haut de l'écran (le 18 octobre 2026, « la carte reste
 * en haut, en petit et épurée, pour voir où tu es ») : tout l'acte d'un coup
 * d'œil — l'escale où il est, qui brille ; celles qu'il peut prendre,
 * entourées, la touchée en or ; le gardien au bout. Chaque escale s'y touche
 * (le 19 octobre 2026, « une fusion entre carte et l'interface, car là le zoom
 * est séparé ») : ce qu'elle cache se lit sous les cartes, et une escale
 * permise se choisit comme sa carte. Plus de feuille où l'ouvrir en grand.
 */
function PetitPlan({
  vue,
  carte,
  lecture,
  retenue,
  regardee,
  onToucher,
}: {
  vue: VueDeLExpedition
  carte: CarteDUnActe
  lecture: LectureDeLaCarte
  retenue: string | null
  regardee: string | null
  onToucher: (id: string) => void
}) {
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const ou = (id: string) => (id === DEPART ? { x: 50, y: EN_PETIT.depart } : enPetit(lecture.parId.get(id)!))
  return (
    <div className="exp-petit-plan">
      <svg className="exp-liens" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {liensDuPlan(carte, vue, lecture, retenue, ou).map(l => (
          <line key={l.cle} className={l.sorte} x1={l.de.x} y1={l.de.y} x2={l.a.x} y2={l.a.y} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <span className={'exp-petit-depart' + (vue.ici === null ? ' exp-ici' : '')} style={{ top: `${EN_PETIT.depart}%` }} aria-hidden="true">
        <Icon name="flag" />
        Départ
      </span>
      <span id="exp-dit-passee" hidden>
        Tu y es déjà passé
      </span>
      <span id="exp-dit-proposee" hidden>
        Tu peux y aller
      </span>
      {carte.escales.map(e => {
        const { x, y } = enPetit(e)
        const etat = etatDeLEscale(e, vue, lecture, retenue)
        const classes = ['exp-point', ...etat.classes]
        // Celle que la ligne du dessous décrit, touchée hors des proposées : sur le plan aussi, on voit laquelle.
        if (e.id === regardee && !etat.proposee && !etat.ici) classes.push('exp-regardee')
        return (
          <button
            key={e.id}
            type="button"
            className={classes.join(' ')}
            data-escale={e.id}
            style={{ left: `${x}%`, top: `${y}%` }}
            // Son nom ne bouge pas : « choisie » passe par aria-pressed, « tu es ici » par aria-current, « déjà
            // passée » et « tu peux y aller » par la description — dans le nom, l'état se lisait deux fois (`design.test.ts`).
            aria-label={decrire(e, vue, carte)}
            aria-pressed={etat.proposee ? e.id === retenue : undefined}
            aria-current={etat.ici ? 'location' : undefined}
            aria-describedby={etat.passee ? 'exp-dit-passee' : etat.proposee ? 'exp-dit-proposee' : undefined}
            onClick={() => onToucher(e.id)}
          >
            {e.sorte === 'gardien' ? <Medaillon cle={gardien} className="exp-medaillon" /> : <Icon name={etat.passee ? 'check' : iconeDe(e)} />}
            {/* Un thème pointu que son passeport n'a pas : un point d'or, son tampon l'attend. */}
            {e.aTamponner && !etat.loin && !etat.passee && <i className="exp-point-tampon" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Une escale en une ligne, sous les cartes : ce que sa carte ne dit pas. Une
 * question, son thème entier — un mélange, ses catégories, en noms courts —,
 * sa marche et, en rencontres, les points à faire perdre ; sa chance, ses
 * écus et sa récompense sont sur sa carte. Plus longue, elle prenait au plan
 * sa dernière place : sous une élite, en 360 × 640, ses escales se
 * chevauchaient. Les autres escales, leur phrase, sans chance.
 */
function enUneLigne(e: EscaleDeLaCarte, vue: VueDeLExpedition, carte: CarteDUnActe): string {
  if (e.sorte !== 'question' && e.sorte !== 'elite') return decrire(e, vue, carte, true)
  const t = e.theme
  const theme = !t ? 'Une question' : 'sujet' in t ? `Thème pointu : ${nomDuTheme(t)}` : t.categories.length > 1 ? `Mélange : ${enumerer(t.categories.map(c => COURT[c] ?? c))}` : nomDuTheme(t)
  const points = vue.cartes ? ` : ${aFaireTomber(vue, e.sorte, Math.min(vue.acte, ACTES - 1), vue.cartes.ascension ?? 0)}` : ''
  // Plus loin, son tampon n'est qu'un point d'or sur le plan : la ligne le dit.
  const tampon = e.aTamponner ? ' · un tampon neuf' : ''
  return `${e.sorte === 'elite' ? 'Élite · ' : ''}${theme} · ${MARCHE[marcheDe(vue.acte, e)]}${points}${tampon}`
}

/**
 * Ce que dit l'escale touchée — sur le plan ou en carte —, sous les cartes :
 * ce que disait le pied de la feuille du plan, dans la page. Un mélange y
 * nomme ses catégories.
 */
function ceQueDitLEscale(x: EscaleDeLaCarte | undefined, vue: VueDeLExpedition, carte: CarteDUnActe, lecture: LectureDeLaCarte): { titre: string; texte: string } {
  if (!x) return { titre: 'Touche une escale', texte: 'sur le plan ou en carte, pour savoir ce qu’elle cache.' }
  // Une proposée se dit sans titre — le panneau s'appelle « Ta prochaine escale ».
  const dit = enUneLigne(x, vue, carte)
  if (x.id === vue.ici) return { titre: 'Tu es ici', texte: dit }
  if (vue.trace.includes(x.id)) return { titre: 'Derrière toi', texte: 'Tu y es déjà passé.' }
  if (lecture.proposees.includes(x.id)) return { titre: '', texte: dit }
  if (x.sorte === 'gardien') return { titre: 'Au bout de l’acte', texte: dit }
  if (!lecture.atteignables.has(x.id)) return { titre: 'Hors de ta route', texte: 'Ta route ne passe plus par cette escale.' }
  return { titre: 'Plus loin sur ta route', texte: dit }
}

/**
 * La carte d'un acte (la maquette 3), revue deux fois le 18 octobre 2026 à la
 * demande du propriétaire : d'abord « uniquement illuminer la node sur
 * laquelle on est et pas tout le chemin », et ne proposer « que les nodes de
 * devant que l'on peut atteindre » ; puis « ça serait possible que ce soit de
 * vrais cartes en bas ? ». L'écran tient en un écran : en haut, l'acte en
 * petit, pour voir où il est ; en bas, collé, le panneau — les escales où il
 * peut aller ensuite (sa suite, ou ce qu'un joker de route ouvre :
 * `permises`), en cartes, la plus sûre à son ruban ; « Y aller », qui ne
 * s'allume qu'une carte touchée ; et sa main, posée au bas de l'écran — les
 * jokers de carte s'y jouent. Seul le pas engage, et le serveur ne vérifie
 * que lui. Puis, le 19 octobre 2026, le plan fondu dans l'écran : ses
 * escales se touchent comme leurs cartes, et l'escale touchée, d'un côté ou
 * de l'autre, se dit sous les cartes — le plan ne s'ouvre plus en grand dans
 * une feuille à part.
 */
export function CarteDeLActe({
  vue,
  carte,
  busy,
  erreur,
  onAvancer,
  onPartir,
  onJouer,
  onEchoppe,
}: {
  vue: VueDeLExpedition
  carte: CarteDUnActe
  busy: boolean
  erreur: string
  onAvancer: (vers: string) => void
  onPartir: () => void
  onJouer: (cle: string, plus?: { categorie?: string; montre?: number }) => void
  /** Il est à une échoppe qu'il a laissée sans avancer : elle se rouvre. */
  onEchoppe?: () => void
}) {
  const lecture = useMemo(() => lireLaCarte(carte, vue), [carte, vue])
  const { parId, proposees } = lecture
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const ici = vue.ici ? parId.get(vue.ici) : undefined
  const auCampement = ici?.sorte === 'campement'
  const m = MARCHES_DES_ACTES[Math.min(vue.acte, ACTES - 1)]
  const pGardien = carte.chanceDuGardien ?? chanceDuJoueurMoyen(m.gardien)
  // L'écholocation : ni chance sur les cartes, ni la plus sûre.
  const aveugle = !!vue.sansChances
  const laPlusSure = useMemo(() => (aveugle || proposees.length < 2 ? null : laPlusSureDesProposees(carte, vue)), [carte, vue, aveugle, proposees.length])
  const [choisie, setChoisie] = useState<string | null>(null)
  // Celle qu'il a touchée, tant qu'il peut y aller — un joker de route joué la retire ; seule proposée, elle l'est d'office.
  const retenue = choisie !== null && proposees.includes(choisie) ? choisie : proposees.length === 1 ? proposees[0] : null
  // La dernière escale touchée, sur le plan ou en carte : la ligne sous les cartes la décrit — sinon celle qu'il a choisie.
  const [regardee, setRegardee] = useState<string | null>(null)
  const toucher = (id: string) => {
    setRegardee(id)
    if (proposees.includes(id)) setChoisie(id)
  }
  const dit = ceQueDitLEscale(parId.get(regardee ?? retenue ?? ''), vue, carte, lecture)
  const [paquet, setPaquet] = useState(false)
  // La question au centre (v10) : la main de l'acte, gardée d'une rencontre à l'autre.
  const acte = mainDeLActe(vue)
  // Aux rencontres, le gardien ne se compte plus en vies : sa chance est celle de chaque question.
  const chanceDe = (e: EscaleDeLaCarte) => (aveugle ? undefined : e.sorte === 'gardien' ? (vue.cartes ? carte.chanceDuGardien : chanceDeVaincre(pGardien, m.aTrouver, vue.vies)) : e.chance)

  return (
    <div className="player-shell expedition exp-carte-page">
      <Barre vue={vue} onPartir={onPartir} />
      <h1 className="exp-titre-acte">
        {`Acte ${vue.acte + 1} · Vers ${leGardien(gardien)}`}
        {/* Son cran de l'Ascension, à chaque pas : ce qu'il ajoute est au « ? » d'en haut. */}
        {vue.cartes?.ascension ? <span className="exp-pastille exp-pastille-or exp-pastille-cran">{`Ascension ${vue.cartes.ascension}`}</span> : null}
      </h1>
      <div className="exp-plan" role="group" aria-label={`Le plan de l’acte ${vue.acte + 1}`}>
        <PetitPlan vue={vue} carte={carte} lecture={lecture} retenue={retenue} regardee={regardee} onToucher={toucher} />
      </div>

      <section className="exp-panneau" aria-labelledby="exp-panneau-titre">
        <div className="exp-panneau-tete">
          <h2 className="label" id="exp-panneau-titre">
            {auCampement ? `${nomDuGardien(gardien)} t’attend` : 'Ta prochaine escale'}
          </h2>
          {/* L'échoppe laissée sans avancer : un lien, pas un bouton de plus — le panneau reste bas. */}
          {onEchoppe && (
            <button type="button" className="link-inline small" onClick={onEchoppe}>
              {vue.inconnu?.contenu === 'marchand' ? 'Le marchand' : 'L’échoppe'}
            </button>
          )}
          {vue.jokers && <Main vue={vue} jokers={vue.jokers} busy={busy} enPetit onJouer={onJouer} />}
          {/* Aux rencontres : ses cartes de route en petit, puis tout son paquet — dans la question au centre (v10), sa main de l'acte
              aussi, qu'il garde d'une rencontre à l'autre, et sa pioche. */}
          {vue.cartes && (
            <MainDeRencontre
              cles={acte ? [...vue.cartes.route, ...acte.main] : vue.cartes.route}
              refus={vue.cartes.refus}
              busy={busy}
              enPetit
              pile={
                acte
                  ? { compte: vue.cartes.pioche ?? 0, mot: 'pioche', dit: `Ta pioche : ${vue.cartes.pioche ?? 0} carte${(vue.cartes.pioche ?? 0) > 1 ? 's' : ''}, ta défausse : ${acte.defausse.length}`, onOuvrir: () => setPaquet(true) }
                  : { compte: vue.cartes.paquet.length, mot: 'paquet', dit: `Ton paquet : ${vue.cartes.paquet.length} carte${vue.cartes.paquet.length > 1 ? 's' : ''}`, onOuvrir: () => setPaquet(true) }
              }
              dos={dosDuPaquet(vue)}
              onJouer={onJouer}
            />
          )}
        </div>
        {/* Une ligne : que chaque erreur lui coûte une vie, ses questions le disent en tête. */}
        {auCampement && (
          <p className="exp-panneau-titre">
            {espacesFines(
              vue.cartes ? `${aFaireTomber(vue, 'gardien', vue.acte, vue.cartes.ascension ?? 0)}, en questions ${MARCHE[m.gardien]}s.`.replace(/^./, x => x.toUpperCase()) : `${regleDuGardien(vue.acte)}.`,
            )}
          </p>
        )}
        {proposees.length === 0 ? (
          <p className="muted small">{espacesFines('Aucune escale ne t’attend : recharge la page.')}</p>
        ) : (
          <div className="exp-cartes-escale">
            {proposees.map(id => {
              const e = parId.get(id)!
              return <CarteDEscale key={id} e={e} vue={vue} carte={carte} chance={chanceDe(e)} choisie={id === retenue} sure={id === laPlusSure} onToucher={() => toucher(id)} />
            })}
          </div>
        )}
        <span id="exp-dit-sure" hidden>
          La plus sûre des escales proposées
        </span>
        {/* Ce que cache l'escale touchée — un mélange y nomme ses catégories ; ses deux lignes gardées, le plan ne saute pas d'un toucher à l'autre. */}
        <p className="exp-vu" role="status">
          {dit.titre && <b>{dit.titre} </b>}
          {espacesFines(dit.texte)}
        </p>
        {/* Une ligne : à qui sont les chances, le temps que ses réponses disent les siennes. En rencontres, les règles le disent. */}
        {vue.moyen && !aveugle && !vue.cartes && <p className="exp-note small">{espacesFines('Les chances d’un joueur moyen, pour l’instant.')}</p>}
        {aveugle && <p className="exp-note small">{espacesFines('L’écholocation est posée : les cartes ne disent plus ta chance.')}</p>}
        {vue.route && <p className="exp-route small">{espacesFines(routeEnCours(vue.route))}</p>}
        {erreur && (
          <p className="error" role="alert">
            {espacesFines(erreur)}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          aria-disabled={busy || !retenue || undefined}
          onClick={() => retenue && onAvancer(retenue)}
        >
          {auCampement ? `Affronter ${leGardien(gardien)}` : retenue ? `Y aller : ${etiquette(parId.get(retenue)!, vue.acte, vue.gardiens)}` : 'Choisis ton escale'}
          <Icon name="chevron-right" />
        </button>
      </section>
      {paquet && vue.cartes && <FeuilleDesCartes paquet={vue.cartes.paquet} acte={acte} ascension={vue.cartes.ascension} energie={vue.cartes.energie} onFermer={() => setPaquet(false)} />}
    </div>
  )
}

// ── La main ─────────────────────────────────────────────────────────────────

/** Les jokers de route en cours, en une phrase : ils valent pour le pas suivant. */
function routeEnCours(route: NonNullable<VueDeLExpedition['route']>): string {
  return [
    route.detour && 'Le détour : ton pas suivant va à n’importe quelle escale de l’étage du dessus',
    route.raccourci && 'Le raccourci : ton pas suivant saute une escale',
    // Un coffre, une source au pas suivant : le Commandement n'y pose rien, et il est passé.
    route.commandement && `Commandement : au pas suivant, une question ou une élite pose ${route.commandement}`,
    route.lanterne && 'La lanterne : les pièges de l’acte se montrent',
  ]
    .filter(Boolean)
    .join(' · ')
}

type JouerUnJoker = (cle: string, plus?: { categorie?: string; montre?: number }) => void

/**
 * La main (la maquette 4, revue le 18 octobre 2026 : « ma main c'est pas
 * ouf ») : ses jokers en vraies cartes — le cadre de leur rareté, leur
 * dessin, leur nom —, posées au bas de l'écran comme une main qu'on tient :
 * on n'en voit que le haut. La pioche au bout, son paquet compté ; touchée,
 * sa feuille (`FeuilleDuPaquet`). Une carte touchée se lève (`JokerLeve`) et
 * dit ce qu'elle fait, puis « Jouer » — ou pourquoi elle ne se joue pas
 * maintenant ; celle-là se voit éteinte. Sur la carte, où se jouent les
 * jokers de carte, la même main en petit, en tête du panneau (`enPetit`) :
 * posée au bas, elle prenait au plan de l'acte la hauteur qui lui manquait
 * en 360 × 640.
 */
export function Main({
  vue,
  jokers,
  busy,
  enPetit,
  onJouer,
  onMontrer,
}: {
  vue: VueDeLExpedition
  jokers: JokersEnJeu
  busy: boolean
  /** Sur la carte : des cartes en petit, leur dessin seul ; levée, une carte dit tout. */
  enPetit?: boolean
  onJouer: JouerUnJoker
  /** La Prédiction : il montre une réponse à l'Oracle, sur la question à l'écran. */
  onMontrer?: () => void
}) {
  const [levee, setLevee] = useState<number | null>(null)
  const [paquet, setPaquet] = useState(false)
  const cle = levee !== null ? jokers.main[levee] : undefined
  return (
    <>
      <section className={'exp-main' + (enPetit ? ' exp-main-en-petit' : '')} aria-label="Ta main">
        {jokers.main.map((c, i) => {
          const j = jokerDeCle(c)
          if (!j) return null
          const refus = jokers.refus[c]
          return (
            <button
              key={`${c}:${i}`}
              type="button"
              className={'exp-carte-joker' + (refus ? ' exp-refuse' : '')}
              style={gemmeDuJoker(j)}
              data-joker={c}
              aria-haspopup="dialog"
              onClick={() => setLevee(i)}
            >
              <span className="exp-joker-dessin" aria-hidden="true">
                <VisageDuJoker j={j} />
              </span>
              <b className={enPetit ? 'sr-only' : 'exp-joker-nom'}>{j.nom}</b>
              {refus && <span className="sr-only">, pas maintenant</span>}
            </button>
          )
        })}
        {jokers.main.length === 0 && !enPetit && <p className="exp-main-vide">{espacesFines('Ta main est vide : tu tires un joker à chaque question, tant que ton paquet en a.')}</p>}
        <button type="button" className="exp-pioche" aria-haspopup="dialog" onClick={() => setPaquet(true)}>
          <b aria-hidden="true">{jokers.paquet.length}</b>
          {!enPetit && <span aria-hidden="true">paquet</span>}
          <span className="sr-only">{`Ton paquet : ${jokers.paquet.length} joker${jokers.paquet.length > 1 ? 's' : ''}, ta défausse : ${jokers.defausse.length}`}</span>
        </button>
      </section>
      {cle && (
        <JokerLeve
          // Une autre carte levée repart de zéro : la catégorie du Commandement choisie n'est pas la sienne.
          key={`${cle}:${levee}`}
          cle={cle}
          refus={jokers.refus[cle] ?? null}
          busy={busy}
          onJouer={(c, plus) => {
            setLevee(null)
            onJouer(c, plus)
          }}
          onMontrer={
            onMontrer &&
            (() => {
              setLevee(null)
              onMontrer()
            })
          }
          onReposer={() => setLevee(null)}
        />
      )}
      {paquet && <FeuilleDuPaquet jokers={jokers} talismans={vue.talismans ?? []} aLaQuestion={!!vue.question} onFermer={() => setPaquet(false)} />}
    </>
  )
}

/**
 * Une carte levée de la main : le joker en grand — le cadre de sa rareté, son
 * dessin, son nom, ce qu'il fait, d'où il vient —, et dessous ce qu'on en
 * fait : le jouer, le poser, choisir la catégorie du Commandement, montrer une
 * réponse à l'Oracle ; ou pourquoi il ne se joue pas maintenant
 * (`refusDuJoker`, calculé par le serveur). Toucher à côté la repose, Échap
 * aussi : un toucher perdu ne coûte rien.
 */
export function JokerLeve({
  cle,
  refus,
  busy,
  onJouer,
  onMontrer,
  onReposer,
}: {
  cle: string
  refus: string | null
  busy: boolean
  onJouer: JouerUnJoker
  onMontrer?: () => void
  onReposer: () => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onReposer)
  const [categorie, setCategorie] = useState<string | null>(null)
  const j = jokerDeCle(cle)
  if (!j) return null
  const verbe = cle === 'prediction' ? 'Montrer une réponse à l’Oracle' : `${j.sorte === 'poser' ? 'Poser' : 'Jouer'} « ${j.nom} »`
  // Le Commandement choisit d'abord sa catégorie : douze pastilles sous la carte, qui se fait plus petite.
  const choix = !refus && cle === 'commandement'
  return (
    <div className="carte-voile exp-leve-voile" onClick={onReposer}>
      <div className={'exp-leve' + (choix ? ' exp-leve-avec-choix' : '')} role="dialog" aria-modal="true" aria-label={j.nom} ref={boite} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="exp-carte-joker exp-carte-levee" style={gemmeDuJoker(j)}>
          <span className="exp-joker-rarete">
            <i aria-hidden="true" />
            {RARETE[j.rarete]}
          </span>
          <span className="exp-joker-dessin" aria-hidden="true">
            <VisageDuJoker j={j} />
          </span>
          <b className="exp-joker-nom">{j.nom}</b>
          <p className="exp-joker-effet">{espacesFines(j.effet)}</p>
          <span className="exp-joker-origine">{`${SORTE[j.sorte]}${j.legendaire ? ` · le joker ${duGardien(j.legendaire)}` : ''}`}</span>
        </div>
        {refus ? (
          <p className="exp-refus">{espacesFines(refus)}</p>
        ) : choix ? (
          <div className="exp-leve-choix">
            <p>{espacesFines('Au pas suivant, une question ou une élite posera :')}</p>
            <div className="exp-categories" role="group" aria-label="La catégorie de l’escale suivante">
              {CATEGORIES.map(c => (
                <button key={c} type="button" className={'pill-btn' + (categorie === c ? ' active' : '')} aria-pressed={categorie === c} onClick={() => setCategorie(c)}>
                  {COURT[c] ?? c}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || !categorie || undefined} onClick={() => categorie && !busy && onJouer(cle, { categorie })}>
              {categorie ? `Jouer · ${categorie}` : 'Choisis une catégorie'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (busy) return
              if (cle === 'prediction' && onMontrer) onMontrer()
              else onJouer(cle)
            }}
          >
            {verbe}
          </button>
        )}
        <button type="button" className="link-inline exp-reposer" onClick={onReposer}>
          Reposer la carte
        </button>
      </div>
    </div>
  )
}

/**
 * La pioche touchée, sa feuille : les jokers posés et ce qu'ils font, ses
 * talismans, son paquet, sa défausse, et la règle du tirage. La main, elle,
 * est sous ses doigts.
 */
function FeuilleDuPaquet({
  jokers,
  talismans,
  aLaQuestion,
  onFermer,
}: {
  jokers: JokersEnJeu
  /** Ses talismans (l'étape 4) : ils agissent seuls, jusqu'au bout. */
  talismans: readonly string[]
  aLaQuestion: boolean
  onFermer: () => void
}) {
  return (
    <Feuille titre="Ton paquet" className="feuille-paquet" onFermer={onFermer}>
      {jokers.poses.length > 0 && (
        <section className="exp-main-section">
          <h3 className="label">Posés jusqu’au bout de l’acte</h3>
          <ul className="exp-poses-liste">
            {jokers.poses.map(cle => {
              const j = jokerDeCle(cle)
              return (
                j && (
                  <li key={cle}>
                    <b>{j.nom}</b> <span className="muted small">{espacesFines(j.effet)}</span>
                  </li>
                )
              )
            })}
          </ul>
        </section>
      )}
      {talismans.length > 0 && (
        <section className="exp-main-section">
          <h3 className="label">Tes talismans, jusqu’au bout de l’expédition</h3>
          <ul className="exp-poses-liste">
            {talismans.map(cle => {
              const t = talismanDeCle(cle)
              return (
                t && (
                  <li key={cle}>
                    <b>{t.nom}</b> <span className="muted small">{espacesFines(t.effet)}</span>
                  </li>
                )
              )
            })}
          </ul>
        </section>
      )}
      <section className="exp-main-section">
        <h3 className="label">{`Ton paquet · ${jokers.paquet.length}`}</h3>
        <Jetons cles={jokers.paquet} vide="Ton paquet est vide : ta défausse y revient à l’acte suivant." />
      </section>
      <section className="exp-main-section">
        <h3 className="label">{`Ta défausse · ${jokers.defausse.length}`}</h3>
        <Jetons cles={jokers.defausse} vide="Rien en défausse." />
      </section>
      <p className="muted small">
        {espacesFines(
          `${aLaQuestion ? 'Un joker à jouer par question. ' : ''}Tu tires un joker à chaque question, jusqu’à trois en main. Joués, ils vont à la défausse, qui revient dans ton paquet à l’acte suivant.`,
        )}
      </p>
    </Feuille>
  )
}

// ── Une escale, le gardien ──────────────────────────────────────────────────

/** Ce que dit l'Oracle de la réponse montrée. */
const SENS: Record<SensDeLOracle, string> = { haut: 'plus haut', bas: 'plus bas', juste: 'c’est elle' }

/**
 * Le dévoilement d'une question (l'étape 3) : ses mots tels que le serveur
 * les dit — jamais l'intitulé d'avance. Rouvert quand un joker change son
 * heure (`relance` : Arrêt sur image), coupé dès qu'on répond ou qu'on quitte
 * l'escale. Une liaison tombée en route se reprend : rouvert, le serveur
 * redit d'un coup les mots déjà dits. Les mots se gardent par question, pas
 * par liaison : rouverte, elle effaçait le texte le temps d'un aller-retour.
 */
function useDevoilement(id: string, position: number | null, relance: string): { mots: string[]; fini: boolean } {
  const cle = `${id}:${position}`
  const [etat, setEtat] = useState<{ cle: string; mots: string[]; fini: boolean }>({ cle: '', mots: [], fini: false })
  useEffect(() => {
    if (position === null) return
    const arret = new AbortController()
    let essais = 0
    const lire = () => {
      api.expedition
        .devoilement(id, position, mots => setEtat(e => ({ cle, mots, fini: e.cle === cle && e.fini && mots.length >= e.mots.length })), arret.signal)
        .then(() => setEtat(e => ({ cle, mots: e.cle === cle ? e.mots : [], fini: true })))
        .catch(() => {
          if (!arret.signal.aborted && ++essais <= 3) setTimeout(lire, 800)
        })
    }
    lire()
    return () => arret.abort()
  }, [id, position, cle, relance])
  return etat.cle === cle ? etat : { mots: [], fini: false }
}

/**
 * Les réponses d'une question de l'expédition : effacées par un joker,
 * montrée à l'Oracle, choisies sous Double chance — celles-là cochées, leur
 * filet d'or tenu même sous le doigt. « On ne voit pas les réponses que l'on
 * choisit » (le 18 octobre 2026) : le téléphone garde le survol de la
 * dernière réponse touchée, qui repeignait son filet, et rien d'autre ne la
 * marquait qu'un fond à peine doré.
 */
export function ReponsesDeLEscale({
  reponses,
  effacees,
  choisies,
  doubleChance,
  montree,
  busy,
  onToucher,
}: {
  reponses: readonly string[]
  effacees: ReadonlySet<number>
  /** Double chance : les réponses choisies, deux au plus. */
  choisies: readonly number[]
  doubleChance: boolean
  /** La Prédiction : la réponse montrée à l'Oracle. */
  montree?: number
  busy: boolean
  onToucher: (i: number) => void
}) {
  return (
    <div className={'ans-grid' + (reponses.length > 4 ? ' exp-six' : '') + answersSizeClass(reponses)}>
      {reponses.map((a, i) => (
        <button
          key={i}
          className={'ans-btn' + (effacees.has(i) ? ' exp-effacee' : '') + (choisies.includes(i) ? ' exp-choisie' : '') + (montree === i ? ' exp-montree' : '')}
          aria-disabled={busy || effacees.has(i) || undefined}
          aria-pressed={doubleChance ? choisies.includes(i) : undefined}
          {...toucher(() => onToucher(i))}
        >
          {/* Quatre formes : à six choix, chacune n'aurait plus la sienne. */}
          {reponses.length <= 4 && <Shape index={i} />}
          <span className="ans-text">{espacesFines(a)}</span>
          {choisies.includes(i) && <Icon name="check" className="ans-check" />}
          {effacees.has(i) && <span className="sr-only">, effacée</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * La réponse à composer (v11) : ses cases, mot par mot — l'article, le trait
 * d'union et l'apostrophe posés d'office, comme les lettres d'un coup de
 * pouce —, puis ses tuiles. Toucher une tuile la pose dans la première case
 * vide ; toucher une case pleine rend sa tuile ; « Effacer » vide tout, et
 * « Valider » attend que tout soit plein. Pas de clavier : il pousserait les
 * boutons hors de l'écran. La page ne sait pas la réponse : elle envoie les
 * lettres dans l'ordre de ses cases, et le serveur juge (invariant 1).
 */
export function ComposerLaReponse({ composer, busy, onValider }: { composer: QuestionAComposer; busy: boolean; onValider: (lettres: string) => void }) {
  const [placees, setPlacees] = useState<(number | null)[]>([])
  const n = composer.mots.reduce((s, mot) => s + mot.filter(c => c === null).length, 0)
  const posees = new Map(composer.posees.map(p => [p.rang, p.lettre]))
  const lettreDe = new Map(composer.tuiles.map(t => [t.n, t.lettre]))
  // Une carte jouée en route retire une lettre de trop, ou en pose une : ce qu'il avait mis d'une tuile partie, ou sur une case
  // posée depuis, se retire de lui-même.
  const actuelles = Array.from({ length: n }, (_, rang) => {
    const t = placees[rang]
    return t !== undefined && t !== null && lettreDe.has(t) && !posees.has(rang) ? t : null
  })
  const dansLesCases = new Set(actuelles.filter((t): t is number => t !== null))
  const libres = composer.tuiles.filter(t => !dansLesCases.has(t.n))
  const lettres = actuelles.map((t, rang) => posees.get(rang) ?? (t === null ? '' : (lettreDe.get(t) ?? ''))).join('')
  const plein = lettres.length === n
  const poser = (t: number) => {
    const rang = actuelles.findIndex((x, k) => x === null && !posees.has(k))
    if (busy || rang < 0) return
    setPlacees(actuelles.map((x, k) => (k === rang ? t : x)))
  }
  const retirer = (rang: number) => !busy && setPlacees(actuelles.map((x, k) => (k === rang ? null : x)))
  let rang = 0
  return (
    <div className="exp-composer">
      <div className="exp-cases" role="group" aria-label={`Ta réponse : ${n} lettres à composer`}>
        {composer.article && <span className="exp-article">{composer.article}</span>}
        {composer.mots.map((mot, m) => (
          <span key={m} className="exp-mot">
            {mot.map((c, i) => {
              if (c !== null) {
                return (
                  <span key={i} className="exp-signe" aria-hidden="true">
                    {c}
                  </span>
                )
              }
              const k = rang++
              const posee = posees.get(k)
              const t = actuelles[k]
              const l = posee ?? (t === null ? undefined : lettreDe.get(t))
              return (
                <button
                  key={i}
                  type="button"
                  className={'exp-case' + (posee ? ' exp-case-posee' : l ? ' exp-case-pleine' : '')}
                  aria-label={posee ? `Lettre ${k + 1} : ${posee}, posée d’office` : l ? `Lettre ${k + 1} : ${l} — touche pour la retirer` : `Lettre ${k + 1}, vide`}
                  aria-disabled={busy || !!posee || !l || undefined}
                  {...toucher(() => !posee && l && retirer(k))}
                >
                  {l ?? ''}
                </button>
              )
            })}
          </span>
        ))}
      </div>
      <div className="exp-tuiles" role="group" aria-label="Les lettres à poser">
        {libres.map(t => (
          <button key={t.n} type="button" className="exp-tuile" aria-label={`Poser un ${t.lettre}`} aria-disabled={busy || plein || undefined} {...toucher(() => !plein && poser(t.n))}>
            {t.lettre}
          </button>
        ))}
      </div>
      {/* Au lever du doigt, comme les tuiles : la dernière tuile posée, ces boutons remontent sous le doigt, et le click qui suit y tombait. */}
      <div className="exp-composer-gestes">
        <button type="button" className="btn btn-ghost" aria-disabled={busy || dansLesCases.size === 0 || undefined} {...toucher(() => !busy && setPlacees([]))}>
          Effacer
        </button>
        <button type="button" className="btn btn-primary" aria-disabled={busy || !plein || undefined} {...toucher(() => plein && !busy && onValider(lettres))}>
          {plein ? 'Valider' : `Encore ${n - lettres.length} lettre${n - lettres.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

/**
 * La frise à poser (v13) : ses places, du plus ancien au plus récent, puis ses
 * événements en cartes, deux par rangée. Toucher un événement le pose à la
 * première place libre ; toucher une place le rend ; « Effacer » rend tout, et
 * « Valider » attend que les quatre soient posés — les gestes de la forme à
 * composer. Un événement qu'une carte a daté montre son année. La page ne sait
 * pas l'ordre : elle envoie ses cartes dans l'ordre de ses places, par leur
 * rang à l'écran, et le serveur juge (invariant 1).
 */
export function PoserLaFrise({ frise, busy, onValider }: { frise: FriseAPoser; busy: boolean; onValider: (ordre: number[]) => void }) {
  const [places, setPlaces] = useState<number[]>([])
  const n = frise.evenements.length
  const posees = new Set(places)
  const libres = frise.evenements.map((_, i) => i).filter(i => !posees.has(i))
  const plein = places.length === n
  const poser = (i: number) => !busy && !plein && !posees.has(i) && setPlaces([...places, i])
  const retirer = (k: number) => !busy && setPlaces(places.filter((_, j) => j !== k))
  const datee = (i: number) => frise.annees[i] ?? null
  const rang = (k: number) => (k === 0 ? 'Le plus ancien' : k === n - 1 ? 'Le plus récent' : `${k + 1}ᵉ`)
  return (
    <div className="exp-frise">
      <ol className="exp-frise-places" aria-label="La frise, du plus ancien au plus récent">
        {Array.from({ length: n }, (_, k) => {
          const i = places[k]
          const annee = i === undefined ? null : datee(i)
          return (
            <li key={k}>
              <button
                type="button"
                className={'exp-frise-place' + (i !== undefined ? ' exp-frise-pleine' : '')}
                aria-label={i !== undefined ? `${rang(k)} : ${frise.evenements[i]} — touche pour le retirer` : `${rang(k)}, vide`}
                aria-disabled={busy || i === undefined || undefined}
                {...toucher(() => retirer(k))}
              >
                <span className="exp-frise-rang">{rang(k)}</span>
                {i !== undefined && (
                  <span className="exp-frise-evenement">
                    {espacesFines(frise.evenements[i])}
                    {annee !== null && <b className="exp-frise-annee">{anneeDite(annee)}</b>}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="exp-frise-cartes" role="group" aria-label="Les événements à poser">
        {libres.map(i => {
          const annee = datee(i)
          return (
            <button key={i} type="button" className="exp-frise-carte" aria-disabled={busy || plein || undefined} {...toucher(() => poser(i))}>
              {espacesFines(frise.evenements[i])}
              {annee !== null && <b className="exp-frise-annee">{anneeDite(annee)}</b>}
            </button>
          )
        })}
      </div>
      {/* Au lever du doigt, comme les cartes : une rangée posée se vide, ces boutons remontent sous le doigt, et le click qui suit
          effaçait tout ce qui était posé (le retour du propriétaire du 20 octobre 2026). */}
      <div className="exp-composer-gestes">
        <button type="button" className="btn btn-ghost" aria-disabled={busy || places.length === 0 || undefined} {...toucher(() => !busy && setPlaces([]))}>
          Effacer
        </button>
        <button type="button" className="btn btn-primary" aria-disabled={busy || !plein || undefined} {...toucher(() => plein && !busy && onValider(places))}>
          {plein ? 'Valider' : `Encore ${n - places.length} événement${n - places.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

/**
 * Une question de l'expédition (les maquettes 4 et 7) : celle d'une escale —
 * sa catégorie, son mélange ou son thème pointu —, d'une source, d'une
 * élite, ou du gardien, son médaillon et ses crans au-dessus ; sous ses
 * réponses, la main. Ce qu'un joker y a fait se voit sur elle : les réponses
 * effacées, deux à choisir (Double chance), l'autre question (Deux visages),
 * l'indice de l'Énigme, ce que dit l'Oracle, ce que coûterait une erreur.
 * Sa forme (l'étape 3, la maquette 11) : six choix, un vrai ou faux et sa
 * réponse proposée, un dévoilement mot à mot. Puis sa révélation : la bonne
 * réponse, l'anecdote, et la suite. Une curiosité (v12) : son en-tête, ce
 * qu'elle rapporte, les emojis d'un rébus en grand.
 */
export function Escale({
  vue,
  avant,
  question: q,
  reponse: r,
  choix,
  composee,
  ordre,
  busy,
  erreur,
  onRepondre,
  onJouer,
  onSuite,
  onPartir,
  onSignaler,
}: {
  vue: VueDeLExpedition
  /** Révélée : la vue de la question, avant la réponse. */
  avant: VueDeLExpedition | null
  question: QuestionDExpedition
  reponse: ReponseDExpedition | null
  choix: number | null
  /** Révélée, à composer (v11) : ce qu'il a composé. */
  composee?: string
  /** Révélée, une frise (v13) : l'ordre qu'il a donné, par le rang de ses cartes à l'écran. */
  ordre?: readonly number[]
  busy: boolean
  erreur: string
  onRepondre: (q: QuestionDExpedition, choix: number | readonly number[] | string) => void
  onJouer: JouerUnJoker
  onSuite: () => void
  onPartir: () => void
  onSignaler: () => void
}) {
  // Deux visages : la question qu'il regarde. Double chance : les deux réponses choisies. La Prédiction : il touche la réponse à montrer.
  const [visage, setVisage] = useState<0 | 1>(0)
  const [deux, setDeux] = useState<number[]>([])
  const [montrer, setMontrer] = useState(false)
  const autre = r ? undefined : vue.autre
  const affichee = autre && visage === 1 ? autre : q
  // Révélée, la vue est déjà celle d'après : l'escale et l'acte se lisent de la question.
  const acte = Math.min(r ? vue.acte - (r.vaincu ? 1 : 0) : vue.acte, ACTES - 1)
  const gardien = vue.gardiens[acte]?.cle ?? ''
  const auGardien_ = q.escale === GARDIEN
  const carte = vue.carte
  const escale = !auGardien_ && carte ? carte.escales.find(e => e.id === q.escale) : undefined
  const source = escale?.sorte === 'source'
  const elite = escale?.sorte === 'elite'
  // Une curiosité (v12) : un plat, un rébus — une escale bonus, sans adversaire ni cartes.
  const curiosite = escale?.sorte === 'curiosite' ? (escale.curiosite ?? 'plat') : null
  const m = MARCHES_DES_ACTES[acte]
  // Les crans du gardien : ceux qu'il a trouvés — à la révélation, la réponse comprise.
  const trouvees = auGardien_ ? (r ? (r.vaincu ? m.aTrouver : (r.expedition.gardien?.trouvees ?? m.aTrouver)) : (vue.gardien?.trouvees ?? 0)) : 0
  const theme = escale?.theme && ('sujet' in escale.theme || escale.theme.categories.length > 1) ? nomDuTheme(escale.theme) : null
  const finie = r !== null && vue.issue === 'perdue'
  const effacees = new Set(affichee.effacees ?? [])
  const doubleChance = !r && !!affichee.deux
  const aMontrer = montrer && !vue.joue
  const joue = vue.joue ? jokerDeCle(vue.joue) : undefined
  // En rencontre : l'adversaire en tête — à la révélation, tel que la réponse l'a laissé ; la vue d'après n'en a plus s'il est tombé.
  const rencontre = r ? avant?.rencontre : vue.rencontre
  const apres = r && rencontre ? adversaireALaRevelation(rencontre, r.coup, vue.rencontre) : undefined
  const [tas, setTas] = useState(false)
  // Un dévoilement : ses mots à mesure qu'ils se disent ; répondu, son intitulé entier revient avec le verdict. Arrêt sur image joué, ils se relisent.
  const devoile = useDevoilement(
    vue.id,
    !r && affichee.forme === 'devoilement' ? affichee.index : null,
    // Arrêt sur image, amélioré ou non : le texte s'arrête.
    vue.joue ?? (vue.rencontre && parmi(vue.rencontre.jouees, 'arret-sur-image') ? 'arret-sur-image' : ''),
  )
  const enDevoilement = !r && affichee.forme === 'devoilement'
  // Un détail (v15) : son tableau, cadrage après cadrage, à l'heure du serveur ; répondu, le tableau entier, nommé.
  const detail = !r && affichee.forme === 'detail' ? affichee.detail : undefined
  const cadrage = useCadrage(detail)
  const texte = r?.texte ?? affichee.texte
  const total = affichee.devoilement?.mots ?? 0
  const toucherReponse = (i: number) => {
    if (busy || effacees.has(i)) return
    if (aMontrer) {
      setMontrer(false)
      onJouer('prediction', { montre: i })
    } else if (doubleChance) setDeux(d => (d.includes(i) ? d.filter(x => x !== i) : [...d.slice(-1), i]))
    else onRepondre(affichee, i)
  }
  return (
    <div className={'player-shell expedition' + (auGardien_ ? ' exp-au-gardien' : '')}>
      <div className="quiz-player epreuve">
        <Barre vue={vue} onPartir={onPartir} sansSortie={finie} />
        {rencontre ? (
          <Adversaire
            r={rencontre}
            gardien={gardien}
            acte={acte}
            sceaux={apres?.sceaux}
            doute={apres?.doute}
            compact
            // Un dévoilement trouvé avant la moitié de ses mots prend un cran de plus (v10) : tant qu'il en est temps, l'en-tête le montre.
            tot={(enDevoilement && 2 * Math.max(1, devoile.mots.length) <= total) || (!!detail && 2 * cadrage <= CADRAGES_DU_DETAIL)}
          />
        ) : auGardien_ ? (
          <div className="exp-gardien-tete">
            <Medaillon cle={gardien} className="exp-medaillon exp-medaillon-gardien" />
            <span className="exp-gardien-texte">
              <span className="label">{`Gardien · acte ${acte + 1}`}</span>
              <b className="exp-gardien-nom">{nomDuGardien(gardien)}</b>
              <span className="muted small">{espacesFines(`${regleDuGardien(acte)} : chaque erreur te coûte une vie.`)}</span>
            </span>
          </div>
        ) : (
          <p className="exp-ou label">{`Acte ${acte + 1} · escale ${Math.max(1, vue.trace.length)} · vers ${leGardien(gardien)}`}</p>
        )}
        {auGardien_ && !rencontre && (
          <div className="exp-crans" role="img" aria-label={`${trouvees} bonne${trouvees > 1 ? 's' : ''} réponse${trouvees > 1 ? 's' : ''} sur ${m.aTrouver}`}>
            {Array.from({ length: m.aTrouver }, (_, i) => (
              <i key={i} className={i < trouvees ? 'cran-trouve' : undefined} />
            ))}
            <b>{`${trouvees} sur ${m.aTrouver}`}</b>
          </div>
        )}
        {source && (
          <p className="exp-regle small">
            {espacesFines(
              vue.courage !== undefined
                ? `Une source : retrouvée, +${soinALAscension(COURAGE_D_UNE_SOURCE, vue.cartes?.v ?? 0, vue.cartes?.ascension ?? 0)} de courage ; ratée, rien.`
                : 'Une source : une question de ton carnet. Retrouvée, elle te rend une vie ; ratée, elle ne te coûte rien.',
            )}
          </p>
        )}
        {elite && !r && !rencontre && <p className="exp-regle small">{espacesFines('Une élite : trouvée, un joker au choix pour ton paquet ; ratée, une vie.')}</p>}
        {curiosite && !r && <p className="exp-regle exp-regle-curiosite small">{espacesFines(`Une curiosité : trouvée, ${recompenseDeLaCuriosite(vue)} au choix ; ratée, rien de perdu.`)}</p>}
        {autre && (
          <div className="exp-visages" role="group" aria-label="Deux visages : la question à laquelle tu réponds">
            <button type="button" className={'pill-btn' + (visage === 0 ? ' active' : '')} aria-pressed={visage === 0} onClick={() => setVisage(0)}>
              Première question
            </button>
            <button type="button" className={'pill-btn' + (visage === 1 ? ' active' : '')} aria-pressed={visage === 1} onClick={() => setVisage(1)}>
              Seconde question
            </button>
          </div>
        )}
        <span className="label quiz-categorie">
          {curiosite ? `Curiosité · ${NOM_DE_LA_CURIOSITE[curiosite]}` : [theme, affichee.categorie, NOM_NIVEAU[affichee.niveau]].filter(Boolean).join(' · ')}
        </span>
        {detail && <DetailQuiSElargit expedition={vue.id} position={affichee.index} cadrage={cadrage} />}
        {r?.detail && <TableauEntier src={adresseDuCadrage(vue.id, q.index, CADRAGES_DU_DETAIL)} {...r.detail} />}
        {enDevoilement ? (
          <>
            {/* Sa taille se lit sur son compte de mots : elle ne change pas à chaque mot qui arrive. */}
            <h2 className={'quiz-question exp-devoile' + questionSizeClass('x'.repeat(total * 6))}>
              {espacesFines(devoile.mots.join(' '))}
              {!devoile.fini && <span className="exp-curseur" aria-hidden="true" />}
            </h2>
            <div className="exp-jauge" role="progressbar" aria-label="Le texte se dévoile" aria-valuemin={0} aria-valuemax={total} aria-valuenow={devoile.mots.length}>
              <i style={{ width: `${total > 0 ? Math.round((devoile.mots.length / total) * 100) : 0}%` }} />
            </div>
            <p className="exp-consigne small">{devoile.fini ? 'Tout le texte est là.' : espacesFines('Le texte se dévoile mot à mot : réponds dès que tu sais.')}</p>
          </>
        ) : (
          <h2 className={'quiz-question' + questionSizeClass(texte)}>{espacesFines(texte)}</h2>
        )}
        {/* Un rébus (v12) : ses emojis en grand, chacun dans sa case, comme « 4 images 1 mot » ; la réponse se compose dessous. */}
        {affichee.rebus && (
          <p className="exp-rebus">
            {(emojisDe(affichee.rebus) ?? [affichee.rebus]).map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </p>
        )}
        {affichee.proposee !== undefined && (
          <p className="exp-proposee">
            <span className="label">Vrai ou faux ?</span>
            <b>{espacesFines(`« ${affichee.proposee} »`)}</b>
          </p>
        )}
        {!r && affichee.indice && (
          <p className="exp-indice small">
            <b>Énigme :</b> {espacesFines(affichee.indice)}
          </p>
        )}
        {!r && affichee.siecle && (
          <p className="exp-indice small">
            <b>La loupe :</b> {espacesFines(affichee.siecle)}
          </p>
        )}
        {/* Les coups de pouce (v11) : ce que Le repère, L'initiale ou La lettre soufflent — à composer, les lettres sont dans les cases. */}
        {!r &&
          affichee.pouces?.map(p => (
            <p key={p} className="exp-indice exp-pouce small" role="status">
              <Icon name="bulb" />
              {espacesFines(p)}
            </p>
          ))}
        {!r && affichee.prediction && (
          <p className="exp-indice small" role="status">
            <b>L’Oracle</b>
            {espacesFines(` sur « ${affichee.reponses[affichee.prediction.montre]} » : ${SENS[affichee.prediction.sens]}`)}
          </p>
        )}
        {aMontrer && (
          <p className="exp-consigne small" role="status">
            {'Touche la réponse à montrer à l’Oracle. '}
            <button type="button" className="link-inline small" onClick={() => setMontrer(false)}>
              Annuler
            </button>
          </p>
        )}
        {doubleChance && <p className="exp-consigne small">{espacesFines('Double chance : choisis deux réponses — il suffit que l’une soit juste.')}</p>}
        {/* Les familles (v14) : son premier essai, raté, s'est effacé — il répond encore, sans que rien soit jugé. */}
        {!r && vue.rencontre?.essai !== undefined && (
          <p className="exp-consigne exp-essai small" role="status">
            <Icon name="rotate" />
            {espacesFines(`Raté — ${carteDeRencontre(vue.rencontre.essai)?.nom ?? 'ta carte'} efface ta réponse : réponds encore.`)}
          </p>
        )}
        {r ? (
          <Revelation
            question={q}
            reponse={r}
            avant={avant}
            choix={choix}
            composee={composee}
            ordre={ordre}
            source={source}
            curiosite={!!curiosite}
            finie={finie}
            gardien={gardien}
            adversaire={rencontre?.adversaire}
            onSuite={onSuite}
            onSignaler={onSignaler}
          />
        ) : affichee.composer ? (
          // Une question à composer (v11) : sa clé change avec elle — Échange en pose une autre, rien de composé ne la suit ; un second
          // essai (v14) la rend vide, comme neuve.
          <ComposerLaReponse
            key={`${affichee.index}:${vue.rencontre?.essai ?? ''}`}
            composer={affichee.composer}
            busy={busy}
            onValider={lettres => onRepondre(affichee, lettres)}
          />
        ) : affichee.frise ? (
          // Une frise (v13) : de même, sa clé change avec elle.
          <PoserLaFrise key={`${affichee.index}:${vue.rencontre?.essai ?? ''}`} frise={affichee.frise} busy={busy} onValider={ordre_ => onRepondre(affichee, ordre_)} />
        ) : (
          <ReponsesDeLEscale
            reponses={affichee.reponses}
            effacees={effacees}
            choisies={deux}
            doubleChance={doubleChance}
            montree={affichee.prediction?.montre}
            busy={busy}
            onToucher={toucherReponse}
          />
        )}
        {doubleChance && (
          <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || deux.length === 0 || undefined} onClick={() => deux.length > 0 && !busy && onRepondre(affichee, deux)}>
            {deux.length === 2 ? 'Répondre avec ces deux réponses' : deux.length === 1 ? 'Répondre avec celle-ci' : 'Choisis deux réponses'}
          </button>
        )}
        {!r && vue.perte !== undefined && joue && (
          <p className="exp-perte small">
            {espacesFines(
              vue.perte === 0
                ? `${joue.nom} : ratée, elle ne te coûte pas de vie.`
                : joue.cle === 'quitte-ou-double'
                  ? `${joue.nom} : trouvée, ses écus triplent ; ratée, elle te coûte deux vies.`
                  : `${joue.nom} : ratée, elle te coûte deux vies.`,
            )}
          </p>
        )}
        {/* En rencontre, ce que la réponse fera, la mise dite : la même règle que le verdict, en deux chiffres — la question d'abord.
            La question au centre (v10) n'a plus de tuiles : ses crans et son attaque, en tête, disent ce qu'il reste à faire. */}
        {!r && vue.rencontre?.apercu && !vue.rencontre.crans && <Apercu a={vue.rencontre.apercu} compact />}
        {erreur && (
          <p className="error" role="alert">
            {espacesFines(erreur)}
          </p>
        )}
        {!r && vue.jokers && <Main vue={vue} jokers={vue.jokers} busy={busy} onJouer={onJouer} onMontrer={() => setMontrer(true)} />}
        {!r && vue.rencontre && (
          <MainDeRencontre
            cles={vue.rencontre.main}
            refus={vue.rencontre.refus}
            busy={busy}
            {...(!vue.rencontre.crans && { inspiration: vue.rencontre.inspiration })}
            phase="question"
            pile={{
              compte: vue.rencontre.pioche,
              mot: 'pioche',
              dit: `Ta pioche : ${vue.rencontre.pioche} carte${vue.rencontre.pioche > 1 ? 's' : ''}, ta défausse : ${vue.rencontre.defausse.length}`,
              onOuvrir: () => setTas(true),
            }}
            apercuDeLaCarte={cle => changementDeLaCarte(vue.rencontre!, vue.rencontre!.mise, vue.fetiche, cle)}
            onJouer={onJouer}
            onMontrer={() => setMontrer(true)}
          />
        )}
        {tas && vue.rencontre && (
          <FeuilleDesCartes
            paquet={vue.cartes?.paquet ?? []}
            rencontre={vue.rencontre}
            acte={mainDeLActe(vue)}
            ascension={vue.cartes?.ascension}
            energie={vue.cartes?.energie}
            onFermer={() => setTas(false)}
          />
        )}
        {/* La question au centre (v10) s'ouvre sur sa question : les règles s'y ouvrent d'elles-mêmes, à la première rencontre. */}
        {!r && vue.rencontre?.crans && <GuideDesRencontres vue={vue} />}
      </div>
    </div>
  )
}

/**
 * Ce que la révélation dit d'une réponse : juste ou non, et ce qu'elle a
 * coûté — lu de l'écart des vies avec la question d'avant, et des jokers qui
 * ont servi : Sursis et La mue la sauvent, Peau de feu aussi, Renaissance
 * fait renaître, Tout ou rien en prend deux.
 */
function verdictDe(r: ReponseDExpedition, avant: VueDeLExpedition | null, source: boolean, finie: boolean, curiosite = false): string {
  // Une curiosité (v12) : trouvée, sa récompense vient ; ratée, elle n'a rien coûté.
  // Le « +10 XP » suit le verdict : « Ta récompense t'attend +10 XP » se lisait comme une récompense de dix points.
  if (curiosite) return r.juste ? 'Bien vu, ta récompense t’attend !' : 'Raté… une curiosité ne coûte rien'
  // Une source, aux rencontres : pas d'adversaire, pas de coup — retrouvée, elle rend du courage ; ratée, rien.
  if (r.expedition.courage !== undefined) {
    const gagne = r.expedition.courage - (avant?.courage ?? r.expedition.courage)
    if (r.juste) return gagne > 0 ? `Retrouvée ! +${gagne} de courage` : 'Retrouvée !'
    return 'Raté… la source ne coûte rien : ton carnet la garde'
  }
  const vies = r.expedition.vies
  const avantVies = avant?.vies ?? vies
  const poses = (v: VueDeLExpedition | null) => v?.jokers?.poses ?? []
  const servi = (cle: string) => poses(avant).includes(cle) && !poses(r.expedition).includes(cle)
  if (r.juste) {
    if (source) return vies > avantVies ? 'Retrouvée ! Une vie de plus' : 'Retrouvée !'
    return vies > avantVies ? 'Bien joué ! Une vie de plus' : 'Bien joué !'
  }
  if (finie) return 'Raté… c’était ta dernière vie'
  if (servi('renaissance')) return 'Raté… Renaissance : tu renais avec une vie'
  if (source) return 'Raté… la source ne coûte rien : ton carnet la garde'
  const perdues = avantVies - vies
  if (perdues <= 0) {
    if (servi('peau-de-feu')) return 'Raté… Peau de feu : ta vie est sauve'
    const joue = avant?.joue ? jokerDeCle(avant.joue)?.nom : undefined
    return joue ? `Raté… ${joue} : ta vie est sauve` : 'Raté… ta vie est sauve'
  }
  // « Raté… 2 vies » se lisait aussi « deux de perdues », depuis que Tout ou rien en prend deux.
  const reste = vies === 1 ? 'plus qu’une vie' : `il te reste ${vies} vies`
  return perdues >= 2 ? `Raté… deux vies de moins : ${reste}` : `Raté… ${reste}`
}

/**
 * Ce que la révélation dit de la bonne réponse, sous son verdict. D'un vrai ou
 * faux tiré d'une question à quatre choix : ce qu'il proposait, ce qu'il
 * valait, et — faux — ce qu'il fallait répondre, que le serveur donne avec le
 * verdict (le 19 octobre 2026, un testeur : « je sais que c'est pas Eschyle
 * mais ça ne me dit pas c'était quoi la réponse »).
 */
export function LaBonneReponse({
  question: q,
  reponse: r,
  choix,
  composee,
  ordre,
}: {
  question: Pick<QuestionDExpedition, 'reponses' | 'proposee' | 'composer' | 'frise'>
  reponse: Pick<ReponseDExpedition, 'bonne' | 'bonneReponse' | 'frise'> & { juste?: boolean }
  choix: number | null
  /** À composer (v11) : ce qu'il a composé. */
  composee?: string
  /** Une frise (v13) : l'ordre qu'il a donné, par le rang de ses cartes à l'écran. */
  ordre?: readonly number[]
}) {
  // Une frise (v13) : la bonne, rangée, chaque événement et son année, que le serveur donne avec le verdict ; ratée, où il avait mis
  // chacun — ses cartes se retrouvent par leur ligne, unique dans sa frise.
  if (r.frise) {
    const { evenements, annees } = r.frise
    const places = r.juste === false && ordre && q.frise ? evenements.map(e => ordre.indexOf(q.frise!.evenements.indexOf(e))) : undefined
    return <FriseRangee evenements={evenements} annees={annees} places={places} />
  }
  // À composer (v11) : la page n'en avait que les tuiles — le serveur dit la bonne avec le verdict, et, faux, ce qu'il a composé
  // se lit à côté, dans ses cases : « Tu as composé SOPHOCLES — c'était Sophocle ».
  if (q.composer && r.bonneReponse !== undefined) {
    return (
      <p className="muted">
        {composee !== undefined && r.juste === false ? (
          <>
            {'Tu as composé '}
            <strong className="exp-composee">{compositionDite(q.composer.mots, composee)}</strong>
            {' — c’était '}
            <strong>{espacesFines(r.bonneReponse)}</strong>
          </>
        ) : (
          <>
            La bonne réponse : <strong>{espacesFines(r.bonneReponse)}</strong>
          </>
        )}
      </p>
    )
  }
  return (
    <p className="muted">
      {choix === null ? 'Sans réponse. ' : ''}
      {q.proposee !== undefined ? (
        <>
          {espacesFines(`« ${q.proposee} » : `)}
          <strong>{r.bonne === 0 ? 'vrai' : 'faux'}</strong>
          {r.bonneReponse !== undefined && (
            <>
              {/* Le tiret collé à « faux » : seul en tête de ligne, il ne se lirait plus comme sa suite. */}
              {'\u00a0— c’était '}
              <strong>{espacesFines(r.bonneReponse)}</strong>
            </>
          )}
        </>
      ) : (
        <>
          La bonne réponse : {q.reponses.length <= 4 && <Shape index={r.bonne} inline />}
          <strong>{espacesFines(q.reponses[r.bonne])}</strong>
        </>
      )}
    </p>
  )
}

/** La révélation d'une question : juste ou non, ce que la réponse a coûté, la bonne réponse, l'anecdote, et la suite. */
function Revelation({
  question: q,
  reponse: r,
  avant,
  choix,
  composee,
  ordre,
  source,
  curiosite = false,
  finie,
  gardien,
  adversaire,
  onSuite,
  onSignaler,
}: {
  question: QuestionDExpedition
  reponse: ReponseDExpedition
  avant: VueDeLExpedition | null
  choix: number | null
  composee?: string
  ordre?: readonly number[]
  source: boolean
  /** Une curiosité (v12) : ni adversaire ni courage — sa récompense, ou rien. */
  curiosite?: boolean
  finie: boolean
  gardien: string
  /** En rencontre : l'adversaire, que la réponse a peut-être fait tomber. */
  adversaire?: string
  onSuite: () => void
  onSignaler: () => void
}) {
  // En rencontre, le coup de la réponse dit ce qu'elle a brisé ou coûté : ses lignes remplacent les écus de l'escale — en crans, dans la question au centre.
  const coup = r.coup ? verdictDeLaRencontre(r.coup, adversaire ?? 'L’adversaire', finie, !!avant?.rencontre?.crans) : null
  const verdict = coup ? coup.titre : verdictDe(r, avant, source, finie, curiosite)
  // L'exploit que cette réponse vient de faire (le codex) : neuf pour son codex, et pas encore dit à la question d'avant.
  const dits = avant ? exploitsNeufs(avant) : []
  const exploits = exploitsNeufs(r.expedition).filter(x => !dits.includes(x))
  const geste: ReactNode = r.vaincu
    ? `${nomDuGardien(r.vaincu)} est ${gardienAuFeminin(r.vaincu) ? 'vaincue' : 'vaincu'}`
    : finie
      ? 'Voir la fin'
      : r.expedition.offre
        ? r.expedition.offre.curiosite
          ? 'Choisir ta récompense'
          : r.expedition.cartes
            ? 'Choisir ta carte'
            : 'Choisir ton joker'
        : r.expedition.question || r.expedition.rencontre
          ? 'Question suivante'
          : 'Retour au plan'
  return (
    <>
      <div className={'card result-banner ' + (r.juste ? 'result-ok' : 'result-ko')} role="status">
        {/* Sa niche : sans réponse — le temps d'un dévoilement écoulé —, elle reste calme. */}
        <NicheALaRevelation cle={`expedition:${r.expedition.id}:${q.index}`} reaction={reactionDuSolo(choix === null ? null : r.juste, rareEnCampagne(q.niveau))} />
        {r.juste ? (
          <>
            <span className="big">🎊 +1</span>
            {/* « +10 XP » d'un bloc : après un verdict long — une curiosité —, « XP » passait seul à la ligne. */}
            <p>{espacesFines(`${verdict}${r.xp > 0 ? ` +${r.xp} XP` : ''}`)}</p>
            {/* Ses écus (l'étape 4) : ceux de l'escale, et ceux du gardien qui tombe — jamais des confettis. En rencontre, le coup les dit. */}
            {r.ecus !== undefined && !coup && (
              <p className="exp-gain-ecus">
                <Icon name="ecu" />
                {`+${r.ecus} écus`}
              </p>
            )}
            {/* Un thème pointu trouvé pour la première fois : son tampon au passeport. */}
            {r.tampon && (
              <p className="exp-gain-ecus exp-gain-tampon">
                <Icon name="tampon" />
                {espacesFines(`Nouveau tampon : ${sujetParCle(r.tampon)?.nom ?? r.tampon}`)}
              </p>
            )}
            {/* Un exploit : ce qu'il ouvre, au futur — son codex est figé, il compte dès l'expédition suivante. */}
            {exploits.flatMap(x => exploitDe(x) ?? []).map(x => (
              <p key={x.cle} className="exp-gain-ecus exp-gain-exploit">
                <Icon name="medal" />
                {espacesFines(`Exploit : ${x.but} — ${recompenseDe(x, true)}.`)}
              </p>
            ))}
            <GerbeDeJuste />
          </>
        ) : (
          <>
            <span className="result-icon">
              <Icon name="x-circle" />
            </span>
            <p>{espacesFines(verdict)}</p>
          </>
        )}
        {coup && coup.lignes.length > 0 && (
          <ul className="exp-coup">
            {coup.lignes.map(l => (
              <li key={l}>{espacesFines(l)}</li>
            ))}
          </ul>
        )}
        <LaBonneReponse question={q} reponse={r} choix={choix} composee={composee} ordre={ordre} />
        {r.devoile && (
          <p className="muted small">
            {/* Un détail (v15) se reconnaît à un cadrage, pas à un mot. */}
            {espacesFines(`${r.detail ? 'Reconnu' : 'Répondu'} au ${r.devoile.mots === 1 ? '1ᵉʳ' : `${r.devoile.mots}ᵉ`} ${r.detail ? 'cadrage' : 'mot'} sur ${r.devoile.sur}.`)}
          </p>
        )}
      </div>
      {r.anecdote && (
        <p className="card anecdote">
          <Icon name="message" />
          <span>
            <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
          </span>
        </p>
      )}
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={onSuite}>
        {geste}
        <Icon name="chevron-right" />
      </button>
      {gardien && r.vaincu === undefined && q.escale === GARDIEN && !finie && r.expedition.gardien && (
        <p className="muted small centre">{`Encore ${r.expedition.gardien.aTrouver - r.expedition.gardien.trouvees} pour vaincre ${leGardien(gardien)}`}</p>
      )}
      {/* Un rébus (v12), une frise (v13) ne sont pas des questions de la campagne : le serveur ne les prendrait pas, rien ne le propose. */}
      {!q.rebus && !q.frise && (
        <button type="button" className="lien-signaler link-inline small" onClick={onSignaler}>
          Signaler une erreur dans cette question
        </button>
      )}
    </>
  )
}

/**
 * Le gardien vaincu (la maquette 8) : l'acte fini, son médaillon en grand,
 * les gardiens vaincus, et son joker — puis l'acte suivant, ou le choix au
 * bout du troisième.
 */
function GardienVaincu({ vue, gardien, onSuite }: { vue: VueDeLExpedition; gardien: string; onSuite: () => void }) {
  const acte = vue.gardiens.findIndex(g => g.cle === gardien)
  const vaincus = vue.gardiens.filter(g => g.vaincu).length
  return (
    <div className="player-shell expedition exp-vaincu">
      <span className="exp-pastille exp-pastille-or">{`Acte ${acte + 1} terminé`}</span>
      <Medaillon cle={gardien} grand className="exp-medaillon exp-medaillon-grand" />
      <h1>{`${nomDuGardien(gardien)} est ${gardienAuFeminin(gardien) ? 'vaincue' : 'vaincu'}`}</h1>
      <p className="muted">
        {espacesFines(
          vue.issue === 'au-bout' ? 'Tes trois gardiens sont vaincus : garde l’un d’eux, il est à toi.' : 'À la fin de l’acte 3, tu garderas l’un de tes trois gardiens : celui-là, il est à toi.',
        )}
      </p>
      <div className="exp-vaincus" role="img" aria-label={`${vaincus} gardien${vaincus > 1 ? 's' : ''} vaincu${vaincus > 1 ? 's' : ''} sur ${ACTES}`}>
        <span className="small">
          Gardiens vaincus <b>{`${vaincus} sur ${ACTES}`}</b>
        </span>
        <span className="exp-vaincus-medaillons">
          {vue.gardiens.map(g => (
            <Medaillon key={g.cle} cle={g.cle} verrouille={!g.vaincu} className="exp-medaillon exp-medaillon-petit" />
          ))}
        </span>
      </div>
      <p className="card exp-joker-carte">
        {vue.cartes ? <SaCarte cle={gardien} /> : <SonJoker cle={gardien} />}
        {vue.jokers && vue.issue !== 'au-bout' && <span className="muted small">{espacesFines('Il rejoint ton paquet jusqu’au bout de l’expédition, et ta défausse y revient.')}</span>}
        {vue.cartes && vue.issue !== 'au-bout' && <span className="muted small">{espacesFines('Elle rejoint ton paquet jusqu’au bout de l’expédition, et tes cartes de route se rejouent.')}</span>}
      </p>
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={onSuite}>
        {vue.issue === 'au-bout' ? 'Choisir ton légendaire' : `Vers l’acte ${Math.min(vue.acte, ACTES - 1) + 1}`}
        <Icon name="chevron-right" />
      </button>
    </div>
  )
}

/** Dans une offre, la clé du talisman, pour le distinguer d'un joker parmi ce qu'on prend. */
const TALISMAN = 'talisman:'
/** De même, la fiole d'un coffre (le codex). */
const FIOLE = 'fiole:'

/**
 * Un joker pour son paquet (la maquette 12) : ce qu'offre un coffre ou une
 * élite trouvée — trois jokers, un à prendre, deux sous Le trésor —, ou le
 * coffre que L'horizon a vidé. Ne rien prendre est un choix : un paquet court
 * tire plus souvent ses meilleurs — et un coffre passé rapporte ses écus
 * (l'étape 4). Un talisman s'y cache parfois (la maquette 6) : il prend la
 * place d'un joker, et agit seul jusqu'au bout de l'expédition.
 */
function Offre({
  vue,
  offre,
  busy,
  erreur,
  onPrendre,
  onPartir,
}: {
  vue: VueDeLExpedition
  offre: NonNullable<VueDeLExpedition['offre']>
  busy: boolean
  erreur: string
  onPrendre: (jokers: readonly string[], talisman?: string, fiole?: CleDeFiole) => void
  onPartir: () => void
}) {
  const [pris, setPris] = useState<string[]>([])
  // Aux rencontres, une carte de son paquet touchée se montre en grand.
  const [regardee, setRegardee] = useState<string | null>(null)
  const ici = vue.ici ? vue.carte?.escales.find(e => e.id === vue.ici) : undefined
  // La récompense d'une curiosité (v12) peut n'avoir qu'une carte, à côté d'une fiole et d'un talisman : elle n'est vide que sans rien.
  const vide = offre.jokers.length === 0 && !(offre.curiosite && (offre.talisman || offre.fiole))
  const deux = offre.aPrendre > 1
  // Aux rencontres, l'offre est de cartes — celle d'un adversaire tombé, d'une élite, d'un coffre.
  const v5 = !!vue.cartes
  const toucher = (cle: string) => setPris(p => (p.includes(cle) ? p.filter(x => x !== cle) : p.length < offre.aPrendre ? [...p, cle] : [...p.slice(1), cle]))
  const siens = vue.jokers ? [...vue.jokers.paquet, ...vue.jokers.main, ...vue.jokers.defausse] : []
  const nom = (cle: string) =>
    cle.startsWith(TALISMAN)
      ? (talismanDeCle(cle.slice(TALISMAN.length))?.nom ?? cle)
      : cle.startsWith(FIOLE)
        ? (fioleDe(cle.slice(FIOLE.length))?.nom ?? cle)
        : ((v5 ? carteDeRencontre(cle)?.nom : jokerDeCle(cle)?.nom) ?? cle)
  const t = offre.talisman ? talismanDeCle(offre.talisman) : undefined
  // La fiole d'un coffre (le codex) : à la place d'une carte, s'il lui reste une place pour elle — sinon elle dit pourquoi.
  const f = offre.fiole ? fioleDe(offre.fiole) : undefined
  const sacPlein = (vue.fioles?.tenues.length ?? 0) >= FIOLES_MAX
  if (v5) {
    return (
      <div className="player-shell expedition exp-offre">
        <Barre vue={vue} onPartir={onPartir} />
        <header className="exp-tete">
          <span className="label exp-surtitre">
            {/* Le trésor d'un gardien vaincu (le codex) : une carte légendaire de son codex parmi les trois — l'acte d'après est déjà ouvert. */}
            {offre.gardien
              ? `Le trésor ${duGardien(vue.gardiens[vue.acte - 1]?.cle ?? '')}`
              : offre.curiosite
                ? 'Curiosité trouvée'
                : ici?.sorte === 'coffre'
                  ? 'Un coffre'
                  : ici?.sorte === 'elite'
                    ? 'L’élite est tombée'
                    : 'L’adversaire est tombé'}
          </span>
          <h1>{vide ? 'La récompense est vide' : offre.curiosite ? 'Choisis ta récompense' : 'Choisis une carte'}</h1>
          {/* Ce que devient la carte prise est dans les règles ; seule la récompense vide se dit, qui surprend. */}
          {vide && <p className="muted">{espacesFines('L’horizon l’a vidée : c’était le prix de ton courage rendu.')}</p>}
        </header>
        {!vide && offre.jokers.length > 0 && <CartesAPrendre cles={offre.jokers} prises={pris} onToucher={toucher} />}
        {!vide && t && (
          <div className="exp-offres">
            {t && (
              <button
                type="button"
                className={'exp-offre-ligne exp-offre-talisman' + (pris.includes(TALISMAN + t.cle) ? ' exp-choisi' : '')}
                aria-pressed={pris.includes(TALISMAN + t.cle)}
                onClick={() => toucher(TALISMAN + t.cle)}
              >
                <span className="exp-offre-visage" aria-hidden="true">
                  <Icon name={ICONE_DU_TALISMAN[t.cle] ?? 'sparkles'} />
                </span>
                <span className="exp-joker">
                  <span className="exp-offre-nom">
                    <b>{t.nom}</b>
                    <span className="exp-rarete exp-rarete-talisman">talisman</span>
                  </span>
                  <span className="small">{espacesFines(t.effet)}</span>
                  <span className="muted small">Il agit seul, jusqu’au bout de l’expédition</span>
                </span>
              </button>
            )}
          </div>
        )}
        {!vide && f && (
          <div className="exp-offres">
            <button
              type="button"
              className={'exp-offre-ligne exp-offre-fiole' + (pris.includes(FIOLE + f.cle) ? ' exp-choisi' : '')}
              aria-pressed={pris.includes(FIOLE + f.cle)}
              aria-disabled={sacPlein || undefined}
              onClick={() => !sacPlein && toucher(FIOLE + f.cle)}
            >
              <span className="exp-offre-visage" aria-hidden="true">
                <VerreDeFiole cle={f.cle} />
              </span>
              <span className="exp-joker">
                <span className="exp-offre-nom">
                  <b>{f.nom}</b>
                  <span className="exp-rarete exp-rarete-fiole">fiole</span>
                </span>
                <span className="small">{espacesFines(effetDeLaFiole(f, vue.cartes?.v ?? 0))}</span>
                <span className="muted small">
                  {espacesFines(sacPlein ? `Tes ${FIOLES_MAX} places sont prises : bois-en une d’abord` : 'Elle ne sert qu’une fois, quand tu veux')}
                </span>
              </span>
            </button>
          </div>
        )}
        <section className="exp-paquet" aria-labelledby="exp-paquet-titre">
          <h2 className="label" id="exp-paquet-titre">{`Ton paquet · ${vue.cartes?.paquet.length ?? 0}`}</h2>
          <RangeeDeCartes cles={vue.cartes?.paquet ?? []} vide="Ton paquet est vide." nom="Ton paquet" onRegarder={setRegardee} />
        </section>
        {regardee && <CarteLevee cle={regardee} onReposer={() => setRegardee(null)} />}
        {erreur && (
          <p className="error" role="alert">
            {espacesFines(erreur)}
          </p>
        )}
        <div className="exp-depart-pied">
          <button
            type="button"
            className="btn btn-primary btn-big btn-block"
            aria-disabled={busy || (!vide && pris.length === 0) || undefined}
            onClick={() => {
              if (vide) onPrendre([])
              else if (pris.length > 0) {
                const talisman = pris.find(c => c.startsWith(TALISMAN))?.slice(TALISMAN.length)
                const fiole = pris.find(c => c.startsWith(FIOLE))?.slice(FIOLE.length) as CleDeFiole | undefined
                onPrendre(
                  pris.filter(c => !c.startsWith(TALISMAN) && !c.startsWith(FIOLE)),
                  talisman,
                  fiole,
                )
              }
            }}
          >
            {vide ? 'Continuer' : pris.length === 0 ? (offre.curiosite ? 'Choisis ta récompense' : 'Choisis une carte') : `Prendre « ${nom(pris[0])} »`}
          </button>
          {!vide && (
            <button type="button" className="btn btn-ghost btn-block" aria-disabled={busy || undefined} onClick={() => onPrendre([])}>
              {offre.coffre ? `Passer : +${ECUS_D_UN_COFFRE_LAISSE} écus` : 'Ne rien prendre'}
            </button>
          )}
        </div>
      </div>
    )
  }
  const prendre = () => {
    const talisman = pris.find(c => c.startsWith(TALISMAN))?.slice(TALISMAN.length)
    onPrendre(
      pris.filter(c => !c.startsWith(TALISMAN)),
      talisman,
    )
  }
  return (
    <div className="player-shell expedition exp-offre">
      <Barre vue={vue} onPartir={onPartir} />
      <header className="exp-tete">
        <span className="label exp-surtitre">{ici?.sorte === 'coffre' ? 'Un coffre' : 'L’élite est tombée'}</span>
        <h1>{vide ? 'Le coffre est vide' : deux ? 'Choisis deux jokers' : 'Choisis un joker'}</h1>
        <p className="muted">
          {espacesFines(
            vide
              ? 'L’horizon l’a vidé : c’était le prix de ta vie rendue.'
              : `Il rejoint ton paquet jusqu’au bout de l’expédition${deux ? ' : le trésor t’en donne deux' : ''}.${t ? ' Un talisman s’y cache : il prend la place d’un joker.' : ''}`,
          )}
        </p>
      </header>
      {!vide && (
        <div className="exp-offres">
          {offre.jokers.map(cle => {
            const j = jokerDeCle(cle)
            if (!j) return null
            return (
              <button key={cle} type="button" className={'exp-offre-ligne' + (pris.includes(cle) ? ' exp-choisi' : '')} aria-pressed={pris.includes(cle)} onClick={() => toucher(cle)}>
                <span className="exp-offre-visage" style={gemmeDuJoker(j)} aria-hidden="true">
                  <VisageDuJoker j={j} />
                </span>
                <span className="exp-joker">
                  <span className="exp-offre-nom">
                    <b>{j.nom}</b>
                    <span className={`exp-rarete exp-rarete-${j.rarete}`}>{RARETE[j.rarete]}</span>
                  </span>
                  <span className="small">{espacesFines(j.effet)}</span>
                  <span className="muted small">{SORTE[j.sorte]}</span>
                </span>
              </button>
            )
          })}
          {t && (
            <button
              type="button"
              className={'exp-offre-ligne exp-offre-talisman' + (pris.includes(TALISMAN + t.cle) ? ' exp-choisi' : '')}
              aria-pressed={pris.includes(TALISMAN + t.cle)}
              onClick={() => toucher(TALISMAN + t.cle)}
            >
              <span className="exp-offre-visage" aria-hidden="true">
                <Icon name={ICONE_DU_TALISMAN[t.cle] ?? 'sparkles'} />
              </span>
              <span className="exp-joker">
                <span className="exp-offre-nom">
                  <b>{t.nom}</b>
                  <span className="exp-rarete exp-rarete-talisman">talisman</span>
                </span>
                <span className="small">{espacesFines(t.effet)}</span>
                <span className="muted small">Il agit seul, jusqu’au bout de l’expédition</span>
              </span>
            </button>
          )}
        </div>
      )}
      <section className="exp-paquet" aria-labelledby="exp-paquet-titre">
        <h2 className="label" id="exp-paquet-titre">{`Tes jokers · ${siens.length}`}</h2>
        <Jetons cles={siens} vide="Aucun : ton paquet, ta main et ta défausse sont vides." />
      </section>
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <div className="exp-depart-pied">
        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          aria-disabled={busy || (!vide && pris.length === 0) || undefined}
          onClick={() => (vide ? onPrendre([]) : pris.length > 0 && prendre())}
        >
          {vide ? 'Continuer' : pris.length === 0 ? (deux ? 'Choisis deux jokers' : 'Choisis un joker') : pris.length === 1 ? `Prendre « ${nom(pris[0])} »` : 'Prendre ces deux-là'}
        </button>
        {!vide && (
          <button type="button" className="btn btn-ghost btn-block" aria-disabled={busy || undefined} onClick={() => onPrendre([])}>
            {offre.coffre ? `Passer : +${ECUS_D_UN_COFFRE_LAISSE} écus` : 'Ne rien prendre'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Le campement, au bout d'un acte (le brief, que les maquettes n'avaient
 * pas) : une vie de plus — ou un joker retiré de son paquet, pour tirer plus
 * souvent ses meilleurs ; au jeu complet, une carte améliorée. Puis le
 * gardien. Ses trois vies déjà là, améliorer — sinon retirer — s'offre
 * d'abord : le repos ne lui donnerait rien.
 */
function Campement({
  vue,
  busy,
  erreur,
  onCamper,
  onPartir,
}: {
  vue: VueDeLExpedition
  busy: boolean
  erreur: string
  onCamper: (choix: { retirer?: string; ameliorer?: string }) => void
  onPartir: () => void
}) {
  // Aux rencontres, le repos rend du courage, et l'on retire une carte de son paquet — ou, depuis le jeu complet, on
  // en améliore une : la forge de Slay the Spire.
  const courage = vue.courage
  const siens = vue.jokers ? comptes([...vue.jokers.paquet, ...vue.jokers.main, ...vue.jokers.defausse]) : vue.cartes ? comptesDesCartes(vue.cartes.paquet) : []
  const paquet = vue.cartes?.paquet ?? []
  const ameliorations = !!vue.cartes && vue.cartes.v >= VERSION_DU_JEU_COMPLET
  // Celles qu'il peut améliorer : la règle même du serveur (`refusDeLAmelioration`).
  const ameliorables = ameliorations ? paquet.filter(c => refusDeLAmelioration(paquet, c) === null) : []
  const plein = courage !== undefined ? courage >= COURAGE_MAX : vue.vies >= VIES
  // Le courage au plus haut, le repos ne donne rien : l'amélioration d'abord, sinon une carte à retirer.
  const [choix, setChoix] = useState<'repos' | 'retirer' | 'ameliorer'>(plein ? (ameliorables.length > 0 ? 'ameliorer' : siens.length > 0 ? 'retirer' : 'repos') : 'repos')
  const retirer = choix === 'retirer'
  const [cle, setCle] = useState<string | null>(null)
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const choisi = choix === 'ameliorer' ? (cle !== null && ameliorables.includes(cle) ? { cle, nom: carteDeRencontre(cle)?.nom ?? cle } : undefined) : siens.find(c => c.cle === cle)
  const choisir = (x: typeof choix) => {
    setChoix(x)
    setCle(null)
  }
  const repos =
    courage !== undefined
      ? plein
        ? 'Ton courage est au plus haut'
        : `+${Math.min(soinALAscension(COURAGE_D_UN_CAMPEMENT, vue.cartes?.v ?? 0, vue.cartes?.ascension ?? 0), COURAGE_MAX - courage)} de courage`
      : plein
        ? 'Tes trois vies sont là : le repos ne t’en donne pas de plus'
        : `Une vie de plus : ${vue.vies + 1} sur ${VIES}`
  const quoi = vue.cartes ? 'une carte' : 'un joker'
  return (
    <div className="player-shell expedition exp-camper">
      <Barre vue={vue} onPartir={onPartir} />
      <header className="exp-tete">
        <span className="label exp-surtitre">{`Campement · acte ${vue.acte + 1}`}</span>
        <h1>Une nuit au campement</h1>
        {/* En rencontres, pourquoi retirer une carte est dans les règles (la revue du 18 octobre 2026) : une phrase de moins. */}
        {!vue.cartes && (
          <p className="muted">{espacesFines(`Avant ${leGardien(gardien)} : une vie de plus, ou un joker de moins — un paquet plus court tire plus souvent tes meilleurs.`)}</p>
        )}
      </header>
      <div className="exp-choix-liste" role="radiogroup" aria-label="Ce que tu fais au campement">
        <button type="button" role="radio" aria-checked={choix === 'repos'} className={'exp-choix-ligne' + (choix === 'repos' ? ' exp-choisi' : '')} onClick={() => choisir('repos')}>
          <span className="exp-choix-icone" aria-hidden="true">
            <Icon name="heart" />
          </span>
          <span className="exp-gardien-texte">
            <b className="exp-gardien-nom">Te reposer</b>
            <span className="muted small">{repos}</span>
          </span>
        </button>
        {ameliorations && (
          <button
            type="button"
            role="radio"
            aria-checked={choix === 'ameliorer'}
            aria-disabled={ameliorables.length === 0 || undefined}
            className={'exp-choix-ligne' + (choix === 'ameliorer' ? ' exp-choisi' : '')}
            onClick={() => ameliorables.length > 0 && choisir('ameliorer')}
          >
            <span className="exp-choix-icone" aria-hidden="true">
              <Icon name="arrow-up" />
            </span>
            <span className="exp-gardien-texte">
              <b className="exp-gardien-nom">Améliorer une carte</b>
              {ameliorables.length === 0 && <span className="muted small">Tu n’as plus de carte à améliorer</span>}
            </span>
          </button>
        )}
        <button
          type="button"
          role="radio"
          aria-checked={retirer}
          aria-disabled={siens.length === 0 || undefined}
          className={'exp-choix-ligne' + (retirer ? ' exp-choisi' : '')}
          onClick={() => siens.length > 0 && choisir('retirer')}
        >
          <span className="exp-choix-icone" aria-hidden="true">
            <Icon name="trash" />
          </span>
          <span className="exp-gardien-texte">
            <b className="exp-gardien-nom">{`Retirer ${quoi}`}</b>
            {(siens.length === 0 || !vue.cartes) && (
              <span className="muted small">{siens.length > 0 ? 'Il quitte ton paquet jusqu’au bout de l’expédition' : `Tu n’as plus ${vue.cartes ? 'de carte' : 'de joker'} à retirer`}</span>
            )}
          </span>
        </button>
      </div>
      {/* En rencontres, la carte à retirer se choisit parmi ses vraies cartes, comme une offre — en pastilles, une ligne de noms de plus. */}
      {retirer && vue.cartes && (
        <RangeeDeCartes cles={vue.cartes.paquet} vide="Ton paquet est vide." nom="La carte à retirer" choisie={cle} onRegarder={setCle} />
      )}
      {/* La carte à améliorer, parmi celles qui le peuvent ; choisie, ce qu'elle deviendrait, côte à côte. */}
      {choix === 'ameliorer' && (
        <>
          <RangeeDeCartes cles={ameliorables} vide="Aucune carte à améliorer." nom="La carte à améliorer" choisie={cle} onRegarder={setCle} />
          {choisi && <AvantApres cle={choisi.cle} />}
        </>
      )}
      {retirer && !vue.cartes && (
        <div className="exp-a-retirer" role="group" aria-label="Le joker à retirer">
          {siens.map(c => (
            <button key={c.cle} type="button" className={'pill-btn' + (cle === c.cle ? ' active' : '')} aria-pressed={cle === c.cle} onClick={() => setCle(c.cle)}>
              {c.n > 1 ? `${c.nom} ×${c.n}` : c.nom}
            </button>
          ))}
        </div>
      )}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <div className="exp-depart-pied">
        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          aria-disabled={busy || (choix !== 'repos' && !choisi) || undefined}
          onClick={() => (choix === 'repos' ? onCamper({}) : choisi && onCamper(choix === 'retirer' ? { retirer: choisi.cle } : { ameliorer: choisi.cle }))}
        >
          {espacesFines(
            choix === 'ameliorer'
              ? choisi
                ? `Améliorer « ${choisi.nom} »`
                : 'Choisis la carte à améliorer'
              : retirer
                ? choisi
                  ? `Retirer « ${choisi.nom} »`
                  : vue.cartes
                    ? 'Choisis la carte à retirer'
                    : 'Choisis le joker à retirer'
                : 'Te reposer',
          )}
        </button>
      </div>
    </div>
  )
}

/** Un article de l'échoppe : ce qu'il achète, et le joker qu'il vise. */
type Article = { article: ArticleDeLEchoppe; joker?: string }

/** Une ligne de l'étal : l'article, ce qu'on en lit — une carte des rencontres se dit par sa ligne à elle (`LigneDeCarte`). */
type LigneDeLEtal = { cle: string; article: Article; nom: string; detail: string; visage: ReactNode; rarete?: string; carte?: NonNullable<ReturnType<typeof carteDeRencontre>> }

/**
 * L'échoppe (l'étape 4) — ou le marchand de l'inconnu — : ce que ses écus
 * achètent, chaque article une fois — une vie, l'un de ses trois jokers, son
 * talisman, un joker retiré de son paquet ; au codex, sa fiole, que la barre
 * boira quand il voudra ; depuis le jeu complet, une carte de son paquet
 * améliorée, choisie en vraies cartes. Un article se choisit, puis
 * s'achète : un toucher perdu sous le pouce ne coûte rien. Ce qui ne
 * s'achète pas dit pourquoi, de la même règle que le serveur
 * (`refusDeLAchat`). Elle se quitte en reprenant la route : le pas suivant
 * la ferme, sans geste de plus.
 */
function Echoppe({
  vue,
  echoppe,
  busy,
  erreur,
  onAcheter,
  onReprendre,
  onPartir,
}: {
  vue: VueDeLExpedition
  echoppe: NonNullable<VueDeLExpedition['echoppe']>
  busy: boolean
  erreur: string
  onAcheter: (article: ArticleDeLEchoppe, joker?: string) => void
  onReprendre: () => void
  onPartir: () => void
}) {
  const [choisi, setChoisi] = useState<string | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
  const [aAmeliorer, setAAmeliorer] = useState<string | null>(null)
  const ecus = vue.ecus ?? 0
  // Aux rencontres, l'échoppe vend du courage et des cartes ; on y retire une carte de son paquet.
  const v5 = vue.courage !== undefined
  const siens = vue.jokers ? comptes([...vue.jokers.paquet, ...vue.jokers.main, ...vue.jokers.defausse]) : vue.cartes ? comptesDesCartes(vue.cartes.paquet) : []
  const etat = {
    issue: vue.issue,
    echoppe,
    ecus,
    vies: vue.vies,
    paquet: vue.jokers?.paquet ?? vue.cartes?.paquet ?? [],
    defausse: vue.jokers?.defausse ?? [],
    main: vue.jokers?.main ?? [],
    talismans: vue.talismans ?? [],
    ...(v5 && { courage: vue.courage }),
    fioles: vue.fioles?.tenues ?? [],
  }
  const t = echoppe.talisman ? talismanDeCle(echoppe.talisman) : undefined
  const f = echoppe.fiole ? fioleDe(echoppe.fiole) : undefined
  const nomDe = (cle: string) => (v5 ? carteDeRencontre(cle)?.nom : jokerDeCle(cle)?.nom) ?? cle
  // L'étal, dans l'ordre où l'on pense : se soigner — tout de suite, ou plus tard d'une fiole —, s'équiper, puis s'alléger.
  const etal: LigneDeLEtal[] = [
    v5
      ? { cle: 'vie', article: { article: 'vie' }, nom: 'Du courage', detail: `+${soinALaVersion(COURAGE_A_L_ECHOPPE, vue.cartes?.v ?? 0)} · tu en as ${vue.courage} sur ${COURAGE_MAX}`, visage: <Icon name="heart" /> }
      : { cle: 'vie', article: { article: 'vie' }, nom: 'Une vie', detail: `Tu en as ${vue.vies} sur ${VIES}`, visage: <Icon name="heart" /> },
    ...(f ? [{ cle: 'fiole', article: { article: 'fiole' as const }, nom: f.nom, detail: `${effetDeLaFiole(f, vue.cartes?.v ?? 0)} · elle se boit quand tu veux`, visage: <VerreDeFiole cle={f.cle} />, rarete: 'fiole' }] : []),
    ...echoppe.jokers.flatMap((cle): LigneDeLEtal[] => {
      if (v5) {
        const c = carteALaVersion(cle, vue.cartes?.v ?? VERSION_DU_CODEX)
        return c ? [{ cle, article: { article: 'joker', joker: cle }, nom: c.nom, detail: c.effet, visage: null, carte: c }] : []
      }
      const j = jokerDeCle(cle)
      return j ? [{ cle, article: { article: 'joker', joker: cle }, nom: j.nom, detail: j.effet, visage: <VisageDuJoker j={j} />, rarete: j.rarete }] : []
    }),
    ...(t ? [{ cle: 'talisman', article: { article: 'talisman' as const }, nom: t.nom, detail: t.effet, visage: <Icon name={ICONE_DU_TALISMAN[t.cle] ?? 'sparkles'} />, rarete: 'talisman' }] : []),
    // Le jeu complet : une carte de son paquet améliorée, la règle même du campement.
    ...(echoppe.ameliorer
      ? [{ cle: 'ameliorer', article: { article: 'ameliorer' as const }, nom: 'Améliorer une carte', detail: 'Une carte de ton paquet, en mieux, jusqu’au bout de l’expédition', visage: <Icon name="arrow-up" /> }]
      : []),
    v5
      ? { cle: 'retirer', article: { article: 'retirer' }, nom: 'Retirer une carte', detail: 'Elle quitte ton paquet jusqu’au bout de l’expédition', visage: <Icon name="trash" /> }
      : { cle: 'retirer', article: { article: 'retirer' }, nom: 'Retirer un joker', detail: 'Il quitte ton paquet jusqu’au bout de l’expédition', visage: <Icon name="trash" /> },
  ]
  const ligne = etal.find(x => x.cle === choisi)
  const vise: Article | null = ligne
    ? ligne.article.article === 'retirer'
      ? { article: 'retirer', ...(aRetirer && { joker: aRetirer }) }
      : ligne.article.article === 'ameliorer'
        ? { article: 'ameliorer', ...(aAmeliorer && { joker: aAmeliorer }) }
        : ligne.article
    : null
  // « Retirer » ou « Améliorer » sans carte choisie : le refus attend le choix, il ne dit pas encore « pas dans ton paquet ».
  const sansCarte = !!vise && (vise.article === 'retirer' || vise.article === 'ameliorer') && !vise.joker
  const refus = vise && !sansCarte ? refusDeLAchat(etat, vise) : null
  // Celles qu'il peut améliorer : la règle même du serveur (`refusDeLAmelioration`).
  const ameliorables = echoppe.ameliorer ? etat.paquet.filter(c => refusDeLAmelioration(etat.paquet, c) === null) : []
  const prix = (a: Article) => prixDeLArticle(a.article, a.joker)
  const marchand = vue.inconnu?.contenu === 'marchand'
  return (
    <div className="player-shell expedition exp-echoppe-page">
      <Barre vue={vue} onPartir={onPartir} />
      <header className="exp-tete">
        <span className="label exp-surtitre">{marchand ? 'L’inconnu : un marchand' : 'Une échoppe'}</span>
        <h1>Ce que tes écus achètent</h1>
        <p className="muted">{espacesFines(`Tu as ${ecus} écu${ecus > 1 ? 's' : ''}. Chaque article une fois ; tes écus restent dans l’expédition.`)}</p>
      </header>
      <div className="exp-offres" role="radiogroup" aria-label="L’étal">
        {etal.map(x => {
          const achete = echoppe.achats.includes(x.cle)
          return (
            <button
              key={x.cle}
              type="button"
              role="radio"
              aria-checked={choisi === x.cle}
              aria-disabled={achete || undefined}
              className={'exp-offre-ligne' + (choisi === x.cle ? ' exp-choisi' : '') + (achete ? ' exp-achete' : '')}
              onClick={() => !achete && setChoisi(x.cle)}
            >
              {x.carte ? (
                <LigneDeCarte c={x.carte} prix={<span className="exp-prix">{achete ? 'Achetée' : <Prix n={prix(x.article)} />}</span>} />
              ) : (
                <>
                  <span
                    className="exp-offre-visage"
                    style={
                      !x.rarete || x.rarete === 'talisman' || x.rarete === 'fiole'
                        ? undefined
                        : x.rarete === 'maudit'
                          ? GEMME_MAUDITE
                          : gemme(GEMME_DU_JOKER[x.rarete as Exclude<Joker['rarete'], 'maudit'>])
                    }
                    aria-hidden="true"
                  >
                    {x.visage}
                  </span>
                  <span className="exp-joker">
                    <span className="exp-offre-nom">
                      <b>{x.nom}</b>
                      {x.rarete && (
                        <span className={`exp-rarete exp-rarete-${x.rarete}`}>{x.rarete === 'talisman' || x.rarete === 'fiole' ? x.rarete : RARETE[x.rarete as Joker['rarete']]}</span>
                      )}
                    </span>
                    <span className="small">{espacesFines(x.detail)}</span>
                  </span>
                  <span className="exp-prix">{achete ? 'Acheté' : <Prix n={prix(x.article)} />}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      {choisi === 'retirer' && (
        <div className="exp-a-retirer" role="group" aria-label={v5 ? 'La carte à retirer' : 'Le joker à retirer'}>
          {siens.map(c => (
            <button key={c.cle} type="button" className={'pill-btn' + (aRetirer === c.cle ? ' active' : '')} aria-pressed={aRetirer === c.cle} onClick={() => setARetirer(c.cle)}>
              {c.n > 1 ? `${c.nom} ×${c.n}` : c.nom}
            </button>
          ))}
        </div>
      )}
      {/* La carte à améliorer : en vraies cartes, comme au campement — ce qu'elle deviendrait, côte à côte. */}
      {choisi === 'ameliorer' && (
        <>
          <RangeeDeCartes cles={ameliorables} vide="Aucune carte à améliorer." nom="La carte à améliorer" choisie={aAmeliorer} onRegarder={setAAmeliorer} />
          {aAmeliorer && <AvantApres cle={aAmeliorer} />}
        </>
      )}
      {refus && <p className="exp-refus small">{espacesFines(refus)}</p>}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <div className="exp-depart-pied">
        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          aria-disabled={busy || !vise || refus !== null || sansCarte || undefined}
          onClick={() => vise && !busy && refus === null && !sansCarte && onAcheter(vise.article, vise.joker)}
        >
          {/* Passé à la ligne, un guillemet restait seul au bout : les espaces fines les tiennent à leur nom. */}
          {espacesFines(
            !vise || !ligne
              ? 'Choisis un article'
              : vise.article === 'retirer'
                ? vise.joker
                  ? `Retirer « ${nomDe(vise.joker)} » · ${prix(vise)} écus`
                  : v5
                    ? 'Choisis la carte à retirer'
                    : 'Choisis le joker à retirer'
                : vise.article === 'ameliorer'
                  ? vise.joker
                    ? `Améliorer « ${nomDe(vise.joker)} » · ${prix(vise)} écus`
                    : 'Choisis la carte à améliorer'
                  : `Acheter « ${ligne.nom} » · ${prix(vise)} écus`,
          )}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onReprendre}>
          Reprendre la route
        </button>
      </div>
    </div>
  )
}

/** Un prix en écus, sa pièce devant. */
function Prix({ n }: { n: number }) {
  return (
    <>
      <Icon name="ecu" />
      {n}
    </>
  )
}

/**
 * L'inconnu dévoilé (l'étape 4) : un piège — une vie de moins, peut-être la
 * dernière —, ou un légendaire de passage, son joker dans la main jusqu'au
 * bout de l'acte. Le marchand, lui, ouvre son échoppe.
 */
function Inconnu({ vue, onSuite }: { vue: VueDeLExpedition; onSuite: () => void }) {
  const dedans = vue.inconnu
  const perdue = vue.issue === 'perdue'
  const legendaire = dedans?.contenu === 'passage' ? dedans.legendaire : undefined
  return (
    <div className="player-shell expedition exp-vaincu exp-inconnu">
      <span className="exp-pastille exp-pastille-or">L’inconnu</span>
      {legendaire ? (
        <>
          <Medaillon cle={legendaire} grand className="exp-medaillon exp-medaillon-grand" />
          <h1>{`${nomDuGardien(legendaire)} est de passage`}</h1>
          <p className="muted">
            {espacesFines(
              vue.cartes
                ? 'Sa carte rejoint ton paquet jusqu’au bout de l’acte : tes rencontres la tireront.'
                : 'Son joker est dans ta main, jusqu’au bout de l’acte : joue-le avant le gardien.',
            )}
          </p>
          <p className="card exp-joker-carte">{vue.cartes ? <SaCarte cle={legendaire} /> : <SonJoker cle={legendaire} />}</p>
        </>
      ) : (
        <>
          <span className="exp-inconnu-piege" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <h1>Un piège !</h1>
          <p className="muted">
            {espacesFines(
              vue.courage !== undefined
                ? perdue
                  ? 'Il t’a pris tout ton courage : l’expédition s’arrête là.'
                  : `Il te coûte ${COURAGE_D_UN_PIEGE} de courage : il t’en reste ${vue.courage}.`
                : perdue
                  ? 'Il t’a pris ta dernière vie : l’expédition s’arrête là.'
                  : `Il te coûte une vie : il t’en reste ${vue.vies}.`,
            )}
          </p>
        </>
      )}
      {vue.courage !== undefined ? <Courage n={vue.courage} /> : <Vies restantes={vue.vies} />}
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={onSuite}>
        {perdue ? 'Voir la fin' : 'Reprendre la route'}
        <Icon name="chevron-right" />
      </button>
    </div>
  )
}

/**
 * Le choix au bout de l'acte 3 (la maquette 9, sans l'Ascension, qui viendra
 * plus tard) : les trois gardiens vaincus, un à garder — définitif. Celui
 * qu'il a déjà le dit : le garder ne rapporte rien de plus.
 */
function ChoixDuLegendaire({ vue, busy, erreur, onGarder }: { vue: VueDeLExpedition; busy: boolean; erreur: string; onGarder: (cle: string) => void }) {
  const [choisi, setChoisi] = useState(() => (vue.gardiens.find(g => !g.aLui) ?? vue.gardiens[0]).cle)
  const g = vue.gardiens.find(x => x.cle === choisi)
  return (
    <div className="player-shell expedition exp-choix">
      <header className="exp-tete">
        <span className="label exp-surtitre">Fin de l’expédition</span>
        <h1>Trois gardiens vaincus</h1>
        <p className="muted">{espacesFines('Un seul part avec toi. Les deux autres repartent sur les routes : tu les recroiseras.')}</p>
      </header>
      <div className="exp-choix-liste" role="radiogroup" aria-label="Le gardien que tu gardes">
        {vue.gardiens.map(x => (
          <button
            key={x.cle}
            type="button"
            role="radio"
            aria-checked={x.cle === choisi}
            className={'exp-choix-ligne' + (x.cle === choisi ? ' exp-choisi' : '')}
            onClick={() => setChoisi(x.cle)}
          >
            <Medaillon cle={x.cle} className="exp-medaillon" />
            <span className="exp-gardien-texte">
              <b className="exp-gardien-nom">
                {nomDuGardien(x.cle)}
                {x.aLui ? <span className="exp-pastille">déjà à toi</span> : laSaison(vue.saison)?.legendaire === x.cle && <span className="exp-pastille exp-pastille-or">de saison</span>}
              </b>
              {vue.cartes ? <SaCarte cle={x.cle} /> : <SonJoker cle={x.cle} />}
            </span>
          </button>
        ))}
      </div>
      {g?.aLui && <p className="muted small">{espacesFines(`${nomDuGardien(g.cle)} est déjà à toi : le garder ne te rapporte rien de plus.`)}</p>}
      {/* Le légendaire de la saison du départ : en expédition, la seule fois qu'il se garde avant sa saison suivante. */}
      {g && !g.aLui && laSaison(vue.saison)?.legendaire === g.cle && (
        <p className="muted small">{espacesFines(`${nomDuGardien(g.cle)} ne garde une expédition qu’à sa saison : ${gardienAuFeminin(g.cle) ? 'la' : 'le'} laisser, c’est l’attendre jusqu’à la prochaine.`)}</p>
      )}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => onGarder(choisi)}>
        {`Garder ${leGardien(choisi)}`}
      </button>
    </div>
  )
}

// ── La fin ──────────────────────────────────────────────────────────────────

/**
 * La fin d'une expédition — gardée, perdue, abandonnée — par l'écran des
 * gains de tous les modes (l'écran A) : le légendaire gardé d'abord, puis ce
 * que la visite a rapporté, les trophées, ce qu'ils ouvrent ; le corrigé, et
 * une autre expédition. Exportée pour `gains.test.ts`, qui la rend.
 */
export function FinDeLExpedition({
  fin,
  gains,
  erreur,
  onCorrection,
  onAutre,
}: {
  fin: Extract<Ecran, { e: 'fin' }>
  gains: GainsDeLExpedition
  erreur: string
  onCorrection: () => void
  onAutre: () => void
}) {
  const { vue, tombe } = fin
  const recompenses = tombe.recompenses ?? []
  const cles = recompenses.map(x => x.key)
  // Le profil relu porte aussi sa niche : la luciole qui vient d'arriver s'y montre tout de suite.
  const niveau = useNiveauRelu(gains.xp > 0 || cles.length > 0 || !!tombe.compagnon)
  const gardee = vue.issue === 'legendaire' && vue.garde ? vue.garde : null
  const nouveau = gardee !== null && (tombe.legendaires ?? []).includes(gardee)
  const acte = Math.min(vue.acte, ACTES - 1) + 1
  const vaincus = vue.gardiens.filter(g => g.vaincu).length
  const s = vue.justes > 1 ? 's' : ''
  // L'Ascension : le cran où elle est partie, et celui que sa victoire ouvre — s'il passe au-dessus de ceux qu'il avait en partant.
  const cran = vue.cartes?.ascension ?? 0
  const ouverteAuDepart = vue.cartes?.codex?.ascensionOuverte
  const cranOuvert = (vue.issue === 'au-bout' || vue.issue === 'legendaire') && ouverteAuDepart !== undefined ? cranOuvertParLaVictoire(cran, ouverteAuDepart) : null
  return (
    <div className="player-shell expedition">
      <Sortie />
      <header className="fin-tete exp-fin-tete">
        <span className="label">{`L’Expédition n° ${formatNumber(vue.numero)}`}</span>
        <h1>{gardee ? (nouveau ? `${nomDuGardien(gardee)} est à toi` : 'Expédition accomplie') : vue.issue === 'abandonnee' ? 'Expédition abandonnée' : 'L’expédition s’arrête là'}</h1>
        <p className="muted small">
          {gardee
            ? `Trois gardiens vaincus${cran > 0 ? ` au cran ${cran} de l’Ascension` : ''}, ${vue.justes} bonne${s} réponse${s}.`
            : `Acte ${acte}${cran > 0 ? ` · Ascension ${cran}` : ''} · ${vaincus} gardien${vaincus > 1 ? 's' : ''} vaincu${vaincus > 1 ? 's' : ''} · ${vue.justes} bonne${s} réponse${s}.`}
        </p>
        {gardee && !nouveau && <p className="muted small">{espacesFines(`${nomDuGardien(gardee)} était déjà à toi : ton expédition te rapporte l’expérience de tes réponses.`)}</p>}
        {/* Les écus meurent avec l'expédition (le brief) : la fin le dit, une fois. */}
        {vue.ecus !== undefined && vue.ecus > 0 && (
          <p className="muted small">{espacesFines(`Tes ${vue.ecus} écus restent dans l’expédition : ils ne deviennent jamais des confettis.`)}</p>
        )}
        {gains.tampons.length > 0 && (
          <p className="exp-fin-tampons">
            <Icon name="tampon" />
            {espacesFines(
              `${gains.tampons.length > 1 ? `${gains.tampons.length} tampons neufs` : 'Un tampon neuf'} à ton passeport : ${gains.tampons.map(x => sujetParCle(x)?.nom ?? x).join(', ')}.`,
            )}
          </p>
        )}
      </header>
      {(tombe.legendaires ?? []).map(cle => (
        <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
      ))}
      {tombe.compagnon && <CompagnonRejoint cle={tombe.compagnon} />}
      {/* Le codex (v7) : la renommée qu'elle rapporte, perdue aussi, et le niveau qu'elle fait passer. */}
      {vue.cartes?.codex && vue.renommee !== undefined && (
        <RenommeeGagnee avant={vue.cartes.codex.renommee ?? 0} gagnee={vue.renommee} exploits={exploitsNeufs(vue)} ascension={cranOuvert} />
      )}
      <CeQueTuGagnes
        parts={partsDeLXp([
          { nom: 'tes bonnes réponses', xp: gains.xp },
          { nom: 'tes trophées', xp: xpDesTrophees(cles) },
        ])}
        confettis={gains.justes}
        niveau={niveau}
      />
      <NouveauxTrophees trophees={tropheesTombes(recompenses)} lien />
      <APorter objets={[...aPorterDesTrophees(cles), ...emojisAPorter(niveau)]} />
      {/* Ses missions du jour, si l'expédition en a fait. */}
      <MissionsAccomplies key={vue.id} profil />
      {!gardee && (
        <p className="muted small carnet-rappel">
          {'Les questions ratées reviendront à ton '}
          <a className="link-inline" href="/campagne#carnet">
            carnet
          </a>
          .
        </p>
      )}
      {erreur && <p className="error">{espacesFines(erreur)}</p>}
      <div className="fin-actions">
        <button type="button" className="btn btn-primary btn-big btn-block" onClick={onAutre}>
          <Icon name="flag" />
          Une autre expédition
        </button>
        {fin.correction ? (
          <SerieCorrigee correction={fin.correction} />
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={onCorrection}>
            Mes réponses
          </button>
        )}
      </div>
    </div>
  )
}

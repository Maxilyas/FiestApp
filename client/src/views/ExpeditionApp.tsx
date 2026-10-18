import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError, api, motifDe } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { Shape } from '../components/Shape'
import { Feuille, GesteDuBas, PieceTete, Sortie } from '../components/Pieces'
import { Vies } from '../components/Vies'
import { Balise } from '../components/Balise'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { LegendaireOuvert } from '../components/Ouverts'
import { SerieCorrigee } from '../components/SerieCorrigee'
import { APorter, CeQueTuGagnes, MissionsAccomplies, NouveauxTrophees, emojisAPorter, retenirLeNiveau, useNiveauRelu } from '../components/Gains'
import { GerbeDeJuste } from '../components/Gerbe'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { espacesFines, formatNumber } from '../format'
import { showToast } from '../state'
import { porterTheme } from '../themeJoueur'
import { porterGerbe } from '../gerbe'
import { gemme } from '../gemmes'
import { useModale } from '../modale'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { iconeDuSujet } from '../iconeDuSujet'
import { aPorterDesTrophees, partsDeLXp, tropheesTombes, xpDesTrophees } from '../../../shared/gains'
import { NOM_NIVEAU, SIGNALEMENT_MAX, VIES, type CorrectionDeCampagne, type Niveau } from '../../../shared/campagne'
import { couleurDePiste } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { saison as laSaison, type Saison } from '../../../shared/saisons'
import type { RareteDeTheme } from '../../../shared/themes'
import { hautFait } from '../../../shared/hautsfaits'
import { CATEGORIES } from '../../../shared/categories'
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
import {
  ACTES,
  ECUS_D_UN_COFFRE_LAISSE,
  ECUS_D_UN_GARDIEN,
  ETAGES,
  GARDIEN,
  MARCHES_DES_ACTES,
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
  type ApresUnGeste,
  type ArticleDeLEchoppe,
  type CarteDUnActe,
  type ContenuDeLInconnu,
  type EscaleDeLaCarte,
  type JokersEnJeu,
  type PageDeLExpedition,
  type QuestionDExpedition,
  type ReponseDExpedition,
  type SensDeLOracle,
  type ThemeDEscale,
  type VueDeLExpedition,
} from '../../../shared/expedition'
import {
  CARTES_DES_ACTES,
  CARTES_DES_RENCONTRES,
  COURAGE_A_L_ECHOPPE,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UN_PIEGE,
  COURAGE_D_UNE_SOURCE,
  COURAGE_MAX,
  FAMILLES_DE_CARTES,
  carteDeRencontre,
  carteDuLegendaire,
  estDeRoute,
  paquetDesRencontres,
  sceauxDe,
  type CarteDeRencontre,
} from '../../../shared/rencontres'
import {
  Adversaire,
  Apercu,
  AuDepart,
  BoutonDesRegles,
  COURT,
  CarteLevee,
  CartesAPrendre,
  Courage,
  FeuilleDesCartes,
  FeuilleDesRegles,
  LigneDeCarte,
  RangeeDeCartes,
  MainDeRencontre,
  PreparationDeLaRencontre,
  ToutesLesCartes,
  VisageDeLaCarte,
  ceQueLaCarteAFait,
  changementDeLaCarte,
  comptesDesCartes,
  feticheRetenue,
  gemmeDeLaCarte,
  origineDeLaCarte,
  pourcents,
  rencontresRetenues,
  retenirLesRencontres,
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

type Fin = { recompenses?: PalierTombe[]; legendaires?: string[] }

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
   * posés : ce que la réponse a coûté se lit de l'écart.
   */
  | { e: 'route'; vue: VueDeLExpedition; question?: QuestionDExpedition; reponse?: ReponseDExpedition; choix?: number; avant?: VueDeLExpedition }
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

/** Ce qu'une escale pose : « Histoire », « Histoire, Sport », « Les années 80 ». */
function nomDuTheme(theme: ThemeDEscale | undefined): string {
  if (!theme) return ''
  if ('sujet' in theme) return sujetParCle(theme.sujet)?.nom ?? 'Un thème pointu'
  return theme.categories.join(', ')
}

/** Le nom court d'un thème sous une escale : « Histoire », « Mélange ×2 », « Les années 80 ». */
function nomCourtDuTheme(t: ThemeDEscale | undefined): string {
  if (!t) return 'Question'
  if ('sujet' in t) return sujetParCle(t.sujet)?.nom ?? 'Thème pointu'
  return t.categories.length > 1 ? `Mélange ×${t.categories.length}` : (COURT[t.categories[0]] ?? t.categories[0])
}

/** Ce que cache l'inconnu, en un mot sous l'escale. */
const CONTENU: Record<ContenuDeLInconnu, string> = { marchand: 'Marchand', piege: 'Piège', passage: 'De passage' }

/** Ce qu'on lit sous l'escale, sur la carte. */
function etiquette(e: EscaleDeLaCarte, acte: number, gardiens: readonly { cle: string }[]): string {
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
 * phrase non plus.
 */
function decrire(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'acte' | 'gardiens' | 'moyen' | 'vies' | 'jokers' | 'ecus' | 'cartes'>, carte: CarteDUnActe): string {
  if (vue.cartes) return decrireEnRencontres(e, vue, carte)
  const qui = vue.moyen ? 'pour un joueur moyen' : 'pour toi'
  // Ce qu'elle paie, trouvée (l'étape 4) : sa chance dite, la carte peut le dire — sous L'écholocation, ni l'une ni l'autre.
  const prix = vue.ecus !== undefined && e.chance !== undefined && (e.sorte === 'question' || e.sorte === 'elite') ? ` · ${prixDeLEscale(e)} écus` : ''
  const chance = e.chance === undefined ? '' : ` · ${pourcents(e.chance)} ${qui}${prix}`
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
    if (vue.jokers && carte.chanceDuGardien === undefined) return regle
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
 * Ce qu'une escale cache, au prototype des rencontres : une escale à question
 * est un adversaire — les points à lui faire perdre, sa chance par question —, le courage
 * remplace les vies, une carte les jokers.
 */
function decrireEnRencontres(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'acte' | 'gardiens' | 'moyen' | 'ecus'>, carte: CarteDUnActe): string {
  const qui = vue.moyen ? 'pour un joueur moyen' : 'pour toi'
  const prix = e.chance !== undefined && (e.sorte === 'question' || e.sorte === 'elite') ? ` · ${prixDeLEscale(e)} écus à la victoire` : ''
  const chance = e.chance === undefined ? '' : ` · ${pourcents(e.chance)} par question ${qui}${prix}`
  if (e.sorte === 'source') return `Une source : une question de ton carnet. Retrouvée, elle te rend ${COURAGE_D_UNE_SOURCE} de courage ; ratée, elle ne coûte rien${chance}`
  if (e.sorte === 'campement') return `Un campement : ${COURAGE_D_UN_CAMPEMENT} de courage — ou une carte retirée de ton paquet`
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
    return `${nomDuGardien(g)}, gardien de l’acte : ${sceauxDe('gardien', acte)} points à lui faire perdre, en questions ${MARCHE[m.gardien]}s${p === undefined ? '' : ` · ${pourcents(p)} par question ${qui}`}`
  }
  const t = e.theme
  const quoi = !t ? 'Une question' : 'sujet' in t ? `Thème pointu : ${nomDuTheme(t)}` : t.categories.length > 1 ? `Mélange : ${nomDuTheme(t)}` : nomDuTheme(t)
  const tampon = e.aTamponner ? ' · un tampon neuf pour ton passeport' : ''
  if (e.sorte === 'elite') return `Une élite, ${quoi.charAt(0).toLowerCase()}${quoi.slice(1)} · ${MARCHE[marcheDe(vue.acte, e)]} : ${sceauxDe('elite', acte)} points à lui faire perdre. Tombée, une carte au choix, plus souvent rare${chance}${tampon}`
  return `${quoi} · ${MARCHE[marcheDe(vue.acte, e)]} : un adversaire, ${sceauxDe('question', acte)} points à lui faire perdre${chance}${tampon}`
}

// ── Les jokers ──────────────────────────────────────────────────────────────

/** Ce qu'est un joker, en une ligne : quand il se joue. */
const SORTE: Record<SorteDeJoker, string> = {
  jouer: 'À jouer sur une question, puis défaussé',
  poser: 'À poser : il agit jusqu’au bout de l’acte',
  carte: 'Sur la carte, entre deux escales',
}
const SORTE_COURTE: Record<SorteDeJoker, string> = { jouer: 'à jouer', poser: 'à poser', carte: 'sur la carte' }
const RARETE: Record<Joker['rarete'], string> = { commun: 'commun', rare: 'rare', maudit: 'maudit', legendaire: 'légendaire' }

/**
 * La couleur d'un joker, au cadre de sa carte : la gemme de sa rareté, celle
 * de l'album et de la boutique (`gemmes.ts`) — argent, bleu, or —, et le
 * pourpre de l'épique pour un maudit, plus fort mais qui coûte. Une seule
 * couleur par rareté dans toute l'application.
 */
const GEMME_DU_JOKER: Record<Joker['rarete'], RareteDeTheme> = { commun: 'commune', rare: 'rare', maudit: 'epique', legendaire: 'legendaire' }
const gemmeDuJoker = (j: Joker) => gemme(GEMME_DU_JOKER[j.rarete])

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
  vue: Pick<VueDeLExpedition, 'ecus' | 'vies' | 'talismans' | 'jokers' | 'courage' | 'rencontre' | 'cartes' | 'carte'>
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
  return (
    <div className="exp-barre">
      {!sansSortie && <Sortie vers="Partir" href="/expedition" onClick={onPartir} />}
      <BoutonDesRegles onOuvrir={() => setRegles(true)} />
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
      {vue.ecus !== undefined && <Ecus n={vue.ecus} />}
      {/* En rencontres (le prototype), le courage remplace les trois vies. */}
      {vue.courage !== undefined ? <Courage n={vue.courage} /> : <Vies restantes={vue.vies} />}
      {regles && (
        <FeuilleDesRegles
          rencontres={vue.courage !== undefined}
          parQuestion={vue.cartes?.parQuestion}
          // Sur la carte, la carte d'abord ; en rencontre, l'ordre où l'on joue.
          debut={vue.rencontre ? undefined : vue.carte ? 'carte' : undefined}
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
    return pieges === 0 ? 'La lanterne éclaire l’acte : aucun piège sur cette carte' : `La lanterne montre ${pieges === 1 ? 'un piège' : `${pieges} pièges`} sur la carte`
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
        // Le thème de son profil habille la page, comme la campagne ; sa gerbe éclate à ses bonnes réponses.
        void porterTheme(moi.profile?.theme)
        porterGerbe(moi.profile?.gerbe)
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

  /** Partir — aux rencontres, là où le prototype s'ouvre et s'il le garde, avec sa catégorie fétiche. */
  const partir = async (equipee: readonly string[], rencontres: { fetiche: string | null } | null) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const vue = await api.expedition.partir(equipee, rencontres ? { rencontres: true, ...(rencontres.fetiche && { fetiche: rencontres.fetiche }) } : {})
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

  /** Un geste qui rend l'expédition d'après : l'écran se relit d'elle — sauf celui que `puis` choisit. */
  const geste = async (faire: () => Promise<ApresUnGeste>, puis?: (apres: VueDeLExpedition, r: ApresUnGeste) => Ecran | void) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const r = await faire()
      setEcran(puis?.(r.expedition, r) ?? { e: 'route', vue: r.expedition })
    } catch (e) {
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
   * carte des rencontres vise de même la question qui attend, même cachée tant qu'il prépare : son rang seul part.
   */
  const jouer = (vue: VueDeLExpedition, cle: string, plus: { categorie?: string; montre?: number } = {}) => {
    const position = vue.question?.index ?? vue.rencontre?.position
    return geste(
      () => api.expedition.jouer(vue.id, vue.rang + 1, cle, { ...(position !== undefined && { position }), ...plus }),
      apres => {
        // Une carte de route dit ce qu'elle ouvre, comme un joker de carte ; une carte de combat, ce que l'écran ne montre pas.
        const dit = vue.cartes && !estDeRoute(cle) ? ceQueLaCarteAFait(cle) : ceQuIlAFait(cle, vue, apres)
        if (dit) showToast({ kind: 'info', message: dit })
      },
    )
  }

  /** En rencontre : sa mise dite, il voit la question qui attend. */
  const voir = (vue: VueDeLExpedition, mise: number) => geste(() => api.expedition.voir(vue.id, vue.rang + 1, mise, vue.rencontre?.position))

  const prendre = (vue: VueDeLExpedition, jokers: readonly string[], talisman?: string) =>
    geste(
      () => api.expedition.prendre(vue.id, vue.rang + 1, jokers, talisman),
      apres => {
        // Un coffre passé sans rien prendre : ses écus, qu'un mot dit.
        const gagnes = (apres.ecus ?? 0) - (vue.ecus ?? 0)
        if (gagnes > 0) showToast({ kind: 'info', message: `+${gagnes} écus : le coffre reste fermé, tu passes` })
      },
    )

  const camper = (vue: VueDeLExpedition, retirer?: string) => geste(() => api.expedition.camper(vue.id, vue.rang + 1, retirer))

  /** À l'échoppe : un article, payé en écus ; l'échoppe reste ouverte pour le suivant. */
  const acheter = (vue: VueDeLExpedition, article: ArticleDeLEchoppe, joker?: string) => geste(() => api.expedition.acheter(vue.id, vue.rang + 1, article, joker))

  /**
   * L'échoppe qu'il a laissée sans avancer (« Reprendre la route ») : la carte
   * s'affiche, et l'échoppe se rouvre d'un bouton tant qu'il n'a pas fait son
   * pas. Elle ne bloque rien : le pas suivant la quitte.
   */
  const [echoppeLaissee, setEchoppeLaissee] = useState<string | null>(null)

  /** Une réponse — deux sous Double chance —, à la question qu'il a choisie sous Deux visages. */
  const repondre = async (vue: VueDeLExpedition, q: QuestionDExpedition, choix: number | readonly number[]) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.expedition.repondre(vue.id, q.index, choix)
      setGains(g => ({ xp: g.xp + reponse.xp, justes: g.justes + (reponse.juste ? 1 : 0), tampons: reponse.tampon ? [...g.tampons, reponse.tampon] : g.tampons }))
      // La révélation reste à l'écran, sans le faire défiler : la bonne réponse est sous le doigt.
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
      setEcran({ e: 'fin', vue: apres.expedition, tombe: { recompenses: apres.recompenses, legendaires: apres.legendaires }, correction: null })
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

  const { vue } = ecran
  const surLaMain = { onJouer: (cle: string, plus?: { categorie?: string; montre?: number }) => void jouer(vue, cle, plus) }
  if (ecran.reponse && ecran.question) {
    return (
      <Escale
        vue={vue}
        avant={ecran.avant ?? null}
        question={ecran.question}
        reponse={ecran.reponse}
        choix={ecran.choix ?? null}
        busy={busy}
        erreur={erreur}
        onRepondre={() => {}}
        onJouer={() => {}}
        onSuite={() => suite(vue, ecran.reponse!)}
        onPartir={quitter}
        onSignaler={() => void signaler(vue.id, ecran.question!.index)}
      />
    )
  }
  if (vue.issue === 'au-bout') return <ChoixDuLegendaire vue={vue} busy={busy} erreur={erreur} onGarder={cle => void garder(vue, cle)} />
  if (vue.offre) return <Offre vue={vue} offre={vue.offre} busy={busy} erreur={erreur} onPrendre={(jokers, talisman) => void prendre(vue, jokers, talisman)} onPartir={quitter} />
  if (vue.campement) return <Campement vue={vue} busy={busy} erreur={erreur} onCamper={retirer => void camper(vue, retirer)} onPartir={quitter} />
  // L'échoppe où il est, tant qu'il ne l'a pas laissée : elle se rouvre de la carte.
  const ouEstLEchoppe = `${vue.id}:${vue.acte}:${vue.ici}`
  if (vue.echoppe && echoppeLaissee !== ouEstLEchoppe) {
    return (
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
    return (
      <PreparationDeLaRencontre
        // Une question neuve repart d'une mise nulle ; une carte jouée la garde.
        key={`${vue.id}:${vue.rencontre.position}`}
        vue={vue}
        r={vue.rencontre}
        barre={<Barre vue={vue} onPartir={quitter} />}
        busy={busy}
        erreur={erreur}
        onJouer={surLaMain.onJouer}
        onVoir={mise => void voir(vue, mise)}
      />
    )
  }
  if (vue.question) {
    return (
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
  return (
    <CarteDeLActe
      key={`${vue.id}:${vue.acte}`}
      vue={vue}
      carte={vue.carte}
      busy={busy}
      erreur={erreur}
      onAvancer={vers => void avancer(vue, vers)}
      onAbandonner={() => void abandonner(vue)}
      onPartir={quitter}
      onEchoppe={vue.echoppe ? () => setEchoppeLaissee(null) : undefined}
      {...surLaMain}
    />
  )
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

/** La carte d'un gardien, au prototype des rencontres : son nom, ce qu'elle fait. Vaincu, il la glisse dans le paquet ; gardé, elle part dans les équipées suivantes. */
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
  /** `rencontres` : partir au prototype des rencontres, avec sa catégorie fétiche ; null, aux règles d'avant. */
  onPartir: (equipee: readonly string[], rencontres: { fetiche: string | null } | null) => void
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
  // Le prototype des rencontres, là où il s'ouvre : d'office, sauf s'il l'a coupé la dernière fois ; sa catégorie fétiche, retenue.
  const ouvertes = !vue && !!page.prochaine.rencontres
  const [aux, setAux] = useState(rencontresRetenues)
  const [fetiche, setFetiche] = useState(feticheRetenue)
  const enRencontres = vue ? vue.courage !== undefined : ouvertes && aux
  // Celle qui l'attend dit l'équipée qu'elle a emmenée ; une expédition de l'étape 1 n'en avait pas.
  const montree = vue ? (vue.jokers || vue.cartes ? vue.equipee : null) : equipee
  // Sans légendaire à lui, rien à choisir : l'invité du jour part d'office, et une ligne le dit. Deux places, dont une libre,
  // demandaient de choisir ce qu'il n'avait pas (« c'est pas clair de devoir mettre des légendaires sur la première page, surtout
  // qu'au début on n'a pas forcément ça », le 18 octobre 2026).
  const invite = !vue && page.prochaine.equipables.length === 0 ? page.prochaine.invite : undefined
  // La saison de son départ — celle qu'elle a eue, en route ; celle d'aujourd'hui, avant de partir.
  const s = laSaison(vue ? vue.saison : page.prochaine.saison)
  const tampons = page.passeport.length
  // Le paquet qui partirait : en rencontres, il s'ouvre en vraies cartes ; aux règles d'avant, il se dit en une ligne.
  const sonPaquet = !vue && montree && enRencontres ? paquetDesRencontres(montree) : null
  return (
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
          {vue ? `Ton expédition · carte n° ${formatNumber(vue.numero)}` : 'Ce qui t’attend'}
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
      {sonPaquet && (
        <button type="button" className="link-inline small exp-voir-le-paquet" aria-haspopup="dialog" onClick={() => setPaquet(true)}>
          {`Ton paquet · ${sonPaquet.length} cartes`}
          <Icon name="chevron-right" />
        </button>
      )}
      {ouvertes && (
        <AuDepart actif={aux} fetiche={fetiche} onActif={setAux} onFetiche={setFetiche} />
      )}
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
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <div className="exp-depart-pied">
        {vue ? (
          <>
            <p className="muted small centre">
              {`Acte ${Math.min(vue.acte, ACTES - 1) + 1} · ${vue.courage !== undefined ? `${vue.courage} de courage sur ${COURAGE_MAX}` : `${vue.vies} vie${vue.vies > 1 ? 's' : ''} sur ${VIES}`} · ${vue.justes} bonne${vue.justes > 1 ? 's' : ''} réponse${vue.justes > 1 ? 's' : ''}`}
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
                if (ouvertes) retenirLesRencontres(aux, fetiche)
                onPartir(equipee, enRencontres ? { fetiche } : null)
              }}
            >
              <Icon name="flag" />
              {enRencontres ? 'Partir aux rencontres' : 'Partir'}
            </button>
          </>
        )}
      </div>
      {choisir && <FeuilleDeLEquipee prochaine={page.prochaine} equipee={equipee} rencontres={enRencontres} onChoisir={setEquipee} onFermer={() => setChoisir(false)} />}
      {passeport && <FeuilleDuPasseport tampons={page.passeport} onFermer={() => setPasseport(false)} />}
      {paquet && sonPaquet && <FeuilleDesCartes paquet={sonPaquet} onFermer={() => setPaquet(false)} />}
      {regles && (
        <FeuilleDesRegles
          rencontres={enRencontres}
          parQuestion={vue?.cartes?.parQuestion ?? (enRencontres ? CARTES_DES_ACTES : undefined)}
          debut="expedition"
          onFermer={() => setRegles(false)}
        />
      )}
    </div>
  )
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
      <span>{espacesFines(`${tete} : ses escales reviennent plus souvent sur ${enRoute ? 'ta carte' : 'tes cartes'}${suite}.`)}</span>
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
          `${formatNumber(tenus)} tampon${tenus > 1 ? 's' : ''} sur ${formatNumber(TAMPONS_DU_PASSEPORT)}. Trouve une escale d’un thème pointu : son tampon est à toi. Sur la carte, ceux qui te manquent le disent.`,
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
function FeuilleDeLEquipee({
  prochaine,
  equipee,
  rencontres,
  onChoisir,
  onFermer,
}: {
  prochaine: PageDeLExpedition['prochaine']
  equipee: readonly string[]
  /** Au prototype des rencontres, chacun apporte sa carte et sa famille, pas son joker. */
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
  const statut = choisis.includes(vu) ? 'Dans ton équipée' : !siens.has(vu) ? (gardienAuFeminin(vu) ? 'Invitée du jour' : 'Invité du jour') : 'Touche pour l’emmener'
  return (
    <Feuille
      titre="Ton équipée"
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
          {choisis.length > 0 ? `Choisir · ${choisis.map(leGardien).join(' et ')}` : 'Partir sans équipée'}
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
// l'on peut aller, en cartes (`CarteDEscale`), puis « Y aller ». Touché, le
// plan s'ouvre en grand dans sa feuille (`GrandPlan`) : les colonnes en pour
// cent de la largeur — il tient tout écran de téléphone —, les étages en
// pixels — il défile —, et chaque escale y dit, touchée, ce qu'elle cache.

const COLONNES_X = [12.5, 37.5, 62.5, 87.5]
const Y_GARDIEN = 48
const Y_CAMPEMENT = 160
const Y_HAUT = 240
const PAS_D_ETAGE = 76
const yEtage = (f: number) => Y_HAUT + (ETAGES - 1 - f) * PAS_D_ETAGE
const Y_DEPART = yEtage(0) + 76
const HAUTEUR = Y_DEPART + 34
/** Le point de départ, en bas de la carte : pas une escale, d'où partent les liens du premier étage. */
const DEPART = '·'

function position(e: EscaleDeLaCarte): { x: number; y: number } {
  if (e.sorte === 'gardien') return { x: 50, y: Y_GARDIEN }
  if (e.sorte === 'campement') return { x: e.colonne === 0 ? 25 : 75, y: Y_CAMPEMENT }
  return { x: COLONNES_X[e.colonne] ?? 50, y: yEtage(e.etage) }
}

/**
 * L'acte en petit : ses rangées en pour cent de la hauteur du plan, qu'il
 * prend de ce que le panneau lui laisse — l'acte entier tient en 170 pixels
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
  const ou = (id: string) => position(parId.get(id)!)
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
  // Au prototype des rencontres, ce que rend une source, un campement — ce que prend un piège — est du courage.
  const v5 = !!vue.cartes
  const vie = (texte: string): Gain => ({ cle: 'vie', dessin: <Icon name="heart" />, texte, vie: true })
  const joker: Gain[] = vue.jokers || v5 ? [{ cle: 'joker', dessin: <i className="exp-glyphe-joker" />, texte: '+1' }] : []
  const tampon: Gain[] = e.aTamponner ? [{ cle: 'tampon', dessin: <Icon name="tampon" />, texte: '' }] : []
  // Une escale sans chance dite — sous L'écholocation — ne dit pas non plus ses écus : ils en dépendent.
  const prix = e.chance === undefined ? [] : enEcus(prixDeLEscale(e))
  switch (e.sorte) {
    case 'question':
      return { sorte: v5 ? 'Rencontre' : 'Question', nom: nomCourtDuTheme(e.theme), gains: [...prix, ...tampon] }
    case 'elite':
      return { sorte: 'Élite', nom: nomCourtDuTheme(e.theme), gains: [...joker, ...prix, ...tampon] }
    case 'source':
      return { sorte: 'Source', nom: 'Ton carnet', gains: [vie(v5 ? `+${COURAGE_D_UNE_SOURCE}` : '+1')] }
    case 'campement':
      return { sorte: 'Campement', nom: 'Le repos', gains: [vie(v5 ? `+${COURAGE_D_UN_CAMPEMENT}` : '+1')] }
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
  const sorte = !v5 || (!sansAdversaire && e.sorte !== 'question') ? face.sorte : null
  const nom = !v5 || !sansAdversaire ? face.nom : e.sorte === 'inconnu' ? (e.contenu ? face.nom : 'Inconnu') : face.sorte
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
      <span className="exp-carte-embleme" aria-hidden="true">
        {e.sorte === 'gardien' ? <Medaillon cle={gardien} className="exp-medaillon" /> : <Icon name={iconeDe(e)} />}
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
 * L'acte en petit, en haut de l'écran (le 18 octobre 2026, « la carte reste
 * en haut, en petit et épurée, pour voir où tu es ») : tout l'acte d'un coup
 * d'œil, sans un mot — l'escale où il est, qui brille ; celles qu'il peut
 * prendre, entourées, la touchée en or ; le gardien au bout. Il ne se touche
 * pas escale par escale — elles y font vingt pixels — : touché, il s'ouvre
 * en grand.
 */
function PetitPlan({ vue, carte, lecture, retenue }: { vue: VueDeLExpedition; carte: CarteDUnActe; lecture: LectureDeLaCarte; retenue: string | null }) {
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const ou = (id: string) => (id === DEPART ? { x: 50, y: EN_PETIT.depart } : enPetit(lecture.parId.get(id)!))
  return (
    <span className="exp-petit-plan" aria-hidden="true">
      <svg className="exp-liens" viewBox="0 0 100 100" preserveAspectRatio="none">
        {liensDuPlan(carte, vue, lecture, retenue, ou).map(l => (
          <line key={l.cle} className={l.sorte} x1={l.de.x} y1={l.de.y} x2={l.a.x} y2={l.a.y} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <span className={'exp-petit-depart' + (vue.ici === null ? ' exp-ici' : '')} style={{ top: `${EN_PETIT.depart}%` }}>
        <Icon name="flag" />
        Départ
      </span>
      {carte.escales.map(e => {
        const { x, y } = enPetit(e)
        const etat = etatDeLEscale(e, vue, lecture, retenue)
        return (
          <span key={e.id} className={['exp-point', ...etat.classes].join(' ')} data-escale={e.id} style={{ left: `${x}%`, top: `${y}%` }}>
            {e.sorte === 'gardien' ? <Medaillon cle={gardien} className="exp-medaillon" /> : <Icon name={etat.passee ? 'check' : iconeDe(e)} />}
            {/* Un thème pointu que son passeport n'a pas : un point d'or, son tampon l'attend. */}
            {e.aTamponner && !etat.loin && !etat.passee && <i className="exp-point-tampon" />}
          </span>
        )
      })}
    </span>
  )
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
 * que lui.
 */
export function CarteDeLActe({
  vue,
  carte,
  busy,
  erreur,
  onAvancer,
  onAbandonner,
  onPartir,
  onJouer,
  onEchoppe,
}: {
  vue: VueDeLExpedition
  carte: CarteDUnActe
  busy: boolean
  erreur: string
  onAvancer: (vers: string) => void
  onAbandonner: () => void
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
  const [grande, setGrande] = useState(false)
  const [paquet, setPaquet] = useState(false)
  // Au prototype des rencontres, le gardien ne se compte plus en vies : sa chance est celle de chaque question.
  const chanceDe = (e: EscaleDeLaCarte) => (aveugle ? undefined : e.sorte === 'gardien' ? (vue.cartes ? carte.chanceDuGardien : chanceDeVaincre(pGardien, m.aTrouver, vue.vies)) : e.chance)

  return (
    <div className="player-shell expedition exp-carte-page">
      <Barre vue={vue} onPartir={onPartir} />
      <h1 className="exp-titre-acte">{`Acte ${vue.acte + 1} · Vers ${leGardien(gardien)}`}</h1>
      <button type="button" className="exp-plan" aria-haspopup="dialog" onClick={() => setGrande(true)}>
        <PetitPlan vue={vue} carte={carte} lecture={lecture} retenue={retenue} />
        <span className="exp-plan-ouvrir">
          <Icon name="maximize" />
          La carte
        </span>
        <span className="sr-only">{ici ? `, tu es à l’escale ${etiquette(ici, vue.acte, vue.gardiens)}` : ', tu es au départ'}</span>
      </button>

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
          {/* Au prototype des rencontres : ses cartes de route en petit, puis tout son paquet. */}
          {vue.cartes && (
            <MainDeRencontre
              cles={vue.cartes.route}
              refus={vue.cartes.refus}
              busy={busy}
              enPetit
              pile={{ compte: vue.cartes.paquet.length, mot: 'paquet', dit: `Ton paquet : ${vue.cartes.paquet.length} carte${vue.cartes.paquet.length > 1 ? 's' : ''}`, onOuvrir: () => setPaquet(true) }}
              onJouer={onJouer}
            />
          )}
        </div>
        {/* Une ligne : que chaque erreur lui coûte une vie, ses questions le disent en tête. */}
        {auCampement && (
          <p className="exp-panneau-titre">
            {espacesFines(vue.cartes ? `${sceauxDe('gardien', vue.acte)} points à lui faire perdre, en questions ${MARCHE[m.gardien]}s.` : `${regleDuGardien(vue.acte)}.`)}
          </p>
        )}
        {proposees.length === 0 ? (
          <p className="muted small">{espacesFines('Aucune escale ne t’attend : recharge la page.')}</p>
        ) : (
          <div className="exp-cartes-escale">
            {proposees.map(id => {
              const e = parId.get(id)!
              return <CarteDEscale key={id} e={e} vue={vue} carte={carte} chance={chanceDe(e)} choisie={id === retenue} sure={id === laPlusSure} onToucher={() => setChoisie(id)} />
            })}
          </div>
        )}
        <span id="exp-dit-sure" hidden>
          La plus sûre des escales proposées
        </span>
        {/* Une ligne : la feuille de la carte dit le reste — le temps que ses réponses disent les siennes. */}
        {/* En rencontres, les règles le disent : une ligne de moins sous les cartes. */}
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
      {grande && (
        <FeuilleDeLaCarte
          vue={vue}
          carte={carte}
          lecture={lecture}
          retenue={retenue}
          busy={busy}
          onChoisir={setChoisie}
          onAbandonner={onAbandonner}
          onFermer={() => setGrande(false)}
        />
      )}
      {paquet && vue.cartes && <FeuilleDesCartes paquet={vue.cartes.paquet} onFermer={() => setPaquet(false)} />}
    </div>
  )
}

/**
 * L'acte en grand, dans la feuille « La carte » : chaque escale y dit, touchée,
 * ce qu'elle cache ; les proposées, leur nom dessous et leur chance au-dessus,
 * et touchées, elles se choisissent comme leur carte. La feuille s'ouvre sur
 * l'escale où il est, et sur celles qu'il peut prendre au-dessus.
 */
function GrandPlan({
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
  const plan = useRef<HTMLDivElement>(null)
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const ici = vue.ici ? lecture.parId.get(vue.ici) : undefined
  const m = MARCHES_DES_ACTES[Math.min(vue.acte, ACTES - 1)]
  const pGardien = carte.chanceDuGardien ?? chanceDuJoueurMoyen(m.gardien)
  const aveugle = !!vue.sansChances

  // L'acte monte, le départ est tout en bas : la feuille défile jusqu'à l'escale où il est et à celles qu'elle
  // propose — leur chance au-dessus d'elles, leur nom dessous. Par le cadre qui défile, jamais la page de dessous.
  useEffect(() => {
    const el = plan.current
    const corps = el?.closest('.carte-corps')
    if (!el || !corps) return
    const ys = [ici ? position(ici).y : Y_DEPART, ...lecture.proposees.map(id => position(lecture.parId.get(id)!).y)]
    const milieu = (Math.min(...ys) - 40 + Math.max(...ys) + 56) / 2
    corps.scrollTop += el.getBoundingClientRect().top - corps.getBoundingClientRect().top + milieu - corps.clientHeight / 2
  }, [])

  const ou = (id: string) => (id === DEPART ? { x: 50, y: Y_DEPART } : position(lecture.parId.get(id)!))
  return (
    <div className="exp-carte" style={{ height: HAUTEUR }} ref={plan}>
      <svg className="exp-liens" viewBox={`0 0 100 ${HAUTEUR}`} preserveAspectRatio="none" aria-hidden="true">
        {liensDuPlan(carte, vue, lecture, retenue, ou).map(l => (
          <line key={l.cle} className={l.sorte} x1={l.de.x} y1={l.de.y} x2={l.a.x} y2={l.a.y} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <span id="exp-dit-passee" hidden>
        Tu y es déjà passé
      </span>
      <span id="exp-dit-proposee" hidden>
        Tu peux y aller
      </span>
      <span id="exp-depart" className={'exp-depart' + (vue.ici === null ? ' exp-ici' : '')} style={{ top: Y_DEPART }} aria-current={vue.ici === null ? 'location' : undefined}>
        <span className="exp-depart-nom">
          <Icon name="flag" />
          Départ
        </span>
      </span>
      {carte.escales.map(e => {
        const { x, y } = position(e)
        const etat = etatDeLEscale(e, vue, lecture, retenue)
        const classes = ['exp-escale', ...etat.classes]
        // Celle que le pied de la feuille décrit, touchée hors des proposées : sur la carte aussi, on voit laquelle.
        if (e.id === regardee && !etat.proposee) classes.push('exp-regardee')
        // Sa chance, au-dessus des proposées seulement : sur chaque escale, elle se lisait sans qu'on sache où aller.
        const chance = !etat.proposee || aveugle ? undefined : e.sorte === 'gardien' ? (vue.cartes ? carte.chanceDuGardien : chanceDeVaincre(pGardien, m.aTrouver, vue.vies)) : e.chance
        return (
          <button
            key={e.id}
            id={`escale-${e.id}`}
            type="button"
            className={classes.join(' ')}
            style={{ left: `${x}%`, top: y }}
            // Son nom ne bouge pas : « choisie » passe par aria-pressed, « tu es ici » par aria-current, « déjà
            // passée » et « tu peux y aller » par la description — dans le nom, l'état se lisait deux fois (`design.test.ts`).
            aria-label={decrire(e, vue, carte)}
            aria-pressed={etat.proposee ? e.id === retenue : undefined}
            aria-current={etat.ici ? 'location' : undefined}
            aria-describedby={etat.passee ? 'exp-dit-passee' : etat.proposee ? 'exp-dit-proposee' : undefined}
            onClick={() => onToucher(e.id)}
          >
            {e.sorte === 'gardien' ? <Medaillon cle={gardien} className="exp-medaillon" /> : <Icon name={etat.passee ? 'check' : iconeDe(e)} />}
            {chance !== undefined && (
              <span className="exp-sa-chance" aria-hidden="true">
                <Balise couleur={couleurDePiste(chance)} />
                {pourcents(chance)}
              </span>
            )}
            {/* Un thème pointu que son passeport n'a pas : son tampon l'attend (le 18 octobre 2026). */}
            {e.aTamponner && !etat.loin && !etat.passee && (
              <span className="exp-a-tamponner" aria-hidden="true">
                <Icon name="tampon" />
              </span>
            )}
            {(etat.ici || etat.proposee || e.sorte === 'gardien') && (
              <span className="exp-etiquette" aria-hidden="true">
                {etiquette(e, vue.acte, vue.gardiens)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * « La carte », la feuille (le plan touché, le 18 octobre 2026) : l'acte en
 * grand, où chaque escale dit, touchée, ce qu'elle cache — son pied le
 * redit —, la légende, et « Abandonner l'expédition », qui vivait sous le
 * panneau : l'écran de la carte tient maintenant en un écran. La légende
 * vivait sous la carte, neuf lignes que personne ne lisait.
 */
function FeuilleDeLaCarte({
  vue,
  carte,
  lecture,
  retenue,
  busy,
  onChoisir,
  onAbandonner,
  onFermer,
}: {
  vue: VueDeLExpedition
  carte: CarteDUnActe
  lecture: LectureDeLaCarte
  retenue: string | null
  busy: boolean
  onChoisir: (id: string) => void
  onAbandonner: () => void
  onFermer: () => void
}) {
  const [touchee, setTouchee] = useState<string | null>(null)
  const x = lecture.parId.get(touchee ?? retenue ?? '')
  const dit = ((): { titre: string; texte: string } => {
    if (!x) return { titre: 'Touche une escale', texte: 'pour savoir ce qu’elle cache.' }
    if (x.id === vue.ici) return { titre: 'Tu es ici', texte: decrire(x, vue, carte) }
    if (vue.trace.includes(x.id)) return { titre: 'Derrière toi', texte: 'Tu y es déjà passé.' }
    if (lecture.proposees.includes(x.id)) return { titre: 'Ta prochaine escale', texte: decrire(x, vue, carte) }
    if (x.sorte === 'gardien') return { titre: 'Au bout de l’acte', texte: decrire(x, vue, carte) }
    if (!lecture.atteignables.has(x.id)) return { titre: 'Hors de ta route', texte: 'Ta route ne passe plus par cette escale.' }
    return { titre: 'Plus loin sur ta route', texte: decrire(x, vue, carte) }
  })()
  return (
    <Feuille
      titre={`La carte · acte ${vue.acte + 1}`}
      className="feuille-carte"
      onFermer={onFermer}
      pied={
        <p className="exp-vu" role="status">
          <b>{dit.titre}</b> {espacesFines(dit.texte)}
        </p>
      }
    >
      <p>
        {espacesFines(
          `Carte n° ${formatNumber(vue.numero)}. Tu montes vers ${leGardien(vue.gardiens[vue.acte]?.cle ?? '')}, étage par étage. L’escale où tu es brille ; celles où tu peux aller ensuite sont entourées, avec ta chance de les trouver. Une escale passée ne se rejoue pas.`,
        )}
      </p>
      {vue.moyen && <p className="muted small">{espacesFines('Les chances sont celles d’un joueur moyen, le temps que tes réponses disent les tiennes.')}</p>}
      <GrandPlan
        vue={vue}
        carte={carte}
        lecture={lecture}
        retenue={retenue}
        regardee={touchee}
        onToucher={id => {
          setTouchee(id)
          if (lecture.proposees.includes(id)) onChoisir(id)
        }}
      />
      <ul className="exp-legende" aria-label="La légende de la carte">
        {vue.cartes && (
          <li>
            <Icon name="target" />
            {espacesFines('Question : un adversaire, à qui chaque bonne réponse fait perdre des points')}
          </li>
        )}
        <li>
          <Icon name="source" />
          {espacesFines(vue.cartes ? `Source : une question de ton carnet, qui rend ${COURAGE_D_UNE_SOURCE} de courage` : 'Source : une question de ton carnet, qui rend une vie')}
        </li>
        <li>
          <Icon name="campement" />
          {vue.cartes ? `Campement : ${COURAGE_D_UN_CAMPEMENT} de courage, ou une carte de moins` : vue.jokers ? 'Campement : une vie, ou un joker de moins' : 'Campement : une vie de plus'}
        </li>
        {(vue.jokers || vue.cartes) && (
          <>
            <li>
              <Icon name="swords" />
              {espacesFines(vue.cartes ? 'Élite : plus de points à lui faire perdre ; tombée, une carte plus souvent rare' : 'Élite : plus dure ; trouvée, un joker')}
            </li>
            <li>
              <Icon name="coffre" />
              {vue.cartes ? 'Coffre : une carte au choix' : 'Coffre : un joker au choix'}
            </li>
          </>
        )}
        {vue.ecus !== undefined && (
          <>
            <li>
              <Icon name="echoppe" />
              {espacesFines('Échoppe : contre tes écus')}
            </li>
            <li>
              <Icon name="help" />
              {espacesFines('Inconnu : un marchand, un piège, un légendaire')}
            </li>
          </>
        )}
        <li>
          <Icon name="shuffle" />
          {espacesFines('Mélange : l’une de ses catégories')}
        </li>
        {carte.escales.some(e => e.aTamponner) && (
          <li>
            <span className="exp-a-tamponner" aria-hidden="true">
              <Icon name="tampon" />
            </span>
            {espacesFines('Un tampon neuf pour ton passeport')}
          </li>
        )}
        <li>
          <span className="exp-legende-pistes" aria-hidden="true">
            <Balise couleur="verte" />
            <Balise couleur="bleue" />
            <Balise couleur="rouge" />
            <Balise couleur="noire" />
          </span>
          Ta chance : verte, bleue, rouge, noire
        </li>
      </ul>
      <GesteDuBas icone="x" danger busy={busy} onClick={onAbandonner}>
        Abandonner l’expédition
      </GesteDuBas>
    </Feuille>
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
 * Une question de l'expédition (les maquettes 4 et 7) : celle d'une escale —
 * sa catégorie, son mélange ou son thème pointu —, d'une source, d'une
 * élite, ou du gardien, son médaillon et ses crans au-dessus ; sous ses
 * réponses, la main. Ce qu'un joker y a fait se voit sur elle : les réponses
 * effacées, deux à choisir (Double chance), l'autre question (Deux visages),
 * l'indice de l'Énigme, ce que dit l'Oracle, ce que coûterait une erreur.
 * Sa forme (l'étape 3, la maquette 11) : six choix, un vrai ou faux et sa
 * réponse proposée, un dévoilement mot à mot. Puis sa révélation : la bonne
 * réponse, l'anecdote, et la suite.
 */
function Escale({
  vue,
  avant,
  question: q,
  reponse: r,
  choix,
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
  busy: boolean
  erreur: string
  onRepondre: (q: QuestionDExpedition, choix: number | readonly number[]) => void
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
  const m = MARCHES_DES_ACTES[acte]
  // Les crans du gardien : ceux qu'il a trouvés — à la révélation, la réponse comprise.
  const trouvees = auGardien_ ? (r ? (r.vaincu ? m.aTrouver : (r.expedition.gardien?.trouvees ?? m.aTrouver)) : (vue.gardien?.trouvees ?? 0)) : 0
  const theme = escale?.theme && ('sujet' in escale.theme || escale.theme.categories.length > 1) ? nomDuTheme(escale.theme) : null
  const finie = r !== null && vue.issue === 'perdue'
  const effacees = new Set(affichee.effacees ?? [])
  const doubleChance = !r && !!affichee.deux
  const aMontrer = montrer && !vue.joue
  const joue = vue.joue ? jokerDeCle(vue.joue) : undefined
  // En rencontre (le prototype) : l'adversaire en tête — à la révélation, tel que la réponse l'a laissé ; la vue d'après n'en a plus s'il est tombé.
  const rencontre = r ? avant?.rencontre : vue.rencontre
  const sceauxApres = r && rencontre ? rencontre.sceaux - (r.coup?.brises ?? 0) : undefined
  const [tas, setTas] = useState(false)
  // Un dévoilement : ses mots à mesure qu'ils se disent ; répondu, son intitulé entier revient avec le verdict. Arrêt sur image joué, ils se relisent.
  const devoile = useDevoilement(vue.id, !r && affichee.forme === 'devoilement' ? affichee.index : null, vue.joue ?? (vue.rencontre?.jouees.includes('arret-sur-image') ? 'arret-sur-image' : ''))
  const enDevoilement = !r && affichee.forme === 'devoilement'
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
          <Adversaire r={rencontre} gardien={gardien} acte={acte} sceaux={sceauxApres} compact />
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
                ? `Une source : retrouvée, +${COURAGE_D_UNE_SOURCE} de courage ; ratée, rien.`
                : 'Une source : une question de ton carnet. Retrouvée, elle te rend une vie ; ratée, elle ne te coûte rien.',
            )}
          </p>
        )}
        {elite && !r && !rencontre && <p className="exp-regle small">{espacesFines('Une élite : trouvée, un joker au choix pour ton paquet ; ratée, une vie.')}</p>}
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
        <span className="label quiz-categorie">{[theme, affichee.categorie, NOM_NIVEAU[affichee.niveau]].filter(Boolean).join(' · ')}</span>
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
        {!r ? (
          <ReponsesDeLEscale
            reponses={affichee.reponses}
            effacees={effacees}
            choisies={deux}
            doubleChance={doubleChance}
            montree={affichee.prediction?.montre}
            busy={busy}
            onToucher={toucherReponse}
          />
        ) : (
          <Revelation question={q} reponse={r} avant={avant} choix={choix} source={source} finie={finie} gardien={gardien} adversaire={rencontre?.adversaire} onSuite={onSuite} onSignaler={onSignaler} />
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
        {/* En rencontre, ce que la réponse fera, la mise dite : la même règle que le verdict, en deux chiffres — la question d'abord. */}
        {!r && vue.rencontre?.apercu && <Apercu a={vue.rencontre.apercu} compact />}
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
            inspiration={vue.rencontre.inspiration}
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
        {tas && vue.rencontre && <FeuilleDesCartes paquet={vue.cartes?.paquet ?? []} rencontre={vue.rencontre} onFermer={() => setTas(false)} />}
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
function verdictDe(r: ReponseDExpedition, avant: VueDeLExpedition | null, source: boolean, finie: boolean): string {
  // Une source, au prototype des rencontres : pas d'adversaire, pas de coup — retrouvée, elle rend du courage ; ratée, rien.
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

/** La révélation d'une question : juste ou non, ce que la réponse a coûté, la bonne réponse, l'anecdote, et la suite. */
function Revelation({
  question: q,
  reponse: r,
  avant,
  choix,
  source,
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
  source: boolean
  finie: boolean
  gardien: string
  /** En rencontre : l'adversaire, que la réponse a peut-être fait tomber. */
  adversaire?: string
  onSuite: () => void
  onSignaler: () => void
}) {
  // En rencontre, le coup de la réponse dit ce qu'elle a brisé ou coûté : ses lignes remplacent les écus de l'escale.
  const coup = r.coup ? verdictDeLaRencontre(r.coup, adversaire ?? 'L’adversaire', finie) : null
  const verdict = coup ? coup.titre : verdictDe(r, avant, source, finie)
  const geste: ReactNode = r.vaincu
    ? `${nomDuGardien(r.vaincu)} est ${gardienAuFeminin(r.vaincu) ? 'vaincue' : 'vaincu'}`
    : finie
      ? 'Voir la fin'
      : r.expedition.offre
        ? r.expedition.cartes
          ? 'Choisir ta carte'
          : 'Choisir ton joker'
        : r.expedition.question || r.expedition.rencontre
          ? 'Question suivante'
          : 'Retour à la carte'
  return (
    <>
      <div className={'card result-banner ' + (r.juste ? 'result-ok' : 'result-ko')} role="status">
        {r.juste ? (
          <>
            <span className="big">🎊 +1</span>
            <p>{espacesFines(`${verdict}${r.xp > 0 ? ` +${r.xp} XP` : ''}`)}</p>
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
        <p className="muted">
          {choix === null ? 'Sans réponse. ' : ''}
          {q.proposee !== undefined ? (
            // Un vrai ou faux tiré d'une question à quatre choix : ce qu'il proposait, et ce qu'il valait.
            <>
              {espacesFines(`« ${q.proposee} » : `)}
              <strong>{r.bonne === 0 ? 'vrai' : 'faux'}</strong>
            </>
          ) : (
            <>
              La bonne réponse : {q.reponses.length <= 4 && <Shape index={r.bonne} inline />}
              <strong>{espacesFines(q.reponses[r.bonne])}</strong>
            </>
          )}
        </p>
        {r.devoile && <p className="muted small">{espacesFines(`Répondu au ${r.devoile.mots === 1 ? '1ᵉʳ' : `${r.devoile.mots}ᵉ`} mot sur ${r.devoile.sur}.`)}</p>}
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
      <button type="button" className="lien-signaler link-inline small" onClick={onSignaler}>
        Signaler une erreur dans cette question
      </button>
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
  onPrendre: (jokers: readonly string[], talisman?: string) => void
  onPartir: () => void
}) {
  const [pris, setPris] = useState<string[]>([])
  // Au prototype des rencontres, une carte de son paquet touchée se montre en grand.
  const [regardee, setRegardee] = useState<string | null>(null)
  const ici = vue.ici ? vue.carte?.escales.find(e => e.id === vue.ici) : undefined
  const vide = offre.jokers.length === 0
  const deux = offre.aPrendre > 1
  // Au prototype des rencontres, l'offre est de cartes — celle d'un adversaire tombé, d'une élite, d'un coffre.
  const v5 = !!vue.cartes
  const toucher = (cle: string) => setPris(p => (p.includes(cle) ? p.filter(x => x !== cle) : p.length < offre.aPrendre ? [...p, cle] : [...p.slice(1), cle]))
  const siens = vue.jokers ? [...vue.jokers.paquet, ...vue.jokers.main, ...vue.jokers.defausse] : []
  const nom = (cle: string) =>
    cle.startsWith(TALISMAN) ? (talismanDeCle(cle.slice(TALISMAN.length))?.nom ?? cle) : ((v5 ? carteDeRencontre(cle)?.nom : jokerDeCle(cle)?.nom) ?? cle)
  const t = offre.talisman ? talismanDeCle(offre.talisman) : undefined
  if (v5) {
    return (
      <div className="player-shell expedition exp-offre">
        <Barre vue={vue} onPartir={onPartir} />
        <header className="exp-tete">
          <span className="label exp-surtitre">{ici?.sorte === 'coffre' ? 'Un coffre' : ici?.sorte === 'elite' ? 'L’élite est tombée' : 'L’adversaire est tombé'}</span>
          <h1>{vide ? 'La récompense est vide' : 'Choisis une carte'}</h1>
          {/* Ce que devient la carte prise est dans les règles ; seule la récompense vide se dit, qui surprend. */}
          {vide && <p className="muted">{espacesFines('L’horizon l’a vidée : c’était le prix de ton courage rendu.')}</p>}
        </header>
        {!vide && <CartesAPrendre cles={offre.jokers} prises={pris} onToucher={toucher} />}
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
                onPrendre(
                  pris.filter(c => !c.startsWith(TALISMAN)),
                  talisman,
                )
              }
            }}
          >
            {vide ? 'Continuer' : pris.length === 0 ? 'Choisis une carte' : `Prendre « ${nom(pris[0])} »`}
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
 * souvent ses meilleurs. Puis le gardien. Ses trois vies déjà là, retirer
 * s'offre d'abord : le repos ne lui donnerait rien.
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
  onCamper: (retirer?: string) => void
  onPartir: () => void
}) {
  // Au prototype des rencontres, le repos rend du courage, et l'on retire une carte de son paquet.
  const courage = vue.courage
  const siens = vue.jokers ? comptes([...vue.jokers.paquet, ...vue.jokers.main, ...vue.jokers.defausse]) : vue.cartes ? comptesDesCartes(vue.cartes.paquet) : []
  const plein = courage !== undefined ? courage >= COURAGE_MAX : vue.vies >= VIES
  const [retirer, setRetirer] = useState(plein && siens.length > 0)
  const [cle, setCle] = useState<string | null>(null)
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const choisi = siens.find(c => c.cle === cle)
  const repos =
    courage !== undefined
      ? plein
        ? 'Ton courage est au plus haut'
        : `+${Math.min(COURAGE_D_UN_CAMPEMENT, COURAGE_MAX - courage)} de courage`
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
        <button type="button" role="radio" aria-checked={!retirer} className={'exp-choix-ligne' + (!retirer ? ' exp-choisi' : '')} onClick={() => setRetirer(false)}>
          <span className="exp-choix-icone" aria-hidden="true">
            <Icon name="heart" />
          </span>
          <span className="exp-gardien-texte">
            <b className="exp-gardien-nom">Te reposer</b>
            <span className="muted small">{repos}</span>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={retirer}
          aria-disabled={siens.length === 0 || undefined}
          className={'exp-choix-ligne' + (retirer ? ' exp-choisi' : '')}
          onClick={() => siens.length > 0 && setRetirer(true)}
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
          aria-disabled={busy || (retirer && !choisi) || undefined}
          onClick={() => (retirer ? choisi && onCamper(choisi.cle) : onCamper())}
        >
          {retirer ? (choisi ? `Retirer « ${choisi.nom} »` : vue.cartes ? 'Choisis la carte à retirer' : 'Choisis le joker à retirer') : 'Te reposer'}
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
 * talisman, un joker retiré de son paquet. Un article se choisit, puis
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
  const ecus = vue.ecus ?? 0
  // Au prototype des rencontres, l'échoppe vend du courage et des cartes ; on y retire une carte de son paquet.
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
  }
  const t = echoppe.talisman ? talismanDeCle(echoppe.talisman) : undefined
  const nomDe = (cle: string) => (v5 ? carteDeRencontre(cle)?.nom : jokerDeCle(cle)?.nom) ?? cle
  // L'étal, dans l'ordre où l'on pense : se soigner, s'équiper, puis s'alléger.
  const etal: LigneDeLEtal[] = [
    v5
      ? { cle: 'vie', article: { article: 'vie' }, nom: 'Du courage', detail: `+${COURAGE_A_L_ECHOPPE} · tu en as ${vue.courage} sur ${COURAGE_MAX}`, visage: <Icon name="heart" /> }
      : { cle: 'vie', article: { article: 'vie' }, nom: 'Une vie', detail: `Tu en as ${vue.vies} sur ${VIES}`, visage: <Icon name="heart" /> },
    ...echoppe.jokers.flatMap((cle): LigneDeLEtal[] => {
      if (v5) {
        const c = carteDeRencontre(cle)
        return c ? [{ cle, article: { article: 'joker', joker: cle }, nom: c.nom, detail: c.effet, visage: null, carte: c }] : []
      }
      const j = jokerDeCle(cle)
      return j ? [{ cle, article: { article: 'joker', joker: cle }, nom: j.nom, detail: j.effet, visage: <VisageDuJoker j={j} />, rarete: j.rarete }] : []
    }),
    ...(t ? [{ cle: 'talisman', article: { article: 'talisman' as const }, nom: t.nom, detail: t.effet, visage: <Icon name={ICONE_DU_TALISMAN[t.cle] ?? 'sparkles'} />, rarete: 'talisman' }] : []),
    v5
      ? { cle: 'retirer', article: { article: 'retirer' }, nom: 'Retirer une carte', detail: 'Elle quitte ton paquet jusqu’au bout de l’expédition', visage: <Icon name="trash" /> }
      : { cle: 'retirer', article: { article: 'retirer' }, nom: 'Retirer un joker', detail: 'Il quitte ton paquet jusqu’au bout de l’expédition', visage: <Icon name="trash" /> },
  ]
  const ligne = etal.find(x => x.cle === choisi)
  const vise: Article | null = ligne ? (ligne.article.article === 'retirer' ? { article: 'retirer', ...(aRetirer && { joker: aRetirer }) } : ligne.article) : null
  // « Retirer » sans joker choisi : le refus attend le choix, il ne dit pas encore « pas dans ton paquet ».
  const refus = vise && !(vise.article === 'retirer' && !vise.joker) ? refusDeLAchat(etat, vise) : null
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
                  <span className="exp-offre-visage" style={x.rarete && x.rarete !== 'talisman' ? gemme(GEMME_DU_JOKER[x.rarete as Joker['rarete']]) : undefined} aria-hidden="true">
                    {x.visage}
                  </span>
                  <span className="exp-joker">
                    <span className="exp-offre-nom">
                      <b>{x.nom}</b>
                      {x.rarete && <span className={`exp-rarete exp-rarete-${x.rarete}`}>{x.rarete === 'talisman' ? 'talisman' : RARETE[x.rarete as Joker['rarete']]}</span>}
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
          aria-disabled={busy || !vise || refus !== null || (vise.article === 'retirer' && !vise.joker) || undefined}
          onClick={() => vise && !busy && refus === null && (vise.article !== 'retirer' || vise.joker) && onAcheter(vise.article, vise.joker)}
        >
          {!vise || !ligne
            ? 'Choisis un article'
            : vise.article === 'retirer'
              ? vise.joker
                ? `Retirer « ${nomDe(vise.joker)} » · ${prix(vise)} écus`
                : v5
                  ? 'Choisis la carte à retirer'
                  : 'Choisis le joker à retirer'
              : `Acheter « ${ligne.nom} » · ${prix(vise)} écus`}
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
        <p className="muted">{espacesFines('Un seul part avec toi. Les deux autres retournent sur la carte : tu les recroiseras.')}</p>
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
  const niveau = useNiveauRelu(gains.xp > 0 || cles.length > 0)
  const gardee = vue.issue === 'legendaire' && vue.garde ? vue.garde : null
  const nouveau = gardee !== null && (tombe.legendaires ?? []).includes(gardee)
  const acte = Math.min(vue.acte, ACTES - 1) + 1
  const vaincus = vue.gardiens.filter(g => g.vaincu).length
  const s = vue.justes > 1 ? 's' : ''
  return (
    <div className="player-shell expedition">
      <Sortie />
      <header className="fin-tete exp-fin-tete">
        <span className="label">{`L’Expédition · carte n° ${formatNumber(vue.numero)}`}</span>
        <h1>{gardee ? (nouveau ? `${nomDuGardien(gardee)} est à toi` : 'Expédition accomplie') : vue.issue === 'abandonnee' ? 'Expédition abandonnée' : 'L’expédition s’arrête là'}</h1>
        <p className="muted small">
          {gardee
            ? `Trois gardiens vaincus, ${vue.justes} bonne${s} réponse${s}.`
            : `Acte ${acte} · ${vaincus} gardien${vaincus > 1 ? 's' : ''} vaincu${vaincus > 1 ? 's' : ''} · ${vue.justes} bonne${s} réponse${s}.`}
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

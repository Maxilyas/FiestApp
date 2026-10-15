import { useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Gemmes } from './Gemmes'
import { AGagner } from './LigneDeCollection'
import { PremierHautFait } from './Trophees'
import { gemmeDAvatar } from '../gemmes'
import { AVATARS, COLLECTION, COLLECTION_HAUTE } from '../../../shared/avatars'
import { AUCUNE_BORDURE, CRANS_D_UNE_BORDURE, LIGUES, NOM_DE_LA_BORDURE, bordurePortee, ligueParCle, type BordureDeLigue, type ChoixDeBordure } from '../../../shared/duels'
import { hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import {
  NOM_COURT_DE_RARETE_D_AVATAR,
  NOM_DE_RARETE_D_AVATAR,
  avatarDeLAlbum,
  avatarsALui,
  compteDeLAlbum,
  sesPagesDeLAlbum,
  type RareteDAvatar,
} from '../../../shared/album'
import { brancheDe, deLaBranche, portrait as portraitDe } from '../../../shared/branches'
import { NOM_DE_LA_FORME, compagnonDe, formeDeCompagnon } from '../../../shared/compagnons'
import { FONDS, FONDS_EN_BOUTIQUE } from '../../../shared/fonds'
import { AUCUNE_GERBE, GERBES } from '../../../shared/gerbes'
import { avatarMontre, avecLEssai, type Essai } from '../../../shared/loge'
import { avatarDeLApercu } from '../../../shared/sonAvatar'
import { GerbeDeJuste } from './Gerbe'
import { cleDeMaitre, maitresDe, nomDuTitre } from '../../../shared/sentiers'
import { FINITIONS, NOM_FINITION, brilleChez, meilleureFinition, type Finition, type FinitionChoisie, type PublicProfileDetail } from '../../../shared/profil'
import type { PropsDUnePiece } from './choix'

// Les pièces de la loge (« M'habiller », au profil), chacune dans son
// panneau : son avatar — rangé par rareté, comme l'album de « Ma
// collection » — et sa finition, sa bordure, son titre, son fond, sa gerbe ;
// sa vitrine vit dans `Trophees`, ses thèmes dans `Boutique`.
//
// Un seul geste partout : toucher une pièce l'essaie — la carte de la loge
// la montre, rien n'est enregistré —, et « Porter », dans la barre de la
// loge, enregistre l'essai. Chaque grille dit ce qu'il porte (« porté ») et
// ce qu'il essaie (« à l'essai »). La loge ne montre que ce qu'il a : ce qui
// reste se compte, et un lien mène à « Ma collection », qui dit d'où vient
// chaque chose et comment la gagner (le souhait du propriétaire du 13
// octobre 2026 : des finitions et des bordures qu'il n'avait pas s'y
// mêlaient aux siennes).

/** Ses classes : `selected`, ce que la carte montre ; `essaye`, à l'essai ; `porte`, porté sous un essai ; `neuve`. */
function classesDeLaCase({ montre, porte, neuve }: { montre: boolean; porte: boolean; neuve?: boolean }): string {
  return (montre ? ' selected' : '') + (montre && !porte ? ' essaye' : '') + (!montre && porte ? ' porte' : '') + (neuve ? ' neuve' : '')
}

/**
 * Les pages de la grille des avatars, celles de l'album de « Ma collection »
 * (le 13 octobre 2026 : la loge les rangeait en familles — légendaires,
 * portraits, compagnons, emojis — quand l'album les rangeait en raretés, et
 * l'on ne se retrouvait pas d'un écran à l'autre) : les emojis de
 * l'inscription d'abord, offerts à tous comme le Velours, puis chaque rareté
 * où il a quelque chose.
 */
export type PageDeLaLoge = 'offert' | RareteDAvatar

export interface PageDAvatars {
  page: PageDeLaLoge
  /** Ce qu'il a sur la page : les emojis de l'inscription, ou ses avatars de l'album, dans son ordre. */
  cles: readonly string[]
  /** Ce qui reste à gagner sur la même page de l'album — pour les offerts, dans tout l'album. */
  reste: number
}

/** Le nom entier d'une page : sous ses gemmes, à l'oreille. */
export const NOM_DE_LA_PAGE: Readonly<Record<PageDeLaLoge, string>> = { offert: 'Offerts à tous', ...NOM_DE_RARETE_D_AVATAR }

/** Ses pages, dans l'ordre des gemmes de l'album : celles où il n'a rien ne se montrent pas. */
export function pagesDeLaLoge(profil: PublicProfileDetail): PageDAvatars[] {
  const album = compteDeLAlbum(profil)
  return [
    { page: 'offert', cles: AVATARS, reste: album.total - album.acquis },
    ...sesPagesDeLAlbum(profil).map(p => ({ page: p.rarete, cles: p.avatars.map(a => a.cle), reste: p.reste })),
  ]
}

/**
 * La page où la grille s'ouvre : celle de l'avatar qu'il porte — on vient
 * souvent pour en changer, et ce qu'on quitte est juste à côté.
 */
export function pageDuPorte(profil: PublicProfileDetail): PageDeLaLoge {
  const a = avatarDeLAlbum(profil.legendaire) ?? avatarDeLAlbum(profil.avatar)
  return a && avatarsALui(profil).has(a.cle) ? a.rarete : 'offert'
}

/** Ce qui reste d'une page, au singulier et au pluriel : « 12 avatars rares à gagner : où ? ». */
const QUI_RESTE: Readonly<Record<Exclude<PageDeLaLoge, 'divin'>, readonly [string, string]>> = {
  offert: ['avatar', 'avatars'],
  commune: ['avatar commun', 'avatars communs'],
  peucommune: ['avatar peu commun', 'avatars peu communs'],
  rare: ['avatar rare', 'avatars rares'],
  epique: ['avatar épique', 'avatars épiques'],
  legendaire: ['avatar légendaire', 'avatars légendaires'],
}

/** Ce qu'une case de la grille dit d'elle : montrée par la carte, portée, nouvelle. */
interface EtatDUneCase {
  montre: boolean
  porte: boolean
  neuve?: boolean
}

/**
 * Ses classes, celles de la maquette : `selected`, ce que la carte montre —
 * lui seul bouge (`styles.css`) ; `essaye`, à l'essai, son halo d'or ;
 * `porte`, ce qu'il porte, sa coche — montré ou non.
 */
function classesDUnAvatar({ montre, porte, neuve }: EtatDUneCase): string {
  return (montre ? ' selected' : '') + (montre && !porte ? ' essaye' : '') + (porte ? ' porte' : '') + (neuve ? ' neuve' : '')
}

/**
 * Ce qu'une case dit à l'oreille après son nom : portée, quand la carte en
 * montre une autre — montrée, `aria-pressed` le dit déjà, et « portée,
 * activé » le disait deux fois —, et nouvelle.
 */
function ceQueDitLaCase({ montre, porte, neuve }: EtatDUneCase, portee = 'porté', nouvelle = 'nouveau'): string {
  return (porte && !montre ? `, ${portee}` : '') + (neuve ? `, ${nouvelle}` : '')
}

/**
 * Ses avatars, dans la loge : les gemmes de l'album de « Ma collection » —
 * les offerts, puis chaque rareté où il a quelque chose, chacune son compte
 * —, puis la grille de ce qu'il a sur la page choisie. Un toucher essaie,
 * rien d'autre : la carte collée en tête le montre, la case a son halo d'or,
 * celle qu'il porte garde sa coche, et « Porter », dans la barre de la loge,
 * le garde. Ce qui reste se compte sous la grille, et mène à sa page de
 * l'album. Quatre familles en pastilles — légendaires, portraits,
 * compagnons, emojis —, des cadenas au bout de chaque rangée, l'avaient
 * précédée (la maquette 1 du 12 octobre 2026).
 */
export function MesAvatars(props: PropsDUnePiece) {
  const { profil } = props
  const pages = pagesDeLaLoge(profil)
  const [choisie, setChoisie] = useState<PageDeLaLoge>(() => pageDuPorte(profil))
  // Une page qu'il n'a plus (un profil relu) : la première, les offerts.
  const page = pages.find(p => p.page === choisie) ?? pages[0]
  return (
    <section className="loge-avatars">
      <Gemmes
        gemmes={pages.map(p => ({
          id: p.page,
          court: p.page === 'offert' ? 'Offerts' : NOM_COURT_DE_RARETE_D_AVATAR[p.page],
          label: `${NOM_DE_LA_PAGE[p.page]}, ${p.cles.length} à toi`,
          compte: String(p.cles.length),
          style: gemmeDAvatar(p.page),
          divin: p.page === 'divin',
        }))}
        choisie={page.page}
        onChoisir={setChoisie}
        label="Mes avatars, par rareté"
        idDe={p => `loge-gemme-${p}`}
        panneau="loge-page-avatars"
        className="gemmes-loge"
      />
      <div className="loge-page-avatars" role="tabpanel" id="loge-page-avatars" aria-labelledby={`loge-gemme-${page.page}`}>
        <PageDAvatars {...props} page={page} />
      </div>
    </section>
  )
}

/**
 * La grille d'une page, sans état : ses cases — chacune essaie son avatar —,
 * puis ce qui reste sur la même page de l'album, compté, et son chemin.
 * Chaque case est dessinée par `Avatar`, qui fait venir son dessin : un
 * portrait, un légendaire, un compagnon ou un Divin, sans l'emoji dessous en
 * attendant.
 */
export function PageDAvatars({ profil, essai, essayer, neufs, page }: PropsDUnePiece & { page: PageDAvatars }) {
  // Ce que la carte montre — l'avatar essayé, sinon celui qu'il porte — et
  // la version de chaque Éclat qu'elle montrerait.
  const montre = avatarMontre(profil, essai)
  const tenue = avecLEssai(profil, essai)
  const brille = (cle: string) => brilleChez(tenue, cle)
  const dessine = (cle: string): EtatDUneCase => ({ montre: montre.legendaire === cle, porte: profil.legendaire === cle, neuve: neufs?.has(cle) })
  const emoji = (e: string): EtatDUneCase => ({
    montre: !montre.legendaire && montre.avatar === e,
    porte: !profil.legendaire && profil.avatar === e,
    neuve: neufs?.has(e),
  })
  const laCase = (cle: string, etat: EtatDUneCase, label: string, piece: Essai, dedans: ReactNode, anneau = '') => (
    <button
      key={cle}
      type="button"
      className={'loge-case case-avatar' + anneau + classesDUnAvatar(etat)}
      aria-pressed={etat.montre}
      aria-label={label + ceQueDitLaCase(etat)}
      onClick={() => essayer(piece)}
    >
      {dedans}
    </button>
  )
  // Un médaillon dans sa case, sans finition ni emoji dessous : la finition se voit sur la carte.
  const medaillon = (cle: string, eclat = false) => <Avatar avatar="" legendaire={cle} eclat={eclat} />
  const eclate = (cle: string) => (brille(cle) ? ', éclaté' : '')
  /** La case d'un avatar : son dessin, ce qu'elle dit à l'oreille, son anneau, ce qu'elle essaie. */
  const uneCase = (cle: string) => {
    if (page.page === 'offert') return laCase(cle, emoji(cle), `Avatar ${cle}${eclate(cle)}`, { avatar: cle }, <Avatar avatar={cle} eclat={brille(cle)} />)
    const c = COLLECTION.find(x => x.emoji === cle)
    if (c) {
      const anneau = c.niveau < COLLECTION_HAUTE ? ' anneau-collection' : ' anneau-collection-haut'
      return laCase(cle, emoji(cle), `Avatar ${cle}, de collection · niveau ${c.niveau}${eclate(cle)}`, { avatar: cle }, <Avatar avatar={cle} eclat={brille(cle)} />, anneau)
    }
    const l = legendaire(cle)
    if (l) return laCase(cle, dessine(cle), `${l.nom}, légendaire${eclate(cle)}`, { legendaire: cle }, medaillon(cle, brille(cle)), ' anneau-legendaire')
    const d = divin(cle)
    if (d) return laCase(cle, dessine(cle), `${d.nom}, Divin`, { legendaire: cle }, medaillon(cle), ' anneau-divin')
    const p = portraitDe(cle)
    if (p) return laCase(cle, dessine(cle), `${p.nom}, portrait ${deLaBranche(brancheDe(p))}${eclate(cle)}`, { legendaire: cle }, medaillon(cle, brille(cle)))
    // Une forme de compagnon : une forme d'avant se porte aussi.
    const f = formeDeCompagnon(cle)
    if (f) return laCase(cle, dessine(cle), `${f.nom}, ${compagnonDe(f).nom}, ${NOM_DE_LA_FORME[f.rang].toLowerCase()}${eclate(cle)}`, { legendaire: cle }, medaillon(cle, brille(cle)))
    return null
  }
  return (
    <>
      <div className={'loge-grille grille-unique' + (page.page === 'offert' ? ' loge-grille-emojis' : '')} role="group" aria-label={NOM_DE_LA_PAGE[page.page]}>
        {page.cles.map(uneCase)}
      </div>
      {/* Les Divins ne disent pas comment : rien à compter, nulle part où aller (invariant 21). */}
      {page.page !== 'divin' && (
        <AGagner
          n={page.reste}
          un={QUI_RESTE[page.page][0]}
          plusieurs={QUI_RESTE[page.page][1]}
          href={page.page === 'offert' ? '#collection-avatars' : `#collection-avatars-${page.page}`}
        />
      )}
    </>
  )
}

/**
 * « +3 », au bout d'une rangée de pastilles : ce qui reste se compte sans se
 * montrer — des finitions et des bordures éteintes, au bout de la rangée, se
 * prenaient pour des siennes (le 13 octobre 2026). Il mène à leur ligne de
 * « Ma collection », qui dit le niveau ou la ligue de chacune.
 */
function PastilleAGagner({ n, nom, href }: { n: number; nom: string; href: string }) {
  if (n <= 0) return null
  return (
    <a className="finition-choix pastille-a-gagner" href={href} aria-label={`${n} ${nom} à gagner : où et comment, dans « Ma collection »`}>
      <i className="finition-teinte teinte-a-gagner" aria-hidden="true">{`+${n}`}</i>
      <span aria-hidden="true">à gagner</span>
    </a>
  )
}

/**
 * Une rangée de pastilles : serrées d'un bord à l'autre quand elles sont
 * nombreuses — huit tiennent en 360 —, alignées à gauche quand elles sont
 * peu, au lieu de s'écarter d'un bord à l'autre.
 */
const rangee = (n: number) => 'loge-finitions-rangee' + (n < 6 ? ' rangee-courte' : '')

/**
 * Sa finition, sur une rangée de pastilles (la maquette 3, que le
 * propriétaire a voulue le 12 octobre 2026) : « Auto » — la plus belle qu'il
 * a, que chaque niveau qui en ouvre une nouvelle fait porter d'office —, puis
 * celles qu'il a, chacune sa couleur, et ce qui reste compté au bout (« +3 »),
 * qui mène à leur ligne de « Ma collection », chacune son niveau. Les
 * restantes s'y montraient éteintes, chacune son niveau (le 12 octobre :
 * « il manque les finitions 15, 20, 25 ») ; le lendemain, le propriétaire
 * ne voulait plus y voir que les siennes. Touchée, elle s'essaie sur la
 * carte de la loge. Elle se cachait derrière une ligne qui se dépliait en
 * huit grandes cases, un avatar animé dans chacune.
 */
export function MesFinitions({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  const vu = avecLEssai(profil, essai)
  // Un Divin ne prend ni finition ni Éclat : la sienne se voit sous ses autres avatars.
  const divinPorte = divin(vu.legendaire)
  const montree = vu.finitionChoisie
  const plusBelle = meilleureFinition(profil.niveau)
  const siennes = FINITIONS.filter(f => profil.ouvertes.includes(f))
  const reste = FINITIONS.length - siennes.length
  const pastille = (cle: FinitionChoisie, nom: string, teinte: Finition, label: string) => {
    const montre = montree === cle
    const porte = profil.finitionChoisie === cle
    const neuve = cle !== 'auto' && !!neufs?.has(`finition:${cle}`)
    return (
      <button
        key={cle}
        type="button"
        className={'finition-choix' + classesDUnAvatar({ montre, porte, neuve })}
        aria-pressed={montre}
        aria-label={label + ceQueDitLaCase({ montre, porte, neuve }, 'portée', 'nouvelle')}
        onClick={() => essayer({ finition: cle })}
      >
        <i className={`finition-teinte teinte-${teinte}`} aria-hidden="true">
          {cle === 'auto' && <Icon name="sparkles" />}
        </i>
        <span aria-hidden="true">{nom}</span>
      </button>
    )
  }
  return (
    <div className="loge-finitions">
      <span className="loge-sous-titre" id="loge-finitions-titre">
        Finition
      </span>
      {divinPorte && <p className="muted small">{`${divinPorte.nom} a sa propre lumière : ta finition se voit sous tes autres avatars.`}</p>}
      <div className={rangee(1 + siennes.length + (reste > 0 ? 1 : 0))} role="group" aria-labelledby="loge-finitions-titre">
        {pastille('auto', 'Auto', plusBelle, `Auto, toujours la plus belle : ${NOM_FINITION[plusBelle]}`)}
        {siennes.map(f => pastille(f, NOM_FINITION[f], f, NOM_FINITION[f]))}
        <PastilleAGagner n={reste} nom={reste > 1 ? 'finitions' : 'finition'} href="#collection-finitions" />
      </div>
    </div>
  )
}

/** Ce qu'une bordure dit sous la rangée : son nom, et ses crans — ce qui manque pour la sertir. */
function phraseDeLaBordure(b: BordureDeLigue): string {
  const nom = NOM_DE_LA_BORDURE[b.ligue]
  if (b.crans >= CRANS_D_UNE_BORDURE) return `${nom} · sertie, ses douze crans gagnés.`
  const reste = CRANS_D_UNE_BORDURE - b.crans
  const crans = b.crans === 0 ? 'aucun cran encore' : `${b.crans} cran${b.crans > 1 ? 's' : ''} sur ${CRANS_D_UNE_BORDURE}`
  return `${nom} · ${crans} : encore ${reste} victoire${reste > 1 ? 's' : ''} en ${ligueParCle(b.ligue).nom.toLowerCase()} pour la sertir.`
}

/**
 * Sa bordure de ligue, sous sa finition (la maquette des alliages, le 12
 * octobre 2026) : « Auto » — sa plus haute qui a un cran —, « Sans », puis
 * les bordures des ligues qu'il a atteintes en duel, chacune autour de son
 * avatar, dans le métal de sa finition, et ce qui reste compté au bout, qui
 * mène à leur ligne de « Ma collection » — les autres s'y montraient
 * éteintes, chacune sa cote, jusqu'au 13 octobre 2026. Dessous, ce que dit
 * celle que la carte montre : ses crans, et ce qui manque pour la sertir.
 * Rien n'y bouge.
 */
export function MesBordures({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  const vu = avecLEssai(profil, essai)
  const bordures = profil.bordures ?? []
  // Sous un Divin, ni finition ni bordure : il a sa propre lumière.
  const divinPorte = divin(vu.legendaire)
  const montree = vu.bordureChoisie ?? 'auto'
  const portee = profil.bordureChoisie ?? 'auto'
  const finition = vu.finition
  if (bordures.length === 0) {
    return (
      <div className="loge-bordures">
        <span className="loge-sous-titre">Bordure</span>
        <p className="muted small">
          Ton premier duel classé ouvre la bordure de ta ligue ; chaque duel gagné dans la ligue y sertit un cran. <a href="/duels">Jouer un duel</a>
        </p>
      </div>
    )
  }
  const auto = bordurePortee('auto', bordures)
  const pastille = (cle: ChoixDeBordure, nom: string, bordure: BordureDeLigue | null, label: string) => {
    const montre = montree === cle
    const porte = portee === cle
    const neuve = cle !== 'auto' && cle !== AUCUNE_BORDURE && !!neufs?.has(`bordure:${cle}`)
    return (
      <button
        key={cle}
        type="button"
        className={'finition-choix bordure-choix' + classesDUnAvatar({ montre, porte, neuve })}
        aria-pressed={montre}
        aria-label={label + ceQueDitLaCase({ montre, porte, neuve }, 'portée', 'nouvelle')}
        onClick={() => essayer({ bordure: cle })}
      >
        <span className="bordure-apercu" aria-hidden="true">
          {/* Autour de ce qu'il porte, un légendaire compris : l'emoji d'en dessous s'y montrait (le 14 octobre 2026). */}
          {bordure ? <Avatar {...avatarDeLApercu(vu)} finition={finition} bordure={bordure} /> : <i className="bordure-sans" />}
        </span>
        <span aria-hidden="true">{nom}</span>
      </button>
    )
  }
  const reste = LIGUES.length - bordures.length
  const montreeVue = bordurePortee(montree, bordures)
  return (
    <div className="loge-bordures">
      <span className="loge-sous-titre" id="loge-bordures-titre">
        Bordure
      </span>
      {divinPorte && <p className="muted small">{`${divinPorte.nom} a sa propre lumière : ta bordure se voit sous tes autres avatars.`}</p>}
      <div className={rangee(2 + bordures.length + (reste > 0 ? 1 : 0)) + ' loge-bordures-rangee'} role="group" aria-labelledby="loge-bordures-titre">
        {pastille('auto', 'Auto', auto, auto ? `Auto, ta plus haute : ${NOM_DE_LA_BORDURE[auto.ligue]}` : 'Auto, ta plus haute dès son premier cran')}
        {pastille(AUCUNE_BORDURE, 'Sans', null, 'Sans bordure')}
        {bordures.map(b => pastille(b.ligue, ligueParCle(b.ligue).court, b, `${NOM_DE_LA_BORDURE[b.ligue]}, ${ligueParCle(b.ligue).nom.toLowerCase()}`))}
        <PastilleAGagner n={reste} nom={reste > 1 ? 'bordures' : 'bordure'} href="#collection-bordures" />
      </div>
      <p className="muted small loge-bordure-phrase">
        {montree === AUCUNE_BORDURE
          ? 'Sans bordure : ton avatar et sa finition, rien autour.'
          : montreeVue
            ? phraseDeLaBordure(montreeVue)
            : 'Auto : ta plus haute bordure, dès que tu y gagnes un duel.'}
      </p>
    </div>
  )
}

/**
 * Son titre, sous son prénom : chaque haut fait gagné ouvre le sien — son
 * nom, « L'Oracle », « La Lanterne Rouge » —, et chaque palier de maître des
 * sentiers du savoir le sien (« Maître de la forêt »). Il s'écrit sur sa
 * carte : la salle le lit en touchant son nom. Ceux qui restent à gagner se
 * comptent, sans se nommer : trente boutons fermés noyaient les siens — sauf
 * pour qui n'en a aucun, à qui la page dit comment gagner le premier. Touché,
 * un titre s'essaie sous son prénom, sur la carte de la loge.
 */
export function MonTitre({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  // Les maîtres d'abord : un sentier gravi jusqu'au bout se dit en premier ;
  // puis les titres datés des champions du mois, du plus récent au plus ancien.
  const dates = profil.titresDates ?? []
  const gagnes = [...maitresDe(profil.sentiers ?? {}).map(cleDeMaitre), ...dates, ...hautsFaitsGagnes(recompensesDe(profil.hautsFaits))]
  const aGagner = profil.hautsFaits.length - (gagnes.length - maitresDe(profil.sentiers ?? {}).length - dates.length)
  const porte = profil.titre ?? null
  const montre = essai.titre !== undefined ? essai.titre : porte
  // Ce que chaque titre dit de lui, à l'oreille comme à l'œil : porté, à l'essai, nouveau.
  const etat = (cle: string | null) => ({ montre: montre === cle, porte: porte === cle, neuve: cle !== null && neufs?.has(cle) })
  const marque = (cle: string | null) => {
    const e = etat(cle)
    const mot = e.porte ? 'porté' : e.montre ? 'à l’essai' : e.neuve ? 'nouveau' : null
    return mot && <span className="titre-etat">{mot}</span>
  }
  // Sa pièce s'appelle « Titre » : la carte dit ce qu'elle range, ceux qu'il a.
  return (
    <section className="card">
      <h3>
        <Icon name="star" />
        Mes titres {gagnes.length > 0 && <span className="muted small titre-compte">{`${gagnes.length} à toi`}</span>}
      </h3>
      {/* Où il s'écrit, la ligne de la pièce le dit ; ici, d'où viennent les autres. */}
      <p className="muted small">Chaque trophée gagné ouvre le sien, chaque palier de maître des sentiers aussi.</p>
      <div className="titres" role="group" aria-label="Mon titre">
        <button type="button" className={'titre-choix' + classesDeLaCase(etat(null))} aria-pressed={montre === null} onClick={() => essayer({ titre: null })}>
          Aucun
          {marque(null)}
        </button>
        {gagnes.map(cle => (
          <button key={cle} type="button" className={'titre-choix' + classesDeLaCase(etat(cle))} aria-pressed={montre === cle} onClick={() => essayer({ titre: cle })}>
            {nomDuTitre(cle)}
            {marque(cle)}
          </button>
        ))}
      </div>
      {gagnes.length === 0 && <PremierHautFait profil={profil} />}
      {/* Chaque trophée ouvre le sien : ceux qui restent se comptent, et l'album dit comment les gagner. */}
      <AGagner n={aGagner} un="titre" plusieurs="titres" href="#collection-trophees" />
    </section>
  )
}

/**
 * Le fond de sa carte : ce qu'on voit derrière elle quand quelqu'un touche
 * son nom. Rien d'autre ne change — ni l'écran commun, ni les classements.
 * Ceux qu'il a seulement ; ceux qui restent à gagner se voient dans sa
 * collection, avec ce qu'il faut pour les ouvrir, et ceux des savoirs à la
 * boutique. Touché, un fond s'essaie derrière la carte de la loge.
 */
export function MonFond({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  if (!profil.fonds) return null
  const porte = profil.fond ?? null
  const montre = essai.fond !== undefined ? essai.fond : porte
  // Ceux des savoirs s'achètent : la boutique les montre, la collection dit où gagner les autres.
  const aLaBoutique = FONDS_EN_BOUTIQUE.filter(f => !profil.fonds!.includes(f.key)).length
  const reste = FONDS.filter(f => !profil.fonds!.includes(f.key) && !f.savoir).length
  const etat = (cle: string | null, sinon: string) => (porte === cle ? 'porté' : montre === cle ? 'à l’essai' : cle && neufs?.has(cle) ? 'nouveau' : sinon)
  return (
    <section className="card">
      <h3>
        <Icon name="image" />
        {/* Compté comme sa ligne de la collection : le Velours, à tout le monde, n'en est pas. */}
        Mes fonds {profil.fonds.length > 0 && <span className="muted small titre-compte">{`${profil.fonds.length} à toi`}</span>}
      </h3>
      <p className="muted small">Touches-en un : ta carte, en haut, l’essaie aussitôt.</p>
      <div className="finitions fonds-choix">
        <button type="button" className={'finition-btn' + classesDeLaCase({ montre: !montre, porte: !porte })} aria-pressed={!montre} onClick={() => essayer({ fond: null })}>
          <span className="fond-apercu" aria-hidden="true" />
          <span className="finition-nom">Velours</span>
          <span className="muted small">{etat(null, 'd’office')}</span>
        </button>
        {FONDS.filter(f => profil.fonds!.includes(f.key)).map(f => (
          <button
            key={f.key}
            type="button"
            className={'finition-btn' + classesDeLaCase({ montre: montre === f.key, porte: porte === f.key, neuve: neufs?.has(f.key) })}
            aria-pressed={montre === f.key}
            onClick={() => essayer({ fond: f.key })}
          >
            <span className={`fond-apercu carte-fond fond-${f.key}`} aria-hidden="true" />
            <span className="finition-nom">{f.nom}</span>
            <span className="muted small">{etat(f.key, 'ouvert')}</span>
          </button>
        ))}
      </div>
      {aLaBoutique > 0 && (
        <a className="link-inline lien-boutique" href="/boutique#fonds">
          <Icon name="bag" />
          {`${aLaBoutique} autre${aLaBoutique > 1 ? 's' : ''} à la boutique`}
        </a>
      )}
      <AGagner n={reste} un="fond" plusieurs="fonds" href="#collection-fonds" />
    </section>
  )
}

/**
 * Sa gerbe : ce qui éclate sur son téléphone à une bonne réponse, en soirée,
 * au quiz du jour et en campagne. Pour lui seul — ni la salle ni l'écran
 * commun n'en voient rien. Les confettis d'office, et « Aucune » pour qui
 * n'en veut pas ; celles qu'il a éclatent au toucher, et s'essaient.
 * Celles qui restent à gagner éclatent dans sa collection, pour qu'on sache
 * ce qu'on vise (`GerbesDeLaCollection`).
 */
export function MaGerbe({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  // L'aperçu : la gerbe qu'on vient de toucher éclate, une fois par toucher.
  const [apercu, setApercu] = useState<{ cle: string; n: number } | null>(null)
  if (!profil.gerbes) return null
  // La gerbe portée se lit résolue : null, il n'en veut aucune.
  const porte = profil.gerbe ?? null
  const montre = essai.gerbe !== undefined ? (essai.gerbe === AUCUNE_GERBE ? null : essai.gerbe) : porte
  const montrer = (cle: string) => setApercu(a => ({ cle, n: (a?.n ?? 0) + 1 }))
  const reste = GERBES.filter(g => !profil.gerbes!.includes(g.key)).length
  const etat = (cle: string | null, sinon: string) => (porte === cle ? 'portée' : montre === cle ? 'à l’essai' : cle && neufs?.has(cle) ? 'nouvelle' : sinon)
  return (
    <section className="card">
      <h3>
        <Icon name="zap" />
        Mes gerbes <span className="muted small titre-compte">{`${profil.gerbes.length} à toi`}</span>
      </h3>
      <p className="muted small">En soirée, au quiz du jour et en campagne. Touches-en une : elle éclate, et tu l’essaies.</p>
      <div className="finitions gerbes-choix">
        <button type="button" className={'finition-btn' + classesDeLaCase({ montre: !montre, porte: !porte })} aria-pressed={!montre} onClick={() => essayer({ gerbe: AUCUNE_GERBE })}>
          <span className="gerbe-apercu" aria-hidden="true" />
          <span className="finition-nom">Aucune</span>
          <span className="muted small">{etat(null, 'sobre')}</span>
        </button>
        {GERBES.filter(g => profil.gerbes!.includes(g.key)).map(g => (
          <button
            key={g.key}
            type="button"
            className={'finition-btn' + classesDeLaCase({ montre: montre === g.key, porte: porte === g.key, neuve: neufs?.has(g.key) })}
            aria-pressed={montre === g.key}
            onClick={() => {
              montrer(g.key)
              essayer({ gerbe: g.key })
            }}
          >
            <span className="gerbe-apercu" aria-hidden="true">
              {g.particules.slice(0, 3).join('')}
            </span>
            <span className="finition-nom">{g.nom}</span>
            <span className="muted small">{etat(g.key, 'ouverte')}</span>
          </button>
        ))}
      </div>
      <AGagner n={reste} un="gerbe" plusieurs="gerbes" href="#collection-gerbes" />
      {apercu && <GerbeDeJuste key={apercu.n} cle={apercu.cle} />}
    </section>
  )
}

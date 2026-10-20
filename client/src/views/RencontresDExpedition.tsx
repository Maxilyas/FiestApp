import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { Balise } from '../components/Balise'
import { Feuille } from '../components/Pieces'
import { Onglets } from '../components/Onglets'
import { CARTES_PEINTES } from '../components/cartes-peintes'
import { espacesFines, formatNumber } from '../format'
import { GEMME_MAUDITE, gemme } from '../gemmes'
import { useModale } from '../modale'
import { iconeDuSujet } from '../iconeDuSujet'
import { couleurDePiste, pourcentDeChance } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { ceQueRapporteUneCuriosite } from '../../../shared/curiosites'
import { CATEGORIES } from '../../../shared/categories'
import type { Niveau } from '../../../shared/campagne'
import type { RareteDeTheme } from '../../../shared/themes'
import {
  MARCHES_DES_ACTES,
  PRIX_DE_L_ECHOPPE,
  duGardien,
  gardienAuFeminin,
  leGardien,
  nomDuGardien,
  type CodexDeLaPage,
  type FormeDEscale,
  type VueDeLExpedition,
} from '../../../shared/expedition'
import {
  ASCENSION,
  ASCENSION_MAX,
  DOS_DES_CARTES,
  EXPLOITS,
  RENOMMEE,
  ascensionDe,
  dosDe,
  echelleDe,
  energieDesActesALAscension,
  exploitDe,
  mainMaxEnQuestion,
  niveauDeLaRegle,
  niveauDuStyle,
  ouvertureDe,
  ouvertureDuDos,
  progressionDe,
  reposALAscension,
  type CleDExploit,
  type DosDuPaquet,
  type Exploit,
  type RegleDuCodex,
} from '../../../shared/codex'
import {
  BASES_REMPLACEES_EN_QUESTION,
  BASES_REMPLACEES_PAR_LE_STYLE,
  CARTES_DE_DEPART_DU_STYLE,
  CARTES_DES_RENCONTRES,
  CARTES_PAR_QUESTION,
  CHANCE_D_UNE_OFFRE_AMELIOREE,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UNE_SOURCE,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_MAX,
  FAMILLES_DE_CARTES,
  FIOLES,
  FIOLES_EN_QUESTION,
  FIOLES_MAX,
  MAIN_A_L_OUVERTURE_DE_L_ACTE,
  MISES,
  STYLES,
  STYLES_EN_QUESTION,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  VERSION_DES_COUPS_DE_POUCE,
  VERSION_DES_CURIOSITES,
  VERSION_DES_FAMILLES,
  VERSION_DES_HUIT_FAMILLES,
  VERSION_DE_LA_FRISE,
  VERSION_DU_JEU_COMPLET,
  ameliorer,
  apercuDuTour,
  baseDe,
  carteALaVersion,
  carteDeRencontre,
  cartesDeCombat,
  changeDeQuestion,
  chiffresApresLaCarte,
  courageDeLaCarte,
  effaceesDuTour,
  estDuPari,
  fioleDe,
  formeApresLaCarte,
  jeuDuStyle,
  stylesDeLaVersion,
  viseLaQuestion,
  type AnnonceDuTour,
  type ApercuDuTour,
  type CarteDeRencontre,
  type CleDeFiole,
  type CoupDeRencontre,
  type FamilleDeCartes,
  type MomentDUneCarte,
  type StyleDeJeu,
  type VueDeLaRencontre,
} from '../../../shared/rencontres'

// Les rencontres, à l'écran (`shared/rencontres.ts` ; la proposition
// « L'Expédition en cartes », validée par le propriétaire le 18 octobre 2026 :
// « C'est good lance le prototype avec tes recos » — le jeu depuis le 19). Une
// escale à question est un adversaire : la page dit qui il est, ce qu'il lui
// reste et la question qu'il pose ; puis ce que la réponse fera — « Si tu as
// juste », « Si tu te trompes » —, la main, le pari, et « Voir la question » ;
// la question vue, les cartes qui se jouent pendant ; la réponse dite, ce
// qu'elle a fait. Rien ne se calcule ici que la page ne pourrait relire du
// serveur : les refus des cartes et des paris arrivent avec la vue, et
// l'aperçu se refait à la mise choisie — et à la carte levée — par la règle
// même du serveur (`apercuDuTour`, `chiffresApresLaCarte`).
//
// Revue le même jour pour qui découvre (« Je veux que ce soit très simple à
// comprendre […] bien compréhensible pour des novices ») : des mots de tous
// les jours — l'adversaire perd des points, un bouclier pare son attaque, un
// pari —, jamais « sceaux », « Charge » ni « Garde » ; la main entière, chaque
// carte disant ce qu'elle fait sans qu'on la lève ; avant le bouton, pas
// dessous ; et levée, ce qu'elle changerait.
//
// Ses pièces, à part de `ExpeditionApp.tsx`, qui les assemble : une carte n'est
// pas un joker — son coût, son moment, sa famille —, et la page des jokers
// garde les siens pour les expéditions d'avant, qui finissent sous leurs
// règles.

/** « 62 % » : une chance telle que la page l'écrit, le signe collé par une espace fine insécable. */
export const pourcents = (chance: number) => `${pourcentDeChance(chance)} %`

/** Le nom d'une catégorie là où la place manque : sous une escale, dans les douze pastilles du Commandement. */
export const COURT: Readonly<Record<string, string>> = {
  'Culture générale': 'Culture G.',
  'Cinéma & séries': 'Cinéma',
  'Arts & lettres': 'Arts',
  'Jeux & pop culture': 'Jeux & pop',
  'Autour de la fête': 'La fête',
}

// ── Les cartes ──────────────────────────────────────────────────────────────

/**
 * La version du départ de l'expédition à l'écran : ses cartes se lisent à ses
 * chiffres (`carteALaVersion`) — une expédition partie avant le codex garde
 * les siens, et sa main dit ce que le serveur fera. Le codex, hors de toute
 * expédition, montre les cartes d'aujourd'hui.
 */
export const VersionDesCartes = createContext<number>(VERSION_DU_JEU_COMPLET)

/** Une carte par sa clé, à la version de l'expédition à l'écran. */
function useCarte(): (cle: string) => CarteDeRencontre | undefined {
  const v = useContext(VersionDesCartes)
  return cle => carteALaVersion(cle, v)
}

/**
 * La question au centre (v10) à l'écran : plus d'énergie — ni orbe, ni coût
 * au coin des cartes —, l'adversaire en crans, une carte par question.
 */
export const enQuestion = (v: number) => v >= VERSION_DE_LA_QUESTION_AU_CENTRE
const useEnQuestion = () => enQuestion(useContext(VersionDesCartes))

/**
 * La couleur d'une carte, au cadre : la gemme de sa rareté — celle des
 * jokers, de l'album et de la boutique (`gemmes.ts`) ; l'épique, depuis le
 * jeu complet, le pourpre de l'album, et une maudite son rouge sombre
 * (`GEMME_MAUDITE`). Une seule couleur par rareté dans toute l'application.
 */
const GEMME_DE_LA_CARTE: Record<Exclude<CarteDeRencontre['rarete'], 'maudit'>, RareteDeTheme> = { commun: 'commune', rare: 'rare', epique: 'epique', legendaire: 'legendaire' }
export const gemmeDeLaCarte = (c: CarteDeRencontre) => (c.rarete === 'maudit' ? GEMME_MAUDITE : gemme(GEMME_DE_LA_CARTE[c.rarete]))

/** Sa rareté, accordée à « carte ». */
export const RARETE_DE_LA_CARTE: Record<CarteDeRencontre['rarete'], string> = { commun: 'commune', rare: 'rare', epique: 'épique', maudit: 'maudite', legendaire: 'légendaire' }

/** Quand une carte se joue, en clair : la carte levée, l'offre, l'échoppe le disent. */
export const MOMENT: Record<MomentDUneCarte, string> = {
  preparation: 'Avant de voir la question',
  reflexe: 'Pendant la question',
  pouvoir: 'Pour toute la rencontre',
  route: 'Sur le plan, une fois par acte',
}
const MOMENT_COURT: Record<MomentDUneCarte, string> = { preparation: 'avant la question', reflexe: 'pendant la question', pouvoir: 'toute la rencontre', route: 'sur le plan' }

/** Dans la question au centre (v10), chaque carte se joue la question vue — celles du pari avec lui, à l'annonce. */
const MOMENT_EN_QUESTION: Record<MomentDUneCarte, string> = {
  preparation: 'Avec le pari, avant la question',
  reflexe: 'La question sous les yeux',
  pouvoir: 'Pour toute la rencontre',
  route: 'Sur le plan, une fois par acte',
}
const MOMENT_COURT_EN_QUESTION: Record<MomentDUneCarte, string> = { preparation: 'avec le pari', reflexe: 'la question vue', pouvoir: 'toute la rencontre', route: 'sur le plan' }

/** Son moment, à la version de l'expédition à l'écran. */
export const momentDit = (m: MomentDUneCarte, v: number) => (enQuestion(v) ? MOMENT_EN_QUESTION : MOMENT)[m]
const momentCourt = (m: MomentDUneCarte, v: number) => (enQuestion(v) ? MOMENT_COURT_EN_QUESTION : MOMENT_COURT)[m]

/** Son moment en un dessin, à côté de ses mots : l'œil fermé avant de voir la question, ouvert pendant. */
const ICONE_DU_MOMENT: Record<MomentDUneCarte, IconName> = { preparation: 'eye-off', reflexe: 'eye', pouvoir: 'infinity', route: 'flag' }

/** Le dessin d'une carte sans légendaire ; celui d'un légendaire est son médaillon. */
const ICONE_DE_LA_CARTE: Readonly<Record<string, IconName>> = {
  concentration: 'target',
  prudence: 'shield',
  'coup-d-oeil': 'eye',
  echange: 'rotate',
  pioche: 'plus-square',
  'arret-sur-image': 'pause',
  detour: 'arrow-up',
  'double-chance': 'copy',
  sursis: 'hourglass',
  'tout-ou-rien': 'dice',
  // L'éclair est à l'énergie : quitte ou double prend la couronne.
  'quitte-ou-double': 'crown',
  plume: 'edit',
  bibliotheque: 'book',
  'doubler-la-mise': 'ecu',
  banco: 'star',
  corser: 'plus',
  simplifier: 'check',
  echauffement: 'timer',
  lancee: 'spark',
  parade: 'bouclier',
  'contre-attaque': 'sabre',
  lucidite: 'bulb',
  'troisieme-oeil': 'moon',
  // Le jeu complet : chacune le sien — les posées pour toute la rencontre se reconnaissent ainsi, en haut de l'écran.
  evidence: 'search',
  meditation: 'leaf',
  'sang-froid': 'check-circle',
  panacee: 'fiole',
  maitrise: 'award',
  surmenage: 'alert',
  'savoir-faire': 'clipboard',
  memoire: 'archive',
  lecon: 'bell',
  expose: 'pupitre',
  encyclopedie: 'lettres',
  genie: 'sun',
  pourboire: 'bag',
  cagnotte: 'coffre',
  assurance: 'lock',
  fortune: 'trophy',
  pactole: 'medal',
  rafle: 'tag',
  'volte-face': 'shuffle',
  prisme: 'palette',
  miroir: 'image',
  cameleon: 'paw',
  metamorphose: 'globe',
  polymorphe: 'hash',
  foulee: 'skip',
  acceleration: 'play',
  rythme: 'music',
  sprint: 'avion',
  'vent-arriere': 'volume',
  inarretable: 'dinosaure',
  muraille: 'landmark',
  pansement: 'stethoscope',
  cuirasse: 'anneau',
  'second-souffle': 'bulles',
  bastion: 'chateau',
  represailles: 'swords',
  augure: 'repere',
  presage: 'message',
  voyance: 'maximize',
  astrolabe: 'boussole',
  vision: 'telescope',
  revelation: 'sparkles',
}

/** Une carte en petit : le médaillon du légendaire qui la donne, sinon son dessin. */
export function VisageDeLaCarte({ c }: { c: CarteDeRencontre }) {
  return c.legendaire ? (
    <span className="exp-medaillon exp-visage-joker" aria-hidden="true">
      <Dessin cle={c.legendaire} />
    </span>
  ) : (
    <Icon name={ICONE_DE_LA_CARTE[baseDe(c.cle)] ?? 'sparkles'} />
  )
}

/** Ce que dit une carte au-delà de son effet : quand elle se joue — à la version de son départ —, si elle ne sert qu'une fois par rencontre, si elle aide, d'où elle vient. */
export function origineDeLaCarte(c: CarteDeRencontre, v = VERSION_DES_HUIT_FAMILLES): string {
  return [momentDit(c.moment, v), ...plusDeLaCarte(c, v)].join(' · ')
}

/**
 * Ce qu'il faut savoir de plus sur elle : une fois par rencontre — ou par
 * expédition —, un indice, le légendaire qui la donne, ce que l'amélioration
 * lui a donné. Dans la question au centre (v10), Augure efface à la question
 * suivante : c'est sa réponse à elle qui ne compte pas.
 */
function plusDeLaCarte(c: CarteDeRencontre, v: number): string[] {
  const dAvance = enQuestion(v) && baseDe(c.cle) === 'augure'
  // Un pouvoir qui aide (v14 : Troisième œil, le Rythme) aide les questions qui suivent, pas forcément celle où il se pose.
  const aide = dAvance
    ? 'une aide : ta réponse à la question suivante ne compte pas dans tes statistiques'
    : c.moment === 'pouvoir'
      ? 'une aide : les réponses qu’elle aide ne comptent pas dans tes statistiques'
      : 'une aide : ta réponse ne compte pas dans tes statistiques'
  return [
    c.unique ? 'une fois par expédition' : c.epuisement && 'une fois par rencontre',
    c.indice && aide,
    c.legendaire && `la carte ${duGardien(c.legendaire)}`,
    c.amelioree && c.amelioration && `améliorée : ${c.amelioration.gain.toLowerCase()}`,
  ].filter((x): x is string => !!x)
}

/**
 * La teinte de chaque famille, au fond de l'illustration d'une carte — la
 * rareté, elle, est au cadre (`--gemme`) : comme les couleurs d'un
 * personnage de Slay the Spire et l'or de ses cartes rares. Une convention,
 * écrite en dur : aucun thème ne la repeint (règle `css.md`).
 */
const TEINTE_DE_LA_FAMILLE: Record<FamilleDeCartes, string> = {
  neutre: '#9aa9bd',
  erudit: '#7d72f0',
  flambeur: '#e8703f',
  metamorphe: '#c262d6',
  elan: '#4fbf72',
  rempart: '#c49a5a',
  devin: '#2fb3a6',
  // Les huit familles (v9) : l'azur du Sophiste, loin du violet de l'Érudit ; le cramoisi du Téméraire, plus rouge que la braise du Flambeur.
  sophiste: '#4f8ee0',
  temeraire: '#d63a4a',
}

/**
 * Ce qu'une carte coûte d'énergie, en chiffre, dans l'orbe de l'énergie
 * — le même qu'au-dessus de la main : on voit ce qu'elle en prend. Rouge,
 * quand il n'en reste pas assez (`manque`). Une carte de route ne coûte
 * rien : son drapeau.
 */
function CoutEnEnergie({ c, manque }: { c: CarteDeRencontre; manque?: boolean }) {
  if (c.moment === 'route') {
    return (
      <span className="exp-vc-cout exp-vc-route">
        <Icon name="flag" />
      </span>
    )
  }
  return <span className={'exp-vc-cout' + (manque ? ' exp-vc-manque' : '')}>{c.cout}</span>
}

/** Une carte dessinée, à sa taille : dans la main, dans une rangée — un tas, une offre —, levée. */
export type TailleDeCarte = 'main' | 'rangee' | 'levee'

/**
 * Un nom qui ne se coupe pas — un mot de onze lettres et plus — s'écrit plus
 * serré dans une rangée : sur trois colonnes en 360, le codex lisait
 * « Concentratio ».
 */
const serre = (nom: string) => Math.max(...nom.split(/[\s-]/).map(m => m.length)) >= 11

/**
 * Une carte dessinée comme une vraie (« les cartes c'est des rectangles pas
 * très jolis, ça serait pas possible de faire de vraies cartes ? Ça
 * rajouterait à l'immersion », le 18 octobre 2026) : son cadre à la couleur
 * de sa rareté, l'orbe de son coût au coin, son illustration sur la teinte
 * de sa famille — le portrait du légendaire qui la donne, sinon son
 * dessin —, son chiffre en médaillon sous l'illustration (`valeur`), son nom
 * dans un bandeau, et la gemme de sa rareté. Aucun mot dans la main, son nom
 * seul dans une rangée — « Y'a trop de détails écrits en dessous de chaque
 * icône, ne pas les mettre direct mais les faire apparaître si on clique
 * dessus » (la revue du même soir) — ; levée, sa phrase entière, et ce que
 * `children` ajoute. Dessinée seulement : le bouton qui la porte dit ce
 * qu'elle est, à l'oreille — sauf levée, où elle est le contenu même de la
 * fenêtre.
 */
export function CarteDessinee({
  c,
  taille,
  energie,
  nombre,
  children,
}: {
  c: CarteDeRencontre
  taille: TailleDeCarte
  /** L'énergie qui lui reste : un coût qu'il ne peut pas payer se dit en rouge. */
  energie?: number
  /** Dans un tas, combien il en a : « ×4 ». */
  nombre?: number
  children?: ReactNode
}) {
  const style = { ...gemmeDeLaCarte(c), '--famille': TEINTE_DE_LA_FAMILLE[c.famille] } as CSSProperties
  // Peinte, son illustration (`server/scripts/anime/cartes.ts`) : la grande levée, la petite ailleurs — celle de sa carte, améliorée
  // ou non. La teinte de sa famille reste dessous, le temps qu'elle arrive. Levée, la grande se demande tout de suite, la petite
  // dessous : déjà là — la main la montrait —, elle tient la place tant que la grande voyage (seize kilo-octets, deux cents
  // millisecondes en 4G).
  const peinture = CARTES_PEINTES[baseDe(c.cle)]
  const levee = taille === 'levee'
  // La question au centre (v10) : plus d'énergie — le coin ne garde que le drapeau d'une carte de route.
  const sansEnergie = useEnQuestion()
  return (
    <span
      className={`exp-vc exp-vc-${taille}` + (c.legendaire ? ' exp-vc-du-legendaire' : '') + (c.amelioree ? ' exp-vc-amelioree' : '')}
      style={style}
      aria-hidden={taille === 'levee' ? undefined : true}
    >
      {(!sansEnergie || c.moment === 'route') && <CoutEnEnergie c={c} manque={energie !== undefined && c.cout > energie} />}
      {taille === 'levee' && c.rarete !== 'commun' && <span className="exp-vc-rarete-dite">{RARETE_DE_LA_CARTE[c.rarete]}</span>}
      <span className="exp-vc-art">
        {peinture ? (
          <img
            className="exp-vc-peinture"
            src={peinture[levee ? 0 : 1]}
            alt=""
            loading={levee ? 'eager' : 'lazy'}
            decoding="async"
            {...(levee && { style: { backgroundImage: `url(${peinture[1]})` } })}
          />
        ) : (
          <VisageDeLaCarte c={c} />
        )}
      </span>
      {taille !== 'levee' && c.valeur && <b className="exp-vc-valeur">{c.valeur}</b>}
      {taille !== 'main' && <b className={'exp-vc-nom' + (taille === 'rangee' && serre(c.nom) ? ' exp-vc-nom-serre' : '')}>{c.nom}</b>}
      {taille === 'levee' && <span className="exp-vc-texte">{espacesFines(c.effet)}</span>}
      {children}
      <span className="exp-vc-gemme" />
      {nombre !== undefined && nombre > 1 && <b className="exp-vc-nombre">{`×${nombre}`}</b>}
      {/* Améliorée (le jeu complet) : un « + » vert au coin, dans la main aussi, où son nom ne se lit pas. */}
      {c.amelioree && <b className="exp-vc-ameliore">+</b>}
    </span>
  )
}

/** Les petites peintures déjà demandées d'avance sur cette page : chacune une fois. */
const PEINTURES_DEMANDEES = new Set<string>()

/**
 * Les petites peintures de ces cartes — son paquet —, demandées d'avance
 * quand la page respire (la phase d'optimisation de l'Expédition, le
 * 19 octobre 2026) : tirée dans une main, une carte jamais vue y arrivait sur
 * sa teinte, sa peinture un aller-retour plus tard, une à une. Six
 * kilo-octets chacune, gardées un an par le navigateur (`/cartes`,
 * `immutable`) : elles ne voyagent qu'une fois.
 */
export function prechargerLesPeintures(cles: readonly string[]) {
  if (typeof Image === 'undefined') return
  const adresses = [...new Set(cles.map(cle => CARTES_PEINTES[baseDe(cle)]?.[1]))].filter((a): a is string => !!a && !PEINTURES_DEMANDEES.has(a))
  if (adresses.length === 0) return
  for (const a of adresses) PEINTURES_DEMANDEES.add(a)
  const demander = () => {
    for (const a of adresses) {
      const img = new Image()
      // Après ce que la page montre : une peinture d'avance ne passe jamais devant une de l'écran.
      img.setAttribute('fetchpriority', 'low')
      img.decoding = 'async'
      img.src = a
    }
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(demander, { timeout: 2000 })
  else setTimeout(demander, 300)
}

/** L'ordre du catalogue : neutres, familles, légendaires — pas celui des noms, que `localeCompare` trierait en chargeant `Intl` (règle `client.md`). */
const RANG_AU_CATALOGUE = new Map(CARTES_DES_RENCONTRES.map((c, i) => [c.cle, i]))

/** Son rang au catalogue : celui de sa carte — l'exemplaire amélioré juste après elle. */
const rangAuCatalogue = (cle: string) => (RANG_AU_CATALOGUE.get(baseDe(cle)) ?? 999) + (cle === baseDe(cle) ? 0 : 0.5)

/** Des cartes comptées — « Concentration ×4 » —, dans l'ordre du catalogue. */
export function comptesDesCartes(cles: readonly string[]): { cle: string; nom: string; n: number }[] {
  const n = new Map<string, number>()
  for (const cle of cles) n.set(cle, (n.get(cle) ?? 0) + 1)
  return [...n].map(([cle, x]) => ({ cle, nom: carteDeRencontre(cle)?.nom ?? cle, n: x })).sort((a, b) => rangAuCatalogue(a.cle) - rangAuCatalogue(b.cle))
}

/** Ce qui reste d'un tas quand on en ôte d'autres, chaque carte autant de fois qu'elle y est. */
function sans(tas: readonly string[], otees: readonly string[]): string[] {
  const reste = [...tas]
  for (const cle of otees) {
    const i = reste.indexOf(cle)
    if (i >= 0) reste.splice(i, 1)
  }
  return reste
}

/**
 * Son courage, dans la barre : ce qui remplace les trois vies — un cœur,
 * combien, et sa jauge sur cinquante. Bas, il le dit en couleur.
 */
export function Courage({ n }: { n: number }) {
  const part = Math.round((Math.max(0, Math.min(COURAGE_MAX, n)) / COURAGE_MAX) * 100)
  return (
    <span className={'exp-courage' + (n <= COURAGE_MAX / 5 ? ' exp-courage-bas' : '')} role="img" aria-label={`${n} de courage sur ${COURAGE_MAX}`}>
      <Icon name="heart" />
      <b>{n}</b>
      <span className="exp-courage-jauge" aria-hidden="true">
        <i style={{ width: `${part}%` }} />
      </span>
    </span>
  )
}

/**
 * Son énergie du tour — l'inspiration du code —, au-dessus de sa main : un
 * orbe et son chiffre, le même qu'au coin de chaque carte, et le mot dit.
 * En étincelles allumées et éteintes, on ne comprenait ni ce qu'elles
 * comptaient ni ce que les cartes en prenaient (« l'histoire de
 * l'inspiration n'est pas du tout claire », le 18 octobre 2026).
 */
export function Energie({ n }: { n: number }) {
  return (
    <span className={'exp-energie' + (n === 0 ? ' exp-energie-vide' : '')} role="img" aria-label={`${n} d’énergie pour jouer tes cartes`}>
      <b className="exp-vc-cout" aria-hidden="true">
        {n}
      </b>
      <span aria-hidden="true">d’énergie</span>
    </span>
  )
}

// ── Ce qu'une réponse fera ──────────────────────────────────────────────────

/**
 * L'aperçu du tour à cette mise — et, `avec` une carte, ce qu'il serait si on
 * la jouait : ses chiffres (`chiffresApresLaCarte`) et la forme où elle
 * repose la question (`formeApresLaCarte`), passés à la règle du verdict
 * (`apercuDuTour`). La page n'en recopie rien.
 */
export function apercuALaMise(r: VueDeLaRencontre, mise: number, fetiche: string | undefined, avec?: string): ApercuDuTour | undefined {
  const a = r.annonce
  if (!a) return undefined
  const c = avec === undefined ? undefined : carteALaVersion(avec, r.v)
  // Dans l'ordre du pli : un pouvoir est posé avant que ses chiffres se comptent.
  const pouvoirs = c?.moment === 'pouvoir' ? [...r.pouvoirs, c.cle] : r.pouvoirs
  // Ce que ses chiffres lisent de la question (le jeu complet) : sa marche, ce qu'elle vaut — l'annonce les dit —, les écus qu'il a ;
  // le doute de l'adversaire et son courage (les huit familles).
  const doute = r.doute ?? 0
  const chiffres = c
    ? chiffresApresLaCarte(c.cle, { inspiration: r.inspiration, charge: r.charge, garde: r.garde, serie: r.serie, doute }, pouvoirs, {
        v: r.v,
        fetiche: !!fetiche && a.categorie === fetiche,
        effacees: r.effacees,
        niveau: a.niveau,
        savoir: a.savoir,
        ecus: r.ecus,
        courage: r.courage,
        ratee: !!r.ratee,
      })
    : { ...r, doute }
  const q = c ? formeApresLaCarte(c.cle, { forme: a.forme, reponses: a.reponses }, r.v) : { forme: a.forme, reponses: a.reponses }
  // Les cartes qui visent la question, comme le pli les range : une autre question repart sans elles — et sans son second essai (v14).
  const change = !!c && changeDeQuestion(c.cle, r.v)
  const surLaQuestion = !c ? r.surLaQuestion : change ? (c.cle === 'mue' ? ['mue'] : []) : viseLaQuestion(c) ? [...r.surLaQuestion, c.cle] : r.surLaQuestion
  return apercuDuTour({
    v: r.v,
    tour: {
      charge: chiffres.charge,
      garde: chiffres.garde,
      mise,
      jouees: c ? [...r.jouees, c.cle] : r.jouees,
      surLaQuestion,
      ...(r.essai !== undefined && !change && { essai: r.essai }),
    },
    pouvoirs,
    sceaux: r.sceaux,
    frappe: r.frappe,
    savoir: a.savoir,
    question: { reponses: q.reponses, forme: q.forme, categorie: a.categorie },
    ...(fetiche && { fetiche }),
    ...(a.mots !== undefined && { mots: a.mots }),
    trouvees: r.trouvees,
    serie: chiffres.serie,
    doute: chiffres.doute ?? doute,
    // L'aube posée, tant qu'aucune erreur ne l'a éteinte (v10) : comme la vue du serveur.
    aube: !r.aubeEteinte,
    // Les familles (v14) : l'erreur d'avant, les seconds essais de Cuirasse, ce qui sera effacé, la carte comprise — de quoi dire
    // « tu réponds encore » : à deux réponses près, le second essai répondrait à sa place.
    ratee: !!r.ratee,
    ...(r.essais !== undefined && { essais: r.essais }),
    effacees: effaceesDuTour(surLaQuestion, pouvoirs, { reponses: q.reponses, datee: r.questionDuTour?.datee, nombre: r.questionDuTour?.nombre, forme: q.forme }),
  })
}

/** Ce qu'une carte levée changerait à l'aperçu : avant elle, et avec elle — et son courage, si elle en coûte (les huit familles). */
export interface ChangementDeLaCarte {
  avant: ApercuDuTour
  apres: ApercuDuTour
  courage?: { avant: number; apres: number }
  /** La question au centre (v10) : ce qu'il perd se compte en crans. */
  crans?: true
}

/** Le changement d'une carte qui se joue maintenant ; null : l'aperçu ne bouge pas, ou elle ne se joue pas. */
export function changementDeLaCarte(r: VueDeLaRencontre, mise: number, fetiche: string | undefined, cle: string): ChangementDeLaCarte | null {
  if (r.refus[cle] !== null && r.refus[cle] !== undefined) return null
  const avant = apercuALaMise(r, mise, fetiche)
  const apres = apercuALaMise(r, mise, fetiche, cle)
  const prix = courageDeLaCarte(cle)
  return avant && apres ? { avant, apres, ...(prix > 0 && { courage: { avant: r.courage, apres: r.courage - prix } }), ...(r.crans && { crans: true as const }) } : null
}

/** Ce qu'il perd si tu as juste : ce que son doute lui coûte d'abord (les huit familles), puis ce que ta réponse brise. */
const perteSiJuste = (a: ApercuDuTour) => (a.doute ?? 0) + a.juste.brises

/** Ce qu'une bonne réponse ferait, dit en clair — en crans dans la question au centre : « il perd 1 », seul, ne disait pas quoi. */
const ditJuste = (a: ApercuDuTour, crans?: boolean) => {
  const n = perteSiJuste(a)
  return a.juste.tombe ? 'il tombe' : crans ? `il perd ${n} cran${n > 1 ? 's' : ''}` : `il perd ${n}`
}

/** Un nombre collé au mot qui le précède : « pare 5 » ne se coupe pas, un « 5 » seul en début de ligne ne se lit pas. */
const colle = (mot: string, n: number | string) => `${mot} ${n}`

/**
 * Ce que la réponse fera, en deux tuiles, avant de répondre : « Si tu as
 * juste » — l'adversaire perd tant, ou il tombe ; ce que le pari rapporte —,
 * « Si tu te trompes » — le courage qu'il te prend, toujours dit, même nul :
 * « Tu ne perds rien » à côté de « −10 écus de ton pari » se contredisait ;
 * puis son attaque et ce que ton bouclier en pare. La même règle que le
 * verdict (`apercuDuTour`). `base`, l'aperçu sans les cartes de la question :
 * ce que tes cartes y ajoutent se dit à part. `compact`, la question sous les
 * yeux : les deux chiffres seuls.
 */
export function Apercu({ a, base, compact }: { a: ApercuDuTour; base?: ApercuDuTour; compact?: boolean }) {
  const j = a.juste
  const f = a.faux
  // Son doute (les huit familles) : il le perd juste ou faux, avant le verdict — chaque tuile le dit.
  const doute = a.doute ?? 0
  const deCartes = base && !j.tombe ? perteSiJuste(a) - perteSiJuste(base) : 0
  const detailJuste = [
    j.tombe && colle('il perd', perteSiJuste(a)),
    doute > 0 && `${colle('dont', doute)} de son doute`,
    j.auPremierMot !== undefined && `${colle('jusqu’à', doute + j.auPremierMot)} si tu réponds tôt`,
    deCartes > 0 && `${colle('dont', `+${deCartes}`)} grâce à tes cartes`,
    j.ecus > 0 && `+${j.ecus} écus de ton pari`,
    (j.ecusDesCartes ?? 0) > 0 && `+${j.ecusDesCartes} écus de tes cartes`,
    (j.courage ?? 0) > 0 && `+${j.courage} de courage`,
  ].filter((x): x is string => !!x)
  const detailFaux = [
    // Les familles (v14) : un second essai d'abord — ce qui suit ne vaut que s'il se trompe encore.
    f.essai && (f.frappe === 0 ? 'raté encore, il ne t’attaque pas' : colle('raté encore, tu perds', f.perdu)),
    f.tombe
      ? 'son doute le fait tomber : il ne t’attaque pas'
      : f.frappe === 0
        ? !f.essai && 'il ne t’attaque pas'
        : f.absorbee > 0 && (f.perdu === 0 ? `${colle('son attaque fait', f.frappe)} : ton bouclier pare tout` : `${colle('son attaque fait', f.frappe)}, ton bouclier en ${colle('pare', f.absorbee)}`),
    !f.tombe && doute > 0 && `son doute : ${colle('il perd', doute)}`,
    f.contre > 0 && `riposte : ${colle('il perd', f.contre)}`,
    f.ecus > 0 && `−${f.ecus} écus de ton pari`,
    (f.ecusDesCartes ?? 0) > 0 && `−${f.ecusDesCartes} écus de ta mise`,
  ].filter((x): x is string => !!x)
  return (
    <div className={'exp-apercu' + (compact ? ' exp-apercu-compact' : '')} role="group" aria-label="Ce que ta réponse fera">
      <div className="exp-apercu-tuile exp-apercu-juste">
        <span className="exp-apercu-si">
          <Icon name="check" />
          Si tu as juste
        </span>
        {/* Une autre valeur, un autre élément : il se pose d'un petit bond, et l'œil voit ce que la carte a changé. */}
        <b key={ditJuste(a)} className="exp-apercu-chiffre">
          {j.tombe ? 'Il tombe !' : `Il perd ${perteSiJuste(a)}`}
        </b>
        {!compact && detailJuste.map(t => <span key={t}>{espacesFines(t)}</span>)}
      </div>
      <div className="exp-apercu-tuile exp-apercu-faux">
        <span className="exp-apercu-si">
          <Icon name="x" />
          Si tu te trompes
        </span>
        {f.essai ? (
          <b key="essai" className="exp-apercu-chiffre">
            Tu réponds encore
          </b>
        ) : (
          <b key={f.perdu} className="exp-apercu-chiffre">
            {`Tu perds ${f.perdu}`}
            <Icon name="heart" />
            <span className="sr-only"> de courage</span>
          </b>
        )}
        {!compact && detailFaux.map(t => <span key={t}>{espacesFines(t)}</span>)}
      </div>
    </div>
  )
}

/** Ce qu'une carte levée changerait, en lignes « avant → après » ; rien, si elle ne change aucun chiffre. */
function Changement({ c }: { c: ChangementDeLaCarte }) {
  const { avant, apres } = c
  const lignes: { cle: string; icone: IconName; quoi: string; de: string; a: string }[] = []
  // Les huit familles : le courage qu'elle coûte, sur-le-champ ; le doute qu'elle sème, qu'il perd juste ou faux.
  if (c.courage) lignes.push({ cle: 'prix', icone: 'heart', quoi: 'Ton courage, tout de suite', de: `${c.courage.avant}`, a: `${c.courage.apres}` })
  const douteDe = (x: ApercuDuTour) => x.doute ?? 0
  if (douteDe(avant) !== douteDe(apres)) lignes.push({ cle: 'doute', icone: 'bulles', quoi: 'Son doute, juste ou faux', de: `${douteDe(avant)}`, a: `il perd ${douteDe(apres)}` })
  if (ditJuste(avant, c.crans) !== ditJuste(apres, c.crans)) lignes.push({ cle: 'juste', icone: 'check', quoi: 'Si tu as juste', de: ditJuste(avant, c.crans), a: ditJuste(apres, c.crans) })
  if (avant.juste.ecus !== apres.juste.ecus) lignes.push({ cle: 'gain', icone: 'ecu', quoi: 'Ton pari gagné', de: `+${avant.juste.ecus}`, a: `+${apres.juste.ecus} écus` })
  // Le jeu complet : les écus et le courage que ses cartes rapportent sur une bonne réponse.
  const ecusDe = (x: ApercuDuTour) => x.juste.ecusDesCartes ?? 0
  const courageDe = (x: ApercuDuTour) => x.juste.courage ?? 0
  if (ecusDe(avant) !== ecusDe(apres)) lignes.push({ cle: 'ecus', icone: 'ecu', quoi: 'Si tu as juste, tes cartes', de: `+${ecusDe(avant)}`, a: `+${ecusDe(apres)} écus` })
  if (courageDe(avant) !== courageDe(apres)) lignes.push({ cle: 'soin', icone: 'heart', quoi: 'Si tu as juste, tu reprends', de: `${courageDe(avant)}`, a: `${courageDe(apres)} de courage` })
  // Les familles (v14) : le second essai passe avant l'attaque — « tu réponds encore ».
  const ditFaux = (x: ApercuDuTour) => (x.faux.essai ? 'tu réponds encore' : `tu perds ${x.faux.perdu}`)
  if (ditFaux(avant) !== ditFaux(apres)) lignes.push({ cle: 'faux', icone: apres.faux.essai ? 'rotate' : 'heart', quoi: 'Si tu te trompes', de: ditFaux(avant), a: ditFaux(apres) })
  if (avant.faux.contre !== apres.faux.contre) lignes.push({ cle: 'contre', icone: 'sabre', quoi: 'Si tu te trompes, riposte', de: `${avant.faux.contre}`, a: `il perd ${apres.faux.contre}` })
  if (avant.faux.ecus !== apres.faux.ecus) lignes.push({ cle: 'perte', icone: 'ecu', quoi: 'Ton pari perdu', de: `−${avant.faux.ecus}`, a: `−${apres.faux.ecus} écus` })
  const miseDe = (x: ApercuDuTour) => x.faux.ecusDesCartes ?? 0
  if (miseDe(avant) !== miseDe(apres)) lignes.push({ cle: 'mise', icone: 'ecu', quoi: 'Si tu te trompes, ta mise', de: `−${miseDe(avant)}`, a: `−${miseDe(apres)} écus` })
  if (lignes.length === 0) return null
  return (
    <section className="exp-changement" aria-labelledby="exp-changement-titre">
      <h3 className="label" id="exp-changement-titre">
        Avec cette carte
      </h3>
      <ul>
        {lignes.map(l => (
          <li key={l.cle}>
            <Icon name={l.icone} />
            <span>
              {espacesFines(`${l.quoi} : ${l.de}`)}
              <Icon name="chevron-right" />
              <b>{espacesFines(l.a)}</b>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── La main ─────────────────────────────────────────────────────────────────

export type JouerUneCarte = (cle: string, plus?: { categorie?: string; montre?: number }) => void

/** Ce qu'une carte coûte, dit à l'oreille et dans les lignes d'une offre — rien dans la question au centre (v10), où l'énergie n'est plus. */
const coutDit = (c: CarteDeRencontre, v: number) => (enQuestion(v) ? null : c.cout === 0 ? 'gratuite' : `${c.cout} d’énergie`)

/**
 * Une carte de la main, dessinée (`CarteDessinee`) : l'orbe de son coût, son
 * illustration, et ce qu'elle fait en deux ou trois mots — on la comprend
 * sans la lever. Une carte qui ne se joue pas maintenant s'éteint, son coût
 * rouge s'il manque d'énergie ; touchée, elle se lève quand même, et dit
 * pourquoi.
 */
function FaceDeLaCarte({ c, refus, energie, onToucher }: { c: CarteDeRencontre; refus: string | null; energie?: number; onToucher: () => void }) {
  const cout = coutDit(c, useContext(VersionDesCartes))
  return (
    <button type="button" className={'exp-face' + (refus ? ' exp-face-eteinte' : '')} data-carte={c.cle} aria-haspopup="dialog" onClick={onToucher}>
      <CarteDessinee c={c} taille="main" energie={energie} />
      <span className="sr-only">{`${c.nom} : ${c.resume}${cout ? `, ${cout}` : ''}${refus ? ', pas maintenant' : ''}`}</span>
    </button>
  )
}

/** Sur le plan, ses cartes de route en petit — dans la question au centre (v10), sa main de l'acte aussi : le dessin seul, au cadre de sa rareté. */
function CarteEnPetit({ c, refus, onToucher }: { c: CarteDeRencontre; refus: string | null; onToucher: () => void }) {
  const v = useContext(VersionDesCartes)
  return (
    <button type="button" className={'exp-carte-joker exp-carte-rencontre' + (refus ? ' exp-refuse' : '')} style={gemmeDeLaCarte(c)} data-carte={c.cle} aria-haspopup="dialog" onClick={onToucher}>
      <span className="exp-joker-dessin" aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="sr-only">{`${c.nom}, ${momentCourt(c.moment, v)}${refus ? ', pas maintenant' : ''}`}</span>
    </button>
  )
}

/**
 * La main d'une rencontre : son énergie, puis ses cartes, dessinées —
 * avant la question, celles qui se jouent maintenant d'abord, puis,
 * à part et éteintes, celles qui se jouent pendant la question ; la question
 * vue, celles-là seules. Touchée, une carte se lève (`CarteLevee`) : ce
 * qu'elle fait, ce qu'elle changerait, puis « Jouer » — ou pourquoi elle ne
 * se joue pas maintenant, de la règle du serveur (`refus`). Sur le plan de
 * l'acte (`enPetit`), ses cartes de route en petit, et le dos du paquet.
 */
export function MainDeRencontre({
  cles,
  refus,
  busy,
  enPetit,
  pile,
  dos,
  inspiration,
  phase = 'preparation',
  apercuDeLaCarte,
  onJouer,
  onMontrer,
}: {
  cles: readonly string[]
  refus: Readonly<Record<string, string | null>>
  busy: boolean
  enPetit?: boolean
  /** La pioche — le paquet, sur le plan — : combien, ce qu'elle dit à l'oreille, et ce qu'elle ouvre. */
  pile: { compte: number; mot: string; dit: string; onOuvrir: () => void }
  /** Le dos de son paquet, sur le plan : celui qu'il a choisi au départ (`dosDuPaquet`). */
  dos?: DosDuPaquet
  /** En rencontre : son inspiration du tour, son énergie à l'écran. */
  inspiration?: number
  /** Avant la question, ou pendant. */
  phase?: 'preparation' | 'question'
  /** Ce qu'une carte levée changerait, avant qu'on la joue. */
  apercuDeLaCarte?: (cle: string) => ChangementDeLaCarte | null
  onJouer: JouerUneCarte
  /** La Prédiction : il montre une réponse à l'Oracle, sur la question à l'écran. */
  onMontrer?: () => void
}) {
  const [levee, setLevee] = useState<number | null>(null)
  const carte = useCarte()
  const v10 = useEnQuestion()
  const cle = levee !== null ? cles[levee] : undefined
  const indexees = cles.flatMap((k, i) => {
    const c = carte(k)
    return c ? [{ k, i, c }] : []
  })
  // Avant la question, deux temps : ce qui se joue maintenant, puis ce qui attendra la question ; pendant, ce temps-là seul. La
  // question au centre (v10) : à l'annonce, ses cartes du pari, puis le reste de sa main, éteint — devant un dévoilement, dont
  // les mots courent dès qu'il le voit, il sait d'avance ce qu'il aura ; la question vue, sa main entière.
  const pendant = indexees.filter(x => (v10 ? !estDuPari(x.k) : x.c.moment === 'reflexe'))
  const maintenant = phase === 'question' ? (v10 ? indexees : pendant) : indexees.filter(x => (v10 ? estDuPari(x.k) : x.c.moment !== 'reflexe'))
  const plusTard = phase === 'question' ? [] : pendant
  const face =(x: { k: string; i: number; c: CarteDeRencontre }) => (
    <FaceDeLaCarte key={`${x.k}:${x.i}`} c={x.c} refus={refus[x.k] ?? null} energie={inspiration} onToucher={() => setLevee(x.i)} />
  )
  const leveeDessus = cle && (
    <CarteLevee
      // Une autre carte levée repart de zéro : la catégorie du Commandement choisie n'est pas la sienne.
      key={`${cle}:${levee}`}
      cle={cle}
      refus={refus[cle] ?? null}
      busy={busy}
      changement={apercuDeLaCarte?.(cle) ?? null}
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
  )
  if (enPetit) {
    return (
      <>
        <section className="exp-main exp-main-rencontre exp-main-en-petit" aria-label="Tes cartes de route">
          {indexees.map(x => (
            <CarteEnPetit key={`${x.k}:${x.i}`} c={x.c} refus={refus[x.k] ?? null} onToucher={() => setLevee(x.i)} />
          ))}
          <button type="button" className={'exp-pioche' + classeDuDos(dos)} aria-haspopup="dialog" onClick={pile.onOuvrir}>
            <b aria-hidden="true">{pile.compte}</b>
            <span className="sr-only">{pile.dit}</span>
          </button>
        </section>
        {leveeDessus}
      </>
    )
  }
  // La question vue, sans carte à jouer pendant : rien à montrer, la question d'abord — ce qui est posé pour toute la rencontre est dans la barre.
  // La question au centre (v10) garde sa main d'une question à l'autre : vide, elle le dit.
  if (!v10 && phase === 'question' && maintenant.length === 0) return null
  return (
    <>
      <section className="exp-cartes" aria-labelledby="exp-cartes-titre">
        <div className="exp-cartes-tete">
          <h2 className="label" id="exp-cartes-titre">
            Tes cartes
          </h2>
          {inspiration !== undefined && <Energie n={inspiration} />}
          <button type="button" className="link-inline small exp-cartes-tas" aria-haspopup="dialog" onClick={pile.onOuvrir}>
            <span aria-hidden="true">{`Pioche ${pile.compte}`}</span>
            <Icon name="chevron-right" />
            <span className="sr-only">{pile.dit}</span>
          </button>
        </div>
        {cles.length === 0 ? (
          <p className="exp-main-vide">
            {espacesFines(v10 ? 'Ta main est vide : une carte y vient après chaque question, tant que ta pioche en a.' : 'Ta main est vide : la question suivante en tire de nouvelles.')}
          </p>
        ) : (
          (maintenant.length > 0 || plusTard.length > 0) && (
            <div className="exp-cartes-rangs">
              {maintenant.length > 0 && (
                <div className="exp-cartes-groupe" style={{ flexGrow: maintenant.length }}>
                  {plusTard.length > 0 && <span className="exp-cartes-quand">Maintenant</span>}
                  <div className="exp-cartes-main">{maintenant.map(face)}</div>
                </div>
              )}
              {plusTard.length > 0 && (
                <div className="exp-cartes-groupe exp-cartes-plus-tard" style={{ flexGrow: plusTard.length }}>
                  <span className="exp-cartes-quand">Pendant la question</span>
                  <div className="exp-cartes-main">{plusTard.map(face)}</div>
                </div>
              )}
            </div>
          )
        )}
      </section>
      {leveeDessus}
    </>
  )
}

/**
 * Une carte levée : en grand, dessinée (`CarteDessinee`) — ce qu'elle coûte,
 * son illustration, son nom, ce qu'elle fait en une phrase, quand elle se
 * joue —, puis ce qu'elle changerait à la réponse (« Avec cette carte : si tu
 * as juste, il perd 6 › il perd 10 »), et le geste : la jouer, la poser,
 * choisir la catégorie du Commandement, montrer une réponse à l'Oracle ; ou
 * pourquoi elle ne se joue pas maintenant. Sans `onJouer`, on ne fait que la
 * regarder — touchée dans un tas, à l'offre. Toucher à côté la repose, Échap
 * aussi : un toucher perdu ne coûte rien.
 */
export function CarteLevee({
  cle,
  refus = null,
  busy = false,
  changement,
  ouverture,
  avecAmelioration,
  onJouer,
  onMontrer,
  onReposer,
}: {
  cle: string
  refus?: string | null
  busy?: boolean
  changement?: ChangementDeLaCarte | null
  /** Une carte que son codex n'a pas encore : comment elle s'ouvre, sous la carte. */
  ouverture?: string
  /** Au codex (le jeu complet) : ce que l'amélioration lui donnerait, sous la carte. */
  avecAmelioration?: boolean
  onJouer?: JouerUneCarte
  onMontrer?: () => void
  onReposer: () => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onReposer)
  const [categorie, setCategorie] = useState<string | null>(null)
  const v = useContext(VersionDesCartes)
  const c = useCarte()(cle)
  if (!c) return null
  const verbe = cle === 'prediction' ? 'Montrer une réponse à l’Oracle' : `${c.moment === 'pouvoir' ? 'Poser' : 'Jouer'} « ${c.nom} »`
  // Le Commandement choisit d'abord sa catégorie : douze pastilles sous la carte, qui se fait plus petite.
  const choix = !!onJouer && !refus && cle === 'commandement'
  const plus = plusDeLaCarte(c, v)
  // La question au centre (v10) : une carte du pari porte l'écu du pari ; toutes les autres, l'œil ouvert de la question vue.
  const icone = enQuestion(v) && c.moment === 'preparation' ? 'ecu' : ICONE_DU_MOMENT[c.moment]
  return (
    <div className="carte-voile exp-leve-voile" onClick={onReposer}>
      <div className={'exp-leve' + (choix ? ' exp-leve-avec-choix' : '')} role="dialog" aria-modal="true" aria-label={c.nom} ref={boite} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <CarteDessinee c={c} taille="levee">
          <span className="exp-vc-quand">
            <Icon name={icone} />
            {momentDit(c.moment, v)}
          </span>
          {c.moment !== 'route' && !enQuestion(v) && <span className="sr-only">{c.cout === 0 ? 'Elle est gratuite.' : `Elle coûte ${c.cout} d’énergie.`}</span>}
          {plus.length > 0 && <span className="exp-vc-plus">{espacesFines(plus.join(' · '))}</span>}
        </CarteDessinee>
        {changement && <Changement c={changement} />}
        {ouverture && (
          <p className="exp-ouverture">
            <Icon name="lock" />
            {espacesFines(ouverture)}
          </p>
        )}
        {avecAmelioration && c.amelioration && !c.amelioree && (
          <p className="exp-ameliorable">
            <Icon name="arrow-up" />
            {espacesFines(`Améliorée : ${c.amelioration.gain.toLowerCase()}`)}
          </p>
        )}
        {!onJouer ? null : refus ? (
          <p className="exp-refus">{espacesFines(refus)}</p>
        ) : choix ? (
          <div className="exp-leve-choix">
            <p>{espacesFines('L’escale suivante, si c’est une rencontre, posera toutes ses questions en :')}</p>
            <div className="exp-categories" role="group" aria-label="La catégorie de l’escale suivante">
              {CATEGORIES.map(x => (
                <button key={x} type="button" className={'pill-btn' + (categorie === x ? ' active' : '')} aria-pressed={categorie === x} onClick={() => setCategorie(x)}>
                  {COURT[x] ?? x}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || !categorie || undefined} onClick={() => categorie && !busy && onJouer?.(cle, { categorie })}>
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
              else onJouer?.(cle)
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
 * L'énergie de chaque question, acte par acte : celle que la vue dit
 * (`CartesEnJeu.energie`) ; sans vue — au départ —, celle d'une expédition
 * qui partirait, à son cran.
 */
export const energieDesActes = (energie: readonly number[] | undefined, ascension: number): readonly number[] => energie ?? energieDesActesALAscension(VERSION_DU_JEU_COMPLET, ascension)

/** « 3 d'énergie », ou acte par acte : « 2 d'énergie à l'acte 1, 3 ensuite ». */
export function energieDite(energie: readonly number[]): string {
  const [a1, a2, a3] = energie
  if (a1 === a2 && a2 === a3) return `${a1} d’énergie`
  return a2 === a3 ? `${a1} d’énergie à l’acte 1, ${a2} ensuite` : `${a1} d’énergie à l’acte 1, ${a2} à l’acte 2, ${a3} à l’acte 3`
}

/**
 * Le cycle des cartes, en une fois : « on comprend pas bien ce qu'on a en main et comment les cartes reviennent » (le 18 octobre 2026).
 * L'énergie, celle de chaque acte à son cran de l'Ascension.
 */
const regleDuCycle = (energie: readonly number[]) =>
  `À chaque question, tu tires de nouvelles cartes de ta pioche, et tu as ${energieDite(energie)} pour les jouer. Celles que tu ne joues pas vont à la défausse ; quand ta pioche est vide, ta défausse y est remélangée. Une carte « une fois par rencontre » revient à la rencontre suivante, et chaque rencontre remélange tout ton paquet. Les cartes de route se jouent sur le plan, une fois par acte.`

/** Le cycle de la question au centre (v10) : la main de l'acte, gardée — « quand l'utiliser ? » a sa réponse. */
const regleDuCycleEnQuestion = (mainMax: number) =>
  `Ta main tire ${MAIN_A_L_OUVERTURE_DE_L_ACTE} cartes à l’ouverture de chaque acte, puis une après chaque question, ${mainMax} au plus : ce que tu ne joues pas, tu le gardes. Une carte par question ; jouée, elle part à ta défausse, qui revient à l’acte suivant — chaque carte sert une fois par acte, et le gardien attend au bout. Les cartes de route se jouent sur le plan, une fois par acte.`

/**
 * Ce que l'amélioration fera d'une carte, avant qu'on la choisisse — au
 * campement, à l'échoppe (le jeu complet) : la carte, puis la même améliorée,
 * côte à côte — son chiffre, son coût, son « + » —, chacune sa phrase entière
 * dessous, et ce qu'elle y gagne en mots. Comme la forge de Slay the Spire, on
 * voit avant d'y passer — et l'on lit ce qu'on améliore : « +4 › +6 » et
 * « +6 au lieu de +4 » seuls ne disaient ni ce que fait la carte, ni ce que
 * fera son amélioration (un retour du 19 octobre 2026).
 * Elle paraît sous la rangée, hors de l'écran en 360 × 640 et sous le bouton
 * collé du pied : la carte touchée, la page défile jusqu'à elle.
 */
export function AvantApres({ cle }: { cle: string }) {
  const carte = useCarte()
  const avant = carte(cle)
  const apres = carte(ameliorer(cle))
  const ici = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ici.current?.scrollIntoView({ block: 'nearest', behavior: calme ? 'auto' : 'smooth' })
  }, [cle])
  if (!avant?.amelioration || !apres) return null
  return (
    <div ref={ici} className="exp-avant-apres" role="group" aria-label={`${avant.nom}, améliorée : ${avant.amelioration.gain}`}>
      <div className="exp-avant-apres-cartes">
        <CeQuElleFait c={avant} />
        <Icon name="chevron-right" />
        <CeQuElleFait c={apres} />
      </div>
      <p className="exp-avant-apres-gain">{espacesFines(avant.amelioration.gain)}</p>
    </div>
  )
}

/**
 * Une carte de l'avant et de l'après, et dessous ce qu'elle fait : sa phrase,
 * puis son coût, quand elle se joue, et si elle ne sert qu'une fois — une
 * amélioration « Gratuite » ou qui la fait revenir garde la même phrase, et
 * c'est dessous qu'elle change. À la version de l'expédition : la question au
 * centre (v10) ne dit ni coût ni « une fois », et ses moments sont les siens.
 */
function CeQuElleFait({ c }: { c: CarteDeRencontre }) {
  const v = useContext(VersionDesCartes)
  const fois = c.unique ? 'une fois par expédition' : c.epuisement ? 'une fois par rencontre' : null
  return (
    <div className="exp-avant-apres-carte">
      <CarteDessinee c={c} taille="rangee" />
      <p className="exp-avant-apres-dit">
        <span className="sr-only">{`${c.nom} : `}</span>
        <span>{espacesFines(c.effet)}</span>
        <span className="muted small">{espacesFines([coutDit(c, v), momentCourt(c.moment, v), fois].filter(Boolean).join(' · '))}</span>
      </p>
    </div>
  )
}

/**
 * Un tas en vraies cartes, qui défilent de côté (« Voir la pioche on voit
 * uniquement des noms, ça serait pas possible de voir les vraies cartes, de
 * pouvoir les faire défiler ? », le 18 octobre 2026) : une carte par sorte,
 * « ×4 » quand il en a plusieurs, dans l'ordre du catalogue. Touchée, elle se
 * montre en grand (`onRegarder`) — ou, là où l'on en choisit une (`choisie` :
 * la carte à retirer au campement), elle se choisit.
 */
export function RangeeDeCartes({
  cles,
  vide,
  nom,
  choisie,
  onRegarder,
}: {
  cles: readonly string[]
  vide: string
  nom: string
  /** Là où l'on en choisit une : celle qui l'est, null avant. */
  choisie?: string | null
  onRegarder: (cle: string) => void
}) {
  const carte = useCarte()
  const comptes = comptesDesCartes(cles)
  if (comptes.length === 0) return <p className="muted small">{espacesFines(vide)}</p>
  const aChoisir = choisie !== undefined
  return (
    <ul className="exp-rangee" aria-label={nom}>
      {comptes.map(x => {
        const c = carte(x.cle)
        if (!c) return null
        return (
          <li key={x.cle}>
            <button
              type="button"
              className={'exp-rangee-carte' + (aChoisir && choisie === x.cle ? ' exp-choisi' : '')}
              data-carte={x.cle}
              {...(aChoisir ? { 'aria-pressed': choisie === x.cle } : { 'aria-haspopup': 'dialog' as const })}
              onClick={() => onRegarder(x.cle)}
            >
              <CarteDessinee c={c} taille="rangee" nombre={x.n} />
              <span className="sr-only">{`${c.nom}${x.n > 1 ? `, ${x.n} fois` : ''} : ${c.resume}`}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Ce qu'offre un adversaire tombé, une élite, un coffre : trois vraies cartes
 * côte à côte, comme la récompense de Slay the Spire — en lignes de texte, on
 * n'y voyait pas des cartes. La touchée s'éclaire, et sa phrase entière se
 * lit dessous, avec sa rareté, son coût et son moment ; rien ne s'y lit
 * avant (« les faire apparaître si on clique dessus », la revue du
 * 18 octobre 2026).
 */
export function CartesAPrendre({ cles, prises, onToucher }: { cles: readonly string[]; prises: readonly string[]; onToucher: (cle: string) => void }) {
  const carte = useCarte()
  const v = useContext(VersionDesCartes)
  const cartes = cles.map(carte).filter((c): c is CarteDeRencontre => !!c)
  const choisie = cartes.find(c => prises.includes(c.cle))
  /** Son coût — sauf dans la question au centre — et son moment, en une ligne. */
  const quand = (c: CarteDeRencontre, court: boolean) => [coutDit(c, v), court ? momentCourt(c.moment, v) : momentDit(c.moment, v)].filter(Boolean).join(court ? ', ' : ' · ')
  return (
    <>
      <div className="exp-a-prendre" role="group" aria-label="Les cartes à prendre">
        {cartes.map(c => (
          <button
            key={c.cle}
            type="button"
            className={'exp-a-prendre-carte' + (prises.includes(c.cle) ? ' exp-choisi' : '')}
            aria-pressed={prises.includes(c.cle)}
            data-carte={c.cle}
            onClick={() => onToucher(c.cle)}
          >
            <CarteDessinee c={c} taille="rangee" />
            <span className="sr-only">{`${c.nom}, ${RARETE_DE_LA_CARTE[c.rarete]} : ${c.effet} ${quand(c, true)}.`}</span>
          </button>
        ))}
      </div>
      {choisie && (
        <p className="exp-a-prendre-dit" aria-hidden="true">
          <b>{choisie.nom}</b>
          <span className={`exp-rarete exp-rarete-${choisie.rarete}`} style={gemmeDeLaCarte(choisie)}>
            {RARETE_DE_LA_CARTE[choisie.rarete]}
          </span>
          <span>{espacesFines(choisie.effet)}</span>
          <span className="muted small">{espacesFines(quand(choisie, false))}</span>
        </p>
      )}
    </>
  )
}

/**
 * Ses tas, quand il touche la pioche, chacun en rangée de vraies cartes : en
 * rencontre, les cartes posées pour toute la rencontre, ce qui reste à
 * tirer — tout son paquet de combat, moins ce qui a servi : sa composition se
 * déduit, son ordre reste au serveur —, sa défausse, ses cartes hors jeu
 * jusqu'à la rencontre suivante ; puis tout son paquet, et la règle du cycle.
 * Une carte touchée se montre en grand, par-dessus la feuille.
 */
export function FeuilleDesCartes({
  paquet,
  rencontre,
  acte,
  ascension = 0,
  energie,
  onFermer,
}: {
  paquet: readonly string[]
  rencontre?: VueDeLaRencontre
  /**
   * La main de l'acte (la question au centre, v10), sur le plan comme en
   * rencontre : sa main, sa défausse, ce que la main tient au plus — la pioche
   * s'en déduit.
   */
  acte?: { main: readonly string[]; defausse: readonly string[]; mainMax: number }
  /** Son cran de l'Ascension : l'énergie de chaque question, que la règle du cycle dit — sans vue, au départ. */
  ascension?: number
  /** L'énergie de chaque acte, telle que la vue la dit (`CartesEnJeu.energie`). */
  energie?: readonly number[]
  onFermer: () => void
}) {
  const [regardee, setRegardee] = useState<string | null>(null)
  const posees = rencontre?.pouvoirs ?? []
  const pioche = acte
    ? sans(cartesDeCombat(paquet), [...acte.main, ...acte.defausse, ...posees])
    : rencontre
      ? sans(cartesDeCombat(paquet), [...rencontre.main, ...rencontre.defausse, ...rencontre.epuisees, ...rencontre.pouvoirs])
      : []
  const tas = (titre: string, cles: readonly string[], vide: string) => (
    <section className="exp-main-section" key={titre}>
      <h3 className="label">{`${titre} · ${cles.length}`}</h3>
      <RangeeDeCartes cles={cles} vide={vide} nom={titre} onRegarder={setRegardee} />
    </section>
  )
  return (
    <>
      <Feuille titre={rencontre || acte ? 'Tes cartes' : 'Ton paquet'} className="feuille-paquet" onFermer={onFermer}>
        {posees.length > 0 && tas('Posées pour toute la rencontre', posees, '')}
        {acte ? (
          <>
            {tas('Ta main', acte.main, 'Ta main est vide : une carte y vient après chaque question.')}
            {tas('Ta pioche', pioche, 'Ta pioche est vide : toutes tes cartes reviennent à l’acte suivant.')}
            {tas('Ta défausse', acte.defausse, 'Rien en défausse.')}
          </>
        ) : (
          rencontre && (
            <>
              {tas('Ta pioche', pioche, 'Ta pioche est vide : ta défausse y revient à la question suivante.')}
              {tas('Ta défausse', rencontre.defausse, 'Rien en défausse.')}
              {rencontre.epuisees.length > 0 && tas('Hors jeu jusqu’à la rencontre suivante', rencontre.epuisees, '')}
            </>
          )
        )}
        {tas('Tout ton paquet', paquet, 'Ton paquet est vide.')}
        <p className="muted small">{espacesFines(acte ? regleDuCycleEnQuestion(acte.mainMax) : regleDuCycle(energieDesActes(energie, ascension)))}</p>
      </Feuille>
      {regardee && <CarteLevee cle={regardee} onReposer={() => setRegardee(null)} />}
    </>
  )
}

/** Les pages du codex : toutes ses cartes, puis une rareté à la fois, de la commune à la légendaire. */
type PageDuCodex = 'toutes' | CarteDeRencontre['rarete']
const PAGES_DU_CODEX: { id: PageDuCodex; nom: string }[] = [
  { id: 'toutes', nom: 'Toutes' },
  { id: 'commun', nom: 'Communes' },
  { id: 'rare', nom: 'Rares' },
  { id: 'epique', nom: 'Épiques' },
  { id: 'maudit', nom: 'Maudites' },
  { id: 'legendaire', nom: 'Légendaires' },
]

/**
 * Son niveau d'explorateur, et la renommée qui mène au suivant, en jauge : au
 * départ, en tête du codex. Au dernier, le codex entier est à lui.
 */
export function NiveauDExplorateur({ renommee }: { renommee: number }) {
  const p = progressionDe(renommee)
  const part = p.prochain === null ? 1 : (renommee - p.depuis) / (p.prochain - p.depuis)
  return (
    <div className="exp-niveau">
      <p className="exp-niveau-tete" aria-hidden="true">
        <b>{`Niveau ${p.niveau}`}</b>
        <span className="muted">{' d’explorateur'}</span>
        <span className="exp-niveau-compte">{p.prochain === null ? 'le codex entier' : `${formatNumber(renommee)} / ${formatNumber(p.prochain)}`}</span>
      </p>
      <span className="jauge-fine" aria-hidden="true">
        <span style={{ width: `${Math.round(part * 100)}%` }} />
      </span>
      <span className="sr-only">
        {p.prochain === null
          ? `Niveau ${p.niveau} d’explorateur, le dernier : ${renommee} de renommée.`
          : `Niveau ${p.niveau} d’explorateur : ${renommee} de renommée, ${p.prochain} pour le niveau ${p.niveau + 1}.`}
      </span>
    </div>
  )
}

/** Ce qu'un niveau ouvre d'autre que des cartes, dit à la fin qui l'ouvre. */
const REGLE_OUVERTE: Readonly<Record<RegleDuCodex, string>> = {
  pari: 'Le pari s’ouvre : avant de voir une question, parie des écus.',
  fioles: `Les fioles s’ouvrent : l’échoppe en vend, les coffres en cachent — ${FIOLES_MAX} dans ton sac, à boire quand tu veux.`,
  talismans: 'Les talismans s’ouvrent : tes récompenses et l’échoppe en proposent.',
  fetiche: 'Ta catégorie fétiche s’ouvre : choisis-la au départ.',
}

/** Le nom d'un dos, dans une phrase : « le dos doré ». */
const nomDuDos = (cle: DosDuPaquet) => dosDe(cle)?.nom ?? cle

/** La règle d'un cran de l'Ascension au milieu d'une phrase : « les adversaires ont 4 points de plus » — à la version du départ, dont la question au centre retraduit les crans. */
const regleDuCran = (cran: number, v: number) => {
  const regle = ascensionDe(v)[cran - 1]?.regle ?? ''
  return regle.charAt(0).toLowerCase() + regle.slice(1)
}

/**
 * Ce qu'un exploit ouvre, en fin de phrase : « Banco rejoint ton codex »,
 * « le dos doré est à toi » — au futur tant que l'expédition court : son
 * codex est figé, l'exploit ne compte qu'à la suivante.
 */
export function recompenseDe(x: Exploit, futur = false): string {
  if (x.carte) return `${nomDeLaRecompense(x)} ${futur ? 'rejoindra' : 'rejoint'} ton codex`
  return `${nomDeLaRecompense(x)} ${futur ? 'sera' : 'est'} à toi`
}

/** Ce qu'un exploit ouvre, en nom : sa carte, ou son dos. */
const nomDeLaRecompense = (x: Exploit) => (x.carte ? (carteDeRencontre(x.carte)?.nom ?? x.carte) : nomDuDos(x.dos ?? 'dore'))

/** La classe d'un dos, sur la pioche : l'ordinaire n'en a pas. */
export const classeDuDos = (dos: DosDuPaquet | undefined) => (dos && dos !== 'ordinaire' ? ` exp-dos-${dos}` : '')

/**
 * Les exploits neufs d'une expédition : faits en route, que son codex n'avait
 * pas au départ. Un départ d'avant les exploits n'en sait rien : il n'en dit
 * aucun — il aurait pu dire neuf un exploit déjà fait.
 */
export function exploitsNeufs(vue: Pick<VueDeLExpedition, 'exploits' | 'cartes'>): CleDExploit[] {
  const deja = vue.cartes?.codex?.exploits
  if (!deja) return []
  return (vue.exploits ?? []).filter(x => !deja.includes(x))
}

/**
 * Le dos de son paquet : celui qu'il a choisi au départ. Un départ d'avant
 * les dos le prenait doré de l'exploit du gardien — celui de son codex au
 * départ.
 */
export const dosDuPaquet = (vue: Pick<VueDeLExpedition, 'cartes'>): DosDuPaquet | undefined =>
  vue.cartes?.dos ?? (vue.cartes?.codex?.exploits?.includes('gardien-intact') ? 'dore' : undefined)

/**
 * Ce que la fin d'une expédition rapporte au codex : sa renommée, perdue ou
 * abandonnée aussi — sans quoi un joueur qui tombe à l'acte 1 resterait au
 * même niveau —, et le niveau qu'elle fait passer, avec les cartes qu'il
 * ouvre, en vraies cartes qui se lèvent, et les règles ; ses exploits neufs
 * (`exploitsNeufs`), et ce qu'ils ouvrent. `avant` : la renommée qu'il avait
 * au départ, figée avec lui (`CodexDuDepart.renommee`). `ascension` : le cran
 * de l'Ascension que sa victoire ouvre (`cranOuvertParLaVictoire`).
 */
export function RenommeeGagnee({
  avant,
  gagnee,
  exploits = [],
  ascension = null,
}: {
  avant: number
  gagnee: number
  exploits?: readonly CleDExploit[]
  ascension?: number | null
}) {
  const [regardee, setRegardee] = useState<string | null>(null)
  // L'échelle et les crans de sa version : celle de la question au centre ouvre ses cartes à elle.
  const v = useContext(VersionDesCartes)
  const niveauAvant = progressionDe(avant).niveau
  const niveau = progressionDe(avant + gagnee).niveau
  const marches = echelleDe(v).filter(m => m.niveau > niveauAvant && m.niveau <= niveau)
  const faits = exploits.flatMap(x => exploitDe(x) ?? [])
  const cartes = [...marches.flatMap(m => m.cartes), ...faits.flatMap(x => x.carte ?? [])].flatMap(cle => carteALaVersion(cle, v) ?? [])
  return (
    <section className="card exp-renommee" aria-labelledby="exp-renommee-titre">
      <h2 className="label" id="exp-renommee-titre">
        Ton codex
      </h2>
      <p className="exp-renommee-gain">
        <b>{`+${formatNumber(gagnee)}`}</b>
        {' de renommée'}
      </p>
      {/* L'événement en titre ; la jauge dessous dit où il en est — « Niveau 6 d'explorateur » deux fois de suite se répétait. */}
      {niveau > niveauAvant && <p className="exp-renommee-niveau">{`Tu passes au niveau ${niveau}`}</p>}
      <NiveauDExplorateur renommee={avant + gagnee} />
      {/* Ses exploits neufs, chacun ce qu'il ouvre ; ses cartes rejoignent celles du niveau, dessous. */}
      {faits.map(x => (
        <p key={x.cle} className="exp-renommee-exploit">
          <Icon name="medal" />
          <span>
            <b>{espacesFines(`Exploit : ${x.but}`)}</b>
            {espacesFines(` — ${recompenseDe(x)}.`)}
          </span>
        </p>
      ))}
      {cartes.length > 0 && (
        <>
          <ul className="exp-codex exp-codex-neuves" aria-label="Les cartes qui rejoignent ton codex">
            {cartes.map(c => (
              <li key={c.cle}>
                <button type="button" className="exp-codex-carte" data-carte={c.cle} aria-haspopup="dialog" onClick={() => setRegardee(c.cle)}>
                  <CarteDessinee c={c} taille="rangee" />
                  <span className="sr-only">{`${c.nom}, ${RARETE_DE_LA_CARTE[c.rarete]} : ${c.resume}`}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {espacesFines(
              cartes.length > 1
                ? `Ces ${cartes.length} cartes rejoignent ton codex : tes récompenses les proposeront dès ta prochaine expédition.`
                : 'Elle rejoint ton codex : tes récompenses la proposeront dès ta prochaine expédition.',
            )}
          </p>
        </>
      )}
      {marches.flatMap(m => (m.regle ? [m.regle] : [])).map(regle => (
        <p key={regle} className="exp-renommee-regle">
          <Icon name="sparkles" />
          {espacesFines(REGLE_OUVERTE[regle])}
        </p>
      ))}
      {/* Un dos neuf, tel que la pioche le portera. */}
      {marches.flatMap(m => (m.dos ? [m.dos] : [])).map(dos => (
        <p key={dos} className="exp-renommee-regle">
          <span className={'exp-pioche exp-dos-miniature' + classeDuDos(dos)} aria-hidden="true" />
          {espacesFines(`Un dos neuf pour ton paquet : ${nomDuDos(dos)}. Choisis-le au départ.`)}
        </p>
      ))}
      {/* L'Ascension : la première victoire l'ouvre, chaque victoire à son plus haut cran ouvre le suivant. */}
      {ascension !== null && (
        <p className="exp-renommee-regle">
          <Icon name="mountain" />
          {espacesFines(
            ascension === 1
              ? `L’Ascension s’ouvre : au départ, choisis son cran 1 — ${regleDuCran(1, v)}.`
              : `Le cran ${ascension} de l’Ascension s’ouvre. En plus des autres : ${regleDuCran(ascension, v)}.`,
          )}
        </p>
      )}
      {regardee && <CarteLevee cle={regardee} onReposer={() => setRegardee(null)} />}
    </section>
  )
}

/** Comment s'ouvre une carte que son codex n'a pas encore, en court sous elle, et en phrase quand elle se lève — à l'échelle de sa version. */
function ouvertureDite(cle: string, v: number): { court: string; phrase: string } | null {
  const o = ouvertureDe(cle, v)
  if (!o) return null
  if ('niveau' in o) return { court: `Niveau ${o.niveau}`, phrase: `Elle s’ouvre au niveau ${o.niveau} d’explorateur.` }
  if ('exploit' in o) return { court: 'Exploit', phrase: `Elle s’ouvre par un exploit : ${exploitDe(o.exploit)?.but ?? o.exploit}.` }
  const gagne = gardienAuFeminin(o.legendaire) ? 'gagnée' : 'gagné'
  return { court: nomDuGardien(o.legendaire), phrase: `Elle s’ouvre quand ${leGardien(o.legendaire)} est à toi — ${gagne} en soirée, au quiz du jour, en campagne ou en expédition.` }
}

/**
 * Le codex : toutes les cartes de l'expédition, de la commune à la
 * légendaire, en vraies cartes (« Est-ce que l'on ferait pas un codex de
 * carte global aussi, avec de commun à légendaire et on en débloque au fur
 * et à mesure qu'on avance dans l'aventure ? », le 18 octobre 2026). Une page
 * par rareté, en onglets qui comptent ; touchée, une carte se lève et dit
 * tout, comme dans un tas. `codex` : son niveau et sa jauge en tête, et les
 * cartes qu'il n'a pas encore éteintes, comment les ouvrir dessous — un
 * niveau, un exploit, ou le légendaire qui la donne. Celles-là se lèvent
 * aussi : savoir ce qui vient donne envie d'y aller. Au pied, ses exploits,
 * puis ses dos de cartes — ceux qu'il a, et comment s'ouvrent les autres :
 * un dos n'a pas de carte qui le dise.
 */
export function FeuilleDuCodex({ codex, onFermer }: { codex?: CodexDeLaPage; onFermer: () => void }) {
  const [page, setPage] = useState<PageDuCodex>('toutes')
  const [regardee, setRegardee] = useState<string | null>(null)
  // Les cartes de sa version, à ses chiffres : la question au centre (v10) n'en montre que les soixante-deux qu'elle joue.
  const v = useContext(VersionDesCartes)
  const toutes = CARTES_DES_RENCONTRES.flatMap(c => carteALaVersion(c.cle, v) ?? [])
  const ouvertes = codex ? new Set(codex.cartes) : null
  const estOuverte = (cle: string) => !ouvertes || ouvertes.has(cle)
  const cartes = toutes.filter(c => page === 'toutes' || c.rarete === page)
  // Des puces qui comptent, comme les pages de l'album des trophées : cinq onglets à leur nom ne tenaient pas sur une ligne en 360.
  const onglets = PAGES_DU_CODEX.map(p => {
    const n = p.id === 'toutes' ? toutes.length : toutes.filter(c => c.rarete === p.id).length
    return { id: p.id, nom: p.nom, pastille: { n, label: `${n} carte${n > 1 ? 's' : ''}`, entier: true as const } }
  })
  const fermee = regardee && !estOuverte(regardee) ? ouvertureDite(regardee, v) : null
  return (
    <>
      <Feuille titre="Ton codex" className="feuille-codex" onFermer={onFermer}>
        {codex && <NiveauDExplorateur renommee={codex.renommee} />}
        <p className="muted small">
          {espacesFines(
            codex
              ? `${codex.cartes.length} cartes sur ${toutes.length} sont à toi : tes récompenses les tirent. Les autres s’ouvrent en jouant — un niveau, un exploit. Touche une carte pour la lire.`
              : `Les ${toutes.length} cartes de l’expédition, de la commune à la légendaire. Touche une carte pour la lire.`,
          )}
        </p>
        <Onglets onglets={onglets} actif={page} onChoisir={setPage} label="Les raretés" idOnglet={id => `codex-${id}`} idPanneau={() => 'codex-page'} className="onglets-puces" />
        <ul className="exp-codex" id="codex-page" role="tabpanel" aria-labelledby={`codex-${page}`}>
          {cartes.map(c => {
            const ouverture = estOuverte(c.cle) ? null : ouvertureDite(c.cle, v)
            return (
              <li key={c.cle} className={ouverture ? 'exp-codex-fermee' : undefined}>
                <button type="button" className="exp-codex-carte" data-carte={c.cle} aria-haspopup="dialog" onClick={() => setRegardee(c.cle)}>
                  <CarteDessinee c={c} taille="rangee" />
                  {ouverture && (
                    <span className="exp-codex-ouverture" aria-hidden="true">
                      <Icon name="lock" />
                      {ouverture.court}
                    </span>
                  )}
                  <span className="sr-only">{`${c.nom}, ${RARETE_DE_LA_CARTE[c.rarete]} : ${c.resume}${ouverture ? `. ${ouverture.phrase}` : ''}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {codex && (
          <section className="exp-exploits" aria-labelledby="exp-exploits-titre">
            <h3 className="label" id="exp-exploits-titre">
              {`Tes exploits · ${codex.exploits.length} sur ${EXPLOITS.length}`}
            </h3>
            <ul>
              {EXPLOITS.map(x => {
                const fait = codex.exploits.includes(x.cle)
                return (
                  <li key={x.cle} className={'exp-exploit' + (fait ? ' exp-exploit-fait' : '')}>
                    <Icon name={fait ? 'check-circle' : 'medal'} />
                    <span>
                      <b className="exp-exploit-but">{espacesFines(x.but)}</b>
                      <span className="muted small">
                        {espacesFines(fait ? `Fait : ${nomDeLaRecompense(x)} ${x.carte ? 'est dans ton codex' : 'est à toi'}.` : `Ouvre ${nomDeLaRecompense(x)}.`)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        {codex && (
          <section className="exp-exploits" aria-labelledby="exp-dos-titre">
            <h3 className="label" id="exp-dos-titre">
              {`Tes dos de cartes · ${codex.dos.length} sur ${DOS_DES_CARTES.length}`}
            </h3>
            <ul>
              {DOS_DES_CARTES.map(d => {
                const aLui = codex.dos.includes(d.cle)
                const o = ouvertureDuDos(d.cle)
                const comment = 'exploit' in o ? `Exploit : ${exploitDe(o.exploit)?.but ?? o.exploit}.` : `Il s’ouvre au niveau ${o.niveau} d’explorateur.`
                return (
                  <li key={d.cle} className={'exp-un-dos' + (aLui ? '' : ' exp-dos-ferme')}>
                    {/* Le dos tel que la pioche le portera : une carte se voit dans le codex, un dos ici. */}
                    <span className={'exp-pioche exp-dos-miniature' + classeDuDos(d.cle)} aria-hidden="true" />
                    <span>
                      <b className="exp-exploit-but">{espacesFines(d.nom)}</b>
                      <span className="muted small">{espacesFines(aLui ? (codex.dos.length > 1 ? 'À toi : choisis-le au départ.' : 'À toi.') : comment)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </Feuille>
      {regardee && <CarteLevee cle={regardee} {...(fermee && { ouverture: fermee.phrase })} avecAmelioration onReposer={() => setRegardee(null)} />}
    </>
  )
}

// ── Les fioles ──────────────────────────────────────────────────────────────

/**
 * Boire une fiole : la page pose le geste sur chaque écran d'une expédition
 * en route (`ExpeditionApp`, `aSaVersion`) — la barre du haut est partout, la
 * fiole aussi, sans passer de main en main. Sans lui, une fiole se regarde
 * seulement.
 */
export const BoireUneFiole = createContext<((fiole: CleDeFiole) => void) | null>(null)

/**
 * La teinte d'une fiole, sur son verre : le rouge du courage, le bleu de
 * l'orbe d'énergie, le violet de la clairvoyance. Une convention, écrite en
 * dur comme celle des familles : aucun thème ne la repeint (règle `css.md`).
 */
const TEINTE_DE_LA_FIOLE: Record<CleDeFiole, string> = { courage: '#e0565c', energie: '#3cc4d4', clairvoyance: '#a07bf0' }

/** Une fiole dessinée : son verre, à sa teinte. */
export function VerreDeFiole({ cle }: { cle: CleDeFiole }) {
  return (
    <span className="exp-fiole-verre" style={{ '--fiole': TEINTE_DE_LA_FIOLE[cle] } as CSSProperties} aria-hidden="true">
      <Icon name="fiole" />
    </span>
  )
}

/**
 * Ses fioles, dans la barre du haut : celles qu'il porte — rien tant qu'il
 * n'en a pas : deux places vides, à côté des écus et du courage, ne disaient
 * rien qu'on ne lise aux règles, et la barre d'un téléphone n'a pas la place.
 * Touchée, une fiole se lève (`FioleLevee`).
 */
export function SesFioles({ fioles }: { fioles: NonNullable<VueDeLExpedition['fioles']> }) {
  const [levee, setLevee] = useState<CleDeFiole | null>(null)
  if (fioles.tenues.length === 0) return null
  return (
    <span className="exp-fioles" role="group" aria-label="Tes fioles">
      {fioles.tenues.map((cle, i) => (
        <button key={`${cle}:${i}`} type="button" className="exp-fiole" data-fiole={cle} aria-haspopup="dialog" aria-label={fioleDe(cle)?.nom ?? cle} onClick={() => setLevee(cle)}>
          <VerreDeFiole cle={cle} />
        </button>
      ))}
      {levee && <FioleLevee cle={levee} refus={fioles.refus[levee] ?? null} onReposer={() => setLevee(null)} />}
    </span>
  )
}

/**
 * Une fiole levée : ce qu'elle fait, et « La boire » — ou pourquoi pas
 * maintenant, de la règle même du serveur (`refusDeLaFiole`, arrivée avec la
 * vue). Bue, elle se repose d'elle-même.
 */
export function FioleLevee({ cle, refus, onReposer }: { cle: CleDeFiole; refus: string | null; onReposer: () => void }) {
  const boire = useContext(BoireUneFiole)
  const f = fioleDe(cle)
  if (!f) return null
  return (
    <Feuille titre={f.nom} className="feuille-fiole" onFermer={onReposer}>
      <div className="exp-fiole-levee">
        <VerreDeFiole cle={cle} />
        <p className="exp-fiole-effet">{espacesFines(`${f.effet}.`)}</p>
      </div>
      <p className="muted small">{espacesFines(`Une fiole ne sert qu’une fois, quand tu veux — même la question sous les yeux. Tu en portes ${FIOLES_MAX} au plus.`)}</p>
      {boire &&
        (refus ? (
          <p className="exp-refus small">{espacesFines(refus)}</p>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-big btn-block"
            onClick={() => {
              onReposer()
              boire(cle)
            }}
          >
            La boire
          </button>
        ))}
    </Feuille>
  )
}

// ── La rencontre ────────────────────────────────────────────────────────────

/** La marche d'une question, accordée à elle. */
const MARCHE_DITE: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }

/** Une forme qui n'est pas celle de tous les jours, dite en clair ; quatre choix ne se disent pas. */
const FORME_DITE: Record<FormeDEscale, string | null> = { quatre: null, six: 'six choix', 'vrai-faux': 'vrai ou faux', devoilement: 'mot à mot', lettres: 'à composer', frise: 'une frise' }

/**
 * L'adversaire, en tête de la rencontre : l'emblème de sa catégorie — de son
 * thème pointu, le médaillon d'un gardien —, son nom, et ce qu'il lui reste,
 * en jauge et en chiffre — les points qu'une bonne réponse lui fait perdre ;
 * à zéro, il tombe. Dessous, la question qu'il pose (`SaQuestion`), sans son
 * texte. `sceaux` et `doute` : ce qui lui reste après la réponse, à la
 * révélation (`adversaireALaRevelation`) ; `compact`, la question sous les
 * yeux : son nom et sa jauge seuls. Dans la question au centre (v10), ses
 * crans, et ce qu'une réponse ferait (`r.apercu`, la règle du verdict) : les
 * crans qu'une bonne réponse prendrait tremblent, l'attaque se dit cartes
 * comptées — une carte jouée change ce qu'on voit, et l'œil le voit sans un
 * mot ; `tot`, un dévoilement encore à sa première moitié ; `apercu`, celui
 * du pari choisi à l'annonce, pas encore parti.
 */
export function Adversaire({
  r,
  gardien,
  acte,
  sceaux,
  doute: douteApres,
  compact,
  tot,
  apercu,
}: {
  r: VueDeLaRencontre
  gardien: string
  acte: number
  sceaux?: number
  doute?: number
  compact?: boolean
  tot?: boolean
  apercu?: ApercuDuTour
}) {
  const restants = Math.max(0, sceaux ?? r.sceaux)
  const sujet = r.sujet ? sujetParCle(r.sujet) : undefined
  const theme = sujet?.nom ?? r.categorie ?? 'Mélange'
  const surtitre = r.sorte === 'gardien' ? `Gardien · acte ${acte + 1}` : r.sorte === 'elite' ? `Élite · ${theme}` : theme
  const part = r.max > 0 ? Math.round((restants / r.max) * 100) : 0
  const nom = r.sorte === 'gardien' ? nomDuGardien(gardien) : r.adversaire
  // Son doute (les huit familles) : ce qu'il perdra à cette question, juste ou fausse — tombé, il ne doute plus de rien.
  const doute = restants > 0 ? (douteApres ?? r.doute ?? 0) : 0
  // La question au centre (v10) : ses crans — les bonnes réponses qui le font tomber —, et son attaque, toujours la même.
  const crans = !!r.crans
  // Ce qu'une réponse ferait, tant qu'elle n'est pas donnée (à la révélation, `sceaux` dit ce qu'elle a fait) : les cartes jouées comprises.
  const a = crans && sceaux === undefined ? (apercu ?? r.apercu) : undefined
  const prises = a ? (tot && a.juste.auPremierMot !== undefined ? a.juste.auPremierMot : a.juste.brises) : 0
  const visees = Math.min(restants, prises)
  const attaque = a ? a.faux.perdu : r.frappe
  const siJusteDit = !a ? '' : prises >= restants ? ', une bonne réponse le fait tomber' : `, une bonne réponse lui en prend ${visees}`
  const reste =
    restants === 0
      ? 'tombé'
      : crans
        ? `il lui reste ${restants} cran${restants > 1 ? 's' : ''} sur ${r.max}${siJusteDit}, son attaque : ${attaque}`
        : `il lui reste ${restants} point${restants > 1 ? 's' : ''} sur ${r.max}`
  return (
    <section
      className={`exp-adversaire exp-adversaire-${r.sorte}` + (restants === 0 ? ' exp-adversaire-tombe' : '') + (compact ? ' exp-adversaire-compact' : '')}
      aria-label={espacesFines(`${surtitre} : ${nom}, ${reste}${doute > 0 ? `, il doute : il perdra ${doute} à cette question, juste ou fausse` : ''}`)}
    >
      <div className="exp-adversaire-haut" aria-hidden="true">
        <span className="exp-adversaire-embleme">
          {r.sorte === 'gardien' ? (
            <span className="exp-medaillon">
              <Dessin cle={gardien} />
            </span>
          ) : (
            <Icon name={sujet ? iconeDuSujet(sujet) : r.categorie ? (EMBLEME[r.categorie] ?? 'swords') : 'shuffle'} />
          )}
        </span>
        <span className="exp-adversaire-texte">
          <span className="label">{surtitre}</span>
          <b className="exp-adversaire-nom">{nom}</b>
          {crans ? (
            // Ses crans en pastilles — pleines, ce qu'il lui reste ; vides, ce que tes bonnes réponses ont brisé ; celles qui tremblent, ce
            // que la prochaine prendrait —, et son attaque, plus douce ou plus dure qu'à l'ordinaire si une carte la change.
            <span className="exp-sceaux exp-crans-adverses">
              <span className="exp-crans-pastilles">
                {Array.from({ length: r.max }, (_, i) => (
                  <i key={i} className={i < restants - visees ? 'exp-cran-plein' : i < restants ? 'exp-cran-plein exp-cran-vise' : undefined} />
                ))}
              </span>
              <b>{restants === 0 ? 'Tombé' : `${restants} cran${restants > 1 ? 's' : ''}`}</b>
              {restants > 0 && (
                <span className={'exp-attaque' + (attaque < r.frappe ? ' exp-attaque-moindre' : attaque > r.frappe ? ' exp-attaque-pire' : '')}>
                  <Icon name="swords" />
                  {attaque}
                </span>
              )}
            </span>
          ) : (
            <span className="exp-sceaux">
              <span className="exp-sceaux-jauge">
                <i style={{ width: `${part}%` }} />
              </span>
              <b>{restants === 0 ? 'Tombé' : `${restants} point${restants > 1 ? 's' : ''}`}</b>
              {doute > 0 && (
                <span className="exp-doute">
                  <Icon name="bulles" />
                  {`Doute ${doute}`}
                </span>
              )}
            </span>
          )}
        </span>
      </div>
      {!compact && r.annonce && <SaQuestion a={r.annonce} />}
    </section>
  )
}

/**
 * L'adversaire à la révélation, tel que la réponse l'a laissé : ses points
 * d'avant, moins ce que la réponse a brisé et ce que son doute lui a coûté —
 * compté à part dans le coup (`CoupDeRencontre.doute`) —, et le doute qu'il
 * garde pour la question suivante, que porte la vue d'après (Paranoïa,
 * Engrenage ; rien s'il est tombé). Lu de la seule vue d'avant, l'en-tête
 * gardait ce que le doute avait pris, et le doute déjà perdu.
 */
export const adversaireALaRevelation = (avant: VueDeLaRencontre, coup: CoupDeRencontre | null | undefined, apres: VueDeLaRencontre | null | undefined) => ({
  sceaux: avant.sceaux - (coup?.brises ?? 0) - (coup?.doute ?? 0),
  doute: apres?.doute ?? 0,
})

/**
 * La question qu'il pose, avant de la voir : sa catégorie, sa marche, sa
 * forme quand ce n'est pas quatre choix, une année ou des nombres — et tes
 * chances. Jamais son texte (invariant 1).
 */
function SaQuestion({ a }: { a: AnnonceDuTour }) {
  // « Des nombres » : la règle des nombres (celle de la Prédiction) compte aussi « Apollo 11 » — ce n'est pas toujours un nombre à trouver.
  const en = a.reponseEn === 'annee' ? 'une année' : a.reponseEn === 'nombre' ? 'des nombres' : null
  const quoi = [a.categorie ?? 'une catégorie au hasard', MARCHE_DITE[a.niveau], FORME_DITE[a.forme], en].filter(Boolean).join(' · ')
  return (
    <p className="exp-sa-question">
      <span>
        <span className="muted">{'Sa question : '}</span>
        {espacesFines(quoi)}
      </span>
      {a.chance !== undefined && (
        <span className="exp-sa-chance">
          <Balise couleur={couleurDePiste(a.chance)} />
          <span>
            <b>{pourcents(a.chance)}</b>
            <span className="sr-only"> de chances de la trouver</span>
          </span>
        </span>
      )}
    </p>
  )
}

/** Ses paris, avant de voir la question : non, 10, 20, 40 écus. Un pari qu'il ne peut pas payer s'éteint, et dit pourquoi au toucher. */
function Paris({ mises, choisie, onChoisir }: { mises: Readonly<Record<number, string | null>>; choisie: number; onChoisir: (mise: number, refus: string | null) => void }) {
  return (
    <div className="exp-mises" role="radiogroup" aria-labelledby="exp-mises-titre">
      <span className="label" id="exp-mises-titre">
        Parier ?
      </span>
      {MISES.map(m => {
        const refus = mises[m] ?? null
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={choisie === m}
            aria-disabled={refus !== null || undefined}
            className={'exp-mise' + (choisie === m ? ' exp-choisi' : '') + (refus !== null ? ' exp-refuse' : '')}
            onClick={() => onChoisir(m, refus)}
          >
            {m === 0 ? (
              'Non'
            ) : (
              <>
                <Icon name="ecu" />
                {m}
                <span className="sr-only"> écus</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Les règles, vues une fois à la première rencontre : retenu sur le téléphone, sous try/catch — un stockage refusé les remontre, sans rien bloquer. */
const CLE_DU_GUIDE = 'quizz.expedition.guide-rencontres'

function guideVu(): boolean {
  try {
    return localStorage.getItem(CLE_DU_GUIDE) === 'vu'
  } catch {
    return false
  }
}

function retenirLeGuide() {
  try {
    localStorage.setItem(CLE_DU_GUIDE, 'vu')
  } catch {
    // Un stockage refusé : le guide reviendra à la rencontre suivante, rien de plus.
  }
}

// ── Les règles ──────────────────────────────────────────────────────────────

/** Une section des règles : de quoi elle parle, son titre, une ligne par règle — un dessin, une phrase. */
interface SectionDesRegles {
  cle: 'rencontre' | 'cartes' | 'style' | 'ameliorees' | 'pari' | 'fioles' | 'expedition' | 'plan' | 'recompenses' | 'equipe' | 'codex' | 'exploits' | 'ascension' | 'passeport' | 'questions' | 'jokers'
  titre: string
  /** `energie` : l'orbe de l'énergie, tel que la main le montre. */
  lignes: { icone: IconName | 'energie'; texte: string }[]
}

export type DebutDesRegles = SectionDesRegles['cle']

/** Ce que les règles lisent du codex d'une expédition (v7) : les règles que son niveau a ouvertes. */
export interface CodexDesRegles {
  regles: readonly RegleDuCodex[]
  /** Les styles qu'il a ouverts (le 19 octobre 2026) : les règles disent le niveau des autres. Absents d'un départ figé, qui ne les garde pas. */
  styles?: readonly StyleDeJeu[]
}

/**
 * « s'ouvre au niveau 2 d'explorateur » : une règle que son niveau n'a pas
 * encore ouverte. Une règle du niveau 1 fermée — la catégorie fétiche d'une
 * expédition partie avant « Ton style », qui l'ouvrait au niveau 5 — s'ouvre à
 * la prochaine : « au niveau 1 » se lirait comme une erreur.
 */
const ouvertAuNiveau = (regle: RegleDuCodex) => (niveauDeLaRegle(regle) <= 1 ? 'dès ta prochaine expédition' : `au niveau ${niveauDeLaRegle(regle)} d’explorateur`)

/**
 * Les règles d'une expédition en rencontres, ce que les pages ne disent plus
 * (« Pas besoin d'explication pour tout, il faudrait juste un onglet règles
 * qu'on peut consulter de n'importe quelle page », la revue du 18 octobre
 * 2026). `parQuestion` : les cartes que chaque question tire, acte par acte,
 * telles que le serveur les dit. `codex` (v7) : plus d'équipe à choisir, des
 * récompenses de son codex, et ce que chaque niveau ouvre — une règle fermée
 * dit le niveau qui l'ouvre. `ascension` : son cran, celui de l'expédition en
 * route ou celui qui partirait — le campement et la source y rendent moins.
 * `energie` : celle de chaque question, acte par acte — deux à l'acte 1 depuis
 * le jeu complet. `ameliorees` : ses cartes s'améliorent (le jeu complet).
 * `v` : la version de son départ — le doute, le courage qu'on paie et les deux
 * styles des huit familles n'existent pas dans une expédition partie avant.
 */
function reglesDesRencontres(
  parQuestion: readonly number[],
  codex: CodexDesRegles | undefined,
  ascension: number,
  energie: readonly number[],
  ameliorees: boolean,
  v: number,
): SectionDesRegles[] {
  const [a1, a2, a3] = parQuestion
  const [e1, e2, e3] = energie
  const ouverte = (regle: RegleDuCodex) => !codex || codex.regles.includes(regle)
  // La question au centre (v10) a ses règles : la question d'abord, l'adversaire en crans, la main de l'acte.
  if (enQuestion(v)) return reglesEnQuestion(codex, ascension, v)
  const huitFamilles = v >= VERSION_DES_HUIT_FAMILLES
  // Les styles que son expédition connaît : ceux dont les cartes de départ existent à sa version.
  const sesStyles = STYLES.filter(s => CARTES_DE_DEPART_DU_STYLE[s].every(cle => (carteDeRencontre(cle)?.depuis ?? 0) <= v))
  const sonEnergie =
    e1 === e2 && e2 === e3
      ? `Tu en as ${e1} à chaque question.`
      : e2 === e3
        ? `Tu en as ${e1} à chaque question de l’acte 1, ${e2} ensuite.`
        : `Tu en as ${e1} à chaque question de l’acte 1, ${e2} à l’acte 2, ${e3} à l’acte 3.`
  // « une sur quatre » : la part des cartes offertes déjà améliorées, à l'acte 2 puis à l'acte 3.
  const uneSur = (acte: number) => `une sur ${Math.round(1 / (CHANCE_D_UNE_OFFRE_AMELIOREE[acte] || 1))}`
  return [
    {
      cle: 'rencontre',
      titre: 'Une rencontre',
      lignes: [
        { icone: 'check', texte: 'Réponds juste : l’adversaire perd des points. À zéro, il tombe.' },
        { icone: 'heart', texte: 'Trompe-toi : il t’attaque, et tu perds du courage. Son attaque grandit à chaque question.' },
        { icone: 'x', texte: 'Plus de courage : l’expédition s’arrête là.' },
        // Les huit familles : le doute du Sophiste, le courage que le Téméraire paie.
        ...(huitFamilles
          ? [
              {
                icone: 'bulles' as const,
                texte: 'Un adversaire qui doute perd autant de points à cette question, juste ou fausse, puis il ne doute plus. Tombé de son doute, il ne t’attaque pas.',
              },
              { icone: 'heart' as const, texte: 'Une carte qui se paie en courage ne se joue pas s’il ne t’en reste pas plus que son prix.' },
            ]
          : []),
      ],
    },
    {
      cle: 'cartes',
      titre: 'Tes cartes',
      lignes: [
        { icone: 'energie', texte: `Chaque carte coûte de l’énergie — le chiffre dans son coin. ${sonEnergie}` },
        { icone: 'list', texte: a1 === a3 ? `Tu tires ${a1} cartes à chaque question.` : `Tu tires ${a1} cartes à chaque question de l’acte 1, ${a2} à l’acte 2, ${a3} à l’acte 3.` },
        { icone: 'eye-off', texte: '« Maintenant » : avant de voir la question. « Pendant la question » : une fois qu’elle est sous tes yeux.' },
        { icone: 'eye', texte: 'Touche une carte : elle dit ce qu’elle fait, et ce qu’elle changerait.' },
        { icone: 'infinity', texte: 'Une carte posée pour toute la rencontre se montre en haut de l’écran : touche-la pour la relire.' },
        { icone: 'rotate', texte: 'Celles que tu ne joues pas vont à la défausse ; ta pioche vide, ta défausse y revient. Chaque rencontre remélange tout ton paquet.' },
        { icone: 'flag', texte: 'Une carte de route se joue sur le plan, une fois par acte.' },
      ],
    },
    // Les styles (le 19 octobre 2026) : ce que le choix du départ fait, puis chacun, sa devise et sa façon de gagner — fermé, son niveau.
    ...(codex
      ? [
          {
            cle: 'style' as const,
            titre: 'Ton style',
            lignes: [
              { icone: 'users' as const, texte: 'Au départ, choisis ton style : une famille de cartes. Deux de ses cartes partent dans ton paquet, à la place de deux cartes de base.' },
              { icone: 'plus-square' as const, texte: 'Chaque récompense propose une carte de ton style, une que tu n’as pas encore s’il en reste ; les deux autres viennent de partout.' },
              // Mesuré le 19 octobre 2026 : le joueur qui ne prend que les cartes de l'Érudit, du Flambeur ou de l'Élan va au bout bien
              // moins souvent que celui qui les mêle à des boucliers — ce que le style ne dit pas tout seul.
              { icone: 'shield' as const, texte: 'Ton style ne fait pas tout : un paquet qui ne fait qu’attaquer tombe vite. Prends aussi de quoi te protéger.' },
              ...sesStyles.map(s => ({
                icone: ICONE_DU_STYLE[s],
                texte: `${FAMILLES_DE_CARTES[s].nom} — « ${FAMILLES_DE_CARTES[s].devise} » : ${(FAMILLES_DE_CARTES[s].jeu ?? '').replace(/^./, x => x.toLowerCase())}${
                  !codex.styles || codex.styles.includes(s) ? '' : ` Il s’ouvre au niveau ${niveauDuStyle(s)} d’explorateur.`
                }`,
              })),
            ],
          },
        ]
      : []),
    // Le jeu complet : ce qu'une amélioration fait, et où l'on en trouve — une ligne chacun.
    ...(ameliorees
      ? [
          {
            cle: 'ameliorees' as const,
            titre: 'Tes cartes améliorées',
            lignes: [
              { icone: 'arrow-up' as const, texte: 'Une carte améliorée fait la même chose, en mieux : un chiffre plus haut, moins d’énergie, une carte de plus… Son nom finit par « + ».' },
              { icone: 'campement' as const, texte: 'Au campement, améliore une carte au lieu de te reposer.' },
              { icone: 'echoppe' as const, texte: `L’échoppe en améliore une, ${PRIX_DE_L_ECHOPPE.ameliorer} écus.` },
              { icone: 'plus-square' as const, texte: `Tes récompenses en proposent déjà améliorées : ${uneSur(1)} à l’acte 2, ${uneSur(2)} à l’acte 3.` },
              { icone: 'x' as const, texte: 'Ni les maudites, ni les cartes de route, ni celles des légendaires ne s’améliorent.' },
            ],
          },
        ]
      : []),
    {
      cle: 'pari',
      titre: 'Le pari',
      lignes: [
        ...(ouverte('pari') ? [] : [{ icone: 'lock' as const, texte: `Il s’ouvre ${ouvertAuNiveau('pari')}.` }]),
        { icone: 'ecu', texte: 'Avant de voir la question, parie des écus : juste, tu gagnes la moitié de ta mise ; faux, tu la perds.' },
        { icone: 'echoppe', texte: 'Tes écus se gagnent en battant tes adversaires et se dépensent à l’échoppe. Ils restent dans l’expédition.' },
      ],
    },
    // Les fioles (le codex) : ce que chacune fait, où elles se trouvent — fermées, le niveau qui les ouvre.
    ...(codex
      ? [
          {
            cle: 'fioles' as const,
            titre: 'Les fioles',
            lignes: [
              ...(ouverte('fioles') ? [] : [{ icone: 'lock' as const, texte: `Elles s’ouvrent ${ouvertAuNiveau('fioles')}.` }]),
              { icone: 'fiole' as const, texte: `Une fiole ne sert qu’une fois : bois-la quand tu veux, même la question sous les yeux. Tu en portes ${FIOLES_MAX} au plus.` },
              ...FIOLES.map(f => ({ icone: 'fiole' as const, texte: `${f.nom} : ${f.effet}.` })),
              { icone: 'echoppe' as const, texte: `L’échoppe en vend une, ${PRIX_DE_L_ECHOPPE.fiole} écus ; un coffre en cache une, à prendre à la place d’une carte.` },
            ],
          },
        ]
      : []),
    {
      cle: 'expedition',
      titre: 'L’expédition',
      lignes: [
        { icone: 'crown', texte: 'Trois actes, un gardien au bout de chacun. Bats le troisième : tu repars avec l’un des trois.' },
        { icone: 'star', texte: 'Les questions sont faciles à l’acte 1, moyennes à l’acte 2, difficiles à l’acte 3.' },
        { icone: 'arrow-left', texte: '« ← Partir » ne perd rien : du départ, tu reprends ton expédition, ou tu l’abandonnes.' },
      ],
    },
    {
      cle: 'plan',
      titre: 'Le plan',
      lignes: [
        {
          icone: 'flag',
          texte:
            'À chaque pas, choisis ton escale. Son pourcentage, à la couleur d’une piste — verte, bleue, rouge, noire : tes chances sur ses questions, celles d’un joueur moyen tant que tu n’as pas assez joué.',
        },
        // La légende de la feuille du plan, qui n'existe plus (le 19 octobre 2026) : le plan se touche sur place.
        { icone: 'eye', texte: 'Touche une escale, sur le plan ou en carte : ce qu’elle cache se lit sous les cartes.' },
        { icone: 'swords', texte: 'Une rencontre : un adversaire de sa catégorie. Une élite : plus coriace, mieux payée.' },
        { icone: 'shuffle', texte: 'Un mélange : chaque question tirée dans l’une de ses catégories, que sa carte montre en emblèmes.' },
        { icone: 'source', texte: `Une source : une question de ton carnet, ${reposALAscension(COURAGE_D_UNE_SOURCE, ascension)} de courage si tu la retrouves.` },
        { icone: 'coffre', texte: 'Un coffre : une carte au choix — ou des écus, si tu n’en prends aucune.' },
        {
          icone: 'campement',
          texte: ameliorees
            ? `Un campement, avant le gardien : ${reposALAscension(COURAGE_D_UN_CAMPEMENT, ascension)} de courage, une carte de moins — un paquet plus court tire plus souvent tes meilleures — ou une carte améliorée.`
            : `Un campement, avant le gardien : ${reposALAscension(COURAGE_D_UN_CAMPEMENT, ascension)} de courage, ou une carte de moins — un paquet plus court tire plus souvent tes meilleures.`,
        },
        { icone: 'echoppe', texte: 'Une échoppe : du courage et des cartes, contre tes écus.' },
        { icone: 'help', texte: 'L’inconnu : un marchand, un piège, ou un légendaire de passage.' },
        { icone: 'tampon', texte: 'Un point d’or sur une escale : un thème pointu dont ton passeport attend le tampon.' },
      ],
    },
    codex
      ? {
          cle: 'recompenses',
          titre: 'Tes récompenses',
          lignes: [
            { icone: 'plus-square', texte: 'Un adversaire tombé : une carte de ton codex à choisir parmi trois — plus souvent rare après une élite ou dans un coffre.' },
            { icone: 'users', texte: 'Une des trois est de ton style, les deux autres de partout.' },
            { icone: 'crown', texte: 'Un gardien vaincu, aux actes 1 et 2 : son trésor propose une carte légendaire de ton codex.' },
            ...(ouverte('talismans') ? [] : [{ icone: 'lock' as const, texte: `Les talismans s’ouvrent ${ouvertAuNiveau('talismans')}.` }]),
          ],
        }
      : {
          cle: 'recompenses',
          titre: 'Tes récompenses',
          lignes: [{ icone: 'plus-square', texte: 'Un adversaire tombé : une carte à choisir parmi trois, pour ton paquet — plus souvent rare après une élite ou dans un coffre.' }],
        },
    codex
      ? {
          cle: 'codex',
          titre: 'Ton codex',
          lignes: [
            {
              icone: 'star',
              texte: `Chaque expédition, même perdue, te rapporte de la renommée : +${RENOMMEE.escales} par escale, +${RENOMMEE.adversaires} par adversaire tombé, +${RENOMMEE.elites} par élite, +${RENOMMEE.gardiens} par gardien, +${RENOMMEE.auBout} au bout.`,
            },
            { icone: 'book', texte: 'Ta renommée fait ton niveau d’explorateur : chaque niveau ouvre des cartes dans ton codex, et seules celles-là tombent en récompense.' },
            { icone: 'sparkles', texte: 'Chaque légendaire que tu as y ouvre sa carte. L’invité du jour part avec toi : sa carte rejoint ton paquet.' },
            ...(ouverte('fetiche')
              ? [{ icone: 'target' as const, texte: 'Ta catégorie fétiche, que choisit l’Érudit : Plume, Bibliothèque et Génie frappent plus fort sur ses questions.' }]
              : [{ icone: 'lock' as const, texte: `Ta catégorie fétiche s’ouvre ${ouvertAuNiveau('fetiche')}.` }]),
          ],
        }
      : {
          cle: 'equipe',
          titre: 'Ton équipe',
          lignes: [
            { icone: 'users', texte: 'Les légendaires que tu emmènes : la carte de chacun rejoint ton paquet, et sa famille choisit les cartes de tes récompenses.' },
            { icone: 'sparkles', texte: 'Sans légendaire à toi, l’invité du jour part avec toi. Va au bout d’une expédition : le gardien que tu choisis sera de la suivante.' },
            { icone: 'book', texte: 'Ta catégorie fétiche : Plume et Bibliothèque frappent plus fort sur ses questions.' },
          ],
        },
    // Les exploits (le codex) : chacun une ligne, ce qu'il demande et ce qu'il ouvre — Banco, Lancée, Échauffement ne s'ouvrent que par eux.
    ...(codex
      ? [
          {
            cle: 'exploits' as const,
            titre: 'Les exploits',
            lignes: [
              { icone: 'medal' as const, texte: 'Un exploit se fait une fois, dans n’importe quelle expédition — même perdue ensuite. Il compte dès la suivante.' },
              ...EXPLOITS.map(x => ({ icone: ICONE_DE_L_EXPLOIT[x.cle], texte: `Exploit : ${x.but} — ${recompenseDe(x)}.` })),
            ],
          },
          // L'Ascension (le codex) : comment elle s'ouvre, le cran de celle-ci, et ce que chaque cran ajoute.
          {
            cle: 'ascension' as const,
            titre: 'L’Ascension',
            lignes: [
              { icone: 'mountain' as const, texte: 'Va au bout d’une expédition : l’Ascension s’ouvre. Choisis ton cran au départ ; une victoire à ton plus haut cran ouvre le suivant.' },
              ...(ascension > 0
                ? [{ icone: 'flag' as const, texte: ascension === 1 ? 'Ton expédition est au cran 1.' : `Ton expédition est au cran ${ascension} : les règles des crans 1 à ${ascension} s’ajoutent.` }]
                : []),
              ...ASCENSION.map(c => ({ icone: c.cran <= ascension ? ('check' as const) : ('mountain' as const), texte: `Cran ${c.cran} : ${regleDuCran(c.cran, v)}.` })),
            ],
          },
        ]
      : []),
    { cle: 'passeport', titre: 'Ton passeport', lignes: [{ icone: 'tampon', texte: 'Chaque thème pointu trouvé en expédition y met son tampon.' }] },
  ]
}

/**
 * Les règles de la question au centre (v10) : celles d'avant elle, réécrites
 * là où elle les change — la rencontre en crans, la main de l'acte, le pari et
 * ses cartes, cinq styles, deux fioles, l'Ascension retraduite. Le reste — le
 * plan, l'expédition, les récompenses, le codex, les exploits, le passeport —
 * ne change pas.
 */
function reglesEnQuestion(codex: CodexDesRegles | undefined, ascension: number, v: number): SectionDesRegles[] {
  const ouverte = (regle: RegleDuCodex) => !codex || codex.regles.includes(regle)
  // Les coups de pouce (v11) : la forme à composer et ses trois cartes ; une expédition de la version 10 ne les a pas.
  const aComposer = v >= VERSION_DES_COUPS_DE_POUCE
  // Les curiosités (v12) : une escale bonus par acte ; une expédition de la version 11 n'en a pas.
  const curiosites = v >= VERSION_DES_CURIOSITES
  // La frise (v13) : quatre événements à ranger ; une expédition de la version 12 n'en a pas.
  const enFrise = v >= VERSION_DE_LA_FRISE
  // Les familles (v14) : le second essai du Rempart, et la façon de répondre de chaque style ; une expédition de la version 13 n'en a pas.
  const familles = v >= VERSION_DES_FAMILLES
  const avant = reglesDesRencontres([CARTES_PAR_QUESTION, CARTES_PAR_QUESTION, CARTES_PAR_QUESTION], codex, ascension, [0, 0, 0], true, VERSION_DES_HUIT_FAMILLES)
  const neuves: Partial<Record<SectionDesRegles['cle'], SectionDesRegles | null>> = {
    rencontre: {
      cle: 'rencontre',
      titre: 'Une rencontre',
      lignes: [
        { icone: 'eye', texte: 'La question d’abord : tu la vois, puis tu choisis ta carte et ta réponse.' },
        {
          icone: 'check',
          texte: `Réponds juste : l’adversaire perd un cran — deux à six choix, ${aComposer ? 'à composer, ' : ''}${
            enFrise ? 'sur une frise, ' : ''
          }ou quand tu trouves une question mot à mot avant la moitié de ses mots. Sans crans, il tombe.`,
        },
        // Les coups de pouce (v11) : la question sans choix.
        ...(aComposer ? [{ icone: 'lettres' as const, texte: 'À composer : pas de choix — touche ses lettres dans l’ordre de la réponse. Trois sont de trop : les cartes qui effacent les retirent.' }] : []),
        // La frise (v13) : quatre événements dans l'ordre du temps.
        ...(enFrise
          ? [
              {
                icone: 'calendar' as const,
                texte: 'Une frise : quatre événements à remettre dans l’ordre, du plus ancien au plus récent — juste en entier. Les cartes qui effacent en datent, deux au plus.',
              },
            ]
          : []),
        { icone: 'sparkles', texte: 'Ses crans rayés, qui palpitent : ceux que ta bonne réponse lui prendrait, tes cartes comptées.' },
        { icone: 'heart', texte: 'Trompe-toi : il t’attaque, toujours autant — le chiffre à côté de ses crans —, et tu perds du courage.' },
        // Le second essai (v14) : le Rempart l'apporte.
        ...(familles
          ? [{ icone: 'rotate' as const, texte: 'Un second essai — les cartes du Rempart : ratée, ta réponse s’efface, rien n’est jugé, et tu réponds encore. Jamais sur un vrai ou faux.' }]
          : []),
        { icone: 'source', texte: 'Ton courage se regagne sur le plan : la source, le campement, l’échoppe, une fiole.' },
        { icone: 'x', texte: 'Plus de courage : l’expédition s’arrête là.' },
      ],
    },
    cartes: {
      cle: 'cartes',
      titre: 'Tes cartes',
      lignes: [
        { icone: 'target', texte: 'Une carte par question, la question sous les yeux : elle t’aide à répondre, ou fait perdre un cran de plus à l’adversaire.' },
        ...(aComposer
          ? [
              {
                icone: 'bulb' as const,
                texte:
                  'Les coups de pouce te soufflent la réponse : Le repère, son époque — sans époque, il efface ; La lettre, une de ses lettres ; L’initiale, la première. À composer, ces deux-là posent leurs lettres.',
              },
            ]
          : []),
        {
          icone: 'list',
          texte: `Ta main tire ${MAIN_A_L_OUVERTURE_DE_L_ACTE} cartes à l’ouverture de chaque acte, puis une après chaque question, ${mainMaxEnQuestion(false, ascension)} au plus : ce que tu ne joues pas, tu le gardes.`,
        },
        { icone: 'rotate', texte: 'Jouée, une carte part à ta défausse, qui revient à l’acte suivant : chaque carte sert une fois par acte — tes meilleures, réserve-les au gardien.' },
        { icone: 'infinity', texte: 'Une carte posée pour toute la rencontre se montre en haut de l’écran : touche-la pour la relire. La rencontre finie, elle rejoint ta défausse.' },
        { icone: 'eye', texte: 'Touche une carte : elle dit ce qu’elle fait, et ce qu’elle changerait.' },
        { icone: 'flag', texte: 'Une carte de route se joue sur le plan, une fois par acte.' },
      ],
    },
    style: codex
      ? {
          cle: 'style',
          titre: 'Ton style',
          lignes: [
            { icone: 'users', texte: 'Au départ, choisis ton style : une famille de cartes. Deux de ses cartes partent dans ton paquet, à la place de deux cartes de base.' },
            { icone: 'plus-square', texte: 'Chaque récompense propose une carte de ton style, une que tu n’as pas encore s’il en reste ; les deux autres viennent de partout.' },
            { icone: 'help', texte: 'Ton style ne fait pas tout : prends aussi de quoi t’aider sur les questions que tu ne sais pas.' },
            // Les familles (v14) : six styles, chacun sa façon de répondre (`jeuDuStyle`).
            ...stylesDeLaVersion(v).map(s => ({
              icone: ICONE_DU_STYLE[s],
              texte: `${FAMILLES_DE_CARTES[s].nom} — « ${FAMILLES_DE_CARTES[s].devise} » : ${(jeuDuStyle(s, v) ?? '').replace(/^./, x => x.toLowerCase())}${
                !codex.styles || codex.styles.includes(s) ? '' : ` Il s’ouvre au niveau ${niveauDuStyle(s, v)} d’explorateur.`
              }`,
            })),
          ],
        }
      : null,
    pari: {
      cle: 'pari',
      titre: 'Le pari',
      lignes: [
        ...(ouverte('pari') ? [] : [{ icone: 'lock' as const, texte: `Il s’ouvre ${ouvertAuNiveau('pari')}.` }]),
        { icone: 'ecu', texte: 'Avant de voir la question, parie des écus : juste, tu gagnes la moitié de ta mise ; faux, tu la perds.' },
        { icone: 'plus-square', texte: 'Les cartes du pari — Doubler la mise, Assurance, Banco… — se jouent là, avec lui : jouées la question vue, elles feraient parier à coup sûr.' },
        { icone: 'echoppe', texte: 'Tes écus se gagnent en battant tes adversaires et se dépensent à l’échoppe. Ils restent dans l’expédition.' },
      ],
    },
    fioles: codex
      ? {
          cle: 'fioles',
          titre: 'Les fioles',
          lignes: [
            ...(ouverte('fioles') ? [] : [{ icone: 'lock' as const, texte: `Elles s’ouvrent ${ouvertAuNiveau('fioles')}.` }]),
            { icone: 'fiole', texte: `Une fiole ne sert qu’une fois : bois-la quand tu veux, même la question sous les yeux. Tu en portes ${FIOLES_MAX} au plus.` },
            ...FIOLES_EN_QUESTION.map(f => ({ icone: 'fiole' as const, texte: `${f.nom} : ${f.effet}.` })),
            { icone: 'echoppe', texte: `L’échoppe en vend une, ${PRIX_DE_L_ECHOPPE.fiole} écus ; un coffre en cache une, à prendre à la place d’une carte.` },
          ],
        }
      : null,
    ascension: codex
      ? {
          cle: 'ascension',
          titre: 'L’Ascension',
          lignes: [
            { icone: 'mountain', texte: 'Va au bout d’une expédition : l’Ascension s’ouvre. Choisis ton cran au départ ; une victoire à ton plus haut cran ouvre le suivant.' },
            ...(ascension > 0
              ? [{ icone: 'flag' as const, texte: ascension === 1 ? 'Ton expédition est au cran 1.' : `Ton expédition est au cran ${ascension} : les règles des crans 1 à ${ascension} s’ajoutent.` }]
              : []),
            ...ascensionDe(v).map(c => ({ icone: c.cran <= ascension ? ('check' as const) : ('mountain' as const), texte: `Cran ${c.cran} : ${regleDuCran(c.cran, v)}.` })),
          ],
        }
      : null,
  }
  return avant.flatMap(s => {
    if (s.cle === 'ameliorees') {
      // Une amélioration ne baisse plus de coût : elle ajoute un cran, ou une carte.
      const [, ...reste] = s.lignes
      return [{ ...s, lignes: [{ icone: 'arrow-up' as const, texte: 'Une carte améliorée fait la même chose, en mieux : un cran de plus, une carte de plus… Son nom finit par « + ».' }, ...reste] }]
    }
    if (s.cle === 'plan' && curiosites) {
      // La curiosité, après le coffre : une escale de plus sur le plan, dite des mots de sa carte.
      const apres = s.lignes.findIndex(l => l.icone === 'coffre') + 1
      const ligne = {
        icone: 'utensils' as const,
        texte: `Une curiosité, une par acte : d’où vient un plat, ou un rébus en emojis à composer — sans adversaire ni cartes. Trouvée, ${ceQueRapporteUneCuriosite(ouverte('fioles'), ouverte('talismans'))} au choix ; ratée, rien de perdu.`,
      }
      return [{ ...s, lignes: [...s.lignes.slice(0, apres), ligne, ...s.lignes.slice(apres)] }]
    }
    if (!(s.cle in neuves)) return [s]
    const neuve = neuves[s.cle]
    return neuve ? [neuve] : []
  })
}

/** Le dessin de chaque exploit, dans les règles : ce qu'il faut faire. */
const ICONE_DE_L_EXPLOIT: Readonly<Record<CleDExploit, IconName>> = {
  'pari-de-40': 'ecu',
  'une-seule-reponse': 'swords',
  'd-affilee': 'check',
  'gardien-intact': 'crown',
}

/** Les règles d'une expédition d'avant les rencontres — trois vies, des jokers : celle de la production. */
function reglesDesJokers(): SectionDesRegles[] {
  const [premier, ...suivants] = MARCHES_DES_ACTES
  return [
    {
      cle: 'questions',
      titre: 'Les questions',
      lignes: [
        { icone: 'heart', texte: 'Trois vies : chaque erreur en coûte une.' },
        { icone: 'crown', texte: `Le gardien tombe à ta ${premier.aTrouver === 4 ? 'quatrième' : 'troisième'} bonne réponse à l’acte 1, à ta ${suivants[0]?.aTrouver === 4 ? 'quatrième' : 'troisième'} ensuite.` },
      ],
    },
    {
      cle: 'jokers',
      titre: 'Tes jokers',
      lignes: [
        { icone: 'plus-square', texte: 'À chaque question, ta main tire un joker, trois au plus. Un seul se joue par question.' },
        { icone: 'eye', texte: 'Touche un joker : il dit ce qu’il fait.' },
        { icone: 'rotate', texte: 'Joué, il revient à l’acte suivant.' },
      ],
    },
    {
      cle: 'expedition',
      titre: 'L’expédition',
      lignes: [
        { icone: 'crown', texte: 'Trois actes, un gardien au bout de chacun. Bats le troisième : tu repars avec l’un des trois.' },
        { icone: 'arrow-left', texte: '« ← Partir » ne perd rien : du départ, tu reprends ton expédition, ou tu l’abandonnes.' },
      ],
    },
    {
      cle: 'plan',
      titre: 'Le plan',
      lignes: [
        {
          icone: 'flag',
          texte:
            'À chaque pas, choisis ton escale. Son pourcentage, à la couleur d’une piste — verte, bleue, rouge, noire : tes chances sur sa question, celles d’un joueur moyen tant que tu n’as pas assez joué.',
        },
        { icone: 'eye', texte: 'Touche une escale, sur le plan ou en carte : ce qu’elle cache se lit sous les cartes.' },
        { icone: 'shuffle', texte: 'Un mélange : sa question tirée dans l’une de ses catégories, que sa carte montre en emblèmes.' },
        { icone: 'source', texte: 'Une source : une question de ton carnet, une vie si tu la retrouves.' },
        { icone: 'coffre', texte: 'Un coffre : un joker au choix.' },
        { icone: 'campement', texte: 'Un campement, avant le gardien : une vie, ou un joker de moins.' },
      ],
    },
    { cle: 'equipe', titre: 'Ton équipe', lignes: [{ icone: 'users', texte: 'Les légendaires que tu emmènes : le joker de chacun rejoint ton paquet.' }] },
    { cle: 'passeport', titre: 'Ton passeport', lignes: [{ icone: 'tampon', texte: 'Chaque thème pointu trouvé en expédition y met son tampon.' }] },
  ]
}

/**
 * Les règles, en feuille, de n'importe quelle page de l'expédition : ce que
 * les pages disaient en paragraphes, en une ligne par règle. `debut` : la
 * section à lire d'abord — le plan sur le plan, l'expédition au départ ;
 * en rencontre, l'ordre où l'on joue. Ouvertes d'elles-mêmes à la première
 * rencontre, avec « Compris » (`pied`).
 */
export function FeuilleDesRegles({
  rencontres,
  parQuestion,
  codex,
  ascension,
  energie,
  v,
  acte = 0,
  debut,
  pied,
  onFermer,
}: {
  rencontres: boolean
  /** Les cartes que chaque question tire, acte par acte (`CartesEnJeu.parQuestion`). */
  parQuestion?: readonly number[]
  /** Son codex (v7) : son départ, ou celui qui partirait. */
  codex?: CodexDesRegles
  /** Son cran de l'Ascension : celui de l'expédition en route (`CartesEnJeu.ascension`), ou celui qui partirait. */
  ascension?: number
  /** L'énergie de chaque acte, telle que la vue la dit (`CartesEnJeu.energie`) ; sans elle, celle d'une expédition qui partirait. */
  energie?: readonly number[]
  /** La version de son départ (`CartesEnJeu.v`) : ses cartes s'améliorent depuis le jeu complet ; sans elle, celle d'une expédition qui partirait. */
  v?: number
  /** L'acte où il en est : l'orbe de l'énergie dit la sienne. */
  acte?: number
  debut?: DebutDesRegles
  pied?: ReactNode
  onFermer: () => void
}) {
  const sonEnergie = energieDesActes(energie, ascension ?? 0)
  const version = v ?? VERSION_DES_HUIT_FAMILLES
  const sections = rencontres
    ? reglesDesRencontres(parQuestion ?? [CARTES_PAR_QUESTION, CARTES_PAR_QUESTION, CARTES_PAR_QUESTION], codex, ascension ?? 0, sonEnergie, version >= VERSION_DU_JEU_COMPLET, version)
    : reglesDesJokers()
  const ordre = debut ? [...sections.filter(s => s.cle === debut), ...sections.filter(s => s.cle !== debut)] : sections
  return (
    <Feuille titre="Les règles" className="feuille-regles" onFermer={onFermer} pied={pied}>
      {ordre.map(s => (
        <section key={s.cle} className="exp-regles-section" aria-labelledby={`exp-regles-${s.cle}`}>
          <h3 className="label" id={`exp-regles-${s.cle}`}>
            {s.titre}
          </h3>
          <ul className="exp-guide">
            {s.lignes.map(l => (
              <li key={l.texte}>
                <span className="exp-guide-icone" aria-hidden="true">
                  {/* L'énergie se montre telle que la main la montre : son orbe et son chiffre. */}
                  {l.icone === 'energie' ? <b className="exp-vc-cout">{sonEnergie[Math.min(Math.max(0, acte), sonEnergie.length - 1)]}</b> : <Icon name={l.icone} />}
                </span>
                <span>{espacesFines(l.texte)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Feuille>
  )
}

/** Le bouton des règles, en haut de chaque page de l'expédition : un point d'interrogation, et son mot là où la place le permet. */
export function BoutonDesRegles({ onOuvrir }: { onOuvrir: () => void }) {
  return (
    <button type="button" className="exp-regles" aria-haspopup="dialog" aria-label="Les règles" onClick={onOuvrir}>
      <Icon name="help" />
      <span className="exp-regles-mot" aria-hidden="true">
        Règles
      </span>
    </button>
  )
}

/**
 * La préparation d'une question (le cœur des rencontres), dans l'ordre où l'on
 * joue : l'adversaire et la question qu'il pose, ce que la réponse fera, les
 * cartes à jouer, le pari, puis « Voir la question » — le bouton au bout, plus
 * au-dessus des cartes qu'il fallait jouer avant lui. À la première
 * rencontre, les règles par-dessus ; ensuite, le « ? » de la barre. La
 * question, tirée au serveur, n'arrive qu'au geste qui la voit (invariant 1).
 */
export function PreparationDeLaRencontre({
  vue,
  r,
  barre,
  busy,
  erreur,
  onJouer,
  onVoir,
}: {
  vue: VueDeLExpedition
  r: VueDeLaRencontre
  /** La barre du haut : « ← Partir », les écus, le courage. */
  barre: ReactNode
  busy: boolean
  erreur: string
  onJouer: JouerUneCarte
  onVoir: (mise: number) => void
}) {
  const [mise, setMise] = useState(0)
  const [dit, setDit] = useState<string | null>(null)
  const [tas, setTas] = useState(false)
  const gardien = vue.gardiens[Math.min(vue.acte, vue.gardiens.length - 1)]?.cle ?? ''
  const refus = r.mises?.[mise] ?? null
  // La question au centre (v10) : l'annonce ne demande que le pari — ni tuiles, ni énergie ; de sa main, les cartes du pari, le reste éteint.
  const v10 = !!r.crans
  // L'aperçu à la mise choisie, par la règle du serveur : celui de la vue est à mise nulle, la mise n'étant dite qu'en voyant la question.
  // Dans la question au centre, il n'a plus ses tuiles : l'en-tête de l'adversaire le montre, ses crans qui palpitent.
  const apercu = apercuALaMise(r, mise, vue.fetiche) ?? r.apercu
  // Le même, sans les cartes de cette question : ce qu'elles y ajoutent se dit à part.
  const base = apercuALaMise({ ...r, charge: 0, garde: 0, jouees: [] }, mise, vue.fetiche)
  const motif = dit ?? refus
  const cles = r.main
  return (
    <div className="player-shell expedition exp-rencontre">
      {barre}
      {/* Un dévoilement trouvé tôt prend un cran de plus : à l'annonce, aucun mot n'est encore dit. */}
      <Adversaire r={r} gardien={gardien} acte={vue.acte} apercu={apercu} tot={r.annonce?.forme === 'devoilement'} />
      {apercu && !v10 && <Apercu a={apercu} base={base} />}
      {v10 && r.annonce?.forme === 'devoilement' && <p className="exp-consigne small">{espacesFines('Une question mot à mot : ses mots courent dès que tu la vois.')}</p>}
      {v10 && r.annonce?.forme === 'lettres' && <p className="exp-consigne small">{espacesFines('Une question à composer : pas de choix — ses lettres, à remettre dans l’ordre.')}</p>}
      {v10 && r.annonce?.forme === 'frise' && <p className="exp-consigne small">{espacesFines('Une frise : quatre événements à remettre dans l’ordre du temps.')}</p>}
      {(!v10 || cles.length > 0) && (
        <MainDeRencontre
          cles={cles}
          refus={r.refus}
          busy={busy}
          {...(!v10 && { inspiration: r.inspiration })}
          pile={{ compte: r.pioche, mot: 'pioche', dit: `Ta pioche : ${r.pioche} carte${r.pioche > 1 ? 's' : ''}, ta défausse : ${r.defausse.length}`, onOuvrir: () => setTas(true) }}
          apercuDeLaCarte={cle => changementDeLaCarte(r, mise, vue.fetiche, cle)}
          onJouer={onJouer}
        />
      )}
      {/* Le pari attend son niveau (le codex) : avant lui, la première expédition n'a que ses cartes, son énergie et son courage. */}
      {r.pari !== false && (
        <Paris
          mises={r.mises ?? {}}
          choisie={mise}
          onChoisir={(m, refusDeM) => {
            setDit(refusDeM)
            if (refusDeM === null) setMise(m)
          }}
        />
      )}
      {/* Sans les tuiles de l'aperçu (v10), ce que le pari choisi rapporte et coûte se dit sous lui, de la règle du verdict. */}
      {v10 && mise > 0 && apercu && (
        <p className="exp-consigne small" role="status">
          {espacesFines(`Juste, +${apercu.juste.ecus} écus ; raté, −${apercu.faux.ecus}.`)}
        </p>
      )}
      {motif && (
        <p className="exp-refus small" role="status">
          {espacesFines(motif)}
        </p>
      )}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-big btn-block exp-voir" aria-disabled={busy || refus !== null || undefined} onClick={() => !busy && refus === null && onVoir(mise)}>
        <Icon name="eye" />
        Voir la question
      </button>
      {tas && <FeuilleDesCartes paquet={vue.cartes?.paquet ?? []} rencontre={r} acte={mainDeLActe(vue)} ascension={vue.cartes?.ascension} energie={vue.cartes?.energie} onFermer={() => setTas(false)} />}
      <GuideDesRencontres vue={vue} />
    </div>
  )
}

/** La main de l'acte (la question au centre, v10), telle que la feuille des tas la lit ; undefined avant elle. */
export const mainDeLActe = (vue: Pick<VueDeLExpedition, 'cartes'>) => {
  const c = vue.cartes
  return c?.main && c.defausse && c.mainMax !== undefined ? { main: c.main, defausse: c.defausse, mainMax: c.mainMax } : undefined
}

/**
 * Les règles, ouvertes d'elles-mêmes à la première rencontre, avec
 * « Compris » — à l'annonce, ou, dans la question au centre (v10), qui n'en a
 * pas sans le pari, sur la question même. Fermées d'une façon ou d'une autre,
 * elles sont vues : revenues à chaque rencontre, elles lasseraient.
 */
export function GuideDesRencontres({ vue }: { vue: VueDeLExpedition }) {
  const [aide, setAide] = useState(() => !guideVu())
  const vu = () => {
    retenirLeGuide()
    setAide(false)
  }
  if (!aide) return null
  return (
    <FeuilleDesRegles
      rencontres
      parQuestion={vue.cartes?.parQuestion}
      codex={vue.cartes?.codex}
      ascension={vue.cartes?.ascension}
      energie={vue.cartes?.energie}
      v={vue.cartes?.v}
      acte={vue.acte}
      onFermer={vu}
      pied={
        <button type="button" className="btn btn-primary btn-block" onClick={vu}>
          Compris
        </button>
      }
    />
  )
}

/**
 * Ce qu'une réponse vient de faire en rencontre, à la révélation, en clair :
 * le titre — ce qu'il a perdu, l'adversaire qui tombe, ce qu'il t'a pris — et
 * ses lignes — le bouclier, la riposte, le pari, la victoire.
 */
export function verdictDeLaRencontre(c: CoupDeRencontre, adversaire: string, finie: boolean, enCrans = false): { titre: string; lignes: string[] } {
  if (enCrans) return verdictEnCrans(c, adversaire, finie)
  // Son doute (les huit familles) : ce qu'il a perdu avant le verdict, juste ou faux — compté avec ce que la réponse a brisé.
  const doute = c.doute ?? 0
  if (c.traversee) return { titre: 'Question passée : personne ne perd rien', lignes: [doute > 0 && `Son doute lui a coûté ${doute}`, 'Elle part à ton carnet.'].filter((x): x is string => !!x) }
  if (c.juste) {
    return {
      titre: c.victoire ? `${adversaire} tombe !` : `Juste ! ${adversaire} perd ${doute + c.brises}`,
      lignes: [
        c.victoire && `Il a perdu ${doute + c.brises} d’un coup`,
        doute > 0 && `Dont ${doute} de son doute`,
        c.mise > 0 && `+${c.mise} écus gagnés avec ton pari`,
        (c.ecus ?? 0) > 0 && `+${c.ecus} écus de tes cartes`,
        (c.courage ?? 0) > 0 && `+${c.courage} de courage, grâce à tes cartes`,
        c.victoire && c.victoire.ecus > 0 && `+${c.victoire.ecus} écus de victoire`,
        c.victoire && c.victoire.courage > 0 && `+${c.victoire.courage} de courage, grâce à L’aube`,
      ].filter((x): x is string => !!x),
    }
  }
  // Tombé de son doute avant de frapper : la riposte n'y est pour rien, l'attaque n'a pas eu lieu.
  const tombeDuDoute = !!c.victoire && doute > 0 && c.frappe === 0 && c.brises === 0
  const titre = finie
    ? 'Raté… tu n’as plus de courage'
    : c.renaissance
      ? `Raté… Renaissance : tu renais avec ${COURAGE_DE_LA_RENAISSANCE} de courage`
      : tombeDuDoute
        ? `Raté… mais son doute fait tomber ${adversaire} !`
        : c.frappe === 0
          ? 'Raté… mais il ne t’attaque pas'
          : c.perdu === 0
            ? 'Raté… ton bouclier a tout paré'
            : `Raté… tu perds ${c.perdu} de courage`
  return {
    titre,
    lignes: [
      !tombeDuDoute && doute > 0 && `Son doute lui a coûté ${doute}`,
      c.frappe > 0 && c.absorbee > 0 && c.perdu > 0 && `Ton bouclier a paré ${c.absorbee} de son attaque de ${c.frappe}`,
      c.brises > 0 && `Riposte : ${adversaire} perd ${c.brises}`,
      c.mise < 0 && `−${-c.mise} écus : ton pari est perdu`,
      c.victoire && !tombeDuDoute && `${adversaire} tombe quand même !`,
    ].filter((x): x is string => !!x),
  }
}

/**
 * Le verdict de la question au centre (v10), en crans : « Juste ! Le Scribe
 * perd un cran », « Le Scribe tombe ! », « Raté… tu perds 6 de courage » — plus
 * de ligne de calcul, ses crans disent ce qu'il reste à faire.
 */
function verdictEnCrans(c: CoupDeRencontre, adversaire: string, finie: boolean): { titre: string; lignes: string[] } {
  const crans = (n: number) => (n === 1 ? 'un cran' : `${n} crans`)
  if (c.traversee) return { titre: 'Question passée : personne ne perd rien', lignes: ['Elle part à ton carnet.'] }
  if (c.juste) {
    // Les familles (v14) : les cartes qui reviennent dans sa main — Foulée, le Rythme, Vent arrière —, dites par leur nom.
    const revenues = (c.revenues ?? []).map(cle => carteDeRencontre(cle)?.nom ?? cle)
    return {
      titre: c.victoire ? `${adversaire} tombe !` : `Juste ! ${adversaire} perd ${crans(c.brises)}`,
      lignes: [
        c.victoire && c.brises > 1 && `Il a perdu ${crans(c.brises)} d’un coup`,
        c.mise > 0 && `+${c.mise} écus gagnés avec ton pari`,
        (c.ecus ?? 0) > 0 && `+${c.ecus} écus de tes cartes`,
        c.victoire && c.victoire.ecus > 0 && `+${c.victoire.ecus} écus de victoire`,
        revenues.length > 0 && `${revenues.join(' et ')} ${revenues.length > 1 ? 'reviennent' : 'revient'} dans ta main`,
      ].filter((x): x is string => !!x),
    }
  }
  const titre = finie
    ? 'Raté… tu n’as plus de courage'
    : c.renaissance
      ? 'Raté… Renaissance : ton erreur ne te coûte rien'
      : c.perdu === 0
        ? 'Raté… mais il ne t’attaque pas'
        : `Raté… tu perds ${c.perdu} de courage`
  // Troisième œil et Inarrêtable (v14) retombent : la barre ne les porte plus, la ligne dit pourquoi.
  const retombees = (c.retombees ?? []).map(cle => carteDeRencontre(cle)?.nom ?? cle)
  return {
    titre,
    lignes: [
      c.mise < 0 && `−${-c.mise} écus : ton pari est perdu`,
      (c.ecus ?? 0) < 0 && `−${-(c.ecus ?? 0)} écus : ta mise est perdue`,
      retombees.length > 0 && `${retombees.join(' et ')} ${retombees.length > 1 ? 'retombent' : 'retombe'} dans ta défausse`,
    ].filter((x): x is string => !!x),
  }
}

/** Ce qu'une carte jouée vient de faire, quand l'écran ne le montre pas de lui-même ; null : il le dit déjà. À la version de son départ : la question au centre (v10) en a d'autres. */
export function ceQueLaCarteAFait(cle: string, v = VERSION_DES_HUIT_FAMILLES): string | null {
  const c = carteALaVersion(cle, v)
  if (!c) return null
  if (enQuestion(v)) {
    // Les familles (v14) : la Bibliothèque change aussi de question — un pouvoir qui ne se dirait que posé cacherait l'autre question ;
    // Troisième œil et Inarrêtable ne tiennent que jusqu'à la prochaine erreur.
    if (baseDe(cle) === 'bibliotheque' && v >= VERSION_DES_FAMILLES) return 'Une autre question, de ta catégorie fétiche — et les suivantes de la rencontre aussi'
    if (baseDe(cle) === 'troisieme-oeil' && v >= VERSION_DES_FAMILLES) return `« ${c.nom} » souffle jusqu’à ta prochaine erreur`
    if (baseDe(cle) === 'inarretable' && v >= VERSION_DES_FAMILLES) return `« ${c.nom} » pardonne ta prochaine erreur`
    if (c.moment === 'pouvoir') return `« ${c.nom} » agit pour toute la rencontre`
    if (cle === 'feu-d-artifice') return 'Ta défausse revient dans ta pioche : ta main se remplit'
    if (cle === 'horizon') return 'Ton erreur est effacée — et ta prochaine récompense sera vide'
    if (cle === 'reveil') return 'La dernière carte de ta défausse revient dans ta main'
    if (baseDe(cle) === 'augure') return 'À la question suivante, une mauvaise réponse sera effacée d’avance'
    // Les familles (v14) : Leçon change de question, comme Échange — l'écran ne dit pas d'où vient l'autre.
    if (baseDe(cle) === 'lecon' && v >= VERSION_DES_FAMILLES) return 'Une autre question, de ta catégorie fétiche'
    return null
  }
  if (c.moment === 'pouvoir') return cle === 'abysses' ? `« ${c.nom} » est posée : elle t’a coûté 6 de courage` : `« ${c.nom} » agit pour toute la rencontre`
  if (baseDe(cle) === 'pioche') return c.amelioree ? 'Trois cartes de plus dans ta main' : 'Deux cartes de plus dans ta main'
  if (cle === 'feu-d-artifice') return 'Ta défausse revient dans ta pioche : trois cartes de plus'
  if (cle === 'horizon') return 'Ton courage te revient — et ta prochaine récompense sera vide'
  if (cle === 'reveil') return 'Deux d’énergie de plus pour cette question'
  // Les huit familles : ce qu'il a payé de son courage pour la jouer.
  const prix = courageDeLaCarte(cle)
  if (prix > 0) return `« ${c.nom} » t’a coûté ${prix} de courage`
  return null
}

// ── Le départ ──────────────────────────────────────────────────────────────

/**
 * Sa catégorie fétiche : retenue sur le téléphone, sous try/catch — un
 * stockage refusé ne doit rien bloquer. Le choix de partir aux rencontres,
 * qu'on retenait à côté (`quizz.expedition.rencontres`), n'est plus lu :
 * elles sont le jeu, et un « non » d'avant ne les coupe plus.
 */
const CLE_DE_LA_FETICHE = 'quizz.expedition.fetiche'

export function feticheRetenue(): string | null {
  try {
    const lue = localStorage.getItem(CLE_DE_LA_FETICHE)
    return lue && (CATEGORIES as readonly string[]).includes(lue) ? lue : null
  } catch {
    return null
  }
}

export function retenirLaFetiche(fetiche: string | null) {
  try {
    if (fetiche) localStorage.setItem(CLE_DE_LA_FETICHE, fetiche)
    else localStorage.removeItem(CLE_DE_LA_FETICHE)
  } catch {
    // Un stockage refusé : le prochain départ repartira sans catégorie fétiche.
  }
}

/** Le dos de son paquet, choisi au départ : retenu sur le téléphone, sous try/catch. */
const CLE_DU_DOS = 'quizz.expedition.dos'

/**
 * Le dos qui partira : celui qu'il a choisi la dernière fois, s'il l'a encore
 * — un téléphone partagé retient celui d'un autre profil —, sinon le plus
 * rare des siens, celui que le serveur prendrait.
 */
export function dosRetenu(siens: readonly DosDuPaquet[]): DosDuPaquet | null {
  try {
    const lu = localStorage.getItem(CLE_DU_DOS)
    if (lu && (siens as readonly string[]).includes(lu)) return lu as DosDuPaquet
  } catch {
    // Un stockage refusé : le plus rare, comme sans choix.
  }
  return siens[siens.length - 1] ?? null
}

export function retenirLeDos(dos: DosDuPaquet) {
  try {
    localStorage.setItem(CLE_DU_DOS, dos)
  } catch {
    // Un stockage refusé : le prochain départ reprendra le plus rare.
  }
}

/** Le dos de son paquet, au départ : ceux qu'il a, en vraies pioches — celui qui partira, souligné. Seul, il n'y a rien à choisir. */
export function ChoixDuDos({ siens, dos, onChoisir }: { siens: readonly DosDuPaquet[]; dos: DosDuPaquet | null; onChoisir: (dos: DosDuPaquet) => void }) {
  if (siens.length < 2) return null
  return (
    <div className="exp-choix-du-dos" role="radiogroup" aria-label="Le dos de ton paquet">
      <span className="label">Le dos de ton paquet</span>
      {siens.map(d => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={dos === d}
          aria-label={dosDe(d)?.nom ?? d}
          className={'exp-pioche exp-dos-miniature' + classeDuDos(d)}
          onClick={() => onChoisir(d)}
        />
      ))}
    </div>
  )
}

/** Son cran de l'Ascension, choisi au départ : retenu sur le téléphone, sous try/catch — `haut`, s'il partait au plus haut des siens. */
const CLE_DE_L_ASCENSION = 'quizz.expedition.ascension'

/**
 * Le cran qui partira : celui qu'il a choisi la dernière fois, borné à ceux
 * qu'il a ouverts — un téléphone partagé retient celui d'un autre profil —,
 * ou le plus haut, s'il y était : la victoire qui ouvre le suivant l'y mène,
 * comme on monte. Rien de retenu, aucun cran : l'Ascension se choisit, elle ne
 * durcit l'expédition de personne d'office.
 */
export function ascensionRetenue(ouverte: number): number {
  try {
    const lu = localStorage.getItem(CLE_DE_L_ASCENSION)
    if (lu === 'haut') return ouverte
    const n = lu === null ? 0 : Number(lu)
    return Number.isInteger(n) ? Math.min(Math.max(0, n), ouverte) : 0
  } catch {
    return 0
  }
}

export function retenirLAscension(cran: number, ouverte: number) {
  try {
    localStorage.setItem(CLE_DE_L_ASCENSION, cran > 0 && cran >= ouverte ? 'haut' : String(cran))
  } catch {
    // Un stockage refusé : le prochain départ repartira sans cran.
  }
}

/**
 * L'Ascension, au départ (le codex), une fois une expédition menée au bout :
 * ses crans ouverts — « Sans », puis un par victoire à son plus haut —, et ce
 * que le cran choisi ajoute, une ligne par règle, celles d'en dessous
 * comprises. Au plus haut, ce qu'une victoire ouvrirait : c'est tout son prix.
 */
export function ChoixDeLAscension({ ouverte, cran, onChoisir }: { ouverte: number; cran: number; onChoisir: (cran: number) => void }) {
  // Les crans de sa version : la question au centre les retraduit en bonnes réponses et en cartes.
  const crans = ascensionDe(useContext(VersionDesCartes))
  return (
    <section className="card exp-ascension" aria-labelledby="exp-ascension-titre">
      <h2 className="label" id="exp-ascension-titre">
        L’Ascension
      </h2>
      {/* Sous le titre, pas à côté : six pastilles et « L'Ascension » ne tiennent pas sur une ligne en 360. Une pastille dit son
          état comme toutes les autres, `aria-pressed`, sous un nom qui ne change pas — « Cran 2 » à l'oreille (`design.test.ts`). */}
      <div className="exp-crans-d-ascension" role="group" aria-labelledby="exp-ascension-titre">
        {Array.from({ length: ouverte + 1 }, (_, i) => (
          <button key={i} type="button" aria-pressed={cran === i} className={'pill-btn' + (cran === i ? ' active' : '')} onClick={() => onChoisir(i)}>
            {i === 0 ? (
              <>
                Sans<span className="sr-only"> cran</span>
              </>
            ) : (
              <>
                <span className="sr-only">Cran </span>
                {i}
              </>
            )}
          </button>
        ))}
      </div>
      {cran === 0 ? (
        <p className="muted small">{espacesFines('Sans cran : l’expédition de toujours.')}</p>
      ) : (
        <ul className="exp-regles-du-cran">
          {crans.slice(0, cran).map(c => (
            <li key={c.cran}>
              <Icon name="mountain" />
              <span>{espacesFines(`${c.regle}.`)}</span>
            </li>
          ))}
        </ul>
      )}
      {cran > 0 && cran === ouverte && ouverte < ASCENSION_MAX && <p className="muted small">{espacesFines(`Va au bout à ce cran : le cran ${ouverte + 1} s’ouvre.`)}</p>}
    </section>
  )
}

/**
 * Au départ, sa catégorie fétiche, que l'Érudit fait vivre — une fois le
 * niveau qui l'ouvre atteint (`codex.regles`, le codex) : avant lui, rien à
 * choisir, et rien ne s'affiche. Le départ ne demande plus s'il part aux
 * rencontres (un interrupteur, « prototype », jusqu'au 19 octobre 2026) :
 * c'est le jeu. Ce que sont les rencontres se lit dans les règles.
 */
export function FeticheDuDepart({ fetiche, onFetiche }: { fetiche: string | null; onFetiche: (categorie: string | null) => void }) {
  const [choisir, setChoisir] = useState(false)
  return (
    <section className="card exp-fetiche-du-depart">
      <div className="exp-section-tete">
        <span className="small">
          {'Ta catégorie fétiche : '}
          <b>{fetiche ?? 'aucune'}</b>
        </span>
        <button type="button" className="link-inline small exp-changer" aria-haspopup="dialog" onClick={() => setChoisir(true)}>
          {fetiche ? 'Changer' : 'Choisir'}
          <Icon name="chevron-right" />
        </button>
      </div>
      {choisir && <FeuilleDeLaFetiche fetiche={fetiche} onChoisir={onFetiche} onFermer={() => setChoisir(false)} />}
    </section>
  )
}

/** Son style, choisi au départ : retenu sur le téléphone, sous try/catch — un stockage refusé ne doit rien bloquer. */
const CLE_DU_STYLE = 'quizz.expedition.style'

/**
 * Le style qui partira : celui de la dernière fois, s'il l'a encore — un
 * téléphone partagé retient celui d'un autre profil —, sinon le premier des
 * siens, celui que le serveur prendrait.
 */
export function styleRetenu(siens: readonly StyleDeJeu[]): StyleDeJeu | null {
  try {
    const lu = localStorage.getItem(CLE_DU_STYLE)
    if (lu && (siens as readonly string[]).includes(lu)) return lu as StyleDeJeu
  } catch {
    // Un stockage refusé : le premier des siens, comme sans choix.
  }
  return siens[0] ?? null
}

export function retenirLeStyle(style: StyleDeJeu) {
  try {
    localStorage.setItem(CLE_DU_STYLE, style)
  } catch {
    // Un stockage refusé : le prochain départ reprendra le premier des siens.
  }
}

/** Le dessin de chaque style, sur sa pastille au départ et dans les règles. L'éclair est à l'énergie : aucun ne le prend. */
export const ICONE_DU_STYLE: Readonly<Record<StyleDeJeu, IconName>> = {
  rempart: 'shield',
  erudit: 'book',
  devin: 'eye',
  flambeur: 'ecu',
  elan: 'skip',
  metamorphe: 'shuffle',
  sophiste: 'bulles',
  temeraire: 'swords',
}

/** Le nom d'un style sans son article, sur sa tuile : « Rempart », « Érudit ». */
const nomCourtDuStyle = (style: StyleDeJeu) => FAMILLES_DE_CARTES[style].nom.replace(/^(Le |La |L’)/, '')

/** Les cartes de base au masculin, et leur pluriel quand un « s » au bout ne le fait pas : la question au centre (v10) remplace des Coups d'œil. */
const BASES_AU_MASCULIN: ReadonlySet<string> = new Set(['coup-d-oeil', 'echange', 'sursis'])
const PLURIEL_D_UNE_BASE: Readonly<Record<string, string>> = { 'coup-d-oeil': 'Coups d’œil' }

/** Les cartes de base que ses deux cartes remplacent, à la version du départ : « deux Concentrations », « une Concentration et un Coup d'œil ». */
function basesRemplacees(style: StyleDeJeu, v: number): string {
  const remplacees = enQuestion(v) ? BASES_REMPLACEES_EN_QUESTION[style] : BASES_REMPLACEES_PAR_LE_STYLE[style]
  if (!remplacees) return ''
  const [x, y] = remplacees
  const nom = (cle: string) => carteDeRencontre(cle)?.nom ?? cle
  const article = (cle: string) => (BASES_AU_MASCULIN.has(cle) ? 'un' : 'une')
  return x === y ? `deux ${PLURIEL_D_UNE_BASE[x] ?? `${nom(x)}s`}` : `${article(x)} ${nom(x)} et ${article(y)} ${nom(y)}`
}

/**
 * « Ton style », au départ (le 19 octobre 2026 : « Pour les cartes il faut
 * vraiment plus de gameplay différents […] j'ai l'impression de piocher tout
 * le temps la même chose et de pas avoir à choisir de style de jeu ») : une
 * famille parmi celles que son codex ouvre, en pastilles à sa teinte. Sous
 * elles, celle qui partira — sa devise, sa façon de gagner, ses deux cartes
 * de départ —, et pour l'Érudit, sa catégorie fétiche. Le style qui s'ouvre
 * ensuite se dit en une ligne : on sait ce qu'on gagnera en jouant.
 */
export function ChoixDuStyle({
  styles,
  style,
  onChoisir,
  fetiche,
  feticheOuverte,
  onFetiche,
  prochain,
}: {
  styles: readonly StyleDeJeu[]
  style: StyleDeJeu
  onChoisir: (style: StyleDeJeu) => void
  fetiche: string | null
  feticheOuverte: boolean
  onFetiche: (categorie: string | null) => void
  /** Le prochain style à s'ouvrir, et son niveau ; rien quand il les a tous. */
  prochain?: { style: StyleDeJeu; niveau: number }
}) {
  const [choisir, setChoisir] = useState(false)
  const v = useContext(VersionDesCartes)
  const famille = FAMILLES_DE_CARTES[style]
  const [a, b] = CARTES_DE_DEPART_DU_STYLE[style].map(cle => carteDeRencontre(cle)?.nom ?? cle)
  return (
    <section className="card exp-style" aria-labelledby="exp-style-titre">
      <h2 className="label" id="exp-style-titre">
        Ton style
      </h2>
      <div className="exp-styles" role="radiogroup" aria-labelledby="exp-style-titre">
        {styles.map(s => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === style}
            className="exp-un-style"
            style={{ '--famille': TEINTE_DE_LA_FAMILLE[s] } as CSSProperties}
            onClick={() => onChoisir(s)}
          >
            <Icon name={ICONE_DU_STYLE[s]} />
            <span>{nomCourtDuStyle(s)}</span>
          </button>
        ))}
      </div>
      <p className="exp-style-dit">
        <b>{espacesFines(`${famille.nom} · « ${famille.devise} »`)}</b> {espacesFines(jeuDuStyle(style, v) ?? '')}
      </p>
      <p className="muted small">{espacesFines(`Tu pars avec ${a} et ${b}, à la place de ${basesRemplacees(style, v)} ; chaque récompense propose une carte de ton style.`)}</p>
      {style === 'erudit' && feticheOuverte && (
        <div className="exp-section-tete">
          <span className="small">
            {'Ta catégorie fétiche : '}
            <b>{fetiche ?? 'aucune'}</b>
          </span>
          <button type="button" className="link-inline small exp-changer" aria-haspopup="dialog" onClick={() => setChoisir(true)}>
            {fetiche ? 'Changer' : 'Choisir'}
            <Icon name="chevron-right" />
          </button>
        </div>
      )}
      {prochain && <p className="muted small exp-style-prochain">{espacesFines(`${FAMILLES_DE_CARTES[prochain.style].nom} s’ouvre au niveau ${prochain.niveau}.`)}</p>}
      {choisir && <FeuilleDeLaFetiche fetiche={fetiche} onChoisir={onFetiche} onFermer={() => setChoisir(false)} />}
    </section>
  )
}

/** Sa catégorie fétiche, en feuille : les douze, leur emblème ; touchée encore, plus aucune. Rien ne change avant « Choisir ». */
function FeuilleDeLaFetiche({ fetiche, onChoisir, onFermer }: { fetiche: string | null; onChoisir: (categorie: string | null) => void; onFermer: () => void }) {
  const [choisie, setChoisie] = useState(fetiche)
  return (
    <Feuille
      titre="Ta catégorie fétiche"
      className="feuille-fetiche"
      onFermer={onFermer}
      pied={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            onChoisir(choisie)
            onFermer()
          }}
        >
          {choisie ? `Choisir · ${choisie}` : 'Partir sans catégorie fétiche'}
        </button>
      }
    >
      <p className="muted small">{espacesFines('L’Érudit en vit : Plume et Bibliothèque font perdre plus à l’adversaire quand tu réponds juste sur ta catégorie fétiche.')}</p>
      <div className="exp-fetiches" role="radiogroup" aria-label="Ta catégorie fétiche">
        {CATEGORIES.map(x => (
          <button key={x} type="button" role="radio" aria-checked={choisie === x} className={'exp-fetiche' + (choisie === x ? ' exp-choisi' : '')} onClick={() => setChoisie(choisie === x ? null : x)}>
            <Icon name={EMBLEME[x] ?? 'help'} />
            <span>{x}</span>
          </button>
        ))}
      </div>
    </Feuille>
  )
}

/**
 * Toutes les cartes des rencontres, dans la feuille de l'équipée : les
 * neutres, puis chaque famille — sa devise, ses deux cartes, et celles des
 * légendaires qui l'apportent : à lui, l'invité du jour, ou à gagner.
 */
export function ToutesLesCartes({ siens, invite }: { siens: ReadonlySet<string>; invite: string }) {
  const ligne = (c: CarteDeRencontre) => (
    <li key={c.cle} className="exp-joker-du-catalogue">
      <span className="exp-offre-visage" style={gemmeDeLaCarte(c)} aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="exp-joker">
        <b>{c.nom}</b>
        <span className="muted small">
          {[
            // L'équipe ne se choisissait qu'avant le codex : ses cartes se disent à leurs chiffres d'alors.
            c.moment !== 'route' && coutDit(c, VERSION_DES_HUIT_FAMILLES),
            MOMENT_COURT[c.moment],
            RARETE_DE_LA_CARTE[c.rarete],
            c.legendaire && (siens.has(c.legendaire) ? 'à toi' : c.legendaire === invite ? 'l’invité du jour' : `${nomDuGardien(c.legendaire)}, à gagner`),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="small">{espacesFines(c.effet)}</span>
      </span>
    </li>
  )
  const familles = Object.keys(FAMILLES_DE_CARTES).filter((f): f is FamilleDeCartes => f !== 'neutre')
  return (
    <div id="exp-toutes-les-cartes" className="exp-catalogue">
      <h3 className="label">{`${FAMILLES_DE_CARTES.neutre.nom} · ${FAMILLES_DE_CARTES.neutre.devise}`}</h3>
      <ul>{CARTES_DES_RENCONTRES.filter(c => c.famille === 'neutre').map(ligne)}</ul>
      {familles.map(f => (
        <section key={f}>
          <h3 className="label">{`${FAMILLES_DE_CARTES[f].nom} · « ${FAMILLES_DE_CARTES[f].devise} »`}</h3>
          <ul>{CARTES_DES_RENCONTRES.filter(c => c.famille === f).map(ligne)}</ul>
        </section>
      ))}
    </div>
  )
}

/** Ce qu'une carte montre dans une ligne d'offre ou d'étal : son visage au cadre de sa rareté, son nom et sa rareté, son effet, quand elle se joue. */
export function LigneDeCarte({ c, prix }: { c: CarteDeRencontre; prix?: ReactNode }) {
  const v = useContext(VersionDesCartes)
  return (
    <>
      <span className="exp-offre-visage" style={gemmeDeLaCarte(c)} aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="exp-joker">
        <span className="exp-offre-nom">
          <b>{c.nom}</b>
          <span className={`exp-rarete exp-rarete-${c.rarete}`} style={gemmeDeLaCarte(c)}>
            {RARETE_DE_LA_CARTE[c.rarete]}
          </span>
        </span>
        <span className="small">{espacesFines(c.effet)}</span>
        <span className="muted small">{espacesFines([c.moment !== 'route' && coutDit(c, v), momentDit(c.moment, v)].filter(Boolean).join(' · '))}</span>
      </span>
      {prix}
    </>
  )
}

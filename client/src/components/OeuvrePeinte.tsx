import type { CSSProperties, ReactNode } from 'react'
import { Dessin } from './Avatar'
import { CARTES_PEINTES } from './cartes-peintes'
import { espacesFines } from '../format'
import { GEMME_MAUDITE, gemme } from '../gemmes'
import type { RareteDeTheme } from '../../../shared/themes'
// Des types seulement : ils s'effacent à la compilation, et la page qui montre
// une œuvre ne télécharge pas les règles des rencontres (`cartes-peintes.test.ts`).
import type { CarteDeRencontre, FamilleDeCartes } from '../../../shared/rencontres'

// L'œuvre peinte : la carte dessinée de l'Expédition (`CarteDessinee`,
// `views/RencontresDExpedition.tsx`), sortie d'elle le 25 octobre 2026 pour le
// Cabinet de curiosités, dont les œuvres sont ces mêmes cartes peintes. Le
// cadre, sa fenêtre, sa peinture, son nom et sa gemme vivent ici seulement ;
// l'Expédition y ajoute ce qu'elle joue — l'orbe du coût, le chiffre, la
// phrase, le « + » d'une carte améliorée —, et `RencontresDExpedition.tsx`,
// qui tire tout `shared/rencontres.ts`, le codex et l'expédition, ne part pas
// avec la page qui ne fait que montrer une œuvre. Ses classes restent celles de
// la carte (`exp-vc-*`, la section « Les rencontres » de `styles.css`) : un
// cadre retouché l'est des deux côtés.

/**
 * Où l'œuvre se range, ce qui fait sa teinte : la famille de sa carte, ou la
 * salle du Cabinet de curiosités qui l'expose — les huit salles de famille
 * portent la clé de leur famille, et le Vestibule, qui expose les neutres,
 * prend leur teinte. Le Cabinet passe sa salle telle quelle : traduite à la
 * main ou forcée en famille, le Vestibule n'aurait plus de teinte, sans un
 * bruit — React omet un `--famille` indéfini, et chaque `color-mix` de la
 * fenêtre tombe.
 */
export type FamilleDOeuvre = FamilleDeCartes | 'vestibule'

/**
 * Ce qu'une peinture montre d'une œuvre : la clé de sa peinture
 * (`CARTES_PEINTES` — celle de sa carte, sans le « + » d'une améliorée), son
 * nom, sa famille ou sa salle, sa rareté, et le légendaire qu'elle montre à
 * la place d'une peinture — une carte de légendaire, un gardien.
 */
export type OeuvreMontree = Pick<CarteDeRencontre, 'cle' | 'nom' | 'rarete' | 'legendaire'> & { famille: FamilleDOeuvre }

/**
 * Les raretés d'une carte des rencontres — celles d'une œuvre du Cabinet en
 * sont, sans la légendaire, qui est aux gardiens —, lues en type seulement :
 * effacé à la compilation, il ne fait pas télécharger les règles des
 * rencontres à la page qui montre une œuvre.
 */
export type RareteDOeuvre = OeuvreMontree['rarete']

/** Sa taille : en petit, sans un mot (la main) ; dans une rangée, son nom ; levée, en grand. */
export type TailleDOeuvre = 'main' | 'rangee' | 'levee'

/**
 * La couleur d'une rareté, au cadre : sa gemme — celle des jokers, de l'album
 * et de la boutique (`gemmes.ts`) ; l'épique, depuis le jeu complet, le
 * pourpre de l'album, et une maudite son rouge sombre (`GEMME_MAUDITE`). Une
 * seule couleur par rareté dans toute l'application.
 */
const GEMME_DE_LA_RARETE: Record<Exclude<RareteDOeuvre, 'maudit'>, RareteDeTheme> = { commun: 'commune', rare: 'rare', epique: 'epique', legendaire: 'legendaire' }
export const gemmeDeLaRarete = (r: RareteDOeuvre) => (r === 'maudit' ? GEMME_MAUDITE : gemme(GEMME_DE_LA_RARETE[r]))

/** Sa rareté, accordée à « carte » comme à « œuvre ». */
export const RARETE_DITE: Record<RareteDOeuvre, string> = { commun: 'commune', rare: 'rare', epique: 'épique', maudit: 'maudite', legendaire: 'légendaire' }

/**
 * La teinte de chaque famille, au fond de l'illustration — la rareté, elle,
 * est au cadre (`--gemme`) : comme les couleurs d'un personnage de Slay the
 * Spire et l'or de ses cartes rares. Une convention, écrite en dur : aucun
 * thème ne la repeint (règle `css.md`). La chaîne de peinture y accorde la
 * palette de chaque illustration (`server/scripts/anime/cartes.ts`).
 */
export const TEINTE_DE_LA_FAMILLE: Record<FamilleDeCartes, string> = {
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

const teinteDe = (f: FamilleDOeuvre) => TEINTE_DE_LA_FAMILLE[f === 'vestibule' ? 'neutre' : f]

/**
 * L'or du cadre doré (le Cabinet : trois manches parfaites sans qu'un pouvoir
 * ait servi, ou de la poussière d'or). Écrit en dur, comme la teinte d'une
 * famille — aucun thème ne le repeint —, et jamais seul, pour qui distingue
 * mal les couleurs : il s'ajoute au cadre de la rareté, qui garde sa gemme,
 * en second cadre au-dedans du sien (`.exp-vc-doree::after`, la section « Les
 * rencontres » de `styles.css`) — une forme de plus, pas une couleur à la
 * place ; levée, l'œuvre dit « cadre doré » à l'oreille.
 */
const OR_DU_CADRE = '#e3b448'

/**
 * Un nom qui ne se coupe pas — un mot de onze lettres et plus — s'écrit plus
 * serré dans une rangée : sur trois colonnes en 360, le codex lisait
 * « Concentratio ».
 */
const serre = (nom: string) => Math.max(...nom.split(/[\s-]/).map(m => m.length)) >= 11

/** Le médaillon du légendaire qu'elle montre, à la place d'une peinture : une carte de légendaire, un gardien du Cabinet. */
export function VisageDuLegendaire({ cle }: { cle: string }) {
  return (
    <span className="exp-medaillon exp-visage-joker" aria-hidden="true">
      <Dessin cle={cle} />
    </span>
  )
}

/**
 * Une œuvre dessinée comme une vraie carte (« les cartes c'est des rectangles
 * pas très jolis, ça serait pas possible de faire de vraies cartes ? Ça
 * rajouterait à l'immersion », le propriétaire, le 18 octobre 2026) : son
 * cadre à la couleur de sa rareté, son illustration sur la teinte de sa
 * famille — sa peinture, sinon le médaillon du légendaire qu'elle montre —,
 * son nom dans un bandeau, la gemme de sa rareté ; levée, sa rareté dite et sa
 * phrase. Dessinée seulement : le bouton qui la porte dit ce qu'elle est à
 * l'oreille, cadre doré compris — sauf levée, où elle est le contenu même de
 * la fenêtre.
 *
 * Ce que l'Expédition y ajoute garde sa place dans la carte : l'orbe du coût
 * au coin (`coin`), le dessin d'une carte sans peinture (`repli`), son
 * chiffre en médaillon sous l'illustration (`valeur`), sa phrase levée
 * (`texte`), puis ce que `children` ajoute, et après la gemme, ce qui se pose
 * à son coin bas (`marque`).
 */
export function OeuvrePeinte({
  oeuvre,
  taille,
  doree,
  classe,
  coin,
  repli,
  valeur,
  texte,
  nombre,
  marque,
  children,
}: {
  oeuvre: OeuvreMontree
  taille: TailleDOeuvre
  /** Son cadre est doré : un second cadre d'or, et levée, « cadre doré » à l'oreille. */
  doree?: boolean
  /** Une classe de plus sur le cadre : `exp-vc-amelioree`. */
  classe?: string
  /** Au coin, avant tout : l'orbe du coût d'une carte des rencontres. */
  coin?: ReactNode
  /** Son dessin quand elle n'a ni peinture ni légendaire. */
  repli?: ReactNode
  /** Son chiffre, en médaillon sous l'illustration — hors levée, où sa phrase le dit. */
  valeur?: string
  /** Sa phrase, levée. */
  texte?: string
  /** Dans un tas, combien il en a : « ×4 ». */
  nombre?: number
  /** Au coin bas, après la gemme : le « + » d'une carte améliorée. */
  marque?: ReactNode
  children?: ReactNode
}) {
  const style = {
    ...gemmeDeLaRarete(oeuvre.rarete),
    '--famille': teinteDe(oeuvre.famille),
    ...(doree && { '--dorure': OR_DU_CADRE }),
  } as CSSProperties
  // Peinte, son illustration (`server/scripts/anime/cartes.ts`) : la grande levée, la petite ailleurs. La teinte de sa famille
  // reste dessous, le temps qu'elle arrive. Levée, la grande se demande tout de suite, la petite dessous : déjà là — la main la
  // montrait —, elle tient la place tant que la grande voyage (seize kilo-octets, deux cents millisecondes en 4G).
  const peinture = CARTES_PEINTES[oeuvre.cle]
  const levee = taille === 'levee'
  return (
    <span
      className={`exp-vc exp-vc-${taille}` + (oeuvre.legendaire ? ' exp-vc-du-legendaire' : '') + (doree ? ' exp-vc-doree' : '') + (classe ? ` ${classe}` : '')}
      style={style}
      aria-hidden={levee ? undefined : true}
    >
      {coin}
      {levee && oeuvre.rarete !== 'commun' && <span className="exp-vc-rarete-dite">{RARETE_DITE[oeuvre.rarete]}</span>}
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
        ) : oeuvre.legendaire ? (
          <VisageDuLegendaire cle={oeuvre.legendaire} />
        ) : (
          repli
        )}
      </span>
      {!levee && valeur && <b className="exp-vc-valeur">{valeur}</b>}
      {taille !== 'main' && <b className={'exp-vc-nom' + (taille === 'rangee' && serre(oeuvre.nom) ? ' exp-vc-nom-serre' : '')}>{oeuvre.nom}</b>}
      {levee && doree && <span className="sr-only">, cadre doré</span>}
      {levee && texte !== undefined && <span className="exp-vc-texte">{espacesFines(texte)}</span>}
      {children}
      <span className="exp-vc-gemme" />
      {nombre !== undefined && nombre > 1 && <b className="exp-vc-nombre">{`×${nombre}`}</b>}
      {marque}
    </span>
  )
}

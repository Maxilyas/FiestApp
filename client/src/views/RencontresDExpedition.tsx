import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { Balise } from '../components/Balise'
import { Feuille } from '../components/Pieces'
import { Onglets } from '../components/Onglets'
import { CARTES_PEINTES } from '../components/cartes-peintes'
import { espacesFines } from '../format'
import { gemme } from '../gemmes'
import { useModale } from '../modale'
import { iconeDuSujet } from '../iconeDuSujet'
import { couleurDePiste, pourcentDeChance } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { CATEGORIES } from '../../../shared/categories'
import type { Niveau } from '../../../shared/campagne'
import type { RareteDeTheme } from '../../../shared/themes'
import { MARCHES_DES_ACTES, duGardien, nomDuGardien, type FormeDEscale, type VueDeLExpedition } from '../../../shared/expedition'
import {
  CARTES_DES_RENCONTRES,
  CARTES_PAR_QUESTION,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UNE_SOURCE,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_MAX,
  FAMILLES_DE_CARTES,
  INSPIRATION_PAR_QUESTION,
  MISES,
  apercuDuTour,
  carteDeRencontre,
  cartesDeCombat,
  chiffresApresLaCarte,
  formeApresLaCarte,
  type AnnonceDuTour,
  type ApercuDuTour,
  type CarteDeRencontre,
  type CoupDeRencontre,
  type FamilleDeCartes,
  type MomentDUneCarte,
  type VueDeLaRencontre,
} from '../../../shared/rencontres'

// Le prototype des rencontres, à l'écran (`shared/rencontres.ts` ; la
// proposition « L'Expédition en cartes », validée par le propriétaire le
// 18 octobre 2026 : « C'est good lance le prototype avec tes recos »). Une
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
 * La couleur d'une carte, au cadre : la gemme de sa rareté — celle des
 * jokers, de l'album et de la boutique (`gemmes.ts`) ; une maudite prend le
 * pourpre de l'épique. Une seule couleur par rareté dans toute l'application.
 */
const GEMME_DE_LA_CARTE: Record<CarteDeRencontre['rarete'], RareteDeTheme> = { commun: 'commune', rare: 'rare', maudit: 'epique', legendaire: 'legendaire' }
export const gemmeDeLaCarte = (c: CarteDeRencontre) => gemme(GEMME_DE_LA_CARTE[c.rarete])

/** Sa rareté, accordée à « carte ». */
export const RARETE_DE_LA_CARTE: Record<CarteDeRencontre['rarete'], string> = { commun: 'commune', rare: 'rare', maudit: 'maudite', legendaire: 'légendaire' }

/** Quand une carte se joue, en clair : la carte levée, l'offre, l'échoppe le disent. */
export const MOMENT: Record<MomentDUneCarte, string> = {
  preparation: 'Avant de voir la question',
  reflexe: 'Pendant la question',
  pouvoir: 'Pour toute la rencontre',
  route: 'Sur le plan, une fois par acte',
}
const MOMENT_COURT: Record<MomentDUneCarte, string> = { preparation: 'avant la question', reflexe: 'pendant la question', pouvoir: 'toute la rencontre', route: 'sur le plan' }

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
}

/** Une carte en petit : le médaillon du légendaire qui la donne, sinon son dessin. */
export function VisageDeLaCarte({ c }: { c: CarteDeRencontre }) {
  return c.legendaire ? (
    <span className="exp-medaillon exp-visage-joker" aria-hidden="true">
      <Dessin cle={c.legendaire} />
    </span>
  ) : (
    <Icon name={ICONE_DE_LA_CARTE[c.cle] ?? 'sparkles'} />
  )
}

/** Ce que dit une carte au-delà de son effet : quand elle se joue, si elle ne sert qu'une fois par rencontre, si elle aide, d'où elle vient. */
export function origineDeLaCarte(c: CarteDeRencontre): string {
  return [MOMENT[c.moment], ...plusDeLaCarte(c)].join(' · ')
}

/** Ce qu'il faut savoir de plus sur elle : une fois par rencontre, un indice, le légendaire qui la donne. */
function plusDeLaCarte(c: CarteDeRencontre): string[] {
  return [
    c.epuisement && 'une fois par rencontre',
    c.indice && 'une aide : ta réponse ne compte pas dans tes statistiques',
    c.legendaire && `la carte ${duGardien(c.legendaire)}`,
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
  // Peinte, son illustration (`server/scripts/anime/cartes.ts`) : la grande levée, la petite ailleurs. La teinte de sa famille
  // reste dessous, le temps qu'elle arrive.
  const peinture = CARTES_PEINTES[c.cle]
  return (
    <span className={`exp-vc exp-vc-${taille}` + (c.legendaire ? ' exp-vc-du-legendaire' : '')} style={style} aria-hidden={taille === 'levee' ? undefined : true}>
      <CoutEnEnergie c={c} manque={energie !== undefined && c.cout > energie} />
      {taille === 'levee' && c.rarete !== 'commun' && <span className="exp-vc-rarete-dite">{RARETE_DE_LA_CARTE[c.rarete]}</span>}
      <span className="exp-vc-art">
        {peinture ? <img className="exp-vc-peinture" src={peinture[taille === 'levee' ? 0 : 1]} alt="" loading="lazy" decoding="async" /> : <VisageDeLaCarte c={c} />}
      </span>
      {taille !== 'levee' && c.valeur && <b className="exp-vc-valeur">{c.valeur}</b>}
      {taille !== 'main' && <b className={'exp-vc-nom' + (taille === 'rangee' && serre(c.nom) ? ' exp-vc-nom-serre' : '')}>{c.nom}</b>}
      {taille === 'levee' && <span className="exp-vc-texte">{espacesFines(c.effet)}</span>}
      {children}
      <span className="exp-vc-gemme" />
      {nombre !== undefined && nombre > 1 && <b className="exp-vc-nombre">{`×${nombre}`}</b>}
    </span>
  )
}

/** L'ordre du catalogue : neutres, familles, légendaires — pas celui des noms, que `localeCompare` trierait en chargeant `Intl` (règle `client.md`). */
const RANG_AU_CATALOGUE = new Map(CARTES_DES_RENCONTRES.map((c, i) => [c.cle, i]))

/** Des cartes comptées — « Concentration ×4 » —, dans l'ordre du catalogue. */
export function comptesDesCartes(cles: readonly string[]): { cle: string; nom: string; n: number }[] {
  const n = new Map<string, number>()
  for (const cle of cles) n.set(cle, (n.get(cle) ?? 0) + 1)
  return [...n]
    .map(([cle, x]) => ({ cle, nom: carteDeRencontre(cle)?.nom ?? cle, n: x }))
    .sort((a, b) => (RANG_AU_CATALOGUE.get(a.cle) ?? 99) - (RANG_AU_CATALOGUE.get(b.cle) ?? 99))
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
  const c = avec === undefined ? undefined : carteDeRencontre(avec)
  // Dans l'ordre du pli : un pouvoir est posé avant que ses chiffres se comptent.
  const pouvoirs = c?.moment === 'pouvoir' ? [...r.pouvoirs, c.cle] : r.pouvoirs
  const chiffres = c ? chiffresApresLaCarte(c.cle, { inspiration: r.inspiration, charge: r.charge, garde: r.garde, serie: r.serie }, pouvoirs) : r
  const q = c ? formeApresLaCarte(c.cle, { forme: a.forme, reponses: a.reponses }) : { forme: a.forme, reponses: a.reponses }
  return apercuDuTour({
    tour: { charge: chiffres.charge, garde: chiffres.garde, mise, jouees: c ? [...r.jouees, c.cle] : r.jouees },
    pouvoirs,
    sceaux: r.sceaux,
    frappe: r.frappe,
    savoir: a.savoir,
    question: { reponses: q.reponses, forme: q.forme, categorie: a.categorie },
    ...(fetiche && { fetiche }),
    ...(a.mots !== undefined && { mots: a.mots }),
  })
}

/** Ce qu'une carte levée changerait à l'aperçu : avant elle, et avec elle. */
export interface ChangementDeLaCarte {
  avant: ApercuDuTour
  apres: ApercuDuTour
}

/** Le changement d'une carte qui se joue maintenant ; null : l'aperçu ne bouge pas, ou elle ne se joue pas. */
export function changementDeLaCarte(r: VueDeLaRencontre, mise: number, fetiche: string | undefined, cle: string): ChangementDeLaCarte | null {
  if (r.refus[cle] !== null && r.refus[cle] !== undefined) return null
  const avant = apercuALaMise(r, mise, fetiche)
  const apres = apercuALaMise(r, mise, fetiche, cle)
  return avant && apres ? { avant, apres } : null
}

/** Ce qu'une bonne réponse ferait, dit en clair. */
const ditJuste = (a: ApercuDuTour) => (a.juste.tombe ? 'il tombe' : `il perd ${a.juste.brises}`)

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
  const deCartes = base && !j.tombe ? j.brises - base.juste.brises : 0
  const detailJuste = [
    j.tombe && colle('il perd', j.brises),
    j.auPremierMot !== undefined && `${colle('jusqu’à', j.auPremierMot)} si tu réponds tôt`,
    deCartes > 0 && `${colle('dont', `+${deCartes}`)} grâce à tes cartes`,
    j.ecus > 0 && `+${j.ecus} écus de ton pari`,
  ].filter((x): x is string => !!x)
  const detailFaux = [
    f.frappe === 0
      ? 'il ne t’attaque pas'
      : f.absorbee > 0 && (f.perdu === 0 ? `${colle('son attaque fait', f.frappe)} : ton bouclier pare tout` : `${colle('son attaque fait', f.frappe)}, ton bouclier en ${colle('pare', f.absorbee)}`),
    f.contre > 0 && `riposte : ${colle('il perd', f.contre)}`,
    f.ecus > 0 && `−${f.ecus} écus de ton pari`,
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
          {j.tombe ? 'Il tombe !' : `Il perd ${j.brises}`}
        </b>
        {!compact && detailJuste.map(t => <span key={t}>{espacesFines(t)}</span>)}
      </div>
      <div className="exp-apercu-tuile exp-apercu-faux">
        <span className="exp-apercu-si">
          <Icon name="x" />
          Si tu te trompes
        </span>
        <b key={f.perdu} className="exp-apercu-chiffre">
          {`Tu perds ${f.perdu}`}
          <Icon name="heart" />
          <span className="sr-only"> de courage</span>
        </b>
        {!compact && detailFaux.map(t => <span key={t}>{espacesFines(t)}</span>)}
      </div>
    </div>
  )
}

/** Ce qu'une carte levée changerait, en lignes « avant → après » ; rien, si elle ne change aucun chiffre. */
function Changement({ c }: { c: ChangementDeLaCarte }) {
  const { avant, apres } = c
  const lignes: { cle: string; icone: IconName; quoi: string; de: string; a: string }[] = []
  if (ditJuste(avant) !== ditJuste(apres)) lignes.push({ cle: 'juste', icone: 'check', quoi: 'Si tu as juste', de: ditJuste(avant), a: ditJuste(apres) })
  if (avant.juste.ecus !== apres.juste.ecus) lignes.push({ cle: 'gain', icone: 'ecu', quoi: 'Ton pari gagné', de: `+${avant.juste.ecus}`, a: `+${apres.juste.ecus} écus` })
  if (avant.faux.perdu !== apres.faux.perdu) lignes.push({ cle: 'faux', icone: 'heart', quoi: 'Si tu te trompes', de: `tu perds ${avant.faux.perdu}`, a: `tu perds ${apres.faux.perdu}` })
  if (avant.faux.contre !== apres.faux.contre) lignes.push({ cle: 'contre', icone: 'sabre', quoi: 'Si tu te trompes, riposte', de: `${avant.faux.contre}`, a: `il perd ${apres.faux.contre}` })
  if (avant.faux.ecus !== apres.faux.ecus) lignes.push({ cle: 'perte', icone: 'ecu', quoi: 'Ton pari perdu', de: `−${avant.faux.ecus}`, a: `−${apres.faux.ecus} écus` })
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

/** Ce qu'une carte coûte, dit à l'oreille et dans les lignes d'une offre. */
const coutDit = (c: CarteDeRencontre) => (c.cout === 0 ? 'gratuite' : `${c.cout} d’énergie`)

/**
 * Une carte de la main, dessinée (`CarteDessinee`) : l'orbe de son coût, son
 * illustration, et ce qu'elle fait en deux ou trois mots — on la comprend
 * sans la lever. Une carte qui ne se joue pas maintenant s'éteint, son coût
 * rouge s'il manque d'énergie ; touchée, elle se lève quand même, et dit
 * pourquoi.
 */
function FaceDeLaCarte({ c, refus, energie, onToucher }: { c: CarteDeRencontre; refus: string | null; energie?: number; onToucher: () => void }) {
  return (
    <button type="button" className={'exp-face' + (refus ? ' exp-face-eteinte' : '')} data-carte={c.cle} aria-haspopup="dialog" onClick={onToucher}>
      <CarteDessinee c={c} taille="main" energie={energie} />
      <span className="sr-only">{`${c.nom} : ${c.resume}, ${coutDit(c)}${refus ? ', pas maintenant' : ''}`}</span>
    </button>
  )
}

/** Sur le plan, ses cartes de route en petit : le dessin seul, au cadre de sa rareté. */
function CarteEnPetit({ c, refus, onToucher }: { c: CarteDeRencontre; refus: string | null; onToucher: () => void }) {
  return (
    <button type="button" className={'exp-carte-joker exp-carte-rencontre' + (refus ? ' exp-refuse' : '')} style={gemmeDeLaCarte(c)} data-carte={c.cle} aria-haspopup="dialog" onClick={onToucher}>
      <span className="exp-joker-dessin" aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="sr-only">{`${c.nom}, ${MOMENT_COURT[c.moment]}${refus ? ', pas maintenant' : ''}`}</span>
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
  const cle = levee !== null ? cles[levee] : undefined
  const indexees = cles.flatMap((k, i) => {
    const c = carteDeRencontre(k)
    return c ? [{ k, i, c }] : []
  })
  // Avant la question, deux temps : ce qui se joue maintenant, puis ce qui attendra la question ; pendant, ce temps-là seul.
  const pendant = indexees.filter(x => x.c.moment === 'reflexe')
  const maintenant = phase === 'question' ? pendant : indexees.filter(x => x.c.moment !== 'reflexe')
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
          <button type="button" className="exp-pioche" aria-haspopup="dialog" onClick={pile.onOuvrir}>
            <b aria-hidden="true">{pile.compte}</b>
            <span className="sr-only">{pile.dit}</span>
          </button>
        </section>
        {leveeDessus}
      </>
    )
  }
  // La question vue, sans carte à jouer pendant : rien à montrer, la question d'abord — ce qui est posé pour toute la rencontre est dans la barre.
  if (phase === 'question' && maintenant.length === 0) return null
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
          <p className="exp-main-vide">{espacesFines('Ta main est vide : la question suivante en tire de nouvelles.')}</p>
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
  onJouer,
  onMontrer,
  onReposer,
}: {
  cle: string
  refus?: string | null
  busy?: boolean
  changement?: ChangementDeLaCarte | null
  onJouer?: JouerUneCarte
  onMontrer?: () => void
  onReposer: () => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onReposer)
  const [categorie, setCategorie] = useState<string | null>(null)
  const c = carteDeRencontre(cle)
  if (!c) return null
  const verbe = cle === 'prediction' ? 'Montrer une réponse à l’Oracle' : `${c.moment === 'pouvoir' ? 'Poser' : 'Jouer'} « ${c.nom} »`
  // Le Commandement choisit d'abord sa catégorie : douze pastilles sous la carte, qui se fait plus petite.
  const choix = !!onJouer && !refus && cle === 'commandement'
  const plus = plusDeLaCarte(c)
  return (
    <div className="carte-voile exp-leve-voile" onClick={onReposer}>
      <div className={'exp-leve' + (choix ? ' exp-leve-avec-choix' : '')} role="dialog" aria-modal="true" aria-label={c.nom} ref={boite} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <CarteDessinee c={c} taille="levee">
          <span className="exp-vc-quand">
            <Icon name={ICONE_DU_MOMENT[c.moment]} />
            {MOMENT[c.moment]}
          </span>
          {c.moment !== 'route' && <span className="sr-only">{c.cout === 0 ? 'Elle est gratuite.' : `Elle coûte ${c.cout} d’énergie.`}</span>}
          {plus.length > 0 && <span className="exp-vc-plus">{espacesFines(plus.join(' · '))}</span>}
        </CarteDessinee>
        {changement && <Changement c={changement} />}
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

/** Le cycle des cartes, en une fois : « on comprend pas bien ce qu'on a en main et comment les cartes reviennent » (le 18 octobre 2026). */
const REGLE_DU_CYCLE = `À chaque question, tu tires de nouvelles cartes de ta pioche, et tu as ${INSPIRATION_PAR_QUESTION} d’énergie pour les jouer. Celles que tu ne joues pas vont à la défausse ; quand ta pioche est vide, ta défausse y est remélangée. Une carte « une fois par rencontre » revient à la rencontre suivante, et chaque rencontre remélange tout ton paquet. Les cartes de route se jouent sur le plan, une fois par acte.`

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
  const comptes = comptesDesCartes(cles)
  if (comptes.length === 0) return <p className="muted small">{espacesFines(vide)}</p>
  const aChoisir = choisie !== undefined
  return (
    <ul className="exp-rangee" aria-label={nom}>
      {comptes.map(x => {
        const c = carteDeRencontre(x.cle)
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
  const cartes = cles.map(k => carteDeRencontre(k)).filter((c): c is CarteDeRencontre => !!c)
  const choisie = cartes.find(c => prises.includes(c.cle))
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
            <span className="sr-only">{`${c.nom}, ${RARETE_DE_LA_CARTE[c.rarete]} : ${c.effet} ${coutDit(c)}, ${MOMENT_COURT[c.moment]}.`}</span>
          </button>
        ))}
      </div>
      {choisie && (
        <p className="exp-a-prendre-dit" aria-hidden="true">
          <b>{choisie.nom}</b>
          <span className={`exp-rarete exp-rarete-${choisie.rarete}`}>{RARETE_DE_LA_CARTE[choisie.rarete]}</span>
          <span>{espacesFines(choisie.effet)}</span>
          <span className="muted small">{espacesFines(`${coutDit(choisie)} · ${MOMENT[choisie.moment]}`)}</span>
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
export function FeuilleDesCartes({ paquet, rencontre, onFermer }: { paquet: readonly string[]; rencontre?: VueDeLaRencontre; onFermer: () => void }) {
  const [regardee, setRegardee] = useState<string | null>(null)
  const pioche = rencontre ? sans(cartesDeCombat(paquet), [...rencontre.main, ...rencontre.defausse, ...rencontre.epuisees, ...rencontre.pouvoirs]) : []
  const tas = (titre: string, cles: readonly string[], vide: string) => (
    <section className="exp-main-section" key={titre}>
      <h3 className="label">{`${titre} · ${cles.length}`}</h3>
      <RangeeDeCartes cles={cles} vide={vide} nom={titre} onRegarder={setRegardee} />
    </section>
  )
  return (
    <>
      <Feuille titre={rencontre ? 'Tes cartes' : 'Ton paquet'} className="feuille-paquet" onFermer={onFermer}>
        {rencontre && rencontre.pouvoirs.length > 0 && tas('Posées pour toute la rencontre', rencontre.pouvoirs, '')}
        {rencontre && (
          <>
            {tas('Ta pioche', pioche, 'Ta pioche est vide : ta défausse y revient à la question suivante.')}
            {tas('Ta défausse', rencontre.defausse, 'Rien en défausse.')}
            {rencontre.epuisees.length > 0 && tas('Hors jeu jusqu’à la rencontre suivante', rencontre.epuisees, '')}
          </>
        )}
        {tas('Tout ton paquet', paquet, 'Ton paquet est vide.')}
        <p className="muted small">{espacesFines(REGLE_DU_CYCLE)}</p>
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
  { id: 'maudit', nom: 'Maudites' },
  { id: 'legendaire', nom: 'Légendaires' },
]

/**
 * Le codex : toutes les cartes de l'expédition, de la commune à la
 * légendaire, en vraies cartes (« Est-ce que l'on ferait pas un codex de
 * carte global aussi, avec de commun à légendaire et on en débloque au fur
 * et à mesure qu'on avance dans l'aventure ? », le 18 octobre 2026). Une page
 * par rareté, en onglets qui comptent ; touchée, une carte se lève et dit
 * tout, comme dans un tas. Toutes ouvertes pour l'instant : ce qu'on
 * débloque en jouant viendra avec la renommée.
 */
export function FeuilleDuCodex({ onFermer }: { onFermer: () => void }) {
  const [page, setPage] = useState<PageDuCodex>('toutes')
  const [regardee, setRegardee] = useState<string | null>(null)
  const cartes = CARTES_DES_RENCONTRES.filter(c => page === 'toutes' || c.rarete === page)
  // Des puces qui comptent, comme les pages de l'album des trophées : cinq onglets à leur nom ne tenaient pas sur une ligne en 360.
  const onglets = PAGES_DU_CODEX.map(p => {
    const n = p.id === 'toutes' ? CARTES_DES_RENCONTRES.length : CARTES_DES_RENCONTRES.filter(c => c.rarete === p.id).length
    return { id: p.id, nom: p.nom, pastille: { n, label: `${n} carte${n > 1 ? 's' : ''}` } }
  })
  return (
    <>
      <Feuille titre="Ton codex" className="feuille-codex" onFermer={onFermer}>
        <p className="muted small">{espacesFines(`Les ${CARTES_DES_RENCONTRES.length} cartes de l’expédition, de la commune à la légendaire. Touche une carte pour la lire.`)}</p>
        <Onglets onglets={onglets} actif={page} onChoisir={setPage} label="Les raretés" idOnglet={id => `codex-${id}`} idPanneau={() => 'codex-page'} className="onglets-puces" />
        <ul className="exp-codex" id="codex-page" role="tabpanel" aria-labelledby={`codex-${page}`}>
          {cartes.map(c => (
            <li key={c.cle}>
              <button type="button" className="exp-codex-carte" data-carte={c.cle} aria-haspopup="dialog" onClick={() => setRegardee(c.cle)}>
                <CarteDessinee c={c} taille="rangee" />
                <span className="sr-only">{`${c.nom}, ${RARETE_DE_LA_CARTE[c.rarete]} : ${c.resume}`}</span>
              </button>
            </li>
          ))}
        </ul>
      </Feuille>
      {regardee && <CarteLevee cle={regardee} onReposer={() => setRegardee(null)} />}
    </>
  )
}

// ── La rencontre ────────────────────────────────────────────────────────────

/** La marche d'une question, accordée à elle. */
const MARCHE_DITE: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }

/** Une forme qui n'est pas celle de tous les jours, dite en clair ; quatre choix ne se disent pas. */
const FORME_DITE: Record<FormeDEscale, string | null> = { quatre: null, six: 'six choix', 'vrai-faux': 'vrai ou faux', devoilement: 'mot à mot' }

/**
 * L'adversaire, en tête de la rencontre : l'emblème de sa catégorie — de son
 * thème pointu, le médaillon d'un gardien —, son nom, et ce qu'il lui reste,
 * en jauge et en chiffre — les points qu'une bonne réponse lui fait perdre ;
 * à zéro, il tombe. Dessous, la question qu'il pose (`SaQuestion`), sans son
 * texte. `sceaux` : ce qui lui reste après la réponse, à la révélation ;
 * `compact`, la question sous les yeux : son nom et sa jauge seuls.
 */
export function Adversaire({ r, gardien, acte, sceaux, compact }: { r: VueDeLaRencontre; gardien: string; acte: number; sceaux?: number; compact?: boolean }) {
  const restants = Math.max(0, sceaux ?? r.sceaux)
  const sujet = r.sujet ? sujetParCle(r.sujet) : undefined
  const theme = sujet?.nom ?? r.categorie ?? 'Mélange'
  const surtitre = r.sorte === 'gardien' ? `Gardien · acte ${acte + 1}` : r.sorte === 'elite' ? `Élite · ${theme}` : theme
  const part = r.max > 0 ? Math.round((restants / r.max) * 100) : 0
  const nom = r.sorte === 'gardien' ? nomDuGardien(gardien) : r.adversaire
  return (
    <section
      className={`exp-adversaire exp-adversaire-${r.sorte}` + (restants === 0 ? ' exp-adversaire-tombe' : '') + (compact ? ' exp-adversaire-compact' : '')}
      aria-label={espacesFines(`${surtitre} : ${nom}, ${restants === 0 ? 'tombé' : `il lui reste ${restants} point${restants > 1 ? 's' : ''} sur ${r.max}`}`)}
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
          <span className="exp-sceaux">
            <span className="exp-sceaux-jauge">
              <i style={{ width: `${part}%` }} />
            </span>
            <b>{restants === 0 ? 'Tombé' : `${restants} point${restants > 1 ? 's' : ''}`}</b>
          </span>
        </span>
      </div>
      {!compact && r.annonce && <SaQuestion a={r.annonce} />}
    </section>
  )
}

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
  cle: 'rencontre' | 'cartes' | 'pari' | 'expedition' | 'plan' | 'recompenses' | 'equipe' | 'passeport' | 'questions' | 'jokers'
  titre: string
  /** `energie` : l'orbe de l'énergie, tel que la main le montre. */
  lignes: { icone: IconName | 'energie'; texte: string }[]
}

export type DebutDesRegles = SectionDesRegles['cle']

/**
 * Les règles d'une expédition en rencontres, ce que les pages ne disent plus
 * (« Pas besoin d'explication pour tout, il faudrait juste un onglet règles
 * qu'on peut consulter de n'importe quelle page », la revue du 18 octobre
 * 2026). `parQuestion` : les cartes que chaque question tire, acte par acte,
 * telles que le serveur les dit.
 */
function reglesDesRencontres(parQuestion: readonly number[]): SectionDesRegles[] {
  const [a1, a2, a3] = parQuestion
  return [
    {
      cle: 'rencontre',
      titre: 'Une rencontre',
      lignes: [
        { icone: 'check', texte: 'Réponds juste : l’adversaire perd des points. À zéro, il tombe.' },
        { icone: 'heart', texte: 'Trompe-toi : il t’attaque, et tu perds du courage. Son attaque grandit à chaque question.' },
        { icone: 'x', texte: 'Plus de courage : l’expédition s’arrête là.' },
      ],
    },
    {
      cle: 'cartes',
      titre: 'Tes cartes',
      lignes: [
        { icone: 'energie', texte: `Chaque carte coûte de l’énergie — le chiffre dans son coin. Tu en as ${INSPIRATION_PAR_QUESTION} à chaque question.` },
        { icone: 'list', texte: a1 === a3 ? `Tu tires ${a1} cartes à chaque question.` : `Tu tires ${a1} cartes à chaque question de l’acte 1, ${a2} à l’acte 2, ${a3} à l’acte 3.` },
        { icone: 'eye-off', texte: '« Maintenant » : avant de voir la question. « Pendant la question » : une fois qu’elle est sous tes yeux.' },
        { icone: 'eye', texte: 'Touche une carte : elle dit ce qu’elle fait, et ce qu’elle changerait.' },
        { icone: 'infinity', texte: 'Une carte posée pour toute la rencontre se montre en haut de l’écran : touche-la pour la relire.' },
        { icone: 'rotate', texte: 'Celles que tu ne joues pas vont à la défausse ; ta pioche vide, ta défausse y revient. Chaque rencontre remélange tout ton paquet.' },
        { icone: 'flag', texte: 'Une carte de route se joue sur le plan, une fois par acte.' },
      ],
    },
    {
      cle: 'pari',
      titre: 'Le pari',
      lignes: [
        { icone: 'ecu', texte: 'Avant de voir la question, parie des écus : juste, tu gagnes la moitié de ta mise ; faux, tu la perds.' },
        { icone: 'echoppe', texte: 'Tes écus se gagnent en battant tes adversaires et se dépensent à l’échoppe. Ils restent dans l’expédition.' },
      ],
    },
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
        { icone: 'flag', texte: 'À chaque pas, choisis ton escale. Son pourcentage : tes chances sur ses questions — celles d’un joueur moyen, tant que tu n’as pas assez joué.' },
        { icone: 'swords', texte: 'Une rencontre : un adversaire de sa catégorie. Une élite : plus coriace, mieux payée.' },
        { icone: 'source', texte: `Une source : une question de ton carnet, ${COURAGE_D_UNE_SOURCE} de courage si tu la retrouves.` },
        { icone: 'coffre', texte: 'Un coffre : une carte au choix — ou des écus, si tu n’en prends aucune.' },
        { icone: 'campement', texte: `Un campement, avant le gardien : ${COURAGE_D_UN_CAMPEMENT} de courage, ou une carte de moins — un paquet plus court tire plus souvent tes meilleures.` },
        { icone: 'help', texte: 'L’inconnu : un marchand, un piège, ou un légendaire de passage.' },
      ],
    },
    {
      cle: 'recompenses',
      titre: 'Tes récompenses',
      lignes: [{ icone: 'plus-square', texte: 'Un adversaire tombé : une carte à choisir parmi trois, pour ton paquet — plus souvent rare après une élite ou dans un coffre.' }],
    },
    {
      cle: 'equipe',
      titre: 'Ton équipe',
      lignes: [
        { icone: 'users', texte: 'Les légendaires que tu emmènes : la carte de chacun rejoint ton paquet, et sa famille choisit les cartes de tes récompenses.' },
        { icone: 'sparkles', texte: 'Sans légendaire à toi, l’invité du jour part avec toi. Va au bout d’une expédition : le gardien que tu choisis sera de la suivante.' },
        { icone: 'book', texte: 'Ta catégorie fétiche : Plume et Bibliothèque frappent plus fort sur ses questions.' },
      ],
    },
    { cle: 'passeport', titre: 'Ton passeport', lignes: [{ icone: 'tampon', texte: 'Chaque thème pointu trouvé en expédition y met son tampon.' }] },
  ]
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
        { icone: 'flag', texte: 'À chaque pas, choisis ton escale. Son pourcentage : tes chances sur sa question — celles d’un joueur moyen, tant que tu n’as pas assez joué.' },
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
  debut,
  pied,
  onFermer,
}: {
  rencontres: boolean
  /** Les cartes que chaque question tire, acte par acte (`CartesEnJeu.parQuestion`). */
  parQuestion?: readonly number[]
  debut?: DebutDesRegles
  pied?: ReactNode
  onFermer: () => void
}) {
  const sections = rencontres ? reglesDesRencontres(parQuestion ?? [CARTES_PAR_QUESTION, CARTES_PAR_QUESTION, CARTES_PAR_QUESTION]) : reglesDesJokers()
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
                  {l.icone === 'energie' ? <b className="exp-vc-cout">{INSPIRATION_PAR_QUESTION}</b> : <Icon name={l.icone} />}
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
 * La préparation d'une question (le cœur du prototype), dans l'ordre où l'on
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
  // Fermées d'une façon ou d'une autre, les règles sont vues : revenues à chaque rencontre, elles lasseraient.
  const [aide, setAide] = useState(() => !guideVu())
  const vu = () => {
    retenirLeGuide()
    setAide(false)
  }
  const gardien = vue.gardiens[Math.min(vue.acte, vue.gardiens.length - 1)]?.cle ?? ''
  const refus = r.mises?.[mise] ?? null
  // L'aperçu à la mise choisie, par la règle du serveur : celui de la vue est à mise nulle, la mise n'étant dite qu'en voyant la question.
  const apercu = apercuALaMise(r, mise, vue.fetiche) ?? r.apercu
  // Le même, sans les cartes de cette question : ce qu'elles y ajoutent se dit à part.
  const base = apercuALaMise({ ...r, charge: 0, garde: 0, jouees: [] }, mise, vue.fetiche)
  const motif = dit ?? refus
  return (
    <div className="player-shell expedition exp-rencontre">
      {barre}
      <Adversaire r={r} gardien={gardien} acte={vue.acte} />
      {apercu && <Apercu a={apercu} base={base} />}
      <MainDeRencontre
        cles={r.main}
        refus={r.refus}
        busy={busy}
        inspiration={r.inspiration}
        pile={{ compte: r.pioche, mot: 'pioche', dit: `Ta pioche : ${r.pioche} carte${r.pioche > 1 ? 's' : ''}, ta défausse : ${r.defausse.length}`, onOuvrir: () => setTas(true) }}
        apercuDeLaCarte={cle => changementDeLaCarte(r, mise, vue.fetiche, cle)}
        onJouer={onJouer}
      />
      <Paris
        mises={r.mises ?? {}}
        choisie={mise}
        onChoisir={(m, refusDeM) => {
          setDit(refusDeM)
          if (refusDeM === null) setMise(m)
        }}
      />
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
      {tas && <FeuilleDesCartes paquet={vue.cartes?.paquet ?? []} rencontre={r} onFermer={() => setTas(false)} />}
      {aide && (
        <FeuilleDesRegles
          rencontres
          parQuestion={vue.cartes?.parQuestion}
          onFermer={vu}
          pied={
            <button type="button" className="btn btn-primary btn-block" onClick={vu}>
              Compris
            </button>
          }
        />
      )}
    </div>
  )
}

/**
 * Ce qu'une réponse vient de faire en rencontre, à la révélation, en clair :
 * le titre — ce qu'il a perdu, l'adversaire qui tombe, ce qu'il t'a pris — et
 * ses lignes — le bouclier, la riposte, le pari, la victoire.
 */
export function verdictDeLaRencontre(c: CoupDeRencontre, adversaire: string, finie: boolean): { titre: string; lignes: string[] } {
  if (c.traversee) return { titre: 'Question passée : personne ne perd rien', lignes: ['Elle part à ton carnet.'] }
  if (c.juste) {
    return {
      titre: c.victoire ? `${adversaire} tombe !` : `Juste ! ${adversaire} perd ${c.brises}`,
      lignes: [
        c.victoire && `Il a perdu ${c.brises} d’un coup`,
        c.mise > 0 && `+${c.mise} écus gagnés avec ton pari`,
        c.victoire && c.victoire.ecus > 0 && `+${c.victoire.ecus} écus de victoire`,
        c.victoire && c.victoire.courage > 0 && `+${c.victoire.courage} de courage, grâce à L’aube`,
      ].filter((x): x is string => !!x),
    }
  }
  const titre = finie
    ? 'Raté… tu n’as plus de courage'
    : c.renaissance
      ? `Raté… Renaissance : tu renais avec ${COURAGE_DE_LA_RENAISSANCE} de courage`
      : c.frappe === 0
        ? 'Raté… mais il ne t’attaque pas'
        : c.perdu === 0
          ? 'Raté… ton bouclier a tout paré'
          : `Raté… tu perds ${c.perdu} de courage`
  return {
    titre,
    lignes: [
      c.frappe > 0 && c.absorbee > 0 && c.perdu > 0 && `Ton bouclier a paré ${c.absorbee} de son attaque de ${c.frappe}`,
      c.brises > 0 && `Riposte : ${adversaire} perd ${c.brises}`,
      c.mise < 0 && `−${-c.mise} écus : ton pari est perdu`,
      c.victoire && `${adversaire} tombe quand même !`,
    ].filter((x): x is string => !!x),
  }
}

/** Ce qu'une carte jouée vient de faire, quand l'écran ne le montre pas de lui-même ; null : il le dit déjà. */
export function ceQueLaCarteAFait(cle: string): string | null {
  const c = carteDeRencontre(cle)
  if (!c) return null
  if (c.moment === 'pouvoir') return cle === 'abysses' ? `« ${c.nom} » est posée : elle t’a coûté 6 de courage` : `« ${c.nom} » agit pour toute la rencontre`
  if (cle === 'pioche') return 'Deux cartes de plus dans ta main'
  if (cle === 'feu-d-artifice') return 'Ta défausse revient dans ta pioche : trois cartes de plus'
  if (cle === 'horizon') return 'Ton courage te revient — et ta prochaine récompense sera vide'
  if (cle === 'reveil') return 'Deux d’énergie de plus pour cette question'
  return null
}

// ── Le départ ──────────────────────────────────────────────────────────────

/** Le choix de partir aux rencontres, et sa catégorie fétiche : retenus sur le téléphone, sous try/catch — un stockage refusé ne doit rien bloquer. */
const CLE_DES_RENCONTRES = 'quizz.expedition.rencontres'
const CLE_DE_LA_FETICHE = 'quizz.expedition.fetiche'

/** Parti aux rencontres la dernière fois — d'office oui, c'est le prototype qu'on essaie. */
export function rencontresRetenues(): boolean {
  try {
    return localStorage.getItem(CLE_DES_RENCONTRES) !== 'non'
  } catch {
    return true
  }
}

export function feticheRetenue(): string | null {
  try {
    const lue = localStorage.getItem(CLE_DE_LA_FETICHE)
    return lue && (CATEGORIES as readonly string[]).includes(lue) ? lue : null
  } catch {
    return null
  }
}

export function retenirLesRencontres(oui: boolean, fetiche: string | null) {
  try {
    localStorage.setItem(CLE_DES_RENCONTRES, oui ? 'oui' : 'non')
    if (fetiche) localStorage.setItem(CLE_DE_LA_FETICHE, fetiche)
    else localStorage.removeItem(CLE_DE_LA_FETICHE)
  } catch {
    // Un stockage refusé : le prochain départ reproposera les rencontres, sans catégorie fétiche.
  }
}

/**
 * Au départ, là où le prototype s'ouvre (la préproduction) : partir aux
 * rencontres — d'office — et sa catégorie fétiche, que l'Érudit fait vivre.
 * Ce que sont les rencontres, et les familles de son équipe, se lisent dans
 * les règles : deux paragraphes de plus sur le départ, « on s'y perd » (la
 * revue du 18 octobre 2026).
 */
export function AuDepart({
  actif,
  fetiche,
  onActif,
  onFetiche,
}: {
  actif: boolean
  fetiche: string | null
  onActif: (oui: boolean) => void
  onFetiche: (categorie: string | null) => void
}) {
  const [choisir, setChoisir] = useState(false)
  return (
    <section className="card exp-prototype" aria-labelledby="exp-prototype-titre">
      <div className="exp-section-tete">
        <h2 className="label" id="exp-prototype-titre">
          Les rencontres
          <span className="exp-pastille exp-pastille-or">prototype</span>
        </h2>
        <button type="button" role="switch" aria-checked={actif} aria-labelledby="exp-prototype-titre" className="exp-interrupteur" onClick={() => onActif(!actif)}>
          <i aria-hidden="true" />
        </button>
      </div>
      {actif ? (
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
      ) : (
        <p className="small">{espacesFines('Coupées : l’expédition part aux règles d’avant, trois vies et des jokers.')}</p>
      )}
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
            c.moment !== 'route' && coutDit(c),
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
  return (
    <>
      <span className="exp-offre-visage" style={gemmeDeLaCarte(c)} aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="exp-joker">
        <span className="exp-offre-nom">
          <b>{c.nom}</b>
          <span className={`exp-rarete exp-rarete-${c.rarete}`}>{RARETE_DE_LA_CARTE[c.rarete]}</span>
        </span>
        <span className="small">{espacesFines(c.effet)}</span>
        <span className="muted small">{espacesFines([c.moment !== 'route' && coutDit(c), MOMENT[c.moment]].filter(Boolean).join(' · '))}</span>
      </span>
      {prix}
    </>
  )
}

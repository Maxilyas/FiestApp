import { useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { Balise } from '../components/Balise'
import { Feuille } from '../components/Pieces'
import { espacesFines } from '../format'
import { gemme } from '../gemmes'
import { useModale } from '../modale'
import { iconeDuSujet } from '../iconeDuSujet'
import { couleurDePiste, pourcentDeChance } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { CATEGORIES } from '../../../shared/categories'
import type { Niveau } from '../../../shared/campagne'
import type { RareteDeTheme } from '../../../shared/themes'
import { duGardien, nomDuGardien, type FormeDEscale, type VueDeLExpedition } from '../../../shared/expedition'
import {
  CARTES_DES_RENCONTRES,
  CARTES_PAR_QUESTION,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_MAX,
  FAMILLES_DE_CARTES,
  INSPIRATION_PAR_QUESTION,
  MISES,
  apercuDuTour,
  carteDeRencontre,
  cartesDeCombat,
  chiffresApresLaCarte,
  famillesDeLEquipee,
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
  route: 'Sur la carte, une fois par acte',
}
const MOMENT_COURT: Record<MomentDUneCarte, string> = { preparation: 'avant la question', reflexe: 'pendant la question', pouvoir: 'toute la rencontre', route: 'sur la carte' }

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
  'quitte-ou-double': 'zap',
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

/** Un texte de carte, son « ✦ » dessiné : l'étincelle de l'inspiration, la même qu'au-dessus de la main. */
function avecLesSignes(texte: string): ReactNode {
  const morceaux = texte.split('✦')
  return morceaux.length === 1 ? texte : morceaux.flatMap((m, i) => (i === 0 ? [m] : [<Icon key={i} name="spark" />, m]))
}

/**
 * Ce qu'une carte coûte, en étincelles d'inspiration — les mêmes que celles
 * qu'il a, au-dessus de sa main : on voit ce qu'elle en mange. Rien :
 * « gratuite ».
 */
function CoutDeLaCarte({ cout }: { cout: number }) {
  if (cout === 0) return <span className="exp-gratuite">gratuite</span>
  return (
    <>
      {Array.from({ length: cout }, (_, i) => (
        <Icon key={i} name="spark" />
      ))}
    </>
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

export const ditDesCartes = (cles: readonly string[]) => comptesDesCartes(cles).map(c => (c.n > 1 ? `${c.nom} ×${c.n}` : c.nom))

/** Des cartes comptées, en jetons : la pioche, la défausse, le paquet. */
export function JetonsDeCartes({ cles, vide }: { cles: readonly string[]; vide: string }) {
  if (cles.length === 0) return <p className="muted small">{espacesFines(vide)}</p>
  return (
    <ul className="exp-jetons">
      {ditDesCartes(cles).map(t => (
        <li key={t} className="exp-jeton">
          {t}
        </li>
      ))}
    </ul>
  )
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
 * Son inspiration du tour, en étincelles : allumées, ce qui lui reste ;
 * éteintes, ce qu'il a dépensé des trois de chaque question.
 */
export function Inspiration({ n }: { n: number }) {
  const total = Math.max(n, INSPIRATION_PAR_QUESTION)
  return (
    <span className="exp-inspiration" role="img" aria-label={`${n} d’inspiration pour jouer tes cartes`}>
      {Array.from({ length: total }, (_, i) => (
        <Icon key={i} name="spark" className={i < n ? undefined : 'exp-eteinte'} />
      ))}
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

/**
 * Une carte de la main, entière : ce qu'elle coûte, son dessin, et ce qu'elle
 * fait en deux ou trois mots (`resume`) — on la comprend sans la lever. Une
 * carte qui ne se joue pas maintenant s'éteint ; touchée, elle se lève quand
 * même, et dit pourquoi.
 */
function FaceDeLaCarte({ c, refus, onToucher }: { c: CarteDeRencontre; refus: string | null; onToucher: () => void }) {
  return (
    <button
      type="button"
      className={'exp-face' + (refus ? ' exp-face-eteinte' : '')}
      style={gemmeDeLaCarte(c)}
      data-carte={c.cle}
      aria-haspopup="dialog"
      onClick={onToucher}
    >
      <span className="exp-face-cout" aria-hidden="true">
        <CoutDeLaCarte cout={c.cout} />
      </span>
      <span className="exp-face-dessin" aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="exp-face-dit" aria-hidden="true">
        {avecLesSignes(c.resume)}
      </span>
      <span className="sr-only">{`${c.nom} : ${c.resume.replace('✦', 'd’inspiration')}, ${c.cout === 0 ? 'gratuite' : `${c.cout} d’inspiration`}${refus ? ', pas maintenant' : ''}`}</span>
    </button>
  )
}

/** Sur la carte, ses cartes de route en petit : le dessin seul, au cadre de sa rareté. */
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
 * La main d'une rencontre : son inspiration en étincelles, puis ses cartes,
 * entières — avant la question, celles qui se jouent maintenant d'abord, puis,
 * à part et éteintes, celles qui se jouent pendant la question ; la question
 * vue, celles-là seules. Touchée, une carte se lève (`CarteLevee`) : ce
 * qu'elle fait, ce qu'elle changerait, puis « Jouer » — ou pourquoi elle ne
 * se joue pas maintenant, de la règle du serveur (`refus`). Sur la carte de
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
  poses = [],
  apercuDeLaCarte,
  onJouer,
  onMontrer,
}: {
  cles: readonly string[]
  refus: Readonly<Record<string, string | null>>
  busy: boolean
  enPetit?: boolean
  /** La pioche — le paquet, sur la carte — : combien, ce qu'elle dit à l'oreille, et ce qu'elle ouvre. */
  pile: { compte: number; mot: string; dit: string; onOuvrir: () => void }
  /** En rencontre : son inspiration du tour. */
  inspiration?: number
  /** Avant la question, ou pendant. */
  phase?: 'preparation' | 'question'
  /** Les cartes posées pour toute la rencontre. */
  poses?: readonly string[]
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
  const posees = poses.map(k => carteDeRencontre(k)).filter((c): c is CarteDeRencontre => !!c)
  const face = (x: { k: string; i: number; c: CarteDeRencontre }) => <FaceDeLaCarte key={`${x.k}:${x.i}`} c={x.c} refus={refus[x.k] ?? null} onToucher={() => setLevee(x.i)} />
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
  // La question vue, sans carte à jouer pendant ni pouvoir posé : rien à montrer, la question d'abord.
  if (phase === 'question' && maintenant.length === 0 && posees.length === 0) return null
  return (
    <>
      <section className="exp-cartes" aria-labelledby="exp-cartes-titre">
        <div className="exp-cartes-tete">
          <h2 className="label" id="exp-cartes-titre">
            Tes cartes
          </h2>
          {inspiration !== undefined && <Inspiration n={inspiration} />}
          <button type="button" className="link-inline small exp-cartes-tas" aria-haspopup="dialog" onClick={pile.onOuvrir}>
            <span aria-hidden="true">{`Pioche ${pile.compte}`}</span>
            <Icon name="chevron-right" />
            <span className="sr-only">{pile.dit}</span>
          </button>
        </div>
        {posees.length > 0 && (
          <ul className="exp-cartes-posees" aria-label="Posées pour toute la rencontre">
            {posees.map(c => (
              <li key={c.cle} style={gemmeDeLaCarte(c)}>
                <span className="exp-cartes-posee-visage" aria-hidden="true">
                  <VisageDeLaCarte c={c} />
                </span>
                {c.nom}
              </li>
            ))}
          </ul>
        )}
        {cles.length === 0 ? (
          <p className="exp-main-vide">{espacesFines('Ta main est vide : la question suivante en tire cinq.')}</p>
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
 * Une carte levée : en grand — ce qu'elle coûte, son dessin, son nom, ce
 * qu'elle fait en une phrase, quand elle se joue —, puis ce qu'elle
 * changerait à la réponse (« Avec cette carte : si tu as juste, il perd 6 → 10 »),
 * et le geste : la jouer, la poser, choisir la catégorie du Commandement,
 * montrer une réponse à l'Oracle ; ou pourquoi elle ne se joue pas
 * maintenant. Toucher à côté la repose, Échap aussi : un toucher perdu ne
 * coûte rien.
 */
export function CarteLevee({
  cle,
  refus,
  busy,
  changement,
  onJouer,
  onMontrer,
  onReposer,
}: {
  cle: string
  refus: string | null
  busy: boolean
  changement?: ChangementDeLaCarte | null
  onJouer: JouerUneCarte
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
  const choix = !refus && cle === 'commandement'
  const plus = plusDeLaCarte(c)
  return (
    <div className="carte-voile exp-leve-voile" onClick={onReposer}>
      <div className={'exp-leve' + (choix ? ' exp-leve-avec-choix' : '')} role="dialog" aria-modal="true" aria-label={c.nom} ref={boite} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="exp-grande" style={gemmeDeLaCarte(c)}>
          {c.moment !== 'route' && (
            <span className="exp-grande-cout" role="img" aria-label={c.cout === 0 ? 'Elle est gratuite' : `Elle coûte ${c.cout} d’inspiration`}>
              <CoutDeLaCarte cout={c.cout} />
            </span>
          )}
          {c.rarete !== 'commun' && <span className="exp-grande-rarete">{RARETE_DE_LA_CARTE[c.rarete]}</span>}
          <span className="exp-grande-dessin" aria-hidden="true">
            <VisageDeLaCarte c={c} />
          </span>
          <b className="exp-grande-nom">{c.nom}</b>
          <p className="exp-grande-effet">{espacesFines(c.effet)}</p>
          <span className="exp-grande-quand">
            <Icon name={ICONE_DU_MOMENT[c.moment]} />
            {MOMENT[c.moment]}
          </span>
          {plus.length > 0 && <span className="exp-grande-plus">{espacesFines(plus.join(' · '))}</span>}
        </div>
        {changement && <Changement c={changement} />}
        {refus ? (
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

/** Le cycle des cartes, en une fois : « on comprend pas bien ce qu'on a en main et comment les cartes reviennent » (le 18 octobre 2026). */
const REGLE_DU_CYCLE = `À chaque question, tu tires ${CARTES_PAR_QUESTION} cartes de ta pioche, et tu as ${INSPIRATION_PAR_QUESTION} d’inspiration pour les jouer. Celles que tu ne joues pas vont à la défausse ; quand ta pioche est vide, ta défausse y est remélangée. Une carte « une fois par rencontre » revient à la rencontre suivante, et chaque rencontre remélange tout ton paquet. Les cartes de route se jouent sur la carte, une fois par acte.`

/**
 * Ses tas, quand il touche la pioche : en rencontre, les cartes posées pour
 * toute la rencontre, ce qui reste à tirer — tout son paquet de combat, moins
 * ce qui a servi : sa composition se déduit, son ordre reste au serveur —, sa
 * défausse, ses cartes hors jeu jusqu'à la rencontre suivante ; puis tout son
 * paquet, et la règle du cycle.
 */
export function FeuilleDesCartes({ paquet, rencontre, onFermer }: { paquet: readonly string[]; rencontre?: VueDeLaRencontre; onFermer: () => void }) {
  const pioche = rencontre ? sans(cartesDeCombat(paquet), [...rencontre.main, ...rencontre.defausse, ...rencontre.epuisees, ...rencontre.pouvoirs]) : []
  const pouvoirs = (rencontre?.pouvoirs ?? []).map(cle => carteDeRencontre(cle)).filter((c): c is CarteDeRencontre => !!c)
  return (
    <Feuille titre={rencontre ? 'Tes cartes' : 'Ton paquet'} className="feuille-paquet" onFermer={onFermer}>
      {pouvoirs.length > 0 && (
        <section className="exp-main-section">
          <h3 className="label">Posées pour toute la rencontre</h3>
          <ul className="exp-poses-liste">
            {pouvoirs.map(c => (
              <li key={c.cle}>
                <b>{c.nom}</b> <span className="muted small">{espacesFines(c.effet)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rencontre && (
        <>
          <section className="exp-main-section">
            <h3 className="label">{`Ta pioche · ${rencontre.pioche}`}</h3>
            <JetonsDeCartes cles={pioche} vide="Ta pioche est vide : ta défausse y revient à la question suivante." />
          </section>
          <section className="exp-main-section">
            <h3 className="label">{`Ta défausse · ${rencontre.defausse.length}`}</h3>
            <JetonsDeCartes cles={rencontre.defausse} vide="Rien en défausse." />
          </section>
          {rencontre.epuisees.length > 0 && (
            <section className="exp-main-section">
              <h3 className="label">{`Hors jeu jusqu’à la rencontre suivante · ${rencontre.epuisees.length}`}</h3>
              <JetonsDeCartes cles={rencontre.epuisees} vide="" />
            </section>
          )}
        </>
      )}
      <section className="exp-main-section">
        <h3 className="label">{`Tout ton paquet · ${paquet.length}`}</h3>
        <JetonsDeCartes cles={paquet} vide="Ton paquet est vide." />
      </section>
      <p className="muted small">{espacesFines(REGLE_DU_CYCLE)}</p>
    </Feuille>
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

/** Le guide d'une rencontre, vu une fois : retenu sur le téléphone, sous try/catch — un stockage refusé le remontre, sans rien bloquer. */
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

/** Une rencontre, en cinq lignes : ce qu'il faut savoir pour jouer la première. */
const COMMENT_CA_MARCHE: readonly { icone: IconName; texte: string }[] = [
  { icone: 'check', texte: 'Réponds juste : l’adversaire perd des points. À zéro, il tombe.' },
  { icone: 'heart', texte: 'Si tu te trompes, il t’attaque : tu perds du courage.' },
  { icone: 'spark', texte: `Avant de voir la question, joue des cartes pour frapper plus fort ou te protéger. Elles coûtent de l’inspiration : tu en as ${INSPIRATION_PAR_QUESTION} à chaque question.` },
  { icone: 'eye', texte: 'Touche une carte : elle dit ce qu’elle fait, et ce qu’elle changerait.' },
  { icone: 'ecu', texte: 'Sûr de toi ? Parie des écus : juste, ton pari rapporte ; faux, tu le perds.' },
]

/**
 * Comment se joue une rencontre, en feuille : ouverte d'elle-même à la
 * première — l'écran reste celui qu'on joue, dessous —, puis à la demande.
 * Fermée d'une façon ou d'une autre, elle est vue : revenue à chaque
 * rencontre, elle lasserait.
 */
function CommentCaMarche({ onFermer }: { onFermer: () => void }) {
  return (
    <Feuille
      titre="Comment ça marche ?"
      className="feuille-guide"
      onFermer={onFermer}
      pied={
        <button type="button" className="btn btn-primary btn-block" onClick={onFermer}>
          Compris
        </button>
      }
    >
      <ol className="exp-guide">
        {COMMENT_CA_MARCHE.map(l => (
          <li key={l.icone}>
            <span className="exp-guide-icone" aria-hidden="true">
              <Icon name={l.icone} />
            </span>
            <span>{espacesFines(l.texte)}</span>
          </li>
        ))}
      </ol>
    </Feuille>
  )
}

/**
 * La préparation d'une question (le cœur du prototype), dans l'ordre où l'on
 * joue : l'adversaire et la question qu'il pose, ce que la réponse fera, les
 * cartes à jouer, le pari, puis « Voir la question » — le bouton au bout, plus
 * au-dessus des cartes qu'il fallait jouer avant lui. À la première
 * rencontre, le guide par-dessus. La question, tirée au serveur, n'arrive
 * qu'au geste qui la voit (invariant 1).
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
  const [aide, setAide] = useState(() => !guideVu())
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
        poses={r.pouvoirs}
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
      <button type="button" className="link-inline small exp-comment" aria-haspopup="dialog" onClick={() => setAide(true)}>
        <Icon name="help" />
        Comment ça marche ?
      </button>
      {tas && <FeuilleDesCartes paquet={vue.cartes?.paquet ?? []} rencontre={r} onFermer={() => setTas(false)} />}
      {aide && (
        <CommentCaMarche
          onFermer={() => {
            retenirLeGuide()
            setAide(false)
          }}
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
  if (cle === 'reveil') return 'Deux d’inspiration de plus pour cette question'
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
 * rencontres — d'office —, sa catégorie fétiche, que l'Érudit fait vivre, et
 * les familles que son équipée apporte aux récompenses.
 */
export function AuDepart({
  actif,
  fetiche,
  equipee,
  onActif,
  onFetiche,
}: {
  actif: boolean
  fetiche: string | null
  equipee: readonly string[]
  onActif: (oui: boolean) => void
  onFetiche: (categorie: string | null) => void
}) {
  const [choisir, setChoisir] = useState(false)
  const familles = famillesDeLEquipee(equipee)
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
      <p className="small">
        {espacesFines(
          actif
            ? 'Chaque escale à question est un adversaire à faire tomber, question après question. Avant de voir chaque question, tu joues tes cartes et tu paries ; ton courage remplace tes trois vies.'
            : 'Coupées : l’expédition part aux règles d’avant, trois vies et des jokers.',
        )}
      </p>
      {actif && (
        <>
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
          <p className="muted small">
            {espacesFines(
              familles.length > 0
                ? `Tes familles : ${familles.map(f => FAMILLES_DE_CARTES[f].nom).join(' et ')} — tes récompenses en proposent les cartes.`
                : 'Sans légendaire dans ton équipée, tes récompenses ne proposent que des cartes neutres.',
            )}
          </p>
        </>
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
            c.moment !== 'route' && (c.cout === 0 ? 'gratuite' : `${c.cout} d’inspiration`),
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
        <span className="muted small">{espacesFines([c.moment !== 'route' && (c.cout === 0 ? 'gratuite' : `${c.cout} d’inspiration`), MOMENT[c.moment]].filter(Boolean).join(' · '))}</span>
      </span>
      {prix}
    </>
  )
}

import { useEffect, useRef, type RefObject } from 'react'
import { Etoiles } from '../../../components/Etoiles'
import { Icon } from '../../../components/Icon'
import { espacesFines, formatNumber } from '../../../format'
import { questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import {
  AIDES_DU_FILET,
  ceQueCouvreLeFilet,
  cranDe,
  cransDe,
  milieuDeLaTranche,
  valeurAuCran,
  type AideMontree,
  type CleDAideDuFilet,
  type FiletEnDeuxTempsMontre,
  type FiletEnDeuxTempsRevele,
  type RepereDuFilet,
  type TrancheDuFilet,
} from '../../../../../shared/cabinet/jeux/filetEnDeuxTemps'
import type { FinDUneManche } from '../../../../../shared/cabinet/partie'
import { uniteAccordee } from '../../../../../shared/unites'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// Le Filet en deux temps à l'écran, une décision par écran depuis le 12 novembre 2026
// (`retours/2026-11-12/le-filet-en-deux-ecrans.md`, sa maquette jugée par le propriétaire) : d'abord l'époque — la
// question, puis quatre lignes qui disent leurs bornes et le repère que chacune porte, les aides collées au pied ; une
// époque touchée, l'année — la question en rappel, l'époque choisie et de quoi en changer, le nombre entre « − » et « + »,
// la piste de toute la largeur, son repère écrit dessus, « Lancer le filet » collé sous le pouce.
//
// Un seul écran portait tout jusque-là (le cahier des charges, `retours/2026-11-09/le-nouveau-filet.md`, § 3.1) : la
// frise, deux repères piqués au-dessus et redits en légende, l'indice, la piste, les aides et leur prix, le bouton. En
// 360 × 640, une époque touchée, il faisait une fois et demie à deux fois l'écran, treize à quinze cibles, « Lancer le
// filet » toujours sous le pli — « il y a énormément d'infos à l'écran, avec en plus un timer qui tourne », le retour que
// le propriétaire rapportait. En production, du 10 au 12 novembre, neuf lancers sur vingt et un partaient du milieu de
// l'époque, le curseur jamais touché, et les aides, sous le pli, n'avaient servi qu'à quatre manches.
//
// La page ne connaît jamais la valeur (invariant 1) : ni la bonne époque, ni celles que l'aide retirerait, ni l'indice
// avant qu'il le prenne. Elle tient l'époque choisie et le curseur, et les envoie au lancer — ou d'elle-même à
// l'échéance : l'époque seule vaut son étoile. Les étoiles se dessinent (`Etoiles`) ou se disent en mots, jamais en
// signes recopiés : « moins un, une étoile », disait le lecteur d'écran d'Hugo.

/** Ce que la page tient d'une manche : l'époque touchée et le curseur, posé au milieu d'elle dès qu'elle l'est. */
export interface LocalDuFiletEnDeuxTemps {
  readonly epoque: number | null
  readonly x: number | null
  /** « Changer d'époque » : l'écran des époques rouvert, la sienne gardée — la toucher, ou une autre, rouvre la piste. */
  readonly rechoisit?: true
}

/**
 * L'écran où en est la manche : l'époque, puis la valeur dès qu'une époque est touchée — sauf s'il rouvre les époques,
 * ou si « Deux époques de moins » a retiré la sienne : le choix revient à faire.
 */
export function ecranDe(m: Pick<FiletEnDeuxTempsMontre, 'retirees'>, l: LocalDuFiletEnDeuxTemps): 'epoque' | 'valeur' {
  return l.epoque !== null && l.x !== null && !l.rechoisit && !m.retirees.includes(l.epoque) ? 'valeur' : 'epoque'
}

/** Un nombre tel qu'on le lit : « 1962 », « 12 500 km », « 1 jour » — son unité accordée, jamais par `Intl` (règle `client.md`). */
const dire = (m: Pick<FiletEnDeuxTempsMontre, 'unite'>, v: number) => `${formatNumber(v)}${m.unite ? ` ${uniteAccordee(m.unite, v)}` : ''}`

/** Une borne d'époque s'écrit comme une année (« 1925 »), une borne de grandeur comme un nombre (« 1 000 »). */
const borneDite = (m: Pick<FiletEnDeuxTempsMontre, 'annee'>, v: number) => (m.annee ? String(v) : formatNumber(v))

/** Des étoiles en mots : « une étoile », « deux étoiles » — trois au plus, ce qu'une manche rapporte. */
export const etoilesEnMots = (n: number) => `${['aucune', 'une', 'deux', 'trois'][n] ?? String(n)} étoile${n > 1 ? 's' : ''}`

/** Ce que ses aides payées ont pris jusqu'ici, en étoiles : le filet, la consigne et la phrase des aides le retirent. */
export const etoilesPayees = (m: Pick<FiletEnDeuxTempsMontre, 'aides' | 'prixDUneAide'>) => m.aides.filter(a => a.prise === 'payee').length * m.prixDUneAide

/**
 * Toucher une époque : le curseur s'y pose au milieu — le propriétaire, au matin du 9 novembre 2026, « elle devrait se
 * placer directement au milieu » —, ou garde sa valeur si elle y tient encore, et la piste s'ouvre. Une époque retirée
 * ne se touche pas.
 */
export function choisirLEpoque(m: Pick<FiletEnDeuxTempsMontre, 'tranches' | 'retirees'>, l: LocalDuFiletEnDeuxTemps, i: number): LocalDuFiletEnDeuxTemps {
  const t = m.tranches[i]
  if (!t || m.retirees.includes(i)) return l
  const x = l.x !== null && l.x >= t.de && l.x <= t.a ? valeurAuCran(t, cranDe(t, l.x)) : milieuDeLaTranche(t)
  return { epoque: i, x }
}

/** « Changer d'époque » : les quatre époques reviennent, la sienne pressée, son curseur gardé. */
export function rouvrirLesEpoques(l: LocalDuFiletEnDeuxTemps): LocalDuFiletEnDeuxTemps {
  return l.epoque === null ? l : { epoque: l.epoque, x: l.x, rechoisit: true }
}

/** Le curseur posé au cran `i` de la piste ouverte ; sans époque, rien ne bouge. */
export function poserAuCran(m: Pick<FiletEnDeuxTempsMontre, 'tranches'>, l: LocalDuFiletEnDeuxTemps, i: number): LocalDuFiletEnDeuxTemps {
  if (l.epoque === null) return l
  return { ...l, x: valeurAuCran(m.tranches[l.epoque], i) }
}

/** Un grand pas : une graduation — 5 ans, 100 g —, un nombre rond, huit au plus sur la piste. Sans lui, Hugo touchait « − » 98 fois. */
export function cransDUnGrandPas(t: TrancheDuFilet): number {
  const brut = (t.a - t.de) / 8
  for (let p = 10 ** Math.floor(Math.log10(brut)); ; p *= 10) {
    for (const r of [1, 2, 5]) if (r * p >= brut - 1e-12) return Math.max(1, Math.round((r * p) / t.pas))
  }
}

/** Le nom d'une aide : à une grandeur, des ordres plutôt que des époques. */
const NOMS_DES_AIDES = (m: Pick<FiletEnDeuxTempsMontre, 'annee'>): Readonly<Record<CleDAideDuFilet, string>> => ({
  epoques: m.annee ? 'Deux époques de moins' : 'Deux ordres de moins',
  indice: 'Un indice',
})

/**
 * Ce que les aides coûtent, en une phrase au-dessus d'elles : ce qu'elle coûte, et ce qu'elle ne coûte jamais — Claire et
 * Samir ne l'apprenaient qu'à la révélation ; offerte, elle le dit (Huguette, sous « Prise · offerte », croyait avoir
 * payé) ; et tant que la carte qui éclaire peut servir, qu'elle offre la prochaine — la carte n'a plus de bouton à elle.
 * Chacune tient sur une ligne en 360 de large : sur deux, le pied collé mangeait la quatrième époque.
 */
export function phraseDesAides(m: Pick<FiletEnDeuxTempsMontre, 'aides' | 'prixDUneAide'>, eclaire?: { nom: string; jouable: boolean }): string {
  const payees = etoilesPayees(m)
  if (m.aides.some(a => a.prise === null) && eclaire?.jouable) return `${eclaire.nom} t’offre ta prochaine aide.`
  if (payees > 0) return `${m.aides.filter(a => a.prise === 'payee').length > 1 ? 'Tes aides' : 'Ton aide'} : ${etoilesEnMots(payees)}, jamais un cœur.`
  if (m.aides.some(a => a.prise === 'offerte')) return 'Ton aide était offerte.'
  return `Une aide : ${etoilesEnMots(m.prixDUneAide)}, jamais un cœur.`
}

/**
 * Une aide prise, sous son nom, accordée à lui : « pris » ou « offert » sous « Un indice », « retirées » ou « offertes » sous
 * « Deux époques de moins » — des ordres, au masculin. Ce qu'elles ont coûté ensemble se dit dans leur phrase.
 */
function priseDite(a: AideMontree, m: Pick<FiletEnDeuxTempsMontre, 'annee'>): string | null {
  if (a.prise === null) return null
  if (a.cle === 'indice') return a.prise === 'payee' ? 'pris' : 'offert'
  const e = m.annee ? 'es' : 's'
  return a.prise === 'payee' ? `retiré${e}` : `offert${e}`
}

/**
 * Où se pose une valeur sur la frise des quatre tranches, en pour cent : un quart chacune, régulière dedans — une année
 * occupe son année entière, d'où le demi-an.
 */
export function surLaFrise(m: Pick<FiletEnDeuxTempsMontre, 'tranches' | 'annee'>, x: number): number {
  const t = m.tranches
  if (x <= t[0].de) return 0
  if (x >= t[t.length - 1].a) return 100
  const j = Math.max(0, t.findIndex(u => x <= u.a))
  const u = t[j]
  const fin = m.annee ? u.a + 1 : u.a
  return (100 / t.length) * (j + (x - u.de + (m.annee ? 0.5 : 0)) / (fin - u.de))
}

/** La place d'une valeur sur la piste ouverte, en pour cent : régulière, d'un bord à l'autre de la tranche. */
const surLaPiste = (m: Pick<FiletEnDeuxTempsMontre, 'annee'>, t: TrancheDuFilet, x: number) =>
  Math.min(100, Math.max(0, m.annee ? (100 * (x - t.de + 0.5)) / (t.a + 1 - t.de) : (100 * (x - t.de)) / (t.a - t.de)))

/**
 * La frise des quatre tranches, à la révélation : chacune ses bornes, la bonne et son choix écrits dans leur case, les
 * repères au-dessus — un rond pour ceux de tout le monde, un losange pour les siens —, la réponse (▼, au-dessus) et le
 * lancer (▲, dessous) : chaque chose a sa forme et ses mots, jamais sa seule couleur (Samir, daltonien, confondait quatre
 * ronds). Pendant la manche, les époques sont des lignes (`LesEpoques`).
 */
function Frise({
  m,
  epoque,
  onChoisir,
  revele,
}: {
  m: Pick<FiletEnDeuxTempsMontre, 'tranches' | 'annee' | 'reperes' | 'retirees'>
  epoque: number | null
  onChoisir?: (i: number) => void
  revele?: Pick<FiletEnDeuxTempsRevele, 'valeur' | 'bonnes' | 'lancer'>
}) {
  return (
    <div className={'cab-epoques' + (m.reperes.length > 0 || revele ? '' : ' cab-epoques-nue')}>
      <div className="cab-epoques-marques" aria-hidden="true">
        {m.reperes.map(r => (
          <span key={`${r.valeur}|${r.texte}`} className={'cab-epoques-repere' + (r.sien ? ' cab-epoques-sien' : '')} style={{ left: `${surLaFrise(m, r.valeur).toFixed(2)}%` }} />
        ))}
        {revele && <span className="cab-epoques-reponse" style={{ left: `${surLaFrise(m, revele.valeur).toFixed(2)}%` }} />}
      </div>
      <div className="cab-tranches" role="group" aria-label={m.annee ? 'Quatre époques' : 'Quatre ordres de grandeur'}>
        {m.tranches.map((t, i) => {
          const retiree = m.retirees.includes(i)
          const bonne = revele?.bonnes.includes(i) === true
          const choisie = revele ? revele.lancer?.epoque === i : false
          const dit = revele ? (bonne ? (choisie ? 'la bonne, ton choix' : 'la bonne') : choisie ? 'ton choix' : '') : ''
          const classes = ['cab-tranche', retiree && 'cab-tranche-retiree', bonne && 'cab-tranche-bonne', choisie && 'cab-tranche-choisie'].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              className={classes}
              aria-pressed={revele ? undefined : epoque === i}
              aria-label={`De ${borneDite(m, t.de)} à ${borneDite(m, t.a)}${retiree ? ', retirée' : ''}${dit ? `, ${dit}` : ''}`}
              aria-disabled={revele !== undefined || retiree || undefined}
              {...toucher(() => !revele && !retiree && onChoisir?.(i))}
            >
              <span className="cab-tranche-de" aria-hidden="true">
                {borneDite(m, t.de)}
              </span>
              <span className="cab-tranche-a" aria-hidden="true">
                {borneDite(m, t.a)}
              </span>
              {dit && (
                <span className="cab-tranche-dit" aria-hidden="true">
                  {dit}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {revele?.lancer && (
        <div className="cab-epoques-marques-bas" aria-hidden="true">
          <span className="cab-epoques-lancer" style={{ left: `${surLaFrise(m, revele.lancer.x).toFixed(2)}%` }} />
        </div>
      )}
    </div>
  )
}

/** La légende de la frise, en mots : chaque forme, ce qu'elle marque — la valeur de chacune dite (« La réponse, 1946 »). */
function Legende({ m, revele }: { m: Pick<FiletEnDeuxTempsMontre, 'reperes' | 'unite'>; revele?: Pick<FiletEnDeuxTempsRevele, 'valeur' | 'lancer'> }) {
  const nomme = (r: RepereDuFilet) => `${dire(m, r.valeur)} · ${r.texte}${r.sien ? ' (ton repère)' : ''}`
  if (m.reperes.length === 0 && !revele) return null
  return (
    <ul className="cab-epoques-legende">
      {revele && (
        <li>
          <i aria-hidden="true">▼</i>
          {espacesFines(`La réponse, ${dire(m, revele.valeur)}`)}
        </li>
      )}
      {revele?.lancer && (
        <li>
          <i aria-hidden="true">▲</i>
          {espacesFines(`Ton lancer, ${dire(m, revele.lancer.x)}`)}
        </li>
      )}
      {m.reperes.map(r => (
        <li key={`${r.valeur}|${r.texte}`}>
          <i aria-hidden="true">{r.sien ? '◆' : '○'}</i>
          {espacesFines(nomme(r))}
        </li>
      ))}
    </ul>
  )
}

/** « 1 an », « 6 ans » ; « 6,3 % » : un écart tel qu'on le lit. */
const ecartDit = (m: Pick<FiletEnDeuxTempsMontre, 'annee'>, ecart: number) => (m.annee ? `${ecart}\u{a0}an${ecart > 1 ? 's' : ''}` : `${formatNumber(ecart)}\u{a0}%`)

/**
 * Les bornes d'une tranche comme on les lit sur sa ligne : « 1975 – 1999 », d'un seul tenant ; une grandeur dit son unité,
 * « 10 – 30 ans », « 1 000 – 3 000 m » — nue, « 10 – 30 » ne disait pas de quoi (le rendu du 12 novembre 2026).
 */
const bornesDites = (m: Pick<FiletEnDeuxTempsMontre, 'annee' | 'unite'>, t: TrancheDuFilet) =>
  `${borneDite(m, t.de)}\u{a0}–\u{a0}${borneDite(m, t.a)}${m.unite ? `\u{a0}${uniteAccordee(m.unite, t.a)}` : ''}`
/** … et à l'oreille : « De 1975 à 1999 », « De 10 à 30 ans ». */
const bornesALOreille = (m: Pick<FiletEnDeuxTempsMontre, 'annee' | 'unite'>, t: TrancheDuFilet) => `${borneDite(m, t.de)} à ${dire(m, t.a)}`

/** Le repère qu'une tranche porte : un par époque au plus (`REPERES_DU_FILET`) — le premier, pour une partie d'avant qui en aurait deux. */
const repereDe = (m: Pick<FiletEnDeuxTempsMontre, 'reperes'>, t: TrancheDuFilet): RepereDuFilet | undefined => m.reperes.find(r => r.valeur >= t.de && r.valeur <= t.a)

/**
 * Ce qu'un repère dit sur la ligne de son époque : son fait seul pour une année — la ligne dit déjà ses bornes, et l'année
 * en plus la faisait passer sur deux lignes —, sa grandeur devant pour une grandeur (« 330 m · La tour Eiffel ») : c'est
 * elle qui situe.
 */
const repereDit = (m: Pick<FiletEnDeuxTempsMontre, 'annee' | 'unite'>, r: RepereDuFilet) => (m.annee ? r.texte : `${dire(m, r.valeur)} · ${r.texte}`)

/**
 * Les quatre époques, une ligne chacune : ses bornes, et le repère qu'elle porte — une date que tout le monde connaît, ou
 * la sienne, marquée d'un losange. Des boutons qui disent tout cela à l'oreille et lequel est pressé ; une époque retirée
 * se replie sur ses bornes barrées. En frise de quatre cases jusqu'au 12 novembre 2026, deux repères piqués au-dessus et
 * redits en légende : « 1975 1999 » ne disait rien à personne, et la légende coûtait deux lignes.
 */
function LesEpoques({ m, epoque, onChoisir }: { m: Pick<FiletEnDeuxTempsMontre, 'tranches' | 'annee' | 'unite' | 'reperes' | 'retirees'>; epoque: number | null; onChoisir: (i: number) => void }) {
  return (
    // Sans un seul repère — une grandeur dont l'unité n'en a pas, le plus souvent —, les lignes sont plus basses (`styles.css`).
    <div className={m.tranches.some((t, i) => !m.retirees.includes(i) && repereDe(m, t)) ? 'cab-epoques-liste' : 'cab-epoques-liste cab-epoques-nues'} role="group" aria-label={m.annee ? 'Quatre époques' : 'Quatre ordres de grandeur'}>
      {m.tranches.map((t, i) => {
        const retiree = m.retirees.includes(i)
        const r = retiree ? undefined : repereDe(m, t)
        const dit = r ? `, ${r.sien ? 'ton repère' : 'repère'} : ${repereDit(m, r)}` : ''
        return (
          <button
            key={i}
            type="button"
            className={retiree ? 'cab-epoque cab-epoque-retiree' : 'cab-epoque'}
            aria-pressed={epoque === i}
            aria-label={`De ${bornesALOreille(m, t)}${retiree ? ', retirée' : dit}`}
            aria-disabled={retiree || undefined}
            {...toucher(() => !retiree && onChoisir(i))}
          >
            <b aria-hidden="true">{bornesDites(m, t)}</b>
            {r && (
              <span className={r.sien ? 'cab-epoque-repere cab-epoque-sien' : 'cab-epoque-repere'} aria-hidden="true">
                {espacesFines(repereDit(m, r))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Ce que le filet prend autour du curseur, chaque anneau ses étoiles. Une année : « à 2 ans », « à 6 ans », qui ne bouge
 * pas avec le curseur — deux fourchettes récrites à chaque cran faisaient quatre nombres de plus à lire, le chrono
 * courant. Une grandeur : les réponses qu'il prendrait, en nombres (« 125–141 ») — « à 25 %, il faut le calculer de
 * tête » (Claire, à la tablée du 9 novembre 2026). Une aide payée y retire son étoile, avant le lancer (Samir ne savait
 * pas si c'était « une étoile retirée de mon score, ou seulement le plafond qui baisse »). Des morceaux qui ne se coupent
 * pas ; sur une toute petite piste, les deux anneaux couvrent la même chose : un seul.
 */
function Couvre({ m, x, t }: { m: FiletEnDeuxTempsMontre; x: number; t: TrancheDuFilet }) {
  const payees = etoilesPayees(m)
  const c = ceQueCouvreLeFilet(m, x, t.pas >= 1)
  const morceau = (r: { de: number; a: number }) => (r.de === r.a ? `pile sur ${borneDite(m, r.de)}` : `${borneDite(m, r.de)}–${borneDite(m, r.a)}`)
  const trois = m.annee ? `à ${ecartDit(m, m.anneaux.trois)}` : morceau(c.trois)
  const deux = m.annee ? `à ${ecartDit(m, m.anneaux.deux)}` : morceau(c.deux)
  return (
    <p className="cab-filet-anneaux">
      <span className="cab-insecable">
        <Etoiles n={Math.max(0, 3 - payees)} />
        {espacesFines(trois)}
      </span>
      {deux !== trois && (
        <span className="cab-insecable">
          <Etoiles n={Math.max(0, 2 - payees)} />
          {espacesFines(deux)}
        </span>
      )}
    </p>
  )
}

/**
 * La piste de l'époque choisie : le nombre en grand entre « − » et « + », la piste de toute la largeur — entre ses deux
 * boutons, elle n'avait que 216 pixels sur 360 —, ses deux anneaux autour du curseur, le grand en tirets, le petit plein,
 * et le repère de l'époque écrit au-dessus de son mât (« comme Notre-Dame », 69 m, se cherchait à tâtons — Samir) ; ce que
 * le filet prend ; les grands pas d'une graduation. Le doigt pose le curseur où il touche, et lui donne le focus : c'est
 * le curseur même du navigateur. `curseur` : où le focus se pose quand la piste s'ouvre.
 */
function PisteDeLEpoque({ m, t, x, poser, busy, curseur }: { m: FiletEnDeuxTempsMontre; t: TrancheDuFilet; x: number; poser: (i: number) => void; busy: boolean; curseur: RefObject<HTMLInputElement | null> }) {
  const n = cransDe(t)
  const i = cranDe(t, x)
  const grand = cransDUnGrandPas(t)
  const grandDit = m.annee ? `${grand * t.pas}\u{a0}ans` : dire(m, grand * t.pas)
  const c = ceQueCouvreLeFilet(m, x, t.pas >= 1)
  const bande = (r: { de: number; a: number }) => {
    const g = surLaPiste(m, t, r.de - (m.annee ? 0.5 : 0))
    const d = surLaPiste(m, t, r.a + (m.annee ? 0.5 : 0))
    return { left: `${g.toFixed(2)}%`, width: `${Math.max(0, d - g).toFixed(2)}%` }
  }
  const reperes = m.reperes.filter(r => r.valeur >= t.de && r.valeur <= t.a)
  // Un trait à chaque grand pas : la piste se dit régulière à l'œil, sans les nombres, qui se chevauchaient sous un texte agrandi.
  const traits = Array.from({ length: Math.max(0, Math.ceil(n / grand) - 1) }, (_, k) => surLaPiste(m, t, valeurAuCran(t, (k + 1) * grand)))
  const enBas = i <= 0
  const enHaut = i >= n
  return (
    <section className="cab-filet-etape" aria-label={m.annee ? 'L’année' : 'La valeur'}>
      <div className="cab-filet-nombre">
        <button type="button" className="cab-cran" aria-label="Un cran de moins" aria-disabled={enBas || busy || undefined} {...toucher(() => !busy && !enBas && poser(i - 1))}>
          <span aria-hidden="true">−</span>
        </button>
        {/* Son unité à part, plus petite que son nombre : en grand, une unité longue sortait de l'écran (`styles.css`). */}
        <output className="cab-filet-valeur" aria-live="off">
          {borneDite(m, x)}
          {m.unite && <span className="cab-filet-unite">{` ${uniteAccordee(m.unite, x)}`}</span>}
        </output>
        <button type="button" className="cab-cran" aria-label="Un cran de plus" aria-disabled={enHaut || busy || undefined} {...toucher(() => !busy && !enHaut && poser(i + 1))}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div className="cab-filet-piste">
        {/* Le repère de l'époque, écrit : il glisse avec sa place — à gauche au début de la piste, à droite au bout —, son mât
            dessous. Décalé par `left`, jamais par une marge : elle lui prenait sa largeur, et un repère du bout de la piste
            s'écrivait un mot par ligne (« La fin de la Seconde Guerre mondiale », en six lignes, au rendu du 12 novembre 2026). */}
        {reperes.map(r => {
          const g = surLaPiste(m, t, r.valeur)
          return (
            <p key={`${r.valeur}|${r.texte}`} className={'cab-filet-drapeau' + (r.sien ? ' cab-filet-drapeau-sien' : '')} style={{ left: `${g.toFixed(2)}%`, transform: `translateX(-${g.toFixed(2)}%)` }}>
              <b>{borneDite(m, r.valeur)}</b>
              {espacesFines(` · ${r.texte}${r.sien ? ' (ton repère)' : ''}`)}
            </p>
          )
        })}
        <div className="cab-filet-glissiere">
          <div className="cab-filet-rail" aria-hidden="true">
            {traits.map(g => (
              <span key={g} className="cab-filet-trait" style={{ left: `${g.toFixed(2)}%` }} />
            ))}
            <span className="cab-filet-anneau cab-filet-anneau-deux" style={bande(c.deux)} />
            <span className="cab-filet-anneau cab-filet-anneau-trois" style={bande(c.trois)} />
            {reperes.map(r => (
              <span key={`${r.valeur}|${r.texte}`} className={'cab-filet-repere' + (r.sien ? ' cab-filet-sien' : '')} style={{ left: `${surLaPiste(m, t, r.valeur).toFixed(2)}%` }} />
            ))}
          </div>
          <input
            ref={curseur}
            type="range"
            className="cab-curseur"
            min={t.de}
            max={t.a}
            step={t.pas}
            value={x}
            aria-label={m.annee ? 'L’année' : 'La valeur'}
            aria-valuetext={dire(m, x)}
            onChange={e => !busy && poser(cranDe(t, e.currentTarget.valueAsNumber))}
          />
        </div>
      </div>
      <Couvre m={m} x={x} t={t} />
      <div className="cab-grands-pas">
        <button type="button" className="cab-cran cab-grand-pas" aria-label={`${grandDit} de moins`} aria-disabled={enBas || busy || undefined} {...toucher(() => !busy && !enBas && poser(i - grand))}>
          <span aria-hidden="true">{espacesFines(`−\u{a0}${grandDit}`)}</span>
        </button>
        <button type="button" className="cab-cran cab-grand-pas" aria-label={`${grandDit} de plus`} aria-disabled={enHaut || busy || undefined} {...toucher(() => !busy && !enHaut && poser(i + grand))}>
          <span aria-hidden="true">{espacesFines(`+\u{a0}${grandDit}`)}</span>
        </button>
      </div>
    </section>
  )
}

/** Ce qui paraît sous les yeux reçoit le focus — l'indice pris, ce qui reste après « Deux époques de moins » : Hugo, au lecteur d'écran, ne l'entendait pas. */
function useFocusQuandIlParait(cle: string | null) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (cle !== null) ref.current?.focus()
  }, [cle])
  return ref
}

/** L'indice pris, sous la question, où l'on choisit comme où l'on vise : sous les aides, il passait derrière le bouton du bas (Samir). */
function Indice({ m }: { m: Pick<FiletEnDeuxTempsMontre, 'indice'> }) {
  const ref = useFocusQuandIlParait(m.indice)
  if (!m.indice) return null
  return (
    <p ref={ref} className="cab-souffle cab-filet-indice" tabIndex={-1}>
      <Icon name="bulb" />
      <span>{espacesFines(`Indice : ${m.indice}`)}</span>
    </p>
  )
}

function MancheEnDeuxTemps({ montree: m, local: l, setLocal, garde, busy }: PropsDUneManche<FiletEnDeuxTempsMontre, LocalDuFiletEnDeuxTemps>) {
  const vise = ecranDe(m, l) === 'valeur'
  // « Deux époques de moins » a pu retirer celle qu'il avait touchée : le choix revient à faire.
  const epoque = l.epoque !== null && !m.retirees.includes(l.epoque) ? l.epoque : null
  const choisir = (i: number) => !busy && garde() && setLocal(choisirLEpoque(m, l, i))
  // Un cran se joue vite : deux touchers en font deux, sans la demi-seconde de garde — rien ne bouge sous le doigt.
  const poser = (i: number) => !busy && setLocal(poserAuCran(m, l, i))
  const rouvrir = () => !busy && garde() && setLocal(rouvrirLesEpoques(l))
  const restent = m.retirees.length > 0 ? m.tranches.filter((_, i) => !m.retirees.includes(i)) : []
  const restentDit = restent.length > 0 ? `Il reste ${restent.map(u => `${borneDite(m, u.de)}–${borneDite(m, u.a)}`).join(' et ')}.` : null
  const reste = useFocusQuandIlParait(restentDit)
  // D'un écran à l'autre, le focus suit : le curseur quand la piste s'ouvre — il dit sa valeur, et les flèches le
  // déplacent —, l'époque gardée quand les époques reviennent. Jamais à l'ouverture de la manche : le cadre y pose le sien.
  const curseur = useRef<HTMLInputElement>(null)
  const choisie = useRef<HTMLDivElement>(null)
  const dAvant = useRef(vise)
  useEffect(() => {
    if (dAvant.current === vise) return
    dAvant.current = vise
    if (vise) curseur.current?.focus()
    else choisie.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
  }, [vise])
  // La même question d'un écran à l'autre, sous une clé : le cadre y a posé le focus à l'ouverture de la manche.
  const question = (
    <h2 key="question" className={'quiz-question cab-question' + questionSizeClass(m.texte) + (vise ? ' cab-filet-rappel' : '')}>
      {espacesFines(m.texte)}
    </h2>
  )
  if (vise && epoque !== null && l.x !== null) {
    const t = m.tranches[epoque]
    return (
      <>
        {question}
        <button
          type="button"
          className="cab-filet-choisie"
          aria-label={`${m.annee ? 'Époque choisie' : 'Ordre de grandeur choisi'} : de ${bornesALOreille(m, t)}. ${m.annee ? 'Changer d’époque' : 'Changer d’ordre de grandeur'}`}
          aria-disabled={busy || undefined}
          {...toucher(rouvrir)}
        >
          <b aria-hidden="true">{bornesDites(m, t)}</b>
          <span aria-hidden="true">{m.annee ? 'changer d’époque' : 'changer'}</span>
        </button>
        <Indice m={m} />
        <PisteDeLEpoque m={m} t={t} x={l.x} poser={poser} busy={busy} curseur={curseur} />
      </>
    )
  }
  const quoi = m.annee ? 'l’époque' : 'l’ordre de grandeur'
  // La bonne époque vaut une étoile — le bon ordre de grandeur —, tant qu'une aide ne l'a pas prise.
  const vaut = etoilesPayees(m) === 0 ? (m.annee ? ', la bonne vaut une étoile' : ', le bon vaut une étoile') : ''
  return (
    <>
      {/* L'indice pris prend la place de la catégorie : il l'a lue en ouvrant la manche, et les deux ensemble poussaient la
          quatrième époque sous le pied. */}
      {!m.indice && <div className="cab-tete-question">{m.categorie && <span className="label quiz-categorie">{m.categorie}</span>}</div>}
      {question}
      <Indice m={m} />
      <section className="cab-filet-etape" ref={choisie}>
        <p className="cab-filet-consigne">
          {`Choisis ${quoi}`}
          {vaut && <span>{espacesFines(vaut)}</span>}
        </p>
        <LesEpoques m={m} epoque={epoque} onChoisir={choisir} />
      </section>
      {/* Ce qui reste, dit à l'oreille, où le focus se pose : à l'œil, les époques retirées se sont repliées. */}
      {restentDit && (
        <p ref={reste} className="sr-only cab-filet-restent" tabIndex={-1}>
          {espacesFines(restentDit)}
        </p>
      )}
    </>
  )
}

/**
 * Le pied collé de la manche, sous le pouce. Aux époques, les aides : leur phrase — ce qu'une aide coûte, jamais un cœur,
 * ou que la carte qui éclaire offre la prochaine —, puis une chacune ; offerte, elle part par Éclairer, qui la vise par
 * son rang, sinon elle se paie. Sous la piste, « Lancer le filet » : sous le pli, il ne se voyait qu'en défilant.
 */
export function PiedEnDeuxTemps({ montree: m, local: l, envoyer, garde, busy, eclaire }: PropsDUneManche<FiletEnDeuxTempsMontre, LocalDuFiletEnDeuxTemps>) {
  if (ecranDe(m, l) === 'valeur' && l.epoque !== null && l.x !== null) {
    const lancer = { epoque: l.epoque, x: l.x }
    return (
      <button type="button" className="btn btn-primary btn-big btn-block cab-lancer" aria-disabled={busy || undefined} {...toucher(() => !busy && garde() && envoyer({ quoi: 'repondre', reponse: { filet: lancer } }))}>
        Lancer le filet
      </button>
    )
  }
  const noms = NOMS_DES_AIDES(m)
  const offerte = eclaire?.jouable === true
  const aider = (cle: CleDAideDuFilet) => {
    if (busy || !garde()) return
    envoyer(offerte ? { quoi: 'eclairer', affirmation: AIDES_DU_FILET.indexOf(cle) } : { quoi: 'aide', aide: cle })
  }
  return (
    <section className="cab-filet-aides" aria-label="Les aides">
      <p className="cab-filet-prix">{espacesFines(phraseDesAides(m, eclaire))}</p>
      <div className={'cab-filet-aides-rangee' + (m.aides.length === 1 ? ' cab-filet-aides-une' : '')}>
        {m.aides.map(a => {
          const prise = priseDite(a, m)
          return (
            <button key={a.cle} type="button" className="cab-filet-aide" aria-disabled={a.prise !== null || busy || undefined} {...toucher(() => a.prise === null && aider(a.cle))}>
              <b>{noms[a.cle]}</b>
              {prise && <small>{espacesFines(prise)}</small>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * La révélation : la réponse et ce qu'il visait, la frise — ▼ la réponse, ▲ son lancer, la bonne et son choix écrits —,
 * d'où viennent les étoiles en une ligne, ce que les aides ont pris, et l'indice s'il l'avait pris. « La mauvaise époque,
 * mais si près de la réponse que la distance compte d'abord » : 2 ans d'écart valent trois étoiles, de l'autre côté
 * d'une borne. Ses étoiles, sa note (« −1 : ton aide ») et « Le savais-tu ? » sont au cadre (`RevelationDeLaManche`).
 */
function RevelationEnDeuxTemps({ corps: r, fin }: { corps: FiletEnDeuxTempsRevele; fin?: FinDUneManche }) {
  const critere = (ok: boolean, dit: string) => (
    <span className={ok ? 'cab-filet-oui' : 'cab-filet-non'}>
      <i aria-hidden="true">{ok ? '✓' : '✗'}</i>
      <span className="sr-only">{ok ? 'oui, ' : 'non, '}</span>
      {espacesFines(dit)}
    </span>
  )
  const pres = (n: number) => (r.annee ? `à ${ecartDit(r, n)} près` : `à ${n}\u{a0}% près`)
  // Les repères de la bonne époque et de celle qu'il a choisie, pas les quatre : un par ligne pendant la manche, ils
  // feraient ici quatre lignes de légende sous une frise qui en porte déjà deux.
  const concernees = [...r.bonnes, ...(r.lancer ? [r.lancer.epoque] : [])]
  const montre = { ...r, reperes: r.reperes.filter(x => concernees.some(k => x.valeur >= r.tranches[k].de && x.valeur <= r.tranches[k].a)) }
  return (
    <section className="cab-filet-revele" aria-label="La frise">
      <p className="cab-ligne cab-rappel">{espacesFines(r.texte)}</p>
      <p className="cab-filet-reponse">
        {espacesFines(`La réponse : ${dire(r, r.valeur)}`)}
        <span className="cab-filet-vise-dit">
          {espacesFines(!r.lancer || r.ecart === null ? 'tu n’as pas lancé' : `tu visais ${dire(r, r.lancer.x)} · ${r.ecart === 0 ? 'pile dessus' : `${ecartDit(r, r.ecart)} d’écart`}`)}
        </span>
      </p>
      <Frise m={montre} epoque={null} revele={r} />
      <Legende m={montre} revele={r} />
      {r.lancer && (
        <p className="cab-filet-juge">
          {critere(r.criteres.epoque, r.annee ? 'la bonne époque' : 'le bon ordre de grandeur')}
          {critere(r.criteres.deux, pres(r.anneaux.deux))}
          {critere(r.criteres.trois, pres(r.anneaux.trois))}
          {r.payees > 0 && <span>{espacesFines(`${r.aides.filter(a => !a.offerte).length > 1 ? 'tes aides' : 'ton aide'} : ${etoilesEnMots(r.payees)} en moins`)}</span>}
        </p>
      )}
      {r.lancer && !r.criteres.epoque && r.avantLesAides >= 2 && (
        <p className="cab-ligne">{espacesFines(`La mauvaise ${r.annee ? 'époque' : 'tranche'}, mais si près de la réponse que la distance compte d’abord.`)}</p>
      )}
      {r.payees > 0 && r.etoiles === 0 && r.avantLesAides > 0 && (
        <p className="cab-ligne">{espacesFines(r.payees > 1 ? 'Tes aides ont pris tes étoiles ; ton cœur reste.' : 'Ton aide a pris ton étoile ; ton cœur reste.')}</p>
      )}
      {!r.lancer && fin === 'jugee' && <p className="cab-ligne">{espacesFines('Le temps a filé avant que tu choisisses une époque : rien n’est parti.')}</p>}
      {r.indice && <p className="cab-ligne cab-filet-indice-dit">{espacesFines(`Indice : ${r.indice}`)}</p>}
    </section>
  )
}

export const FILET_EN_DEUX_TEMPS: JeuALEcran<FiletEnDeuxTempsMontre, FiletEnDeuxTempsRevele, LocalDuFiletEnDeuxTemps> = {
  // Rien de touché : l'époque se choisit d'abord, et la piste ne s'ouvre qu'alors, le curseur en son milieu.
  localDe: () => ({ epoque: null, x: null }),
  // La question et ses tranches : « Changer » en pose d'autres ; une aide n'y change rien, l'époque touchée reste.
  cleDe: m => `${m.texte}|${m.tranches.map(t => `${t.de}-${t.a}`).join(',')}`,
  // Ce qui est posé part à l'échéance, tel quel, les époques rouvertes ou non : l'époque seule vaut son étoile ; rien de touché, rien ne part.
  aLEcheance: (m, l) => (l.epoque !== null && l.x !== null && !m.retirees.includes(l.epoque) ? { filet: { epoque: l.epoque, x: l.x } } : undefined),
  // La carte qui éclaire offre une aide, celle qu'il touche : ses deux boutons le disent, la carte n'a pas le sien.
  tientEclairer: () => true,
  // Une époque touchée change l'écran — la piste à la place des époques, « Lancer le filet » à celle des aides —, et
  // « changer d'époque » le rend : un second toucher pressé tomberait sur ce qui vient sous le doigt, le cadre relance sa
  // demi-seconde de garde. Un cran ne bouge rien ; une aide rend une vue neuve, que le cadre garde de lui-même.
  sousEcranDe: (m, l) => `${ecranDe(m, l)}|${l.epoque}`,
  Manche: MancheEnDeuxTemps,
  Pied: PiedEnDeuxTemps,
  Revelation: RevelationEnDeuxTemps,
}

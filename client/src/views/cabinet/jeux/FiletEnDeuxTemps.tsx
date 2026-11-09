import { useEffect, useRef } from 'react'
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

// Le Filet en deux temps à l'écran (le cahier des charges, `retours/2026-11-09/le-nouveau-filet.md`, § 3.1 ; sa maquette
// jouée par trois tours de tablée, `maquette-filet/`) : un seul écran, de haut en bas — la question ; les quatre époques
// en frise, deux repères au plus au-dessus ; ce qu'une aide a donné ; dès qu'une époque est touchée, le gros chiffre, ce
// que le filet couvre et la piste de cette époque, le curseur posé en son milieu ; les aides et leur prix ; « Lancer le
// filet ». Rien ne se colle au bas de l'écran : le bouton du lancer y cachait la piste d'un petit écran (Huguette, Samir).
//
// La page ne connaît jamais la valeur (invariant 1) : ni la bonne époque, ni celles que l'aide retirerait, ni l'indice
// avant qu'il le prenne. Elle tient l'époque choisie et le curseur, et les envoie au lancer — ou d'elle-même à
// l'échéance : l'époque seule vaut son étoile. Les étoiles se dessinent (`Etoiles`) ou se disent en mots, jamais en
// signes recopiés : « moins un, une étoile », disait le lecteur d'écran d'Hugo.

/** Ce que la page tient d'une manche : l'époque touchée et le curseur, posé au milieu d'elle dès qu'elle l'est. */
export interface LocalDuFiletEnDeuxTemps {
  readonly epoque: number | null
  readonly x: number | null
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
 * placer directement au milieu » —, ou garde sa valeur si elle y tient encore. Une époque retirée ne se touche pas.
 */
export function choisirLEpoque(m: Pick<FiletEnDeuxTempsMontre, 'tranches' | 'retirees'>, l: LocalDuFiletEnDeuxTemps, i: number): LocalDuFiletEnDeuxTemps {
  const t = m.tranches[i]
  if (!t || m.retirees.includes(i)) return l
  const x = l.x !== null && l.x >= t.de && l.x <= t.a ? valeurAuCran(t, cranDe(t, l.x)) : milieuDeLaTranche(t)
  return { epoque: i, x }
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

/** Ce qu'une aide coûte, ou ce qu'elle a coûté : « Coûte une étoile », « Prise · une étoile en moins », « Prise · offerte ». */
function prixDe(a: AideMontree, m: Pick<FiletEnDeuxTempsMontre, 'prixDUneAide'>): string {
  if (a.prise === 'offerte') return 'Prise · offerte'
  if (a.prise === 'payee') return `Prise · ${etoilesEnMots(m.prixDUneAide)} en moins`
  return `Coûte ${etoilesEnMots(m.prixDUneAide)}`
}

/**
 * Le rang d'une aide que la carte Coup d'œil peut offrir : l'indice d'abord, s'il y en a un et qu'il reste ; sinon
 * l'autre. Plus rien : rien à viser — le serveur dit alors qu'il n'y a plus rien à éclairer.
 */
export function aideAOffrir(m: Pick<FiletEnDeuxTempsMontre, 'aides'>): number | undefined {
  const libres = m.aides.filter(a => a.prise === null).map(a => a.cle)
  const cle = libres.includes('indice') ? 'indice' : libres[0]
  return cle === undefined ? undefined : AIDES_DU_FILET.indexOf(cle)
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
 * La frise des quatre tranches : des boutons qui disent leurs bornes et lequel est pressé, les repères au-dessus — un rond
 * pour ceux de tout le monde, un losange pour les siens —, et à la révélation la réponse (▼, au-dessus) et le lancer (▲,
 * dessous) : chaque chose a sa forme et ses mots, jamais sa seule couleur (Samir, daltonien, confondait quatre ronds).
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
 * Ce que le filet couvre autour du curseur, en nombres, chaque anneau ses étoiles — « 1960–1964 » pour trois, « 1956–1968 »
 * pour deux : la règle se lit aussi sur la piste (Claire, à la tablée). Une aide payée y retire son étoile, avant le
 * lancer (Samir ne savait pas si c'était « une étoile retirée de mon score, ou seulement le plafond qui baisse »). Deux
 * morceaux qui ne se coupent pas : des étoiles seules en fin de ligne se lisaient avec la fourchette d'au-dessus
 * (Huguette). Sur une toute petite piste, les deux anneaux couvrent la même chose : un seul. Les anneaux portent le nom
 * de leurs étoiles (`AnneauxDuFilet`).
 */
function Couvre({ m, x, t }: { m: FiletEnDeuxTempsMontre; x: number; t: TrancheDuFilet }) {
  const c = ceQueCouvreLeFilet(m, x, t.pas >= 1)
  const payees = etoilesPayees(m)
  const morceau = (r: { de: number; a: number }) => (r.de === r.a ? `pile sur ${borneDite(m, r.de)}` : `${borneDite(m, r.de)}–${borneDite(m, r.a)}`)
  const trois = morceau(c.trois)
  const deux = morceau(c.deux)
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
 * La piste de l'époque choisie : le gros chiffre, ce que couvre le filet, la piste régulière — ses deux anneaux autour du
 * curseur, le grand en tirets, le petit plein, et les repères de cette époque descendus sur elle (« comme Notre-Dame »,
 * 69 m, se cherchait à tâtons — Samir) —, « − » et « + » d'un cran, et les grands pas d'une graduation. Le doigt pose le
 * curseur où il touche, et lui donne le focus : c'est le curseur même du navigateur.
 */
function PisteDeLEpoque({ m, t, x, poser, busy }: { m: FiletEnDeuxTempsMontre; t: TrancheDuFilet; x: number; poser: (i: number) => void; busy: boolean }) {
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
      <div className="cab-filet-vise">
        {/* Son unité à part, plus petite que son nombre : en grand, une unité longue sortait de l'écran (`styles.css`). */}
        <output className="cab-filet-valeur" aria-live="off">
          {borneDite(m, x)}
          {m.unite && <span className="cab-filet-unite">{` ${uniteAccordee(m.unite, x)}`}</span>}
        </output>
      </div>
      <Couvre m={m} x={x} t={t} />
      <div className="cab-filet-curseur">
        <button type="button" className="cab-cran" aria-label="Un cran de moins" aria-disabled={enBas || busy || undefined} {...toucher(() => !busy && !enBas && poser(i - 1))}>
          <span aria-hidden="true">−</span>
        </button>
        <div className="cab-filet-piste">
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
        <button type="button" className="cab-cran" aria-label="Un cran de plus" aria-disabled={enHaut || busy || undefined} {...toucher(() => !busy && !enHaut && poser(i + 1))}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
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

/**
 * Les aides et leur prix, en une phrase : ce qu'elle coûte, et ce qu'elle ne coûte jamais — Claire et Samir ne
 * l'apprenaient qu'à la révélation ; offerte, elle le dit (Huguette, sous « Prise · offerte », croyait avoir payé). La
 * carte Coup d'œil, posée sous la manche, en offre une (`cibleDEclairer`).
 */
function Aides({ m, aider, busy }: { m: FiletEnDeuxTempsMontre; aider: (cle: CleDAideDuFilet) => void; busy: boolean }) {
  const noms = NOMS_DES_AIDES(m)
  const payees = etoilesPayees(m)
  const offerte = m.aides.some(a => a.prise === 'offerte')
  const qui = m.aides.filter(a => a.prise === 'payee').length > 1 ? 'Tes aides' : 'Ton aide'
  const phrase =
    payees > 0
      ? `${qui} : ${etoilesEnMots(payees)} en moins, jamais un cœur.`
      : offerte
        ? 'Ton aide était offerte : elle ne te coûte rien.'
        : `Une aide coûte ${etoilesEnMots(m.prixDUneAide)}, jamais un cœur.`
  return (
    <section className="cab-filet-aides" aria-label="Les aides">
      <div className={'cab-filet-aides-rangee' + (m.aides.length === 1 ? ' cab-filet-aides-une' : '')}>
        {m.aides.map(a => (
          <button key={a.cle} type="button" className="cab-filet-aide" aria-disabled={a.prise !== null || busy || undefined} {...toucher(() => a.prise === null && aider(a.cle))}>
            <b>{noms[a.cle]}</b>
            <small>{espacesFines(prixDe(a, m))}</small>
          </button>
        ))}
      </div>
      <p className="cab-ligne cab-filet-prix">{espacesFines(phrase)}</p>
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

function MancheEnDeuxTemps({ montree: m, local: l, setLocal, envoyer, garde, busy }: PropsDUneManche<FiletEnDeuxTempsMontre, LocalDuFiletEnDeuxTemps>) {
  // « Deux époques de moins » a pu retirer celle qu'il avait touchée : le choix revient à faire.
  const epoque = l.epoque !== null && !m.retirees.includes(l.epoque) ? l.epoque : null
  const t = epoque !== null ? m.tranches[epoque] : null
  const x = t && l.x !== null ? l.x : null
  const choisir = (i: number) => !busy && garde() && setLocal(choisirLEpoque(m, l, i))
  // Un cran se joue vite : deux touchers en font deux, sans la demi-seconde de garde — rien ne bouge sous le doigt.
  const poser = (i: number) => !busy && setLocal(poserAuCran(m, { epoque, x }, i))
  const aider = (cle: CleDAideDuFilet) => !busy && garde() && envoyer({ quoi: 'aide', aide: cle })
  const lancer = () => !busy && garde() && epoque !== null && x !== null && envoyer({ quoi: 'repondre', reponse: { filet: { epoque, x } } })
  const restent = m.retirees.length > 0 ? m.tranches.filter((_, i) => !m.retirees.includes(i)) : []
  const restentDit = restent.length > 0 ? `Il reste ${restent.map(u => `${borneDite(m, u.de)}–${borneDite(m, u.a)}`).join(' et ')}.` : null
  const indice = useFocusQuandIlParait(m.indice)
  const reste = useFocusQuandIlParait(restentDit)
  const quoi = m.annee ? 'l’époque' : 'l’ordre de grandeur'
  // La bonne époque vaut une étoile, tant qu'une aide ne l'a pas prise.
  const vaut = etoilesPayees(m) === 0 ? ', la bonne vaut une étoile' : ''
  return (
    <>
      <div className="cab-tete-question">{m.categorie && <span className="label quiz-categorie">{m.categorie}</span>}</div>
      <h2 className={'quiz-question cab-question' + questionSizeClass(m.texte)}>{espacesFines(m.texte)}</h2>
      <section className="cab-filet-etape">
        <p className="cab-filet-consigne">
          {epoque === null ? `Choisis ${quoi}` : m.annee ? 'L’époque' : 'L’ordre de grandeur'}
          {vaut && <span>{espacesFines(vaut)}</span>}
        </p>
        <Frise m={m} epoque={epoque} onChoisir={choisir} />
        <Legende m={m} />
      </section>
      {restentDit && (
        <p ref={reste} className="cab-ligne cab-filet-restent" tabIndex={-1}>
          {espacesFines(restentDit)}
        </p>
      )}
      {m.indice && (
        <p ref={indice} className="cab-souffle" tabIndex={-1}>
          <Icon name="bulb" />
          {espacesFines(`Indice : ${m.indice}`)}
        </p>
      )}
      {t && x !== null && <PisteDeLEpoque m={m} t={t} x={x} poser={poser} busy={busy} />}
      <Aides m={m} aider={aider} busy={busy} />
      <button type="button" className="btn btn-primary btn-big btn-block cab-lancer" aria-disabled={busy || epoque === null || undefined} {...toucher(lancer)}>
        {epoque === null ? `Choisis d’abord ${m.annee ? 'une époque' : 'un ordre de grandeur'}` : 'Lancer le filet'}
      </button>
    </>
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
  return (
    <section className="cab-filet-revele" aria-label="La frise">
      <p className="cab-ligne cab-rappel">{espacesFines(r.texte)}</p>
      <p className="cab-filet-reponse">
        {espacesFines(`La réponse : ${dire(r, r.valeur)}`)}
        <span className="cab-filet-vise-dit">
          {espacesFines(!r.lancer || r.ecart === null ? 'tu n’as pas lancé' : `tu visais ${dire(r, r.lancer.x)} · ${r.ecart === 0 ? 'pile dessus' : `${ecartDit(r, r.ecart)} d’écart`}`)}
        </span>
      </p>
      <Frise m={r} epoque={null} revele={r} />
      <Legende m={r} revele={r} />
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
  // Rien de touché : l'époque se choisit d'abord, et le curseur ne paraît qu'alors, en son milieu.
  localDe: () => ({ epoque: null, x: null }),
  // La question et ses tranches : « Changer » en pose d'autres ; une aide n'y change rien, l'époque touchée reste.
  cleDe: m => `${m.texte}|${m.tranches.map(t => `${t.de}-${t.a}`).join(',')}`,
  // Ce qui est posé part à l'échéance, tel quel : l'époque seule vaut son étoile ; rien de touché, rien ne part.
  aLEcheance: (m, l) => (l.epoque !== null && l.x !== null && !m.retirees.includes(l.epoque) ? { filet: { epoque: l.epoque, x: l.x } } : undefined),
  // La carte Coup d'œil offre une aide : l'indice d'abord, s'il en reste un.
  cibleDEclairer: m => aideAOffrir(m),
  // Une époque touchée ouvre sa piste sous la frise : les aides et « Lancer le filet » glissent vers le bas, et un second
  // toucher pressé tomberait sur ce qui vient sous le doigt — le cadre relance sa demi-seconde de garde. Un cran ne bouge
  // rien ; une aide rend une vue neuve, que le cadre garde de lui-même.
  sousEcranDe: (_m, l) => String(l.epoque),
  Manche: MancheEnDeuxTemps,
  Revelation: RevelationEnDeuxTemps,
}

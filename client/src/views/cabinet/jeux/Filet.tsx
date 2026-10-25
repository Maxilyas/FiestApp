import type { ReactNode } from 'react'
import { Etoiles } from '../../../components/Etoiles'
import { Icon } from '../../../components/Icon'
import { espacesFines, formatNumber } from '../../../format'
import { questionSizeClass } from '../../../games/quiz/questionSize'
import { toucher } from '../../../toucher'
import { ETOILES_DU_FILET } from '../../../../../shared/cabinet/bareme'
import { TAILLES_DU_FILET, demiLargeur, milieuDeLaPiste, type FiletMontre, type FiletRevele, type PisteDuFilet, type TailleDuFilet } from '../../../../../shared/cabinet/jeux/filet'
import { decimales } from '../../../../../shared/classement'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// Le Filet à l'écran (§ 3.5) : une année ou une estimation de la base, sur une
// piste tirée au départ. Il place son curseur — au doigt sur la piste, ou cran
// par cran, « − » et « + » de part et d'autre —, choisit la taille de son
// filet — petit, il rapporte plus —, et le lance. La page ne connaît jamais la
// valeur (invariant 1) : elle ne montre que la piste, ses bornes, le filet
// qu'il tient et la zone dorée qu'Éclairer a donnée, et c'est le serveur qui
// juge si la réponse est dedans (`ecartEstimation`, invariant 15).
//
// Le filet se dessine à sa vraie largeur sous le curseur (`demiLargeur`, la
// règle même), et se dit en mots — « Ton filet : de 1846 à 1858 » —, aux crans
// de la piste qu'il prend : arrondies au plus près, ses bornes promettaient
// une année qu'il ne prenait pas.
//
// Ce que la page tient — le curseur et la taille — part d'elle-même à
// l'échéance, s'il y a touché : le curseur part du milieu, et le milieu
// d'office n'est pas un lancer (la règle de la maquette, qui a fermé « la
// réponse toujours au milieu de la piste »). Recharger le perd : rien de cela
// ne disait la réponse (§ 2.8).

/** Ce que la page tient d'une manche du Filet : où est le curseur, la taille de son filet, et s'il y a touché. */
export interface LocalDuFilet {
  readonly x: number
  readonly taille: TailleDuFilet
  readonly touche: boolean
}

/** Les trois filets, en mots : la page dit leur taille, leurs étoiles viennent du barème. */
const NOMS: Readonly<Record<TailleDuFilet, string>> = { petit: 'Petit', moyen: 'Moyen', grand: 'Grand' }

/** Un nombre sur un cran de la piste — compté depuis sa borne basse —, écrit comme il se lit, sans le reste d'une virgule flottante. */
const ecrit = (p: PisteDuFilet, x: number) => Number(x.toFixed(decimales(p.pas)))
const auCran = (p: PisteDuFilet, x: number, arrondi: (n: number) => number) => ecrit(p, p.min + arrondi((x - p.min) / p.pas) * p.pas)
const surLaPiste = (p: PisteDuFilet, x: number) => Math.min(p.max, Math.max(p.min, x))

/** Le curseur posé à `x` : sur le cran le plus proche, dans la piste. */
export function bouger(m: FiletMontre, l: LocalDuFilet, x: number): LocalDuFilet {
  return { ...l, x: surLaPiste(m.piste, auCran(m.piste, x, Math.round)), touche: true }
}

/** « − » et « + » : un cran de la piste, jamais au-delà de ses bornes. */
export const cran = (m: FiletMontre, l: LocalDuFilet, sens: 1 | -1): LocalDuFilet => bouger(m, l, l.x + sens * m.piste.pas)

/**
 * Ce que le filet lancé là prend, aux crans de la piste : le premier et le
 * dernier qui y tombent — vers l'intérieur, à la virgule flottante près, comme
 * le serveur le jugera (un bord pile y est).
 */
export function bornesDuFilet(x: number, taille: TailleDuFilet, p: PisteDuFilet): { de: number; a: number } {
  const w = demiLargeur(taille, p)
  return { de: surLaPiste(p, auCran(p, x - w, n => Math.ceil(n - 1e-9))), a: surLaPiste(p, auCran(p, x + w, n => Math.floor(n + 1e-9))) }
}

/**
 * La zone dorée d'Éclairer, aux crans de la piste — vers l'extérieur : la
 * réponse y est, et arrondie au plus près, la zone dite aurait pu la laisser
 * dehors.
 */
export function bornesDeLaZone(z: { de: number; a: number }, p: PisteDuFilet): { de: number; a: number } {
  return { de: surLaPiste(p, auCran(p, z.de, n => Math.floor(n + 1e-9))), a: surLaPiste(p, auCran(p, z.a, n => Math.ceil(n - 1e-9))) }
}

/** Une place sur la piste, en pour cent de sa longueur, coupée à ses bords. */
const pourCent = (p: PisteDuFilet, v: number) => Math.round(10_000 * Math.min(1, Math.max(0, (v - p.min) / (p.max - p.min)))) / 100

/** Le filet lancé là, sur la piste, en pour cent : là où il commence et finit, coupé à ses bords. */
export function ouEstLeFilet(x: number, taille: TailleDuFilet, p: PisteDuFilet): { de: number; a: number } {
  const w = demiLargeur(taille, p)
  return { de: pourCent(p, x - w), a: pourCent(p, x + w) }
}

/** Un nombre de la piste, tel qu'on le lit : « 1852 », « 12 500 km » — jamais par `Intl` (règle `client.md`). */
const dire = (m: Pick<FiletMontre, 'unite'>, v: number) => `${formatNumber(v)}${m.unite ? ` ${m.unite}` : ''}`

/**
 * La piste, dessinée : son rail, la zone dorée d'Éclairer, le filet — qu'il
 * tient, ou qu'il a lancé —, la vraie valeur à la révélation, et ses deux
 * bornes dessous. Le curseur se pose sur le rail même (`children`) : son
 * bouton y glisse dans le filet qu'il tire. Dessinés l'un sous l'autre, le
 * rail du filet et celui du curseur faisaient deux pistes, et le filet ne
 * suivait pas le doigt. Le rail est pour l'œil : le curseur, ses crans et
 * les mots autour le disent à l'oreille.
 */
function Piste({ m, filet, vrai, children }: { m: Pick<FiletMontre, 'piste' | 'zone' | 'unite'>; filet: { de: number; a: number } | null; vrai?: number; children?: ReactNode }) {
  const p = m.piste
  return (
    <div className="cab-filet-piste">
      <div className="cab-filet-rail" aria-hidden="true">
        {m.zone && <span className="cab-filet-zone" style={{ left: `${pourCent(p, m.zone.de)}%`, width: `${pourCent(p, m.zone.a) - pourCent(p, m.zone.de)}%` }} />}
        {filet && <span className="cab-filet-maille" style={{ left: `${filet.de}%`, width: `${Math.round(100 * (filet.a - filet.de)) / 100}%` }} />}
        {vrai !== undefined && <span className="cab-filet-vrai" style={{ left: `${pourCent(p, vrai)}%` }} />}
      </div>
      {children}
      <p className="cab-filet-bornes">
        <span>{dire(m, p.min)}</span>
        <span>{dire(m, p.max)}</span>
      </p>
    </div>
  )
}

/** Ce qu'Éclairer a donné, en mots aussi : la couleur de la zone ne le dit pas seule. */
function ZoneDite({ m }: { m: FiletMontre }) {
  if (!m.zone) return null
  const z = bornesDeLaZone(m.zone, m.piste)
  return (
    <p className="cab-souffle">
      <Icon name="bulb" />
      {espacesFines(`Indice : la réponse est entre ${dire(m, z.de)} et ${dire(m, z.a)}.`)}
    </p>
  )
}

function MancheDuFilet({ montree: m, local: l, setLocal, envoyer, garde, busy }: PropsDUneManche<FiletMontre, LocalDuFilet>) {
  const p = m.piste
  const filet = bornesDuFilet(l.x, l.taille, p)
  const lancer = () => !busy && garde() && envoyer({ quoi: 'repondre', reponse: { filet: { x: l.x, taille: l.taille } } })
  // Un cran de plus ou de moins se joue vite : deux touchers en font deux, sans la demi-seconde de garde — rien ne bouge sous le doigt.
  const unCran = (sens: 1 | -1) => !busy && setLocal(cran(m, l, sens))
  const enBas = l.x <= p.min
  const enHaut = l.x >= p.max
  return (
    <>
      <div className="cab-tete-question">{m.categorie && <span className="label quiz-categorie">{m.categorie}</span>}</div>
      <h2 className={'quiz-question cab-question' + questionSizeClass(m.texte)}>{espacesFines(m.texte)}</h2>
      <div className="cab-filet-vise">
        <output className="cab-filet-valeur" aria-live="off">
          {dire(m, l.x)}
        </output>
        <span className="cab-filet-couvre">{espacesFines(`Ton filet : de ${dire(m, filet.de)} à ${dire(m, filet.a)}`)}</span>
      </div>
      <div className="cab-filet-curseur">
        <button type="button" className="cab-cran" aria-label="Un cran de moins" aria-disabled={enBas || busy || undefined} {...toucher(() => unCran(-1))}>
          <span aria-hidden="true">−</span>
        </button>
        <Piste m={m} filet={ouEstLeFilet(l.x, l.taille, p)}>
          <input
            type="range"
            className="cab-curseur"
            min={p.min}
            max={p.max}
            step={p.pas}
            value={l.x}
            aria-label="Ton estimation"
            aria-valuetext={dire(m, l.x)}
            onChange={e => !busy && setLocal(bouger(m, l, e.currentTarget.valueAsNumber))}
          />
        </Piste>
        <button type="button" className="cab-cran" aria-label="Un cran de plus" aria-disabled={enHaut || busy || undefined} {...toucher(() => unCran(1))}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <ZoneDite m={m} />
      <div className="cab-tailles" role="group" aria-label="La taille de ton filet">
        {TAILLES_DU_FILET.map(t => (
          <button key={t} type="button" className="cab-taille" aria-pressed={l.taille === t} {...toucher(() => !busy && garde() && setLocal({ ...l, taille: t, touche: true }))}>
            <b>{NOMS[t]}</b>
            <Etoiles n={ETOILES_DU_FILET[t]} />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-big btn-block cab-lancer" aria-disabled={busy || undefined} {...toucher(lancer)}>
        Lancer le filet
      </button>
    </>
  )
}

/**
 * La révélation : la question, la réponse et ce qu'il visait, la piste — la
 * vraie valeur marquée, le filet qu'il a lancé là où il l'a lancé, la zone
 * d'Éclairer s'il l'avait —, et quel filet c'était. Sans lancer, la réponse
 * seule.
 */
function RevelationDuFilet({ corps: r }: { corps: FiletRevele }) {
  const lance = r.lancer
  return (
    <section className="cab-filet-revele" aria-label="La piste">
      <p className="cab-ligne cab-rappel">{espacesFines(r.texte)}</p>
      <p className="cab-filet-reponse">{espacesFines(`La réponse : ${dire(r, r.valeur)}${lance ? ` · tu visais ${dire(r, lance.x)}` : ''}`)}</p>
      <Piste m={r} filet={lance && ouEstLeFilet(lance.x, lance.taille, r.piste)} vrai={r.valeur} />
      {lance && (
        <p className="cab-ligne cab-filet-lance">
          {`Le ${NOMS[lance.taille].toLowerCase()} filet`}
          <Etoiles n={ETOILES_DU_FILET[lance.taille]} />
        </p>
      )}
    </section>
  )
}

export const FILET: JeuALEcran<FiletMontre, FiletRevele, LocalDuFilet> = {
  // Le curseur part du milieu, comme la règle le pose (`milieuDeLaPiste`), et le moyen filet d'office, comme la maquette.
  localDe: m => ({ x: milieuDeLaPiste(m.piste), taille: 'moyen', touche: false }),
  // La question et sa piste : « Changer » en pose d'autres ; la zone d'Éclairer n'y change rien, le curseur reste où il est.
  cleDe: m => `${m.texte}|${m.piste.min}|${m.piste.max}|${m.piste.pas}`,
  aLEcheance: (_m, l) => (l.touche ? { filet: { x: l.x, taille: l.taille } } : undefined),
  // Pas de `sousEcranDe` : rien ne bouge sous le doigt sans une vue neuve — le curseur et le filet glissent sous lui, il les y mène.
  Manche: MancheDuFilet,
  Revelation: RevelationDuFilet,
}

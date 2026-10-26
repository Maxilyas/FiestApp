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
// piste tirée au départ. Il place son curseur — au doigt sur la piste, cran
// par cran, « − » et « + » de part et d'autre, ou à grands pas, un dixième de
// la piste, dessous —, choisit la taille de son filet — petit, il rapporte
// plus —, et le lance. La page ne connaît jamais la valeur (invariant 1) :
// elle ne montre que la piste, ses bornes, le filet
// qu'il tient et la zone dorée qu'Éclairer a donnée, et c'est le serveur qui
// juge si la réponse est dedans (`ecartEstimation`, invariant 15).
//
// Le filet se dessine à sa vraie largeur sous le curseur (`demiLargeur`, la
// règle même), et se dit en mots — « Ton filet : de 1846 à 1858 » —, aux crans
// de la piste qu'il prend : arrondies au plus près, ses bornes promettaient
// une année qu'il ne prenait pas.
//
// Ce que la page tient — le curseur et la taille — part d'elle-même à
// l'échéance, tel qu'il est, comme la maquette lançait au temps écoulé : au
// milieu et moyen s'il n'y a pas touché. « Lancer le filet » touché d'emblée
// joue ce même lancer, et la piste tirée — la réponse n'importe où sur elle
// (`POSITION_DE_LA_REPONSE`) — ne paie plus le milieu ; refusé, ce lancer
// donnait « Pas de lancer » à qui laissait le curseur là où il croyait la
// réponse. Recharger le perd : rien de cela ne disait la réponse (§ 2.8).

/** Ce que la page tient d'une manche du Filet : où est le curseur, et la taille de son filet. */
export interface LocalDuFilet {
  readonly x: number
  readonly taille: TailleDuFilet
}

/** Les trois filets, en mots : la page dit leur taille, leurs étoiles viennent du barème. */
const NOMS: Readonly<Record<TailleDuFilet, string>> = { petit: 'Petit', moyen: 'Moyen', grand: 'Grand' }

/** Un nombre sur un cran de la piste — compté depuis sa borne basse —, écrit comme il se lit, sans le reste d'une virgule flottante. */
const ecrit = (p: PisteDuFilet, x: number) => Number(x.toFixed(decimales(p.pas)))
const auCran = (p: PisteDuFilet, x: number, arrondi: (n: number) => number) => ecrit(p, p.min + arrondi((x - p.min) / p.pas) * p.pas)
const surLaPiste = (p: PisteDuFilet, x: number) => Math.min(p.max, Math.max(p.min, x))

/** Le curseur posé à `x` : sur le cran le plus proche, dans la piste. */
export function bouger(m: FiletMontre, l: LocalDuFilet, x: number): LocalDuFilet {
  return { ...l, x: surLaPiste(m.piste, auCran(m.piste, x, Math.round)) }
}

/** « − » et « + » : un cran de la piste, jamais au-delà de ses bornes. */
export const cran = (m: FiletMontre, l: LocalDuFilet, sens: 1 | -1): LocalDuFilet => bouger(m, l, l.x + sens * m.piste.pas)

/** Un grand pas : un dixième de la piste, à son cran près — jamais moins d'un cran —, comme « Page suivante » sur un curseur. */
const longueurDUnGrandPas = (p: PisteDuFilet) => Math.max(p.pas, Math.round((p.max - p.min) / 10 / p.pas) * p.pas)

/**
 * Un grand pas de plus ou de moins, jamais au-delà des bornes : de là où le
 * curseur part, toute valeur de la piste se prend en cinq grands pas et la
 * moitié d'un grand pas en crans — quinze au plus : la plus longue piste que
 * tire le Filet a 290 crans (`pisteDuFilet`), un grand pas de 29. Sans glisser — au lecteur d'écran, d'un pouce qui
 * tremble —, « Un cran de plus » demandait soixante touchers à Camille, et la
 * ramette restait hors d'atteinte pour Hugo (la tablée du 25 octobre 2026).
 */
export const grandPas = (m: FiletMontre, l: LocalDuFilet, sens: 1 | -1): LocalDuFilet => bouger(m, l, l.x + sens * longueurDUnGrandPas(m.piste))

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
  // Un grand pas de même.
  const unCran = (sens: 1 | -1) => !busy && setLocal(cran(m, l, sens))
  const unGrandPas = (sens: 1 | -1) => !busy && setLocal(grandPas(m, l, sens))
  // Ce que fait un grand pas, à l'œil : « − 12 », « + 1 500 km » ; à l'oreille, son nom suffit, le curseur dit où il arrive. Le
  // signe tient à son nombre (une espace insécable) : seule l'unité passe à la ligne quand la rangée manque de place.
  const grand = dire(m, longueurDUnGrandPas(p))
  const enBas = l.x <= p.min
  const enHaut = l.x >= p.max
  return (
    <>
      <div className="cab-tete-question">{m.categorie && <span className="label quiz-categorie">{m.categorie}</span>}</div>
      <h2 className={'quiz-question cab-question' + questionSizeClass(m.texte)}>{espacesFines(m.texte)}</h2>
      <div className="cab-filet-vise">
        {/* Son unité à part, plus petite que son nombre : en grand, une unité longue sortait de l'écran (`styles.css`). */}
        <output className="cab-filet-valeur" aria-live="off">
          {formatNumber(l.x)}
          {m.unite && <span className="cab-filet-unite">{` ${m.unite}`}</span>}
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
      <div className="cab-grands-pas">
        <button type="button" className="cab-cran cab-grand-pas" aria-label="Un grand pas de moins" aria-disabled={enBas || busy || undefined} {...toucher(() => unGrandPas(-1))}>
          <span aria-hidden="true">{espacesFines(`−\u{a0}${grand}`)}</span>
        </button>
        <button type="button" className="cab-cran cab-grand-pas" aria-label="Un grand pas de plus" aria-disabled={enHaut || busy || undefined} {...toucher(() => unGrandPas(1))}>
          <span aria-hidden="true">{espacesFines(`+\u{a0}${grand}`)}</span>
        </button>
      </div>
      <ZoneDite m={m} />
      <div className="cab-tailles" role="group" aria-label="La taille de ton filet">
        {TAILLES_DU_FILET.map(t => (
          <button key={t} type="button" className="cab-taille" aria-pressed={l.taille === t} {...toucher(() => !busy && garde() && setLocal({ ...l, taille: t }))}>
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
 * Quel filet il a lancé : dedans, ses étoiles, gagnées ; à côté, ce qu'il
 * valait, en mots — « Le grand filet ★☆☆ » après un filet raté s'entendait
 * « une étoile sur trois », comme un gain (Hugo, au lecteur d'écran, à la
 * tablée du 25 octobre 2026).
 */
function FiletLance({ lance, dedans }: { lance: NonNullable<FiletRevele['lancer']>; dedans: boolean }) {
  const nom = `Le ${NOMS[lance.taille].toLowerCase()} filet`
  const valait = ETOILES_DU_FILET[lance.taille]
  return dedans ? (
    <p className="cab-ligne cab-filet-lance">
      {nom}
      <Etoiles n={valait} />
    </p>
  ) : (
    <p className="cab-ligne cab-filet-lance">{`${nom} (il valait ${valait} étoile${valait > 1 ? 's' : ''})`}</p>
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
      {lance && <FiletLance lance={lance} dedans={r.dedans} />}
    </section>
  )
}

export const FILET: JeuALEcran<FiletMontre, FiletRevele, LocalDuFilet> = {
  // Le curseur part du milieu, comme la règle le pose (`milieuDeLaPiste`), et le moyen filet d'office, comme la maquette.
  localDe: m => ({ x: milieuDeLaPiste(m.piste), taille: 'moyen' }),
  // La question et sa piste : « Changer » en pose d'autres ; la zone d'Éclairer n'y change rien, le curseur reste où il est.
  cleDe: m => `${m.texte}|${m.piste.min}|${m.piste.max}|${m.piste.pas}`,
  aLEcheance: (_m, l) => ({ filet: { x: l.x, taille: l.taille } }),
  // Pas de `sousEcranDe` : rien ne bouge sous le doigt sans une vue neuve — le curseur et le filet glissent sous lui, il les y mène.
  Manche: MancheDuFilet,
  Revelation: RevelationDuFilet,
}

import { Fragment } from 'react'
import { Icon, type IconName } from '../../../components/Icon'
import { espacesFines } from '../../../format'
import { toucher } from '../../../toucher'
import { ERREURS_D_UN_OUBLI } from '../../../../../shared/cabinet/bareme'
import type { FriseMontree, FriseRevelee } from '../../../../../shared/cabinet/jeux/frise'
import { anneeDite } from '../../../../../shared/frise'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// La Frise à l'écran (§ 3.2) : une seule frise qui grandit d'une manche à
// l'autre — trois événements à ranger, puis deux de plus parmi eux, puis deux
// encore. Ceux d'avant sont à leur vraie place, leur année dite (les ancres) ;
// les nouveaux venus attendent au-dessus de la frise, sans la leur — sauf
// celle qu'Éclairer a dévoilée —, et se posent au doigt : « Touche un
// événement, puis l'endroit où il va ». Pas de glisser-déposer : un doigt qui
// glisse fait défiler la page, et la grand-mère au petit téléphone ne tenait
// pas un événement le temps de traverser sept lignes. Un toucher prend
// l'événement, un second le pose à l'une des places que « Poser ici » ouvre
// entre les autres ; un événement posé se touche à nouveau pour se déplacer.
//
// La page range sans rien dire au serveur, qui ne connaît que la réponse :
// « Valider la frise », ou la frise telle qu'elle est à l'échéance, envoyée
// d'elle-même (`aLEcheance`) — un nouveau venu laissé de côté y compte pour
// `ERREURS_D_UN_OUBLI` erreurs, et l'écran le dit tant qu'il en reste. Elle
// renvoie ses jetons, du plus ancien au plus récent selon lui : jamais elle ne
// connaît l'ordre du temps des nouveaux venus (invariant 1). Recharger perd ce
// qu'elle tenait — rien de cela ne disait la réponse (§ 2.8).
//
// Tout se lit de haut en bas, dans l'ordre où l'on joue : ce qui reste à
// poser, la frise et ses places, « Valider la frise ». Collés au bas de
// l'écran comme dans la maquette, la réserve et « Valider » prenaient les
// trois quarts d'un 360 × 640 à la première manche — trois libellés de deux
// lignes —, et la frise ne se voyait plus du tout.

/** Ce que la page tient d'une manche de la Frise : la frise rangée à moitié, et le nouveau venu qu'il tient. */
export interface LocalDeLaFrise {
  /** Les jetons posés, du plus ancien au plus récent selon lui : les ancres, dans leur ordre, et les nouveaux venus qu'il a posés. */
  readonly ordre: readonly number[]
  /** Le nouveau venu touché, qui attend sa place — dans la réserve, ou déjà posé et qu'il déplace. */
  readonly choisi: number | null
}

/**
 * Toucher un nouveau venu le prend ; le toucher encore le lâche. Une ancre ne
 * se prend pas : elle est à sa vraie place, et le serveur refuserait une frise
 * qui l'aurait bougée.
 */
export function choisirSurLaFrise(m: FriseMontree, l: LocalDeLaFrise, jeton: number): LocalDeLaFrise {
  if (!m.nouveaux.some(n => n.jeton === jeton)) return l
  return { ordre: l.ordre, choisi: l.choisi === jeton ? null : jeton }
}

/**
 * Le nouveau venu qu'il tient, posé à la place `place` — de 0, tout en haut,
 * au nombre de posés, tout en bas —, et lâché. Déjà posé, il quitte sa place
 * d'abord : les places se comptent sur la frise qu'il voyait, lui compris.
 */
export function poserIci(l: LocalDeLaFrise, place: number): LocalDeLaFrise {
  const j = l.choisi
  if (j === null) return l
  const avant = l.ordre.indexOf(j)
  const sans = l.ordre.filter(x => x !== j)
  const k = Math.max(0, Math.min(avant >= 0 && avant < place ? place - 1 : place, sans.length))
  return { ordre: [...sans.slice(0, k), j, ...sans.slice(k)], choisi: null }
}

/** « 2 erreurs » : ce que coûte un nouveau venu laissé de côté, au nombre du barème. */
const ERREURS_DITES = `${ERREURS_D_UN_OUBLI} erreur${ERREURS_D_UN_OUBLI > 1 ? 's' : ''}`

/** Un événement de la manche par son jeton : une ancre, ou un nouveau venu. */
function evenementDe(m: FriseMontree, jeton: number): { libelle: string; annee?: number; ancre: boolean } | undefined {
  const a = m.ancres.find(x => x.jeton === jeton)
  if (a) return { libelle: a.libelle, annee: a.annee, ancre: true }
  const n = m.nouveaux.find(x => x.jeton === jeton)
  return n && { libelle: n.libelle, annee: n.annee, ancre: false }
}

/** Ce que l'oreille entend d'une place : où elle est, entre quels événements. */
function ouEstLaPlace(m: FriseMontree, ordre: readonly number[], k: number): string {
  const lib = (j: number | undefined) => `« ${evenementDe(m, j ?? -1)?.libelle ?? ''} »`
  if (ordre.length === 0) return ''
  if (k === 0) return `, tout en haut, avant ${lib(ordre[0])}`
  if (k === ordre.length) return `, tout en bas, après ${lib(ordre[k - 1])}`
  return `, entre ${lib(ordre[k - 1])} et ${lib(ordre[k])}`
}

/** L'année d'un événement, ou, pour un nouveau venu pas encore daté, sa place vide : la frise garde sa colonne. */
function Annee({ annee }: { annee?: number }) {
  return annee !== undefined ? (
    <b className="cab-annee">{anneeDite(annee)}</b>
  ) : (
    <span className="cab-annee cab-sans-annee" aria-hidden="true">
      ?
    </span>
  )
}

function MancheDeLaFrise({ montree: m, local: l, setLocal, envoyer, garde, busy }: PropsDUneManche<FriseMontree, LocalDeLaFrise>) {
  const agir = (suivant: LocalDeLaFrise) => {
    if (!busy && garde()) setLocal(suivant)
  }
  const reste = m.nouveaux.filter(n => !l.ordre.includes(n.jeton))
  const attend = reste.length !== 0
  const valider = () => !attend && !busy && garde() && envoyer({ quoi: 'repondre', reponse: { frise: { ordre: [...l.ordre] } } })
  const consigne =
    l.choisi !== null
      ? 'Touche « Poser ici » à l’endroit où il va.'
      : attend
        ? 'Touche un événement à poser, puis l’endroit où il va.'
        : 'Tout est posé : valide, ou touche un événement pour le déplacer.'
  // Les places où poser ce qu'il tient : entre chaque événement, et aux deux bouts.
  const place = (k: number) =>
    l.choisi !== null && (
      <li key={`place:${k}`} className="cab-place">
        <button type="button" className="cab-poser-ici" aria-disabled={busy || undefined} {...toucher(() => agir(poserIci(l, k)))}>
          <Icon name="plus" />
          Poser ici
          <span className="sr-only">{espacesFines(ouEstLaPlace(m, l.ordre, k))}</span>
        </button>
      </li>
    )
  return (
    <>
      <div className="cab-tete-question">
        <span className="cab-surtitre">{espacesFines(m.theme)}</span>
      </div>
      <p className="cab-ligne cab-consigne" aria-live="polite">
        {espacesFines(consigne)}
      </p>
      {/* Ce qui reste à poser, chacun un bouton qu'on prend, et ce qu'un oubli coûtera à la fin du temps. */}
      {attend && (
        <section className="cab-reserve" aria-label="À poser">
          <span className="cab-surtitre">À poser</span>
          <ul className="cab-a-poser-liste">
            {reste.map(n => (
              <li key={n.jeton}>
                <button type="button" className="cab-a-poser" aria-pressed={l.choisi === n.jeton} aria-disabled={busy || undefined} {...toucher(() => agir(choisirSurLaFrise(m, l, n.jeton)))}>
                  {n.annee !== undefined && <b className="cab-annee">{anneeDite(n.annee)}</b>}
                  <span className="cab-libelle">{espacesFines(n.libelle)}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* Une ligne, pas deux : la place qui s'ouvre sous la frise doit rester dans l'écran du 360 × 640. */}
          <p className="cab-oubli">{espacesFines(`Laissé de côté à la fin : ${ERREURS_DITES}.`)}</p>
        </section>
      )}
      <Sens vers="ancien" />
      <ol className="cab-frise" aria-label="La frise, du plus ancien au plus récent">
        {place(0)}
        {l.ordre.length === 0 && l.choisi === null && <li className="cab-frise-vide">{espacesFines('Rien de posé pour l’instant.')}</li>}
        {l.ordre.map((j, k) => {
          const e = evenementDe(m, j)
          if (!e) return null
          return (
            <Fragment key={j}>
              {e.ancre ? (
                <li className="cab-evenement cab-ancre">
                  <Annee annee={e.annee} />
                  <span className="cab-libelle">{espacesFines(e.libelle)}</span>
                </li>
              ) : (
                <li className="cab-evenement cab-nouveau">
                  <button type="button" className="cab-pose" aria-pressed={l.choisi === j} aria-disabled={busy || undefined} {...toucher(() => agir(choisirSurLaFrise(m, l, j)))}>
                    <Annee annee={e.annee} />
                    <span className="cab-libelle">{espacesFines(e.libelle)}</span>
                  </button>
                </li>
              )}
              {place(k + 1)}
            </Fragment>
          )
        })}
      </ol>
      <Sens vers="recent" />
      <button type="button" className="btn btn-primary btn-big btn-block cab-valider" aria-disabled={attend || busy || undefined} {...toucher(valider)}>
        Valider la frise
      </button>
      {attend && <p className="cab-raison">{`Encore ${reste.length} à poser`}</p>}
    </>
  )
}

/** Le sens de la frise, en haut et en bas, en mots : « ↑ Plus ancien » — la tablée ne savait pas de quel côté commençait le temps. */
function Sens({ vers }: { vers: 'ancien' | 'recent' }) {
  return <p className="cab-sens">{vers === 'ancien' ? '↑ Plus ancien' : '↓ Plus récent'}</p>
}

/** Ce que dit la révélation d'un nouveau venu, en mots et en dessin — jamais la couleur seule. */
const PLACES: Record<NonNullable<FriseRevelee['rangee'][number]['place']>, { classe: string; icone: IconName; dit: string }> = {
  juste: { classe: 'cab-a-sa-place', icone: 'check', dit: 'À sa place' },
  faux: { classe: 'cab-mal-place', icone: 'x', dit: 'Pas à sa place' },
  'pas-pose': { classe: 'cab-pas-pose', icone: 'help', dit: 'Pas posé' },
}

/**
 * La révélation : la frise à sa place, chaque événement à son année — les
 * ancres telles quelles, chaque nouveau venu marqué : à sa place, pas à sa
 * place, ou laissé de côté —, et ce qu'un oubli a coûté. Un mal placé se lit
 * à sa vraie année, la phrase du dessus le dit une fois : sous chacun, la
 * marque prenait deux lignes. Les fautes et les oublis se disent à part
 * (`FriseRevelee.faux`, `pasPoses`) : un événement laissé de côté compte deux
 * fois, et « 2 erreurs » sous un seul événement marqué tromperait.
 */
function RevelationDeLaFrise({ corps: r }: { corps: FriseRevelee }) {
  return (
    <div className="cab-frise-revelee">
      {r.faux > 0 && <p className="cab-ligne">{espacesFines('Ceux qui n’étaient pas à leur place : les voici à leur vraie année.')}</p>}
      <Sens vers="ancien" />
      <ol className="cab-frise" aria-label="La frise à sa place, du plus ancien au plus récent">
        {r.rangee.map((e, i) => {
          const p = e.place ? PLACES[e.place] : null
          return (
            <li key={i} className={'cab-evenement ' + (p ? p.classe : 'cab-ancre')}>
              <b className="cab-annee">{anneeDite(e.annee)}</b>
              <span className="cab-libelle">{espacesFines(e.libelle)}</span>
              {p && (
                <span className="cab-marque">
                  <Icon name={p.icone} />
                  {espacesFines(p.dit)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <Sens vers="recent" />
      {r.pasPoses > 0 && <p className="cab-ligne cab-oubli">{espacesFines(`Laissé de côté, un événement compte ${ERREURS_DITES}.`)}</p>}
    </div>
  )
}

export const FRISE: JeuALEcran<FriseMontree, FriseRevelee, LocalDeLaFrise> = {
  localDe: m => ({ ordre: m.ancres.map(a => a.jeton), choisi: null }),
  // Les libellés seuls : Éclairer date un nouveau venu sans changer la manche, et la frise rangée à moitié ne repart pas de zéro.
  cleDe: m => `${m.vague}:${[...m.ancres, ...m.nouveaux].map(e => e.libelle).join('|')}`,
  aLEcheance: (_m, l) => ({ frise: { ordre: [...l.ordre] } }),
  // Chaque événement pris ou posé change ce qui est sous le doigt — les places s'ouvrent, la frise s'allonge — sans que l'écran
  // change : la demi-seconde de garde repart, et un double toucher ne prend pas l'événement remonté sous lui.
  sousEcranDe: (_m, l) => `${l.ordre.join(',')}|${l.choisi ?? ''}`,
  Manche: MancheDeLaFrise,
  Revelation: RevelationDeLaFrise,
}

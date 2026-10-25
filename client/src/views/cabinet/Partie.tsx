import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { aLaDemande, useALaDemande, type ALaDemande } from '../../aLaDemande'
import { api, motifDe, refusDuServeur } from '../../api'
import { serverNow } from '../../clock'
import { confirmDialog, fermerLeDialogue, promptDialog } from '../../components/Dialog'
import { Etoiles } from '../../components/Etoiles'
import { GerbeDeJuste } from '../../components/Gerbe'
import { Icon, type IconName } from '../../components/Icon'
import { NicheALaRevelation } from '../../components/NicheReagit'
import { Sortie } from '../../components/Pieces'
import { TimerBar } from '../../components/TimerBar'
import { rendreLeFocus } from '../../focus'
import { espacesFines } from '../../format'
import { insister } from '../../insister'
import { nicheRetientSonSouffle } from '../../niche'
import { useGardeRetour, type IssueDuRetour } from '../../retour'
import { showToast } from '../../state'
import { toucher } from '../../toucher'
import { SIGNALEMENT_MAX } from '../../../../shared/campagne'
import { gesteAccepte } from '../../../../shared/console'
import { reactionDuSolo, type ReactionALaRevelation } from '../../../../shared/niche'
import { ETOILES_D_UNE_JUSTE, ETOILES_D_UNE_PARTIE, MANCHES_PAR_PARTIE } from '../../../../shared/cabinet/bareme'
import type { CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { POUVOIRS, refusDuPouvoir, type CleDePouvoir } from '../../../../shared/cabinet/pouvoirs'
import type { MancheMontree, RevelationDUneManche } from '../../../../shared/cabinet/jeux/index'
import type { GesteDuCabinet, Manche, ReponseDUnJeu } from '../../../../shared/cabinet/partie'
import type { RevelationVue, VueDeLaPartie } from '../../../../shared/cabinet/vues'
import type { BilanDeLaPartie } from './Bilan'

// Une partie du Cabinet à l'écran (§ 2.2-2.7 de la conception) : le cadre
// d'une manche — la tête collée (les trois manches, les étoiles sur neuf,
// « Quitter », le chrono), la manche de son jeu, le pied collé (la carte-bonus
// et son geste, la suite) —, la mise qui se décide sans avoir vu, le voile de
// la pause, la révélation, puis le bilan (`Bilan.tsx`, à la demande).
//
// Rien ne s'y juge : la page envoie des gestes, au rang qu'elle croit suivre
// (invariant 12), et montre la vue que le serveur rend — un geste passé (un
// double toucher, un autre onglet) rend la vue d'à présent, où elle se range.
// Le chrono se lit à l'heure du serveur (`serverNow`, invariant 6), jamais à
// celle du téléphone ; à l'échéance, la page envoie d'elle-même ce qu'elle
// tenait (`repondre`, `auto`) — l'Éclair, ses réponses ; la Frise, ce qu'elle a
// rangé ; le Pari et le Détail, rien —, et
// insiste tant que le réseau manque : son rang la garde d'un double. Le
// serveur a une grâce pour le réseau ; la page ne la recopie pas, elle n'en
// a pas besoin.
//
// Chaque jeu a son écran, chargé à la demande (`ECRANS`, demandé dès
// l'annonce) : un module de `jeux/` qui dit ce que la page tient seule d'une
// manche, ce qui part à l'échéance, la manche et sa révélation. La page n'en
// importe que des types de ses règles (`shared/cabinet/jeux/`) — elles jugent.

// ── L'écran d'un jeu ──────────────────────────────────────────────────────

/** Un geste du jeu, tel que son écran l'envoie : le cadre y ajoute la manche, l'appel le rang. */
export type GesteDuJeu = SansManche<Extract<GesteDuCabinet, { manche: Manche }>>
/** `Omit` geste par geste : sur l'union entière, il n'en gardait que les clés communes. */
type SansManche<T> = T extends unknown ? Omit<T, 'manche'> : never

/**
 * Où une manche trouve ses images : sa partie, et l'indice de son contenu dans
 * le plan figé (`VueDeLaPartie.tirage`, `RevelationVue.tirage`) — l'adresse
 * d'un cadrage du Détail les porte (`adresseDUnCadrage`), jamais la manche :
 * après « Changer », la même manche joue un autre tableau, et le cache du
 * téléphone aurait rendu l'image d'avant. Absent, pour les révélations écrites
 * à la main des épreuves : pas d'image à demander.
 */
export interface OuEstLaManche {
  partie: string
  tirage?: number
}

export interface PropsDUneManche<M, L> extends OuEstLaManche {
  montree: M
  /** Ce que la page tient seule de la manche : les réponses de l'Éclair, l'affirmation sous les yeux, la frise rangée à moitié. */
  local: L
  setLocal: (l: L) => void
  envoyer: (g: GesteDuJeu) => void
  /** La demi-seconde après un changement d'écran : un toucher qui y tombe était destiné à l'écran d'avant. */
  garde: () => boolean
  busy: boolean
}

/**
 * L'écran d'un jeu : ce dont le cadre a besoin pour lui, sans rien de ses
 * règles. Pur : la manche montrée (`MancheMontree`) et ce que la page tient
 * (`L`) suffisent.
 */
export interface JeuALEcran<M, R, L> {
  /** Ce que la page tient au début d'une manche. */
  localDe(m: M): L
  /** Ce qui distingue le contenu d'une manche : « Changer » en pose un autre, et ce que la page tenait repart de zéro. */
  cleDe(m: M): string
  /** Ce qui part de soi-même à l'échéance : ce que la page tenait, ou rien — la manche se juge alors sur ce que le serveur savait. */
  aLEcheance(m: M, l: L): ReponseDUnJeu | undefined
  /** Ce qu'Éclairer vise, quand le jeu le demande : l'affirmation sous les yeux, à l'Éclair. */
  cibleDEclairer?(m: M, l: L): number | undefined
  /** Un geste fait sur place, que le serveur ne connaît pas encore : « Changer » vient avant (l'Éclair, une réponse donnée). */
  aJoueSurPlace?(m: M, l: L): boolean
  /**
   * Ce qui change sous le doigt sans que la vue change : l'affirmation de
   * l'Éclair, sous les mêmes « Faux » et « Vrai ». Le cadre y relance la
   * demi-seconde de garde — un double toucher répondait aussi à l'affirmation
   * suivante, sans qu'on l'ait lue.
   */
  sousEcranDe?(m: M, l: L): string
  Manche(p: PropsDUneManche<M, L>): ReactNode
  Revelation(p: { corps: R } & OuEstLaManche): ReactNode
}

/** L'écran d'un jeu, ses types effacés : le cadre ne le lit que pour le jeu de sa partie, avec la manche que la vue de ce jeu montre. */
export type EcranEfface = JeuALEcran<MancheMontree, RevelationDUneManche, unknown>

/**
 * Les écrans des jeux, chacun à la demande — la page du musée ne les
 * télécharge pas, l'annonce demande celui de sa partie. Un jeu sans écran
 * ici s'annonce sans « Commencer » (`AnnonceEnAttente`, `CabinetApp.tsx`) :
 * le serveur peut en livrer un avant que la page n'ait le sien.
 */
const ECRANS: Partial<Record<CleDeJeu, ALaDemande<EcranEfface>>> = {
  pari: aLaDemande(() => import('./jeux/Pari').then(m => m.PARI as unknown as EcranEfface)),
  eclair: aLaDemande(() => import('./jeux/Eclair').then(m => m.ECLAIR as unknown as EcranEfface)),
  detail: aLaDemande(() => import('./jeux/Detail').then(m => m.DETAIL as unknown as EcranEfface)),
  frise: aLaDemande(() => import('./jeux/Frise').then(m => m.FRISE as unknown as EcranEfface)),
}

export const ecranDuJeu = (jeu: CleDeJeu): ALaDemande<EcranEfface> | undefined => ECRANS[jeu]

/** Le bilan, à la demande : l'écran des gains et ses catalogues ne servent qu'à la fin. */
const LE_BILAN = aLaDemande(() => import('./Bilan'))

// ── Le chrono, à l'heure du serveur ───────────────────────────────────────

/** Ce que la tête montre du chrono : l'échéance, la durée de l'étape, et sous la pause, ce qui restait — figé tant qu'elle dure. */
export interface ChronoMontre {
  echeance: number
  dureeMs: number
  figeMs?: number
}

/**
 * Le chrono de la vue, à `t` (l'heure du serveur). Sous la pause de
 * « Quitter ? », l'échéance recule tant qu'il reste de la pause : celle que la
 * vue dit (`echeance`, à l'heure où elle a été lue) plus ce qui en reste
 * (`pauseResteMs`) — l'instant où la réponse partira si la confirmation reste
 * ouverte. Jusque-là le chrono se fige sur ce qui restait ; passé, il reprend
 * sous le voile (§ 2.7).
 */
export function chronoMontre(vue: Pick<VueDeLaPartie, 'chrono' | 'maintenant'>, t: number): ChronoMontre | null {
  const c = vue.chrono
  if (!c) return null
  if (c.pauseResteMs === undefined) return { echeance: c.echeance, dureeMs: c.dureeMs }
  const echeance = c.echeance + c.pauseResteMs
  if (t >= vue.maintenant + c.pauseResteMs) return { echeance, dureeMs: c.dureeMs }
  return { echeance, dureeMs: c.dureeMs, figeMs: Math.max(0, c.echeance - vue.maintenant) }
}

/**
 * Ce que demande « Quitter ? » (§ 2.6) : la partie compte avec ses étoiles,
 * et ce que le départ a consommé l'est. Sous la pause, combien de temps le
 * chrono attend ; refusée (`PLUS_DE_PAUSE`, trois pauses ou trente secondes
 * passées), la phrase du serveur : la confirmation s'ouvre quand même, et le
 * chrono continue.
 */
export function messageDuQuitter(vue: Pick<VueDeLaPartie, 'origine'>, o: { pauseMs?: number; refus?: string } = {}): { titre: string; message: string } {
  const compte =
    vue.origine === 'libre'
      ? 'Elle compte avec ses étoiles.'
      : `La partie compte avec les étoiles déjà gagnées, et ${vue.origine === 'chasse' ? 'ta chasse est utilisée' : 'cette partie de la visite est faite'}.`
  const chrono = o.pauseMs !== undefined && o.pauseMs > 0 ? ` Le chrono t’attend ${secondesAuPlus(o.pauseMs)} au plus, la manche cachée.` : o.refus ? ` ${o.refus}.` : ''
  return { titre: vue.origine === 'libre' ? 'Quitter cette partie ?' : 'Quitter ?', message: compte + chrono }
}

/** Ce qui reste de pause, en secondes entières vers le haut : arrondies, 300 ms se lisaient « 0 secondes », et une seule « 1 secondes ». */
function secondesAuPlus(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000))
  return `${s} seconde${s > 1 ? 's' : ''}`
}

/**
 * La vue `b` remplace-t-elle `a` ? Jamais une plus ancienne : deux réponses
 * se croisent — un geste et la page relue au retour au premier plan, la
 * réponse « auto » et un toucher —, et la dernière arrivée n'est pas toujours
 * la plus récente. Le rang d'abord ; à rang égal, l'heure où le serveur l'a
 * dite (une pause qui s'écoule ne change pas le rang).
 */
export function plusRecente(a: Pick<VueDeLaPartie, 'rang' | 'maintenant'>, b: Pick<VueDeLaPartie, 'rang' | 'maintenant'>): boolean {
  return b.rang > a.rang || (b.rang === a.rang && b.maintenant >= a.maintenant)
}

/**
 * La réponse partie d'elle-même à l'échéance, « Quitter ? » ouvert, a-t-elle
 * tourné la page sous lui ? Arrivée, elle a fermé la pause (§ 2.7) : la
 * manche tranchée, ou l'étape suivante ouverte — à la Réplique, « Qui l'a
 * dit ? » —, la confirmation ne promet plus rien de vrai (« le chrono
 * t'attend, la manche cachée »), et « Continuer » n'aurait plus de pause à
 * reprendre : elle se ferme. Revenue sur la même étape (passée : l'autre
 * onglet l'a rejouée), elle reste ouverte.
 */
export function laReponseTourneLaPage(avant: VueDeLaPartie, apres: VueDeLaPartie): boolean {
  if (apres.phase !== 'jouer' && apres.phase !== 'pause') return true
  return apres.manche !== avant.manche || etapeDe(apres) !== etapeDe(avant)
}

/**
 * Ce que la révélation fête (§ 3.0). La niche dit ce que le journal retient :
 * la pièce juste dès deux étoiles naturelles (D3) nourrit le compagnon, quoi
 * qu'en fassent les pouvoirs — ravie, dépitée à zéro, calme à une. La gerbe
 * ne fête que ce que le bandeau fête : une juste qu'il dit à deux étoiles et
 * plus. Ni une mise perdue (une juste, zéro étoile : la gerbe éclatait sur un
 * bandeau rouge), ni une manche que Protéger porte d'une étoile à deux (pas
 * une juste : elle ne paie pas un confetti de plus, § 4.2).
 */
export function ceQueFeteLaRevelation(naturel: number, etoiles: number): { gerbe: boolean; niche: ReactionALaRevelation } {
  const juste = naturel >= ETOILES_D_UNE_JUSTE
  return { gerbe: juste && etoiles >= ETOILES_D_UNE_JUSTE, niche: reactionDuSolo(juste ? true : naturel === 0 ? false : null) }
}

// ── Les pièces du cadre ───────────────────────────────────────────────────

const ICONE_DU_POUVOIR: Record<CleDePouvoir, IconName> = { eclairer: 'bulb', proteger: 'shield', temps: 'hourglass', miser: 'dice', changer: 'shuffle' }

const etoilesDites = (n: number) => `${n} étoile${n > 1 ? 's' : ''} sur ${ETOILES_D_UNE_PARTIE}`

/** L'étape où en est la manche, pour les jeux qui en ont deux : le cadre change d'écran avec elle. */
const etapeDe = (vue: VueDeLaPartie) => {
  const m = vue.enCours as { etape?: number; auChoix?: boolean } | undefined
  return `${m?.etape ?? 1}${m?.auChoix ? '+' : ''}`
}

/**
 * La tête collée : les trois manches — jouées, leurs étoiles ; celle qui se
 * joue, cerclée —, les étoiles sur neuf, « Quitter », et le chrono quand il
 * court. Elle pose `--bg` sous elle : les thèmes repeignent `.card` d'un verre.
 */
function TeteDeLaPartie({ vue, chrono, onQuitter }: { vue: VueDeLaPartie; chrono: ChronoMontre | null; onQuitter: () => void }) {
  return (
    <header className="cab-tete-partie">
      <div className="cab-tete-ligne">
        <span className="cab-points" role="img" aria-label={`Manche ${vue.manche + 1} sur ${MANCHES_PAR_PARTIE}`}>
          {vue.manches.map((m, k) => (
            <span
              key={k}
              className={'cab-point' + (m.etoiles !== null ? ' cab-point-joue' : k === vue.manche && vue.phase !== 'avant' && vue.phase !== 'finie' ? ' cab-point-ici' : '')}
            >
              {m.etoiles ?? ''}
            </span>
          ))}
        </span>
        <span className="cab-total" role="img" aria-label={etoilesDites(vue.total)}>
          <b>{vue.total}</b>
          {` / ${ETOILES_D_UNE_PARTIE} ★`}
        </span>
        {vue.phase !== 'finie' && (
          <button type="button" className="btn cab-quitter" {...toucher(onQuitter)}>
            Quitter
          </button>
        )}
      </div>
      {chrono && <TimerBar deadline={chrono.echeance} duration={chrono.dureeMs / 1000} frozenMs={chrono.figeMs} />}
    </header>
  )
}

/**
 * La carte-bonus pendant une manche : Éclairer et Changer, un geste — grisé
 * avec sa raison, celle que la vue porte (`pouvoir.refus`) ; Protéger, le
 * temps en plus et la mise, une ligne : ils agissent seuls, ou se sont décidés
 * avant la manche.
 */
function CarteDeLaManche({
  vue,
  ecran,
  local,
  busy,
  onGeste,
}: {
  vue: VueDeLaPartie
  ecran: EcranEfface
  local: unknown
  busy: boolean
  onGeste: (g: GesteDuCabinet) => void
}) {
  const c = vue.carte
  if (!c || !vue.enCours) return null
  const icone = <Icon name={ICONE_DU_POUVOIR[c.pouvoir]} />
  if (c.pouvoir !== 'eclairer' && c.pouvoir !== 'changer') {
    return (
      <p className="cab-carte-ligne">
        {icone}
        <span>{espacesFines(c.dit)}</span>
      </p>
    )
  }
  const m = vue.enCours
  // Ce que le serveur ne sait pas encore : une réponse de l'Éclair donnée sur place. La seule règle des refus le dit, sur ce que la
  // page tient (`refusDuPouvoir` : « Change avant de répondre ») — elle ne s'écrit pas une seconde fois ici.
  const surPlace = c.pouvoir === 'changer' && ecran.aJoueSurPlace?.(m, local) ? refusDuPouvoir({ pouvoir: 'changer', force: c.force, jeu: vue.jeu, servi: 0, aJoue: true, rechanges: 1 }) : null
  const refus = vue.pouvoir?.jouable ? surPlace : (vue.pouvoir?.refus ?? null)
  const cible = ecran.cibleDEclairer?.(m, local)
  const geste: GesteDuCabinet = c.pouvoir === 'eclairer' ? { quoi: 'eclairer', manche: vue.manche, ...(cible !== undefined && { affirmation: cible }) } : { quoi: 'changer', manche: vue.manche }
  return (
    <>
      <button type="button" className="btn btn-block cab-pouvoir" aria-disabled={refus !== null || busy || undefined} {...toucher(() => refus === null && !busy && onGeste(geste))}>
        {icone}
        {POUVOIRS[c.pouvoir].nom}
        <span className="cab-reste">{` · encore ${c.reste}`}</span>
      </button>
      {refus && <p className="cab-raison">{espacesFines(refus)}</p>}
    </>
  )
}

/** La mise, avant une manche, sans l'avoir vue : « Pas cette fois » l'ouvre sans elle (§ 4.1). */
export function MiserOuPas({ vue, manche, busy, onMiser }: { vue: VueDeLaPartie; manche: Manche; busy: boolean; onMiser: (oui: boolean) => void }) {
  return (
    <section className="cab-bloc cab-mise" aria-labelledby="cab-miser">
      <span className="cab-surtitre">{`Manche ${manche + 1} sur ${MANCHES_PAR_PARTIE}`}</span>
      <h2 id="cab-miser">Miser sur cette manche ?</h2>
      <p className="cab-ligne">{espacesFines(POUVOIRS.miser.dit)}</p>
      {vue.carte && <p className="cab-ligne cab-dit">{espacesFines(vue.carte.dit)}</p>}
      <div className="cab-gestes">
        <button type="button" className="btn btn-primary" aria-disabled={busy || undefined} {...toucher(() => !busy && onMiser(true))}>
          Miser
        </button>
        <button type="button" className="btn" aria-disabled={busy || undefined} {...toucher(() => !busy && onMiser(false))}>
          Pas cette fois
        </button>
      </div>
    </section>
  )
}

/**
 * Sous la confirmation de « Quitter ? », la manche se cache : la pause n'achète
 * pas de temps pour chercher (D10). Une pause sans question — la page
 * rechargée sous « Quitter ? » puis reprise du musée, « Continuer » perdu en
 * route, la pause écrite dont la réponse s'est perdue — a son « Continuer »
 * sous le voile (`onReprendre`) : sans lui, la manche restait cachée, sans un
 * bouton, jusqu'à son échéance, et ne valait rien.
 */
export function VoileDeLaPause({ busy = false, onReprendre }: { busy?: boolean; onReprendre?: () => void }) {
  return (
    <div className="cab-voile" role="note">
      <Icon name="pause" />
      <b>En pause</b>
      <span>{espacesFines(onReprendre ? 'Ta manche t’attend, cachée.' : 'La manche se cache le temps de ta réponse.')}</span>
      {onReprendre && (
        <button type="button" className="btn btn-primary btn-big" aria-disabled={busy || undefined} {...toucher(() => !busy && onReprendre())}>
          Continuer
        </button>
      )}
    </div>
  )
}

/** Ce que « Signaler une erreur » vise : la question, ou, au Pari parié, l'une des deux — le seul jeu qui en ait deux. */
const ceQuOnSignale = (positions: readonly number[], i: number) => (positions.length === 1 ? 'cette question' : i === 0 ? 'la première question' : 'la question du pari')

/**
 * La révélation d'une manche (§ 3.0) : ses étoiles et pourquoi elles
 * diffèrent (« +4 : mise gagnée »), un titre qui dit ce qui s'est passé, le
 * corps de son jeu, « Le savais-tu ? », « Signaler une erreur » pour les
 * seules questions de la base. La niche et la gerbe la fêtent, chacune ce
 * qu'elle sait (`ceQueFeteLaRevelation`).
 */
export function RevelationDeLaManche({ vue, revelation: r, ecran, onSignaler }: { vue: VueDeLaPartie; revelation: RevelationVue; ecran: EcranEfface; onSignaler: (position: number) => void }) {
  const m = vue.manches[r.manche]
  const etoiles = m?.etoiles ?? 0
  const fete = ceQueFeteLaRevelation(m?.naturel ?? 0, etoiles)
  return (
    <>
      <div className={'card result-banner ' + (etoiles > 0 ? 'result-ok' : 'result-ko')} role="status">
        <NicheALaRevelation cle={`cabinet:${vue.id}:${r.manche}`} reaction={fete.niche} />
        <span className="big cab-etoiles-manche">
          <Etoiles n={Math.min(3, etoiles)} grandes />
        </span>
        <p className="cab-titre-revele">{espacesFines(r.corps.titre)}</p>
        {m?.note && <p className="cab-note">{espacesFines(m.note)}</p>}
        {r.fin === 'expiree' && <p>Temps écoulé</p>}
        {r.fin === 'quittee' && <p>Manche quittée</p>}
        {fete.gerbe && <GerbeDeJuste />}
      </div>
      <ecran.Revelation corps={r.corps} partie={vue.id} tirage={r.tirage} />
      {r.corps.savais && (
        <p className="card anecdote">
          <Icon name="message" />
          <span>
            <b>Le savais-tu ?</b> {espacesFines(r.corps.savais)}
          </span>
        </p>
      )}
      {r.signalables.map((position, i) => (
        <button key={position} type="button" className="lien-signaler link-inline small" {...toucher(() => onSignaler(position))}>
          {`Signaler une erreur dans ${ceQuOnSignale(r.signalables, i)}`}
        </button>
      ))}
    </>
  )
}

export interface PropsDeLEcran {
  vue: VueDeLaPartie
  /** L'écran du jeu : en chemin (null), ou perdu — le navigateur garde l'échec d'un `import()`. */
  ecran: EcranEfface | null | 'perdu'
  local: unknown
  setLocal: (l: unknown) => void
  chrono: ChronoMontre | null
  busy: boolean
  /** La manche dont la mise se décide, ouverte d'une révélation ; la phase `avant` décide de la première. */
  miser: Manche | null
  garde: () => boolean
  onGeste: (g: GesteDuCabinet) => void
  onQuitter: () => void
  /** La pause sans question à qui la reprendre : « Continuer » sous le voile. Absent, « Quitter ? » est ouvert et répondra. */
  onReprendre?: () => void
  onSuivante: () => void
  onMiser: (oui: boolean) => void
  onSignaler: (position: number) => void
  onMusee: () => void
}

/**
 * Une partie à l'écran, telle que la vue la dit — pur : le contrôleur
 * (`Partie`) tient la vue, les gestes, le chrono et ce que la page tient seule.
 */
export function EcranDeLaPartie(p: PropsDeLEcran) {
  const { vue, ecran } = p
  const r = vue.revelation
  const ouverte = vue.phase === 'avant' ? 0 : p.miser
  let corps: ReactNode
  let pied: ReactNode = null
  let colle = true
  if (ecran === 'perdu') {
    corps = (
      <div className="cab-bloc">
        <p className="cab-ligne">{espacesFines('Ce jeu ne s’est pas chargé : recharge la page, ta partie t’attend.')}</p>
        <button type="button" className="btn btn-primary" {...toucher(() => window.location.reload())}>
          Recharger
        </button>
      </div>
    )
  } else if (!ecran) {
    corps = (
      <p className="cab-ligne" aria-busy="true">
        Chargement…
      </p>
    )
  } else if (ouverte !== null) {
    corps = <MiserOuPas vue={vue} manche={ouverte} busy={p.busy} onMiser={p.onMiser} />
  } else if (r && (vue.phase === 'revele' || vue.phase === 'finie')) {
    corps = <RevelationDeLaManche vue={vue} revelation={r} ecran={ecran} onSignaler={p.onSignaler} />
    pied = (
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={p.busy || undefined} {...toucher(() => !p.busy && p.onSuivante())}>
        {vue.phase === 'finie' ? 'Voir le bilan' : 'Manche suivante'}
      </button>
    )
  } else if (vue.phase === 'pause') {
    corps = <VoileDeLaPause busy={p.busy} onReprendre={p.onReprendre} />
  } else if (vue.enCours) {
    corps = (
      <ecran.Manche
        montree={vue.enCours}
        partie={vue.id}
        tirage={vue.tirage}
        local={p.local}
        setLocal={p.setLocal}
        envoyer={g => p.onGeste({ ...g, manche: vue.manche } as GesteDuCabinet)}
        garde={p.garde}
        busy={p.busy}
      />
    )
    // La carte-bonus reste sous le pouce tant qu'elle peut servir ; sans carte, pas de pied, qui collait un bandeau vide au bas de l'écran.
    if (vue.carte) {
      pied = <CarteDeLaManche vue={vue} ecran={ecran} local={p.local} busy={p.busy} onGeste={p.onGeste} />
      colle = !!vue.pouvoir?.jouable
    }
  }
  // Rien ne court entre deux manches, ni avant la mise : on peut repartir au musée, la partie l'y attend.
  const sansChrono = vue.phase === 'revele' || (vue.phase === 'avant' && !vue.chrono)
  return (
    <div className="player-shell cab-page cab-partie">
      {sansChrono && <Sortie vers="Le Cabinet" href="/cabinet" onClick={p.onMusee} />}
      <TeteDeLaPartie vue={vue} chrono={p.chrono} onQuitter={p.onQuitter} />
      <div className="quiz-player cab-manche">{corps}</div>
      {pied && <div className={colle ? 'cab-pied-partie' : 'cab-pied-partie cab-pied-pose'}>{pied}</div>}
    </div>
  )
}

// ── La partie ─────────────────────────────────────────────────────────────

/**
 * La partie qui se joue : sa vue, ses gestes, le chrono, la pause de
 * « Quitter ? », la garde du retour du navigateur pendant une manche, puis le
 * bilan. `relue` : la partie telle que la page du musée l'a relue — au retour
 * au premier plan, après un refus —, qui prend la place de la sienne si elle
 * est plus avancée.
 */
export function Partie({
  depart,
  relue,
  onMusee,
  onRelire,
  onRejouer,
}: {
  depart: VueDeLaPartie
  relue: VueDeLaPartie | null
  onMusee: () => void
  onRelire: () => void
  onRejouer?: () => void
}) {
  const [vue, setVue] = useState(depart)
  const [busy, setBusy] = useState(false)
  const [miser, setMiser] = useState<Manche | null>(null)
  const [bilanOuvert, setBilanOuvert] = useState(false)
  const [local, setLocalBrut] = useState<{ cle: string; valeur: unknown } | null>(null)
  const [, setTic] = useState(0)
  // « Quitter ? » posé — la pause demandée, la confirmation ouverte, sa réponse en route — : la pause a sa question.
  const [question, setQuestion] = useState(false)
  const ecran = useALaDemande(ecranDuJeu(depart.jeu)!)
  const bilan = useALaDemande(LE_BILAN)
  const pret = ecran && ecran !== 'perdu' ? ecran : null

  // Ce que les gestes et les minuteries lisent au moment où ils partent : la vue d'à présent, pas celle de leur rendu.
  const vueRef = useRef(vue)
  const enVol = useRef(false)
  const enQuestion = useRef(false)
  const monte = useRef(true)

  // Démontée « Quitter ? » ouvert — un second retour ferme la partie —, elle emporte sa question : laissée là, la confirmation
  // restait par-dessus le musée, et « Quitter » y aurait clos une partie que la page ne montrait plus, sans la relire.
  useEffect(() => {
    monte.current = true
    return () => {
      monte.current = false
      if (enQuestion.current) fermerLeDialogue()
    }
  }, [])

  const cleDuLocal = pret && vue.enCours ? `${vue.manche}:${pret.cleDe(vue.enCours)}` : null
  const valeur = local && local.cle === cleDuLocal ? local.valeur : pret && vue.enCours ? pret.localDe(vue.enCours) : null
  const localRef = useRef(valeur)
  localRef.current = valeur
  const setLocal = (v: unknown) => {
    if (cleDuLocal === null) return
    localRef.current = v
    setLocalBrut({ cle: cleDuLocal, valeur: v })
  }

  /** La vue d'après — jamais une vue plus ancienne que celle qu'on tient (`plusRecente`). */
  const ranger = useCallback((v: VueDeLaPartie) => {
    if (!plusRecente(vueRef.current, v)) return
    vueRef.current = v
    setVue(v)
  }, [])

  // La partie relue par la page — au retour au premier plan, l'horloge remise à zéro : elle a pu continuer sans nous.
  useEffect(() => {
    if (relue && relue.id === vueRef.current.id && !enVol.current) ranger(relue)
  }, [relue, ranger])

  /**
   * Un geste, au rang de la vue d'à présent. Un seul à la fois ; celui que la
   * page envoie d'elle-même à l'échéance (`auto`) attend son tour, et insiste
   * tant que le réseau manque — un refus du serveur, lui, ne se retente pas.
   */
  const jouer = useCallback(
    async (geste: GesteDuCabinet, auto = false): Promise<void> => {
      const v = vueRef.current
      if (enVol.current) {
        if (auto) throw new Error('Un geste est déjà en route')
        return
      }
      // Une réponse touchée — ou les étoiles gardées, qui tranchent la manche : la niche retient son souffle jusqu'au verdict.
      if (geste.quoi === 'repondre' || geste.quoi === 'garder') nicheRetientSonSouffle()
      enVol.current = true
      setBusy(true)
      try {
        const r = await api.cabinet.geste(v.id, v.rang, geste)
        ranger(r.partie)
        // Partie d'elle-même à l'échéance, la réponse a tourné la page sous la confirmation ouverte : elle se ferme.
        if (auto && enQuestion.current && laReponseTourneLaPage(v, r.partie)) fermerLeDialogue()
        // Passé : un double toucher, l'autre onglet. À l'échéance, la réponse a croisé la sienne : rien à dire.
        if (r.passe && !auto) showToast({ kind: 'info', message: r.passe })
      } catch (e) {
        if (auto && !refusDuServeur(e)) throw e
        showToast({ kind: 'error', message: motifDe(e) })
        if (refusDuServeur(e)) onRelire()
      } finally {
        enVol.current = false
        setBusy(false)
      }
    },
    [ranger, onRelire],
  )

  // Chaque écran de la partie commence en haut, rend son focus, et refuse un toucher dans la demi-seconde (`gesteAccepte`) : il
  // était destiné à l'écran d'avant — « Manche suivante » qui prend la place d'une réponse sous le doigt.
  const changement = useRef<number | null>(null)
  const premiere = useRef(true)
  const cleDEcran = `${vue.phase}:${vue.manche}:${etapeDe(vue)}:${miser ?? ''}:${bilanOuvert}`
  // Ce qui change sous le doigt sans changer d'écran — l'affirmation suivante de l'Éclair — relance la garde, sans défiler : les
  // mêmes « Faux » et « Vrai » restent sous le pouce, et le second toucher d'un double répondait à une affirmation pas lue.
  const sousLeDoigt = pret && vue.enCours ? (pret.sousEcranDe?.(vue.enCours, valeur) ?? '') : ''
  useEffect(() => {
    changement.current = performance.now()
  }, [cleDEcran, sousLeDoigt])
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    window.scrollTo(0, 0)
    rendreLeFocus(document.querySelector('.cab-page'), ['.cab-question', 'h2', 'h1'])
  }, [cleDEcran])
  const garde = useCallback(() => gesteAccepte(changement.current, performance.now()), [])

  const agir = (geste: GesteDuCabinet) => {
    if (garde()) void jouer(geste)
  }

  // À l'échéance, la page envoie ce qu'elle tient — sous la confirmation ouverte aussi : passées les trente secondes, le chrono a
  // repris sous le voile. Une vue neuve (un geste, une pause, une reprise) annule l'envoi prévu et en prévoit un autre.
  useEffect(() => {
    if (!pret || (vue.phase !== 'jouer' && vue.phase !== 'pause')) return
    const c = chronoMontre(vue, serverNow())
    if (!c) return
    const { rang, manche, enCours } = vue
    return insister(
      async () => {
        if (vueRef.current.rang !== rang || !enCours) return
        const reponse = pret.aLEcheance(enCours, localRef.current)
        await jouer({ quoi: 'repondre', manche, auto: true, ...(reponse && { reponse }) }, true)
      },
      { premier: Math.max(0, c.echeance - serverNow()) },
    )
  }, [vue, pret, jouer])

  // La pause finie (ses trente secondes), le chrono reprend sous le voile : la tête se redessine à cet instant.
  useEffect(() => {
    const reste = vue.phase === 'pause' ? vue.chrono?.pauseResteMs : undefined
    if (reste === undefined) return
    const dans = vue.maintenant + reste - serverNow()
    if (dans <= 0) return
    const id = setTimeout(() => setTic(n => n + 1), dans + 20)
    return () => clearTimeout(id)
  }, [vue])

  /**
   * « Quitter ? » (§ 2.6, 2.7) : la pause d'abord, si un chrono court — la
   * manche se voile, le chrono se fige trente secondes au plus —, puis la
   * confirmation. Refusée (`PLUS_DE_PAUSE`), la pause ne fige rien, et la
   * confirmation s'ouvre quand même : quitter reste possible. « Continuer »
   * reprend ; « Quitter » compte la partie avec ses étoiles.
   */
  const demanderAQuitter = useCallback(async (): Promise<IssueDuRetour> => {
    if (enQuestion.current) return 'reste'
    enQuestion.current = true
    setQuestion(true)
    try {
      const v = vueRef.current
      let pauseMs: number | undefined
      let refus: string | undefined
      if (v.phase === 'jouer' && v.chrono && !enVol.current) {
        enVol.current = true
        setBusy(true)
        try {
          const r = await api.cabinet.geste(v.id, v.rang, { quoi: 'pause', manche: v.manche })
          ranger(r.partie)
          pauseMs = r.partie.phase === 'pause' ? r.partie.chrono?.pauseResteMs : undefined
        } catch (e) {
          refus = motifDe(e)
        } finally {
          enVol.current = false
          setBusy(false)
        }
      }
      const { titre, message } = messageDuQuitter(vueRef.current, { pauseMs, refus })
      const oui = await confirmDialog({ title: titre, message, confirmLabel: 'Quitter', cancelLabel: 'Continuer', danger: true })
      // Fermée par la partie qui se démonte : rien ne part d'un écran qui n'est plus là. La partie attend au musée, en pause —
      // « Reprendre » la rouvre sous son voile, qui a son « Continuer » —, et le chrono n'attend pas plus de trente secondes.
      if (!monte.current) return 'parti'
      const apres = vueRef.current
      if (oui && apres.phase !== 'finie') await jouer({ quoi: 'quitter' })
      else if (!oui && apres.phase === 'pause') await jouer({ quoi: 'reprendre', manche: apres.manche })
      return vueRef.current.phase === 'finie' ? 'parti' : 'reste'
    } finally {
      enQuestion.current = false
      setQuestion(false)
    }
  }, [ranger, jouer])

  // Une pause sans question : « Continuer » sous le voile la reprend.
  const reprendre = () => {
    if (garde()) void jouer({ quoi: 'reprendre', manche: vueRef.current.manche })
  }

  // Pendant une manche, le retour du navigateur demande lui aussi « Quitter ? » : un pouce qui glisse du bord coûtait la manche.
  // Sa garde se pose par-dessus l'entrée de la partie (`poserLEntreeDeLaPartie`), qu'elle recopie : le retour qui la consomme laisse
  // la partie ouverte.
  useGardeRetour(vue.phase === 'jouer' || vue.phase === 'pause', demanderAQuitter)

  const suivante = () => {
    if (!garde()) return
    if (vue.phase === 'finie') return setBilanOuvert(true)
    const k = (vue.manche + 1) as Manche
    if (vue.carte?.pouvoir === 'miser' && vue.pouvoir?.jouable) return setMiser(k)
    void jouer({ quoi: 'ouvrir', manche: k })
  }

  const decider = async (oui: boolean) => {
    if (!garde()) return
    const k = vue.phase === 'avant' ? 0 : (miser ?? ((vue.manche + 1) as Manche))
    await jouer({ quoi: 'ouvrir', manche: k, ...(oui && { miser: true as const }) })
    if (vueRef.current.phase !== 'avant' && vueRef.current.phase !== 'revele') setMiser(null)
  }

  const signaler = async (position: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(vue.id, position, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  // Le bilan : la dernière manche révélée d'abord (« Voir le bilan ») ; quittée ou close, tout de suite.
  const montrerLeBilan = vue.phase === 'finie' && (bilanOuvert || !vue.revelation || !!vue.bilan?.quittee || !!vue.bilan?.lendemain)
  if (montrerLeBilan) {
    if (bilan === 'perdu' || !bilan) {
      return (
        <div className="player-shell cab-page" aria-busy={!bilan || undefined}>
          <p className="cab-ligne">{bilan ? espacesFines('Le bilan ne s’est pas chargé, mais ta partie est bien comptée : ton musée l’a gardée.') : 'Chargement…'}</p>
          <button type="button" className="btn btn-primary btn-big btn-block" {...toucher(onMusee)}>
            Revenir au musée
          </button>
        </div>
      )
    }
    const LeBilan: typeof BilanDeLaPartie = bilan.BilanDeLaPartie
    return <LeBilan vue={vue} ecran={pret} onMusee={onMusee} onRejouer={onRejouer} />
  }
  return (
    <EcranDeLaPartie
      vue={vue}
      ecran={ecran}
      local={valeur}
      setLocal={setLocal}
      chrono={chronoMontre(vue, serverNow())}
      busy={busy}
      miser={miser}
      garde={garde}
      onGeste={agir}
      onQuitter={() => void demanderAQuitter()}
      onReprendre={vue.phase === 'pause' && !question ? reprendre : undefined}
      onSuivante={suivante}
      onMiser={oui => void decider(oui)}
      onSignaler={position => void signaler(position)}
      onMusee={onMusee}
    />
  )
}

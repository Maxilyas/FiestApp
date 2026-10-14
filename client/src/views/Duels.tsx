import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { api, motifDe } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { Feuille, Sortie } from '../components/Pieces'
import { SerieCorrigee } from '../components/SerieCorrigee'
import { Onglets, ongletVise } from '../components/Onglets'
import { Avatar, Visage } from '../components/Avatar'
import { NomLaure, texteDuLaurier } from '../components/Laurier'
import { Rank } from '../components/Rank'
import { BlasonDeLigue } from '../components/Blason'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { lesAmis, useFeuilleDesAmis } from '../components/FeuilleDesAmisADemande'
import { deNom, espacesFines, rang as rangEcrit } from '../format'
import { classer } from '../../../shared/classement'
import { Anneau, FeuilleDuDe, MesDuels, SemaineEnLosanges, duelEnRoute, resteCourt, surQuoi } from './Duel'
import { aConfirmerAuDe, ceQuIlPorte, ecartSigne, phraseDeLEnjeu, siTuPerds } from './Rencontre'
import {
  COTE_DE_DEPART,
  DUELS_DE_L_HISTOIRE,
  DUELS_POUR_LA_RECOMPENSE,
  LIGUES,
  PARTICIPATION_SOUS_L_OR,
  PART_DU_LANCEUR,
  enjeuContre,
  ligueDe,
  ligueParCle,
  ligueSuivante,
  type BilanContre,
  type BilanDesDuels,
  type CleDeLigue,
  type DuelContre,
  type DuelDeLHistoire,
  type EnjeuDuDuel,
  type EtatDesDuels,
  type JoueurADefier,
  type LigneDesDuels,
} from '../../../shared/duels'
import type { CorrectionDeCampagne, DefiRecu, MesAmis, RencontreDeCampagne, SonApparence } from '../../../shared/campagne'

/** Sa cote, ses duels joués et sa ligue gardée : ce que la préparation d'un duel dit de ce qui se joue (`enjeuContre`). */
export type MaCote = { cote: number; joues: number; plancher?: number }

// La page des duels (`/duels`, le souhait du propriétaire du 11 octobre 2026 :
// « Défier un joueur » hors de la campagne, « un classement ELO et des
// récompenses par semaine avec des ligues », « très clair niveau
// utilisation »). Chargée à la demande par la page de la campagne, qui en
// joue les parties : `main.tsx` la demande avec elle quand on ouvre `/duels`,
// et la campagne ne la télécharge jamais.
//
// Son dessin est la maquette A1 — « le cockpit » —, choisie par le
// propriétaire le 12 octobre 2026 parmi trois (« il y a trop de texte en bas
// […] quelque chose de très design et un peu futuriste pour avoir le
// classement, l'historique avec aussi les matchs en cours ») : les six
// ligues en cadran autour de sa cote, sa semaine en trois losanges, « Défier »
// et le dé, puis trois onglets — en cours, historique, classement. Les règles
// et les ligues, qui tenaient trois replis de phrases, sont derrière « ? ».

export { DuelEnvoye, FeuilleDuDe, FinDuDuel, PageDuDuel, VerdictDuDuel } from './Duel'

// ── Le cadran des ligues ─────────────────────────────────────────────────

/** Le centre du cadran, dans son dessin de 350 × 190. */
const CX = 175
const CY = 178

/** Un point du cadran : l'angle en degrés, compté depuis la gauche, sur le cercle de ce rayon. */
function point(angle: number, rayon: number): [number, number] {
  const a = (angle * Math.PI) / 180
  return [CX - rayon * Math.cos(a), CY - rayon * Math.sin(a)]
}

/** L'arc du cadran d'un angle à l'autre, dans le sens des aiguilles d'une montre. */
function arc(de: number, a: number, rayon: number): string {
  const [x1, y1] = point(de, rayon)
  const [x2, y2] = point(a, rayon)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${rayon} ${rayon} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/**
 * Où une cote se pose sur le cadran : chaque ligue tient trente degrés —
 * un trait de vingt-huit, un degré de jour de chaque côté —, la bronze depuis
 * la cote de départ (elle n'a pas de plancher), les maîtres sur cent points.
 */
export function angleDeLaCote(cote: number): number {
  const l = ligueDe(cote)
  const suivante = ligueSuivante(l)
  const depuis = Number.isFinite(l.depuis) ? l.depuis : COTE_DE_DEPART
  const jusqua = suivante ? suivante.depuis : depuis + 100
  const part = Math.max(0, Math.min(1, (cote - depuis) / (jusqua - depuis)))
  return 30 * LIGUES.indexOf(l) + 1 + part * 28
}

/**
 * Sa cote au centre d'un cadran : les six ligues en arcs, leurs blasons
 * autour, la sienne allumée jusqu'à sa cote. Il remplace « Encore 76 points
 * pour la ligue d'argent » et les ligues dépliées sous la page : on voit
 * d'un coup où l'on est, ce qui reste, et ce qui vient.
 */
function CadranDesLigues({ cote }: { cote: number | null }) {
  const ligue = ligueDe(cote ?? COTE_DE_DEPART)
  const ici = LIGUES.indexOf(ligue)
  const suivante = ligueSuivante(ligue)
  const angle = cote === null ? null : angleDeLaCote(cote)
  const [mx, my] = angle === null ? [0, 0] : point(angle, 130)
  return (
    <div className={`duels-cadran ligue-${ligue.cle}`}>
      <svg viewBox="0 0 350 190" aria-hidden="true">
        <path className="duels-cadran-graduation" d={arc(0, 180, 144)} />
        <path className="duels-cadran-piste" d={arc(0, 180, 130)} />
        <path className="duels-cadran-filet" d={arc(0, 180, 116)} />
        {LIGUES.map((l, k) => (
          <path key={l.cle} className={`duels-cadran-ligue ligue-${l.cle}` + (cote !== null && k < ici ? ' passee' : '')} d={arc(30 * k + 1, 30 * k + 29, 130)} />
        ))}
        {angle !== null && (
          <>
            <path className="duels-cadran-fait" d={arc(30 * ici + 1, angle, 130)} />
            <circle className="duels-cadran-halo" cx={mx} cy={my} r={12} />
            <circle className="duels-cadran-point" cx={mx} cy={my} r={5.5} />
          </>
        )}
        {LIGUES.map((l, k) => {
          // Chaque blason au milieu de son arc, sur un cercle plus large : le sien dans une aura.
          const [x, y] = point(30 * k + 15, 163)
          const etat = cote === null || k > ici ? ' a-venir' : k === ici ? ' ici' : ''
          return (
            <g key={l.cle} className={`duels-cadran-blason ligue-${l.cle}${etat}`}>
              {k === ici && cote !== null && <circle className="duels-cadran-aura" cx={x} cy={y} r={16} />}
              <g transform={`translate(${(x - 8).toFixed(2)} ${(y - 9).toFixed(2)})`}>
                <BlasonDeLigue ligue={l.cle} taille={16} decoratif />
              </g>
            </g>
          )
        })}
      </svg>
      <p className="duels-cadran-centre">
        <b>{cote ?? '–'}</b>
        <span className={'duels-cadran-ligue-nom' + (cote === null ? ' duels-en-attente' : '')}>{ligue.nom}</span>
        {cote === null ? (
          <span className="duels-cadran-suite duels-en-attente">–</span>
        ) : suivante ? (
          <span className="duels-cadran-suite">
            <span aria-hidden="true">{`${suivante.depuis - cote} → ${suivante.court}`}</span>
            <span className="sr-only">{`encore ${suivante.depuis - cote} points pour la ${suivante.nom.toLowerCase()}`}</span>
          </span>
        ) : (
          <span className="duels-cadran-suite">Tout en haut</span>
        )}
      </p>
    </div>
  )
}

/**
 * En haut : la sortie ; au bout, « Comment ça marche ? » et ses amis. La
 * cloche des défis y était la troisième, partie le 13 octobre 2026 : seul le
 * quiz du jour fait sonner un téléphone (règle `rappel-et-installation.md`).
 */
function BarreDesDuels({ onRegles, onAmis }: { onRegles?: () => void; onAmis?: () => void }) {
  return (
    <div className="jour-barre duels-barre-haut">
      <Sortie />
      <span className="jour-barre-fin">
        <button type="button" className="duels-icone" aria-label="Comment ça marche ?" aria-disabled={!onRegles || undefined} onClick={onRegles}>
          <Icon name="help" />
        </button>
        <button type="button" className="duels-icone" aria-label="Mes amis" aria-disabled={!onAmis || undefined} onClick={onAmis}>
          <Icon name="users" />
        </button>
      </span>
    </div>
  )
}

/**
 * « Défier », en grand — qui, sur quoi, il joue d'abord —, et le dé à côté,
 * toujours : un duel contre Automate, l'adversaire simulé de son niveau, ou
 * celui qu'il a laissé en route, qui se reprend. Le dé rejouait la série
 * d'un autre joueur sous son profil, et disparaissait quand il les avait
 * toutes affrontées (le propriétaire, le 13 octobre 2026 : « tout le temps
 * disponible », puis « c'est trompeur »). La même place pendant que la page
 * arrive. Touché, il s'allume tant que le serveur tire la série, et le dé
 * roule (`roule`) : rien ne bougeait, et l'attente se lisait comme un
 * toucher perdu (le retour du propriétaire du 13 octobre 2026 : « l'attente
 * est perceptible »). Tirée, sa feuille dit ce qu'elle met en jeu avant la
 * première question (`FeuilleDuDe`).
 */
function BoutonsDesDuels({
  busy,
  roule,
  onDefier,
  onAuHasard,
  reprendre,
}: {
  busy: boolean
  roule?: boolean
  onDefier?: () => void
  onAuHasard?: () => void
  reprendre: string | null
}) {
  return (
    <div className="duels-gestes">
      <button type="button" className="btn btn-primary btn-big btn-duel duels-defier" aria-disabled={!onDefier || undefined} onClick={onDefier}>
        <Icon name="swords" />
        Défier
      </button>
      <button
        type="button"
        className={'duels-hasard' + (roule ? ' roule' : '')}
        aria-label={reprendre ? `Reprendre ton duel contre ${reprendre}` : 'Un duel contre Automate'}
        aria-disabled={busy || !onAuHasard || undefined}
        onClick={onAuHasard}
      >
        <Icon name={reprendre ? 'play' : 'dice'} className={reprendre ? undefined : 'duels-de'} />
      </button>
    </div>
  )
}

// ── Les trois onglets ────────────────────────────────────────────────────

type OngletDesDuels = 'cours' | 'histo' | 'classe'

/** Les trois onglets, une piste et son trait d'or (`Onglets` : les flèches passent de l'un à l'autre) ; les résultats à voir comptés sur « En cours ». */
function OngletsDesDuels({ actif, nouveaux, onChoisir }: { actif: OngletDesDuels; nouveaux: number; onChoisir: (o: OngletDesDuels) => void }) {
  return (
    <Onglets
      onglets={[
        { id: 'cours', nom: 'En cours', ...(nouveaux > 0 && { pastille: { n: nouveaux, label: nouveaux > 1 ? `${nouveaux} résultats à voir` : 'un résultat à voir' } }) },
        { id: 'histo', nom: 'Historique' },
        { id: 'classe', nom: 'Classement' },
      ]}
      actif={actif}
      onChoisir={onChoisir}
      label="Tes duels"
      idOnglet={o => `duels-onglet-${o}`}
      idPanneau={() => 'duels-panneau'}
      className="duels-onglets"
    />
  )
}

/** Une ligne de l'onglet « En cours » : un résultat qui l'attend, un duel à jouer, un duel chez l'autre. */
export interface LigneEnCours {
  cle: string
  sorte: 'resultat' | 'a-toi' | 'attente'
  nom: string
  avatar: string
  /** Ce qu'il porte (`ceQuIlPorte`) : son légendaire, comme à l'onglet du classement. */
  apparence?: SonApparence
  ligue?: CleDeLigue
  quoi: string
  /** Le code de son duel, que la ligne ouvre ; absent : le duel au hasard laissé en route, qui se reprend. */
  code?: string
  /** Chez l'autre : les minutes avant qu'il ferme. */
  reste?: number
}

/**
 * L'onglet « En cours », dans l'ordre où il l'attend : les résultats qu'il
 * n'a pas vus — la carte se retourne dans leur page —, ce qui est à lui de
 * jouer — un duel qu'on lui a lancé, le sien laissé en route, un défi entre
 * amis d'avant, son duel au hasard —, puis ce qui attend l'autre. Un duel
 * classé reçu est déjà parmi les siens : les défis reçus n'en ajoutent que
 * ceux d'avant, amicaux.
 */
export function lignesEnCours(etat: Pick<EtatDesDuels, 'contre' | 'enCours'>, recus: readonly DefiRecu[]): LigneEnCours[] {
  const contre = etat.contre ?? []
  // Ce qu'il porte, s'il porte quelque chose : sinon, la ligne n'en dit rien.
  const porte = (x: SonApparence) => {
    const apparence = ceQuIlPorte(x)
    return apparence && { apparence }
  }
  const deSonDuel = (d: (typeof contre)[number], sorte: LigneEnCours['sorte']): LigneEnCours => ({
    cle: d.code,
    sorte,
    nom: d.contre.nom,
    avatar: d.contre.avatar,
    ...porte(d.contre),
    ...(d.contre.ligue && { ligue: d.contre.ligue }),
    quoi: surQuoi(d),
    code: d.code,
    ...(sorte === 'attente' && { reste: d.minutesRestantes }),
  })
  const connus = new Set(contre.map(d => d.code))
  const enCours = etat.enCours?.serie.question ? etat.enCours : null
  return [
    ...contre.filter(d => d.nouveau).map(d => deSonDuel(d, 'resultat')),
    ...contre.filter(d => duelEnRoute(d) && d.justes === null).map(d => deSonDuel(d, 'a-toi')),
    ...recus
      .filter(r => !connus.has(r.code))
      .map((r): LigneEnCours => ({ cle: r.code, sorte: 'a-toi', nom: r.auteur.nom, avatar: r.auteur.avatar, ...porte(r.auteur), quoi: r.classe ? surQuoi(r) : 'Défi entre amis', code: r.code })),
    ...(enCours ? [{ cle: 'au-hasard', sorte: 'a-toi' as const, nom: enCours.adversaire.nom, avatar: enCours.adversaire.avatar, ...porte(enCours.adversaire), quoi: 'Au hasard' }] : []),
    ...contre.filter(d => duelEnRoute(d) && d.justes !== null).map(d => deSonDuel(d, 'attente')),
  ]
}

/** « En cours » : une ligne par duel, son état au bout — un mot, une icône. */
function PanneauEnCours({ lignes, debutant, onOuvrir, onReprendre, onRegles }: { lignes: LigneEnCours[]; debutant: boolean; onOuvrir: (code: string) => void; onReprendre: () => void; onRegles: () => void }) {
  if (lignes.length === 0) {
    return (
      <div className="duels-vide">
        <p>{debutant ? espacesFines('Ton premier duel compte double : défie quelqu’un, ou lance le dé.') : 'Aucun duel en cours.'}</p>
        {debutant && (
          <button type="button" className="link-inline" onClick={onRegles}>
            Comment ça marche ?
          </button>
        )}
      </div>
    )
  }
  return (
    <ul className="duels-en-cours">
      {lignes.map(l => (
        <li key={l.cle}>
          <button type="button" className={`duels-ligne-duel duels-${l.sorte}`} onClick={() => (l.code ? onOuvrir(l.code) : onReprendre())}>
            <Anneau avatar={l.avatar} apparence={l.apparence} ligue={l.ligue} />
            <span className="duels-ligne-texte">
              <b>{l.nom}</b>
              <span>{l.quoi}</span>
            </span>
            {l.sorte === 'resultat' ? (
              <span className="duels-pastille-resultat">
                <Icon name="spark" />
                Résultat
              </span>
            ) : l.sorte === 'a-toi' ? (
              <span className="duels-pastille-a-toi">
                À toi
                <Icon name="play" />
              </span>
            ) : (
              <span className="duels-chez-l-autre">
                <Icon name="hourglass" />
                {resteCourt(l.reste ?? 0)}
                <span className="sr-only">{`, chez ${l.nom}`}</span>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Un duel joué, tel que l'historique le dit : contre qui, les deux scores, ce qu'il a fait à sa cote, quand — et ce qu'un toucher rouvre. */
export interface LigneDHistoire {
  cle: string
  nom: string
  avatar: string
  /** Ce qu'il porte (`ceQuIlPorte`), comme partout sur la page. */
  apparence?: SonApparence
  justes: number
  sesJustes: number
  ecart: number
  le: number
  /** Un duel contre quelqu'un : sa page, qu'un toucher rouvre — sa correction y est. */
  code?: string
  /** Un duel au dé : sa série, dont un toucher ouvre la correction — il n'a pas de page. */
  serie?: string
}

/** Une ligne de son historique telle que le serveur la raconte (`DuelDeLHistoire`), telle que la page la dit. */
export function ligneDHistoire(d: DuelDeLHistoire): LigneDHistoire {
  const apparence = ceQuIlPorte(d.contre)
  return {
    cle: d.cle,
    nom: d.contre.nom,
    avatar: d.contre.avatar,
    ...(apparence && { apparence }),
    justes: d.justes,
    sesJustes: d.sesJustes,
    ecart: d.ecart,
    le: d.le,
    ...(d.code && { code: d.code }),
    ...(d.serie && { serie: d.serie }),
  }
}

/**
 * Ses derniers duels joués, au hasard et contre quelqu'un mêlés, du plus
 * récent au plus ancien, tels qu'un serveur d'avant les donnait — sans son
 * historique (`EtatDesDuels.historique`). Un résultat qu'il n'a pas encore vu
 * n'y paraît pas : l'historique le lui soufflerait avant que la carte se
 * retourne.
 */
export function histoireDesDuels(etat: Pick<EtatDesDuels, 'contre' | 'dernieres'>, n = 10): LigneDHistoire[] {
  const porte = (x: SonApparence) => {
    const apparence = ceQuIlPorte(x)
    return apparence && { apparence }
  }
  const auHasard = etat.dernieres.flatMap((r): LigneDHistoire[] =>
    r.issue && r.ecart !== undefined
      ? [{ cle: r.serie, nom: r.adversaire.nom, avatar: r.adversaire.avatar, ...porte(r.adversaire), justes: r.justes, sesJustes: r.adversaire.justes, ecart: r.ecart, le: r.le, serie: r.serie }]
      : [],
  )
  const contre = (etat.contre ?? []).flatMap((d): LigneDHistoire[] =>
    !d.nouveau && d.ecart !== undefined && d.le !== undefined && d.justes !== null && d.sesJustes !== null
      ? [{ cle: d.code, nom: d.contre.nom, avatar: d.contre.avatar, ...porte(d.contre), justes: d.justes, sesJustes: d.sesJustes, ecart: d.ecart, le: d.le, code: d.code }]
      : [],
  )
  return [...auHasard, ...contre].sort((a, b) => b.le - a.le).slice(0, n)
}

/** V, D ou = : l'issue d'un duel joué, en une lettre. */
const lettreDeLIssue = (d: Pick<LigneDHistoire, 'justes' | 'sesJustes'>) => (d.justes > d.sesJustes ? 'V' : d.justes < d.sesJustes ? 'D' : '=')
const motDeLIssue = { V: 'victoire', D: 'défaite', '=': 'égalité' } as const

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/**
 * Quand un duel s'est joué, d'un mot : « aujourd’hui », « hier », « 12 oct. ».
 * Écrit à la main : le premier `Intl` d'une page charge les données du
 * français (règle `client.md`), pour trois lettres de mois. `maintenant` :
 * pour les tests.
 */
export function quandCourt(le: number, maintenant = Date.now()): string {
  const jour = (t: number) => {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  // Arrondi : un jour d'heure d'été n'a que vingt-trois heures.
  const avant = Math.round((jour(maintenant) - jour(le)) / 86_400_000)
  if (avant <= 0) return 'aujourd’hui'
  if (avant === 1) return 'hier'
  const d = new Date(le)
  return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`
}

/** « 12 victoires », « 1 défaite » : un nombre et son mot, au singulier jusqu'à un, comme en français. */
const compte = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Son bilan en trois chiffres — ses victoires, ses défaites, la part qu'il en
 * gagne —, puis ses records, une ligne chacun : sa série, la meilleure, sa
 * plus haute cote, sa plus belle victoire (le souhait du propriétaire du
 * 13 octobre 2026 : un historique « un peu pauvre niveau métriques »). Une
 * série d'une seule victoire n'en est pas une : elle ne se dit pas.
 */
function BilanDuJoueur({ bilan }: { bilan: BilanDesDuels }) {
  const part = Math.round((100 * bilan.victoires) / bilan.joues)
  const plusHaute = ligueDe(bilan.plusHaute)
  const records: { icone: IconName; titre: string; valeur: string; detail?: string; ligue?: CleDeLigue }[] = [
    ...(bilan.serie >= 2 ? [{ icone: 'zap' as const, titre: 'Série en cours', valeur: compte(bilan.serie, 'victoire') }] : []),
    ...(bilan.meilleureSerie >= 2 ? [{ icone: 'award' as const, titre: 'Meilleure série', valeur: compte(bilan.meilleureSerie, 'victoire') }] : []),
    { icone: 'mountain', titre: 'Plus haute cote', valeur: String(bilan.plusHaute), detail: plusHaute.court, ligue: plusHaute.cle },
    ...(bilan.plusBelle
      ? [{ icone: 'star' as const, titre: 'Plus belle victoire', valeur: ecartSigne(bilan.plusBelle.ecart), detail: `${bilan.plusBelle.justes}–${bilan.plusBelle.sesJustes} contre ${bilan.plusBelle.contre.nom}` }]
      : []),
  ]
  return (
    <section className="duels-bilan" aria-labelledby="duels-bilan-titre">
      <h3 id="duels-bilan-titre" className="duels-surtitre">
        Ton bilan
      </h3>
      <p className="sr-only">
        {`${compte(bilan.joues, 'duel')} : ${compte(bilan.victoires, 'victoire')}, ${compte(bilan.defaites, 'défaite')}${bilan.egalites > 0 ? `, ${compte(bilan.egalites, 'égalité')}` : ''}, ${part} % de victoires.`}
      </p>
      <div className="duels-chiffres" aria-hidden="true">
        <span className="duels-chiffre duels-chiffre-v">
          <b className="num">{bilan.victoires}</b>
          {bilan.victoires > 1 ? 'victoires' : 'victoire'}
        </span>
        <span className="duels-chiffre duels-chiffre-d">
          <b className="num">{bilan.defaites}</b>
          {bilan.defaites > 1 ? 'défaites' : 'défaite'}
        </span>
        <span className="duels-chiffre">
          <b className="num">
            {part}
            <small>%</small>
          </b>
          gagnés
        </span>
      </div>
      <p className="duels-bilan-pied" aria-hidden="true">
        {espacesFines(`${bilan.joues > 1 ? `${bilan.joues} duels joués` : 'Un duel joué'}${bilan.egalites > 0 ? ` · ${compte(bilan.egalites, 'égalité')}` : ''}`)}
      </p>
      <ul className="duels-records">
        {records.map(r => (
          <li key={r.titre} className="duels-record">
            <span className={'duels-record-icone' + (r.ligue ? ` ligue-${r.ligue}` : '')}>
              <Icon name={r.icone} />
            </span>
            <span className="duels-record-titre">{r.titre}</span>
            <span className="duels-record-valeur">
              <b>{r.valeur}</b>
              {r.detail && <span>{espacesFines(r.detail)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * La courbe de sa cote : avant ses derniers duels, puis après chacun — un
 * point par duel, pas par jour : dix duels d'un soir ne s'y tassent pas. Les
 * ligues qu'elle traverse en traits, leur nom au bout ; son dernier point, sa
 * cote.
 */
export function CourbeDeLaCote({ courbe }: { courbe: number[] }) {
  if (courbe.length < 2) return null
  const largeur = 350
  const hauteur = 112
  // En haut, la place de sa cote au-dessus du dernier point ; à droite, celle du nom des ligues.
  const [haut, bas, gauche, droite] = [20, 6, 4, 46]
  const min = Math.min(...courbe)
  const max = Math.max(...courbe)
  const marge = Math.max(12, (max - min) * 0.12)
  const [y0, y1] = [min - marge, max + marge]
  const x = (i: number) => gauche + (i / (courbe.length - 1)) * (largeur - gauche - droite)
  const y = (cote: number) => haut + ((y1 - cote) / (y1 - y0)) * (hauteur - haut - bas)
  const points = courbe.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`)
  const [debut, fin] = [courbe[0], courbe[courbe.length - 1]]
  const n = courbe.length - 1
  const seuils = LIGUES.filter(l => l.depuis > y0 && l.depuis < y1)
  return (
    <section className="duels-courbe">
      <div className="duels-historique-tete">
        <span className="duels-surtitre">{n > 1 ? `Ta cote · ${n} derniers duels` : 'Ta cote · ton dernier duel'}</span>
        <b className={'num ' + (fin >= debut ? 'duels-plus' : 'duels-moins')}>{ecartSigne(fin - debut)}</b>
      </div>
      <svg className="duels-courbe-dessin" viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={`Ta cote sur ${n > 1 ? `tes ${n} derniers duels` : 'ton dernier duel'} : de ${debut} à ${fin}, au plus haut ${max}.`}>
        <defs>
          <linearGradient id="duels-courbe-fond" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {seuils.map(l => (
          <g key={l.cle} className={`ligue-${l.cle}`}>
            <line className="duels-courbe-seuil" x1={gauche} x2={largeur - droite + 6} y1={y(l.depuis)} y2={y(l.depuis)} />
            <text className="duels-courbe-ligue" x={largeur - 2} y={y(l.depuis) + 4} textAnchor="end">
              {l.court}
            </text>
          </g>
        ))}
        <path className="duels-courbe-aire" d={`M${x(0)},${hauteur - bas} L${points.join(' L')} L${x(n)},${hauteur - bas} Z`} />
        <polyline className="duels-courbe-trait" points={points.join(' ')} />
        <circle className="duels-courbe-point" cx={x(n)} cy={y(fin)} r={4.5} />
        <text className="duels-courbe-cote" x={x(n)} y={y(fin) - 9} textAnchor="middle">
          {fin}
        </text>
      </svg>
    </section>
  )
}

/**
 * Ses face-à-face : contre ses adversaires les plus affrontés — Automate
 * compris —, ses victoires et ses défaites, une jauge qui les montre. Un
 * joueur se touche : sa carte s'ouvre, « Défier » à son pied.
 */
function FacesAFaces({ faces, onOuvrir }: { faces: BilanContre[]; onOuvrir: (profileId: string) => void }) {
  return (
    <section className="duels-rivaux" aria-labelledby="duels-rivaux-titre">
      <h3 id="duels-rivaux-titre" className="duels-surtitre">
        Face-à-face
      </h3>
      <ul>
        {faces.map(f => {
          const total = f.victoires + f.defaites + f.egalites
          const contenu = (
            <>
              <Anneau avatar={f.contre.avatar} apparence={ceQuIlPorte(f.contre)} ligue={f.contre.ligue} petit />
              <span className="duels-rival-texte">
                <b>{f.contre.nom}</b>
                <span className="duels-rival-jauge" aria-hidden="true">
                  {f.victoires > 0 && <i className="duels-rival-v" style={{ flexGrow: f.victoires }} />}
                  {f.egalites > 0 && <i className="duels-rival-e" style={{ flexGrow: f.egalites }} />}
                  {f.defaites > 0 && <i className="duels-rival-d" style={{ flexGrow: f.defaites }} />}
                </span>
              </span>
              <span className="num duels-rival-bilan" aria-hidden="true">
                <span className="duels-plus">{f.victoires}</span>–<span className="duels-moins">{f.defaites}</span>
                {f.egalites > 0 && <span className="duels-rival-egal">{` · ${f.egalites} =`}</span>}
              </span>
              <span className="sr-only">{`, ${compte(f.victoires, 'victoire')}, ${compte(f.defaites, 'défaite')}${f.egalites > 0 ? `, ${compte(f.egalites, 'égalité')}` : ''} en ${compte(total, 'duel')}`}</span>
            </>
          )
          return (
            <li key={f.contre.profileId ?? 'automate'}>
              {f.contre.profileId ? (
                <button type="button" className="duels-rival" onClick={() => onOuvrir(f.contre.profileId!)}>
                  {contenu}
                </button>
              ) : (
                <span className="duels-rival">{contenu}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Ses dix derniers duels en barres — ce que chacun a fait à sa cote,
 * au-dessus du trait gagné, en dessous perdu, du plus ancien au plus récent —
 * et leur somme.
 */
function BarresDesDuels({ duels: tous }: { duels: LigneDHistoire[] }) {
  const duels = tous.slice(0, DUELS_DE_L_HISTOIRE)
  const somme = duels.reduce((s, d) => s + d.ecart, 0)
  const plusFort = Math.max(...duels.map(d => Math.abs(d.ecart)), 1)
  const victoires = duels.filter(d => d.justes > d.sesJustes).length
  const defaites = duels.filter(d => d.justes < d.sesJustes).length
  const dansLOrdre = [...duels].reverse()
  return (
    <>
      <div className="duels-historique-tete">
        <span className="duels-surtitre">{duels.length > 1 ? `${duels.length} derniers duels` : 'Ton dernier duel'}</span>
        <b className={'num ' + (somme >= 0 ? 'duels-plus' : 'duels-moins')}>{ecartSigne(somme)}</b>
      </div>
      <svg
        className="duels-barres"
        viewBox="0 0 350 96"
        role="img"
        aria-label={`${victoires} victoire${victoires > 1 ? 's' : ''}, ${defaites} défaite${defaites > 1 ? 's' : ''}, de la plus ancienne à la plus récente`}
      >
        <line x1="0" y1="48" x2="350" y2="48" />
        {dansLOrdre.map((d, i) => {
          // Chaque duel sa place de 35, la plus récente au bout : moins de dix, la ligne commence plus loin.
          const x = 6.5 + (10 - dansLOrdre.length + i) * 35
          const h = Math.max(3, (Math.abs(d.ecart) / plusFort) * 43)
          const dernier = i === dansLOrdre.length - 1
          return (
            <rect
              key={d.cle}
              className={d.ecart >= 0 ? (dernier ? 'duels-barre-gagne duels-barre-derniere' : 'duels-barre-gagne') : 'duels-barre-perdu'}
              x={x}
              y={d.ecart >= 0 ? 48 - h : 48}
              width={22}
              height={h}
              rx={3}
              // Les plus anciennes s'effacent : l'œil va à la dernière.
              fillOpacity={dernier && d.ecart >= 0 ? 1 : (0.55 + (0.37 * (i + 1)) / dansLOrdre.length).toFixed(2)}
            />
          )
        })}
      </svg>
    </>
  )
}

/** L'issue d'un duel en tête de sa correction : le mot entier. */
const ISSUE_EN_TETE = { V: 'Victoire', D: 'Défaite', '=': 'Égalité' } as const

/** La pastille d'une issue : V, D ou =, à sa couleur. */
const classeDeLIssue = (issue: keyof typeof ISSUE_EN_TETE) => `duels-issue duels-issue-${issue === 'V' ? 'v' : issue === 'D' ? 'd' : 'e'}`

/**
 * Tous ses duels joués, une ligne chacun : l'issue, contre qui et quand, les
 * deux scores, ce qu'il a fait à sa cote. Trois seulement s'y lisaient, le
 * reste n'était qu'une barre (le propriétaire, le 13 octobre 2026 : « ça en
 * affiche un maximum de 3 »). Un toucher rouvre un duel contre quelqu'un — sa
 * carte, sa correction —, ou la correction d'un duel au dé.
 */
function ListeDesDuels({ duels, onOuvrir, onCorrection }: { duels: LigneDHistoire[]; onOuvrir: (code: string) => void; onCorrection: (d: LigneDHistoire) => void }) {
  const maintenant = Date.now()
  return (
    <ul className="duels-joues">
      {duels.map(d => {
        const issue = lettreDeLIssue(d)
        const contenu = (
          <>
            <span className={classeDeLIssue(issue)} aria-hidden="true">
              {issue}
            </span>
            <span className="sr-only">{`${motDeLIssue[issue]}, `}</span>
            <span className="duels-joue-avatar" aria-hidden="true">
              <Visage avatar={d.avatar} apparence={d.apparence} />
            </span>
            <span className="duels-joue-texte">
              <span className="duels-joue-nom">{d.nom}</span>
              <span className="duels-joue-quand">{quandCourt(d.le, maintenant)}</span>
            </span>
            <span className="num duels-joue-score">{`${d.justes}–${d.sesJustes}`}</span>
            <span className={'duels-joue-ecart ' + (d.ecart >= 0 ? 'duels-plus' : 'duels-moins')}>{ecartSigne(d.ecart)}</span>
          </>
        )
        return (
          <li key={d.cle}>
            {d.code ? (
              <button type="button" className="duels-joue" onClick={() => onOuvrir(d.code!)}>
                {contenu}
              </button>
            ) : d.serie ? (
              <button type="button" className="duels-joue" onClick={() => onCorrection(d)}>
                {contenu}
              </button>
            ) : (
              <span className="duels-joue">{contenu}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * La correction d'un duel au dé, dans sa feuille : il n'a pas de page, et ses
 * réponses ne se relisaient qu'à sa fin, d'un toucher sur « Réponses ».
 */
export function FeuilleDeLaCorrection({ duel, onFermer }: { duel: LigneDHistoire; onFermer: () => void }) {
  const [correction, setCorrection] = useState<CorrectionDeCampagne[] | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    if (!duel.serie) return
    let vivant = true
    api.campagne
      .correction(duel.serie)
      .then(c => vivant && setCorrection(c))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [duel.serie])
  const issue = lettreDeLIssue(duel)
  return (
    <Feuille titre={`Ton duel contre ${duel.nom}`} onFermer={onFermer}>
      <p className="duels-correction-tete">
        <span className={classeDeLIssue(issue)} aria-hidden="true">
          {issue}
        </span>
        <span>{espacesFines(`${ISSUE_EN_TETE[issue]} ${duel.justes}–${duel.sesJustes} · ${quandCourt(duel.le)}`)}</span>
        <b className={duel.ecart >= 0 ? 'duels-plus' : 'duels-moins'}>{ecartSigne(duel.ecart)}</b>
      </p>
      {erreur ? (
        <p className="error" role="alert">
          {erreur}
        </p>
      ) : correction ? (
        <SerieCorrigee correction={correction} />
      ) : (
        <p className="muted small">Chargement…</p>
      )}
    </Feuille>
  )
}

/**
 * « Historique » : son bilan et ses records, la courbe de sa cote, ses
 * face-à-face, puis ses derniers duels — dix en barres, tous en lignes — et
 * « Voir plus », un mois en arrière ; enfin ses défis entre amis d'avant.
 */
export function PanneauHistorique({
  etat,
  onOuvrir,
  onCorrection,
  onJoueur,
}: {
  etat: EtatDesDuels
  onOuvrir: (code: string) => void
  onCorrection: (d: LigneDHistoire) => void
  onJoueur: (profileId: string) => void
}) {
  const [suite, setSuite] = useState<LigneDHistoire[]>([])
  const [encore, setEncore] = useState(etat.historique?.suite ?? false)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const premiers = etat.historique ? etat.historique.duels.map(ligneDHistoire) : histoireDesDuels(etat)
  const duels = [...premiers, ...suite]
  const bilan = etat.bilan && etat.bilan.joues > 0 ? etat.bilan : null
  const voirPlus = async () => {
    const dernier = duels[duels.length - 1]
    if (busy || !dernier) return
    setBusy(true)
    setErreur('')
    try {
      const page = await api.duels.historique({ le: dernier.le, cle: dernier.cle })
      setSuite(avant => [...avant, ...page.duels.map(ligneDHistoire)])
      setEncore(page.suite)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }
  if (duels.length === 0 && !bilan) {
    return (
      <div className="duels-vide">
        <p>{espacesFines('Tes duels joués viendront ici : chacun dit ce qu’il a fait à ta cote.')}</p>
        <MesDuels onOuvrir={onOuvrir} />
      </div>
    )
  }
  return (
    <div className="duels-historique">
      {bilan && <BilanDuJoueur bilan={bilan} />}
      {bilan && <CourbeDeLaCote courbe={bilan.courbe} />}
      {bilan && bilan.faceAFace.length > 0 && <FacesAFaces faces={bilan.faceAFace} onOuvrir={onJoueur} />}
      {duels.length > 0 ? (
        <section className="duels-derniers">
          <BarresDesDuels duels={premiers} />
          <ListeDesDuels duels={duels} onOuvrir={onOuvrir} onCorrection={onCorrection} />
          {encore && (
            <button type="button" className="btn btn-block duels-voir-plus" aria-disabled={busy || undefined} onClick={() => void voirPlus()}>
              <Icon name="chevron-down" />
              Voir plus
            </button>
          )}
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
        </section>
      ) : (
        <p className="duels-vide">{espacesFines('Aucun duel ce mois-ci : ton bilan compte tous les autres.')}</p>
      )}
      <MesDuels onOuvrir={onOuvrir} />
    </div>
  )
}

/**
 * Les places gagnées ou perdues depuis lundi, en flèche, comme un tableau
 * sportif (le souhait du propriétaire du 13 octobre 2026) : rien quand elles
 * n'ont pas bougé, ni pour qui n'était pas classé avant cette semaine.
 */
function Mouvement({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className={'duels-mouvement ' + (n > 0 ? 'duels-plus' : 'duels-moins')} aria-hidden="true">
      {`${n > 0 ? '▲' : '▼'}${Math.abs(n)}`}
    </span>
  )
}

/** Ce que la flèche dit, à l'oreille : dans le nom d'un bouton, qui remplace tout son contenu. */
const motDuMouvement = (n?: number) =>
  n ? `, ${Math.abs(n)} place${Math.abs(n) > 1 ? 's' : ''} ${n > 0 ? 'gagnée' : 'perdue'}${Math.abs(n) > 1 ? 's' : ''} depuis lundi` : ''

/** Ce qu'une ligne de classement montre d'un joueur : de sa ligne du classement, ou de sa ligne d'ami. */
type LigneDeRang = Pick<LigneDesDuels, 'profileId' | 'nom' | 'avatar' | 'cote' | 'ligue' | 'rang' | 'progression'> & SonApparence

/** Sa place dans un classement : son rang — absent tant qu'il n'y est pas —, sur combien, et ses places depuis lundi. */
interface SaPlace {
  rang?: number
  sur: number
  progression?: number
}

type QuelClassement = 'tous' | 'amis'

/**
 * Ses deux places côte à côte, comme un tableau de scores — parmi tous, entre
 * amis —, et chacune l'onglet qui montre sa liste dessous : la choisie
 * allumée d'or, l'autre en retrait. Deux pastilles « Tous » et « Mes amis »,
 * posées entre les onglets et sa place, « sortaient un peu de nulle part » (le
 * propriétaire, le 13 octobre 2026) : on choisit la place qu'on regarde. Au
 * clavier, le motif des onglets (`ongletVise`).
 */
function DeuxPlaces({
  qui,
  onChoisir,
  tous,
  amis,
}: {
  qui: QuelClassement
  onChoisir: (qui: QuelClassement) => void
  tous: SaPlace
  /** Sa place parmi ses amis ; null tant qu'ils arrivent, « aucun » sans ami. */
  amis: SaPlace | 'aucun' | null
}) {
  const rangee = useRef<HTMLDivElement>(null)
  const places = [
    { id: 'tous' as const, titre: 'Parmi tous', place: tous },
    { id: 'amis' as const, titre: 'Entre amis', place: amis },
  ]
  const touche = (e: KeyboardEvent, i: number) => {
    const j = ongletVise(e.key, i, places.length)
    if (j === null) return
    e.preventDefault()
    onChoisir(places[j].id)
    rangee.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
  }
  return (
    <div ref={rangee} className={'duels-places' + (qui === 'amis' ? ' sur-amis' : '')} role="tablist" aria-label="Quel classement">
      {places.map(({ id, titre, place }, i) => {
        const sienne = place && place !== 'aucun' ? place : undefined
        const rang = sienne?.rang
        // Sous son rang, sur combien ; sans rang, pourquoi.
        const sous = place === null ? 'chargement…' : !sienne ? 'aucun ami' : rang === undefined ? 'pas encore classé' : `sur ${sienne.sur}`
        return (
          <button
            key={id}
            id={`duels-qui-${id}`}
            type="button"
            role="tab"
            aria-selected={qui === id}
            aria-controls={qui === id ? `duels-qui-${id}-panneau` : undefined}
            tabIndex={qui === id ? 0 : -1}
            className={'duels-place' + (qui === id ? ' actif' : '')}
            // Le nom remplace tout son contenu : « 4e sur 9 », pas un « 4 » et un « e » en exposant.
            aria-label={`${titre} : ${rang === undefined ? sous : `${rang}${rang === 1 ? 're' : 'e'} ${sous}${motDuMouvement(sienne?.progression)}`}`}
            onClick={() => onChoisir(id)}
            onKeyDown={e => touche(e, i)}
          >
            <span className="duels-place-titre">{titre}</span>
            <span className="duels-place-rang">
              <b className="num">
                {rang === undefined ? (
                  '–'
                ) : (
                  <>
                    {rang}
                    <sup>{rang === 1 ? 're' : 'e'}</sup>
                  </>
                )}
              </b>
              <Mouvement n={sienne?.progression} />
            </span>
            <span className="duels-place-sous">{sous}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Un joueur du classement, tel que la préparation d'un duel le reçoit : ce qu'il porte, sa cote, sa place. */
const joueurDeLaLigne = (l: LigneDesDuels): JoueurADefier => ({
  profileId: l.profileId,
  nom: l.nom,
  avatar: l.avatar,
  ...(l.finition && l.finition !== 'mat' && { finition: l.finition }),
  ...(l.legendaire && { legendaire: l.legendaire }),
  ...(l.eclat && { eclat: true as const }),
  ...(l.bordure && { bordure: l.bordure }),
  cote: l.cote,
  ligue: l.ligue,
  rang: l.rang,
})

/**
 * Un échelon de son échelle, ou de ses amis : un joueur — sa place, sa cote,
 * ses places depuis lundi — et, s'il est à sa portée, « Défier » et ce que le
 * duel mettrait en jeu : ce qu'il gagnerait à le battre, et ce qu'une défaite
 * lui coûterait — le gain seul ne disait pas le risque (le souhait du
 * propriétaire du 14 octobre 2026 : « savoir aussi combien je perds si je
 * défie quelqu'un et que je perds ») ; un duel déjà ouvert entre eux, « En
 * cours », qui le rouvre. Deux boutons côte à côte, jamais l'un dans l'autre :
 * sa carte, et le geste.
 */
function Echelon({
  ligne: l,
  moi,
  enjeu,
  enCours,
  onOuvrir,
  onDefier,
  onOuvrirDuel,
}: {
  ligne: LigneDeRang
  moi: boolean
  /** Ce qu'il mettrait en jeu à le défier (`enjeuContre`) ; absent : rien à défier — lui-même, celui qui le suit, un ami. */
  enjeu?: EnjeuDuDuel
  /** Le code d'un duel déjà ouvert entre eux : un seul à la fois. */
  enCours?: string
  onOuvrir: (profileId: string) => void
  onDefier?: () => void
  onOuvrirDuel?: (code: string) => void
}) {
  return (
    <li className={'duels-echelon' + (moi ? ' moi' : '')}>
      <button
        type="button"
        className="duels-echelon-joueur"
        aria-label={`${moi ? 'Ta carte' : `La carte ${deNom(l.nom)}`} — rang ${l.rang}, ${ligueParCle(l.ligue).nom.toLowerCase()}, cote ${l.cote}${motDuMouvement(l.progression)}`}
        onClick={() => onOuvrir(l.profileId)}
      >
        <span className="num duels-rang-place">{l.rang}</span>
        {/* Ce qu'il porte, sa bordure comprise, comme au classement entier : l'emoji seul y montrait
            l'écureuil d'en dessous à qui porte son légendaire (le retour du propriétaire du 13 octobre 2026). */}
        <Avatar className="duels-rang-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} bordure={l.bordure} />
        <span className="duels-echelon-texte">
          <b>{moi ? 'Toi' : l.nom}</b>
          <span>
            <span className="num">{l.cote}</span>
            <Mouvement n={l.progression} />
          </span>
        </span>
      </button>
      {enjeu !== undefined &&
        (enCours ? (
          <button type="button" className="duels-echelon-geste en-cours" aria-label={`Ton duel contre ${l.nom}, en cours`} onClick={() => onOuvrirDuel?.(enCours)}>
            <Icon name="hourglass" />
            En cours
          </button>
        ) : (
          <button type="button" className="duels-echelon-geste" aria-label={`Défier ${l.nom} : ${phraseDeLEnjeu(enjeu)}`} onClick={onDefier}>
            <span className="duels-echelon-defier">
              <Icon name="swords" />
              Défier
            </span>
            <span className="duels-echelon-gain">{espacesFines(`${ecartSigne(enjeu.gagne)} si tu gagnes`)}</span>
            {/* Sous l'Or, la défaite rapporte souvent (la montée) : « +4 même si tu perds », en rouge seulement quand elle coûte. */}
            <span className={'duels-echelon-perte' + (enjeu.perdu < 0 ? ' duels-moins' : '')}>{espacesFines(siTuPerds(enjeu.perdu))}</span>
          </button>
        ))}
    </li>
  )
}

/**
 * « Parmi tous », sous ses deux places : son échelle — ceux à sa portée,
 * juste au-dessus, avec ce qu'il gagnerait ou perdrait et « Défier », puis lui et celui
 * qui le suit ; en tête, lui et ceux qui le talonnent — ; enfin le podium,
 * qui ouvre le classement entier. On regardait le classement sans pouvoir en
 * rien faire (le souhait du propriétaire du 13 octobre 2026).
 */
function ClassementDeTous({
  classement,
  maCote,
  contre,
  onOuvrir,
  onToutVoir,
  onDefier,
  onOuvrirDuel,
}: {
  classement: EtatDesDuels['classement']
  maCote: MaCote
  contre: readonly DuelContre[]
  onOuvrir: (profileId: string) => void
  onToutVoir: () => void
  onDefier: (joueur: JoueurADefier) => void
  onOuvrirDuel: (code: string) => void
}) {
  const sienne = classement.moi ?? classement.lignes.find(l => l.profileId === classement.sienne)
  const podium = classement.lignes.slice(0, 3)
  if (classement.joueurs === 0) return <p className="duels-vide">{espacesFines('Personne n’a encore joué de duel : la première place t’attend.')}</p>
  const aPortee = classement.aPortee ?? []
  const autour = classement.autour ?? []
  const suivant = sienne && !classement.enTete ? autour[autour.findIndex(l => l.profileId === sienne.profileId) + 1] : undefined
  // De haut en bas : ceux qu'il va chercher, le plus haut d'abord, lui, et celui qui le suit — en tête, lui puis ceux qui le talonnent.
  // Personne au-dessus de sa cote : ceux qui le suivent, le plus proche d'abord — en tête, ou pas encore classé au-dessus de tous.
  const auDessous = classement.enTete || (aPortee[0] !== undefined && aPortee[0].cote < maCote.cote)
  const echelle = auDessous ? [...(sienne ? [sienne] : []), ...aPortee] : [...[...aPortee].reverse(), ...(sienne ? [sienne] : []), ...(suivant ? [suivant] : [])]
  const vises = new Set(aPortee.map(l => l.profileId))
  const enCours = (profileId: string) => contre.find(d => d.contre.profileId === profileId && duelEnRoute(d))?.code
  return (
    <>
      {!sienne && (
        <p className="duels-vide">{espacesFines(`Ta cote : ${maCote.cote}. Un duel joué te place au classement, quatre semaines durant.`)}</p>
      )}
      {aPortee.length > 0 && (
        <section className="duels-echelle" aria-labelledby="duels-echelle-titre">
          <h3 id="duels-echelle-titre" className="duels-surtitre">
            {classement.enTete ? 'Ils te talonnent' : 'À ta portée'}
          </h3>
          <ol className="duels-echelons">
            {echelle.map(l => (
              <Echelon
                key={l.profileId}
                ligne={l}
                moi={l.profileId === classement.sienne}
                enjeu={vises.has(l.profileId) ? enjeuContre(maCote, l.cote, true) : undefined}
                enCours={enCours(l.profileId)}
                onOuvrir={onOuvrir}
                onDefier={() => onDefier(joueurDeLaLigne(l))}
                onOuvrirDuel={onOuvrirDuel}
              />
            ))}
          </ol>
        </section>
      )}
      <button type="button" className="duels-podium" onClick={onToutVoir}>
        <span className="duels-surtitre">Top 3</span>
        <span className="duels-podium-avatars" aria-hidden="true">
          {podium.map(l => (
            <Anneau key={l.profileId} avatar={l.avatar} apparence={ceQuIlPorte(l)} ligue={l.ligue} petit />
          ))}
        </span>
        <span className="duels-tout-voir">Tout voir ›</span>
        <span className="sr-only">{`, ${podium.map(l => l.nom).join(', ')} : le classement entier`}</span>
      </button>
    </>
  )
}

/**
 * Son classement parmi ses amis classés — ceux qui ont joué un duel ces
 * quatre dernières semaines, comme le classement de tous —, rang partagé
 * (invariant 15) : lu de la liste de ses amis, que la page a déjà. Les places
 * depuis lundi y sont celles du classement de tous : elles n'y figurent pas.
 */
function entreAmis(amis: MesAmis, sienne?: LigneDesDuels) {
  const classes = amis.amis.flatMap((a): LigneDeRang[] =>
    a.rang !== undefined && a.cote !== undefined && a.ligue !== undefined
      ? [{ profileId: a.profileId, nom: a.nom, avatar: a.avatar, ...ceQuIlPorte(a), ...(a.bordure && { bordure: a.bordure }), cote: a.cote, ligue: a.ligue, rang: 0 }]
      : [],
  )
  const lignes = classer([...classes, ...(sienne ? [{ ...sienne, progression: undefined }] : [])], l => l.cote, l => l.nom, l => l.profileId).map(({ item, rang }) => ({ ...item, rang }))
  return { lignes, moi: sienne && lignes.find(l => l.profileId === sienne.profileId), sansDuel: amis.amis.length - classes.length }
}

/**
 * « Entre amis », sous ses deux places : ses amis classés et lui, chacun sa
 * carte, comme son échelle, puis combien n'ont pas joué ces quatre semaines.
 * Sans ami, comment en ajouter.
 */
export function ClassementDesAmis({ amis, sienne, onOuvrir, onAmis }: { amis: MesAmis | null; sienne?: LigneDesDuels; onOuvrir: (profileId: string) => void; onAmis: () => void }) {
  if (!amis) return <p className="duels-vide">Chargement…</p>
  if (amis.amis.length === 0) {
    return (
      <div className="duels-vide">
        <p>{espacesFines('Ajoute des amis : tu verras ta place parmi eux.')}</p>
        <button type="button" className="link-inline" onClick={onAmis}>
          Ajouter des amis
        </button>
      </div>
    )
  }
  const { lignes, moi, sansDuel } = entreAmis(amis, sienne)
  return (
    <>
      {!moi && <p className="duels-vide">{espacesFines('Un duel joué te place parmi eux.')}</p>}
      {lignes.length > 0 && (
        <ol className="duels-echelons">
          {lignes.map(l => (
            <Echelon key={l.profileId} ligne={l} moi={l.profileId === sienne?.profileId} onOuvrir={onOuvrir} />
          ))}
        </ol>
      )}
      {sansDuel > 0 && (
        <p className="duels-amis-sans">{espacesFines(`${sansDuel > 1 ? `Et ${sansDuel} qui n’ont` : 'Et un qui n’a'} pas joué de duel ces quatre dernières semaines.`)}</p>
      )}
    </>
  )
}

/**
 * « Classement » : ses deux places, parmi tous et entre amis, chacune
 * l'onglet de sa liste, dessous (le souhait du propriétaire du 13 octobre
 * 2026).
 */
export function PanneauClassement({
  classement,
  maCote,
  contre,
  amis,
  onOuvrir,
  onToutVoir,
  onDefier,
  onOuvrirDuel,
  onAmis,
}: {
  classement: EtatDesDuels['classement']
  maCote: MaCote
  contre: readonly DuelContre[]
  /** Ses amis, leur cote et leur place ; null tant qu'ils arrivent. */
  amis: MesAmis | null
  onOuvrir: (profileId: string) => void
  onToutVoir: () => void
  onDefier: (joueur: JoueurADefier) => void
  onOuvrirDuel: (code: string) => void
  /** La feuille des amis : pour en ajouter. */
  onAmis: () => void
}) {
  const [qui, setQui] = useState<QuelClassement>('tous')
  const sienne = classement.moi ?? classement.lignes.find(l => l.profileId === classement.sienne)
  const parmiSesAmis = amis && amis.amis.length > 0 ? entreAmis(amis, sienne) : undefined
  return (
    <div className="duels-classement-onglet">
      <DeuxPlaces
        qui={qui}
        onChoisir={setQui}
        tous={{ rang: sienne?.rang, sur: classement.joueurs, progression: classement.progression }}
        amis={!amis ? null : !parmiSesAmis ? 'aucun' : { rang: parmiSesAmis.moi?.rang, sur: parmiSesAmis.lignes.length }}
      />
      <div id={`duels-qui-${qui}-panneau`} className="duels-places-panneau" role="tabpanel" aria-labelledby={`duels-qui-${qui}`}>
        {qui === 'tous' ? (
          <ClassementDeTous classement={classement} maCote={maCote} contre={contre} onOuvrir={onOuvrir} onToutVoir={onToutVoir} onDefier={onDefier} onOuvrirDuel={onOuvrirDuel} />
        ) : (
          <ClassementDesAmis amis={amis} sienne={sienne} onOuvrir={onOuvrir} onAmis={onAmis} />
        )}
      </div>
    </div>
  )
}

// ── Les feuilles ─────────────────────────────────────────────────────────

/**
 * « Comment ça marche ? » : six phrases, dans l'ordre où il les vivra — dans
 * la feuille de « ? », en haut de la page. Elles tenaient un repli sous elle.
 */
export function CommentCaMarche() {
  return (
    <ol className="duels-etapes">
      <li>{espacesFines('« Défier » : choisis qui — un prénom, un ami, un joueur du classement : « Défier » est sur sa carte — et sur quoi. Tu joues d’abord, le duel lui part à ta dernière réponse : trois vies, sans chrono.')}</li>
      <li>{espacesFines('À ta dernière réponse, le duel part dans ses duels, et son accueil le lui dit : aucun lien à envoyer.')}</li>
      <li>{espacesFines('Les scores restent cachés : chacun découvre celui de l’autre à sa dernière réponse. Le duel joué des deux côtés, vos deux cotes bougent. Battre plus fort que toi rapporte gros, et perdre contre lui ne coûte presque rien : avant de jouer, tu sais combien.')}</li>
      <li>
        {espacesFines(
          'Pressé ? Le dé : Automate, tout de suite — un adversaire simulé de ton niveau, qui apprend de tes réponses de campagne et rate où tu rates ; son score se dévoile à la fin.',
        )}
      </li>
      {/* La montée (le 14 octobre 2026, `shared/duels.ts`) : « je veux que tout le monde monte en Or s'il joue, même s'il n'est pas très bon ». */}
      <li>
        {espacesFines(
          `Tout le monde part de 1000, en ligue de bronze. Une ligue tous les cent points, jusqu’aux maîtres. Jusqu’à la ligue d’or, chaque duel te fait avancer : +${PARTICIPATION_SOUS_L_OR} rien qu’en le jouant, +${PART_DU_LANCEUR} de plus si tu as lancé le défi, et une défaite ne coûte presque rien. L’argent et l’or, une fois atteints, ne se perdent plus ; au-dessus, c’est ton niveau qui parle.`,
        )}
      </li>
      <li>{espacesFines(`Chaque lundi, ta meilleure ligue de la semaine te rapporte ses confettis, dès ${DUELS_POUR_LA_RECOMPENSE} duels joués dans la semaine.`)}</li>
    </ol>
  )
}

/** Les ligues et ce qu'elles rapportent chaque semaine — la sienne marquée. */
function LesLigues({ ligue }: { ligue: CleDeLigue }) {
  return (
    <ul className="duels-ligues-liste">
      {[...LIGUES].reverse().map(l => (
        <li key={l.cle} className={l.cle === ligue ? 'la-sienne' : undefined} aria-current={l.cle === ligue || undefined}>
          <BlasonDeLigue ligue={l.cle} taille={30} decoratif />
          <span className="duels-ligue-nom">
            <b>{l.nom}</b>
            <span className="muted small">{Number.isFinite(l.depuis) ? `dès ${l.depuis}` : 'au premier duel'}</span>
          </span>
          <span className="duels-ligue-prix">
            {`+${l.confettis}`} <span aria-hidden="true">🎊</span>
            <span className="sr-only"> confettis par semaine</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** « ? » : comment ça marche, puis les ligues et leurs récompenses. */
function FeuilleDesRegles({ ligue, onFermer }: { ligue: CleDeLigue; onFermer: () => void }) {
  return (
    <Feuille titre="Comment ça marche ?" onFermer={onFermer}>
      <CommentCaMarche />
      <h3 className="label duels-regles-ligues">{`Les ligues · chaque lundi, dès ${DUELS_POUR_LA_RECOMPENSE} duels dans la semaine`}</h3>
      <LesLigues ligue={ligue} />
    </Feuille>
  )
}

/**
 * Une ligne du classement des duels : sa place, son avatar, son prénom, sa
 * ligue, sa cote — un toucher ouvre sa carte, et « Défier » est à son pied
 * (`GestesDuJoueur`). L'épée qui le défiait au bout de chaque ligne (le
 * souhait du 11 octobre 2026, « des petites épées pour affronter les
 * personnes ») est partie le soir même : avec la croix des amis, elle
 * encombrait la page — la remarque du propriétaire —, et l'on défie
 * maintenant qui l'on a vu.
 */
function LigneDuClassement({ ligne: l, moi, onOuvrir }: { ligne: LigneDesDuels; moi: boolean; onOuvrir: (profileId: string) => void }) {
  const ligue = ligueParCle(l.ligue)
  return (
    <button
      type="button"
      className={'lb-row lb-ouvrable duels-ligne' + (moi ? ' me' : '')}
      // Le nom du bouton remplace tout son contenu : le rang, la ligue, la cote et les places depuis lundi doivent y être.
      aria-label={`La carte ${deNom(l.nom)}${l.laurier ? `, ${texteDuLaurier(l.laurier)}` : ''} — rang ${l.rang}, ${ligue.nom.toLowerCase()}, cote ${l.cote}${motDuMouvement(l.progression)}`}
      onClick={() => onOuvrir(l.profileId)}
    >
      <Rank n={l.rang} />
      <Avatar className="lb-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} bordure={l.bordure} />
      <span className="lb-name">
        <NomLaure nom={l.nom} laurier={l.laurier} />
      </span>
      <Mouvement n={l.progression} />
      <BlasonDeLigue ligue={l.ligue} taille={22} decoratif />
      <span className="lb-score">{l.cote}</span>
    </button>
  )
}

/** Le titre d'une ligue dans le classement : les lignes s'y rangent par ligue, de la plus haute à la plus basse. */
function TitreDeLigue({ ligue }: { ligue: CleDeLigue }) {
  return (
    <h3 className="duels-classement-ligue">
      <BlasonDeLigue ligue={ligue} taille={18} decoratif />
      {ligueParCle(ligue).nom}
    </h3>
  )
}

/**
 * Le classement, dans sa feuille (le souhait du propriétaire du 11 octobre
 * 2026 : « le classement dans la page comme ça ne me convient pas, un bouton
 * voir le classement, pour ne pas avoir trop de choses au même endroit ») :
 * sa place à lui en tête, puis ceux qui ont joué ces quatre dernières
 * semaines, de la plus haute cote à la plus basse, rangés sous leur ligue ;
 * chaque nom ouvre sa carte, et « Défier » est à son pied. Il arrive avec la
 * page (`EtatDesDuels.classement`) : la feuille s'ouvre sans attendre. L'onglet
 * « Classement » n'en montre que sa place, ses voisins et le podium.
 */
export function FeuilleDuClassement({
  classement,
  onOuvrir,
  onFermer,
}: {
  classement: EtatDesDuels['classement']
  onOuvrir: (profileId: string) => void
  onFermer: () => void
}) {
  const sienne = classement.moi ?? classement.lignes.find(l => l.profileId === classement.sienne)
  return (
    <Feuille titre="Le classement des duels" onFermer={onFermer}>
      {sienne ? (
        <p className="duels-ta-place">
          <BlasonDeLigue ligue={sienne.ligue} taille={28} decoratif />
          <span>
            {/* « Tu es 12ᵉ » d'abord : c'est ce qu'il vient chercher, et 50 lignes plus bas il ne la trouvait pas. */}
            <b>{`Tu es ${rangEcrit(sienne.rang)}`}</b>
            {/* Un nombre ne quitte pas son mot à la ligne : « cote » d'un côté, « 1100 » de l'autre. */}
            <span className="muted small">{espacesFines(`sur ${classement.joueurs} · ${ligueParCle(sienne.ligue).court} · cote ${sienne.cote}`)}</span>
          </span>
        </p>
      ) : (
        classement.joueurs > 0 && <p className="muted small">{espacesFines('Un duel joué te place ici, quatre semaines durant.')}</p>
      )}
      {classement.joueurs === 0 ? (
        <p className="muted small">Personne n’a encore joué de duel : la première place t’attend.</p>
      ) : (
        <div className="leaderboard duels-classement">
          {classement.lignes.map((l, i) => (
            <Fragment key={l.profileId}>
              {(i === 0 || classement.lignes[i - 1].ligue !== l.ligue) && <TitreDeLigue ligue={l.ligue} />}
              <LigneDuClassement ligne={l} moi={l.profileId === classement.sienne} onOuvrir={onOuvrir} />
            </Fragment>
          ))}
          {classement.moi && (
            <>
              <p className="muted center small">…</p>
              <LigneDuClassement ligne={classement.moi} moi onOuvrir={onOuvrir} />
            </>
          )}
        </div>
      )}
      <p className="muted small">{espacesFines('Ceux qui ont joué un duel ces quatre dernières semaines. Touche un nom : sa carte s’ouvre, et tu le défies de là.')}</p>
    </Feuille>
  )
}

// ── La page ──────────────────────────────────────────────────────────────

/**
 * La page des duels (la maquette A1, choisie par le propriétaire le
 * 12 octobre 2026) : le cadran de sa ligue et sa cote, sa semaine, « Défier »
 * et le dé ; puis trois onglets — ses duels en cours, à commencer par les
 * résultats qu'il n'a pas vus ; son historique ; sa place au classement.
 * « Comment ça marche ? » et ses amis, en icônes en haut ; le classement
 * entier et ses amis, chacun sa feuille, où un toucher ouvre la carte d'un
 * joueur, « Défier » à son pied.
 */
export function PageDesDuels({
  amis,
  onJouer,
  onDefier,
  onOuvrirDuel,
  onAmis,
}: {
  /** Ses amis et ce qu'on lui envoie ; null tant qu'ils arrivent. */
  amis: MesAmis | null
  /** Un duel au hasard trouvé — ou repris : la partie se joue sur l'écran de la série (`CampagneApp`). */
  onJouer: (r: RencontreDeCampagne) => void
  /** Préparer un duel (`LancerUnDefi`) : contre qui, s'il est déjà choisi — « Défier » sur sa carte —, et sa propre cote, pour dire ce qui se joue. */
  onDefier: (joueur?: JoueurADefier, moi?: MaCote) => void
  onOuvrirDuel: (code: string) => void
  /** Sa liste d'amis a changé — la feuille, une carte : la campagne relit la sienne, que la préparation d'un duel lit. */
  onAmis: () => void
}) {
  const [etat, setEtat] = useState<EtatDesDuels | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const [onglet, setOnglet] = useState<OngletDesDuels>('cours')
  const [classementOuvert, setClassementOuvert] = useState(false)
  const [reglesOuvertes, setReglesOuvertes] = useState(false)
  // Un duel au dé touché dans l'historique : sa correction, dans sa feuille.
  const [correction, setCorrection] = useState<LigneDHistoire | null>(null)
  // Le dé tiré, pas encore joué : ce qu'il met en jeu, dans sa feuille, avant la première question.
  const [deTire, setDeTire] = useState<(RencontreDeCampagne & { enjeu: EnjeuDuDuel }) | null>(null)
  // « Défier » sur la carte d'un joueur — du classement, de ses amis — ouvre la préparation ici même, sa cote relue avec lui.
  const gestes = { onDefier: (j: JoueurADefier, m: MaCote) => onDefier(j, m), onAmis }
  const { ouvrir, carte } = useCarteDUnProfil(gestes)
  const feuilleDesAmis = useFeuilleDesAmis(gestes)

  useEffect(() => {
    let vivant = true
    api.duels
      .etat()
      .then(e => vivant && setEtat(e))
      .catch(e => vivant && setErreur(motifDe(e)))
    // La feuille des amis en fond, la page montrée : l'icône des amis, touchée, l'ouvre tout de suite.
    void lesAmis.charger().catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  const chercher = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const r = await api.campagne.rencontre.commencer()
      if (!r.serie.question) return
      if (aConfirmerAuDe(r)) {
        // Tirée, elle est à lui : la feuille fermée, elle attend dans « En cours », et le dé la reprend.
        setEtat(e => e && { ...e, enCours: r })
        setDeTire(r)
      } else onJouer(r)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const enCours = etat?.enCours?.serie.question ? etat.enCours : null
  // Sa cote, pour que la préparation dise ce que chaque duel met en jeu — sa ligue gardée comprise.
  const moi: MaCote | undefined = etat ? { cote: etat.cote, joues: etat.joues, ...(etat.plancher !== undefined && { plancher: etat.plancher }) } : undefined
  const defier = (j?: JoueurADefier) => onDefier(j, moi)
  const lignes = etat ? lignesEnCours(etat, amis?.recus ?? []) : []
  const nouveaux = lignes.filter(l => l.sorte === 'resultat').length
  return (
    <div className="player-shell campagne duels">
      <BarreDesDuels onRegles={() => setReglesOuvertes(true)} onAmis={feuilleDesAmis.ouvrir} />
      <CadranDesLigues cote={etat?.cote ?? null} />
      {/* Ce que la semaine passée vient de verser, tant que la nouvelle n'a pas son premier duel — comme la tuile de l'accueil. */}
      <SemaineEnLosanges semaine={etat?.semaine ?? null} passee={etat?.semaine.duels === 0 ? etat.semainePassee : undefined} />
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <BoutonsDesDuels busy={busy} roule={busy} onDefier={() => defier()} onAuHasard={() => void chercher()} reprendre={enCours ? enCours.adversaire.nom : null} />
      <OngletsDesDuels actif={onglet} nouveaux={nouveaux} onChoisir={setOnglet} />
      <div id="duels-panneau" className="duels-panneau" role="tabpanel" aria-labelledby={`duels-onglet-${onglet}`}>
        {!etat ? null : onglet === 'cours' ? (
          <PanneauEnCours lignes={lignes} debutant={etat.joues === 0} onOuvrir={onOuvrirDuel} onReprendre={() => void chercher()} onRegles={() => setReglesOuvertes(true)} />
        ) : onglet === 'histo' ? (
          <PanneauHistorique etat={etat} onOuvrir={onOuvrirDuel} onCorrection={setCorrection} onJoueur={ouvrir} />
        ) : (
          <PanneauClassement
            classement={etat.classement}
            maCote={moi!}
            contre={etat.contre ?? []}
            amis={amis}
            onOuvrir={ouvrir}
            onToutVoir={() => setClassementOuvert(true)}
            onDefier={j => defier(j)}
            onOuvrirDuel={onOuvrirDuel}
            onAmis={feuilleDesAmis.ouvrir}
          />
        )}
      </div>
      {classementOuvert && etat && <FeuilleDuClassement classement={etat.classement} onOuvrir={ouvrir} onFermer={() => setClassementOuvert(false)} />}
      {reglesOuvertes && <FeuilleDesRegles ligue={etat?.ligue ?? 'bronze'} onFermer={() => setReglesOuvertes(false)} />}
      {correction && <FeuilleDeLaCorrection duel={correction} onFermer={() => setCorrection(null)} />}
      {deTire && <FeuilleDuDe rencontre={deTire} onJouer={() => onJouer(deTire)} onFermer={() => setDeTire(null)} />}
      {feuilleDesAmis.feuille}
      {carte}
    </div>
  )
}

/**
 * La page des duels qui s'ouvre tout de suite, avant que le serveur ait dit
 * qui joue : le cadran, la semaine, les boutons et les onglets à leur place —
 * rien ne bouge quand la cote arrive.
 */
export function DuelsEnChemin() {
  return (
    <div className="player-shell campagne duels" aria-busy="true">
      <BarreDesDuels />
      <CadranDesLigues cote={null} />
      <SemaineEnLosanges semaine={null} />
      <BoutonsDesDuels busy reprendre={null} />
      <OngletsDesDuels actif="cours" nouveaux={0} onChoisir={() => {}} />
      <div className="duels-panneau" />
    </div>
  )
}

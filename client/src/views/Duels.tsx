import { Fragment, useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Feuille, Sortie } from '../components/Pieces'
import { Onglets } from '../components/Onglets'
import { Avatar, Visage } from '../components/Avatar'
import { NomLaure, texteDuLaurier } from '../components/Laurier'
import { Rank } from '../components/Rank'
import { BlasonDeLigue } from '../components/Blason'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { lesAmis, useFeuilleDesAmis } from '../components/FeuilleDesAmisADemande'
import { deNom, espacesFines, rang as rangEcrit } from '../format'
import { Anneau, MesDuels, SemaineEnLosanges, duelEnRoute, resteCourt, surQuoi } from './Duel'
import { ceQuIlPorte, ecartSigne } from './Rencontre'
import {
  COTE_DE_DEPART,
  DUELS_DE_PLACEMENT,
  DUELS_POUR_LA_RECOMPENSE,
  LIGUES,
  ligueDe,
  ligueParCle,
  ligueSuivante,
  type CleDeLigue,
  type EtatDesDuels,
  type JoueurADefier,
  type LigneDesDuels,
} from '../../../shared/duels'
import type { DefiRecu, MesAmis, RencontreDeCampagne, SonApparence } from '../../../shared/campagne'

/** Sa cote et ses duels joués : ce que la préparation d'un duel dit de ce qui se joue (`enjeuContre`). */
export type MaCote = { cote: number; joues: number }

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

export { DuelEnvoye, FinDuDuel, PageDuDuel, VerdictDuDuel } from './Duel'

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
 * est perceptible »).
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

/** Un duel joué, tel que l'historique le dit : contre qui, les deux scores, ce qu'il a fait à sa cote, quand. */
export interface DuelDeLHistoire {
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
}

/**
 * Ses derniers duels joués, au hasard et contre quelqu'un mêlés, du plus
 * récent au plus ancien. Un résultat qu'il n'a pas encore vu n'y paraît pas :
 * l'historique le lui soufflerait avant que la carte se retourne.
 */
export function histoireDesDuels(etat: Pick<EtatDesDuels, 'contre' | 'dernieres'>, n = 10): DuelDeLHistoire[] {
  const porte = (x: SonApparence) => {
    const apparence = ceQuIlPorte(x)
    return apparence && { apparence }
  }
  const auHasard = etat.dernieres.flatMap((r): DuelDeLHistoire[] =>
    r.issue && r.ecart !== undefined
      ? [{ cle: r.serie, nom: r.adversaire.nom, avatar: r.adversaire.avatar, ...porte(r.adversaire), justes: r.justes, sesJustes: r.adversaire.justes, ecart: r.ecart, le: r.le }]
      : [],
  )
  const contre = (etat.contre ?? []).flatMap((d): DuelDeLHistoire[] =>
    !d.nouveau && d.ecart !== undefined && d.le !== undefined && d.justes !== null && d.sesJustes !== null
      ? [{ cle: d.code, nom: d.contre.nom, avatar: d.contre.avatar, ...porte(d.contre), justes: d.justes, sesJustes: d.sesJustes, ecart: d.ecart, le: d.le, code: d.code }]
      : [],
  )
  return [...auHasard, ...contre].sort((a, b) => b.le - a.le).slice(0, n)
}

/** Les duels que l'historique détaille sous ses barres : les trois derniers, la forme dit le reste. */
const DUELS_DETAILLES = 3

/** V, D ou = : l'issue d'un duel joué, en une lettre. */
const lettreDeLIssue = (d: Pick<DuelDeLHistoire, 'justes' | 'sesJustes'>) => (d.justes > d.sesJustes ? 'V' : d.justes < d.sesJustes ? 'D' : '=')
const motDeLIssue = { V: 'victoire', D: 'défaite', '=': 'égalité' } as const

/**
 * « Historique » : ses dix derniers duels en barres — ce que chacun a fait à
 * sa cote, au-dessus du trait gagné, en dessous perdu, du plus ancien au plus
 * récent —, leur somme, puis les trois derniers, une ligne chacun.
 */
function PanneauHistorique({ duels, onOuvrir }: { duels: DuelDeLHistoire[]; onOuvrir: (code: string) => void }) {
  if (duels.length === 0) {
    return (
      <div className="duels-vide">
        <p>{espacesFines('Tes duels joués viendront ici : chacun dit ce qu’il a fait à ta cote.')}</p>
        <MesDuels onOuvrir={onOuvrir} />
      </div>
    )
  }
  const somme = duels.reduce((s, d) => s + d.ecart, 0)
  const plusFort = Math.max(...duels.map(d => Math.abs(d.ecart)), 1)
  const victoires = duels.filter(d => d.justes > d.sesJustes).length
  const defaites = duels.filter(d => d.justes < d.sesJustes).length
  const dansLOrdre = [...duels].reverse()
  return (
    <div className="duels-historique">
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
      <ul className="duels-joues">
        {duels.slice(0, DUELS_DETAILLES).map(d => {
          const issue = lettreDeLIssue(d)
          const contenu = (
            <>
              <span className={`duels-issue duels-issue-${issue === 'V' ? 'v' : issue === 'D' ? 'd' : 'e'}`} aria-hidden="true">
                {issue}
              </span>
              <span className="sr-only">{`${motDeLIssue[issue]}, `}</span>
              <span className="duels-joue-avatar" aria-hidden="true">
                <Visage avatar={d.avatar} apparence={d.apparence} />
              </span>
              <span className="duels-joue-nom">{d.nom}</span>
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
              ) : (
                <span className="duels-joue">{contenu}</span>
              )}
            </li>
          )
        })}
      </ul>
      <MesDuels onOuvrir={onOuvrir} />
    </div>
  )
}

/** Une ligne du classement de l'onglet : sa place, son avatar, son prénom — « Toi » pour la sienne —, sa cote. Un toucher ouvre sa carte. */
function LigneDuRang({ ligne: l, moi, onOuvrir }: { ligne: LigneDesDuels; moi: boolean; onOuvrir: (profileId: string) => void }) {
  return (
    <li>
      <button
        type="button"
        className={'duels-rang-ligne' + (moi ? ' moi' : '')}
        aria-label={`${moi ? 'Ta carte' : `La carte ${deNom(l.nom)}`} — rang ${l.rang}, ${ligueParCle(l.ligue).nom.toLowerCase()}, cote ${l.cote}`}
        onClick={() => onOuvrir(l.profileId)}
      >
        <span className="num duels-rang-place">{l.rang}</span>
        {/* Ce qu'il porte, sa bordure comprise, comme au classement entier : l'emoji seul y montrait
            l'écureuil d'en dessous à qui porte son légendaire (le retour du propriétaire du 13 octobre 2026). */}
        <Avatar className="duels-rang-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} bordure={l.bordure} />
        <span className="duels-rang-nom">{moi ? 'Toi' : l.nom}</span>
        <span className="num duels-rang-cote">{l.cote}</span>
      </button>
    </li>
  )
}

/**
 * « Classement » : sa place sur combien, les places gagnées depuis lundi,
 * ses deux voisins (`ClassementDesDuels.autour`), puis le podium d'un coup
 * d'œil — qui ouvre le classement entier dans sa feuille.
 */
function PanneauClassement({ classement, onOuvrir, onToutVoir }: { classement: EtatDesDuels['classement']; onOuvrir: (profileId: string) => void; onToutVoir: () => void }) {
  const sienne = classement.moi ?? classement.lignes.find(l => l.profileId === classement.sienne)
  const p = classement.progression
  const podium = classement.lignes.slice(0, 3)
  if (classement.joueurs === 0) return <p className="duels-vide">{espacesFines('Personne n’a encore joué de duel : la première place t’attend.')}</p>
  return (
    <div className="duels-classement-onglet">
      {sienne ? (
        <div className="duels-ta-place-onglet">
          <b className="num">
            {sienne.rang}
            <sup>{sienne.rang === 1 ? 're' : 'e'}</sup>
          </b>
          <span className="duels-sur">{`sur ${classement.joueurs}`}</span>
          {p !== undefined && p !== 0 && (
            <span className={'duels-progression ' + (p > 0 ? 'duels-plus' : 'duels-moins')}>
              <span aria-hidden="true">{`${p > 0 ? '▲' : '▼'} ${Math.abs(p)}`}</span>
              <span className="sr-only">{`${Math.abs(p)} place${Math.abs(p) > 1 ? 's' : ''} ${p > 0 ? 'gagnée' : 'perdue'}${Math.abs(p) > 1 ? 's' : ''} depuis lundi`}</span>
            </span>
          )}
        </div>
      ) : (
        <p className="duels-vide">{espacesFines('Un duel joué te place ici, quatre semaines durant.')}</p>
      )}
      {sienne && classement.autour && (
        <ol className="duels-rang">
          {classement.autour.map(l => (
            <LigneDuRang key={l.profileId} ligne={l} moi={l.profileId === classement.sienne} onOuvrir={onOuvrir} />
          ))}
        </ol>
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
      <li>{espacesFines('Les scores restent cachés : chacun découvre celui de l’autre à sa dernière réponse. Le duel joué des deux côtés, vos deux cotes bougent : gagné, la tienne monte ; perdu, elle baisse. Battre plus fort que toi rapporte plus : avant de jouer, tu sais combien.')}</li>
      <li>
        {espacesFines(
          'Pressé ? Le dé : Automate, tout de suite — un adversaire simulé de ton niveau, qui apprend de tes réponses de campagne et rate où tu rates ; son score se dévoile à la fin.',
        )}
      </li>
      <li>{espacesFines(`Tout le monde part de 1000, en ligue de bronze. Une ligue tous les cent points, jusqu’aux maîtres ; tes ${DUELS_DE_PLACEMENT} premiers duels comptent double.`)}</li>
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
      // Le nom du bouton remplace tout son contenu : le rang, la ligue et la cote doivent y être.
      aria-label={`La carte ${deNom(l.nom)}${l.laurier ? `, ${texteDuLaurier(l.laurier)}` : ''} — rang ${l.rang}, ${ligue.nom.toLowerCase()}, cote ${l.cote}`}
      onClick={() => onOuvrir(l.profileId)}
    >
      <Rank n={l.rang} />
      <Avatar className="lb-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} bordure={l.bordure} />
      <span className="lb-name">
        <NomLaure nom={l.nom} laurier={l.laurier} />
      </span>
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
      if (r.serie.question) onJouer(r)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const enCours = etat?.enCours?.serie.question ? etat.enCours : null
  // Sa cote, pour que la préparation dise ce que chaque duel met en jeu.
  const moi = etat ? { cote: etat.cote, joues: etat.joues } : undefined
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
          <PanneauHistorique duels={histoireDesDuels(etat)} onOuvrir={onOuvrirDuel} />
        ) : (
          <PanneauClassement classement={etat.classement} onOuvrir={ouvrir} onToutVoir={() => setClassementOuvert(true)} />
        )}
      </div>
      {classementOuvert && etat && <FeuilleDuClassement classement={etat.classement} onOuvrir={ouvrir} onFermer={() => setClassementOuvert(false)} />}
      {reglesOuvertes && <FeuilleDesRegles ligue={etat?.ligue ?? 'bronze'} onFermer={() => setReglesOuvertes(false)} />}
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

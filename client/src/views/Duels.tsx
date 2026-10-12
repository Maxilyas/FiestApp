import { Fragment, useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Feuille, Sortie } from '../components/Pieces'
import { Avatar } from '../components/Avatar'
import { NomLaure, texteDuLaurier } from '../components/Laurier'
import { Rank } from '../components/Rank'
import { BlasonDeLigue } from '../components/Blason'
import { lueur } from '../components/Atlas'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { lesAmis, useFeuilleDesAmis } from '../components/FeuilleDesAmisADemande'
import { deNom, espacesFines, rang as rangEcrit } from '../format'
import { DefisRecus, LaClocheDesDefis, MesDuels, TesDuelsContre, duelEnRoute } from './Duel'
import { MOT_DE_L_ISSUE, ecartSigne, scoreDeRencontre } from './Rencontre'
import {
  DUELS_DE_PLACEMENT,
  DUELS_POUR_LA_RECOMPENSE,
  LIGUES,
  ligueDe,
  ligueParCle,
  ligueSuivante,
  type CleDeLigue,
  type CoteApresLeDuel,
  type EtatDesDuels,
  type JoueurADefier,
  type LigneDesDuels,
  type SemaineDesDuels,
} from '../../../shared/duels'
import type { MesAmis, RencontreDeCampagne, ResumeDeRencontre } from '../../../shared/campagne'

/** Sa cote et ses duels joués : ce que la préparation d'un duel dit de ce qui se joue (`enjeuContre`). */
export type MaCote = { cote: number; joues: number }

// La page des duels (`/duels`, le souhait du propriétaire du 11 octobre 2026 :
// « Défier un joueur » hors de la campagne, « un classement ELO et des
// récompenses par semaine avec des ligues », « très clair niveau
// utilisation »). Chargée à la demande par la page de la campagne, qui en
// joue les parties : `main.tsx` la demande avec elle quand on ouvre `/duels`,
// et la campagne ne la télécharge jamais.

export { FinDuDuel, PageDuDuel } from './Duel'

/** La lueur du héros, à la couleur de sa ligue (`.blason-<ligue>`, `styles.css`). */
const LUEUR: Record<CleDeLigue, string> = {
  bronze: '#d9965a',
  argent: '#c9d2dc',
  or: '#e3b04b',
  platine: '#7fd3cc',
  diamant: '#7fb8ff',
  maitre: '#c99bff',
}

const duels = (n: number) => `${n} duel${n > 1 ? 's' : ''}`

/** « La semaine se clôt dans 3 jours » : ce qui lui reste, jusqu'à lundi minuit (Paris). */
function cloture(minutes: number): string {
  if (minutes < 60) return `La semaine se clôt dans ${minutes}\u00a0minute${minutes > 1 ? 's' : ''}`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `La semaine se clôt dans ${heures}\u00a0heure${heures > 1 ? 's' : ''}`
  const jours = Math.floor(heures / 24)
  return `La semaine se clôt dans ${jours}\u00a0jour${jours > 1 ? 's' : ''}`
}

/**
 * Sa semaine, d'un coup d'œil : ce que lundi lui rapportera — ou ce qui
 * manque pour ça —, puis la ligue qui le fixe.
 */
export function phraseDeLaSemaine(s: Pick<SemaineDesDuels, 'duels' | 'ligue'>): { titre: string; detail: string } {
  const l = ligueParCle(s.ligue)
  const manque = DUELS_POUR_LA_RECOMPENSE - s.duels
  return manque > 0
    ? { titre: `Encore ${duels(manque)} cette semaine`, detail: `pour les ${l.confettis} confettis de ta ${l.nom.toLowerCase()}, lundi` }
    : { titre: `Lundi : +${l.confettis} confettis`, detail: `ta meilleure ligue de la semaine, la ${l.nom.toLowerCase()} · ${duels(s.duels)} joués` }
}

/** Ce qui le sépare de la ligue d'au-dessus : une barre, et ce qu'il manque. */
function VersLaLigueSuivante({ cote }: { cote: number }) {
  const l = ligueDe(cote)
  const suivante = ligueSuivante(l)
  if (!suivante) return <p className="duels-vers muted small">{espacesFines('Tout en haut : garde ta place parmi les maîtres.')}</p>
  // La bronze n'a pas de plancher : sa barre part de la cote de départ.
  const depuis = Number.isFinite(l.depuis) ? l.depuis : suivante.depuis - 100
  const part = Math.max(0, Math.min(1, (cote - depuis) / (suivante.depuis - depuis)))
  return (
    <div className="duels-vers">
      <span className="duels-barre" aria-hidden="true">
        <i style={{ width: `${Math.round(part * 100)}%` }} />
      </span>
      <span className="muted small">{espacesFines(`Encore ${suivante.depuis - cote} points pour la ${suivante.nom.toLowerCase()}`)}</span>
    </div>
  )
}

/** Le héros de la page : sa ligue en blason, sa cote en grand, la ligue d'après, sa semaine. */
function HerosDesDuels({ etat }: { etat: EtatDesDuels | null }) {
  const ligue = ligueParCle(etat?.ligue ?? 'bronze')
  const semaine = etat && phraseDeLaSemaine(etat.semaine)
  return (
    <section className="atlas-branche campagne-heros duels-heros" style={lueur(LUEUR[ligue.cle])} aria-labelledby="duels-titre">
      <span className="atlas-categorie">Les duels</span>
      <div className="duels-ligue">
        <BlasonDeLigue ligue={ligue.cle} taille={60} decoratif />
        <div>
          <h1 id="duels-titre">{etat ? ligue.nom : 'Ta ligue'}</h1>
          <p className="duels-cote">
            <b>{etat ? etat.cote : '–'}</b>
            <span className="muted small">
              {!etat ? 'ta cote' : etat.joues === 0 ? 'ta cote de départ' : etat.joues < DUELS_DE_PLACEMENT ? `ta cote · ${duels(etat.joues)}, les ${DUELS_DE_PLACEMENT} premiers comptent double` : `ta cote · ${duels(etat.joues)}`}
            </span>
          </p>
        </div>
      </div>
      {/* En chemin, les lignes de la vraie ligue gardent leur place : la page sautait de 118 px
          quand la cote arrivait (CLS 0,107, l'experte du jeu solo, le 11 octobre 2026). */}
      {etat ? (
        <VersLaLigueSuivante cote={etat.cote} />
      ) : (
        <div className="duels-vers" aria-hidden="true">
          <span className="duels-barre">
            <i style={{ width: 0 }} />
          </span>
          <span className="muted small">{' '}</span>
        </div>
      )}
      <div className="duels-semaine" aria-live="polite">
        <span className="duels-pastilles" role="img" aria-label={etat ? `${Math.min(etat.semaine.duels, DUELS_POUR_LA_RECOMPENSE)} sur ${DUELS_POUR_LA_RECOMPENSE}` : 'cette semaine'}>
          {Array.from({ length: DUELS_POUR_LA_RECOMPENSE }, (_, i) => (
            <i key={i} className={etat && i < etat.semaine.duels ? 'jouee' : undefined} />
          ))}
        </span>
        <span>
          <b>{semaine ? espacesFines(semaine.titre) : 'Cette semaine'}</b>
          {semaine ? (
            <span className="muted small">{espacesFines(semaine.detail)}</span>
          ) : (
            // Sa phrase tient deux lignes au téléphone : la place des deux.
            <span className="muted small">
              …<br />
              {' '}
            </span>
          )}
          <span className="muted small">{etat ? cloture(etat.semaine.minutesRestantes) : ' '}</span>
        </span>
      </div>
    </section>
  )
}

/**
 * « Comment ça marche ? » — déplié tant qu'il n'a joué aucun duel : six
 * phrases, dans l'ordre où il les vivra.
 */
export function CommentCaMarche({ ouvert }: { ouvert: boolean }) {
  return (
    <details className="reglages-salon duels-regles" open={ouvert}>
      <summary>
        <Icon name="book" className="reglages-icone" />
        <span>
          <b>Comment ça marche ?</b>
          <span className="muted small">défier, la cote, les ligues, les récompenses</span>
        </span>
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
      <ol className="duels-etapes">
        <li>{espacesFines('« Défier quelqu’un » : choisis qui — un prénom, un ami, un joueur du classement : « Défier » est sur sa carte — et sur quoi. Tu joues d’abord, trois vies, sans chrono.')}</li>
        <li>{espacesFines('À ta dernière réponse, le duel part dans ses duels, et son téléphone sonne si ses notifications sont activées : aucun lien à envoyer.')}</li>
        <li>{espacesFines('Le duel joué des deux côtés, vos deux cotes bougent : gagné, la tienne monte ; perdu, elle baisse. Battre plus fort que toi rapporte plus : avant de jouer, tu sais combien.')}</li>
        <li>{espacesFines('Pressé ? « Un adversaire au hasard » : la série d’un joueur de ton niveau, son score à battre, tout de suite.')}</li>
        <li>{espacesFines(`Tout le monde part de 1000, en ligue de bronze. Une ligue tous les cent points, jusqu’aux maîtres ; tes ${DUELS_DE_PLACEMENT} premiers duels comptent double.`)}</li>
        <li>{espacesFines(`Chaque lundi, ta meilleure ligue de la semaine te rapporte ses confettis, dès ${DUELS_POUR_LA_RECOMPENSE} duels joués dans la semaine.`)}</li>
      </ol>
    </details>
  )
}

/** Les ligues et ce qu'elles rapportent chaque semaine — la sienne marquée. Déplié tant qu'il n'a joué aucun duel. */
function LesLigues({ ligue, ouvert }: { ligue: CleDeLigue; ouvert: boolean }) {
  return (
    <details className="reglages-salon duels-ligues" open={ouvert}>
      <summary>
        <Icon name="trophy" className="reglages-icone" />
        <span>
          <b>Les ligues et leurs récompenses</b>
          <span className="muted small">{`chaque lundi, dès ${DUELS_POUR_LA_RECOMPENSE} duels dans la semaine`}</span>
        </span>
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
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
    </details>
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
      <Avatar className="lb-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} />
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
 * page (`EtatDesDuels.classement`) : la feuille s'ouvre sans attendre.
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

/** Ses derniers duels au hasard : contre qui, le score, l'issue — et ce qu'ils ont fait à sa cote. */
function SesDerniersDuels({ dernieres }: { dernieres: readonly ResumeDeRencontre[] }) {
  if (dernieres.length === 0) return null
  return (
    <section className="duel-liste" aria-labelledby="duels-derniers-titre">
      <h2 id="duels-derniers-titre" className="label">
        Tes derniers duels au hasard
      </h2>
      <ul className="rencontre-liste">
        {dernieres.map(r => (
          <li key={r.serie} className={r.issue ? `rencontre-${r.issue}` : undefined}>
            <span className="rencontre-adversaire" aria-hidden="true">
              {r.adversaire.avatar}
            </span>
            <b>{scoreDeRencontre(r.justes, r.adversaire)}</b>
            <span className="rencontre-issue">
              {r.issue ? MOT_DE_L_ISSUE[r.issue] : 'en cours'}
              {r.ecart !== undefined && <span className={r.ecart >= 0 ? 'duels-plus' : 'duels-moins'}>{` ${ecartSigne(r.ecart)}`}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Ses duels joués, repliés sous un seul titre : contre quelqu'un, au hasard,
 * et ses défis entre amis d'avant. Trois listes l'une sous l'autre
 * allongeaient la page de plusieurs écrans (le propriétaire, le 11 octobre
 * 2026 : « pas trop de choses au même endroit ») ; repliées, elles ne se
 * rendent — et ses défis d'avant ne se demandent — qu'au dépli.
 */
function TesDuelsJoues({ etat, recus, onOuvrir }: { etat: EtatDesDuels; recus: MesAmis['recus']; onOuvrir: (code: string) => void }) {
  const [ouvert, setOuvert] = useState(false)
  const rien = !(etat.contre ?? []).some(d => !duelEnRoute(d)) && etat.dernieres.length === 0
  return (
    <details className="reglages-salon duels-joues" onToggle={e => setOuvert(e.currentTarget.open)}>
      <summary>
        <Icon name="clock" className="reglages-icone" />
        <span>
          <b>Tes duels joués</b>
          <span className="muted small">contre qui, le score, ce qu’ils ont fait à ta cote</span>
        </span>
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
      {ouvert && (
        <div className="duels-joues-corps">
          {etat.contre && <TesDuelsContre duels={etat.contre} recus={recus} joues onOuvrir={onOuvrir} />}
          <SesDerniersDuels dernieres={etat.dernieres} />
          <MesDuels onOuvrir={onOuvrir} />
          {rien && <p className="muted small">{espacesFines('Rien encore : tes duels s’y rangeront une fois joués des deux côtés.')}</p>}
        </div>
      )}
    </details>
  )
}

/**
 * Deux portes sous les boutons des duels, chacune sa feuille : le
 * classement, et ses amis. La page les montrait en entier l'un sous l'autre,
 * une épée et une croix sur chaque ligne (le propriétaire, le 11 octobre
 * 2026 : « un texte ou bouton voir le classement, pour ne pas avoir trop de
 * choses au même endroit »). La même place pendant que la page arrive.
 */
function PortesDesDuels({ amis, onClassement, onAmis }: { amis?: number; onClassement?: () => void; onAmis?: () => void }) {
  return (
    <div className="duels-portes">
      <button type="button" className="btn" aria-disabled={!onClassement || undefined} onClick={onClassement}>
        <Icon name="trophy" />
        Voir le classement
      </button>
      <button type="button" className="btn" aria-disabled={!onAmis || undefined} onClick={onAmis}>
        <Icon name="users" />
        {amis ? `Mes amis · ${amis}` : 'Mes amis'}
      </button>
    </div>
  )
}

/**
 * La page des duels (le souhait du propriétaire du 11 octobre 2026 : « tu
 * choisis sur quoi tu veux défier, une barre de recherche, un classement de
 * la ligue ; une liste d'amis avec leur classement et leur ligue, et pouvoir
 * ajouter des amis » — puis, le soir même, le classement et les amis chacun
 * derrière sa porte) : sa ligue, sa cote et sa semaine en tête ; ce qu'on
 * lui a envoyé, à relever ; « Défier quelqu'un » — qui, sur quoi, il joue
 * d'abord —, et un adversaire au hasard s'il y en a un ; « Voir le
 * classement » et « Mes amis », chacun sa feuille, où un toucher ouvre la
 * carte du joueur et « Défier » à son pied ; ses duels en route ; la cloche ;
 * puis, repliés, ses duels joués, les ligues et comment ça marche — dépliés
 * tant qu'il n'a joué aucun duel.
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
  const [classementOuvert, setClassementOuvert] = useState(false)
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
    // La feuille des amis en fond, la page montrée : « Mes amis », touché, l'ouvre tout de suite.
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
  const debutant = !!etat && etat.joues === 0
  // Sa cote, pour que la préparation dise ce que chaque duel met en jeu.
  const moi = etat ? { cote: etat.cote, joues: etat.joues } : undefined
  const defier = (j?: JoueurADefier) => onDefier(j, moi)
  // Sans série finie d'un autre, le bouton ne menait qu'à « personne à affronter » ; en attendant la page, il garde sa place.
  const auHasard = !!enCours || !etat || etat.auHasard !== false
  return (
    <div className="player-shell campagne duels">
      <Sortie />
      <HerosDesDuels etat={etat} />
      {etat?.semainePassee && (
        <p className="card duels-semaine-passee" role="status">
          <BlasonDeLigue ligue={etat.semainePassee.ligue} taille={28} decoratif />
          <span>{espacesFines(`+${etat.semainePassee.confettis} confettis : ta ${ligueParCle(etat.semainePassee.ligue).nom.toLowerCase()} de la semaine dernière`)}</span>
        </p>
      )}
      {/* Ce qu'on lui a envoyé d'abord : c'est ce qui l'attend, et le bouton de l'accueil le disait. */}
      <DefisRecus recus={amis?.recus ?? []} onOuvrir={onOuvrirDuel} />
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <BoutonsDesDuels
        busy={busy}
        onDefier={() => defier()}
        auHasard={auHasard}
        onAuHasard={() => void chercher()}
        reprendre={enCours ? `Reprendre contre ${enCours.adversaire.nom} · ${scoreDeRencontre(enCours.serie.justes, enCours.adversaire, enCours.sesJustes)}` : null}
        sous={
          enCours?.enjeu
            ? `Ton duel au hasard, en route — en jeu : ${ecartSigne(enCours.enjeu.gagne)} si tu gagnes, ${ecartSigne(enCours.enjeu.perdu)} si tu perds.`
            : 'Qui tu veux, sur ce que tu veux : tu joues d’abord, le duel lui part à ta dernière réponse.'
        }
      />
      <PortesDesDuels amis={amis?.amis.length} onClassement={etat ? () => setClassementOuvert(true) : undefined} onAmis={feuilleDesAmis.ouvrir} />
      {debutant && <CommentCaMarche ouvert />}
      {etat?.contre && <TesDuelsContre duels={etat.contre} recus={amis?.recus ?? []} onOuvrir={onOuvrirDuel} />}
      <LaClocheDesDefis />
      {etat && !debutant && <TesDuelsJoues etat={etat} recus={amis?.recus ?? []} onOuvrir={onOuvrirDuel} />}
      {etat && <LesLigues ligue={etat.ligue} ouvert={debutant} />}
      {etat && !debutant && <CommentCaMarche ouvert={false} />}
      {classementOuvert && etat && <FeuilleDuClassement classement={etat.classement} onOuvrir={ouvrir} onFermer={() => setClassementOuvert(false)} />}
      {feuilleDesAmis.feuille}
      {carte}
    </div>
  )
}

/**
 * Les deux portes des duels : « Défier quelqu'un » — qui, sur quoi —, en
 * grand ; « Un adversaire au hasard » dessous — ou celui qu'il a laissé en
 * route —, quand il y en a un. La même place pendant que la page arrive.
 */
function BoutonsDesDuels({
  busy,
  onDefier,
  auHasard,
  onAuHasard,
  reprendre,
  sous,
}: {
  busy: boolean
  onDefier?: () => void
  auHasard: boolean
  onAuHasard?: () => void
  reprendre: string | null
  sous: string
}) {
  return (
    <>
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={!onDefier || undefined} onClick={onDefier}>
        <Icon name="swords" />
        Défier quelqu’un
      </button>
      {auHasard && (
        <button type="button" className="btn btn-block" aria-disabled={busy || !onAuHasard || undefined} onClick={onAuHasard}>
          <Icon name={reprendre ? 'play' : 'dice'} />
          {reprendre ?? 'Un adversaire au hasard'}
        </button>
      )}
      <p className="muted small centre duels-sous-bouton">{espacesFines(sous)}</p>
    </>
  )
}

/**
 * La page des duels qui s'ouvre tout de suite, avant que le serveur ait dit
 * qui joue : son héros à sa place — rien ne bouge quand la cote arrive —, et
 * les boutons qui attendent.
 */
export function DuelsEnChemin() {
  return (
    <div className="player-shell campagne duels" aria-busy="true">
      <Sortie />
      <HerosDesDuels etat={null} />
      <BoutonsDesDuels busy auHasard reprendre={null} sous="Qui tu veux, sur ce que tu veux : tu joues d’abord, le duel lui part à ta dernière réponse." />
      <PortesDesDuels />
    </div>
  )
}

/**
 * La fin d'un duel classé : sa cote, avant et après, l'écart en couleur — et
 * la ligue gagnée ou perdue, dite en clair —, puis sa semaine : ce qui manque
 * à sa récompense, ou ce qu'elle rapportera lundi.
 */
export function CoteApresLeDuelVue({ cote }: { cote: CoteApresLeDuel }) {
  const ligue = ligueParCle(cote.ligue)
  const avant = ligueParCle(cote.ligueAvant)
  const monte = LIGUES.indexOf(ligue) > LIGUES.indexOf(avant)
  const descend = LIGUES.indexOf(ligue) < LIGUES.indexOf(avant)
  const semaine = phraseDeLaSemaine(cote.semaine)
  return (
    <section className={'card duels-fin' + (monte ? ' duels-promu' : '')} aria-labelledby="duels-fin-titre">
      <div className="duels-fin-cote">
        <BlasonDeLigue ligue={ligue.cle} taille={48} decoratif />
        <span>
          <span id="duels-fin-titre" className="label">
            Ta cote
          </span>
          <b>{cote.apres}</b>
          <span className={'duels-fin-ecart ' + (cote.ecart >= 0 ? 'duels-plus' : 'duels-moins')}>{ecartSigne(cote.ecart)}</span>
          <span className="muted small">{`${ligue.nom} · c’était ${cote.avant}`}</span>
        </span>
      </div>
      {monte && <p className="campagne-record-battu">{espacesFines(`Tu montes en ${ligue.nom.toLowerCase()} !`)}</p>}
      {descend && <p className="muted small">{espacesFines(`Tu redescends en ${ligue.nom.toLowerCase()}. Pour la récompense de lundi, ta meilleure ligue de la semaine compte.`)}</p>}
      <p className="duels-fin-semaine">
        <b>{espacesFines(semaine.titre)}</b>
        <span className="muted small">{espacesFines(semaine.detail)}</span>
      </p>
    </section>
  )
}

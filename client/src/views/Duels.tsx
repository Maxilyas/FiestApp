import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { Avatar } from '../components/Avatar'
import { NomLaure, texteDuLaurier } from '../components/Laurier'
import { Rank } from '../components/Rank'
import { BlasonDeLigue } from '../components/Blason'
import { lueur } from '../components/Atlas'
import { deNom, espacesFines } from '../format'
import { useCarteDuClassement } from './Defi'
import { DefierUnAmi, DefisRecus, MesDuels, TesAmis } from './Duel'
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
  type LigneDesDuels,
  type SemaineDesDuels,
} from '../../../shared/duels'
import type { AmiDeCampagne, MesAmis, RencontreDeCampagne, ResumeDeRencontre } from '../../../shared/campagne'

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
      {etat && <VersLaLigueSuivante cote={etat.cote} />}
      <div className="duels-semaine" aria-live="polite">
        <span className="duels-pastilles" role="img" aria-label={etat ? `${Math.min(etat.semaine.duels, DUELS_POUR_LA_RECOMPENSE)} sur ${DUELS_POUR_LA_RECOMPENSE}` : 'cette semaine'}>
          {Array.from({ length: DUELS_POUR_LA_RECOMPENSE }, (_, i) => (
            <i key={i} className={etat && i < etat.semaine.duels ? 'jouee' : undefined} />
          ))}
        </span>
        <span>
          <b>{semaine ? espacesFines(semaine.titre) : 'Cette semaine'}</b>
          <span className="muted small">{semaine ? espacesFines(semaine.detail) : '…'}</span>
          {etat && <span className="muted small">{cloture(etat.semaine.minutesRestantes)}</span>}
        </span>
      </div>
    </section>
  )
}

/**
 * « Comment ça marche ? » — déplié tant qu'il n'a joué aucun duel : cinq
 * phrases, dans l'ordre où il les vivra.
 */
function CommentCaMarche({ ouvert }: { ouvert: boolean }) {
  return (
    <details className="reglages-salon duels-regles" open={ouvert}>
      <summary>
        <Icon name="book" className="reglages-icone" />
        <span>
          <b>Comment ça marche ?</b>
          <span className="muted small">la cote, les ligues, les récompenses</span>
        </span>
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
      <ol className="duels-etapes">
        <li>{espacesFines('« Trouver un adversaire » : un joueur de ton niveau a fini une série. Tu joues les mêmes questions, trois vies, sans chrono — son score est à battre.')}</li>
        <li>{espacesFines('Gagné, ta cote monte ; perdu, elle baisse. Battre un gros score rapporte plus, perdre contre un petit coûte plus : avant de jouer, tu sais combien.')}</li>
        <li>{espacesFines(`Tout le monde part de 1000, en ligue de bronze. Une ligue tous les cent points, jusqu’aux maîtres ; tes ${DUELS_DE_PLACEMENT} premiers duels comptent double.`)}</li>
        <li>{espacesFines(`Chaque lundi, ta meilleure ligue de la semaine te rapporte ses confettis, dès ${DUELS_POUR_LA_RECOMPENSE} duels joués dans la semaine.`)}</li>
        <li>{espacesFines('Les défis entre amis se jouent pour le plaisir : ils ne changent pas ta cote.')}</li>
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

/** Une ligne du classement des duels : sa place, son avatar, son prénom, sa ligue, sa cote — un toucher ouvre sa carte. */
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

/** Le classement : ceux qui ont joué ces quatre dernières semaines, de la plus haute cote à la plus basse. */
function ClassementDesDuelsVue({ classement, onOuvrir }: { classement: EtatDesDuels['classement']; onOuvrir: (profileId: string) => void }) {
  return (
    <section className="defi-classement" aria-labelledby="duels-classement-titre">
      <h2 id="duels-classement-titre" className="label">
        Le classement
      </h2>
      {classement.joueurs === 0 ? (
        <p className="muted small">Personne n’a encore joué de duel : la première place t’attend.</p>
      ) : (
        <div className="leaderboard">
          {classement.lignes.map(l => (
            <LigneDuClassement key={l.profileId} ligne={l} moi={l.profileId === classement.sienne} onOuvrir={onOuvrir} />
          ))}
          {classement.moi && (
            <>
              <p className="muted center small">…</p>
              <LigneDuClassement ligne={classement.moi} moi onOuvrir={onOuvrir} />
            </>
          )}
        </div>
      )}
      <p className="muted small">{espacesFines('Ceux qui ont joué un duel ces quatre dernières semaines. Touche un nom : sa carte s’ouvre.')}</p>
    </section>
  )
}

/** Ses derniers duels : contre qui, le score, l'issue — et ce qu'ils ont fait à sa cote. */
function SesDerniersDuels({ dernieres }: { dernieres: readonly ResumeDeRencontre[] }) {
  if (dernieres.length === 0) return null
  return (
    <section className="duel-liste" aria-labelledby="duels-derniers-titre">
      <h2 id="duels-derniers-titre" className="label">
        Tes derniers duels
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
 * La page des duels : sa ligue, sa cote et sa semaine en tête ; les défis
 * que ses amis lui envoient, à relever ; « Trouver un adversaire », le duel
 * classé ; « Défier un ami », amical ; le classement, dont chaque nom ouvre
 * la carte ; ses derniers duels et ses défis entre amis ; les ligues et
 * comment ça marche, dépliés tant qu'il n'a joué aucun duel.
 */
export function PageDesDuels({
  amis,
  onJouer,
  onLancer,
  onOuvrirDuel,
  onRetirerAmi,
}: {
  /** Ses amis et les défis qu'ils lui envoient ; null tant qu'ils arrivent. */
  amis: MesAmis | null
  /** Un duel classé trouvé — ou repris : la partie se joue sur l'écran de la série (`CampagneApp`). */
  onJouer: (r: RencontreDeCampagne) => void
  onLancer: (ami?: AmiDeCampagne) => void
  onOuvrirDuel: (code: string) => void
  onRetirerAmi: (ami: AmiDeCampagne) => void
}) {
  const [etat, setEtat] = useState<EtatDesDuels | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const { ouvrir, carte } = useCarteDuClassement()

  useEffect(() => {
    let vivant = true
    api.duels
      .etat()
      .then(e => vivant && setEtat(e))
      .catch(e => vivant && setErreur(motifDe(e)))
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
      {/* Ce qu'un ami lui a envoyé d'abord : c'est ce qui l'attend, et le bouton de l'accueil le disait. */}
      <DefisRecus recus={amis?.recus ?? []} onOuvrir={onOuvrirDuel} />
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void chercher()}>
        <Icon name="swords" />
        {enCours ? `Reprendre contre ${enCours.adversaire.nom} · ${scoreDeRencontre(enCours.serie.justes, enCours.adversaire, enCours.sesJustes)}` : 'Trouver un adversaire'}
      </button>
      <p className="muted small centre duels-sous-bouton">
        {espacesFines(
          enCours?.enjeu
            ? `En jeu : ${ecartSigne(enCours.enjeu.gagne)} si tu gagnes, ${ecartSigne(enCours.enjeu.perdu)} si tu perds.`
            : 'Un joueur de ton niveau : ses questions, son score à battre. Ta cote se joue à chaque duel.',
        )}
      </p>
      {debutant && <CommentCaMarche ouvert />}
      <DefierUnAmi amis={amis?.amis ?? null} onLancer={onLancer} />
      {etat && <ClassementDesDuelsVue classement={etat.classement} onOuvrir={ouvrir} />}
      {etat && <SesDerniersDuels dernieres={etat.dernieres} />}
      <MesDuels onOuvrir={onOuvrirDuel} />
      {amis && <TesAmis amis={amis.amis} onDefier={onLancer} onRetirer={onRetirerAmi} />}
      {etat && <LesLigues ligue={etat.ligue} ouvert={debutant} />}
      {etat && !debutant && <CommentCaMarche ouvert={false} />}
      {carte}
    </div>
  )
}

/**
 * La page des duels qui s'ouvre tout de suite, avant que le serveur ait dit
 * qui joue : son héros à sa place — rien ne bouge quand la cote arrive —, et
 * le bouton qui attend.
 */
export function DuelsEnChemin() {
  return (
    <div className="player-shell campagne duels" aria-busy="true">
      <Sortie />
      <HerosDesDuels etat={null} />
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled="true">
        <Icon name="swords" />
        Trouver un adversaire
      </button>
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

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { Shape } from '../components/Shape'
import { BoutonCopier, BoutonPartager } from '../components/Partage'
import { BlasonDeLigue } from '../components/Blason'
import { OR, lueur } from '../components/Atlas'
import { deNom, espacesFines, rang } from '../format'
import { placeDuJour } from '../../../shared/course'
import {
  NOM_NIVEAU,
  issueDeRencontre,
  type AmiDeCampagne,
  type CorrectionDeCampagne,
  type DuelEntreAmis,
  type IssueDeRencontre,
  type ResumeDuDuel,
  type SerieDeCampagne,
} from '../../../shared/campagne'
import {
  DUELS_POUR_LA_RECOMPENSE,
  LIGUES,
  ligueDe,
  ligueParCle,
  type CleDeLigue,
  type DuelContre,
  type EnjeuDuDuel,
  type JoueurADefier,
  type SemaineDesDuels,
} from '../../../shared/duels'
import { LigneDuDefiVue } from './Defi'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import { PAGE_DES_DUELS, adresseDuDuel } from './adressesDesDuels'
import { ecartSigne, type ContreEnJeu } from './Rencontre'

export { ADRESSE_DU_LANCEMENT, adresseDuDuel } from './adressesDesDuels'

const lienDuDuel = (code: string) => `${window.location.origin}${PAGE_DES_DUELS}${adresseDuDuel(code)}`

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/** Ce que dit le message qui part avec le lien : son score, s'il a joué. */
export const texteDuDefi = (justes: number | null) =>
  justes === null ? 'Un défi entre amis sur FiestApp : feras-tu mieux que moi ?' : `${bonnes(justes)} à ce défi sur FiestApp : feras-tu mieux ?`

/** « Ferme dans 3 jours » : ce qui reste à un défi entre amis. */
export function fermeture(minutes: number): string {
  if (minutes <= 0) return 'Fermé : son classement est figé'
  // Un nombre ne quitte pas son mot à la ligne : « Ferme dans 7 » d'un côté, « jours » de l'autre.
  if (minutes < 60) return `Ferme dans ${minutes} minute${minutes > 1 ? 's' : ''}`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `Ferme dans ${heures} heure${heures > 1 ? 's' : ''}`
  const jours = Math.floor(heures / 24)
  return `Ferme dans ${jours} jour${jours > 1 ? 's' : ''}`
}

/** « 6 j », « 5 h », « 12 min » : ce qui reste à un duel, d'un coup d'œil, à côté d'un sablier. */
export function resteCourt(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const heures = Math.floor(minutes / 60)
  return heures < 24 ? `${heures} h` : `${Math.floor(heures / 24)} j`
}

/** Sur quoi un duel se joue, en un mot : « Histoire », « Les années 80 ». */
export const surQuoi = (d: { categories?: string[]; sujet?: string }) => nomDuChoix(d.categories ?? [], d.sujet) ?? 'Toutes les catégories'

/** Le geste qui change d'écran sans le recharger, la touche d'un nouvel onglet gardée. */
const surPlace = (faire: () => void) => (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  faire()
}

/** Le mouvement réduit, demandé au téléphone : la carte du verdict arrive alors déjà retournée. */
function mouvementReduit(): boolean {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ── Les pièces des duels (la maquette choisie le 12 octobre 2026) ────────

/**
 * Un avatar dans son anneau, à la couleur de sa ligue (`ligue-<clé>`) : les
 * lignes de la page des duels, le podium, la transmission d'un duel envoyé.
 * Sans ligue — aucun duel classé fini —, un anneau neutre : l'absence, pas
 * une ligue de bronze.
 */
export function Anneau({ avatar, ligue, petit, className }: { avatar: string; ligue?: CleDeLigue; petit?: boolean; className?: string }) {
  return (
    <span className={'duels-anneau' + (ligue ? ` ligue-${ligue}` : '') + (petit ? ' petit' : '') + (className ? ` ${className}` : '')} aria-hidden="true">
      {avatar}
    </span>
  )
}

/**
 * Sa semaine en trois losanges — un par duel, jusqu'à ceux qui ouvrent la
 * récompense —, le dernier joué qui luit, et ce que lundi lui rapportera :
 * sa meilleure ligue de la semaine. Le lundi, ce que la passée vient de
 * verser, à côté. En attendant la page, sa place, vide.
 */
export function SemaineEnLosanges({ semaine, passee, className }: { semaine: SemaineDesDuels | null; passee?: { confettis: number }; className?: string }) {
  const n = semaine ? Math.min(semaine.duels, DUELS_POUR_LA_RECOMPENSE) : 0
  const ligue = ligueParCle(semaine?.ligue ?? 'bronze')
  return (
    <p className={`duels-semaine ligue-${ligue.cle}` + (className ? ` ${className}` : '')}>
      <span className="duels-losanges" role="img" aria-label={`${n} duel${n > 1 ? 's' : ''} sur ${DUELS_POUR_LA_RECOMPENSE} cette semaine`}>
        {Array.from({ length: DUELS_POUR_LA_RECOMPENSE }, (_, i) => (
          <i key={i} className={i < n ? (i === n - 1 ? 'joue dernier' : 'joue') : undefined} />
        ))}
      </span>
      <span className={semaine ? undefined : 'duels-en-attente'}>
        <b>
          {`+${ligue.confettis} `}
          <span aria-hidden="true">🎊</span>
        </b>
        <span className="sr-only">{` confettis lundi, dès ${DUELS_POUR_LA_RECOMPENSE} duels`}</span>
        <span aria-hidden="true"> lundi</span>
      </span>
      {passee && (
        <span className="duels-semaine-passee">
          {`+${passee.confettis} `}
          <span aria-hidden="true">🎊</span>
          <span className="sr-only"> confettis</span> versés
        </span>
      )}
    </p>
  )
}

/** Ce qu'un duel met en jeu sur sa cote, en deux jetons : ce que la victoire rapporte, ce que la défaite coûte. */
function JetonsDeLEnjeu({ enjeu }: { enjeu: EnjeuDuDuel }) {
  return (
    <div className="duels-jetons" role="group" aria-label="Ce qui se joue sur ta cote">
      <span className="duels-jeton">
        <b className="num">{ecartSigne(enjeu.gagne)}</b>
        <span>victoire</span>
      </span>
      <span className="duels-jeton perdu">
        <b className="num">{ecartSigne(enjeu.perdu)}</b>
        <span>défaite</span>
      </span>
    </div>
  )
}

/** En bas d'un écran de duel : le geste d'or, puis ce qui ramène — à l'accueil, à ses duels. */
function GestesDuBas({ children }: { children: ReactNode }) {
  return <div className="duels-gestes-bas">{children}</div>
}

// ── Le verdict (la maquette C5) ───────────────────────────────────────────

/** Ce que la carte du verdict montre : les deux scores, sur quoi, et ce que le duel a fait à sa cote. */
export interface VerdictVu {
  /** Sur quoi : « Cinéma » — le surtitre. */
  quoi: string
  toi: { avatar: string; justes: number }
  lui: { nom: string; avatar: string; justes: number; ligue?: CleDeLigue }
  /** Ce qu'il a fait à sa cote ; absent : un duel qui ne compte pas. */
  ecart?: number
  /** Sa cote d'après, sa ligue, sa place au classement des duels. */
  apres?: { cote: number; ligue: CleDeLigue; rang?: number }
  semaine?: SemaineDesDuels
}

const TITRE_DU_VERDICT: Record<IssueDeRencontre, string> = { gagnee: 'Victoire', egalite: 'Égalité', perdue: 'Défaite' }

/**
 * La ligue qu'un duel lui a fait gagner ou perdre : 1, il monte ; −1, il
 * redescend ; 0, il y reste. Lue sur sa cote d'avant — celle d'après, moins
 * l'écart —, comme la fin d'un duel le disait (« Tu montes en ligue
 * d'argent ! »).
 */
export function changementDeLigue(v: Pick<VerdictVu, 'ecart' | 'apres'>): -1 | 0 | 1 {
  if (v.ecart === undefined || !v.apres) return 0
  const avant = LIGUES.indexOf(ligueDe(v.apres.cote - v.ecart))
  const apres = LIGUES.indexOf(ligueParCle(v.apres.ligue))
  return apres > avant ? 1 : apres < avant ? -1 : 0
}

/** Le verdict en une phrase, pour qui ne voit pas la carte : elle ne dit rien à un lecteur d'écran. */
export function phraseDuVerdict(v: VerdictVu): string {
  const issue = issueDeRencontre(v.toi.justes, v.lui.justes)
  const ligue = v.apres && ligueParCle(v.apres.ligue).nom.toLowerCase()
  const change = changementDeLigue(v)
  const cote =
    v.ecart === undefined
      ? ''
      : ` Ta cote : ${ecartSigne(v.ecart)}${v.apres ? `, ${v.apres.cote}, ${ligue}${v.apres.rang ? `, ${rang(v.apres.rang)} au classement` : ''}` : ''}.`
  const montee = change > 0 ? ` Tu montes en ${ligue} !` : change < 0 ? ` Tu redescends en ${ligue}.` : ''
  return espacesFines(`${TITRE_DU_VERDICT[issue]} : ${v.toi.justes} à ${v.lui.justes} contre ${v.lui.nom}.${cote}${montee}`)
}

/**
 * Le verdict d'un duel (la maquette C5, choisie par le propriétaire le
 * 12 octobre 2026 : « on ne sait pas quand quelqu'un a terminé si on a gagné
 * ou pas ») : une carte scellée, qui se retourne d'elle-même — le geste à
 * voir — sur la victoire ou la défaite, les deux scores, et ce que le duel a
 * fait à sa cote, sa ligue et sa place. Revue, elle arrive ouverte ; touchée,
 * elle se retourne encore. Dessous, sa semaine, le geste d'après en or — la
 * revanche, un autre adversaire —, l'accueil et ses réponses. La croix ramène
 * à ses duels.
 */
export function VerdictDuDuel({
  verdict: v,
  dos,
  aRetourner,
  suite,
  busy = false,
  onReponses,
  onFermer,
  erreur,
  extra,
  apres,
}: {
  verdict: VerdictVu
  /** Ce que dit le dos de la carte : « Hugo a joué », « Le score de Léa ». */
  dos: string
  /** Un résultat qu'il découvre : la carte arrive scellée, puis se retourne. */
  aRetourner: boolean
  /** Le geste d'or : « Revanche », « Un autre adversaire » — rien sans lui. */
  suite?: { texte: string; icone: IconName; onClick: () => void }
  busy?: boolean
  /** Ses réponses et la correction ; absent, déjà ouvertes. */
  onReponses?: () => void
  onFermer: () => void
  erreur?: string
  /** Ce qui est tombé avec le duel — hauts faits, légendaires, un niveau —, sous la semaine. */
  extra?: ReactNode
  /** Sous les gestes : la correction ouverte. */
  apres?: ReactNode
}) {
  const [ouverte, setOuverte] = useState(() => !aRetourner || mouvementReduit())
  const minuteur = useRef<number | undefined>(undefined)
  useEffect(() => {
    // La carte arrive scellée, puis se retourne d'elle-même : le geste à voir.
    if (!ouverte) minuteur.current = window.setTimeout(() => setOuverte(true), 900)
    return () => window.clearTimeout(minuteur.current)
    // Une fois, à l'arrivée : un toucher la retourne ensuite.
  }, [])
  const basculer = () => {
    window.clearTimeout(minuteur.current)
    setOuverte(o => !o)
  }
  const issue = issueDeRencontre(v.toi.justes, v.lui.justes)
  return (
    <div className="player-shell campagne duels-verdict">
      <button type="button" className="duels-fermer" aria-label="Fermer : mes duels" onClick={onFermer}>
        <Icon name="x" />
      </button>
      <p className="duels-surtitre">{`Duel terminé · ${v.quoi}`}</p>
      <p className="sr-only">{phraseDuVerdict(v)}</p>
      <div className="duels-scene">
        <button type="button" className="duels-scene-bouton" aria-label="Retourner la carte du duel" onClick={basculer}>
          <span className={'duels-carte3d' + (ouverte ? ' ouverte' : '')}>
            <span className={`duels-face duels-face-verdict ${issue}`} aria-hidden="true">
              {v.apres && <BlasonDeLigue ligue={v.apres.ligue} taille={18} decoratif className="duels-face-blason" />}
              <span className="num duels-face-titre">{TITRE_DU_VERDICT[issue]}</span>
              <span className="duels-face-scores">
                <span className="duels-face-joueur">
                  <span className="duels-face-avatar toi">{v.toi.avatar}</span>
                  <span className={'num duels-face-score' + (v.toi.justes >= v.lui.justes ? ' devant' : '')}>{v.toi.justes}</span>
                  <span className="duels-face-nom">Toi</span>
                </span>
                <span className="duels-face-trait" />
                <span className="duels-face-joueur">
                  <span className={'duels-face-avatar' + (v.lui.ligue ? ` ligue-${v.lui.ligue}` : '')}>{v.lui.avatar}</span>
                  <span className={'num duels-face-score' + (v.lui.justes >= v.toi.justes ? ' devant' : '')}>{v.lui.justes}</span>
                  <span className="duels-face-nom">{v.lui.nom}</span>
                </span>
              </span>
              {v.ecart !== undefined && (
                <span className={'duels-face-bande' + (v.ecart < 0 ? ' moins' : '')}>
                  <span className="num duels-face-ecart">{ecartSigne(v.ecart)}</span>
                  {v.apres && (
                    <span className="duels-face-cote">
                      <b className="num">{v.apres.cote}</b>
                      <span>
                        {/* Une ligue gagnée ou perdue : sa flèche, comme les places gagnées au classement. */}
                        {changementDeLigue(v) !== 0 && <span className={changementDeLigue(v) > 0 ? 'duels-plus' : 'duels-moins'}>{changementDeLigue(v) > 0 ? '▲ ' : '▼ '}</span>}
                        {`${ligueParCle(v.apres.ligue).court}${v.apres.rang ? ` · ${rang(v.apres.rang)}` : ''}`}
                      </span>
                    </span>
                  )}
                </span>
              )}
            </span>
            <span className="duels-face duels-face-dos" aria-hidden="true">
              <span className="duels-balaye" />
              <span className="duels-dos-sceau">
                <Icon name="spark" />
              </span>
              <span className="num duels-dos-titre">{dos}</span>
              <span className="duels-dos-aide">Touche pour retourner</span>
            </span>
          </span>
        </button>
      </div>
      {v.semaine && <SemaineEnLosanges semaine={v.semaine} className="sous-la-carte" />}
      {extra && <div className="duels-extra">{extra}</div>}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <GestesDuBas>
        {suite && (
          <button type="button" className="btn btn-primary btn-big btn-block btn-duel" aria-disabled={busy || undefined} onClick={suite.onClick}>
            <Icon name={suite.icone} />
            {suite.texte}
          </button>
        )}
        <div className="duels-gestes-paire">
          <a className="btn duels-contour" href="/">
            <Icon name="home" />
            Accueil
          </a>
          {onReponses && (
            <button type="button" className="btn duels-contour" onClick={onReponses}>
              <Icon name="book" />
              Réponses
            </button>
          )}
        </div>
      </GestesDuBas>
      {apres}
    </div>
  )
}

// ── Duel envoyé (la maquette A3) ──────────────────────────────────────────

/**
 * La fin d'un duel classé qu'il vient de jouer le premier (la maquette A3,
 * choisie par le propriétaire le 12 octobre 2026 : « quand on finit un duel,
 * il manque un bouton pour revenir à l'accueil ») : son score dans le
 * cadran, la transmission jusqu'à l'autre — son score lui part caché —, le
 * verdict qui attend qu'il ait joué, puis « Accueil » en or et ses duels.
 * Rien à envoyer : il est parti tout seul (`envoyerLesPrevus`).
 */
export function DuelEnvoye({
  quoi,
  justes,
  toi,
  lui,
  confettis,
  xp,
  extra,
  onMesDuels,
}: {
  quoi: string
  justes: number
  toi: { avatar: string; ligue?: CleDeLigue }
  lui: { nom: string; avatar: string; ligue?: CleDeLigue }
  confettis: number
  xp: number
  /** Ce qui est tombé avec la partie — hauts faits, légendaires, un niveau —, au-dessus des gestes. */
  extra?: ReactNode
  /** « Mes duels » : la page des duels, sans la recharger. */
  onMesDuels: () => void
}) {
  return (
    <div className="player-shell campagne duels-envoye">
      <p className="duels-surtitre">{`Duel classé · ${quoi}`}</p>
      <h1 className="duels-envoye-titre">Duel envoyé</h1>
      <div className="duels-envoye-cadran">
        <svg viewBox="0 0 184 184" aria-hidden="true">
          <circle className="duels-envoye-graduation" cx="92" cy="92" r="86" />
          <circle className="duels-envoye-disque" cx="92" cy="92" r="72" />
        </svg>
        <p>
          <b className="num">{justes}</b>
          <span>{justes > 1 ? 'bonnes réponses' : 'bonne réponse'}</span>
        </p>
      </div>
      {/* De lui à l'autre : trois points qui voyagent, le score caché dedans. */}
      <div className="duels-transmission" aria-hidden="true">
        <Anneau avatar={toi.avatar} ligue={toi.ligue} />
        <span className="duels-transmission-fil">
          <i />
          <i />
          <i />
        </span>
        <Anneau avatar={lui.avatar} ligue={lui.ligue} className="en-face" />
      </div>
      <p className="duels-envoye-chez">
        {`Chez ${lui.nom}, `}
        <span>ton score caché</span>
      </p>
      <p className="duels-puce-verdict">
        <Icon name="hourglass" />
        {`Verdict quand ${lui.nom} aura joué`}
      </p>
      {confettis > 0 && (
        <p className="duels-envoye-gains">
          <span aria-hidden="true">🎊</span>
          {` +${confettis}`}
          <span className="sr-only">{` confetti${confettis > 1 ? 's' : ''}`}</span>
          {xp > 0 && ` · +${xp} XP`}
        </p>
      )}
      {extra && <div className="duels-extra">{extra}</div>}
      <GestesDuBas>
        <a className="btn btn-primary btn-big btn-block btn-duel" href="/">
          <Icon name="home" />
          Accueil
        </a>
        <a className="btn btn-block duels-contour" href={PAGE_DES_DUELS} onClick={surPlace(onMesDuels)}>
          <Icon name="swords" />
          Mes duels
        </a>
      </GestesDuBas>
    </div>
  )
}

// ── Le défi entre amis d'avant ────────────────────────────────────────────

/**
 * Envoyer un défi : la feuille de partage du téléphone, le lien à copier, et
 * son code — de quoi le dire à voix haute. Sans l'une ni l'autre (une page
 * en http), le lien reste écrit, à sélectionner.
 */
function EnvoyerLeDefi({ code, texte }: { code: string; texte: string }) {
  const lien = lienDuDuel(code)
  return (
    <section className="card duel-envoi" aria-labelledby={`envoi-${code}`}>
      <h2 id={`envoi-${code}`} className="label">
        Envoie ce défi
      </h2>
      <p className="small">Qui ouvre son lien, profil en main, joue les mêmes questions — une fois, d’ici une semaine.</p>
      <div className="row duel-boutons">
        <BoutonPartager titre="Un défi entre amis sur FiestApp" texte={texte} url={lien} className="btn btn-primary" />
        <BoutonCopier texte={lien} />
      </div>
      <p className="muted small">
        <span className="duel-lien">{lien}</span> · son code : <b>{code}</b>
      </p>
    </section>
  )
}

/** « Tom, Hugo et Inès » : des prénoms dans une phrase. */
const enPhrase = (noms: readonly string[]) => (noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`)

/**
 * L'envoyer à d'autres amis, d'un toucher — ceux avec qui il a joué un défi
 * entre amis (`shared/campagne.ts`) : il les attend dans leurs duels, sans
 * lien à faire suivre, et leur téléphone sonne. Rien de coché
 * d'office : ceux qu'il voulait défier, il les a choisis en le lançant
 * (`LancerUnDefi`) — tous cochés, la fin poussait à défier toute sa liste.
 * Celui qui l'a déjà — reçu ou relevé — ne se coche plus. Sans ami encore,
 * ce qui en fera.
 */
export function EnvoyerAuxAmis({ code }: { code: string }) {
  const [amis, setAmis] = useState<AmiDeCampagne[] | null>(null)
  // Le défi d'un autre se partage par son lien : seul celui qui l'a lancé l'envoie.
  const [sien, setSien] = useState(false)
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set())
  const [envoyes, setEnvoyes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let vivant = true
    api.campagne.amis
      .lire(code)
      .then(m => {
        if (!vivant) return
        setSien(!!m.sien)
        setAmis(m.amis)
      })
      // Une liste qui ne vient pas ne cache rien d'autre : le lien reste là.
      .catch(() => vivant && setAmis([]))
    return () => {
      vivant = false
    }
  }, [code])
  if (!amis || !sien) return null
  if (amis.length === 0) {
    return (
      <p className="muted small duel-amis-vide">
        {espacesFines('Tes amis viendront ici : ceux qui relèvent un de tes défis, ou dont tu en relèves un. La prochaine fois, ton défi les attendra dans leurs duels, sans lien à envoyer.')}
      </p>
    )
  }
  const aEnvoyer = amis.filter(a => !a.deja && choisis.has(a.profileId))
  const basculer = (id: string) =>
    setChoisis(c => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const envoyer = async () => {
    if (busy || aEnvoyer.length === 0) return
    setBusy(true)
    setErreur('')
    try {
      await api.campagne.duel.envoyer(
        code,
        aEnvoyer.map(a => a.profileId),
      )
      const partis = new Set(aEnvoyer.map(a => a.profileId))
      setEnvoyes(aEnvoyer.map(a => a.nom))
      setAmis(liste => liste && liste.map(a => (partis.has(a.profileId) ? { ...a, deja: 'recu' as const } : a)))
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card duel-amis" aria-labelledby={`amis-${code}`}>
      <h2 id={`amis-${code}`} className="label">
        {amis.some(a => a.deja) ? 'À d’autres amis' : 'À tes amis'}
      </h2>
      <div className="duel-amis-liste" role="group" aria-label="Les amis à qui l’envoyer">
        {amis.map(a => {
          const coche = !a.deja && choisis.has(a.profileId)
          return (
            <button
              key={a.profileId}
              type="button"
              className={'duel-ami' + (coche ? ' choisi' : '') + (a.deja ? ' deja' : '')}
              aria-pressed={a.deja ? undefined : coche}
              aria-disabled={a.deja ? true : undefined}
              onClick={() => !a.deja && basculer(a.profileId)}
            >
              <span className="duel-ami-avatar" aria-hidden="true">
                {a.avatar}
              </span>
              <span className="duel-ami-nom">{a.nom}</span>
              {a.deja ? <span className="muted small">{a.deja === 'releve' ? 'l’a relevé' : 'l’a reçu'}</span> : <Icon name={coche ? 'check' : 'plus'} />}
            </button>
          )
        })}
      </div>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <p className="small duel-amis-statut" role="status">
        {envoyes && partiAvec(envoyes)}
      </p>
      {aEnvoyer.length > 0 && (
        <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || undefined} onClick={() => void envoyer()}>
          <Icon name="users" />
          {`L’envoyer à ${enPhrase(amis.filter(a => aEnvoyer.includes(a)).map(a => a.nom))}`}
        </button>
      )}
    </section>
  )
}

/**
 * « Parti à Tom et Inès : … » — ce qui vient de leur arriver, sans promettre
 * une notification qu'ils n'ont peut-être pas voulue. Sans « il » ni
 * « elle » : un prénom ne dit pas lequel (« Bérénice s'était arrêté »,
 * l'experte du jeu solo, le 11 octobre 2026).
 */
const partiAvec = (noms: readonly string[]) =>
  espacesFines(
    `Parti à ${enPhrase(noms)} : il ${noms.length > 1 ? 'les ' : 'l’'}attend dans ${noms.length > 1 ? 'leurs' : 'ses'} duels, et ${noms.length > 1 ? 'leur téléphone sonne si leurs' : 'son téléphone sonne si ses'} notifications sont activées.`,
  )

/**
 * La fin de sa tentative à un défi entre amis d'avant : sa place pour
 * l'instant (sur l'écran de la série), à qui il vient de partir (`partiA` :
 * les amis choisis en le lançant), puis de quoi l'envoyer encore — à
 * d'autres amis d'un toucher, aux autres par son lien —, et son classement.
 * Un duel classé, lui, finit sur « Duel envoyé » (`DuelEnvoye`) ou sur son
 * verdict (`VerdictDuDuel`).
 */
export function FinDuDuel({ code, justes, partiA = [], onClassement }: { code: string; justes: number; partiA?: readonly string[]; onClassement: () => void }) {
  return (
    <>
      {partiA.length > 0 && (
        <p className="card duel-parti" role="status">
          <Icon name="check-circle" />
          <span>{partiAvec(partiA)}</span>
        </p>
      )}
      <EnvoyerAuxAmis code={code} />
      <EnvoyerLeDefi code={code} texte={texteDuDefi(justes)} />
      <button type="button" className="btn btn-block" onClick={onClassement}>
        <Icon name="trophy" />
        Le classement du défi
      </button>
      <p className="muted small centre">La correction s’ouvre à sa fermeture : elle soufflerait les réponses à ceux qui jouent encore.</p>
    </>
  )
}

/** La correction d'un duel ou d'un défi : chaque question, la bonne réponse, la sienne, et son anecdote. */
function CorrectionDuDuel({ correction }: { correction: CorrectionDeCampagne[] }) {
  return (
    <ol className="campagne-correction">
      {correction.map((c, i) => (
        <li key={i} className={'card ' + (c.juste ? 'campagne-juste' : 'campagne-rate')}>
          <span className="label">{NOM_NIVEAU[c.niveau]}</span>
          <p>{espacesFines(c.texte)}</p>
          <p className="muted small">
            <Shape index={c.bonne} inline /> {espacesFines(c.reponses[c.bonne])}
            {!c.juste && c.choix !== null && <> · tu avais dit {espacesFines(c.reponses[c.choix])}</>}
          </p>
          {c.anecdote && <p className="small campagne-anecdote">{espacesFines(c.anecdote)}</p>}
        </li>
      ))}
    </ol>
  )
}

// ── La page d'un duel ─────────────────────────────────────────────────────

/** « ← Les duels », seul en haut : la page d'où l'on vient, sans la recharger. */
function BarreDuDuel({ onRetour }: { onRetour: () => void }) {
  return (
    <div className="jour-barre duels-barre-haut">
      <Sortie vers="Les duels" href={PAGE_DES_DUELS} onClick={onRetour} />
    </div>
  )
}

/**
 * Celui qu'on affronte dans un duel classé, tel que la partie le dit à
 * chaque question — jamais son score, qui attend sa dernière réponse —, et
 * sa propre ligue, pour les anneaux de sa fin.
 */
function contreEnJeu(duel: DuelEntreAmis): ContreEnJeu | undefined {
  if (!duel.contre) return undefined
  const enFace = duel.auteur.toi ? duel.contre : duel.auteur
  const moi = duel.auteur.toi ? duel.auteur : duel.contre
  return {
    nom: enFace.nom,
    avatar: enFace.avatar,
    ...(enFace.ligue && { ligue: enFace.ligue }),
    ...(moi.ligue && { maLigue: moi.ligue }),
    ...(!duel.auteur.toi && { aDejaJoue: true as const }),
    ...(duel.enjeu && { enjeu: duel.enjeu }),
  }
}

/**
 * Un duel classé pas encore joué des deux côtés (la maquette C2, choisie par
 * le propriétaire le 12 octobre 2026 : « on voit le nombre de bonnes réponses
 * de l'adversaire avant d'avoir fait le quiz, c'est dommage ») : deux cartes.
 * La sienne, face cachée — un « ? » sous un cadenas, son score se dévoile à
 * sa dernière réponse —, ou un sablier tant qu'il n'a pas joué ; la tienne,
 * « à jouer », ou ton score qui l'attend. Puis ce qui se joue sur ta cote, en
 * deux jetons, les règles en trois signes, et « Relever le duel ».
 */
export function DuelFaceCachee({
  duel,
  busy,
  erreur,
  onRelever,
  onRetour,
}: {
  duel: DuelEntreAmis & { contre: NonNullable<DuelEntreAmis['contre']> }
  busy: boolean
  erreur: string
  onRelever: () => void
  onRetour: () => void
}) {
  const t = duel.tentative
  const ouvert = duel.minutesRestantes > 0
  const auteur = !!duel.auteur.toi
  const enFace = auteur ? duel.contre : duel.auteur
  const moi = auteur ? duel.auteur : duel.contre
  // Le sien joué : il attend l'autre. Pas encore : il le joue — ou le reprend.
  const joue = !!t?.finie
  const aJouer = ouvert && !joue
  // L'autre l'a lancé et joué : sa carte cache un score. Lancé par lui, l'autre n'a encore rien joué.
  const cache = !auteur
  const legende = !ouvert
    ? joue
      ? `${enFace.nom} ne l’a pas joué : il ne compte pas.`
      : 'Ce duel est fermé : il ne compte plus.'
    : joue
      ? `Chez ${enFace.nom}, ton score caché.`
      : cache
        ? 'Sa carte se retourne à ta dernière réponse.'
        : `Tu joues d’abord : le duel part à ${enFace.nom} à ta dernière réponse.`
  return (
    <div className="player-shell campagne duels-defi">
      <BarreDuDuel onRetour={onRetour} />
      <p className="duels-surtitre or">{`Duel classé · ${surQuoi(duel)}`}</p>
      <div className="duels-cartes">
        <span className="duels-carte-flotte">
          <span className="duels-carte duels-carte-dos">
            <span className="duels-balaye" />
            <span className="duels-carte-nom">
              <span aria-hidden="true">{enFace.avatar}</span>
              <span>{enFace.nom}</span>
            </span>
            {cache ? (
              <span className="num duels-carte-mystere" aria-hidden="true">
                ?
              </span>
            ) : (
              <span className="duels-carte-mystere" aria-hidden="true">
                <Icon name="hourglass" />
              </span>
            )}
            {cache && (
              <span className="duels-carte-sceau" role="img" aria-label="Score caché">
                <Icon name="lock" />
              </span>
            )}
          </span>
        </span>
        <span className={'duels-carte duels-carte-toi' + (moi.ligue ? ` ligue-${moi.ligue}` : '')}>
          <span className="duels-carte-avatar" aria-hidden="true">
            {moi.avatar}
          </span>
          <span className="num duels-carte-toi-nom">Toi</span>
          {joue && t ? (
            <span className="duels-carte-case joue">
              <b className="num">{t.justes}</b>
              <span className="sr-only">{t.justes > 1 ? ' bonnes réponses' : ' bonne réponse'}</span>
            </span>
          ) : (
            <span className="duels-carte-case">{!ouvert ? 'fermé' : t ? 'en cours' : 'à jouer'}</span>
          )}
        </span>
        <span className="duels-vs" aria-hidden="true">
          VS
        </span>
      </div>
      <p className="duels-cartes-legende">{espacesFines(legende)}</p>
      {aJouer && duel.enjeu && <JetonsDeLEnjeu enjeu={duel.enjeu} />}
      {aJouer && (
        <ul className="duels-regles-ligne">
          <li>
            <Icon name="heart" />
            <span aria-hidden="true">× 3</span>
            <span className="sr-only">trois vies</span>
          </li>
          <li>
            <Icon name="infinity" />
            sans chrono
          </li>
          <li>
            <Icon name="hourglass" />
            <span aria-hidden="true">{resteCourt(duel.minutesRestantes)}</span>
            <span className="sr-only">{fermeture(duel.minutesRestantes)}</span>
          </li>
        </ul>
      )}
      {joue && ouvert && (
        <p className="duels-puce-verdict">
          <Icon name="hourglass" />
          {`Verdict quand ${enFace.nom} aura joué`}
        </p>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      {aJouer && (
        <GestesDuBas>
          <button type="button" className="btn btn-primary btn-big btn-block btn-duel" aria-disabled={busy || undefined} onClick={onRelever}>
            <Icon name="swords" />
            {t ? 'Reprendre le duel' : 'Relever le duel'}
          </button>
        </GestesDuBas>
      )}
    </div>
  )
}

/**
 * La page d'un duel (`/duels#duel-K7M2QX`). Un duel classé : ses deux cartes
 * tant qu'il n'est pas joué des deux côtés (`DuelFaceCachee`), puis la carte
 * du verdict, qui se retourne devant qui l'a lancé la première fois qu'il la
 * voit (`DuelEntreAmis.nouveau`) — revue, elle est ouverte —, la revanche et
 * sa correction. Un défi entre amis d'avant : qui l'a lancé, ce qu'il fait
 * jouer, le temps qui reste, sa tentative et le classement ; fermé, sa
 * correction. La partie se joue sur l'écran de la série (`CampagneApp`).
 */
export function PageDuDuel({
  code,
  onRetour,
  onJouer,
  onRevanche,
}: {
  code: string
  /** « ← Les duels » : la page d'où l'on vient, sans la recharger. */
  onRetour: () => void
  /** `lance` : le sien, repris — sa fin dit « Défi lancé » ; `contre` : un duel classé, qui l'on affronte et ce qui se joue. */
  onJouer: (tentative: SerieDeCampagne, code: string, lance: boolean, contre?: ContreEnJeu) => void
  /** « Revanche », sous la carte du verdict : la préparation d'un duel contre le même, lui déjà choisi. */
  onRevanche?: (joueur: JoueurADefier) => void
}) {
  const [duel, setDuel] = useState<DuelEntreAmis | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const [correction, setCorrection] = useState<CorrectionDeCampagne[] | null>(null)
  const { ouvrir: ouvrirLaCarte, carte } = useCarteDUnProfil()

  useEffect(() => {
    let vivant = true
    api.campagne.duel
      .lire(code)
      .then(d => vivant && setDuel(d))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [code])

  const relever = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const tentative = await api.campagne.duel.relever(code)
      // Un duel classé : la partie dit à chaque question contre qui et ce qui se joue — son score attend sa dernière réponse.
      if (tentative.question) onJouer(tentative, code, !!duel?.auteur.toi, duel ? contreEnJeu(duel) : undefined)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const voirCorrection = async (serie: string) => {
    try {
      setCorrection(await api.campagne.correction(serie))
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  // Avant qu'il arrive, on ne sait pas encore s'il est classé : sa barre seule.
  if (!duel) {
    return (
      <div className="player-shell campagne duels-defi" aria-busy={!erreur || undefined}>
        <BarreDuDuel onRetour={onRetour} />
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
      </div>
    )
  }

  const t = duel.tentative
  const ouvert = duel.minutesRestantes > 0

  if (duel.contre) {
    const enFace = duel.auteur.toi ? duel.contre : duel.auteur
    const moi = duel.auteur.toi ? duel.auteur : duel.contre
    // Joué des deux côtés — ou fermé, commencé des deux côtés : son écart dit qu'il compte.
    if (t?.finie && duel.ecart !== undefined && duel.aBattre !== undefined) {
      const revanche = duel.revanche
      return (
        <VerdictDuDuel
          verdict={{
            quoi: surQuoi(duel),
            toi: { avatar: moi.avatar, justes: t.justes },
            lui: { nom: enFace.nom, avatar: enFace.avatar, justes: duel.aBattre, ...(enFace.ligue && { ligue: enFace.ligue }) },
            ecart: duel.ecart,
            ...(duel.apres && { apres: duel.apres, semaine: duel.apres.semaine }),
          }}
          dos={duel.auteur.toi ? `${enFace.nom} a joué` : `Le score ${deNom(enFace.nom)}`}
          aRetourner={!!duel.nouveau}
          suite={revanche && onRevanche ? { texte: 'Revanche', icone: 'rotate', onClick: () => onRevanche(revanche) } : undefined}
          onReponses={(duel.corrige || !ouvert) && !correction ? () => void voirCorrection(t.id) : undefined}
          onFermer={onRetour}
          erreur={erreur}
          apres={correction && <CorrectionDuDuel correction={correction} />}
        />
      )
    }
    return <DuelFaceCachee duel={{ ...duel, contre: duel.contre }} busy={busy} erreur={erreur} onRelever={() => void relever()} onRetour={onRetour} />
  }

  // Un défi entre amis d'avant : sa page d'avant — son classement, de quoi l'envoyer, sa correction à sa fermeture.
  const sienne = [...duel.lignes, ...(duel.moi ? [duel.moi] : [])].find(l => l.profileId === duel.sienne)
  const joue = nomDuChoix(duel.categories ?? [], duel.sujet)
  return (
    <div className="player-shell campagne">
      <Sortie vers="Les duels" href={PAGE_DES_DUELS} onClick={onRetour} />
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">{duel.auteur.toi ? 'Ton défi entre amis' : 'Un défi entre amis'}</span>
        <h1>{duel.auteur.toi ? 'Qui fera mieux que toi ?' : `${duel.auteur.nom} te défie`}</h1>
        <div className="campagne-record-hud">
          {t?.finie || (t && !ouvert) ? <b>{t.justes}</b> : <b>{duel.joueurs}</b>}
          <span>
            {t?.finie || (t && !ouvert) ? (
              <>
                {t.justes > 1 ? 'bonnes réponses' : 'bonne réponse'}
                <br />
                {(sienne && placeDuJour(sienne.rang, duel.joueurs, sienne.justes)) ?? 'ta tentative est jouée'}
              </>
            ) : (
              <>
                {/* Joué, pas relevé : son auteur y compte, et l'on ne relève pas son propre défi. */}
                {duel.joueurs === 0 ? 'personne ne l’a joué' : duel.joueurs > 1 ? 'joueurs l’ont joué' : 'joueur l’a joué'}
                <br />
                {fermeture(duel.minutesRestantes)}
              </>
            )}
          </span>
        </div>
        <ul className="campagne-puces">
          <li>
            <Icon name="list" /> {joue ?? 'toutes les catégories'}
          </li>
          <li>
            <Icon name="target" /> le même tirage pour chacun, une seule tentative
          </li>
          <li>
            <Icon name="timer" /> trois vies, sans chrono
          </li>
          <li>
            <Icon name="users" /> amical : il ne change pas ta cote
          </li>
        </ul>
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      {ouvert && !t && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          Relever le défi
        </button>
      )}
      {ouvert && t && !t.finie && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          {`Reprendre mon défi · ${bonnes(t.justes)}`}
        </button>
      )}
      {!ouvert && !t && <p className="muted small centre">Ce défi est fermé : son classement est figé. Lance le tien depuis tes duels.</p>}

      {/* Le sien, pas encore joué jusqu'au bout : à qui il partira à sa dernière réponse. */}
      {ouvert && duel.prevus && duel.prevus.length > 0 && (
        <p className="card duel-parti duel-prevu">
          <Icon name="users" />
          <span>{espacesFines(`À ta dernière réponse, il partira à ${enPhrase(duel.prevus)}, ton score à battre avec lui.`)}</span>
        </p>
      )}
      {/* Le sien, ouvert : à d'autres amis d'un toucher, aux autres par son lien. */}
      {ouvert && duel.auteur.toi && <EnvoyerAuxAmis code={duel.code} />}
      {ouvert && (duel.auteur.toi || t?.finie) && <EnvoyerLeDefi code={duel.code} texte={texteDuDefi(t?.finie ? t.justes : null)} />}

      <section className="defi-classement" aria-labelledby="duel-classement-titre">
        <h2 id="duel-classement-titre" className="label">
          {ouvert ? 'Le classement, pour l’instant' : 'Le classement final'}
        </h2>
        {duel.joueurs === 0 ? (
          <p className="muted small">Personne n’a encore répondu : la première place t’attend.</p>
        ) : (
          <div className="leaderboard">
            {duel.lignes.map(l => (
              <LigneDuDefiVue key={l.profileId} ligne={l} moi={l.profileId === duel.sienne} onOuvrir={ouvrirLaCarte} />
            ))}
            {duel.moi && (
              <>
                <p className="muted center small">…</p>
                <LigneDuDefiVue ligne={duel.moi} moi onOuvrir={ouvrirLaCarte} />
              </>
            )}
          </div>
        )}
      </section>

      {/* Fermé : plus personne à qui souffler ses réponses. */}
      {!ouvert && t && !correction && (
        <button type="button" className="btn btn-block" onClick={() => void voirCorrection(t.id)}>
          <Icon name="book" />
          La correction du défi
        </button>
      )}
      {correction && <CorrectionDuDuel correction={correction} />}
      {carte}
    </div>
  )
}

/**
 * La cloche des défis, chargée avec la page des duels seulement : elle tire
 * le service worker et l'abonnement (`rappel.ts`), que la campagne et
 * l'accueil n'ont pas à télécharger. Son téléphone sonne quand on le défie,
 * et quand un duel qu'il a lancé vient d'être joué — si elle est allumée :
 * elle est coupée d'office. En haut à droite de la page, à côté de la sortie.
 */
const cloche = aLaDemande(() => import('../components/ClocheDesDefis'))
export function LaClocheDesDefis() {
  const laCloche = useALaDemande(cloche)
  return laCloche && laCloche !== 'perdu' ? <laCloche.ClocheDesDefis /> : null
}

/** Un duel contre quelqu'un encore en route : ouvert, et pas encore joué des deux côtés — à lui, ou à l'autre. */
export const duelEnRoute = (d: DuelContre) => d.minutesRestantes > 0 && (d.justes === null || d.sesJustes === null)

/**
 * La ligne d'un de ses défis : à qui il est, sur quoi, qui l'a joué, le temps
 * qui reste — et sa place, ou ce qu'il lui reste à faire. Personne encore :
 * rien à compter (« 0 joueur » ne disait rien). Et son propre défi se joue,
 * il ne se relève pas : il part à ses amis à sa dernière réponse.
 */
export function ligneDuDuel(d: ResumeDuDuel): { titre: string; detail: string; score: string } {
  const joueurs = d.joueurs > 0 ? `${d.joueurs} joueur${d.joueurs > 1 ? 's' : ''}` : null
  return {
    // « Le défi d’Aline » ; « Un joueur », le nom d'un profil masqué, s'élide sans sa majuscule.
    titre: d.auteur === 'toi' ? 'Ton défi' : d.auteur === 'Un joueur' ? 'Le défi d’un joueur' : `Le défi ${deNom(d.auteur)}`,
    detail: [nomDuChoix(d.categories ?? [], d.sujet) ?? 'toutes les catégories', joueurs, fermeture(d.minutesRestantes)].filter(Boolean).join(' · '),
    score:
      d.justes !== null && d.rang !== null
        ? `${d.rang}${d.rang === 1 ? 'er' : 'e'} · ${d.justes} bonne${d.justes > 1 ? 's' : ''}`
        : d.auteur === 'toi'
          ? 'à jouer'
          : 'à relever',
  }
}

/**
 * Ses défis entre amis d'avant, sous son historique : ceux qu'il a lancés ou
 * relevés ces trente derniers jours — un lien perdu ne perd pas le défi.
 * Rien tant qu'il n'en a aucun.
 */
export function MesDuels({ onOuvrir }: { onOuvrir: (code: string) => void }) {
  const [duels, setDuels] = useState<ResumeDuDuel[] | null>(null)
  useEffect(() => {
    let vivant = true
    api.campagne.duel
      .miens()
      .then(d => vivant && setDuels(d))
      // Une liste qui ne vient pas ne cache rien d'autre : ses duels sont là.
      .catch(() => vivant && setDuels([]))
    return () => {
      vivant = false
    }
  }, [])
  if (!duels || duels.length === 0) return null
  return (
    <section className="duel-liste" aria-labelledby="mes-duels-titre">
      <h2 id="mes-duels-titre" className="label">
        Tes défis entre amis
      </h2>
      <ul>
        {duels.map(d => {
          const l = ligneDuDuel(d)
          return (
            <li key={d.code}>
              <button type="button" className="btn btn-block duel-ligne" onClick={() => onOuvrir(d.code)}>
                <span>
                  <b>{l.titre}</b>
                  <span className="muted small">{l.detail}</span>
                </span>
                <span className="duel-score">{l.score}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

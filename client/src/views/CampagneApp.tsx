import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Onglets } from '../components/Onglets'
import { ADRESSE_DES_SENTIERS, Sentiers, SentiersEnChemin, demanderLesSentiers } from './Sentiers'
import { ADRESSE_DU_DEFI, PageDuDefi } from './Defi'
import { ADRESSE_DU_LANCEMENT, PAGE_DES_DUELS, adresseDuDuel, adresseDuLancementContre, estLeLancement, profilDuLancement } from './adressesDesDuels'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { ADRESSE_DU_CARNET, PageDuCarnet, corpsDeLaVisee, prochaineFois, revientDans, tailleDuCarnet } from './Carnet'
import { EnJeu, ceQuIlPorte, scoreDeRencontre, type ContreEnJeu } from './Rencontre'
import { Visage } from '../components/Avatar'
import { nomDesCategories, nomDuChoix } from '../../../shared/nomDuChoix'
import { Shape } from '../components/Shape'
import { GesteDuBas, PieceTete, Sortie } from '../components/Pieces'
import { Vies } from '../components/Vies'
import { EclatTombe, LegendaireOuvert } from '../components/Ouverts'
import { SerieCorrigee } from '../components/SerieCorrigee'
import { APorter, CeQueTuGagnes, MissionsAccomplies, NouveauxTrophees, emojisAPorter, retenirLeNiveau, useNiveauRelu } from '../components/Gains'
import { GerbeDeJuste } from '../components/Gerbe'
import { EMBLEME } from '../components/Ecusson'
import { FeuilleDuChoix, LigneDuChoix } from '../components/ChoixDuTheme'
import { OR, lueur } from '../components/Atlas'
import { choixDialog, confirmDialog, promptDialog } from '../components/Dialog'
import { deNom, espacesFines } from '../format'
import { showToast, useAppState } from '../state'
import { porterTheme } from '../themeJoueur'
import { porterGerbe } from '../gerbe'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { placeDuJour } from '../../../shared/course'
import { versLesSentiers } from '../../../shared/depart'
import { CHANCE_ECLAT_DU_DEFI, brilleChez, type PublicProfile } from '../../../shared/profil'
import { cibleEclat } from '../../../shared/legendaires'
import { SUJETS, sujetParCle } from '../../../shared/sujets'
import {
  NIVEAUX,
  NOM_NIVEAU,
  QUESTIONS_POUR_JOUER,
  RECORD_DU_TOUR_DU_MONDE,
  SIGNALEMENT_MAX,
  JUSTES_DOUBLEES_PAR_JOUR,
  VIES,
  XP_PAR_JUSTE,
  issueDeRencontre,
  lireCodeDuDuel,
  type Adversaire,
  type AdversaireEnJeu,
  type ChoixDeLaCampagne,
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type IssueDeRencontre,
  type MesAmis,
  type Niveau,
  type QuestionDeCampagne,
  type RencontreDeCampagne,
  type ReponseDeCampagne,
  type SerieDeCampagne,
} from '../../../shared/campagne'
import { INTERVALLES_DE_REVISION, QUESTIONS_PAR_REVISION, partVisee, type EtatDuCarnet, type ViseeDuCarnet } from '../../../shared/revision'
import { aPorterDesTrophees, partsDeLXp, tropheesTombes, xpDesTrophees, type Tombe } from '../../../shared/gains'
import { ligueDe, type CoteApresLeDuel, type DuelOuvert, type EnjeuDuDuel, type JoueurADefier, type JoueurCroise } from '../../../shared/duels'

type Ecran =
  | { e: 'chargement' }
  | { e: 'anonyme' }
  | { e: 'erreur'; motif: string }
  | { e: 'accueil'; etat: EtatDeCampagne }
  /** La page des duels (`/duels`) : elle lit ses données elle-même (`PageDesDuels`). */
  | { e: 'duels' }
  | {
      e: 'jeu'
      serie: string
      question: QuestionDeCampagne
      vies: number
      justes: number
      total: number
      reponse: ReponseDeCampagne | null
      choix: number | null
      /** L'expérience gagnée depuis qu'on a ouvert la série sur cette page. */
      xp: number
      /** Ses catégories, que « Rejouer » reprend ; vide : toutes. */
      categories: string[]
      /** Le sujet qu'elle suit à travers les catégories, que « Rejouer » reprend aussi. */
      sujet: string | null
      /** Un défi — de la semaine, ou entre amis : la même partie, une seule tentative, son classement au bout. */
      defi?: true
      /** Un défi entre amis : son code, que sa fin envoie. */
      duel?: string
      /** Le sien : il l'a lancé, et sa fin le dit — il ne relève pas son propre défi. */
      lance?: true
      /** Une révision du carnet : sans vies, et chaque réponse dit où en est sa question. */
      revision?: true
      /** Les questions que cette révision vient de faire apprendre. */
      apprises?: number
      /**
       * Une rencontre — un duel classé : qui l'on affronte, ses bonnes réponses
       * jusqu'à la question qu'on vient de jouer, et ce qu'elle met en jeu sur sa
       * cote. Son score entier attend la dernière réponse.
       */
      rencontre?: { adversaire: AdversaireEnJeu; sesJustes: number; enjeu?: EnjeuDuDuel }
      /** Un duel contre quelqu'un : qui l'on affronte, s'il a déjà joué, et ce qui se joue sur sa cote. */
      contre?: ContreEnJeu
    }
  | {
      e: 'fin'
      serie: string
      categories: string[]
      sujet: string | null
      /** Arrêtée avant sa dernière vie (« Recommencer », puis « Arrêter là »). */
      abandonnee?: true
      justes: number
      /** Ses erreurs : elles reviendront demain dans le carnet. */
      erreurs: number
      /** Une révision du carnet : ses questions, ce qu'elle a fait apprendre, et le carnet relu. */
      revision?: { total: number; apprises: number; carnet: EtatDuCarnet | null }
      /** Une rencontre — ou un duel contre quelqu'un joué des deux côtés : qui l'on affrontait, son score entier, et qui l'a gagnée. */
      rencontre?: { adversaire: Adversaire; issue: IssueDeRencontre }
      /** Un duel contre quelqu'un qu'il vient de jouer le premier : il est parti, sa cote bougera quand l'autre l'aura joué. */
      classe?: true
      /** Un duel contre quelqu'un : qui l'on affrontait, sa ligue et la sienne — les anneaux de sa fin. */
      enFace?: ContreEnJeu
      /** Un duel contre quelqu'un joué des deux côtés : de quoi en relancer un, contre le même. */
      revanche?: JoueurADefier
      /** Un duel classé : ce qu'il a fait à sa cote, à sa ligue et à sa semaine. */
      cote?: CoteApresLeDuel
      record: boolean
      /** Le record d'avant la série : « L'ancien était de 12 », ou « Ton record : 12 ». */
      recordAvant: number | null
      /** La marche la plus haute atteinte : « jusqu'au niveau difficile ». */
      niveauAtteint: Niveau | null
      correction: CorrectionDeCampagne[] | null
      xp: number
      /** Les hauts faits et paliers que la série a fait tomber — le Funambule, L'Alpiniste… */
      recompenses: NonNullable<ReponseDeCampagne['recompenses']>
      /** Et les légendaires qu'ils ouvrent, qu'on porte d'ici. */
      legendaires: string[]
      /** Un défi — de la semaine, ou entre amis —, et sa place au classement pour l'instant. */
      defi?: true
      place?: { rang: number; joueurs: number }
      /** Un défi entre amis : son code, à envoyer. */
      duel?: string
      /** Le sien, qu'il vient de lancer. */
      lance?: true
      /** Le sien : les amis choisis en le lançant, à qui il vient de partir. */
      partiA?: string[]
      /** Ce qui a éclaté pour lui à la fin du défi de la semaine (`CHANCE_ECLAT_DU_DEFI`). */
      eclat?: string
    }

/**
 * Les modes de la campagne : la série à trois vies, les sentiers du savoir,
 * le défi de la semaine, et le carnet de révision. Et ceux de la page des
 * duels (`/duels`), qui en joue les parties sur le même écran : leur page, un
 * défi entre amis ouvert par son lien, et celui qu'on prépare (`#defier`).
 */
type Mode = 'serie' | 'sentiers' | 'defi' | 'carnet' | 'duels' | 'duel' | 'defier'

/** L'entrée d'historique qu'ouvre « Lancer un défi » : « ← Les duels » y revient d'un cran. */
const LANCEMENT = 'fiestappLancement'
/** Celle qu'ouvre un défi entre amis touché dans la page : « ← Les duels » y revient d'un cran. */
const DUEL_OUVERT = 'fiestappDuel'

/**
 * Les liens d'avant les duels — `/campagne#duel-K7M2QX`, `/campagne#defier` —
 * sont partis en messages et en notifications : ils mènent à leur page, sans
 * recharger — c'est le même code.
 */
if (window.location.pathname === '/campagne' && (window.location.hash.startsWith('#duel-') || window.location.hash === ADRESSE_DU_LANCEMENT)) {
  history.replaceState(history.state, '', `${PAGE_DES_DUELS}${window.location.search}${window.location.hash}`)
}

/**
 * La page que sert ce code : la campagne, ou les duels (`/duels`, le souhait
 * du propriétaire du 11 octobre 2026 : « Défier un joueur » hors de la
 * campagne), qui jouent leurs parties — un duel classé, un défi entre amis —
 * sur l'écran de la série.
 */
const DUELS = window.location.pathname === PAGE_DES_DUELS

/**
 * Le code de la page des duels (`Duels.tsx`) : `main.tsx` le demande avec
 * celui-ci quand on ouvre `/duels`, et la campagne ne le télécharge jamais.
 */
const lesDuels = aLaDemande(() => import('./Duels'))
if (DUELS) void lesDuels.charger().catch(() => {})
/** Pour `main.tsx` : la page des duels ne se rend qu'avec leur code là — `useALaDemande` le trouve alors au premier rendu. */
export const chargerLesDuels = () => lesDuels.charger()

/**
 * La préparation d'un défi entre amis, chargée à la demande : la série ne
 * l'ouvre jamais, et elle pesait sur chaque ouverture de la campagne. Elle
 * se télécharge en fond une fois la page montrée : touchée, elle est là.
 */
const lancement = aLaDemande(() => import('./LancerUnDefi'))

/**
 * Ce que la préparation propose — les catégories et les sujets que la
 * campagne peut poser, les mêmes pour tous, lus sans toucher à la base
 * (`GET /api/campagne/choix`) —, demandé une fois par page, en fond avec son
 * code : « Défier » touché, elle s'ouvre sans attendre le serveur. Elle
 * attendait tout l'état de la campagne — quatre lectures de son passé,
 * 800 ms en production — pour n'en lire que cela (le retour du propriétaire
 * du 13 octobre 2026 : « l'attente est perceptible »). Raté, il se redemande
 * à l'ouverture suivante.
 */
let choixEnRoute: Promise<ChoixDeLaCampagne> | null = null
function lesChoix(): Promise<ChoixDeLaCampagne> {
  choixEnRoute ??= api.campagne.choix().catch(e => {
    choixEnRoute = null
    throw e
  })
  return choixEnRoute
}

/**
 * Les catégories de sa dernière série, retenues sur ce téléphone : la page
 * s'ouvre sur elles. Le choix repartait sur « toutes » à chaque passage par
 * l'accueil, et changer de catégorie entre deux séries coûtait cinq ou six
 * touchers (un retour de joueur du 10 octobre 2026). Sous try/catch : des
 * cookies bloqués donnaient une page noire.
 */
const CLE_CATEGORIES = 'quizz.campagne.categories'
export function categoriesRetenues(): string[] {
  try {
    const lu: unknown = JSON.parse(localStorage.getItem(CLE_CATEGORIES) ?? '[]')
    return Array.isArray(lu) ? lu.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}
function retenirCategories(categories: readonly string[]) {
  try {
    if (categories.length > 0) localStorage.setItem(CLE_CATEGORIES, JSON.stringify(categories))
    else localStorage.removeItem(CLE_CATEGORIES)
  } catch {
    // Sans stockage, la page repart sur « toutes » : rien de plus grave.
  }
}

// Les noms d'un choix vivent à part : la page d'un défi entre amis les dit aussi.
export { nomDesCategories, nomDuChoix }

/**
 * Le sujet de sa dernière série (`shared/sujets.ts`), retenu sur ce
 * téléphone comme ses catégories — un sujet que ce téléphone ne connaît
 * plus n'y revient pas. Sous try/catch, comme elles.
 */
const CLE_SUJET = 'quizz.campagne.sujet'
export function sujetRetenu(): string | null {
  try {
    return sujetParCle(localStorage.getItem(CLE_SUJET))?.cle ?? null
  } catch {
    return null
  }
}
function retenirSujet(sujet: string | null) {
  try {
    if (sujet) localStorage.setItem(CLE_SUJET, sujet)
    else localStorage.removeItem(CLE_SUJET)
  } catch {
    // Sans stockage, la page repart sur ses catégories : rien de plus grave.
  }
}

// Les sentiers par la règle même du préchargement (`donneesDuFragment`,
// `shared/depart.ts`) : ouverte sur eux, la page les demande toujours.
const modeDe = (hash: string): Mode =>
  DUELS
    ? estLeLancement(hash)
      ? 'defier'
      : codeDuLien(hash)
        ? 'duel'
        : 'duels'
    : hash === ADRESSE_DU_DEFI
      ? 'defi'
      : hash === ADRESSE_DU_CARNET
        ? 'carnet'
        : versLesSentiers(hash)
          ? 'sentiers'
          : 'serie'
/** Le code du défi entre amis qu'ouvre l'adresse (`#duel-K7M2QX`), ou null. */
const codeDuLien = (hash: string) => (hash.startsWith('#duel-') ? lireCodeDuDuel(hash) : null)

/**
 * La campagne solo (`/campagne`) : une série qui monte en difficulté, trois
 * vies, sans chronomètre. Ses questions viennent de sa base à elle
 * (`core/baseCampagne.ts`). Le serveur compte les vies et ne donne la bonne
 * réponse qu'après la sienne : la page ne fait que montrer.
 *
 * Après chaque réponse, la bonne et son anecdote, comme au quiz du jour, et
 * de quoi signaler une erreur. Une bonne réponse vaut un confetti, et
 * l'expérience d'une bonne réponse en soirée, sans plafond : chacun monte à
 * son rythme.
 *
 * À côté, le second onglet : les sentiers du savoir (`Sentiers.tsx`), à
 * leur adresse (`#sentiers`, `#sentier-foret`), où se gagnent les avatars
 * du savoir.
 */
export function CampagneApp() {
  const { toast } = useAppState()
  const [mode, setMode] = useState<Mode>(() => modeDe(window.location.hash))
  // Le défi entre amis qu'ouvre l'adresse : son lien, envoyé par un ami.
  const [codeDuDuel, setCodeDuDuel] = useState<string | null>(() => codeDuLien(window.location.hash))
  // Celui que l'adresse défie (`#defier-<id>`) : « Défier » sur sa carte y mène, d'où qu'elle s'ouvre.
  const [contreQui, setContreQui] = useState<string | null>(() => profilDuLancement(window.location.hash))
  const [ecran, setEcranBrut] = useState<Ecran>({ e: 'chargement' })
  const [categories, setCategoriesBrut] = useState<string[]>(categoriesRetenues)
  // Un sujet traverse les catégories : en choisir un les laisse de côté, sans
  // les oublier ; toucher une catégorie quitte le sujet.
  const [sujet, setSujetBrut] = useState<string | null>(sujetRetenu)
  const choisirSujet = (choisi: string | null) => {
    setSujetBrut(choisi)
    retenirSujet(choisi)
  }
  const setCategories = (choisies: string[]) => {
    setCategoriesBrut(choisies)
    retenirCategories(choisies)
    choisirSujet(null)
  }
  // La feuille du choix (`FeuilleDuChoix`), ouverte par « Changer » — et d'elle-même quand on vient de la fin d'une série pour en changer.
  const [choixOuvert, setChoixOuvert] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  // Son profil, lu en léger : l'Éclat d'un défi s'y montre avec sa finition.
  const [profil, setProfil] = useState<PublicProfile | null>(null)
  // Ce que son carnet a à revoir aujourd'hui, sur l'onglet : lu après la page, sans la retenir.
  const [aRevoir, setARevoir] = useState(0)
  // Ses amis et les défis qu'ils lui ont envoyés : lus après la page des duels, pour elle et pour la préparation d'un défi.
  const [mesAmis, setMesAmis] = useState<MesAmis | null>(null)
  // Ce que la campagne peut poser — ses catégories, ses sujets —, pour préparer un duel : demandé en fond avec la page des duels (`lesChoix`).
  const [choixPourLancer, setChoixPourLancer] = useState<ChoixDeLaCampagne | null>(null)
  // Le code de la page des duels, sur elle seulement.
  const laPageDesDuels = useALaDemande(lesDuels, DUELS)
  const relireMesAmis = () =>
    api.campagne.amis
      .lire()
      .then(setMesAmis)
      .catch(() => {})
  // Chaque écran commence en haut, comme une page qu'on ouvre.
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    window.scrollTo(0, 0)
  }

  const relire = async () => {
    // Les duels relisent leur page eux-mêmes (`PageDesDuels`).
    if (DUELS) return setEcran({ e: 'duels' })
    const etat = await api.campagne.etat()
    setEcran({ e: 'accueil', etat })
  }

  // Le retour du navigateur d'un sentier à la série, ou l'inverse.
  useEffect(() => {
    const suivre = () => {
      setMode(modeDe(window.location.hash))
      setCodeDuDuel(codeDuLien(window.location.hash))
      setContreQui(profilDuLancement(window.location.hash))
    }
    window.addEventListener('hashchange', suivre)
    window.addEventListener('popstate', suivre)
    return () => {
      window.removeEventListener('hashchange', suivre)
      window.removeEventListener('popstate', suivre)
    }
  }, [])
  /** Changer d'onglet n'empile rien : le retour du téléphone quitte la campagne, comme avant. Aux duels, on revient à leur page. */
  const choisirMode = (m: Mode) => {
    history.replaceState(
      history.state,
      '',
      DUELS
        ? `${PAGE_DES_DUELS}${window.location.search}`
        : m === 'sentiers'
          ? ADRESSE_DES_SENTIERS
          : m === 'defi'
            ? ADRESSE_DU_DEFI
            : m === 'carnet'
              ? ADRESSE_DU_CARNET
              : `${window.location.pathname}${window.location.search}`,
    )
    setMode(m)
    window.scrollTo(0, 0)
  }
  const onglets = (
    <Onglets
      onglets={[
        // Quatre au téléphone : sans leur article, chacun tient sur une ligne.
        { id: 'serie', nom: 'La série', court: 'Série', icone: 'list' },
        { id: 'sentiers', nom: 'Les sentiers', court: 'Sentiers', icone: 'target' },
        // Le défi de la semaine ; ceux des amis sont aux duels (`/duels`).
        { id: 'defi', nom: 'Le défi', court: 'Défi', icone: 'trophy' },
        // Le carnet, puis les parcours de thème (le choix du 12 octobre 2026) : on y apprend, on n'y perd rien.
        // Ce qui l'attend aujourd'hui se compte sur l'onglet : sinon, il faudrait l'ouvrir pour le savoir.
        {
          id: 'carnet',
          nom: 'Apprendre',
          icone: 'book',
          ...(aRevoir > 0 && { pastille: { n: aRevoir, label: `${aRevoir} à revoir aujourd’hui` } }),
        },
      ]}
      actif={mode}
      onChoisir={choisirMode}
      label="Le mode de la campagne"
      idOnglet={m => `mode-${m}`}
      idPanneau={() => 'mode-campagne'}
      className="onglets-campagne"
    />
  )

  useEffect(() => {
    document.title = DUELS ? 'Les duels · FiestApp' : 'La campagne · FiestApp'
    let vivant = true
    // L'état part avec le profil, pas après lui, et le profil se lit en
    // léger : comme au quiz du jour, son détail ne servait qu'au thème. Ouverte
    // sur les sentiers, leur état part avec eux : il attendait le premier.
    // Les duels lisent le leur dans leur page (`PageDesDuels`), préchargé.
    const etat = DUELS ? null : api.campagne.etat()
    etat?.catch(() => {})
    if (!DUELS && modeDe(window.location.hash) === 'sentiers') demanderLesSentiers()
    ;(async () => {
      const moi = await api.joueur.moiLeger()
      if (!vivant) return
      // Le thème de son profil habille sa page, comme le quiz du jour.
      void porterTheme(moi.profile?.theme)
      porterGerbe(moi.profile?.gerbe)
      if (!moi.profile) return setEcran({ e: 'anonyme' })
      setProfil(moi.profile)
      // Le point de départ des montées de niveau que la fin d'une série dira.
      retenirLeNiveau(moi.profile.niveau)
      if (!etat) {
        setEcran({ e: 'duels' })
        // La préparation d'un défi, en fond : « Lancer un défi » s'ouvre sans attendre.
        void lancement.charger().catch(() => {})
        // Et ce qu'elle propose, avec : « Défier » touché, elle n'attend plus le serveur (`lesChoix`).
        void lesChoix().then(c => vivant && setChoixPourLancer(c), () => {})
        // Ses amis et ce qu'ils lui ont envoyé : la page des duels les montre en tête.
        void relireMesAmis()
        return
      }
      const lu = await etat
      if (!vivant) return
      // Le défi ou le carnet se touchent avant l'état : une partie commencée
      // entre-temps garde son écran — et rien ne remonte la page qu'on lit.
      setEcranBrut(avant => (avant.e === 'chargement' ? { e: 'accueil', etat: lu } : avant))
      // Le compte du carnet vient après la page, pour l'onglet : qu'il se taise
      // ne retient rien. Ouverte sur le carnet, sa page le lit déjà (`onLu`) :
      // il partait deux fois.
      if (modeDe(window.location.hash) === 'carnet') return
      api.campagne.carnet
        .etat()
        .then(c => vivant && setARevoir(c.aRevoir))
        .catch(() => {})
    })().catch(e => vivant && setEcran({ e: 'erreur', motif: motifDe(e) }))
    return () => {
      vivant = false
    }
  }, [])

  /** Une série neuve : celles qu'on a choisies — ou ce sujet —, ou celles de la série qu'on rejoue. */
  const commencer = async (choisies: string[] = categories, choisi: string | null = sujet) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const s = await api.campagne.commencer(choisi ? [] : choisies, choisi)
      if (s.question)
        setEcran({
          e: 'jeu',
          serie: s.id,
          question: s.question,
          vies: s.vies,
          justes: s.justes,
          total: s.total,
          reponse: null,
          choix: null,
          xp: 0,
          categories: s.categories ?? [],
          sujet: s.sujet ?? null,
        })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * « Recommencer », alors qu'il reste des vies : la série finit là, comme
   * perdue — son record et ses hauts faits comptent ce qu'elle a joué —,
   * puis une neuve sur les mêmes catégories, ou sa fin, pour regarder.
   */
  const abandonner = async () => {
    if (ecran.e !== 'jeu' || ecran.defi || busy) return
    const de = ecran
    const s = de.justes > 1 ? 's' : ''
    const geste = await choixDialog({
      title: 'Arrêter cette série ?',
      message: `Elle s’arrête ici, avec ${de.justes} bonne${s} réponse${s} : ton record et tes hauts faits les comptent.`,
      confirmLabel: 'Recommencer une série',
      alternative: { label: 'Arrêter là' },
      cancelLabel: 'Continuer',
    })
    if (!geste) return
    setBusy(true)
    setErreur('')
    try {
      const fin = await api.campagne.abandonner(de.serie)
      if (geste.geste === 'confirmer') {
        // Ce qu'elle a fait tomber ne se perd pas : la collection le garde, et on le dit.
        const tombe = [...(fin.record ? [`Record battu : ${fin.justes}`] : []), ...(fin.recompenses ?? []).map(r => `${r.emoji} ${r.title}`)]
        if (tombe.length > 0) showToast({ kind: 'info', message: tombe.join(' · ') })
        return void (await commencer(de.categories, de.sujet))
      }
      setEcran({
        e: 'fin',
        serie: de.serie,
        categories: de.categories,
        sujet: de.sujet,
        abandonnee: true,
        justes: fin.justes,
        erreurs: VIES - de.vies,
        record: !!fin.record,
        recordAvant: fin.recordAvant,
        niveauAtteint: fin.niveauAtteint ?? null,
        correction: null,
        xp: de.xp,
        recompenses: fin.recompenses ?? [],
        legendaires: fin.legendaires ?? [],
      })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** Depuis la fin d'une série : l'accueil de la campagne, la feuille du choix ouverte par-dessus. */
  const changerDeCategorie = async () => {
    setChoixOuvert(true)
    try {
      await relire()
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  const repondre = async (choix: number) => {
    if (ecran.e !== 'jeu' || ecran.reponse || busy) return
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.campagne.repondre(ecran.serie, ecran.question.index, choix)
      // La révélation sur place : la question reste lisible au-dessus.
      setEcranBrut({
        ...ecran,
        reponse,
        choix,
        vies: reponse.vies,
        justes: reponse.justes,
        xp: ecran.xp + (reponse.xp ?? 0),
        ...(ecran.revision && { apprises: (ecran.apprises ?? 0) + (reponse.revision?.apprise ? 1 : 0) }),
        ...(ecran.rencontre && reponse.rencontre && { rencontre: { ...ecran.rencontre, sesJustes: reponse.rencontre.sesJustes } }),
      })
      // Le carnet relu à la fin d'une révision : l'onglet suit.
      if (reponse.carnet) setARevoir(reponse.carnet.aRevoir)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const suivante = () => {
    if (ecran.e !== 'jeu' || !ecran.reponse) return
    const r = ecran.reponse
    if (r.finie || !r.suivante) {
      return setEcran({
        e: 'fin',
        serie: ecran.serie,
        categories: ecran.categories,
        sujet: ecran.sujet,
        justes: r.justes,
        erreurs: VIES - r.vies,
        ...(ecran.revision && { revision: { total: ecran.total, apprises: ecran.apprises ?? 0, carnet: r.carnet ?? null } }),
        // Son score entier arrive avec la dernière réponse (`enTout`) : la carte du verdict le retourne.
        ...(ecran.rencontre &&
          r.rencontre?.issue && {
            rencontre: { adversaire: { ...ecran.rencontre.adversaire, justes: r.rencontre.enTout ?? r.rencontre.sesJustes }, issue: r.rencontre.issue },
          }),
        // Un duel contre quelqu'un, joué le second : sa fin se lit comme celle d'une rencontre — les deux scores, qui l'a gagné.
        ...(r.contre && {
          rencontre: { adversaire: r.contre, issue: issueDeRencontre(r.justes, r.contre.justes) },
          // Avec ce qu'il porte : la préparation de la revanche le montrait en emoji.
          ...(r.contre.profileId && {
            revanche: { profileId: r.contre.profileId, nom: r.contre.nom, avatar: r.contre.avatar, ...ceQuIlPorte(r.contre), ...(r.contre.bordure && { bordure: r.contre.bordure }) },
          }),
        }),
        ...(r.classe && { classe: true as const }),
        ...(ecran.contre && { enFace: ecran.contre }),
        ...(r.duel && { cote: r.duel }),
        record: !!r.record,
        recordAvant: r.recordAvant ?? null,
        niveauAtteint: r.niveauAtteint ?? null,
        correction: null,
        xp: ecran.xp,
        recompenses: r.recompenses ?? [],
        legendaires: r.legendaires ?? [],
        ...(ecran.defi && { defi: true as const }),
        ...(ecran.duel && { duel: ecran.duel }),
        ...(ecran.lance && { lance: true as const }),
        ...(r.partiA && { partiA: r.partiA }),
        ...(r.defi && { place: r.defi }),
        ...(r.eclat && { eclat: r.eclat }),
      })
    }
    setEcran({ ...ecran, question: r.suivante, reponse: null, choix: null })
  }

  /** Le défi relevé — ou repris — depuis son onglet : la même partie que la série, sous son nom. */
  const jouerLeDefi = (t: SerieDeCampagne) => {
    if (!t.question) return
    setEcran({ e: 'jeu', serie: t.id, question: t.question, vies: t.vies, justes: t.justes, total: t.total, reponse: null, choix: null, xp: 0, categories: [], sujet: null, defi: true })
  }

  /** Une révision du carnet, commencée ou reprise depuis son onglet : la partie de la série, sans vies — et ce qu'elle vise, que sa fin reprend. */
  const jouerLaRevision = (t: SerieDeCampagne) => {
    if (!t.question) return
    setEcran({
      e: 'jeu',
      serie: t.id,
      question: t.question,
      vies: t.vies,
      justes: t.justes,
      total: t.total,
      reponse: null,
      choix: null,
      xp: 0,
      categories: t.categories ?? [],
      sujet: t.sujet ?? null,
      revision: true,
      apprises: 0,
    })
  }

  /** Un duel classé — une rencontre —, trouvé ou repris depuis la page des duels : la partie de la série, contre le score d'un autre. */
  const jouerLaRencontre = ({ serie: t, adversaire, sesJustes, enjeu }: RencontreDeCampagne) => {
    if (!t.question) return
    setEcran({
      e: 'jeu',
      serie: t.id,
      question: t.question,
      vies: t.vies,
      justes: t.justes,
      total: t.total,
      reponse: null,
      choix: null,
      xp: 0,
      categories: t.categories ?? [],
      sujet: t.sujet ?? null,
      rencontre: { adversaire, sesJustes, ...(enjeu && { enjeu }) },
    })
  }

  /**
   * De la fin d'une rencontre à une autre : Automate encore, sur une série
   * neuve — la feuille du dé d'abord (`LeDe`), comme sur la page des duels :
   * ce qu'elle met en jeu, sur quoi — ce que jouait celle-ci —, et rien de
   * tiré avant « Jouer le duel ».
   */
  const [deOuvert, setDeOuvert] = useState(false)

  /**
   * De la fin d'une révision à une autre, tant qu'il reste à revoir — ou tout
   * le carnet, en avance (`tout`) ; sur ce qu'elle visait, tant qu'il y reste
   * à revoir (`visee`).
   */
  const reviserEncore = async (tout = false, visee?: ViseeDuCarnet) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      jouerLaRevision(await api.campagne.carnet.reviser({ tout, ...(visee && corpsDeLaVisee(visee)) }))
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Repartir d'une révision neuve, comme on recommence une série : celle-ci
   * se referme là, et ce qu'elle a déjà répondu reste au carnet — il se relit
   * dans le journal des réponses.
   */
  const recommencerLaRevision = async () => {
    if (ecran.e !== 'jeu' || !ecran.revision || busy) return
    const oui = await confirmDialog({
      title: 'Recommencer la révision ?',
      message: 'Celle-ci s’arrête ici : ce que tu as déjà répondu reste dans ton carnet.',
      confirmLabel: 'Recommencer',
      cancelLabel: 'Continuer',
    })
    if (!oui) return
    setBusy(true)
    setErreur('')
    try {
      jouerLaRevision(await api.campagne.carnet.reviser({ recommencer: true }))
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** Le carnet, depuis la fin d'une série ou d'une révision : son onglet, relu — depuis les duels, la campagne qui le tient. */
  const ouvrirLeCarnet = async () => {
    if (DUELS) return window.location.assign(`/campagne${ADRESSE_DU_CARNET}`)
    choisirMode('carnet')
    try {
      await relire()
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  /**
   * Un défi entre amis, lancé ou relevé : la même partie, une seule tentative,
   * son code au bout pour l'envoyer. Un duel contre quelqu'un (`contre`) : la
   * partie dit à chaque question qui l'on affronte et ce qui se joue.
   */
  const jouerLeDuel = (t: SerieDeCampagne, code: string, lance = false, contre?: ContreEnJeu) => {
    if (!t.question) return
    setEcran({
      e: 'jeu',
      serie: t.id,
      question: t.question,
      vies: t.vies,
      justes: t.justes,
      total: t.total,
      reponse: null,
      choix: null,
      xp: 0,
      categories: t.categories ?? [],
      sujet: t.sujet ?? null,
      defi: true,
      duel: code,
      ...(lance && { lance: true as const }),
      ...(contre && { contre }),
    })
    // Relevé, un défi reçu quitte la liste — et le compte de l'onglet.
    if (mesAmis?.recus.some(d => d.code === code)) void relireMesAmis()
  }

  /**
   * Préparer un duel (`/duels#defier`) : contre qui, sur quoi — les
   * catégories ou le sujet de sa dernière série d'abord, le joueur touché
   * (« Défier » sur sa carte) déjà choisi. Une entrée d'historique : le
   * retour du téléphone, comme « ← Les duels », ramène d'où l'on vient. Ce
   * que la campagne peut poser part en fond avec la page des duels
   * (`lesChoix`) ; ouverte à son adresse, la préparation le demande en
   * arrivant. Contre quelqu'un, son adresse le nomme (`#defier-<id>`) : la
   * carte d'un joueur y mène de l'accueil, du quiz du jour ou d'un défi, et
   * la préparation le relit en arrivant, sa propre cote avec.
   */
  // Sa cote avec son plancher — la ligue qu'il garde : sans lui, la préparation annonçait une perte qu'il empêche. Et le duel
  // déjà ouvert contre celui qu'elle défie, lu avec (null : aucun).
  const [depart, setDepart] = useState<{
    categories: string[]
    sujet: string | null
    adversaire?: JoueurADefier
    moi?: { cote: number; joues: number; plancher?: number }
    enCours?: DuelOuvert | null
  }>({
    categories: [],
    sujet: null,
  })
  const laPreparation = useALaDemande(lancement, mode === 'defier')
  useEffect(() => {
    if (mode !== 'defier' || choixPourLancer || ecran.e !== 'duels') return
    let vivant = true
    lesChoix()
      .then(c => vivant && setChoixPourLancer(c))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [mode, choixPourLancer, ecran.e])
  // Les joueurs qu'il a croisés, pour « Contre qui ? » : lus à l'arrivée, en même temps, et relus quand sa liste d'amis change.
  // Sans eux — un échec —, la préparation garde la recherche et ses amis.
  const [croises, setCroises] = useState<JoueurCroise[] | null>(null)
  const [croisesLus, setCroisesLus] = useState(0)
  useEffect(() => {
    if (mode !== 'defier' || ecran.e !== 'duels') return
    let vivant = true
    api.duels
      .croises()
      .then(c => vivant && setCroises(c))
      .catch(() => vivant && setCroises([]))
    return () => {
      vivant = false
    }
  }, [mode, ecran.e, croisesLus])
  // Sa propre cote manque aussi à la revanche, qui ne porte que le prénom d'en face : relus ensemble, sans quoi ce qui se
  // joue ne se disait pas — ou se disait contre une cote de 1000.
  const adversaireAttendu = mode === 'defier' && !!contreQui && (depart.adversaire?.profileId !== contreQui || !depart.moi)
  useEffect(() => {
    if (!adversaireAttendu || !contreQui || ecran.e !== 'duels') return
    let vivant = true
    api.duels
      .joueur(contreQui)
      .then(f => vivant && setDepart({ categories, sujet, adversaire: f.joueur, moi: f.moi, enCours: f.enCours ?? null }))
      .catch(e => {
        if (!vivant) return
        // Introuvable — masqué, supprimé, ou soi-même : la préparation s'ouvre libre, et le dit.
        setErreur(motifDe(e))
        setContreQui(null)
      })
    return () => {
      vivant = false
    }
    // Ses catégories et son sujet du moment : lus à l'arrivée, ils ne relancent rien.
  }, [adversaireAttendu, contreQui, ecran.e])
  const ouvrirLeLancement = (adversaire?: JoueurADefier, moi?: { cote: number; joues: number; plancher?: number }) => {
    setDepart({ categories, sujet, ...(adversaire && { adversaire }), ...(moi && { moi }) })
    setContreQui(adversaire?.profileId ?? null)
    history.pushState(
      { ...history.state, [LANCEMENT]: true },
      '',
      `${PAGE_DES_DUELS}${window.location.search}${adversaire ? adresseDuLancementContre(adversaire.profileId) : ADRESSE_DU_LANCEMENT}`,
    )
    setErreur('')
    setMode('defier')
    window.scrollTo(0, 0)
  }
  const quitterLeLancement = () => {
    if (history.state?.[LANCEMENT]) return history.back()
    choisirMode('duels')
  }

  /**
   * Un duel lancé : son tirage sur ce qu'on a choisi — catégories ou sujet —,
   * contre qui, et sa propre tentative d'abord ; à sa dernière réponse, il
   * part à l'autre (`envoyerLesPrevus`), sans lien à envoyer.
   */
  const lancerUnDuel = async (choisies: string[], choisi: string | null, adversaire: JoueurADefier, enjeu?: EnjeuDuDuel) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const lance = await api.campagne.duel.lancer(choisi ? [] : choisies, choisi, [], adversaire.profileId)
      const { code, serie } = lance
      // L'enjeu du serveur, sur les cotes figées au lancement ; sinon celui que la préparation a dit.
      const enJeu = lance.enjeu ?? enjeu
      // Lancé, il ne se prépare plus : l'entrée de la préparation devient la page des duels — le
      // retour du téléphone, après son classement, ne rouvre pas un défi déjà parti.
      if (estLeLancement(window.location.hash)) {
        history.replaceState({ ...history.state, [LANCEMENT]: undefined }, '', `${PAGE_DES_DUELS}${window.location.search}`)
        setMode('duels')
        setContreQui(null)
      }
      // Sa ligue et la sienne — s'ils ont fini un duel classé — : les deux anneaux de « Duel envoyé ».
      const moi = depart.moi && depart.moi.joues > 0 ? { maLigue: ligueDe(depart.moi.cote).cle } : null
      // Et ce qu'il porte : son légendaire pendant la partie et sur « Duel envoyé », comme sur sa carte.
      const apparence = ceQuIlPorte(adversaire)
      jouerLeDuel(serie, code, true, {
        nom: adversaire.nom,
        avatar: adversaire.avatar,
        ...(apparence && { apparence }),
        ...(adversaire.ligue && { ligue: adversaire.ligue }),
        ...moi,
        ...(enJeu && { enjeu: enJeu }),
      })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** La page d'un défi entre amis, à son adresse : le retour du navigateur, comme « ← Les duels », ramène d'où l'on vient. */
  const ouvrirLeDuel = async (code: string) => {
    history.pushState({ ...history.state, [DUEL_OUVERT]: true }, '', `${PAGE_DES_DUELS}${window.location.search}${adresseDuDuel(code)}`)
    setCodeDuDuel(code)
    setMode('duel')
    try {
      await relire()
    } catch (e) {
      setErreur(motifDe(e))
    }
  }
  const quitterLeDuel = () => {
    if (history.state?.[DUEL_OUVERT]) return history.back()
    choisirMode('duels')
  }

  /**
   * « Signaler une erreur » : après sa réponse, comme au quiz du jour. Une
   * phrase, que l'administrateur relit (`/admin#campagne`) ; il peut retirer
   * la question pour tous.
   */
  const signaler = async (serie: string, index: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(serie, index, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  const toastVu = toast && (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      {espacesFines(toast.message)}
    </div>
  )

  // La page des duels : leur code arrive avec celui-ci (`main.tsx`) — en chemin, sa place, sans rien décaler.
  if (DUELS && (ecran.e === 'chargement' || ecran.e === 'duels') && (!laPageDesDuels || laPageDesDuels === 'perdu' || ecran.e === 'chargement')) {
    return laPageDesDuels && laPageDesDuels !== 'perdu' ? <laPageDesDuels.DuelsEnChemin /> : <DuelsSansLeurCode perdu={laPageDesDuels === 'perdu'} />
  }
  // Ouverte sur les sentiers, la page n'attend pas la série pour s'esquisser.
  if (ecran.e === 'chargement' && mode === 'sentiers') return <SentiersEnChemin onglets={onglets} />
  // Sur le défi ou le carnet, non plus : leur page s'esquisse d'elle-même,
  // ses chiffres en attente, et demande les siens tout de suite. L'attente de
  // la série — « Jusqu'où iras-tu ? » et son gros bouton — passait 60 à 90 ms
  // avant le bon onglet (l'experte du jeu solo, le 11 octobre 2026).
  const surSonOnglet = ecran.e === 'accueil' || ecran.e === 'chargement'
  if (surSonOnglet && mode === 'defi') {
    return (
      <>
        <PageDuDefi onglets={onglets} onJouer={jouerLeDefi} />
        {toastVu}
      </>
    )
  }

  if (surSonOnglet && mode === 'carnet') {
    return (
      <>
        <PageDuCarnet onglets={onglets} onReviser={jouerLaRevision} onLu={c => setARevoir(c.aRevoir)} />
        {toastVu}
      </>
    )
  }
  if (ecran.e === 'chargement') return <CampagneEnChemin />
  if (ecran.e !== 'anonyme' && ecran.e !== 'erreur' && mode === 'sentiers') {
    return (
      <>
        <Sentiers onglets={onglets} onSerie={() => choisirMode('serie')} />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'duels' && laPageDesDuels && laPageDesDuels !== 'perdu') {
    if (mode === 'defier') {
      // Pas encore arrivée (un réseau lent, ouverte à son adresse — celui qu'elle défie compris) : sa place, ou ce qui l'empêche.
      if (!laPreparation || laPreparation === 'perdu' || !choixPourLancer || adversaireAttendu) {
        return (
          <div className="player-shell campagne">
            <Sortie vers="Les duels" href={PAGE_DES_DUELS} onClick={quitterLeLancement} />
            {laPreparation === 'perdu' || (erreur && !choixPourLancer) ? (
              <p className="error">{erreur || 'Cette page n’a pas pu se charger : vérifie ta connexion, puis recharge-la.'}</p>
            ) : (
              <p className="serif-note">Chargement…</p>
            )}
          </div>
        )
      }
      // Les sujets que la base sert : un sujet retenu qui n'en est plus un ne se propose pas.
      const sujets = SUJETS.filter(x => choixPourLancer.sujets.some(y => y.sujet === x.cle))
      return (
        <>
          <laPreparation.LancerUnDefi
            // Celui qu'on défie change — une autre carte, l'adresse relue : la préparation repart de lui.
            key={depart.adversaire?.profileId ?? 'libre'}
            amis={mesAmis?.amis ?? null}
            croises={croises}
            categoriesJouables={choixPourLancer.categories.map(c => c.categorie)}
            sujets={sujets}
            depart={{ ...depart, sujet: sujets.some(x => x.cle === depart.sujet) ? depart.sujet : null }}
            busy={busy}
            erreur={erreur}
            onLancer={(c, x, a, enjeu) => void lancerUnDuel(c, x, a, enjeu)}
            onOuvrirDuel={code => void ouvrirLeDuel(code)}
            onAmis={() => {
              void relireMesAmis()
              setCroisesLus(n => n + 1)
            }}
            onRetour={quitterLeLancement}
          />
          {toastVu}
        </>
      )
    }
    if (mode === 'duel' && codeDuDuel) {
      return (
        <>
          <laPageDesDuels.PageDuDuel key={codeDuDuel} code={codeDuDuel} onRetour={quitterLeDuel} onJouer={jouerLeDuel} onRevanche={j => ouvrirLeLancement(j)} />
          {toastVu}
        </>
      )
    }
    return (
      <>
        <laPageDesDuels.PageDesDuels
          amis={mesAmis}
          choix={choixPourLancer}
          onJouer={jouerLaRencontre}
          onDefier={ouvrirLeLancement}
          onOuvrirDuel={code => void ouvrirLeDuel(code)}
          onAmis={() => void relireMesAmis()}
        />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'anonyme' || ecran.e === 'erreur') {
    // Le lien d'un défi entre amis survit à la connexion : on revient sur lui (`pageDeRetour` garde le fragment).
    const retour = encodeURIComponent(DUELS ? `${PAGE_DES_DUELS}${codeDuDuel ? adresseDuDuel(codeDuDuel) : ''}` : '/campagne')
    return (
      <div className="player-shell">
        <Sortie />
        <PieceTete piece="Seul" titre={DUELS ? 'Les duels' : 'La campagne'} />
        {ecran.e === 'anonyme' ? (
          <>
            <p>
              {DUELS
                ? codeDuDuel
                  ? 'Un ami te défie : connecte-toi à ton profil pour relever son défi, ou crée-le.'
                  : 'Les duels se jouent avec ton profil : ta cote, ta ligue et tes confettis y restent.'
                : 'La campagne se joue avec ton profil : tes records et tes confettis y restent.'}
            </p>
            <a className="btn btn-primary btn-big btn-block" href={`/?next=${retour}`}>
              Me connecter
            </a>
            <a className="btn btn-block" href={`/?creer=1&next=${retour}`}>
              Créer mon profil
            </a>
          </>
        ) : (
          <p className="error">{ecran.motif}</p>
        )}
      </div>
    )
  }

  if (ecran.e === 'accueil') {
    const { etat } = ecran
    const pret = etat.questions >= QUESTIONS_POUR_JOUER
    // Les bonnes réponses du jour qui paient encore double (`JUSTES_DOUBLEES_PAR_JOUR`).
    const doubles = Math.max(0, JUSTES_DOUBLEES_PAR_JOUR - (etat.justesAujourdhui ?? 0))
    // Les sujets que la base sert ; un sujet retenu qui n'en est plus un — un serveur d'avant, une base qui a changé — ne se joue pas.
    const sujets = SUJETS.filter(s => etat.sujets?.some(x => x.sujet === s.cle))
    const sujetJouable = sujets.some(s => s.cle === sujet) ? sujet : null
    // Un choix à faire : plusieurs catégories, ou des sujets. Sinon, ni ligne ni feuille.
    const aChoisir = etat.categories.length > 1 || sujets.length > 0
    return (
      <div className="player-shell campagne">
        <Sortie />
        {onglets}
        <Heros etat={etat} />
        {/* Ce que la journée a déjà rapporté, et ce qui paie encore double : sans plafond, il n'y a plus de « plein » à annoncer. */}
        {etat.xpAujourdhui > 0 && (
          <p className="muted small campagne-xp-du-jour">
            Aujourd’hui : +{etat.xpAujourdhui} XP
            {doubles > 0 && ` · encore ${doubles} bonne${doubles > 1 ? 's' : ''} réponse${doubles > 1 ? 's' : ''} au double`}
          </p>
        )}
        {pret ? (
          <>
            {erreur && (
              <p className="error" role="alert">
                {erreur}
              </p>
            )}
            {etat.enCours?.question && (
              <button
                type="button"
                className="btn btn-block"
                onClick={() =>
                  setEcran({
                    e: 'jeu',
                    serie: etat.enCours!.id,
                    question: etat.enCours!.question!,
                    vies: etat.enCours!.vies,
                    justes: etat.enCours!.justes,
                    total: etat.enCours!.total,
                    reponse: null,
                    choix: null,
                    xp: 0,
                    categories: etat.enCours!.categories ?? [],
                    sujet: etat.enCours!.sujet ?? null,
                  })
                }
              >
                {/* « · 0 bonne » se lisait mal : laissée avant sa première bonne réponse, elle se reprend, simplement. */}
                {etat.enCours.justes > 0 ? `Reprendre ma série · ${etat.enCours.justes} bonne${etat.enCours.justes > 1 ? 's' : ''}` : 'Reprendre ma série'}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void commencer(categories, sujetJouable)}>
              <Icon name="play" />
              {etat.enCours ? 'Une nouvelle série' : 'Commencer une série'}
            </button>
            {/* Sur quoi, en une ligne sous le gros bouton : la grille dépliée ici, douze catégories et vingt-cinq sujets, faisait trois écrans. */}
            {aChoisir && <LigneDuChoix categories={categories} sujet={sujetJouable} sur onChanger={() => setChoixOuvert(true)} />}
          </>
        ) : (
          <p className="muted">La campagne n’a pas encore de questions à poser : reviens bientôt — ou joue le quiz du jour.</p>
        )}
        {etat.records && etat.categories.length > 1 && <RecordsParCategorie records={etat.records} categories={etat.categories.map(c => c.categorie)} />}
        {pret && aChoisir && choixOuvert && (
          <FeuilleDuChoix
            categoriesJouables={etat.categories.map(c => c.categorie)}
            sujets={sujets}
            categories={categories}
            sujet={sujetJouable}
            onChoisir={(c, s) => {
              // Ses catégories retenues, même sous un sujet : le quitter les rend.
              setCategories(c)
              if (s) choisirSujet(s)
            }}
            onFermer={() => setChoixOuvert(false)}
          />
        )}
      </div>
    )
  }

  if (ecran.e === 'fin' && ecran.revision) {
    const { total, apprises, carnet } = ecran.revision
    const ratees = total - ecran.justes
    const s = ecran.justes > 1 ? 's' : ''
    // Elle visait une catégorie ou un sujet : « Réviser encore » y reste, tant qu'il y a à revoir.
    const visee: ViseeDuCarnet = { categories: ecran.categories, sujet: ecran.sujet }
    const nomDeLaVisee = nomDuChoix(visee.categories, visee.sujet)
    const encore = carnet && nomDeLaVisee ? partVisee(carnet, visee).aRevoir : 0
    const questions = (n: number) => `${n} question${n > 1 ? 's' : ''}`
    return (
      <div className="player-shell campagne">
        <header className="fin-tete">
          <span className="label">{nomDeLaVisee ? `Le carnet de révision · ${nomDeLaVisee}` : 'Le carnet de révision'}</span>
          <h1>Révision terminée</h1>
        </header>
        <section className="card result-banner result-ok campagne-fin">
          <span className="big">{ecran.justes}</span>
          <p>{`retrouvée${s} sur ${total}`}</p>
          {apprises > 0 && (
            <p className="campagne-record-battu">
              <Icon name="check-circle" /> {apprises > 1 ? `${apprises} choses apprises` : 'Une chose apprise'}
            </p>
          )}
          {ratees > 0 && <p className="muted small">{ratees > 1 ? `Les ${ratees} autres reviennent demain : c’est comme ça qu’on apprend.` : 'L’autre revient demain : c’est comme ça qu’on apprend.'}</p>}
        </section>
        <GainsDeCampagne fin={ecran} profil={profil} />
        {erreur && <p className="error">{erreur}</p>}
        {carnet && encore > 0 ? (
          <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void reviserEncore(false, visee)}>
            <Icon name="rotate" />
            {`Réviser encore · ${questions(Math.min(encore, QUESTIONS_PAR_REVISION))}`}
          </button>
        ) : carnet && carnet.aRevoir > 0 ? (
          <>
            {/* Ce qu'elle visait est revu : la suite reprend tout le carnet, et le dit. */}
            {nomDeLaVisee && <p className="muted small centre">{espacesFines(`${nomDeLaVisee} : rien de plus à revoir aujourd’hui.`)}</p>}
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void reviserEncore()}>
              <Icon name="rotate" />
              {/* Dix au plus, quoi qu'elle ait posé : une révision visée n'en posait parfois que trois. */}
              {`Réviser encore · ${questions(Math.min(carnet.aRevoir, QUESTIONS_PAR_REVISION))}`}
            </button>
          </>
        ) : (
          carnet && (
            <>
              <p className="muted centre carnet-prochaine">{prochaineFois(carnet)}</p>
              {tailleDuCarnet(carnet) > 0 && (
                <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={() => void reviserEncore(true)}>
                  <Icon name="book" />
                  Revoir tout mon carnet
                </button>
              )}
            </>
          )
        )}
        <div className="row campagne-suite">
          <button type="button" className="btn btn-ghost" onClick={() => void ouvrirLeCarnet()}>
            <Icon name="book" />
            Mon carnet
          </button>
          <a className="btn btn-ghost" href="/">
            <Icon name="home" />
            Accueil
          </a>
        </div>
      </div>
    )
  }

  // Ce qu'une fin de duel fait tomber avec elle — trophées, légendaires, un niveau — : sous sa carte ou son cadran.
  const tombeAvecLeDuel = (f: Extract<Ecran, { e: 'fin' }>) => <GainsDeCampagne fin={f} profil={profil} duel />

  // Ce qu'il porte, sur l'avatar d'une fin de duel : son légendaire, pas l'emoji d'en dessous.
  const monApparence =
    profil &&
    ceQuIlPorte({
      finition: profil.finition,
      ...(profil.legendaire && { legendaire: profil.legendaire }),
      ...(brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar)) && { eclat: true as const }),
    })
  // La page des duels, d'où il est parti : sans la recharger.
  const versMesDuels = () => {
    choisirMode('duels')
    void relire().catch(() => {})
  }

  // Un duel joué jusqu'au verdict — au hasard, ou contre quelqu'un qui l'avait joué d'abord : la carte qui se retourne (la maquette C5).
  if (ecran.e === 'fin' && ecran.rencontre && laPageDesDuels && laPageDesDuels !== 'perdu') {
    const { adversaire } = ecran.rencontre
    const fin = ecran
    const voirCorrection = async () => {
      try {
        setEcranBrut({ ...fin, correction: await api.campagne.correction(fin.serie) })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    return (
      <>
        <laPageDesDuels.VerdictDuDuel
          verdict={{
            quoi: nomDuChoix(ecran.categories, ecran.sujet) ?? 'Toutes les catégories',
            toi: { avatar: profil?.avatar ?? '🙂', justes: ecran.justes, apparence: monApparence || undefined },
            lui: { nom: adversaire.nom, avatar: adversaire.avatar, justes: adversaire.justes, apparence: ceQuIlPorte(adversaire), ...(ecran.enFace?.ligue && { ligue: ecran.enFace.ligue }) },
            ...(ecran.cote && {
              ecart: ecran.cote.ecart,
              apres: { cote: ecran.cote.apres, ligue: ecran.cote.ligue, ...(ecran.cote.rang !== undefined && { rang: ecran.cote.rang }) },
              semaine: ecran.cote.semaine,
            }),
          }}
          // Sa carte se retourne à sa dernière réponse : son score, caché jusque-là.
          dos={`Le score ${deNom(adversaire.nom)}`}
          aRetourner
          suite={
            ecran.duel
              ? // Joué des deux côtés : on en relance un contre le même, d'un toucher — lui déjà choisi.
                ecran.revanche && {
                  texte: 'Revanche',
                  icone: 'rotate',
                  onClick: () => {
                    ouvrirLeLancement(fin.revanche)
                    void relire()
                  },
                }
              : // Le dé, encore : Automate. « Un autre » adversaire promettait quelqu'un ; « Rejouer contre Automate » touchait le bord du bouton en 360.
                { texte: 'Un autre duel', icone: 'dice', onClick: () => setDeOuvert(true) }
          }
          busy={busy}
          onReponses={ecran.correction ? undefined : () => void voirCorrection()}
          onFermer={versMesDuels}
          erreur={erreur}
          extra={tombeAvecLeDuel(ecran)}
          apres={ecran.correction && <SerieCorrigee correction={ecran.correction} />}
        />
        {/* « Un autre duel » : ce qu'il mettrait en jeu, sur sa cote d'après celui-ci, et sur quoi. Fermée, rien n'est tiré. */}
        {deOuvert && (
          <laPageDesDuels.LeDe
            cote={ecran.cote?.apres ?? null}
            choix={choixPourLancer}
            depart={{ categories: ecran.categories, sujet: ecran.sujet }}
            onJouer={r => {
              setDeOuvert(false)
              jouerLaRencontre(r)
            }}
            onFermer={() => setDeOuvert(false)}
          />
        )}
      </>
    )
  }

  // Un duel classé qu'il vient de jouer le premier : parti à l'autre, son score caché (la maquette A3).
  if (ecran.e === 'fin' && ecran.classe && laPageDesDuels && laPageDesDuels !== 'perdu') {
    const enFace = ecran.enFace ?? { nom: ecran.partiA?.[0] ?? 'l’autre', avatar: '🎲' }
    return (
      <laPageDesDuels.DuelEnvoye
        quoi={nomDuChoix(ecran.categories, ecran.sujet) ?? 'Toutes les catégories'}
        justes={ecran.justes}
        toi={{ avatar: profil?.avatar ?? '🙂', apparence: monApparence || undefined, ...(ecran.enFace?.maLigue && { ligue: ecran.enFace.maLigue }) }}
        lui={{ nom: enFace.nom, avatar: enFace.avatar, apparence: ecran.enFace?.apparence, ...('ligue' in enFace && enFace.ligue && { ligue: enFace.ligue }) }}
        confettis={ecran.justes}
        xp={ecran.xp}
        extra={tombeAvecLeDuel(ecran)}
        onMesDuels={versMesDuels}
      />
    )
  }

  if (ecran.e === 'fin') {
    const voirCorrection = async () => {
      try {
        const correction = await api.campagne.correction(ecran.serie)
        setEcranBrut({ ...ecran, correction })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    const s = ecran.justes > 1 ? 's' : ''
    const jouees = nomDuChoix(ecran.categories, ecran.sujet)
    return (
      <div className="player-shell campagne">
        <header className="fin-tete">
          <span className="label">
            {ecran.duel
              ? `${ecran.classe ? 'Duel classé' : 'Défi entre amis'}${jouees ? ` · ${jouees}` : ''}`
              : ecran.defi
                ? 'Le défi de la semaine'
                : `La campagne${jouees ? ` · ${jouees}` : ''}`}
          </span>
          <h1>{ecran.lance ? (ecran.classe ? 'Duel lancé' : 'Défi lancé') : ecran.defi ? 'Défi relevé' : ecran.abandonnee ? 'Série arrêtée' : 'Série terminée'}</h1>
        </header>
        <section className="card result-banner result-ok campagne-fin">
          <span className="big">{ecran.justes}</span>
          <p>
            bonne{s} réponse{s}
            {ecran.niveauAtteint && `, jusqu’au niveau ${NOM_NIVEAU[ecran.niveauAtteint].toLowerCase()}`}
          </p>
          {/* Au défi, sa place pour l'instant — la bonne nouvelle seulement (`placeDuJour`). */}
          {ecran.place && placeDuJour(ecran.place.rang, ecran.place.joueurs, ecran.justes) && (
            <p className="campagne-record-battu">{`${placeDuJour(ecran.place.rang, ecran.place.joueurs, ecran.justes)}, pour l’instant`}</p>
          )}
          {/* Le record d'avant la série : battu, on le dit fièrement ; sinon, ce qu'il reste à battre. */}
          {ecran.record ? (
            <p className="campagne-record-battu">
              <span aria-hidden="true">🏆</span> Record battu : {ecran.justes}
              <span className="muted small">{ecran.recordAvant ? ` · l’ancien était de ${ecran.recordAvant}` : ' · ta première série'}</span>
            </p>
          ) : (
            !!ecran.recordAvant && <p className="muted small">Ton record : {ecran.recordAvant}</p>
          )}
        </section>
        {/* Ses erreurs ne sont pas perdues : le carnet les repose demain. Pas celles d'un défi, qui attendent sa clôture. */}
        {!ecran.defi && ecran.erreurs > 0 && (
          <p className="muted small centre carnet-rappel">
            <Icon name="book" /> {ecran.erreurs > 1 ? 'Tes erreurs reviendront' : 'Ton erreur reviendra'} demain dans{' '}
            <button type="button" className="link-inline" onClick={() => void ouvrirLeCarnet()}>
              ton carnet de révision
            </button>
            .
          </p>
        )}
        <GainsDeCampagne fin={ecran} profil={profil} />
        {erreur && <p className="error">{erreur}</p>}
        {ecran.duel ? (
          // L'envoyer d'abord : celui qui vient de le lancer n'a encore défié personne.
          laPageDesDuels &&
          laPageDesDuels !== 'perdu' && (
            <laPageDesDuels.FinDuDuel code={ecran.duel} justes={ecran.justes} partiA={ecran.partiA} onClassement={() => void ouvrirLeDuel(ecran.duel!)} />
          )
        ) : ecran.defi ? (
          <>
            {/* Une seule tentative : ni « Rejouer », ni la correction, qui attend la clôture. */}
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => void relire()}>
              <Icon name="trophy" />
              Le classement du défi
            </button>
            <p className="muted small centre">La correction s’ouvre lundi, à la clôture : elle soufflerait les réponses à ceux qui jouent encore.</p>
            <a className="btn btn-block" href="/">
              <Icon name="home" />
              Retour à l’accueil
            </a>
          </>
        ) : (
          <SuiteDeLaSerie
            categories={ecran.categories}
            sujet={ecran.sujet}
            correctionOuverte={!!ecran.correction}
            busy={busy}
            onRejouer={() => void commencer(ecran.categories, ecran.sujet)}
            onChanger={() => void changerDeCategorie()}
            onCorrection={() => void voirCorrection()}
          />
        )}
        {ecran.correction && <SerieCorrigee correction={ecran.correction} />}
      </div>
    )
  }

  // La page des duels sans son code : la première garde l'a déjà rendue — ceci le dit au typage.
  if (ecran.e === 'duels') return <DuelsSansLeurCode perdu={laPageDesDuels === 'perdu'} />

  // ── Une question de la série ──
  const { question: q, reponse: r } = ecran
  // Partir ne perd rien : la partie attend dans l'onglet d'où elle se reprend — ou dans la page des duels.
  const ouAttend: Mode = DUELS ? 'duels' : ecran.revision ? 'carnet' : ecran.defi ? 'defi' : 'serie'
  const partir = () => {
    choisirMode(ouAttend)
    void relire().catch(() => {})
    showToast({
      kind: 'info',
      message: ecran.revision
        ? 'Ta révision t’attend : reprends-la quand tu veux'
        : ecran.rencontre
          ? 'Ton duel t’attend : reprends-le quand tu veux'
          : ecran.contre
            ? 'Ton duel t’attend : reprends-le avant sa fermeture'
            : ecran.duel
              ? 'Ton défi t’attend : reprends-le avant sa fermeture'
              : ecran.defi
                ? 'Ton défi t’attend : reprends-le avant sa clôture'
                : 'Ta série t’attend : reprends-la quand tu veux',
    })
  }
  // Un duel au hasard ou contre quelqu'un : ce qu'il met en jeu sur sa cote.
  const enjeu = ecran.rencontre?.enjeu ?? ecran.contre?.enjeu
  return (
    <div className="player-shell campagne">
      <div className="quiz-player">
        {/* Sa dernière réponse donnée, la partie est finie : sa fin d'abord, ce qu'elle a rapporté. */}
        {!r?.finie && (
          <Sortie vers="Partir" href={DUELS ? PAGE_DES_DUELS : `/campagne${ouAttend === 'carnet' ? ADRESSE_DU_CARNET : ouAttend === 'defi' ? ADRESSE_DU_DEFI : ''}`} onClick={partir} />
        )}
        <TeteDeLaQuestion ecran={ecran} />
        {/* Le face-à-face : les deux scores sur les mêmes questions, au fil des réponses — son score entier se dévoile à la
            dernière (le souhait du propriétaire du 12 octobre 2026 : « à battre : 8 » se lisait avant la première question). */}
        {ecran.rencontre && (
          <p className="rencontre-score" aria-live="polite">
            <span className="rencontre-adversaire" aria-hidden="true">
              <Visage avatar={ecran.rencontre.adversaire.avatar} apparence={ceQuIlPorte(ecran.rencontre.adversaire)} />
            </span>
            <b>{scoreDeRencontre(ecran.justes, ecran.rencontre.adversaire, ecran.rencontre.sesJustes)}</b>
            {/* Automate se dit simulé : on n'affronte pas une personne (le choix du 13 octobre 2026). */}
            {ecran.rencontre.adversaire.simule && <span className="muted small">simulé, de ton niveau</span>}
          </p>
        )}
        {/* Un duel contre quelqu'un : son score attend sa dernière réponse — question par question, on ne sait pas ce qu'il a fait. */}
        {ecran.contre && (
          <p className="rencontre-score" aria-live="polite">
            <span className="rencontre-adversaire" aria-hidden="true">
              <Visage avatar={ecran.contre.avatar} apparence={ecran.contre.apparence} />
            </span>
            <b>{`Toi ${ecran.justes}`}</b>
            <span className="muted small">{ecran.contre.aDejaJoue ? 'son score : à ta dernière réponse' : `${ecran.contre.nom} jouera après toi`}</span>
          </p>
        )}
        {/* Ce que le duel met en jeu sur sa cote, dit à chaque question : on sait pour quoi on joue. Sous l'Or, une défaite
            rapporte souvent quelque chose (la montée) : elle se dit en vert, « même si tu perds », jamais en menace. */}
        {enjeu && !r?.finie && <EnJeu enjeu={enjeu} className="muted small duels-enjeu" />}
        {q.categorie && <span className="label quiz-categorie">{q.categorie}</span>}
        <h2 className={'quiz-question' + questionSizeClass(q.texte)}>{espacesFines(q.texte)}</h2>
        {!r ? (
          <div className={'ans-grid' + answersSizeClass(q.reponses)}>
            {q.reponses.map((a, i) => (
              <button key={i} className="ans-btn" aria-disabled={busy || undefined} {...toucher(() => void repondre(i))}>
                <Shape index={i} />
                <span className="ans-text">{espacesFines(a)}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={'card result-banner ' + (r.juste ? 'result-ok' : 'result-ko')} role="status">
              {r.juste ? (
                <>
                  <span className="big">🎊 +1</span>
                  <p>
                    Bien joué !{r.xp > 0 ? ` +${r.xp}\u00a0XP` : ''}
                  </p>
                  <GerbeDeJuste />
                </>
              ) : (
                <>
                  <span className="result-icon">
                    <Icon name="x-circle" />
                  </span>
                  <p>
                    {ecran.revision
                      ? 'Pas grave : elle revient demain.'
                      : `Raté… ${viesApresUneFaute(ecran.vies)}`}
                  </p>
                </>
              )}
              <p className="muted">
                La bonne réponse : <Shape index={r.bonne} inline />
                <strong>{espacesFines(q.reponses[r.bonne])}</strong>
              </p>
              {/* Ce que l'adversaire en avait fait, après sa réponse à soi : jamais avant, ça soufflerait. */}
              {ecran.rencontre && r.rencontre && (
                <p className="muted small">
                  {r.rencontre.lui === null
                    ? `${ecran.rencontre.adversaire.nom} n’avait pas joué celle-ci.`
                    : `${ecran.rencontre.adversaire.nom} l’avait ${r.rencontre.lui ? 'trouvée' : 'ratée'}.`}
                </p>
              )}
              {/* Retrouvée en révision : ce qu'il reste de rendez-vous, ou apprise. */}
              {r.juste && r.revision && (
                <p className="carnet-suite">
                  {r.revision.enAvance ? (
                    // Revue en avance : retrouvée, elle ne bouge pas — trouvée avant son rendez-vous, elle ne prouve rien.
                    r.revision.apprise ? (
                      <>
                        <Icon name="check-circle" /> Toujours sue : elle reste apprise.
                      </>
                    ) : (
                      `Bien vu : son rendez-vous reste ${revientDans(r.revision.dans ?? 1)}.`
                    )
                  ) : r.revision.apprise ? (
                    <>
                      <Icon name="check-circle" /> Apprise !
                    </>
                  ) : (
                    `Encore ${INTERVALLES_DE_REVISION.length - r.revision.etape} rendez-vous : elle revient ${revientDans(r.revision.dans ?? 1)}.`
                  )}
                </p>
              )}
            </div>
            {r.anecdote && (
              <p className="card anecdote">
                <Icon name="message" />
                <span>
                  <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
                </span>
              </p>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={suivante}>
              {r.finie
                ? ecran.revision
                  ? 'Voir ma révision'
                  : ecran.rencontre || r.contre
                    ? 'Voir qui a gagné'
                    : ecran.contre
                      ? 'Voir mon duel'
                      : 'Voir ma série'
                : 'Question suivante'}
            </button>
            <button type="button" className="lien-signaler link-inline small" onClick={() => void signaler(ecran.serie, q.index)}>
              Signaler une erreur dans cette question
            </button>
          </>
        )}
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
        {/* Repartir alors qu'il reste des vies : la série finit là, comme perdue. Le défi n'a qu'une tentative, une rencontre se joue jusqu'au bout. */}
        {!ecran.defi && !ecran.revision && !ecran.rencontre && !r?.finie && (
          <GesteDuBas icone="rotate" busy={busy} onClick={() => void abandonner()}>
            Recommencer
          </GesteDuBas>
        )}
        {/* Une révision se recommence aussi : rien à perdre, ses réponses restent au carnet. */}
        {ecran.revision && !r?.finie && (
          <GesteDuBas icone="rotate" busy={busy} onClick={() => void recommencerLaRevision()}>
            Recommencer
          </GesteDuBas>
        )}
      </div>
      {toastVu}
    </div>
  )
}

/**
 * Ce qu'une fin de la campagne rapporte — une série, un défi, une révision,
 * un duel —, sur l'écran de gains de tous les modes (l'écran A) :
 * l'expérience en un total — les bonnes réponses, les trophées, payés à part
 * —, les confettis et le niveau relu ; l'Éclat du défi et les légendaires en
 * grand ; les trophées, les plus rares d'abord ; ce qu'ils ouvrent à porter.
 * Une fin de duel ne montre le total qu'à une montée de niveau : sa carte dit
 * déjà ce que le duel a fait, et un bloc de plus repoussait le verdict sous
 * le pli (la maquette choisie par le propriétaire le 12 octobre 2026).
 */
function GainsDeCampagne({ fin, profil, duel = false }: { fin: Extract<Ecran, { e: 'fin' }>; profil: PublicProfile | null; duel?: boolean }) {
  const cles = fin.recompenses.map(r => r.key)
  const niveau = useNiveauRelu(fin.justes > 0 || cles.length > 0)
  const monte = !!niveau && niveau.avant !== null && niveau.niveau > niveau.avant
  const nom = duel ? 'ton duel' : fin.revision ? 'ta révision' : fin.defi ? 'ton défi' : 'ta série'
  return (
    <>
      {(!duel || monte) && (
        <CeQueTuGagnes
          parts={partsDeLXp([
            { nom, xp: fin.xp },
            { nom: 'tes trophées', xp: xpDesTrophees(cles) },
          ])}
          confettis={duel ? 0 : fin.justes}
          niveau={niveau}
        />
      )}
      {/* L'Éclat du défi : une chance sur vingt, à sa tentative finie. */}
      {fin.eclat && <EclatTombe cle={fin.eclat} avatar={profil?.avatar ?? ''} finition={profil?.finition} chance={CHANCE_ECLAT_DU_DEFI} />}
      {fin.legendaires.map(cle => (
        <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
      ))}
      <NouveauxTrophees trophees={tropheesTombes(fin.recompenses as readonly Tombe[])} lien />
      <APorter objets={[...aPorterDesTrophees(cles), ...emojisAPorter(niveau)]} />
      {/* Ses missions du jour, si la partie en a fait : une série, un défi, un duel, une révision —
          relues à chaque fin (sa clé : la série), une série rejouée en faisant d'autres. */}
      <MissionsAccomplies key={fin.serie} profil={!!profil} />
    </>
  )
}

/**
 * La suite d'une série finie : la rejouer sur les mêmes catégories — ou le
 * même sujet —, en changer — l'accueil de la campagne, le choix déplié —, ou
 * relire ses réponses. On quittait la campagne pour l'accueil de
 * l'application à chaque série, et il fallait y revenir pour changer de
 * catégorie (un retour de joueur du 10 octobre 2026).
 */
export function SuiteDeLaSerie({
  categories,
  sujet = null,
  correctionOuverte,
  busy,
  onRejouer,
  onChanger,
  onCorrection,
}: {
  categories: readonly string[]
  sujet?: string | null
  correctionOuverte: boolean
  busy: boolean
  onRejouer: () => void
  onChanger: () => void
  onCorrection: () => void
}) {
  const jouees = nomDuChoix(categories, sujet)
  return (
    <>
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onRejouer}>
        <Icon name="rotate" />
        {jouees ? `Rejouer · ${jouees}` : 'Rejouer'}
      </button>
      <button type="button" className="btn btn-block" onClick={onChanger}>
        <Icon name="list" />
        {sujet ? 'Changer de sujet' : 'Changer de catégorie'}
      </button>
      <div className="row campagne-suite">
        {!correctionOuverte && (
          <button type="button" className="btn btn-ghost" onClick={onCorrection}>
            Mes réponses
          </button>
        )}
        <a className="btn btn-ghost" href="/">
          <Icon name="home" />
          Accueil
        </a>
      </div>
    </>
  )
}

/**
 * La page des duels sans son code, le temps qu'il arrive — `main.tsx` le
 * demande avec celui-ci, il est presque toujours là —, ou s'il ne viendra
 * plus : de quoi partir, et quoi faire.
 */
function DuelsSansLeurCode({ perdu }: { perdu: boolean }) {
  return (
    <div className="player-shell campagne duels" aria-busy={!perdu || undefined}>
      <Sortie />
      <PieceTete piece="Seul" titre="Les duels" />
      {perdu ? <p className="error">Cette page n’a pas pu se charger : vérifie ta connexion, puis recharge-la.</p> : <p className="serif-note">Chargement…</p>}
    </div>
  )
}

/**
 * La page qui s'ouvre tout de suite : le défi et les règles d'abord, son
 * record et sa série à reprendre dès que le serveur les a dits. Elle
 * attendait derrière « Chargement… » — 3,5 s au premier joueur après un
 * déploiement, le temps que le serveur lise sa base.
 */
export function CampagneEnChemin() {
  return (
    <div className="player-shell campagne" aria-busy="true">
      <Sortie />
      <Heros etat={null} />
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled="true">
        <Icon name="play" />
        Commencer une série
      </button>
    </div>
  )
}

/**
 * Le héros de la page : le défi, le record, l'échelle et les règles d'un coup
 * d'œil, sur la trame de l'atlas. Sans son état encore — la page s'ouvre
 * avant lui —, le record attend sa place, sans rien décaler.
 */
function Heros({ etat }: { etat: EtatDeCampagne | null }) {
  return (
    <section className="atlas-branche campagne-heros" style={lueur(OR)}>
      <span className="atlas-categorie">La campagne solo</span>
      <h1>Jusqu’où iras-tu&nbsp;?</h1>
      <div className="campagne-record-hud">
        {etat ? <b>{etat.record}</b> : <b>–</b>}
        <span>
          ton record
          <br />
          {!etat
            ? '…'
            : etat.series === 0
              ? 'ta première série t’attend'
              : `${etat.series} série${etat.series > 1 ? 's' : ''} jouée${etat.series > 1 ? 's' : ''}`}
        </span>
      </div>
      {/* L'échelle : la série monte de marche en marche. */}
      <ol className="campagne-echelle" aria-label="La difficulté monte">
        {NIVEAUX.map(n => (
          <li key={n}>
            <i aria-hidden="true" />
            {NOM_NIVEAU[n]}
          </li>
        ))}
      </ol>
      <ul className="campagne-puces">
        <li>
          {/* Les cœurs pour l'œil, les mots pour tous : « 3 vies sur 3, trois vies » se lisait deux fois. */}
          <span aria-hidden="true">
            <Vies restantes={VIES} />
          </span>{' '}
          trois vies
        </li>
        <li>
          <Icon name="timer" /> sans chrono
        </li>
        <li>🎊 un confetti par bonne réponse</li>
        <li>
          <Icon name="zap" /> {XP_PAR_JUSTE} XP par bonne réponse, sans limite — le double pour les {JUSTES_DOUBLEES_PAR_JOUR} premières du jour
        </li>
      </ul>
    </section>
  )
}

/** Ce qui reste après une faute : « plus qu'une vie » — « plus que 1 vie » se lisait mal. */
export const viesApresUneFaute = (vies: number) => (vies > 1 ? `plus que ${vies} vies` : vies === 1 ? 'plus qu’une vie' : 'c’était ta dernière vie')

/**
 * Ses records catégorie par catégorie, d'une série jouée seule : ce que le
 * Tour du monde demande — dix dans chacune. Replié : la page s'ouvre sur le
 * défi, pas sur un tableau. « Le haut fait du Tour du monde », jamais « le
 * Tour du monde » seul : c'est aussi le sentier de la culture générale.
 */
export function RecordsParCategorie({ records, categories }: { records: { categorie: string; record: number }[]; categories: string[] }) {
  const parCategorie = new Map(records.map(r => [r.categorie, r.record]))
  const atteintes = categories.filter(c => (parCategorie.get(c) ?? 0) >= RECORD_DU_TOUR_DU_MONDE).length
  const fait = atteintes === categories.length
  return (
    <details className="reglages-salon campagne-records">
      <summary>
        <Icon name="trophy" className="reglages-icone" />
        <span>
          <b>Mes records par catégorie</b>
          <span className="muted small">
            {/* « 0 sur 12 », sans « catégories » : le titre le dit, et la ligne tient en 360 px. */}
            {fait ? 'le haut fait du Tour du monde est à toi' : `haut fait du Tour du monde : ${atteintes} sur ${categories.length}`}
          </span>
        </span>
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
      <p className="muted small">
        {`Une série d’une seule catégorie : choisis-la d’un « Changer », sous le gros bouton. ${RECORD_DU_TOUR_DU_MONDE} bonnes réponses dans chacune des ${categories.length}, et le haut fait du Tour du monde est à toi.`}
      </p>
      <ul className="campagne-records-grille">
        {categories.map(c => {
          const record = parCategorie.get(c) ?? 0
          return (
            <li key={c} className={record >= RECORD_DU_TOUR_DU_MONDE ? 'atteint' : undefined}>
              <Icon name={EMBLEME[c] ?? 'star'} />
              <span>{c}</span>
              <b aria-label={`record : ${record}`}>{record || '–'}</b>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

/**
 * L'en-tête d'une question : où l'on en est, et ce qui reste. Une série — et
 * le défi, de la semaine ou entre amis, qui en est une — dit ses bonnes
 * réponses sous son numéro : seul, « question 10 » se lisait comme un score,
 * et chaque vie perdue en route le faisait mentir d'une (un retour de joueur
 * du 13 octobre 2026 : « tu es peut-être à 8 en score »). Le compte monte dès
 * la révélation. Une révision n'a ni vies ni score à battre ; un duel dit le
 * sien dessous, face à l'autre.
 */
export function TeteDeLaQuestion({ ecran }: { ecran: Extract<Ecran, { e: 'jeu' }> }) {
  const { question: q, justes } = ecran
  const s = justes > 1 ? 's' : ''
  // « question 1 » d'un bloc, et chaque « · » collé au mot d'avant : en 360 de large, « Contre Automate · question 1 »
  // passait à la ligne à côté des cœurs et y laissait le « 1 » seul. Coupé, il se lit « Contre Automate · », puis
  // « question 1 » — un séparateur ne commence pas plus une ligne qu'un point d'interrogation (`espacesFines`).
  const numero = `question\u00a0${q.index + 1}`
  return (
    <div className="quiz-topbar">
      {ecran.revision ? (
        // Une révision n'a pas de vies : ce qui compte, c'est où l'on en est.
        <span className="label">{`Révision\u00a0· ${numero}\u00a0sur\u00a0${ecran.total}`}</span>
      ) : ecran.rencontre || ecran.contre ? (
        <>
          <span className="label">{`Contre ${(ecran.rencontre?.adversaire ?? ecran.contre!).nom}\u00a0· ${numero}`}</span>
          <Vies restantes={ecran.vies} />
        </>
      ) : (
        <>
          <span className="campagne-ou">
            <span className="label">
              {ecran.defi && (ecran.duel ? 'Défi entre amis\u00a0· ' : 'Le défi\u00a0· ')}
              {`${NOM_NIVEAU[q.niveau]}\u00a0· ${numero}`}
            </span>
            <span className="campagne-bonnes">
              <b className={ecran.reponse?.juste ? 'campagne-bonne-de-plus' : undefined}>{justes}</b>
              {` bonne${s} réponse${s}`}
            </span>
          </span>
          <Vies restantes={ecran.vies} />
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Onglets } from '../components/Onglets'
import { iconeDuSujet } from '../iconeDuSujet'
import { ADRESSE_DES_SENTIERS, Sentiers, SentiersEnChemin, demanderLesSentiers } from './Sentiers'
import { ADRESSE_DU_DEFI, PageDuDefi } from './Defi'
import { FinDuDuel, MesDuels, PageDuDuel, adresseDuDuel } from './Duel'
import { ADRESSE_DU_CARNET, PageDuCarnet, prochaineFois, revientDans } from './Carnet'
import { AffronterUnInconnu, MOT_DE_L_ISSUE, scoreDeRencontre } from './Rencontre'
import { nomDesCategories, nomDuChoix } from '../nomDuChoix'
import { Shape } from '../components/Shape'
import { PieceTete, Sortie } from '../components/Pieces'
import { EclatTombe, LegendaireOuvert, RecompenseTombee } from '../components/Ouverts'
import { BarreDeNiveau, retenirLeNiveau } from '../components/BarreDeNiveau'
import { GerbeDeJuste } from '../components/Gerbe'
import { EMBLEME } from '../components/Ecusson'
import { OR, lueur } from '../components/Atlas'
import { choixDialog, promptDialog } from '../components/Dialog'
import { espacesFines } from '../format'
import { showToast, useAppState } from '../state'
import { porterTheme } from '../themeJoueur'
import { porterGerbe } from '../gerbe'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { placeDuJour } from '../../../shared/course'
import { versLesSentiers } from '../../../shared/depart'
import { CHANCE_ECLAT_DU_DEFI, type PublicProfile } from '../../../shared/profil'
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
  lireCodeDuDuel,
  type Adversaire,
  type CorrectionDeCampagne,
  type EtatDeCampagne,
  type IssueDeRencontre,
  type Niveau,
  type QuestionDeCampagne,
  type RencontreDeCampagne,
  type ReponseDeCampagne,
  type SerieDeCampagne,
} from '../../../shared/campagne'
import { INTERVALLES_DE_REVISION, type EtatDuCarnet } from '../../../shared/revision'

type Ecran =
  | { e: 'chargement' }
  | { e: 'anonyme' }
  | { e: 'erreur'; motif: string }
  | { e: 'accueil'; etat: EtatDeCampagne }
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
      /** Une révision du carnet : sans vies, et chaque réponse dit où en est sa question. */
      revision?: true
      /** Les questions que cette révision vient de faire apprendre. */
      apprises?: number
      /** Une rencontre : qui l'on affronte, et ses bonnes réponses jusqu'à la question qu'on vient de jouer. */
      rencontre?: { adversaire: Adversaire; sesJustes: number }
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
      /** Une rencontre : qui l'on affrontait, et qui l'a gagnée. */
      rencontre?: { adversaire: Adversaire; issue: IssueDeRencontre }
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
      /** Ce qui a éclaté pour lui à la fin du défi de la semaine (`CHANCE_ECLAT_DU_DEFI`). */
      eclat?: string
    }

/** Les modes de la campagne : la série à trois vies, les sentiers du savoir, le défi de la semaine — et un défi entre amis, ouvert par son lien —, et le carnet de révision. */
type Mode = 'serie' | 'sentiers' | 'defi' | 'duel' | 'carnet'

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
  hash === ADRESSE_DU_DEFI ? 'defi' : hash === ADRESSE_DU_CARNET ? 'carnet' : codeDuLien(hash) ? 'duel' : versLesSentiers(hash) ? 'sentiers' : 'serie'
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
  // Le choix des catégories, déplié quand on vient de la fin d'une série pour en changer.
  const [choixOuvert, setChoixOuvert] = useState(false)
  const choix = useRef<HTMLDetailsElement>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  // Son profil, lu en léger : l'Éclat d'un défi s'y montre avec sa finition.
  const [profil, setProfil] = useState<PublicProfile | null>(null)
  // Ce que son carnet a à revoir aujourd'hui, sur l'onglet : lu après la page, sans la retenir.
  const [aRevoir, setARevoir] = useState(0)
  // Chaque écran commence en haut, comme une page qu'on ouvre.
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    window.scrollTo(0, 0)
  }

  const relire = async () => {
    const etat = await api.campagne.etat()
    setEcran({ e: 'accueil', etat })
  }

  // Le retour du navigateur d'un sentier à la série, ou l'inverse.
  useEffect(() => {
    const suivre = () => {
      setMode(modeDe(window.location.hash))
      setCodeDuDuel(codeDuLien(window.location.hash))
    }
    window.addEventListener('hashchange', suivre)
    window.addEventListener('popstate', suivre)
    return () => {
      window.removeEventListener('hashchange', suivre)
      window.removeEventListener('popstate', suivre)
    }
  }, [])
  /** Changer d'onglet n'empile rien : le retour du téléphone quitte la campagne, comme avant. */
  const choisirMode = (m: Mode) => {
    history.replaceState(
      history.state,
      '',
      m === 'sentiers'
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
        { id: 'defi', nom: 'Le défi', court: 'Défi', icone: 'trophy' },
        // Ce qui l'attend aujourd'hui se compte sur l'onglet : sinon, il faudrait l'ouvrir pour le savoir.
        {
          id: 'carnet',
          nom: 'Le carnet',
          court: 'Carnet',
          icone: 'book',
          ...(aRevoir > 0 && { pastille: { n: aRevoir, label: `${aRevoir} à revoir aujourd’hui` } }),
        },
      ]}
      // Un défi entre amis se range sous l'onglet du défi.
      actif={mode === 'duel' ? 'defi' : mode}
      onChoisir={choisirMode}
      label="Le mode de la campagne"
      idOnglet={m => `mode-${m}`}
      idPanneau={() => 'mode-campagne'}
      className="onglets-campagne"
    />
  )

  useEffect(() => {
    document.title = 'La campagne · FiestApp'
    let vivant = true
    // L'état part avec le profil, pas après lui, et le profil se lit en
    // léger : comme au quiz du jour, son détail ne servait qu'au thème. Ouverte
    // sur les sentiers, leur état part avec eux : il attendait le premier.
    const etat = api.campagne.etat()
    etat.catch(() => {})
    if (modeDe(window.location.hash) === 'sentiers') demanderLesSentiers()
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
      const lu = await etat
      if (!vivant) return
      setEcran({ e: 'accueil', etat: lu })
      // Le compte du carnet vient après la page, pour l'onglet : qu'il se taise ne retient rien.
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

  /** Depuis la fin d'une série : l'accueil de la campagne, le choix des catégories déplié sous les yeux. */
  const changerDeCategorie = async () => {
    setChoixOuvert(true)
    try {
      await relire()
    } catch (e) {
      setErreur(motifDe(e))
    }
  }
  // Seulement à l'arrivée sur l'accueil : déplié à la main, le choix ne fait rien défiler.
  useEffect(() => {
    if (ecran.e === 'accueil' && choixOuvert) choix.current?.scrollIntoView({ block: 'center' })
  }, [ecran.e])

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
        ...(ecran.rencontre && r.rencontre?.issue && { rencontre: { adversaire: ecran.rencontre.adversaire, issue: r.rencontre.issue } }),
        record: !!r.record,
        recordAvant: r.recordAvant ?? null,
        niveauAtteint: r.niveauAtteint ?? null,
        correction: null,
        xp: ecran.xp,
        recompenses: r.recompenses ?? [],
        legendaires: r.legendaires ?? [],
        ...(ecran.defi && { defi: true as const }),
        ...(ecran.duel && { duel: ecran.duel }),
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

  /** Une révision du carnet, commencée ou reprise depuis son onglet : la partie de la série, sans vies. */
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
      categories: [],
      sujet: null,
      revision: true,
      apprises: 0,
    })
  }

  /** Une rencontre, trouvée ou reprise depuis l'onglet du défi : la partie de la série, contre le score d'un autre. */
  const jouerLaRencontre = ({ serie: t, adversaire, sesJustes }: RencontreDeCampagne) => {
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
      rencontre: { adversaire, sesJustes },
    })
  }

  /** De la fin d'une rencontre à une autre : un autre adversaire, tout de suite. */
  const uneAutreRencontre = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      jouerLaRencontre(await api.campagne.rencontre.commencer())
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** De la fin d'une révision à une autre, tant qu'il reste à revoir. */
  const reviserEncore = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      jouerLaRevision(await api.campagne.carnet.reviser())
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** Le carnet, depuis la fin d'une série ou d'une révision : son onglet, relu. */
  const ouvrirLeCarnet = async () => {
    choisirMode('carnet')
    try {
      await relire()
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  /** Un défi entre amis, lancé ou relevé : la même partie, une seule tentative, son code au bout pour l'envoyer. */
  const jouerLeDuel = (t: SerieDeCampagne, code: string) => {
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
    })
  }

  /** « Défier des amis » : un tirage sur ce qu'on a choisi — catégories ou sujet —, et sa propre tentative d'abord. */
  const lancerUnDuel = async (choisies: string[], choisi: string | null) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const { code, serie } = await api.campagne.duel.lancer(choisi ? [] : choisies, choisi)
      jouerLeDuel(serie, code)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  /** La page d'un défi entre amis, à son adresse : le retour du navigateur ramène d'où l'on vient. */
  const ouvrirLeDuel = async (code: string) => {
    history.pushState(history.state, '', `${window.location.pathname}${window.location.search}${adresseDuDuel(code)}`)
    setCodeDuDuel(code)
    setMode('duel')
    try {
      await relire()
    } catch (e) {
      setErreur(motifDe(e))
    }
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

  // Ouverte sur les sentiers, la page n'attend pas la série pour s'esquisser.
  if (ecran.e === 'chargement' && mode === 'sentiers') return <SentiersEnChemin onglets={onglets} />
  if (ecran.e === 'chargement') return <CampagneEnChemin />
  if (ecran.e !== 'anonyme' && ecran.e !== 'erreur' && mode === 'sentiers') {
    return (
      <>
        <Sentiers onglets={onglets} onSerie={() => choisirMode('serie')} />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'accueil' && mode === 'defi') {
    return (
      <>
        <PageDuDefi
          onglets={onglets}
          onJouer={jouerLeDefi}
          apres={
            <>
              <AffronterUnInconnu onJouer={jouerLaRencontre} />
              <MesDuels onOuvrir={ouvrirLeDuel} />
            </>
          }
        />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'accueil' && mode === 'carnet') {
    return (
      <>
        <PageDuCarnet onglets={onglets} onReviser={jouerLaRevision} onLu={c => setARevoir(c.aRevoir)} />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'accueil' && mode === 'duel' && codeDuDuel) {
    return (
      <>
        <PageDuDuel key={codeDuDuel} code={codeDuDuel} onglets={onglets} onJouer={jouerLeDuel} />
        {toastVu}
      </>
    )
  }

  if (ecran.e === 'anonyme' || ecran.e === 'erreur') {
    // Le lien d'un défi entre amis survit à la connexion : on revient sur lui (`pageDeRetour` garde le fragment).
    const retour = encodeURIComponent(`/campagne${codeDuDuel ? adresseDuDuel(codeDuDuel) : ''}`)
    return (
      <div className="player-shell">
        <Sortie />
        <PieceTete piece="Seul" titre="La campagne" />
        {ecran.e === 'anonyme' ? (
          <>
            <p>
              {codeDuDuel
                ? 'Un ami te défie à la campagne : connecte-toi à ton profil pour relever son défi, ou crée-le.'
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
    const leSujet = sujetJouable ? sujetParCle(sujetJouable) : undefined
    // Sur un sujet, toucher une catégorie la choisit seule : la basculer retirerait celle qu'on ne voyait plus choisie.
    const basculer = (c: string) =>
      setCategories(sujetJouable ? [c] : categories.includes(c) ? categories.filter(x => x !== c) : [...categories, c])
    return (
      <div className="player-shell campagne">
        <Sortie />
        {onglets}
        <Heros etat={etat} />
        {etat.records && etat.categories.length > 1 && <RecordsParCategorie records={etat.records} categories={etat.categories.map(c => c.categorie)} />}
        {/* Ce que la journée a déjà rapporté, et ce qui paie encore double : sans plafond, il n'y a plus de « plein » à annoncer. */}
        {etat.xpAujourdhui > 0 && (
          <p className="muted small campagne-xp-du-jour">
            Aujourd’hui : +{etat.xpAujourdhui} XP
            {doubles > 0 && ` · encore ${doubles} bonne${doubles > 1 ? 's' : ''} réponse${doubles > 1 ? 's' : ''} au double`}
          </p>
        )}
        {pret ? (
          <>
            {(etat.categories.length > 1 || sujets.length > 0) && (
              <details className="reglages-salon" ref={choix} open={choixOuvert} onToggle={e => setChoixOuvert(e.currentTarget.open)}>
                <summary>
                  <Icon name="list" className="reglages-icone" />
                  <span>
                    <b>{sujets.length > 0 ? 'Catégories et sujets' : 'Catégories'}</b>
                    <span className="muted small">
                      {leSujet ? leSujet.nom : categories.length === 0 ? 'toutes' : `${categories.length} choisie${categories.length > 1 ? 's' : ''}`}
                    </span>
                  </span>
                  <Icon name="chevron-down" className="repli-chevron" />
                </summary>
                {/* En grille, l'emblème de chacune : tout tient sans rien faire glisser de côté. */}
                <div className="categories-grille" role="group" aria-label="Catégories">
                  <button type="button" className={'categorie-case' + (!sujetJouable && categories.length === 0 ? ' active' : '')} aria-pressed={!sujetJouable && categories.length === 0} onClick={() => setCategories([])}>
                    <Icon name="sparkles" />
                    Toutes
                  </button>
                  {etat.categories.map(c => (
                    <button
                      key={c.categorie}
                      type="button"
                      className={'categorie-case' + (!sujetJouable && categories.includes(c.categorie) ? ' active' : '')}
                      aria-pressed={!sujetJouable && categories.includes(c.categorie)}
                      onClick={() => basculer(c.categorie)}
                    >
                      <Icon name={EMBLEME[c.categorie] ?? 'star'} />
                      {c.categorie}
                    </button>
                  ))}
                </div>
                {/* Ou un fil qui les traverse toutes : une époque, la France, les pionnières (`shared/sujets.ts`). Le toucher de nouveau rend les catégories. */}
                {sujets.length > 0 && (
                  <div className="campagne-sujets">
                    <p className="sujets-titre">Ou un sujet, à travers toutes les catégories</p>
                    {(['epoque', 'fil'] as const).map(famille => (
                      <div key={famille}>
                        <p className="label">{famille === 'epoque' ? 'Une époque' : 'Un fil rouge'}</p>
                        <div className="categories-grille" role="group" aria-label={famille === 'epoque' ? 'Une époque' : 'Un fil rouge'}>
                          {sujets
                            .filter(s => s.famille === famille)
                            .map(s => (
                              <button
                                key={s.cle}
                                type="button"
                                className={'categorie-case' + (sujetJouable === s.cle ? ' active' : '')}
                                aria-pressed={sujetJouable === s.cle}
                                onClick={() => choisirSujet(sujetJouable === s.cle ? null : s.cle)}
                              >
                                <Icon name={iconeDuSujet(s)} />
                                {s.nom}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                    {leSujet && <p className="muted small">{espacesFines(leSujet.description)}</p>}
                  </div>
                )}
              </details>
            )}
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
                Reprendre ma série · {etat.enCours.justes} bonne{etat.enCours.justes > 1 ? 's' : ''}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void commencer(categories, sujetJouable)}>
              <Icon name="play" />
              {etat.enCours ? 'Une nouvelle série' : 'Commencer une série'}
            </button>
            {/* Le même tirage pour ceux qu'on défie : on joue d'abord, on envoie le lien ensuite (`Duel.tsx`). */}
            <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={() => void lancerUnDuel(categories, sujetJouable)}>
              <Icon name="users" />
              Défier des amis
            </button>
            <p className="muted small centre">Le même tirage pour eux : tu joues d’abord, puis tu leur envoies le lien.</p>
          </>
        ) : (
          <p className="muted">La campagne n’a pas encore de questions à poser : reviens bientôt — ou joue le quiz du jour.</p>
        )}
      </div>
    )
  }

  if (ecran.e === 'fin' && ecran.revision) {
    const { total, apprises, carnet } = ecran.revision
    const ratees = total - ecran.justes
    const s = ecran.justes > 1 ? 's' : ''
    return (
      <div className="player-shell campagne">
        <header className="fin-tete">
          <span className="label">Le carnet de révision</span>
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
          {ecran.justes > 0 && (
            <p className="muted">
              🎊 +{ecran.justes} confetti{s}
              {ecran.xp > 0 && ` · +${ecran.xp} XP`}
            </p>
          )}
        </section>
        {ecran.justes > 0 && <BarreDeNiveau />}
        {ecran.recompenses.length > 0 && (
          <section className="card campagne-recompenses">
            {ecran.recompenses.map(r => (
              <RecompenseTombee key={r.key} recompense={r} />
            ))}
          </section>
        )}
        {ecran.legendaires.map(cle => (
          <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
        ))}
        {erreur && <p className="error">{erreur}</p>}
        {carnet && carnet.aRevoir > 0 ? (
          <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void reviserEncore()}>
            <Icon name="rotate" />
            {`Réviser encore · ${Math.min(carnet.aRevoir, total)} question${Math.min(carnet.aRevoir, total) > 1 ? 's' : ''}`}
          </button>
        ) : (
          carnet && <p className="muted centre carnet-prochaine">{prochaineFois(carnet)}</p>
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

  if (ecran.e === 'fin' && ecran.rencontre) {
    const { adversaire, issue } = ecran.rencontre
    const s = ecran.justes > 1 ? 's' : ''
    const voirCorrection = async () => {
      try {
        setEcranBrut({ ...ecran, correction: await api.campagne.correction(ecran.serie) })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    return (
      <div className="player-shell campagne">
        <header className="fin-tete">
          <span className="label">{`Rencontre contre ${adversaire.nom}`}</span>
          <h1>{issue === 'gagnee' ? 'Gagné !' : issue === 'egalite' ? 'Égalité' : adversaire.justes - ecran.justes <= 2 ? 'Perdu de peu' : 'Perdu'}</h1>
        </header>
        <section className={'card result-banner campagne-fin ' + (issue === 'perdue' ? 'result-ko' : 'result-ok')}>
          {/* Les deux scores, côte à côte : le sien d'abord. */}
          <p className="rencontre-final" aria-label={scoreDeRencontre(ecran.justes, adversaire)}>
            <span>
              <b>{ecran.justes}</b>
              <span className="muted small">toi</span>
            </span>
            <span className="rencontre-contre" aria-hidden="true">
              –
            </span>
            <span>
              <b>{adversaire.justes}</b>
              <span className="muted small">{`${adversaire.avatar} ${adversaire.nom}`}</span>
            </span>
          </p>
          <p>{`${MOT_DE_L_ISSUE[issue]} : ${ecran.justes} bonne${s} réponse${s} contre ${adversaire.justes}, sur les mêmes questions.`}</p>
          {ecran.justes > 0 && (
            <p className="muted">
              🎊 +{ecran.justes} confetti{s}
              {ecran.xp > 0 && ` · +${ecran.xp} XP`}
            </p>
          )}
        </section>
        {ecran.erreurs > 0 && (
          <p className="muted small centre carnet-rappel">
            <Icon name="book" /> {ecran.erreurs > 1 ? 'Tes erreurs reviendront' : 'Ton erreur reviendra'} demain dans{' '}
            <button type="button" className="link-inline" onClick={() => void ouvrirLeCarnet()}>
              ton carnet de révision
            </button>
            .
          </p>
        )}
        {ecran.justes > 0 && <BarreDeNiveau />}
        {ecran.recompenses.length > 0 && (
          <section className="card campagne-recompenses">
            {ecran.recompenses.map(r => (
              <RecompenseTombee key={r.key} recompense={r} />
            ))}
          </section>
        )}
        {ecran.legendaires.map(cle => (
          <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
        ))}
        {erreur && <p className="error">{erreur}</p>}
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void uneAutreRencontre()}>
          <Icon name="users" />
          Un autre adversaire
        </button>
        <div className="row campagne-suite">
          {!ecran.correction && (
            <button type="button" className="btn btn-ghost" onClick={() => void voirCorrection()}>
              Mes réponses
            </button>
          )}
          <a className="btn btn-ghost" href="/">
            <Icon name="home" />
            Accueil
          </a>
        </div>
        {ecran.correction && <CorrectionDeLaSerie correction={ecran.correction} />}
      </div>
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
            {ecran.duel ? `Défi entre amis${jouees ? ` · ${jouees}` : ''}` : ecran.defi ? 'Le défi de la semaine' : `La campagne${jouees ? ` · ${jouees}` : ''}`}
          </span>
          <h1>{ecran.defi ? 'Défi relevé' : ecran.abandonnee ? 'Série arrêtée' : 'Série terminée'}</h1>
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
          {/* Rien à compter, rien à dire : « +0 confetti » sonnait comme un reproche. */}
          {ecran.justes > 0 && (
            <p className="muted">
              🎊 +{ecran.justes} confetti{s}
              {ecran.xp > 0 && ` · +${ecran.xp}\u00a0XP`}
            </p>
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
        {/* Où il en est : la barre de niveau, relue après la série, et la montée qu'elle a faite. */}
        {ecran.justes > 0 && <BarreDeNiveau />}
        {ecran.recompenses.length > 0 && (
          <section className="card campagne-recompenses">
            {ecran.recompenses.map(r => (
              <RecompenseTombee key={r.key} recompense={r} />
            ))}
          </section>
        )}
        {/* L'Éclat du défi : une chance sur vingt, à sa tentative finie. */}
        {ecran.eclat && <EclatTombe cle={ecran.eclat} avatar={profil?.avatar ?? ''} finition={profil?.finition} chance={CHANCE_ECLAT_DU_DEFI} />}
        {ecran.legendaires.map(cle => (
          <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
        ))}
        {erreur && <p className="error">{erreur}</p>}
        {ecran.duel ? (
          // L'envoyer d'abord : celui qui vient de le lancer n'a encore défié personne.
          <FinDuDuel code={ecran.duel} justes={ecran.justes} onClassement={() => void ouvrirLeDuel(ecran.duel!)} />
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
        {ecran.correction && <CorrectionDeLaSerie correction={ecran.correction} />}
      </div>
    )
  }

  // ── Une question de la série ──
  const { question: q, reponse: r } = ecran
  return (
    <div className="player-shell campagne">
      <div className="quiz-player">
        <div className="quiz-topbar">
          {ecran.revision ? (
            // Une révision n'a pas de vies : ce qui compte, c'est où l'on en est.
            <span className="label">{`Révision · question ${q.index + 1} sur ${ecran.total}`}</span>
          ) : ecran.rencontre ? (
            <>
              <span className="label">{`Contre ${ecran.rencontre.adversaire.nom} · question ${q.index + 1}`}</span>
              <Vies restantes={ecran.vies} />
            </>
          ) : (
            <>
              <span className="label">
                {ecran.defi && (ecran.duel ? 'Défi entre amis · ' : 'Le défi · ')}
                {NOM_NIVEAU[q.niveau]} · question {q.index + 1}
              </span>
              <Vies restantes={ecran.vies} />
            </>
          )}
        </div>
        {/* Le face-à-face : les deux scores sur les mêmes questions, et celui d'en face à battre. */}
        {ecran.rencontre && (
          <p className="rencontre-score" aria-live="polite">
            <span className="rencontre-adversaire" aria-hidden="true">
              {ecran.rencontre.adversaire.avatar}
            </span>
            <b>{scoreDeRencontre(ecran.justes, ecran.rencontre.adversaire, ecran.rencontre.sesJustes)}</b>
            <span className="muted small">{`à battre : ${ecran.rencontre.adversaire.justes}`}</span>
          </p>
        )}
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
                      : `Raté… ${ecran.vies > 0 ? `plus que ${ecran.vies} vie${ecran.vies > 1 ? 's' : ''}` : 'c’était ta dernière vie'}`}
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
                    ? `${ecran.rencontre.adversaire.nom} s’était arrêté avant.`
                    : `${ecran.rencontre.adversaire.nom} l’avait ${r.rencontre.lui ? 'trouvée' : 'ratée'}.`}
                </p>
              )}
              {/* Retrouvée en révision : ce qu'il reste de rendez-vous, ou apprise. */}
              {r.juste && r.revision && (
                <p className="carnet-suite">
                  {r.revision.apprise ? (
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
              {r.finie ? (ecran.revision ? 'Voir ma révision' : ecran.rencontre ? 'Voir qui a gagné' : 'Voir ma série') : 'Question suivante'}
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
        {/* Repartir alors qu'il reste des vies : la série finit là, comme perdue. Le défi n'a qu'une tentative, une révision n'a rien à perdre, une rencontre se joue jusqu'au bout. */}
        {!ecran.defi && !ecran.revision && !ecran.rencontre && !r?.finie && (
          <button type="button" className="btn btn-ghost btn-small serie-recommencer" aria-disabled={busy || undefined} onClick={() => void abandonner()}>
            <Icon name="rotate" />
            Recommencer
          </button>
        )}
      </div>
      {toastVu}
    </div>
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

/** « Mes réponses », une série finie : chaque question, sa bonne réponse, la sienne. */
function CorrectionDeLaSerie({ correction }: { correction: CorrectionDeCampagne[] }) {
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
          {/* L'anecdote, qu'on a lue en jouant : la correction la redonne, pour s'en souvenir. */}
          {c.anecdote && <p className="small campagne-anecdote">{espacesFines(c.anecdote)}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Les vies qui restent, en cœurs et en mots. */
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

/**
 * Ses records catégorie par catégorie, d'une série jouée seule : ce que le
 * Tour du monde demande — dix dans chacune. Replié : la page s'ouvre sur le
 * défi, pas sur un tableau.
 */
function RecordsParCategorie({ records, categories }: { records: { categorie: string; record: number }[]; categories: string[] }) {
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
            {fait ? 'le Tour du monde est fait' : `Tour du monde : ${atteintes} sur ${categories.length}`}
          </span>
        </span>
        <Icon name="chevron-down" className="repli-chevron" />
      </summary>
      <p className="muted small">
        {`Une série d’une seule catégorie : choisis-la plus bas, parmi les catégories. ${RECORD_DU_TOUR_DU_MONDE} bonnes réponses dans chacune des ${categories.length}, et le Tour du monde est à toi.`}
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

function Vies({ restantes }: { restantes: number }) {
  return (
    <span className="vies" role="img" aria-label={`${restantes} vie${restantes > 1 ? 's' : ''} sur ${VIES}`}>
      {Array.from({ length: VIES }, (_, i) => (
        <svg key={i} className={'icon coeur' + (i >= restantes ? ' perdu' : '')} viewBox="0 0 24 24" fill={i >= restantes ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
        </svg>
      ))}
    </span>
  )
}

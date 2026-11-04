import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { api, motifDe, UnauthorizedError, type Me } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { NavAnimateur } from '../components/NavAnimateur'
import { AdminCampagne } from '../components/AdminCampagne'
import { AdminDuels } from '../components/AdminDuels'
import { AdminEconomie } from '../components/AdminEconomie'
import { AdminDuJour } from '../components/AdminDuJour'
import { AdminProfils, supprimerLeProfil } from '../components/AdminProfils'
import { AdminSalons } from '../components/AdminSalons'
import { AdminSignalements } from '../components/AdminSignalements'
import { ListeATraiter, VueDEnsembleDuQg } from '../components/QgVueDEnsemble'
import { QgJournal } from '../components/QgJournal'
import { QgSoirees } from '../components/QgSoirees'
import { QgServeur } from '../components/QgServeur'
import { QgBase } from '../components/QgBase'
import { QgEnDirect } from '../components/QgEnDirect'
import { QgAlertes } from '../components/QgAlertes'
import { QgTelephones } from '../components/QgTelephones'
import { fluxDuQg } from '../qgFlux'
import { QgErreurs } from '../components/QgErreurs'
import { QgActivite } from '../components/QgActivite'
import { QgCabinet } from '../components/QgCabinet'
import { QgMaintenance } from '../components/QgMaintenance'
import { QgAnnonces } from '../components/QgAnnonces'
import { QgJoueurs } from '../components/QgJoueurs'
import { QgAffiches } from '../components/QgAffiches'
import { QgQuestions } from '../components/QgQuestions'
import { QgReserves } from '../components/QgReserves'
import { FicheDuJoueurAuQg } from '../components/QgFicheJoueur'
import { OuvrirLaFiche } from '../components/PrenomDuJoueur'
import { SommaireDeLaPage, useSommaire } from '../components/SommaireDeLaPage'
import { PaletteDuQg } from '../components/QgPalette'
import { Feuille } from '../components/Pieces'
import { useAppState } from '../state'
import { useComparaisonDuQg, usePeriodeDuQg } from '../qgPeriode'
import { formatDay } from '../../../shared/archive'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { heureEcrite, lesChosesATraiter, pireGravite, type DirectDuQg, type GraviteDUneChose, type VueDEnsemble } from '../../../shared/qg'
import { NOM_DE_LA_PERIODE, PERIODES_DU_QG, PERIODE_EN_TOUTES_LETTRES, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import { periodeDuServeur } from '../../../shared/santeDuServeur'
import type { EspaceDAdministration } from '../../../shared/space'
import { ceQuiEstPose, PAGES_EN_MAINTENANCE, type EtatDeLaMaintenance } from '../../../shared/maintenance'
import type { EntreeDuCatalogue, StatutAuCatalogue } from '../../../shared/partage'
import type { QuizQuestionDef } from '../../../shared/library'
import type { ProfilDAdministration } from '../../../shared/profil'
import type { SegmentDuQg } from '../../../shared/qgJoueurs'
import type { EtatDesQuestions } from '../../../shared/qgContenu'

/**
 * Le QG de l'administrateur (`/admin`), pour lui seul — le souhait du
 * propriétaire du 13 octobre 2026 : « un vrai QG pour monitorer tous les
 * modes de jeu et avoir un vrai impact dessus ». Depuis le 4 novembre 2026,
 * le QG 2 (la proposition du 3, `retours/2026-11-03/le-qg.md`, que le
 * propriétaire a faite sienne : « suis tes recommandations […] pratique sur
 * mobile ») : une salle de contrôle nocturne sous tous les thèmes — elle ne
 * porte pas celui du profil (`main.tsx`) —, un rail en six groupes, une barre
 * de commande collée en haut qui dit où l'on est, la période de la page qui en
 * lit une, ce qui attend un geste et la palette (⌘K) ; le poste de commande
 * d'abord (`QgVueDEnsemble.tsx`), puis une page par sujet, chacune à son
 * adresse (`/admin#jour`), l'onglet ouvert compris (`/admin#serveur/gels`).
 *
 * La revue d'ergonomie du même jour (`retours/2026-11-04/experts/ergonomie.md`)
 * a réglé la coque : le rail rangé par moment d'usage — une panne se voit, se
 * comprend, se ferme et se dit sans quitter « Commande » —, ses groupes
 * repliables pour tenir en 1366 × 768 ; la pastille de la barre qui compte ce
 * qui attend un geste, à la couleur de sa pire ligne, plutôt que les voyants
 * pas au vert ; au téléphone, une console : sa barre du bas à elle — le poste,
 * ce qui attend, le direct, les pages — au lieu de celle du joueur, la feuille
 * « Pages » tirée du rail, la période dans un bouton.
 *
 * Il remplace une page à la manière de « Mon compte » (le 3 octobre 2026) —
 * quatre cadrans et cinq lignes —, qui ne disait rien de ce qui se jouait.
 * Les quiz et les soirées des autres ne s'y voient toujours pas : des
 * soirées, rien que des chiffres ; des quiz, les copies proposées au
 * catalogue.
 */

type Ecran =
  | 'journal'
  | 'erreurs'
  | 'serveur'
  | 'maintenance'
  | 'activite'
  | 'soirees'
  | 'profils'
  | 'salons'
  | 'catalogue'
  | 'jour'
  | 'campagne'
  | 'cabinet'
  | 'duels'
  | 'economie'
  | 'signalements'
  | 'annonces'
  | 'affiches'
  | 'base'
  | 'direct'
  | 'alertes'
  | 'joueurs'
  | 'telephones'
  | 'questions'
  | 'reserves'
const ECRANS: readonly Ecran[] = ['journal', 'erreurs', 'serveur', 'maintenance', 'activite', 'soirees', 'profils', 'salons', 'catalogue', 'jour', 'campagne', 'cabinet', 'duels', 'economie', 'signalements', 'annonces', 'affiches', 'base', 'direct', 'alertes', 'joueurs', 'telephones', 'questions', 'reserves']
/** Les ancres de la page d'avant, qu'un favori garde encore. */
const ANCIENNES: Record<string, Ecran> = { 'les-profils': 'profils', 'quiz-du-jour': 'jour' }

/**
 * L'adresse d'une page : son écran, et l'onglet qu'on y a ouvert
 * (`/admin#serveur/gels`). Le retour du navigateur et un lien partagé
 * perdaient l'onglet, que la page tenait seule (la revue d'ergonomie du
 * 4 novembre 2026).
 */
function lireAdresse(): { ecran: Ecran | null; onglet: string | null } {
  const [h, onglet] = window.location.hash.slice(1).split('/')
  const ecran = (ECRANS as readonly string[]).includes(h) ? (h as Ecran) : (ANCIENNES[h] ?? null)
  return { ecran, onglet: ecran && onglet ? onglet : null }
}

const adresseDe = (e: Ecran | null, onglet?: string | null) => (e ? `/admin#${e}${onglet ? `/${onglet}` : ''}` : '/admin')

const TITRE: Record<Ecran, string> = {
  journal: 'Le journal',
  erreurs: 'Les erreurs',
  serveur: 'Le serveur',
  maintenance: 'La maintenance',
  // L'activité du 17 octobre 2026, refaite au QG 2 (lot 5) ; son adresse reste `#activite`, que des favoris gardent.
  activite: 'Les modes côte à côte',
  soirees: 'Les soirées',
  // « Les profils » et « Les joueurs » se ressemblaient : pour trouver Léa, lequel ? Celle-ci cherche quelqu'un ; l'adresse reste.
  profils: 'Chercher un joueur',
  salons: 'Les salons',
  catalogue: 'Le catalogue',
  jour: 'Le quiz du jour',
  campagne: 'La campagne',
  cabinet: 'Le Cabinet de curiosités',
  duels: 'Les duels',
  economie: 'L’économie',
  signalements: 'Les signalements',
  annonces: 'Les annonces',
  affiches: 'Les nouveautés',
  base: 'La base et le miroir',
  direct: 'En direct',
  alertes: 'Les alertes et les incidents',
  joueurs: 'Les joueurs',
  telephones: 'Les téléphones',
  questions: 'Les questions',
  reserves: 'Les réserves et la base',
}

/** Une page du rail : son écran, son nom court, son icône — une par page —, ce qu'on y trouve, et d'autres mots qui y mènent. */
interface PageDuRail {
  ecran: Ecran | null
  nom: string
  icone: IconName
  /** En une ligne : sous son nom dans la feuille « Pages », au survol du rail, et ce que la palette cherche. */
  description: string
  /** Ce qu'on tape dans la palette pour y venir sans connaître son nom : « turso », « bandeau ». */
  mots?: string
}

/**
 * Le rail, en six groupes rangés par moment d'usage (la revue d'ergonomie du
 * 4 novembre 2026, qui corrigeait la proposition du 3 : ranger par nature de
 * données faisait traiter une panne sur trois groupes) — commander, connaître
 * son audience, ses modes, son contenu, la technique, animer ; la vue
 * d'ensemble, le poste de commande, est `null`. Une icône par page : l'œil
 * disait « En direct » et « Joueurs », le triangle « Maintenance » et les
 * alertes. Seules les pages qui existent : une page rejoint le rail quand elle
 * est là, jamais avant (règle `qg.md`). La feuille « Pages » du téléphone et
 * la palette le lisent : mêmes groupes, mêmes noms, même ordre.
 */
const PAGES_DU_QG: { groupe: string; pages: PageDuRail[] }[] = [
  {
    groupe: 'Commande',
    pages: [
      { ecran: null, nom: 'Poste de commande', icone: 'bar-chart', description: 'L’état du service, ce qui attend, la période', mots: 'accueil tableau de bord vue d’ensemble' },
      { ecran: 'direct', nom: 'En direct', icone: 'eye', description: 'À la seconde : qui joue, le fil, les routes', mots: 'temps réel maintenant' },
      { ecran: 'alertes', nom: 'Alertes', icone: 'bell', description: 'Les règles, leurs seuils, les incidents', mots: 'incidents seuils téléphone prévenir' },
      // Une panne se voit, se comprend, se ferme et se dit sans changer de groupe : les erreurs et la maintenance à côté
      // des alertes — la maintenance était le dernier lien d'« Animer ».
      { ecran: 'erreurs', nom: 'Erreurs', icone: 'x-circle', description: 'Les trier, en être prévenu', mots: 'panne bogue plantage' },
      { ecran: 'maintenance', nom: 'Maintenance', icone: 'lock', description: 'Le bandeau, les pages fermées, les testeurs', mots: 'fermer bandeau masquer bientôt testeurs' },
      { ecran: 'journal', nom: 'Journal', icone: 'clipboard', description: 'Tes gestes, un par un', mots: 'historique gestes' },
    ],
  },
  {
    groupe: 'Audience',
    pages: [
      // En tête : combien jouent, combien reviennent, qui décroche — puis chacun, qu'on cherche par son nom.
      { ecran: 'joueurs', nom: 'Joueurs', icone: 'users', description: 'Fidélité, cohortes, segments', mots: 'audience rétention actifs reviennent' },
      { ecran: 'profils', nom: 'Chercher un joueur', icone: 'search', description: 'Sa fiche : offrir, débloquer, suspendre', mots: 'profil profils fiche confettis code secours' },
      { ecran: 'salons', nom: 'Salons', icone: 'home', description: 'Les espaces des animateurs : renommer, fermer', mots: 'animateurs espaces' },
    ],
  },
  {
    groupe: 'Modes',
    pages: [
      { ecran: 'activite', nom: 'Côte à côte', icone: 'hash', description: 'Réussite, durée, retour à J+7', mots: 'activité comparer' },
      { ecran: 'soirees', nom: 'Soirées', icone: 'glass', description: 'En cours, laissées en plan, le mois', mots: 'soirée clore' },
      { ecran: 'jour', nom: 'Quiz du jour', icone: 'sun', description: 'Les parties, le public, le rappel du soir', mots: 'rappel propositions' },
      { ecran: 'campagne', nom: 'Campagne', icone: 'target', description: 'Sentiers, paliers, défi de la semaine', mots: 'sentiers paliers défi' },
      { ecran: 'cabinet', nom: 'Cabinet', icone: 'landmark', description: 'Traversées, jeux, gardiens', mots: 'curiosités' },
      { ecran: 'duels', nom: 'Duels', icone: 'swords', description: 'Ligues, classement, en attente', mots: 'duel ligues' },
      // L'économie vit de ce que les modes rapportent et de ce qu'on y dépense : avec eux plutôt qu'avec l'audience.
      { ecran: 'economie', nom: 'Économie', icone: 'bag', description: 'Confettis, ventes, Éclats', mots: 'boutique achats' },
    ],
  },
  {
    groupe: 'Contenu',
    pages: [
      // Ce que chaque question jouée donne vraiment, puis ce qui nourrit les modes : les deux pages du lot 7.
      { ecran: 'questions', nom: 'Questions', icone: 'bulb', description: 'Jouées, contredites, pièges' },
      { ecran: 'reserves', nom: 'Réserves et base', icone: 'book', description: 'La réserve du jour, la base, le Cabinet', mots: 'réserve stock' },
      { ecran: 'signalements', nom: 'Signalements', icone: 'flag', description: 'Corriger, reclasser' },
      { ecran: 'catalogue', nom: 'Catalogue', icone: 'globe', description: 'Les copies proposées : relire, publier', mots: 'partage modèles' },
    ],
  },
  {
    groupe: 'Technique',
    pages: [
      { ecran: 'serveur', nom: 'Serveur', icone: 'zap', description: 'Signaux, routes, temps réel, gels, versions', mots: 'lent gel processeur mémoire' },
      // Sortie du serveur, où elle se perdait : Turso, son quota, le miroir de chaque salon, les sauvegardes.
      { ecran: 'base', nom: 'Base et miroir', icone: 'archive', description: 'Turso, son quota, la sauvegarde des soirées', mots: 'turso quota miroir sauvegarde' },
      // Ce que vivent les téléphones des joueurs : le serveur vu d'en face.
      { ecran: 'telephones', nom: 'Téléphones', icone: 'smartphone', description: 'Affichage, réponse au doigt, sauts, erreurs', mots: 'appareils ressenti' },
    ],
  },
  {
    groupe: 'Animer',
    pages: [
      { ecran: 'annonces', nom: 'Annonces', icone: 'megaphone', description: 'Un mot à tous, des confettis', mots: 'message écrire' },
      { ecran: 'affiches', nom: 'Nouveautés', icone: 'sparkles', description: 'Une affiche, « Nouveau » sur un bouton', mots: 'affiche' },
    ],
  },
]

/** Les groupes du rail qu'on a repliés ou dépliés soi-même, retenus d'une visite à l'autre (une préférence de ce navigateur). */
const CLE_DES_GROUPES = 'quizz.qg-groupes'

function lireLesGroupes(): Record<string, boolean> {
  try {
    const lu: unknown = JSON.parse(localStorage.getItem(CLE_DES_GROUPES) ?? '{}')
    return lu && typeof lu === 'object' ? (lu as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/**
 * Les pages qui lisent la période de la barre, celles qu'elles offrent, et si
 * elles comparent à la période d'avant. Le serveur ne garde que huit jours :
 * trente jours n'y sont pas, et la période retenue au-delà s'y lit en semaine.
 */
const PERIODES_DES_PAGES: Partial<Record<Ecran | 'poste', { periodes: readonly PeriodeDuQg[]; comparer: boolean }>> = {
  poste: { periodes: PERIODES_DU_QG, comparer: true },
  serveur: { periodes: ['1h', '24h', '7j'], comparer: false },
  base: { periodes: ['1h', '24h', '7j'], comparer: false },
  telephones: { periodes: ['1h', '24h', '7j'], comparer: false },
  // Les modes (le QG 2, lot 5) : côte à côte, une table — rien à poser en filet ; chaque page de mode, son gabarit et sa
  // courbe — le Cabinet aussi, sa courbe seule : ses tuiles restent les siennes, sur trente jours.
  activite: { periodes: PERIODES_DU_QG, comparer: false },
  soirees: { periodes: PERIODES_DU_QG, comparer: true },
  jour: { periodes: PERIODES_DU_QG, comparer: true },
  campagne: { periodes: PERIODES_DU_QG, comparer: true },
  cabinet: { periodes: PERIODES_DU_QG, comparer: true },
  duels: { periodes: PERIODES_DU_QG, comparer: true },
}

/**
 * Les pages qui ne suivent pas la période de la barre, et la fenêtre qu'elles
 * lisent à la place : la barre la montre, grisée, où serait la période. Venu
 * du poste de commande sur « 7 j », on lisait l'économie du jour sans en être
 * averti (la revue d'ergonomie du 4 novembre 2026).
 */
const FENETRE_PROPRE: Partial<Record<Ecran, string>> = { economie: 'Aujourd’hui · 30 j', joueurs: 'Jour · 7 j · 30 j', alertes: '30 j', erreurs: '7 j' }

/** À quoi « Comparer » compare : « Comparer » seul ne disait pas à quoi. */
const LA_PERIODE_D_AVANT: Record<PeriodeDuQg, string> = { '1h': 'l’heure d’avant', '24h': 'la veille', '7j': 'la semaine d’avant', '30j': 'le mois d’avant' }

/**
 * Le direct arrive par son flux, toutes les deux secondes (`qgFlux.ts`) ; muet,
 * il se relit toutes les dix secondes — en mémoire et dans la base locale,
 * sans un aller-retour vers Turso. La vue d'ensemble, qui lit Turso, toutes
 * les cinq minutes, et en revenant d'une page : un QG reste ouvert sur un
 * écran toute la journée, et chaque relecture compte au quota. Rien tant que
 * l'onglet est caché.
 */
const DIRECT_MS = 10_000
const VUE_MS = 300_000

/** « ⌘K » sur un Mac, « Ctrl K » ailleurs : sous Windows, le symbole ne voulait rien dire. */
const RACCOURCI = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

export function AdminApp() {
  const { toast } = useAppState()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [ecran, setEcran] = useState<Ecran | null>(() => lireAdresse().ecran)
  const [onglet, setOnglet] = useState<string | null>(() => lireAdresse().onglet)
  const [direct, setDirect] = useState<DirectDuQg | null>(null)
  const [directEnPanne, setDirectEnPanne] = useState(false)
  const [vue, setVue] = useState<VueDEnsemble | null>(null)
  const [vueEnPanne, setVueEnPanne] = useState(false)
  const [espaces, setEspaces] = useState<EspaceDAdministration[]>()
  /** Le bandeau et les pages fermées : le rail les rappelle, de toutes les pages — on ne laisse pas une page fermée sans le voir. */
  const [maintenance, setMaintenance] = useState<EtatDeLaMaintenance | null>(null)
  const [periode, setPeriode] = usePeriodeDuQg()
  const [comparer, setComparer] = useComparaisonDuQg()
  /** Ce qui s'ouvre par-dessus la page : la liste des pages, ce qui attend un geste, la période au téléphone, la palette, la fiche d'un joueur. */
  const [toutes, setToutes] = useState(false)
  const [aTraiterOuvert, setATraiterOuvert] = useState(false)
  const [periodesOuvertes, setPeriodesOuvertes] = useState(false)
  const [palette, setPalette] = useState(false)
  const [fiche, setFiche] = useState<Pick<ProfilDAdministration, 'id' | 'nom'> | null>(null)
  /** Le segment des joueurs à qui la page des annonces s'ouvre pour écrire (« Leur écrire ») ; null, à tous. */
  const [segmentDesAnnonces, setSegmentDesAnnonces] = useState<SegmentDuQg | null>(null)
  /** Les questions que la page des questions montre, retenues d'une page à l'autre : la campagne et les réserves l'ouvrent sur les contredites. */
  const [questionsSur, setQuestionsSur] = useState<EtatDesQuestions>('toutes')
  const [groupes, setGroupes] = useState<Record<string, boolean>>(lireLesGroupes)
  const titre = useRef<HTMLHeadingElement>(null)
  const corps = useRef<HTMLElement>(null)
  const premierRendu = useRef(true)
  // Les sections de la page ouverte, lues dans la page : son sommaire, sur une longue page.
  const sections = useSommaire(corps, `${ecran}|${onglet}|${!!me}`)
  // Une lecture à la fois : l'hébergeur qui se réveille tient une requête trente secondes.
  const enVol = useRef({ direct: false, vue: false })
  const derniereVue = useRef(0)
  const estAdmin = me?.account.role === 'admin'
  // Le direct par le flux, toutes les deux secondes (`qgFlux.ts`) : le poste de commande ne se redessine que quand il
  // change ; muet, la relecture de dix secondes reprend.
  const directDuFlux = useSyncExternalStore(fluxDuQg.abonner, () => fluxDuQg.lire().direct)
  const fluxVivant = useSyncExternalStore(fluxDuQg.abonner, fluxDuQg.estVivant)
  useEffect(() => (estAdmin ? fluxDuQg.demarrer() : undefined), [estAdmin])
  useEffect(() => {
    if (!directDuFlux) return
    setDirect(directDuFlux)
    setDirectEnPanne(false)
  }, [directDuFlux])

  const relireLeDirect = () => {
    if (enVol.current.direct) return
    enVol.current.direct = true
    api.admin
      .qgDirect()
      .then(
        d => {
          setDirect(d)
          setDirectEnPanne(false)
        },
        () => setDirectEnPanne(true),
      )
      .finally(() => (enVol.current.direct = false))
  }
  const relireLaVue = () => {
    if (enVol.current.vue) return
    enVol.current.vue = true
    derniereVue.current = Date.now()
    api.admin
      .qg()
      .then(
        v => {
          setVue(v)
          setVueEnPanne(false)
        },
        () => setVueEnPanne(true),
      )
      .finally(() => (enVol.current.vue = false))
  }
  /**
   * Les salons et la maintenance, relus en revenant au poste de commande : on y a peut-être supprimé, rattaché, rouvert.
   * Plus de compte des profils : le rail ne montre plus d'inventaire, seulement ce qui attend un geste.
   */
  const relireLesComptes = () => {
    api.admin.espaces().then(setEspaces, () => {})
    api.admin.maintenance().then(setMaintenance, () => {})
  }

  useEffect(() => {
    api.auth
      .me()
      .then(m => {
        setMe(m)
        if (m.account.role !== 'admin') setError('Cette page est réservée à l’administrateur.')
      })
      .catch(e => {
        if (e instanceof UnauthorizedError) window.location.replace('/connexion?next=/admin')
        else setError((e as Error).message)
      })
    // Le retour du navigateur referme l'écran ouvert, comme celui du profil — et rouvre l'onglet qu'il avait.
    const auRetour = () => {
      const a = lireAdresse()
      setEcran(a.ecran)
      setOnglet(a.onglet)
    }
    window.addEventListener('popstate', auRetour)
    return () => window.removeEventListener('popstate', auRetour)
  }, [])

  useEffect(() => {
    if (!estAdmin) return
    relireLeDirect()
    relireLaVue()
    relireLesComptes()
    const visible = () => document.visibilityState === 'visible'
    const relire = () => {
      if (!visible()) return
      // Le flux vivant porte le direct : la relecture n'est que son relais.
      if (!fluxDuQg.estVivant()) relireLeDirect()
      if (Date.now() - derniereVue.current >= VUE_MS) relireLaVue()
    }
    // De retour sur l'onglet, sans attendre le tour suivant : le direct, et la vue si elle date.
    const tour = setInterval(relire, DIRECT_MS)
    document.addEventListener('visibilitychange', relire)
    return () => {
      clearInterval(tour)
      document.removeEventListener('visibilitychange', relire)
    }
  }, [estAdmin])

  // La palette de partout : ⌘K, Ctrl+K, ou « / » hors d'un champ — jamais par-dessus une fenêtre déjà ouverte.
  useEffect(() => {
    if (!estAdmin) return
    const touche = (e: KeyboardEvent) => {
      const dansUnChamp = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      const raccourci = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)
      if (!raccourci && !(e.key === '/' && !dansUnChamp && !e.metaKey && !e.ctrlKey && !e.altKey)) return
      if (document.querySelector('.carte-voile, .dialog-backdrop')) return
      e.preventDefault()
      setPalette(true)
    }
    document.addEventListener('keydown', touche)
    return () => document.removeEventListener('keydown', touche)
  }, [estAdmin])

  // Une page ouverte se dit : le focus sur son titre — le lecteur d'écran l'annonce, le Tab suivant part de là
  // (`aller` remontait la page, sans plus). Pas au premier rendu : la page qu'on ouvre garde le focus où le navigateur le pose.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false
      return
    }
    titre.current?.focus({ preventScroll: true })
  }, [ecran])

  const instant = direct?.maintenant ?? vue?.maintenant
  const choses = lesChosesATraiter(vue?.aTraiter ?? null, direct, instant)
  const nomDeLEcran = ecran ? TITRE[ecran] : 'Poste de commande'
  // L'onglet du navigateur dit la page et ce qui attend : deux onglets du QG ne se confondent plus.
  useEffect(() => {
    if (!me || error) return
    document.title = `${choses.length > 0 ? `(${formatNumber(choses.length)}) ` : ''}${nomDeLEcran} · QG`
  }, [me, error, choses.length, nomDeLEcran])

  /** Une page du QG, à son adresse — l'onglet compris : le rail y va de l'une à l'autre, le retour du navigateur revient. */
  const aller = (e: Ecran | null, o?: string) => {
    setToutes(false)
    setATraiterOuvert(false)
    // Les annonces ouvertes d'ailleurs que « Leur écrire » repartent à tous.
    if (e !== 'annonces') setSegmentDesAnnonces(null)
    if (e === ecran && (o ?? null) === onglet) return
    history.pushState({ ...history.state, depuisAdmin: true }, '', adresseDe(e, o))
    setEcran(e)
    setOnglet(o ?? null)
    if (e === null) {
      relireLesComptes()
      relireLaVue()
    }
    window.scrollTo(0, 0)
  }
  /** Un onglet choisi dans la page : l'adresse le retient, sans une étape de plus au retour du navigateur. */
  const changerDOnglet = (o: string) => {
    setOnglet(o)
    history.replaceState(history.state, '', adresseDe(ecran, o))
  }
  /** « ← », au téléphone : d'un cran si l'écran a été ouvert d'ici ; venu d'un lien, on remplace l'adresse. */
  const revenir = () => {
    if (history.state?.depuisAdmin) history.back()
    else history.replaceState(history.state, '', '/admin')
    setEcran(null)
    setOnglet(null)
    relireLesComptes()
    relireLaVue()
    window.scrollTo(0, 0)
  }
  const basculerLeGroupe = (groupe: string, ouvert: boolean) => {
    const suite = { ...groupes, [groupe]: ouvert }
    setGroupes(suite)
    try {
      localStorage.setItem(CLE_DES_GROUPES, JSON.stringify(suite))
    } catch {
      // Un stockage refusé : le rail se replie quand même, le temps de la visite.
    }
  }

  if (error) {
    // « Réservée à l'administrateur », et rien d'autre : l'animateur venu
    // d'un vieux lien restait devant une phrase (lot 12).
    return (
      <main className="center-page">
        <div className="impasse">
          <p className="error">{error}</p>
          <div className="row">
            <a className="btn btn-ghost" href="/">
              <Icon name="home" />
              L’accueil
            </a>
            {me && (
              <a className="btn btn-ghost" href="/compte">
                <Icon name="users" />
                Mon compte
              </a>
            )}
          </div>
        </div>
      </main>
    )
  }
  if (!me) {
    return (
      <main className="center-page">
        <p className="serif-note">Chargement…</p>
      </main>
    )
  }

  const reserve = vue?.aTraiter.reserve
  // Les questions à relire aux deux modes : la pastille de leur page les compte, pas la ligne qui les annonce.
  const signalees = vue ? vue.aTraiter.signalementsDuJour.questions + vue.aTraiter.signalementsDeLaCampagne.questions : 0
  const aRelire = vue?.aTraiter.catalogue ?? 0
  const duPublic = vue?.aTraiter.propositions ?? 0
  const alertesOuvertes = vue?.aTraiter.alertes?.length ?? 0
  const enCours = direct?.soirees.filter(s => s.etat === 'en-cours').length ?? 0
  const enPlan = direct?.soirees.filter(s => s.etat === 'en-plan').length ?? 0
  // Ce qui est posé — le bandeau, les pages fermées — se compte en rouge : rien ne se rouvre de lui-même. Une page
  // bientôt disponible se dit sans rouge : elle attend son heure, rien n'y est cassé.
  const posees = maintenance ? ceQuiEstPose(maintenance) : 0
  const fermees = maintenance ? PAGES_EN_MAINTENANCE.filter(p => maintenance.pages[p] !== null).length : 0
  const bientot = maintenance ? PAGES_EN_MAINTENANCE.filter(p => maintenance.bientot[p] !== null).length : 0
  const enMaintenance = [
    maintenance?.bandeau && 'Bandeau affiché',
    fermees > 0 && `${fermees} page${fermees > 1 ? 's' : ''} fermée${fermees > 1 ? 's' : ''}`,
    bientot > 0 && `${bientot} bientôt disponible${bientot > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const lecture = PERIODES_DES_PAGES[ecran ?? 'poste']
  const lisLaPeriode = !!lecture
  const periodeDeLaPage = lecture && !lecture.periodes.includes(periode) ? lecture.periodes[lecture.periodes.length - 1] : periode
  const groupeDeLEcran = PAGES_DU_QG.find(g => g.pages.some(p => p.ecran === ecran))?.groupe ?? 'Commande'
  const pret = !!(vue || direct)

  /**
   * Ce qui attend un geste sur une page : combien, et sa gravité — la pire de ses lignes, celle des règles. Plus de
   * compte d'inventaire (« Profils 124 ») : au rail, un chiffre veut dire qu'on y a quelque chose à faire.
   */
  const enAttente = (e: Ecran | null): EnAttente => {
    if (e === 'maintenance') return { n: posees, gravite: posees > 0 ? 'critique' : null, lu: `: ${enMaintenance}` }
    if (e === 'signalements') return { n: signalees, gravite: signalees > 0 ? 'a-faire' : null, lu: 'à relire' }
    const siennes = e === null ? choses : choses.filter(c => c.ecran === e)
    return { n: siennes.length, gravite: pireGravite(siennes), lu: 'à traiter' }
  }
  /** Un groupe replié, ou la feuille entière, se résume à la somme de ses pastilles, à la couleur de la pire. */
  const sommeDe = (pages: readonly PageDuRail[]): EnAttente => {
    const lues = pages.filter(p => p.ecran !== null).map(p => enAttente(p.ecran))
    const graves = lues.flatMap(l => (l.gravite && l.n > 0 ? [{ gravite: l.gravite }] : []))
    return { n: lues.reduce((n, l) => n + (l.gravite ? l.n : 0), 0), gravite: pireGravite(graves), lu: 'en attente' }
  }
  const toutesLesPages = PAGES_DU_QG.flatMap(g => g.pages)
  /** Ce qu'une page dit d'elle dans la feuille « Pages » : ce qui s'y passe quand il y a lieu, sinon ce qu'on y trouve. */
  const ditDe = (p: PageDuRail): string => {
    const pl = (n: number) => (n > 1 ? 's' : '')
    if (p.ecran === 'soirees' && (enPlan > 0 || enCours > 0)) return enPlan > 0 ? `${enPlan} laissée${pl(enPlan)} en plan` : `${enCours} en cours`
    if (p.ecran === 'alertes' && alertesOuvertes > 0) return `${alertesOuvertes} règle${pl(alertesOuvertes)} ouverte${pl(alertesOuvertes)}`
    if (p.ecran === 'maintenance' && enMaintenance) return enMaintenance
    if (p.ecran === 'jour' && duPublic > 0) return `${duPublic} question${pl(duPublic)} du public à relire`
    if (p.ecran === 'reserves' && reserve) return `${reserve.joursDAvance} jour${pl(reserve.joursDAvance)} d’avance au quiz du jour`
    if (p.ecran === 'catalogue' && aRelire > 0) return `${aRelire} copie${pl(aRelire)} à relire`
    if (p.ecran === 'signalements' && signalees > 0) return `${signalees} question${pl(signalees)} à relire`
    return p.description
  }
  const versLeRail = (e: Ecran | null) => (ev: MouseEvent) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
    ev.preventDefault()
    aller(e)
  }

  // Au pied du rail et de la feuille « Pages » : de quoi sortir du QG. Un administrateur sans profil n'a pas d'accueil à
  // lui : sa barre garde l'écran commun et l'historique.
  const sortir = me.profil ? (
    <span className="qg-sortir">
      <a className="lien-discret" href="/">
        <Icon name="home" />
        L’accueil
      </a>
      <a className="lien-discret" href="/compte">
        <Icon name="users" />
        Mon compte
      </a>
    </span>
  ) : (
    <NavAnimateur ici="admin" slug={me.space.slug} admin />
  )

  /** Toutes les pages, en ses groupes, chacune ce qui s'y passe et ce qui y attend : la feuille « Pages » du téléphone. */
  const listeDesPages = (
    <div className="qg-pages-liste">
      {PAGES_DU_QG.map(({ groupe, pages }) => (
        <section key={groupe} className="qg-pages-groupe" aria-label={groupe}>
          <h3 className="qg-groupe-titre">{groupe}</h3>
          <ul>
            {pages.map(p => (
              <li key={p.nom}>
                <LienDuQg ici={ecran === p.ecran} href={adresseDe(p.ecran)} icone={p.icone} onAller={() => aller(p.ecran)} className="qg-page-ligne">
                  <span className="qg-page-texte">
                    <b>{p.nom}</b>
                    <span className="qg-page-dit">{ditDe(p)}</span>
                  </span>
                  <Pastille {...enAttente(p.ecran)} />
                </LienDuQg>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="qg-pages-pied">{sortir}</div>
    </div>
  )

  return (
    // Un prénom de joueur, sur n'importe quelle page du QG, ouvre sa fiche ici (`PrenomDuJoueur`).
    <OuvrirLaFiche.Provider value={setFiche}>
    <div className="player-shell compte admin qg">
      {/* La barre de commande, collée en haut : où l'on est, la période de la page, le direct, ce qui attend, la palette. */}
      <header className="qg-commande">
        <span className="qg-ariane">
          {groupeDeLEcran} <span aria-hidden="true">›</span> <b>{nomDeLEcran}</b>
        </span>
        {lecture && (
          <>
            <div className="qg-periodes" role="group" aria-label="La période de la page">
              {lecture.periodes.map(p => (
                <button key={p} type="button" aria-pressed={periodeDeLaPage === p} title={`Voir ${PERIODE_EN_TOUTES_LETTRES[p]}`} onClick={() => setPeriode(p)}>
                  {NOM_DE_LA_PERIODE[p]}
                </button>
              ))}
            </div>
            {/* Au téléphone, la période tient dans un bouton : sa rangée collée prenait la moitié de la barre. */}
            <button type="button" className="qg-bouton qg-periode-courte" aria-haspopup="dialog" onClick={() => setPeriodesOuvertes(true)}>
              <Icon name="clock" />
              {NOM_DE_LA_PERIODE[periodeDeLaPage]}
              <span className="sr-only">, la période de la page{lecture.comparer && comparer ? `, comparée à ${LA_PERIODE_D_AVANT[periodeDeLaPage]}` : ''}</span>
              <Icon name="chevron-down" />
            </button>
          </>
        )}
        {!lecture && ecran && FENETRE_PROPRE[ecran] && (
          <span className="qg-periode-propre" title="Cette page ne suit pas la période de la barre : elle lit sa propre fenêtre">
            <Icon name="clock" />
            {FENETRE_PROPRE[ecran]}
            <span className="sr-only"> : cette page ne suit pas la période de la barre</span>
          </span>
        )}
        {lecture?.comparer && (
          <button type="button" className="qg-bascule" aria-pressed={comparer} onClick={() => setComparer(!comparer)} title="La période d’avant en filet sur le graphique">
            <span className="qg-interrupteur" aria-hidden="true" />
            Comparer à {LA_PERIODE_D_AVANT[periodeDeLaPage]}
          </button>
        )}
        <span className="qg-commande-droite">
          <EnDirect direct={direct} enPanne={directEnPanne} vivant={fluxVivant} ouvrir={() => aller('direct')} ici={ecran === 'direct'} />
          <BoutonATraiter n={choses.length} pire={pireGravite(choses)} pret={pret} onClick={() => setATraiterOuvert(true)} />
          <button type="button" className="qg-bouton qg-chercher" onClick={() => setPalette(true)} aria-label={`Aller à… (${RACCOURCI})`}>
            <Icon name="search" />
            <span className="qg-a-l-ordinateur">Aller à…</span>
            <kbd className="qg-a-l-ordinateur">{RACCOURCI}</kbd>
          </button>
        </span>
      </header>

      {/* La tête : au téléphone, le retour au poste et le titre sur une ligne ; à l'ordinateur, le groupe, le titre, l'heure. */}
      <header className="qg-tete">
        {ecran ? (
          <a
            className="qg-tete-retour"
            href="/admin"
            aria-label="Le poste de commande"
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              revenir()
            }}
          >
            <Icon name="arrow-left" />
          </a>
        ) : (
          <span className="qg-quand">{instant ? `${jourEnToutesLettres(jourDe(instant))} · ${heureEcrite(instant)}` : 'Toi seul'}</span>
        )}
        <div className="qg-titre">
          <span className="qg-surtitre">{groupeDeLEcran}</span>
          <h1 ref={titre} tabIndex={-1}>
            {nomDeLEcran}
          </h1>
        </div>
      </header>

      <nav className="qg-cote" aria-label="Les pages du QG">
        <div className="qg-marque">
          <span className="qg-marque-logo" aria-hidden="true">
            QG
          </span>
          <span className="qg-marque-nom">Le QG</span>
          {direct && <span className="etiquette qg-env">{direct.serveur.env === 'production' ? 'Production' : direct.serveur.env}</span>}
        </div>
        {PAGES_DU_QG.map(({ groupe, pages }) => {
          // Le groupe de la page ouverte l'est toujours ; « Commande » aussi, tant qu'on ne l'a pas replié ; les autres se
          // résument à leur titre et à la somme de leurs pastilles. Tout déplié, le rail cachait sept pages en 1366 × 768.
          const ici = groupe === groupeDeLEcran
          const ouvert = ici || (groupes[groupe] ?? groupe === 'Commande')
          return (
            <div key={groupe} className={'qg-groupe' + (ouvert ? '' : ' qg-groupe-replie')}>
              {ici ? (
                <span className="qg-groupe-titre">{groupe}</span>
              ) : (
                <button type="button" className="qg-groupe-titre" aria-expanded={ouvert} onClick={() => basculerLeGroupe(groupe, !ouvert)}>
                  <Icon name="chevron-down" />
                  {groupe}
                  {!ouvert && <Pastille {...sommeDe(pages)} />}
                </button>
              )}
              {ouvert &&
                pages.map(p => (
                  <LienDuQg key={p.nom} ici={ecran === p.ecran} href={adresseDe(p.ecran)} icone={p.icone} onAller={() => aller(p.ecran)} titre={p.description}>
                    {p.nom}
                    <Pastille {...enAttente(p.ecran)} />
                  </LienDuQg>
                ))}
            </div>
          )
        })}
        <div className="qg-cote-pied">{sortir}</div>
      </nav>

      <main className="page-corps" ref={corps}>
        {/* Une longue page a son sommaire ; le poste de commande se lit d'un coup d'œil. */}
        {ecran !== null && <SommaireDeLaPage titres={sections} />}
        {ecran === null && (
          <VueDEnsembleDuQg vue={vue} direct={direct} vueEnPanne={vueEnPanne} directEnPanne={directEnPanne} ouvrir={aller} periode={periode} comparer={comparer} />
        )}
        {/* La seconde du serveur, poussée par le flux : ses compteurs mènent au serveur, à ce qui gèle et aux erreurs. */}
        {ecran === 'direct' && <QgEnDirect ouvrir={aller} />}
        {/* Les règles et leurs seuils, les incidents : une règle touchée ouvre la page où l'on agit, à son onglet. */}
        {ecran === 'alertes' && <QgAlertes ouvrir={aller} />}
        {ecran === 'journal' && <QgJournal />}
        {/* Un tri change ce qui sonne : la ligne de « À traiter », et la pastille du rail, se relisent. */}
        {ecran === 'erreurs' && <QgErreurs apresUnTri={relireLaVue} versLaMaintenance={() => aller('maintenance')} />}
        {ecran === 'serveur' && (
          <QgServeur periode={periodeDuServeur(periodeDeLaPage)} versLesErreurs={() => aller('erreurs')} onglet={onglet} changerDOnglet={changerDOnglet} />
        )}
        {/* Le miroir de chaque salon et les sauvegardes, à côté de Turso et de son quota ; la période, celle de la barre. */}
        {ecran === 'base' && <QgBase periode={periodeDuServeur(periodeDeLaPage)} />}
        {/* Ce que vivent les téléphones des joueurs, sur la même période que le serveur, lu dans sa page. */}
        {ecran === 'telephones' && <QgTelephones periode={periodeDuServeur(periodeDeLaPage)} />}
        {/* Chaque geste rend l'état d'après : le rail le compte aussitôt. La panne réglée, l'annonce qui le dit à tous. */}
        {ecran === 'maintenance' && <QgMaintenance onEtat={setMaintenance} versLesAnnonces={() => aller('annonces')} />}
        {/* Écrire à un segment, depuis la page des joueurs : les annonces s'ouvrent sur lui. */}
        {ecran === 'annonces' && <QgAnnonces segment={segmentDesAnnonces} />}
        {ecran === 'joueurs' && (
          <QgJoueurs
            versLesAnnonces={segment => {
              setSegmentDesAnnonces(segment)
              aller('annonces')
            }}
          />
        )}
        {/* L'état de la maintenance : une page fermée, l'affiche le dit avant de la poser. */}
        {ecran === 'affiches' && <QgAffiches maintenance={maintenance} />}
        {/* Les modes côte à côte, et le gabarit de chaque page de mode : la période de la barre, la vue d'ensemble déjà lue. */}
        {ecran === 'activite' && <QgActivite periode={periodeDeLaPage} />}
        {/* Le direct de la page des soirées est celui du QG, relu toutes les dix secondes ; relu aussitôt après un geste. */}
        {ecran === 'soirees' && <QgSoirees direct={direct} apresUnGeste={relireLeDirect} vue={vue} periode={periodeDeLaPage} comparer={comparer} />}
        {ecran === 'profils' && <AdminProfils />}
        {ecran === 'salons' && <AdminSalons espaces={espaces} onChange={relireLesComptes} />}
        {ecran === 'catalogue' && <Catalogue />}
        {ecran === 'jour' && (
          <AdminDuJour
            vue={vue}
            versLesSignalements={() => aller('signalements')}
            versLesReserves={() => aller('reserves')}
            periode={periodeDeLaPage}
            comparer={comparer}
          />
        )}
        {ecran === 'campagne' && (
          <AdminCampagne
            vue={vue}
            versLesSignalements={() => aller('signalements')}
            versLesReserves={() => aller('reserves')}
            versLesContredites={() => {
              setQuestionsSur('contredites')
              aller('questions')
            }}
            periode={periodeDeLaPage}
            comparer={comparer}
          />
        )}
        {ecran === 'cabinet' && <QgCabinet versLaMaintenance={() => aller('maintenance')} vue={vue} periode={periodeDeLaPage} comparer={comparer} />}
        {ecran === 'duels' && <AdminDuels vue={vue} periode={periodeDeLaPage} comparer={comparer} />}
        {ecran === 'economie' && <AdminEconomie />}
        {/* Un geste referme des signalements : ce qui attend, et la pastille du rail, se relisent. */}
        {ecran === 'signalements' && <AdminSignalements apresUnGeste={relireLaVue} />}
        {/* Le contenu : un geste sur une question referme peut-être ses signalements, un apport éteint l'alerte de la réserve —
            ce qui attend, et les pastilles du rail, se relisent. */}
        {ecran === 'questions' && (
          <QgQuestions etat={questionsSur} changerDEtat={setQuestionsSur} apresUnGeste={relireLaVue} versLesSignalements={() => aller('signalements')} />
        )}
        {ecran === 'reserves' && (
          <QgReserves
            seuilDeLaReserve={vue?.aTraiter.seuilDeLaReserve}
            apresUnGeste={relireLaVue}
            versLesQuestions={e => {
              setQuestionsSur(e)
              aller('questions')
            }}
          />
        )}

        {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </main>

      {/* Au téléphone, la barre du QG sous le pouce : le poste, ce qui attend, le direct, toutes les pages. La barre du menu
          du joueur et la ligne de l'animateur prenaient la place de la console (la revue d'ergonomie du 4 novembre 2026). */}
      <nav className="qg-bas" aria-label="Le QG">
        <a className="qg-bas-lien" href="/admin" aria-current={ecran === null ? 'page' : undefined} onClick={versLeRail(null)}>
          <span className="qg-bas-icone">
            <Icon name="bar-chart" />
          </span>
          Poste
        </a>
        <button type="button" className="qg-bas-lien" aria-haspopup="dialog" onClick={() => setATraiterOuvert(true)}>
          <span className="qg-bas-icone">
            <Icon name="bell" />
            <Pastille {...enAttente(null)} />
          </span>
          À traiter
        </button>
        <a className="qg-bas-lien" href="/admin#direct" aria-current={ecran === 'direct' ? 'page' : undefined} onClick={versLeRail('direct')}>
          <span className="qg-bas-icone">
            <span className={'qg-vif-point' + (directEnPanne && !fluxVivant ? ' qg-vif-point-perdu' : '')} aria-hidden="true" />
          </span>
          Direct
        </a>
        <button type="button" className="qg-bas-lien qg-pages" aria-haspopup="dialog" onClick={() => setToutes(true)}>
          <span className="qg-bas-icone">
            <Icon name="list" />
            <Pastille {...sommeDe(toutesLesPages)} />
          </span>
          Pages
        </button>
      </nav>

      {toutes && (
        <Feuille titre="Les pages du QG" onFermer={() => setToutes(false)}>
          {listeDesPages}
        </Feuille>
      )}
      {aTraiterOuvert && (
        <Feuille titre="À traiter" onFermer={() => setATraiterOuvert(false)}>
          <ListeATraiter choses={choses} chargement={!pret && !vueEnPanne} ouvrir={aller} />
          {ecran !== null && (
            <button type="button" className="lien-discret qg-suite" onClick={() => aller(null)}>
              Le poste de commande
              <Icon name="chevron-right" />
            </button>
          )}
        </Feuille>
      )}
      {periodesOuvertes && lecture && (
        <Feuille titre="La période" onFermer={() => setPeriodesOuvertes(false)}>
          <div className="qg-periodes-feuille" role="group" aria-label="La période de la page">
            {lecture.periodes.map(p => (
              <button
                key={p}
                type="button"
                className="qg-bouton"
                aria-pressed={periodeDeLaPage === p}
                onClick={() => {
                  setPeriode(p)
                  setPeriodesOuvertes(false)
                }}
              >
                {PERIODE_EN_TOUTES_LETTRES[p].replace(/^./, c => c.toUpperCase())}
              </button>
            ))}
          </div>
          {lecture.comparer && (
            <button type="button" className="qg-bascule" aria-pressed={comparer} onClick={() => setComparer(!comparer)}>
              <span className="qg-interrupteur" aria-hidden="true" />
              Comparer à {LA_PERIODE_D_AVANT[periodeDeLaPage]}
            </button>
          )}
        </Feuille>
      )}
      {palette && (
        <PaletteDuQg
          pages={PAGES_DU_QG.flatMap(g => g.pages.map(p => ({ ecran: p.ecran, nom: p.nom, icone: p.icone, groupe: g.groupe, mots: `${p.description} ${p.mots ?? ''}` })))}
          gestes={GESTES_DE_LA_PALETTE}
          aller={aller}
          periode={lisLaPeriode ? periodeDeLaPage : null}
          periodes={lecture?.periodes ?? []}
          changerDePeriode={setPeriode}
          comparer={lecture?.comparer ? comparer : null}
          changerLaComparaison={setComparer}
          ouvrirLeProfil={setFiche}
          raccourci={RACCOURCI}
          onFermer={() => setPalette(false)}
        />
      )}
      {fiche && (
        <Feuille titre={fiche.nom} onFermer={() => setFiche(null)}>
          <FicheDuJoueurAuQg
            key={fiche.id}
            profil={fiche}
            onChange={f => setFiche({ id: f.id, nom: f.nom })}
            onSupprimer={p => {
              void supprimerLeProfil(p).then(fait => {
                if (!fait) return
                setFiche(null)
                relireLesComptes()
              })
            }}
          />
        </Feuille>
      )}
    </div>
    </OuvrirLaFiche.Provider>
  )
}

/**
 * Les gestes que la palette propose, qu'on cherche par ce qu'on veut faire plutôt que par la page : chacun ouvre la page
 * où il se fait (la revue d'ergonomie : « bandeau », « masquer », « réserve » ne trouvaient rien).
 */
const GESTES_DE_LA_PALETTE: { nom: string; icone: IconName; ecran: Ecran; mots: string }[] = [
  { nom: 'Fermer une page aux joueurs…', icone: 'lock', ecran: 'maintenance', mots: 'maintenance panne bandeau masquer' },
  { nom: 'Afficher un bandeau…', icone: 'alert', ecran: 'maintenance', mots: 'maintenance message panne' },
  { nom: 'Écrire une annonce à tous…', icone: 'megaphone', ecran: 'annonces', mots: 'message confettis' },
  { nom: 'Poser une affiche…', icone: 'sparkles', ecran: 'affiches', mots: 'nouveauté nouveau' },
  { nom: 'Offrir des confettis à un joueur…', icone: 'search', ecran: 'profils', mots: 'don cadeau profil' },
  { nom: 'Régler le seuil d’une alerte…', icone: 'bell', ecran: 'alertes', mots: 'seuil téléphone règle' },
  { nom: 'Verser des questions dans la réserve…', icone: 'book', ecran: 'reserves', mots: 'réserve quiz du jour stock' },
  { nom: 'Clore une soirée laissée en plan…', icone: 'glass', ecran: 'soirees', mots: 'soirée clôture' },
]

/** Ce qui attend un geste : combien, sa gravité, et ce que le lecteur d'écran lit après le chiffre. */
interface EnAttente {
  n: number
  gravite: GraviteDUneChose | null
  lu: string
}

/** Une pastille : un chiffre à la couleur de sa gravité — rouge ce qui casse, ambre ce qui est à surveiller, l'or d'une tâche. */
function Pastille({ n, gravite, lu }: EnAttente) {
  if (n <= 0 || !gravite) return null
  return (
    <span className={`qg-pastille qg-pastille-${gravite}`}>
      {formatNumber(n)}
      <span className="sr-only"> {lu}</span>
    </span>
  )
}

/**
 * La pastille de la barre : ce qui attend un geste, à la couleur de sa pire
 * ligne, et qui en ouvre la liste de n'importe quelle page. Elle comptait les
 * voyants pas au vert — « 1 à regarder », le processeur, en rouge — quand
 * quatre choses attendaient un geste sous la ligne de flottaison (la revue
 * d'ergonomie du 4 novembre 2026) ; les voyants restent l'état, au poste.
 */
function BoutonATraiter({ n, pire, pret, onClick }: { n: number; pire: GraviteDUneChose | null; pret: boolean; onClick: () => void }) {
  const etat = !pret ? 'inconnu' : (pire ?? 'ok')
  return (
    <button type="button" className={`qg-etat-pastille qg-etat-pastille-${etat}`} aria-haspopup="dialog" onClick={onClick}>
      <i className={`qg-voyant qg-voyant-${etat}`} aria-hidden="true" />
      {!pret ? 'À traiter…' : n > 0 ? `${formatNumber(n)} à traiter` : 'Rien à traiter'}
    </button>
  )
}

/**
 * « Direct » dans la barre : le pouls du serveur, qui ouvre la page « En direct ». Il bat quand le flux parle, reste
 * allumé quand la relecture de dix secondes prend le relais, et dit l'heure du dernier relevé quand plus rien ne vient.
 */
function EnDirect({ direct, enPanne, vivant, ouvrir, ici }: { direct: DirectDuQg | null; enPanne: boolean; vivant: boolean; ouvrir: () => void; ici: boolean }) {
  if (!direct && !enPanne && !vivant) return null
  const perdu = enPanne && !vivant
  return (
    <button type="button" className={'qg-vif' + (perdu ? ' qg-vif-perdu' : '') + (vivant ? ' qg-vif-flux' : '')} onClick={ouvrir} aria-current={ici ? 'page' : undefined}>
      <span className="qg-vif-point" aria-hidden="true" />
      {!perdu ? 'En direct' : direct ? `Dernier relevé à ${heureEcrite(direct.maintenant)}` : 'Le serveur ne répond pas'}
    </button>
  )
}

/** Un lien du rail et de la feuille « Pages » : une vraie adresse, pour l'onglet d'à côté ; un clic simple reste dans la page. */
function LienDuQg({
  ici,
  href,
  icone,
  onAller,
  titre,
  className = 'qg-lien',
  children,
}: {
  ici: boolean
  href: string
  icone: IconName
  onAller: () => void
  titre?: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      className={className}
      href={href}
      title={titre}
      aria-current={ici ? 'page' : undefined}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onAller()
      }}
    >
      <Icon name={icone} />
      {children}
    </a>
  )
}

/**
 * Le catalogue du serveur (`core/partages.ts`) : les copies que les
 * animateurs proposent à tous. Rien n'y paraît sans être relu ici — des
 * prénoms d'invités, des photos de proches n'ont rien à faire chez tout le
 * monde. Publiée, une copie arrive dans « Partir d'un modèle » de chaque
 * espace, avec le nom de son auteur.
 */
function Catalogue() {
  const [entrees, setEntrees] = useState<EntreeDuCatalogue[] | null>(null)
  const [relue, setRelue] = useState<{ id: string; questions: QuizQuestionDef[] } | null>(null)
  const [error, setError] = useState('')
  const charger = () =>
    api.admin
      .catalogue()
      .then(setEntrees)
      .catch(e => setError(motifDe(e)))
  useEffect(() => {
    charger()
  }, [])

  const changer = async (e: EntreeDuCatalogue, statut: StatutAuCatalogue) => {
    setError('')
    try {
      await api.admin.statutAuCatalogue(e.id, statut)
      await charger()
    } catch (err) {
      setError(motifDe(err))
    }
  }
  const relire = async (e: EntreeDuCatalogue) => {
    if (relue?.id === e.id) return setRelue(null)
    try {
      setRelue({ id: e.id, questions: (await api.admin.entreeDuCatalogue(e.id)).questions })
    } catch (err) {
      setError(motifDe(err))
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!entrees) return <p className="serif-note">Chargement…</p>
  const groupes: [string, EntreeDuCatalogue[]][] = [
    ['À relire', entrees.filter(e => e.statut === 'propose')],
    ['Publiées', entrees.filter(e => e.statut === 'publie')],
  ]
  return (
    <>
      <p className="muted small">
        Des copies que les animateurs proposent à tous. Publiée, une copie apparaît dans « Partir d’un modèle » de chaque espace, avec le
        nom de son auteur. Relis-la : pas de prénoms d’invités, pas de photos de proches.
      </p>
      {groupes.every(([, liste]) => liste.length === 0) && <p className="serif-note">Rien à relire pour l’instant.</p>}
      {groupes.map(
        ([titre, liste]) =>
          liste.length > 0 && (
            <section key={titre} className="admin-groupe" aria-label={titre}>
              <h2 className="compte-groupe">
                {titre} <span className="etiquette">{liste.length}</span>
              </h2>
              <ul className="admin-liste">
                {liste.map(e => (
                  <li key={e.id} className="admin-entree">
                    <div className="admin-entree-tete">
                      <span className="admin-entree-texte">
                        <b>{e.titre}</b>
                        <span className="muted small">
                          de {e.auteur} · {e.questionCount} questions · {formatDay(e.updatedAt)}
                        </span>
                        {e.description && <span className="muted small">{e.description}</span>}
                      </span>
                    </div>
                    <div className="admin-gestes">
                      <button type="button" className="salon-geste" aria-expanded={relue?.id === e.id} onClick={() => relire(e)}>
                        <Icon name="eye" />
                        Relire
                      </button>
                      {e.statut === 'propose' && (
                        <>
                          <button type="button" className="salon-geste admin-geste-oui" onClick={() => changer(e, 'publie')}>
                            <Icon name="check" />
                            Publier
                          </button>
                          <button type="button" className="salon-geste" onClick={() => changer(e, 'refuse')}>
                            <Icon name="x" />
                            Refuser
                          </button>
                        </>
                      )}
                      {e.statut === 'publie' && (
                        <button type="button" className="salon-geste" onClick={() => changer(e, 'retire')}>
                          <Icon name="x" />
                          Retirer
                        </button>
                      )}
                    </div>
                    {relue?.id === e.id && (
                      <ol className="catalogue-questions">
                        {relue.questions.map((q, i) => (
                          <li key={q.id ?? i}>
                            {q.image && <img className="catalogue-photo" src={q.image} alt="" loading="lazy" />}
                            <span>{q.text}</span>{' '}
                            <span className="muted small">
                              {q.kind === 'number'
                                ? `= ${q.target ?? '?'} ${q.unit}`
                                : q.answers.filter(Boolean).map((a, j) => (
                                    <span key={j} className={j === q.correct ? 'catalogue-juste' : undefined}>
                                      {j > 0 && ' · '}
                                      {a}
                                    </span>
                                  ))}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </>
  )
}

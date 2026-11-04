import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { VueDEnsembleDuQg } from '../components/QgVueDEnsemble'
import { QgJournal } from '../components/QgJournal'
import { QgSoirees } from '../components/QgSoirees'
import { QgServeur } from '../components/QgServeur'
import { QgBase } from '../components/QgBase'
import { QgErreurs } from '../components/QgErreurs'
import { QgActivite } from '../components/QgActivite'
import { QgMaintenance } from '../components/QgMaintenance'
import { QgAnnonces } from '../components/QgAnnonces'
import { QgAffiches } from '../components/QgAffiches'
import { FicheDuJoueurAuQg } from '../components/QgFicheJoueur'
import { PaletteDuQg } from '../components/QgPalette'
import { Feuille, MenuBarre, Sortie } from '../components/Pieces'
import { useAppState } from '../state'
import { useNouveautesDuMenu } from '../nouveautes'
import { useComparaisonDuQg, usePeriodeDuQg } from '../qgPeriode'
import { formatDay } from '../../../shared/archive'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { heureEcrite, lesChosesATraiter, type DirectDuQg, type VueDEnsemble } from '../../../shared/qg'
import { NOM_DE_LA_PERIODE, PERIODES_DU_QG, PERIODE_EN_TOUTES_LETTRES, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import { periodeDuServeur } from '../../../shared/santeDuServeur'
import { etatDuService, phraseDeLEtat } from '../../../shared/qgEtat'
import type { EspaceDAdministration } from '../../../shared/space'
import { ceQuiEstPose, PAGES_EN_MAINTENANCE, type EtatDeLaMaintenance } from '../../../shared/maintenance'
import type { EntreeDuCatalogue, StatutAuCatalogue } from '../../../shared/partage'
import type { QuizQuestionDef } from '../../../shared/library'
import type { ProfilDAdministration } from '../../../shared/profil'

/**
 * Le QG de l'administrateur (`/admin`), pour lui seul — le souhait du
 * propriétaire du 13 octobre 2026 : « un vrai QG pour monitorer tous les
 * modes de jeu et avoir un vrai impact dessus ». Depuis le 4 novembre 2026,
 * le QG 2 (la proposition du 3, `retours/2026-11-03/le-qg.md`, que le
 * propriétaire a faite sienne : « suis tes recommandations […] pratique sur
 * mobile ») : une salle de contrôle nocturne sous tous les thèmes — elle ne
 * porte pas celui du profil (`main.tsx`) —, un rail en six groupes, une barre
 * de commande collée en haut qui dit où l'on est, la période de la page qui en
 * lit une, l'état du service et la palette (⌘K) ; le poste de commande
 * d'abord (`QgVueDEnsemble.tsx`), puis une page par sujet, chacune à son
 * adresse (`/admin#jour`). Au téléphone, la barre se resserre — « Pages » ouvre
 * la liste de toutes les pages, qui suit aussi le poste de commande — et la
 * barre du menu reste en bas ; à l'ordinateur, le rail.
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
  | 'duels'
  | 'economie'
  | 'signalements'
  | 'annonces'
  | 'affiches'
  | 'base'
const ECRANS: readonly Ecran[] = ['journal', 'erreurs', 'serveur', 'maintenance', 'activite', 'soirees', 'profils', 'salons', 'catalogue', 'jour', 'campagne', 'duels', 'economie', 'signalements', 'annonces', 'affiches', 'base']
/** Les ancres de la page d'avant, qu'un favori garde encore. */
const ANCIENNES: Record<string, Ecran> = { 'les-profils': 'profils', 'quiz-du-jour': 'jour' }

function lireEcran(): Ecran | null {
  const h = window.location.hash.slice(1)
  return (ECRANS as readonly string[]).includes(h) ? (h as Ecran) : (ANCIENNES[h] ?? null)
}

const TITRE: Record<Ecran, string> = {
  journal: 'Le journal',
  erreurs: 'Les erreurs',
  serveur: 'Le serveur',
  maintenance: 'La maintenance',
  activite: 'L’activité',
  soirees: 'Les soirées',
  profils: 'Les profils',
  salons: 'Les salons',
  catalogue: 'Le catalogue',
  jour: 'Le quiz du jour',
  campagne: 'La campagne',
  duels: 'Les duels',
  economie: 'L’économie',
  signalements: 'Les signalements',
  annonces: 'Les annonces',
  affiches: 'Les nouveautés',
  base: 'La base et le miroir',
}

/**
 * Le rail, en six groupes — ceux de la proposition du 3 novembre 2026 : la
 * commande, l'audience, les modes, le contenu, la technique, l'animation ; la
 * vue d'ensemble, le poste de commande, est `null`. Seules les pages qui
 * existent : une page rejoint le rail quand elle est là, jamais avant (règle
 * `qg.md`) — le direct, les alertes, les joueurs, les questions, la base et le
 * Cabinet y entreront avec la leur.
 */
const PAGES_DU_QG: { groupe: string; pages: { ecran: Ecran | null; nom: string; icone: IconName }[] }[] = [
  {
    groupe: 'Commande',
    pages: [
      { ecran: null, nom: 'Poste de commande', icone: 'bar-chart' },
      { ecran: 'journal', nom: 'Journal', icone: 'list' },
    ],
  },
  {
    groupe: 'Audience',
    pages: [
      { ecran: 'profils', nom: 'Profils', icone: 'users' },
      { ecran: 'salons', nom: 'Salons', icone: 'home' },
      { ecran: 'economie', nom: 'Économie', icone: 'bag' },
    ],
  },
  {
    groupe: 'Modes',
    pages: [
      { ecran: 'activite', nom: 'Activité', icone: 'hash' },
      { ecran: 'soirees', nom: 'Soirées', icone: 'glass' },
      { ecran: 'jour', nom: 'Quiz du jour', icone: 'sun' },
      { ecran: 'campagne', nom: 'Campagne', icone: 'target' },
      { ecran: 'duels', nom: 'Duels', icone: 'swords' },
    ],
  },
  {
    groupe: 'Contenu',
    pages: [
      { ecran: 'signalements', nom: 'Signalements', icone: 'flag' },
      { ecran: 'catalogue', nom: 'Catalogue', icone: 'globe' },
    ],
  },
  {
    groupe: 'Technique',
    pages: [
      // Avant le serveur : on y agit — trier, être prévenu —, quand l'autre se lit.
      { ecran: 'erreurs', nom: 'Erreurs', icone: 'x-circle' },
      { ecran: 'serveur', nom: 'Serveur', icone: 'zap' },
      // Sortie du serveur, où elle se perdait : Turso, son quota, le miroir de chaque salon, les sauvegardes.
      { ecran: 'base', nom: 'Base et miroir', icone: 'archive' },
    ],
  },
  {
    groupe: 'Animer',
    pages: [
      { ecran: 'annonces', nom: 'Annonces', icone: 'megaphone' },
      { ecran: 'affiches', nom: 'Nouveautés', icone: 'sparkles' },
      // Ce qui se ferme et se rouvre : la maintenance dit aux joueurs ce qui ne marche pas, comme une annonce.
      { ecran: 'maintenance', nom: 'Maintenance', icone: 'alert' },
    ],
  },
]

/**
 * Les pages qui lisent la période de la barre, celles qu'elles offrent, et si
 * elles comparent à la période d'avant. Le serveur ne garde que huit jours :
 * trente jours n'y sont pas, et la période retenue au-delà s'y lit en semaine.
 */
const PERIODES_DES_PAGES: Partial<Record<Ecran | 'poste', { periodes: readonly PeriodeDuQg[]; comparer: boolean }>> = {
  poste: { periodes: PERIODES_DU_QG, comparer: true },
  serveur: { periodes: ['1h', '24h', '7j'], comparer: false },
  base: { periodes: ['1h', '24h', '7j'], comparer: false },
}

/**
 * Le direct se relit toutes les dix secondes — en mémoire et dans la base
 * locale, sans un aller-retour vers Turso ; la vue d'ensemble, qui lit
 * Turso, toutes les cinq minutes, et en revenant d'une page : un QG reste
 * ouvert sur un écran toute la journée, et chaque relecture compte au quota.
 * Rien tant que l'onglet est caché.
 */
const DIRECT_MS = 10_000
const VUE_MS = 300_000

export function AdminApp() {
  const { toast } = useAppState()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [ecran, setEcran] = useState<Ecran | null>(lireEcran)
  const [direct, setDirect] = useState<DirectDuQg | null>(null)
  const [directEnPanne, setDirectEnPanne] = useState(false)
  const [vue, setVue] = useState<VueDEnsemble | null>(null)
  const [vueEnPanne, setVueEnPanne] = useState(false)
  const [profils, setProfils] = useState<number>()
  const [espaces, setEspaces] = useState<EspaceDAdministration[]>()
  /** Le bandeau et les pages fermées : le rail les rappelle, de toutes les pages — on ne laisse pas une page fermée sans le voir. */
  const [maintenance, setMaintenance] = useState<EtatDeLaMaintenance | null>(null)
  const [periode, setPeriode] = usePeriodeDuQg()
  const [comparer, setComparer] = useComparaisonDuQg()
  /** Ce qui s'ouvre par-dessus la page : la liste des pages au téléphone, la palette, la fiche d'un joueur trouvé par la palette. */
  const [toutes, setToutes] = useState(false)
  const [palette, setPalette] = useState(false)
  const [fiche, setFiche] = useState<Pick<ProfilDAdministration, 'id' | 'nom'> | null>(null)
  /** Ce que son propre profil a de neuf à porter : la pastille de « Profil », dans la barre du téléphone. */
  const nouveautes = useNouveautesDuMenu(true)
  // Une lecture à la fois : l'hébergeur qui se réveille tient une requête trente secondes.
  const enVol = useRef({ direct: false, vue: false })
  const derniereVue = useRef(0)
  const estAdmin = me?.account.role === 'admin'

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
  /** Les comptes du rail et de la liste des pages, relus en revenant d'une page : on y a peut-être supprimé, rattaché. */
  const relireLesComptes = () => {
    api.admin.profils('').then(l => setProfils(l.total), () => {})
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
    // Le retour du navigateur referme l'écran ouvert, comme celui du profil.
    const auRetour = () => setEcran(lireEcran())
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
      relireLeDirect()
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

  /** Une page du QG, à son adresse : le rail y va de l'une à l'autre, le retour du navigateur revient. */
  const aller = (e: Ecran | null) => {
    setToutes(false)
    if (e === ecran) return
    history.pushState({ ...history.state, depuisAdmin: true }, '', e ? `/admin#${e}` : '/admin')
    setEcran(e)
    if (e === null) {
      relireLesComptes()
      relireLaVue()
    }
    window.scrollTo(0, 0)
  }
  /** « ← Le QG », au téléphone : d'un cran si l'écran a été ouvert d'ici ; venu d'un lien, on remplace l'adresse. */
  const revenir = () => {
    if (history.state?.depuisAdmin) history.back()
    else history.replaceState(history.state, '', '/admin')
    setEcran(null)
    relireLesComptes()
    relireLaVue()
    window.scrollTo(0, 0)
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

  const instant = direct?.maintenant ?? vue?.maintenant
  const choses = lesChosesATraiter(vue?.aTraiter ?? null, direct, instant)
  const duServeur = choses.filter(c => c.ecran === 'serveur').length
  const desErreurs = choses.filter(c => c.ecran === 'erreurs').length
  const reserve = vue?.aTraiter.reserve
  // Les questions à relire aux deux modes : la pastille de leur page les compte, pas la ligne qui les annonce.
  const signalees = vue ? vue.aTraiter.signalementsDuJour.questions + vue.aTraiter.signalementsDeLaCampagne.questions : 0
  const aRelire = vue?.aTraiter.catalogue ?? 0
  const duPublic = vue?.aTraiter.propositions ?? 0
  const enCours = direct?.soirees.filter(s => s.etat === 'en-cours').length
  const enPlan = direct?.soirees.filter(s => s.etat === 'en-plan').length ?? 0
  const comptes: Partial<Record<Ecran, number>> = { soirees: enCours, profils, salons: espaces?.length }
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
  // L'état du service, en un mot dans la barre : ce que les voyants du poste de commande disent en grand.
  const etat = phraseDeLEtat(etatDuService(direct, vue?.aTraiter.serveur ?? null))
  const lecture = PERIODES_DES_PAGES[ecran ?? 'poste']
  const lisLaPeriode = !!lecture
  const periodeDeLaPage = lecture && !lecture.periodes.includes(periode) ? lecture.periodes[lecture.periodes.length - 1] : periode
  const groupeDeLEcran = PAGES_DU_QG.find(g => g.pages.some(p => p.ecran === ecran))?.groupe ?? 'Commande'
  const nomDeLEcran = ecran ? TITRE[ecran] : 'Poste de commande'

  /** La pastille d'une page : ce qui y attend un geste ; sinon, son compte. */
  const pastilleDe = (e: Ecran | null) => {
    const siennes = e === null ? choses : choses.filter(c => c.ecran === e)
    const pastille = e === 'signalements' ? signalees : e === 'maintenance' ? posees : siennes.length
    const compte = e ? comptes[e] : undefined
    return pastille > 0 ? (
      <span className={'qg-pastille' + (e === 'maintenance' || siennes.some(c => c.alerte) ? ' qg-pastille-alerte' : '')}>
        {pastille}
        <span className="sr-only">{e === 'signalements' ? ' à relire' : e === 'maintenance' ? ` : ${enMaintenance}` : ' à traiter'}</span>
      </span>
    ) : (
      compte !== undefined && <span className="qg-compte">{formatNumber(compte)}</span>
    )
  }

  /** Toutes les pages, chacune ce qu'on y trouve ou ce qui y attend : sous le poste de commande au téléphone, et dans sa feuille. */
  const listeDesPages = (
    <ul className="style-liste">
      <Ligne icone="hash" nom="L’activité" valeur="Le volume des modes, qui joue à quoi" onClick={() => aller('activite')} />
      <Ligne
        icone="glass"
        nom="Les soirées"
        valeur={enPlan > 0 ? `${enPlan} laissée${enPlan > 1 ? 's' : ''} en plan` : enCours ? `${enCours} en cours` : 'Le bilan du mois'}
        onClick={() => aller('soirees')}
      />
      <Ligne
        icone="sun"
        nom="Le quiz du jour"
        valeur={
          duPublic > 0
            ? `${duPublic} question${duPublic > 1 ? 's' : ''} du public à relire`
            : reserve
              ? `${reserve.joursDAvance} jour${reserve.joursDAvance > 1 ? 's' : ''} d’avance`
              : 'La réserve'
        }
        onClick={() => aller('jour')}
      />
      <Ligne icone="target" nom="La campagne" valeur="Sentiers, défi, Cabinet" onClick={() => aller('campagne')} />
      <Ligne icone="swords" nom="Les duels" valeur="Ligues, classement, en attente" onClick={() => aller('duels')} />
      <Ligne icone="users" nom="Les profils" valeur={profils === undefined ? 'Chercher, supprimer' : formatNumber(profils)} onClick={() => aller('profils')} />
      <Ligne icone="home" nom="Les salons" valeur={espaces ? formatNumber(espaces.length) : 'Renommer, fermer'} onClick={() => aller('salons')} />
      <Ligne icone="bag" nom="L’économie" valeur="Confettis, ventes, Éclats" onClick={() => aller('economie')} />
      <Ligne icone="globe" nom="Le catalogue" valeur={aRelire > 0 ? `${aRelire} à relire` : 'Relire, publier'} onClick={() => aller('catalogue')} />
      <Ligne icone="flag" nom="Les signalements" valeur={signalees > 0 ? `${signalees} à relire` : 'Corriger, reclasser'} onClick={() => aller('signalements')} />
      <Ligne icone="list" nom="Le journal" valeur="Tes gestes" onClick={() => aller('journal')} />
      <Ligne icone="x-circle" nom="Les erreurs" valeur={desErreurs > 0 ? `${desErreurs} à traiter` : 'Trier, être prévenu'} onClick={() => aller('erreurs')} />
      <Ligne icone="zap" nom="Le serveur" valeur={duServeur > 0 ? `${duServeur} à traiter` : 'Signaux, routes, gels, versions'} onClick={() => aller('serveur')} />
      <Ligne icone="archive" nom="La base et le miroir" valeur="Turso, quota, miroir, sauvegardes" onClick={() => aller('base')} />
      <Ligne icone="alert" nom="La maintenance" valeur={enMaintenance || 'Bandeau, pages fermées, testeurs'} onClick={() => aller('maintenance')} />
      <Ligne icone="megaphone" nom="Les annonces" valeur="Un mot à tous, des confettis" onClick={() => aller('annonces')} />
      <Ligne icone="sparkles" nom="Les nouveautés" valeur="Une affiche, « Nouveau » sur un bouton" onClick={() => aller('affiches')} />
    </ul>
  )

  return (
    <div className="player-shell compte admin qg">
      {/* La barre de commande, collée en haut : où l'on est, la période de la page, l'état du service, la palette. */}
      <header className="qg-commande">
        <button type="button" className="qg-bouton qg-pages" onClick={() => setToutes(true)} aria-label="Toutes les pages du QG">
          <Icon name="list" />
          <span>Pages</span>
        </button>
        <span className="qg-ariane">
          {groupeDeLEcran} <span aria-hidden="true">›</span> <b>{nomDeLEcran}</b>
        </span>
        {lecture && (
          <div className="qg-periodes" role="group" aria-label="La période de la page">
            {lecture.periodes.map(p => (
              <button key={p} type="button" aria-pressed={periodeDeLaPage === p} title={`Voir ${PERIODE_EN_TOUTES_LETTRES[p]}`} onClick={() => setPeriode(p)}>
                {NOM_DE_LA_PERIODE[p]}
              </button>
            ))}
          </div>
        )}
        {lecture?.comparer && (
          <button type="button" className="qg-bascule" aria-pressed={comparer} onClick={() => setComparer(!comparer)} title="La période d’avant en filet sur le graphique">
            <span className="qg-interrupteur" aria-hidden="true" />
            Comparer
          </button>
        )}
        <span className="qg-commande-droite">
          <EnDirect direct={direct} enPanne={directEnPanne} />
          <button type="button" className={'qg-etat-pastille' + (etat.aRegarder > 0 ? ' qg-etat-pastille-alerte' : '')} onClick={() => aller(null)}>
            <i className={`qg-voyant qg-voyant-${etat.aRegarder > 0 ? 'critique' : direct ? 'ok' : 'inconnu'}`} aria-hidden="true" />
            {etat.aRegarder > 0 ? `${etat.aRegarder} à regarder` : direct ? 'Au vert' : 'État…'}
          </button>
          <button type="button" className="qg-bouton qg-chercher" onClick={() => setPalette(true)} aria-label="Aller à… (⌘K)">
            <Icon name="search" />
            <span className="qg-a-l-ordinateur">Aller à…</span>
            <kbd className="qg-a-l-ordinateur">⌘K</kbd>
          </button>
        </span>
      </header>

      <header className="qg-tete">
        {ecran ? (
          <Sortie vers="Le QG" href="/admin" onClick={revenir} />
        ) : (
          <span className="qg-quand">{instant ? `${jourEnToutesLettres(jourDe(instant))} · ${heureEcrite(instant)}` : 'Toi seul'}</span>
        )}
        <div className="qg-titre">
          <span className="qg-surtitre">{groupeDeLEcran}</span>
          <h1>{nomDeLEcran}</h1>
        </div>
      </header>

      {/* Un administrateur sans profil n'a pas d'accueil à lui : sa barre garde l'écran commun et l'historique. */}
      {!me.profil && <NavAnimateur ici="admin" slug={me.space.slug} admin />}
      <nav className="qg-cote" aria-label="Les pages du QG">
        <div className="qg-marque">
          <span className="qg-marque-logo" aria-hidden="true">
            QG
          </span>
          <span className="qg-marque-nom">
            Le QG
            <small>Salle de contrôle</small>
          </span>
          {direct && <span className="etiquette qg-env">{direct.serveur.env === 'production' ? 'Production' : direct.serveur.env}</span>}
        </div>
        {PAGES_DU_QG.map(({ groupe, pages }) => (
          <div key={groupe} className="qg-groupe">
            <span className="qg-groupe-titre">{groupe}</span>
            {pages.map(p => (
              <LienDuQg key={p.nom} ici={ecran === p.ecran} href={p.ecran ? `/admin#${p.ecran}` : '/admin'} icone={p.icone} onAller={() => aller(p.ecran)}>
                {p.nom}
                {pastilleDe(p.ecran)}
              </LienDuQg>
            ))}
          </div>
        ))}
        <a className="lien-discret qg-retour" href="/compte">
          <Icon name="arrow-left" />
          Mon compte
        </a>
      </nav>

      <main className="page-corps">
        {ecran === null && (
          <>
            <VueDEnsembleDuQg vue={vue} direct={direct} vueEnPanne={vueEnPanne} directEnPanne={directEnPanne} ouvrir={aller} periode={periode} comparer={comparer} />
            {/* Au téléphone, les pages sous le poste de commande ; à l'ordinateur, le rail les tient. */}
            <nav className="qg-sommaire" aria-labelledby="qg-pages-titre">
              <h2 className="compte-groupe" id="qg-pages-titre">
                Toutes les pages
              </h2>
              {listeDesPages}
            </nav>
          </>
        )}
        {ecran === 'journal' && <QgJournal />}
        {/* Un tri change ce qui sonne : la ligne de « À traiter », et la pastille du rail, se relisent. */}
        {ecran === 'erreurs' && <QgErreurs apresUnTri={relireLaVue} />}
        {ecran === 'serveur' && <QgServeur periode={periodeDuServeur(periodeDeLaPage)} versLesErreurs={() => aller('erreurs')} />}
        {/* Le miroir de chaque salon et les sauvegardes, à côté de Turso et de son quota ; la période, celle de la barre. */}
        {ecran === 'base' && <QgBase periode={periodeDuServeur(periodeDeLaPage)} />}
        {/* Chaque geste rend l'état d'après : le rail le compte aussitôt. La panne réglée, l'annonce qui le dit à tous. */}
        {ecran === 'maintenance' && <QgMaintenance onEtat={setMaintenance} versLesAnnonces={() => aller('annonces')} />}
        {ecran === 'annonces' && <QgAnnonces />}
        {/* L'état de la maintenance : une page fermée, l'affiche le dit avant de la poser. */}
        {ecran === 'affiches' && <QgAffiches maintenance={maintenance} />}
        {ecran === 'activite' && <QgActivite />}
        {/* Le direct de la page des soirées est celui du QG, relu toutes les dix secondes ; relu aussitôt après un geste. */}
        {ecran === 'soirees' && <QgSoirees direct={direct} apresUnGeste={relireLeDirect} />}
        {ecran === 'profils' && <AdminProfils />}
        {ecran === 'salons' && <AdminSalons espaces={espaces} onChange={relireLesComptes} />}
        {ecran === 'catalogue' && <Catalogue />}
        {ecran === 'jour' && <AdminDuJour vue={vue} versLesSignalements={() => aller('signalements')} />}
        {ecran === 'campagne' && <AdminCampagne vue={vue} versLesSignalements={() => aller('signalements')} />}
        {ecran === 'duels' && <AdminDuels vue={vue} />}
        {ecran === 'economie' && <AdminEconomie />}
        {/* Un geste referme des signalements : ce qui attend, et la pastille du rail, se relisent. */}
        {ecran === 'signalements' && <AdminSignalements apresUnGeste={relireLaVue} />}

        {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </main>
      <MenuBarre ici="compte" nouveautes={nouveautes} />

      {toutes && (
        <Feuille titre="Toutes les pages du QG" onFermer={() => setToutes(false)}>
          <button type="button" className="qg-feuille-poste" onClick={() => aller(null)}>
            <Icon name="bar-chart" />
            Poste de commande
            {pastilleDe(null)}
          </button>
          {listeDesPages}
        </Feuille>
      )}
      {palette && (
        <PaletteDuQg
          pages={PAGES_DU_QG.flatMap(g => g.pages.map(p => ({ ...p, groupe: g.groupe })))}
          aller={aller}
          periode={lisLaPeriode ? periodeDeLaPage : null}
          periodes={lecture?.periodes ?? []}
          changerDePeriode={setPeriode}
          comparer={lecture?.comparer ? comparer : null}
          changerLaComparaison={setComparer}
          ouvrirLeProfil={setFiche}
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
  )
}

/** Le direct vit ou se tait : « En direct », ou l'heure du dernier relevé qui a répondu. */
function EnDirect({ direct, enPanne }: { direct: DirectDuQg | null; enPanne: boolean }) {
  if (!direct && !enPanne) return null
  return (
    <span className={'qg-vif' + (enPanne ? ' qg-vif-perdu' : '')}>
      <span className="qg-vif-point" aria-hidden="true" />
      {!enPanne ? 'En direct' : direct ? `Dernier relevé à ${heureEcrite(direct.maintenant)}` : 'Le serveur ne répond pas'}
    </span>
  )
}

/** Un lien du rail : une vraie adresse, pour l'onglet d'à côté ; un clic simple reste dans la page. */
function LienDuQg({ ici, href, icone, onAller, children }: { ici: boolean; href: string; icone: IconName; onAller: () => void; children: ReactNode }) {
  return (
    <a
      className="qg-lien"
      href={href}
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

/** Une ligne de la liste des pages, comme celles de « Mon compte ». */
function Ligne({ icone, nom, valeur, onClick }: { icone: IconName; nom: string; valeur: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick}>
        <span className="style-icone">
          <Icon name={icone} />
        </span>
        <span className="style-nom">{nom}</span>
        <span className="style-valeur">{valeur}</span>
        <Icon name="chevron-down" className="style-chevron" />
      </button>
    </li>
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

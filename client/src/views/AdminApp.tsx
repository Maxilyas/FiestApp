import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, motifDe, UnauthorizedError, type Me } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { NavAnimateur } from '../components/NavAnimateur'
import { AdminCampagne } from '../components/AdminCampagne'
import { AdminDuJour } from '../components/AdminDuJour'
import { AdminProfils } from '../components/AdminProfils'
import { AdminSalons } from '../components/AdminSalons'
import { VueDEnsembleDuQg } from '../components/QgVueDEnsemble'
import { QgJournal } from '../components/QgJournal'
import { QgSoirees } from '../components/QgSoirees'
import { QgServeur } from '../components/QgServeur'
import { MenuBarre, Sortie } from '../components/Pieces'
import { useAppState } from '../state'
import { formatDay } from '../../../shared/archive'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { heureEcrite, lesChosesATraiter, type DirectDuQg, type VueDEnsemble } from '../../../shared/qg'
import type { EspaceDAdministration } from '../../../shared/space'
import type { EntreeDuCatalogue, StatutAuCatalogue } from '../../../shared/partage'
import type { QuizQuestionDef } from '../../../shared/library'

/**
 * Le QG de l'administrateur (`/admin`), pour lui seul — le souhait du
 * propriétaire du 13 octobre 2026 : « un vrai QG pour monitorer tous les
 * modes de jeu et avoir un vrai impact dessus ». La vue d'ensemble d'abord
 * (`QgVueDEnsemble.tsx`), le journal de ses gestes (`QgJournal.tsx`) et la
 * santé du serveur sur sept jours (`QgServeur.tsx`), puis
 * une page par sujet, chacune à son adresse (`/admin#jour`) : les soirées
 * (`QgSoirees.tsx`), le quiz du jour, la campagne, les profils, les salons,
 * le catalogue. Au téléphone, la liste des pages sous la vue d'ensemble et
 * la barre du menu ; à l'ordinateur, une barre de côté.
 *
 * Il remplace une page à la manière de « Mon compte » (le 3 octobre 2026) —
 * quatre cadrans et cinq lignes —, qui ne disait rien de ce qui se jouait.
 * Les quiz et les soirées des autres ne s'y voient toujours pas : des
 * soirées, rien que des chiffres ; des quiz, les copies proposées au
 * catalogue.
 */

type Ecran = 'journal' | 'serveur' | 'soirees' | 'profils' | 'salons' | 'catalogue' | 'jour' | 'campagne'
const ECRANS: readonly Ecran[] = ['journal', 'serveur', 'soirees', 'profils', 'salons', 'catalogue', 'jour', 'campagne']
/** Les ancres de la page d'avant, qu'un favori garde encore. */
const ANCIENNES: Record<string, Ecran> = { 'les-profils': 'profils', 'quiz-du-jour': 'jour' }

function lireEcran(): Ecran | null {
  const h = window.location.hash.slice(1)
  return (ECRANS as readonly string[]).includes(h) ? (h as Ecran) : (ANCIENNES[h] ?? null)
}

const TITRE: Record<Ecran, string> = {
  journal: 'Le journal',
  serveur: 'Le serveur',
  soirees: 'Les soirées',
  profils: 'Les profils',
  salons: 'Les salons',
  catalogue: 'Le catalogue',
  jour: 'Le quiz du jour',
  campagne: 'La campagne',
}

/**
 * La barre de côté, par groupe ; la vue d'ensemble est `null`. Seules les
 * pages qui existent : les duels, l'économie et « Animer » la rejoindront à
 * leur tour.
 */
const PAGES_DU_QG: { groupe: string; pages: { ecran: Ecran | null; nom: string; icone: IconName }[] }[] = [
  {
    groupe: 'Piloter',
    pages: [
      { ecran: null, nom: 'Vue d’ensemble', icone: 'bar-chart' },
      { ecran: 'journal', nom: 'Journal', icone: 'list' },
      { ecran: 'serveur', nom: 'Serveur', icone: 'zap' },
    ],
  },
  {
    groupe: 'Les modes',
    pages: [
      { ecran: 'soirees', nom: 'Soirées', icone: 'glass' },
      { ecran: 'jour', nom: 'Quiz du jour', icone: 'sun' },
      { ecran: 'campagne', nom: 'Campagne', icone: 'target' },
    ],
  },
  {
    groupe: 'Les joueurs',
    pages: [
      { ecran: 'profils', nom: 'Profils', icone: 'users' },
      { ecran: 'salons', nom: 'Salons', icone: 'home' },
    ],
  },
  { groupe: 'Le contenu', pages: [{ ecran: 'catalogue', nom: 'Catalogue', icone: 'globe' }] },
]

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
  /** Les comptes de la barre de côté et de la liste des pages, relus en revenant d'une page : on y a peut-être supprimé, rattaché. */
  const relireLesComptes = () => {
    api.admin.profils('').then(l => setProfils(l.total), () => {})
    api.admin.espaces().then(setEspaces, () => {})
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

  /** Une page du QG, à son adresse : la barre de côté y va de l'une à l'autre, le retour du navigateur revient. */
  const aller = (e: Ecran | null) => {
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
  const reserve = vue?.aTraiter.reserve
  const signalements = vue?.aTraiter.signalementsDeLaCampagne.questions ?? 0
  const aRelire = vue?.aTraiter.catalogue ?? 0
  const enCours = direct?.soirees.filter(s => s.etat === 'en-cours').length
  const enPlan = direct?.soirees.filter(s => s.etat === 'en-plan').length ?? 0
  const comptes: Partial<Record<Ecran, number>> = { soirees: enCours, profils, salons: espaces?.length }

  return (
    <div className="player-shell compte admin qg">
      <header className="qg-tete">
        {ecran ? (
          <Sortie vers="Le QG" href="/admin" onClick={revenir} />
        ) : (
          <span className="qg-quand">{instant ? `${jourEnToutesLettres(jourDe(instant))} · ${heureEcrite(instant)}` : 'Toi seul'}</span>
        )}
        <div className="qg-titre">
          <h1>
            {ecran ? (
              TITRE[ecran]
            ) : (
              <>
                <span className="qg-au-telephone">Le QG</span>
                <span className="qg-a-l-ordinateur">Vue d’ensemble</span>
              </>
            )}
          </h1>
          {!ecran && <EnDirect direct={direct} enPanne={directEnPanne} />}
        </div>
      </header>

      {/* Un administrateur sans profil n'a pas d'accueil à lui : sa barre garde l'écran commun et l'historique. */}
      {!me.profil && <NavAnimateur ici="admin" slug={me.space.slug} admin />}
      <nav className="qg-cote" aria-label="Les pages du QG">
        <div className="qg-marque">
          <span className="qg-marque-nom">Le QG</span>
          {direct && <span className="etiquette">{direct.serveur.env === 'production' ? 'Production' : direct.serveur.env}</span>}
        </div>
        {PAGES_DU_QG.map(({ groupe, pages }) => (
          <div key={groupe} className="qg-groupe">
            <span className="qg-groupe-titre">{groupe}</span>
            {pages.map(p => {
              // Ce qui attend un geste sur la page : tout, pour la vue d'ensemble.
              const siennes = p.ecran === null ? choses : choses.filter(c => c.ecran === p.ecran)
              const compte = p.ecran ? comptes[p.ecran] : undefined
              return (
                <LienDuQg key={p.nom} ici={ecran === p.ecran} href={p.ecran ? `/admin#${p.ecran}` : '/admin'} icone={p.icone} onAller={() => aller(p.ecran)}>
                  {p.nom}
                  {siennes.length > 0 ? (
                    <span className={'qg-pastille' + (siennes.some(c => c.alerte) ? ' qg-pastille-alerte' : '')}>
                      {siennes.length}
                      <span className="sr-only"> à traiter</span>
                    </span>
                  ) : (
                    compte !== undefined && <span className="qg-compte">{formatNumber(compte)}</span>
                  )}
                </LienDuQg>
              )
            })}
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
            <VueDEnsembleDuQg vue={vue} direct={direct} vueEnPanne={vueEnPanne} directEnPanne={directEnPanne} ouvrir={aller} />
            {/* Au téléphone, les pages sous la vue d'ensemble ; à l'ordinateur, la barre de côté les tient. */}
            <nav className="qg-sommaire" aria-labelledby="qg-pages-titre">
              <h2 className="compte-groupe" id="qg-pages-titre">
                Toutes les pages
              </h2>
              <ul className="style-liste">
                <Ligne
                  icone="glass"
                  nom="Les soirées"
                  valeur={
                    enPlan > 0
                      ? `${enPlan} laissée${enPlan > 1 ? 's' : ''} en plan`
                      : enCours
                        ? `${enCours} en cours`
                        : 'Le bilan du mois'
                  }
                  onClick={() => aller('soirees')}
                />
                <Ligne
                  icone="sun"
                  nom="Le quiz du jour"
                  valeur={reserve ? `${reserve.joursDAvance} jour${reserve.joursDAvance > 1 ? 's' : ''} d’avance` : 'La réserve'}
                  onClick={() => aller('jour')}
                />
                <Ligne
                  icone="target"
                  nom="La campagne"
                  valeur={signalements > 0 ? `${signalements} signalement${signalements > 1 ? 's' : ''}` : 'La base'}
                  onClick={() => aller('campagne')}
                />
                <Ligne icone="users" nom="Les profils" valeur={profils === undefined ? 'Chercher, supprimer' : formatNumber(profils)} onClick={() => aller('profils')} />
                <Ligne icone="home" nom="Les salons" valeur={espaces ? formatNumber(espaces.length) : 'Renommer, fermer'} onClick={() => aller('salons')} />
                <Ligne icone="globe" nom="Le catalogue" valeur={aRelire > 0 ? `${aRelire} à relire` : 'Relire, publier'} onClick={() => aller('catalogue')} />
                <Ligne icone="list" nom="Le journal" valeur="Tes gestes" onClick={() => aller('journal')} />
                <Ligne icone="zap" nom="Le serveur" valeur={duServeur > 0 ? `${duServeur} à traiter` : 'Sept jours'} onClick={() => aller('serveur')} />
              </ul>
            </nav>
          </>
        )}
        {ecran === 'journal' && <QgJournal />}
        {ecran === 'serveur' && <QgServeur />}
        {/* Le direct de la page des soirées est celui du QG, relu toutes les dix secondes ; relu aussitôt après un geste. */}
        {ecran === 'soirees' && <QgSoirees direct={direct} apresUnGeste={relireLeDirect} />}
        {ecran === 'profils' && <AdminProfils />}
        {ecran === 'salons' && <AdminSalons espaces={espaces} onChange={relireLesComptes} />}
        {ecran === 'catalogue' && <Catalogue />}
        {ecran === 'jour' && <AdminDuJour />}
        {ecran === 'campagne' && <AdminCampagne />}

        {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </main>
      <MenuBarre ici="compte" />
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

/** Un lien de la barre de côté : une vraie adresse, pour l'onglet d'à côté ; un clic simple reste dans la page. */
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

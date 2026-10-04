import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe, UnauthorizedError, type Me } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { NavAnimateur } from '../components/NavAnimateur'
import { AdminCampagne } from '../components/AdminCampagne'
import { AdminDuJour } from '../components/AdminDuJour'
import { AdminProfils } from '../components/AdminProfils'
import { AdminSalons } from '../components/AdminSalons'
import { MenuBarre, Sortie } from '../components/Pieces'
import { useAppState } from '../state'
import { formatDay } from '../../../shared/archive'
import { formatNumber } from '../../../shared/typographie'
import type { EspaceDAdministration } from '../../../shared/space'
import type { EntreeDuCatalogue, StatutAuCatalogue } from '../../../shared/partage'
import type { QuizQuestionDef } from '../../../shared/library'

/**
 * L'administration (`/admin`), pour l'administrateur seul, à la manière de
 * « Mon compte » : un tableau de bord qui dit l'état du serveur d'un coup
 * d'œil, puis une ligne par sujet, chacune ouvrant son écran à son adresse
 * (`/admin#salons`) — les profils, les salons, le catalogue, le quiz du jour,
 * la campagne.
 *
 * C'était une seule page de cartes et de tableaux, sortie de l'application :
 * une barre d'animateur, un formulaire « Créer un compte » qui ne sert plus
 * — chacun ouvre son salon depuis son profil — et la liste des comptes en
 * tableau large, où « p-k3x9… en attente » ne disait à qui était quoi (la
 * remarque du propriétaire du 3 octobre 2026). Les quiz et les soirées des
 * autres ne se voient toujours pas d'ici, sauf les copies proposées au
 * catalogue.
 */

type Ecran = 'profils' | 'salons' | 'catalogue' | 'jour' | 'campagne'
const ECRANS: readonly Ecran[] = ['profils', 'salons', 'catalogue', 'jour', 'campagne']
/** Les ancres de la page d'avant, qu'un favori garde encore. */
const ANCIENNES: Record<string, Ecran> = { 'les-profils': 'profils', 'quiz-du-jour': 'jour' }

function lireEcran(): Ecran | null {
  const h = window.location.hash.slice(1)
  return (ECRANS as readonly string[]).includes(h) ? (h as Ecran) : (ANCIENNES[h] ?? null)
}

/** Sous ce nombre de jours d'avance, la réserve du quiz du jour s'allume (`AdminDuJour`). */
const ALERTE_JOURS = 7

/** Ce que le tableau de bord résume : chaque chiffre arrive quand il peut, sans retenir les autres. */
interface Resume {
  profils?: number
  espaces?: EspaceDAdministration[]
  aRelire?: number
  jour?: { jours: number; signalements: number }
  campagne?: { signalements: number }
}

export function AdminApp() {
  const { toast } = useAppState()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [resume, setResume] = useState<Resume>({})
  const [ecran, setEcran] = useState<Ecran | null>(lireEcran)

  /** Les chiffres du tableau de bord, relus en revenant d'un écran : on y a peut-être supprimé, publié, rempli. */
  const relireLeResume = () => {
    const poser = (morceau: Resume) => setResume(r => ({ ...r, ...morceau }))
    api.admin.profils('').then(l => poser({ profils: l.total }), () => {})
    api.admin.espaces().then(espaces => poser({ espaces }), () => {})
    api.admin.catalogue().then(c => poser({ aRelire: c.filter(e => e.statut === 'propose').length }), () => {})
    api.admin.jour().then(j => poser({ jour: { jours: j.reserve.joursDAvance, signalements: j.signalements.length } }), () => {})
    api.admin.campagne().then(c => poser({ campagne: { signalements: c.signalements.length } }), () => {})
  }

  useEffect(() => {
    api.auth
      .me()
      .then(m => {
        setMe(m)
        if (m.account.role !== 'admin') setError('Cette page est réservée à l’administrateur.')
        else relireLeResume()
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

  const ouvrir = (e: Ecran) => {
    history.pushState({ ...history.state, depuisAdmin: true }, '', `/admin#${e}`)
    setEcran(e)
    window.scrollTo(0, 0)
  }
  /** D'un cran si l'écran a été ouvert d'ici ; venu d'un lien, on remplace l'adresse. */
  const revenir = () => {
    if (history.state?.depuisAdmin) history.back()
    else history.replaceState(history.state, '', '/admin')
    setEcran(null)
    relireLeResume()
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

  const { espaces } = resume
  // Tous les espaces : les salons des profils, et les comptes d'avant, à mot de passe — ceux que l'écran liste.
  const salons = espaces?.length
  const sansTitulaire = espaces?.filter(e => e.salon && !e.titulaire).length ?? 0
  const titre: Record<Ecran, string> = { profils: 'Les profils', salons: 'Les salons', catalogue: 'Le catalogue', jour: 'Le quiz du jour', campagne: 'La campagne' }
  const signalementsDeCampagne = resume.campagne?.signalements ?? 0

  return (
    <div className="player-shell compte admin">
      {ecran ? (
        <header className="admin-ecran-tete">
          <Sortie vers="Administration" href="/admin" onClick={revenir} />
          <h1>{titre[ecran]}</h1>
        </header>
      ) : (
        <header className="compte-tete">
          <h1>Administration</h1>
          <span className="etiquette">Toi seul</span>
        </header>
      )}

      {/* Un administrateur sans profil n'a pas d'accueil à lui : sa barre garde l'écran commun et l'historique. */}
      {!me.profil && <NavAnimateur ici="admin" slug={me.space.slug} admin />}
      <main className="page-corps">
        {ecran === null && (
          <>
            <section className="admin-hud" aria-labelledby="admin-hud-titre">
              <span className="salon-hud-label" id="admin-hud-titre">
                <span className="admin-pouls" aria-hidden="true" />
                Le serveur
              </span>
              <div className="admin-cadrans">
                <Cadran chiffre={resume.profils} nom="profils" onClick={() => ouvrir('profils')} />
                <Cadran chiffre={salons} nom="salons" detail={sansTitulaire > 0 ? `${sansTitulaire} sans titulaire` : undefined} onClick={() => ouvrir('salons')} />
                <Cadran chiffre={resume.aRelire} nom="à relire" alerte={!!resume.aRelire} onClick={() => ouvrir('catalogue')} />
                <Cadran
                  chiffre={resume.jour?.jours}
                  nom={`jour${resume.jour?.jours === 1 ? '' : 's'} d’avance`}
                  detail={resume.jour?.signalements ? `${resume.jour.signalements} signalement${resume.jour.signalements > 1 ? 's' : ''}` : undefined}
                  alerte={!!resume.jour && (resume.jour.jours < ALERTE_JOURS || resume.jour.signalements > 0)}
                  onClick={() => ouvrir('jour')}
                />
              </div>
            </section>

            <ul className="style-liste">
              <Ligne icone="users" nom="Les profils" valeur="Chercher, supprimer" onClick={() => ouvrir('profils')} />
              <Ligne icone="home" nom="Les salons" valeur="Renommer, fermer" onClick={() => ouvrir('salons')} />
              <Ligne icone="globe" nom="Le catalogue" valeur="Relire, publier" onClick={() => ouvrir('catalogue')} />
              <Ligne icone="sun" nom="Le quiz du jour" valeur="La réserve" onClick={() => ouvrir('jour')} />
              <Ligne
                icone="target"
                nom="La campagne"
                valeur={signalementsDeCampagne > 0 ? `${signalementsDeCampagne} signalement${signalementsDeCampagne > 1 ? 's' : ''}` : 'La base'}
                onClick={() => ouvrir('campagne')}
              />
            </ul>
          </>
        )}
        {ecran === 'profils' && <AdminProfils />}
        {ecran === 'salons' && <AdminSalons espaces={espaces} onChange={relireLeResume} />}
        {ecran === 'catalogue' && <Catalogue />}
        {ecran === 'jour' && <AdminDuJour />}
        {ecran === 'campagne' && <AdminCampagne />}

        {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </main>
      <MenuBarre ici="compte" />
    </div>
  )
}

/** Un chiffre du tableau de bord : ce qu'il compte, et l'écran qui le montre. Un tiret tant qu'il n'est pas arrivé. */
function Cadran({ chiffre, nom, detail, alerte, onClick }: { chiffre?: number; nom: string; detail?: string; alerte?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'admin-cadran' + (alerte ? ' admin-cadran-alerte' : '')} onClick={onClick}>
      <span className="admin-cadran-chiffre num">{chiffre === undefined ? '–' : formatNumber(chiffre)}</span>
      <span className="admin-cadran-nom">{nom}</span>
      {detail && <span className="admin-cadran-detail">{detail}</span>}
    </button>
  )
}

/** Une ligne de la liste des sujets, comme celles de « Mon compte ». */
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

import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Choix, Feuille, PieceTete, Sortie } from '../components/Pieces'
import { chefIci, retenirChef } from '../chef'
import { spacePath } from '../routes'
import { ecrireDuree, type QuizSummary } from '../../../shared/library'
import { PALIERS_ENCHAINEMENT } from '../../../shared/console'
import type { ModeleResume } from '../../../shared/modeles'
import type { EntreeDeProgramme, Programme } from '../../../shared/programme'
import type { PublicSpace } from '../../../shared/space'

/** Un quiz de ce soir, tel que la page le montre. */
interface QuizDuSoir {
  id: string
  titre: string
  multiplicateur: 1 | 2 | 3
}

type Etat = { e: 'chargement' } | { e: 'anonyme' } | { e: 'erreur'; motif: string } | { e: 'pret'; espace: PublicSpace }

/** Le rythme d'un salon neuf : la suite après cinq secondes, le temps de lire la bonne réponse. */
const RYTHME_PAR_DEFAUT = 5

const sansAccent = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Créer un salon (`/salon`) : les quiz de ce soir, où l'on voit les
 * questions, et si l'on joue — trois questions, sans mode d'emploi ; le
 * rythme, les équipes et les points doublés repliés dans « Réglages ».
 *
 * Tout le monde a son salon : le profil ouvre son espace la première fois,
 * sans compte d'animateur à demander (`/api/joueur/espace`). « Ouvrir le
 * salon » range les quiz dans le programme de ce soir — celui que la console
 * propose, dans l'ordre —, tire le code (`/api/joueur/salon`), et mène le
 * chef à sa salle : la page de la soirée s'il joue, la console s'il anime
 * seulement. Ses choix restent sur ce téléphone (`chef.ts`).
 */
export function SalonApp() {
  const [etat, setEtat] = useState<Etat>({ e: 'chargement' })
  const [bibliotheque, setBibliotheque] = useState<QuizSummary[]>([])
  const [modeles, setModeles] = useState<ModeleResume[]>([])
  /** Le programme de ce soir, s'il en a un : on le reprend, on le réécrit. */
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [quiz, setQuiz] = useState<QuizDuSoir[]>([])
  const [ecran, setEcran] = useState<'telephones' | 'tele'>('telephones')
  const [codeTele, setCodeTele] = useState('')
  const [teleBranchee, setTeleBranchee] = useState(false)
  const [joue, setJoue] = useState(true)
  const [rythme, setRythme] = useState<number | null>(RYTHME_PAR_DEFAUT)
  const [equipes, setEquipes] = useState(false)
  const [choisir, setChoisir] = useState(false)
  const [cherche, setCherche] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    document.title = 'Nouveau salon · FiestApp'
    let vivant = true
    ;(async () => {
      const moi = await api.joueur.moi()
      if (!moi.profile) return vivant && setEtat({ e: 'anonyme' })
      const { espace } = await api.joueur.espace()
      const [liste, programmes, livres] = await Promise.all([api.list(), api.programmes.list(), api.modeles().catch(() => [])])
      if (!vivant) return
      setBibliotheque(liste)
      setModeles(livres)
      const actif = programmes.find(p => p.actif) ?? null
      setProgramme(actif)
      const titres = new Map(liste.map(q => [q.id, q.title]))
      // Le programme d'hier reprend sa place : on l'ajuste plutôt que de tout rechoisir.
      setQuiz(
        (actif?.entrees ?? [])
          .filter(e => titres.has(e.quizId))
          .map(e => ({ id: e.quizId, titre: titres.get(e.quizId)!, multiplicateur: e.multiplier })),
      )
      // Le chef retrouve ses choix de la dernière fois.
      const avant = chefIci(espace.slug)
      if (avant) {
        setJoue(avant.joue)
        setRythme(avant.rythme)
        setEquipes(avant.equipes)
      }
      setEtat({ e: 'pret', espace })
    })().catch(e => vivant && setEtat({ e: 'erreur', motif: motifDe(e) }))
    return () => {
      vivant = false
    }
  }, [])

  if (etat.e === 'chargement') {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }
  if (etat.e === 'anonyme' || etat.e === 'erreur') {
    return (
      <div className="player-shell">
        <Sortie />
        <PieceTete piece="Entre amis" titre="Nouveau salon" />
        {etat.e === 'anonyme' ? (
          <>
            <p>Un salon s’ouvre avec ton profil : tes quiz, tes soirées et ton code y restent.</p>
            <a className="btn btn-primary btn-big btn-block" href="/?next=/salon">
              Me connecter
            </a>
            <a className="btn btn-block" href="/?creer=1&next=/salon">
              Créer mon profil
            </a>
          </>
        ) : (
          <p className="error">{etat.motif}</p>
        )}
      </div>
    )
  }

  const espace = etat.espace
  const dans = new Set(quiz.map(q => q.id))
  const trouve = (titre: string) => sansAccent(titre).includes(sansAccent(cherche.trim()))
  const ajouter = (q: { id: string; title: string }) => {
    setQuiz(avant => [...avant, { id: q.id, titre: q.title, multiplicateur: 1 }])
    setChoisir(false)
    setCherche('')
  }
  /** Un modèle rejoint d'abord sa bibliothèque — une copie à lui —, puis ce salon. */
  const depuisModele = async (m: ModeleResume) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const copie = await api.partirDe(m.id)
      setBibliotheque(await api.list())
      ajouter({ id: copie.id, title: copie.title })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }
  const brancher = async () => {
    setBusy(true)
    setErreur('')
    try {
      await api.auth.validerAppairage(codeTele.replace(/\s/g, '').toUpperCase())
      setTeleBranchee(true)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }
  const ouvrir = async () => {
    if (busy || quiz.length === 0) return
    setBusy(true)
    setErreur('')
    try {
      const entrees: EntreeDeProgramme[] = quiz.map(q => ({ quizId: q.id, multiplier: q.multiplicateur }))
      // Le programme de ce soir : la console le propose dans cet ordre, et la
      // soirée s'enregistre seule après le dernier.
      if (programme) {
        await api.programmes.modifier(programme.id, { entrees })
        if (!programme.actif) await api.programmes.activer(programme.id, true)
      } else {
        await api.programmes.creer('Ce soir', entrees)
      }
      const salon = await api.joueur.salon()
      retenirChef({ slug: salon.espace.slug, joue, rythme, equipes })
      window.location.assign(joue ? spacePath(salon.espace.slug) : '/host')
    } catch (e) {
      setErreur(motifDe(e))
      setBusy(false)
    }
  }

  const jouables = bibliotheque.filter(q => !q.archivedAt && q.readyCount > 0 && !dans.has(q.id) && trouve(q.title))
  // Un modèle à personnaliser demande « Pour qui ? », un modèle à compléter
  // ses ✏️ : ils se préparent dans « Mes quiz ». Ici, ceux qui se jouent tels quels.
  const livres = modeles.filter(m => !m.personnaliser && (m.pretes ?? 0) > 0 && trouve(m.title)).slice(0, 6)

  return (
    <div className="player-shell salon-nouveau">
      <Sortie />
      <PieceTete piece="Entre amis" titre="Nouveau salon">
        <p className="muted small">{espace.title}</p>
      </PieceTete>

      <section className="salon-bloc" aria-labelledby="salon-quiz">
        <span className="label" id="salon-quiz">
          Les quiz
        </span>
        {quiz.length === 0 && <p className="salon-vide">Aucun quiz pour l’instant : ajoute celui de ce soir.</p>}
        <ul className="salon-quiz">
          {quiz.map((q, i) => {
            const resume = bibliotheque.find(b => b.id === q.id)
            return (
              <li key={q.id} className="card salon-quiz-ligne">
                <span className="salon-quiz-texte">
                  <b>{q.titre}</b>
                  <span className="muted small">
                    {resume ? `${resume.readyCount} questions${resume.dureeS ? ` · ${ecrireDuree(resume.dureeS)}` : ''}` : ''}
                    {q.multiplicateur > 1 && ` · points ×${q.multiplicateur}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-small btn-icon"
                  aria-label={`Retirer « ${q.titre} »`}
                  onClick={() => setQuiz(quiz.filter((_, j) => j !== i))}
                >
                  <Icon name="x" />
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" className={'btn btn-block' + (quiz.length === 0 ? ' ajouter-premier' : '')} onClick={() => setChoisir(true)}>
          <Icon name="plus" />
          {quiz.length === 0 ? 'Ajouter un quiz' : 'Ajouter un autre quiz'}
        </button>
      </section>

      <section className="salon-bloc" aria-labelledby="salon-ecran">
        <span className="label" id="salon-ecran">
          Où voit-on les questions&nbsp;?
        </span>
        <div className="choix-duo" role="group" aria-labelledby="salon-ecran">
          <button type="button" className={'choix-tuile' + (ecran === 'telephones' ? ' selected' : '')} aria-pressed={ecran === 'telephones'} onClick={() => setEcran('telephones')}>
            <Icon name="smartphone" />
            Sur nos téléphones
          </button>
          <button type="button" className={'choix-tuile' + (ecran === 'tele' ? ' selected' : '')} aria-pressed={ecran === 'tele'} onClick={() => setEcran('tele')}>
            <Icon name="monitor" />
            Sur une télé
          </button>
        </div>
        {ecran === 'tele' &&
          (teleBranchee ? (
            <p className="tele-branchee" role="status">
              <Icon name="check-circle" /> Télé branchée
            </p>
          ) : (
            <form
              className="brancher-tele"
              onSubmit={e => {
                e.preventDefault()
                void brancher()
              }}
            >
              <label className="label" htmlFor="code-tele">
                Le code affiché sur la télé
              </label>
              <div className="row">
                <input
                  id="code-tele"
                  className="input"
                  value={codeTele}
                  maxLength={7}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ABC 234"
                  onChange={e => setCodeTele(e.target.value)}
                />
                <button className="btn btn-primary" disabled={busy || codeTele.replace(/\s/g, '').length < 6}>
                  Brancher
                </button>
              </div>
              <p className="muted small">
                Sur la télé, ouvre <strong>{window.location.host}/tele</strong>
              </p>
            </form>
          ))}
      </section>

      <section className="salon-bloc" aria-labelledby="salon-toi">
        <span className="label" id="salon-toi">
          Et toi&nbsp;?
        </span>
        <div className="choix-duo" role="group" aria-labelledby="salon-toi">
          <button type="button" className={'choix-tuile' + (joue ? ' selected' : '')} aria-pressed={joue} onClick={() => setJoue(true)}>
            <Icon name="users" />
            Je joue aussi
          </button>
          <button type="button" className={'choix-tuile' + (!joue ? ' selected' : '')} aria-pressed={!joue} onClick={() => setJoue(false)}>
            <Icon name="monitor" />
            J’anime seulement
          </button>
        </div>
        {!joue && (
          <p className="muted small salon-aide">
            Ton téléphone devient la console : la bonne réponse, qui a répondu, la salle en direct. Ni points ni place pour toi.
          </p>
        )}
      </section>

      {/* Ce qu'on ne règle presque jamais : replié, ses valeurs dites dans son titre. */}
      <details className="reglages-salon">
        <summary>
          <Icon name="list" className="reglages-icone" />
          <span>
            <b>Réglages</b>
            <span className="muted small">
              {rythme === null ? 'Suivante au clic' : `Suivante après ${rythme} s`} · {equipes ? 'en équipes' : 'chacun pour soi'}
            </span>
          </span>
          <Icon name="chevron-down" className="repli-chevron" />
        </summary>
        <span className="label">Question suivante</span>
        <div className="enchainement" role="group" aria-label="Question suivante">
          {PALIERS_ENCHAINEMENT.map(p => (
            <button key={p ?? 'clic'} type="button" className={'pill-btn' + (rythme === p ? ' active' : '')} aria-pressed={rythme === p} onClick={() => setRythme(p)}>
              {p === null ? 'Au clic' : `${p} s`}
            </button>
          ))}
        </div>
        <span className="label">Équipes</span>
        <div className="enchainement" role="group" aria-label="Équipes">
          <button type="button" className={'pill-btn' + (!equipes ? ' active' : '')} aria-pressed={!equipes} onClick={() => setEquipes(false)}>
            Chacun pour soi
          </button>
          <button type="button" className={'pill-btn' + (equipes ? ' active' : '')} aria-pressed={equipes} onClick={() => setEquipes(true)}>
            En équipes
          </button>
        </div>
        {quiz.length > 0 && <span className="label">Points</span>}
        {quiz.map((q, i) => (
          <div key={q.id} className="reglage-points">
            <span className="small">{q.titre}</span>
            <span className="row" role="group" aria-label={`Points de « ${q.titre} »`}>
              {([1, 2, 3] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  className={'pill-btn' + (q.multiplicateur === m ? ' active' : '')}
                  aria-pressed={q.multiplicateur === m}
                  onClick={() => setQuiz(quiz.map((x, j) => (j === i ? { ...x, multiplicateur: m } : x)))}
                >
                  ×{m}
                </button>
              ))}
            </span>
          </div>
        ))}
      </details>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || quiz.length === 0 || undefined} onClick={() => void ouvrir()}>
        <Icon name="play" />
        Ouvrir le salon
      </button>

      {choisir && (
        <Feuille titre="Ajouter un quiz" onFermer={() => setChoisir(false)}>
          <label className="recherche-sobre">
            <Icon name="search" />
            <input type="search" value={cherche} placeholder="Chercher un quiz" aria-label="Chercher un quiz" onChange={e => setCherche(e.target.value)} />
          </label>
          <span className="label">Mes quiz</span>
          {jouables.length === 0 && <p className="muted small">{cherche ? 'Aucun de tes quiz ne porte ces lettres.' : 'Pas encore de quiz prêt à jouer.'}</p>}
          {jouables.map(q => (
            <Choix
              key={q.id}
              icone="plus"
              titre={q.title}
              detail={`${q.readyCount} questions${q.dureeS ? ` · ${ecrireDuree(q.dureeS)}` : ''}${q.joue ? ` · joué ${q.joue.fois} fois` : ' · jamais joué'}`}
              onClick={() => ajouter(q)}
            />
          ))}
          <a className="btn btn-small" href="/edit">
            <Icon name="edit" />
            Écrire un quiz
          </a>
          {livres.length > 0 && (
            <>
              <span className="label">Les modèles</span>
              {livres.map(m => (
                <Choix
                  key={m.id}
                  icone="sparkles"
                  titre={m.title}
                  detail={`${m.pretes} questions · une copie rejoint tes quiz`}
                  disabled={busy}
                  onClick={() => void depuisModele(m)}
                />
              ))}
            </>
          )}
        </Feuille>
      )}
    </div>
  )
}

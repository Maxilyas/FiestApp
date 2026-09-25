// Le programme de ce soir, dans « Mes quiz » (rapport du 25 septembre 2026,
// lot 3) : les quiz dans l'ordre, chacun avec son multiplicateur — la finale
// en ×2. À la console, « Lancer un quiz » propose ensuite le premier qu'on
// n'a pas joué ce soir, déjà réglé.
import { useCallback, useRef, useState } from 'react'
import { api } from '../api'
import { ecrireDuree, type QuizSummary } from '../../../shared/library'
import { titreDuJour, type EntreeDeProgramme, type Multiplicateur, type Programme } from '../../../shared/programme'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'
import { espacesFines } from '../format'

/**
 * Les programmes de l'espace, et les gestes qui les changent. Ajouter,
 * ranger, régler un quiz s'affiche aussitôt, puis part au serveur, une
 * écriture après l'autre — chacune porte les entrées du moment, et deux
 * clics d'affilée ne s'écrasent pas. Le reste (commencer, nommer, changer
 * de programme, supprimer) attend sa réponse, le panneau en pause.
 */
export function useProgrammes(onErreur: (message: string) => void) {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [occupe, setOccupe] = useState(false)
  const etat = useRef<Programme[]>([])
  const file = useRef<Promise<unknown>>(Promise.resolve())
  const poser = (ps: Programme[]) => {
    etat.current = ps
    setProgrammes(ps)
  }

  const recharger = useCallback(async () => {
    try {
      poser(await api.programmes.list())
    } catch {
      // La liste des quiz, chargée avec, dit déjà ce qui ne va pas.
    }
  }, [])

  /** Dans l'ordre des gestes. Un échec le dit, et l'on repart de ce que le serveur garde. */
  const enFile = (geste: () => Promise<unknown>) => {
    const suite = file.current.then(geste).catch(async e => {
      onErreur((e as Error).message)
      await recharger()
    })
    file.current = suite
    return suite
  }

  const aSonTour = (geste: () => Promise<unknown>) => {
    setOccupe(true)
    return enFile(async () => {
      await geste()
      await recharger()
    }).finally(() => setOccupe(false))
  }

  /** Les entrées du programme de ce soir : aussitôt à l'écran, puis au serveur. */
  const changerEntrees = (entrees: EntreeDeProgramme[]) => {
    const p = etat.current.find(x => x.actif)
    if (!p) return
    poser(etat.current.map(x => (x.id === p.id ? { ...x, entrees } : x)))
    // Les entrées du moment où l'écriture part, pas celles du clic : trois
    // clics rapides font trois écritures, la dernière porte tout.
    enFile(() => api.programmes.modifier(p.id, { entrees: etat.current.find(x => x.id === p.id)?.entrees ?? entrees }))
  }

  const actif = programmes.find(p => p.actif) ?? null
  return {
    programmes,
    actif,
    occupe,
    recharger,
    changerEntrees,
    /** Au programme de ce soir, ou retiré. Le premier quiz ajouté commence le programme. */
    basculer: (quizId: string) => {
      const p = etat.current.find(x => x.actif)
      if (!p) return void aSonTour(() => api.programmes.creer(titreDuJour(new Date()), [{ quizId, multiplier: 1 }]))
      const dedans = p.entrees.some(e => e.quizId === quizId)
      changerEntrees(dedans ? p.entrees.filter(e => e.quizId !== quizId) : [...p.entrees, { quizId, multiplier: 1 }])
    },
    renommer: (titre: string) => {
      const p = etat.current.find(x => x.actif)
      if (p && titre.trim() && titre.trim() !== p.titre) void aSonTour(() => api.programmes.modifier(p.id, { titre }))
    },
    activer: (id: string) => void aSonTour(() => api.programmes.activer(id, true)),
    ranger: () => {
      const p = etat.current.find(x => x.actif)
      if (p) void aSonTour(() => api.programmes.activer(p.id, false))
    },
    nouveau: () => void aSonTour(() => api.programmes.creer(titreDuJour(new Date()))),
    supprimer: async (p: Programme) => {
      const ok = await confirmDialog({
        title: `Supprimer le programme « ${p.titre} » ?`,
        message: 'Ses quiz restent dans ta bibliothèque : seul l’ordre de la soirée disparaît.',
        confirmLabel: 'Supprimer le programme',
        danger: true,
      })
      if (ok) void aSonTour(() => api.programmes.supprimer(p.id))
    },
  }
}

export type Programmes = ReturnType<typeof useProgrammes>

/**
 * Le panneau du programme, en tête de « Mes quiz ». Sans programme ce soir,
 * une ligne pour en reprendre un rangé ; sans aucun programme, rien : le
 * bouton « Au programme » de chaque ligne suffit à commencer.
 */
export function PanneauProgramme({ prog, quizzes }: { prog: Programmes; quizzes: QuizSummary[] }) {
  const parId = new Map(quizzes.map(q => [q.id, q]))
  const { actif, occupe } = prog
  const autres = prog.programmes.filter(p => !p.actif)
  const [nom, setNom] = useState<string | null>(null)
  // Replié, une ligne : au téléphone, le panneau déplié repoussait la
  // bibliothèque d'un écran entier, pendant qu'on y cherchait quoi ajouter.
  const [replie, setReplie] = useState(lireReplie)
  const replier = () =>
    setReplie(r => {
      garderReplie(!r)
      return !r
    })

  if (!actif) {
    if (autres.length === 0) return null
    return (
      <div className="card programme programme-range">
        <span className="muted">Aucun programme ce soir.</span>
        <label className="row">
          <span className="sr-only">Reprendre un programme</span>
          <select className="select-discret" value="" disabled={occupe} onChange={e => e.target.value && prog.activer(e.target.value)}>
            <option value="">Reprendre un programme…</option>
            {autres.map(p => (
              <option key={p.id} value={p.id}>
                {p.titre}
              </option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  const entrees = actif.entrees.filter(e => parId.has(e.quizId))
  const duree = entrees.reduce((s, e) => s + (parId.get(e.quizId)?.dureeS ?? 0), 0)
  // Les gestes portent sur la liste entière : une entrée d'un quiz supprimé
  // depuis tombe au passage.
  const deplacer = (i: number, sens: -1 | 1) => {
    const copie = [...entrees]
    ;[copie[i], copie[i + sens]] = [copie[i + sens], copie[i]]
    prog.changerEntrees(copie)
  }
  const regler = (i: number, multiplier: Multiplicateur) => prog.changerEntrees(entrees.map((e, j) => (j === i ? { ...e, multiplier } : e)))

  const compte = `${entrees.length} quiz${duree > 0 ? ` · ${ecrireDuree(duree)}` : ''}`
  return (
    <section className="card programme" aria-labelledby="programme-surtitre">
      <div className="programme-tete">
        <span className="programme-surtitre" id="programme-surtitre">
          Programme de ce soir
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-small btn-icon programme-replier"
          aria-expanded={!replie}
          aria-controls="programme-corps"
          aria-label="Le détail du programme"
          onClick={replier}
        >
          <Icon name="chevron-down" />
        </button>
      </div>
      {replie ? (
        <p className="programme-resume">
          {actif.titre} <span className="muted small">· {compte}</span>
        </p>
      ) : (
        <div className="programme-corps" id="programme-corps">
          <div className="programme-nommer">
            <input
              className="input programme-nom"
              value={nom ?? actif.titre}
              maxLength={60}
              aria-label="Nom du programme"
              disabled={occupe}
              onChange={e => setNom(e.target.value)}
              onBlur={() => {
                if (nom !== null) prog.renommer(nom)
                setNom(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
            <span className="muted small">{compte}</span>
          </div>
          {entrees.length === 0 ? (
            <p className="muted small">
              {espacesFines('Ajoute des quiz avec « Au programme », sur leur ligne : ils se joueront dans l’ordre.')}
            </p>
          ) : (
            <ol className="programme-liste">
              {entrees.map((e, i) => {
                const q = parId.get(e.quizId)!
                const alerte = q.archivedAt
                  ? 'archivé : il ne se jouera pas'
                  : q.readyCount === 0
                    ? 'aucune question prête : il ne se jouera pas'
                    : ''
                return (
                  <li key={e.quizId} className="programme-entree">
                    <span className="programme-rang" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="programme-quiz">
                      <span className="programme-quiz-titre">{q.title}</span>
                      <span className={alerte ? 'warn small' : 'muted small'}>
                        {alerte || `${q.readyCount} question${q.readyCount > 1 ? 's' : ''}${q.dureeS ? ` · ${ecrireDuree(q.dureeS)}` : ''}`}
                      </span>
                    </span>
                    <span className="row programme-gestes">
                      <span className="row programme-points" role="group" aria-label={`Points de « ${q.title} »`}>
                        {([1, 2, 3] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            className={'pill-btn' + (e.multiplier === m ? ' active' : '')}
                            aria-pressed={e.multiplier === m}
                            onClick={() => regler(i, m)}
                          >
                            ×{m}
                          </button>
                        ))}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small btn-icon"
                        aria-label={`Monter « ${q.title} »`}
                        disabled={i === 0}
                        onClick={() => deplacer(i, -1)}
                      >
                        <Icon name="arrow-up" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small btn-icon"
                        aria-label={`Descendre « ${q.title} »`}
                        disabled={i === entrees.length - 1}
                        onClick={() => deplacer(i, 1)}
                      >
                        <Icon name="arrow-down" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small btn-icon"
                        aria-label={`Retirer « ${q.title} » du programme`}
                        onClick={() => prog.changerEntrees(entrees.filter((_, j) => j !== i))}
                      >
                        <Icon name="x" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="row programme-pied">
            <span className="muted small programme-aide">
              {espacesFines('À la console, « Lancer un quiz » propose le premier qu’on n’a pas joué ce soir, déjà réglé.')}
            </span>
            <span className="row">
              {autres.length > 0 && (
                <label className="row">
                  <span className="sr-only">Changer de programme</span>
                  <select
                    className="select-discret"
                    value=""
                    disabled={occupe}
                    onChange={e => e.target.value && prog.activer(e.target.value)}
                  >
                    <option value="">Autres programmes…</option>
                    {autres.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.titre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className="btn btn-ghost btn-small" disabled={occupe || entrees.length === 0} onClick={prog.nouveau}>
                Nouveau programme
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={occupe}
                title="Il reste rangé, et se reprend d’un geste : la console repropose toute la bibliothèque"
                onClick={prog.ranger}
              >
                Ranger
              </button>
              <button type="button" className="btn btn-ghost btn-small" disabled={occupe} onClick={() => prog.supprimer(actif)}>
                Supprimer le programme
              </button>
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

const REPLIE = 'fiestappProgrammeReplie'

/** Le panneau replié ou non, retenu par ce navigateur — déplié s'il refuse de s'en souvenir. */
function lireReplie(): boolean {
  try {
    return localStorage.getItem(REPLIE) === '1'
  } catch {
    return false
  }
}

function garderReplie(replie: boolean) {
  try {
    localStorage.setItem(REPLIE, replie ? '1' : '0')
  } catch {
    // Rien de grave : il se redépliera à la prochaine visite.
  }
}

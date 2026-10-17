import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { Chiffre, GrapheDesJours } from './QgModes'
import { FicheDuJoueurAuQg } from './QgFicheJoueur'
import { supprimerLeProfil } from './AdminProfils'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { MODES_DU_QG, NOM_DU_MODE, type ModeDuQg } from '../../../shared/qg'
import {
  JOUEURS_DE_L_ACTIVITE,
  modePrefere,
  totalDesModes,
  type ActiviteDUnJoueur,
  type JoueurDeLActivite,
  type PageDeLActivite,
  type ParMode,
} from '../../../shared/qgActivite'

/** « 1 question », « 0 question », « 12 questions » : zéro s'écrit au singulier. */
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
const questions = (n: number) => pluriel(n, 'question')

/** Ce qu'une partie s'appelle dans chaque mode : un quiz de soirée, une partie du jour, une partie de campagne, un duel. */
export function parties(m: ModeDuQg, n: number): string {
  return m === 'soiree' ? `${formatNumber(n)} quiz` : m === 'duel' ? pluriel(n, 'duel') : pluriel(n, 'partie')
}

/** Le mode, dans une phrase : « surtout la campagne ». */
const LE_MODE: Record<ModeDuQg, string> = { soiree: 'les soirées', campagne: 'la campagne', jour: 'le quiz du jour', duel: 'les duels' }

/** Les joueurs qu'une vue montre d'abord ; « Et N de plus » montre le reste, jusqu'à cinquante. */
const JOUEURS_D_ABORD = 10

/**
 * L'activité au QG (`/admin#activite`, le souhait du propriétaire du
 * 17 octobre 2026 : « la quantité de ce que font les joueurs […] sur quoi
 * une personne s'acharne ou pas ») : trente jours de questions jouées et de
 * parties, mode par mode, puis qui joue à quoi. La page se lit à son
 * ouverture.
 */
export function QgActivite() {
  const [page, setPage] = useState<PageDeLActivite | null>(null)
  const [error, setError] = useState('')
  const [relire, setRelire] = useState(0)
  useEffect(() => {
    api.admin.activite().then(setPage, e => setError(motifDe(e)))
  }, [relire])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return <ActiviteAuQg page={page} apresUnGeste={() => setRelire(n => n + 1)} />
}

/** La page lue : les trente jours en tout, jour par jour, puis les joueurs. */
export function ActiviteAuQg({ page, apresUnGeste }: { page: PageDeLActivite; apresUnGeste?: () => void }) {
  return (
    <>
      <p className="muted small">
        Trente jours, mode par mode. Une question jouée est une question posée à un joueur, qu’il y ait répondu ou l’ait laissée au temps ; une partie, un quiz
        de soirée, une partie du jour ou de campagne, un duel. La vue d’ensemble compte les joueurs, cette page ce qu’ils ont joué.
      </p>
      <CesTrenteJours totaux={page.totaux} />
      <JourParJour page={page} />
      <QuiJoueAQuoi page={page} apresUnGeste={apresUnGeste} />
    </>
  )
}

/** Les trente jours en tout : une tuile par mode, ses questions jouées en grand, ses parties et ses joueurs dessous. */
function CesTrenteJours({ totaux }: { totaux: PageDeLActivite['totaux'] }) {
  return (
    <section className="qg-jour" aria-labelledby="activite-trente-jours">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="activite-trente-jours">
          Ces trente jours
        </h2>
        <span className="muted small">{questions(totalDesModes(totaux.questions))} jouées, tous modes confondus</span>
      </div>
      <ul className="qg-tuiles qg-tuiles-quatre">
        {MODES_DU_QG.map(m => (
          <Chiffre
            key={m}
            nom={NOM_DU_MODE[m]}
            valeur={formatNumber(totaux.questions[m])}
            detail={[
              'questions',
              parties(m, totaux.parties[m]),
              m === 'soiree' ? `${pluriel(totaux.soirees, 'soirée')}, ${pluriel(totaux.joueurs.soiree, 'invité')}` : pluriel(totaux.joueurs[m], 'joueur'),
            ].join(' · ')}
          />
        ))}
      </ul>
    </section>
  )
}

/**
 * Jour par jour, un petit graphique par mode, chacun à son échelle : les
 * soirées montent d'un coup le samedi, la campagne tous les jours — à une
 * seule échelle, on ne voyait que les soirées. Les questions jouées, ou les
 * parties.
 */
function JourParJour({ page }: { page: PageDeLActivite }) {
  const [quoi, setQuoi] = useState<'questions' | 'parties'>('questions')
  const jours = page.parJour.map(j => j.jour)
  return (
    <section className="qg-jour" aria-labelledby="activite-jours">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="activite-jours">
          Jour par jour
        </h2>
      </div>
      <div className="onglets onglets-puces" role="group" aria-label="Ce que les graphiques comptent">
        {(['questions', 'parties'] as const).map(q => (
          <button key={q} type="button" className={'onglet' + (quoi === q ? ' actif' : '')} aria-pressed={quoi === q} onClick={() => setQuoi(q)}>
            {q === 'questions' ? 'Questions jouées' : 'Parties'}
          </button>
        ))}
      </div>
      <div className="qg-carte qg-ecran">
        <ul className="qg-multiples">
          {MODES_DU_QG.map(m => {
            const valeurs = page.parJour.map(j => j[quoi][m])
            const total = valeurs.reduce((n, x) => n + x, 0)
            const dire = (n: number) => (quoi === 'questions' ? questions(n) : parties(m, n))
            return (
              <li key={m} className="qg-multiple">
                <div className="qg-multiple-tete">
                  <b>{NOM_DU_MODE[m]}</b>
                  <span className="num">{formatNumber(total)}</span>
                </div>
                <GrapheDesJours
                  jours={jours}
                  valeurs={valeurs}
                  classe={`qg-mode-${m}`}
                  dire={dire}
                  titre={`${NOM_DU_MODE[m]}, ${quoi === 'questions' ? 'les questions jouées' : 'les parties'}`}
                  petit
                />
                <span className="muted small">{`${formatNumber(Math.round(total / Math.max(1, jours.length)))} par jour en moyenne`}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

type Vue = 'tous' | ModeDuQg

/** Les joueurs d'une vue, dans son ordre : tous les modes, ou un seul — ceux qui y ont joué, le plus assidu d'abord. */
export function joueursDeLaVue(joueurs: readonly JoueurDeLActivite[], vue: Vue): JoueurDeLActivite[] {
  if (vue === 'tous') return joueurs.slice(0, JOUEURS_DE_L_ACTIVITE)
  return joueurs
    .filter(j => j.questions[vue] > 0 || j.parties[vue] > 0)
    .sort((a, b) => b.questions[vue] - a.questions[vue] || b.parties[vue] - a.parties[vue])
    .slice(0, JOUEURS_DE_L_ACTIVITE)
}

/** « 1 240 questions · 64 parties · 18 jours sur 30 » : tous les modes ; dans un mode, les siens. */
function ceQuIlAJoue(j: ActiviteDUnJoueur, vue: Vue, jours: number): string {
  if (vue !== 'tous') return `${questions(j.questions[vue])} · ${parties(vue, j.parties[vue])}`
  const prefere = modePrefere(j)
  return [
    questions(totalDesModes(j.questions)),
    pluriel(j.jours, 'jour') + ` sur ${formatNumber(jours)}`,
    prefere && (prefere.part === 100 ? `rien que ${LE_MODE[prefere.mode]}` : `surtout ${LE_MODE[prefere.mode]}, ${formatNumber(prefere.part)} %`),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Qui joue à quoi : chaque profil et ses questions jouées, en une barre —
 * sa longueur dit combien, ses couleurs à quoi. Tous les modes, ou un seul ;
 * une ligne ouvre sa fiche, comme dans « Les profils ». Les invités sans
 * profil n'y sont pas : ils ne comptent qu'au volume des soirées.
 */
function QuiJoueAQuoi({ page, apresUnGeste }: { page: PageDeLActivite; apresUnGeste?: () => void }) {
  const [vue, setVue] = useState<Vue>('tous')
  const [tous, setTous] = useState(false)
  const [ouvert, setOuvert] = useState<{ id: string; nom: string } | null>(null)
  const lignes = joueursDeLaVue(page.joueurs, vue)
  const montres = tous ? lignes : lignes.slice(0, JOUEURS_D_ABORD)
  const valeur = (q: ParMode) => (vue === 'tous' ? totalDesModes(q) : q[vue])
  const plusHaut = Math.max(1, ...lignes.map(j => valeur(j.questions)))
  const choisir = (v: Vue) => {
    setVue(v)
    setTous(false)
  }
  // Tous les modes : les cinquante plus assidus au plus ; ceux d'après se comptent.
  const autres = vue === 'tous' ? page.profilsActifs - lignes.length : 0
  return (
    <section className="qg-jour" aria-labelledby="activite-joueurs">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="activite-joueurs">
          Qui joue à quoi
        </h2>
        <span className="muted small">{pluriel(page.profilsActifs, 'profil actif', 'profils actifs')} ces trente jours</span>
      </div>
      <div className="onglets onglets-puces" role="group" aria-label="Le mode">
        {(['tous', ...MODES_DU_QG] as const).map(v => (
          <button key={v} type="button" className={'onglet' + (vue === v ? ' actif' : '')} aria-pressed={vue === v} onClick={() => choisir(v)}>
            {v === 'tous' ? 'Tous les modes' : NOM_DU_MODE[v]}
          </button>
        ))}
      </div>
      <div className="qg-carte qg-ecran">
        {lignes.length === 0 ? (
          <p className="muted small">{vue === 'tous' ? 'Aucun profil n’a joué ces trente jours.' : `Aucun profil n’a joué ${vue === 'soiree' ? 'en soirée' : `à ${LE_MODE[vue]}`} ces trente jours.`}</p>
        ) : (
          <>
            {vue === 'tous' && (
              <ul className="qg-legende-modes" aria-label="Les couleurs des modes">
                {MODES_DU_QG.map(m => (
                  <li key={m}>
                    <i className={`qg-pastille-mode qg-mode-${m}`} aria-hidden="true" />
                    {NOM_DU_MODE[m]}
                  </li>
                ))}
              </ul>
            )}
            <ol className="qg-liste">
              {montres.map(j => (
                <li key={j.id}>
                  <button type="button" className="qg-ligne" onClick={() => setOuvert({ id: j.id, nom: j.nom })}>
                    <span className="qg-ligne-texte">
                      <span className="qg-assidu-nom">
                        <b>{espacesFines(j.nom)}</b>
                        {j.suspendu && <span className="etiquette admin-etat-ferme">suspendu</span>}
                      </span>
                      <span className="qg-assidu-barre" role="img" aria-label={repartition(j) || 'aucune question jouée'}>
                        {/* Chaque morceau rend au suivant le filet qui les sépare : la barre du plus assidu tient juste. */}
                        {(vue === 'tous' ? MODES_DU_QG : [vue]).map(m =>
                          j.questions[m] > 0 ? <span key={m} className={`qg-mode-${m}`} style={{ width: `calc(${(j.questions[m] / plusHaut) * 100}% - 2px)` }} /> : null,
                        )}
                      </span>
                      <span className="muted small">{ceQuIlAJoue(j, vue, page.parJour.length)}</span>
                    </span>
                    <Icon name="chevron-right" className="qg-chevron" />
                  </button>
                </li>
              ))}
            </ol>
            {!tous && lignes.length > JOUEURS_D_ABORD && (
              <button type="button" className="lien-discret qg-suite" onClick={() => setTous(true)}>
                Et {formatNumber(lignes.length - JOUEURS_D_ABORD)} de plus
                <Icon name="chevron-down" />
              </button>
            )}
            {(tous || lignes.length <= JOUEURS_D_ABORD) && autres > 0 && (
              <p className="muted small">{autres > 1 ? `Les ${formatNumber(autres)} autres profils actifs ont moins joué.` : 'Un autre profil actif a moins joué.'}</p>
            )}
          </>
        )}
      </div>
      {ouvert && (
        <Feuille titre={ouvert.nom} onFermer={() => setOuvert(null)}>
          <FicheDuJoueurAuQg
            key={ouvert.id}
            profil={ouvert}
            onChange={f => {
              setOuvert({ id: f.id, nom: f.nom })
              apresUnGeste?.()
            }}
            onSupprimer={p => {
              void supprimerLeProfil(p).then(fait => {
                if (!fait) return
                setOuvert(null)
                apresUnGeste?.()
              })
            }}
          />
        </Feuille>
      )}
    </section>
  )
}

/** Ce que la barre montre, pour le lecteur d'écran : chaque mode où il a joué. */
function repartition(j: ActiviteDUnJoueur): string {
  return MODES_DU_QG.filter(m => j.questions[m] > 0)
    .map(m => `${NOM_DU_MODE[m]} : ${questions(j.questions[m])}`)
    .join(', ')
}

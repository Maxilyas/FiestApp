// La page du Grand Prix (`/grand-prix`, `shared/grandPrix.ts`) : le départ —
// le cavalier fantôme, ce qu'on gagne, la règle, ceux qui l'ont battu —, la
// course — les deux chevaux d'étoiles, l'obstacle qui approche, sa question —,
// la révélation de chaque obstacle, l'arrivée ; et, à la personne fêtée, le
// bilan de son fantôme. La maquette validée par le propriétaire le
// 19 novembre 2026 (`retours/2026-11-19/grand-prix/README.md`).
//
// Comme le quiz du jour, sans liaison temps réel : l'obstacle se sert au
// serveur, son échéance se lit à `serverNow()` (invariant 6), et passé
// l'échéance la page redemande où elle en est — le serveur compte le refus
// (`insister`). Le temps du fantôme arrive avec l'obstacle, sa réponse avec
// la révélation (invariant 1).

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, motifDe, UnauthorizedError } from '../api'
import { serverNow, resetClock } from '../clock'
import { insister } from '../insister'
import { confirmDialog } from '../components/Dialog'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Feuille, Sortie, SousLePouce } from '../components/Pieces'
import { ChevalDEtoiles, CielDuGrandPrix, Flot, Obstacle } from '../components/GrandPrix'
import { iconeDuSujet } from '../iconeDuSujet'
import { sujetParCle } from '../../../shared/sujets'
import { gesteAccepte } from '../../../shared/console'
import { legendaire } from '../../../shared/legendaires'
import {
  PENALITE_D_UNE_BARRE,
  avanceDite,
  chronoDit,
  essaiDit,
  pointsDits,
  type CourseVue,
  type EtatDuGrandPrix,
  type RevelationDObstacle,
  type ScoreDeCourse,
  type ThemeDuTerrain,
  type VainqueurVu,
} from '../../../shared/grandPrix'

/**
 * Après l'échéance d'un obstacle, la page redemande où elle en est : la marge
 * du réseau du serveur (`GRACE_MS`, `games/quiz.ts`), recopiée comme au quiz
 * du jour (`APRES_ECHEANCE_MS`, `JourApp.tsx`), et un peu plus — changée au
 * serveur, elle se change ici aussi.
 */
const APRES_L_ECHEANCE_MS = 1500 + 600

/** Les lettres des réponses, comme sur la maquette. */
const LETTRES = ['A', 'B', 'C', 'D']

const barresDites = (n: number) => (n === 1 ? 'une barre' : n === 2 ? 'deux barres' : `${n} barres`)

/** L'heure du serveur, relue au dixième de seconde tant que l'écran en a besoin. */
function useMaintenant(actif: boolean): number {
  const [t, setT] = useState(() => serverNow())
  useEffect(() => {
    if (!actif) return
    setT(serverNow())
    const minuterie = setInterval(() => setT(serverNow()), 100)
    return () => clearInterval(minuterie)
  }, [actif])
  return t
}

export function GrandPrixApp() {
  // L'essai de l'administrateur, ouvert depuis le QG (`?essai=<id>`) : hors classement, sans flot.
  const essai = new URLSearchParams(location.search).get('essai')
  const [etat, setEtat] = useState<EtatDuGrandPrix | null>(null)
  const [erreur, setErreur] = useState<{ motif: string; connexion: boolean } | null>(null)
  const [revelation, setRevelation] = useState<{ r: RevelationDObstacle; tropTard: boolean } | null>(null)
  const [arrivee, setArrivee] = useState<CourseVue | null>(null)
  const [arriveeVue, setArriveeVue] = useState(false)
  const [enRoute, setEnRoute] = useState(false)
  const [refus, setRefus] = useState('')
  const changement = useRef<number | null>(null)
  const courseMontree = useRef<{ id: string; position: number } | null>(null)

  /** Une réponse du serveur : la page la suit, et montre la révélation d'un obstacle que le serveur a compté refus. */
  const suivre = useCallback((e: EtatDuGrandPrix) => {
    const avant = courseMontree.current
    const c = e.course
    if (avant && c && c.id === avant.id && c.position > avant.position && c.revelations.length > 0) {
      setRevelation({ r: c.revelations[c.revelations.length - 1], tropTard: true })
    }
    if (c?.finie) {
      setArrivee(c)
      setArriveeVue(false)
    }
    courseMontree.current = c && c.obstacle ? { id: c.id, position: c.position } : c ? { id: c.id, position: c.position } : null
    setEtat(e)
  }, [])

  const lire = useCallback(() => (essai ? api.grandPrix.essai(essai) : api.grandPrix.etat()).then(suivre), [essai, suivre])

  useEffect(() => {
    lire().catch(e => setErreur({ motif: motifDe(e), connexion: e instanceof UnauthorizedError }))
    // Revenu sur l'onglet, l'heure du serveur se remesure : le téléphone a pu dormir.
    const revenu = () => {
      if (document.visibilityState === 'visible') {
        resetClock()
        lire().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', revenu)
    return () => document.removeEventListener('visibilitychange', revenu)
  }, [lire])

  const obstacle = etat?.course?.obstacle ?? null
  // Passé l'échéance, la page redemande : le serveur compte le refus et le dit.
  useEffect(() => {
    if (!obstacle) return
    return insister(() => lire(), { premier: Math.max(0, obstacle.echeance - serverNow()) + APRES_L_ECHEANCE_MS })
  }, [obstacle?.echeance, lire]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (obstacle) changement.current = Date.now()
  }, [obstacle?.position, obstacle?.echeance]) // eslint-disable-line react-hooks/exhaustive-deps

  const geste = async (travail: () => Promise<void>) => {
    if (enRoute) return
    setEnRoute(true)
    setRefus('')
    try {
      await travail()
    } catch (e) {
      setRefus(motifDe(e))
    } finally {
      setEnRoute(false)
    }
  }

  const partir = () =>
    geste(async () => {
      const e = await (essai ? api.grandPrix.essayer(essai) : api.grandPrix.depart())
      setArrivee(null)
      setRevelation(null)
      suivre(e)
      window.scrollTo(0, 0)
    })

  const repondre = (choix: number) => {
    const c = etat?.course
    if (!c?.obstacle || !gesteAccepte(changement.current, Date.now())) return
    const position = c.obstacle.position
    return geste(async () => {
      const r = await api.grandPrix.repondre(c.id, position, choix)
      courseMontree.current = null
      setRevelation({ r: r.revelation, tropTard: r.tropTard })
      suivre(r)
    })
  }

  const suivante = () => {
    const c = etat?.course
    if (!c || c.finie) {
      setRevelation(null)
      setArriveeVue(true)
      return
    }
    return geste(async () => {
      const e = await api.grandPrix.suivante(c.id)
      setRevelation(null)
      suivre(e)
      window.scrollTo(0, 0)
    })
  }

  const quitter = async () => {
    const c = etat?.course
    if (!c) return
    const oui = await confirmDialog({ title: 'Quitter le parcours ?', message: 'Il ne comptera pas : un parcours neuf t’attendra au départ.', confirmLabel: 'Quitter', cancelLabel: 'Continuer' })
    if (!oui) return
    await geste(async () => {
      const e = await api.grandPrix.abandon(c.id)
      setRevelation(null)
      courseMontree.current = null
      suivre(e)
    })
  }

  if (erreur) {
    return (
      <div className="player-shell gp-page">
        <Sortie />
        <p className="error" role="alert">
          {erreur.motif}
        </p>
        {erreur.connexion && (
          <a className="btn btn-primary" href="/">
            Me connecter
          </a>
        )}
      </div>
    )
  }
  if (!etat) {
    return (
      <div className="player-shell gp-page">
        <p className="muted small">Chargement…</p>
      </div>
    )
  }
  if (!etat.grandPrix) {
    return (
      <div className="player-shell gp-page">
        <Sortie />
        <h1 className="gp-titre-simple">Le Grand Prix</h1>
        <p className="muted">Pas de Grand Prix aujourd’hui : il ne court qu’un jour, quand on fête quelqu’un.</p>
      </div>
    )
  }

  const g = etat.grandPrix
  if (revelation) {
    const course = etat.course ?? arrivee
    return <Revelation g={g} r={revelation.r} tropTard={revelation.tropTard} course={course} fin={!!course?.finie} enRoute={enRoute} onSuivant={suivante} refus={refus} />
  }
  if (arrivee && (arriveeVue || !etat.course)) {
    return <Arrivee etat={etat} course={arrivee} enRoute={enRoute} onRecourir={partir} refus={refus} essai={!!essai} />
  }
  if (etat.course?.obstacle) {
    return <Course etat={etat} course={etat.course} enRoute={enRoute} onRepondre={repondre} onQuitter={quitter} refus={refus} />
  }
  if (etat.course && etat.course.revelations.length > 0) {
    // Rechargée entre deux obstacles : la dernière révélation, et l'obstacle suivant.
    const r = etat.course.revelations[etat.course.revelations.length - 1]
    return <Revelation g={g} r={r} tropTard={false} course={etat.course} fin={false} enRoute={enRoute} onSuivant={suivante} refus={refus} />
  }
  return <Depart etat={etat} enRoute={enRoute} onPartir={partir} refus={refus} essai={!!essai} />
}

// ── Le départ ────────────────────────────────────────────────────────────

/**
 * Le départ tient sur un écran, son bouton compris (le propriétaire, le
 * 19 novembre 2026 : « Me battre moi-même » de la fêtée passait sous l'écran,
 * sous un bilan en phrases). Des blocs qu'on lit d'un coup d'œil, presque sans
 * phrase : le ciel et le titre, son terrain en trois emblèmes, le flot à
 * gagner, la règle en quatre pictogrammes, ceux qui l'ont battu. La fêtée n'a
 * ni le flot à gagner — le sien, d'or, brille dans son ciel — ni la règle :
 * son bilan prend leur place.
 */
function Depart({ etat, enRoute, onPartir, refus, essai }: { etat: EtatDuGrandPrix; enRoute: boolean; onPartir: () => void; refus: string; essai: boolean }) {
  const g = etat.grandPrix!
  const nom = g.fantome.nom
  const fete = etat.fete
  const titreDesVainqueurs = fete ? 'Ils t’ont battu' : `Ils ont battu ${nom}`
  const [tous, setTous] = useState(false)
  return (
    <div className="player-shell gp-page gp-depart">
      <header className="gp-tete">
        <CielDuGrandPrix />
        {fete ? <Flot ruban={g.ruban} honneur fantome={g.fantome} nom="Ton flot d’honneur" taille={64} className="gp-tete-flot" /> : <ChevalDEtoiles pose="saut" fantome className="gp-tete-cheval" />}
        <Sortie />
        <div className="gp-tete-texte">
          {essai && <span className="gp-surtitre">Essai · hors classement</span>}
          <h1>{g.titre}</h1>
          <span className="gp-fantome-ligne">
            <Avatar className="gp-fantome-avatar" avatar={g.fantome.avatar} finition={g.fantome.finition} eclat={g.fantome.eclat} legendaire={g.fantome.legendaire} sceau={g.fantome.sceau} />
            {fete ? 'Toute la bande court contre ton fantôme' : 'Son fantôme rejoue ses vraies réponses'}
          </span>
        </div>
      </header>

      {fete && etat.bilan && <BilanDuFantome etat={etat} onTous={() => setTous(true)} />}

      {g.terrain.length > 0 && <Terrain terrain={g.terrain} fete={!!fete} />}

      {!fete && (
        <section className="gp-carte gp-gain" aria-label="Ce qu’on gagne">
          <Flot ruban={g.ruban} fantome={g.fantome} nom={`Le flot du ${g.titre}`} taille={52} />
          <span className="gp-gain-texte">
            <b>{`Bats ${nom} : son flot`}</b>
            {g.prix && <span className="muted small">et {legendaire(g.prix)?.nom ?? 'un avatar'}</span>}
          </span>
          {g.prix && <Avatar className="gp-gain-prix" avatar="🐴" legendaire={g.prix} />}
        </section>
      )}

      {!fete && <Regles />}

      {!fete && !essai && etat.vainqueurs.length > 0 && <Vainqueurs etat={etat} titre={titreDesVainqueurs} onTous={() => setTous(true)} />}

      {refus && (
        <p className="error small" role="alert">
          {refus}
        </p>
      )}
      <SousLePouce className="gp-geste">
        <button type="button" className="btn btn-primary gp-partir" onClick={onPartir} disabled={enRoute}>
          {fete ? 'Me battre moi-même' : etat.departs > 0 ? 'Recourir' : 'Prendre le départ'}
        </button>
      </SousLePouce>
      {/* Hors du bilan de la fêtée : posée dans sa nuit, la feuille en aurait pris les couleurs. */}
      {tous && <TousLesVainqueurs etat={etat} titre={titreDesVainqueurs} onFermer={() => setTous(false)} />}
    </div>
  )
}

/** La règle en quatre pictogrammes, deux mots chacun : elle se voit avant de se lire. */
function Regles() {
  return (
    <ul className="gp-regles" aria-label="La règle">
      <li>
        <Icon name="flag" />
        10 obstacles
      </li>
      <li>
        <Icon name="x-circle" />
        Faute : {PENALITE_D_UNE_BARRE} pts
      </li>
      <li>
        <Icon name="timer" />
        Égalité : chrono
      </li>
      <li>
        <Icon name="infinity" />
        Essais illimités
      </li>
    </ul>
  )
}

/**
 * Son terrain : les thèmes où il a passé le plus de temps en campagne — le
 * Grand Prix le met en valeur sur ce qu'il aime (le souhait du propriétaire,
 * le 19 novembre 2026). Un emblème et un nom chacun : ses comptes se lisent au
 * QG, ici ils n'étaient que du texte de plus.
 */
function Terrain({ terrain, fete }: { terrain: readonly ThemeDuTerrain[]; fete: boolean }) {
  return (
    <section className="gp-terrain" aria-labelledby="gp-terrain">
      <h2 id="gp-terrain" className="gp-etiquette">
        {fete ? 'Sur ton terrain' : 'Sur son terrain'}
      </h2>
      <ul>
        {terrain.map(t => {
          const sujet = sujetParCle(t.cle)
          return (
            <li key={t.cle}>
              <span className="gp-terrain-icone" aria-hidden="true">
                <Icon name={sujet ? iconeDuSujet(sujet) : 'star'} />
              </span>
              {t.nom}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Ceux qui l'ont battu, dans l'ordre d'arrivée, et comment : à quel essai, et
 * de combien — des points, ou à points égaux, du temps (le propriétaire, le
 * 19 novembre 2026 : « plus de détails par rapport à la personne battue »).
 * Les trois premiers en lignes — deux sur un petit téléphone, pour que le
 * départ tienne sur l'écran —, et « Tous » ouvre la liste entière.
 */
function Vainqueurs({ etat, titre, onTous }: { etat: EtatDuGrandPrix; titre: string; onTous: () => void }) {
  const n = etat.vainqueurs.length
  return (
    <section className="gp-vainqueurs" aria-labelledby="gp-vainqueurs">
      <div className="gp-vainqueurs-tete">
        <h2 id="gp-vainqueurs" className="gp-etiquette">
          {titre}
        </h2>
        {/* Dès trois : sur un petit téléphone, la troisième ligne ne se voit plus. */}
        {n > 2 && (
          <button type="button" className="gp-tous" onClick={onTous}>
            Tous les {n}
            <Icon name="chevron-right" />
          </button>
        )}
      </div>
      <ol className="gp-lignes">
        {etat.vainqueurs.slice(0, 3).map(v => (
          <LigneDuVainqueur key={v.id} v={v} />
        ))}
      </ol>
    </section>
  )
}

function LigneDuVainqueur({ v }: { v: VainqueurVu }) {
  return (
    <li className="gp-ligne">
      <span className="gp-rang">{v.rang}</span>
      <Avatar className="gp-mini" avatar={v.avatar} finition={v.finition} eclat={v.eclat} legendaire={v.legendaire} sceau={v.sceau} />
      <span className="gp-ligne-nom">
        <b>{v.nom}</b>
        <span>{essaiDit(v.essai)}</span>
      </span>
      <span className="gp-avance">{avanceDite(v.avance)}</span>
    </li>
  )
}

/** Tous ceux qui l'ont battu, dans une feuille : la page n'en montre que les premiers. */
function TousLesVainqueurs({ etat, titre, onFermer }: { etat: EtatDuGrandPrix; titre: string; onFermer: () => void }) {
  return (
    <Feuille titre={titre} onFermer={onFermer} className="gp-tous-feuille">
      <ol className="gp-lignes">
        {etat.vainqueurs.map(v => (
          <LigneDuVainqueur key={v.id} v={v} />
        ))}
      </ol>
    </Feuille>
  )
}

/** Le bilan de la fêtée : deux chiffres, et ceux qui l'ont battue. */
function BilanDuFantome({ etat, onTous }: { etat: EtatDuGrandPrix; onTous: () => void }) {
  const b = etat.bilan!
  return (
    <section className="gp-bilan" aria-label="Ton fantôme, aujourd’hui">
      <div className="gp-bilan-chiffres">
        <span>
          <b>{b.coureurs}</b> {b.coureurs > 1 ? 'ont couru' : 'a couru'}
        </span>
        <span>
          <b>{b.vainqueurs}</b> {b.vainqueurs > 1 ? 't’ont battu' : 't’a battu'}
        </span>
      </div>
      {etat.vainqueurs.length > 0 && <Vainqueurs etat={etat} titre="Ils t’ont battu" onTous={onTous} />}
    </section>
  )
}

// ── La course ────────────────────────────────────────────────────────────

function Scores({ toi, fantome, nom }: { toi: ScoreDeCourse; fantome: ScoreDeCourse; nom: string }) {
  return (
    <div className="gp-scores">
      <span className="gp-score gp-score-toi">
        <b>Toi</b> {pointsDits(toi.points)} · {chronoDit(toi.tempsMs)}
      </span>
      <span className="gp-score gp-score-fantome">
        <b>{nom}</b> {pointsDits(fantome.points)} · {chronoDit(fantome.tempsMs)}
      </span>
    </div>
  )
}

function Course({ etat, course, enRoute, onRepondre, onQuitter, refus }: {
  etat: EtatDuGrandPrix
  course: CourseVue
  enRoute: boolean
  onRepondre: (choix: number) => void
  onQuitter: () => void
  refus: string
}) {
  const o = course.obstacle!
  const nom = etat.fete ? 'Ton fantôme' : etat.grandPrix!.fantome.nom
  const maintenant = useMaintenant(true)
  const montre = o.echeance - o.duree * 1000
  const ecoule = Math.max(0, maintenant - montre)
  const reste = Math.max(0, o.echeance - maintenant)
  const aSaute = o.fantomeMs !== null && ecoule >= o.fantomeMs
  const part = Math.min(1, ecoule / (o.duree * 1000))
  return (
    <div className="player-shell gp-page gp-course">
      <div className="gp-scene">
        <CielDuGrandPrix />
        <Obstacle className="gp-scene-obstacle" />
        <ChevalDEtoiles pose={aSaute ? 'saut' : 'galop'} fantome className={`gp-scene-fantome${aSaute ? ' gp-a-saute' : ''}`} />
        <ChevalDEtoiles pose="galop" className="gp-scene-toi" />
        <header className="gp-course-tete">
          <span className="gp-obstacle-numero">
            Obstacle {o.position + 1} <span>sur {course.total}</span>
          </span>
          <button type="button" className="gp-quitter" aria-label="Quitter le parcours" onClick={onQuitter}>
            <Icon name="x" />
          </button>
        </header>
        <Scores toi={course.toi} fantome={course.fantome} nom={nom} />
        <Piste position={o.position} total={course.total} fantomeDevant={aSaute} />
        <span className="gp-saut-du-fantome" aria-live="polite">
          {aSaute ? `${nom} a sauté · ${chronoDit(o.fantomeMs!)}` : ''}
        </span>
        <div className="gp-appel" role="timer" aria-label={`L’appel dans ${Math.ceil(reste / 1000)} secondes`}>
          <span className="gp-appel-barre">
            <span style={{ transform: `scaleX(${1 - part})` }} />
          </span>
          <span className="gp-appel-texte">{chronoDit(ecoule)}</span>
        </div>
      </div>
      <section className="gp-question" aria-labelledby="gp-question">
        {o.categorie && <span className="gp-categorie">{o.categorie}</span>}
        <h2 id="gp-question">{o.texte}</h2>
        <div className="gp-reponses">
          {o.reponses.map((rep, i) => (
            <button key={`${o.position}-${i}`} type="button" className="gp-reponse" onClick={() => onRepondre(i)} disabled={enRoute}>
              <span className="gp-lettre">{LETTRES[i]}</span>
              {rep}
            </button>
          ))}
        </div>
        {refus && (
          <p className="error small" role="alert">
            {refus}
          </p>
        )}
      </section>
    </div>
  )
}

/** Le parcours en miniature : dix obstacles, où l'on en est, et le fantôme. */
function Piste({ position, total, fantomeDevant }: { position: number; total: number; fantomeDevant: boolean }) {
  return (
    <div className="gp-piste" role="img" aria-label={`Obstacle ${position + 1} sur ${total}${fantomeDevant ? ' : le fantôme vient de le sauter' : ''}`}>
      <span className="gp-piste-fait" style={{ transform: `scaleX(${position / total})` }} />
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="gp-piste-obstacle" style={{ left: `${((i + 0.5) / total) * 100}%` }} />
      ))}
      <span className="gp-piste-fantome" style={{ left: `${((position + (fantomeDevant ? 1 : 0.5)) / total) * 100}%` }} />
      <span className="gp-piste-toi" style={{ left: `${((position + 0.5) / total) * 100}%` }} />
    </div>
  )
}

// ── La révélation ────────────────────────────────────────────────────────

function Revelation({ g, r, tropTard, course, fin, enRoute, onSuivant, refus }: {
  g: NonNullable<EtatDuGrandPrix['grandPrix']>
  r: RevelationDObstacle
  tropTard: boolean
  course: CourseVue | null
  fin: boolean
  enRoute: boolean
  onSuivant: () => void
  refus: string
}) {
  const nom = g.fantome.nom
  const toiFaute = r.toi.penalite > 0
  const luiFaute = r.fantome.penalite > 0
  return (
    <div className="player-shell gp-page gp-revelation">
      <div className="gp-scene gp-scene-courte">
        <CielDuGrandPrix />
        <Obstacle className="gp-scene-obstacle" tombee={toiFaute || luiFaute} fantome={!toiFaute && luiFaute} />
        <ChevalDEtoiles pose="saut" className="gp-scene-toi gp-a-saute" />
        <header className="gp-course-tete">
          <span className="gp-obstacle-numero">
            Obstacle {r.position + 1} <span>sur {course?.total ?? 10}</span>
          </span>
        </header>
        {course && <Scores toi={course.toi} fantome={course.fantome} nom={nom} />}
        <p className={`gp-verdict${toiFaute ? ' gp-verdict-faute' : ''}`} aria-live="polite">
          {r.toi.choix === null ? (tropTard ? 'Refus : le temps est passé · 4 pts' : 'Refus · 4 pts') : toiFaute ? `Barre tombée · ${chronoDit(r.toi.tempsMs)}` : `Sans faute · ${chronoDit(r.toi.tempsMs)}`}
        </p>
      </div>
      <section className="gp-question" aria-label="La révélation">
        <h2 className="gp-question-rappel">{r.texte}</h2>
        <div className="gp-reponses">
          {r.reponses.map((rep, i) => {
            const bonne = i === r.bonne
            const sienne = r.toi.choix === i
            const lui = r.fantome.choix === i
            return (
              <div key={i} className={`gp-reponse gp-reponse-vue${bonne ? ' gp-bonne' : sienne ? ' gp-fausse' : ''}`}>
                <span className="gp-lettre">{bonne ? <Icon name="check" /> : LETTRES[i]}</span>
                {rep}
                <span className="gp-marques">
                  {sienne && <span className="gp-marque gp-marque-toi">Toi · {chronoDit(r.toi.tempsMs)}</span>}
                  {lui && <span className="gp-marque gp-marque-fantome">{nom} · {chronoDit(r.fantome.tempsMs)}</span>}
                </span>
              </div>
            )
          })}
        </div>
        {r.fantome.choix === null && <p className="small gp-marque-fantome-seule">{nom} n’avait pas répondu à temps : un refus.</p>}
        {r.anecdote && <p className="gp-anecdote">{r.anecdote}</p>}
        {refus && (
          <p className="error small" role="alert">
            {refus}
          </p>
        )}
        <SousLePouce>
          <button type="button" className="btn btn-primary gp-suivant" onClick={onSuivant} disabled={enRoute}>
            {fin ? 'Voir l’arrivée' : 'Obstacle suivant'}
          </button>
        </SousLePouce>
      </section>
    </div>
  )
}

// ── L'arrivée ────────────────────────────────────────────────────────────

function Arrivee({ etat, course, enRoute, onRecourir, refus, essai }: { etat: EtatDuGrandPrix; course: CourseVue; enRoute: boolean; onRecourir: () => void; refus: string; essai: boolean }) {
  const g = etat.grandPrix!
  const nom = g.fantome.nom
  const fin = course.fin
  const battu = fin?.battu ?? false
  const soi = !!etat.fete
  const titre = battu ? (soi ? 'Tu as battu ton fantôme !' : `Tu as battu ${nom} !`) : 'Pas cette fois'
  const manque = !battu
    ? course.toi.points > course.fantome.points
      ? `Il t’a manqué ${barresDites((course.toi.points - course.fantome.points) / PENALITE_D_UNE_BARRE)}.`
      : `À points égaux, son chrono était meilleur de ${chronoDit(course.toi.tempsMs - course.fantome.tempsMs)}.`
    : null
  return (
    <div className="player-shell gp-page gp-arrivee">
      <header className="gp-tete gp-tete-courte">
        <CielDuGrandPrix />
        <ChevalDEtoiles pose={battu ? 'galop' : 'saut'} className="gp-tete-cheval-or" />
        {essai ? <Sortie vers="Le QG" href="/admin#grand-prix" /> : <Sortie />}
        <div className="gp-tete-texte">
          <h1>{titre}</h1>
          {manque && <span className="gp-fantome-ligne">{manque}</span>}
        </div>
      </header>

      <section className="gp-resultat" aria-label="Le résultat">
        <div className="gp-colonne gp-colonne-toi">
          <span>Toi</span>
          <b>{pointsDits(course.toi.points)}</b>
          <span className="muted small">
            {course.toi.barres === 0 ? 'sans faute' : barresDites(course.toi.barres)} · {chronoDit(course.toi.tempsMs)}
          </span>
        </div>
        <div className="gp-colonne gp-colonne-fantome">
          <span>{soi ? 'Ton fantôme' : `Le fantôme de ${nom}`}</span>
          <b>{pointsDits(course.fantome.points)}</b>
          <span className="muted small">
            {course.fantome.barres === 0 ? 'sans faute' : barresDites(course.fantome.barres)} · {chronoDit(course.fantome.tempsMs)}
          </span>
        </div>
      </section>

      {battu && fin && !soi && !essai && (
        <section className="gp-carte gp-gain" aria-labelledby="gp-gagnes">
          <Flot ruban={g.ruban} fantome={g.fantome} nom={`Le flot du ${g.titre}`} taille={72} />
          <span className="gp-gain-texte">
            <b id="gp-gagnes">{fin.flot ? 'Le flot est à toi' : 'Ton flot t’attendait déjà'}</b>
            {fin.rang && <span className="muted small">{fin.rang === 1 ? '1ʳᵉ' : `${fin.rang}ᵉ`} à l’arrivée</span>}
          </span>
        </section>
      )}
      {fin?.prix && (
        <section className="gp-carte gp-gain" aria-labelledby="gp-porter">
          <Avatar className="gp-gain-prix" avatar="🐴" legendaire={fin.prix} />
          <b id="gp-porter">{legendaire(fin.prix)?.nom ?? 'Un avatar'}</b>
          <a className="btn gp-essayer" href={`/profil?essayer=${encodeURIComponent(fin.prix)}#avatar`}>
            Le porter
          </a>
        </section>
      )}

      <section className="gp-joue" aria-labelledby="gp-joue">
        <h2 id="gp-joue">Où ça s’est joué</h2>
        <div className="gp-grille" role="img" aria-label={`Tes barres : ${course.revelations.filter(r => r.toi.penalite > 0).map(r => r.position + 1).join(', ') || 'aucune'}. Celles du fantôme : ${course.revelations.filter(r => r.fantome.penalite > 0).map(r => r.position + 1).join(', ') || 'aucune'}.`}>
          <span />
          {course.revelations.map(r => (
            <span key={`n${r.position}`} className="gp-grille-numero">
              {r.position + 1}
            </span>
          ))}
          <span className="gp-grille-qui">Toi</span>
          {course.revelations.map(r => (
            <span key={`t${r.position}`} className={r.toi.penalite > 0 ? 'gp-case gp-case-faute' : 'gp-case'} />
          ))}
          <span className="gp-grille-qui gp-grille-fantome">{soi ? 'Lui' : nom}</span>
          {course.revelations.map(r => (
            <span key={`f${r.position}`} className={r.fantome.penalite > 0 ? 'gp-case gp-case-fantome gp-case-faute' : 'gp-case gp-case-fantome'} />
          ))}
        </div>
      </section>

      {refus && (
        <p className="error small" role="alert">
          {refus}
        </p>
      )}
      <SousLePouce className="gp-geste">
        <button type="button" className="btn btn-primary gp-partir" onClick={onRecourir} disabled={enRoute}>
          Recourir
        </button>
      </SousLePouce>
    </div>
  )
}

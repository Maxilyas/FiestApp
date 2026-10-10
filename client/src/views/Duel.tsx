import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { Shape } from '../components/Shape'
import { BoutonCopier, BoutonPartager } from '../components/Partage'
import { OR, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { placeDuJour } from '../../../shared/course'
import { NOM_NIVEAU, type CorrectionDeCampagne, type DuelEntreAmis, type ResumeDuDuel, type SerieDeCampagne } from '../../../shared/campagne'
import { LigneDuDefiVue } from './Defi'
import { nomDuChoix } from './nomDuChoix'

/** L'adresse d'un défi entre amis, dans la campagne : son lien. */
export const adresseDuDuel = (code: string) => `#duel-${code}`
const lienDuDuel = (code: string) => `${window.location.origin}/campagne${adresseDuDuel(code)}`

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/** Ce que dit le message qui part avec le lien : son score, s'il a joué. */
export const texteDuDefi = (justes: number | null) =>
  justes === null ? 'Un défi à la campagne de FiestApp : feras-tu mieux que moi ?' : `${bonnes(justes)} à ce défi de la campagne de FiestApp : feras-tu mieux ?`

/** « Ferme dans 3 jours » : ce qui reste à un défi entre amis. */
export function fermeture(minutes: number): string {
  if (minutes <= 0) return 'Fermé : son classement est figé'
  if (minutes < 60) return `Ferme dans ${minutes} minute${minutes > 1 ? 's' : ''}`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `Ferme dans ${heures} heure${heures > 1 ? 's' : ''}`
  const jours = Math.floor(heures / 24)
  return `Ferme dans ${jours} jour${jours > 1 ? 's' : ''}`
}

/**
 * Envoyer un défi : la feuille de partage du téléphone, le lien à copier, et
 * son code — de quoi le dire à voix haute. Sans l'une ni l'autre (une page
 * en http), le lien reste écrit, à sélectionner.
 */
function EnvoyerLeDefi({ code, texte }: { code: string; texte: string }) {
  const lien = lienDuDuel(code)
  return (
    <section className="card duel-envoi" aria-labelledby={`envoi-${code}`}>
      <h2 id={`envoi-${code}`} className="label">
        Envoie ce défi
      </h2>
      <p className="small">Qui ouvre son lien, profil en main, joue les mêmes questions — une fois, d’ici une semaine.</p>
      <div className="row duel-boutons">
        <BoutonPartager titre="Un défi à la campagne de FiestApp" texte={texte} url={lien} className="btn btn-primary" />
        <BoutonCopier texte={lien} />
      </div>
      <p className="muted small">
        <span className="duel-lien">{lien}</span> · son code : <b>{code}</b>
      </p>
    </section>
  )
}

/**
 * La fin de sa tentative à un défi entre amis : sa place pour l'instant (sur
 * l'écran de la série), puis de quoi l'envoyer — la première chose à faire
 * pour qui vient de le lancer —, et son classement.
 */
export function FinDuDuel({ code, justes, onClassement }: { code: string; justes: number; onClassement: () => void }) {
  return (
    <>
      <EnvoyerLeDefi code={code} texte={texteDuDefi(justes)} />
      <button type="button" className="btn btn-block" onClick={onClassement}>
        <Icon name="trophy" />
        Le classement du défi
      </button>
      <p className="muted small centre">La correction s’ouvre à sa fermeture : elle soufflerait les réponses à ceux qui jouent encore.</p>
    </>
  )
}

/**
 * Un défi entre amis (`/campagne#duel-K7M2QX`) : qui l'a lancé, ce qu'il
 * fait jouer, le temps qui reste, sa tentative et le classement ; fermé, sa
 * correction. La partie se joue sur l'écran de la série (`CampagneApp`),
 * comme celle du défi de la semaine.
 */
export function PageDuDuel({ code, onglets, onJouer }: { code: string; onglets: ReactNode; onJouer: (tentative: SerieDeCampagne, code: string) => void }) {
  const [duel, setDuel] = useState<DuelEntreAmis | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const [correction, setCorrection] = useState<CorrectionDeCampagne[] | null>(null)

  useEffect(() => {
    let vivant = true
    api.campagne.duel
      .lire(code)
      .then(d => vivant && setDuel(d))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [code])

  const relever = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const tentative = await api.campagne.duel.relever(code)
      if (tentative.question) onJouer(tentative, code)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const voirCorrection = async (serie: string) => {
    try {
      setCorrection(await api.campagne.correction(serie))
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  const t = duel?.tentative
  const ouvert = !!duel && duel.minutesRestantes > 0
  const sienne = duel && [...duel.lignes, ...(duel.moi ? [duel.moi] : [])].find(l => l.profileId === duel.sienne)
  const joue = duel ? nomDuChoix(duel.categories ?? [], duel.sujet) : null

  return (
    <div className="player-shell campagne">
      <Sortie />
      {onglets}
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">{duel?.auteur.toi ? 'Ton défi entre amis' : 'Un défi entre amis'}</span>
        <h1>{!duel ? 'Le défi' : duel.auteur.toi ? 'Qui fera mieux que toi ?' : `${duel.auteur.nom} te défie`}</h1>
        <div className="campagne-record-hud">
          {t?.finie || (t && !ouvert) ? <b>{t.justes}</b> : <b>{duel ? duel.joueurs : '–'}</b>}
          <span>
            {t?.finie || (t && !ouvert) ? (
              <>
                {t.justes > 1 ? 'bonnes réponses' : 'bonne réponse'}
                <br />
                {(sienne && placeDuJour(sienne.rang, duel!.joueurs, sienne.justes)) ?? 'ta tentative est jouée'}
              </>
            ) : (
              <>
                {duel && duel.joueurs > 1 ? 'joueurs l’ont relevé' : 'joueur l’a relevé'}
                <br />
                {duel ? fermeture(duel.minutesRestantes) : '…'}
              </>
            )}
          </span>
        </div>
        <ul className="campagne-puces">
          <li>
            <Icon name="list" /> {joue ?? 'toutes les catégories'}
          </li>
          <li>
            <Icon name="target" /> le même tirage pour chacun, une seule tentative
          </li>
          <li>
            <Icon name="timer" /> trois vies, sans chrono
          </li>
        </ul>
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      {duel && ouvert && !t && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          Relever le défi
        </button>
      )}
      {duel && ouvert && t && !t.finie && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          {`Reprendre mon défi · ${bonnes(t.justes)}`}
        </button>
      )}
      {duel && !ouvert && !t && <p className="muted small centre">Ce défi est fermé : son classement est figé. Lance le tien depuis la série.</p>}

      {duel && ouvert && (duel.auteur.toi || t?.finie) && (
        <EnvoyerLeDefi code={duel.code} texte={texteDuDefi(t?.finie ? t.justes : null)} />
      )}

      {duel && (
        <section className="defi-classement" aria-labelledby="duel-classement-titre">
          <h2 id="duel-classement-titre" className="label">
            {ouvert ? 'Le classement, pour l’instant' : 'Le classement final'}
          </h2>
          {duel.joueurs === 0 ? (
            <p className="muted small">Personne n’a encore répondu : la première place t’attend.</p>
          ) : (
            <div className="leaderboard">
              {duel.lignes.map(l => (
                <LigneDuDefiVue key={l.profileId} ligne={l} moi={l.profileId === duel.sienne} />
              ))}
              {duel.moi && (
                <>
                  <p className="muted center small">…</p>
                  <LigneDuDefiVue ligne={duel.moi} moi />
                </>
              )}
            </div>
          )}
        </section>
      )}

      {duel && !ouvert && t && !correction && (
        <button type="button" className="btn btn-block" onClick={() => void voirCorrection(t.id)}>
          <Icon name="book" />
          La correction du défi
        </button>
      )}
      {correction && (
        <ol className="campagne-correction">
          {correction.map((c, i) => (
            <li key={i} className={'card ' + (c.juste ? 'campagne-juste' : 'campagne-rate')}>
              <span className="label">{NOM_NIVEAU[c.niveau]}</span>
              <p>{espacesFines(c.texte)}</p>
              <p className="muted small">
                <Shape index={c.bonne} inline /> {espacesFines(c.reponses[c.bonne])}
                {!c.juste && c.choix !== null && <> · tu avais dit {espacesFines(c.reponses[c.choix])}</>}
              </p>
              {c.anecdote && <p className="small campagne-anecdote">{espacesFines(c.anecdote)}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/**
 * Ses défis entre amis, sous le défi de la semaine : ceux qu'il a lancés ou
 * relevés ces trente derniers jours — un lien perdu ne perd pas le défi.
 * Rien tant qu'il n'en a aucun : la série dit comment en lancer un.
 */
export function MesDuels({ onOuvrir }: { onOuvrir: (code: string) => void }) {
  const [duels, setDuels] = useState<ResumeDuDuel[] | null>(null)
  useEffect(() => {
    let vivant = true
    api.campagne.duel
      .miens()
      .then(d => vivant && setDuels(d))
      // Une liste qui ne vient pas ne cache rien d'autre : le défi de la semaine est là.
      .catch(() => vivant && setDuels([]))
    return () => {
      vivant = false
    }
  }, [])
  if (!duels || duels.length === 0) return null
  return (
    <section className="duel-liste" aria-labelledby="mes-duels-titre">
      <h2 id="mes-duels-titre" className="label">
        Tes défis entre amis
      </h2>
      <ul>
        {duels.map(d => {
          const joue = nomDuChoix(d.categories ?? [], d.sujet)
          return (
            <li key={d.code}>
              <button type="button" className="btn btn-block duel-ligne" onClick={() => onOuvrir(d.code)}>
                <span>
                  <b>{d.auteur === 'toi' ? 'Ton défi' : `Le défi de ${d.auteur}`}</b>
                  <span className="muted small">
                    {[joue ?? 'toutes les catégories', `${d.joueurs} joueur${d.joueurs > 1 ? 's' : ''}`, fermeture(d.minutesRestantes)].join(' · ')}
                  </span>
                </span>
                <span className="duel-score">
                  {d.justes !== null && d.rang !== null ? `${d.rang}${d.rang === 1 ? 'er' : 'e'} · ${d.justes} bonne${d.justes > 1 ? 's' : ''}` : 'à relever'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

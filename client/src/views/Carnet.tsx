import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { LILAS, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { jourEnToutesLettres } from '../../../shared/jour'
import { XP_PAR_JUSTE, type SerieDeCampagne } from '../../../shared/campagne'
import { INTERVALLES_DE_REVISION, QUESTIONS_PAR_REVISION, type EtatDuCarnet, type FaitAppris } from '../../../shared/revision'

/** L'adresse de l'onglet du carnet, dans la campagne. */
export const ADRESSE_DU_CARNET = '#carnet'

const questions = (n: number) => `${n} question${n > 1 ? 's' : ''}`

/** Un rendez-vous d'une question ratée, dans les mots de la page : « le lendemain », « 3 jours après », « une semaine après ». */
function rendezVous(jours: number): string {
  if (jours === 1) return 'le lendemain'
  if (jours === 7) return 'une semaine après'
  return `${jours} jours après`
}

/** Quand une question revient : « demain », « dans 3 jours », « dans une semaine ». */
export function revientDans(jours: number): string {
  if (jours <= 1) return 'demain'
  if (jours === 7) return 'dans une semaine'
  return `dans ${jours} jours`
}

/** Ce que la page dit quand rien n'est à revoir aujourd'hui : quand revenir, ou comment son carnet se remplit. */
export function prochaineFois(c: EtatDuCarnet): string {
  if (c.demain > 0) return `Rien à revoir aujourd’hui : demain, ${questions(c.demain)} t’attend${c.demain > 1 ? 'ent' : ''}.`
  if (c.prochainJour) return `Rien à revoir aujourd’hui : la prochaine revient le ${jourEnToutesLettres(c.prochainJour)}.`
  return `Ton carnet est ${c.appris > 0 ? 'à jour' : 'vide'} : une question ratée en série, sur un sentier ou au défi t’y attendra le lendemain.`
}

/**
 * Le carnet de révision, quatrième onglet de la campagne (`#carnet`) : ce
 * qu'il a raté revient le lendemain, puis trois jours après, puis une
 * semaine — retrouvé à chaque rendez-vous, c'est appris (`shared/revision.ts`).
 * Ce qui l'attend aujourd'hui, ce qui revient ensuite, et ce qu'il a appris,
 * à relire. Sans vies : on y vient pour apprendre, pas pour perdre.
 *
 * La révision elle-même se joue sur l'écran de la série (`CampagneApp`) — la
 * page lui passe la révision.
 */
export function PageDuCarnet({ onglets, onReviser, onLu }: { onglets: ReactNode; onReviser: (revision: SerieDeCampagne) => void; onLu?: (carnet: EtatDuCarnet) => void }) {
  const [carnet, setCarnet] = useState<EtatDuCarnet | null>(null)
  const [faits, setFaits] = useState<FaitAppris[] | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let vivant = true
    api.campagne.carnet
      .etat()
      .then(c => {
        if (!vivant) return
        setCarnet(c)
        onLu?.(c)
      })
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [])

  const reviser = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const revision = await api.campagne.carnet.reviser()
      if (revision.question) onReviser(revision)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  // Ce qu'il a appris ne se lit qu'au dépli : la page s'ouvre sur ce qui l'attend.
  const lireLesFaits = () => {
    if (faits) return
    api.campagne.carnet
      .appris()
      .then(setFaits)
      .catch(e => setErreur(motifDe(e)))
  }

  const enCours = carnet?.enCours?.question ? carnet.enCours : null
  const enRoute = carnet ? carnet.demain + carnet.plusTard : 0
  return (
    <div className="player-shell campagne">
      <Sortie />
      {onglets}
      <section className="atlas-branche campagne-heros carnet-heros" style={lueur(LILAS)}>
        <span className="atlas-categorie">Le carnet de révision</span>
        <h1>Ce que tu rates revient</h1>
        <div className="campagne-record-hud">
          <b>{carnet ? carnet.appris : '–'}</b>
          <span>
            {carnet && carnet.appris < 2 ? 'chose apprise' : 'choses apprises'}
            <br />
            {!carnet ? '…' : carnet.aRevoir > 0 ? `${questions(carnet.aRevoir)} à revoir aujourd’hui` : 'rien à revoir aujourd’hui'}
          </span>
        </div>
        {/* Les rendez-vous d'une question ratée : retrouvée à chacun, elle est apprise. */}
        <ol className="carnet-rendez-vous" aria-label="Les rendez-vous d’une question ratée">
          {INTERVALLES_DE_REVISION.map(j => (
            <li key={j}>
              <i aria-hidden="true" />
              {rendezVous(j)}
            </li>
          ))}
          <li className="carnet-apprise">
            <Icon name="check-circle" />
            apprise
          </li>
        </ol>
        <ul className="campagne-puces">
          <li>
            <Icon name="rotate" /> sans vies
          </li>
          <li>🎊 un confetti par bonne réponse</li>
          <li>
            <Icon name="zap" /> {XP_PAR_JUSTE} XP par bonne réponse, comme en série
          </li>
        </ul>
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      {carnet &&
        (enCours ? (
          <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void reviser()}>
            <Icon name="play" />
            {`Reprendre ma révision · ${enCours.question!.index + 1} sur ${enCours.total}`}
          </button>
        ) : carnet.aRevoir > 0 ? (
          <>
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void reviser()}>
              <Icon name="play" />
              {`Réviser · ${questions(Math.min(carnet.aRevoir, QUESTIONS_PAR_REVISION))}`}
            </button>
            {carnet.aRevoir > QUESTIONS_PAR_REVISION && <p className="muted small centre">{`${QUESTIONS_PAR_REVISION} à la fois, les plus en retard d’abord.`}</p>}
          </>
        ) : (
          <p className="muted centre carnet-prochaine">{prochaineFois(carnet)}</p>
        ))}
      {carnet && (carnet.aRevoir > 0 || enCours) && enRoute > 0 && (
        <p className="muted small centre">{`En route : ${carnet.demain > 0 ? `${carnet.demain} demain` : ''}${carnet.demain > 0 && carnet.plusTard > 0 ? ', ' : ''}${carnet.plusTard > 0 ? `${carnet.plusTard} plus tard` : ''}.`}</p>
      )}

      {carnet && carnet.appris > 0 && (
        <details className="reglages-salon carnet-appris" onToggle={e => e.currentTarget.open && lireLesFaits()}>
          <summary>
            <Icon name="book" className="reglages-icone" />
            <span>
              <b>Ce que j’ai appris</b>
              <span className="muted small">{carnet.appris === 1 ? 'une chose, retrouvée à chaque rendez-vous' : `${carnet.appris} choses, retrouvées à chaque rendez-vous`}</span>
            </span>
            <Icon name="chevron-down" className="repli-chevron" />
          </summary>
          {!faits ? (
            <p className="muted small">Chargement…</p>
          ) : (
            <ol className="carnet-faits">
              {faits.map((f, i) => (
                <li key={i} className="card">
                  <span className="label">{f.categorie}</span>
                  <p>{espacesFines(f.texte)}</p>
                  <p className="carnet-reponse">
                    <Icon name="check" /> {espacesFines(f.reponse)}
                  </p>
                  {f.anecdote && <p className="small campagne-anecdote">{espacesFines(f.anecdote)}</p>}
                </li>
              ))}
            </ol>
          )}
        </details>
      )}
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Sortie } from '../components/Pieces'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { Laurier, NomLaure, texteDuLaurier } from '../components/Laurier'
import { Rank } from '../components/Rank'
import { Shape } from '../components/Shape'
import { RecompenseTombee } from '../components/Ouverts'
import { OR, lueur } from '../components/Atlas'
import { espacesFines } from '../format'
import { placeDuJour } from '../../../shared/course'
import { NOM_NIVEAU, type CorrectionDeCampagne, type DefiDeLaSemaine, type LigneDuDefi, type SerieDeCampagne } from '../../../shared/campagne'

/** L'adresse de l'onglet du défi, dans la campagne. */
export const ADRESSE_DU_DEFI = '#defi'

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/** « Clôture dans 3 jours, dimanche à minuit » : ce qui reste au défi, à l'heure de Paris. */
function cloture(minutes: number): string {
  if (minutes < 60) return `Clôture dans ${minutes} minute${minutes > 1 ? 's' : ''}`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `Clôture dans ${heures} heure${heures > 1 ? 's' : ''}, à minuit`
  const jours = Math.floor(heures / 24)
  return `Clôture dans ${jours} jour${jours > 1 ? 's' : ''}, dimanche à minuit`
}

/**
 * Le défi de la semaine, troisième onglet de la campagne (`#defi`) : la même
 * série pour tous jusqu'à dimanche minuit (Paris), une seule tentative,
 * trois vies, sans chronomètre. Son classement, et la semaine passée : ses
 * vainqueurs, qui portent le laurier d'argent, sa place à soi et sa
 * correction — qui n'ouvre qu'à la clôture, pour ne rien souffler à ceux
 * qui jouent encore.
 *
 * La partie elle-même se joue sur l'écran de la série (`CampagneApp`) : une
 * question, sa révélation, la suivante — la page lui passe la tentative.
 */
export function PageDuDefi({ onglets, onJouer }: { onglets: ReactNode; onJouer: (tentative: SerieDeCampagne) => void }) {
  const [defi, setDefi] = useState<DefiDeLaSemaine | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  const [correction, setCorrection] = useState<CorrectionDeCampagne[] | null>(null)

  useEffect(() => {
    let vivant = true
    api.campagne
      .defi()
      .then(d => vivant && setDefi(d))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [])

  const relever = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const tentative = await api.campagne.releverLeDefi()
      if (tentative.question) onJouer(tentative)
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

  const t = defi?.tentative
  const sienne = defi && [...defi.lignes, ...(defi.moi ? [defi.moi] : [])].find(l => l.profileId === defi.sienne)
  const passee = defi?.saSemainePassee

  return (
    <div className="player-shell campagne">
      <Sortie />
      {onglets}
      <section className="atlas-branche campagne-heros defi-heros" style={lueur(OR)}>
        <span className="atlas-categorie">Le défi de la semaine</span>
        <h1>La même série pour tous</h1>
        <div className="campagne-record-hud">
          {t?.finie ? <b>{t.justes}</b> : <b>{defi ? defi.joueurs : '–'}</b>}
          <span>
            {t?.finie ? (
              <>
                {t.justes > 1 ? 'bonnes réponses' : 'bonne réponse'}
                <br />
                {(sienne && placeDuJour(sienne.rang, defi!.joueurs, sienne.justes)) ?? 'ta tentative est jouée'}
              </>
            ) : (
              <>
                {defi && defi.joueurs > 1 ? 'joueurs cette semaine' : 'joueur cette semaine'}
                <br />
                {defi ? cloture(defi.minutesRestantes) : '…'}
              </>
            )}
          </span>
        </div>
        <ul className="campagne-puces">
          <li>
            <Icon name="target" /> une seule tentative
          </li>
          <li>
            <Icon name="timer" /> trois vies, sans chrono
          </li>
          <li>
            <Laurier laurier="argent" decoratif /> le laurier d’argent à la première place, toute la semaine d’après
          </li>
        </ul>
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      {defi && !t && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          Relever le défi
        </button>
      )}
      {t && !t.finie && (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => void relever()}>
          <Icon name="play" />
          {`Reprendre mon défi · ${bonnes(t.justes)}`}
        </button>
      )}
      {t?.finie && <p className="muted small centre">Tu as relevé le défi : son classement se fige dimanche à minuit, et le suivant ouvre lundi.</p>}

      {defi && (
        <section className="defi-classement" aria-labelledby="defi-classement-titre">
          <h2 id="defi-classement-titre" className="label">
            Le classement de la semaine
          </h2>
          {defi.joueurs === 0 ? (
            <p className="muted small">Personne n’a encore relevé le défi : la première place t’attend.</p>
          ) : (
            <div className="leaderboard">
              {defi.lignes.map(l => (
                <LigneDuDefiVue key={l.profileId} ligne={l} moi={l.profileId === defi.sienne} />
              ))}
              {defi.moi && (
                <>
                  <p className="muted center small">…</p>
                  <LigneDuDefiVue ligne={defi.moi} moi />
                </>
              )}
            </div>
          )}
        </section>
      )}

      {defi && (defi.vainqueurs.length > 0 || passee) && (
        <section className="card jour-annonce defi-passee">
          <span className="label">La semaine dernière</span>
          {defi.vainqueurs.length > 0 && (
            <div className="jour-ligne">
              <span className="jour-pastille">
                <Laurier laurier="argent" decoratif />
              </span>
              <div>
                <b>{`${defi.vainqueurs.map(v => `${v.avatar} ${v.nom}`).join(', ')}`}</b>
                <span className="muted small">
                  {defi.vainqueurs.length > 1 ? 'En tête ex æquo : le laurier d’argent suit leur prénom cette semaine.' : 'En tête : le laurier d’argent suit son prénom cette semaine.'}
                </span>
              </div>
            </div>
          )}
          {passee && (
            <>
              <div className="jour-ligne">
                <span className="jour-pastille">
                  <Icon name="trophy" />
                </span>
                <div>
                  <b>{placeDuJour(passee.rang, passee.joueurs, passee.justes) ?? bonnes(passee.justes)}</b>
                  <span className="muted small">{placeDuJour(passee.rang, passee.joueurs, passee.justes) ? bonnes(passee.justes) : `sur ${passee.joueurs} joueur${passee.joueurs > 1 ? 's' : ''}`}</span>
                </div>
              </div>
              {passee.recompenses.map(r => (
                <RecompenseTombee key={r.key} recompense={r} />
              ))}
              {!correction && (
                <button type="button" className="btn btn-block" onClick={() => void voirCorrection(passee.serie)}>
                  <Icon name="book" />
                  La correction du défi
                </button>
              )}
            </>
          )}
        </section>
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

/** Une ligne du classement du défi : sa place, son avatar, son prénom et ses bonnes réponses. */
function LigneDuDefiVue({ ligne: l, moi }: { ligne: LigneDuDefi; moi: boolean }) {
  return (
    <div
      className={'lb-row' + (moi ? ' me' : '')}
      role="group"
      aria-label={`${l.nom}${l.laurier ? `, ${texteDuLaurier(l.laurier)}` : ''} — rang ${l.rang}, ${bonnes(l.justes)}${l.enCours ? ', en cours' : ''}`}
    >
      <Rank n={l.rang} />
      <Avatar className="lb-avatar" avatar={l.avatar} finition={l.finition} legendaire={l.legendaire} eclat={l.eclat} />
      <span className="lb-name">
        <NomLaure nom={l.nom} laurier={l.laurier} />
        {l.enCours && <span className="muted small"> · en cours</span>}
      </span>
      <Niveau niveau={l.niveau} />
      <span className="lb-score">
        {l.justes}
        <span className="sr-only"> {l.justes > 1 ? 'bonnes réponses' : 'bonne réponse'}</span>
      </span>
    </div>
  )
}

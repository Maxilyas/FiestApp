import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { confirmDialog } from './Dialog'
import { brancherLeChef, commande, equipesParDefaut, lancer, terminer, useChef } from '../socketDuChef'
import type { ReglagesDuChef } from '../chef'
import { PALIERS_ENCHAINEMENT } from '../../../shared/console'
import { ecrireCode } from '../../../shared/space'
import { lireNombre } from '../../../shared/nombres'

/** L'encre du QR : sombre sur blanc, quel que soit le thème — un QR clair sur sombre ne se scanne pas partout. */
const QR_INK = '#1a1412'

/**
 * La barre du chef, en bas de son téléphone de joueur : le chef joue avec
 * ses invités et garde la main. Les mêmes gestes que la télécommande — la
 * pause, révéler, la question suivante, le quiz suivant —, sous le pouce ;
 * le rythme et ce qui défait quelque chose (reposer, annuler les points,
 * terminer le quiz) à l'écart, dans « ⋯ ». En salle d'attente, le code du
 * salon, qu'il dicte à la table, et son QR d'un toucher.
 *
 * Rien de la question n'y paraît : la vue d'animateur porte la note de
 * l'animateur, et le chef qui joue répond comme les autres. Chargée à la
 * demande, sur le seul téléphone qui a ouvert le salon (`chef.ts`).
 */
export function BarreDuChef({ reglages }: { reglages: ReglagesDuChef }) {
  const c = useChef()
  const v = c.vue
  const [plus, setPlus] = useState(false)
  const [qr, setQr] = useState(false)
  const [cible, setCible] = useState('')
  /** Les gestes posés une fois par partie : le quiz du programme, le rythme du salon. */
  const choisiPour = useRef<string | null>(null)
  const rythmePour = useRef<string | null>(null)
  const equipesPosees = useRef(false)

  useEffect(() => {
    brancherLeChef()
    // La page laisse la place à la barre (`body.avec-chef`) : elle ne cache
    // jamais la dernière réponse ni « Réponse enregistrée ».
    document.body.classList.add('avec-chef')
    return () => document.body.classList.remove('avec-chef')
  }, [])

  // Le quiz se lance au programme : le premier qu'on n'a pas joué ce soir,
  // à son multiplicateur, sans liste à parcourir sous le pouce.
  useEffect(() => {
    if (!v || !c.sessionId || v.phase !== 'pickPack' || choisiPour.current === c.sessionId) return
    const prochain = v.programme?.prochain
    if (!prochain) return
    choisiPour.current = c.sessionId
    const multiplier = v.packs?.find(p => p.id === prochain)?.auProgramme?.multiplier ?? 1
    commande({ type: 'selectPack', packId: prochain, multiplier })
  }, [v, c.sessionId])

  // Le rythme choisi à l'ouverture du salon, une fois par quiz : la partie
  // ne reprend que celui du quiz d'avant, et le premier partait au clic.
  useEffect(() => {
    if (!v || !c.sessionId || v.phase === 'pickPack' || rythmePour.current === c.sessionId) return
    rythmePour.current = c.sessionId
    if ((v.autoNextSeconds ?? null) !== reglages.rythme) commande({ type: 'autoNext', seconds: reglages.rythme })
  }, [v, c.sessionId, reglages.rythme])

  // En équipes : celles par défaut, une fois, si la soirée n'en a pas.
  useEffect(() => {
    if (!reglages.equipes || equipesPosees.current || !c.presente || !c.snapshot) return
    equipesPosees.current = true
    if (c.snapshot.teams.length === 0) equipesParDefaut()
  }, [reglages.equipes, c.presente, c.snapshot])

  // La console n'est pas ouverte ici (expirée, ou ouverte ailleurs) : pas de barre.
  if (c.presente !== true || !c.snapshot) return null

  const code = c.snapshot.code
  const enJeu = !!v && v.phase !== 'finished' && v.phase !== 'pickPack'
  const lienDuCode = code ? `${window.location.origin}/${code}` : `${window.location.origin}/${reglages.slug}`

  const annuler = async () => {
    setPlus(false)
    const ok = await confirmDialog({
      title: 'Annuler les points de cette question ?',
      message: 'Personne ne gagne rien sur elle, et elle sort des statistiques.',
      confirmLabel: 'Annuler les points',
      danger: true,
    })
    if (ok) commande({ type: 'cancel' })
  }
  const finir = async () => {
    setPlus(false)
    const ok = await confirmDialog({
      title: 'Terminer ce quiz ?',
      message: 'Les questions restantes ne seront pas posées. Ce qui a été joué compte.',
      confirmLabel: 'Terminer le quiz',
      danger: true,
    })
    if (ok) terminer()
  }

  let principal = null
  if (!v || v.phase === 'finished') {
    principal = (
      <button type="button" className="btn btn-primary barre-chef-geste" onClick={lancer}>
        <Icon name="play" />
        {v ? 'Quiz suivant' : 'Lancer le quiz'}
      </button>
    )
  } else if (v.phase === 'pickPack') {
    principal = v.programme?.prochain ? (
      <span className="barre-chef-etat">Le quiz arrive…</span>
    ) : (
      // Tout le programme est joué : un quiz de plus se choisit sur la page du salon.
      <a className="btn btn-primary barre-chef-geste" href="/salon">
        <Icon name="plus" />
        Ajouter un quiz
      </a>
    )
  } else if (v.phase === 'question') {
    principal = (
      <>
        <button
          type="button"
          className="btn barre-chef-rond"
          aria-label={v.paused ? 'Reprendre' : 'Pause'}
          onClick={() => commande({ type: v.paused ? 'resume' : 'pause' })}
        >
          <Icon name={v.paused ? 'play' : 'pause'} />
        </button>
        <button type="button" className="btn btn-primary barre-chef-geste" onClick={() => commande({ type: 'next' })}>
          Révéler
          {v.participantCount ? <span className="barre-chef-compte">{`${v.answeredCount ?? 0}/${v.participantCount}`}</span> : null}
        </button>
      </>
    )
  } else if (v.phase === 'cible') {
    const valeur = lireNombre(cible)
    principal = (
      <form
        className="barre-chef-cible"
        onSubmit={e => {
          e.preventDefault()
          if (valeur !== null) commande({ type: 'cible', value: valeur })
          setCible('')
        }}
      >
        <input className="input" inputMode="decimal" placeholder="La bonne réponse" aria-label="La bonne réponse" value={cible} onChange={e => setCible(e.target.value)} />
        <button className="btn btn-primary" disabled={valeur === null}>
          Révéler
        </button>
      </form>
    )
  } else if (v.phase === 'reveal') {
    principal = (
      <button type="button" className="btn btn-primary barre-chef-geste" onClick={() => commande({ type: 'next' })}>
        {v.qIndex + 1 < v.qCount ? 'Question suivante' : 'Le podium'}
      </button>
    )
  } else {
    principal = <span className="barre-chef-etat">C’est parti…</span>
  }

  return (
    <>
      <nav className="barre-chef" aria-label="Le salon">
        {!enJeu && (
          <button type="button" className="barre-chef-code" onClick={() => setQr(true)} aria-label={code ? `Le code du salon : ${ecrireCode(code)}. Montrer le QR` : 'Montrer le QR du salon'}>
            <span className="label">Code</span>
            <b>{code ? ecrireCode(code) : '— — —'}</b>
          </button>
        )}
        <div className="barre-chef-gestes">{principal}</div>
        {v && (
          <button type="button" className="btn btn-ghost barre-chef-rond" aria-label="Plus de gestes" onClick={() => setPlus(true)}>
            <Icon name="more" />
          </button>
        )}
      </nav>
      {c.message && (
        <p className="barre-chef-message error small" role="alert">
          {c.message}
        </p>
      )}

      {qr && (
        <Feuille titre="Inviter dans le salon" onFermer={() => setQr(false)}>
          {code && <p className="code-du-salon">{ecrireCode(code)}</p>}
          <div className="qr-du-salon">
            <QRCodeSVG value={lienDuCode} size={220} bgColor="#ffffff" fgColor={QR_INK} title="QR code pour rejoindre le salon" />
          </div>
          <p className="muted small center">{lienDuCode.replace(/^https?:\/\//, '')}</p>
        </Feuille>
      )}

      {plus && v && (
        <Feuille titre="La partie" onFermer={() => setPlus(false)}>
          <span className="label">Question suivante</span>
          <div className="enchainement" role="group" aria-label="Question suivante">
            {PALIERS_ENCHAINEMENT.map(p => (
              <button
                key={p ?? 'clic'}
                type="button"
                className={'pill-btn' + ((v.autoNextSeconds ?? null) === p ? ' active' : '')}
                aria-pressed={(v.autoNextSeconds ?? null) === p}
                onClick={() => commande({ type: 'autoNext', seconds: p })}
              >
                {p === null ? 'Au clic' : `${p} s`}
              </button>
            ))}
          </div>
          {v.phase === 'reveal' && (
            <>
              <button
                type="button"
                className="btn btn-block"
                onClick={() => {
                  setPlus(false)
                  commande({ type: 'replay' })
                }}
              >
                <Icon name="rotate" />
                Reposer la question
              </button>
              {!v.cancelled && (
                <button type="button" className="btn btn-block btn-ghost geste-qui-defait" onClick={() => void annuler()}>
                  Annuler les points
                </button>
              )}
            </>
          )}
          {enJeu && (
            <button type="button" className="btn btn-block btn-ghost geste-qui-defait" onClick={() => void finir()}>
              Terminer le quiz
            </button>
          )}
        </Feuille>
      )}
    </>
  )
}

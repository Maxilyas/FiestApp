import { useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Shape } from '../components/Shape'
import { Feuille, Sortie } from '../components/Pieces'
import { Onglets } from '../components/Onglets'
import { LegendaireOuvert, RecompenseTombee } from '../components/Ouverts'
import { SerieCorrigee } from '../components/SerieCorrigee'
import { BarreDeNiveau } from '../components/BarreDeNiveau'
import { GerbeDeJuste } from '../components/Gerbe'
import { promptDialog } from '../components/Dialog'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { iconeDuSujet } from '../iconeDuSujet'
import { BarreDEpreuve, Etoiles } from './Sentiers'
import { ADRESSE_D_APPRENDRE } from '../../../shared/depart'
import { difficulteDuMelange, texteDuMelange } from '../../../shared/sentiers'
import { FAMILLES_DE_SUJETS, sujetParCle, type FamilleDeSujet } from '../../../shared/sujets'
import {
  PALIERS_DES_SUJETS,
  PALIERS_D_UN_SUJET,
  QUESTIONS_D_UN_PALIER_DE_SUJET,
  SEUIL_D_UN_SUJET,
  etoilesDuSujet,
  type EpreuveDeSujet,
  type EtatDesSujets,
  type ReponseDuSujet,
  type SentierDeSujet,
} from '../../../shared/sentiersDeSujets'
import { NOM_NIVEAU, SIGNALEMENT_MAX, type CorrectionDeCampagne, type QuestionDeCampagne } from '../../../shared/campagne'

// Les parcours de thème (`shared/sentiersDeSujets.ts` — « les sentiers à
// thème » jusqu'au 12 octobre 2026) : un thème, une époque ou un fil rouge,
// monté en six étapes de dix questions, sans vies. Ils vivaient repliés sous
// les douze sentiers, dont ils n'ont ni les vies ni les avatars, et l'on
// prenait l'un pour l'autre ; ils sont dans l'onglet « Apprendre », sous le
// carnet — on y apprend, on n'y perd rien (la proposition 1 de la maquette,
// validée par le propriétaire le 12 octobre 2026). Le serveur et ses tables
// gardent leurs noms d'avant (`mode = 'sujet'`, `palier`) : seuls les mots
// de la page ont changé, et ceux de ses refus.

/** Une étape qu'on peut jouer : sa question en cours est là. */
export type EtapeAJouer = EpreuveDeSujet & { question: QuestionDeCampagne }
export const aJouer = (e: EpreuveDeSujet | null | undefined): e is EtapeAJouer => !!e?.question

/**
 * La famille qu'il regardait : l'étape jouée prend la place de la liste, et
 * revenu d'elle, il retrouve ses époques plutôt que les thèmes. Le temps de
 * la page seulement.
 */
let familleVue: FamilleDeSujet | null = null


/**
 * Les parcours, sous le carnet : l'étape laissée en route d'abord, ceux qu'on
 * a commencés, puis les autres, une famille à la fois — les thèmes, les
 * époques, les fils rouges (`FAMILLES_DE_SUJETS`). Vingt-cinq tuiles en
 * trois rangées faisaient un écran de cases ; une ligne chacun, une famille à
 * la fois, se lisent d'un coup d'œil. Toucher un parcours ouvre sa fiche —
 * ses six étapes, ce qu'elles posent —, d'où il se joue.
 */
export function ParcoursDeTheme({ etat, onEtape }: { etat: EtatDesSujets; onEtape: (e: EtapeAJouer) => void }) {
  const [fiche, setFiche] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const laissee = aJouer(etat.epreuve) ? etat.epreuve : null
  // En cours : une étape validée au moins, pas toutes — ou une laissée en route, qui passe devant.
  const enCours = etat.sujets
    .filter(s => (s.paliers > 0 && s.paliers < PALIERS_D_UN_SUJET) || s.sujet === laissee?.sujet)
    .sort((a, b) => Number(b.sujet === laissee?.sujet) - Number(a.sujet === laissee?.sujet))
  const familles = FAMILLES_DE_SUJETS.filter(f => etat.sujets.some(s => sujetParCle(s.sujet)?.famille === f.famille))
  const [famille, setFamilleBrut] = useState<FamilleDeSujet>(() => familles.find(f => f.famille === familleVue)?.famille ?? familles[0]?.famille ?? 'theme')
  const setFamille = (f: FamilleDeSujet) => {
    familleVue = f
    setFamilleBrut(f)
  }
  const ici = etat.sujets.filter(s => sujetParCle(s.sujet)?.famille === famille && !enCours.includes(s))
  const parcours = fiche ? etat.sujets.find(s => s.sujet === fiche) : undefined
  const sujet = parcours ? sujetParCle(parcours.sujet) : undefined

  const jouer = async (cle: string, etape: number) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const e = await api.campagne.sujets.commencer(cle, etape)
      if (aJouer(e)) onEtape(e)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="parcours" aria-labelledby="parcours-titre">
      <h2 id="parcours-titre">Les parcours de thème</h2>
      <p className="muted small">{`${PALIERS_D_UN_SUJET} étapes de ${QUESTIONS_D_UN_PALIER_DE_SUJET} questions, ${SEUIL_D_UN_SUJET} bonnes réponses pour passer, sans vies : on y apprend, on n’y perd rien.`}</p>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      {laissee && (
        <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={() => onEtape(laissee)}>
          <Icon name="play" />
          {`Reprendre · ${sujetParCle(laissee.sujet)?.nom ?? 'ton parcours'}, étape ${laissee.palier}`}
        </button>
      )}
      {enCours.length > 0 && (
        <>
          <p className="label">En cours</p>
          <ul className="parcours-liste" aria-label="Tes parcours en cours">
            {enCours.map(s => (
              <li key={s.sujet}>
                <LigneDeParcours parcours={s} enRoute={s.sujet === laissee?.sujet ? laissee.palier : undefined} onFiche={() => setFiche(s.sujet)} />
              </li>
            ))}
          </ul>
        </>
      )}
      {familles.length > 1 && (
        <Onglets
          onglets={familles.map(f => ({ id: f.famille, nom: f.pluriel }))}
          actif={famille}
          onChoisir={setFamille}
          label="Les familles de parcours"
          idOnglet={f => `parcours-${f}`}
          idPanneau={() => 'parcours-famille'}
          className="onglets-petits"
        />
      )}
      <div {...(familles.length > 1 ? { id: 'parcours-famille', role: 'tabpanel', 'aria-labelledby': `parcours-${famille}` } : {})}>
        {ici.length > 0 ? (
          <ul className="parcours-liste" aria-label={FAMILLES_DE_SUJETS.find(f => f.famille === famille)?.pluriel}>
            {ici.map(s => (
              <li key={s.sujet}>
                <LigneDeParcours parcours={s} onFiche={() => setFiche(s.sujet)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Tous commencés : ils sont plus haut.</p>
        )}
      </div>
      {parcours && sujet && (
        <Feuille titre={sujet.nom} onFermer={() => setFiche(null)}>
          <FicheDuParcours
            parcours={parcours}
            description={sujet.description}
            laissee={laissee?.sujet === parcours.sujet ? laissee : null}
            busy={busy}
            onJouer={n => {
              setFiche(null)
              void jouer(parcours.sujet, n)
            }}
          />
        </Feuille>
      )}
    </section>
  )
}

/** Un parcours sur une ligne : son icône, où il en est et la difficulté de l'étape à jouer, ses étoiles. */
export function LigneDeParcours({
  parcours: s,
  enRoute,
  onFiche,
}: {
  parcours: SentierDeSujet
  /** L'étape laissée en route sur ce parcours : « à commencer » mentait sur un parcours qu'on joue. */
  enRoute?: number
  onFiche: () => void
}) {
  const sujet = sujetParCle(s.sujet)
  if (!sujet) return null
  const etoiles = s.etoiles.reduce((n, e) => n + e, 0)
  const accompli = s.paliers >= PALIERS_D_UN_SUJET
  const ou = enRoute ? [`étape ${enRoute} sur ${PALIERS_D_UN_SUJET}`, 'en route'] : accompli ? ['accompli'] : [s.paliers === 0 ? 'à commencer' : `étape ${s.paliers + 1} sur ${PALIERS_D_UN_SUJET}`]
  // La difficulté de l'étape à jouer, d'un mot, comme sur la tuile d'un sentier : on sait contre quoi on joue avant d'entrer.
  const difficulte = enRoute || accompli ? null : difficulteDuMelange(PALIERS_DES_SUJETS[s.paliers].melange)
  const dit = difficulte ? [...ou, difficulte] : ou
  return (
    <button
      type="button"
      className={'parcours-ligne' + (accompli && !enRoute ? ' parcours-accompli' : '')}
      aria-label={`${sujet.nom} : ${[...dit, ...(etoiles > 0 ? [`${etoiles} étoile${etoiles > 1 ? 's' : ''}`] : [])].join(', ')}`}
      onClick={onFiche}
    >
      <span className="parcours-icone">
        <Icon name={accompli && !enRoute ? 'crown' : iconeDuSujet(sujet)} />
      </span>
      <span className="parcours-nom">
        <b>{sujet.nom}</b>
        <span className="muted small">{dit.join(' · ')}</span>
      </span>
      {etoiles > 0 && <span className="parcours-etoiles">{`★ ${etoiles}`}</span>}
      <Icon name="chevron-right" className="parcours-chevron" />
    </button>
  )
}

/** La fiche d'un parcours : ses six étapes, ce qu'elles posent, ses étoiles — et le geste. */
export function FicheDuParcours({
  parcours: s,
  description,
  laissee,
  busy,
  onJouer,
}: {
  parcours: SentierDeSujet
  description: string
  /** L'étape laissée en route sur ce parcours : le serveur la reprend telle quelle. */
  laissee: EpreuveDeSujet | null
  busy: boolean
  onJouer: (etape: number) => void
}) {
  const prochaine = s.paliers < PALIERS_D_UN_SUJET ? s.paliers + 1 : null
  return (
    <div className="sentier-fiche">
      <p className="muted small">{espacesFines(description)}</p>
      <ol className="parcours-etapes">
        {PALIERS_DES_SUJETS.map(r => {
          const faite = s.paliers >= r.n
          const visee = prochaine === r.n
          return (
            <li key={r.n} className={faite ? 'etape-faite' : visee ? 'etape-visee' : 'etape-avenir'}>
              <span className="etape-num" aria-hidden="true">
                {faite ? <Icon name="check" /> : r.n}
              </span>
              <span className="etape-texte">
                <b>{`Étape ${r.n}`}</b>
                <span className="muted small">{texteDuMelange(r.melange)}</span>
              </span>
              {laissee?.palier === r.n ? (
                // « Jouer » faisait craindre de tout recommencer : l'étape laissée reprend où elle en était.
                <button type="button" className="btn btn-primary btn-small" aria-disabled={busy || undefined} aria-label={`Reprendre l’étape ${r.n}`} onClick={() => onJouer(r.n)}>
                  Reprendre
                </button>
              ) : faite ? (
                <button type="button" className="btn btn-ghost btn-small" aria-disabled={busy || undefined} aria-label={`Rejouer l’étape ${r.n}`} onClick={() => onJouer(r.n)}>
                  {(s.etoiles[r.n - 1] ?? 0) > 0 ? <Etoiles n={s.etoiles[r.n - 1]} /> : 'Rejouer'}
                </button>
              ) : visee ? (
                <button type="button" className="btn btn-primary btn-small" aria-disabled={busy || undefined} onClick={() => onJouer(r.n)}>
                  Jouer
                </button>
              ) : (
                <Icon name="lock" />
              )}
            </li>
          )
        })}
      </ol>
      {prochaine === null && <p className="campagne-record-battu">Parcours accompli : rejoue une étape pour ses étoiles.</p>}
    </div>
  )
}

type Ecran =
  | { e: 'epreuve'; epreuve: EpreuveDeSujet; question: QuestionDeCampagne; reponse: ReponseDuSujet | null; choix: number | null; xp: number; justesIci: number }
  | { e: 'fin'; reponse: ReponseDuSujet; xp: number; justesIci: number; correction: CorrectionDeCampagne[] | null }

/**
 * Une étape qu'on joue, puis sa fin — réessayer, l'étape d'après, rejouer
 * pour une étoile —, jusqu'au retour à « Apprendre » (`onRetour`). Sans
 * vies : partir ne coûte rien, l'étape attend, et en ouvrir une autre la
 * referme.
 */
export function JeuDuParcours({ depart, onRetour }: { depart: EtapeAJouer; onRetour: () => void }) {
  const [ecran, setEcranBrut] = useState<Ecran>({ e: 'epreuve', epreuve: depart, question: depart.question, reponse: null, choix: null, xp: 0, justesIci: 0 })
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    window.scrollTo(0, 0)
  }

  const jouer = async (cle: string, etape: number) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const e = await api.campagne.sujets.commencer(cle, etape)
      if (aJouer(e)) setEcran({ e: 'epreuve', epreuve: e, question: e.question, reponse: null, choix: null, xp: 0, justesIci: 0 })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const repondre = async (choix: number) => {
    if (ecran.e !== 'epreuve' || ecran.reponse || busy) return
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.campagne.sujets.repondre(ecran.epreuve.id, ecran.question.index, choix)
      setEcranBrut({ ...ecran, reponse, choix, epreuve: reponse.epreuve, xp: ecran.xp + reponse.xp, justesIci: ecran.justesIci + (reponse.juste ? 1 : 0) })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const suivante = () => {
    if (ecran.e !== 'epreuve' || !ecran.reponse) return
    const r = ecran.reponse
    if (r.epreuve.finie || !r.epreuve.question) return setEcran({ e: 'fin', reponse: r, xp: ecran.xp, justesIci: ecran.justesIci, correction: null })
    setEcran({ ...ecran, question: r.epreuve.question, reponse: null, choix: null })
  }

  const signaler = async (serie: string, index: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(serie, index, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  if (ecran.e === 'epreuve') {
    return (
      <EcranDeLEtape
        ecran={ecran}
        busy={busy}
        erreur={erreur}
        onRepondre={i => void repondre(i)}
        onSuivante={suivante}
        onPartir={() => {
          onRetour()
          showToast({ kind: 'info', message: 'L’étape t’attend : reprends-la quand tu veux' })
        }}
        onSignaler={() => void signaler(ecran.epreuve.id, ecran.question.index)}
      />
    )
  }
  const e = ecran.reponse.epreuve
  const voirCorrection = async () => {
    try {
      setEcranBrut({ ...ecran, correction: await api.campagne.correction(e.id) })
    } catch (err) {
      setErreur(motifDe(err))
    }
  }
  return (
    <FinDeLEtape
      fin={ecran}
      busy={busy}
      erreur={erreur}
      onCorrection={() => void voirCorrection()}
      onRejouer={() => void jouer(e.sujet, e.palier)}
      onSuivant={() => void jouer(e.sujet, e.palier + 1)}
      onRetour={onRetour}
    />
  )
}

/** Une étape d'un parcours : la barre de ses dix cases, la question, sa révélation — sans vies. */
function EcranDeLEtape({
  ecran,
  busy,
  erreur,
  onRepondre,
  onSuivante,
  onPartir,
  onSignaler,
}: {
  ecran: Extract<Ecran, { e: 'epreuve' }>
  busy: boolean
  erreur: string
  onRepondre: (i: number) => void
  onSuivante: () => void
  onPartir: () => void
  onSignaler: () => void
}) {
  const { epreuve: e, question: q, reponse: r } = ecran
  const sujet = sujetParCle(e.sujet)
  const valide = e.issue === 'validee'
  const reste = Math.max(0, e.seuil - e.justes)
  const permises = e.total - e.seuil - e.fausses
  return (
    <div className="player-shell campagne sentiers">
      <div className="quiz-player epreuve">
        {/* Sans vies, rien ne se perd : l'étape attend, et en ouvrir une autre la refermera. */}
        {!r?.epreuve.finie && <Sortie vers="Partir" href={`/campagne${ADRESSE_D_APPRENDRE}`} onClick={onPartir} />}
        <div className="quiz-topbar">
          <span className="label">{`${sujet?.nom ?? 'Parcours'} · étape ${e.palier} · ${q.index + 1}/${e.total}`}</span>
          {e.rejeu && <span className="label epreuve-rejeu">Rejeu</span>}
        </div>
        <div className="epreuve-barre">
          <BarreDEpreuve justes={e.justes} fausses={e.fausses} seuil={e.seuil} total={e.total} neuve={r ? (r.juste ? 'ok' : 'ko') : null} />
          <div className="epreuve-legende">
            {valide ? (
              <span>
                <b>Validée !</b>
                {` Encore ${e.total - e.justes - e.fausses} question${e.total - e.justes - e.fausses > 1 ? 's' : ''} pour les étoiles`}
              </span>
            ) : (
              <>
                <span>
                  <b>{e.justes}</b>
                  {` bonne${e.justes > 1 ? 's' : ''} · encore `}
                  <b>{reste}</b>
                  {' pour valider'}
                </span>
                <span>
                  <b>{e.fausses}</b>
                  {` faute${e.fausses > 1 ? 's' : ''} · `}
                  {permises > 1 ? `${permises} permises` : permises === 1 ? 'plus qu’une permise' : 'plus aucune permise'}
                </span>
              </>
            )}
          </div>
        </div>
        <span className="label quiz-categorie">{[NOM_NIVEAU[q.niveau], q.categorie].filter(Boolean).join(' · ')}</span>
        <h2 className={'quiz-question' + questionSizeClass(q.texte)}>{espacesFines(q.texte)}</h2>
        {!r ? (
          <div className={'ans-grid' + answersSizeClass(q.reponses)}>
            {q.reponses.map((a, i) => (
              <button key={i} className="ans-btn" aria-disabled={busy || undefined} {...toucher(() => onRepondre(i))}>
                <Shape index={i} />
                <span className="ans-text">{espacesFines(a)}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={'card result-banner ' + (r.juste ? 'result-ok' : 'result-ko')} role="status">
              {r.juste ? (
                <>
                  <span className="big">🎊 +1</span>
                  <p>Bien joué !{r.xp > 0 ? ` +${r.xp} XP` : ''}</p>
                  <GerbeDeJuste />
                </>
              ) : (
                <>
                  <span className="result-icon">
                    <Icon name="x-circle" />
                  </span>
                  <p>{r.epreuve.issue === 'ratee' && !valide ? 'Raté… la ligne d’or est franchie' : 'Raté…'}</p>
                </>
              )}
              <p className="muted">
                La bonne réponse : <Shape index={r.bonne} inline />
                <strong>{espacesFines(q.reponses[r.bonne])}</strong>
              </p>
            </div>
            {r.anecdote && (
              <p className="card anecdote">
                <Icon name="message" />
                <span>
                  <b>Le saviez-vous ?</b> {espacesFines(r.anecdote)}
                </span>
              </p>
            )}
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={onSuivante}>
              {r.epreuve.finie ? 'Voir le résultat' : 'Question suivante'}
            </button>
            <button type="button" className="lien-signaler link-inline small" onClick={onSignaler}>
              Signaler une erreur dans cette question
            </button>
          </>
        )}
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
      </div>
    </div>
  )
}

/** La fin d'une étape : validée — ses étoiles, l'étape d'après — ou à réessayer, sans rien perdre. */
export function FinDeLEtape({
  fin,
  busy,
  erreur,
  onCorrection,
  onRejouer,
  onSuivant,
  onRetour,
}: {
  fin: Extract<Ecran, { e: 'fin' }>
  busy: boolean
  erreur: string
  onCorrection: () => void
  onRejouer: () => void
  onSuivant: () => void
  onRetour: () => void
}) {
  const r = fin.reponse
  const e = r.epreuve
  const sujet = sujetParCle(e.sujet)
  const validee = e.issue === 'validee'
  const etoiles = r.etoiles ?? etoilesDuSujet(e.justes, e.seuil)
  const derniere = e.palier >= PALIERS_D_UN_SUJET
  const s = e.justes > 1 ? 's' : ''
  return (
    <div className="player-shell campagne sentiers">
      <header className="fin-tete epreuve-fin-tete">
        <span className={'label' + (validee ? ' epreuve-validee' : '')}>{`${sujet?.nom ?? 'Parcours'} · étape ${e.palier} sur ${PALIERS_D_UN_SUJET}`}</span>
        {validee && <Etoiles n={etoiles} grandes />}
        <h1>{!validee ? 'Pas cette fois' : derniere && !e.rejeu ? 'Parcours accompli !' : e.rejeu ? 'Rejouée' : 'Étape validée'}</h1>
        <p className="muted small">{`${e.justes} bonne${s} réponse${s} sur ${e.total}${validee ? '' : ` : il en fallait ${e.seuil}`}.`}</p>
        {r.record && <p className="campagne-record-battu">Ta meilleure note sur cette étape</p>}
      </header>
      <BarreDEpreuve justes={e.justes} fausses={e.fausses} seuil={e.seuil} total={e.total} />
      <div className="epreuve-gains">
        <span>
          <b>🎊 +{fin.justesIci}</b>
          {`confetti${fin.justesIci > 1 ? 's' : ''}`}
        </span>
        <span>
          <b>+{fin.xp}</b>
          XP
        </span>
      </div>
      {fin.xp > 0 && <BarreDeNiveau />}
      {/* Le Marathonien et ce qu'il ouvre, validée ou non : il compte toutes les bonnes réponses. */}
      {!!r.recompenses?.length && (
        <section className="card campagne-recompenses">
          {r.recompenses.map(x => (
            <RecompenseTombee key={x.key} recompense={x} />
          ))}
        </section>
      )}
      {(r.legendaires ?? []).map(cle => (
        <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
      ))}
      {erreur && <p className="error">{erreur}</p>}
      {validee && !derniere && !e.rejeu ? (
        <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onSuivant}>
          <Icon name="play" />
          {`Jouer l’étape ${e.palier + 1}`}
        </button>
      ) : !validee ? (
        <>
          <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onRejouer}>
            <Icon name="rotate" />
            Réessayer
          </button>
          <p className="muted small centre">D’autres questions, et rien à perdre.</p>
        </>
      ) : null}
      {validee && etoiles < 3 && (
        <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={onRejouer}>
          <Icon name="rotate" />
          {`Rejouer pour ${'★'.repeat(etoiles + 1)}`}
        </button>
      )}
      <button type="button" className="btn btn-block" onClick={onRetour}>
        Retour aux parcours
      </button>
      {fin.correction ? (
        <SerieCorrigee correction={fin.correction} />
      ) : (
        <button type="button" className="btn btn-ghost btn-block" onClick={onCorrection}>
          Mes réponses
        </button>
      )}
    </div>
  )
}

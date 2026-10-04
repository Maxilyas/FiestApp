import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import { Shape } from '../components/Shape'
import { Feuille, Sortie } from '../components/Pieces'
import { Dessin } from '../components/Avatar'
import { LUEUR, lueur } from '../components/Atlas'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { BRANCHES, branche as brancheDe, deLaBranche, nomDansLaPhrase, ouvertsDansLaBranche, prochainDansLaBranche, type Branche, type CleDeBranche } from '../../../shared/branches'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import { NOM_NIVEAU, SIGNALEMENT_MAX, type CorrectionDeCampagne, type Niveau, type QuestionDeCampagne } from '../../../shared/campagne'
import { MAITRES_DU_CABINET } from '../../../shared/fonds'
import { THEMES } from '../../../shared/themes'
import {
  PALIERS,
  PALIER_DU_MAITRE,
  PALIERS_DU_SENTIER,
  QUESTIONS_PAR_EPREUVE,
  VIES_PAR_ACHAT_MAX,
  cleDeMaitre,
  etoilesDe,
  regleDuPalier,
  titreDeMaitre,
  type EpreuveDeSentier,
  type EtatDesSentiers,
  type Melange,
  type RegleDuPalier,
  type ReponseDEpreuve,
  type SentierDuJoueur,
  type VieDesSentiers,
} from '../../../shared/sentiers'

// Les sentiers du savoir (`shared/sentiers.ts`), le second onglet de la
// campagne : douze sentiers, un par branche, de douze paliers chacun, où se
// gagnent les avatars du savoir. Le serveur compte tout — paliers, vies,
// étoiles — et ne donne la bonne réponse qu'après la sienne : la page montre.
//
// Les écrans suivent la maquette validée le 5 octobre 2026 : les sentiers en
// tuiles, un sentier en chemin qui monte (une case par palier, l'avatar à
// gagner sur le sien), l'épreuve et sa barre de seize cases — les bonnes
// réponses depuis la gauche, les fautes depuis la droite, la ligne d'or au
// seuil —, la révélation d'un portrait, et le rachat des vies.

/** L'adresse d'un sentier : `#sentier-foret`. Celle des sentiers : `#sentiers`. */
export const ADRESSE_DES_SENTIERS = '#sentiers'
const PREFIXE = '#sentier-'

/** Le sentier que désigne l'adresse, s'il en est un. */
export function sentierDeLAdresse(hash: string): CleDeBranche | null {
  return hash.startsWith(PREFIXE) ? (brancheDe(hash.slice(PREFIXE.length))?.key ?? null) : null
}

/** L'entrée d'historique d'un sentier ouvert d'ici : « ← Les sentiers » y recule. */
const OUVERT_ICI = 'fiestappSentierOuvert'

type Ecran =
  | { e: 'chargement' }
  | { e: 'erreur'; motif: string }
  | { e: 'carte' }
  | {
      e: 'epreuve'
      epreuve: EpreuveDeSentier
      question: QuestionDeCampagne
      reponse: ReponseDEpreuve | null
      choix: number | null
      /** Ce que l'épreuve a rapporté depuis qu'on l'a ouverte sur cette page. */
      xp: number
      justesIci: number
    }
  | { e: 'fin'; reponse: ReponseDEpreuve; xp: number; justesIci: number; correction: CorrectionDeCampagne[] | null; porte: boolean }
  | { e: 'vies'; branche: CleDeBranche | null }

/** Les niveaux d'une épreuve, au féminin : ce sont des questions. */
const NIVEAU_DES_QUESTIONS: Record<Niveau, [string, string]> = {
  facile: ['facile', 'faciles'],
  moyen: ['moyenne', 'moyennes'],
  difficile: ['difficile', 'difficiles'],
  expert: ['experte', 'expertes'],
}

/** « 14 faciles et 2 moyennes ». */
export function texteDuMelange(m: Melange): string {
  const parts = (Object.entries(m) as [Niveau, number][]).filter(([, n]) => n > 0).map(([niveau, n]) => `${n} ${NIVEAU_DES_QUESTIONS[niveau][n > 1 ? 1 : 0]}`)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}` : (parts[0] ?? '')
}

/** « dans 3 h 12 », « dans 8 min » : jusqu'au retour des vies. */
export function dansCombien(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  if (minutes < 60) return `dans ${minutes} min`
  return `dans ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** Le palier à jouer d'un sentier : celui qui suit le dernier validé, le maître après le sommet ; null quand tout est fait. */
const paliersAJouer = (s: SentierDuJoueur): number | null => (s.paliers >= PALIER_DU_MAITRE ? null : s.paliers + 1)

const libelleVies = (v: VieDesSentiers) => `${v.jour} vie${v.jour > 1 ? 's' : ''}${v.reserve > 0 ? ` et ${v.reserve} en réserve` : ''}`

/**
 * Les sentiers, dans la page de la campagne : la carte des douze sentiers,
 * un sentier, une épreuve, sa fin, le rachat des vies. `onglets`, la rangée
 * « La série · Les sentiers » de la campagne, ne paraît que sur la carte :
 * on ne change pas de mode au milieu d'un chemin.
 */
export function Sentiers({ onglets, onSerie }: { onglets: ReactNode; onSerie: () => void }) {
  const [etat, setEtat] = useState<EtatDesSentiers | null>(null)
  const [ecran, setEcranBrut] = useState<Ecran>({ e: 'chargement' })
  const [ouvert, setOuvert] = useState<CleDeBranche | null>(() => sentierDeLAdresse(window.location.hash))
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    window.scrollTo(0, 0)
  }

  const relire = async () => {
    const lu = await api.campagne.sentiers.etat()
    setEtat(lu)
    return lu
  }

  useEffect(() => {
    let vivant = true
    relire()
      .then(() => vivant && setEcranBrut({ e: 'carte' }))
      .catch(e => vivant && setEcranBrut({ e: 'erreur', motif: motifDe(e) }))
    // Le retour du navigateur, ou un lien vers un sentier : on quitte la fin
    // d'une épreuve ou le rachat des vies pour le chemin qu'il désigne. Une
    // épreuve en cours, elle, reste à l'écran : on la quitte par son bouton,
    // qui dit ce qu'il en coûte.
    const suivre = () => {
      setOuvert(sentierDeLAdresse(window.location.hash))
      setEcranBrut(e => (e.e === 'fin' || e.e === 'vies' ? { e: 'carte' } : e))
    }
    window.addEventListener('hashchange', suivre)
    window.addEventListener('popstate', suivre)
    return () => {
      vivant = false
      window.removeEventListener('hashchange', suivre)
      window.removeEventListener('popstate', suivre)
    }
  }, [])

  /** Un sentier, avec son entrée d'historique : le retour du téléphone ramène aux sentiers. */
  const ouvrirSentier = (b: CleDeBranche) => {
    history.pushState({ ...(history.state ?? {}), [OUVERT_ICI]: true }, '', `${PREFIXE}${b}`)
    setOuvert(b)
    setEcran({ e: 'carte' })
  }
  /** « ← Les sentiers » : d'un cran si c'est d'ici qu'on l'a ouvert, sans entrée en double sinon. */
  const revenirAuxSentiers = () => {
    if ((history.state as Record<string, unknown> | null)?.[OUVERT_ICI] === true) history.back()
    else history.replaceState(history.state, '', ADRESSE_DES_SENTIERS)
    setOuvert(null)
    setEcran({ e: 'carte' })
  }
  /** Retour au sentier d'une épreuve : il est peut-être déjà ouvert sous elle. */
  const retourAuSentier = (b: CleDeBranche) => {
    if (ouvert !== b) {
      history.replaceState(history.state, '', `${PREFIXE}${b}`)
      setOuvert(b)
    }
    setEcran({ e: 'carte' })
    void relire().catch(() => {})
  }

  const jouer = async (b: CleDeBranche, palier: number) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const epreuve = await api.campagne.sentiers.commencer(b, palier)
      if (epreuve.question) setEcran({ e: 'epreuve', epreuve, question: epreuve.question, reponse: null, choix: null, xp: 0, justesIci: 0 })
    } catch (e) {
      // Sans vie, l'écran du rachat plutôt qu'un refus sec.
      const vies = etat?.vies
      if (vies && vies.jour + vies.reserve <= 0 && palier > (etat?.sentiers.find(s => s.branche === b)?.paliers ?? 0)) setEcran({ e: 'vies', branche: b })
      else setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const reprendre = (epreuve: EpreuveDeSentier) => {
    if (epreuve.question) setEcran({ e: 'epreuve', epreuve, question: epreuve.question, reponse: null, choix: null, xp: 0, justesIci: 0 })
  }

  const repondre = async (choix: number) => {
    if (ecran.e !== 'epreuve' || ecran.reponse || busy) return
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.campagne.sentiers.repondre(ecran.epreuve.id, ecran.question.index, choix)
      setEcranBrut({
        ...ecran,
        reponse,
        choix,
        epreuve: reponse.epreuve,
        xp: ecran.xp + reponse.xp,
        justesIci: ecran.justesIci + (reponse.juste ? 1 : 0),
      })
      if (reponse.vies) setEtat(avant => avant && { ...avant, vies: reponse.vies! })
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const suivante = () => {
    if (ecran.e !== 'epreuve' || !ecran.reponse) return
    const r = ecran.reponse
    if (r.epreuve.finie || !r.epreuve.question) {
      setEcran({ e: 'fin', reponse: r, xp: ecran.xp, justesIci: ecran.justesIci, correction: null, porte: false })
      void relire().catch(() => {})
      return
    }
    setEcran({ ...ecran, question: r.epreuve.question, reponse: null, choix: null })
  }

  const abandonner = async () => {
    if (ecran.e !== 'epreuve') return
    const enJeu = !ecran.epreuve.rejeu && ecran.epreuve.issue !== 'validee'
    const ok = await confirmDialog({
      title: 'Quitter l’épreuve ?',
      message: enJeu ? 'Un palier qu’on quitte compte comme raté : une vie de moins.' : 'Tu ne perds rien : ce qui est validé le reste.',
      confirmLabel: 'Quitter',
      danger: enJeu,
    })
    if (!ok) return
    try {
      const lu = await api.campagne.sentiers.abandonner(ecran.epreuve.id)
      setEtat(lu)
      retourAuSentier(ecran.epreuve.branche)
    } catch (e) {
      setErreur(motifDe(e))
    }
  }

  const signaler = async (epreuve: string, index: number) => {
    const texte = await promptDialog({
      title: 'Signaler une erreur',
      message: 'Dis en une phrase ce qui ne va pas : l’administrateur relit chaque signalement, et peut retirer la question de la campagne.',
      input: { value: '', placeholder: 'La réponse B est juste aussi…', maxLength: SIGNALEMENT_MAX },
      confirmLabel: 'Envoyer',
    })
    if (!texte) return
    try {
      await api.campagne.signaler(epreuve, index, texte)
      showToast({ kind: 'info', message: 'Merci : c’est envoyé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    }
  }

  if (ecran.e === 'chargement') return <SentiersEnChemin onglets={onglets} />
  if (ecran.e === 'erreur' || !etat) {
    return (
      <div className="player-shell campagne sentiers">
        <Sortie />
        {onglets}
        <p className="error">{ecran.e === 'erreur' ? ecran.motif : 'Les sentiers ne répondent pas : réessaie dans un instant.'}</p>
      </div>
    )
  }

  if (ecran.e === 'epreuve') {
    return (
      <EcranDEpreuve
        ecran={ecran}
        vies={etat.vies}
        busy={busy}
        erreur={erreur}
        onRepondre={i => void repondre(i)}
        onSuivante={suivante}
        onQuitter={() => void abandonner()}
        onSignaler={() => void signaler(ecran.epreuve.id, ecran.question.index)}
      />
    )
  }

  if (ecran.e === 'fin') {
    const voirCorrection = async () => {
      try {
        const correction = await api.campagne.correction(ecran.reponse.epreuve.id)
        setEcranBrut({ ...ecran, correction })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    const b = ecran.reponse.epreuve.branche
    return (
      <FinDEpreuve
        fin={ecran}
        etat={etat}
        busy={busy}
        erreur={erreur}
        onCorrection={() => void voirCorrection()}
        onPorte={() => setEcranBrut({ ...ecran, porte: true })}
        onRejouer={() => void jouer(b, ecran.reponse.epreuve.palier)}
        onSuivant={() => void jouer(b, ecran.reponse.epreuve.palier + 1)}
        onSentier={() => retourAuSentier(b)}
        onVies={() => setEcran({ e: 'vies', branche: b })}
      />
    )
  }

  if (ecran.e === 'vies') {
    return (
      <PlusDeVies
        etat={etat}
        onAchat={lu => {
          setEtat(lu)
          showToast({ kind: 'info', message: `Ta réserve : ${lu.vies.reserve} vie${lu.vies.reserve > 1 ? 's' : ''}` })
        }}
        onSentier={() => (ecran.branche ? retourAuSentier(ecran.branche) : revenirAuxSentiers())}
        onSerie={onSerie}
      />
    )
  }

  if (ouvert) {
    const s = etat.sentiers.find(x => x.branche === ouvert)!
    return (
      <SentierVu
        sentier={s}
        etat={etat}
        busy={busy}
        erreur={erreur}
        onRetour={revenirAuxSentiers}
        onJouer={n => void jouer(ouvert, n)}
        onReprendre={reprendre}
        onVies={() => setEcran({ e: 'vies', branche: ouvert })}
      />
    )
  }

  return <CarteDesSentiers etat={etat} onglets={onglets} erreur={erreur} onOuvrir={ouvrirSentier} onReprendre={reprendre} onVies={() => setEcran({ e: 'vies', branche: null })} />
}

/** La page qui s'ouvre tout de suite : les onglets, puis la place des sentiers, sans rien décaler. */
export function SentiersEnChemin({ onglets }: { onglets: ReactNode }) {
  return (
    <div className="player-shell campagne sentiers" aria-busy="true">
      <Sortie />
      {onglets}
      <div className="sentiers-grille">
        {BRANCHES.map(b => (
          <span key={b.key} className="sentiers-tuile sentiers-tuile-vide" style={lueur(LUEUR[b.key])}>
            <b>{b.nom}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Les pièces ──────────────────────────────────────────────────────────────

/** Un cœur, plein ou vide : les vies des sentiers, comme celles de la série. */
function Coeur({ plein = true }: { plein?: boolean }) {
  return (
    <svg className="icon coeur" viewBox="0 0 24 24" fill={plein ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
    </svg>
  )
}

/** Les vies du jour en un cœur et un nombre (les trois cœurs restent à la série), la réserve à côté. */
function ViesDuJour({ vies }: { vies: VieDesSentiers }) {
  return (
    <span className={'vies-jour' + (vies.jour + vies.reserve === 0 ? ' vies-vides' : '')} role="img" aria-label={`${libelleVies(vies)} aujourd’hui`}>
      <Coeur plein={vies.jour + vies.reserve > 0} />
      {vies.jour}
      {vies.reserve > 0 && <small>+{vies.reserve}</small>}
    </span>
  )
}

/** Trois étoiles, pleines jusqu'à `n`. */
function Etoiles({ n, grandes }: { n: number; grandes?: boolean }) {
  return (
    <span className={'sentier-etoiles' + (grandes ? ' sentier-etoiles-grandes' : '')} role="img" aria-label={`${n} étoile${n > 1 ? 's' : ''} sur 3`}>
      {[1, 2, 3].map(i => (
        <svg key={i} viewBox="0 0 24 24" className={i <= n ? 'pleine' : undefined} aria-hidden="true">
          <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
        </svg>
      ))}
    </span>
  )
}

/**
 * Un portrait, dessiné ou en silhouette dorée, à sa taille. Petit, il tient
 * dans son disque, comme dans une liste ; en grand — sa révélation —, ce qui
 * en sort, son aura et ses étoiles.
 */
function Portrait({ cle, verrouille, taille, grand }: { cle: string; verrouille?: boolean; taille: number; grand?: boolean }) {
  return (
    <span className={'sentier-portrait' + (grand ? ' sentier-portrait-grand' : '')} style={{ width: taille, height: taille }}>
      <Dessin cle={cle} verrouille={verrouille} grand={grand} />
    </span>
  )
}

/**
 * La barre d'une épreuve : seize cases, les bonnes réponses montent de la
 * gauche, les fautes de la droite, et la ligne d'or au seuil — celle que les
 * fautes ne doivent pas franchir.
 */
export function BarreDEpreuve({ justes, fausses, seuil, neuve }: { justes: number; fausses: number; seuil: number; neuve?: 'ok' | 'ko' | null }) {
  return (
    <div className="epreuve-cases" role="img" aria-label={`${justes} bonne${justes > 1 ? 's' : ''} réponse${justes > 1 ? 's' : ''}, ${fausses} faute${fausses > 1 ? 's' : ''}, ${seuil} pour valider`}>
      {Array.from({ length: QUESTIONS_PAR_EPREUVE }, (_, i) => {
        const ok = i < justes
        const ko = i >= QUESTIONS_PAR_EPREUVE - fausses
        const neuf = (neuve === 'ok' && i === justes - 1) || (neuve === 'ko' && i === QUESTIONS_PAR_EPREUVE - fausses)
        return <i key={i} className={(ok ? 'case-ok' : ko ? 'case-ko' : '') + (neuf ? ' case-neuve' : '')} />
      })}
      <span className="epreuve-seuil" style={{ '--seuil': seuil } as CSSProperties} />
    </div>
  )
}

// ── La carte des sentiers ───────────────────────────────────────────────────

/** Ce qu'on voit d'une branche sur sa tuile : son dernier portrait gagné, sinon le premier, en silhouette. */
function vitrineDe(b: Branche, s: SentierDuJoueur): { cle: string; verrouille: boolean } {
  const n = ouvertsDansLaBranche(b, { [b.key]: s.paliers })
  return n > 0 ? { cle: b.portraits[n - 1].key, verrouille: false } : { cle: b.portraits[0].key, verrouille: true }
}

function CarteDesSentiers({
  etat,
  onglets,
  erreur,
  onOuvrir,
  onReprendre,
  onVies,
}: {
  etat: EtatDesSentiers
  onglets: ReactNode
  erreur: string
  onOuvrir: (b: CleDeBranche) => void
  onReprendre: (e: EpreuveDeSentier) => void
  onVies: () => void
}) {
  const { vies } = etat
  const avatars = etat.sentiers.reduce((n, s) => n + ouvertsDansLaBranche(brancheDe(s.branche)!, { [s.branche]: s.paliers }), 0)
  const maitres = etat.sentiers.filter(s => s.paliers >= PALIER_DU_MAITRE).length
  // Le sentier qu'on avance : l'épreuve laissée d'abord, sinon le plus haut qui n'est pas fini.
  const enCours = [...etat.sentiers].filter(s => s.paliers > 0 && s.paliers < PALIERS_DU_SENTIER).sort((a, b) => b.paliers - a.paliers)[0]
  const laissee = etat.epreuve
  return (
    <div className="player-shell campagne sentiers">
      <Sortie />
      {onglets}
      <section className={'sentiers-vies' + (vies.jour + vies.reserve === 0 ? ' sentiers-vies-vides' : '')}>
        <span className="sentiers-gros-coeur">
          <Coeur plein={vies.jour + vies.reserve > 0} />
        </span>
        <b>{`${vies.jour} vie${vies.jour > 1 ? 's' : ''} sur ${vies.parJour} aujourd’hui`}</b>
        <span className="muted small">
          {vies.reserve > 0 ? `+${vies.reserve} en réserve · ` : ''}elles reviennent à minuit
        </span>
        <button type="button" className="link-inline small sentiers-racheter" onClick={onVies}>
          Racheter des vies
        </button>
      </section>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      {laissee ? (
        <Reprise branche={brancheDe(laissee.branche)!} palier={laissee.palier} detail={`${laissee.justes} bonne${laissee.justes > 1 ? 's' : ''} sur ${laissee.justes + laissee.fausses}`} bouton="Reprendre l’épreuve" onClick={() => onReprendre(laissee)} />
      ) : enCours ? (
        <Reprise
          branche={brancheDe(enCours.branche)!}
          palier={enCours.paliers + 1}
          detail={(() => {
            const p = prochainDansLaBranche(brancheDe(enCours.branche)!, { [enCours.branche]: enCours.paliers })
            return p ? `Le palier ${p.portrait.palier} ouvre ${nomDansLaPhrase(p.portrait.nom)}` : 'Vers le sommet'
          })()}
          bouton="Continuer le sentier"
          onClick={() => onOuvrir(enCours.branche)}
        />
      ) : (
        avatars === 0 && <p className="muted sentiers-intro">Douze sentiers, un par branche du savoir. Un palier se valide à douze bonnes réponses sur seize ; un avatar tous les deux paliers. Choisis ton premier sentier.</p>
      )}
      <div className="sentiers-compte">
        <span className="label">Tes douze sentiers</span>
        <span className="muted small">{`${avatars} avatar${avatars > 1 ? 's' : ''} sur ${BRANCHES.length * 6} · ${maitres} maître${maitres > 1 ? 's' : ''}`}</span>
      </div>
      <div className="sentiers-grille">
        {BRANCHES.map(b => {
          const s = etat.sentiers.find(x => x.branche === b.key)!
          const n = ouvertsDansLaBranche(b, { [b.key]: s.paliers })
          const v = vitrineDe(b, s)
          const etatDuSentier = s.paliers >= PALIER_DU_MAITRE ? 'Maître' : s.paliers >= PALIERS_DU_SENTIER ? 'Maître à tenter' : s.paliers === 0 ? 'À commencer' : `Palier ${s.paliers + 1}`
          return (
            <button
              key={b.key}
              type="button"
              className={'sentiers-tuile' + (s.paliers >= PALIERS_DU_SENTIER ? ' sentiers-tuile-complete' : '')}
              style={lueur(LUEUR[b.key])}
              aria-label={`${b.nom} : ${n} avatar${n > 1 ? 's' : ''} sur 6, ${etatDuSentier.toLowerCase()}`}
              onClick={() => onOuvrir(b.key)}
            >
              <Portrait cle={v.cle} verrouille={v.verrouille} taille={46} />
              <b>{b.nom}</b>
              <span className="sentiers-mini" aria-hidden="true">
                {b.portraits.map((p, i) => (
                  <i key={p.key} className={i < n ? 'mini-ok' : undefined} />
                ))}
              </span>
              <span className="sentiers-etat" aria-hidden="true">
                {s.paliers >= PALIER_DU_MAITRE && <Icon name="crown" />}
                {etatDuSentier}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** La carte « Reprendre » : un sentier en cours, ou l'épreuve qu'on a laissée. */
function Reprise({ branche: b, palier, detail, bouton, onClick }: { branche: Branche; palier: number; detail: string; bouton: string; onClick: () => void }) {
  const p = prochainDansLaBranche(b, { [b.key]: palier - 1 })
  return (
    <section className="sentiers-reprise" style={lueur(LUEUR[b.key])}>
      {p ? <Portrait cle={p.portrait.key} verrouille taille={52} /> : <span className="sentiers-couronne"><Icon name="crown" /></span>}
      <p>
        <span className="label">{palier === PALIER_DU_MAITRE ? 'Le palier de maître' : `Palier ${palier}`}</span>
        <strong>{b.nom}</strong>
        <span className="muted small">{detail}</span>
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={onClick}>
        {bouton}
      </button>
    </section>
  )
}

// ── Un sentier ──────────────────────────────────────────────────────────────

/** L'onde du chemin : de gauche à droite, palier après palier, comme un sentier de montagne. */
const ONDE = [0, 0.62, 0.62, 0, -0.62, -0.62]

/** Où se pose chaque palier : sa place sur la largeur (en %) et sa hauteur depuis le départ (en px). */
function placesDuChemin(): { x: number; y: number }[] {
  const places: { x: number; y: number }[] = []
  let y = 70
  PALIERS.forEach((r, i) => {
    const avant = PALIERS[i - 1]
    if (i > 0) y += 70 + (r.avatar !== null || r.maitre ? 30 : 0) + (avant.avatar !== null ? 48 : 20)
    places.push({ x: r.maitre ? 50 : 50 + ONDE[i % ONDE.length] * 30, y })
  })
  return places
}
const PLACES = placesDuChemin()
/** Au-dessus du maître, la place de sa couronne : la page commence au sentier, pas à un vide. */
const HAUTEUR_DU_CHEMIN = PLACES[PLACES.length - 1].y + 48

/** La courbe qui relie des places, en coordonnées du dessin (y vers le bas). */
function courbe(points: { x: number; y: number }[]): string {
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `C ${points[i - 1].x} ${(points[i - 1].y + p.y) / 2}, ${p.x} ${(points[i - 1].y + p.y) / 2}, ${p.x} ${p.y}`)).join(' ')
}

function SentierVu({
  sentier: s,
  etat,
  busy,
  erreur,
  onRetour,
  onJouer,
  onReprendre,
  onVies,
}: {
  sentier: SentierDuJoueur
  etat: EtatDesSentiers
  busy: boolean
  erreur: string
  onRetour: () => void
  onJouer: (palier: number) => void
  onReprendre: (e: EpreuveDeSentier) => void
  onVies: () => void
}) {
  const b = brancheDe(s.branche)!
  const [fiche, setFiche] = useState<number | null>(null)
  const courant = paliersAJouer(s)
  const n = ouvertsDansLaBranche(b, { [b.key]: s.paliers })
  const prochain = prochainDansLaBranche(b, { [b.key]: s.paliers })
  const chemin = useRef<HTMLDivElement>(null)
  const laissee = etat.epreuve?.branche === b.key ? etat.epreuve : null
  // Le palier à jouer en vue, sans animation : on arrive où l'on en est.
  useEffect(() => {
    const vise = chemin.current?.querySelector<HTMLElement>('.palier-courant') ?? chemin.current?.querySelector<HTMLElement>('.palier-maitre')
    vise?.scrollIntoView({ block: 'center' })
  }, [b.key])
  const points = PLACES.map(p => ({ x: p.x, y: HAUTEUR_DU_CHEMIN - p.y }))
  const iCourant = Math.min(s.paliers, PALIERS.length - 1)
  const regle = fiche ? regleDuPalier(fiche) : null
  const sansVie = etat.vies.jour + etat.vies.reserve === 0
  return (
    <div className="player-shell campagne sentiers sentier" style={lueur(LUEUR[b.key])}>
      <div className="sentier-tete">
        <div className="sentier-ligne">
          <Sortie vers="Les sentiers" href={ADRESSE_DES_SENTIERS} onClick={onRetour} />
          <ViesDuJour vies={etat.vies} />
        </div>
        <h1>{b.nom}</h1>
        <span className="muted small">
          {`${b.categorie} · ${n} avatar${n > 1 ? 's' : ''} sur 6 · `}
          {s.paliers >= PALIER_DU_MAITRE ? 'maître' : s.paliers >= PALIERS_DU_SENTIER ? 'sommet atteint' : `palier ${s.paliers + 1} sur ${PALIERS_DU_SENTIER}`}
        </span>
        {prochain ? (
          <p className="sentier-prochain">
            <Portrait cle={prochain.portrait.key} verrouille taille={34} />
            <span>
              {`Le palier ${prochain.portrait.palier} ouvre `}
              <b>{nomDansLaPhrase(prochain.portrait.nom)}</b>
            </span>
          </p>
        ) : (
          s.paliers < PALIER_DU_MAITRE && (
            <p className="sentier-prochain">
              <span className="sentiers-couronne petite">
                <Icon name="crown" />
              </span>
              <span>
                Après le sommet, le palier de maître : <b>{titreDeMaitre(b)}</b>
              </span>
            </p>
          )
        )}
      </div>
      {laissee && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => onReprendre(laissee)}>
          {`Reprendre le palier ${laissee.palier} · ${laissee.justes} sur ${laissee.justes + laissee.fausses}`}
        </button>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <div className="sentier-chemin" ref={chemin} style={{ height: HAUTEUR_DU_CHEMIN }}>
        <svg className="sentier-trace" viewBox={`0 0 100 ${HAUTEUR_DU_CHEMIN}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={courbe(points)} className="trace-a-venir" />
          {s.paliers > 0 && <path d={courbe(points.slice(0, iCourant + 1))} className="trace-faite" />}
        </svg>
        {/* La jauge : les questions durcissent, des faciles en bas aux expertes du maître. */}
        <span
          className="sentier-jauge"
          aria-hidden="true"
          style={{ bottom: PLACES[0].y - 20, height: PLACES[12].y - PLACES[0].y + 40 }}
        />
        {(
          [
            ['Facile', 1, 'jauge-facile'],
            ['Moyen', 6, 'jauge-moyen'],
            ['Difficile', 10, 'jauge-difficile'],
            ['Expert', 12, 'jauge-expert'],
          ] as const
        ).map(([nom, i, classe]) => (
          <span key={nom} className={`sentier-jauge-nom ${classe}`} aria-hidden="true" style={{ bottom: PLACES[i].y }}>
            {nom}
          </span>
        ))}
        {/* L'accolade : du neuvième au maître, chaque sous-thème a sa question. */}
        <span className="sentier-accolade" aria-hidden="true" style={{ bottom: PLACES[8].y - 30, height: PLACES[12].y - PLACES[8].y + 60 }} />
        <span className="sentier-accolade-nom" aria-hidden="true" style={{ bottom: (PLACES[8].y + PLACES[12].y) / 2 }}>
          Toute la catégorie
        </span>
        <span className="sentier-depart" aria-hidden="true">
          Départ
        </span>
        <ol className="sentier-paliers" aria-label="Les paliers du sentier">
          {PALIERS.map((r, i) => {
            const { x, y } = PLACES[i]
            const fait = s.paliers >= r.n
            const vise = courant === r.n
            const etoiles = s.etoiles[i] ?? 0
            const p = r.avatar !== null ? b.portraits[r.avatar] : null
            const taille = r.maitre ? 64 : p ? 72 : 48
            const classes = ['sentier-palier', fait ? 'palier-fait' : vise ? 'palier-courant' : 'palier-avenir', p ? 'palier-portrait' : '', r.n === PALIERS_DU_SENTIER ? 'palier-sommet' : '', r.maitre ? 'palier-maitre' : '']
            const libelle =
              (r.maitre ? 'Palier de maître, seize expertes' : `Palier ${r.n}`) +
              (p ? `, ouvre ${nomDansLaPhrase(p.nom)}` : '') +
              (fait ? `, validé${etoiles > 0 ? `, ${etoiles} étoile${etoiles > 1 ? 's' : ''}` : ''}` : vise ? ', à jouer' : '')
            return (
              <li key={r.n} style={{ left: `${x}%`, bottom: y }}>
                <button type="button" className={classes.filter(Boolean).join(' ')} style={{ width: taille, height: taille }} aria-label={libelle} onClick={() => setFiche(r.n)}>
                  {r.maitre ? <Icon name="crown" /> : p ? <Portrait cle={p.key} verrouille={!fait} taille={taille - 12} /> : fait ? <Icon name="check" /> : <span>{r.n}</span>}
                </button>
                {p || r.maitre ? (
                  <span className={'sentier-nom' + (vise ? ' sentier-nom-vise' : '') + (r.maitre ? ' sentier-nom-maitre' : '')} aria-hidden="true" style={{ top: taille / 2 + 4 }}>
                    <b>{r.maitre ? 'Palier de maître' : p!.nom}</b>
                    {fait && etoiles > 0 ? <Etoiles n={etoiles} /> : <span>{r.maitre ? '16 expertes · un titre' : vise ? `palier ${r.n} · à jouer` : r.n === PALIERS_DU_SENTIER ? 'le sommet' : `palier ${r.n}`}</span>}
                  </span>
                ) : (
                  fait &&
                  etoiles > 0 && (
                    <span className="sentier-nom" aria-hidden="true" style={{ top: taille / 2 + 2 }}>
                      <Etoiles n={etoiles} />
                    </span>
                  )
                )}
                {vise && (
                  <span className={'sentier-jouer' + (x > 50 ? ' a-gauche' : '')} aria-hidden="true" style={{ [x > 50 ? 'right' : 'left']: taille / 2 + 10 }}>
                    Jouer
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      {regle && fiche !== null && (
        <Feuille titre={regle.maitre ? 'Le palier de maître' : `Palier ${regle.n} sur ${PALIERS_DU_SENTIER}`} onFermer={() => setFiche(null)}>
          <FicheDuPalier
            regle={regle}
            branche={b}
            sentier={s}
            maitres={etat.sentiers.filter(x => x.paliers >= PALIER_DU_MAITRE).length}
            sansVie={sansVie}
            busy={busy}
            onJouer={() => {
              setFiche(null)
              onJouer(regle.n)
            }}
            onVies={() => {
              setFiche(null)
              onVies()
            }}
          />
        </Feuille>
      )}
    </div>
  )
}

/** La fiche d'un palier, qu'on ouvre en le touchant : ses questions, sa règle, ce qu'il ouvre, et le geste. */
function FicheDuPalier({
  regle: r,
  branche: b,
  sentier: s,
  maitres,
  sansVie,
  busy,
  onJouer,
  onVies,
}: {
  regle: RegleDuPalier
  branche: Branche
  sentier: SentierDuJoueur
  /** Les sentiers dont il est déjà maître. */
  maitres: number
  sansVie: boolean
  busy: boolean
  onJouer: () => void
  onVies: () => void
}) {
  const fait = s.paliers >= r.n
  const vise = paliersAJouer(s) === r.n
  const etoiles = s.etoiles[r.n - 1] ?? 0
  const p = r.avatar !== null ? b.portraits[r.avatar] : null
  const sousThemes = SOUS_THEMES[b.categorie as keyof typeof SOUS_THEMES]?.length ?? 0
  const regles = [r.touteLaCategorie ? 'chaque sous-thème a sa question' : null, r.sansVraiFaux ? 'pas de vrai ou faux' : null].filter(Boolean)
  return (
    <div className="sentier-fiche">
      {r.maitre && <p className="muted small">{`Après le sommet, facultatif : des questions que moins d’un joueur sur cinq trouve. En réussir plus de la moitié fait de toi le maître ${deLaBranche(b)}.`}</p>}
      <dl className="sentier-regle">
        <dt>Questions</dt>
        <dd>{`${texteDuMelange(r.melange)}${r.touteLaCategorie && sousThemes > 0 ? ', de toute la catégorie' : ''}`}</dd>
        <dt>Pour valider</dt>
        <dd>{`${r.seuil} bonnes réponses sur ${QUESTIONS_PAR_EPREUVE}`}</dd>
        <dt>Étoiles</dt>
        <dd>{`★★ à ${r.seuil + Math.ceil((QUESTIONS_PAR_EPREUVE - r.seuil) / 2)}, ★★★ sans faute`}</dd>
        {regles.length > 0 && (
          <>
            <dt>Règles</dt>
            <dd>{regles.join(' · ')}</dd>
          </>
        )}
        {r.maitre && (
          <>
            <dt>Récompense</dt>
            <dd>{`le titre « ${titreDeMaitre(b)} »`}</dd>
          </>
        )}
      </dl>
      {r.maitre && <CeQueRapportentLesMaitres maitres={maitres} />}
      {p && (
        <div className="sentier-fiche-avatar">
          <Portrait cle={p.key} verrouille={!fait} taille={56} />
          <p>{fait ? <>Tu as gagné <b>{nomDansLaPhrase(p.nom)}</b>.</> : <>Ce palier ouvre <b>{nomDansLaPhrase(p.nom)}</b>.</>}</p>
        </div>
      )}
      {fait ? (
        <>
          <p className="muted small">
            {etoiles > 0 ? (
              <>
                Validé · <Etoiles n={etoiles} />
              </>
            ) : (
              'Validé avec tes portraits d’avant les sentiers : rejoue-le pour ses étoiles.'
            )}
          </p>
          <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={onJouer}>
            <Icon name="rotate" />
            Rejouer · sans risquer de vie
          </button>
        </>
      ) : vise ? (
        sansVie ? (
          <button type="button" className="btn btn-primary btn-block" onClick={onVies}>
            Plus de vies : racheter
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onJouer}>
              <Icon name="play" />
              {r.maitre ? 'Tenter le maître' : `Jouer le palier ${r.n}`}
            </button>
            <p className="muted small centre">Une vie en jeu : un palier raté en coûte une.</p>
          </>
        )
      ) : (
        <p className="muted">{`Valide d’abord le palier ${(paliersAJouer(s) ?? r.n)}.`}</p>
      )}
    </div>
  )
}

/** Le thème que les maîtres gagnent, et combien il en faut (`shared/themes.ts`, `gagne`). */
const THEME_DES_MAITRES = THEMES.find(t => t.gagne)

/**
 * Ce que rapportent les maîtres : chacun son titre, le Cabinet de curiosités
 * au troisième, et le thème qu'aucune boutique ne vend au douzième — ce
 * qu'on a déjà en clair, ce qui vient en pointillé.
 */
function CeQueRapportentLesMaitres({ maitres }: { maitres: number }) {
  const lignes: { n: number; titre: string; detail: string }[] = [
    { n: 1, titre: 'Un titre', detail: 'Le nom de son sentier, sous ton prénom : « Maître de la forêt ».' },
    { n: MAITRES_DU_CABINET, titre: 'Le Cabinet de curiosités', detail: 'Un fond pour ta carte de joueur.' },
    ...(THEME_DES_MAITRES ? [{ n: THEME_DES_MAITRES.gagne!.maitres, titre: `Le thème ${THEME_DES_MAITRES.nom}`, detail: 'Aucune boutique ne le vend.' }] : []),
  ]
  return (
    <section className="maitres-recompenses" aria-labelledby="maitres-titre">
      <span className="label" id="maitres-titre">{`Ce que rapportent les maîtres · ${maitres} sur ${BRANCHES.length}`}</span>
      <ol>
        {lignes.map(l => (
          <li key={l.n} className={maitres >= l.n ? 'maitres-acquis' : undefined}>
            <span className="maitres-pastille" aria-hidden="true">
              {l.n}
            </span>
            <span>
              <b>{l.titre}</b>
              <span className="muted small">{maitres >= l.n ? 'À toi.' : l.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ── L'épreuve ───────────────────────────────────────────────────────────────

function EcranDEpreuve({
  ecran,
  vies,
  busy,
  erreur,
  onRepondre,
  onSuivante,
  onQuitter,
  onSignaler,
}: {
  ecran: Extract<Ecran, { e: 'epreuve' }>
  vies: VieDesSentiers
  busy: boolean
  erreur: string
  onRepondre: (i: number) => void
  onSuivante: () => void
  onQuitter: () => void
  onSignaler: () => void
}) {
  const { epreuve: e, question: q, reponse: r } = ecran
  const b = brancheDe(e.branche)!
  const regle = regleDuPalier(e.palier)!
  const p = regle.avatar !== null ? b.portraits[regle.avatar] : null
  const valide = e.issue === 'validee'
  const reste = Math.max(0, e.seuil - e.justes)
  const permises = QUESTIONS_PAR_EPREUVE - e.seuil - e.fausses
  const sousTheme = q.sousTheme ? SOUS_THEMES[b.categorie as keyof typeof SOUS_THEMES]?.find(x => x.cle === q.sousTheme)?.nom : null
  const pourQuoi = regle.maitre ? `le titre « ${titreDeMaitre(b)} »` : p ? nomDansLaPhrase(p.nom) : `valider le palier ${e.palier}`
  return (
    <div className="player-shell campagne sentiers" style={lueur(LUEUR[b.key])}>
      <div className="quiz-player epreuve">
        <div className="quiz-topbar">
          <span className="label">{`${regle.maitre ? 'Maître' : `Palier ${e.palier}`} · question ${q.index + 1}/${e.total}`}</span>
          {e.rejeu ? <span className="label epreuve-rejeu">Rejeu</span> : <ViesDuJour vies={vies} />}
        </div>
        <div className="epreuve-enjeu">
          {p ? <Portrait cle={p.key} verrouille={!e.rejeu} taille={42} /> : regle.maitre ? <span className="sentiers-couronne petite"><Icon name="crown" /></span> : null}
          <p>
            {e.rejeu ? (
              <>Rejeu : aucune vie en jeu, pour les étoiles et les confettis.</>
            ) : (
              <>
                <b>{`${e.seuil} bonnes réponses sur ${QUESTIONS_PAR_EPREUVE}`}</b>
                {` pour ${pourQuoi}. Une vie en jeu.`}
              </>
            )}
          </p>
        </div>
        <div className="epreuve-barre">
          <BarreDEpreuve justes={e.justes} fausses={e.fausses} seuil={e.seuil} neuve={r ? (r.juste ? 'ok' : 'ko') : null} />
          <div className="epreuve-legende">
            {valide ? (
              <span>
                <b>Validé !</b>
                {` Encore ${QUESTIONS_PAR_EPREUVE - e.justes - e.fausses} question${QUESTIONS_PAR_EPREUVE - e.justes - e.fausses > 1 ? 's' : ''} pour les étoiles`}
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
        <span className="label quiz-categorie">{[NOM_NIVEAU[q.niveau], b.categorie, sousTheme].filter(Boolean).join(' · ')}</span>
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
                  <p>Bien joué !{r.xp > 0 ? ` +${r.xp} XP` : ''}</p>
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
            {!r.epreuve.finie && !valide && reste > 0 && reste <= 2 && (
              <p className="epreuve-encore">{`Plus qu’${reste === 1 ? 'une bonne réponse' : 'deux bonnes réponses'} pour ${pourQuoi}`}</p>
            )}
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
        {!r?.epreuve.finie && (
          <button type="button" className="btn btn-ghost btn-small epreuve-quitter" onClick={onQuitter}>
            Quitter l’épreuve
          </button>
        )}
      </div>
    </div>
  )
}

// ── La fin d'une épreuve ────────────────────────────────────────────────────

/** Le rang d'un portrait, en toutes lettres : « Quatrième avatar de la forêt ». */
const RANGS = ['Premier', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième']

function FinDEpreuve({
  fin,
  etat,
  busy,
  erreur,
  onCorrection,
  onPorte,
  onRejouer,
  onSuivant,
  onSentier,
  onVies,
}: {
  fin: Extract<Ecran, { e: 'fin' }>
  etat: EtatDesSentiers
  busy: boolean
  erreur: string
  onCorrection: () => void
  onPorte: () => void
  onRejouer: () => void
  onSuivant: () => void
  onSentier: () => void
  onVies: () => void
}) {
  const r = fin.reponse
  const e = r.epreuve
  const b = brancheDe(e.branche)!
  const regle = regleDuPalier(e.palier)!
  const validee = e.issue === 'validee'
  const etoiles = r.etoiles ?? etoilesDe(e.justes, e.seuil)
  const vies = r.vies ?? etat.vies
  const sansVie = vies.jour + vies.reserve === 0
  // Ses maîtres, celui-ci compris : l'état relu après l'épreuve peut ne pas l'avoir encore.
  const maitres = etat.sentiers.filter(s => s.paliers >= PALIER_DU_MAITRE || (r.maitre && s.branche === e.branche)).length
  const gains = (
    <div className="epreuve-gains">
      <span>
        <b>🎊 +{fin.justesIci}</b>
        confetti{fin.justesIci > 1 ? 's' : ''}
      </span>
      <span>
        <b>+{fin.xp}</b>
        XP
      </span>
    </div>
  )
  const correction = fin.correction ? (
    <ol className="campagne-correction">
      {fin.correction.map((c, i) => (
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
  ) : (
    <button type="button" className="btn btn-ghost btn-block" onClick={onCorrection}>
      Mes réponses
    </button>
  )

  const porter = async (patch: { legendaire: string } | { titre: string }, dit: string) => {
    try {
      await api.joueur.enregistrer(patch)
      onPorte()
      showToast({ kind: 'info', message: dit })
    } catch (err) {
      showToast({ kind: 'error', message: motifDe(err) })
    }
  }

  if (!validee) {
    const deux = e.justes >= e.seuil - 2
    return (
      <div className="player-shell campagne sentiers" style={lueur(LUEUR[b.key])}>
        <header className="fin-tete epreuve-fin-tete">
          <span className="label">{`${b.nom} · ${regle.maitre ? 'palier de maître' : `palier ${e.palier}`}`}</span>
          <h1>{deux ? 'Raté de peu' : 'Pas cette fois'}</h1>
          <p className="muted small">{`${e.justes} bonne${e.justes > 1 ? 's' : ''} réponse${e.justes > 1 ? 's' : ''} : il en fallait ${e.seuil}.${e.fausses > QUESTIONS_PAR_EPREUVE - e.seuil ? ` La ${e.fausses === 5 ? 'cinquième' : `${e.fausses}ᵉ`} faute a franchi la ligne.` : ''}`}</p>
        </header>
        <BarreDEpreuve justes={e.justes} fausses={e.fausses} seuil={e.seuil} />
        {!e.rejeu ? (
          <div className="epreuve-perte">
            <span className="epreuve-moins">
              −1 <Coeur />
            </span>
            <p>{`Il te reste ${libelleVies(vies)} aujourd’hui.`}</p>
          </div>
        ) : (
          <p className="muted small">Un rejeu ne coûte rien : le palier reste validé.</p>
        )}
        {gains}
        {erreur && <p className="error">{erreur}</p>}
        {sansVie && !e.rejeu ? (
          <button type="button" className="btn btn-primary btn-big btn-block" onClick={onVies}>
            Racheter des vies
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onRejouer}>
              <Icon name="rotate" />
              Réessayer
            </button>
            <p className="muted small centre">{e.rejeu ? 'D’autres questions, sans rien risquer.' : 'D’autres questions, et une vie en jeu.'}</p>
          </>
        )}
        {correction}
        <button type="button" className="btn btn-block" onClick={onSentier}>
          Retour au sentier
        </button>
      </div>
    )
  }

  // Validée : un portrait, un titre de maître, ou le palier d'avant le suivant.
  const portrait = r.avatar ? b.portraits.find(p => p.key === r.avatar) : undefined
  const suivant = e.palier < PALIER_DU_MAITRE ? e.palier + 1 : null
  const prochain = prochainDansLaBranche(b, { [b.key]: e.palier })
  const tete = (
    <>
      <span className="label epreuve-validee">{`${regle.maitre ? 'Palier de maître' : `Palier ${e.palier}`} validé · ${e.justes} sur ${QUESTIONS_PAR_EPREUVE}`}</span>
      <Etoiles n={etoiles} grandes />
      {r.record && <p className="campagne-record-battu">Ta meilleure note sur ce palier</p>}
    </>
  )
  if (portrait) {
    const rang = b.portraits.indexOf(portrait)
    return (
      <div className="player-shell campagne sentiers" style={lueur(LUEUR[b.key])}>
        <section className="epreuve-revelation">
          {tete}
          <div className="epreuve-medaillon">
            <span className="epreuve-eclats" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <i key={i} />
              ))}
            </span>
            <Portrait cle={portrait.key} taille={188} grand />
          </div>
          <h1>{`${portrait.nom} est à toi`}</h1>
          <p className="muted">{`${RANGS[rang]} avatar ${deLaBranche(b)}.`}</p>
        </section>
        {gains}
        {fin.porte ? (
          <p className="muted small centre">C’est lui que la salle verra.</p>
        ) : (
          <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => void porter({ legendaire: portrait.key }, `Tu portes ${nomDansLaPhrase(portrait.nom)}`)}>
            Le porter
          </button>
        )}
        <button type="button" className="btn btn-block" onClick={onSentier}>
          Continuer le sentier
        </button>
        {prochain && (
          <p className="sentier-prochain">
            <Portrait cle={prochain.portrait.key} verrouille taille={36} />
            <span>
              <span className="label">Prochain</span>
              <br />
              {`${prochain.portrait.nom}, au palier ${prochain.portrait.palier} · encore ${prochain.encore} palier${prochain.encore > 1 ? 's' : ''}`}
            </span>
          </p>
        )}
        {correction}
      </div>
    )
  }

  if (r.maitre) {
    return (
      <div className="player-shell campagne sentiers" style={lueur(LUEUR[b.key])}>
        <section className="epreuve-revelation epreuve-maitre">
          {tete}
          <span className="sentiers-couronne grande">
            <Icon name="crown" />
          </span>
          <h1>{r.maitre}</h1>
          <p className="muted">Le titre se porte sous ton prénom : la salle le lit en touchant ton nom.</p>
          {maitres === MAITRES_DU_CABINET && <p className="campagne-record-battu">Et le Cabinet de curiosités, pour ta carte : il est à toi.</p>}
          {THEME_DES_MAITRES && maitres === THEME_DES_MAITRES.gagne!.maitres && (
            <p className="campagne-record-battu">{`Et le thème ${THEME_DES_MAITRES.nom}, qu’aucune boutique ne vend : il est à toi.`}</p>
          )}
        </section>
        <CeQueRapportentLesMaitres maitres={maitres} />
        {gains}
        {fin.porte ? (
          <p className="muted small centre">Il est sous ton prénom.</p>
        ) : (
          <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => void porter({ titre: cleDeMaitre(b.key) }, `Tu portes le titre « ${r.maitre} »`)}>
            Le porter
          </button>
        )}
        <button type="button" className="btn btn-block" onClick={onSentier}>
          Retour au sentier
        </button>
        {correction}
      </div>
    )
  }

  return (
    <div className="player-shell campagne sentiers" style={lueur(LUEUR[b.key])}>
      <header className="fin-tete epreuve-fin-tete">
        {tete}
        <h1>{e.rejeu ? 'Rejoué' : 'Palier validé'}</h1>
        {prochain && <p className="muted small">{`${prochain.portrait.nom} t’attend au palier ${prochain.portrait.palier}.`}</p>}
      </header>
      <BarreDEpreuve justes={e.justes} fausses={e.fausses} seuil={e.seuil} />
      {gains}
      {erreur && <p className="error">{erreur}</p>}
      {suivant && !e.rejeu && suivant <= PALIER_DU_MAITRE && (
        sansVie ? (
          <button type="button" className="btn btn-primary btn-big btn-block" onClick={onVies}>
            Racheter des vies
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onSuivant}>
            <Icon name="play" />
            {suivant === PALIER_DU_MAITRE ? 'Tenter le maître' : `Jouer le palier ${suivant}`}
          </button>
        )
      )}
      <button type="button" className="btn btn-block" onClick={onSentier}>
        Retour au sentier
      </button>
      {correction}
    </div>
  )
}

// ── Plus de vies ────────────────────────────────────────────────────────────

/**
 * Racheter des vies : elles vont dans la réserve, servent après celles du
 * jour et ne périment pas. Le prix est celui du serveur (`PRIX_D_UNE_VIE`) ;
 * sans assez de confettis, la page dit combien il en manque — et ce qu'on
 * peut faire en attendant.
 */
export function PlusDeVies({
  etat,
  onAchat,
  onSentier,
  onSerie,
}: {
  etat: EtatDesSentiers
  onAchat: (lu: EtatDesSentiers) => void
  onSentier: () => void
  onSerie: () => void
}) {
  const { vies } = etat
  const [nombre, setNombre] = useState(1)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const prix = nombre * vies.prix
  const solde = etat.confettis
  const manque = solde === undefined ? 0 : Math.max(0, prix - solde)
  const vide = vies.jour + vies.reserve === 0
  const acheter = async () => {
    if (busy || manque > 0) return
    setBusy(true)
    setErreur('')
    try {
      onAchat(await api.campagne.sentiers.acheterVies(nombre))
      setNombre(1)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="player-shell campagne sentiers">
      <Sortie vers="Retour" href={ADRESSE_DES_SENTIERS} onClick={onSentier} />
      <header className="vies-tete">
        <span className="sentiers-gros-coeur grand">
          <Coeur plein={!vide} />
        </span>
        <h1>{vide ? 'Plus de vies pour aujourd’hui' : 'Des vies en réserve'}</h1>
        <p className="muted">
          {vide
            ? `Tes ${vies.parJour} vies reviennent à minuit, ${dansCombien(vies.renouveleesLe - Date.now())}.`
            : `Il te reste ${libelleVies(vies)}. Celles du jour reviennent à minuit ; la réserve sert après elles, et ne périme pas.`}
        </p>
      </header>
      <section className="vies-achat">
        <div className="vies-ligne">
          <b>Racheter des vies</b>
          {solde !== undefined && <span className="muted small">{`Tu as 🎊 ${solde}`}</span>}
        </div>
        <div className="vies-ligne">
          <span className="vies-pas" role="group" aria-label="Combien de vies">
            <button type="button" className="vies-pas-btn" aria-label="Une vie de moins" onClick={() => setNombre(n => Math.max(1, n - 1))}>
              −
            </button>
            <output aria-live="polite">{nombre}</output>
            <button type="button" className="vies-pas-btn" aria-label="Une vie de plus" onClick={() => setNombre(n => Math.min(VIES_PAR_ACHAT_MAX, n + 1))}>
              +
            </button>
          </span>
          <span className="muted small">{`${nombre} vie${nombre > 1 ? 's' : ''} · ${prix} confettis`}</span>
        </div>
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || manque > 0 || undefined} onClick={() => void acheter()}>
          {manque > 0 ? `Il te manque ${manque} confetti${manque > 1 ? 's' : ''}` : 'Acheter'}
        </button>
        <span className="muted small">Une bonne réponse vaut un confetti, partout : en soirée, au quiz du jour, dans la campagne.</span>
      </section>
      <span className="label">En attendant</span>
      <div className="vies-autres">
        <button type="button" className="choix-ligne" onClick={onSentier}>
          <span className="gros-icone">
            <Icon name="rotate" />
          </span>
          <span className="gros-texte">
            <b>Rejouer un palier validé</b>
            <span className="gros-detail">Sans risquer de vie, pour les étoiles et les confettis.</span>
          </span>
        </button>
        <button type="button" className="choix-ligne" onClick={onSerie}>
          <span className="gros-icone">
            <Icon name="list" />
          </span>
          <span className="gros-texte">
            <b>Une série</b>
            <span className="gros-detail">Trois vies à elle, un confetti par bonne réponse.</span>
          </span>
        </button>
      </div>
    </div>
  )
}

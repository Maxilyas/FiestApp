import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError, api, motifDe } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { Shape } from '../components/Shape'
import { GesteDuBas, PieceTete, Sortie } from '../components/Pieces'
import { Vies } from '../components/Vies'
import { Balise } from '../components/Balise'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { LegendaireOuvert } from '../components/Ouverts'
import { SerieCorrigee } from '../components/SerieCorrigee'
import { APorter, CeQueTuGagnes, MissionsAccomplies, NouveauxTrophees, emojisAPorter, retenirLeNiveau, useNiveauRelu } from '../components/Gains'
import { GerbeDeJuste } from '../components/Gerbe'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { espacesFines, formatNumber } from '../format'
import { showToast } from '../state'
import { porterTheme } from '../themeJoueur'
import { porterGerbe } from '../gerbe'
import { answersSizeClass, questionSizeClass } from '../games/quiz/questionSize'
import { toucher } from '../toucher'
import { iconeDuSujet } from '../iconeDuSujet'
import { aPorterDesTrophees, partsDeLXp, tropheesTombes, xpDesTrophees } from '../../../shared/gains'
import { NOM_NIVEAU, SIGNALEMENT_MAX, VIES, type CorrectionDeCampagne, type Niveau } from '../../../shared/campagne'
import { couleurDePiste, pourcentDeChance } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { jokerDuLegendaire } from '../../../shared/jokers'
import type { PalierTombe } from '../../../shared/jour'
import {
  ACTES,
  ETAGES,
  GARDIEN,
  MARCHES_DES_ACTES,
  auGardien,
  chanceDeVaincre,
  chanceDuJoueurMoyen,
  chancesDuTrace,
  escalesAtteignables,
  gardienAuFeminin,
  leGardien,
  marcheDe,
  nomDuGardien,
  traceLePlusSur,
  type CarteDUnActe,
  type EscaleDeLaCarte,
  type PageDeLExpedition,
  type QuestionDExpedition,
  type ReponseDExpedition,
  type ThemeDEscale,
  type VueDeLExpedition,
} from '../../../shared/expedition'

// L'Expédition (`/expedition`, le brief : `retours/2026-10-17/expedition.md`,
// les maquettes validées par le propriétaire le 17 octobre 2026) : trois
// actes, chacun une carte tirée au sort, un gardien au bout de chacun, et
// l'un des trois à garder au bout du troisième. Le serveur tire, juge et
// replie (`shared/expedition.ts`) ; la page dessine la carte, et calcule
// dans le téléphone, sur les chances que le serveur a déjà montrées, le
// tracé le plus sûr et la chance d'arriver.
//
// Les écrans suivent les maquettes : le départ et ses trois gardiens (1), la
// carte d'un acte et son tracé (3), une escale (4), le gardien (7), le
// gardien vaincu (8), le choix du légendaire (9) ; puis l'écran des gains de
// tous les modes (`Gains.tsx`). Les jokers, les formes et les écus viennent
// aux étapes suivantes.

type Fin = { recompenses?: PalierTombe[]; legendaires?: string[] }

type Ecran =
  | { e: 'chargement' }
  | { e: 'anonyme' }
  /** En production, avant ses jokers : ses routes répondent 404 (`expeditionOuverte`). */
  | { e: 'bientot'; motif: string }
  | { e: 'erreur'; motif: string }
  /** Le départ : la prochaine expédition, ou celle qui l'attend (`vue`). */
  | { e: 'depart'; page: PageDeLExpedition }
  /**
   * En route : la carte, une escale ou le gardien, le choix au bout — l'écran
   * se lit de la vue. Une question répondue garde sa révélation (`reponse`)
   * jusqu'à « Suite » : la vue, elle, est déjà celle d'après.
   */
  | { e: 'route'; vue: VueDeLExpedition; question?: QuestionDExpedition; reponse?: ReponseDExpedition; choix?: number }
  | { e: 'vaincu'; vue: VueDeLExpedition; gardien: string }
  | { e: 'fin'; vue: VueDeLExpedition; tombe: Fin; correction: CorrectionDeCampagne[] | null }

/** « 62 % » : une chance telle que la page l'écrit, le signe collé par une espace fine insécable. */
const pourcents = (chance: number) => `${pourcentDeChance(chance)} %`

/** La marche d'une question, accordée à elle : « facile », « moyenne », « difficile ». */
const MARCHE: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }

/** Le nom d'une catégorie sous une escale : quatre-vingts pixels de large, deux lignes au plus. */
const COURT: Readonly<Record<string, string>> = {
  'Culture générale': 'Culture G.',
  'Cinéma & séries': 'Cinéma',
  'Arts & lettres': 'Arts',
  'Jeux & pop culture': 'Jeux & pop',
  'Autour de la fête': 'La fête',
}

/** Ce qu'une escale pose : « Histoire », « Histoire, Sport », « Les années 80 ». */
function nomDuTheme(theme: ThemeDEscale | undefined): string {
  if (!theme) return ''
  if ('sujet' in theme) return sujetParCle(theme.sujet)?.nom ?? 'Un thème pointu'
  return theme.categories.join(', ')
}

/** Ce qu'on lit sous l'escale, sur la carte. */
function etiquette(e: EscaleDeLaCarte, acte: number, gardiens: readonly { cle: string }[]): string {
  if (e.sorte === 'source') return 'Source'
  if (e.sorte === 'campement') return 'Campement'
  if (e.sorte === 'gardien') return nomDuGardien(gardiens[acte]?.cle ?? '')
  const t = e.theme
  if (!t) return 'Question'
  if ('sujet' in t) return sujetParCle(t.sujet)?.nom ?? 'Thème pointu'
  return t.categories.length > 1 ? `Mélange ×${t.categories.length}` : (COURT[t.categories[0]] ?? t.categories[0])
}

/** L'emblème d'une escale : sa catégorie, son sujet, le mélange ; la goutte d'une source, le feu d'un campement. */
function iconeDe(e: EscaleDeLaCarte): IconName {
  if (e.sorte === 'source') return 'source'
  if (e.sorte === 'campement') return 'campement'
  const t = e.theme
  if (!t) return 'help'
  if ('sujet' in t) {
    const s = sujetParCle(t.sujet)
    return s ? iconeDuSujet(s) : 'star'
  }
  return t.categories.length > 1 ? 'shuffle' : (EMBLEME[t.categories[0]] ?? 'help')
}

/** Ce qu'une escale cache, en une phrase : ce qu'on lit en la touchant, et au lecteur d'écran. */
function decrire(e: EscaleDeLaCarte, vue: Pick<VueDeLExpedition, 'acte' | 'gardiens' | 'moyen' | 'vies'>, carte: CarteDUnActe): string {
  const qui = vue.moyen ? 'pour un joueur moyen' : 'pour toi'
  const chance = e.chance ?? 0.5
  if (e.sorte === 'source') return `Une source : une question de ton carnet. Retrouvée, elle te rend une vie ; ratée, elle ne coûte rien · ${pourcents(chance)} ${qui}`
  if (e.sorte === 'campement') return 'Un campement : il te rend une vie, jusqu’à trois'
  if (e.sorte === 'gardien') {
    const g = vue.gardiens[vue.acte]?.cle ?? ''
    const m = MARCHES_DES_ACTES[Math.min(vue.acte, ACTES - 1)]
    const p = carte.chanceDuGardien ?? chanceDuJoueurMoyen(m.gardien)
    return `${nomDuGardien(g)}, gardien de l’acte : ${m.aTrouver} bonnes réponses à trouver, en questions ${MARCHE[m.gardien]}s · ${pourcents(chanceDeVaincre(p, m.aTrouver, vue.vies))} de le vaincre avec ${vue.vies} vie${vue.vies > 1 ? 's' : ''}`
  }
  const t = e.theme
  const quoi = !t ? 'Une question' : 'sujet' in t ? `Thème pointu : ${nomDuTheme(t)}` : t.categories.length > 1 ? `Mélange : ${nomDuTheme(t)}` : nomDuTheme(t)
  return `${quoi} · ${MARCHE[marcheDe(vue.acte, e)]} · ${pourcents(chance)} ${qui}`
}

/**
 * La page : elle lit l'expédition en route, sinon la prochaine, puis suit
 * chaque geste. Ce que la visite rapporte se compte en chemin — l'expérience
 * de chaque bonne réponse, ses confettis — pour l'écran des gains, comme en
 * série.
 */
export function ExpeditionApp() {
  const [ecran, setEcranBrut] = useState<Ecran>({ e: 'chargement' })
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [gains, setGains] = useState({ xp: 0, justes: 0 })
  const setEcran = (e: Ecran) => {
    setEcranBrut(e)
    setErreur('')
    window.scrollTo(0, 0)
  }

  /** L'expédition en route reprend où elle en est ; sans elle, le départ. */
  const montrer = (page: PageDeLExpedition) => setEcran(page.expedition ? { e: 'route', vue: page.expedition } : { e: 'depart', page })

  const relire = async () => {
    try {
      montrer(await api.expedition.page())
    } catch (e) {
      if (e instanceof UnauthorizedError) setEcran({ e: 'anonyme' })
      else if (e instanceof ApiError && e.statut === 404) setEcran({ e: 'bientot', motif: e.message })
      else setEcran({ e: 'erreur', motif: motifDe(e) })
    }
  }

  useEffect(() => {
    let vivant = true
    // Demandée d'emblée, à l'adresse même que la page servie a préchargée (`DEPART.expedition`).
    const page = api.expedition.page()
    page.catch(() => {})
    ;(async () => {
      try {
        const moi = await api.joueur.moiLeger()
        if (!vivant) return
        // Le thème de son profil habille la page, comme la campagne ; sa gerbe éclate à ses bonnes réponses.
        void porterTheme(moi.profile?.theme)
        porterGerbe(moi.profile?.gerbe)
        if (moi.profile) retenirLeNiveau(moi.profile.niveau)
      } catch {
        // Sans le profil léger, la page se joue quand même : le thème attendra.
      }
      try {
        const p = await page
        if (vivant) montrer(p)
      } catch (e) {
        if (!vivant) return
        if (e instanceof UnauthorizedError) setEcran({ e: 'anonyme' })
        else if (e instanceof ApiError && e.statut === 404) setEcran({ e: 'bientot', motif: e.message })
        else setEcran({ e: 'erreur', motif: motifDe(e) })
      }
    })()
    return () => {
      vivant = false
    }
  }, [])

  /** Un geste qui n'est pas passé : le refus se dit, et la page se relit — un autre onglet a peut-être joué. */
  const refuse = (e: unknown) => {
    const motif = motifDe(e)
    void relire().then(() => setErreur(motif))
  }

  const partir = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const vue = await api.expedition.partir()
      // Ce que la fin dira est celui de cette expédition : la précédente, jouée sur la même page, a eu sa fin.
      setGains({ xp: 0, justes: 0 })
      setEcran({ e: 'route', vue })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  const avancer = async (vue: VueDeLExpedition, vers: string) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const { expedition } = await api.expedition.avancer(vue.id, vue.rang + 1, vers)
      // Le campement ne pose rien : il rend une vie, et la carte le dit.
      if (vers !== GARDIEN && !expedition.question) {
        showToast({ kind: 'info', message: expedition.vies > vue.vies ? 'Le campement te rend une vie' : 'Tes trois vies sont là : le campement veille sur elles' })
      }
      setEcran({ e: 'route', vue: expedition })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  const repondre = async (vue: VueDeLExpedition, choix: number) => {
    const q = vue.question
    if (!q || busy) return
    setBusy(true)
    setErreur('')
    try {
      const reponse = await api.expedition.repondre(vue.id, q.index, choix)
      setGains(g => ({ xp: g.xp + reponse.xp, justes: g.justes + (reponse.juste ? 1 : 0) }))
      // La révélation reste à l'écran, sans le faire défiler : la bonne réponse est sous le doigt.
      setEcranBrut({ e: 'route', vue: reponse.expedition, question: q, reponse, choix })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  /** Après une révélation : le gardien qui tombe, la fin, ou la suite de la route. */
  const suite = (vue: VueDeLExpedition, r: ReponseDExpedition) => {
    if (r.vaincu) return setEcran({ e: 'vaincu', vue, gardien: r.vaincu })
    if (vue.issue === 'perdue') return setEcran({ e: 'fin', vue, tombe: { recompenses: r.recompenses, legendaires: r.legendaires }, correction: null })
    setEcran({ e: 'route', vue })
  }

  const garder = async (vue: VueDeLExpedition, cle: string) => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const apres = await api.expedition.garder(vue.id, vue.rang + 1, cle)
      setEcran({ e: 'fin', vue: apres.expedition, tombe: { recompenses: apres.recompenses, legendaires: apres.legendaires }, correction: null })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  const abandonner = async (vue: VueDeLExpedition) => {
    if (busy) return
    const oui = await confirmDialog({
      title: 'Abandonner l’expédition ?',
      message: 'Elle s’arrête là, sans légendaire. Tes bonnes réponses restent à toi, et tes erreurs reviendront à ton carnet.',
      confirmLabel: 'Abandonner',
      danger: true,
    })
    if (!oui) return
    setBusy(true)
    setErreur('')
    try {
      const apres = await api.expedition.abandonner(vue.id)
      setEcran({ e: 'fin', vue: apres.expedition, tombe: { recompenses: apres.recompenses, legendaires: apres.legendaires }, correction: null })
    } catch (e) {
      refuse(e)
    } finally {
      setBusy(false)
    }
  }

  /** « ← Partir » : l'expédition attend, rien ne se perd — on revient au départ, qui la reprend. */
  const quitter = () => void relire().then(() => showToast({ kind: 'info', message: 'Ton expédition t’attend : reprends-la quand tu veux' }))

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

  if (ecran.e === 'chargement') {
    return (
      <div className="player-shell expedition" aria-busy="true">
        <Sortie />
        <PieceTete piece="Seul" titre="L’Expédition" />
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  if (ecran.e === 'anonyme' || ecran.e === 'bientot' || ecran.e === 'erreur') {
    const retour = encodeURIComponent('/expedition')
    return (
      <div className="player-shell expedition">
        <Sortie />
        <PieceTete piece="Seul" titre="L’Expédition" />
        {ecran.e === 'anonyme' ? (
          <>
            <p>L’expédition se joue avec ton profil : les légendaires que tu y gardes y restent.</p>
            <a className="btn btn-primary btn-big btn-block" href={`/?next=${retour}`}>
              Me connecter
            </a>
            <a className="btn btn-block" href={`/?creer=1&next=${retour}`}>
              Créer mon profil
            </a>
          </>
        ) : (
          <p className={ecran.e === 'erreur' ? 'error' : undefined}>{espacesFines(ecran.motif)}</p>
        )}
      </div>
    )
  }

  if (ecran.e === 'depart') {
    return <Depart page={ecran.page} busy={busy} erreur={erreur} onPartir={() => void partir()} onReprendre={vue => setEcran({ e: 'route', vue })} />
  }

  if (ecran.e === 'vaincu') {
    const { vue, gardien } = ecran
    return <GardienVaincu vue={vue} gardien={gardien} onSuite={() => setEcran({ e: 'route', vue })} />
  }

  if (ecran.e === 'fin') {
    const voirCorrection = async () => {
      try {
        setEcranBrut({ ...ecran, correction: await api.campagne.correction(ecran.vue.id) })
      } catch (e) {
        setErreur(motifDe(e))
      }
    }
    return <FinDeLExpedition fin={ecran} gains={gains} erreur={erreur} onCorrection={() => void voirCorrection()} onAutre={() => void relire()} />
  }

  const { vue } = ecran
  if (ecran.reponse && ecran.question) {
    return (
      <Escale
        vue={vue}
        question={ecran.question}
        reponse={ecran.reponse}
        choix={ecran.choix ?? null}
        busy={busy}
        erreur={erreur}
        onRepondre={() => {}}
        onSuite={() => suite(vue, ecran.reponse!)}
        onPartir={quitter}
        onSignaler={() => void signaler(vue.id, ecran.question!.index)}
      />
    )
  }
  if (vue.issue === 'au-bout') return <ChoixDuLegendaire vue={vue} busy={busy} erreur={erreur} onGarder={cle => void garder(vue, cle)} />
  if (vue.question) {
    return (
      <Escale
        vue={vue}
        question={vue.question}
        reponse={null}
        choix={null}
        busy={busy}
        erreur={erreur}
        onRepondre={i => void repondre(vue, i)}
        onSuite={() => {}}
        onPartir={quitter}
        onSignaler={() => {}}
      />
    )
  }
  if (!vue.carte) return null
  return (
    <CarteDeLActe
      key={`${vue.id}:${vue.acte}`}
      vue={vue}
      carte={vue.carte}
      busy={busy}
      erreur={erreur}
      onAvancer={vers => void avancer(vue, vers)}
      onAbandonner={() => void abandonner(vue)}
      onPartir={quitter}
    />
  )
}

// ── Les pièces ──────────────────────────────────────────────────────────────

/** Un gardien en médaillon, à la taille du texte qui l'entoure — son dessin peint vient à la demande (`Dessin`). */
function Medaillon({ cle, verrouille, grand, className }: { cle: string; verrouille?: boolean; grand?: boolean; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <Dessin cle={cle} verrouille={verrouille} grand={grand} />
    </span>
  )
}

/** Le joker qu'un gardien deviendra : son nom, ce qu'il fait — les jokers se jouent à l'étape suivante du mode. */
function SonJoker({ cle }: { cle: string }) {
  const j = jokerDuLegendaire(cle)
  if (!j) return null
  return (
    <span className="exp-joker">
      <b>{`Son joker : ${j.nom}`}</b>
      {j.maudit && <span className="exp-maudit">maudit</span>}
      <span className="muted small">{espacesFines(j.effet)}</span>
    </span>
  )
}

/** La règle d'un gardien, acte par acte : combien de bonnes réponses, sur quelles questions. */
const regleDuGardien = (acte: number) => {
  const m = MARCHES_DES_ACTES[Math.min(acte, ACTES - 1)]
  return `${m.aTrouver === 4 ? 'Quatre' : 'Trois'} bonnes réponses, en questions ${MARCHE[m.gardien]}s`
}

/**
 * Le départ (la maquette 1) : les trois gardiens, l'acte de chacun, ce que
 * dure une expédition ; celle qui l'attend, à reprendre. Un gardien qu'il a
 * déjà le dit avant le départ : le garder au bout ne rapporterait que
 * l'expérience de ses réponses (le choix du 17 octobre 2026).
 */
function Depart({
  page,
  busy,
  erreur,
  onPartir,
  onReprendre,
}: {
  page: PageDeLExpedition
  busy: boolean
  erreur: string
  onPartir: () => void
  onReprendre: (vue: VueDeLExpedition) => void
}) {
  const vue = page.expedition
  const gardiens = vue ? vue.gardiens : page.prochaine.gardiens.map(cle => ({ cle, vaincu: false, ...(page.prochaine.aLui.includes(cle) && { aLui: true as const }) }))
  const siens = gardiens.filter(g => g.aLui)
  return (
    <div className="player-shell expedition">
      <Sortie />
      <header className="exp-tete">
        <h1>L’Expédition</h1>
        <p className="muted">{espacesFines('Trois actes, un gardien au bout de chacun. Va au bout : tu repars avec l’un des trois.')}</p>
      </header>
      <section className="card exp-gardiens" aria-labelledby="exp-gardiens-titre">
        <h2 className="label" id="exp-gardiens-titre">
          {vue ? `Ton expédition · carte n° ${formatNumber(vue.numero)}` : 'Ce qui t’attend'}
        </h2>
        <ol>
          {gardiens.map((g, acte) => (
            <li key={g.cle} className={'exp-gardien-ligne' + (g.vaincu ? ' exp-vaincu-ligne' : '')}>
              <Medaillon cle={g.cle} className="exp-medaillon" />
              <span className="exp-gardien-texte">
                <span className="label">{`Acte ${acte + 1}`}</span>
                <b className="exp-gardien-nom">{nomDuGardien(g.cle)}</b>
                <span className="muted small">{g.vaincu ? (gardienAuFeminin(g.cle) ? 'Vaincue' : 'Vaincu') : regleDuGardien(acte)}</span>
              </span>
              {g.aLui ? <span className="exp-pastille">déjà à toi</span> : vue && acte === vue.acte && <span className="exp-pastille exp-pastille-or">en route</span>}
            </li>
          ))}
        </ol>
        {siens.length > 0 && (
          <p className="muted small">
            {espacesFines(
              `${siens.length > 1 ? 'Tu as déjà ' + siens.map(g => leGardien(g.cle)).join(' et ') : `${nomDuGardien(siens[0].cle)} est déjà à toi`} : ${siens.length > 1 ? 'les garder' : 'le garder'} au bout ne te rapporterait que l’expérience de tes réponses.`,
            )}
          </p>
        )}
      </section>
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <div className="exp-depart-pied">
        {vue ? (
          <>
            <p className="muted small centre">{`Acte ${Math.min(vue.acte, ACTES - 1) + 1} · ${vue.vies} vie${vue.vies > 1 ? 's' : ''} sur ${VIES} · ${vue.justes} bonne${vue.justes > 1 ? 's' : ''} réponse${vue.justes > 1 ? 's' : ''}`}</p>
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => onReprendre(vue)}>
              <Icon name="play" />
              Reprendre
            </button>
          </>
        ) : (
          <>
            <p className="muted small centre">{espacesFines('Vingt à trente questions · « ← Partir » garde ta place')}</p>
            <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={onPartir}>
              <Icon name="flag" />
              Partir
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── La carte d'un acte ──────────────────────────────────────────────────────
//
// Six étages de quatre colonnes, deux campements, le gardien en haut ; on
// part d'en bas. Les colonnes se placent en pour cent de la largeur — la
// carte tient tout écran de téléphone —, les étages en pixels : elle défile,
// et la page la fait défiler jusqu'à l'escale où l'on est.

const COLONNES_X = [12.5, 37.5, 62.5, 87.5]
const Y_GARDIEN = 48
const Y_CAMPEMENT = 176
const Y_HAUT = 262
const PAS_D_ETAGE = 82
const yEtage = (f: number) => Y_HAUT + (ETAGES - 1 - f) * PAS_D_ETAGE
const Y_DEPART = yEtage(0) + 76
const HAUTEUR = Y_DEPART + 34
/** Le point de départ, en bas de la carte : pas une escale, d'où partent les liens du premier étage. */
const DEPART = '·'

function position(e: EscaleDeLaCarte): { x: number; y: number } {
  if (e.sorte === 'gardien') return { x: 50, y: Y_GARDIEN }
  if (e.sorte === 'campement') return { x: e.colonne === 0 ? 25 : 75, y: Y_CAMPEMENT }
  return { x: COLONNES_X[e.colonne] ?? 50, y: yEtage(e.etage) }
}

/** Les pas d'un chemin, deux à deux : « a→b ». */
const pas = (chemin: readonly string[]) => new Set(chemin.slice(1).map((id, i) => `${chemin[i]}→${id}`))

/**
 * La carte d'un acte (la maquette 3) : les escales et leurs liens, la chance
 * sur chacune en piste, et le tracé — le plus sûr d'abord ; une escale
 * touchée le redessine par elle, en gardant le début choisi. Seul le pas
 * suivant engage : le serveur ne vérifie que lui, vers une escale reliée.
 */
function CarteDeLActe({
  vue,
  carte,
  busy,
  erreur,
  onAvancer,
  onAbandonner,
  onPartir,
}: {
  vue: VueDeLExpedition
  carte: CarteDUnActe
  busy: boolean
  erreur: string
  onAvancer: (vers: string) => void
  onAbandonner: () => void
  onPartir: () => void
}) {
  const parId = useMemo(() => new Map(carte.escales.map(e => [e.id, e])), [carte])
  const atteignables = useMemo(() => escalesAtteignables(carte, vue.ici), [carte, vue.ici])
  const lePlusSur = useMemo(() => traceLePlusSur(carte, vue.ici, vue.vies, vue.acte), [carte, vue.ici, vue.vies, vue.acte])
  // Le tracé qu'il a dessiné, qui part d'où il est ; null : le plus sûr. Après un pas, il garde la suite du sien.
  const [sien, setSien] = useState<{ depuis: string | null; trace: string[] } | null>(null)
  const trace = sien && sien.depuis === vue.ici ? sien.trace : sien && sien.trace[0] === vue.ici ? sien.trace.slice(1) : lePlusSur
  const [vu, setVu] = useState<string | null>(null)
  const [avis, setAvis] = useState('')
  const gardien = vue.gardiens[vue.acte]?.cle ?? ''
  const ici = vue.ici ? parId.get(vue.ici) : undefined
  const auCampement = ici?.sorte === 'campement'
  const prochaine = auCampement ? GARDIEN : trace[0]
  const m = MARCHES_DES_ACTES[Math.min(vue.acte, ACTES - 1)]
  const pGardien = carte.chanceDuGardien ?? chanceDuJoueurMoyen(m.gardien)
  const chances = trace.length > 0 ? chancesDuTrace(carte, trace, vue.vies, vue.acte) : null
  const estLePlusSur = trace.length === lePlusSur.length && trace.every((id, i) => id === lePlusSur[i])

  // L'escale où il est, sinon le départ, à l'écran : la carte monte d'acte en acte, et le bas défile hors de vue.
  useEffect(() => {
    document.getElementById(vue.ici ? `escale-${vue.ici}` : 'exp-depart')?.scrollIntoView({ block: 'center' })
  }, [vue.ici])

  const toucherEscale = (id: string) => {
    setVu(id)
    setAvis('')
    if (trace.includes(id) || id === GARDIEN) return
    if (!atteignables.has(id)) return setAvis(vue.trace.includes(id) ? 'Tu y es déjà passé.' : 'Cette escale n’est plus sur ta route.')
    // Le plus long début de son tracé d'où l'escale s'atteint encore, puis le plus sûr par elle.
    for (let k = trace.length; k >= 0; k--) {
      const t = traceLePlusSur(carte, vue.ici, vue.vies, vue.acte, { debut: trace.slice(0, k), par: id })
      if (t.length > 0) return setSien({ depuis: vue.ici, trace: t })
    }
  }

  const faits = pas([DEPART, ...vue.trace])
  const prevus = pas([vue.ici ?? DEPART, ...trace])
  const liens: { de: { x: number; y: number }; a: { x: number; y: number }; cle: string }[] = []
  for (const id of carte.depart) liens.push({ de: { x: 50, y: Y_DEPART }, a: position(parId.get(id)!), cle: `${DEPART}→${id}` })
  for (const e of carte.escales) for (const id of e.suite) if (parId.has(id)) liens.push({ de: position(e), a: position(parId.get(id)!), cle: `${e.id}→${id}` })
  const vueDe = vu ? parId.get(vu) : prochaine ? parId.get(prochaine) : undefined
  const s = trace.length > 1 ? 's' : ''

  return (
    <div className="player-shell expedition exp-carte-page">
      <div className="exp-barre">
        <Sortie vers="Partir" href="/expedition" onClick={onPartir} />
        <Vies restantes={vue.vies} />
      </div>
      <header className="exp-tete">
        <h1>{`Acte ${vue.acte + 1} · Vers ${leGardien(gardien)}`}</h1>
        <p className="muted small">
          {`Carte n° ${formatNumber(vue.numero)}. `}
          {vue.moyen ? 'Les chances sont celles d’un joueur moyen, le temps que tes réponses disent les tiennes.' : 'Sur chaque escale, ta chance de trouver.'}
        </p>
      </header>

      <div className="exp-carte" style={{ height: HAUTEUR }}>
        <svg className="exp-liens" viewBox={`0 0 100 ${HAUTEUR}`} preserveAspectRatio="none" aria-hidden="true">
          {liens.map(l => (
            <line
              key={l.cle}
              className={faits.has(l.cle) ? 'lien-fait' : prevus.has(l.cle) ? 'lien-prevu' : undefined}
              x1={l.de.x}
              y1={l.de.y}
              x2={l.a.x}
              y2={l.a.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span id="exp-dit-passee" hidden>
          Tu y es déjà passé
        </span>
        <span id="exp-depart" className={'exp-depart' + (vue.ici === null ? ' exp-ici' : '')} style={{ top: Y_DEPART }}>
          <Icon name="flag" />
          Départ
        </span>
        {carte.escales.map(e => {
          const { x, y } = position(e)
          const estIci = e.id === vue.ici
          const passee = vue.trace.includes(e.id) && !estIci
          const tracee = trace.includes(e.id) || (auCampement && e.id === GARDIEN)
          const loin = !estIci && !passee && !atteignables.has(e.id)
          const classes = ['exp-escale', `exp-${e.sorte}`]
          if (estIci) classes.push('exp-ici')
          if (passee) classes.push('exp-passee')
          if (tracee) classes.push('exp-tracee')
          if (loin) classes.push('exp-loin')
          if (vue.permises.includes(e.id)) classes.push('exp-ouverte')
          const chance = e.sorte === 'question' || e.sorte === 'source' ? e.chance : e.sorte === 'gardien' ? chanceDeVaincre(pGardien, m.aTrouver, vue.vies) : undefined
          return (
            <button
              key={e.id}
              id={`escale-${e.id}`}
              type="button"
              className={classes.join(' ')}
              style={{ left: `${x}%`, top: y }}
              // Son nom ne bouge pas : « sur ton tracé » passe par aria-pressed, « tu es ici » par aria-current,
              // « déjà passée » par la description — dans le nom, l'état se lisait deux fois (`design.test.ts`).
              aria-label={decrire(e, vue, carte)}
              aria-pressed={tracee}
              aria-current={estIci ? 'location' : undefined}
              aria-describedby={passee ? 'exp-dit-passee' : undefined}
              onClick={() => toucherEscale(e.id)}
            >
              {e.sorte === 'gardien' ? <Medaillon cle={gardien} className="exp-medaillon" /> : <Icon name={passee ? 'check' : iconeDe(e)} />}
              {chance !== undefined && !passee && !loin && <Balise couleur={couleurDePiste(chance)} />}
              <span className="exp-etiquette" aria-hidden="true">
                {etiquette(e, vue.acte, vue.gardiens)}
              </span>
            </button>
          )
        })}
      </div>

      <section className="exp-panneau" aria-label="Ton tracé">
        {auCampement ? (
          <>
            <p className="exp-panneau-titre">{espacesFines(`${nomDuGardien(gardien)} t’attend : ${regleDuGardien(vue.acte).toLowerCase()}. Chaque erreur te coûte une vie.`)}</p>
            <p className="exp-chances">
              <Balise couleur={couleurDePiste(chanceDeVaincre(pGardien, m.aTrouver, vue.vies))} />
              <b>{pourcents(chanceDeVaincre(pGardien, m.aTrouver, vue.vies))}</b>
              {` de ${gardienAuFeminin(gardien) ? 'la' : 'le'} vaincre avec ${vue.vies} vie${vue.vies > 1 ? 's' : ''}`}
            </p>
          </>
        ) : (
          <>
            <div className="exp-panneau-tete">
              <span className="label">{`${estLePlusSur ? 'Le tracé le plus sûr' : 'Ton tracé'} · ${trace.length} escale${s}`}</span>
              {!estLePlusSur && (
                <button
                  type="button"
                  className="link-inline small"
                  onClick={() => {
                    setSien(null)
                    setVu(null)
                    setAvis('')
                  }}
                >
                  Le plus sûr
                </button>
              )}
            </div>
            <p className="exp-vu" role="status">
              {espacesFines(avis || (vueDe ? decrire(vueDe, vue, carte) : 'Touche les escales pour tracer ta route.'))}
            </p>
            {chances && (
              <p className="exp-chances">
                <Balise couleur={couleurDePiste(chances.arriver)} />
                <span>
                  <b>{pourcents(chances.arriver)}</b>
                  {` d’arriver ${auGardien(gardien)} · `}
                  <b>{pourcents(chances.vaincre)}</b>
                  {` de ${gardienAuFeminin(gardien) ? 'la' : 'le'} vaincre`}
                </span>
              </p>
            )}
          </>
        )}
        {erreur && (
          <p className="error" role="alert">
            {espacesFines(erreur)}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          aria-disabled={busy || !prochaine || undefined}
          onClick={() => prochaine && onAvancer(prochaine)}
        >
          {auCampement ? `Affronter ${leGardien(gardien)}` : prochaine ? `Avancer : ${etiquette(parId.get(prochaine)!, vue.acte, vue.gardiens)}` : 'Touche une escale'}
          <Icon name="chevron-right" />
        </button>
      </section>

      <ul className="exp-legende" aria-label="La légende de la carte">
        <li>
          <Icon name="source" />
          {espacesFines('Source : une question de ton carnet, qui rend une vie')}
        </li>
        <li>
          <Icon name="campement" />
          Campement : une vie de plus
        </li>
        <li>
          <Icon name="shuffle" />
          {espacesFines('Mélange : l’une de ses catégories')}
        </li>
        <li>
          <span className="exp-legende-pistes" aria-hidden="true">
            <Balise couleur="verte" />
            <Balise couleur="bleue" />
            <Balise couleur="rouge" />
            <Balise couleur="noire" />
          </span>
          Ta chance : verte, bleue, rouge, noire
        </li>
      </ul>
      <GesteDuBas icone="x" danger busy={busy} onClick={onAbandonner}>
        Abandonner l’expédition
      </GesteDuBas>
    </div>
  )
}

// ── Une escale, le gardien ──────────────────────────────────────────────────

/**
 * Une question de l'expédition (les maquettes 4 et 7) : celle d'une escale —
 * sa catégorie, son mélange ou son thème pointu —, d'une source, ou du
 * gardien, son médaillon et ses crans au-dessus. Puis sa révélation : la
 * bonne réponse, l'anecdote, et la suite.
 */
function Escale({
  vue,
  question: q,
  reponse: r,
  choix,
  busy,
  erreur,
  onRepondre,
  onSuite,
  onPartir,
  onSignaler,
}: {
  vue: VueDeLExpedition
  question: QuestionDExpedition
  reponse: ReponseDExpedition | null
  choix: number | null
  busy: boolean
  erreur: string
  onRepondre: (i: number) => void
  onSuite: () => void
  onPartir: () => void
  onSignaler: () => void
}) {
  // Révélée, la vue est déjà celle d'après : l'escale et l'acte se lisent de la question.
  const acte = Math.min(r ? vue.acte - (r.vaincu ? 1 : 0) : vue.acte, ACTES - 1)
  const gardien = vue.gardiens[acte]?.cle ?? ''
  const auGardien_ = q.escale === GARDIEN
  const carte = vue.carte
  const escale = !auGardien_ && carte ? carte.escales.find(e => e.id === q.escale) : undefined
  const source = escale?.sorte === 'source'
  const m = MARCHES_DES_ACTES[acte]
  // Les crans du gardien : ceux qu'il a trouvés — à la révélation, la réponse comprise.
  const trouvees = auGardien_ ? (r ? (r.vaincu ? m.aTrouver : (r.expedition.gardien?.trouvees ?? m.aTrouver)) : (vue.gardien?.trouvees ?? 0)) : 0
  const theme = escale?.theme && ('sujet' in escale.theme || escale.theme.categories.length > 1) ? nomDuTheme(escale.theme) : null
  const finie = r !== null && vue.issue === 'perdue'
  return (
    <div className={'player-shell expedition' + (auGardien_ ? ' exp-au-gardien' : '')}>
      <div className="quiz-player epreuve">
        <div className="exp-barre">
          {!finie && <Sortie vers="Partir" href="/expedition" onClick={onPartir} />}
          <Vies restantes={vue.vies} />
        </div>
        {auGardien_ ? (
          <div className="exp-gardien-tete">
            <Medaillon cle={gardien} className="exp-medaillon exp-medaillon-gardien" />
            <span className="exp-gardien-texte">
              <span className="label">{`Gardien · acte ${acte + 1}`}</span>
              <b className="exp-gardien-nom">{nomDuGardien(gardien)}</b>
              <span className="muted small">{espacesFines(`${regleDuGardien(acte)} : chaque erreur te coûte une vie.`)}</span>
            </span>
          </div>
        ) : (
          <p className="exp-ou label">{`Acte ${acte + 1} · escale ${Math.max(1, vue.trace.length)} · vers ${leGardien(gardien)}`}</p>
        )}
        {auGardien_ && (
          <div className="exp-crans" role="img" aria-label={`${trouvees} bonne${trouvees > 1 ? 's' : ''} réponse${trouvees > 1 ? 's' : ''} sur ${m.aTrouver}`}>
            {Array.from({ length: m.aTrouver }, (_, i) => (
              <i key={i} className={i < trouvees ? 'cran-trouve' : undefined} />
            ))}
            <b>{`${trouvees} sur ${m.aTrouver}`}</b>
          </div>
        )}
        {source && <p className="exp-source-regle small">{espacesFines('Une source : une question de ton carnet. Retrouvée, elle te rend une vie ; ratée, elle ne te coûte rien.')}</p>}
        <span className="label quiz-categorie">{[theme, q.categorie, NOM_NIVEAU[q.niveau]].filter(Boolean).join(' · ')}</span>
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
          <Revelation question={q} reponse={r} choix={choix} source={source} finie={finie} gardien={gardien} onSuite={onSuite} onSignaler={onSignaler} />
        )}
        {erreur && (
          <p className="error" role="alert">
            {espacesFines(erreur)}
          </p>
        )}
      </div>
    </div>
  )
}

/** La révélation d'une question : juste ou non, ce que la réponse a coûté, la bonne réponse, l'anecdote, et la suite. */
function Revelation({
  question: q,
  reponse: r,
  choix,
  source,
  finie,
  gardien,
  onSuite,
  onSignaler,
}: {
  question: QuestionDExpedition
  reponse: ReponseDExpedition
  choix: number | null
  source: boolean
  finie: boolean
  gardien: string
  onSuite: () => void
  onSignaler: () => void
}) {
  const vies = r.expedition.vies
  const rate = finie ? 'Raté… c’était ta dernière vie' : source ? 'Raté… la source ne coûte rien : ton carnet la garde' : vies === 1 ? 'Raté… plus qu’une vie' : `Raté… ${vies} vies`
  const juste = source && r.juste ? 'Retrouvée ! Une vie de plus' : 'Bien joué !'
  const geste: ReactNode = r.vaincu ? `${nomDuGardien(r.vaincu)} est ${gardienAuFeminin(r.vaincu) ? 'vaincue' : 'vaincu'}` : finie ? 'Voir la fin' : r.expedition.question ? 'Question suivante' : 'Retour à la carte'
  return (
    <>
      <div className={'card result-banner ' + (r.juste ? 'result-ok' : 'result-ko')} role="status">
        {r.juste ? (
          <>
            <span className="big">🎊 +1</span>
            <p>{`${juste}${r.xp > 0 ? ` +${r.xp} XP` : ''}`}</p>
            <GerbeDeJuste />
          </>
        ) : (
          <>
            <span className="result-icon">
              <Icon name="x-circle" />
            </span>
            <p>{espacesFines(rate)}</p>
          </>
        )}
        <p className="muted">
          {choix === null ? 'Sans réponse. ' : ''}La bonne réponse : <Shape index={r.bonne} inline />
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
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={onSuite}>
        {geste}
        <Icon name="chevron-right" />
      </button>
      {gardien && r.vaincu === undefined && q.escale === GARDIEN && !finie && r.expedition.gardien && (
        <p className="muted small centre">{`Encore ${r.expedition.gardien.aTrouver - r.expedition.gardien.trouvees} pour vaincre ${leGardien(gardien)}`}</p>
      )}
      <button type="button" className="lien-signaler link-inline small" onClick={onSignaler}>
        Signaler une erreur dans cette question
      </button>
    </>
  )
}

/**
 * Le gardien vaincu (la maquette 8) : l'acte fini, son médaillon en grand,
 * les gardiens vaincus, et son joker — puis l'acte suivant, ou le choix au
 * bout du troisième.
 */
function GardienVaincu({ vue, gardien, onSuite }: { vue: VueDeLExpedition; gardien: string; onSuite: () => void }) {
  const acte = vue.gardiens.findIndex(g => g.cle === gardien)
  const vaincus = vue.gardiens.filter(g => g.vaincu).length
  return (
    <div className="player-shell expedition exp-vaincu">
      <span className="exp-pastille exp-pastille-or">{`Acte ${acte + 1} terminé`}</span>
      <Medaillon cle={gardien} grand className="exp-medaillon exp-medaillon-grand" />
      <h1>{`${nomDuGardien(gardien)} est ${gardienAuFeminin(gardien) ? 'vaincue' : 'vaincu'}`}</h1>
      <p className="muted">
        {espacesFines(
          vue.issue === 'au-bout' ? 'Tes trois gardiens sont vaincus : garde l’un d’eux, il est à toi.' : 'À la fin de l’acte 3, tu garderas l’un de tes trois gardiens : celui-là, il est à toi.',
        )}
      </p>
      <div className="exp-vaincus" role="img" aria-label={`${vaincus} gardien${vaincus > 1 ? 's' : ''} vaincu${vaincus > 1 ? 's' : ''} sur ${ACTES}`}>
        <span className="small">
          Gardiens vaincus <b>{`${vaincus} sur ${ACTES}`}</b>
        </span>
        <span className="exp-vaincus-medaillons">
          {vue.gardiens.map(g => (
            <Medaillon key={g.cle} cle={g.cle} verrouille={!g.vaincu} className="exp-medaillon exp-medaillon-petit" />
          ))}
        </span>
      </div>
      <p className="card exp-joker-carte">
        <SonJoker cle={gardien} />
      </p>
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={onSuite}>
        {vue.issue === 'au-bout' ? 'Choisir ton légendaire' : `Vers l’acte ${Math.min(vue.acte, ACTES - 1) + 1}`}
        <Icon name="chevron-right" />
      </button>
    </div>
  )
}

/**
 * Le choix au bout de l'acte 3 (la maquette 9, sans l'Ascension, qui viendra
 * plus tard) : les trois gardiens vaincus, un à garder — définitif. Celui
 * qu'il a déjà le dit : le garder ne rapporte rien de plus.
 */
function ChoixDuLegendaire({ vue, busy, erreur, onGarder }: { vue: VueDeLExpedition; busy: boolean; erreur: string; onGarder: (cle: string) => void }) {
  const [choisi, setChoisi] = useState(() => (vue.gardiens.find(g => !g.aLui) ?? vue.gardiens[0]).cle)
  const g = vue.gardiens.find(x => x.cle === choisi)
  return (
    <div className="player-shell expedition exp-choix">
      <header className="exp-tete">
        <span className="label exp-surtitre">Fin de l’expédition</span>
        <h1>Trois gardiens vaincus</h1>
        <p className="muted">{espacesFines('Un seul part avec toi. Les deux autres retournent sur la carte : tu les recroiseras.')}</p>
      </header>
      <div className="exp-choix-liste" role="radiogroup" aria-label="Le gardien que tu gardes">
        {vue.gardiens.map(x => (
          <button
            key={x.cle}
            type="button"
            role="radio"
            aria-checked={x.cle === choisi}
            className={'exp-choix-ligne' + (x.cle === choisi ? ' exp-choisi' : '')}
            onClick={() => setChoisi(x.cle)}
          >
            <Medaillon cle={x.cle} className="exp-medaillon" />
            <span className="exp-gardien-texte">
              <b className="exp-gardien-nom">
                {nomDuGardien(x.cle)}
                {x.aLui && <span className="exp-pastille">déjà à toi</span>}
              </b>
              <SonJoker cle={x.cle} />
            </span>
          </button>
        ))}
      </div>
      {g?.aLui && <p className="muted small">{espacesFines(`${nomDuGardien(g.cle)} est déjà à toi : le garder ne te rapporte rien de plus.`)}</p>}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-big btn-block" aria-disabled={busy || undefined} onClick={() => onGarder(choisi)}>
        {`Garder ${leGardien(choisi)}`}
      </button>
    </div>
  )
}

// ── La fin ──────────────────────────────────────────────────────────────────

/**
 * La fin d'une expédition — gardée, perdue, abandonnée — par l'écran des
 * gains de tous les modes (l'écran A) : le légendaire gardé d'abord, puis ce
 * que la visite a rapporté, les trophées, ce qu'ils ouvrent ; le corrigé, et
 * une autre expédition. Exportée pour `gains.test.ts`, qui la rend.
 */
export function FinDeLExpedition({
  fin,
  gains,
  erreur,
  onCorrection,
  onAutre,
}: {
  fin: Extract<Ecran, { e: 'fin' }>
  gains: { xp: number; justes: number }
  erreur: string
  onCorrection: () => void
  onAutre: () => void
}) {
  const { vue, tombe } = fin
  const recompenses = tombe.recompenses ?? []
  const cles = recompenses.map(x => x.key)
  const niveau = useNiveauRelu(gains.xp > 0 || cles.length > 0)
  const gardee = vue.issue === 'legendaire' && vue.garde ? vue.garde : null
  const nouveau = gardee !== null && (tombe.legendaires ?? []).includes(gardee)
  const acte = Math.min(vue.acte, ACTES - 1) + 1
  const vaincus = vue.gardiens.filter(g => g.vaincu).length
  const s = vue.justes > 1 ? 's' : ''
  return (
    <div className="player-shell expedition">
      <Sortie />
      <header className="fin-tete exp-fin-tete">
        <span className="label">{`L’Expédition · carte n° ${formatNumber(vue.numero)}`}</span>
        <h1>{gardee ? (nouveau ? `${nomDuGardien(gardee)} est à toi` : 'Expédition accomplie') : vue.issue === 'abandonnee' ? 'Expédition abandonnée' : 'L’expédition s’arrête là'}</h1>
        <p className="muted small">
          {gardee
            ? `Trois gardiens vaincus, ${vue.justes} bonne${s} réponse${s}.`
            : `Acte ${acte} · ${vaincus} gardien${vaincus > 1 ? 's' : ''} vaincu${vaincus > 1 ? 's' : ''} · ${vue.justes} bonne${s} réponse${s}.`}
        </p>
        {gardee && !nouveau && <p className="muted small">{espacesFines(`${nomDuGardien(gardee)} était déjà à toi : ton expédition te rapporte l’expérience de tes réponses.`)}</p>}
      </header>
      {(tombe.legendaires ?? []).map(cle => (
        <LegendaireOuvert key={cle} cle={cle} dejaPorte={false} />
      ))}
      <CeQueTuGagnes
        parts={partsDeLXp([
          { nom: 'tes bonnes réponses', xp: gains.xp },
          { nom: 'tes trophées', xp: xpDesTrophees(cles) },
        ])}
        confettis={gains.justes}
        niveau={niveau}
      />
      <NouveauxTrophees trophees={tropheesTombes(recompenses)} lien />
      <APorter objets={[...aPorterDesTrophees(cles), ...emojisAPorter(niveau)]} />
      {/* Ses missions du jour, si l'expédition en a fait. */}
      <MissionsAccomplies key={vue.id} profil />
      {!gardee && (
        <p className="muted small carnet-rappel">
          {'Les questions ratées reviendront à ton '}
          <a className="link-inline" href="/campagne#carnet">
            carnet
          </a>
          .
        </p>
      )}
      {erreur && <p className="error">{espacesFines(erreur)}</p>}
      <div className="fin-actions">
        <button type="button" className="btn btn-primary btn-big btn-block" onClick={onAutre}>
          <Icon name="flag" />
          Une autre expédition
        </button>
        {fin.correction ? (
          <SerieCorrigee correction={fin.correction} />
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={onCorrection}>
            Mes réponses
          </button>
        )}
      </div>
    </div>
  )
}

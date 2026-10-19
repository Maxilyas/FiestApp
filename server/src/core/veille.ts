import {
  FENETRE_D_UNE_PANNE_MS,
  RETABLI_APRES_MS,
  enPanne,
  modeDeLaSource,
  type BilanDUneSource,
  type ModeSurveille,
  type PanneDUnMode,
} from '../../../shared/pannes'

// La veille des modes de jeu (le souhait du propriétaire du 19 octobre 2026 :
// « une notification sur mon téléphone quand une erreur tombe — importante,
// c'est-à-dire l'indisponibilité d'un mode de jeu »). Ce jour-là, le quiz du
// jour et les défis ne s'ouvraient plus en production, et seul un joueur l'a
// dit. Le relevé de l'heure comptait chaque erreur ; rien ne disait qu'un
// mode entier était tombé.
//
// Chaque route d'API (`server.ts`) et chaque message du temps réel
// (`ecouter`, `messagePourEcran`) dit ici s'il a réussi ou échoué — un 5xx,
// une exception. Une source qui échoue au moins trois fois en dix minutes, et
// plus souvent qu'elle ne réussit (`enPanne`), fait tomber son mode ; il est
// rétabli quand plus rien n'y a échoué depuis un quart d'heure et que chaque
// source tombée a réussi depuis son dernier échec — la page du jour qui
// s'ouvre ne dit rien des réponses qui échouaient. Les refus — 4xx, un mot
// de passe faux, une page en maintenance (423) — ne sont pas des pannes : le
// serveur y a répondu.
//
// En mémoire, comme le relevé : rien ici ne fait attendre une réponse. Ce que
// la veille décide part par `prevenir` (`server.ts` : les téléphones de
// l'administrateur, `core/alertes.ts`), qui garde aussi les pannes dans la
// base : un redémarrage — la mise en ligne de la réparation — les hérite, et
// dira leur retour.

const MINUTE_MS = 60_000
const MINUTES_DE_LA_FENETRE = FENETRE_D_UNE_PANNE_MS / MINUTE_MS
/** Les sources suivies, au plus : plus que les routes du serveur — la mémoire reste bornée quoi qu'on lui envoie. */
const SOURCES_SUIVIES = 200
/**
 * Le temps de laisser tomber les autres : une base muette fait tomber tous
 * les modes en quelques secondes, et une seule notification les dit tous.
 */
export const GROUPEMENT_MS = 20_000
/** La veille revoit ses pannes chaque minute : un retour se dit sans attendre qu'un échec la réveille. */
const EXAMEN_MS = 60_000

interface Seau {
  minute: number
  reussies: number
  echecs: number
}

/** Ce que la veille dit à qui l'écoute : des modes tombés, ou rétablis. */
export type EvenementDeLaVeille = { sorte: 'panne'; pannes: PanneDUnMode[] } | { sorte: 'retour'; modes: ModeSurveille[] }

interface PanneSuivie extends PanneDUnMode {
  /** Les sources qui ont échoué depuis qu'il est tombé, leur dernier échec et leur dernière réussite. */
  tombees: Map<string, { dernierEchec: number; derniereReussite: number | null }>
  /** Sa notification est partie — ou partie avant le redémarrage qui l'a héritée. */
  dite: boolean
}

/** Ce qu'un serveur règle de sa veille : les tests avancent son heure, et n'attendent pas vingt secondes qu'elle parle. */
export interface ReglagesDeLaVeille {
  maintenant?: () => number
  groupementMs?: number
}

export class Veille {
  private sources = new Map<string, Seau[]>()
  private suivies = new Map<ModeSurveille, PanneSuivie>()
  private aDire: ReturnType<typeof setTimeout> | null = null
  private minuterie: ReturnType<typeof setInterval> | null = null
  private ecouteur: ((e: EvenementDeLaVeille) => void) | null = null
  private now: () => number
  private groupementMs: number

  constructor(private readonly reglages: ReglagesDeLaVeille = {}) {
    this.now = reglages.maintenant ?? Date.now
    this.groupementMs = reglages.groupementMs ?? GROUPEMENT_MS
  }

  /** Les réglages d'un serveur, posés après `remettreAZero` ; ceux qu'il ne dit pas restent ceux de la veille. */
  regler({ maintenant, groupementMs }: ReglagesDeLaVeille) {
    if (maintenant) this.now = maintenant
    if (groupementMs !== undefined) this.groupementMs = groupementMs
  }

  /** Une route — sous son modèle, `GET /api/jour` — ou un message du temps réel — `socket host:launch` — a réussi, ou échoué. */
  noter(source: string, reussie: boolean) {
    const mode = modeDeLaSource(source)
    if (!mode) return
    const t = this.now()
    const minute = Math.floor(t / MINUTE_MS)
    let seaux = this.sources.get(source)
    if (!seaux) {
      if (this.sources.size >= SOURCES_SUIVIES) return
      this.sources.set(source, (seaux = []))
    }
    let seau = seaux[seaux.length - 1]
    if (!seau || seau.minute !== minute) seaux.push((seau = { minute, reussies: 0, echecs: 0 }))
    while (seaux[0].minute <= minute - MINUTES_DE_LA_FENETRE) seaux.shift()
    const suivie = this.suivies.get(mode)
    const tombee = suivie?.tombees.get(source)
    if (reussie) {
      seau.reussies++
      if (tombee) tombee.derniereReussite = t
      return
    }
    seau.echecs++
    if (suivie) {
      suivie.echecs++
      suivie.dernierEchec = t
      suivie.tombees.set(source, { dernierEchec: t, derniereReussite: tombee?.derniereReussite ?? null })
      return
    }
    this.examiner()
  }

  /** Les modes en panne à l'instant, le plus ancien d'abord. */
  pannes(): PanneDUnMode[] {
    return [...this.suivies.values()].sort((a, b) => a.depuis - b.depuis).map(publique)
  }

  /**
   * Les pannes d'avant un redémarrage, que la base a gardées : déjà dites. Leur
   * dernier échec est ce démarrage — la mise en ligne de la réparation,
   * peut-être : elles se rétablissent comme les autres, un quart d'heure sans
   * échec, et la source qui les avait fait tomber réussie depuis.
   */
  heriter(pannes: readonly PanneDUnMode[]) {
    const t = this.now()
    for (const p of pannes) {
      if (this.suivies.has(p.mode)) continue
      const dernierEchec = Math.max(p.dernierEchec, t)
      this.suivies.set(p.mode, { ...publique(p), dernierEchec, tombees: new Map([[p.source, { dernierEchec, derniereReussite: null }]]), dite: true })
    }
  }

  /** Les sources sur la fenêtre, et ce qui tombe ou se rétablit. Chaque échec d'un mode debout la relance, la minuterie chaque minute. */
  examiner() {
    const t = this.now()
    const minute = Math.floor(t / MINUTE_MS)
    const parMode = new Map<ModeSurveille, { echecs: number; enPanne: BilanDUneSource[] }>()
    for (const [source, seaux] of this.sources) {
      const dans = seaux.filter(s => s.minute > minute - MINUTES_DE_LA_FENETRE)
      if (dans.length === 0) {
        this.sources.delete(source)
        continue
      }
      const bilan: BilanDUneSource = { source, reussies: 0, echecs: 0 }
      for (const s of dans) {
        bilan.reussies += s.reussies
        bilan.echecs += s.echecs
      }
      const mode = modeDeLaSource(source)!
      const m = parMode.get(mode) ?? { echecs: 0, enPanne: [] }
      m.echecs += bilan.echecs
      if (enPanne(bilan)) m.enPanne.push(bilan)
      parMode.set(mode, m)
    }

    let nouvelle = false
    for (const [mode, m] of parMode) {
      if (m.enPanne.length === 0 || this.suivies.has(mode)) continue
      const pire = m.enPanne.sort((a, b) => b.echecs - a.echecs)[0]
      // Ses sources en panne doivent réussir de nouveau : celles qui ont seulement trébuché, non.
      const tombees = new Map(m.enPanne.map(b => [b.source, { dernierEchec: t, derniereReussite: null }] as const))
      this.suivies.set(mode, { mode, depuis: t, echecs: m.echecs, dernierEchec: t, source: pire.source, tombees, dite: false })
      nouvelle = true
    }
    if (nouvelle) this.annoncer()

    const retablis = [...this.suivies.values()].filter(
      p => t - p.dernierEchec >= RETABLI_APRES_MS && [...p.tombees.values()].every(s => s.derniereReussite !== null && s.derniereReussite > s.dernierEchec),
    )
    for (const p of retablis) this.suivies.delete(p.mode)
    // Un retour se dit à qui a lu la panne ; celle qu'on n'avait pas encore dite s'oublie.
    const dits = retablis.filter(p => p.dite).map(p => p.mode)
    if (dits.length > 0) this.dire({ sorte: 'retour', modes: dits })
  }

  /** Les pannes tombées ensemble se disent ensemble, après le temps de laisser tomber les autres (`GROUPEMENT_MS`). */
  private annoncer() {
    if (this.aDire) return
    this.aDire = setTimeout(() => {
      this.aDire = null
      const nouvelles = [...this.suivies.values()].filter(p => !p.dite)
      for (const p of nouvelles) p.dite = true
      if (nouvelles.length > 0) this.dire({ sorte: 'panne', pannes: nouvelles.map(publique) })
    }, this.groupementMs)
    this.aDire.unref?.()
  }

  /** Celui qui écoute ne fait jamais tomber la veille : il a son propre filet. */
  private dire(e: EvenementDeLaVeille) {
    try {
      this.ecouteur?.(e)
    } catch (erreur) {
      console.error('[veille] la panne n’a pas pu se dire :', erreur)
    }
  }

  /** Ce serveur l'écoute, et elle se revoit chaque minute, jusqu'à son arrêt. */
  demarrer(ecouteur: (e: EvenementDeLaVeille) => void) {
    this.ecouteur = ecouteur
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = setInterval(() => this.examiner(), EXAMEN_MS)
    this.minuterie.unref()
  }

  /** Plus rien ne se dit : le serveur s'arrête. Seulement s'il l'écoute encore — un serveur d'après, dans le même processus, a pu la prendre. */
  arreter(ecouteur: (e: EvenementDeLaVeille) => void) {
    if (this.ecouteur !== ecouteur) return
    this.ecouteur = null
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = null
    if (this.aDire) clearTimeout(this.aDire)
    this.aDire = null
  }

  /** Un serveur neuf part de zéro, comme son relevé : celui d'avant, dans le même processus — les tests —, n'a rien à lui léguer, pas même ses réglages. */
  remettreAZero() {
    this.sources.clear()
    this.suivies.clear()
    if (this.aDire) clearTimeout(this.aDire)
    this.aDire = null
    this.now = this.reglages.maintenant ?? Date.now
    this.groupementMs = this.reglages.groupementMs ?? GROUPEMENT_MS
  }
}

const publique = ({ mode, depuis, echecs, dernierEchec, source }: PanneDUnMode): PanneDUnMode => ({ mode, depuis, echecs, dernierEchec, source })

/** La veille du processus, que les routes et le temps réel nourrissent, comme le relevé de l'heure. */
export const veille = new Veille()

import type { Express } from 'express'
import { wrap } from './core/http'
import { enTranches } from './core/tourniquet'
import type { MemoireDuQg } from './core/memoireDuQg'
import type { ProfileStore } from './auth/profiles'
import type { JourStore } from './core/jour'
import type { CampagneStore } from './core/campagne'
import { jourAvant, jourDe } from '../../shared/jour'
import { minuitDe, modeDeLaSerie, type SoireeDesParticipations } from '../../shared/qg'
import {
  COHORTES_MONTREES,
  JOURS_DE_LA_MEMOIRE,
  JOURS_DU_GRAPHE_DES_ACTIFS,
  SEGMENTS,
  VERSION_DE_LA_MEMOIRE,
  calculDeLaPage,
  invitesSansProfil,
  joursDeLaMemoire,
  lundiDe,
  minuitDuJour,
  presencesDAujourdhui,
  segmentsDesProfils,
  tracesDesTrenteJours,
  type ChiffresDUnJour,
  type ComptesDesSegments,
  type JournauxDeLaMemoire,
  type PageDesJoueurs,
  type Presence,
  type ProfilDeLAudience,
  type SegmentDuQg,
} from '../../shared/qgJoueurs'

export interface AudienceDeps {
  memoire: MemoireDuQg
  profiles: Pick<ProfileStore, 'activiteEntre' | 'profilsPourLAudience' | 'nomsPourLeQg'>
  jour: Pick<JourStore, 'partiesEntre'>
  campagne: Pick<CampagneStore, 'seriesEntre'>
  /** Les soirées commencées entre deux instants : celles de l'historique, et celles pas encore closes (`lesSoireesDepuis`, `qg.ts`). */
  soireesEntre: (debut: number, fin: number) => Promise<SoireeDesParticipations[]>
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
}

/** Ce que le rattrapage lit d'un coup : un mois de journaux, comme la vue d'ensemble — jamais un an d'un bloc. */
const JOURS_D_UNE_PLAGE = 30

/** Les jours de `de` à `a`, compris, le plus ancien d'abord. */
function joursDe(de: string, a: string): string[] {
  const jours: string[] = []
  for (let j = de; j <= a; j = jourAvant(j, -1)) jours.push(j)
  return jours
}

/**
 * L'audience du QG (`/admin#joueurs`, le lot 6 du QG 2, le 4 novembre 2026) :
 * la mémoire tenue à jour, et ce que la page des joueurs et celle des annonces
 * en lisent.
 *
 * Un jour fini s'écrit une fois — sa feuille de présence et ses chiffres
 * (`qg_presences`, `qg_jours`) — au premier passage d'après minuit, et ceux
 * qui manquent se rattrapent du même geste, un mois de journaux à la fois, un
 * jour par tranche (`joursDeLaMemoire`) : la première fois, aussi loin que
 * les journaux remontent, un an au plus. Ce qui est écrit se lit une fois par
 * jour et se garde jusqu'à minuit ; seul aujourd'hui se relit des journaux,
 * par leurs index. Rien ne tourne à minuit : le rattrapage attend qu'on ouvre
 * la page, comme la clôture des jours du quiz du jour attend sa première
 * demande.
 *
 * Les profils seulement : un invité sans profil se compte par soirée, et ne
 * se nomme nulle part ; seuls les profils d'un segment que la page montre se
 * nomment (`nomsPourLeQg`).
 */
export function audienceDuQg(deps: AudienceDeps) {
  const lirePlage = async (debut: number, fin: number): Promise<JournauxDeLaMemoire> => {
    const [parties, series, activite, soirees] = await Promise.all([
      deps.jour.partiesEntre(debut, fin),
      deps.campagne.seriesEntre(debut, fin),
      deps.profiles.activiteEntre(debut, fin),
      deps.soireesEntre(debut, fin),
    ])
    return {
      solo: [...parties.map(p => ({ qui: p.qui, quand: p.quand, mode: 'jour' as const })), ...series.map(s => ({ qui: s.qui, quand: s.quand, mode: modeDeLaSerie(s.mode) }))],
      soireesDesProfils: activite.soirees,
      soirees,
      inscriptions: activite.inscriptions,
      achats: activite.achats,
    }
  }

  // ── Ce qui se garde jusqu'à minuit ───────────────────────────────────────

  /** Les feuilles des jours finis que la page lit — soixante jours, et les huit semaines des cohortes. */
  let feuilles: { aujourdhui: string; parJour: Map<string, Presence[]> } | null = null
  /** Les chiffres des quatre-vingt-neuf jours finis, et le premier jour que la mémoire sait. */
  let longue: { aujourdhui: string; jours: Map<string, ChiffresDUnJour>; premier: string | null } | null = null
  /**
   * Les profils nés avant aujourd'hui : relus une fois par jour, ou quand une
   * suspension change (`oublierLesProfils`) — ceux d'aujourd'hui se relisent à
   * chaque fois, par l'index de leur date.
   */
  let anciens: { aujourdhui: string; profils: ProfilDeLAudience[] } | null = null

  /** Le premier jour des feuilles gardées : trente jours et ceux d'avant pour comparer, et les semaines des cohortes. */
  const debutDesFeuilles = (aujourdhui: string) => {
    const comparer = jourAvant(aujourdhui, 59)
    const cohortes = jourAvant(lundiDe(aujourdhui), 7 * COHORTES_MONTREES)
    return comparer < cohortes ? comparer : cohortes
  }

  const lesFeuilles = async (aujourdhui: string): Promise<Map<string, Presence[]>> => {
    if (feuilles?.aujourdhui === aujourdhui) return feuilles.parJour
    const parJour = new Map<string, Presence[]>()
    for (const p of await deps.memoire.presencesEntre(debutDesFeuilles(aujourdhui), aujourdhui)) {
      let du = parJour.get(p.jour)
      if (!du) parJour.set(p.jour, (du = []))
      du.push(p)
    }
    feuilles = { aujourdhui, parJour }
    return parJour
  }

  const laMemoireLongue = async (aujourdhui: string) => {
    if (longue?.aujourdhui === aujourdhui) return longue
    const lue = await deps.memoire.joursDepuis(jourAvant(aujourdhui, JOURS_DU_GRAPHE_DES_ACTIFS - 1))
    longue = { aujourdhui, ...lue }
    return longue
  }

  const lesAnciensProfils = async (aujourdhui: string, minuit: number) => {
    if (anciens?.aujourdhui === aujourdhui) return anciens.profils
    const profils = await deps.profiles.profilsPourLAudience(0, minuit)
    anciens = { aujourdhui, profils }
    return profils
  }

  // ── Le rattrapage ────────────────────────────────────────────────────────

  /**
   * Écrit les jours finis qui manquent, jusqu'à hier : depuis le dernier
   * écrit, ou — la première fois, ou sous une version neuve des dérivations,
   * qui efface tout d'abord — depuis le premier instant des journaux, un an au
   * plus. Les feuilles des vingt-neuf jours d'avant se relisent pour la
   * semaine et le mois du premier jour ; ensuite, chaque mois écrit passe les
   * siennes au suivant.
   */
  const rattraper = (aujourdhui: string) =>
    deps.memoire.pendantUnRattrapage(async () => {
      const hier = jourAvant(aujourdhui)
      const plusAncien = jourAvant(aujourdhui, JOURS_DE_LA_MEMOIRE)
      let dernier = await deps.memoire.dernierJour()
      if (dernier && dernier.version !== VERSION_DE_LA_MEMOIRE) {
        await deps.memoire.effacer()
        dernier = null
      }
      let premier: string
      if (dernier) premier = jourAvant(dernier.jour, -1)
      else {
        const instant = await deps.memoire.premierInstantDesJournaux()
        if (instant === null) return
        premier = jourDe(instant)
      }
      if (premier < plusAncien) premier = plusAncien
      if (premier > hier) return
      const avant = new Map<string, string[]>()
      if (dernier) {
        for (const p of await deps.memoire.presencesEntre(jourAvant(premier, 29), premier)) {
          let du = avant.get(p.jour)
          if (!du) avant.set(p.jour, (du = []))
          du.push(p.qui)
        }
      }
      for (let debut = premier; debut <= hier; debut = jourAvant(debut, -JOURS_D_UNE_PLAGE)) {
        const finDeLaPlage = jourAvant(debut, -(JOURS_D_UNE_PLAGE - 1)) < hier ? jourAvant(debut, -(JOURS_D_UNE_PLAGE - 1)) : hier
        const minuits = joursDe(debut, finDeLaPlage).map(minuitDuJour)
        const fin = minuitDuJour(jourAvant(finDeLaPlage, -1))
        const journaux = await lirePlage(minuits[0], fin)
        const ecrits = await enTranches(joursDeLaMemoire(journaux, minuits, fin, avant))
        await deps.memoire.ecrire(ecrits, plusAncien)
        for (const j of ecrits) avant.set(j.jour, j.presences.map(p => p.qui))
        for (const j of [...avant.keys()]) if (j < jourAvant(finDeLaPlage, 28)) avant.delete(j)
      }
      // Ce qui était gardé ne dit plus tout : la page relit ce qu'elle vient d'écrire.
      feuilles = null
      longue = null
    })

  let ajour: string | null = null
  let enRoute: { pour: string; promesse: Promise<void> } | null = null

  /**
   * La mémoire à jour jusqu'à hier : une fois par jour de Paris, partagée par
   * qui l'attend. Un rattrapage qui échoue se réessaie à la demande suivante ;
   * celui d'hier encore en route s'attend, puis aujourd'hui part.
   */
  const aJour = async (): Promise<void> => {
    const aujourdhui = jourDe(deps.maintenant())
    while (ajour !== aujourdhui) {
      if (enRoute && enRoute.pour !== aujourdhui) {
        await enRoute.promesse.catch(() => {})
        continue
      }
      if (!enRoute) {
        const promesse = rattraper(aujourdhui).then(() => {
          ajour = aujourdhui
        })
        const route = { pour: aujourdhui, promesse }
        enRoute = route
        promesse
          .finally(() => {
            if (enRoute === route) enRoute = null
          })
          .catch(() => {})
      }
      await enRoute.promesse
    }
  }

  // ── Ce que les pages lisent ──────────────────────────────────────────────

  /** Aujourd'hui : la mémoire à jour, ce qu'elle garde, aujourd'hui relu de ses journaux, et tous les profils. */
  const lEtat = async () => {
    await aJour()
    const maintenant = deps.maintenant()
    const aujourdhui = jourDe(maintenant)
    const minuit = minuitDe(maintenant)
    const [parJour, memoire, profilsAnciens, duJour, profilsDuJour] = await Promise.all([
      lesFeuilles(aujourdhui),
      laMemoireLongue(aujourdhui),
      lesAnciensProfils(aujourdhui, minuit),
      lirePlage(minuit, maintenant + 1),
      deps.profiles.profilsPourLAudience(minuit, Number.MAX_SAFE_INTEGER),
    ])
    const presences = new Map(parJour)
    presences.set(aujourdhui, presencesDAujourdhui(duJour, minuit, maintenant))
    return { maintenant, aujourdhui, presences, memoire, profils: [...profilsAnciens, ...profilsDuJour], duJour }
  }

  const lesSegments = async () => {
    const e = await lEtat()
    return { maintenant: e.maintenant, parSegment: segmentsDesProfils(e.profils, tracesDesTrenteJours(e.presences, e.aujourdhui), e.aujourdhui) }
  }

  return {
    aJour,

    /** La page des joueurs (`GET /api/admin/joueurs`) : le calcul en tranches, puis les prénoms de ceux qu'elle montre. */
    async page(): Promise<PageDesJoueurs> {
      const e = await lEtat()
      const calcul = await enTranches(
        calculDeLaPage({
          maintenant: e.maintenant,
          presences: e.presences,
          jours: e.memoire.jours,
          depuis: e.memoire.premier,
          profils: e.profils,
          invitesDuJour: e.duJour.soirees.reduce((t, s) => t + invitesSansProfil(s), 0),
        }),
      )
      const noms = await deps.profiles.nomsPourLeQg(calcul.segments.flatMap(s => s.montres.map(m => m.id)))
      return {
        ...calcul,
        // Un profil supprimé entre la lecture et les prénoms ne se montre pas : sans nom, il ne serait qu'un identifiant.
        segments: calcul.segments.map(s => ({ ...s, montres: s.montres.flatMap(m => (noms.has(m.id) ? [{ ...m, ...noms.get(m.id)! }] : [])) })),
      }
    },

    /** Combien chaque segment compte de profils : ce que la page des annonces propose (`GET /api/admin/joueurs/segments`). */
    async comptes(): Promise<ComptesDesSegments> {
      const { maintenant, parSegment } = await lesSegments()
      return { maintenant, comptes: Object.fromEntries(SEGMENTS.map(s => [s, parSegment[s].length])) as Record<SegmentDuQg, number> }
    },

    /** Les profils d'un segment à l'instant, tous : les destinataires d'une annonce qui lui est écrite. */
    async profilsDuSegment(segment: SegmentDuQg): Promise<string[]> {
      return (await lesSegments()).parSegment[segment].map(m => m.id)
    },

    /** Un profil supprimé (`supprimerProfil`, `server.ts`) : il quitte ce qui est gardé, sa feuille de présence avec lui. */
    async oublierProfil(profileId: string): Promise<void> {
      for (const lignes of feuilles?.parJour.values() ?? []) {
        const i = lignes.findIndex(p => p.qui === profileId)
        if (i >= 0) lignes.splice(i, 1)
      }
      if (anciens) anciens.profils = anciens.profils.filter(p => p.id !== profileId)
      await deps.memoire.oublierProfil(profileId)
    },

    /** Une suspension, une réactivation : les segments les relisent — un suspendu n'en est d'aucun. */
    oublierLesProfils(): void {
      anciens = null
    },
  }
}

export type AudienceDuQg = ReturnType<typeof audienceDuQg>

/**
 * Les routes de l'audience, sous `/api/admin` — gardées d'un bloc (`api.ts`),
 * elles entrent d'elles-mêmes dans `admin-seulement.test.ts`. Elles lisent, et
 * ne changent rien qu'on noterait au journal : la mémoire qu'elles écrivent en
 * passant n'est que le reflet des journaux.
 */
export function mountJoueurs(app: Express, audience: AudienceDuQg) {
  app.get(
    '/api/admin/joueurs',
    wrap(async (_req, res) => {
      res.json(await audience.page())
    }),
  )
  app.get(
    '/api/admin/joueurs/segments',
    wrap(async (_req, res) => {
      res.json(await audience.comptes())
    }),
  )
}

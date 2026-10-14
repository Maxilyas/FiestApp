import type { ProfileStore } from './auth/profiles'
import type { CampagneStore } from './core/campagne'
import type { JourStore } from './core/jour'
import { JOURS_DU_QG, minuitsDeParis } from '../../shared/qg'
import {
  circulationDes,
  eclatsEtLegendaires,
  fluxDeConfettis,
  meilleuresVentes,
  mouvementsAvant,
  mouvementsBoutABout,
  type CirculationDesConfettis,
  type MouvementsDeConfettis,
  type PageDeLEconomie,
  type VenteDUnArticle,
} from '../../shared/qgEconomie'

/** Les ventes et les légendaires portés : gardés dix minutes, comme les trente jours de la campagne. */
const GARDE_MS = 10 * 60_000

export interface DepsDeLEconomie {
  profiles: Pick<ProfileStore, 'economieDepuis' | 'partsDesSoldes' | 'ventesDepuis' | 'legendairesPortes'>
  jour: Pick<JourStore, 'confettisDepuis' | 'justesDeTous'>
  campagne: Pick<CampagneStore, 'economieDepuis' | 'confettisDeTous'>
  /** Les profils qui ont joué depuis un instant — quiz du jour, campagne, soirées —, comme les « Profils actifs » de la vue d'ensemble. */
  actifsDepuis: (minuits: readonly number[]) => Promise<ReadonlySet<string>>
  maintenant: () => number
}

/** Ce qu'une période dit des confettis : leurs mouvements, et les Éclats tombés. */
interface Lus {
  mouvements: MouvementsDeConfettis
  eclats: { quand: number; soiree: string }[]
}

/**
 * La page de l'économie du QG (`/admin#economie`, le choix du 13 octobre
 * 2026) : les confettis gagnés et dépensés, source par source et jour par
 * jour, ceux qui circulent, les meilleures ventes, les Éclats et les
 * légendaires. Rien ne s'écrit : chaque source se relit à ses règles
 * (`shared/qgEconomie.ts`).
 */
export function economieDuQg(deps: DepsDeLEconomie) {
  const lire = async (depuis: number): Promise<Lus> => {
    const [profils, jour, campagne] = await Promise.all([
      deps.profiles.economieDepuis(depuis),
      deps.jour.confettisDepuis(depuis),
      deps.campagne.economieDepuis(depuis),
    ])
    return {
      mouvements: {
        gagnes: { campagne: campagne.justes, jour, soirees: profils.soirees, ligues: campagne.ligues, etoiles: campagne.etoiles, dons: profils.dons },
        achats: profils.achats,
      },
      eclats: profils.eclats,
    }
  }

  // Les jours finis ne bougent plus : lus une fois par jour, gardés jusqu'à
  // minuit, et seul aujourd'hui se relit — comme la vue d'ensemble
  // (`lesTrenteJours`). Trente jours de réponses de campagne relus à chaque
  // ouverture coûtaient au quota de Turso ce que la page ne montrait pas de
  // neuf. Une lecture qui échoue ne se garde pas.
  let gardes: { minuit: number; depuis: number; lus: Promise<Lus> } | null = null
  const lesTrenteJours = async (minuits: readonly number[]): Promise<Lus> => {
    const minuit = minuits[minuits.length - 1]
    const depuis = minuits[0]
    let garde = gardes
    if (!garde || garde.minuit !== minuit || garde.depuis !== depuis) {
      const lus = lire(depuis).then(l => ({ mouvements: mouvementsAvant(l.mouvements, minuit), eclats: l.eclats.filter(e => e.quand < minuit) }))
      garde = gardes = { minuit, depuis, lus }
      lus.catch(() => {
        if (gardes?.lus === lus) gardes = null
      })
    }
    const [jusquHier, aujourdhui] = await Promise.all([garde.lus, lire(minuit)])
    return { mouvements: mouvementsBoutABout(jusquHier.mouvements, aujourdhui.mouvements), eclats: [...jusquHier.eclats, ...aujourdhui.eclats] }
  }

  // Tous les soldes, une fois par jour : relus en entier — chaque soirée de
  // chaque profil, toutes ses séries, toutes ses épreuves —, ils coûteraient
  // à chaque ouverture ce qu'une journée ne change guère. La page dit l'heure
  // de la lecture.
  let circulation: { minuit: number; lue: Promise<CirculationDesConfettis> } | null = null
  const laCirculation = (minuits: readonly number[], maintenant: number): Promise<CirculationDesConfettis> => {
    const minuit = minuits[minuits.length - 1]
    let lue = circulation?.minuit === minuit ? circulation.lue : null
    if (!lue) {
      const lecture = Promise.all([deps.profiles.partsDesSoldes(), deps.jour.justesDeTous(), deps.campagne.confettisDeTous(), deps.actifsDepuis(minuits)]).then(
        ([parts, duJour, deCampagne, actifs]) =>
          circulationDes(
            [...parts].map(([id, p]) => ({
              solde: p.soirees + p.dons + (duJour.get(id) ?? 0) + (deCampagne.get(id) ?? 0) - p.depenses,
              actif: !p.suspendu && actifs.has(id),
            })),
            maintenant,
          ),
      )
      circulation = { minuit, lue: (lue = lecture) }
      lecture.catch(() => {
        if (circulation?.lue === lecture) circulation = null
      })
    }
    return lue
  }

  let rayons: { jusqua: number; lus: Promise<{ ventes: VenteDUnArticle[]; portes: Map<string, number> }> } | null = null
  const lesRayons = (depuis: number, maintenant: number) => {
    let garde = rayons
    if (!garde || maintenant >= garde.jusqua) {
      const lus = Promise.all([deps.profiles.ventesDepuis(depuis), deps.profiles.legendairesPortes()]).then(([ventes, portes]) => ({
        ventes: meilleuresVentes(ventes),
        portes,
      }))
      garde = rayons = { jusqua: maintenant + GARDE_MS, lus }
      lus.catch(() => {
        if (rayons?.lus === lus) rayons = null
      })
    }
    return garde.lus
  }

  return {
    async page(): Promise<PageDeLEconomie> {
      const maintenant = deps.maintenant()
      const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
      const [lus, circule, etalage] = await Promise.all([
        lesTrenteJours(minuits),
        // La circulation à part : une base qui se tait la tait, sans la page.
        laCirculation(minuits, maintenant).catch((e: unknown) => {
          console.warn('[économie] soldes non relus :', e instanceof Error ? e.message : e)
          return null
        }),
        lesRayons(minuits[0], maintenant),
      ])
      return {
        maintenant,
        ...fluxDeConfettis(lus.mouvements, minuits, maintenant),
        circulation: circule,
        ventes: etalage.ventes,
        ...eclatsEtLegendaires(
          lus.eclats.filter(e => e.quand <= maintenant),
          etalage.portes,
        ),
      }
    },
  }
}

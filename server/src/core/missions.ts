import type { LigneDeMission, ProfileStore } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import type { JourStore } from './jour'
import { jourAvant, jourDe, minutesAvantMinuit } from '../../../shared/jour'
import { minuitDe } from '../../../shared/qg'
import { rangDuCoffre, semaineValide, type CoffreEnAttente, type CoffreOuvert } from '../../../shared/coffre'
import {
  activiteDesJours,
  AUCUNE_ACTIVITE,
  avancement,
  joursDeLaSemaine,
  lundiDe,
  MISSIONS_PAR_JOUR,
  RANG_DES_TROIS,
  tirerLesMissions,
  vueDeLaMission,
  type ActiviteDuJour,
  type ContexteDuTirage,
  type MissionsDuJour,
  type SorteDeMission,
} from '../../../shared/missions'

// Les missions du jour et le coffre de la semaine, côté serveur
// (`shared/missions.ts`, `shared/coffre.ts`) : lire ce que ses journaux disent
// de ses derniers jours — quiz du jour, campagne, soirées —, tirer ses
// missions à sa première visite du jour, retenir ce qui est fait, ouvrir ses
// coffres. Ce module connaît les trois magasins ; chacun ne connaît que ses
// tables.

export interface DepsDesMissions {
  profiles: Pick<
    ProfileStore,
    'lignesDesMissions' | 'tirerLesMissions' | 'accomplirDesMissions' | 'joursAuxTrois' | 'semainesDesCoffres' | 'coffreDe' | 'ouvrirUnCoffre' | 'soireesDepuis'
  >
  jour: Pick<JourStore, 'activiteDepuis'>
  campagne: Pick<CampagneStore, 'activiteDepuis' | 'aRevoirDe'>
  /** L'horloge du quiz du jour, que les tests font passer minuit et lundi. */
  maintenant: () => number
  /** Le hasard du coffre, dans [0, 1[ : les tests le fixent. */
  hasard?: () => number
}

/** Le premier instant d'un jour de Paris (« 2026-10-14 ») : midi en temps universel tombe toujours dans le même jour de Paris. */
function minuitDuJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  return minuitDe(Date.UTC(a, m - 1, j, 12))
}

/** Les découvertes qu'une journée a jouées : le tirage vise d'abord les autres. */
function decouvertesDe(a: ActiviteDuJour): SorteDeMission[] {
  return [
    ...(a.meilleureSerie > 0 ? (['serie'] as const) : []),
    ...(a.duels > 0 ? (['duel'] as const) : []),
    ...(a.epreuves > 0 ? (['sentier'] as const) : []),
    ...(a.etapes > 0 ? (['parcours'] as const) : []),
    ...(a.defis > 0 ? (['defi'] as const) : []),
    ...(a.revues > 0 ? (['revision'] as const) : []),
  ]
}

/**
 * Ce qui est fait et pas encore retenu, jour par jour : chaque mission à sa
 * cible, puis la ligne des trois quand ses trois missions le sont. Une
 * mission d'aujourd'hui se date à l'instant ; celle d'un jour passé — jouée
 * à 23 h 50, lue le lendemain — au dernier instant de son jour : le QG la
 * range à son jour.
 */
export function faitesARetenir(
  lignes: readonly LigneDeMission[],
  activites: ReadonlyMap<string, ActiviteDuJour>,
  aujourdhui: string,
  maintenant: number,
): { jour: string; rang: number; quand: number }[] {
  const parJour = new Map<string, LigneDeMission[]>()
  for (const l of lignes) parJour.set(l.jour, [...(parJour.get(l.jour) ?? []), l])
  const faites: { jour: string; rang: number; quand: number }[] = []
  for (const [jour, siennes] of parJour) {
    const quand = jour === aujourdhui ? maintenant : minuitDuJour(jourAvant(jour, -1)) - 1
    const activite = activites.get(jour) ?? AUCUNE_ACTIVITE
    const missions = siennes.filter(l => l.rang < MISSIONS_PAR_JOUR)
    let toutes = missions.length === MISSIONS_PAR_JOUR
    for (const l of missions) {
      if (l.faiteLe !== null) continue
      if (l.mission && avancement(l.mission, activite) >= l.mission.cible) faites.push({ jour, rang: l.rang, quand })
      else toutes = false
    }
    const trois = siennes.find(l => l.rang === RANG_DES_TROIS)
    if (toutes && trois && trois.faiteLe === null) faites.push({ jour, rang: RANG_DES_TROIS, quand })
  }
  return faites
}

/** Les coffres qui attendent : chaque semaine passée qui a des tampons et pas encore de coffre ouvert, la plus ancienne d'abord. */
export function coffresEnAttente(joursAuxTrois: readonly string[], ouverts: ReadonlySet<string>): CoffreEnAttente[] {
  const parSemaine = new Map<string, number>()
  for (const j of joursAuxTrois) parSemaine.set(lundiDe(j), (parSemaine.get(lundiDe(j)) ?? 0) + 1)
  return [...parSemaine]
    .filter(([semaine]) => !ouverts.has(semaine))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([semaine, tampons]) => {
      const rang = rangDuCoffre(tampons)
      return rang ? [{ semaine, tampons, rang }] : []
    })
}

export class Missions {
  /** Une lecture à la fois par profil : deux onglets qui tirent et retiennent ensemble ne se croisent pas. */
  private enCours = new Map<string, Promise<unknown>>()

  constructor(private deps: DepsDesMissions) {}

  private unALaFois<T>(profileId: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.enCours.get(profileId) ?? Promise.resolve()
    const suite = avant.then(travail)
    const fin = suite.catch(() => {})
    this.enCours.set(profileId, fin)
    void fin.then(() => {
      if (this.enCours.get(profileId) === fin) this.enCours.delete(profileId)
    })
    return suite
  }

  /**
   * Ses missions du jour : tirées à sa première visite du jour, jugées sur
   * ses journaux, ce qui vient d'être fait retenu — et dit (`nouvelles`) :
   * l'accueil, leur feuille et la fin de chaque partie la lisent. La semaine
   * passée se juge encore jusqu'à lundi : une mission faite à 23 h 50
   * dimanche, lue lundi, remplit son coffre.
   */
  duJour(profileId: string): Promise<MissionsDuJour> {
    return this.unALaFois(profileId, async () => {
      const { profiles, jour, campagne } = this.deps
      const maintenant = this.deps.maintenant()
      const aujourdhui = jourDe(maintenant)
      const lundi = lundiDe(aujourdhui)
      const depuis = jourAvant(lundi, 7)
      const debut = minuitDuJour(depuis)
      const [lignes, duJour, deCampagne, soirees] = await Promise.all([
        profiles.lignesDesMissions(profileId, depuis),
        jour.activiteDepuis(profileId, depuis),
        campagne.activiteDepuis(profileId, debut),
        profiles.soireesDepuis(profileId, debut),
      ])
      const activites = activiteDesJours({ ...duJour, ...deCampagne, soirees })
      let siennes = lignes
      if (!lignes.some(l => l.jour === aujourdhui)) {
        const contexte = await this.contexte(profileId, aujourdhui, lundi, activites, lignes, deCampagne.series)
        const tirees = await profiles.tirerLesMissions(profileId, aujourdhui, tirerLesMissions(`${profileId}|${aujourdhui}`, contexte), maintenant)
        siennes = [...lignes, ...tirees]
      }
      const retenues = await profiles.accomplirDesMissions(profileId, faitesARetenir(siennes, activites, aujourdhui, maintenant))
      const faites = new Set([...siennes.filter(l => l.faiteLe !== null), ...retenues].map(l => `${l.jour}|${l.rang}`))
      const estFaite = (j: string, rang: number) => faites.has(`${j}|${rang}`)
      const [joursAuxTrois, ouverts] = await Promise.all([profiles.joursAuxTrois(profileId, lundi), profiles.semainesDesCoffres(profileId)])
      const activite = activites.get(aujourdhui) ?? AUCUNE_ACTIVITE
      return {
        jour: aujourdhui,
        missions: siennes
          .filter(l => l.jour === aujourdhui && l.rang < MISSIONS_PAR_JOUR && l.mission)
          .map(l => vueDeLaMission(l.rang, l.mission!, activite, estFaite(aujourdhui, l.rang))),
        trois: estFaite(aujourdhui, RANG_DES_TROIS),
        nouvelles: retenues.filter(r => r.jour === aujourdhui).map(r => r.rang),
        semaine: { lundi, tampons: joursDeLaSemaine(lundi).map(j => estFaite(j, RANG_DES_TROIS)) },
        coffres: coffresEnAttente(joursAuxTrois, ouverts),
        minutesAvantMinuit: minutesAvantMinuit(maintenant),
      }
    })
  }

  /** Ce que le tirage du jour sait de lui : ses sept derniers jours, son défi, son carnet, ses missions d'hier. */
  private async contexte(
    profileId: string,
    aujourdhui: string,
    lundi: string,
    activites: ReadonlyMap<string, ActiviteDuJour>,
    lignes: readonly LigneDeMission[],
    series: readonly { mode: string; finieLe: number | null }[],
  ): Promise<ContexteDuTirage> {
    const septJours = Array.from({ length: 7 }, (_, i) => activites.get(jourAvant(aujourdhui, i + 1)) ?? AUCUNE_ACTIVITE)
    const hier = jourAvant(aujourdhui, 1)
    return {
      quizDuJourJoue: !!activites.get(aujourdhui)?.quizDuJour,
      joursDuJour: septJours.filter(a => a.quizDuJour).length,
      decouvertesJouees: new Set(septJours.flatMap(decouvertesDe)),
      defiFini: series.some(s => s.mode === 'defi' && s.finieLe !== null && jourDe(s.finieLe) >= lundi),
      // Un carnet qui ne se lit pas ne propose pas de révision : le reste du tirage tient.
      aRevoir: await this.deps.campagne.aRevoirDe(profileId).catch(e => {
        console.error('[missions] carnet illisible :', e)
        return 0
      }),
      hier: lignes.filter(l => l.jour === hier && l.mission).map(l => l.mission!),
    }
  }

  /**
   * Ouvre le coffre d'une semaine passée : le tirage, une fois — rouvert, il
   * redonne ce qu'il a donné. Refusé en clair : une semaine qui n'est pas
   * finie, une semaine sans tampon.
   */
  ouvrirLeCoffre(profileId: string, semaine: unknown): Promise<CoffreOuvert> {
    if (!semaineValide(semaine)) return Promise.reject(new Error('Ce coffre n’existe pas : recharge la page.'))
    return this.unALaFois(profileId, async () => {
      const { profiles } = this.deps
      const maintenant = this.deps.maintenant()
      const aujourdhui = jourDe(maintenant)
      if (semaine >= lundiDe(aujourdhui)) throw new Error('Ce coffre s’ouvre lundi : d’ici là, remplis ta carte.')
      const deja = await profiles.coffreDe(profileId, semaine)
      if (deja) return deja
      const tampons = (await profiles.joursAuxTrois(profileId, jourAvant(semaine, -7))).filter(j => j >= semaine).length
      if (tampons === 0) throw new Error('Pas de coffre cette semaine-là : aucun jour aux trois missions.')
      return profiles.ouvrirUnCoffre(profileId, semaine, tampons, { hasard: this.deps.hasard ?? Math.random, jour: aujourdhui, quand: maintenant })
    })
  }
}

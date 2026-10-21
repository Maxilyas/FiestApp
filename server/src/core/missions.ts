import type { LigneDeMission, ProfileStore } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import type { JourStore } from './jour'
import { jourAvant, jourDe, minutesAvantMinuit } from '../../../shared/jour'
import { minuitDe } from '../../../shared/qg'
import { releve } from './pouls'
import { moisDuCoffreValide, rangDuCoffre, rangDuCoffreDuMois, semaineValide, type CoffreEnAttente, type CoffreOuvert } from '../../../shared/coffre'
import { moisDe } from '../../../shared/jour'
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
  jour: Pick<JourStore, 'activiteDepuis' | 'coffresDuMois'>
  campagne: Pick<CampagneStore, 'activiteDepuis' | 'aRevoirDe'>
  /** L'horloge du quiz du jour, que les tests font passer minuit et lundi. */
  maintenant: () => number
  /** Le hasard du coffre, dans [0, 1[ : les tests le fixent. */
  hasard?: () => number
  /** Ce qu'une lecture dure au plus (`DUREE_D_UNE_LECTURE_MS`) : les tests le raccourcissent. */
  dureeMaxMs?: number
}

/**
 * Ce qu'une lecture des missions — ou l'ouverture d'un coffre — dure au plus.
 * Chaque requête vers la base tombe à dix secondes (`DELAI_DISTANT_MS`) : une
 * lecture n'a aucune raison d'en prendre davantage. Restée en route, elle
 * retenait toutes les suivantes du même profil (`unALaFois`) : le 15 octobre
 * 2026, la route du propriétaire « charge sans fin » et la ligne de son
 * accueil restait vide jusqu'au redémarrage du serveur, sans une erreur au
 * journal. Elle échoue maintenant, et dit à quelle étape elle en était —
 * avant les vingt secondes au bout desquelles la page abandonne d'elle-même
 * (`DELAI_REQUETE_MS`, `client/src/api.ts`) : la suivante passe à temps.
 */
export const DUREE_D_UNE_LECTURE_MS = 15_000

/** Une lecture restée en route au-delà de sa durée : une erreur du serveur, comptée au relevé, jamais un message pour l'invité. */
export class LectureEnRoute extends Error {
  constructor(etape: string, ms: number) {
    super(`lecture des missions restée en route ${Math.round(ms / 1000)} s, à l’étape « ${etape} »`)
    this.name = 'LectureEnRoute'
  }
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

/**
 * Les coffres de mois qui attendent : chaque mois clos où il était classé
 * (`JourStore.coffresDuMois`) et dont il n'a pas encore ouvert le coffre, le
 * plus ancien d'abord. Son rang vient de sa place, relue ici.
 */
export function coffresDuMoisEnAttente(classes: readonly { mois: string; place: number }[], ouverts: ReadonlySet<string>): CoffreEnAttente[] {
  return classes
    .filter(c => !ouverts.has(c.mois))
    .sort((a, b) => a.mois.localeCompare(b.mois))
    .map(c => ({ semaine: c.mois, tampons: 0, rang: rangDuCoffreDuMois(c.place), place: c.place }))
}

export class Missions {
  /** Une lecture à la fois par profil : deux onglets qui tirent et retiennent ensemble ne se croisent pas. */
  private enCours = new Map<string, Promise<unknown>>()
  /**
   * Le jour où l'on sait ses missions tirées, par profil : jusque-là, son
   * carnet — que seul le tirage lit — part avec ses journaux, au lieu de
   * coûter son propre aller-retour derrière eux. Oublié au redémarrage : la
   * première lecture d'après le lit pour rien, une fois.
   */
  private tireesLe = new Map<string, string>()

  constructor(private deps: DepsDesMissions) {}

  /**
   * Le travail d'un profil après celui d'avant, borné (`DUREE_D_UNE_LECTURE_MS`) :
   * au-delà, il échoue — `LectureEnRoute`, avec l'étape qu'il a dite en dernier
   * (`etape`) — et le suivant passe. Ce qu'il attendait continue sans retenir
   * personne.
   */
  private unALaFois<T>(profileId: string, travail: (etape: (ou: string) => void) => Promise<T>): Promise<T> {
    const avant = this.enCours.get(profileId) ?? Promise.resolve()
    const dureeMs = this.deps.dureeMaxMs ?? DUREE_D_UNE_LECTURE_MS
    const suite = avant.then(() => {
      let ou = 'au départ'
      let minuteur: ReturnType<typeof setTimeout> | undefined
      const enRoute = new Promise<never>((_, rejeter) => {
        minuteur = setTimeout(() => {
          const enRetard = new LectureEnRoute(ou, dureeMs)
          // Au relevé de l'heure aussi, sous son étape — sans un nom : la page « Le serveur » du QG le dira.
          releve.erreur(`missions en route · ${ou}`, enRetard)
          rejeter(enRetard)
        }, dureeMs)
      })
      return Promise.race([travail(e => (ou = e)), enRoute]).finally(() => clearTimeout(minuteur))
    })
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
   *
   * D'un aller-retour à la base, deux à la première lecture du jour — le
   * tirage s'écrit — et ce qui vient d'être fait s'écrit derrière : la ligne
   * de l'accueil attendait ses tampons et ses coffres derrière ses journaux,
   * et le tirage son carnet, quatre allers-retours l'un après l'autre le
   * matin (le 15 octobre 2026 : « c'est le texte qui s'affiche après »).
   */
  duJour(profileId: string): Promise<MissionsDuJour> {
    return this.unALaFois(profileId, async etape => {
      const { profiles, jour, campagne } = this.deps
      etape('ses journaux')
      const maintenant = this.deps.maintenant()
      const aujourdhui = jourDe(maintenant)
      const lundi = lundiDe(aujourdhui)
      const depuis = jourAvant(lundi, 7)
      const debut = minuitDuJour(depuis)
      const carnet = this.tireesLe.get(profileId) === aujourdhui ? null : this.aRevoirDe(profileId)
      const [lignes, duJour, deCampagne, soirees, auxTrois, ouverts, deMois] = await Promise.all([
        profiles.lignesDesMissions(profileId, depuis),
        jour.activiteDepuis(profileId, depuis),
        campagne.activiteDepuis(profileId, debut),
        profiles.soireesDepuis(profileId, debut),
        profiles.joursAuxTrois(profileId, lundi),
        profiles.semainesDesCoffres(profileId),
        jour.coffresDuMois(profileId),
      ])
      const activites = activiteDesJours({ ...duJour, ...deCampagne, soirees })
      let siennes = lignes
      if (!lignes.some(l => l.jour === aujourdhui)) {
        etape('son carnet')
        const contexte = this.contexte(aujourdhui, lundi, activites, lignes, deCampagne.series, await (carnet ?? this.aRevoirDe(profileId)))
        etape('le tirage')
        const tirees = await profiles.tirerLesMissions(profileId, aujourdhui, tirerLesMissions(`${profileId}|${aujourdhui}`, contexte), maintenant)
        siennes = [...lignes, ...tirees]
      }
      this.tireesLe.set(profileId, aujourdhui)
      etape('ce qui est fait')
      const retenues = await profiles.accomplirDesMissions(profileId, faitesARetenir(siennes, activites, aujourdhui, maintenant))
      const faites = new Set([...siennes.filter(l => l.faiteLe !== null), ...retenues].map(l => `${l.jour}|${l.rang}`))
      const estFaite = (j: string, rang: number) => faites.has(`${j}|${rang}`)
      // Ses tampons d'avant cette semaine, lus avec ses journaux : un dimanche
      // que cette lecture vient de retenir — joué à 23 h 50, lu lundi — compte déjà.
      const joursAuxTrois = [...auxTrois, ...retenues.filter(r => r.rang === RANG_DES_TROIS && r.jour < lundi).map(r => r.jour)]
      const activite = activites.get(aujourdhui) ?? AUCUNE_ACTIVITE
      return {
        jour: aujourdhui,
        missions: siennes
          .filter(l => l.jour === aujourdhui && l.rang < MISSIONS_PAR_JOUR && l.mission)
          .map(l => vueDeLaMission(l.rang, l.mission!, activite, estFaite(aujourdhui, l.rang))),
        trois: estFaite(aujourdhui, RANG_DES_TROIS),
        nouvelles: retenues.filter(r => r.jour === aujourdhui).map(r => r.rang),
        semaine: { lundi, tampons: joursDeLaSemaine(lundi).map(j => estFaite(j, RANG_DES_TROIS)) },
        // Celui du mois d'abord : il vient de loin, et vaut plus qu'un lundi.
        coffres: [...coffresDuMoisEnAttente(deMois, ouverts), ...coffresEnAttente(joursAuxTrois, ouverts)],
        minutesAvantMinuit: minutesAvantMinuit(maintenant),
      }
    })
  }

  /** Les questions de son carnet à revoir aujourd'hui, pour le tirage : un carnet qui ne se lit pas ne propose pas de révision, le reste du tirage tient. */
  private aRevoirDe(profileId: string): Promise<number> {
    return this.deps.campagne.aRevoirDe(profileId).catch(e => {
      console.error('[missions] carnet illisible :', e)
      return 0
    })
  }

  /** Ce que le tirage du jour sait de lui : ses sept derniers jours, son défi, son carnet, ses missions d'hier. */
  private contexte(
    aujourdhui: string,
    lundi: string,
    activites: ReadonlyMap<string, ActiviteDuJour>,
    lignes: readonly LigneDeMission[],
    series: readonly { mode: string; finieLe: number | null }[],
    aRevoir: number,
  ): ContexteDuTirage {
    const septJours = Array.from({ length: 7 }, (_, i) => activites.get(jourAvant(aujourdhui, i + 1)) ?? AUCUNE_ACTIVITE)
    const hier = jourAvant(aujourdhui, 1)
    return {
      quizDuJourJoue: !!activites.get(aujourdhui)?.quizDuJour,
      joursDuJour: septJours.filter(a => a.quizDuJour).length,
      decouvertesJouees: new Set(septJours.flatMap(decouvertesDe)),
      defiFini: series.some(s => s.mode === 'defi' && s.finieLe !== null && jourDe(s.finieLe) >= lundi),
      aRevoir,
      hier: lignes.filter(l => l.jour === hier && l.mission).map(l => l.mission!),
    }
  }

  /**
   * Ouvre le coffre d'une semaine passée : le tirage, une fois — rouvert, il
   * redonne ce qu'il a donné. Refusé en clair : une semaine qui n'est pas
   * finie, une semaine sans tampon.
   */
  ouvrirLeCoffre(profileId: string, brut: unknown): Promise<CoffreOuvert> {
    if (typeof brut !== 'string' || !(moisDuCoffreValide(brut) || semaineValide(brut))) return Promise.reject(new Error('Ce coffre n’existe pas : recharge la page.'))
    const semaine: string = brut
    const duMois = moisDuCoffreValide(semaine)
    return this.unALaFois(profileId, async etape => {
      const { profiles, jour } = this.deps
      const maintenant = this.deps.maintenant()
      const aujourdhui = jourDe(maintenant)
      etape('le coffre')
      if (duMois) {
        // Le coffre d'un mois clos : sa place, figée à la clôture, fait son rang.
        const deja = await profiles.coffreDe(profileId, semaine)
        if (deja) return deja
        if (semaine >= moisDe(aujourdhui)) throw new Error('Ce coffre s’ouvre à la fin du mois : d’ici là, grimpe au classement.')
        const place = (await jour.coffresDuMois(profileId)).find(c => c.mois === semaine)?.place
        if (!place) throw new Error('Pas de coffre pour ce mois-là : tu n’étais pas classé au quiz du jour.')
        return profiles.ouvrirUnCoffre(profileId, semaine, place, { hasard: this.deps.hasard ?? Math.random, jour: aujourdhui, quand: maintenant })
      }
      if (semaine >= lundiDe(aujourdhui)) throw new Error('Ce coffre s’ouvre lundi : d’ici là, remplis ta carte.')
      const deja = await profiles.coffreDe(profileId, semaine)
      if (deja) return deja
      const tampons = (await profiles.joursAuxTrois(profileId, jourAvant(semaine, -7))).filter(j => j >= semaine).length
      if (tampons === 0) throw new Error('Pas de coffre cette semaine-là : aucun jour aux trois missions.')
      return profiles.ouvrirUnCoffre(profileId, semaine, tampons, { hasard: this.deps.hasard ?? Math.random, jour: aujourdhui, quand: maintenant })
    })
  }
}

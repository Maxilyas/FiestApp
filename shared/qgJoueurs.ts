// Les joueurs au QG (`/admin#joueurs`, le lot 6 du QG 2, le 4 novembre 2026 —
// la proposition du 3, `retours/2026-11-03/le-qg.md`, « Les joueurs » et « Ce que
// le serveur doit mesurer de plus ») : combien jouent, combien reviennent, et
// qui décroche. Les profils seulement : un invité sans profil ne se suit pas
// d'un soir à l'autre, il se compte, il ne se nomme nulle part.
//
// Deux mémoires, dans la base permanente (`server/src/core/memoireDuQg.ts`),
// dérivées des journaux — les parties du jour, les séries de la campagne, les
// soirées créditées à chaque profil, les fiches de l'historique — et donc
// recalculables (`VERSION_DE_LA_MEMOIRE`) :
//
// - la feuille de présence (`qg_presences`) : une ligne par profil et par jour
//   de Paris, les modes qu'il y a joués et la minute de sa première partie ;
// - la mémoire longue (`qg_jours`) : les chiffres de chaque jour, figés une
//   fois le jour fini, gardés un an — quatre-vingt-dix jours se lisent en
//   quatre-vingt-dix lignes.
//
// Un jour fini s'écrit une fois, au premier passage du QG après minuit, et se
// rattrape s'il manque ; seul aujourd'hui se relit des journaux, par leurs
// index. Ce fichier tient les dérivations pures : la feuille d'un jour, ses
// chiffres, les segments, les cohortes, les heures de jeu, les combinaisons de
// modes, l'origine des profils.

import { MODES_DU_QG, NOM_DU_MODE, jourDeLInstant, joursDesMinuits, minuitDe, participationsParSeau, type ModeDuQg, type PartieDesParticipations, type SoireeDesParticipations } from './qg'
import { jourAvant, jourDe, minutesDeParis } from './jour'
import { formatNumber } from './typographie'
import type { CalculEnTranches } from './tranches'
import type { OrigineLue } from './origines'
import type { ConfettisDUnJour } from './qgEconomie'
import { couvertsDepuis, serveurDuJour, type DemarrageDuServeur, type ServeurDUnJour } from './santeDuServeur'
import { RANG_DES_TROIS } from './missions'

/**
 * La version des dérivations : une règle de la feuille de présence ou des
 * chiffres d'un jour qui change la monte, et le premier passage d'après efface
 * les deux mémoires et les refait des journaux, aussi loin qu'ils remontent —
 * ce que les journaux savent encore : le serveur d'un jour, que ses démarrages
 * ne gardent que huit jours, passe de l'ancienne ligne à la neuve.
 *
 * 2 (le 4 novembre 2026, la revue d'expert P1.3) : les soirées et leurs salons,
 * les invités avec et sans profil, les naissances et leur lendemain, les
 * missions, les questions jouées de chaque mode, les confettis, le serveur.
 */
export const VERSION_DE_LA_MEMOIRE = 2

/** Ce que la mémoire garde : un an de jours, et de feuilles de présence. Au-delà, elle s'efface d'elle-même. */
export const JOURS_DE_LA_MEMOIRE = 366

/** Le graphique des joueurs, jour par jour : quatre-vingt-dix jours au plus, aujourd'hui compris. */
export const JOURS_DU_GRAPHE_DES_ACTIFS = 90

/** « Quand on joue » : les quatre dernières semaines finies, chaque jour de la semaine quatre fois. */
export const JOURS_DES_HEURES = 28

/** Les cohortes : huit semaines d'inscription au plus, suivies huit semaines chacune. */
export const COHORTES_MONTREES = 8
export const SEMAINES_DE_RETOUR = 8

/** Les profils qu'un segment nomme, au plus : les cinquante premiers, comme l'activité. */
export const PROFILS_D_UN_SEGMENT = 50

/** Les combinaisons de modes que la page montre, au plus : les autres se comptent ensemble. */
export const COMBINAISONS_MONTREES = 8

// ── La feuille de présence ────────────────────────────────────────────────

/** Un mode en un bit : la feuille garde les modes d'un jour en un seul nombre. L'ordre est celui de `MODES_DU_QG`. */
export const BIT_DU_MODE: Record<ModeDuQg, number> = { soiree: 1, campagne: 2, cabinet: 4, jour: 8, duel: 16 }

export const modesDuMasque = (masque: number): ModeDuQg[] => MODES_DU_QG.filter(m => (masque & BIT_DU_MODE[m]) !== 0)

/** Une ligne de la feuille de présence : un profil, un jour de Paris, ses modes, et la minute de sa première partie. */
export interface Presence {
  jour: string
  qui: string
  modes: number
  /**
   * Les minutes écoulées depuis le minuit de Paris jusqu'à sa première partie
   * du jour : « aujourd'hui à la même heure » se compare aux jours d'avant
   * arrêtés au même écart, comme `compteDuJour`.
   */
  premiere: number
}

/** Un fait daté qui dit qu'un profil a joué : une partie, une soirée. */
export interface FaitDePresence {
  qui: string
  quand: number
  mode: ModeDuQg
}

/** La feuille d'un jour : chaque profil une fois, l'union de ses modes, sa première minute ; rangée par profil. */
export function presencesDuJour(jour: string, minuit: number, faits: Iterable<FaitDePresence>): Presence[] {
  const parQui = new Map<string, Presence>()
  for (const f of faits) {
    const minute = Math.max(0, Math.floor((f.quand - minuit) / 60_000))
    const deja = parQui.get(f.qui)
    if (deja) {
      deja.modes |= BIT_DU_MODE[f.mode]
      if (minute < deja.premiere) deja.premiere = minute
    } else parQui.set(f.qui, { jour, qui: f.qui, modes: BIT_DU_MODE[f.mode], premiere: minute })
  }
  return [...parQui.values()].sort((a, b) => (a.qui < b.qui ? -1 : a.qui > b.qui ? 1 : 0))
}

/**
 * Les journaux d'une plage de jours, tels que la mémoire les lit : les mêmes
 * que la vue d'ensemble (`lesTrenteJours`, `lesSoireesDepuis`), sur une plage
 * bornée des deux côtés.
 */
export interface JournauxDeLaMemoire {
  /** Chaque partie jouée seul — du jour, de campagne, du Cabinet, un duel —, datée à son début, et ses questions jouées quand elle les dit. */
  solo: readonly (PartieDesParticipations & { questions?: number })[]
  /**
   * Chaque soirée créditée à un profil, à l'heure de son premier crédit
   * (`profile_xp`) : une fiche d'avant le 14 octobre 2026 ne dit pas ses
   * profils, sa ligne d'expérience si.
   */
  soireesDesProfils: readonly { qui: string; quand: number }[]
  /**
   * Chaque soirée, datée à sa première question : ses invités qui ont joué, et
   * leurs profils quand sa fiche les dit ; son salon (`spaceId`) et ses
   * questions jouées (`jouees`, une par invité et par question posée), que le
   * rattrapage lit — jamais la page à chaque ouverture.
   */
  soirees: readonly (SoireeDesParticipations & { spaceId?: string; jouees?: number })[]
  inscriptions: readonly number[]
  achats: readonly number[]
}

/**
 * Ce que seul le rattrapage lit en plus (la mémoire v2) — de quoi dire de
 * chaque jour fini ce que l'audience ne disait pas : les naissances, les
 * salons, les missions, les confettis, le serveur. Des lectures par index des
 * mêmes jours, une fois par jour fini ; aujourd'hui ne les lit jamais.
 */
export interface CeQueLaMemoireLitDePlus {
  /** Les profils nés dans la plage — et la veille de son premier jour, dont le lendemain est à lui : qui, quand, d'où. */
  naissances: readonly { qui: string; quand: number; origine: OrigineLue | null }[]
  /** La première soirée de l'historique de chaque salon qui joue dans la plage (`held_at`). */
  premieresSoirees: ReadonlyMap<string, number>
  /** Les missions du jour faites dans la plage : qui, quand, leur rang (`RANG_DES_TROIS`, la ligne des trois). */
  missions: readonly { qui: string; quand: number; rang: number }[]
  /** Les confettis de la plage, jour par jour, alignés sur ses minuits (`confettisParJour`). */
  confettis: readonly ConfettisDUnJour[]
  /**
   * Les démarrages gardés (`qg_demarrages`), l'instant de leur lecture — à
   * l'horloge qui les date — et celui qui répond : un jour qu'ils couvrent tout
   * entier (`couvertsDepuis`) se lit sur eux.
   */
  serveur: { demarrages: readonly DemarrageDuServeur[]; maintenant: number; courant: string }
  /**
   * Ce que la mémoire savait du serveur de chaque jour avant une version neuve
   * — null compris, un jour déjà trop vieux quand il s'est écrit : ses
   * démarrages, eux, ne se refont pas. Un jour qui n'y est pas se lit sur eux.
   */
  heritage: ReadonlyMap<string, ServeurDUnJour | null>
}

/** Une soirée d'un jour fini, telle que la mémoire la garde : son salon — un identifiant, que la page nomme —, ses invités qui ont joué, et ceux venus avec un profil (null, sa fiche ne le dit pas). */
export interface SoireeDUnJour {
  espace: string
  invites: number
  profils: number | null
}

/** Les chiffres d'un jour fini, figés dans `qg_jours`. */
export interface ChiffresDUnJour {
  /** La version des dérivations qui l'a écrit (`VERSION_DE_LA_MEMOIRE`). */
  v: number
  /** Les personnes du jour, comme le poste de commande les compte : un profil une fois, un invité sans profil une fois par soirée. */
  joueurs: number
  /** Les joueurs de chaque mode, qui ne s'additionnent pas. */
  modes: Record<ModeDuQg, number>
  /** Les participations de chaque mode, qui que ce soit : chaque partie, en soirée chaque invité qui a joué. */
  parties: Record<ModeDuQg, number>
  nouveauxProfils: number
  achats: number
  /** Les profils qui ont joué ce jour-là, ces sept jours, ces trente jours — finissant ce jour-là. */
  profils: number
  semaine: number
  mois: number
  /** Les invités sans profil venus en soirée : chacun une fois par soirée — une fiche qui ne dit pas ses profils les compte tous. */
  invites: number
  /** Les participations commencées à chaque heure de Paris, de 0 à 23 : « quand on joue ». */
  heures: number[]
  // La version 2 (la revue d'expert du 4 novembre 2026, P1.3) : absents d'une ligne d'avant — lus absents, jamais zéro.
  /** Les soirées du jour, chacune son salon, ses invités et ses profils. */
  soirees?: SoireeDUnJour[]
  /** Les salons qui ont joué ce jour-là la toute première soirée de leur historique : un nouvel animateur. */
  nouveauxSalons?: string[]
  /** Les profils nés ce jour-là, par l'écran de leur naissance (`profiles.origine`) ; `avant`, ceux d'avant la colonne. */
  naissances?: Partial<Record<OrigineLue | 'avant', number>>
  /** Des profils nés la veille, ceux qui ont joué ce jour-là : le lendemain des nouveaux. */
  lendemain?: number
  /** Les missions du jour faites, les profils qui en ont fait une au moins, et ceux qui ont fait les trois. */
  missions?: { faites: number; profils: number; toutes: number }
  /** Les questions jouées de chaque mode, comme l'activité les compte — en soirée, une par invité et par question posée. */
  questions?: Record<ModeDuQg, number>
  /** Les confettis gagnés, source par source, et dépensés, puits par puits. */
  confettis?: ConfettisDUnJour
  /** Le serveur ce jour-là ; null, ses démarrages n'étaient plus gardés quand le jour s'est écrit. */
  serveur?: ServeurDUnJour | null
}

/**
 * Le serveur d'un jour tel qu'une ligne de la mémoire le garde : null — ses
 * démarrages n'étaient plus gardés quand il s'est écrit —, ou ses heures et
 * ses versions ; undefined, une forme que la mémoire n'écrit pas, qui se lit
 * absente.
 */
export function lireLeServeurDUnJour(brut: unknown): ServeurDUnJour | null | undefined {
  if (brut === null) return null
  if (typeof brut !== 'object') return undefined
  const { heures, versions } = brut as { heures?: unknown; versions?: unknown }
  if (typeof heures !== 'number' || !Number.isFinite(heures) || heures < 0) return undefined
  if (!Array.isArray(versions) || !versions.every(v => typeof v === 'string')) return undefined
  return { heures, versions: [...(versions as string[])] }
}

/** Les profils nés en soirée : à son entrée, entre deux quiz, à sa fin. */
export const ORIGINES_EN_SOIREE: readonly OrigineLue[] = ['entree', 'soiree', 'fin-de-soiree']

/** Ce qu'un jour dit de ses soirées : combien, leurs salons, les nouveaux, et leurs invités avec et sans profil — null, une ligne d'avant. */
export function soireesDuJour(c: Pick<ChiffresDUnJour, 'soirees' | 'nouveauxSalons' | 'invites'>): {
  soirees: number
  animateurs: number
  nouveaux: number
  invites: number
  avecProfil: number
  sansProfil: number
} | null {
  if (!c.soirees) return null
  const avecProfil = c.soirees.reduce((t, s) => t + (s.profils ?? 0), 0)
  return {
    soirees: c.soirees.length,
    animateurs: new Set(c.soirees.map(s => s.espace)).size,
    nouveaux: c.nouveauxSalons?.length ?? 0,
    invites: c.soirees.reduce((t, s) => t + s.invites, 0),
    avecProfil,
    sansProfil: c.invites,
  }
}

/** Les profils nés en soirée un jour, toutes ses portes ; null, une ligne d'avant. */
export const nesEnSoiree = (c: Pick<ChiffresDUnJour, 'naissances'>): number | null =>
  c.naissances ? ORIGINES_EN_SOIREE.reduce((t, o) => t + (c.naissances?.[o] ?? 0), 0) : null

/**
 * La mémoire du QG en lignes de tableur (« Télécharger la mémoire », la revue
 * d'expert du 4 novembre 2026, P2.10 : un bilan de l'année, ou une question à
 * laquelle le QG ne répond pas encore, se font hors de lui) — l'en-tête, puis
 * un jour par ligne, le plus ancien d'abord. Ce qu'un jour ne sait pas — une
 * ligne d'avant la version 2, un serveur que ses démarrages ne couvraient
 * plus — reste vide, jamais zéro : un tableur en ferait une moyenne fausse.
 * Des comptes et les versions du serveur ; ni un salon, ni un profil.
 */
export function lignesDeLaMemoire(jours: ReadonlyMap<string, ChiffresDUnJour>): (string | number)[][] {
  const inconnu = ''
  const somme = (r: Readonly<Record<string, number>> | undefined) => (r ? Object.values(r).reduce((t, n) => t + n, 0) : inconnu)
  // Une heure à la virgule : le tableur français lit « 17,5 » comme un nombre, « 17.5 » comme un texte.
  const heures = (h: number) => String(Math.round(h * 10) / 10).replace('.', ',')
  const tete = [
    'Jour',
    'Personnes',
    'Profils actifs',
    'Profils actifs sur 7 jours',
    'Profils actifs sur 30 jours',
    'Passages d’invités',
    'Profils nés',
    'Nés en soirée',
    'Nés la veille qui ont rejoué',
    'Achats',
    'Soirées',
    'Salons qui ont joué',
    'Nouveaux salons',
    ...MODES_DU_QG.map(m => `Joueurs · ${NOM_DU_MODE[m]}`),
    ...MODES_DU_QG.map(m => `Participations · ${NOM_DU_MODE[m]}`),
    ...MODES_DU_QG.map(m => `Questions jouées · ${NOM_DU_MODE[m]}`),
    'Missions faites',
    'Profils à une mission au moins',
    'Profils aux trois missions',
    'Confettis gagnés',
    'Confettis dépensés',
    'Heures éveillées du serveur',
    'Versions en ligne',
  ]
  const lignes = [...jours.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([jour, c]) => {
      const s = soireesDuJour(c)
      return [
        jour,
        c.joueurs,
        c.profils,
        c.semaine,
        c.mois,
        c.invites,
        c.nouveauxProfils,
        nesEnSoiree(c) ?? inconnu,
        c.lendemain ?? inconnu,
        c.achats,
        s?.soirees ?? inconnu,
        s?.animateurs ?? inconnu,
        s?.nouveaux ?? inconnu,
        ...MODES_DU_QG.map(m => c.modes[m] ?? inconnu),
        ...MODES_DU_QG.map(m => c.parties[m] ?? inconnu),
        ...MODES_DU_QG.map(m => c.questions?.[m] ?? inconnu),
        c.missions?.faites ?? inconnu,
        c.missions?.profils ?? inconnu,
        c.missions?.toutes ?? inconnu,
        somme(c.confettis?.gagnes),
        somme(c.confettis?.depenses),
        c.serveur ? heures(c.serveur.heures) : inconnu,
        c.serveur ? c.serveur.versions.join(' ') : inconnu,
      ]
    })
  return [tete, ...lignes]
}

/** Un jour fini, prêt à s'écrire : ses chiffres et sa feuille de présence. */
export interface JourDeLaMemoire {
  jour: string
  chiffres: ChiffresDUnJour
  presences: Presence[]
}

/**
 * L'heure de Paris d'un instant, gardée par heure du temps universel : Paris
 * est à une heure pleine de Greenwich et change d'heure à une heure pile — la
 * même règle que `jourDe`. Chaque partie la demandait à `Intl` : des milliers
 * par plage.
 */
const heuresDeParis = new Map<number, number>()
export function heureDeParis(quand: number): number {
  const heure = Math.floor(quand / 3_600_000)
  const gardee = heuresDeParis.get(heure)
  if (gardee !== undefined) return gardee
  if (heuresDeParis.size >= 20_000) heuresDeParis.clear()
  const lue = Math.floor(minutesDeParis(heure * 3_600_000) / 60)
  heuresDeParis.set(heure, lue)
  return lue
}

/** Les profils distincts d'une fenêtre de jours, comptés sur les feuilles qu'on a. */
function profilsDistincts(feuilles: ReadonlyMap<string, readonly string[]>, jours: readonly string[]): number {
  const vus = new Set<string>()
  for (const j of jours) for (const qui of feuilles.get(j) ?? []) vus.add(qui)
  return vus.size
}

/** Les `n` jours qui finissent par `jour`, le plus ancien d'abord. */
const joursJusqua = (jour: string, n: number) => Array.from({ length: n }, (_, k) => jourAvant(jour, n - 1 - k))

/** Les invités sans profil d'une soirée : ses joueurs, moins ses profils quand sa fiche les dit. */
export const invitesSansProfil = (s: SoireeDesParticipations) => (s.profils ? Math.max(0, s.joueurs - new Set(s.profils).size) : s.joueurs)

/** Le minuit de Paris d'un jour de Paris : lu dans le jour, comme `minuitDe` — un jour a vingt-trois à vingt-cinq heures. */
export function minuitDuJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  return minuitDe(Date.UTC(a, m - 1, j, 12))
}

/**
 * Les jours d'une plage, un par tranche : la feuille de présence et les
 * chiffres de chacun. `minuits` : les minuits de Paris de ses jours, le plus
 * ancien d'abord, et `fin` celui qui suit le dernier. `avant` : les profils de
 * chacun des vingt-neuf jours d'avant la plage, déjà écrits — les joueurs de
 * la semaine et du mois de son premier jour en ont besoin. Un fait hors de la
 * plage ne compte pas. `plus` : ce que le rattrapage lit en plus (la mémoire
 * v2) ; sans lui, un jour ne dit que l'audience — les épreuves de la feuille.
 */
export function* joursDeLaMemoire(
  journaux: JournauxDeLaMemoire,
  minuits: readonly number[],
  fin: number,
  avant: ReadonlyMap<string, readonly string[]> = new Map(),
  plus?: CeQueLaMemoireLitDePlus,
): CalculEnTranches<JourDeLaMemoire[]> {
  const n = minuits.length
  const jours = joursDesMinuits(minuits)
  const indice = (quand: number) => (quand < fin ? jourDeLInstant(minuits, quand) : -1)
  const vide = <T>() => Array.from({ length: n }, () => [] as T[])
  const solo = vide<JournauxDeLaMemoire['solo'][number]>()
  const xp = vide<{ qui: string; quand: number }>()
  const soirees = vide<JournauxDeLaMemoire['soirees'][number]>()
  const inscriptions = minuits.map(() => 0)
  const achats = minuits.map(() => 0)
  for (const p of journaux.solo) solo[indice(p.quand)]?.push(p)
  for (const s of journaux.soireesDesProfils) xp[indice(s.quand)]?.push(s)
  for (const s of journaux.soirees) soirees[indice(s.quand)]?.push(s)
  for (const quand of journaux.inscriptions) if (indice(quand) >= 0) inscriptions[indice(quand)]++
  for (const quand of journaux.achats) if (indice(quand) >= 0) achats[indice(quand)]++
  // Ce que le rattrapage lit en plus, rangé par jour : les naissances — celles de la veille de la plage à part, dont
  // le lendemain est son premier jour —, les missions faites.
  const naissances = vide<CeQueLaMemoireLitDePlus['naissances'][number]>()
  const missions = vide<CeQueLaMemoireLitDePlus['missions'][number]>()
  const nesLaVeille = new Set<string>()
  if (plus && n > 0) {
    const veille = minuitDuJour(jourAvant(jours[0]))
    for (const p of plus.naissances) {
      if (p.quand >= veille && p.quand < minuits[0]) nesLaVeille.add(p.qui)
      else naissances[indice(p.quand)]?.push(p)
    }
    for (const m of plus.missions) missions[indice(m.quand)]?.push(m)
  }
  const couverts = plus ? couvertsDepuis(plus.serveur.demarrages, plus.serveur.maintenant) : Infinity
  yield
  const feuilles = new Map<string, readonly string[]>(avant)
  const rendus: JourDeLaMemoire[] = []
  for (let i = 0; i < n; i++) {
    const jour = jours[i]
    const minuit = minuits[i]
    const finDuJour = minuits[i + 1] ?? fin
    const faits: FaitDePresence[] = [
      ...solo[i],
      ...xp[i].map(s => ({ qui: s.qui, quand: s.quand, mode: 'soiree' as const })),
      ...soirees[i].flatMap(s => (s.profils ?? []).map(qui => ({ qui, quand: s.quand, mode: 'soiree' as const }))),
    ]
    const presences = presencesDuJour(jour, minuit, faits)
    feuilles.set(
      jour,
      presences.map(p => p.qui),
    )
    const [seau] = participationsParSeau(solo[i], soirees[i], [minuit], finDuJour - 1)
    const heures = Array.from({ length: 24 }, () => 0)
    for (const p of solo[i]) heures[heureDeParis(p.quand)]++
    for (const s of soirees[i]) heures[heureDeParis(s.quand)] += s.joueurs
    const chiffres: ChiffresDUnJour = {
      v: VERSION_DE_LA_MEMOIRE,
      joueurs: seau.joueurs,
      modes: seau.modes,
      parties: seau.parties,
      nouveauxProfils: inscriptions[i],
      achats: achats[i],
      profils: presences.length,
      semaine: profilsDistincts(feuilles, joursJusqua(jour, 7)),
      mois: profilsDistincts(feuilles, joursJusqua(jour, 30)),
      invites: soirees[i].reduce((t, s) => t + invitesSansProfil(s), 0),
      heures,
    }
    if (plus) {
      const salons = new Set<string>()
      for (const s of soirees[i]) {
        const premiere = s.spaceId === undefined ? undefined : plus.premieresSoirees.get(s.spaceId)
        if (s.spaceId !== undefined && premiere !== undefined && premiere >= minuit && premiere < finDuJour) salons.add(s.spaceId)
      }
      const parOrigine: Partial<Record<OrigineLue | 'avant', number>> = {}
      for (const p of naissances[i]) parOrigine[p.origine ?? 'avant'] = (parOrigine[p.origine ?? 'avant'] ?? 0) + 1
      const nesLaVeilleDuJour = i === 0 ? nesLaVeille : new Set(naissances[i - 1].map(p => p.qui))
      const faites = missions[i].filter(m => m.rang < RANG_DES_TROIS)
      const questions = Object.fromEntries(MODES_DU_QG.map(m => [m, 0])) as Record<ModeDuQg, number>
      for (const p of solo[i]) questions[p.mode] += p.questions ?? 0
      for (const s of soirees[i]) questions.soiree += s.jouees ?? 0
      chiffres.soirees = soirees[i].map(s => ({ espace: s.spaceId ?? '', invites: s.joueurs, profils: s.profils ? new Set(s.profils).size : null }))
      chiffres.nouveauxSalons = [...salons].sort()
      chiffres.naissances = parOrigine
      chiffres.lendemain = presences.filter(p => nesLaVeilleDuJour.has(p.qui)).length
      chiffres.missions = { faites: faites.length, profils: new Set(faites.map(m => m.qui)).size, toutes: missions[i].length - faites.length }
      chiffres.questions = questions
      if (plus.confettis[i]) chiffres.confettis = plus.confettis[i]
      // Le serveur d'un jour : ce que la mémoire en savait d'abord — ses démarrages, purgés au huitième jour, ne se
      // refont pas —, sinon ses démarrages s'ils le couvrent tout entier, sinon rien : null, jamais zéro.
      chiffres.serveur = plus.heritage.has(jour)
        ? (plus.heritage.get(jour) ?? null)
        : minuit >= couverts && finDuJour <= plus.serveur.maintenant
          ? serveurDuJour(plus.serveur.demarrages, minuit, finDuJour, plus.serveur.maintenant, plus.serveur.courant)
          : null
    }
    rendus.push({ jour, presences, chiffres })
    yield
  }
  return rendus
}

/** La feuille d'aujourd'hui, de ses journaux relus — elle ne s'écrit qu'une fois le jour fini. */
export function presencesDAujourdhui(journaux: JournauxDeLaMemoire, minuit: number, maintenant: number): Presence[] {
  const dans = (quand: number) => quand >= minuit && quand <= maintenant
  const jour = jourDe(minuit + 12 * 3_600_000)
  return presencesDuJour(jour, minuit, [
    ...journaux.solo.filter(p => dans(p.quand)),
    ...journaux.soireesDesProfils.filter(s => dans(s.quand)).map(s => ({ qui: s.qui, quand: s.quand, mode: 'soiree' as const })),
    ...journaux.soirees.filter(s => dans(s.quand)).flatMap(s => (s.profils ?? []).map(qui => ({ qui, quand: s.quand, mode: 'soiree' as const }))),
  ])
}

// ── Les joueurs du jour, de la semaine, du mois ─────────────────────────────

/** Un chiffre et celui d'avant à comparer — null quand la mémoire ne remonte pas jusque-là. */
export interface ChiffreEtAvant {
  valeur: number
  avant: number | null
}

/**
 * Les profils distincts d'une fenêtre de jours qui finit aujourd'hui, arrêtée
 * à une minute du jour : les jours d'avant entiers, le dernier jusqu'à cette
 * minute. Rien avant `depuis`, le premier jour que la mémoire sait : une
 * fenêtre qui le dépasse rend null.
 */
export function actifsALaMinute(
  presences: ReadonlyMap<string, readonly Presence[]>,
  dernier: string,
  jours: number,
  minute: number,
  depuis: string,
): number | null {
  const fenetre = joursJusqua(dernier, jours)
  if (fenetre[0] < depuis) return null
  const vus = new Set<string>()
  for (const j of fenetre) for (const p of presences.get(j) ?? []) if (j !== dernier || p.premiere <= minute) vus.add(p.qui)
  return vus.size
}

/**
 * Aujourd'hui comparé aux sept jours d'avant, chacun arrêté à la même minute
 * — la règle de `compteDuJour` : un soir à 21 h ne se lit pas en baisse contre
 * des journées entières. Null sans jour d'avant à comparer.
 */
export function joueursDuJourALHeure(presences: ReadonlyMap<string, readonly Presence[]>, aujourdhui: string, minute: number, depuis: string): ChiffreEtAvant {
  const avant = joursJusqua(jourAvant(aujourdhui), 7).filter(j => j >= depuis)
  const valeur = (presences.get(aujourdhui) ?? []).filter(p => p.premiere <= minute).length
  if (avant.length === 0) return { valeur, avant: null }
  const total = avant.reduce((t, j) => t + (presences.get(j) ?? []).filter(p => p.premiere <= minute).length, 0)
  return { valeur, avant: Math.round(total / avant.length) }
}

/**
 * La fidélité : un jour moyen de la semaine finie — les sept jours d'avant
 * aujourd'hui, qui est entamé — sur les joueurs du mois au soir d'hier, en
 * pour cent. Chaque jour, la part des joueurs du mois qui revient. Null quand
 * la mémoire n'a pas ces jours, ou personne au mois.
 */
export function fideliteAuSoir(jours: ReadonlyMap<string, Pick<ChiffresDUnJour, 'profils' | 'mois'>>, soir: string): number | null {
  const semaine = joursJusqua(soir, 7).map(j => jours.get(j))
  const mois = jours.get(soir)?.mois
  if (!mois || semaine.some(j => j === undefined)) return null
  const moyenne = semaine.reduce((t, j) => t + (j?.profils ?? 0), 0) / 7
  return Math.round((moyenne / mois) * 100)
}

// ── Les segments ────────────────────────────────────────────────────────────

/**
 * Où en est chacun, un segment par profil, le premier qui lui va dans cet
 * ordre : un nouveau l'est sa première semaine, quoi qu'il ait joué. Ils se
 * partagent tous les profils, sans les suspendus — qui ne jouent plus, et
 * qu'une annonce ne touche pas.
 */
export const SEGMENTS = ['nouveaux', 'reguliers', 'occasionnels', 'a-risque', 'endormis', 'perdus'] as const
export type SegmentDuQg = (typeof SEGMENTS)[number]

export const NOM_DU_SEGMENT: Record<SegmentDuQg, string> = {
  nouveaux: 'Nouveaux',
  reguliers: 'Réguliers',
  occasionnels: 'Occasionnels',
  'a-risque': 'À risque',
  endormis: 'Endormis',
  perdus: 'Perdus de vue',
}

/** La règle de chaque segment, en clair : la page l'écrit à côté de son compte. */
export const REGLE_DU_SEGMENT: Record<SegmentDuQg, string> = {
  nouveaux: 'Inscrits ces sept derniers jours, qu’ils aient joué ou non',
  reguliers: 'Trois jours de jeu ou plus ces sept derniers jours',
  occasionnels: 'Un ou deux jours de jeu ces sept derniers jours',
  'a-risque': 'Rien ces sept jours, mais joué la semaine d’avant',
  endormis: 'Dernière partie il y a deux à quatre semaines',
  perdus: 'Rien depuis trente jours, ou jamais joué',
}

/** Le segment dans une phrase : « Annonce aux endormis », « 34 profils à risque ». */
export const AUX_PROFILS_DU_SEGMENT: Record<SegmentDuQg, string> = {
  nouveaux: 'aux nouveaux',
  reguliers: 'aux réguliers',
  occasionnels: 'aux occasionnels',
  'a-risque': 'aux profils à risque',
  endormis: 'aux endormis',
  perdus: 'aux perdus de vue',
}

/** Un segment tel que la route le reçoit : un des six, ou null — tous les profils. Refusé plutôt que deviné. */
export function lireLeSegment(brut: unknown): SegmentDuQg | null {
  if (brut === undefined || brut === null || brut === 'tous') return null
  if (!(SEGMENTS as readonly unknown[]).includes(brut)) throw new Error('Ce segment n’existe pas : recharge la page')
  return brut as SegmentDuQg
}

/** Un profil tel que l'audience le lit : quand il est né, s'il est suspendu, d'où il vient. */
export interface ProfilDeLAudience {
  id: string
  cree: number
  suspendu: boolean
  /** NULL : un profil d'avant le 4 novembre 2026, qui ne le dit pas. */
  origine: OrigineLue | null
}

/** Ce que les trente derniers jours disent d'un profil : ses jours joués, le dernier, l'union de ses modes. */
export interface TraceDUnProfil {
  jours: string[]
  dernier: string
  modes: number
}

/** Les traces des trente jours qui finissent aujourd'hui, profil par profil, tirées des feuilles de présence. */
export function tracesDesTrenteJours(presences: ReadonlyMap<string, readonly Presence[]>, aujourdhui: string): Map<string, TraceDUnProfil> {
  const traces = new Map<string, TraceDUnProfil>()
  for (const jour of joursJusqua(aujourdhui, 30)) {
    for (const p of presences.get(jour) ?? []) {
      const t = traces.get(p.qui)
      if (t) {
        t.jours.push(jour)
        t.dernier = jour
        t.modes |= p.modes
      } else traces.set(p.qui, { jours: [jour], dernier: jour, modes: p.modes })
    }
  }
  return traces
}

/** Les jours du calendrier de `de` à `a` : des jours de Paris, comptés sur leurs dates. */
export function joursEntre(de: string, a: string): number {
  const date = (j: string) => Date.UTC(Number(j.slice(0, 4)), Number(j.slice(5, 7)) - 1, Number(j.slice(8, 10)))
  return Math.round((date(a) - date(de)) / 86_400_000)
}

/** Le segment d'un profil, aujourd'hui. */
export function segmentDe(p: Pick<ProfilDeLAudience, 'cree'>, trace: TraceDUnProfil | undefined, aujourdhui: string): SegmentDuQg {
  if (jourDe(p.cree) >= jourAvant(aujourdhui, 6)) return 'nouveaux'
  if (!trace) return 'perdus'
  const absent = joursEntre(trace.dernier, aujourdhui)
  if (absent <= 6) return trace.jours.filter(j => j >= jourAvant(aujourdhui, 6)).length >= 3 ? 'reguliers' : 'occasionnels'
  if (absent <= 13) return 'a-risque'
  if (absent <= 29) return 'endormis'
  return 'perdus'
}

/** Un membre d'un segment, avant qu'on le nomme : de quoi le ranger et dire où il en est. */
export interface MembreDUnSegment {
  id: string
  cree: number
  /** Ses jours de jeu ces trente jours. */
  jours: number
  /** Son dernier jour de jeu ces trente jours ; null au-delà, ou jamais. */
  dernier: string | null
  modes: ModeDuQg[]
}

/**
 * Les segments de tous les profils, chacun ses membres dans son ordre : les
 * nouveaux du plus récent au plus ancien ; les réguliers et les occasionnels,
 * les plus assidus d'abord ; les autres, ceux partis le plus récemment d'abord
 * — les plus faciles à rappeler ; les perdus de vue, du plus récent inscrit.
 */
export function segmentsDesProfils(
  profils: readonly ProfilDeLAudience[],
  traces: ReadonlyMap<string, TraceDUnProfil>,
  aujourdhui: string,
): Record<SegmentDuQg, MembreDUnSegment[]> {
  const parSegment = Object.fromEntries(SEGMENTS.map(s => [s, [] as MembreDUnSegment[]])) as Record<SegmentDuQg, MembreDUnSegment[]>
  for (const p of profils) {
    if (p.suspendu) continue
    const trace = traces.get(p.id)
    parSegment[segmentDe(p, trace, aujourdhui)].push({
      id: p.id,
      cree: p.cree,
      jours: trace?.jours.length ?? 0,
      dernier: trace?.dernier ?? null,
      modes: trace ? modesDuMasque(trace.modes) : [],
    })
  }
  const parId = (a: MembreDUnSegment, b: MembreDUnSegment) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const plusRecentInscrit = (a: MembreDUnSegment, b: MembreDUnSegment) => b.cree - a.cree || parId(a, b)
  const plusAssidu = (a: MembreDUnSegment, b: MembreDUnSegment) => b.jours - a.jours || (b.dernier ?? '').localeCompare(a.dernier ?? '') || parId(a, b)
  const partiLePlusRecemment = (a: MembreDUnSegment, b: MembreDUnSegment) => (b.dernier ?? '').localeCompare(a.dernier ?? '') || b.jours - a.jours || parId(a, b)
  parSegment.nouveaux.sort(plusRecentInscrit)
  parSegment.reguliers.sort(plusAssidu)
  parSegment.occasionnels.sort(plusAssidu)
  parSegment['a-risque'].sort(partiLePlusRecemment)
  parSegment.endormis.sort(partiLePlusRecemment)
  parSegment.perdus.sort(plusRecentInscrit)
  return parSegment
}

// ── Les cohortes ────────────────────────────────────────────────────────────

/** Le lundi de la semaine d'un jour de Paris, au calendrier. */
export function lundiDe(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number)
  return jourAvant(jour, (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7)
}

/** Une semaine d'inscription, et ce qu'elle est devenue. */
export interface CohorteDuQg {
  /** Son lundi. */
  semaine: string
  /** Les profils inscrits cette semaine-là, qui existent encore. */
  taille: number
  /** Combien ont joué une, deux… huit semaines plus tard ; null pour une semaine pas encore finie. */
  revenus: (number | null)[]
}

/**
 * Les cohortes : chaque semaine d'inscription — du lundi au dimanche de
 * Paris —, et combien de ses profils ont joué au moins une fois chacune des
 * semaines suivantes. Seules les semaines finies se comptent : la plus récente
 * cohorte suivie est celle d'avant la semaine dernière, qui a sa première
 * semaine entière derrière elle. Les plus anciennes d'abord, sans celles qui
 * n'ont personne. Les suspendus y restent : ils ont joué, ce qu'ils sont
 * devenus depuis n'efface pas leur semaine.
 */
export function cohortesDesProfils(
  profils: readonly ProfilDeLAudience[],
  presences: ReadonlyMap<string, readonly Presence[]>,
  aujourdhui: string,
  n = COHORTES_MONTREES,
  semaines = SEMAINES_DE_RETOUR,
): CohorteDuQg[] {
  const cetteSemaine = lundiDe(aujourdhui)
  const premiere = jourAvant(cetteSemaine, 7 * (n + 1))
  // La semaine de jeu de chaque profil, comptée en lundis.
  const semainesJouees = new Map<string, Set<string>>()
  for (const [jour, lignes] of presences) {
    if (jour < premiere) continue
    const lundi = lundiDe(jour)
    for (const p of lignes) {
      let siennes = semainesJouees.get(p.qui)
      if (!siennes) semainesJouees.set(p.qui, (siennes = new Set()))
      siennes.add(lundi)
    }
  }
  const cohortes: CohorteDuQg[] = []
  for (let k = n + 1; k >= 2; k--) {
    const semaine = jourAvant(cetteSemaine, 7 * k)
    const fin = jourAvant(semaine, -6)
    const membres = profils.filter(p => {
      const j = jourDe(p.cree)
      return j >= semaine && j <= fin
    })
    if (membres.length === 0) continue
    const revenus = Array.from({ length: semaines }, (_, s) => {
      const lundi = jourAvant(semaine, -7 * (s + 1))
      // Une semaine qui n'est pas finie ne se lit pas : sa part monterait encore jusqu'à dimanche.
      if (lundi >= cetteSemaine) return null
      return membres.filter(p => semainesJouees.get(p.id)?.has(lundi)).length
    })
    cohortes.push({ semaine, taille: membres.length, revenus })
  }
  return cohortes
}

// ── Les premiers pas d'un profil ────────────────────────────────────────────
//
// La revue d'analyse du 4 novembre 2026 (P1.2) : « le premier jour d'un
// profil, l'invité qui devient profil, la soirée qui nourrit le jeu seul ».
// Rien de neuf à lire : la feuille de présence, les profils et leur écran de
// naissance, et les fiches des soirées que le carnet des animateurs garde
// déjà (`animateursDuQg.ts`). Les écrans d'une soirée où un profil naît sont
// ceux de la mémoire du jour (`ORIGINES_EN_SOIREE`, plus haut).

/**
 * Ceux dont la soirée se sait : né à l'entrée ou entre deux quiz, un profil
 * joue la soirée même, et sa fiche le compte. Né à la fin, il l'a jouée sans
 * profil — sa fin l'envoie à l'accueil (`?creer=1`) — : elle ne le compte pas,
 * et la page ne la devine pas.
 */
export const ORIGINES_D_UNE_SOIREE: readonly OrigineLue[] = ['entree', 'soiree']

/**
 * L'écart d'une naissance à la soirée qui la compte : né à l'entrée, un profil
 * attend la première question, qui date la soirée ; né entre deux quiz, il la
 * suit de quelques heures. Au-delà, c'est une autre soirée.
 */
export const ECART_D_UNE_NAISSANCE_MS = 12 * 3_600_000

/** Les soirées closes que les premiers pas détaillent, une par une : celles de ces trente jours. */
export const JOURS_DES_SOIREES_QUI_CONVERTISSENT = 30

/** Les modes qu'on joue seul : tous sauf la soirée, en bits (`BIT_DU_MODE`). */
const MODES_SEULS = BIT_DU_MODE.campagne | BIT_DU_MODE.cabinet | BIT_DU_MODE.jour | BIT_DU_MODE.duel

/** Une soirée telle que les premiers pas la lisent : celle de la participation, et si elle se joue encore. */
export interface SoireeDesPremiersPas extends SoireeDesParticipations {
  ouverte?: boolean
}

/**
 * Où est né chaque profil né pendant une soirée (`ORIGINES_D_UNE_SOIREE`) : la
 * première soirée, dans l'ordre du temps, qui le compte parmi ses joueurs à
 * `ECART_D_UNE_NAISSANCE_MS` au plus de sa naissance. Rend les profils nés
 * pendant chaque soirée. Un profil né à l'entrée qui n'a pas joué une question
 * n'est d'aucune : la fiche ne compte que ceux qui ont joué.
 */
export function naissancesEnSoiree<S extends Pick<SoireeDesParticipations, 'quand' | 'profils'>>(
  soirees: readonly S[],
  profils: readonly Pick<ProfilDeLAudience, 'id' | 'cree' | 'origine'>[],
): Map<S, string[]> {
  const nes = new Map(profils.filter(p => p.origine !== null && ORIGINES_D_UNE_SOIREE.includes(p.origine)).map(p => [p.id, p.cree] as const))
  const nees = new Map<S, string[]>()
  if (nes.size === 0) return nees
  const places = new Set<string>()
  for (const s of [...soirees].sort((a, b) => a.quand - b.quand)) {
    for (const qui of new Set(s.profils ?? [])) {
      const cree = nes.get(qui)
      if (cree === undefined || places.has(qui) || Math.abs(s.quand - cree) > ECART_D_UNE_NAISSANCE_MS) continue
      places.add(qui)
      const siens = nees.get(s)
      if (siens) siens.push(qui)
      else nees.set(s, [qui])
    }
  }
  return nees
}

/** Combien, sur combien : sous vingt, la page dit « 4 sur 9 », jamais un pourcentage. */
export interface PartDesNes {
  n: number
  sur: number
}

/** Une part se dit en pour cent dès vingt : en deçà, trois sur cinq feraient « 60 % » d'une poignée. */
export const PART_EN_POURCENTS_DES = 20

/** « 4 sur 9 », « 45 % » dès vingt, « – » sur personne : une part du QG, écrite comme elle se lit. */
export function partEcrite(n: number, sur: number): string {
  if (sur === 0) return '–'
  // L'espace insécable du QG (`enPourcentsEcrits`) : « 45 » ne finit pas une ligne dont « % » ouvrirait la suivante.
  return sur < PART_EN_POURCENTS_DES ? `${formatNumber(n)} sur ${formatNumber(sur)}` : `${formatNumber(Math.round((n / sur) * 100))} %`
}

/**
 * Les premiers pas de profils nés ensemble — une semaine, un écran. Chaque
 * part ne compte que ceux dont le délai est passé : nés avant aujourd'hui pour
 * le jour même et « jamais », avant hier pour le lendemain, il y a sept jours
 * pour la première semaine — un profil né ce matin n'a encore rien manqué.
 */
export interface PasDesNes {
  nes: number
  jourMeme: PartDesNes
  lendemain: PartDesNes
  /** Deux jours de jeu ou plus leur première semaine — le jour de leur naissance et les six suivants. */
  deuxJours: PartDesNes
  /** Deux modes ou plus leur première semaine. */
  secondMode: PartDesNes
  /** Pas une partie depuis leur naissance. */
  jamais: PartDesNes
}

/** Ce qu'une soirée close a converti : ses invités, ceux venus avec un profil, ceux nés pendant elle, et ceux venus sans. */
export interface SoireeQuiConvertit {
  quand: number
  /** Ses invités qui ont joué. */
  invites: number
  /** Venus avec un profil qu'ils avaient déjà. */
  avecUnProfil: number
  /** Nés pendant elle — à son entrée, entre deux quiz. */
  nes: number
  /** Venus sans profil : ceux nés pendant elle, et ceux restés sans. */
  sansProfil: number
}

export interface PremiersPas {
  /** Les semaines de naissance — leur lundi —, la plus récente d'abord, celle en cours comprise. */
  semaines: string[]
  /** Tous les écrans d'abord (`tous`), puis chaque écran qui a des nés, le plus fréquent d'abord, ceux d'avant l'origine en dernier. */
  ecrans: { origine: OrigineLue | null | 'tous'; total: PasDesNes; parSemaine: PasDesNes[] }[]
  /** Le pont : les nés en soirée qui ont joué seuls — le quiz du jour, la campagne, le Cabinet, un duel — leur première semaine. */
  pont: PartDesNes
  /** Les soirées closes de ces trente jours, la plus récente d'abord. Une fiche qui ne dit pas ses profils n'y est pas. */
  soirees: SoireeQuiConvertit[]
}

const partVide = (): PartDesNes => ({ n: 0, sur: 0 })
const pasVides = (): PasDesNes => ({ nes: 0, jourMeme: partVide(), lendemain: partVide(), deuxJours: partVide(), secondMode: partVide(), jamais: partVide() })
/** Un « oui » ou un « non » de plus à une part : `null`, son délai n'est pas passé, elle ne compte pas. */
const compter = (part: PartDesNes, oui: boolean | null) => {
  if (oui === null) return
  part.sur++
  if (oui) part.n++
}
const nombreDeModes = (masque: number) => modesDuMasque(masque).length

/**
 * Les premiers pas des profils nés ces neuf semaines — celle en cours et les
 * huit d'avant, celles des cohortes —, semaine par semaine et écran par écran,
 * lus sur la feuille de présence ; le pont des nés en soirée ; et les soirées
 * closes de ces trente jours, soirée par soirée. Les suspendus restent : ce
 * qu'ils sont devenus n'efface pas leurs premiers pas.
 */
export function premiersPasDesProfils(
  profils: readonly ProfilDeLAudience[],
  presences: ReadonlyMap<string, readonly Presence[]>,
  soirees: readonly SoireeDesPremiersPas[],
  aujourdhui: string,
  maintenant: number,
): PremiersPas {
  const cetteSemaine = lundiDe(aujourdhui)
  const semaines = Array.from({ length: COHORTES_MONTREES + 1 }, (_, k) => jourAvant(cetteSemaine, 7 * k))
  const premiere = semaines[semaines.length - 1]
  const nes = profils.filter(p => p.cree <= maintenant && jourDe(p.cree) >= premiere)
  // Les jours de chacun, et leurs modes : la feuille ne garde que ceux où il a joué.
  const siens = new Set(nes.map(p => p.id))
  const joues = new Map<string, Map<string, number>>()
  for (const [jour, lignes] of presences) {
    for (const p of lignes) {
      if (!siens.has(p.qui)) continue
      let jours = joues.get(p.qui)
      if (!jours) joues.set(p.qui, (jours = new Map()))
      jours.set(jour, (jours.get(jour) ?? 0) | p.modes)
    }
  }
  const parEcran = new Map<OrigineLue | null | 'tous', { total: PasDesNes; parSemaine: PasDesNes[] }>()
  const pasDe = (origine: OrigineLue | null | 'tous') => {
    let e = parEcran.get(origine)
    if (!e) parEcran.set(origine, (e = { total: pasVides(), parSemaine: semaines.map(pasVides) }))
    return e
  }
  pasDe('tous')
  const pont = partVide()
  for (const p of nes) {
    const j0 = jourDe(p.cree)
    const jours = joues.get(p.id) ?? new Map<string, number>()
    const premiereSemaine = Array.from({ length: 7 }, (_, k) => jourAvant(j0, -k))
    const modesDeLaSemaine = premiereSemaine.reduce((m, j) => m | (jours.get(j) ?? 0), 0)
    const semaineFinie = jourAvant(j0, -6) < aujourdhui
    // Chaque pas, oui ou non — null, son délai n'est pas passé.
    const reponses: Record<Exclude<keyof PasDesNes, 'nes'>, boolean | null> = {
      jourMeme: j0 < aujourdhui ? jours.has(j0) : null,
      lendemain: jourAvant(j0, -1) < aujourdhui ? jours.has(jourAvant(j0, -1)) : null,
      deuxJours: semaineFinie ? premiereSemaine.filter(j => jours.has(j)).length >= 2 : null,
      secondMode: semaineFinie ? nombreDeModes(modesDeLaSemaine) >= 2 : null,
      jamais: j0 < aujourdhui ? jours.size === 0 : null,
    }
    const semaine = semaines.indexOf(lundiDe(j0))
    for (const origine of ['tous', p.origine] as const) {
      const e = pasDe(origine)
      for (const pas of [e.total, e.parSemaine[semaine]]) {
        pas.nes++
        for (const cle of Object.keys(reponses) as (keyof typeof reponses)[]) compter(pas[cle], reponses[cle])
      }
    }
    if (p.origine !== null && ORIGINES_EN_SOIREE.includes(p.origine) && semaineFinie) compter(pont, (modesDeLaSemaine & MODES_SEULS) !== 0)
  }
  const ecrans = [...parEcran]
    .map(([origine, e]) => ({ origine, ...e }))
    .sort(
      (a, b) =>
        Number(b.origine === 'tous') - Number(a.origine === 'tous') ||
        Number(a.origine === null) - Number(b.origine === null) ||
        b.total.nes - a.total.nes ||
        String(a.origine).localeCompare(String(b.origine)),
    )
  // Soirée par soirée : les closes de ces trente jours, chacune ce qu'elle a converti.
  const depuis = minuitDuJour(jourAvant(aujourdhui, JOURS_DES_SOIREES_QUI_CONVERTISSENT - 1))
  const nees = naissancesEnSoiree(soirees, profils)
  const closes = soirees
    .filter(s => !s.ouverte && s.profils !== undefined && s.quand >= depuis && s.quand <= maintenant)
    .sort((a, b) => b.quand - a.quand)
    .map(s => {
      const avec = new Set(s.profils).size
      const nesIci = nees.get(s)?.length ?? 0
      return { quand: s.quand, invites: s.joueurs, avecUnProfil: avec - nesIci, nes: nesIci, sansProfil: nesIci + Math.max(0, s.joueurs - avec) }
    })
  return { semaines, ecrans, pont, soirees: closes }
}

// ── Quand on joue, qui joue à quoi, d'où viennent les profils ────────────────

/** Le jour de la semaine d'un jour de Paris, du lundi (0) au dimanche (6). */
export function jourDeLaSemaineDuJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  return (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7
}

/**
 * Quand on joue : les participations des quatre dernières semaines finies,
 * jour de la semaine par heure de Paris — sept rangées de vingt-quatre
 * heures, chaque jour de la semaine quatre fois. `jours` : combien de jours la
 * mémoire en avait.
 */
export function heuresDeJeu(jours: ReadonlyMap<string, Pick<ChiffresDUnJour, 'heures'>>, aujourdhui: string): { grille: number[][]; jours: number } {
  const grille = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  let comptes = 0
  for (const jour of joursJusqua(jourAvant(aujourdhui), JOURS_DES_HEURES)) {
    const c = jours.get(jour)
    if (!c) continue
    comptes++
    const rangee = grille[jourDeLaSemaineDuJour(jour)]
    c.heures.forEach((n, h) => (rangee[h] += n))
  }
  return { grille, jours: comptes }
}

/** Une combinaison de modes et les profils qui la jouent : « le quiz du jour et la campagne, 18 profils ». */
export interface CombinaisonDeModes {
  modes: ModeDuQg[]
  profils: number
}

/**
 * Qui joue à quoi : les profils actifs ces trente jours, rangés par les modes
 * qu'ils ont joués — la plus courante d'abord ; au-delà des premières, les
 * autres ensemble, sous une combinaison vide (`modes: []`).
 */
export function combinaisonsDesModes(traces: ReadonlyMap<string, TraceDUnProfil>, montrees = COMBINAISONS_MONTREES): CombinaisonDeModes[] {
  const parMasque = new Map<number, number>()
  for (const t of traces.values()) parMasque.set(t.modes, (parMasque.get(t.modes) ?? 0) + 1)
  const rangees = [...parMasque].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const premieres = rangees.slice(0, montrees).map(([masque, profils]) => ({ modes: modesDuMasque(masque), profils }))
  const reste = rangees.slice(montrees).reduce((t, [, n]) => t + n, 0)
  return reste > 0 ? [...premieres, { modes: [], profils: reste }] : premieres
}

/** Le mode dans une phrase, et seul : « la campagne », « la campagne seule ». */
const LE_MODE: Record<ModeDuQg, string> = { soiree: 'les soirées', campagne: 'la campagne', cabinet: 'le Cabinet', jour: 'le quiz du jour', duel: 'les duels' }
const SEUL: Record<ModeDuQg, string> = { soiree: 'Les soirées seules', campagne: 'La campagne seule', cabinet: 'Le Cabinet seul', jour: 'Le quiz du jour seul', duel: 'Les duels seuls' }

/** Le nom d'une combinaison : « Le quiz du jour seul », « Le quiz du jour et la campagne », « Un peu de tout ». */
export function nomDeLaCombinaison(modes: readonly ModeDuQg[]): string {
  if (modes.length === 0) return 'Les autres combinaisons'
  if (modes.length === 1) return SEUL[modes[0]]
  if (modes.length === MODES_DU_QG.length) return 'Un peu de tout'
  const noms = modes.map(m => LE_MODE[m])
  const phrase = `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
  return phrase[0].toUpperCase() + phrase.slice(1)
}

/** L'écran où est né chaque profil, au QG : « Pendant une soirée », « Par le quiz du jour ». */
export const NOM_DE_L_ORIGINE: Record<OrigineLue, string> = {
  entree: 'À l’entrée d’une soirée',
  soiree: 'Pendant une soirée',
  'fin-de-soiree': 'À la fin d’une soirée',
  accueil: 'Sur l’accueil',
  jour: 'Par le quiz du jour',
  campagne: 'Par la campagne',
  duels: 'Par les duels',
  cabinet: 'Par le Cabinet de curiosités',
  salon: 'Pour ouvrir un salon',
  compte: 'Par un compte d’animateur',
  inconnue: 'Par une page d’avant, qui ne le disait pas',
}

/** Les profils d'avant la colonne : ils ne disent pas d'où ils viennent, et la page ne le devine pas. */
export const PROFILS_D_AVANT_L_ORIGINE = 'D’avant le 4 novembre 2026'

/** D'où viennent les profils nés depuis un instant : un compte par écran, le plus fréquent d'abord, ceux d'avant en dernier. */
export function originesDesProfils(profils: readonly ProfilDeLAudience[], depuis: number): { origine: OrigineLue | null; profils: number }[] {
  const parOrigine = new Map<OrigineLue | null, number>()
  for (const p of profils) if (p.cree >= depuis) parOrigine.set(p.origine, (parOrigine.get(p.origine) ?? 0) + 1)
  return [...parOrigine]
    .map(([origine, n]) => ({ origine, profils: n }))
    .sort((a, b) => Number(a.origine === null) - Number(b.origine === null) || b.profils - a.profils || String(a.origine).localeCompare(String(b.origine)))
}

// ── La page ─────────────────────────────────────────────────────────────────

/** Un membre d'un segment tel que la page le montre : de quoi le reconnaître et ouvrir sa fiche, et où il en est. */
export interface MembreMontre extends MembreDUnSegment {
  nom: string
  login: string
}

export interface SegmentMontre {
  segment: SegmentDuQg
  profils: number
  /** Les premiers, dans l'ordre du segment (`PROFILS_D_UN_SEGMENT`). */
  montres: MembreMontre[]
}

/** Un jour du graphique des joueurs : du jour, de la semaine, du mois — aujourd'hui entamé, en dernier. */
export interface ActifsDUnJour {
  jour: string
  profils: number
  semaine: number
  mois: number
}

export interface PageDesJoueurs {
  maintenant: number
  /** Le premier jour que la mémoire sait : les journaux ne remontent pas plus loin. Null tant que personne n'a joué. */
  depuis: string | null
  /** Les profils qui ont joué aujourd'hui (comparé aux sept jours d'avant à la même minute), ces sept jours, ces trente jours, et la fidélité. */
  actifs: { jour: ChiffreEtAvant; semaine: ChiffreEtAvant; mois: ChiffreEtAvant; fidelite: { valeur: number | null; avant: number | null } }
  parJour: ActifsDUnJour[]
  /** Les profils nés ces trente jours, et les trente d'avant. */
  nouveaux: ChiffreEtAvant
  /** Les invités sans profil venus en soirée ces trente jours, et les trente d'avant. */
  invites: ChiffreEtAvant
  cohortes: CohorteDuQg[]
  segments: SegmentMontre[]
  heures: { grille: number[][]; jours: number }
  combinaisons: CombinaisonDeModes[]
  /** Les profils actifs ces trente jours : ce que les combinaisons se partagent. */
  profilsActifs: number
  origines: { origine: OrigineLue | null; profils: number }[]
  /** Leurs premiers pas, semaine par semaine et écran par écran, le pont des nés en soirée, et ce que chaque soirée close a converti. */
  premiersPas: PremiersPas
}

/** Les segments, comptés seulement : ce que la page des annonces propose, à côté de « tous ». */
export interface ComptesDesSegments {
  maintenant: number
  comptes: Record<SegmentDuQg, number>
}

/** La page telle que le calcul la rend : les membres des segments pas encore nommés — la route lit leurs prénoms. */
export type PageDesJoueursSansNoms = Omit<PageDesJoueurs, 'segments'> & { segments: { segment: SegmentDuQg; profils: number; montres: MembreDUnSegment[] }[] }

/** Ce que le serveur a lu pour la page : les feuilles et les jours gardés, aujourd'hui relu de ses journaux, tous les profils. */
export interface DonneesDeLaPage {
  maintenant: number
  /** Les feuilles de présence des jours finis gardés, et celle d'aujourd'hui, entamée. */
  presences: ReadonlyMap<string, readonly Presence[]>
  /** Les chiffres des jours finis gardés (`qg_jours`). */
  jours: ReadonlyMap<string, ChiffresDUnJour>
  /** Le premier jour que la mémoire sait ; null tant qu'elle ne sait rien. */
  depuis: string | null
  profils: readonly ProfilDeLAudience[]
  /** Les invités sans profil venus en soirée aujourd'hui. */
  invitesDuJour: number
  /** Les soirées des premiers pas — celles que le carnet des animateurs garde —, sans leur espace : la page n'en nomme aucun. */
  soirees?: readonly SoireeDesPremiersPas[]
}

/**
 * La page des joueurs, une étape par tranche : les joueurs du jour, de la
 * semaine et du mois — chacun comparé à la même fenêtre arrêtée au même
 * instant une semaine ou un mois plus tôt —, la fidélité, quatre-vingt-dix
 * jours jour par jour, les nouveaux profils et les invités sans profil de ces
 * trente jours, les segments, les cohortes, quand on joue, qui joue à quoi,
 * d'où viennent les profils. Ce que la mémoire ne sait pas encore ne se compare
 * pas (`avant: null`).
 */
export function* calculDeLaPage(d: DonneesDeLaPage): CalculEnTranches<PageDesJoueursSansNoms> {
  const minuit = minuitDe(d.maintenant)
  const aujourdhui = jourDe(d.maintenant)
  const hier = jourAvant(aujourdhui)
  const minute = Math.floor((d.maintenant - minuit) / 60_000)
  const depuis = d.depuis ?? aujourdhui
  const actifs = {
    jour: joueursDuJourALHeure(d.presences, aujourdhui, minute, depuis),
    semaine: { valeur: actifsALaMinute(d.presences, aujourdhui, 7, Infinity, '') ?? 0, avant: actifsALaMinute(d.presences, jourAvant(aujourdhui, 7), 7, minute, depuis) },
    mois: { valeur: actifsALaMinute(d.presences, aujourdhui, 30, Infinity, '') ?? 0, avant: actifsALaMinute(d.presences, jourAvant(aujourdhui, 30), 30, minute, depuis) },
    fidelite: { valeur: fideliteAuSoir(d.jours, hier), avant: fideliteAuSoir(d.jours, jourAvant(hier, 30)) },
  }
  yield
  const parJour: ActifsDUnJour[] = []
  for (const jour of joursJusqua(hier, JOURS_DU_GRAPHE_DES_ACTIFS - 1)) {
    const c = d.jours.get(jour)
    if (c) parJour.push({ jour, profils: c.profils, semaine: c.semaine, mois: c.mois })
  }
  parJour.push({ jour: aujourdhui, profils: d.presences.get(aujourdhui)?.length ?? 0, semaine: actifs.semaine.valeur, mois: actifs.mois.valeur })
  const debutDuMois = minuitDuJour(jourAvant(aujourdhui, 29))
  const debutDuMoisDAvant = minuitDuJour(jourAvant(aujourdhui, 59))
  const nouveaux = {
    valeur: d.profils.filter(p => p.cree >= debutDuMois && p.cree <= d.maintenant).length,
    avant: d.profils.filter(p => p.cree >= debutDuMoisDAvant && p.cree < debutDuMois).length,
  }
  const invitesDe = (jours: readonly string[]) => jours.reduce((t, j) => t + (d.jours.get(j)?.invites ?? 0), 0)
  const moisDAvant = joursJusqua(jourAvant(aujourdhui, 30), 30)
  const invites = {
    valeur: invitesDe(joursJusqua(hier, 29)) + d.invitesDuJour,
    avant: moisDAvant.every(j => d.jours.has(j)) ? invitesDe(moisDAvant) : null,
  }
  yield
  const traces = tracesDesTrenteJours(d.presences, aujourdhui)
  yield
  const parSegment = segmentsDesProfils(d.profils, traces, aujourdhui)
  const segments = SEGMENTS.map(segment => ({ segment, profils: parSegment[segment].length, montres: parSegment[segment].slice(0, PROFILS_D_UN_SEGMENT) }))
  yield
  const cohortes = cohortesDesProfils(d.profils, d.presences, aujourdhui)
  yield
  const premiersPas = premiersPasDesProfils(d.profils, d.presences, d.soirees ?? [], aujourdhui, d.maintenant)
  yield
  return {
    maintenant: d.maintenant,
    depuis: d.depuis,
    actifs,
    parJour,
    nouveaux,
    invites,
    cohortes,
    segments,
    heures: heuresDeJeu(d.jours, aujourdhui),
    combinaisons: combinaisonsDesModes(traces),
    profilsActifs: traces.size,
    origines: originesDesProfils(d.profils, debutDuMois),
    premiersPas,
  }
}

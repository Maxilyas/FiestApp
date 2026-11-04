import { PerformanceObserver, performance } from 'node:perf_hooks'
import type { CeQuiTournait, GelDeLaBoucle } from '../../../shared/santeDuServeur'

// Ce qui gèle la boucle. Le relevé de l'heure disait le pire gel de chaque
// heure (`Charge`, `core/pouls.ts`), pas ce qui tournait pendant : 2,9 s le
// 31 octobre 2026, pendant une soirée de vingt invités, et rien pour dire si
// c'était l'une des mille requêtes de l'heure, un calcul de fond ou le
// ramasse-miettes. Au dixième de cœur de l'hébergeur, un calcul de cent
// millisecondes fige le serveur une seconde, toutes soirées comprises — le
// banc dit lesquels (`retours/2026-10-16/reproductions/banc-gel.ts`), la
// production seule dit lesquels arrivent vraiment.
//
// Deux pièces. Le registre de ce qui tourne (`commencer`, `enFond`), que les
// portes du serveur nourrissent : chaque requête sous le modèle de sa route,
// chaque message du temps réel (`ecouter`), chaque chronomètre d'une partie,
// et le travail de fond. Et la sonde (`SondeDesGels`), une minuterie dont le
// retard au réveil est le gel : au-delà d'une demi-seconde, elle relève ce
// qui tournait pendant, ce que le processus a pris de processeur et ce que
// le ramasse-miettes a pris de temps. Ce qui tournait n'est pas un coupable :
// quatre accueils de front ont gelé ensemble ; ce qui revient le plus souvent
// est à regarder d'abord. Rien d'un joueur n'y entre : des modèles de route,
// des noms d'événements, des noms de tâches.

/** Un gel se relève au-delà : en dessous, c'est le pas de la boucle au dixième de cœur — un calcul de quelques millisecondes que l'hébergeur étire. */
export const SEUIL_D_UN_GEL_MS = 500
/** Le pas de la sonde : son retard au réveil, c'est le gel. Dix réveils par seconde, quelques microsecondes chacun. */
const PAS_DE_LA_SONDE_MS = 100
/** Ce qui a fini se garde le temps qu'un gel qui l'a peut-être croisé se relève — la sonde le relève au tour d'après. */
const FINIES_GARDEES_MS = 5_000
/** Ce qui ne finit jamais — une porte qui oublierait de dire sa fin — ne se garde pas au-delà : il serait de tous les gels. */
const EN_COURS_AU_PLUS_MS = 15 * 60_000
/** Au-delà, le registre ne grandit plus : une fuite ne remplirait pas la mémoire. */
const EN_COURS_AU_PLUS = 2_000
/** Ce qu'un gel nomme, au plus : ceux qui l'ont couvert le plus longtemps d'abord. */
export const EN_COURS_D_UN_GEL = 12

interface Tache {
  /** Lu à la fin — le modèle de la route n'est connu qu'une fois la route trouvée —, puis gardé en texte : la requête ne reste pas en mémoire. */
  quoi: string | (() => string)
  debut: number
  fin: number | null
}

const enCours = new Set<Tache>()
/** Rangées par leur fin. */
const finies: Tache[] = []

const lire = (t: Tache): string => {
  if (typeof t.quoi === 'string') return t.quoi
  try {
    return t.quoi()
  } catch {
    return 'inconnu'
  }
}

function ouvrir(quoi: string | (() => string)): Tache {
  const t: Tache = { quoi, debut: performance.now(), fin: null }
  enCours.add(t)
  if (enCours.size > EN_COURS_AU_PLUS) enCours.delete(enCours.values().next().value!)
  return t
}

function fermer(t: Tache) {
  if (t.fin !== null) return
  t.fin = performance.now()
  t.quoi = lire(t)
  if (enCours.delete(t)) finies.push(t)
}

/**
 * Quelque chose commence à tourner, sous ce nom — un modèle de route, un
 * événement, une tâche ; jamais une adresse ni un identifiant. Rend sa fin,
 * qu'on peut appeler plusieurs fois : la première compte.
 */
export function commencer(quoi: string | (() => string)): () => void {
  const t = ouvrir(quoi)
  return () => fermer(t)
}

/** Une tâche de fond qui peut attendre sans tourner : en pause, elle n'est d'aucun gel. */
export interface TacheDeFond {
  suspendre(): void
  reprendre(): void
  finir(): void
}

/**
 * Le travail de fond, sous ce nom, qui se met en pause quand il attend la
 * salle (`laisserPasserLaSalle`) : compté pendant, il aurait été de tous les
 * gels d'une soirée sans y prendre une milliseconde.
 */
export function suivre(quoi: string): TacheDeFond {
  let t: Tache | null = ouvrir(quoi)
  let finie = false
  return {
    suspendre() {
      if (t) fermer(t)
      t = null
    },
    reprendre() {
      if (!finie && !t) t = ouvrir(quoi)
    },
    finir() {
      finie = true
      if (t) fermer(t)
      t = null
    },
  }
}

/** Le travail de fond, du départ jusqu'à son issue, sous ce nom. */
export function enFond<T>(quoi: string, travail: Promise<T>): Promise<T> {
  const fin = commencer(quoi)
  travail.then(fin, fin)
  return travail
}

/**
 * Une étape d'une requête qui attend — une écriture et ce qu'elle range —,
 * sous ce nom jusqu'à son issue : `enFond`, sur le chemin d'une réponse.
 */
export const pendant = enFond

/**
 * Un calcul d'un seul tenant, sous ce nom, le temps qu'il tourne. Dans une
 * requête, il dit laquelle de ses étapes a gelé : le 4 novembre 2026, la
 * production relevait 1,5 s sous `POST /api/cabinet/traversee/:id/geste`,
 * sans rien pour dire si c'était le tirage, la conclusion ou ses trophées.
 */
export function sousLeNom<T>(quoi: string, calcul: () => T): T {
  const fin = commencer(quoi)
  try {
    return calcul()
  } finally {
    fin()
  }
}

/**
 * Ce qui a tourné entre ces deux instants (`performance.now()`), chaque nom
 * une fois avec son nombre : ce qui a couvert le plus longtemps la fenêtre
 * d'abord, `EN_COURS_D_UN_GEL` au plus.
 */
export function ceQuiTournait(debut: number, fin: number): CeQuiTournait[] {
  const parNom = new Map<string, { n: number; couvert: number }>()
  const compter = (t: Tache) => {
    const de = Math.max(debut, t.debut)
    const a = Math.min(fin, t.fin ?? fin)
    if (a < de) return
    const nom = lire(t)
    const avant = parNom.get(nom)
    if (avant) {
      avant.n++
      avant.couvert = Math.max(avant.couvert, a - de)
    } else parNom.set(nom, { n: 1, couvert: a - de })
  }
  for (const t of enCours) if (t.debut <= fin) compter(t)
  for (let i = finies.length - 1; i >= 0 && finies[i].fin! >= debut; i--) compter(finies[i])
  return [...parNom]
    .sort((a, b) => b[1].couvert - a[1].couvert || (a[0] < b[0] ? -1 : 1))
    .slice(0, EN_COURS_D_UN_GEL)
    .map(([quoi, { n }]) => ({ quoi, n }))
}

/** Oublie ce qui a fini avant `avant`, et ce qui tourne depuis trop longtemps pour être vrai. */
function elaguer(avant: number, maintenant: number) {
  let i = 0
  while (i < finies.length && finies[i].fin! < avant) i++
  if (i > 0) finies.splice(0, i)
  for (const t of enCours) {
    if (maintenant - t.debut < EN_COURS_AU_PLUS_MS) break
    enCours.delete(t)
  }
}

/**
 * La sonde : une minuterie qui se réveille tous les dixièmes de seconde, et
 * dont le retard est le gel. Un gel se relève au tour d'après : le
 * ramasse-miettes dit ses pauses un peu plus tard qu'elles n'ont eu lieu.
 */
export class SondeDesGels {
  private readonly seuilMs: number
  private minuterie: ReturnType<typeof setInterval>
  private dernier = performance.now()
  private cpu = process.cpuUsage()
  private enAttente: { debut: number; fin: number; dureeMs: number; processeurMs: number }[] = []
  /** Les pauses du ramasse-miettes des dernières secondes, rangées par leur fin. */
  private pauses: { debut: number; fin: number }[] = []
  private observateur: PerformanceObserver | null = null

  constructor(
    private readonly noter: (gel: GelDeLaBoucle) => void,
    { seuilMs = SEUIL_D_UN_GEL_MS }: { seuilMs?: number } = {},
  ) {
    this.seuilMs = seuilMs
    try {
      this.observateur = new PerformanceObserver(liste => {
        for (const e of liste.getEntries()) this.pauses.push({ debut: e.startTime, fin: e.startTime + e.duration })
      })
      this.observateur.observe({ entryTypes: ['gc'] })
    } catch {
      // Sans ses pauses, les gels se relèvent quand même.
      this.observateur = null
    }
    this.minuterie = setInterval(() => this.tour(), PAS_DE_LA_SONDE_MS)
    this.minuterie.unref()
  }

  private tour() {
    const maintenant = performance.now()
    const cpu = process.cpuUsage(this.cpu)
    this.cpu = process.cpuUsage()
    // Ceux du tour d'avant : leurs pauses du ramasse-miettes sont arrivées.
    for (const g of this.enAttente.splice(0)) this.relever(g)
    const retard = maintenant - this.dernier - PAS_DE_LA_SONDE_MS
    if (retard >= this.seuilMs) {
      // La fenêtre part du réveil d'avant : le gel a commencé entre les deux.
      this.enAttente.push({ debut: this.dernier, fin: maintenant, dureeMs: retard, processeurMs: (cpu.user + cpu.system) / 1000 })
    }
    this.dernier = maintenant
    const garde = Math.min(maintenant - FINIES_GARDEES_MS, ...this.enAttente.map(g => g.debut))
    elaguer(garde, maintenant)
    let i = 0
    while (i < this.pauses.length && this.pauses[i].fin < garde) i++
    if (i > 0) this.pauses.splice(0, i)
  }

  private relever(g: { debut: number; fin: number; dureeMs: number; processeurMs: number }) {
    let ramasseMiettes = 0
    for (const p of this.pauses) ramasseMiettes += Math.max(0, Math.min(g.fin, p.fin) - Math.max(g.debut, p.debut))
    try {
      this.noter({
        a: Date.now() - (performance.now() - g.fin),
        dureeMs: Math.round(g.dureeMs),
        processeurMs: Math.round(g.processeurMs),
        ramasseMiettesMs: Math.round(ramasseMiettes),
        enCours: ceQuiTournait(g.debut, g.fin),
      })
    } catch (e) {
      console.error('[gels] un gel n’a pas pu se relever :', e)
    }
  }

  arreter() {
    clearInterval(this.minuterie)
    this.observateur?.disconnect()
  }
}

import type { DuelJoue } from '../../../shared/duels'

// Le journal des duels classés de tout le monde, gardé en mémoire.
//
// La cote de chacun se relit de tous ses duels à chaque lecture
// (`releverLesDuels`) : relu de la base, ce journal faisait 13 % du quota de
// Turso le 23 octobre 2026 — chaque dé, chaque page des duels, chaque solde
// de confettis relisait toute l'histoire du joueur (849 lignes pour le plus
// fidèle), et le classement celle de tous (4 038), toutes les dix minutes et
// après chaque duel fini. Tous ensemble coûtent à peine cinq fois un seul
// joueur : le serveur les lit une fois, puis seulement ce qui bouge.
//
// Ce qui bouge, il le relit par sa clé (`DuelsARelire`) : une rencontre ou un
// duel classé qu'une réponse vient de finir, dans le lot qui l'écrit ; un
// duel classé fermé depuis la dernière lecture — ses tentatives commencées
// comptent alors, sans que rien ne s'écrive (`fermes`) ; et les séries
// arrivées depuis la plus grande qu'il a vue (`seriesVues`, leur `rowid`), à
// chaque lecture, comme le journal des réponses — ce qui s'est écrit sans lui
// passer par les mains, ailleurs ou à la main, y paraît aussitôt.
//
// Une ligne ne fait qu'arriver : une rencontre finie, ou les deux tentatives
// d'un duel classé, finies ou commencées à sa fermeture — et elle ne bouge
// plus, une tentative ne recevant plus de réponse quand son duel a fermé (la
// fermeture d'un défi, `fermerLeDuel`, ne pose que la fin que sa ligne lisait
// déjà, `COALESCE(finie_le, ferme_le)`). Une relecture ne retire donc rien
// (`ranger`) : deux lectures du même duel arrivées dans le désordre — ses deux
// joueurs finissent ensemble — ne le font pas disparaître. Seule la
// suppression d'un profil en retire, et le journal repart alors de zéro. Une
// série finie ailleurs qu'ici — l'ancien serveur, le temps d'une mise en
// ligne — attend la relecture d'ensemble (`JOURNAL_DES_DUELS_RELU_MS`).

/** Une ligne du journal : une rencontre finie (sans duel), ou sa tentative d'un duel classé joué des deux côtés (son code). */
export interface LigneDuJournalDesDuels {
  qui: string
  duel: string | null
  joue: DuelJoue
}

/**
 * Ce qu'une lecture ciblée relit : une rencontre qui vient de finir, des
 * duels classés qui viennent de bouger, ou ce qui est arrivé depuis une série
 * (son `rowid`).
 */
export type DuelsARelire = { rencontre: string } | { duels: readonly string[] } | { apres: number }

/** Dans l'ordre du journal (`ORDER BY finie_le, id`) : la cote se relève duel après duel. */
const dansLOrdre = (a: DuelJoue, b: DuelJoue) => a.finiLe - b.finiLe || (a.serie < b.serie ? -1 : a.serie > b.serie ? 1 : 0)

export class JournalDesDuels {
  /** Lu en entier : avant, rien de ce qu'il dit ne vaut. */
  charge = false
  /** Quand il l'a été. */
  luLe = 0
  /** Quand sa dernière lecture — en entier, ou de ce qui est arrivé — est partie. */
  rattrapeLe = 0
  /** Monte à chaque ligne qui change : ce qu'on en a tiré — les cotes de tous — se refait. */
  version = 0
  /** La plus grande série (`rowid`) qu'il a vue : la lecture suivante part de là. */
  seriesVues = 0
  /**
   * Le numéro de la dernière lecture qu'il a reçue (chaque lecture en prend un
   * en partant, `CampagneStore.lecturesDesDuels`) : tout ce qui était écrit
   * avant qu'elle parte, il le sait.
   */
  fraisDepuis = 0
  private readonly lignes = new Map<string, LigneDuJournalDesDuels>()
  private readonly parProfil = new Map<string, Map<string, LigneDuJournalDesDuels>>()
  /** Ses duels dans l'ordre du journal, gardés tant qu'aucune de ses lignes ne change. */
  private readonly ranges = new Map<string, DuelJoue[]>()
  /** Les duels classés encore ouverts, et quand ils ferment : fermés, leurs tentatives commencées comptent. */
  private readonly ouverts = new Map<string, number>()

  /** Tout le journal (`lectureDesDuels(null)`), lu à `le` par la lecture `numero`, jusqu'à la série `seriesVues`, et les duels classés ouverts alors. */
  charger(lignes: readonly LigneDuJournalDesDuels[], ouverts: Iterable<readonly [string, number]>, le: number, seriesVues: number, numero: number): void {
    for (const l of lignes) this.ajouter(l)
    for (const [code, fermeLe] of ouverts) this.ouverts.set(code, fermeLe)
    this.luLe = le
    this.rattrapeLe = le
    this.seriesVues = seriesVues
    this.fraisDepuis = numero
    this.charge = true
    this.version++
  }

  /**
   * Ce qu'une lecture ciblée vient de rendre (`DuelsARelire`) : chaque ligne
   * arrive, ou remplace la sienne — rien ne part (plus haut).
   */
  ranger(lignes: readonly LigneDuJournalDesDuels[]): void {
    if (lignes.length === 0) return
    for (const l of lignes) this.ajouter(l)
    this.version++
  }

  /**
   * Ce qui est arrivé depuis `seriesVues` (`{ apres }`), lu par la lecture
   * `numero`, partie à `le` : ses lignes, les duels classés encore ouverts
   * qu'elle a croisés, et la plus grande série d'alors.
   */
  rattraper(lignes: readonly LigneDuJournalDesDuels[], ouverts: Iterable<readonly [string, number]>, seriesVues: number, numero: number, le: number): void {
    this.ranger(lignes)
    for (const [code, fermeLe] of ouverts) this.ouverts.set(code, fermeLe)
    if (seriesVues > this.seriesVues) this.seriesVues = seriesVues
    if (numero > this.fraisDepuis) this.fraisDepuis = numero
    if (le > this.rattrapeLe) this.rattrapeLe = le
  }

  /** Un duel classé lancé, ou dont la fermeture est avancée (`annulerUnDuel`) : à sa fermeture, ses lignes se relisent. */
  ouvrir(code: string, fermeLe: number): void {
    this.ouverts.set(code, fermeLe)
  }

  /**
   * Les duels ouverts qu'un journal d'avant connaissait : lancé pendant la
   * lecture qui le remplace, un duel n'était peut-être pas dans la sienne.
   * Relu à sa fermeture sans rien à relire, il ne coûte qu'un aller-retour.
   */
  reprendreLesOuverts(avant: JournalDesDuels): void {
    for (const [code, fermeLe] of avant.ouverts) if (!this.ouverts.has(code)) this.ouverts.set(code, fermeLe)
  }

  /** Les duels classés fermés à `maintenant` depuis la dernière fois : leurs lignes sont à relire. Ils ne sont plus ouverts. */
  fermes(maintenant: number): string[] {
    const fermes: string[] = []
    for (const [code, fermeLe] of this.ouverts) {
      if (fermeLe > maintenant) continue
      fermes.push(code)
      this.ouverts.delete(code)
    }
    return fermes
  }

  /** Ses duels classés finis, dans l'ordre du journal — ce que `duelsLus` rendait de ses lignes. */
  duelsDe(qui: string): readonly DuelJoue[] {
    let ranges = this.ranges.get(qui)
    if (!ranges) {
      ranges = [...(this.parProfil.get(qui)?.values() ?? [])].map(l => l.joue).sort(dansLOrdre)
      this.ranges.set(qui, ranges)
    }
    return ranges
  }

  /** Ceux qui ont au moins un duel classé fini. */
  joueurs(): string[] {
    return [...this.parProfil.keys()]
  }

  private ajouter(l: LigneDuJournalDesDuels) {
    this.retirer(l.joue.serie)
    this.lignes.set(l.joue.serie, l)
    let siennes = this.parProfil.get(l.qui)
    if (!siennes) this.parProfil.set(l.qui, (siennes = new Map()))
    siennes.set(l.joue.serie, l)
    this.ranges.delete(l.qui)
  }

  private retirer(serie: string) {
    const l = this.lignes.get(serie)
    if (!l) return
    this.lignes.delete(serie)
    const siennes = this.parProfil.get(l.qui)
    siennes?.delete(serie)
    if (siennes?.size === 0) this.parProfil.delete(l.qui)
    this.ranges.delete(l.qui)
  }
}

// Ce qu'une page relit d'un joueur et que seuls ses propres gestes changent,
// gardé en mémoire entre deux visites.
//
// L'accueil relisait à chaque visite ses épreuves de sentier validées et ses
// bonnes réponses du quiz du jour sur trente jours — 186 et 387 lignes, les
// deux plus grosses lectures de chaque accueil de la production, 14 % de ce
// qu'elle lisait au quota de Turso (le relevé de l'heure de la version du
// 3 novembre 2026). Rien n'y bougeait d'une visite à l'autre tant qu'il ne
// jouait pas : chaque écriture qui peut les changer les oublie (`oublier`).
//
// Une lecture partie avant l'écriture qui l'oublie ne s'installe pas après
// elle (la génération) : elle rendrait l'état d'avant à la visite suivante.
// Et rien ne se garde plus de `fraicheurMs` : l'autre serveur d'une mise en
// ligne écrit sans prévenir celui-ci. Zéro ne garde rien — le banc, dont les
// épreuves écrivent dans la base à la main entre deux requêtes.
//
// Ce qui se garde n'est pas la ligne du client de la base, qui porte chaque
// colonne deux fois — par son nom et par son rang —, mais ce que la page en
// tire (`depuisLesLignes`) : une poignée de nombres par ligne. Et seules les
// visites de la dernière fraîcheur restent en mémoire : la plus ancienne part
// à chaque arrivée, et `TENUES_AU_PLUS` borne le reste.
import type { InStatement, ResultSet, Row } from '@libsql/client'

/**
 * Combien de temps une lecture gardée se croit à jour de ce qui s'écrit sans
 * ce serveur : l'autre serveur d'une mise en ligne, le temps qu'il s'éteigne.
 * Ce que ce serveur écrit, elle l'apprend sur-le-champ (`oublier`).
 */
export const LECTURES_GARDEES_MS = 10 * 60_000

/** Combien de joueurs se tiennent au plus : au-delà, le plus anciennement lu part. */
export const TENUES_AU_PLUS = 2000

/** Une instruction qui ne lit rien : elle garde sa place dans un lot, et ses voisines la leur. */
const RIEN_A_LIRE: InStatement = { sql: 'SELECT 1 WHERE 0', args: [] }

/** Une lecture prise dans un lot : l'instruction à y mettre, et ce qu'on lit de ce qu'elle rend. */
export interface LectureDansUnLot<T> {
  instruction: InStatement
  lue(lu: ResultSet): T
}

/** Ce que rend une lecture qui n'a rien lu : ce qu'on tient se rend sans elle. */
const RIEN_DE_LU = { rows: [] } as unknown as ResultSet

export class LecturesGardees<T> {
  private gardees = new Map<string, { valeur: T; variante: string; le: number }>()
  private generations = new Map<string, number>()
  /** Monte quand tout s'oublie d'un coup (`oublierTout`) : une lecture partie avant ne s'installe pas. */
  private generationDeTous = 0

  constructor(
    private readonly fraicheurMs: number,
    private readonly maintenant: () => number,
    private readonly depuisLesLignes: (lignes: readonly Row[]) => T,
    private readonly auPlus = TENUES_AU_PLUS,
  ) {}

  /**
   * La lecture de `cle` dans un lot : rien à lire si on la tient encore,
   * sinon `lecture`, dont ce qu'on tire se garde — si rien ne l'a oubliée
   * pendant l'aller-retour. `variante` dit ce que la lecture a d'autre que sa
   * clé — la semaine que lisent les missions — : une autre ne la tient pas, et
   * la remplace (une par clé : l'ancienne ne servirait plus).
   */
  dans(cle: string, lecture: InStatement, variante = ''): LectureDansUnLot<T> {
    const maintenant = this.maintenant()
    const gardee = this.gardees.get(cle)
    if (gardee && gardee.variante === variante && maintenant - gardee.le < this.fraicheurMs) return { instruction: RIEN_A_LIRE, lue: () => gardee.valeur }
    const generation = this.generations.get(cle) ?? 0
    const deTous = this.generationDeTous
    return {
      instruction: lecture,
      lue: lu => {
        const valeur = this.depuisLesLignes(lu.rows)
        if (this.fraicheurMs > 0 && this.generationDeTous === deTous && (this.generations.get(cle) ?? 0) === generation) this.garder(cle, variante, valeur, maintenant)
        return valeur
      },
    }
  }

  /** Une lecture seule (`dans`), hors d'un lot : tenue, elle ne fait pas d'aller-retour du tout. */
  async lire(cle: string, lecture: InStatement, executer: (lecture: InStatement) => Promise<ResultSet>, variante = ''): Promise<T> {
    const l = this.dans(cle, lecture, variante)
    return l.lue(l.instruction === RIEN_A_LIRE ? RIEN_DE_LU : await executer(l.instruction))
  }

  /** Ce qu'une écriture vient de changer : la prochaine lecture le relit, et celle déjà en route ne le gardera pas. */
  oublier(cle: string): void {
    this.gardees.delete(cle)
    this.generations.set(cle, (this.generations.get(cle) ?? 0) + 1)
  }

  /** Ce qu'une écriture vient de changer pour tous — un tirage du jour corrigé, une question annulée. */
  oublierTout(): void {
    this.gardees.clear()
    this.generationDeTous++
  }

  /** Le nombre de lectures tenues. */
  get tenues(): number {
    return this.gardees.size
  }

  private garder(cle: string, variante: string, valeur: T, le: number): void {
    // Retirée puis remise, elle passe en dernier : la carte reste rangée de la
    // plus anciennement lue à la plus récente, et ce qui a vieilli est devant.
    this.gardees.delete(cle)
    this.gardees.set(cle, { valeur, variante, le })
    const perimee = this.maintenant() - this.fraicheurMs
    for (const [autre, g] of this.gardees) {
      if (this.gardees.size <= this.auPlus && g.le > perimee) break
      this.gardees.delete(autre)
    }
  }
}

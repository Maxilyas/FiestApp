import { clientDistant, type Client } from './distante'
import { minuitDe } from '../../../shared/qg'
import { lireLeServeurDUnJour, type ChiffresDUnJour, type JourDeLaMemoire, type Presence } from '../../../shared/qgJoueurs'
import type { ServeurDUnJour } from '../../../shared/santeDuServeur'

/**
 * La mémoire du QG dans la base permanente (le lot 6 du QG 2, le 4 novembre
 * 2026, `shared/qgJoueurs.ts`) : la feuille de présence (`qg_presences`, une
 * ligne par profil et par jour de Paris) et la mémoire longue (`qg_jours`, les
 * chiffres de chaque jour fini). Ce magasin les écrit et les lit, rien de plus
 * : ce qu'elles disent se dérive des journaux ailleurs (`joueursDuQg.ts`), et
 * s'y refait d'elles — elles ne sont que leur reflet, gardé pour ne pas les
 * relire.
 *
 * Bornées : un an de jours (`JOURS_DE_LA_MEMOIRE`), une centaine de lignes de
 * présence par jour en production ; chaque écriture efface ce qui a passé
 * l'an.
 */
export class MemoireDuQg {
  private client: Client
  /** Les rattrapages en cours : un profil supprimé pendant l'un d'eux est retenu ici. */
  private rattrapages = 0
  /**
   * Les profils supprimés pendant un rattrapage : il a lu leurs journaux
   * avant, et ses écritures d'après les auraient fait revivre dans la feuille
   * — une ligne sans maître, que la suppression devait emporter.
   */
  private oublies = new Set<string>()

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  /** Ses deux tables, d'un lot, au démarrage de front (`deFront`, `server.ts`). */
  async init() {
    await this.client.batch(
      [
        // La clé par le jour d'abord : la page lit les feuilles depuis un jour ; la suppression d'un profil, par son index.
        `CREATE TABLE IF NOT EXISTS qg_presences (
           jour       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           modes      INTEGER NOT NULL,
           premiere   INTEGER NOT NULL,
           PRIMARY KEY (jour, profile_id)
         )`,
        'CREATE INDEX IF NOT EXISTS idx_qg_presences_profil ON qg_presences(profile_id)',
        `CREATE TABLE IF NOT EXISTS qg_jours (
           jour     TEXT PRIMARY KEY,
           chiffres TEXT NOT NULL,
           ecrit_le INTEGER NOT NULL
         )`,
      ],
      'write',
    )
  }

  /** Le dernier jour écrit, et la version des dérivations qui l'a écrit ; null tant que rien ne l'est. */
  async dernierJour(): Promise<{ jour: string; version: number } | null> {
    const res = await this.client.execute(`SELECT jour, json_extract(chiffres, '$.v') AS v FROM qg_jours ORDER BY jour DESC LIMIT 1`)
    const r = res.rows[0]
    return r ? { jour: String(r.jour), version: Number(r.v ?? 0) } : null
  }

  /**
   * Le premier instant que les journaux savent : la plus ancienne partie du
   * jour, série, soirée créditée ou rangée, inscription — chacune par l'index
   * de sa date, une ligne chacune. Le premier remplissage part de là ; null
   * sur une base où rien n'a encore eu lieu.
   */
  async premierInstantDesJournaux(): Promise<number | null> {
    const [jour, series, xp, soirees, profils] = await this.client.batch(
      [
        'SELECT MIN(jour) AS n FROM jour_parties',
        'SELECT MIN(commencee_le) AS n FROM campagne_series',
        'SELECT MIN(created_at) AS n FROM profile_xp',
        'SELECT MIN(held_at) AS n FROM soirees',
        'SELECT MIN(created_at) AS n FROM profiles',
      ],
      'read',
    )
    const instants: number[] = []
    const premierJour = jour.rows[0]?.n
    if (typeof premierJour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(premierJour)) {
      const [a, m, j] = premierJour.split('-').map(Number)
      instants.push(minuitDe(Date.UTC(a, m - 1, j, 12)))
    }
    for (const lu of [series, xp, soirees, profils]) {
      const n = lu.rows[0]?.n
      if (n !== null && n !== undefined && Number.isFinite(Number(n))) instants.push(Number(n))
    }
    return instants.length > 0 ? Math.min(...instants) : null
  }

  /**
   * Les feuilles de présence d'une plage de jours, `de` compris, `a` exclu —
   * d'un seul texte JSON : le client de Turso décode chaque ligne une à une, et
   * soixante jours en font des milliers.
   */
  async presencesEntre(de: string, a = '9999-12-31'): Promise<Presence[]> {
    const res = await this.client.execute({
      sql: `SELECT json_group_array(json_array(jour, profile_id, modes, premiere)) AS lignes FROM qg_presences WHERE jour >= ? AND jour < ?`,
      args: [de, a],
    })
    const lignes = JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, string, number, number][]
    return lignes.map(([jour, qui, modes, premiere]) => ({ jour: String(jour), qui: String(qui), modes: Number(modes), premiere: Number(premiere) }))
  }

  /** Les chiffres des jours depuis `de`, et le premier jour que la mémoire sait : d'un aller-retour. */
  async joursDepuis(de: string): Promise<{ jours: Map<string, ChiffresDUnJour>; premier: string | null }> {
    const [lus, premier] = await this.client.batch(
      [{ sql: 'SELECT json_group_array(json_array(jour, chiffres)) AS lignes FROM qg_jours WHERE jour >= ?', args: [de] }, 'SELECT MIN(jour) AS jour FROM qg_jours'],
      'read',
    )
    const lignes = JSON.parse(String(lus.rows[0]?.lignes ?? '[]')) as [string, string][]
    const jours = new Map<string, ChiffresDUnJour>()
    for (const [jour, chiffres] of lignes) {
      try {
        jours.set(String(jour), JSON.parse(String(chiffres)) as ChiffresDUnJour)
      } catch {
        // Une ligne illisible manque : le jour se lit comme inconnu, la page part quand même.
      }
    }
    const p = premier.rows[0]?.jour
    return { jours, premier: p === null || p === undefined ? null : String(p) }
  }

  /**
   * Les heures éveillées du serveur des jours finis depuis `de` — un mois en a
   * trente et une lignes au plus : les heures de l'hébergeur, une fois
   * l'heure, pour les jours que les démarrages gardés ne couvrent plus. Null, le
   * jour ne le sait pas — une ligne d'avant, ou un jour plus vieux que les
   * démarrages quand il s'est écrit.
   */
  async heuresDesJours(de: string): Promise<Map<string, number | null>> {
    const res = await this.client.execute({
      sql: `SELECT json_group_array(json_array(jour, json_extract(chiffres, '$.serveur.heures'))) AS lignes FROM qg_jours WHERE jour >= ? AND json_valid(chiffres)`,
      args: [de],
    })
    const lignes = JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, number | null][]
    return new Map(lignes.map(([jour, heures]) => [String(jour), typeof heures === 'number' && Number.isFinite(heures) ? heures : null]))
  }

  /**
   * Ce que la mémoire sait du serveur de chaque jour depuis `de` — ses heures
   * éveillées et ses mises en ligne, ou null quand ses démarrages n'étaient
   * plus gardés —, lu avant qu'une version neuve des dérivations n'efface
   * tout : les démarrages ne se gardent que huit jours, et le rattrapage qui
   * suit reprend ce qu'ils ne savent plus. Un jour qui ne le dit pas — une
   * ligne d'avant la mémoire v2, une ligne illisible — manque.
   */
  async serveursDesJours(de: string): Promise<Map<string, ServeurDUnJour | null>> {
    const res = await this.client.execute({
      sql: `SELECT json_group_array(json_array(jour, json(json_extract(chiffres, '$.serveur')))) AS lignes FROM qg_jours
            WHERE jour >= ? AND CASE WHEN json_valid(chiffres) THEN json_type(chiffres, '$.serveur') END IS NOT NULL`,
      args: [de],
    })
    const serveurs = new Map<string, ServeurDUnJour | null>()
    for (const [jour, serveur] of JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, unknown][]) {
      const lu = lireLeServeurDUnJour(serveur)
      if (lu !== undefined) serveurs.set(String(jour), lu)
    }
    return serveurs
  }

  /**
   * Écrit des jours finis, d'un seul lot : la feuille de chacun remplacée
   * entière, ses chiffres aussi — deux serveurs d'une mise en ligne qui
   * rattrapent le même jour écrivent la même chose, l'un après l'autre. Et ce
   * qui a passé l'an s'efface avec (`avant`).
   */
  async ecrire(jours: readonly JourDeLaMemoire[], avant: string): Promise<void> {
    if (jours.length === 0) return
    const presences = jours.flatMap(j => j.presences.map(p => [p.jour, p.qui, p.modes, p.premiere]))
    await this.client.batch(
      [
        { sql: 'DELETE FROM qg_presences WHERE jour >= ? AND jour <= ?', args: [jours[0].jour, jours[jours.length - 1].jour] },
        {
          sql: `INSERT OR REPLACE INTO qg_presences (jour, profile_id, modes, premiere)
                SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]') FROM json_each(?)`,
          args: [JSON.stringify(presences)],
        },
        {
          sql: `INSERT OR REPLACE INTO qg_jours (jour, chiffres, ecrit_le) SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ? FROM json_each(?)`,
          args: [Date.now(), JSON.stringify(jours.map(j => [j.jour, JSON.stringify(j.chiffres)]))],
        },
        { sql: 'DELETE FROM qg_presences WHERE jour < ?', args: [avant] },
        { sql: 'DELETE FROM qg_jours WHERE jour < ?', args: [avant] },
      ],
      'write',
    )
    if (this.oublies.size > 0) await this.effacerLesOublies()
  }

  /** Tout effacer : une version des dérivations qui change refait les deux mémoires des journaux. */
  async effacer(): Promise<void> {
    await this.client.batch(['DELETE FROM qg_presences', 'DELETE FROM qg_jours'], 'write')
  }

  /**
   * Un rattrapage, du début à la fin : un profil supprimé pendant ce temps est
   * retenu, et ses lignes que le rattrapage aurait réécrites s'effacent
   * derrière chaque écriture, puis une dernière fois à la fin.
   */
  async pendantUnRattrapage<T>(travail: () => Promise<T>): Promise<T> {
    this.rattrapages++
    try {
      return await travail()
    } finally {
      this.rattrapages--
      if (this.oublies.size > 0) {
        await this.effacerLesOublies().catch(e => console.error('[qg] les présences d’un profil supprimé restent :', e))
        if (this.rattrapages === 0) this.oublies.clear()
      }
    }
  }

  private async effacerLesOublies(): Promise<void> {
    await this.client.execute({ sql: 'DELETE FROM qg_presences WHERE profile_id IN (SELECT value FROM json_each(?))', args: [JSON.stringify([...this.oublies])] })
  }

  /** Un profil supprimé emporte sa feuille de présence (`supprimerProfil`, `server.ts`). Les chiffres des jours, sans un nom, restent. */
  async oublierProfil(profileId: string): Promise<void> {
    if (this.rattrapages > 0) this.oublies.add(profileId)
    await this.client.execute({ sql: 'DELETE FROM qg_presences WHERE profile_id = ?', args: [profileId] })
  }
}

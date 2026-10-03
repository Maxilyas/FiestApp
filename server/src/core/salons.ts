import { randomInt } from 'node:crypto'
import { clientDistant, type Client } from './distante'
import { CODE_DU_SALON } from '../../../shared/space'

/**
 * Le code d'un salon : six chiffres, tirés à son ouverture, qu'on dicte à la
 * table (« 482 157 ») et que le QR porte. Il remplace l'adresse au prénom
 * pour entrer : plus de « chez-antoine-2 » quand tout le monde a son salon,
 * plus de prénom dans une adresse publique, et le téléphone ouvre son pavé
 * numérique. L'adresse de l'espace reste celle de ses souvenirs et de ses
 * archives : le code n'y mène que par une redirection (`core/apercus.ts`).
 *
 * Dans la base permanente : l'hébergeur efface le disque à chaque réveil, et
 * le code d'un salon ouvert doit survivre à un redémarrage en pleine soirée.
 * Tenus aussi en mémoire, comme les comptes : chaque page d'un invité qui
 * tape un code le cherche, et la base n'a pas à répondre pour ça.
 *
 * Un code vaut tant que le salon est ouvert, et encore un moment après sa
 * clôture (`SURSIS_APRES_CLOTURE_MS`) : le retardataire, ou « Encore un quiz
 * avec eux », le retrouvent. Passé ce sursis il ne mène plus nulle part — la
 * photo d'un QR de la semaine dernière n'ouvre pas la soirée suivante —, et
 * le salon suivant en tire un neuf.
 */

/** Le temps qu'un code survit à la clôture de son salon. */
export const SURSIS_APRES_CLOTURE_MS = 30 * 60_000

interface Salon {
  code: string
  spaceId: string
  ouvertLe: number
  /** Null tant que le salon est ouvert. */
  fermeLe: number | null
}

export class SalonStore {
  private client: Client
  private parCode = new Map<string, Salon>()
  private parEspace = new Map<string, Salon>()

  constructor(
    url: string,
    authToken?: string,
    /** Les tests avancent l'horloge pour voir un code tomber. */
    private maintenant: () => number = Date.now,
  ) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS salons (
           code      TEXT PRIMARY KEY,
           space_id  TEXT NOT NULL UNIQUE,
           ouvert_le INTEGER NOT NULL,
           ferme_le  INTEGER
         )`,
      ],
      'write',
    )
    // Le ménage d'abord : un code périmé n'a pas à remonter en mémoire.
    await this.client.execute({
      sql: 'DELETE FROM salons WHERE ferme_le IS NOT NULL AND ferme_le <= ?',
      args: [this.maintenant() - SURSIS_APRES_CLOTURE_MS],
    })
    const res = await this.client.execute('SELECT * FROM salons')
    for (const r of res.rows) {
      this.poser({
        code: String(r.code),
        spaceId: String(r.space_id),
        ouvertLe: Number(r.ouvert_le),
        fermeLe: r.ferme_le === null || r.ferme_le === undefined ? null : Number(r.ferme_le),
      })
    }
  }

  private poser(salon: Salon) {
    const avant = this.parEspace.get(salon.spaceId)
    if (avant) this.parCode.delete(avant.code)
    this.parCode.set(salon.code, salon)
    this.parEspace.set(salon.spaceId, salon)
  }

  private valable(salon: Salon | undefined): salon is Salon {
    return !!salon && (salon.fermeLe === null || this.maintenant() - salon.fermeLe < SURSIS_APRES_CLOTURE_MS)
  }

  /** Le code du salon de cet espace, s'il en a un qui vaut encore. */
  codeDe(spaceId: string): string | null {
    const salon = this.parEspace.get(spaceId)
    return this.valable(salon) ? salon.code : null
  }

  /** L'espace qu'ouvre ce code — rien pour un code inconnu ou périmé : le voisin n'en sait pas plus (invariant 3). */
  espaceDuCode(code: string): string | undefined {
    if (!CODE_DU_SALON.test(code)) return undefined
    const salon = this.parCode.get(code)
    return this.valable(salon) ? salon.spaceId : undefined
  }

  /**
   * Ouvre le salon de cet espace et rend son code : le même s'il vaut encore
   * — rouvert s'il venait d'être clos —, sinon un neuf. Deux ouvertures
   * croisées du même espace rendent le même code : la seconde le lit en
   * mémoire, posé avant l'écriture.
   */
  async ouvrir(spaceId: string): Promise<string> {
    const salon = this.parEspace.get(spaceId)
    if (this.valable(salon)) {
      if (salon.fermeLe !== null) {
        salon.fermeLe = null
        await this.client.execute({ sql: 'UPDATE salons SET ferme_le = NULL WHERE code = ?', args: [salon.code] })
      }
      return salon.code
    }
    for (let essai = 0; essai < 20; essai++) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      // Un code périmé d'un autre espace se reprend : sa ligne part avec la nôtre.
      const occupe = this.parCode.get(code)
      if (occupe && occupe.spaceId !== spaceId && this.valable(occupe)) continue
      const neuf: Salon = { code, spaceId, ouvertLe: this.maintenant(), fermeLe: null }
      this.poser(neuf)
      if (occupe && occupe.spaceId !== spaceId) this.parEspace.delete(occupe.spaceId)
      try {
        await this.client.batch(
          [
            { sql: 'DELETE FROM salons WHERE space_id = ? OR code = ?', args: [spaceId, code] },
            { sql: 'INSERT INTO salons (code, space_id, ouvert_le, ferme_le) VALUES (?, ?, ?, NULL)', args: [code, spaceId, neuf.ouvertLe] },
          ],
          'write',
        )
      } catch (e) {
        // La mémoire suit la base : un code qu'on n'a pas pu écrire ne s'annonce pas.
        this.parCode.delete(code)
        if (this.parEspace.get(spaceId) === neuf) this.parEspace.delete(spaceId)
        throw e
      }
      return code
    }
    // Un million de codes, quelques centaines de salons ouverts : vingt tirages
    // ratés d'affilée ne se voient pas, sauf panne du hasard.
    throw new Error('Aucun code de salon libre — réessaie dans un instant')
  }

  /** La soirée est close : son code vaut encore le temps du sursis. */
  async fermer(spaceId: string): Promise<void> {
    const salon = this.parEspace.get(spaceId)
    if (!salon || salon.fermeLe !== null) return
    salon.fermeLe = this.maintenant()
    await this.client.execute({ sql: 'UPDATE salons SET ferme_le = ? WHERE code = ?', args: [salon.fermeLe, salon.code] })
  }

  async removeSpace(spaceId: string): Promise<void> {
    const salon = this.parEspace.get(spaceId)
    if (salon) this.parCode.delete(salon.code)
    this.parEspace.delete(spaceId)
    await this.client.execute({ sql: 'DELETE FROM salons WHERE space_id = ?', args: [spaceId] })
  }

  close() {
    this.client.close()
  }
}

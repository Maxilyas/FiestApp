import { randomInt } from 'node:crypto'

/** Chiffres d'un code : six, comme un code reçu par SMS — assez court pour se dicter dans le bruit. */
const CHIFFRES = 6
/**
 * Durée de vie d'un code. Le temps que l'invité rallume un téléphone, ouvre
 * l'adresse et tape son prénom : au-delà, l'animateur en fait paraître un autre.
 */
export const VIE_DU_CODE_MS = 3 * 60_000
/**
 * Essais manqués tolérés par espace, tous codes confondus. Au-delà, tous les
 * codes de l'espace tombent : cinq essais sur un million de codes, c'est une
 * chance sur deux cent mille — et un plaisantin qui tape au hasard ne gagne
 * qu'une chose, que l'animateur en refasse paraître un.
 */
export const ESSAIS_MANQUES_MAX = 5

interface CodeEnCours {
  playerId: string
  expiresAt: number
}

/**
 * Les places que l'animateur a promis de rendre, dans un espace.
 *
 * Un téléphone mort en pleine soirée emporte son jeton : le nouveau ne peut
 * qu'inscrire un second « Rachid », et les points du premier ne le
 * rejoignent jamais. Le jeton ne se donne pas sur parole (invariant 9) ;
 * c'est l'animateur, qui voit l'invité en face de lui, qui fait paraître un
 * code pour une fiche. En mémoire seulement : un redémarrage les oublie, et
 * on en refait paraître un — ce qui dure trois minutes n'a rien à faire dans
 * la base permanente.
 */
export class PlacesRendues {
  private codes = new Map<string, CodeEnCours>()
  private manques = 0

  /**
   * Un code neuf pour cette fiche. Celui qu'elle avait encore tombe : deux
   * codes pour une même place, c'est deux chances de la donner à quelqu'un
   * d'autre.
   */
  emettre(playerId: string, now: number): { code: string; expiresAt: number } {
    this.purger(now)
    for (const [code, c] of this.codes) if (c.playerId === playerId) this.codes.delete(code)
    let code: string
    do code = String(randomInt(0, 10 ** CHIFFRES)).padStart(CHIFFRES, '0')
    while (this.codes.has(code))
    const expiresAt = now + VIE_DU_CODE_MS
    this.codes.set(code, { playerId, expiresAt })
    // Un code neuf remet le compte des essais à zéro : c'est l'animateur qui
    // le demande, en face de l'invité.
    this.manques = 0
    return { code, expiresAt }
  }

  /**
   * La fiche que ce code rend, et le code est consommé. Null pour un code
   * inconnu, périmé ou déjà servi — et chaque essai manqué compte.
   */
  reprendre(saisie: string, now: number): string | null {
    this.purger(now)
    // Tapé au téléphone : « 482 913 », « 482-913 ». Seuls les chiffres comptent.
    const code = saisie.replace(/\D/g, '')
    const c = code.length === CHIFFRES ? this.codes.get(code) : undefined
    if (!c) {
      if (++this.manques >= ESSAIS_MANQUES_MAX) {
        this.codes.clear()
        this.manques = 0
      }
      return null
    }
    this.codes.delete(code)
    return c.playerId
  }

  /** Une fiche qui n'existe plus n'a plus de place à rendre : exclue, ou la soirée effacée. */
  oublier(playerId?: string) {
    if (playerId === undefined) return this.codes.clear()
    for (const [code, c] of this.codes) if (c.playerId === playerId) this.codes.delete(code)
  }

  private purger(now: number) {
    for (const [code, c] of this.codes) if (c.expiresAt <= now) this.codes.delete(code)
  }
}

import { randomInt } from 'node:crypto'

/** Chiffres d'un code : six, comme un code reçu par SMS — assez court pour se dicter dans le bruit. */
const CHIFFRES = 6
/**
 * Durée de vie d'un code. Le temps que l'invité rallume un téléphone, ouvre
 * l'adresse et tape son prénom : au-delà, l'animateur en fait paraître un autre.
 */
export const VIE_DU_CODE_MS = 3 * 60_000
/**
 * Essais manqués tolérés par espace et par minute glissante, tous codes
 * confondus. Au-delà, on refuse d'essayer, sans rien faire tomber : au plus
 * quinze essais pendant les trois minutes d'un code, sur un million — une
 * chance sur soixante-six mille.
 *
 * On faisait tomber tous les codes de l'espace au cinquième essai manqué :
 * n'importe qui, avec la seule adresse de la soirée, brûlait autant de fois
 * qu'il voulait le code de Rachid — les fautes de frappe d'un autre invité
 * aussi —, et la console affichait encore « Valable 3 minutes » sous un code
 * mort.
 */
export const ESSAIS_MANQUES_MAX = 5
export const FENETRE_ESSAIS_MS = 60_000

interface CodeEnCours {
  playerId: string
  expiresAt: number
}

/** Ce que donne un code tapé. */
export type Saisie =
  | { ok: true; playerId: string; code: string }
  /** `trop` : l'espace a manqué trop d'essais cette minute — on n'a pas même regardé le code. */
  | { ok: false; motif: 'mauvais' | 'trop' }

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
  /** Les instants des essais manqués de la dernière minute. */
  private manques: number[] = []
  /**
   * Monte à chaque code émis. Une connexion qui a trop manqué retrouve ses
   * essais quand l'animateur fait paraître un code neuf : c'est ce que son
   * message de refus lui dit de demander.
   */
  generation = 0

  /**
   * Un code neuf pour cette fiche. Celui qu'elle avait encore tombe : deux
   * codes pour une même place, c'est deux chances de la donner à quelqu'un
   * d'autre.
   */
  emettre(playerId: string, now: number): { code: string; expiresAt: number } {
    this.purger(now)
    this.oublier(playerId)
    let code: string
    do code = String(randomInt(0, 10 ** CHIFFRES)).padStart(CHIFFRES, '0')
    while (this.codes.has(code))
    const expiresAt = now + VIE_DU_CODE_MS
    this.codes.set(code, { playerId, expiresAt })
    // Un code neuf rend leurs essais à l'espace et aux connexions : c'est
    // l'animateur qui le demande, en face de l'invité — et ce que le refus
    // « Trop d'essais » lui dit de faire.
    this.manques = []
    this.generation++
    return { code, expiresAt }
  }

  /**
   * La fiche que ce code désigne, sans le consommer : l'appelant vérifie
   * encore que la place peut se rendre, et ne consomme (`consommer`) qu'au
   * moment de la rendre. Chaque essai manqué compte.
   */
  lire(saisie: string, now: number): Saisie {
    this.purger(now)
    if (this.manques.length >= ESSAIS_MANQUES_MAX) return { ok: false, motif: 'trop' }
    // Tapé au téléphone : « 482 913 », « 482-913 ». Seuls les chiffres comptent.
    const code = saisie.replace(/\D/g, '')
    const c = code.length === CHIFFRES ? this.codes.get(code) : undefined
    if (!c) {
      this.manques.push(now)
      return { ok: false, motif: 'mauvais' }
    }
    return { ok: true, playerId: c.playerId, code }
  }

  /** Le code a servi : il ne resservira pas. */
  consommer(code: string) {
    this.codes.delete(code)
  }

  /** Une fiche qui n'existe plus n'a plus de place à rendre : exclue, reprise, ou la soirée effacée. */
  oublier(playerId?: string) {
    if (playerId === undefined) return this.codes.clear()
    for (const [code, c] of this.codes) if (c.playerId === playerId) this.codes.delete(code)
  }

  private purger(now: number) {
    for (const [code, c] of this.codes) if (c.expiresAt <= now) this.codes.delete(code)
    this.manques = this.manques.filter(t => now - t < FENETRE_ESSAIS_MS)
  }
}

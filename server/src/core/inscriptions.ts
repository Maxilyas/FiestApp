import { createHash, randomBytes } from 'node:crypto'
import { Budget, LOOPBACK } from './budget'

/**
 * La réserve d'inscriptions des invités : combien de nouvelles identités une
 * même adresse peut créer, et en combien de temps.
 *
 * Toute une salle peut n'avoir qu'une adresse : le wifi de la fête sort sur
 * Internet par une seule box — c'est l'écran commun lui-même qui en projette
 * le QR —, et en 4G des dizaines d'invités partagent celle de leur opérateur.
 * À 25 d'un coup, la vague de scans qui suit l'apparition du QR prenait des
 * refus. Soixante d'un coup la laissent passer, et soixante par minute font
 * entrer une salle de 150 (le plafond par défaut d'un espace) en moins de
 * deux minutes, retardataires compris. L'attaque mesurée — 200 inscriptions
 * en moins d'une seconde depuis une même adresse — n'en place plus que
 * soixante, puis une par seconde, et le plafond de la soirée borne le reste.
 *
 * Cette réserve-là se compte **par adresse et par espace**. Comptée par
 * adresse seule, elle était commune à tout le serveur : soixante invités
 * chez A derrière la box d'une école, et le premier invité de B, derrière la
 * même box, était refusé une minute — une soirée abîmait l'accueil d'une
 * autre qu'elle ne connaissait pas. Une seconde réserve, par adresse seule
 * et cinq fois plus large, garde le serveur de qui ferait le tour des espaces
 * pour les inonder tous.
 *
 * Ce n'est pas la réserve des consoles (`loginBudgetOf`, `auth/http.ts`),
 * commune à toutes les portes d'animateur, et par choix.
 */
export const PAR_SOIREE = { burst: 60, parMinute: 60 }
export const PAR_ADRESSE = { burst: 300, parMinute: 300 }

/** Ce que le journal retient des refus : une ligne par clé et par minute, pas une par invité. */
const SILENCE_MS = 60_000

export class ReserveDInscriptions {
  private parSoiree = new Budget(PAR_SOIREE.burst, PAR_SOIREE.parMinute)
  private parAdresse = new Budget(PAR_ADRESSE.burst, PAR_ADRESSE.parMinute)
  /**
   * Le sel des empreintes, tiré au démarrage. Sans lui, l'empreinte d'une
   * adresse IPv4 se retrouverait en essayant les quatre milliards : le
   * journal ne doit jamais permettre de remonter à une adresse.
   */
  private sel = randomBytes(16)
  /**
   * Par espace, les empreintes des adresses dont une inscription est passée
   * depuis le début de la soirée, et combien d'inscriptions en tout. En
   * mémoire seulement : un redémarrage en pleine soirée fait repartir le
   * compte, et le journal de clôture le dit.
   */
  private vues = new Map<string, { adresses: Set<string>; inscriptions: number }>()
  /** Par clé refusée, l'heure de la dernière ligne au journal. */
  private dites = new Map<string, number>()
  private refus = 0

  /** Une empreinte courte et salée de l'adresse : de quoi reconnaître une clé d'une ligne à l'autre, rien de plus. */
  empreinte(ip: string): string {
    return createHash('sha256').update(this.sel).update(ip).digest('hex').slice(0, 10)
  }

  /**
   * Une inscription de plus depuis cette adresse, dans cet espace. Rend faux
   * si l'une des deux réserves est vide. `entrees` est le nombre d'adresses
   * de `x-forwarded-for` à la poignée de main (0 sans en-tête) : on le
   * journalise au refus, c'est lui qui dira si l'adresse lue est bien celle
   * du téléphone (voir `MISE-EN-LIGNE.md`, « Vérifier l'adresse des invités »).
   */
  prendre(ip: string, spaceId: string, entrees: number, etiquette = spaceId): boolean {
    // Les tests et les essais à la maison passent par l'adresse locale : ils
    // inscrivent cinquante invités d'un coup, et c'est voulu.
    const locale = LOOPBACK.has(ip)
    // La réserve de la soirée d'abord : c'est elle qui refuse d'ordinaire,
    // et un refus n'entame pas celle de l'adresse.
    const refusePar = locale
      ? null
      : !this.parSoiree.take(`${ip}|${spaceId}`)
        ? 'de la soirée'
        : !this.parAdresse.take(ip)
          ? 'du serveur'
          : null
    if (refusePar) {
      this.refus++
      this.journaliserRefus(ip, spaceId, entrees, etiquette, refusePar)
      return false
    }
    let vues = this.vues.get(spaceId)
    if (!vues) this.vues.set(spaceId, (vues = { adresses: new Set(), inscriptions: 0 }))
    vues.adresses.add(this.empreinte(ip))
    vues.inscriptions++
    return true
  }

  private journaliserRefus(ip: string, spaceId: string, entrees: number, etiquette: string, par: string) {
    const cle = `${ip}|${spaceId}`
    const now = Date.now()
    const dite = this.dites.get(cle)
    if (dite !== undefined && now - dite < SILENCE_MS) return
    this.dites.set(cle, now)
    if (this.dites.size > 2000) {
      for (const [k, at] of this.dites) if (now - at > SILENCE_MS) this.dites.delete(k)
    }
    console.warn(
      `[inscriptions] réserve ${par} vide chez « ${etiquette} » pour l'adresse ${this.empreinte(ip)}` +
        ` (x-forwarded-for : ${entrees} entrée${entrees > 1 ? 's' : ''})`,
    )
  }

  /**
   * La soirée de cet espace s'achève — close ou effacée : on dit au journal
   * combien d'adresses distinctes ont inscrit ses invités, puis on oublie.
   *
   * C'est la mesure qui dit si l'adresse lue en ligne est bien celle des
   * téléphones : une salle en 4G sous une ou deux adresses, soirée après
   * soirée, veut dire qu'on lit celle d'un proxy de l'hébergeur — et alors
   * toutes les soirées du serveur partagent la même réserve.
   */
  clore(spaceId: string, invites: number, etiquette = spaceId): { invites: number; inscriptions: number; adresses: number } {
    const vues = this.vues.get(spaceId)
    const adresses = vues?.adresses.size ?? 0
    const inscriptions = vues?.inscriptions ?? 0
    this.vues.delete(spaceId)
    const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
    if (invites > 0 || inscriptions > 0) {
      // Les inscriptions comptées sont celles que la réserve a vues : moins
      // que d'invités si le serveur a redémarré pendant la soirée.
      console.log(
        `[inscriptions] soirée finie chez « ${etiquette} » : ${pluriel(invites, 'invité')} ;` +
          ` ${pluriel(inscriptions, 'inscription')} depuis le démarrage du serveur,` +
          ` sous ${pluriel(adresses, 'adresse')} distincte${adresses > 1 ? 's' : ''}`,
      )
    }
    return { invites, inscriptions, adresses }
  }

  /**
   * De quoi compter, pour une page de santé : les refus depuis le démarrage,
   * et les adresses distinctes des soirées en cours, tous espaces confondus.
   */
  mesure(): { refus: number; adresses: number } {
    const toutes = new Set<string>()
    for (const vues of this.vues.values()) for (const e of vues.adresses) toutes.add(e)
    return { refus: this.refus, adresses: toutes.size }
  }
}

import { clientDistant, type Client } from './distante'
import { tronquer } from '../../../shared/avatars'
import {
  BANDEAU_MAX,
  PAGES_EN_MAINTENANCE,
  estUnePageEnMaintenance,
  montreLeBandeau,
  pageDeLAdresse,
  type EtatDeLaMaintenance,
  type PageEnMaintenance,
} from '../../../shared/maintenance'
import type { Route } from '../../../shared/adresses'

/** Ce qu'une page servie dit du service à qui la demande (`ecrireLeService`, `core/page.ts`). */
export interface ServiceDeLaPage {
  /** Le bandeau, quand cette page le montre (`montreLeBandeau`). */
  bandeau: string | null
  /** Les pages fermées, pour tous : l'accueil le dit sur leurs boutons, la campagne sur l'onglet du défi. */
  fermees: PageEnMaintenance[]
  /** Qui la demande est l'administrateur : il entre encore dans une page fermée, pour vérifier la réparation. */
  admin: boolean
  /** La page qu'ouvre cette adresse, quand elle est fermée (`pageDeLAdresse`). */
  ici: PageEnMaintenance | null
}

/**
 * Le texte d'un bandeau tel qu'il s'affichera — ses blancs resserrés —, ou
 * null s'il ne dit rien. Trop long, il se refuse au lieu de se couper : coupé
 * au milieu d'un mot, il aurait dit autre chose que ce que l'administrateur
 * a écrit, à tout le monde.
 */
export function lireLeBandeau(brut: unknown): string | null {
  if (typeof brut !== 'string') return null
  const net = brut.replace(/\s+/g, ' ').trim()
  if (!net) return null
  if (tronquer(net, BANDEAU_MAX) !== net) throw new Error(`Le bandeau tient en ${BANDEAU_MAX} caractères : raccourcis-le`)
  return net
}

/**
 * Le bandeau rouge et les pages en maintenance (`shared/maintenance.ts`),
 * dans la base permanente : un bandeau qui s'effacerait au premier réveil de
 * l'hébergeur ne préviendrait plus personne, et une page rouverte d'elle-même
 * laisserait entrer dans ce qui ne marche pas. Lus au démarrage, tenus en
 * mémoire : chaque page servie, chaque route qui commence une partie les lit
 * sans un aller-retour.
 */
export class Maintenance {
  private client: Client
  private bandeau: { texte: string; depuis: number } | null = null
  private fermees = new Map<PageEnMaintenance, number>()
  /**
   * Les écritures, l'une après l'autre : deux onglets du QG qui écrivent en
   * même temps finissent dans l'ordre où ils sont partis, en base comme en
   * mémoire — et le second voit ce que le premier a changé.
   */
  private file: Promise<unknown> = Promise.resolve()

  constructor(
    url: string,
    authToken?: string,
    private deps: { maintenant: () => number } = { maintenant: Date.now },
  ) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    const [, lus] = await this.client.batch(
      [
        // Une ligne par chose posée : `bandeau` et son texte, ou une page fermée. Rien de posé, la table est vide.
        `CREATE TABLE IF NOT EXISTS qg_maintenance (
           cle    TEXT PRIMARY KEY,
           texte  TEXT,
           depuis INTEGER NOT NULL
         )`,
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT cle, texte, depuis FROM qg_maintenance',
      ],
      'write',
    )
    for (const r of lus.rows) {
      const cle = String(r.cle)
      if (cle === 'bandeau') {
        if (typeof r.texte === 'string' && r.texte) this.bandeau = { texte: r.texte, depuis: Number(r.depuis) }
      } else if (estUnePageEnMaintenance(cle)) this.fermees.set(cle, Number(r.depuis))
      // Une page que le code ne connaît plus se tait : plus rien ne l'ouvre.
    }
  }

  private enFile<T>(ecrire: () => Promise<T>): Promise<T> {
    const suite = this.file.then(ecrire, ecrire)
    this.file = suite.catch(() => {})
    return suite
  }

  /** Ce que la page du QG montre : le bandeau, et chaque page avec l'instant où elle a fermé. */
  etat(): EtatDeLaMaintenance {
    const pages = Object.fromEntries(PAGES_EN_MAINTENANCE.map(p => [p, this.fermees.get(p) ?? null])) as Record<PageEnMaintenance, number | null>
    return { maintenant: this.deps.maintenant(), bandeau: this.bandeau, pages }
  }

  estFermee(page: PageEnMaintenance): boolean {
    return this.fermees.has(page)
  }

  /** Une page au moins est fermée : sinon, la garde des portes ne lit rien. */
  quelqueChoseDeFerme(): boolean {
    return this.fermees.size > 0
  }

  /**
   * Ce qu'une page servie à cette adresse dit du service ; null quand elle
   * n'a rien à dire. Qui la demande ne se cherche que si une page est fermée
   * (`admin`) : le reste du temps, servir une page ne lit pas une session de
   * plus.
   */
  pourLaPage(route: Route, admin: () => boolean): ServiceDeLaPage | null {
    const bandeau = this.bandeau && montreLeBandeau(route) ? this.bandeau.texte : null
    if (!bandeau && this.fermees.size === 0) return null
    const fermees = PAGES_EN_MAINTENANCE.filter(p => this.fermees.has(p))
    const page = pageDeLAdresse(route)
    return { bandeau, fermees, admin: fermees.length > 0 && admin(), ici: page && this.fermees.has(page) ? page : null }
  }

  /**
   * Pose le bandeau, ou le retire (`null`). Rend ce qu'il disait avant, pour
   * le journal. Un geste qui ne changerait rien se refuse : le journal ne note
   * que ce qui a changé.
   */
  poserLeBandeau(brut: unknown): Promise<{ avant: string | null; apres: string | null }> {
    const apres = brut === null ? null : lireLeBandeau(brut)
    if (brut !== null && apres === null) return Promise.reject(new Error('Écris ce que le bandeau doit dire'))
    return this.enFile(async () => {
      const avant = this.bandeau?.texte ?? null
      if (apres === avant) throw new Error(apres === null ? 'Aucun bandeau n’est affiché' : 'Ce bandeau est déjà affiché')
      const depuis = this.deps.maintenant()
      await this.client.execute(
        apres === null
          ? { sql: "DELETE FROM qg_maintenance WHERE cle = 'bandeau'", args: [] }
          : {
              sql: `INSERT INTO qg_maintenance (cle, texte, depuis) VALUES ('bandeau', ?, ?)
                    ON CONFLICT(cle) DO UPDATE SET texte = excluded.texte, depuis = excluded.depuis`,
              args: [apres, depuis],
            },
      )
      this.bandeau = apres === null ? null : { texte: apres, depuis }
      return { avant, apres }
    })
  }

  /** Ferme une page (`fermee`), ou la rouvre. Un geste qui ne changerait rien se refuse, comme le bandeau. */
  fermer(page: unknown, fermee: boolean): Promise<PageEnMaintenance> {
    if (!estUnePageEnMaintenance(page)) return Promise.reject(new Error('Cette page ne se met pas en maintenance'))
    return this.enFile(async () => {
      // « Cette page » : « Les duels est déjà… » ne s'accordait à rien.
      if (this.fermees.has(page) === fermee) {
        throw new Error(fermee ? 'Cette page est déjà en maintenance : recharge le QG' : 'Cette page est déjà ouverte aux joueurs : recharge le QG')
      }
      const depuis = this.deps.maintenant()
      await this.client.execute(
        fermee
          ? { sql: 'INSERT INTO qg_maintenance (cle, texte, depuis) VALUES (?, NULL, ?) ON CONFLICT(cle) DO UPDATE SET depuis = excluded.depuis', args: [page, depuis] }
          : { sql: 'DELETE FROM qg_maintenance WHERE cle = ?', args: [page] },
      )
      if (fermee) this.fermees.set(page, depuis)
      else this.fermees.delete(page)
      return page
    })
  }

  close() {
    this.client.close()
  }
}

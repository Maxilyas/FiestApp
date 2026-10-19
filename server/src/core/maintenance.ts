import { clientDistant, type Client } from './distante'
import { tronquer } from '../../../shared/avatars'
import {
  BANDEAU_MAX,
  PAGES_EN_MAINTENANCE,
  estUnEtatDePage,
  estUnePageEnMaintenance,
  fermeePour,
  montreLeBandeau,
  pageDeLAdresse,
  type EtatDUnePage,
  type PageEnMaintenance,
  type VuDuService,
} from '../../../shared/maintenance'
import type { Route } from '../../../shared/adresses'

/**
 * Qui demande une page ou une route : l'administrateur, par la session de sa
 * console ; un profil, par sa session de joueur — en mémoire l'une et
 * l'autre (`server/src/maintenance.ts`).
 */
export interface Visiteur {
  admin: boolean
  profil: string | null
}

/** Ce qu'une page servie dit du service à qui la demande (`ecrireLeService`, `core/page.ts`). */
export interface ServiceDeLaPage extends VuDuService {
  /** Le bandeau, quand cette page le montre (`montreLeBandeau`). */
  bandeau: string | null
  /** La page qu'ouvre cette adresse, quand elle est en maintenance (`pageDeLAdresse`) : l'administrateur qui y entre lit qu'elle l'est. */
  ici: PageEnMaintenance | null
}

/** Ce que tient la maintenance, sans les noms des testeurs : la route du QG les lit dans les profils. */
export interface EtatBrutDeLaMaintenance {
  maintenant: number
  bandeau: { texte: string; depuis: number } | null
  pages: Record<PageEnMaintenance, number | null>
  bientot: Record<PageEnMaintenance, number | null>
  testeurs: Record<PageEnMaintenance, { id: string; depuis: number }[]>
}

/** Ce qu'un geste qui ne changerait rien répond : « Cette page » — « Les duels est déjà… » ne s'accordait à rien. */
const DEJA: Record<EtatDUnePage, string> = {
  ouverte: 'Cette page est déjà ouverte à tous : recharge le QG',
  maintenance: 'Cette page est déjà en maintenance : recharge le QG',
  bientot: 'Cette page est déjà annoncée pour bientôt : recharge le QG',
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
 * Le bandeau rouge, les pages en maintenance et les pages bientôt
 * disponibles (`shared/maintenance.ts`), dans la base permanente : un bandeau
 * qui s'effacerait au premier réveil de l'hébergeur ne préviendrait plus
 * personne, et une page rouverte d'elle-même laisserait entrer dans ce qui ne
 * marche pas — ou ouvrirait à tous ce qui n'est pas prêt. Lus au démarrage,
 * tenus en mémoire, testeurs compris : chaque page servie, chaque route qui
 * commence une partie les lit sans un aller-retour.
 */
export class Maintenance {
  private client: Client
  private bandeau: { texte: string; depuis: number } | null = null
  /** Les pages qui ne sont pas ouvertes à tous : ce qu'elles sont, depuis quand. */
  private pages = new Map<PageEnMaintenance, { etat: Exclude<EtatDUnePage, 'ouverte'>; depuis: number }>()
  /** Les testeurs de chaque page — un profil, depuis quand —, dans l'ordre où ils sont venus. */
  private testeurs = new Map<PageEnMaintenance, Map<string, number>>()
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
    const [, , lus, testeurs] = await this.client.batch(
      [
        // Une ligne par chose posée : `bandeau` et son texte, ou une page fermée — son texte dit pourquoi :
        // `bientot`, bientôt disponible ; rien, en maintenance. Rien de posé, la table est vide.
        `CREATE TABLE IF NOT EXISTS qg_maintenance (
           cle    TEXT PRIMARY KEY,
           texte  TEXT,
           depuis INTEGER NOT NULL
         )`,
        // Qui entre dans une page bientôt disponible avant tout le monde : un profil par ligne. Un profil
        // supprimé emporte les siennes (`oublierProfil`).
        `CREATE TABLE IF NOT EXISTS qg_testeurs (
           page       TEXT NOT NULL,
           profile_id TEXT NOT NULL,
           depuis     INTEGER NOT NULL,
           PRIMARY KEY (page, profile_id)
         )`,
        // Dans le même aller-retour : un réveil de l'hébergeur n'en paie pas un de plus.
        'SELECT cle, texte, depuis FROM qg_maintenance',
        'SELECT page, profile_id, depuis FROM qg_testeurs ORDER BY depuis',
      ],
      'write',
    )
    for (const r of lus.rows) {
      const cle = String(r.cle)
      if (cle === 'bandeau') {
        if (typeof r.texte === 'string' && r.texte) this.bandeau = { texte: r.texte, depuis: Number(r.depuis) }
      } else if (estUnePageEnMaintenance(cle)) {
        // Ce que le code ne connaît pas encore — une version d'après, revenue en arrière — reste fermé :
        // fermée à tort, une page se rouvre d'un geste ; ouverte à tort, elle laisserait entrer tout le monde.
        this.pages.set(cle, { etat: r.texte === 'bientot' ? 'bientot' : 'maintenance', depuis: Number(r.depuis) })
      }
      // Une page que le code ne connaît plus se tait : plus rien ne l'ouvre.
    }
    for (const r of testeurs.rows) {
      const page = String(r.page)
      if (estUnePageEnMaintenance(page)) this.lesTesteurs(page).set(String(r.profile_id), Number(r.depuis))
    }
  }

  private enFile<T>(ecrire: () => Promise<T>): Promise<T> {
    const suite = this.file.then(ecrire, ecrire)
    this.file = suite.catch(() => {})
    return suite
  }

  private lesTesteurs(page: PageEnMaintenance): Map<string, number> {
    let ceux = this.testeurs.get(page)
    if (!ceux) this.testeurs.set(page, (ceux = new Map()))
    return ceux
  }

  /** Ce que la page du QG montre : le bandeau, et chaque page — ce qu'elle est depuis quand, ses testeurs. */
  etat(): EtatBrutDeLaMaintenance {
    const depuis = (etat: EtatDUnePage) =>
      Object.fromEntries(PAGES_EN_MAINTENANCE.map(p => [p, this.pages.get(p)?.etat === etat ? this.pages.get(p)!.depuis : null])) as Record<PageEnMaintenance, number | null>
    const testeurs = Object.fromEntries(PAGES_EN_MAINTENANCE.map(p => [p, [...(this.testeurs.get(p) ?? [])].map(([id, d]) => ({ id, depuis: d }))]))
    return { maintenant: this.deps.maintenant(), bandeau: this.bandeau, pages: depuis('maintenance'), bientot: depuis('bientot'), testeurs } as EtatBrutDeLaMaintenance
  }

  etatDe(page: PageEnMaintenance): EtatDUnePage {
    return this.pages.get(page)?.etat ?? 'ouverte'
  }

  /** Fermée à quelqu'un — en maintenance, ou bientôt disponible : le rappel du soir attend. */
  estFermee(page: PageEnMaintenance): boolean {
    return this.pages.has(page)
  }

  /** Une page au moins est fermée à quelqu'un : sinon, la garde des portes ne lit rien. */
  quelqueChoseDeFerme(): boolean {
    return this.pages.size > 0
  }

  /** Ce que ce visiteur voit du service : la règle (`fermeePour`) le lit. */
  private vuPar(qui: Visiteur): VuDuService {
    const fermees = PAGES_EN_MAINTENANCE.filter(p => this.pages.get(p)?.etat === 'maintenance')
    const bientot = PAGES_EN_MAINTENANCE.filter(p => this.pages.get(p)?.etat === 'bientot')
    const profil = qui.profil
    const avantPremiere = profil ? bientot.filter(p => this.testeurs.get(p)?.has(profil)) : []
    return { fermees, bientot, admin: qui.admin, avantPremiere }
  }

  /** Ce visiteur entre-t-il dans cette page — l'administrateur partout, un testeur dans la sienne ? */
  laisseEntrer(page: PageEnMaintenance, qui: Visiteur): boolean {
    return fermeePour(this.vuPar(qui), page) === null
  }

  /**
   * Ce qu'une page servie à cette adresse dit du service ; null quand elle
   * n'a rien à dire. Qui la demande ne se cherche que si une page est fermée
   * (`quiEstCe`) : le reste du temps, servir une page ne lit pas une session
   * de plus.
   */
  pourLaPage(route: Route, quiEstCe: () => Visiteur): ServiceDeLaPage | null {
    const bandeau = this.bandeau && montreLeBandeau(route) ? this.bandeau.texte : null
    if (!bandeau && this.pages.size === 0) return null
    const vu = this.pages.size > 0 ? this.vuPar(quiEstCe()) : { fermees: [], bientot: [], admin: false, avantPremiere: [] }
    const page = pageDeLAdresse(route)
    return { bandeau, ...vu, ici: page && vu.fermees.includes(page) ? page : null }
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

  /**
   * Ce que devient une page : ouverte à tous, en maintenance, ou bientôt
   * disponible. Rend ce qu'elle était, pour le journal. Un geste qui ne
   * changerait rien se refuse, comme le bandeau ; ses testeurs restent, quoi
   * qu'elle devienne : rouverte puis refermée, elle les retrouve.
   */
  changerLEtat(page: unknown, etat: unknown): Promise<{ page: PageEnMaintenance; avant: EtatDUnePage }> {
    if (!estUnePageEnMaintenance(page)) return Promise.reject(new Error('Cette page ne se met pas en maintenance'))
    if (!estUnEtatDePage(etat)) return Promise.reject(new Error('Dis ce que devient la page : recharge le QG'))
    return this.enFile(async () => {
      const avant = this.etatDe(page)
      if (avant === etat) throw new Error(DEJA[etat])
      const depuis = this.deps.maintenant()
      await this.client.execute(
        etat === 'ouverte'
          ? { sql: 'DELETE FROM qg_maintenance WHERE cle = ?', args: [page] }
          : {
              sql: `INSERT INTO qg_maintenance (cle, texte, depuis) VALUES (?, ?, ?)
                    ON CONFLICT(cle) DO UPDATE SET texte = excluded.texte, depuis = excluded.depuis`,
              args: [page, etat === 'bientot' ? 'bientot' : null, depuis],
            },
      )
      if (etat === 'ouverte') this.pages.delete(page)
      else this.pages.set(page, { etat, depuis })
      return { page, avant }
    })
  }

  /** Un testeur de plus pour cette page : il y entre tant qu'elle est bientôt disponible. */
  ajouterUnTesteur(page: unknown, profil: string): Promise<PageEnMaintenance> {
    if (!estUnePageEnMaintenance(page)) return Promise.reject(new Error('Cette page ne se met pas en maintenance'))
    return this.enFile(async () => {
      if (this.testeurs.get(page)?.has(profil)) throw new Error('Ce joueur teste déjà cette page : recharge le QG')
      const depuis = this.deps.maintenant()
      await this.client.execute({ sql: 'INSERT INTO qg_testeurs (page, profile_id, depuis) VALUES (?, ?, ?)', args: [page, profil, depuis] })
      this.lesTesteurs(page).set(profil, depuis)
      return page
    })
  }

  /** Un testeur de moins : il attend avec les autres. */
  retirerUnTesteur(page: unknown, profil: string): Promise<PageEnMaintenance> {
    if (!estUnePageEnMaintenance(page)) return Promise.reject(new Error('Cette page ne se met pas en maintenance'))
    return this.enFile(async () => {
      if (!this.testeurs.get(page)?.has(profil)) throw new Error('Ce joueur ne teste pas cette page : recharge le QG')
      await this.client.execute({ sql: 'DELETE FROM qg_testeurs WHERE page = ? AND profile_id = ?', args: [page, profil] })
      this.testeurs.get(page)?.delete(profil)
      return page
    })
  }

  /** Un profil supprimé (`supprimerProfil`, `server.ts`) ne teste plus rien : ses lignes partent avec lui. */
  oublierProfil(profil: string): Promise<void> {
    return this.enFile(async () => {
      await this.client.execute({ sql: 'DELETE FROM qg_testeurs WHERE profile_id = ?', args: [profil] })
      for (const ceux of this.testeurs.values()) ceux.delete(profil)
    })
  }

  close() {
    this.client.close()
  }
}

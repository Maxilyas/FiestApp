import { createHash } from 'node:crypto'
import type { InStatement } from '@libsql/client'
import { clientDistant, type Client } from './distante'
import { lireAbonnement, pousser, type Abonnement, type ClesVapid } from './pousser'
import {
  EMPREINTE_D_UN_TELEPHONE,
  MODES_SURVEILLES,
  TELEPHONES_PREVENUS_MAX,
  serviceDuTelephone,
  type BilanDUneAlerte,
  type MessageDuQg,
  type ModeSurveille,
  type PanneDUnMode,
  type TelephoneDuQg,
} from '../../../shared/pannes'

// Les alertes du QG sur le téléphone de l'administrateur (le souhait du
// propriétaire du 19 octobre 2026) : la panne d'un mode de jeu, que la veille
// voit tomber (`core/veille.ts`), puis son retour. Le même Web Push que le
// rappel du soir (`pousser.ts`), sous les mêmes clés — un téléphone qui a les
// deux tient deux abonnements, l'un sous `/`, l'autre sous `/admin`
// (`client/src/alertesDuQg.ts`) —, mais rien de ses règles : pas de session à
// laquelle s'attacher — une session du QG qui expire ne doit pas faire taire
// une panne —, pas d'heure, et l'administrateur seul les allume.
//
// Les pannes en cours se gardent ici aussi (`qg_pannes`) : la réparation se
// met en ligne par un redémarrage, et la veille d'un serveur neuf ne savait
// plus qu'elle avait à dire « Rétabli ».

/** Une alerte vaut une heure chez le service de push : au-delà, le QG en dit plus qu'elle. */
const TTL_D_UNE_ALERTE_S = 3600
/** Combien de téléphones se préviennent en même temps : cinq au plus, tous d'un coup. */
const EN_VOL = TELEPHONES_PREVENUS_MAX

/** L'empreinte d'un téléphone : seize chiffres du SHA-256 de son adresse, que la page recalcule de son côté. */
export const empreinteDuTelephone = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, EMPREINTE_D_UN_TELEPHONE)

const hoteDe = (endpoint: string) => {
  try {
    return new URL(endpoint).hostname
  } catch {
    return ''
  }
}

const estUnMode = (m: unknown): m is ModeSurveille => typeof m === 'string' && (MODES_SURVEILLES as readonly string[]).includes(m)

export class AlertesDuQg {
  private client: Client

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: {
      /** Les clés du rappel du soir (`RappelStore.clesDuServeur`) : null avant qu'elles soient lues. */
      cles: () => ClesVapid | null
      /** Qui joindre si le serveur abuse (VAPID `sub`). */
      sujet: string
      /** Les adresses d'abonnement acceptées : celles des navigateurs (`serviceDePushConnu`). Les tests ouvrent le leur. */
      servicesDePush?: (url: URL) => boolean
      maintenant?: () => number
    },
  ) {
    this.client = clientDistant(url, authToken)
  }

  /** Les tables, et les pannes qu'un serveur d'avant n'a pas vues se rétablir : la veille les hérite. */
  async init(): Promise<PanneDUnMode[]> {
    const lus = await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS qg_alertes_telephones (
           endpoint TEXT PRIMARY KEY,
           p256dh   TEXT NOT NULL,
           auth     TEXT NOT NULL,
           depuis   INTEGER NOT NULL,
           vu_le    INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS qg_pannes (
           mode          TEXT PRIMARY KEY,
           depuis        INTEGER NOT NULL,
           echecs        INTEGER NOT NULL,
           dernier_echec INTEGER NOT NULL,
           source        TEXT NOT NULL
         )`,
        'SELECT mode, depuis, echecs, dernier_echec, source FROM qg_pannes',
      ],
      'write',
    )
    return lus[lus.length - 1].rows.flatMap(r =>
      estUnMode(r.mode)
        ? [{ mode: r.mode, depuis: Number(r.depuis), echecs: Number(r.echecs), dernierEchec: Number(r.dernier_echec), source: String(r.source) }]
        : [],
    )
  }

  private get maintenant() {
    return (this.deps.maintenant ?? Date.now)()
  }

  /** Les téléphones prévenus, le plus récemment allumé d'abord : leur empreinte, jamais leur adresse. */
  async telephones(): Promise<TelephoneDuQg[]> {
    const r = await this.client.execute('SELECT endpoint, depuis FROM qg_alertes_telephones ORDER BY vu_le DESC')
    return r.rows.map(l => ({ empreinte: empreinteDuTelephone(String(l.endpoint)), service: serviceDuTelephone(hoteDe(String(l.endpoint))), depuis: Number(l.depuis) }))
  }

  /**
   * Ce téléphone sonnera aux pannes : l'abonnement que son service de push lui
   * a donné, relu (`lireAbonnement`). Renouvelé par son service (`ancien`, le
   * service worker), il remplace l'ancien. Cinq téléphones au plus, les plus
   * récemment allumés. Le motif d'un refus se montre tel quel.
   */
  async abonner(brut: unknown, ancien?: unknown): Promise<{ nouveau: boolean; telephones: number; service: string }> {
    const lu = lireAbonnement(brut, this.deps.servicesDePush)
    if ('refus' in lu) throw new Error(lu.refus)
    const maintenant = this.maintenant
    const lot: InStatement[] = []
    if (typeof ancien === 'string' && ancien !== lu.endpoint) lot.push({ sql: 'DELETE FROM qg_alertes_telephones WHERE endpoint = ?', args: [ancien] })
    const res = await this.client.batch(
      [
        { sql: 'SELECT 1 FROM qg_alertes_telephones WHERE endpoint = ?', args: [lu.endpoint] },
        ...lot,
        {
          sql: `INSERT INTO qg_alertes_telephones (endpoint, p256dh, auth, depuis, vu_le) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, vu_le = excluded.vu_le`,
          args: [lu.endpoint, lu.p256dh, lu.auth, maintenant, maintenant],
        },
        {
          sql: `DELETE FROM qg_alertes_telephones WHERE endpoint NOT IN
                  (SELECT endpoint FROM qg_alertes_telephones ORDER BY vu_le DESC LIMIT ?)`,
          args: [TELEPHONES_PREVENUS_MAX],
        },
        'SELECT COUNT(*) AS n FROM qg_alertes_telephones',
      ],
      'write',
    )
    return { nouveau: res[0].rows.length === 0, telephones: Number(res[res.length - 1].rows[0]?.n ?? 0), service: serviceDuTelephone(hoteDe(lu.endpoint)) }
  }

  /** Ce téléphone ne sonnera plus, retrouvé par son empreinte. Rend ceux qui restent ; null s'il n'était pas prévenu. */
  async retirer(empreinte: string): Promise<{ telephones: number } | null> {
    const lus = await this.client.execute('SELECT endpoint FROM qg_alertes_telephones')
    const endpoints = lus.rows.map(r => String(r.endpoint))
    const lui = endpoints.find(e => empreinteDuTelephone(e) === empreinte)
    if (!lui) return null
    await this.client.execute({ sql: 'DELETE FROM qg_alertes_telephones WHERE endpoint = ?', args: [lui] })
    return { telephones: endpoints.length - 1 }
  }

  /**
   * Fait sonner chaque téléphone prévenu. Un téléphone que son service dit mort
   * s'oublie ; un envoi qui échoue se compte, et se dit au journal du serveur.
   * Seule une base muette lève : la liste des téléphones ne se lit pas.
   */
  async prevenir(message: MessageDuQg): Promise<BilanDUneAlerte> {
    const bilan: BilanDUneAlerte = { envoyes: 0, echecs: 0, retires: 0 }
    const cles = this.deps.cles()
    if (!cles) return bilan
    const lus = await this.client.execute('SELECT endpoint, p256dh, auth FROM qg_alertes_telephones')
    const telephones: Abonnement[] = lus.rows.map(r => ({ endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) }))
    for (let i = 0; i < telephones.length; i += EN_VOL) {
      await Promise.all(
        telephones.slice(i, i + EN_VOL).map(async abonnement => {
          try {
            const { statut, motif } = await pousser(abonnement, message, {
              cles,
              sujet: this.deps.sujet,
              ttl: TTL_D_UNE_ALERTE_S,
              // La suivante remplace celle qu'un téléphone éteint n'a pas encore reçue : « Rétabli » efface « Panne ».
              sujetDuMessage: message.tag,
            })
            if (statut >= 200 && statut < 300) bilan.envoyes++
            else if (statut === 404 || statut === 410) {
              await this.client.execute({ sql: 'DELETE FROM qg_alertes_telephones WHERE endpoint = ?', args: [abonnement.endpoint] })
              bilan.retires++
            } else {
              bilan.echecs++
              console.warn(`[alertes] ${hoteDe(abonnement.endpoint)} a refusé une alerte du QG (${statut}) : ${motif || 'sans motif'}`)
            }
          } catch (e) {
            bilan.echecs++
            console.warn(`[alertes] une alerte du QG n’est pas partie (${hoteDe(abonnement.endpoint)}) :`, e instanceof Error ? e.message : e)
          }
        }),
      )
    }
    return bilan
  }

  /** Les pannes dites, gardées jusqu'à leur retour : un redémarrage les hérite. */
  async garderLesPannes(pannes: readonly PanneDUnMode[]): Promise<void> {
    await this.client.batch(
      pannes.map(p => ({
        sql: 'INSERT OR REPLACE INTO qg_pannes (mode, depuis, echecs, dernier_echec, source) VALUES (?, ?, ?, ?, ?)',
        args: [p.mode, p.depuis, p.echecs, p.dernierEchec, p.source],
      })),
      'write',
    )
  }

  async oublierLesPannes(modes: readonly ModeSurveille[]): Promise<void> {
    await this.client.batch(
      modes.map(mode => ({ sql: 'DELETE FROM qg_pannes WHERE mode = ?', args: [mode] })),
      'write',
    )
  }

  close() {
    this.client.close()
  }
}

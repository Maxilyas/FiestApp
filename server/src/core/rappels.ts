// Le rappel du soir du quiz du jour : une notification, une seule par
// téléphone et par jour, vers 18 h à Paris (`HEURE_DU_RAPPEL`), aux profils
// qui l'ont demandée depuis l'application installée et n'ont pas fini leur
// partie. Le protocole est dans `pousser.ts`.
//
// Rien ne le déclenche de l'extérieur : le serveur regarde l'heure chaque
// minute (`tic`), et la tournée part dès 18 h. L'hébergeur ne dort pas à
// cette heure-là — la veille de cron-job.org le tient éveillé de 7 h à
// minuit —, et un serveur qui redémarre dans la soirée la fait en arrivant,
// jusqu'à 22 h (`FIN_DU_RAPPEL`). Elle ne se fait pas deux fois : chaque
// téléphone est réservé en base avant l'envoi (`dernier_jour`) — un
// redémarrage en pleine tournée, ou le second serveur d'un déploiement qui
// chevauche le premier, trouve la place prise. Un rappel perdu en route ne se
// rattrape pas : un de moins vaut mieux qu'un de trop.
//
// Un rappel vaut pour un téléphone resté connecté : il est attaché à la
// session qui l'a demandé (`session_id`), et se défait avec elle — une
// déconnexion, un mot de passe changé, un profil supprimé, un an sans
// revenir. La page du jour le rattache à la session du moment à chaque
// visite (`client/src/rappel.ts`).

import { clientDistant, type Client } from './distante'
import { lireAbonnement, nouvellesCles, pousser, type Abonnement, type ClesVapid } from './pousser'
import type { ProfileStore } from '../auth/profiles'
import type { JourStore } from './jour'
import { FIN_DU_RAPPEL, HEURE_DU_RAPPEL, heureDeParis, jourDe, minutesAvantMinuit } from '../../../shared/jour'
import { espacesFines } from '../../../shared/typographie'

/** L'heure se regarde chaque minute : la tournée part à 18 h, pas à 18 h 59. */
const INTERVALLE_MS = 60_000

/** Après une tournée qui a échoué — la base muette —, on réessaie, sans insister à chaque minute. */
const RELANCE_MS = 5 * 60_000

/** Combien de téléphones se préviennent en même temps. */
const EN_VOL = 8

/**
 * Cinq téléphones par profil, au plus : les plus récemment revus restent. Un
 * appel forgé ne fait pas envoyer mille rappels chaque soir sous un seul
 * profil.
 */
const APPAREILS_MAX = 5

/** Le sujet des messages : un rappel resté en attente chez le service est remplacé par le suivant, jamais doublé. */
const SUJET_DU_MESSAGE = 'quiz-du-jour'

/** Ce que la dernière tournée a fait, pour `/healthz` : des nombres, jamais un nom. */
export interface BilanDeTournee {
  jour: string
  envoyes: number
  /** Ceux qui avaient déjà fini leur partie. */
  finis: number
  /** Les abonnements défaits : session close, ou le service les dit morts. */
  retires: number
  echecs: number
}

/** Ce que la notification dit, en un titre et une phrase. */
export interface MessageDuRappel {
  titre: string
  corps: string
  /** La page que le toucher ouvre. */
  url: string
}

/**
 * Le texte du rappel : la partie commencée à finir, la série à tenir, ou le
 * quiz du jour tout court. Jamais de prénom : une notification se lit sur
 * l'écran verrouillé, par qui le tient.
 */
export function messageDuRappel(s: { total: number; reste: number; serie: number; serieTenue: boolean }): MessageDuRappel {
  const questions = (n: number) => `${n} question${n > 1 ? 's' : ''}`
  if (s.reste < s.total) {
    return {
      titre: 'Ta partie du jour n’est pas finie',
      corps: espacesFines(`Encore ${questions(s.reste)} avant minuit : reprends-la où tu l’as laissée.`),
      url: '/jour',
    }
  }
  return {
    titre: 'Le quiz du jour t’attend',
    corps: espacesFines(
      s.serie >= 2 && !s.serieTenue
        ? `Ta série de ${s.serie} jours tient jusqu’à minuit : ${questions(s.total)}, une seule partie.`
        : `${questions(s.total)}, les mêmes pour tout le monde, jusqu’à minuit.`,
    ),
    url: '/jour',
  }
}

export interface RappelDeps {
  profiles: ProfileStore
  jour: JourStore
  /** L'heure du quiz du jour : les tests la font passer 18 h, puis minuit. */
  maintenant: () => number
  /** Qui joindre si le serveur abuse (VAPID `sub`) : son adresse publique, quand il en a une. */
  sujet: string
  /** Les adresses d'abonnement acceptées : celles des services de push des navigateurs (`serviceDePushConnu`). Les tests ouvrent le leur. */
  servicesDePush?: (url: URL) => boolean
  /** Toutes les combien l'heure se regarde : les tests la regardent plus souvent. */
  intervalleMs?: number
}

export class RappelStore {
  private client: Client
  private cles: ClesVapid | null = null
  /** Le jour dont la tournée est faite, dans ce processus : un redémarrage la relit en base. */
  private faitPour = ''
  private tournee: Promise<void> | null = null
  /** Après un échec, l'heure de la machine où l'on réessaie. */
  private pasAvant = 0
  private minuteur: NodeJS.Timeout | null = null
  private ferme = false
  private derniere: BilanDeTournee | null = null

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: RappelDeps,
  ) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    // Les clés du serveur, tirées au premier démarrage et gardées : un
    // téléphone abonné ne connaît qu'elles, et des clés neuves le rendraient
    // sourd. Deux démarrages de front gardent les premières écrites. Le tout
    // en un aller-retour : chaque réveil de l'hébergeur est un démarrage.
    const neuves = nouvellesCles()
    const lus = await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS jour_rappels (
           endpoint     TEXT PRIMARY KEY,
           profile_id   TEXT NOT NULL,
           session_id   TEXT NOT NULL,
           p256dh       TEXT NOT NULL,
           auth         TEXT NOT NULL,
           vu_le        INTEGER NOT NULL,
           dernier_jour TEXT
         )`,
        `CREATE INDEX IF NOT EXISTS idx_jour_rappels_profil ON jour_rappels(profile_id)`,
        `CREATE TABLE IF NOT EXISTS jour_rappels_cles (
           id       INTEGER PRIMARY KEY CHECK (id = 1),
           publique TEXT NOT NULL,
           privee   TEXT NOT NULL,
           cree_le  INTEGER NOT NULL
         )`,
        {
          sql: 'INSERT OR IGNORE INTO jour_rappels_cles (id, publique, privee, cree_le) VALUES (1, ?, ?, ?)',
          args: [neuves.publique, neuves.privee, Date.now()],
        },
        'SELECT publique, privee FROM jour_rappels_cles WHERE id = 1',
      ],
      'write',
    )
    const cles = lus[lus.length - 1].rows[0]
    if (!cles) throw new Error('Base permanente illisible : les clés du rappel du soir ne se relisent pas')
    this.cles = { publique: String(cles.publique), privee: String(cles.privee) }
  }

  /** La clé publique du serveur, que le téléphone donne à son service de push en s'abonnant. */
  clePublique(): string {
    if (!this.cles) throw new Error('Le rappel du soir n’est pas prêt : réessaie dans un instant')
    return this.cles.publique
  }

  /**
   * Abonne ce téléphone, pour ce profil et cette session — ou l'y rattache :
   * la page du jour le renvoie à chaque visite, et c'est la dernière session
   * qui compte. Le rappel déjà parti aujourd'hui le reste (`dernier_jour`).
   * Abonné après 18 h, le premier rappel est pour demain : on vient de
   * toucher « Me le rappeler » sur la page même du quiz, et la tournée du
   * soir — faite, ou à refaire après un redémarrage — n'a rien à lui
   * apprendre.
   */
  async abonner(profileId: string, sessionId: string, brut: unknown): Promise<void> {
    const lu = lireAbonnement(brut, this.deps.servicesDePush)
    if ('refus' in lu) throw new Error(lu.refus)
    const maintenant = this.deps.maintenant()
    const dejaFait = heureDeParis(maintenant) >= HEURE_DU_RAPPEL ? jourDe(maintenant) : null
    await this.client.batch(
      [
        {
          sql: `INSERT INTO jour_rappels (endpoint, profile_id, session_id, p256dh, auth, vu_le, dernier_jour) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(endpoint) DO UPDATE SET profile_id = excluded.profile_id, session_id = excluded.session_id,
                  p256dh = excluded.p256dh, auth = excluded.auth, vu_le = excluded.vu_le`,
          args: [lu.endpoint, profileId, sessionId, lu.p256dh, lu.auth, Date.now(), dejaFait],
        },
        {
          sql: `DELETE FROM jour_rappels WHERE profile_id = ? AND endpoint NOT IN
                  (SELECT endpoint FROM jour_rappels WHERE profile_id = ? ORDER BY vu_le DESC LIMIT ?)`,
          args: [profileId, profileId, APPAREILS_MAX],
        },
      ],
      'write',
    )
  }

  /** « Couper le rappel » : ce téléphone-là, s'il est bien à lui. */
  async desabonner(profileId: string, endpoint: unknown): Promise<void> {
    if (typeof endpoint !== 'string') return
    await this.client.execute({ sql: 'DELETE FROM jour_rappels WHERE endpoint = ? AND profile_id = ?', args: [endpoint, profileId] })
  }

  /** Un profil supprimé (`/admin`, « Les profils ») : ses téléphones ne sonnent plus. */
  async oublierProfil(profileId: string): Promise<void> {
    await this.client.execute({ sql: 'DELETE FROM jour_rappels WHERE profile_id = ?', args: [profileId] })
  }

  /** La dernière tournée, pour `/healthz`. */
  bilan(): BilanDeTournee | null {
    return this.derniere
  }

  /** Regarde l'heure chaque minute, jusqu'à la fermeture. */
  demarrer() {
    if (this.minuteur || this.ferme) return
    this.minuteur = setInterval(() => void this.tic(), this.deps.intervalleMs ?? INTERVALLE_MS)
    // Une horloge ne retient pas un processus qu'on arrête.
    this.minuteur.unref()
  }

  /**
   * Fait la tournée si c'est l'heure et qu'elle n'est pas faite — rend
   * celle qui est en route, ou null s'il n'y a rien à faire.
   */
  tic(): Promise<void> | null {
    if (this.ferme) return null
    if (this.tournee) return this.tournee
    const maintenant = this.deps.maintenant()
    const jour = jourDe(maintenant)
    const heure = heureDeParis(maintenant)
    if (this.faitPour === jour || heure < HEURE_DU_RAPPEL || heure >= FIN_DU_RAPPEL || Date.now() < this.pasAvant) return null
    this.tournee = this.faireLaTournee(jour)
      .then(() => {
        this.faitPour = jour
      })
      .catch(e => {
        if (this.ferme) return
        this.pasAvant = Date.now() + RELANCE_MS
        console.error('[rappels] la tournée du soir a échoué, elle reprendra dans cinq minutes :', e)
      })
      .finally(() => {
        this.tournee = null
      })
    return this.tournee
  }

  private async faireLaTournee(jour: string) {
    const bilan: BilanDeTournee = { jour, envoyes: 0, finis: 0, retires: 0, echecs: 0 }
    const dus = await this.client.execute({
      sql: 'SELECT endpoint, profile_id, session_id, p256dh, auth FROM jour_rappels WHERE dernier_jour IS NULL OR dernier_jour <> ?',
      args: [jour],
    })
    for (let i = 0; i < dus.rows.length && !this.ferme; i += EN_VOL) {
      await Promise.all(
        dus.rows.slice(i, i + EN_VOL).map(r =>
          this.prevenir(
            jour,
            String(r.profile_id),
            String(r.session_id),
            { endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) },
            bilan,
          ),
        ),
      )
    }
    this.derniere = bilan
    if (dus.rows.length > 0) {
      console.log(
        `[rappels] ${jour} : ${bilan.envoyes} rappel${bilan.envoyes > 1 ? 's' : ''} envoyé${bilan.envoyes > 1 ? 's' : ''}, ` +
          `${bilan.finis} partie${bilan.finis > 1 ? 's' : ''} déjà finie${bilan.finis > 1 ? 's' : ''}, ` +
          `${bilan.retires} abonnement${bilan.retires > 1 ? 's' : ''} retiré${bilan.retires > 1 ? 's' : ''}, ${bilan.echecs} échec${bilan.echecs > 1 ? 's' : ''}`,
      )
    }
  }

  /** Un téléphone : sa session encore ouverte, sa partie pas finie, réservé, puis prévenu. */
  private async prevenir(jour: string, profileId: string, sessionId: string, abonnement: Abonnement, bilan: BilanDeTournee) {
    try {
      if (this.deps.profiles.profilDeLaSession(sessionId) !== profileId || !(await this.deps.profiles.byId(profileId))) {
        await this.retirer(abonnement.endpoint)
        bilan.retires++
        return
      }
      const situation = await this.deps.jour.pourLeRappel(profileId)
      // Pas de quiz aujourd'hui — la réserve à sec — se lit comme une partie finie : rien à rappeler.
      if (situation.reste === 0) {
        bilan.finis++
        return
      }
      // Réservé avant l'envoi : un redémarrage, ou un second serveur, ne
      // l'enverra pas une seconde fois.
      const reserve = await this.client.execute({
        sql: 'UPDATE jour_rappels SET dernier_jour = ? WHERE endpoint = ? AND (dernier_jour IS NULL OR dernier_jour <> ?)',
        args: [jour, abonnement.endpoint, jour],
      })
      if (reserve.rowsAffected === 0 || this.ferme) return
      const { statut, motif } = await pousser(abonnement, messageDuRappel(situation), {
        cles: this.cles!,
        sujet: this.deps.sujet,
        // Gardé jusqu'à minuit pour un téléphone éteint : après, c'est un autre quiz.
        ttl: minutesAvantMinuit(this.deps.maintenant()) * 60,
        sujetDuMessage: SUJET_DU_MESSAGE,
      })
      if (statut >= 200 && statut < 300) bilan.envoyes++
      else if (statut === 404 || statut === 410) {
        // Le téléphone s'est désabonné, ou l'application est partie avec lui.
        await this.retirer(abonnement.endpoint)
        bilan.retires++
      } else {
        bilan.echecs++
        console.warn(`[rappels] ${new URL(abonnement.endpoint).hostname} a refusé un rappel (${statut}) : ${motif || 'sans motif'}`)
      }
    } catch (e) {
      bilan.echecs++
      if (!this.ferme) console.warn(`[rappels] un rappel n’est pas parti (${new URL(abonnement.endpoint).hostname}) :`, e instanceof Error ? e.message : e)
    }
  }

  private async retirer(endpoint: string) {
    await this.client.execute({ sql: 'DELETE FROM jour_rappels WHERE endpoint = ?', args: [endpoint] })
  }

  /** L'heure ne se regarde plus, et rien ne part après : à appeler avant de fermer les bases. */
  arreter() {
    this.ferme = true
    if (this.minuteur) clearInterval(this.minuteur)
    this.minuteur = null
  }

  close() {
    this.arreter()
    this.client.close()
  }
}

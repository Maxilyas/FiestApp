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
//
// Le même téléphone sonne aussi quand un ami lui envoie un défi
// (`prevenirDUnDefi`, le souhait du propriétaire du 11 octobre 2026 : « que
// ça envoie une notif à la personne »). Deux réglages par téléphone, chacun
// sa cloche : le rappel du soir (`soir`, la page du jour) et les défis
// (`defis`, la page des duels). Les défis sont coupés d'office (le souhait
// du propriétaire du 12 octobre 2026 : « la notification pour les défis
// désactivée par défaut ») : seule leur cloche les allume — la cloche du
// soir les allumait avec elle, et un abonnement d'avant les cloches les
// recevait. Les deux coupés, l'abonnement s'efface.

import type { InStatement } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from './distante'
import { lireAbonnement, nouvellesCles, pousser, type Abonnement, type ClesVapid } from './pousser'
import type { ProfileStore } from '../auth/profiles'
import type { JourStore } from './jour'
import { FIN_DU_RAPPEL, HEURE_DU_RAPPEL, heureDeParis, jourDe, minutesAvantMinuit, type ReglagesDesNotifications, type SujetDeNotification } from '../../../shared/jour'
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

/** La colonne de chaque cloche : jamais un mot venu d'une requête dans le SQL. */
const COLONNE: Record<SujetDeNotification, string> = { soir: 'soir', defis: 'defis' }

/** Une semaine au plus chez le service : un défi entre amis ferme au bout d'une semaine. */
const TTL_D_UN_DEFI_MAX_S = 7 * 24 * 3600

/** Les réglages d'une ligne d'abonnement ; sans ligne, il n'est plus abonné. */
function reglagesDe(r: Record<string, unknown> | undefined): ReglagesDesNotifications {
  return { soir: !!r && Number(r.soir) === 1, defis: !!r && Number(r.defis) === 1 }
}

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

/** La notification d'un défi d'ami : un message, et son étiquette — une par défi, la suivante du même remplace celle qu'on n'a pas lue. */
export interface MessageDUnDefi extends MessageDuRappel {
  tag: string
}

/**
 * Le texte d'un défi qu'un ami envoie : qui défie, sur quoi, et le score à
 * battre quand il l'a joué. Le prénom de celui qui l'envoie, cette fois —
 * c'est lui, le message —, jamais celui de qui le reçoit : une notification
 * se lit sur l'écran verrouillé, par qui le tient.
 */
export function messageDUnDefi(d: { auteur: string; quoi: string | null; justes: number | null; code: string }): MessageDUnDefi {
  const sur = d.quoi ? `${d.quoi} · ` : ''
  const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`
  return {
    titre: espacesFines(`${d.auteur} te défie`),
    corps: espacesFines(
      d.justes === null
        ? `${sur}les mêmes questions pour vous deux : une seule tentative, avant qu’il ferme.`
        : `${sur}${bonnes(d.justes)} à battre, sur les mêmes questions : une seule tentative, avant qu’il ferme.`,
    ),
    url: `/duels#duel-${d.code}`,
    tag: `defi-${d.code}`,
  }
}

/**
 * Le texte d'un duel classé que l'autre vient de jouer : les deux scores,
 * l'issue, et ce que le duel a fait à sa cote — le prénom de qui l'a joué,
 * jamais celui de qui le reçoit. Son étiquette à lui : il ne chasse pas un
 * défi qu'on n'a pas encore lu.
 */
export function messageDUnDuelJoue(d: { adversaire: string; justes: number; sesJustes: number; ecart: number | null; code: string }): MessageDUnDefi {
  const issue = d.justes > d.sesJustes ? 'tu gagnes' : d.justes === d.sesJustes ? 'égalité' : 'tu perds'
  const cote = d.ecart === null ? '' : ` : ta cote ${d.ecart >= 0 ? '+' : '−'}${Math.abs(d.ecart)}`
  return {
    titre: espacesFines(`${d.adversaire} a joué votre duel`),
    corps: espacesFines(`${d.justes} à ${d.sesJustes}, ${issue}${cote}.`),
    url: `/duels#duel-${d.code}`,
    tag: `duel-${d.code}`,
  }
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
           dernier_jour TEXT,
           soir         INTEGER NOT NULL DEFAULT 1,
           defis        INTEGER NOT NULL DEFAULT 0
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
    // Les deux cloches d'un téléphone, sur une table d'avant elles : abonné
    // pour le soir, il le reste ; les défis attendent leur cloche, coupés d'office.
    await ajouterColonne(this.client, 'jour_rappels', 'soir', 'INTEGER NOT NULL DEFAULT 1')
    await ajouterColonne(this.client, 'jour_rappels', 'defis', 'INTEGER NOT NULL DEFAULT 0')
  }

  /** La clé publique du serveur, que le téléphone donne à son service de push en s'abonnant. */
  clePublique(): string {
    if (!this.cles) throw new Error('Le rappel du soir n’est pas prêt : réessaie dans un instant')
    return this.cles.publique
  }

  /**
   * Abonne ce téléphone, pour ce profil et cette session — ou l'y rattache :
   * chaque page qui a sa cloche le renvoie à chaque visite, et c'est la
   * dernière session qui compte. `activer` allume la cloche de `quoi` ; sans
   * lui, ses réglages restent. Un téléphone qu'on ne connaît pas — neuf, ou
   * effacé avec une session close — prend la cloche de la page qui le
   * rattache, et elle seule : les défis ne sonnent que si leur cloche les a
   * allumés. Passé d'un profil à un autre (un téléphone qu'on se prête), il
   * repart de là, sans rien garder des réglages du premier. Renouvelé par le
   * service de push (`ancien`), il garde ceux de l'abonnement qu'il remplace.
   *
   * Le rappel déjà parti aujourd'hui le reste (`dernier_jour`). Abonné après
   * 18 h, le premier rappel est pour demain : on vient de toucher la cloche
   * sur la page même du quiz, et la tournée du soir — faite, ou à refaire
   * après un redémarrage — n'a rien à lui apprendre. Rend ses réglages,
   * que la cloche montre.
   */
  async abonner(profileId: string, sessionId: string, brut: unknown, quoi: SujetDeNotification = 'soir', activer = false, ancien?: unknown): Promise<ReglagesDesNotifications> {
    const lu = lireAbonnement(brut, this.deps.servicesDePush)
    if ('refus' in lu) throw new Error(lu.refus)
    const maintenant = this.deps.maintenant()
    const dejaFait = heureDeParis(maintenant) >= HEURE_DU_RAPPEL ? jourDe(maintenant) : null
    let neuf = { soir: quoi === 'soir' ? 1 : 0, defis: quoi === 'defis' ? 1 : 0 }
    const lot: InStatement[] = []
    if (typeof ancien === 'string' && ancien !== lu.endpoint) {
      const avant = await this.client.execute({ sql: 'SELECT soir, defis FROM jour_rappels WHERE endpoint = ? AND profile_id = ?', args: [ancien, profileId] })
      if (avant.rows[0]) neuf = { soir: Number(avant.rows[0].soir), defis: Number(avant.rows[0].defis) }
      lot.push({ sql: 'DELETE FROM jour_rappels WHERE endpoint = ? AND profile_id = ?', args: [ancien, profileId] })
    }
    const allume = (s: SujetDeNotification) => (activer && quoi === s ? 1 : 0)
    const res = await this.client.batch(
      [
        ...lot,
        {
          // SQLite lit l'ancienne ligne pour tout le SET : `jour_rappels.profile_id` est celui d'avant.
          sql: `INSERT INTO jour_rappels (endpoint, profile_id, session_id, p256dh, auth, vu_le, dernier_jour, soir, defis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(endpoint) DO UPDATE SET
                  soir = CASE WHEN jour_rappels.profile_id = excluded.profile_id THEN MAX(jour_rappels.soir, ?) ELSE excluded.soir END,
                  defis = CASE WHEN jour_rappels.profile_id = excluded.profile_id THEN MAX(jour_rappels.defis, ?) ELSE excluded.defis END,
                  profile_id = excluded.profile_id, session_id = excluded.session_id,
                  p256dh = excluded.p256dh, auth = excluded.auth, vu_le = excluded.vu_le`,
          args: [lu.endpoint, profileId, sessionId, lu.p256dh, lu.auth, Date.now(), dejaFait, neuf.soir, neuf.defis, allume('soir'), allume('defis')],
        },
        {
          sql: `DELETE FROM jour_rappels WHERE profile_id = ? AND endpoint NOT IN
                  (SELECT endpoint FROM jour_rappels WHERE profile_id = ? ORDER BY vu_le DESC LIMIT ?)`,
          args: [profileId, profileId, APPAREILS_MAX],
        },
        { sql: 'SELECT soir, defis FROM jour_rappels WHERE endpoint = ?', args: [lu.endpoint] },
      ],
      'write',
    )
    return reglagesDe(res[res.length - 1].rows[0])
  }

  /**
   * Une cloche coupée : ce téléphone-là, s'il est bien à lui. L'autre cloche
   * allumée, il reste abonné pour elle ; les deux coupées, il s'efface — et
   * le téléphone peut se désabonner chez son service.
   */
  async desabonner(profileId: string, endpoint: unknown, quoi: SujetDeNotification = 'soir'): Promise<ReglagesDesNotifications> {
    if (typeof endpoint !== 'string') return { soir: false, defis: false }
    const res = await this.client.batch(
      [
        { sql: `UPDATE jour_rappels SET ${COLONNE[quoi]} = 0 WHERE endpoint = ? AND profile_id = ?`, args: [endpoint, profileId] },
        { sql: 'DELETE FROM jour_rappels WHERE endpoint = ? AND profile_id = ? AND soir = 0 AND defis = 0', args: [endpoint, profileId] },
        { sql: 'SELECT soir, defis FROM jour_rappels WHERE endpoint = ? AND profile_id = ?', args: [endpoint, profileId] },
      ],
      'write',
    )
    return reglagesDe(res[2].rows[0])
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
    // Ceux qui veulent le rappel du soir : un téléphone abonné pour les seuls défis de ses amis ne sonne pas à 18 h.
    const dus = await this.client.execute({
      sql: 'SELECT endpoint, profile_id, session_id, p256dh, auth FROM jour_rappels WHERE soir = 1 AND (dernier_jour IS NULL OR dernier_jour <> ?)',
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

  /**
   * Un défi qu'un ami vient d'envoyer (`CampagneStore.prevenirDuDefi`) : les
   * téléphones de ceux qui le reçoivent sonnent, s'ils en veulent
   * (`defis`). Comme le rappel du soir : une session encore ouverte, et un
   * abonnement que le service dit mort s'efface. Rien à réserver : un défi
   * ne part qu'une fois à chacun (`campagne_envois`), et ne sonne qu'avec
   * lui. Son étiquette (`tag`) en fait le sujet du message : un défi resté
   * en attente chez le service n'arrive qu'une fois.
   */
  async prevenirDUnDefi(profileIds: readonly string[], message: MessageDUnDefi, ttlS: number): Promise<{ envoyes: number; retires: number; echecs: number }> {
    const bilan = { envoyes: 0, retires: 0, echecs: 0 }
    if (this.ferme || !this.cles || profileIds.length === 0) return bilan
    const abonnes = await this.client.execute({
      sql: `SELECT endpoint, profile_id, session_id, p256dh, auth FROM jour_rappels WHERE defis = 1 AND profile_id IN (${profileIds.map(() => '?').join(', ')})`,
      args: [...profileIds],
    })
    const ttl = Math.max(60, Math.min(ttlS, TTL_D_UN_DEFI_MAX_S))
    for (let i = 0; i < abonnes.rows.length && !this.ferme; i += EN_VOL) {
      await Promise.all(
        abonnes.rows.slice(i, i + EN_VOL).map(async r => {
          const profileId = String(r.profile_id)
          const abonnement = { endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) }
          try {
            if (this.deps.profiles.profilDeLaSession(String(r.session_id)) !== profileId || !(await this.deps.profiles.byId(profileId))) {
              await this.retirer(abonnement.endpoint)
              bilan.retires++
              return
            }
            const { statut, motif } = await pousser(abonnement, message, { cles: this.cles!, sujet: this.deps.sujet, ttl, sujetDuMessage: message.tag })
            if (statut >= 200 && statut < 300) bilan.envoyes++
            else if (statut === 404 || statut === 410) {
              await this.retirer(abonnement.endpoint)
              bilan.retires++
            } else {
              bilan.echecs++
              console.warn(`[rappels] ${new URL(abonnement.endpoint).hostname} a refusé un défi (${statut}) : ${motif || 'sans motif'}`)
            }
          } catch (e) {
            bilan.echecs++
            if (!this.ferme) console.warn(`[rappels] un défi n’a pas sonné (${new URL(abonnement.endpoint).hostname}) :`, e instanceof Error ? e.message : e)
          }
        }),
      )
    }
    return bilan
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

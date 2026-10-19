import type { NextFunction, Request, Response } from 'express'
import { releve } from './pouls'
import { veille } from './veille'
import { tronquer } from '../../../shared/avatars'

/** Ce que lit l'utilisateur quand la panne ne le regarde pas. */
export const ERREUR_SERVEUR = 'Erreur serveur — réessaie dans un instant'

/**
 * Vrai si le message de cette erreur est fait pour être lu.
 *
 * Le code lève exprès des `Error` nus, en français, pour la personne devant
 * l'écran : « Cet identifiant est déjà pris », « Photo trop lourde ». Tout le
 * reste vient des entrailles — LibsqlError, SqliteError, TypeError,
 * SyntaxError… — et parle de tables, de colonnes, voire recopie le début
 * d'une ligne de la base : rien qui aide un invité, tout ce qui renseigne un
 * curieux. Les erreurs du système (ENOENT, ECONNRESET…) sont des `Error` nus
 * elles aussi, mais elles portent un `code`, et souvent un chemin du serveur.
 *
 * La règle tient donc à la classe : une erreur destinée à l'utilisateur se
 * lève avec `new Error('…')`, et rien d'autre.
 */
export function erreurMontrable(e: unknown): e is Error {
  return e instanceof Error && e.constructor === Error && !('code' in e)
}

/**
 * Répond une erreur levée dans une route : son message si elle est faite
 * pour ça (400), une phrase neutre sinon (500) — le détail, lui, part au
 * journal, où l'on en a besoin pour réparer.
 */
export function repondreErreur(req: Request, res: Response, e: unknown) {
  if (erreurMontrable(e)) {
    if (!res.headersSent) res.status(400).json({ error: e.message })
    return
  }
  console.error(`[http] ${req.method} ${req.path} :`, e)
  // Au relevé de l'heure, la route sous son modèle — jamais son adresse, qui peut porter un identifiant —, et ce qu'elle était.
  releve.erreur(`${req.method} ${typeof req.route?.path === 'string' ? req.route.path : 'hors route'}`, e)
  if (!res.headersSent) res.status(500).json({ error: ERREUR_SERVEUR })
}

/** Express 4 n'attrape pas les rejets de promesse : on le fait ici. */
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
    fn(req, res).catch((e: unknown) => repondreErreur(req, res, e))
  }

/**
 * Ce qu'une panne dit à l'écran commun, par un toast. Il est projeté sur la
 * TV : un message voulu (« Quiz introuvable ») s'y lit tel quel, une erreur
 * des entrailles n'a rien à y faire — même règle que pour les routes, et le
 * détail part au journal, où l'on en a besoin pour réparer.
 */
export function messagePourEcran(e: unknown, contexte: string): string {
  if (erreurMontrable(e)) return e.message
  console.error(`[socket] ${contexte} :`, e)
  releve.erreur(`socket ${contexte}`, e)
  // Le message, lui, a abouti — son toast part — : la veille compte l'échec à côté de sa réussite (`core/veille.ts`).
  veille.noter(`socket ${contexte}`, false)
  return ERREUR_SERVEUR
}

/** Les en-têtes par lesquels une requête annonce un corps : ce qu'un refus du lecteur JSON laisse au journal. */
const ANNONCE_DU_CORPS = ['content-type', 'content-length', 'transfer-encoding', 'content-encoding'] as const

/**
 * Le dernier filet d'Express : une requête qu'il n'a pas su lire — un JSON
 * cassé, un corps trop lourd. Sans lui, Express répondait par sa propre page
 * d'erreur, en HTML, pile d'appels et chemins du serveur compris dès que
 * `NODE_ENV` ne vaut pas « production » — ce que l'hébergeur ne pose pas. Et
 * un client qui attend du JSON ne comprenait rien à ce qui lui arrivait.
 */
export function erreurDeRequete(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err)
  const status = (err as { status?: unknown } | null)?.status
  if (typeof status === 'number' && status >= 400 && status < 500) {
    // Un refus ne laissait rien au journal : le « Requête illisible » vu une
    // fois au téléphone (le 14 octobre 2026) ne disait ni ce qui n'avait pas
    // pu se lire, ni comment la requête annonçait son corps. La sorte du
    // lecteur (`entity.parse.failed`…) et ces en-têtes le disent ; jamais le
    // corps, ni le message du lecteur, qui en cite le début — un mot de passe
    // y passe. Un fichier absent (404) est l'ordinaire : il se tait.
    if (status !== 404) {
      const type = (err as { type?: unknown }).type
      const annonce = ANNONCE_DU_CORPS.map(h => `${h}: ${tronquer(String(req.headers[h] ?? '—'), 60)}`).join(', ')
      console.warn(`[http] ${req.method} ${req.path} : ${status} ${typeof type === 'string' ? type : err instanceof Error ? err.name : typeof err} (${annonce})`)
    }
    res.status(status).json({
      error: status === 413 ? 'Envoi trop lourd — allège-le et réessaie' : 'Requête illisible — recharge la page et réessaie',
    })
    return
  }
  console.error(`[http] ${req.method} ${req.path} :`, err)
  // Celle du lecteur du corps — elle dit sa sorte (`type`) — sans son message :
  // il peut citer le corps de la requête, et le QG le montrerait. Une autre —
  // une route qui a levé sans `wrap` — le garde.
  releve.erreur('requête illisible', err, { sansMessage: typeof (err as { type?: unknown } | null)?.type === 'string' })
  res.status(500).json({ error: ERREUR_SERVEUR })
}

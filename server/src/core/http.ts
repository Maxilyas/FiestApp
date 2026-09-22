import type { Request, Response } from 'express'

/** Ce que lit l'utilisateur quand la panne ne le regarde pas. */
export const ERREUR_SERVEUR = 'Erreur serveur — réessaie dans un instant'

/**
 * Vrai si le message de cette erreur est fait pour être lu.
 *
 * Le code lève exprès des `Error` nus, en français, pour la personne devant
 * l'écran : « Cet identifiant est déjà pris », « Image trop lourde ». Tout le
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
  if (!res.headersSent) res.status(500).json({ error: ERREUR_SERVEUR })
}

/** Express 4 n'attrape pas les rejets de promesse : on le fait ici. */
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
    fn(req, res).catch((e: unknown) => repondreErreur(req, res, e))
  }

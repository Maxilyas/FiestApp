import { createClient, LibsqlError, type Client, type IntMode } from '@libsql/client'

export type { Client }

/**
 * La base permanente, avec un délai.
 *
 * Sans délai, une requête vers une base qui ne répond plus attend que le
 * système abandonne : 301 secondes mesurées. Au démarrage, le serveur restait
 * suspendu sans un mot ; en pleine soirée, une inscription avec un profil pas
 * encore en mémoire faisait patienter le téléphone tout ce temps — et comme
 * le client ne lance que vingt requêtes à la fois, vingt requêtes bloquées
 * gelaient toutes les suivantes, miroir de la partie compris.
 *
 * Dix secondes : Turso répond en quelques dizaines de millisecondes, et même
 * réveillé à froid il ne met pas ce temps-là. Au-delà, ce n'est plus de la
 * lenteur, c'est une panne — autant la dire.
 */
export const DELAI_DISTANT_MS = 10_000

/** Une base qui n'a pas répondu à temps. */
export class BaseMuette extends Error {
  constructor(delaiMs: number) {
    super(`la base permanente n’a pas répondu en ${delaiMs / 1000} s`)
    this.name = 'BaseMuette'
  }
}

/**
 * Le client libsql des cinq magasins de la base permanente, et des scripts.
 *
 * Le délai enveloppe le `fetch` du client HTTP (celui qu'emprunte une URL
 * `libsql://` de Turso) : il borne l'aller-retour entier, réponse lue
 * comprise. Une base `file:` ne passe jamais par `fetch` — pour elle, rien ne
 * change.
 */
export function clientDistant(
  url: string,
  authToken?: string,
  reglages: { delaiMs?: number; intMode?: IntMode } = {},
): Client {
  const delaiMs = reglages.delaiMs ?? DELAI_DISTANT_MS
  return createClient({ url, authToken, intMode: reglages.intMode, fetch: avecDelai(delaiMs) })
}

function avecDelai(delaiMs: number) {
  return async (requete: Request): Promise<Response> => {
    try {
      return await fetch(requete, { signal: AbortSignal.timeout(delaiMs) })
    } catch (e) {
      // L'erreur d'origine (« The operation was aborted due to timeout ») ne
      // dit ni quoi, ni combien de temps : on la remplace par une phrase.
      if (e instanceof DOMException && e.name === 'TimeoutError') throw new BaseMuette(delaiMs)
      throw e
    }
  }
}

/**
 * Pourquoi une erreur dit que la base permanente est hors d'atteinte — ou
 * null si elle dit autre chose : une requête fautive prouve au contraire que
 * la base répond. Sert au démarrage, pour nommer la variable à vérifier au
 * lieu d'une pile que personne ne sait lire sur le tableau de bord.
 */
export function pourquoiInjoignable(e: unknown): string | null {
  if (e instanceof BaseMuette) return e.message
  // Le délai peut aussi tomber pendant la lecture de la réponse, après
  // `fetch` : l'erreur remonte alors telle quelle.
  if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return 'la base permanente n’a pas répondu à temps'
  }
  // Le réseau : nom introuvable, connexion refusée, certificat… Le détail
  // utile est dans la cause, pas dans « fetch failed ».
  if (e instanceof TypeError && e.message === 'fetch failed') {
    const cause = (e as { cause?: { code?: string; message?: string } }).cause
    return `réseau — ${cause?.code ?? cause?.message ?? 'connexion impossible'}`
  }
  if (e instanceof LibsqlError) {
    const code = e.code ?? ''
    if (code === 'SQLITE_ERROR' || code.startsWith('SQLITE_CONSTRAINT')) return null
    // Le message de libsql cite l'adresse telle quelle : si c'est un jeton
    // collé dans la mauvaise case, il finirait dans le journal, lisible de tous.
    if (code.startsWith('URL_')) return 'adresse mal formée — elle commence par libsql://, https:// ou file:'
    // Jeton refusé, base supprimée, fichier illisible.
    return e.message
  }
  return null
}

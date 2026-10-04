import { createClient, LibsqlError, type Client, type IntMode } from '@libsql/client'
import { pouls } from './pouls'

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

/** Les colonnes d'une table de la base permanente, telles que son schéma les dit. */
async function colonnesDe(client: Client, table: string): Promise<string[]> {
  return (await client.execute(`PRAGMA table_info(${table})`)).rows.map(c => String(c.name))
}

/**
 * Le schéma de chaque table, lu une fois par client : un magasin ajoute
 * jusqu'à six colonnes à la même table, et chaque ajout relisait son schéma
 * — vingt-quatre allers-retours en série à chaque réveil, près d'une seconde
 * à 40 ms. Ce que ce processus ajoute s'y inscrit ; ce qu'un autre ajouterait
 * pendant ce temps, l'ALTER refusé le fait relire (plus bas).
 */
const schemas = new WeakMap<Client, Map<string, Promise<string[]>>>()

function schemaDe(client: Client, table: string): Promise<string[]> {
  let tables = schemas.get(client)
  if (!tables) schemas.set(client, (tables = new Map()))
  let lu = tables.get(table)
  if (!lu) {
    lu = colonnesDe(client, table)
    tables.set(table, lu)
    // Une lecture qui échoue ne reste pas : la suivante relit la base.
    lu.catch(() => tables!.delete(table))
  }
  return lu
}

/**
 * Ajoute une colonne à une table de la base permanente — si elle lui manque.
 * Rend vrai si elle a été ajoutée.
 *
 * libsql n'a pas d'« ADD COLUMN IF NOT EXISTS ». Chaque magasin tentait
 * l'ALTER et prenait tout refus pour « la colonne existe déjà » : une base
 * qui décrochait au premier démarrage d'une nouvelle version laissait la
 * colonne absente, sans un mot, et la panne ne se voyait qu'à la première
 * écriture qui la nommait — ou jamais, pour une colonne qu'on ne fait que
 * lire. C'est le motif qu'on a déjà retiré d'`ArchiveStore.init`, où il
 * envoyait toutes les archives chez l'espace par défaut.
 *
 * La présence se LIT dans le schéma, et toute autre erreur remonte : le
 * démarrage échoue, bruyamment, et l'hébergeur le relance sur une base qui
 * répond. Une seule exception, relue elle aussi dans le schéma : la colonne
 * que quelqu'un d'autre vient d'ajouter — un second démarrage sur la même
 * base, ou un ALTER abouti dont la réponse s'est perdue en route.
 */
export async function ajouterColonne(client: Client, table: string, colonne: string, type: string): Promise<boolean> {
  const avant = await schemaDe(client, table)
  if (avant.includes(colonne)) return false
  // Une table qu'on vient de créer et dont le schéma revient vide : la base
  // dit n'importe quoi, et migrer sur cette foi serait tout miser sur elle.
  if (avant.length === 0) throw new Error(`Base permanente illisible : la table ${table} n’a renvoyé aucune colonne`)
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${type}`)
  } catch (e) {
    const apres = await colonnesDe(client, table).catch((): string[] => [])
    if (!apres.includes(colonne)) throw e
    avant.push(colonne)
    return false
  }
  avant.push(colonne)
  return true
}

export function avecDelai(delaiMs: number) {
  return async (requete: Request): Promise<Response> => {
    const debut = performance.now()
    try {
      const reponse = await fetch(requete, { signal: AbortSignal.timeout(delaiMs) })
      // Chaque `execute`, chaque `batch` passe ici : `/healthz` dit ce
      // qu'un aller-retour vers Turso coûte vraiment (`pouls.base`).
      pouls.base.noter(performance.now() - debut)
      return reponse
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

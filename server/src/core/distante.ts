import { createClient, LibsqlError, type Client, type InArgs, type InStatement, type IntMode, type TransactionMode } from '@libsql/client'
import { tronquer } from '../../../shared/avatars'
import { noterLaReponse, noterUnEchec, refermerLesAttardees, suivreLaBase, unAllerRetourPart } from './connexions'
import { pouls, releve } from './pouls'
import { coutDeLAllerRetour } from './quotaDeTurso'
import { fetchLeger } from './transportLeger'

export type { Client }

/**
 * Par où passent les allers-retours vers une base distante : le `fetch` de
 * Node (undici), ou le transport léger (`core/transportLeger.ts`), deux fois
 * moins coûteux au processeur — `QUIZ_DB_TRANSPORT=leger`, qui s'essaie en
 * préproduction avant la production, la page « Le serveur » du QG ouverte.
 * Un pour tout le processus, comme ses connexions.
 */
export type TransportDeLaBase = 'fetch' | 'leger'

let transport: TransportDeLaBase = 'fetch'

/** Le transport des clients qui partent ensuite — et des allers-retours de ceux déjà ouverts (`avecDelai` le relit à chacun). */
export function choisirLeTransport(choisi: TransportDeLaBase) {
  transport = choisi
}

export function transportDeLaBase(): TransportDeLaBase {
  return transport
}

/**
 * Ce que demande `QUIZ_DB_TRANSPORT` : `leger` (ou `léger`) le transport
 * léger, `fetch` ou rien celui de Node ; autre chose, un refus qui dit quoi
 * écrire.
 */
export function transportDemande(texte: string | undefined): { transport: TransportDeLaBase } | { refus: string } {
  const lu = texte?.trim().toLowerCase()
  if (!lu || lu === 'fetch' || lu === 'undici') return { transport: 'fetch' }
  if (lu === 'leger' || lu === 'léger') return { transport: 'leger' }
  return {
    refus:
      `QUIZ_DB_TRANSPORT illisible (« ${texte!.trim()} ») : leger pour le transport léger vers la base, ` +
      'deux fois moins coûteux au processeur ; fetch ou rien pour celui de Node. Les allers-retours passent par le fetch de Node.',
  }
}

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
 * Ce qu'un appel à la base distante — un `execute`, un `batch` — a de plus
 * que son aller-retour avant d'être déclaré resté en route (`clientBorne`) :
 * sa place dans la file de vingt du client, le décodage des lignes, au
 * dixième de cœur de l'hébergeur. Dix secondes et cinq : avant les vingt au
 * bout desquelles la page abandonne d'elle-même (`DELAI_REQUETE_MS`,
 * `client/src/api.ts`), et la requête suivante passe à temps.
 */
export const MARGE_D_UN_APPEL_MS = 5_000

/**
 * Un appel resté en route au-delà de son aller-retour et de sa marge : une
 * erreur du serveur, comptée au relevé de l'heure avec le début de sa
 * requête — jamais ses paramètres, ni un message pour l'invité.
 */
export class AppelEnRoute extends Error {
  constructor(quoi: string, ms: number) {
    super(`appel à la base resté en route ${Math.round(ms / 1000)} s : ${quoi}`)
    this.name = 'AppelEnRoute'
  }
}

/**
 * Le client libsql des cinq magasins de la base permanente, et des scripts.
 *
 * Le délai enveloppe le `fetch` du client HTTP (celui qu'emprunte une URL
 * `libsql://` de Turso) : il borne l'aller-retour entier, réponse lue
 * comprise. Une base `file:` ne passe jamais par `fetch` — pour elle, rien ne
 * change. `battement` : le client de l'entretien des connexions, dont les
 * allers-retours ne comptent pas comme ceux qu'on attend (`connexions.ts`).
 * Une base distante a de plus chaque appel borné (`clientBorne`).
 */
export function clientDistant(
  url: string,
  authToken?: string,
  reglages: { delaiMs?: number; intMode?: IntMode; battement?: boolean } = {},
): Client {
  const delaiMs = reglages.delaiMs ?? DELAI_DISTANT_MS
  // Ses connexions se comptent par l'hôte de son adresse (`connexions.ts`).
  suivreLaBase(url)
  const creer = () => createClient({ url, authToken, intMode: reglages.intMode, fetch: avecDelai(delaiMs, { battement: reglages.battement }) })
  return url.startsWith('file:') ? creer() : clientBorne(creer, delaiMs + MARGE_D_UN_APPEL_MS)
}

/** Le début d'une requête, pour le journal : son texte, sans ses paramètres. */
function debutDe(instruction: unknown): string {
  const sql = typeof instruction === 'string' ? instruction : Array.isArray(instruction) ? instruction[0] : (instruction as { sql?: unknown } | null)?.sql
  return typeof sql === 'string' ? tronquer(sql.replace(/\s+/g, ' ').trim(), 80) : '?'
}

/**
 * Un client dont chaque appel échoue au bout de `dureeMs` (`AppelEnRoute`),
 * même si rien en dessous n'a rendu la main — et dont l'appel suivant part
 * d'un client neuf.
 *
 * Le délai du `fetch` ne suffit pas. En production, le 15 octobre 2026, une
 * lecture des missions du propriétaire n'est jamais revenue, sans une erreur
 * au journal (`core/missions.ts` borne les siennes depuis). Le 19, le modèle
 * du savoir, lancé au démarrage, n'a jamais fini ni échoué ; depuis minuit,
 * sur quatre démarrages de suite, plus un duel, une épreuve, une série ni le
 * défi de la semaine ne s'était tiré — « Le serveur ne répond pas », quand
 * le quiz du jour se jouait. On n'a pas su le reproduire. Derrière un
 * verrou — celui d'un profil, celui du tirage du défi — ou une lecture
 * partagée — la mesure des difficultés, que tout tirage attend —, une seule
 * lecture figeait tout ce qui l'attendait, jusqu'au redémarrage. Bornée,
 * elle échoue comme une base muette : le verrou se libère, la requête
 * suivante passe.
 *
 * Le client neuf, parce que le client libsql ne lance que vingt requêtes à la
 * fois : celle qui ne revient pas garderait sa place pour toujours. L'ancien
 * n'est fermé qu'avec le serveur — ses autres requêtes en vol finissent
 * d'elles-mêmes. Le début de la requête restée en route part au journal et
 * au relevé de l'heure (`base · appel resté en route`) : la page « Le
 * serveur » du QG dira laquelle, la prochaine fois. Un client `file:` n'en a
 * pas besoin : il ne passe pas par le réseau.
 *
 * Ce début ne se lit qu'une fois l'appel resté en route (`quoi`, une
 * fonction) : calculé à chaque appel, il repassait le texte de chaque requête
 * — une expression rationnelle, puis `tronquer`, qui le découpe en
 * caractères — à chaque aller-retour, au dixième de cœur de l'hébergeur ;
 * le profil de l'accueil l'a montré.
 */
export function clientBorne(creer: () => Client, dureeMs: number): Client {
  let client = creer()
  const remplaces: Client[] = []
  const borne = <T>(quoi: () => string, appel: (c: Client) => Promise<T>): Promise<T> => {
    const parti = client
    let lance: Promise<T>
    try {
      lance = appel(parti)
    } catch (e) {
      return Promise.reject(e)
    }
    let minuteur: ReturnType<typeof setTimeout> | undefined
    const enRoute = new Promise<never>((_, rejeter) => {
      minuteur = setTimeout(() => {
        const e = new AppelEnRoute(quoi(), dureeMs)
        console.error(`[base] ${e.message} — la suite part d’un client neuf`)
        releve.erreur('base · appel resté en route', e)
        if (client === parti) {
          remplaces.push(parti)
          client = creer()
        }
        rejeter(e)
      }, dureeMs)
    })
    return Promise.race([lance, enRoute]).finally(() => clearTimeout(minuteur))
  }
  return {
    execute: ((instruction: InStatement | string, args?: InArgs) =>
      borne(
        () => debutDe(instruction),
        c => (typeof instruction === 'string' ? c.execute(instruction, args) : c.execute(instruction)),
      )) as Client['execute'],
    batch: (instructions, mode) =>
      borne(
        () => `lot de ${instructions.length} : ${debutDe(instructions[0])}`,
        c => c.batch(instructions, mode),
      ),
    migrate: instructions =>
      borne(
        () => `migration de ${instructions.length} : ${debutDe(instructions[0])}`,
        c => c.migrate(instructions),
      ),
    executeMultiple: sql =>
      borne(
        () => debutDe(sql),
        c => c.executeMultiple(sql),
      ),
    // Aucun magasin n'en ouvre : elle passe telle quelle, sans borne.
    transaction: ((mode?: TransactionMode) => client.transaction(mode)) as Client['transaction'],
    sync: () => client.sync(),
    close: () => {
      for (const c of remplaces.splice(0)) c.close()
      client.close()
    },
    reconnect: () => client.reconnect(),
    get closed() {
      return client.closed
    },
    get protocol() {
      return client.protocol
    },
  }
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

/**
 * La réponse, dont le client libsql lira le corps par `json()` : ce que
 * l'aller-retour a coûté au quota de Turso se relève à ce moment-là, sur ce
 * qu'il vient de décoder — rien ne se décode deux fois (`coutDeLAllerRetour`,
 * `releve.quota`). Sous son propre filet : le compte qui tombe se tait, la
 * réponse part.
 */
function compterLeQuota<R extends { json(): Promise<unknown> }>(reponse: R, corps: string | null): R {
  const json = reponse.json.bind(reponse)
  reponse.json = async () => {
    const lu = await json()
    try {
      const cout = coutDeLAllerRetour(lu, () => corps)
      if (cout) releve.quota(cout)
    } catch (e) {
      console.error('[base] le coût d’un aller-retour ne se lit pas :', e)
    }
    return lu
  }
  return reponse
}

export function avecDelai(delaiMs: number, reglages: { battement?: boolean } = {}) {
  return async (requete: Request): Promise<Response> => {
    // Une connexion que la boucle gelée a gardée au-delà de la garde de Node
    // ne porte plus rien : Turso l'a peut-être fermée pendant le gel
    // (`connexions.ts`).
    refermerLesAttardees()
    // Son corps, lu une fois : la requête part avec, et le relevé du quota y
    // lit le texte d'une instruction lourde (`compterLeQuota`).
    const corps = requete.body ? await requete.text() : null
    const debut = performance.now()
    // Un battement de l'entretien (`connexions.ts`) n'est pas un aller-retour
    // qu'on attend : ses trente millisecondes feraient passer Turso pour plus
    // rapide qu'il ne l'est pour un joueur, et l'entretien les compte à part.
    const arrive = reglages.battement ? null : unAllerRetourPart()
    // Chaque `execute`, chaque `batch` passe ici : `/healthz` dit ce qu'un
    // aller-retour vers Turso coûte vraiment (`pouls.base`), et la page « Le
    // serveur » du QG s'en souvient heure par heure (`releve`) — compté jusqu'à
    // ses en-têtes, où le `fetch` de Node rend sa réponse, et où le délai que
    // la base annonce se lit : le transport léger les dit en route.
    const entetes = (lues: { get(nom: string): string | null }) => {
      const ms = performance.now() - debut
      if (arrive) {
        pouls.base.noter(ms)
        releve.base(ms)
      }
      noterLaReponse(lues)
    }
    try {
      // Le transport léger rend ce que le client libsql lit d'une réponse, sans
      // ses objets du web : c'est tout ce qu'il en lit (`ReponseLegere`).
      if (transport === 'leger') return compterLeQuota(await fetchLeger(requete, delaiMs, entetes, corps), corps) as unknown as Response
      const reponse =
        corps === null
          ? await fetch(requete, { signal: AbortSignal.timeout(delaiMs) })
          : await fetch(requete.url, { method: requete.method, headers: requete.headers, body: corps, signal: AbortSignal.timeout(delaiMs) })
      entetes(reponse.headers)
      return compterLeQuota(reponse, corps)
    } catch (e) {
      // Une connexion que la base avait fermée se verrait ici d'abord, et la
      // requête qui tombe avec. Un battement tombé, l'entretien le compte.
      if (arrive) noterUnEchec()
      // L'erreur d'origine (« The operation was aborted due to timeout ») ne
      // dit ni quoi, ni combien de temps : on la remplace par une phrase.
      if (e instanceof DOMException && e.name === 'TimeoutError') throw new BaseMuette(delaiMs)
      throw e
    } finally {
      arrive?.()
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
  if (e instanceof BaseMuette || e instanceof AppelEnRoute) return e.message
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
  // Le même réseau, par le transport léger : l'erreur du système, sans
  // enveloppe — son code dit tout (ENOTFOUND, ECONNREFUSED, un certificat…).
  const code = (e as { code?: unknown } | null)?.code
  if (e instanceof Error && typeof code === 'string' && code) return `réseau — ${code}`
  return null
}

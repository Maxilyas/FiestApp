import http from 'node:http'
import https from 'node:https'
import type { Socket } from 'node:net'
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib'
import { connexionEmpruntee, connexionOuverte, connexionRefermeeParNous, connexionRendue, gardeDesConnexions } from './connexions'

// Le transport léger vers la base permanente (`QUIZ_DB_TRANSPORT=leger`) : les
// allers-retours du client libsql sur `http.request` / `https.request` de
// Node, à la place de son `fetch` (undici).
//
// Le banc du gel l'a mesuré (`retours/2026-10-16/`, perf-gel-2 ; repris le
// 19 octobre 2026) : 60 % du processeur d'une requête partait dans le client
// de la base, et le plus gros dans le `fetch` — ses objets du web (`Request`,
// `Response`, les flux), ses en-têtes, sa décompression. Au dixième de cœur
// de l'hébergeur, chaque milliseconde en coûte dix. Sur ce transport, un
// aller-retour coûte deux fois moins de processeur au client (0,4 à 0,7 ms
// au lieu de 1 à 1,3), et les routes de l'accueil un tiers de moins
// (l'accueil 37,9 → 24,7 ms, la page du profil 40,6 → 23,2, les missions
// 20,4 → 15,3).
//
// Ce qu'il garde du `fetch` : la garde des connexions — libre plus longtemps
// que `gardeDesConnexions`, une connexion se referme, avant les 5 s où Turso
// la ferme lui-même —, les comptes de `connexions.ts` (ouverte, empruntée,
// rendue, refermée par la base), l'entretien qui les garde chaudes et le délai
// d'`avecDelai`, qui borne ici l'aller-retour entier, réponse lue comprise.
// Ce qu'il change : il ne demande pas de compression — Turso répond en clair,
// rien à décompresser —, et il n'ouvre pas plus de `CONNEXIONS_AU_PLUS`
// connexions à la fois : les treize requêtes de l'accueil attendaient chacune
// sa poignée de main, au dixième de cœur, quand quelques connexions chaudes
// les servent l'une après l'autre en quelques dizaines de millisecondes.

/**
 * Les connexions ouvertes vers la base, au plus, tous magasins ensemble :
 * au-delà, une requête attend la première qui se libère. Turso répond en
 * 30 ms sur une connexion gardée : huit en servent deux cents à la seconde,
 * bien plus que le dixième de cœur n'en lance ; une poignée de main TLS de
 * plus coûte au serveur ce que coûtent dix allers-retours.
 */
export const CONNEXIONS_AU_PLUS = 8

/** Ce que le client libsql lit d'une réponse : ni flux, ni objet du web — le corps est déjà là. */
export interface ReponseLegere {
  ok: boolean
  status: number
  headers: { get(nom: string): string | null }
  json(): Promise<unknown>
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
  body: { cancel(): Promise<void> }
}

/**
 * Garde une connexion libre selon la base (`gardeDesConnexions`), comme
 * undici : l'agent de Node la garderait jusqu'à ce que Turso la ferme — et la
 * requête partie sur elle à ce moment tomberait (« socket hang up »).
 */
function garderSelonLaBase<A extends http.Agent>(agent: A): A {
  agent.keepSocketAlive = (socket: Socket) => {
    const garde = gardeDesConnexions()
    // Une base qui n'accorde pas de quoi garder une connexion : elle se referme aussitôt — par nous.
    if (garde <= 0) {
      connexionRefermeeParNous(socket)
      return false
    }
    socket.setKeepAlive(true, 1_000)
    socket.unref()
    // Libre plus longtemps que la garde, l'agent la détruit (son écouteur de
    // `timeout` ne touche que les connexions libres).
    socket.setTimeout(garde)
    return true
  }
  return agent
}

// La dernière rendue d'abord (`lifo`, le choix de Node) : les autres
// vieillissent, et se referment à leur garde. Sûr avec `refermerLesAttardees` :
// l'agent ne saute les connexions détruites qu'en tête de sa liste, et les
// attardées qu'elle détruit sont les plus anciennement rendues — en tête.
// Détruire une connexion rendue à l'instant demanderait `fifo`.
const agents = {
  'http:': garderSelonLaBase(new http.Agent({ keepAlive: true, maxSockets: CONNEXIONS_AU_PLUS, scheduling: 'lifo' })),
  'https:': garderSelonLaBase(new https.Agent({ keepAlive: true, maxSockets: CONNEXIONS_AU_PLUS, scheduling: 'lifo' })),
}

/**
 * Les connexions que ce transport a déjà vues : une neuve se compte une fois.
 * `reusedSocket` ne suffit pas à le dire — l'agent qui passe une connexion
 * libérée à une requête en attente ne le pose pas.
 */
const vues = new WeakSet<Socket>()

/** Un corps que la base aurait compressé quand même — un proxy devant elle : on le rend en clair. */
function enClair(corps: Buffer, encodage: string | undefined): Buffer {
  switch (encodage?.trim().toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return gunzipSync(corps)
    case 'deflate':
      return inflateSync(corps)
    case 'br':
      return brotliDecompressSync(corps)
    default:
      return corps
  }
}

function lecteurDEntetes(entetes: http.IncomingHttpHeaders): ReponseLegere['headers'] {
  return {
    get: nom => {
      const v = entetes[nom.toLowerCase()]
      return v === undefined ? null : Array.isArray(v) ? v.join(', ') : v
    },
  }
}

function reponseDe(statut: number, entetes: ReponseLegere['headers'], corps: Buffer): ReponseLegere {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    headers: entetes,
    json: async () => JSON.parse(corps.toString('utf8')),
    text: async () => corps.toString('utf8'),
    arrayBuffer: async () => corps.buffer.slice(corps.byteOffset, corps.byteOffset + corps.byteLength) as ArrayBuffer,
    body: { cancel: async () => {} },
  }
}

/**
 * Un aller-retour vers la base, sur `http.request` : la requête que le client
 * libsql a préparée, sa réponse lue en entier. Au-delà de `delaiMs`, la
 * requête se détruit et l'aller-retour échoue d'une `TimeoutError`, comme le
 * `fetch` sous `AbortSignal.timeout` — `avecDelai` en fait une base muette.
 * `quandLesEntetes` : ses en-têtes, dès qu'ils arrivent — le `fetch` de Node
 * rend sa réponse à ce moment-là, et `avecDelai` y lit le délai que la base
 * annonce et le temps de l'aller-retour ; ce transport, qui rend la réponse
 * une fois lue, les lui dit en route. `dejaLu` : son corps, quand `avecDelai`
 * l'a lu avant — on ne lit un corps qu'une fois.
 */
export async function fetchLeger(
  requete: Request,
  delaiMs: number,
  quandLesEntetes?: (entetes: ReponseLegere['headers']) => void,
  dejaLu?: string | null,
): Promise<ReponseLegere> {
  const url = new URL(requete.url)
  const agent = url.protocol === 'https:' ? agents['https:'] : url.protocol === 'http:' ? agents['http:'] : null
  if (!agent) throw new TypeError(`transport léger : adresse en ${url.protocol} — seules http: et https: passent par le réseau`)
  const corps = typeof dejaLu === 'string' ? Buffer.from(dejaLu, 'utf8') : Buffer.from(await requete.arrayBuffer())
  const entetes: Record<string, string> = {}
  requete.headers.forEach((valeur, nom) => {
    entetes[nom] = valeur
  })
  entetes['content-length'] = String(corps.length)
  return new Promise<ReponseLegere>((rendre, refuser) => {
    let socket: Socket | undefined
    let fini = false
    let minuteur: ReturnType<typeof setTimeout> | undefined
    const finir = (erreur: unknown, reponse?: ReponseLegere) => {
      if (fini) return
      fini = true
      clearTimeout(minuteur)
      if (socket) connexionRendue(socket)
      if (reponse) rendre(reponse)
      else refuser(erreur)
    }
    const req = (url.protocol === 'https:' ? https : http).request(url, { method: requete.method, headers: entetes, agent }, res => {
      const lues = lecteurDEntetes(res.headers)
      try {
        quandLesEntetes?.(lues)
      } catch (e) {
        console.error('[base] en-têtes de la réponse illisibles :', e)
      }
      const morceaux: Buffer[] = []
      res.on('data', (morceau: Buffer) => morceaux.push(morceau))
      res.on('error', e => finir(e))
      // Coupée avant sa fin — la connexion tombée sous elle : sans erreur de la réponse, seule sa fermeture le dit.
      res.on('close', () => {
        if (!res.complete) finir(Object.assign(new Error('réponse de la base interrompue'), { code: 'ECONNRESET' }))
      })
      res.on('end', () => {
        try {
          const brut = morceaux.length === 1 ? morceaux[0] : Buffer.concat(morceaux)
          finir(null, reponseDe(res.statusCode ?? 0, lues, enClair(brut, res.headers['content-encoding'])))
        } catch (e) {
          finir(e)
        }
      })
    })
    req.on('socket', (s: Socket) => {
      socket = s
      // Une connexion neuve se compte ; une connexion gardée, non. Puis elle
      // est empruntée — et ne vieillit plus le temps de la requête.
      if (!vues.has(s)) {
        vues.add(s)
        // Libre, l'agent la détruit sans sa fin quand la base la ferme
        // (Node 22.23, `connexions.ts`) — et à sa garde écoulée, que seule
        // une connexion libre attend : celle-là, c'est nous qui la refermons.
        connexionOuverte(s, url.hostname, { finPeutManquer: true })
        s.on('timeout', () => connexionRefermeeParNous(s))
      }
      connexionEmpruntee(s)
      s.setTimeout(0)
    })
    req.on('error', e => finir(e))
    minuteur = setTimeout(() => {
      const delai = new DOMException(`la base n’a pas répondu en ${delaiMs} ms`, 'TimeoutError')
      finir(delai)
      req.destroy(delai)
    }, delaiMs)
    req.end(corps)
  })
}

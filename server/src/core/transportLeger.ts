import http from 'node:http'
import https from 'node:https'
import type { Socket } from 'node:net'
import { performance } from 'node:perf_hooks'
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib'
import { aDejaServi, connexionEmpruntee, connexionOuverte, connexionRefermeeParNous, connexionRendue, gardeDesConnexions } from './connexions'
import { pouls, releve } from './pouls'

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

/**
 * Un aller-retour tel qu'il part : son adresse, sa méthode, ses en-têtes et
 * son corps, déjà en texte — ni `Request` ni flux. Le client minimal le
 * prépare ainsi (`EnvoiALaBase`, `distante.ts`) ; celui de libsql passe un
 * `Request`, qu'`avecDelai` lit une fois. Le profil du banc solo du
 * 3 novembre 2026 : le `Request` que le client minimal fabriquait encore, et
 * le flux de son corps, prenaient 7 % du processeur du serveur à eux seuls.
 */
export interface EnvoiLeger {
  url: string
  method: string
  headers: Record<string, string>
  corps: string
}

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
 * Ce que `http.request` tire d'une adresse, tiré une fois par adresse : une
 * base n'en a qu'une, et `new URL` puis `urlToHttpOptions` la relisaient à
 * chaque aller-retour (1 % du processeur au même profil).
 */
interface Adresse {
  protocole: 'http:' | 'https:'
  hote: string
  hoteSansCrochets: string
  port: string
  chemin: string
}
const adresses = new Map<string, Adresse>()

function adresseDe(url: string): Adresse {
  let a = adresses.get(url)
  if (!a) {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new TypeError(`transport léger : adresse en ${u.protocol} — seules http: et https: passent par le réseau`)
    a = { protocole: u.protocol, hote: u.hostname, hoteSansCrochets: u.hostname.replace(/^\[(.*)\]$/, '$1'), port: u.port, chemin: u.pathname + u.search }
    // Quelques adresses par processus, jamais plus : une base, ses tests.
    if (adresses.size >= 16) adresses.clear()
    adresses.set(url, a)
  }
  return a
}

// ── La patience des connexions ────────────────────────────────────────────
//
// Une connexion neuve coûte une poignée de main : ~0,45 s en production le
// 4 novembre 2026, contre ~45 ms un aller-retour sur une gardée. Or une page
// lance ses lectures de front — au bilan d'une épreuve du Cabinet, les
// missions, un lot par magasin, et la carte avec elles —, et l'entretien ne
// garde que ce que la dernière minute a demandé : pendant les manches, une
// connexion ; au bilan suivant, une à deux minutes plus tard, chaque lot de
// plus en ouvrait une (2 à 4 par bilan, `retours/2026-11-04/`). Avec de la
// patience (`QUIZ_DB_PATIENCE_MS`), un aller-retour qui ne trouve aucune
// connexion libre attend que l'une de celles qui servent déjà se libère, au
// plus tant de millisecondes, puis en ouvre une comme avant : il passe
// derrière un aller-retour au lieu d'une poignée de main. À froid, rien à
// attendre : une connexion qui s'ouvre ne se libère qu'après sa poignée de
// main, et la rafale s'ouvre de front.

/** Les allers-retours qui attendent une place, le plus ancien d'abord : chacun se relâche une fois, libéré ou lassé. */
const enAttente: ((lassee: boolean) => void)[] = []

/**
 * Deux attentes au plus par connexion qui sert : la troisième n'aurait sa
 * place qu'après trois allers-retours, sa patience passée — elle ouvre la
 * sienne tout de suite.
 */
const ATTENTES_PAR_CONNEXION = 2

/** Une connexion se rend, ou tombe : la plus ancienne attente reprend — sur elle, ou sur une neuve si elle est tombée. */
function relacherUneAttente() {
  enAttente.shift()?.(false)
}

/**
 * Ce que l'agent de cette base tient à l'instant : ses connexions libres, et
 * celles qui servent après avoir déjà servi. Lu chez lui, jamais dans
 * `connexions.ts` : l'agent prend une connexion libre dès `http.request`,
 * quand l'événement `socket` ne le dit qu'au tour suivant — trois lectures
 * parties ensemble l'auraient toutes crue libre.
 */
function etatDesConnexions(a: Adresse): { libres: number; quiServent: number } {
  const agent = agents[a.protocole]
  // Le nom que l'agent donne à une base commence par son hôte et son port (`Agent.getName`).
  const prefixe = `${a.hoteSansCrochets}:${a.port || (a.protocole === 'https:' ? 443 : 80)}:`
  let libres = 0
  let quiServent = 0
  for (const [nom, liste] of Object.entries(agent.freeSockets)) if (nom.startsWith(prefixe)) libres += liste?.length ?? 0
  for (const [nom, liste] of Object.entries(agent.sockets)) {
    if (nom.startsWith(prefixe)) for (const s of liste ?? []) if (aDejaServi(s as Socket)) quiServent++
  }
  return { libres, quiServent }
}

/**
 * Une place sur une connexion gardée qui se libère bientôt, plutôt qu'une
 * neuve : null s'il n'y a rien à attendre — une connexion libre, aucune qui
 * serve déjà (à froid, ou rien que des poignées de main en cours), ou déjà
 * assez d'attentes devant —, sinon la promesse d'une place, tenue au plus
 * `patienceMs`. Chaque réponse finie en relâche une (`fetchLeger`) : l'agent
 * rend sa connexion libre au tour d'après, avant que l'attente, relâchée par
 * une promesse, reprenne la main — sa requête l'emprunte. `avecDelai`
 * l'attend avant de chronométrer l'aller-retour : l'attente n'est pas un
 * Turso lent, ni un aller-retour en vol pour l'entretien.
 */
export function placeSurUneGardee(url: string, patienceMs: number): Promise<void> | null {
  if (patienceMs <= 0) return null
  const { libres, quiServent } = etatDesConnexions(adresseDe(url))
  if (libres > 0 || quiServent === 0 || enAttente.length >= ATTENTES_PAR_CONNEXION * quiServent) return null
  pouls.attentesDUneConnexion.noter()
  const debut = performance.now()
  return new Promise<void>(rendre => {
    let fini = false
    const relacher = (lassee: boolean) => {
      if (fini) return
      fini = true
      clearTimeout(minuteur)
      const i = enAttente.indexOf(relacher)
      if (i >= 0) enAttente.splice(i, 1)
      if (lassee) pouls.attentesLassees.noter()
      // L'heure la garde aussi, avec ce qu'elle a coûté : sur deux jours, la patience se juge à ce qu'elle fait attendre.
      releve.attenteDUneConnexion(performance.now() - debut, lassee)
      rendre()
    }
    const minuteur = setTimeout(() => relacher(true), patienceMs)
    enAttente.push(relacher)
  })
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
 * une fois lue, les lui dit en route. La requête arrive déjà prête
 * (`EnvoiLeger`) : ni `Request` à relire, ni adresse à reparser.
 */
export async function fetchLeger(
  envoi: EnvoiLeger,
  delaiMs: number,
  quandLesEntetes?: (entetes: ReponseLegere['headers']) => void,
): Promise<ReponseLegere> {
  const adresse = adresseDe(envoi.url)
  const agent = agents[adresse.protocole]
  const corps = Buffer.from(envoi.corps, 'utf8')
  const entetes: Record<string, string> = { ...envoi.headers, 'content-length': String(corps.length) }
  const options: http.RequestOptions = {
    protocol: adresse.protocole,
    hostname: adresse.hoteSansCrochets,
    port: adresse.port || undefined,
    path: adresse.chemin,
    method: envoi.method,
    headers: entetes,
    agent,
  }
  return new Promise<ReponseLegere>((rendre, refuser) => {
    let socket: Socket | undefined
    let fini = false
    let minuteur: ReturnType<typeof setTimeout> | undefined
    const finir = (erreur: unknown, reponse?: ReponseLegere) => {
      if (fini) return
      fini = true
      clearTimeout(minuteur)
      if (socket) connexionRendue(socket)
      // Sa connexion se rend : la plus ancienne attente la prendra (`placeSurUneGardee`).
      relacherUneAttente()
      if (reponse) rendre(reponse)
      else refuser(erreur)
    }
    const req = (adresse.protocole === 'https:' ? https : http).request(options, res => {
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
        connexionOuverte(s, adresse.hote, { finPeutManquer: true })
        s.on('timeout', () => connexionRefermeeParNous(s))
        // Tombée, elle ne se libérera pas : qui l'attendait n'attend plus pour rien.
        s.once('close', relacherUneAttente)
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

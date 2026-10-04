// Le Web Push, sans bibliothèque : de quoi faire sonner un téléphone abonné à
// travers le service de push de son navigateur — Google pour Chrome et
// Android, Apple pour l'iPhone, Mozilla pour Firefox, Microsoft pour Edge.
//
// Trois RFC, et `node:crypto` seul :
// - RFC 8030, le protocole : un POST à l'adresse de l'abonnement, avec la
//   durée pendant laquelle le service garde le message (`TTL`) pour un
//   téléphone éteint ;
// - RFC 8292 (VAPID), l'identité du serveur : un jeton signé (ES256) de sa
//   clé, dont le téléphone a reçu la moitié publique en s'abonnant — le
//   service refuse tout message qu'elle n'a pas signé ;
// - RFC 8291, le chiffrement du message pour ce seul téléphone (aes128gcm) :
//   le service le transporte sans pouvoir le lire.
//
// La bibliothèque `web-push` fait la même chose, avec ses dépendances : ce
// que `node:crypto` sait faire seul n'en vaut pas une de plus. Le chiffrement
// est prouvé sur l'exemple de la RFC 8291 (`rappel.test.ts`).

import { createCipheriv, createECDH, createPrivateKey, generateKeyPairSync, hkdfSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { tronquer } from '../../../shared/avatars'

/** Les clés du serveur (VAPID), en base64url : la publique part aux téléphones, la privée signe. */
export interface ClesVapid {
  /** Le point public non compressé, 65 octets : `applicationServerKey` côté téléphone. */
  publique: string
  /** Le scalaire privé, 32 octets. */
  privee: string
}

/** Un téléphone abonné : l'adresse que son service de push lui a donnée, et ses deux clés à lui. */
export interface Abonnement {
  endpoint: string
  /** Sa clé publique de chiffrement (P-256, 65 octets). */
  p256dh: string
  /** Son secret d'authentification (16 octets). */
  auth: string
}

/** Ce qu'un message garde de sens une fois parti : au-delà, le service le jette. */
export interface ReglagesDEnvoi {
  cles: ClesVapid
  /** Qui joindre si le serveur abuse (`sub`) : l'adresse publique du serveur, ou un `mailto:`. */
  sujet: string
  /** En secondes : un téléphone éteint plus longtemps ne le recevra pas. */
  ttl: number
  /**
   * Un message en attente du même sujet est remplacé par le nouveau (`Topic`) :
   * le téléphone qui revient du mode avion n'en reçoit qu'un.
   */
  sujetDuMessage?: string
  delaiMs?: number
}

/**
 * Les services de push des navigateurs. L'adresse d'un abonnement vient du
 * téléphone : n'importe laquelle, et le serveur irait poster chaque soir là où
 * on le lui dit — une adresse de son propre réseau comprise. Celle d'un
 * service inconnu est refusée à l'abonnement.
 */
const SERVICES_DE_PUSH = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function serviceDePushConnu(url: URL): boolean {
  if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')) return false
  return SERVICES_DE_PUSH.some(hote => url.hostname === hote || url.hostname.endsWith(`.${hote}`))
}

/** Une adresse d'abonnement tient sous cette longueur : celles de Google, les plus longues, font 200 caractères. */
const ADRESSE_MAX = 1024

/** Un seul enregistrement : le message d'un rappel tient dans quelques centaines d'octets. */
const TAILLE_D_ENREGISTREMENT = 4096

/** Ce que les services acceptent : 4 096 octets chiffrés, en-tête compris. */
const MESSAGE_MAX = 3000

/** La durée de vie d'une signature : la RFC 8292 en refuse plus de vingt-quatre heures. */
const VALIDITE_S = 12 * 3600

const DELAI_MS = 10_000

const b64 = (octets: Uint8Array): string => Buffer.from(octets).toString('base64url')

/**
 * Des octets écrits en base64url, et de cette longueur-là — rien sinon.
 * `Buffer.from(…, 'base64url')` passe sur un caractère qu'il ne connaît pas :
 * la forme se vérifie d'abord.
 */
function octets(texte: unknown, longueur: number): Buffer | null {
  if (typeof texte !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(texte)) return null
  const lus = Buffer.from(texte, 'base64url')
  return lus.length === longueur ? lus : null
}

/** Des clés neuves pour le serveur : tirées une fois, gardées en base (`core/rappels.ts`). */
export function nouvellesCles(): ClesVapid {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = privateKey.export({ format: 'jwk' })
  const publique = Buffer.concat([Buffer.of(4), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')])
  return { publique: b64(publique), privee: jwk.d! }
}

/** La clé qui signe, reconstruite une fois par jeu de clés. */
const signataires = new WeakMap<ClesVapid, KeyObject>()

function signataire(cles: ClesVapid): KeyObject {
  let cle = signataires.get(cles)
  if (!cle) {
    const publique = Buffer.from(cles.publique, 'base64url')
    cle = createPrivateKey({
      format: 'jwk',
      key: { kty: 'EC', crv: 'P-256', d: cles.privee, x: b64(publique.subarray(1, 33)), y: b64(publique.subarray(33, 65)) },
    })
    signataires.set(cles, cle)
  }
  return cle
}

/**
 * L'en-tête `Authorization` d'un envoi (RFC 8292) : un jeton signé pour le
 * service de cette adresse seulement (`aud`), et la clé publique qui le
 * vérifie. Daté à l'horloge de la machine, jamais à celle du quiz du jour :
 * le service compare l'expiration à la sienne.
 */
export function enteteVapid(endpoint: string, cles: ClesVapid, sujet: string, maintenant = Date.now()): string {
  const enB64 = (objet: object) => b64(Buffer.from(JSON.stringify(objet)))
  const signe = `${enB64({ typ: 'JWT', alg: 'ES256' })}.${enB64({ aud: new URL(endpoint).origin, exp: Math.floor(maintenant / 1000) + VALIDITE_S, sub: sujet })}`
  // ES256 veut la signature brute, r puis s, 64 octets — pas le DER d'OpenSSL.
  const signature = sign('sha256', Buffer.from(signe), { key: signataire(cles), dsaEncoding: 'ieee-p1363' })
  return `vapid t=${signe}.${b64(signature)}, k=${cles.publique}`
}

/**
 * Chiffre un message pour un téléphone (RFC 8291, aes128gcm) : une clé
 * éphémère du serveur, le secret partagé avec la clé du téléphone, mêlé à son
 * secret d'authentification. `essai` fixe la clé éphémère et le sel — l'exemple
 * de la RFC, que l'épreuve rejoue octet pour octet.
 */
export function chiffrer(message: Uint8Array, abonnement: Pick<Abonnement, 'p256dh' | 'auth'>, essai: { ephemere?: Buffer; sel?: Buffer } = {}): Buffer {
  const clientPublic = Buffer.from(abonnement.p256dh, 'base64url')
  const secretDAuth = Buffer.from(abonnement.auth, 'base64url')
  const ephemere = createECDH('prime256v1')
  if (essai.ephemere) ephemere.setPrivateKey(essai.ephemere)
  else ephemere.generateKeys()
  const serveurPublic = ephemere.getPublicKey()
  const partage = ephemere.computeSecret(clientPublic)
  const sel = essai.sel ?? randomBytes(16)
  const info = (texte: string, ...suite: Buffer[]) => Buffer.concat([Buffer.from(texte), Buffer.of(0), ...suite])
  const ikm = Buffer.from(hkdfSync('sha256', partage, secretDAuth, info('WebPush: info', clientPublic, serveurPublic), 32))
  const cle = Buffer.from(hkdfSync('sha256', ikm, sel, info('Content-Encoding: aes128gcm'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, sel, info('Content-Encoding: nonce'), 12))
  const aes = createCipheriv('aes-128-gcm', cle, nonce)
  // Le dernier (et seul) enregistrement se termine par le délimiteur 0x02, sans bourrage.
  const chiffre = Buffer.concat([aes.update(Buffer.concat([message, Buffer.of(2)])), aes.final(), aes.getAuthTag()])
  const tete = Buffer.alloc(21)
  sel.copy(tete, 0)
  tete.writeUInt32BE(TAILLE_D_ENREGISTREMENT, 16)
  tete.writeUInt8(serveurPublic.length, 20)
  return Buffer.concat([tete, serveurPublic, chiffre])
}

/** Le point est-il sur la courbe ? Un point faux dévoile la clé de qui calcule avec (RFC 8291, sécurité). */
function surLaCourbe(point: Buffer): boolean {
  try {
    const essai = createECDH('prime256v1')
    essai.generateKeys()
    essai.computeSecret(point)
    return true
  } catch {
    return false
  }
}

const ILLISIBLE = 'Ce téléphone n’a pas su s’abonner : réessaie'

/**
 * Un abonnement tel que le téléphone l'envoie (`PushSubscription.toJSON()`),
 * relu : une adresse chez un service de push connu, une clé sur la courbe,
 * un secret de seize octets. Le motif d'un refus se montre tel quel.
 */
export function lireAbonnement(brut: unknown, accepte: (url: URL) => boolean = serviceDePushConnu): Abonnement | { refus: string } {
  const a = brut as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  if (!a || typeof a !== 'object' || typeof a.endpoint !== 'string' || a.endpoint.length > ADRESSE_MAX) return { refus: ILLISIBLE }
  let url: URL
  try {
    url = new URL(a.endpoint)
  } catch {
    return { refus: ILLISIBLE }
  }
  if (url.username || url.password || !accepte(url)) {
    return { refus: 'Ce navigateur passe par un service de notifications que FiestApp ne connaît pas' }
  }
  const p256dh = octets(a.keys?.p256dh, 65)
  const auth = octets(a.keys?.auth, 16)
  if (!p256dh || !auth || p256dh[0] !== 4 || !surLaCourbe(p256dh)) return { refus: ILLISIBLE }
  return { endpoint: a.endpoint, p256dh: b64(p256dh), auth: b64(auth) }
}

/**
 * Envoie un message à un téléphone, et rend le statut du service : 201 le
 * prend en charge, 404 et 410 disent l'abonnement mort — le téléphone s'est
 * désabonné, ou l'application a été désinstallée. Un réseau qui ne répond pas
 * lève une erreur.
 */
export async function pousser(abonnement: Abonnement, message: unknown, reglages: ReglagesDEnvoi): Promise<{ statut: number; motif: string }> {
  const corps = Buffer.from(JSON.stringify(message))
  if (corps.length > MESSAGE_MAX) throw new Error(`message de ${corps.length} octets : trop long pour un service de push`)
  const res = await fetch(abonnement.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(Math.max(0, Math.floor(reglages.ttl))),
      Urgency: 'normal',
      ...(reglages.sujetDuMessage && { Topic: reglages.sujetDuMessage }),
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: enteteVapid(abonnement.endpoint, reglages.cles, reglages.sujet),
    },
    body: chiffrer(corps, abonnement),
    // Un service de push ne redirige pas : suivre une redirection mènerait
    // là où l'adresse, vérifiée à l'abonnement, ne menait pas.
    redirect: 'error',
    signal: AbortSignal.timeout(reglages.delaiMs ?? DELAI_MS),
  })
  // Le motif d'un refus, pour le journal : Apple dit `BadJwtToken`, Google une phrase.
  const motif = res.ok ? '' : tronquer(await res.text().catch(() => ''), 200)
  if (res.ok) await res.body?.cancel().catch(() => {})
  return { statut: res.status, motif }
}

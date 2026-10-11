// Les notifications, côté téléphone (`server/src/core/rappels.ts`) — le
// rappel du soir, les défis de ses amis, chacun sa cloche (`quoi`) : s'y
// abonner, les couper, et rattacher le téléphone à chaque visite à la session
// du moment. Un seul abonnement chez le service de push pour les deux : il
// ne se défait que les deux cloches coupées.
//
// Seulement dans l'application installée : un onglet du navigateur ne le
// propose pas. C'est ce qu'on attend d'une application, pas d'un site — et
// l'iPhone ne permet les notifications qu'à elle (iOS 16.4 et après).
//
// L'abonnement se fait au toucher, sans rien attendre avant : l'iPhone ne
// demande la permission qu'au geste de la personne, et un aller-retour au
// serveur entre le toucher et la demande lui en ferait perdre la trace. Le
// service worker et la clé du serveur se préparent donc dès l'affichage
// (`preparerLeRappel`).

import { api, ApiError } from './api'
import { estInstallee } from './installation'
import type { ReglagesDesNotifications, SujetDeNotification } from '../../shared/jour'

/** Actif : ce téléphone sonnera. Bloqué : les notifications sont refusées, seuls les réglages du téléphone les rouvrent. */
export type EtatDuRappel = 'actif' | 'inactif' | 'bloque'

/** Ce téléphone sait-il recevoir le rappel ? L'application installée, sur un navigateur qui sait pousser. */
export function rappelPossible(): boolean {
  try {
    return estInstallee() && 'serviceWorker' in navigator && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined'
  } catch {
    return false
  }
}

/** Le service worker (`client/public/sw.js`) et la clé du serveur. */
interface Pret {
  enregistrement: ServiceWorkerRegistration
  cle: Uint8Array<ArrayBuffer>
}

/** Une fois prêts, gardés tels quels : le toucher s'en sert sans rien attendre. */
let pret: Pret | null = null
let enPreparation: Promise<Pret> | null = null

/** Les réglages de ce téléphone, tels que le serveur les a dits la dernière fois : l'autre cloche garde l'abonnement. */
let connus: ReglagesDesNotifications | null = null

/** L'autre cloche que celle-ci est-elle allumée ? Alors l'abonnement du service reste : il sert encore. */
const lAutreSonne = (quoi: SujetDeNotification) => !!connus && (quoi === 'soir' ? connus.defis : connus.soir)

function preparer(): Promise<Pret> {
  if (pret) return Promise.resolve(pret)
  if (!enPreparation) {
    const enRoute = Promise.all([
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready),
      api.jour.rappel.cle(),
    ]).then(([enregistrement, { cle }]) => (pret = { enregistrement, cle: octets(cle) }))
    // Un échec ne reste pas : la visite suivante réessaie.
    enRoute.catch(() => {
      enPreparation = null
    })
    enPreparation = enRoute
  }
  return enPreparation
}

/** Une clé en base64url, en octets. */
export function octets(texte: string): Uint8Array<ArrayBuffer> {
  const brut = atob(texte.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(brut, c => c.charCodeAt(0))
}

/** L'abonnement a-t-il été pris avec cette clé ? Celui d'une clé d'avant — une base neuve — ne recevrait plus rien. */
function memeCle(abonnement: PushSubscription, cle: Uint8Array): boolean {
  const sienne = abonnement.options?.applicationServerKey
  if (!sienne) return true
  const lus = new Uint8Array(sienne)
  return lus.length === cle.length && lus.every((o, i) => o === cle[i])
}

const permission = (): NotificationPermission => Notification.permission

/**
 * Où en est la cloche `quoi` de ce téléphone. Abonné, il se rattache à la
 * session du moment : celle d'avant a pu se fermer — un mot de passe changé,
 * une reconnexion —, et le serveur ne prévient qu'un téléphone resté
 * connecté.
 */
export async function preparerLeRappel(quoi: SujetDeNotification = 'soir'): Promise<EtatDuRappel> {
  if (permission() === 'denied') return 'bloque'
  const { enregistrement, cle } = await preparer()
  let abonnement = await enregistrement.pushManager.getSubscription()
  if (abonnement && !memeCle(abonnement, cle)) {
    await abonnement.unsubscribe().catch(() => false)
    abonnement = null
  }
  if (!abonnement || permission() !== 'granted') return 'inactif'
  // Sans réseau, il reste actif : il se rattachera à la prochaine visite.
  const lus = await api.jour.rappel.abonner(abonnement.toJSON(), quoi).catch(() => null)
  if (!lus) return 'actif'
  connus = lus
  return lus[quoi] ? 'actif' : 'inactif'
}

/**
 * La cloche touchée : la permission et l'abonnement chez le service de push
 * du navigateur — demandés sans rien attendre, au toucher même —, puis le
 * serveur.
 */
export async function activerLeRappel(quoi: SujetDeNotification = 'soir'): Promise<EtatDuRappel> {
  const { enregistrement, cle } = pret ?? (await preparer())
  let abonnement: PushSubscription
  try {
    abonnement = await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle })
  } catch {
    if (permission() === 'denied') return 'bloque'
    // Écartée d'un geste, la demande n'a rien bloqué : on pourra la refaire.
    if (permission() === 'default') return 'inactif'
    // Permis, mais le service de push n'a pas répondu — le réseau, souvent.
    throw new ApiError('Ce téléphone n’a pas pu s’abonner : réessaie dans un instant')
  }
  try {
    connus = await api.jour.rappel.abonner(abonnement.toJSON(), quoi, true)
  } catch (e) {
    // Le serveur ne l'a pas : le téléphone non plus, pour que l'écran dise
    // vrai — sauf s'il sert déjà l'autre cloche.
    if (!lAutreSonne(quoi)) await abonnement.unsubscribe().catch(() => false)
    throw e
  }
  return 'actif'
}

/**
 * La cloche touchée une seconde fois : le serveur l'oublie, puis — l'autre
 * cloche coupée aussi — le service de push. Sans réseau, le service le dira
 * mort au serveur au prochain envoi ; mais l'autre cloche allumée, on ne peut
 * couper celle-ci seule : rien ne change, et la page le dit.
 */
export async function couperLeRappel(quoi: SujetDeNotification = 'soir'): Promise<EtatDuRappel> {
  const { enregistrement } = pret ?? (await preparer())
  const abonnement = await enregistrement.pushManager.getSubscription()
  if (abonnement) {
    const lus = await api.jour.rappel.desabonner(abonnement.endpoint, quoi).catch(() => null)
    if (!lus && lAutreSonne(quoi)) throw new ApiError('Pas de réseau : la cloche n’a pas pu se couper, réessaie')
    if (lus) connus = lus
    if (!lus || (!lus.soir && !lus.defis)) await abonnement.unsubscribe()
  }
  return 'inactif'
}

// Les alertes de panne sur le téléphone de l'administrateur, côté téléphone
// (`server/src/core/alertes.ts`) : l'allumer, l'éteindre, et savoir si ce
// téléphone-ci sonnera.
//
// Un abonnement à elles, sous `/admin` : le service worker est le même
// (`/sw.js`), mais un abonnement tient à son enregistrement, et celui du
// rappel du soir vit sous `/` (`rappel.ts`). Sur le même enregistrement,
// couper l'un aurait coupé l'autre, et la page du jour qui rattache son
// abonnement l'aurait pris pour le sien.
//
// Comme le rappel du soir, l'abonnement se fait au toucher, sans rien
// attendre avant — l'iPhone ne demande la permission qu'au geste — :
// l'enregistrement se prépare dès l'affichage (`preparerLesAlertes`). Sur
// l'iPhone, seule l'application installée sait recevoir une notification ;
// sur Android, un onglet de Chrome suffit.

import { api, ApiError } from './api'
import { octets } from './rappel'
import { EMPREINTE_D_UN_TELEPHONE, type TelephoneDuQg } from '../../shared/pannes'
import type { PageDesErreurs } from '../../shared/triDesErreurs'

/** Sous le QG seulement : le rappel du soir garde le sien, sous `/`. */
const PORTEE = '/admin'

/**
 * Où en est ce téléphone. Impossible : ce navigateur ne sait pas recevoir de
 * notification — un iPhone hors de l'application installée. Bloqué : les
 * notifications lui sont refusées, seuls ses réglages les rouvrent.
 */
export type EtatDesAlertes = 'impossible' | 'bloque' | 'inactif' | 'actif'

export function alertesPossibles(): boolean {
  try {
    return 'serviceWorker' in navigator && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined' && !!crypto?.subtle
  } catch {
    return false
  }
}

let pret: ServiceWorkerRegistration | null = null
let enPreparation: Promise<ServiceWorkerRegistration> | null = null

/** L'abonnement veut un service worker actif : le tout premier enregistrement s'installe d'abord. */
function actif(r: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (r.active) return Promise.resolve(r)
  const enRoute = r.installing ?? r.waiting
  if (!enRoute) return Promise.resolve(r)
  return new Promise(resolve => {
    enRoute.addEventListener('statechange', () => {
      if (enRoute.state === 'activated' || enRoute.state === 'redundant') resolve(r)
    })
  })
}

function preparer(): Promise<ServiceWorkerRegistration> {
  if (pret) return Promise.resolve(pret)
  if (!enPreparation) {
    const enRoute = navigator.serviceWorker
      .register('/sw.js', { scope: PORTEE })
      .then(actif)
      .then(r => (pret = r))
    // Un échec ne reste pas : la visite suivante réessaie.
    enRoute.catch(() => {
      enPreparation = null
    })
    enPreparation = enRoute
  }
  return enPreparation
}

/** L'empreinte d'une adresse d'abonnement, comme le serveur la calcule (`empreinteDuTelephone`) : l'adresse ne repart jamais. */
export async function empreinteDe(endpoint: string): Promise<string> {
  const condense = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))
  return Array.from(condense, o => o.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, EMPREINTE_D_UN_TELEPHONE)
}

/** L'abonnement a-t-il été pris avec cette clé ? Celui d'une clé d'avant — une base neuve — ne recevrait plus rien. */
function memeCle(abonnement: PushSubscription, cle: Uint8Array): boolean {
  const sienne = abonnement.options?.applicationServerKey
  if (!sienne) return true
  const lus = new Uint8Array(sienne)
  return lus.length === cle.length && lus.every((o, i) => o === cle[i])
}

/**
 * Où en est ce téléphone, lu dans son navigateur et dans la liste du serveur :
 * actif s'il a un abonnement que le serveur connaît. Un abonnement pris sous
 * d'autres clés s'efface : il ne recevrait plus rien.
 */
export async function preparerLesAlertes(cle: string | null, telephones: readonly TelephoneDuQg[]): Promise<{ etat: EtatDesAlertes; empreinte: string | null }> {
  if (!alertesPossibles()) return { etat: 'impossible', empreinte: null }
  if (Notification.permission === 'denied') return { etat: 'bloque', empreinte: null }
  const enregistrement = await preparer()
  let abonnement = await enregistrement.pushManager.getSubscription()
  if (abonnement && cle && !memeCle(abonnement, octets(cle))) {
    await abonnement.unsubscribe().catch(() => false)
    abonnement = null
  }
  if (!abonnement || Notification.permission !== 'granted') return { etat: 'inactif', empreinte: null }
  const empreinte = await empreinteDe(abonnement.endpoint)
  return { etat: telephones.some(t => t.empreinte === empreinte) ? 'actif' : 'inactif', empreinte }
}

/**
 * « Prévenir ce téléphone » : la permission et l'abonnement chez le service de
 * push du navigateur — au toucher même —, puis le serveur. Rend la liste
 * d'après et l'empreinte de ce téléphone, ou ce que la demande écartée laisse.
 */
export async function allumerLesAlertes(cle: string): Promise<{ alertes: PageDesErreurs['alertes']; empreinte: string } | { etat: 'bloque' | 'inactif' }> {
  const enregistrement = pret ?? (await preparer())
  let abonnement: PushSubscription
  try {
    abonnement = await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(cle) })
  } catch {
    if (Notification.permission === 'denied') return { etat: 'bloque' }
    if (Notification.permission === 'default') return { etat: 'inactif' }
    // Permis, mais le service de push n'a pas répondu — le réseau, souvent.
    throw new ApiError('Ce téléphone n’a pas pu s’abonner : réessaie dans un instant')
  }
  try {
    const alertes = await api.admin.alerterCeTelephone(abonnement.toJSON())
    return { alertes, empreinte: await empreinteDe(abonnement.endpoint) }
  } catch (e) {
    // Le serveur ne l'a pas : le téléphone non plus, pour que la page dise vrai.
    await abonnement.unsubscribe().catch(() => false)
    throw e
  }
}

/** « Ne plus prévenir ce téléphone » : le serveur l'oublie, puis son service de push. */
export async function eteindreLesAlertes(empreinte: string): Promise<PageDesErreurs['alertes']> {
  const alertes = await api.admin.plusDAlertes(empreinte)
  const abonnement = await (pret ?? (await preparer())).pushManager.getSubscription()
  await abonnement?.unsubscribe().catch(() => false)
  return alertes
}

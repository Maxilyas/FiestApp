import type { MouseEvent, PointerEvent } from 'react'

/**
 * L'heure du dernier geste pris au lever du doigt, pour tout le téléphone :
 * le `click` qui le suit ne le rejoue pas. Hors d'un composant, parce que le
 * geste lui-même fait rendre la page entre les deux événements.
 */
let dernierDoigt = -Infinity

/** Au-delà, le `click` n'est plus l'écho du doigt : c'est un autre geste. */
const ECHO_MS = 800

type Cible = { disabled?: boolean; getBoundingClientRect(): { left: number; right: number; top: number; bottom: number } }

/**
 * Ce `click` n'est-il que l'écho d'un doigt déjà pris au lever ? Il tombe sur
 * ce qui a paru sous le doigt entre-temps : le voile d'un dialogue que le
 * geste vient d'ouvrir le recevait et le refermait aussitôt — « Quitter »
 * entre deux manches du Cabinet ne s'ouvrait pas au doigt (`Dialog.tsx`).
 */
export const estLEchoDUnDoigt = (e: { timeStamp: number }): boolean => e.timeStamp - dernierDoigt < ECHO_MS

/**
 * Le doigt dont l'écho n'est pas encore venu (`arreterLEcho`) : un doigt n'en
 * fait suivre qu'un.
 */
let echoAttendu = false

/**
 * Un geste pris au lever du doigt hors de `toucher` — la carte de France de
 * l'Épingle, qui lit où il s'est levé — marque la même heure : le `click` qui
 * le suit, où qu'il tombe, n'en est que l'écho. Avec une heure à elle, la
 * carte ignorait le sien, mais pas « Éclairer », venu sous le doigt quand le
 * pied grandissait d'une ligne.
 */
export function prendreLeDoigt(e: { timeStamp: number }): void {
  dernierDoigt = e.timeStamp
  echoAttendu = true
}

/**
 * L'écho arrêté avant tout ce qui l'écouterait, posé à la capture du
 * document par une page dont les gestes changent l'écran au lever du doigt
 * (`CabinetApp.tsx`) : ni un lien suivi, ni un bouton au seul `onClick`.
 * « Revenir au musée », au bas du bilan, faisait paraître le musée sous le
 * doigt, et l'écho ouvrait la tuile venue sous lui — la salle de l'Érudit au
 * lieu du musée (le rendu du 25 octobre 2026) ; un lien ne lit pas
 * `estLEchoDUnDoigt`, et la page en a des dizaines. Seul le premier `click`
 * qui suit le doigt en est l'écho : un toucher franc sur un lien, juste
 * après, l'ouvre. Un `click` lancé par le code (`isTrusted` faux) n'est
 * l'écho de rien.
 */
export function arreterLEcho(e: { isTrusted: boolean; timeStamp: number; preventDefault(): void; stopPropagation(): void }): void {
  if (!e.isTrusted) return
  const echo = echoAttendu && estLEchoDUnDoigt(e)
  echoAttendu = false
  if (!echo) return
  e.preventDefault()
  e.stopPropagation()
}

/**
 * Un doigt qui défile n'est pas un doigt qui choisit. Le navigateur envoie
 * `pointercancel` dès qu'il prend le défilement, mais deux gestes lui
 * échappent : le petit glissé, sous le seuil où il le prend, et surtout le
 * doigt posé pour **arrêter** une liste lancée — il ne bouge pas, se lève, et
 * le lever ouvrait la tuile venue sous lui (les cartes de la traversée, le
 * retour du 3 novembre 2026 : « le défilement bug et sélectionne une carte »).
 * Le `click` natif, lui, ne suit jamais ce doigt-là : `toucher` doit
 * l'imiter.
 */
const GLISSE_MAX_PX = 10
/** Un défilement vu si peu avant le doigt posé, ou pendant : la page bougeait encore, le doigt l'arrêtait. */
const DEFILEMENT_RECENT_MS = 150
const doigtsPoses = new Map<number, { x: number; y: number; t: number }>()
let dernierDefilement = -Infinity
let ecoute = false

function ecouterLesDefilements(): void {
  // Par `globalThis`, typé à la main : le serveur relit ce module pour ses tests, sans les types du navigateur.
  const doc = (globalThis as { document?: { addEventListener(type: 'scroll', f: (e: { timeStamp: number }) => void, o: object): void } }).document
  if (ecoute || !doc) return
  ecoute = true
  // À la capture : le défilement d'une boîte (la feuille des cartes) ne remonte pas jusqu'au document.
  doc.addEventListener('scroll', e => (dernierDefilement = e.timeStamp), { capture: true, passive: true })
}

type Doigt = { pointerId?: number; clientX: number; clientY: number; timeStamp: number }

function poserLeDoigt(e: Doigt): void {
  if (e.pointerId === undefined) return
  doigtsPoses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp })
}

/** Ce doigt a-t-il glissé, ou arrêté une page qui défilait ? Sans doigt posé connu, rien à dire : le lever compte. */
export function doigtQuiDefilait(e: Doigt): boolean {
  if (e.pointerId === undefined) return false
  const pose = doigtsPoses.get(e.pointerId)
  doigtsPoses.delete(e.pointerId)
  if (!pose) return false
  if (Math.hypot(e.clientX - pose.x, e.clientY - pose.y) > GLISSE_MAX_PX) return true
  return dernierDefilement >= pose.t - DEFILEMENT_RECENT_MS
}

/** Ce que le document voit défiler, dit au module — pour les tests, qui n'ont pas de document. */
export function noterUnDefilement(t: number): void {
  dernierDefilement = t
}

/**
 * Une réponse prise au lever du doigt, et non au `click` du navigateur.
 *
 * Les invités le disaient : « parfois, ça sélectionne la réponse au lieu de
 * la valider ». Le `click` d'un écran tactile ne vient qu'au bout d'un geste
 * que le navigateur juge être un toucher : appuyé un peu longtemps, le
 * texte de la case se surlignait — la réponse avait l'air choisie — et rien
 * ne partait ; tapé à l'arrivée de la question, le navigateur cherchait la
 * case là où elle n'était plus. Le lever du doigt, lui, vient toujours. Un
 * doigt qui défile reçoit `pointercancel` à la place, et un doigt levé hors
 * de la case (un toucher capturé suit le doigt) ne répond rien.
 *
 * La souris et le clavier gardent le `click` ; celui qui suit un doigt déjà
 * pris est ignoré — une case à cocher touchée une fois ne se décoche pas
 * aussitôt.
 */
export function toucher(agir: () => void) {
  ecouterLesDefilements()
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' || e.button > 0) return
      poserLeDoigt(e)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' || e.button > 0) return
      const cible = e.currentTarget as unknown as Cible
      if (cible.disabled) return
      const r = cible.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
      if (doigtQuiDefilait(e)) return
      prendreLeDoigt(e)
      agir()
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (estLEchoDUnDoigt(e)) return
      agir()
    },
    // L'appui long ouvrait le menu du texte (copier, rechercher) par-dessus la question.
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  }
}

// Les écrans du musée et leurs adresses : le fragment de `/cabinet` dit ce
// qu'on regarde — une salle (`#salle-rempart`), une œuvre (`#oeuvre-bastion`),
// les gardiens, la visite du jour, les jeux libres —, pour que le retour du
// navigateur ramène d'où l'on vient, qu'un écran se recharge sur lui-même et
// qu'un lien y mène tout droit. Le musée lui-même n'a pas de fragment.
//
// Toutes ces adresses lisent la même page (`GET /api/cabinet`, préchargée
// avec `/cabinet`) : le fragment ne demande rien de plus au serveur, et
// `donneesDuFragment` (`shared/depart.ts`) n'a rien à précharger pour lui.
// Sans effet ni navigateur — `cabinet-ecran.test.ts` les lit tels quels — ; le
// seul morceau de React est le retour au musée (`RetourAuMusee`), un contexte.

import { createContext } from 'react'
import type { DemandeDeDepart } from '../../../../shared/cabinet/musee'
import { estUneOeuvre, type CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
import { salle, type CleDeSalle } from '../../../../shared/cabinet/salles'

/**
 * Une partie que le musée propose — une case de la visite, une chasse, un jeu
 * libre —, sans sa carte-bonus : elle se choisit à l'annonce, où rien n'est
 * encore consommé (`DemandeDeDepart`, qui la porte, part à « Commencer »).
 */
export type PartieDemandee = SansCarte<DemandeDeDepart>
/** `Omit` partie par partie : sur l'union entière, il n'en gardait que les clés communes. */
type SansCarte<T> = T extends unknown ? Omit<T, 'carte'> : never

/** Ce que le musée montre — jamais une partie : son écran vient de la partie elle-même, pas de l'adresse. */
export type EcranDuMusee =
  | { e: 'musee' }
  | { e: 'salle'; salle: CleDeSalle }
  | { e: 'oeuvre'; oeuvre: CleDOeuvre }
  | { e: 'gardiens' }
  | { e: 'visite' }
  | { e: 'libre' }

const SIMPLES = ['gardiens', 'visite', 'libre'] as const

/**
 * L'écran d'un fragment. Une clé venue de l'adresse se lit par sa fonction
 * (`salle()`, `estUneOeuvre`), jamais par une table : `#salle-constructor`
 * aurait trouvé `Object` (règle `cabinet.md`). Un fragment inconnu ouvre le
 * musée — un lien d'avant, une faute de frappe —, jamais une page vide.
 */
export function ecranDeLAdresse(hash: string): EcranDuMusee {
  const f = hash.replace(/^#/, '')
  if ((SIMPLES as readonly string[]).includes(f)) return { e: f as (typeof SIMPLES)[number] }
  const s = /^salle-([a-z]+)$/.exec(f)
  if (s && salle(s[1])) return { e: 'salle', salle: s[1] as CleDeSalle }
  const o = /^oeuvre-([a-z-]+)$/.exec(f)
  if (o && estUneOeuvre(o[1])) return { e: 'oeuvre', oeuvre: o[1] }
  return { e: 'musee' }
}

/** Le fragment d'un écran, dièse compris ; le musée n'en a pas. */
export function adresseDe(ecran: EcranDuMusee): string {
  switch (ecran.e) {
    case 'musee':
      return ''
    case 'salle':
      return `#salle-${ecran.salle}`
    case 'oeuvre':
      return `#oeuvre-${ecran.oeuvre}`
    default:
      return `#${ecran.e}`
  }
}

/**
 * « ← Le Cabinet » : le musée n'a pas de fragment, et `href="/cabinet"`
 * rechargerait toute la page. La page fournit le retour sans recharger
 * (`CabinetApp`) ; sans elle — un rendu de test, un lien ouvert dans un
 * onglet —, le lien reste un lien.
 */
export const RetourAuMusee = createContext<(() => void) | undefined>(undefined)

/** Deux écrans sont-ils le même ? Un fragment relu sans changement ne refait ni défilement ni focus. */
export const memeEcran = (a: EcranDuMusee, b: EcranDuMusee) => adresseDe(a) === adresseDe(b)

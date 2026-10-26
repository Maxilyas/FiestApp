// Les écrans du musée et leurs adresses : le fragment de `/cabinet` dit ce
// qu'on regarde — une salle (`#salle-rempart`), une œuvre (`#oeuvre-bastion`),
// les gardiens, la visite du jour, les jeux libres, tes murs —, pour que le retour du
// navigateur ramène d'où l'on vient, qu'un écran se recharge sur lui-même et
// qu'un lien y mène tout droit. Le musée lui-même n'a pas de fragment.
//
// Toutes ces adresses lisent la même page (`GET /api/cabinet`, préchargée
// avec `/cabinet`) : le fragment ne demande rien de plus au serveur, et
// `donneesDuFragment` (`shared/depart.ts`) n'a rien à précharger pour lui —
// sauf tes murs, qui se demandent à l'ouverture de leur écran (`Murs.tsx`) :
// rares, ils n'alourdissent pas l'arrivée de tous. Chaque écran dit aussi son
// titre d'onglet (`titreDeLEcran`), et une partie le sien, manche par manche.
// Sans effet ni navigateur — `cabinet-ecran.test.ts` les lit tels quels, et
// l'historique d'une partie ouverte se joue sur un faux `history` — ; le seul
// morceau de React est le retour au musée (`RetourAuMusee`), un contexte.

import { createContext } from 'react'
import { titreDePage } from '../../titres'
import { MANCHES_PAR_PARTIE } from '../../../../shared/cabinet/bareme'
import { JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import type { DemandeLue } from '../../../../shared/cabinet/musee'
import { estUneOeuvre, type CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
import { salle, type CleDeSalle } from '../../../../shared/cabinet/salles'
import type { PageDuCabinet, VueDeLaPartie } from '../../../../shared/cabinet/vues'

/**
 * Une partie que le musée propose — une case de la visite, une chasse, un jeu
 * libre, « Retenter » une case manquée —, sans sa carte-bonus : elle se
 * choisit à l'annonce, où rien n'est encore consommé (`DemandeLue`, ce que le
 * serveur lit à « Commencer » : la retente y vise sa case, jamais l'œuvre,
 * que la page ne reçoit pas — invariant 1).
 */
export type PartieDemandee = SansCarte<DemandeLue>
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
  | { e: 'murs' }

const SIMPLES = ['gardiens', 'visite', 'libre', 'murs'] as const

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

// ── Une partie par-dessus l'écran, dans l'historique ──────────────────────
//
// Une partie demandée — son annonce, ou celle qui l'attend, reprise —
// s'ouvre par-dessus l'écran du musée, sans fragment à elle : rechargée, elle
// ne saurait pas quelle partie montrer. Sans entrée d'historique, le retour du
// navigateur reculait l'adresse d'un écran (de l'œuvre à sa salle) et laissait
// l'annonce à l'écran ; un deuxième retour aussi, un troisième quittait le
// Cabinet. Elle pose donc une entrée à la même adresse, marquée : le retour la
// consomme, la page la ferme, et l'écran d'où elle partait reste.

/** Ce que la page fait de `history` : de quoi poser, remplacer et reculer d'une entrée, sans navigateur dans les tests. */
export type Historique = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>

const PARTIE_OUVERTE = 'fiestappPartieDuCabinet'

/** L'entrée courante est-elle celle d'une partie ouverte ? Un retour qui la quitte ferme la partie. */
export const partieDansLEntree = (etat: unknown): boolean => (etat as Record<string, unknown> | null)?.[PARTIE_OUVERTE] === true

/** L'état d'une entrée sans la marque de la partie — et sans rien perdre des autres repères (la garde du retour…). */
function sansLaMarque(etat: unknown): Record<string, unknown> | null {
  if (!etat || typeof etat !== 'object') return null
  const reste = { ...(etat as Record<string, unknown>) }
  delete reste[PARTIE_OUVERTE]
  return Object.keys(reste).length > 0 ? reste : null
}

/** Ouvrir une partie : son entrée, à la même adresse — une seule, même touchée deux fois. */
export function poserLEntreeDeLaPartie(h: Historique) {
  if (!partieDansLEntree(h.state)) h.pushState({ ...((h.state as object | null) ?? {}), [PARTIE_OUVERTE]: true }, '')
}

/**
 * « ← Le Cabinet » : le musée. Depuis une partie ouverte sur un écran, le
 * musée prend la place de son entrée (le retour ramène à l'écran d'en
 * dessous) ; ouverte du musée même, on recule simplement sur lui — pas de
 * second musée dans l'historique. D'un écran, le musée se pose par-dessus ;
 * du musée, rien.
 */
export function quitterVersLeMusee(h: Historique, hash: string) {
  if (partieDansLEntree(h.state)) {
    if (hash) h.replaceState(sansLaMarque(h.state), '', '/cabinet')
    else h.back()
  } else if (hash) h.pushState(null, '', '/cabinet')
}

/**
 * Rechargée sur l'entrée d'une partie, la page n'en a plus d'ouverte : la
 * marque s'efface. Gardée, « ← Le Cabinet » aurait reculé sur l'entrée
 * d'avant le rechargement — peut-être hors du Cabinet.
 */
export function effacerLaMarqueAuChargement(h: Historique) {
  if (partieDansLEntree(h.state)) h.replaceState(sansLaMarque(h.state), '')
}

/**
 * Rechargée sur l'entrée d'une partie, la page décide à sa première page reçue
 * — celle qui dit la partie qui attend (`PageDuCabinet.enCours`) : elle la
 * rouvre sur la même entrée, toujours marquée, et le retour du navigateur la
 * consomme comme avant ; sans partie, la marque s'efface. Effacée d'office au
 * chargement, la partie rechargée depuis la visite retombait sur la visite,
 * qui la disait faite — et son chrono courait pendant qu'on la cherchait (la
 * tablée du 25 octobre 2026). Hors de l'entrée d'une partie, rien ne se
 * rouvre : le musée la propose, on la reprend si l'on veut.
 */
export function partieARouvrir<V>(h: Historique, enCours: V | null): V | null {
  if (!partieDansLEntree(h.state)) return null
  if (enCours) return enCours
  effacerLaMarqueAuChargement(h)
  return null
}

// ── Le titre de l'onglet ──────────────────────────────────────────────────
//
// Chaque écran dit le sien : d'un onglet à l'autre, et au lecteur d'écran qui
// annonce la page, tous disaient « Le Cabinet de curiosités · FiestApp » (la
// tablée du 25 octobre 2026). Le musée garde le nom de la page (`titres.ts`) ;
// `main.tsx` y repose seul le « [preprod] » de la préproduction, qu'il observe.

const DU_CABINET = ' · Le Cabinet · FiestApp'

const TITRES_DES_ECRANS: Readonly<Record<(typeof SIMPLES)[number], string>> = {
  visite: 'La visite du jour',
  libre: 'Jouer librement',
  gardiens: 'Les gardiens',
  murs: 'Tes murs',
}

/**
 * Le titre d'un écran du musée. Une œuvre à lui se nomme ; un cadre vide, non
 * — ni à l'écran, ni dans l'onglet : on découvre son œuvre en la gagnant.
 */
export function titreDeLEcran(ecran: EcranDuMusee, page: Pick<PageDuCabinet, 'salles'> | null): string {
  switch (ecran.e) {
    case 'musee':
      return titreDePage('cabinet')
    case 'salle':
      return `${salle(ecran.salle)?.nom ?? 'Une salle'}${DU_CABINET}`
    case 'oeuvre': {
      const s = page?.salles.find(x => x.oeuvres.some(o => o.cle === ecran.oeuvre))
      const o = s?.oeuvres.find(x => x.cle === ecran.oeuvre)
      if (!s || !o) return `Une œuvre${DU_CABINET}`
      return `${o.possedee ? o.nom : `Un cadre vide ${salle(s.cle)?.deLaSalle ?? ''}`.trimEnd()}${DU_CABINET}`
    }
    default:
      return `${TITRES_DES_ECRANS[ecran.e]}${DU_CABINET}`
  }
}

/** L'annonce d'une partie : son jeu. */
export const titreDeLAnnonce = (jeu: CleDeJeu): string => `${JEUX[jeu].nom}${DU_CABINET}`

/** Une partie : son jeu et sa manche — la mise d'avant comprise, qui ouvre la sienne —, puis son bilan. */
export const titreDeLaPartie = (vue: Pick<VueDeLaPartie, 'jeu' | 'manche'>, bilan: boolean): string =>
  `${JEUX[vue.jeu].nom}, ${bilan ? 'le bilan' : `manche ${vue.manche + 1} sur ${MANCHES_PAR_PARTIE}`}${DU_CABINET}`

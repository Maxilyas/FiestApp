// Les deux Filets sous une seule clé : le registre (`index.ts`) lit la règle d'une manche par la forme de son tirage.
// Un tirage qui porte `deuxTemps` se joue au Filet en deux temps (`filetEnDeuxTemps.ts`), les autres au Filet d'avant
// (`filet.ts`) : une partie commencée avant le nouveau Filet se rejoue, se révèle et se relit par sa règle — son
// cartel, « Mes réponses », une épreuve en route pendant une mise en ligne —, sans version du départ. Ce que le
// nouveau juge se fige dans son tirage (ses tranches, ses anneaux, le prix d'une aide) : la règle du Cabinet, qui
// préfère figer au tirage plutôt que monter la version (`partie.ts`).
//
// Le pli ne passe à une règle que ce qu'elle a elle-même ouvert pour ce tirage, et ce que son `lireLeGeste` a rendu :
// l'état et le geste se rangent par le tirage, d'où les conversions ici, sûres par construction.
import { REGLE_DU_FILET, type EtatDuFilet, type FiletMontre, type FiletRevele, type FiletTire, type GesteDuFilet } from './filet'
import {
  REGLE_DU_FILET_EN_DEUX_TEMPS as EN_DEUX_TEMPS,
  type EtatDuFiletEnDeuxTemps,
  type FiletEnDeuxTempsMontre,
  type FiletEnDeuxTempsRevele,
  type FiletEnDeuxTempsTire,
  type GesteDuFiletEnDeuxTemps,
} from './filetEnDeuxTemps'
import type { RegleDuJeu } from './regle'

export type TirageDuFilet = FiletTire | FiletEnDeuxTempsTire
export type EtatDUnFilet = EtatDuFilet | EtatDuFiletEnDeuxTemps
export type GesteDUnFilet = GesteDuFilet | GesteDuFiletEnDeuxTemps
export type MontreDUnFilet = FiletMontre | FiletEnDeuxTempsMontre
export type ReveleDUnFilet = FiletRevele | FiletEnDeuxTempsRevele

/** Le tirage du nouveau Filet : il le dit lui-même. Un tirage d'avant n'a pas `deuxTemps`. */
export const estEnDeuxTemps = (t: TirageDuFilet): t is FiletEnDeuxTempsTire => (t as { deuxTemps?: unknown }).deuxTemps === true

const A = REGLE_DU_FILET
const N = EN_DEUX_TEMPS
type Reponse<G> = G | 'expiree' | 'quittee'

export const REGLE_DES_FILETS: RegleDuJeu<TirageDuFilet, EtatDUnFilet, GesteDUnFilet, MontreDUnFilet, ReveleDUnFilet> = {
  cle: 'filet',
  etapes: 1,
  // Le même chrono pour les deux : le départ le fige sans tirage (`chronoDuDepart`).
  dureeMs: etape => A.dureeMs(etape),
  ouvrir: t => (estEnDeuxTemps(t) ? N.ouvrir(t) : A.ouvrir(t)),
  lireLeGeste: (brut, t) => (estEnDeuxTemps(t) ? N.lireLeGeste(brut, t) : A.lireLeGeste(brut, t)),
  apresLeGeste: (t, e, g) =>
    estEnDeuxTemps(t) ? N.apresLeGeste(t, e as EtatDuFiletEnDeuxTemps, g as GesteDuFiletEnDeuxTemps) : A.apresLeGeste(t, e as EtatDuFilet, g as GesteDuFilet),
  juger: (t, e, r) =>
    estEnDeuxTemps(t) ? N.juger(t, e as EtatDuFiletEnDeuxTemps, r as Reponse<GesteDuFiletEnDeuxTemps>) : A.juger(t, e as EtatDuFilet, r as Reponse<GesteDuFilet>),
  eclairer: (t, e, hasard, cible) => (estEnDeuxTemps(t) ? N.eclairer(t, e as EtatDuFiletEnDeuxTemps, hasard, cible) : A.eclairer(t, e as EtatDuFilet, hasard, cible)),
  montrer: (t, e) => (estEnDeuxTemps(t) ? N.montrer(t, e as EtatDuFiletEnDeuxTemps) : A.montrer(t, e as EtatDuFilet)),
  reveler: (t, e, v) => (estEnDeuxTemps(t) ? N.reveler(t, e as EtatDuFiletEnDeuxTemps, v) : A.reveler(t, e as EtatDuFilet, v)),
  piece: (t, e, v, i) => (estEnDeuxTemps(t) ? N.piece(t, e as EtatDuFiletEnDeuxTemps, v, i) : A.piece(t, e as EtatDuFilet, v, i)),
  cartel: (t, v) => (estEnDeuxTemps(t) ? N.cartel(t, v) : A.cartel(t, v)),
}

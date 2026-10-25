import { espacesFines } from '../../format'
import { ETOILES_D_UNE_PARTIE } from '../../../../shared/cabinet/bareme'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import type { IssueDUnePartie } from '../../../../shared/cabinet/partie'
import type { BilanVu, Cartel, OeuvreVue, PageDuCabinet } from '../../../../shared/cabinet/vues'
import { enDebutDeLigne } from './Musee'

// Le cartel d'une œuvre : la plaque crème sous la peinture, comme au musée.
// Il garde ce que la partie qui l'a fait entrer — ou qui l'a dorée, ou
// rejouée : il le dit (`ceQueLaPartieAFait`) — lui a appris — la question
// telle que la partie l'a lue, sa réponse, « Le savais-tu ? », le jeu, les
// étoiles, le jour —, relu par le serveur au même pli que la partie
// (invariant 14, `cartelDe`) ; sinon ce qui l'a fait entrer (« Offerte à ton
// arrivée… », « Achetée avec ta poussière d'or… »), dit par le serveur lui
// aussi : la page ne recopie aucune de ces phrases. Il arrive sous la
// peinture, qui s'ouvre sans l'attendre.

/**
 * Ce que la partie d'un cartel a fait à son œuvre, en mots (`Cartel.partie.issue`) :
 * l'appris (« en la dorant ») et la ligne de sa partie (« Dorée au Pari »). Une
 * œuvre achetée ou offerte, puis dorée en jouant ou rejouée à une
 * visite qui la doublait, ne l'a pas gagnée — « en la gagnant » le lui faisait
 * dire. Le bilan d'une partie le dit des mêmes mots (`titreAuBilan`). Sans
 * issue — un cartel écrit à la main —, ou d'une issue qui ne garde pas de
 * cartel, elle l'a gagnée.
 */
export function ceQueLaPartieAFait(issue: IssueDUnePartie | undefined): { appris: string; partie: string } {
  switch (issue) {
    case 'doree':
      return { appris: 'en la dorant', partie: 'Dorée' }
    case 'double':
      return { appris: 'en la rejouant', partie: 'Rejouée' }
    default:
      return { appris: 'en la gagnant', partie: 'Gagnée' }
  }
}

/**
 * Le titre de ce qu'une partie a appris, au bilan : « Son cartel : … » quand
 * la fin a fait de cette partie le cartel de son œuvre, sinon ce qu'elle lui a
 * appris. Gagnée, l'œuvre le prend ; dorée en jouant, ou doublée, seulement si
 * elle n'en avait pas — le serveur garde le premier, et la fin seule le sait
 * (`BilanVu.devientSonCartel`, de la ligne que la base rend) : la page ne le
 * devine pas de l'issue. Gagnée avec le sien puis dorée à 9 sur 9, le bilan
 * disait « Son cartel » d'une manche que l'œuvre rouverte ne montrait pas ;
 * achetée puis dorée en jouant, il taisait le cartel qu'elle venait de prendre.
 * Le bilan relu sans la fin — un geste rejoué, dont la réponse s'était perdue —
 * ne le porte pas : il dit ce que la partie a appris, sans rien promettre.
 */
export function titreAuBilan(b: Pick<BilanVu, 'issue' | 'devientSonCartel'>): string {
  const { appris } = ceQueLaPartieAFait(b.issue)
  return b.devientSonCartel ? `Son cartel : ce que tu as appris ${appris}` : `Ce que tu as appris ${appris}`
}

/**
 * Le cartel, en chemin, lu, ou perdu : sa place se garde, son motif se dit. En
 * chemin, il porte le numéro de sa demande (`cartelArrive`).
 */
export type EtatDuCartel = { etat: 'chargement'; demande?: number } | { etat: 'lu'; cartel: Cartel } | { etat: 'perdu'; motif: string }

// ── Les cartels que la page garde ────────────────────────────────────────
//
// Un cartel se demande à l'ouverture de son œuvre, une fois, et la page le
// garde, œuvre par œuvre (`CabinetApp.tsx`) — jusqu'à ce qu'un geste ou une
// page neuve dise qu'il a pu changer : un achat, une dorure, une partie finie,
// ici ou ailleurs. Chaque décision est une fonction pure, éprouvée seule
// (`cabinet-ecran.test.ts`, et sur les pages du vrai serveur,
// `cabinet-poussiere.test.ts`) : la page n'en garde que le branchement.

/** Le cartel d'une œuvre, demandé : sa place se garde, marquée du numéro de sa demande. */
export const cartelDemande = (cartels: Readonly<Record<string, EtatDuCartel>>, cle: string, demande: number): Record<string, EtatDuCartel> => ({
  ...cartels,
  [cle]: { etat: 'chargement', demande },
})

/**
 * Le cartel arrivé — lu ou perdu —, rangé à sa place si elle attend encore
 * cette demande-là ; sinon rien ne change. Oubliés pendant qu'il était en
 * route, les cartels ont fait partir une demande neuve pour l'œuvre ouverte, ou
 * aucune : parti avant un achat, une dorure ou une partie, il dirait l'œuvre
 * d'avant.
 */
export function cartelArrive(cartels: Readonly<Record<string, EtatDuCartel>>, cle: string, demande: number, lu: EtatDuCartel): Record<string, EtatDuCartel> {
  const attend = cartels[cle]
  return attend?.etat === 'chargement' && attend.demande === demande ? { ...cartels, [cle]: lu } : (cartels as Record<string, EtatDuCartel>)
}

/** Les œuvres d'une page, par leur clé. */
const oeuvresDe = (page: PageDuCabinet): Map<string, OeuvreVue> => new Map(page.salles.flatMap(s => s.oeuvres.map(o => [o.cle, o] as const)))

/**
 * Les cartels gardés que la page neuve laisse tenir : tous, ou aucun — seule
 * l'œuvre ouverte redemande le sien. Ce qu'un geste d'ici change, il le fait
 * oublier lui-même (une partie finie, `Partie.onFinie`) ; ce qui a changé
 * ailleurs — un autre onglet, un autre téléphone, la clôture du lendemain —, la
 * page neuve le dément : un cartel lu dont l'œuvre n'a plus le cadre qu'il a lu
 * (dorée ailleurs, il promettait encore « Rejoue-la pour dorer son cadre ») ;
 * un cartel en route quand l'œuvre a changé entre les deux pages (lu avant, il
 * dirait l'œuvre d'avant) ; tous, dès qu'une partie qui attendait n'attend
 * plus — finie, elle a pu doubler une œuvre sans changer ni `possedee` ni
 * `doree`. Un cartel lu se compare à la page neuve, pas à celle d'avant : lu
 * après une dorure qu'une page en retard ne montrait pas, il tient, et ne se
 * redemande pas en boucle. Rien de démenti : le même objet, et la page ne se
 * redessine pas pour rien.
 */
export function cartelsQuiTiennent(cartels: Readonly<Record<string, EtatDuCartel>>, avant: PageDuCabinet | null, apres: PageDuCabinet): Record<string, EtatDuCartel> {
  const gardes = cartels as Record<string, EtatDuCartel>
  const cles = Object.keys(cartels)
  if (cles.length === 0 || avant === null || avant === apres) return gardes
  if (avant.enCours && avant.enCours.id !== apres.enCours?.id) return {}
  const neuves = oeuvresDe(apres)
  const vieilles = oeuvresDe(avant)
  const dementi = cles.some(cle => {
    const garde = cartels[cle]
    const neuve = neuves.get(cle)
    if (garde.etat === 'lu') return !neuve?.possedee || neuve.doree !== garde.cartel.doree
    if (garde.etat === 'chargement') {
      const vieille = vieilles.get(cle)
      return vieille?.possedee !== neuve?.possedee || vieille?.doree !== neuve?.doree
    }
    return false
  })
  return dementi ? {} : gardes
}

/**
 * Les cartels que la page garde, sans les perdus : seul un cartel lu vaut
 * d'être gardé. Gardé, un échec — une coupure d'un instant — restait sur la
 * plaque jusqu'au rechargement ; oublié, il se redemande à la réouverture de
 * l'œuvre et à chaque page relue. Rien de perdu : le même objet, et la page
 * ne se redessine pas pour rien.
 */
export function sansLesPerdus(cartels: Readonly<Record<string, EtatDuCartel>>): Record<string, EtatDuCartel> {
  const perdus = Object.keys(cartels).filter(cle => cartels[cle].etat === 'perdu')
  if (perdus.length === 0) return cartels as Record<string, EtatDuCartel>
  const gardes = { ...cartels }
  for (const cle of perdus) delete gardes[cle]
  return gardes
}

export function CartelDeLOeuvre({ lu }: { lu: EtatDuCartel }) {
  if (lu.etat === 'chargement') return <div className="cab-cartel cab-cartel-attente" aria-busy="true" />
  if (lu.etat === 'perdu') {
    return (
      <div className="cab-cartel">
        <p className="cab-cartel-ligne">{espacesFines(lu.motif)}</p>
      </div>
    )
  }
  const { cartel } = lu
  const p = cartel.partie
  if (!p) {
    return (
      <div className="cab-cartel">
        {cartel.dit && <p className="cab-cartel-phrase">{espacesFines(cartel.dit)}</p>}
      </div>
    )
  }
  const fait = ceQueLaPartieAFait(p.issue)
  return (
    <div className="cab-cartel">
      <span className="cab-cartel-titre">{`Ce que tu as appris ${fait.appris}`}</span>
      <p className="cab-cartel-sujet">{espacesFines(p.sujet)}</p>
      <p className="cab-cartel-reponse">{espacesFines(p.reponse)}</p>
      {p.anecdote && <p className="cab-cartel-phrase">{espacesFines(p.anecdote)}</p>}
      {/* Le jour sur sa ligne : à la suite, « · le 25 octobre 2026 » passait à la ligne son point en tête. */}
      <span className="cab-cartel-ligne">
        {espacesFines(`${fait.partie} ${JEUX[p.jeu].a}${p.theme ? ` · ${p.theme}` : ''} · ${p.total} sur ${ETOILES_D_UNE_PARTIE}`)}
        <span className="sr-only">, </span>
        <span className="cab-cartel-jour">{enDebutDeLigne(p.jour)}</span>
      </span>
    </div>
  )
}

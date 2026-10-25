import { useContext } from 'react'
import { Icon } from '../../components/Icon'
import { OeuvrePeinte, RARETE_DITE, gemmeDeLaRarete } from '../../components/OeuvrePeinte'
import { PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { ETOILES_D_UNE_PARTIE } from '../../../../shared/cabinet/bareme'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import { poussieresDites } from '../../../../shared/cabinet/musee'
import { POUVOIRS, forceDe, forceDite, pouvoirDe } from '../../../../shared/cabinet/pouvoirs'
import { salle as salleDe } from '../../../../shared/cabinet/salles'
import type { OeuvreVue, PageDuCabinet, SalleVue } from '../../../../shared/cabinet/vues'
import { CartelDeLOeuvre, type EtatDuCartel } from './Cartel'
import { RetourAuMusee, adresseDe, type PartieDemandee } from './ecrans'
import { apresDeuxPoints, compte } from './Musee'
import { oeuvreMontree } from './Salle'

// Une œuvre, touchée sur son mur. À lui : sa peinture en grand, son cartel
// dessous, sa carte-bonus — en faire celle qu'il emporte —, et de quoi dorer
// son cadre, à la poussière d'or ou en la rejouant. Pas encore à lui : le
// cadre vide, où elle se trouve et ce qu'il faut pour la gagner, la chasse,
// l'achat. Les prix et les chasses qui restent viennent de la page ; le
// serveur revérifie tout, et ses refus se disent dans ses mots. Ce que la
// page en dit d'avance n'est qu'un bouton grisé et sa raison dessous :
// `aria-disabled`, jamais `disabled` — le focus resterait sur un bouton mort.

/** L'œuvre et sa salle, lues dans la page ; rien pour une clé que la page ne montre pas. */
export function oeuvreDeLaPage(page: PageDuCabinet, cle: string): { oeuvre: OeuvreVue; salle: SalleVue } | null {
  for (const s of page.salles) {
    const o = s.oeuvres.find(x => x.cle === cle)
    if (o) return { oeuvre: o, salle: s }
  }
  return null
}

/** Ce qui manque à son solde pour ce prix ; zéro s'il l'a. */
const manque = (page: PageDuCabinet, prix: number | undefined) => (prix === undefined ? 0 : Math.max(0, prix - page.poussiere))

/** Pourquoi la chasse de cette œuvre ne part pas, dit sous son bouton ; null : elle part. */
function refusDeLaChasse(page: PageDuCabinet, o: OeuvreVue): string | null {
  if (o.bientot) return 'Ce jeu arrive bientôt'
  if (page.chasses.restent === 0) return 'Plus de chasse pour aujourd’hui : elles reviennent à minuit'
  return null
}

export function Oeuvre({
  page,
  cle,
  cartel,
  carte,
  busy,
  onCarte,
  onAcheter,
  onDorer,
  onJouer,
}: {
  page: PageDuCabinet
  cle: string
  cartel: EtatDuCartel
  /** La carte-bonus retenue sur ce téléphone. */
  carte: string | null
  busy: boolean
  onCarte: (cle: string | null) => void
  onAcheter: (cle: string, prix: number) => void
  onDorer: (cle: string, prix: number) => void
  onJouer: (partie: PartieDemandee) => void
}) {
  const auMusee = useContext(RetourAuMusee)
  const lue = oeuvreDeLaPage(page, cle)
  if (!lue) {
    return (
      <div className="player-shell cab-page">
        <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
        <p>Cette œuvre n’est pas au Cabinet.</p>
      </div>
    )
  }
  const { oeuvre: o, salle } = lue
  const laSalle = salleDe(salle.cle)
  const rarete = RARETE_DITE[o.rarete]
  const jeu = JEUX[o.jeu]
  const chasse = refusDeLaChasse(page, o)
  const pourLaChasse = compte(page.chasses.restent, 'chasse')
  const retour = <Sortie vers={salle.nom} href={adresseDe({ e: 'salle', salle: salle.cle })} />

  if (!o.possedee) {
    const prix = o.prix
    const ilManque = manque(page, prix)
    return (
      <div className="player-shell cab-page">
        {retour}
        <span className="cab-cadre-vide cab-cadre-grand" style={gemmeDeLaRarete(o.rarete)} aria-hidden="true">
          <span className="cab-inconnue">?</span>
          <span className="cab-gemme" />
        </span>
        <PieceTete piece={`Un cadre vide ${laSalle?.deLaSalle ?? ''}`} titre={`Une œuvre ${rarete}`} />
        <section className="cab-bloc" aria-labelledby="cab-ou-chercher">
          {/* Le jeu nommé une fois : « Elle se trouve à l'Éclair » au-dessus de « L'Éclair » le disait deux fois. */}
          <span className="cab-surtitre">Où la chercher</span>
          <h2 id="cab-ou-chercher">{espacesFines(`Elle se trouve ${jeu.a}`)}</h2>
          <p className="cab-ligne">{espacesFines(jeu.geste)}</p>
          <p className="cab-ligne">
            Il faut{' '}
            <b>
              {o.seuil} étoiles sur {ETOILES_D_UNE_PARTIE}
            </b>{' '}
            pour la gagner.
          </p>
        </section>
        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          aria-disabled={chasse !== null || busy || undefined}
          onClick={() => !chasse && !busy && onJouer({ origine: 'chasse', oeuvre: o.cle })}
        >
          {espacesFines(`Partir à sa recherche · ${pourLaChasse} aujourd’hui`)}
        </button>
        {chasse && <p className="cab-raison">{espacesFines(chasse)}</p>}
        {prix !== undefined && (
          <>
            <button type="button" className="btn btn-block" aria-disabled={ilManque > 0 || busy || undefined} onClick={() => ilManque === 0 && !busy && onAcheter(o.cle, prix)}>
              {espacesFines(`L’acheter · ${poussieresDites(prix)}`)}
            </button>
            {ilManque > 0 && <p className="cab-raison">{espacesFines(`Il te manque ${poussieresDites(ilManque)}`)}</p>}
          </>
        )}
        <p className="cab-ligne">{espacesFines(`Tu as ${poussieresDites(page.poussiere)}. Chaque partie en rapporte, même ratée.`)}</p>
      </div>
    )
  }

  const pouvoir = pouvoirDe(o.cle)
  const force = forceDe(o.cle)
  const emportee = carte === o.cle
  const prixDorure = o.prix
  const ilManque = manque(page, prixDorure)
  return (
    <div className="player-shell cab-page">
      {retour}
      <div className="cab-oeuvre-levee">
        <OeuvrePeinte oeuvre={oeuvreMontree(o, salle.cle)} taille="levee" doree={o.doree} />
      </div>
      <PieceTete piece={`Œuvre ${rarete} · ${salle.nom}`} titre={o.nom} />
      <CartelDeLOeuvre lu={cartel} />
      {pouvoir && force && (
        <section className="cab-bloc" aria-labelledby="cab-sa-carte">
          <h2 id="cab-sa-carte">Sa carte-bonus</h2>
          <p className="cab-ligne">
            <b>{POUVOIRS[pouvoir].nom}</b>
            {espacesFines(` : ${apresDeuxPoints(POUVOIRS[pouvoir].dit)} ${forceDite(pouvoir, force)}.`)}
          </p>
          {/* Un nom fixe, l'état par `aria-pressed` (`design.test.ts`) : la phrase dessous dit ce qu'il a choisi. */}
          <button type="button" className="btn btn-block" aria-pressed={emportee} onClick={() => onCarte(emportee ? null : o.cle)}>
            En faire ma carte-bonus
          </button>
          {emportee && <p className="cab-ligne">{espacesFines('Tu l’emportes à ta prochaine partie : l’annonce te la proposera d’abord.')}</p>}
        </section>
      )}
      {o.doree ? (
        <p className="cab-ligne cab-dore">
          <Icon name="sparkles" />
          Son cadre est doré
        </p>
      ) : (
        <section className="cab-bloc" aria-labelledby="cab-son-cadre">
          <h2 id="cab-son-cadre">Son cadre</h2>
          {prixDorure !== undefined && (
            <>
              <button type="button" className="btn btn-block" aria-disabled={ilManque > 0 || busy || undefined} onClick={() => ilManque === 0 && !busy && onDorer(o.cle, prixDorure)}>
                {espacesFines(`Dorer son cadre · ${poussieresDites(prixDorure)}`)}
              </button>
              {ilManque > 0 && <p className="cab-raison">{espacesFines(`Il te manque ${poussieresDites(ilManque)}`)}</p>}
            </>
          )}
          <button
            type="button"
            className="btn btn-block"
            aria-disabled={chasse !== null || busy || undefined}
            onClick={() => !chasse && !busy && onJouer({ origine: 'chasse', oeuvre: o.cle })}
          >
            {espacesFines(`La rejouer ${jeu.a} pour la dorer · une chasse`)}
          </button>
          {chasse && <p className="cab-raison">{espacesFines(chasse)}</p>}
          <p className="cab-ligne">{espacesFines('Doré en jouant : trois manches parfaites, sans qu’un pouvoir ait servi.')}</p>
        </section>
      )}
    </div>
  )
}

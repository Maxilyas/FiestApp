import { useContext, useId } from 'react'
import { Icon } from '../../components/Icon'
import { OeuvrePeinte, RARETE_DITE, gemmeDeLaRarete } from '../../components/OeuvrePeinte'
import { PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { ETOILES_D_UNE_PARTIE } from '../../../../shared/cabinet/bareme'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import { JEU_PAS_LIVRE, PLUS_DE_CHASSE, ilTeManque, poussieresDites } from '../../../../shared/cabinet/musee'
import { POUVOIRS, forceDe, forceDite, pouvoirDe } from '../../../../shared/cabinet/pouvoirs'
import { salle as salleDe } from '../../../../shared/cabinet/salles'
import type { OeuvreVue, PageDuCabinet, SalleVue } from '../../../../shared/cabinet/vues'
import { CartelDeLOeuvre, type EtatDuCartel } from './Cartel'
import { RetourAuMusee, adresseDe, type PartieDemandee } from './ecrans'
import { apresDeuxPoints, compte, laPartieQuiAttend } from './Musee'
import { PartieQuiAttend } from './PartieQuiAttend'
import { oeuvreMontree } from './Salle'

// Une œuvre, touchée sur son mur. À lui : sa peinture en grand, son cartel
// dessous, sa carte-bonus — en faire celle qu'il emporte —, et de quoi dorer
// son cadre, à la poussière d'or ou en la rejouant. Pas encore à lui : le
// cadre vide, où elle se trouve et ce qu'il faut pour la gagner, la chasse,
// l'achat. Les prix et les chasses qui restent viennent de la page ; le
// serveur revérifie tout, et ses refus se disent dans ses mots. Ce que la
// page en dit d'avance n'est qu'un bouton grisé et sa raison dessous :
// `aria-disabled`, jamais `disabled` — le focus resterait sur un bouton mort —,
// et la raison qu'il désigne à l'oreille (`aria-describedby`). Pendant qu'une
// partie attend, rien ne se dépense ni ne part (`refusDeLAchat`,
// `cadreDuDepart`) : chaque geste s'éteint, et leur raison commune ne se dit
// qu'une fois, sous le dernier.

/** L'œuvre et sa salle, lues dans la page ; rien pour une clé que la page ne montre pas. */
export function oeuvreDeLaPage(page: PageDuCabinet, cle: string): { oeuvre: OeuvreVue; salle: SalleVue } | null {
  for (const s of page.salles) {
    const o = s.oeuvres.find(x => x.cle === cle)
    if (o) return { oeuvre: o, salle: s }
  }
  return null
}

/**
 * Pourquoi la chasse de cette œuvre ne part pas, dit sous son bouton dans les
 * mots du serveur et dans son ordre (`cadreDuDepart`) : la partie qui attend,
 * puis les chasses comptées, puis le jeu qui n'est pas livré — sans chasse,
 * dire d'abord le jeu à venir contredisait le toast que le départ aurait
 * rendu. Null : elle part.
 */
function refusDeLaChasse(page: PageDuCabinet, o: OeuvreVue): string | null {
  const attend = laPartieQuiAttend(page)
  if (attend) return attend
  if (page.chasses.restent === 0) return PLUS_DE_CHASSE
  if (o.bientot) return JEU_PAS_LIVRE
  return null
}

/**
 * Pourquoi cet achat ou cette dorure ne passe pas, dans les mots du serveur et
 * dans son ordre (`refusDeLAchat`) : la partie qui attend, puis le solde — elle
 * attend aussi qui a de quoi payer. Null : il passe, ou rien à payer.
 */
function refusDeLaDepense(page: PageDuCabinet, prix: number | undefined): string | null {
  if (prix === undefined) return null
  return laPartieQuiAttend(page) ?? (prix > page.poussiere ? ilTeManque(prix - page.poussiere) : null)
}

/**
 * Un geste de l'œuvre : en sourdine s'il est refusé (`aria-disabled`), sa
 * raison dessous, qu'il désigne à l'oreille. `apres` : la raison du geste qui le
 * suit — la même (la partie qui attend), elle ne se dit qu'une fois, sous le
 * suivant, et les deux la désignent. `reprise` : la partie qui attend, quand
 * c'est elle la raison — sa phrase et « Reprendre » (`PartieQuiAttend`) : la
 * raison en texte nu ne disait pas comment la reprendre.
 */
function Geste({
  id,
  refus,
  apres,
  reprise,
  busy,
  classe,
  onGeste,
  children,
}: {
  id: string
  refus: string | null
  apres?: { id: string; refus: string | null }
  reprise?: { attend: string; page: PageDuCabinet; onReprendre?: () => void }
  busy: boolean
  classe: string
  onGeste: () => void
  children: string
}) {
  const dite = refus !== null && apres?.refus === refus ? apres.id : id
  return (
    <>
      <button type="button" className={classe} aria-disabled={refus !== null || busy || undefined} aria-describedby={refus === null ? undefined : dite} onClick={() => refus === null && !busy && onGeste()}>
        {espacesFines(children)}
      </button>
      {refus !== null &&
        dite === id &&
        (reprise && refus === reprise.attend ? (
          <PartieQuiAttend page={reprise.page} id={id} onReprendre={reprise.onReprendre} />
        ) : (
          <p id={id} className="cab-raison">
            {espacesFines(refus)}
          </p>
        ))}
    </>
  )
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
  onReprendre,
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
  /** La partie qui attend, rouverte : sous les gestes qu'elle éteint, « Reprendre » y ramène. */
  onReprendre?: () => void
}) {
  const auMusee = useContext(RetourAuMusee)
  // Les raisons des gestes, que chaque bouton éteint désigne à l'oreille.
  const id = useId()
  const attend = laPartieQuiAttend(page)
  const reprise = attend === null ? undefined : { attend, page, onReprendre }
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

  const laChasse = { id: `${id}-chasse`, refus: chasse }
  const chasser = () => onJouer({ origine: 'chasse', oeuvre: o.cle })

  if (!o.possedee) {
    const prix = o.prix
    const achat = { id: `${id}-achat`, refus: refusDeLaDepense(page, prix) }
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
        <Geste {...laChasse} apres={prix === undefined ? undefined : achat} reprise={reprise} busy={busy} classe="btn btn-primary btn-big btn-block" onGeste={chasser}>
          {`Partir à sa recherche · ${pourLaChasse} aujourd’hui`}
        </Geste>
        {prix !== undefined && (
          <Geste {...achat} reprise={reprise} busy={busy} classe="btn btn-block" onGeste={() => onAcheter(o.cle, prix)}>
            {`L’acheter · ${poussieresDites(prix)}`}
          </Geste>
        )}
        {/* Pas « chaque partie » : au-delà des premières du jour, une partie libre ne rapporte plus rien (`poussiereDeLaPartie`). */}
        <p className="cab-ligne">{espacesFines(`Tu as ${poussieresDites(page.poussiere)}. Chaque visite ou chasse en rapporte, même ratée.`)}</p>
      </div>
    )
  }

  const pouvoir = pouvoirDe(o.cle)
  const force = forceDe(o.cle)
  const emportee = carte === o.cle
  const prixDorure = o.prix
  const dorure = { id: `${id}-dorure`, refus: refusDeLaDepense(page, prixDorure) }
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
            <Geste {...dorure} apres={laChasse} reprise={reprise} busy={busy} classe="btn btn-block" onGeste={() => onDorer(o.cle, prixDorure)}>
              {`Dorer son cadre · ${poussieresDites(prixDorure)}`}
            </Geste>
          )}
          <Geste {...laChasse} reprise={reprise} busy={busy} classe="btn btn-block" onGeste={chasser}>
            {`La rejouer ${jeu.a} pour la dorer · une chasse`}
          </Geste>
          <p className="cab-ligne">{espacesFines('Doré en jouant : toutes ses manches parfaites, sans qu’un pouvoir ait servi.')}</p>
        </section>
      )}
    </div>
  )
}

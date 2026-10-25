import { useContext } from 'react'
import { Dessin } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { OeuvrePeinte, RARETE_DITE, gemmeDeLaRarete, type OeuvreMontree } from '../../components/OeuvrePeinte'
import { PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import type { CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
import { POUVOIRS, POUVOIR_DE_LA_FAMILLE, pouvoirDe } from '../../../../shared/cabinet/pouvoirs'
import type { CleDeFamille } from '../../../../shared/cabinet/salles'
import type { GardienVu, OeuvreVue, PageDuCabinet, SalleVue } from '../../../../shared/cabinet/vues'
import { legendaire } from '../../../../shared/legendaires'
import { RetourAuMusee, adresseDe } from './ecrans'
import { compte, possedeesDe } from './Musee'

// Une salle du Cabinet : ses œuvres au mur — peintes, ou des cadres vides
// qui disent où chercher —, le pouvoir que ses œuvres donnent en
// carte-bonus, et ses deux gardiens. Un cadre vide ne montre ni la peinture
// ni le nom de son œuvre : on la découvre en la gagnant (la maquette) ; il dit
// sa rareté et son jeu, ce qu'il faut pour partir la chercher.

/** Ce que l'œuvre peinte montre d'une œuvre du Cabinet : sa salle fait sa teinte, telle quelle (`FamilleDOeuvre`). */
export const oeuvreMontree = (o: Pick<OeuvreVue, 'cle' | 'nom' | 'rarete'>, salle: SalleVue['cle']): OeuvreMontree => ({ cle: o.cle, nom: o.nom, rarete: o.rarete, famille: salle })

/** Une case du mur : l'œuvre à lui, peinte ; sinon un cadre vide, sa rareté et le jeu où chercher. */
export function CaseDuMur({ oeuvre, salle }: { oeuvre: OeuvreVue; salle: SalleVue['cle'] }) {
  const adresse = adresseDe({ e: 'oeuvre', oeuvre: oeuvre.cle as CleDOeuvre })
  if (oeuvre.possedee) {
    const pouvoir = pouvoirDe(oeuvre.cle)
    return (
      <a className={'cab-oeuvre' + (oeuvre.doree ? ' cab-doree' : '')} href={adresse}>
        <OeuvrePeinte oeuvre={oeuvreMontree(oeuvre, salle)} taille="main" doree={oeuvre.doree} />
        <b className="cab-oeuvre-nom">{oeuvre.nom}</b>
        <span className="cab-oeuvre-detail">
          <span className="sr-only">{`${RARETE_DITE[oeuvre.rarete]}, `}</span>
          {pouvoir && POUVOIRS[pouvoir].nom}
          {oeuvre.doree && ' · cadre doré'}
        </span>
      </a>
    )
  }
  return (
    <a className="cab-oeuvre cab-vide" href={adresse} style={gemmeDeLaRarete(oeuvre.rarete)}>
      <span className="cab-cadre-vide" aria-hidden="true">
        <span className="cab-inconnue">?</span>
        <span className="cab-gemme" />
      </span>
      <b className="cab-oeuvre-nom">{RARETE_DITE[oeuvre.rarete].replace(/^./, c => c.toUpperCase())}</b>
      <span className="cab-oeuvre-detail">
        {JEUX[oeuvre.jeu].a}
        {/* Sur sa ligne : sur trois colonnes en 360, « · bientôt » passait seul à la ligne, son point en tête. */}
        {oeuvre.bientot && (
          <span className="cab-bientot">
            <span className="sr-only">, </span>bientôt
          </span>
        )}
      </span>
    </a>
  )
}

/** Un gardien de la salle : son médaillon, endormi en silhouette dorée ; son nom, ce qui le réveille, ou qu'il veille. */
export function GardienDeLaSalle({ gardien, rang }: { gardien: GardienVu; rang: 'premier' | 'second' }) {
  const nom = legendaire(gardien.legendaire)?.nom ?? gardien.legendaire
  return (
    <div className="cab-gardien-ligne">
      <span className="cab-medaillon" aria-hidden="true">
        <Dessin cle={gardien.legendaire} verrouille={!gardien.reveille} />
      </span>
      <span className="cab-tuile-texte">
        <b>{nom}</b>
        {/* « Gardien réveillé » s'accorde au gardien, jamais à la créature : la Chouette d'Argent est un gardien. */}
        <span className="cab-ligne">{espacesFines(`${rang === 'premier' ? 'Premier gardien' : 'Second gardien'} · ${gardien.reveille ? 'réveillé' : gardien.condition}`)}</span>
      </span>
    </div>
  )
}

export function Salle({ salle, page }: { salle: SalleVue; page: PageDuCabinet }) {
  const auMusee = useContext(RetourAuMusee)
  const n = possedeesDe(salle)
  const dorees = salle.oeuvres.filter(o => o.doree).length
  // Le Vestibule n'est pas une famille : chacune de ses œuvres a son pouvoir.
  const pouvoir = salle.cle === 'vestibule' ? null : POUVOIRS[POUVOIR_DE_LA_FAMILLE[salle.cle as CleDeFamille]]
  return (
    <div className="player-shell cab-page">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece={`La salle · ${n} sur ${salle.oeuvres.length}`} titre={salle.nom} />
      <p className="cab-devise">« {salle.devise} »</p>
      <p className="cab-ligne">
        {pouvoir ? espacesFines(`Ses œuvres en carte-bonus : ${pouvoir.nom}. ${pouvoir.dit}`) : 'Chacune a son pouvoir, en carte-bonus.'}
      </p>
      {salle.nouvelle && (
        <p className="cab-nouvelle" role="note">
          <Icon name="sparkles" />
          Une œuvre nouvelle est arrivée
        </p>
      )}
      <div className="cab-mur">
        {salle.oeuvres.map(o => (
          <CaseDuMur key={o.cle} oeuvre={o} salle={salle.cle} />
        ))}
      </div>
      <section className="cab-bloc" aria-labelledby="cab-ses-gardiens">
        <h2 id="cab-ses-gardiens">Ses gardiens</h2>
        <GardienDeLaSalle gardien={salle.gardiens[0]} rang="premier" />
        <GardienDeLaSalle gardien={salle.gardiens[1]} rang="second" />
        {/* Rien à promettre d'un gardien qui veille déjà : rapporté de l'Expédition, le Phénix est « réveillé » avant que sa salle soit complète. */}
        {!salle.complete && !salle.gardiens[0].reveille && (
          <p className="cab-ligne">{espacesFines(`Encore ${compte(salle.oeuvres.length - n, 'œuvre')} pour réveiller le premier.`)}</p>
        )}
        {salle.complete && !salle.doree && !salle.gardiens[1].reveille && (
          <p className="cab-ligne">{espacesFines(`${compte(dorees, 'cadre doré', 'cadres dorés')} sur ${salle.oeuvres.length} : tous dorés, le second se réveille.`)}</p>
        )}
      </section>
      <p className="cab-ligne">{espacesFines(`${page.chasses.restent} chasse${page.chasses.restent > 1 ? 's' : ''} aujourd’hui : touche un cadre vide pour partir à sa recherche.`)}</p>
    </div>
  )
}

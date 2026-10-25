import { useContext, useState } from 'react'
import { Dessin } from '../../components/Avatar'
import { Feuille, PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { FORCES_DES_RARETES } from '../../../../shared/cabinet/bareme'
import { POUVOIRS, forceDite } from '../../../../shared/cabinet/pouvoirs'
import { GARDIENS, salle, salleDuGardien } from '../../../../shared/cabinet/salles'
import type { GardienVu, PageDuCabinet } from '../../../../shared/cabinet/vues'
import { legendaire } from '../../../../shared/legendaires'
import { RetourAuMusee, adresseDe } from './ecrans'
import { apresDeuxPoints } from './Musee'

// Les gardiens : les vingt-trois légendaires qui veillent sur le Cabinet —
// deux par salle, et cinq autres (la série, le Cabinet entier, les trois
// fêtes). Endormi, sa silhouette dorée et ce qui le réveille ; réveillé, sa
// peinture et son pouvoir, le plus fort de sa salle. Jamais un Divin : ni
// gardien, ni carte-bonus, ni un mot (invariant 21).

const nomDe = (g: GardienVu) => legendaire(g.legendaire)?.nom ?? g.legendaire

/** La fiche d'un gardien touché : en grand, ce qui l'a réveillé ou le réveillera, sa carte-bonus. */
export function FicheDuGardien({ gardien, carte, onCarte, onFermer }: { gardien: GardienVu; carte: string | null; onCarte: (cle: string | null) => void; onFermer: () => void }) {
  const nom = nomDe(gardien)
  const garde = salle(salleDuGardien(gardien.legendaire))
  const emporte = carte === gardien.legendaire
  const pouvoir = POUVOIRS[gardien.pouvoir]
  return (
    <Feuille titre={nom} onFermer={onFermer} className="cab-feuille">
      <div className="cab-fiche-gardien">
        <span className="cab-medaillon cab-medaillon-grand" aria-hidden="true">
          <Dessin cle={gardien.legendaire} verrouille={!gardien.reveille} grand />
        </span>
        {/* Son nom est au titre de la feuille, juste au-dessus : redit sous le médaillon, on le lisait deux fois. */}
        {garde && <span className="cab-surtitre">{espacesFines(`Gardien ${garde.deLaSalle}`)}</span>}
      </div>
      <p className="cab-ligne">
        {!gardien.reveille
          ? espacesFines(`Endormi. Pour le réveiller : ${gardien.condition.replace(/^./, c => c.toLowerCase())}.`)
          : gardien.voie === 'ailleurs'
            ? espacesFines(`${nom} veillait déjà sur toi : tu l’avais gagné ailleurs.`)
            : espacesFines('Réveillé dans ton Cabinet. Son pouvoir est le plus fort de sa famille.')}
      </p>
      <section className="cab-bloc" aria-labelledby="cab-carte-du-gardien">
        <h2 id="cab-carte-du-gardien">Sa carte-bonus</h2>
        <p className="cab-ligne">
          <b>{pouvoir.nom}</b>
          {espacesFines(` : ${apresDeuxPoints(pouvoir.dit)} ${forceDite(gardien.pouvoir, FORCES_DES_RARETES.legendaire)}.`)}
        </p>
        {gardien.reveille ? (
          <button type="button" className="btn btn-block" aria-pressed={emporte} onClick={() => onCarte(emporte ? null : gardien.legendaire)}>
            En faire ma carte-bonus
          </button>
        ) : (
          <p className="cab-ligne">{espacesFines('Réveillé, ce gardien s’emporte dans tes parties.')}</p>
        )}
      </section>
      {garde && (
        <a className="btn btn-block" href={adresseDe({ e: 'salle', salle: garde.cle })} onClick={onFermer}>
          {espacesFines(`Voir ${garde.laSalle}`)}
        </a>
      )}
    </Feuille>
  )
}

export function Gardiens({ page, carte, onCarte }: { page: PageDuCabinet; carte: string | null; onCarte: (cle: string | null) => void }) {
  const auMusee = useContext(RetourAuMusee)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const reveilles = page.gardiens.tous.filter(g => g.reveille).length
  const fiche = page.gardiens.tous.find(g => g.legendaire === ouvert)
  return (
    <div className="player-shell cab-page">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece={`${reveilles} sur ${GARDIENS.length} réveillés`} titre="Les gardiens" />
      <p className="cab-ligne">{espacesFines('Chacun se réveille d’une façon précise, et devient une carte-bonus très forte.')}</p>
      <ul className="cab-gardiens">
        {page.gardiens.tous.map(g => (
          <li key={g.legendaire}>
            <button type="button" className="cab-gardien" onClick={() => setOuvert(g.legendaire)}>
              <span className="cab-medaillon" aria-hidden="true">
                <Dessin cle={g.legendaire} verrouille={!g.reveille} />
              </span>
              <b className="cab-gardien-nom">{nomDe(g)}</b>
              <span className="cab-gardien-detail">{espacesFines(g.reveille ? POUVOIRS[g.pouvoir].nom : g.condition)}</span>
              {!g.reveille && <span className="sr-only">, endormi</span>}
            </button>
          </li>
        ))}
      </ul>
      {fiche && <FicheDuGardien gardien={fiche} carte={carte} onCarte={onCarte} onFermer={() => setOuvert(null)} />}
    </div>
  )
}

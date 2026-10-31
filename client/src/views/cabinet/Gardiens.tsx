import { useState } from 'react'
import { Dessin } from '../../components/Avatar'
import { Feuille, PieceTete } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { FORCES_DES_RARETES, JOURS_DU_SCARABEE } from '../../../../shared/cabinet/bareme'
import { OEUVRES } from '../../../../shared/cabinet/oeuvres'
import { POUVOIRS, forceDite } from '../../../../shared/cabinet/pouvoirs'
import { AUTRES_GARDIENS, GARDIENS, GARDIENS_DES_SALLES, salle, salleDuGardien } from '../../../../shared/cabinet/salles'
import type { GardienVu, PageDuCabinet } from '../../../../shared/cabinet/vues'
import { legendaire } from '../../../../shared/legendaires'
import { saison } from '../../../../shared/saisons'
import { adresseDe } from './ecrans'
import { apresDeuxPoints, sallesDansLOrdreDeLaTour } from './Musee'

// Les gardiens : les vingt-trois légendaires qui veillent sur le Cabinet —
// deux par salle, et cinq autres (la série, le Cabinet entier, les trois
// fêtes). Endormi, sa silhouette dorée, ce qui le réveille et où il en est ;
// réveillé, sa peinture et son pouvoir, le plus fort de sa salle. Une pièce de
// la barre (`Barre.tsx`) : le propriétaire les trouvait « incompréhensibles »
// (le 31 octobre 2026) — rien ne disait à quoi sert de les réveiller, ni où
// l'on en est. Un gardien réveillé est un avatar légendaire : il se porte
// partout dans FiestApp. Jamais un Divin : ni gardien, ni carte-bonus, ni un
// mot (invariant 21).

const nomDe = (g: GardienVu) => legendaire(g.legendaire)?.nom ?? g.legendaire

/**
 * Où en est le réveil d'un gardien de salle, de la page : ses œuvres pour le premier, ses cadres dorés pour le second. Rien pour
 * un gardien réveillé, ni pour les cinq autres — la série, le Cabinet entier, une fête ne se mesurent pas en une salle.
 */
export function ouEnEst(g: GardienVu, page: Pick<PageDuCabinet, 'salles'>): { n: number; sur: number } | null {
  const cle = salleDuGardien(g.legendaire)
  const s = cle ? page.salles.find(x => x.cle === cle) : undefined
  if (!s || g.reveille) return null
  const premier = GARDIENS_DES_SALLES[s.cle][0] === g.legendaire
  return { n: s.oeuvres.filter(o => (premier ? o.possedee : o.doree)).length, sur: s.oeuvres.length }
}

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

/**
 * Ce qui le réveille, en trois mots sous son nom — la salle est au-dessus, la phrase entière sur sa fiche : « Toutes ses
 * œuvres », « Tous ses cadres dorés », « 30 jours d’affilée », « Pendant Noël ». Dans une carte de 150 pixels, la phrase
 * (« 30 jours d’affilée à répondre à une manche de visite ou de chasse ») prenait cinq lignes.
 */
export function enBref(g: GardienVu): string {
  const cle = salleDuGardien(g.legendaire)
  if (cle) return GARDIENS_DES_SALLES[cle][0] === g.legendaire ? 'Toutes ses œuvres' : 'Tous ses cadres dorés'
  const r = AUTRES_GARDIENS.find(a => a.legendaire === g.legendaire)?.reveil
  if (r && 'serie' in r) return `${JOURS_DU_SCARABEE} jours d’affilée`
  if (r && 'tout' in r) return `Les ${OEUVRES.length} œuvres`
  if (r && 'saison' in r) return `Pendant ${saison(r.saison)?.nom ?? 'sa fête'}`
  return g.condition
}

/** Un gardien, en médaillon : réveillé, sa peinture et son pouvoir ; endormi, sa silhouette, ce qui le réveille et où il en est. */
function CarteDuGardien({ g, page, onOuvrir }: { g: GardienVu; page: Pick<PageDuCabinet, 'salles'>; onOuvrir: () => void }) {
  const p = ouEnEst(g, page)
  return (
    <li>
      <button type="button" className={'cab-gardien' + (g.reveille ? ' cab-gardien-eveille' : '')} onClick={onOuvrir}>
        <span className="cab-medaillon" aria-hidden="true">
          <Dessin cle={g.legendaire} verrouille={!g.reveille} />
        </span>
        <b className="cab-gardien-nom">{nomDe(g)}</b>
        <span className="cab-gardien-detail">{espacesFines(g.reveille ? POUVOIRS[g.pouvoir].nom : enBref(g))}</span>
        {p && (
          <span className="cab-gardien-progres">
            <span className="cab-jauge" aria-hidden="true">
              <span style={{ width: `${Math.round((100 * p.n) / p.sur)}%` }} />
            </span>
            <span className="cab-compte">{`${p.n} sur ${p.sur}`}</span>
          </span>
        )}
        <span className="sr-only">{g.reveille ? ', réveillé' : ', endormi'}</span>
      </button>
    </li>
  )
}

export function Gardiens({ page, carte, onCarte }: { page: PageDuCabinet; carte: string | null; onCarte: (cle: string | null) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const reveilles = page.gardiens.tous.filter(g => g.reveille).length
  const fiche = page.gardiens.tous.find(g => g.legendaire === ouvert)
  // Rangés par salle, ses deux gardiens côte à côte — le premier réveillé par ses œuvres, le second par ses cadres dorés —,
  // puis les cinq autres : vingt-trois médaillons en vrac se lisaient comme une liste de règles.
  const gardiensDe = (cles: readonly string[]) => cles.flatMap(l => page.gardiens.tous.filter(g => g.legendaire === l))
  const groupes = [
    ...sallesDansLOrdreDeLaTour(page).map(s => ({ cle: s.cle, nom: s.nom, gardiens: gardiensDe(GARDIENS_DES_SALLES[s.cle]) })),
    { cle: 'autres', nom: 'Les autres', gardiens: gardiensDe(AUTRES_GARDIENS.map(a => a.legendaire)) },
  ].filter(x => x.gardiens.length > 0)
  return (
    <div className="player-shell cab-page">
      <PieceTete piece={`${reveilles} sur ${GARDIENS.length} réveillés`} titre="Les gardiens" />
      {/* À quoi sert de les réveiller, en une ligne : rien ne le disait, et l'écran semblait une liste de règles. */}
      <p className="cab-ligne cab-gardiens-but">{espacesFines('Réveillé, un gardien devient ton avatar légendaire, à porter partout.')}</p>
      {groupes.map(x => (
        <section key={x.cle} className="cab-gardiens-groupe" aria-labelledby={`cab-gardiens-${x.cle}`}>
          <h2 id={`cab-gardiens-${x.cle}`}>{x.nom}</h2>
          <ul className="cab-gardiens">
            {x.gardiens.map(g => (
              <CarteDuGardien key={g.legendaire} g={g} page={page} onOuvrir={() => setOuvert(g.legendaire)} />
            ))}
          </ul>
        </section>
      ))}
      {fiche && <FicheDuGardien gardien={fiche} carte={carte} onCarte={onCarte} onFermer={() => setOuvert(null)} />}
    </div>
  )
}

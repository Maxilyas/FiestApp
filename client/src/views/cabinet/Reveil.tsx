import { CompagnonRejoint, LegendaireOuvert } from '../../components/Ouverts'
import { Feuille } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { toucher } from '../../toucher'
import type { CleDeCompagnon } from '../../../../shared/compagnons'
import type { ReveilDesGardiens } from '../../../../shared/cabinet/vues'
import { ceQuiLeReveille, seReveille, veillaitDeja } from './reveils'

// Un gardien qui s'éveille (§ 5.3), dit comme à la fin d'une expédition : neuf,
// il s'annonce en grand (`LegendaireOuvert`) — sa raison au-dessus de lui, et on
// le porte d'ici ; déjà à lui par une autre voie, une ligne : « Salle
// complète ! Le Phénix veillait déjà sur elle. » ; la luciole, à la première
// salle complète, rejoint sa niche (`CompagnonRejoint`). Le bilan d'une partie
// le dit ainsi (`Bilan.tsx`), et la page d'une dépense qui en réveille un, ou
// celle qui suit une partie d'hier close par le serveur (`AnnonceDuReveil`,
// `CabinetApp.tsx`) : une fois chacun — le serveur ne le dit qu'une fois.
//
// À la demande : rare, et ses cartes font venir de quoi dessiner un médaillon.
// Jamais un Divin (invariant 21) : le serveur n'en réveille aucun.

/** Ce que la luciole vient faire ici : elle rejoignait qui menait une expédition au bout, elle rejoint qui complète une salle. */
const POURQUOI_LA_LUCIOLE = 'Ta première salle complète'

/**
 * Les légendaires neufs en grand ; au-dessus de chacun que le Cabinet a
 * réveillé (`parLeCabinet`, le verdict du serveur), sa raison ; ceux qui
 * veillaient déjà, une ligne ; la luciole. Un légendaire qu'un palier ouvre
 * pendant la partie passe par les mêmes cartes, sans raison : les vingt-trois
 * gardiens ont d'autres voies — la Chimère par L'Alpiniste —, et déduite de la
 * seule clé, la raison la disait réveillée par une salle toute dorée.
 */
export function GardiensQuiSEveillent({
  neufs,
  parLeCabinet,
  veillaient,
  compagnon,
}: {
  neufs: readonly string[]
  parLeCabinet: readonly string[]
  veillaient: readonly string[]
  compagnon?: CleDeCompagnon
}) {
  return (
    <>
      {veillaient.map(cle => (
        <p key={cle} className="cab-ligne cab-dit">
          {espacesFines(veillaitDeja(cle))}
        </p>
      ))}
      {neufs.map(cle => (
        <div key={cle} className="cab-reveil">
          {parLeCabinet.includes(cle) && ceQuiLeReveille(cle) && <p className="cab-ligne cab-dit">{espacesFines(seReveille(cle))}</p>}
          <LegendaireOuvert cle={cle} dejaPorte={false} />
        </div>
      ))}
      {compagnon && <CompagnonRejoint cle={compagnon} pourquoi={POURQUOI_LA_LUCIOLE} />}
    </>
  )
}

/**
 * Ce qu'une dépense vient de réveiller — l'achat qui complète une salle, la
 * dorure qui dore la dernière —, ou la partie d'hier que le serveur a close :
 * une feuille par-dessus l'écran, jamais par-dessus une partie, où le chrono
 * courrait dessous. « Continuer » la ferme, et la page n'y revient pas.
 */
export function AnnonceDuReveil({ reveil, onFermer }: { reveil: ReveilDesGardiens; onFermer: () => void }) {
  const neufs = reveil.gardiens.filter(g => g.neuf).map(g => g.legendaire)
  const veillaient = reveil.gardiens.filter(g => !g.neuf).map(g => g.legendaire)
  const titre = neufs.length > 1 ? 'Des gardiens se réveillent' : neufs.length === 1 ? 'Un gardien se réveille' : 'Ton Cabinet'
  return (
    <Feuille
      titre={titre}
      onFermer={onFermer}
      className="cab-feuille"
      pied={
        <button type="button" className="btn btn-primary btn-big btn-block" {...toucher(onFermer)}>
          Continuer
        </button>
      }
    >
      <GardiensQuiSEveillent neufs={neufs} parLeCabinet={neufs} veillaient={veillaient} compagnon={reveil.compagnon} />
    </Feuille>
  )
}

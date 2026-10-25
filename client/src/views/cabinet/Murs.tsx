import { espacesFines } from '../../format'
import { anneeDite } from '../../../../shared/frise'
import type { MursDuCabinet } from '../../../../shared/cabinet/vues'
import { CarteDeFrance, DessinDuLieu } from './CarteDeFrance'
import { compte } from './Musee'

// Tes murs (§ 3.10, `#murs`) : ce que tes parties t'ont appris trouve sa place
// — chaque lieu de l'Épingle sur ta carte de France, chaque date rangée sur ta
// frise, du plus ancien au plus récent, d'où qu'elle vienne (le Cabinet, une
// frise de l'Expédition). Rien ne s'écrit pour eux : le serveur les dérive du
// journal des réponses et du contenu livré (`GET /api/cabinet/murs`), et ne dit
// rien qu'une révélation n'ait dit.
//
// Ce fichier n'est que leur dessin, chargé à la demande comme la carte qu'il
// pose : le musée ne le télécharge pas. Leur écran — la sortie, le titre, les
// murs demandés à chaque visite, ce qu'on attend — est dans `CabinetApp.tsx`
// (`EcranDesMurs`), qui le rend une fois : remplacé à l'arrivée du dessin, son
// titre emportait le focus que la page venait d'y poser.

/** Tes murs, tels que le serveur les dit — pur : tes lieux sur la carte de France et en mots, ta frise. */
export function LesMurs({ murs }: { murs: MursDuCabinet }) {
  const lieux = compte(murs.lieux.length, 'lieu épinglé', 'lieux épinglés')
  return (
    <>
      <section className="cab-tes-murs" aria-labelledby="cab-tes-lieux">
        <div className="cab-entre">
          <h2 id="cab-tes-lieux">Tes lieux</h2>
          <span className="cab-compte">{lieux}</span>
        </div>
        <CarteDeFrance nom={`Ta carte de France : ${lieux}`}>
          {murs.lieux.map(l => (
            <DessinDuLieu key={l.id} point={l} petit />
          ))}
        </CarteDeFrance>
        {murs.lieux.length === 0 ? (
          <p className="cab-ligne cab-rappel">{espacesFines('Encore vide : une partie de l’Épingle la commencera.')}</p>
        ) : (
          <ol className="cab-lieux">
            {murs.lieux.map(l => (
              <li key={l.id}>
                <b>{espacesFines(l.nom)}</b>
                <span className="cab-rappel">{espacesFines(`${l.commune} (${l.departement}) · ${l.date}`)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="cab-tes-murs" aria-labelledby="cab-ta-frise">
        <div className="cab-entre">
          <h2 id="cab-ta-frise">Ta frise</h2>
          <span className="cab-compte">{compte(murs.dates.length, 'date')}</span>
        </div>
        {murs.dates.length === 0 ? (
          <p className="cab-ligne cab-rappel">{espacesFines('Encore vide : une partie de la Frise la commencera.')}</p>
        ) : (
          <>
            <p className="cab-sens">↑ Plus ancien</p>
            <ol className="cab-frise" aria-label="Ta frise, du plus ancien au plus récent">
              {murs.dates.map((d, i) => (
                <li key={i} className="cab-evenement">
                  <b className="cab-annee">{anneeDite(d.annee)}</b>
                  <span className="cab-libelle">{espacesFines(d.libelle)}</span>
                </li>
              ))}
            </ol>
            <p className="cab-sens">↓ Plus récent</p>
          </>
        )}
      </section>
    </>
  )
}

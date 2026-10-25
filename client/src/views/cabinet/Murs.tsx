import { useCallback, useContext, useEffect, useState } from 'react'
import { api, motifDe } from '../../api'
import { PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { anneeDite } from '../../../../shared/frise'
import type { MursDuCabinet } from '../../../../shared/cabinet/vues'
import { CarteDeFrance, DessinDuLieu } from './CarteDeFrance'
import { RetourAuMusee } from './ecrans'
import { compte } from './Musee'

// Tes murs (§ 3.10, `#murs`) : ce que tes parties t'ont appris trouve sa place
// — chaque lieu de l'Épingle sur ta carte de France, chaque date rangée sur ta
// frise, du plus ancien au plus récent, d'où qu'elle vienne (le Cabinet, une
// frise de l'Expédition). Rien ne s'écrit pour eux : le serveur les dérive du
// journal des réponses et du contenu livré (`GET /api/cabinet/murs`), et ne dit
// rien qu'une révélation n'ait dit.
//
// Chargés à la demande (`CabinetApp.tsx`), comme la carte qu'ils dessinent : le
// musée ne les télécharge pas. Relus à chaque visite : une partie finie entre
// deux y a posé un lieu ou des dates.

export type EtatDesMurs = { etat: 'chargement' } | { etat: 'lus'; murs: MursDuCabinet } | { etat: 'perdu'; motif: string }

/** Tes murs, tels que le serveur les dit — pur : `TesMurs` les demande. */
export function EcranDesMurs({ etat, onRelire }: { etat: EtatDesMurs; onRelire?: () => void }) {
  const auMusee = useContext(RetourAuMusee)
  return (
    <div className="player-shell cab-page cab-murs">
      <Sortie vers="Le Cabinet" href="/cabinet" onClick={auMusee} />
      <PieceTete piece="Le Cabinet de curiosités" titre="Tes murs" />
      <p className="cab-ligne">{espacesFines('Ce que tes parties t’ont appris trouve sa place ici : un lieu sur ta carte de France, une date sur ta frise.')}</p>
      {etat.etat === 'chargement' && (
        <p className="cab-ligne" aria-busy="true">
          Chargement…
        </p>
      )}
      {etat.etat === 'perdu' && (
        <>
          <p className="error">{espacesFines(etat.motif)}</p>
          {onRelire && (
            <button type="button" className="btn btn-block" onClick={onRelire}>
              Réessayer
            </button>
          )}
        </>
      )}
      {etat.etat === 'lus' && <LesMurs murs={etat.murs} />}
    </div>
  )
}

function LesMurs({ murs }: { murs: MursDuCabinet }) {
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

/** Tes murs, demandés à l'ouverture de leur écran ; perdus en route, « Réessayer » les redemande. */
export function TesMurs() {
  const [etat, setEtat] = useState<EtatDesMurs>({ etat: 'chargement' })
  const lire = useCallback(() => {
    let vivant = true
    setEtat({ etat: 'chargement' })
    api.cabinet.murs().then(
      murs => vivant && setEtat({ etat: 'lus', murs }),
      (e: unknown) => vivant && setEtat({ etat: 'perdu', motif: motifDe(e) }),
    )
    return () => {
      vivant = false
    }
  }, [])
  useEffect(lire, [lire])
  return <EcranDesMurs etat={etat} onRelire={() => void lire()} />
}

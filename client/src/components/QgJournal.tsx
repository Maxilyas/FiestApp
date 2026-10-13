import { useEffect, useRef, useState } from 'react'
import { api, motifDe } from '../api'
import { espacesFines } from '../format'
import { Icon, type IconName } from './Icon'
import { Onglets } from './Onglets'
import { gestesParJour, heureEcrite, NOM_DE_LA_SORTE, type GesteDuQg, type SorteDeGeste } from '../../../shared/qg'

/** Les filtres du journal : tout, ou une sorte de gestes. « Autre » ne se filtre pas : il n'existe que si une route a oublié sa phrase. */
type Filtre = 'tous' | Exclude<SorteDeGeste, 'autre'>
const FILTRES: readonly Filtre[] = ['tous', 'profil', 'salon', 'catalogue', 'jour', 'campagne']

const ICONE: Record<SorteDeGeste, IconName> = { profil: 'users', salon: 'home', catalogue: 'globe', jour: 'sun', campagne: 'target', autre: 'clipboard' }

/**
 * Le journal des gestes (`/admin#journal`) : ce que l'administrateur a fait
 * d'ici, du plus récent au plus ancien, rangé par jour — un profil supprimé,
 * un salon renommé, une question retirée pour tous. Chaque geste qui change
 * quelque chose s'y note de lui-même (`server/src/core/journalDesGestes.ts`) ;
 * la page ne fait que le lire, cinquante gestes à la fois.
 */
export function QgJournal() {
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [gestes, setGestes] = useState<GesteDuQg[] | null>(null)
  const [suite, setSuite] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [enCours, setEnCours] = useState(false)
  const sorte = filtre === 'tous' ? null : filtre
  // Le filtre montré : une page d'avant demandée sous un autre ne s'y ajoute pas.
  const sorteMontree = useRef(sorte)
  sorteMontree.current = sorte

  useEffect(() => {
    // Un filtre changé pendant la lecture d'avant : seule la dernière se pose.
    let perime = false
    setGestes(null)
    setSuite(null)
    setError('')
    api.admin.gestes({ sorte }).then(
      j => {
        if (perime) return
        setGestes(j.gestes)
        setSuite(j.suite)
      },
      e => !perime && setError(motifDe(e)),
    )
    return () => {
      perime = true
    }
  }, [sorte])

  const avant = async () => {
    if (!suite || enCours) return
    setEnCours(true)
    const pour = sorte
    try {
      const j = await api.admin.gestes({ sorte: pour, suite })
      if (sorteMontree.current !== pour) return
      setGestes(g => [...(g ?? []), ...j.gestes])
      setSuite(j.suite)
    } catch (e) {
      if (sorteMontree.current === pour) setError(motifDe(e))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <p className="muted small">
        Ce que tu as fait d’ici, du plus récent au plus ancien. Chaque geste qui change quelque chose s’y note de lui-même : un profil
        supprimé, un salon renommé, une question retirée pour tous.
      </p>
      <Onglets
        onglets={FILTRES.map(f => ({ id: f, nom: f === 'tous' ? 'Tous' : NOM_DE_LA_SORTE[f] }))}
        actif={filtre}
        onChoisir={setFiltre}
        label="Les gestes à montrer"
        idOnglet={f => `journal-${f}`}
        idPanneau={() => 'journal-gestes'}
        className="onglets-puces"
      />
      <div className="qg-journal" role="tabpanel" id="journal-gestes" aria-labelledby={`journal-${filtre}`}>
        {error ? (
          <p className="error">{error}</p>
        ) : !gestes ? (
          <p className="serif-note">Chargement…</p>
        ) : gestes.length === 0 ? (
          <p className="serif-note">{sorte ? 'Aucun geste de ce côté-là.' : 'Rien encore : tes gestes s’écriront ici.'}</p>
        ) : (
          <>
            {gestesParJour(gestes, Date.now()).map(groupe => (
              <section key={groupe.jour} className="qg-journal-jour" aria-label={groupe.titre}>
                <h2 className="compte-groupe">{groupe.titre}</h2>
                <ul className="qg-liste">
                  {groupe.gestes.map(g => (
                    <li key={g.id} className="qg-geste">
                      <span className="qg-rond">
                        <Icon name={ICONE[g.sorte]} />
                      </span>
                      <span className="qg-ligne-texte">
                        {/* Les espaces insécables à l'affichage : au téléphone, un « ouvrant restait seul en bout de ligne. */}
                        <span>{espacesFines(g.resume)}</span>
                        <span className="muted small">
                          {heureEcrite(g.quand)} · {NOM_DE_LA_SORTE[g.sorte]}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {suite && (
              <button type="button" className="btn btn-ghost qg-journal-avant" aria-disabled={enCours || undefined} onClick={avant}>
                Voir les gestes d’avant
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}

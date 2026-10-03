import { useEffect, useState } from 'react'
import { api } from '../api'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'
import { showToast } from '../state'
import { espacesFines, quand } from '../format'
import type { ProfilDAdministration } from '../../../shared/profil'

/**
 * « Les profils », à `/admin` : l'administrateur ne gère plus seulement des
 * comptes d'animateur, mais les personnes — les chercher, en supprimer une.
 * Sans recherche, les derniers vus. La suppression dit avant le clic ce
 * qu'elle emporte, et ce qui reste : l'espace qu'il tenait — son salon, un
 * compte d'animateur —, détaché, et les soirées jouées, aux autres.
 */
export function AdminProfils() {
  const [cherche, setCherche] = useState('')
  const [liste, setListe] = useState<{ total: number; profils: ProfilDAdministration[] } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [relire, setRelire] = useState(0)

  useEffect(() => {
    // Le temps de finir le mot, et une recherche partie avant la suivante
    // ne remplace jamais sa liste.
    let perimee = false
    const minuteur = setTimeout(
      () => {
        api.admin
          .profils(cherche.trim())
          .then(l => !perimee && setListe(l))
          .catch(e => !perimee && showToast({ kind: 'error', message: (e as Error).message }))
      },
      cherche ? 250 : 0,
    )
    return () => {
      perimee = true
      clearTimeout(minuteur)
    }
  }, [cherche, relire])

  const supprimer = async (p: ProfilDAdministration) => {
    // Sans genre : un prénom ne dit pas qui l'on est. L'espace reste : les
    // souvenirs des soirées qu'on y a jouées s'ouvrent toujours.
    const salon = p.salon
      ? p.salon.propre
        ? ` Son salon reste, sans titulaire, avec ${p.salon.quiz === 0 ? '' : p.salon.quiz === 1 ? 'son quiz et ' : `ses ${p.salon.quiz} quiz et `}les souvenirs de ses soirées : il se supprime à part, dans « Tous les comptes ».`
        : ` Le compte d’animateur « ${p.salon.slug} » reste, sans ce profil.`
      : ''
    const ok = await confirmDialog({
      title: `Supprimer le profil de ${p.nom} ?`,
      message:
        `Son niveau, ses avatars, ses trophées, ses parties du quiz du jour et de la campagne disparaissent pour de bon.${salon} ` +
        'Les soirées jouées restent dans l’historique des autres joueurs, avec ce qu’elles leur ont rapporté.',
      confirmLabel: 'Supprimer le profil',
      danger: true,
    })
    if (!ok) return
    setOccupe(true)
    try {
      const fait = await api.admin.supprimerProfil(p.id)
      showToast({ kind: 'info', message: `Le profil de ${p.nom} est supprimé${fait.salon ? ' — son espace reste, sans titulaire' : ''}` })
      setRelire(n => n + 1)
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <section className="card" id="les-profils" aria-labelledby="titre-profils">
      <h2 id="titre-profils">Les profils</h2>
      <p className="muted">
        {liste ? `${liste.total} profil${liste.total > 1 ? 's' : ''} sur ce serveur.` : 'Chargement…'} Sans recherche, les derniers vus.
      </p>
      <label className="champ-recherche">
        <Icon name="search" />
        <input
          className="input"
          type="search"
          value={cherche}
          placeholder="Chercher un prénom, un identifiant…"
          aria-label="Chercher un profil"
          onChange={e => setCherche(e.target.value)}
        />
      </label>
      {liste && liste.profils.length === 0 && <p className="serif-note">Aucun profil ne correspond.</p>}
      <ul className="profils-admin">
        {liste?.profils.map(p => (
          <li key={p.id} className="profil-admin">
            <span className="profil-admin-avatar" aria-hidden="true">
              {p.avatar}
            </span>
            <span className="profil-admin-texte">
              <b>
                {espacesFines(p.nom)} <span className="muted small">niv. {p.niveau}</span>
              </b>
              <span className="muted small">
                @{p.login} · {p.soirees} soirée{p.soirees > 1 ? 's' : ''}
                {p.salon && ` · ${p.salon.propre ? 'salon' : 'anime'} ${p.salon.slug} (${p.salon.quiz} quiz)`}
                {p.vuLe && ` · vu ${quand(p.vuLe)}`}
              </span>
            </span>
            {p.toi ? (
              <span className="muted small">toi</span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-small btn-icon"
                aria-label={`Supprimer le profil de ${p.nom}`}
                disabled={occupe}
                onClick={() => void supprimer(p)}
              >
                <Icon name="trash" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'
import { Feuille } from './Pieces'
import { showToast } from '../state'
import { espacesFines, quand } from '../format'
import type { ProfilDAdministration } from '../../../shared/profil'

/**
 * « Les profils », à `/admin#profils` : les personnes — les chercher, en
 * supprimer une. Sans recherche, les derniers vus. Une ligne chacun, qui
 * ouvre sa feuille, comme les lignes de « Mon compte » : la corbeille au bout
 * de chaque ligne se touchait en voulant faire défiler. La suppression dit
 * avant le clic ce qu'elle emporte, et ce qui reste : l'espace qu'il tenait
 * — son salon, un compte d'animateur —, détaché, et les soirées jouées, aux
 * autres.
 */
export function AdminProfils() {
  const [cherche, setCherche] = useState('')
  const [liste, setListe] = useState<{ total: number; profils: ProfilDAdministration[] } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [relire, setRelire] = useState(0)
  const [ouvert, setOuvert] = useState<ProfilDAdministration | null>(null)

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
        ? ` Son salon reste, sans titulaire, avec ${p.salon.quiz === 0 ? '' : p.salon.quiz === 1 ? 'son quiz et ' : `ses ${p.salon.quiz} quiz et `}les souvenirs de ses soirées : il se supprime à part, dans « Les salons ».`
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
      setOuvert(null)
      setRelire(n => n + 1)
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <>
      <p className="muted small">
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
      {liste && liste.profils.length > 0 && (
        <ul className="style-liste admin-espaces">
          {liste.profils.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => setOuvert(p)}>
                <span className="admin-pastille" aria-hidden="true">
                  {p.avatar}
                </span>
                <span className="admin-espace-texte">
                  <b>{espacesFines(p.nom)}</b>
                  <span className="muted small">
                    niv. {p.niveau} · {p.soirees} soirée{p.soirees > 1 ? 's' : ''}
                    {p.vuLe && ` · vu ${quand(p.vuLe)}`}
                  </span>
                </span>
                {p.toi && <span className="etiquette">toi</span>}
                <Icon name="chevron-down" className="style-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {ouvert && (
        <Feuille titre={ouvert.nom} onFermer={() => setOuvert(null)}>
          <dl className="admin-fiche">
            <div>
              <dt>Identifiant</dt>
              <dd>@{ouvert.login}</dd>
            </div>
            <div>
              <dt>Niveau</dt>
              <dd>{ouvert.niveau}</dd>
            </div>
            <div>
              <dt>Soirées</dt>
              <dd>{ouvert.soirees}</dd>
            </div>
            <div>
              <dt>Espace</dt>
              <dd>{ouvert.salon ? `${ouvert.salon.propre ? 'Son salon' : 'Le compte d’animateur'} /${ouvert.salon.slug} · ${ouvert.salon.quiz} quiz` : 'Aucun'}</dd>
            </div>
            <div>
              <dt>Vu</dt>
              <dd>{ouvert.vuLe ? quand(ouvert.vuLe) : 'jamais'}</dd>
            </div>
          </dl>
          {ouvert.toi ? (
            <p className="muted small">C’est ton profil : il ne se supprime pas d’ici.</p>
          ) : (
            <div className="admin-gestes">
              <button type="button" className="salon-geste admin-geste-danger" disabled={occupe} onClick={() => void supprimer(ouvert)}>
                <Icon name="trash" />
                Supprimer le profil
              </button>
            </div>
          )}
        </Feuille>
      )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { CarteDeJoueur } from '../../../shared/carte'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { NOM_RARETE } from '../../../shared/badges'
import { deNom, espacesFines, formatNumber, place, reponsesParType, secondes } from '../format'
import { Avatar } from './Avatar'
import { Chiffres, justesses } from './Carriere'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { Niveau } from './Niveau'

/**
 * La carte d'un joueur, ouverte en touchant son nom : ce qu'il fait ce soir,
 * et, s'il a un profil, son niveau, ses Divins et ses légendaires, ses
 * récompenses les plus rares et quelques chiffres. C'est ici que les
 * cosmétiques ont enfin un public.
 *
 * Un invité anonyme a la sienne : sa soirée, sans rien qui dise ce qui lui
 * manque. Un surnom donné par l'animateur ne cache pas le prénom du profil.
 */
export function CarteJoueur({ slug, playerId, onFermer }: { slug: string; playerId: string; onFermer: () => void }) {
  const [carte, setCarte] = useState<CarteDeJoueur | null>(null)
  const [erreur, setErreur] = useState('')
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivant = true
    fetch(`/s/${slug}/joueurs/${encodeURIComponent(playerId)}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'Ce joueur a quitté la soirée' : 'Carte indisponible'))))
      .then(c => vivant && setCarte(c))
      .catch((e: Error) => vivant && setErreur(e.message))
    return () => {
      vivant = false
    }
  }, [slug, playerId])

  // Le clavier arrive dans la carte — une fois : la page se redessine à chaque
  // instantané, et `onFermer` avec elle.
  useEffect(() => {
    boite.current?.focus()
  }, [])

  // Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFermer()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFermer])

  const p = carte?.profil
  return (
    <div className="dialog-backdrop" onClick={onFermer}>
      <div
        ref={boite}
        className="card dialog carte-joueur"
        role="dialog"
        aria-modal="true"
        aria-label={carte ? `Carte ${deNom(carte.nom)}` : 'Carte du joueur'}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {erreur && <p className="muted">{erreur}</p>}
        {!carte && !erreur && <p className="muted">Chargement…</p>}
        {carte && (
          <>
            <header className="carte-tete">
              <Avatar
                className="carte-avatar"
                avatar={carte.avatar}
                finition={carte.finition}
                eclat={carte.eclat}
                legendaire={carte.legendaire}
              />
              <div>
                <h3>
                  {carte.nom}
                  <Niveau niveau={p?.niveau} big />
                </h3>
                {p && p.prenom !== carte.nom && <p className="muted small">{espacesFines(`« ${carte.nom} »`)} ce soir — {p.prenom} sur son profil</p>}
                <p className="carte-soir">
                  {carte.ceSoir.rang > 0 ? (
                    <>
                      <b>{place(carte.ceSoir.rang)}</b> sur {carte.ceSoir.joueurs} · {formatNumber(carte.ceSoir.points)} pts
                    </>
                  ) : (
                    'Pas encore de points ce soir'
                  )}
                </p>
                {/* Les QCM et les estimations, chacun à sa façon : « 1/64
                    justes » comptait des estimations qui ne sont jamais justes. */}
                {carte.ceSoir.reponses > 0 && <p className="muted small">{reponsesParType(carte.ceSoir)}</p>}
              </div>
            </header>

            {p && (
              <>
                {(p.divins ?? []).length > 0 && (
                  <div className="carte-legendaires carte-divins" aria-label="Divins">
                    {p.divins.map(cle => (
                      <span key={cle} className="carte-legendaire" title={divin(cle)?.nom}>
                        <Divin cle={cle} />
                      </span>
                    ))}
                  </div>
                )}
                {p.legendaires.length > 0 && (
                  <div className="carte-legendaires" aria-label="Avatars légendaires">
                    {p.legendaires.map(cle => (
                      <span key={cle} className="carte-legendaire" title={legendaire(cle)?.nom}>
                        <Legendaire cle={cle} />
                      </span>
                    ))}
                  </div>
                )}
                {/* La justesse aux QCM et aux estimations, côte à côte : la
                    plus longue série, qui ne compte que les QCM, a cédé sa case. */}
                <Chiffres
                  className="carte-chiffres"
                  cases={[
                    ['Soirées', formatNumber(p.fiche.soirees)],
                    ['Quiz gagnés', formatNumber(p.fiche.quizGagnes)],
                    ['Hauts faits', formatNumber(p.hautsFaits)],
                    ...justesses(p.fiche),
                    ['Réflexe moyen', secondes(p.fiche.reflexeMoyenMs)],
                  ]}
                />
                {p.vitrine.length > 0 && (
                  <ul className="carte-vitrine">
                    {p.vitrine.map(b => (
                      <li key={b.key} title={b.title}>
                        <span className="carte-badge-emoji" aria-hidden="true">
                          {b.emoji}
                        </span>
                        <span className="carte-badge-titre">{b.title}</span>
                        {b.rarete && <span className="muted small">{NOM_RARETE[b.rarete]}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
        <div className="row dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

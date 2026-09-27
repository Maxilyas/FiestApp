import { useEffect, useRef, useState } from 'react'
import type { CarteDeJoueur } from '../../../shared/carte'
import type { BadgePorte } from '../../../shared/badges'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { ceQuIlAFallu, hautFait } from '../../../shared/hautsfaits'
import { deNom, espacesFines, formatNumber, place, reponsesParType, secondes, pts } from '../format'
import { Avatar, Dessin } from './Avatar'
import { chargerDessinsAuPlus, complets, sortesDe, useDessins } from './medaillons'
import { Chiffres, justesses } from './Chiffres'
import { Flamme, Icon } from './Icon'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { useModale } from '../modale'
import { partsDuNomAffiche } from '../../../shared/homonymes'
import { Ecusson } from './Ecusson'
import { Glossaire } from './Glossaire'
import type { Mot } from '../../../shared/glossaire'
import { fond as fondDeCarte } from '../../../shared/fonds'

/**
 * La carte d'un joueur, ouverte en touchant son nom : ce qu'il fait ce soir,
 * et, s'il a un profil, son niveau, ses Divins et ses légendaires, ses plus
 * beaux hauts faits, quelques chiffres et sa collection de prix. C'est ici
 * que les cosmétiques ont enfin un public.
 *
 * Un invité anonyme a la sienne : sa soirée, sans rien qui dise ce qui lui
 * manque. Un surnom donné par l'animateur ne cache pas le prénom du profil.
 */
export function CarteJoueur({
  slug,
  playerId,
  adresse,
  onFermer,
}: {
  slug?: string
  playerId?: string
  /** D'où la lire, si ce n'est pas un invité de la soirée : sa propre carte, depuis sa page. */
  adresse?: string
  onFermer: () => void
}) {
  const [carte, setCarte] = useState<CarteDeJoueur | null>(null)
  const [erreur, setErreur] = useState('')
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivant = true
    fetch(adresse ?? `/s/${slug}/joueurs/${encodeURIComponent(playerId ?? '')}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'Ce joueur a quitté la soirée' : 'Carte indisponible'))))
      // Une carte à médaillons attend leurs dessins sous son « Chargement… » :
      // ouverte avant, elle montrerait des cercles vides qui se remplissent.
      // Deux secondes et demie au plus : une requête muette ne garde pas la
      // carte fermée, elle s'ouvre sans ses galeries.
      .then(async (c: CarteDeJoueur) => {
        await chargerDessinsAuPlus(sortesDe([c.legendaire, ...(c.profil?.legendaires ?? []), ...(c.profil?.divins ?? [])]))
        return c
      })
      .then(c => vivant && setCarte(c))
      .catch((e: Error) => vivant && setErreur(e.message))
    return () => {
      vivant = false
    }
  }, [slug, playerId, adresse])

  // Le clavier arrive dans la carte et y reste ; Échap la ferme, et le focus
  // revient à la ligne touchée.
  useModale(boite, onFermer)

  const p = carte?.profil
  // Chaque galerie ne se montre qu'avec ses dessins : sans eux (un échec,
  // qui vaut pour toute la page), ce serait une rangée de cercles vides.
  // Ils peuvent aussi arriver après l'ouverture : la carte l'ajoute alors.
  const dessins = useDessins()
  const avecDessins = { legendaires: complets(dessins, ['legendaire']), divins: complets(dessins, ['divin']) }
  // Son fond de carte, s'il en porte un : seulement l'un du catalogue.
  const fond = fondDeCarte(p?.fond)?.key
  return (
    <div className="dialog-backdrop" onClick={onFermer}>
      <div
        ref={boite}
        className={'card dialog carte-joueur' + (fond ? ` carte-fond fond-${fond}` : '')}
        role="dialog"
        aria-modal="true"
        aria-label={carte ? `Carte ${deNom(carte.nom)}` : 'Carte du joueur'}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {/* Le contenu défile dans son cadre, et le fond de la carte reste en
            place derrière lui : posé sur un cadre qui défile, il s'arrêtait
            à la hauteur de l'écran. */}
        <div className="carte-defile">
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
                  {/* Son titre, sous son prénom : le nom d'un haut fait qu'il a gagné. */}
                  {p?.titre && hautFait(p.titre) && <p className="titre-porte">{espacesFines(`« ${hautFait(p.titre)!.title} »`)}</p>}
                  {carte.laurier && (
                    <p className="carte-laurier">
                      <Laurier laurier decoratif /> Vainqueur du quiz du jour d’hier
                    </p>
                  )}
                  {/* Un surnom donné ce soir, pas la marque « (2) » d'un homonyme : « « Camille (2) » ce soir — Camille sur son profil » se lisait comme un surnom. */}
                  {p && p.prenom !== partsDuNomAffiche(carte.nom).prenom && (
                    <p className="muted small">
                      {espacesFines(`« ${carte.nom} »`)} ce soir — {p.prenom} sur son profil
                    </p>
                  )}
                  {/* Sa soirée — absente de sa propre carte, lue depuis sa page. */}
                  {carte.ceSoir && (
                    <p className="carte-soir">
                      {carte.ceSoir.rang > 0 ? (
                        <>
                          <b>{place(carte.ceSoir.rang)}</b> sur {carte.ceSoir.joueurs} · {pts(carte.ceSoir.points)}
                        </>
                      ) : (
                        'Pas encore de points ce soir'
                      )}
                    </p>
                  )}
                  {/* Les QCM et les estimations, chacun à sa façon : « 1/64
                      justes » comptait des estimations qui ne sont jamais justes. */}
                  {carte.ceSoir && carte.ceSoir.reponses > 0 && <p className="muted small">{reponsesParType(carte.ceSoir)}</p>}
                </div>
              </header>

              {p && (
                <>
                  {avecDessins.divins && (p.divins ?? []).length > 0 && (
                    <div className="carte-legendaires carte-divins" aria-label="Divins">
                      {p.divins.map(cle => (
                        <span key={cle} className="carte-legendaire" title={divin(cle)?.nom}>
                          <Dessin cle={cle} />
                        </span>
                      ))}
                    </div>
                  )}
                  {avecDessins.legendaires && p.legendaires.length > 0 && (
                    <div className="carte-legendaires" aria-label="Avatars légendaires">
                      {p.legendaires.map(cle => (
                        <span key={cle} className="carte-legendaire" title={legendaire(cle)?.nom}>
                          <Dessin cle={cle} />
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Ce qui le distingue, avec ce qu'il a fallu faire : un titre
                      seul (« Le Buzzer d'Or ») ne dit rien à qui ne l'a jamais
                      chassé. */}
                  {p.vitrine.length > 0 && (
                    <div>
                      <span className="label">Ses plus beaux hauts faits</span>
                      <ul className="carte-beaux">
                        {p.vitrine.map(b => (
                          <li key={b.key}>
                            <span className="hf-emoji" aria-hidden="true">
                              {b.emoji}
                            </span>
                            <span className="hf-corps">
                              <span className="hf-titre">
                                {b.title}
                                {b.fois > 1 && <span className="hf-fois">×{b.fois}</span>}
                              </span>
                              <span className="muted small">{ceQuIlAFallu(b.key)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Ce qu'il sait, catégorie par catégorie : ses trois écussons
                      les plus hauts. Rien tant qu'il n'en a aucun. */}
                  {p.ecussons && p.ecussons.length > 0 && (
                    <div className="ecussons" aria-label="Écussons de savoir">
                      {p.ecussons.map(e => (
                        <Ecusson key={e.categorie} categorie={e.categorie} palier={e.palier} />
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
                  {/* Ses prix : leur nombre, pas leur liste — ils tombent à
                      chaque soirée. Rien tant qu'il n'en a aucun. */}
                  {p.prix && p.prix.eus > 0 && (
                    <p className="carte-prix muted small">
                      <Icon name="award" />
                      Prix de soirée : {p.prix.eus} sur {p.prix.total}
                    </p>
                  )}
                  {/* Son quiz du jour, en une ligne : rien s'il n'y a jamais joué. */}
                  {p.jour && (
                    <p className="carte-prix muted small">
                      <Flamme />
                      Quiz du jour : {p.jour.joues} jour{p.jour.joues > 1 ? 's' : ''} joué{p.jour.joues > 1 ? 's' : ''}
                      {p.jour.victoires > 0 && ` · ${p.jour.victoires} victoire${p.jour.victoires > 1 ? 's' : ''}`}
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {/* Ses mots, dépliés au toucher : la carte, l'écran qu'on touche le
              plus en salle d'attente, n'en expliquait aucun. Seulement ceux
              qu'elle montre. */}
          {carte && motsDeLaCarte(carte, avecDessins, !!fond).length > 0 && (
            <Glossaire mots={motsDeLaCarte(carte, avecDessins, !!fond)} />
          )}
          <div className="row dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onFermer}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Les mots maison qu'une carte affiche vraiment, dans l'ordre où elle les montre. */
function motsDeLaCarte(carte: CarteDeJoueur, avecDessins: { legendaires: boolean; divins: boolean }, fond: boolean): Mot[] {
  const p = carte.profil
  const mots: Mot[] = []
  if (carte.laurier) mots.push('laurier')
  if (!p) return carte.ceSoir && carte.ceSoir.reponses > 0 ? [...mots, 'precision'] : mots
  mots.push('niveau')
  if (avecDessins.divins && (p.divins ?? []).length > 0) mots.push('divin')
  if (avecDessins.legendaires && p.legendaires.length > 0) mots.push('legendaire')
  mots.push('hautsFaits')
  if (p.ecussons && p.ecussons.length > 0) mots.push('ecusson')
  mots.push('precision', 'coupDOeil', 'reflexe')
  if (p.prix && p.prix.eus > 0) mots.push('prix')
  if (fond) mots.push('fond')
  return mots
}

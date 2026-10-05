import { useEffect, useRef, useState } from 'react'
import type { CarteDeJoueur } from '../../../shared/carte'
import type { BadgePorte } from '../../../shared/badges'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { ceQuIlAFallu } from '../../../shared/hautsfaits'
import { nomDuTitre } from '../../../shared/sentiers'
import { NOM_DU_LAURIER, duMois } from '../../../shared/jour'
import { deNom, espacesFines, formatNumber, place, reponsesParType, secondes, pts } from '../format'
import { Avatar, Dessin } from './Avatar'
import { chargerDessinsAuPlus, complets, sortesDesAvatars, useDessins } from './medaillons'
import { justesses, type Chiffre } from './Chiffres'
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
 *
 * Dans le cadre du tableau de bord, comme la fin de soirée : la barre du
 * haut ne défile pas, et la croix qui ferme y reste en vue. « Fermer », au
 * pied d'une carte bien remplie, ne se voyait qu'en défilant jusqu'au bout,
 * et la carte prenait tout l'écran (la remarque du propriétaire du
 * 3 octobre 2026).
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
      .then(r =>
        r.ok
          ? r.json()
          : Promise.reject(new Error(r.status === 404 && !adresse ? 'Ce joueur a quitté la soirée' : 'Carte indisponible')),
      )
      // Une carte à médaillons attend leurs dessins sous son « Chargement… » :
      // ouverte avant, elle montrerait des cercles vides qui se remplissent.
      // La lumière de sa finition aussi : elle s'allumerait après coup.
      // Deux secondes et demie au plus : une requête muette ne garde pas la
      // carte fermée, elle s'ouvre sans ses galeries.
      .then(async (c: CarteDeJoueur) => {
        const galeries = [...(c.profil?.legendaires ?? []), ...(c.profil?.divins ?? [])].map(legendaire => ({ legendaire }))
        await chargerDessinsAuPlus(sortesDesAvatars([c, ...galeries]))
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
        {/* Le balayage du tableau de bord, sous un fond de carte jamais : le
            fond porte déjà son décor dans les mêmes couches. */}
        {!fond && <span className="carte-balayage" aria-hidden="true" />}
        <header className="carte-joueur-barre">
          <span className="salon-hud-label">
            <span className="admin-pouls" aria-hidden="true" />
            Carte de joueur
          </span>
          <button type="button" className="carte-croix" aria-label="Fermer" title="Fermer" onClick={onFermer}>
            <Icon name="x" />
          </button>
        </header>
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
                  {/* Son titre, sous son prénom : le nom d'un haut fait qu'il a gagné, ou d'un sentier dont il est maître. */}
                  {nomDuTitre(p?.titre) && <p className="titre-porte">{espacesFines(`« ${nomDuTitre(p?.titre)} »`)}</p>}
                  {carte.laurier && (
                    <p className="carte-laurier">
                      <Laurier laurier={carte.laurier} decoratif />{' '}
                      {carte.laurier === 'argent' ? 'Vainqueur du défi de la semaine dernière' : 'Vainqueur du quiz du jour d’hier'}
                      {carte.laurier !== 'argent' && carte.laurier > 1 && ` · ${NOM_DU_LAURIER[carte.laurier].toLowerCase()}`}
                    </p>
                  )}
                  {/* Le champion du mois dernier, tout le mois : la salle le salue. */}
                  {carte.champion && (
                    <p className="carte-laurier carte-champion">
                      <Icon name="trophy" /> {`Champion ${duMois(carte.champion)} au quiz du jour`}
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
                  <Cadrans
                    cases={[
                      ['Soirées', formatNumber(p.fiche.soirees)],
                      ['Quiz gagnés', formatNumber(p.fiche.quizGagnes)],
                      ['Hauts faits', formatNumber(p.hautsFaits)],
                      ...justesses(p.fiche),
                      ['Réflexe', secondes(p.fiche.reflexeMoyenMs)],
                    ]}
                  />
                  {/* Ses prix : leur nombre, pas leur liste — ils tombent à
                      chaque soirée. Rien tant qu'il n'en a aucun. */}
                  {((p.prix && p.prix.eus > 0) || p.jour) && (
                    <div className="carte-pastilles">
                      {p.prix && p.prix.eus > 0 && (
                        <span className="carte-prix">
                          <Icon name="award" />
                          Prix {p.prix.eus}/{p.prix.total}
                        </span>
                      )}
                      {/* Son quiz du jour, en une pastille : rien s'il n'y a jamais joué. */}
                      {p.jour && (
                        <span className="carte-prix">
                          <Flamme />
                          Quiz du jour {p.jour.joues} j
                          {p.jour.victoires > 0 && ` · ${p.jour.victoires} victoire${p.jour.victoires > 1 ? 's' : ''}`}
                        </span>
                      )}
                    </div>
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
        </div>
      </div>
    </div>
  )
}

/**
 * Ses chiffres en cadrans, trois par rangée : le chiffre lumineux, son nom,
 * et sur combien il porte quand ça compte — « Précision 50 % », seul, se
 * lisait pareil sur deux QCM et sur deux cents.
 */
function Cadrans({ cases }: { cases: Chiffre[] }) {
  return (
    <dl className="admin-cadrans carte-cadrans">
      {cases.map(([titre, valeur, base]) => (
        <div key={titre} className="admin-cadran carte-cadran">
          <dt className="admin-cadran-nom">{titre}</dt>
          <dd className="admin-cadran-chiffre num">{valeur}</dd>
          {base && <dd className="carte-cadran-base">{base}</dd>}
        </div>
      ))}
    </dl>
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

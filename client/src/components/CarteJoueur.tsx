import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import type { CarteDeJoueur } from '../../../shared/carte'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { brancheDe, portrait as portraitDe } from '../../../shared/branches'
import { compagnonDe, formeDansLaNiche, formeDeCompagnon, nomDeLaForme, type CompagnonPossede } from '../../../shared/compagnons'
import { titreDeLAmitie } from '../../../shared/ornements'
import { laNiche } from './NicheHost'
import { NOM_FINITION } from '../../../shared/profil'
import { ceQuIlAFallu } from '../../../shared/hautsfaits'
import { nomDuTitre } from '../../../shared/sentiers'
import { NOM_DU_LAURIER, duMois } from '../../../shared/jour'
import { deNom, espacesFines, formatNumber, place, reponsesParType, secondes, pts } from '../format'
import { Avatar, Dessin } from './Avatar'
import { chargerDessinsAuPlus, complets, dessinDuPortrait, sortesDesAvatars, useDessins, type Sorte } from './medaillons'
import { justesses, type Chiffre } from './Chiffres'
import { Flamme, Icon } from './Icon'
import { Laurier } from './Laurier'
import { useModale } from '../modale'
import { partsDuNomAffiche } from '../../../shared/homonymes'
import { Ecusson } from './Ecusson'
import { Glossaire } from './Glossaire'
import type { Mot } from '../../../shared/glossaire'
import { fond as fondDeCarte } from '../../../shared/fonds'
import { ligueParCle, type CleDeLigue } from '../../../shared/duels'
import { BlasonDeLigue } from './Blason'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import type { GestesDeLaCarte } from './GestesDuJoueur'

/**
 * Les gestes d'une carte de profil — le défier, l'ajouter à ses amis
 * (`GestesDuJoueur`) —, chargés avec elle seulement : la carte d'une soirée
 * n'en a pas, et les téléphones de la salle ne les téléchargent jamais.
 */
const lesGestes = aLaDemande(() => import('./GestesDuJoueur'))

type Profil = NonNullable<CarteDeJoueur['profil']>

/**
 * La carte d'un joueur, ouverte en touchant son nom : une carte à
 * collectionner (le choix du propriétaire du 20 octobre 2026, sur la maquette
 * `retours/2026-10-20/carte-du-joueur/` : « J'adore la carte à collectionner
 * […] J'aime beaucoup retourner la carte »). Au recto, qui il est et ce qu'il
 * fait ce soir — son niveau en gemme, son nom et son titre, son avatar en
 * grand dans l'illustration, son compagnon perché au coin, sa soirée, ses
 * plus beaux hauts faits ; au dos, ses chiffres en un seul tableau, ses
 * écussons, sa collection tout au bout. Son fond de carte tapisse les deux
 * faces. Son cadre est celui de sa ligue des duels (`cadreDeLaCarte`), et suit
 * le doigt. Le compagnon y avait sa ligne, sous l'avatar : « ça fait tout
 * descendre ».
 *
 * Un invité anonyme a la sienne : sa soirée, sans dos ni rien qui dise ce qui
 * lui manque. Un surnom donné par l'animateur ne cache pas le prénom du profil.
 *
 * Jamais plus haute que les trois quarts de l'écran : elle s'ouvre sur la
 * salle, elle ne la cache pas. Sa croix et « Retourner la carte » sont sous
 * elle, sous le pouce, hors de ce qui défile (le choix du même jour : « en
 * bas ») : « Fermer », au pied d'une carte bien remplie, ne se voyait qu'en
 * défilant jusqu'au bout (la remarque du 3 octobre 2026) ; au coin haut
 * droit, la croix tombait sur la niche de la page.
 *
 * Son avatar se touche, et son compagnon : il s'ouvre en grand, à la place de
 * ce que la carte raconte (`AvatarEnGrand`, `CompagnonEnGrand`), et un
 * nouveau toucher — ou Échap — rend la carte.
 *
 * La loge l'ouvre aussi, sur ce qu'on y essaie (`retouche`) : « Aperçu de ta
 * carte » au-dessus d'elle, et « Porter » au pied (`pied`).
 */
export function CarteJoueur({
  slug,
  playerId,
  adresse,
  gestes,
  retouche,
  pied,
  onFermer,
}: {
  slug?: string
  playerId?: string
  /** D'où la lire, si ce n'est pas un invité de la soirée : sa propre carte, depuis sa page. */
  adresse?: string
  /** Un profil touché hors d'une soirée : ce qu'on peut en faire, au pied de la carte (`GestesDuJoueur`). */
  gestes?: GestesDeLaCarte
  /** Sa carte telle qu'il l'essaie, dans la loge (`carteAvecLEssai`) : un aperçu, rien de porté. */
  retouche?: (carte: CarteDeJoueur) => CarteDeJoueur
  /** Ce qui se pose au pied de la carte, hors de ce qui défile — l'aperçu de la loge y met « Porter ». */
  pied?: ReactNode
  onFermer: () => void
}) {
  const [carte, setCarte] = useState<CarteDeJoueur | null>(null)
  const [erreur, setErreur] = useState('')
  const boite = useRef<HTMLDivElement>(null)
  // L'essai ne bouge pas tant que la carte est ouverte — la loge, derrière, est inerte : il se lit une fois, à l'arrivée.
  const retoucher = useRef(retouche)
  retoucher.current = retouche
  const desGestes = useALaDemande(lesGestes, !!gestes)
  // L'avatar ou le compagnon en grand, et la hauteur du contenu qu'il
  // remplace : il la garde, et la carte ne rapetisse pas sous le doigt —
  // centrée dans l'écran, sa croix aurait sauté.
  const [loupe, setLoupe] = useState<{ hauteur: number; sujet: 'avatar' | 'compagnon' } | null>(null)
  const [verso, setVerso] = useState(false)
  const petitAvatar = useRef<HTMLButtonElement>(null)
  const petitCompagnon = useRef<HTMLButtonElement>(null)
  const pivot = useRef<HTMLDivElement>(null)
  const ouvrir = (sujet: 'avatar' | 'compagnon') => () => {
    const defile = boite.current?.querySelector<HTMLElement>('.carte-recto .carte-defile')
    const s = defile && getComputedStyle(defile)
    setLoupe({ sujet, hauteur: defile && s ? defile.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) : 0 })
  }
  const ouvrirLaLoupe = ouvrir('avatar')
  const ouvrirLeCompagnon = ouvrir('compagnon')
  // Refermée, le focus revient à ce qui l'avait ouverte — l'avatar, le
  // compagnon : le clavier et le lecteur d'écran reprennent la carte où l'œil
  // l'avait laissée.
  const etaitOuverte = useRef<'avatar' | 'compagnon' | null>(null)
  useEffect(() => {
    if (!loupe && etaitOuverte.current) (etaitOuverte.current === 'compagnon' ? petitCompagnon : petitAvatar).current?.focus({ preventScroll: true })
    etaitOuverte.current = loupe?.sujet ?? null
  }, [loupe])

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
      // La lumière de sa finition aussi : elle s'allumerait après coup — et
      // sa bordure de ligue, qui se poserait autour de lui sous les yeux.
      // Deux secondes et demie au plus : une requête muette ne garde pas la
      // carte fermée, elle s'ouvre sans ses galeries. Retouchée de l'essai,
      // avant : ce sont les dessins de l'avatar essayé qu'elle attend.
      .then(async (lue: CarteDeJoueur) => {
        const c = retoucher.current ? retoucher.current(lue) : lue
        // Le code de sa niche aussi, s'il a un compagnon : sans lui, elle se
        // poserait sur la carte déjà ouverte. Aussi peu de temps que ses dessins.
        await Promise.all([chargerDessinsAuPlus(dessinsDeLaCarte(c)), c.profil?.compagnon && auPlus(laNiche.charger())])
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
  // Son fond de carte, s'il en porte un : seulement l'un du catalogue. Il
  // tapisse ses deux faces, dans leur cadre de métal.
  const fond = fondDeCarte(p?.fond)?.key
  const ligue = carte ? cadreDeLaCarte(carte) : null
  const compagnon = p?.compagnon
  // Un dos, pour un profil : un invité anonyme n'a que sa soirée.
  const aUnDos = !!p && !loupe
  const mots = carte && !loupe ? motsDeLaCarte(carte, avecDessins, !!fond) : []
  const titre = nomDuTitre(p?.titre)

  // Le doigt l'incline et déplace son reflet : posé sur le style, sans rendre
  // la carte à chaque mouvement. Le mouvement réduit la laisse droite.
  const incliner = (e: PointerEvent<HTMLDivElement>) => {
    const el = pivot.current
    if (!el || sansMouvement()) return
    const r = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    el.style.setProperty('--rx', `${((0.5 - y) * INCLINAISON_MAX).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${((x - 0.5) * INCLINAISON_MAX * 1.2).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`)
  }
  const redresser = () => {
    for (const v of ['--rx', '--ry', '--gx', '--gy']) pivot.current?.style.removeProperty(v)
  }

  return (
    <div className="dialog-backdrop" onClick={onFermer}>
      <div
        ref={boite}
        className={'carte-joueur' + (ligue ? ` cadre-${ligue}` : '')}
        role="dialog"
        aria-modal="true"
        aria-label={carte ? `Carte ${deNom(carte.nom)}` : 'Carte du joueur'}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          // Échap rend la carte à l'avatar en grand, sans la fermer : arrêté
          // ici, il ne parvient pas jusqu'à la fenêtre modale, qui l'écoute
          // sur le document.
          if (loupe && e.key === 'Escape') {
            e.stopPropagation()
            setLoupe(null)
          }
        }}
      >
        {/* L'essai de la loge se dit au-dessus de la carte : rien n'y est encore porté. */}
        {retouche && (
          <p className="carte-apercu salon-hud-label">
            <span className="admin-pouls" aria-hidden="true" />
            Aperçu de ta carte
          </p>
        )}
        <div ref={pivot} className={'carte-pivot' + (verso && aUnDos ? ' carte-retournee' : '')} onPointerMove={incliner} onPointerLeave={redresser}>
          <section className="carte-face carte-recto" aria-hidden={(verso && aUnDos) || undefined} inert={verso && aUnDos}>
            {/* Son fond de carte tapisse le dedans de la face, qui ne bouge pas : le contenu défile par-dessus, dans son cadre. */}
            <div className={'carte-dedans' + (fond ? ` carte-fond fond-${fond}` : '')}>
              <div className="carte-defile">
                {erreur && <p className="muted">{erreur}</p>}
                {!carte && !erreur && <p className="muted">Chargement…</p>}
                {carte && loupe?.sujet === 'avatar' && <AvatarEnGrand carte={carte} hauteur={loupe.hauteur} onRevenir={() => setLoupe(null)} />}
                {carte && loupe?.sujet === 'compagnon' && compagnon && <CompagnonEnGrand compagnon={compagnon} hauteur={loupe.hauteur} onRevenir={() => setLoupe(null)} />}
                {carte && !loupe && (
                  <>
                    <header className="carte-tete">
                      {/* Son niveau en gemme, devant son nom, comme le coût d'une carte : le coin haut droit est à son compagnon. */}
                      {p && (
                        <span className="carte-gemme" title={`Niveau ${p.niveau}`}>
                          <span className="carte-gemme-mot" aria-hidden="true">
                            niv.
                          </span>
                          <span className="sr-only">niveau </span>
                          {p.niveau}
                        </span>
                      )}
                      <div className="carte-identite">
                        <h3>{carte.nom}</h3>
                        {/* Son titre, sous son prénom : le nom d'un haut fait qu'il a gagné, ou d'un sentier dont il est maître. */}
                        {titre && <p className="titre-porte">{espacesFines(`« ${titre} »`)}</p>}
                      </div>
                    </header>
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
                      <p className="carte-surnom muted small">
                        {espacesFines(`« ${carte.nom} »`)} ce soir — {p.prenom} sur son profil
                      </p>
                    )}
                    {/* L'illustration : son avatar en grand. En tête de l'ancienne
                        carte, on ne voyait ni la peinture d'un légendaire ni la
                        lumière d'une finition : touché, il s'ouvre encore plus
                        grand (la demande du 6 octobre 2026). */}
                    <div className="carte-illustration-cadre">
                      <div className="carte-illustration">
                        <button
                          ref={petitAvatar}
                          type="button"
                          className="carte-avatar-bouton"
                          aria-label={`Voir l’avatar ${deNom(carte.nom)} en grand`}
                          title="Voir en grand"
                          onClick={ouvrirLaLoupe}
                        >
                          <Avatar
                            className="carte-avatar"
                            avatar={carte.avatar}
                            finition={carte.finition}
                            eclat={carte.eclat}
                            legendaire={carte.legendaire}
                            bordure={carte.bordure}
                          />
                        </button>
                        {/* Le blason de sa ligue, comme le symbole d'une série : il dit d'où vient son cadre. */}
                        {p?.duels && (
                          <span className="carte-blason" title={ligueParCle(p.duels.ligue).nom}>
                            <BlasonDeLigue ligue={p.duels.ligue} taille={18} decoratif />
                          </span>
                        )}
                        {compagnon && <PlaqueDuCompagnon compagnon={compagnon} />}
                      </div>
                      {compagnon && <SonCompagnon compagnon={compagnon} bouton={petitCompagnon} onOuvrir={ouvrirLeCompagnon} />}
                    </div>
                    {/* Sa soirée — absente de sa propre carte, lue depuis sa page. */}
                    {carte.ceSoir && (
                      <p className="carte-soir">
                        <Icon name="star" />
                        <span>
                          {carte.ceSoir.rang > 0 ? (
                            <>
                              <b>{place(carte.ceSoir.rang)}</b> ce soir, sur {carte.ceSoir.joueurs} · {pts(carte.ceSoir.points)}
                            </>
                          ) : (
                            'Pas encore de points ce soir'
                          )}
                          {/* Les QCM et les estimations, chacun à sa façon : « 1/64
                              justes » comptait des estimations qui ne sont jamais justes. */}
                          {carte.ceSoir.reponses > 0 && <span className="carte-soir-detail">{reponsesParType(carte.ceSoir)}</span>}
                        </span>
                      </p>
                    )}
                    {/* Ce qui le distingue, comme les pouvoirs d'une carte, avec ce
                        qu'il a fallu faire : un titre seul (« Le Buzzer d'Or ») ne
                        dit rien à qui ne l'a jamais chassé. */}
                    {p && p.vitrine.length > 0 && (
                      <ul className="carte-beaux" aria-label="Ses plus beaux hauts faits">
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
                    )}
                    {/* Sans dos, ses mots se disent au recto. */}
                    {!p && mots.length > 0 && <Glossaire mots={mots} />}
                  </>
                )}
              </div>
            </div>
          </section>
          {carte && p && aUnDos && (
            <section className="carte-face carte-dos" aria-hidden={!verso || undefined} inert={!verso}>
              {/* Le dos aussi : « et le fond ne peut pas couvrir recto et verso ? » (le propriétaire, le 20 octobre 2026). */}
              <div className={'carte-dedans' + (fond ? ` carte-fond fond-${fond}` : '')}>
                <div className="carte-defile">
                  <header className="carte-dos-tete">
                    <h3>{carte.nom}</h3>
                    <span className="carte-dos-titre">Ses chiffres</span>
                  </header>
                  <Cadrans cases={cadransDuDos(p)} />
                  {/* Ce qu'il sait, catégorie par catégorie : ses trois écussons
                      les plus hauts. Rien tant qu'il n'en a aucun. */}
                  {p.ecussons && p.ecussons.length > 0 && (
                    <div className="carte-rangee">
                      <span className="label">Ses écussons</span>
                      <div className="ecussons" aria-label="Écussons de savoir">
                        {p.ecussons.map(e => (
                          <Ecusson key={e.categorie} categorie={e.categorie} palier={e.palier} />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Sa collection tout au bout (le propriétaire, le 20 octobre 2026 :
                      « comme ça la collection de légendaires est à la toute fin »). */}
                  {((avecDessins.divins && (p.divins ?? []).length > 0) || (avecDessins.legendaires && p.legendaires.length > 0)) && (
                    <div className="carte-rangee">
                      <span className="label">Sa collection</span>
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
                    </div>
                  )}
                  {/* Ses mots, dépliés au toucher : la carte, l'écran qu'on touche le
                      plus en salle d'attente, n'en expliquait aucun. Seulement ceux
                      qu'elle montre. */}
                  {mots.length > 0 && <Glossaire mots={mots} />}
                </div>
              </div>
            </section>
          )}
        </div>
        {/* Ses gestes sous elle, hors de ce qui défile : toujours en vue. */}
        <div className="carte-sous">
          {/* Un nom fixe, l'état par `aria-pressed` : « Revoir sa carte, activé » disait l'état deux fois. */}
          {aUnDos && (
            <button type="button" className="carte-retourner" aria-pressed={verso} onClick={() => setVerso(v => !v)}>
              <Icon name="rotate" />
              Retourner la carte
            </button>
          )}
          <button type="button" className="carte-croix" aria-label="Fermer" title="Fermer" onClick={onFermer}>
            <Icon name="x" />
          </button>
        </div>
        {/* Ses gestes au pied, hors de ce qui défile : « Défier » reste en vue
            sous une carte bien remplie. Montés dès l'ouverture — ils lisent
            ce qu'il faut pendant que la carte arrive —, cachés sous l'avatar
            en grand. */}
        {gestes && desGestes && desGestes !== 'perdu' && <desGestes.GestesDuJoueur gestes={gestes} visibles={!loupe} onFermer={onFermer} />}
        {/* Le pied de l'aperçu, comme celui des gestes : « Porter » reste en vue sous une carte bien remplie. */}
        {pied && !loupe && <footer className="carte-gestes">{pied}</footer>}
      </div>
    </div>
  )
}

/** Le temps qu'une carte attend ce qu'elle montre, comme ses dessins : une requête muette ne la garde pas fermée. */
const ATTENTE_MAX_MS = 2500

const auPlus = (attendu: Promise<unknown>): Promise<unknown> => Promise.race([attendu.catch(() => {}), new Promise(r => setTimeout(r, ATTENTE_MAX_MS))])

/** Son inclinaison la plus forte sous le doigt, en degrés : assez pour accrocher la lumière, pas pour qu'on lise mal. */
const INCLINAISON_MAX = 9

/** Le mouvement réduit : ni inclinaison, ni retournement animé (la feuille de style l'arrête). */
const sansMouvement = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Le cadre d'une carte : celui de sa ligue actuelle aux duels (le choix du
 * propriétaire du 20 octobre 2026 : « de la ligue actuelle »), ses métaux
 * ceux de sa bordure ; sans duel classé, ni un invité sans profil, celui de
 * la carte de tous — l'absence, pas l'infériorité.
 */
export function cadreDeLaCarte(carte: CarteDeJoueur): CleDeLigue | null {
  return carte.profil?.duels?.ligue ?? null
}

/** Ce que la carte dit de son compagnon : son nom, ou celui de sa forme ; ce qu'il est ; sa forme ; le titre de leur amitié. */
function leCompagnon(compagnon: CompagnonPossede) {
  const forme = formeDansLaNiche(compagnon)
  if (!forme) return null
  return {
    nom: compagnon.nom ?? forme.nom,
    sorte: compagnon.nom ? forme.nom : compagnonDe(forme).nom,
    etape: nomDeLaForme(forme),
    amitie: titreDeLAmitie(compagnon.paliers),
  }
}

/** Le code de la niche, que la carte attend déjà avant de s'ouvrir. Sans lui (un échec), rien plutôt qu'une arche vide. */
function useCodeDeLaNiche() {
  const code = useALaDemande(laNiche)
  return code && code !== 'perdu' ? code : null
}

/**
 * Le compagnon de sa niche (le propriétaire, le 19 octobre 2026 : « Le
 * compagnon sur la carte doit avoir son nom »), perché au coin de
 * l'illustration — en haut à droite, comme sur chaque page : sa niche en
 * petit, la forme qu'elle montre et ses ornements, qui débordent sur le cadre.
 * Son nom est sur sa plaque (`PlaqueDuCompagnon`) ; sa forme, en le touchant.
 */
function SonCompagnon({ compagnon, bouton, onOuvrir }: { compagnon: CompagnonPossede; bouton: RefObject<HTMLButtonElement | null>; onOuvrir: () => void }) {
  const code = useCodeDeLaNiche()
  const c = leCompagnon(compagnon)
  if (!c || !code) return null
  return (
    <button ref={bouton} type="button" className="carte-compagnon" onClick={onOuvrir} aria-label={`Voir ${c.nom} en grand`} title={`${c.nom} · ${c.sorte}`}>
      <code.NicheEnMiniature niche={compagnon} taille={54} />
    </button>
  )
}

/** Sa plaque, sous sa niche, sur l'illustration : son nom, et le titre de leur amitié quand sa niche a passé un palier. */
function PlaqueDuCompagnon({ compagnon }: { compagnon: CompagnonPossede }) {
  const code = useCodeDeLaNiche()
  const c = leCompagnon(compagnon)
  if (!c || !code) return null
  return (
    <span className="carte-plaque">
      {c.nom}
      {c.amitie && <span className="carte-compagnon-amitie">{c.amitie}</span>}
    </span>
  )
}

/**
 * Le compagnon touché, en grand, à la place de ce que la carte raconte —
 * comme l'avatar : sa niche et ses ornements, en grands fichiers, ce qu'il
 * est et sa forme, son nom, le titre de leur amitié.
 */
export function CompagnonEnGrand({ compagnon, hauteur, onRevenir }: { compagnon: CompagnonPossede; hauteur?: number; onRevenir: () => void }) {
  const code = useCodeDeLaNiche()
  const c = leCompagnon(compagnon)
  const bouton = useRef<HTMLButtonElement>(null)
  // Le focus sur le compagnon qu'on regarde : Entrée, comme le doigt, rend la carte.
  useEffect(() => {
    bouton.current?.focus({ preventScroll: true })
  }, [code])
  if (!c || !code) return null
  return (
    <div className="carte-loupe" style={hauteur ? { minHeight: hauteur } : undefined}>
      <button ref={bouton} type="button" className="carte-loupe-bouton" aria-label="Revenir à la carte" title="Revenir à la carte" onClick={onRevenir}>
        <code.NicheEnMiniature niche={compagnon} taille={124} grand />
      </button>
      <p className="carte-loupe-legende">
        <span className="detail-famille muted">{`${c.sorte} · ${c.etape}`}</span>
        <b className="carte-loupe-nom">{c.nom}</b>
        {c.amitie && <span className="carte-compagnon-amitie">{c.amitie}</span>}
      </p>
      <p className="muted small">Touche-le pour revenir à la carte.</p>
    </div>
  )
}

/** Au-delà, en pixels, le doigt glisse plutôt qu'il ne touche. */
const GLISSE = 10

/**
 * Ce clic finit-il un doigt qui a glissé ? Sur un légendaire en grand, il
 * faisait suivre au reflet sa course : il regardait, il ne refermait rien.
 * Un clic du clavier n'a pas de course (`detail` à 0).
 */
export function aGlisse(depart: { x: number; y: number } | null, fin: { clientX: number; clientY: number; detail: number }): boolean {
  return !!depart && fin.detail > 0 && Math.hypot(fin.clientX - depart.x, fin.clientY - depart.y) > GLISSE
}

/**
 * L'avatar touché sur la carte, en grand, à la place de ce qu'elle raconte :
 * ce que la salle voit, finition, lumière et Éclat compris, avec les grands
 * fichiers des dessins et le reflet d'un légendaire sous le doigt. Le
 * toucher encore rend la carte. `hauteur` : celle du contenu qu'il remplace,
 * qu'il garde au moins.
 */
export function AvatarEnGrand({ carte, hauteur, onRevenir }: { carte: CarteDeJoueur; hauteur?: number; onRevenir: () => void }) {
  const bouton = useRef<HTMLButtonElement>(null)
  const depart = useRef<{ x: number; y: number } | null>(null)
  // Le focus sur l'avatar qu'on regarde : Entrée, comme le doigt, rend la carte.
  useEffect(() => {
    bouton.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="carte-loupe" style={hauteur ? { minHeight: hauteur } : undefined}>
      <button
        ref={bouton}
        type="button"
        className="carte-loupe-bouton"
        aria-label="Revenir à la carte"
        title="Revenir à la carte"
        onPointerDown={e => {
          depart.current = { x: e.clientX, y: e.clientY }
        }}
        onClick={e => {
          const glisse = aGlisse(depart.current, e)
          depart.current = null
          if (!glisse) onRevenir()
        }}
      >
        <Avatar
          className="carte-loupe-avatar"
          avatar={carte.avatar}
          finition={carte.finition}
          eclat={carte.eclat}
          legendaire={carte.legendaire}
          bordure={carte.bordure}
          grand
        />
      </button>
      <LegendeDeLAvatar carte={carte} />
      <p className="muted small">Touche-le pour revenir à la carte.</p>
    </div>
  )
}

/**
 * Ce que l'avatar en grand montre, dit dessous : le nom d'un avatar dessiné
 * et sa famille, comme sa fiche les dit, puis sa finition et son Éclat. Un
 * Divin n'a ni l'une ni l'autre, et un invité anonyme rien du tout — ni
 * « Mat », ni « aucune » : l'absence, pas l'infériorité. Le nom d'un dessin
 * qui n'est pas venu ne dirait rien de l'emoji qui tient sa place.
 */
function LegendeDeLAvatar({ carte }: { carte: CarteDeJoueur }) {
  const dessins = useDessins()
  const cle = carte.legendaire
  const d = divin(cle)
  const l = legendaire(cle)
  const pr = portraitDe(cle)
  const cp = formeDeCompagnon(cle)
  const dessin = d
    ? dessins.Divin && { famille: 'Divin', classe: 'anneau-texte-divin', nom: d.nom }
    : l
      ? dessins.Legendaire && { famille: 'Légendaire', classe: 'anneau-texte-legendaire', nom: l.nom }
      : pr && dessinDuPortrait(dessins, pr.key)
        ? { famille: `${brancheDe(pr).nom} · ${brancheDe(pr).categorie}`, classe: 'muted', nom: pr.nom }
        : cp && dessins.Compagnon
          ? { famille: `${compagnonDe(cp).nom} · ${nomDeLaForme(cp)}`, classe: 'muted', nom: cp.nom }
          : null
  const finition = !d && carte.finition && carte.finition !== 'mat' ? `Finition ${NOM_FINITION[carte.finition]}` : null
  const parure = [finition, !d && carte.eclat && 'éclaté'].filter(Boolean).join(' · ')
  if (!dessin && !parure) return null
  return (
    <p className="carte-loupe-legende">
      {dessin && (
        <>
          <span className={`detail-famille ${dessin.classe}`}>{dessin.famille}</span>
          <b className="carte-loupe-nom">{dessin.nom}</b>
        </>
      )}
      {parure && <span className="muted small">{parure.charAt(0).toUpperCase() + parure.slice(1)}</span>}
    </p>
  )
}

/** Un cadran du dos : son nom, son chiffre et sur combien il porte ; l'icône de la pastille qu'il remplace, s'il en remplace une. */
export interface CadranDuDos {
  nom: string
  valeur: string
  base?: string
  icone?: 'prix' | 'jour' | 'duels' | 'campagne'
  /** Sa ligue, pour le blason des duels. */
  ligue?: CleDeLigue
}

/**
 * Le tableau du dos : ses cadrans (`cadransDeLaCarte`), puis ses prix, son
 * quiz du jour, ses duels et sa campagne, qui étaient des pastilles sous eux
 * (le propriétaire, le 20 octobre 2026 : « pas très jolies, limite plus dans
 * le tableau avec les précisions »). Chacun s'il a quelque chose à dire ; sa
 * campagne seulement quand ses cadrans sont ceux des soirées : sinon, ils la
 * tiennent déjà.
 */
export function cadransDuDos(p: Profil): CadranDuDos[] {
  const cases: CadranDuDos[] = cadransDeLaCarte(p).map(([nom, valeur, base]) => ({ nom, valeur, ...(base && { base }) }))
  if (p.prix && p.prix.eus > 0) cases.push({ nom: 'Prix', valeur: formatNumber(p.prix.eus), base: `sur ${formatNumber(p.prix.total)}`, icone: 'prix' })
  if (p.jour) {
    const v = p.jour.victoires
    cases.push({ nom: 'Quiz du jour', valeur: `${formatNumber(p.jour.joues)} j`, ...(v > 0 && { base: `${formatNumber(v)} victoire${v > 1 ? 's' : ''}` }), icone: 'jour' })
  }
  if (p.duels) cases.push({ nom: 'Duels', valeur: formatNumber(p.duels.cote), base: ligueParCle(p.duels.ligue).nom, icone: 'duels', ligue: p.duels.ligue })
  if (p.campagne && p.fiche.soirees > 0) cases.push({ nom: 'Campagne', valeur: formatNumber(p.campagne.record), base: 'record en série', icone: 'campagne' })
  return cases
}

/**
 * Ses chiffres en cadrans, trois par rangée : le chiffre lumineux, son nom,
 * et sur combien il porte quand ça compte — « Précision 50 % », seul, se
 * lisait pareil sur deux QCM et sur deux cents. Ce que disait une pastille
 * garde son icône, à côté de son chiffre.
 */
function Cadrans({ cases }: { cases: CadranDuDos[] }) {
  return (
    <dl className="admin-cadrans carte-cadrans">
      {cases.map(c => (
        <div key={c.nom} className="admin-cadran carte-cadran">
          <dt className="admin-cadran-nom">{c.nom}</dt>
          <dd className="admin-cadran-chiffre num">
            {c.icone === 'prix' && <Icon name="award" />}
            {c.icone === 'jour' && <Flamme />}
            {c.icone === 'duels' && c.ligue && <BlasonDeLigue ligue={c.ligue} taille={15} decoratif />}
            {c.icone === 'campagne' && <Icon name="target" />}
            {c.valeur}
          </dd>
          {c.base && <dd className="carte-cadran-base">{c.base}</dd>}
        </div>
      ))}
    </dl>
  )
}

/**
 * Les dessins qu'une carte attend avant de s'ouvrir : ceux de l'avatar qu'il
 * porte — son médaillon, la lumière de sa finition, sa bordure de ligue — et
 * ceux de ses galeries. Sans sa bordure, la carte s'ouvrait et la bordure
 * s'y posait ensuite, sous les yeux.
 */
export function dessinsDeLaCarte(c: CarteDeJoueur): Sorte[] {
  const galeries = [...(c.profil?.legendaires ?? []), ...(c.profil?.divins ?? [])].map(legendaire => ({ legendaire }))
  return sortesDesAvatars([c, ...galeries])
}

/**
 * Ses chiffres en cadrans : ceux des soirées qu'il a jouées — la justesse
 * aux QCM et aux estimations côte à côte, la plus longue série leur a cédé
 * sa case — ou, sans aucune soirée, ceux de son jeu solo. « Soirées 0 · Quiz
 * gagnés 0 · Coup d'œil — · Réflexe — » disaient à qui ne joue qu'en solo,
 * sur la carte qu'on ouvre depuis le classement du défi de la semaine, ce
 * qu'il n'avait jamais fait (l'experte du jeu solo, le 11 octobre 2026). Sa
 * précision compte déjà tous les modes de jeu.
 */
export function cadransDeLaCarte(p: Profil): Chiffre[] {
  const [precision, coupDOeil] = justesses(p.fiche)
  const hautsFaits: Chiffre = ['Hauts faits', formatNumber(p.hautsFaits)]
  if (p.fiche.soirees > 0) {
    return [['Soirées', formatNumber(p.fiche.soirees)], ['Quiz gagnés', formatNumber(p.fiche.quizGagnes)], hautsFaits, precision, coupDOeil, ['Réflexe', secondes(p.fiche.reflexeMoyenMs)]]
  }
  // Chacun s'il a quelque chose à dire : « Sentiers 0 » à qui ne joue que des séries, c'était encore un zéro.
  const c = p.campagne
  const solo: Chiffre[] = c
    ? [
        ...(c.record > 0 ? [['Record', formatNumber(c.record), 'en série'] satisfies Chiffre] : []),
        ...(c.paliers > 0 ? [['Sentiers', formatNumber(c.paliers), `palier${c.paliers > 1 ? 's' : ''} validé${c.paliers > 1 ? 's' : ''}`] satisfies Chiffre] : []),
        ...(c.justes > 0 ? [['Justes', formatNumber(c.justes), 'en campagne'] satisfies Chiffre] : []),
      ]
    : []
  return [hautsFaits, precision, ...solo]
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
  // Le coup d'œil et le réflexe : des mesures de soirée, sur les cadrans des soirées seulement (`cadransDeLaCarte`).
  mots.push('precision', ...(p.fiche.soirees > 0 ? (['coupDOeil', 'reflexe'] as const) : []))
  if (p.prix && p.prix.eus > 0) mots.push('prix')
  if (p.duels) mots.push('ligue')
  if (fond) mots.push('fond')
  return mots
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import {
  QCM_POUR_LE_RADAR,
  radarDuSavoir,
  sentiersDeLaCarte,
  type CarteDeJoueur,
  type RadarDuSavoir,
  type RayonDuRadar,
  type SentierDeLaCarte,
  type SentiersDeLaCarte,
} from '../../../shared/carte'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { BRANCHES, brancheDe, nomDansLaPhrase, portrait as portraitDe, type CleDeBranche } from '../../../shared/branches'
import { nomCourt, type Categorie } from '../../../shared/categories'
import { NOM_ECUSSON } from '../../../shared/ecussons'
import { LUEUR, lueur } from './Atlas'
import { EMBLEME } from './Ecusson'
import { compagnonDe, formeDansLaNiche, formeDeCompagnon, nomDeLaForme, type CompagnonPossede } from '../../../shared/compagnons'
import { titreDeLAmitie } from '../../../shared/ornements'
import { laNiche } from './NicheHost'
import { NOM_FINITION } from '../../../shared/profil'
import { ceQuIlAFallu } from '../../../shared/hautsfaits'
import { PALIERS_DU_SENTIER, nomDuTitre, titreDeMaitre } from '../../../shared/sentiers'
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
 * écussons, sa collection tout au bout. Son fond de carte tapisse chaque
 * face. Son cadre est celui de sa ligue des duels (`cadreDeLaCarte`), et suit
 * le doigt. Le compagnon y avait sa ligne, sous l'avatar : « ça fait tout
 * descendre ».
 *
 * Deux faces de plus, depuis le 31 octobre 2026 (« une carte radar […] que
 * l'on pourrait swipe pour avoir plus d'info. Aussi de voir les paliers de la
 * campagne / maître obtenu ») : son savoir en radar, catégorie par catégorie
 * — ses forces, et ce qui lui reste à conquérir, que tout le monde voit —,
 * puis ses sentiers. Chacune s'il a de quoi la remplir (`facesDeLaCarte`).
 * La carte se retourne de face en face : « Retourner la carte » montre la
 * suivante, le doigt qui glisse de côté la suivante ou la précédente, dans
 * son sens, et des gemmes serties au pied du cadre disent où l'on en est.
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
  const [tour, setTour] = useState<Tour>(TOUR_DE_DEPART)
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
  // tapisse chacune de ses faces, dans leur cadre de métal.
  const fond = fondDeCarte(p?.fond)?.key
  const ligue = carte ? cadreDeLaCarte(carte) : null
  const compagnon = p?.compagnon
  // Un dos, pour un profil : un invité anonyme n'a que sa soirée.
  const aUnDos = !!p && !loupe
  const mots = carte && !loupe ? motsDeLaCarte(carte, avecDessins, !!fond) : []
  const titre = nomDuTitre(p?.titre)
  // Son savoir et ses sentiers : deux faces de plus, chacune s'il a de quoi la remplir.
  const radar = useMemo(() => radarDuSavoir(p?.savoir, p?.moyennes), [p])
  const sentiers = useMemo(() => sentiersDeLaCarte(p?.sentiers), [p])
  const faces = facesDeLaCarte(aUnDos, radar, sentiers)
  const rang = tour.face < faces.length ? tour.face : 0
  const montree = faces[rang]
  const classeDe = (nom: Face) => `carte-face carte-${nom === 'chiffres' ? 'dos' : nom}` + { endroit: '', envers: ' carte-envers', rangee: ' carte-face-rangee' }[placeDeLaFace(nom, faces, tour)]
  const cachee = (nom: Face) => nom !== montree
  const gemmes = (nom: Face) => faces.length > 1 && <Gemmes faces={faces} nom={nom} />

  // Retourner la carte d'une face : `pas` dit laquelle — la suivante, la
  // précédente —, `sens` le demi-tour qu'elle fait pour y venir : celui du
  // doigt, ou, au bouton, toujours le même.
  const tourner = (pas: 1 | -1, sens: 1 | -1 = 1) => {
    if (faces.length > 1) setTour(t => tourDApres(t, faces.length, pas, sens))
  }

  // Le doigt qui glisse de côté la retourne, dans son sens : vers la gauche,
  // la face suivante ; vers la droite, la précédente. Tant qu'il glisse, elle
  // le suit un peu (`--glisse`, posé sur le style comme son inclinaison) —
  // assez pour qu'on la sente tourner, jamais au point de montrer une face
  // qu'elle n'a pas encore posée. Le doigt qui monte ou descend fait défiler
  // la face, et elle le laisse faire. La souris n'a que le bouton : un clic
  // glissé sur un texte le sélectionnerait.
  const glisse = useRef<{ id: number; x: number; y: number; tient: boolean } | null>(null)
  const glisseLe = useRef(0)
  const poser = (e: PointerEvent<HTMLDivElement>) => {
    glisse.current = faces.length > 1 && e.isPrimary && e.pointerType !== 'mouse' ? { id: e.pointerId, x: e.clientX, y: e.clientY, tient: false } : null
  }
  const suivre = (e: PointerEvent<HTMLDivElement>) => {
    incliner(e)
    const g = glisse.current
    const el = pivot.current
    if (!g || g.id !== e.pointerId || !el) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.tient) {
      if (Math.abs(dy) > GLISSE && Math.abs(dy) >= Math.abs(dx)) {
        glisse.current = null
        return
      }
      if (Math.abs(dx) <= GLISSE) return
      g.tient = true
      el.classList.add('carte-tenue')
    }
    if (!sansMouvement()) el.style.setProperty('--glisse', `${(Math.max(-1, Math.min(1, dx / el.offsetWidth)) * SUIT_LE_DOIGT).toFixed(2)}deg`)
  }
  const lacher = () => {
    pivot.current?.classList.remove('carte-tenue')
    pivot.current?.style.removeProperty('--glisse')
    const g = glisse.current
    glisse.current = null
    return g
  }
  const lever = (e: PointerEvent<HTMLDivElement>) => {
    const g = lacher()
    if (!g?.tient || g.id !== e.pointerId) return
    // Le clic qui suit un doigt qui a glissé ne touche rien : parti d'une
    // catégorie du radar, il la choisissait en plus de retourner la carte.
    glisseLe.current = Date.now()
    const dx = e.clientX - g.x
    if (Math.abs(dx) >= ASSEZ_POUR_TOURNER) tourner(dx < 0 ? 1 : -1, dx < 0 ? -1 : 1)
  }
  const apresUnGlisse = (e: MouseEvent<HTMLDivElement>) => {
    if (Date.now() - glisseLe.current > CLIC_APRES_UN_GLISSE_MS) return
    e.stopPropagation()
    e.preventDefault()
  }
  // Les flèches la retournent aussi, comme le doigt — hors d'un champ, où elles déplacent le curseur.
  const auClavier = (e: KeyboardEvent<HTMLDivElement>) => {
    if (loupe || faces.length < 2 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
    e.preventDefault()
    tourner(e.key === 'ArrowRight' ? 1 : -1, e.key === 'ArrowRight' ? 1 : -1)
  }

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
          auClavier(e)
        }}
      >
        {/* L'essai de la loge se dit au-dessus de la carte : rien n'y est encore porté. */}
        {retouche && (
          <p className="carte-apercu salon-hud-label">
            <span className="admin-pouls" aria-hidden="true" />
            Aperçu de ta carte
          </p>
        )}
        {/* Ses faces tiennent la même case ; elle tourne d'un demi-tour par face (`--tourne`), posé seulement quand elle a tourné. */}
        <div
          ref={pivot}
          className="carte-pivot"
          style={tour.demi ? ({ '--tourne': `${tour.demi * 180}deg` } as CSSProperties) : undefined}
          onPointerDown={poser}
          onPointerMove={suivre}
          onPointerUp={lever}
          onPointerCancel={lacher}
          onPointerLeave={redresser}
          onClickCapture={apresUnGlisse}
        >
          <section className={classeDe('recto')} aria-hidden={cachee('recto') || undefined} inert={cachee('recto')}>
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
            {gemmes('recto')}
          </section>
          {carte && p && aUnDos && (
            <section className={classeDe('chiffres')} aria-hidden={cachee('chiffres') || undefined} inert={cachee('chiffres')}>
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
              {gemmes('chiffres')}
            </section>
          )}
          {/* Son savoir, en radar : une face pour lui, dès qu'une catégorie a ses dix QCM. */}
          {carte && p && aUnDos && radar && (
            <section className={classeDe('savoir')} aria-hidden={cachee('savoir') || undefined} inert={cachee('savoir')}>
              <div className={'carte-dedans' + (fond ? ` carte-fond fond-${fond}` : '')}>
                <div className="carte-defile">
                  <header className="carte-dos-tete">
                    <h3>{carte.nom}</h3>
                    <span className="carte-dos-titre">Son savoir</span>
                  </header>
                  <SonSavoir radar={radar} sentiers={sentiers} />
                </div>
              </div>
              {gemmes('savoir')}
            </section>
          )}
          {/* Ses sentiers : ses paliers, ses portraits, ses maîtres — ceux qu'il a commencés. */}
          {carte && p && aUnDos && sentiers && (
            <section className={classeDe('sentiers')} aria-hidden={cachee('sentiers') || undefined} inert={cachee('sentiers')}>
              <div className={'carte-dedans' + (fond ? ` carte-fond fond-${fond}` : '')}>
                <div className="carte-defile">
                  <header className="carte-dos-tete">
                    <h3>{carte.nom}</h3>
                    <span className="carte-dos-titre">Ses sentiers</span>
                  </header>
                  {/* Ses portraits ne viennent qu'une fois la carte retournée : la salle qui ouvre une carte sans la tourner ne les télécharge pas. */}
                  <SesSentiers sentiers={sentiers} portraits={tour.faits > 0} />
                </div>
              </div>
              {gemmes('sentiers')}
            </section>
          )}
        </div>
        {/* Ses gestes sous elle, hors de ce qui défile : toujours en vue. */}
        <div className="carte-sous">
          {/* Un nom fixe : il montre la face suivante, et la face montrée se dit d'elle-même — à l'oreille, dans la ligne qui suit. */}
          {aUnDos && (
            <button type="button" className="carte-retourner" onClick={() => tourner(1)}>
              <Icon name="rotate" />
              Retourner la carte
            </button>
          )}
          <button type="button" className="carte-croix" aria-label="Fermer" title="Fermer" onClick={onFermer}>
            <Icon name="x" />
          </button>
          {/* La face où elle s'arrête, dite à qui ne la voit pas tourner — rien avant le premier retournement. */}
          <span className="sr-only" aria-live="polite">
            {tour.faits > 0 ? `${NOM_DE_LA_FACE[montree]}, face ${rang + 1} sur ${faces.length}` : ''}
          </span>
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

// ── Ses faces, et comment elle se retourne ──────────────────────────────────

/** Les faces d'une carte : le recto, ses chiffres (le dos d'avant), son savoir, ses sentiers. */
export type Face = 'recto' | 'chiffres' | 'savoir' | 'sentiers'

/** Comment chaque face se dit à qui ne la voit pas tourner. */
const NOM_DE_LA_FACE: Record<Face, string> = { recto: 'Sa carte', chiffres: 'Ses chiffres', savoir: 'Son savoir', sentiers: 'Ses sentiers' }

/**
 * Les faces de sa carte, dans l'ordre où elle se retourne : le recto, puis,
 * pour un profil, ses chiffres, son savoir et ses sentiers — chacune s'il a
 * de quoi la remplir : un radar vide ou douze sentiers à zéro diraient ce qui
 * lui manque, pas ce qu'il est. Un invité sans profil n'a que son recto.
 */
export function facesDeLaCarte(aUnDos: boolean, radar: RadarDuSavoir | null, sentiers: SentiersDeLaCarte | null): Face[] {
  if (!aUnDos) return ['recto']
  return ['recto', 'chiffres', ...(radar ? (['savoir'] as const) : []), ...(sentiers ? (['sentiers'] as const) : [])]
}

/**
 * Où en est la carte : la face montrée (son rang parmi `facesDeLaCarte`),
 * celle qu'elle vient de quitter, ses demi-tours — un par face, dans le sens
 * du doigt — et combien de fois on l'a retournée.
 */
export interface Tour {
  face: number
  depuis: number
  demi: number
  faits: number
}

export const TOUR_DE_DEPART: Tour = { face: 0, depuis: 0, demi: 0, faits: 0 }

/** Le tour d'après, sur `n` faces : la face `pas` plus loin — la suivante, la précédente, en boucle —, d'un demi-tour dans `sens`. */
export function tourDApres(t: Tour, n: number, pas: 1 | -1, sens: 1 | -1): Tour {
  const ici = t.face < n ? t.face : 0
  return { face: (ici + pas + n) % n, depuis: ici, demi: t.demi + sens, faits: t.faits + 1 }
}

/**
 * Où se tient une face. Une vraie carte n'en a que deux : la montrée se pose
 * du côté que ses demi-tours désignent — l'endroit, ou l'envers —, celle
 * qu'elle quitte de l'autre, le temps de tourner ; les autres sont rangées —
 * invisibles, mais à leur place : la carte garde la taille de sa plus grande
 * face, d'une face à l'autre.
 */
export function placeDeLaFace(nom: Face, faces: readonly Face[], tour: Tour): 'endroit' | 'envers' | 'rangee' {
  const k = faces.indexOf(nom)
  const montree = tour.face < faces.length ? tour.face : 0
  const cote = (demi: number) => (((demi % 2) + 2) % 2 === 0 ? 'endroit' : 'envers')
  if (k === montree) return cote(tour.demi)
  if (k >= 0 && k === tour.depuis) return cote(tour.demi + 1)
  return 'rangee'
}

/** Ce que la carte suit du doigt qui glisse, d'un bord à l'autre, en degrés : jamais le quart de tour qui montrerait son envers. */
const SUIT_LE_DOIGT = 40

/** Le doigt qui a glissé d'au moins autant, en pixels, la retourne ; moins, elle revient. */
const ASSEZ_POUR_TOURNER = 44

/** Le clic qui suit un doigt qui a glissé, dans ce délai, ne touche rien. */
const CLIC_APRES_UN_GLISSE_MS = 400

/**
 * Les gemmes serties au pied de son cadre, une par face, celle qu'on regarde
 * allumée : on sait qu'il y en a d'autres, et où l'on en est — sans une ligne
 * de plus dans la carte. Pour l'œil seulement : la face montrée se dit à
 * l'oreille sous la carte.
 */
function Gemmes({ faces, nom }: { faces: readonly Face[]; nom: Face }) {
  return (
    <span className="carte-gemmes" aria-hidden="true">
      {faces.map(f => (
        <i key={f} className={f === nom ? 'carte-gemme-allumee' : undefined} />
      ))}
    </span>
  )
}

// ── Son savoir : le radar ────────────────────────────────────────────────────

/**
 * Le dessin du radar, dans son repère (`RADAR_L` × `RADAR_H`) : le centre,
 * le rayon d'une catégorie juste à 100 %, celui de ses étiquettes. Écrit pour
 * la largeur d'une face au téléphone, 282 pixels : « Géographie » et
 * « Sciences » y tiennent sans toucher le bord, et la face entière en
 * 360 × 640 — à 252 de haut, ses forces passaient sous le bord ; à 240, la
 * ligne de la moyenne des joueurs les y repoussait.
 */
const RADAR_L = 300
const RADAR_H = 228
const RADAR_CX = 150
const RADAR_CY = 115
const RADAR_R = 82
const RADAR_ETIQUETTES = 103

/** Le point d'un rayon — le i-ième, depuis midi, dans le sens des aiguilles —, à cette part du plein. */
function point(i: number, part: number, rayon = RADAR_R): [number, number] {
  const a = (i * 2 * Math.PI) / 12
  return [RADAR_CX + rayon * part * Math.sin(a), RADAR_CY - rayon * part * Math.cos(a)]
}
const xy = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`

/** Un arc du cercle de ce rayon, autour du i-ième rayon, de `demi` degrés de chaque côté. */
function arc(i: number, rayon: number, demi: number): string {
  const [x1, y1] = [RADAR_CX + rayon * Math.sin(((i * 30 - demi) * Math.PI) / 180), RADAR_CY - rayon * Math.cos(((i * 30 - demi) * Math.PI) / 180)]
  const [x2, y2] = [RADAR_CX + rayon * Math.sin(((i * 30 + demi) * Math.PI) / 180), RADAR_CY - rayon * Math.cos(((i * 30 + demi) * Math.PI) / 180)]
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${rayon} ${rayon} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

/** Les trames du radar : quatre anneaux, à 25, 50, 75 et 100 %, et les douze axes. */
const ANNEAUX = [0.25, 0.5, 0.75, 1].map(part => Array.from({ length: 12 }, (_, i) => xy(point(i, part))).join(' '))
const AXES = Array.from({ length: 12 }, (_, i) => `M${RADAR_CX} ${RADAR_CY}L${xy(point(i, 1))}`).join('')

/**
 * Ce que le radar dessine de son savoir. Ses douze catégories connues, une
 * forme : le radar d'une fiche de joueur. Tant qu'il en manque, des pétales,
 * un par catégorie connue — relier deux rayons par-dessus un inconnu
 * dessinerait une part qu'il n'a pas —, et l'arc en pointillé de celles qui
 * restent à découvrir. La moyenne des joueurs, en pointillé à côté : une
 * forme quand chaque catégorie a la sienne, sinon un arc sur chaque rayon
 * qui l'a — même règle que la sienne.
 */
export function dessinDuRadar(radar: RadarDuSavoir): { forme: string | null; petales: string; aDecouvrir: string; moyenne: string | null; moyennes: string } {
  const toutes = radar.rayons.every(r => r.moyenne !== null)
  const moyenne = toutes ? radar.rayons.map((r, i) => xy(point(i, r.moyenne!))).join(' ') : null
  const moyennes = toutes ? '' : radar.rayons.map((r, i) => (r.moyenne === null ? '' : arc(i, Math.max(1, RADAR_R * r.moyenne), 13))).join('')
  const complet = radar.rayons.every(r => r.part !== null)
  if (complet) return { forme: radar.rayons.map((r, i) => xy(point(i, r.part!))).join(' '), petales: '', aDecouvrir: '', moyenne, moyennes }
  let petales = ''
  let aDecouvrir = ''
  radar.rayons.forEach((r, i) => {
    if (r.part === null) {
      aDecouvrir += arc(i, RADAR_R, 11)
      return
    }
    const rayon = Math.max(1, RADAR_R * r.part)
    petales += `M${RADAR_CX} ${RADAR_CY}L${arc(i, rayon, 13).slice(1)}Z`
  })
  return { forme: null, petales, aDecouvrir, moyenne, moyennes }
}

/** La part qu'une catégorie dit à l'oreille, et sous le radar. */
const ditLaPart = (r: RayonDuRadar) => (r.pourcent === null ? 'à découvrir' : `${r.pourcent} %`)

/**
 * Son savoir, en radar (le souhait du propriétaire du 31 octobre 2026 : « voir
 * les forces et faiblesses en fonction des catégories ») : un rayon par
 * catégorie, sa part de bonnes réponses vers le bord — tous modes de jeu
 * ensemble, comme ses écussons, dont la couleur pointe au bout de chaque
 * rayon. Une catégorie touchée se dit dessous — sa part et sur combien de QCM,
 * son écusson, son sentier —, puis ses forces et ce qui lui reste à
 * conquérir, que tout le monde voit (le choix du même jour).
 */
export function SonSavoir({ radar, sentiers }: { radar: RadarDuSavoir; sentiers: SentiersDeLaCarte | null }) {
  const [choisie, setChoisie] = useState<Categorie>(radar.forces[0])
  const dessin = useMemo(() => dessinDuRadar(radar), [radar])
  const r = radar.rayons.find(x => x.categorie === choisie) ?? radar.rayons[0]
  const i = radar.rayons.indexOf(r)
  const parCategorie = (c: Categorie) => radar.rayons.find(x => x.categorie === c)!
  const puce = (c: Categorie) => {
    const x = parCategorie(c)
    return (
      <button key={c} type="button" className="carte-radar-puce" aria-pressed={c === choisie} onClick={() => setChoisie(c)}>
        <i className={`carte-radar-pierre palier-${x.ecusson}`} aria-hidden="true" />
        {nomCourt(c)}
        <b className="num">{ditLaPart(x)}</b>
      </button>
    )
  }
  return (
    <>
      <div className="carte-radar">
        <svg className="carte-radar-trame" viewBox={`0 0 ${RADAR_L} ${RADAR_H}`} aria-hidden="true">
          {dessin.forme ? (
            ANNEAUX.map((points, k) => <polygon key={k} className={k === 3 ? 'carte-radar-bord' : 'carte-radar-anneau'} points={points} />)
          ) : (
            [0.25, 0.5, 0.75, 1].map((part, k) => <circle key={k} className={k === 3 ? 'carte-radar-bord' : 'carte-radar-anneau'} cx={RADAR_CX} cy={RADAR_CY} r={RADAR_R * part} />)
          )}
          <path className="carte-radar-axes" d={AXES} />
          <path className="carte-radar-axe-choisi" d={`M${RADAR_CX} ${RADAR_CY}L${xy(point(i, 1))}`} />
          {dessin.forme ? <polygon className="carte-radar-forme" points={dessin.forme} /> : <path className="carte-radar-forme" d={dessin.petales} />}
          {dessin.aDecouvrir && <path className="carte-radar-a-decouvrir" d={dessin.aDecouvrir} />}
          {/* La moyenne des joueurs, par-dessus sa forme : on voit d'un coup où il passe au-dessus, où en dessous. */}
          {dessin.moyenne ? <polygon className="carte-radar-moyenne" points={dessin.moyenne} /> : dessin.moyennes && <path className="carte-radar-moyenne" d={dessin.moyennes} />}
          {radar.rayons.map((x, k) => {
            if (x.part === null) return null
            const [cx, cy] = point(k, x.part)
            return <circle key={x.categorie} className={`carte-radar-pierre palier-${x.ecusson}` + (k === i ? ' carte-radar-pierre-choisie' : '')} cx={cx} cy={cy} r={k === i ? 5.5 : 4} />
          })}
        </svg>
        {radar.rayons.map((x, k) => {
          const [ex, ey] = point(k, 1, RADAR_ETIQUETTES)
          return (
            <button
              key={x.categorie}
              type="button"
              className={'carte-radar-etiquette' + (x.part === null ? ' carte-radar-inconnue' : '')}
              style={{ left: `${((ex / RADAR_L) * 100).toFixed(2)}%`, top: `${((ey / RADAR_H) * 100).toFixed(2)}%` }}
              aria-pressed={x.categorie === choisie}
              aria-label={`${x.categorie}, ${ditLaPart(x)}`}
              onClick={() => setChoisie(x.categorie)}
            >
              {nomCourt(x.categorie)}
            </button>
          )
        })}
        {/* Sa légende, dans le coin que le radar laisse libre ; la catégorie touchée la dit en toutes lettres. */}
        {(dessin.moyenne || dessin.moyennes) && (
          <span className="carte-radar-legende" aria-hidden="true">
            <i className="carte-radar-trait" />
            les joueurs
          </span>
        )}
      </div>
      <CategorieTouchee rayon={r} sentiers={sentiers} />
      <div className="carte-radar-rangees">
        <div className="carte-radar-rangee">
          <span className="label">{radar.forces.length > 1 ? 'Ses forces' : 'Sa force'}</span>
          {radar.forces.map(puce)}
        </div>
        {radar.aConquerir.length > 0 && (
          <div className="carte-radar-rangee">
            <span className="label">À conquérir</span>
            {radar.aConquerir.map(puce)}
          </div>
        )}
        {radar.connus < radar.rayons.length && <p className="carte-radar-note">{`Une catégorie paraît dès ${QCM_POUR_LE_RADAR} QCM.`}</p>}
      </div>
    </>
  )
}

/**
 * La catégorie touchée sur le radar : sa part en grand et sur combien de QCM
 * (« 50 % (1 sur 2 QCM) » : une part dit toujours sur combien), son écusson,
 * sa jauge à la lueur de sa branche, et où il en est de son sentier — le
 * pont vers la face suivante.
 */
function CategorieTouchee({ rayon: r, sentiers }: { rayon: RayonDuRadar; sentiers: SentiersDeLaCarte | null }) {
  const s = sentiers?.sentiers.find(x => x.branche.categorie === r.categorie)
  const cle = BRANCHE_DE_LA_CATEGORIE.get(r.categorie)
  return (
    <div className="carte-radar-detail">
      <div className="carte-radar-part">
        <span className="carte-radar-pourcent num">
          {r.pourcent === null ? formatNumber(r.questions) : r.pourcent}
          <small>{r.pourcent === null ? ' QCM' : ' %'}</small>
        </span>
        {r.pourcent !== null && <span className="carte-radar-sur">{`${formatNumber(r.justes)} sur ${formatNumber(r.questions)} QCM`}</span>}
      </div>
      <div className="carte-radar-corps">
        <b className="carte-radar-nom">{r.categorie}</b>
        {r.pourcent === null ? (
          <span className="carte-radar-ligne">{`Elle paraît au radar dès ${QCM_POUR_LE_RADAR} QCM.`}</span>
        ) : (
          // Sa jauge à la lueur de sa branche — celle de la campagne —, son écusson au bout.
          <span className="carte-radar-mesure" style={cle ? lueur(LUEUR[cle]) : undefined}>
            <span className="carte-radar-jauge" aria-hidden="true">
              <span style={{ width: `${r.pourcent}%` }} />
              {r.moyennePourcent !== null && <i className="carte-radar-repere" style={{ left: `${r.moyennePourcent}%` }} />}
            </span>
            {r.ecusson > 0 && (
              <span className={`carte-radar-ecusson palier-${r.ecusson}`}>
                <Icon name="shield" />
                {NOM_ECUSSON[r.ecusson]}
              </span>
            )}
          </span>
        )}
        {r.moyennePourcent !== null && <FaceAuxJoueurs sienne={r.pourcent} moyenne={r.moyennePourcent} />}
        {s && (
          <span className="carte-radar-ligne carte-radar-sentier">
            <Icon name={s.maitre ? 'crown' : 'mountain'} />
            {s.maitre ? titreDeMaitre(s.branche) : `${s.branche.nom} · palier ${s.paliers} sur ${PALIERS_DU_SENTIER}`}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Sa part face à celle des joueurs (« Ajoute aussi la comparaison avec la
 * moyenne des joueurs », le propriétaire, le 31 octobre 2026) : la moyenne,
 * au trait du radar, et l'écart en points — « +23 », « −8 » —, dit en toutes
 * lettres à l'oreille. Sans part à lui, la moyenne seule.
 */
function FaceAuxJoueurs({ sienne, moyenne }: { sienne: number | null; moyenne: number }) {
  const ecart = sienne === null ? null : sienne - moyenne
  return (
    <span className="carte-radar-ligne carte-radar-comparaison">
      <i className="carte-radar-trait" aria-hidden="true" />
      {`Les joueurs : ${moyenne} %`}
      {ecart !== null && (
        <>
          <b className="num" aria-hidden="true">
            {ecart > 0 ? `+${ecart}` : ecart < 0 ? `−${-ecart}` : '='}
          </b>
          <span className="sr-only">{ecart > 0 ? `, ${ecart} points au-dessus` : ecart < 0 ? `, ${-ecart} points en dessous` : ', autant'}</span>
        </>
      )}
    </span>
  )
}

/** La branche de chaque catégorie, pour sa lueur. */
const BRANCHE_DE_LA_CATEGORIE = new Map<string, CleDeBranche>(BRANCHES.map(b => [b.categorie, b.key]))

// ── Ses sentiers ────────────────────────────────────────────────────────────

/** Les douze crans de l'anneau d'un sentier, un par palier, depuis midi dans le sens des aiguilles — un jour entre deux. */
const CRANS_DU_SENTIER = Array.from({ length: PALIERS_DU_SENTIER }, (_, k) => {
  const [r, pas, jour] = [28, 360 / PALIERS_DU_SENTIER, 4]
  const a = ((k * pas + jour) * Math.PI) / 180
  const b = (((k + 1) * pas - jour) * Math.PI) / 180
  return `M${(32 + r * Math.sin(a)).toFixed(2)} ${(32 - r * Math.cos(a)).toFixed(2)}A${r} ${r} 0 0 1 ${(32 + r * Math.sin(b)).toFixed(2)} ${(32 - r * Math.cos(b)).toFixed(2)}`
})

/** « Tour du monde », « Forêt » : le nom d'un sentier sous son anneau, là où l'article ne tient pas. */
const sansArticle = (nom: string) => {
  const sans = nom.replace(/^(Le |La |Les |L’)/, '')
  return sans.charAt(0).toUpperCase() + sans.slice(1)
}

/** Le sentier qu'elle montre d'abord : un maître, sinon le plus avancé. */
function lePlusAvance(s: SentiersDeLaCarte): SentierDeLaCarte {
  return [...s.sentiers].sort((a, b) => Number(b.maitre) - Number(a.maitre) || b.paliers - a.paliers)[0]
}

/** Les cadrans de ses sentiers : ses paliers et ses avatars du savoir sur combien, ses maîtres s'il en a. */
export function cadransDesSentiers(s: SentiersDeLaCarte): CadranDuDos[] {
  return [
    { nom: 'Paliers', valeur: formatNumber(s.paliers), base: `sur ${formatNumber(BRANCHES.length * PALIERS_DU_SENTIER)}` },
    { nom: 'Avatars', valeur: formatNumber(s.portraits), base: `sur ${formatNumber(BRANCHES.reduce((n, b) => n + b.portraits.length, 0))}` },
    ...(s.maitres > 0 ? [{ nom: s.maitres > 1 ? 'Maîtres' : 'Maître', valeur: formatNumber(s.maitres), base: `sur ${BRANCHES.length}`, icone: 'maitres' as const }] : []),
  ]
}

/** Ce que dit le sentier touché : son nom — ou son titre de maître —, sa catégorie, où il en est, et le prochain avatar. */
function ditLeSentier(s: SentierDeLaCarte): ReactNode {
  const ou = s.maitre
    ? 'les douze paliers, et celui du maître'
    : s.paliers >= PALIERS_DU_SENTIER
      ? 'les douze paliers ; reste celui du maître'
      : `palier ${s.paliers} sur ${PALIERS_DU_SENTIER}${s.prochain ? ` — ${nomDansLaPhrase(s.prochain.nom)} au palier ${s.prochain.palier}` : ''}`
  return (
    <>
      <b>{s.maitre ? titreDeMaitre(s.branche) : s.branche.nom}</b>
      {` · ${s.branche.categorie} : ${ou}.`}
    </>
  )
}

/**
 * Ses sentiers du savoir (« voir les paliers de la campagne / maître
 * obtenu », le 31 octobre 2026) : ceux qu'il a commencés, chacun un anneau
 * de douze crans à la lueur de sa branche — celle de la campagne — autour du
 * dernier avatar qu'il y a gagné ; un maître a l'anneau d'or et sa couronne.
 * Touché, un sentier se dit dessous. Ses avatars ne se dessinent que la carte
 * retournée (`portraits`) : la salle qui ouvre sa carte sans la tourner ne
 * télécharge pas douze branches.
 */
export function SesSentiers({ sentiers, portraits }: { sentiers: SentiersDeLaCarte; portraits: boolean }) {
  const [choisi, setChoisi] = useState<CleDeBranche>(() => lePlusAvance(sentiers).branche.key)
  const s = sentiers.sentiers.find(x => x.branche.key === choisi) ?? sentiers.sentiers[0]
  return (
    <>
      <Cadrans cases={cadransDesSentiers(sentiers)} />
      <ul className="carte-sentiers-grille" aria-label="Ses sentiers du savoir">
        {sentiers.sentiers.map(x => (
          <li key={x.branche.key}>
            <button
              type="button"
              className={'carte-sentier' + (x.maitre ? ' carte-sentier-maitre' : '')}
              style={lueur(LUEUR[x.branche.key])}
              aria-pressed={x === s}
              aria-label={`${x.branche.nom}, ${x.branche.categorie} : ${x.maitre ? 'maître' : `palier ${x.paliers} sur ${PALIERS_DU_SENTIER}`}`}
              onClick={() => setChoisi(x.branche.key)}
            >
              <span className="carte-sentier-anneau" aria-hidden="true">
                <svg viewBox="0 0 64 64">
                  <path className="carte-sentier-cran" d={CRANS_DU_SENTIER.slice(x.paliers).join('')} />
                  <path className="carte-sentier-cran carte-sentier-valide" d={CRANS_DU_SENTIER.slice(0, x.paliers).join('')} />
                </svg>
                <span className="carte-sentier-disque">
                  {portraits && x.portrait ? (
                    <span className="sentier-portrait">
                      <Dessin cle={x.portrait.key} />
                    </span>
                  ) : (
                    <Icon name={EMBLEME[x.branche.categorie] ?? 'star'} />
                  )}
                </span>
                <span className="carte-sentier-palier num">{x.maitre ? <Icon name="crown" /> : `${x.paliers}/${PALIERS_DU_SENTIER}`}</span>
              </span>
              <span className="carte-sentier-nom">{sansArticle(x.branche.nom)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="carte-sentier-detail" style={lueur(LUEUR[s.branche.key])}>
        {ditLeSentier(s)}
      </p>
    </>
  )
}

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
  icone?: 'prix' | 'jour' | 'duels' | 'campagne' | 'maitres'
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
            {c.icone === 'maitres' && <Icon name="crown" />}
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

import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { Icon, type IconName } from './Icon'
import { XpMince } from './Identite'
import { ongletVise } from './Onglets'
import { espacesFines } from '../format'
import { cibleEclat } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { NOM_FINITION, eclatChez, sceauVisible, type PublicProfileDetail } from '../../../shared/profil'
import { nomDuTitre } from '../../../shared/sentiers'
import { bordurePortee } from '../../../shared/duels'
import { PIECES_DE_LA_LOGE, type PieceDeLaLoge } from '../../../shared/piecesDeLaLoge'
import { laTenuePortee } from '../../../shared/tenues'

// La tête de la loge — sa carte et la rangée des six pièces —, à part de
// ses panneaux : la page du profil la montre dès qu'elle a le profil, et la
// loge entière la reprend quand ses panneaux arrivent, au même endroit. La
// loge vit sur la page du profil (le souhait du propriétaire du 12 octobre
// 2026 : « la page me changer directement dans le profil ») ; attendre ses
// panneaux pour montrer la carte retardait la page de 0,3 s en 4G.

/** L'icône de chaque pièce, sur sa rangée : celles de leurs pages d'avant. */
const ICONES: Record<PieceDeLaLoge, IconName> = { avatar: 'sparkles', titre: 'star', vitrine: 'award', fond: 'image', theme: 'palette', gerbe: 'zap' }

/**
 * Ses tenues, sur la carte (le 26 novembre 2026, la maquette
 * `retours/2026-11-26/la-piece-avatar/` : « Je valide », le propriétaire) :
 * les tenues sont des cartes. Derrière la sienne, la tranche des autres ; à
 * son coin, là où « Version rare » se touchait avant d'avoir son calque, un
 * cintre et un point par tenue — la montrée s'allonge en or, la portée garde
 * son anneau —, qui ouvre la liste. Le doigt qui glisse la carte montre la
 * suivante, à l'essai : à gauche la suivante, à droite la précédente, comme la
 * carte d'un joueur. Un tiroir à droite les avait précédées sur la maquette :
 * il cachait la moitié de la carte qu'on essaie, et le bord de l'écran est au
 * « Retour » d'Android.
 */
export interface PaquetDeTenues {
  /** Le nom de chaque tenue, dans l'ordre : un point chacune. */
  noms: readonly string[]
  /** Celle qu'il porte (-1 : aucune des siennes). */
  portee: number
  /** Celle que la carte montre (-1 : aucune — un calque est à l'essai). */
  montree: number
  /** Le cintre : la liste de ses tenues. */
  onCintre?: () => void
  /** Le doigt a glissé la carte : la tenue suivante (1) ou la précédente (-1). */
  onGlisser?: (pas: 1 | -1) => void
}

/** Au-delà, en pixels, le doigt glisse plutôt qu'il ne touche — et assez pour changer de tenue. */
const GLISSE = 10
const ASSEZ_POUR_CHANGER = 48
/** Ce que la carte suit du doigt qui glisse, en pixels de côté : la tranche de son paquet reste dans la marge de la page. */
const SUIT_LE_DOIGT = 12
/** Le clic qui suit un doigt qui a glissé ne touche rien : la carte se serait ouverte en grand. */
const CLIC_APRES_UN_GLISSE_MS = 400

/**
 * Sa carte, en tête de la loge, telle que la salle la verrait s'il portait
 * l'essai : son fond, son avatar et sa finition, son prénom, son titre, sa
 * vitrine — et, dessous, ce qui lui manque pour le niveau suivant et ses
 * confettis. « Aperçu » dit que rien n'est encore porté — le nom de la tenue
 * montrée, quand c'en est une. Collée en haut pendant qu'on choisit : c'est
 * elle qui change.
 *
 * Touchée ailleurs, elle s'ouvre en grand (`onOuvrir`) : sa carte entière,
 * telle que la salle la verra — le retour d'un joueur du 14 octobre 2026,
 * qui la touchait pour la voir. Un bouton tendu sur toute la carte, après
 * elle : posé autour, il aurait enfermé « Version rare », et le lecteur
 * d'écran lit la carte avant son geste.
 */
export function CarteDeLaLoge({
  vu,
  vitrine,
  apercu = false,
  essaye = {},
  paquet = null,
  tenueMontree = null,
  onOuvrir,
}: {
  /** Le profil tel que la carte le montre : ce qu'il porte, l'essai par-dessus (`avecLEssai`). */
  vu: PublicProfileDetail
  /** Les hauts faits de sa vitrine ; null tant que ses règles ne sont pas arrivées — la place est gardée. */
  vitrine: readonly { key: string; emoji: string; title: string }[] | null
  /** Quelque chose de ce que la salle voit est à l'essai. */
  apercu?: boolean
  /** Ce qui est à l'essai, cerclé de pointillés. */
  essaye?: { avatar?: boolean; titre?: boolean; vitrine?: boolean }
  /** Ses tenues : la tranche des autres derrière la carte, le cintre et ses points à son coin. */
  paquet?: PaquetDeTenues | null
  /** Le nom de la tenue gardée que la carte montre à l'essai, à la place d'« Aperçu ». */
  tenueMontree?: string | null
  /** Sa carte entière, en grand. */
  onOuvrir?: () => void
}) {
  const titre = nomDuTitre(vu.titre)
  const autres = paquet ? paquet.noms.length - (paquet.montree >= 0 ? 1 : 0) : 0
  // Sous un Divin, sa propre lumière ne se dit pas « Mat » : seule une finition qu'il a épinglée se nomme (`finitionSur`).
  const finition = divin(vu.legendaire) && vu.finition === 'mat' ? null : NOM_FINITION[vu.finition]
  return (
    <div className={'loge-collante' + (autres > 0 ? ' loge-paquet' : '')}>
      <CarteQuiGlisse className={'loge-carte' + (vu.fond ? ` carte-fond fond-${vu.fond}` : '') + (apercu ? ' loge-en-apercu' : '')} onGlisser={paquet?.onGlisser}>
        <div className="loge-carte-haut">
          <span className={'loge-carte-avatar' + (essaye.avatar ? ' loge-essaye' : '')}>
            <Avatar
              className="player-avatar big"
              avatar={vu.avatar}
              finition={vu.finition}
              eclat={eclatChez(vu, cibleEclat(vu.legendaire ?? undefined, vu.avatar))}
              legendaire={vu.legendaire ?? undefined} sceau={sceauVisible(vu)}
              bordure={bordurePortee(vu.bordureChoisie ?? 'auto', vu.bordures, vu.motifChoisi)}
            />
          </span>
          <span className="loge-carte-texte">
            <span className="identite-nom">
              {vu.name}
              <Laurier laurier={vu.laurier} />
              <Niveau niveau={vu.niveau} />
            </span>
            <span className={'loge-carte-titre' + (titre ? '' : ' loge-sans') + (essaye.titre ? ' loge-essaye' : '')}>
              {titre ? espacesFines(`« ${titre} »`) : 'Sans titre'}
            </span>
            {vitrine ? (
              <span
                className={'loge-carte-vitrine' + (essaye.vitrine ? ' loge-essaye' : '')}
                aria-label={vitrine.length > 0 ? `Vitrine : ${vitrine.map(b => b.title).join(', ')}` : 'Vitrine vide'}
              >
                {vitrine.map(b => (
                  <span key={b.key} className="loge-vitrine-case" aria-hidden="true">
                    {b.emoji}
                  </span>
                ))}
              </span>
            ) : (
              <span className="loge-carte-vitrine" />
            )}
          </span>
          {apercu && tenueMontree ? (
            <span className="loge-apercu loge-apercu-tenue">
              <Icon name="hanger" />
              {tenueMontree}
            </span>
          ) : apercu ? (
            <span className="loge-apercu">Aperçu</span>
          ) : (
            finition && <span className="loge-finition">{finition}</span>
          )}
          {paquet && (
            // Un seul bouton, la liste : les points disent où l'on est, le doigt glisse la carte. Chacun un bouton, ils
            // auraient fait des cibles de 13 px ; la liste les a, chacune sa rangée.
            <button
              type="button"
              className="loge-tenues"
              aria-haspopup="dialog"
              aria-label={paquet.noms.length > 0 ? `Mes tenues, ${paquet.noms.length} gardée${paquet.noms.length > 1 ? 's' : ''}` : 'Mes tenues'}
              onClick={paquet.onCintre}
            >
              {/* La pilule se voit sur 30 px ; le bouton se touche sur 44, sans grandir. */}
              <span className="loge-tenues-pilule" aria-hidden="true">
                <Icon name="hanger" />
                {paquet.noms.map((nom, i) => (
                  <i key={i} className={'loge-point' + (i === paquet.montree ? ' montree' : '') + (i === paquet.portee ? ' portee' : '')} />
                ))}
              </span>
            </button>
          )}
        </div>
        {/* Ce qui lui manque pour le niveau suivant, et ses confettis, sur
            toute la largeur : le vestiaire les disait, et la page du profil
            ne les dit plus ailleurs. */}
        <XpMince profil={vu} />
        {onOuvrir && (
          <button type="button" className="loge-carte-ouvrir" title="Voir en grand" onClick={onOuvrir}>
            <span className="sr-only">{apercu ? 'Voir l’aperçu de ma carte en grand' : 'Voir ma carte en grand'}</span>
          </button>
        )}
      </CarteQuiGlisse>
    </div>
  )
}

/**
 * La carte elle-même, que le doigt glisse quand elle a des tenues : à part
 * de `CarteDeLaLoge`, qui reste sans état — on l'appelle telle quelle pour
 * lire ce qu'elle rend.
 */
function CarteQuiGlisse({ className, onGlisser, children }: { className: string; onGlisser?: (pas: 1 | -1) => void; children: ReactNode }) {
  const glisse = useGlisse(onGlisser)
  return (
    <div className={className + (glisse.arrivee ? ` loge-carte-arrive-${glisse.arrivee}` : '')} {...(onGlisser && glisse.gestes)}>
      {children}
    </div>
  )
}

/**
 * Les six pièces, sur une rangée d'onglets : un seul arrêt de Tab, les
 * flèches passent à la voisine (`ongletVise`). « La salle voit » au-dessus
 * des quatre premières, « Toi seul » au-dessus des deux dernières — le
 * lecteur d'écran l'entend dans la ligne qui suit (`qui`). Une pastille dit
 * la pièce qui a du nouveau.
 */
export function PiecesDeLaLoge({ actif, onChoisir, neuves }: { actif: PieceDeLaLoge; onChoisir: (p: PieceDeLaLoge) => void; neuves: ReadonlySet<PieceDeLaLoge> }) {
  const liste = useRef<HTMLDivElement>(null)
  const touche = (e: KeyboardEvent, i: number) => {
    const j = ongletVise(e.key, i, PIECES_DE_LA_LOGE.length)
    if (j === null) return
    e.preventDefault()
    onChoisir(PIECES_DE_LA_LOGE[j].id)
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
  }
  return (
    <div className="loge-pieces">
      <div className="loge-groupes" aria-hidden="true">
        <span>La salle voit</span>
        <span>Toi seul</span>
      </div>
      <div ref={liste} className="loge-rangee" role="tablist" aria-label="Ce que je change">
        {PIECES_DE_LA_LOGE.map((p, i) => (
          <button
            key={p.id}
            id={`loge-${p.id}`}
            type="button"
            role="tab"
            aria-selected={actif === p.id}
            aria-controls={actif === p.id ? 'loge-panneau' : undefined}
            tabIndex={actif === p.id ? 0 : -1}
            className={'loge-piece' + (p.groupe === 'moi' ? ' loge-pour-moi' : '')}
            onClick={() => onChoisir(p.id)}
            onKeyDown={e => touche(e, i)}
          >
            <span className="loge-rond">
              <Icon name={ICONES[p.id]} />
              {neuves.has(p.id) && <span className="loge-neuf" aria-hidden="true" />}
            </span>
            {p.nom}
            {neuves.has(p.id) && <span className="sr-only">, du nouveau</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * La loge en attendant ses panneaux : sa carte — ce qu'il porte — et la
 * rangée de ses pièces, tout de suite, à la place exacte où la loge les
 * reprendra ; le panneau de la pièce suit avec son code (`attente`). Une
 * pièce touchée d'ici s'ouvre dès qu'il arrive ; sa carte, en grand, tout de
 * suite (`onOuvrir`) : rien n'est encore à l'essai.
 */
export function LogeEnChemin({
  profil,
  piece,
  onPiece,
  onOuvrir,
  attente,
}: {
  profil: PublicProfileDetail
  piece: PieceDeLaLoge
  onPiece: (p: PieceDeLaLoge) => void
  onOuvrir?: () => void
  attente: ReactNode
}) {
  return (
    <div className="loge">
      <CarteDeLaLoge vu={profil} vitrine={null} paquet={paquetDe(profil)} onOuvrir={onOuvrir} />
      <PiecesDeLaLoge actif={piece} onChoisir={onPiece} neuves={new Set()} />
      <div className="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby={`loge-${piece}`}>
        {attente}
      </div>
    </div>
  )
}

/**
 * Ses tenues telles que la carte les montre quand rien n'est à l'essai : un
 * point chacune, celle qu'il porte en or. La loge arrivée y pose ses gestes,
 * au même endroit — rien ne saute sous le doigt.
 */
export function paquetDe(profil: PublicProfileDetail): PaquetDeTenues {
  const tenues = profil.tenues ?? []
  const portee = laTenuePortee(tenues, profil)
  return { noms: tenues.map(t => t.nom), portee, montree: portee }
}

/**
 * Le doigt qui glisse la carte de côté (`CarteJoueur` fait de même avec ses
 * faces) : elle le suit un peu, et lâchée assez loin, change de tenue — puis
 * entre du côté d'où vient la suivante. Le doigt qui monte ou descend fait
 * défiler la page ; la souris n'a que le cintre et la liste : un clic glissé
 * sélectionnerait le texte de la carte.
 */
function useGlisse(onGlisser: ((pas: 1 | -1) => void) | undefined) {
  const depart = useRef<{ id: number; x: number; y: number; tient: boolean } | null>(null)
  const glisseLe = useRef(0)
  const [arrivee, setArrivee] = useState<'gauche' | 'droite' | null>(null)
  const relacher = (el: HTMLElement) => {
    el.classList.remove('loge-carte-tenue')
    el.style.removeProperty('--glisse-x')
  }
  const gestes = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      depart.current = e.isPrimary && e.pointerType !== 'mouse' ? { id: e.pointerId, x: e.clientX, y: e.clientY, tient: false } : null
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const d = depart.current
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.tient) {
        if (Math.abs(dy) > GLISSE && Math.abs(dy) >= Math.abs(dx)) {
          depart.current = null
          return
        }
        if (Math.abs(dx) <= GLISSE) return
        d.tient = true
        e.currentTarget.classList.add('loge-carte-tenue')
      }
      // Elle le suit un peu, jamais hors de l'écran : douze pixels de côté au plus — la page ne s'élargit pas.
      e.currentTarget.style.setProperty('--glisse-x', `${Math.round(Math.max(-SUIT_LE_DOIGT, Math.min(SUIT_LE_DOIGT, dx * 0.4)))}px`)
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      const d = depart.current
      depart.current = null
      relacher(e.currentTarget)
      if (!d?.tient || d.id !== e.pointerId) return
      glisseLe.current = Date.now()
      const dx = e.clientX - d.x
      if (Math.abs(dx) < ASSEZ_POUR_CHANGER) return
      // Vers la gauche, la suivante, qui entre par la droite.
      setArrivee(dx < 0 ? 'droite' : 'gauche')
      onGlisser?.(dx < 0 ? 1 : -1)
    },
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => {
      depart.current = null
      relacher(e.currentTarget)
    },
    onClickCapture: (e: MouseEvent<HTMLDivElement>) => {
      if (Date.now() - glisseLe.current > CLIC_APRES_UN_GLISSE_MS) return
      e.stopPropagation()
      e.preventDefault()
    },
    onAnimationEnd: () => setArrivee(null),
  }
  return { gestes, arrivee }
}

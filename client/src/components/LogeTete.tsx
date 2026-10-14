import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { Icon, type IconName } from './Icon'
import { XpMince } from './Identite'
import { ongletVise } from './Onglets'
import { espacesFines } from '../format'
import { cibleEclat } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { NOM_FINITION, brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import { nomDuTitre } from '../../../shared/sentiers'
import { bordurePortee } from '../../../shared/duels'
import { PIECES_DE_LA_LOGE, type PieceDeLaLoge } from '../../../shared/piecesDeLaLoge'

// La tête de la loge — sa carte et la rangée des six pièces —, à part de
// ses panneaux : la page du profil la montre dès qu'elle a le profil, et la
// loge entière la reprend quand ses panneaux arrivent, au même endroit. La
// loge vit sur la page du profil (le souhait du propriétaire du 12 octobre
// 2026 : « la page me changer directement dans le profil ») ; attendre ses
// panneaux pour montrer la carte retardait la page de 0,3 s en 4G.

/** L'icône de chaque pièce, sur sa rangée : celles de leurs pages d'avant. */
const ICONES: Record<PieceDeLaLoge, IconName> = { avatar: 'sparkles', titre: 'star', vitrine: 'award', fond: 'image', theme: 'palette', gerbe: 'zap' }

/**
 * Sa carte, en tête de la loge, telle que la salle la verrait s'il portait
 * l'essai : son fond, son avatar et sa finition, son prénom, son titre, sa
 * vitrine — et, dessous, ce qui lui manque pour le niveau suivant et ses
 * confettis. « Aperçu » dit que rien n'est encore porté. Collée en haut
 * pendant qu'on choisit : c'est elle qui change.
 *
 * L'avatar qu'elle montre a éclaté pour lui ? « Version rare » se touche
 * sur elle, à côté de lui : sa version rare ou celle d'origine s'essaie aussi.
 * Dans une fiche sous la case touchée, elle s'enregistrait d'un toucher ;
 * sous la grille, elle aurait fait sauter les cases sous le doigt.
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
  version = null,
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
  /** La version de l'avatar montré, s'il a éclaté : rare ou d'origine, et de quoi l'essayer. */
  version?: { rare: boolean; essayee: boolean; basculer: () => void } | null
  /** Sa carte entière, en grand. */
  onOuvrir?: () => void
}) {
  const titre = nomDuTitre(vu.titre)
  // Sous un Divin, qui a sa propre lumière, la finition ne se dit pas.
  const finition = divin(vu.legendaire) ? null : NOM_FINITION[vu.finition]
  return (
    <div className="loge-collante">
      <div className={'loge-carte' + (vu.fond ? ` carte-fond fond-${vu.fond}` : '') + (apercu ? ' loge-en-apercu' : '')}>
        <div className="loge-carte-haut">
          <span className={'loge-carte-avatar' + (essaye.avatar ? ' loge-essaye' : '')}>
            <Avatar
              className="player-avatar big"
              avatar={vu.avatar}
              finition={vu.finition}
              eclat={brilleChez(vu, cibleEclat(vu.legendaire ?? undefined, vu.avatar))}
              legendaire={vu.legendaire ?? undefined}
              bordure={bordurePortee(vu.bordureChoisie ?? 'auto', vu.bordures)}
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
          {apercu ? <span className="loge-apercu">Aperçu</span> : finition && <span className="loge-finition">{finition}</span>}
          {version && (
            <button type="button" className={'loge-version' + (version.essayee ? ' loge-essaye' : '')} aria-pressed={version.rare} onClick={version.basculer}>
              <Icon name="sparkles" />
              Version rare
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
      </div>
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

/** Qui voit la pièce ouverte, l'œil devant : sous la rangée. */
export function QuiLaVoit({ piece }: { piece: PieceDeLaLoge }) {
  const pieceDuPanneau = PIECES_DE_LA_LOGE.find(p => p.id === piece)!
  return (
    <p className="muted loge-qui">
      <Icon name="eye" />
      {espacesFines(pieceDuPanneau.qui)}
    </p>
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
      <CarteDeLaLoge vu={profil} vitrine={null} onOuvrir={onOuvrir} />
      <PiecesDeLaLoge actif={piece} onChoisir={onPiece} neuves={new Set()} />
      <QuiLaVoit piece={piece} />
      <div className="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby={`loge-${piece}`}>
        {attente}
      </div>
    </div>
  )
}

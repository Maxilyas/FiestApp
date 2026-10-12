import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Laurier } from './Laurier'
import { Icon, type IconName } from './Icon'
import { ongletVise } from './Onglets'
import { MaGerbe, MesAvatars, MesFinitions, MonFond, MonTitre } from './Apparence'
import { MaVitrine } from './Trophees'
import { MesThemes } from './Boutique'
import type { ChoixDuProfil, PropsDUnePiece } from './choix'
import { espacesFines } from '../format'
import { rendreLeFocus } from '../focus'
import { essayerTheme, finirLEssai } from '../themeJoueur'
import { compteDeLaCollection } from '../../../shared/collection'
import { cibleEclat } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { NOM_FINITION, brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import { nomDuTitre } from '../../../shared/sentiers'
import {
  PIECES_DE_LA_LOGE,
  avecLEssai,
  ceQuIlAPorter,
  essaiVide,
  essayer as avecUnePiece,
  lignesDeLEssai,
  nouveautes,
  retenirLesVus,
  vitrineVue,
  type Essai,
  type LigneDEssai,
  type PieceDeLaLoge,
  type VusDeLaLoge,
} from '../../../shared/loge'

// La loge : « Me changer », au profil — tout ce qu'on porte, sur un seul
// écran (la maquette validée par le propriétaire le 12 octobre 2026). Sa
// carte en tête montre l'essai ; dessous, les six pièces sur une rangée — ce
// que la salle voit, puis ce que lui seul voit —, le panneau de la pièce
// touchée, et, dès qu'on essaie quelque chose, la barre qui le dit :
// « Annuler », « Porter ». Les règles de l'essai sont pures
// (`shared/loge.ts`) ; ici, ce qui se voit et ce que ce téléphone retient.

/** L'icône de chaque pièce, sur sa rangée : celles de leurs pages d'avant. */
const ICONES: Record<PieceDeLaLoge, IconName> = { avatar: 'sparkles', titre: 'star', vitrine: 'award', fond: 'image', theme: 'palette', gerbe: 'zap' }

// ── Ce que ce téléphone a déjà vu ────────────────────────────────────────

/** Une clé par profil : un téléphone prêté garde ce que chacun a vu. */
const cleDesVus = (profil: string) => `quizz.loge.vus.${profil}`

function lireVus(profil: string): VusDeLaLoge {
  // Sous try/catch : des cookies bloqués donnaient une page noire.
  try {
    const brut: unknown = JSON.parse(localStorage.getItem(cleDesVus(profil)) ?? '{}')
    const vus: VusDeLaLoge = {}
    if (brut && typeof brut === 'object') {
      for (const { id } of PIECES_DE_LA_LOGE) {
        const liste = (brut as Record<string, unknown>)[id]
        if (Array.isArray(liste)) vus[id] = liste.filter((k): k is string => typeof k === 'string')
      }
    }
    return vus
  } catch {
    return {}
  }
}

function ecrireVus(profil: string, vus: VusDeLaLoge) {
  try {
    localStorage.setItem(cleDesVus(profil), JSON.stringify(vus))
  } catch {
    // Stockage refusé : rien ne se dira nouveau, rien ne casse.
  }
}

/**
 * Ce que le vestiaire du profil dit de nouveau, pièce par pièce : de quoi
 * poser sa pastille sur ce qui a changé depuis le dernier passage dans la
 * loge. Lu, jamais écrit : c'est la loge qui retient ce qu'on a vu.
 */
export function nouveautesDuVestiaire(profil: PublicProfileDetail): Partial<Record<PieceDeLaLoge, number>> {
  const neufs = nouveautes(ceQuIlAPorter(profil), lireVus(profil.id))
  const n: Partial<Record<PieceDeLaLoge, number>> = {}
  for (const { id } of PIECES_DE_LA_LOGE) if (neufs[id].length > 0) n[id] = neufs[id].length
  return n
}

/**
 * La première fois qu'un profil paraît sur ce téléphone, ce qu'il a s'y
 * retient tel quel : la prochaine nouveauté s'y verra. Sans ça, seul un
 * passage par la loge commençait le compte.
 */
export function retenirLesPremiersVus(profil: PublicProfileDetail) {
  const vus = lireVus(profil.id)
  if (PIECES_DE_LA_LOGE.every(p => vus[p.id])) return
  ecrireVus(profil.id, retenirLesVus(ceQuIlAPorter(profil), vus, null))
}

// ── La loge ──────────────────────────────────────────────────────────────

export function Loge({
  profil,
  piece,
  onPiece,
  busy,
  enregistrer,
  erreur,
}: {
  profil: PublicProfileDetail
  piece: PieceDeLaLoge
  onPiece: (piece: PieceDeLaLoge) => void
  busy: boolean
  /** L'enregistrement de la page : vrai s'il a pris. */
  enregistrer: (patch: ChoixDuProfil) => Promise<boolean>
  /** Le refus du dernier enregistrement, que la barre de l'essai dit. */
  erreur?: string
}) {
  const [essai, setEssai] = useState<Essai>({})
  // Ce qui était nouveau à l'ouverture le reste le temps de la visite ; la
  // pastille d'une pièce, elle, s'éteint dès qu'on l'a regardée.
  const [neufs] = useState(() => nouveautes(ceQuIlAPorter(profil), lireVus(profil.id)))
  const [regardees, setRegardees] = useState<ReadonlySet<PieceDeLaLoge>>(() => new Set([piece]))
  useEffect(() => {
    setRegardees(r => (r.has(piece) ? r : new Set([...r, piece])))
    ecrireVus(profil.id, retenirLesVus(ceQuIlAPorter(profil), lireVus(profil.id), piece))
  }, [piece, profil])

  // Le thème essayé habille toute la page — la carte, à fond, garde ses
  // couleurs ; la loge quittée, la page reprend le sien.
  useEffect(() => {
    if (essai.theme === undefined) finirLEssai()
    else void essayerTheme(essai.theme)
  }, [essai.theme])
  useEffect(() => () => finirLEssai(), [])

  // Un toucher pendant l'enregistrement ne change rien : l'essai qui part est celui qu'on porte.
  const essayer = (morceau: Essai) => {
    if (!busy) setEssai(e => avecUnePiece(e, morceau, profil))
  }
  const porter = async () => {
    if (busy || essaiVide(essai)) return
    if (!(await enregistrer(essai))) return
    // Le thème essayé devient le thème porté, sans repasser par l'ancien.
    if (essai.theme !== undefined) finirLEssai(true)
    setEssai({})
  }

  const lignes = lignesDeLEssai(essai, profil)
  // La barre part avec l'essai qu'elle portait ou annulait : le focus tombait
  // sur la page. Il revient au panneau de la pièce ouverte — pas à son
  // onglet, dont `rendreLeFocus` retirerait l'arrêt du Tab.
  const loge = useRef<HTMLDivElement>(null)
  const aUnEssai = lignes.length > 0
  const avaitUnEssai = useRef(aUnEssai)
  useEffect(() => {
    if (avaitUnEssai.current && !aUnEssai) rendreLeFocus(loge.current, ['.loge-panneau'])
    avaitUnEssai.current = aUnEssai
  }, [aUnEssai])
  const pieceDuPanneau = PIECES_DE_LA_LOGE.find(p => p.id === piece)!
  const props: PropsDUnePiece = {
    profil,
    essai,
    essayer,
    busy,
    // Hors de l'essai : la version — rare ou d'origine — d'un avatar éclaté s'enregistre d'un toucher.
    enregistrer: patch => void enregistrer(patch),
    neufs: new Set(neufs[piece]),
  }
  const avatars = compteDeLaCollection(profil).familles.find(f => f.famille === 'avatars')
  const reste = avatars ? avatars.total - avatars.acquis : 0
  return (
    <div className="loge" ref={loge}>
      <CarteDeLaLoge profil={profil} essai={essai} />
      <PiecesDeLaLoge actif={piece} onChoisir={onPiece} neuves={new Set(PIECES_DE_LA_LOGE.filter(p => neufs[p.id].length > 0 && !regardees.has(p.id)).map(p => p.id))} />
      <p className="muted loge-qui">
        <Icon name="eye" />
        {espacesFines(pieceDuPanneau.qui)}
      </p>
      <div className="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby={`loge-${piece}`}>
        {piece === 'avatar' && (
          <>
            <MaFinition {...props} />
            <MesAvatars {...props} aMoi />
            {reste > 0 && (
              <a className="link-inline lien-boutique" href="#collection">
                <Icon name="award" />
                {`${reste} autre${reste > 1 ? 's' : ''} à gagner : où et comment, dans « Ma collection »`}
              </a>
            )}
          </>
        )}
        {piece === 'titre' && <MonTitre {...props} />}
        {piece === 'vitrine' && (
          <>
            <MaVitrine {...props} />
            <p className="muted small center">Le reste de ta carte se remplit tout seul : tes légendaires, tes écussons, tes chiffres, tes prix.</p>
          </>
        )}
        {piece === 'fond' && <MonFond {...props} />}
        {piece === 'theme' && <MesThemes {...props} />}
        {piece === 'gerbe' && <MaGerbe {...props} />}
      </div>
      {/* Toujours là, vide d'abord : une région qui apparaît avec son texte n'est pas toujours lue. */}
      <p className="sr-only" role="status">
        {lignes.length > 0 ? `À l’essai : ${lignes.map(l => `${l.nom}, ${l.detail}`).join(' ; ')}.` : ''}
      </p>
      {aUnEssai && <BarreDEssai lignes={lignes} busy={busy} erreur={erreur} onAnnuler={() => setEssai({})} onPorter={() => void porter()} />}
    </div>
  )
}

/**
 * La barre de l'essai, en bas, à la place du menu : ce qu'on essaie — une
 * pièce par son nom, plusieurs comptées —, « Annuler », qui rend la tenue
 * d'avant sans rien envoyer, et « Porter », qui enregistre tout d'un coup.
 */
export function BarreDEssai({
  lignes,
  busy,
  erreur,
  onAnnuler,
  onPorter,
}: {
  lignes: LigneDEssai[]
  busy: boolean
  /** Le refus du serveur, dit là où l'on a touché « Porter » : en bas de la page, il passait sous la barre. */
  erreur?: string
  onAnnuler: () => void
  onPorter: () => void
}) {
  const une = lignes.length === 1 ? lignes[0] : null
  return (
    <div className="loge-barre">
      <span className="loge-barre-texte">
        <b>{une ? une.nom : `${lignes.length} changements`}</b>
        {erreur ? (
          <span className="error small" role="alert">
            {erreur}
          </span>
        ) : (
          <span className="muted small">{une ? une.detail : lignes.map(l => l.nom).join(' · ')}</span>
        )}
      </span>
      <button type="button" className="btn btn-ghost" onClick={onAnnuler}>
        Annuler
      </button>
      <button type="button" className="btn btn-primary" aria-disabled={busy || undefined} onClick={onPorter}>
        Porter
      </button>
    </div>
  )
}

/**
 * Sa carte, en tête de la loge, telle que la salle la verrait s'il portait
 * l'essai : son fond, son avatar et sa finition, son prénom, son titre, sa
 * vitrine. « Aperçu » dit que rien n'est encore porté. Collée en haut pendant
 * qu'on choisit : c'est elle qui change.
 */
function CarteDeLaLoge({ profil, essai }: { profil: PublicProfileDetail; essai: Essai }) {
  const vu = avecLEssai(profil, essai)
  const titre = nomDuTitre(vu.titre)
  const vitrine = vitrineVue(vu)
  const apercu = (['avatar', 'legendaire', 'finition', 'titre', 'vitrine', 'fond'] as const).some(k => essai[k] !== undefined)
  // Sous un Divin, qui a sa propre lumière, la finition ne se dit pas.
  const finition = divin(vu.legendaire) ? null : NOM_FINITION[vu.finition]
  return (
    <div className="loge-collante">
      <div className={'loge-carte' + (vu.fond ? ` carte-fond fond-${vu.fond}` : '') + (apercu ? ' loge-en-apercu' : '')}>
        <span className={'loge-carte-avatar' + (essai.avatar !== undefined || essai.legendaire !== undefined || essai.finition !== undefined ? ' loge-essaye' : '')}>
          <Avatar
            className="player-avatar big"
            avatar={vu.avatar}
            finition={vu.finition}
            eclat={brilleChez(vu, cibleEclat(vu.legendaire ?? undefined, vu.avatar))}
            legendaire={vu.legendaire ?? undefined}
          />
        </span>
        <span className="loge-carte-texte">
          <span className="identite-nom">
            {vu.name}
            <Laurier laurier={vu.laurier} />
            <Niveau niveau={vu.niveau} />
          </span>
          <span className={'loge-carte-titre' + (titre ? '' : ' loge-sans') + (essai.titre !== undefined ? ' loge-essaye' : '')}>
            {titre ? espacesFines(`« ${titre} »`) : 'Sans titre'}
          </span>
          <span className={'loge-carte-vitrine' + (essai.vitrine !== undefined ? ' loge-essaye' : '')} aria-label={vitrine.length > 0 ? `Vitrine : ${vitrine.map(b => b.title).join(', ')}` : 'Vitrine vide'}>
            {vitrine.map(b => (
              <span key={b.key} className="vestiaire-case" aria-hidden="true">
                {b.emoji}
              </span>
            ))}
          </span>
        </span>
        {apercu ? <span className="loge-apercu">Aperçu</span> : finition && <span className="loge-finition">{finition}</span>}
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
function PiecesDeLaLoge({ actif, onChoisir, neuves }: { actif: PieceDeLaLoge; onChoisir: (p: PieceDeLaLoge) => void; neuves: ReadonlySet<PieceDeLaLoge> }) {
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
 * La finition, sur une ligne qui dit celle que la carte montre ; touchée, sa
 * grille se déplie dessous. Dépliée d'office, ses huit cases repoussaient
 * ses avatars de plus d'un écran — et l'on vient surtout changer d'avatar.
 */
function MaFinition(props: PropsDUnePiece) {
  const { profil, essai } = props
  const [ouverte, setOuverte] = useState(false)
  const choisie = essai.finition ?? profil.finitionChoisie
  const vu = avecLEssai(profil, essai)
  const valeur = choisie === 'auto' ? `Auto · ${NOM_FINITION[vu.finition]}` : NOM_FINITION[vu.finition]
  return (
    <div className="ma-finition">
      <ul className="style-liste">
        <li>
          <button type="button" aria-expanded={ouverte} aria-controls="mes-finitions" onClick={() => setOuverte(o => !o)}>
            <span className="style-icone">
              <Icon name="sparkles" />
            </span>
            <span className="style-nom">Finition</span>
            <span className="style-valeur">{essai.finition !== undefined ? `${valeur} · à l’essai` : valeur}</span>
            <Icon name="chevron-down" className="style-chevron" />
          </button>
        </li>
      </ul>
      {ouverte && (
        <div id="mes-finitions">
          <MesFinitions {...props} />
        </div>
      )}
    </div>
  )
}

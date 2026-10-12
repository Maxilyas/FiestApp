import { useEffect, useRef, useState } from 'react'
import { CarteDeLaLoge, PiecesDeLaLoge, QuiLaVoit } from './LogeTete'
import { MaGerbe, MesAvatars, MesBordures, MesFinitions, MonFond, MonTitre } from './Apparence'
import { MaVitrine } from './Trophees'
import { MesThemes } from './Boutique'
import type { ChoixDuProfil, PropsDUnePiece } from './choix'
import { rendreLeFocus } from '../focus'
import { essayerTheme, finirLEssai } from '../themeJoueur'
import { brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import {
  PIECES_DE_LA_LOGE,
  avatarMontre,
  avecLEssai,
  cibleDeLEclat,
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

// La loge : « M'habiller », derrière son bouton du profil — tout ce qu'on
// porte, au même endroit (la maquette validée par le propriétaire le 12
// octobre 2026). Sa carte en tête montre l'essai ; dessous, les six pièces
// sur une rangée — ce que la salle voit, puis ce que lui seul voit —, le
// panneau de la pièce touchée, et, dès qu'on essaie quelque chose, la barre
// qui le dit : « Annuler », « Porter ». Les règles de l'essai sont pures
// (`shared/loge.ts`) ; la carte et la rangée, légères, à part
// (`LogeTete.tsx`) ; ici, l'essai et ce que ce téléphone retient.

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
 * La première fois qu'un profil paraît sur ce téléphone, ce qu'il a s'y
 * retient tel quel : la prochaine nouveauté s'y verra. Sans ça, seul un
 * passage par la loge commençait le compte.
 */
export function retenirLesPremiersVus(profil: PublicProfileDetail) {
  const vus = lireVus(profil.id)
  if (PIECES_DE_LA_LOGE.every(p => vus[p.id])) return
  ecrireVus(profil.id, retenirLesVus(ceQuIlAPorter(profil), vus, null))
}

/**
 * La loge a-t-elle du nouveau depuis son dernier passage sur ce téléphone ?
 * Le bouton « M'habiller » le dit, comme la pièce qui l'a dans la rangée.
 */
export function aDuNouveau(profil: PublicProfileDetail): boolean {
  const neufs = nouveautes(ceQuIlAPorter(profil), lireVus(profil.id))
  return PIECES_DE_LA_LOGE.some(p => neufs[p.id].length > 0)
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
  const props: PropsDUnePiece = { profil, essai, essayer, busy, neufs: new Set(neufs[piece]) }
  // La carte montre l'essai — et la version de l'avatar montré, s'il a éclaté pour lui.
  const vu = avecLEssai(profil, essai)
  const cible = cibleDeLEclat(avatarMontre(profil, essai))
  const rare = cible && profil.eclats.includes(cible) ? brilleChez(vu, cible) : null
  return (
    <div className="loge" ref={loge}>
      <CarteDeLaLoge
        vu={vu}
        vitrine={vitrineVue(vu)}
        apercu={(['avatar', 'legendaire', 'finition', 'bordure', 'titre', 'vitrine', 'fond', 'eclat'] as const).some(k => essai[k] !== undefined)}
        essaye={{
          avatar: essai.avatar !== undefined || essai.legendaire !== undefined || essai.finition !== undefined || essai.bordure !== undefined || !!essai.eclat,
          titre: essai.titre !== undefined,
          vitrine: essai.vitrine !== undefined,
        }}
        version={rare !== null && cible ? { rare, essayee: !!essai.eclat, basculer: () => essayer({ eclat: { cle: cible, brille: !rare } }) } : null}
      />
      <PiecesDeLaLoge actif={piece} onChoisir={onPiece} neuves={new Set(PIECES_DE_LA_LOGE.filter(p => neufs[p.id].length > 0 && !regardees.has(p.id)).map(p => p.id))} />
      <QuiLaVoit piece={piece} />
      <div className="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby={`loge-${piece}`}>
        {piece === 'avatar' && (
          <>
            <MesFinitions {...props} />
            <MesBordures {...props} />
            <MesAvatars {...props} />
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

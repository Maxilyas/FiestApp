import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { CarteDeLaLoge, PiecesDeLaLoge, QuiLaVoit } from './LogeTete'
import { MaGerbe, MesAvatars, MesBordures, MesFinitions, MonFond, MonTitre } from './Apparence'
import { MaVitrine } from './Trophees'
import { MesThemes } from './Boutique'
import { choixDialog } from './Dialog'
import type { ChoixDuProfil, GardeDeLaLoge, PropsDUnePiece } from './choix'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { rendreLeFocus } from '../focus'
import { essayerTheme, finirLEssai } from '../themeJoueur'
import { api } from '../api'
import { brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import { compteDesNouveautes, type NouveautesDeLaLoge } from '../../../shared/piecesDeLaLoge'
import {
  PIECES_DE_LA_LOGE,
  avatarMontre,
  avecLEssai,
  carteAvecLEssai,
  cibleDeLEclat,
  ceQuIlAPorter,
  essaiDemande,
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

/** Sa carte entière, en grand : elle ne vient qu'au toucher, comme au profil. */
const carteJoueur = aLaDemande(() => import('./CarteJoueur'))

// La loge : « M'habiller », derrière son bouton du profil — tout ce qu'on
// porte, au même endroit (la maquette validée par le propriétaire le 12
// octobre 2026). Sa carte en tête montre l'essai ; dessous, les six pièces
// sur une rangée — ce que la salle voit, puis ce que lui seul voit —, le
// panneau de la pièce touchée, et, dès qu'on essaie quelque chose, la barre
// qui le dit : « Annuler », « Porter ». Les règles de l'essai sont pures
// (`shared/loge.ts`) ; la carte et la rangée, légères, à part
// (`LogeTete.tsx`) ; ici, l'essai et ce qu'il a déjà vu.

// ── Ce qu'il a déjà vu ───────────────────────────────────────────────────
// Retenu par le serveur, pour tous ses appareils (`profile_loge_vus`) : sur
// ce téléphone seulement jusqu'au 14 octobre 2026, ce qu'on regardait sur
// l'ordinateur se redisait nouveau sur le téléphone, et la pastille ne
// pouvait vivre que sur la page du profil.

/** Ce que le serveur dit qu'il a vu ; rien de lu — une base qui s'est tue, un serveur d'avant —, rien n'est nouveau. */
const vusDe = (profil: PublicProfileDetail): VusDeLaLoge => profil.vusDeLaLoge ?? {}

/** Deux retenues qui disent la même chose : la seconde ne repart pas au serveur. */
function memesVus(a: VusDeLaLoge, b: VusDeLaLoge): boolean {
  return PIECES_DE_LA_LOGE.every(({ id }) => {
    const x = a[id]
    const y = b[id]
    return !x || !y ? x === y : x.length === y.length && x.every((k, i) => k === y[i])
  })
}

/**
 * Retient ce qu'il a vu : la page d'abord (`onVus`), qui recompte ses
 * pastilles, puis le serveur. Rien ne part si rien n'a changé ; un envoi
 * raté se tait — la pastille reviendra au prochain passage, rien ne casse.
 * Un serveur qui n'a pas su lire ce qu'il a vu ne se voit rien écrire
 * par-dessus : il effacerait ce qui restait à voir.
 */
function retenir(profil: PublicProfileDetail, vus: VusDeLaLoge, onVus?: (vus: VusDeLaLoge) => void) {
  if (profil.vusDeLaLoge === undefined) return
  if (profil.vusDeLaLoge && memesVus(profil.vusDeLaLoge, vus)) return
  onVus?.(vus)
  void api.joueur.retenirLesVus(vus).catch(() => {})
}

/**
 * La première fois qu'un profil paraît — ici ou sur un autre appareil —, ce
 * qu'il a se retient tel quel : la prochaine nouveauté aura sa pastille. Sans
 * ça, seul un passage par la loge commençait le compte.
 */
export function retenirLesPremiersVus(profil: PublicProfileDetail, onVus?: (vus: VusDeLaLoge) => void) {
  const vus = vusDe(profil)
  if (PIECES_DE_LA_LOGE.every(p => vus[p.id])) return
  retenir(profil, retenirLesVus(ceQuIlAPorter(profil), vus, null), onVus)
}

/**
 * Ce que la loge a de neuf depuis son dernier passage, compté : la pastille
 * rouge de « M'habiller » et de « Profil », et la pièce où la loge s'ouvre.
 * La règle que le serveur compte pour l'accueil (`GET /api/joueur/nouveautes`).
 */
export function nouveautesDuProfil(profil: PublicProfileDetail): NouveautesDeLaLoge {
  return compteDesNouveautes(nouveautes(ceQuIlAPorter(profil), vusDe(profil)))
}

// ── L'essai qu'une fin de partie demande ─────────────────────────────────

/** Ce qu'une fin de partie demande d'essayer (`/profil?essayer=nuit#fond`), lu une fois, à l'ouverture. */
function lireLEssaiDemande(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('essayer')
  } catch {
    return null
  }
}

/** L'essai posé, l'adresse l'oublie : un rechargement ou une autre pièce ne le reposeraient pas. */
function oublierLEssaiDemande() {
  const q = new URLSearchParams(window.location.search)
  if (!q.has('essayer')) return
  q.delete('essayer')
  const reste = q.toString()
  history.replaceState(history.state, '', `${window.location.pathname}${reste ? `?${reste}` : ''}${window.location.hash}`)
}

// ── La loge ──────────────────────────────────────────────────────────────

export function Loge({
  profil,
  piece,
  onPiece,
  busy,
  enregistrer,
  erreur,
  garde,
  onVus,
}: {
  profil: PublicProfileDetail
  piece: PieceDeLaLoge
  onPiece: (piece: PieceDeLaLoge) => void
  busy: boolean
  /** L'enregistrement de la page : vrai s'il a pris. */
  enregistrer: (patch: ChoixDuProfil) => Promise<boolean>
  /** Le refus du dernier enregistrement, que la barre de l'essai dit. */
  erreur?: string
  /** Ce que la page demande à la loge avant de la quitter (`GardeDeLaLoge`) : la loge l'y pose, tant qu'elle est là. */
  garde?: MutableRefObject<GardeDeLaLoge | null>
  /** Ce qu'il vient de voir : la page le garde, et recompte la pastille de « Profil ». */
  onVus?: (vus: VusDeLaLoge) => void
}) {
  // « Essayer », à la fin d'une partie : ce qu'elle vient d'ouvrir arrive déjà sur la carte.
  const [essai, setEssai] = useState<Essai>(() => essaiDemande(piece, lireLEssaiDemande(), profil))
  useEffect(() => oublierLEssaiDemande(), [])
  // Ce qui était nouveau à l'ouverture le reste le temps de la visite ; la
  // pastille d'une pièce, elle, s'éteint dès qu'on l'a regardée.
  const [neufs] = useState(() => nouveautes(ceQuIlAPorter(profil), vusDe(profil)))
  const [regardees, setRegardees] = useState<ReadonlySet<PieceDeLaLoge>>(() => new Set([piece]))
  useEffect(() => {
    setRegardees(r => (r.has(piece) ? r : new Set([...r, piece])))
    // La page rend le profil à jour (`onVus`) : relue, la pièce n'a plus rien de neuf, rien ne repart.
    retenir(profil, retenirLesVus(ceQuIlAPorter(profil), vusDe(profil), piece), onVus)
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
  /** Porte tout l'essai d'un coup : vrai s'il est porté — ou s'il n'y avait rien à porter. */
  const porter = async (): Promise<boolean> => {
    if (essaiVide(essai)) return true
    if (busy || !(await enregistrer(essai))) return false
    // Le thème essayé devient le thème porté, sans repasser par l'ancien.
    if (essai.theme !== undefined) finirLEssai(true)
    setEssai({})
    return true
  }

  // La page qui quitte la loge le lui demande d'abord — « ← Mon profil », un
  // lien, le retour du navigateur (`GardeDeLaLoge`) : un essai qu'on n'avait
  // pas porté se perdait en silence (le retour d'un joueur du 14 octobre
  // 2026). La garde lit l'essai du moment, pas celui de sa pose.
  const dernier = useRef({ essai, porter, profil })
  dernier.current = { essai, porter, profil }
  // Il a choisi de partir : ni la garde ni le navigateur ne le retiennent plus, jusqu'au prochain essai.
  const laisserPartir = useRef(false)
  useEffect(() => {
    laisserPartir.current = false
  }, [essai])
  useEffect(() => {
    if (!garde) return
    garde.current = gardeDeLEssai(() => dernier.current, laisserPartir)
    return () => {
      garde.current = null
    }
  }, [garde])

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
  // Recharger, fermer l'onglet, partir par une adresse tapée : le navigateur demande, à sa façon.
  useEffect(() => {
    if (!aUnEssai) return
    const retenir = (e: BeforeUnloadEvent) => {
      if (laisserPartir.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', retenir)
    return () => window.removeEventListener('beforeunload', retenir)
  }, [aUnEssai])

  // Sa carte, touchée : en grand, telle que la salle la verrait s'il portait l'essai.
  const [enGrand, setEnGrand] = useState(false)
  const laCarte = useALaDemande(carteJoueur, enGrand)
  const props: PropsDUnePiece = {
    profil,
    essai,
    essayer,
    busy,
    neufs: new Set(neufs[piece]),
    // Définitif : il ne passe jamais par l'essai, ni par « Porter ».
    eclater: async cle => {
      const depense: ChoixDuProfil = { eclatDeReserve: cle }
      return !busy && (await enregistrer(depense))
    },
  }
  // La carte montre l'essai — et la version de l'avatar montré, s'il a éclaté pour lui.
  const vu = avecLEssai(profil, essai)
  const cible = cibleDeLEclat(avatarMontre(profil, essai))
  const rare = cible && profil.eclats.includes(cible) ? brilleChez(vu, cible) : null
  // Quelque chose de ce que la salle voit est à l'essai : la carte le montre, « Aperçu ».
  const apercu = (['avatar', 'legendaire', 'finition', 'bordure', 'titre', 'vitrine', 'fond', 'eclat'] as const).some(k => essai[k] !== undefined)
  return (
    <div className="loge" ref={loge}>
      <CarteDeLaLoge
        vu={vu}
        vitrine={vitrineVue(vu)}
        apercu={apercu}
        essaye={{
          avatar: essai.avatar !== undefined || essai.legendaire !== undefined || essai.finition !== undefined || essai.bordure !== undefined || !!essai.eclat,
          titre: essai.titre !== undefined,
          vitrine: essai.vitrine !== undefined,
        }}
        version={rare !== null && cible ? { rare, essayee: !!essai.eclat, basculer: () => essayer({ eclat: { cle: cible, brille: !rare } }) } : null}
        onOuvrir={() => setEnGrand(true)}
      />
      {enGrand && laCarte && laCarte !== 'perdu' && (
        <laCarte.CarteJoueur
          adresse="/api/joueur/carte"
          retouche={apercu ? c => carteAvecLEssai(c, profil, essai) : undefined}
          // L'aperçu se porte d'ici : la carte se ferme, la barre de la loge dit ce qui a pris — ou le refus.
          pied={
            apercu ? (
              <>
                <p className="muted small">Rien n’est encore porté : la salle voit ta tenue d’avant.</p>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  aria-disabled={busy || undefined}
                  onClick={() => {
                    if (busy) return
                    setEnGrand(false)
                    void porter()
                  }}
                >
                  Porter
                </button>
              </>
            ) : undefined
          }
          onFermer={() => setEnGrand(false)}
        />
      )}
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
 * La garde de la loge (`GardeDeLaLoge`), sur l'essai du moment (`moment`) :
 * un essai attend-il, et que faire de lui. Le dialogue dit ce qu'on essaie,
 * puis « Porter » — partir une fois porté, rester sur un refus, que la barre
 * dit —, « Partir sans » ou « Rester ». Parti, plus rien ne le retient
 * (`laisserPartir`), le navigateur non plus. Le dialogue se passe en
 * paramètre : un test y répond sans écran.
 */
export function gardeDeLEssai(
  moment: () => { essai: Essai; profil: PublicProfileDetail; porter: () => Promise<boolean> },
  laisserPartir: { current: boolean },
  dialogue: typeof choixDialog = choixDialog,
): GardeDeLaLoge {
  return {
    enCours: () => !laisserPartir.current && !essaiVide(moment().essai),
    demander: async () => {
      const { essai, profil, porter } = moment()
      if (laisserPartir.current || essaiVide(essai)) return true
      const choix = await dialogue({
        title: 'Porter avant de partir ?',
        message: `À l’essai : ${lignesDeLEssai(essai, profil)
          .map(l => l.nom)
          .join(' · ')}.\nSans « Porter », tu gardes ta tenue d’avant.`,
        confirmLabel: 'Porter',
        cancelLabel: 'Rester',
        alternative: { label: 'Partir sans', danger: true },
      })
      // « Rester », Échap ou le voile : la loge reste, l'essai avec.
      if (!choix) return false
      if (choix.geste === 'confirmer' && !(await porter())) return false
      laisserPartir.current = true
      return true
    },
  }
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

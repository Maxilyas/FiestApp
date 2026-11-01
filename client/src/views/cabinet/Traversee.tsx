import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { aLaDemande, useALaDemande } from '../../aLaDemande'
import { confirmDialog } from '../../components/Dialog'
import { Icon } from '../../components/Icon'
import { Feuille, Sortie } from '../../components/Pieces'
import { CARTES_PEINTES } from '../../components/cartes-peintes'
import { COFFRES_PEINTS } from '../../components/coffres-peints'
import { IMAGES } from '../../components/legendaires-peints'
import { espacesFines } from '../../format'
import { toucher } from '../../toucher'
import { legendaire } from '../../../../shared/legendaires'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import { CARTES_D_UNE_TRAVERSEE, COEURS_D_UNE_MISE_PERDUE, CONFETTIS_D_UN_RANG, MULTIPLICATEUR_DE_LA_MISE, OR_D_UN_GARDIEN, OR_SANS_AMELIORATION } from '../../../../shared/cabinet/bareme'
import {
  ACTES,
  CARTES,
  EMOJI_DES_JEUX,
  NIVEAU_MAX,
  RANGEE_DU_GARDIEN,
  SORTES_DITES,
  VERSION_DE_LA_TRAVERSEE,
  acteDe,
  baremeDe,
  carteDeLaTraversee,
  cheminsVers,
  emojiDuTheme,
  gardienDeLaTraversee,
  jeuDeLAssaut,
  nomAuNiveau,
  orDUneManche,
  pvDuGardien,
  type BilanDEpreuve,
  type CarteEnMain,
  type CleDeCarte,
  type EtapeDeLaCarte,
  type NiveauDeCarte,
  type ThemeAuChoix,
} from '../../../../shared/cabinet/traversee'
import type { PageDeLaTraversee, VueDeLaTraversee } from '../../../../shared/cabinet/vues'
import { defiDeLaCarte, maitriseDite } from '../../../../shared/cabinet/defis'
import { NOMS_DES_DEFIS, RANGS, RANGS_DITS, defisTenus, gardienDeLaMaitrise, rangDeLaCle, type DefisTenus, type RangDUnDefi } from '../../../../shared/cabinet/sceaux'
import { Bourse, Coeurs, Piece, PointsDeVie } from './Monnaies'
import type { EtapeDessinee, SceneDeLaTraversee } from './TraverseeEn3D'

// La traversée du Cabinet à l'écran : trois actes, trois gardiens (le
// propriétaire, le 31 octobre 2026 ; la maquette jouée,
// `retours/2026-10-31/la-partie.md`). La carte en 3D d'un bord à l'autre —
// chargée à la demande, décorative —, et par-dessus des panneaux de verre :
// la tête (les cœurs, l'or, l'acte), le chemin à choisir en bas ; chaque
// étape s'ouvre en plein écran par-dessus — l'annonce d'une épreuve, le
// coffre, le marchand, le gardien, le légendaire, la fin. Quatre notions, pas
// une de plus : les cœurs, l'or, tes cartes, la carte.
//
// Rien ne s'y juge : la vue du serveur dit tout (`VueDeLaTraversee`), et chaque
// geste part à son rang (`onGeste`). La page ne retient que ce qu'elle a déjà
// montré — un bilan lu, un coffre ouvert, l'acte annoncé — : rechargée, elle
// le remontre, ce qui ne coûte rien. Une épreuve qui se joue s'ouvre sur son
// écran de partie (`Partie.tsx`, par `CabinetApp.tsx`), jamais ici.

/** La carte en 3D, à la demande : three.js ne descend qu'avec elle. */
const LA_CARTE_EN_3D = aLaDemande(() => import('./TraverseeEn3D'))

/** La carte se dessine-t-elle ici ? Sans WebGL, le panneau suffit : la carte est décorative. Écrit ici, pour ne pas tirer three.js. */
function webglPossible(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

// ── Une carte ──

const SIGNE: Record<NiveauDeCarte, string> = { 1: '', 2: '+', 3: '++' }

/** Une carte de la traversée : sa peinture, son nom et son niveau, sa sorte, ce qu'elle fait à ce niveau. */
export function CarteDeLaTraversee({
  cle,
  niveau,
  prise,
  action,
  bas,
  inerte,
  etiquette,
  v,
  dos,
  doree,
}: {
  cle: CleDeCarte
  niveau: NiveauDeCarte
  prise?: boolean
  action?: () => void
  bas?: ReactNode
  inerte?: boolean
  etiquette?: string
  /** La version de la traversée, dont la carte dit les chiffres : la Parade de la 1 n'est pas celle de la 2. */
  v?: VueDeLaTraversee['v']
  /** Le défi écrit au dos de la carte (`DosDeLaCarte`). */
  dos?: ReactNode
  /** Son défi tenu à l'Argent au moins : la carte a son dos doré. */
  doree?: boolean
}) {
  const c = carteDeLaTraversee(cle)
  if (!c) return null
  const contenu = (
    <>
      <span className="cab-tv-peinture">
        <img src={CARTES_PEINTES[cle]?.[1]} alt="" loading="lazy" />
        {prise && (
          <span className="cab-tv-coche" aria-hidden="true">
            ✓
          </span>
        )}
      </span>
      <span className="cab-tv-nom">
        {c.nom}
        {/* Une espace insécable : « + » ne passe jamais seul à la ligne. */}
        {niveau > 1 && <span className="cab-tv-plus">{` ${SIGNE[niveau]}`}</span>}
      </span>
      <span className={`cab-tv-sorte cab-tv-sorte-${c.sorte}`}>{etiquette ?? SORTES_DITES[c.sorte]}</span>
      <span className="cab-tv-dit">{espacesFines(c.dit(niveau, v))}</span>
      {dos}
      {bas && <span className="cab-tv-bas">{bas}</span>}
    </>
  )
  const classe = 'cab-tv-carte' + (prise ? ' cab-tv-prise' : '') + (niveau > 1 ? ' cab-tv-amelioree' : '') + (doree ? ' cab-tv-doree' : '')
  if (!action) return <div className={classe}>{contenu}</div>
  return (
    <button type="button" className={classe} aria-pressed={prise} aria-disabled={inerte || undefined} {...toucher(() => !inerte && action())}>
      {contenu}
    </button>
  )
}

// ── Les défis de tes cartes ──

/** Aucun défi tenu : une page d'avant, ou un rendu qui n'en dit rien. */
const AUCUN_DEFI: DefisTenus = defisTenus([])

/**
 * Le défi écrit au dos d'une carte (le 1er novembre 2026, `retours/2026-11-01/defis-des-cartes.md`) : son nom, ses trois
 * rangs — tenus en couleur —, et ce que demande le prochain. Il ne compte que si la carte est dans ta main.
 */
function DosDeLaCarte({ cle, rang }: { cle: CleDeCarte; rang: 0 | RangDUnDefi }) {
  const x = defiDeLaCarte(cle)
  if (!x) return null
  const suivant = rang < 3 ? ((rang + 1) as RangDUnDefi) : null
  return (
    <span className="cab-tv-defi">
      <span className="cab-tv-defi-tete">
        <span className="cab-tv-sceaux" role="img" aria-label={RANGS.map(k => `${RANGS_DITS[k]} ${k <= rang ? 'tenu' : 'à gagner'}`).join(', ')}>
          {RANGS.map(k => (
            <span key={k} className={`cab-tv-sceau cab-tv-sceau-${k}${k <= rang ? ' cab-tv-sceau-tenu' : ''}`} />
          ))}
        </span>
        <b>{x.nom}</b>
      </span>
      <span className="cab-tv-defi-rang">{suivant ? espacesFines(`${RANGS_DITS[suivant]} : ${enMinuscule(x.rangs[suivant - 1])}`) : 'Les trois rangs sont à toi'}</span>
    </span>
  )
}

/** Une phrase de rang après les deux-points : sa première lettre en minuscule — « Bronze : un acte fini… ». */
const enMinuscule = (phrase: string) => phrase.charAt(0).toLowerCase() + phrase.slice(1)

/** Ce qu'une clé tombée dit, une ligne : le plus haut rang de chaque carte, chaque gardien vaincu en maître. */
function sceauxDits(cles: readonly string[]): string[] {
  const t = defisTenus(cles)
  const rangs = (Object.keys(NOMS_DES_DEFIS) as CleDeCarte[]).flatMap(c => (cles.some(k => rangDeLaCle(k)?.carte === c) && t.rangs[c] > 0 ? [`${NOMS_DES_DEFIS[c]} · ${RANGS_DITS[t.rangs[c] as RangDUnDefi]}`] : []))
  const maitres = cles.flatMap(k => {
    const g = gardienDeLaMaitrise(k)
    return g ? [`${nomDe(g)} vaincu en maître : il est à toi`] : []
  })
  return [...rangs, ...maitres]
}

/** Les sceaux tombés, sous un bilan ou à la fin : ce que ses cartes ont tenu, ses gardiens vaincus en maître. */
function SceauxTombes({ cles, titre }: { cles: readonly string[]; titre: string }) {
  const dits = sceauxDits(cles)
  if (dits.length === 0) return null
  return (
    <section className="cab-tv-tombes" aria-label={titre}>
      <p className="cab-tv-sur">{titre}</p>
      <ul className="cab-tv-notes">
        {dits.map(d => (
          <li key={d}>{espacesFines(d)}</li>
        ))}
      </ul>
    </section>
  )
}

// ── Les mots ──

const nomDe = (cle: string) => legendaire(cle)?.nom ?? 'Le gardien'
/** « au Renard », « à la Chouette d’Argent », « à l’Oracle », « à Janus ». */
const aLui = (cle: string) =>
  nomDe(cle)
    .replace(/^Le /, 'au ')
    .replace(/^La /, 'à la ')
    .replace(/^L’/, 'à l’')
    .replace(/^(?!au |à )/, 'à ')
/** « le Renard », « la Chouette d’Argent ». */
const leGardien = (cle: string) => {
  const nom = nomDe(cle)
  return /^(Le|La|L’) /.test(nom) || nom.startsWith('L’') ? nom.charAt(0).toLowerCase() + nom.slice(1) : nom
}
const imageDuGardien = (cle: string, grande = false) => IMAGES[cle]?.rare[grande ? 0 : 1] ?? IMAGES[cle]?.art[grande ? 0 : 1] ?? ''
const pluriel = (n: number, un: string, des = `${un}s`) => `${n} ${n > 1 ? des : un}`
const piecesDites = (n: number) => pluriel(n, 'pièce')
const coeursDits = (n: number) => pluriel(n, 'cœur')

/** « la carte + », « la carte ++ » : une espace insécable devant le signe, qui partait seul à la ligne (comme `nomAuNiveau`). */
const CARTE_PLUS = 'la carte +'
const CARTE_PLUS_PLUS = 'la carte ++'

/**
 * Qui améliore tes cartes, au barème de la traversée : depuis la version 2, le coffre et le gardien vaincu jusqu'à la
 * carte +, et la carte ++ s'achète chez le marchand (`NIVEAU_OFFERT`) — une traversée commencée avant se lit à la sienne.
 */
const quiAmeliore = (v: VueDeLaTraversee['v']): string =>
  baremeDe({ v }).niveauOffert < NIVEAU_MAX
    ? `le coffre et le gardien vaincu les montent à ${CARTE_PLUS}, le marchand seul jusqu’à ${CARTE_PLUS_PLUS}`
    : 'le coffre, le gardien vaincu et le marchand les améliorent, deux fois chacune'

/** Un thème au choix d'un Quiz, comme le joueur le lit : son emoji, son nom. */
const themeDit = (c: ThemeAuChoix) => `${emojiDuTheme('quiz', c.theme, c.emoji)} ${c.theme}`

/**
 * Ce que dit une étape, comme le joueur la voit : son emoji ou son image, son titre, sa ligne — « 3 thèmes au choix »
 * au Quiz, ses thèmes en entier dans `auChoix`, que le regard et l'annonce disent.
 */
function decrire(t: VueDeLaTraversee, e: EtapeDeLaCarte): { emoji?: string; image?: string; titre: string; sous: string; quoi: string; auChoix?: string } {
  if (e.sorte === 'epreuve' && e.jeu && e.choix && e.choix.length > 0) {
    return { emoji: EMOJI_DES_JEUX[e.jeu], titre: JEUX[e.jeu].nom, sous: `${e.choix.length} thèmes au choix`, quoi: 'Épreuve', auChoix: `Au choix : ${ouBien(e.choix.map(themeDit))}` }
  }
  if (e.sorte === 'epreuve' && e.jeu) {
    const theme = e.theme ?? ''
    return { emoji: EMOJI_DES_JEUX[e.jeu], titre: JEUX[e.jeu].nom, sous: theme ? `${emojiDuTheme(e.jeu, theme, e.emoji)} ${theme}` : JEUX[e.jeu].geste, quoi: 'Épreuve' }
  }
  if (e.sorte === 'coffre') return { image: COFFRES_PEINTS.or?.ferme, titre: 'Un coffre', sous: 'Une amélioration offerte', quoi: 'Trésor' }
  if (e.sorte === 'marchand') return { emoji: '💰', titre: 'Le marchand', sous: 'Des cœurs et des améliorations', quoi: 'Boutique' }
  if (e.sorte === 'gardien') {
    const g = t.actes[acteDe(e.id)].gardien
    return { image: imageDuGardien(g), titre: nomDe(g), sous: gardienDeLaTraversee(g)?.devise ?? '', quoi: 'Gardien' }
  }
  return { titre: ACTES[acteDe(e.id)].court, sous: ACTES[acteDe(e.id)].nom, quoi: '' }
}

/** Ce que la carte 3D écrit sur une île : court, sans balise. */
function etapesDessinees(t: VueDeLaTraversee): EtapeDessinee[] {
  return t.actes.flatMap((a, k) =>
    a.etapes.map(e => {
      const d = decrire(t, e)
      const dessinee: EtapeDessinee = {
        id: e.id,
        acte: k,
        rangee: e.rangee,
        colonne: e.colonne,
        sorte: e.sorte,
        titre: d.titre,
        // Au Quiz, ses thèmes au choix d'abord : ils font le thème de l'étape (`themeDeLEtape`), même si elle en portait un.
        sous: e.sorte === 'gardien' ? `Gardien · ${ACTES[k].court}` : e.sorte === 'epreuve' ? (e.choix ? d.sous : (e.theme ?? '')) : d.sous,
        suivantes: e.suivantes,
      }
      if (d.emoji) dessinee.emoji = d.emoji
      if (e.sorte === 'gardien') dessinee.image = imageDuGardien(a.gardien)
      if (e.sorte === 'coffre') {
        dessinee.image = COFFRES_PEINTS.or?.ferme
        dessinee.imageOuverte = COFFRES_PEINTS.or?.ouvert
      }
      return dessinee
    }),
  )
}

const etapeDe = (t: VueDeLaTraversee, id: string): EtapeDeLaCarte | undefined => t.actes[acteDe(id)]?.etapes.find(e => e.id === id)

/** « le Pari », « l’Éclair », « le coffre », « le Renard » : une étape nommée au fil d'une phrase. */
function nommer(t: VueDeLaTraversee, e: EtapeDeLaCarte): string {
  const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
  if (e.sorte === 'epreuve' && e.jeu) return minuscule(JEUX[e.jeu].nom)
  if (e.sorte === 'coffre') return 'le coffre'
  if (e.sorte === 'marchand') return 'le marchand'
  if (e.sorte === 'gardien') return leGardien(t.actes[acteDe(e.id)].gardien)
  return minuscule(ACTES[acteDe(e.id)].court)
}

/** « le Pari », « le Pari ou l’Éclair », « le Pari, l’Éclair ou le coffre ». */
const ouBien = (mots: readonly string[]) => (mots.length < 2 ? (mots[0] ?? '') : `${mots.slice(0, -1).join(', ')} ou ${mots[mots.length - 1]}`)

/**
 * Par où mène le chemin d'une étape lointaine touchée sur la carte, en mots — par
 * celles d'à côté qui y mènent (`cheminsVers`), ou pourquoi aucune n'y mène : on
 * choisit son chemin d'après ce qui attend plus loin (le retour du propriétaire,
 * le 1er novembre 2026).
 */
function parOu(t: VueDeLaTraversee, e: EtapeDeLaCarte): string {
  const a = acteDe(e.id)
  if (t.visitees.includes(e.id)) return 'Déjà traversée'
  if (a < t.acte) return 'Derrière toi'
  if (a > t.acte) {
    const acte = ACTES[a].court.replace('Acte ', 'acte ')
    return a === t.acte + 1 ? `À l’${acte}, après ${leGardien(t.actes[t.acte].gardien)}` : `À l’${acte}`
  }
  const par = cheminsVers(t, t.atteignables, e.id)
  if (par.length === 0) return e.rangee <= (etapeDe(t, t.position)?.rangee ?? 0) ? 'Derrière toi' : 'Aucun de tes chemins n’y mène'
  if (par.length > 1 && par.length === t.atteignables.length) return 'Tous tes chemins y mènent'
  return `Par ${ouBien(par.flatMap(id => etapeDe(t, id) ?? []).map(x => nommer(t, x)))}`
}

// ── La carte en 3D ──

/** La scène, montée une fois, nourrie de la vue ; sans WebGL ou perdue en route, un ciel de nuit en CSS. */
function CarteEn3D({
  traversee,
  mode,
  selection,
  regard = null,
  coffresOuverts,
  onToucher,
  scene,
}: {
  traversee: VueDeLaTraversee | null
  mode: 'titre' | 'carte'
  selection: string | null
  regard?: string | null
  coffresOuverts: readonly string[]
  /** L'île touchée ; null : le ciel. */
  onToucher: (id: string | null) => void
  scene: React.MutableRefObject<SceneDeLaTraversee | null>
}) {
  const [troisD] = useState(webglPossible)
  const module = useALaDemande(LA_CARTE_EN_3D, troisD)
  const boite = useRef<HTMLDivElement>(null)
  const toucherRef = useRef(onToucher)
  toucherRef.current = onToucher
  const construite = useRef<string | null>(null)
  useEffect(() => {
    if (!module || module === 'perdu' || !boite.current) return
    let s: SceneDeLaTraversee | null = null
    // Ce que le panneau du bas couvre : la carte vit au-dessus de lui.
    const couvert = () => {
      const panneau = boite.current?.parentElement?.querySelector('.cab-tv-panneau')
      return panneau ? panneau.getBoundingClientRect().height + 12 : 0
    }
    try {
      s = module.creerLaTraversee(boite.current, { toucher: id => toucherRef.current(id), couvert })
    } catch {
      // Un contexte WebGL refusé au dernier moment : la page garde son ciel en CSS.
      return
    }
    scene.current = s
    return () => {
      s?.detruire()
      scene.current = null
      construite.current = null
    }
  }, [module, scene])
  const cle = traversee?.id ?? null
  useEffect(() => {
    const s = scene.current
    if (!s) return
    if (construite.current !== cle) {
      s.construire(traversee ? etapesDessinees(traversee) : [], ACTES.map(a => a.teinte))
      construite.current = cle
    }
    if (traversee) {
      s.maj({
        mode,
        acte: traversee.acte,
        position: traversee.position,
        visitees: traversee.visitees,
        atteignables: mode === 'carte' ? traversee.atteignables : [],
        selection,
        regard: mode === 'carte' ? regard : null,
        coffresOuverts,
      })
    }
  }, [module, cle, traversee, mode, selection, regard, coffresOuverts, scene])
  return <div ref={boite} className="cab-tv-scene" aria-hidden="true" />
}

// ── La traversée ──

export interface PropsDeLaTraversee {
  page: PageDeLaTraversee
  busy: boolean
  /** Une traversée neuve : sa carte et ses trois gardiens. */
  onCommencer: () => void
  /** Un geste, à son rang : la page d'après, ou null (refusé, dit en toast, la page relue). */
  onGeste: (geste: Record<string, unknown>) => Promise<PageDeLaTraversee | null>
  onRegles: () => void
  /** L'épreuve quittée un instant : son écran de partie se rouvre. */
  onReprendre: () => void
}

type Feuilles = 'cartes' | 'menu' | null

/**
 * Ce que la page a déjà montré d'une traversée — un bilan lu, un coffre ouvert —,
 * le temps de l'onglet (`sessionStorage`, sous try/catch : un stockage refusé ne
 * casse rien, la page le remontre) : rechargée sur la carte, elle ne redit pas
 * le bilan d'une épreuve lue il y a dix minutes.
 */
const CLE_DES_VUS = (id: string) => `quizz.cabinet.traversee-vue.${id}`
function lireLesVus(id: string | null): ReadonlySet<string> {
  if (!id) return new Set()
  try {
    const t = sessionStorage.getItem(CLE_DES_VUS(id))
    const l: unknown = t ? JSON.parse(t) : []
    return new Set(Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}
function retenirLesVus(id: string, vus: ReadonlySet<string>) {
  try {
    sessionStorage.setItem(CLE_DES_VUS(id), JSON.stringify([...vus].slice(-60)))
  } catch {
    // Un stockage refusé : la page remontrera ce qu'elle a déjà montré, rien de plus.
  }
}

export function Traversee({ page, busy, onCommencer, onGeste, onRegles, onReprendre }: PropsDeLaTraversee) {
  const t = page.traversee
  // Ce qu'il tient des défis de ses cartes, toutes traversées confondues : le dos de chaque carte le dit.
  const defis = page.defis ?? AUCUN_DEFI
  const sceneRef = useRef<SceneDeLaTraversee | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  // L'étape lointaine touchée sur la carte : le panneau dit ce qu'elle est et par où y aller ; elle ne se choisit pas.
  const [regard, setRegard] = useState<string | null>(null)
  // L'étape où la comète vient d'arriver, une épreuve ou son gardien : son annonce attend « Commencer », qui seul y entre.
  const [arrivee, setArrivee] = useState<string | null>(null)
  const [vus, setVus] = useState<ReadonlySet<string>>(() => lireLesVus(t?.id ?? null))
  const [feuille, setFeuille] = useState<Feuilles>(null)
  const [choixDesCartes, setChoixDesCartes] = useState(false)
  const [choix, setChoix] = useState<CleDeCarte[]>([])
  const [enVoyage, setEnVoyage] = useState(false)
  // L'acte que la page a déjà annoncé : un acte neuf vole vers son archipel et dit son nom, une fois.
  const [acteAnnonce, setActeAnnonce] = useState<string | null>(null)
  const [carton, setCarton] = useState<number | null>(null)
  const id = t?.id ?? null
  const voir = useCallback(
    (cle: string) =>
      setVus(v => {
        const neufs = new Set(v).add(cle)
        if (id) retenirLesVus(id, neufs)
        return neufs
      }),
    [id],
  )

  // Une traversée neuve repart de rien : rien de vu, rien de choisi.
  useEffect(() => {
    setSelection(null)
    setArrivee(null)
    setChoix([])
    setChoixDesCartes(false)
    setVus(lireLesVus(id))
  }, [id])
  // Un pas de plus, et ce qu'il regardait se dit autrement : le regard se range.
  const position = t?.position ?? null
  useEffect(() => setRegard(null), [id, position])

  const coffresOuverts = useMemo(() => (t ? t.visitees.filter(v => etapeDe(t, v)?.sorte === 'coffre') : []), [t])

  // L'acte neuf : la comète vole par le pont de lumière, puis son nom paraît.
  const cleDeLActe = t && t.ou.sorte !== 'cartes' && !t.fin ? `${t.id}:${t.acte}` : null
  useEffect(() => {
    if (!cleDeLActe || acteAnnonce === cleDeLActe || !t) return
    setActeAnnonce(cleDeLActe)
    setCarton(t.acte)
    const s = sceneRef.current
    if (t.acte > 0 && s) {
      setEnVoyage(true)
      void s.volerVersLActe(t.acte).finally(() => setEnVoyage(false))
    }
    const fin = setTimeout(() => setCarton(null), 2600)
    return () => clearTimeout(fin)
  }, [cleDeLActe, acteAnnonce, t])

  const geste = async (g: Record<string, unknown>) => {
    if (busy) return null
    return onGeste(g)
  }

  /** « Y aller » : la comète part ; une épreuve et son gardien s'annoncent à l'arrivée, le coffre et le marchand s'ouvrent. */
  const yAller = async (etape: string) => {
    if (!t || busy || enVoyage) return
    const e = etapeDe(t, etape)
    if (!e) return
    setSelection(null)
    setRegard(null)
    const s = sceneRef.current
    if (s && etape !== t.position) {
      setEnVoyage(true)
      await s.voyager(t.position, etape).catch(() => {})
      setEnVoyage(false)
    }
    if (e.sorte === 'epreuve' || e.sorte === 'gardien') {
      setArrivee(etape)
      return
    }
    const apres = await geste({ quoi: 'aller', etape })
    if (!apres) s?.sauterA(t.position)
  }

  if (!t) {
    return (
      <EcranDeTitre
        page={page}
        busy={busy}
        onCommencer={onCommencer}
        onRegles={onRegles}
        carte={<CarteEn3D traversee={null} mode="titre" selection={null} coffresOuverts={[]} onToucher={() => {}} scene={sceneRef} />}
      />
    )
  }
  /** Une île touchée : atteignable, elle se choisit ; plus loin, elle se regarde — touchée encore, ou le ciel, le regard se range. */
  const toucherLaCarte = (etape: string | null) => {
    if (etape !== null && t.atteignables.includes(etape)) setSelection(etape)
    else setRegard(r => (etape === null || etape === r || etape === t.position ? null : etape))
  }
  const scene = (
    <CarteEn3D
      traversee={t}
      mode={t.ou.sorte === 'cartes' || t.fin ? 'titre' : 'carte'}
      selection={selection}
      regard={regard}
      coffresOuverts={coffresOuverts}
      onToucher={toucherLaCarte}
      scene={sceneRef}
    />
  )

  // La fin, puis ce qui n'a pas encore été lu : le bilan de la dernière épreuve d'abord — il dit ce qu'elle a coûté.
  const bilanALire = t.derniere && !vus.has(`bilan:${t.derniere.partie}`) ? t.derniere : null
  let plein: ReactNode = null
  if (bilanALire) plein = <BilanDEpreuve t={t} b={bilanALire} onContinuer={() => voir(`bilan:${bilanALire.partie}`)} />
  else if (t.fin) plein = <FinDeLaTraversee t={t} possedes={page.possedes} busy={busy} onCommencer={onCommencer} />
  else if (t.ou.sorte === 'cartes')
    plein = choixDesCartes ? (
      <ChoixDesCartes
        v={t.v}
        defis={defis}
        choix={choix}
        busy={busy}
        onChoisir={cle => setChoix(c => (c.includes(cle) ? c.filter(x => x !== cle) : c.length < CARTES_D_UNE_TRAVERSEE ? [...c, cle] : c))}
        onRetour={() => setChoixDesCartes(false)}
        onPartir={() => void geste({ quoi: 'cartes', cartes: choix })}
      />
    ) : null
  else if (t.ou.sorte === 'legendaire') plein = <ChoixDuLegendaire t={t} possedes={page.possedes} busy={busy} onChoisir={g => void geste({ quoi: 'legendaire', gardien: g })} />
  else if (t.ameliorations > 0) plein = <Amelioration t={t} busy={busy} onAmeliorer={c => void geste({ quoi: 'ameliorer', carte: c })} />
  else if ((t.ou.sorte === 'epreuve' || t.ou.sorte === 'gardien') && t.ou.partie !== null) plein = <EpreuveEnAttente t={t} onReprendre={onReprendre} />
  // L'annonce de l'étape où la comète vient d'arriver passe devant l'étape qu'il quitte — le marchand, un coffre ouvert.
  else if (arrivee && etapeDe(t, arrivee)) {
    const e = etapeDe(t, arrivee)!
    // Y entrer commence sa partie : l'annonce s'efface — elle ne revient pas au retour sur la carte. Au Quiz, avec le thème choisi.
    const entrer = (theme?: number) =>
      void geste({ quoi: 'aller', etape: arrivee, ...(theme !== undefined && { theme }) }).then(p => {
        if (p) setArrivee(null)
      })
    plein =
      e.sorte === 'gardien' ? (
        <AnnonceDuGardien t={t} etape={arrivee} maitrises={defis.maitrises} busy={busy} onAffronter={() => entrer()} onRetour={() => retourALaCarte(arrivee)} />
      ) : (
        <AnnonceDeLEpreuve t={t} e={e} busy={busy} onCommencer={entrer} onRetour={() => retourALaCarte(arrivee)} />
      )
  } else if (t.ou.sorte === 'coffre' && !vus.has(`coffre:${t.ou.etape}`)) plein = <CoffreOuvert t={t} onContinuer={() => voir(`coffre:${t.ou.sorte === 'coffre' ? t.ou.etape : ''}`)} />
  else if (t.ou.sorte === 'marchand')
    plein = (
      <Marchand
        t={t}
        busy={busy}
        onAcheter={(article, carte) => void geste({ quoi: 'acheter', article, ...(carte && { carte }) })}
        onPartir={() => void yAller(t.atteignables[0])}
      />
    )
  else if (t.ou.sorte === 'gardien' && t.ou.partie === null)
    plein = <AnnonceDuGardien t={t} etape={t.ou.etape} maitrises={defis.maitrises} busy={busy} onAffronter={() => void geste({ quoi: 'aller', etape: t.ou.sorte === 'gardien' ? t.ou.etape : '' })} />

  /** Renoncer à l'annonce : la comète revient où il était, rien n'est joué. */
  function retourALaCarte(etape: string) {
    setArrivee(null)
    if (t) sceneRef.current?.sauterA(t.position)
    void etape
  }

  return (
    <div className="cab-tv" style={{ ['--cab-tv-teinte' as string]: String(ACTES[t.acte].teinte) }}>
      {scene}
      {!plein && t.ou.sorte === 'cartes' && <LesGardiens t={t} possedes={page.possedes} maitrises={defis.maitrises} onChoisirLesCartes={() => setChoixDesCartes(true)} />}
      {!plein && t.ou.sorte !== 'cartes' && (
        <LaCarte
          t={t}
          selection={selection}
          regard={regard}
          busy={busy || enVoyage}
          carton={carton}
          onSelection={setSelection}
          onRangerLeRegard={() => setRegard(null)}
          onYAller={id => void yAller(id)}
          onFeuille={setFeuille}
        />
      )}
      {plein && <div className="cab-tv-plein">{plein}</div>}
      {feuille === 'cartes' && (
        <Feuille titre="Tes cartes" className="cab-tv-feuille" onFermer={() => setFeuille(null)}>
          <div className="cab-tv-cartes cab-tv-trois">
            {t.cartes.map(c => (
              <CarteDeLaTraversee
                key={c.cle}
                cle={c.cle}
                niveau={c.niveau}
                v={t.v}
                etiquette={c.cle === 'second-souffle' && t.souffle ? 'Déjà servie' : undefined}
                dos={<DosDeLaCarte cle={c.cle} rang={defis.rangs[c.cle]} />}
                doree={defis.rangs[c.cle] >= 2}
              />
            ))}
          </div>
        </Feuille>
      )}
      {feuille === 'menu' && (
        <Feuille titre="La traversée" className="cab-tv-feuille" onFermer={() => setFeuille(null)}>
          <div className="cab-tv-menu">
            <button
              type="button"
              className="btn btn-block"
              {...toucher(() => {
                setFeuille(null)
                onRegles()
              })}
            >
              Comment ça marche ?
            </button>
            <button
              type="button"
              className="btn btn-block cab-tv-danger"
              {...toucher(async () => {
                const oui = await confirmDialog({
                  title: 'Abandonner la traversée ?',
                  message: 'Elle s’arrête ici : tu repartiras de l’acte I, avec des gardiens neufs.',
                  confirmLabel: 'Abandonner',
                  cancelLabel: 'Continuer',
                  prudent: true,
                })
                setFeuille(null)
                if (oui) await geste({ quoi: 'abandonner' })
              })}
            >
              Abandonner la traversée
            </button>
          </div>
        </Feuille>
      )}
    </div>
  )
}

// ── L'écran-titre ──

function EcranDeTitre({ page, busy, carte, onCommencer, onRegles }: { page: PageDeLaTraversee; busy: boolean; carte: ReactNode; onCommencer: () => void; onRegles: () => void }) {
  void page
  return (
    <div className="cab-tv">
      {carte}
      <div className="cab-tv-ui">
        <header className="cab-tv-titre">
          <Sortie />
          <p className="cab-tv-sur">Le Cabinet de curiosités</p>
          <h1>Trois actes, trois gardiens</h1>
          <p>{espacesFines('Choisis ton chemin sur la carte, joue, gagne de l’or ; bats les trois gardiens : l’un d’eux sera à toi.')}</p>
        </header>
        <div className="cab-tv-vide" />
        <div className="cab-tv-panneau">
          <section className="cab-tv-verre">
            <ul className="cab-tv-quatre">
              <li>
                <Coeurs n={1} max={1} />
                <span>
                  <b>Les cœurs</b> — une manche ratée en coûte un
                </span>
              </li>
              <li>
                <Piece />
                <span>
                  <b>L’or</b> — chaque étoile en rapporte, le marchand le prend
                </span>
              </li>
              <li>
                <span aria-hidden="true">🃏</span>
                <span>
                  <b>Tes cartes</b> — trois, choisies au départ, à améliorer
                </span>
              </li>
              <li>
                <span aria-hidden="true">🗺️</span>
                <span>
                  <b>La carte</b> — chaque chemin, un jeu et un thème
                </span>
              </li>
            </ul>
            <button type="button" className="cab-tv-cta" aria-disabled={busy || undefined} {...toucher(() => !busy && onCommencer())}>
              Commencer une traversée
            </button>
            <button type="button" className="cab-tv-lien" {...toucher(onRegles)}>
              Comment ça marche ?
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Les trois gardiens, puis les cartes ──

function LesGardiens({ t, possedes, maitrises, onChoisirLesCartes }: { t: VueDeLaTraversee; possedes: readonly string[]; maitrises: readonly string[]; onChoisirLesCartes: () => void }) {
  return (
    <div className="cab-tv-ui">
      <header className="cab-tv-titre">
        <Sortie />
        <p className="cab-tv-sur">Ta traversée</p>
        <h1>Trois gardiens t’attendent</h1>
      </header>
      <div className="cab-tv-vide" />
      <div className="cab-tv-panneau">
        <section className="cab-tv-verre">
          <ul className="cab-tv-trio">
            {t.actes.map((a, k) => (
              <li key={a.gardien}>
                <img src={imageDuGardien(a.gardien)} alt="" />
                <b>{nomDe(a.gardien)}</b>
                <small>{possedes.includes(a.gardien) ? 'Déjà à toi' : ACTES[k].court}</small>
              </li>
            ))}
          </ul>
          <p className="cab-tv-pale">{espacesFines('Bats-les tous les trois : l’un d’eux sera à toi, un avatar légendaire.')}</p>
          {/* Leurs épreuves de maître, dites avant le choix des cartes : certaines s'y préparent — une mise, le Second souffle. */}
          <ul className="cab-tv-notes cab-tv-maitrises" aria-label="Leurs épreuves de maître">
            {t.actes.map(a => (
              <li key={a.gardien}>
                <b>{nomDe(a.gardien)}</b> {espacesFines(maitrises.includes(a.gardien) ? 'déjà vaincu en maître' : `${(maitriseDite(a.gardien) ?? '').replace(/^Le vaincre/, 'à vaincre')} : il est à toi aussitôt`)}
              </li>
            ))}
          </ul>
          <button type="button" className="cab-tv-cta" {...toucher(onChoisirLesCartes)}>
            Choisir mes trois cartes
          </button>
        </section>
      </div>
    </div>
  )
}

function ChoixDesCartes({
  v,
  defis,
  choix,
  busy,
  onChoisir,
  onRetour,
  onPartir,
}: {
  v: VueDeLaTraversee['v']
  defis: DefisTenus
  choix: readonly CleDeCarte[]
  busy: boolean
  onChoisir: (cle: CleDeCarte) => void
  onRetour: () => void
  onPartir: () => void
}) {
  const complet = choix.length === CARTES_D_UNE_TRAVERSEE
  return (
    <div className="cab-tv-ecran">
      <div className="cab-tv-colonne">
        <Sortie vers="Tes gardiens" href="/cabinet" onClick={onRetour} />
        <header className="cab-tv-tete-ecran">
          <p className="cab-tv-sur">Avant de partir</p>
          <h2 tabIndex={-1}>Choisis trois cartes</h2>
          <p className="cab-tv-pale">{espacesFines(`Ce sont les seules de ta traversée : ${quiAmeliore(v)}. Au dos de chacune, un défi : il ne compte que si elle est dans ta main.`)}</p>
        </header>
        <div className="cab-tv-cartes">
          {CARTES.map(c => (
            <CarteDeLaTraversee
              key={c.cle}
              cle={c.cle}
              niveau={1}
              v={v}
              prise={choix.includes(c.cle)}
              inerte={!choix.includes(c.cle) && complet}
              action={() => onChoisir(c.cle)}
              dos={<DosDeLaCarte cle={c.cle} rang={defis.rangs[c.cle]} />}
              doree={defis.rangs[c.cle] >= 2}
            />
          ))}
        </div>
      </div>
      <div className="cab-tv-pied">
        <button type="button" className="cab-tv-cta" aria-disabled={!complet || busy || undefined} {...toucher(() => complet && !busy && onPartir())}>
          {complet ? 'Partir' : `Encore ${CARTES_D_UNE_TRAVERSEE - choix.length} à choisir`}
          <small>{`${choix.length} sur ${CARTES_D_UNE_TRAVERSEE}`}</small>
        </button>
      </div>
    </div>
  )
}

// ── La carte : la tête, et le chemin à choisir ──

function LaCarte({
  t,
  selection,
  regard,
  busy,
  carton,
  onSelection,
  onRangerLeRegard,
  onYAller,
  onFeuille,
}: {
  t: VueDeLaTraversee
  selection: string | null
  regard: string | null
  busy: boolean
  carton: number | null
  onSelection: (id: string) => void
  onRangerLeRegard: () => void
  onYAller: (id: string) => void
  onFeuille: (f: Feuilles) => void
}) {
  const options = t.atteignables.map(id => etapeDe(t, id)).filter((e): e is EtapeDeLaCarte => !!e)
  const choisie = selection && t.atteignables.includes(selection) ? selection : options.length === 1 ? options[0].id : null
  const e = choisie ? etapeDe(t, choisie) : undefined
  const surLePont = etapeDe(t, t.position)?.rangee === 0 && t.acte > 0 && t.visitees[t.visitees.length - 1] === t.position
  const regardee = regard ? etapeDe(t, regard) : undefined
  // Les options d'où part la route vers l'étape regardée : leur bord se fait pointillé d'or, comme ses tirets sur la carte.
  const versLeRegard = new Set(regardee && options.length > 1 ? cheminsVers(t, t.atteignables, regardee.id) : [])
  return (
    <div className="cab-tv-ui">
      <header className="cab-tv-hud">
        {/* Le retour à l'accueil en haut à gauche, comme partout dans l'application (`Sortie`) : il ne passait que par le menu, en
            haut à droite (le retour du propriétaire, le 1er novembre 2026). Le nom de l'acte est descendu dans le panneau. */}
        <div className="cab-tv-hud-ligne">
          <Sortie />
          <span className="cab-tv-grand" />
          <button type="button" className="cab-tv-hud-bouton cab-tv-rond" aria-label="Menu" {...toucher(() => onFeuille('menu'))}>
            <Icon name="more" />
          </button>
        </div>
        <div className="cab-tv-hud-ligne">
          <Coeurs n={t.coeurs} max={t.coeursMax} />
          <Bourse or={t.or} />
          <span className="cab-tv-grand" />
          <button type="button" className="cab-tv-hud-bouton cab-tv-hud-cartes" aria-label="Tes cartes" {...toucher(() => onFeuille('cartes'))}>
            <img src={CARTES_PEINTES[t.cartes[0]?.cle]?.[1]} alt="" />
            <span>Cartes</span>
          </button>
        </div>
      </header>
      {carton !== null && (
        <p className="cab-tv-carton" role="status">
          <span className="cab-tv-sur">{ACTES[carton].court}</span>
          <b>{ACTES[carton].nom}</b>
        </p>
      )}
      <div className="cab-tv-vide" />
      <div className="cab-tv-panneau">
        <section className="cab-tv-verre" aria-labelledby="cab-tv-chemin">
          {/* L'étape regardée prend la place du nom de l'acte : ajoutée au panneau, elle le grandissait, la carte remontait d'autant,
              et l'île qu'on venait de toucher passait dessous (le rendu du 1er novembre 2026, en 360 × 640). */}
          {regardee ? (
            <RegardSurLaCarte t={t} e={regardee} onRanger={onRangerLeRegard} />
          ) : (
            <p className="cab-tv-sur">{`${ACTES[t.acte].court} · ${ACTES[t.acte].nom}`}</p>
          )}
          <h2 id="cab-tv-chemin">{surLePont ? 'Un nouvel acte commence' : options.length > 1 ? 'Choisis ton chemin' : 'La suite du chemin'}</h2>
          <div className="cab-tv-options">
            {options.map(o => {
              const d = decrire(t, o)
              return (
                <button
                  key={o.id}
                  type="button"
                  className={'cab-tv-option' + (o.sorte === 'gardien' ? ' cab-tv-option-gardien' : '') + (versLeRegard.has(o.id) ? ' cab-tv-mene' : '')}
                  aria-pressed={choisie === o.id}
                  {...toucher(() => onSelection(o.id))}
                >
                  <span className="cab-tv-ic" aria-hidden="true">
                    {d.image ? <img src={d.image} alt="" /> : d.emoji}
                  </span>
                  <span className="cab-tv-txt">
                    <b>{d.titre}</b>
                    <small>{espacesFines(d.sous)}</small>
                  </span>
                  <span className="cab-tv-quoi">{d.quoi}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="cab-tv-cta"
            aria-disabled={!e || busy || undefined}
            {...toucher(() => {
              if (e && !busy) onYAller(e.id)
            })}
          >
            {e ? (e.sorte === 'epreuve' ? `Jouer ${JEUX[e.jeu ?? 'pari'].a}` : e.sorte === 'coffre' ? 'Ouvrir le coffre' : e.sorte === 'marchand' ? 'Entrer chez le marchand' : `Affronter ${leGardien(t.actes[t.acte].gardien)}`) : 'Choisis une étape'}
          </button>
        </section>
      </div>
    </div>
  )
}

/**
 * L'étape lointaine touchée sur la carte, dans le panneau : ce qu'elle est — son
 * jeu et son thème, le coffre, le marchand, le gardien — et par où y aller.
 * Elle ne se choisit pas : seules les étapes d'à côté s'atteignent. Dite à
 * l'oreille (`role="status"`) : la carte, elle, est décorative.
 */
function RegardSurLaCarte({ t, e, onRanger }: { t: VueDeLaTraversee; e: EtapeDeLaCarte; onRanger: () => void }) {
  const d = decrire(t, e)
  return (
    <div className="cab-tv-regard" role="status">
      <span className="cab-tv-ic" aria-hidden="true">
        {d.image ? <img src={d.image} alt="" /> : (d.emoji ?? '✦')}
      </span>
      <span className="cab-tv-txt">
        <b>{d.titre}</b>
        {(d.auChoix ?? d.sous) && <span className="cab-tv-pale">{espacesFines(d.auChoix ?? d.sous)}</span>}
        <small>{espacesFines(parOu(t, e))}</small>
      </span>
      <button type="button" className="cab-tv-regard-ranger" aria-label="Ne plus regarder cette étape" {...toucher(onRanger)}>
        <Icon name="x" />
      </button>
    </div>
  )
}

// ── L'annonce d'une épreuve, d'un gardien ──

/**
 * Ce que tes cartes font à cette épreuve, une ligne chacune : celles qui y jouent — pas la Panacée ni le Pourboire, ni
 * ce qui ne vise qu'un gardien, ni la Parade contre un gardien sous le niveau où elle le pare (celui de sa version).
 */
function ceQueFontTesCartes(t: Pick<VueDeLaTraversee, 'cartes' | 'v'>, gardien: boolean): { nom: string; dit: string }[] {
  return t.cartes.flatMap(c => {
    const carte = carteDeLaTraversee(c.cle)
    if (!carte) return []
    if (c.cle === 'parade' && gardien && c.niveau < baremeDe(t).parade.contreLesGardiens) return []
    if (c.cle === 'pourboire' || c.cle === 'panacee' || (c.cle === 'coup-de-grace' && !gardien)) return []
    return [{ nom: nomAuNiveau(carte, c.niveau), dit: carte.dit(c.niveau, t.v) }]
  })
}

/** Les lignes de tes cartes, sous une annonce : son nom en or, puis ce qu'elle fait. */
function NotesDesCartes({ cartes }: { cartes: readonly { nom: string; dit: string }[] }) {
  if (cartes.length === 0) return null
  return (
    <ul className="cab-tv-notes">
      {cartes.map(l => (
        <li key={l.nom}>
          <b>{l.nom}</b> {espacesFines(l.dit)}
        </li>
      ))}
    </ul>
  )
}

/**
 * L'annonce d'une épreuve : son jeu, son thème, ce qu'elle rapporte et coûte. Au Quiz, ses thèmes au choix d'abord —
 * « Commencer » attend le sien : choisir son thème, c'est choisir ce qu'on sait (le propriétaire, le 1er novembre 2026).
 */
function AnnonceDeLEpreuve({
  t,
  e,
  busy,
  onCommencer,
  onRetour,
}: {
  t: VueDeLaTraversee
  e: EtapeDeLaCarte
  busy: boolean
  onCommencer: (theme?: number) => void
  onRetour: () => void
}) {
  const jeu = e.jeu ?? 'pari'
  const j = JEUX[jeu]
  const cartes = ceQueFontTesCartes(t, false)
  const choix = e.choix && e.choix.length > 0 ? e.choix : null
  const [choisi, setChoisi] = useState<number | null>(null)
  const pret = !choix || choisi !== null
  const surtitre = choix ? (choisi !== null ? themeDit(choix[choisi]) : `${choix.length} thèmes au choix`) : e.theme ? `${emojiDuTheme(jeu, e.theme, e.emoji)} ${e.theme}` : 'Épreuve'
  return (
    <div className="cab-tv-ecran">
      <div className="cab-tv-colonne cab-tv-annonce">
        <Sortie vers="La carte" href="/cabinet" onClick={onRetour} />
        <span className="cab-tv-grand-ic" aria-hidden="true">
          {EMOJI_DES_JEUX[jeu]}
        </span>
        <p className="cab-tv-sur">{surtitre}</p>
        <h2 tabIndex={-1}>{j.nom}</h2>
        <p className="cab-tv-geste">{espacesFines(j.geste)}</p>
        {choix && (
          <div className="cab-tv-options cab-tv-themes" role="group" aria-labelledby="cab-tv-themes">
            <p id="cab-tv-themes" className="cab-tv-sur">
              Choisis ton thème
            </p>
            {choix.map((c, k) => (
              <button key={`${k}:${c.theme}`} type="button" className="cab-tv-option" aria-pressed={choisi === k} {...toucher(() => setChoisi(k))}>
                <span className="cab-tv-ic" aria-hidden="true">
                  {emojiDuTheme(jeu, c.theme, c.emoji)}
                </span>
                <span className="cab-tv-txt">
                  <b>{espacesFines(c.theme)}</b>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="cab-tv-bareme">
          <div>
            <span>Une manche parfaite</span>
            <b>
              <Piece /> {orDUneManche(t, 3, t.cartes)}
            </b>
          </div>
          <div>
            <span>Chaque étoile</span>
            <b>
              <Piece /> {baremeDe(t).orParEtoile}
            </b>
          </div>
          <div className="cab-tv-ko">
            <span>Une manche ratée</span>
            <b>
              −1 <Coeurs n={1} max={1} />
            </b>
          </div>
        </div>
        <p className="cab-tv-pale">{espacesFines(`Trois manches : ${j.bareme}.`)}</p>
        <NotesDesCartes cartes={cartes} />
      </div>
      <div className="cab-tv-pied">
        <button
          type="button"
          className="cab-tv-cta"
          aria-disabled={busy || !pret || undefined}
          {...toucher(() => {
            if (!busy && pret) onCommencer(choisi ?? undefined)
          })}
        >
          {pret ? 'Commencer' : 'Choisis ton thème'}
          <small>{espacesFines('Le chrono part à la première manche')}</small>
        </button>
      </div>
    </div>
  )
}

function AnnonceDuGardien({
  t,
  etape,
  maitrises,
  busy,
  onAffronter,
  onRetour,
}: {
  t: VueDeLaTraversee
  etape: string
  maitrises: readonly string[]
  busy: boolean
  onAffronter: () => void
  onRetour?: () => void
}) {
  const a = acteDe(etape)
  const g = t.actes[a].gardien
  const fiche = gardienDeLaTraversee(g)
  const pv = t.pv ?? { restent: pvDuGardien(t, a, t.cartes), max: pvDuGardien(t, a, t.cartes) }
  const assaut = t.assauts + 1
  const jeu = jeuDeLAssaut(g, assaut) ?? 'pari'
  const cartes = ceQueFontTesCartes(t, true)
  const mise = t.cartes.find(c => c.cle === 'quitte-ou-double')
  return (
    <div className="cab-tv-ecran cab-tv-ecran-gardien">
      <div className="cab-tv-colonne cab-tv-annonce">
        {onRetour && <Sortie vers="La carte" href="/cabinet" onClick={onRetour} />}
        <p className="cab-tv-sur">{`Le gardien de l’${ACTES[a].court.replace('Acte ', 'acte ')}`}</p>
        <div className="cab-tv-portrait">
          <img src={imageDuGardien(g, true)} alt="" />
        </div>
        <h2 tabIndex={-1}>{nomDe(g)}</h2>
        {fiche && <p className="cab-tv-devise">{espacesFines(fiche.devise)}</p>}
        <PointsDeVie pv={pv.restent} max={pv.max} />
        {maitriseDite(g) && (
          <p className="cab-tv-maitrise">
            <b>Épreuve de maître</b> {espacesFines(maitrises.includes(g) ? `· déjà réussie — ${maitriseDite(g)}` : `· ${maitriseDite(g)} : il est à toi aussitôt, quoi qu’il arrive ensuite.`)}
          </p>
        )}
        <div className="cab-tv-regle-gardien">
          <p>
            <b>{t.assauts > 0 ? `Assaut ${assaut}` : 'Le combat'}</b>
            {` · ${EMOJI_DES_JEUX[jeu]} ${JEUX[jeu].nom}`}
          </p>
          <p>{espacesFines(`Chaque étoile que tu gagnes lui retire un point de vie${mise ? ` — ${MULTIPLICATEUR_DE_LA_MISE[mise.niveau]} sous une mise` : ''}. Chaque manche ratée te coûte un cœur.`)}</p>
          <p>{espacesFines(`Vaincu : ${piecesDites(OR_D_UN_GARDIEN)}, tes cœurs au complet${a < 2 ? ', et une amélioration' : ''}.`)}</p>
        </div>
        <NotesDesCartes cartes={cartes} />
      </div>
      <div className="cab-tv-pied">
        <div className="cab-tv-ressources">
          <Coeurs n={t.coeurs} max={t.coeursMax} />
          <Bourse or={t.or} />
        </div>
        <button type="button" className="cab-tv-cta" aria-disabled={busy || undefined} {...toucher(() => !busy && onAffronter())}>
          {t.assauts > 0 ? 'Assaut suivant' : `Affronter ${leGardien(g)}`}
        </button>
      </div>
    </div>
  )
}

/** Une épreuve quittée un instant : elle attend où il l'a laissée, son chrono compris. */
function EpreuveEnAttente({ t, onReprendre }: { t: VueDeLaTraversee; onReprendre: () => void }) {
  const ou = t.ou
  const etape = ou.sorte === 'epreuve' || ou.sorte === 'gardien' ? etapeDe(t, ou.etape) : undefined
  const jeu = t.partie?.jeu ?? etape?.jeu
  const gardien = etape?.sorte === 'gardien' ? t.actes[acteDe(etape.id)].gardien : null
  return (
    <div className="cab-tv-ecran">
      <div className="cab-tv-colonne cab-tv-annonce">
        {gardien ? (
          <div className="cab-tv-portrait">
            <img src={imageDuGardien(gardien, true)} alt="" />
          </div>
        ) : (
          jeu && (
            <span className="cab-tv-grand-ic" aria-hidden="true">
              {EMOJI_DES_JEUX[jeu]}
            </span>
          )
        )}
        <p className="cab-tv-sur">{gardien ? `Contre ${leGardien(gardien)}` : 'Ton épreuve'}</p>
        <h2 tabIndex={-1}>{jeu ? JEUX[jeu].nom : 'Ton épreuve'}</h2>
        <p className="cab-tv-pale">{espacesFines('Elle t’attend où tu l’as laissée : la manche en cours garde son chrono.')}</p>
      </div>
      <div className="cab-tv-pied">
        <div className="cab-tv-ressources">
          <Coeurs n={t.coeurs} max={t.coeursMax} />
          <Bourse or={t.or} />
        </div>
        <button type="button" className="cab-tv-cta" {...toucher(onReprendre)}>
          Reprendre l’épreuve
        </button>
      </div>
    </div>
  )
}

/**
 * « Comment ça marche ? » : les quatre notions, et ce qui se gagne — une feuille, dite une fois, relue quand on veut. Au
 * barème de la traversée en route, ou de celle qui commencera (`v`).
 */
export function ReglesDeLaTraversee({ v = VERSION_DE_LA_TRAVERSEE, onFermer }: { v?: VueDeLaTraversee['v']; onFermer: () => void }) {
  const b = baremeDe({ v })
  const premiere = quiAmeliore(v)
  return (
    <Feuille titre="Comment ça marche ?" className="cab-tv-feuille" onFermer={onFermer}>
      <div className="cab-tv-regles">
        <p>{espacesFines('Trois actes, trois gardiens. Choisis ton chemin sur la carte, joue, gagne de l’or ; bats les trois gardiens : l’un d’eux sera à toi, un avatar légendaire.')}</p>
        <h3>Les cœurs</h3>
        <p>{espacesFines(`Tu pars avec ${coeursDits(b.coeursDeDepart)}. Une manche ratée en coûte un. Plus de cœur, la traversée s’arrête : tu repars de l’acte I, avec des gardiens neufs.`)}</p>
        <h3>L’or</h3>
        <p>{espacesFines(`Chaque étoile gagnée à une manche rapporte ${piecesDites(b.orParEtoile)}. Le marchand, avant chaque gardien, vend des cœurs et des améliorations.`)}</p>
        <h3>Tes cartes</h3>
        <p>{espacesFines(`Trois, choisies au départ parmi dix : les seules de ta traversée. ${premiere[0].toUpperCase()}${premiere.slice(1)}.`)}</p>
        <h3>La carte</h3>
        <p>{espacesFines('Chaque chemin mène à un jeu, sur un thème — au Quiz, tu choisis le tien parmi trois. Une épreuve se joue en trois manches. Le gardien, au bout de l’acte, perd un point de vie à chaque étoile que tu gagnes contre lui ; tu l’affrontes jusqu’à sa chute, ou la tienne.')}</p>
        <p>{espacesFines(`Vaincu, un gardien rend tes cœurs au complet et donne ${piecesDites(OR_D_UN_GARDIEN)}. Ta traversée se reprend où tu l’as laissée.`)}</p>
        <h3>Les défis de tes cartes</h3>
        <p>
          {espacesFines(
            `Au dos de chaque carte, un défi en trois rangs — Bronze, Argent, Or —, qui ne compte que si elle est dans ta main : souvent, l’avoir et s’en passer. Un rang tenu est à toi pour toujours, même si la traversée tombe ensuite : ${CONFETTIS_D_UN_RANG[0]} confettis au Bronze, ${CONFETTIS_D_UN_RANG[1]} à l’Argent et le dos de la carte doré, un titre à l’Or. Chaque gardien a aussi son épreuve de maître : vaincu ainsi, il est à toi aussitôt.`,
          )}
        </p>
      </div>
    </Feuille>
  )
}

// ── Le bilan d'une épreuve ──

function BilanDEpreuve({ t, b, onContinuer }: { t: VueDeLaTraversee; b: BilanDEpreuve; onContinuer: () => void }) {
  const e = etapeDe(t, b.etape)
  const gardien = b.gardien ? t.actes[acteDe(b.etape)].gardien : null
  const titre = b.vaincu && gardien ? `${nomDe(gardien)} est vaincu !` : b.perdue ? 'Ton dernier cœur est tombé' : b.coeurs === 0 && b.manches.every(m => !m.comptee || (m.etoiles ?? 0) > 0) ? 'Sans une égratignure !' : 'Épreuve finie'
  // Le jeu et son thème, au-dessus du verdict : l'épreuve se reconnaît d'un coup d'œil, même relue après un rechargement.
  const jeu = gardien ? null : e?.jeu
  // Le thème choisi d'un Quiz, que le bilan porte : l'étape, elle, n'en a pas à elle.
  const theme = b.theme ?? e?.theme
  const surtitre = gardien ? `Contre ${leGardien(gardien)}` : jeu ? `${JEUX[jeu].nom}${theme ? ` · ${theme}` : ''}` : 'Épreuve'
  return (
    <div className={'cab-tv-ecran' + (b.vaincu ? ' cab-tv-victoire' : '')}>
      <div className="cab-tv-colonne cab-tv-bilan">
        <p className="cab-tv-sur">{surtitre}</p>
        {gardien ? (
          <div className={'cab-tv-portrait' + (b.vaincu ? ' cab-tv-vaincu' : '')}>
            <img src={imageDuGardien(gardien, true)} alt="" />
          </div>
        ) : (
          e?.jeu && (
            <span className="cab-tv-grand-ic" aria-hidden="true">
              {EMOJI_DES_JEUX[e.jeu]}
            </span>
          )
        )}
        <h2 tabIndex={-1}>{espacesFines(titre)}</h2>
        {b.pv && <PointsDeVie pv={b.pv.apres} max={b.pv.max} />}
        <ol className="cab-tv-manches">
          {b.manches.map((m, k) => (
            <li key={k} className={!m.comptee ? 'cab-tv-sans' : m.etoiles !== null && m.etoiles > 0 ? 'cab-tv-ok' : 'cab-tv-ko'}>
              <span className="cab-tv-sur">{`Manche ${k + 1}${m.misee ? ' · misée' : ''}`}</span>
              <span className="cab-tv-etoiles" aria-label={m.etoiles === null ? 'pas jouée' : `${m.etoiles} ${m.etoiles > 1 ? 'étoiles' : 'étoile'}`}>
                {m.etoiles === null ? '—' : m.etoiles > 0 ? '★'.repeat(m.etoiles) : '✗'}
              </span>
              <span className="cab-tv-gain">
                {!m.comptee ? 'ne compte pas' : m.or > 0 ? `+${m.or}` : m.paree ? 'parée' : m.coeurs > 0 ? `−${coeursDits(m.coeurs)}` : ''}
                {m.coups > 0 && <small>{` · ${pluriel(m.coups, 'coup')}`}</small>}
              </span>
            </li>
          ))}
        </ol>
        <p className="cab-tv-total">
          {b.or > 0 && (
            <span className="cab-tv-saute">
              <Piece /> {`+${b.or}`}
            </span>
          )}
          {b.coeurs > 0 && <span className="cab-tv-perte">{`−${coeursDits(b.coeurs)}`}</span>}
        </p>
        {b.souffle && <p className="cab-tv-pale">{espacesFines('Ton Second souffle t’a relevé.')}</p>}
        {b.vaincu && (
          <p className="cab-tv-pale">
            {espacesFines(
              `${piecesDites(OR_D_UN_GARDIEN)} du gardien, tes cœurs au complet${b.recompense === 'amelioration' ? ', et une amélioration à choisir' : b.recompense === 'or' ? ` — ${pourquoiDeLOr(t)} : ${piecesDites(OR_SANS_AMELIORATION)} de plus` : ''}.`,
            )}
          </p>
        )}
        {b.gardien && !b.vaincu && !b.perdue && b.pv && (
          <p className="cab-tv-pale">{espacesFines(`Il tient encore : ${pluriel(b.pv.apres, 'point')} de vie. Un autre assaut l’attend.`)}</p>
        )}
        {b.manches.some(m => m.misee && m.comptee && (m.etoiles ?? 0) === 0) && <p className="cab-tv-pale">{espacesFines(`Une mise perdue coûte ${coeursDits(COEURS_D_UNE_MISE_PERDUE)}.`)}</p>}
        {/* Ce que cette épreuve a fait tomber des défis de tes cartes : un défi tombe à la chute d'un gardien, une mise gagnée. */}
        <SceauxTombes cles={t.derniere?.partie === b.partie ? (t.sceaux?.derniers ?? []) : []} titre="Tes défis" />
      </div>
      <div className="cab-tv-pied">
        <div className="cab-tv-ressources">
          <Coeurs n={t.coeurs} max={t.coeursMax} />
          <Bourse or={t.or} />
        </div>
        <button type="button" className="cab-tv-cta" {...toucher(onContinuer)}>
          Continuer
        </button>
      </div>
    </div>
  )
}

// ── Le coffre, l'amélioration, le marchand ──

/**
 * Pourquoi une amélioration offerte paie en or : ses cartes sont au plus haut, ou — depuis la version 2 — toutes déjà à
 * la carte +, que le marchand seul mène plus haut.
 */
const pourquoiDeLOr = (t: VueDeLaTraversee): string =>
  t.cartes.every(c => c.niveau >= NIVEAU_MAX) ? 'tes cartes sont au plus haut' : `tes cartes sont toutes améliorées, et ${CARTE_PLUS_PLUS} s’achète chez le marchand`

function CoffreOuvert({ t, onContinuer }: { t: VueDeLaTraversee; onContinuer: () => void }) {
  // Ce que le coffre a donné, dit par la traversée : déduit de ses cartes, la carte qu'il venait de monter au plus haut le disait payé en or.
  const enOr = t.ou.sorte === 'coffre' && t.ou.recompense === 'or'
  const raison = pourquoiDeLOr(t)
  return (
    <div className="cab-tv-ecran">
      <div className="cab-tv-colonne cab-tv-tresor">
        <img className="cab-tv-coffre" src={COFFRES_PEINTS.or?.ouvert} alt="" />
        <h2 tabIndex={-1}>{enOr ? `${piecesDites(OR_SANS_AMELIORATION)} !` : 'Ta carte est plus forte'}</h2>
        <p className="cab-tv-pale">{espacesFines(enOr ? `${raison[0].toUpperCase()}${raison.slice(1)} : le coffre paie en or.` : 'Le coffre est vide maintenant : la route continue.')}</p>
      </div>
      <div className="cab-tv-pied">
        <button type="button" className="cab-tv-cta" {...toucher(onContinuer)}>
          Continuer
        </button>
      </div>
    </div>
  )
}

function Amelioration({ t, busy, onAmeliorer }: { t: VueDeLaTraversee; busy: boolean; onAmeliorer: (cle: CleDeCarte) => void }) {
  const [prise, setPrise] = useState<CleDeCarte | null>(null)
  const depuisLeCoffre = t.ou.sorte === 'coffre'
  return (
    <div className="cab-tv-ecran">
      <div className="cab-tv-colonne">
        {depuisLeCoffre && <img className="cab-tv-coffre cab-tv-ouvert" src={COFFRES_PEINTS.or?.ouvert} alt="" />}
        <header className="cab-tv-tete-ecran">
          <p className="cab-tv-sur">{depuisLeCoffre ? 'Le coffre' : 'Le gardien vaincu'}</p>
          <h2 tabIndex={-1}>Une amélioration</h2>
          <p className="cab-tv-pale">
            {espacesFines(baremeDe(t).niveauOffert < NIVEAU_MAX ? `Choisis la carte qui monte à ${CARTE_PLUS} : ${CARTE_PLUS_PLUS}, le marchand seul la vend.` : 'Choisis la carte qui monte d’un niveau.')}
          </p>
        </header>
        <div className="cab-tv-cartes cab-tv-trois">
          {t.cartes.map(c => {
            const peut = t.offrables.includes(c.cle)
            const suivant = Math.min(NIVEAU_MAX, c.niveau + 1) as NiveauDeCarte
            const pourquoi = c.niveau >= NIVEAU_MAX ? 'Au plus haut' : c.cle === 'second-souffle' && t.souffle ? 'Déjà servie' : '++ chez le marchand'
            return (
              <CarteDeLaTraversee
                key={c.cle}
                cle={c.cle}
                niveau={peut ? suivant : c.niveau}
                v={t.v}
                prise={prise === c.cle}
                inerte={!peut}
                etiquette={!peut ? pourquoi : `Niveau ${c.niveau} → ${suivant}`}
                action={() => setPrise(c.cle)}
              />
            )
          })}
        </div>
      </div>
      <div className="cab-tv-pied">
        <button type="button" className="cab-tv-cta" aria-disabled={!prise || busy || undefined} {...toucher(() => prise && !busy && onAmeliorer(prise))}>
          {prise ? `Améliorer ${carteDeLaTraversee(prise)?.nom ?? ''}` : 'Choisis une carte'}
        </button>
      </div>
    </div>
  )
}

function Marchand({ t, busy, onAcheter, onPartir }: { t: VueDeLaTraversee; busy: boolean; onAcheter: (article: 'coeur' | 'amelioration', carte?: CleDeCarte) => void; onPartir: () => void }) {
  const coeurPossible = t.coeurs < t.coeursMax && t.or >= t.prix.coeur
  const g = t.actes[t.acte].gardien
  return (
    <div className="cab-tv-ecran">
      <div className="cab-tv-colonne">
        <div className="cab-tv-enseigne carte-fond fond-epices">
          <div className="cab-tv-enseigne-texte">
            <p className="cab-tv-sur">Avant le gardien</p>
            <h2 tabIndex={-1}>Le marchand</h2>
            <p className="cab-tv-replique">{espacesFines(`« ${nomDe(g)} t’attend juste après. Un cœur de plus, peut-être ? »`)}</p>
          </div>
        </div>
        <div className="cab-tv-ressources">
          <Coeurs n={t.coeurs} max={t.coeursMax} />
          <Bourse or={t.or} />
        </div>
        <section className="cab-tv-rayon" aria-labelledby="cab-tv-soins">
          <h3 id="cab-tv-soins">Les soins</h3>
          <div className="cab-tv-article">
            <span className="cab-tv-ic-coeur">
              <Coeurs n={1} max={1} />
            </span>
            <span className="cab-tv-txt">
              <b>Un cœur</b>
              <small>{t.coeurs >= t.coeursMax ? 'Tes cœurs sont au complet' : `${t.coeurs} sur ${t.coeursMax}`}</small>
            </span>
            <button type="button" className="cab-tv-achat" aria-disabled={!coeurPossible || busy || undefined} {...toucher(() => coeurPossible && !busy && onAcheter('coeur'))}>
              <Piece /> {t.prix.coeur}
            </button>
          </div>
        </section>
        <section className="cab-tv-rayon" aria-labelledby="cab-tv-ameliorations">
          <h3 id="cab-tv-ameliorations">Les améliorations</h3>
          {t.cartes.map(c => {
            // Le prix de chaque carte, que la vue dit : vers la carte ++, il n'a rien de celui de la carte +.
            const prix = t.prix.cartes[c.cle]
            const peut = prix !== undefined && t.or >= prix
            const carte = carteDeLaTraversee(c.cle)
            const suivant = Math.min(NIVEAU_MAX, c.niveau + 1) as NiveauDeCarte
            return (
              <div key={c.cle} className="cab-tv-article cab-tv-amelio">
                <img src={CARTES_PEINTES[c.cle]?.[1]} alt="" />
                <span className="cab-tv-txt">
                  <b>{carte ? nomAuNiveau(carte, prix !== undefined ? suivant : c.niveau) : c.cle}</b>
                  <small>{prix !== undefined && carte ? espacesFines(carte.dit(suivant, t.v)) : c.niveau >= NIVEAU_MAX ? 'Au plus haut' : 'Déjà servie'}</small>
                </span>
                {prix !== undefined && (
                  <button type="button" className="cab-tv-achat" aria-disabled={!peut || busy || undefined} {...toucher(() => peut && !busy && onAcheter('amelioration', c.cle))}>
                    <Piece /> {prix}
                  </button>
                )}
              </div>
            )
          })}
        </section>
      </div>
      <div className="cab-tv-pied">
        <button type="button" className="cab-tv-cta" aria-disabled={busy || undefined} {...toucher(() => !busy && onPartir())}>
          {`Affronter ${leGardien(g)}`}
        </button>
      </div>
    </div>
  )
}

// ── Le légendaire, la fin ──

function ChoixDuLegendaire({ t, possedes, busy, onChoisir }: { t: VueDeLaTraversee; possedes: readonly string[]; busy: boolean; onChoisir: (g: string) => void }) {
  const [pris, setPris] = useState<string | null>(null)
  return (
    <div className="cab-tv-ecran cab-tv-victoire">
      <div className="cab-tv-colonne">
        <header className="cab-tv-tete-ecran cab-tv-centre">
          <p className="cab-tv-sur">Les trois actes sont à toi</p>
          <h2 tabIndex={-1}>Choisis ton légendaire</h2>
          <p className="cab-tv-pale">{espacesFines('Il devient ton avatar : porte-le partout, dans chaque soirée.')}</p>
        </header>
        <div className="cab-tv-legendaires">
          {t.vaincus.map(g => {
            const deja = possedes.includes(g)
            return (
              <button key={g} type="button" className="cab-tv-legendaire" aria-pressed={pris === g} {...toucher(() => setPris(g))}>
                <img src={imageDuGardien(g, true)} alt="" />
                <span className="cab-tv-txt">
                  <b>{nomDe(g)}</b>
                  <small>{deja ? 'Déjà à toi' : espacesFines(gardienDeLaTraversee(g)?.devise ?? '')}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="cab-tv-pied">
        <button type="button" className="cab-tv-cta" aria-disabled={!pris || busy || undefined} {...toucher(() => pris && !busy && onChoisir(pris))}>
          {pris ? `Choisir ${leGardien(pris)}` : 'Touche un gardien'}
        </button>
      </div>
    </div>
  )
}

function FinDeLaTraversee({ t, possedes, busy, onCommencer }: { t: VueDeLaTraversee; possedes: readonly string[]; busy: boolean; onCommencer: () => void }) {
  const fin = t.fin
  if (!fin) return null
  const gagnee = fin.issue === 'gagnee' && fin.legendaire
  const stats = (
    <ul className="cab-tv-stats">
      <li>
        <b>{t.epreuves}</b> {t.epreuves > 1 ? 'épreuves' : 'épreuve'}
      </li>
      <li>
        <b>{t.reussies}</b> {t.reussies > 1 ? 'manches réussies' : 'manche réussie'}
      </li>
      <li>
        <b>{t.vaincus.length}</b> {t.vaincus.length > 1 ? 'gardiens vaincus' : 'gardien vaincu'}
      </li>
    </ul>
  )
  return (
    <div className={'cab-tv-ecran' + (gagnee ? ' cab-tv-victoire' : '')}>
      <div className="cab-tv-colonne cab-tv-fin">
        {gagnee && fin.legendaire ? (
          <>
            <p className="cab-tv-sur">Traversée réussie</p>
            <div className="cab-tv-portrait cab-tv-rayons">
              <img src={imageDuGardien(fin.legendaire, true)} alt="" />
            </div>
            <h2 tabIndex={-1}>{`${nomDe(fin.legendaire)} est à toi`}</h2>
            <p className="cab-tv-pale">{espacesFines(possedes.includes(fin.legendaire) ? 'Ton avatar légendaire : choisis-le depuis ton profil, il te suit partout.' : 'Il rejoint tes avatars légendaires.')}</p>
          </>
        ) : (
          <>
            <p className="cab-tv-sur">{fin.issue === 'abandonnee' ? 'Traversée abandonnée' : 'Traversée perdue'}</p>
            <h2 tabIndex={-1}>{fin.issue === 'abandonnee' ? 'Tu t’arrêtes ici' : 'La traversée s’arrête ici'}</h2>
            <p className="cab-tv-pale">{espacesFines(`${ACTES[t.acte].court} · ${ACTES[t.acte].nom}. Repars : une carte neuve, des gardiens neufs.`)}</p>
          </>
        )}
        {stats}
        {/* Ce qu'elle a tenu reste à lui, gagnée ou non : un défi d'acte tenu ne se reprend pas. */}
        <SceauxTombes cles={t.sceaux?.atteints ?? []} titre="Tenu pendant cette traversée" />
      </div>
      <div className="cab-tv-pied">
        <button type="button" className="cab-tv-cta" aria-disabled={busy || undefined} {...toucher(() => !busy && onCommencer())}>
          Nouvelle traversée
        </button>
        <a className="cab-tv-second" href={gagnee ? '/profil' : '/'}>
          {gagnee ? 'Voir mon profil' : 'Revenir à l’accueil'}
        </a>
      </div>
    </div>
  )
}

/** Les rangées de la carte, comptées : la dernière est celle du gardien (`RANGEE_DU_GARDIEN`). */
export const RANGEES_DE_LA_CARTE = RANGEE_DU_GARDIEN + 1

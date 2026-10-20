// Le compagnon de sa niche (`shared/compagnons.ts`, le choix du 18 octobre
// 2026) : la petite fenêtre en arche, en haut à droite de chaque page du
// téléphone, où il vit. Posé par les pages qui lisent le profil — l'accueil,
// le profil et la boutique, la soirée, le quiz du jour, la campagne et les
// duels, l'expédition, le salon —, comme la gerbe (`gerbe.ts`), et retenu
// pour le prochain démarrage : la page lui laisse sa place dès son premier
// rendu (`body.avec-niche`), au lieu de pousser sa première ligne quand le
// profil arrive. Sans compagnon, pas de niche : l'invité anonyme n'a rien de
// plus que ce qu'il avait (invariant 8).
//
// Rien ici du catalogue ni des dessins : ce fichier part avec chaque page,
// l'accueil anonyme compris. La niche elle-même vient à la demande
// (`components/NicheHost.tsx`).
import type { ReactionALaRevelation } from '../../shared/niche'

/**
 * Ce que la niche montre : son compagnon (`loup`), le rang de sa plus haute
 * forme — sa croissance —, ce qu'il en a réglé : la forme qu'il y montre
 * (`montree`, d'avant la plus haute, ou 4 pour sa métamorphose) et son nom,
 * que sa carte montre aussi ; son Éclat, qui lui ouvre sa métamorphose à sa
 * forme ultime (`CompagnonPossede.eclat`) ; et, après elle, les paliers de sa
 * niche et ce qu'il a réglé de ses ornements (`shared/ornements.ts`).
 */
export interface NicheVue {
  compagnon: string
  rang: number
  montree?: number
  nom?: string
  eclat?: true
  paliers?: number
  ornements?: Readonly<Partial<Record<string, string>>>
}

const CLE = 'quizz.niche'
/** La classe que porte la page quand une niche occupe son coin : chaque page y arrête sa première ligne (`styles.css`). */
const CLASSE = 'avec-niche'
/** Ses paliers, après sa forme ultime : `PALIERS_DE_LA_NICHE.length`, que `niche-paliers.test.ts` compare — rien du catalogue ici. */
const PALIERS_MAX = 4

let actuelle: NicheVue | null = null
const abonnes = new Set<() => void>()

/** Ce qu'il a réglé de ses ornements, s'il est lisible : des noms et des styles, rien d'autre. Leur sens, le composant le lit. */
function ornementsLus(brut: unknown): Record<string, string> | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
  const lus = Object.entries(brut).filter(([, style]) => typeof style === 'string')
  return lus.length > 0 ? Object.fromEntries(lus) : null
}

/**
 * Ce qu'une niche venue d'ailleurs — le stockage, un profil — a de lisible :
 * une forme pas atteinte, une métamorphose sans l'Éclat, un nom vide, un
 * palier avant sa forme ultime ne passent pas. Rien du catalogue ici : sa
 * métamorphose se dit 4 (`MONTREE_DE_LA_METAMORPHOSE`, que
 * `ma-niche.test.ts` compare).
 */
function lue(brut: unknown): NicheVue | null {
  const v = brut as Partial<NicheVue> | null
  if (!v || typeof v.compagnon !== 'string' || !v.compagnon) return null
  const rang = Number(v.rang)
  if (!Number.isInteger(rang) || rang < 0 || rang > 3) return null
  const montree = v.montree
  const eclat = v.eclat === true
  const lisible = typeof montree === 'number' && Number.isInteger(montree) && ((montree >= 0 && montree < rang) || (montree === 4 && rang === 3 && eclat))
  const paliers = rang === 3 && typeof v.paliers === 'number' && Number.isInteger(v.paliers) && v.paliers >= 1 && v.paliers <= PALIERS_MAX ? v.paliers : 0
  const ornements = paliers > 0 ? ornementsLus(v.ornements) : null
  return {
    compagnon: v.compagnon,
    rang,
    ...(lisible && { montree }),
    ...(typeof v.nom === 'string' && v.nom && { nom: v.nom }),
    ...(eclat && { eclat: true as const }),
    ...(paliers > 0 && { paliers }),
    ...(ornements && { ornements }),
  }
}

function poser(niche: NicheVue | null): void {
  const meme =
    niche?.compagnon === actuelle?.compagnon &&
    niche?.rang === actuelle?.rang &&
    niche?.montree === actuelle?.montree &&
    niche?.nom === actuelle?.nom &&
    niche?.eclat === actuelle?.eclat &&
    niche?.paliers === actuelle?.paliers &&
    JSON.stringify(niche?.ornements) === JSON.stringify(actuelle?.ornements)
  // Une forme atteinte pendant la partie — le profil relu après un quiz, une
  // partie du jour, une série —, ou un palier de sa niche : il sort de sa
  // niche pour le montrer.
  const grandi =
    !!niche && !!actuelle && niche.compagnon === actuelle.compagnon && (niche.rang > actuelle.rang || (niche.paliers ?? 0) > (actuelle.paliers ?? 0))
  actuelle = niche
  if (typeof document !== 'undefined') document.body.classList.toggle(CLASSE, !!niche)
  if (!meme) for (const f of abonnes) f()
  if (grandi && enJeu) sortir()
}

/** Un compagnon tel que le profil le dit (`CompagnonPossede`). */
type CompagnonDuProfil = {
  compagnon: string
  rang: number
  montree?: number
  nom?: string
  eclat?: true
  paliers?: number
  ornements?: Readonly<Partial<Record<string, string>>>
}

/**
 * Le compagnon que le serveur met dans sa niche (`PublicProfile.niche`), à
 * la forme qu'il a atteinte, avec son nom, la forme qu'il y montre, son
 * Éclat, ses paliers et ses ornements ; rien sans profil ou sans compagnon.
 * Retenu sur ce téléphone pour le prochain démarrage.
 */
export function porterNiche(profil: { niche?: string; compagnons?: readonly CompagnonDuProfil[] } | null | undefined): void {
  const sien = profil?.niche ? profil.compagnons?.find(c => c.compagnon === profil.niche) : undefined
  const niche = sien ? lue(sien) : null
  poser(niche)
  try {
    if (niche) localStorage.setItem(CLE, JSON.stringify(niche))
    else localStorage.removeItem(CLE)
  } catch {
    // Stockage indisponible : la niche vaut pour cette page.
  }
}

/**
 * Au démarrage d'une page qui lit le profil : la niche retenue la dernière
 * fois, avant que le profil ne soit relu — sa place est gardée dès le
 * premier rendu. La page la confirme ou l'ôte (`porterNiche`).
 */
export function poserNicheRetenue(): void {
  let retenue: NicheVue | null = null
  try {
    const brut = localStorage.getItem(CLE)
    retenue = brut ? lue(JSON.parse(brut)) : null
  } catch {
    retenue = null
  }
  poser(retenue)
}

/** Ce que la niche montre en ce moment ; null : pas de niche. */
export function nicheActuelle(): NicheVue | null {
  return actuelle
}

/** S'abonne aux changements de la niche (`useSyncExternalStore`). */
export function abonnerNiche(f: () => void): () => void {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

// ── « Touche-moi ! » ─────────────────────────────────────────────────────
//
// Sa gestion s'ouvre en touchant la niche, et rien ne le disait (le
// propriétaire, le 19 octobre 2026 : « où est-ce que cela se fait ? Il manque
// des fonctionnalités simples et pratiques pour accéder à cela ») : une bulle
// le lui propose, sur les pages où l'on se pose — jamais en jouant —, trois
// fois au plus, et plus du tout une fois sa niche touchée.

const CLE_DE_L_APPEL = 'quizz.niche.appel'
/** Les pages où l'on se pose : l'accueil, le profil, la boutique. */
const PAGES_DE_L_APPEL = new Set(['/', '/profil', '/boutique'])
const APPELS_MAX = 3

/** La bulle se propose-t-elle sur cette page, à qui l'a vue tant de fois — ou a déjà touché sa niche ? */
export function appelerAuToucher(chemin: string, { vues, touchee }: { vues: number; touchee: boolean }): boolean {
  return PAGES_DE_L_APPEL.has(chemin) && !touchee && vues < APPELS_MAX
}

/** Ce que ce téléphone retient de la bulle ; sans stockage, elle ne se propose pas — elle reviendrait à chaque page. */
function lireLAppel(): { vues: number; touchee: boolean } | null {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_DE_L_APPEL) ?? '{}') as { vues?: unknown; touchee?: unknown }
    return { vues: Number(brut.vues) || 0, touchee: brut.touchee === true }
  } catch {
    return null
  }
}

/** La niche paraît sur une page : sa bulle s'y propose-t-elle ? Comptée si oui. */
export function prendreLAppel(): boolean {
  const etat = lireLAppel()
  if (!etat || typeof window === 'undefined' || !appelerAuToucher(window.location.pathname, etat)) return false
  try {
    localStorage.setItem(CLE_DE_L_APPEL, JSON.stringify({ ...etat, vues: etat.vues + 1 }))
  } catch {
    return false
  }
  return true
}

/** Sa niche touchée — sa gestion ouverte, d'où que ce soit : la bulle ne se propose plus. */
export function nicheTouchee(): void {
  const etat = lireLAppel()
  if (!etat || etat.touchee) return
  try {
    localStorage.setItem(CLE_DE_L_APPEL, JSON.stringify({ ...etat, touchee: true }))
  } catch {
    // Stockage indisponible : la bulle ne se proposait déjà pas.
  }
}

// ── Ses réactions, le temps d'une partie ─────────────────────────────────
//
// Les pages de jeu disent à la niche ce qui se passe (le principe du
// compagnon, § 2) : une réponse touchée — il retient son souffle, le
// téléphone ne sait pas encore si elle est juste (invariant 1) —, la
// révélation — ravi, dépité avec toi, des cœurs quand peu l'ont trouvée —,
// puis le calme quand le verdict s'en va. Au podium d'un quiz, ou à une forme
// atteinte, il sort de sa niche : une fois par quiz au plus. Sans niche,
// personne n'écoute — l'invité anonyme ne télécharge rien de plus.

/** Ce que la niche apprend : le composant le joue (`Niche.tsx`). */
export type MomentDeLaNiche =
  | { sorte: 'souffle' }
  | { sorte: 'juste'; rare: boolean; nourri: boolean; depuis: Element | null }
  | { sorte: 'ratee' }
  | { sorte: 'calme' }
  | { sorte: 'sortie' }

const ecouteurs = new Set<(m: MomentDeLaNiche) => void>()

function annoncer(m: MomentDeLaNiche): void {
  for (const f of ecouteurs) f(m)
}

/** La niche écoute ses moments, dans l'ordre où ils arrivent : deux dans le même instant ne s'écrasent pas. */
export function ecouterLaNiche(f: (m: MomentDeLaNiche) => void): () => void {
  ecouteurs.add(f)
  return () => ecouteurs.delete(f)
}

/** Une réponse donnée sur cette page : la partie est en cours, une forme atteinte le fera sortir. */
let enJeu = false
/** Une sortie par quiz au plus : la réponse suivante en rouvre une. */
let sortiePrise = false
/** La révélation qu'elle fête, et le calme qu'elle attend de son départ (`nicheApresLaRevelation`). */
let revelation: string | null = null
let calmeEnAttente: ReturnType<typeof setTimeout> | null = null

function sortir(): void {
  if (sortiePrise) return
  sortiePrise = true
  annoncer({ sorte: 'sortie' })
}

/** Une réponse touchée, ou envoyée : il retient son souffle jusqu'au verdict. */
export function nicheRetientSonSouffle(): void {
  enJeu = true
  sortiePrise = false
  annoncer({ sorte: 'souffle' })
}

/**
 * La révélation d'une question (`cle` : laquelle), et le bandeau d'où partent
 * ses étincelles quand elle le nourrit. Le même bandeau remonté dans le même
 * instant — React, en développement, monte deux fois — ne la rejoue pas.
 */
export function nicheALaRevelation(cle: string, reaction: ReactionALaRevelation, depuis: Element | null): void {
  if (calmeEnAttente && revelation === cle) {
    clearTimeout(calmeEnAttente)
    calmeEnAttente = null
    return
  }
  revelation = cle
  annoncer(
    reaction.verdict === 'juste'
      ? { sorte: 'juste', rare: reaction.rare, nourri: reaction.nourri, depuis }
      : reaction.verdict === 'ratee'
        ? { sorte: 'ratee' }
        : { sorte: 'calme' },
  )
}

/** Le verdict quitte l'écran — la question suivante, la fin : il retrouve son calme. */
export function nicheApresLaRevelation(cle: string): void {
  if (revelation !== cle) return
  if (calmeEnAttente) clearTimeout(calmeEnAttente)
  calmeEnAttente = setTimeout(() => {
    calmeEnAttente = null
    revelation = null
    annoncer({ sorte: 'calme' })
  }, 0)
}

/** La fin d'un quiz de soirée : sur le podium, il sort de sa niche — après l'expérience, que la niche attend. */
export function nicheALaFin(podium: boolean): void {
  // Un quiz arrêté avant sa révélation : le souffle retenu se relâche.
  annoncer({ sorte: 'calme' })
  if (podium) sortir()
}

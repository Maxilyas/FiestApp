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

/** Ce que la niche montre : son compagnon (`loup`), et le rang de sa plus haute forme. */
export interface NicheVue {
  compagnon: string
  rang: number
}

const CLE = 'quizz.niche'
/** La classe que porte la page quand une niche occupe son coin : chaque page y arrête sa première ligne (`styles.css`). */
const CLASSE = 'avec-niche'

let actuelle: NicheVue | null = null
const abonnes = new Set<() => void>()

function lue(brut: unknown): NicheVue | null {
  const v = brut as Partial<NicheVue> | null
  if (!v || typeof v.compagnon !== 'string' || !v.compagnon) return null
  const rang = Number(v.rang)
  return Number.isInteger(rang) && rang >= 0 && rang <= 3 ? { compagnon: v.compagnon, rang } : null
}

function poser(niche: NicheVue | null): void {
  const meme = niche?.compagnon === actuelle?.compagnon && niche?.rang === actuelle?.rang
  actuelle = niche
  if (typeof document !== 'undefined') document.body.classList.toggle(CLASSE, !!niche)
  if (!meme) for (const f of abonnes) f()
}

/**
 * Le compagnon que le serveur met dans sa niche (`PublicProfile.niche`), à
 * la forme qu'il a atteinte ; rien sans profil ou sans compagnon. Retenu sur
 * ce téléphone pour le prochain démarrage.
 */
export function porterNiche(profil: { niche?: string; compagnons?: readonly { compagnon: string; rang: number }[] } | null | undefined): void {
  const sien = profil?.niche ? profil.compagnons?.find(c => c.compagnon === profil.niche) : undefined
  const niche = sien ? { compagnon: sien.compagnon, rang: sien.rang } : null
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

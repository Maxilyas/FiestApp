// Le brouillon d'un quiz dans ce navigateur — le pourquoi est dans
// `shared/brouillon.ts`.
//
// Tout accès au stockage passe sous try/catch : cookies bloqués, navigation
// privée, quota plein, il lève à la moindre écriture. L'éditeur continue
// alors sans brouillon, et le sait — `garderBrouillon` rend faux : il ne
// promet plus de garder ce qu'il ne garde pas.
import { cleDuBrouillon, emballerBrouillon, lireBrouillon, type Brouillon } from '../../shared/brouillon'
import type { QuizDef } from '../../shared/library'

/** Range le brouillon ; faux si le navigateur l'a refusé. */
export function garderBrouillon(quiz: QuizDef, base: number): boolean {
  try {
    localStorage.setItem(cleDuBrouillon(quiz.id), emballerBrouillon(quiz, base, Date.now()))
    return true
  } catch {
    return false
  }
}

export function retrouverBrouillon(id: string): Brouillon | null {
  try {
    return lireBrouillon(localStorage.getItem(cleDuBrouillon(id)), id)
  } catch {
    return null
  }
}

export function oublierBrouillon(id: string) {
  try {
    localStorage.removeItem(cleDuBrouillon(id))
  } catch {
    // Stockage refusé : rien n'avait pu y être rangé.
  }
}

/** Le temps de demander au serveur si une photo existe encore ; au-delà, on la garde. */
const DELAI_PHOTO_MS = 10_000

/**
 * Celles de ces photos que le serveur n'a plus. Une photo qu'on n'a pas pu
 * vérifier — réseau coupé, serveur muet — est gardée : dans le doute, on ne
 * retire rien de ce que l'animateur avait mis.
 */
export async function photosDisparues(adresses: string[]): Promise<Set<string>> {
  const verdicts = await Promise.all(
    adresses.map(async adresse => {
      const abandon = new AbortController()
      const minuteur = setTimeout(() => abandon.abort(), DELAI_PHOTO_MS)
      try {
        // `no-store` : le navigateur garde une photo un an, et répondrait à la place du serveur.
        const res = await fetch(adresse, { method: 'HEAD', cache: 'no-store', signal: abandon.signal })
        return res.status === 404 ? adresse : null
      } catch {
        return null
      } finally {
        clearTimeout(minuteur)
      }
    }),
  )
  return new Set(verdicts.filter((adresse): adresse is string => adresse !== null))
}

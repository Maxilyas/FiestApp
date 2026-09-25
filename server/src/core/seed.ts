import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { QuizStore } from './quizStore'
import type { APersonnaliser, Rayon } from '../../../shared/modeles'

const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content/quiz')

/** Un quiz livré avec l'application (`server/content/quiz/*.json`). */
export interface Modele {
  id: string
  title: string
  questions: unknown[]
  /** Un modèle à trous : combien de prénoms « Pour qui ? » demande avant de le copier. */
  personnaliser?: APersonnaliser
  /** Une phrase qui dit à quoi il sert, sous son titre. */
  description?: string
  rayon: Rayon
  /** Sa place dans son rayon. */
  ordre: number
  /**
   * Copié d'office dans la bibliothèque de l'administrateur, au premier
   * démarrage. Les autres attendent qu'on parte d'eux : onze modèles versés
   * d'un coup encombraient la bibliothèque qu'ils devaient amorcer.
   */
  amorce: boolean
}

/**
 * Les quiz livrés, relus du disque à chaque demande : ils sont une douzaine,
 * petits, et un déploiement qui en ajoute un le propose aussitôt. Rangés par
 * rayon — la fête d'abord —, puis dans l'ordre que chacun déclare.
 */
export function lireModeles(): Modele[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  const modeles: Modele[] = []
  for (const file of fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')).sort()) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'))
      if (!raw || typeof raw.title !== 'string' || !Array.isArray(raw.questions)) continue
      const questions = raw.questions.map((q: any) => ({
        ...q,
        // Les photos livrées avec le dépôt restent servies depuis /media/quiz.
        image: typeof q?.image === 'string' && q.image ? `/media/quiz/${encodeURIComponent(q.image)}` : null,
      }))
      const prenoms = raw.personnaliser?.prenoms
      modeles.push({
        id: file.replace(/\.json$/, ''),
        title: raw.title,
        questions,
        ...((prenoms === 1 || prenoms === 2) && { personnaliser: { prenoms } }),
        ...(typeof raw.description === 'string' && raw.description.trim() && { description: raw.description.trim() }),
        rayon: raw.rayon === 'fete' ? 'fete' : 'jeu',
        ordre: typeof raw.ordre === 'number' ? raw.ordre : 99,
        amorce: raw.amorce === true,
      })
    } catch (e) {
      console.warn(`[quiz] lecture de ${file} impossible : ${(e as Error).message}`)
    }
  }
  return modeles.sort((a, b) => (a.rayon === b.rayon ? 0 : a.rayon === 'fete' ? -1 : 1) || a.ordre - b.ordre)
}

/**
 * Importe une seule fois les quiz d'amorce (`amorce`) dans la bibliothèque
 * de l'espace par défaut — celui de l'administrateur. Ensuite tout se passe
 * dans l'éditeur : on ne réimporte pas au démarrage suivant, sinon un quiz
 * supprimé reviendrait sans arrêt. Les autres modèles, et les autres
 * espaces, se copient à la demande (« Partir d'un modèle », `/api/modeles`).
 */
export async function seedLibrary(store: QuizStore, spaceId: string): Promise<number> {
  if (await store.getFlag('seeded')) return 0
  let imported = 0
  for (const modele of lireModeles().filter(m => m.amorce)) {
    try {
      await store.create(spaceId, modele.title, modele.questions as any[], modele.id)
      imported++
    } catch (e) {
      console.warn(`[quiz] import de ${modele.id} impossible : ${(e as Error).message}`)
    }
  }
  await store.setFlag('seeded', '1')
  return imported
}

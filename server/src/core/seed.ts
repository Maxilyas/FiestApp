import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { QuizStore } from './quizStore'

const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content/quiz')

/** Un quiz livré avec l'application (`server/content/quiz/*.json`). */
export interface Modele {
  id: string
  title: string
  questions: unknown[]
}

/**
 * Les quiz livrés, relus du disque à chaque demande : ils sont deux, petits,
 * et un déploiement qui en ajoute un le propose aussitôt.
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
      modeles.push({ id: file.replace(/\.json$/, ''), title: raw.title, questions })
    } catch (e) {
      console.warn(`[quiz] lecture de ${file} impossible : ${(e as Error).message}`)
    }
  }
  return modeles
}

/**
 * Importe une seule fois les quiz livrés dans la bibliothèque de l'espace
 * par défaut — celui de l'administrateur. Ensuite tout se passe dans
 * l'éditeur : on ne réimporte pas au démarrage suivant, sinon un quiz
 * supprimé reviendrait sans arrêt. Les autres espaces les copient à la
 * demande (« Partir d'un modèle », `/api/modeles`).
 */
export async function seedLibrary(store: QuizStore, spaceId: string): Promise<number> {
  if (await store.getFlag('seeded')) return 0
  let imported = 0
  for (const modele of lireModeles()) {
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

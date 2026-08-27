import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { QuizStore } from './quizStore'

const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content/quiz')

/**
 * Importe une seule fois les quiz livrés en JSON (`server/content/quiz/*.json`)
 * dans la bibliothèque. Ensuite tout se passe dans l'éditeur : on ne réimporte
 * pas au démarrage suivant, sinon un quiz supprimé reviendrait sans arrêt.
 */
export async function seedLibrary(store: QuizStore): Promise<number> {
  if (await store.getFlag('seeded')) return 0
  let imported = 0
  if (fs.existsSync(CONTENT_DIR)) {
    for (const file of fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'))) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'))
        if (!raw || typeof raw.title !== 'string' || !Array.isArray(raw.questions)) continue
        const id = file.replace(/\.json$/, '')
        const questions = raw.questions.map((q: any) => ({
          ...q,
          // Les photos livrées avec le dépôt restent servies depuis /media/quiz.
          image: typeof q?.image === 'string' && q.image ? `/media/quiz/${encodeURIComponent(q.image)}` : null,
        }))
        await store.create(raw.title, questions, id)
        imported++
      } catch (e) {
        console.warn(`[quiz] import de ${file} impossible : ${(e as Error).message}`)
      }
    }
  }
  await store.setFlag('seeded', '1')
  return imported
}

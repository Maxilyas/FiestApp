// Ce que les scripts de la chaîne des indices partagent : leur dossier de travail — les lots, les sorties des agents, les
// corrigés, jamais dans le dépôt : ils portent les réponses — et les sources du vivier.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI_DU_SCRIPT = path.dirname(fileURLToPath(import.meta.url))

/** Le dossier de travail (`ICI`, ou un dossier temporaire) : les rédacteurs et les juges y lisent et y écrivent. */
export const TRAVAIL = process.env.ICI ?? path.join(os.tmpdir(), 'indices-du-filet')

/** Un fichier du dossier de travail. */
export const dansLeTravail = (f: string) => path.join(TRAVAIL, f)

/** Les sources du vivier, à côté du cahier (`retours/2026-11-09/`). */
export const RETOURS = path.resolve(ICI_DU_SCRIPT, '../..')

/** L'année des tranches : celle où les indices se jugent. Une année plus tard, des questions de plus se posent. */
export const ANNEE = Number(process.env.ANNEE ?? 2026)

/**
 * Les questions qui ont déjà leur ligne : un indice ou un « pas d'indice » décidé, de la maquette comme des vagues — les
 * trois sources que relit `../contenu-du-filet.mts`. Sans la maquette, une vague reproposait ses 147 questions, déjà jugées.
 */
export function dejaEcrites(): Set<string> {
  const ids = new Set<string>()
  for (const f of ['maquette-filet/indices.json', 'maquette-filet/recentes.json', 'indices-du-vivier.json']) {
    const chemin = path.join(RETOURS, f)
    if (fs.existsSync(chemin)) for (const x of JSON.parse(fs.readFileSync(chemin, 'utf8')) as { id: string }[]) ids.add(x.id)
  }
  return ids
}

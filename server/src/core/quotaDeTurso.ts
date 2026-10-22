import { tronquer } from '../../../shared/avatars'

// Ce que Turso compte au quota de chaque aller-retour : les lignes que ses
// requêtes ont parcourues (`rows_read`) et écrites (`rows_written`), qu'il
// dit dans chaque réponse du protocole — le client libsql les lit, puis les
// jette. Le 22 octobre 2026, la production avait lu 333 millions de lignes
// sur les 500 du mois, et rien ne le disait : une requête qui relisait toute
// une histoire — la mesure des difficultés, le modèle du savoir, l'expérience,
// le carnet — avait l'air d'une requête comme une autre, et son coût
// grandissait avec chaque réponse donnée. Comptées ici, heure par heure
// (`releve.quota`), elles disent à la page « Le serveur » du QG ce que le
// mois coûtera, et quelles requêtes le coûtent.

/**
 * Une instruction qui parcourt au moins tant de lignes se nomme au relevé,
 * par le début de son texte : de quoi la retrouver dans le code. En deçà,
 * elle compte au total sans un nom — et le serveur ne relit pas le texte de
 * la requête, qu'il faudrait décoder : la plupart des allers-retours lisent
 * une ligne par leur clé.
 */
export const LIGNES_D_UNE_LOURDE = 100

/** Le début du texte qui nomme une instruction lourde, au plus. */
const REQUETE_MAX = 140

/** Ce qu'un aller-retour a coûté au quota, et ses instructions lourdes. */
export interface CoutDUnAllerRetour {
  lues: number
  ecrites: number
  lourdes: { requete: string; lues: number }[]
}

/**
 * Le texte d'une instruction, tel que le relevé la nomme : sur une ligne, ses
 * nombres et ses listes de paramètres ramenés à un signe — une liste de
 * vingt identifiants et une de trois font la même requête —, coupé à
 * `REQUETE_MAX`. Jamais ses paramètres : ils ne sont pas dans le texte.
 */
export function familleDeLaRequete(sql: string): string {
  const texte = sql
    .replace(/\s+/g, ' ')
    .replace(/\?(?:\s*,\s*\?)+/g, '?…')
    .replace(/\b\d+\b/g, '#')
    .trim()
  return tronquer(texte, REQUETE_MAX)
}

const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * Ce qu'une réponse du protocole Hrana — le corps d'un `v2/pipeline`, que le
 * client libsql vient de décoder — dit de son coût : chaque `execute`, et
 * chaque étape d'un `batch`, ses `BEGIN` et `COMMIT` compris. Null pour ce
 * qui n'en est pas une. `corps` : le texte de la requête, relu seulement
 * pour nommer une instruction lourde — ses instructions sont dans l'ordre
 * de leurs réponses. Les étapes d'un lot n'y portent pas leur texte : le
 * client libsql le range d'abord (`store_sql`), et l'étape le cite par son
 * numéro (`sql_id`).
 */
export function coutDeLAllerRetour(reponse: unknown, corps: () => string | null): CoutDUnAllerRetour | null {
  const resultats = (reponse as { results?: unknown } | null)?.results
  if (!Array.isArray(resultats)) return null
  let lues = 0
  let ecrites = 0
  const lourdes: { i: number; k: number; lues: number }[] = []
  const compter = (r: unknown, i: number, k: number) => {
    if (!r || typeof r !== 'object') return
    const l = nombre((r as { rows_read?: unknown }).rows_read)
    lues += l
    ecrites += nombre((r as { rows_written?: unknown }).rows_written)
    if (l >= LIGNES_D_UNE_LOURDE) lourdes.push({ i, k, lues: l })
  }
  resultats.forEach((resultat: unknown, i) => {
    const r = resultat as { type?: unknown; response?: { type?: unknown; result?: { step_results?: unknown } } } | null
    if (r?.type !== 'ok' || !r.response) return
    if (r.response.type === 'execute') compter(r.response.result, i, -1)
    else if (r.response.type === 'batch' && Array.isArray(r.response.result?.step_results)) r.response.result.step_results.forEach((s: unknown, k: number) => compter(s, i, k))
  })
  if (lourdes.length === 0) return { lues, ecrites, lourdes: [] }
  let requetes: unknown[] = []
  try {
    const lue = JSON.parse(corps() ?? '') as { requests?: unknown }
    if (Array.isArray(lue.requests)) requetes = lue.requests
  } catch {
    // Illisible : ses instructions lourdes comptent sans leur nom.
  }
  type Instruction = { sql?: unknown; sql_id?: unknown }
  const rangees = new Map<unknown, unknown>()
  for (const r of requetes as { type?: unknown; sql_id?: unknown; sql?: unknown }[]) if (r?.type === 'store_sql') rangees.set(r.sql_id, r.sql)
  const texteDe = (stmt: Instruction | undefined) => (typeof stmt?.sql === 'string' ? stmt.sql : rangees.get(stmt?.sql_id))
  return {
    lues,
    ecrites,
    lourdes: lourdes.map(({ i, k, lues }) => {
      const r = requetes[i] as { stmt?: Instruction; batch?: { steps?: { stmt?: Instruction }[] } } | undefined
      const sql = texteDe(k < 0 ? r?.stmt : r?.batch?.steps?.[k]?.stmt)
      return { requete: typeof sql === 'string' ? familleDeLaRequete(sql) : '?', lues }
    }),
  }
}

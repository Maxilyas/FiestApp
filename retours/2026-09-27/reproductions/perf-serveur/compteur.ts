// Le compteur d'allers-retours vers la base permanente.
//
// En production, la base permanente est Turso : chaque `execute` et chaque
// `batch` du client libsql est un aller-retour HTTP (20 à 80 ms). Sur le banc,
// c'est un fichier `file:`, servi par `Sqlite3Client` : on enveloppe ses deux
// méthodes pour compter les appels, les instructions, les lignes rendues, les
// octets utiles, et savoir QUI appelle (la première ligne de `server/src/` de
// la pile). `rtt` ajoute une attente fixe avant chaque appel : la latence de
// Turso simulée, sans gigue ni débit.
import { Sqlite3Client } from '@libsql/client/sqlite3'

export interface Appel {
  genre: 'execute' | 'batch'
  instructions: number
  lignes: number
  octets: number
  sql: string
  /** Les arguments de la première instruction, pour reconnaître un jour lu. */
  args: unknown[]
  qui: string
  debut: number
  fin: number
}

export const compteur = {
  rtt: 0,
  appels: [] as Appel[],
}

function appelant(pile: string | undefined): string {
  const lignes = (pile ?? '').split('\n').slice(1)
  for (const l of lignes) {
    if (!l.includes('/server/src/') || l.includes('/core/distante.ts')) continue
    const m = /at (?:async )?([^\s(]+)? ?\(?.*\/server\/src\/(.+?):(\d+):\d+\)?/.exec(l)
    if (m) return `${m[1] ?? '?'} (${m[2]}:${m[3]})`
  }
  return '?'
}

function premiereLigne(stmt: unknown): string {
  const sql = typeof stmt === 'string' ? stmt : (stmt as { sql?: string })?.sql ?? ''
  return sql.replace(/\s+/g, ' ').trim().slice(0, 90)
}

const proto = Sqlite3Client.prototype as any
if (!proto.__compte) {
  proto.__compte = true
  for (const m of ['execute', 'batch'] as const) {
    const orig = proto[m]
    proto[m] = async function (this: unknown, ...args: unknown[]) {
      const qui = appelant(new Error().stack)
      const debut = performance.now()
      if (compteur.rtt > 0) await new Promise(r => setTimeout(r, compteur.rtt))
      const res = await orig.apply(this, args)
      const sets = (m === 'batch' ? res : [res]) as { rows: Record<string, unknown>[]; columns: string[] }[]
      let lignes = 0
      let octets = 0
      for (const s of sets) {
        lignes += s.rows.length
        // Les valeurs seules, en tableaux : une borne basse de ce que Turso
        // renvoie (son format enveloppe chaque valeur de son type).
        octets += JSON.stringify(s.rows.map(r => s.columns.map((_c, i) => (r as any)[i]))).length
      }
      const stmts = m === 'batch' ? (args[0] as unknown[]) : [args[0]]
      compteur.appels.push({
        genre: m,
        instructions: stmts.length,
        lignes,
        octets,
        sql: premiereLigne(stmts[0]),
        args: Array.isArray((stmts[0] as { args?: unknown })?.args) ? ((stmts[0] as { args: unknown[] }).args) : [],
        qui,
        debut,
        fin: performance.now(),
      })
      return res
    }
  }
}

export interface Mesure {
  quoi: string
  appels: number
  instructions: number
  lignes: number
  octets: number
  ms: number
  /** Les allers-retours en série : la durée à `rtt` près, divisée par `rtt`. */
  enSerie: number | null
  rtt: number
  parAppelant: Record<string, number>
}

/** Compte ce que `travail` coûte à la base permanente. */
export async function mesurer<T>(
  quoi: string,
  travail: () => Promise<T>,
  rtt = compteur.rtt,
): Promise<{ mesure: Mesure; resultat: T; appels: Appel[] }> {
  const avant = compteur.rtt
  compteur.rtt = rtt
  compteur.appels = []
  const t0 = performance.now()
  let resultat: T
  try {
    resultat = await travail()
  } finally {
    compteur.rtt = avant
  }
  const ms = performance.now() - t0
  const appels = compteur.appels
  compteur.appels = []
  const parAppelant: Record<string, number> = {}
  for (const a of appels) parAppelant[a.qui] = (parAppelant[a.qui] ?? 0) + 1
  const mesure: Mesure = {
    quoi,
    appels: appels.length,
    instructions: appels.reduce((n, a) => n + a.instructions, 0),
    lignes: appels.reduce((n, a) => n + a.lignes, 0),
    octets: appels.reduce((n, a) => n + a.octets, 0),
    ms: Math.round(ms),
    enSerie: rtt > 0 ? Math.round(ms / rtt) : null,
    rtt,
    parAppelant,
  }
  return { mesure, resultat: resultat!, appels }
}

/** Une ligne lisible. */
export function ligne(m: Mesure): string {
  const serie = m.enSerie !== null ? `, ≈ ${m.enSerie} en série, ${m.ms} ms à ${m.rtt} ms/aller-retour` : `, ${m.ms} ms`
  return `${m.quoi} : ${m.appels} allers-retours (${m.instructions} instructions), ${m.lignes} lignes, ${(m.octets / 1024).toFixed(1)} Ko${serie}`
}

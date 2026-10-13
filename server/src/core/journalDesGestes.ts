import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { clientDistant, type Client } from './distante'
import { accountOf } from '../auth/http'
import { tronquer } from '../../../shared/avatars'
import { GESTES_PAR_PAGE, SORTES_DE_GESTES, type GesteDuQg, type JournalDuQg, type SorteDeGeste } from '../../../shared/qg'

/** Ce qu'une route dit du geste qu'elle vient de faire. */
export interface GesteANoter {
  sorte: SorteDeGeste
  /** Une phrase, qui nomme ce qu'elle a touché : « Profil supprimé : Léa (@lea) ». */
  resume: string
  /** L'identifiant visé — un profil, un espace, une question —, pour retrouver les gestes d'un même joueur. */
  cible?: string | null
}

/**
 * Ce qu'une route dit de son geste, juste avant de répondre : le journal ne
 * l'écrit qu'une fois la réponse partie, et seulement si elle dit oui
 * (`journaliser`). Un refus — une règle, une erreur — ne s'y note jamais.
 */
export function noterLeGeste(res: Response, geste: GesteANoter): void {
  res.locals.geste = geste
}

/** Un texte cité dans une phrase du journal — l'intitulé d'une question — : assez pour la reconnaître. */
export function extrait(texte: string, max = 80): string {
  const propre = texte.replace(/\s+/g, ' ').trim()
  return Array.from(propre).length > max ? `${tronquer(propre, max - 1)}…` : propre
}

/**
 * Le journal des gestes de l'administrateur (le choix du 13 octobre 2026 :
 * « Oui, dans le QG »). Dans la base permanente : il raconte ce qui a changé
 * — un profil supprimé, une question retirée pour tous —, et ce qui a changé
 * y est aussi. Une ligne par geste, jamais modifiée.
 */
export class JournalDesGestes {
  private client: Client
  /**
   * Les écritures en route, l'une après l'autre. Une lecture les attend : la
   * page qui revient d'un geste relit le journal aussitôt, et l'écriture,
   * partie après la réponse, n'était pas encore arrivée.
   */
  private file: Promise<void> = Promise.resolve()

  constructor(
    url: string,
    authToken?: string,
    private deps: { maintenant: () => number } = { maintenant: Date.now },
  ) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS qg_gestes (
           id     TEXT PRIMARY KEY,
           quand  INTEGER NOT NULL,
           qui    TEXT NOT NULL,
           sorte  TEXT NOT NULL,
           route  TEXT NOT NULL,
           resume TEXT NOT NULL,
           cible  TEXT
         )`,
        'CREATE INDEX IF NOT EXISTS idx_qg_gestes_quand ON qg_gestes(quand)',
        'CREATE INDEX IF NOT EXISTS idx_qg_gestes_cible ON qg_gestes(cible, quand)',
      ],
      'write',
    )
  }

  /**
   * Note un geste. `qui` : l'espace de l'administrateur qui l'a fait ; `route` :
   * la méthode et le chemin de la route, ce qui le fait reconnaître même sans
   * phrase. Une écriture qui échoue se dit au journal du serveur, sans rien
   * défaire : le geste, lui, a eu lieu.
   */
  noter(g: GesteANoter & { qui: string; route: string }): void {
    const quand = this.deps.maintenant()
    this.file = this.file
      .then(() =>
        this.client.execute({
          sql: 'INSERT INTO qg_gestes (id, quand, qui, sorte, route, resume, cible) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [randomUUID(), quand, g.qui, g.sorte, g.route, tronquer(g.resume, 300), g.cible ?? null],
        }),
      )
      .then(
        () => {},
        e => console.error(`[journal] le geste « ${g.route} » n’a pas pu s’écrire :`, e),
      )
  }

  /**
   * Une page du journal, le plus récent d'abord. `suite` : le curseur rendu
   * par la page d'avant — l'instant et l'identifiant de son dernier geste,
   * pour ne rien sauter ni doubler entre deux gestes du même instant.
   */
  async lire({ suite, sorte, cible }: { suite?: string | null; sorte?: SorteDeGeste | null; cible?: string | null } = {}): Promise<JournalDuQg> {
    await this.file
    const conditions: string[] = []
    const args: (string | number)[] = []
    const curseur = suite ? /^(\d+):([\w-]+)$/.exec(suite) : null
    if (curseur) {
      conditions.push('(quand < ? OR (quand = ? AND id < ?))')
      args.push(Number(curseur[1]), Number(curseur[1]), curseur[2])
    }
    if (sorte) {
      conditions.push('sorte = ?')
      args.push(sorte)
    }
    if (cible) {
      conditions.push('cible = ?')
      args.push(cible)
    }
    const res = await this.client.execute({
      sql: `SELECT id, quand, sorte, resume, cible FROM qg_gestes ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
            ORDER BY quand DESC, id DESC LIMIT ?`,
      args: [...args, GESTES_PAR_PAGE + 1],
    })
    const gestes: GesteDuQg[] = res.rows.slice(0, GESTES_PAR_PAGE).map(r => ({
      id: String(r.id),
      quand: Number(r.quand),
      sorte: (SORTES_DE_GESTES as readonly string[]).includes(String(r.sorte)) ? (String(r.sorte) as SorteDeGeste) : 'autre',
      resume: String(r.resume),
      cible: r.cible === null ? null : String(r.cible),
    }))
    const dernier = gestes.at(-1)
    return { gestes, suite: res.rows.length > GESTES_PAR_PAGE && dernier ? `${dernier.quand}:${dernier.id}` : null }
  }
}

/**
 * Le journal se tient de lui-même : posé sur `/api/admin` derrière sa porte
 * (`api.ts`), il note toute requête qui change quelque chose — tout sauf une
 * lecture — et que le serveur accepte. La phrase vient de la route
 * (`noterLeGeste`) ; une route qui l'oublie se note quand même, par sa
 * méthode et son chemin : un geste sans phrase vaut mieux qu'un geste perdu,
 * et `journal.test.ts` réclame la phrase de chacune.
 */
export function journaliser(journal: JournalDesGestes) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    res.on('finish', () => {
      if (res.statusCode >= 400) return
      const route = `${req.method} ${typeof req.route?.path === 'string' ? req.route.path : req.originalUrl.split('?')[0]}`
      const geste = res.locals.geste as GesteANoter | undefined
      journal.noter({ ...(geste ?? { sorte: 'autre', resume: route }), qui: accountOf(res).id, route })
    })
    next()
  }
}

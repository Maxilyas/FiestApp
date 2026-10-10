// Les lots de la base de la campagne, qui attendent leur rangement hors du
// dépôt : ce que `base-campagne.ts` (à la main) et `generer-campagne.ts` (par
// l'API) en partagent — les lire, les juger comme le rangement les jugera,
// en faire la fiche de relecture, appliquer ses décisions. Deux copies de ces
// règles finiraient par dire deux choses : un lot accepté ici serait écarté
// au rangement.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../src/racine'
import { lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { IndexDesFaits, motifDuMemeFait } from '../src/core/memeFait'

/** Les lots attendent à côté du dépôt, dans un dossier que git ignore : rien n'y est committé. */
export const DOSSIER_DES_LOTS = path.join(SERVEUR, '..', '.lots-campagne')

/** Le fichier d'un lot : un nom de lettres et de chiffres, un tiret, un numéro (`geo1-01.json`). */
export const FICHIER_DE_LOT = /^[A-Za-z0-9]+-\d+\.json$/

export function lireLot(fichier: string): unknown[] {
  const brut = JSON.parse(readFileSync(fichier, 'utf8')) as unknown
  if (!Array.isArray(brut)) throw new Error(`${fichier} : un tableau JSON est attendu`)
  return brut
}

/** Un lot s'écrit une entrée par ligne : il se relit, et se corrige à la main. */
export function ecrireLot(fichier: string, entrees: readonly unknown[]) {
  writeFileSync(fichier, `[\n${entrees.map(e => JSON.stringify(e)).join(',\n')}\n]\n`)
}

/** Pourquoi une entrée n'entrerait pas : le juge de la base, ou ce qui la double. */
export type SorteDeRefus = 'juge' | 'doublon' | 'base' | 'livre' | 'fait'

export type Jugement = { question: QuestionDeLaBase } | { refus: string; sorte: SorteDeRefus }

/**
 * Ce que le rangement refuserait, dans l'ordre où il le vérifie : le juge de
 * la base (`lireQuestionDeLaBase`), puis le même intitulé — dans les lots
 * jugés ensemble, dans la base, dans un quiz livré —, puis le même fait sous
 * un autre (`IndexDesFaits`). Une entrée acceptée rejoint ce qu'elle tient à
 * l'écart : deux lots jugés ensemble ne se doublent pas.
 */
export class TriDesEntrees {
  private readonly dansLaBase: ReadonlySet<string>
  private readonly vues = new Map<string, string>()
  private readonly faits: IndexDesFaits<QuestionDeLaBase>

  constructor(
    base: readonly QuestionDeLaBase[],
    private readonly livres: ReadonlySet<string>,
  ) {
    this.dansLaBase = new Set(base.map(q => q.empreinte))
    this.faits = new IndexDesFaits(base)
  }

  /** Une question déjà jugée, qui attend son rangement : les suivantes ne la doublent pas. */
  retenir(q: QuestionDeLaBase, ou: string) {
    this.vues.set(q.empreinte, ou)
    this.faits.ajouter(q)
  }

  juger(brut: unknown, ou: string): Jugement {
    const lu = lireQuestionDeLaBase(brut, { sansId: true })
    if ('refus' in lu) return { refus: lu.refus, sorte: 'juge' }
    const q = lu.question
    const deja = this.vues.get(q.empreinte)
    if (deja) return { refus: `doublon de ${deja}`, sorte: 'doublon' }
    if (this.dansLaBase.has(q.empreinte)) return { refus: 'déjà dans la base', sorte: 'base' }
    if (this.livres.has(q.empreinte)) return { refus: 'déjà dans un quiz livré', sorte: 'livre' }
    const memeFait = this.faits.chercher(q)
    if (memeFait) return { refus: motifDuMemeFait(memeFait), sorte: 'fait' }
    this.retenir(q, ou)
    return { question: q }
  }
}

/** Une question d'un lot en attente, et où elle est. */
export interface EnAttente {
  question: QuestionDeLaBase
  ou: string
}

/**
 * Les questions des lots qui attendent dans le dossier, celles que le juge
 * accepte — sauf les fichiers nommés, et sauf ce que la base a déjà : un lot
 * rangé reste dans le dossier, et compté deux fois il fausserait la commande
 * de ce qui manque. Ce qu'un nouveau lot ne doit pas doubler.
 */
export function lotsEnAttente(dossier: string, dansLaBase: ReadonlySet<string>, sauf: ReadonlySet<string> = new Set()): EnAttente[] {
  if (!existsSync(dossier)) return []
  const enAttente: EnAttente[] = []
  for (const f of readdirSync(dossier).sort()) {
    if (!FICHIER_DE_LOT.test(f) || sauf.has(f)) continue
    let entrees: unknown[]
    try {
      entrees = lireLot(path.join(dossier, f))
    } catch {
      // Un lot qu'on est en train d'écrire à la main : il se relira à son tour.
      continue
    }
    entrees.forEach((brut, i) => {
      const lu = lireQuestionDeLaBase(brut, { sansId: true })
      if ('question' in lu && !dansLaBase.has(lu.question.empreinte)) enAttente.push({ question: lu.question, ou: `${f}#${i}` })
    })
  }
  return enAttente
}

/**
 * Une entrée telle que la relecture la lit : l'intitulé, la bonne réponse,
 * les autres, l'anecdote, l'explication, la difficulté — sans les
 * métadonnées qui ne se vérifient pas d'un coup d'œil. Trois à quatre fois
 * moins à lire que le lot lui-même.
 */
export function ficheDUneEntree(ref: string, brut: unknown): string {
  const e = brut as Record<string, any>
  const juste = e.reponses?.[e.bonne]
  const autres = (e.reponses ?? []).filter((_: unknown, j: number) => j !== e.bonne).join(' | ')
  const lignes = [`[${ref}] (${e.sousTheme}, d${e.difficulte}, ${e.ageMin} ans) ${e.texte}`, `  ✓ ${juste}   ✗ ${autres}`]
  if (e.anecdote) lignes.push(`  Anecdote : ${e.anecdote}`)
  if (e.explication) lignes.push(`  Explication : ${e.explication}`)
  return lignes.join('\n')
}

/** Une décision de relecture : `ref` vaut `<fichier du lot>#<position>`. */
export interface Decision {
  ref: string
  action: 'retirer' | 'corriger'
  champs?: Record<string, unknown>
  motif?: string
}

/** Ce qu'une relecture corrige : jamais une réponse — une réponse douteuse retire la question, dans le doute. */
export const CHAMPS_CORRIGEABLES: readonly string[] = ['anecdote', 'explication', 'difficulte', 'texte']

/**
 * Applique des décisions de relecture à des lots en mémoire (le nom du
 * fichier → ses entrées) et rend les lots qu'elles touchent, sans leurs
 * retirées. Une correction que le juge refuse retire la question aussi. Les
 * positions sont celles des lots avant la relecture : les retraits se font
 * à la fin, d'un coup.
 */
export function appliquerLesDecisions(
  decisions: readonly Decision[],
  lots: ReadonlyMap<string, readonly unknown[]>,
): { lots: Map<string, unknown[]>; corrigees: number; retirees: number } {
  const touches = new Map<string, unknown[]>()
  const aRetirer = new Map<string, Set<number>>()
  let corrigees = 0
  for (const d of decisions) {
    const [nom, n] = d.ref.split('#')
    const index = Number(n)
    const lot = lots.get(nom)
    if (!lot) throw new Error(`référence inconnue : ${d.ref}`)
    const entrees = touches.get(nom) ?? touches.set(nom, [...lot]).get(nom)!
    if (!Number.isInteger(index) || !entrees[index]) throw new Error(`référence inconnue : ${d.ref}`)
    const retirer = () => (aRetirer.get(nom) ?? aRetirer.set(nom, new Set()).get(nom)!).add(index)
    if (d.action === 'retirer') retirer()
    else if (d.action === 'corriger') {
      const champs = Object.fromEntries(Object.entries(d.champs ?? {}).filter(([k]) => CHAMPS_CORRIGEABLES.includes(k)))
      const corrigee = { ...(entrees[index] as object), ...champs }
      if ('refus' in lireQuestionDeLaBase(corrigee, { sansId: true })) retirer()
      else {
        entrees[index] = corrigee
        corrigees++
      }
    } else throw new Error(`action inconnue : ${String(d.action)} (${d.ref})`)
  }
  let retirees = 0
  for (const [nom, entrees] of touches) {
    const sortir = aRetirer.get(nom) ?? new Set()
    retirees += sortir.size
    touches.set(nom, entrees.filter((_, i) => !sortir.has(i)))
  }
  return { lots: touches, corrigees, retirees }
}

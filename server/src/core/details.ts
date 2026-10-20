// Ce que tire le détail de l'Expédition (la version 15, le 20 octobre 2026) :
// cent tableaux du domaine public, quatre cadrages chacun du détail au
// tableau entier (`server/content/details/`, la PR des images), et la
// question de la base qui demande qui l'a peint. La fiche se lit une fois par
// processus ; un tableau dont un cadrage manque s'écarte avec son motif au
// journal, plutôt que de montrer une image cassée. La question vient de la
// base, à chaque base : retirée, ou absente d'une base d'essai, le tableau ne
// se pose pas. Les images ne sont jamais des fichiers statiques — servies à
// leur heure par la route du détail (invariant 1). Les règles pures :
// `shared/expedition.ts` (« Le détail ») ; le brief :
// `retours/2026-10-20/le-detail.md`.

import fs from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import { CADRAGES_DU_DETAIL } from '../../../shared/expedition'
import { sansAccent } from '../../../shared/homonymes'
import type { QuestionDeLaBase } from './baseCampagne'

const DOSSIER = path.join(SERVEUR, 'content/details')

/** Un tableau de la fiche (`tableaux.json`) : ce que le détail en lit. */
export interface TableauDuDetail {
  /** Son identifiant Wikidata : le nom de ses cadrages, qui ne quitte jamais le serveur avant le verdict. */
  qid: string
  titre: string
  peintre: string
  annee: number
  /** Les questions de la base qui le demandent — « Qui a peint… ? », ses dimensions, son musée. */
  questions: string[]
}

let lus: readonly TableauDuDetail[] | null = null

/** Le fichier d'un cadrage (de 1, le détail, à `CADRAGES_DU_DETAIL`, le tableau entier). */
export const fichierDuCadrage = (qid: string, cadrage: number) => path.join(DOSSIER, `${qid}-${cadrage}.webp`)

/** Les tableaux de la fiche, lus du disque la première fois ; aucun si elle manque ou ne se lit pas — le journal le dit. */
export function tableauxDuDetail(): readonly TableauDuDetail[] {
  if (lus) return lus
  let brut: unknown = []
  try {
    brut = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'tableaux.json'), 'utf8'))
  } catch (e) {
    console.warn('[details] tableaux.json illisible : le détail s’en passera —', e instanceof Error ? e.message : e)
  }
  const tableaux: TableauDuDetail[] = []
  for (const x of Array.isArray(brut) ? brut : []) {
    const t = x as Partial<TableauDuDetail>
    // Le QID nomme un fichier : rien d'autre qu'un Q et des chiffres n'y entre.
    const refus =
      typeof t?.qid !== 'string' || !/^Q\d+$/.test(t.qid)
        ? 'pas d’identifiant'
        : typeof t.titre !== 'string' || typeof t.peintre !== 'string' || typeof t.annee !== 'number' || !Array.isArray(t.questions)
          ? 'fiche incomplète'
          : Array.from({ length: CADRAGES_DU_DETAIL }, (_, k) => k + 1).find(k => !fs.existsSync(fichierDuCadrage(t.qid!, k)))
            ? 'un cadrage manque'
            : null
    if (refus) console.warn(`[details] tableau écarté (${t?.qid ?? '?'}) : ${refus}`)
    else tableaux.push({ qid: t.qid!, titre: t.titre!, peintre: t.peintre!, annee: t.annee!, questions: t.questions!.map(String) })
  }
  lus = tableaux
  return lus
}

/** Un tableau qui se pose dans cette base : lui, et sa question « Qui a peint… ? ». */
export interface DetailDeLaBase {
  tableau: TableauDuDetail
  question: QuestionDeLaBase
}

/**
 * Les tableaux que cette base pose, chacun avec sa question qui demande son
 * peintre : quatre choix, et la bonne réponse une personne de la question
 * (ses entités) — la base écrit « Pierre-Auguste Renoir » là où la fiche dit
 * « Auguste Renoir ». Ses autres questions — sa largeur, son musée — ne
 * demandent pas « Qui l'a peint ? ».
 */
export function detailsDeLaBase(parId: ReadonlyMap<string, QuestionDeLaBase>): DetailDeLaBase[] {
  return tableauxDuDetail().flatMap(tableau => {
    for (const id of tableau.questions) {
      const q = parId.get(id)
      if (q && demandeLePeintre(q)) return [{ tableau, question: q }]
    }
    return []
  })
}

/** Cette question demande-t-elle qui a peint : quatre choix, et sa bonne réponse une personne qu'elle nomme dans ses entités ? */
export function demandeLePeintre(q: QuestionDeLaBase): boolean {
  if (q.reponses.length !== 4) return false
  const juste = sansAccent(q.reponses[q.bonne])
  return q.meta.entites.some(e => e.type === 'personne' && sansAccent(e.nom) === juste)
}

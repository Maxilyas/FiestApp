// Ce que tire la frise de l'Expédition (la version 13, le 20 octobre 2026) :
// ses événements, chacun une question datée de la base récrite en une ligne
// (`server/content/frises/evenements.json`). Le fichier se lit une fois par
// processus ; une ligne qui daterait l'événement s'écarte avec son motif au
// journal, plutôt que d'arriver sur un téléphone. L'année et la catégorie
// viennent de la base, à chaque base : une question retirée, ou une base
// d'essai qui ne l'a pas, n'en donne aucun. Les règles pures :
// `shared/frise.ts` ; le brief : `retours/2026-10-20/la-frise.md`.

import fs from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import { refusDuLibelle, type EvenementDeLaFrise } from '../../../shared/frise'
import { anneeDe } from '../../../shared/sujets'
import type { QuestionDeLaBase } from './baseCampagne'

const FICHIER = path.join(SERVEUR, 'content/frises/evenements.json')

/** Une ligne du contenu : la question qu'elle récrit, et ce qu'elle dit. */
export interface LigneDeFrise {
  id: string
  evenement: string
}

let lues: readonly LigneDeFrise[] | null = null

/** Les lignes des frises, lues du disque la première fois ; aucune si le fichier manque ou ne se lit pas — le journal le dit. */
export function lignesDesFrises(): readonly LigneDeFrise[] {
  if (lues) return lues
  let brut: unknown = []
  try {
    brut = JSON.parse(fs.readFileSync(FICHIER, 'utf8'))
  } catch (e) {
    console.warn('[frises] evenements.json illisible : les frises s’en passeront —', e instanceof Error ? e.message : e)
  }
  const lignes: LigneDeFrise[] = []
  for (const l of Array.isArray(brut) ? brut : []) {
    const ligne = l as Partial<LigneDeFrise>
    const refus = typeof ligne?.id === 'string' ? refusDuLibelle(ligne.evenement) : 'pas d’identifiant'
    if (refus) console.warn(`[frises] événement écarté (${ligne?.id ?? '?'}) : ${refus}`)
    else lignes.push({ id: ligne.id!, evenement: ligne.evenement! })
  }
  lues = lignes
  return lues
}

/** Une question datée à l'année près : la seule dont l'année range un événement. */
const DATEES = new Set(['annee', 'mois', 'jour'])

/**
 * Les événements que cette base date : chaque ligne, avec l'année et la
 * catégorie de sa question. Une question absente de la base, ou datée au
 * siècle près, se tait.
 */
export function evenementsDeLaBase(parId: ReadonlyMap<string, QuestionDeLaBase>): EvenementDeLaFrise[] {
  return lignesDesFrises().flatMap(l => {
    const q = parId.get(l.id)
    const d = q?.meta.date
    if (!q || !d || !DATEES.has(d.precision)) return []
    const annee = anneeDe(d)
    return annee === null ? [] : [{ id: l.id, evenement: l.evenement, annee, categorie: q.meta.categorie }]
  })
}

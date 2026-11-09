// Le lot d'un rédacteur, vérifié avant qu'il le rende : chaque question de l'entrée, dans l'ordre ; un indice de 100
// signes au plus, un repère de 40 ; aucun nombre trop près de la réponse, en chiffres ni en lettres — le juge à la lettre
// même du serveur (`refusDeLIndiceALaLettre`) ; une question sans indice dit pourquoi.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/indices/verifier-un-lot.mts <entrée.json> <sortie.json>
import fs from 'node:fs'
import { refusDeLIndiceALaLettre } from '../../../../server/src/core/cabinet/contenu.ts'

const [entree, sortie] = process.argv.slice(2)
const questions = JSON.parse(fs.readFileSync(entree, 'utf8')) as { id: string; valeur: number; unite: string }[]
const rendu = JSON.parse(fs.readFileSync(sortie, 'utf8')) as { id: string; indice: string | null; repere?: string | null; pourquoi?: string }[]
const fautes: string[] = []
if (!Array.isArray(rendu)) fautes.push('la sortie n’est pas un tableau JSON')
if (rendu.length !== questions.length) fautes.push(`${rendu.length} entrées pour ${questions.length} questions`)
questions.forEach((q, i) => {
  const r = rendu[i]
  if (!r || r.id !== q.id) return fautes.push(`#${i} : attendu ${q.id}, trouvé ${r?.id ?? 'rien'} (l’ordre de l’entrée, aucune oubliée)`)
  if (r.indice === null) {
    if (!r.pourquoi) fautes.push(`${q.id} : sans indice, il faut « pourquoi »`)
  } else if (typeof r.indice !== 'string' || !r.indice.trim()) fautes.push(`${q.id} : indice vide`)
  else {
    if ([...r.indice].length > 100) fautes.push(`${q.id} : indice de ${[...r.indice].length} signes (100 au plus)`)
    const refus = refusDeLIndiceALaLettre(r.indice, q.valeur, q.unite === 'année')
    if (refus) fautes.push(`${q.id} (${q.valeur}) : ${refus} — « ${r.indice} »`)
  }
  if (r.repere != null && [...r.repere].length > 40) fautes.push(`${q.id} : repère de ${[...r.repere].length} signes (40 au plus)`)
})
console.log(fautes.length === 0 ? `✓ ${rendu.length} entrées, aucune faute` : `✗ ${fautes.length} faute(s) :\n${fautes.join('\n')}`)
process.exitCode = fautes.length === 0 ? 0 : 1

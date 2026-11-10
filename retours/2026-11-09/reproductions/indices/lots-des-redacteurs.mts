// Les lots des rédacteurs d'une vague : les questions posables d'un acte qui n'ont pas encore leur ligne — ni à la
// maquette, ni aux indices du vivier —, mêlées pour qu'un lot n'ait pas qu'une catégorie, en lots égaux
// (`<vague>-lot-<k>.json`).
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/indices/lots-des-redacteurs.mts <vague> <acte> <lots>
import fs from 'node:fs'
import { hasardDe } from '../../../../shared/missions.ts'
import { dansLeTravail, dejaEcrites } from './commun.mts'

const [vague, acte, n] = process.argv.slice(2)
const posables = JSON.parse(fs.readFileSync(dansLeTravail('posables.json'), 'utf8')) as Record<string, any>[]
const deja = dejaEcrites()
const aEcrire = posables
  .filter(q => q.acte === Number(acte) && !deja.has(q.id))
  .sort((a, b) => (hasardDe(`lot:${a.id}`)() < hasardDe(`lot:${b.id}`)() ? -1 : 1))
const lots = Array.from({ length: Number(n) }, () => [] as unknown[])
aEcrire.forEach((q, i) =>
  lots[i % Number(n)].push({ id: q.id, categorie: q.categorie, question: q.question, reponse: q.reponse, valeur: q.valeur, unite: q.annee ? 'année' : q.unite, tranche: q.tranche, anecdote: q.anecdote }),
)
lots.forEach((l, i) => fs.writeFileSync(dansLeTravail(`${vague}-lot-${i + 1}.json`), JSON.stringify(l, null, 1)))
console.log(`acte ${acte} : ${aEcrire.length} questions à écrire, en ${n} lots : ${lots.map(l => l.length).join(' ')}`)

// Les lots des juges à l'aveugle : chaque indice avec sa question et les quatre tranches telles que l'écran les montrerait
// — la place de la réponse tirée parmi les places possibles —, sans la réponse (`<vague>-juge-<k>.json`). Et le corrigé,
// à part (`<vague>-corrige.json`), que le juge ne lit jamais. Mêlés, pour qu'aucun juge ne relise le lot d'un seul
// rédacteur.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/indices/lots-des-juges.mts <vague> <lots> <fichiers d'indices…>
import fs from 'node:fs'
import { hasardDe } from '../../../../shared/missions.ts'
import { placesPossibles, tranchesDuFilet } from '../../../../shared/cabinet/jeux/filetEnDeuxTemps.ts'
import { ANNEE, dansLeTravail } from './commun.mts'

const [vague, n, ...fichiers] = process.argv.slice(2)
const questions = new Map((JSON.parse(fs.readFileSync(dansLeTravail('posables.json'), 'utf8')) as Record<string, any>[]).map(q => [q.id, q]))
const indices = fichiers.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')) as { id: string; indice: string | null }[]).filter(x => x.indice)
const entrees: { id: string }[] = []
const corrige: Record<string, unknown> = {}
for (const x of indices) {
  const q = questions.get(x.id)
  if (!q) throw new Error(`question inconnue : ${x.id}`)
  const places = placesPossibles(q.valeur, q.annee, ANNEE)
  const place = places[Math.min(places.length - 1, Math.floor(hasardDe(`juge:${vague}:${x.id}`)() * places.length))]
  const c = tranchesDuFilet(q.valeur, q.annee, place, ANNEE)!
  entrees.push({ id: x.id, question: q.question, unite: q.annee ? 'année' : q.unite, indice: x.indice, tranches: c.tranches.map(t => `${t.de}–${t.a}`) } as never)
  corrige[x.id] = { valeur: q.valeur, annee: q.annee, tranches: c.tranches, bonnes: c.bonnes, anneaux: c.anneaux, indice: x.indice }
}
const melange = [...entrees].sort((a, b) => (hasardDe(`ordre:${a.id}`)() < hasardDe(`ordre:${b.id}`)() ? -1 : 1))
const lots = Array.from({ length: Number(n) }, () => [] as unknown[])
melange.forEach((e, i) => lots[i % Number(n)].push(e))
lots.forEach((l, i) => fs.writeFileSync(dansLeTravail(`${vague}-juge-${i + 1}.json`), JSON.stringify(l, null, 1)))
fs.writeFileSync(dansLeTravail(`${vague}-corrige.json`), JSON.stringify(corrige))
console.log(`${entrees.length} indices en ${n} lots : ${lots.map(l => l.length).join(' ')}`)

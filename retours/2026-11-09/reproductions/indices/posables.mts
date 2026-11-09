// Les questions posables au nouveau Filet, par acte, avec la tranche de leur réponse : l'entrée des vagues d'indices
// (`posables.json`, dans le dossier de travail). L'acte : 1 si chaque Français la sait placer ou si le panel la donne à
// 50 % et plus, 2 de 25 à 49, 3 sous 25 (`acteDuFilet`, compté ici de 1 à 3) ; ce qui se calcule n'y entre pas.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/indices/posables.mts
import fs from 'node:fs'
import path from 'node:path'
import { lireLaBase } from '../../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../../server/src/core/cabinet/tirages/tas.ts'
import { placesPossibles, seTendEnDeuxTemps, tranchesDuFilet } from '../../../../shared/cabinet/jeux/filetEnDeuxTemps.ts'
import { ANNEE, RETOURS, TRAVAIL, dansLeTravail } from './commun.mts'

const lire = (f: string) => JSON.parse(fs.readFileSync(path.join(RETOURS, f), 'utf8'))
const classe = new Map((lire('vivier-du-filet.json') as { id: string; chacun: boolean; calcul: boolean }[]).map(a => [a.id, a]))
const note = new Map((lire('panel-du-vivier.json') as { id: string; estimation: number }[]).map(n => [n.id, n.estimation]))
const sortie: unknown[] = []
for (const q of lireLaBase().questions) {
  const c = classe.get(q.id)
  if ((q.meta.aRelire ?? []).length || !c || c.calcul) continue
  const v = valeurDuFilet(q)
  if (!v || !seTendEnDeuxTemps(v.valeur, v.annee, ANNEE)) continue
  const n = note.get(q.id) ?? 0
  const acte = c.chacun || n >= 50 ? 1 : n >= 25 ? 2 : 3
  // La tranche de la réponse : la même quelle que soit la place tirée (une grandeur pile sur une borne en a deux).
  const cadre = tranchesDuFilet(v.valeur, v.annee, placesPossibles(v.valeur, v.annee, ANNEE)[0], ANNEE)!
  const tranche = cadre.bonnes.map(i => `${cadre.tranches[i].de}–${cadre.tranches[i].a}`).join(' ou ')
  sortie.push({ id: q.id, acte, categorie: q.meta.categorie, question: q.texte, reponse: q.reponses[q.bonne] ?? null, anecdote: q.anecdote ?? null, valeur: v.valeur, annee: v.annee, unite: v.unite ?? null, tranche })
}
fs.mkdirSync(TRAVAIL, { recursive: true })
fs.writeFileSync(dansLeTravail('posables.json'), JSON.stringify(sortie, null, 1))
console.log(`${sortie.length} questions posables en ${ANNEE} → ${dansLeTravail('posables.json')}`)

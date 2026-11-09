// Combien des questions que le Filet peut poser se calculent ou se convertissent ? (`../le-nouveau-filet.md`, § 5.4)
// Une estimation par les mots de l'énoncé — une conversion d'unités, un calcul, une définition d'école —, relue à la
// main sur la maquette : ses 16 questions de cette sorte, sur 156, y sont toutes ; ici, la liste entière s'imprime
// pour qu'on la relise. Le panel les marquera mieux, en notant : ce compte-ci n'en donne que l'ordre de grandeur.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/calculs-du-vivier.mts
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../server/src/core/cabinet/tirages/tas.ts'

const UNITES = '(?:secondes?|minutes?|heures?|jours?|semaines?|mois|ans|années?|millimètres?|centimètres?|décimètres?|mètres?|kilomètres?|grammes?|kilos?|kilogrammes?|tonnes?|litres?|centilitres?|millilitres?|degrés|grades|octets?|bits?|cm²|m²|mètres carrés|centimètres carrés|hectares?|ares?)'
const MOTIFS: [string, RegExp][] = [
  ['une conversion', new RegExp(`combien (?:de |d['’])${UNITES}.{0,30}(?:dans|compte|contient|fait|y a-t-il dans|vaut|valent) (?:un|une|le|la)\\s+${UNITES}`, 'i')],
  ['une conversion', new RegExp(`combien (?:de |d['’])${UNITES} (?:compte|contient|fait|vaut) (?:un|une)\\s+${UNITES}`, 'i')],
  // Pas de `\b` : en JavaScript, il ne connaît que l'ASCII, et « le carré » ou « × » ne s'y terminaient jamais.
  ['un calcul', /(?:le carré|au carré|carrés parfaits|la racine|nombre premier|diviseurs?|multiple de|combien font|fois \d|×|somme des)(?![\p{L}\p{N}])/iu],
  ['une définition d’école', /(?:angles? d['’]un triangle|tour complet|angle droit|année ordinaire|non bissextile)(?![\p{L}\p{N}])/iu],
]
const base: any = lireLaBase()
let vivier = 0
const trouves: string[] = []
for (const q of base.questions as any[]) {
  if (!valeurDuFilet(q)) continue
  vivier++
  const motif = MOTIFS.find(([, re]) => re.test(q.texte))
  if (motif) trouves.push(`${motif[0].padEnd(24)} ${q.texte}`)
}
console.log(`${vivier} questions que le Filet peut poser ; ${trouves.length} se calculent ou se convertissent, d'après leurs mots (${((100 * trouves.length) / vivier).toFixed(1)} %)\n`)
for (const t of trouves.sort()) console.log(`  ${t}`)

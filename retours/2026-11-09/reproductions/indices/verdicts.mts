// Le verdict de chaque indice, de ce que le juge à l'aveugle en a lu (`<vague>-juge-<k>-lu.json` : la fourchette qu'il en
// tire, la tranche qu'il choisirait), contre le corrigé :
// - « valeur » : ses deux bouts tiennent à deux étoiles de la réponse — il la donne ;
// - « étroit » : plus serré que la tranche, son milieu paie deux étoiles que le milieu de la tranche ne payait pas — « plus
//   large qu'un lit d'une place (90 cm), moins qu'un très grand lit (180 cm) » pour 140 cm, la tranche 100–300 ;
// - « erreur » : il mène à une mauvaise tranche ; « penche » : son milieu tombe dans la voisine, plus loin que deux étoiles ;
// - « large » : la bonne tranche, sans fourchette ou plus de deux fois et demie plus large qu'elle — gardé ;
// - « tranche » : la bonne, toute la bonne — le but.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/indices/verdicts.mts <vague> <lots>
import fs from 'node:fs'
import { ecartEnPourCent } from '../../../../shared/cabinet/jeux/filetEnDeuxTemps.ts'
import { dansLeTravail } from './commun.mts'

type Tranche = { de: number; a: number }
const [vague, n] = process.argv.slice(2)
const corrige = JSON.parse(fs.readFileSync(dansLeTravail(`${vague}-corrige.json`), 'utf8')) as Record<string, any>
const lus = Array.from({ length: Number(n) }, (_, i) => JSON.parse(fs.readFileSync(dansLeTravail(`${vague}-juge-${i + 1}-lu.json`), 'utf8')) as any[]).flat()
const dansLesDeux = (c: any, x: number) => (c.annee ? Math.abs(x - c.valeur) <= c.anneaux.deux : ecartEnPourCent(x, c.valeur) <= c.anneaux.deux)
const trancheDe = (c: any, x: number) => c.tranches.findIndex((t: Tranche) => x >= t.de && x <= t.a)
const largeur = (t: Tranche) => t.a - t.de
const verdicts: Record<string, { verdict: string; lu: string; de: number | null; a: number | null; tranche: number }> = {}
const compte: Record<string, number> = {}
for (const l of lus) {
  const c = corrige[l.id]
  if (!c) continue
  const fourchette = typeof l.de === 'number' && typeof l.a === 'number' && l.de <= l.a
  const milieu = fourchette ? (l.de + l.a) / 2 : null
  const bonne: Tranche = c.tranches[c.bonnes[0]]
  let verdict = 'tranche'
  if (fourchette && l.de <= c.valeur && l.a >= c.valeur && dansLesDeux(c, l.de) && dansLesDeux(c, l.a)) verdict = 'valeur'
  else if (milieu !== null && l.a - l.de < 0.6 * largeur(bonne) && dansLesDeux(c, milieu) && !dansLesDeux(c, (bonne.de + bonne.a) / 2)) verdict = 'etroit'
  else if (!c.bonnes.includes(l.tranche)) verdict = 'erreur'
  else if (milieu !== null && !c.bonnes.includes(trancheDe(c, milieu)) && !dansLesDeux(c, milieu)) verdict = 'penche'
  else if (!fourchette || l.a - l.de > 2.5 * largeur(bonne)) verdict = 'large'
  verdicts[l.id] = { verdict, lu: l.lu, de: l.de ?? null, a: l.a ?? null, tranche: l.tranche }
  compte[verdict] = (compte[verdict] ?? 0) + 1
}
const manquent = Object.keys(corrige).filter(id => !verdicts[id])
fs.writeFileSync(dansLeTravail(`${vague}-verdicts.json`), JSON.stringify(verdicts, null, 1))
console.log(`${Object.keys(verdicts).length} indices jugés${manquent.length ? `, ${manquent.length} sans verdict` : ''} :`, compte)

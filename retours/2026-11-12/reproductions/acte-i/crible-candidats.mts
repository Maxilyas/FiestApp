// Le crible des faits candidats : pour chaque ligne {categorie, texte, reponse, valeur, unite, mots}, la valeur est-elle posable
// au Filet (année de 1001 à 2001, grandeur d'au moins 10), neuve dans sa catégorie à l'acte I et dans la liste, et le fait
// n'est-il pas déjà dans la base — une question dont l'intitulé écrit la valeur et nomme un des mots, ou dont la bonne
// réponse est cette valeur et l'intitulé nomme un des mots ?
//   cd server && node --import tsx ../retours/2026-11-12/reproductions/acte-i/crible-candidats.mts <candidats.json> [--ecrire=<sortie.json>]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../../server/src/core/cabinet/tirages/tas.ts'
import { seTendEnDeuxTemps, sePoseALActe } from '../../../../shared/cabinet/jeux/filetEnDeuxTemps.ts'
const sans = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'")
const base = ((lireLaBase() as any).questions as any[]).map(q => ({ q, texte: sans(q.texte), bonne: sans(q.reponses[q.bonne]), nombre: q.meta.valeur?.nombre as number | undefined }))
const filet = new Map((JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../server/content/cabinet/filet.json'), 'utf8')) as any[]).map(e => [e.id, e]))
const pris = new Map<string, Set<number>>()
for (const { q } of base) {
  const e = filet.get(q.id); if (!e || !sePoseALActe(e, 0)) continue
  const v = valeurDuFilet(q); if (!v || !seTendEnDeuxTemps(v.valeur, v.annee, 2026)) continue
  const s = pris.get(q.meta.categorie) ?? new Set(); s.add(v.valeur); pris.set(q.meta.categorie, s)
}
const ecritDans = (valeur: number, texte: string) => {
  const chiffres = String(Math.trunc(valeur)).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00a0\\u202f]?')
  return new RegExp(`(^|[^\\d,.])${chiffres}(?![\\d])`).test(texte)
}
const f = process.argv[2]
const sortie = process.argv.find(a => a.startsWith('--ecrire='))?.slice(9)
const sortieBloquees = process.argv.find(a => a.startsWith('--bloquees='))?.slice(11)
const bloquees: any[] = []
const lignes = JSON.parse(fs.readFileSync(f, 'utf8')) as any[]
const gardees: any[] = []
const dansLaListe = new Map<string, Set<number>>()
let refus = 0
lignes.forEach((c, i) => {
  const nom = `#${i} ${String(c.texte).slice(0, 60)}`
  const non = (m: string) => { console.log(`${nom} → ÉCARTÉE : ${m}`); refus++ }
  if (!c.categorie || typeof c.valeur !== 'number' || !Array.isArray(c.mots) || !c.mots.length || !c.texte || !c.reponse) return non('champs manquants (categorie, texte, reponse, valeur, mots)')
  const an = c.unite === '' || c.unite === undefined
  if (an && !(Number.isInteger(c.valeur) && c.valeur >= 1001 && c.valeur <= 2001)) return non(`année hors 1001–2001 (${c.valeur})`)
  if (!an && c.valeur < 10) return non(`grandeur sous 10 (${c.valeur})`)
  if (sans(c.texte).includes(String(c.valeur))) return non('l’intitulé écrit la valeur')
  if (pris.get(c.categorie)?.has(c.valeur)) return non(`valeur ${c.valeur} déjà prise à l'acte I en ${c.categorie}`)
  const d = dansLaListe.get(c.categorie) ?? new Set(); dansLaListe.set(c.categorie, d)
  if (d.has(c.valeur)) return non(`valeur ${c.valeur} déjà dans cette liste`)
  const mots: string[] = c.mots.map(sans)
  const deja = base.find(b => mots.some(m => b.texte.includes(m)) && (ecritDans(c.valeur, b.texte) || b.nombre === c.valeur || ecritDans(c.valeur, b.bonne)))
  if (deja) { bloquees.push({ ...c, bloquee: deja.q.texte, bloqueeId: deja.q.id }); return non(`déjà dans la base : « ${deja.q.texte.slice(0, 90)} » → ${deja.q.reponses[deja.q.bonne]}`) }
  d.add(c.valeur); gardees.push(c)
})
console.log(`${gardees.length} candidates gardées sur ${lignes.length}, ${refus} écartées`)
if (sortie) fs.writeFileSync(sortie, JSON.stringify(gardees, null, 1))
if (sortieBloquees) fs.writeFileSync(sortieBloquees, JSON.stringify(bloquees, null, 1))
process.exitCode = refus ? 1 : 0

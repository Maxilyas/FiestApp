// Le classement à l'aveugle des FAITS candidats (avant d'écrire la moindre question complète) : chaque lot mêle des faits
// que le crible a gardés (`gis-<cat>.gardees.json`) à douze étalons de la passe qui fait foi — des questions de la base dont
// le classement est connu —, pour mesurer l'accord de l'agent. L'agent ne voit que l'intitulé, la bonne réponse et la forme.
//
//   cd server && ICI=/chemin node --import tsx ../retours/2026-11-12/reproductions/acte-i/lots-de-classement-des-faits.mts [--par-lot=130]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../../server/src/core/cabinet/tirages/tas.ts'

const NEUF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../2026-11-09')
const LOTS = '/home/user/FiestApp/.lots-campagne'
const SORTIE = process.env.ICI ?? path.join(LOTS, 'notation')
// `--bloquees` : les faits que le crible a écartés parce que la base les pose déjà (`gis-<cat>.bloquees.json`), classés de même — pour savoir
// combien de faits connus de chaque Français la règle des redites chiffrées ferme.
const BLOQUEES = process.argv.includes('--bloquees')
const PREFIXE = BLOQUEES ? 'bloq' : 'faits'
const PAR_LOT = Number(process.argv.find(a => a.startsWith('--par-lot='))?.split('=')[1] ?? 130)
const lire = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as any[]
let graine = 20261113
const hasard = () => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const battre = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

const faits: any[] = []
for (const f of fs.readdirSync(LOTS).filter(f => (BLOQUEES ? /^gis-[a-z]+\.bloquees\.json$/ : /^gis-[a-z]+\.gardees\.json$/).test(f)).sort()) {
  const abrev = f.match(/^gis-([a-z]+)\./)![1]
  lire(path.join(LOTS, f)).forEach((c, i) => faits.push({ ...c, id: `${BLOQUEES ? 'b' : ''}${abrev}${String(i + 1).padStart(3, '0')}` }))
}
fs.writeFileSync(path.join(SORTIE, `${PREFIXE}.json`), JSON.stringify(faits, null, 1))
console.log(`${faits.length} faits candidats`)

const classe = new Map(lire(path.join(NEUF, 'vivier-du-filet.json')).map(a => [a.id, a]))
const reference = new Set(lire(path.join(NEUF, 'maquette-filet/ancrage.json')).map(a => a.id))
const base = (lireLaBase() as any).questions as any[]
const categories = new Set(faits.map(f => f.categorie))
const candidats = base.filter(q => reference.has(q.id) && classe.has(q.id) && valeurDuFilet(q) && !(q.meta.aRelire ?? []).length)
const prendre = (oui: boolean, n: number, source = candidats) => battre(source.filter(q => !!classe.get(q.id).chacun === oui && !classe.get(q.id).calcul)).slice(0, n)
// Des exemples visibles — quatorze « chacun » avec la raison que la passe de référence en donnait, quatorze qui ne le sont pas —
// pour que la consigne se cale sur elle (le 12 novembre 2026 : sans eux, cinq agents ne retrouvaient que 2 des 6 vrais « chacun »,
// la fenêtre de 6 ans se gagnant en connaissant l'époque, pas l'année exacte) ; puis des étalons AVEUGLES, pris hors d'eux.
const exemples = [...prendre(true, 14), ...prendre(false, 14, candidats.filter(q => categories.has(q.meta.categorie)))]
const sansExemple = (q: any) => !exemples.includes(q)
const etalons = [...prendre(true, 6, candidats.filter(sansExemple)), ...prendre(false, 6, candidats.filter(q => sansExemple(q) && categories.has(q.meta.categorie)))]
fs.writeFileSync(path.join(SORTIE, 'classer.exemples.md'), [
  'EXEMPLES DE LA PASSE DE RÉFÉRENCE (leur classement fait foi : cale-toi dessus, et écris les tiens avec la même mesure)',
  '',
  'Chaque Français les sait placer (chacun = true) :',
  ...exemples.filter(q => classe.get(q.id).chacun).map(q => `- ${q.texte} → ${q.reponses[q.bonne]}  [${classe.get(q.id).source} : ${classe.get(q.id).pourquoi}]`),
  '',
  'Pas « chacun » (chacun = false) :',
  ...exemples.filter(q => !classe.get(q.id).chacun).map(q => `- ${q.texte} → ${q.reponses[q.bonne]}`),
  '',
].join('\n'))
const montreQ = (q: any) => ({ id: q.id, categorie: q.meta.categorie, texte: q.texte, reponse: q.reponses[q.bonne], forme: valeurDuFilet(q)!.annee ? 'année' : 'grandeur' })
const montreF = (f: any) => ({ id: f.id, categorie: f.categorie, texte: f.texte, reponse: f.reponse, forme: f.unite ? 'grandeur' : 'année' })
const attendu = Object.fromEntries(etalons.map(q => [q.id, { chacun: !!classe.get(q.id).chacun, ancrage: classe.get(q.id).ancrage, calcul: !!classe.get(q.id).calcul }]))
fs.writeFileSync(path.join(SORTIE, `${PREFIXE}-etalons.json`), JSON.stringify(attendu, null, 1))
const lots = Math.max(1, Math.ceil(faits.length / PAR_LOT))
const melanges = battre(faits)
for (let k = 0; k < lots; k++) {
  const siens = melanges.slice(Math.floor((k * faits.length) / lots), Math.floor(((k + 1) * faits.length) / lots))
  fs.writeFileSync(path.join(SORTIE, `${PREFIXE}-${k + 1}.json`), JSON.stringify(battre([...siens.map(montreF), ...etalons.map(montreQ)]), null, 1))
  console.log(`lot ${k + 1} : ${siens.length} faits + ${etalons.length} étalons`)
}

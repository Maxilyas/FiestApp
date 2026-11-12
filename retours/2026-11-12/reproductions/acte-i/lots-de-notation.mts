// Les lots du classement à l'aveugle et du panel pour les questions du Filet qui n'ont encore ni l'un ni l'autre
// (`../../../2026-11-09/vivier-du-filet.json`, `panel-du-vivier.json`) : chaque lot mêle ses questions neuves à des étalons
// de la première passe, dont la note est connue — douze au classement, vingt au panel —, pour mesurer l'accord de l'agent
// et recaler sa passe (`../../../2026-11-09/reproductions/panel-du-vivier.mts`). Rien de la note d'un étalon ne paraît
// dans le lot : l'agent ne voit que la question et sa bonne réponse.
//
//   cd server && ICI=/chemin/du/dossier node --import tsx ../retours/2026-11-12/reproductions/acte-i/lots-de-notation.mts [--par-lot=110] [--simuler=40]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../../server/src/core/cabinet/tirages/tas.ts'

const ICI_DU_SCRIPT = path.dirname(fileURLToPath(import.meta.url))
const NEUF = path.resolve(ICI_DU_SCRIPT, '../../../2026-11-09')
const SORTIE = process.env.ICI ?? '/home/user/FiestApp/.lots-campagne/notation'
const arg = (nom: string, defaut: number) => Number(process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=')[1] ?? defaut)
const PAR_LOT = arg('par-lot', 110)
const SIMULER = arg('simuler', 0)
const lire = (f: string) => JSON.parse(fs.readFileSync(path.resolve(NEUF, f), 'utf8')) as any[]

// Un hasard à graine : les lots se refont à l'identique.
let graine = 20261112
const hasard = () => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const battre = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

const classe = new Map(lire('vivier-du-filet.json').map(a => [a.id, a]))
const notes = lire('panel-du-vivier.json')
const base = (lireLaBase() as any).questions as any[]
const parId = new Map(base.map(q => [q.id, q]))
const vivier = base.filter(q => !(q.meta.aRelire ?? []).length && valeurDuFilet(q))
let sans = vivier.filter(q => !classe.has(q.id) || !notes.some(n => n.id === q.id))
if (SIMULER) sans = battre(vivier).slice(0, SIMULER)
console.log(`${vivier.length} questions jouables au Filet, ${sans.length} à classer et à noter`)

const montrer = (q: any) => ({ id: q.id, categorie: q.meta.categorie, texte: q.texte, reponse: q.reponses[q.bonne], forme: valeurDuFilet(q)!.annee ? 'année' : 'grandeur' })

// Étalons du classement : de la passe qui fait foi (`maquette-filet/ancrage.json`), dans les catégories des questions neuves.
const reference = new Set((JSON.parse(fs.readFileSync(path.resolve(NEUF, 'maquette-filet/ancrage.json'), 'utf8')) as any[]).map(a => a.id))
const categories = new Set(sans.map(q => q.meta.categorie))
const candidats = vivier.filter(q => reference.has(q.id) && classe.has(q.id) && !sans.includes(q))
const prendre = (oui: boolean, n: number, source = candidats) => battre(source.filter(q => !!classe.get(q.id).chacun === oui && !classe.get(q.id).calcul)).slice(0, n)
const etalonsDuClassement = [...prendre(true, 6), ...prendre(false, 6, candidats.filter(q => categories.has(q.meta.categorie)))]
fs.writeFileSync(path.join(SORTIE, 'classer-etalons.json'), JSON.stringify(Object.fromEntries(etalonsDuClassement.map(q => [q.id, { chacun: !!classe.get(q.id).chacun, ancrage: classe.get(q.id).ancrage, calcul: !!classe.get(q.id).calcul }])), null, 1))

// Étalons du panel : la première passe, vingt questions prises sur toute son échelle (une droite se tient aux deux bouts) —
// les mêmes vingt que les troisième et quatrième passes (`etalon3`, `etalon4`).
const etalonsDuPanel = notes.filter(n => n.etalon3 && n.p1).map(n => parId.get(n.id)).filter(Boolean)
fs.writeFileSync(path.join(SORTIE, 'panel-etalons.json'), JSON.stringify(Object.fromEntries(etalonsDuPanel.map(q => [q.id, notes.find(n => n.id === q.id).p1.estimation])), null, 1))

const lots = Math.max(1, Math.ceil(sans.length / PAR_LOT))
const parts = battre(sans)
for (let k = 0; k < lots; k++) {
  const siens = parts.slice(Math.floor((k * sans.length) / lots), Math.floor(((k + 1) * sans.length) / lots))
  fs.writeFileSync(path.join(SORTIE, `classer-${k + 1}.json`), JSON.stringify(battre([...siens, ...etalonsDuClassement]).map(montrer), null, 1))
  fs.writeFileSync(path.join(SORTIE, `panel-${k + 1}.json`), JSON.stringify(battre([...siens, ...etalonsDuPanel]).map(montrer), null, 1))
  console.log(`lot ${k + 1} : ${siens.length} neuves + ${etalonsDuClassement.length} étalons (classement), ${etalonsDuPanel.length} (panel)`)
}

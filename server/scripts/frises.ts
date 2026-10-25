// Les événements de la frise (l'étape 5 de « La question au centre », le
// 20 octobre 2026) : chacun une question datée de la base, récrite en une
// ligne. Ce script vérifie un lot écrit par un agent avant qu'il entre dans
// `server/content/frises/evenements.json`, puis l'y range.
//
//   npx tsx scripts/frises.ts verifier <lot.json> …   ce qui ne se pose pas, et pourquoi
//   npx tsx scripts/frises.ts ranger <lot.json> …     ajoute ce qui se pose au contenu livré
//
// Un lot : un tableau de `{ "id": "<question de la base>", "evenement": "<la ligne>" }`.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../src/core/baseCampagne'
import { anneeDe } from '../../shared/sujets'
import { refusDuLibelle } from '../../shared/frise'

const CONTENU = path.join(path.dirname(fileURLToPath(import.meta.url)), '../content/frises/evenements.json')

interface Ligne {
  id: string
  evenement: string
}

const base = new Map(lireLaBase().questions.map(q => [q.id, q]))

/** Deux lignes qui disent la même chose : sans accents, sans articles ni ponctuation. */
const empreinte = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(le|la|les|l|un|une|des|du|de|d|a|au|aux|et|en)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function lire(fichier: string): Ligne[] {
  const brut = JSON.parse(readFileSync(fichier, 'utf8')) as unknown
  if (!Array.isArray(brut)) throw new Error(`${fichier} : un tableau, s'il te plaît`)
  return brut as Ligne[]
}

/**
 * Les lignes déjà rangées ; rien si le fichier n'existe pas encore. Un fichier
 * qui ne se lit pas — un conflit de fusion, une virgule de trop — arrête tout :
 * compté pour vide, `verifier` n'y aurait plus vu les doublons, et `ranger`
 * l'aurait réécrit avec le seul lot.
 */
function contenu(): Ligne[] {
  try {
    return lire(CONTENU)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error(`${CONTENU} ne se lit pas (${e instanceof Error ? e.message : String(e)}) : corrige-le d'abord, rien n'est écrit`)
  }
}

/** Ce qui ne se pose pas dans ces lignes, chacune sa raison ; `deja` : les lignes rangées avant elles. */
function refus(lignes: readonly Ligne[], deja: readonly Ligne[]): { ligne: Ligne; motif: string }[] {
  const vus = new Map<string, string>()
  const empreintes = new Map<string, string>()
  for (const l of deja) {
    vus.set(l.id, l.evenement)
    empreintes.set(empreinte(l.evenement), l.id)
  }
  const sortie: { ligne: Ligne; motif: string }[] = []
  for (const l of lignes) {
    const motif = (() => {
      if (!l || typeof l.id !== 'string') return 'pas d’identifiant'
      const q = base.get(l.id)
      if (!q) return 'pas une question de la base'
      const d = q.meta.date
      if (!d || !['annee', 'mois', 'jour'].includes(d.precision) || anneeDe(d) === null) return 'sa question n’est pas datée à l’année près'
      const libelle = refusDuLibelle(l.evenement)
      if (libelle) return libelle
      if (vus.has(l.id)) return `déjà rangée : « ${vus.get(l.id)} »`
      const e = empreinte(l.evenement)
      if (empreintes.has(e)) return `la même ligne qu’une autre (${empreintes.get(e)})`
      vus.set(l.id, l.evenement)
      empreintes.set(e, l.id)
      return null
    })()
    if (motif) sortie.push({ ligne: l, motif })
  }
  return sortie
}

const [commande, ...fichiers] = process.argv.slice(2)
if (commande === 'verifier' && fichiers.length > 0) {
  const deja = contenu()
  let n = 0
  for (const f of fichiers) {
    const lignes = lire(f)
    const r = refus(lignes, deja)
    for (const { ligne, motif } of r) console.log(`${path.basename(f)} · ${ligne?.id} · « ${ligne?.evenement} » : ${motif}`)
    console.log(`${path.basename(f)} : ${lignes.length} lignes, ${r.length} refusées`)
    n += r.length
  }
  process.exitCode = n > 0 ? 1 : 0
} else if (commande === 'ranger' && fichiers.length > 0) {
  const deja = contenu()
  const neuves: Ligne[] = []
  for (const f of fichiers) {
    const lignes = lire(f)
    const r = new Set(refus(lignes, [...deja, ...neuves]).map(x => x.ligne))
    for (const l of lignes) if (!r.has(l)) neuves.push({ id: l.id, evenement: l.evenement })
    console.log(`${path.basename(f)} : ${lignes.length - r.size} rangées, ${r.size} écartées`)
  }
  const toutes = [...deja, ...neuves]
  // Une ligne par événement : un diff qui se relit.
  writeFileSync(CONTENU, `[\n${toutes.map(l => JSON.stringify(l)).join(',\n')}\n]\n`)
  console.log(`${toutes.length} événements dans ${path.relative(process.cwd(), CONTENU)}`)
} else {
  console.log('npx tsx scripts/frises.ts verifier|ranger <lot.json> …')
  process.exitCode = 1
}

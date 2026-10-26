// Le contenu neuf du Cabinet de curiosités : les lieux de l'Épingle, les
// fiches des Indices, les répliques, les frises à thème, écrits et relus par
// des agents. Ce script juge un lot avant qu'il entre dans
// `server/content/cabinet/`, puis l'y range — par les juges mêmes que le
// serveur applique au chargement (`server/src/core/cabinet/contenu.ts`).
//
//   npx tsx scripts/cabinet-contenu.ts verifier <lot.json> …   ce qui ne se pose pas, et pourquoi
//   npx tsx scripts/cabinet-contenu.ts ranger <lot.json> …     ajoute ce qui se pose au bout de son fichier
//
// Un lot : un tableau d'entrées d'une seule sorte, au format de
// `shared/cabinet/contenu.ts` ; sa sorte se lit à ses champs. Un doublon — le
// même identifiant, le même lieu à deux kilomètres, la même personne, la même
// citation, le même thème — s'écarte comme un refus, qu'il redise le contenu
// rangé ou une entrée d'un autre lot du même appel. Les refus se relisent à la
// main, et se corrigent dans le lot — en relisant le fait si l'on touche une
// réponse —, jamais en desserrant un juge.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOSSIER_DU_CONTENU, SORTES, ligneDe, trier, type EntreeDuContenu, type SorteDuContenu } from '../src/core/cabinet/contenu'

/** Le champ qui ne vit que dans une sorte : il dit à quelle sorte une entrée appartient. */
const CHAMP_DE_LA_SORTE: Readonly<Record<SorteDuContenu, string>> = { lieux: 'lat', fiches: 'cles', repliques: 'leurres', frises: 'evenements' }

function lire(fichier: string): unknown[] {
  const brut = JSON.parse(readFileSync(fichier, 'utf8')) as unknown
  if (!Array.isArray(brut)) throw new Error(`${fichier} : un tableau, s'il te plaît`)
  return brut
}

/** La sorte d'un lot, lue aux champs de ses entrées : toutes la même. */
function sorteDuLot(fichier: string, entrees: readonly unknown[]): SorteDuContenu {
  const sortes = new Set(
    entrees.map(e => {
      const s = (Object.keys(CHAMP_DE_LA_SORTE) as SorteDuContenu[]).find(k => !!e && typeof e === 'object' && CHAMP_DE_LA_SORTE[k] in e)
      if (!s) throw new Error(`${fichier} : une entrée qui n'est ni un lieu, ni une fiche, ni une réplique, ni une frise (${JSON.stringify(e).slice(0, 80)})`)
      return s
    }),
  )
  if (sortes.size !== 1) throw new Error(`${fichier} : un lot d'une seule sorte, s'il te plaît (${[...sortes].join(', ')})`)
  return [...sortes][0]
}

/**
 * Le contenu rangé d'une sorte ; rien si son fichier n'existe pas encore. Un
 * fichier qui ne se lit pas — un conflit de fusion, une virgule de trop, autre
 * chose qu'un tableau — arrête tout : compté pour vide, `verifier` n'y aurait
 * plus vu les doublons, et `ranger` l'aurait réécrit avec le seul lot.
 */
function range(dossier: string, s: SorteDuContenu): unknown[] {
  const fichier = path.join(dossier, SORTES[s].fichier)
  try {
    return lire(fichier)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error(`${fichier} ne se lit pas (${e instanceof Error ? e.message : String(e)}) : corrige-le d'abord, rien n'est écrit`)
  }
}

const idDe = (e: unknown) => String((e as { id?: unknown })?.id ?? '?')

/**
 * Juge ces lots — et, pour `ranger`, range ce qui s'y pose au bout de son
 * fichier, dans `dossier`. Rend le code de sortie : 1 dès qu'une entrée ne se
 * pose pas à `verifier`, ou qu'une entrée déjà rangée ne se pose plus.
 */
export function traiterLesLots(commande: 'verifier' | 'ranger', fichiers: readonly string[], dossier: string = DOSSIER_DU_CONTENU): number {
  const lots = fichiers.map(f => {
    const entrees = lire(f)
    return { f, entrees, sorte: sorteDuLot(f, entrees) }
  })
  // Ce qui est déjà rangé, sorte par sorte, et ce que les lots d'avant y ajoutent : un lot ne redit ni l'un ni l'autre.
  const deja = new Map<SorteDuContenu, EntreeDuContenu<SorteDuContenu>[]>()
  let refusDuRange = 0
  for (const s of new Set(lots.map(l => l.sorte))) {
    const { gardees, ecartees } = trier(s, range(dossier, s))
    for (const { entree, motif } of ecartees) console.log(`${SORTES[s].fichier} (rangé) · ${idDe(entree)} : ${motif}`)
    refusDuRange += ecartees.length
    deja.set(s, gardees)
  }
  let refusees = 0
  for (const { f, entrees, sorte } of lots) {
    const avant = deja.get(sorte)!
    const { gardees, ecartees } = trier(sorte, entrees, avant)
    for (const { entree, motif } of ecartees) console.log(`${path.basename(f)} · ${idDe(entree)} : ${motif}`)
    console.log(`${path.basename(f)} (${sorte}) : ${entrees.length} entrées, ${ecartees.length} ${commande === 'ranger' ? 'écartées' : 'refusées'}`)
    deja.set(sorte, [...avant, ...gardees])
    refusees += ecartees.length
  }
  if (commande === 'verifier') return refusees + refusDuRange > 0 ? 1 : 0
  // Le contenu rangé qui ne se pose plus se corrige d'abord : réécrire le fichier le perdrait sans bruit.
  if (refusDuRange > 0) {
    console.log(`${refusDuRange} entrées rangées ne se posent plus : corrige-les d'abord, rien n'est écrit`)
    return 1
  }
  mkdirSync(dossier, { recursive: true })
  for (const s of new Set(lots.map(l => l.sorte))) {
    const toutes = deja.get(s)!
    const fichier = path.join(dossier, SORTES[s].fichier)
    // Une entrée par ligne, ses champs dans l'ordre de sa sorte : un diff qui se relit entrée par entrée.
    writeFileSync(fichier, `[\n${toutes.map(e => ligneDe(s, e)).join(',\n')}\n]\n`)
    console.log(`${toutes.length} entrées dans ${path.relative(process.cwd(), fichier)}`)
  }
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [commande, ...fichiers] = process.argv.slice(2)
  if ((commande === 'verifier' || commande === 'ranger') && fichiers.length > 0) {
    try {
      process.exitCode = traiterLesLots(commande, fichiers)
    } catch (e) {
      console.error((e as Error).message)
      process.exitCode = 1
    }
  } else {
    console.log('npx tsx scripts/cabinet-contenu.ts verifier|ranger <lot.json> …')
    process.exitCode = 1
  }
}

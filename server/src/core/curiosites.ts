// Ce que tirent les curiosités de l'Expédition (la version 12, le 19 octobre
// 2026) : les plats de la base dont on devine d'où ils viennent, et les
// rébus. Deux petits fichiers de `server/content/curiosites/`, lus une fois
// par processus et relus sans défaut : un rébus qui ne se compose pas, un
// emoji récent s'écartent avec leur motif au journal, plutôt que d'arriver
// sur un téléphone. Les règles pures : `shared/curiosites.ts` ; le brief :
// `retours/2026-10-19/les-curiosites.md`.

import fs from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import { refusDuRebus, type Rebus } from '../../../shared/curiosites'

const DOSSIER = path.join(SERVEUR, 'content/curiosites')

/**
 * Un plat de la liste : l'identifiant de sa question dans la base, et son
 * nom, pour qui relit la liste. Une liste plutôt qu'un motif d'intitulé : la
 * base pose aussi « De quel pays vient le parmesan ? » et « De quelle ville
 * allemande le hamburger tire-t-il son nom ? » — un fromage, un nom, pas un
 * plat dont on devine l'origine.
 */
export interface PlatDeCuriosite {
  id: string
  plat: string
}

export interface ContenuDesCuriosites {
  plats: readonly PlatDeCuriosite[]
  rebus: readonly Rebus[]
}

let lu: ContenuDesCuriosites | null = null

/** Un fichier du dossier, en JSON ; un tableau vide s'il manque ou ne se lit pas — le journal le dit. */
function lire(nom: string): unknown[] {
  try {
    const brut = JSON.parse(fs.readFileSync(path.join(DOSSIER, nom), 'utf8'))
    if (Array.isArray(brut)) return brut
    console.warn(`[curiosites] ${nom} n'est pas un tableau : les curiosités s'en passeront`)
  } catch (e) {
    console.warn(`[curiosites] ${nom} illisible : les curiosités s'en passeront —`, e instanceof Error ? e.message : e)
  }
  return []
}

/** Les plats et les rébus des curiosités, lus du disque la première fois. */
export function contenuDesCuriosites(): ContenuDesCuriosites {
  if (lu) return lu
  const plats = lire('plats.json').filter((p): p is PlatDeCuriosite => !!p && typeof (p as PlatDeCuriosite).id === 'string' && typeof (p as PlatDeCuriosite).plat === 'string')
  const rebus: Rebus[] = []
  for (const r of lire('rebus.json')) {
    const refus = refusDuRebus(r)
    if (refus) console.warn(`[curiosites] rébus écarté (${(r as Partial<Rebus>)?.id ?? '?'}) : ${refus}`)
    else rebus.push(r as Rebus)
  }
  lu = { plats, rebus }
  return lu
}

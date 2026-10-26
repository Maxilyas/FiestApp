// Ce qu'une page du client télécharge avec elle : ses imports statiques, de
// proche en proche. Pas un fichier de tests — le parcours que partagent ceux
// qui gardent un chemin léger : le téléphone de l'invité et l'accueil anonyme
// sans les dessins (`medaillons.test.ts`), l'œuvre peinte sans les règles de
// l'Expédition (`cartes-peintes.test.ts`).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Les fichiers qu'une page importe statiquement, de proche en proche. */
export function importsStatiques(depart: string): Set<string> {
  const vus = new Set<string>()
  const pile = [depart]
  while (pile.length) {
    const fichier = pile.pop()!
    if (vus.has(fichier)) continue
    vus.add(fichier)
    const texte = readFileSync(fichier, 'utf8')
      // Un commentaire qui cite un import ne charge rien.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    // `import type` s'efface à la compilation, et `import('…')` est justement
    // le chargement à la demande : seuls comptent les imports de valeurs, et
    // ceux qui ne gardent rien (`import './Legendaire'` l'évaluerait aussi).
    const cibles = [
      ...[...texte.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"](\.[^'"]+)['"]/gm)].filter(m => !m[1]).map(m => m[2]),
      ...[...texte.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)].map(m => m[1]),
    ]
    for (const cible of cibles) {
      const base = path.resolve(path.dirname(fichier), cible)
      const trouve = [base, `${base}.tsx`, `${base}.ts`].find(f => /\.tsx?$/.test(f) && existsSync(f))
      if (trouve) pile.push(trouve)
    }
  }
  return vus
}

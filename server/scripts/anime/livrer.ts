// Livre les portraits peints dans le client, branche par branche :
//
//   npx tsx scripts/anime/livrer.ts [branche…]
//
// Pour chaque branche dont les six portraits sont assemblés
// (`export/portraits/<branche>/app`, écrit par `portraits.ts`) :
//
// 1. ses fichiers rejoignent `client/public/portraits`, nommés par leur
//    empreinte : servis pour un an sans revalider (`server.ts`), un portrait
//    repeint change d'adresse, et aucun téléphone ne garde l'ancien. Les
//    fichiers qu'ils remplacent partent ;
// 2. le module de la branche (`client/src/components/portraits/<branche>.ts`)
//    est réécrit : les couleurs de ses disques — gardées de ses dessins —
//    et ses fichiers. Ses dessins en SVG partent avec : l'historique les garde.
//
// Une branche incomplète n'est pas livrée : elle garde ses dessins.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { STYLES } from './consignes'

Object.assign(globalThis, { React })
const ICI = path.dirname(fileURLToPath(import.meta.url))
const DEPOT = path.resolve(ICI, '../../..')
const { BRANCHES } = await import('../../../shared/branches')
const voulues = process.argv.slice(2).filter(a => !a.startsWith('--'))
const racine = path.join(DEPOT, 'export/portraits')
const publics = path.join(DEPOT, 'client/public/portraits')
const modules = path.join(DEPOT, 'client/src/components/portraits')
/** Grande puis petite : l'ordre de `ImageDePortrait`. */
const TAILLES = [512, 256]
mkdirSync(publics, { recursive: true })

const empreinte = (fichier: string) => createHash('sha256').update(readFileSync(fichier)).digest('hex').slice(0, 10)

/** Pose un fichier sous son empreinte ; rend son adresse. Ses versions d'avant partent. */
function poser(source: string, nom: string): string {
  const final = `${nom}.${empreinte(source)}.webp`
  for (const ancien of readdirSync(publics)) {
    if (ancien !== final && ancien.startsWith(`${nom}.`) && ancien.endsWith('.webp')) rmSync(path.join(publics, ancien))
  }
  copyFileSync(source, path.join(publics, final))
  return `/portraits/${final}`
}

let livrees = 0
for (const b of BRANCHES.filter(x => voulues.length === 0 || voulues.includes(x.key))) {
  const app = path.join(racine, b.key, 'app')
  const fichier = (id: string, variante: string, t: number) => path.join(app, `${id}-${variante}-${t}.webp`)
  const manque = b.portraits.filter((p, i) => {
    const id = p.key.slice(3)
    return TAILLES.some(t => !existsSync(fichier(id, 'perso', t)) || (i > 0 && !existsSync(fichier(id, 'disque', t))))
  })
  if (manque.length) {
    console.log(`${b.key} : pas livrée, il manque ${manque.map(p => p.key).join(', ')}`)
    continue
  }
  const source = path.join(modules, `${b.key}.ts`)
  const { DESSINS } = await import(new URL(`file://${source}`).href)
  // La première ligne du module, écrite à la main : « Les mythologies · Histoire — du Minotaure à Athéna. »
  const entete = readFileSync(source, 'utf8').split('\n')[0]
  const lignes = b.portraits.map((p, i) => {
    const id = p.key.slice(3)
    const paire = (variante: string) => `[${TAILLES.map(t => `'${poser(fichier(id, variante, t), `${id}-${variante}-${t}`)}'`).join(', ')}]`
    const fond = (DESSINS[p.key]?.fond as string[] | undefined) ?? ['#5b6478', '#262b38', '#0d0f15']
    return (
      `  '${p.key}': {\n` +
      `    fond: [${fond.map(c => `'${c}'`).join(', ')}],\n` +
      `    image: {\n` +
      (i > 0 ? `      disque: ${paire('disque')},\n` : '') +
      `      perso: ${paire('perso')},\n` +
      `    },\n` +
      `  },`
    )
  })
  const module = `${entete}
//
// Peints en images par \`server/scripts/anime/portraits.ts\`, un ingrédient
// de plus à chaque palier. Le style de la branche : ${STYLES[b.key].nom.replace(/^L[’']/, 'l’').replace(/^Le /, 'le ').replace(/^La /, 'la ')}.
//
// Écrit par \`server/scripts/anime/livrer.ts\` : on ne le retouche pas à la
// main, on relance la chaîne. Les fichiers sont dans \`client/public/portraits\`,
// nommés par leur empreinte : un portrait repeint change d'adresse, et aucun
// téléphone ne garde l'ancien. Les couleurs sont celles du disque, qui attend
// l'image et reçoit le visage du premier palier.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import type { DessinDePortrait } from './outils'

export const DESSINS: Record<string, DessinDePortrait> = {
${lignes.join('\n')}
}

// Évalué, le dessin est là pour tout \`Avatar\` de la page (voir \`medaillons.ts\`).
inscrireDessin({ Portrait, branches: { ${b.key}: DESSINS } })
`
  writeFileSync(source, module)
  livrees++
  console.log(`${b.key} : livrée (${b.portraits.length} portraits)`)
}
console.log(`${livrees} branche(s) livrée(s) dans ${path.relative(DEPOT, publics)}`)

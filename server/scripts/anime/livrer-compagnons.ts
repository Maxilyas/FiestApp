// Livre les compagnons peints dans le client :
//
//   npx tsx scripts/anime/livrer-compagnons.ts [compagnon…]
//
// Pour chaque compagnon du catalogue (`shared/compagnons.ts`) dont les quatre
// formes sont assemblées (`export/compagnons/<compagnon>/app`, écrit par
// `compagnons.ts`) :
//
// 1. ses fichiers rejoignent `client/public/compagnons`, nommés par leur
//    empreinte : servis pour un an sans revalider (`server.ts`), un compagnon
//    repeint change d'adresse, et aucun téléphone ne garde l'ancien. Chacun en
//    deux tailles, comme les portraits — la grande telle que la chaîne l'a
//    assemblée (512 pixels pour les 100 unités du disque), la petite réduite
//    de moitié dans Chromium ; les fichiers qu'ils remplacent partent ;
// 2. `client/src/components/compagnons-peints.ts` est réécrit : les fichiers
//    de chaque forme — ses humeurs comprises —, ceux du monde vivant de sa
//    forme ultime, et sa métamorphose de lumière, une forme de plus, sous sa
//    propre clé (`cp:loup-tempete`).
//
// L'expression neutre est partie la première (le choix du 13 octobre 2026 :
// l'achat, le port et la croissance d'abord) ; ses trois humeurs — ravi,
// dépité, triomphe — l'ont rejointe le 19 octobre 2026, avec les réactions
// de la niche à la révélation (`retours/2026-10-16/compagnon/principe.md`,
// § 10), puis la métamorphose que l'Éclat ouvre, le même jour : peinte le
// 13 octobre, elle ne partait pas, et un loup éclaté ne changeait que de
// quatre paillettes. L'ombre attend sa règle (cent mauvaises réponses en le
// portant). Un compagnon incomplet n'est pas livré, et garde ce qu'il avait :
// sans ses humeurs, sa niche ne saurait plus réagir.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { COMPAGNONS, type FormeDeCompagnon } from '../../../shared/compagnons'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'

// Le module d'avant se relit (`dejaLivres`), et il importe le composant.
Object.assign(globalThis, { React })
const ICI = path.dirname(fileURLToPath(import.meta.url))
const DEPOT = path.resolve(ICI, '../../..')
const voulus = process.argv.slice(2).filter(a => !a.startsWith('--'))
const racine = path.join(DEPOT, 'export/compagnons')
const publics = path.join(DEPOT, 'client/public/compagnons')
const module_ = path.join(DEPOT, 'client/src/components/compagnons-peints.ts')
/** La qualité de la chaîne (`compagnons.ts`) : la petite taille ne se dégrade pas plus que la grande. */
const QUALITE = 0.86
mkdirSync(publics, { recursive: true })

/**
 * L'identifiant de chaque forme dans la chaîne : le catalogue nomme ses
 * formes pour la page (`cp:loup-ultime`), la chaîne les a peintes sous ces
 * noms (`ultime-neutre.webp`) — sa métamorphose de lumière sous `eclat-`
 * (`eclat-tempete-neutre.webp`, la voie `lumiere` de `compagnons.ts`).
 */
const idDansLaChaine = (f: FormeDeCompagnon) => (f.metamorphose ? 'eclat-' : '') + f.key.slice(f.key.indexOf('-') + 1)

/**
 * Les humeurs de chaque forme, repeintes sur sa découpe : le corps ne bouge
 * pas (`recouvrement`, `compagnons.ts`), et la niche les échange en place.
 */
const HUMEURS = ['ravi', 'depite', 'triomphe'] as const

const empreinte = (donnees: Buffer) => createHash('sha256').update(donnees).digest('hex').slice(0, 10)

/** Pose des octets sous leur empreinte ; rend leur adresse. Les versions d'avant partent. */
function poser(donnees: Buffer, nom: string): string {
  const final = `${nom}.${empreinte(donnees)}.webp`
  for (const ancien of readdirSync(publics)) {
    if (ancien !== final && ancien.startsWith(`${nom}.`) && ancien.endsWith('.webp')) rmSync(path.join(publics, ancien))
  }
  writeFileSync(path.join(publics, final), donnees)
  return `/compagnons/${final}`
}

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'compagnons.js'))('playwright')
}

// Une image carrée réduite par moitiés successives (`reduire`, `pixels.ts`) :
// la petite taille des listes.
//
// Et une couche du monde vivant, à `cote` pixels : la lumière, peinte sur du
// noir, y perd son noir. Posée en `screen`, elle ne s'effaçait que sur ce qui
// était peint derrière elle dans le même calque : dans la carte d'un joueur,
// isolée, son carré noir se voyait autour du loup. Chaque pixel garde sa
// couleur, portée au plus clair, et prend son éclat pour opacité, par paliers
// de huit — sans eux, l'opacité, sans perte dans le WebP, pesait 350 Ko pour
// les feux d'artifice du chat — ; presque noir, il disparaît (le bruit de la
// compression). 512 pixels pour ses 170 unités en grand — des lueurs, que la
// carte ne montre pas plus nettes —, 256 ailleurs. Une couche déjà détourée
// (des oiseaux), au coin transparent, ne fait que se réduire.
const OUTILS = String.raw`
async function moitie(src, qualite) {
  const img = await charger(src)
  const c = toile(img.naturalWidth, img.naturalHeight)
  c.getContext('2d').drawImage(img, 0, 0)
  return reduire(c, Math.round(img.naturalWidth / 2)).toDataURL('image/webp', qualite)
}
async function couche(src, cote, qualite) {
  const img = await charger(src)
  const plein = toile(img.naturalWidth, img.naturalHeight)
  plein.getContext('2d').drawImage(img, 0, 0)
  const c = reduire(plein, cote), x = c.getContext('2d', { willReadFrequently: true })
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data
  if (p[3] >= 250) {
    for (let k = 0; k < p.length; k += 4) {
      const a = Math.max(p[k], p[k + 1], p[k + 2])
      if (a < 12) { p[k] = p[k + 1] = p[k + 2] = p[k + 3] = 0; continue }
      p[k] = Math.round((p[k] * 255) / a); p[k + 1] = Math.round((p[k + 1] * 255) / a); p[k + 2] = Math.round((p[k + 2] * 255) / a)
      p[k + 3] = Math.min(255, Math.round(a / 8) * 8)
    }
    x.putImageData(d, 0, 0)
  }
  return c.toDataURL('image/webp', qualite)
}
`

/** Ce que le module garde d'une forme : ses fichiers, `[grand, petit]`. */
interface Livree {
  disque?: [string, string]
  perso: [string, string]
  humeurs?: Record<(typeof HUMEURS)[number], [string, string]>
  vivant?: Record<string, [string, string]>
}

/** Ce que le module cite déjà : un compagnon qu'on ne relivre pas garde le sien. */
async function dejaLivres(): Promise<Record<string, Livree>> {
  if (!existsSync(module_)) return {}
  const { DESSINS } = await import(new URL(`file://${module_}`).href)
  return DESSINS
}

const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })
const livrees: Record<string, Livree> = await dejaLivres()
let nouveaux = 0
try {
  const page = await pagePixels(nav, 512)
  await page.addScriptTag({ content: OUTILS })
  const enDataUrl = (octets: Buffer) => `data:image/webp;base64,${octets.toString('base64')}`
  /** Les deux tailles de ces octets, posées sous leur empreinte : la grande telle quelle, la petite réduite. */
  const paire = async (grande: Buffer, nom: string): Promise<[string, string]> => [
    poser(grande, `${nom}-512`),
    poser(deDataUrl(await dansLaPage<string>(page, 'moitie', enDataUrl(grande), QUALITE)), `${nom}-256`),
  ]
  /**
   * Une couche vivante, ses deux tailles tirées chacune de l'originale : sa
   * lumière sans son noir, ou détourée déjà. Réduite de moitié après coup,
   * la grande retrouvait des opacités entre ses paliers, et la petite des
   * feux d'artifice pesait plus que celle d'un portrait.
   */
  const vivante = async (source: string, nom: string): Promise<[string, string]> => {
    const brut = enDataUrl(readFileSync(source))
    return [
      poser(deDataUrl(await dansLaPage<string>(page, 'couche', brut, 512, QUALITE)), `${nom}-512`),
      poser(deDataUrl(await dansLaPage<string>(page, 'couche', brut, 256, QUALITE)), `${nom}-256`),
    ]
  }

  for (const c of COMPAGNONS.filter(x => voulus.length === 0 || voulus.includes(x.key))) {
    const app = path.join(racine, c.key, 'app')
    const fichier = (nom: string) => path.join(app, `${nom}.webp`)
    /** Ce qu'il faut d'une forme : l'expression neutre, ses humeurs, et son décor si elle en a un. */
    const fichiersDe = (f: FormeDeCompagnon) => {
      const id = idDansLaChaine(f)
      return [`${id}-neutre`, ...HUMEURS.map(h => `${id}-${h}`), ...(f.rang > 0 ? [`${id}-disque`] : [])]
    }
    const manque = c.formes.flatMap(f => fichiersDe(f).filter(n => !existsSync(fichier(n))))
    if (manque.length) {
      console.log(`${c.key} : pas livré, il manque ${manque.join(', ')}`)
      continue
    }
    /** Une forme et ses deux tailles, sous son nom dans le client (`loup-ultime`, `loup-eclat-tempete`). */
    const peinte = async (f: FormeDeCompagnon): Promise<Livree> => {
      const id = idDansLaChaine(f)
      const nom = `${c.key}-${id}`
      const p: Livree = { perso: await paire(readFileSync(fichier(`${id}-neutre`)), `${nom}-perso`) }
      if (f.rang > 0) p.disque = await paire(readFileSync(fichier(`${id}-disque`)), `${nom}-disque`)
      const humeurs = {} as NonNullable<Livree['humeurs']>
      for (const h of HUMEURS) humeurs[h] = await paire(readFileSync(fichier(`${id}-${h}`)), `${nom}-${h}`)
      p.humeurs = humeurs
      return p
    }
    for (const f of c.formes) {
      const id = idDansLaChaine(f)
      const nom = `${c.key}-${id}`
      const livree = await peinte(f)
      // Le monde vivant de la forme ultime : chaque couche peinte à part.
      const couches = readdirSync(app)
        .filter(n => n.startsWith(`${id}-vivant-`) && n.endsWith('.webp'))
        .sort()
      if (f.rang === 3 && couches.length) {
        livree.vivant = {}
        for (const n of couches) {
          const cle = n.slice(`${id}-vivant-`.length, -'.webp'.length)
          livree.vivant[cle] = await vivante(path.join(app, n), `${nom}-vivant-${cle}`)
        }
      }
      livrees[f.key] = livree
    }
    // Sa métamorphose de lumière, une forme de plus : son décor, l'animal et
    // ses humeurs. Une machine qui ne l'a pas garde celle d'avant.
    const sansLumiere = fichiersDe(c.lumiere).filter(n => !existsSync(fichier(n)))
    if (sansLumiere.length === 0) livrees[c.lumiere.key] = await peinte(c.lumiere)
    else console.log(`${c.key} : sa métamorphose ${livrees[c.lumiere.key] ? 'reste celle d’avant' : 'n’est pas livrée'}, il manque ${sansLumiere.join(', ')}`)
    nouveaux++
    console.log(`${c.key} : livré (${c.formes.length} formes${livrees[c.lumiere.key] ? ' et sa métamorphose' : ''})`)
  }
} finally {
  await nav.close()
}

const liste = (p: [string, string]) => `['${p[0]}', '${p[1]}']`
const lignes = COMPAGNONS.flatMap(c => [...c.formes, c.lumiere])
  .filter(f => livrees[f.key])
  .map(f => {
    const l = livrees[f.key]
    const bloc = (nom: string, paires: Record<string, [string, string]> | undefined) =>
      paires
        ? `    ${nom}: {\n${Object.entries(paires)
            .map(([cle, p]) => `      ${cle}: ${liste(p)},\n`)
            .join('')}    },\n`
        : ''
    return (
      `  '${f.key}': {\n` +
      (l.disque ? `    disque: ${liste(l.disque)},\n` : '') +
      `    perso: ${liste(l.perso)},\n` +
      bloc('humeurs', l.humeurs) +
      bloc('vivant', l.vivant) +
      `  },`
    )
  })

writeFileSync(
  module_,
  `// Les compagnons peints : les fichiers de chaque forme — ses humeurs, que la
// niche échange en place à la révélation —, le monde vivant de leur forme
// ultime, et leur métamorphose de lumière, que l'Éclat ouvre : une forme de
// plus.
//
// Peints en images par \`server/scripts/anime/compagnons.ts\`, dans un seul
// style — la peinture lumineuse : une collection.
//
// Écrit par \`server/scripts/anime/livrer-compagnons.ts\` : on ne le retouche
// pas à la main, on relance la chaîne. Les fichiers sont dans
// \`client/public/compagnons\`, nommés par leur empreinte : un compagnon repeint
// change d'adresse, et aucun téléphone ne garde l'ancien.
import { inscrireDessin } from './medaillons'
import { Compagnon, type DessinDeCompagnon } from './Compagnon'

export const DESSINS: Record<string, DessinDeCompagnon> = {
${lignes.join('\n')}
}

// Évalué, le dessin est là pour tout \`Avatar\` de la page (voir \`medaillons.ts\`).
inscrireDessin({ Compagnon, compagnons: DESSINS })
`,
)
// Ce que plus personne ne cite part : un compagnon retiré du catalogue, une couche vivante renommée.
const cites = new Set(
  Object.values(livrees).flatMap(l =>
    [...(l.disque ?? []), ...l.perso, ...Object.values(l.humeurs ?? {}).flat(), ...Object.values(l.vivant ?? {}).flat()].map(a => a.slice('/compagnons/'.length)),
  ),
)
for (const f of readdirSync(publics)) if (!cites.has(f)) rmSync(path.join(publics, f))
console.log(`${nouveaux} compagnon(s) livré(s) dans ${path.relative(DEPOT, publics)}`)

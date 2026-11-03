// Le montage de la vidéo de promotion : la page `montage.html`, pilotée par le
// temps, photographiée image par image dans Chromium et poussée dans ffmpeg.
//
// La page ne bouge jamais d'elle-même — ni animation CSS, ni minuterie — :
// chaque image se pose par `rendre(t)`, puis se photographie. Une machine
// lente met plus longtemps, jamais une image saccadée ; et une seconde se
// refait seule, à l'identique (`--apercu`).
//
// Ce que la page lit lui est servi par une adresse inventée
// (`http://montage.local/`), que Playwright intercepte : les prises du
// tournage, les polices, l'icône et les peintures de `client/public/` — une
// page posée par `setContent` n'a pas le droit de lire un fichier local, et
// des peintures en `data:` pèseraient des dizaines de mégaoctets dans la page.
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { legendaire } from '../../../shared/legendaires'
import { COMPAGNONS } from '../../../shared/compagnons'
import { CARTES } from '../../../shared/cabinet/traversee'
import { THEMES_FILMES, type Plans } from './tournage'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.resolve(ici, '../../..')
const PUBLIC = path.join(racine, 'client/public')

/** Trente images par seconde : ce que lisent tous les réseaux, et deux fois moins d'images à photographier qu'à soixante. */
export const IMAGES_PAR_SECONDE = 30

/** L'adresse de la vitrine, dite à la fin de la vidéo : la page publique de FiestApp (`docs/vitrine/`, GitHub Pages). */
export const ADRESSE_DE_LA_VITRINE = 'maxilyas.github.io/FiestApp'

export type Format = 'paysage' | 'portrait'
const TAILLES: Record<Format, { width: number; height: number }> = {
  paysage: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
}

/** Les légendaires de la galerie, le premier au milieu, en grand ; le loup des étoiles, la forme ultime du loup, prend sa place dans la couronne. */
const LEGENDAIRES_MONTRES = ['lg:phenix', 'lg:dragon', 'lg:licorne', 'lg:kraken', 'loup', 'lg:sphinx', 'lg:oracle', 'lg:trou-noir', 'lg:lion']
/** Les trois cartes choisies au départ de la traversée, celles du tournage. */
const CARTES_MONTREES = ['coup-d-oeil', 'quitte-ou-double', 'cagnotte']

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}

/**
 * Une peinture de `client/public/` par son nom, sans son empreinte : les
 * fichiers livrés portent un morceau de leur contenu dans leur nom
 * (`phenix-art-512.18630863d2.webp`), qui change à chaque repeinte.
 */
function peinture(dossier: string, debut: string): string {
  const trouve = readdirSync(path.join(PUBLIC, dossier)).find(f => f.startsWith(`${debut}.`))
  if (!trouve) throw new Error(`client/public/${dossier}/${debut}.*.webp introuvable : la peinture a changé de nom ?`)
  return `public/${dossier}/${trouve}`
}

/** Ce que la page reçoit : ses prises, ses peintures, son format. */
function donnees(format: Format, plans: Plans) {
  return {
    format,
    plans: Object.fromEntries(Object.entries(plans).map(([nom, p]) => [nom, { ...p, src: `plans/${p.fichier}` }])),
    icone: 'public/icone.svg',
    adresse: ADRESSE_DE_LA_VITRINE,
    // Les prises des thèmes, dans l'ordre du tournage ; le Velours est l'accueil même.
    themes: THEMES_FILMES.filter(t => t !== 'velours').map(t => `theme-${t}`),
    legendaires: LEGENDAIRES_MONTRES.map(cle => {
      if (cle === 'loup') {
        const loup = COMPAGNONS.find(c => c.key === 'loup')?.formes.at(-1)
        if (!loup) throw new Error('le loup n’a plus de forme ultime (shared/compagnons.ts)')
        return { nom: loup.nom, src: peinture('compagnons', 'loup-ultime-disque-512'), perso: peinture('compagnons', 'loup-ultime-perso-512') }
      }
      const l = legendaire(cle)
      if (!l) throw new Error(`le légendaire ${cle} n'existe plus (shared/legendaires.ts)`)
      return { nom: l.nom, src: peinture('medaillons', `${cle.replace(/^lg:/, '')}-art-512`) }
    }),
    cartes: CARTES_MONTREES.map(cle => {
      const c = CARTES.find(x => x.cle === cle)
      if (!c) throw new Error(`la carte ${cle} n'existe plus (shared/cabinet/traversee.ts)`)
      return { nom: c.nom, src: peinture('cartes', `${cle}-480`) }
    }),
  }
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

/** Ouvre la page de montage dans ce format, ses images décodées et ses polices chargées. */
async function ouvrirLeMontage(navigateur: any, dossier: string, format: Format, plans: Plans) {
  const page = await navigateur.newPage({ viewport: TAILLES[format], deviceScaleFactor: 1 })
  page.on('pageerror', (e: Error) => console.error(`[montage] ${e.message}`))
  const script = `window.DONNEES = ${JSON.stringify(donnees(format, plans))}`
  await page.route('http://montage.local/**', async (route: any) => {
    const chemin = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '')
    if (chemin === 'donnees.js') return route.fulfill({ body: script, contentType: TYPES['.js'] })
    const fichier =
      chemin === 'montage.html'
        ? path.join(ici, 'montage.html')
        : chemin.startsWith('plans/')
          ? path.join(dossier, chemin)
          : chemin.startsWith('public/')
            ? path.join(PUBLIC, chemin.slice('public/'.length))
            : null
    // Rien hors de ces trois dossiers : un chemin remonté (`..`) ne sort pas.
    const permis = fichier && [path.join(ici, 'montage.html'), dossier, PUBLIC].some(d => path.resolve(fichier).startsWith(d))
    if (!permis || !existsSync(fichier) || !statSync(fichier).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ body: readFileSync(fichier), contentType: TYPES[path.extname(fichier)] ?? 'application/octet-stream' })
  })
  await page.goto('http://montage.local/montage.html')
  await page.evaluate('window.pret')
  return page
}

export interface OptionsDuMontage {
  formats: Format[]
  /** Une piste audio sous la vidéo : coupée à sa longueur, fondue sur ses deux dernières secondes. */
  musique?: string
  /** Des images fixes à ces instants, sans vidéo : pour regarder une seconde du montage. */
  apercu?: number[]
}

export async function monter(dossier: string, plans: Plans, opts: OptionsDuMontage): Promise<string[]> {
  if (opts.musique && !existsSync(opts.musique)) throw new Error(`La musique ${opts.musique} n'existe pas.`)
  if (!opts.apercu && spawnSync('ffmpeg', ['-version']).status !== 0) throw new Error('ffmpeg introuvable : il encode la vidéo (apt install ffmpeg, brew install ffmpeg).')
  const { chromium } = chargerPlaywright()
  const navigateur = await chromium.launch({ headless: true })
  const ecrits: string[] = []
  try {
    for (const format of opts.formats) {
      if (!TAILLES[format]) throw new Error(`Format inconnu : ${format} (paysage ou portrait)`)
      const page = await ouvrirLeMontage(navigateur, dossier, format, plans)
      if (opts.apercu) {
        const dossierDesApercus = path.join(dossier, 'apercus')
        mkdirSync(dossierDesApercus, { recursive: true })
        for (const t of opts.apercu) {
          await page.evaluate(`window.rendre(${t})`)
          const fichier = path.join(dossierDesApercus, `${format}-${t.toFixed(2).replace('.', '_')}.png`)
          await page.screenshot({ path: fichier })
          ecrits.push(fichier)
          console.log(`  ${fichier}`)
        }
      } else ecrits.push(await encoder(page, dossier, format, opts.musique))
      await page.close()
    }
  } finally {
    await navigateur.close()
  }
  return ecrits
}

/** Chaque image du montage, photographiée en JPEG presque sans perte, poussée dans ffmpeg qui l'encode en H.264. */
async function encoder(page: any, dossier: string, format: Format, musique?: string): Promise<string> {
  const duree = Number(await page.evaluate('window.DUREE'))
  const images = Math.round(duree * IMAGES_PAR_SECONDE)
  const sortie = path.join(dossier, `fiestapp-${format}.mp4`)
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(IMAGES_PAR_SECONDE), '-c:v', 'mjpeg', '-i', '-']
  if (musique) args.push('-i', musique)
  // H.264 en yuv420p, l'en-tête en tête du fichier (`faststart`) : ce que WhatsApp, Instagram, TikTok et un navigateur
  // lisent tous, et qui se lit avant d'être tout téléchargé.
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(IMAGES_PAR_SECONDE))
  if (musique) args.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=out:st=${Math.max(0, duree - 2)}:d=2`, '-shortest')
  args.push(sortie)
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const fini = once(ffmpeg, 'close')
  const debut = Date.now()
  for (let i = 0; i < images; i++) {
    await page.evaluate(`window.rendre(${i / IMAGES_PAR_SECONDE})`)
    const image: Buffer = await page.screenshot({ type: 'jpeg', quality: 94 })
    if (!ffmpeg.stdin.write(image)) await once(ffmpeg.stdin, 'drain')
    if (i % (IMAGES_PAR_SECONDE * 5) === 0) {
      const ecoule = (Date.now() - debut) / 1000
      process.stdout.write(`\r  ${format} : ${Math.round((i / images) * 100)} % — ${Math.round(ecoule)} s`)
    }
  }
  ffmpeg.stdin.end()
  const [code] = (await fini) as [number]
  process.stdout.write('\n')
  if (code !== 0) throw new Error(`ffmpeg a échoué (code ${code}) en encodant ${sortie}`)
  console.log(`  ${sortie} — ${duree} s, ${Math.round(statSync(sortie).size / 1024 / 1024 * 10) / 10} Mo, en ${Math.round((Date.now() - debut) / 1000)} s`)
  return sortie
}

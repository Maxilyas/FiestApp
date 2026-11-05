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
import { THEMES_FILMES, type Plans } from './plans'
import { APRES_LA_VIDEO, AVANT_LA_VIDEO, BIPS, REPLIQUES } from './doublage'

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

/** Les pages que l'adresse inventée sert : le montage, et la bande rythmo qui le pose au-dessus de son texte. */
const PAGES = ['montage.html', 'rythmo.html']

/**
 * Ouvre une page dans ce format, ses images décodées et ses polices chargées :
 * le montage, ou la bande rythmo — qui charge le montage du même format dans
 * son cadre, et lit les répliques de `doublage.ts` (`doublage.js`).
 */
async function ouvrirLaPage(navigateur: any, dossier: string, format: Format, plans: Plans, fichierDeLaPage = 'montage.html') {
  const page = await navigateur.newPage({ viewport: TAILLES[format], deviceScaleFactor: 1 })
  page.on('pageerror', (e: Error) => console.error(`[${fichierDeLaPage}] ${e.message}`))
  const scripts: Record<string, string> = {
    'donnees.js': `window.DONNEES = ${JSON.stringify(donnees(format, plans))}`,
    'doublage.js': `window.DOUBLAGE = ${JSON.stringify({ repliques: REPLIQUES, avant: AVANT_LA_VIDEO, bips: BIPS, apres: APRES_LA_VIDEO })}`,
  }
  await page.route('http://montage.local/**', async (route: any) => {
    const chemin = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '')
    if (scripts[chemin]) return route.fulfill({ body: scripts[chemin], contentType: TYPES['.js'] })
    const fichier = PAGES.includes(chemin)
      ? path.join(ici, chemin)
      : chemin.startsWith('plans/')
        ? path.join(dossier, chemin)
        : chemin.startsWith('public/')
          ? path.join(PUBLIC, chemin.slice('public/'.length))
          : null
    // Rien hors des pages, des prises et de `client/public/` : un chemin remonté (`..`) ne sort pas.
    const permis = fichier && [...PAGES.map(p => path.join(ici, p)), dossier, PUBLIC].some(d => path.resolve(fichier).startsWith(d))
    if (!permis || !existsSync(fichier) || !statSync(fichier).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ body: readFileSync(fichier), contentType: TYPES[path.extname(fichier)] ?? 'application/octet-stream' })
  })
  await page.goto(`http://montage.local/${fichierDeLaPage}`)
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
      const page = await ouvrirLaPage(navigateur, dossier, format, plans)
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

/** La vidéo montée dans un format : la page photographiée de 0 à sa durée, et la musique s'il y en a une. */
async function encoder(page: any, dossier: string, format: Format, musique?: string): Promise<string> {
  const duree = Number(await page.evaluate('window.DUREE'))
  return filmer(page, path.join(dossier, `fiestapp-${format}.mp4`), format, {
    debut: 0,
    duree,
    entree: musique ? ['-i', musique] : [],
    son: musique ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=out:st=${Math.max(0, duree - 2)}:d=2`, '-shortest'] : [],
  })
}

/**
 * Chaque image d'une page pilotée par le temps, de `debut` à `debut + duree`,
 * photographiée en JPEG presque sans perte et poussée dans ffmpeg qui l'encode
 * en H.264 ; `entree` et `son` ajoutent une piste audio et disent comment la
 * mêler, `ips` combien d'images par seconde (30 d'office).
 */
async function filmer(
  page: any,
  sortie: string,
  nom: string,
  f: { debut: number; duree: number; entree: string[]; son: string[]; ips?: number },
): Promise<string> {
  const ips = f.ips ?? IMAGES_PAR_SECONDE
  const images = Math.round(f.duree * ips)
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(ips), '-c:v', 'mjpeg', '-i', '-', ...f.entree]
  // H.264 en yuv420p, l'en-tête en tête du fichier (`faststart`) : ce que WhatsApp, Instagram, TikTok et un navigateur
  // lisent tous, et qui se lit avant d'être tout téléchargé.
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(ips))
  args.push(...f.son, sortie)
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const fini = once(ffmpeg, 'close')
  const debut = Date.now()
  for (let i = 0; i < images; i++) {
    await page.evaluate(`window.rendre(${f.debut + i / ips})`)
    const image: Buffer = await page.screenshot({ type: 'jpeg', quality: 94 })
    if (!ffmpeg.stdin.write(image)) await once(ffmpeg.stdin, 'drain')
    if (i % (ips * 5) === 0) {
      const ecoule = (Date.now() - debut) / 1000
      process.stdout.write(`\r  ${nom} : ${Math.round((i / images) * 100)} % — ${Math.round(ecoule)} s`)
    }
  }
  ffmpeg.stdin.end()
  const [code] = (await fini) as [number]
  process.stdout.write('\n')
  if (code !== 0) throw new Error(`ffmpeg a échoué (code ${code}) en encodant ${sortie}`)
  console.log(`  ${sortie} — ${Math.round(f.duree * 10) / 10} s, ${Math.round(statSync(sortie).size / 1024 / 1024 * 10) / 10} Mo, en ${Math.round((Date.now() - debut) / 1000)} s`)
  return sortie
}

// ── La bande rythmo du doublage ────────────────────────────────────────────

/**
 * La bande rythmo (`rythmo.html`) en vidéo, pour le doubleur : le montage en
 * haut, le texte de `doublage.ts` qui défile dessous, le décompte et ses trois
 * bips — 1 000 Hz, 0,15 s chacun, que le doubleur écoute au casque. Elle se
 * monte sur les prises du dossier, comme la vidéo, et dit les répliques trop
 * serrées pour se lire.
 */
export async function bandeRythmo(dossier: string, plans: Plans): Promise<string> {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) throw new Error('ffmpeg introuvable : il encode la bande (apt install ffmpeg, brew install ffmpeg).')
  const { chromium } = chargerPlaywright()
  const navigateur = await chromium.launch({ headless: true })
  try {
    const page = await ouvrirLaPage(navigateur, dossier, 'paysage', plans, 'rythmo.html')
    for (const r of (await page.evaluate('window.SERREES')) as string[]) console.log(`  serrée au point de mal se lire : ${r}`)
    const debut = Number(await page.evaluate('window.DEBUT'))
    const duree = Number(await page.evaluate('window.DUREE'))
    // Les bips à leur seconde dans le fichier, qui commence avec le décompte.
    const bips = BIPS.map(b => b - debut)
    const bip = `aevalsrc='if(${bips.map(b => `between(t,${b},${b + 0.15})`).join('+')},0.35*sin(2*PI*1000*t),0)':s=48000:d=${duree}`
    return await filmer(page, path.join(dossier, 'bande-rythmo.mp4'), 'bande rythmo', {
      debut,
      duree,
      entree: ['-f', 'lavfi', '-i', bip],
      son: ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '128k', '-shortest'],
      // Soixante images par seconde : à trente, le texte sautait de vingt pixels d'une image à l'autre, et l'œil qui le
      // suit le voyait flou (le propriétaire, le 5 novembre 2026 : « ça défile et c'est flou »).
      ips: 60,
    })
  } finally {
    await navigateur.close()
  }
}

/** Une image fixe de la bande rythmo, à la seconde `t` de la vidéo (négative pendant le décompte). */
export async function apercuDeLaBande(dossier: string, plans: Plans, instants: number[]): Promise<string[]> {
  const { chromium } = chargerPlaywright()
  const navigateur = await chromium.launch({ headless: true })
  const ecrits: string[] = []
  try {
    const page = await ouvrirLaPage(navigateur, dossier, 'paysage', plans, 'rythmo.html')
    const dossierDesApercus = path.join(dossier, 'apercus')
    mkdirSync(dossierDesApercus, { recursive: true })
    for (const t of instants) {
      await page.evaluate(`window.rendre(${t})`)
      const fichier = path.join(dossierDesApercus, `rythmo-${t.toFixed(2).replace('.', '_').replace('-', 'moins')}.png`)
      await page.screenshot({ path: fichier })
      ecrits.push(fichier)
      console.log(`  ${fichier}`)
    }
  } finally {
    await navigateur.close()
  }
  return ecrits
}

// ── La vidéo de la vitrine ─────────────────────────────────────────────────

/** Où la vitrine prend sa vidéo : publiée avec elle sur GitHub Pages (`docs/vitrine/`, des chemins relatifs). */
export const DOSSIER_DE_LA_VITRINE = path.join(racine, 'docs/vitrine/video')

/**
 * Le poids au-dessus duquel la vitrine refuse une vidéo : elle se lance seule
 * en tête de page, et un téléphone en 4G la charge avant d'avoir vu le reste.
 * `server/test/vitrine.test.ts` relit la même borne.
 */
export const POIDS_MAX_DE_LA_VITRINE = 5 * 1024 * 1024

/**
 * L'instant de l'affiche, l'image que la page montre avant la vidéo : « Un écran
 * pour la salle, un téléphone pour chacun » posé en entier, la question à la
 * télé, « Mars » coché au téléphone, le doigt reparti (`LEGENDES` et
 * `PISTE_TEL` de `montage.html`). Plus tôt, la fin de la légende arrivait
 * encore, floue.
 */
export const INSTANT_DE_L_AFFICHE = 10.3

/**
 * Chaque format monté, réduit pour la vitrine — 720 lignes, sans son (elle se
 * lance muette) —, et son affiche : `fiestapp-<format>.mp4` et
 * `affiche-<format>.jpg` dans `docs/vitrine/video/`. La vidéo pleine taille
 * pèse huit fois plus, pour des écrans de téléphone qui n'en montrent pas tant.
 */
export function pourLaVitrine(dossier: string, formats: Format[]): string[] {
  mkdirSync(DOSSIER_DE_LA_VITRINE, { recursive: true })
  const ecrits: string[] = []
  for (const format of formats) {
    const source = path.join(dossier, `fiestapp-${format}.mp4`)
    if (!existsSync(source)) throw new Error(`${source} n'existe pas : la vitrine reprend la vidéo montée, monte-la d'abord.`)
    const { width, height } = TAILLES[format]
    const video = path.join(DOSSIER_DE_LA_VITRINE, `fiestapp-${format}.mp4`)
    const affiche = path.join(DOSSIER_DE_LA_VITRINE, `affiche-${format}.jpg`)
    const echelle = `scale=${(width * 2) / 3}:${(height * 2) / 3}:flags=lanczos`
    const lancer = (args: string[]) => {
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
      if (r.status !== 0) throw new Error(`ffmpeg a échoué (code ${r.status}) pour la vitrine`)
    }
    // `faststart` d'abord : sans lui, le navigateur télécharge tout le fichier avant de montrer la première image.
    lancer(['-i', source, '-vf', echelle, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', video])
    lancer(['-ss', String(INSTANT_DE_L_AFFICHE), '-i', source, '-frames:v', '1', '-vf', echelle, '-q:v', '3', affiche])
    const poids = statSync(video).size
    if (poids > POIDS_MAX_DE_LA_VITRINE) {
      throw new Error(`${video} pèse ${Math.round(poids / 1024 / 1024 * 10) / 10} Mo : la vitrine la refuse au-delà de 5 Mo. Monte une vidéo plus courte, ou relève le -crf.`)
    }
    console.log(`  ${video} — ${Math.round(poids / 1024 / 1024 * 10) / 10} Mo, et ${path.basename(affiche)}`)
    ecrits.push(video, affiche)
  }
  return ecrits
}

// La vidéo de promotion de FiestApp, tournée sur l'application réelle et
// montée image par image : un serveur jetable, de vrais navigateurs, de vrais
// écrans (`video/tournage.ts`), puis une page de montage pilotée par le temps,
// photographiée trente fois par seconde et encodée par ffmpeg
// (`video/montage.ts`). Rien n'y est dessiné à la main de l'application :
// relancé après une retouche, il refait la vidéo avec les écrans du jour.
//
//   npm run video -- [dossier] [options]          (ou, depuis server/ : npx tsx scripts/video-promo.ts …)
//
//   --sans-tournage        reprend les prises du dossier (plans.json) au lieu de les refaire
//   --tournage-seul        tourne sans monter
//   --formats=paysage,portrait   16:9 (1920 × 1080) et 9:16 (1080 × 1920) ; les deux d'office
//   --musique=<fichier>    une piste audio sous la vidéo, coupée à sa longueur et fondue à la fin
//   --apercu=<s>[,<s>…]    des images fixes du montage à ces instants, sans vidéo
//
// Le client se construit d'abord (`npm run build -w client`) : le banc sert
// `client/dist` tel qu'il est. Playwright vient des modules globaux, ffmpeg du
// système. Sans dossier, tout va dans `export/video-promo/`, que git ignore.
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tourner, type Plans } from './video/tournage'

const ici = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const option = (nom: string) => args.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=')
const drapeau = (nom: string) => args.includes(`--${nom}`)
// Un chemin relatif se lit depuis le dossier où la commande a été tapée (`INIT_CWD`, que npm pose) : `npm run video`
// tourne dans `server/`, et le dossier donné de la racine y aurait atterri.
const depuis = process.env.INIT_CWD ?? process.cwd()
const dossierDonne = args.find(a => !a.startsWith('--'))
const dossier = dossierDonne ? path.resolve(depuis, dossierDonne) : path.join(ici, '../../export/video-promo')

const debut = Date.now()
let plans: Plans
if (drapeau('sans-tournage')) {
  const fichier = path.join(dossier, 'plans.json')
  if (!existsSync(fichier)) throw new Error(`${fichier} n'existe pas : lance d'abord le tournage, sans --sans-tournage.`)
  plans = JSON.parse(readFileSync(fichier, 'utf8'))
  console.log(`Prises reprises de ${fichier}`)
} else {
  console.log(`Tournage dans ${dossier}`)
  plans = await tourner(dossier)
  console.log(`Tournage fini : ${Object.keys(plans).length} prises en ${Math.round((Date.now() - debut) / 1000)} s`)
}
if (!drapeau('tournage-seul')) {
  const { monter } = await import('./video/montage')
  await monter(dossier, plans, {
    formats: (option('formats') ?? 'paysage,portrait').split(',') as ('paysage' | 'portrait')[],
    musique: option('musique') ? path.resolve(depuis, option('musique')!) : undefined,
    apercu: option('apercu')?.split(',').map(Number),
  })
}
console.log(`Fini en ${Math.round((Date.now() - debut) / 1000)} s`)

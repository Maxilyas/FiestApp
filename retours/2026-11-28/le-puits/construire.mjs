// Assemble la maquette dans un dossier : `node construire.mjs <dossier>`.
// La page publiée est un seul fichier — la feuille, le socle, chaque moule et
// l'écran, mis bout à bout — plus le Sphinx peint, pris dans le dépôt. Les
// sources restent en fichiers séparés : c'est ce qui laisse `verifier.mjs`
// charger le socle et les moules sans navigateur.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = dirname(fileURLToPath(import.meta.url))
const racine = join(ici, '../../..')
const dest = process.argv[2]
if (!dest) { console.error('usage : node construire.mjs <dossier>'); process.exit(2) }
mkdirSync(join(dest, 'images'), { recursive: true })

const lire = f => readFileSync(join(ici, 'src', f), 'utf8')
// Un troisième argument ne garde que quelques moules (`traversee,cruches`) : pour essayer l'écran pendant qu'un autre moule s'écrit.
const seuls = process.argv[3]?.split(',')
const moules = readdirSync(join(ici, 'src/moules')).filter(f => f.endsWith('.js') && (!seuls || seuls.includes(f.slice(0, -3)))).sort()
// Un `</script>` dans une chaîne d'un moule fermerait la page avant l'heure.
const script = [lire('socle.js'), ...moules.map(f => lire('moules/' + f)), lire('ecran.js')].join('\n').replace(/<\/script/gi, '<\\/script')
const page = lire('page.html').replace('/*STYLE*/', () => lire('style.css')).replace('/*SCRIPT*/', () => script)
writeFileSync(join(dest, 'puits.html'), page)

const medaillons = join(racine, 'client/public/medaillons')
const sphinx = readdirSync(medaillons).find(f => /^sphinx-perso-256\..*\.webp$/.test(f))
copyFileSync(join(medaillons, sphinx), join(dest, 'images/sphinx-perso.webp'))
// La page publiée reçoit son squelette à la publication ; en local, on le lui donne.
writeFileSync(join(dest, 'local.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`)
console.log(`Maquette prête : ${join(dest, 'local.html')} — ${moules.length} moules, ${Math.round(page.length / 1024)} ko`)

// L'aperçu de la vitrine (`docs/vitrine/apercu.jpg`) : l'image que WhatsApp,
// Messenger, Signal ou LinkedIn montrent sous un lien partagé. En 1200 × 630,
// le format que tous affichent en grand, et composée comme le haut de la
// vitrine — la marque, le titre, l'écran commun et le téléphone d'une invitée,
// pris dans ses captures : une capture seule, réduite à la largeur d'une bulle
// de conversation, ne se lisait plus.
//
//   npx tsx scripts/rendu-apercu-vitrine.ts [fichier]      (défaut : ../docs/vitrine/apercu.jpg)
//
// Ni serveur ni client construit : la page se compose ici, avec les polices et
// l'icône de `client/public/`, toutes en `data:` — rien ne dépend du réseau, et
// une page posée par `setContent` n'a pas le droit de lire un fichier local.
// À relancer après `rendu-vitrine.ts`, qui refait les captures.
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.resolve(ici, '../..')
const sortie = path.resolve(process.argv[2] ?? path.join(racine, 'docs/vitrine/apercu.jpg'))

// WhatsApp laisse sans image l'aperçu d'une image trop lourde : on reste sous
// les 300 Ko qu'on lui prête, avec de la marge.
const POIDS_MAX = 300 * 1024

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}

const enData = (fichier: string, type: string) =>
  `data:${type};base64,${readFileSync(path.join(racine, fichier)).toString('base64')}`
const police = (fichier: string) => enData(`client/public/fonts/${fichier}`, 'font/woff2')

// Les couleurs de « Velours », celles de la vitrine : l'aperçu est la première
// image de FiestApp qu'on voit, avant même d'ouvrir la page.
const carte = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: 'Cormorant Garamond'; font-weight: 600; src: url(${police('cormorant-garamond-600.woff2')}) format('woff2'); }
@font-face { font-family: 'Cormorant Garamond'; font-style: italic; font-weight: 500; src: url(${police('cormorant-garamond-500-italic.woff2')}) format('woff2'); }
@font-face { font-family: Figtree; font-weight: 300 900; src: url(${police('figtree-variable.woff2')}) format('woff2'); }
* { box-sizing: border-box; }
body {
  margin: 0; width: 1200px; height: 630px; overflow: hidden;
  background: #1a1412;
  background-image: radial-gradient(90% 560px at 70% -180px, #2b211b, #1a1412 72%);
  color: #f3ece2;
  font-family: Figtree, sans-serif;
  display: grid; grid-template-columns: 450px auto; align-items: center; column-gap: 56px;
  padding-left: 72px;
}
.marque { display: flex; align-items: center; gap: 18px; }
.marque img { width: 72px; height: 72px; }
.marque span { font: 600 50px/1 'Cormorant Garamond', serif; }
h1 { margin: 40px 0 0; font: 600 76px/1.02 'Cormorant Garamond', serif; letter-spacing: -0.01em; }
h1 em { font-style: italic; font-weight: 500; color: #d9b56a; }
.formes { display: flex; gap: 14px; margin-top: 38px; }
.formes svg { width: 28px; height: 28px; }
/* Le téléphone mord sur le coin de l'écran et le dépasse, comme en haut de la vitrine. */
.scene { position: relative; width: 572px; padding-bottom: 60px; }
.ecran {
  border-radius: 14px; overflow: hidden; background: #0d0a09;
  border: 1px solid rgba(217, 181, 106, 0.22);
  box-shadow: 0 0 0 11px #0d0a09, 0 30px 70px rgba(0, 0, 0, 0.55);
}
.ecran img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.telephone {
  position: absolute; right: -26px; bottom: 0; width: 152px;
  border-radius: 26px; overflow: hidden; background: #0d0a09;
  border: 7px solid #0d0a09; box-shadow: 0 30px 70px rgba(0, 0, 0, 0.55);
}
.telephone img { display: block; width: 100%; }
</style>
</head>
<body>
  <div>
    <div class="marque"><img src="${enData('client/public/icone.svg', 'image/svg+xml')}" alt=""><span>FiestApp</span></div>
    <h1>Le quiz de la soirée, <em>sur ton téléphone.</em></h1>
    <div class="formes">
      <svg viewBox="0 0 24 24"><path d="M12 3 22 20H2Z" fill="#d98a9a"/></svg>
      <svg viewBox="0 0 24 24"><path d="M12 2 22 12 12 22 2 12Z" fill="#d9b56a"/></svg>
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#a99ad6"/></svg>
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2.5" fill="#8fbfa8"/></svg>
    </div>
  </div>
  <div class="scene">
    <div class="ecran"><img src="${enData('docs/vitrine/captures/ecran-question.jpg', 'image/jpeg')}" alt=""></div>
    <div class="telephone"><img src="${enData('docs/vitrine/captures/telephone-repondu.jpg', 'image/jpeg')}" alt=""></div>
  </div>
</body>
</html>`

const { chromium } = chargerPlaywright()
const navigateur = await chromium.launch({ headless: true })
try {
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(carte, { waitUntil: 'load' })
  await page.evaluate('document.fonts.ready.then(() => true)')
  // Une police qui manque passe sans un mot : une serif du système prendrait
  // sa place, et l'aperçu ne ressemblerait plus à la vitrine.
  const polices = await page.evaluate(`['600 76px "Cormorant Garamond"', 'italic 500 76px "Cormorant Garamond"'].every(p => document.fonts.check(p))`)
  if (!polices) throw new Error('Les polices de la vitrine ne se sont pas chargées : l’aperçu n’est pas écrit.')
  await page.screenshot({ path: sortie, type: 'jpeg', quality: 85 })
} finally {
  await navigateur.close()
}

const poids = statSync(sortie).size
if (poids > POIDS_MAX) throw new Error(`${sortie} pèse ${Math.round(poids / 1024)} Ko : WhatsApp ne le montrerait pas. Baisse la qualité du JPEG.`)
console.log(`${sortie} — 1200 × 630, ${Math.round(poids / 1024)} Ko`)

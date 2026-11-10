// Les images de la maquette, refaites à partir de celles de l'application (`img/`, que git ignore) : les aperçus des
// thèmes, les portraits des compagnons — leurs quatre formes —, les douze fonds des savoirs réduits à 300 px de large.
// La maquette (`boutique.html`) s'ouvre ensuite telle quelle, servie par n'importe quel serveur de fichiers.
//
//   node retours/2026-11-10/boutique/maquette/images.cjs
const { createRequire } = require('node:module')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const depot = path.resolve(__dirname, '../../../..')
const sortie = path.join(__dirname, 'img')
fs.mkdirSync(sortie, { recursive: true })
// Playwright n'est pas une dépendance du dépôt : parmi les modules globaux, comme les scripts de rendu.
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

// Ce que la maquette montre : ses données (`donnees.js`) posent `window.BOUTIQUE`.
const window = {}
new Function('window', fs.readFileSync(path.join(__dirname, 'donnees.js'), 'utf8'))(window)
const { themes, fonds } = window.BOUTIQUE
const FORMES = {
  loup: ['louveteau', 'jeune', 'adulte', 'ultime'],
  chat: ['chaton', 'jeune', 'adulte', 'esprit'],
  tortue: ['bebe', 'jeune', 'adulte', 'ile'],
  luciole: ['ver', 'jeune', 'adulte', 'constellation'],
  panda: ['bebe', 'jeune', 'adulte', 'erable'],
}

;(async () => {
  for (const t of themes) fs.copyFileSync(path.join(depot, 'client/src/themes/apercus', `${t.key}.webp`), path.join(sortie, `t-${t.key}.webp`))
  const compagnons = fs.readdirSync(path.join(depot, 'client/public/compagnons'))
  for (const [c, formes] of Object.entries(FORMES)) {
    formes.forEach((f, i) => {
      // Sous empreinte : `loup-jeune-perso-256.<empreinte>.webp`.
      const nom = compagnons.find(n => n.startsWith(`${c}-${f}-perso-256.`))
      if (!nom) throw new Error(`pas de portrait pour ${c}-${f}`)
      fs.copyFileSync(path.join(depot, 'client/public/compagnons', nom), path.join(sortie, `c-${c}-${i}.webp`))
    })
  }
  const navigateur = await chromium.launch()
  const page = await navigateur.newPage()
  const decors = fs.readdirSync(path.join(depot, 'client/public/decors'))
  for (const f of fonds) {
    const nom = decors.find(n => n.startsWith(`fond-${f.key}-720.`))
    if (!nom) throw new Error(`pas de peinture pour ${f.key}`)
    const src = 'data:image/webp;base64,' + fs.readFileSync(path.join(depot, 'client/public/decors', nom)).toString('base64')
    // 720 px à l'origine, 42 Ko chacun, pour des vignettes de 76 px : réduits à 300.
    const reduit = await page.evaluate(async source => {
      const img = new Image()
      img.src = source
      await img.decode()
      const l = 300
      const h = Math.round((img.naturalHeight * l) / img.naturalWidth)
      const toile = document.createElement('canvas')
      toile.width = l
      toile.height = h
      toile.getContext('2d').drawImage(img, 0, 0, l, h)
      return toile.toDataURL('image/webp', 0.8)
    }, src)
    fs.writeFileSync(path.join(sortie, `f-${f.key}.webp`), Buffer.from(reduit.split(',')[1], 'base64'))
  }
  await navigateur.close()
  console.log(`Images dans ${sortie}`)
})()

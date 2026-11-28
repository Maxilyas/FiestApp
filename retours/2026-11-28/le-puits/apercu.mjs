// Photographie le plateau d'une énigme, seul, en 360 × 640 : au départ, à mi-chemin de sa
// solution, et au bout. Pour voir un moule sans attendre toute la maquette.
//   node apercu.mjs <id de la fiche | moule:niveau:graine> <dossier de sortie>
// Le plateau y tient dans le cadre qu'il aura en jeu : 328 pixels de large, 340 de haut.
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(join(execSync('npm root -g').toString().trim(), '_'))
const { chromium } = require('playwright')
const ici = dirname(fileURLToPath(import.meta.url))
const [quoi, sortie = '.'] = process.argv.slice(2)
mkdirSync(sortie, { recursive: true })

const lire = f => readFileSync(join(ici, 'src', f), 'utf8')
const moules = readdirSync(join(ici, 'src/moules')).filter(x => x.endsWith('.js')).sort().map(f => lire('moules/' + f)).join('\n')
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${lire('style.css')}
body { display: block; overflow: auto; padding: 12px 16px; }
#cadre { width: 328px; min-height: 340px; outline: 1px dashed rgba(255, 255, 255, 0.25); }
#dit { margin: 10px 0 0; font: 500 13px/1.4 var(--f-texte); color: var(--or-clair); min-height: 2.8em; }</style></head><body>
<div id="cadre"></div><p id="dit"></p>
<script>${lire('socle.js')}\n${moules}</script>
<script>
const st = document.createElement('style'); st.textContent = P.styles.join('\\n'); document.head.append(st)
const quoi = ${JSON.stringify(quoi)}
const tire = quoi.match(/^(\\w+):(\\d+):(\\d+)$/)
const f = tire ? P.moules[tire[1]].tirer(+tire[3], +tire[2]) : P.fiches.find(x => x.id === quoi)
const m = P.moules[f.moule]
let e = m.depart(f)
const dit = t => { document.getElementById('dit').textContent = t || '' }
function dessiner(fige) { document.getElementById('cadre').replaceChildren(m.dessiner({ f, e, agir, dire: dit, fige: !!fige })) }
function agir(coup) {
  const r = m.jouer(f, e, coup)
  if (!r.etat) { dit(r.refus); return false }
  e = r.etat
  const fin = m.fini(f, e)
  dit(fin ? (fin.gagne ? 'Gagné.' : fin.perdu) : '')
  dessiner()
  return true
}
window.apercu = { f, verdict: P.verifier(f), agir, hauteur: () => document.getElementById('cadre').firstElementChild.getBoundingClientRect().height, large: () => document.documentElement.scrollWidth - innerWidth }
dessiner()
</script></body></html>`
const fichier = resolve(sortie, 'apercu.html')
writeFileSync(fichier, page)

const navigateur = await chromium.launch()
const p = await navigateur.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 })
const erreurs = []
p.on('pageerror', e => erreurs.push(e.message))
p.on('console', x => { if (x.type() === 'error') erreurs.push(x.text()) })
await p.goto('file://' + fichier)
await p.waitForTimeout(400)
const nom = quoi.replace(/[^\w-]/g, '_')
const photo = async etape => { await p.waitForTimeout(250); await p.screenshot({ path: join(sortie, `${nom}-${etape}.png`) }) }
await photo('1-depart')
const v = await p.evaluate(() => ({ ok: window.apercu.verdict.ok, coups: window.apercu.verdict.coups, note: window.apercu.verdict.note, n: (window.apercu.verdict.solution || []).length }))
if (v.n) {
  for (let i = 0; i < v.n; i++) {
    await p.evaluate(k => window.apercu.agir(window.apercu.verdict.solution[k]), i)
    if (i === Math.floor(v.n / 2) - 1) await photo('2-milieu')
  }
  await photo('3-bout')
}
const mesure = await p.evaluate(() => ({ hauteur: Math.round(window.apercu.hauteur()), large: window.apercu.large() }))
await navigateur.close()
console.log(`${quoi} : ${v.ok ? 'juste' : 'REFUS'}${v.coups != null ? ', ' + v.coups + ' coups' : ''}${v.note ? ' — ' + v.note : ''} · plateau de ${mesure.hauteur} px de haut${mesure.hauteur > 340 ? ' (TROP HAUT : 340 au plus)' : ''}${mesure.large > 0 ? ' · LA PAGE DÉBORDE EN LARGEUR' : ''}`)
if (erreurs.length) { console.log('Erreurs de la page :\n' + erreurs.join('\n')); process.exit(1) }

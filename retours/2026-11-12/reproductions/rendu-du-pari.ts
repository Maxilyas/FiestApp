// Le Pari tel qu'un joueur le voit au téléphone, dans une traversée (`../le-pari.md`) : l'annonce, la première question,
// « garder ou parier », la question du pari, puis les trois façons dont une manche finit — le pari perdu, la première
// question ratée, les étoiles gardées —, sur un vrai serveur jetable. Les bonnes réponses se lisent dans le plan figé en
// base, comme les tests. À chaque photo, ce que l'écran porte : sa hauteur, ses mots, ses cibles.
//
//   npm run build -w client
//   cd server && npx tsx ../retours/2026-11-12/reproductions/rendu-du-pari.ts [dossier]
//
// `ECRAN=390x844`, `CATEGORIE=Histoire`. Sans dossier, les photos vont dans `export/pari/`, que git ignore.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../../../server/test/banc'
import { DIX_HEURES } from '../../../server/test/cabinet-banc'
import { VERSION_DE_LA_TRAVERSEE, tracerLaCarte, type DepartDeLaTraversee } from '../../../shared/cabinet/traversee'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const sortie = path.resolve(process.argv[2] ?? path.join(ICI, '../../../export/pari', `${largeur}x${hauteur}`))
mkdirSync(sortie, { recursive: true })
const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const { chromium } = createRequire(path.join(globale, 'rendu.js'))('playwright')

const depuis = Date.now()
const maintenant = () => DIX_HEURES + (Date.now() - depuis)
const banc = await demarrer({ horlogeDuJour: maintenant })
const fichier = banc.quizDbUrl.replace(/^file:/, '')
const cookie = await inscrireProfil(banc.url, 'voyageuse', 'Zoé')

// Une traversée écrite à la main, dont le premier rang n'a que des Paris : la carte tire ses jeux au hasard.
{
  const db = new Database(fichier)
  const { id: profil } = db.prepare(`SELECT id FROM profiles WHERE login = 'voyageuse'`).get() as { id: string }
  const actes = tracerLaCarte(Math.random, ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'] })
  const theme = process.env.CATEGORIE ?? 'Histoire'
  const enPari = ({ theme: _t, sujet: _s, emoji: _e, choix: _c, ...e }: Record<string, unknown>) => ({ ...e, sorte: 'epreuve', jeu: 'pari', theme })
  const depart = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-10-24', actes: [{ ...actes[0], etapes: actes[0].etapes.map(e => (e.rangee === 1 ? enPari(e as never) : e)) }, actes[1], actes[2]] } as unknown as DepartDeLaTraversee
  const id = `rendu-du-pari-${Date.now()}`
  db.prepare('INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (?, ?, ?, ?)').run(id, profil, JSON.stringify(depart), maintenant())
  const cartes = ['cagnotte', 'parade', 'panacee']
  db.prepare('INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (?, 1, ?, ?, ?)').run(id, JSON.stringify({ quoi: 'cartes', cartes }), maintenant(), 'rendu-0')
  db.close()
}
await banc.redemarrer()

const navigateur = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
const [nom, valeur] = cookie.split('=')
await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
const page = await ctx.newPage()
page.setDefaultTimeout(20_000)
page.on('pageerror', (e: Error) => console.error('[page]', e.message))

/** Ce que l'écran porte. En texte : `tsx` y glisserait des `__name` que la page ne connaît pas (skill `regarder-le-rendu`). */
const MESURE = `(() => {
  const d = document
  const vus = [...d.querySelectorAll('button, input[type=range], a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.getAttribute('aria-hidden') !== 'true' })
  const nomDe = b => (b.getAttribute('aria-label') || b.innerText || b.type).replace(/\\s+/g, ' ').trim().slice(0, 34)
  const texte = (d.querySelector('main') || d.body).innerText.replace(/\\s+/g, ' ').trim()
  const pied = d.querySelector('.cab-pied-partie:not(.cab-pied-pose)')
  const manche = d.querySelector('.cab-manche')
  return {
    hauteur: d.scrollingElement.scrollHeight, ecran: innerHeight, large: d.documentElement.scrollWidth > innerWidth,
    mots: texte.split(' ').filter(Boolean).length, nombres: (texte.match(/\\d[\\d\\u202f\\u00a0 ]*/g) || []).length,
    cibles: vus.length, sousLePli: vus.filter(b => b.getBoundingClientRect().top >= innerHeight).map(nomDe),
    petites: vus.filter(b => b.getAttribute('aria-disabled') !== 'true' && b.getBoundingClientRect().height < 43.5).map(nomDe),
    finDeLaManche: manche ? Math.round(manche.lastElementChild.getBoundingClientRect().bottom + scrollY) : null,
    hautDuPied: pied ? Math.round(pied.getBoundingClientRect().top) : null,
    plusPetitTexte: Math.min(...[...d.querySelectorAll('.cab-manche *, .cab-pied-partie *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize))),
    texte,
  }
})()`
let n = 0
const defilent: string[] = []
async function photo(nomDeLaPhoto: string, doitTenir = false) {
  n++
  await page.waitForTimeout(500)
  const base = path.join(sortie, `${String(n).padStart(2, '0')}-${nomDeLaPhoto}`)
  await page.screenshot({ path: `${base}.png` })
  const m = (await page.evaluate(MESURE)) as Record<string, any>
  const tient = m.hauteur <= m.ecran + 1
  console.log(`\n📸 ${path.basename(base)} — ${m.hauteur} px pour ${m.ecran} (${(m.hauteur / m.ecran).toFixed(2)} écran) · ${m.mots} mots · ${m.nombres} nombres · ${m.cibles} cibles · plus petit texte ${m.plusPetitTexte} px${m.large ? ' · ⚠ déborde de côté' : ''}`)
  if (m.finDeLaManche !== null && m.hautDuPied !== null) console.log(`   la manche finit à ${m.finDeLaManche} px, le pied collé commence à ${m.hautDuPied}`)
  if (m.sousLePli.length) console.log(`   sous le pli : ${m.sousLePli.join(' | ')}`)
  if (m.petites.length) console.log(`   ⚠ cibles de moins de 44 px : ${m.petites.join(' | ')}`)
  console.log(`   ${m.texte}`)
  writeFileSync(`${base}.txt`, m.texte)
  if (doitTenir && !tient) defilent.push(`${path.basename(base)} : ${m.hauteur} px`)
  if (!tient) {
    // La page entière : l'écran agrandi à sa hauteur, d'une photo ordinaire, puis rendu à sa taille.
    await page.setViewportSize({ width: largeur, height: m.hauteur })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${base}-entiere.png` })
    await page.setViewportSize({ width: largeur, height: hauteur })
    await page.waitForTimeout(300)
  }
}
const toucher = async (texte: RegExp | string) => {
  await page.getByRole('button', { name: texte }).first().tap()
  await page.waitForTimeout(700)
}

/** Le plan figé de la partie en cours, lu en base : la bonne réponse de chaque question — jamais dans la page. */
function lePlan(): { q1: { bonne: number; niveau: string }; q2: { bonne: number; niveau: string } }[] {
  const db = new Database(fichier, { readonly: true })
  try {
    const { cabinet } = db.prepare(`SELECT cabinet FROM campagne_series WHERE mode = 'cabinet' ORDER BY commencee_le DESC LIMIT 1`).get() as { cabinet: string }
    return JSON.parse(cabinet).tirages
  } finally {
    db.close()
  }
}

try {
  await page.goto(`${banc.url}/cabinet`)
  await page.waitForTimeout(3000)
  await page.locator('.cab-tv-option', { hasText: 'Pari' }).first().tap()
  await page.waitForTimeout(700)
  await page.locator('.cab-tv-panneau .cab-tv-cta').tap()
  await page.waitForTimeout(2200)
  await photo('annonce')
  await toucher(/^Commencer/)
  const reponses = page.locator('.ans-btn')
  await reponses.first().waitFor()
  const plan = lePlan()
  console.log(`\nLe plan : ${plan.slice(0, 3).map((t, k) => `manche ${k + 1}, la question ${t.q1.niveau}, celle du pari ${t.q2.niveau}`).join(' ; ')}`)
  const suivante = async () => {
    await page.getByRole('button', { name: /Manche suivante/ }).first().tap()
    await page.waitForTimeout(900)
    await reponses.first().waitFor()
  }
  // La première manche : juste, puis le pari, perdu.
  await photo('manche-1-la-question', true)
  await reponses.nth(plan[0].q1.bonne).tap()
  await page.locator('.cab-choix-du-pari').waitFor()
  await photo('manche-1-garder-ou-parier', true)
  await page.locator('.cab-choix-du-pari .btn-primary').tap()
  await page.locator('.cab-surtitre').waitFor()
  await photo('manche-1-la-question-du-pari', true)
  await reponses.nth((plan[0].q2.bonne + 1) % 4).tap()
  await page.waitForTimeout(2200)
  await photo('manche-1-le-pari-perdu')
  // La deuxième : la première question ratée.
  await suivante()
  await reponses.nth((plan[1].q1.bonne + 1) % 4).tap()
  await page.waitForTimeout(2200)
  await photo('manche-2-la-question-ratee')
  // La troisième : juste, et gardée.
  await suivante()
  await reponses.nth(plan[2].q1.bonne).tap()
  await page.locator('.cab-choix-du-pari').waitFor()
  // La demi-seconde de garde du cadre : un toucher trop pressé tomberait dans le vide.
  await page.waitForTimeout(800)
  await page.locator('.cab-choix-du-pari .btn:not(.btn-primary)').tap()
  await page.locator('.cab-titre-revele').waitFor()
  await photo('manche-3-les-etoiles-gardees')
} catch (e) {
  console.error('[rendu]', (e as Error).message.split('\n')[0])
  await page.screenshot({ path: path.join(sortie, 'echec.png') }).catch(() => {})
  process.exitCode = 1
}
await navigateur.close()
await banc.close()
console.log(defilent.length ? `\n⚠ Défile, quand il devait tenir sur l'écran :\n${defilent.join('\n')}` : `\n${n} photos dans ${sortie} — la question, le choix et la question du pari tiennent sans défiler`)
if (defilent.length) process.exitCode = 1

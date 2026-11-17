// Le Filet en deux étapes tel qu'un joueur le voit au téléphone, dans une traversée (`../le-filet-en-deux-etapes.md`) :
// l'annonce, l'écran des époques, une époque touchée — jouée pour de bon —, l'écran de la valeur et le verdict de
// l'époque en tête, la révélation, sur trois manches d'un vrai serveur jetable : la bonne époque, une mauvaise après
// « Deux époques de moins », une mauvaise sans aide. À chaque photo, ce que l'écran porte : sa hauteur — tient-il sans
// défiler ? —, ses mots, ses cibles et celles qui passent sous le pli. Le script lit la bonne époque dans le plan en
// base, pour choisir ce qu'il photographie ; la page, elle, ne la reçoit qu'une fois la sienne jouée.
//
//   npm run build -w client
//   cd server && npx tsx ../retours/2026-11-17/reproductions/rendu-du-filet.ts [simple|chargee] [dossier]
//
//   simple    aucune carte qui joue dans une manche (Cagnotte, Parade, Panacée)
//   chargee   Coup d'œil, Échange et Quitte ou double : l'aide offerte, la carte qui reste au pied, la mise
//
// `ECRAN=390x844`, `CATEGORIE=Histoire`. Sans dossier, les photos vont dans `export/filet/`, que git ignore.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../../../server/test/banc'
import { DIX_HEURES } from '../../../server/test/cabinet-banc'
import { lireLeDepart } from '../../../shared/cabinet/lecture'
import type { FiletEnDeuxTempsTire } from '../../../shared/cabinet/jeux/filetEnDeuxTemps'
import { VERSION_DE_LA_TRAVERSEE, tracerLaCarte, type DepartDeLaTraversee } from '../../../shared/cabinet/traversee'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const cas = process.argv[2] ?? 'simple'
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const sortie = path.resolve(process.argv[3] ?? path.join(ICI, '../../../export/filet', `deux-etapes-${cas}-${largeur}x${hauteur}`))
mkdirSync(sortie, { recursive: true })
const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const { chromium } = createRequire(path.join(globale, 'rendu.js'))('playwright')

const depuis = Date.now()
const maintenant = () => DIX_HEURES + (Date.now() - depuis)
const banc = await demarrer({ horlogeDuJour: maintenant, filetEnDeuxTemps: true })
const cookie = await inscrireProfil(banc.url, 'voyageuse', 'Zoé')
const fichier = banc.quizDbUrl.replace(/^file:/, '')

// Une traversée écrite à la main, dont le premier rang n'a que des Filets : la carte tire ses jeux au hasard.
{
  const db = new Database(fichier)
  const { id: profil } = db.prepare(`SELECT id FROM profiles WHERE login = 'voyageuse'`).get() as { id: string }
  const actes = tracerLaCarte(Math.random, ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'] })
  const theme = process.env.CATEGORIE ?? 'Histoire'
  const enFilet = ({ theme: _t, sujet: _s, emoji: _e, choix: _c, ...e }: Record<string, unknown>) => ({ ...e, sorte: 'epreuve', jeu: 'filet', theme })
  const depart = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-10-24', actes: [{ ...actes[0], etapes: actes[0].etapes.map(e => (e.rangee === 1 ? enFilet(e as never) : e)) }, actes[1], actes[2]] } as unknown as DepartDeLaTraversee
  const id = `rendu-du-filet-${Date.now()}`
  db.prepare('INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (?, ?, ?, ?)').run(id, profil, JSON.stringify(depart), maintenant())
  const cartes = cas === 'chargee' ? ['coup-d-oeil', 'echange', 'quitte-ou-double'] : ['cagnotte', 'parade', 'panacee']
  db.prepare('INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (?, 1, ?, ?, ?)').run(id, JSON.stringify({ quoi: 'cartes', cartes }), maintenant(), 'rendu-0')
  db.close()
}
await banc.redemarrer()

/** Le plan de l'épreuve en cours, lu en base à côté du serveur : ce que la page ne voit pas. */
function tiragesDeLEpreuve(): FiletEnDeuxTempsTire[] {
  const db = new Database(fichier, { readonly: true })
  const ligne = db.prepare(`SELECT cabinet FROM campagne_series WHERE mode = 'cabinet' AND cabinet IS NOT NULL ORDER BY commencee_le DESC LIMIT 1`).get() as { cabinet: string } | undefined
  db.close()
  const depart = ligne && lireLeDepart(ligne.cabinet)
  if (!depart) throw new Error('le départ de l’épreuve ne se relit pas')
  return depart.tirages as FiletEnDeuxTempsTire[]
}

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
  const jouee = d.querySelector('.cab-filet-jouee')
  return {
    hauteur: d.scrollingElement.scrollHeight, ecran: innerHeight, large: d.documentElement.scrollWidth > innerWidth,
    mots: texte.split(' ').filter(Boolean).length, nombres: (texte.match(/\\d[\\d\\u202f\\u00a0 ]*/g) || []).length,
    cibles: vus.length, sousLePli: vus.filter(b => b.getBoundingClientRect().top >= innerHeight).map(nomDe),
    petites: vus.filter(b => b.getAttribute('aria-disabled') !== 'true' && b.getBoundingClientRect().height < 43.5).map(nomDe),
    finDeLaManche: manche ? Math.round(manche.lastElementChild.getBoundingClientRect().bottom + scrollY) : null,
    hautDuPied: pied ? Math.round(pied.getBoundingClientRect().top) : null,
    // Le verdict de l'époque, en tête de l'écran de la valeur : ce qu'il dit, sa hauteur — deux lignes au plus —, et si le
    // curseur, qu'il décrit, a le focus.
    jouee: jouee ? { texte: jouee.innerText.replace(/\\s+/g, ' '), hauteur: Math.round(jouee.getBoundingClientRect().height), focus: d.activeElement === d.querySelector('.cab-curseur') && d.activeElement.getAttribute('aria-describedby') === jouee.id } : null,
    drapeaux: [...d.querySelectorAll('.cab-filet-drapeau')].map(e => { const r = e.getBoundingClientRect(); const p = e.parentElement.getBoundingClientRect(); return { texte: e.innerText.replace(/\\s+/g, ' '), hauteur: Math.round(r.height), sort: r.left < p.left - 1 || r.right > p.right + 1 } }),
    plusPetitTexte: Math.min(...[...d.querySelectorAll('.cab-manche *, .cab-pied-partie *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize))),
    texte,
  }
})()`
let n = 0
const defilent: string[] = []
const tasses: string[] = []
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
  if (m.jouee) console.log(`   le verdict de l'époque : « ${m.jouee.texte} », ${m.jouee.hauteur} px de haut${m.jouee.focus ? ', le focus sur le curseur qu’il décrit' : ''}`)
  for (const x of m.drapeaux as { texte: string; hauteur: number; sort: boolean }[]) {
    console.log(`   le repère de la piste : « ${x.texte} », ${x.hauteur} px de haut${x.sort ? ' — ⚠ sort de la piste' : ''}`)
    if (x.hauteur > 45 || x.sort) tasses.push(`${path.basename(base)} : « ${x.texte} », ${x.hauteur} px`)
  }
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

try {
  await page.goto(`${banc.url}/cabinet`)
  await page.waitForTimeout(3000)
  await page.locator('.cab-tv-option', { hasText: 'Filet' }).first().tap()
  await page.waitForTimeout(700)
  await page.locator('.cab-tv-panneau .cab-tv-cta').tap()
  await page.waitForTimeout(2200)
  await photo('annonce')
  await toucher(/^Commencer/)
  const pasCetteFois = page.getByRole('button', { name: 'Pas cette fois' })
  const epoques = page.locator('.cab-epoque')
  // La mise de Quitte ou double paraît un instant après « Commencer » : on l'attend, elle ou les époques.
  const passerLaMise = async () => {
    await Promise.race([pasCetteFois.waitFor({ timeout: 8000 }), epoques.first().waitFor({ timeout: 8000 })]).catch(() => {})
    if (await pasCetteFois.count()) await toucher('Pas cette fois')
  }
  await passerLaMise()
  const tirages = tiragesDeLEpreuve()
  const curseur = page.locator('.cab-curseur')
  for (let manche = 1; manche <= 3; manche++) {
    const t = tirages[manche - 1]
    await epoques.first().waitFor()
    // Une carte posée sous la manche ou collée au pied fait défiler : sans elle, l'écran doit tenir.
    await photo(`manche-${manche}-les-epoques`, cas === 'simple')
    if (manche === 1) {
      // La bonne époque, d'un toucher : elle est jouée, et l'écran de la valeur s'ouvre sur son verdict.
      await epoques.nth(t.bonnes[0]).tap()
      await curseur.waitFor()
      await photo(`manche-${manche}-la-bonne-epoque-la-valeur`, cas === 'simple')
      await page.getByRole('button', { name: 'Un cran de plus' }).tap()
      await page.locator('.cab-grand-pas').last().tap()
      await photo(`manche-${manche}-le-curseur-deplace`)
    }
    if (manche === 2) {
      // « Deux époques de moins », puis une mauvaise parmi celles qui restent — sinon la plus loin de la bonne.
      await page.locator('.cab-filet-aide').first().tap()
      await page.waitForTimeout(900)
      await photo(`manche-${manche}-deux-epoques-de-moins`)
      const restantes = t.tranches.map((_, k) => k).filter(k => !t.bonnes.includes(k) && !t.retirables.includes(k))
      const mauvaise = restantes[0] ?? t.tranches.findIndex((_, k) => !t.bonnes.includes(k))
      // Toutes les mauvaises retirées : il ne reste que la bonne, et la manche ne peut plus montrer une époque ratée.
      await epoques.nth(restantes.length > 0 ? mauvaise : t.bonnes[0]).tap()
      await curseur.waitFor()
      await photo(`manche-${manche}-${restantes.length > 0 ? 'la-mauvaise-epoque' : 'la-bonne-epoque-aidee'}-la-valeur`, cas === 'simple')
    }
    if (manche === 3) {
      // Une mauvaise époque sans aide : laquelle c'était, ce qui reste à prendre.
      const mauvaise = t.tranches.findIndex((_, k) => !t.bonnes.includes(k))
      await epoques.nth(mauvaise).tap()
      await curseur.waitFor()
      await photo(`manche-${manche}-la-mauvaise-epoque-la-valeur`, cas === 'simple')
    }
    await page.locator('.cab-lancer').tap()
    await page.waitForTimeout(2200)
    await photo(`manche-${manche}-la-revelation`)
    if (manche < 3) {
      await page.getByRole('button', { name: /Manche suivante/ }).first().tap()
      await page.waitForTimeout(800)
      await passerLaMise()
    }
  }
} catch (e) {
  console.error('[rendu]', (e as Error).message.split('\n')[0])
  await page.screenshot({ path: path.join(sortie, 'echec.png') }).catch(() => {})
  process.exitCode = 1
}
await navigateur.close()
await banc.close()
console.log(defilent.length ? `\n⚠ Défile, quand il devait tenir sur l'écran :\n${defilent.join('\n')}` : `\n${n} photos dans ${sortie} — les deux écrans de la manche tiennent sans défiler`)
if (tasses.length) console.log(`\n⚠ Un repère tassé ou hors de sa piste :\n${tasses.join('\n')}`)
if (defilent.length || tasses.length) process.exitCode = 1

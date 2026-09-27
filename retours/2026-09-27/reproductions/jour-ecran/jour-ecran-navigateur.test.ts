// Les reproductions de l'audit « jour-ecran » qui ne se voient qu'au
// téléphone : un vrai Chromium (Playwright, parmi les modules globaux) sur
// un serveur jetable qui sert le client construit dans ce dossier.
// Chacune échoue sur le code d'aujourd'hui (b57035c) et passera le jour où
// le défaut sera corrigé — le client reconstruit :
//
//   cd client && nice -n 10 npx vite build --outDir ../export/evaluations/jour-ecran/dist
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-ecran/jour-ecran-navigateur.test.ts
//
// Les scripts passés à la page sont des chaînes : tsx nomme les fonctions
// imbriquées (`__name`), que la page ne connaît pas.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import type { Browser, Page } from 'playwright'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'

const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright') as typeof import('playwright')
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Dix questions de cinq secondes, chacune avec son anecdote — ce qu'écrit la routine. */
const LISTE = `Temps : 5 s

# Géographie
Quelle ville est la capitale de l'Italie depuis 1871 ?
*Rome
Milan
Naples
Turin
Anecdote : Rome n'est la capitale de l'Italie que depuis 1871 ; avant elle, Turin puis Florence l'ont été, le temps que l'unité du pays se fasse autour du roi Victor-Emmanuel II.

# Nature
Combien de pattes compte une araignée adulte ?
Six
*Huit
Dix
Douze
Anecdote : Les araignées ne sont pas des insectes : ce sont des arachnides, comme les scorpions et les acariens, et la plupart ont aussi huit yeux, dont certains ne voient que la lumière.

# Sciences
Quelle planète du système solaire doit sa couleur à la rouille ?
Vénus
*Mars
Jupiter
Mercure
Anecdote : Sa couleur vient de l'oxyde de fer, la rouille, qui couvre ses roches et sa poussière ; ses tempêtes de poussière peuvent envelopper la planète entière pendant des semaines.

# Histoire
En quelle année a eu lieu la prise de la Bastille ?
1776
*1789
1799
1815
Anecdote : Il n'y avait plus que sept prisonniers dans la forteresse ce jour-là ; les émeutiers y cherchaient surtout la poudre qui leur manquait pour les fusils pris aux Invalides.

# Arts & lettres
Quel aviateur a écrit « Le Petit Prince », paru en 1943 ?
*Antoine de Saint-Exupéry
Jules Verne
Albert Camus
Marcel Pagnol
Anecdote : Le livre a paru d'abord à New York, en 1943, en anglais et en français ; son auteur, aviateur, disparut en mission au-dessus de la Méditerranée l'année suivante.

# Cuisine
De quel pays vient la paella ?
L'Italie
*L'Espagne
Le Portugal
Le Mexique
Anecdote : La paella est née dans les rizières autour de Valence ; la recette traditionnelle mêle poulet, lapin et haricots verts, bien plus que les fruits de mer des cartes touristiques.

# Sport
Combien de joueurs compte une équipe de football sur le terrain ?
Neuf
Dix
*Onze
Douze
Anecdote : Le nombre de onze s'est fixé dans les écoles anglaises du XIXᵉ siècle, où l'on jouait souvent par dortoirs de dix élèves et un surveillant.

# Musique
Combien de cordes a une guitare classique ?
Quatre
Cinq
*Six
Sept
Anecdote : La guitare à six cordes simples ne s'est imposée qu'à la fin du XVIIIᵉ siècle ; avant elle, on jouait surtout des guitares à cinq chœurs, des paires de cordes accordées ensemble.

# Culture générale
Combien de côtés compte une alvéole d'abeille ?
Cinq
*Six
Sept
Huit
Anecdote : Les abeilles construisent leurs alvéoles en hexagones : c'est la forme qui pave un plan avec le moins de cire pour le plus de place, ce que les mathématiciens n'ont démontré qu'en 1999.

# Jeux & pop culture
Quelle est la couleur de Pac-Man ?
*Jaune
Rouge
Bleu
Vert
Anecdote : Son créateur, Toru Iwatani, dit avoir eu l'idée devant une pizza à laquelle manquait une part ; le jeu devait attirer au salon d'arcade un public qui n'aimait pas les jeux de tir.
`

let browser: Browser
before(async () => {
  browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close()
})

interface Scene {
  banc: Banc
  horloge: { decalage: number; maintenant(): number }
  bonne(jour: string, index: number): number
  telephone(opts?: { zoom?: number; horlogeQuiSaute?: boolean }): Promise<Page>
}

/** Un serveur jetable, sa réserve réduite aux dix questions de `LISTE`, l'horloge du jour partie de `depart`. */
async function scene(depart: number, jeu: (s: Scene) => Promise<void>) {
  const horloge = { decalage: depart - Date.now(), maintenant: () => Date.now() + horloge.decalage }
  const banc = await demarrer({ clientDist: DIST, horlogeDuJour: () => horloge.maintenant() })
  const contextes: { close(): Promise<void> }[] = []
  try {
    const fichier = banc.quizDbUrl.replace(/^file:/, '')
    const db = new Database(fichier)
    db.prepare('UPDATE jour_reserve SET retiree_le = 1').run()
    db.close()
    const admin = await connexionAnimateur(banc.url)
    const depot = await ecrire(banc.url, '/api/admin/jour/liste', { texte: LISTE }, admin)
    assert.equal(((await depot.json()) as any).ajoutees, 10)
    let n = 0
    await jeu({
      banc,
      horloge,
      bonne(jour, index) {
        const lecture = new Database(fichier, { readonly: true })
        try {
          const r = lecture.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string }
          return JSON.parse(r.questions)[index].bonne
        } finally {
          lecture.close()
        }
      },
      async telephone(opts = {}) {
        const cookie = await inscrireProfil(banc.url, `tel${++n}`, `Joueur ${n}`, '🦊')
        const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' })
        contextes.push(ctx)
        await ctx.addCookies([{ name: 'qz_joueur', value: cookie.slice(cookie.indexOf('=') + 1), url: banc.url }])
        if (opts.zoom) {
          await ctx.addInitScript({
            content: `(() => { const f = () => { if (document.documentElement) document.documentElement.style.zoom = '${opts.zoom}%' }; document.addEventListener('DOMContentLoaded', f); f() })()`,
          })
        }
        if (opts.horlogeQuiSaute) {
          await ctx.addInitScript({
            content: `(() => { const V = Date; window.__saut = 0; const m = () => V.now() + window.__saut;
              function F(...a) { if (!new.target) return V(); return a.length === 0 ? new V(m()) : new V(...a) }
              F.prototype = V.prototype; F.now = m; F.UTC = V.UTC; F.parse = V.parse; window.Date = F })()`,
          })
        }
        const page = await ctx.newPage()
        await page.goto(`${banc.url}/jour`)
        await page.getByRole('button', { name: /Jouer/ }).waitFor()
        return page
      },
    })
  } finally {
    for (const c of contextes) await c.close()
    await banc.close()
  }
}

const jourDe = (instant: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))

async function jouerLaPremiere(s: Scene, page: Page) {
  await page.getByRole('button', { name: /Jouer/ }).click()
  await page.locator('.ans-btn').first().waitFor()
  await page.locator('.ans-btn').nth(s.bonne(jourDe(s.horloge.maintenant()), 0)).click()
  await page.locator('.result-banner').waitFor()
}

// ── jour-ecran-1 ──────────────────────────────────────────────────────────
// Le réseau coupé au moment de répondre, revenu après l'échéance : la page a
// tenté UNE fois d'aller chercher la révélation (`JourApp.tsx:132-141`),
// hors ligne, et s'est tue (`.catch(() => {})`). Réseau revenu, elle reste
// sur « Réponses closes », sans bouton ni message, jusqu'à ce qu'on recharge.
test('le réseau revenu après l’échéance, la page se reprend seule', () =>
  scene(Date.UTC(2026, 8, 26, 8, 0), async s => {
    const page = await s.telephone()
    await page.getByRole('button', { name: /Jouer/ }).click()
    await page.locator('.ans-btn').first().waitFor()
    await page.context().setOffline(true)
    await page.locator('.ans-btn').nth(s.bonne('2026-09-26', 0)).click()
    await page.locator('.envoi-perdu').waitFor()
    await patienter(5000 + 2100 + 1500) // l'échéance, puis le rendez-vous de la page, hors ligne
    await page.context().setOffline(false)
    const reprise = await page
      .locator('.result-banner')
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    assert.equal(reprise, true, 'dix secondes après le retour du réseau, la page est toujours figée sur « Réponses closes »')
  }))

// ── jour-ecran-2 ──────────────────────────────────────────────────────────
// « Question suivante » est sous la grille des réponses de la question qui
// vient : un double toucher (ou un second, parce que le premier « n'a rien
// fait ») répond à la question suivante avant qu'on l'ait lue — et le quiz
// du jour prend le premier toucher pour définitif.
test('un double toucher sur « Question suivante » ne répond pas à la question suivante', () =>
  scene(Date.UTC(2026, 8, 26, 8, 0), async s => {
    const page = await s.telephone()
    await jouerLaPremiere(s, page)
    const b = (await page.getByRole('button', { name: 'Question suivante' }).boundingBox())!
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await patienter(150)
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await patienter(800)
    const db = new Database(s.banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const reponses = db.prepare('SELECT question, choix, ms FROM jour_reponses WHERE question = 1').all()
    db.close()
    assert.deepEqual(reponses, [], 'la deuxième question a reçu une réponse que personne n’a choisie')
  }))

// ── jour-ecran-6 ──────────────────────────────────────────────────────────
// Une question servie à 23 h 59 min 58 s, touchée à minuit passé : le
// serveur refuse (« Minuit est passé : le quiz d'hier est clos »), et la
// page dit « Ta réponse n'est pas partie — touche-la à nouveau » : chaque
// nouveau toucher reçoit le même refus, jusqu'à l'échéance.
test('une réponse refusée à minuit ne demande pas de la retoucher', () =>
  scene(Date.UTC(2026, 8, 26, 21, 59, 45), async s => {
    const page = await s.telephone()
    await jouerLaPremiere(s, page)
    // 23 h 59 min 58,5 s : la deuxième question, qui finit à 0 h 00 min 03,5 s.
    await patienter(Date.UTC(2026, 8, 26, 21, 59, 58, 500) - s.horloge.maintenant())
    await page.getByRole('button', { name: 'Question suivante' }).click()
    await page.locator('.ans-btn').first().waitFor()
    await patienter(Date.UTC(2026, 8, 26, 22, 0, 0, 300) - s.horloge.maintenant())
    await page.locator('.ans-btn').nth(s.bonne('2026-09-26', 1)).click()
    await patienter(1200)
    const retoucher = await page.locator('.envoi-perdu').count()
    assert.equal(retoucher, 0, '« touche-la à nouveau » après un refus définitif')
  }))

// ── jour-ecran-4 ──────────────────────────────────────────────────────────
// Au texte agrandi (130 %), la révélation dépasse l'écran : on descend
// jusqu'à « Question suivante ». La question suivante s'affiche alors là où
// la page était — le chrono et le numéro de la question au-dessus du pli.
// La page d'une soirée remonte en haut à chaque écran (`PlayerApp.tsx`,
// `window.scrollTo(0, 0)`) ; celle du jour non.
test('au texte agrandi, la question suivante s’ouvre en haut de page, chrono visible', () =>
  scene(Date.UTC(2026, 8, 26, 8, 0), async s => {
    const page = await s.telephone({ zoom: 130 })
    await jouerLaPremiere(s, page)
    const suivante = page.getByRole('button', { name: 'Question suivante' })
    await suivante.scrollIntoViewIfNeeded()
    assert.ok((await page.evaluate('window.scrollY')) as number > 0, 'la révélation dépasse l’écran : on a dû descendre')
    await suivante.click()
    await page.locator('.ans-btn').first().waitFor()
    await patienter(200)
    const hautDuChrono = (await page.evaluate("document.querySelector('.timer').getBoundingClientRect().top")) as number
    assert.ok(hautDuChrono >= 0, `le chrono doit se voir : son haut est à ${Math.round(hautDuChrono)} px, hors de l’écran`)
  }))

// ── jour-ecran-3 ──────────────────────────────────────────────────────────
// La page du jour n'a aucune région annoncée : ni la révélation (« Bien
// joué ! », « Raté… ») ni la question qui s'ouvre ne sont dites au lecteur
// d'écran, et le focus retombe sur la page quand le bouton touché disparaît.
// La page d'une soirée enveloppe le jeu d'un `aria-live="polite"`.
test('le lecteur d’écran entend le résultat d’une réponse', () =>
  scene(Date.UTC(2026, 8, 26, 8, 0), async s => {
    const page = await s.telephone()
    await jouerLaPremiere(s, page)
    const annonce = (await page.evaluate(`(() => {
      const regions = Array.from(document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]'))
      const dite = regions.some(r => /Bien joué/.test(r.textContent || ''))
      const focus = document.activeElement && document.activeElement.closest && document.activeElement.closest('.result-banner, .quiz-player')
      return dite || !!focus
    })()`)) as boolean
    assert.equal(annonce, true, 'ni région annoncée ni focus sur la révélation')
  }))

// ── jour-ecran-8 ──────────────────────────────────────────────────────────
// L'écart d'horloge se mesure une fois : `bestSample` garde la mesure la plus
// rapide, et la page du jour ne le remet jamais à zéro (la soirée le fait à
// chaque connexion, `resetClock`). Une horloge de téléphone qui se recale de
// 30 s après la première mesure ferme chaque question dès son affichage.
test('une horloge de téléphone qui se recale de 30 s se remesure', () =>
  scene(Date.now(), async s => {
    const page = await s.telephone({ horlogeQuiSaute: true })
    // Les mesures suivantes seront plus lentes que la première : un réseau mobile ordinaire.
    await page.route('**/api/jour**', async route => {
      await patienter(150)
      await route.continue()
    })
    await page.evaluate('window.__saut = 30000')
    await page.getByRole('button', { name: /Jouer/ }).click()
    await page.locator('.ans-btn').first().waitFor()
    await patienter(300)
    const actives = await page.locator('.ans-btn:not([disabled])').count()
    assert.equal(actives, 4, 'la question s’affiche close : le téléphone croit l’échéance passée')
  }))

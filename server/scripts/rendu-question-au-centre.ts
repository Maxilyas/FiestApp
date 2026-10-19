// La question au centre (la version 10 du départ, le 19 octobre 2026 — l'étape 2
// du plan, `retours/2026-10-19/la-question-au-centre.md`), photographiée au
// téléphone (360 × 640) sur un serveur jetable qui l'ouvre — le banc la ferme
// d'office. Un débutant au niveau 1, sans pari : son départ et ses trois
// styles, son codex de soixante-deux cartes, ses règles ; le plan et sa main
// de l'acte en petit, ses tas ; une rencontre qui s'ouvre sur sa question —
// les règles à la première, l'adversaire en crans et son attaque, la main sous
// la question —, une carte levée puis jouée, une bonne réponse qui lui fait
// perdre un cran, une erreur et l'attaque, l'adversaire qui tombe, sa carte à
// prendre ; puis le gardien, vaincu, et le plan de l'acte 2 — sa main rouverte.
// Une joueuse aguerrie ensuite, au niveau du pari : l'annonce et son pari, ce
// qu'il rapporte, la main éteinte jusqu'à la question. Puis les coups de pouce
// et les lettres (la version 11, l'étape 3, `retours/2026-10-19/les-coups-de-pouce.md`),
// sur une base dont les réponses se composent — des noms, la moitié datés — :
// Zoé prend L'initiale, Le repère et La lettre dans ses offres, les joue — levés,
// puis ce qu'ils soufflent sur une question à choix —, et compose : les cases et
// les tuiles, un coup de pouce qui pose sa lettre ou retire une lettre de trop,
// les cases pleines, une composition fausse — « Tu as composé X — c'était Y » —,
// une juste, puis « Mes réponses » à la fin. Ce qui élargit la page se dit
// (`[déborde]`). Le client construit d'abord (`npm run build -w client`) ;
// `coups-de-pouce` ne rejoue que Zoé.
//
//   npx tsx scripts/rendu-question-au-centre.ts [dossier] [ivoire] [coups-de-pouce]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from '../test/banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES } from '../../shared/categories'
import { ecrireLeBilan } from '../../shared/codex'
import { gabaritDe } from '../../shared/lettres'

const sortie = path.resolve(process.argv[2] ?? 'rendu-question-au-centre')
const ivoire = process.argv.includes('ivoire')
const seulementZoe = process.argv.includes('coups-de-pouce')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/** Une expédition partie et abandonnée, sa renommée portée au niveau 6 — le pari, les fioles, les talismans, L'initiale. */
async function auNiveau6(b: Banc, cookie: string) {
  const partie = (await (await ecrire(b.url, '/api/expedition', { rencontres: true, questionAuCentre: true }, cookie)).json()) as { id: string }
  await ecrire(b.url, `/api/expedition/${partie.id}/abandon`, {}, cookie)
  const base = new Database(b.quizDbUrl.replace(/^file:/, ''))
  try {
    base.prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?').run(ecrireLeBilan({ escales: 120, adversaires: 46, elites: 12, gardiens: 9, auBout: true, exploits: [] }), partie.id)
  } finally {
    base.close()
  }
}

/** Des réponses qui se composent — deux mots au plus, de quatre à douze lettres —, et que le rendu retrouve par le numéro de la question. */
const NOMS = [
  'Victor Hugo',
  'Marie Curie',
  'Mont Blanc',
  'Picasso',
  'Mozart',
  'Napoléon',
  'Cléopâtre',
  'Molière',
  'Einstein',
  'Jules Verne',
  'Amazonie',
  'Everest',
  'Venise',
  'Rembrandt',
  'Chopin',
  'Neptune',
  'Saturne',
  'Marathon',
  'Ratatouille',
  'Camembert',
  'Pasteur',
  'Kangourou',
  'Tour Eiffel',
  'Versailles',
  'Beethoven',
  'La Joconde',
  'Big Ben',
  'Cerf-volant',
]
const nomDe = (i: number) => NOMS[i % NOMS.length]
/** 960 questions de toutes les catégories, la moitié datées : Le repère y dit une époque, ou efface. */
function baseQuiSeCompose(): BaseDeLaCampagne {
  const questions = Array.from({ length: 960 }, (_, i) => {
    const categorie = CATEGORIES[i % CATEGORIES.length]
    const autres = [1, 2, 3, 4, 5, 6].map(k => nomDe(i + k * 5))
    const lu = lireQuestionDeLaBase({
      id: `pouce${String(i).padStart(3, '0')}`,
      texte: `Question d'essai numéro ${i} : de qui ou de quoi parle-t-on ?`,
      reponses: [nomDe(i), ...autres.slice(0, 3)],
      bonne: 0,
      anecdote: `L'anecdote de la question ${i}.`,
      categorie,
      sousTheme: SOUS_THEMES[categorie][0].cle,
      etiquettes: [],
      difficulte: [1, 2, 3, 4, 5][i % 5],
      ageMin: 10,
      date: i % 2 === 0 ? { valeur: String(1500 + ((i * 7) % 500)), precision: 'annee' } : null,
      entites: [],
      portee: 'monde',
      valeur: null,
      leurres: autres,
      dureeDeVie: 'stable',
      explication: '',
      source: null,
      confiance: 3,
      aRelire: [],
    })
    if ('refus' in lu) throw new Error(`baseQuiSeCompose : ${lu.refus}`)
    return lu.question
  })
  return new BaseDeLaCampagne(questions)
}

// La question au centre, ouverte : le banc la ferme pour les épreuves d'avant elle.
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }), questionAuCentre: true })
const navigateur = await chromium.launch({ headless: true })
try {
  const noe = await inscrireProfil(banc.url, 'noe', 'Noé', '🐢')
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  for (const c of [noe, lea]) if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, c, 'PUT')
  // Léa a déjà joué.
  await auNiveau6(banc, lea)

  for (const [qui, cookie, prefixe] of seulementZoe
    ? []
    : ([
        ['Noé', noe, 'a'],
        ['Léa', lea, 'b'],
      ] as const)) {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error(`[page] ${qui} :`, e.message))
    const fait = new Set<string>()
    const photo = async (nomFichier: string, pleine = false) => {
      if (fait.has(nomFichier)) return
      fait.add(nomFichier)
      await page.waitForTimeout(450)
      await page.screenshot({ path: path.join(sortie, `${prefixe}-${nomFichier}.png`), fullPage: pleine })
      console.log(path.join(sortie, `${prefixe}-${nomFichier}.png`))
    }
    /** Ce qui déborde de côté : rien ne doit élargir la page (règle `css.md`). */
    const largeur = async (ou: string) => {
      const l = Number(await page.evaluate('document.documentElement.scrollWidth'))
      if (l > 360) console.error(`[déborde] ${qui}, ${ou} : ${l} pixels de large`)
    }
    const ici = async (): Promise<string> => {
      if (await page.locator('.exp-plan').count()) return 'carte'
      if (await page.locator('.exp-rencontre').count()) return 'annonce'
      if (await page.locator('.exp-offre').count()) return 'offre'
      if (await page.locator('.exp-camper').count()) return 'campement'
      if (await page.locator('.exp-echoppe-page').count()) return 'echoppe'
      if (await page.locator('.exp-inconnu').count()) return 'inconnu'
      if (await page.locator('.result-banner').count()) return 'revelation'
      if (await page.locator('.ans-btn').count()) return 'question'
      if (await page.locator('.exp-vaincu').count()) return 'vaincu'
      if (await page.locator('.exp-choix').count()) return 'choix'
      if (await page.locator('.exp-fin-tete').count()) return 'fin'
      return 'autre'
    }
    /** Répond à la question à l'écran : juste, ou une autre qui n'est pas effacée. */
    const repondre = async (juste: boolean) => {
      await page.waitForSelector('.ans-btn')
      // La Prédiction de l'Oracle, jouée : la réponse touchée se montre d'abord à lui, et il dit ce qu'il en pense.
      if ((await page.locator('.exp-consigne', { hasText: 'montrer à l’Oracle' }).count()) > 0) {
        await page.locator('.ans-btn:not(.exp-effacee)').first().click()
        await page.locator('.exp-indice', { hasText: 'L’Oracle' }).waitFor()
        await photo('4e-oracle')
      }
      const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
      const effacees: boolean[] = await page.$$eval('.ans-btn', (els: any[]) => els.map(e => e.classList.contains('exp-effacee')))
      const proposee = (await page.locator('.exp-proposee b').count()) > 0 ? String(await page.locator('.exp-proposee b').textContent()) : null
      const bonne = proposee === null ? textes.findIndex(t => t.startsWith('Bonne')) : textes.indexOf(proposee.includes('Bonne') ? 'Vrai' : 'Faux')
      const fausse = textes.findIndex((t, i) => i !== bonne && !effacees[i])
      if ((await page.locator('.exp-consigne', { hasText: 'Double chance' }).count()) > 0) {
        await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
        await page.locator('.ans-btn').nth(textes.findIndex((t, i) => i !== bonne && i !== fausse && !effacees[i])).click()
        await page.locator('.quiz-player > .btn-primary').click()
      } else await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
      await page.waitForSelector('.result-banner')
    }

    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.exp-depart-pied')
    await largeur('le départ')
    await photo('1-depart')
    await photo('1-depart-entier', true)
    if (await page.locator('.exp-style').count()) {
      await page.locator('.exp-style').scrollIntoViewIfNeeded()
      await photo('1b-style')
    }
    await page.locator('.exp-codex-du-depart .exp-ouvrir').click()
    await page.waitForSelector('.feuille-codex')
    await largeur('le codex')
    await photo('1c-codex')
    await page.locator('.feuille-codex .carte-fermer').click()
    await page.locator('.exp-haut-du-depart .exp-regles').click()
    await page.waitForSelector('.feuille-regles')
    await photo('1d-regles')
    await page.locator('#exp-regles-cartes').scrollIntoViewIfNeeded()
    await photo('1d-regles-cartes')
    await page.locator('.feuille-regles .carte-fermer').click()
    await page.click('.exp-depart-pied .btn-primary')
    await page.waitForSelector('.exp-plan')
    await largeur('le plan')
    await photo('2-plan')
    await page.locator('.exp-panneau .exp-pioche').click()
    await page.waitForSelector('.feuille-paquet')
    await photo('2b-tas')
    await page.locator('.feuille-paquet .carte-fermer').click()

    let questions = 0
    let rencontres = 0
    // Noé va jusqu'au gardien vaincu et au plan de l'acte 2 — sa main rouverte —, Léa ne joue que deux rencontres.
    const encore = () => (prefixe === 'a' ? !fait.has('7c-acte-2') : rencontres < 2)
    for (let tour = 0; tour < 300 && encore(); tour++) {
      const ou = await ici()
      if (ou === 'carte') {
        if (fait.has('7-gardien-vaincu')) {
          await largeur('le plan de l’acte 2')
          await photo('7c-acte-2')
          continue
        }
        if (await page.locator('.exp-panneau-titre').count()) await photo('6-avant-le-gardien')
        const adversaire = page.locator('.exp-carte-escale.exp-question, .exp-carte-escale.exp-elite').first()
        await ((await adversaire.count()) ? adversaire : page.locator('.exp-carte-escale').first()).click()
        await page.locator('.exp-panneau > .btn-primary').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'annonce') {
        if (await page.locator('.feuille-regles').count()) {
          await photo('3-regles')
          await page.locator('.feuille-regles .carte-pied .btn-primary').click()
          await page.waitForTimeout(250)
        }
        await largeur('l’annonce')
        await photo('3-annonce')
        // Une carte du pari, s'il en a : levée, puis jouée.
        const pari = page.locator('.exp-cartes .exp-face:not(.exp-face-eteinte)').first()
        if (await pari.count()) {
          await pari.click()
          await page.waitForSelector('.exp-leve')
          await photo('3b-carte-du-pari')
          await page.locator('.exp-leve .btn-primary').click()
          await page.waitForTimeout(350)
        }
        const dix = page.locator('.exp-mise:not(.exp-refuse)', { hasText: '10' })
        if (await dix.count()) {
          await dix.first().click()
          await photo('3c-pari')
        }
        await page.locator('.exp-voir').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'question') {
        if (await page.locator('.feuille-regles').count()) {
          await photo('4-regles-a-la-question')
          await page.locator('.feuille-regles .carte-pied .btn-primary').click()
          await page.waitForTimeout(250)
        }
        await largeur('la question')
        const auGardien = (await page.locator('.exp-adversaire-gardien').count()) > 0
        await photo(auGardien ? '7a-gardien' : questions === 0 ? '4-question' : '4-question-suivante')
        await photo('4-question-entiere', true)
        // Une carte de sa main : levée — ce qu'elle fait, ce qu'elle changerait —, puis jouée ; les autres s'éteignent.
        const carte = page.locator('.exp-cartes .exp-face:not(.exp-face-eteinte)').first()
        if (questions % 2 === 0 && (await carte.count())) {
          await carte.click()
          await page.waitForSelector('.exp-leve')
          await page.waitForTimeout(300)
          await photo(questions === 0 ? '4b-carte-levee' : '4b-carte-levee-suivante')
          await page.locator('.exp-leve .btn-primary').click()
          await page.waitForTimeout(400)
          if (await page.locator('.exp-visages').count()) await page.locator('.exp-visages .pill-btn').first().click()
          await photo(questions === 0 ? '4c-carte-jouee' : '4c-carte-jouee-suivante', true)
          // Une deuxième carte, levée : une carte par question, elle le dit.
          const autre = page.locator('.exp-cartes .exp-face.exp-face-eteinte').first()
          if (!fait.has('4d-une-par-question') && (await autre.count())) {
            await autre.click()
            await page.waitForSelector('.exp-leve')
            await photo('4d-une-par-question')
            await page.locator('.exp-leve .exp-reposer').click()
          }
        }
        questions++
        await repondre(questions % 4 !== 2)
        continue
      }
      if (ou === 'revelation') {
        const juste = (await page.locator('.result-banner.result-ok').count()) > 0
        const tombe = (await page.locator('.exp-adversaire-tombe').count()) > 0
        if (tombe) rencontres++
        const duGardien = (await page.locator('.exp-adversaire-gardien').count()) > 0
        await photo(duGardien ? (tombe ? '7b-gardien-tombe' : juste ? '7b-gardien-juste' : '7b-gardien-faux') : tombe ? '5c-il-tombe' : juste ? '5-juste' : '5b-faux', true)
        await page.locator('.result-banner ~ .btn-primary.btn-big').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'offre') {
        await photo('5d-carte-a-prendre', true)
        await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
        await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'campement') {
        await photo('6b-campement')
        const repos = page.locator('.exp-camper .exp-choix-ligne', { hasText: 'Te reposer' })
        if (await repos.count()) await repos.click()
        await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'echoppe') {
        await photo('8-echoppe', true)
        await page.locator('.exp-echoppe-page .btn-ghost').click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'inconnu' || ou === 'vaincu') {
        await photo(ou === 'vaincu' ? '7-gardien-vaincu' : '8b-inconnu')
        await page.locator('.btn-primary.btn-big').last().click()
        await page.waitForTimeout(300)
        continue
      }
      if (ou === 'fin' || ou === 'choix') {
        await photo('9-fin', true)
        break
      }
      console.error(`[rendu] ${qui} : écran inconnu au tour ${tour}`)
      break
    }
    await contexte.close()
  }

  // ── Zoé : les coups de pouce et les lettres (v11), sur une base qui se compose ──
  const autreBanc = await demarrer({ baseDeLaCampagne: baseQuiSeCompose(), questionAuCentre: true })
  try {
    const zoe = await inscrireProfil(autreBanc.url, 'zoe', 'Zoé', '🦉')
    if (ivoire) await ecrire(autreBanc.url, '/api/joueur/moi', { theme: 'ivoire' }, zoe, 'PUT')
    await auNiveau6(autreBanc, zoe)
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [nom, valeur] = zoe.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: autreBanc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page] Zoé :', e.message))
    const fait = new Set<string>()
    const photo = async (nomFichier: string, pleine = false) => {
      if (fait.has(nomFichier)) return
      fait.add(nomFichier)
      await page.waitForTimeout(450)
      await page.screenshot({ path: path.join(sortie, `c-${nomFichier}.png`), fullPage: pleine })
      console.log(path.join(sortie, `c-${nomFichier}.png`))
    }
    const largeur = async (ou: string) => {
      const l = Number(await page.evaluate('document.documentElement.scrollWidth'))
      if (l > 360) console.error(`[déborde] Zoé, ${ou} : ${l} pixels de large`)
    }
    const POUCES = ['initiale', 'lettre', 'repere']
    /** Ces cartes, améliorées ou non, sous ce sélecteur : `data-carte` porte la clé de l'exemplaire. */
    const parCles = (avant: string, cles: readonly string[]) => cles.map(c => `${avant}[data-carte^="${c}"]`).join(', ')
    /** Le nom que la base a donné à la question à l'écran : sa bonne réponse — un dévoilement, une fois son numéro dit. */
    const bonneALEcran = async () => {
      let texte = ''
      for (let essai = 0; essai < 60; essai++) {
        texte = String(await page.locator('h2.quiz-question').first().textContent())
        const i = Number(/numéro (\d+)/.exec(texte)?.[1])
        if (Number.isFinite(i)) return nomDe(i)
        await page.waitForTimeout(200)
      }
      throw new Error(`[rendu] Zoé : pas de numéro dans « ${texte} »`)
    }
    /** Joue l'une de ces cartes de la main, si elle s'y joue : levée d'abord — photographiée sous ce nom —, puis jouée. */
    const jouerLaCarte = async (cles: readonly string[], nomFichier?: string) => {
      const carte = page.locator(parCles('.exp-cartes .exp-face:not(.exp-face-eteinte)', cles))
      if (!(await carte.count())) return false
      await carte.first().click()
      await page.waitForSelector('.exp-leve')
      if (nomFichier) await photo(nomFichier)
      await page.locator('.exp-leve .btn-primary').click()
      await page.waitForTimeout(400)
      return true
    }
    /** Finit l'expédition en route : au bout de l'acte 3, le gardien proposé gardé ; ailleurs, « ← Partir », puis l'abandon, confirmé. */
    const finir = async () => {
      if (await page.locator('.exp-fin-tete').count()) return
      try {
        if (await page.locator('.exp-choix').count()) await page.locator('.exp-choix > .btn-primary.btn-big').click()
        else {
          const partir = '.exp-barre a[href="/expedition"]'
          if (!(await page.locator(partir).count())) {
            await page.goto(`${autreBanc.url}/expedition`)
            await page.waitForSelector(`${partir}, .exp-choix, .exp-depart-pied`)
          }
          if (await page.locator('.exp-choix').count()) await page.locator('.exp-choix > .btn-primary.btn-big').click()
          else {
            if (await page.locator(partir).count()) await page.locator(partir).first().click()
            await page.locator('.exp-abandonner').click()
            await page.locator('.dialog button[type="submit"]').click()
          }
        }
        await page.waitForSelector('.exp-fin-tete')
      } catch (e) {
        console.error('[rendu] Zoé : l’expédition ne s’est pas finie —', (e as Error).message)
      }
    }
    let composees = 0
    let vientDeComposer = false
    // Un coup de pouce sur une question à choix d'abord — ce qu'il souffle, sous elle —, puis sur une question à composer — la lettre
    // qu'il pose : jouée sur la première question venue, la carte n'aurait jamais attendu l'autre.
    const ATTENDUES = ['6-composee-fausse', '6b-composee-juste', '4-pouce-a-choix', '5b-a-composer-aide', '5d-a-composer-pouce']
    const assez = () => ATTENDUES.every(f => fait.has(f))
    for (let expedition = 0; expedition < 5 && !assez(); expedition++) {
      await page.goto(`${autreBanc.url}/expedition`)
      await page.waitForSelector('.exp-depart-pied, .exp-choix, .exp-barre, .exp-fin-tete')
      if (!(await page.locator('.exp-depart-pied').count())) {
        await finir()
        await page.goto(`${autreBanc.url}/expedition`)
        await page.waitForSelector('.exp-depart-pied')
      }
      await page.click('.exp-depart-pied .btn-primary')
      for (let tour = 0; tour < 400 && !assez(); tour++) {
        await page.waitForTimeout(250)
        if (await page.locator('.feuille-regles').count()) {
          // Les règles, à la première : les lignes de la forme à composer et des coups de pouce.
          await photo('1-regles', true)
          await page.locator('.feuille-regles .carte-pied .btn-primary').click()
          continue
        }
        if (await page.locator('.result-banner').count()) {
          // La révélation d'une réponse composée : ce qu'il a composé et la bonne, fausse ; la bonne seule, juste.
          if (vientDeComposer) await photo((await page.locator('.result-banner.result-ok').count()) > 0 ? '6b-composee-juste' : '6-composee-fausse', true)
          vientDeComposer = false
          await page.locator('.result-banner ~ .btn-primary.btn-big').click()
          continue
        }
        if (await page.locator('.exp-plan').count()) {
          const adversaire = page.locator('.exp-carte-escale.exp-question, .exp-carte-escale.exp-elite').first()
          await ((await adversaire.count()) ? adversaire : page.locator('.exp-carte-escale').first()).click()
          await page.locator('.exp-panneau > .btn-primary').click()
          continue
        }
        if (await page.locator('.exp-rencontre').count()) {
          // L'annonce d'une escale à composer : sa forme dite avant le pari.
          if ((await page.locator('.exp-rencontre', { hasText: 'à composer' }).count()) > 0) {
            await largeur('l’annonce à composer')
            await photo('2-annonce-a-composer')
          }
          await page.locator('.exp-voir').click()
          continue
        }
        if (await page.locator('.exp-composer').count()) {
          await largeur('la question à composer')
          await photo('5-a-composer')
          await photo('5-a-composer-entiere', true)
          // L'initiale ou La lettre posent la leur — une fois le coup de pouce à choix vu ; une carte qui efface retire une lettre de trop.
          if (fait.has('4-pouce-a-choix') && !fait.has('5d-a-composer-pouce') && (await jouerLaCarte(['initiale', 'lettre'], '5a-coup-de-pouce-leve'))) await photo('5d-a-composer-pouce')
          else if (!fait.has('5b-a-composer-aide') && (await jouerLaCarte(['coup-d-oeil']))) await photo('5b-a-composer-aide')
          // Ses lettres, case par case, sans les posées : dans le désordre la première fois — elle est fausse —, dans l'ordre ensuite.
          const lettres = gabaritDe(await bonneALEcran())!.lettres
          const cases = await page.$$eval('.exp-case', (els: any[]) => els.map(e => String(e.className).includes('exp-case-posee')))
          const libres = lettres.split('').filter((_, k) => !cases[k])
          const fausse = composees === 0 && new Set(libres).size > 1
          const aPoser = fausse ? [...libres].reverse().join('') === libres.join('') ? [libres[1], libres[0], ...libres.slice(2)] : [...libres].reverse() : libres
          for (const l of aPoser) await page.locator('.exp-tuile', { hasText: new RegExp(`^${l}$`) }).first().click()
          await photo('5c-a-composer-plein')
          composees++
          vientDeComposer = true
          await page.locator('.exp-composer-gestes .btn-primary').click()
          await page.waitForSelector('.result-banner')
          continue
        }
        if (await page.locator('.ans-btn').count()) {
          // Un coup de pouce sur une question à choix : ce qu'il souffle, sous la question.
          if (!fait.has('4-pouce-a-choix') && (await jouerLaCarte(POUCES, '3-coup-de-pouce-leve'))) {
            await largeur('un coup de pouce à choix')
            await photo('4-pouce-a-choix', true)
          } else {
            // Une carte qui ne change rien à la question, pour que la main tourne : pleine, elle laisserait dans la pioche les coups de
            // pouce pris ensuite. Coup d'œil attend d'avoir retiré une lettre de trop sur une question à composer.
            await jouerLaCarte(fait.has('5b-a-composer-aide') ? ['concentration', 'coup-d-oeil'] : ['concentration'])
          }
          const bonne = await bonneALEcran()
          const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
          const proposee = (await page.locator('.exp-proposee b').count()) > 0 ? String(await page.locator('.exp-proposee b').textContent()) : null
          const i = proposee === null ? textes.findIndex(t => t.replace(/\s/g, ' ') === bonne) : textes.indexOf(proposee.includes(bonne) ? 'Vrai' : 'Faux')
          await page.locator('.ans-btn').nth(Math.max(0, i)).click()
          if ((await page.locator('.exp-consigne', { hasText: 'Double chance' }).count()) > 0) await page.locator('.quiz-player > .btn-primary').click()
          await page.waitForSelector('.result-banner')
          continue
        }
        if (await page.locator('.exp-offre').count()) {
          // Ses offres : un coup de pouce d'abord — L'initiale et La lettre, qui posent leur lettre à composer, avant Le repère.
          const lettre = page.locator('.exp-offre').locator(parCles('.exp-a-prendre-carte', ['initiale', 'lettre']))
          const pouce = (await lettre.count()) ? lettre : page.locator('.exp-offre').locator(parCles('.exp-a-prendre-carte', POUCES))
          await ((await pouce.count()) ? pouce.first() : page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first()).click()
          await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
          continue
        }
        if (await page.locator('.exp-camper').count()) {
          const repos = page.locator('.exp-camper .exp-choix-ligne', { hasText: 'Te reposer' })
          if (await repos.count()) await repos.click()
          await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
          continue
        }
        if (await page.locator('.exp-echoppe-page').count()) {
          await page.locator('.exp-echoppe-page .btn-ghost').click()
          continue
        }
        if ((await page.locator('.exp-inconnu').count()) || (await page.locator('.exp-vaincu').count())) {
          await page.locator('.btn-primary.btn-big').last().click()
          continue
        }
        if ((await page.locator('.exp-fin-tete').count()) || (await page.locator('.exp-choix').count())) break
      }
      // « Mes réponses » : une réponse composée y dit la bonne, puis ce qu'il a composé — l'expédition finie d'abord.
      await finir()
      if (await page.locator('.exp-fin-tete').count()) {
        const mesReponses = page.locator('.fin-actions .btn-ghost', { hasText: 'Mes réponses' })
        if (await mesReponses.count()) {
          await mesReponses.click()
          await page.waitForTimeout(600)
          await largeur('mes réponses')
          if (fait.has('6-composee-fausse')) await photo('9-mes-reponses', true)
        }
      }
    }
    if (!assez()) console.error(`[rendu] Zoé : il manque ${ATTENDUES.filter(f => !fait.has(f)).join(', ')}`)
    await contexte.close()
  } finally {
    await autreBanc.close()
  }
} finally {
  await navigateur.close()
  await banc.close()
}

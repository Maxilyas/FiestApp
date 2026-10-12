// Les écrans de la campagne qui se jouent à plusieurs jours d'écart,
// photographiés au téléphone (360 × 640) sur un serveur jetable dont
// l'horloge avance à la main : le carnet de révision — vide, puis rempli par
// des séries ratées, une révision et ses réponses (retrouvée, apprise,
// ratée), sa fin, ce qu'il a appris —, le rappel en fin de série, un duel
// classé contre un inconnu et les défis entre amis — dans leur page,
// `/duels` —, et les parcours de thème, sous le carnet dans « Apprendre ».
// Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-campagne.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'

ProfileStore.tirageEclat = () => false

const sortie = path.resolve(process.argv[2] ?? 'rendu-campagne')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const JOUR = 24 * 3_600_000
/** Le mardi 6 octobre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const horloge = { t: DEBUT }
/** Une question de sujet, de trois marches : `sujet` la nomme, `quoi` en fait une époque, un thème ou un fil rouge. */
const questionDeSujet = (sujet: string, i: number, categorie: Categorie, quoi: { sousTheme?: string; etiquettes?: string[]; date?: { valeur: string; precision: 'annee' } }) => {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `${sujet}${String(i).padStart(4, '0')}`,
    texte: `Une question ${sujet === 'an80' ? 'des années 80' : 'sur les animaux'}, numéro ${i} : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: quoi.sousTheme ?? SOUS_THEMES[categorie][0].cle,
    etiquettes: quoi.etiquettes ?? [],
    difficulte: [2, 3, 4][i % 3],
    ageMin: 10,
    date: quoi.date ?? null,
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
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}
/** Cent vingt questions des années 80, de quatre catégories et trois marches : de quoi un sentier à thème. */
const annees80 = Array.from({ length: 120 }, (_, i) =>
  questionDeSujet('an80', i, (['Histoire', 'Musique', 'Cinéma & séries', 'Sport'] as Categorie[])[i % 4], { date: { valeur: '1985', precision: 'annee' } }),
)
/** Et quatre-vingt-dix animaux — de la nature, et du cinéma par leur étiquette — : un thème (`shared/sujets.ts`) a sa rangée. */
const animaux = Array.from({ length: 90 }, (_, i) =>
  i % 5 === 4 ? questionDeSujet('anim', i, 'Cinéma & séries', { sousTheme: 'sagas', etiquettes: ['animaux'] }) : questionDeSujet('anim', i, 'Nature', { sousTheme: ['mammiferes', 'oiseaux', 'aquatique', 'petites-betes'][i % 4] }),
)
const base = new BaseDeLaCampagne([...baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }).questions, ...annees80, ...animaux])
const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base })
const navigateur = await chromium.launch({ headless: true })
const questionsDe = (serie: string): { bonne: number; reponses: string[] }[] => {
  const d = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return JSON.parse((d.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    d.close()
  }
}
/** Répond par l'API à toute une série : `justes[i]` dit si la i-ième est juste ; s'arrête à sa fin. */
const jouerParLAPI = async (cookie: string, serie: string, justes: boolean[]) => {
  const qs = questionsDe(serie)
  for (let i = 0; i < justes.length; i++) {
    const q = qs[i]
    const r = (await (await ecrire(banc.url, `/api/campagne/serie/${serie}/reponse`, { index: i, choix: justes[i] ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)).json()) as any
    if (r.finie) return
  }
}
const nouvelleSerie = async (cookie: string) => ((await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as any).id as string
const revision = async (cookie: string) => ((await (await ecrire(banc.url, '/api/campagne/revision', {}, cookie)).json()) as any).id as string

try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  // Léa, deux semaines plus tôt : des séries ratées, puis leurs rendez-vous
  // tenus — de quoi avoir appris, des questions à leur dernier rendez-vous
  // aujourd'hui, d'autres ratées hier, et une encore en route.
  const ilYA = (jours: number) => (horloge.t = DEBUT - jours * JOUR)
  const toutJuste = Array.from({ length: 10 }, () => true)
  ilYA(14)
  await jouerParLAPI(lea, await nouvelleSerie(lea), [true, false, false, false])
  await jouerParLAPI(lea, await nouvelleSerie(lea), [false, true, false, false])
  ilYA(13)
  await jouerParLAPI(lea, await revision(lea), toutJuste)
  ilYA(11)
  await jouerParLAPI(lea, await nouvelleSerie(lea), [false, false, false])
  ilYA(10)
  await jouerParLAPI(lea, await revision(lea), [false, ...toutJuste])
  ilYA(7)
  await jouerParLAPI(lea, await revision(lea), toutJuste)
  ilYA(3)
  await jouerParLAPI(lea, await revision(lea), toutJuste)
  ilYA(1)
  await jouerParLAPI(lea, await nouvelleSerie(lea), [true, true, false, false, false])
  horloge.t = DEBUT

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  page.on('console', (m: any) => m.type() === 'error' && console.error('[console]', m.text()))
  const entrer = async (cookie: string) => {
    await contexte.clearCookies()
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  }
  /** Ouvre une adresse de la page à neuf : un fragment seul, vers la même page, ne ferait que changer d'onglet sans la relire. */
  const ouvrir = async (chemin: string) => {
    await page.goto('about:blank')
    await page.goto(`${banc.url}${chemin}`)
  }
  const photo = async (n: string, pleine = false) => {
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }
  /** Touche une réponse de la question à l'écran, la bonne ou une autre. */
  const repondre = async (juste: boolean) => {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const bonne = textes.findIndex(t => t.startsWith('Bonne'))
    await page.locator('.ans-btn').nth(juste ? bonne : (bonne + 1) % textes.length).click()
    await page.waitForSelector('.result-banner')
  }

  // 1. Un carnet vide : Tom n'a encore rien raté.
  await entrer(tom)
  await ouvrir('/campagne#carnet')
  await page.waitForSelector('.carnet-prochaine')
  await photo('1-carnet-vide')

  // 2. Celui de Léa : l'onglet compte ce qui l'attend, ce qu'elle a appris se déplie.
  await entrer(lea)
  await ouvrir('/campagne')
  await page.waitForSelector('.onglet-pastille')
  await photo('2-onglet-du-carnet')
  await page.click('#mode-carnet')
  await page.waitForSelector('.carnet-heros .campagne-record-hud b:not(:empty)')
  await photo('3-carnet')
  await page.click('.carnet-appris summary')
  await page.waitForSelector('.carnet-faits li')
  await photo('4-ce-que-j-ai-appris', true)

  // 3. Une révision : retrouvée, ratée, apprise — et sa fin.
  await page.click('.carnet-appris summary')
  await page.click('text=Réviser')
  let apprisePhotographiee = false
  const apprise = async () => {
    if (apprisePhotographiee || !(await page.locator('.carnet-suite').count()) || !(await page.locator('.carnet-suite').textContent())?.includes('Apprise')) return
    apprisePhotographiee = true
    await photo('7-revision-apprise')
  }
  await repondre(true)
  await photo('5-revision-retrouvee')
  await apprise()
  await page.click('text=Question suivante')
  await repondre(false)
  await photo('6-revision-ratee')
  for (;;) {
    const suite = page.locator('.btn-primary.btn-big')
    if ((await suite.textContent())?.includes('Voir ma révision')) break
    await suite.click()
    await repondre(true)
    await apprise()
  }
  await page.click('text=Voir ma révision')
  await page.waitForSelector('.campagne-fin')
  await photo('8-fin-de-revision', true)

  // 3 bis. Rien à revoir aujourd'hui : tout le carnet se revoit, en avance —
  // retrouvée, une question garde son rendez-vous —, et une révision laissée
  // se reprend ou se recommence.
  for (;;) {
    const r = await ecrire(banc.url, '/api/campagne/revision', {}, lea)
    if (r.status !== 200) break
    await jouerParLAPI(lea, ((await r.json()) as any).id, toutJuste)
  }
  await ouvrir('/campagne#carnet')
  await page.waitForSelector('text=Tout revoir')
  await photo('8a-carnet-a-jour')
  await page.click('text=Tout revoir')
  await repondre(true)
  await photo('8b-revue-en-avance')
  await ouvrir('/campagne#carnet')
  await page.waitForSelector('text=Recommencer une révision')
  await photo('8c-reprendre-ou-recommencer')

  // 4. La fin d'une série rappelle le carnet.
  await ouvrir('/campagne')
  await page.locator('button', { hasText: /Commencer une série|Une nouvelle série/ }).click()
  await repondre(true)
  for (let i = 0; i < 3; i++) {
    await page.locator('.btn-primary.btn-big').click()
    await repondre(false)
  }
  await page.click('text=Voir ma série')
  await page.waitForSelector('.carnet-rappel')
  await photo('9-fin-de-serie', true)

  // 5. Un duel classé : Tom a fini une série — cinq bonnes réponses, sa
  // troisième faute à la huitième question —, Léa le trouve dans ses duels.
  await jouerParLAPI(tom, await nouvelleSerie(tom), [true, true, true, true, true, false, false, false])
  await ouvrir('/duels')
  await page.waitForSelector('.duels-ligues-liste')
  await photo('10-trouver-un-adversaire')
  await page.click('text=Un adversaire au hasard')
  await repondre(true)
  await photo('11-rencontre-reponse')
  // Une faute à la quatrième ; la bonne réponse qui dépasse les cinq de Tom la gagne, et la finit.
  for (let i = 1; ; i++) {
    const suite = page.locator('.btn-primary.btn-big')
    if ((await suite.textContent())?.includes('Voir qui a gagné')) break
    await suite.click()
    await repondre(i !== 3)
    if (i === 3) await photo('12-rencontre-ratee')
  }
  await page.click('text=Voir qui a gagné')
  await page.waitForSelector('.rencontre-final')
  await photo('13-rencontre-gagnee', true)
  await ouvrir('/duels')
  // « Tes duels joués » sont repliés : ils ne se rendent qu'au dépli (`TesDuelsJoues`).
  await page.click('.duels-joues summary')
  await page.waitForSelector('.rencontre-liste')
  await page.locator('.rencontre-liste').scrollIntoViewIfNeeded()
  await photo('14-mes-duels')

  // 6. Les parcours de thème, sous le carnet dans « Apprendre » : une famille
  // à la fois, la fiche d'un parcours, une étape sans vies, sa fin validée,
  // et le retour aux parcours, où il est en cours.
  await ouvrir('/campagne#carnet')
  await page.waitForSelector('.parcours-ligne')
  await page.locator('#parcours-titre').scrollIntoViewIfNeeded()
  await photo('15-parcours-de-theme')
  await page.click('#parcours-epoque')
  await page.locator('.parcours-ligne', { hasText: 'Les années 80' }).scrollIntoViewIfNeeded()
  await photo('16-parcours-des-epoques')
  await page.locator('.parcours-ligne', { hasText: 'Les années 80' }).click()
  await page.waitForSelector('.parcours-etapes')
  await photo('17-fiche-d-un-parcours')
  await page.locator('.parcours-etapes button', { hasText: 'Jouer' }).click()
  await repondre(true)
  await photo('18-etape-d-un-parcours')
  for (let i = 1; ; i++) {
    const suite = page.locator('.btn-primary.btn-big')
    if ((await suite.textContent())?.includes('Voir le résultat')) break
    await suite.click()
    await repondre(i !== 3)
  }
  await page.click('text=Voir le résultat')
  await page.waitForSelector('.epreuve-fin-tete')
  await photo('19-fin-d-une-etape', true)
  await page.click('text=Retour aux parcours')
  await page.waitForSelector('[aria-label="Tes parcours en cours"]')
  await photo('20-une-etape-validee')

  // 7. Les amis : Tom a relevé un défi de Léa, ils sont amis. Léa le défie
  // depuis ses duels — « Mes amis », sa ligne, « Défier Tom » sur sa carte —,
  // le joue, et il part à Tom à sa dernière réponse ; Tom le trouve en tête
  // de ses duels, l'accueil le lui dit, et sa liste d'amis est dans sa
  // feuille. `rendu-duels.ts` photographie la préparation en détail.
  const premier = (await (await ecrire(banc.url, '/api/campagne/duel', {}, lea)).json()) as any
  await jouerParLAPI(lea, premier.serie.id, [true, true, true, false, false, false])
  const releve = (await (await ecrire(banc.url, `/api/campagne/duel/${premier.code}`, {}, tom)).json()) as any
  await jouerParLAPI(tom, releve.id, [true, false, false, false])
  await ouvrir('/duels')
  await page.getByRole('button', { name: /Mes amis/ }).click()
  await page.locator('.ligne-joueur-ouvrable', { hasText: 'Tom' }).click()
  await page.getByRole('button', { name: 'Défier Tom' }).click()
  await page.waitForSelector('.defier-etape')
  await photo('21-preparer-un-defi')
  await page.getByRole('button', { name: 'Jouer le duel' }).click()
  await repondre(true)
  for (let i = 0; i < 3; i++) {
    await page.locator('.btn-primary.btn-big').click()
    await repondre(false)
  }
  await page.click('text=Voir mon duel')
  await page.waitForSelector('.duel-parti')
  await photo('22-parti-a-mes-amis', true)
  await entrer(tom)
  // Son accueil le lui dit, sur le bouton des duels.
  await ouvrir('/')
  await page.waitForSelector('text=Léa te défie')
  await photo('22a-accueil-defi-recu')
  await ouvrir('/duels')
  await page.waitForSelector('.duel-recus')
  await photo('23-defis-recus')
  await page.getByRole('button', { name: /Mes amis/ }).click()
  await page.waitForSelector('.amis-sections .ligne-joueur-ouvrable')
  await photo('24-tes-amis')
} finally {
  await navigateur.close()
  await banc.close()
}

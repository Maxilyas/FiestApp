// Les écrans de l'Expédition, photographiés au téléphone (360 × 640) sur un
// serveur jetable : la page d'un invité sans profil ; le départ, son équipée
// et sa feuille — les trente-deux jokers dépliés — ; la carte d'un acte — l'acte
// en petit, le départ qui brille, les escales proposées en cartes, la plus sûre
// à son ruban, choisie, puis une autre ; une escale plus loin touchée sur le
// plan, qui se dit sous les cartes, la légende au « ? » —, la main posée au bas de l'écran ; une
// escale et sa main, une carte levée, puis ce que fait
// chaque joker qui passe — les réponses effacées, Double chance, Deux
// visages, l'Oracle, l'Énigme, Sursis… — ; une élite et ce qu'elle offre, un
// coffre, le campement — une vie, ou un joker retiré — ; le gardien, vaincu,
// la carte de l'acte suivant ; le choix au bout, la fin et ses gains. Puis une
// seconde expédition, ses jokers de carte — Commandement et sa catégorie, Le
// raccourci —, perdue au bout ; une troisième, ses formes forcées dans son
// départ — un vrai ou faux, six choix, un dévoilement qui se dit, puis entier ;
// une quatrième, ses écus — une élite qui paie, la carte et son butin,
// l'échoppe et la loupe achetée, l'inconnu de passage puis piégé, un coffre qui
// cache un talisman, la fin qui laisse les écus dans l'expédition ; une
// cinquième, partie un jour d'Halloween par une nouvelle venue (le 18 octobre
// 2026) — la saison et la Citrouille au bout de l'acte 3, le passeport vierge,
// la carte et ses escales à tamponner, un tampon neuf, la fin qui le compte,
// le passeport tamponné.
// Le client construit d'abord (`npm run build -w client`).
//
// Léa a six légendaires à joker, rangés comme gardés au bout d'expéditions
// passées ; l'invité du jour est le Dragon d'Or (`horlogeDuJour`) : ses
// coffres offrent deux jokers.
//
//   npx tsx scripts/rendu-expedition.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { calendrierDesExpeditions } from '../src/core/saisons'
import { CATEGORIES } from '../../shared/categories'
import { jourDe } from '../../shared/jour'
import { periodeDu } from '../../shared/saisons'
import { contenuDeLInconnu, inviteDuJour, talismanDeLOffre } from '../../shared/expedition'
import { cleDeLExpedition } from '../../shared/legendaires'

const sortie = path.resolve(process.argv[2] ?? 'rendu-expedition')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/** Un jour où l'invité est ce légendaire. */
function unJourOu(legendaire: string): number {
  for (let k = 0; k < 2000; k++) {
    const t = Date.UTC(2026, 9, 1, 10) + k * 86_400_000
    if (inviteDuJour(jourDe(t)) === legendaire) return t
  }
  throw new Error(`${legendaire} n’est jamais l’invité du jour`)
}
const JOUR = unJourOu('lg:dragon')

/** Un jour d'Halloween, après celui du Dragon d'Or, où la Citrouille n'est pas l'invitée : elle garde l'acte 3. */
function unJourDHalloween(): number {
  for (let t = JOUR; t < JOUR + 800 * 86_400_000; t += 86_400_000) {
    if (periodeDu(jourDe(t))?.saison.key === 'halloween' && inviteDuJour(jourDe(t)) !== 'lg:citrouille') return t
  }
  throw new Error('pas un jour d’Halloween en deux ans')
}

/** Les siens : de quoi montrer l'équipée et des jokers de question et de carte. */
const SIENS = ['lg:oracle', 'lg:janus', 'lg:chouette', 'lg:lion', 'lg:comete', 'lg:phenix']

/** Soixante-trois questions d'Halloween, vingt et une par marche : un thème pointu (`QUESTIONS_POUR_UN_SENTIER_DE_SUJET`), la fête de la cinquième. */
const HALLOWEEN = [2, 3, 4].flatMap((difficulte, m) =>
  Array.from({ length: 21 }, (_, i) => {
    const n = 5000 + m * 100 + i
    const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${n}`)
    const lu = lireQuestionDeLaBase({
      id: `fete${n}`,
      texte: `Question d'Halloween numéro ${n} : laquelle est la bonne ?`,
      reponses: [`Bonne ${n}`, ...autres.slice(0, 3)],
      bonne: 0,
      anecdote: `L'anecdote de la question ${n}.`,
      categorie: 'Autour de la fête',
      sousTheme: 'halloween',
      etiquettes: [],
      difficulte,
      ageMin: 10,
      date: null,
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
    if ('refus' in lu) throw new Error(`Halloween : ${lu.refus}`)
    return lu.question
  }),
)

// Quatre-vingts questions par catégorie, de chaque difficulté : de quoi tirer trois actes et leurs gardiens.
// L'horloge part du jour du Dragon d'Or et avance : un dévoilement se dit à l'heure du serveur. La cinquième
// la fait sauter à Halloween.
const debut = Date.now()
let jourDuRendu = JOUR
const banc = await demarrer({
  baseDeLaCampagne: new BaseDeLaCampagne([...baseDEssai(960, { categories: [...CATEGORIES] }).questions, ...HALLOWEEN]),
  horlogeDuJour: () => jourDuRendu + (Date.now() - debut),
})
const navigateur = await chromium.launch({ headless: true })
try {
  const contexteDe = async (cookie: string | null) => {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    if (cookie) {
      const [nom, valeur] = cookie.split('=')
      await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    }
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return { contexte, page }
  }
  const photographe = (page: any) => async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  // Sans profil : la page le dit, et propose de se connecter.
  {
    const { contexte, page } = await contexteDe(null)
    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.expedition .btn-primary')
    await photographe(page)('0-sans-profil')
    await contexte.close()
  }

  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const ranger = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:rendu', '', '🧭', 'rendu', 1)`)
    for (const cle of SIENS) ranger.run(id, cleDeLExpedition(cle))
  } finally {
    db.close()
  }
  // Relus au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  const { page } = await contexteDe(cookie)
  const photo = photographe(page)
  const fait = new Set<string>()
  /** Une photo, la première fois seulement. */
  const unePhoto = async (nom: string, pleine = false) => {
    if (fait.has(nom)) return
    fait.add(nom)
    await photo(nom, pleine)
  }

  // L'accueil d'un profil : « L’Expédition » sous les duels, dans « Seul ».
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('a.gros-bouton[href="/expedition"]')
  await page.locator('a.gros-bouton[href="/expedition"]').scrollIntoViewIfNeeded()
  await photo('0b-accueil')

  // Le départ : les trois gardiens, l'équipée proposée — l'invité du jour d'abord. Hors de la production, le prototype
  // des rencontres s'y propose, d'office : ce rendu-ci est celui des jokers, il le coupe (`rendu-rencontres.ts` le prend).
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-gardiens')
  const sansLesRencontres = async () => {
    const interrupteur = page.locator('.exp-interrupteur[aria-checked="true"]')
    if (await interrupteur.count()) await interrupteur.click()
  }
  await sansLesRencontres()
  await photo('1-depart')
  await photo('1-depart-entier', true)

  /** L'équipée : la feuille, puis ces deux-là, choisis. */
  const choisirLEquipee = async (noms: string[], photos?: { feuille: string; tous: string }) => {
    await page.click('.exp-equipee .exp-changer')
    await page.waitForSelector('.feuille-equipee')
    if (photos) await photo(photos.feuille)
    // Laisse d'abord ceux qui partaient, puis touche les deux voulus.
    const partants = page.locator('.exp-equipable[aria-pressed="true"]')
    while (await partants.count()) await partants.first().click()
    for (const nom of noms) await page.locator('.exp-equipable', { hasText: nom }).first().click()
    if (photos) {
      await page.click('.exp-tous')
      await page.locator('#exp-tous-les-jokers').scrollIntoViewIfNeeded()
      await photo(photos.tous)
    }
    await page.locator('.feuille-equipee .carte-pied .btn-primary').click()
    await page.waitForTimeout(200)
  }
  await choisirLEquipee(['Oracle', 'Janus'], { feuille: '1b-equipee', tous: '1c-tous-les-jokers' })
  await photo('1d-depart-equipee')

  /**
   * « Abandonner l'expédition » vit au départ, derrière « ← Partir » — la feuille du plan, qui le portait aussi, n'est plus
   * (le 19 octobre 2026) : le geste confirmé, la fin.
   */
  const abandonnerDuDepart = async () => {
    await page.click('a.jour-sortie')
    await page.waitForSelector('.exp-depart-pied')
    await page.locator('.exp-abandonner').click()
    await page.locator('.dialog-backdrop .btn-danger').click()
    await page.waitForSelector('.exp-fin-tete')
  }

  /** Sur la carte : une escale proposée — la première carte, s'il n'en a touché aucune —, puis « Y aller ». */
  const allerAUneProposee = async () => {
    await page.waitForSelector('.exp-plan')
    if (!(await page.locator('.exp-carte-escale[aria-pressed="true"]').count())) await page.locator('.exp-carte-escale').first().click()
    await page.locator('.exp-panneau > .btn-primary').click()
  }

  // La carte de l'acte 1 : l'acte en petit, le départ qui brille ; les escales du bas en cartes ; la main encore vide.
  await sansLesRencontres()
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  await photo('2-carte')
  await photo('2-carte-entiere', true)

  // La plus sûre, son ruban sur sa carte : touchée, elle se lève, et son escale se dore sur le plan. Puis une autre.
  await page.locator('.exp-carte-escale:has(.exp-la-plus-sure)').click()
  await photo('3-la-plus-sure')
  await page.locator('.exp-carte-escale').last().click()
  await photo('3-escale-choisie')
  // Le plan fondu dans l'écran (le 19 octobre 2026) : une escale plus loin, touchée sur le plan, se dit sous les cartes —
  // le plan ne s'ouvre plus en grand dans une feuille ; sa légende est au « ? ».
  const plusLoin = page.locator('.exp-plan .exp-point.exp-plus-loin').first()
  if (await plusLoin.count()) {
    await plusLoin.click()
    await photo('3b-plus-loin')
  }
  await page.locator('.exp-barre .exp-regles').click()
  await page.waitForSelector('.feuille-regles')
  await page.locator('#exp-regles-plan').scrollIntoViewIfNeeded()
  await photo('3d-la-legende')
  await page.locator('.feuille-regles .carte-fermer').click()

  const ici = async (): Promise<string> => {
    if (await page.locator('.exp-plan').count()) return 'carte'
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

  /** Répond à la question à l'écran : juste, ou une autre qui n'est pas effacée. Double chance : deux. */
  const repondre = async (juste: boolean) => {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const effacees: boolean[] = await page.$$eval('.ans-btn', (els: any[]) => els.map(e => e.classList.contains('exp-effacee')))
    // Un vrai ou faux tiré d'une question à quatre choix : « Vrai » si la réponse proposée est la bonne.
    const proposee = (await page.locator('.exp-proposee b').count()) > 0 ? String(await page.locator('.exp-proposee b').textContent()) : null
    const bonne = proposee === null ? textes.findIndex(t => t.startsWith('Bonne')) : textes.indexOf(proposee.includes('Bonne') ? 'Vrai' : 'Faux')
    const fausse = textes.findIndex((t, i) => i !== bonne && !effacees[i])
    const deux = (await page.locator('.exp-consigne', { hasText: 'Double chance' }).count()) > 0
    if (deux) {
      await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
      await page.locator('.ans-btn').nth(textes.findIndex((t, i) => i !== bonne && i !== fausse && !effacees[i])).click()
      await unePhoto('j-double-chance')
      await page.locator('.quiz-player > .btn-primary').click()
    } else await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
    await page.waitForSelector('.result-banner')
  }
  const suite = async () => {
    await page.locator('.result-banner ~ .btn-primary.btn-big').click()
    await page.waitForTimeout(250)
  }

  /** Les jokers à montrer, un à la fois : ceux de question, joués dès qu'ils se jouent ; les posés aussi. */
  const A_MONTRER = ['coup-d-oeil', 'echange', 'sagesse', 'prediction', 'deux-visages', 'double-chance', 'sursis', 'tout-ou-rien', 'pioche', 'renaissance', 'tresor', 'enigme']
  /** Lequel jouer : le premier à montrer pas encore photographié. */
  const aMontrer = (c: { cle: string }) => A_MONTRER.includes(c.cle) && !fait.has(`j-${c.cle}`)
  /** Pour faire tourner le paquet : Coup d'œil, Échange — la main pleine ne tire plus. */
  const pourTourner = (c: { cle: string }) => c.cle === 'coup-d-oeil' || c.cle === 'echange'
  /** Joue un joker de la main que `choisir` retient ; vrai s'il en a joué un. */
  const jouerUnJoker = async (choisir: (c: { cle: string }) => boolean): Promise<boolean> => {
    if (await page.locator('.exp-perte, .exp-indice, .exp-visages, .exp-consigne').count()) return false
    const cartes: { cle: string; refuse: boolean }[] = await page.$$eval('.exp-main .exp-carte-joker', (els: any[]) =>
      els.map(e => ({ cle: String(e.dataset.joker), refuse: e.classList.contains('exp-refuse') })),
    )
    const i = cartes.findIndex(c => !c.refuse && choisir(c))
    if (i < 0) return false
    const cle = cartes[i].cle
    // La carte se lève : en grand, ce qu'elle fait, puis « Jouer ».
    await page.locator('.exp-main .exp-carte-joker').nth(i).click()
    await page.waitForSelector('.exp-leve')
    await page.waitForTimeout(300)
    await unePhoto('4b-main')
    await unePhoto(`4c-leve-${cle}`)
    await page.locator('.exp-leve .btn-primary').click()
    await page.waitForTimeout(300)
    if (cle === 'prediction') {
      // L'Oracle : la réponse à montrer se touche sur la question.
      await photo('j-prediction-montrer')
      const effacees: boolean[] = await page.$$eval('.ans-btn', (els: any[]) => els.map(e => e.classList.contains('exp-effacee')))
      await page.locator('.ans-btn').nth(effacees.findIndex(e => !e)).click()
      await page.waitForSelector('.exp-indice')
    }
    await unePhoto(`j-${cle}`)
    if (cle === 'deux-visages') {
      await page.locator('.exp-visages .pill-btn').nth(1).click()
      await photo('j-deux-visages-seconde')
    }
    return true
  }

  /**
   * Joue jusqu'au gardien vaincu, au choix ou à la fin : `fautes` dit,
   * question après question, s'il se trompe. Il passe par les élites et les
   * coffres qu'il croise, et photographie chaque écran une fois.
   */
  const jouerLActe = async (fautes: (n: number) => boolean, { jokers = aMontrer, carte }: { jokers?: (c: { cle: string }) => boolean; carte?: () => Promise<void> } = {}) => {
    let n = 0
    for (let tour = 0; tour < 120; tour++) {
      const ou = await ici()
      if (ou === 'vaincu' || ou === 'fin' || ou === 'choix') return ou
      if (ou === 'carte') {
        if (await page.locator('.exp-panneau .exp-carte-joker').count()) await unePhoto('2b-carte-main')
        if (carte) await carte()
        if (await page.locator('.exp-panneau-titre').count()) {
          await unePhoto('6-avant-le-gardien')
        } else {
          // Une élite ou un coffre qu'il n'a pas encore vus, s'il peut y aller : touchés, c'est là qu'il va.
          for (const sorte of ['coffre', 'elite']) {
            const la = page.locator(`.exp-carte-escale.exp-${sorte}`).first()
            if (!fait.has(`offre-${sorte}`) && (await la.count())) {
              await la.click()
              break
            }
          }
        }
        await allerAUneProposee()
        await page.waitForTimeout(250)
        continue
      }
      if (ou === 'offre') {
        const sorte = (await page.locator('.exp-surtitre', { hasText: 'coffre' }).count()) ? 'coffre' : 'elite'
        await unePhoto(`offre-${sorte}`)
        if (await page.locator('.exp-offre-ligne').count()) {
          await page.locator('.exp-offre-ligne').first().click()
          await unePhoto(`offre-${sorte}-choisi`)
        }
        await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
        await page.waitForTimeout(250)
        continue
      }
      if (ou === 'campement') {
        await unePhoto('7-campement')
        if (!fait.has('7-campement-retirer') && (await page.locator('.exp-choix-ligne').nth(1).getAttribute('aria-disabled')) === null) {
          await page.locator('.exp-choix-ligne').nth(1).click()
          await page.locator('.exp-a-retirer .pill-btn').first().click()
          await unePhoto('7-campement-retirer')
        } else await page.locator('.exp-choix-ligne').first().click()
        await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
        await page.waitForTimeout(250)
        continue
      }
      if (ou === 'question') {
        const auGardien = (await page.locator('.exp-gardien-tete').count()) > 0
        await unePhoto(auGardien ? '8-gardien' : '4-escale')
        if (await page.locator('.exp-regle', { hasText: 'élite' }).count()) await unePhoto('4-elite')
        if (await jouerUnJoker(jokers)) continue
        await repondre(!fautes(n++))
        const ratee = (await page.locator('.result-ko').count()) > 0
        await unePhoto(auGardien ? '8-gardien-revele' : ratee ? '5-ratee' : '5-revelation')
        if ((await page.locator('.result-banner ~ .btn-primary.btn-big').textContent())?.includes('Voir la fin')) await unePhoto('14-derniere-vie')
        await suite()
        continue
      }
      if (ou === 'revelation') {
        await suite()
        continue
      }
      // L'échoppe et l'inconnu (l'étape 4), que la carte tire d'elle-même : photographiés une fois, puis la route.
      if (ou === 'echoppe') {
        await unePhoto('e-echoppe-en-route')
        await page.locator('.exp-echoppe-page .exp-depart-pied .btn-ghost').click()
        await page.waitForTimeout(250)
        continue
      }
      if (ou === 'inconnu') {
        await unePhoto('e-inconnu-en-route')
        await page.locator('.exp-inconnu .btn-primary').click()
        await page.waitForTimeout(250)
        continue
      }
      await page.waitForTimeout(300)
    }
    throw new Error('l’acte ne finit pas')
  }

  // L'acte 1 : une faute à la deuxième question, une au gardien.
  const acte1 = await jouerLActe(n => n === 1 || n === 7)
  if (acte1 !== 'vaincu') throw new Error(`l’acte 1 finit en ${acte1}`)
  await photo('9-vaincu')
  await page.locator('.exp-vaincu .btn-primary').click()
  await page.waitForSelector('.exp-plan')
  await photo('10-acte-2')
  // Les actes 2 et 3 sans faute : le choix au bout.
  for (const acte of [2, 3]) {
    const fin = await jouerLActe(() => false)
    if (fin !== 'vaincu') throw new Error(`l’acte ${acte} finit en ${fin}`)
    await page.locator('.exp-vaincu .btn-primary').click()
  }
  await page.waitForSelector('.exp-choix')
  await photo('11-choix')
  await page.locator('.exp-choix-ligne').nth(1).click()
  await page.locator('.exp-choix > .btn-primary').click()
  await page.waitForSelector('.exp-fin-tete')
  await photo('12-fin')
  await photo('12-fin-entiere', true)

  // Une autre, avec le Lion et la Comète : leurs jokers se jouent sur la carte. Puis perdue, toutes ratées.
  await page.locator('.fin-actions .btn-primary').click()
  await page.waitForSelector('.exp-gardiens')
  await photo('13-depart-suivant')
  await choisirLEquipee(['Lion', 'Comète'])
  await sansLesRencontres()
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  /** Sur la carte, un joker de carte en main : sa carte levée, puis joué. */
  const jouerSurLaCarte = async () => {
    for (const cle of ['commandement', 'raccourci']) {
      const carte = page.locator(`.exp-panneau .exp-main .exp-carte-joker[data-joker="${cle}"]:not(.exp-refuse)`)
      if (fait.has(`c-${cle}`) || !(await carte.count())) continue
      await carte.first().click()
      await page.waitForSelector('.exp-leve')
      await page.waitForTimeout(300)
      if (cle === 'commandement') {
        await page.locator('.exp-leve .exp-categories .pill-btn').nth(1).click()
        await unePhoto('c-commandement-feuille')
      } else await unePhoto(`c-${cle}-feuille`)
      await page.locator('.exp-leve .btn-primary').click()
      await page.waitForTimeout(400)
      await unePhoto(`c-${cle}`)
    }
  }
  // Il fait tourner son paquet — Coup d'œil, Échange — tant que ses jokers de carte ne sont pas venus, puis se trompe ; un gardien vaincu en route, il se trompe à chaque question.
  let perdue = await jouerLActe(n => n >= 8, { jokers: pourTourner, carte: jouerSurLaCarte })
  while (perdue === 'vaincu') {
    await page.locator('.exp-vaincu .btn-primary').click()
    perdue = await jouerLActe(() => true, { jokers: () => false })
  }
  if (perdue !== 'fin') throw new Error(`l’expédition ratée finit en ${perdue}`)
  await photo('15-perdue', true)

  // Les formes (l'étape 3), forcées dans le départ gardé : le premier étage en vrai ou faux, le
  // deuxième à six choix, le troisième en dévoilement — puis le serveur redémarré les relit.
  await page.locator('.fin-actions .btn-primary').click()
  await page.waitForSelector('.exp-gardiens')
  await sansLesRencontres()
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  const enRoute = ((await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: cookie } })).json()) as any).expedition
  const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const depart = JSON.parse((base.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(enRoute.id) as { expedition: string }).expedition)
    const formes = ['vrai-faux', 'six', 'devoilement']
    for (const e of depart.cartes[0].escales) {
      if (e.etage > 2) continue
      if (e.sorte !== 'question') {
        e.sorte = 'question'
        e.theme = { categories: ['Histoire'] }
        delete e.chance
      }
      e.forme = formes[e.etage]
    }
    base.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(depart), enRoute.id)
  } finally {
    base.close()
  }
  await banc.redemarrer()
  await page.goto(`${banc.url}/expedition`)
  /** Un pas, depuis la carte : chaque étage n'a plus qu'une forme. */
  const unPasDePlus = async () => {
    await allerAUneProposee()
    await page.waitForSelector('.ans-btn')
  }
  await unPasDePlus()
  await photo('f1-vrai-faux')
  await page.locator('.ans-btn').first().click()
  await page.waitForSelector('.result-banner')
  await photo('f1b-vrai-faux-revele')
  await suite()
  await unPasDePlus()
  await photo('f2-six-choix')
  await photo('f2-six-choix-entier', true)
  // Six réponses tiennent dans leur grille : à la hauteur de la fenêtre, elle débordait, et la sixième passait sous le bouton de Double chance.
  const deborde: number = await page.$eval('.ans-grid', (g: any) => g.scrollHeight - g.clientHeight)
  console.log(deborde > 1 ? `⚠ six choix : la grille déborde de ${deborde} px` : 'six choix : la grille tient ses six réponses')
  await page.locator('.ans-btn').nth(4).click()
  await page.waitForSelector('.result-banner')
  await photo('f2b-six-choix-revele')
  await suite()
  await unPasDePlus()
  await page.waitForTimeout(1200)
  await photo('f3-devoilement')
  await page.waitForFunction(() => !(globalThis as any).document.querySelector('.exp-curseur'), undefined, { timeout: 20_000 })
  await photo('f3b-devoilement-entier')
  await page.locator('.ans-btn').first().click()
  await page.waitForSelector('.result-banner')
  await photo('f3c-devoilement-revele')

  // Les écus (l'étape 4) : une quatrième expédition, son départ forcé — une élite noire au premier étage, une échoppe
  // au deuxième, l'inconnu au troisième, un coffre au quatrième, l'inconnu encore au cinquième —, sur une graine où
  // l'échoppe vend la loupe, où le premier inconnu est un légendaire de passage et le second un piège, et où le coffre
  // cache un talisman.
  const laisser = ((await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: cookie } })).json()) as any).expedition
  if (laisser) await ecrire(banc.url, `/api/expedition/${laisser.id}/abandon`, {}, cookie)
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-gardiens')
  await sansLesRencontres()
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  const quatrieme = ((await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: cookie } })).json()) as any).expedition
  const baseDesEcus = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const depart = JSON.parse((baseDesEcus.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(quatrieme.id) as { expedition: string }).expedition)
    const etage = (n: number) => depart.cartes[0].escales.filter((e: any) => e.etage === n)
    const en = (e: any, sorte: string) => {
      e.sorte = sorte
      delete e.theme
      delete e.forme
      delete e.chance
    }
    for (const e of etage(0)) Object.assign(e, { sorte: 'elite', theme: { categories: ['Histoire'] }, forme: 'quatre', chance: 0.1 })
    for (const e of etage(1)) en(e, 'echoppe')
    for (const e of etage(2)) en(e, 'inconnu')
    for (const e of etage(3)) en(e, 'coffre')
    for (const e of etage(4)) en(e, 'inconnu')
    const tient = (g: string) =>
      talismanDeLOffre(g, 0, [], false) === null &&
      talismanDeLOffre(g, 1, [], true) === 'loupe' &&
      etage(2).every((e: any) => contenuDeLInconnu(g, 0, e.id) === 'passage') &&
      talismanDeLOffre(g, 2, ['loupe'], false) !== null &&
      etage(4).every((e: any) => contenuDeLInconnu(g, 0, e.id) === 'piege')
    let k = 0
    while (!tient(`rendu-ecus:${k}`)) k++
    depart.graine = `rendu-ecus:${k}`
    baseDesEcus.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(depart), quatrieme.id)
  } finally {
    baseDesEcus.close()
  }
  await banc.redemarrer()
  await page.goto(`${banc.url}/expedition`)
  /** Un pas, depuis la carte, et ce qu'il ouvre. */
  const pasVers = async (attendu: string) => {
    await allerAUneProposee()
    await page.waitForSelector(attendu)
  }
  await pasVers('.ans-btn')
  await repondre(true)
  await photo('e1-elite-ecus-revele')
  // L'élite tombée offre un joker : il n'en prend aucun.
  await page.locator('.result-banner ~ .btn-primary.btn-big').click()
  await page.waitForSelector('.exp-offre')
  await page.locator('.exp-depart-pied .btn-ghost').click()
  await page.waitForSelector('.exp-plan')
  await page.locator('.exp-carte-escale').first().click()
  await photo('e2-carte-ecus')
  await pasVers('.exp-echoppe-page')
  await photo('e3-echoppe')
  await photo('e3-echoppe-entiere', true)
  await page.locator('.exp-offre-ligne', { hasText: 'La loupe' }).click()
  await photo('e3b-echoppe-loupe')
  await page.locator('.exp-depart-pied .btn-primary').click()
  await page.waitForSelector('.exp-offre-ligne.exp-achete')
  await photo('e3c-echoppe-achetee')
  await page.locator('.exp-depart-pied .btn-ghost').click()
  await page.waitForSelector('.exp-plan')
  await photo('e4-carte-talisman')
  await pasVers('.exp-inconnu')
  await photo('e5-inconnu-passage')
  await page.locator('.exp-inconnu .btn-primary').click()
  await page.waitForSelector('.exp-plan')
  await photo('e6-carte-inconnu-passe', true)
  await pasVers('.exp-offre')
  await photo('e7-coffre-talisman')
  await photo('e7-coffre-talisman-entier', true)
  await page.locator('.exp-depart-pied .btn-ghost').click()
  await page.waitForSelector('.exp-plan')
  await pasVers('.exp-inconnu')
  await photo('e8-inconnu-piege')
  await page.locator('.exp-inconnu .btn-primary').click()
  await page.waitForSelector('.exp-plan')
  // Abandonnée : la fin dit que ses écus restent dans l'expédition.
  await abandonnerDuDepart()
  await photo('e9-fin-ecus', true)

  // Le passeport et la saison des fêtes (le 18 octobre 2026) : l'horloge saute à Halloween, le calendrier des
  // expéditions se rouvre — le banc le ferme. Une nouvelle venue, au passeport vierge — celui de Léa a déjà
  // ses tampons, Halloween peut-être. La page dit la saison, la Citrouille garde l'acte 3 ; sa première
  // expédition, son premier étage forcé en escales d'Halloween : trouvée, son tampon ; abandonnée, la fin le
  // compte ; le passeport, rouvert, le montre.
  jourDuRendu = unJourDHalloween()
  calendrierDesExpeditions.periodeDu = periodeDu
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🦉')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, zoe, 'PUT')
  const [nomDeZoe, valeurDeZoe] = zoe.split('=')
  await page.context().clearCookies()
  await page.context().addCookies([{ name: nomDeZoe, value: valeurDeZoe, url: banc.url }])
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-saison')
  await photo('s1-depart-saison')
  // Le troisième gardien est déjà « en vue », sous le bouton qui colle au bas : la molette le remonte.
  await page.mouse.wheel(0, 420)
  await photo('s1b-gardien-de-saison')
  await photo('s1c-depart-saison-entier', true)
  await page.locator('.exp-passeport .link-inline').click()
  await page.waitForSelector('.feuille-passeport')
  await photo('s2-passeport-vierge')
  await page.locator('.feuille-passeport .carte-fermer').click()
  await sansLesRencontres()
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  await photo('s3-carte-saison')
  await photo('s3-carte-saison-entiere', true)
  const cinquieme = ((await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: zoe } })).json()) as any).expedition
  const baseDeLaSaison = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const depart = JSON.parse((baseDeLaSaison.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(cinquieme.id) as { expedition: string }).expedition)
    for (const e of depart.cartes[0].escales.filter((e: any) => e.etage === 0)) Object.assign(e, { sorte: 'question', theme: { sujet: 'halloween' }, forme: 'quatre', chance: 0.5 })
    baseDeLaSaison.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(depart), cinquieme.id)
  } finally {
    baseDeLaSaison.close()
  }
  await banc.redemarrer()
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-plan')
  await photo('s4-carte-a-tamponner')
  await pasVers('.ans-btn')
  await repondre(true)
  await photo('s5-tampon-revele')
  await suite()
  await page.waitForSelector('.exp-plan')
  await photo('s6-carte-tamponnee')
  await abandonnerDuDepart()
  await photo('s7-fin-tampon', true)
  await page.locator('.fin-actions .btn-primary').click()
  await page.waitForSelector('.exp-passeport')
  await page.locator('.exp-passeport .link-inline').click()
  await page.waitForSelector('.feuille-passeport')
  await page.locator('#passeport-fete').scrollIntoViewIfNeeded()
  await photo('s8-passeport-tamponne')
} finally {
  await navigateur.close()
  await banc.close()
}

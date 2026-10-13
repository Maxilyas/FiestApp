// Le QG de l'administrateur (`/admin`), photographié sur un serveur jetable :
// trente jours d'activité inventée — parties du quiz du jour, séries de la
// campagne, duels — et quatre-vingt-dix de soirées archivées, une vraie
// soirée en cours avec deux invités, une autre laissée en plan, deux
// signalements d'une question du jour ; au téléphone
// (360 × 640, la page entière), en 1366 × 768 et en 1920 × 1080, sous le
// Velours et sous l'Ivoire, puis une page ouverte de la barre de côté, le
// journal des gestes — quatre d'aujourd'hui par les vraies routes, deux
// d'hier —, la page des soirées, et la soirée laissée en plan close d'un
// clic ; la page « Le serveur » sur une semaine inventée — réveils, une mise
// en ligne, un arrêt net hier soir — ; enfin la fiche d'une joueuse — une épreuve en route, des confettis
// offerts, sa connexion fermée —, le don qu'on prépare, le code de secours
// tiré pour elle, et son accueil qui annonce le don, une fois. Le client
// construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-qg.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, creerQuiz, demarrer, ecranCommun, ecrire, inscrireProfil, invite, lancerQuiz, qcm } from '../test/banc'
import { jourDe, minutesDeParis } from '../../shared/jour'
import { minuitsDeParis } from '../../shared/qg'

const sortie = path.resolve(process.argv[2] ?? 'rendu-qg')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const H = 3_600_000
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(40) })
const navigateur = await chromium.launch({ headless: true })
try {
  const admin = await connexionAnimateur(banc.url)

  // Une soirée en cours chez l'administrateur : deux invités, un quiz lancé.
  const quiz = await creerQuiz(banc.url, admin, [qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra', 'Melbourne'], 1)], 'Le quiz du banc')
  const host = await ecranCommun(banc.url, admin)
  await invite(banc.url, 'Zoé', '🦊')
  await invite(banc.url, 'Gaspard', '🐙')
  await lancerQuiz(host, quiz)

  // Une soirée laissée en plan dans le salon de Tom : trois invités arrivés il y a huit heures, partis depuis.
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🦉')
  await ecrire(banc.url, '/api/joueur/espace', {}, tom)
  const espaces = (await (await fetch(`${banc.url}/api/admin/espaces`, { headers: { Cookie: admin } })).json()) as { id: string; slug: string; toi: boolean; titulaire: { nom: string } | null }[]
  const salonDeTom = espaces.find(e => e.titulaire?.nom === 'Tom')!
  for (const [nom, avatar] of [['Inès', '🐼'], ['Malo', '🐯'], ['Jade', '🐨']]) (await invite(banc.url, nom, avatar, { slug: salonDeTom.slug })).socket.disconnect()
  {
    const locale = new Database(banc.dbPath)
    locale.prepare('UPDATE players SET created_at = created_at - ? WHERE space_id = ?').run(8 * H, salonDeTom.id)
    locale.close()
  }
  // Léa commence le quiz du jour : son tirage existe, ses questions se signalent.
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  await ecrire(banc.url, '/api/jour/commencer', {}, lea)

  // Quelques gestes d'aujourd'hui, par les vraies routes : le journal les note
  // de lui-même. Avant les milliers d'écritures qui suivent : une connexion
  // restée ouverte pendant ce temps, le serveur la fermait sous `fetch`.
  const leaId = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: lea } })).json()) as { profile: { id: string } }).profile.id
  await ecrire(banc.url, '/api/admin/jour/garder', { jour: jourDe(Date.now()), index: 2 }, admin)
  await ecrire(banc.url, '/api/admin/jour/liste', { texte: 'Quel fleuve traverse Lyon et Avignon ?\n*Le Rhône\nLa Loire\nLa Garonne' }, admin)
  await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: leaId, masque: true }, admin)
  await ecrire(banc.url, '/api/admin/campagne/retirer', { questionId: 'essai005' }, admin)
  // De quoi remplir sa fiche : une épreuve de sentier laissée en route, des
  // confettis offerts avec un mot — son accueil l'annoncera —, et sa
  // connexion fermée par cinq mauvais mots de passe.
  await ecrire(banc.url, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 }, lea)
  await ecrire(banc.url, `/api/admin/profils/${leaId}/confettis`, { confettis: 120, mot: 'Merci d’avoir tenu le buzzer samedi !' }, admin)
  for (let i = 0; i < 5; i++) await ecrire(banc.url, '/api/joueur/connexion', { login: 'lea', password: 'pas-le-bon-1' }, '')

  // Trente jours d'activité, écrits dans la base permanente : chaque jour son
  // lot, plus fourni le week-end, aujourd'hui jusqu'à l'heure qu'il est.
  const maintenant = Date.now()
  const minuits = minuitsDeParis(maintenant, 30)
  const permanente = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  {
    const partie = permanente.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question) VALUES (?, ?, ?, 10)')
    const serie = permanente.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, commencee_le, mode) VALUES (?, ?, '[]', 0, 3, ?, ?)")
    const soiree = permanente.prepare("INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, 'Une soirée', ?, ?, ?, '{}')")
    const signalement = permanente.prepare('INSERT INTO jour_signalements (jour, question, profile_id, texte, cree_le, traite_le) VALUES (?, ?, ?, ?, ?, NULL)')
    let n = 0
    minuits.forEach((minuit, d) => {
      const weekEnd = [0, 5, 6].includes(new Date(minuit + 12 * H).getUTCDay())
      const vague = 1 + 0.25 * Math.sin(d / 3) + (weekEnd ? 0.2 : 0)
      const a = (k: number, total: number) => minuit + 7 * H + Math.floor((k / total) * 16 * H)
      const jours = Math.round(90 * vague)
      for (let k = 0; k < jours; k++) if (a(k, jours) <= maintenant) partie.run(`p-${k}`, jourDe(minuit + 12 * H), a(k, jours))
      const series = Math.round(120 * vague)
      for (let k = 0; k < series; k++) {
        const quand = a(k, series)
        const mode = k % 4 === 0 ? 'duel' : k % 9 === 0 ? 'rencontre' : k % 5 === 0 ? 'sentier' : 'serie'
        if (quand <= maintenant) serie.run(`s-${n++}`, `p-${(k * 7) % 80}`, quand, mode)
      }
    })
    // Quatre-vingt-dix jours de soirées, chez l'administrateur et chez Tom :
    // le vendredi et le samedi presque toujours, le dimanche et le mercredi
    // parfois — des salles de trois à vingt-quatre invités.
    const salons = [espaces.find(e => e.toi)!.id, salonDeTom.id]
    minuitsDeParis(maintenant, 90).forEach((minuit, d, tous) => {
      if (d === tous.length - 1) return
      const jour = new Date(minuit + 12 * H).getUTCDay()
      const ce = jour === 5 || jour === 6 ? d % 7 !== 3 : jour === 0 ? d % 3 === 0 : jour === 3 ? d % 4 === 0 : false
      if (!ce) return
      const joueurs = 3 + ((d * 7) % 22)
      const quiz = 1 + (d % 4)
      const fiche = { v: 3, invites: Array.from({ length: joueurs + 1 }, (_, i) => ({ id: `i-${i}`, joue: i < joueurs })), quiz, questions: quiz * 12 }
      soiree.run(salons[d % 2], `soiree-${d}`, minuit + 21 * H, minuit + 23 * H, JSON.stringify(fiche))
    })
    // Sept jours de santé du serveur : réveillé vers 7 h, endormi vers minuit,
    // une mise en ligne il y a trois jours, un arrêt net hier soir et son
    // redémarrage, et ce matin un réveil éteint juste avant le banc.
    const heureDeSante = permanente.prepare('INSERT INTO qg_sante (heure, demarrage, releve, maj_le) VALUES (?, ?, ?, ?)')
    const unDemarrage = permanente.prepare('INSERT INTO qg_demarrages (id, demarre_le, pret_en_ms, version, env, vu_le, arrete_le) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const minuitsDeLaSemaine = minuitsDeParis(maintenant, 8)
    // Le soir, une soirée charge le serveur : les temps montent un peu.
    const releveDe = (heure: number, soiree: boolean) => {
      const vague = 1 + 0.35 * Math.sin(heure / H / 2.7)
      return { base: Math.round((soiree ? 95 : 62) * vague), routes: Math.round((soiree ? 330 : 190) * vague) }
    }
    const vie = (id: string, debut: number, fin: number, version: string, pretEnMs: number, propre: boolean) => {
      unDemarrage.run(id, debut, pretEnMs, version, 'production', fin, propre ? fin : null)
      for (let heure = Math.floor(debut / H) * H; heure < fin; heure += H) {
        const heureDeParis = Math.floor(minutesDeParis(heure) / 60)
        const r = releveDe(heure, heureDeParis >= 20)
        const erreurs: Record<string, number> = {}
        if (id === 'hier-matin' && heure === Math.floor(fin / H) * H) erreurs['POST /api/jour/reponse'] = 3
        if (id === 'avant-hier' && heureDeParis === 14) erreurs['socket host:launch'] = 1
        const base = id === 'mise-en-ligne' && heureDeParis === 18 ? 1240 : r.base
        heureDeSante.run(
          heure,
          id,
          JSON.stringify({
            base: { n: 140, p50: Math.round(base * 0.45), p95: base, max: base * 2 },
            routes: { n: 260, p50: Math.round(r.routes * 0.4), p95: r.routes, max: r.routes * 3 },
            lentes: [{ route: 'POST /api/campagne/serie/:id/reponse', n: 60, p95: Math.round(r.routes * 1.4) }],
            erreurs,
            miroir: 0,
          }),
          heure,
        )
      }
    }
    const a = (jour: number, heure: number, minutes = 0) => minuitsDeLaSemaine[jour] + heure * H + minutes * 60_000
    vie('j1', a(1, 7, 2), a(1, 23, 54), 'a1b2c3d', 1150, true)
    vie('j2', a(2, 7, 1), a(2, 23, 57), 'a1b2c3d', 980, true)
    vie('j3', a(3, 7, 4), a(3, 23, 51), 'a1b2c3d', 1320, true)
    vie('j4', a(4, 7, 2), a(4, 18, 41), 'a1b2c3d', 1050, true)
    vie('mise-en-ligne', a(4, 18, 40), a(4, 23, 58), 'e4f5a6b', 2480, true)
    vie('avant-hier', a(5, 7, 3), a(5, 23, 56), 'e4f5a6b', 1010, true)
    // L'arrêt net d'hier, vingt heures avant le banc (borné à la journée d'hier) : moins d'un jour, « À traiter » le montre.
    const arretNet = Math.max(a(6, 9), Math.min(a(6, 23), maintenant - 20 * H))
    vie('hier-matin', a(6, 7, 2), arretNet, 'e4f5a6b', 1180, false)
    vie('hier-soir', arretNet + 15 * 60_000, a(6, 23, 59), 'e4f5a6b', 3920, true)
    vie('ce-matin', a(7, 7, 2), maintenant - 5 * 60_000, 'e4f5a6b', 1090, true)
    signalement.run(jourDe(maintenant), 2, 'p-1', 'Deux bonnes réponses ?', maintenant)
    signalement.run(jourDe(maintenant), 2, 'p-2', 'Canberra, pas Sydney', maintenant)
    // Le journal d'hier : deux gestes, pour voir les jours se ranger.
    const geste = permanente.prepare("INSERT INTO qg_gestes (id, quand, qui, sorte, route, resume, cible) VALUES (?, ?, 'banc', ?, 'POST /api/admin/x', ?, NULL)")
    geste.run('hier-1', minuits[minuits.length - 1] - 3 * H, 'salon', 'Espace « Chez Bob » renommé « Chez Robert », adresse /chez-bob → /chez-robert')
    geste.run('hier-2', minuits[minuits.length - 1] - 2 * H, 'catalogue', 'Copie publiée au catalogue : « Les années 80 en chansons », de Nadia')
  }
  permanente.close()

  const photographier = async (nom: string, largeur: number, hauteur: number, { pleine = true, theme, adresse = '/admin' }: { pleine?: boolean; theme?: string; adresse?: string } = {}) => {
    const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: largeur < 600 ? 2 : 1 })
    const [cle, valeur] = admin.split('=')
    await contexte.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}${adresse}`)
    await page.waitForSelector('.qg-tete')
    if (adresse === '/admin') await page.waitForSelector('.qg-graphe svg, .qg-participations .muted', { timeout: 15000 })
    if (adresse === '/admin#soirees') await page.waitForSelector('.qg-barres', { timeout: 15000 })
    if (adresse === '/admin#serveur') await page.waitForSelector('.qg-graphe svg', { timeout: 15000 })
    if (theme) await page.evaluate(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)})`)
    await page.waitForTimeout(800)
    // Rien ne dépasse en largeur : la page ne défile qu'en hauteur.
    const deborde = (await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')) as number
    if (deborde > 0) console.error(`[${nom}] la page déborde de ${deborde} px en largeur`)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nom}.png`))
    await contexte.close()
  }

  await photographier('1-telephone', 360, 640)
  await photographier('2-ordinateur-1366', 1366, 768)
  await photographier('3-ordinateur-1920', 1920, 1080)
  await photographier('4-ordinateur-ivoire', 1366, 768, { theme: 'ivoire' })
  await photographier('5-telephone-ivoire', 360, 640, { theme: 'ivoire' })
  await photographier('6-page-du-jour', 1366, 768, { adresse: '/admin#jour', pleine: false })
  await photographier('7-journal', 1366, 768, { adresse: '/admin#journal', pleine: false })
  await photographier('8-journal-telephone', 360, 640, { adresse: '/admin#journal' })
  await photographier('9-soirees', 1366, 768, { adresse: '/admin#soirees' })
  await photographier('10-soirees-1920', 1920, 1080, { adresse: '/admin#soirees' })
  await photographier('11-soirees-telephone', 360, 640, { adresse: '/admin#soirees' })
  await photographier('12-soirees-ivoire', 360, 640, { adresse: '/admin#soirees', theme: 'ivoire' })
  await photographier('22-serveur', 1366, 768, { adresse: '/admin#serveur' })
  await photographier('23-serveur-1920', 1920, 1080, { adresse: '/admin#serveur' })
  await photographier('24-serveur-telephone', 360, 640, { adresse: '/admin#serveur' })
  await photographier('25-serveur-ivoire', 360, 640, { adresse: '/admin#serveur', theme: 'ivoire' })

  // La soirée laissée en plan, close d'ici : la confirmation, puis la page qui s'en remet.
  {
    const contexte = await navigateur.newContext({ viewport: { width: 1366, height: 768 } })
    const [cle, valeur] = admin.split('=')
    await contexte.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#soirees`)
    await page.getByRole('button', { name: 'Clore la soirée' }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(sortie, '13-clore-confirmer.png') })
    console.log(path.join(sortie, '13-clore-confirmer.png'))
    await page.getByRole('dialog').getByRole('button', { name: 'Clore la soirée' }).click()
    await page.waitForSelector('.toast')
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, '14-clore-fait.png'), fullPage: true })
    console.log(path.join(sortie, '14-clore-fait.png'))
    await contexte.close()
  }

  // La fiche de Léa, ouverte depuis « Les profils » : au téléphone — son
  // premier écran, puis entière —, à l'ordinateur, sous l'Ivoire ; puis le
  // don qu'on prépare, et le code de secours tiré pour elle.
  const ficheDeLea = async (nom: string, largeur: number, hauteur: number, { theme, geste }: { theme?: string; geste?: 'don' | 'code' } = {}) => {
    const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: largeur < 600 ? 2 : 1 })
    const [cle, valeur] = admin.split('=')
    await contexte.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#profils`)
    await page.getByRole('button', { name: /Léa/ }).first().click()
    await page.waitForSelector('.qg-fiche dl')
    if (theme) await page.evaluate(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)})`)
    if (geste === 'don') {
      await page.getByRole('button', { name: 'Offrir des confettis' }).click()
      await page.waitForSelector('.qg-fiche-don')
    }
    if (geste === 'code') {
      await page.getByRole('button', { name: 'Tirer un code de secours' }).click()
      await page.getByRole('button', { name: 'Tirer un code neuf' }).click()
      await page.waitForSelector('.qg-fiche-code')
    }
    await page.waitForTimeout(600)
    const deborde = (await page.evaluate('document.querySelector(".carte-corps").scrollWidth - document.querySelector(".carte-corps").clientWidth')) as number
    if (deborde > 0) console.error(`[${nom}] la fiche déborde de ${deborde} px en largeur`)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`) })
    console.log(path.join(sortie, `${nom}.png`))
    await contexte.close()
  }
  await ficheDeLea('15-fiche-telephone', 360, 640)
  await ficheDeLea('16-fiche-telephone-entiere', 360, 1500)
  await ficheDeLea('17-fiche-ordinateur', 1366, 768)
  await ficheDeLea('18-fiche-ivoire', 360, 1500, { theme: 'ivoire' })
  await ficheDeLea('19-fiche-don', 360, 1500, { geste: 'don' })
  await ficheDeLea('20-fiche-code', 360, 1500, { geste: 'code' })

  // L'accueil de Léa : les confettis offerts et leur mot, une fois, en tête.
  {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [cle, valeur] = lea.split('=')
    await contexte.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.annonce-admin')
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, '21-accueil-annonce.png') })
    console.log(path.join(sortie, '21-accueil-annonce.png'))
    // Revenue, la bannière ne retombe pas.
    await page.reload()
    await page.waitForSelector('.accueil-tete')
    await page.waitForTimeout(600)
    if (await page.locator('.annonce-admin').count()) console.error('[22] l’annonce retombe à la seconde visite')
    await contexte.close()
  }
  host.disconnect()
} finally {
  await navigateur.close()
  await banc.close()
}

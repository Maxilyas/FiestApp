// Les collectionneurs (`/collectionneurs`), photographiés au téléphone
// (360 × 640) sur un serveur jetable : le gros bouton de « Mon profil », la
// page — sa place, les Divins, chaque catégorie, ses amis —, la salle des
// Divins, une vitrine, le face-à-face et le barème. Sept joueurs, chacun sa
// collection écrite dans la base — ses légendaires par leurs hauts faits, ses
// Divins, ses Éclats et une matière, ses maîtres, ses défis du Cabinet, un
// thème, ses duels —, et huit figurants pour que la liste passe le dixième
// (« Voir la suite »), le serveur relu, le relevé de tous attendu. Le client
// construit d'abord (`npm run build -w client`). À chaque photo, ce qui
// élargit la page et les noms coupés ; et pour finir la page filmée, d'une
// puce à l'autre et à l'ouverture d'une vitrine : ce qui bouge (`bouge`).
//
//   npx tsx scripts/rendu-collectionneurs.ts ../export/collectionneurs [mots,…]
//
// `THEME=ivoire` photographie tout sous l'Ivoire ; le second argument ne garde
// que les états dont le nom contient l'un de ses mots.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, relireJusqua } from '../test/banc'
import { DESTINATIONS } from '../../shared/affiches'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import type { CleDeLigue } from '../../shared/duels'
import { ecrireDesDuels } from './duelsDEssai'

const sortie = path.resolve(process.argv[2] ?? 'rendu-collectionneurs')
const seulement = process.argv[3]?.split(',')
const retenu = (nom: string) => !seulement || seulement.some(mot => nom.includes(mot))
const theme = process.env.THEME
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

interface Joueur {
  login: string
  nom: string
  avatar: string
  niveau: number
  ligue?: CleDeLigue
  crans?: number
  /** Ses hauts faits rangés, et combien de fois : ce qui ouvre ses légendaires. */
  badges?: Record<string, number>
  /** Ses sentiers, paliers repris d'avant (13 : maître). */
  sentiers?: Record<string, number>
  /** Ses défis du Cabinet : la carte et son rang. */
  defis?: Record<string, 1 | 2 | 3>
  eclats?: string[]
  matieres?: [string, string][]
  themes?: string[]
  amis?: string[]
}

const JOUEURS: readonly Joueur[] = [
  {
    login: 'lea',
    nom: 'Léa',
    avatar: '🦊',
    niveau: 14,
    ligue: 'or',
    crans: 7,
    badges: { 'hf:phenix': 1, 'hf:triple': 1, 'hf:bavard:1': 1 },
    sentiers: { monde: 13, mythes: 6 },
    defis: { cagnotte: 2, parade: 1 },
    eclats: ['lg:phenix'],
    matieres: [['jade', 'lg:phenix']],
    themes: ['jungle'],
    amis: ['malik', 'hugo'],
  },
  {
    login: 'max',
    nom: 'Max',
    avatar: '🐯',
    niveau: 32,
    ligue: 'maitre',
    crans: 12,
    badges: { 'dv:helios': 1, 'hf:oracle': 8, 'hf:foudre': 10, 'hf:seul-contre-tous': 3, 'hf:phenix': 1 },
    sentiers: { monde: 13, stade: 13, foret: 13, ecran: 7 },
    defis: { cagnotte: 3, parade: 3, panacee: 3, echange: 2 },
    eclats: ['lg:oracle', 'lg:tigre'],
  },
  {
    login: 'zoe',
    nom: 'Zoé',
    avatar: '🦉',
    niveau: 22,
    ligue: 'diamant',
    crans: 5,
    badges: { 'dv:seraphin': 1, 'hf:grand-chelem': 1, 'hf:lanterne-rouge': 3 },
    sentiers: { oceans: 13, espace: 8 },
    defis: { 'coup-d-oeil': 3 },
  },
  {
    login: 'hugo',
    nom: 'Hugo',
    avatar: '🐻',
    niveau: 21,
    ligue: 'platine',
    crans: 9,
    badges: { 'hf:lanterne-rouge': 3, 'hf:grand-chelem': 1, 'hf:phenix': 1 },
    sentiers: { scene: 13, contes: 13, brigade: 4 },
    defis: { concentration: 3, pourboire: 1 },
    eclats: ['lg:kraken'],
  },
  { login: 'ines', nom: 'Inès', avatar: '🐸', niveau: 16, ligue: 'argent', crans: 12, badges: { 'hf:triple': 1 }, sentiers: { arcade: 6 }, eclats: ['🐸'] },
  { login: 'malik', nom: 'Malik', avatar: '🐼', niveau: 9, ligue: 'bronze', crans: 3, badges: { 'hf:phenix': 1 }, sentiers: { carnaval: 4 } },
  { login: 'nina', nom: 'Nina', avatar: '🐙', niveau: 4 },
  // Huit figurants, de quoi passer le dixième : la liste s'y arrête, et « Voir la suite » apporte le reste.
  { login: 'sacha', nom: 'Sacha', avatar: '🦁', niveau: 12, ligue: 'argent', crans: 4 },
  { login: 'yanis', nom: 'Yanis', avatar: '🐨', niveau: 11 },
  { login: 'lina', nom: 'Lina', avatar: '🐷', niveau: 10, ligue: 'bronze', crans: 8 },
  { login: 'theo', nom: 'Théo', avatar: '🐶', niveau: 8 },
  { login: 'jade', nom: 'Jade', avatar: '🐱', niveau: 7 },
  { login: 'rayan', nom: 'Rayan', avatar: '🐵', niveau: 6 },
  { login: 'mila', nom: 'Mila', avatar: '🦖', niveau: 5 },
  { login: 'tom', nom: 'Tom', avatar: '🦄', niveau: 3 },
]

interface Etat {
  nom: string
  adresse: string
  /** La page entière, en plus du premier écran. */
  entiere?: boolean
  /** Ce qu'on touche avant la photo, dans l'ordre : un onglet par son nom, ou un sélecteur. */
  toucher?: (string | { onglet: string } | { bouton: string })[]
  /** La page défilée jusqu'à ce sélecteur, en haut de l'écran. */
  defiler?: string
  /** Une feuille ouverte : la photo de son bas, en plus. */
  feuilleEntiere?: boolean
  /** Une feuille ouverte, défilée jusqu'à ce sélecteur, en haut de son cadre. */
  defilerFeuille?: string
}

const ETATS: readonly Etat[] = [
  { nom: '01-mon-profil', adresse: '/profil', entiere: true },
  { nom: '02-collectionneurs', adresse: '/collectionneurs', entiere: true },
  { nom: '03-maitres', adresse: '/collectionneurs', toucher: [{ onglet: 'Maîtres' }], defiler: '.cl-classement-tete' },
  { nom: '04-cabinet', adresse: '/collectionneurs', toucher: [{ onglet: 'Cabinet' }], defiler: '.cl-classement-tete' },
  { nom: '05-legendaires', adresse: '/collectionneurs', toucher: [{ onglet: 'Légendaires' }], defiler: '.cl-classement-tete' },
  { nom: '06-niveau', adresse: '/collectionneurs', toucher: [{ onglet: 'Niveau' }], defiler: '.cl-classement-tete' },
  { nom: '07-eclats', adresse: '/collectionneurs', toucher: [{ onglet: 'Éclats' }], defiler: '.cl-classement-tete' },
  { nom: '08-mes-amis', adresse: '/collectionneurs', toucher: [{ onglet: 'Mes amis' }], defiler: '.cl-classement-tete' },
  { nom: '09-salle-des-divins', adresse: '/collectionneurs', toucher: ['.cl-divins-bandeau'], feuilleEntiere: true },
  { nom: '10-vitrine-max', adresse: '/collectionneurs', toucher: ['.cl-carte-premier'], feuilleEntiere: true },
  { nom: '11-face-a-face-max', adresse: '/collectionneurs', toucher: ['.cl-carte-premier', { bouton: 'Comparer' }], feuilleEntiere: true },
  { nom: '12-ma-vitrine', adresse: '/collectionneurs', toucher: ['.cl-sa-place ~ .cl-classement-tete', '.cl-ligne.me'], feuilleEntiere: true },
  { nom: '13-bareme', adresse: '/collectionneurs', toucher: ['.cl-bareme summary'], defiler: '.cl-bareme' },
  // Son bas : le Divin, puis les trophées et le style en vignettes.
  { nom: '13-bareme-bas', adresse: '/collectionneurs', toucher: ['.cl-bareme summary'], defiler: '.cl-bareme-divin' },
  { nom: '14-scelles', adresse: '/collectionneurs', toucher: [{ onglet: 'Scellés' }], defiler: '.cl-classement-tete' },
  // Sa carte dit ce que vaut sa collection : la sienne, qui mène aux collectionneurs ; celle de Max, ouverte de sa vitrine.
  { nom: '15-ma-carte', adresse: '/profil', toucher: ['.identite-ligne'] },
  { nom: '16-sa-carte-depuis-sa-vitrine', adresse: '/collectionneurs', toucher: ['.cl-carte-premier', { bouton: 'Sa carte' }] },
  // Où mène la carte d'un autre : sa vitrine, ouverte d'emblée (`{max}`, son identifiant).
  { nom: '17-sa-vitrine-par-sa-carte', adresse: '/collectionneurs#vitrine-{max}', feuilleEntiere: true },
  // « J'aimerais voir tout le monde » : la liste jusqu'au dixième et « Voir la suite », puis la liste entière.
  { nom: '20-la-liste-et-sa-suite', adresse: '/collectionneurs', defiler: '.cl-liste li:nth-child(4)' },
  { nom: '21-toute-la-liste', adresse: '/collectionneurs', toucher: ['.cl-suite'], defiler: '.cl-liste li:nth-child(9)' },
  // Ses trophées et son style : la vitrine de Max, famille par famille, puis pièce par pièce, et le face-à-face.
  { nom: '22-vitrine-trophees-et-style', adresse: '/collectionneurs', toucher: ['.cl-carte-premier'], defilerFeuille: '.cl-familles' },
  { nom: '23-face-a-face-trophees-et-style', adresse: '/collectionneurs', toucher: ['.cl-carte-premier', { bouton: 'Comparer' }], defilerFeuille: '.cl-duel-ligne:nth-child(6)' },
]

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: string[] = []
try {
  const cookies: Record<string, string> = {}
  for (const j of JOUEURS) cookies[j.login] = await inscrireProfil(banc.url, j.login, j.nom, j.avatar)
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const idDe = (login: string) => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
  const t = Date.now() - 86400_000
  const badge = db.prepare('INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const j of JOUEURS) {
    const id = idDe(j.login)
    // Son niveau, et sa finition avec.
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`).run(id, xpDuNiveau(j.niveau), JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(j.niveau), id)
    if (j.ligue) ecrireDesDuels(db, id, j.ligue, j.crans ?? 0)
    // Chaque haut fait autant de fois que de soirées : ce qui ouvre ses légendaires et ses Divins.
    for (const [cle, fois] of Object.entries(j.badges ?? {})) for (let i = 0; i < fois; i++) badge.run(id, cle, `soiree-${i}`, '', '', '', t)
    for (const [carte, rang] of Object.entries(j.defis ?? {})) for (let r = 1; r <= rang; r++) badge.run(id, `cabinet:defi:${carte}:${r}`, '#cabinet', '', '', '', t)
    for (const [branche, paliers] of Object.entries(j.sentiers ?? {})) db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)').run(id, branche, paliers, t)
    for (const avatar of j.eclats ?? []) db.prepare('INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, ?, ?)').run(id, avatar, 'soiree-0', t)
    for (const [matiere, avatar] of j.matieres ?? []) db.prepare('INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, ?, ?)').run(id, `matiere:${matiere}:${avatar}`, 'soiree-1', t)
    for (const cle of j.themes ?? []) db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, ?)').run(id, cle, t)
    for (const ami of j.amis ?? []) db.prepare('INSERT INTO campagne_amis_ajoutes (profile_id, ami, ajoute_le) VALUES (?, ?, ?)').run(id, idDe(ami), t)
  }
  // Max et Léa portent ce qu'ils ont de plus beau.
  db.prepare("UPDATE profiles SET legendaire = 'dv:helios' WHERE id = ?").run(idDe('max'))
  db.prepare("UPDATE profiles SET legendaire = 'lg:phenix' WHERE id = ?").run(idDe('lea'))
  db.prepare("UPDATE profile_eclats SET matiere = 'jade' WHERE profile_id = ? AND avatar = 'lg:phenix'").run(idDe('lea'))
  const idDeMax = idDe('max')
  db.close()
  await banc.redemarrer()
  // Le premier relevé se fait en fond, derrière la première visite.
  await relireJusqua(
    () => fetch(`${banc.url}/api/collectionneurs`, { headers: { Cookie: cookies.lea } }).then(r => r.json() as Promise<{ enPreparation?: true }>),
    c => !c.enPreparation,
    20_000,
  )

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const [nom, valeur] = cookies.lea.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  page.on('console', (m: any) => m.type() === 'error' && console.error('[console]', m.text()))

  /** Ce que la photo dit d'elle : la page déborde-t-elle de côté, la feuille défile-t-elle, et quels noms sont coupés. */
  const mesurer = (): Promise<string> =>
    page.evaluate(`(() => {
      const large = document.documentElement.scrollWidth > innerWidth ? ' · DÉBORDE EN LARGEUR de ' + (document.documentElement.scrollWidth - innerWidth) + ' px' : ''
      const corps = document.querySelector('.carte-corps')
      const feuille = corps ? ' · feuille ' + corps.clientHeight + ' px' + (corps.scrollHeight > corps.clientHeight + 1 ? ', défile de ' + (corps.scrollHeight - corps.clientHeight) + ' px' : ', tient en entier') : ''
      const trop = [...document.querySelectorAll('.cl-nom b, .cl-detail, .cl-carte-nom, .cl-piece > span:last-child, .cl-socle b, .gros-detail')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 32))
      return 'page ' + document.documentElement.scrollHeight + ' px' + feuille + large + (trop.length ? ' · coupés : ' + trop.join(' | ') : '')
    })()`)

  const attendre = async () => {
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.waitForTimeout(700)
  }

  for (const e of ETATS.filter(x => retenu(x.nom))) {
    await page.goto('about:blank')
    await page.goto(`${banc.url}${e.adresse.replace('{max}', encodeURIComponent(idDeMax))}`)
    await page.waitForSelector(e.adresse === '/profil' ? '.profil-boutons' : '.cl-sa-place')
    if (theme) await page.evaluate(`document.documentElement.dataset.theme = '${theme}'`)
    for (const geste of e.toucher ?? []) {
      if (typeof geste === 'string') await page.locator(geste).last().tap()
      else if ('onglet' in geste) await page.getByRole('tab', { name: geste.onglet, exact: true }).tap()
      else await page.getByRole('button', { name: geste.bouton }).tap()
      await page.waitForTimeout(350)
    }
    // Défilée en texte : une fonction passée à `evaluate` partirait avec les `__name` de tsx, que la page ne connaît pas.
    if (e.defiler) await page.evaluate(`document.querySelector('${e.defiler}').scrollIntoView({ block: 'start' }); window.scrollBy(0, -14)`)
    await attendre()
    // Après l'attente : la vitrine pose ses pièces maîtresses en arrivant, et tout ce qui suit descend d'autant.
    if (e.defilerFeuille) {
      await page.evaluate(
        `(() => { const c = document.querySelector('.carte-corps'), x = document.querySelector('${e.defilerFeuille}'); if (c && x) c.scrollTop += x.getBoundingClientRect().top - c.getBoundingClientRect().top - 12 })()`,
      )
      await page.waitForTimeout(300)
    }
    const vu = await mesurer()
    mesures.push(`${e.nom} : ${vu}`)
    console.log(`${e.nom} : ${vu}`)
    await page.screenshot({ path: path.join(sortie, `${e.nom}.png`) })
    if (e.entiere) {
      // La page entière dans un écran aussi haut qu'elle : en `fullPage`, la barre du menu, fixe, restait au milieu de la photo.
      const haut = (await page.evaluate('document.documentElement.scrollHeight')) as number
      await page.setViewportSize({ width: 360, height: haut })
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(sortie, `${e.nom}-entiere.png`) })
      await page.setViewportSize({ width: 360, height: 640 })
    }
    if (e.feuilleEntiere) {
      const defile = await page.evaluate(`(() => { const c = document.querySelector('.carte-corps'); if (!c || c.scrollHeight <= c.clientHeight + 1) return false; c.scrollTop = c.scrollHeight; return true })()`)
      if (defile) {
        await page.waitForTimeout(400)
        await page.screenshot({ path: path.join(sortie, `${e.nom}-bas.png`) })
      }
    }
  }
  // L'affiche du QG, posée en dernier — Léa a déjà ouvert la page, avant elle : l'accueil l'annonce, et « Nouveau »
  // s'allume sur le gros bouton de son profil jusqu'à sa prochaine visite.
  if (retenu('18-affiche-accueil') || retenu('19-affiche-profil')) {
    const admin = await connexionAnimateur(banc.url)
    const { titre, phrase } = DESTINATIONS.collectionneurs
    const posee = await ecrire(banc.url, '/api/admin/affiches', { id: 'collectionneurs', page: 'collectionneurs', titre, phrase, jours: 14, confettis: 50 }, admin)
    if (posee.status !== 200) throw new Error(`affiche refusée : ${posee.status} ${await posee.text()}`)
    for (const [nom, adresse, attente] of [
      ['18-affiche-accueil', '/', '.accueil'],
      ['19-affiche-profil', '/profil', '.profil-boutons'],
    ] as const) {
      if (!retenu(nom)) continue
      await page.goto(`${banc.url}${adresse}`)
      await page.waitForSelector(attente)
      if (theme) await page.evaluate(`document.documentElement.dataset.theme = '${theme}'`)
      await attendre()
      const vu = await mesurer()
      mesures.push(`${nom} : ${vu}`)
      console.log(`${nom} : ${vu}`)
      await page.screenshot({ path: path.join(sortie, `${nom}.png`) })
    }
  }
  // Ce qui bouge quand on navigue dans la page (« ça a l'air de bouger […] on dirait que c'est instable », le
  // propriétaire, le 9 novembre 2026) : une photo ne le montre pas, la page se filme — image par image, au doigt, les
  // animations laissées, l'ancrage du défilement coupé comme sous Safari, la vitrine retardée comme sur un vrai réseau.
  // Tout doit dire zéro : les puces restent sous le doigt, le podium garde sa taille, aucune ligne ne rejoue son entrée,
  // et rien de ce qu'une vitrine a montré ne descend.
  if (retenu('24-ce-qui-bouge')) {
    const anime = await navigateur.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
    await anime.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const film = await anime.newPage()
    await film.route(/\/api\/collectionneurs\/[^/]+$/, async (route: any) => {
      await new Promise(r => setTimeout(r, 600))
      await route.continue()
    })
    await film.goto(`${banc.url}/collectionneurs`)
    await film.waitForSelector('.cl-sa-place')
    await film.waitForLoadState('networkidle').catch(() => {})
    await film.waitForTimeout(1000)
    await film.addStyleTag({ content: '* { overflow-anchor: none !important; }' })
    await film.evaluate(`window.__filmer = ms => new Promise(fin => {
      const images = [], debut = performance.now()
      const haut = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null }
      const pas = () => {
        const corps = document.querySelector('.carte-corps'), gemmes = haut('.cl-gemmes'), lignes = [...document.querySelectorAll('.cl-liste .cl-ligne')]
        images.push({
          puces: haut('.cl-puces')?.top, podium: haut('.cl-podium')?.height, liste: haut('.cl-liste')?.top,
          lignes: lignes.length, rejouees: lignes.filter(e => e.getAnimations().some(a => a.playState === 'running')).length,
          feuille: haut('.carte-feuille')?.height, tableaux: corps && gemmes ? gemmes.top - corps.getBoundingClientRect().top + corps.scrollTop : undefined,
        })
        performance.now() - debut < ms ? requestAnimationFrame(pas) : fin(images)
      }
      requestAnimationFrame(pas)
    })`)
    type Image = { puces?: number; podium?: number; liste?: number; lignes: number; rejouees: number; feuille?: number; tableaux?: number }
    const etendue = (xs: (number | undefined)[]) => {
      const vus = xs.filter((x): x is number => x !== undefined)
      return vus.length ? Math.round(Math.max(...vus) - Math.min(...vus)) : 0
    }
    await film.evaluate('window.scrollTo(0, 120)')
    await film.waitForTimeout(300)
    const fins: Image[] = []
    let rejouees = ''
    for (const onglet of ['Niveau', 'Maîtres', 'Cabinet', 'Légendaires', 'Scellés', 'Éclats', 'Collection', 'Mes amis', 'Tous']) {
      const b = await film.getByRole('tab', { name: onglet, exact: true }).boundingBox()
      const images = film.evaluate('window.__filmer(500)') as Promise<Image[]>
      // Au doigt, là où la puce est à l'écran : `tap()` ferait défiler la page pour l'amener, et cacherait son saut.
      await film.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
      const vues = await images
      fins.push(vues[vues.length - 1])
      // Une entrée rejouée par quelques lignes seulement : celles que la page a déplacées, les autres immobiles.
      const pire = vues.find(i => i.rejouees > 0 && i.rejouees < i.lignes)
      if (pire && !rejouees) rejouees = `${pire.rejouees} sur ${pire.lignes} à « ${onglet} »`
    }
    await film.getByRole('tab', { name: 'Collection', exact: true }).tap()
    await film.waitForTimeout(400)
    const vitrine = film.evaluate('window.__filmer(1500)') as Promise<Image[]>
    await film.locator('.cl-carte-premier').tap()
    const ouverte = (await vitrine).filter(i => i.feuille !== undefined)
    const vu = [
      `les puces se déplacent de ${etendue(fins.map(i => i.puces))} px d'une puce à l'autre`,
      `le podium change de ${etendue(fins.map(i => i.podium))} px`,
      `la liste se déplace de ${etendue(fins.filter(i => i.podium !== undefined).map(i => i.liste))} px`,
      `lignes qui rejouent seules leur entrée : ${rejouees || 'aucune'}`,
      `la feuille d'une vitrine grandit de ${etendue(ouverte.map(i => i.feuille))} px, ses tableaux descendent de ${etendue(ouverte.map(i => i.tableaux))} px`,
    ].join(' · ')
    mesures.push(`24-ce-qui-bouge : ${vu}`)
    console.log(`24-ce-qui-bouge : ${vu}`)
    await anime.close()
  }
  writeFileSync(path.join(sortie, 'mesures.txt'), mesures.join('\n') + '\n')
  console.log(`\n${mesures.length} états photographiés dans ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}

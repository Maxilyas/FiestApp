// Les collectionneurs (`/collectionneurs`), photographiés au téléphone
// (360 × 640) sur un serveur jetable : le gros bouton de « Mon profil », la
// page — sa place, les Divins, chaque catégorie, ses amis —, la salle des
// Divins, une vitrine, le face-à-face et le barème. Sept joueurs, chacun sa
// collection écrite dans la base — ses légendaires par leurs hauts faits, ses
// Divins, ses Éclats et une matière, ses maîtres, ses défis du Cabinet, un
// thème, ses duels —, le serveur relu, le relevé de tous attendu. Le client
// construit d'abord (`npm run build -w client`). À chaque photo, ce qui
// élargit la page et les noms coupés.
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
import { demarrer, inscrireProfil, relireJusqua } from '../test/banc'
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
  { nom: '14-scelles', adresse: '/collectionneurs', toucher: [{ onglet: 'Scellés' }], defiler: '.cl-classement-tete' },
  // Sa carte dit ce que vaut sa collection : la sienne, qui mène aux collectionneurs ; celle de Max, ouverte de sa vitrine.
  { nom: '15-ma-carte', adresse: '/profil', toucher: ['.identite-ligne'] },
  { nom: '16-sa-carte-depuis-sa-vitrine', adresse: '/collectionneurs', toucher: ['.cl-carte-premier', { bouton: 'Sa carte' }] },
  // Où mène la carte d'un autre : sa vitrine, ouverte d'emblée (`{max}`, son identifiant).
  { nom: '17-sa-vitrine-par-sa-carte', adresse: '/collectionneurs#vitrine-{max}', feuilleEntiere: true },
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
  writeFileSync(path.join(sortie, 'mesures.txt'), mesures.join('\n') + '\n')
  console.log(`\n${mesures.length} états photographiés dans ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}

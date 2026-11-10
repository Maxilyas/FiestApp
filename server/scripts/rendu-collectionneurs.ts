// Les collectionneurs (`/collectionneurs`), photographiés au téléphone
// (360 × 640) sur un serveur jetable : le gros bouton de « Mon profil », la
// page — sa place, les Divins, chaque catégorie, ses amis —, la salle des
// Divins, une vitrine, le face-à-face et le barème. Sept joueurs, chacun sa
// collection écrite dans la base — ses légendaires par leurs hauts faits, ses
// Divins, ses Éclats et une matière, ses maîtres, ses défis du Cabinet, un
// thème, ses duels —, et huit figurants pour que la liste passe le dixième
// (« Voir la suite »), le serveur relu, le relevé de tous attendu. Le client
// construit d'abord (`npm run build -w client`). À chaque photo, ce qui
// élargit la page et les noms coupés ; puis la page filmée, d'une puce à
// l'autre et à l'ouverture d'une vitrine : ce qui bouge (`24-ce-qui-bouge`).
//
// Et pour finir, ce qui tient sur le premier écran (« tout sur le même écran
// ou presque », le propriétaire, le 10 novembre 2026 ; les états `25-…`) : à
// six tailles, de 360 × 640 à 412 × 915, pour Léa, classée, pour Noé, un
// nouveau venu qui ne l'est pas, et sans aucun Divin descendu, où finit chaque
// bloc dans chacune des quatorze vues — sa place, les Divins, les puces, le
// podium, la première ligne de la liste —, ce que le doigt touche de chaque
// geste, ce qu'un écran court tait à l'œil. Le script sort en erreur si le
// podium passe sous la barre du menu, si quoi que ce soit change de place
// d'une vue à l'autre, si un geste se touche sur moins de 44 px, si un texte
// passe sous le plancher, si une puce est plus étroite que son nom, ou si la
// page déborde de côté.
//
//   npx tsx scripts/rendu-collectionneurs.ts ../export/collectionneurs [mots,…]
//
// `THEME=ivoire` photographie tout sous l'Ivoire ; `ENCOCHE=47` pose l'encoche
// d'un iPhone et sa barre d'accueil sur les états `25-…`, en 390 × 844 ; le
// second argument ne garde que les états dont le nom contient l'un de ses
// mots (`25-` : le premier écran seul ; `25-lea-360x640` : une seule taille).
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

type Ecran = readonly [number, number]
/**
 * Les six tailles où la page se mesure : le petit téléphone de référence, un iPhone dans Safari — ses barres dépliées —,
 * un téléphone moyen, un grand Android dans Chrome, un iPhone d'aujourd'hui, un grand Android.
 */
const SIX_ECRANS: readonly Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]
/**
 * L'encoche d'un iPhone et sa barre d'accueil, 34 px en bas — l'application installée : Chromium sans écran les tient à
 * zéro, et la page y perd de la hauteur aux deux bouts sans changer de pas (skill `regarder-le-rendu`). Elle ne se pose
 * que sur l'écran qui en a une : un iPhone d'aujourd'hui, 390 × 844.
 */
const encoche = Number(process.env.ENCOCHE ?? 0)

/**
 * Ce que le premier écran montre, bloc par bloc : où chacun commence et finit dans la page, et le pli — le haut de la
 * barre du menu. Avec lui, ce qu'une photo ne dit pas : le titre sur combien de lignes, un nom coupé au bout, un texte
 * sous le plancher (`--t-label`, 11 px au texte ordinaire), la page plus large que l'écran. En texte : `tsx` glisserait
 * dans une fonction des `__name` que la page ne connaît pas.
 */
const LE_PREMIER_ECRAN = `(() => {
  const menu = document.querySelector('.menu-barre')
  const pli = Math.round(menu ? menu.getBoundingClientRect().top : innerHeight)
  const boite = e => {
    if (!e) return null
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 ? { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY) } : null
  }
  const un = s => boite(document.querySelector(s))
  const tous = s => [...document.querySelectorAll(s)].map(boite).filter(Boolean)
  const etendue = bs => (bs.length ? { haut: Math.min(...bs.map(b => b.haut)), bas: Math.max(...bs.map(b => b.bas)) } : null)
  // Les lignes d'un texte : ses boîtes de ligne, comptées par leur haut.
  const lignesDe = e => {
    if (!e) return 0
    const plage = document.createRange()
    plage.selectNodeContents(e)
    return new Set([...plage.getClientRects()].filter(r => r.width > 1).map(r => Math.round(r.top))).size
  }
  // Ce qui se lit à l'œil : ni ce qu'une case cache (sa place dans les treize autres vues), ni ce qui n'est dit qu'à
  // l'oreille (\`.sr-only\`, ou ses déclarations : une boîte d'un pixel), ni l'emoji d'un avatar, qui est un dessin.
  const lu = el => {
    if (el.closest('.menu-barre, .sr-only, .av, script, style')) return false
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false
    const r = el.getBoundingClientRect()
    return r.width > 2 && r.height > 2
  }
  const plancher = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.6875
  const petits = new Set()
  const marcheur = document.createTreeWalker(document.querySelector('.cl-page'), NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || !lu(el)) continue
    const taille = parseFloat(getComputedStyle(el).fontSize)
    if (taille < plancher - 0.05) petits.add('« ' + [...t.textContent.trim()].slice(0, 24).join('') + ' » à ' + Math.round(taille * 10) / 10 + ' px')
  }
  const titre = document.querySelector('.cl-page .piece-tete h1')
  // Ce que cet écran tait à l'œil, et que l'oreille entend encore : le surtitre de la page, réduit à un pixel, et la fin
  // de « Encore N … pour passer X », passée sous la ligne que sa rangée montre.
  const surtitre = document.querySelector('.cl-page > .piece-tete .label')
  const rangee = document.querySelector('.cl-sa-place-texte:not([aria-hidden]) .cl-sa-place-manque')
  const qui = rangee && rangee.querySelector('.cl-sa-place-qui')
  const tu = {
    surtitre: surtitre && surtitre.getBoundingClientRect().width <= 2 ? '« ' + surtitre.textContent.trim() + ' »' : null,
    qui: qui && qui.getBoundingClientRect().top >= rangee.getBoundingClientRect().bottom - 1 ? '«' + qui.textContent + ' »' : null,
  }
  const deborde = e => lu(e) && e.scrollWidth > e.clientWidth + 1
  const dit = e => '« ' + [...e.textContent.trim()].slice(0, 32).join('') + ' »'
  return {
    ecran: innerWidth + '×' + innerHeight,
    pli,
    page: document.documentElement.scrollHeight,
    large: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    choisis: [...document.querySelectorAll('.cl-page [role=tab][aria-selected=true]')].map(o => o.textContent.trim()),
    retour: un('.cl-page > .jour-sortie'),
    titre: boite(titre),
    lignesDuTitre: lignesDe(titre),
    place: un('.cl-sa-place'),
    // Ce que sa place dit, dans la vue montrée : ses lignes, une par une.
    saPlace: [...document.querySelectorAll('.cl-sa-place-texte:not([aria-hidden]) > *')].filter(lu).map(e => e.textContent.trim().replace(/\\s+/g, ' ')),
    divins: un('.cl-divins-bandeau'),
    tete: un('.cl-classement-tete'),
    puces: un('.cl-puces'),
    rangeesDePuces: new Set([...document.querySelectorAll('.cl-puces .onglet')].map(o => Math.round(o.getBoundingClientRect().top))).size,
    podium: etendue(tous('.cl-podium .cl-carte')),
    pastilles: etendue(tous('.cl-podium .cl-opale-pastille')),
    lignes: tous('.cl-liste .cl-ligne'),
    tu,
    // Un nom plus long que sa case se coupe au bout, c'est voulu ; le nom d'une puce plus large qu'elle, non.
    coupes: [...document.querySelectorAll('.cl-carte-nom, .cl-nom > b, .cl-detail, .cl-sa-place-texte:not([aria-hidden]) .cl-sa-place-combien')].filter(deborde).map(dit),
    etroites: [...document.querySelectorAll('.cl-puces .onglet, .cl-cercle-petit .onglet')].filter(deborde).map(dit),
    petits: [...petits],
  }
})()`

/**
 * Ce que le doigt touche vraiment de chaque geste de la page, en hauteur : pas sa boîte, ce que la page répond au point
 * touché (`elementFromPoint`) — une puce peut être plus basse que sa cible, qui déborde d'elle. Chaque geste amené au
 * milieu de l'écran, loin de la barre du menu, puis la page rendue à son haut. Par groupe, le plus bas.
 */
const LES_CIBLES = `(() => {
  const touchee = el => {
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2, milieu = r.top + r.height / 2
    const a = y => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)) }
    if (!a(milieu)) return Math.round(r.height)
    let h = milieu, b = milieu
    while (milieu - h < 40 && a(h - 1)) h--
    while (b - milieu < 40 && a(b + 1)) b++
    return Math.round(b - h + 1)
  }
  const gestes = {
    '« ← Mon profil »': '.cl-page > .jour-sortie',
    'les Divins': '.cl-divins-bandeau',
    '« Tous · Mes amis »': '.cl-cercle-petit .onglet',
    'une puce': '.cl-puces .onglet',
    'une carte du podium': '.cl-podium .cl-carte',
    'une ligne': '.cl-liste .cl-ligne',
    '« Voir la suite »': '.cl-suite',
    'le barème': '.cl-bareme summary',
  }
  const vu = {}
  for (const [nom, s] of Object.entries(gestes)) {
    const els = [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 0)
    if (els.length) vu[nom] = Math.min(...els.map(touchee))
  }
  scrollTo(0, 0)
  return vu
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: string[] = []
/** Ce qui devait tenir sur le premier écran et n'y tient plus, ou ce qui bouge : le script sort en erreur. */
let rate = 0
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
      // La page entière, à la taille de ce téléphone : dans un écran aussi haut qu'elle — c'est ainsi qu'elle se prenait
      // jusqu'au 10 novembre 2026 —, les pas de hauteur de sa feuille la montreraient au large, pas telle qu'il la fait
      // défiler. La barre du menu, fixe, se poserait au milieu de la photo : elle s'efface le temps de la prendre.
      const style = await page.addStyleTag({ content: '.menu-barre { display: none !important; }' })
      await page.screenshot({ path: path.join(sortie, `${e.nom}-entiere.png`), fullPage: true })
      await style.evaluate((s: any) => s.remove())
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
  // Ce qui tient sur le premier écran (« j'aimerais que l'on puisse avoir tout sur le même écran ou presque », le
  // propriétaire, le 10 novembre 2026). Un classement défile par nature : sa liste est son contenu. Le « presque », ici :
  // sa place, les Divins, les puces et le podium au-dessus de la barre du menu, aux six tailles — le podium se voit sans
  // défiler. Mesuré dans chacune des quatorze vues (sept catégories, deux cercles), pour un profil classé, pour un
  // nouveau venu qui ne l'est pas, avec et sans Divin descendu : où finit chaque bloc, ce qui change de place d'une vue à
  // l'autre — rien ne doit, à aucune taille —, ce que le doigt touche de chaque geste, le plus petit texte, ce qu'un
  // écran court tait à l'œil.
  const CAS: { nom: string; dit: string; login: string; sansDivin?: boolean }[] = [
    { nom: 'lea', dit: 'Léa, classée', login: 'lea' },
    { nom: 'sans-divin', dit: 'Léa, aucun Divin descendu', login: 'lea', sansDivin: true },
    { nom: 'nouveau', dit: 'Noé, pas encore classé', login: 'noe' },
  ]
  const ecransMesures: readonly Ecran[] = encoche ? [[390, 844]] : SIX_ECRANS
  const premiersEcrans = CAS.flatMap(cas => ecransMesures.map(ecran => ({ cas, ecran, n: `25-${cas.nom}-${ecran[0]}x${ecran[1]}${encoche ? '-encoche' : ''}` }))).filter(e => retenu(e.n))
  if (premiersEcrans.length > 0) {
    // Un nouveau venu, inscrit après le relevé de tous et les photos d'avant, qui n'en disent rien : il n'a rien à
    // classer, sa page n'a pas de fiche de lui — « Pas encore au classement » dans chaque catégorie, sans avatar.
    cookies.noe = await inscrireProfil(banc.url, 'noe', 'Noé', '🚀')
    const CERCLES: [string, string][] = [['Tous', 'tous'], ['Mes amis', 'amis']]
    const PUCES: [string, string][] = [['Collection', 'collection'], ['Niveau', 'niveau'], ['Maîtres', 'maitres'], ['Cabinet', 'cabinet'], ['Légendaires', 'legendaires'], ['Scellés', 'scelles'], ['Éclats', 'eclats']]
    type Boite = { haut: number; bas: number }
    type Vue = {
      pli: number
      page: number
      large: number
      choisis: string[]
      retour: Boite | null
      titre: Boite | null
      lignesDuTitre: number
      place: Boite | null
      saPlace: string[]
      divins: Boite | null
      tete: Boite | null
      puces: Boite | null
      rangeesDePuces: number
      podium: Boite | null
      pastilles: Boite | null
      lignes: Boite[]
      tu: { surtitre: string | null; qui: string | null }
      coupes: string[]
      etroites: string[]
      petits: string[]
    }
    const ecart = (xs: (number | undefined)[]) => {
      const vus = xs.filter((x): x is number => x !== undefined)
      return vus.length ? Math.max(...vus) - Math.min(...vus) : 0
    }
    const haut = (b: Boite | null) => (b ? b.bas - b.haut : 0)
    const releve: Record<string, unknown> = {}
    for (const { cas, ecran: [largeur, hauteur], n } of premiersEcrans) {
      const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
      const [cle, jeton] = cookies[cas.login].split('=')
      await ctx.addCookies([{ name: cle, value: jeton, url: banc.url }])
      const p = await ctx.newPage()
      p.on('pageerror', (e: Error) => console.error('[page]', e.message))
      if (encoche) {
        const cdp = await ctx.newCDPSession(p)
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
      }
      // Aucun Divin descendu : la réponse du classement réécrite en route — leur bandeau n'a plus que des voiles, et
      // personne ne porte d'opale. Sa hauteur ne doit pas en dépendre.
      if (cas.sansDivin) {
        await p.route(/\/api\/collectionneurs$/, async (route: any) => {
          const reponse = await route.fetch()
          const j = await reponse.json()
          j.divins = []
          for (const f of j.fiches) {
            f.divins = []
            if (typeof f.legendaire === 'string' && f.legendaire.startsWith('dv:')) f.legendaire = null
          }
          await route.fulfill({ response: reponse, json: j })
        })
      }
      await p.goto(`${banc.url}/collectionneurs`)
      await p.waitForSelector('.cl-sa-place')
      if (theme) await p.evaluate(`document.documentElement.dataset.theme = '${theme}'`)
      await p.waitForLoadState('networkidle').catch(() => {})
      await p.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
      await p.waitForTimeout(700)
      // Par un clic écrit dans la page, pas un toucher de Playwright : il ferait défiler la page pour amener la puce à
      // l'écran, et la mesure se prend page en haut.
      const choisir = (onglet: string) =>
        p.evaluate(`(() => { const o = [...document.querySelectorAll('.cl-page [role=tab]')].find(x => x.textContent.trim() === ${JSON.stringify(onglet)}); if (!o) throw new Error('pas d’onglet « ' + ${JSON.stringify(onglet)} + ' »'); o.click() })()`)
      /** Une vue choisie, mesurée une fois que la page la montre : relue jusque-là, jamais derrière une pause fixe — une machine chargée la ferait mentir. */
      const montrer = async (cercle: string, puce: string): Promise<Vue> => {
        await choisir(cercle)
        await choisir(puce)
        for (let essai = 0; ; essai++) {
          await p.waitForTimeout(40)
          const m = (await p.evaluate(LE_PREMIER_ECRAN)) as Vue
          if (m.choisis.join(' · ') === `${cercle} · ${puce}`) return m
          if (essai >= 75) throw new Error(`${n} : la page montre « ${m.choisis.join(' · ')} », pas « ${cercle} · ${puce} »`)
        }
      }
      const vues: (Vue & { cercle: string; puce: string })[] = []
      for (const [cercle, c] of CERCLES) {
        for (const [puce, x] of PUCES) {
          vues.push({ ...(await montrer(cercle, puce)), cercle, puce })
          // Chaque vue du premier écran, pour l'œil : sur le petit téléphone et sur un iPhone d'aujourd'hui.
          if (cas.nom === 'lea' && ((largeur === 360 && hauteur === 640) || (largeur === 390 && hauteur === 844)) && !(c === 'tous' && x === 'collection')) {
            await p.screenshot({ path: path.join(sortie, `${n}-${c}-${x}.png`) })
          }
        }
      }
      await montrer('Tous', 'Collection')
      const cibles = (await p.evaluate(LES_CIBLES)) as Record<string, number>
      await p.waitForTimeout(150)
      await p.screenshot({ path: path.join(sortie, `${n}.png`) })
      const [d] = vues
      if (d.page > hauteur) {
        // La page entière, à cette taille d'écran — pas dans un écran aussi haut qu'elle, où les pas de hauteur de sa
        // feuille la montreraient au large — : la barre du menu, fixe, se poserait au milieu, elle s'efface, et un
        // trait marque le pli.
        await p.addStyleTag({ content: '.menu-barre { display: none !important; }' })
        await p.evaluate(
          `(() => { const trait = document.createElement('div'); trait.style.cssText = 'position: absolute; z-index: 99; top: ${d.pli}px; left: 0; right: 0; border-top: 2px dashed #ff5a5a; pointer-events: none'; document.body.appendChild(trait) })()`,
        )
        await p.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
      }
      await ctx.close()

      // Ce qui est au-dessus du podium ne dépend pas de la vue ; le podium et la liste, quand il y en a, non plus.
      const blocs = ['retour', 'titre', 'place', 'divins', 'tete', 'puces'] as const
      const avecPodium = vues.filter(v => v.podium)
      const deplaces = [
        ...blocs.map(b => [b, Math.max(ecart(vues.map(v => v[b]?.haut)), ecart(vues.map(v => v[b]?.bas)))] as const),
        ['podium', Math.max(ecart(avecPodium.map(v => v.podium?.haut)), ecart(avecPodium.map(v => v.podium?.bas)))] as const,
        ['liste', ecart(avecPodium.map(v => v.lignes[0]?.haut))] as const,
      ].filter(([, de]) => de > 0)
      const podium = avecPodium.length ? Math.max(...avecPodium.map(v => v.podium!.bas)) : null
      const pastilles = Math.max(0, ...vues.map(v => v.pastilles?.bas ?? 0))
      const larges = vues.filter(v => v.large > 0)
      const petits = [...new Set(vues.flatMap(v => v.petits))]
      const coupes = [...new Set(vues.flatMap(v => v.coupes))]
      const etroites = [...new Set(vues.flatMap(v => v.etroites))]
      const tus = [...new Set([...vues.flatMap(v => (v.tu.surtitre ? [v.tu.surtitre] : [])), ...vues.flatMap(v => (v.tu.qui ? [`${v.tu.qui} (${v.cercle} · ${v.puce})`] : []))])]
      const basses = Object.entries(cibles).filter(([, de]) => de < 44)
      const entieres = d.lignes.filter(l => l.bas <= d.pli).length
      const sous = podium === null ? 0 : podium - d.pli
      // Ce qui doit tenir : le podium au-dessus du menu, rien qui change de place d'une vue à l'autre, pas un geste
      // plus bas qu'un doigt, pas un texte sous le plancher, pas une puce plus étroite que son nom, rien de côté.
      const rateIci = sous > 0 || deplaces.length > 0 || larges.length > 0 || petits.length > 0 || basses.length > 0 || etroites.length > 0
      if (rateIci) rate++
      const laListe = !d.lignes[0]
        ? 'pas de liste'
        : entieres > 0
          ? `${entieres} ligne${entieres > 1 ? 's' : ''} de la liste entière${entieres > 1 ? 's' : ''}`
          : d.lignes[0].haut < d.pli
            ? `la première ligne de la liste se voit sur ${d.pli - d.lignes[0].haut} px de ses ${haut(d.lignes[0])}`
            : `la liste commence ${d.lignes[0].haut - d.pli} px sous le menu`
      const verdict =
        podium === null
          ? `pas de podium — les puces finissent à ${d.puces?.bas}, le pli à ${d.pli}`
          : sous > 0
            ? `LE PODIUM PASSE DE ${sous} PX SOUS LE MENU`
            : `le podium tient, ${-sous} px au-dessus du menu${pastilles > d.pli ? ` (une pastille de Divin ${pastilles - d.pli} px dessous)` : ''} · ${laListe}`
      const ligne = `${n} (${cas.dit}) — ${verdict}`
      mesures.push(ligne)
      console.log(ligne)
      console.log(
        `   où finit chaque bloc, le pli à ${d.pli} : « ← Mon profil » ${d.retour?.bas} · le titre ${d.titre?.bas} (${d.lignesDuTitre} ligne${d.lignesDuTitre > 1 ? 's' : ''}) · sa place ${d.place?.bas} · les Divins ${d.divins?.bas} · « Le classement » ${d.tete?.bas} · les puces ${d.puces?.bas} (${d.rangeesDePuces} rangées)${podium === null ? '' : ` · le podium ${podium}`}${d.lignes[0] ? ` · la première ligne ${d.lignes[0].bas}` : ''} · la page ${d.page}`,
      )
      console.log(`   leur hauteur : sa place ${haut(d.place)} · les Divins ${haut(d.divins)} · les puces ${haut(d.puces)}${d.podium ? ` · le podium ${haut(d.podium)}` : ''}${d.lignes[0] ? ` · une ligne ${haut(d.lignes[0])}` : ''}`)
      // La mesure s'arrête à 40 px de part et d'autre du milieu : au-delà de 80, un geste est simplement « haut ».
      console.log(`   ce que le doigt touche, en hauteur : ${Object.entries(cibles).map(([quoi, de]) => `${quoi} ${de > 80 ? 'plus de 80' : de}`).join(' · ')}`)
      if (tus.length) console.log(`   tu à l’œil, dit à l’oreille : ${tus.join(' ; ')}`)
      if (coupes.length) console.log(`   coupé au bout : ${coupes.join(' ; ')}`)
      if (deplaces.length) console.log(`   ÇA BOUGE d’une vue à l’autre : ${deplaces.map(([quoi, de]) => `${quoi} de ${de} px`).join(', ')}`)
      if (larges.length) console.log(`   DÉBORDE EN LARGEUR de ${Math.max(...larges.map(v => v.large))} px (${larges.map(v => `${v.cercle} · ${v.puce}`).join(', ')})`)
      if (basses.length) console.log(`   UNE CIBLE SOUS 44 PX : ${basses.map(([quoi, de]) => `${quoi} ${de}`).join(', ')}`)
      if (etroites.length) console.log(`   UNE PUCE PLUS ÉTROITE QUE SON NOM : ${etroites.join(' ; ')}`)
      if (petits.length) console.log(`   UN TEXTE SOUS LE PLANCHER : ${petits.join(' ; ')}`)
      releve[n] = { cas: cas.nom, ecran: [largeur, hauteur], pli: d.pli, podium, pastilles: pastilles || null, sous, entieres, deplaces, cibles, tus, petits, coupes, etroites, vues }
    }
    writeFileSync(path.join(sortie, 'ce-qui-tient.json'), JSON.stringify(releve, null, 2))
  }
  writeFileSync(path.join(sortie, 'mesures.txt'), mesures.join('\n') + '\n')
  console.log(`\n${mesures.length} états photographiés dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) {
    console.log(`${rate} état${rate > 1 ? 's' : ''} où le premier écran ne tient pas ce qu’il doit`)
    process.exitCode = 1
  }
} finally {
  await navigateur.close()
  await banc.close()
}

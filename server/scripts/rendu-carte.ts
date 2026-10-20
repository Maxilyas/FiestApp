// La carte d'un joueur dans tous ses états, au téléphone, sur un serveur
// jetable : la carte à collectionner (le choix du propriétaire du 20 octobre
// 2026, `retours/2026-10-20/carte-du-joueur/`) — en soirée, son dos, son
// avatar et son compagnon en grand ; sa propre carte, sans compagnon, une
// débutante et son jeune chat, un invité sans profil, sous Ivoire, sur deux
// fonds de carte (la Nuit étoilée, le Théâtre et son lambrequin) ; le cadre de
// chaque ligue des duels, et sans ligue ; un nom, un titre et un compagnon
// aussi longs qu'ils peuvent l'être. Chaque photo dit si la carte défile, et
// de combien.
//
// Léa est une habituée : niveau 23, le Phénix porté, « L'Oracle » en titre —
// et Nox, son loup des étoiles, dont la niche a passé trois paliers. Son
// compagnon, sa niche, son avatar et son titre viennent du serveur ; ce que
// seuls des mois de soirées lui donneraient — ses chiffres, ses écussons, ses
// légendaires, sa vitrine, sa bordure, ses duels, sa soirée de ce soir — est
// posé à la volée sur la carte qu'il rend (`page.route`) : c'est le vrai code
// de la carte qui la dessine.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-carte.ts ../export/rendu-carte [soiree,cadre,…]
//
// Le second argument ne photographie que les états dont le nom contient l'un
// de ses mots (`loge` : l'aperçu de la loge). `ECRAN=390x844` pour un autre
// téléphone (360 × 640 sinon).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { hautFait, palierDe, titreDePalier } from '../../shared/hautsfaits'
import { LIGUES } from '../../shared/duels'

const ici = path.dirname(fileURLToPath(import.meta.url))
const Database = createRequire(path.join(ici, '..', 'package.json'))('better-sqlite3')
const sortie = path.resolve(process.argv[2] ?? 'rendu-carte')
const seulement = process.argv[3]?.split(',')
const retenu = (nom: string) => !seulement || seulement.some(mot => nom.includes(mot))
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** Un haut fait de la vitrine, tel que l'étagère le range : son emoji et son nom. */
function badge(cle: string, fois = 1) {
  const palier = palierDe(cle)
  const h = palier ? palier.hautFait : hautFait(cle)!
  return { key: cle, emoji: h.emoji, title: palier ? titreDePalier(palier.hautFait, palier.palier) : h.title, fois, dernier: 1, porteurs: 0, rarete: null }
}

/** Sa soirée de ce soir, comme la salle l'ouvre en touchant son nom : troisième sur douze. */
const CE_SOIR = { points: 2450, rang: 3, joueurs: 12, reponses: 14, qcm: 11, justes: 8, estimations: 3, coupDOeil: 0.67 }

/** Ce que des mois de soirées lui ont donné, posé sur la carte que rend le serveur — son compagnon, son avatar et son titre restent les siens. */
function habituee(lue: any, ligue = 'or') {
  return {
    ...lue,
    finition: 'or',
    bordure: { ligue, crans: 7 },
    profil: {
      ...lue.profil,
      legendaires: ['lg:phenix', 'lg:licorne', 'lg:dragon', 'lg:chouette'],
      divins: [],
      vitrine: [badge('hf:grand-chelem'), badge('hf:phenix', 2), badge('hf:oracle')],
      hautsFaits: 17,
      jour: { joues: 46, victoires: 3 },
      duels: { ligue, cote: 1262 },
      campagne: { record: 31, justes: 840, paliers: 12 },
      ecussons: [
        { categorie: 'Histoire', palier: 3 },
        { categorie: 'Cinéma & séries', palier: 2 },
        { categorie: 'Musique', palier: 2 },
      ],
      prix: { eus: 7, total: lue.profil.prix?.total ?? 14 },
      fiche: { soirees: 23, precision: 0.71, qcm: 412, justes: 293, coupDOeil: 0.64, estimationsComparees: 58, reflexeMoyenMs: 4200, quizGagnes: 9, meilleureSerie: 11 },
    },
  }
}

interface Etat {
  nom: string
  /** La carte montrée, d'après celle que rend le serveur. */
  carte: (lue: any) => any
  theme?: string
  /** Pas de compagnon à attendre. */
  sansCompagnon?: boolean
  /** Ce qui se touche, une photo chacun : le dos, le compagnon, l'avatar. */
  gestes?: readonly ('dos' | 'compagnon' | 'avatar')[]
  /** La carte seule, sans la page autour : pour comparer les cadres. */
  seule?: boolean
}

const avecCeSoir = (c: any) => ({ ...c, ceSoir: CE_SOIR })

const ETATS: readonly Etat[] = [
  { nom: '1-soiree', carte: lue => avecCeSoir(habituee(lue)), gestes: ['dos', 'compagnon', 'avatar'] },
  { nom: '2-sa-carte', carte: habituee, gestes: ['dos'] },
  {
    nom: '3-sans-compagnon',
    sansCompagnon: true,
    carte: lue => {
      const c = habituee(lue)
      delete c.profil.compagnon
      return avecCeSoir(c)
    },
  },
  // Une débutante : son emoji, deux soirées, son jeune chat sans nom ni ornement, aucun duel.
  {
    nom: '4-debutante',
    gestes: ['dos'],
    carte: lue => ({
      ...lue,
      legendaire: undefined,
      finition: 'argent',
      bordure: undefined,
      ceSoir: { ...CE_SOIR, rang: 7, points: 980, justes: 5 },
      profil: {
        ...lue.profil,
        niveau: 4,
        titre: undefined,
        legendaires: [],
        divins: [],
        vitrine: [badge('hf:double')],
        hautsFaits: 1,
        jour: { joues: 3, victoires: 0 },
        duels: undefined,
        campagne: undefined,
        ecussons: [],
        prix: { eus: 1, total: lue.profil.prix?.total ?? 14 },
        fiche: { soirees: 2, precision: 0.55, qcm: 22, justes: 12, coupDOeil: 0.4, estimationsComparees: 5, reflexeMoyenMs: 6100, quizGagnes: 0, meilleureSerie: 3 },
        compagnon: { compagnon: 'chat', rang: 1 },
      },
    }),
  },
  // Un invité sans profil : sa soirée, et rien qui dise ce qui lui manque (invariant 8).
  { nom: '5-anonyme', sansCompagnon: true, carte: () => ({ nom: 'Tom', avatar: '🐼', ceSoir: { ...CE_SOIR, rang: 5, points: 1720, justes: 6, coupDOeil: 0.5 } }) },
  { nom: '6-ivoire', theme: 'ivoire', carte: lue => avecCeSoir(habituee(lue)), gestes: ['dos'] },
  { nom: '7-fond-nuit', carte: lue => avecCeSoir({ ...habituee(lue), profil: { ...habituee(lue).profil, fond: 'nuit' } }) },
  { nom: '7-fond-theatre', carte: lue => ({ ...habituee(lue), profil: { ...habituee(lue).profil, fond: 'theatre' } }) },
  // Le cadre de chaque ligue, et sans ligue — la carte seule, côte à côte sur la planche.
  ...LIGUES.map(l => ({ nom: `8-cadre-${l.cle}`, seule: true, carte: (lue: any) => avecCeSoir(habituee(lue, l.cle)) })),
  {
    nom: '8-cadre-sans-ligue',
    seule: true,
    carte: (lue: any) => {
      const c = habituee(lue)
      return avecCeSoir({ ...c, bordure: undefined, profil: { ...c.profil, duels: undefined } })
    },
  },
  // Tout au plus long : un prénom de vingt caractères surnommé ce soir, un long titre, un compagnon nommé de seize.
  {
    nom: '9-au-plus-long',
    carte: lue => {
      const c = habituee(lue, 'maitre')
      return {
        ...c,
        nom: 'Marie-Bérénice (2)',
        laurier: 3,
        ceSoir: CE_SOIR,
        profil: { ...c.profil, prenom: 'Marie-Bérénice', titre: 'hf:grand-chelem', compagnon: { ...c.profil.compagnon, nom: 'Capitaine Moustac' } },
      }
    },
  },
]

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: string[] = []

try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(id, xpDuNiveau(23), JSON.stringify({ v: VERSION_BAREME }))
  db.prepare('UPDATE profiles SET xp = ?, niche = ? WHERE id = ?').run(xpDuNiveau(23), 'loup', id)
  // Le Phénix (son légendaire) et L'Oracle (son titre), sur son étagère comme une clôture les range.
  const etagere = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', '', ?, ?, 1)`)
  for (const cle of ['hf:phenix', 'hf:oracle', 'hf:grand-chelem']) {
    const b = badge(cle)
    etagere.run(id, cle, b.emoji, b.title)
  }
  // Nox, son loup des étoiles, trois paliers passés.
  db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at, nom, paliers) VALUES (?, ?, 1000, ?, 1, ?, ?)').run(id, 'loup', 3, 'Nox', 3)
  db.close()
  await banc.redemarrer()
  const porter = (corps: object) => ecrire(banc.url, '/api/joueur/moi', corps, cookie, 'PUT')
  if (!(await porter({ legendaire: 'lg:phenix', titre: 'hf:oracle' })).ok) throw new Error('le Phénix et L’Oracle refusés')

  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const [nom, valeur] = cookie.split('=')
  await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  let etat: Etat = ETATS[0]
  await page.route('**/api/joueur/carte', async (route: any) => {
    const reponse = await route.fetch()
    await route.fulfill({ response: reponse, json: etat.carte(await reponse.json()) })
  })
  const ouvrir = async () => {
    await page.goto('about:blank')
    await page.goto(`${banc.url}/profil`)
    await page.waitForSelector('.profil-boutons .gros-compte')
    await page.click('button.identite-ligne')
    await page.waitForSelector('.carte-joueur .carte-tete')
    if (!etat.sansCompagnon) await page.waitForSelector('.carte-joueur .carte-compagnon .niche-bete img', { timeout: 8000 }).catch(() => console.error(`[${etat.nom}] pas de compagnon`))
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.waitForTimeout(700)
  }
  // Ce que la face montrée laisse à défiler, et ce qui sort de l'écran.
  const mesurer = (): Promise<string> =>
    page.evaluate(`(() => {
      const face = [...document.querySelectorAll('.carte-joueur .carte-face')].find(f => !f.inert)
      const d = face && face.querySelector('.carte-defile')
      if (!d) return '(pas de face)'
      const boite = document.querySelector('.carte-joueur').getBoundingClientRect()
      const croix = document.querySelector('.carte-croix').getBoundingClientRect()
      const defile = d.scrollHeight > d.clientHeight + 1 ? 'défile de ' + (d.scrollHeight - d.clientHeight) + ' px' : 'tient en entier'
      return 'face ' + d.clientHeight + ' px, ' + defile + ' · carte ' + Math.round(boite.top) + '→' + Math.round(boite.bottom) + ' · croix ' + (croix.bottom <= innerHeight ? 'en vue' : 'HORS DE L’ÉCRAN') + (document.documentElement.scrollWidth > innerWidth ? ' · DÉBORDE EN LARGEUR' : '')
    })()`)
  const photo = async (fichier: string) => {
    const vu = await mesurer()
    mesures.push(`${fichier} : ${vu}`)
    console.log(`${fichier} : ${vu}`)
    if (etat.seule) {
      const r = await page.locator('.carte-joueur').boundingBox()
      await page.screenshot({ path: path.join(sortie, `${fichier}.png`), clip: { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(largeur, r.width + 16), height: r.height + 16 } })
    } else await page.screenshot({ path: path.join(sortie, `${fichier}.png`) })
  }
  for (const e of ETATS.filter(e => retenu(e.nom))) {
    etat = e
    if (e.theme) await porter({ theme: e.theme })
    await ouvrir()
    await photo(e.nom)
    for (const geste of e.gestes ?? []) {
      await ouvrir()
      await page.click(geste === 'dos' ? '.carte-retourner' : geste === 'compagnon' ? '.carte-compagnon' : '.carte-avatar-bouton')
      await page.waitForTimeout(geste === 'dos' ? 400 : 900)
      await photo(`${e.nom}-${geste}`)
    }
    if (e.theme) await porter({ theme: null })
  }
  // L'aperçu de la loge : « Aperçu de ta carte » au-dessus, « Porter » au pied — un essai en cours.
  etat = { nom: '10-loge-apercu', carte: lue => avecCeSoir(habituee(lue)) }
  if (retenu(etat.nom)) {
    await page.goto('about:blank')
    await page.goto(`${banc.url}/profil#titre`)
    await page.waitForSelector('.loge-panneau')
    await page.locator('.loge-panneau button', { hasText: 'Aucun' }).first().click()
    await page.click('.loge-carte-ouvrir')
    await page.waitForSelector('.carte-joueur .carte-tete')
    await page.waitForSelector('.carte-joueur .carte-compagnon .niche-bete img', { timeout: 8000 }).catch(() => console.error('[loge] pas de compagnon'))
    await page.waitForTimeout(700)
    await photo(etat.nom)
  }
  writeFileSync(path.join(sortie, 'mesures.txt'), mesures.join('\n') + '\n')
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)

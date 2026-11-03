// Le tournage de la vidéo de promotion : les écrans de l'application, filmés
// sur de vrais serveurs jetables (`server/test/banc.ts`) par de vrais
// navigateurs, tels qu'un invité et une joueuse les voient — jamais une
// maquette. Le montage (`montage.ts`) ne fait que les poser, les enchaîner
// et les légender : un écran qui change dans l'application change dans la
// vidéo au tournage suivant.
//
// Deux temps, deux serveurs :
// - la soirée, sans compte : l'écran commun en 1920 × 1080 et le téléphone de
//   Nina, qui entre par les trois gros boutons — « Jouer sans compte », son
//   prénom, son équipe —, répond, gagne ;
// - entre deux soirées, Léa et son profil : l'accueil sous plusieurs thèmes, le
//   quiz du jour joué jusqu'au bout, le défi de la semaine, la campagne, les
//   sentiers, le Cabinet de curiosités et sa carte en relief, la loge et sa
//   carte de joueuse — son loup dans sa niche, au coin de chaque page.
//
// Chaque prise est une photo (`plans/<nom>.png`) ; quand le geste suivant est
// un toucher, la photo retient où il tombe (`toucher`, en pixels CSS de
// l'écran), pour que le montage pose le doigt au bon endroit. Le tout est
// décrit dans `plans.json`, que le montage lit.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  type Banc,
  type Invite,
} from '../../test/banc'
import { ProfileStore, VERSION_BAREME } from '../../src/auth/profiles'
import { xpDuNiveau } from '../../../shared/profil'
import { brancheDe, portrait } from '../../../shared/branches'
import type { CleDeLigue } from '../../../shared/duels'
import { THEMES } from '../../../shared/themes'
import { ecrireDesDuels } from '../duelsDEssai'

/** Une boîte à l'écran, en pixels CSS de la page (pas de l'image, deux fois plus grande au téléphone). */
export interface Boite {
  x: number
  y: number
  l: number
  h: number
}

/** Une prise : sa photo, l'écran qu'elle montre, et le toucher qui mène à la suivante. */
export interface Prise {
  fichier: string
  /** La largeur et la hauteur de l'écran, en pixels CSS — la photo en a deux fois plus au téléphone. */
  largeur: number
  hauteur: number
  toucher?: Boite
  /** Ce que la prise montre, en mots, quand le montage le dit à l'écran : le nom d'un thème. */
  legende?: string
  /** La hauteur de la page entière, quand la photo la prend toute : le montage la fait défiler dans l'écran. */
  hauteurPleine?: number
}

export type Plans = Record<string, Prise>

/**
 * Les thèmes sous lesquels l'accueil de Léa se photographie, dans l'ordre du
 * montage : le Velours d'abord, celui qu'elle garde, puis des achetés et deux
 * peints, qui se gagnent (le Sommet, une série de vingt en campagne ; le Ciel,
 * trente jours d'affilée au quiz du jour). Le montage leur partage deux
 * secondes et demie : un de plus, et chacun passe plus vite.
 */
export const THEMES_FILMES = ['velours', 'cosmos', 'jungle', 'theatre', 'sommet', 'neon', 'ciel'] as const

/**
 * L'adresse que l'écran commun affiche sous son QR : celle d'un PC chez soi,
 * comme le serveur la trouve tout seul sur un réseau local (`PUBLIC_URL`,
 * `docs/reference/configuration.md`). Le banc aurait montré son adresse de test
 * et un port tiré au hasard ; aucune adresse publique réelle n'est inventée ici.
 */
export const ADRESSE_AFFICHEE = 'http://192.168.1.20:3001'

// L'Éclat est un tirage : rien ne doit éclater au milieu d'une prise.
ProfileStore.tirageEclat = () => false

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}

/**
 * Attend les polices et les images que l'écran montre : un décodage d'image est
 * asynchrone, et une photo prise trop tôt montrait un médaillon vide. En texte,
 * comme les autres rendus : `tsx` glisserait des `__name` dans une fonction
 * nommée, que la page ne connaît pas.
 */
const IMAGES_PRETES = `(async () => {
  await document.fonts.ready
  const vues = [...document.images].filter(i => {
    const r = i.getBoundingClientRect()
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight
  })
  await Promise.race([
    Promise.all(vues.map(i => (i.complete && i.naturalWidth ? null : i.decode().catch(() => null)))),
    new Promise(r => setTimeout(r, 3000)),
  ])
  return true
})()`

/**
 * La page entière : ses images paresseuses passent en « eager » et se décodent
 * toutes — loin sous l'écran, Chromium ne les demande jamais, et la photo de la
 * page entière montrait des cases vides (règle `tablee.md`).
 */
const TOUTES_LES_IMAGES_PRETES = `(async () => {
  await document.fonts.ready
  for (const i of document.images) i.loading = 'eager'
  await Promise.race([
    Promise.all([...document.images].map(i => (i.complete && i.naturalWidth ? null : i.decode().catch(() => null)))),
    new Promise(r => setTimeout(r, 4000)),
  ])
  return document.documentElement.scrollHeight
})()`

const TELEPHONE = { width: 390, height: 844 }
const TELE = { width: 1920, height: 1080 }

export async function tourner(dossier: string, journal: (ligne: string) => void = console.log): Promise<Plans> {
  const dossierDesPlans = path.join(dossier, 'plans')
  mkdirSync(dossierDesPlans, { recursive: true })
  const plans: Plans = {}
  const { chromium } = chargerPlaywright()
  // La carte du Cabinet est en 3D : sans écran, Chromium la rend par SwiftShader (`rendu-traversee.ts`).
  const navigateur = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })

  /** Une prise : la photo de l'écran, et, s'il y a lieu, où tombera le toucher suivant. */
  async function photo(page: any, nom: string, opts: { toucher?: any; attente?: number; legende?: string; pleine?: boolean } = {}) {
    await page.waitForTimeout(opts.attente ?? 700)
    const hauteurPleine = opts.pleine ? Number(await page.evaluate(TOUTES_LES_IMAGES_PRETES)) : 0
    if (!opts.pleine) await page.evaluate(IMAGES_PRETES).catch(() => null)
    // Le contour de focus qu'un titre garde pour le lecteur d'écran ne se filme pas.
    await page.evaluate('document.activeElement?.blur?.()')
    const fichier = `${nom}.png`
    await page.screenshot({ path: path.join(dossierDesPlans, fichier), fullPage: !!opts.pleine })
    const ecran = page.viewportSize()
    const prise: Prise = {
      fichier,
      largeur: ecran.width,
      hauteur: ecran.height,
      ...(opts.legende && { legende: opts.legende }),
      ...(hauteurPleine > ecran.height && { hauteurPleine }),
    }
    if (opts.toucher) {
      const b = await opts.toucher.boundingBox()
      if (!b) throw new Error(`${nom} : ce qu'on va toucher n'est pas à l'écran`)
      prise.toucher = { x: Math.round(b.x), y: Math.round(b.y), l: Math.round(b.width), h: Math.round(b.height) }
    }
    plans[nom] = prise
    journal(`  ${nom}`)
  }

  try {
    await soiree(navigateur, photo, journal)
    await entreDeuxSoirees(navigateur, photo, journal)
  } finally {
    await navigateur.close()
  }
  writeFileSync(path.join(dossier, 'plans.json'), JSON.stringify(plans, null, 2))
  return plans
}

type Photo = (page: any, nom: string, opts?: { toucher?: any; attente?: number; legende?: string; pleine?: boolean }) => Promise<void>

// ── La soirée, sans compte ─────────────────────────────────────────────────

/**
 * Un quiz de culture générale, dix amis dont six profils qui portent ce qu'ils
 * ont gagné (la recette de `rendu-vitrine.ts`), trois équipes — et Nina, qui
 * arrive par le QR sans rien : les trois gros boutons, son prénom, son équipe.
 */
async function soiree(navigateur: any, photo: Photo, journal: (l: string) => void) {
  journal('La soirée, sans compte')
  const banc = await demarrer({ publicUrl: ADRESSE_AFFICHEE })
  try {
    const url = banc.url
    const cookie = await connexionAnimateur(url)

    // Deux images dessinées ici : aucune photo sous droits.
    async function dessiner(svg: string): Promise<string> {
      const atelier = await navigateur.newPage({ viewport: { width: 800, height: 600 } })
      await atelier.setContent(`<body style="margin:0">${svg}</body>`)
      const jpeg: Buffer = await atelier.screenshot({ type: 'jpeg', quality: 85 })
      await atelier.close()
      const envoi = await ecrire(url, '/api/images', { dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}` }, cookie)
      return ((await envoi.json()) as { url: string }).url
    }
    const planete = await dessiner(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="800" height="600" fill="#140f1f"/>
      ${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 137) % 800}" cy="${(i * 89) % 600}" r="${(i % 3) + 1}" fill="#f3ece2" opacity="${0.3 + (i % 5) / 10}"/>`).join('')}
      <circle cx="400" cy="300" r="190" fill="#c1440e"/>
      <circle cx="340" cy="250" r="40" fill="#a3380b" opacity=".7"/><circle cx="470" cy="360" r="55" fill="#a3380b" opacity=".6"/>
      <circle cx="455" cy="215" r="22" fill="#d9692f" opacity=".8"/><ellipse cx="400" cy="140" rx="70" ry="18" fill="#f3ece2" opacity=".85"/>
    </svg>`)

    const packId = await creerQuiz(
      url,
      cookie,
      [
        { kind: 'choice', text: 'Quelle planète surnomme-t-on la planète rouge ?', answers: ['Vénus', 'Mars', 'Jupiter', 'Saturne'], correct: 1, duration: 30, image: planete },
        { kind: 'number', text: 'Combien de pays compte l’Union européenne ?', target: 27, unit: 'pays', duration: 30, image: null, answers: [], correct: 0 },
        { kind: 'choice', text: 'Le cœur d’une crevette se trouve dans sa tête.', answers: ['Vrai', 'Faux'], correct: 0, duration: 20, image: null },
        { kind: 'choice', text: 'Combien de cordes compte un violon ?', answers: ['Trois', 'Quatre', 'Cinq', 'Six'], correct: 1, duration: 20, image: null },
        { kind: 'choice', text: 'Qui a peint « La Nuit étoilée » ?', answers: ['Claude Monet', 'Vincent van Gogh', 'Paul Cézanne', 'Edgar Degas'], correct: 1, duration: 20, image: null },
      ],
      'Culture générale',
    )

    const AMIS = [
      ['Julie', '🦊'],
      ['Thomas', '🐼'],
      ['Inès', '🦄'],
      ['Karim', '🐙'],
      ['Emma', '🐸'],
      ['Hugo', '🦁'],
      ['Chloé', '🐨'],
      ['Malik', '🦉'],
      ['Sarah', '🐯'],
      ['Paul', '🎸'],
    ] as const
    // Les six premiers ont un profil et portent ce qu'ils ont gagné ; les quatre autres jouent sans compte.
    const profils: (string | undefined)[] = []
    for (const [i, [nom, avatar]] of AMIS.entries()) profils.push(i < 6 ? await inscrireProfil(url, `ami${i}`, nom, avatar) : undefined)
    const NIVEAUX: Record<number, number> = { 0: 25, 1: 20, 2: 15, 3: 12, 4: 9, 5: 6 }
    const MEDAILLONS: Record<number, { cle: string; ligne: string; eclat?: boolean }> = {
      1: { cle: 'lg:phenix', ligne: 'hf:phenix', eclat: true },
      3: { cle: 'dv:helios', ligne: 'dv:helios' },
    }
    const BORDURES: Record<number, [CleDeLigue, number]> = { 0: ['or', 12], 1: ['platine', 7], 2: ['diamant', 3], 4: ['argent', 9] }
    const PORTRAITS: Record<number, string> = { 0: 'br:venise', 2: 'br:danseuse' }
    {
      const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      const idDe = (i: number | string) => (base.prepare('SELECT id FROM profiles WHERE login = ?').get(`ami${i}`) as { id: string }).id
      for (const [i, niveau] of Object.entries(NIVEAUX)) {
        base
          .prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`)
          .run(idDe(i), xpDuNiveau(niveau), JSON.stringify({ v: VERSION_BAREME, niveau }))
        base.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(niveau), idDe(i))
      }
      const espace = (base.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      for (const [i, m] of Object.entries(MEDAILLONS)) {
        base
          .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, '', '', 1)`)
          .run(idDe(i), m.ligne, espace)
        if (m.eclat) base.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, 'une-soiree-d-avant', 1)`).run(idDe(i), m.cle)
      }
      for (const [i, [ligue, crans]] of Object.entries(BORDURES)) ecrireDesDuels(base, idDe(i), ligue, crans)
      for (const [i, cle] of Object.entries(PORTRAITS)) {
        base.prepare('INSERT OR REPLACE INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, 12, 1)').run(idDe(i), brancheDe(portrait(cle)!).key)
      }
      base.close()
      await banc.redemarrer()
    }
    for (const [i, cle] of Object.entries({ ...Object.fromEntries(Object.entries(MEDAILLONS).map(([i, m]) => [i, m.cle])), ...PORTRAITS })) {
      const r = await ecrire(banc.url, '/api/joueur/moi', { legendaire: cle }, profils[Number(i)], 'PUT')
      if (!r.ok) throw new Error(`${AMIS[Number(i)][0]} ne porte pas ${cle} (${r.status})`)
    }

    const host = await ecranCommun(banc.url, cookie)
    for (const [name, emoji] of [
      ['Les Flamants', '🦩'],
      ['Piment', '🌶️'],
      ['Les Étoiles filantes', '🌠'],
    ]) {
      ;(host as any).emit('host:createTeam', { name, emoji })
    }
    const equipes = (await instantane(host, s => s.teams?.length === 3, 'trois équipes')).teams.map((t: any) => t.id)
    const invites: Invite[] = []
    for (const [i, [nom, avatar]] of AMIS.entries()) {
      const inv = await invite(banc.url, nom, avatar, { cookie: profils[i] })
      invites.push(inv)
      ;(host as any).emit('host:assignPlayer', { playerId: inv.playerId, teamId: equipes[i % 3] })
    }

    // Les amis répondent seuls, chacun à son rythme, presque toujours juste — sauf Paul, qui ne répond jamais : sans
    // lui, la dernière réponse révélerait la question d'elle-même, avant la photo.
    const JUSTES = [1, 27, 0, 1, 1]
    invites.forEach((inv, i) => {
      if (i === AMIS.length - 1) return
      inv.socket.on('session:view', ({ sessionId, view }: any) => {
        if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
        const action =
          view.kind === 'number'
            ? { type: 'guess', value: [27, 28, 25, 30, 27, 24, 20, 32, 26, 35][i] }
            : { type: 'answer', choice: (i + view.qIndex) % 4 === 3 ? (JUSTES[view.qIndex] + 1) % (view.answers?.length ?? 2) : JUSTES[view.qIndex] }
        setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action }, () => {}), 900 + i * 300)
      })
    })

    const [nomCookie, valeurCookie] = cookie.split('=')
    const ctxTele = await navigateur.newContext({ viewport: TELE })
    await ctxTele.addCookies([{ name: nomCookie, value: valeurCookie, url: banc.url }])
    await ctxTele.addInitScript(() => localStorage.setItem('quizz.muted', '1'))
    const tele = await ctxTele.newPage()
    const ctxTel = await navigateur.newContext({ viewport: TELEPHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
    const telephone = await ctxTel.newPage()
    for (const p of [tele, telephone]) p.on('pageerror', (e: Error) => journal(`  [page] ${e.message}`))
    await tele.goto(`${banc.url}/host`)
    await telephone.goto(`${banc.url}/${ADMIN.slug}`)
    await patienter(2500)

    // Nina arrive par le QR, sans rien : « Jouer sans compte », son prénom, son avatar, son équipe.
    const sansCompte = telephone.getByRole('button', { name: 'Jouer sans compte' })
    await sansCompte.waitFor({ timeout: 15_000 })
    await photo(telephone, 'tel-entree', { toucher: sansCompte })
    await sansCompte.tap()
    const prenom = telephone.locator('#join-name')
    await prenom.waitFor()
    await prenom.tap()
    await prenom.pressSequentially('Nina', { delay: 60 })
    await telephone.getByRole('button', { name: 'Avatar 🌵' }).tap()
    // Le clavier fermé, comme quand on touche ailleurs : l'écran se photographie tel qu'il se lit.
    await telephone.evaluate('document.activeElement?.blur?.()')
    const continuer = telephone.locator('form.join button.btn-primary')
    await photo(telephone, 'tel-moi', { toucher: continuer })
    await continuer.tap()
    const flamants = telephone.getByRole('button', { name: /Les Flamants/ }).first()
    await flamants.waitFor({ timeout: 10_000 })
    await flamants.tap()
    const rejoindre = telephone.getByRole('button', { name: 'Rejoindre la soirée' })
    await photo(telephone, 'tel-equipe', { toucher: rejoindre })
    await rejoindre.tap()
    await patienter(2500)
    await photo(telephone, 'tel-attente')
    await photo(tele, 'tele-attente', { attente: 400 })

    let vue: any = null
    host.on('session:view', (p: any) => (vue = p))
    const phase = (ph: string, q?: number) =>
      vue?.view.phase === ph && (q === undefined || vue.view.qIndex === q)
        ? Promise.resolve(vue)
        : attendre<any>(host, 'session:view', p => p.view.phase === ph && (q === undefined || p.view.qIndex === q), `${ph} ${q ?? ''}`, 30_000)
    const suivant = () => {
      const { phase: ph, qIndex, round } = vue.view
      ;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'next', phase: ph, qIndex, round } })
    }
    await lancerQuiz(host, packId)

    /** Nina répond depuis son téléphone : un bouton, ou un nombre tapé. */
    async function ninaRepond(reponse: RegExp | string, prises?: { avant: string; apres: string }) {
      await patienter(1600)
      if (typeof reponse === 'string') {
        const champ = telephone.locator('.guess-input')
        await champ.waitFor({ state: 'visible', timeout: 10_000 })
        await champ.pressSequentially(reponse, { delay: 60 })
        await telephone.keyboard.press('Enter')
      } else {
        const bouton = telephone.getByRole('button', { name: reponse }).first()
        await bouton.waitFor({ timeout: 10_000 })
        if (prises) await photo(telephone, prises.avant, { toucher: bouton, attente: 300 })
        await bouton.tap()
      }
      await patienter(1200)
      if (prises) await photo(telephone, prises.apres, { attente: 300 })
    }

    // La planète rouge : la question à la télé et au téléphone, la réponse de Nina, la révélation.
    await phase('question', 0)
    await patienter(900)
    await photo(tele, 'tele-question', { attente: 300 })
    await ninaRepond(/Mars/, { avant: 'tel-question', apres: 'tel-repondu' })
    await patienter(2500)
    suivant()
    await phase('reveal', 0)
    await patienter(1200)
    await photo(tele, 'tele-revelation', { attente: 300 })
    await photo(telephone, 'tel-revelation', { attente: 300 })
    suivant()

    await phase('question', 1)
    await ninaRepond('27')
    await patienter(2500)
    suivant()
    await phase('reveal', 1)
    suivant()
    for (const q of [2, 3, 4]) {
      await phase('question', q)
      await ninaRepond([/Vrai/, /Quatre/, /van Gogh/][q - 2])
      await patienter(2500)
      suivant()
      await phase('reveal', q)
      suivant()
    }
    await phase('finished')
    await patienter(1500)
    ;(host as any).emit('host:endSession', { sessionId: vue.sessionId })
    await patienter(1200)
    ;(host as any).emit('host:closeParty', { title: 'Culture générale' })
    await patienter(3500)
    await photo(tele, 'tele-cloture', { attente: 300 })
    await photo(telephone, 'tel-cloture', { attente: 300 })
    host.close()
    await ctxTele.close()
    await ctxTel.close()
  } finally {
    await banc.close()
  }
}

// ── Entre deux soirées : Léa et son profil ─────────────────────────────────

/** Le texte de chaque bouton de réponse à l'écran. */
const TEXTES_DES_REPONSES = `[...document.querySelectorAll('.ans-btn .ans-text')].map(e => String(e.textContent ?? '').trim())`

/** Le bouton de la bonne réponse, reconnue à ses réponses parmi les questions tirées (le jour, une série). */
async function bonneReponse(page: any, questions: { reponses: string[]; bonne: number }[]) {
  await page.waitForSelector('.ans-btn')
  const textes: string[] = await page.evaluate(TEXTES_DES_REPONSES)
  const memes = (q: { reponses: string[] }) => q.reponses.length === textes.length && q.reponses.every(r => textes.includes(String(r).trim()))
  const q = questions.find(memes)
  if (!q) throw new Error(`question introuvable parmi les tirées : ${textes.join(' / ')}`)
  const i = textes.indexOf(String(q.reponses[q.bonne]).trim())
  return { bonne: page.locator('.ans-btn').nth(i), fausse: page.locator('.ans-btn').nth((i + 1) % textes.length) }
}

async function entreDeuxSoirees(navigateur: any, photo: Photo, journal: (l: string) => void) {
  journal('Entre deux soirées : Léa')
  // Mercredi 4 novembre 2026, 19 h à Paris — puis l'heure avance pour de vrai : le chrono d'une question en dépend.
  const horloge = { t: Date.UTC(2026, 10, 4, 18, 0) }
  const depart = Date.now()
  const maintenant = () => horloge.t + (Date.now() - depart)
  const banc = await demarrer({ horlogeDuJour: maintenant })
  const fichier = banc.quizDbUrl.replace(/^file:/, '')
  try {
    const AMIS: [string, string, string][] = [
      ['hugo', 'Hugo', '🐻'],
      ['ines', 'Inès', '🦄'],
      ['karim', 'Karim', '🐙'],
      ['chloe', 'Chloé', '🐨'],
      ['malik', 'Malik', '🦉'],
      ['sarah', 'Sarah', '🐯'],
    ]
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const cookies: Record<string, string> = {}
    for (const [login, nom, avatar] of AMIS) cookies[login] = await inscrireProfil(banc.url, login, nom, avatar)
    preparerLea(fichier, horloge.t, AMIS.map(a => a[0]))
    await banc.redemarrer()
    for (const [corps, quoi] of [
      [{ legendaire: 'lg:phenix' }, 'le Phénix'],
      [{ gerbe: 'etoiles' }, 'la pluie d’étoiles'],
    ] as const) {
      const r = await ecrire(banc.url, '/api/joueur/moi', corps, lea, 'PUT')
      if (!r.ok) throw new Error(`Léa ne porte pas ${quoi} (${r.status} ${await r.text()})`)
    }

    // Le défi de la semaine, relevé par ses amis avant elle : un classement à battre.
    for (const [k, [login]] of AMIS.entries()) await releverLeDefi(banc, fichier, cookies[login], 9 - k)
    // Le quiz du jour d'aujourd'hui, joué par ses amis avant elle : sa place se lit au bout.
    await fetch(`${banc.url}/api/jour`, { headers: { Cookie: lea, 'X-Requested-With': 'quizz' } })
    {
      const d = new Database(fichier)
      const jour = new Date(maintenant() + 3600_000).toISOString().slice(0, 10)
      const idDe = (login: string) => (d.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
      const partie = d.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`)
      AMIS.forEach(([login], k) => partie.run(idDe(login), jour, maintenant() - 3600_000, 1350 - k * 110, 8 - (k % 3), maintenant() - 3500_000))
      d.close()
    }
    await banc.redemarrer()

    const ctx = await navigateur.newContext({ viewport: TELEPHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
    const [nom, valeur] = lea.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    // Sa niche déjà touchée : la bulle « Touche-moi ! » des premières visites (`client/src/niche.ts`) ne passe pas dans le champ.
    // Sous try/catch, comme tout accès au stockage : `about:blank`, qu'on traverse entre deux pages, le refuse.
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('quizz.niche.appel', JSON.stringify({ vues: 3, touchee: true }))
      } catch {
        // Une page sans stockage n'a pas de bulle à taire.
      }
    })
    const page = await ctx.newPage()
    page.setDefaultTimeout(20_000)
    page.on('pageerror', (e: Error) => journal(`  [page] ${e.message}`))
    const ouvrir = async (adresse: string, attente = 2200) => {
      await page.goto('about:blank')
      await page.goto(`${banc.url}${adresse}`)
      await page.waitForTimeout(attente)
    }

    // L'accueil, sous les thèmes qu'on veut montrer — le Velours d'abord, celui qu'elle garde.
    for (const theme of [...THEMES_FILMES].reverse()) {
      const r = await ecrire(banc.url, '/api/joueur/moi', { theme: theme === 'velours' ? null : theme }, lea, 'PUT')
      if (!r.ok) throw new Error(`Léa ne porte pas le thème ${theme} (${r.status} ${await r.text()})`)
      await ouvrir('/', 3000)
      const legende = THEMES.find(t => t.key === theme)?.nom ?? theme
      if (theme === 'velours') {
        const carteDuJour = page.locator('#jour-defi-panneau-jour a, #jour-defi-panneau-jour button').first()
        await photo(page, 'accueil', { toucher: carteDuJour, legende })
      } else await photo(page, `theme-${theme}`, { legende })
    }

    // Le quiz du jour, joué jusqu'au bout : la page, une question, la bonne réponse, la fin.
    await ouvrir('/jour')
    const jouer = page.locator('.jour-heros .btn-primary')
    await photo(page, 'jour', { toucher: jouer })
    await jouer.tap()
    const tirage = () => {
      const d = new Database(fichier)
      try {
        const ligne = d.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }
        return JSON.parse(ligne.questions) as { reponses: string[]; bonne: number }[]
      } finally {
        d.close()
      }
    }
    const questions = tirage()
    for (let i = 0; i < 12; i++) {
      await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 30_000 })
      if (await page.locator('.fin-tete').count()) break
      const { bonne, fausse } = await bonneReponse(page, questions)
      // Le temps de lecture d'abord : la réponse ne part qu'après lui, on retouche jusqu'à ce qu'elle parte.
      if (i === 0) await photo(page, 'jour-question', { toucher: bonne, attente: 1800 })
      const cible = i === 6 ? fausse : bonne
      for (let essai = 0; essai < 30 && !(await page.locator('.result-banner').count()); essai++) {
        await cible.tap({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(350)
      }
      await page.waitForSelector('.result-banner')
      // La pluie d'étoiles de sa gerbe, puis le bandeau qu'elle découvre en retombant : le montage passe de l'une à l'autre.
      if (i === 0) {
        await photo(page, 'jour-juste', { attente: 450 })
        await photo(page, 'jour-juste-calme', { attente: 1600 })
      }
      await page.waitForTimeout(500)
      await page.locator('.btn-primary.btn-big').tap()
    }
    await page.waitForSelector('.fin-tete')
    // La page entière : le montage la fait défiler jusqu'à ce qu'elle rapporte.
    await photo(page, 'jour-fin', { attente: 2500, pleine: true })

    // Le défi de la semaine : son onglet à l'accueil, sa page et son classement, une question, sa fin.
    await ouvrir('/')
    const ongletDuDefi = page.getByRole('tab', { name: /Défi de la semaine/ })
    await photo(page, 'accueil-2', { toucher: ongletDuDefi })
    await ongletDuDefi.tap()
    await photo(page, 'accueil-defi', { toucher: page.locator('#jour-defi-panneau-defi a, #jour-defi-panneau-defi button').first(), attente: 900 })
    await ouvrir('/campagne#defi')
    await page.reload()
    await page.waitForSelector('.defi-heros')
    const relever = page.getByRole('button', { name: 'Relever le défi' })
    await photo(page, 'defi', { toucher: relever, attente: 1200 })
    await relever.tap()
    await jouerUneSerie(page, fichier, photo, 'defi', 11)
    await page.waitForSelector('.fin-tete')
    await photo(page, 'defi-fin', { attente: 2500, pleine: true })

    // La campagne : son record, une série commencée, une bonne réponse et sa gerbe ; puis les sentiers.
    await ouvrir('/campagne')
    await page.reload()
    await page.waitForTimeout(1500)
    const commencer = page.getByRole('button', { name: /Commencer une série/ })
    await photo(page, 'campagne', { toucher: commencer })
    await commencer.tap()
    await page.waitForSelector('.ans-btn')
    {
      const serie = derniereSerie(fichier)
      const { bonne } = await bonneReponse(page, serie)
      await photo(page, 'campagne-question', { toucher: bonne, attente: 900 })
      await bonne.tap()
      await page.waitForSelector('.result-banner')
      await photo(page, 'campagne-juste', { attente: 450 })
      await photo(page, 'campagne-juste-calme', { attente: 1600 })
    }
    await ouvrir('/campagne#sentiers')
    await page.reload()
    await photo(page, 'sentiers', { attente: 2200, pleine: true })

    // Le Cabinet de curiosités : l'écran-titre, les trois gardiens, le choix des cartes, la carte de l'acte en relief.
    await ouvrir('/cabinet', 3500)
    const traversee = page.getByRole('button', { name: 'Commencer une traversée' })
    await photo(page, 'cabinet-titre', { toucher: traversee })
    await traversee.tap()
    await page.waitForTimeout(2500)
    const choisir = page.getByRole('button', { name: 'Choisir mes trois cartes' })
    await photo(page, 'cabinet-gardiens', { toucher: choisir })
    await choisir.tap()
    await page.waitForTimeout(900)
    await photo(page, 'cabinet-cartes')
    for (const c of [/Coup d’œil/, /Quitte ou double/, /Cagnotte/]) {
      await page.getByRole('button', { name: c }).first().tap()
      await page.waitForTimeout(600)
      await page.getByRole('button', { name: 'Prendre cette carte' }).tap()
      await page.waitForTimeout(600)
    }
    await page.getByRole('button', { name: /^Partir/ }).tap()
    await page.waitForTimeout(4200)
    await photo(page, 'cabinet-carte', { attente: 1200 })

    // Le profil : la loge — le Phénix porté, sa finition, sa bordure d'or —, puis sa carte de joueuse.
    await ouvrir('/profil#avatar', 2600)
    await page.waitForSelector('.loge-panneau .loge-page-avatars')
    await photo(page, 'loge')
    await ouvrir('/profil', 2000)
    await page.locator('button.identite-ligne').tap()
    await page.waitForSelector('.carte-joueur .carte-tete')
    await photo(page, 'carte', { attente: 1500 })
    await ctx.close()
  } finally {
    await banc.close()
  }
}

/**
 * Léa en route : le niveau 21, le Phénix gagné et éclaté, la bordure d'or des
 * duels, deux sentiers avancés, douze jours de quiz du jour d'affilée (ses amis
 * aussi, pour un classement), un record en campagne, tous les thèmes de la
 * boutique, et son loup grandi jusqu'à sa forme ultime.
 */
function preparerLea(fichier: string, maintenant: number, amis: string[]) {
  const d = new Database(fichier)
  try {
    const idDe = (login: string) => (d.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
    const espace = (d.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const lea = idDe('lea')
    // La ligne du rattrapage, écrite une fois et jamais recalculée : la clôture des jours refait la sienne.
    d.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(
      lea,
      xpDuNiveau(21),
      JSON.stringify({ v: VERSION_BAREME, niveau: 21 }),
    )
    d.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(21), lea)
    const badge = d.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', ?, '', '', 1)`)
    for (const cle of ['hf:phenix', 'hf:sans-faute:1', 'hf:oracle']) badge.run(lea, cle, espace)
    d.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, 'lg:phenix', 'une-soiree-d-avant', 1)`).run(lea)
    ecrireDesDuels(d, lea, 'or', 9, maintenant)
    for (const [branche, paliers] of [
      ['foret', 6],
      ['mythes', 4],
      ['ocean', 2],
    ] as const) {
      d.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(lea, branche, paliers)
    }
    // Douze jours d'affilée jusqu'à hier, pour Léa et ses amis.
    const tirage = d.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const partie = d.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`)
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let j = 12; j >= 1; j--) {
      const midi = maintenant - j * 24 * 3600_000
      const jour = new Date(midi).toISOString().slice(0, 10)
      tirage.run(jour, questions)
      partie.run(lea, jour, midi, 1400 + (j % 4) * 60, 8, midi + 120_000)
      amis.forEach((login, k) => partie.run(idDe(login), jour, midi, 900 + k * 80 + (j % 3) * 50, 6 + (k % 3), midi + 120_000))
    }
    // Un record en campagne : vingt-trois bonnes réponses d'affilée.
    d.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES ('record-de-lea', ?, '[]', 26, 0, 23, 1, 2, 'serie')`).run(lea)
    // Les thèmes filmés : ceux de la boutique achetés, ceux qui se gagnent par le haut fait qui les ouvre
    // (`rendu-maintenance.ts`) — L'Alpiniste d'or pour le Sommet, L'Infatigable d'argent pour le Ciel.
    const achat = d.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
    for (const cle of THEMES_FILMES) {
      const theme = THEMES.find(t => t.key === cle)
      if (!theme) throw new Error(`le thème ${cle} n'existe plus (shared/themes.ts)`)
      if (theme.rarete !== 'offert' && !theme.gagne) achat.run(lea, cle)
    }
    for (const cle of ['hf:alpiniste:3', 'hf:infatigable:2']) badge.run(lea, cle, espace)
    // Son loup, dans sa niche, grandi de cinq cent vingt bonnes réponses en campagne jusqu'à sa forme ultime
    // (`rendu-profil.ts`) — une série qui ne compte pas pour son record, ses réponses seules nourrissent le loup.
    d.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 4, 1)').run(lea, 'loup')
    d.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', lea)
    d.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES ('avec-le-loup', ?, '[]', 520, 3, 0, 1, 2)`).run(lea)
    const reponse = d.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
    for (let i = 0; i < 520; i++) reponse.run('avec-le-loup', i, `avec-le-loup-${i}`, 'loup')
  } finally {
    d.close()
  }
}

/** Les questions de la dernière série commencée, telles que la base les garde. */
function derniereSerie(fichier: string): { reponses: string[]; bonne: number }[] {
  const d = new Database(fichier)
  try {
    const ligne = d.prepare('SELECT questions FROM campagne_series ORDER BY commencee_le DESC LIMIT 1').get() as { questions: string }
    return JSON.parse(ligne.questions)
  } finally {
    d.close()
  }
}

/** Un ami relève le défi de la semaine par l'API : `justes` bonnes réponses, puis des fautes jusqu'à sa fin. */
async function releverLeDefi(banc: Banc, fichier: string, cookie: string, justes: number) {
  const s = (await (await ecrire(banc.url, '/api/campagne/defi', {}, cookie)).json()) as { id: string }
  const d = new Database(fichier)
  const qs = JSON.parse((d.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as { questions: string }).questions)
  d.close()
  let fin = false
  for (let i = 0; !fin && i < qs.length; i++) {
    const q = qs[i]
    const r = (await (await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)).json()) as {
      finie?: boolean
    }
    fin = !!r.finie
  }
}

/** Joue la série ouverte dans la page : `justes` bonnes réponses, puis des fautes jusqu'à sa fin. Photographie la première question. */
async function jouerUneSerie(page: any, fichier: string, photo: Photo, prefixe: string, justes: number) {
  for (let i = 0; i < 60; i++) {
    await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 20_000 })
    if (await page.locator('.fin-tete').count()) return
    const { bonne, fausse } = await bonneReponse(page, derniereSerie(fichier))
    if (i === 0) await photo(page, `${prefixe}-question`, { toucher: bonne, attente: 900 })
    await (i < justes ? bonne : fausse).tap()
    await page.waitForSelector('.result-banner')
    if (i === 0) {
      await photo(page, `${prefixe}-juste`, { attente: 450 })
      await photo(page, `${prefixe}-juste-calme`, { attente: 1600 })
    }
    await page.locator('.btn-primary.btn-big').tap()
  }
  throw new Error(`${prefixe} : la série ne finit pas`)
}

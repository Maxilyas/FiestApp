// Les captures de la vitrine (`docs/vitrine/`) : une vraie soirée, rejouée sur
// un serveur jetable et photographiée comme on la montrerait à quelqu'un qui
// ne connaît pas l'application — l'écran commun en 1920 × 1080 (en Velours,
// et une fois en Ivoire), le téléphone d'un invité en 390 × 844.
//
//   npx tsx scripts/rendu-vitrine.ts [dossier]      (défaut : ../docs/vitrine/captures)
//
// `rendu-ecran.ts` photographie le pire cas, pour juger une retouche ; celui-ci
// le cas qu'on raconte : un quiz de culture générale, dix amis, trois équipes,
// des profils qui portent ce qu'ils ont gagné. Le client doit être construit.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import {
  demarrer,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  invite,
  lancerQuiz,
  attendre,
  instantane,
  ecrire,
  inscrireProfil,
  patienter,
  ADMIN,
  type Invite,
} from '../test/banc'
import { brancheDe, portrait } from '../../shared/branches'
import { xpDuNiveau } from '../../shared/profil'
import type { CleDeLigue } from '../../shared/duels'
import { VERSION_BAREME } from '../src/auth/profiles'
import { ecrireDesDuels } from './duelsDEssai'

const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, '../../docs/vitrine/captures'))
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer()
const url = banc.url
const cookie = await connexionAnimateur(url)
const navigateur = await chromium.launch({ headless: true })

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
const nature = await dessiner(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <rect width="800" height="600" fill="#2a3b4a"/><rect y="400" width="800" height="200" fill="#6b4a32"/>
  <ellipse cx="400" cy="420" rx="300" ry="50" fill="#e9e1d3"/>
  ${[250, 330, 410].map(x => `<ellipse cx="${x}" cy="385" rx="38" ry="30" fill="#f2d33a"/>`).join('')}
  ${[505, 575].map(x => `<circle cx="${x}" cy="375" r="40" fill="#c8312f"/><rect x="${x - 3}" y="325" width="6" height="18" fill="#4b3a26"/>`).join('')}
  <rect x="160" y="200" width="70" height="190" rx="20" fill="#3d6b4f"/><rect x="180" y="160" width="30" height="50" fill="#3d6b4f"/>
</svg>`)

const packId = await creerQuiz(
  url,
  cookie,
  [
    { kind: 'choice', text: 'Quelle planète surnomme-t-on la planète rouge ?', answers: ['Vénus', 'Mars', 'Jupiter', 'Saturne'], correct: 1, duration: 30, image: planete },
    { kind: 'number', text: 'Combien de pays compte l’Union européenne ?', target: 27, unit: 'pays', duration: 30, image: null, answers: [], correct: 0 },
    { kind: 'choice', text: 'Le cœur d’une crevette se trouve dans sa tête.', answers: ['Vrai', 'Faux'], correct: 0, duration: 20, image: null },
    { kind: 'choice', text: 'Combien de citrons y avait-il sur la table ?', answers: ['Deux', 'Trois', 'Quatre', 'Cinq'], correct: 1, duration: 20, image: nature, observeSeconds: 8 },
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
  ['Léa', '🐸'],
  ['Hugo', '🦁'],
  ['Chloé', '🐨'],
  ['Malik', '🦉'],
  ['Sarah', '🐯'],
  ['Paul', '🎸'],
] as const

// Les six premiers ont un profil, et portent ce qu'ils ont gagné : un niveau,
// sa finition, un médaillon peint, un portrait des sentiers, une bordure de
// ligue. Les quatre autres jouent sans compte — l'anonyme n'affiche rien.
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
      .prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`)
      .run(idDe(i), xpDuNiveau(niveau), JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
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
  const r = await ecrire(url, '/api/joueur/moi', { legendaire: cle }, profils[Number(i)], 'PUT')
  if (!r.ok) throw new Error(`${AMIS[Number(i)][0]} ne porte pas ${cle} (${r.status})`)
}

const host = await ecranCommun(url, cookie)
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
  const inv = await invite(url, nom, avatar, { cookie: profils[i] })
  invites.push(inv)
  ;(host as any).emit('host:assignPlayer', { playerId: inv.playerId, teamId: equipes[i % 3] })
}

// Le téléphone qu'on photographie : Nina, dans un vrai navigateur, son jeton
// remis comme si elle venait de s'inscrire, dans l'équipe des Flamants.
const nina = await invite(url, 'Nina', '🌵')
;(host as any).emit('host:assignPlayer', { playerId: nina.playerId, teamId: equipes[0] })
nina.socket.close()

// Les amis répondent seuls, chacun à son rythme, presque toujours juste — sauf
// Paul, qui ne répond jamais : sans lui, la dernière réponse révélerait la
// question d'elle-même, avant la photo.
const JUSTES = [1, 27, 0, 1, 1, 1]
invites.forEach((inv, i) => {
  if (i === AMIS.length - 1) return
  inv.socket.on('session:view', ({ sessionId, view }: any) => {
    if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
    const action =
      view.kind === 'number'
        ? { type: 'guess', value: [27, 28, 25, 30, 27, 24, 20, 32, 26, 35][i] }
        : { type: 'answer', choice: (i + view.qIndex) % 4 === 3 ? (JUSTES[view.qIndex] + 1) % (view.answers?.length ?? 2) : JUSTES[view.qIndex] }
    setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action }, () => {}), 400 + i * 260)
  })
})

const velours = await navigateur.newContext({ viewport: { width: 1920, height: 1080 } })
const ivoire = await navigateur.newContext({ viewport: { width: 1920, height: 1080 } })
const [nomCookie, valeurCookie] = cookie.split('=')
for (const c of [velours, ivoire]) {
  await c.addCookies([{ name: nomCookie, value: valeurCookie, url }])
  await c.addInitScript(() => localStorage.setItem('quizz.muted', '1'))
}
await ivoire.addInitScript(() => localStorage.setItem('quizz.theme', 'ivoire'))
const tele = await velours.newPage()
const teleIvoire = await ivoire.newPage()
const telephone = await (
  await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
).newPage()
await telephone.addInitScript(
  ([cle, me]: string[]) => localStorage.setItem(cle, me),
  [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: nina.playerId, token: nina.token })],
)
await Promise.all([tele.goto(`${url}/host`), teleIvoire.goto(`${url}/host`), telephone.goto(`${url}/${ADMIN.slug}`)])
await patienter(2000)

/** Une photo sans le contour de focus qu'un titre garde pour le lecteur d'écran. */
async function photo(page: any, nom: string) {
  // En texte, comme les autres rendus : le serveur se type sans le DOM.
  await page.evaluate('document.activeElement?.blur?.()')
  await page.screenshot({ path: path.join(sortie, `${nom}.jpg`), type: 'jpeg', quality: 82 })
  console.log(`  ${nom}`)
}
async function capture(moment: string, opts: { telephone?: boolean; ivoire?: boolean } = {}) {
  await patienter(900)
  await photo(tele, `ecran-${moment}`)
  if (opts.ivoire) await photo(teleIvoire, `ecran-${moment}-ivoire`)
  if (opts.telephone) await photo(telephone, `telephone-${moment}`)
}

let vue: any = null
host.on('session:view', (p: any) => (vue = p))
const phase = (ph: string, q?: number) =>
  vue?.view.phase === ph && (q === undefined || vue.view.qIndex === q)
    ? Promise.resolve(vue)
    : attendre<any>(host, 'session:view', p => p.view.phase === ph && (q === undefined || p.view.qIndex === q), `${ph} ${q ?? ''}`, 20000)
const suivant = () => {
  const { phase: ph, qIndex, round } = vue.view
  ;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'next', phase: ph, qIndex, round } })
}

await capture('attente', { telephone: true })
await lancerQuiz(host, packId)

/** Nina répond depuis son téléphone : un bouton, ou un nombre tapé. */
async function ninaRepond(reponse: RegExp | string) {
  await patienter(1500)
  try {
    if (typeof reponse === 'string') {
      const champ = telephone.locator('.guess-input')
      await champ.waitFor({ state: 'visible', timeout: 10_000 })
      await champ.pressSequentially(reponse, { delay: 80 })
      await telephone.keyboard.press('Enter')
    } else await telephone.getByRole('button', { name: reponse }).first().click({ timeout: 10_000 })
  } catch (e) {
    console.log(`  (Nina n'a pas pu répondre : ${(e as Error).message.split('\n')[0]})`)
  }
  await patienter(2500)
}

// La planète rouge : la question, la réponse de Nina, la révélation.
await phase('question', 0)
await capture('question', { telephone: true })
await ninaRepond(/Mars/)
await photo(telephone, 'telephone-repondu')
suivant()
await phase('reveal', 0)
await capture('revelation', { telephone: true, ivoire: true })
suivant()

// L'estimation : la salle se rapproche de 27.
await phase('question', 1)
await ninaRepond('27')
suivant()
await phase('reveal', 1)
await capture('estimation', { telephone: true })
suivant()

for (const q of [2, 3, 4, 5]) {
  if (q === 3) {
    await phase('observe', 3)
    await capture('photo-a-memoriser')
    suivant()
  }
  await phase('question', q)
  await ninaRepond([/Vrai/, /Trois/, /Quatre/, /van Gogh/][q - 2])
  suivant()
  await phase('reveal', q)
  suivant()
}
await phase('finished')
await capture('podium-du-quiz', { telephone: true })
;(host as any).emit('host:endSession', { sessionId: vue.sessionId })
await patienter(1200)

async function cliquer(texte: string) {
  await tele.getByRole('button', { name: texte, exact: true }).first().click()
  await patienter(900)
}
await cliquer('Victoire')
await capture('victoire')
await cliquer('Revenir')
;(host as any).emit('host:closeParty', { title: 'Culture générale' })
await patienter(3000)
await capture('cloture', { telephone: true })
await telephone.goto(`${url}/${ADMIN.slug}/souvenir`)
await patienter(2000)
await photo(telephone, 'telephone-souvenir')

await navigateur.close()
host.close()
await banc.close()
console.log(`Captures dans ${sortie}`)
process.exit(0)

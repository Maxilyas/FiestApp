// Le pire cas de l'écran commun, rejoué et photographié.
//
// Un serveur jetable, un quiz bavard (question longue, photo, réponses de
// cent caractères, estimation à neuf réponses, vrai/faux, photo à
// mémoriser), trois équipes et dix invités — puis chaque phase capturée en
// 1366 × 768 (le portable qu'on branche à la télé), en 1920 × 1080 et au
// téléphone en 360 × 640. Les captures vont dans le dossier donné :
//
//   npx tsx scripts/rendu-ecran.ts ../export/rendu [ivoire]
//
// Ce n'est pas un test : c'est l'œil qu'on pose sur l'écran avant et après une
// retouche (« Regarde le rendu », CLAUDE.md). Le client doit être construit.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
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

const sortie = path.resolve(process.argv[2] ?? 'rendu')
const ivoire = process.argv.includes('ivoire')
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

// Une photo dessinée ici : aucune image sous droits.
const atelier = await navigateur.newPage({ viewport: { width: 800, height: 600 } })
await atelier.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <rect width="800" height="600" fill="#3b2a4a"/><ellipse cx="400" cy="520" rx="300" ry="40" fill="#e9e1d3"/>
  <rect x="170" y="330" width="460" height="190" rx="20" fill="#f4a6b8"/>
  ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${208 + i * 62}" y="250" width="14" height="80" rx="4" fill="#ffd166"/>`).join('')}
</svg></body>`)
const jpeg: Buffer = await atelier.screenshot({ type: 'jpeg', quality: 80 })
await atelier.close()
const envoi = await ecrire(url, '/api/images', { dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}` }, cookie)
const image = ((await envoi.json()) as { url: string }).url

const longues = [
  'Parce que le glaçage blanc du gâteau reflétait la lumière des bougies posées tout autour de la table du salon',
  'Parce que la tante Odile avait oublié les allumettes dans la voiture garée tout au fond du parking du supermarché',
  'Parce que personne ne savait vraiment combien de bougies il fallait mettre sur un gâteau de trente-sept ans',
  'Parce que le chat avait renversé la bouteille de cidre sur la nappe brodée de la grand-mère juste avant le dessert',
]
const packId = await creerQuiz(
  url,
  cookie,
  [
    {
      kind: 'choice',
      text: 'Lors du dernier anniversaire de Mamie au mois de juillet, pourquoi toute la famille a-t-elle éclaté de rire au moment précis où le gâteau est arrivé dans la salle à manger, sous les applaudissements des voisins ?',
      answers: longues,
      correct: 2,
      duration: 60,
      image,
      observeSeconds: null,
    },
    { kind: 'number', text: 'Combien de kilomètres sépare Paris de Rouen, à vol d’oiseau ?', target: 112, unit: 'km', duration: 60, image: null, answers: [], correct: 0 },
    { kind: 'choice', text: 'La tour Eiffel mesure plus de 300 mètres.', answers: ['Vrai', 'Faux'], correct: 0, duration: 60, image: null },
    { kind: 'choice', text: 'Combien de bougies sur le gâteau ?', answers: ['Cinq', 'Six', 'Sept', 'Huit'], correct: 2, duration: 60, image, observeSeconds: 8 },
    // De quoi faire un vrai quiz, qui décerne ses hauts faits à la clôture.
    { kind: 'choice', text: 'Quelle est la capitale de l’Australie ?', answers: ['Sydney', 'Canberra', 'Melbourne'], correct: 1, duration: 60, image: null },
    { kind: 'choice', text: 'Combien de pattes a une araignée ?', answers: ['Six', 'Huit'], correct: 1, duration: 60, image: null },
  ],
  'Le pire cas',
)

const host = await ecranCommun(url, cookie)
for (const [name, emoji] of [
  ['Les Flamants', '🦩'],
  ['Piment', '🌶️'],
  ['Les Étoiles filantes', '🌠'],
]) {
  ;(host as any).emit('host:createTeam', { name, emoji })
}
const avecEquipes = await instantane(host, s => s.teams?.length === 3, 'trois équipes')
const equipes = avecEquipes.teams.map((t: any) => t.id)

const prenoms = ['Marie-Charlotte de La Rochefoucauld', 'Léo', 'Zoé', 'Camille', 'Camille', 'Jean-Baptiste', 'Ophélie', 'Bo', 'François-Xavier', 'Kévin']
const invites: Invite[] = []
for (const [i, nom] of prenoms.entries()) {
  const avatar = ['🦊', '🐼', '🐸', '🐙', '🐙', '🦁', '🐝', '🐢', '🦉', '🐧'][i]
  // Les six premiers ont un profil : c'est à eux que la clôture remet ses
  // hauts faits et ses niveaux.
  const profil = i < 6 ? await inscrireProfil(url, `joueur${i}`, nom, avatar) : undefined
  const inv = await invite(url, nom, avatar, { cookie: profil })
  invites.push(inv)
  ;(host as any).emit('host:assignPlayer', { playerId: inv.playerId, teamId: equipes[i % 3] })
}
// Le téléphone de Gaspard, dans un vrai navigateur ; son jeton lui est
// remis comme s'il s'était déjà inscrit.
const gaspard = await invite(url, 'Gaspard', '🦊')
gaspard.socket.close()

// Les invités répondent tout seuls, chacun à son rythme et pas toujours juste.
invites.forEach((inv, i) => {
  inv.socket.on('session:view', ({ sessionId, view }: any) => {
    if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
    const action =
      view.kind === 'number'
        ? { type: 'guess', value: [112, 120, 95, 150, 80, 200, 110, 130, 60, 250][i] }
        : // Le prénom le plus long répond toujours juste : c'est lui qu'on veut
          // voir en haut du podium.
          { type: 'answer', choice: i === 0 ? [2, 0, 0, 2, 1, 1][view.qIndex] : (i * 7) % (view.answers?.length ?? 2) }
    setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action }, () => {}), 150 + i * 90)
  })
})

const contexte = await navigateur.newContext()
const [nom, valeur] = cookie.split('=')
await contexte.addCookies([{ name: nom, value: valeur, url }])
if (ivoire) await contexte.addInitScript(() => localStorage.setItem('quizz.theme', 'ivoire'))
await contexte.addInitScript(() => localStorage.setItem('quizz.muted', '1'))
const tele = await contexte.newPage()
await tele.setViewportSize({ width: 1366, height: 768 })
const grande = await contexte.newPage()
await grande.setViewportSize({ width: 1920, height: 1080 })
const telephone = await (
  await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
).newPage()
await telephone.addInitScript(
  ([cle, me]: string[]) => localStorage.setItem(cle, me),
  [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: gaspard.playerId, token: gaspard.token })],
)
await Promise.all([tele.goto(`${url}/host`), grande.goto(`${url}/host`), telephone.goto(`${url}/${ADMIN.slug}`)])
await patienter(1500)

let n = 0
async function capture(moment: string, opts: { telephone?: boolean } = {}) {
  await patienter(700)
  n++
  const prefixe = String(n).padStart(2, '0')
  await tele.screenshot({ path: path.join(sortie, `${prefixe}-${moment}-1366.jpg`), type: 'jpeg', quality: 70 })
  await grande.screenshot({ path: path.join(sortie, `${prefixe}-${moment}-1920.jpg`), type: 'jpeg', quality: 70 })
  if (process.env.MESURE) await mesurer(moment)
  if (process.env.COUPE)
    console.log(
      await grande.evaluate(`[...document.querySelectorAll('.coupe-zone')].map(z => z.clientHeight + ' : ' + [...z.querySelectorAll('.lb-row')].map(l => { let h = 0; for (let x = l; x && x !== z; x = x.offsetParent) h += x.offsetTop; return (l.style.display === 'none' ? '-' : '') + (h + l.offsetHeight) + '(' + (l.offsetParent && l.offsetParent.className) + ')' }).join(' ')).join('\\n')`),
    )
  if (opts.telephone) await telephone.screenshot({ path: path.join(sortie, `${prefixe}-${moment}-tel.jpg`), type: 'jpeg', quality: 70 })
  console.log(`  ${prefixe} ${moment}`)
}

// Ce qui ne grandit pas entre 1366 × 768 et 1920 × 1080 : chaque texte
// visible, retrouvé par son chemin dans la page, et le rapport de ses tailles
// aux deux définitions. Tout ce qui reste sous 1,25 est écrit en pixels.
async function mesurer(moment: string) {
  // Évalué dans la page, et passé en texte : tsx nomme les fonctions
  // fléchées par un assistant (`__name`) que la page ne connaît pas.
  const releve = (page: any): Promise<Record<string, number>> =>
    page.evaluate(`(() => {
      const chemin = e => {
        const parts = []
        for (let x = e; x && x !== document.body; x = x.parentElement) {
          const i = x.parentElement ? [...x.parentElement.children].indexOf(x) : 0
          parts.unshift(x.tagName.toLowerCase() + (x.classList.length ? '.' + [...x.classList].join('.') : '') + ':' + i)
        }
        return parts.join('>')
      }
      const r = {}
      for (const e of document.querySelectorAll('.host *')) {
        const b = e.getBoundingClientRect()
        if (!b.width || !b.height) continue
        if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) r[chemin(e) + ' font'] = parseFloat(getComputedStyle(e).fontSize)
        if (e.tagName === 'svg' || e.tagName === 'IMG' || e.classList.contains('qr-box')) r[chemin(e) + ' box'] = b.height
      }
      return r
    })()`)
  const [a, b] = await Promise.all([releve(tele), releve(grande)])
  const petits = new Map<string, string>()
  for (const [k, v] of Object.entries(a)) {
    if (!(k in b) || v === 0) continue
    const ratio = b[k] / v
    if (ratio < 1.25) {
      const feuille = k.split('>').pop()!
      petits.set(feuille.replace(/:\d+/, '') + ` (${v.toFixed(1)} → ${b[k].toFixed(1)})`, k)
    }
  }
  if (petits.size) console.log(`    ${moment} — ne grandit pas :\n      ` + [...petits.keys()].slice(0, 40).join('\n      '))
}

let vue: any = null
host.on('session:view', (p: any) => (vue = p))
const phase = (ph: string, q?: number) =>
  vue?.view.phase === ph && (q === undefined || vue.view.qIndex === q)
    ? Promise.resolve(vue)
    : attendre<any>(host, 'session:view', p => p.view.phase === ph && (q === undefined || p.view.qIndex === q), `${ph} ${q ?? ''}`, 15000)
const suivant = () => {
  const { phase: ph, qIndex, round } = vue.view
  ;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'next', phase: ph, qIndex, round } })
}

await capture('attente', { telephone: true })
await lancerQuiz(host, packId)

// Q1 : la question longue, sa photo, ses réponses de cent caractères.
await phase('question', 0)
await capture('q1-question', { telephone: true })
;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'pause' } })
await capture('q1-pause', { telephone: true })
;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'resume' } })
await patienter(2500)
suivant()
await phase('reveal', 0)
await capture('q1-revelation', { telephone: true })
;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'autoNext', seconds: 30 } })
await capture('q1-revelation-auto')
;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'autoNext', seconds: null } })
suivant()

// Q2 : l'estimation, dix réponses à révéler.
await phase('question', 1)
await capture('q2-estimation', { telephone: true })
await patienter(1500)
suivant()
await phase('reveal', 1)
console.log(`    ${vue.view.guesses?.length} estimations`)
await capture('q2-estimation-revelation', { telephone: true })
suivant()

// Q3 : le vrai/faux.
await phase('question', 2)
await patienter(1500)
await capture('q3-vraifaux')
suivant()
await phase('reveal', 2)
await capture('q3-vraifaux-revelation')
suivant()

// Q4 : la photo à mémoriser.
await phase('observe', 3)
await capture('q4-observation', { telephone: true })
suivant()
await phase('question', 3)
await patienter(1500)
suivant()
await phase('reveal', 3)
for (const q of [4, 5]) {
  suivant()
  await phase('question', q)
  await patienter(1500)
  suivant()
  await phase('reveal', q)
}
suivant()
await phase('finished')
await capture('podium-du-quiz', { telephone: true })
;(host as any).emit('host:endSession', { sessionId: vue.sessionId })
await patienter(1000)

// Les écrans de fin, ouverts depuis une console : la scène est tenue par le
// serveur (`poserScene`), et l'autre écran la suit. Cliquée sur les deux, la
// seconde ne trouvait plus son bouton — son écran avait déjà changé.
async function cliquer(texte: string) {
  await tele.getByRole('button', { name: texte, exact: true }).first().click()
  await patienter(800)
}
await capture('salle-apres-quiz')
await cliquer('Podium')
await capture('podium-soiree')
await cliquer('Revenir')
await cliquer('Prix')
await capture('prix')
await cliquer('Revenir')
await cliquer('Victoire')
await capture('victoire')
;(host as any).emit('host:closeParty', { title: 'Le pire cas' })
await patienter(2500)
await capture('cloture', { telephone: true })
// Le souvenir au téléphone : le podium, où un nom long volait sa marche.
await telephone.goto(`${url}/${ADMIN.slug}/souvenir`)
await patienter(1500)
await telephone.screenshot({ path: path.join(sortie, '17-souvenir-tel.jpg'), type: 'jpeg', quality: 70 })

await navigateur.close()
host.close()
await banc.close()
console.log(`Captures dans ${sortie}`)
process.exit(0)

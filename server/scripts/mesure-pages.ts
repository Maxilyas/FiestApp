// Ce que chaque page fait attendre à un téléphone — mesuré, pas deviné.
//
// Un serveur jetable et une soirée jouée pour remplir ses pages, puis chaque
// page ouverte dans Chromium comme sur un téléphone moyen : le processeur
// ralenti quatre fois, le réseau bridé aux préréglages de Chrome (« 4G » :
// 165 ms par requête, 9 Mbit/s ; « 4G lente » : 563 ms, 1,6 Mbit/s — celle
// que Lighthouse prête à un téléphone), le cache vide (la première visite)
// puis plein (le retour). Pour chaque page :
//
//   - le premier affichage (FCP) : souvent le « Chargement… » d'attente ;
//   - l'écran utile : le premier élément qui dit que la page est là — les
//     trois boutons de l'entrée, les tuiles du profil… (`pret`), peint ;
//   - le plus grand affichage (LCP) et le temps bloqué (TBT : ce que les
//     tâches longues prennent au-delà de 50 ms, après le premier affichage) ;
//   - le processeur : script, styles, mise en page ;
//   - ce qui a transité avant l'écran utile, par sorte, et en fond après lui.
//
//   npx tsx scripts/mesure-pages.ts [--pages=entree,accueil] [--reseaux=4g,4g-lente]
//       [--essais=3] [--cache=froid,chaud] [--cascade] [--couverture]
//       [--photos=dossier] [--json=fichier] [--client=dossier] [--http1]
//
// `--cascade` écrit les requêtes du premier chargement, une par ligne : c'est
// là qu'on voit les allers-retours qui s'enchaînent. Chaque mesure relève
// aussi les données que la page servie fait précharger (`shared/depart.ts`)
// et que la page n'a pas reprises — jamais demandées, ou redemandées au
// réseau : la liste et la page ne disent plus la même adresse. `--couverture` dit,
// sans bridage, la part du script et de la feuille de style chargés que la
// page a vraiment servie avant son écran utile. `--client` mesure un autre
// client construit : deux paquets se comparent sur la même machine.
//
// Les pages passent par un relais HTTP/2, comme chez l'hébergeur (voir
// `relaisHttp2` ; `--http1` s'en passe), qui retarde aussi les messages temps
// réel, que Chrome ne bride pas. Le reste du bridage est celui de Chrome :
// une latence par requête, pas une vraie 4G — ni le réveil de l'hébergeur,
// ni les allers-retours du serveur vers Turso (`/healthz` les mesure en
// ligne, dans `ressenti`).
//
// Ce n'est pas un test : un chiffre qui bouge de 10 % d'une fois à l'autre
// n'a rien d'une régression (la machine, le bridage simulé). C'est la mesure
// qu'on prend avant et après une retouche, sur la même machine. Le client
// doit être construit (`npm run build -w client`).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import http2 from 'node:http2'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { createHash, X509Certificate } from 'node:crypto'
import path from 'node:path'
import { SERVEUR } from '../src/racine'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  estimation,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
  type Socket,
} from '../test/banc'

const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

// ── Ce qu'on mesure ───────────────────────────────────────────────────────

interface Reseau {
  nom: string
  /** Latence ajoutée à chaque requête, en millisecondes. */
  latence: number
  /**
   * L'aller-retour d'un message temps réel, en millisecondes. Chrome ne bride
   * que la poignée de main d'un WebSocket, pas ses messages : sans ce délai,
   * le relais les ferait passer en un éclair, et l'entrée d'un invité — deux
   * échanges avec le serveur avant l'instantané — paraîtrait plus rapide
   * qu'en 4G. C'est la latence de base des préréglages, avant leur
   * multiplicateur.
   */
  rtt: number
  /** Débits, en octets par seconde. */
  descente: number
  montee: number
}

/**
 * Les préréglages de Chrome (DevTools), qui comptent déjà l'établissement des
 * connexions dans leur latence : la « 4G » d'un salon, la « 4G lente » du
 * fond du jardin. Le wifi de la maison, pour l'écran commun.
 */
const RESEAUX: Record<string, Reseau | null> = {
  '4g': { nom: '4G (165 ms, 9 Mbit/s)', latence: 165, rtt: 60, descente: (9e6 * 0.9) / 8, montee: (1.5e6 * 0.9) / 8 },
  '4g-lente': { nom: '4G lente (563 ms, 1,6 Mbit/s)', latence: 562.5, rtt: 150, descente: (1.6e6 * 0.9) / 8, montee: (750e3 * 0.9) / 8 },
  // Celle des audits du 24 et du 27 septembre (`retours/`), pour comparer à leurs chiffres.
  '4g-moyenne': { nom: '4G moyenne (150 ms, 1,6 Mbit/s)', latence: 150, rtt: 40, descente: 1.6e6 / 8, montee: 750e3 / 8 },
  wifi: { nom: 'wifi (20 ms, 30 Mbit/s)', latence: 20, rtt: 10, descente: 30e6 / 8, montee: 15e6 / 8 },
  brut: null,
}

/** Un téléphone moyen (processeur ralenti quatre fois), et le portable branché à la télé. */
const APPAREILS = {
  telephone: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, processeur: 4 },
  tele: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, processeur: 2 },
}

interface PageMesuree {
  cle: string
  nom: string
  chemin: string
  /** Qui ouvre la page : son cookie, ou le jeton d'invité retenu sur le téléphone. */
  qui: 'anonyme' | 'profil' | 'animateur' | 'invite'
  /** Le premier élément qui dit que la page est là. */
  pret: string
  appareil?: keyof typeof APPAREILS
  /** Les réseaux de cette page, s'ils ne sont pas ceux de tout le monde. */
  reseaux?: string[]
}

const PAGES: PageMesuree[] = [
  { cle: 'entree', nom: 'Entrée d’un invité (QR)', chemin: `/${ADMIN.slug}`, qui: 'anonyme', pret: '.entree-choix .join-actions .btn-big' },
  { cle: 'attente', nom: 'Salle d’attente (retour)', chemin: `/${ADMIN.slug}`, qui: 'invite', pret: '.waiting' },
  { cle: 'accueil-anonyme', nom: 'Accueil sans profil', chemin: '/', qui: 'anonyme', pret: '.entree-choix .btn-big' },
  { cle: 'accueil', nom: 'Accueil d’un profil', chemin: '/', qui: 'profil', pret: '.accueil-gestes .jouer-section' },
  { cle: 'profil', nom: 'Profil (tuiles)', chemin: '/profil', qui: 'profil', pret: '.tuiles' },
  { cle: 'avatar', nom: 'Mon avatar', chemin: '/profil#avatar', qui: 'profil', pret: '.famille-avatars .case-avatar' },
  { cle: 'collection', nom: 'Ma collection', chemin: '/profil#collection', qui: 'profil', pret: '.collection .trophees-liste .trophee' },
  { cle: 'boutique', nom: 'Boutique', chemin: '/boutique', qui: 'profil', pret: '.vitrine-themes > *' },
  { cle: 'jour', nom: 'Quiz du jour', chemin: '/jour', qui: 'profil', pret: '.jour-heros' },
  { cle: 'campagne', nom: 'Campagne (série)', chemin: '/campagne', qui: 'profil', pret: '.campagne:not([aria-busy]) .campagne-heros' },
  { cle: 'sentiers', nom: 'Sentiers du savoir', chemin: '/campagne#sentiers', qui: 'profil', pret: '.sentiers:not([aria-busy]) .sentiers-tuile' },
  { cle: 'souvenir', nom: 'Souvenir de la soirée', chemin: `/${ADMIN.slug}/souvenir`, qui: 'anonyme', pret: '.recap.souvenir .page-corps > *' },
  { cle: 'bilan', nom: 'Bilan de la soirée', chemin: `/${ADMIN.slug}/bilan`, qui: 'anonyme', pret: '.recap.bilan .page-corps > *' },
  { cle: 'mes-quiz', nom: 'Mes quiz', chemin: '/edit', qui: 'animateur', pret: '.quiz-carte-ouvrir' },
  { cle: 'ecran-commun', nom: 'Écran commun (télé)', chemin: '/host', qui: 'animateur', pret: '.join-url', appareil: 'tele', reseaux: ['wifi'] },
]

// ── Les arguments ─────────────────────────────────────────────────────────

const args = new Map(
  process.argv.slice(2).map(a => {
    const [cle, ...valeur] = a.replace(/^--/, '').split('=')
    return [cle, valeur.join('=') || 'oui'] as const
  }),
)
const liste = (cle: string, defaut: string[]) => args.get(cle)?.split(',').filter(Boolean) ?? defaut
const pagesVoulues = liste('pages', PAGES.map(p => p.cle))
const reseauxVoulus = liste('reseaux', ['4g', '4g-lente'])
const caches = liste('cache', ['froid', 'chaud']) as ('froid' | 'chaud')[]
const essais = Math.max(1, Number(args.get('essais') ?? 3))
const photos = args.get('photos') ? path.resolve(args.get('photos')!) : null
const sortieJson = args.get('json') ? path.resolve(args.get('json')!) : null
for (const r of reseauxVoulus) if (!(r in RESEAUX)) throw new Error(`réseau inconnu : ${r} (${Object.keys(RESEAUX).join(', ')})`)
for (const p of pagesVoulues) if (!PAGES.some(x => x.cle === p)) throw new Error(`page inconnue : ${p} (${PAGES.map(x => x.cle).join(', ')})`)
if (photos) mkdirSync(photos, { recursive: true })

// `--client=dossier` : un autre client construit — deux paquets se comparent ainsi sur la même machine.
const clientDist = path.resolve(args.get('client') ?? path.join(SERVEUR, '../client/dist'))
if (!existsSync(path.join(clientDist, 'index.html'))) {
  console.error(`Pas de client construit dans ${clientDist} : npm run build -w client`)
  process.exit(1)
}

// ── La soirée qui remplit les pages ───────────────────────────────────────

/** Joue un quiz de bout en bout depuis l'écran commun, chacun répondant ce qu'on lui dit. */
async function jouerQuiz(ecran: Socket, quizId: string, salle: Invite[], reponses: ((i: number) => object)[]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(ecran, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(ecran, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < reponses.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [i, qui] of salle.entries()) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: reponses[q](i) })
      if (!ack.ok) throw new Error(`réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < reponses.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(ecran as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(ecran as any).emit('host:endSession', { sessionId })
}

/**
 * Une soirée de six invités, close — le souvenir et le bilan la montrent, Léa
 * y gagne de l'expérience —, puis la suivante, où Zoé attend le premier quiz :
 * c'est son téléphone qu'on rouvrira.
 */
async function semer(url: string) {
  const hote = await connexionAnimateur(url)
  const lea = await inscrireProfil(url, 'lea', 'Léa', '🦊')
  const quiz = await creerQuiz(
    url,
    hote,
    [
      qcm('Quelle est la capitale de l’Australie ?', ['Sydney', 'Canberra', 'Melbourne', 'Perth'], 1),
      qcm('Combien de cordes a un violon ?', ['Trois', 'Quatre', 'Cinq', 'Six'], 1),
      estimation('En quelle année la tour Eiffel a-t-elle été inaugurée ?', 1889),
      qcm('Quel est le plus long fleuve de France ?', ['La Seine', 'Le Rhône', 'La Loire', 'La Garonne'], 2),
      qcm('Qui a peint « La Joconde » ?', ['Michel-Ange', 'Raphaël', 'Léonard de Vinci', 'Botticelli'], 2),
      estimation('Combien d’os compte le corps humain adulte ?', 206),
    ],
    'Culture générale',
  )
  const ecran = await ecranCommun(url, hote)
  const salle = [await invite(url, 'Léa', '🦊', { cookie: lea })]
  for (const [nom, avatar] of [
    ['Bob', '🐻'],
    ['Dora', '🐙'],
    ['Eve', '🐝'],
    ['Hugo', '🦁'],
    ['Inès', '🐼'],
  ]) {
    salle.push(await invite(url, nom, avatar))
  }
  const choix = (bonne: number) => (i: number) => ({ type: 'answer', choice: (bonne + (i % 3 === 2 ? 1 : 0)) % 4 })
  const devine = (cible: number) => (i: number) => ({ type: 'guess', value: cible + (i - 2) * 7 })
  await jouerQuiz(ecran, quiz, salle, [choix(1), choix(1), devine(1889), choix(2), choix(2), devine(206)])
  const close = attendre<any>(ecran, 'toast', () => true, 'la soirée close', 15_000)
  ;(ecran as any).emit('host:closeParty', { title: 'La soirée des mesures' })
  const toast = await close
  if (toast.kind !== 'info') throw new Error(`la clôture a échoué : ${toast.message}`)
  for (const i of salle) i.socket.close()
  const zoe = await invite(url, 'Zoé', '🐨')
  zoe.socket.close()
  return { hote, lea, zoe: { playerId: zoe.playerId, token: zoe.token } }
}

// ── Une page ouverte et chronométrée ──────────────────────────────────────

/**
 * Posé dans la page avant tout script, et passé en texte : tsx nomme les
 * fonctions fléchées par un assistant (`__name`) que la page ne connaît pas.
 * L'écran utile se guette par un `MutationObserver` — l'heure est prise dans
 * la page, pas au rythme d'une sonde —, puis on attend son affichage : la
 * tâche qui suit la peinture.
 */
const sonde = (pret: string) => `(() => {
  const PRET = ${JSON.stringify(pret)};
  const m = (window.__mesure = { pret: null, pretPeint: null, lcp: null, longues: [], decalage: 0, demandees: [] });
  // Ce que la page demande elle-même : un préchargement qu'elle ne demande
  // pas est parti pour rien (\`prechargement\`).
  const demander = window.fetch;
  window.fetch = function (entree) {
    try { m.demandees.push(new URL(entree instanceof Request ? entree.url : String(entree), location.href).href) } catch {}
    return demander.apply(this, arguments);
  };
  const observer = (type, f) => {
    try { new PerformanceObserver(l => l.getEntries().forEach(f)).observe({ type, buffered: true }) } catch {}
  };
  observer('largest-contentful-paint', e => { m.lcp = e.startTime });
  observer('longtask', e => { m.longues.push([e.startTime, e.duration]) });
  observer('layout-shift', e => { if (!e.hadRecentInput) m.decalage += e.value });
  const voir = () => {
    if (m.pret !== null) return;
    const el = document.querySelector(PRET);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    m.pret = performance.now();
    guet.disconnect();
    requestAnimationFrame(() => setTimeout(() => { m.pretPeint = performance.now() }, 0));
  };
  const guet = new MutationObserver(voir);
  guet.observe(document, { childList: true, subtree: true, attributes: true });
  addEventListener('load', voir);
})()`

type Sorte = 'doc' | 'js' | 'css' | 'police' | 'image' | 'donnees' | 'autre'
const SORTES: Sorte[] = ['doc', 'js', 'css', 'police', 'image', 'donnees', 'autre']

function sorteDe(type: string, url: string): Sorte {
  if (type === 'Document') return 'doc'
  if (type === 'Script') return 'js'
  if (type === 'Stylesheet') return 'css'
  if (type === 'Font') return 'police'
  if (type === 'Image') return 'image'
  // Une donnée préchargée par la page (`<link rel="preload" as="fetch">`) arrive en « Other ».
  if ((type === 'Fetch' || type === 'XHR' || type === 'Other') && /^\/(api|s)\//.test(new URL(url).pathname)) return 'donnees'
  return 'autre'
}

interface Requete {
  url: string
  sorte: Sorte
  /** En millisecondes depuis le début de la navigation. */
  debut: number
  fin: number | null
  octets: number
  cache: boolean
  statut: number | null
  /** `h2`, `http/1.1`… */
  protocole: string | null
  echec: boolean
}

interface Mesure {
  page: string
  reseau: string
  cache: 'froid' | 'chaud'
  ttfb: number | null
  fcp: number | null
  pret: number | null
  lcp: number | null
  tbt: number
  tacheMax: number
  decalage: number
  script: number
  styles: number
  miseEnPage: number
  /** Octets transférés avant l'écran utile, par sorte. */
  avant: Record<Sorte, number>
  /** Requêtes parties sur le réseau avant l'écran utile. */
  requetes: number
  /** Ce qui transite encore après l'écran utile, en fond. */
  apres: number
  /** La poignée de main temps réel et les premiers messages reçus, en ms. */
  socket: { ouvert: number | null; messages: number[] }
  cascade: Requete[]
  /**
   * Les données de départ que la page servie fait précharger
   * (\`shared/depart.ts\`) et que la page n'a pas reprises : jamais demandées,
   * ou demandées une seconde fois au réseau — l'adresse a changé d'un côté.
   */
  prechargement: { jamaisDemandees: string[]; doublees: string[] }
}

const enMs = (t: number, t0: number) => Math.round((t - t0) * 1000)
const cheminDe = (url: string) => new URL(url).pathname + new URL(url).search

/** Un navigateur neuf pour la page — son cache vide —, avec ce que son visiteur apporte : un cookie, un jeton retenu. */
async function contexteDe(navigateur: any, page: PageMesuree, etat: Etat) {
  const appareil = APPAREILS[page.appareil ?? 'telephone']
  const contexte = await navigateur.newContext({
    viewport: appareil.viewport,
    deviceScaleFactor: appareil.deviceScaleFactor,
    isMobile: appareil.isMobile,
    hasTouch: appareil.hasTouch,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  })
  if (page.qui === 'profil' || page.qui === 'animateur') {
    const [nom, valeur] = (page.qui === 'profil' ? etat.lea : etat.hote).split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: etat.url }])
  }
  if (page.qui === 'invite') {
    // Le téléphone de Zoé se souvient d'elle : il se re-présente avec son jeton.
    await contexte.addInitScript(
      `try { localStorage.getItem('quizz.me.${ADMIN.slug}') || localStorage.setItem('quizz.me.${ADMIN.slug}', ${JSON.stringify(JSON.stringify(etat.zoe))}) } catch {}`,
    )
  }
  await contexte.addInitScript(sonde(page.pret))
  return contexte
}

async function mesurer(navigateur: any, page: PageMesuree, reseau: string, cache: 'froid' | 'chaud', etat: Etat, photo: string | null): Promise<Mesure> {
  const appareil = APPAREILS[page.appareil ?? 'telephone']
  const contexte = await contexteDe(navigateur, page, etat)
  try {
    // Le cache chaud : la même page déjà ouverte une fois, dans un autre onglet.
    if (cache === 'chaud') {
      const avant = await contexte.newPage()
      await avant.goto(etat.url + page.chemin)
      await avant.waitForFunction(() => (globalThis as any).__mesure?.pretPeint != null, undefined, { timeout: 30_000, polling: 250 })
      await patienter(1500)
      await avant.close()
    }

    const onglet = await contexte.newPage()
    const cdp = await contexte.newCDPSession(onglet)
    await cdp.send('Network.enable')
    await cdp.send('Performance.enable')
    const bride = RESEAUX[reseau]
    latenceTempsReel = bride?.rtt ?? 0
    if (bride) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: bride.latence,
        downloadThroughput: bride.descente,
        uploadThroughput: bride.montee,
      })
    }
    if (reseau !== 'brut') await cdp.send('Emulation.setCPUThrottlingRate', { rate: appareil.processeur })

    // Le réseau vu par le navigateur : ce qui part, d'où, et ce que ça pèse.
    let t0: number | null = null
    const requetes = new Map<string, Requete & { t: number }>()
    const enVol = new Set<string>()
    let socketOuvert: number | null = null
    const messages: number[] = []
    cdp.on('Network.requestWillBeSent', (e: any) => {
      if (t0 === null && e.type === 'Document') t0 = e.timestamp
      if (e.type === 'WebSocket') return
      const sorte = sorteDe(e.type, e.request.url)
      requetes.set(e.requestId, { url: e.request.url, sorte, debut: 0, fin: null, octets: 0, cache: false, statut: null, protocole: null, echec: false, t: e.timestamp })
      if (!(sorte === 'autre' && e.request.url.includes('/socket.io/'))) enVol.add(e.requestId)
    })
    cdp.on('Network.requestServedFromCache', (e: any) => {
      const r = requetes.get(e.requestId)
      if (r) r.cache = true
    })
    cdp.on('Network.responseReceived', (e: any) => {
      const r = requetes.get(e.requestId)
      if (!r) return
      r.statut = e.response.status
      r.protocole = e.response.protocol ?? null
      if (e.response.fromDiskCache || e.response.fromPrefetchCache || e.response.fromServiceWorker) r.cache = true
    })
    const finir = (e: any, echec: boolean) => {
      const r = requetes.get(e.requestId)
      enVol.delete(e.requestId)
      if (!r) return
      r.fin = e.timestamp
      r.echec = echec
      if (!echec) r.octets = e.encodedDataLength ?? 0
    }
    cdp.on('Network.loadingFinished', (e: any) => finir(e, false))
    cdp.on('Network.loadingFailed', (e: any) => finir(e, true))
    cdp.on('Network.webSocketHandshakeResponseReceived', (e: any) => {
      if (socketOuvert === null) socketOuvert = e.timestamp
    })
    cdp.on('Network.webSocketFrameReceived', (e: any) => {
      if (messages.length < 6) messages.push(e.timestamp)
    })

    await onglet.goto(etat.url + page.chemin, { waitUntil: 'commit' })
    await onglet.waitForFunction(() => (globalThis as any).__mesure?.pretPeint != null, undefined, { timeout: 60_000, polling: 250 })
    // Puis le calme : plus rien en route pendant une seconde et demie.
    const debut = Date.now()
    let calme = Date.now()
    while (Date.now() - debut < 20_000) {
      if (enVol.size > 0) calme = Date.now()
      else if (Date.now() - calme >= 1500) break
      await patienter(100)
    }
    if (photo) await onglet.screenshot({ path: photo })

    const lu = await onglet.evaluate(`(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const prechargees = [...document.querySelectorAll('link[rel=preload][as=fetch]')].map(l => l.href);
      const jamaisDemandees = prechargees.filter(h => !window.__mesure.demandees.includes(h));
      return { ttfb: n ? n.responseStart : null, fcp: fcp ? fcp.startTime : null, ...window.__mesure, prechargees, jamaisDemandees };
    })()`)
    const { metrics } = await cdp.send('Performance.getMetrics')
    const metrique = (nom: string) => Math.round(((metrics as { name: string; value: number }[]).find(m => m.name === nom)?.value ?? 0) * 1000)

    const debutNav = t0 ?? 0
    const cascade = [...requetes.values()]
      .map(({ t, ...r }) => ({ ...r, debut: enMs(t, debutNav), fin: r.fin === null ? null : enMs(r.fin, debutNav) }))
      .sort((a, b) => a.debut - b.debut)
    const pret = lu.pretPeint as number
    const avant = Object.fromEntries(SORTES.map(s => [s, 0])) as Record<Sorte, number>
    let requetesAvant = 0
    let apres = 0
    for (const r of cascade) {
      if (r.cache || r.echec) continue
      if (r.fin !== null && r.fin <= pret) {
        avant[r.sorte] += r.octets
        requetesAvant++
      } else apres += r.octets
    }
    const longues = lu.longues as [number, number][]
    const apresFcp = longues.filter(([debut]) => lu.fcp === null || debut >= lu.fcp)
    return {
      page: page.cle,
      reseau,
      cache,
      ttfb: lu.ttfb,
      fcp: lu.fcp,
      pret,
      lcp: lu.lcp,
      tbt: Math.round(apresFcp.reduce((s, [, d]) => s + Math.max(0, d - 50), 0)),
      tacheMax: Math.round(Math.max(0, ...longues.map(([, d]) => d))),
      decalage: Math.round(lu.decalage * 1000) / 1000,
      script: metrique('ScriptDuration'),
      styles: metrique('RecalcStyleDuration'),
      miseEnPage: metrique('LayoutDuration'),
      avant,
      requetes: requetesAvant,
      apres,
      socket: { ouvert: socketOuvert === null ? null : enMs(socketOuvert, debutNav), messages: messages.map(t => enMs(t, debutNav)) },
      cascade,
      prechargement: {
        jamaisDemandees: (lu.jamaisDemandees as string[]).map(cheminDe),
        doublees: (lu.prechargees as string[]).filter(h => cascade.filter(r => r.url === h && !r.cache).length > 1).map(cheminDe),
      },
    }
  } finally {
    await contexte.close()
  }
}

// ── La couverture : ce que la page a servi de ce qu'elle a chargé ─────────

/** Les octets d'un script que V8 a exécutés : les plages imbriquées, la plus intérieure l'emporte. */
function octetsExecutes(source: string, fonctions: { ranges: { startOffset: number; endOffset: number; count: number }[] }[]): number {
  const vu = new Uint8Array(source.length)
  const plages = fonctions.flatMap(f => f.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset)
  for (const p of plages) vu.fill(p.count > 0 ? 1 : 0, p.startOffset, p.endOffset)
  let n = 0
  for (const v of vu) n += v
  return n
}

async function couverture(navigateur: any, page: PageMesuree, etat: Etat) {
  const contexte = await contexteDe(navigateur, page, etat)
  try {
    const onglet = await contexte.newPage()
    await onglet.coverage.startJSCoverage({ resetOnNavigation: false })
    await onglet.coverage.startCSSCoverage({ resetOnNavigation: false })
    await onglet.goto(etat.url + page.chemin)
    await onglet.waitForFunction(() => (globalThis as any).__mesure?.pretPeint != null, undefined, { timeout: 30_000, polling: 250 })
    const js = (await onglet.coverage.stopJSCoverage()).filter((e: any) => e.url.includes('/assets/'))
    const css = (await onglet.coverage.stopCSSCoverage()).filter((e: any) => e.url.includes('/assets/'))
    const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    return {
      js: { charge: somme(js.map((e: any) => e.source.length)), servi: somme(js.map((e: any) => octetsExecutes(e.source, e.functions))), fichiers: js.length },
      css: {
        charge: somme(css.map((e: any) => e.text.length)),
        servi: somme(css.map((e: any) => somme(e.ranges.map((r: any) => r.end - r.start)))),
        fichiers: css.length,
      },
    }
  } finally {
    await contexte.close()
  }
}

// ── L'écriture ────────────────────────────────────────────────────────────

const mediane = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const ms = (x: number | null) => (x === null ? '—' : `${Math.round(x).toLocaleString('fr-FR')}`)
const ko = (x: number | null) => (x === null ? '—' : x < 50 ? '0' : (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: x < 10_000 ? 1 : 0 }))
const colonne = (texte: string, largeur: number, gauche = false) => (gauche ? texte.padEnd(largeur) : texte.padStart(largeur))

function tableau(titre: string, lignes: { page: PageMesuree; cache: string; runs: Mesure[] }[]) {
  console.log(`\n${titre}`)
  console.log(
    [
      colonne('Page', 27, true),
      colonne('cache', 6, true),
      colonne('FCP', 6),
      colonne('utile', 6),
      colonne('LCP', 6),
      colonne('TBT', 5),
      colonne('script', 7),
      colonne('styles', 7),
      colonne('mise en p.', 10),
      colonne('JS', 6),
      colonne('CSS', 5),
      colonne('polices', 8),
      colonne('images', 7),
      colonne('données', 8),
      colonne('req.', 5),
      colonne('en fond', 8),
    ].join(' '),
  )
  console.log(`${' '.repeat(35)}${'— ms (médianes) —'.padStart(31)}${'— ko transférés avant l’écran utile —'.padStart(64)}`)
  for (const { page, cache, runs } of lignes) {
    const med = (f: (m: Mesure) => number | null) => mediane(runs.map(f))
    console.log(
      [
        colonne(page.nom, 27, true),
        colonne(cache, 6, true),
        colonne(ms(med(m => m.fcp)), 6),
        colonne(ms(med(m => m.pret)), 6),
        colonne(ms(med(m => m.lcp)), 6),
        colonne(ms(med(m => m.tbt)), 5),
        colonne(ms(med(m => m.script)), 7),
        colonne(ms(med(m => m.styles)), 7),
        colonne(ms(med(m => m.miseEnPage)), 10),
        colonne(ko(med(m => m.avant.js)), 6),
        colonne(ko(med(m => m.avant.css)), 5),
        colonne(ko(med(m => m.avant.police)), 8),
        colonne(ko(med(m => m.avant.image)), 7),
        colonne(ko(med(m => m.avant.donnees + m.avant.doc)), 8),
        colonne(ms(med(m => m.requetes)), 5),
        colonne(ko(med(m => m.apres)), 8),
      ].join(' '),
    )
  }
}

function ecrireCascade(m: Mesure, page: PageMesuree) {
  const protocole = m.cascade.find(r => r.sorte === 'doc')?.protocole ?? '?'
  console.log(`\n  ${page.nom} — ${RESEAUX[m.reseau]?.nom ?? 'sans bridage'}, cache ${m.cache}, ${protocole} : écran utile à ${ms(m.pret)} ms`)
  for (const r of m.cascade) {
    const chemin = new URL(r.url).pathname + new URL(r.url).search
    const etat = r.cache ? 'cache' : r.echec ? 'échec' : `${ko(r.octets)} ko`
    const apres = r.fin !== null && m.pret !== null && r.fin > m.pret ? '  (après)' : ''
    console.log(`  ${colonne(ms(r.debut), 6)} → ${colonne(ms(r.fin), 6)}  ${colonne(r.sorte, 7, true)} ${colonne(etat, 9)}  ${chemin}${apres}`)
  }
  if (m.socket.ouvert !== null) console.log(`  ${colonne(ms(m.socket.ouvert), 6)}           temps réel ouvert ; premiers messages à ${m.socket.messages.map(ms).join(', ')} ms`)
}

// ── HTTP/2, comme en ligne ────────────────────────────────────────────────

/** L'aller-retour temps réel du chargement en cours (`Reseau.rtt`) : les chargements se suivent, un à la fois. */
let latenceTempsReel = 0

/**
 * L'hébergeur sert les pages en HTTP/2 : toutes les requêtes d'une page
 * partagent une connexion. Le serveur du banc, lui, parle HTTP/1.1, où le
 * navigateur n'ouvre que six connexions — les trente morceaux d'une route y
 * feraient la queue six par six, une latence de 4G à chaque tour : une
 * attente qu'aucun téléphone ne connaît en ligne. Un relais HTTP/2 se pose
 * donc devant lui, sous un certificat de la séance (`openssl`) que le
 * navigateur croit sur son empreinte ; la liaison temps réel y passe en
 * HTTP/1.1, comme chez l'hébergeur, ses messages retardés de
 * `latenceTempsReel`. `--http1` s'en passe.
 */
async function relaisHttp2(cible: number): Promise<{ url: string; empreinte: string; fermer: () => void } | null> {
  const dossier = mkdtempSync(path.join(tmpdir(), 'mesure-h2-'))
  const cle = path.join(dossier, 'cle.pem')
  const cert = path.join(dossier, 'cert.pem')
  const fait = spawnSync(
    'openssl',
    [
      ...['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'],
      ...['-keyout', cle, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'],
    ],
    { encoding: 'utf8' },
  )
  if (fait.status !== 0) {
    rmSync(dossier, { recursive: true, force: true })
    return null
  }
  const certificat = readFileSync(cert)
  const serveur = http2.createSecureServer({ key: readFileSync(cle), cert: certificat, allowHTTP1: true })
  rmSync(dossier, { recursive: true, force: true })
  // Le navigateur croira ce certificat sur son empreinte (`--ignore-certificate-errors-spki-list`) :
  // avec `ignoreHTTPSErrors`, Chrome ne met rien en cache d'un site au certificat
  // refusé, et le cache plein se mesurait comme le cache vide.
  const empreinte = createHash('sha256')
    .update(new X509Certificate(certificat).publicKey.export({ type: 'spki', format: 'der' }))
    .digest('base64')
  serveur.on('request', (req: any, res: any) => {
    const entetes: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(req.headers as Record<string, string | string[]>)) if (!k.startsWith(':')) entetes[k] = v
    entetes.host = req.headers[':authority'] ?? req.headers.host
    const amont = http.request({ host: '127.0.0.1', port: cible, method: req.method, path: req.url, headers: entetes }, r => {
      const retour = { ...r.headers }
      // Les en-têtes de connexion n'existent pas en HTTP/2.
      for (const k of ['connection', 'keep-alive', 'transfer-encoding', 'proxy-connection', 'upgrade']) delete retour[k]
      res.writeHead(r.statusCode ?? 502, retour)
      r.pipe(res)
    })
    amont.on('error', () => res.destroy())
    req.pipe(amont)
  })
  // La liaison temps réel : la poignée de main recopiée telle quelle, puis
  // chaque morceau retardé d'un demi aller-retour dans chaque sens — le même
  // délai pour tous garde leur ordre.
  serveur.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, tete: Buffer) => {
    const relayer = (de: net.Socket, vers: net.Socket) => {
      de.on('data', (m: Buffer) => {
        const delai = latenceTempsReel / 2
        if (delai > 0) setTimeout(() => vers.writable && vers.write(m), delai)
        else vers.write(m)
      })
      de.on('close', () => setTimeout(() => vers.destroy(), latenceTempsReel / 2))
    }
    const amont = net.connect(cible, '127.0.0.1', () => {
      const lignes = [`${req.method} ${req.url} HTTP/1.1`]
      for (let i = 0; i < req.rawHeaders.length; i += 2) lignes.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
      amont.write(lignes.join('\r\n') + '\r\n\r\n')
      if (tete.length) amont.write(tete)
      relayer(amont, socket)
      relayer(socket, amont)
    })
    amont.on('error', () => socket.destroy())
    socket.on('error', () => amont.destroy())
  })
  await new Promise<void>(r => serveur.listen(0, r))
  const port = (serveur.address() as net.AddressInfo).port
  return { url: `https://localhost:${port}`, empreinte, fermer: () => serveur.close() }
}

// ── La séance ─────────────────────────────────────────────────────────────

interface Etat {
  url: string
  hote: string
  lea: string
  zoe: { playerId: string; token: string }
}

const banc = await demarrer({ prechauffageCampagneMs: 0, clientDist })
// Le relais d'abord : le navigateur se lance en croyant son certificat.
const relais = args.has('http1') ? null : await relaisHttp2(banc.server.port)
if (!relais && !args.has('http1')) console.error('openssl introuvable : les pages passent en HTTP/1.1, où les morceaux d’une route font la queue six par six.')
const navigateur = await chromium.launch({ headless: true, args: relais ? [`--ignore-certificate-errors-spki-list=${relais.empreinte}`] : [] })
const toutes: Mesure[] = []
const aRevoir = new Set<string>()
try {
  const seme = await semer(banc.url)
  const etat: Etat = { url: relais?.url ?? banc.url, ...seme }
  const choisies = PAGES.filter(p => pagesVoulues.includes(p.cle))

  // Un premier passage sans bridage : le serveur remplit ses caches (le
  // souvenir, la base de la campagne) comme après le premier visiteur.
  for (const page of choisies) {
    await mesurer(navigateur, page, 'brut', 'froid', etat, null).catch((e: Error) => {
      console.error(`[${page.cle}] l’écran utile ne vient pas (${page.pret}) : ${e.message.split('\n')[0]}`)
    })
  }

  const parReseau = new Map<string, { page: PageMesuree; cache: string; runs: Mesure[] }[]>()
  for (const page of choisies) {
    for (const reseau of page.reseaux ?? reseauxVoulus) {
      for (const cache of caches) {
        const runs: Mesure[] = []
        for (let i = 0; i < essais; i++) {
          const photo = photos && i === 0 ? path.join(photos, `${page.cle}-${reseau}-${cache}.png`) : null
          try {
            runs.push(await mesurer(navigateur, page, reseau, cache, etat, photo))
          } catch (e) {
            console.error(`[${page.cle} · ${reseau} · ${cache}] échec : ${(e as Error).message.split('\n')[0]}`)
          }
        }
        process.stdout.write('.')
        for (const m of runs) {
          for (const c of m.prechargement.jamaisDemandees) aRevoir.add(`${page.nom} : ${c} préchargée, jamais demandée`)
          for (const c of m.prechargement.doublees) aRevoir.add(`${page.nom} : ${c} demandée une seconde fois`)
        }
        toutes.push(...runs)
        const groupe = parReseau.get(reseau) ?? []
        groupe.push({ page, cache, runs })
        parReseau.set(reseau, groupe)
        if (args.has('cascade') && cache === 'froid' && runs[0]) ecrireCascade(runs[0], page)
      }
    }
  }
  console.log()
  if (aRevoir.size) {
    console.log('\nPréchargements que la page n’a pas repris (`shared/depart.ts`) :')
    for (const ligne of aRevoir) console.log(`  ${ligne}`)
  }
  for (const [reseau, lignes] of parReseau) {
    const processeur = lignes.some(l => l.page.appareil === 'tele') ? APPAREILS.tele.processeur : APPAREILS.telephone.processeur
    const bridage = RESEAUX[reseau] ? `${RESEAUX[reseau]!.nom} · processeur ralenti ×${processeur}` : 'sans bridage, processeur à pleine vitesse'
    tableau(`${bridage} · ${essais} essai${essais > 1 ? 's' : ''}`, lignes)
  }

  if (args.has('couverture')) {
    console.log('\nCouverture (sans bridage, jusqu’à l’écran utile) : ce que la page a servi de ce qu’elle a chargé')
    for (const page of choisies) {
      const c = await couverture(navigateur, page, etat)
      const part = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—')
      console.log(
        `  ${colonne(page.nom, 27, true)} JS ${colonne(ko(c.js.charge), 5)} ko en ${colonne(String(c.js.fichiers), 2)} fichiers, ${colonne(part(c.js.servi, c.js.charge), 5)} servis · CSS ${colonne(ko(c.css.charge), 5)} ko, ${colonne(part(c.css.servi, c.css.charge), 5)} servis`,
      )
    }
  }
  if (sortieJson) {
    writeFileSync(sortieJson, JSON.stringify(toutes, null, 1))
    console.log(`\n${sortieJson}`)
  }
} finally {
  await navigateur.close()
  relais?.fermer()
  await banc.close()
}
// Les connexions du banc et le serveur fermés, rien ne doit plus tenir le processus.
process.exit(0)

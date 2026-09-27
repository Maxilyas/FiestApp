// Combien d'allers-retours vers la base permanente coûte chaque route des
// PR #58 et #59, sur un serveur qui a vécu (500 profils, trente jours de quiz
// du jour, la veille jouée par 500 et pas encore close) — et ce que cela fait
// à 50 ms par aller-retour, la latence de Turso en production.
//
// Mesure, pas épreuve : rien n'échoue ici, tout s'écrit dans
// `mesures-routes.json`. Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=900000 ../export/evaluations/perf-serveur/routes.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { compteur, ligne, mesurer, type Mesure } from './compteur'
import { peupler } from './peupler'
import { ADMIN, connexionAnimateur, demarrer, ecranCommun, ecrire, invite, patienter, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false
// `PROTOTYPE=1` : les pistes 1 et 2 prototypées (`prototype.ts`), pour chiffrer leur gain.
if (process.env.PROTOTYPE) await import('./prototype')

const RTT = 50
const HEURE = 3600_000
/** Dimanche 27 septembre 2026, 7 h à Paris. */
const MATIN = Date.UTC(2026, 8, 27, 5, 0)
const AUJOURDHUI = '2026-09-27'

const resultats: Mesure[] = []
const noter = (m: Mesure) => {
  resultats.push(m)
  console.log(ligne(m))
  const tops = Object.entries(m.parAppelant).sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log('   ', tops.map(([k, v]) => `${v}× ${k}`).join(' · '))
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function bonnes(banc: Banc, jour: string): number[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string }
    return (JSON.parse(r.questions) as { bonne: number }[]).map(q => q.bonne)
  } finally {
    db.close()
  }
}

test('les routes du quiz du jour et du profil, comptées', async () => {
  console.log('charge :', execSync('uptime').toString().trim())
  const horloge = { t: MATIN }
  const { mesure: m0, resultat: banc } = await mesurer('démarrage, base vide', () => demarrer({ horlogeDuJour: () => horloge.t }), RTT)
  noter(m0)
  try {
    const fichier = banc.quizDbUrl.replace(/^file:/, '')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const pop = peupler(fichier, { spaceId, aujourdhui: AUJOURDHUI })
    const [alice] = pop.ids
    const cAlice = pop.cookie(alice)

    noter((await mesurer('démarrage, 500 profils et trente jours', () => banc.redemarrer(), RTT)).mesure)

    // ── Le matin : la première visite du jour, serveur tout juste réveillé ──
    let r = await mesurer('GET /api/jour — 1re visite du jour, serveur réveillé (clôt la veille : 500 joueurs)', () => lire(banc, cAlice, '/api/jour'), RTT)
    noter(r.mesure)
    noter((await mesurer('GET /api/jour — visite suivante', () => lire(banc, cAlice, '/api/jour'), RTT)).mesure)
    noter((await mesurer('GET /api/joueur/moi — l’accueil d’un profil connecté (25 soirées, 30 jours)', () => lire(banc, cAlice, '/api/joueur/moi'), RTT)).mesure)
    noter((await mesurer('GET /api/joueur/moi — une seconde fois', () => lire(banc, cAlice, '/api/joueur/moi'), RTT)).mesure)
    const bob = pop.ids[1]
    noter((await mesurer('GET /api/joueur/moi — un profil de 1 à 10 soirées', () => lire(banc, pop.cookie(bob), '/api/joueur/moi'), RTT)).mesure)

    // ── La carte d'un joueur, en soirée ──
    const animateur = await connexionAnimateur(banc.url)
    await ecranCommun(banc.url, animateur)
    const enSoiree = await invite(banc.url, 'Alice', '', { cookie: cAlice })
    const anonyme = await invite(banc.url, 'Zoé', '🐸')
    await patienter(300)
    noter((await mesurer('GET /s/<espace>/joueurs/<id>.json — la carte d’un profil', () => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${enSoiree.playerId}.json`).then(x => x.json()), RTT)).mesure)
    noter((await mesurer('GET /s/<espace>/joueurs/<id>.json — la même, touchée encore', () => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${enSoiree.playerId}.json`).then(x => x.json()), RTT)).mesure)
    noter((await mesurer('GET /s/<espace>/joueurs/<id>.json — un invité anonyme', () => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${anonyme.playerId}.json`).then(x => x.json()), RTT)).mesure)
    enSoiree.socket.close()
    anonyme.socket.close()

    // ── Une partie du jour, geste par geste, à 50 ms ──
    horloge.t = MATIN + 12 * HEURE
    noter((await mesurer('GET /api/jour — à jouer', () => lire(banc, cAlice, '/api/jour'), RTT)).mesure)
    let etat = (r = await mesurer('POST /api/jour/commencer', () => poster(banc, cAlice, '/api/jour/commencer'), RTT)).resultat.corps
    noter(r.mesure)
    const justes = bonnes(banc, AUJOURDHUI)
    const partie: Mesure[] = [r.mesure]
    while (etat.question) {
      const i = etat.question.index
      const rep = await mesurer(`POST /api/jour/repondre (question ${i + 1})`, () => poster(banc, cAlice, '/api/jour/repondre', { jour: AUJOURDHUI, index: i, choix: i % 3 ? justes[i] : (justes[i] + 1) % 4 }), RTT)
      const sui = await mesurer(`POST /api/jour/suivante (après ${i + 1})`, () => poster(banc, cAlice, '/api/jour/suivante'), RTT)
      partie.push(rep.mesure, sui.mesure)
      if (i === 0 || i === 9) {
        noter(rep.mesure)
        noter(sui.mesure)
      }
      etat = sui.resultat.corps
    }
    const somme = (ms: Mesure[], quoi: string): Mesure => ({
      quoi,
      appels: ms.reduce((n, m) => n + m.appels, 0),
      instructions: ms.reduce((n, m) => n + m.instructions, 0),
      lignes: ms.reduce((n, m) => n + m.lignes, 0),
      octets: ms.reduce((n, m) => n + m.octets, 0),
      ms: ms.reduce((n, m) => n + m.ms, 0),
      enSerie: ms.reduce((n, m) => n + (m.enSerie ?? 0), 0),
      rtt: RTT,
      parAppelant: {},
    })
    noter(somme(partie.filter(m => m.quoi.startsWith('POST /api/jour/repondre')), 'les 10 réponses'))
    noter(somme(partie.filter(m => m.quoi.startsWith('POST /api/jour/suivante')), 'les 10 « suivante »'))
    noter(somme(partie, 'la partie entière (commencer + 10 × répondre + suivante)'))
    noter((await mesurer('GET /api/joueur/moi — à la fin de la partie (JourApp le relit)', () => lire(banc, cAlice, '/api/joueur/moi'), RTT)).mesure)
    noter((await mesurer('GET /api/jour/classement — du jour', () => lire(banc, cAlice, `/api/jour/classement?jour=${AUJOURDHUI}`), RTT)).mesure)
    noter((await mesurer('GET /api/jour/classement — d’hier (500 joueurs)', () => lire(banc, cAlice, '/api/jour/classement?jour=2026-09-26'), RTT)).mesure)
    noter((await mesurer('GET /api/jour/classement — du mois', () => lire(banc, cAlice, '/api/jour/classement?mois=2026-09'), RTT)).mesure)
    noter((await mesurer('GET /api/jour/correction/<jour>', () => lire(banc, cAlice, `/api/jour/correction/${AUJOURDHUI}`), RTT)).mesure)

    // ── L'heure de pointe : 199 autres profils jouent entre 20 h et 21 h ──
    // Compté sans latence (le compte ne dépend pas d'elle), dans l'ordre où
    // JourApp appelle : moi + jour à l'ouverture, commencer, 10 × (répondre +
    // suivante), moi à la fin, et le classement du jour pour un sur deux.
    const parRoute = new Map<string, Mesure[]>()
    const garder = (route: string, m: Mesure) => parRoute.set(route, [...(parRoute.get(route) ?? []), m])
    const debutPointe = performance.now()
    for (let k = 1; k < 200; k++) {
      horloge.t = MATIN + 13 * HEURE + k * 18_000
      const id = pop.ids[k]
      const c = pop.cookie(id)
      garder('GET /api/joueur/moi', (await mesurer('moi', () => lire(banc, c, '/api/joueur/moi'), 0)).mesure)
      garder('GET /api/jour', (await mesurer('jour', () => lire(banc, c, '/api/jour'), 0)).mesure)
      const deb = await mesurer('commencer', () => poster(banc, c, '/api/jour/commencer'), 0)
      garder('POST /api/jour/commencer', deb.mesure)
      let e = deb.resultat.corps
      while (e.question) {
        const i = e.question.index
        // Un temps de réponse varié : sans lui, tous les sans-faute seraient
        // ex æquo, et le podium de la nuit compterait des dizaines de marches.
        horloge.t += 1500 + ((k * 7919 + i * 104729) % 12000)
        garder('POST /api/jour/repondre', (await mesurer('rep', () => poster(banc, c, '/api/jour/repondre', { jour: AUJOURDHUI, index: i, choix: (k + i) % 5 ? justes[i] : (justes[i] + 1) % 4 }), 0)).mesure)
        const s = await mesurer('sui', () => poster(banc, c, '/api/jour/suivante'), 0)
        garder('POST /api/jour/suivante', s.mesure)
        e = s.resultat.corps
      }
      garder('GET /api/joueur/moi (fin)', (await mesurer('moi', () => lire(banc, c, '/api/joueur/moi'), 0)).mesure)
      if (k % 2) garder('GET /api/jour/classement', (await mesurer('cl', () => lire(banc, c, `/api/jour/classement?jour=${AUJOURDHUI}`), 0)).mesure)
    }
    const dureePointe = performance.now() - debutPointe
    const pointe: Record<string, unknown> = { dureeMsSansLatence: Math.round(dureePointe) }
    let total = 0
    let octets = 0
    for (const [route, ms] of parRoute) {
      const s = somme(ms, route)
      total += s.appels
      octets += s.octets
      pointe[route] = {
        requetes: ms.length,
        allersRetours: s.appels,
        parRequete: +(s.appels / ms.length).toFixed(1),
        lignesParRequete: Math.round(s.lignes / ms.length),
        koParRequete: +(s.octets / ms.length / 1024).toFixed(1),
        dernier: { appels: ms.at(-1)!.appels, lignes: ms.at(-1)!.lignes, ko: +(ms.at(-1)!.octets / 1024).toFixed(1) },
      }
    }
    pointe.total = { allersRetours: total, parPartie: Math.round(total / 199), mo: +(octets / 1024 / 1024).toFixed(1), parSeconde: +(total / 3600).toFixed(1) }
    console.log('heure de pointe :', JSON.stringify(pointe, null, 1))
    console.log('charge :', execSync('uptime').toString().trim())

    // ── Minuit passé : la première demande clôt le jour de 200 joueurs ──
    horloge.t = MATIN + 17 * HEURE + 5 * 60_000
    noter((await mesurer('GET /api/jour — 0 h 05, la première demande clôt le jour (200 joueurs, profils en mémoire)', () => lire(banc, pop.cookie(pop.ids[5]), '/api/jour'), RTT)).mesure)

    // ── Le réveil suivant : Render s'est endormi, la mémoire est vide ──
    horloge.t = MATIN + 24 * HEURE
    await banc.redemarrer()
    noter((await mesurer('GET /api/joueur/moi — au réveil (profil pas en mémoire)', () => lire(banc, cAlice, '/api/joueur/moi'), RTT)).mesure)
    noter((await mesurer('GET /api/jour — au réveil, rien à clore (hier : 200 joueurs)', () => lire(banc, cAlice, '/api/jour'), RTT)).mesure)
    noter((await mesurer('GET /api/jour/classement — du mois, au réveil', () => lire(banc, cAlice, '/api/jour/classement?mois=2026-09'), RTT)).mesure)
    await banc.redemarrer()
    noter((await mesurer('GET /api/jour/classement — du mois, au réveil, en premier', () => lire(banc, cAlice, '/api/jour/classement?mois=2026-09'), RTT)).mesure)

    writeFileSync(
      new URL(process.env.PROTOTYPE ? './mesures-routes-prototype.json' : './mesures-routes.json', import.meta.url),
      JSON.stringify({ rtt: RTT, charge: execSync('uptime').toString().trim(), mesures: resultats, pointe }, null, 1),
    )
  } finally {
    compteur.rtt = 0
    await banc.close()
  }
})

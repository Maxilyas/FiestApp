// Les connexions vers la base pendant qu'une joueuse joue au Cabinet, entretien
// allumé (`QUIZ_DB_KEEPWARM`) — `../latences-du-cabinet.md` : le faux Turso
// dehors, qui referme une connexion après 5 s de calme comme Turso et fait payer
// une connexion neuve (`POIGNEE_MS`, ~0,45 s mesurées en production le 4
// novembre 2026), le transport léger et le client minimal de la production. Chaque
// connexion ouverte se rapporte à la requête qui l'a payée — deux requêtes de
// front la comptent chacune —, et la joueuse joue au rythme d'une personne.
//
//   cd server && RAFALE=1 PAUSE_MS=6000 PATIENCE_MS=150 node --import tsx ../retours/2026-11-04/reproductions/connexions-du-bilan.ts
//
// `RAFALE=1` : le bilan de chaque épreuve comme la page le fait, la carte et ses missions de front
// (`MissionsDeLEpreuve`) — un lot par magasin pour les missions. `PAUSE_MS` : entre deux gestes ; à 6 s, une minute
// passe d'un bilan au suivant, comme en production, et l'entretien a oublié le pic du bilan d'avant.
// `LONGUE_PAUSE_MS` : une pause devant la carte, au milieu (75 s d'office, 0 pour s'en passer) — au-delà de la minute
// de l'entretien (`CHAUDES_MS`), ses connexions se referment. `PATIENCE_MS` : la patience des connexions
// (`QUIZ_DB_PATIENCE_MS`), zéro d'office.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { DONNEES, attendre, fauxTurso } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, inscrireProfil } from '../../../server/test/banc.ts'
import { choisirLaPatience, choisirLeClient, choisirLeTransport } from '../../../server/src/core/distante.ts'
import { releve } from '../../../server/src/core/pouls.ts'
import { LECTURES_GARDEES_MS } from '../../../server/src/core/lecturesGardees.ts'
import {
  jouerDesIndices, jouerUnDetail, jouerUneEpingle, jouerUneFrise, jouerUneReplique, jouerUnEclair, jouerUnFilet, jouerUnMot, jouerUnPari, jouerUnQuiz, ouvrir,
  type BancDuCabinet,
} from '../../../server/test/cabinet-banc.ts'

const PAUSE_MS = Number(process.env.PAUSE_MS ?? 2500)
const LONGUE_PAUSE_MS = Number(process.env.LONGUE_PAUSE_MS ?? 75_000)
const EPREUVES = Number(process.env.EPREUVES ?? 6)
const PATIENCE_MS = Number(process.env.PATIENCE_MS ?? 0)
const RAFALE = process.env.RAFALE === '1'
choisirLeTransport('leger')
choisirLeClient('minimal')
choisirLaPatience(PATIENCE_MS)

// Les connexions ouvertes, comptées où le serveur les compte : pour un joueur, ou par un battement de l'entretien.
let pourLaRequete = 0
let parBattement = 0
const noterUneConnexion = releve.connexion.bind(releve)
releve.connexion = () => {
  pourLaRequete++
  noterUneConnexion()
}
const noterParBattement = releve.connexionParUnBattement.bind(releve)
releve.connexionParUnBattement = () => {
  parBattement++
  noterParBattement()
}

// Une base à chaque réglage : deux bancs de front ne s'effacent pas l'un l'autre.
const fichier = path.join(DONNEES, `connexions-du-bilan-${PATIENCE_MS}.db`)
mkdirSync(DONNEES, { recursive: true })
const faux = await fauxTurso(fichier)
await faux.latence(Number(process.env.LATENCE_MS ?? 40))
await faux.connexions({ refermeApresMs: 5000, poigneeMs: Number(process.env.POIGNEE_MS ?? 450) })
const banc = await demarrer({
  quizDbUrl: faux.url,
  cabinet: true,
  expeditionRemplacee: true,
  prechauffageCampagneMs: 200,
  prechauffageAuProfil: true,
  fraicheurDesLecturesMs: LECTURES_GARDEES_MS,
  fraicheurDesDuelsMs: 30_000,
  connexionsChaudes: true,
})
const b: BancDuCabinet = { banc, horloge: { t: Date.now() }, fichier }
const t0 = performance.now()

type Mesure = { quoi: string; ms: number; neuves: number }
const mesures: Mesure[] = []
const fetchDOrigine = globalThis.fetch
let etiquette = ''
globalThis.fetch = (async (entree: any, init?: any) => {
  const adresse = typeof entree === 'string' ? entree : entree.url
  if (!adresse.startsWith(banc.url)) return fetchDOrigine(entree, init)
  const chemin = adresse.slice(banc.url.length).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, ':id').replace(/\/\d+\/\d+$/, '/:t/:c')
  const quoi = `${(init?.method ?? 'GET').padEnd(4)} ${chemin}${etiquette ? ` · ${etiquette}` : ''}`
  const avant = pourLaRequete
  const debut = performance.now()
  const r = await fetchDOrigine(entree, init)
  const corps = await r.arrayBuffer()
  const ms = Math.round(performance.now() - debut)
  // Ce qu'elle lance derrière sa réponse — un préchauffage, une relecture — se compte encore à elle un instant.
  await attendre(30)
  const m = { quoi, ms, neuves: pourLaRequete - avant }
  mesures.push(m)
  console.log(`${String(Math.round(performance.now() - t0)).padStart(7)}  ${quoi.padEnd(62)} ${String(ms).padStart(6)} ms${m.neuves ? `  +${m.neuves} connexion(s)` : ''}`)
  // Le rythme d'une personne : elle lit, elle réfléchit, elle touche.
  await attendre(PAUSE_MS)
  return new Response(corps, { status: r.status, statusText: r.statusText, headers: r.headers })
}) as typeof fetch

const cookie = await inscrireProfil(banc.url, 'voyageuse', 'Voyageuse')
const entete = { Cookie: cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Origin: banc.url }
const ok = async (r: Response | Promise<Response>, quoi: string) => {
  const rr = await r
  const corps = await rr.json()
  if (rr.status !== 200) throw new Error(`${quoi} : ${rr.status} ${JSON.stringify(corps).slice(0, 300)}`)
  return corps as any
}
const lire = (chemin: string) => fetch(`${banc.url}${chemin}`, { headers: entete })
const poster = (chemin: string, corps: unknown) => fetch(`${banc.url}${chemin}`, { method: 'POST', headers: entete, body: JSON.stringify(corps) })
async function jouerLaManche(vue: any, k: number): Promise<any> {
  switch (vue.jeu) {
    case 'pari': return jouerUnPari(b, cookie, vue, k, 'garder')
    case 'eclair': return jouerUnEclair(b, cookie, vue, k, true)
    case 'quiz': return jouerUnQuiz(b, cookie, vue, k, true)
    case 'frise': return jouerUneFrise(b, cookie, vue, k, true)
    case 'detail': return jouerUnDetail(b, cookie, vue, k)
    case 'mot': return jouerUnMot(b, cookie, vue, k, 1)
    case 'filet': return jouerUnFilet(b, cookie, vue, k)
    case 'epingle': return jouerUneEpingle(b, cookie, vue, k)
    case 'indices': return jouerDesIndices(b, cookie, vue, k)
    case 'replique': return jouerUneReplique(b, cookie, vue, k)
    default: throw new Error(`jeu inconnu ${vue.jeu}`)
  }
}

etiquette = 'la page'
await ok(lire('/api/cabinet/traversee'), 'la page')
await attendre(15_000)
etiquette = 'départ'
let t = (await ok(poster('/api/cabinet/traversee', {}), 'le départ')).traversee
etiquette = 'cartes'
t = (await ok(poster(`/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'cartes', cartes: ['coup-d-oeil', 'parade', 'panacee'] } }), 'les cartes')).traversee
let epreuves = 0
let pause = LONGUE_PAUSE_MS > 0
for (let pas = 0; pas < 40 && !t.fin && epreuves < EPREUVES; pas++) {
  if (t.ameliorations > 0 && t.offrables?.length) {
    etiquette = 'améliorer'
    t = (await ok(poster(`/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'ameliorer', carte: t.offrables[0] } }), 'améliorer')).traversee
    continue
  }
  const toutes = t.actes.flatMap((a: any) => a.etapes)
  const sorte = (id: string) => toutes.find((x: any) => x.id === id)?.sorte
  const ids: string[] = t.atteignables
  if (ids.length === 0) break
  const etape = toutes.find((e: any) => e.id === (ids.find(id => sorte(id) === 'gardien') ?? ids.find(id => sorte(id) === 'epreuve') ?? ids[0]))
  if (pause && epreuves === Math.floor(EPREUVES / 2)) {
    pause = false
    console.log(`— une longue pause : ${LONGUE_PAUSE_MS / 1000} s devant la carte`)
    await attendre(LONGUE_PAUSE_MS)
  }
  etiquette = `aller ${etape.sorte}${etape.jeu ? ' ' + etape.jeu : ''}`
  const page = await ok(poster(`/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'aller', etape: etape.id, ...(etape.choix ? { theme: 0 } : {}) } }), etiquette)
  t = page.traversee
  let v = t.partie ?? page.partie
  if (!v) continue
  epreuves++
  for (let k = 0; k < 3; k++) {
    if (v.phase === 'finie') break
    etiquette = `${v.jeu} manche ${k}`
    if (k > 0) v = await ouvrir(b, cookie, v, k)
    if (v.phase === 'finie') break
    v = await jouerLaManche(v, k)
  }
  if (v.phase !== 'finie') {
    etiquette = `${v.jeu} quitter`
    await ok(poster(`/api/cabinet/partie/${v.id}/geste`, { rang: v.rang, geste: { quoi: 'quitter' } }), 'quitter')
  }
  if (RAFALE) {
    etiquette = 'bilan (carte + missions)'
    const [carte] = await Promise.all([ok(lire('/api/cabinet/traversee'), 'la carte'), ok(lire('/api/joueur/missions'), 'les missions')])
    t = carte.traversee
  } else {
    etiquette = 'carte (conclure)'
    t = (await ok(lire('/api/cabinet/traversee'), 'la carte')).traversee
  }
}

console.log(`\n== ${mesures.length} requêtes, ${pourLaRequete} connexion(s) neuve(s) pour la joueuse, ${parBattement} par un battement (patience ${PATIENCE_MS} ms)`)
const parSorte = new Map<string, Mesure[]>()
const sorteDe = (q: string) => q.replace(/ manche \d/, ' manche').replace(/(aller (epreuve|gardien)) \w+/, '$1').replace(/^\S+\s+/, '')
for (const m of mesures) parSorte.set(sorteDe(m.quoi), [...(parSorte.get(sorteDe(m.quoi)) ?? []), m])
for (const [quoi, ms] of [...parSorte].sort((a, c) => c[1].reduce((s, m) => s + m.neuves, 0) - a[1].reduce((s, m) => s + m.neuves, 0))) {
  const tries = ms.map(m => m.ms).sort((a, c) => a - c)
  console.log(`${quoi.padEnd(58)} n=${String(ms.length).padStart(3)}  neuves ${String(ms.reduce((s, m) => s + m.neuves, 0)).padStart(3)}  ms médiane ${tries[Math.floor(tries.length / 2)]}  pire ${tries[tries.length - 1]}`)
}
await banc.close()
faux.fermer()

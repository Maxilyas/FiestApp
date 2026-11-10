// Le Filet en production, et ce que d'autres règles en auraient fait (`../le-nouveau-filet.md`, « Ce que la
// production a montré ») : chaque lancer réel du Filet — le curseur posé, la taille du filet, la valeur, la piste —
// rejugé sous chaque règle candidate. Le curseur dit ce que le joueur croyait ; la règle dit ce que ça vaut. Chaque
// règle se compare au même joueur qui ne lit pas la question (le curseur laissé au milieu). En lecture seule, des
// totaux : aucun profil, aucun nom.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-09/reproductions/filet-en-production.ts [lancers|regles]
//
//   lancers   le choix du filet, l'écart des curseurs par marche, ce que le hasard attrape
//   regles    les lancers rejugés : le filet qui se resserre, les rapports, les deux temps, le tirage du moteur
//             (les notes du panel de l'IA : ../maquette-filet/panel-ia.json)
//   ancrage   ce que chaque Français sait placer, contre le reste (../maquette-filet/ancrage.json)
//   estime    ce que chaque Français sait estimer, au-delà de ce qu'il sait (estime-des-posees.json)
//   pilote    les dix-neuf questions du pilote, une fois en ligne (pilote-du-filet.json)
//   actes     la loi des étoiles de chaque acte, en deux temps : le joueur modèle du calibrage de la traversée
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(ICI, '../../../server/package.json'))
const quoi = process.argv[2] ?? 'lancers'

const url = process.env.PROD_LECTURE_URL, authToken = process.env.PROD_LECTURE_TOKEN
if (!url || !authToken) throw new Error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN, un jeton en lecture seule — jamais QUIZ_DB_URL')
const db = require('@libsql/client').createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })

interface Lancer {
  id: string; niveau: string; annee: boolean; valeur: number; piste: { min: number; max: number }
  x: number; taille: 'petit' | 'moyen' | 'grand'; jour: string
}
/** Les lancers du Filet : chaque partie qui en a, son plan figé (`campagne_series.cabinet`) et ses gestes. */
async function lesLancers(): Promise<Lancer[]> {
  const series = (await db.execute(`SELECT id, cabinet FROM campagne_series WHERE mode = 'cabinet' AND cabinet LIKE '%"jeu":"filet"%'`)).rows as Record<string, unknown>[]
  const gestes = new Map<unknown, any[]>()
  for (let i = 0; i < series.length; i += 50) {
    const lot = series.slice(i, i + 50).map(s => s.id)
    const r = await db.execute({ sql: `SELECT serie_id, geste FROM cabinet_gestes WHERE serie_id IN (${lot.map(() => '?').join(',')}) ORDER BY serie_id, rang`, args: lot })
    for (const g of r.rows as Record<string, unknown>[]) gestes.set(g.serie_id, [...(gestes.get(g.serie_id) ?? []), JSON.parse(String(g.geste))])
  }
  const lancers: Lancer[] = []
  for (const s of series) {
    const d = JSON.parse(String(s.cabinet))
    if (d.jeu !== 'filet') continue
    const gs = gestes.get(s.id) ?? []
    for (const g of gs) {
      // Une manche changée joue sa rechange, ailleurs dans le plan : elle ne se rejuge pas ici.
      if (g.quoi !== 'repondre' || gs.some(x => x.quoi === 'changer' && x.manche === g.manche)) continue
      const t = d.tirages[g.manche]
      if (!t || t.jeu !== 'filet' || !g.reponse?.filet) continue
      lancers.push({ id: t.question.id, niveau: t.question.niveau, annee: t.annee, valeur: t.valeur, piste: t.piste, x: g.reponse.filet.x, taille: g.reponse.filet.taille, jour: d.jour })
    }
  }
  return lancers
}

const DEMI = { petit: 0.035, moyen: 0.09, grand: 0.2 }, ETOILES = { petit: 3, moyen: 2, grand: 1 }
const L = (l: Lancer) => l.piste.max - l.piste.min
const ecart = (l: Lancer, x = l.x) => Math.abs(x - l.valeur) / L(l)
const milieu = (l: Lancer) => (l.piste.min + l.piste.max) / 2
const pct = (a: number, b: number) => `${Math.round((100 * a) / b)} %`.padStart(5)
const lancers = await lesLancers()
console.log(`${lancers.length} lancers, ${new Set(lancers.map(l => l.id)).size} questions distinctes\n`)
// Ce qui se calcule (« les grammes d'un kilogramme ») n'est pas posé au nouveau Filet (§ 5.4) : les lignes qui
// simulent son tirage le laissent de côté. Compté, il flattait les questions « faciles » : tout le monde le « sait ».
const donnees = fs.readFileSync(path.resolve(ICI, '../maquette-filet/donnees.js'), 'utf8')
const calculs = new Set((JSON.parse(donnees.slice(donnees.indexOf('{'), donnees.lastIndexOf('}') + 1)).questions as any[]).filter(q => q.calcul).map(q => q.id))

// Le Filet en deux temps, à la règle même de la maquette (`jeu.js`, `naturelles`) et du cahier des charges (§ 3.3),
// lu sur le curseur réel — une borne basse. Une année : des époques alignées de 25 ans depuis 1800, de 50 de 1500 à
// 1799, d'un siècle avant ; ★★★ à un douzième, ★★ à un quart. Une grandeur : les tranches 1, 3, 10, 30…, une
// réponse pile sur une borne des deux ; ★★★ à 6 %, ★★ à 25 % de la réponse, l'écart lu au dixième comme l'écran
// l'écrit. La distance d'abord, puis la bonne tranche.
const borneDuDemi = (k: number) => (k % 2 === 0 ? 10 ** (k / 2) : 3 * 10 ** ((k - 1) / 2))
const trancheDe = (v: number) => { let k = 0; while (borneDuDemi(k + 1) <= v) k++; return k }
// `demi` : ★ aussi à moins d'une demi-tranche de la réponse — 12 ans sur 25, 50 % d'une grandeur —, même dans la
// tranche d'à côté. La tablée du 9 novembre 2026 : « onze ans ou cent trente-trois, même tarif » (Samir).
function deuxTemps(l: Lancer, x: number, demi = false): number {
  if (l.annee) {
    const T = l.valeur >= 1800 ? 25 : l.valeur >= 1500 ? 50 : 100
    const e = Math.abs(x - l.valeur)
    if (e <= Math.max(1, Math.round(T / 12))) return 3
    if (e <= Math.round(T / 4)) return 2
    if (demi && e <= Math.floor(T / 2)) return 1
    return Math.floor(x / T) === Math.floor(l.valeur / T) ? 1 : 0
  }
  const p = Math.round((1000 * Math.abs(x - l.valeur)) / l.valeur) / 10
  if (p <= 6) return 3
  if (p <= 25) return 2
  if (demi && p <= 50) return 1
  if (x < 1) return 0
  const kx = trancheDe(x), kv = trancheDe(l.valeur)
  return kx === kv || (l.valeur === borneDuDemi(kv) && kx === kv - 1) ? 1 : 0
}
if (quoi === 'lancers') {
  const tailles = (['petit', 'moyen', 'grand'] as const).map(t => `${t} ${lancers.filter(l => l.taille === t).length}`).join(', ')
  const pris = lancers.filter(l => ecart(l) <= DEMI[l.taille] + 1e-9).length
  console.log(`Filets choisis : ${tailles}`)
  console.log(`Pris dans son filet : ${pct(pris, lancers.length)} — le grand filet au même endroit : ${pct(lancers.filter(l => ecart(l) <= 0.2).length, lancers.length)} — le grand au milieu, sans lire : ${pct(lancers.filter(l => ecart(l, milieu(l)) <= 0.2).length, lancers.length)}`)
  console.log('\nmarche        lancers  < 2 % (il savait)  2–20 %  > 20 %')
  for (const n of ['facile', 'moyen', 'difficile', 'expert']) {
    const ls = lancers.filter(l => l.niveau === n)
    if (!ls.length) continue
    console.log(`${n.padEnd(12)} ${String(ls.length).padStart(8)}  ${pct(ls.filter(l => ecart(l) <= 0.02).length, ls.length).padStart(17)}  ${pct(ls.filter(l => ecart(l) > 0.02 && ecart(l) <= 0.2).length, ls.length)}  ${pct(ls.filter(l => ecart(l) > 0.2).length, ls.length)}`)
  }
  const tiers = lancers.filter(l => Math.floor((3 * (l.x - l.piste.min)) / L(l)) === Math.floor((3 * (l.valeur - l.piste.min)) / L(l))).length
  console.log(`\nCurseur dans le bon tiers de la piste : ${pct(tiers, lancers.length)} (au hasard : 33 %)`)
  const g = lancers.filter(l => !l.annee).map(l => (l.valeur - l.piste.min) / L(l)).sort((a, b) => a - b)
  console.log(`Grandeurs : la réponse aux quartiles ${[0.25, 0.5, 0.75].map(q => g[Math.floor(q * g.length)].toFixed(2)).join(' · ')} de la piste — le filet moyen y vaut de ±10 % à ±113 % de la valeur`)
} else if (quoi === 'regles') {
  const paliers = (e: number, [a, b, c]: number[]) => (e <= a ? 3 : e <= b ? 2 : e <= c ? 1 : 0)
  const rapport = (l: Lancer, x: number) => Math.abs(Math.log(Math.max(x, l.piste.max / 1000) / l.valeur))
  const regles: [string, (l: Lancer, x: number, aveugle: boolean) => number][] = [
    ['Aujourd’hui (le filet choisi)', (l, x, aveugle) => { const t = aveugle ? 'grand' : l.taille; return ecart(l, x) <= DEMI[t] + 1e-9 ? ETOILES[t] : 0 }],
    ['Le filet qui se resserre (3,5 / 9 / 20 %)', (l, x) => paliers(ecart(l, x), [0.035, 0.09, 0.2])],
    ['Paliers, grandeurs en rapport (±10/25/60 %)', (l, x) => (l.annee ? paliers(ecart(l, x), [0.035, 0.09, 0.2]) : paliers(rapport(l, x), [Math.log(1.1), Math.log(1.25), Math.log(1.6)]))],
    ['En deux temps (★ la bonne tranche)', (l, x) => deuxTemps(l, x)],
    ['En deux temps, ★ aussi à une demi-tranche', (l, x) => deuxTemps(l, x, true)],
  ]
  const tableau = (titre: string, ls: Lancer[], auHasard: (nom: string) => number | null) => {
    console.log(`== ${titre} (${ls.length} lancers)\nrègle                                          réussies  ★/manche  au hasard`)
    for (const [nom, f] of regles) {
      const s = ls.map(l => f(l, l.x, false))
      const h = auHasard(nom) ?? Math.round((100 * ls.filter(l => f(l, milieu(l), true) > 0).length) / ls.length)
      console.log(`${nom.padEnd(46)} ${pct(s.filter(Boolean).length, ls.length)}     ${(s.reduce((a, b) => a + b, 0) / ls.length).toFixed(2)}     ${String(h).padStart(3)} %`)
    }
    console.log('')
  }
  // Au hasard, les deux temps se jouent par quatre boutons : une chance sur quatre.
  const hasardDesDeuxTemps = (nom: string) => (nom.startsWith('En deux temps') ? 25 : null)
  tableau('Tous les lancers', lancers, hasardDesDeuxTemps)
  tableau('Depuis le 4 novembre', lancers.filter(l => l.jour >= '2026-11-04'), hasardDesDeuxTemps)
  // Ce que le nouveau Filet poserait : sans ce qui se calcule. La base des lignes du moteur et de l'ancrage.
  tableau('Sans ce qui se calcule', lancers.filter(l => !calculs.has(l.id)), hasardDesDeuxTemps)
  const notes = new Map((JSON.parse(fs.readFileSync(path.resolve(ICI, '../maquette-filet/panel-ia.json'), 'utf8')) as any[]).map(n => [n.id, n]))
  for (const [nom, garder] of [['Le moteur : connaissabilité < 25 % (les loteries)', (p: number) => p < 25], ['Le moteur : connaissabilité ≥ 25 %', (p: number) => p >= 25], ['Le moteur : connaissabilité ≥ 40 %', (p: number) => p >= 40]] as const) {
    tableau(nom, lancers.filter(l => !calculs.has(l.id) && notes.get(l.id)?.estimation != null && garder(notes.get(l.id).estimation)), hasardDesDeuxTemps)
  }
} else if (quoi === 'ancrage') {
  // Ce que chaque Français sait placer, contre le reste — le propriétaire, au matin du 9 novembre 2026 : « le levier
  // le plus fort, c'est d'avoir des questions que chacun connaisse, sachant que la population et la connaissance sont
  // des personnes françaises ». L'ancrage de chaque question (`../maquette-filet/ancrage.json`) vient d'agents qui
  // ne voient ni le panel ni les lancers ; ici, les vrais joueurs le jugent. Le curseur est celui de l'ancienne règle :
  // « il savait », c'est à 2 % de la piste près, la mesure du § 1.
  const fichier = process.argv[3] ?? path.resolve(ICI, '../maquette-filet/ancrage.json')
  const ancrage = new Map((JSON.parse(fs.readFileSync(fichier, 'utf8')) as any[]).map(a => [a.id, a]))
  const notes = new Map((JSON.parse(fs.readFileSync(path.resolve(ICI, '../maquette-filet/panel-ia.json'), 'utf8')) as any[]).map(n => [n.id, n.estimation]))
  // Le panel note déjà « la part des joueurs adultes d'une application de quiz grand public française » : le
  // croisement dit si « chaque Français » ajoute quelque chose à sa note, ou la répète.
  const groupes: [string, (a: any, panel: number | undefined) => boolean][] = [
    ['Chaque Français la sait placer', a => a.chacun === true],
    ['Le reste', a => a.chacun === false],
    ['  un sujet français', a => a.chacun === false && a.ancrage === 'france'],
    ['  un sujet du monde', a => a.chacun === false && a.ancrage === 'monde'],
    ['  un sujet de l’étranger', a => a.chacun === false && (a.ancrage === 'etranger' || a.ancrage === 'ailleurs')],
    ['Le panel à 40 % ou plus', (_, n) => n !== undefined && n >= 40],
    ['  et chaque Français la sait placer', (a, n) => n !== undefined && n >= 40 && a.chacun === true],
    ['  sans que chaque Français la sache', (a, n) => n !== undefined && n >= 40 && a.chacun === false],
    ['Le panel sous 40 %', (_, n) => n !== undefined && n < 40],
    ['  et chaque Français la sait placer', (a, n) => n !== undefined && n < 40 && a.chacun === true],
  ]
  const deux = (l: Lancer) => deuxTemps(l, l.x)
  const sans = lancers.filter(l => !ancrage.has(l.id)).length, calcules = lancers.filter(l => calculs.has(l.id)).length
  console.log(`${calcules} lancers sur une question qui se calcule, ${sans} sans ancrage : laissés de côté\n`)
  console.log('groupe                                  lancers  il savait  réussies aujourd’hui  en deux temps  ★/manche')
  for (const [nom, garder] of groupes) {
    const ls = lancers.filter(l => ancrage.has(l.id) && !calculs.has(l.id) && garder(ancrage.get(l.id), notes.get(l.id) ?? undefined))
    if (!ls.length) continue
    const auj = ls.filter(l => ecart(l) <= DEMI[l.taille] + 1e-9).length
    const s = ls.map(deux)
    console.log(`${nom.padEnd(39)} ${String(ls.length).padStart(7)}  ${pct(ls.filter(l => ecart(l) <= 0.02).length, ls.length).padStart(9)}  ${pct(auj, ls.length).padStart(20)}  ${pct(s.filter(Boolean).length, ls.length).padStart(13)}  ${(s.reduce((a, b) => a + b, 0) / ls.length).toFixed(2).padStart(8)}`)
  }
} else if (quoi === 'estime') {
  // Savoir n'est pas savoir placer (`../le-nouveau-filet.md`, § 4.5) : au pilote, les distances entre villes
  // « s'estiment plus qu'elles ne se savent », et tombent pourtant dans le filet. Un agent a jugé, à l'aveugle, ce que
  // chaque Français sait estimer — par ce qu'il vit, qu'il sache le chiffre ou non (`estime-des-posees.json`) ; les
  // lancers disent si ces questions se placent mieux que les autres, au-delà de ce que chacun sait.
  const fichierEstime = path.resolve(ICI, 'estime-des-posees.json')
  if (!fs.existsSync(fichierEstime)) throw new Error('estime-des-posees.json manque : le jugement de ce que chaque Français sait estimer ne s’est pas encore rangé à côté de ce script')
  const ancrage = new Map((JSON.parse(fs.readFileSync(path.resolve(ICI, '../maquette-filet/ancrage.json'), 'utf8')) as any[]).map(a => [a.id, a]))
  const estime = new Map((JSON.parse(fs.readFileSync(fichierEstime, 'utf8')) as any[]).map(a => [a.id, a.estime]))
  const groupes: [string, (id: string) => boolean][] = [
    ['Chaque Français la sait placer', id => ancrage.get(id)?.chacun === true],
    ['Il la sait estimer, sans la savoir', id => ancrage.get(id)?.chacun !== true && estime.get(id) === true],
    ['Ni l’un ni l’autre', id => ancrage.get(id)?.chacun !== true && estime.get(id) === false],
    ['Il la sait placer ou estimer', id => ancrage.get(id)?.chacun === true || estime.get(id) === true],
  ]
  const deux = (l: Lancer) => deuxTemps(l, l.x)
  const juges = lancers.filter(l => !calculs.has(l.id) && estime.has(l.id))
  console.log(`${juges.length} lancers jugés, sans ce qui se calcule\n`)
  console.log('groupe                                  lancers  il savait  réussies aujourd’hui  en deux temps  ★/manche')
  for (const [nom, garder] of groupes) {
    const ls = juges.filter(l => garder(l.id))
    if (!ls.length) continue
    const auj = ls.filter(l => ecart(l) <= DEMI[l.taille] + 1e-9).length
    const s = ls.map(deux)
    console.log(`${nom.padEnd(39)} ${String(ls.length).padStart(7)}  ${pct(ls.filter(l => ecart(l) <= 0.02).length, ls.length).padStart(9)}  ${pct(auj, ls.length).padStart(20)}  ${pct(s.filter(Boolean).length, ls.length).padStart(13)}  ${(s.reduce((a, b) => a + b, 0) / ls.length).toFixed(2).padStart(8)}`)
  }
} else if (quoi === 'pilote') {
  // Les dix-neuf questions du pilote (`pilote-du-filet.json`), une fois en ligne : ce qui s'estime se place-t-il ?
  // Les six lancers d'aujourd'hui ne le disaient pas (`estime`) ; celles-ci ont été écrites pour le dire. Le jugement
  // qui les sépare est le second, à l'aveugle, sur les deux critères.
  const pilote = (JSON.parse(fs.readFileSync(path.resolve(ICI, 'pilote-du-filet.json'), 'utf8')).questions as any[]).filter(q => q.rangee)
  const groupes: [string, (q: any) => boolean][] = [
    ['Il la sait estimer (second juge)', q => q.secondJuge.estime],
    ['Il ne la sait pas estimer', q => !q.secondJuge.estime],
    ['Tout le pilote', () => true],
  ]
  const deux = (l: Lancer) => deuxTemps(l, l.x)
  console.log(`${pilote.length} questions du pilote, ${lancers.filter(l => pilote.some(q => q.id === l.id)).length} lancers sur elles\n`)
  console.log('groupe                                  lancers  il savait  en deux temps  ★/manche')
  for (const [nom, garder] of groupes) {
    const ids = new Set(pilote.filter(garder).map(q => q.id))
    const ls = lancers.filter(l => ids.has(l.id))
    if (!ls.length) { console.log(`${nom.padEnd(39)} ${String(0).padStart(7)}  — pas encore jouées`); continue }
    const s = ls.map(deux)
    console.log(`${nom.padEnd(39)} ${String(ls.length).padStart(7)}  ${pct(ls.filter(l => ecart(l) <= 0.02).length, ls.length).padStart(9)}  ${pct(s.filter(Boolean).length, ls.length).padStart(13)}  ${(s.reduce((a, b) => a + b, 0) / ls.length).toFixed(2).padStart(8)}`)
  }
} else if (quoi === 'severite') {
  // La sévérité de la règle est un réglage (`../le-nouveau-filet.md`, § 4.5) : stricte, l'acte I se réussit à 84 %,
  // au-dessus des 65 à 80 % que visent les jeux qui règlent leur difficulté, et ne garde que 105 questions. Chaque
  // règle candidate, rejouée sur les lancers réels — sans ce qui se calcule —, puis comptée dans l'échantillon de 435
  // questions tirées au hasard du vivier : ce qu'elle garderait à l'acte I, posables au tireur (`seTendAuFilet`).
  const { lireLaBase } = await import('../../../server/src/core/baseCampagne.ts')
  const { valeurDuFilet } = await import('../../../server/src/core/cabinet/tirages/tas.ts')
  const { seTendAuFilet } = await import('../../../shared/cabinet/jeux/filet.ts')
  const lire = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ICI, f), 'utf8')) as any[]
  const stricte = new Map(lire('../maquette-filet/ancrage.json').map(a => [a.id, a.chacun === true]))
  const large = new Map(lire('ancrage-premiere-passe.json').map(a => [a.id, a.chacun === true]))
  const panel = new Map(lire('../maquette-filet/panel-ia.json').map(n => [n.id, n.estimation as number | null]))
  const estime = new Map(lire('estime-des-posees.json').map(a => [a.id, a.estime === true]))
  const classe = new Map(lire('../vivier-du-filet.json').map(a => [a.id, a]))
  const p = (id: string) => panel.get(id) ?? -1
  const regles: [string, (id: string) => boolean, boolean][] = [
    ['la seconde passe, stricte', id => !!stricte.get(id), true],
    ['la première passe, large', id => !!large.get(id), true],
    ['l’une ou l’autre', id => !!stricte.get(id) || !!large.get(id), true],
    ['les deux', id => !!stricte.get(id) && !!large.get(id), true],
    ['stricte, ou le panel à 60 % et plus', id => !!stricte.get(id) || p(id) >= 60, true],
    ['stricte, ou le panel à 50 % et plus', id => !!stricte.get(id) || p(id) >= 50, true],
    ['stricte, ou large et le panel à 40 %', id => !!stricte.get(id) || (!!large.get(id) && p(id) >= 40), true],
    ['stricte, ou qu’il sait estimer', id => !!stricte.get(id) || !!estime.get(id), false],
  ]
  const parId = new Map(((lireLaBase() as any).questions as any[]).map((q: any) => [q.id, q]))
  const posable = (id: string) => { const q = parId.get(id); const v = q && valeurDuFilet(q); return !!v && seTendAuFilet(v.valeur, v.annee, 2026) && !classe.get(id)?.calcul }
  const echantillon = lire('../maquette-filet/vivier-echantillon.json').filter((id: any) => posable(id))
  const vivier = [...parId.values()].filter((q: any) => !(q.meta.aRelire ?? []).length && posable(q.id)).length
  const juges = lancers.filter(l => !calculs.has(l.id) && stricte.has(l.id))
  const deux = (l: Lancer) => deuxTemps(l, l.x)
  console.log(`${juges.length} lancers jugés ; l'échantillon : ${echantillon.length} questions posables, sur ${vivier} au vivier\n`)
  console.log('règle                                   lancers  en deux temps  ★/manche  dans l’échantillon → au vivier')
  for (const [nom, garder, compte] of regles) {
    const ls = juges.filter(l => garder(l.id))
    const s = ls.map(deux)
    const part = echantillon.filter((id: string) => garder(id)).length / echantillon.length
    console.log(`${nom.padEnd(39)} ${String(ls.length).padStart(7)}  ${pct(s.filter(Boolean).length, ls.length).padStart(13)}  ${(s.reduce((a, b) => a + b, 0) / ls.length).toFixed(2).padStart(8)}  ${compte ? `${pct(Math.round(1000 * part), 1000).padStart(18)} → ~${Math.round(part * vivier)}` : '                 — (jugé sur les seules posées)'}`)
  }
} else if (quoi === 'actes') {
  // Le joueur modèle du nouveau Filet, au calibrage de la traversée (`server/scripts/calibrage-cabinet.ts`,
  // `LOI_DU_FILET_PAR_ACTE`) : la loi des étoiles de chaque acte, sur les lancers réels rejoués en deux temps — sans ce
  // qui se calcule, aux seules questions que le nouveau Filet pose, à l'acte que leur classement d'aujourd'hui leur
  // donne (`acteDuFilet` : le vivier, puis la note du panel). Une borne basse, comme toute la règle rejouée : le curseur
  // d'avant se posait sur une longue piste, et qui ne savait pas le laissait au milieu, souvent hors de la bonne époque.
  const { acteDuFilet, seTendEnDeuxTemps } = await import('../../../shared/cabinet/jeux/filetEnDeuxTemps.ts')
  const lire = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ICI, f), 'utf8')) as any[]
  const classe = new Map(lire('../vivier-du-filet.json').map(a => [a.id, a]))
  const panel = new Map(lire('../panel-du-vivier.json').map(n => [n.id, n.estimation as number]))
  const acteDe = (id: string): number | null => {
    const c = classe.get(id)
    const n = panel.get(id)
    return !c || c.calcul || n === undefined ? null : acteDuFilet({ chacun: c.chacun === true, panel: n })
  }
  const ls = lancers.filter(l => acteDe(l.id) !== null && seTendEnDeuxTemps(l.valeur, l.annee, 2026))
  console.log(`${ls.length} lancers sur une question que le nouveau Filet pose, sans ce qui se calcule\n`)
  console.log('acte        lancers  questions  réussies  ★/manche     0 ★    1 ★    2 ★    3 ★')
  const lois: number[][] = []
  for (const a of [0, 1, 2]) {
    const ici = ls.filter(l => acteDe(l.id) === a)
    const s = ici.map(l => deuxTemps(l, l.x))
    const loi = [0, 1, 2, 3].map(k => s.filter(x => x === k).length / Math.max(1, s.length))
    lois.push(loi.map(x => Math.round(1000 * x) / 1000))
    console.log(
      `${['I', 'II', 'III'][a].padEnd(10)}  ${String(ici.length).padStart(7)}  ${String(new Set(ici.map(l => l.id)).size).padStart(9)}  ${pct(s.filter(Boolean).length, Math.max(1, s.length)).padStart(8)}  ${(s.reduce((x, y) => x + y, 0) / Math.max(1, s.length)).toFixed(2).padStart(8)}  ${loi.map(x => pct(Math.round(1000 * x), 1000)).join('  ')}`,
    )
  }
  console.log(`\nLOI_DU_FILET_PAR_ACTE = ${JSON.stringify(lois)}`)
  // Le Filet d'avant tel que les joueurs l'ont joué, marche par marche — tous les lancers, ce qui se calcule compris : il
  // le posait —, pour que le calibrage compare deux règles sur les mêmes joueurs, pas une règle à un modèle jamais recalé.
  console.log('\nLe Filet d’avant, joué — marche     lancers  réussies  ★/manche     0 ★    1 ★    2 ★    3 ★')
  const parMarche: Record<string, number[]> = {}
  for (const n of ['facile', 'moyen', 'difficile', 'expert']) {
    const ici = lancers.filter(l => l.niveau === n)
    if (!ici.length) continue
    const s = ici.map(l => (ecart(l) <= DEMI[l.taille] + 1e-9 ? ETOILES[l.taille] : 0))
    const loi = [0, 1, 2, 3].map(k => s.filter(x => x === k).length / s.length)
    parMarche[n] = loi.map(x => Math.round(1000 * x) / 1000)
    console.log(
      `${n.padEnd(33)}  ${String(ici.length).padStart(7)}  ${pct(s.filter(Boolean).length, s.length).padStart(8)}  ${(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2).padStart(8)}  ${loi.map(x => pct(Math.round(1000 * x), 1000)).join('  ')}`,
    )
  }
  console.log(`\nLOI_DU_FILET_D_AVANT_PAR_MARCHE = ${JSON.stringify(parMarche)}`)
} else {
  throw new Error(`« ${quoi} » : lancers, regles, ancrage, estime, pilote, severite ou actes`)
}

// Les duels mesurés sur une vraie base, en lecture seule : ce que les joueurs
// font vraiment par série, où en sont leurs duels, et où chacun serait avec
// d'autres règles — ses vrais duels rejoués. Le souhait du propriétaire du
// 14 octobre 2026, « avoir exactement les métriques utilisateur » avant de
// toucher à la cote : l'échelle d'alors (1000 = 8 bonnes réponses, 50 points
// chacune) avait été posée sans mesure, et un joueur qui trouve chaque marche
// au taux qui la définit fait 6,6 de moyenne et ne dépasse 10 qu'une série
// sur vingt — l'Or, à 12, ne s'atteignait qu'en étant très fort. Mesurée, la
// médiane valait 7 ; la montée, rejouée ici, est devenue la règle le jour même
// (`shared/duels.ts`). Le script la relit depuis, et la compare à l'ELO
// d'avant.
//
//   cd server
//   PROD_LECTURE_URL=libsql://ta-base.turso.io PROD_LECTURE_TOKEN=… npx tsx scripts/calibrage-duels.ts
//   npx tsx scripts/calibrage-duels.ts file:chemin/vers/restauree.db
//   … --echelles 7/50,7/75,7/100   les échelles que la montée essaie : 1000 = tant de bonnes réponses / points de chacune
//   … --participation 4            ce que chaque duel rapporte sous l'Or, à l'essai
//
// Sous PowerShell : $env:PROD_LECTURE_URL="libsql://…"; $env:PROD_LECTURE_TOKEN="…"; npx tsx scripts/calibrage-duels.ts
// Dans le cloud, derrière son proxy : NODE_USE_ENV_PROXY=1 devant la commande.
//
// Jamais QUIZ_DB_URL : posée dans un environnement pour mesurer, le serveur,
// `npm run dev` et le smoke la liraient aussi, et écriraient dans la vraie
// base dès leur démarrage. Un jeton en lecture seule suffit
// (`turso db tokens create <base> --read-only`). Le script ne lance que des
// SELECT, dans une transaction en lecture seule, et n'imprime que des totaux :
// ni un nom, ni un identifiant — sa sortie se colle dans une conversation.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { InStatement } from '@libsql/client'
import { clientDistant, pourquoiInjoignable } from '../src/core/distante'
import { duelsLus, lectureDesDuels } from '../src/core/campagne'
import { semaineDe } from '../../shared/campagne'
import { enumerer } from '../../shared/classement'
import { jourDe } from '../../shared/jour'
import { lireNombre } from '../../shared/nombres'
import {
  COTE_DE_DEPART,
  DUELS_DE_PLACEMENT,
  LIGUES,
  LIGUES_GARDEES,
  LIGUE_DE_L_ELO,
  MONTEE,
  PARTICIPATION_AU_DESSUS,
  PARTICIPATION_SOUS_L_OR,
  PART_DU_LANCEUR,
  PERTE_SOUS_L_OR,
  POINTS_PAR_BONNE_REPONSE,
  SCORE_DE_REFERENCE,
  apresLeDuel,
  ecartContre,
  forceQuOnVoit,
  ligueDe,
  ligueParCle,
  releverLesDuels,
  resultatDuDuel,
  type DuelJoue,
  type ReglagesDeLaMontee,
} from '../../shared/duels'

// ── Ce qu'on lui demande ──────────────────────────────────────────────────

const options = new Map<string, string>()
const positional: string[] = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) options.set(argv[i].slice(2), argv[++i] ?? '')
  else positional.push(argv[i])
}

// `npm run` lance depuis server/ : un chemin relatif se lit depuis le dossier
// où la commande a été tapée, que npm garde dans INIT_CWD.
const ouOnEst = process.env.INIT_CWD ?? process.cwd()

function echouer(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}

const demandee = positional[0] ?? options.get('db') ?? process.env.PROD_LECTURE_URL
const jeton = options.get('token') ?? process.env.PROD_LECTURE_TOKEN
if (!demandee) {
  echouer(
    'Quelle base ? Pose PROD_LECTURE_URL et PROD_LECTURE_TOKEN (un jeton en lecture seule), ' +
      'ou donne son adresse : npx tsx scripts/calibrage-duels.ts libsql://ta-base.turso.io. Jamais QUIZ_DB_URL : le serveur la lirait aussi.',
  )
}

/** Une base `file:` doit exister : libsql en créerait une vide, et l'on mesurerait du vide sans un mot. */
function resoudre(adresse: string): string {
  if (!adresse.startsWith('file:')) return adresse
  const brut = adresse.split('?')[0]
  const chemin = path.resolve(ouOnEst, brut.startsWith('file://') ? fileURLToPath(brut) : brut.slice('file:'.length))
  if (!existsSync(chemin)) echouer(`Base introuvable : ${chemin}`)
  return `file:${chemin.replace(/\\/g, '/')}`
}
const url = resoudre(demandee)

/**
 * La base telle que la sortie la dit : un fichier par son chemin — il est sur
 * la machine de qui mesure —, une base distante sans son adresse. Son nom
 * d'hôte porte celui que l'administrateur lui a donné, un prénom parfois, et
 * la sortie se colle dans une conversation (la première mesure en production,
 * le 14 octobre 2026).
 */
function lisible(adresse: string): string {
  if (adresse.startsWith('file:')) return adresse
  try {
    return `base distante (${new URL(adresse).protocol.replace(/:$/, '')})`
  } catch {
    return 'base distante'
  }
}

/** Une échelle de la cote : le score qui vaut 1000, et les points de chaque bonne réponse de plus. */
interface Echelle {
  reference: number
  pente: number
}

const ECHELLE_D_AUJOURDHUI: Echelle = { reference: SCORE_DE_REFERENCE, pente: POINTS_PAR_BONNE_REPONSE }
/** Celle d'avant la montée : 1000 valait huit bonnes réponses, posé sans mesure. */
const ECHELLE_D_AVANT: Echelle = { reference: 8, pente: 50 }

function lireLesEchelles(texte: string): Echelle[] {
  return texte.split(',').map(e => {
    const [reference, pente] = e.split('/').map(n => lireNombre(n) ?? NaN)
    if (!(reference > 0) || !(pente > 0)) echouer(`Échelle illisible : « ${e} ». Écris 7/75 — 1000 vaut 7 bonnes réponses, 75 points chacune.`)
    return { reference, pente }
  })
}
const echelles = lireLesEchelles(options.get('echelles') ?? `${SCORE_DE_REFERENCE}/${POINTS_PAR_BONNE_REPONSE},7/75,7/100`)

// ── La montée, et ce qu'on essaie ─────────────────────────────────────────
//
// Les règles proposées au propriétaire le 14 octobre 2026, après « je fais
// que reculer » d'une joueuse qui lançait beaucoup de duels, et devenues la
// règle le même jour (`shared/duels.ts`) : deux chiffres — la cote cachée,
// l'ELO, règle Automate ; celle qu'on voit avance —, et l'Or pour qui joue.
// Le rejeu les prend au code, formule comprise (`apresLeDuel`) : seule la
// participation sous l'Or s'essaie d'ici (`--participation`).

const participation = options.has('participation') ? (lireNombre(options.get('participation')!) ?? NaN) : PARTICIPATION_SOUS_L_OR
if (!(participation >= 0)) echouer(`Participation illisible : « ${options.get('participation')} ». Écris un nombre de points, 5 par exemple.`)
const essayee: ReglagesDeLaMontee = { ...MONTEE, sousLOr: participation }

const SEUIL_DE_L_OR = ligueParCle('or').depuis

// ── La lecture ────────────────────────────────────────────────────────────

/** Rien que des lectures : une instruction qui ne commence pas par SELECT ne part pas. */
function lecture(s: InStatement): InStatement {
  const sql = typeof s === 'string' ? s : s.sql
  if (!/^\s*SELECT\s/i.test(sql)) throw new Error(`instruction refusée — ce script ne fait que lire : ${sql.trim().slice(0, 40)}…`)
  return s
}

/** Les séries finies de la campagne et du défi de la semaine : leur score, et s'il leur restait des vies — abandonnées en route. */
const SERIES_FINIES = `SELECT COALESCE(mode, 'serie') AS mode, profile_id, justes, vies FROM campagne_series
  WHERE finie_le IS NOT NULL AND COALESCE(mode, 'serie') IN ('serie', 'defi')`

/** Chaque côté d'un duel classé contre quelqu'un : qui l'a lancé, contre qui, et quand — la cote d'en face se relit à cet instant. */
const DUELS_CONTRE = `SELECT m.id AS serie, m.profile_id AS joueur, d.auteur AS auteur, d.adversaire AS adversaire, d.cree_le AS cree_le
  FROM campagne_series m JOIN campagne_duels d ON d.code = m.duel
  WHERE m.mode = 'duel' AND d.adversaire IS NOT NULL`

const maintenant = Date.now()
// L'en-tête d'abord : une lecture qui échoue dit encore ce qu'elle visait.
console.log(`Les duels mesurés · ${new Date(maintenant).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} · ${lisible(url)}`)
console.log('Lecture seule : rien n’est écrit, et rien ici ne nomme personne.')
const client = clientDistant(url, jeton)
const [series, journal, contre] = await client
  .batch([SERIES_FINIES, lectureDesDuels(null, maintenant), DUELS_CONTRE].map(lecture), 'read')
  .catch((e: unknown) => {
    // Dans le cloud, le réseau passe par un proxy que le `fetch` de Node ne
    // suit que sous NODE_USE_ENV_PROXY=1 : sans, il ne trouve même pas
    // l'hôte (ENOTFOUND), et l'on accusait la politique réseau.
    const proxy = process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== '1'
    const pourquoi = pourquoiInjoignable(e) ?? (e instanceof Error ? e.message : String(e))
    echouer(`lecture impossible — ${pourquoi}${proxy ? '. Le réseau passe par un proxy que fetch ne suit pas seul : relance avec NODE_USE_ENV_PROXY=1 devant la commande.' : ''}`)
  })
  .finally(() => client.close())

// ── Écrire ────────────────────────────────────────────────────────────────

const pct = (n: number, sur: number) => (sur > 0 ? `${Math.round((100 * n) / sur)} %` : '—')
const decimal = (x: number) => x.toFixed(1).replace('.', ',')
const nombre = (x: number) => (Number.isInteger(x) ? String(x) : decimal(x))
const signe = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${decimal(Math.abs(x))}`
const moyenne = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length
const plusGrand = (v: readonly number[]) => v.reduce((a, b) => Math.max(a, b), -Infinity)

function quantile(tries: readonly number[], q: number): number {
  const i = (tries.length - 1) * q
  const bas = Math.floor(i)
  return tries[bas] + (tries[Math.min(bas + 1, tries.length - 1)] - tries[bas]) * (i - bas)
}

const QUANTILES: [string, number][] = [
  ['p10', 0.1],
  ['p25', 0.25],
  ['médiane', 0.5],
  ['p75', 0.75],
  ['p90', 0.9],
]

function resume(valeurs: readonly number[], ecrire: (x: number) => string = nombre): string {
  if (valeurs.length === 0) return '—'
  const t = [...valeurs].sort((a, b) => a - b)
  return QUANTILES.map(([nom, q]) => `${nom} ${ecrire(quantile(t, q))}`).join(' · ')
}


// ── 1. Ce que les joueurs font par série ──────────────────────────────────

interface SerieFinie {
  mode: string
  joueur: string
  justes: number
  vies: number
}
const finies: SerieFinie[] = series.rows.map(r => ({ mode: String(r.mode), joueur: String(r.profile_id), justes: Number(r.justes), vies: Number(r.vies) }))

/** Les joueurs dont on lit la moyenne : une série ne dit presque rien, cinq commencent à parler. */
const SERIES_PAR_JOUEUR = 5

const TRANCHES: [number, number][] = [
  [0, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 15],
  [16, Infinity],
]

function lesScores(titre: string, liste: readonly SerieFinie[]) {
  const scores = liste.map(s => s.justes)
  console.log(`  ${titre} — ${liste.length} séries, ${new Set(liste.map(s => s.joueur)).size} joueurs`)
  if (scores.length === 0) return
  const auMoins = (k: number) => scores.filter(x => x >= k).length
  console.log(`    score : ${resume(scores)} · moyenne ${decimal(moyenne(scores))}`)
  console.log(
    `    8 ou plus : ${pct(auMoins(8), scores.length)} · plus de 10 : ${pct(auMoins(11), scores.length)} · ` +
      `12 ou plus : ${pct(auMoins(12), scores.length)} · record ${plusGrand(scores)}`,
  )
  const tranches = TRANCHES.map(([a, b]) => `${b === Infinity ? `${a}+` : `${a}-${b}`} ${pct(scores.filter(x => x >= a && x <= b).length, scores.length)}`)
  console.log(`    répartition : ${tranches.join(' · ')}`)
}

console.log('\n1. Ce que les joueurs font par série')
const deCampagne = finies.filter(s => s.mode === 'serie')
// Abandonnée, une série s'arrête avec des vies : son score ne dit pas jusqu'où il serait allé.
const auBout = deCampagne.filter(s => s.vies <= 0)
console.log(`Séries de campagne finies : ${deCampagne.length} — allées au bout (trois fautes) : ${auBout.length} · abandonnées en route : ${deCampagne.length - auBout.length}`)
lesScores('Allées au bout', auBout)
const parJoueur = new Map<string, number[]>()
for (const s of auBout) {
  const siens = parJoueur.get(s.joueur)
  if (siens) siens.push(s.justes)
  else parJoueur.set(s.joueur, [s.justes])
}
const moyennes = [...parJoueur.values()].filter(v => v.length >= SERIES_PAR_JOUEUR).map(moyenne)
console.log(`  Moyenne de chaque joueur (${SERIES_PAR_JOUEUR} séries ou plus) — ${moyennes.length} joueurs`)
if (moyennes.length > 0) console.log(`    ${resume(moyennes, decimal)}`)
lesScores('Défi de la semaine, tentatives allées au bout', finies.filter(s => s.mode === 'defi' && s.vies <= 0))
console.log('  (Les duels n’y comptent pas : gagnés en second, ils s’arrêtent à la réponse qui passe devant.)')

// ── 2. Les duels aujourd'hui ──────────────────────────────────────────────

/** Un côté d'un duel classé fini, et qui l'a joué — contre quelqu'un : qui, et quand ce fut lancé (s'il l'a lancé, le journal le dit). */
interface Partie extends DuelJoue {
  joueur: string
  contre?: { profil: string; lanceLe: number }
}

const lignesDe = new Map<string, Record<string, unknown>[]>()
for (const r of journal.rows) {
  const joueur = String(r.profile_id)
  const siennes = lignesDe.get(joueur)
  if (siennes) siennes.push(r)
  else lignesDe.set(joueur, [r])
}
const journaux = new Map([...lignesDe].map(([joueur, lignes]) => [joueur, duelsLus(lignes)]))
const lances = new Map(contre.rows.map(r => [String(r.serie), { joueur: String(r.joueur), auteur: String(r.auteur), adversaire: String(r.adversaire), creeLe: Number(r.cree_le) }]))

const parties: Partie[] = []
for (const [joueur, duels] of journaux) {
  for (const d of duels) {
    const l = d.coteAdverse === undefined ? undefined : lances.get(d.serie)
    parties.push({ ...d, joueur, ...(l && { contre: { profil: l.joueur === l.auteur ? l.adversaire : l.auteur, lanceLe: l.creeLe } }) })
  }
}
// L'ordre du journal, celui où `releverLesDuels` relit chacun.
parties.sort((a, b) => a.finiLe - b.finiLe || (a.serie < b.serie ? -1 : a.serie > b.serie ? 1 : 0))

const semaineDeLInstant = (instant: number) => semaineDe(jourDe(instant))
const releves = new Map([...journaux].map(([joueur, duels]) => [joueur, releverLesDuels(duels, semaineDeLInstant)]))

// ── Rejouer le journal ──

interface Regles {
  nom: string
  echelle: Echelle
  /** Les réglages de la montée — sans eux, l'ELO seul, comme avant le 14 octobre 2026. */
  montee: ReglagesDeLaMontee | null
  /** Les règles de l'application : contre quelqu'un, les cotes figées au lancement, comme `releverLesDuels`. */
  figees: boolean
}

interface Etat {
  /** La cote cachée, l'ELO seul : elle règle Automate. */
  cachee: number
  /** Celle qu'on voit : la même sans la montée. */
  cote: number
  plancher: number | null
  joues: number
  plusHaute: number
  /** Son duel où la cote qu'on voit a passé l'Or, compté depuis le premier ; null : jamais. */
  orA: number | null
  histoire: { le: number; cachee: number; cote: number }[]
}

/** Où il en était avant un instant : la cote d'en face, figée au lancement d'un défi. */
function avant(histoire: Etat['histoire'], instant: number): { cachee: number; cote: number } | undefined {
  for (let i = histoire.length - 1; i >= 0; i--) if (histoire[i].le < instant) return histoire[i]
  return undefined
}

/**
 * Tous les duels de tous, dans l'ordre où ils ont fini : contre quelqu'un, la
 * cote d'en face est celle qu'il avait au lancement — sous ces règles-ci, que
 * sa propre histoire rejouée dit. Les règles d'aujourd'hui relisent les cotes
 * figées du journal, comme l'application : le contrôle compare les deux.
 */
function rejouer(regles: Regles): Map<string, Etat> {
  const etats = new Map<string, Etat>()
  const etatDe = (joueur: string): Etat => {
    let e = etats.get(joueur)
    if (!e) {
      e = { cachee: COTE_DE_DEPART, cote: COTE_DE_DEPART, plancher: null, joues: 0, plusHaute: COTE_DE_DEPART, orA: null, histoire: [] }
      etats.set(joueur, e)
    }
    return e
  }
  const { reference, pente } = regles.echelle
  const coteDuScore = (justes: number) => COTE_DE_DEPART + pente * (justes - reference)
  for (const p of parties) {
    const moi = etatDe(p.joueur)
    const r = resultatDuDuel(p.justes, p.sesJustes)
    let enFace: { cachee: number; cote: number }
    // Au dé, la cachée contre son score ; celle qu'on voit, à chances égales, contre elle-même (`forceQuOnVoit`).
    if (p.coteAdverse === undefined) enFace = { cachee: coteDuScore(p.sesJustes), cote: forceQuOnVoit(p, moi.cote) }
    // Comme `releverLesDuels` : un duel d'avant la montée n'a figé qu'une cote, la cachée bouge contre elle.
    else if (regles.figees) enFace = { cachee: p.coteCacheeAdverse ?? p.coteAdverse, cote: p.coteAdverse }
    else if (!p.contre) {
      // Sans qui ni quand, la cote figée, ramenée à l'échelle essayée.
      const c = COTE_DE_DEPART + ((p.coteAdverse - COTE_DE_DEPART) * pente) / POINTS_PAR_BONNE_REPONSE
      enFace = { cachee: c, cote: c }
    } else {
      const lui = etats.get(p.contre.profil)
      enFace = (lui && avant(lui.histoire, p.contre.lanceLe)) ?? { cachee: COTE_DE_DEPART, cote: COTE_DE_DEPART }
    }
    moi.cachee += ecartContre(moi.cachee, enFace.cachee, moi.joues, r)
    if (!regles.montee) moi.cote = moi.cachee
    else ({ cote: moi.cote, plancher: moi.plancher } = apresLeDuel(moi.cote, moi.plancher, enFace.cote, r, p.lance === true, regles.montee))
    moi.joues++
    moi.plusHaute = Math.max(moi.plusHaute, moi.cote)
    if (moi.orA === null && moi.cote >= SEUIL_DE_L_OR) moi.orA = moi.joues
    moi.histoire.push({ le: p.finiLe, cachee: moi.cachee, cote: moi.cote })
  }
  return etats
}

const echelleLue = (e: Echelle) => `1000 = ${nombre(e.reference)}, ${nombre(e.pente)} points`
const aLEssai = participation === PARTICIPATION_SOUS_L_OR ? '' : ` · +${nombre(participation)} sous l’Or`
const variantes: Regles[] = [
  { nom: `Avant la montée (${echelleLue(ECHELLE_D_AVANT)})`, echelle: ECHELLE_D_AVANT, montee: null, figees: false },
  { nom: `Aujourd’hui (${echelleLue(ECHELLE_D_AUJOURDHUI)})`, echelle: ECHELLE_D_AUJOURDHUI, montee: MONTEE, figees: true },
  ...echelles.map(e => ({ nom: `Montée · ${echelleLue(e)}${aLEssai}`, echelle: e, montee: essayee, figees: false })),
]
const rejoues = variantes.map(v => ({ regles: v, etats: rejouer(v) }))
const dAujourdhui = rejoues[1].etats

console.log('\n2. Les duels aujourd’hui')
const joueurs = [...releves.keys()]
if (joueurs.length === 0) console.log('Aucun duel classé fini.')
else {
  const auDe = parties.filter(p => p.coteAdverse === undefined)
  const contreQuelquun = parties.filter(p => p.coteAdverse !== undefined)
  console.log(`Joueurs qui ont fini un duel classé : ${joueurs.length}`)
  console.log(`Parties jouées : ${parties.length} — au dé : ${auDe.length} · contre quelqu’un : ${contreQuelquun.length} (un duel en compte deux, une par joueur)`)
  const SEMAINE_MS = 7 * 24 * 3_600_000
  const recentes = new Map<string, number>()
  for (const p of parties) if (p.finiLe >= maintenant - SEMAINE_MS) recentes.set(p.joueur, (recentes.get(p.joueur) ?? 0) + 1)
  console.log(`Ces sept derniers jours : ${[...recentes.values()].reduce((a, b) => a + b, 0)} parties, ${recentes.size} joueurs — par joueur : ${resume([...recentes.values()])}`)
  const parSemaine = [...releves.values()].map(r => r.joues / Math.max(1, (maintenant - (r.premierLe ?? maintenant)) / SEMAINE_MS))
  console.log(`Parties par semaine depuis son premier duel : ${resume(parSemaine, decimal)}`)
  const issues = (liste: readonly Partie[]) => {
    const gagnees = liste.filter(p => p.justes > p.sesJustes).length
    const nulles = liste.filter(p => p.justes === p.sesJustes).length
    return `gagnées ${pct(gagnees, liste.length)} · nulles ${pct(nulles, liste.length)} · perdues ${pct(liste.length - gagnees - nulles, liste.length)}`
  }
  console.log(`Issues au dé : ${issues(auDe)} — contre quelqu’un : ${issues(contreQuelquun)}`)
  const ecarts = [...releves.values()].flatMap(r => [...r.ecarts.values()].map(e => e.ecart))
  const gains = ecarts.filter(e => e > 0)
  const pertes = ecarts.filter(e => e < 0)
  console.log(
    `Reculs : ${pct(pertes.length, ecarts.length)} des parties font baisser la cote · ` +
      `gain moyen ${gains.length > 0 ? signe(moyenne(gains)) : '—'} · perte moyenne ${pertes.length > 0 ? signe(moyenne(pertes)) : '—'}`,
  )
  const cotes = [...releves.values()].map(r => r.cote)
  console.log(`Cote : ${resume(cotes, x => String(Math.round(x)))}`)
  // La cachée, son niveau : celle sur laquelle Automate se règle.
  console.log(`Cote cachée : ${resume([...releves.values()].map(r => r.cachee), x => String(Math.round(x)))}`)
  console.log(`Ligues : ${LIGUES.map(l => `${l.court} ${cotes.filter(c => ligueDe(c).cle === l.cle).length}`).join(' · ')}`)
  const sousLeRecord = joueurs.map(j => dAujourdhui.get(j)!.plusHaute - releves.get(j)!.cote)
  console.log(
    `En placement (moins de ${DUELS_DE_PLACEMENT} duels) : ${[...releves.values()].filter(r => r.joues < DUELS_DE_PLACEMENT).length} · ` +
      `sous ${COTE_DE_DEPART} : ${pct(cotes.filter(c => c < COTE_DE_DEPART).length, cotes.length)} · ` +
      `sous leur record : ${decimal(moyenne(sousLeRecord))} points en moyenne, ${pct(sousLeRecord.filter(x => x >= 50).length, sousLeRecord.length)} à 50 ou plus`,
  )
}

// ── 3. Leurs vrais duels, rejoués ─────────────────────────────────────────

console.log('\n3. Leurs vrais duels, rejoués avec d’autres règles')
if (joueurs.length > 0) {
  // Ses deux cotes : la cachée aussi, qui ne se voit nulle part ailleurs.
  const retrouves = joueurs.filter(j => dAujourdhui.get(j)!.cote === releves.get(j)!.cote && dAujourdhui.get(j)!.cachee === releves.get(j)!.cachee).length
  console.log(`Contrôle : le rejeu des règles d’aujourd’hui retrouve la cote de chacun — ${retrouves} sur ${joueurs.length}.`)
  console.log(
    `La montée, la règle depuis le 14 octobre 2026 : +${PARTICIPATION_SOUS_L_OR} par duel sous l’Or, +${PARTICIPATION_AU_DESSUS} au-dessus, ` +
      `+${PART_DU_LANCEUR} de plus pour qui lance un défi ; une défaite à ${Math.round(PERTE_SOUS_L_OR * 100)} % de l’ELO sous l’Or, à 24 × E² ensuite, ` +
      `l’ELO dès la ${ligueParCle(LIGUE_DE_L_ELO).court} (le 17 octobre 2026) ; ${enumerer(LIGUES_GARDEES.map(c => ligueParCle(c).court))} gardés une fois atteints. ` +
      'Automate réglé sur la cote cachée ; au dé, celle qu’on voit se joue à chances égales (le 16 octobre 2026).',
  )
  console.log('Avant la montée : l’ELO seul, une seule cote. « Montée · … » : comme si elle avait toujours été la règle — la cote d’en face rejouée, pas celle figée au lancement.')
  const largeur = Math.max(...variantes.map(v => v.nom.length)) + 2
  const entete = `${''.padEnd(largeur + 2)}${LIGUES.map(l => l.court.padStart(8)).join('')}   médiane   l’Or atteint`
  const groupes: [string, (j: string) => boolean][] = [
    [`Tous (${joueurs.length})`, () => true],
    [`À ${DUELS_DE_PLACEMENT} duels ou plus (${joueurs.filter(j => releves.get(j)!.joues >= DUELS_DE_PLACEMENT).length})`, j => releves.get(j)!.joues >= DUELS_DE_PLACEMENT],
  ]
  for (const [titre, retenu] of groupes) {
    const siens = joueurs.filter(retenu)
    console.log(`\n${titre}`)
    if (siens.length === 0) continue
    console.log(entete)
    for (const { regles, etats } of rejoues) {
      const fins = siens.map(j => etats.get(j)!)
      const parLigue = LIGUES.map(l => String(fins.filter(e => ligueDe(e.cote).cle === l.cle).length).padStart(8)).join('')
      const mediane = quantile(
        fins.map(e => e.cote).sort((a, b) => a - b),
        0.5,
      )
      const arrives = fins.filter(e => e.orA !== null).map(e => e.orA!)
      const orAtteint = arrives.length > 0 ? `${arrives.length}, en ${nombre(quantile([...arrives].sort((a, b) => a - b), 0.5))} duels` : '—'
      console.log(`  ${regles.nom.padEnd(largeur)}${parLigue}   ${String(Math.round(mediane)).padStart(7)}   ${orAtteint}`)
    }
  }
  console.log('\n« l’Or atteint » : combien de joueurs y sont arrivés, et en combien de duels (médiane).')
}

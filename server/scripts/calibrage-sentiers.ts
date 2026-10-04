// Le calibrage des sentiers du savoir (`shared/sentiers.ts`) : la chance de
// valider chaque palier du premier coup, les vies qu'on y laisse et le temps
// qu'il faut, pour des joueurs de plus en plus forts dans la catégorie.
//
// Le modèle est celui de la difficulté des questions (`niveauDuTaux`,
// `shared/campagne.ts`) : une question facile est trouvée par 85 % des
// joueurs, une moyenne par 55 %, une difficile par 30 %, une experte par
// 10 % — le milieu de chaque marche. Un joueur « bon » dans la catégorie
// (θ = 1) a une chance de plus sur l'échelle logistique : 94 % sur une
// facile, 77 % sur une moyenne. C'est le calcul qui a fixé les mélanges et
// les seuils le 5 octobre 2026 ; les vraies épreuves le corrigent ensuite
// (`/admin#campagne`, « Les sentiers »).
//
//   npx tsx scripts/calibrage-sentiers.ts [--seuil 12] [--maitre 9]
import { PALIERS, QUESTIONS_PAR_EPREUVE, type Melange, type RegleDuPalier } from '../../shared/sentiers'
import type { Niveau } from '../../shared/campagne'

function option(nom: string, defaut: number): number {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? Number(process.argv[i + 1]) : defaut
}
const SEUIL = option('seuil', 12)
const SEUIL_MAITRE = option('maitre', 9)
/** Le temps d'une question, lecture de l'anecdote comprise. */
const SECONDES_PAR_QUESTION = 20

/** La part des joueurs qui trouvent une question de chaque marche : le milieu de la marche. */
const TAUX: Record<Niveau, number> = { facile: 0.85, moyen: 0.55, difficile: 0.3, expert: 0.1 }
const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))
const chanceSur = (niveau: Niveau, theta: number) => sigmoide(logit(TAUX[niveau]) + theta)

const JOUEURS: [string, number][] = [
  ['moyen', 0],
  ['assez bon', 0.5],
  ['bon', 1],
  ['très bon', 1.5],
  ['spécialiste', 2],
  ['érudit', 2.5],
]

/** Les seize questions d'un mélange, dans l'ordre où elles se suivent. */
function questionsDe(m: Melange): Niveau[] {
  return (Object.entries(m) as [Niveau, number][]).flatMap(([niveau, n]) => Array<Niveau>(n).fill(niveau))
}

/** La chance d'au moins `seuil` bonnes réponses sur les questions du mélange. */
function chanceDeValider(m: Melange, seuil: number, theta: number): number {
  let loi = [1]
  for (const niveau of questionsDe(m)) {
    const p = chanceSur(niveau, theta)
    const suite = new Array(loi.length + 1).fill(0)
    loi.forEach((x, k) => {
      suite[k] += x * (1 - p)
      suite[k + 1] += x * p
    })
    loi = suite
  }
  return loi.slice(seuil).reduce((a, b) => a + b, 0)
}

/**
 * Les questions qu'un essai pose en moyenne : seize s'il valide — il va au
 * bout, pour les étoiles —, moins s'il s'arrête à la faute de trop.
 */
function questionsParEssai(m: Melange, seuil: number, theta: number): number {
  const fautesPermises = QUESTIONS_PAR_EPREUVE - seuil
  let etats = new Map<string, number>([['0,0', 1]])
  let posees = 0
  for (const niveau of questionsDe(m)) {
    const p = chanceSur(niveau, theta)
    const suite = new Map<string, number>()
    for (const [cle, x] of etats) {
      const [justes, fautes] = cle.split(',').map(Number)
      posees += x
      const ok = `${justes + 1},${fautes}`
      suite.set(ok, (suite.get(ok) ?? 0) + x * p)
      // La faute de trop arrête l'épreuve : cet état ne pose plus rien.
      if (fautes + 1 <= fautesPermises) {
        const ko = `${justes},${fautes + 1}`
        suite.set(ko, (suite.get(ko) ?? 0) + x * (1 - p))
      }
    }
    etats = suite
  }
  return posees
}

const seuilDe = (r: RegleDuPalier) => (r.maitre ? SEUIL_MAITRE : SEUIL)
const pc = (x: number) => (x < 0.01 ? `${(x * 100).toFixed(1)} %` : `${Math.round(x * 100)} %`).replace('.', ',')
const court = (m: Melange) =>
  (Object.entries(m) as [Niveau, number][])
    .map(([n, k]) => `${k} ${n[0].toUpperCase()}`)
    .join(' · ')

console.log(`\nLes sentiers du savoir — ${SEUIL}/16 aux paliers, ${SEUIL_MAITRE}/16 au maître\n`)
console.log(`${'palier'.padEnd(8)}${'mélange'.padEnd(14)}${JOUEURS.map(([nom]) => nom.padStart(13)).join('')}`)
for (const r of PALIERS) {
  const nom = r.maitre ? 'maître' : `P${r.n}${r.avatar !== null ? ' ★' : ''}`
  console.log(`${nom.padEnd(8)}${court(r.melange).padEnd(14)}${JOUEURS.map(([, t]) => pc(chanceDeValider(r.melange, seuilDe(r), t)).padStart(13)).join('')}`)
}
console.log('\n★ : le palier ouvre un portrait. Chaque case : la chance de le valider du premier coup.')

console.log('\nJusqu’au sommet (les douze paliers), en moyenne :')
console.log(`${''.padEnd(14)}${'vies perdues'.padStart(14)}${'questions'.padStart(12)}${'temps'.padStart(10)}${'jours (12 vies)'.padStart(18)}`)
for (const [nom, theta] of JOUEURS) {
  let vies = 0
  let questions = 0
  for (const r of PALIERS.filter(x => !x.maitre)) {
    const p = chanceDeValider(r.melange, seuilDe(r), theta)
    // Chaque essai raté coûte une vie ; il en faut 1/p en moyenne pour valider.
    vies += p > 1e-9 ? 1 / p - 1 : Infinity
    questions += p > 1e-9 ? questionsParEssai(r.melange, seuilDe(r), theta) / p : Infinity
  }
  const heures = (questions * SECONDES_PAR_QUESTION) / 3600
  const jours = vies / 12
  const f = (x: number, d = 0) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }) : '∞')
  console.log(`${nom.padEnd(14)}${f(vies).padStart(14)}${f(questions).padStart(12)}${`${f(heures, 1)} h`.padStart(10)}${f(jours, 1).padStart(18)}`)
}

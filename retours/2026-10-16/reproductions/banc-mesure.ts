// Le banc de la mesure relue (l'étape 4) : ce que coûte, toutes les dix
// minutes d'activité, une mesure neuve — ses deux textes décodés, ses
// familles, la préparation du tirage, la série de référence du dé —, avant et
// après, sur la vraie base et sept mille questions jouées, comme la
// production du 15 octobre 2026 (5 801).
//
// Compilé comme en production (voir `banc-tirage.ts`), depuis `server/` :
//
//   npx esbuild ../retours/2026-10-16/reproductions/banc-mesure.ts --bundle --platform=node \
//     --format=esm --packages=external --outfile=../export/banc/banc-mesure.mjs && node ../export/banc/banc-mesure.mjs
import path from 'node:path'
import { lireLaBase } from '../../../server/src/core/baseCampagne'
import { PreparationDuTirage } from '../../../server/src/core/campagne'
import { AUCUN_ECART, difficulteSansModele, forcePourLeNiveau, indiceDeCategorie, serieDeReference, type SerieDeReference } from '../../../server/src/core/modeleDuSavoir'
import { SCORE_DE_REFERENCE } from '../../../shared/duels'
import { NIVEAUX, QUESTIONS_PAR_MARCHE, QUESTIONS_PAR_SERIE, familleDeQuestion, formeDeReponse, mesuresEnFamille, niveauDeQuestion, type Niveau } from '../../../shared/campagne'

const { questions } = lireLaBase(path.resolve(process.env.DOSSIER ?? 'content/campagne'))
const JOUEES = Number(process.env.JOUEES ?? 7000)

/** Le premier passage, à froid, puis la médiane de quinze. */
function mesurer(nom: string, f: () => unknown, fois = 15): number {
  const temps: number[] = []
  for (let i = 0; i < fois; i++) {
    const t = performance.now()
    f()
    temps.push(performance.now() - t)
  }
  const mediane = [...temps].sort((a, b) => a - b)[Math.floor(fois / 2)]
  console.log(`${nom.padEnd(44)} premier ${temps[0].toFixed(1).padStart(6)} ms · médiane ${mediane.toFixed(1).padStart(6)} ms`)
  return mediane
}

let graine = 7
const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647
const jouees = questions.filter(() => hasard() < JOUEES / questions.length)
const comptes = (k: number) =>
  jouees.map(q => {
    const total = 1 + Math.floor(hasard() * k)
    return [q.id, Math.floor(hasard() * (total + 1)), total] as const
  })
const [toutes, premieres] = [comptes(6), comptes(4)]
console.log(`la base : ${questions.length} questions, ${jouees.length} jouées`)

// Les deux textes de Turso : en objet, d'avant (`json_group_object`), et en tableau (`json_group_array`).
const enObjet = (c: typeof toutes) => JSON.stringify(Object.fromEntries(c.map(([id, j, n]) => [id, [j, n]])))
const enTableau = (c: typeof toutes) => JSON.stringify(c)
const decoderLObjet = (texte: string) =>
  new Map(Object.entries(JSON.parse(texte) as Record<string, [unknown, unknown]>).map(([id, [j, n]]) => [id, { justes: Number(j), total: Number(n) }]))
const decoderLeTableau = (texte: string) => {
  const lues = new Map<string, { justes: number; total: number }>()
  for (const [id, j, n] of JSON.parse(texte) as [unknown, unknown, unknown][]) lues.set(String(id), { justes: Number(j), total: Number(n) })
  return lues
}
const objets = [enObjet(toutes), enObjet(premieres)]
const tableaux = [enTableau(toutes), enTableau(premieres)]
const avantDecodage = mesurer('les deux textes, en objets (avant)', () => objets.map(decoderLObjet))
const apresDecodage = mesurer('les deux textes, en tableaux', () => tableaux.map(decoderLeTableau))
const [brutes, premieresLues] = tableaux.map(decoderLeTableau)

const familles = questions.map(q => ({
  id: q.id,
  difficulte: q.meta.difficulte,
  famille: familleDeQuestion({ categorie: q.meta.categorie, difficulte: q.meta.difficulte, forme: formeDeReponse({ reponses: q.reponses, bonne: q.bonne, valeur: q.meta.valeur }) }),
}))
let mesure = mesuresEnFamille(familles, brutes, premieresLues)
const enFamille = mesurer('ses familles (mesuresEnFamille)', () => (mesure = mesuresEnFamille(familles, brutes, premieresLues)))
const premiere = new PreparationDuTirage(questions, new Map())
let preparee = new PreparationDuTirage(questions, mesure, premiere)
const preparation = mesurer('la préparation du tirage, files gardées', () => (preparee = new PreparationDuTirage(questions, mesure, premiere)))

// La série de référence d'avant, telle qu'elle était le 17 octobre 2026 : ses
// marches relues question par question, ses listes triées par une fonction.
function serieDeReferenceDAvant<T extends { meta: { categorie: string } }>(jouables: readonly T[], marcheDe: (q: T) => Niveau, difficulteDe: (q: T) => number): SerieDeReference {
  const parMarche = new Map<Niveau, Map<number, number[]>>(NIVEAUX.map(n => [n, new Map()]))
  const compte: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  for (const q of jouables) {
    const n = marcheDe(q)
    compte[n]++
    const c = indiceDeCategorie(q.meta.categorie)
    if (c < 0) continue
    const groupe = parMarche.get(n)!
    const liste = groupe.get(c)
    if (liste) liste.push(difficulteDe(q))
    else groupe.set(c, [difficulteDe(q)])
  }
  const marches = {} as Record<Niveau, { categorie: number; difficultes: Float64Array }[]>
  for (const n of NIVEAUX) {
    marches[n] = [...parMarche.get(n)!].map(([categorie, liste]) => {
      liste.sort((a, b) => a - b)
      const k = Math.min(8, liste.length)
      return { categorie, difficultes: Float64Array.from({ length: k }, (_, i) => liste[Math.floor(((i + 0.5) / k) * liste.length)]) }
    })
  }
  const places: Niveau[] = []
  const pris: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  const prendre = (n: Niveau, combien: number) => {
    const k = Math.max(0, Math.min(combien, compte[n] - pris[n], QUESTIONS_PAR_SERIE - places.length))
    for (let i = 0; i < k; i++) places.push(n)
    pris[n] += k
  }
  for (const n of NIVEAUX) prendre(n, QUESTIONS_PAR_MARCHE)
  for (const n of [...NIVEAUX].reverse()) prendre(n, Infinity)
  const reference: SerieDeReference = { places, marches, forceDeDepart: 0 }
  return { ...reference, forceDeDepart: forcePourLeNiveau(SCORE_DE_REFERENCE, AUCUN_ECART, reference) }
}
const difficulte = (q: (typeof questions)[number]) => difficulteSansModele(q.meta.difficulte, mesure.get(q.id))
const avantReference = mesurer('la série de référence du dé (avant)', () =>
  serieDeReferenceDAvant(questions, q => niveauDeQuestion(q.meta.difficulte, mesure.get(q.id)), difficulte),
)
const apresReference = mesurer('la série de référence, marches préparées', () => serieDeReference(questions, (_, i) => preparee.marche(i), difficulte))

const avant = avantDecodage + enFamille + preparation + avantReference
const apres = apresDecodage + enFamille + preparation + apresReference
console.log(`une mesure neuve, médianes : ${avant.toFixed(0)} ms avant, ${apres.toFixed(0)} ms après — et, sous l'activité, hors du chemin de la requête`)

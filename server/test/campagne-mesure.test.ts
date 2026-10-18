// La mesure des difficultés, relue toutes les dix minutes d'activité (le banc
// du 17 octobre 2026, `retours/2026-10-16/`) : la requête qui la trouvait
// périmée — un tirage, un dé — attendait l'aller-retour de toute la mesure,
// son décodage, ses familles, puis le dé sa série de référence : 45 à 70 ms de
// processeur, 1,2 à 1,4 s au dixième de cœur de l'hébergeur.
//
// Les retouches à sortie égale se vérifient contre le code d'avant, recopié
// ici : la série de référence, et le décodage de la mesure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai } from './banc'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { CampagneStore, PreparationDuTirage } from '../src/core/campagne'
import {
  AUCUN_ECART,
  difficulteSansModele,
  forcePourLeNiveau,
  indiceDeCategorie,
  serieDeReference,
  type SerieDeReference,
} from '../src/core/modeleDuSavoir'
import { SCORE_DE_REFERENCE } from '../../shared/duels'
import {
  NIVEAUX,
  QUESTIONS_PAR_MARCHE,
  QUESTIONS_PAR_SERIE,
  familleDeQuestion,
  formeDeReponse,
  mesuresEnFamille,
  niveauDeQuestion,
  type MesureDUneQuestion,
  type Niveau,
} from '../../shared/campagne'

// ── La série de référence d'avant, telle qu'elle était le 17 octobre 2026 ────

const QUANTILES = 8

function serieDeReferenceDAvant<T extends { meta: { categorie: string } }>(
  jouables: readonly T[],
  marcheDe: (q: T) => Niveau,
  difficulteDe: (q: T) => number,
): SerieDeReference {
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
      const k = Math.min(QUANTILES, liste.length)
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

/** Les deux séries de référence, la même : les places, l'ordre des catégories de chaque marche, chaque quantile et la force de départ. */
function memesReferences(nouvelle: SerieDeReference, avant: SerieDeReference, nom: string) {
  assert.deepEqual(nouvelle.places, avant.places, `${nom} : les places`)
  for (const n of NIVEAUX) {
    assert.deepEqual(
      nouvelle.marches[n].map(g => g.categorie),
      avant.marches[n].map(g => g.categorie),
      `${nom} : les catégories de la marche ${n}, dans le même ordre`,
    )
    nouvelle.marches[n].forEach((g, k) => {
      const attendues = avant.marches[n][k].difficultes
      // Au nombre près : un zéro négatif et un zéro valent la même chance.
      assert.ok(g.difficultes.length === attendues.length && g.difficultes.every((d, i) => d === attendues[i]), `${nom} : ${n}, catégorie ${g.categorie}`)
    })
  }
  assert.equal(nouvelle.forceDeDepart, avant.forceDeDepart, `${nom} : la force de départ`)
}

/** Un hasard qu'on rejoue. */
function hasardDe(graine: number) {
  let g = graine
  return () => (g = (g * 16807) % 2147483647) / 2147483647
}

/** Une mesure inventée sur ces questions — leurs réponses, leurs familles —, comme le serveur la calcule. */
function mesureInventee(questions: readonly QuestionDeLaBase[], hasard: () => number): Map<string, MesureDUneQuestion> {
  const brutes = new Map<string, { justes: number; total: number }>()
  const premieres = new Map<string, { justes: number; total: number }>()
  for (const q of questions) {
    if (hasard() >= 0.3) continue
    const total = 1 + Math.floor(hasard() * 8)
    brutes.set(q.id, { justes: Math.floor(hasard() * (total + 1)), total })
    const n = 1 + Math.floor(hasard() * total)
    premieres.set(q.id, { justes: Math.floor(hasard() * (n + 1)), total: n })
  }
  const familles = questions.map(q => ({
    id: q.id,
    difficulte: q.meta.difficulte,
    famille: familleDeQuestion({ categorie: q.meta.categorie, difficulte: q.meta.difficulte, forme: formeDeReponse({ reponses: q.reponses, bonne: q.bonne, valeur: q.meta.valeur }) }),
  }))
  return mesuresEnFamille(familles, brutes, premieres)
}

/** La base du dépôt, lue une fois pour tout le fichier. */
let baseLue: readonly QuestionDeLaBase[] | null = null
const laBase = () => (baseLue ??= lireLaBase().questions)

test('sur la vraie base, la série de référence est celle d’avant : sans modèle, au modèle, et sur une catégorie', () => {
  const base = laBase()
  const hasard = hasardDe(17)
  const mesure = mesureInventee(base, hasard)
  const marche = (q: QuestionDeLaBase) => niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))
  const sansModele = (q: QuestionDeLaBase) => difficulteSansModele(q.meta.difficulte, mesure.get(q.id))
  memesReferences(serieDeReference(base, marche, sansModele), serieDeReferenceDAvant(base, marche, sansModele), 'sans modèle')
  // Au modèle : des difficultés quelconques, des zéros des deux signes et des égalités compris.
  const difficultes = new Map(base.map(q => [q.id, hasard() < 0.05 ? (hasard() < 0.5 ? -0 : 0) : hasard() < 0.1 ? 1.5 : (hasard() - 0.5) * 12]))
  const auModele = (q: QuestionDeLaBase) => difficultes.get(q.id)!
  memesReferences(serieDeReference(base, marche, auModele), serieDeReferenceDAvant(base, marche, auModele), 'au modèle')
  const histoire = base.filter(q => q.meta.categorie === 'Histoire')
  memesReferences(serieDeReference(histoire, marche, auModele), serieDeReferenceDAvant(histoire, marche, auModele), 'une catégorie')
})

test('de petites listes : des marches trop courtes, une catégorie hors des douze, rien du tout', () => {
  const hasard = hasardDe(5)
  const categories = ['Histoire', 'Sport', 'Musique', 'Cuisine', 'Pas une catégorie']
  for (let essai = 0; essai < 300; essai++) {
    const n = Math.floor(hasard() * 90)
    const questions = Array.from({ length: n }, (_, i) => ({
      id: `q${i}`,
      meta: { categorie: categories[Math.floor(hasard() * categories.length)] },
      marche: NIVEAUX[Math.floor(hasard() * NIVEAUX.length)],
      difficulte: Math.round((hasard() - 0.5) * 8 * 4) / 4,
    }))
    type Q = (typeof questions)[number]
    const marche = (q: Q) => q.marche
    const difficulte = (q: Q) => q.difficulte
    memesReferences(serieDeReference(questions, marche, difficulte), serieDeReferenceDAvant(questions, marche, difficulte), `essai ${essai}, ${n} questions`)
  }
})

test('la marche que la préparation du tirage garde est celle du tirage : la série de référence la lit d’elle', () => {
  const base = laBase()
  const mesure = mesureInventee(base, hasardDe(3))
  const preparee = new PreparationDuTirage(base, mesure)
  for (let i = 0; i < base.length; i++) assert.equal(preparee.marche(i), niveauDeQuestion(base[i].meta.difficulte, mesure.get(base[i].id)), base[i].id)
})

// ── La campagne : sa mesure relue ───────────────────────────────────────────

const MAINTENANT = Date.UTC(2026, 9, 17, 9)

function basePermanente(): { url: string; fichier: string; effacer: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-mesure-'))
  const fichier = path.join(dir, 'permanente.db')
  return { url: `file:${fichier.replace(/\\/g, '/')}`, fichier, effacer: () => rmSync(dir, { recursive: true, force: true }) }
}

/** La lecture d'avant : la mesure en deux objets JSON, décodés clé par clé. */
const MESURES_D_AVANT = [
  `SELECT json_group_object(reserve_id, json_array(justes, total)) AS mesures FROM (
     SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM campagne_reponses
     WHERE serie_id NOT IN (SELECT id FROM campagne_series WHERE mode = 'revision') GROUP BY reserve_id
   )`,
  `SELECT json_group_object(reserve_id, json_array(justes, total)) AS mesures FROM (
     SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM (
       SELECT r.reserve_id AS reserve_id, MIN(r.repondue_le * 2 + r.juste) % 2 AS juste
       FROM campagne_reponses r LEFT JOIN campagne_series s ON s.id = r.serie_id
       WHERE COALESCE(s.mode, 'serie') <> 'revision'
       GROUP BY COALESCE(s.profile_id, r.serie_id), r.reserve_id
     ) GROUP BY reserve_id
   )`,
]
const lireDAvant = (texte: unknown) => {
  const lu = typeof texte === 'string' ? (JSON.parse(texte) as Record<string, [unknown, unknown]>) : {}
  return new Map(Object.entries(lu).map(([id, [justes, total]]) => [id, { justes: Number(justes), total: Number(total) }]))
}

/** Ce que la lecture de la mesure dit, d'avant comme d'aujourd'hui : de quoi la compter. */
const LA_MESURE = 'COUNT(*) AS total FROM campagne_reponses'

type Prive = {
  client: { batch: (...args: unknown[]) => Promise<{ rows: Record<string, unknown>[] }[]> }
  mesuresBrutes(): Promise<{ brutes: Map<string, { justes: number; total: number }>; premieres: Map<string, { justes: number; total: number }> }>
  jouables(): Promise<readonly QuestionDeLaBase[]>
  preparations: WeakMap<object, PreparationDuTirage>
  mesuresEnRoute: Promise<void> | null
}

test('la mesure se lit en tableau : les mêmes comptes qu’avant, révisions écartées et premières réponses comprises', async () => {
  const { url, fichier, effacer } = basePermanente()
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(60), maintenant: () => MAINTENANT })
  try {
    await campagne.init()
    const prive = campagne as unknown as Prive
    const vide = await prive.mesuresBrutes()
    assert.deepEqual([vide.brutes.size, vide.premieres.size], [0, 0], 'sans une réponse, deux mesures vides')
    const db = new Database(fichier)
    try {
      const serie = db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 0, 3, 0, ?, NULL, ?)`)
      const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)`)
      const hasard = hasardDe(29)
      const modes = ['serie', 'revision', 'sentier', 'rencontre', 'defi', 'serie']
      db.transaction(() => {
        for (let s = 0; s < 40; s++) serie.run(`s${s}`, `p${s % 9}`, MAINTENANT - 86400_000, modes[s % modes.length])
        // Des questions de la base, d'autres qu'elle n'a plus, une qui ressemble à un nombre ; et des réponses sans série.
        const ids = [...Array.from({ length: 30 }, (_, i) => `essai${String(i).padStart(3, '0')}`), 'retiree-1', 'retiree-2', '12345']
        for (let k = 0; k < 900; k++) {
          const serieId = hasard() < 0.05 ? `orpheline${k % 3}` : `s${Math.floor(hasard() * 40)}`
          reponse.run(serieId, k, ids[Math.floor(hasard() * ids.length)], hasard() < 0.6 ? 1 : 0, MAINTENANT - 86400_000 + Math.floor(hasard() * 3600_000))
        }
      })()
    } finally {
      db.close()
    }
    const [brutes, premieres] = await prive.client.batch(MESURES_D_AVANT, 'read')
    const lues = await prive.mesuresBrutes()
    assert.ok(lues.brutes.size > 20 && lues.premieres.size > 20)
    assert.deepEqual(lues.brutes, lireDAvant(brutes.rows[0]?.mesures))
    assert.deepEqual(lues.premieres, lireDAvant(premieres.rows[0]?.mesures))
    assert.equal(typeof [...lues.brutes.keys()].find(id => id === '12345'), 'string', 'un identifiant qui ressemble à un nombre reste un texte')
  } finally {
    campagne.close()
    effacer()
  }
})

test('dans ses deux dernières minutes, la mesure se relit en fond : la requête de la onzième minute la trouve prête, ses tirages préparés', async () => {
  // La requête qui la trouvait périmée attendait l'aller-retour de toute la
  // mesure et son calcul : 1,2 à 1,4 s pour un tirage ou un dé au dixième de
  // cœur de l'hébergeur (le banc du 16 octobre 2026).
  const { url, effacer } = basePermanente()
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(200), maintenant: () => horloge.t })
  try {
    await campagne.init()
    const prive = campagne as unknown as Prive
    const batch = prive.client.batch.bind(prive.client)
    let relectures = 0
    prive.client.batch = (...args: unknown[]) => {
      if (JSON.stringify(args[0]).includes(LA_MESURE)) relectures++
      return batch(...args)
    }
    const jouables = await prive.jouables()
    const premiere = await campagne.mesures()
    assert.equal(relectures, 1)
    // À la septième minute, rien : elle sert telle quelle.
    horloge.t += 7 * 60_000
    assert.equal(await campagne.mesures(), premiere)
    assert.equal(relectures, 1, 'rien à relire avant ses deux dernières minutes')
    // À la neuvième : celle-ci tout de suite, la suivante en fond — une seule, même demandée deux fois.
    horloge.t += 2 * 60_000
    const [a, b] = await Promise.all([campagne.mesures(), campagne.mesures()])
    assert.ok(a === premiere && b === premiere, 'qui la demande reçoit encore celle-ci, sans attendre la relecture')
    for (let tour = 0; tour < 500 && prive.preparations.get(jouables)?.mesure === undefined; tour++) await new Promise(rendre => setTimeout(rendre, 2))
    assert.equal(relectures, 2, 'relue une fois, en fond')
    const preparee = prive.preparations.get(jouables)
    assert.ok(preparee && preparee.mesure !== premiere, 'le tirage de toutes les catégories préparé à la mesure neuve')
    // À la onzième minute de la première : la neuve, sans un aller-retour de plus.
    horloge.t += 2 * 60_000
    const neuve = await campagne.mesures()
    assert.equal(relectures, 2, 'la requête qui l’aurait trouvée périmée ne la relit pas')
    assert.equal(neuve, preparee.mesure, 'la mesure que ses tirages ont préparée')
    // Et la suivante, à son heure, si personne ne l'a demandée avant : sur le chemin de la requête, comme avant.
    horloge.t += 11 * 60_000
    assert.notEqual(await campagne.mesures(), neuve)
    assert.equal(relectures, 3)
  } finally {
    campagne.close()
    effacer()
  }
})

test('une relecture en fond qui échoue ne change rien : la mesure sert jusqu’à son heure, puis se relit', async () => {
  const { url, effacer } = basePermanente()
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(60), maintenant: () => horloge.t })
  const avertir = console.warn
  const avertissements: string[] = []
  console.warn = (...args: unknown[]) => void avertissements.push(args.map(String).join(' '))
  try {
    await campagne.init()
    const prive = campagne as unknown as Prive
    const batch = prive.client.batch.bind(prive.client)
    let echouer = false
    let relectures = 0
    prive.client.batch = (...args: unknown[]) => {
      if (JSON.stringify(args[0]).includes(LA_MESURE)) {
        relectures++
        if (echouer) return Promise.reject(new Error('base muette'))
      }
      return batch(...args)
    }
    const premiere = await campagne.mesures()
    horloge.t += 9 * 60_000
    echouer = true
    assert.equal(await campagne.mesures(), premiere)
    for (let tour = 0; tour < 500 && prive.mesuresEnRoute; tour++) await new Promise(rendre => setTimeout(rendre, 2))
    await new Promise(rendre => setTimeout(rendre, 5))
    assert.equal(relectures, 2)
    assert.ok(avertissements.some(a => a.includes('mesure non relue en fond')), 'le journal le dit')
    assert.equal(await campagne.mesures(), premiere, 'celle d’avant sert encore')
    assert.equal(relectures, 2, 'sans retenter à chaque requête : une base muette ne se fait pas relire en boucle')
    echouer = false
    horloge.t += 2 * 60_000
    const relue = await campagne.mesures()
    assert.notEqual(relue, premiere, 'à son heure, elle se relit')
    assert.equal(relectures, 3)
  } finally {
    console.warn = avertir
    campagne.close()
    effacer()
  }
})

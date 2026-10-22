// Le tirage d'une série, préparé (le banc du 16 octobre 2026,
// `retours/2026-10-16/`, perf-gel-8) : il battait les vingt-quatre mille
// questions de la base, puis les repassait quatre fois — rangées par
// fraîcheur, par marche, par classe, par file — pour en prendre soixante :
// 13 à 25 ms de processeur à chaque série, chaque défi, chaque duel, chaque
// dé, dix fois plus au dixième de cœur de l'hébergeur. Ce que le tirage relit
// de chaque question — sa marche, sa file — se lit désormais une fois par
// liste de jouables et par mesure (`PreparationDuTirage`).
//
// Une retouche du tirage se vérifie au même hasard contre l'ancien, question
// pour question (règle `campagne.md`) : l'ancien est recopié ici, la
// référence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { CampagneStore, PreparationDuTirage, VUE_RECENTE_MS, sujetsDeLaQuestion, tirerUneSerie } from '../src/core/campagne'
import { JourStore } from '../src/core/jour'
import { DejaPrises } from '../src/core/jumelles'
import { NIVEAUX, QUESTIONS_PAR_MARCHE, QUESTIONS_PAR_SERIE, niveauDeQuestion, ordreDeSerie, type MesureDUneQuestion, type Niveau } from '../../shared/campagne'

// ── L'ancien tirage, tel qu'il était le 16 octobre 2026 : la référence ─────

const REGARD_DES_JUMELLES = 12
const classeDeFraicheur = (le: number | undefined, maintenant: number): 0 | 1 | 2 => (le === undefined ? 0 : maintenant - le < VUE_RECENTE_MS ? 2 : 1)

function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

function parFraicheur<T extends { id: string }>(questions: readonly T[], vues: ReadonlyMap<string, number>, maintenant: number): T[] {
  const jamaisVues: T[] = []
  const vuesAvant: { q: T; le: number }[] = []
  const recentes: { q: T; le: number }[] = []
  for (const q of questions) {
    const le = vues.get(q.id)
    if (le === undefined) jamaisVues.push(q)
    else (classeDeFraicheur(le, maintenant) === 2 ? recentes : vuesAvant).push({ q, le })
  }
  const parDate = (a: { le: number }, b: { le: number }) => a.le - b.le
  return [...jamaisVues, ...vuesAvant.sort(parDate).map(x => x.q), ...recentes.sort(parDate).map(x => x.q)]
}

function passeAvant(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

interface Servies<T> {
  categories: Map<string, number>
  sousThemes: Map<string, number>
  deja?: { jumelle(q: T): boolean; prendre(q: T): void }
}

class TourDAvant<T extends { id: string; meta: { categorie: string; sousTheme: string } }> {
  private readonly classes: T[][] = [[], [], []]
  private classe = -1
  private files: { categorie: string; cle: string; questions: T[]; rangs: number[] }[] = []

  constructor(
    questions: readonly T[],
    vues: ReadonlyMap<string, number>,
    maintenant: number,
    private readonly servies: Servies<T>,
  ) {
    for (const q of questions) this.classes[classeDeFraicheur(vues.get(q.id), maintenant)].push(q)
  }

  prendre(n: number): T[] {
    const { categories, sousThemes, deja } = this.servies
    const tirees: T[] = []
    while (tirees.length < n) {
      const choix = this.suivante()
      if (!choix) break
      const { file, i } = choix
      const [q] = file.questions.splice(i, 1)
      file.rangs.splice(i, 1)
      tirees.push(q)
      categories.set(file.categorie, (categories.get(file.categorie) ?? 0) + 1)
      sousThemes.set(file.cle, (sousThemes.get(file.cle) ?? 0) + 1)
      deja?.prendre(q)
    }
    return tirees
  }

  private suivante(): { file: TourDAvant<T>['files'][number]; i: number } | null {
    const { categories, sousThemes, deja } = this.servies
    for (;;) {
      let moins: number[] | null = null
      let egales: TourDAvant<T>['files'] = []
      for (const f of this.files) {
        if (f.questions.length === 0) continue
        const r = [categories.get(f.categorie) ?? 0, sousThemes.get(f.cle) ?? 0]
        if (!moins || passeAvant(r, moins)) {
          moins = r
          egales = [f]
        } else if (!passeAvant(moins, r)) egales.push(f)
      }
      if (egales.length === 0) {
        if (!this.ouvrirLaClasseSuivante()) return null
        continue
      }
      egales.sort((a, b) => a.rangs[0] - b.rangs[0])
      if (!deja) return { file: egales[0], i: 0 }
      let meilleure: { file: (typeof egales)[number]; i: number } | null = null
      for (const f of egales) {
        if (meilleure && f.rangs[0] > meilleure.file.rangs[meilleure.i]) break
        for (let i = 0; i < Math.min(f.questions.length, REGARD_DES_JUMELLES); i++) {
          if (meilleure && f.rangs[i] > meilleure.file.rangs[meilleure.i]) break
          if (!deja.jumelle(f.questions[i])) {
            meilleure = { file: f, i }
            break
          }
        }
      }
      return meilleure ?? { file: egales[0], i: 0 }
    }
  }

  private ouvrirLaClasseSuivante(): boolean {
    if (++this.classe >= this.classes.length) return false
    const parCategorie = new Map<string, Map<string, TourDAvant<T>['files'][number]>>()
    const files: TourDAvant<T>['files'] = []
    const classe = this.classes[this.classe]
    for (let rang = 0; rang < classe.length; rang++) {
      const q = classe[rang]
      const { categorie, sousTheme } = q.meta
      let parSousTheme = parCategorie.get(categorie)
      if (!parSousTheme) parCategorie.set(categorie, (parSousTheme = new Map()))
      let f = parSousTheme.get(sousTheme)
      if (!f) {
        f = { categorie, cle: `${categorie}\u0000${sousTheme}`, questions: [], rangs: [] }
        parSousTheme.set(sousTheme, f)
        files.push(f)
      }
      f.questions.push(q)
      f.rangs.push(rang)
    }
    this.files = files
    return true
  }
}

function tirageDAvant(
  jouables: readonly QuestionDeLaBase[],
  mesure: ReadonlyMap<string, MesureDUneQuestion>,
  vues: ReadonlyMap<string, number> = new Map(),
  maintenant = 0,
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  const parNiveau: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
  for (const q of parFraicheur(melanger(jouables), vues, maintenant)) parNiveau[niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))].push(q)
  const servies: Servies<QuestionDeLaBase> = { categories: new Map(), sousThemes: new Map(), deja: new DejaPrises() }
  const tours = new Map(NIVEAUX.map(n => [n, new TourDAvant(parNiveau[n], vues, maintenant, servies)]))
  const marches: Record<Niveau, QuestionDeLaBase[]> = { facile: [], moyen: [], difficile: [], expert: [] }
  for (const n of NIVEAUX) marches[n].push(...tours.get(n)!.prendre(QUESTIONS_PAR_MARCHE))
  let reste = QUESTIONS_PAR_SERIE - NIVEAUX.reduce((s, n) => s + marches[n].length, 0)
  for (const n of [...NIVEAUX].reverse()) {
    const suite = tours.get(n)!.prendre(reste)
    marches[n].push(...suite)
    reste -= suite.length
  }
  return ordreDeSerie(marches, QUESTIONS_PAR_SERIE)
}

// ── Le même hasard, des deux côtés ──────────────────────────────────────────

/** `f` sous un hasard qui recommence de la même graine : les deux tirages battent les mêmes cartes. */
function auHasard<T>(graine: number, f: () => T): T {
  const avant = Math.random
  let g = graine
  Math.random = () => ((g = (g * 16807) % 2147483647) - 1) / 2147483646
  try {
    return f()
  } finally {
    Math.random = avant
  }
}

const lisible = (serie: readonly { question: QuestionDeLaBase; niveau: Niveau }[]) => serie.map(x => `${x.question.id}:${x.niveau}`)

const MAINTENANT = Date.UTC(2026, 9, 16, 18)
const JOUR_MS = 86_400_000

/** Un hasard à soi, pour inventer les joueurs : il ne touche pas à celui des tirages. */
function inventeur(graine: number) {
  let g = graine
  const hasard = () => ((g = (g * 48271) % 2147483647) - 1) / 2147483646
  return {
    hasard,
    /** Ses vues : `combien` questions, des vues il y a longtemps — certaines au même instant —, d'hier soir, de tout à l'heure, et une horloge en avance. */
    vues(questions: readonly QuestionDeLaBase[], combien: number): Map<string, number> {
      const vues = new Map<string, number>()
      while (vues.size < Math.min(combien, questions.length)) {
        const r = hasard()
        const le =
          r < 0.15 ? MAINTENANT - 30 * JOUR_MS : r < 0.7 ? MAINTENANT - Math.floor(hasard() * 12 * JOUR_MS) : r < 0.97 ? MAINTENANT - Math.floor(hasard() * 2 * VUE_RECENTE_MS) : MAINTENANT + 60_000
        vues.set(questions[Math.floor(hasard() * questions.length)].id, le)
      }
      return vues
    },
    /** Une mesure comme la production : un quart des questions jouées, une à sept réponses chacune, souvent avec le taux de leur famille. */
    mesure(questions: readonly QuestionDeLaBase[]): Map<string, MesureDUneQuestion> {
      const mesure = new Map<string, MesureDUneQuestion>()
      for (const q of questions) {
        if (hasard() >= 0.25) continue
        const total = 1 + Math.floor(hasard() * 7)
        mesure.set(q.id, { justes: Math.floor(hasard() * (total + 1)), total, ...(hasard() < 0.7 && { depart: 0.2 + hasard() * 0.7 }) })
      }
      return mesure
    },
  }
}

// ── Les épreuves ────────────────────────────────────────────────────────────

/** La base du dépôt, lue une fois pour tout le fichier : une seconde et demie à chaque lecture. */
let baseLue: readonly QuestionDeLaBase[] | null = null
const laBase = () => (baseLue ??= lireLaBase().questions)

test('sur la vraie base, la série préparée est celle d’avant, question pour question, au même hasard', () => {
  const base = laBase()
  const parCategorie = base.filter(q => q.meta.categorie === 'Histoire')
  const surUnSujet = base.filter(q => sujetsDeLaQuestion(q).includes('annees-80'))
  const joueurs = inventeur(11)
  for (const [nom, jouables] of [
    ['toute la base', base],
    ['une catégorie', parCategorie],
    ['un sujet', surUnSujet],
  ] as const) {
    const mesure = joueurs.mesure(jouables)
    // Une préparation gardée, comme le serveur la garde, et tirée pour chacun.
    const preparee = new PreparationDuTirage(jouables, mesure)
    for (const combien of [0, 40, 500, 3000, Math.floor(jouables.length * 0.9)]) {
      const vues = joueurs.vues(jouables, combien)
      for (let graine = 1; graine <= 3; graine++) {
        const attendue = lisible(auHasard(graine, () => tirageDAvant(jouables, mesure, vues, MAINTENANT)))
        assert.equal(attendue.length, QUESTIONS_PAR_SERIE)
        assert.deepEqual(lisible(auHasard(graine, () => preparee.tirer(vues, MAINTENANT))), attendue, `${nom}, ${combien} vues, graine ${graine}`)
        assert.deepEqual(lisible(auHasard(graine, () => tirerUneSerie(jouables, mesure, vues, MAINTENANT))), attendue, `${nom}, ${combien} vues, graine ${graine}`)
      }
    }
  }
})

test('une petite base épuisée de jamais vues : les vues, puis celles de ces vingt-quatre heures, dans le même ordre qu’avant', () => {
  const joueurs = inventeur(5)
  const categories = ['Histoire', 'Sport', 'Musique', 'Cuisine']
  for (let essai = 0; essai < 300; essai++) {
    const n = 1 + Math.floor(joueurs.hasard() * 120)
    const jouables = Array.from({ length: n }, (_, i) => {
      const categorie = categories[Math.floor(joueurs.hasard() * categories.length)]
      const sousTheme = `st${Math.floor(joueurs.hasard() * 4)}`
      // Des formes et des réponses qui se répètent : les jumelles se cherchent.
      const forme = Math.floor(joueurs.hasard() * 6)
      return {
        id: `q${essai}-${i}`,
        texte: `Forme ${forme} numéro ${i} ?`,
        reponses: ['A', 'B', 'C', `D${Math.floor(joueurs.hasard() * 8)}`].map(r => `${r}${Math.floor(joueurs.hasard() * 3)}`),
        bonne: 0,
        meta: { categorie, sousTheme, difficulte: 1 + Math.floor(joueurs.hasard() * 5) },
      } as unknown as QuestionDeLaBase
    })
    // Des vues pour presque toutes : les marches s'épuisent, les classes suivantes s'ouvrent.
    const vues = joueurs.vues(jouables, Math.floor(joueurs.hasard() * (n + 1)))
    // Et des vues au même instant : le tri stable garde l'ordre du battage.
    if (essai % 3 === 0) for (const id of [...vues.keys()].slice(0, 10)) vues.set(id, MAINTENANT - 5 * JOUR_MS)
    const mesure = joueurs.mesure(jouables)
    const graine = 1 + essai
    assert.deepEqual(
      lisible(auHasard(graine, () => new PreparationDuTirage(jouables, mesure).tirer(vues, MAINTENANT))),
      lisible(auHasard(graine, () => tirageDAvant(jouables, mesure, vues, MAINTENANT))),
      `essai ${essai}, ${n} questions, ${vues.size} vues`,
    )
  }
})

test('deux questions du même identifiant — un test, une base mal rangée : le tirage les relit une à une, comme avant', () => {
  const joueurs = inventeur(8)
  const jouables = Array.from({ length: 80 }, (_, i) => ({
    id: `d${i % 50}`,
    texte: `Question ${i} ?`,
    reponses: [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
    bonne: 0,
    meta: { categorie: i % 2 ? 'Sport' : 'Histoire', sousTheme: `st${i % 3}`, difficulte: 1 + (i % 5) },
  })) as unknown as QuestionDeLaBase[]
  for (let graine = 1; graine <= 20; graine++) {
    const vues = joueurs.vues(jouables, 30)
    const mesure = joueurs.mesure(jouables)
    assert.deepEqual(
      lisible(auHasard(graine, () => tirerUneSerie(jouables, mesure, vues, MAINTENANT))),
      lisible(auHasard(graine, () => tirageDAvant(jouables, mesure, vues, MAINTENANT))),
      `graine ${graine}`,
    )
  }
})

test('préparé une fois, le tirage ne relit plus ni la mesure ni les vues question par question', () => {
  // Avant : à chaque série, la mesure de chacune des vingt-quatre mille
  // questions, et ses vues deux fois — `parFraicheur`, puis chaque marche.
  const comptee = <V>(m: Map<string, V>) => {
    let lectures = 0
    const get = m.get.bind(m)
    m.get = (cle: string) => {
      lectures++
      return get(cle)
    }
    return { m, lectures: () => lectures }
  }
  const joueurs = inventeur(21)
  const jouables = laBase().slice(0, 4000)
  const mesure = comptee(joueurs.mesure(jouables))
  const preparee = new PreparationDuTirage(jouables, mesure.m)
  const aLaPreparation = mesure.lectures()
  assert.ok(aLaPreparation <= jouables.length, `${aLaPreparation} lectures de la mesure pour ${jouables.length} questions`)
  for (let i = 0; i < 5; i++) {
    const vues = comptee(joueurs.vues(jouables, 300))
    assert.equal(preparee.tirer(vues.m, MAINTENANT).length, QUESTIONS_PAR_SERIE)
    assert.equal(vues.lectures(), 0, 'ses vues se marquent depuis ses vues, pas depuis la base')
  }
  assert.equal(mesure.lectures(), aLaPreparation, 'la mesure ne se relit pas à chaque tirage')
})

test('la mesure qui change, toutes les dix minutes, garde les files de ses jouables : la série reste celle d’avant', () => {
  const joueurs = inventeur(31)
  const jouables = laBase().filter(q => q.meta.categorie === 'Sport')
  const premiere = new PreparationDuTirage(jouables, joueurs.mesure(jouables))
  const mesure = joueurs.mesure(jouables)
  const suivante = new PreparationDuTirage(jouables, mesure, premiere)
  const prive = (p: PreparationDuTirage) => p as unknown as { files: Int32Array }
  assert.equal(prive(suivante).files, prive(premiere).files, 'les files ne se refont pas')
  for (let graine = 1; graine <= 5; graine++) {
    const vues = joueurs.vues(jouables, 200)
    assert.deepEqual(
      lisible(auHasard(graine, () => suivante.tirer(vues, MAINTENANT))),
      lisible(auHasard(graine, () => tirageDAvant(jouables, mesure, vues, MAINTENANT))),
      `graine ${graine}`,
    )
  }
})

// ── Ce qui garde la préparation ─────────────────────────────────────────────

/** Une base permanente jetable, le fichier `file:` qui tient le rôle de Turso. */
function basePermanente(): { url: string; fichier: string; effacer: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-tirage-'))
  const fichier = path.join(dir, 'permanente.db')
  return { url: `file:${fichier.replace(/\\/g, '/')}`, fichier, effacer: () => rmSync(dir, { recursive: true, force: true }) }
}

test('la réserve du quiz du jour, relue inchangée, garde son ensemble : la campagne garde ses jouables et ce qu’elle en a tiré', async () => {
  // Relue en un ensemble neuf toutes les dix minutes, elle faisait refaire à
  // la campagne ses jouables, leurs sujets et la préparation de ses tirages —
  // pour une réserve qui ne change qu'au matin.
  const { url, fichier, effacer } = basePermanente()
  const horloge = { t: MAINTENANT }
  const profils = new ProfileStore(url)
  const jour = new JourStore(url, undefined, { profiles: profils, maintenant: () => horloge.t })
  const ajouter = (empreinte: string) => {
    const db = new Database(fichier)
    try {
      db.prepare('INSERT INTO jour_reserve (id, question, empreinte, source, ajoutee_le) VALUES (?, ?, ?, ?, ?)').run(empreinte, '{}', empreinte, 'essai', horloge.t)
    } finally {
      db.close()
    }
  }
  try {
    await profils.init()
    await jour.init()
    ajouter('quelle est la capitale du perou')
    const avant = await jour.empreintes()
    horloge.t += 11 * 60_000
    assert.equal(await jour.empreintes(), avant, 'relue à l’identique : le même ensemble')
    ajouter('qui a peint la joconde')
    horloge.t += 11 * 60_000
    const apres = await jour.empreintes()
    assert.notEqual(apres, avant, 'une question de plus : un ensemble neuf')
    assert.ok(apres.has('qui a peint la joconde'))
  } finally {
    jour.close()
    profils.close()
    effacer()
  }
})

test('le préchauffage compte les sujets et prépare le tirage en fond : la première ouverture et le premier tirage les trouvent faits', async () => {
  // À la première ouverture après un réveil, les vingt-quatre mille
  // questions passaient par les sujets d'un bloc : 1,5 s de serveur figé au
  // dixième de cœur de l'hébergeur (le banc du 16 octobre 2026).
  const { url, effacer } = basePermanente()
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(900, { categories: ['Nature', 'Histoire', 'Sport'] }) })
  try {
    await campagne.init()
    const prive = campagne as unknown as {
      jouables(): Promise<readonly QuestionDeLaBase[]>
      choixGardes: WeakMap<object, unknown>
      preparations: WeakMap<object, PreparationDuTirage>
    }
    const jouables = await prive.jouables()
    assert.ok(!prive.choixGardes.has(jouables), 'rien de compté avant le préchauffage')
    campagne.prechauffer()
    // Les deux, dans n'importe quel ordre : l'ajustement du modèle, que le
    // préchauffage lance aussi, peut préparer le tirage le premier — sa série
    // de référence en lit les marches (`referencePour`). Attendre le seul
    // tirage s'arrêtait alors avant les sujets, une fois sur deux en CI.
    for (let tour = 0; tour < 500 && !(prive.choixGardes.has(jouables) && prive.preparations.has(jouables)); tour++) {
      await new Promise(rendre => setTimeout(rendre, 2))
    }
    assert.ok(prive.choixGardes.has(jouables), 'les sujets comptés en fond, avant que personne ne les demande')
    const preparee = prive.preparations.get(jouables)
    assert.ok(preparee, 'le tirage préparé en fond')
    assert.equal(preparee.mesure, await campagne.mesures(), 'à la mesure que le premier tirage lira')
  } finally {
    campagne.close()
    effacer()
  }
})

test('un choix de catégories garde sa liste de jouables, et la préparation de son tirage avec', async () => {
  // Filtrée à neuf à chaque série, chaque duel, chaque dé sur des catégories
  // choisies — les trois quarts des séries et la moitié des duels en
  // production, le 19 octobre 2026 —, la liste repassait la base au crible, et
  // la préparation de son tirage, rangée par liste, se refaisait pour rien.
  const { url, effacer } = basePermanente()
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(900, { categories: ['Nature', 'Histoire', 'Sport'] }) })
  try {
    await campagne.init()
    const prive = campagne as unknown as {
      jouables(categories?: readonly string[]): Promise<readonly QuestionDeLaBase[]>
      tirage(jouables: readonly QuestionDeLaBase[], mesure: ReadonlyMap<string, unknown>): PreparationDuTirage
    }
    const histoire = await prive.jouables(['Histoire'])
    assert.equal(histoire.length, 300)
    assert.ok(histoire.every(q => q.meta.categorie === 'Histoire'))
    assert.equal(await prive.jouables(['Histoire']), histoire, 'le même choix, la même liste')
    const deux = await prive.jouables(['Sport', 'Histoire'])
    assert.equal(await prive.jouables(['Histoire', 'Sport', 'Histoire']), deux, 'dans n’importe quel ordre, doublons compris')
    assert.deepEqual(deux, (await prive.jouables()).filter(q => q.meta.categorie !== 'Nature'), 'dans l’ordre de la base, comme filtrée à neuf')
    const mesure = await campagne.mesures()
    assert.equal(prive.tirage(await prive.jouables(['Histoire']), mesure), prive.tirage(histoire, mesure), 'un seul tirage préparé pour ce choix')
  } finally {
    campagne.close()
    effacer()
  }
})

test('ceux qui trouvent la mesure périmée ensemble n’en relisent qu’une, et reçoivent la même', async () => {
  // Le préchauffage, le modèle du savoir, deux tirages : chacun relisait tous
  // les comptes, et chacun refaisait une mesure neuve — que les tirages
  // préparés prenaient pour une autre.
  const { url, effacer } = basePermanente()
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(200), maintenant: () => horloge.t })
  try {
    await campagne.init()
    // Chaque relecture des comptes : celle du journal des réponses (`mesuresBrutes`).
    const prive = campagne as unknown as { mesuresBrutes: () => Promise<unknown>; mesuresEnRoute: Promise<void> | null }
    const relire = prive.mesuresBrutes.bind(campagne)
    let relectures = 0
    prive.mesuresBrutes = () => {
      relectures++
      return relire()
    }
    const [a, b, c] = await Promise.all([campagne.mesures(), campagne.mesures(), campagne.mesures()])
    assert.equal(relectures, 1, 'une seule relecture pour trois demandes')
    assert.ok(a === b && b === c, 'la même mesure pour tous')
    assert.equal(await campagne.mesures(), a, 'gardée dix minutes')
    horloge.t += 11 * 60_000
    // Périmée, elle se relit en fond : qui la demande pendant ce temps reçoit celle qu'il y a.
    const [d, e] = await Promise.all([campagne.mesures(), campagne.mesures()])
    assert.equal(relectures, 2, 'périmée : une relecture de plus, une seule')
    assert.ok(d === a && e === a, 'personne ne l’attend : celle qu’il y a, la même pour tous')
    for (let tour = 0; tour < 500 && prive.mesuresEnRoute; tour++) await new Promise(rendre => setTimeout(rendre, 2))
    assert.notEqual(await campagne.mesures(), a, 'la neuve, relue en fond')
    assert.equal(relectures, 2, 'et pas une de plus')
  } finally {
    campagne.close()
    effacer()
  }
})
